/*jslint browser, this*/
import utils from "./utils.js";

const {Audio, DOMException, URL, document, navigator} = window;
const isButton = (t) => window.HTMLButtonElement.prototype.isPrototypeOf(t);
let engine;
let workerPort;
let refreshed;

async function registerWorker() {
    const registration = await navigator.serviceWorker.register(
        "/sw.js",
        {scope: "/"}
    );
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.startMessages();
    navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (refreshed) {
            window.location.reload();
            refreshed = true;
        }
    });
    if (registration.waiting) {
        registration.waiting.postMessage("SKIP_WAITING");
    }
    registration.addEventListener("updatefound", function () {
        if (registration.installing) {
            registration.installing.addEventListener(
                "statechange",
                function () {
                    if (
                        registration.waiting &&
                        navigator.serviceWorker.controller
                    ) {
                        registration.waiting.postMessage("SKIP_WAITING");
                    }
                }
            );
        }
    });
}
function notifyWorker(data) {
    if (typeof workerPort?.postMessage === "function") {
        workerPort.postMessage(data);
    }
}
function handleMessage({data, ports}) {
    if (data.statusUpdateRequest) {
        workerPort = ports[0];
        ports[0].postMessage({statusUpdate: {isOnline: navigator.onLine}});
        engine.init();
    }
    if (data.connectionAcknowledged) {
        engine.init();
    }
}
function getGameData(url) {
    const route = new URL(url);
    const lang = decodeURI(route.pathname).split("/")[1];
    let category = decodeURI(route.hash).replace("#", "");
    category = (
        category.length < 1
        ? utils.getFallBack(lang).title
        : category
    );
    return new Promise(function (res) {
        const chan = new MessageChannel();
        workerPort.postMessage(
            {randomWordRequest: {category}},
            [chan.port2]
        );
        chan.port1.onmessage = function ({data}) {
            const {randomWordResponse} = data;
            if (randomWordResponse.title && randomWordResponse.word) {
                res(data.randomWordResponse);
            } else {
                res(utils.getFallBack(lang));
            }
        };
    });
}

function dialogHandler(emitter) {
    const {dispatch, target} = emitter;
    const allowedStatus = ["won", "lost", "paused"];
    let activeElement;

    if (typeof dispatch !== "function") {
        throw new Error("emitter Should implement the dispatch function !!!");
    }
    if (typeof target.close !== "function") {
        throw new DOMException("The emitter target should be a Dialog !!!");
    }
    target.addEventListener("close", function () {
        if (activeElement) {
            activeElement.focus();
        }
    });
    target.addEventListener("click", function (event) {
        const btn = event.target;
        let {status} = target.dataset;

        if (isButton(btn) && btn.classList.contains("continue-btn")) {
            if (allowedStatus.includes(status) && status !== "paused") {
                engine.saveHearts(8);
                wakeupWorker();
            }
            target.close();
        }
    });
    function showDialog(status) {
        let data = {};
        if (!allowedStatus.includes(status)) {
            return;
        }
        activeElement = document.activeElement;
        utils.getFocusableChildren(target)[0].focus();
        target.dataset.status = status;
        if (status === "paused") {
            data.action = "continue";
        } else {
            data.action = "replay";
        }
        dispatch("title-changed", data);
        target.showModal();
        if (status === "won") {
            new Audio("/assets/win-sound.wav").play();
        }
        if (status === "lost") {
            new Audio("/assets/lose-sound.wav").play();
            if (typeof navigator.vibrate === "function") {
                navigator.vibrate([100, 30, 200]);
            }
        }
    }
    return Object.freeze(showDialog);
}

function Engine(rootElement, dispatcher, maxHearts = 8) {
    const self = Object.create(this);
    const components = Object.create(null);
    const warningDialog = document.querySelector("dialog#warning-dialog");
    let showDialog;

    if (typeof dispatcher?.emitterOf !== "function") {
        throw new DOMException(
            "the dispatcher should implement the emitterOf function !!!"
        );
    }
    components.store = utils.jsonStorage();
    components.letterEmitter = dispatcher.emitterOf("letter-found");
    components.headerEmitter = dispatcher.emitterOf("heading-change");
    components.dialogEmitter = dispatcher.emitterOf("dialog-updated");
    showDialog = dialogHandler(components.dialogEmitter);
    if (window.HTMLDialogElement.prototype.isPrototypeOf(warningDialog)) {
        components.warn = warningHandler(warningDialog);
    } else {
        components.warn = () => Promise.resolve(true);
    }
    function verifyGameEnd({category, hearts, lettersFound, word}) {
        const wordLetters = utils.getWords(word).join("").length;
        const found = Object.values(lettersFound).reduce((a, v) => a + v, 0);
        if (hearts < 1) {
            setTimeout(() => showDialog("lost"), 2000);
        }
        if (wordLetters === found) {
            notifyWorker({wordFound: {category, word}});
            setTimeout(() => showDialog("won"), 2000);
        }
    }
    function disableButton(target) {
        if (!window.HTMLElement.prototype.isPrototypeOf(target)) {
            throw new Error("you should provide a valid Element to disable");
        }
        target.setAttribute("aria-disabled", true);
        target.setAttribute("aria-labelledby", target.dataset.tooltip);
    }
    function getPoints(store, maxPoints) {
        let points;
        const category = decodeURI(new URL(document.URL).hash).replace("#", "");
        if (category.length === 0) {
            return maxPoints;
        }
        points = store.getValue("_game_", category) ?? "";
        points = Number.parseInt(points, 10);
        if (Number.isFinite(points)) {
            return points;
        }
        return maxPoints;
    }
    function setPoints(store, points) {
        const category = decodeURI(new URL(document.URL).hash).replace("#", "");
        if (category.length > 0) {
            store.setValue("_game_", category, points);
        }
    }
    function updateHearts(updater) {
        components.hearts = updater(components.hearts ?? maxHearts);
        components.headerEmitter.dispatch("heart-updated", {
            hearts: components.hearts,
            percentage: (
                Math.floor(components.hearts / maxHearts) * 100
            ) + "%"
        });
    }
    function warningHandler(element) {
        const {store} = components;
        let activeElement;
        element.addEventListener("input", function ({target}) {
            if (target.id !== "o-reminder") {
                return;
            }
            store.setValue("_warn_", "remind", !target.checked);
        });
        utils.trapFocus(element);
        return function () {
            const remind = store.getValue("_warn_", "remind") ?? "true";

            if (remind === "true") {
                return new Promise(function (res) {
                    activeElement = document.activeElement;
                    element.showModal();
                    element.addEventListener("close", function (event) {
                        if (event.target.returnValue === "proceed") {
                            res(true);
                        }
                        event.target.returnValue = "";
                        activeElement.focus();
                        res(false);
                    }, {once: true});
                });
            }

            return Promise.resolve(true);
        };
    }
    async function initialize(gameData) {
        let data;
        if (gameData) {
            data = gameData;
        } else {
            data = await getGameData(document.URL);
        }
        components.lettersFound = Object.create(null);
        components.word = data.word;
        components.category = data.title;
        components.hearts = Math.max(
            getPoints(components.store, maxHearts),
            maxHearts
        );
        components.headerEmitter.dispatch("title-updated", {
            title: data.title,
            titleClass: "nil"
        });
        components.headerEmitter.dispatch("heart-updated", {
            hearts: components.hearts,
            percentage: "100%"
        });
        components.letterEmitter.target.textContent = "";
        components.letterEmitter.target.insertAdjacentHTML(
            "beforeend",
            utils.createDOMSentence(components.word).join("")
        );
        rootElement.querySelectorAll("button.letter[aria-disabled]").forEach(
            function (elt) {
                elt.removeAttribute("aria-disabled");
                elt.removeAttribute("aria-labelledby");
            }
        );
    }

    function listenKeyboard(event) {
        let isLetter = (
            event.key.match(/[a-z]/i) ||
            event.code.match(/key[a-z]/i)
        );
        let btn;
        if (!isLetter) {
            return;
        }
        btn = rootElement.querySelector(
            `[aria-keyshortcuts="${event.key} Shift+${event.key}" i]`
        );
        if (isButton(btn)) {
            if (btn.getAttribute("aria-disabled") === "true") {
                btn.focus();
            } else {
                document.activeElement.blur();
            }
            btn.click();
        }
    }

    async function listenLetterClick(event) {
        let indexes;
        let letter;
        const {target} = event;
        const {tooltip} = target.dataset;
        if (
            !isButton(target) ||
            !target.classList.contains("letter") ||
            target.getAttribute("aria-disabled") !== null ||
            (tooltip === "gift-tooltip" && components.hearts < 2) ||
            components.hearts <= 0
        ) {
            return;
        }
        if (tooltip === "gift-tooltip") {
            letter = await components.warn();
            if (!letter) {
                return;
            }
            [letter, indexes] = utils.getRandomLetter(
                components.word,
                Object.keys(components.lettersFound)
            );
            updateHearts((heart) => heart - 2);
            disableButton(rootElement.querySelector(
                "button[data-tooltip='" + letter + "' i]"
            ));
        } else {
            letter = target.textContent.trim();
            indexes = utils.getIndexes(
                utils.getWords(components.word ?? "").join(""),
                letter
            );
            disableButton(target);
        }
        if (indexes.length < 1) {
            updateHearts((heart) => heart - 1);
        } else {
            components.lettersFound[letter] = indexes.length;
        }
        if (components.hearts < 2) {
            components.headerEmitter.dispatch(
                "bonus-updated",
                {preventTrigger: true}
            );
        }
        indexes.forEach((index) => components.letterEmitter.dispatch(
            "letter" + (index + 1) + "-changed",
            {dimmed: "nil", letter}
        ));
        target.blur();
        verifyGameEnd(components);
    }

    self.init = initialize;
    self.saveHearts = function (bonus = 0) {
        if (!Number.isFinite(bonus)) {
            throw new Error("the bonus should be a number !!!");
        }
        setPoints(components.store, components.hearts + bonus);
    };
    rootElement.addEventListener("click", listenLetterClick);
    rootElement.addEventListener("keydown", listenKeyboard);
    utils.trapFocus(components.dialogEmitter.target);

    document.querySelector(
        "button[aria-controls='menu-dialog']"
    ).addEventListener("click", function (event) {
        event.preventDefault();
        showDialog("paused");
    });
    return self;
}
function wakeupWorker() {
    let channel;
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        channel = new MessageChannel();
        workerPort = channel.port1;
        navigator.serviceWorker.controller.postMessage(
            {connectionRequest: {isOnline: navigator.onLine}},
            [channel.port2]
        );
        workerPort.onmessage = handleMessage;
    }
}
window.addEventListener("online", function () {
    notifyWorker({statusUpdate: {isOnline: true}});
});
window.addEventListener("offline", function () {
    notifyWorker({statusUpdate: {isOnline: false}});
});
window.addEventListener("beforeunload", function () {
    engine.saveHearts();
});
window.addEventListener("DOMContentLoaded", async function () {
    if (navigator.serviceWorker) {
        await registerWorker();
    }
    engine = new Engine(document.body, new utils.EventDispatcher());
    if (!navigator.serviceWorker) {
        engine.init(utils.getFallBack(
            new URL(document.URL).pathname.split("/")[1]
        ));
    }
    wakeupWorker();
});
