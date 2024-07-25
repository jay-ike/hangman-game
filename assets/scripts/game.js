import utils from "./utils.js";

const dispatcher = new utils.EventDispatcher();
const emiter = dispatcher.emitterOf("letter-found");
const word = "omari hardwick";
emiter.target.textContent = "";
dispatcher.emitterOf("heading-change").dispatch("title-updated", {
    titleClass: "nil",
    title: new URL(document.URL).hash.replace(/(?:%20|#)/gi, " ").trim()
});
emiter.target.insertAdjacentHTML(
    "beforeend",
    utils.createDOMSentence(word).join("")
);
window.fakeDispatcher = emiter;
