import utils from "./utils.js";

const store = utils.jsonStorage();
const api = new utils.ApiHandler();

function removeAccents(val) {
    const res = String(val).normalize("NFD").toLowerCase();
    return res.replace(/[\u0300-\u036f]/g, "").replace(/\s/g, "-");
}

async function getProgress() {
    let tmp = store.getValue("_game_", "category");
    tmp = await api.getProgress(encodeURI(tmp));
    if (!tmp.ok) {
        console.error("failed to retrieve progress ");
        //TODO: Handle error Case in the UI
        return;
    }
    tmp.data.forEach(function (res) {
        const level = document.querySelector(`[data-level="${res.level}"]`);
        const props = {lang: store.getValue("_game_", "lang")};
        let desc;
        level.dataset.state = res.status;
        if (res.status === "unlocked") {
            props.x = res.uncovered;
            props.y = res.totalWords;
            props.z = `${res.uncovered > 1 ? "s": ""}`;
        }
        if (res.status === "locked") {
            props.x = res.level - 1;
        }
        desc = utils.dict[res.status][props.lang].replaceAll("{z}", props.z);
        desc = desc.replace("{x}", props.x ?? "").replace("{y}", props.y ?? "");
        document.getElementById(`level_${res.level}-desc`).innerText = desc;
    });
}

(function initialize() {
    const opts = {};
    let tmp = new URL(window.location.href);
    opts.category = decodeURIComponent(tmp.hash.replace("#", ""));
    opts.lang = decodeURIComponent(tmp.pathname).split("/")[1];
    if (!opts.category) {
        console.warn(`Missing category ${opts.category}. redirecting ...`);
        window.location.assign(`/${opts.lang}/categories`);
        return;
    }
    store.setValue("_game_", "lang", opts.lang);
    store.setValue("_game_", "category", opts.category);
    document.getElementById("current-category").innerText = opts.category;
    getProgress();
    window.history.replaceState(null, "", tmp.pathname);
    tmp = document.querySelector(".heading > a");
    tmp.style.viewTransitionName = removeAccents(opts.category);
}())
