/*jslint browser, this*/
import utils from "./utils.js";

const {DOMException, HTMLButtonElement, URL, document, navigator} = window;
const isButton = (target) => HTMLButtonElement.prototype.isPrototypeOf(target);
let engine;
let workerPort;

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "imports"
    });
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.startMessages();
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
window.addEventListener("online", function () {
    notifyWorker({statusUpdate: {isOnline: true}});
});
window.addEventListener("offline", function () {
    notifyWorker({statusUpdate: {isOnline: false}});
});
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
        const btn = event.target
        let {status} = target.dataset;

        if (isButton(btn) && btn.classList.contains("continue-btn")) {
            if (allowedStatus.includes(status) && status !== "paused") {
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
    let showDialog;

    if (typeof dispatcher?.emitterOf !== "function") {
        throw new DOMException(
            "the dispatcher should implement the emitterOf function !!!"
        );
    }
    components.letterEmitter = dispatcher.emitterOf("letter-found");
    components.headerEmitter = dispatcher.emitterOf("heading-change");
    components.dialogEmitter = dispatcher.emitterOf("dialog-updated");
    showDialog = dialogHandler(components.dialogEmitter);
    function verifyGameEnd({category, hearts, lettersFound, word}) {
        const wordLetters = utils.getWords(word).join("").length;
        if (hearts < 1) {
            setTimeout(() => showDialog("lost"), 2000);
        }
        if (wordLetters === lettersFound) {
            notifyWorker({wordFound: {category, word}});
            setTimeout(() => showDialog("won"), 2000);
        }
    }
    async function initialize(gameData) {
        let data;
        if (gameData) {
            data = gameData;
        } else {
            data = await getGameData(document.URL);
        }
        components.lettersFound = 0;
        components.word = data.word;
        components.category = data.title;
        components.hearts = (components.hearts ?? 0) + maxHearts;
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
    function listenLetterClick(event) {
        let indexes;
        let letter;
        const {target} = event;
        if (
            isButton(target) &&
            target.classList.contains("letter") &&
            target.getAttribute("aria-disabled") === null &&
            components.hearts > 0

        ) {
            letter = target.textContent.trim();
            indexes = utils.getIndexes(
                utils.getWords(components.word ?? "").join(""),
                letter
            );
            indexes.forEach((index) => components.letterEmitter.dispatch(
                "letter" + (index + 1) + "-changed",
                {dimmed: "nil", letter}
            ));
            if (indexes.length < 1) {
                components.hearts = (components.hearts ?? maxHearts) - 1;
                components.headerEmitter.dispatch("heart-updated", {
                    hearts: components.hearts,
                    percentage: (
                        Math.floor(components.hearts / maxHearts) * 100
                    ) + "%"
                });
            } else {
                components.lettersFound += indexes.length;
            }
            target.setAttribute("aria-disabled", true);
            target.setAttribute("aria-labelledby", target.textContent.trim());
            target.blur();
            verifyGameEnd(components);
        }
    }

    self.init = initialize;
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
window.addEventListener("DOMContentLoaded", function () {
    engine = new Engine(document.body, new utils.EventDispatcher());
    if (!navigator.serviceWorker) {
        engine.init(utils.getFallBack(
            new URL(document.URL).pathname.split("/")[1]
        ));
    }
    wakeupWorker();
});
