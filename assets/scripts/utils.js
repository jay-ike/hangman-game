/*jslint browser, this*/
/** @import {ApiHandlerInstance, GameData} from './types.js' */
const {Element} = window;
const syntax = /\{([^{}:\s]+)\}/g;
const isButton = (t) => window.HTMLButtonElement.prototype.isPrototypeOf(t);
const dateOpts = {day: "numeric", month: "short", year: "numeric"};
const dict = {
    answer_reveal_warning: {
        en: "You'll lose {x} points and won't earn any for this answer, but it will still count toward your progress",
        fr: "Tu vas perdre {x} points. Cette réponse ne te rapportera pas de points, mais elle compte pour ta progression."
    },
    answer_reveal_insufficient: {
        en: "Need 50 hearts to reveal the answer. Keep guessing!",
        fr: "Besoin de 50 points de vie pour révéler. Continue !"
    },
    earned: {en: "Earned {x} time{y}", fr: "Obtenu {x} fois"},
    level: {en: "Level", fr: "Niveau"},
    level_up_title: {
        en: "You unlocked level {x} of category {y}",
        fr: "Niveau {x} débloqué en {y}."
    },
    level_up_desc: {
        en: "You've uncovered {x} of {y} answers. {z} more to master level {a}",
        fr: "Tu as deviné {x} réponses sur {y}. Encore {z} pour maîtriser le niveau {a}"
    },
    locked: {
        en: "Guess 3 answers in Level {x} to unlock",
        fr: "Devine 3 réponses dans le niveau {x} pour le débloquer."
    },
    mastered: {
        en: "You've guessed every answers in {x}",
        fr: "Toutes les réponses devinées en {x}"
    },
    not_earned: {
        en: "Not earned yet",
        fr: "Pas encore obtenu"
    },
    perfect: {
        en: "You've guessed every answer perfectly!",
        fr: "Toutes les réponses ont été devinées à la perfection !"
    },
    progress_level_desc: {
        en: "You've guessed {x} of {y} answers. {z} more to unlock the next level !",
        fr: "Tu as deviné {x} réponses sur {y}. Encore {z} pour débloquer le prochain niveau !"
    },
    unlocked: {
        en: "You've guessed {x} of {y} answers - keep it up!",
        fr: "Tu as deviné {x} réponse{z} sur {y} — continue comme ça !"
    }
};

function formatDate(date, lang, options = dateOpts) {
    return new Intl.DateTimeFormat(lang, options).format(date);
}

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
        target.querySelectorAll("[data-listen]:not(:scope[data-emit] [data-emit] *)")
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
function getRandomLetter(sentence, foundLetters) {
    const word = getWords(sentence).join("").toLowerCase();
    let availableLetters;
    let result;
    if (!Array.isArray(foundLetters)) {
        throw new Error("the foundLetters should be an array");
    }
    availableLetters = word.split("").reduce(function (acc, letter) {
        if (foundLetters.includes(letter)) {
            return acc;
        }
        if (acc[letter]) {
            acc[letter] += 1;
        } else {
            acc[letter] = 1;
        }
        return acc;
    }, Object.create(null));
    result = Object.entries(availableLetters).sort((a, b) => a[1] - b[1])[0];
    result[1] = getIndexes(word, result[0]);
    return result;
}
function letterTemplate(index) {
    return "<span class='center shadowed btn' data-type='letter' data-listen=" +
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
function jsonStorage() {
    const cipher = createCrypto();
    const store = window.localStorage;
    return Object.freeze({
        emptyStore() {
            store.clear();
        },
        getValue(entry, key) {
            let value;
            if (typeof key !== "string" || typeof entry !== "string") {
                throw new Error("the key and the entry should be strings.");
            }
            value = store.getItem(entry);
            try {
                value = JSON.parse(value ?? "");
                value = cipher.decrypt(value[cipher.encrypt(key)]);
            } catch (ignore) {
                value = null;
            }
            return value;
        },
        onChange(entry, fn) {
            window.addEventListener("storage", function (event) {
                if (entry === event.key) {
                    fn(event);
                }
            });
        },
        removeEntry(entry) {
            store.removeItem(entry);
        },
        setValue(entry, key, value) {
            let stored;
            if (typeof key !== "string" || typeof entry !== "string") {
                throw new Error("the key and the entry should be strings.");
            }
            stored = store.getItem(entry);
            try {
                stored = JSON.parse(stored ?? "");
            } catch (ignore) {
                stored = {};
            }
            stored[cipher.encrypt(key)] = cipher.encrypt(value);
            store.setItem(entry, JSON.stringify(stored));
        },
        supported: () => typeof window.Storage === "function"
    });
}

/**
* Utility for handling API calls
* @constructor
* @returns {ApiHandlerInstance}
*/
function ApiHandler() {
    const defaultHeaders = {"Content-Type": "application/json"};
    const headers = {
        get: {headers: defaultHeaders, method: "GET"},
        post: function (body) {
            return {body, headers: defaultHeaders, method: "POST"};
        }
    };
    /** @type {ApiHandlerInstance} */
    const self = Object.create(null);
    async function get(path, fn) {
        const opts = {};
        let res = await fetch(path, headers.get);
        opts.ok = res.ok;
        res = await res.json();
        opts.data = typeof fn === "function" ? fn(res): res;
        return opts;
    }
    async function post(path, body, fn) {
        const opts = {};
        let res = await fetch(path, headers.post(body));
        opts.ok = res.ok;
        res = await res.json();
        opts.data = typeof fn === "function" ? fn(res): res;
        return opts;
    }
    self.getProgress = function (cat, level) {
        let url = `/api/progress?cat=${cat}`;
        if (level) {
            url += `&level=${level}`;
        }
        return get(url, (r) => r.result);
    }
    self.getBadges = (l) => get(`/api/badges?lang=${l}`, (r) => r.badges);
    self.getHearts = () => get(`/api/hearts`, (r) => r.hearts);
    self.markFound = (b) => post(`/api/found`, b, (r) => r.progress);
    self.addBadge = (b) => post(`/api/new-badge`, b, (r) => r.message);
    return Object.freeze(self);
}

function removeAccents(val) {
    const res = String(val).normalize("NFD").toLowerCase();
    return res.replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "-");
}

/**
* Utility for generating the event data based on the game status and data
* @param {string} status
* @param {GameData} data
*/
function eventData(status, data) {
        let res = {action: "replay", status};
        const {category, lang, level: lev, progress: p, puzzleReq} = data;
        let tmp = {y: puzzleReq, z: puzzleReq - p.uncovered};
        res.levStyle = `view-transition-name: level${lev};`;
        res.levelLink = `/${lang}/levels#${encodeURIComponent(category)}`;
        res.levLabel = "paused";
        res.catStyle = `view-transition-name: ${removeAccents(category)};`;
        res.catLabel = "paused";
        if (p.uncovered >= puzzleReq) {
            tmp.y = p.totalWords;
            tmp.z = p.totalWords - p.uncovered;
            tmp.desc = dict.level_up_desc[lang].replace(
                "{x}",
                p.uncovered
            ).replace("{y}", tmp.y).replace("{z}", tmp.z).replace("{a}", lev+1);
        } else {
            tmp.desc = dict.progress_level_desc[lang].replace(
                "{x}",
                p.uncovered
            ).replace("{y}", tmp.y).replace("{z}", tmp.z);
        }
        res.description = tmp.desc;
        res.progress = Array.from({length: puzzleReq}, (_, i) => i).reduce(
            function (acc, v) {
                if (p.uncovered > v) {
                    acc[`level${v+1}`] = "";
                }
                return acc;
            },
            Object.create(null)
        );
        if (status === "lost") {
            res.levTheme = "secondary";
            res.levLabel = "lost";
            res.contentLabel = "lost";
        }
        if (status === "won") {
            res.starLabel = "won";
            res.titleLabel = "lost";
        }
        if (status === "won" && puzzleReq === p.uncovered) {
            res.status = "level-up";
            res.titleLabel = "level-up";
            res.levLabel = "level-up";
            res.levTheme = "secondary";
            res.contentTitle = dict.level_up_title[lang].replace(
                "{x}",
                lev + 1
            ).replace("{y}", category);
        }
        if (status === "won" && p.uncovered >= p.totalWords) {
            res.status = "perfect";
            res.catLabel = "perfect";
            res.catTheme = "nil";
            res.description = dict.mastered[lang].replace("{x}", category);
        }
        if (status ==="paused") {
            res.action = "continue";
            res.contentLabel = "won";
        } else {
            res.contentLabel = res.status;
        }
        return res;
}

export default Object.freeze({
    ApiHandler,
    EventDispatcher,
    createDOMSentence,
    dict,
    formatDate,
    eventData,
    getFallBack,
    getFocusableChildren,
    getIndexes,
    getRandomLetter,
    getWords,
    isButton,
    jsonStorage,
    removeAccents,
    trapFocus
});
