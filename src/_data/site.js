/*jslint node*/
function generateLetters() {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    return alphabet.split("").map(function (letter) {
        return Object.freeze({letter});
    });
}
module.exports = Object.freeze({
    badgeCardProps: {class: "card-action"},
    badgeModalProps: {
        "data-listen": "heading-updated",
        "data-attributes": "src:{src},srcset:{srcset}",
        class: "card-action",
        height: 84,
        style: "",
        width: 75
    },
    gameName: {name: "hangman"},
    keyboard: generateLetters()
});
