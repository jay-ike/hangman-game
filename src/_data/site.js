/*jslint node*/
const {categories} = require("../../assets/data.json");
module.exports = Object.freeze({
    categories: Object.keys(categories),
    image: {
        alt: "a screenshot of the hagman game home page showing how to play",
        description: "Try to guess the hidden item untill you run out of " +
        "hearts. Don't be scared I know you can do it",
        height: 728,
        name: "The hangman game. will you guess it right ?",
        src: "https://ike-hangman-game.vercel.app/assets/images/" +
        "main-view-screenshot.webp",
        width: 1024
    },
    rules: [
        {
            description: "First, choose a word category, like animals or " +
            "movies. The computer then randomly selects a secret word from " +
            "that topic and shows you blanks for each letter of the word.",
            number: "01",
            title: "choose a category"
        },
        {
            description: "Take turns guessing letters. The computer fills " +
            "in the relevant blank spaces if your guess is correct. If it’s " +
            "wrong, you lose some health, which empties after eight " +
            "incorrect guesses.",
            number: "02",
            title: "guess letters"
        },
        {
            description: "You win by guessing all the letters in the word " +
            "before your health runs out. If the health bar empties before " +
            "you guess the word, you lose.",
            number: "03",
            title: "win or lose"
        }
    ]
});
