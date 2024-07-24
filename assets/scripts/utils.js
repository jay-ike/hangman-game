/*jslint browser, this*/
const {Element} = window;

function getListeners(target) {
    if (!Element.prototype.isPrototypeOf(target)) {
        return [];
    }
    return Array.from(
        target.querySelectorAll("[data-listen]:not([data-emit] [data-emit] *)")
    );
}
function updateContent(element, data) {
    const {property} = element.dataset;
    element.textContent = data[property];
}
function updateAttributes(element, data) {
    let entries;
    const {attributes} = element.dataset;
    if (attributes !== undefined) {
        entries = attributes.split(",").map((val) => val.split(":"));
        entries.forEach(function ([attr, value]) {
            if (data[value] === null) {
                element.removeAttribute(attr);
            }
            if (data[value] !== undefined && data[value] !== null) {
                element.setAttribute(attr, data[value]);
            }
        });
        delete element.dataset.attributes;
    }
}
function parseElement(element) {
    const {attributes, property} = element.dataset;
    const chain = [];
    if (attributes !== undefined) {
        chain[chain.length] = (data) => updateAttributes(element, data);
    }
    if (property !== undefined) {
        chain[chain.length] = (data) => updateContent(element, data);
    }
    return (data) => chain.forEach((fn) => fn(data));
}
function contentDispatcher(target) {
    let mutation;
    let listeners = getListeners(target).map(parseElement);
    function listenDOMUpdate(records, observer) {
        records.forEach(function (record) {
            if (record.type === "childList") {
                listeners = getListeners(observer).map(parseElement);
            }
        });
    }
    mutation = new MutationObserver(listenDOMUpdate);
    mutation.observe(target, {childList: true, subtree: true});
    return Object.freeze({
        emit(data) {
            listeners.forEach((fn) => fn(data));
        },
        removeObserver() {
            mutation.disconnect();
        },
        target
    });
}
function EventDispatcher() {
    const self = Object.create(this);
    let emitters = Array.from(document.querySelectorAll("[data-emit]")).reduce(
        function (acc, emitter) {
            acc[emitter.dataset.emit] = contentDispatcher(emitter);
            return acc;
        },
        Object.create(null)
    );
    self.dispatch = function (event, data) {
        if (typeof emitters[event]?.emit === "function") {
            emitters[event].emit(data);
        }
    };
    self.emitterOf = function (eventName) {
        return emitters[eventName]?.target;
    };
    self.unregister = function (eventName) {
        if (typeof emitters[eventName]?.removeObserver === "function") {
            emitters[eventName].removeObserver();
            delete emitters[eventName];
        }
    };

    return self;
}
export default Object.freeze({
    EventDispatcher
});
