const {categoryList} = require("../../assets/data.json");
const {getBadges} = require("../../util");
module.exports = Object.freeze({
    eleventyComputed: {
        achievements: async function () {
            const props = {"aria-hidden": "true", class: "card-action"}
            const data = await getBadges("src/badges", props);
            return [
                {
                    badges: [
                        {
                            description: "Tu as traversé la zone de confort. Il est temps de marcher sur la corde raide.",
                            meta: data["knot"],
                            purpose: "Débloque le niveau 4 en devinant 3 réponses dans le niveau 3. Continue comme ça, tu progresses.",
                            tag: "knot",
                            title: "Expert des nœuds"
                        },
                        {
                            description: "Bienvenue dans l'impasse. Chaque lettre compte désormais.",
                            meta: data["gallow"],
                            purpose: "Débloque le niveau 8 en terminant le niveau 7. Reste concentré, ça en vaut la peine.",
                            tag: "gallow",
                            title: "Marcheur du gibet"
                        },
                        {
                            description: "Tu as trouvé toutes les réponses du niveau 1 sans aucun effort.",
                            meta: data["level1"],
                            purpose: "Trouve toutes les réponses du niveau 1 sans en manquer une seule. Essaie, tu pourrais te surprendre.",
                            tag: "level1",
                            title: "Intouchable"
                        },
                        {
                            description: "Tu maîtrises parfaitement la zone de confort. Le nœud coulant ne peut pas t'attraper ici.",
                            meta: data["shield"],
                            purpose: "Trouve toutes les réponses du palier Zone de confort (niveaux 1, 2 et 3). Continue de jouer, tu vas y arriver.",
                            tag: "shield",
                            title: "Esquiveur de corde"
                        },
                        {
                            description: "Tu as découvert toutes les réponses cachées en équilibre sur la corde raide.",
                            meta: data["balancing"],
                            purpose: "Trouve toutes les réponses du niveau 5. Prends ton temps et profite du défi.",
                            tag: "balancing",
                            title: "Numéro d'équilibriste"
                        },
                        {
                            description: "Tu as conquis le palier Corde raide avec une exécution parfaite.",
                            meta: data["accrobat"],
                            purpose: "Trouve toutes les réponses du palier Corde raide (niveaux 4, 5, 6 et 7). C'est exigeant, mais tu peux le faire.",
                            tag: "accrobat",
                            title: "Acrobate"
                        },
                        {
                            description: "Tu as découvert toutes les réponses avancées au bord de l'abîme.",
                            meta: data["gate"],
                            purpose: "Trouve toutes les réponses du niveau 9. Une ascension difficile, mais gratifiante.",
                            tag: "gate",
                            title: "Évasion de l'impasse"
                        },
                        {
                            description: "L'évasion ultime. Tu as entièrement conquis une catégorie !",
                            meta: data["immortal"],
                            purpose: "Trouve toutes les réponses de toute une catégorie. Un pas après l'autre tu vas y arriver.",
                            tag: "immortal",
                            title: "Immortel"
                        }
                    ],
                    description: "Pour avoir conquis des niveaux et maîtrisé des catégories.",
                    type: "progression",
                },
                {
                    badges: [
                        {
                            description: "Tu as résolu une énigme sans laisser le bourreau tracer une seule ligne.",
                            meta: data["quill"],
                            purpose: "Devine une réponse sans une seule lettre fausse. C'est rare, mais quand ça arrive, c'est super.",
                            tag: "quill",
                            title: "Parcours sans faute"
                        },
                        {
                            description: "Tu t'es sauvé au tout dernier souffle.",
                            meta: data["clutch"],
                            purpose: "Devine une réponse à ta toute dernière erreur autorisée. Stressant, mais tellement satisfaisant.",
                            tag: "clutch",
                            title: "Sauvetage in extremis"
                        },
                        {
                            description: "Tu as résolu 3 réponses d'affilée sans te faire attraper.",
                            meta: data["streak"],
                            purpose: "Devine 3 réponses d'affilée sans perdre une partie. Reste régulier, tu trouveras ton rythme.",
                            tag: "streak",
                            title: "Série de survie"
                        },
                        {
                            description: "Tu as démantelé une énigme énorme avant que la trappe ne s'ouvre.",
                            meta: data["slayer"],
                            purpose: "Devine une réponse de 10 lettres ou plus. Les gros défis apportent de grandes satisfactions.",
                            tag: "slayer",
                            title: "Tueur de géants"
                        }
                    ],
                    description: "Pour des moments spéciaux, des suppositions malines et des coups parfaits.",
                    type: "découvertes",
                }
            ];
        }
    },
    categories: categoryList.fr,
    credit_sections: [
        {
            content: "<p id='intro-content'>Ce petit jeu du Pendu a été conçu par un développeur solo qui aime les jeux de lettres et le web ouvert. Il est né d’un défi Frontend Mentor et a grandi avec quelques touches personnelles.</p>",
            desc: "intro-content",
            id: "intro",
            title: "Introduction"
        },
        {
            content: "<p id='author-content'>Développé avec soin par Ndimah Tchougoua (jay-ike). J’espère qu’il t’apportera un peu de plaisir ou au moins une façon sympa de passer le temps.</p>",
            desc: "author-content",
            id: "author",
            title: "À propos de l'auteur"
        },
        {
            content: "<p id='thanks-content'>Merci à la communauté open source et à tous ceux qui partagent des ressources gratuites. Vous rendez le web plus chaleureux.</p>",
            desc: "thanks-content",
            id: "thanks",
            title: "Remercients"
        }
    ],
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
            description: "Choisis un thème comme Animaux ou Films. Un mot secret sera choisi et affiché avec des tirets pour chaque lettre.",
            "number": "01",
            title: "Choisis une catégorie"
        },
        {
            description: "Choisis ton niveau de défi. Les difficultés avancées et les niveaux se débloquent en jouant.",
            "number": "02",
            title: "Choisis la difficulté"
        },
        {
            description: "Appuie sur les lettres pour les révéler dans les cases. Les bonnes réponses remplissent les tirets, et les mauvaises te font perdre des cœurs.",
            "number": "03",
            title: "Devine les lettres"
        },
        {
            description: "Trouve toutes les lettres avant de perdre tous tes cœurs pour gagner. Sinon, c'est le game over !",
            "number": "04",
            title: "Gagne ou perds"
        }
    ],
    site_image: {
        alt: "une capture d'écran de la page d'accueil du jeu du pendu montrant comment jouer",
        description: "Essayez de deviner ce qui est caché jusqu'à ce que vous n'ayez plus de cœurs. N'ayez pas peur, je sais que vous pouvez y arriver.",
        height: 630,
        name: "Jeu du pendu",
        src: "https://ike-hangman-game.vercel.app/assets/images/menu-fr-og-image.png",
        title: "Le jeu du pendu. Sauras-tu le deviner ?",
        width: 1200
    }
});
