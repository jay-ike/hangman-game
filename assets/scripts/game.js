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
    navigator.serviceWorker.onmessage = handleMessage;
}
function notifyWorker(data) {
    if (typeof workerPort.postMessage === "function") {
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
function focusHandler(popover) {
    let active;
    popover.addEventListener("beforetoggle", function (event) {
        if (event.oldState === "closed") {
            active = document.activeElement;
            utils.getFocusableChildren(popover)[0].focus();
        }
        if (event.oldState === "open") {
            active.focus();
        }
    });
}

function Engine(rootElement, dispatcher, maxHearts = 8) {
    const self = Object.create(this);
    const components = Object.create(null);

    if (typeof dispatcher?.emitterOf !== "function") {
        throw new DOMException(
            "the dispatcher should implement the emitterOf function !!!"
        );
    }
    function showDialog(status) {
        const {dispatch, target} = components.dialogEmitter;
        const allowedStatus = ["won", "lost", "paused"];
        let data = {};
        if (!allowedStatus.includes(status)) {
            return;
        }
        target.dataset.status = status;
        if (status === "paused") {
            data.action = "continue";
        } else {
            data.action = "replay";
        }
        dispatch("title-changed", data);
        target.showPopover();
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
    async function initialize() {
        const data = await getGameData(document.URL);
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

    function listenRestartClick(parent, target) {
        let status = parent?.dataset?.status;
        if (typeof parent.hidePopover !== "function") {
            throw new DOMException(
                "The parent should implement the Popover API !!!"
            );
        }
        if (
            isButton(target) &&
            target.classList.contains("continue-btn")
        ) {
            if (typeof status === "string" && status !== "paused") {
                wakeUpWorker();
            }
            parent.hidePopover();
        }
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
    components.letterEmitter = dispatcher.emitterOf("letter-found");
    components.headerEmitter = dispatcher.emitterOf("heading-change");
    components.dialogEmitter = dispatcher.emitterOf("dialog-updated");
    rootElement.addEventListener("click", listenLetterClick);
    rootElement.addEventListener("keydown", listenKeyboard);
    components.dialogEmitter.target.addEventListener(
        "click",
        (event) => listenRestartClick(
            components.dialogEmitter.target,
            event.target
        )
    );
    utils.trapFocus(components.dialogEmitter.target);
    focusHandler(components.dialogEmitter.target);
    document.querySelector(
        "button[aria-controls='menu-dialog']"
    ).addEventListener("click", function (event) {
        event.preventDefault();
        showDialog("paused");
    });
    return self;
}
function wakeUpWorker() {
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
        engine.init();
    }
    wakeUpWorker();
});
