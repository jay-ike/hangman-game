const {categoryList} = require("../../assets/data.json");
module.exports = Object.freeze({
    categories: categoryList.fr,
    locale: "fr",
    rules: [
        {
            "description": "Tout d'abord, choisissez une catégorie de mots, comme les animaux ou les films. L'ordinateur sélectionne ensuite au hasard un mot secret dans cette catégorie et vous montre des cases vides pour chaque lettre du mot.",
            "number": "01",
            "title": "choisir une catégorie"
        },
        {
            "description": "À tour de rôle, vous devez deviner les lettres. L'ordinateur remplit les espaces vides correspondants si votre devinette est correcte. Si vous vous êtes trompé, vous perdrez des points de vie, qui se videront au bout de huit mauvaises réponses.",
            "number": "02",
            "title": "deviner les lettres"
        },
        {
            "description": "Si vous avez du mal à deviner un élément, vous pouvez utiliser le bouton « cadeau » pour révéler une lettre de l'élément.<br>Notez que vous ne pouvez utiliser cette fonctionnalité que si vous avez au moins 2 points de vie.",
            "number": "03",
            "title": "dévoiler une lettre"
        },
        {
            "description": "Vous gagnez en devinant toutes les lettres du mot avant que votre barre de santé ne s'épuise. Si votre barre de santé se vide avant que vous n'ayez deviné le mot, vous perdez.",
            "number": "04",
            "title": "gagner ou perdre"
        }
    ],
    site_image: {
        "alt": "une capture d'écran de la page d'accueil du jeu du pendu montrant comment jouer",
        "description": "Essayez de deviner ce qui est caché jusqu'à ce que vous n'ayez plus de cœurs. N'ayez pas peur, je sais que vous pouvez y arriver.",
        "height": 630,
        "name": "Jeu du pendu",
        "src": "https://ike-hangman-game.vercel.app/assets/images/menu-fr-og-image.png",
        "title": "Le jeu du pendu. Sauras-tu le deviner ?",
        "width": 1200
    }
});
