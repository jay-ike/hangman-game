/*jslint browser, this*/
import utils from "./utils.js";

const {DOMException, HTMLButtonElement, URL, document} = window;
const isButton = (target) => HTMLButtonElement.prototype.isPrototypeOf(target);
let engine;
function getGameData(url) {
    return {
        title: new URL(url).hash.replace(/(?:%20|#)/gi, " ").trim(),
        word: "omari hardwick"
    };
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
    function showDialog(title, status) {
        const {target, dispatch} = components.dialogEmitter;
        let text;
        if (status) {
            target.dataset.status = status
            text = "play again!";
        } else {
            delete target.dataset.status;
            text = "continue";
        }
        dispatch("title-changed", {title});
        dispatch("continuation-changed", {text});
        target.showPopover();
    }

    function verifyGameEnd({hearts, word, lettersFound}) {
        const wordLetters = utils.getWords(word).join("").length;
        if (hearts < 1) {
            showDialog("you lose", "lost");
        }
        if (wordLetters === lettersFound) {
            showDialog("you win", "won");
        }
    }
    function initialize() {
        const data = getGameData(document.URL);
        components.lettersFound = 0;
        components.word = data.word;
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
            if (status) {
                initialize();
            }
            parent.hidePopover();
        }
    }
    function listenLetterClick({target}) {
        let indexes;
        let letter;
        if (
            isButton(target) &&
            target.classList.contains("letter") &&
            target.getAttribute("aria-disabled") === null

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
    components.dialogEmitter.target.addEventListener(
        "click",
        ({target}) => listenRestartClick(
            components.dialogEmitter.target,
            target
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
window.addEventListener("DOMContentLoaded", function () {
    engine = new Engine(document.body, new utils.EventDispatcher());
    engine.init();
});
