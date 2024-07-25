/*jslint browser, this*/
import {openDB} from "./idb-min.js";

const {Element, structuredClone} = window;
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
function contentDispatcher(target) {
    let mutation;
    let listeners = getListeners(target, parseElement);
    function listenDOMUpdate(records) {
        records.forEach(function (record) {
            if (record.type === "childList") {
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

function clone(object, data) {
    return Object.assign(structuredClone(object), data ?? {});
}
function createCrypto() {
    return Object.freeze({
        decrypt(data) {
            return window.atob(data).toString();
        },
        encrypt(data) {
            return window.btoa(data).toString();
        }
    });
}

async function questionStorage(dbName = "jay-ike_hangman", stores = [], version = 1) {
    let result = Object.create(null);
    let cipher = createCrypto();
    const db = await openDB(dbName, version, {
        upgrade: function upgrade(db) {
            stores.forEach(function (storeName) {
                const store = db.createObjectStore(
                    storeName,
                    {keyPath: "name"}
                );
                store.createIndex("status", "status", {unique: false});
            });
        }
    });
    function encryptEntry(entry) {
        let result = clone(entry);
        result.name = cipher.encrypt(result.name);
        return result;
    }
    function decryptEntry(entry) {
        let result = clone(entry);
        result.name = cipher.decrypt(result.name);
        return result;
    }
    result.addMany = async function insertMany(storeName, questions) {
        let tx = db.transaction(storeName, "readwrite");
        let actions = questions.map((elt) => tx.store.put(encryptEntry(elt)));
        actions[actions.length] = tx.done;
        await Promise.all(actions);
    };
    result.getRandomQuestion = async function (category) {
        let tx;
        let actions = [];
        let questions = await db.getAllFromIndex(category, "status");
        let result = questions.find((el) => el.status === "not-selected");
        if (result === undefined) {
            tx = db.transaction(category, "readwrite");
            actions = await tx.store.getAll();
            result = await tx.store.openCursor();
            actions.map((value) => tx.store.put(
                clone(value, {status: "not-selected"})
            ));
            actions[actions.length] = tx.done;
            await Promise.all(actions);
            result = result.value;
        } else {
            await db.put(category, clone(result, {status: "selected"}));
        }
        return decryptEntry(result).name;
    };
    return result;
}
export default Object.freeze({
    EventDispatcher,
    createDOMSentence,
    questionStorage,
    getIndexes,
    getWords
});
