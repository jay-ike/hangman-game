/*jslint node*/
function generateLetters() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return alphabet.split("").map(function (letter) {
        return Object.freeze({letter});
    });
}
module.exports = Object.freeze({
    gameName: {name: "hangman"},
    keyboard: generateLetters()
});
