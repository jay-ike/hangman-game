/*jslint browser, this*/
import utils from "./utils.js";

const {DOMException, HTMLButtonElement, URL, document} = window;
let engine;
function getGameData(url) {
    return {
        title: new URL(url).hash.replace(/(?:%20|#)/gi, " ").trim(),
        word: "omari hardwick"
    };
}

function Engine(rootElement, dispatcher, maxHearts = 8) {
    const self = Object.create(this);
    const components = Object.create(null);

    if (typeof dispatcher?.emitterOf !== "function") {
        throw new DOMException(
            "the dispatcher should implement the emitterOf function !!!"
        );
    }
    components.letterEmitter = dispatcher.emitterOf("letter-found");
    components.headerEmitter = dispatcher.emitterOf("heading-change");

    function verifyGameEnd(hearts, word, lettersFound) {
        if (hearts < 1) {
        }
        if (word.length === lettersFound) {
        }
    }

    function listenLetterClick({target}) {
        let indexes;
        let letter;
        if (
            HTMLButtonElement.prototype.isPrototypeOf(target) &&
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
        }
    }
    rootElement.addEventListener("click", listenLetterClick);

    self.init = function initialize() {
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
    };

    return self;
}
window.addEventListener("DOMContentLoaded", function () {
    engine = new Engine(document.body, new utils.EventDispatcher());
    engine.init();
});
