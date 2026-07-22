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
        fr: "{x} réponses sur {y} ont été devinée — continue comme ça !"
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
        }
        if (res.status === "locked") {
            props.x = res.level - 1;
        }
        desc = dict[res.status][props.lang];
        desc = desc.replace("{x}", props.x ?? "").replace("{y}", props.y ?? "");
        document.getElementById(`level_${res.level}-desc`).innerText = desc;
    });
}

function setGameData() {
    let url = new URL(window.location.href);
    let tmp = decodeURI(url.pathname).split("/")[1];
    store.setValue("_game_", "lang", tmp);
    tmp = decodeURI(url.hash).replace("#", "");
    store.setValue("_game_", "category", tmp);
    document.getElementById("current-category").innerText = tmp;
}

(function initialize() {
    setGameData();
    document.addEventListener("click", function (event) {
        let lev = Number.parseInt(event.target.dataset.level, 10);
        if (Number.isFinite(lev)) {
            store.setValue("_game_", "level", lev);
        }
    });
    getProgress();
}())
