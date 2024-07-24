import utils from "./utils.js";

const dispatcher = new utils.EventDispatcher();
dispatcher.dispatch("heading-change", {
    titleClass: null,
    title: new URL(document.URL).hash.replace(/(?:%20|#)/gi, " ").trim(),
    hearts: 8,
    percentage: "100%"
});
