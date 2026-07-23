import utils from "./utils.js";

const store = utils.jsonStorage();
const dict = {
    locked: {
        en: "Guess 3 answers in Level {x} to unlock",
        fr: "Devine 3 réponses dans le niveau {x} pour le débloquer."
    },
    perfect: {
        en: "You've guessed every answer perfectly!",
        fr: "Toutes les réponses ont été devinées à la perfection !"
    },
    unlocked: {
        en: "You've guessed {x} of {y} answers - keep it up!",
        fr: "{x} réponse{z} sur {y} dévoilée{z} — continue comme ça !"
    }
};


async function getProgress() {
    let tmp = store.getValue("_game_", "category");
    tmp = await fetch(`/api/progress?cat=${encodeURI(tmp)}`, {
        headers: {"Content-type": "application/json"},
        method: "GET"
    });
    if (!tmp.ok) {
        console.error("failed to retrieve progress ");
        //TODO: Handle error Case in the UI
        return;
    }
    tmp = await tmp.json();
    tmp.result.forEach(function (res) {
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
        desc = dict[res.status][props.lang].replaceAll("{z}", props.z);
        desc = desc.replace("{x}", props.x ?? "").replace("{y}", props.y ?? "");
        document.getElementById(`level_${res.level}-desc`).innerText = desc;
    });
}

(function initialize() {
    const opts = {};
    let url = new URL(window.location.href);
    opts.category = decodeURIComponent(url.hash.replace("#", ""));
    opts.lang = decodeURIComponent(url.pathname).split("/")[1];
    if (!opts.category) {
        console.warn(`Missing category ${opts.category}. redirecting ...`);
        window.location.assign(`/${opts.lang}/categories`);
        return;
    }
    store.setValue("_game_", "lang", opts.lang);
    store.setValue("_game_", "category", opts.category);
    document.getElementById("current-category").innerText = opts.category;
    getProgress();
    window.history.replaceState(null, "", url.pathname);
}())
