/* Textes des Gelées (Jellies on the Run) en espagnol et en portugais du Brésil (5 oct. 2026). Chargé avant game.js.
   La clé est le texte français du code : celui des C.tr('…') et le « fr » des objets { fr, en } (zones, nouveautés, aides, crédits).
   Un texte absent retombe sur l'anglais. Vérification : `node jeux/tools/langues.js`.
   Vocabulaire : gelée = gelatina ; trappe = salida / saída ; bac = caja / caixa ; caisse = cajón / caixote. */
(function (C) {
  C.i18n({
    // en jeu
    'niveau {n} · {s}': 'nivel {n} · {s}', 'IN EXTREMIS !': '¡POR LOS PELOS!', 'TROP LARGE !': '¡NO CABE!', 'SORTIES !': '¡TODAS FUERA!', 'FONDUE !': '¡DERRETIDA!', 'FONDU !': '¡DERRETIDO!',
    'CHALEUR': 'CALOR', 'Gelées': 'Gelatinas', 'Glisse chaque gelée jusqu’à la trappe de sa couleur': 'Desliza cada gelatina hasta la salida de su color', 'Vite, avant que ça fonde !': '¡Rápido, antes de que se derritan!',
    'Une gelée a fondu en plein soleil': 'Una gelatina se derritió al sol', 'Trop chaud, les gelées ont fondu': 'Demasiado calor: las gelatinas se derritieron', 'Mets-la à l’ombre ou sors-la plus tôt': 'Ponla a la sombra o sácala antes',
    'Touche une gelée': 'Toca una gelatina', 'GEL {s} s': 'HIELO {s} s', 'GELÉ': 'CONGELADO', '+ GLAÇONS · continuer (+{s} s)': '+ HIELO · continuar (+{s} s)',
    // zones
    'Fraise': 'Fresa', 'Myrtille': 'Arándano', 'Pomme': 'Manzana', 'Citron': 'Limón', 'Cassis': 'Grosella', 'Orange': 'Naranja',
    // nouveautés
    'Bac biscornu': 'Caja irregular', 'Le bac change de forme : des murs barrent le passage. À toi de les contourner.': 'La caja cambia de forma: hay muros que cortan el paso. Te toca rodearlos.',
    'Gelée glacée': 'Gelatina congelada', 'Elle est prise dans la glace ! Fais sortir d’autres gelées pour la libérer : le chiffre dit combien.': '¡Está atrapada en el hielo! Saca otras gelatinas para liberarla: el número dice cuántas.',
    'Gelée à deux couches': 'Gelatina de dos capas', 'Amène-la d’abord à la trappe de sa couleur extérieure : la couche part. Puis à la trappe de la couleur du cœur.': 'Llévala primero a la salida de su color exterior: la capa se va. Después, a la salida del color de su centro.',
    'Grand bac': 'Caja grande', 'Plus de place, plus de gelées : le bac s’agrandit et les gelées rapetissent.': 'Más espacio, más gelatinas: la caja crece y las gelatinas encogen.',
    'Caisse mystère': 'Cajón misterioso', 'Une gelée se cache dans la caisse. Elle s’ouvre quand assez de gelées sont sorties : le chiffre dit combien.': 'Una gelatina se esconde en el cajón. Se abre cuando han salido suficientes gelatinas: el número dice cuántas.',
    // aides
    'Glaçons': 'Cubitos de hielo', 'Arrête la chaleur pendant 10 secondes et rafraîchit toutes les gelées.': 'Detiene el calor durante 10 segundos y refresca todas las gelatinas.',
    'Cuillère': 'Cuchara', 'Touche une gelée : elle saute dans l’assiette.': 'Toca una gelatina: salta al plato.',
    'Louche': 'Cucharón', 'Touche une gelée : toutes celles de sa couleur sautent dans l’assiette.': 'Toca una gelatina: todas las de su color saltan al plato.',
    // crédits (réglages)
    'Musique : Kevin MacLeod (incompetech.com), licence CC BY 4.0 · Bruitages : Kenney (kenney.nl)': 'Música: Kevin MacLeod (incompetech.com), licencia CC BY 4.0 · Sonidos: Kenney (kenney.nl)',
  }, 'es');
  C.i18n({
    // en jeu
    'niveau {n} · {s}': 'nível {n} · {s}', 'IN EXTREMIS !': 'POR UM TRIZ!', 'TROP LARGE !': 'NÃO CABE!', 'SORTIES !': 'TODAS FORA!', 'FONDUE !': 'DERRETEU!', 'FONDU !': 'DERRETEU!',
    'CHALEUR': 'CALOR', 'Gelées': 'Gelatinas', 'Glisse chaque gelée jusqu’à la trappe de sa couleur': 'Deslize cada gelatina até a saída da sua cor', 'Vite, avant que ça fonde !': 'Rápido, antes que derretam!',
    'Une gelée a fondu en plein soleil': 'Uma gelatina derreteu no sol', 'Trop chaud, les gelées ont fondu': 'Calor demais: as gelatinas derreteram', 'Mets-la à l’ombre ou sors-la plus tôt': 'Coloque na sombra ou tire antes',
    'Touche une gelée': 'Toque em uma gelatina', 'GEL {s} s': 'GELO {s} s', 'GELÉ': 'CONGELADO', '+ GLAÇONS · continuer (+{s} s)': '+ GELO · continuar (+{s} s)',
    // zones
    'Fraise': 'Morango', 'Myrtille': 'Mirtilo', 'Pomme': 'Maçã', 'Citron': 'Limão', 'Cassis': 'Cassis', 'Orange': 'Laranja',
    // nouveautés
    'Bac biscornu': 'Caixa irregular', 'Le bac change de forme : des murs barrent le passage. À toi de les contourner.': 'A caixa muda de forma: paredes bloqueiam o caminho. Dê a volta nelas.',
    'Gelée glacée': 'Gelatina congelada', 'Elle est prise dans la glace ! Fais sortir d’autres gelées pour la libérer : le chiffre dit combien.': 'Ela está presa no gelo! Tire outras gelatinas para libertá-la: o número diz quantas.',
    'Gelée à deux couches': 'Gelatina de duas camadas', 'Amène-la d’abord à la trappe de sa couleur extérieure : la couche part. Puis à la trappe de la couleur du cœur.': 'Leve primeiro até a saída da cor de fora: a camada sai. Depois, até a saída da cor do miolo.',
    'Grand bac': 'Caixa grande', 'Plus de place, plus de gelées : le bac s’agrandit et les gelées rapetissent.': 'Mais espaço, mais gelatinas: a caixa cresce e as gelatinas encolhem.',
    'Caisse mystère': 'Caixote misterioso', 'Une gelée se cache dans la caisse. Elle s’ouvre quand assez de gelées sont sorties : le chiffre dit combien.': 'Uma gelatina se esconde no caixote. Ele abre quando saem gelatinas suficientes: o número diz quantas.',
    // aides
    'Glaçons': 'Cubos de gelo', 'Arrête la chaleur pendant 10 secondes et rafraîchit toutes les gelées.': 'Para o calor por 10 segundos e refresca todas as gelatinas.',
    'Cuillère': 'Colher', 'Touche une gelée : elle saute dans l’assiette.': 'Toque em uma gelatina: ela pula para o prato.',
    'Louche': 'Concha', 'Touche une gelée : toutes celles de sa couleur sautent dans l’assiette.': 'Toque em uma gelatina: todas as da mesma cor pulam para o prato.',
    // crédits (réglages)
    'Musique : Kevin MacLeod (incompetech.com), licence CC BY 4.0 · Bruitages : Kenney (kenney.nl)': 'Música: Kevin MacLeod (incompetech.com), licença CC BY 4.0 · Sons: Kenney (kenney.nl)',
  }, 'pt');
})(window.Core);
