const {getBadges} = require("../../util");
const {categoryList} = require("../../assets/data.json");
module.exports = Object.freeze({
    eleventyComputed: {
        achievements: async function () {
            const data = await getBadges();
            return [
                {
                    badges: [
                        {
                            description: "You’ve navigated the safe zone. Time to walk the tightrope.",
                            meta: data["knot"],
                            purpose: "Unlock level 4 by guessing 3 answers in level 3. Keep at it, you're making progress.",
                            tag: "knot",
                            title: "Knot Expert"
                        },
                        {
                            description: "Welcome to the dead end. Every single letter counts now.",
                            meta: data["gallow"],
                            purpose: "Unlock level 8 by guessing 3 answers in level 7. Stay focused, it's worth the effort.",
                            tag: "gallow",
                            title: "Gallows Walker"
                        },
                        {
                            description: "Found every answer in Level 1 without breaking a sweat.",
                            meta: data["level1"],
                            purpose: "Find every answer in level 1 without missing a single one. Give it a try, you might surprise yourself.",
                            tag: "level1",
                            title: "Untouchable"
                        },
                        {
                            description: "Completely mastered the Safe Zone. The noose can't catch you here.",
                            meta: data["shield"],
                            purpose: "Find every answer in the Safe Zone tier (levels 1, 2, and 3). Keep playing, you'll get there.",
                            tag: "shield",
                            title: "Rope Dodger"
                        },
                        {
                            description: "Uncovered every hidden answer while balancing on the tightrope.",
                            meta: data["balancing"],
                            purpose: "Find every answer in level 5. Take your time and enjoy the challenge.",
                            tag: "balancing",
                            title: "Balancing Act"
                        },
                        {
                            description: "You conquered the Tightrope tier with flawless execution.",
                            meta: data["accrobat"],
                            purpose: "Find every answer in the Tightrope tier (levels 4, 5, 6, and 7). It's tough, but you can do it.",
                            tag: "accrobat",
                            title: "Acrobat"
                        },
                        {
                            description: "Discovered all advanced answers at the edge of the abyss.",
                            meta: data["gate"],
                            purpose: "Find every answer in level 9. A tough climb, but a rewarding one.",
                            tag: "gate",
                            title: "Dead End Escape"
                        },
                        {
                            description: "The ultimate escape. You fully conquered a category!",
                            meta: data["immortal"],
                            purpose: "Find every answer in a whole category. One step at a time, you'll get there.",
                            tag: "immortal",
                            title: "Immortal"
                        }
                    ],
                    description: "For conquering levels and mastering categories.",
                    type: "progression",
                },
                {
                    badges: [
                        {
                            description: "Solved a puzzle without letting the executioner draw a single line.",
                            meta: data["quill"],
                            purpose: "Guess an answer without a single wrong letter. It's rare, but when it happens it feels great.",
                            tag: "quill",
                            title: "Flawless Run"
                        },
                        {
                            description: "Saved yourself on the absolute last breath.",
                            meta: data["clutch"],
                            purpose: "Guess an answer on your very last allowed mistake. Nail‑biting, but oh so satisfying.",
                            tag: "clutch",
                            title: "Clutch Snap"
                        },
                        {
                            description: "Solved 3 answers in a row without getting caught.",
                            meta: data["streak"],
                            purpose: "Guess 3 answers in a row without losing a game. Stay steady, you'll hit your stride.",
                            tag: "streak",
                            title: "Survival Streak"
                        },
                        {
                            description: "Successfully dismantled a massive puzzle before the trap door opened.",
                            meta: data["slayer"],
                            purpose: "uess an answer with 10 or more letters. Big challenges bring big satisfaction.",
                            tag: "slayer",
                            title: "Giant Slayer"
                        }
                    ],
                    description: "For special moments, clever guesses, and perfect plays.",
                    type: "discoveries",
                }
            ];
        }
    },
    categories: categoryList.en,
    locale: "en",
    levels: [
        {
            description: "Everyday answers, very common, short to medium length.",
            indexes: [1, 2, 3],
            tier: "normal",
            title: "safe zone"
        },
        {
            description: "Less common answers, a bit longer or trickier to guess.",
            indexes: [4, 5, 6, 7],
            tier: "medium",
            title: "tightrope"
        },
        {
            description: "Rare answers, tricky spellings, and obscure terms.",
            indexes: [8, 9, 10],
            tier: "hard",
            title: "dead end"
        }
    ],
    rules: [
        {
            description: "Choose a theme like Animals or Movies. A secret word will be chosen with blank spaces for each letter.",
            number: "01",
            title: "select a category"
        },
        {
            description: "Choose your challenge tier. Advanced difficulties and levels must be unlocked through previous play.",
            number: "02",
            title: "choose difficulty"
        },
        {
            description: "Tap letters to reveal them in the blanks. Correct guesses fill the spaces, while wrong guesses decrease your hearts.",
            number: "03",
            title: "guess letters"
        },
        {
            description: "Uncover every letter before you run out of hearts to win or  game over!",
            number: "04",
            title: "win or lose"
        }
    ],
    site_image: {
        alt: "a screenshot of the hangman game home page showing how to play",
        description: "Try to guess the hidden item until you run out of hearts. Don't be scared I know you can do it",
        height: 630,
        name: "Hangman game",
        src: "https://ike-hangman-game.vercel.app/assets/images/menu-en-og-image.png",
        title: "The hangman game. will you guess it right ?",
        width: 1200
    }
});
