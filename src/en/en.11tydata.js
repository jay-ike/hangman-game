const {categoryList} = require("../../assets/data.json");
module.exports = Object.freeze({
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
            "description": "Choose a theme like Animals or Movies. A secret word will be chosen with blank spaces for each letter.",
            "number": "01",
            "title": "select a category"
        },
        {
            "description": "Choose your challenge tier. Advanced difficulties and levels must be unlocked through previous play.",
            "number": "02",
            "title": "choose difficulty"
        },
        {
            "description": "Tap letters to reveal them in the blanks. Correct guesses fill the spaces, while wrong guesses decrease your hearts.",
            "number": "03",
            "title": "guess letters"
        },
        {
            "description": "Uncover every letter before you run out of hearts to win or  game over!",
            "number": "04",
            "title": "win or lose"
        }
    ],
    site_image: {
        "alt": "a screenshot of the hangman game home page showing how to play",
        "description": "Try to guess the hidden item until you run out of hearts. Don't be scared I know you can do it",
        "height": 630,
        "name": "Hangman game",
        "src": "https://ike-hangman-game.vercel.app/assets/images/menu-en-og-image.png",
        "title": "The hangman game. will you guess it right ?",
        "width": 1200
    }
});
