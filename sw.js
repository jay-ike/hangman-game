/*jslint browser*/
/*global self, idb*/
importScripts("./assets/scripts/idb-min.js");

/**
* A Progres Indicator
* @typedef {Object} Progress
* @property {string} store
* @property {number} level
* @property {number} totalWords
* @property {number} uncovered
*/
/**
 * An item with a name.
 * @typedef {Object} Item
 * @property {string} name
 */
/**
 * A collection of items grouped under a dynamic sub‑key.
 * @typedef {Record<string, Item[]>} SubCategories
 */
/**
 * A data source from the API
 * @typedef {Object} Source
 * @property {Record<string, SubCategories>} categories
 */
/**
* @typedef {Object} QuestionData
* @property {string} name
* @property {number} level
* @property {"not-selected"|"selected"} status
*/
/**
* @typedef {Object} Question
* @property {string} store
* @property {QuestionData[]} datas
*/

const {caches, clients, crypto} = self;
const config = {isOnline: true, version: 9};
const cachableUrls = {
    pages: {
        // "/": "/index.html",
        // "/404": "/404.html",
        // "/en": "/en/index.html",
        // "/en/categories": "/en/categories/index.html",
        // "/en/play": "/en/play/index.html",
        // "/en/rules": "/en/rules/index.html",
        // "/fr": "/fr/index.html",
        // "/fr/categories": "/fr/categories/index.html",
        // "/fr/play": "/fr/play/index.html",
        // "/fr/rules": "/fr/rules/index.html"
    },
    static: [
        "/assets/mouse-memoirs.regular.woff2",
        "/assets/images/sprites.svg",
        "/sw-registration.js",
        "/assets/scripts/idb-min.js",
        "/assets/images/favicon.ico",
        "assets/images/hangman-icon.png",
        "assets/data.json",
        "assets/lose-sound.wav",
        "assets/win-sound.wav",
        "assets/scripts/pwacompat.min.js"
    ],
    updatable: [
        "/assets/scripts/utils.js",
        "/assets/scripts/game.js"
    ]
};
const headers = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
};
config.cacheName = `hangman-${config.version}`;

function chainMiddlewares(handler, middlewares = []) {
    let chain = [];
    function nextMiddleware(ev, ctx) {
        let firstMiddleware = chain.shift();
        if (typeof firstMiddleware === "function") {
            try {
                return firstMiddleware(ev, ctx, nextMiddleware);
            } catch (error) {
                return Promise.reject(error);
            }
        }
        return handler(ev, ctx);
    }
    return function (event, context, callback) {
        if (Array.isArray(middlewares)) {
            chain = middlewares.concat([]);
        }
        return nextMiddleware(event, context).then(
            (result) => callback(null, result)
        ).catch((err) => callback(err, null));
    };
}

function createResponse(status, body) {
    return new Response(JSON.stringify(body), {status, headers});
}

function alwaysResolve(resolve) {
    return function (err, res) {
        if (res) {
            resolve(res);
        } else {
            console.error(err);
            resolve(createResponse(500, {
                message: "Unexpected error while handling your request"
            }));
        }
    };
}

function createHandler(fn, middlewares) {
    return function (event, context) {
        return new Promise(function resolver(resolve) {
            chainMiddlewares( fn,
                middlewares
            )(event, context, alwaysResolve(resolve));
        });
    };
}

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

/**
* Utility for fetching data while handling cache
* @param {Object} param0
* @param {RequestInit} param0.options - The fetching options
* @param {number?} param0.timeout - The eventual fetch timeout
* @param {string|Request} param0.url - The url to fetch
* @returns {Promise<any>}
*/
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
        console.log("error occured");
        console.error(error);
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

/**
* Utility for computing the status for each progress
* @param {Progress[]} data
* @returns {Array<Progress & {status: string}>}
*/
function computeStatus(data) {
    const map = data.reduce(function (acc, progress) {
        if (!acc[progress.level]) {
            acc[progress.level] = progress;
        }
        return acc;
    }, Object.create(null));
    return Object.entries(map).map(function ([i, val]) {
        let status = "unlocked";
        if (i > 1 && map[i-1].uncovered < 3) {
            status = "locked"
        }
        if (i > 1 && map[i-1].uncovered >= 3) {
            status = "unlocked";
        }
        if (val.uncovered === val.totalWords && val.totalWords > 0) {
            status = "perfect";
        }
        return Object.assign(val, {status});
    });
}

/**
* Utility for managing the game storage
* @param {Object} param0
* @param {string} [param0.dbName="jay-ike_hangman"]
* @param {string[]} [param0.stores=[]]
* @param {number} [param0.version=config.version]
* @param {Progress[]} [param0.progress=[]]
*/
async function gameStorage({
    dbName = "jay-ike_hangman",
    progress = [],
    stores = [],
    version = config.version
}) {
    let result = Object.create(null);
    let cipher = createCrypto();
    const storeKeys = {indexes: ["status", "level"], keyPath: "name"};
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
            if (!objectStores.contains("progress")) {
                store = database.createObjectStore("progress", {
                    keyPath: ["store", "level"]
                });
                store.createIndex("category", "store");
            }
            if (!objectStores.contains("player")) {
                database.createObjectStore("player", {keyPath: "id"});
            }
            if (!objectStores.contains("achievements")) {
                store = database.createObjectStore("achievements", {
                    keyPath: "id",
                    autoIncrement: true
                });
                store.createIndex("playerId", "playerId", {unique: false});
                store.createIndex(
                    "playerAchievements",
                    ["playerId", "achievementId"],
                    {unique: false}
                );
            }
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
    async function initProgress() {
        let tx = db.transaction("progress", "readwrite");
        const actions = progress.map(async function progressHandler(e) {
            const exists = await tx.store.get([e.store, e.level]);
            if (!exists) {
                return tx.store.add(e);
            }
        });
        await Promise.all(actions.concat([tx.done]));
    }
    async function initPoints() {
        let tx = db.transaction("player", "readwrite");
        const actions = [];
        const exists = await tx.store.get("default");
        if (!exists) {
            actions.push(tx.store.add({id: "default", hearts: 9}));
        }
        await Promise.all(actions.concat([tx.done]));
    }
    result.addMany = async function insertMany(storeName, questions) {
        const encrypted = questions.map(encryptEntry);
        let tx = db.transaction(storeName, "readwrite");
        const actions = encrypted.map(async function insertionHandler(entry) {
            let existing = await tx.store.get(entry.name);
            if (!existing) {
                return tx.store.add(entry);
            }
        });
        await Promise.all(actions.concat([tx.done]));
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
    result.getRandomQuestion = async function (category, level = 1) {
        let res;
        let questions;
        if (!db.objectStoreNames.contains(category)) {
            return;
        }
        questions = await db.getAllFromIndex(category, "level", level);
        questions = questions.filter((el) => el.status === "not-selected");
        res = questions[getRandomIndex(questions.length)];
        if (res === undefined) {
            return null;
        }
        return decryptEntry(res).name;
    };
    result.markFound = async function ({category, word}) {
        let res = await db.get(category, cipher.encrypt(word));
        if (res) {
            await db.put(category, Object.assign(res, {status: "selected"}));
        }
    };
    result.incrementUncovered = async function (store, level) {
        let res = await db.get("progress", [store, level]);
        if (res) {
            res.uncovered += 1;
            await db.put("progress", res);
        }
        console.error(`Cannot increment progress for ${store} level ${level}`);
    };
    result.getProgress = async function (store, level) {
        let res = await db.get("progress", [store, level]);
        if (res) {
            return res;
        }
        console.error(`Progress for ${store} level ${level} does not exists`);
    };
    result.getCategoryProgress = async function (store) {
        let res = await db.getAllFromIndex("progress", "category", store);
        return computeStatus(res ?? []);
    };
    result.getHearts = async function (playerId = "default") {
        let res = await db.get("player", playerId);
        return res?.hearts ?? 0;
    };
    result.setHearts = async function (hearts, playerId = "default") {
        let res;
        if (!Number.isFinite(Number(hearts))) {
            throw new Error("Invalid heart count provided");
        }
        res = await db.get("player", playerId);
        if (!res) {
            console.warn("Attempting to set a non-existing player hearts");
            return;
        }
        await db.put("player", {id: playerId, hearts});
    };
    result.addAchievement = async function ({
        achievementId,
        category,
        level,
        playerId = "default",
    }) {
        const ev = {achievementId, category, level, playerId};
        ev.unlockedAt = Date.now();
        await db.put("achievements", ev);
    };
    result.getAchievements = async function (player = "default") {
        let res = await db.getAllFromIndex("achievements", "playerId", player);
        res = (res ?? []).reduce(function (acc, ev) {
            if (!acc[ev.achievementId]) {
                acc[ev.achievementId] = {id: ev.achievementId, events: [ev]};
            } else {
                acc[ev.achievementId].events.push(ev);
            }
            return acc;
        }, Object.create(null));
        return Object.values(res);
    };
    result.hasAchieved = async function ({
        achievementId,
        category,
        player = "default",
    }) {
        const res = await db.getAllFromIndex(
            "achievements",
            "playerAchievements",
            [player, achievementId]
        );
        return (res ?? []).some((e) => e.category === category);
    };
    await initProgress();
    await initPoints();
    return result;
}

/**
* Utility for getting the progress from a data source
* @param {Source} data
* @returns {Progress[]}
*/
function getProgress(data) {
    return Object.entries(data.categories).reduce(function (acc, [store, val]) {
        let tmp = Object.entries(val).reduce(function (words, [k, v]) {
            let level = Number.parseInt(k.replace(/level_/i, ""), 10);
            if (!Number.isFinite(level)) {
                return words;
            }
            return words.concat([
                {store, level, totalWords: v.length, uncovered: 0}
            ]);
        }, []);
        return acc.concat(tmp);
    }, []);
}

/**
* Utility for fetching questions in the dataset
* @param {Source} data
* @returns {Question[]}
*/
function getQuestions(data) {
    return Object.entries(data.categories).reduce(function (acc, [store, val]) {
        let tmp = {store};
        tmp.datas = Object.entries(val).reduce(function (words, [k, v]) {
            const status = "not-selected";
            let level = Number.parseInt(k.replace(/level_/i, ""), 10);
            if (!Number.isFinite(level)) {
                return words;
            }
            return words.concat(v.map(function (word) {
                return Object.assign(word, {level, status})
            }));
        }, []);
        acc[acc.length] = tmp;
        return acc;
    }, []);
}

async function onInstall(event) {
    event.waitUntil(handleInstallation());
    config.db = await gameStorage({version: config.version});
    await self.skipWaiting();
}
function onActivate(event) {
    event.waitUntil(handleActivation());
}
function onFetch(event) {
    event.respondWith(handleFetch(event));
}
async function handleActivation() {
    await clearOldCache();
    await self.clients.claim();
    await sendMessage({statusUpdateRequest: true});
}

async function handleInstallation() {
    await setupQuestions();
    await cacheStaticFiles();
}

function tryFetch(param) { //implemented to avoid safari break on failed request
    let res;
    try {
        res = fetch(param);
    } catch (ignore) {
        res = Promise.resolve(null);
    }
    return res;
}

async function cacheStaticFiles(reload = false) {
    const cache = await caches.open(config.cacheName);
    const options = {
        cache: "no-store",
        credetials: "omit",
        method: "GET"
    };
    return Promise.all(
        cachableUrls.static.concat(Object.values(cachableUrls.pages)).concat(
            cachableUrls.updatable
        ).map(
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
    // const cache = await caches.open(config.cacheName);
    const url = new URL(request.url);
    let path = url.pathname.replace(/\/$/, "");
    if (path.length === 0) {
        path = "/";
    }
    if (url.origin !== location.origin) {
        return fetch(request);
    }
    if (url.pathname.startsWith("/api")) {
        return handleAPI(request);
    }
    // return safeFetch({cache, event, path});
    return fetch(request);
}

async function safeFetch({cache, event, path}) {
    let response;
    response = await cache.match(cachableUrls.pages[path] ?? path);
    if (!response) {
        response = await tryFetch(cachableUrls.pages[path] ?? event.request);
        if (response?.ok) {
            event.waitUntil(cache.put(
                cachableUrls.pages[path] ?? path,
                response.clone()
            ));
        } else {
            return handle404({cache, event, response});
        }
    }
    return response;
}

async function handle404({cache, event, response}) {
    let res;
    if (
        event.request.method === "GET" &&
        (/text\/html/i).test(event.request.headers.get("accept"))
    ) {
        res = await cache.match("/404.html");
        if (res) {
            return res;
        }
        res = await tryFetch("/404.html");
        if (res?.ok) {
            event.waitUntil(cache.put("/404.html", res.clone()));
        }
        return res;
    }
    return response ?? fetch(event.request);
}

async function unsupported(req) {
    const path = new URL(req.url).pathname;
    return createResponse(400, {
        message: `path ${path} not supported for method ${req.method}`
    });
}

async function word(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let title;
    let tmp;
    if (!path.startsWith("/api/word")) {
        return next(req, ctx);
    }
    tmp =  await req.json();
    title = String(tmp.category ?? "");
    if (title.trim().length === 0) {
        title = config.db.getStores();
        title = title[getRandomIndex(title.length)];
    }
    tmp = await config.db.getRandomQuestion(title, tmp.level);
    return createResponse(200, {title, word: tmp});
}

async function found(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/found")) {
        return next(req, ctx);
    }
    tmp = await req.json();
    if (!tmp.category || !tmp.word) {
        return createResponse(400, {message: "Missing category or word"});
    }
    await config.db.markFound(tmp);
    return createResponse(200, {message: "Word marked successfully found!!"});
}

async function badges(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/badges")) {
        return next(req, ctx);
    }
    tmp = await config.db.getAchievements();
    return createResponse(200, {badges: tmp});
}

async function hearts(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/hearts")) {
        return next(req, ctx);
    }
    tmp = await config.db.getHearts();
    return createResponse(200, {hearts: tmp});
}

async function progress(req, ctx, next) {
    const url = new URL(req.url);
    let tmp;
    if (!url.pathname.startsWith("/api/progress")) {
        return next(req, ctx);
    }
    tmp = url.searchParams
    if (!tmp.has("cat")) {
        return createResponse(400, {message: "Missing category value"});
    }
    tmp = await config.db.getCategoryProgress(tmp.get("cat"));
    return createResponse(200, {result: tmp});
}

async function setHearts(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/set-hearts")) {
        return next(req, ctx);
    }
    tmp = await req.json();
    if (!tmp.hearts) {
        return createResponse(400, {message: "Missing new hearts value"});
    }
    await config.db.setHearts(tmp.hearts);
    return createResponse(200, {message: "Hearts updated successfully !!"});
}

async function addBadge(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/new-badge")) {
        return next(req, ctx);
    }
    tmp = await req.json();
    if (!tmp.achievementId || !tmp.category || !tmp.level) {
        return createResponse(400, {
            message: "badge tag or category or level are missing"
        });
    }
    await config.db.addAchievement(tmp);
    return createResponse(200, {message: "Badge added successfully !!"});
}

async function guess(req, ctx, next) {
    const path = new URL(req.url).pathname;
    let tmp;
    if (!path.startsWith("/api/new-guess")) {
        return next(req, ctx);
    }
    tmp = await req.json();
    if (!tmp.category || !tmp.level) {
        return createResponse(400, {
            message: "Missing category or level in new guess"
        });
    }
    await config.db.incrementUncovered(tmp.category, tmp.level);
    return createResponse(200, {message: "New guess saved successfully !!"});
}

async function handleAPI(request) {
    let chain;
    if (request.method === "GET") {
        chain = [word, hearts, progress, badges];
    } else {
        chain = [found, addBadge, guess, setHearts];
    }
    return createHandler(unsupported, chain)(request, {});
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
    let words;
    let progress;
    const datas = await fetchData({url: "/assets/data.json"});
    console.log(datas);
    if (datas.cached || !datas.success) {
        return;
    }
    words = getQuestions(datas);
    progress = getProgress(datas);
    config.db = await gameStorage({
        progress,
        stores: words.map((val) => val.store),
        version: config.version
    });
    await Promise.all(
        words.map(function ({datas, store}) {
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
    if (data === "SKIP_WAITING") {
        await self.skipWaiting();
        return;
    }
    if (data.statusUpdate) {
        config.isOnline = data.statusUpdate.isOnline;
    }
    if (data.connectionRequest && ports[0]) {
        config.isOnline = data.connectionRequest.isOnline;
        ports[0].onmessage = handleMessage;
        ports[0].postMessage({connectionAcknowledged: true});
    }
}

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("fetch", onFetch);
self.addEventListener("message", handleMessage);
