/*jslint browser*/
/*global self*/
import {openDB} from "./assets/scripts/idb-min.js";

const {Headers, Response, caches, clients, console} = self;
const config = {
    isOnline: true,
    version: 1
};
const cachableUrls = {
    pages: {
        "/": "/index.html",
        "/categories": "/categories/index.html",
        "/play": "/play/index.html",
        "/rules": "/rules/index.html"
    },
    static: [
        "/assets/mouse-memoirs.regular.woff2",
        "/assets/images/sprites.svg",
        "/assets/scripts/utils.js",
        "/assets/scripts/game.js",
        "/assets/scripts/id-min.js",
        "/sw-registration.js"
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
        let tx = db.transaction(storeName, "readwrite");
        let actions = questions.map((elt) => tx.store.put(encryptEntry(elt)));
        actions[actions.length] = tx.done;
        await Promise.all(actions);
    };
    result.getStores = () => stores;
    result.getRandomQuestion = async function (category) {
        let tx;
        let actions = [];
        let questions = await db.getAllFromIndex(category, "status");
        let res = questions.find((el) => el.status === "not-selected");
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
        } else {
            await db.put(category, clone(res, {status: "selected"}));
        }
        return decryptEntry(res).name;
    };
    return result;
}
async function fetchQuestions({url}) {
    let result = [];
    const datas = await fetchData({timeout: 2000, url});

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


async function onInstall() {
    await cacheStaticFiles();
    await setupQuestions();
    await sendMessage({statusUpdateRequest: true});
    self.skipWaiting();
}
function onActivate(event) {
    event.waitUntil(handleActivation);
}
function onFetch(event) {
    event.respondWith(handleFetch(event));
}
async function handleActivation() {
    await clearOldCache();
    await self.clients.claim();
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
        }
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
    oldCacheNames = oldCacheNames.map(function (cacheName) {
        let version = cacheName.match(/^hangman-(\d+)$/i) ?? [];
        version = Number.parseInt(version[1], 10);
        return (
            Number.isFinite(version) &&
            version > 0 &&
            version !== config.version
        );
    });
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
    if(data.randomWordRequest && ports[0]) {
        response = await getWord(data.randomWordRequest.category);
        ports[0].postMessage({randomWordResponse: response});
    }
}

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("fetch", onFetch);
