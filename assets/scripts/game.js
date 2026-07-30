/*jslint browser, this*/
/** @import {GameData} from "./utils.js" */
import utils from "./utils.js";

const {Audio, DOMException, URL, document, navigator} = window;
const {eventData, ApiHandler} = utils;
const api = new ApiHandler();
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

/**
* Utility for retrieving a hidden item based
* @param {number} level
* @param {string} category
* @param {string} [lang="en"]
* @returns {Promise<{title: string, word: string}>}
*/
function getAnswer(category, level, lang = "en") {
    if (typeof workerPort?.postMessage !== "function") {
        return utils.getFallBack(lang);
    }
    return new Promise(function (res) {
        const chan = new MessageChannel();
        workerPort.postMessage(
            {randomWordRequest: {category, level}},
            [chan.port2]
        );
        chan.port1.onmessage = function ({data}) {
            const {wordResponse} = data;
            if (wordResponse.title && wordResponse.word) {
                res(data.wordResponse);
            } else {
                res(utils.getFallBack(lang));
            }
        };
    });
}

/**
* Utility for retrieving user game data
* @returns {Promise<GameData>}
*/
async function getGameData(store) {
    const url = new URL(document.URL);
    const opts = {lang: decodeURI(url.pathname).split("/")[1]};
    let tmp;
    opts.level = Number.parseInt(decodeURI(url.hash).replace("#", ""), 10);
    opts.category = store.getValue("_game_", "category");
    tmp = Number.parseInt(store.getValue("_game_", "streak"), 10);
    opts.streak = Number.isFinite(tmp) ? tmp : 0;
    if (!opts.category || !Number.isFinite(opts.level)) {
        window.location.assign(`/${opts.lang}/categories`);
        return;
    }
    tmp = await api.getHearts();
    if (!tmp.ok) {
        console.error("Failed to retrieve user hearts !!!");
        return;
    }
    opts.hearts = tmp.data;
    tmp = await getAnswer(opts.category, opts.level, opts.lang);
    opts.word = tmp.word;
    tmp = await api.getProgress(opts.category, opts.level);
    if (!tmp.ok) {
        console.error("Failed to retrieve the current level progress !!!");
        return;
    }
    opts.progress = tmp.data;
    return opts;
}

function dialogHandler(emitter) {
    const {dispatch, target} = emitter;
    const allowedStatus = ["won", "lost", "paused", "level-up", "perfect"];
    let activeElement;

    if (typeof dispatch !== "function") {
        throw new Error("emitter Should implement the dispatch function !!!");
    }
    if (typeof target.close !== "function") {
        throw new DOMException("The emitter target should be a Dialog !!!");
    }
    target.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
        }
    });
    target.addEventListener("cancel", function (evt) {
        evt.preventDefault();
    });
    target.addEventListener("close", function () {
        if (activeElement) {
            activeElement.focus();
        }
    });
    target.addEventListener("click", function (event) {
        const btn = event.target;
        let {status} = target.dataset;

        if (utils.isButton(btn) && btn.classList.contains("continue-btn")) {
            if (allowedStatus.includes(status) && status !== "paused") {
                engine.saveHearts(8);
                wakeupWorker();
            }
            target.close();
        }
    });
    function showDialog(data) {
        if (!allowedStatus.includes(data.status)) {
            return;
        }
        activeElement = document.activeElement;
        utils.getFocusableChildren(target)[0].focus();
        target.dataset.status = data.status;
        dispatch("title-changed", data);
        target.showModal();
        if (data.status === "won") {
            new Audio("/assets/win-sound.wav").play();
        }
        if (data.status === "lost") {
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
    components.store = utils.jsonStorage();
    components.letterEmitter = dispatcher.emitterOf("letter-found");
    components.headerEmitter = dispatcher.emitterOf("heading-change");
    components.dialogEmitter = dispatcher.emitterOf("dialog-updated");
    components.warningEmitter = dispatcher.emitterOf("reveal-intended");
    showDialog = dialogHandler(components.dialogEmitter);
    components.warn = warningHandler(components.warningEmitter.target);
    components.puzzleReq = 3;
    function verifyGameEnd({category, hearts, lettersFound, word}) {
        const wordLetters = utils.getWords(word).join("").length;
        const found = Object.values(lettersFound).reduce((a, v) => a + v, 0);
        if (hearts < 1) {
            setTimeout(() => showDialog(eventData("lost", components)), 2000);
        }
        if (wordLetters === found) {
            notifyWorker({wordFound: {category, word}});
        }
    }

    function disableButton(target, disable = true) {
        const action = disable ? "disable" : "enable";
        if (!HTMLButtonElement.prototype.isPrototypeOf(target)) {
            throw new Error(`you should provide a valid Button to ${action}`);
        }
        if (disable) {
            target.setAttribute("aria-disabled", true);
            target.setAttribute("aria-describedby", target.dataset.tooltip);
        } else {
            target.removeAttribute("aria-disabled");
            target.removeAttribute("aria-describedby");
        }
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
            const val = target.dataset.reminder;
            if (target.id !== "o-reminder") {
                return;
            }
            store.setValue("_warn_", `remind-${val}`, !target.checked);
        });
        utils.trapFocus(element);
        return function (val) {
            const remind = store.getValue("_warn_", `remind-${val}`) ?? "true";
            element.dataset.purpose = val;
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
    /**
    * Utility for initializing the game engine
    * @param {GameData} gameData
    */
    async function initialize(gameData) {
        let data;
        if (gameData) {
            data = gameData;
        } else {
            data = await getGameData(components.store);
        }
        components.lettersFound = Object.create(null);
        Object.assign(components, data);
        components.headerEmitter.dispatch("title-updated", {
            level: data.level,
            title: data.category,
            titleClass: "nil"
        });
        components.headerEmitter.dispatch("heart-updated", {
            hearts: data.hearts
        });
        components.letterEmitter.target.textContent = "";
        components.letterEmitter.target.insertAdjacentHTML(
            "beforeend",
            utils.createDOMSentence(components.word).join("")
        );
        rootElement.querySelectorAll(
            ".responsive-grid button[data-type='letter][aria-disabled]"
        ).forEach((elt) => disableButton(elt, false));
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
        if (utils.isButton(btn)) {
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
        const {tooltip, type} = target.dataset;
        if (
            !utils.isButton(target) ||
            type !=="letter" && tooltip !== "answer-reveal-tooltip" ||
            target.getAttribute("aria-disabled") !== null ||
            (tooltip === "letter-reveal-tooltip" && components.hearts < 2) ||
            components.hearts <= 0
        ) {
            return;
        }
        if (tooltip === "letter-reveal-tooltip") {
            letter = await components.warn("letter-reveal");
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
        }  else if (tooltip === "answer-reveal-tooltip") {
            letter = utils.dict.answer_reveal_warning[components.lang];
            components.warningEmitter.dispatch("answer-reveal-intended", {
                points: "-60",
                desc: letter.replace("{x}", "60")
            });
            letter = await components.warn("answer-reveal");
            return;
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
        showDialog(eventData("paused", components));
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
    document.querySelectorAll(".no-script").forEach(function (node) {
        node.remove();
    });
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
