import utils from "./utils.js";

const dispatcher = new utils.EventDispatcher();
const emitters = {
    header: dispatcher.emitterOf("heading-change"),
    letters: dispatcher.emitterOf("letter-found")
}
let db;
const word = "omari hardwick";
emitters.letters.target.textContent = "";
emitters.header.dispatch("title-updated", {
    titleClass: "nil",
    title: getTitle()
});

function getTitle() {
    return new URL(document.URL).hash.replace(/(?:%20|#)/gi, " ").trim();
}

async function fetchQuestions() {
    let result = [];
    const datas = await utils.fetchData(window.origin + "/assets/data.json");

    if (datas.success) {
        result = Object.entries(datas.categories).reduce(
            function (acc, [store, val]) {
                let tmp = {store}
                if (Array.isArray(val)) {
                    tmp.datas = val.map(function (question) {
                        const result = Object.assign({}, question);
                        result.selected = ( result.selected
                            ? "selected"
                            : "not-selected"
                        );
                        return result;
                    });
                    acc[acc.length] = tmp;
                }
                return acc;
            },
            []
        );
    }
    return result;
}

document.body.addEventListener("click", function (event) {
    const {target} = event;
    let indexes;
    let letter;
    if (
        HTMLButtonElement.prototype.isPrototypeOf(target) &&
        target.classList.contains("letter")
    ) {
        letter = target.textContent.trim();
        indexes = utils.getIndexes(utils.getWords(word).join(""), letter);
        indexes.forEach((index) => emitters.letters.dispatch(
            "letter" + (index + 1) + "-changed",
            {dimmed: "nil", letter}
        ));
    }
});
window.addEventListener("DOMContentLoaded", async function () {
    let questions = await fetchQuestions();
    let hiddenWord;
    const stores = questions.map((val) => val.store);
    db = await utils.questionStorage({stores});
    questions = questions.map(function ({store, datas}) {
        return db.addMany(store, datas);
    });
    await Promise.all(questions);
    hiddenWord = await db.getRandomQuestion(getTitle());
    emitters.letters.target.insertAdjacentHTML(
        "beforeend",
        utils.createDOMSentence(hiddenWord).join("")
    );

});
