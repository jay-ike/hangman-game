/*jslint browser*/
const {navigator} = window;

if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", {
        type: "module",
        updateViaCache: "imports"
    });
}
