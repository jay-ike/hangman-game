/*jslint browser*/
/*global self, idb*/
importScripts("./assets/scripts/idb-min.js");

const {caches, clients, crypto} = self;
const config = {
    isOnline: true,
    version: 5
};
const cachableUrls = {
    pages: {
        "/": "/index.html",
        "/404": "/404.html",
        "/en": "/en/index.html",
        "/en/categories": "/en/categories/index.html",
        "/en/play": "/en/play/index.html",
        "/en/rules": "/en/rules/index.html",
        "/fr": "/fr/index.html",
        "/fr/categories": "/fr/categories/index.html",
        "/fr/play": "/fr/play/index.html",
        "/fr/rules": "/fr/rules/index.html"
    },
    static: [
        "/assets/mouse-memoirs.regular.woff2",
        "/assets/images/sprites.svg",
        "/assets/scripts/utils.js",
        "/assets/scripts/game.js",
        "/sw-registration.js",
        "/assets/scripts/idb-min.js",
        "/assets/images/favicon.ico",
        "assets/images/hangman-icon.png",
        "assets/data.json",
        "assets/lose-sound.wav",
        "assets/win-sound.wav",
        "assets/scripts/pwacompat.min.js"
    ]
};
config.cacheName = `hangman-${config.version}`;

async function consume(response, cached) {
    const result = {success: response.ok};
    let res = await response.json();
    if (cached) {
        result.cached = cached;
    }
    return Object.assign(result, res);
}
function getRandomIndex(length) {
    let array = new Uint8Array(length);
    let result;
    crypto.getRandomValues(array);
    result = array[Math.floor(Math.random() * length)];
    return result % length;
}
async function fetchData({options, timeout, url}) {
    const cache = await self.caches.open(config.cacheName);
    let controller = new AbortController();
    let response;
    let timeoutId;
    const defaultOptions = {
        headers: {"content-type": "application/json"},
        method: "GET",
        signal: controller.signal
    };
    if (Number.isFinite(timeout)) {
        timeoutId = setTimeout(() => controller.abort(), timeout);
    }
    try {
        response = await cache.match(url);
        if (response) {
            clearTimeout(timeoutId);
            return consume(response, true);
        }
        response = await fetch(
            url,
            Object.assign(defaultOptions, options ?? {})
        );
        await cache.put(url, response.clone());
        clearTimeout(timeoutId);
        return consume(response);
    } catch (error) {
        return Object.assign({success: false}, {message: error.message});
    }
}
function clone(object, data) {
    return Object.assign(structuredClone(object), data ?? {});
}
function createCrypto() {
    return Object.freeze({
        decrypt(data) {
            return self.atob(data).toString();
        },
        encrypt(data) {
            return self.btoa(data).toString();
        }
    });
}
async function questionStorage({
    dbName = "jay-ike_hangman",
    stores = [],
    version = config.version
}) {
    let result = Object.create(null);
    let cipher = createCrypto();
    const storeKeys = {
        indexes: ["status"],
        keyPath: "name"
    };
    const db = await idb.openDB(dbName, version, {
        upgrade: function upgrade(database, oldVersion) {
            let invalidStores = [];
            let objectStores;
            let i = 0;
            let store;
            objectStores = database.objectStoreNames;
            if (oldVersion >= 1 && stores.length > 0) {
                while (i < objectStores.length) {
                    store = objectStores.item(i);
                    if (!stores.includes(store)) {
                        invalidStores.push(objectStores.item(i));
                    }
                    i += 1;
                }
                invalidStores.forEach(
                    (name) => database.deleteObjectStore(name)
                );
            }
            stores.forEach(function (storeName) {
                let objectStore;
                if (objectStores.contains(storeName)) {
                    database.deleteObjectStore(storeName);
                }
                objectStore = database.createObjectStore(
                    storeName,
                    {keyPath: storeKeys.keyPath}
                );
                storeKeys.indexes.forEach(function (index) {
                    objectStore.createIndex(index, index, {unique: false});
                });
            });
        }
    });
    function encryptEntry(entry) {
        let res = clone(entry);
        res.name = cipher.encrypt(res.name);
        return res;
    }
    function decryptEntry(entry) {
        let res = clone(entry);
        res.name = cipher.decrypt(res.name);
        return res;
    }
    result.addMany = async function insertMany(storeName, questions) {
        const encrypted = questions.map(encryptEntry);
        let tx = db.transaction(storeName, "readwrite");
        let actions = encrypted.map(async function insertionHandler(entry) {
            let existing = await tx.store.get(entry.name);
            if (!existing) {
                return tx.store.add(entry);
            }
        });
        actions[actions.length] = tx.done;
        await Promise.all(actions);
    };
    result.getStores = function () {
        let i = 0;
        let objectStores = db.objectStoreNames;
        let res = [];
        while (i < objectStores.length) {
            res.push(objectStores.item(i));
            i += 1;
        }
        return res;
    };
    result.getRandomQuestion = async function (category) {
        let tx;
        let res;
        let actions = [];
        let questions;
        if (!db.objectStoreNames.contains(category)) {
            return;
        }
        questions = await db.getAllFromIndex(category, "status");
        questions = questions.filter((el) => el.status === "not-selected");
        res = questions[getRandomIndex(questions.length)];
        if (res === undefined) {
            tx = db.transaction(category, "readwrite");
            actions = await tx.store.getAll();
            res = await tx.store.openCursor();
            actions.map((value) => tx.store.put(
                clone(value, {status: "not-selected"})
            ));
            actions[actions.length] = tx.done;
            await Promise.all(actions);
            res = res.value;
        }
        return decryptEntry(res).name;
    };
    result.markFound = async function ({category, word}) {
        let res = await db.get(category, cipher.encrypt(word));
        if (res) {
            await db.put(category, {name: res.name, status: "selected"});
        }
    };
    return result;
}
async function fetchQuestions({url}) {
    let result = [];
    let datas = await fetchData({url});

    if (datas.success) {
        result = Object.entries(datas.categories).reduce(
            function (acc, [store, val]) {
                let tmp = {store};
                if (Array.isArray(val) && datas.cached === undefined) {
                    tmp.datas = val.map(function (question) {
                        const res = Object.assign({}, question);
                        res.status = (
                            res.selected
                            ? "selected"
                            : "not-selected"
                        );
                        delete res.selected;
                        return res;
                    });
                    acc[acc.length] = tmp;
                } else {
                    tmp.datas = [];
                }
                return acc;
            },
            []
        );
    }
    return result;
}


function onInstall(event) {
    event.waitUntil(handleInstallation());
    self.skipWaiting();
}
function onActivate(event) {
    event.waitUntil(handleActivation());
}
function onFetch(event) {
    event.respondWith(handleFetch(event));
}
async function handleActivation() {
    await clearOldCache();
    await sendMessage({statusUpdateRequest: true});
    await self.clients.claim();
}

async function handleInstallation() {
    await setupQuestions();
    await cacheStaticFiles();
}

async function cacheStaticFiles(reload = false) {
    const cache = await caches.open(config.cacheName);
    const options = {
        cache: "no-store",
        credetials: "omit",
        method: "GET"
    };
    return Promise.all(
        cachableUrls.static.concat(Object.values(cachableUrls.pages)).map(
            async function (url) {
                let res;
                try {
                    if (!reload) {
                        res = await cache.match(url);
                    }
                    if (res) {
                        return;
                    }
                    res = await fetch(cachableUrls.pages[url] ?? url, options);
                    if (res.ok) {
                        return cache.put(url, res);
                    }
                } catch (err) {
                    self.console.log("A Fetch error occured: ", err);
                }
            }
        )
    );
}
async function handleFetch(event) {
    const {request} = event;
    const cache = await caches.open(config.cacheName);
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/$/, "");
    let response;
    if (path.length === 0) {
        path = "/";
    }
    if (url.origin !== location.origin) {
        return fetch(request);
    }
    response = await cache.match(cachableUrls.pages[path] ?? path);
    if (response) {
        return response;
    } else {
        response = await fetch(request);
        if (response.ok) {
            event.waitUntil(
                cache.put(request.url, response.clone())
            );
        } else {
            return handle404({cache, event, response});
        }
        return response;
    }
}
async function handle404({cache, event, response}) {
    let res;
    if (
        event.request.method === "GET" &&
        (/text\/html/i).test(event.req.headers.get("accept"))
    ) {
        res = await cache.match("/404.html");
        if (res) {
            return res;
        }
        res = await fetch("/404.html");
        if (res.ok) {
            event.waitUntil(cache.put("/404.html", res));
        }
        return res;
    } else {
        return response;
    }

}
async function getWord(category) {
    let title = String(category ?? "");
    let word;

    if (title.trim().length === 0) {
        title = config.db.getStores();
        title = title[Math.floor(Math.random() * title.length)];
    }
    word = await config.db.getRandomQuestion(title);
    return {title, word};
}
async function clearOldCache() {
    let oldCacheNames = await caches.keys();
    oldCacheNames = oldCacheNames.filter(function (cacheName) {
        let version = cacheName.match(/^hangman-(\d+)$/i) ?? [];
        version = Number.parseInt(version[1], 10);
        return (
            Number.isFinite(version) &&
            version > 0 &&
            version !== config.version
        );
    }).map((name) => caches.delete(name));
    return Promise.all(oldCacheNames);
}
async function setupQuestions() {
    let questions = await fetchQuestions({url: "/assets/data.json"});
    config.db = await questionStorage({
        stores: questions.map((val) => val.store),
        version: config.version
    });
    await Promise.all(
        questions.map(function ({datas, store}) {
            return config.db.addMany(store, datas);
        })
    );
}
async function sendMessage(msg) {
    const allClients = await clients.matchAll({includeUncontrolled: true});
    return Promise.all(allClients.map(function (client) {
        const channel = new MessageChannel();
        channel.port1.onmessage = handleMessage;
        return client.postMessage(msg, [channel.port2]);
    }));
}
async function handleMessage({data, ports}) {
    let response;
    if (data.statusUpdate) {
        config.isOnline = data.statusUpdate.isOnline;
    }
    if (data.connectionRequest && ports[0]) {
        config.isOnline = data.connectionRequest.isOnline;
        ports[0].onmessage = handleMessage;
        config.db = await questionStorage({version: config.version});
        ports[0].postMessage({connectionAcknowledged: true});
    }
    if (data.randomWordRequest && ports[0]) {
        response = await getWord(data.randomWordRequest.category);
        ports[0].postMessage({randomWordResponse: response});
    }
    if (data.wordFound) {
        await config.db.markFound(data.wordFound);
    }
}
self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("fetch", onFetch);
self.addEventListener("message", handleMessage);
