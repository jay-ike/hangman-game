/*jslint browser, this*/
/** @import {ApiHandlerInstance, PointManagerInstance, PointListenerInstance} from './types.js' */

const badges = [
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "knot")) {
                return false;
            }
            return hasUnlocked(ctx.progression, ctx.category, 3);
        },
        id: "knot",
		points: 10,
        title: {en: "Knot Expert", fr: "Expert des nœuds"},
    },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "gallow")) {
                return false;
            }
            return hasUnlocked(ctx.progression, ctx.category, 7);
        },
        id: "gallow",
		points: 15,
        title: {en: "Gallows Walker", fr: "Marcheur du gibet"},
    },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "level1")) {
                return false;
            }
            return hasPerfected(ctx.progression, ctx.category, 1);
        },
        id: "level1",
		points: 5,
        title: {en: "Untouchable", fr: "Intouchable"}, },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "shield")) {
                return false;
            }
            return hasPerfected(ctx.progression, ctx.category, [1, 2, 3]);
        },
        id: "shield",
		points: 20,
        title: {en: "Rope Dodger", fr: "Esquiveur de corde"},
    },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "balancing")) {
                return false;
            }
            return hasPerfected(ctx.progression, ctx.category, 5);
        },
        id: "balancing",
		points: 10,
        title: {en: "Balancing Act", fr: "Numéro d'équilibriste"},
    },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "accrobat")) {
                return false;
            }
            return hasPerfected(ctx.progression, ctx.category, [4, 5, 6, 7]);
        },
        id: "accrobat",
		points: 30,
        title: {en: "Acrobat", fr: "Acrobate"},
    },
    {
        evaluate: function (ctx) {
            if (hasAchieved(ctx.badges, ctx.category, "gate")) {
                return false;
            }
            return hasPerfected(ctx.progression, ctx.category, 9);
        },
        id: "gate",
		points: 15,
        title: {en: "Dead End Escape", fr: "Évasion de l'impasse"},
    },
    {
        evaluate: function (ctx) {
            let res = Array.isArray(ctx.progression) ? ctx.progression : [];
            if (hasAchieved(ctx.badges, ctx.category, "immortal")) {
                return false;
            }
            return res.every(
                (p) => p.uncovered === p.totalWords && p.totalWords > 0
            );
        },
        id: "immortal",
		points: 50,
        title: {en: "Immortal", fr: "Immortel"},
    },
    {
        evaluate: function (ctx) {
            return ctx.mistakes === 0
        },
        id: "quill",
		points: 5,
        title: {en: "Flawless Run", fr: "Parcours sans faute"},
    },
    {
        evaluate: function (ctx) {
            const costs = getActionCost(ctx.level);
            return ctx.hearts > 0 && ctx.hearts <= costs.guess;
        },
        id: "clutch",
		points: 8,
        title: {en: "Clutch Snap", fr: "Sauvetage in extremis"},
    },
    {
        evaluate: function (ctx) {
            return ctx.streak === 3;
        },
        id: "streak",
		points: 8,
        title: {en: "Survival Streak", fr: "Série de survie"},
    },
    {
        evaluate: function (ctx) {
            let letters;
            if (typeof ctx.word !== "string") {
                return false;
            }
            letters = ctx.word.replace(/\s/g, "");
            return letters.length >= 10;
        },
        id: "slayer",
		points: 10,
        title: {en: "Giant Slayer", fr: "Tueur de géants"},
    }
];

/**
* Utility for getting the points deduction based on the current level
* @param {number} level - The given level
* @return {{item: number, guess: number, letter: number}}
*/
function getActionCost(level) {
    return {guess: level, letter: 2 * level, item: 10 * level};
}

function hasAchieved(badges, category, id) {
    let res = Array.isArray(badges) ? badges : [];
    res = res.find((b) => b.id === id);
    res = res?.events ?? [];
    if (res.some((e) => e.category === category)) {
        return true;
    }
    return false;
}

function hasPerfected(progression, category, level) {
    let res = Array.isArray(progression) ? progression : [];
    let range = Array.isArray(level) ? level : [level];
    res = progression.filter(
        (p) => range.includes(p.level) && p.store === category
    );
    if (res.length !== range.length) {
        return false;
    }
    return res.every((p) => p.uncovered === p.totalWords && p.totalWords > 0);
}

function hasUnlocked(progression, category, level) {
    let res = Array.isArray(progression) ? progression : [];
    res = progression.find(
        (p) => p.level === level && p.store === category
    );
    return res && res.uncovered === 3;
}

function getEarnedBadges(context) {
    return badges.filter((b) => b.evaluate(context)).map(function (badge) {
        return {
            id: badge.id,
            points: badge.points,
            title: badge.title[context.lang]
        };
    });
}

/**
 * Utility for listening mutations
 * @param {MutationRecord} record
 */
function listener(record) {
    const {action, diff} = record.target.dataset;
    let particle;
    if (record.attributeName === "data-action" && action) {
        particle = document.createElement("span");
        particle.classList.add("point", action ?? "deduct")
        particle.textContent = diff;
        record.target.appendChild(particle);
        particle.addEventListener("animationend", function (evt) {
            evt.target.remove();
        });
        delete record.target.dataset.diff;
        delete record.target.dataset.action;
    }
}

/**
* Utility for managing points in the game
* @constructor
* @param {ApiHandlerInstance} api
* @returns {PointManagerInstance}
*/
function PointManager(api) {
    /** @type {PointManagerInstance} */
    const self = Object.create(null);
    self.getDeduction = getActionCost;
    self.handleItemFound = async function (ctx, revealed) {
        const res = {points: (ctx.level * 5) + 2};
        let badges;
        let progression;
        let tmp;
        tmp = await api.markFound(ctx);
        if (!tmp.ok) {
            throw new Error("An error occure while marking item as found");
        }
        tmp = tmp.data;
        res.progress = {uncovered: tmp.uncovered, totalWords: tmp.totalWords};
        tmp = await api.getProgress(ctx.category);
        if (!tmp.ok) {
            throw new Error("An error occured during your progress retrieval");
        }
        progression = tmp.data;
        tmp = await api.getBadges(ctx.lang);
        if (!tmp.ok) {
            throw new Error("An error occured while retrieving earned badges");
        }
        badges = tmp.data;
        tmp = getEarnedBadges(Object.assign({badges, progression}, ctx)) ?? [];
        res.badges = !revealed ? tmp : [];
        res.points += tmp.reduce((a, v) => a + v.points, 0);
        await Promise.all(tmp.map(async function (badge) {
            const result = await api.addBadge({
                achievementId: badge.id,
                category: ctx.category,
                lang: ctx.lang,
                level: ctx.level
            });
            if (!result.ok) {
                throw new Error(`Error while saving badge: ${badge.title}`);
            }
        }));
        return res;
    }
    return Object.freeze(self);
}

/**
* Utility for listening to points update in the game
* @constructor
* @param {string[]} filter
* @returns {PointListenerInstance}
*/
function AttributeListener(filter) {
    let observer= new MutationObserver((records) => records.forEach(listener));
    /** @type {PointListenerInstance} */
    let self = Object.create(null);
    self.listen = function (selector) {
        const elt = document.querySelector(selector);
        if (!elt) {
            return false;
        }
        observer.observe(elt, {attributes: true, attributeFilter: filter});
    }
    self.release = function () {
        observer.disconnect();
    }
    return Object.freeze(self);
}

export default Object.freeze({AttributeListener, PointManager});
