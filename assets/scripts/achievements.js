import utils from "./utils.js";

const store = utils.jsonStorage();
const api = new utils.ApiHandler();

function getDescription(count) {
    const lang = store.getValue("_game_", "lang") ?? "en";
    let res = count > 0 ? utils.dict.earned : utils.dict.not_earned;
    res = res[lang].replace("{x}", count).replace("{y}", count > 1 ? "s" : "");
    return res;
}

async function getBadges(emitter) {
    let res = await api.getBadges(store.getValue("_game_", "lang"));
    let tags = Array.from(document.querySelectorAll("[data-tag]"));
    let showDialog = dialogHandler(emitter);
    if (!res.ok) {
        console.error("failed to retrieve badges ");
        //TODO: Handle error Case in the UI
        return;
    }
    tags.forEach(function (el) {
        const {tag} = el.dataset;
        const badge = res.data.filter((t) => t.id === tag)[0];
        let tmp = el.querySelector(`#${tag}-count-desc`);
        tmp.innerText = getDescription(badge?.events?.length ?? 0);
        if (!badge) {
            return;
        }
        el.dataset.earned = "";
        if (badge.events.length > 1) {
            tmp = document.getElementById(tag + "-count");
            tmp.innerText = `x${badge.events.length}`;
            el.dataset.multiple = "";
        }
        tmp = el.querySelector("img");
        if (!tmp) {
            return;
        }
        tmp.srcset = tmp.dataset.srcset;
        tmp.src = tmp.dataset.src;
        tmp.style = "";
        delete tmp.dataset.srcset;
        delete tmp.dataset.src;
    });
    document.body.addEventListener("click", function (ev) {
        let data;
        let {tag} = ev.target.dataset;
        let badge;
        let list = emitter.target.querySelector(".preview-logs > ul.row");
        if (!tag) {
            return;
        }
        badge = res.data.filter((b) => b.id === tag)[0];
        if (Array.isArray(badge?.events) && list) {
            data = badge.events.map(getAchievementDOM).join("");
            list.textContent = "";
            list.insertAdjacentHTML("beforeend", data);
        }
        data = {
            count: ev.target.querySelector(`#${tag}-count-desc`).innerText,
            description: ev.target.querySelector(`#${tag}-desc`).innerText,
            src: ev.target.querySelector("img").src,
            srcset: ev.target.querySelector("img").srcset,
            title: ev.target.querySelector(`#${tag}-title`).innerText
        };
        emitter.target.dataset.notEarned = "";
        if (typeof ev.target.dataset.earned === "string") {
            data.description = ev.target.dataset.content;
            delete emitter.target.dataset.notEarned;
        }
        showDialog(data);
    });
}

function getAchievementDOM(evt, i) {
    const lang = store.getValue("_game_", "lang") ?? "en";
    const p = {
        date: new Date(evt.unlockedAt).toISOString(),
        title: utils.formatDate(evt.unlockedAt, lang),
        desc: evt.category + " - " + utils.dict.level[lang] + " " + evt.level
    };
    return `<li class="box structured-grid card" data-variant="achievement-tile"
    aria-labelledby="log-1-date" aria-describedby="log-${i}-desc">
        <time class="card-title" id="log-${i}-date" datetime="${p.date}">
        ${p.title}
        </time>
        <p class="card-action" id="log-${i}-desc">${p.desc}</p>
    </li>`;
}

function dialogHandler(emitter) {
    const {dispatch, target} = emitter;
    let activeElement;

    if (typeof dispatch !== "function") {
        throw new Error("emitter Should implement the dispatch function !!!");
    }
    if (!window.HTMLDialogElement.prototype.isPrototypeOf(target)) {
        throw new DOMException("The emitter target should be a Dialog !!!");
    }
    utils.trapFocus(target);
    target.addEventListener("close", function () {
        if (activeElement) {
            activeElement.focus();
        }
    });
    target.addEventListener("click", function (event) {
        const btn = event.target;
        if (utils.isButton(btn) && btn.classList.contains("modal-close")) {
            target.close();
        }
    });
    function showDialog(data) {
        activeElement = document.activeElement;
        utils.getFocusableChildren(target)[0].focus();
        dispatch("heading-updated", data);
        target.showModal();
    }
    return Object.freeze(showDialog);
}


(function initialize() {
    const dispatcher = new utils.EventDispatcher();
    let tmp = new URL(window.location.href);
    tmp = decodeURIComponent(tmp.pathname).split("/")[1];
    store.setValue("_game_", "lang", tmp);
    getBadges(dispatcher.emitterOf("dialog-updated"));
}());
