/* JEU « ÉCRIN » / Jewel Box (produit, 30 sept. 2026) : copie du proto 2 (prototypes/02-vis-couleurs, figé pour les clips) branchée sur la
   coquille (engine/shell.js) : la fin du final ouvre l'écran de résultat au lieu de baisser le rideau et d'enchaîner, chaque blocage
   (proposition de secours, puis perdu) est compté comme échec, la coquille lance les niveaux et règle la musique. Étoiles : celles du
   proto (usage du présentoir). Le kit de tournage ne s'active que par l'URL (carte de fin coupée par défaut, ?endcard=1).
   Proto 2 — Écrin (mécanique type Screwdom / Screw Jam, habillage bijouterie)
   Des tablettes de nacre empilées sont tenues par des gemmes serties. Tape une gemme visible pour la dessertir :
   elle rejoint l'écrin de sa couleur (3 gemmes = écrin fermé) ou le présentoir d'attente.
   Une tablette sans gemme tombe et révèle celles du dessous.
   Chaque niveau généré est vérifié : la politique du bot doit pouvoir le finir sans blocage, sinon on regénère.
   Touches : C mode clip (niveau court ~25 s quel que soit le niveau), B couper la musique.
   ?clip dans l'URL démarre en mode clip, ?mute sans son. */
(function (global) {
  const C = Core;
  const { W, H, ctx, ease, rand, randi, pick, lerp, clamp, dist, shuffle, shade, rgba, roundRect, text, bot } = Core;
  const href = String(window.location && window.location.href);
  // textes affichés en anglais avec ?lang=en (22 sept. 2026, campagne en anglais) : le code garde le français, C.tr traduit à l'affichage
  const tr = C.tr;
  C.i18n({
    'ÉCRIN': 'JEWEL BOX', 'NIVEAU {n}': 'LEVEL {n}', 'NIVEAU {n}  ·  RÉUSSI': 'LEVEL {n}  ·  CLEARED', '+1 PLACE': '+1 SLOT', 'PRÉSENTOIR AU MAXIMUM': 'TRAY AT ITS MAX', 'PRÉSENTOIR DÉJÀ VIDE': 'TRAY ALREADY EMPTY', 'PRÉSENTOIR VIDÉ': 'TRAY EMPTIED', 'TOUCHE UNE PIÈCE': 'TAP A PIECE', 'PLEIN !': 'FULL!', 'COMPLET !': 'COMPLETE!',
    'BLOQUÉ !': 'STUCK!', 'On recommence…': 'Try again…', 'À SUIVRE': 'UP NEXT', 'PRÉSENTOIR PLEIN': 'TRAY FULL', 'Une place de plus pour continuer ?': 'One more slot to keep going?',
    '✦  +1 PLACE  ✦': '✦  +1 SLOT  ✦', 'offert': 'free', 'Touche une gemme : elle rejoint l’écrin de sa couleur': 'Tap a gem: it goes to the box of its color', 'IL FAUT LA CLÉ': 'FIND THE KEY', 'DÉVERROUILLÉ !': 'UNLOCKED!',
  });

  // gemmes : rubis, saphir, émeraude, améthyste, topaze, aigue-marine, quartz rose (7 oct. 2026 : émeraude plus verte et aigue-marine plus claire, on les confondait)
  const COLORS = ['#E5173F', '#2E6BFF', '#22B83C', '#9A5CF0', '#FFC233', '#45DCFF', '#FF6FD0'];
  // tablettes : nacres et laques franchement teintées (rose, menthe, ciel, lilas, champagne, lagon, pêche…) : plus de couleur à l'écran qu'avec du blanc cassé
  const PLATE_COLORS = ['#F7B9C8', '#A9E4C8', '#A8CBF7', '#CDB4F5', '#F6DC8C', '#9FE3DC', '#F9C49E', '#B9C2F2', '#F3A9D8', '#C8E89A'];
  const SERIF = 'Georgia, "Times New Roman", serif';
  const GOLD = '#d8ad42', GOLD_LIGHT = '#fff0b8', GOLD_DARK = '#8a5f14', CREAM = '#f3e9cf';
  // MISE EN PAGE (8 oct. 2026) : plus de titre pendant la partie ; le numéro du niveau et la vitrine montent tout en haut, le plateau gagne 213 de haut
  // et le présentoir et les écrins descendent jusqu'au-dessus de la rangée des aides (coquille, y 1852). Les objets, dessinés dans un carré de 980,
  // sont agrandis à la mesure du plateau au début du niveau (zoomLevel).
  const BOARD = { x: 50, y: 222, w: 980, h: 1193 };
  const LEVEL_Y = 110;   // numéro du niveau et étoiles
  const SCREW_R = 52;   // gemmes grosses : ce sont elles qu'on doit voir sur un téléphone
  const BOX_Y = 1675, BOX_W = 340, BOX_H = 210, BOX_X = [190, 540, 890];
  const BUF_Y = 1505, BUF_N = 5;
  // taille réelle du présentoir (le secours « +1 place » l'agrandit pour le niveau en cours) et sa géométrie
  let bufN = BUF_N, rescued = false;
  // style du bot (touche P) : 0 parfait, 1 humain, 2 suspense (remplit le présentoir jusqu'au rouge puis se sauve en rafale), 3 suspense raté (se bloque près de la fin)
  const BOT_STYLES = ['bot parfait', 'bot humain (hésite, se trompe)', 'bot suspense (frôle le blocage)', 'bot suspense raté (bloqué près de la fin)'];
  let botStyle = +(/[?&#]bot=(\d)/.exec(String(window.location && window.location.href)) || [0, 0])[1] % 4, drama = null, hbT = 0;   // ?bot=2 dans l'URL : démarre en bot suspense
  // MODE TOURNAGE (touche T, ou ?film dans l'URL) : TikTok / Instagram recouvrent le haut (onglets), le quart bas (légende) et une bande à droite (boutons).
  // Le jeu gère son cadrage : décor plein écran sans titre ni signature, et le contenu utile (niveau, plateau, présentoir, écrins) agrandi au maximum dans la zone sûre.
  let film = /[?&#]film/.test(String(window.location && window.location.href));
  const FILM = { s: .76, ox: 55, oy: 110 };   // contenu (accroche à 40, écrins jusqu'à 1785) dans la zone sûre : x 0 à 930, y 140 à 1465
  const toGame = (x, y) => film ? [(x - FILM.ox) / FILM.s, (y - FILM.oy) / FILM.s] : [x, y];
  const toScreen = (x, y) => film ? [x * FILM.s + FILM.ox, y * FILM.s + FILM.oy] : [x, y];
  // file d'écrins du niveau (couleurs), index du prochain à ouvrir, nombre d'écrins ouverts, plan du solveur suivi par le bot parfait, mesure de difficulté
  let queue = [], queueC = [], queueIdx = 0, openN = 3, plan = null, planIdx = 0, levelDiff = null;
  const boxX = i => (openN === 3 ? [190, 540, 890] : [365, 715])[i];
  const bufSp = () => bufN <= 5 ? 140 : bufN === 6 ? 118 : 104, bufX0 = () => W / 2 - (bufN - 1) * bufSp() / 2;
  const RESCUE_BTN = { x: W / 2, y: H / 2 + 70, w: 380, h: 96 };
  const CLIP = { colorsN: 4, perColor: 6, K: 3, T: 5, target: 2, riders: 2 };   // mode clip : 24 gemmes, 3 écrins, présentoir 5, difficulté moyenne (le glouton doit échouer)
  // clip du bot suspense : plus de couleurs que d'écrins ouverts, pour que beaucoup de gemmes n'aient pas d'écrin et que le présentoir puisse monter au rouge
  const CLIP_DRAMA = { colorsN: 6, perColor: 3, K: 2, T: 5, target: 3, riders: 2 };   // 18 gemmes, 2 écrins ouverts : ~22 s de jeu + final
  const CLIP_FAIL = { colorsN: 5, perColor: 6, K: 2, T: 5, target: 3, riders: 2 };    // style raté : 30 gemmes, le temps d'un premier sauvetage avant le coup de trop
  // TEXTES D'ACCROCHE (touche X pour passer au suivant, ?hook=N dans l'URL) : affichés à la place de l'en-tête, pour tester plusieurs accroches sur le même
  // gameplay. « | » = retour à la ligne, {n} = numéro du niveau affiché (?level=47 dans l'URL : numéro fixe, comme dans les autres protos). À modifier librement.
  const HOOKS = C.byLang({
    fr: [
      'Niveau {n}|3 % des joueurs y arrivent',
      'Une seule erreur|et c\'est fini',
      'Je bloque sur ce niveau|depuis 3 jours…',
      'Personne ne le finit|sans remplir le présentoir',
      'Regarde jusqu\'à la fin',
      'Le son de ce jeu|est trop satisfaisant',
    ],
    en: [
      'Level {n}|only 3% of players beat it',
      'One single mistake|and it’s over',
      'Stuck on this level|for 3 days now…',
      'Nobody beats it|without filling the tray',
      'Watch till the end',
      'The sound of this game|is so satisfying',
    ],
  });
  const shownLevel = () => C.KIT.fakeLevel || level;   // ?level=47 : numéro AFFICHÉ, fixe (comme dans les autres protos) ; le vrai compteur de niveaux reste `level`
  let hookIdx = Math.min(HOOKS.length, +((/[?&#]hook=(\d+)/.exec(href) || [])[1] || 0));   // 0 = pas d'accroche
  // MODE BOUCLE (touche L, ?loop dans l'URL) : pour un clip qui boucle sans couture. Le niveau terminé, pas de rideau : coupe franche pendant la révélation
  // de la constellation et le MÊME niveau redémarre à l'identique (mêmes tablettes, même première gemme). Au montage : couper d'un redémarrage au suivant,
  // la dernière image s'enchaîne sur la première. L deux fois (ou changer de bot / de mode clip) tire un nouveau niveau.
  let loopMode = /[?&#]loop/.test(href), loopSpec = null;
  const GEN_TRIES = 150;                        // candidats max par niveau (solvable, peu profond, difficulté cible)
  const STARS = Array.from({ length: 60 }, () => ({ x: rand(W), y: rand(H), r: rand(1, 2.6), ph: rand(Math.PI * 2), sp: rand(.6, 1.8) }));

  let objet = null, gemK = 1;   // l'objet du niveau (objets.js) et la taille de ses gemmes sur le plateau (1 = normale ; plus petites sur les gros objets)
  let plates, screws, boxes, buffer, leaving, level = 1, state, total, boxed, colorsN, tm = 0, playable = new Set(), readyBoxes = new Set();
  // progression mesurable : vitrine des écrins fermés, mosaïque qui s'allume, étoiles selon l'usage du présentoir
  let shelf = [], flyers = [], trayUses = 0, litPrev = 0, starsPrev = 3;
  // fin de niveau : ralenti sur la dernière gemme, final, rideau de velours entre deux niveaux
  let slowGem = null, finale = null; const curtain = { v: 0 };
  let levelStart = 0;   // coquille : tm au début du niveau (temps affiché sur l'écran de résultat)
  const FINALE_DUR = 2.7;
  const SHELF_Y = 160;
  const shelfN = () => Math.round(total / 3);
  const shelfPos = i => { const n = shelfN(), sw = Math.min(64, 640 / n); return { x: W / 2 - (n - 1) * sw / 2 + i * sw, y: SHELF_Y, sw }; };
  // ÉTOILES (8 oct. 2026) : on en perd en passant par le présentoir, mais à partir du minimum que le niveau impose. Les niveaux sont choisis pour
  // obliger à s'en servir : avec un seuil fixe (un passage pour douze gemmes), beaucoup de niveaux ne pouvaient pas être finis à trois étoiles, même
  // sans une erreur (le robot parfait finissait à une étoile sur neuf niveaux essayés sur vingt-quatre).
  //   par : passages par le présentoir de la solution du solveur (une bonne partie, pas forcément la meilleure) ;
  //   trois étoiles jusqu'à par + un passage pour douze gemmes, deux étoiles jusqu'à par + un pour cinq, une étoile au-delà.
  let par = 0;
  const starMargin = k => Math.ceil(total / (k === 3 ? 12 : 5));
  const starsNow = () => trayUses <= par + starMargin(3) ? 3 : trayUses <= par + starMargin(2) ? 2 : 1;
  const starLeft = () => { const st = starsNow(); return st > 1 ? par + starMargin(st) - trayUses : -1; };   // passages encore permis avant de perdre une étoile
  let sky = null;   // les lumières du décor de la zone : { name, stars: [{x, y, out, lit, litAt}], edges }
  const starGlow = i => clamp(boxed / total * sky.stars.length - i, 0, 1);   // chaque gemme rangée fait grandir l'étoile suivante
  // DÉCORS DE ZONE (7 oct. 2026) : une zone qui a son décor (jeux/ecrin/decors/<img>.webp, généré d'après jeux/art/prompts-decors-ecrin.md) le montre à
  // la place du velours, du lambrequin et du comptoir de marbre, : ce sont les joyaux du décor qui s'allument un à un à
  // mesure que les gemmes sont rangées (lights, du premier allumé au dernier), puis flamboient au final, où s'écrit le nom de l'objet.
  //   cut, top : l'image est posée en deux bandes. Sa partie haute (jusqu'à la fraction cut de sa hauteur : l'eau, le ciel…) est étirée de 0 à top, le
  //              reste va de top au bas de l'écran : le sommet de l'arche passe ainsi sous le bord du plateau au lieu de tomber sur le numéro du niveau.
  //   dim      : voile sombre sur la partie du décor qui sert de fond au plateau (l'objet doit rester lisible)
  //   lights   : [x, y] en points de jeu (1080 × 1920), relevés sur l'image une fois posée
  const DECORS = {
    mer: { img: 'mer', cut: .109, top: 192, dim: .48,
      lights: [[148, 1785], [720, 1813], [347, 1820], [1015, 1798], [1004, 1470], [87, 1200], [931, 1249], [129, 989], [939, 954], [145, 645], [939, 636], [270, 340], [816, 340], [541, 237]] },
    // les quatorze autres (8 oct. 2026) : cut = sommet de l'arche relevé sur l'image, lumières = les points les plus brillants de l'arche et du sol,
    // hors de ce que cachent le présentoir et les écrins
    joyaux: { img: 'joyaux', cut: .109, top: 192, dim: .48,
      lights: [[836, 1816], [192, 1800], [336, 1800], [708, 1800], [68, 1444], [1024, 1428], [52, 1140], [1024, 1140], [52, 976], [1024, 912], [52, 808], [1024, 760], [1016, 444], [48, 372], [600, 256]] },
    bijoux: { img: 'bijoux', cut: .109, top: 192, dim: .48,
      lights: [[964, 1856], [248, 1852], [432, 1800], [720, 1800], [88, 1556], [1020, 1556], [176, 1180], [904, 1180], [40, 928], [1036, 928], [68, 624], [1012, 624], [128, 440], [948, 440], [548, 244]] },
    jardin: { img: 'jardin', cut: .113, top: 192, dim: .48,
      lights: [[232, 1844], [760, 1812], [464, 1800], [1016, 1800], [1008, 1556], [132, 1504], [220, 1356], [908, 1324], [956, 888], [164, 864], [952, 688], [180, 584], [260, 436], [840, 400], [440, 288]] },
    campagne: { img: 'campagne', cut: .114, top: 192, dim: .48,
      lights: [[824, 1868], [256, 1844], [376, 1836], [544, 1828], [84, 1556], [1004, 1536], [964, 1360], [172, 1268], [120, 1088], [968, 1040], [116, 804], [920, 708], [864, 520], [88, 348], [620, 204]] },
    gourmandises: { img: 'gourmandises', cut: .12, top: 192, dim: .48,
      lights: [[628, 1844], [784, 1844], [296, 1824], [496, 1800], [72, 1452], [1008, 1444], [224, 1392], [1036, 1208], [1036, 1040], [112, 912], [984, 780], [72, 664], [832, 508], [72, 336], [540, 256]] },
    palais: { img: 'palais', cut: .121, top: 192, dim: .48,
      lights: [[632, 1836], [448, 1820], [780, 1804], [92, 1800], [108, 1480], [1000, 1476], [104, 1360], [992, 1356], [172, 896], [884, 884], [56, 712], [1020, 708], [164, 500], [736, 308], [536, 204]] },
    musique: { img: 'musique', cut: .116, top: 192, dim: .48,
      lights: [[336, 1864], [644, 1864], [796, 1860], [188, 1856], [76, 1520], [1036, 1516], [992, 1404], [96, 1388], [56, 904], [1020, 904], [920, 768], [180, 604], [960, 560], [100, 300], [544, 212]] },
    jungle: { img: 'jungle', cut: .122, top: 192, dim: .48,
      lights: [[484, 1860], [1008, 1860], [776, 1836], [248, 1816], [140, 1480], [1004, 1464], [892, 1372], [172, 1364], [172, 1104], [956, 1052], [188, 656], [964, 644], [72, 560], [808, 336], [540, 240]] },
    voyage: { img: 'voyage', cut: .109, top: 192, dim: .48,
      lights: [[904, 1812], [732, 1804], [264, 1800], [396, 1800], [120, 1500], [1008, 1464], [812, 1416], [172, 1376], [916, 1056], [100, 948], [972, 736], [164, 700], [936, 524], [228, 432], [604, 212]] },
    merveilles: { img: 'merveilles', cut: .122, top: 192, dim: .48,
      lights: [[780, 1868], [516, 1860], [268, 1816], [676, 1808], [1004, 1456], [76, 1436], [984, 1288], [164, 1168], [108, 984], [996, 980], [68, 836], [876, 760], [804, 388], [116, 308], [624, 236]] },
    maison: { img: 'maison', cut: .152, top: 192, dim: .48,
      lights: [[284, 1852], [784, 1816], [472, 1804], [600, 1804], [96, 1556], [1008, 1424], [156, 1400], [860, 1300], [196, 1136], [856, 932], [212, 756], [864, 752], [760, 332], [316, 328], [540, 228]] },
    contes: { img: 'contes', cut: .13, top: 192, dim: .48,
      lights: [[760, 1844], [108, 1840], [952, 1824], [356, 1800], [96, 1512], [1000, 1488], [828, 1300], [164, 1184], [1012, 1096], [52, 1076], [56, 856], [968, 832], [868, 472], [212, 300], [536, 264]] },
    fetes: { img: 'fetes', cut: .116, top: 192, dim: .48,
      lights: [[844, 1844], [404, 1820], [88, 1800], [660, 1800], [1000, 1532], [80, 1508], [956, 1356], [244, 1344], [120, 940], [960, 936], [168, 796], [992, 776], [104, 524], [976, 524], [544, 228]] },
    curiosites: { img: 'curiosites', cut: .11, top: 192, dim: .48,
      lights: [[424, 1884], [736, 1832], [960, 1816], [288, 1800], [148, 1556], [1000, 1432], [332, 1368], [816, 1368], [968, 956], [108, 928], [40, 656], [1036, 656], [76, 448], [940, 436], [532, 232]] },
  };
  let decor = null, decorBg = null, decorBoard = null; const decorImgs = {};
  function decorImage(d) {   // l'image du décor, chargée à la première demande ; null tant qu'elle n'est pas arrivée (le velours la remplace)
    if (typeof Image === 'undefined') return null;
    const im = decorImgs[d.img] || (decorImgs[d.img] = Object.assign(new Image(), { src: 'decors/' + d.img + '.webp' }));
    return im.complete && im.naturalWidth ? im : null;
  }
  // le décor posé une fois hors écran : le fond plein écran, et la partie qui passe sous le plateau, assombrie et arrondie comme lui
  function buildDecor(im, d) {
    const bg = offscreen(W, H); if (!bg) return;
    const c = bg.getContext('2d'), iw = im.naturalWidth, ih = im.naturalHeight, cut = Math.round(d.cut * ih);
    c.drawImage(im, 0, 0, iw, cut, 0, 0, W, d.top + 2); c.drawImage(im, 0, cut, iw, ih - cut, 0, d.top, W, H - d.top);
    const g = c.createLinearGradient(0, 0, 0, 210); g.addColorStop(0, 'rgba(8,9,28,.8)'); g.addColorStop(.6, 'rgba(8,9,28,.55)'); g.addColorStop(1, 'rgba(8,9,28,0)'); c.fillStyle = g; c.fillRect(0, 0, W, 210);   // le numéro du niveau reste lisible
    const bx = BOARD.x - 20, by = BOARD.y - 20, bw = BOARD.w + 40, bh = BOARD.h + 40, b = offscreen(bw, bh), o = b.getContext('2d');
    o.beginPath(); o.roundRect(0, 0, bw, bh, 40); o.clip(); o.drawImage(bg, bx, by, bw, bh, 0, 0, bw, bh);
    o.fillStyle = 'rgba(10,11,40,' + d.dim + ')'; o.fillRect(0, 0, bw, bh);
    decorBg = bg; decorBoard = b;
  }
  const decorReady = () => { if (!decor) return null; if (!decorBg) { const im = decorImage(decor); if (im) buildDecor(im, decor); } return decorBg ? decor : null; };
  // au début du niveau : le décor et la musique de la zone de l'objet ; les lumières du décor prennent la place des lumières du décor
  function zoneLook() {
    const d = DECORS[objet.z] || null;
    if (d !== decor) { decor = d; decorBg = decorBoard = null; }
    theme = THEMES[objet.z] || THEMES.base;
    if (!d) return;
    decorImage(d);
    const inBoard = (x, y) => x > BOARD.x - 20 && x < BOARD.x + BOARD.w + 20 && y > BOARD.y - 20 && y < BOARD.y + BOARD.h + 20;
    sky = { name: C.byLang(objet.name), decor: true, edges: [], stars: d.lights.map(([x, y]) => ({ x, y, out: !inBoard(x, y), lit: false, litAt: 0, ph: rand(Math.PI * 2) })) };
  }
  let clip = /[?&#]clip/.test(href), genTries = 0;
  const live = () => ({ plates, screws, boxes, buffer });   // l'état réel, au format attendu par la politique

  // ------------------------------------------------------------ audio : boîte à musique + bruitages cristallins
  let A = null, musBus = null, musicOn = !/[?&#]nomusic/.test(href), nextStep = 0, stepIdx = 0;
  const BPM = 72, BEAT = 60 / BPM, STEP = BEAT / 2;
  const mid = m => 440 * Math.pow(2, (m - 69) / 12);
  // ré majeur, 8 mesures : D · Bm · G · A · D · F#m · G · A (notes MIDI des accords)
  const CHORDS = [[62, 66, 69], [59, 62, 66], [55, 59, 62], [57, 61, 64], [62, 66, 69], [54, 57, 61], [55, 59, 62], [57, 61, 64]];
  // arpège de croches (indices dans l'accord, 3 = fondamentale à l'octave), un motif par phrase de 8 mesures
  const ARP = [[0, 1, 2, 3, 2, 1, 0, 1], [0, 2, 1, 3, 0, 2, 3, 1]];
  // mélodie de boîte à musique : deux phrases, une mesure jouée sur deux pour laisser respirer
  const MELODY = [
    [74, 0, 76, 0, 78, 0, 81, 0], null, [78, 0, 76, 0, 74, 0, 0, 0], null, [74, 0, 78, 0, 81, 0, 83, 0], null, [81, 0, 78, 0, 76, 0, 74, 0], null,
    [81, 0, 83, 0, 86, 0, 83, 0], null, [81, 0, 78, 0, 81, 0, 0, 0], null, [78, 0, 81, 0, 83, 0, 86, 0], null, [83, 0, 81, 0, 78, 0, 74, 0], null];
  // MUSIQUE DE ZONE : même boîte à musique, autre grille, autre arpège et autre mélodie ; wave : une vague (souffle filtré) toutes les deux mesures
  const THEMES = {
    base: { chords: CHORDS, arp: ARP, melody: MELODY },
    // la mer, en sol majeur : G · Bm · C · D · Em · C · Am · D, arpège qui monte et redescend comme la houle, mélodie en longues notes
    mer: { wave: true,
      chords: [[55, 59, 62], [59, 62, 66], [60, 64, 67], [57, 62, 66], [55, 59, 64], [55, 60, 64], [57, 60, 64], [57, 62, 66]],
      arp: [[0, 1, 2, 3, 2, 1, 2, 1], [0, 2, 3, 2, 1, 2, 3, 2]],
      melody: [
        [79, 0, 0, 74, 0, 76, 0, 0], null, [78, 0, 0, 74, 0, 71, 0, 0], null, [76, 0, 79, 0, 0, 83, 0, 0], null, [81, 0, 0, 78, 0, 74, 0, 0], null,
        [83, 0, 0, 79, 0, 81, 0, 0], null, [79, 0, 76, 0, 0, 72, 0, 0], null, [76, 0, 0, 71, 0, 67, 0, 0], null, [72, 0, 0, 76, 0, 81, 0, 0], null] },
  };
  let theme = THEMES.base, noiseBuf = null;
  // une vague : souffle dont le filtre s'ouvre puis se referme, très bas sous la musique
  function wave(t, dur) {
    if (!noiseBuf) { noiseBuf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = A.createBufferSource(), lp = A.createBiquadFilter(), g = A.createGain(); src.buffer = noiseBuf; src.loop = true; lp.type = 'lowpass'; lp.Q.value = .6;
    lp.frequency.setValueAtTime(220, t); lp.frequency.linearRampToValueAtTime(900, t + dur * .42); lp.frequency.linearRampToValueAtTime(240, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.05, t + dur * .42); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(musBus); src.start(t); src.stop(t + dur + .05);
  }
  function ensureMusic() {
    const au = C.audio(); if (!au.ctx || A) return; A = au.ctx;
    musBus = A.createGain(); musBus.gain.value = musicOn ? 1 : 0;
    // délai à la croche pointée, filtré : l'espace d'une boîte à musique dans une pièce
    const dly = A.createDelay(1), fb = A.createGain(), lp = A.createBiquadFilter(), send = A.createGain(), out = A.createGain();
    dly.delayTime.value = STEP * 1.5; fb.gain.value = .3; lp.type = 'lowpass'; lp.frequency.value = 3000; send.gain.value = .3; out.gain.value = .8;
    musBus.connect(out); musBus.connect(send); send.connect(dly); dly.connect(lp); lp.connect(fb); fb.connect(dly); lp.connect(out); out.connect(au.master);
    nextStep = A.currentTime + .05; stepIdx = 0;
    trackGain = A.createGain(); trackGain.gain.value = musicOn ? trackVol() : 0; trackGain.connect(au.master);   // la musique enregistrée (sans l'écho de la boîte à musique)
  }
  // timbre boîte à musique / célesta : fondamentale + partiels qui s'éteignent plus vite
  function bell(f, { t = 0, vol = .15, dur = 1.4, dest = null } = {}) {
    if (!A) return; const t0 = t || A.currentTime, D = dest || C.audio().master;
    [[1, 1, dur], [2, .3, dur * .5], [3.02, .12, dur * .3], [5.4, .05, dur * .15]].forEach(([m, v, d]) => {
      const o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.value = f * m;
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol * v, t0 + .006); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(D); o.start(t0); o.stop(t0 + d + .05);
    });
  }
  // nappe très douce (triangle filtré) qui tient la mesure sous l'arpège
  function pad(f, t, dur, v = 1) {
    const o = A.createOscillator(), g = A.createGain(), lp = A.createBiquadFilter(); o.type = 'triangle'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 500;
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(.03 * v, t + .5); g.gain.setValueAtTime(.03 * v, t + dur - .6); g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(musBus); o.start(t); o.stop(t + dur + .1);
  }
  // la musique suit le niveau : le tempo monte de 72 à ~95 BPM avec les gemmes rangées, une octave scintillante entre au tiers, une pulsation de basse aux deux tiers
  const prog = () => total && state === 'play' ? boxed / total : 0, tempo = () => 1 + .32 * prog();
  function pulse(f, t) {
    const o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.5, t); o.frequency.exponentialRampToValueAtTime(f, t + .08);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(.1, t + .01); g.gain.exponentialRampToValueAtTime(0.0001, t + .28);
    o.connect(g); g.connect(musBus); o.start(t); o.stop(t + .32);
  }
  function scheduleStep(i, t) {
    const bar = Math.floor(i / 8) % 16, k = i % 8, ch = theme.chords[bar % 8], pr = prog();
    if (pr >= .33 && k % 2 === 1) bell(mid(ch[(k >> 1) % 3] + 24), { t, vol: .03 + .02 * pr, dur: .5, dest: musBus });
    if (pr >= .66 && k % 2 === 0) pulse(mid(ch[0] - 24), t);
    const a = theme.arp[Math.floor(bar / 8)][k], n = a === 3 ? ch[0] + 12 : ch[a];
    bell(mid(n), { t, vol: .06, dur: 1.2, dest: musBus });
    if (k === 0) { const d = BEAT * 4 / tempo(); pad(mid(ch[0] - 12), t, d); pad(mid(ch[2] - 12), t, d, .5); }
    const m = theme.melody[bar]; if (m && m[k]) bell(mid(m[k]), { t, vol: .11, dur: 1.8, dest: musBus });
    if (theme.wave && k === 0 && bar % 2 === 0) wave(t, BEAT * 7 / tempo());
  }
  // SONS ET MUSIQUES ENREGISTRÉS (7 oct. 2026, audio/manifest.js → window.GAME_AUDIO) : la zone qui a son morceau le joue en boucle à la place de la boîte
  // à musique générée ; les bruitages qui ont un fichier le jouent (voir snd). Sans manifeste, ou si un fichier manque, tout reste synthétisé.
  const AUDIO = global.GAME_AUDIO || null, AUDIO_BASE = (AUDIO && AUDIO.base) || 'audio/';
  if (AUDIO && AUDIO.sfx) C.loadSamples(AUDIO_BASE, AUDIO.sfx);
  const smp = (k, o) => !!AUDIO && C.playSample(k, o);   // joue le bruitage enregistré k ; false s'il n'existe pas ou n'est pas prêt (l'appelant garde le sien)
  const MUSIQUE_URL = (href.match(/[?&]musique=([\w-]+)/) || [])[1];   // ?musique=frost-waltz : impose un morceau (pour écouter les candidats)
  let trackName = null, trackSrc = null, trackGain = null, trackWait = 0, bellShift = 0; const trackFail = {};
  const trackVol = () => AUDIO && AUDIO.musicVol !== undefined ? AUDIO.musicVol : .55;
  function stopTrack() { if (trackSrc) { try { trackSrc.stop(); } catch (_) { } trackSrc = null; } trackName = null; bellShift = 0; }
  function fileMusic() {   // true si la zone a son morceau (la musique générée se tait) ; un seul morceau en mémoire à la fois
    const M = AUDIO && AUDIO.music, name = M ? MUSIQUE_URL || (objet && M[objet.z]) || M.base : null;
    if (!name || trackFail[name] >= 3 || typeof fetch === 'undefined') { if (trackName) stopTrack(); return false; }
    if (trackName !== name && !(trackFail[name] && Date.now() < trackWait)) {
      stopTrack(); trackName = name;
      // les bruitages à hauteur de note, écrits en ré majeur, sont transposés dans la tonalité du morceau
      const key = AUDIO.tracks && AUDIO.tracks[name] && AUDIO.tracks[name].key; bellShift = key === undefined ? 0 : ((key - 2 + 18) % 12) - 6;
      C.fetchBytes(AUDIO_BASE + name + '.mp3').then(a => new Promise((ok, ko) => A.decodeAudioData(a, ok, ko))).then(b => {
        if (trackName !== name) return;
        trackSrc = A.createBufferSource(); trackSrc.buffer = b; trackSrc.loop = true; trackSrc.connect(trackGain); trackSrc.start();
      }).catch(() => { trackFail[name] = (trackFail[name] || 0) + 1; trackWait = Date.now() + 3000; if (trackName === name) { trackName = null; bellShift = 0; } });
    }
    return true;
  }
  function updateMusic() {
    if (!A) ensureMusic(); if (!A) return;
    if (fileMusic()) { nextStep = A.currentTime; return; }
    if (nextStep < A.currentTime - 1) nextStep = A.currentTime;   // onglet mis en pause : on ne rattrape pas les notes manquées
    while (nextStep < A.currentTime + .3) { scheduleStep(stepIdx, nextStep); nextStep += STEP / tempo(); stepIdx++; }
  }
  const chordNow = () => trackName ? CHORDS[0] : theme.chords[Math.floor(stepIdx / 8) % 8];   // sur un morceau enregistré : l'accord de tonique, transposé avec les bruitages
  function duck(v) { if (A && musBus) { musBus.gain.setTargetAtTime(musicOn ? v : 0, A.currentTime, .15); if (trackGain) trackGain.gain.setTargetAtTime(musicOn ? v * trackVol() : 0, A.currentTime, .15); } }
  function toggleMusic() {
    musicOn = !musicOn; duck(1);
    const el = document.getElementById('legend'); const li = el && el.querySelector && el.querySelector('[data-k="b"]');
    if (li) li.classList.toggle('on', !musicOn);
  }
  const at = d => A ? A.currentTime + d : 0;
  const midS = m => mid(m + bellShift);   // les notes des bruitages, transposées dans la tonalité du morceau enregistré en cours
  const snd = {
    unset() { if (smp('unset', { rate: rand(.94, 1.08) })) return; C.tone({ type: 'sine', f0: 2600, f1: 1900, dur: .09, vol: .08 }); C.noise({ dur: .05, vol: .05, f: 5000, q: 2 }); },   // dessertissage cristallin
    set(k) { const hit = smp('set', { rate: 1 + k * .12 }), ch = chordNow(); bell(midS(ch[k] + 12), { vol: hit ? .1 : .16, dur: 1.1 }); if (k === 2) bell(midS(ch[0] + 24), { vol: .06, dur: .6 }); },   // gemme posée : note de l'accord en cours
    tray() { if (smp('tray', { rate: rand(.95, 1.05) })) return; bell(midS(57), { vol: .09, dur: .5 }); },
    close() { if (!smp('close')) { C.noise({ dur: .07, vol: .12, f: 700, q: .7 }); C.tone({ type: 'sine', f0: 170, f1: 80, dur: .14, vol: .22 }); } const ch = chordNow(); [ch[0], ch[1], ch[2], ch[0] + 12].forEach((n, i) => bell(midS(n + 12), { t: at(.12 + i * .05), vol: .12, dur: 1.6 })); },   // fermeture feutrée + accord
    drop() { if (smp('drop', { rate: rand(.9, 1.05) })) return; C.tone({ type: 'sine', f0: 130, f1: 45, dur: .26, vol: .3 }); C.noise({ dur: .12, vol: .05, f: 350, q: .6 }); },
    bounce() { if (smp('bounce', { rate: rand(.9, 1.05) })) return; C.tone({ type: 'sine', f0: 110, f1: 40, dur: .18, vol: .18 }); C.noise({ dur: .08, vol: .04, f: 300, q: .6 }); },
    reveal(i) { const hit = smp('reveal', { rate: 1 + Math.min(i, 8) * .05 }); bell(midS(86 + i * 2), { vol: hit ? .04 : .07, dur: .7 }); },   // petite note claire par gemme révélée
    starLit(i) { bell(midS(86 + (i % 5) * 2), { vol: .1, dur: 1.4 }); bell(midS(98 + (i % 5) * 2), { t: at(.04), vol: .04, dur: .8 }); },   // lumière du décor qui s'allume
    flare(i) { bell(midS(74 + i * 2), { vol: .11, dur: 1.2 }); },   // flamboiement au final : gamme qui monte
    star(i) { bell(midS(81 + i * 4), { vol: .16, dur: 1.6 }); bell(midS(88 + i * 4), { t: at(.05), vol: .08, dur: 1.2 }); },   // étoile qui apparaît
    slowmo() { [62, 66, 69, 74, 78].forEach((n, i) => bell(midS(n + 12), { t: at(i * .18), vol: .06, dur: 1.4 })); C.noise({ dur: 1.1, vol: .05, f: 400, f1: 3200, q: 1.5 }); },   // ralenti : montée cristalline
    shelf() { bell(midS(93), { vol: .09, dur: .9 }); bell(midS(100), { t: at(.05), vol: .05, dur: .6 }); },   // miniature posée dans la vitrine
    starLost() { bell(midS(55), { vol: .09, dur: 1 }); bell(midS(52), { t: at(.12), vol: .07, dur: 1 }); },   // étoile perdue : deux notes graves
    combo(n) { const ch = chordNow(); bell(midS(ch[0] + 24 + (n - 2) * 5), { vol: .13, dur: 1.2 }); bell(midS(ch[2] + 24 + (n - 2) * 5), { t: at(.06), vol: .1, dur: 1.2 }); },   // combo : tierce qui monte avec le multiplicateur
    full() { if (smp('full')) return; C.tone({ type: 'triangle', f0: 220, dur: .35, vol: .09 }); C.tone({ type: 'triangle', f0: 233, dur: .35, vol: .09 }); },
    chain(i) { bell(midS(74 + i * 5), { vol: .14, dur: 1.1 }); bell(midS(81 + i * 5), { t: at(.05), vol: .08, dur: .9 }); },   // chute en chaîne : quarte qui monte à chaque tablette
    heart(k) { C.tone({ type: 'sine', f0: 70, f1: 38, dur: .13, vol: .3 * k }); C.tone({ type: 'sine', f0: 58, f1: 34, dur: .15, vol: .22 * k, delay: .17 }); },   // battement de cœur : présentoir presque plein
    tick() { if (smp('tick')) return; C.tone({ type: 'sine', f0: 1000, f1: 700, dur: .03, vol: .05 }); },
    blocked() { if (smp('blocked')) return; C.tone({ type: 'triangle', f0: 260, f1: 200, dur: .12, vol: .07 }); },
    unlock() { if (!smp('unlock')) snd.close(); snd.combo(2); },   // la clé part : les cadenas sautent
    links() { smp('links', { rate: rand(.95, 1.08) }); },   // deux gemmes enchaînées partent ensemble
    slide() { C.noise({ dur: .3, vol: .07, f: 250, f1: 600, q: 1.2 }); },
    win() { [62, 66, 69, 74, 78, 81, 86].forEach((n, i) => bell(midS(n), { t: at(i * .07), vol: .13, dur: 1.4 })); [74, 78, 81, 86].forEach(n => bell(midS(n), { t: at(.6), vol: .12, dur: 2.4 })); },   // glissando de harpe
    lost() { [62, 60, 57].forEach((n, i) => bell(midS(n), { t: at(i * .18), vol: .1, dur: 1.2 })); },
  };

  // ------------------------------------------------------------ génération
  function levelParams() {
    // [écrins ouverts, places du présentoir, difficulté cible] ; l'objet du niveau fixe le nombre de gemmes, donc de couleurs
    // difficulté = (le glouton échoue ? 2 : 0) + nombre max de gemmes en attente sur le présentoir dans la solution
    if (clip) { const c = botStyle === 3 ? CLIP_FAIL : botStyle === 2 ? CLIP_DRAMA : CLIP, want = c.colorsN * c.perColor; return { K: c.K, T: c.T, target: c.target, obj: objectFor(want), want, colorsMax: c.colorsN }; }
    const CURVE = [[3, 5, 0], [3, 5, 1], [3, 4, 2], [2, 4, 3], [2, 4, 4], [2, 4, 5]];
    const sl = slotAt(level); let [K, T, target] = CURVE[Math.min(level - 1, CURVE.length - 1)];
    if (sl.fin) { K = 2; T = sl.fin === 1 ? 5 : 4; target = T + 2; }   // fin de zone : deux écrins ouverts, difficulté maximale (une place de plus au présentoir en fin de zone 1)
    const fs = featsAt(level);
    return { K, T, target, obj: sl.obj, v: sl.v, want: sl.want || 0, colorsMax: 7, feats: fs.set ? fs : null };
  }
  // ------------------------------------------------------------ pièces de forme libre (6 oct. 2026)
  // Une pièce garde sa boîte englobante (x, y, w, h : chute, sillage, centre de rotation) et porte sa forme, centrée sur cette boîte :
  //   { t: 'r', w, h, r, a } rectangle arrondi · { t: 'c', r } disque · { t: 'e', rx, ry, a } ellipse · { t: 'p', pts, r } polygone aux coins adoucis.
  // sdShape = distance signée au bord (négative à l'intérieur) : dit si une pièce recouvre une gemme, et sert à placer les gemmes.
  const shapeOf = p => p.shape || (p.shape = { t: 'r', w: p.w, h: p.h, r: 26, a: 0 });
  function sdShape(sh, x, y) {
    if (sh.a) { const c = Math.cos(-sh.a), s = Math.sin(-sh.a); [x, y] = [x * c - y * s, x * s + y * c]; }
    if (sh.t === 'c') return Math.hypot(x, y) - sh.r;
    if (sh.t === 'e') { const f = Math.hypot(x / sh.rx, y / sh.ry), m = Math.min(sh.rx, sh.ry); if (f < 1e-6) return -m; return Math.max(-m, (f - 1) * f / Math.hypot(x / (sh.rx * sh.rx), y / (sh.ry * sh.ry))); }
    if (sh.t === 'r') { const r = Math.min(sh.r, sh.w / 2, sh.h / 2), qx = Math.abs(x) - (sh.w / 2 - r), qy = Math.abs(y) - (sh.h / 2 - r); return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; }
    let d = Infinity, inside = false; const P = sh.pts;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const x1 = P[j][0], y1 = P[j][1], dx = P[i][0] - x1, dy = P[i][1] - y1, t = clamp(((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      d = Math.min(d, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
      if ((y1 > y) !== (P[i][1] > y) && x < x1 + (y - y1) / dy * dx) inside = !inside;
    }
    return inside ? -d : d;
  }
  const sdPlate = (p, x, y) => { const lx = x - (p.x + p.w / 2), ly = y - (p.y + p.h / 2), far = Math.max(Math.abs(lx) - p.w / 2, Math.abs(ly) - p.h / 2); return far > 60 ? far : sdShape(shapeOf(p), lx, ly); };   // loin de la boîte : inutile de calculer la forme
  const covers = (p, x, y, m = 20) => sdPlate(p, x, y) < m;   // une gemme est sous la pièce dès que son centre est à moins de 20 du bord
  // tracé de la forme autour de l'origine (le contexte est déjà placé au centre de la pièce) ; inset : retrait vers l'intérieur (filet clair)
  function shapePath(c, sh, inset = 0) {
    c.beginPath();
    if (sh.t === 'c') { c.arc(0, 0, Math.max(1, sh.r - inset), 0, Math.PI * 2); return; }
    if (sh.t === 'e') { c.ellipse(0, 0, Math.max(1, sh.rx - inset), Math.max(1, sh.ry - inset), sh.a || 0, 0, Math.PI * 2); return; }
    let P = sh.pts, r = sh.r;
    if (sh.t === 'r') { const w = sh.w / 2 - inset, h = sh.h / 2 - inset, ca = Math.cos(sh.a || 0), sa = Math.sin(sh.a || 0); P = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [x * ca - y * sa, x * sa + y * ca]); r = Math.max(2, Math.min(sh.r, sh.w / 2, sh.h / 2) - inset); }
    else if (inset) { const k = 1 - inset / Math.max(40, sh.rin || 80); P = P.map(([x, y]) => [sh.gx + (x - sh.gx) * k, sh.gy + (y - sh.gy) * k]); r = Math.max(2, r - inset * .5); }
    const m = P.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], m0 = mid(P[m - 1], P[0]);
    c.moveTo(m0[0], m0[1]);
    for (let i = 0; i < m; i++) { const a = P[i], b = mid(a, P[(i + 1) % m]); c.arcTo(a[0], a[1], b[0], b[1], r); c.lineTo(b[0], b[1]); }
    c.closePath();
  }
  const mkPlate = o => Object.assign({ rot: 0, alpha: 1, vx: 0, vy: 0, vrot: 0, state: 'on', screws: [], s: 1, holes: [], flash: 0, sag: 0, tilt: 0, trail: [], bounced: false }, o);
  // ------------------------------------------------------------ objets (jeux/ecrin/objets.js) : une pile de pièces par niveau
  const OBJETS = global.ECRIN_OBJETS || [{ name: { fr: '', en: '' }, pieces: [{ rect: [90, 140, 800, 330], max: 6 }, { rect: [90, 510, 800, 330], max: 6 }, { disc: [490, 490, 190], max: 3 }] }];
  const PIECE_COLORS = PLATE_COLORS;
  // marges du placement, selon la taille des gemmes de l'objet : gemme à 10 du bord de sa pièce au moins, 20 entre deux gemmes ; « cachée » si son centre est
  // aux deux tiers de son rayon sous une pièce, « visible » si elle ne la touche pas
  let GEM_IN, GEM_STEP, HID, CLEAR; const setGeo = k => { GEM_IN = SCREW_R * k + 10; GEM_STEP = 2 * SCREW_R * k + 20; HID = -34 * k; CLEAR = SCREW_R * k - 2; }; setGeo(1);
  function pieceShape(o, pc, i) {
    const rad = Math.PI / 180; let sh, cx, cy, w, h;
    if (pc.rect) { const [x, y, l, ht] = pc.rect, a = (pc.a || 0) * rad; sh = { t: 'r', w: l, h: ht, r: pc.rad === undefined ? 30 : pc.rad, a }; cx = x + l / 2; cy = y + ht / 2; w = Math.abs(l * Math.cos(a)) + Math.abs(ht * Math.sin(a)); h = Math.abs(l * Math.sin(a)) + Math.abs(ht * Math.cos(a)); }
    else if (pc.disc) { const [x, y, r] = pc.disc; sh = { t: 'c', r }; cx = x; cy = y; w = h = 2 * r; }
    else if (pc.oval) { const [x, y, rx, ry] = pc.oval, a = (pc.a || 0) * rad, c = Math.cos(a), sn = Math.sin(a); sh = { t: 'e', rx, ry, a }; cx = x; cy = y; w = 2 * Math.hypot(rx * c, ry * sn); h = 2 * Math.hypot(rx * sn, ry * c); }
    else { let src = pc.poly;
      if (pc.courbe) { const Q = pc.courbe, m = Q.length, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; src = [];
        for (let i = 0; i < m; i++) { const a = mid(Q[(i + m - 1) % m], Q[i]), c = Q[i], b = mid(Q[i], Q[(i + 1) % m]); for (let k = 0; k < 7; k++) { const t = k / 7, u = 1 - t; src.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]); } } }
      const xs = src.map(q => q[0]), ys = src.map(q => q[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys); cx = (x0 + x1) / 2; cy = (y0 + y1) / 2; w = x1 - x0; h = y1 - y0;
      const pts = src.map(([x, y]) => [x - cx, y - cy]); sh = { t: 'p', pts, r: pc.courbe ? 0 : pc.rad === undefined ? 22 : pc.rad, gx: 0, gy: 0, rin: 0 };
      // point le plus profond du polygone (centre du filet intérieur, et repère pour placer les gemmes)
      let best = -Infinity; for (let gx = -w / 2; gx <= w / 2; gx += 12) for (let gy = -h / 2; gy <= h / 2; gy += 12) { const d = -sdShape(sh, gx, gy); if (d > best) { best = d; sh.gx = gx; sh.gy = gy; } } sh.rin = best; }
    return { x: BOARD.x + cx - w / 2, y: BOARD.y + cy - h / 2, w, h, z: i, color: pc.col || PIECE_COLORS[i % PIECE_COLORS.length], shape: sh, skey: (o.name.fr || 'objet') + '#' + i };
  }
  // positions possibles des gemmes d'une pièce : une grille régulière et centrée dans le repère de la pièce ; on essaie quelques décalages et on garde
  // celui qui loge le plus de gemmes (le premier essayé en cas d'égalité : sans décalage, donc symétrique)
  function gridCands(p, ok) {
    const sh = p.shape, a = sh.t === 'p' ? 0 : sh.a || 0, ca = Math.cos(a), sa = Math.sin(a), cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    const lw = sh.t === 'r' ? sh.w : sh.t === 'c' ? 2 * sh.r : sh.t === 'e' ? 2 * sh.rx : p.w, lh = sh.t === 'r' ? sh.h : sh.t === 'c' ? 2 * sh.r : sh.t === 'e' ? 2 * sh.ry : p.h;
    const uw = Math.max(0, lw - 2 * GEM_IN), uh = Math.max(0, lh - 2 * GEM_IN), nx0 = Math.floor(uw / GEM_STEP) + 1, ny0 = Math.floor(uh / GEM_STEP) + 1;
    const ox = sh.t === 'p' ? sh.gx : 0, oy = sh.t === 'p' ? sh.gy : 0, shifts = [0, 22, -22, 44, -44], sx = sh.t === 'p' ? shifts : [0];
    let best = [];
    for (const nx of [nx0, nx0 - 1]) for (const ny of [ny0, ny0 - 1]) {
      if (nx < 1 || ny < 1) continue;
      for (const dy of shifts) for (const dx of sx) for (const anchor of sh.t === 'p' ? [0, 1] : [0]) {
        const out = [];
        for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
          // polygone : la grille est centrée sur la boîte (anchor 0) ou accrochée au point le plus profond (anchor 1)
          const lx = (anchor ? ox : 0) + dx + (nx === 1 ? 0 : (c / (nx - 1) - .5) * uw), ly = (anchor ? oy : 0) + dy + (ny === 1 ? 0 : (r / (ny - 1) - .5) * uh);
          const x = cx + lx * ca - ly * sa, y = cy + lx * sa + ly * ca; if (ok(x, y)) out.push([x, y]);
        }
        if (out.length > best.length) best = out;
      }
    }
    return best;
  }
  // k positions bien réparties : la plus proche du centre s'il n'en faut qu'une, sinon de proche en proche la plus éloignée de celles déjà prises
  function pickSpread(cand, k, p) {
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2, dc = q => Math.hypot(q[0] - cx, q[1] - cy);
    if (k <= 0 || !cand.length) return [];
    if (k === 1) return [cand.slice().sort((a, b) => dc(a) - dc(b))[0]];
    const out = [cand.slice().sort((a, b) => dc(b) - dc(a) || a[1] - b[1] || a[0] - b[0])[0]];
    while (out.length < k) { let bq = null, bd = -1; for (const q of cand) { if (out.includes(q)) continue; const d = Math.min(...out.map(o => Math.hypot(o[0] - q[0], o[1] - q[1]))); if (d > bd + .5) { bd = d; bq = q; } } if (!bq) break; out.push(bq); }
    return out;
  }
  // géométrie d'un objet : ses pièces et la place de chaque gemme (calculée une fois par objet et par nombre de gemmes voulu)
  function objGeom(o, want = 0, v = 0) {
    const gk = want + '|' + v; o._g = o._g || {}; if (o._g[gk]) return o._g[gk];
    setGeo(o.gem || 1);
    const P = o.pieces.map((pc, i) => pieceShape(o, pc, i)), warn = [];
    // sur : la pièce porteuse d'un ornement, par son numéro ou par son nom (id)
    const SUR = o.pieces.map(pc => pc.sur === undefined ? -1 : typeof pc.sur === 'number' ? pc.sur : o.pieces.findIndex(q => q.id === pc.sur));
    SUR.forEach((h, i) => { if (o.pieces[i].sur !== undefined && (h < 0 || h === i)) warn.push('pièce ' + i + ' : porteuse « ' + o.pieces[i].sur + ' » introuvable'); });
    const okAt = (i, x, y) => {
      if (sdPlate(P[i], x, y) > -GEM_IN) return false;
      for (let j = i + 1; j < P.length; j++) { const d = sdPlate(P[j], x, y); if (SUR[j] === i ? d < CLEAR : d > HID && d < CLEAR) return false; }   // jamais sous son propre ornement, jamais à cheval sur un bord
      return true;
    };
    const picks = P.map((p, i) => {
      const pc = o.pieces[i]; if (pc.sur !== undefined) return [];
      let cand;
      if (pc.gems) { cand = pc.gems.map(([x, y]) => [BOARD.x + x, BOARD.y + y]); const bad = cand.filter(([x, y]) => !okAt(i, x, y)).length; if (bad) warn.push('pièce ' + i + ' : ' + bad + ' gemme(s) imposée(s) mal placée(s)'); cand = cand.filter(([x, y]) => okAt(i, x, y)); }
      else cand = gridCands(p, (x, y) => okAt(i, x, y));
      // pièce très recouverte (pétale, plume, patte de derrière) : la grille ne trouve pas assez de places. On balaie alors toute la pièce et on complète,
      // en préférant les places visibles, puis les plus éloignées du bord, à bonne distance des gemmes déjà posées
      const need = pc.max === undefined ? 4 : pc.max;
      if (!pc.gems && cand.length < Math.min(need, 2)) {
        const pool = [];
        for (let x = p.x; x <= p.x + p.w; x += 10) for (let y = p.y; y <= p.y + p.h; y += 10) if (okAt(i, x, y)) pool.push({ x, y, vis: !P.some((q, j) => j > i && covers(q, x, y)), deep: -sdPlate(p, x, y) });
        pool.sort((u, v) => v.vis - u.vis || v.deep - u.deep);
        for (const q of pool) { if (cand.length >= Math.min(need, 2)) break; if (cand.every(c => Math.hypot(c[0] - q.x, c[1] - q.y) >= GEM_STEP)) cand.push([q.x, q.y]); }
      }
      return pickSpread(cand, Math.min(cand.length, pc.max === undefined ? 4 : pc.max), p);
    });
    // une pièce sans aucune place pour une gemme devient un ornement : elle tombera avec la pièce à gemmes la plus proche dont elle ne couvre aucune gemme
    const mid = q => [q.x + q.w / 2, q.y + q.h / 2], auto = [];
    const attach = i => {
      let best = -1, bd = Infinity; const [cx, cy] = mid(P[i]);
      P.forEach((q, j) => { if (j === i || !picks[j].length || picks[j].some(([x, y]) => sdPlate(P[i], x, y) < CLEAR)) return; const [qx, qy] = mid(q), d = Math.hypot(qx - cx, qy - cy); if (d < bd) { bd = d; best = j; } });
      if (best >= 0) { SUR[i] = best; auto.push(i); return true; }
      return false;
    };
    picks.forEach((a, i) => { if (!a.length && SUR[i] < 0 && !attach(i)) warn.push('pièce ' + i + ' : aucune place pour une gemme, et aucune pièce pour la porter'); });
    let total = picks.reduce((t, a) => t + a.length, 0); const cap = total, goal = want ? Math.min(want, total) : total, target = goal - goal % 3;
    while (total > target) { let bi = -1; picks.forEach((a, i) => { if (a.length > 1 && !o.pieces[i].garde && (bi < 0 || a.length > picks[bi].length)) bi = i; }); if (bi < 0) break; picks[bi].pop(); total--; }
    // que des pièces à une gemme : les dernières (celles du dessus) qui ne portent rien perdent leur gemme et deviennent des ornements
    for (let i = P.length - 1; i >= 0 && total > target; i--) {
      if (picks[i].length !== 1 || o.pieces[i].garde || SUR.includes(i)) continue;
      const keep = picks[i]; picks[i] = []; if (attach(i)) total--; else picks[i] = keep;
    }
    if (total % 3) warn.push('nombre de gemmes (' + total + ') non multiple de 3');
    // VARIANTE (v = 1, 2… : l'objet revient) : des cabochons posés sur des gemmes visibles. Chacun cache une gemme et porte la sienne : l'objet gagne
    // des gemmes et des dépendances sans être redessiné. Trois par trois (le total reste multiple de 3), jamais sur un œil, jamais à cheval sur une autre gemme.
    if (v > 0) {
      const R = GEM_IN + 2, all = [], cabs = [];
      picks.forEach((a, i) => a.forEach(g => all.push({ g, i })));
      const libre = ({ g, i }) => !o.pieces[i].garde && !P.some((q, j) => j > i && covers(q, g[0], g[1], CLEAR));
      const cand = all.filter(libre).sort((a, b) => picks[b.i].length - picks[a.i].length || a.g[1] - b.g[1] || a.g[0] - b.g[0]);
      const visibles = cand.length, veut = Math.min(Math.max(3, 3 * Math.round(total * .13 * v / 3)), 3 * Math.floor(visibles * .45 / 3));
      for (const c of cand) {
        if (cabs.length >= veut) break;
        if (all.some(e => e !== c && Math.hypot(e.g[0] - c.g[0], e.g[1] - c.g[1]) < R + CLEAR)) continue;
        if (cabs.some(e => Math.hypot(e.g[0] - c.g[0], e.g[1] - c.g[1]) < 2 * R + 6)) continue;
        cabs.push(c);
      }
      cabs.length -= cabs.length % 3;
      const light = hex => { const m = parseInt(hex.slice(1), 16); return (.299 * (m >> 16) + .587 * (m >> 8 & 255) + .114 * (m & 255)) / 255; };
      cabs.forEach((c, k) => {
        const z = P.length;
        P.push({ x: c.g[0] - R, y: c.g[1] - R, w: 2 * R, h: 2 * R, z, color: light(P[c.i].color) > .78 ? '#F2CF73' : '#F6EEDD', shape: { t: 'c', r: R }, skey: (o.name.fr || 'objet') + '#cab' + k });
        picks.push([[c.g[0], c.g[1]]]); SUR.push(-1); total++;
      });
    }
    const hidden = picks.reduce((t, a, i) => t + a.filter(([x, y]) => P.some((q, j) => j > i && covers(q, x, y, 20))).length, 0);
    return o._g[gk] = { P, picks, total, cap, hidden, warn, SUR, auto };
  }
  let objSorted = null;   // les objets du plus petit au plus gros (nombre de gemmes)
  const objList = () => objSorted || (objSorted = OBJETS.map(o => ({ o, cap: objGeom(o).total })).sort((a, b) => a.cap - b.cap).map(e => e.o));
  let OBJ_URL = (href.match(/[?&]objet=(\d+)/) || [])[1];   // ?objet=3 : toujours le 3e objet de objets.js (mise au point)
  // ZONES (7 oct. 2026) : 15 zones à thème de 20 niveaux (objets.js, ECRIN_ZONES). Dans une zone, les objets ordinaires vont du plus petit au plus gros et
  // les objets de fin de zone (final: true) s'intercalent : trois par zone le plus souvent, aux niveaux 7, 13 et 20 ; le dernier est le plus dur.
  // Les 300 niveaux passés, les zones reviennent dans le même ordre, sans la zone facile, avec une variante de plus à chaque tour (des cabochons en plus).
  // DÉBUT ADOUCI : les trois zones qui suivent la zone facile plafonnent le nombre de gemmes (un gros objet y est serti de moins de gemmes).
  const ZONE_LEN = 20;
  const ZONES = (global.ECRIN_ZONES || []).filter(z => OBJETS.some(o => o.z === z.key));
  const CAPS = [null, [30, 45], [36, 51], [42, 57]];   // par zone du premier tour : [objet ordinaire, objet de fin de zone]
  let voirV = 0;   // mise au point : Core.test.voir(objet, variante)
  const zoneSeq = {};
  function zoneOrder(zi, v) {   // les objets de la zone dans l'ordre des niveaux : [{ obj, fin }] (fin : 0 ordinaire, 1 gros objet en cours de zone, 2 le dernier)
    const key = zi + '|' + v; if (zoneSeq[key]) return zoneSeq[key];
    const tot = o => objGeom(o, 0, v).total, by = (a, b) => tot(a) - tot(b), all = OBJETS.filter(o => o.z === ZONES[zi].key);
    let ord = all.filter(o => !o.final).sort(by), fins = all.filter(o => o.final).sort(by);
    if (!fins.length) fins = ord.splice(-1);   // zone facile : son plus gros objet la termine
    const m = ord.length + fins.length, seq = new Array(m).fill(null);
    fins.forEach((o, j) => { seq[Math.round((j + 1) * m / fins.length) - 1] = { obj: o, fin: j === fins.length - 1 && zi ? 2 : 1 }; });
    let k = 0; for (let i = 0; i < m; i++) if (!seq[i]) seq[i] = { obj: ord[k++], fin: 0 };
    return zoneSeq[key] = seq;
  }
  // le parcours : zone (numéro dans ZONES), tour (0 le premier), rang de la zone dans le parcours (0, 1, 2… sans fin), position dans la zone
  function journey(lv) {
    const nz = ZONES.length, k = Math.floor((lv - 1) / ZONE_LEN), pos = (lv - 1) % ZONE_LEN;
    if (k < nz || nz < 2) return { zi: k % nz, tour: Math.floor(k / nz), rang: k, pos };
    const r = k - nz; return { zi: 1 + r % (nz - 1), tour: 1 + Math.floor(r / (nz - 1)), rang: k, pos };
  }
  function slotAt(lv) {
    if (OBJ_URL || !ZONES.length) return { obj: OBJETS[(+(OBJ_URL || 1) - 1) % OBJETS.length], v: voirV, fin: 0, want: 0 };
    const J = journey(lv), v = Math.min(3, J.tour), seq = zoneOrder(J.zi, v), e = seq[J.pos % seq.length], cap = !J.tour && CAPS[J.rang];
    return { obj: e.obj, v, fin: e.fin, want: cap ? cap[e.fin ? 1 : 0] : 0 };
  }
  // la zone d'un niveau, pour la carte de la coquille (bandeau par zone) ; au deuxième tour le nom porte son numéro
  function chapterOf(lv) {
    const k = Math.floor((Math.max(1, lv) - 1) / ZONE_LEN); if (!ZONES.length) return { index: k, from: k * ZONE_LEN + 1, to: (k + 1) * ZONE_LEN, name: '', color: GOLD };
    const J = journey(k * ZONE_LEN + 1), z = ZONES[J.zi];
    return { index: k, from: k * ZONE_LEN + 1, to: (k + 1) * ZONE_LEN, name: C.byLang(z.name) + (J.tour ? ' ' + (J.tour + 1) : ''), color: z.color };
  }
  // NOUVEAUTÉS (7 oct. 2026) : une par zone à partir de la deuxième, puis elles se mélangent et se multiplient.
  //   m  gemme mystère : sa couleur est cachée ; elle se dévoile quand on la touche (elle part alors à sa place), et chaque écrin fermé en dévoile une
  //   l  cadenas : les gemmes d'une pièce sont cadenassées tant que la gemme à la clé (ailleurs sur l'objet) n'est pas dessertie
  //   c  chaîne : deux gemmes d'une même pièce reliées par une chaîne partent ensemble (il faut une place pour chacune)
  const NEWS_AT = { m: ZONE_LEN + 1, l: 2 * ZONE_LEN + 1, c: 3 * ZONE_LEN + 1 };
  let featsForce = (href.match(/[?&]nouv=([mlc]*)/) || [])[1];   // ?nouv=mlc dans l'URL, ou Core.test.nouv('ml') : impose les nouveautés (mise au point)
  function featsAt(lv) {
    if (clip) return { set: '', k: 0 };
    if (featsForce !== undefined) return { set: featsForce, k: 2 };
    const rang = Math.floor((lv - 1) / ZONE_LEN), pos = (lv - 1) % ZONE_LEN, neuf = pos % 3 !== 2;   // deux niveaux sur trois portent la nouveauté de la zone
    let set = '';
    if (rang === 1) set = neuf ? 'm' : '';
    else if (rang === 2) set = neuf ? 'l' : 'm';
    else if (rang === 3) set = neuf ? 'c' : pos % 2 ? 'm' : 'l';
    else if (rang >= 4) set = rang >= 8 && pos % 6 === 5 ? 'mlc' : ['ml', 'c', 'm', 'lc', 'mc', 'l'][pos % 6];
    return { set, k: clamp(1 + Math.floor((rang - 1) / 4), 1, 3) };   // k : dose (plus de gemmes mystère, de cadenas et de chaînes au fil des zones)
  }
  // pose les nouveautés sur un niveau tout juste construit. Rien ne peut se bloquer soi-même : une chaîne relie deux gemmes d'une même pièce, et un cadenas
  // ne ferme jamais une pièce dont une gemme doit partir avant sa propre clé.
  function addFeats(plates, screws, F, geo) {
    const N = screws.length, L = solverLevel(plates, screws, geo), gi = new Map(screws.map((sc, i) => [sc, i])), of = plates.map(() => []), out = { m: 0, l: 0, c: 0 };
    L.gems.forEach((g, i) => { if (g.p >= 0) of[g.p].push(i); });
    if (F.set.includes('c')) {
      const want = N <= 12 ? 1 : clamp(Math.round(N / 18) + F.k - 1, 1, 4), cand = [], pris = new Set();
      plates.forEach(p => { const S = p.screws; for (let a = 0; a < S.length; a++) for (let b = a + 1; b < S.length; b++) { const d = dist(S[a].x, S[a].y, S[b].x, S[b].y); if (d <= 340) cand.push({ a: S[a], b: S[b], d: d + rand(80) }); } });
      cand.sort((x, y) => x.d - y.d);
      for (const c of cand) { if (out.c >= want) break; if (pris.has(c.a.plate)) continue; pris.add(c.a.plate); c.a.pair = c.b; c.b.pair = c.a; out.c++; }
    }
    if (F.set.includes('l')) {
      const want = N >= 30 && F.k >= 2 ? 2 : 1;
      // tout ce qui doit partir avant une gemme : les gemmes des pièces qui la couvrent, sa partenaire de chaîne, la clé de sa pièce (et ainsi de suite)
      const deps = g0 => { const seen = new Set([g0]), st = [g0]; const add = h => { if (!seen.has(h)) { seen.add(h); st.push(h); } };
        while (st.length) { const g = st.pop(), sc = screws[g]; for (const j of L.blockers[g]) of[j].forEach(add); if (sc.pair) add(gi.get(sc.pair)); if (sc.plate.lockKey) add(gi.get(sc.plate.lockKey)); }
        return seen; };
      for (let t = 0; t < want; t++) {
        let ok = false;
        for (const k of shuffle(screws.map((_, i) => i))) {
          const ks = screws[k]; if (ks.pair || ks.key || ks.plate.lockKey) continue;
          const D = deps(k), B = shuffle(plates.filter(p => p !== ks.plate && !p.lockKey && p.screws.length >= 2 && !p.screws.some(sc => sc.key || D.has(gi.get(sc)))));
          if (!B.length) continue;
          B[0].lockKey = ks; ks.key = B[0]; out.l++; ok = true; break;
        }
        if (!ok) break;
      }
    }
    if (F.set.includes('m')) {
      const want = Math.max(2, Math.round(N * (.08 + .04 * F.k)));
      shuffle(screws.filter(sc => !sc.key && !sc.pair && !sc.plate.lockKey)).slice(0, want).forEach(sc => { sc.mystery = true; out.m++; });
    }
    return out;
  }
  function objectFor(want) { const L = objList(); return OBJ_URL ? OBJETS[(+OBJ_URL - 1) % OBJETS.length] : L.find(o => objGeom(o).total >= want) || L[L.length - 1]; }
  // construit pièces + gemmes sans rien animer (appelé en boucle : seules les couleurs changent d'un essai à l'autre)
  function generate(prm, geo) {
    const G = objGeom(prm.obj, prm.want, prm.v || 0), plates = G.P.map(p => mkPlate({ x: p.x, y: p.y, w: p.w, h: p.h, z: p.z, color: p.color, shape: p.shape, skey: p.skey })), screws = [];
    G.SUR.forEach((h, i) => { if (h >= 0) plates[i].support = plates[h]; });
    // couleurs : une pour 7 gemmes environ, chacune en multiple de 3
    const tri = Math.floor(G.total / 3), nc = clamp(Math.round(G.total / Math.max(5, 7 - (prm.v || 0))), Math.min(4, tri), Math.min(prm.colorsMax, tri, COLORS.length)), cols = shuffle(COLORS.slice()).slice(0, nc);
    const counts = cols.map((c, i) => Math.floor(tri / nc) + (i < tri % nc ? 1 : 0)), pool = shuffle(cols.flatMap((c, i) => new Array(counts[i] * 3).fill(c)));
    G.picks.forEach((a, i) => a.forEach(([x, y]) => { if (!pool.length) return; const sc = { x, y, color: pool.pop(), plate: plates[i], state: 'on', s: 1, rot: 0, lift: 0 }; plates[i].screws.push(sc); screws.push(sc); }));
    const feats = prm.feats ? addFeats(plates, screws, prm.feats, geo) : null;
    return { plates, screws, cols, counts, feats };
  }

  // ------------------------------------------------------------ file d'écrins et solveur
  // La file des écrins est tirée à l'avance (chaque couleur y revient une fois par trio de gemmes) ; les K premiers sont ouverts,
  // chaque écrin fermé est remplacé par le suivant de la file. Le joueur ne voit que les deux prochains.
  function makeQueue(cols, counts, K) {
    let q;
    for (let t = 0; t < 50; t++) { q = shuffle(cols.flatMap((c, i) => new Array(counts[i]).fill(c))); if (new Set(q.slice(0, K)).size === Math.min(K, q.length)) break; }
    return q;
  }
  // structure compacte d'un niveau pour le solveur : gemme -> tablette, couleur, tablettes qui la recouvrent
  // geo : mémoire de ce qui couvre quoi, partagée par les candidats d'un même niveau (seules leurs couleurs et leurs nouveautés diffèrent)
  function solverLevel(plates0, screws0, geo) {
    const plates = plates0.filter(p => p.state === 'on'), pi = new Map(plates.map((p, i) => [p, i]));
    const gi = new Map(screws0.map((s, i) => [s, i])), live1 = s => s && s.state === 'on';
    // lock : la gemme à la clé qui cadenasse sa pièce (-1 : libre) ; pair : sa partenaire de chaîne (-1 : aucune)
    const gems = screws0.map(s => ({ p: pi.has(s.plate) ? pi.get(s.plate) : -1, c: COLORS.indexOf(s.color), on: s.state === 'on', lock: live1(s.plate.lockKey) ? gi.get(s.plate.lockKey) : -1, pair: s.state === 'on' && live1(s.pair) ? gi.get(s.pair) : -1 }));
    const blockers = geo && geo.blockers && geo.n === screws0.length && geo.p === plates.length ? geo.blockers : screws0.map(s => { const out = []; plates.forEach((p, j) => { if (p !== s.plate && p.z > s.plate.z && covers(p, s.x, s.y)) out.push(p.support ? pi.get(p.support) : j); }); return out.filter(j => j !== undefined); });   // une tablette posée est là tant que sa porteuse est là
    if (geo) { geo.blockers = blockers; geo.n = screws0.length; geo.p = plates.length; }
    const left = plates.map(() => 0); gems.forEach(g => { if (g.on) left[g.p]++; });
    return { n: gems.length, gems, blockers, left };
  }
  // état de recherche : removed[g], left[p] (gemmes restantes par tablette), boxes [{c, f}|null], buf (couleurs), qi (index dans la file)
  // res : couleurs des gemmes en réserve (aides) : elles ne prennent pas de place et rejoignent le prochain écrin de leur couleur
  function solverStart(L, queue, K, T, boxes0, buf0, qi0, res0) {
    const st = { removed: L.gems.map(g => g.on ? 0 : 1), left: L.left.slice(), boxes: [], buf: buf0 ? buf0.slice() : [], res: res0 && res0.length ? res0.slice() : null, qi: qi0 || 0, done: L.gems.filter(g => !g.on).length };
    if (boxes0) st.boxes = boxes0.map(b => b ? { c: b.c, f: b.f } : null);
    else for (let i = 0; i < K; i++) openNext(st, i, queue);
    return st;
  }
  function openNext(st, i, queue) {
    if (st.qi >= queue.length) { st.boxes[i] = null; return; }
    const b = { c: queue[st.qi++], f: 0 }; st.boxes[i] = b;
    if (st.res) for (let k = st.res.length - 1; k >= 0; k--) if (st.res[k] === b.c && b.f < 3) { st.res.splice(k, 1); b.f++; }
    for (let k = st.buf.length - 1; k >= 0; k--) if (st.buf[k] === b.c && b.f < 3) { st.buf.splice(k, 1); b.f++; }
    if (b.f === 3) openNext(st, i, queue);
  }
  const gemFree = (L, st, g) => { const gm = L.gems[g]; return !st.removed[g] && st.left[gm.p] > 0 && !L.blockers[g].some(j => st.left[j] > 0) && (gm.lock < 0 || !!st.removed[gm.lock]); };
  // où irait une gemme de couleur c : l'écrin ouvert de sa couleur le plus rempli, sinon le présentoir, sinon nulle part (null).
  // used : alvéoles déjà promises dans ce coup, nbuf : places du présentoir déjà promises (chaîne : deux gemmes partent ensemble)
  function solverPlace(st, c, T, used, nbuf) {
    let bi = -1, bf = -1;
    st.boxes.forEach((b, i) => { if (!b || b.c !== c) return; const fl = b.f + (used[i] || 0); if (fl < 3 && fl > bf) { bi = i; bf = fl; } });
    return bi >= 0 ? { bi, bf } : st.buf.length + nbuf < T ? { bi: -1, bf: -1 } : null;
  }
  function solverMoves(L, st, queue, T) {
    const out = [];
    for (let g = 0; g < L.n; g++) {
      if (!gemFree(L, st, g)) continue;
      const gm = L.gems[g], d = solverPlace(st, gm.c, T, {}, 0); if (!d) continue;
      const m = { g, bi: d.bi, score: 0 };
      if (d.bi >= 0) m.score = 100 + d.bf * 10 + (st.left[gm.p] === 1 ? 5 : 0);
      else { const qpos = queue.slice(st.qi, st.qi + 3).indexOf(gm.c); m.score = (qpos >= 0 ? 30 - qpos * 10 : 0) + (st.left[gm.p] === 1 ? 5 : 0) - st.buf.length; }
      if (gm.pair >= 0 && !st.removed[gm.pair]) {   // chaîne : la partenaire part avec elle, il lui faut une place aussi
        const h = gm.pair; if (!gemFree(L, st, h)) continue;
        const d2 = solverPlace(st, L.gems[h].c, T, d.bi >= 0 ? { [d.bi]: 1 } : {}, d.bi >= 0 ? 0 : 1); if (!d2) continue;
        m.h = h; m.hbi = d2.bi; m.score += d2.bi >= 0 ? 60 : -8;
      }
      out.push(m);
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function solverApply(L, st, m, queue) {
    const ns = { removed: st.removed.slice(), left: st.left.slice(), boxes: st.boxes.map(b => b ? { c: b.c, f: b.f } : null), buf: st.buf.slice(), res: st.res && st.res.slice(), qi: st.qi, done: st.done };
    const put = (g, bi) => { const gm = L.gems[g]; ns.removed[g] = 1; ns.left[gm.p]--; ns.done++; if (bi >= 0) ns.boxes[bi].f++; else ns.buf.push(gm.c); };
    put(m.g, m.bi); if (m.h !== undefined) put(m.h, m.hbi);
    // les écrins ne se ferment qu'une fois les deux gemmes posées, comme dans le jeu
    for (const bi of m.h !== undefined && m.hbi !== m.bi ? [m.bi, m.hbi] : [m.bi]) if (bi >= 0 && ns.boxes[bi] && ns.boxes[bi].f === 3) openNext(ns, bi, queue);
    return ns;
  }
  const solverKey = st => st.removed.join('') + '|' + st.buf.slice().sort().join(',') + '|' + st.boxes.map(b => b ? b.c + ':' + b.f : '-').join(',') + '|' + st.qi;
  // recherche en profondeur avec mémoire des impasses ; renvoie { path: [gemmes], peak: max de gemmes en attente } ou null
  function solve(L, queue, T, start, budget = 8000) {
    const failed = new Set(); let nodes = 0, aborted = false;
    function dfs(st) {
      if (st.done >= L.n) return [];
      if (++nodes > budget) { aborted = true; return null; }
      const key = solverKey(st); if (failed.has(key)) return null;
      for (const m of solverMoves(L, st, queue, T)) {
        const r = dfs(solverApply(L, st, m, queue));
        if (r) { r.push(m.g); return r; }
        if (aborted) return null;
      }
      failed.add(key); return null;
    }
    const r = dfs(start); solve.aborted = aborted;   // null + aborted : budget épuisé, on ne sait pas ; null sans aborted : impasse prouvée
    if (!r) return null;
    r.reverse();
    let st = start, peak = 0, uses = 0;   // uses : passages par le présentoir de cette solution (le « par » des étoiles)
    for (const g of r) { const m = solverMoves(L, st, queue, T).find(x => x.g === g); if (m.bi < 0) uses++; if (m.h !== undefined && m.hbi < 0) uses++; st = solverApply(L, st, m, queue); peak = Math.max(peak, st.buf.length); }
    return { path: r, peak, uses, nodes };
  }
  // le glouton (premier coup de l'ordre du solveur, sans retour arrière) finit-il le niveau ?
  function greedySolves(L, queue, T, start) {
    let st = start;
    while (st.done < L.n) { const ms = solverMoves(L, st, queue, T); if (!ms.length) return false; st = solverApply(L, st, ms[0], queue); }
    return true;
  }

  // mode boucle : le niveau généré est mémorisé sous forme de données simples, puis reconstruit à l'identique à chaque redémarrage
  function toSpec(b, key) {
    const P = b.g.plates;
    return { key, q: b.q.slice(), path: b.sol.path.slice(), peak: b.sol.peak, uses: b.sol.uses || 0, score: b.score, greedy: b.greedy,
      plates: P.map(o => ({ x: o.x, y: o.y, w: o.w, h: o.h, z: o.z, color: o.color, shape: o.shape, skey: o.skey, support: o.support ? P.indexOf(o.support) : -1 })),
      screws: b.g.screws.map(o => ({ x: o.x, y: o.y, color: o.color, plate: P.indexOf(o.plate) })) };
  }
  function fromSpec(sp) {
    const P = sp.plates.map(o => mkPlate({ x: o.x, y: o.y, w: o.w, h: o.h, z: o.z, color: o.color, shape: o.shape, skey: o.skey }));
    sp.plates.forEach((o, i) => { if (o.support >= 0) P[i].support = P[o.support]; });
    const S = sp.screws.map(o => { const sc = { x: o.x, y: o.y, color: o.color, plate: P[o.plate], state: "on", s: 1, rot: 0, lift: 0 }; P[o.plate].screws.push(sc); return sc; });
    return { g: { plates: P, screws: S }, q: sp.q.slice(), qc: sp.q.map(c => COLORS.indexOf(c)), sol: { path: sp.path.slice(), peak: sp.peak, uses: sp.uses || 0, nodes: 0 }, score: sp.score, greedy: sp.greedy };
  }
  // AGRANDISSEMENT (8 oct. 2026) : l'objet, construit et résolu dans son carré de 980, est agrandi d'un bloc et centré dans le plateau, gemmes comprises.
  // Rien ne change dans le niveau : ce qui couvre quoi est conservé (les marges du placement grandissent avec lui). Plafonds : gemme à 1,3 fois la
  // taille normale au plus (un petit objet ne devient pas un objet à trois gemmes géantes), objet à 1,6 fois.
  const ZOOM_PAD = 34;
  function zoomLevel(g) {
    const P = g.plates; if (!P.length) return 1;
    const x0 = Math.min(...P.map(p => p.x)), y0 = Math.min(...P.map(p => p.y)), x1 = Math.max(...P.map(p => p.x + p.w)), y1 = Math.max(...P.map(p => p.y + p.h));
    const s = clamp(Math.min((BOARD.w - 2 * ZOOM_PAD) / (x1 - x0), (BOARD.h - 2 * ZOOM_PAD) / (y1 - y0)), 1, Math.min(1.6, 1.3 / gemK));
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, tx = BOARD.x + BOARD.w / 2, ty = BOARD.y + BOARD.h / 2, fx = x => tx + (x - cx) * s, fy = y => ty + (y - cy) * s;
    for (const p of P) {
      const mx = fx(p.x + p.w / 2), my = fy(p.y + p.h / 2), sh = Object.assign({}, shapeOf(p));
      for (const k of ['w', 'h', 'r', 'rx', 'ry', 'gx', 'gy', 'rin']) if (sh[k] !== undefined) sh[k] *= s;
      if (sh.pts) sh.pts = sh.pts.map(([x, y]) => [x * s, y * s]);
      p.w *= s; p.h *= s; p.x = mx - p.w / 2; p.y = my - p.h / 2; p.shape = sh; p.skey += '|z' + s.toFixed(3);
    }
    for (const sc of g.screws) { sc.x = fx(sc.x); sc.y = fy(sc.y); }
    return s;
  }
  function init() {
    bufN = BUF_N; rescued = false; levelStart = tm;
    drama = { phase: 'calm', moves: 0, peaks: 0, tries: 0 }; hbT = 0;
    boxes = [null, null, null]; leaving = []; buffer = new Array(bufN).fill(null); state = 'play'; boxed = 0; reserve = []; aim = null; if (global.Shell && Shell.boostAim) Shell.boostAim(null);
    shelf = []; flyers = []; trayUses = 0; litPrev = 0; starsPrev = 3; finale = null; slowGem = null;
    sky = { name: '', edges: [], stars: [] };   // rien tant que le décor de la zone n'est pas connu (zoneLook pose ses lumières)
    duck(1);
    // si le rideau est baissé (fin du niveau précédent), il se relève sur le nouveau niveau
    const curtained = curtain.v > 0;
    if (curtained) C.tween(curtain, { v: 0 }, .8, { ease: ease.inOutCubic, delay: .15 });
    for (const k in plateSprites) delete plateSprites[k];   // les images des pièces de l'objet précédent
    const prm = levelParams(); objet = prm.obj; zoneLook(); gemK = objet.gem || 1; openN = prm.K; bufN = prm.T; buffer = new Array(bufN).fill(null); boxes = new Array(openN).fill(null);
    // on génère des candidats (tablettes + file d'écrins) jusqu'à atteindre la difficulté cible, en gardant le meilleur :
    // piles peu profondes, solvable par le solveur, et score = (glouton échoue ? 2 : 0) + pic d'attente sur le présentoir
    let best = null, k = 0; const t0ms = Date.now(), geo = {};
    // NIVEAU FIXE (7 oct. 2026) : le hasard du niveau (couleurs des gemmes, file des écrins, nouveautés) est tiré de son numéro. Le niveau 87 est donc le même
    // à chaque essai et pour tous les joueurs : on peut l'apprendre, et « je bloque au 87 » veut dire la même chose pour tout le monde. Pas en mode clip.
    const hasard = Math.random; if (!clip && !loopMode) Math.random = C.seeded(level * 7919 + OBJETS.indexOf(objet) * 104729 + (prm.v || 0) * 31 + 17);
    const specKey = [level, clip, botStyle].join(), reuse = loopMode && loopSpec && loopSpec.key === specKey ? loopSpec : null;
    if (reuse) best = fromSpec(reuse);
    for (; !reuse && k < GEN_TRIES && !(best && best.score >= prm.target); k++) {
      const g = generate(prm, geo), q = makeQueue(g.cols, g.counts, prm.K), qc = q.map(c => COLORS.indexOf(c));
      const L = solverLevel(g.plates, g.screws, geo), sol = solve(L, qc, prm.T, solverStart(L, qc, prm.K, prm.T)); if (!sol) continue;
      const greedy = greedySolves(L, qc, prm.T, solverStart(L, qc, prm.K, prm.T)), score = (greedy ? 0 : 2) + sol.peak;
      if (!best || score > best.score) best = { g, q, qc, sol, score, greedy };
    }
    // aucun candidat solvable avec les nouveautés (rare) : on recommence sans elles plutôt que de livrer un niveau douteux
    for (let j = 0; !best && prm.feats && j < 40; j++) {
      const p0 = Object.assign({}, prm, { feats: null }), g = generate(p0, geo), q = makeQueue(g.cols, g.counts, prm.K), qc = q.map(c => COLORS.indexOf(c));
      const L = solverLevel(g.plates, g.screws, geo), sol = solve(L, qc, prm.T, solverStart(L, qc, prm.K, prm.T)); if (!sol) continue;
      best = { g, q, qc, sol, score: sol.peak, greedy: greedySolves(L, qc, prm.T, solverStart(L, qc, prm.K, prm.T)) };
    }
    if (!best) {   // aucun candidat solvable dans le budget : on prend un niveau tel quel, le bot jouera en glouton
      const g = generate(prm), q = makeQueue(g.cols, g.counts, prm.K);
      best = { g, q, qc: q.map(c => COLORS.indexOf(c)), sol: { path: [], peak: 0, nodes: 0 }, score: -1, greedy: false };
    }
    Math.random = hasard;
    if (loopMode && !reuse) loopSpec = toSpec(best, specKey);
    gemK *= zoomLevel(best.g);
    genTries = k; plates = best.g.plates; screws = best.g.screws; total = screws.length; colorsN = new Set(screws.map(s => s.color)).size;
    queue = best.q; queueC = best.qc; queueIdx = 0; plan = best.sol.path.slice(); planIdx = 0;
    par = best.sol.uses || 0;
    levelDiff = { score: best.score, target: prm.target, greedy: best.greedy, peak: best.sol.peak, par, nodes: best.sol.nodes, genMs: Date.now() - t0ms, nouv: best.g.feats || null };
    // tout est en place dès la première image : tablettes et écrins sans animation d'entrée
    for (let i = 0; i < openN; i++) newBox(i, true);
    const nom = objet.name && (C.byLang(objet.name)); if (nom && !clip && !loopMode) C.after(.25, () => C.floatText(W / 2, BOARD.y + BOARD.h - 70, nom, { color: GOLD_LIGHT, stroke: '#1a1005', size: 58, dur: 1.8 }));
    // et une première gemme part tout de suite, pour que la première frame montre déjà l'action (après le rideau s'il y en a un).
    // Clips seulement : dans le jeu (coquille), c'est le joueur qui tape la première gemme, guidé au niveau 1 par le tutoriel.
    const first = global.Shell && !clip && !loopMode ? null : screws[plan[0]];
    initT = C.time; if (global.Shell && level === 1) Shell.hint('ecrin.tap', { path: hintPath, text: tr('Touche une gemme : elle rejoint l’écrin de sa couleur'), textY: 1850 });
    if (first) { if (curtained) C.after(.7, () => { if (first.state === 'on') tapScrew(first); }); else tapScrew(first); }
  }

  // ------------------------------------------------------------ politique (partagée par le bot, le vérificateur et le 1er coup)
  // w = { plates, screws, boxes, buffer } : l'état réel (live()) ou la copie simulée par solvable()
  // tutoriel (coquille, niveau 1 au premier lancement) : la main tape la gemme que jouerait le bot ; appris à la première gemme dessertie
  let initT = 0;
  function hintPath() {
    if (state !== 'play' || C.time - initT < .6) return null;
    const s = pickTarget(live()); return s ? [[s.x, s.y]] : null;
  }
  function remaining(w, color) { return w.screws.filter(s => s.color === color && s.state !== 'box').length; }
  function freeSlot(b) { return b.slots.indexOf(null); }
  // l'écrin ouvert de cette couleur le plus rempli (deux écrins ouverts peuvent avoir la même couleur) : même choix que le solveur
  function openBox(w, color) { return w.boxes.filter(b => b && b.state === 'in' && b.color === color && freeSlot(b) >= 0).sort((a, b) => b.slots.filter(x => x).length - a.slots.filter(x => x).length)[0] || null; }
  // dégagée : rien ne la couvre et sa pièce n'est pas cadenassée
  function freeGem(w, s) {
    if (s.state !== 'on' || s.plate.state !== 'on') return false;
    if (s.plate.lockKey && s.plate.lockKey.state === 'on') return false;
    for (const p of w.plates) if (p !== s.plate && p.state === 'on' && p.z > s.plate.z && covers(p, s.x, s.y)) return false;
    return true;
  }
  const partner = s => s.pair && s.pair.state === 'on' ? s.pair : null;   // sa partenaire de chaîne, tant qu'elle est sertie
  // jouable : dégagée, et sa partenaire de chaîne aussi (elles partent ensemble)
  function reachable(w, s) { if (!freeGem(w, s)) return false; const h = partner(s); return !h || freeGem(w, h); }
  // où iraient la gemme et sa partenaire si on la tapait : [{ s, box }] (box null : le présentoir), ou null s'il manque une place
  function placing(w, s) {
    const out = [], used = new Map(), free = w.buffer.filter(x => !x).length, fill = b => b.slots.filter(x => x).length + (used.get(b) || 0); let nbuf = 0;
    for (const g of partner(s) ? [s, s.pair] : [s]) {
      const b = w.boxes.filter(b => b && b.state === 'in' && b.color === g.color && fill(b) < 3).sort((a, c) => fill(c) - fill(a))[0] || null;
      if (b) used.set(b, (used.get(b) || 0) + 1); else if (++nbuf > free) return null;
      out.push({ s: g, box: b });
    }
    return out;
  }
  // politique gloutonne (bot humain et secours) : la gemme à taper maintenant, ou null si rien n'est jouable
  function pickTarget(w) {
    const on = w.screws.filter(s => s.state === 'on' && reachable(w, s) && placing(w, s));
    if (!on.length) return null;
    const inBox = on.filter(s => openBox(w, s.color));
    if (inBox.length) {
      // préférer l'écrin le plus rempli, puis la gemme qui libère une tablette
      const score = s => openBox(w, s.color).slots.filter(x => x).length * 10 + (s.plate.screws.length === 1 ? 5 : 0) + s.plate.z * .01;
      inBox.sort((a, b) => score(b) - score(a)); return inBox[0];
    }
    if (!w.buffer.some(x => !x)) return null;
    // sinon vers le présentoir : gemme de la couleur du prochain écrin de la file, et qui libère une tablette
    const nb = c => w.buffer.filter(s => s && s.color === c).length, next = queue[queueIdx];
    const sc = s => (s.color === next ? 6 : 0) + (s.plate.screws.length === 1 ? 4 : 0) + nb(s.color) * 2 + s.plate.z * .01;
    on.sort((a, b) => sc(b) - sc(a)); return on[0];
  }

  // ------------------------------------------------------------ écrins
  function newBox(i, first) {
    // l'écrin suivant de la file, fixée à la génération
    if (queueIdx >= queue.length) { boxes[i] = null; return; }
    const color = queue[queueIdx++];
    const b = { i, x: boxX(i) + (first ? 0 : W), hx: boxX(i), y: BOX_Y, color, slots: [null, null, null], state: 'in', lid: 0, s: 1, wob: 0 };
    boxes[i] = b;
    if (!first) { snd.slide(); C.tween(b, { x: boxX(i) }, .45, { ease: ease.outBack }); }
    // les gemmes du présentoir de cette couleur sont réservées tout de suite (même état que dans solvable()), puis s'envolent
    let d = first ? 0 : .4;
    for (const s of reserve.slice()) { const slot = freeSlot(b); if (s.color === color && slot >= 0) { reserve.splice(reserve.indexOf(s), 1); b.slots[slot] = s; C.after(d, () => flyToBox(s, b, slot)); d += .12; } }
    layoutReserve();
    for (let k = 0; k < bufN; k++) {
      const s = buffer[k], slot = freeSlot(b);
      if (s && s.color === color && slot >= 0) { buffer[k] = null; b.slots[slot] = s; C.after(d, () => flyToBox(s, b, slot)); d += .12; }
    }
  }
  function slotPos(b, k, x = b.x) { return { x: x - 100 + k * 100, y: b.y + 8 }; }   // x = b.hx : position d'arrivée, même si l'écrin glisse encore
  function bufPos(k) { return { x: bufX0() + k * bufSp(), y: BUF_Y }; }

  // ------------------------------------------------------------ interactions
  function pointerDown(sx, sy) {
    const [x, y] = toGame(sx, sy);
    if (aim === 'hammer' && state === 'play') {   // le marteau attend sa pièce : celle du dessus sous le doigt (un ornement désigne sa porteuse)
      const p = plates.filter(p => p.state === 'on').sort((a, b) => b.z - a.z).find(p => covers(p, x, y, 0));
      if (p) hammer(p.support && p.support.state === 'on' ? p.support : p);
      return;
    }
    if (state === 'stuck') { const B = RESCUE_BTN; if (Math.abs(x - B.x) < B.w / 2 && Math.abs(y - B.y) < B.h / 2) { if (global.Shell) Shell.requestRescue({ onAccept: rescue, onDecline() { rescued = true; state = 'play'; checkDeadlock(); } }); else rescue(); } return; }   // coquille : 60 pièces ou une pub ; refus = défaite (cet écran n'a pas de bouton recommencer)
    if (state !== 'play') return;
    // recherche du haut vers le bas
    const sorted = plates.filter(p => p.state === 'on').sort((a, b) => b.z - a.z);
    for (const p of sorted) {
      for (const s of p.screws) if (s.state === 'on' && dist(x, y, s.x, s.y) < SCREW_R * gemK + 22) { tapScrew(s); return; }
      if (covers(p, x, y, 0)) {
        // une gemme couverte sous le doigt : on la vise (et les tablettes qui la bloquent s'éclairent)
        const under = screws.find(s => s.state === 'on' && s.plate.z < p.z && dist(x, y, s.x, s.y) < SCREW_R * gemK + 10);
        if (under) tapScrew(under); else wobble(p);
        return;
      }
    }
  }
  // secours après blocage : une place de plus sur le présentoir, une seule fois par niveau
  function rescue() {
    if (state !== 'stuck') return;
    rescued = true; bufN++; buffer.push(null); state = 'play'; duck(1);
    snd.shelf(); snd.combo(2);
    const t = bufPos(bufN - 1);
    C.burst(t.x, t.y, { colors: [GOLD_LIGHT, '#ffffff', GOLD], count: 22, speed: 520, size: 9, life: .7 });
    C.floatText(W / 2, BUF_Y - 110, tr('+1 PLACE'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 64, dur: 1.1 });
  }
  // ------------------------------------------------------------ AIDES (8 oct. 2026), déclarées à la coquille (boosts) qui pose leurs boutons en bas de l'écran
  //   slot   une place de plus sur le présentoir, pour le niveau en cours (sept places au plus)
  //   clear  le présentoir se vide : ses gemmes passent en réserve
  //   hammer le marteau brise une pièce : ses gemmes partent dans leur écrin s'il est ouvert, sinon en réserve
  // LA RÉSERVE : petites gemmes posées sur le rebord du présentoir, sans limite de place. Elles ne se jouent pas : chacune rejoint le prochain écrin
  // de sa couleur dès qu'il s'ouvre, avant celles du présentoir. Une aide sert aussi à se sortir d'un blocage (la proposition de secours se retire).
  let reserve = [], aim = null;
  const resPos = i => ({ x: W / 2 + (i - (reserve.length - 1) / 2) * Math.min(46, 900 / Math.max(1, reserve.length)), y: BUF_Y - 69 });
  function layoutReserve() { reserve.forEach((s, i) => { if (s.state !== 'reserve') return; const t = resPos(i); C.tween(s, { x: t.x, y: t.y }, .25, { ease: ease.outCubic }); }); }
  function flyToReserve(s) {
    s.state = 'fly';
    const t = resPos(reserve.indexOf(s));
    C.tween(s, { x: t.x, y: t.y, s: .42, lift: 0, rot: 0 }, .34, { ease: ease.inOutCubic, onDone() { s.state = 'reserve'; snd.tick(); layoutReserve(); } });
  }
  function setAim(key) { aim = key; if (global.Shell && Shell.boostAim) Shell.boostAim(key); }
  function useBoost(key) {   // appelé par la coquille quand le joueur touche une aide qu'il possède ; false si elle ne peut pas servir maintenant
    if ((state !== 'play' && state !== 'stuck') || bot.active || finale) return false;
    const refuse = txt => { snd.blocked(); C.floatText(W / 2, BUF_Y - 150, txt, { color: '#ff9fb8', stroke: '#1a1005', size: 50, dur: 1 }); return false; };
    if (key === 'slot' && bufN >= 7) return refuse(tr('PRÉSENTOIR AU MAXIMUM'));
    if (key === 'clear' && !buffer.some(x => x)) return refuse(tr('PRÉSENTOIR DÉJÀ VIDE'));
    if (key === 'hammer' && !plates.some(p => p.state === 'on' && p.screws.length)) return false;
    if (state === 'stuck') { state = 'play'; duck(1); }   // une aide vaut un secours : on rejoue
    plan = null;
    if (key === 'hammer') { setAim(aim === key ? null : key); if (!aim) C.after(.1, checkDeadlock); else C.floatText(W / 2, BOARD.y + 190, tr('TOUCHE UNE PIÈCE'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 54, dur: 1.4 }); return true; }
    setAim(null);
    if (key === 'slot') {
      bufN++; buffer.push(null); snd.shelf(); snd.combo(2);
      const t = bufPos(bufN - 1);
      C.burst(t.x, t.y, { colors: [GOLD_LIGHT, '#ffffff', GOLD], count: 22, speed: 520, size: 9, life: .7 });
      C.floatText(W / 2, BUF_Y - 110, tr('+1 PLACE'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 64, dur: 1.1 });
    } else {
      let d = 0;
      buffer.forEach((g, k) => { if (!g || g.state !== 'buffer') return; buffer[k] = null; reserve.push(g); g.state = 'fly'; C.after(d, () => flyToReserve(g)); d += .07; });
      snd.slide(); C.floatText(W / 2, BUF_Y - 110, tr('PRÉSENTOIR VIDÉ'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 60, dur: 1.1 });
    }
    if (global.Shell) Shell.boostUsed(key);
    C.after(.9, checkDeadlock); return true;
  }
  function hammer(p) {
    setAim(null); plan = null;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    C.shake(12, .25); snd.drop(); C.haptic('medium');
    C.burst(cx, cy, { colors: [p.color, GOLD_LIGHT, '#ffffff'], count: 36, speed: 760, size: 13, life: .8, gravity: 1300, spread: Math.PI * 2 });
    p.flash = 1; C.tween(p, { flash: 0 }, .5, { ease: ease.outQuad });
    const gems = p.screws.slice();
    if (!gems.length) dropPlate(p);
    for (const g of gems) {
      if (g.mystery) unveil(g, true);
      if (g.key) openLock(g);
      const box = openBox(live(), g.color);
      if (box) { const slot = freeSlot(box); box.slots[slot] = g; unscrew(g, () => flyToBox(g, box, slot)); }
      else { reserve.push(g); unscrew(g, () => flyToReserve(g)); }
    }
    if (global.Shell) Shell.boostUsed('hammer');
    C.after(1.2, checkDeadlock);
  }
  function wobble(p) { C.killTweens(p); p.rot = .03; C.tween(p, { rot: 0 }, .45, { ease: ease.outElastic }); snd.tick(); }

  // les tablettes qui recouvrent une gemme s'éclairent en rouge : on voit pourquoi le tap ne marche pas
  function showBlockers(s) {
    for (const p of plates) if (p !== s.plate && p.state === 'on' && p.z > s.plate.z && covers(p, s.x, s.y)) {
      p.flash = 1; C.tween(p, { flash: 0 }, .7, { ease: ease.outQuad });
    }
    snd.blocked();
  }
  // gemme cadenassée : sa clé se signale (si elle est visible) et le plateau dit ce qu'il manque
  function showLock(s) {
    const k = s.plate.lockKey; k.reveal = 1; C.tween(k, { reveal: 0 }, .9, { ease: ease.outQuad }); snd.blocked();
    C.floatText(clamp(s.x, 220, W - 220), s.y - 80, tr('IL FAUT LA CLÉ'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 46, dur: 1 });
  }
  // gemme mystère dévoilée : anneau blanc et éclats de sa vraie couleur
  function unveil(s, quiet) {
    s.mystery = false; s.reveal = 1; C.tween(s, { reveal: 0 }, .8, { ease: ease.outQuad }); if (!quiet) snd.reveal(2);
    C.burst(s.x, s.y, { colors: [s.color, GOLD_LIGHT, '#ffffff'], count: 14, speed: 320, size: 8, life: .6, gravity: 0, drag: 3 });
  }
  // chaque écrin fermé dévoile une gemme mystère, de préférence une que l'on voit
  function unveilOne() {
    const w = live(), M = screws.filter(s => s.state === 'on' && s.mystery); if (!M.length) return;
    unveil(M.find(s => freeGem(w, s)) || M[0]);
  }
  // la gemme à la clé s'en va : les cadenas de sa pièce sautent
  function openLock(key) {
    const p = key.key; if (!p) return;
    snd.unlock();
    p.screws.forEach((g, i) => C.after(.12 + i * .06, () => { if (g.state !== 'on') return; g.reveal = 1; C.tween(g, { reveal: 0 }, .7, { ease: ease.outQuad }); C.burst(g.x, g.y, { colors: [GOLD_LIGHT, '#ffffff', GOLD], count: 12, speed: 360, size: 8, life: .6, gravity: 500 }); }));
    C.floatText(clamp(p.x + p.w / 2, 240, W - 240), p.y + p.h / 2 - 60, tr('DÉVERROUILLÉ !'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 54, dur: 1.1 });
  }
  function tapScrew(s) {
    const w = live();
    if (!reachable(w, s)) {
      wobble(s.plate);
      const cov = g => w.plates.some(p => p !== g.plate && p.state === 'on' && p.z > g.plate.z && covers(p, g.x, g.y)), h = partner(s);
      if (!cov(s) && s.plate.lockKey && s.plate.lockKey.state === 'on') showLock(s); else showBlockers(!cov(s) && h ? h : s);
      return;
    }
    // la gemme et, si elle est enchaînée, sa partenaire : il faut une place pour chacune
    const dest = placing(w, s);
    if (!dest) {   // tout est plein
      snd.full(); C.shake(8, .2); C.flash('#FF6FD0', .12);
      C.floatText(s.x, s.y - 80, tr('PLEIN !'), { color: '#ff7fb0', size: 64 });
      checkDeadlock(); return;
    }
    // suivi du plan du solveur : un coup hors plan l'invalide (le bot parfait re-résoudra depuis l'état réel)
    if (plan) { if (plan[planIdx] === screws.indexOf(s)) planIdx++; else plan = null; }
    if (global.Shell && !bot.active) Shell.hintDone('ecrin.tap');
    if (dest.length > 1) snd.links();
    for (const { s: g, box } of dest) {
      if (g.mystery) unveil(g, true);
      if (g.key) openLock(g);
      if (box) { const slot = freeSlot(box); box.slots[slot] = g; unscrew(g, () => flyToBox(g, box, slot)); }
      else { const k = buffer.indexOf(null); buffer[k] = g; trayUses++; unscrew(g, () => flyToBuffer(g, k)); }
    }
  }
  function unscrew(s, then) {
    s.state = 'fly'; s.s = gemK; s.plate.screws.splice(s.plate.screws.indexOf(s), 1);   // elle reprend sa taille normale en s'envolant
    s.plate.holes.push({ x: s.x - s.plate.x, y: s.y - s.plate.y });
    snd.unset();
    C.burst(s.x, s.y, { color: GOLD_LIGHT, count: 6, speed: 260, size: 7, gravity: 300, life: .5 });
    C.tween(s, { rot: Math.PI * 3, lift: 1, s: 1.25 }, .26, { ease: ease.outQuad, onDone: then });
    const p = s.plate;
    if (p.screws.length === 0) C.after(.3, () => dropPlate(p));
    else if (p.screws.length === 1) { p.sag = 0; C.tween(p, { sag: 1 }, 1.3, { ease: ease.outElastic }); }   // la pièce ne tient plus qu'à une gemme : elle pend et se balance autour d'elle
  }
  function flyToBox(s, b, k) {
    s.state = 'fly';
    const t = slotPos(b, k, b.hx);
    // dernière gemme du niveau : vol au ralenti, gemme agrandie, glissando (le reste de la scène continue)
    const last = total - boxed - screws.filter(x => x.state === 'fly').length <= 0;
    if (last) {
      slowGem = s; duck(.5); snd.slowmo();
      C.tween(s, { s: 1.9 }, .45, { ease: ease.outCubic }); C.after(.75, () => C.tween(s, { s: 1 }, .4, { ease: ease.inCubic }));
    }
    const to = { x: t.x, y: t.y, lift: 0, rot: 0 }; if (!last) to.s = 1;
    C.tween(s, to, last ? 1.15 : .32, {
      ease: ease.inOutCubic, onDone() {
        s.state = 'box'; boxed++; if (last) { slowGem = null; s.s = 1; }
        snd.set(k); b.wob = 1; C.tween(b, { wob: 0 }, .4);
        // l'alvéole s'allume et le velours s'éclaire un instant
        b.slotFlash = 1; b.flashK = k; C.tween(b, { slotFlash: 0 }, .5, { ease: ease.outQuad });
        b.glow = 1; C.tween(b, { glow: 0 }, .45, { ease: ease.outQuad });
        C.burst(t.x, t.y, { colors: [s.color, GOLD_LIGHT, '#ffffff'], count: 12, speed: 480, size: 10, life: .7 });
        // combo : deux gemmes dans le même écrin en moins de 1,3 s
        b.combo = tm - (b.lastLand === undefined ? -9 : b.lastLand) < 1.3 ? (b.combo || 1) + 1 : 1; b.lastLand = tm;
        if (b.combo >= 2) {
          snd.combo(b.combo);
          C.floatText(clamp(b.hx, 260, W - 260), b.y - 150, 'x' + b.combo, { color: GOLD_LIGHT, stroke: '#2a1a05', size: 70 + b.combo * 8, dur: 1.1 });
          C.burst(t.x, t.y, { colors: [GOLD_LIGHT, '#ffffff', s.color], count: 6 + b.combo * 5, speed: 650, size: 11, life: .8 });
          for (let i = 0; i < b.combo * 2; i++) sparks.push({ x: b.hx + rand(-140, 140), y: b.y + rand(-90, 90), t: -i * .05, dur: .5, size: rand(14, 28), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba('#fff0be', 1) });
        }
        if (b.slots.every(x => x && x.state === 'box')) closeBox(b);
      }
    });
  }
  function flyToBuffer(s, k) {
    s.state = 'fly';
    const t = bufPos(k);
    C.tween(s, { x: t.x, y: t.y, s: .95, lift: 0, rot: 0 }, .3, { ease: ease.inOutCubic, onDone() { s.state = 'buffer'; snd.tray(); checkDeadlock(); } });
  }
  function closeBox(b) {
    b.state = 'closing';
    C.after(.15, () => { snd.close(); C.tween(b, { lid: 1 }, .28, { ease: ease.outBack, onDone() { C.shake(6, .15); } }); });
    C.after(.5, () => {
      C.confetti(b.x, b.y - 60, { count: 45, speed: 1100, colors: [b.color, GOLD, GOLD_LIGHT, '#ffffff', CREAM] });
      C.floatText(clamp(b.x, 220, W - 220), b.y - 170, tr('COMPLET !'), { color: GOLD_LIGHT, stroke: '#1a1005', size: 66, dur: 1.1 });
      unveilOne();
      // une miniature de l'écrin s'envole vers la vitrine du haut
      const f = { x: b.x, y: b.y - 30, k: 3, color: b.color }, tgt = shelfPos(shelf.length + flyers.length); flyers.push(f);
      C.tween(f, { x: tgt.x, y: tgt.y, k: 1 }, .75, { ease: ease.inOutCubic, onDone() { flyers.splice(flyers.indexOf(f), 1); shelf.push(f.color); snd.shelf(); C.burst(tgt.x, tgt.y, { colors: [GOLD_LIGHT, '#ffffff', f.color], count: 10, speed: 300, size: 7, life: .5, gravity: 200 }); } });
      // l'écrin plein part à gauche pendant que le suivant arrive à droite : le bot n'attend que 0,5 s
      b.state = 'out'; boxes[b.i] = null; leaving.push(b); snd.slide();
      C.tween(b, { x: -400 }, .4, { ease: ease.inBack, onDone() { leaving.splice(leaving.indexOf(b), 1); if (boxed >= total) levelComplete(); } });
      if (boxed < total) newBox(b.i, false);
    });
  }
  function dropPlate(p, chain = 0) {
    const w = live(), before = new Set(screws.filter(s => s.state === 'on' && reachable(w, s)));
    // la tablette se décroche : petit sursaut, rotation du côté où elle pendait, puis chute (physique dans update)
    const side = p.tilt ? Math.sign(p.tilt) : Math.random() < .5 ? 1 : -1;
    p.state = 'falling'; p.rot += p.tilt; p.tilt = 0; p.vy = -420; p.vx = -side * rand(40, 130); p.vrot = side * rand(.9, 1.8); p.trail = []; p.bounced = false;
    snd.drop(); C.shake(4 + chain * 3, .12); if (chain) snd.chain(chain);
    // les tablettes posées sur celle-ci se décrochent à leur tour, l'une après l'autre (elles ne bloquent plus rien dès maintenant)
    plates.filter(q => q.support === p && q.state === 'on').forEach((q, i) => { q.state = 'pending'; C.after(.16 * (i + 1), () => dropPlate(q, chain + i + 1)); });
    C.burst(p.x + p.w / 2, p.y + p.h / 2, { colors: ['#ffffff', GOLD_LIGHT], count: 16, speed: 520, size: 9, gravity: 800 });
    // les gemmes qu'elle révèle s'allument une à une : anneau blanc, étincelles, note claire
    const revealed = screws.filter(s => s.state === 'on' && !before.has(s) && reachable(w, s));
    revealed.forEach((s, i) => {
      s.reveal = 0;
      C.after(.25 + i * .07, () => {
        s.reveal = 1; C.tween(s, { reveal: 0 }, .8, { ease: ease.outQuad }); snd.reveal(i);
        const sc = s.mystery ? GOLD : s.color;   // une gemme mystère ne trahit pas sa couleur
        C.burst(s.x, s.y, { colors: [GOLD_LIGHT, '#ffffff', sc], count: 10, speed: 260, size: 6, life: .5, gravity: 0, drag: 3 });
        for (let k = 0; k < 3; k++) sparks.push({ x: s.x + rand(-30, 30), y: s.y + rand(-30, 30), t: -k * .08, dur: .5, size: rand(14, 26), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba(shade(sc, .4), 1) });
      });
    });
  }
  function checkDeadlock() {
    if (state !== 'play') return;
    const w = live();
    // bloqué : plus aucune gemme jouable (sans chaîne ni cadenas, cela veut dire présentoir plein et aucun écrin pour les gemmes dégagées)
    if (!screws.some(s => s.state === 'on') || screws.some(s => s.state === 'fly')) return;
    if (boxes.some(b => b && b.state !== 'in')) { C.after(.35, checkDeadlock); return; }   // un écrin se ferme : le suivant peut tout changer
    const any = screws.some(s => s.state === 'on' && reachable(w, s) && placing(w, s));
    if (!any) {
      // première fois : on propose le secours « +1 place » (futur emplacement de la pub récompensée) au lieu de recommencer
      // (le bot « suspense raté » n'y a pas droit : son clip se termine sur le blocage)
      if (global.Shell) Shell.levelFailed({ level });   // coquille : chaque blocage compte (proposition de secours, puis perdu)
      if (!rescued && !(bot.active && botStyle === 3)) { state = 'stuck'; snd.lost(); duck(.3); return; }
      state = 'lost'; snd.lost(); duck(.3);
      C.showBanner(tr('BLOQUÉ !'), C.kit.endcard('fail', tr('On recommence…')), 2.2, '#ff7fb0');   // carte de fin (kit de clip) : une question qui appelle les commentaires
      C.after(2, () => C.restart());
    }
  }
  // cartes de fin (kit de clip commun, `?endcard=0` pour retirer) : une question sous les étoiles à la victoire, dans la bannière au blocage
  C.kit.setup({
    endcards: { fr: ['Tu l’aurais eu ?', 'Niveau suivant ?', 'Trop facile ? Dis-le en commentaire', 'Le présentoir t’aurait débordé ?'],
                en: ['Would you have made it?', 'Next level?', 'Too easy? Say it in the comments', 'Would your tray have overflowed?'] },
    failcards: { fr: ['Tu vois où il s’est bloqué ?', 'Il avait la place, non ?', 'Tu l’aurais sorti de là ?', 'Dis-moi la gemme à jouer en premier'],
                 en: ['Can you see where he got stuck?', 'He had room, right?', 'Could you have gotten out of that?', 'Tell me which gem to play first'] },
  });
  function levelComplete() {
    state = 'done'; snd.win(); duck(.35);
    // durée du final selon le nombre d'lumières du décor (flamboiement une à une), puis nom, puis étoiles de score
    const n = sky.stars.length, tStars = .5 + n * .2 + .6;
    finale = { t: 0, stars: starsNow(), popped: 0, pinged: 0, flared: 0, tStars, dur: tStars + 3 * .32 + 1.3, card: C.kit.endcard('win', '') };
    C.confetti(W / 2, BOARD.y + BOARD.h / 2, { count: 120, speed: 1600, spread: Math.PI * 2, colors: [GOLD, GOLD_LIGHT, '#ffffff', CREAM, ...COLORS] });
    for (let i = 0; i < 14; i++) sparks.push({ x: rand(BOARD.x, BOARD.x + BOARD.w), y: rand(BOARD.y, BOARD.y + BOARD.h), t: -i * .05, dur: .7, size: rand(18, 34), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba('#fff0be', 1) });
    // le rideau de velours se baisse, puis le niveau suivant démarre derrière et le rideau se relève (dans init)
    // mode boucle : coupe franche pendant la révélation (la figure flamboie, le nom vient d'apparaître), et le même niveau repart
    if (loopMode) { C.after(.5 + sky.stars.length * .2 + .8, () => C.restart()); return; }
    // coquille : écran de résultat à la fin du final (lumières, nom, étoiles) ; sans coquille, rideau et niveau suivant comme au proto
    const st = starsNow(), t = tm - levelStart;
    if (global.Shell) { C.after(finale.dur, () => Shell.levelWon({ level, stars: st, time: t })); return; }
    C.after(finale.dur, () => { snd.slide(); C.tween(curtain, { v: 1 }, .6, { ease: ease.inCubic, onDone() { level++; C.restart(); } }); });
  }
  // accroche : gros texte blanc cerné de noir, comme les textes natifs de TikTok (seconde ligne dorée), à la place de l'en-tête du niveau
  function drawHook() {
    const lines = HOOKS[hookIdx - 1].replace('{n}', shownLevel()).split('|'), two = lines.length > 1;
    lines.forEach((ln, i) => {
      const size = C.fitSize(ln, two ? 58 : 70, W - 120);
      text(ln, W / 2, two ? 70 + i * 68 : 104, { size, color: i ? '#ffe27a' : '#ffffff', stroke: '#000', strokeW: 12 });
    });
  }
  function nextHook() { hookIdx = (hookIdx + 1) % (HOOKS.length + 1); }
  function toggleLoop() {
    loopMode = !loopMode; loopSpec = null;
    const el = document.getElementById('legend'); const li = el && el.querySelector && el.querySelector('[data-k="l"]'); if (li) li.classList.toggle('on', loopMode);
    if (loopMode) C.restart();
    C.floatText(W / 2, BOARD.y + 90, loopMode ? 'MODE BOUCLE' : 'BOUCLE COUPÉE', { color: GOLD_LIGHT, stroke: '#1a1005', size: 54, dur: 1.2 });
  }
  function applyFilm() { C.pointer.showFinger = true; if (document.body && document.body.classList) document.body.classList.toggle('film', film); }   // classe `film` : l'aide reste cachée même après H
  function toggleFilm() { film = !film; applyFilm(); C.floatText(W / 2, BOARD.y + 90, film ? 'MODE TOURNAGE' : 'MODE NORMAL', { color: GOLD_LIGHT, stroke: '#1a1005', size: 54, dur: 1.2 }); }
  function toggleClip() {
    clip = !clip;
    const el = document.getElementById('legend'); const li = el && el.querySelector && el.querySelector('[data-k="c"]');
    if (li) li.classList.toggle('on', clip);
    C.restart();
  }

  // ------------------------------------------------------------ boucle
  function update(dt) {
    tm += dt; updateMusic();
    // étincelles, poussière d'or, traînée dorée derrière les gemmes en vol
    sparkT -= dt; if (sparkT <= 0) { sparkT = rand(.04, .11); spawnSpark(); }
    for (let i = sparks.length - 1; i >= 0; i--) { sparks[i].t += dt; if (sparks[i].t >= sparks[i].dur) sparks.splice(i, 1); }
    updateDust(dt);
    // présentoir presque plein : battement de cœur, plus rapide et plus fort quand il est plein
    const trayN = buffer.filter(x => x).length;
    if (state === 'play' && trayN >= bufN - 1) { hbT -= dt; if (hbT <= 0) { const fullT = trayN >= bufN; snd.heart(fullT ? 1 : .6); hbT = fullT ? .6 : .95; } } else hbT = 0;
    // final : cascade de rebonds sur la vitrine, étoiles qui apparaissent une à une
    if (finale) {
      finale.t += dt;
      while (finale.pinged < shelf.length && finale.t > .3 + finale.pinged * .09) { bell(mid(74 + finale.pinged * 2), { vol: .07, dur: .6 }); finale.pinged++; }
      // flamboiement des lumières du décor une à une, puis accord à l'apparition du nom
      while (finale.flared < sky.stars.length && finale.t > .4 + finale.flared * .2) { const st = sky.stars[finale.flared]; snd.flare(finale.flared); C.burst(st.x, st.y, { colors: ['#ffffff', GOLD_LIGHT, '#cfe4ff'], count: 14, speed: 380, size: 7, life: .7, gravity: 0, drag: 2.5 }); finale.flared++; }
      if (!finale.named && finale.t > .5 + sky.stars.length * .2) { finale.named = true; snd.close(); }
      while (finale.popped < 3 && finale.t > finale.tStars + finale.popped * .32) {
        const i = finale.popped++, x = W / 2 + (i - 1) * 130, y = BOARD.y + BOARD.h - 42;
        if (i < finale.stars) { snd.star(i); C.burst(x, y, { colors: [GOLD_LIGHT, '#ffffff', GOLD], count: 18, speed: 520, size: 9, life: .7 }); for (let k = 0; k < 4; k++) sparks.push({ x: x + rand(-60, 60), y: y + rand(-60, 60), t: -k * .05, dur: .5, size: rand(16, 30), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba('#fff0be', 1) }); }
      }
    }
    // lumières du décor qui s'allument (une étoile pleine = environ un écrin fermé), étoile de score perdue
    sky.stars.forEach((st, i) => {
      if (st.lit || starGlow(i) < 1) return;
      st.lit = true; st.litAt = tm; snd.starLit(i);
      C.burst(st.x, st.y, { colors: ['#ffffff', GOLD_LIGHT, '#cfe4ff'], count: 16, speed: 420, size: 7, life: .7, gravity: 0, drag: 2.5 });
      for (let k = 0; k < 4; k++) sparks.push({ x: st.x + rand(-40, 40), y: st.y + rand(-40, 40), t: -k * .06, dur: .6, size: rand(18, 30), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba('#fff0be', 1) });
    });
    const st = starsNow();
    if (st < starsPrev && state === 'play') { snd.starLost(); const sx = 760 + st * 50; C.burst(sx, LEVEL_Y, { colors: ['#ffffff', GOLD_LIGHT], count: 10, speed: 220, size: 6, life: .5, gravity: 300 }); }
    starsPrev = st;
    for (const s of screws) if (s.state === 'fly') C.burst(s.x + rand(-10, 10), s.y - s.lift * 30 + rand(-10, 10), { colors: [GOLD_LIGHT, '#ffffff', s.color], count: 2, speed: 70, size: 7, life: .4, gravity: 0, drag: 3 });
    // les gemmes rangées suivent leur écrin quand il glisse
    for (const b of boxes.concat(leaving)) if (b) b.slots.forEach((s, k) => { if (s && s.state === 'box') { const t = slotPos(b, k); s.x = t.x; s.y = t.y; } });
    for (let i = plates.length - 1; i >= 0; i--) {
      const p = plates[i];
      if (p.state !== 'falling') continue;
      p.vy += 3000 * dt; p.y += p.vy * dt; p.x += (p.vx || 0) * dt; p.rot += p.vrot * dt;
      // images fantômes (une position sur deux) et poussière d'or dans le sillage
      p.trailTick = (p.trailTick || 0) + 1; if (p.trailTick % 2 === 0) { p.trail.unshift({ x: p.x, y: p.y, rot: p.rot }); if (p.trail.length > 3) p.trail.pop(); }
      C.burst(p.x + rand(0, p.w), p.y + rand(0, p.h), { colors: [GOLD_LIGHT, '#ffffff'], count: 1, speed: 40, size: 6, life: .5, gravity: -60, drag: 2 });
      // un rebond sur le bord bas du plateau, puis la tablette s'efface en tombant derrière le présentoir
      const edge = BOARD.y + BOARD.h + 10;
      if (!p.bounced && p.vy > 0 && p.y + p.h > edge) {
        p.bounced = true; p.vy = -p.vy * .38; p.vrot = -p.vrot * .5; snd.bounce(); C.shake(6, .15);
        C.burst(p.x + p.w / 2, edge, { colors: ['#ffffff', GOLD_LIGHT], count: 14, speed: 420, size: 8, gravity: 900, spread: Math.PI * .9 });
      }
      if (p.bounced) p.alpha = clamp(1 - (p.y + p.h - edge) / 520, 0, 1);
      if (p.y > H + 400 || p.alpha <= 0) plates.splice(i, 1);
    }
  }

  // le bot vise en coordonnées écran (le doigt est dessiné par Core) : en mode tournage, le jeu est recadré
  const botTap = (x, y) => { const [sx, sy] = toScreen(x, y); bot.tap(sx, sy); };
  const botHover = (x, y, d) => { const [sx, sy] = toScreen(x, y); bot.moveTo(sx, sy).wait(d); };
  // le rythme du clip : le bot prend son temps au début (on comprend la règle), puis accélère jusqu'à la rafale finale
  const pace = () => total ? lerp(2.2, .35, clamp(boxed / total * 1.15, 0, 1)) : 1;
  function autoplay() {
    if (state === 'stuck') { bot.wait(1.1); botTap(RESCUE_BTN.x, RESCUE_BTN.y); return; }   // le bot accepte le secours
    if (state !== 'play' || curtain.v > 0) { bot.wait(.3); return; }
    // on attend les gemmes en vol et le remplacement des écrins fermés : le bot décide alors sur le même état que solvable()
    const w = live();
    if (screws.some(s => s.state === 'fly') || boxes.some(b => b && b.state !== 'in')) {
      // rafale du bot suspense : pendant la délivrance, il n'attend pas la fin des vols si le prochain coup du plan va droit dans un écrin ouvert
      const nx = ((botStyle >= 2 && drama.phase === 'release' && drama.moves > 0) || (botStyle === 0 && boxed / total > .6)) && plan && screws[plan[planIdx]];   // le bot parfait finit lui aussi en rafale
      if (nx && nx.state === 'on' && reachable(w, nx) && openBox(w, nx.color)) { bot.wait(rand(.02, .08)); botTap(nx.x, nx.y); drama.moves++; return; }
      bot.wait(.08); return;
    }
    if (botStyle >= 2) { autoplayDrama(w); return; }
    if (botStyle === 1) {
      // bot humain : réfléchit, hésite, se trompe parfois (gemme couverte), et joue parfois vers le présentoir sans nécessité
      const on = screws.filter(s => s.state === 'on' && reachable(w, s));
      if (Math.random() < .1) { const cov = screws.filter(s => s.state === 'on' && !reachable(w, s)); if (cov.length) { const c = pick(cov); bot.wait(rand(.15, .35)); botTap(c.x, c.y); return; } }
      if (Math.random() < .3 && on.length > 1) { const o = pick(on); botHover(o.x, o.y, rand(.1, .28)); }
      let target = pickTarget(w);
      if (target && Math.random() < .12 && buffer.filter(x => !x).length >= 3) { const alt = on.filter(s => !openBox(w, s.color)); if (alt.length) target = pick(alt); }
      if (!target) { bot.wait(.2); return; }
      bot.wait(rand(.1, .4) * pace()); botTap(target.x, target.y); return;
    }
    // bot parfait : suit le plan du solveur, re-résout depuis l'état réel si le plan a été invalidé, glouton en dernier recours
    const target = planTarget(w);
    if (!target) { checkDeadlock(); bot.wait(.2); return; }
    bot.wait(rand(.05, .18) * pace()); botTap(target.x, target.y);
  }
  // la prochaine gemme du plan du solveur (re-résolu depuis l'état réel si besoin), sinon le choix glouton
  function planTarget(w) {
    let target = null;
    if (!plan || planIdx >= plan.length) replan();
    if (plan && planIdx < plan.length) { const s = screws[plan[planIdx]]; if (s && s.state === 'on' && reachable(w, s)) target = s; else { replan(); if (plan) target = screws[plan[planIdx]]; } }
    return target || pickTarget(w);
  }
  // l'état réel au format du solveur (gemmes déjà rangées, écrins ouverts et leur remplissage, présentoir, position dans la file)
  function liveStart(L) {
    const bx = boxes.map(b => b && b.state === 'in' ? { c: COLORS.indexOf(b.color), f: b.slots.filter(x => x).length } : null);
    const bf = buffer.filter(x => x).map(s => COLORS.indexOf(s.color));
    return solverStart(L, queueC, openN, bufN, bx, bf, queueIdx, reserve.map(s => COLORS.indexOf(s.color)));
  }
  function replan() {
    const L = solverLevel(plates, screws);
    const sol = solve(L, queueC, bufN, liveStart(L), 6000);
    plan = sol ? sol.path : null; planIdx = 0;
    if (levelDiff) { levelDiff.replans = (levelDiff.replans || 0) + 1; if (!sol) levelDiff.replanFails = (levelDiff.replanFails || 0) + 1; }
  }
  // ------------------------------------------------------------ bot suspense : un clip avec une histoire (calme, montée, sauvetage en rafale)
  // Un coup vers le présentoir choisi pour le spectacle : de préférence de la couleur des prochains écrins de la file (l'écrin qui arrive les aspire : cascade).
  // Le solveur garantit que le niveau reste finissable après ce coup.
  function trayMove() {
    const L = solverLevel(plates, screws), st = liveStart(L);
    const inTray = c => st.buf.filter(x => x === c).length;
    const score = m => { const c = L.gems[m.g].c, q = queueC.slice(queueIdx, queueIdx + 2).indexOf(c); return (q === 0 ? 30 : q === 1 ? 15 : 0) + inTray(c) * 10 + rand(5); };
    const ms = solverMoves(L, st, queueC, bufN).filter(m => m.bi < 0).map(m => ({ m, k: score(m) })).sort((a, b) => b.k - a.k).map(o => o.m);
    for (const m of ms.slice(0, 12)) {
      const sol = solve(L, queueC, bufN, solverApply(L, st, m, queueC), 3000);
      if (sol) return { g: m.g, sol };
    }
    return null;
  }
  // Scénario du style raté : quelques centaines de parties jouées au hasard dans le modèle du solveur (écrin d'abord le plus souvent, sinon le présentoir),
  // depuis l'état réel ; on garde celle qui finit bloquée avec le plus de gemmes jouées. Renvoie la liste des gemmes à taper, ou null si aucune ne se bloque.
  function failScript() {
    const L = solverLevel(plates, screws), st0 = liveStart(L); let best = null;
    for (let i = 0; i < 600 && !(best && i >= 300); i++) {
      let st = st0; const path = [], pBox = i < 300 ? .7 : i < 450 ? .4 : .15;   // si rien ne se bloque, on joue de plus en plus mal
      for (; ;) {
        const ms = solverMoves(L, st, queueC, bufN); if (!ms.length) break;
        const box = ms.filter(m => m.bi >= 0), tray = ms.filter(m => m.bi < 0);
        const m = box.length && (!tray.length || Math.random() < pBox) ? box[0] : pick(tray);
        st = solverApply(L, st, m, queueC); path.push(m.g);
      }
      if (st.done < L.n && path.length && (!best || st.done > best.done)) best = { done: st.done, path };
    }
    return best && best.path;
  }
  function autoplayDrama(w) {
    const D = drama, filled = buffer.filter(x => x).length, left = screws.filter(s => s.state === 'on').length;
    const on = screws.filter(s => s.state === 'on' && reachable(w, s));
    const playPlan = wait => { const t = planTarget(w); if (!t) { checkDeadlock(); bot.wait(.2); return; } bot.wait(wait); botTap(t.x, t.y); D.moves++; };
    // style raté : après le premier sauvetage, le bot suit un scénario qui finit bloqué le plus près possible de la fin
    if (D.phase === 'doomed') {
      const s = screws[D.script[D.k]];
      if (!s || s.state !== 'on' || !reachable(w, s)) { D.script = failScript(); D.k = 0; if (!D.script) { D.phase = 'calm'; D.peaks = 2; } else bot.wait(.1); if (!s) checkDeadlock(); return; }
      const toTray = !openBox(w, s.color), lastMove = D.k === D.script.length - 1;
      // il hésite quand le présentoir se tend, longuement avant le coup de trop ; les coups vers un écrin partent vite
      if ((toTray && filled >= bufN - 2 && on.length > 1) || lastMove) shuffle(on.slice()).slice(0, lastMove ? 2 : 1).forEach(o => botHover(o.x, o.y, rand(.3, .55)));
      bot.wait(toTray ? rand(.2, .35) + filled * .12 : rand(.08, .2)); botTap(s.x, s.y); D.k++; return;
    }
    if (D.phase === 'calm') {
      if (botStyle === 3 && D.peaks >= 1) { D.script = failScript(); D.k = 0; if (D.script) { D.phase = 'doomed'; return; } D.peaks = 2; }
      const need = D.peaks ? 5 : 3;
      if (D.moves >= need && D.peaks < 2 && left >= 8) { D.phase = 'build'; D.tries = 0; }
      else { playPlan(D.peaks ? rand(.08, .2) : rand(.12, .3)); return; }
    }
    if (D.phase === 'build') {
      // la montée : des gemmes vers le présentoir, de plus en plus lentement, jusqu'à l'ambre puis le rouge
      const m = trayMove();
      if (m) {
        const s = screws[m.g]; plan = [m.g, ...m.sol.path]; planIdx = 0;
        if (filled >= 2 && on.length > 1) { const o = pick(on); botHover(o.x, o.y, rand(.2, .4)); }
        bot.wait(rand(.15, .3) + filled * .13); botTap(s.x, s.y);
        if (filled + 1 >= bufN) D.phase = 'hold';
        return;
      }
      // aucun coup d'attente sûr pour l'instant : on tient si le présentoir est déjà tendu, sinon on avance dans le plan et on réessaiera
      D.tries++;
      if (filled >= bufN - 1 || (filled >= bufN - 2 && D.tries > 3)) D.phase = 'hold';
      else if (left < 6) { D.phase = 'release'; D.moves = 0; D.peaks = 2; }
      else { playPlan(rand(.15, .3)); return; }
    }
    if (D.phase === 'hold') {
      // au bord du blocage : le doigt erre, tente un coup impossible (« PLEIN ! » ou gemme couverte), puis se ravise
      bot.wait(.45);
      shuffle(on.slice()).slice(0, 2).forEach(o => botHover(o.x, o.y, rand(.3, .5)));
      const noBox = on.filter(s => !openBox(w, s.color)), cov = screws.filter(s => s.state === 'on' && !reachable(w, s));
      const bad = filled >= bufN && noBox.length ? pick(noBox) : cov.length ? pick(cov) : null;
      if (bad) { botTap(bad.x, bad.y); bot.wait(.85); }
      D.phase = 'release'; D.moves = 0; D.peaks++; return;
    }
    // la délivrance : le coup qui sauve, posé, puis la rafale
    playPlan(D.moves === 0 ? .4 : rand(.03, .09));
    if (botStyle === 3 ? D.moves >= 4 : D.moves >= 6 && filled <= 1) { D.phase = 'calm'; D.moves = 0; }   // style raté : le scénario d'échec prend le relais tôt, tant qu'il reste de quoi se bloquer
  }
  function toggleBotStyle() {
    botStyle = (botStyle + 1) % BOT_STYLES.length; if (drama) drama.phase = 'calm';
    if (clip) C.restart();   // le clip du bot suspense a ses propres réglages de niveau
    const el = document.getElementById('legend'); const li = el && el.querySelector && el.querySelector('[data-k="p"]');
    if (li) { li.classList.toggle('on', botStyle > 0); li.innerHTML = '<b>P</b> ' + BOT_STYLES[botStyle]; }
    C.floatText(W / 2, BOARD.y + 90, BOT_STYLES[botStyle].replace(/ \(.*/, '').toUpperCase(), { color: GOLD_LIGHT, stroke: '#1a1005', size: 54, dur: 1.2 });
  }

  // ------------------------------------------------------------ décor de boutique (pré-dessiné une fois, hors écran)
  let deco = null, damask = null;
  // ------------------------------------------------------------ CACHES DE RENDU (24 sept. 2026) : le PC de tournage (i5-1235U, Iris Xe) tenait 32 à 47 i/s au lieu de 60.
  // Le temps JavaScript n'y est pour rien (2,6 ms par image) : c'est la carte graphique qui peine sur les ombres floues (une par tablette) et les aplats plein
  // écran redessinés à chaque image. Ce qui ne change pas est dessiné une fois hors écran puis recopié : le fond (velours, halo, damas), le velours du plateau,
  // chaque tablette avec son ombre, chaque gemme (par couleur, mise à l'échelle), le corps de chaque écrin. Le rendu est identique ; en headless, dessin direct.
  const offscreen = (w, h) => { if (typeof document === 'undefined' || !document.createElement) return null; const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  let bgCache = null, boardCache = null; const plateSprites = {}, gemSprites = {}, boxSprites = {};
  function drawVelvet(c) {   // fond : velours bleu nuit, halo central, motif damassé
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1c1f52'); g.addColorStop(1, '#08091c'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const v = c.createRadialGradient(W / 2, H * .42, 0, W / 2, H * .42, 1100); v.addColorStop(0, 'rgba(110,95,190,.28)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = v; c.fillRect(0, 0, W, H);
    if (damask) { c.fillStyle = damask; c.fillRect(0, 0, W, H); }
  }
  function drawBoardVelvet(c, bx, by, bw, bh) {   // plateau : velours capitonné (fond, hachures, boutons)
    c.fillStyle = '#1a1c4a'; c.beginPath(); c.roundRect(bx, by, bw, bh, 40); c.fill();
    c.save(); c.beginPath(); c.roundRect(bx, by, bw, bh, 40); c.clip();
    c.strokeStyle = 'rgba(255,255,255,.05)'; c.lineWidth = 2; c.beginPath();
    for (let d = -bh; d < bw + bh; d += 80) { c.moveTo(bx + d, by); c.lineTo(bx + d + bh, by + bh); c.moveTo(bx + d, by + bh); c.lineTo(bx + d + bh, by); }
    c.stroke();
    c.fillStyle = 'rgba(255,225,160,.12)';
    for (let gx = bx + 40; gx < bx + bw; gx += 80) for (let gy = by + 40; gy < by + bh; gy += 80) { c.beginPath(); c.arc(gx, gy, 3, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  function plateSprite(p) {   // nacre et ombre floue d'une tablette, par taille et couleur
    const key = (p.skey || p.w + '|' + p.h) + '|' + p.color; let sp = plateSprites[key];
    if (sp !== undefined) return sp;
    const M = 64; sp = offscreen(p.w + 2 * M, p.h + 2 * M); plateSprites[key] = sp || null; if (!sp) return null;
    const c = sp.getContext('2d'); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 28; c.shadowOffsetY = 12; c.fillStyle = p.color; c.translate(M + p.w / 2, M + p.h / 2); shapePath(c, shapeOf(p)); c.fill(); sp.M = M; return sp;
  }
  function drawGemBody(c, r, color) {   // sertissure, pierre facettée, table, liseré, éclats (c = contexte, origine au centre de la gemme)
    const polyOn = pts => { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); };
    const g = c.createRadialGradient(-r * .35, -r * .35, r * .1, 0, 0, r); g.addColorStop(0, '#fff6c8'); g.addColorStop(.55, '#d9ab3c'); g.addColorStop(1, '#6b4a0c');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(80,50,0,.45)'; c.lineWidth = r * .05; c.beginPath(); c.arc(0, 0, r * .9, 0, Math.PI * 2); c.stroke();
    const R = r * .85, N = 8, out = [], inn = [];
    for (let i = 0; i < N; i++) { const a = i * Math.PI * 2 / N + Math.PI / N; out.push([Math.cos(a) * R, Math.sin(a) * R]); inn.push([Math.cos(a) * R * .5, Math.sin(a) * R * .5]); }
    const g2 = c.createRadialGradient(-R * .3, -R * .3, R * .05, 0, 0, R); g2.addColorStop(0, shade(color, .55)); g2.addColorStop(.55, color); g2.addColorStop(1, shade(color, -.5));
    c.fillStyle = g2; polyOn(out); c.fill();
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      c.fillStyle = i % 2 ? 'rgba(255,255,255,.2)' : 'rgba(255,255,255,.04)'; polyOn([out[i], out[j], inn[i]]); c.fill();
      c.fillStyle = i % 2 ? 'rgba(0,0,0,.05)' : 'rgba(0,0,0,.2)'; polyOn([inn[i], inn[j], out[j]]); c.fill();
    }
    c.fillStyle = rgba(shade(color, .3), .6); polyOn(inn); c.fill();   // table
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 1.5; polyOn(out); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.ellipse(-R * .35, -R * .42, R * .22, R * .11, -.6, 0, Math.PI * 2); c.fill();   // éclats
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(R * .32, R * .3, R * .08, 0, Math.PI * 2); c.fill();
  }
  function gemSprite(color) {   // une image par couleur, dessinée grande (1,6 × le rayon nominal) et réduite à l'affichage
    let sp = gemSprites[color]; if (sp !== undefined) return sp;
    const R0 = SCREW_R * 1.6, M = Math.ceil(R0 + 4); sp = offscreen(2 * M, 2 * M); gemSprites[color] = sp || null; if (!sp) return null;
    const c = sp.getContext('2d'); c.translate(M, M); drawGemBody(c, R0, color); sp.M = M; sp.R0 = R0; return sp;
  }
  function boxSprite(color) {   // corps d'un écrin : ombre au sol, velours, dégradé, coussin sombre (le liseré d'or animé, les alvéoles et le couvercle restent dessinés en direct)
    let sp = boxSprites[color]; if (sp !== undefined) return sp;
    const M = 44; sp = offscreen(BOX_W + 2 * M, BOX_H + 2 * M); boxSprites[color] = sp || null; if (!sp) return null;
    const c = sp.getContext('2d'); c.translate(M + BOX_W / 2, M + BOX_H / 2); const velvet = shade(color, -.25), dark = shade(color, -.55);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(0, BOX_H / 2 + 14, BOX_W * .5, 22, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = velvet; c.beginPath(); c.roundRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28); c.fill();
    const g = c.createLinearGradient(0, -BOX_H / 2, 0, BOX_H / 2); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
    c.fillStyle = g; c.beginPath(); c.roundRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28); c.fill();
    c.fillStyle = dark; c.beginPath(); c.roundRect(-BOX_W / 2 + 18, -BOX_H / 2 + 18, BOX_W - 36, BOX_H - 36, 20); c.fill();
    sp.M = M; return sp;
  }
  const FLOOR_Y = 1795;   // bord du comptoir de marbre : axe du reflet des écrins
  const DECO_TOP = 170;   // bas du lambrequin et des pompons (166) dans l'image du décor
  // points de scintillement fixes du décor : rosettes du lambrequin, nœuds des pompons, pampilles
  const DECO_SPARK = [[180, 42], [360, 42], [720, 42], [900, 42], [40, 80], [1040, 80], [180, 95], [900, 95]];
  // poussière d'or qui flotte et pampilles de cristal sous le lambrequin
  const DUST = Array.from({ length: 45 }, () => ({ x: rand(W), y: rand(H), r: rand(2, 6), vy: rand(12, 35), ph: rand(Math.PI * 2), sp: rand(.4, 1.2) }));
  const DROPS = [200, 944].flatMap(x => [-1, 0, 1].map(i => ({ x: x + i * 24, len: i === 0 ? 46 : 32, ph: rand(Math.PI * 2) })));
  function goldOn(o, x0, y0, x1, y1) { const g = o.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, GOLD_LIGHT); g.addColorStop(.5, GOLD); g.addColorStop(1, GOLD_DARK); return g; }
  function gemOn(o, x, y, r, color) {
    const g = o.createRadialGradient(x - r * .3, y - r * .3, r * .1, x, y, r); g.addColorStop(0, '#fff6c8'); g.addColorStop(.55, '#d9ab3c'); g.addColorStop(1, '#6b4a0c');
    o.fillStyle = g; o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
    const R = r * .72; o.beginPath(); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; o.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R); } o.closePath();
    const g2 = o.createRadialGradient(x - R * .3, y - R * .3, R * .05, x, y, R); g2.addColorStop(0, shade(color, .55)); g2.addColorStop(.55, color); g2.addColorStop(1, shade(color, -.5));
    o.fillStyle = g2; o.fill(); o.strokeStyle = 'rgba(255,255,255,.3)'; o.lineWidth = 1; o.stroke();
    o.fillStyle = 'rgba(255,255,255,.85)'; o.beginPath(); o.ellipse(x - R * .35, y - R * .4, R * .22, R * .11, -.6, 0, Math.PI * 2); o.fill();
  }
  function pearlOn(o, x, y, r) {
    const g = o.createRadialGradient(x - r * .35, y - r * .35, r * .1, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.6, '#ece6f2'); g.addColorStop(1, '#b9aec9');
    o.fillStyle = g; o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
  }
  function buildDeco() {
    if (!document.createElement) return;   // mode headless : pas de canvas hors écran
    // motif damassé (quadrilobe + losange) répété sur le velours
    const tile = document.createElement('canvas'); tile.width = tile.height = 160; const t = tile.getContext('2d');
    t.strokeStyle = 'rgba(255,220,150,.075)'; t.lineWidth = 2;
    for (const [dx, dy] of [[-20, 0], [20, 0], [0, -20], [0, 20]]) { t.beginPath(); t.arc(80 + dx, 80 + dy, 24, 0, Math.PI * 2); t.stroke(); }
    t.fillStyle = 'rgba(255,220,150,.09)'; t.beginPath(); t.moveTo(80, 64); t.lineTo(96, 80); t.lineTo(80, 96); t.lineTo(64, 80); t.closePath(); t.fill();
    for (const [x, y] of [[0, 0], [160, 0], [0, 160], [160, 160]]) { t.beginPath(); t.arc(x, y, 4, 0, Math.PI * 2); t.fill(); }
    damask = ctx.createPattern(tile, 'repeat');

    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const o = cv.getContext('2d');
    // --- lambrequin de velours prune à festons, franges d'or, cordon et rosettes
    const vg = o.createLinearGradient(0, 0, 0, 70); vg.addColorStop(0, '#5a2352'); vg.addColorStop(1, '#341332');
    o.fillStyle = vg; o.beginPath(); o.moveTo(0, 0); o.lineTo(W, 0); o.lineTo(W, 40);
    for (let i = 6; i > 0; i--) o.quadraticCurveTo((i - .5) * 180, 92, (i - 1) * 180, 40);
    o.closePath(); o.fill();
    o.strokeStyle = 'rgba(255,225,160,.85)'; o.lineWidth = 2;
    for (let x = 4; x < W; x += 9) { const u = (x % 180) / 180, y = 40 + 104 * u * (1 - u); o.beginPath(); o.moveTo(x, y - 2); o.lineTo(x, y + 18); o.stroke(); }
    o.strokeStyle = goldOn(o, 0, 0, 0, 12); o.lineWidth = 6; o.beginPath(); o.moveTo(0, 6); o.lineTo(W, 6); o.stroke();
    for (let i = 1; i < 6; i++) { o.fillStyle = goldOn(o, 0, 32, 0, 52); o.beginPath(); o.arc(i * 180, 42, 10, 0, Math.PI * 2); o.fill(); o.fillStyle = '#5a2352'; o.beginPath(); o.arc(i * 180, 42, 4, 0, Math.PI * 2); o.fill(); }
    // pompons aux deux coins
    for (const x of [40, W - 40]) {
      o.strokeStyle = goldOn(o, x - 3, 0, x + 3, 0); o.lineWidth = 5; o.beginPath(); o.moveTo(x, 0); o.lineTo(x, 80); o.stroke();
      o.fillStyle = goldOn(o, x - 14, 66, x + 14, 94); o.beginPath(); o.arc(x, 80, 14, 0, Math.PI * 2); o.fill();
      o.fillStyle = goldOn(o, x - 22, 90, x + 22, 166); o.beginPath(); o.moveTo(x - 12, 90); o.lineTo(x + 12, 90); o.lineTo(x + 22, 166); o.lineTo(x - 22, 166); o.closePath(); o.fill();
      o.strokeStyle = 'rgba(90,60,10,.5)'; o.lineWidth = 1.5; for (let k = -16; k <= 16; k += 4) { o.beginPath(); o.moveTo(x + k * .6, 98); o.lineTo(x + k, 166); o.stroke(); }
    }
    // --- comptoir de marbre noir poli (les écrins s'y reflètent, voir draw()) : veines claires, liseré d'or en bordure
    const mg = o.createLinearGradient(0, FLOOR_Y - 10, 0, H); mg.addColorStop(0, '#221b3d'); mg.addColorStop(.5, '#100c22'); mg.addColorStop(1, '#06050e');
    o.fillStyle = mg; o.fillRect(0, FLOOR_Y - 10, W, H - FLOOR_Y + 10);
    o.strokeStyle = 'rgba(200,190,230,.13)'; o.lineWidth = 1.5;
    for (let k = 0; k < 9; k++) { const x = -60 + k * 150; o.beginPath(); o.moveTo(x, FLOOR_Y); o.bezierCurveTo(x + 90, FLOOR_Y + 60, x + 40, FLOOR_Y + 150, x + 170, H); o.stroke(); }
    o.strokeStyle = goldOn(o, 0, FLOOR_Y - 12, 0, FLOOR_Y + 4); o.lineWidth = 4; o.beginPath(); o.moveTo(0, FLOOR_Y - 8); o.lineTo(W, FLOOR_Y - 8); o.stroke();
    deco = cv;
    bgCache = offscreen(W, H); if (bgCache) drawVelvet(bgCache.getContext('2d'));   // le fond (velours, halo, damas) : trois aplats plein écran, dessinés une fois
  }
  // étincelles : petites étoiles à 4 branches qui naissent au hasard sur les gemmes visibles et les bijoux du décor
  const sparks = []; let sparkT = 0, visibleGems = [];
  function spawnSpark() {
    const pts = visibleGems.map(s => [s.x, s.y, s.mystery ? '#ffffff' : s.color]).concat(DECO_SPARK);
    const [x, y, c] = pick(pts);
    sparks.push({ x: x + rand(-16, 16), y: y + rand(-16, 16), t: 0, dur: rand(.35, .7), size: rand(9, 24), rot: rand(Math.PI), vr: rand(-2, 2), glow: rgba(c ? shade(c, .4) : '#fff0be', 1) });
  }
  function drawSparks() {
    for (const sp of sparks) {
      if (sp.t < 0) continue;   // étincelle programmée avec un léger retard
      const k = Math.sin(Math.PI * sp.t / sp.dur), s = sp.size * k;
      ctx.save(); ctx.translate(sp.x, sp.y); ctx.rotate(sp.rot + sp.t * sp.vr);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.4); g.addColorStop(0, sp.glow.replace(/,1\)$/, ',' + (.6 * k) + ')')); g.addColorStop(1, 'rgba(255,240,190,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s * 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (.95 * k) + ')';
      poly([[0, -s], [s * .22, -s * .22], [s, 0], [s * .22, s * .22], [0, s], [-s * .22, s * .22], [-s, 0], [-s * .22, -s * .22]]); ctx.fill();
      ctx.restore();
    }
  }
  // poussière d'or qui monte lentement en ondulant (bokeh doux)
  function updateDust(dt) {
    for (const d of DUST) { d.y -= d.vy * dt; d.x += Math.sin(tm * d.sp + d.ph) * 18 * dt; if (d.y < -10) { d.y = H + 10; d.x = rand(W); } }
  }
  function drawDust() {
    for (const d of DUST) {
      const a = .12 + .22 * (.5 + .5 * Math.sin(tm * d.sp * 2 + d.ph));
      ctx.fillStyle = 'rgba(255,220,140,' + (a * .35) + ')'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r * 2.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,236,170,' + a + ')'; ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // deux faisceaux de lumière de boutique qui balaient doucement le plateau
  function drawRays(bx, by, bw, bh) {
    ctx.save(); roundRect(bx, by, bw, bh, 40); ctx.clip(); ctx.globalCompositeOperation = 'lighter';
    for (const [x0, ph, dir] of [[bx + bw * .2, 0, 1], [bx + bw * .8, 2.1, -1]]) {
      const a = Math.sin(tm * .35 + ph) * .35, x1 = x0 + Math.tan(a) * bh * dir, hw = 90 + 40 * Math.sin(tm * .5 + ph);
      const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, 'rgba(255,240,200,.10)'); g.addColorStop(1, 'rgba(255,240,200,0)');
      ctx.fillStyle = g; poly([[x0 - 30, by - 10], [x0 + 30, by - 10], [x1 + hw * 2.2, by + bh], [x1 - hw * 2.2, by + bh]]); ctx.fill();
    }
    ctx.restore();
  }
  // pampilles de cristal suspendues aux rosettes du lambrequin, qui se balancent
  function drawDrops() {
    for (const d of DROPS) {
      const a = Math.sin(tm * 1.6 + d.ph) * .09, ex = d.x + Math.sin(a) * d.len, ey = 52 + Math.cos(a) * d.len;
      ctx.strokeStyle = rgba(GOLD_LIGHT, .8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(d.x, 52); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(-a);
      const g = ctx.createLinearGradient(-8, 0, 8, 18); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(.5, 'rgba(210,225,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,.9)');
      ctx.fillStyle = g; poly([[0, 0], [8, 9], [0, 22], [-8, 9]]); ctx.fill(); ctx.strokeStyle = rgba(GOLD_LIGHT, .7); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }
  // étoile à quatre branches (lumières du décor)
  function starShape(x, y, s, thin = .22) { poly([[x, y - s], [x + s * thin, y - s * thin], [x + s, y], [x + s * thin, y + s * thin], [x, y + s], [x - s * thin, y + s * thin], [x - s, y], [x - s * thin, y - s * thin]]); }
  // les lumières du décor de la zone, qui s'allument avec les gemmes rangées ; boost > 0 pendant le final : elles flamboient une à une
  // part : dans une zone à décor, 'in' = les lumières sous le plateau (dessinées sous l'objet), 'out' = celles du tour de l'écran (dessinées par-dessus le décor)
  function drawSky(boost = 0, part) {
    const S = sky.stars; if (sky.decor && !decorBg) return;
    // fils de lumière entre étoiles allumées, tracés progressivement depuis la plus ancienne
    for (const [a, b] of sky.edges) {
      const A = S[a], B = S[b]; if (!A.lit || !B.lit) continue;
      const [from, to] = A.litAt <= B.litAt ? [A, B] : [B, A], u = clamp((tm - Math.max(A.litAt, B.litAt)) / .7, 0, 1);
      const ex = from.x + (to.x - from.x) * u, ey = from.y + (to.y - from.y) * u, sh = .5 + .5 * Math.sin(tm * 2 + a);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,225,160,' + (.12 + .1 * sh + .25 * boost) + ')'; ctx.lineWidth = 9; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,215,' + (.55 + .2 * sh + .25 * boost) + ')'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(ex, ey); ctx.stroke();
    }
    S.forEach((st, i) => {
      if (part && (st.out ? 'out' : 'in') !== part) return;
      const g = st.lit ? 1 : starGlow(i), tw = .5 + .5 * Math.sin(tm * 3 + st.ph);
      // emplacement : petit anneau discret tant que l'étoile n'est pas née
      if (!st.lit) { ctx.strokeStyle = 'rgba(255,230,180,' + (.14 + .2 * g) + ')'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(st.x, st.y, 14, 0, Math.PI * 2); ctx.stroke(); }
      if (g <= 0) return;
      // flamboiement : à l'allumage, puis une fois de plus pendant le final
      let fl = st.lit ? Math.max(0, 1 - (tm - st.litAt) / .8) : 0;
      if (finale) { const u = (finale.t - .4 - i * .2) / .5; if (u > 0 && u < 1) fl = Math.max(fl, Math.sin(Math.PI * u)); }
      const r = (st.lit ? 22 : 8 + 12 * g) * (1 + .12 * tw + 1.1 * fl), hal = r * (2.6 + 2 * fl);
      const hg = ctx.createRadialGradient(st.x, st.y, 0, st.x, st.y, hal); hg.addColorStop(0, 'rgba(255,245,220,' + ((.5 + .3 * boost) * g + .4 * fl) + ')'); hg.addColorStop(.35, 'rgba(255,225,160,' + (.18 * g + .25 * fl) + ')'); hg.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(st.x, st.y, hal, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,250,235,' + (.55 + .45 * g) + ')'; starShape(st.x, st.y, r, .2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (.7 * g) + ')'; ctx.beginPath(); ctx.arc(st.x, st.y, r * .22, 0, Math.PI * 2); ctx.fill();
    });
  }
  // écrin miniature (vitrine du haut et miniatures en vol)
  function drawMiniCase(x, y, color, k = 1) {
    const w = 44 * k, h = 30 * k;
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, h / 2 + 4 * k, w * .5, 5 * k, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = shade(color, -.2); roundRect(-w / 2, -h / 2, w, h, 7 * k); ctx.fill();
    ctx.fillStyle = shade(color, .05); roundRect(-w / 2, -h / 2, w, h * .42, 7 * k); ctx.fill();
    ctx.lineWidth = 1.5 * k; ctx.strokeStyle = gold(0, -h / 2, 0, h / 2); roundRect(-w / 2, -h / 2, w, h, 7 * k); ctx.stroke();
    ctx.fillStyle = gold(0, -4 * k, 0, 4 * k); ctx.fillRect(-2 * k, -h / 2, 4 * k, h); ctx.beginPath(); ctx.arc(0, -h * .08, 4.5 * k, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawShelf() {
    const n = shelfN(), p0 = shelfPos(0), p1 = shelfPos(n - 1);
    ctx.strokeStyle = gold(0, SHELF_Y + 14, 0, SHELF_Y + 22); ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(p0.x - 44, SHELF_Y + 20); ctx.lineTo(p1.x + 44, SHELF_Y + 20); ctx.stroke();
    for (let i = 0; i < n; i++) {
      const p = shelfPos(i);
      // final : chaque miniature rebondit à son tour
      let k = 1; if (finale && i < shelf.length) { const u = (finale.t - .3 - i * .09) / .4; if (u > 0 && u < 1) k = 1 + .55 * Math.sin(Math.PI * u); }
      if (i < shelf.length) drawMiniCase(p.x, p.y - (k - 1) * 20, shelf[i], k);
      else { ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = rgba(CREAM, .3); roundRect(p.x - 20, p.y - 14, 40, 28, 7); ctx.stroke(); ctx.setLineDash([]); }
    }
  }
  // trois étoiles à droite du niveau : on en perd selon le nombre de passages par le présentoir
  function drawStars() {
    const st = starsNow();
    for (let i = 0; i < 3; i++) {
      const x = 760 + i * 50, on = i < st, pk = on ? .5 + .5 * Math.sin(tm * 3 + i) : 0;
      text('★', x, LEVEL_Y, { size: 36, color: on ? gold(0, LEVEL_Y - 17, 0, LEVEL_Y + 18) : 'rgba(255,255,255,.16)', font: SERIF, stroke: on ? 'rgba(80,50,0,.6)' : null, strokeW: 4 });
      if (on) { ctx.fillStyle = 'rgba(255,255,255,' + (.35 * pk) + ')'; ctx.beginPath(); ctx.arc(x - 6, LEVEL_Y - 8, 4 + 2 * pk, 0, Math.PI * 2); ctx.fill(); }
    }
    // à droite des étoiles : un petit présentoir et le nombre de passages encore permis avant de perdre la prochaine (ambre à 1, rouge à 0)
    const left = starLeft();
    if (left >= 0 && state === 'play' && !clip) {
      const col = left === 0 ? '#ff8fa8' : left === 1 ? '#ffd27a' : CREAM, x = 916, pk = left === 0 ? .5 + .5 * Math.sin(tm * 6) : 0;
      ctx.save(); ctx.globalAlpha = left > 1 ? .8 : 1;
      ctx.lineWidth = 2.5; ctx.strokeStyle = col; roundRect(x - 17, LEVEL_Y - 9, 34, 18, 9); ctx.stroke();
      ctx.fillStyle = col; for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.arc(x + k * 9, LEVEL_Y, 2.6, 0, Math.PI * 2); ctx.fill(); }
      text(String(left), x + 34 + 2 * pk, LEVEL_Y + 1, { size: 30 + 3 * pk, color: col, font: SERIF, stroke: 'rgba(20,12,4,.7)', strokeW: 5 });
      ctx.restore();
    }
  }
  // final de niveau : le ciel s'assombrit, les lumières du décor flamboient une à une, le nom de l'objet s'écrit en or, puis les étoiles de score
  function drawFinale() {
    const t = finale.t, cx = BOARD.x + BOARD.w / 2, cy = BOARD.y + BOARD.h / 2, n = sky.stars.length;
    // nuit qui tombe sur le plateau, lumières redessinées par-dessus, plus vives
    const night = clamp(t / .6, 0, 1);
    ctx.save(); roundRect(BOARD.x - 20, BOARD.y - 20, BOARD.w + 40, BOARD.h + 40, 40); ctx.clip();
    ctx.fillStyle = 'rgba(4,3,18,' + (.6 * night) + ')'; ctx.fillRect(0, 0, W, H);
    drawSky(night, sky.decor ? 'in' : undefined);
    ctx.restore();
    if (sky.decor) drawSky(night, 'out');
    if (t < .5) { ctx.fillStyle = 'rgba(255,250,230,' + (.55 * (1 - t / .5)) + ')'; cover(); }
    if (t < 1.2) { ctx.strokeStyle = 'rgba(255,236,180,' + (.8 * (1 - t / 1.2)) + ')'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(cx, cy, 60 + t * 1100, 0, Math.PI * 2); ctx.stroke(); }
    // bandeau de velours avec le nom de l'objet, une fois toutes les lumières flamboyantes
    const tn = .5 + n * .2, pin = ease.outBack(clamp((t - tn) / .45, 0, 1)); if (pin <= 0) return;
    ctx.save(); ctx.translate(W / 2, BOARD.y + BOARD.h - 170); ctx.scale(pin, pin);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 12;
    const pg = ctx.createLinearGradient(0, -78, 0, 78); pg.addColorStop(0, '#4a1d48'); pg.addColorStop(1, '#2a0f2c');
    ctx.fillStyle = pg; roundRect(-440, -78, 880, 156, 30); ctx.fill(); ctx.shadowColor = 'transparent';
    goldStroke(-440, -78, 880, 156, 30, 5);
    text(tr('NIVEAU {n}  ·  RÉUSSI', { n: shownLevel() }), 0, -40, { size: 28, color: rgba(CREAM, .9), font: SERIF });
    ctx.save(); ctx.letterSpacing = sky.decor ? '4px' : '10px'; text(sky.decor ? sky.name : tr(sky.name), 0, 22, { size: sky.decor ? C.fitSize(sky.name, 68, 660, SERIF) : 68, color: gold(0, -20, 0, 60), font: SERIF, shadow: 12, cache: 'constellation' }); ctx.restore();
    ctx.restore();
    // étoiles de score sous le bandeau : les obtenues surgissent une à une, les autres restent éteintes
    for (let i = 0; i < 3; i++) {
      const x = W / 2 + (i - 1) * 130, y = BOARD.y + BOARD.h - 42, won = i < finale.stars, u = ease.outBack(clamp((t - finale.tStars - i * .32) / .3, 0, 1));
      if (i < finale.popped || !won) {
        ctx.save(); ctx.translate(x, y); ctx.scale(won ? u : 1, won ? u : 1);
        text('★', 0, 0, { size: 92, color: won ? gold(0, -46, 0, 46) : 'rgba(255,255,255,.14)', font: SERIF, stroke: won ? 'rgba(80,50,0,.6)' : null, strokeW: 6 });
        ctx.restore();
      }
    }
    // carte de fin (kit de clip) : la question apparaît sous les étoiles, une fois toutes surgies, et appelle les commentaires
    if (finale.card) { const uc = ease.outBack(clamp((t - finale.tStars - 3 * .32 - .1) / .35, 0, 1)); if (uc > 0) { ctx.save(); ctx.translate(W / 2, BOARD.y + BOARD.h + 74); ctx.scale(uc, uc); text(finale.card, 0, 0, { size: C.fitSize(finale.card, 54, W - 140), color: '#fff', stroke: '#1a1005', strokeW: 12, shadow: 10 }); ctx.restore(); } }
  }
  // rideau de velours qui descend du lambrequin entre deux niveaux
  function drawCurtain() {
    if (curtain.v <= 0) return;
    const h = SH() * curtain.v, x1 = W + 200;
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#4a1d48'); g.addColorStop(1, '#2c1030');
    ctx.fillStyle = g; ctx.fillRect(-40, -200, x1 + 40, h + 200);
    ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = 26; ctx.beginPath(); for (let x = 60; x < x1; x += 120) { ctx.moveTo(x, -200); ctx.lineTo(x, h); } ctx.stroke();   // plis
    ctx.strokeStyle = gold(0, h - 8, 0, h + 8); ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(-40, h - 2); ctx.lineTo(x1, h - 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,225,160,.85)'; ctx.lineWidth = 2; ctx.beginPath(); for (let x = 4; x < x1; x += 9) { ctx.moveTo(x, h); ctx.lineTo(x, h + 20); } ctx.stroke();   // franges
  }
  function drawCornerOrnaments(bx, by, bw, bh) {
    ctx.strokeStyle = rgba(GOLD_LIGHT, .85); ctx.fillStyle = rgba(GOLD_LIGHT, .85); ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (const [cx, cy, sx, sy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bh, 1, -1], [bx + bw, by + bh, -1, -1]]) {
      ctx.beginPath(); ctx.moveTo(cx + sx * 16, cy + sy * 70); ctx.lineTo(cx + sx * 16, cy + sy * 16); ctx.lineTo(cx + sx * 70, cy + sy * 16); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + sx * 28, cy + sy * 28, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sx * 16, cy + sy * 84, 3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx + sx * 84, cy + sy * 16, 3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ------------------------------------------------------------ dessin
  // en tournage le contenu est réduit : l'écran descend plus bas que H et déborde à droite, en coordonnées de jeu
  const SH = () => film ? (H - FILM.oy) / FILM.s + 20 : H;
  function cover() { ctx.fillRect(-60, -260, W + 300, SH() + 300); }
  function poly(pts) { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); }
  // or qui miroite : un reflet clair parcourt le dégradé en boucle (titre, liserés, sertissures)
  function gold(x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1), p = (tm * .3) % 1;
    const stops = [[0, GOLD_LIGHT], [.5, GOLD], [1, GOLD_DARK], [clamp(p - .12, 0, 1), GOLD], [p, '#fffbe6'], [clamp(p + .12, 0, 1), GOLD]].sort((a, b) => a[0] - b[0]);
    for (const [k, c] of stops) g.addColorStop(k, c);
    return g;
  }
  function goldStroke(x, y, w, h, r, lw = 5) { ctx.lineWidth = lw; ctx.strokeStyle = gold(x, y, x, y + h); roundRect(x, y, w, h, r); ctx.stroke(); }

  // gemme facettée dans une sertissure d'or
  // SYMBOLE PAR COULEUR (réglage « Symboles des couleurs » de la coquille, pour les daltoniens, 8 oct. 2026) : rond, triangle, carré, losange, étoile,
  // croix, cœur, dans l'ordre des sept couleurs. Le même sur la gemme, dans les alvéoles vides de son écrin et sur les deux écrins « à suivre ».
  // Une gemme mystère n'en porte pas (sa couleur est cachée) ; sous une clé ou un cadenas, il se range en petit dans le coin.
  const symbolsOn = () => !clip && !film && !!(global.Shell && Shell.save && Shell.save.settings && Shell.save.settings.symbols);
  function drawSymbol(color, x, y, r, alpha = 1) {
    const k = COLORS.indexOf(color); if (k < 0) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= alpha; ctx.lineJoin = 'round'; ctx.lineWidth = r * .42; ctx.strokeStyle = 'rgba(30,16,6,.85)'; ctx.fillStyle = '#fff'; ctx.beginPath();
    if (k === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (k === 1) { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, r * .8); ctx.lineTo(-r * 1.05, r * .8); ctx.closePath(); }
    else if (k === 2) ctx.rect(-r * .85, -r * .85, r * 1.7, r * 1.7);
    else if (k === 3) { ctx.moveTo(0, -r * 1.2); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r, 0); ctx.closePath(); }
    else if (k === 4) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .5 : r * 1.2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath(); }
    else if (k === 5) { const t = r * .38; ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t); ctx.lineTo(r, -t); ctx.lineTo(r, t); ctx.lineTo(t, t); ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t); ctx.lineTo(-r, t); ctx.lineTo(-r, -t); ctx.lineTo(-t, -t); ctx.closePath(); }
    else { ctx.moveTo(0, r * 1.05); ctx.bezierCurveTo(-r * 1.9, -r * .1, -r * .8, -r * 1.45, 0, -r * .45); ctx.bezierCurveTo(r * .8, -r * 1.45, r * 1.9, -r * .1, 0, r * 1.05); ctx.closePath(); }
    ctx.stroke(); ctx.fill(); ctx.restore();
  }
  function drawGem(s, alpha = 1) {
    const r = SCREW_R * s.s * (s.state === 'on' ? s.plate.s * gemK : 1) * (s.state === 'box' ? .85 : 1);
    ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(s.x, s.y - s.lift * 30);
    if (s.lift > 0) { ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(0, s.lift * 40, r * .95, r * .6, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.rotate(s.rot);
    // sertissure, pierre facettée, table, liseré, éclats : une image par couleur, mise à l'échelle (une vingtaine de tracés par gemme sinon)
    const col = s.mystery ? MYSTERY : s.color, R = r * .85, gs = gemSprite(col);
    if (gs) { const k = r / gs.R0; ctx.save(); ctx.scale(k, k); ctx.drawImage(gs, -gs.M, -gs.M); ctx.restore(); }
    else drawGemBody(ctx, r, col);
    // glint qui tourne lentement sur la couronne de facettes
    const ga = tm * 1.3 + s.x * .02, gk = .35 + .65 * (.5 + .5 * Math.sin(tm * 4 + s.y * .03));
    ctx.fillStyle = 'rgba(255,255,255,' + (.7 * gk) + ')'; ctx.beginPath(); ctx.arc(Math.cos(ga) * R * .6, Math.sin(ga) * R * .6, R * .11 * gk, 0, Math.PI * 2); ctx.fill();
    // nouveautés : point d'interrogation de la gemme mystère, clé d'or, cadenas tant que la clé n'est pas partie
    if (s.mystery) text('?', 0, r * .05, { size: r * 1.2, color: GOLD_LIGHT, font: SERIF, stroke: '#1a1005', strokeW: 6 });
    else if (symbolsOn()) { const badge = s.state === 'on' && (s.key || (s.plate.lockKey && s.plate.lockKey.state === 'on')); ctx.save(); ctx.rotate(-s.rot); if (badge) drawSymbol(s.color, r * .62, r * .62, r * .2); else drawSymbol(s.color, 0, 0, r * .3); ctx.restore(); }
    if (s.state === 'on') { if (s.key) drawKey(r); else if (s.plate.lockKey && s.plate.lockKey.state === 'on') drawPadlock(r); }
    // gemme qui vient d'être révélée : éclat central et anneau blanc qui s'élargit
    if (s.reveal > 0) {
      const k = s.reveal;
      ctx.fillStyle = 'rgba(255,255,255,' + (.6 * k) + ')'; ctx.beginPath(); ctx.arc(0, 0, R * .9 * k, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,250,220,' + k + ')'; ctx.lineWidth = 4 * k + 1; ctx.beginPath(); ctx.arc(0, 0, r * (1.15 + (1 - k) * 1.3), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  const MYSTERY = '#5d6488';   // gemme mystère : pierre fumée, ni l'une ni l'autre des sept couleurs
  // clé d'or posée sur sa gemme (r : rayon de la gemme)
  function drawKey(r) {
    ctx.save(); ctx.rotate(-.6); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = () => { ctx.beginPath(); ctx.arc(-r * .3, 0, r * .24, 0, Math.PI * 2); ctx.moveTo(-r * .06, 0); ctx.lineTo(r * .56, 0); ctx.moveTo(r * .34, 0); ctx.lineTo(r * .34, r * .22); ctx.moveTo(r * .52, 0); ctx.lineTo(r * .52, r * .2); };
    ctx.strokeStyle = '#3a2408'; ctx.lineWidth = r * .3; path(); ctx.stroke();
    ctx.strokeStyle = GOLD_LIGHT; ctx.lineWidth = r * .15; path(); ctx.stroke();
    ctx.restore();
  }
  // cadenas d'or sur une gemme cadenassée, que l'on assombrit
  function drawPadlock(r) {
    ctx.fillStyle = 'rgba(12,9,34,.5)'; ctx.beginPath(); ctx.arc(0, 0, r * .8, 0, Math.PI * 2); ctx.fill();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#3a2408'; ctx.lineWidth = r * .26; ctx.beginPath(); ctx.arc(0, -r * .1, r * .24, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = GOLD_LIGHT; ctx.lineWidth = r * .13; ctx.beginPath(); ctx.arc(0, -r * .1, r * .24, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#3a2408'; roundRect(-r * .44, -r * .14, r * .88, r * .66, r * .14); ctx.fill();
    ctx.fillStyle = gold(0, -r * .1, 0, r * .5); roundRect(-r * .37, -r * .07, r * .74, r * .52, r * .1); ctx.fill();
    ctx.fillStyle = '#3a2408'; ctx.beginPath(); ctx.arc(0, r * .14, r * .09, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-r * .035, r * .14, r * .07, r * .18);
  }
  // chaîne d'or entre deux gemmes : maillons vus à plat et de chant, en alternance
  function drawChain(a, b) {
    const d = dist(a.x, a.y, b.x, b.y), ang = Math.atan2(b.y - a.y, b.x - a.x), k = Math.max(.75, gemK), m = Math.max(2, Math.round(d / (34 * k)));
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(ang);
    for (const [col, lw] of [['#3a2408', 13 * k], [GOLD_LIGHT, 6.5 * k]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw;
      for (let i = 0; i <= m; i++) { const x = d * i / m; ctx.beginPath(); if (i % 2) ctx.ellipse(x, 0, 19 * k, 12 * k, 0, 0, Math.PI * 2); else { ctx.moveTo(x - 11 * k, 0); ctx.lineTo(x + 11 * k, 0); } ctx.stroke(); }
    }
    ctx.restore();
  }
  // tablette de nacre à liseré d'or
  function drawPlate(p) {
    const SHP = shapeOf(p);
    // images fantômes dans le sillage d'une tablette qui tombe
    if (p.state === 'falling') p.trail.forEach((t, i) => {
      ctx.save(); ctx.translate(t.x + p.w / 2, t.y + p.h / 2); ctx.rotate(t.rot); ctx.globalAlpha = p.alpha * (.22 - i * .07);
      ctx.fillStyle = p.color; shapePath(ctx, SHP); ctx.fill(); ctx.restore();
    });
    // anticipation : la tablette qui ne tient plus qu'à une gemme pend de ce côté, tremble, et son liseré pulse
    const host = p.support || p, last = p.state === 'on' && host.state === 'on' && host.screws.length === 1 && state === 'play', sag = last ? host.sag : 0;
    let tilt = 0, jx = 0, jy = 0, px = 0, py = 0;
    if (last) {
      // pendule : la pièce tourne autour de sa dernière gemme, du côté où pèse son centre ; l'angle est borné pour que le bout de la pièce ne se déplace
      // que d'une quarantaine de points (ce qu'elle couvre ne change pas), puis elle oscille doucement
      const g = host.screws[0], hx = host.x + host.w / 2, hy = host.y + host.h / 2, full = Math.atan2(hx - g.x, hy - g.y), lever = Math.hypot(Math.abs(hx - g.x) + host.w / 2, Math.abs(hy - g.y) + host.h / 2);
      const amax = Math.min(.16, 42 / Math.max(60, lever));
      tilt = clamp(full, -amax, amax) * sag + Math.sin(tm * 2.4 + p.z) * amax * .22 * sag;
      px = g.x - (p.x + p.w / 2); py = g.y - (p.y + p.h / 2);
      jx = Math.sin(tm * 31 + p.z) * .7 * sag; jy = Math.cos(tm * 37 + p.z) * .7 * sag;
    }
    p.tilt = tilt;
    ctx.save();
    ctx.translate(p.x + p.w / 2 + jx, p.y + p.h / 2 + jy);
    if (tilt) { ctx.translate(px, py); ctx.rotate(tilt); ctx.translate(-px, -py); }
    ctx.rotate(p.rot); ctx.scale(p.s, p.s); ctx.globalAlpha = p.alpha;
    const x = -p.w / 2, y = -p.h / 2;
    const sp = plateSprite(p);   // nacre et ombre floue pré-dessinées (l'ombre floue de chaque tablette coûtait le plus)
    if (sp) ctx.drawImage(sp, x - sp.M, y - sp.M);
    else { ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 12; ctx.fillStyle = p.color; shapePath(ctx, SHP); ctx.fill(); ctx.shadowColor = 'transparent'; }
    // reflet nacré en diagonale, qui glisse lentement (irisation)
    const k = .5 + .5 * Math.sin(tm * .7 + p.z * .9), g = ctx.createLinearGradient(x, y, x + p.w, y + p.h);
    g.addColorStop(0, 'rgba(255,255,255,.36)'); g.addColorStop(.2 + .12 * k, 'rgba(255,255,255,0)'); g.addColorStop(.46 + .12 * k, 'rgba(255,235,255,.12)'); g.addColorStop(.66 + .12 * k, 'rgba(20,10,60,0)'); g.addColorStop(1, 'rgba(20,10,60,.24)');
    ctx.fillStyle = g; shapePath(ctx, SHP); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = gold(x, y, x, y + p.h); shapePath(ctx, SHP); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.55)'; shapePath(ctx, SHP, 9); ctx.stroke();
    // sertissures vides laissées par les gemmes
    for (const h of p.holes) {
      const hx = h.x + x, hy = h.y + y, GR = SCREW_R * gemK;
      ctx.fillStyle = gold(hx, hy - GR * .6, hx, hy + GR * .6); ctx.beginPath(); ctx.arc(hx, hy, GR * .62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = shade(p.color, -.4); ctx.beginPath(); ctx.arc(hx, hy, GR * .48, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(hx, hy + 4, GR * .4, 0, Math.PI * 2); ctx.fill();
    }
    // liseré qui pulse en or clair quand la tablette est sur le point de tomber
    if (last) { ctx.strokeStyle = 'rgba(255,240,180,' + ((.35 + .4 * (.5 + .5 * Math.sin(tm * 7))) * sag) + ')'; ctx.lineWidth = 9; shapePath(ctx, SHP); ctx.stroke(); }
    // tablette bloquante : voile rouge qui s'efface
    if (p.flash > 0) {
      ctx.fillStyle = 'rgba(255,50,80,' + (.45 * p.flash) + ')'; shapePath(ctx, SHP); ctx.fill();
      ctx.strokeStyle = 'rgba(255,90,110,' + p.flash + ')'; ctx.lineWidth = 8; shapePath(ctx, SHP); ctx.stroke();
    }
    ctx.restore();
    // les gemmes suivent l'inclinaison et le tremblement de la tablette
    ctx.save();
    if (last) { const g = host.screws[0]; ctx.translate(g.x + jx, g.y + jy); ctx.rotate(tilt); ctx.translate(-g.x, -g.y); }
    for (const s of p.screws) if (s.state === 'on') {
      // halo pulsé : gemme jouable dont l'écrin est ouvert
      if (playable.has(s)) {
        const k = .5 + .5 * Math.sin(tm * 5 + s.x * .01), r = SCREW_R * gemK * (1.35 + .2 * k);
        const g = ctx.createRadialGradient(s.x, s.y, SCREW_R * gemK * .8, s.x, s.y, r);
        g.addColorStop(0, 'rgba(255,240,180,' + (.55 + .3 * k) + ')'); g.addColorStop(1, 'rgba(255,220,120,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.fill();
      }
      drawGem(s);
    }
    // chaînes d'or, par-dessus les deux gemmes qu'elles relient
    for (const s of p.screws) if (s.state === 'on' && s.pair && s.pair.state === 'on' && p.screws.indexOf(s) < p.screws.indexOf(s.pair)) drawChain(s, s.pair);
    ctx.restore();
  }
  // écrin de velours : corps, coussin à trois alvéoles, couvercle qui se rabat
  function drawBox(b) {
    if (!b) return;
    const velvet = shade(b.color, -.25), dark = shade(b.color, -.55), deep = shade(b.color, -.72);
    ctx.save(); ctx.translate(b.x, b.y); const sc = b.s * (1 + Math.sin(b.wob * Math.PI) * .06); ctx.scale(sc, sc);
    // halo coloré pulsé quand une gemme jouable peut rejoindre cet écrin
    if (readyBoxes.has(b)) {
      const k = .5 + .5 * Math.sin(tm * 4), gr = ctx.createRadialGradient(0, 0, BOX_W * .3, 0, 0, BOX_W * .75);
      gr.addColorStop(0, rgba(b.color, .35 + .25 * k)); gr.addColorStop(1, rgba(b.color, 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.ellipse(0, 0, BOX_W * .75, BOX_H * .95, 0, 0, Math.PI * 2); ctx.fill();
    }
    const bs = boxSprite(b.color);   // ombre, velours, dégradé et coussin pré-dessinés ; le liseré d'or (reflet animé) reste en direct, par-dessus
    if (bs) ctx.drawImage(bs, -BOX_W / 2 - bs.M, -BOX_H / 2 - bs.M);
    else {
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(0, BOX_H / 2 + 14, BOX_W * .5, 22, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = velvet; roundRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28); ctx.fill();
      const g = ctx.createLinearGradient(0, -BOX_H / 2, 0, BOX_H / 2); g.addColorStop(0, 'rgba(255,255,255,.2)'); g.addColorStop(1, 'rgba(0,0,0,.3)');
      ctx.fillStyle = g; roundRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28); ctx.fill();
      ctx.fillStyle = dark; roundRect(-BOX_W / 2 + 18, -BOX_H / 2 + 18, BOX_W - 36, BOX_H - 36, 20); ctx.fill();
    }
    goldStroke(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28, 5);
    // velours qui s'éclaire quand une gemme se pose
    if (b.glow > 0) { ctx.fillStyle = 'rgba(255,245,220,' + (.28 * b.glow) + ')'; roundRect(-BOX_W / 2, -BOX_H / 2, BOX_W, BOX_H, 28); ctx.fill(); }
    const nextFree = b.state === 'in' ? b.slots.indexOf(null) : -1;
    for (let k = 0; k < 3; k++) {
      const t = slotPos(b, k), sx = t.x - b.x, sy = t.y - b.y;
      ctx.fillStyle = deep; ctx.beginPath(); ctx.arc(sx, sy, SCREW_R * .9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,225,160,.3)'; ctx.lineWidth = 2; ctx.stroke();
      if (!b.slots[k] && !b.art && symbolsOn()) drawSymbol(b.color, sx, sy, SCREW_R * .3, .6);   // daltoniens : l'alvéole vide dit quelle gemme elle attend
      // prochaine alvéole libre : anneau d'or qui pulse
      if (k === nextFree) { const pk = .5 + .5 * Math.sin(tm * 5); ctx.strokeStyle = 'rgba(255,235,170,' + (.35 + .5 * pk) + ')'; ctx.lineWidth = 3 + 2 * pk; ctx.beginPath(); ctx.arc(sx, sy, SCREW_R * (1 + .08 * pk), 0, Math.PI * 2); ctx.stroke(); }
      // alvéole qui vient de recevoir : anneau blanc qui s'élargit
      if (b.slotFlash > 0 && b.flashK === k) { ctx.strokeStyle = 'rgba(255,255,255,' + b.slotFlash + ')'; ctx.lineWidth = 5 * b.slotFlash + 1; ctx.beginPath(); ctx.arc(sx, sy, SCREW_R * (1 + (1 - b.slotFlash) * .9), 0, Math.PI * 2); ctx.stroke(); }
    }
    // compteur de remplissage sur une pastille d'or
    const filledN = b.slots.filter(x => x && x.state === 'box').length;
    if (!b.art) {   // pas de compteur sur l'icône
    ctx.fillStyle = gold(0, -BOX_H / 2 - 16, 0, -BOX_H / 2 + 16); roundRect(BOX_W / 2 - 74, -BOX_H / 2 - 14, 64, 30, 15); ctx.fill();
    text(filledN + ' / 3', BOX_W / 2 - 42, -BOX_H / 2 + 1, { size: 21, color: '#3a2408', font: SERIF });
    }
    ctx.restore();
    for (const s of b.slots) if (s && s.state === 'box') drawGem(s);
    if (b.lid > 0) {
      ctx.save(); ctx.translate(b.x, b.y - BOX_H / 2 - 6); ctx.scale(b.s, b.s * b.lid);   // se rabat depuis la charnière arrière
      const lw = BOX_W + 16, lh = BOX_H + 12;
      const gl = ctx.createLinearGradient(0, 0, 0, lh); gl.addColorStop(0, shade(b.color, -.05)); gl.addColorStop(1, shade(b.color, -.4));
      ctx.fillStyle = gl; roundRect(-lw / 2, 0, lw, lh, 30); ctx.fill();
      goldStroke(-lw / 2, 0, lw, lh, 30, 5);
      // ruban croisé et cabochon central
      const ga = ctx.globalAlpha; ctx.fillStyle = gold(0, 0, 0, lh); ctx.globalAlpha = ga * .9; ctx.fillRect(-13, 0, 26, lh); ctx.fillRect(-lw / 2, lh / 2 - 13, lw, 26); ctx.globalAlpha = ga;
      ctx.fillStyle = gold(0, lh / 2 - 30, 0, lh / 2 + 30); ctx.beginPath(); ctx.arc(0, lh / 2, 30, 0, Math.PI * 2); ctx.fill();
      const gc = ctx.createRadialGradient(-6, lh / 2 - 6, 2, 0, lh / 2, 18); gc.addColorStop(0, shade(b.color, .6)); gc.addColorStop(1, shade(b.color, -.3));
      ctx.fillStyle = gc; ctx.beginPath(); ctx.arc(0, lh / 2, 18, 0, Math.PI * 2); ctx.fill();
      text('✓', lw / 2 - 52, lh - 44, { size: 54, color: CREAM, font: SERIF, stroke: 'rgba(0,0,0,.35)', strokeW: 8 });
      // reflet qui balaie le couvercle pendant qu'il se rabat
      const sw = ctx.createLinearGradient(-lw / 2 + (b.lid * 1.6 - .3) * lw, 0, -lw / 2 + (b.lid * 1.6 + .1) * lw, lh);
      sw.addColorStop(0, 'rgba(255,255,255,0)'); sw.addColorStop(.5, 'rgba(255,255,255,.35)'); sw.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = sw; roundRect(-lw / 2, 0, lw, lh, 30); ctx.fill();
      ctx.restore();
    }
  }

  // ICÔNE ET ÉCRAN DE DÉMARRAGE (engine/art.js, ?art=icon|splash&res=1) : dessinés dans le carré du haut (1080 × 1080) avec un vrai écrin
  // de velours à liseré d'or, garni de ses trois rubis, et deux gemmes qui arrivent au-dessus, sur le velours bleu nuit du jeu.
  function drawArtBox(x, y, k, color) {
    const b = { x: 0, y: 0, s: 1, wob: 0, color, glow: 0, state: 'done', slots: [], slotFlash: 0, lid: 0, art: true };
    b.slots = [0, 1, 2].map(i => { const p = slotPos(b, i); return { x: p.x, y: p.y, s: 1, lift: 0, rot: 0, reveal: 0, state: 'box', color }; });
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); drawBox(b); ctx.restore();
  }
  function drawArtGem(x, y, k, color) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); drawGem({ x: 0, y: 0, s: 1, lift: 0, rot: 0, reveal: 0, state: 'fly', color }); ctx.restore(); }
  function drawArtSparkle(x, y, r) {   // éclat d'or à quatre branches
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = GOLD_LIGHT; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, d = i % 2 ? r * .22 : r; ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // ciel de nuit (contexte c, image de w × h, graine fixe : même ciel à chaque export) : dégradé bleu nuit → violet, voie lactée, poussière
  // d'étoiles, grandes étoiles scintillantes (halo, quatre branches, aigrettes), croissant de lune doré
  function artNightSky(c, w, h, seed = 7) {
    let s = seed; const rnd = () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    const area = w * h / 1080 / 1080;
    let g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#04051a'); g.addColorStop(.5, '#141447'); g.addColorStop(1, '#3b1f6b'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.save(); c.translate(w / 2, h * .42); c.rotate(-.5);   // voie lactée : bande de lumière diffuse en diagonale
    for (let i = 0; i < 7; i++) { const R = w * (.28 + i * .05), r = c.createRadialGradient(0, 0, 0, 0, 0, R); r.addColorStop(0, 'rgba(170,150,255,.07)'); r.addColorStop(1, 'rgba(170,150,255,0)'); c.fillStyle = r; c.save(); c.scale(2.6 * h / w, .42); c.beginPath(); c.arc((i - 3) * w * .04, 0, R, 0, Math.PI * 2); c.fill(); c.restore(); }
    c.restore();
    for (let i = 0; i < 420 * area; i++) { c.fillStyle = 'rgba(255,' + (235 + rnd() * 20 | 0) + ',' + (200 + rnd() * 55 | 0) + ',' + (.25 + rnd() * .7) + ')'; c.beginPath(); c.arc(rnd() * w, rnd() * h, .8 + rnd() * rnd() * 3.2, 0, Math.PI * 2); c.fill(); }
    for (let i = 0; i < Math.round(13 * area); i++) artStar(c, rnd() * w, rnd() * h * .95, 10 + rnd() * 16, rnd() < .22);
    // croissant de lune
    const mx = w - 140, my = 140 * Math.max(1, h / w * .8), mr = 62;
    const hg = c.createRadialGradient(mx, my, mr * .6, mx, my, mr * 3); hg.addColorStop(0, 'rgba(255,236,180,.35)'); hg.addColorStop(1, 'rgba(255,236,180,0)'); c.fillStyle = hg; c.beginPath(); c.arc(mx, my, mr * 3, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.clip(); c.beginPath(); c.arc(mx, my, mr, 0, Math.PI * 2); c.arc(mx + mr * .5, my - mr * .3, mr * .85, 0, Math.PI * 2); c.fillStyle = GOLD_LIGHT; c.fill('evenodd'); c.restore();   // croissant : le disque moins un disque décalé (limité au disque)
  }
  function artStar(c, x, y, r, flare) {   // étoile qui brille : halo, quatre branches fines, cœur blanc ; flare : longues aigrettes en croix
    const hg = c.createRadialGradient(x, y, 0, x, y, r * 3.2); hg.addColorStop(0, 'rgba(255,245,220,.65)'); hg.addColorStop(.35, 'rgba(255,225,160,.22)'); hg.addColorStop(1, 'rgba(255,220,150,0)');
    c.fillStyle = hg; c.beginPath(); c.arc(x, y, r * 3.2, 0, Math.PI * 2); c.fill();
    if (flare) { c.save(); c.globalAlpha = .55; c.strokeStyle = '#fff6dc'; c.lineCap = 'round'; c.lineWidth = Math.max(1.5, r * .09); c.beginPath(); c.moveTo(x - r * 4.5, y); c.lineTo(x + r * 4.5, y); c.moveTo(x, y - r * 4.5); c.lineTo(x, y + r * 4.5); c.stroke(); c.restore(); }
    c.fillStyle = '#fffaf0'; c.beginPath(); const t = .2; for (const [dx, dy] of [[0, -1], [t, -t], [1, 0], [t, t], [0, 1], [-t, t], [-1, 0], [-t, -t]]) c.lineTo(x + dx * r, y + dy * r); c.closePath(); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * .22, 0, Math.PI * 2); c.fill();
  }
  function artConstellation(pts, k = 1) {   // grandes étoiles reliées par des fils d'or, comme au final d'un niveau
    ctx.lineCap = 'round';
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      ctx.strokeStyle = 'rgba(255,225,160,.28)'; ctx.lineWidth = 12 * k; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,245,215,.85)'; ctx.lineWidth = 3 * k; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    pts.forEach(([x, y], i) => artStar(ctx, x, y, (i === 2 ? 30 : 22) * k, i === 2));
  }
  function artGlow(x, y, r) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, 'rgba(255,215,140,.5)'); g.addColorStop(.45, 'rgba(255,190,110,.16)'); g.addColorStop(1, 'rgba(255,190,110,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  function drawArt() {
    ART.bg = '#141447';
    ctx.save();
    if (ART.kind === 'icon') {
      ctx.beginPath(); ctx.rect(0, 0, 1080, 1080); ctx.clip();
      artNightSky(ctx, 1080, 1080);
      artConstellation([[120, 330], [290, 220], [500, 290], [700, 200], [860, 330]]);   // Cassiopée, en « W »
      artGlow(540, 780, 560);
      drawArtGem(330, 500, 1.8, COLORS[1]); drawArtGem(750, 490, 1.8, COLORS[2]);
      drawArtBox(540, 820, 2.1, COLORS[0]);
      drawArtSparkle(130, 620, 26); drawArtSparkle(960, 640, 30); drawArtSparkle(545, 470, 26);
    } else {   // plein écran (portrait) : ciel de nuit, constellation, titre en or, l'écrin garni et ses deux gemmes au milieu
      artNightSky(ctx, W, H, 11);
      artConstellation([[150, 520], [320, 400], [540, 470], [760, 380], [930, 500]]);
      text('JEWEL BOX', 540, 700, { size: 146, color: GOLD_LIGHT, stroke: GOLD_DARK, strokeW: 12, font: SERIF });
      artGlow(540, 1230, 560);
      drawArtGem(340, 980, 1.7, COLORS[1]); drawArtGem(740, 970, 1.7, COLORS[2]);
      drawArtBox(540, 1270, 2.1, COLORS[0]);
      drawArtSparkle(150, 1110, 26); drawArtSparkle(940, 1130, 30); drawArtSparkle(545, 950, 24);
    }
    ctx.restore();
  }
  function draw() {
    if (global.ART) return drawArt();
    // velours bleu nuit, halo central, étoiles
    if (!deco) buildDeco();
    // fond recopié autour du plateau seulement (le velours du plateau, opaque, le cache ; ses coins arrondis de rayon 40 restent dans les bandes) :
    // 0,43 écran de moins par image (30 sept. 2026). En tournage, le plateau est déplacé : fond entier.
    const DZ = decorReady(), bgc = DZ ? decorBg : bgCache;   // zone à décor : son image à la place du velours, du lambrequin et du marbre
    if (bgc && !film) { const t = BOARD.y - 20 + 40, b = BOARD.y + BOARD.h + 20 - 40, l = BOARD.x - 20 + 40, r = BOARD.x + BOARD.w + 20 - 40;
      C.blit(bgc, 0, 0, 0, 0, W, t); C.blit(bgc, 0, 0, 0, b, W, H - b); C.blit(bgc, 0, 0, 0, t, l, b - t); C.blit(bgc, 0, 0, r, t, W - r, b - t); }
    else if (bgc) ctx.drawImage(bgc, 0, 0); else drawVelvet(ctx);
    ctx.fillStyle = '#fff';
    for (const st of STARS) { ctx.globalAlpha = .25 + .3 * Math.sin(tm * st.sp + st.ph); ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (!film) {
      // lambrequin, pompons, comptoir de marbre : seules les deux bandes peintes sont recopiées (l'image pleine page est vide au milieu, et la
      // recopier entière coûtait un écran de pixels de plus par image à la puce graphique)
      if (deco && !DZ) { ctx.drawImage(deco, 0, 0, W, DECO_TOP, 0, 0, W, DECO_TOP); ctx.drawImage(deco, 0, FLOOR_Y - 12, W, H - FLOOR_Y + 12, 0, FLOOR_Y - 12, W, H - FLOOR_Y + 12); }
      if (!DZ) drawDrops();
    } else {
      // tournage : ni lambrequin ni titre ; le contenu est agrandi dans la zone sûre (transformation non défaite : les particules et textes
      // flottants de Core, dessinés ensuite, restent alignés) et le comptoir de marbre est étiré jusqu'en bas de l'écran
      ctx.translate(FILM.ox, FILM.oy); ctx.scale(FILM.s, FILM.s);
      if (deco && !DZ) ctx.drawImage(deco, 0, FLOOR_Y - 12, W, H - FLOOR_Y + 12, -40, FLOOR_Y - 12, W + 240, SH() - FLOOR_Y + 12);
    }
    if (hookIdx) drawHook();
    else {
      text(tr('NIVEAU {n}', { n: shownLevel() }), W / 2, LEVEL_Y, { size: 40, color: CREAM, font: SERIF, shadow: 8 });
      ctx.strokeStyle = rgba(GOLD, .7); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(W / 2 - 250, LEVEL_Y); ctx.lineTo(W / 2 - 130, LEVEL_Y); ctx.moveTo(W / 2 + 130, LEVEL_Y); ctx.lineTo(W / 2 + 190, LEVEL_Y); ctx.stroke();
      // vitrine des écrins fermés et étoiles de l'objectif
      drawShelf(); drawStars();
      // mode développeur (?dev) : le morceau en cours, pour choisir parmi les candidats
      if (C.DEV && !film && !/[?&]nolabel/.test(href)) text('♪ ' + (trackSrc ? trackName : trackName ? trackName + ' (chargement)' : 'musique générée'), 28, H - 36, { size: 38, color: '#7CFF7C', stroke: '#000', strokeW: 8, align: 'left' });
    }
    // plateau : velours capitonné à liseré d'or
    const bx = BOARD.x - 20, by = BOARD.y - 20, bw = BOARD.w + 40, bh = BOARD.h + 40;
    if (!boardCache) { boardCache = offscreen(bw, bh); if (boardCache) { const c = boardCache.getContext('2d'); c.translate(-bx, -by); drawBoardVelvet(c, bx, by, bw, bh); } }
    if (DZ) ctx.drawImage(decorBoard, bx, by); else if (boardCache) ctx.drawImage(boardCache, bx, by); else drawBoardVelvet(ctx, bx, by, bw, bh);
    goldStroke(bx, by, bw, bh, 40, 4);
    drawCornerOrnaments(bx, by, bw, bh);
    drawSky(0, DZ ? 'in' : undefined);
    drawRays(bx, by, bw, bh);
    // gemmes visibles (pour les étincelles) et jouables (accessibles + écrin ouvert : elles reçoivent un halo)
    const w = live();
    visibleGems = screws.filter(s => (s.state === 'on' && reachable(w, s)) || s.state === 'box' || s.state === 'buffer');
    playable = new Set(state === 'play' ? visibleGems.filter(s => s.state === 'on' && !s.mystery && openBox(w, s.color)) : []);   // une gemme mystère ne trahit pas sa couleur
    readyBoxes = new Set([...playable].map(s => openBox(w, s.color)));
    // tablettes par z croissant
    const sorted = plates.slice().sort((a, b) => a.z - b.z);
    // les tablettes posées qui attendent leur tour de tomber ('pending') restent dessinées au-dessus de leur porteuse déjà en chute
    for (const p of sorted) if (p.state === 'on') drawPlate(p);
    for (const p of sorted) if (p.state !== 'on') drawPlate(p);
    drawDust();
    // présentoir : coussin de velours à cinq alvéoles, qui se tend à l'ambre puis au rouge quand il se remplit
    const tx = bufX0() - 90, ty = BUF_Y - 65, tw = (bufN - 1) * bufSp() + 180;
    const filled = buffer.filter(x => x).length, tension = filled >= bufN ? 2 : filled >= bufN - 1 ? 1 : 0;
    const pulse = .5 + .5 * Math.sin(tm * (tension === 2 ? 9 : 5));
    ctx.save();
    if (tension === 2) { const cx = tx + tw / 2, cy = ty + 65, sc = 1 + .025 * pulse; ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy); }
    ctx.fillStyle = '#2b2360'; roundRect(tx, ty, tw, 130, 40); ctx.fill();
    const tg = ctx.createLinearGradient(0, ty, 0, ty + 130); tg.addColorStop(0, 'rgba(255,255,255,.14)'); tg.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = tg; roundRect(tx, ty, tw, 130, 40); ctx.fill();
    if (tension) { ctx.fillStyle = tension === 2 ? 'rgba(255,50,80,' + (.3 + .25 * pulse) + ')' : 'rgba(255,170,40,' + (.2 + .15 * pulse) + ')'; roundRect(tx, ty, tw, 130, 40); ctx.fill(); }
    if (tension) { ctx.lineWidth = 5; ctx.strokeStyle = tension === 2 ? 'rgba(255,110,130,' + (.6 + .4 * pulse) + ')' : 'rgba(255,200,90,' + (.6 + .4 * pulse) + ')'; roundRect(tx, ty, tw, 130, 40); ctx.stroke(); }
    else goldStroke(tx, ty, tw, 130, 40, 4);
    for (let k = 0; k < bufN; k++) { const t = bufPos(k); ctx.fillStyle = '#171238'; ctx.beginPath(); ctx.arc(t.x, t.y, SCREW_R * .9, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = 'rgba(255,225,160,.3)'; ctx.lineWidth = 2; ctx.stroke(); }
    text(filled + ' / ' + bufN, tx + tw + 50, ty + 65, { size: 30, color: tension === 2 ? '#ff8fa8' : tension === 1 ? '#ffd27a' : CREAM, font: SERIF, align: 'left' });
    ctx.restore();
    // les deux prochains écrins de la file, à gauche du présentoir : on peut planifier
    const n1 = queue[queueIdx] || null, n2 = queue[queueIdx + 1] || null;
    text(tr('À SUIVRE'), 85, ty + 20, { size: 19, color: rgba(CREAM, .85), font: SERIF });
    [n1, n2].forEach((c, i) => {
      const mx = 55 + i * 62, my = ty + 58, mw = 48 - i * 6, mh = 34 - i * 4;
      ctx.save(); ctx.globalAlpha = i ? .7 : 1;
      if (c) {
        ctx.fillStyle = shade(c, -.25); roundRect(mx - mw / 2, my - mh / 2, mw, mh, 8); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = gold(0, my - mh / 2, 0, my + mh / 2); roundRect(mx - mw / 2, my - mh / 2, mw, mh, 8); ctx.stroke();
        if (symbolsOn()) drawSymbol(c, mx, my, mh * .26); else { ctx.fillStyle = shade(c, -.6); for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(mx - 12 + k * 12, my + 2, 4, 0, Math.PI * 2); ctx.fill(); } }
      } else { ctx.setLineDash([6, 5]); ctx.lineWidth = 2; ctx.strokeStyle = rgba(CREAM, .35); roundRect(mx - mw / 2, my - mh / 2, mw, mh, 8); ctx.stroke(); ctx.setLineDash([]); }
      ctx.restore();
    });
    // gemmes posées sur le présentoir (y compris celles déjà réservées par un écrin, en attente de leur envol)
    for (const s of screws) if (s.state === 'buffer' || s.state === 'reserve') drawGem(s);
    // reflet des écrins dans le marbre poli du comptoir, puis fondu vers le bas et nom de la maison
    if (!DZ) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, FLOOR_Y, W, H - FLOOR_Y); ctx.clip();
      ctx.translate(0, 2 * FLOOR_Y); ctx.scale(1, -1); ctx.globalAlpha = .45;
      for (const b of leaving) drawBox(b);
      for (const b of boxes) drawBox(b);
      ctx.restore();
      const rg = ctx.createLinearGradient(0, FLOOR_Y, 0, SH()); rg.addColorStop(0, 'rgba(12,9,26,.1)'); rg.addColorStop(.7, 'rgba(12,9,26,.8)'); rg.addColorStop(1, 'rgba(12,9,26,.97)');
      ctx.fillStyle = rg; ctx.fillRect(-40, FLOOR_Y, W + 240, SH() - FLOOR_Y);
    } else {
      // zone à décor : pas de marbre ni de reflet (le sol est celui du décor), seulement une ombre tout en bas sous le nom de la maison
      const rg = ctx.createLinearGradient(0, H - 150, 0, SH()); rg.addColorStop(0, 'rgba(8,9,28,0)'); rg.addColorStop(1, 'rgba(8,9,28,.72)');
      ctx.fillStyle = rg; ctx.fillRect(-40, H - 150, W + 240, SH() - H + 150);
      drawSky(0, 'out');
    }
    if (!film && !global.Shell) {   // dans le jeu, la rangée des aides de la coquille prend cette place
      ctx.save(); ctx.letterSpacing = '7px';
      text('MAISON ÉCRIN', W / 2, H - 34, { size: 26, color: gold(0, H - 48, 0, H - 20), font: SERIF });
      ctx.restore();
      ctx.strokeStyle = rgba(GOLD, .55); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(W / 2 - 300, H - 34); ctx.lineTo(W / 2 - 170, H - 34); ctx.moveTo(W / 2 + 170, H - 34); ctx.lineTo(W / 2 + 300, H - 34); ctx.stroke();
    }
    // écrins (ceux qui partent, puis les actifs)
    for (const b of leaving) drawBox(b);
    for (const b of boxes) drawBox(b);
    // présentoir plein : l'écran se borde de rouge au rythme du cœur
    if (state === 'play' && filled >= bufN) {
      const rv = ctx.createRadialGradient(W / 2, H * .5, 500, W / 2, H * .5, 1250); rv.addColorStop(0, 'rgba(255,30,70,0)'); rv.addColorStop(1, 'rgba(255,30,70,' + (.22 + .2 * pulse) + ')');
      ctx.fillStyle = rv; cover();
    }
    // ralenti sur la dernière gemme : vignette sombre et grand halo autour d'elle
    if (slowGem) {
      const vg = ctx.createRadialGradient(slowGem.x, slowGem.y, 120, slowGem.x, slowGem.y, 1300); vg.addColorStop(0, 'rgba(5,4,20,0)'); vg.addColorStop(1, 'rgba(5,4,20,.65)');
      ctx.fillStyle = vg; cover();
      const hg = ctx.createRadialGradient(slowGem.x, slowGem.y, 20, slowGem.x, slowGem.y, 260); hg.addColorStop(0, rgba(shade(slowGem.color, .5), .55)); hg.addColorStop(1, rgba(slowGem.color, 0));
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(slowGem.x, slowGem.y, 260, 0, Math.PI * 2); ctx.fill();
    }
    // gemmes en vol au-dessus de tout, miniatures en route vers la vitrine, puis les étincelles
    for (const s of screws) if (s.state === 'fly') drawGem(s);
    for (const f of flyers) drawMiniCase(f.x, f.y, f.color, f.k);
    drawSparks();
    if (finale) drawFinale();
    if (state === 'stuck') drawRescueOffer();
    drawCurtain();
  }
  // proposition de secours : plaque de velours et bouton d'or « +1 place »
  function drawRescueOffer() {
    const B = RESCUE_BTN, pk = .5 + .5 * Math.sin(tm * 4);
    ctx.fillStyle = 'rgba(5,4,20,.45)'; cover();
    ctx.save(); ctx.translate(W / 2, H / 2 - 30);
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 16;
    const pg = ctx.createLinearGradient(0, -170, 0, 170); pg.addColorStop(0, '#4a1d48'); pg.addColorStop(1, '#2a0f2c');
    ctx.fillStyle = pg; roundRect(-360, -170, 720, 370, 34); ctx.fill(); ctx.shadowColor = 'transparent';
    goldStroke(-360, -170, 720, 370, 34, 6);
    text(tr('PRÉSENTOIR PLEIN'), 0, -100, { size: 44, color: CREAM, font: SERIF });
    text(tr('Une place de plus pour continuer ?'), 0, -40, { size: 26, color: rgba(CREAM, .8), font: SERIF });
    ctx.restore();
    ctx.save(); ctx.translate(B.x, B.y); ctx.scale(1 + .04 * pk, 1 + .04 * pk);
    ctx.fillStyle = gold(0, -B.h / 2, 0, B.h / 2); roundRect(-B.w / 2, -B.h / 2, B.w, B.h, B.h / 2); ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(80,50,0,.6)'; roundRect(-B.w / 2, -B.h / 2, B.w, B.h, B.h / 2); ctx.stroke();
    text(tr('✦  +1 PLACE  ✦'), 0, 2, { size: 40, color: '#3a2408', font: SERIF });
    ctx.restore();
    if (!global.Shell) text(tr('offert'), W / 2, B.y + 80, { size: 24, color: rgba(CREAM, .6), font: SERIF });   // coquille : le secours coûte des pièces ou une pub, plus « offert »
  }

  C.dbg = () => ({ level, clip, genTries, state, boxed, total, musicOn, loopMode, hookIdx, botHuman: botStyle === 1, botStyle, tray: buffer.filter(x => x).length, drama: drama && drama.phase, film, bufN, openN, rescued, diff: levelDiff, queueLeft: queue.length - queueIdx, plan: plan ? plan.length - planIdx : null, sky: sky ? sky.name + ' ' + sky.stars.filter(s => s.lit).length + '/' + sky.stars.length : null, finale: finale ? +finale.t.toFixed(2) : null, curtain: +curtain.v.toFixed(2), slow: !!slowGem, shelf: shelf.length, trayUses, stars: starsNow(), falling: plates.filter(p => p.state === 'falling').length, single: plates.filter(p => p.state === 'on' && p.screws.length === 1).length, buffer: buffer.map(s => s ? s.color : null), boxes: boxes.map(b => b ? b.color + ":" + b.slots.filter(x => x).length + ":" + b.state : null), plates: plates.length, riders: plates.filter(p => p.support).length });
  // console : Core.test.blocked() tape une gemme couverte pour voir les tablettes bloquantes s'éclairer
  //           Core.test.fillTray(n) envoie n gemmes accessibles (sans écrin ouvert) sur le présentoir pour voir sa tension
  C.test = {
    // Core.test.boost('slot' | 'clear') ; Core.test.boost('hammer', i) brise la i-ième pièce encore en place (mise au point)
    boost(key, i) { if (key !== 'hammer') return useBoost(key); const P = plates.filter(p => p.state === 'on' && p.screws.length); if (!P.length) return false; hammer(P[(i || 0) % P.length]); return true; },
    reserve: () => reserve.map(s => s.color + ':' + s.state),
    blocked() { const s = screws.find(s => s.state === 'on' && !reachable(live(), s)); if (s) tapScrew(s); return !!s; },
    fillTray(n = BUF_N) { let k = 0; for (const s of screws) { if (k >= n || buffer.indexOf(null) < 0) break; if (s.state === 'on' && reachable(live(), s) && !openBox(live(), s.color)) { tapScrew(s); k++; } } return k; },
    // Core.test.objets() : contrôle des objets (jeux/tools/ecrin-objets.js) : gemmes, gemmes cachées, pièces, avertissements
    objets(v = 0) { return OBJETS.map(o => { const G = objGeom(o, 0, v); return { nom: o.name.fr, gemmes: G.total, places: G.cap, cachees: G.hidden, pieces: o.pieces.length, parPiece: G.picks.map(a => a.length).join(" "), ornementsAuto: G.auto.join(" "), alertes: G.warn }; }); },
    objet() { return objet && objet.name.fr; },
    // l'empreinte du niveau en cours (file des écrins, couleur et nouveauté de chaque gemme) : sert à vérifier qu'un niveau est le même à chaque essai
    empreinte() { return queue.map(c => COLORS.indexOf(c)).join('') + '|' + screws.map(s => COLORS.indexOf(s.color) + (s.mystery ? 'm' : '') + (s.key ? 'k' : '') + (s.pair ? 'c' : '') + (s.plate.lockKey ? 'l' : '')).join(''); },
    audioReady() { updateMusic(); return !A || !musicOn || !trackName || !!trackSrc; },   // pour l'outil de clips : le morceau de la zone est chargé
    nouv(set) { featsForce = set === null ? undefined : set; C.restart(); return levelDiff && levelDiff.nouv; },   // Core.test.nouv('mlc') : impose les nouveautés (null : comme le niveau le prévoit)
    zone(lv) { const J = journey(lv), sl = slotAt(lv); return { zone: ZONES[J.zi] && ZONES[J.zi].key, tour: J.tour, pos: J.pos, objet: sl.obj.name.fr, fin: sl.fin, want: sl.want, nouv: featsAt(lv).set }; },
    voir(n, v = 0) { OBJ_URL = n; voirV = v; C.restart(); return n ? OBJETS[(n - 1) % OBJETS.length].name.fr + ' v' + v + ' : ' + total + ' gemmes' : 'niveau'; },   // Core.test.voir(17) : montre le 17e objet de objets.js (0 : retour au niveau)
    // Core.test.level(n) : saute directement au niveau n
    level(n = 1) { level = Math.max(1, n | 0); C.restart(); return level; },
    // Core.test.stuck() : affiche la proposition de secours (le bot ou un tap sur le bouton l'accepte)
    stuck() { if (state === 'play') { state = 'stuck'; duck(.3); } },
    // Core.test.fakeTray(n) : n gemmes factices sur le présentoir (rendu de la tension seulement, R pour nettoyer)
    fakeTray(n = BUF_N) { for (let k = 0; k < BUF_N; k++) { if (k < n && !buffer[k]) { const t = bufPos(k), s = { x: t.x, y: t.y, color: pick(COLORS), state: 'buffer', s: .95, rot: 0, lift: 0, fake: true }; buffer[k] = s; screws.push(s); } } },
  };
  if (film) applyFilm();
  C.start({ ownFilm: true, init, update, draw, pointerDown, autoplay, onKey(k) { if (k === 'c') toggleClip(); else if (k === 'b') toggleMusic(); else if (k === 'p') toggleBotStyle(); else if (k === 't') toggleFilm(); else if (k === 'x') nextHook(); else if (k === 'l') toggleLoop(); } });
  // icônes des nouveautés (écran « NOUVEAU ! » de la coquille)
  const BOOST_ICONS = {
    slot: '<svg viewBox="0 0 120 120"><rect x="10" y="38" width="100" height="46" rx="20" fill="#2b2360" stroke="#d8ad42" stroke-width="5"/><circle cx="36" cy="61" r="12" fill="#171238"/><circle cx="84" cy="61" r="12" fill="#171238" stroke="#fff0b8" stroke-width="3" stroke-dasharray="5 4"/><path d="M84 14v26M71 27h26" stroke="#16a34a" stroke-width="9" stroke-linecap="round"/></svg>',
    clear: '<svg viewBox="0 0 120 120"><rect x="10" y="66" width="100" height="40" rx="18" fill="#2b2360" stroke="#d8ad42" stroke-width="5"/><circle cx="36" cy="86" r="10" fill="#171238"/><circle cx="60" cy="86" r="10" fill="#171238"/><circle cx="84" cy="86" r="10" fill="#171238"/><path d="M60 56V16M44 30l16-16 16 16" fill="none" stroke="#2E6BFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><circle cx="30" cy="40" r="9" fill="#E5173F"/><circle cx="90" cy="40" r="9" fill="#FFC233"/></svg>',
    hammer: '<svg viewBox="0 0 120 120"><g transform="rotate(-38 60 60)"><rect x="54" y="40" width="12" height="72" rx="5" fill="#9A623B"/><rect x="26" y="14" width="68" height="34" rx="9" fill="#d8ad42" stroke="#8a5f14" stroke-width="4"/><rect x="34" y="20" width="52" height="8" rx="4" fill="#fff0b8"/></g></svg>',
  };
  const NEWS_ICONS = {
    m: '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#d8ad42"/><circle cx="60" cy="60" r="41" fill="#5d6488"/><path d="M60 19 89 43 78 85H42L31 43Z" fill="#7c84ab" opacity=".55"/><text x="60" y="82" font-family="Georgia,serif" font-size="62" font-weight="bold" text-anchor="middle" fill="#fff0b8" stroke="#1a1005" stroke-width="3">?</text></svg>',
    l: '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="50" fill="#d8ad42"/><circle cx="60" cy="60" r="41" fill="#2e6bff"/><circle cx="60" cy="60" r="41" fill="#0c0922" opacity=".45"/><path d="M44 54V44a16 16 0 0 1 32 0v10" fill="none" stroke="#3a2408" stroke-width="13" stroke-linecap="round"/><path d="M44 54V44a16 16 0 0 1 32 0v10" fill="none" stroke="#fff0b8" stroke-width="6" stroke-linecap="round"/><rect x="34" y="52" width="52" height="40" rx="8" fill="#f2cf73" stroke="#3a2408" stroke-width="5"/><circle cx="60" cy="68" r="6" fill="#3a2408"/><rect x="57" y="68" width="6" height="13" fill="#3a2408"/></svg>',
    c: '<svg viewBox="0 0 120 120"><g fill="none" stroke-linecap="round"><path d="M40 60h40" stroke="#3a2408" stroke-width="13"/><path d="M40 60h40" stroke="#fff0b8" stroke-width="6" stroke-dasharray="9 8"/></g><circle cx="30" cy="60" r="27" fill="#d8ad42"/><circle cx="30" cy="60" r="21" fill="#e5173f"/><circle cx="90" cy="60" r="27" fill="#d8ad42"/><circle cx="90" cy="60" r="21" fill="#17c267"/></svg>',
  };
  // coquille : elle lance les niveaux (carte, « suivant », « rejouer ») et règle la musique
  if (global.Shell) Shell.register({
    startLevel(n) { level = Math.max(1, n | 0); C.restart(); },
    setMusic(on) { musicOn = !!on; duck(1); },
    level: () => level,
    hard: n => { const fin = slotAt(n).fin; return fin === 2 ? 2 : fin ? 1 : 0; },   // gros objets de la zone : annoncés sur la carte et mieux payés (le dernier davantage)
    chapter: chapterOf, useBoost, symbols: true,
    boosts: [
      { key: 'slot', level: 8, cost: 150, icon: BOOST_ICONS.slot, title: { fr: 'Place en plus', en: 'Extra slot' },
        text: { fr: 'Une place de plus sur le présentoir, jusqu’à la fin du niveau.', en: 'One more slot on the tray, until the end of the level.' } },
      { key: 'clear', level: 15, cost: 250, icon: BOOST_ICONS.clear, title: { fr: 'Plateau de réserve', en: 'Spare tray' },
        text: { fr: 'Vide le présentoir : ses gemmes attendent en réserve et rejoignent leur écrin dès qu’il s’ouvre.', en: 'Empties the tray: its gems wait in reserve and join their box as soon as it opens.' } },
      { key: 'hammer', level: 25, cost: 400, icon: BOOST_ICONS.hammer, title: { fr: 'Marteau', en: 'Hammer' },
        text: { fr: 'Touche une pièce : elle se brise et ses gemmes sont mises de côté.', en: 'Tap a piece: it shatters and its gems are set aside.' } },
    ],
    news: [
      { level: NEWS_AT.m, key: 'mystery', icon: NEWS_ICONS.m, title: { fr: 'Gemme mystère', en: 'Mystery gem' },
        text: { fr: 'Sa couleur est cachée. Touche-la pour la découvrir : elle part aussitôt. Ou attends : chaque écrin fermé en dévoile une.', en: 'Its color is hidden. Tap it to find out: off it goes. Or wait: each closed box reveals one.' } },
      { level: NEWS_AT.l, key: 'lock', icon: NEWS_ICONS.l, title: { fr: 'Cadenas', en: 'Padlock' },
        text: { fr: 'Ces gemmes sont cadenassées. Trouve la gemme à la clé et dessertis-la : les cadenas sautent.', en: 'These gems are locked. Find the gem with the key and take it out: the padlocks pop open.' } },
      { level: NEWS_AT.c, key: 'chain', icon: NEWS_ICONS.c, title: { fr: 'Gemmes enchaînées', en: 'Chained gems' },
        text: { fr: 'Deux gemmes reliées par une chaîne partent ensemble. Il faut une place pour chacune.', en: 'Two gems linked by a chain leave together. You need room for both.' } },
    ],
  });
  if (/[?&#]auto/.test(href)) C.setBot(true);   // ?auto (kit de clip commun) : le bot joue dès la première image
})(window);
