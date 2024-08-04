/*jslint browser*/
const {navigator} = window;
let workerPort;
if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "imports"
    });
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.startMessages();
}
function notifyWorker(data) {
    if (typeof workerPort.postMessage === "function") {
        workerPort.postMessage(data);
    }
}
function handleMessage({data, ports}) {
    if (data.statusUpdateRequest) {
        workerPort = ports[0];
        notifyWorker({statusUpdate: {isOnline: navigator.onLine}});
    }
}
window.addEventListener("online", function () {
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            statusUpdate: {isOnline: true}
        });
    }
});
window.addEventListener("offline", function () {
     if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            statusUpdate: {isOnline: false}
        });
    }

});
