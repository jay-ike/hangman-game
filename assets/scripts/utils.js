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
function getListeners(target, fn) {
    if (!Element.prototype.isPrototypeOf(target)) {
        return {};
    }
    if (typeof fn !== "function") {
        throw new Error("you should pass a callback function !!!");
    }
    return Array.from(
        target.querySelectorAll("[data-listen]:not([data-emit] [data-emit] *)")
    ).reduce(function (acc, element) {
        const {listen} = element.dataset;
        if (acc[listen] === undefined) {
            acc[listen] = [fn(element)];
        } else {
            acc[listen][acc[listen].length] = fn(element);
        }
        return acc;
    }, Object.create(null));
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
function getAllElements(nodeList) {
    return Array.from(nodeList).filter((node) => node.nodeType === 1);
}
function contentDispatcher(target) {
    let mutation;
    let listeners = getListeners(target, parseElement);
    function listenDOMUpdate(records) {
        records.forEach(function (record) {
            const addedElts = getAllElements(record.addedNodes);
            const removedElts = getAllElements(record.removedNodes);
            if (
                record.type === "childList" &&
                (addedElts.length > 0 || removedElts.length > 0)
            ) {
                listeners = getListeners(target, parseElement);
            }
        });
    }
    mutation = new MutationObserver(listenDOMUpdate);
    mutation.observe(target, {childList: true, subtree: true});
    return Object.freeze({
        emit(event, data) {
            if (Array.isArray(listeners[event])) {
                listeners[event].forEach((fn) => fn(data));
            }
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
    self.emitterOf = function (eventName) {
        return Object.freeze({
            dispatch(event, data) {
                if (typeof emitters[eventName]?.emit === "function") {
                    emitters[eventName].emit(event, data);
                }
            },
            target: emitters[eventName]?.target
        });
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
function getIndexes(word, letter) {
    if (typeof word !== "string" || typeof letter !== "string") {
        return [];
    }
    return Array.from(word.matchAll(new RegExp(letter, "gi"))).map(
        (match) => match.index
    );

}
function letterTemplate(index) {
    return "<span class='center letter box-blue shadowed' data-listen=" +
    "'letter" + (index + 1) + "-changed' data-attributes=" +
    "'data-dimmed:{dimmed}' data-property='{letter}' data-dimmed></span>";

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
            return letterTemplate(i);
        }).join("");
        currentIndex += word.length;
        markup += "</div>";
        return markup;
    });
    return list;
}
function getFocusableChildren(element) {
    return element.querySelectorAll(
        ":is(a:any-link, button, input[type='checkbox'], " +
        "input[type='radio'], input[type='text'], input[type='password'], " +
        "input[type='email'], textarea, select):not([disabled])"
    );

}
function trapFocus(element) {
    const focusables = getFocusableChildren(element);
    const firstFocusable = focusables[0];
    const lastFocusable = focusables[focusables.length - 1];

    element.addEventListener("keydown", function (event) {
        let tabbed = (event.key === "Tab" || event.keyCode === 9);
        if (!tabbed) {
            return;
        }
        if (event.shiftKey) {
            if (document.activeElement === firstFocusable) {
                lastFocusable.focus();
                event.preventDefault();
            }
        } else {
            if (document.activeElement === lastFocusable) {
                firstFocusable.focus();
                event.preventDefault();
            }
        }
    });
}
function getFallBack(lang) {
    const fallback = {
        en: {title: "Countries", word: "Azerbaijan"},
        fr: {title: "Pays", word: "Bangladesh"}
    };
    return fallback[lang];
}
export default Object.freeze({
    EventDispatcher,
    createDOMSentence,
    getFallBack,
    getFocusableChildren,
    getIndexes,
    getWords,
    trapFocus
});
