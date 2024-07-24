/*jslint browser, this*/
const {Element} = window;
const syntax = /\{([^{}:\s]+)\}/g;
function parsedTemplate(data, string) {
    let result = string.replace(
        syntax,
        function replacer(original, path) {
            let value;
            try {
               value = path.split(".").reduce(
                   (acc, val) => acc[val] ?? original,
                   data
               );
            return (
                typeof value === "function"
                ? value(data)
                : value
            );

            } catch (ignore) {
                return original;
            }
        }
    );
    return (
        result === string
        ? undefined
        : result
    );
}
function getListeners(target) {
    if (!Element.prototype.isPrototypeOf(target)) {
        return [];
    }
    return Array.from(
        target.querySelectorAll("[data-listen]:not([data-emit] [data-emit] *)")
    );
}
function updateContent(element) {
    const {property} = element.dataset;
    return function (data) {
        element.textContent = parsedTemplate(data, property);
    };
}
function updateAttributes(element) {
    let entries;
    const {attributes} = element.dataset;
    if (attributes !== undefined) {
        entries = attributes.split(",").map((val) => val.split(":"));
        entries = entries.map(function ([attr, value]) {
            return function attributeUpdater(elt, data) {
                const wrongCase = ["nil", undefined];
                const attributeValue = parsedTemplate(data, value);
                if (attributeValue === "nil") {
                    elt.removeAttribute(attr);
                }
                if (!wrongCase.includes(attributeValue)) {
                    elt.setAttribute(attr, attributeValue);
                }
            };
        });
        return (data) => entries.forEach((fn) => fn(element, data));
    }
}
function parseElement(element) {
    const {attributes, property} = element.dataset;
    const chain = [];
    if (attributes !== undefined) {
        chain[chain.length] = updateAttributes(element);
    }
    if (property !== undefined) {
        chain[chain.length] = updateContent(element);
    }
    return (data) => chain.forEach((fn) => fn(data));
}
function contentDispatcher(target) {
    let mutation;
    let listeners = getListeners(target).map(parseElement);
    function listenDOMUpdate(records) {
        records.forEach(function (record) {
            if (record.type === "childList") {
                listeners = getListeners(target).map(parseElement);
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
function getWords(sentence) {
    return sentence.split(" ").map((word) => word.trim());
}
function createDOMSentence(sentence) {
    let list;
    let currentIndex = 0;
    if (typeof sentence !== "string") {
        return [];
    }
    list = getWords(sentence).map(function (word) {
        let markup = "<div class='i-flex'>";
        markup += word.split("").map(function (ignore, index) {
            let i = currentIndex + index;
            return "<span class='center letter box-blue shadowed' " +
            `data-listen data-dimmed data-attributes='data-dimmed:{${i}.dimmed}' ` +
            `data-property="{${i}.letter}"></span>`;
        }).join("");
        currentIndex += word.length;
        markup += "</div>";
        return markup;
    });
    return list;
}
export default Object.freeze({
    EventDispatcher,
    createDOMSentence,
    getWords
});
