/*jslint browser*/
const {navigator} = window;
let workerPort;
if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", {
        type: "module",
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
    notifyWorker({statusUpdate: {isOnline: true}});
});
window.addEventListener("offline", function () {
    notifyWorker({statusUpdate: {isOnline: false}});
});
