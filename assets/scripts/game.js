import utils from "./utils.js";

const dispatcher = new utils.EventDispatcher();
const emitters = {
    header: dispatcher.emitterOf("heading-change"),
    letters: dispatcher.emitterOf("letter-found")
}
const word = "omari hardwick";
emitters.letters.target.textContent = "";
emitters.header.dispatch("title-updated", {
    titleClass: "nil",
    title: new URL(document.URL).hash.replace(/(?:%20|#)/gi, " ").trim()
});
emitters.letters.target.insertAdjacentHTML(
    "beforeend",
    utils.createDOMSentence(word).join("")
);

document.body.addEventListener("click", function (event) {
    const {target} = event;
    let indexes;
    let letter;
    if (
        HTMLButtonElement.prototype.isPrototypeOf(target) &&
        target.classList.contains("letter")
    ) {
        letter = target.textContent.trim();
        indexes = utils.getIndexes(utils.getWords(word).join(""), letter);
        indexes.forEach((index) => emitters.letters.dispatch(
            "letter" + (index + 1) + "-changed",
            {dimmed: "nil", letter}
        ));
    }
});
