/*jslint browser, this*/
/** @import {GameData, ApiHandlerInstance, PointManagerInstance} from "./types.js" */
import utils from "./utils.js";
import pointing from "./badges.js";
const {Audio, DOMException, URL, document, navigator} = window;
const {ApiHandler, eventData, getWords} = utils;
const {PointManager} = pointing;
/** @type {ApiHandlerInstance} */
const api = new ApiHandler();
/** @type {PointManagerInstance} */
const board = new PointManager(api);
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
function disableButton(target, disable = true) {
    const action = disable ? "disable" : "enable";
    if (!HTMLButtonElement.prototype.isPrototypeOf(target)) {
        throw new Error(`you should provide a valid Button to ${action}`);
    }
    if (disable) {
        target.blur();
        target.setAttribute("aria-disabled", true);
        target.setAttribute("aria-describedby", target.dataset.tooltip);
    } else {
        target.removeAttribute("aria-disabled");
        target.removeAttribute("aria-describedby");
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

function queryWorker(port, input, fn) {
    return function (res) {
        const chan = new MessageChannel();
        port.postMessage(input, [chan.port2]);
        chan.port1.onmessage = function ({data}) {
            let val = data;
            if (typeof fn === "function") {
                val = fn(data);
            }
            res(val);
        };
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
    return new Promise(queryWorker(
        workerPort,
        {itemRequest: {category, level}},
        function (val) {
            const {itemResponse: res} = val;
            if (res.title && res.word) {
                return res;
            } else {
                return utils.getFallBack(lang);
            }
    }));
}

function setHearts(val) {
    if (typeof workerPort?.postMessage !== "function") {
        return;
    }
    return new Promise(queryWorker(
        workerPort,
        {heartUpdateRequest: {hearts: val}}
    ));
}

/**
* Utility for retrieving user game data
* @returns {Promise<GameData>}
*/
async function getGameData(store, replay=false) {
    const url = new URL(document.URL);
    /** @type {GameData} */
    const opts = {lang: decodeURI(url.pathname).split("/")[1]};
    let tmp;
    tmp = Number.parseInt(store.getValue("_game_", "streak"), 10);
    opts.streak = Number.isFinite(tmp) ? tmp : 0;
    opts.category = store.getValue("_game_", "category");
    if (replay) {
        opts.level = Number.parseInt(store.getValue("_game_", "level"), 10);
    } else {
        opts.level = Number.parseInt(decodeURI(url.hash).replace("#", ""), 10);
    }
    if (!opts.category || !Number.isFinite(opts.level)) {
        window.location.assign(`/${opts.lang}/categories`);
        return;
    }
    store.setValue("_game_", "level", opts.level);
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
                engine.init(null, true);
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

/**
 * Utility to verify if we can listen to a click event
 * @param {HTMLElement} target
 * @param {{guess: number, item: number, letter: number}} deductor
 */
function shouldListen(target, deductor, hearts) {
    const {tooltip, type} = target.dataset;
    const checks = [
        !utils.isButton(target),
        type !=="letter" && tooltip !== "answer-reveal-tooltip",
        target.getAttribute("aria-disabled") !== null,
        tooltip === "letter-reveal-tooltip" && hearts < deductor.letter,
        tooltip === "answer-reveal-tooltip" && hearts < deductor.item,
        hearts < 1
    ];
    return !checks.some(Boolean);
}

function Engine(rootElement, dispatcher, minHearts = 9) {
    const self = Object.create(this);
    const context = Object.create(null);
    let showDialog;

    if (typeof dispatcher?.emitterOf !== "function") {
        throw new DOMException(
            "the dispatcher should implement the emitterOf function !!!"
        );
    }
    context.store = utils.jsonStorage();
    context.letterEmitter = dispatcher.emitterOf("letter-found");
    context.headerEmitter = dispatcher.emitterOf("heading-change");
    context.dialogEmitter = dispatcher.emitterOf("dialog-updated");
    context.warningEmitter = dispatcher.emitterOf("reveal-intended");
    showDialog = dialogHandler(context.dialogEmitter);
    context.warn = warningHandler(context.warningEmitter.target);
    context.puzzleReq = 3;

    async function verifyGameEnd(ctx) {
        const wordLetters = getWords(ctx.word).join("").length;
        const found = Object.values(ctx.lettersFound).reduce((a, v) => a + v, 0);
        if (ctx.hearts < 1) {
            setTimeout(async function () {
                showDialog(eventData("lost", ctx));
                await setHearts(minHearts);
            }, 2000);
        }
        if (wordLetters === found) {
            let res = await board.handleItemFound(ctx);
            await updateHearts((heart) => heart + res.points)
            context.progress = res.progress;
        //TODO: handle badge earned in the notification payload
            setTimeout(() => showDialog(eventData("won", context)), 2000);
        }
    }
    function handleRevealVisibility() {
        const {headerEmitter, hearts, level} = context;
        const deductor = board.getDeduction(level);
        const payload = {item: {disable: "nil"}, letter: {disable: "nil"}};
        let tmp;
        if (hearts < deductor.letter) {
            payload.letter.disable = true;
        }
        if (hearts < deductor.item) {
            payload.item.disable = true;
            tmp = utils.dict.answer_reveal_insufficient[context.lang].replace(
                "{x}",
                deductor.item
            );
            payload.item.answerTooltip = tmp;
        }
        headerEmitter.dispatch("bonus-updated", payload.letter);
        headerEmitter.dispatch("reveal-updated", payload.item);
    }
    async function updateHearts(updater) {
        let hearts = updater(context.hearts ?? minHearts);
        await setHearts(hearts);
        context.hearts = hearts;
        context.headerEmitter.dispatch("heart-updated", {hearts});
    }
    function warningHandler(element) {
        const {store} = context;
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
    async function initialize(gameData, replay=false) {
        let data;
        if (gameData) {
            data = gameData;
        } else {
            data = await getGameData(context.store, replay);
        }
        context.lettersFound = Object.create(null);
        Object.assign(context, data);
        context.hearts = Math.max(minHearts, context.hearts);
        context.headerEmitter.dispatch("title-updated", {
            level: data.level,
            title: data.category,
            titleClass: "nil"
        });
        context.headerEmitter.dispatch("heart-updated", {hearts: data.hearts});
        context.letterEmitter.target.textContent = "";
        context.letterEmitter.target.insertAdjacentHTML(
            "beforeend",
            utils.createDOMSentence(context.word).join("")
        );
        handleRevealVisibility();
        rootElement.querySelectorAll(
            ".responsive-grid button[data-type='letter'][aria-disabled]"
        ).forEach((elt) => disableButton(elt, false));
    }

    function listenKeyboard(evt) {
        let isLetter = (evt.key.match(/[a-z]/i) || evt.code.match(/key[a-z]/i));
        let btn;
        if (!isLetter) {
            return;
        }
        btn = rootElement.querySelector(
            `[aria-keyshortcuts="${evt.key} Shift+${evt.key}" i]`
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
        let tmp;
        const {target} = event;
        const {tooltip} = target.dataset;
        const deductor = board.getDeduction(context.level);
        const reveal = {data: [], deduction: deductor.guess};
        event.preventDefault();
        if (!shouldListen(target, deductor, context.hearts)) {
            return;
        }
        if (tooltip === "letter-reveal-tooltip") {
            tmp = await context.warn("letter-reveal");
            if (!tmp) {
                return;
            }
            reveal.data.push(utils.getRandomLetter(
                context.word,
                Object.keys(context.lettersFound)
            ));
            reveal.deduction = deductor.letter;
        }  else if (tooltip === "answer-reveal-tooltip") {
            tmp = await context.warn("answer-reveal");
            if (!tmp) {
                return;
            }
            reveal.deduction = deductor.item;
            tmp = utils.dict.answer_reveal_warning[context.lang];
            context.warningEmitter.dispatch("answer-reveal-intended", {
                points: `-${deductor.item}`,
                desc: tmp.replace("{x}", deductor.item)
            });
            reveal.data = utils.getAllLetters(
                context.word,
                Object.keys(context.lettersFound)
            );
        } else {
            tmp = utils.getIndexes(
                utils.getWords(context.word ?? "").join(""),
                target.textContent.trim()
            );
            if (tmp.length > 0) {
                reveal.data.push({
                    letter: target.textContent.trim(),
                    indexes: tmp
                });
            }
            disableButton(target);
        }
        if (reveal.data.length < 1) {
            await updateHearts((heart) => heart - reveal.deduction);
        } else {
            reveal.data.forEach(function (val) {
                context.lettersFound[val.letter] = val.indexes;
                val.indexes.forEach((index) => context.letterEmitter.dispatch(
                    "letter" + (index + 1) + "-changed",
                    {dimmed: "nil", letter: val.letter}
                ));
                disableButton(rootElement.querySelector(
                    "button[data-tooltip='" + val.letter + "' i]"
                ));
            });
        }
        handleRevealVisibility();
        target.blur();
        verifyGameEnd(context);
    }

    self.init = initialize;
    rootElement.addEventListener("click", listenLetterClick);
    rootElement.addEventListener("keydown", listenKeyboard);
    utils.trapFocus(context.dialogEmitter.target);

    document.querySelector(
        "button[aria-controls='menu-dialog']"
    ).addEventListener("click", function (event) {
        event.preventDefault();
        showDialog(eventData("paused", context));
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
