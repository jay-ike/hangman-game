/*jslint browser*/
const {navigator} = window;
let workerPort;
let refreshed;
if (navigator.serviceWorker) {
    navigator.serviceWorker.register("/sw.js", {scope: "/"});
    navigator.serviceWorker.addEventListener("message", handleMessage);
    navigator.serviceWorker.startMessages();
    navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (!refreshed) {
            window.location.reload(true);
            refreshed = true;
        }
    });
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
