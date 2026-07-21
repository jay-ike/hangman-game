const {categoryList} = require("../../assets/data.json");
module.exports = Object.freeze({
    categories: categoryList.fr,
    locale: "fr",
    levels: [
        {
            description: "Des réponses du quotidien, très courantes, courtes ou de longueur moyenne.",
            indexes: [1, 2, 3],
            tier: "normal",
            title: "zone de confort"
        },
        {
            description: "Des réponses un peu moins courantes, plus longues ou plus piégeuses.",
            indexes: [4, 5, 6, 7],
            tier: "medium",
            title: "corde raide"
        },
        {
            description: "Des réponses rares, à l’orthographe complexe, ou des termes obscurs.",
            indexes: [8, 9, 10],
            tier: "hard",
            title: "impasse"
        }
    ],
    rules: [
        {
            "description": "Choisis un thème comme Animaux ou Films. Un mot secret sera choisi et affiché avec des tirets pour chaque lettre.",
            "number": "01",
            "title": "Choisis une catégorie"
        },
        {
            "description": "Choisis ton niveau de défi. Les difficultés avancées et les niveaux se débloquent en jouant.",
            "number": "02",
            "title": "Choisis la difficulté"
        },
        {
            "description": "Appuie sur les lettres pour les révéler dans les cases. Les bonnes réponses remplissent les tirets, et les mauvaises te font perdre des cœurs.",
            "number": "03",
            "title": "Devine les lettres"
        },
        {
            "description": "Trouve toutes les lettres avant de perdre tous tes cœurs pour gagner. Sinon, c'est le game over !",
            "number": "04",
            "title": "Gagne ou perds"
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
