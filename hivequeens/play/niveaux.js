/* Niveaux de Hive Queens, fabriqués par `node jeux/tools/reines-niveaux.js` : ne pas modifier à la main.
   Un niveau par ligne : n (côté), z (zones, une lettre par case, ligne par ligne), d (score de difficulté), r (raisonnement le plus dur : 1 à 3), h (niveau difficile).
   NIVEAUX_DECILES : pour chaque taille, les scores des déciles de sa réserve (du plus facile au plus dur) ; le jeu s'en sert pour viser une difficulté
   quand il fabrique lui-même une grille (grille du jour, niveaux après le dernier de ce fichier). */
window.NIVEAUX_DECILES = {"4":[4,4,4,4,4,6,11,19,28,32,43],"5":[5,5,5,5,8,11,14,18,24,31,55],"6":[6,6,6,8,10,14,18,22,30,40,73],"7":[7,7,9,13,15,20,25,32,38,48,75],"8":[8,10,12,15,19,23,29,34,41,51,80],"9":[9,12,15,19,23,27,32,36,42,54,100],"10":[10,14,18,21,25,30,34,40,48,60,137]};
window.NIVEAUX = [
{n:4,z:"AABBCAADAAADAAAD",d:4,r:1},
{n:4,z:"ABBBABBCADDDADDD",d:4,r:1},
{n:5,z:"AAABBCADEBCADBBCDDBBDDDDD",d:5,r:1},
{n:5,z:"ABBBCDDCBCDDCCCEEEECEEEEC",d:5,r:1},
{n:5,z:"AAAABAACCBADBBBADBBBADBEB",d:5,r:1},
{n:5,z:"AAAAABACDDECCDDEEEDDEEEDD",d:5,r:1},
{n:5,z:"AABBCADBBCAABBBAAAEBAEEEB",d:5,r:1},
{n:5,z:"ABAAAAAAAACDDAACEEEAEEEEE",d:5,r:1},
{n:6,z:"ABBCCCABBDCCAAAECCEAEECCEEEEEEEEEFFE",d:6,r:1},
{n:6,z:"AAABCCAAACCCAAAADCAAADDDEAAFDDEEFFFF",d:14,r:2,h:1},
{n:6,z:"AAAAAAAABAACAABBBBADBBBBDDDBEBDDFBBB",d:6,r:1},
{n:6,z:"AAAAAAAABBACCCCCACDCDCCCDDDEFCFFFFFC",d:6,r:1}
];
