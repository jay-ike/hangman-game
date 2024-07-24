import utils from "./utils.js";

const dispatcher = new utils.EventDispatcher();
const container = dispatcher.emitterOf("letter-found");
container.textContent = "";
dispatcher.dispatch("heading-change", {
    titleClass: "nil",
    title: new URL(document.URL).hash.replace(/(?:%20|#)/gi, " ").trim(),
    hearts: 8,
    percentage: "100%"
});

container.insertAdjacentHTML(
    "beforeend",
    utils.createDOMSentence("omari hardwick").join("")
);
window.fakeDispatcher = dispatcher;
