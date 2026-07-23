

async function getBadges() {
    let res = await fetch("/api/badges", {
        headers: {"Content-Type": "application/json"},
        method: "GET"
    });
    let tags = Array.from(document.querySelectorAll("[data-tag]"));
    if (!res.ok) {
        console.error("failed to retrieve badges ");
        //TODO: Handle error Case in the UI
        return;
    }
    res = await res.json();
    res.badges.forEach(function ({achievementId, events}) {
        const el = tags.filter((t) => t.dataset.tag === achievementId)[0];
        let tmp;
        if (!el) {
            return;
        }
        el.dataset.earned = "";
        el.classList.remove("disabled");
        if (events.length > 1) {
            tmp = document.getElementById(achievementId + "-count");
            tmp.innerText = `x${events.length}`;
            el.dataset.multiple = "";
        }
        tmp = el.querySelector("img");
        if (!tmp) {
            return;
        }
        tmp.srcset = tmp.dataset.srcset;
        tmp.src = tmp.dataset.src;
        delete tmp.dataset.srcset;
        delete tmp.dataset.src;
    });
    document.body.addEventListener("click", function (ev) {
        const modal = document.getElementById("badge-details");
        if (!ev.target.dataset.tag) {
            return;
        }
        modal.showModal();
        if (!ev.target.dataset.earned) {
            console.log(`tag ${ev.target.dataset.tag} clicked !!!`);
        }
    });
}


(function initialize() {
    getBadges();
}());
