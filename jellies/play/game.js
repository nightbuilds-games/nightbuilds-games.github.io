/* JEU « JELLIES ON THE RUN » (dossier gelees, ancien nom français « Gelées en cavale ») (produit, 30 sept. 2026) : copie du proto 4 (prototypes/04-gelees, figé pour les clips) branchée sur la
   coquille (engine/shell.js) : la victoire ouvre l'écran de résultat (étoiles, temps, record) au lieu d'enchaîner, l'échec est compté,
   la coquille lance les niveaux et règle la musique. Les fonctionnalités de tournage restent là mais ne s'activent que par l'URL
   (la carte de fin qui appelle les commentaires est coupée par défaut : ?endcard=1).
   « GELÉES EN CAVALE » — évasion de blocs par des trappes de couleur (type Color Block Jam / Block Jam 3D)
   Des gelées de fruits (blocs de 1 à 6 cases, formes en barre, carré, L) sont serrées dans un bac. Sur les parois, des trappes
   de couleur d'une, deux ou trois cases. On glisse une gelée avec le doigt : elle coulisse dans les cases libres, bute sur les
   autres, et sort d'un coup quand elle arrive alignée devant une trappe de sa couleur où elle passe (sa largeur doit tenir dans
   la trappe : une barre de 3 ne passe que par une trappe de 3, ou par le petit côté). Il fait chaud : le soleil tape par le haut
   du bac, une gelée que rien n'abrite chauffe et finit par fondre (FEATURES.sunMelt), à l'ombre d'une autre elle refroidit.
   Le thermomètre monte aussi, à zéro tout fond (« FONDU ! »), on recommence ou on gagne des glaçons (secours).
   Puzzle : l'ordre compte, il faut souvent ranger une gelée sur le côté pour libérer le passage d'une autre (« détours »).
   Niveaux déterministes (graine = niveau) avec un solveur : la difficulté visée est le nombre de détours nécessaires. */
(function (global) {
  const C = Core;
  const { W, H, ctx, ease, rand, randi, pick, lerp, clamp, dist, shuffle, shade, rgba, roundRect, text, sfx, bot, pointer } = Core;
  // textes affichés en anglais avec ?lang=en (22 sept. 2026, campagne en anglais) : le code garde le français, C.tr traduit à l'affichage
  const tr = C.tr;
  C.i18n({
    'NIVEAU {n}': 'LEVEL {n}', 'niveau {n} · {s}': 'level {n} · {s}', 'IN EXTREMIS !': 'JUST IN TIME!', 'TROP LARGE !': 'TOO WIDE!',
    'SORTIES !': 'ALL OUT!', 'FONDUE !': 'MELTED!', 'FONDU !': 'MELTED!', 'CHALEUR': 'HEAT', 'Gelées': 'Jellies',
    'Glisse chaque gelée jusqu’à la trappe de sa couleur': 'Drag each jelly to the gate of the same color', 'Vite, avant que ça fonde !': 'Hurry, before they melt!',
    'Une gelée a fondu en plein soleil': 'A jelly melted in the sun', 'Trop chaud, les gelées ont fondu': 'Too hot, the jellies melted',
    'Mets-la à l’ombre ou sors-la plus tôt': 'Keep it in the shade or get it out sooner', 'RECOMMENCER': 'RETRY', 'DIFFICILE': 'HARD', 'TRÈS DIFFICILE': 'VERY HARD', 'Touche une gelée': 'Tap a jelly', 'GEL {s} s': 'FREEZE {s}s', 'GELÉ': 'FROZEN', '+ GLAÇONS · continuer (+{s} s)': '+ ICE · continue (+{s}s)',
  });

  const GAME_NAME = 'JELLIES ON THE RUN';   // le nom du jeu ne se traduit pas (décidé le 5 oct. 2026) : un seul nom dans le jeu, sur l'App Store, sur le site et dans les clips
  // ------------------------------------------------------------ réglages
  let COLS = 6, ROWS = 8; const S = 144;           // grille du bac et taille d'une case (px). 144 (18 sept. 2026, « la surface de jeu est trop petite ») : le bac occupe 80 % de la largeur ; en mode tournage (échelle 0,82) il tient dans la zone sûre TikTok
  const BOX = { x: 108, y: 340 };                  // coin haut-gauche de la grille (bac centré)
  // PLATEAU VARIABLE (4 oct. 2026, d'après Color Block Jam et Block Out! : le bac n'est pas toujours un rectangle vide). Deux choses changent d'un
  // niveau à l'autre : la taille de la grille (6 × 8, 7 × 9, 8 × 10) et des cases murées (WALLS : piliers, goulets, coins coupés). Tout le code du bac
  // reste écrit en coordonnées « logiques » (case de S px, origine BOX) ; un bac plus grand est simplement dessiné réduit (BK) dans le même cadre à
  // l'écran (FRAME), donc avec des gelées plus petites. toSX / toSY : logique → écran (particules, textes, doigt du bot) ; toBX / toBY : écran → logique (doigt).
  const FRAME = { x: BOX.x, y: BOX.y, w: 6 * S, h: 8 * S }, MIDX = FRAME.x + FRAME.w / 2, MIDY = FRAME.y + FRAME.h / 2;
  let BK = 1, WALLS = null, board = { cols: 6, rows: 8, walls: [] }, boardKey = '';
  const toSX = x => MIDX + (x - BOX.x - COLS * S / 2) * BK, toSY = y => MIDY + (y - BOX.y - ROWS * S / 2) * BK;
  const toBX = x => (x - MIDX) / BK + BOX.x + COLS * S / 2, toBY = y => (y - MIDY) / BK + BOX.y + ROWS * S / 2;
  function setBoard(B) {
    board = B && B.cols ? B : { cols: 6, rows: 8, walls: [] }; COLS = board.cols; ROWS = board.rows; WALLS = null;
    if (board.walls && board.walls.length) { WALLS = new Int8Array(ROWS * COLS); WALLS.fill(-1); for (const k of board.walls) WALLS[k] = -2; }
    BK = Math.min(1, FRAME.w / (COLS * S), FRAME.h / (ROWS * S)); boardKey = COLS + 'x' + ROWS + ':' + (board.walls || []).join(',');
  }
  const emptyOcc = () => WALLS ? WALLS.slice() : new Int8Array(ROWS * COLS).fill(-1);   // occupation : -1 libre, -2 mur, sinon le numéro de la gelée
  const isWall = (r, c) => !!WALLS && WALLS[r * COLS + c] === -2;
  const WALL = 48, PAD = 6, RADIUS = 30;           // épaisseur des parois, marge autour d'une gelée, arrondi
  const BOT = FRAME.y + FRAME.h + WALL;             // bas de la paroi du bas : le décor du dessous (assiette, herbe, gamin, texte) s'y accroche
  // ------------------------------------------------------------ fonctionnalités de tournage (lancement organique TikTok / Instagram)
  // Chacune se règle ici, par une touche en jeu ou par un paramètre d'URL (ex. `?clip&loop&hook=1&level=47&bot=2&auto&film`).
  // Le reste du code ne lit que FEATURES : pour retirer une fonctionnalité, la mettre à false ici suffit.
  const URLP = (() => { const o = {}; const href = String(typeof window !== 'undefined' && window.location ? window.location.href : ''); href.split(/[?#]/).slice(1).join('&').split('&').forEach(kv => { if (!kv) return; const [k, v] = kv.split('='); o[k] = v === undefined ? true : decodeURIComponent(v); }); return o; })();
  const FEATURES = {
    clip: !!URLP.clip,                                   // C : niveau court calibré pour un clip de 15-30 s, quel que soit le niveau atteint (CLIP)
    loop: !!URLP.loop,                                   // L : le même niveau repart à l'identique, sans rideau (montage en boucle parfaite)
    hook: URLP.hook !== undefined ? +URLP.hook : -1,     // X : accroche affichée en haut à la place du titre (HOOKS), -1 = titre
    fakeLevel: URLP.level ? +URLP.level : 0,             // ?level=47 : numéro de niveau affiché (suggère la progression)
    finale: URLP.finale !== '0',                         // dernière gelée sortie à moins de FINALE.under s : zoom, flash, « IN EXTREMIS ! »
    heartbeat: URLP.heart !== '0',                       // 5 dernières secondes : battement de cœur et pulsation de l'image
    endcard: URLP.endcard === '1',                      // jeux : coupée par défaut (les étoiles s'affichent), ?endcard=1 pour la réactiver                       // fin de niveau : question qui appelle les commentaires (ENDCARDS) à la place des étoiles
    autostart: !!URLP.auto,                              // ?auto : le bot démarre tout seul, action dès la première image
    palette: URLP.palette ? +URLP.palette : 0,           // ?palette=1 : variante de couleurs (PALETTES), pour tester en A/B
    // effet waouh (18 sept. 2026), chacun débrayable par `?xxx=0`
    glass: URLP.glass !== '0',                           // gelées translucides : dégradé interne, liseré clair, ombre colorée, caustique au sol
    plate: URLP.plate !== '0',                           // sortie spectaculaire (étirement, filet de gelée, gouttes) puis atterrissage dans l'assiette qui se remplit (PLATE)
    meltShow: URLP.meltshow !== '0',                     // fonte mise en scène : gouttes qui coulent, flaque qui s'étale, visage qui glisse et panique
    musicLayers: URLP.layers !== '0',                    // musique en couches avec la chaleur (ukulélé, puis marimba, puis basse et percussions) et silence brutal avant la fin (SILENCE)
    sunFace: URLP.sun !== '0',                           // le soleil a un visage : sourire, puis regard méchant, puis il souffle sur le bac
    // deuxième série (18 sept. 2026)
    bakery: URLP.bakery !== '0',                         // le bac est une boîte de pâtisserie : carton crème, liseré doré, papier gaufré, étiquette « Gelées », trappes-fenêtres à rabat
    picnic: URLP.picnic !== '0',                         // décor : nappe à carreaux, table en bois, limonade dont les glaçons fondent avec le chrono, brume de chaleur sur les 10 dernières secondes, ciel du matin au plein soleil
    contrast: URLP.contrast !== '0',                     // contraste vidéo : vignette sombre autour du bac, contour des gelées plus épais, ombre plus franche
    physics: URLP.physics !== '0',                       // physique : la secousse se propage de gelée en gelée, compression puis rebond à la pose, regard qui suit l'inertie
    camera: URLP.camera === '1',                         // caméra vivante : zoom sur la gelée tenue, recul à chaque sortie, zoom sur la dernière (CAMERA). COUPÉE par défaut : jugée fatigante (« ça fait mal à la tête ») ; `?camera=1` pour l'essayer
    slowmo: URLP.slowmo !== '0',                         // ralenti sur la dernière sortie, sans zoom (CAMERA.slow, CAMERA.slowDur)
    // direction « plein été saturé » (18 sept. 2026, le thème crème était jugé terne et vide)
    summer: URLP.summer !== '0',                         // lumière : ciel bleu profond qui vire à l'orange, gros soleil aux rayons longs, nappe rouge et blanche, table sombre, fond de boîte menthe, contour de boîte, vignette forte (SKY)
    life: URLP.life !== '0',                             // vie autour du bac : nuages qui dérivent, papillons, abeille autour de la limonade, fourmis qui filent sous l'assiette, fleurs
    kid: URLP.kid !== '0',                               // le gamin (style proto 3) passe la tête au coin de la table : suit le doigt, ravi à chaque sortie, triste à la fonte
  };
  const SKY = { top0: '#2F7BFF', bot0: '#8ED0FF', top1: '#FF7A3D', bot1: '#FFC062' };   // ciel du matin bleu au plein soleil orange
  const CAMERA = { grab: 1.04, kick: -.05, slow: .35, slowDur: .9, lastZoom: 1.12 };   // zoom en main, recul à la sortie, facteur et durée du ralenti, zoom sur la dernière sortie
  // troisième série (18 sept. 2026)
  Object.assign(FEATURES, {
    streakFx: URLP.streak !== '0',                       // dès la 3e sortie enchaînée : éclair coloré autour du bac, confettis en gelée, « ×3 » qui grossit
    dropIn: URLP.dropin !== '0',                         // entrée de niveau : les gelées tombent dans le bac une à une avec rebond (action dès la première image)
    voices: URLP.voices !== '0',                         // voix des gelées : petit cri de joie à la sortie, gémissement à la butée, soupir à la victoire (répertoire sans répétition)
    ambience: URLP.ambience !== '0',                     // ambiance chaleur : cigales qui montent avec le thermomètre, goutte quand une gelée sue, tic-tac qui accélère sous 10 s
    meltSound: URLP.meltsound !== '0',                   // fonte : long sifflement liquide, « splash » de flaque, trombone triste ralenti
    musicPunct: URLP.punct !== '0',                      // ponctuation musicale : accord de résolution sur la finale, note tenue qui descend à la fonte, fanfare selon les étoiles
  });
  // quatrième série (18 sept. 2026) : lisibilité des trappes et fonte au soleil (les deux points faibles relevés au bilan)
  Object.assign(FEATURES, {
    bigGates: URLP.gates !== '0',                        // trappes deux fois plus grosses : elles débordent de la paroi et ont un seuil coloré au sol du bac, gros chevrons ; gelée en main : les trappes où elle passe pulsent, celles de sa couleur trop étroites sont barrées de rouge, les autres s'estompent ; « TROP LARGE ! » quand elle bute sur une trappe trop étroite
    sunMelt: URLP.sunmelt !== '0',                       // fonte au soleil : le soleil tape par le haut du bac, une gelée que rien n'abrite (aucune gelée au-dessus d'elle) chauffe et fond (SUN), à l'ombre elle refroidit ; une seule gelée fondue = niveau perdu ; le chrono global reste en filet, allongé. Les niveaux sont vérifiés à la génération (le plan du solveur au rythme humain ne fait fondre personne)
  });
  FEATURES.grass = URLP.grass !== '0';   // le bas de l'écran (sous la nappe) est de l'herbe et non une table sombre (retour du 18 sept. 2026 : « le fond est noir »)
  const SUN = { expose: 28, target: .55, cool: 20, timeScale: 1.4, warn: .4, panic: .7, safe: .8 };   // s de plein soleil pour fondre (base), chaleur visée par le plan du solveur (l'exposition du niveau s'allonge pour ne pas la dépasser), s à l'ombre pour refroidir, allongement du chrono, chaleur de la sueur, de la panique, chaleur max tolérée à la génération
  let sunExpose = SUN.expose;   // exposition du niveau en cours (s de plein soleil pour fondre), calée sur le plan du solveur dans init()
  const GATE = { ext: 24, lip: 16, chevron: 16 };                                        // trappes (FEATURES.bigGates) : débord au-delà de la paroi, seuil coloré dans le bac, taille des chevrons (px)
  // répertoires de voix : listes de [fréquence de départ, d'arrivée, durée, délai] ; jamais deux fois la même à la suite
  const VOICES = {
    joy: [[[520, 900, .18, 0], [900, 1150, .16, .17]], [[600, 1250, .3, 0]], [[700, 700, .1, 0], [720, 1050, .2, .12]], [[800, 1300, .12, 0], [800, 1300, .12, .14], [900, 1500, .2, .28]]],
    groan: [[[300, 180, .35, 0]], [[260, 230, .18, 0], [240, 150, .25, .2]], [[340, 200, .3, 0], [220, 170, .2, .32]]],
    relief: [[[700, 320, .6, 0]], [[600, 420, .45, 0], [420, 240, .5, .45]], [[800, 500, .3, 0], [500, 300, .6, .3]]],
  };
  // assiette sous le bac : position, largeur utile, échelle des gelées posées, durée du vol, écart entre les rangs (qui descendent vers le spectateur).
  // 19 sept. 2026 : descendue et gelées hautes couchées, pour que rien ne monte devant la paroi du bas et ses trappes (BOT + GATE.ext = bord des trappes)
  const PLATE = { x: W / 2, y: BOT + 118, w: 700, scale: .32, fly: .55, rowDy: 28 };
  const SILENCE = 2.2;                                                 // la musique se coupe net à ce nombre de secondes de la fin (ne reste que le cœur)
  const CLIP = { colors: 5, fill: .55, detours: 2, gateLen: [1, 3], gates: 1, big: true, time: 30 };   // le niveau de clip : ~11 gelées, 2 détours, 30 s de chrono
  const FINALE = { under: 3, zoom: 1.28, text: tr('IN EXTREMIS !') };
  // accroches (« | » = retour à la ligne, {n} = numéro de niveau affiché) ; X fait défiler, ?hook=N
  const HOOKS = C.byLang({
    fr: ['Niveau {n} : seulement 3 %|y arrivent du premier coup', 'Tu vois la solution ?|Moi j’ai mis 12 essais', 'Sors-les toutes avant|qu’elles ne fondent…', 'Le niveau {n} rend fou|(regarde la fin)', 'Facile ? Dis-moi|en combien de secondes'],
    en: ['Level {n}: only 3%|beat it on the first try', 'Can you see the solution?|Took me 12 tries', 'Get them all out|before they melt…', 'Level {n} drives you crazy|(watch till the end)', 'Easy? Tell me|how many seconds'],
  });
  const ENDCARDS = C.byLang({
    fr: ['Tu l’aurais eu ?', 'Niveau suivant ?', 'Trop facile ? Dis-le en commentaire', 'Combien de secondes il te restait ?'],
    en: ['Would you have made it?', 'Next level?', 'Too easy? Say it in the comments', 'How many seconds would you have left?'],
  });
  // fraise, citron, pomme, myrtille, cassis, orange : saturées, bien séparées, lisibles en vidéo ; variantes néon et pastel pour comparer
  const PALETTES = [['#FF4D6D', '#FFC533', '#3ED47E', '#3B9CFF', '#B26BFF', '#FF8A3D'], ['#FF2E63', '#FFE600', '#08F7A0', '#00C2FF', '#C36BFF', '#FF7A00'], ['#FF8FA3', '#FFE08A', '#8FE3A8', '#8CC7FF', '#CBA6FF', '#FFB380']];
  const PALETTE = PALETTES[FEATURES.palette % PALETTES.length];
  const SHAPES = {
    i1: [[0, 0]], i2h: [[0, 0], [0, 1]], i2v: [[0, 0], [1, 0]], i3h: [[0, 0], [0, 1], [0, 2]], i3v: [[0, 0], [1, 0], [2, 0]],
    o: [[0, 0], [0, 1], [1, 0], [1, 1]],
    l0: [[0, 0], [1, 0], [1, 1]], l1: [[0, 0], [0, 1], [1, 0]], l2: [[0, 0], [0, 1], [1, 1]], l3: [[0, 1], [1, 0], [1, 1]],
    r23: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], r32: [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]],
  };
  const SHAPE_W = { i1: .35, i2h: 2, i2v: 2, i3h: 1.3, i3v: 1.3, o: 1, l0: .8, l1: .8, l2: .8, l3: .8 }, BIG = { r23: .7, r32: .7 };
  // Courbe : [couleurs, remplissage (part des 48 cases), détours visés, longueur des trappes [min, max], trappes par couleur, grosses gelées 2×3]
  const CURVE = [
    [3, .40, 0, [2, 3], 2, false],
    [4, .50, 0, [2, 3], 2, false],
    [4, .56, 1, [1, 3], 1, false],
    [5, .62, 1, [1, 3], 1, true],
    [5, .66, 2, [1, 2], 1, true],
    [6, .70, 2, [1, 2], 1, true],
    [6, .72, 3, [1, 2], 1, true],
  ];
  const TIME = { base: 6, perBlock: 3, perDetour: 6, rescue: 15 };   // chrono du niveau = base + perBlock × gelées + perDetour × détours ; secours « + GLAÇONS »
  const GEN = { tries: 30, nodes: 120, close: 8, softOver: 2 };                   // candidats max par niveau, nœuds max du solveur exact par candidat, candidats avant d'accepter « presque »
  const STARS = [.5, .25];                                           // part du temps restant : 3 étoiles au-dessus de 50 %, 2 au-dessus de 25 %
  const SEED = 2026;                                                 // changer la graine redessine tous les niveaux (chaque niveau reste identique d'un essai à l'autre)
  const OFFER_RESCUE = true;
  const MOVE = { speed: 30, step: .02, flush: .06, align: .22 };    // vitesse de suivi (cases/s), pas de collision, tolérances de sortie (contre la paroi, alignement)
  const HUMAN = { seg: .2, blunder: .18, think: [.3, .9], park: .6 };  // bot humain : durée par case, bourdes, réflexion, part des rangements pris au solveur
  const RETRY_BTN = { x: W / 2, y: H / 2 + 130, w: 600, h: 124 }, RESCUE_BTN = { x: W / 2, y: H / 2 + 280, w: 560, h: 96 };
  const TUNE = { time: 1 };
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];   // haut, bas, gauche, droite = index des parois
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // RYTHME EN DENTS DE SCIE (4 oct. 2026, veille concurrence : Color Block Jam enchaîne « 3 ou 4 niveaux, puis un difficile » annoncé à l'avance) :
  // un niveau difficile tous les 5 (9, 14, 19…), très difficile en fin de zone (19, 39…), suivi d'un niveau de respiration (10, 15, 20…).
  const hardOf = lv => lv < 9 || lv % 5 !== 4 ? 0 : lv % 20 === 19 ? 2 : 1;
  const ICE_FROM = 11;   // la gelée glacée arrive au niveau 11 (niveau d'apprentissage, facile), puis revient deux niveaux sur trois
  // Suite des nouveautés (4 oct. 2026), une tous les 2 à 5 niveaux comme chez les concurrents ; chacune a son niveau d'apprentissage facile :
  // murs dans le bac (7), gelée glacée (11), gelée à deux couches (16), bac plus grand donc gelées plus petites (21), caisse qui cache une gelée (23),
  // très grand bac (41). Les aides arrivent entre deux : glaçons (6), cuillère (13), louche (18) — voir BOOSTS.
  const WALLS_FROM = 7, LAYER_FROM = 16, BIG_FROM = 21, CRATE_FROM = 23, HUGE_FROM = 41, TEACH = [WALLS_FROM, ICE_FROM, LAYER_FROM, BIG_FROM, CRATE_FROM], PRECALC = 300;   // PRECALC : nombre de niveaux de gelees/levels.js (node jeux/tools/gelees-niveaux.js 300)
  // ZONES de 20 niveaux, au nom d'un parfum de gelée. Chacune a son habillage (4 oct. 2026) : couleur et motif de la nappe, ciel du matin, sol sous la
  // nappe (herbe, sable, mousse, paille, bruyère, terre cuite) et sa variante de la musique (tonalité, suite d'accords, mélodie à l'endroit ou à
  // l'envers, tempo). sky : haut et bas du ciel au début du niveau (il vire toujours à l'orange avec la chaleur) ; ground : dégradé haut et bas,
  // deux teintes de brins, trois teintes de touffes. Un vrai décor dessiné par zone reste à faire (plan.md, section 3 bis).
  const CHAPTER_LEN = 20, CHAPTERS = [
    { name: { fr: 'Fraise', en: 'Strawberry' }, cloth: '#E04A55', color: '#FF4D6D', pattern: 'check', sky: ['#2F7BFF', '#8ED0FF'],
      ground: ['#7ED957', '#3E9B35', 'rgba(46,125,50,.55)', 'rgba(120,210,90,.6)', '#3E9B35', '#5DBB4A', '#8AE066'], music: { shift: 0, prog: 0, rev: false, bpm: [104, 148] } },
    { name: { fr: 'Myrtille', en: 'Blueberry' }, cloth: '#3B8FE0', color: '#3B9CFF', pattern: 'stripes', sky: ['#12A5D8', '#B6F0FF'],
      ground: ['#F4DFA6', '#D9B36A', 'rgba(170,130,60,.45)', 'rgba(255,240,200,.7)', '#D9B36A', '#E8C987', '#F7E6B5'], music: { shift: 5, prog: 1, rev: false, bpm: [96, 140] } },
    { name: { fr: 'Pomme', en: 'Apple' }, cloth: '#35B36A', color: '#3ED47E', pattern: 'dots', sky: ['#3FA7FF', '#C9F2C0'],
      ground: ['#5FC27A', '#1F7A4D', 'rgba(20,90,60,.55)', 'rgba(140,220,150,.6)', '#1F7A4D', '#36A065', '#7BD694'], music: { shift: -3, prog: 2, rev: true, bpm: [108, 152] } },
    { name: { fr: 'Citron', en: 'Lemon' }, cloth: '#E9A91C', color: '#FFC533', pattern: 'diamonds', sky: ['#3D8BFF', '#FFF1A8'],
      ground: ['#E6D36A', '#B79A2E', 'rgba(140,110,20,.5)', 'rgba(255,245,170,.65)', '#B79A2E', '#D4BB4A', '#F2E48A'], music: { shift: 2, prog: 1, rev: true, bpm: [112, 156] } },
    { name: { fr: 'Cassis', en: 'Blackcurrant' }, cloth: '#9A5BE8', color: '#B26BFF', pattern: 'stripes', sky: ['#5B4BD6', '#F3B6E6'],
      ground: ['#9A7BD0', '#5A3E96', 'rgba(60,35,110,.55)', 'rgba(200,170,245,.6)', '#5A3E96', '#7C5CC0', '#B79AE8'], music: { shift: -5, prog: 2, rev: false, bpm: [92, 136] } },
    { name: { fr: 'Orange', en: 'Orange' }, cloth: '#F07A2E', color: '#FF8A3D', pattern: 'dots', sky: ['#FF8A5B', '#FFE0A3'],
      ground: ['#E39A5B', '#A8562A', 'rgba(110,50,15,.5)', 'rgba(255,200,150,.6)', '#A8562A', '#C9743D', '#F0A870'], music: { shift: 7, prog: 0, rev: true, bpm: [110, 154] } },
  ];
  // Décors illustrés (4 oct. 2026) : une image par zone dans gelees/decors/, chargée à la demande ; tant qu'elle manque ou charge, le décor dessiné
  // par le code reste affiché. `?decor=0` pour revenir au décor dessiné. Prompts de génération : jeux/art/prompts-decors.md.
  const DECORS = ['decor-fraise.webp', 'decor-myrtille.webp', 'decor-pomme.webp', 'decor-citron.webp', 'decor-cassis.webp', 'decor-orange.webp'], DECOR_IMG = {};   // dans l'ordre des zones ; une zone sans image garde le décor dessiné
  function decorImage() {
    const f = URLP.decor === '0' || typeof Image === 'undefined' ? null : DECORS[CHAPTERS.indexOf(theme())]; if (!f) return null;
    const im = DECOR_IMG[f] || (DECOR_IMG[f] = Object.assign(new Image(), { onload() { placeBands(); }, src: 'decors/' + f }));   // à l'arrivée de l'image : les bandes hors canevas (le jeu peut être en pause derrière un menu, sans dessin)
    return im.complete && im.naturalWidth ? im : null;
  }
  // DÉCOR PLEIN ÉCRAN (5 oct. 2026) : le jeu est dessiné en 9:16, un téléphone est plus allongé (9:19,5) : il restait une bande de couleur unie
  // au-dessus et une au-dessous du canevas. L'image du décor est maintenant agrandie pour couvrir tout l'écran (environ 20 % de plus sur un iPhone,
  // ses bords gauche et droit sortent de l'écran) : le canevas en dessine la partie centrale (decorView), et deux calques HTML derrière lui en montrent
  // la suite, à la même échelle, donc sans raccord visible. Le bac garde sa taille : la nappe dessinée dans l'image dépasse désormais autour de lui.
  // Un troisième calque reprend l'assombrissement des bords du jeu (drawVignette), pour qu'aucune marche de luminosité ne trahisse le bord du canevas.
  // Écran en 9:16, mode tournage ou pas de page (outils sans navigateur) : l'image est simplement recadrée au canevas, comme avant.
  const BANDS = typeof document !== 'undefined' && document.createElement && document.body && !FEATURES.clip ? [0, 1, 2].map(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;z-index:-1;pointer-events:none;background-repeat:no-repeat;display:none'; document.body.appendChild(d); return d; }) : null;
  let bandKey = '', decorZoom = 1;   // decorZoom : agrandissement de l'image par rapport au simple recadrage au canevas (1 = écran en 9:16)
  function decorView(im) {   // partie de l'image que le canevas dessine : centrée, à l'échelle qui couvre tout l'écran
    const k = Math.max(W / im.naturalWidth, H / im.naturalHeight) * decorZoom, sw = W / k, sh = H / k;
    return [(im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh];
  }
  function placeBands() {
    if (!BANDS) return; const im = decorImage(), r = C.canvas.getBoundingClientRect(), top = Math.round(r.top), bot = Math.round(window.innerHeight - r.bottom), on = !!im && (top > 1 || bot > 1) && !C.film;
    bandKey = (im ? im.src : '-') + '|' + C.film;
    for (const d of BANDS) d.style.display = on ? 'block' : 'none'; document.body.style.background = on ? 'transparent' : '';   // le fond du corps de page masquerait les calques (celui de la racine reste derrière)
    decorZoom = 1; if (!on) return;
    const fit = Math.max(r.width / im.naturalWidth, r.height / im.naturalHeight), sc = Math.max(fit, window.innerHeight / im.naturalHeight);   // px d'écran par px d'image : couvrir le canevas, puis tout l'écran
    decorZoom = sc / fit;
    const iw = im.naturalWidth * sc, ih = im.naturalHeight * sc, x0 = (r.width - iw) / 2, y0 = r.top + r.height / 2 - ih / 2, [a, b, veil] = BANDS;   // image centrée sur le canevas ; y0 : son bord haut dans la page
    for (const [d, y, hgt] of [[a, 0, top], [b, r.top + r.height, bot]]) { d.style.left = r.left + 'px'; d.style.width = r.width + 'px'; d.style.top = y + 'px'; d.style.height = hgt + 'px'; d.style.backgroundImage = 'url("' + im.src + '")'; d.style.backgroundSize = iw + 'px ' + ih + 'px'; d.style.backgroundPosition = x0 + 'px ' + (y0 - y) + 'px'; }
    const k = r.width / W; veil.style.left = r.left + 'px'; veil.style.width = r.width + 'px'; veil.style.top = '0'; veil.style.height = window.innerHeight + 'px';
    veil.style.background = FEATURES.contrast ? 'radial-gradient(circle at ' + (r.width / 2) + 'px ' + (r.top + MIDY * k) + 'px, ' + (FEATURES.summer ? 'rgba(40,20,10,0) ' : 'rgba(60,30,10,0) ') + (520 * S / 120 * k) + 'px, ' + (FEATURES.summer ? 'rgba(40,20,10,.62) ' : 'rgba(60,30,10,.45) ') + (1150 * S / 120 * k) + 'px)' : 'none';
  }
  if (BANDS) window.addEventListener('resize', placeBands);
  // Éléments animés illustrés (4 oct. 2026) : une planche de 2 × 2 cases par zone (cases 0 à 3, de gauche à droite puis de haut en bas), fond détouré.
  // fly : les deux images du battement d'ailes (une seule : l'image est pincée en largeur, comme les papillons dessinés) ; crawl : la bête qui grimpe le long du bac ;
  // fall : ce qui tombe en tournant dans les marges ; glow : ce qui flotte sur place en clignotant. Sans planche, les papillons dessinés restent.
  const ELEMENTS = [   // dans l'ordre des zones ; flap : vitesse du battement (14 par défaut, un papillon)
    { f: 'elements-fraise.webp', fly: [0, 1], crawl: 2, fall: [3] },             // papillon ×2, coccinelle, pétale
    { f: 'elements-myrtille.webp', fly: [0, 1], flap: 5, flySize: 110, crawl: 2, crawlSize: 70 },   // mouette ×2, crabe (la vague, case 3, n'est pas utilisée)
    { f: 'elements-pomme.webp', fly: [2, 3], flap: 30, fall: [0, 1] },         // feuille, pétale, abeille ×2
    { f: 'elements-citron.webp', fly: [0], fall: [2, 3] },                     // papillon (case 1 : de profil, pas utilisée), pétale de tournesol, pissenlit
    { f: 'elements-cassis.webp', fly: [1], glow: [0, 3, 0, 3] },               // luciole, papillon de nuit (case 2 : de profil, pas utilisée), étoile
    { f: 'elements-orange.webp', fall: [0, 1, 2, 3], fallSize: 62 },           // feuilles d'érable et de chêne, gland (pas de bête qui vole : les papillons dessinés restent)
  ];
  function elementsSheet() {
    const e = URLP.decor === '0' || typeof Image === 'undefined' ? null : ELEMENTS[CHAPTERS.indexOf(theme())]; if (!e) return null;
    const im = DECOR_IMG[e.f] || (DECOR_IMG[e.f] = Object.assign(new Image(), { src: 'decors/' + e.f }));
    return im.complete && im.naturalWidth ? (e.im = im, e) : null;
  }
  function drawElement(e, i, x, y, size, rot, sx) { const c = e.im.naturalWidth / 2; ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (sx) ctx.scale(sx, 1); ctx.drawImage(e.im, (i % 2) * c, (i >> 1) * c, c, c, -size / 2, -size / 2, size, size); ctx.restore(); }
  const theme = () => CHAPTERS[+URLP.zone >= 1 ? (+URLP.zone - 1) % CHAPTERS.length : FEATURES.clip ? 0 : Math.floor((Math.max(1, level) - 1) / CHAPTER_LEN) % CHAPTERS.length];   // les clips gardent l'habillage du pique-nique ; `?zone=2` force l'habillage d'une zone (1 à 6), quel que soit le niveau
  const chapterOf = lv => { const k = Math.floor((Math.max(1, lv) - 1) / CHAPTER_LEN), ch = CHAPTERS[k % CHAPTERS.length], round = Math.floor(k / CHAPTERS.length); return { index: k, from: k * CHAPTER_LEN + 1, to: (k + 1) * CHAPTER_LEN, name: C.byLang(ch.name) + (round ? ' ' + (round + 1) : ''), color: ch.color, cloth: ch.cloth }; };
  function levelParams(lv) {
    if (FEATURES.clip) return CLIP;
    const row = CURVE[Math.min(lv, CURVE.length) - 1];
    const extra = Math.max(0, lv - CURVE.length), hard = hardOf(lv), easy = lv >= 10 && lv % 5 === 0;
    let detours = Math.min(4, row[2] + Math.floor(extra / 6)), fill = Math.min(.76, row[1] + extra * .01);
    if (hard) detours = Math.min(5, detours + 1);   // très difficile : même cible, un glaçon de plus (un bac plus rempli met le générateur en échec)
    else if (easy) { detours = Math.max(1, detours - 2); fill -= .08; }
    const teach = TEACH.includes(lv); if (teach) { detours = 1; fill = .5; }
    const ice = lv < ICE_FROM || lv === LAYER_FROM || lv === BIG_FROM ? 0 : lv === ICE_FROM || lv === CRATE_FROM ? 1 : hard ? 1 + hard : easy ? 1 : [1, 0, 2][lv % 3];
    const walls = lv < WALLS_FROM || (teach && lv !== WALLS_FROM) ? false : lv === WALLS_FROM ? 'pillar' : lv % 3 !== 1;   // murs : deux niveaux sur trois
    const board = lv > PRECALC ? [6, 8] : lv >= HUGE_FROM && lv % 3 === 0 ? [8, 10] : lv >= BIG_FROM && lv % 2 === 1 ? [7, 9] : [6, 8];   // au-delà des niveaux précalculés, le téléphone calcule lui-même : pas de grand bac (plusieurs secondes de calcul)
    const layers = lv < LAYER_FROM || lv === CRATE_FROM || lv === BIG_FROM ? 0 : lv === LAYER_FROM ? 1 : [1, 2, 0, 1][lv % 4];
    const crate = lv < CRATE_FROM ? 0 : lv === CRATE_FROM ? 1 : .5;   // part des glaçons qui sont des caisses
    return { colors: row[0], fill, detours, gateLen: row[3], gates: row[4], big: row[5], ice, hard, walls, board, layers, crate };
  }

  // ------------------------------------------------------------ état
  let blocks, gates, level = 1, state, P, drag = null, timeLeft = 0, timeTotal = 1, started = false, rescued = false, levelT = 0, plan = null, diff = {}, streak = 0, streakT = 0, botHuman = false, lastInitLevel = 0, tickS = 0, why = null, heatWave = 0;
  const stats = { attempts: 0, melts: 0, sunMelts: 0, rescues: 0 };
  // AIDES EN COURS DE NIVEAU (4 oct. 2026, le cœur des revenus de Color Block Jam et de Block Out!) : la coquille affiche les boutons, tient les comptes
  // et vend les recharges en pièces ; le jeu applique l'effet. Glaçons : la chaleur et le chrono s'arrêtent BOOST.freeze secondes et toutes les gelées
  // refroidissent. Cuillère : la gelée touchée saute dans l'assiette. Louche : toutes les gelées de la couleur touchée. freezeT : gel restant ; aim : aide qui attend sa cible.
  const BOOST = { freeze: 10 };
  let freezeT = 0, aim = null;
  let sunDepth = new Array(COLS).fill(ROWS);   // FEATURES.sunMelt : par colonne, ligne de la première gelée touchée par le soleil (ROWS = colonne vide, lumière jusqu'au fond)
  const cam = { z: 1, x: W / 2, y: H / 2 };   // zoom de la finale (FEATURES.finale) et pulsation du battement de cœur
  let endcardI = 0, finales = 0, plate = [], silenced = false;   // plate : gelées posées dans l'assiette ; silenced : musique coupée avant la fin
  let camLock = 0, camKick = 0, slowmo = 0, labelPos = null;     // caméra : verrou pendant une animation forcée, recul, ralenti restant ; étiquette de la boîte
  let boltT = 0, boltCol = '#fff', ticAcc = 0, ticHi = false, dripAcc = 0, voiceCd = 0; const lastVoice = {};   // éclair de série, tic-tac, gouttes, voix
  // ------------------------------------------------------------ CACHES DE RENDU (24 sept. 2026) : le PC de tournage (i5-1235U, Iris Xe) tenait 35 à 46 i/s au lieu de 60.
  // Le temps JavaScript n'y est pour rien (2,7 ms par image) : c'est la carte graphique qui peine sur les ombres floues (shadowBlur) et les aplats redessinés
  // à chaque image. Ce qui ne change pas d'une image à l'autre est donc dessiné une fois hors écran, puis recopié : la nappe, l'herbe (20 fois par seconde),
  // la boîte, le disque du soleil, la vignette, le corps de chaque gelée. Le rendu est identique ; sans document (harnais headless) tout se dessine comme avant.
  const offscreen = (w, h) => { if (typeof document === 'undefined' || !document.createElement) return null; const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
  const CACHE = { cloth: null, grass: null, grassAt: -1, tray: null, vignette: null, sun: {} };
  // le personnage au coin de la table. mood : 0 curieux, 1 ravi (sortie), -1 triste (fonte), 2 inquiet (gelée près de fondre), 3 soulagé (sortie de
  // justesse, sauvetage), 4 épaté (série), 5 « oups » (trappe trop étroite), 6 fait la fête (victoire), 7 bâille (joueur inactif). `?mood=4` force une humeur.
  const kid = { mood: 0, t: 0, hop: 0, idle: 0 }, KID_IDLE = 12;
  function kidReact(mood, t, hop = 0) { if (!FEATURES.kid) return; kid.mood = mood; kid.t = t; kid.idle = 0; C.killTweens(kid); kid.hop = 0; if (hop) { C.tween(kid, { hop }, .18, { ease: ease.outQuad }); C.tween(kid, { hop: 0 }, .3, { delay: .18, ease: ease.outBounce }); } }
  const shownLevel = () => FEATURES.fakeLevel || level;

  function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }   // mulberry32

  function init() {
    state = 'play'; drag = null; started = false; rescued = false; levelT = 0; plan = null; streak = 0; streakT = 0; tickS = 0; why = null; heatWave = 0; freezeT = 0; setAim(null);
    if (level !== lastInitLevel) { stats.attempts = 0; stats.melts = 0; stats.sunMelts = 0; stats.rescues = 0; lastInitLevel = level; }
    stats.attempts++;
    P = levelParams(level);
    if (!FEATURES.clip && typeof document !== 'undefined' && document.documentElement) { const TH = theme(), st = document.documentElement.style; st.setProperty('--bg-top', TH.sky[0]); st.setProperty('--bg-bottom', TH.ground[1]); placeBands(); }   // le fond de page (écrans plus longs que 9:16) suit la zone
    // niveaux précalculés (gelees/levels.js) : lancement instantané ; au-delà de la liste, ou avec des réglages de tournage, génération à la volée
    const pre = PRE && PRE[level - 1], g = pre ? unpackLevel(pre) : genLevel(level);
    const M = g.M;
    gates = M.gates.map(x => Object.assign({ glow: 0, flash: 0 }, x));
    blocks = M.blocks.map((b, i) => makeBlock(b, M.pos[i][0], M.pos[i][1], i));
    diff = { detours: g.detours, moves: g.moves, blocks: blocks.length, nodes: g.nodes, genMs: g.ms, tries: g.tries, sunMax: g.sunMax, rej: g.rej, pre: !!pre };
    // exposition du niveau : la base, allongée si le plan du solveur au rythme humain chaufferait une gelée au-delà de SUN.target (les niveaux longs restent tenables)
    sunExpose = SUN.expose * Math.max(1, diff.sunMax / SUN.target); diff.sunExpose = Math.round(sunExpose);
    // chrono : avec la fonte au soleil (FEATURES.sunMelt) il n'est plus qu'un filet de sécurité, allongé de SUN.timeScale (le clip garde ses 30 s)
    timeTotal = timeLeft = Math.round((FEATURES.clip && CLIP.time ? CLIP.time : (TIME.base + TIME.perBlock * blocks.length + TIME.perDetour * Math.max(0, g.detours)) * (FEATURES.sunMelt ? SUN.timeScale : 1)) * TUNE.time);
    sunDepth = new Array(COLS).fill(ROWS);
    cam.z = 1; cam.x = W / 2; cam.y = H / 2; C.killTweens(cam); camLock = 0; camKick = 0; slowmo = 0; plate = []; musicRestore(); kid.mood = 0; kid.t = 0; kid.hop = 0; kid.idle = 0; C.killTweens(kid);
    // étiquette « Gelées » de la boîte : sur deux cases libres de la paroi du bas, sinon du haut, sinon pas d'étiquette
    labelPos = null; for (const wall of [1, 0]) { const busy = new Set(); gates.filter(g => g.wall === wall).forEach(g => { for (let k = g.i; k < g.i + g.len; k++) busy.add(k); }); for (let i = 0; i < COLS - 1 && !labelPos; i++) if (!busy.has(i) && !busy.has(i + 1)) labelPos = { wall, i }; if (labelPos) break; }
    if (FEATURES.dropIn) blocks.forEach((b, i) => { b.drop = -(ROWS + 2 - b.y); C.tween(b, { drop: 0 }, .6, { ease: ease.outBounce, delay: .07 * i, onDone() { fx.land(1 + i * .04); b.wob = Math.max(b.wob, .12); b.wobT = 0; } }); });   // chute une à une avec rebond
    else blocks.forEach((b, i) => { b.lift = 0; C.tween(b, { lift: 1 }, .4, { ease: ease.outBack, delay: .03 * i }); });
    initT = C.time; hintCache = null; if (global.Shell && level === 1) Shell.hint('gelees.exit', { path: hintPath });
  }
  // tutoriel (coquille, niveau 1 au premier lancement) : la main fait glisser jusqu'à sa trappe la gelée qui sort le plus vite ; appris à la première sortie
  let initT = 0, hintCache = null;
  function hintPath() {
    if (state !== 'play' || drag || C.time - initT < .8 + .07 * blocks.length) return null;   // après la chute des gelées
    const key = blocks.map(b => b.state === 'idle' ? b.r + ',' + b.c : '-').join(' ');
    if (!hintCache || hintCache.key !== key) {
      const ex = exitMoves(model()).sort((a, b) => a.path.length - b.path.length)[0]; let pts = null;
      if (ex) {
        const b = ex.b, at = ([r, c]) => [toSX(BOX.x + (c + b.bw / 2) * S), toSY(BOX.y + (r + b.bh / 2) * S)], [dr, dc] = DIRS[ex.exit !== undefined ? ex.exit : ex.peel];
        pts = simplify(ex.path).map(at); const e = pts[pts.length - 1]; pts.push([e[0] + dc * S * BK * 1.2, e[1] + dr * S * BK * 1.2]);   // et on pousse à travers la trappe
      }
      hintCache = { key, pts };
    }
    return hintCache.pts;
  }
  function makeBlock(b, r, c, id) {
    const sugar = []; for (const [rr, cc] of b.cells) for (let k = 0; k < 5; k++) sugar.push({ x: cc * S + rand(18, S - 18), y: rr * S + rand(18, S - 18), s: rand(2, 4.5) });
    // le visage va sur la case la plus centrale de la forme
    const cx = (b.bw - 1) / 2, cy = (b.bh - 1) / 2; let face = 0, bd = 1e9; b.cells.forEach(([rr, cc], i) => { const d = Math.hypot(cc - cx, rr - cy); if (d < bd - 1e-6) { bd = d; face = i; } });
    return { id, cells: b.cells, bw: b.bw, bh: b.bh, color: b.color, r, c, x: c, y: r, vx: 0, vy: 0, state: 'idle', sx: 1, sy: 1, wob: 0, wobT: 0, lift: 1, alpha: 1, melt: 0, heat: 0, sun: 0, look: { x: 0, y: 0 }, blink: rand(1, 4), blinkT: 0, sugar, face, bumpT: 0, mood: 0, ice: b.ice || 0, iceT: 0, thaw: 0, crate: !!b.crate, inner: b.inner >= 0 ? b.inner : -1 };   // crate : le glaçon est une caisse (couleur cachée) ; inner : couleur intérieure d'une gelée à deux couches (-1 = une seule)   // heat : chaleur accumulée au soleil (1 = fondue), sun : part de ses colonnes en plein soleil
  }

  // ------------------------------------------------------------ modèle et solveur
  // Une gelée qui sort ne gêne jamais les autres (elle libère des cases) : on applique donc toutes les sorties possibles en boucle
  // (« fermeture »), puis on cherche le plus petit nombre de rangements (« détours ») entre deux fermetures, meilleur d'abord.
  // GELÉE GLACÉE (4 oct. 2026, veille concurrence : la mécanique phare de Color Block Jam et de Block Out!) : b.ice = nombre de sorties à attendre
  // avant le dégel. Prise dans son glaçon, elle ne bouge pas, ne sort pas et ne chauffe pas (mais elle fait de l'ombre aux autres).
  // Dans un modèle, le nombre de sorties déjà faites est le nombre de positions vides (le modèle « vivant » du bot repart de zéro avec le compte restant).
  const outOf = pos => { let n = 0; for (const p of pos) if (!p) n++; return n; };
  const iced = (b, out) => (b.ice || 0) > out;
  // GELÉE À DEUX COUCHES (4 oct. 2026, vue chez Color Block Jam au niveau 15) : b.color est la couche extérieure, b.inner la couleur du cœur. Devant une
  // trappe de sa couleur extérieure elle ne sort pas : la couche part, elle reste là avec sa couleur intérieure, et devra gagner la trappe de celle-ci.
  // Dans un modèle, une gelée pelée porte un 1 en troisième position ([ligne, colonne, 1]) et se lit par sa copie « peeled » (couleur intérieure).
  const layered = b => b.inner >= 0;
  const eff = (b, p) => p && p[2] && b.peeled ? b.peeled : b;
  const withPeel = b => { b.peeled = b.inner >= 0 ? Object.assign({}, b, { color: b.inner, inner: -1, peeled: null }) : null; return b; };
  function shapeOf(name) { const cells = SHAPES[name]; let bw = 0, bh = 0; for (const [r, c] of cells) { bw = Math.max(bw, c + 1); bh = Math.max(bh, r + 1); } return { cells, bw, bh }; }
  function occOf(bs, pos, skip) { const occ = emptyOcc(); bs.forEach((b, i) => { if (i === skip || !pos[i]) return; for (const [r, c] of b.cells) occ[(pos[i][0] + r) * COLS + pos[i][1] + c] = i; }); return occ; }
  function fitsAt(b, r, c, occ) { for (const [rr, cc] of b.cells) { const R = r + rr, Cc = c + cc; if (R < 0 || Cc < 0 || R >= ROWS || Cc >= COLS || occ[R * COLS + Cc] !== -1) return false; } return true; }
  function reach(b, r0, c0, occ) {   // toutes les positions atteignables en coulissant (parcours en largeur) ; seen : case → case précédente
    const seen = new Map(); const q = [[r0, c0]]; seen.set(r0 * COLS + c0, -1);
    for (let h = 0; h < q.length; h++) { const [r, c] = q[h]; for (const [dr, dc] of DIRS) { const nr = r + dr, nc = c + dc, k = nr * COLS + nc; if (seen.has(k) || !fitsAt(b, nr, nc, occ)) continue; seen.set(k, r * COLS + c); q.push([nr, nc]); } }
    return { list: q, seen };
  }
  function pathTo(seen, r, c) { const path = []; let k = r * COLS + c; while (k !== -1 && k !== undefined) { path.push([Math.floor(k / COLS), k % COLS]); k = seen.get(k); } return path.reverse(); }
  // trappe : { wall (0 haut, 1 bas, 2 gauche, 3 droite), i : première case le long de la paroi, len, color }
  function fitsGate(b, g) { return g.wall < 2 ? g.len >= b.bw : g.len >= b.bh; }
  function exitAt(b, r, c, occ, gs) {
    for (const g of gs) {
      if (g.color !== b.color) continue;
      if (g.wall < 2) { if (c < g.i || c + b.bw > g.i + g.len) continue; if (g.wall === 0 ? r !== 0 : r + b.bh !== ROWS) continue; }
      else { if (r < g.i || r + b.bh > g.i + g.len) continue; if (g.wall === 2 ? c !== 0 : c + b.bw !== COLS) continue; }
      if (clearToWall(b, r, c, occ, g.wall)) return g;
    }
    return null;
  }
  function clearToWall(b, r, c, occ, wall) {   // chaque case de la gelée doit voir la paroi (rien d'autre devant : compte pour les L)
    const [dr, dc] = DIRS[wall];
    for (const [rr, cc] of b.cells) { let R = r + rr, Cc = c + cc; for (; ;) { R += dr; Cc += dc; if (R < 0 || R >= ROWS || Cc < 0 || Cc >= COLS) break; if (occ[R * COLS + Cc] !== -1) return false; } }
    return true;
  }
  function closure(M, pos) {
    pos = pos.slice(); const moves = []; let again = true;
    while (again) {
      again = false;
      for (let i = 0; i < M.blocks.length; i++) {
        if (!pos[i]) continue; const b = eff(M.blocks[i], pos[i]); if (iced(b, outOf(pos))) continue; const occ = occOf(M.blocks, pos, i); const R = reach(b, pos[i][0], pos[i][1], occ);
        for (const [r, c] of R.list) { const g = exitAt(b, r, c, occ, M.gates); if (g) { if (layered(b)) { moves.push({ i, path: pathTo(R.seen, r, c), peel: g.wall }); pos[i] = [r, c, 1]; } else { moves.push({ i, path: pathTo(R.seen, r, c), exit: g.wall }); pos[i] = null; } again = true; break; } }   // une couche qui part est gratuite, comme une sortie
      }
    }
    return { pos, moves };
  }
  const remaining = p => p.filter(Boolean).length, keyOf = p => p.map(x => x ? x[0] * COLS + x[1] + (x[2] ? 'p' : '') : 'x').join(',');
  // exact = true : parcours en largeur (nombre de détours minimal garanti, plus lent) ; sinon meilleur d'abord (le moins de gelées restantes)
  // maxD : profondeur (détours) au-delà de laquelle on n'explore plus (génération : on ne cherche pas plus loin que la cible)
  function solve(M, pos0, cap = GEN.nodes, exact = false, maxD = Infinity) {
    const t0 = now(); let nodes = 0;
    const start = closure(M, pos0);
    if (remaining(start.pos) === 0) return { ok: true, detours: 0, plan: start.moves, nodes: 0, ms: now() - t0 };
    const open = [{ pos: start.pos, moves: start.moves, d: 0 }]; const seen = new Set([keyOf(start.pos)]);
    while (open.length && nodes < cap) {
      let bi = 0; if (!exact) for (let k = 1; k < open.length; k++) { const a = open[k], b = open[bi]; const ra = remaining(a.pos), rb = remaining(b.pos); if (ra < rb || (ra === rb && a.d < b.d)) bi = k; }
      const cur = open.splice(bi, 1)[0]; nodes++;
      for (let i = 0; i < M.blocks.length; i++) {
        if (!cur.pos[i]) continue; const b = eff(M.blocks[i], cur.pos[i]); if (iced(b, outOf(cur.pos))) continue; const occ = occOf(M.blocks, cur.pos, i); const R = reach(b, cur.pos[i][0], cur.pos[i][1], occ);
        for (const [r, c] of R.list) {
          if (r === cur.pos[i][0] && c === cur.pos[i][1]) continue;
          const np = cur.pos.slice(); np[i] = cur.pos[i][2] ? [r, c, 1] : [r, c]; const cl = closure(M, np); const k = keyOf(cl.pos); if (seen.has(k)) continue; seen.add(k);
          const moves = cur.moves.concat([{ i, path: pathTo(R.seen, r, c) }], cl.moves);
          if (remaining(cl.pos) === 0) return { ok: true, detours: cur.d + 1, plan: moves, nodes, ms: now() - t0 };
          if (cur.d + 1 < maxD) open.push({ pos: cl.pos, moves, d: cur.d + 1 });
        }
      }
    }
    return { ok: false, detours: -1, plan: [], nodes, ms: now() - t0 };
  }

  // ------------------------------------------------------------ génération d'un niveau (à graine)
  function weighted(pool) { const keys = Object.keys(pool); let s = 0; for (const k of keys) s += pool[k]; let r = Math.random() * s; for (const k of keys) { r -= pool[k]; if (r <= 0) return k; } return keys[keys.length - 1]; }
  function pack(P) {
    const occ = emptyOcc(); const blocks = [], pos = [];
    const target = Math.round(P.fill * (ROWS * COLS - board.walls.length)); let filled = 0, tries = 0;
    const pool = Object.assign({}, SHAPE_W, P.big ? BIG : {});
    while (filled < target && tries++ < 600) {
      const name = weighted(pool); const sh = shapeOf(name);
      const r = randi(0, ROWS - sh.bh), c = randi(0, COLS - sh.bw);
      const b = { id: blocks.length, cells: sh.cells, bw: sh.bw, bh: sh.bh, name };
      if (!fitsAt(b, r, c, occ)) continue;
      for (const [rr, cc] of sh.cells) occ[(r + rr) * COLS + c + cc] = b.id;
      blocks.push(b); pos.push([r, c]); filled += sh.cells.length;
    }
    if (blocks.length < 3) return null;
    shuffle(blocks.slice()).forEach((b, i) => { b.color = i < P.colors ? i : randi(0, P.colors - 1); });   // chaque couleur au moins une fois
    const gs = []; const free = [Array.from({ length: COLS }, (_, c) => !isWall(0, c)), Array.from({ length: COLS }, (_, c) => !isWall(ROWS - 1, c)), Array.from({ length: ROWS }, (_, r) => !isWall(r, 0)), Array.from({ length: ROWS }, (_, r) => !isWall(r, COLS - 1))];   // pas de trappe devant une case murée
    const place = (color, wall, len) => {
      const n = wall < 2 ? COLS : ROWS; const starts = shuffle(Array.from({ length: n - len + 1 }, (_, i) => i));
      for (const i of starts) { let ok = true; for (let k = i; k < i + len; k++) if (!free[wall][k]) ok = false; if (!ok) continue; for (let k = i; k < i + len; k++) free[wall][k] = false; gs.push({ wall, i, len, color }); return true; }
      return false;
    };
    for (let col = 0; col < P.colors; col++) for (let k = 0; k < P.gates; k++) place(col, randi(0, 3), randi(P.gateLen[0], P.gateLen[1]));
    // garantie : chaque gelée a au moins une trappe de sa couleur où elle passe (par son petit côté)
    for (const b of blocks) {
      if (gs.some(g => g.color === b.color && fitsGate(b, g))) continue;
      const horiz = b.bw <= b.bh; const need = horiz ? b.bw : b.bh; if (need > 3) return null;
      const len = randi(need, Math.max(need, P.gateLen[1]));
      if (!shuffle(horiz ? [0, 1] : [2, 3]).some(w => place(b.color, w, len))) return null;
    }
    return { blocks, pos, gates: gs, board };
  }
  // Forme du bac tirée pour un niveau : la taille vient de la courbe (P.board), les murs d'un petit répertoire de formes (P.walls) qui laissent toujours
  // la zone libre d'un seul tenant : pilier central, deux piliers, coins coupés, goulet (taille de guêpe), barre, chicane, épaules.
  const WALL_KINDS = ['pillar', 'pillars', 'corners', 'waist', 'bar', 'steps', 'shoulders'];
  function pickBoard(P) {
    const [cols, rows] = P.board || [6, 8], walls = new Set(); if (!P.walls) return { cols, rows, walls: [] };
    const add = (r, c) => { if (r >= 0 && c >= 0 && r < rows && c < cols) walls.add(r * cols + c); };
    const mr = Math.floor(rows / 2), mc = Math.floor(cols / 2), odd = cols % 2, kind = P.walls === true ? pick(WALL_KINDS) : P.walls;
    if (kind === 'pillar') { for (const r of [mr - 1, mr]) for (const c of odd ? [mc] : [mc - 1, mc]) add(r, c); }
    else if (kind === 'pillars') { for (const r of [mr - 1, mr]) { add(r, 1); add(r, cols - 2); } }
    else if (kind === 'corners') { for (const r of [0, rows - 1]) for (const c of [0, cols - 1]) add(r, c); if (cols > 6) for (const r of [1, rows - 2]) for (const c of [0, cols - 1]) add(r, c); }
    else if (kind === 'waist') { const k = Math.floor((cols - 2) / 2); for (let c = 0; c < k; c++) { add(mr, c); add(mr, cols - 1 - c); } }
    else if (kind === 'bar') { for (let c = 2; c < cols - 2; c++) add(mr, c); }
    else if (kind === 'steps') { for (const c of [0, 1]) { add(mr - 2, c); add(mr + 1, cols - 1 - c); } }
    else if (kind === 'shoulders') { for (const r of [0, 1]) for (const c of [0, cols - 1]) add(r, c); }
    return { cols, rows, walls: [...walls].sort((a, b) => a - b) };
  }
  function generate(P) {
    setBoard(pickBoard(P));
    const t0 = now(), softOver = FEATURES.clip ? -1 : P.hard ? GEN.softOver : 0; let best = null, bestScore = 1e9, any = null, soft = null, near = null, over = null; const rej = { pack: 0, quick: 0, solve: 0, hot: 0, msSolve: 0, msSun: 0 };   // compteurs de calibrage (diff.rej)
    for (let t = 0; t < GEN.tries; t++) {
      const M = pack(P); if (!M) { rej.pack++; continue; }
      const g = closure(M, M.pos); const solved0 = remaining(g.pos) === 0;
      const hot = plan => { if (!FEATURES.sunMelt) return false; const t1 = now(); const h = sunCheck(M, plan) > SUN.safe; rej.msSun += now() - t1; if (h) rej.hot++; return h; };   // fonte au soleil : le plan du solveur, joué au rythme humain, ne doit faire fondre personne
      if (P.detours === 0) { if (solved0 && !hot(g.moves)) return { M, sol: { ok: true, detours: 0, plan: g.moves, nodes: 0 }, tries: t + 1, ms: now() - t0 }; continue; }
      if (solved0) { if (!any && !hot(g.moves)) any = { M, sol: { ok: true, detours: 0, plan: g.moves, nodes: 0 }, tries: t + 1 }; continue; }
      // filtre rapide (meilleur d'abord, surestime les détours) : plus court que la cible = trop facile, rien trouvé = trop dur ou insoluble
      const quick = solve(M, M.pos, 60, false); if (!quick.ok) { rej.quick++; continue; }
      if (quick.detours < P.detours) { rej.quick++; if (softOver >= 0 && (!near || quick.detours > near.sol.detours)) near = { M, sol: quick, tries: t + 1 }; continue; }   // plus facile que la cible : en réserve, le plus proche
      // recherche exacte (largeur) bornée à la cible : le nombre de détours annoncé est bien le minimum. On garde le premier candidat pile
      // sur la cible ; passé GEN.close candidats, on se contente d'un détour de moins.
      // Les réserves ne passent pas le contrôle de fonte : init() allonge de toute façon l'exposition du niveau d'après le plan (sunExpose), et sur un
      // grand bac ou un bac à murs les plans sont longs, tous auraient été refusés.
      // RÉSERVES (4 oct. 2026). Avant, un bac que la recherche exacte ne savait pas prouver dans son budget de nœuds était jeté et, faute de mieux, le
      // niveau retombait sur un bac à zéro détour : la moitié des niveaux après le 20, dont presque tous ceux visés à 4 détours et plus. Désormais :
      // « soft » = bac résolu par le filtre rapide, trop profond pour être prouvé, dont le plan rapide vaut la cible (jusqu'à +GEN.softOver pour un
      // niveau difficile) ; « near » = bac résolu par le filtre rapide en un peu moins de détours que la cible. Leur nombre de détours est celui du
      // plan rapide (un majorant du minimum). Ordre de préférence à la fin : prouvé à 1 près, soft, prouvé plus facile, near, zéro détour.
      const t2 = now(); const sol = solve(M, M.pos, GEN.nodes, true, P.detours); rej.msSolve += now() - t2;
      if (!sol.ok) { rej.solve++; if (softOver >= 0 && quick.detours <= P.detours + softOver) { if ((!soft || quick.detours < soft.sol.detours)) soft = { M, sol: quick, tries: t + 1 }; } else if (softOver >= 0 && (!over || quick.detours < over.sol.detours)) over = { M, sol: quick, tries: t + 1 };   // « over » : plan rapide plus long que la cible, dernier recours avant le bac trop facile
        if (soft && t + 1 >= GEN.close && bestScore > 1) break; continue; }
      if (hot(sol.plan)) continue;
      const score = P.detours - sol.detours; if (score < bestScore) { best = { M, sol, tries: t + 1 }; bestScore = score; }
      if (score === 0 || (t + 1 >= GEN.close && bestScore <= 1)) break;
    }
    if (soft && bestScore > 1) best = soft;   // un bac profond vaut mieux qu'un bac prouvé mais bien plus facile que la cible
    best = best || near || over || any;
    if (!best) { const fb = generate(Object.assign({}, P, { detours: 0, fill: P.fill - .08, gateLen: [2, 3] })); fb.rej0 = rej; return fb; }   // repli : un niveau facile plutôt que rien
    best.ms = now() - t0; best.rej = rej; return best;
  }
  // Glaçons : on gèle des gelées que le plan du solveur ne touche qu'après k sorties, pour un compte entre k / 2 et k. Le plan reste donc jouable
  // tel quel (le niveau garde sa solution et son nombre de détours), mais le joueur doit s'occuper des autres d'abord, autour d'un obstacle fixe.
  // Deux couches : au moment où le plan sort une gelée, on cherche une trappe d'une AUTRE couleur qu'elle peut atteindre et où elle passe. Si elle
  // existe, la gelée reçoit cette couleur en couche extérieure, et le plan fait le crochet : aller peler là, puis revenir sortir comme prévu (rien
  // d'autre n'a bougé entre-temps, le chemin du retour existe donc toujours). Le niveau reste faisable par construction.
  function addLayers(M, plan, n) {
    const pos = M.pos.map(p => p.slice()), cands = [];
    for (let k = 0; k < plan.length; k++) {
      const mv = plan[k], b = M.blocks[mv.i], end = mv.path[mv.path.length - 1];
      if (mv.exit !== undefined && !b.ice) {
        const p0 = pos[mv.i], occ = occOf(M.blocks, pos, mv.i), R = reach(b, p0[0], p0[1], occ), opts = [];
        for (const [r, c] of R.list) for (const g of M.gates) if (g.color !== b.color && exitAt(Object.assign({}, b, { color: g.color }), r, c, occ, [g])) opts.push({ r, c, g });
        if (opts.length) { const o = pick(opts), R2 = reach(b, o.r, o.c, occ); cands.push({ k, i: mv.i, g: o.g, exit: mv.exit, a: pathTo(R.seen, o.r, o.c), b: pathTo(R2.seen, end[0], end[1]) }); }
      }
      pos[mv.i] = mv.exit !== undefined ? null : [end[0], end[1]];
    }
    const seen = new Set(), take = shuffle(cands).filter(x => !seen.has(x.i) && seen.add(x.i)).slice(0, n).sort((x, y) => y.k - x.k);   // du dernier au premier : les rangs du plan restent justes
    for (const x of take) { const b = M.blocks[x.i]; b.inner = b.color; b.color = x.g.color; plan.splice(x.k, 1, { i: x.i, path: x.a, peel: x.g.wall }, { i: x.i, path: x.b, exit: x.exit }); }
  }
  function addIce(M, plan, n, crate = 0) {
    const first = new Map(); let out = 0;
    for (const mv of plan) { if (!first.has(mv.i)) first.set(mv.i, out); if (mv.exit !== undefined) out++; }
    const cands = shuffle([...first].filter(([, k]) => k >= 1));
    for (const [i, k] of cands.slice(0, n)) { M.blocks[i].ice = randi(Math.ceil(k / 2), Math.min(k, 9)); M.blocks[i].crate = Math.random() < crate; }
  }
  // Die and retry : un niveau donne toujours le même bac (générateur à graine), le joueur améliore son plan d'essai en essai.
  function genLevel(lv) {
    const sysRandom = Math.random; Math.random = seeded(SEED + lv * 7919 + (FEATURES.clip ? 424242 : 0));   // le mode clip a ses propres bacs
    let g; try { const P = levelParams(lv); g = generate(P); setBoard(g.M.board); if (P.layers) addLayers(g.M, g.sol.plan, P.layers); if (P.ice) addIce(g.M, g.sol.plan, P.ice, P.crate || 0); g.M.blocks.forEach(withPeel); } finally { Math.random = sysRandom; }
    return { M: g.M, detours: g.sol.detours, moves: g.sol.plan.length, nodes: g.sol.nodes, ms: Math.round(g.ms), tries: g.tries, rej0: g.rej0, sunMax: +sunCheck(g.M, g.sol.plan).toFixed(2), rej: g.rej };
  }
  // NIVEAUX PRÉCALCULÉS (30 sept. 2026) : node jeux/tools/gelees-niveaux.js écrit gelees/levels.js avec genLevel (mêmes bacs, calculés une fois
  // pour toutes au lieu de l'être sur le téléphone). Un niveau : { b: [[forme, couleur, ligne, colonne]…], g: [[paroi, début, longueur, couleur]…],
  // d: détours, m: coups, s: chaleur max }. Ignorés en mode clip et si les réglages qui changent la génération ne sont pas ceux par défaut.
  const PRE = !FEATURES.clip && FEATURES.sunMelt && global.GELEES_LEVELS || null;
  function packLevel(g) { const B = g.M.board; return { w: B && (B.cols !== 6 || B.rows !== 8 || B.walls.length) ? [B.cols, B.rows].concat(B.walls) : undefined, b: g.M.blocks.map((b, i) => [b.name, b.color, g.M.pos[i][0], g.M.pos[i][1]].concat(b.ice || layered(b) ? [b.crate ? -b.ice : b.ice || 0] : [], layered(b) ? [b.inner] : [])), g: g.M.gates.map(x => [x.wall, x.i, x.len, x.color]), d: g.detours, m: g.moves, s: g.sunMax }; }
  function unpackLevel(L) {
    const blocks = L.b.map(([name, color, , , ice, inner], i) => { const sh = shapeOf(name); return withPeel({ id: i, cells: sh.cells, bw: sh.bw, bh: sh.bh, name, color, ice: Math.abs(ice || 0), crate: ice < 0, inner: inner >= 0 ? inner : -1 }); });
    const B = L.w ? { cols: L.w[0], rows: L.w[1], walls: L.w.slice(2) } : { cols: 6, rows: 8, walls: [] }; setBoard(B);   // w : colonnes, lignes, puis les cases murées ; cinquième valeur d'une gelée : glaçon (négatif = caisse), sixième : couleur intérieure
    return { M: { board: B, blocks, pos: L.b.map(x => [x[2], x[3]]), gates: L.g.map(([wall, i, len, color]) => ({ wall, i, len, color })) }, detours: L.d, moves: L.m, sunMax: L.s, nodes: 0, ms: 0, tries: 0 };
  }
  // modèle du bac tel qu'il est (pour le bot) : gelées vivantes, à leur case
  function model() { const live = blocks.filter(b => b.state === 'idle' || b.state === 'drag'); return { blocks: live.map((b, i) => withPeel({ id: i, cells: b.cells, bw: b.bw, bh: b.bh, color: b.color, ice: b.ice, inner: b.inner })), pos: live.map(b => [b.r, b.c]), gates, live }; }

  // ------------------------------------------------------------ soleil (FEATURES.sunMelt)
  // Le soleil tape par le haut du bac : dans chaque colonne, la première gelée rencontrée prend la lumière, celles d'en dessous sont à l'ombre.
  // Une gelée chauffe au prorata de ses colonnes au soleil (SUN.expose s en plein soleil pour fondre) et refroidit à l'ombre (SUN.cool s).
  function topOf(occ) { const top = new Array(COLS).fill(-1), depth = new Array(COLS).fill(ROWS); for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) { const o = occ[r * COLS + c]; if (o !== -1) { top[c] = o; depth[c] = r; break; } } return { top, depth }; }
  function exposure() {   // met à jour b.sun (part des colonnes de chaque gelée en plein soleil) et sunDepth (pour le dessin) ; la gelée tenue compte à sa case arrondie
    const occ = liveOcc(null);
    if (drag) { const b = drag.b, r = Math.round(b.y), c = Math.round(b.x); for (const [rr, cc] of b.cells) { const R = r + rr, Cc = c + cc; if (R >= 0 && R < ROWS && Cc >= 0 && Cc < COLS) occ[R * COLS + Cc] = b.id; } }
    const { top, depth } = topOf(occ); sunDepth = depth;
    for (const b of blocks) {
      if (b.state !== 'idle' && b.state !== 'drag') { b.sun = 0; continue; }
      const c0 = b.state === 'drag' ? Math.round(b.x) : b.c; let n = 0;
      for (let k = 0; k < b.bw; k++) if (c0 + k >= 0 && c0 + k < COLS && top[c0 + k] === b.id) n++;
      b.sun = b.ice > 0 ? 0 : n / b.bw;
    }
  }
  const hottest = () => blocks.reduce((m, b) => b.state === 'idle' || b.state === 'drag' ? Math.max(m, b.heat) : m, 0);
  // Rejoue le plan du solveur au rythme humain (estimate + réflexion) en suivant la chaleur de chaque gelée ; renvoie la chaleur max atteinte (1 = fondue).
  // Sert à la génération : un niveau dont le plan ferait fondre une gelée est rejeté (SUN.safe), la difficulté annoncée reste donc tenable au soleil.
  // Les sorties d'une même fermeture sont rejouées « la plus chaude d'abord » (une sortie ne gêne jamais les autres), comme le font les bots.
  function exitNow(M, pos, i) { const b = eff(M.blocks[i], pos[i]); if (iced(b, outOf(pos))) return null; const occ = occOf(M.blocks, pos, i); const R = reach(b, pos[i][0], pos[i][1], occ); for (const [r, c] of R.list) { const g = exitAt(b, r, c, occ, M.gates); if (g) return { i, path: pathTo(R.seen, r, c), exit: g.wall }; } return null; }
  function sunCheck(M, plan) {
    if (!FEATURES.sunMelt) return 0;
    const pos = M.pos.slice(), heat = new Array(M.blocks.length).fill(0); let max = 0;
    const step = mv => {
      const dt = estimate(mv, HUMAN.seg) + .25; const { top } = topOf(occOf(M.blocks, pos, -1));
      const out = outOf(pos); M.blocks.forEach((b, i) => { if (!pos[i] || iced(b, out)) return; let n = 0; for (let k = 0; k < b.bw; k++) if (top[pos[i][1] + k] === i) n++; const s = n / b.bw; heat[i] = clamp(heat[i] + (s > 0 ? s * dt / SUN.expose : -dt / SUN.cool), 0, 1); max = Math.max(max, heat[i]); });
    };
    for (let k = 0; k < plan.length;) {
      if (plan[k].exit === undefined) { step(plan[k]); const e = plan[k].path[plan[k].path.length - 1], was = pos[plan[k].i]; pos[plan[k].i] = plan[k].peel !== undefined || (was && was[2]) ? [e[0], e[1], 1] : [e[0], e[1]]; k++; continue; }
      let end = k; while (end < plan.length && plan[end].exit !== undefined) end++;
      const pending = plan.slice(k, end).map(m => m.i);
      while (pending.length) {
        pending.sort((a, b) => heat[b] - heat[a]); let mv = null, at = -1;
        for (let j = 0; j < pending.length && !mv; j++) { mv = exitNow(M, pos, pending[j]); at = j; }
        if (!mv) break;   // ne devrait pas arriver (la fermeture garantit la sortie) : on abandonne la rafale sans compter de temps
        step(mv); pos[mv.i] = null; pending.splice(at, 1);
      }
      for (const i of pending) pos[i] = null;
      k = end;
    }
    return max;
  }

  // ------------------------------------------------------------ bruitages (synthétisés) et musique
  const fx = {
    grab() { C.noise({ dur: .08, vol: .1, f: 1800, f1: 700, q: 1.5 }); C.tone({ type: 'sine', f0: 520, f1: 380, dur: .09, vol: .12 }); },
    drop() { C.tone({ type: 'sine', f0: 420, f1: 180, dur: .12, vol: .18 }); },
    bump() { C.tone({ type: 'sine', f0: 300, f1: 140, dur: .13, vol: .22 }); C.noise({ dur: .05, vol: .06, f: 900, q: 2 }); },
    exit(n) { const p = Math.pow(2, Math.min(n, 8) / 12); if (FEATURES.plate) C.tone({ type: 'sine', f0: 190, f1: 60, dur: .14, vol: .28 }); C.noise({ dur: .22, vol: .18, f: 500, f1: 2600, q: 1.2 }); C.tone({ type: 'sine', f0: 380 * p, f1: 1200 * p, dur: .16, vol: .3, delay: .1 }); C.tone({ type: 'triangle', f0: 1400 * p, dur: .18, vol: .08, delay: .14 }); },
    melt() { C.noise({ dur: 1.1, vol: .16, f: 2400, f1: 400, q: .7 }); C.tone({ type: 'sawtooth', f0: 220, f1: 70, dur: .9, vol: .12, delay: .2 }); C.tone({ type: 'square', f0: 165, f1: 55, dur: .9, vol: .05, delay: .2 }); },
    tick() { C.tone({ type: 'square', f0: 1800, dur: .03, vol: .05 }); },
    ice() { [1320, 1760, 2210].forEach((f, i) => C.tone({ type: 'sine', f0: f, dur: .35, vol: .12, delay: i * .07 })); C.noise({ dur: .3, vol: .08, f: 5000, q: 2 }); },
    tap() { sfx.click(); },
    wood() { C.noise({ dur: .2, vol: .2, f: 700, f1: 250, q: 1 }); C.tone({ type: 'triangle', f0: 220, f1: 110, dur: .18, vol: .22 }); },   // la caisse s'ouvre
    peel() { C.noise({ dur: .16, vol: .16, f: 900, f1: 3200, q: 1.4 }); C.tone({ type: 'sine', f0: 520, f1: 980, dur: .14, vol: .22, delay: .04 }); },   // une couche qui part
    tink() { C.tone({ type: 'sine', f0: 2400, f1: 1900, dur: .08, vol: .12 }); C.tone({ type: 'triangle', f0: 3300, dur: .05, vol: .06, delay: .03 }); },   // doigt sur un glaçon
    crack() { C.noise({ dur: .18, vol: .16, f: 4200, f1: 1200, q: 1.2 }); [1568, 2093, 2637].forEach((f, i) => C.tone({ type: 'sine', f0: f, dur: .22, vol: .1, delay: .04 + i * .05 })); },   // le glaçon se brise
    heart() { C.tone({ type: 'sine', f0: 70, f1: 40, dur: .16, vol: .4 }); C.tone({ type: 'sine', f0: 60, f1: 35, dur: .2, vol: .3, delay: .18 }); },
    land(p = 1) { C.tone({ type: 'sine', f0: 380 * p, f1: 150 * p, dur: .13, vol: .2 }); C.noise({ dur: .05, vol: .05, f: 1500, q: 1.5 }); },
    tic(hi) { C.tone({ type: 'square', f0: hi ? 2200 : 1700, dur: .025, vol: .05 }); C.noise({ dur: .02, vol: .03, f: 5000, q: 2 }); },
    drip() { C.tone({ type: 'sine', f0: 1800, f1: 900, dur: .08, vol: .07 }); C.tone({ type: 'sine', f0: 900, f1: 1300, dur: .06, vol: .05, delay: .08 }); },
    meltLong() { C.noise({ dur: 2.2, vol: .18, f: 3200, f1: 250, q: .6 }); for (let i = 0; i < 5; i++) C.tone({ type: 'sawtooth', f0: 330 - i * 40, f1: 300 - i * 40 - 60, dur: .55, vol: .07, delay: .3 + i * .42 }); C.tone({ type: 'square', f0: 110, f1: 45, dur: 2, vol: .04, delay: .3 }); },   // sifflement, trombone triste ralenti
    splash() { C.noise({ dur: .3, vol: .2, f: 900, f1: 300, q: .8 }); C.tone({ type: 'sine', f0: 220, f1: 80, dur: .25, vol: .25 }); C.tone({ type: 'sine', f0: 600, f1: 250, dur: .12, vol: .1, delay: .05 }); },
    fanfare(st) { const notes = st >= 3 ? [0, 4, 7, 12, 16, 19] : st === 2 ? [0, 4, 7, 12] : [0, 7]; notes.forEach((n, i) => C.tone({ type: 'triangle', f0: 523 * Math.pow(2, n / 12), dur: st >= 3 ? .6 : .45, vol: .2, delay: i * (st >= 3 ? .08 : .12) })); if (st >= 3) for (let i = 0; i < 6; i++) C.tone({ type: 'sine', f0: 2093 * Math.pow(2, (i % 3) * 4 / 12), dur: .18, vol: .06, delay: .5 + i * .07 }); },
    fall() { C.tone({ type: 'sine', f0: 440, f1: 110, dur: 1.6, vol: .16 }); C.tone({ type: 'sine', f0: 660, f1: 165, dur: 1.6, vol: .06 }); },   // note tenue qui descend (fonte)
    finale() { C.noise({ dur: .5, vol: .2, f: 300, f1: 4000 }); [0, 4, 7, 12].forEach((n, i) => C.tone({ type: 'triangle', f0: 660 * Math.pow(2, n / 12), dur: .4, vol: .18, delay: .1 + i * .06 })); },
  };
  // SONS ET MUSIQUES ENREGISTRÉS (oct. 2026, audio/manifest.js → window.GAME_AUDIO) : chaque bruitage de fx qui a un fichier du même nom est remplacé
  // par ce fichier (sinon il reste synthétisé) ; chaque zone qui a un morceau le joue en boucle à la place de la musique générée.
  const AUDIO = !FEATURES.clip && global.GAME_AUDIO || null;
  if (AUDIO && AUDIO.sfx) {
    C.loadSamples(AUDIO.base || 'audio/', AUDIO.sfx);
    for (const k of Object.keys(fx)) { const syn = fx[k]; fx[k] = (...a) => C.playSample(k, k === 'exit' ? { rate: Math.pow(2, (Math.min(a[0] || 1, 8) - 1) / 12) } : k === 'land' ? { rate: a[0] || 1 } : {}) || syn(...a); }   // la sortie monte d'un demi-ton à chaque sortie enchaînée
  }
  let trackName = null, trackSrc = null, trackWait = 0; const trackFail = {}, TRACK_TRIES = 3;   // un morceau qui échoue est retenté (TRACK_TRIES fois, à 3 s d'écart) avant de laisser la place à la musique générée
  function fileMusic() {   // true si la zone a son morceau (la musique générée se tait) ; un seul morceau en mémoire à la fois
    const list = AUDIO && AUDIO.music, name = list && list[CHAPTERS.indexOf(theme()) % list.length];   // même zone que le décor (donc ?zone= compris)
    if (!name || trackFail[name] >= TRACK_TRIES || typeof fetch === 'undefined') return false;   // pas de morceau, ou morceau illisible : musique générée
    if (trackName !== name && !(trackFail[name] && Date.now() < trackWait)) {
      trackName = name; if (trackSrc) { try { trackSrc.stop(); } catch (_) { } trackSrc = null; }
      C.fetchBytes((AUDIO.base || 'audio/') + name).then(a => new Promise((ok, ko) => A.decodeAudioData(a, ok, ko))).then(b => {
        if (trackName !== name) return; const g = A.createGain(); g.gain.value = AUDIO.musicVol === undefined ? .6 : AUDIO.musicVol;
        trackSrc = A.createBufferSource(); trackSrc.buffer = b; trackSrc.loop = true; trackSrc.connect(g); g.connect(musicGain); trackSrc.start();
        if (C.DEV && !URLP.nolabel) C.floatText(W / 2, 300, '♪ ' + name.replace(/^zone\d+-|\.mp3$/g, '').replace(/-/g, ' '), { size: 44, color: '#fff', dur: 2.5, vy: -20 });   // en développement : le morceau qui démarre s'affiche (pour vérifier le changement de zone)
      }).catch(() => { trackFail[name] = (trackFail[name] || 0) + 1; trackWait = Date.now() + 3000; if (trackName === name) trackName = null; if (C.DEV) C.floatText(W / 2, 300, '♪ échec : ' + name, { size: 40, color: '#ffb4b4', dur: 4, vy: -20 }); });
    }
    return true;
  }
  let A = null, musicGain = null, musicOn = true, nextBar = 0, barIdx = 0;
  const BPM = [104, 148];   // tempo tranquille → pressé quand la chaleur monte
  const CHORDS = [[0, 4, 7], [5, 9, 12], [7, 11, 14], [5, 9, 12]];   // do, fa, sol, fa (demi-tons au-dessus de do)
  const MELODY = [[12, null, 16, 19, null, 16, 12, null], [17, null, 16, 12, null, null, 9, null], [14, null, 16, 19, 23, null, 19, null], [16, null, 12, null, 9, null, 7, null],
  [12, 16, 19, null, 24, null, 19, 16], [17, null, 21, 17, null, 16, 12, null], [19, null, 23, 19, 14, null, 11, null], [12, null, null, null, null, null, null, null]];
  const PROGS = [CHORDS, [[0, 4, 7], [9, 12, 16], [5, 9, 12], [7, 11, 14]], [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]]];   // do fa sol fa ; do la- fa sol ; do sol la- fa
  const midi = m => 440 * Math.pow(2, (m + theme().music.shift - 69) / 12);   // chaque zone joue dans sa tonalité
  let cicadas = null;
  function ensureMusic() {
    const au = C.audio(); if (!au.ctx || A) return; A = au.ctx; musicGain = A.createGain(); musicGain.gain.value = musicOn ? .7 : 0; musicGain.connect(au.master); nextBar = A.currentTime + .05; barIdx = 0;
    // cigales (FEATURES.ambience) : souffle filtré haut, haché à 28 Hz, dont le volume suit la chaleur
    const buf = A.createBuffer(1, A.sampleRate * 2, A.sampleRate); const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = A.createBufferSource(); s.buffer = buf; s.loop = true; const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 5200; f.Q.value = 4;
    const chop = A.createGain(); chop.gain.value = .5; const lfo = A.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 28; const lg = A.createGain(); lg.gain.value = .5; lfo.connect(lg); lg.connect(chop.gain);
    const g = A.createGain(); g.gain.value = 0; s.connect(f); f.connect(chop); chop.connect(g); g.connect(au.master); s.start(); lfo.start(); cicadas = { g };
  }
  // voix des gelées (FEATURES.voices) : dent de scie vibrée dans un filtre de formant ; une seule voix à la fois, jamais deux fois la même de suite
  function voice(kind, vol = .1) {
    if (!FEATURES.voices || !A || voiceCd > 0) return; const rep = VOICES[kind]; let i = randi(0, rep.length - 1); if (rep.length > 1 && i === lastVoice[kind]) i = (i + 1) % rep.length; lastVoice[kind] = i;
    const M = C.audio().master; let end = 0;
    for (const [f0, f1, dur, delay] of rep[i]) {
      const t = A.currentTime + delay; end = Math.max(end, delay + dur);
      const o = A.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const v = A.createOscillator(); v.frequency.value = 7; const vg = A.createGain(); vg.gain.value = f0 * .03; v.connect(vg); vg.connect(o.frequency);
      const f = A.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 1.1;
      const g = A.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .03); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(f); f.connect(g); g.connect(M); o.start(t); o.stop(t + dur + .05); v.start(t); v.stop(t + dur + .05);
    }
    voiceCd = end + .25;
  }
  function chordSwell() {   // accord de résolution (finale) : trois voix qui gonflent puis s'éteignent
    if (!A) return; const M = C.audio().master; [523, 659, 784, 1047].forEach((f, i) => { const t = A.currentTime + .05; const o = A.createOscillator(); o.type = 'triangle'; o.frequency.value = f; const g = A.createGain(); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(i === 3 ? .08 : .14, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + 1.8); o.connect(g); g.connect(M); o.start(t); o.stop(t + 1.9); });
  }
  function pluck(f, t, dur, vol, type = 'triangle', harm = 0) {
    const o = A.createOscillator(), g = A.createGain(); o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + dur + .05);
    if (harm) { const o2 = A.createOscillator(), g2 = A.createGain(); o2.type = 'sine'; o2.frequency.value = f * 4; g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(vol * harm, t + .005); g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * .4); o2.connect(g2); g2.connect(musicGain); o2.start(t); o2.stop(t + dur); }
  }
  let drumBuf = null;
  function hit(t, kind) {   // percussions : grosse caisse (sinus qui plonge) et charleston (souffle court)
    if (kind === 'kick') { const o = A.createOscillator(), g = A.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(45, t + .12); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .005); g.gain.exponentialRampToValueAtTime(.0001, t + .16); o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + .2); return; }
    if (!drumBuf) { drumBuf = A.createBuffer(1, A.sampleRate / 4, A.sampleRate); const d = drumBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = A.createBufferSource(); s.buffer = drumBuf; const f = A.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000; const g = A.createGain();
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.06, t + .003); g.gain.exponentialRampToValueAtTime(.0001, t + .05); s.connect(f); f.connect(g); g.connect(musicGain); s.start(t); s.stop(t + .08);
  }
  // Couches (FEATURES.musicLayers) : ukulélé seul au départ, marimba au tiers, basse et percussions au dernier tiers ; sans l'option, tout joue dès le début.
  function scheduleBar(t, beat) {
    const MU = theme().music, ch = PROGS[MU.prog][barIdx % 4], h = heat(), L = FEATURES.musicLayers;
    if (!L || h > .66) { pluck(midi(48 + ch[0]), t, beat * 1.6, .16, 'triangle'); pluck(midi(48 + ch[0] + (barIdx % 2 ? 7 : 0)), t + beat * 2, beat * 1.6, .13, 'triangle'); }   // basse
    if (L && h > .66) for (let k = 0; k < 8; k++) { hit(t + k * beat / 2, 'hat'); if (k % 4 === 0) hit(t + k * beat / 2, 'kick'); }   // percussions
    for (let k = 0; k < 4; k++) ch.forEach((n, j) => pluck(midi(60 + n), t + k * beat + j * .018 + (k % 2 ? beat * .5 : 0), beat * .55, .045, 'triangle'));   // grattage de ukulélé
    const mel = MU.rev ? MELODY[barIdx % MELODY.length].slice().reverse() : MELODY[barIdx % MELODY.length];
    if (!L || h > .33) mel.forEach((n, j) => { if (n !== null) pluck(midi(72 + n), t + j * beat / 2, beat * .8, .11, 'sine', .35); });   // marimba
    if (h > .75 && barIdx % 2 === 0) for (let k = 0; k < 8; k++) pluck(midi(84 + ch[0]), t + k * beat / 2, beat * .2, .04, 'square');   // pression : notes répétées
  }
  function musicRestore() { silenced = false; if (A && musicGain) { musicGain.gain.cancelScheduledValues(A.currentTime); musicGain.gain.value = musicOn ? .7 : 0; nextBar = Math.max(nextBar, A.currentTime + .05); } }   // valeur posée directement : plus sûr qu'une rampe programmée pendant que le son est suspendu (menu)
  function updateMusic() {
    ensureMusic();
    if (A && cicadas) cicadas.g.gain.setTargetAtTime(FEATURES.ambience && state === 'play' && started ? .11 * Math.pow(heat(), 1.5) : 0, A.currentTime, .15);   // cigales qui montent avec la chaleur
    if (!A || !musicOn || state !== 'play') return;
    // silence brutal à SILENCE s de la fin : il ne reste que le battement de cœur (rétabli par musicRestore() au niveau suivant ou au secours)
    if (FEATURES.musicLayers && started && timeLeft < SILENCE && !silenced) { silenced = true; musicGain.gain.cancelScheduledValues(A.currentTime); musicGain.gain.setTargetAtTime(0, A.currentTime, .03); }
    if (silenced) return;
    if (fileMusic()) { nextBar = A.currentTime + .05; return; }
    if (A.currentTime > nextBar - .25) { const bpm = theme().music.bpm, beat = 60 / lerp(bpm[0], bpm[1], heat()); scheduleBar(nextBar, beat); nextBar += beat * 4; barIdx++; }
  }
  function toggleMusic() { musicOn = !musicOn; if (musicGain) musicGain.gain.value = musicOn ? .7 : 0; C.floatText(W / 2, 250, musicOn ? 'MUSIQUE' : 'MUSIQUE COUPÉE', { color: '#fff', size: 52, dur: 1 }); }
  const heat = () => 1 - timeLeft / timeTotal;

  // ------------------------------------------------------------ entrées
  const px = b => BOX.x + b.x * S, py = b => BOX.y + b.y * S;
  function blockAt(x, y) {
    const c = Math.floor((x - BOX.x) / S), r = Math.floor((y - BOX.y) / S); if (r < 0 || c < 0 || r >= ROWS || c >= COLS) return null;
    for (const b of blocks) if (b.state === 'idle') for (const [rr, cc] of b.cells) if (b.r + rr === r && b.c + cc === c) return b;
    return null;
  }
  const inBtn = (x, y, B) => Math.abs(x - B.x) < B.w / 2 && Math.abs(y - B.y) < B.h / 2;
  function pointerDown(x, y) {
    if (state === 'over') {
      if (inBtn(x, y, RETRY_BTN)) { fx.tap(); C.restart(); }
      else if (OFFER_RESCUE && !rescued && inBtn(x, y, RESCUE_BTN)) { if (global.Shell) Shell.requestRescue({ onAccept: rescue }); else rescue(); }   // coquille : 60 pièces ou une pub
      return;
    }
    if (state !== 'play') return;
    x = toBX(x); y = toBY(y);   // du doigt (écran) aux coordonnées du bac
    const b = blockAt(x, y);
    if (aim) { if (b) useAim(b); else setAim(null); return; }   // une aide attend sa cible : la gelée touchée, ou on annule en touchant à côté
    if (!b) return;
    if (b.ice > 0) { b.wob = .08; b.wobT = 0; b.iceT = .35; fx.tink(); C.haptic('light'); return; }   // prise dans la glace : le compte clignote
    drag = { b, ox: x - px(b), oy: y - py(b), tx: b.x, ty: b.y }; b.state = 'drag'; C.killTweens(b);
    C.tween(b, { lift: 1.06 }, .12, { ease: ease.outBack }); fx.grab(); b.mood = 1;
    if (!started) { started = true; }
    for (const g of gates) if (g.color === b.color) g.glow = 1;
  }
  function pointerMove(x, y) { if (!drag) return; drag.tx = (toBX(x) - drag.ox - BOX.x) / S; drag.ty = (toBY(y) - drag.oy - BOX.y) / S; }
  function pointerUp() {
    if (!drag) return; const b = drag.b; drag = null; if (b.state !== 'drag') return;
    b.state = 'idle'; snap(b); b.wob = FEATURES.physics ? .22 : .14; b.wobT = 0; fx.drop(); b.mood = 0; ripple(b, .07, 2);   // compression puis rebond, les voisines tremblent
    C.tween(b, { lift: 1 }, .18, { ease: ease.outBack });
  }
  function snap(b) {
    const occ = liveOcc(b); let best = null, bd = 1e9;
    for (const r of [Math.floor(b.y), Math.ceil(b.y)]) for (const c of [Math.floor(b.x), Math.ceil(b.x)]) { if (!fitsAt(b, r, c, occ)) continue; const d = Math.hypot(r - b.y, c - b.x); if (d < bd) { bd = d; best = [r, c]; } }
    if (!best) best = [Math.round(b.y), Math.round(b.x)];
    b.r = best[0]; b.c = best[1]; C.tween(b, { x: b.c, y: b.r }, .08);
  }
  function liveOcc(skip) { const occ = emptyOcc(); for (const b of blocks) { if (b === skip || b.state !== 'idle') continue; for (const [rr, cc] of b.cells) occ[(b.r + rr) * COLS + b.c + cc] = b.id; } return occ; }
  function freeAt(b, x, y, occ) {
    const E = 1e-4;
    for (const [rr, cc] of b.cells) {
      const x0 = x + cc, y0 = y + rr; if (x0 < -E || y0 < -E || x0 + 1 > COLS + E || y0 + 1 > ROWS + E) return false;
      const c0 = Math.floor(x0 + E), c1 = Math.ceil(x0 + 1 - E) - 1, r0 = Math.floor(y0 + E), r1 = Math.ceil(y0 + 1 - E) - 1;
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (occ[r * COLS + c] !== -1) return false;
    }
    return true;
  }
  function moveDragged(dt) {
    const b = drag.b; const occ = liveOcc(b); const maxStep = MOVE.speed * dt;
    const tx = drag.tx, ty = drag.ty; const dx = clamp(tx - b.x, -maxStep, maxStep), dy = clamp(ty - b.y, -maxStep, maxStep);
    const along = (x, y, ax, d) => {   // avance pas à pas sur un axe, bute sur la première gêne, se cale exactement sur les parois
      const n = Math.ceil(Math.abs(d) / MOVE.step), sg = Math.sign(d); let cx = x, cy = y;
      for (let k = 0; k < n; k++) {
        const st = Math.min(MOVE.step, Math.abs(d) - k * MOVE.step) * sg;
        let nx = ax === 'x' ? cx + st : cx, ny = ax === 'y' ? cy + st : cy; nx = clamp(nx, 0, COLS - b.bw); ny = clamp(ny, 0, ROWS - b.bh);
        if (!freeAt(b, nx, ny, occ)) break; cx = nx; cy = ny;
      }
      if (Math.abs(cx - Math.round(cx)) < 1e-3) cx = Math.round(cx); if (Math.abs(cy - Math.round(cy)) < 1e-3) cy = Math.round(cy);
      return [cx, cy];
    };
    let [x1, y1] = along(b.x, b.y, 'x', dx); [x1, y1] = along(x1, y1, 'y', dy);
    let [x2, y2] = along(b.x, b.y, 'y', dy); [x2, y2] = along(x2, y2, 'x', dx);
    const [nx, ny] = Math.hypot(tx - x1, ty - y1) <= Math.hypot(tx - x2, ty - y2) ? [x1, y1] : [x2, y2];
    b.vx = (nx - b.x) / dt; b.vy = (ny - b.y) / dt; b.x = nx; b.y = ny;
    const wx = clamp(tx - b.x, -1, 1), wy = clamp(ty - b.y, -1, 1);
    if (Math.hypot(wx, wy) > .35 && Math.hypot(b.vx, b.vy) < .5) bump(b, wx, wy, occ);
    const g = gateFor(b, occ); if (g) (layered(b) ? startPeel : startExit)(b, g);
  }
  function bump(b, wx, wy, occ) {
    b.bumpT -= 0; if (b.bumpT > 0) return; b.bumpT = .35; fx.bump(); voice('groan', .07); b.wob = Math.max(b.wob, .1); b.wobT = 0; C.shake(3, .08);
    // la gelée d'en face tremble aussi
    const ax = Math.abs(wx) > Math.abs(wy) ? 'x' : 'y'; const d = ax === 'x' ? Math.sign(wx) : Math.sign(wy);
    if (FEATURES.bigGates) {   // elle bute contre une trappe de sa couleur trop étroite : on le dit, sinon le joueur ne comprend pas pourquoi elle ne sort pas
      const wall = ax === 'x' ? (d > 0 ? 3 : 2) : (d > 0 ? 1 : 0); const r = Math.round(b.y), c = Math.round(b.x);
      const atWall = wall === 0 ? r === 0 : wall === 1 ? r + b.bh === ROWS : wall === 2 ? c === 0 : c + b.bw === COLS;
      const lo = wall < 2 ? c : r, hi = wall < 2 ? c + b.bw : r + b.bh;
      if (atWall && gates.some(g => g.wall === wall && g.color === b.color && !fitsGate(b, g) && g.i < hi && g.i + g.len > lo)) {
        C.floatText(toSX(BOX.x + (b.x + b.bw / 2) * S), toSY(BOX.y + (b.y + b.bh / 2) * S) - 70, tr('TROP LARGE !'), { size: 60, color: '#fff', stroke: '#E5303C', strokeW: 10, dur: .9, vy: -50 });
        if (kid.mood === 0 || kid.mood === 2 || kid.mood === 7) kidReact(5, .8);   // le personnage grimace (sans couper une joie en cours)
      }
    }
    for (const [rr, cc] of b.cells) { const r = Math.round(b.y) + rr + (ax === 'y' ? d : 0), c = Math.round(b.x) + cc + (ax === 'x' ? d : 0); if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue; const o = occ[r * COLS + c]; if (o >= 0) { const ob = blocks[o]; ob.wob = Math.max(ob.wob, .08); ob.wobT = 0; ob.mood = -1; C.after(.6, () => { if (ob.mood === -1) ob.mood = 0; }); ripple(ob, .05, 2); } }
  }
  function ripple(b, amp, depth) {   // physique (FEATURES.physics) : la secousse se propage aux gelées voisines, avec un petit retard et en s'atténuant
    if (!FEATURES.physics || depth <= 0 || amp < .015 || b.state !== 'idle') return;
    const occ = liveOcc(null); const seen = new Set([b.id]);
    for (const [rr, cc] of b.cells) for (const [dr, dc] of DIRS) {
      const r = b.r + rr + dr, c = b.c + cc + dc; if (r < 0 || c < 0 || r >= ROWS || c >= COLS) continue;
      const o = occ[r * COLS + c]; if (o < 0 || seen.has(o)) continue; seen.add(o); const ob = blocks[o];
      C.after(.07, () => { if (ob.state === 'idle') { ob.wob = Math.max(ob.wob, amp); ob.wobT = 0; ripple(ob, amp * .55, depth - 1); } });
    }
  }
  function gateFor(b, occ) {
    const F = MOVE.flush, Al = MOVE.align;
    for (const g of gates) {
      if (g.color !== b.color) continue;
      if (g.wall < 2) { if (b.x < g.i - Al || b.x + b.bw > g.i + g.len + Al) continue; if (g.wall === 0 ? b.y > F : b.y + b.bh < ROWS - F) continue; }
      else { if (b.y < g.i - Al || b.y + b.bh > g.i + g.len + Al) continue; if (g.wall === 2 ? b.x > F : b.x + b.bw < COLS - F) continue; }
      const r = Math.round(b.y), c = Math.round(b.x);
      if (!fitsAt(b, r, c, occ) || !clearToWall(b, r, c, occ, g.wall)) continue;
      return g;
    }
    return null;
  }
  function startExit(b, g) {
    if (drag && drag.b === b) drag = null;
    if (global.Shell && !bot.active) Shell.hintDone('gelees.exit');
    b.state = 'exit'; C.killTweens(b);
    if (g.wall < 2) { b.x = clamp(Math.round(b.x), g.i, g.i + g.len - b.bw); b.y = g.wall === 0 ? 0 : ROWS - b.bh; } else { b.y = clamp(Math.round(b.y), g.i, g.i + g.len - b.bh); b.x = g.wall === 2 ? 0 : COLS - b.bw; }
    const [dr, dc] = DIRS[g.wall]; const far = (g.wall < 2 ? b.bh : b.bw) + 1.2;
    const to = { x: b.x + dc * far, y: b.y + dr * far };
    const P = FEATURES.plate;   // sortie spectaculaire : étirement plus fort, filet de gelée (exitT), gouttes, puis vol vers l'assiette
    const squash = g.wall < 2 ? { sx: P ? .62 : .78, sy: P ? 1.55 : 1.3 } : { sx: P ? 1.55 : 1.3, sy: P ? .62 : .78 };
    // caméra vivante : recul à chaque sortie ; sur la dernière gelée, ralenti (tweens allongés, logique du jeu au ralenti) et zoom sur la trappe
    const lastOne = blocks.every(x => x === b || x.state === 'gone'), slow = FEATURES.slowmo && lastOne ? 1 / CAMERA.slow : 1;
    if (FEATURES.slowmo && lastOne) slowmo = CAMERA.slowDur;
    if (FEATURES.camera) { camKick = CAMERA.kick; if (lastOne && !(FEATURES.finale && timeLeft < FINALE.under)) { camLock = 1.4; C.killTweens(cam); C.tween(cam, { z: CAMERA.lastZoom }, .3, { ease: ease.outQuad }); C.tween(cam, { z: 1 }, .4, { delay: .9, ease: ease.inOutQuad }); } }
    C.tween(b, squash, .12 * slow, { ease: ease.outQuad });
    b.exitT = 0; b.gate = g; C.tween(b, { exitT: 1 }, .4 * slow, { ease: ease.linear });
    C.tween(b, to, .34 * slow, { ease: ease.inQuad, delay: .06 * slow, onDone() { b.state = 'gone'; b.alpha = 0; if (P) addToPlate(b); if (blocks.every(x => x.state === 'gone')) win(); } });
    if (!P) C.tween(b, { alpha: 0 }, .12, { delay: .3 });
    g.flash = 1; g.glow = 0;
    streak = streakT > 0 ? streak + 1 : 1; streakT = 1.6; fx.exit(streak);
    const cx = toSX(BOX.x + (b.x + b.bw / 2) * S), cy = toSY(BOX.y + (b.y + b.bh / 2) * S);   // à l'écran (particules et textes ne suivent pas l'échelle du bac)
    const gx = g.wall < 2 ? cx : toSX(g.wall === 2 ? BOX.x - WALL / 2 : BOX.x + COLS * S + WALL / 2), gy = g.wall >= 2 ? cy : toSY(g.wall === 0 ? BOX.y - WALL / 2 : BOX.y + ROWS * S + WALL / 2);
    C.burst(gx, gy, { color: PALETTE[b.color], count: P ? 30 : 16, speed: P ? 750 : 500, size: P ? 11 : 14, life: P ? .8 : .6, gravity: P ? 1500 : 900, angle: Math.atan2(dr, dc), spread: P ? 2.2 : 1.6, drag: P ? 1 : 2 });
    if (P) C.burst(gx, gy, { color: shade(PALETTE[b.color], .45), count: 10, speed: 400, size: 7, life: .5, gravity: 1200, angle: Math.atan2(dr, dc), spread: 2.6 });
    voice('joy', .09);
    if (!bot.active) C.haptic('light');
    for (const o of blocks) if (o.ice > 0) { o.ice--; o.iceT = .35; if (o.ice === 0) thaw(o); }
    // le personnage : soulagé si la gelée allait fondre (ou si le chrono s'achevait), épaté par une série, sinon il saute de joie
    if ((FEATURES.sunMelt && b.heat >= SUN.panic) || timeLeft < 6) kidReact(3, 1.5, 10); else if (streak >= 3) kidReact(4, 1.1, 28); else kidReact(1, .9, 28);
    if (FEATURES.streakFx && streak >= 3) {   // série : éclair coloré autour du bac, confettis en gelée, « ×N » qui grossit
      boltT = .4; boltCol = PALETTE[b.color]; C.flash(rgba(PALETTE[b.color], 1), .18);
      C.burst(W / 2, MIDY, { colors: PALETTE, count: 26 + streak * 6, speed: 1100, size: 20, life: 1.4, gravity: 1000, spread: Math.PI * 1.2, shape: 'rect', drag: 1.5 });
      C.floatText(gx, gy + (g.wall === 0 ? 90 : g.wall === 1 ? -90 : -80), '×' + streak, { size: Math.min(150, 70 + 16 * (streak - 2)), color: '#FFC533', stroke: '#c2410c', dur: 1 });
    } else if (streak >= 2) C.floatText(gx, gy + (g.wall === 0 ? 70 : g.wall === 1 ? -70 : -60), '×' + streak, { size: 70, color: '#fff', dur: .8 });
    b.mood = 2;
    if (FEATURES.finale && timeLeft < FINALE.under && blocks.every(x => x === b || x.state === 'gone')) finale(gx, gy);
  }
  function startPeel(b, g) {   // deux couches, devant une trappe de la couleur extérieure : la couche file par la trappe, la gelée reste là dans sa couleur intérieure
    if (drag && drag.b === b) drag = null; C.killTweens(b); b.state = 'idle';
    if (g.wall < 2) { b.x = clamp(Math.round(b.x), g.i, g.i + g.len - b.bw); b.y = g.wall === 0 ? 0 : ROWS - b.bh; } else { b.y = clamp(Math.round(b.y), g.i, g.i + g.len - b.bh); b.x = g.wall === 2 ? 0 : COLS - b.bw; }
    b.r = b.y; b.c = b.x; b.lift = 1; b.sx = b.sy = 1; b.vx = b.vy = 0;
    const old = PALETTE[b.color], [dr, dc] = DIRS[g.wall], cx = toSX(BOX.x + (b.x + b.bw / 2) * S), cy = toSY(BOX.y + (b.y + b.bh / 2) * S);
    const gx = g.wall < 2 ? cx : toSX(g.wall === 2 ? BOX.x - WALL / 2 : BOX.x + COLS * S + WALL / 2), gy = g.wall >= 2 ? cy : toSY(g.wall === 0 ? BOX.y - WALL / 2 : BOX.y + ROWS * S + WALL / 2);
    b.color = b.inner; b.inner = -1; b.sprites = undefined; b.wob = .24; b.wobT = 0; b.mood = 2; C.after(.7, () => { if (b.mood === 2 && b.state === 'idle') b.mood = 0; });
    g.flash = 1; fx.peel(); if (!bot.active) C.haptic('light');
    C.burst(gx, gy, { color: old, count: 28, speed: 720, size: 12, life: .75, gravity: 1400, angle: Math.atan2(dr, dc), spread: 2.2, drag: 1 });
    C.burst(cx, cy, { color: old, count: 10, speed: 320, size: 9, life: .45, gravity: 900, spread: Math.PI * 2 });
  }
  function setAim(key) { aim = key; if (global.Shell && Shell.boostAim) Shell.boostAim(key); }
  function useBoost(key) {   // appelé par la coquille quand le joueur touche une aide qu'il possède ; renvoie false si elle ne peut pas servir maintenant
    if (state !== 'play' || bot.active || blocks.some(b => b.drop < 0)) return false;
    if (key === 'ice') {
      if (freezeT > 0) return false;
      freezeT = BOOST.freeze; started = true; fx.ice(); C.flash('#bfe9ff', .45); C.haptic('medium');
      blocks.forEach(b => { if (b.state !== 'gone') b.heat = 0; });
      C.burst(W / 2, MIDY, { colors: ['#e0f4ff', '#9fd8ff', '#ffffff'], count: 36, speed: 900, size: 20, life: 1, shape: 'rect' });
      C.floatText(W / 2, FRAME.y + 200, tr('GEL {s} s', { s: BOOST.freeze }), { size: 90, color: '#bfe9ff', stroke: '#1d5fa8', strokeW: 12, dur: 1.2 });
      if (global.Shell) Shell.boostUsed('ice'); return true;
    }
    setAim(aim === key ? null : key); return true;   // cuillère, louche : la cible se choisit au doigt (retoucher le bouton annule)
  }
  function useAim(b) {
    const key = aim; setAim(null); if (b.state !== 'idle') return;
    const hidden = o => o.crate && o.ice > 0;   // sous une caisse, la couleur est inconnue : la louche ne la prend pas (sauf si c'est elle qu'on touche)
    const list = key === 'ladle' && !hidden(b) ? blocks.filter(o => o.state === 'idle' && !hidden(o) && o.color === b.color) : [b];
    started = true; list.forEach((o, i) => C.after(i * .09, () => scoop(o)));
    if (global.Shell) Shell.boostUsed(key);
  }
  function scoop(b) {   // retirée par une aide : elle saute hors du bac et atterrit dans l'assiette ; compte comme une sortie (glaçons, victoire)
    if (b.state !== 'idle') return; b.state = 'exit'; b.gate = null; b.exitT = 1; b.ice = 0; b.thaw = 0; b.mood = 2; C.killTweens(b); fx.exit(1); C.haptic('light');
    C.burst(toSX(BOX.x + (b.x + b.bw / 2) * S), toSY(BOX.y + (b.y + b.bh / 2) * S), { color: PALETTE[b.color], count: 20, speed: 520, size: 12, life: .6, gravity: 1100, spread: Math.PI * 2 });
    C.tween(b, { lift: 1.25 }, .12, { ease: ease.outQuad });
    C.tween(b, { lift: .3, alpha: 0 }, .2, { delay: .12, onDone() { b.state = 'gone'; b.alpha = 0; b.lift = 1; if (FEATURES.plate) addToPlate(b); if (blocks.every(x => x.state === 'gone')) win(); } });
    for (const o of blocks) if (o !== b && o.ice > 0) { o.ice--; o.iceT = .35; if (o.ice === 0) thaw(o); }
  }
  function thaw(b) {   // le glaçon se brise : éclats, tintement, la gelée se réveille
    b.thaw = 1; C.tween(b, { thaw: 0 }, .45, { ease: ease.outQuad }); b.wob = .2; b.wobT = 0; (b.crate ? fx.wood : fx.crack)(); if (!bot.active) C.haptic('medium');
    C.burst(toSX(BOX.x + (b.x + b.bw / 2) * S), toSY(BOX.y + (b.y + b.bh / 2) * S), { colors: b.crate ? ['#D9A066', '#8a5a2b', '#F3D9A4'] : ['#e0f4ff', '#9fd8ff', '#ffffff'], count: 16 + 6 * b.cells.length, speed: 650, size: 18, life: .7, gravity: 1100, shape: 'rect', drag: 1.5 });
  }
  function finale(x, y) {   // dernière gelée sortie in extremis : zoom sur la trappe, flash, fanfare courte, texte
    finales++; fx.finale(); if (FEATURES.musicPunct) chordSwell(); C.flash('#fff', .6); C.shake(10, .3); camLock = 2;
    cam.x = clamp(x, 300, W - 300); cam.y = clamp(y, 500, H - 500); C.killTweens(cam);
    C.tween(cam, { z: FINALE.zoom }, .25, { ease: ease.outBack }); C.tween(cam, { z: 1 }, .5, { delay: 1.1, ease: ease.inOutQuad });
    // le texte est dessiné dans l'espace zoomé : on le centre sur ce que l'écran montre (et non sur la trappe) et on le fait tenir dans cette fenêtre
    C.after(.2, () => { const z = FINALE.zoom, cx = cam.x + (W / 2 - cam.x) / z, cy = cam.y + (H / 2 - cam.y) / z; C.floatText(cx, cy - 60, FINALE.text, { size: C.fitSize(FINALE.text, 110, W / z - 160), color: '#FFC533', stroke: '#7c2d12', dur: 1.5, vy: -60 }); });
  }
  // L'assiette (FEATURES.plate) : chaque gelée sortie vole en cloche depuis sa trappe et se pose dans l'assiette sous le bac, en rangs qui
  // s'empilent : la récompense s'accumule sous les yeux du spectateur. Les gelées posées gardent leur visage (ravies).
  function addToPlate(b) {
    const lay = b.bh > b.bw;   // une gelée plus haute que large se couche dans l'assiette : rien ne dépasse au-dessus du bord
    const w = (lay ? b.bh : b.bw) * S * PLATE.scale + 10; let row = 0, x = -PLATE.w / 2;
    for (const it of plate) { if (it.row === row) x += it.w; if (x + w > PLATE.w / 2) { row++; x = -PLATE.w / 2 + (row % 2) * 30; } }
    const it = { b, w, row, lay, tx: PLATE.x + x + w / 2, ty: PLATE.y + row * PLATE.rowDy, fx: toSX(BOX.x + (b.x + b.bw / 2) * S), fy: toSY(BOX.y + (b.y + b.bh) * S), t: 0, sq: 0, sqT: 0 };
    plate.push(it);
    C.tween(it, { t: 1 }, PLATE.fly, { ease: ease.inOutQuad, onDone() { it.sq = .35; fx.drop(); C.burst(it.tx, it.ty, { color: '#ffffff', count: 6, speed: 250, size: 6, life: .35, gravity: 600, angle: -Math.PI / 2, spread: 2.4 }); } });
  }
  function drawPlate(h) {
    // assiette vide (ombre floue, porcelaine, deux filets) : dessinée une fois hors écran, l'ombre floue coûtait à chaque image (30 sept. 2026)
    const base = c => {
      c.save(); c.shadowColor = 'rgba(120,60,0,.3)'; c.shadowBlur = 24; c.shadowOffsetY = 10; c.fillStyle = '#FFFDF7'; c.beginPath(); c.ellipse(PLATE.x, PLATE.y + 18, PLATE.w / 2 + 40, 52, 0, 0, Math.PI * 2); c.fill(); c.restore();
      c.strokeStyle = '#BFD9F2'; c.lineWidth = 5; c.beginPath(); c.ellipse(PLATE.x, PLATE.y + 18, PLATE.w / 2 + 40, 52, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(191,217,242,.6)'; c.lineWidth = 3; c.beginPath(); c.ellipse(PLATE.x, PLATE.y + 18, PLATE.w / 2 - 10, 30, 0, 0, Math.PI * 2); c.stroke();
    };
    const M = 70, px = PLATE.x - PLATE.w / 2 - 40 - M, py = PLATE.y + 18 - 52 - M;
    if (CACHE.plate === undefined) { CACHE.plate = offscreen(PLATE.w + 80 + 2 * M, 104 + 2 * M); if (CACHE.plate) { const c = CACHE.plate.getContext('2d'); c.translate(-px, -py); base(c); } }
    if (CACHE.plate) ctx.drawImage(CACHE.plate, px, py); else base(ctx);
    // rangs du fond (le plus haut à l'écran) d'abord, puis le vol par-dessus
    const sorted = plate.slice().sort((a, b) => (a.row - b.row) || (a.t < 1 ? 1 : 0) - (b.t < 1 ? 1 : 0));
    for (const it of sorted) {
      const p = ease.inOutQuad(it.t); let x = lerp(it.fx, it.tx, p), y = lerp(it.fy, it.ty, p) - Math.sin(p * Math.PI) * 260;
      const wob = it.sq * Math.sin(it.sqT * 24), s = PLATE.scale;
      // couchée : tournée d'un quart de tour, l'ancre (milieu du bord bas) est décalée pour que la gelée reste centrée, posée sur son rang
      if (it.lay) { x -= it.b.bh * S * s / 2 * p; y -= it.b.bw * S * s / 2 * p; drawMini(it.b, x, y, s, 1 + wob, 1 - wob, p * Math.PI / 2); }
      else drawMini(it.b, x, y, s, 1 + wob, 1 - wob, it.t < 1 ? p * Math.PI * .5 : 0);
    }
  }
  function drawMini(b, x, y, s, sqx, sqy, rot) {   // une gelée réduite, ancrée au milieu de son bord bas, dessinée comme dans le bac
    const fake = Object.assign({}, b, { x: 0, y: 0, sx: 1, sy: 1, lift: 1, alpha: 1, melt: 0, heat: 0, sun: 0, state: 'idle', mood: 2, exitT: 0, blinkT: 0 });
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s * sqx, s * sqy); ctx.translate(-(BOX.x + b.bw * S / 2), -(BOX.y + b.bh * S)); drawBlock(fake, 0); ctx.restore();
  }

  // ------------------------------------------------------------ fin de niveau, échec, secours
  function starsFor() { const k = timeLeft / timeTotal; return k >= STARS[0] ? 3 : k >= STARS[1] ? 2 : 1; }
  function win() {
    state = 'done'; kidReact(6, 0); const st = starsFor(); const stars = '★'.repeat(st) + '☆'.repeat(3 - st);
    // carte de fin : les étoiles, ou une question qui appelle les commentaires ; en boucle, coupe franche et le même niveau repart
    const sub = FEATURES.endcard ? ENDCARDS[endcardI++ % ENDCARDS.length] : tr('niveau {n} · {s}', { n: shownLevel(), s: stars });
    C.after(.15, () => { if (FEATURES.musicPunct) fx.fanfare(st); else sfx.win(); voiceCd = 0; voice('relief', .09); C.showBanner(FEATURES.endcard ? stars : tr('SORTIES !'), sub, FEATURES.loop ? 1.3 : 2.2); C.confetti(W / 2, MIDY, { count: 90 }); });
    // coquille : écran de résultat une fois la bannière passée (elle s'affiche 2,2 s) ; sans coquille (ou en boucle de tournage), enchaînement comme au proto
    if (global.Shell && !FEATURES.loop) C.after(2.4, () => Shell.levelWon({ level, stars: st, time: levelT }));
    else C.after(FEATURES.loop ? 1.6 : 2.6, () => { if (!FEATURES.loop) level++; C.restart(); });
  }
  function melt(victim) {   // victim (FEATURES.sunMelt) : une seule gelée fond en plein soleil, les autres la regardent, inquiètes ; sans victime, tout fond (chrono à zéro)
    state = 'melt'; why = victim ? 'sun' : 'melt'; stats.melts++; if (victim) stats.sunMelts++; if (drag) { const b = drag.b; drag = null; b.state = 'idle'; snap(b); }
    if (bot.active && bot.down) { bot.clear(); bot.release(); }
    if (FEATURES.meltSound) { fx.meltLong(); C.after(.9, fx.splash); } else fx.melt();
    if (FEATURES.musicPunct) fx.fall();
    kidReact(-1, 0);
    C.shake(8, .5);
    // fonte mise en scène (FEATURES.meltShow) : plus lente, gouttes qui coulent, flaque qui s'étale, visage qui glisse et panique avant les yeux en croix
    const dur = FEATURES.meltShow ? 1.5 : .9;
    blocks.forEach((b, i) => { if (b.state === 'gone') return; if (!victim || b === victim) C.tween(b, { melt: 1 }, dur, { ease: FEATURES.meltShow ? ease.inQuad : ease.inOutQuad, delay: victim ? 0 : i * .05 }); else b.mood = -1; });
    if (victim) C.floatText(toSX(BOX.x + (victim.x + victim.bw / 2) * S), toSY(BOX.y + victim.y * S) - 40, tr('FONDUE !'), { size: 80, color: '#FFC533', stroke: '#7c2d12', strokeW: 12, dur: 1.4, vy: -50 });
    C.after(dur + .5, () => { state = 'over'; if (global.Shell) Shell.levelFailed({ level }); });
  }
  function rescue() {
    rescued = true; stats.rescues++; state = 'play'; timeLeft = Math.min(timeTotal, timeLeft + TIME.rescue); fx.ice(); C.flash('#bfe9ff', .5); musicRestore(); kidReact(3, 1.5, 10);
    blocks.forEach(b => { if (b.state !== 'gone') { b.heat = 0; b.mood = 0; C.tween(b, { melt: 0 }, .5, { ease: ease.outBack }); } });   // les glaçons refroidissent aussi toutes les gelées
    C.burst(W / 2, MIDY, { colors: ['#e0f4ff', '#9fd8ff', '#ffffff'], count: 40, speed: 900, size: 22, life: 1, shape: 'rect' });
    C.floatText(W / 2, BOX.y + 200, '+ ' + TIME.rescue + ' s', { size: 90, color: '#bfe9ff', dur: 1.2 });
  }

  // ------------------------------------------------------------ bot d'auto-play (parfait : suit le solveur ; humain : glouton, hésite, se trompe)
  // P fait défiler : parfait (suit le solveur), humain (glouton, hésite, se trompe), suspense (finit à la dernière seconde) ; `?bot=1` ou `?bot=2` dans l'URL.
  const BOT_NAMES = ['BOT PARFAIT', 'BOT HUMAIN', 'BOT SUSPENSE', 'BOT SUSPENSE RATÉ'];
  let botStyle = 0;
  function setBotStyle(s) { botStyle = s; botHuman = s === 1; plan = null; }
  // P change de bot et le lance s'il ne tourne pas ; s'il joue, il abandonne son geste en cours et repart tout de suite avec le nouveau style
  function toggleBotStyle() {
    setBotStyle((botStyle + 1) % BOT_NAMES.length);
    C.floatText(MIDX, MIDY, BOT_NAMES[botStyle], { color: '#fff', size: 80, dur: 1.5, vy: -70 });
    if (!bot.active) C.setBot(true); else { bot.clear(); if (bot.down) bot.release(); }
    updateBotLegend();
  }
  function updateBotLegend() {   // l'aide en bas à gauche indique le bot en cours
    if (typeof document === 'undefined' || !document.querySelector) return;
    const el = document.querySelector('#legend [data-k="p"]'); if (!el) return;
    el.innerHTML = '<b>P</b> bot : ' + ['parfait', 'humain', 'suspense', 'suspense raté'][botStyle] + ' (P change)'; el.classList.toggle('on', botStyle !== 0);
  }
  if (URLP.bot !== undefined) setBotStyle(clamp(+URLP.bot || 0, 0, BOT_NAMES.length - 1)); updateBotLegend();
  function simplify(path) { const out = [path[0]]; for (let k = 1; k < path.length - 1; k++) { const a = path[k - 1], b = path[k], c = path[k + 1]; if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) out.push(b); } if (path.length > 1) out.push(path[path.length - 1]); return out; }
  function validMove(mv) { const b = mv.b; if (!b || b.state !== 'idle' || b.r !== mv.path[0][0] || b.c !== mv.path[0][1]) return false; const occ = liveOcc(b); return mv.path.every(([r, c]) => fitsAt(b, r, c, occ)); }
  // une sortie du plan est-elle jouable tout de suite ? Le chemin doit être libre ET la gelée doit voir sa trappe à l'arrivée : dans une rafale de sorties,
  // certaines attendent qu'une autre soit partie (4 oct. 2026 : sans ce contrôle le bot parfait tournait en rond sur deux niveaux à murs).
  function canExit(mv) { if (!validMove(mv)) return false; const e = mv.path[mv.path.length - 1]; return clearToWall(mv.b, e[0], e[1], liveOcc(mv.b), mv.exit); }
  function bindPlan(sol, live) { return sol.plan.map(mv => Object.assign({}, mv, { b: live[mv.i] })); }
  function exitMoves(M) {   // une sortie possible par gelée qui peut sortir
    const exits = [];
    M.blocks.forEach((b, i) => { if (iced(b, 0)) return; const occ = occOf(M.blocks, M.pos, i); const R = reach(b, M.pos[i][0], M.pos[i][1], occ); for (const [r, c] of R.list) { const g = exitAt(b, r, c, occ, M.gates); if (g) { exits.push({ i, path: pathTo(R.seen, r, c), [layered(b) ? 'peel' : 'exit']: g.wall, b: M.live[i] }); break; } } });
    return exits;
  }
  function blunderMove(M) {   // bourde : pousse une gelée vers une trappe de sa couleur où elle ne passe pas (elle bute, « boing »)
    const cands = []; M.blocks.forEach((b, i) => { if (!iced(b, 0)) for (const g of M.gates) if (g.color === b.color && !fitsGate(b, g)) cands.push({ i, g }); });
    if (!cands.length) return null;
    const { i, g } = pick(cands); const b = M.blocks[i]; const occ = occOf(M.blocks, M.pos, i); const R = reach(b, M.pos[i][0], M.pos[i][1], occ);
    const gr = g.wall === 0 ? 0 : g.wall === 1 ? ROWS - b.bh : g.i, gc = g.wall === 2 ? 0 : g.wall === 3 ? COLS - b.bw : g.i;
    let best = null, bd = 1e9; for (const [r, c] of R.list) { const d = Math.abs(r - gr) + Math.abs(c - gc); if (d < bd) { bd = d; best = [r, c]; } }
    return { i, path: pathTo(R.seen, best[0], best[1]), bump: g.wall, b: M.live[i] };
  }
  function fakeTry(M) {   // essai pour rien : glisse une gelée quelque part et la ramène à sa place (l'état ne change pas)
    const order = shuffle(M.blocks.map((_, i) => i));
    for (const i of order) { const b = M.blocks[i]; if (iced(b, 0)) continue; const occ = occOf(M.blocks, M.pos, i); const R = reach(b, M.pos[i][0], M.pos[i][1], occ); if (R.list.length < 2) continue; const [r, c] = pick(R.list.slice(1)); const p = pathTo(R.seen, r, c); return { i, path: p.concat(p.slice(0, -1).reverse()), b: M.live[i] }; }
    return null;
  }
  function humanMove(M) {
    if (!M.blocks.length) return null;   // tout est sorti ou en train de sortir
    const exits = exitMoves(M);
    if (FEATURES.sunMelt) { const lit = exits.filter(e => e.b.sun > 0 || e.b.heat > SUN.warn).sort((a, b) => b.b.heat - a.b.heat); if (lit.length) return lit[0]; }   // une gelée au soleil (ou qui sue) peut sortir : il la sort d'abord, la plus chaude en premier, comme n'importe qui
    if (exits.length && Math.random() < HUMAN.blunder) { const mv = blunderMove(M); if (mv) return mv; }
    if (exits.length) return pick(exits);
    const hot = FEATURES.sunMelt && M.live.some(b => b.heat > SUN.warn);   // une gelée sue et ne peut pas sortir : il cherche vraiment (rangement du solveur) au lieu de tâtonner
    if (hot || Math.random() < HUMAN.park) { const sol = solve(M, M.pos, 60); if (sol.ok && sol.plan.length) return Object.assign({}, sol.plan[0], { b: M.live[sol.plan[0].i] }); }
    const i = randi(0, M.blocks.length - 1); const b = M.blocks[i]; if (iced(b, 0)) return null; const occ = occOf(M.blocks, M.pos, i); const R = reach(b, M.pos[i][0], M.pos[i][1], occ);
    if (R.list.length < 2) return null; const [r, c] = pick(R.list.slice(1)); return { i, path: pathTo(R.seen, r, c), b: M.live[i] };
  }
  // durée estimée d'un coup joué par le bot (approche, appui, trajet, poussée, relâchement) : sert au bot suspense pour se caler sur le chrono
  function estimate(mv, seg) { const pts = simplify(mv.path); let d = .3 + .06 + .05 + .08; for (let k = 1; k < pts.length; k++) d += seg * (Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1])) + .05; if (mv.exit !== undefined || mv.bump !== undefined || mv.peel !== undefined) d += .18; if (mv.bump !== undefined) d += .5; return d; }
  function execMove(mv, seg, rest = .08) {
    const b = mv.b;
    const anchor = (r, c) => [toSX(BOX.x + (c + b.cells[0][1] + .5) * S), toSY(BOX.y + (r + b.cells[0][0] + .5) * S)];
    const [x0, y0] = anchor(mv.path[0][0], mv.path[0][1]);
    bot.moveTo(x0, y0); bot.press().wait(.06);
    const pts = simplify(mv.path);
    for (let k = 1; k < pts.length; k++) { const [x, y] = anchor(pts[k][0], pts[k][1]); const n = Math.abs(pts[k][0] - pts[k - 1][0]) + Math.abs(pts[k][1] - pts[k - 1][1]); bot.moveTo(x, y, seg * n + .05); }
    const wall = mv.exit !== undefined ? mv.exit : mv.peel !== undefined ? mv.peel : mv.bump;
    if (wall !== undefined) { const [dr, dc] = DIRS[wall]; const last = pts[pts.length - 1]; const [x, y] = anchor(last[0] + dr * 1.2, last[1] + dc * 1.2); bot.moveTo(x, y, .18); if (mv.bump !== undefined) bot.wait(.5); }
    bot.wait(.05).release().wait(rest);
  }
  function nextPlanned() {   // prochain coup du plan ; FEATURES.sunMelt : parmi les sorties immédiates, la gelée la plus chaude d'abord (une sortie ne gêne jamais les autres)
    if (FEATURES.sunMelt && plan[0].exit !== undefined) { let best = 0; for (let k = 1; k < plan.length && plan[k].exit !== undefined; k++) if (plan[k].b.heat > plan[best].b.heat && canExit(plan[k])) best = k; return plan.splice(best, 1)[0]; }
    return plan.shift();
  }
  function plannedMove() {   // prochain coup du plan du solveur, re-résolu depuis l'état réel si le bot a été dévié
    while (plan && plan.length && !validMove(plan[0])) plan = null;
    if (!plan || !plan.length) { const M = model(); if (!M.blocks.length) return null; const sol = solve(M, M.pos, 600); plan = sol.ok ? bindPlan(sol, M.live) : null; if (!plan || !plan.length) { plan = null; return humanMove(M); } }
    return nextPlanned();
  }
  // BOT SUSPENSE : raconte une histoire pour la vidéo. Il connaît le plan du solveur et le temps qu'il lui faut pour le jouer en rafale
  // (`estimate` × `safety`). Tant qu'il a de la marge : début posé au rythme humain, puis il hésite, se trompe de trappe, essaie une gelée
  // et la remet, réfléchit… pendant que le thermomètre monte. Quand la marge tombe à `slack`, rafale finale calée pour sortir la dernière
  // gelée à `margin` secondes de la fin (chiffres rouges, écran rouge, gelées en sueur). Ne rate qu'exceptionnellement : `R` refait une prise.
  const SUSPENSE = { margin: .2, failMargin: -1.9, slack: 1.2, calm: .3, seg: .07, safety: 1, drama: 2.6 };   // mesuré : la dernière gelée sort ~1,2 s avant la fin ; failMargin : bot raté (P ×3, ?bot=3)
  function suspenseMove() {
    const M = model(); if (!M.blocks.length) { bot.wait(.3); return; }
    while (plan && plan.length && !validMove(plan[0])) plan = null;
    if (!plan || !plan.length) { const sol = solve(M, M.pos, 80); plan = sol.ok ? bindPlan(sol, M.live) : null; }
    if (!plan || !plan.length) { plan = null; const mv = humanMove(M); if (mv) execMove(mv, HUMAN.seg); else bot.wait(.4); return; }
    const rush = plan.reduce((s, mv) => s + estimate(mv, SUSPENSE.seg), 0) * SUSPENSE.safety;
    // temps avant qu'une gelée au soleil ne fonde (FEATURES.sunMelt) : le bot ne peut pas traîner plus longtemps que ça non plus
    const sunLeft = FEATURES.sunMelt ? M.live.reduce((m, b) => b.sun > 0 ? Math.min(m, (1 - b.heat) * sunExpose / b.sun) : m, Infinity) : Infinity;
    const slack = Math.min(timeLeft, sunLeft) - rush - (botStyle === 3 ? SUSPENSE.failMargin : SUSPENSE.margin);   // raté : il part en rafale trop tard, la dernière gelée fond à côté de sa trappe
    const done = 1 - M.blocks.length / blocks.length;
    if (slack > SUSPENSE.slack) {
      const mv = plan[0], extra = estimate(mv, HUMAN.seg) - estimate(mv, SUSPENSE.seg);
      if (done < SUSPENSE.calm && slack - extra > SUSPENSE.slack) { execMove(nextPlanned(), HUMAN.seg, rand(.2, .5)); return; }   // début posé : vrais coups, rythme humain
      const budget = Math.min(slack - SUSPENSE.slack, SUSPENSE.drama);
      const choice = pick(['hesitate', 'blunder', 'fake', 'fake', 'think']);
      if (choice === 'blunder') { const b = blunderMove(M); if (b && estimate(b, HUMAN.seg) < budget) { execMove(b, HUMAN.seg, rand(.2, .5)); return; } }
      if (choice === 'fake') { const f = fakeTry(M); if (f && estimate(f, HUMAN.seg) < budget) { execMove(f, HUMAN.seg, rand(.2, .5)); return; } }
      if (choice === 'hesitate' && budget > 1) {   // le doigt se pose sur une gelée, la soulève, se ravise
        const b = pick(M.live); bot.moveTo(toSX(BOX.x + (b.c + b.cells[0][1] + .5) * S), toSY(BOX.y + (b.r + b.cells[0][0] + .5) * S)).press().wait(rand(.3, .6)).release().wait(.2); return;
      }
      bot.wait(clamp(rand(.5, 1.1), .2, budget)); return;
    }
    execMove(nextPlanned(), SUSPENSE.seg, .06);   // rafale finale
  }
  function autoplay() {
    if (state === 'over') { bot.wait(1.1).tap(RETRY_BTN.x, RETRY_BTN.y); return; }   // le bot recommence toujours (jamais le secours)
    if (state !== 'play') { bot.wait(.3); return; }
    if (blocks.some(b => b.drop < 0)) { bot.wait(.15); return; }   // les gelées tombent encore dans le bac
    if (botStyle >= 2) { suspenseMove(); return; }
    let mv;
    if (botHuman) { mv = humanMove(model()); if (mv) bot.wait(rand(HUMAN.think[0], HUMAN.think[1])); }
    else mv = plannedMove();
    if (!mv) { bot.wait(.4); return; }
    execMove(mv, botHuman ? HUMAN.seg : .09, botHuman ? rand(.15, .5) : .08);
  }

  // ------------------------------------------------------------ mise à jour
  function update(dt) {
    updateMusic();
    if (slowmo > 0) { slowmo -= dt; dt *= CAMERA.slow; }   // ralenti sur la dernière sortie (les tweens de Core, eux, ont été allongés)
    if (FEATURES.camera) {   // caméra vivante : suit la gelée tenue avec un léger zoom, recule à chaque sortie ; verrouillée pendant la finale et le battement
      camLock = Math.max(0, camLock - dt); camKick = lerp(camKick, 0, 1 - Math.exp(-5 * dt));
      if (camLock <= 0) {
        let tz = 1 + camKick, tx = W / 2, ty = H / 2;
        if (drag && state === 'play') { tz = CAMERA.grab + camKick; tx = clamp(toSX(BOX.x + (drag.b.x + drag.b.bw / 2) * S), 380, W - 380); ty = clamp(toSY(BOX.y + (drag.b.y + drag.b.bh / 2) * S), 600, H - 600); }
        const k = 1 - Math.exp(-6 * dt); cam.z = lerp(cam.z, tz, k); cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
      }
    }
    if (state === 'play') {
      if (FEATURES.sunMelt) exposure();
      if (freezeT > 0) freezeT -= dt;   // aide « glaçons » : ni chrono ni chaleur pendant ce temps
      if (started && freezeT <= 0 && blocks.some(b => b.state === 'idle' || b.state === 'drag')) {   // le chrono s'arrête à la dernière sortie : une gelée en train de sortir ne fond plus
        levelT += dt; const before = timeLeft; timeLeft = Math.max(0, timeLeft - dt);
        if (timeLeft <= 5 && Math.ceil(before) !== Math.ceil(timeLeft) && timeLeft > 0) {
          C.floatText(MIDX, MIDY, String(Math.ceil(timeLeft)), { size: 150, color: '#ff4d4d', dur: .7 });
          if (FEATURES.heartbeat) { fx.heart(); if (camLock <= 0 && !drag) { camLock = .4; C.killTweens(cam); cam.x = W / 2; cam.y = H / 2; cam.z = 1.025; C.tween(cam, { z: 1 }, .35, { ease: ease.outQuad }); } } else fx.tick();
        }
        if (timeLeft <= 0) melt();
        else if (FEATURES.sunMelt) for (const b of blocks) {   // fonte au soleil : chaque gelée chauffe selon sa part de colonnes exposées, refroidit à l'ombre ; à 1 elle fond et le niveau est perdu
          if (b.state !== 'idle' && b.state !== 'drag') continue;
          if (b.ice > 0) continue;
          const was = b.heat; b.heat = clamp(b.heat + (b.sun > 0 ? b.sun * dt / sunExpose : -dt / SUN.cool), 0, 1);
          if (was < SUN.panic && b.heat >= SUN.panic) { voice('groan', .08); if (FEATURES.ambience) fx.drip(); }
          if (b.heat >= 1) { melt(b); break; }
        }
      }
      if (drag) moveDragged(dt);
    }
    if (streakT > 0) streakT -= dt;
    heatWave += dt;
    for (const it of plate) { it.sqT += dt; it.sq *= Math.exp(-5 * dt); }
    if (boltT > 0) boltT -= dt; if (voiceCd > 0) voiceCd -= dt;
    if (kid.t > 0) { kid.t -= dt; if (kid.t <= 0 && kid.mood > 0 && kid.mood < 6) kid.mood = 0; }   // les réactions passagères retombent
    if (kid.mood === 0 || kid.mood === 2 || kid.mood === 7) {   // humeurs de fond : inquiet tant qu'une gelée est près de fondre (ou que le chrono s'achève), bâille si le joueur ne touche à rien
      const on = state === 'play' && started;
      kid.idle = on && !bot.active && !drag ? kid.idle + dt : 0;
      kid.mood = on && ((FEATURES.sunMelt && hottest() >= SUN.panic) || timeLeft < 6) ? 2 : kid.idle > KID_IDLE ? 7 : 0;
    }
    if (FEATURES.ambience && state === 'play' && started) {   // tic-tac qui accélère sous 10 s, goutte quand les gelées suent
      const urg = Math.max((10 - timeLeft) / 10, FEATURES.sunMelt ? (hottest() - SUN.panic) / (1 - SUN.panic) : 0);   // urgence : fin du chrono ou gelée près de fondre
      if (urg > 0) { ticAcc += dt; const iv = lerp(.55, .17, urg); if (ticAcc >= iv) { ticAcc = 0; ticHi = !ticHi; fx.tic(ticHi); } }
      if (heat() > .72 || (FEATURES.sunMelt && hottest() > SUN.warn)) { dripAcc += dt; if (dripAcc > 1.4) { dripAcc = rand(0, .4); fx.drip(); } }
    }
    for (const g of gates) { g.glow = lerp(g.glow, drag && drag.b.color === g.color ? 1 : 0, 1 - Math.exp(-8 * dt)); if (g.flash > 0) g.flash = Math.max(0, g.flash - dt * 2.5); g.shut = lerp(g.shut || 0, blocks.some(b => (b.color === g.color || b.inner === g.color || (b.crate && b.ice > 0)) && b.state !== 'gone') ? 0 : 1, 1 - Math.exp(-5 * dt)); }   // shut : plus aucune gelée de cette couleur, la trappe se referme (moins de trappes à lire)
    for (const b of blocks) {
      if (b.state === 'gone') continue;
      b.bumpT = Math.max(0, b.bumpT - dt); if (b.iceT > 0) b.iceT = Math.max(0, b.iceT - dt); b.wobT += dt; b.wob *= Math.exp(-5 * dt);
      if (b.state === 'drag') { b.sx = lerp(b.sx, 1 + clamp(Math.abs(b.vx) * .006, 0, .16) - clamp(Math.abs(b.vy) * .004, 0, .1), 1 - Math.exp(-14 * dt)); b.sy = lerp(b.sy, 1 + clamp(Math.abs(b.vy) * .006, 0, .16) - clamp(Math.abs(b.vx) * .004, 0, .1), 1 - Math.exp(-14 * dt)); }
      else if (b.state === 'idle') { const w = b.wob * (FEATURES.physics ? Math.cos(b.wobT * 22) : Math.sin(b.wobT * 26)); b.sx = 1 + w; b.sy = 1 - w; }   // physique : la pose commence écrasée puis rebondit
      // regard : vers le doigt ; clignement
      const fx0 = BOX.x + (b.x + b.cells[b.face][1] + .5) * S, fy0 = BOX.y + (b.y + b.cells[b.face][0] + .5) * S;
      const tgt = pointer.inside || bot.active ? { x: clamp((toBX(pointer.x) - fx0) / 400, -1, 1), y: clamp((toBY(pointer.y) - fy0) / 400, -1, 1) } : { x: 0, y: 0 };
      if (FEATURES.physics && b.state === 'drag') { tgt.x = clamp(tgt.x - b.vx * .06, -1, 1); tgt.y = clamp(tgt.y - b.vy * .06, -1, 1); }   // les yeux traînent derrière le mouvement (inertie)
      b.look.x = lerp(b.look.x, tgt.x, 1 - Math.exp(-6 * dt)); b.look.y = lerp(b.look.y, tgt.y, 1 - Math.exp(-6 * dt));
      b.blink -= dt; if (b.blink <= 0) { b.blinkT = .13; b.blink = rand(1.5, 4.5); } if (b.blinkT > 0) b.blinkT -= dt;
    }
  }

  // ------------------------------------------------------------ dessin
  // ICÔNE ET ÉCRAN DE DÉMARRAGE (engine/art.js, ?art=icon|splash&res=1) : dessinés dans le carré du haut (1080 × 1080) avec les vraies gelées
  // du jeu (corps translucide, reflets, sucre, visages). Icône : trois gelées sur fond d'été, la rouge devant, ravie ; démarrage : le titre au-dessus.
  const artBlocks = [];
  function artBlock(name, color, mood, look) {
    const sh = shapeOf(name), b = makeBlock({ cells: sh.cells, bw: sh.bw, bh: sh.bh, color }, 0, 0, artBlocks.length);
    b.mood = mood; b.look = look; b.blink = 99; artBlocks.push(b); return b;
  }
  function drawArtBlock(b, cx, cy, k, rot = 0) {   // gelée centrée en (cx, cy), à l'échelle k
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(k, k); ctx.translate(-(BOX.x + b.bw * S / 2), -(BOX.y + b.bh * S / 2)); drawBlock(b, 0); ctx.restore();
  }
  function drawArt() {
    const icon = ART.kind === 'icon'; ART.bg = '#FF9A55';
    if (!artBlocks.length) { artBlock('i2v', 1, 0, { x: .5, y: .4 }); artBlock('i2v', 2, 0, { x: -.5, y: .4 }); artBlock('i1', 0, 2, { x: 0, y: 0 }); }
    const [yel, grn, red] = artBlocks;
    if (icon) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, 1080, 1080); ctx.clip();
      const g = ctx.createRadialGradient(540, 470, 60, 540, 540, 780); g.addColorStop(0, '#FFF4C9'); g.addColorStop(.55, '#FFC870'); g.addColorStop(1, '#FF8A4C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1080);
      ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = '#fff'; for (let i = 0; i < 12; i++) { ctx.beginPath(); ctx.moveTo(540, 470); ctx.arc(540, 470, 900, i * Math.PI / 6, i * Math.PI / 6 + Math.PI / 12); ctx.fill(); } ctx.restore();   // rayons de soleil
      drawArtBlock(yel, 255, 500, 2.1, -.14); drawArtBlock(grn, 825, 500, 2.1, .14); drawArtBlock(red, 540, 640, 3.5); ctx.restore();
    } else {   // plein écran (portrait) : le même soleil que l'icône, titre et gelées au milieu
      const g = ctx.createRadialGradient(540, 1000, 80, 540, 1000, 1150); g.addColorStop(0, '#FFF4C9'); g.addColorStop(.5, '#FFC870'); g.addColorStop(1, '#FF8A4C');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.globalAlpha = .16; ctx.fillStyle = '#fff'; for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.moveTo(540, 1000); ctx.arc(540, 1000, 1600, i * Math.PI / 8, i * Math.PI / 8 + Math.PI / 16); ctx.fill(); } ctx.restore();
      text('JELLIES', 540, 560, { size: 160, color: '#fff', stroke: '#c2410c', strokeW: 22, shadow: 14 });
      text('ON THE RUN', 540, 710, { size: 110, color: '#fff', stroke: '#c2410c', strokeW: 18, shadow: 12 });
      drawArtBlock(yel, 320, 1110, 1.6, -.14); drawArtBlock(grn, 760, 1110, 1.6, .14); drawArtBlock(red, 540, 1220, 2.6);
    }
  }
  function draw() {
    if (global.ART) return drawArt();
    const h = heat();
    // ciel : la nappe opaque (drawPicnic) couvre tout à partir de y = 250, seule la bande du haut est peinte (même dégradé, 13 % de l'écran au
    // lieu d'un écran entier : optimisation du 30 sept. 2026). Caméra reculée (zoom < 1) ou sans nappe : écran entier, comme avant.
    const skyH = FEATURES.picnic && cam.z >= 1 ? 250 : H;
    const sky = (c1, c2) => { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2); ctx.fillStyle = g; ctx.fillRect(0, 0, W, skyH); };
    if (BANDS) { const im = decorImage(); if (bandKey !== (im ? im.src : '-') + '|' + C.film) placeBands(); }   // zone, taille d'écran ou image chargée : les bandes suivent
    const dec = decorImage();   // décor illustré de la zone, s'il existe et qu'il est chargé : il remplace le ciel, la nappe, l'herbe et la limonade dessinés par le code
    if (dec) { const v = decorView(dec); ctx.drawImage(dec, v[0], v[1], v[2], v[3], 0, 0, W, H); }   // la partie centrale de l'image agrandie au plein écran (le reste est dans les calques hors canevas)
    else if (FEATURES.summer) { const TH = theme(); sky(mix(TH.sky[0], SKY.top1, h), mix(TH.sky[1], SKY.bot1, h)); }   // plein été : bleu profond qui vire à l'orange
    else if (FEATURES.picnic) sky(mix('#FFF3D0', '#FFD08A', h), mix('#FFD39A', '#FF8F5A', h));   // du matin doré au plein soleil
    if (dec) {} else if (FEATURES.life) drawClouds();
    else C.bgGradient(shade('#FFF3D0', -h * .02), lerp(0, 1, h) > .5 ? '#FFB577' : '#FFD39A');
    if (cam.z !== 1) { ctx.translate(cam.x, cam.y); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y); }   // non défait : Core restaure après particules et textes flottants
    drawSun(h);
    if (FEATURES.picnic && !dec) drawPicnic(h);
    if (FEATURES.contrast) { if (!CACHE.vignette) { CACHE.vignette = offscreen(W, H); if (CACHE.vignette) drawVignette(CACHE.vignette.getContext('2d')); } if (CACHE.vignette) drawVignetteImage(); else drawVignette(ctx); }   // vignette : le bac ressort, le décor s'efface (dessinée une fois)
    const hook = FEATURES.hook >= 0 ? HOOKS[FEATURES.hook % HOOKS.length] : null;
    if (hook) hook.replace(/\{n\}/g, shownLevel()).split('|').forEach((line, i, all) => text(line, W / 2, (C.film ? 70 : 110) + (i - (all.length - 1) / 2) * 68, { size: C.fitSize(line, 62, W - 120), color: '#fff', stroke: '#c2410c', strokeW: 12, shadow: 10 }));
    else if (!C.film) text(GAME_NAME, W / 2, 130, { size: C.fitSize(GAME_NAME, 74, W - 2 * C.HUD_CLEAR), color: '#fff', stroke: '#c2410c', strokeW: 14, shadow: 12 });
    const hardTag = P.hard && !C.film ? ' · ' + tr(P.hard > 1 ? 'TRÈS DIFFICILE' : 'DIFFICILE') : '';
    text(tr('NIVEAU {n}', { n: shownLevel() }) + hardTag, C.film ? BOX.x - WALL : W / 2, C.film ? (FEATURES.bigGates ? 208 : 222) : 205, { size: 40, color: hardTag ? '#c81e3a' : '#7c2d12', stroke: '#fff7e6', strokeW: 8, align: C.film ? 'left' : 'center' });
    if (bot.active && !C.film && !URLP.nolabel) text(BOT_NAMES[botStyle], W / 2, 242, { size: 24, color: '#7c2d12', alpha: .7 });
    drawThermo(h);
    const onBoard = fn => { ctx.save(); ctx.translate(MIDX, MIDY); ctx.scale(BK, BK); ctx.translate(-BOX.x - COLS * S / 2, -BOX.y - ROWS * S / 2); fn(); ctx.restore(); };   // le bac et ses gelées, à l'échelle du plateau
    onBoard(() => {
      drawTray(h);
      if (FEATURES.sunMelt) drawSunlight();
      for (const b of blocks) if (b.state === 'idle') drawBlock(b, h);
      for (const b of blocks) if (b.state === 'exit') drawBlock(b, h);
      if (drag) drawBlock(drag.b, h);
    });
    if (freezeT > 0 && state === 'play') { ctx.fillStyle = 'rgba(150,210,255,' + (.18 * Math.min(1, freezeT)).toFixed(3) + ')'; ctx.fillRect(FRAME.x - WALL, FRAME.y - WALL, FRAME.w + 2 * WALL, FRAME.h + 2 * WALL); }   // voile de givre sur le bac
    if (aim && state === 'play') text(tr('Touche une gelée'), W / 2, FRAME.y + 84, { size: 58 + 4 * Math.sin(heatWave * 6), color: '#fff', stroke: '#1d5fa8', strokeW: 14 });
    if (h > .7 && state === 'play') { ctx.save(); ctx.globalAlpha = (h - .7) / .3 * (.35 + .25 * Math.sin(heatWave * 8)); const g = ctx.createRadialGradient(W / 2, H / 2, 500, W / 2, H / 2, 1100); g.addColorStop(0, 'rgba(255,60,30,0)'); g.addColorStop(1, 'rgba(255,60,30,.9)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (FEATURES.picnic && started && state === 'play' && timeLeft < 10) drawHaze();
    if (boltT > 0) onBoard(drawBolt);
    if (FEATURES.plate) drawPlate(h);
    if (FEATURES.life) drawLife();
    if (FEATURES.kid) drawKid();
    if (!C.film) { const hint = state === 'play' && !started ? tr('Glisse chaque gelée jusqu’à la trappe de sa couleur') : tr('Vite, avant que ça fonde !'); const hs = C.fitSize(hint, 40, W - 100);   // taille réduite au besoin pour tenir dans l'écran
      text(hint, W / 2, FEATURES.summer ? BOT + (global.Shell ? 226 : 292) : FEATURES.plate ? BOT + 152 : BOT + 52, FEATURES.summer ? { size: hs, color: '#fff', stroke: FEATURES.grass ? '#1F5A2A' : '#3E2612', strokeW: 8 } : { size: hs, color: '#7c2d12', alpha: .85 }); }   // plein été : sur la table, en blanc
    if (state === 'over') drawOver();
  }
  function drawBolt() {   // éclair de série : contour du bac en zigzag, couleur de la gelée sortie, qui s'éteint en 0,4 s
    const k = boltT / .4, x = BOX.x - WALL - 10, y = BOX.y - WALL - 10, w = COLS * S + 2 * WALL + 20, hh = ROWS * S + 2 * WALL + 20;
    ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = boltCol; ctx.lineWidth = 8 + 6 * k; ctx.lineJoin = 'round'; ctx.shadowColor = boltCol; ctx.shadowBlur = 30;
    ctx.beginPath(); const pts = []; const step = 70;
    for (let xx = x; xx <= x + w; xx += step) pts.push([xx, y]); for (let yy = y; yy <= y + hh; yy += step) pts.push([x + w, yy]); for (let xx = x + w; xx >= x; xx -= step) pts.push([xx, y + hh]); for (let yy = y + hh; yy >= y; yy -= step) pts.push([x, yy]);
    pts.forEach(([px, py], i) => { const j = (Math.sin(i * 12.9 + heatWave * 40) * 14); const [ox, oy] = i % 2 ? [j, j] : [-j, j]; if (i === 0) ctx.moveTo(px + ox, py + oy); else ctx.lineTo(px + ox, py + oy); });
    ctx.closePath(); ctx.stroke(); ctx.restore();
  }
  const hex = c => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')'; };
  // Décor de pique-nique (FEATURES.picnic) : nappe à carreaux pâles (bleus, pour ne pas concurrencer les gelées), bord de table en bois en bas,
  // verre de limonade dont les glaçons fondent avec le chrono, gouttes de condensation quand il fait chaud.
  // la vignette est transparente dans son disque central (rayon 520 × S / 120) : on ne recopie que ce qui l'entoure, en quatre bandes autour du
  // carré inscrit dans ce disque (0,37 écran de moins par image, rendu identique ; optimisation du 30 sept. 2026)
  function drawVignetteImage() {
    // C.blit cale les jointures sur les pixels réels de l'écran (sinon une ligne plus claire à la jointure de deux morceaux)
    const v = CACHE.vignette, cy = MIDY, a = Math.floor(520 * S / 120 / Math.SQRT2) - 2, x0 = W / 2 - a, x1 = W / 2 + a, y0 = Math.max(0, cy - a), y1 = Math.min(H, cy + a);
    const part = (x, y, w, h) => C.blit(v, 0, 0, x, y, w, h);
    part(0, 0, W, y0); part(0, y1, W, H - y1); part(0, y0, x0, y1 - y0); part(x1, y0, W - x1, y1 - y0);
  }
  function drawVignette(c) { const vg = c.createRadialGradient(W / 2, MIDY, 520 * S / 120, W / 2, MIDY, 1150 * S / 120); vg.addColorStop(0, 'rgba(60,30,10,0)'); vg.addColorStop(1, FEATURES.summer ? 'rgba(40,20,10,.62)' : 'rgba(60,30,10,.45)'); c.fillStyle = vg; c.fillRect(0, 0, W, H); }
  function drawPicnic(h) {
    const top = 250, SM = FEATURES.summer;
    const ck = clothColor() + theme().pattern; if (CACHE.clothKey !== ck) { CACHE.clothKey = ck; CACHE.cloth = CACHE.cloth || offscreen(W, H - top); if (CACHE.cloth) { const c = CACHE.cloth.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, -top); drawCloth(c, top, SM); } }   // redessinée seulement au changement de zone   // nappe : ~1 000 rectangles, dessinés une fois
    if (CACHE.cloth) ctx.drawImage(CACHE.cloth, 0, top); else drawCloth(ctx, top, SM);
    const ty = BOT + 212;   // bord de la nappe
    if (FEATURES.grass) drawGrass(ty);
    else {   // table en bois
      const wg = ctx.createLinearGradient(0, ty, 0, H); wg.addColorStop(0, SM ? '#6B4224' : '#C98A4B'); wg.addColorStop(1, SM ? '#3E2612' : '#8F5A2B'); ctx.fillStyle = wg; ctx.fillRect(0, ty, W, H - ty);
      ctx.strokeStyle = 'rgba(80,40,10,.35)'; ctx.lineWidth = 3; for (let yy = ty + 70; yy < H; yy += 90) { ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.14)'; ctx.fillRect(0, ty, W, 14);
    }
    if (FEATURES.life) { drawFlowers(); for (let i = 0; i < 6; i++) { const t = (heatWave * .06 + i * .09) % 1; drawAnt(lerp(-30, 330, t), lerp(BOT + 152, BOT + 77, t) + Math.sin(i * 2.1) * 10, t); } }   // fourmis en file vers l'assiette (elles passent dessous)
    drawLemonade(h);
  }
  const clothColor = () => theme().cloth;
  function drawCloth(c, top, SM) {   // la nappe : fond, carreaux, trame du tissu, ombre du bord (c = contexte cible, coordonnées de jeu)
    c.fillStyle = SM ? '#FFF9F2' : '#FFF6E6'; c.fillRect(0, top, W, H - top);
    c.fillStyle = SM ? clothColor() : 'rgba(90,130,210,.15)'; const cs = 60;   // plein été : vrais carreaux rouges et blancs
    const pat = SM ? theme().pattern : 'check';
    if (pat !== 'check') {   // motif de la zone : rayures, pois ou losanges
      if (pat === 'stripes') { for (let xx = 0; xx < W; xx += cs * 2) c.fillRect(xx, top, cs, H - top); c.fillStyle = 'rgba(255,255,255,.3)'; for (let xx = 0; xx < W; xx += cs * 2) c.fillRect(xx + 24, top, 12, H - top); }
      else if (pat === 'dots') { for (let yy = top + 40, k = 0; yy < H; yy += 70, k++) for (let xx = 40 + (k % 2) * 45; xx < W; xx += 90) { c.beginPath(); c.arc(xx, yy, 20, 0, Math.PI * 2); c.fill(); } }
      else { for (let yy = top + 45, k = 0; yy < H; yy += 60, k++) for (let xx = 45 + (k % 2) * 60; xx < W; xx += 120) { c.beginPath(); c.moveTo(xx, yy - 40); c.lineTo(xx + 40, yy); c.lineTo(xx, yy + 40); c.lineTo(xx - 40, yy); c.closePath(); c.fill(); } }
      c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, top, W, 10); return;
    }
    for (let yy = top; yy < H; yy += cs) for (let xx = (Math.round((yy - top) / cs) % 2) * cs; xx < W; xx += cs * 2) c.fillRect(xx, yy, cs, cs);
    if (SM) { c.fillStyle = 'rgba(255,255,255,.35)'; for (let yy = top; yy < H; yy += cs) for (let xx = (Math.round((yy - top) / cs) % 2) * cs; xx < W; xx += cs * 2) c.fillRect(xx + 20, yy + 20, 20, 20); }   // trame du tissu
    c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(0, top, W, 10);
  }
  // Herbe (FEATURES.grass) sous la nappe : pelouse verte et saturée (elle reste lisible sous la vignette), touffes qui dépassent du bord de la nappe
  // et brins semés sur toute la hauteur, tous déterministes (pas de scintillement) et qui ondulent doucement avec le vent.
  // L'ondulation (3 px) est redessinée 20 fois par seconde hors écran, et non 60 fois : invisible à l'œil, trois fois moins de tracés.
  function drawGrass(ty) {
    const y0 = ty - 40;   // les touffes dépassent du bord de la nappe
    if (!CACHE.grass) CACHE.grass = offscreen(W, H - y0);
    if (!CACHE.grass) return drawGrassOn(ctx, ty);
    if (CACHE.grassAt < 0 || Math.abs(heatWave - CACHE.grassAt) >= .05) { const c = CACHE.grass.getContext('2d'); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H - y0); c.translate(0, -y0); drawGrassOn(c, ty); CACHE.grassAt = heatWave; }
    ctx.drawImage(CACHE.grass, 0, y0); ctx.lineCap = 'round';
  }
  function drawGrassOn(c, ty) {
    const GR = theme().ground; const g = c.createLinearGradient(0, ty, 0, H); g.addColorStop(0, GR[0]); g.addColorStop(1, GR[1]); c.fillStyle = g; c.fillRect(0, ty, W, H - ty);
    const hash = n => { const s = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
    c.lineCap = 'round';
    for (let row = 0; row < 5; row++) {   // brins semés, plus foncés en bas
      const yy = ty + 40 + row * 78; c.strokeStyle = row % 2 ? GR[2] : GR[3]; c.lineWidth = 4;
      for (let i = 0; i < 24; i++) { const x = (i * 47 + hash(row * 31 + i) * 30) % (W + 20) - 10, hgt = 14 + hash(i * 7 + row) * 14, sway = Math.sin(heatWave * 1.6 + i * .7 + row) * 3; c.beginPath(); c.moveTo(x, yy + hgt); c.quadraticCurveTo(x + sway, yy + hgt * .5, x + sway * 2 + 4, yy); c.stroke(); }
    }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(0, ty, W, 12);   // ombre de la nappe sur l'herbe
    for (let i = 0; i < 46; i++) {   // touffes le long du bord de la nappe
      const x = i * 24 + hash(i) * 10, hgt = 16 + hash(i * 3) * 18, sway = Math.sin(heatWave * 1.8 + i * .5) * 3;
      c.fillStyle = GR[4 + i % 3];
      c.beginPath(); c.moveTo(x - 8, ty + 10); c.quadraticCurveTo(x + sway - 2, ty - hgt * .5, x + sway, ty - hgt); c.quadraticCurveTo(x + sway + 4, ty - hgt * .5, x + 8, ty + 10); c.closePath(); c.fill();
    }
  }
  function drawClouds() {   // nuages cartoon qui dérivent lentement dans le ciel
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    [[0, 150, 1.1, .6], [520, 80, .8, .45], [1200, 190, 1.3, .55]].forEach(([x0, y, s, sp]) => {
      const x = ((x0 + heatWave * 14 * sp) % (W + 500)) - 250; ctx.beginPath();
      [[0, 0, 44], [40, -18, 54], [90, 0, 40], [45, 14, 46]].forEach(([dx, dy, r]) => { ctx.moveTo(x + dx * s + r * s, y + dy * s); ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); });
      ctx.fill();
    });
  }
  function drawFlowers() {   // marguerites au coin de la nappe, en bas à gauche
    for (const [x, y, s] of [[70, BOT + 192, 1], [150, BOT + 200, .7]]) {
      ctx.strokeStyle = '#3E9B4F'; ctx.lineWidth = 6 * s; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y + 60 * s); ctx.quadraticCurveTo(x + 10 * s, y + 20 * s, x, y); ctx.stroke();
      ctx.fillStyle = '#4CB35E'; ctx.beginPath(); ctx.ellipse(x + 18 * s, y + 40 * s, 16 * s, 8 * s, -.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2; for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + heatWave * .3; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * 16 * s, y + Math.sin(a) * 16 * s, 12 * s, 7 * s, a, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#FFC533'; ctx.beginPath(); ctx.arc(x, y, 10 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  function drawAnt(x, y, t) {   // fourmi : trois boules, pattes qui trottent, petits yeux (même regard que les gelées)
    const dark = '#3a2a1a'; ctx.save(); ctx.translate(x, y); ctx.fillStyle = dark; ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const ph = heatWave * 30 + i * 2 + t * 10; ctx.beginPath(); ctx.moveTo(-6 + i * 6, 0); ctx.lineTo(-10 + i * 6 + Math.sin(ph) * 4, 9); ctx.moveTo(-6 + i * 6, 0); ctx.lineTo(-10 + i * 6 - Math.sin(ph) * 4, -9); ctx.stroke(); }
    [[-12, 6], [0, 5], [12, 7]].forEach(([dx, r]) => { ctx.beginPath(); ctx.arc(dx, 0, r, 0, Math.PI * 2); ctx.fill(); });
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(15, -3, 2.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(16, -3, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawLife() {   // papillons en lissajous au-dessus de la nappe, abeille autour de la limonade
    const el = elementsSheet();
    if (el && el.crawl !== undefined) { const t = (heatWave * .012) % 1; drawElement(el, el.crawl, 1052 + Math.sin(t * 40) * 6, lerp(BOT - 20, 340, t), el.crawlSize || 56, Math.sin(t * 40) * .25); }   // grimpe le long de la paroi droite
    if (el && el.fall) for (let i = 0; i < 4; i++) { const t = (heatWave * .035 + i * .27) % 1; drawElement(el, el.fall[i % el.fall.length], (i % 2 ? 1050 : 30) + Math.sin(heatWave * .8 + i * 2) * 22, lerp(300, BOT + 40, t), el.fallSize || 50, heatWave * .6 + i * 2); }   // tombe en tournant, dans les marges
    if (el && el.glow) el.glow.forEach((g, i) => { ctx.globalAlpha = .55 + .45 * Math.sin(heatWave * 3 + i * 2.1); drawElement(el, g, (i % 2 ? 1046 : 34) + Math.sin(heatWave * .5 + i * 3) * 20, 470 + i * 190 + Math.cos(heatWave * .4 + i) * 70, 58, 0); ctx.globalAlpha = 1; });   // flotte et clignote, dans les marges
    for (const bf of [{ c: '#FFD23F', c2: '#FF8A3D', x0: 50, y0: 760, a: 1.1, b: .7, ph: 0 }, { c: '#B26BFF', c2: '#3B9CFF', x0: 1035, y0: 800, a: .8, b: 1.3, ph: 2 }]) {   // dans les marges, le long des parois
      const x = bf.x0 + Math.sin(heatWave * bf.a + bf.ph) * 40, y = bf.y0 + Math.cos(heatWave * bf.b + bf.ph) * 170; const flap = Math.abs(Math.sin(heatWave * 14 + bf.ph)) * .8 + .2;
      if (el && el.fly) { drawElement(el, el.fly[el.fly.length > 1 && Math.sin(heatWave * (el.flap || 14) + bf.ph) < 0 ? 1 : 0], x, y, el.flySize || 84, Math.sin(heatWave * bf.a + bf.ph) * .3, el.fly.length > 1 ? 0 : flap); continue; }
      ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(heatWave * bf.a + bf.ph) * .3); ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3;
      for (const s of [-1, 1]) { ctx.save(); ctx.scale(s * flap, 1); ctx.fillStyle = bf.c; ctx.beginPath(); ctx.ellipse(18, -10, 20, 16, -.4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = bf.c2; ctx.beginPath(); ctx.ellipse(14, 12, 14, 11, .4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
      ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 16, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const bx = 90 + Math.cos(heatWave * 2.2) * 70, by = BOT + 10 + Math.sin(heatWave * 3.1) * 30, wf = Math.abs(Math.sin(heatWave * 40));   // autour du haut du verre de limonade
    ctx.save(); ctx.translate(bx, by); ctx.scale(Math.sin(heatWave * 2.2) > 0 ? -1 : 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(-3, -14, 10, 6 * wf + 2, -.3, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.ellipse(7, -14, 10, 6 * wf + 2, .3, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2); ctx.clip(); ctx.fillStyle = '#FFC533'; ctx.fillRect(-20, -14, 40, 28); ctx.fillStyle = '#3a2a1a'; ctx.fillRect(-7, -14, 5, 28); ctx.fillRect(4, -14, 5, 28); ctx.restore();
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, 0, 18, 12, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-12, -3, 3.5, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(-11, -3, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  // Les personnages au coin de la table : un par zone, mêmes expressions pour tous (kid.mood), seuls le teint et la coiffure changent.
  // `?kid=2` force le deuxième (1 à 6), quel que soit le niveau.
  const KIDS = [
    { skin: '#FFD9B3', line: '#B07A4A', freckles: '#C8865A', head: 'cap' },                                                       // Fraise : le gamin à casquette à hélice
    { skin: '#F6C9A0', line: '#A8683C', hair: '#7A3E1D', hairLine: '#4E2610', tie: '#FF6FA5', head: 'pigtails', lashes: true },   // Myrtille : la fillette aux couettes
    { skin: '#FBD3B0', line: '#B5805A', hair: '#DADDE5', hairLine: '#8E94A3', glasses: '#D6336C', head: 'bun', lashes: true },    // Pomme : la mamie à chignon et lunettes
    { skin: '#8D5A3B', line: '#5A3520', hair: '#2A1A14', hairLine: '#120A08', head: 'afro' },                                     // Citron : le garçon aux cheveux crépus
    { skin: '#E8B88A', line: '#9A6A3E', hair: '#F4F4F6', hairLine: '#9AA0AD', head: 'papi' },                                     // Cassis : le papi dégarni à moustache
    { skin: '#C68A5E', line: '#7E4E2C', hair: '#1E1A2B', hairLine: '#0C0A14', tie: '#FF8A3D', head: 'bob', lashes: true },        // Orange : la fille au carré, fleur dans les cheveux
  ];
  const kidLook = () => KIDS[(+URLP.kid >= 1 ? +URLP.kid - 1 : CHAPTERS.indexOf(theme())) % KIDS.length];
  function drawKid() {   // le personnage (tête ronde, joues roses, grands yeux à double reflet) passe la tête au coin de la table
    const K = kidLook(), m = URLP.mood !== undefined ? +URLP.mood : kid.mood, joy = m === 1 || m === 4 || m === 6;   // joy : cheveux, hélice et fleur s'agitent
    const hop = m === 6 ? Math.abs(Math.sin(heatWave * 8)) * 30 : kid.hop;   // fête : il saute sans s'arrêter
    const x = 985 + (m === 2 ? Math.sin(heatWave * 45) * 1.5 : 0), y = BOT + 152 - hop + (m === 7 ? 6 : 0), r = 62, skin = K.skin, dark = '#2b1d2e';   // inquiet : il tremble ; bâille : il s'affaisse
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, BOT + 214); ctx.clip();   // le bord de la nappe cache le bas
    if (K.head === 'pigtails') {   // couettes hautes, derrière la tête : elles se balancent, et s'agitent quand elle est ravie
      const sw = joy ? Math.sin(heatWave * 30) * 5 : Math.sin(heatWave * 3) * 1.5;
      ctx.lineWidth = 3;
      for (const s of [-1, 1]) {
        ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.beginPath(); ctx.arc(x + s * 54 + sw, y - 56 - Math.abs(sw) * .5, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = K.tie; ctx.strokeStyle = shade(K.tie, -.35); ctx.beginPath(); ctx.arc(x + s * 42, y - 44, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    } else if (K.head === 'bun') {   // chignon posé sur le haut du crâne : il tremblote quand elle est ravie
      const sw = joy ? Math.sin(heatWave * 30) * 4 : 0;
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x + sw, y - r - 8, 24, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (K.head === 'afro') {   // boule de cheveux crépus : contour en bosses, tracé puis rempli pour cacher les traits intérieurs
      const sw = joy ? 1 + Math.abs(Math.sin(heatWave * 20)) * .06 : 1;
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 6;
      for (const pass of [0, 1]) for (let i = 0; i <= 8; i++) { const a = Math.PI * (.95 + i * 1.1 / 8); ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r - 4) * sw, y + Math.sin(a) * (r - 4) * sw, 25, 0, Math.PI * 2); if (pass) ctx.fill(); else ctx.stroke(); }
    } else if (K.head === 'papi') {   // couronne de cheveux blancs sur les côtés
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3;
      for (const s of [-1, 1]) for (const [dx, dy, rr] of [[r - 2, -22, 15], [r + 2, -2, 17], [r - 4, 18, 14]]) { ctx.beginPath(); ctx.arc(x + s * dx, y + dy, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    } else if (K.head === 'bob') {   // carré : la masse de cheveux descend jusqu'au menton, derrière la tête
      const sw = joy ? Math.sin(heatWave * 30) * 3 : 0, hw = r + 11;
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 6, hw, Math.PI, 0);
      ctx.lineTo(x + hw + sw, y + 30); ctx.quadraticCurveTo(x + hw + sw, y + 46, x + hw - 18 + sw, y + 46); ctx.lineTo(x - hw + 18 + sw, y + 46); ctx.quadraticCurveTo(x - hw + sw, y + 46, x - hw + sw, y + 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = skin; ctx.strokeStyle = K.line; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,110,140,.5)'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 36, y + 16, 14, 9, 0, 0, Math.PI * 2); ctx.fill(); }
    if (K.freckles) { ctx.fillStyle = K.freckles; for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x + s * (30 + (i % 2) * 10), y + 12 + i * 5, 2, 0, Math.PI * 2); ctx.fill(); } }
    let tx = pointer.x, ty = pointer.y;   // le regard suit le doigt ; inquiet, il fixe la gelée la plus chaude
    if (m === 2) { const hb = blocks && blocks.reduce((a, b) => (b.state === 'idle' || b.state === 'drag') && (!a || b.heat > a.heat) ? b : a, null); if (hb) { tx = toSX(BOX.x + (hb.x + hb.bw / 2) * S); ty = toSY(BOX.y + (hb.y + hb.bh / 2) * S); } }
    const lx = clamp((tx - x) / 500, -1, 1) * 5, ly = clamp((ty - y) / 500, -1, 1) * 4;
    const puff = m === 3 && kid.t > .8;   // soulagé : il souffle d'abord (« ouf »), puis sourit
    for (const s of [-1, 1]) {
      const ex = x + s * 22, ey = y - 10;
      ctx.strokeStyle = dark; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (m === 1 || m === 6) { ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ex, ey + 6, 11, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); continue; }   // ^ ^
      if (m === 3) { ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(ex, ey - 6, 11, Math.PI * .15, Math.PI * .85); ctx.stroke(); continue; }   // yeux fermés, détendus
      if (m === 5) { ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(ex - s * 10, ey - 9); ctx.lineTo(ex + s * 8, ey); ctx.lineTo(ex - s * 10, ey + 9); ctx.stroke(); continue; }   // > < : il plisse les yeux
      if (m === 4) {   // yeux en étoiles
        const pulse = 1 + Math.sin(heatWave * 12) * .1; ctx.fillStyle = '#FFC533'; ctx.strokeStyle = '#B45309'; ctx.lineWidth = 3; ctx.beginPath();
        for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = (i % 2 ? 8 : 18) * pulse; ctx.lineTo(ex + Math.cos(a) * rr, ey + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex - 4, ey - 4, 3, 0, Math.PI * 2); ctx.fill(); continue;
      }
      ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ex, ey, 14, 17, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (K.lashes) { ctx.beginPath(); ctx.moveTo(ex + s * 11, ey - 11); ctx.lineTo(ex + s * 19, ey - 17); ctx.moveTo(ex + s * 14, ey - 5); ctx.lineTo(ex + s * 22, ey - 8); ctx.stroke(); }   // cils au coin de l'œil
      const px = m === -1 || m === 7 ? 0 : lx, py = m === -1 || m === 7 ? 6 : ly, pr = m === 2 ? 5 : 8;   // inquiet : petites pupilles
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(ex + px, ey + py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + px - pr * .38, ey + py - pr * .38, pr * .38, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(ex + px + pr * .38, ey + py + pr * .25, pr * .2, 0, Math.PI * 2); ctx.fill();
      if (m === 7) { ctx.fillStyle = skin; ctx.beginPath(); ctx.ellipse(ex, ey, 15.5, 18.5, 0, Math.PI, 0); ctx.fill(); ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 15, ey); ctx.lineTo(ex + 15, ey); ctx.stroke(); }   // paupières lourdes
      if (m === -1) { ctx.fillStyle = '#7dd3fc'; ctx.beginPath(); ctx.ellipse(ex + s * 12, ey + 22 + ((heatWave * 2 + (s + 1)) % 1) * 20, 4, 7, 0, 0, Math.PI * 2); ctx.fill(); }   // larmes
      if (m === -1 || m === 2) { ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(ex - 12, ey - 24 + (s < 0 ? 8 : 0)); ctx.lineTo(ex + 12, ey - 24 + (s < 0 ? 0 : 8)); ctx.stroke(); }   // sourcils inquiets
    }
    if (m === 2 || m === 3) {   // goutte de sueur sur la tempe : elle glisse (inquiet) ou s'envole (soulagé)
      const t = m === 2 ? (heatWave * .9) % 1 : 0, fly = m === 3 ? clamp(1.5 - kid.t, 0, 1) : 0;
      ctx.globalAlpha = m === 3 ? 1 - fly : 1; ctx.fillStyle = '#7dd3fc'; ctx.strokeStyle = '#0369a1'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(x - 46 - fly * 30, y - 22 + t * 26 - fly * 30, 6, 9, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath();
    if (m === 1 || m === 6) { ctx.fillStyle = dark; ctx.arc(x, y + 18, m === 6 ? 19 : 16, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.arc(x, y + (m === 6 ? 30 : 28), 8, 0, Math.PI * 2); ctx.fill(); }
    else if (m === -1) { ctx.arc(x, y + 36, 12, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    else if (m === 2) { for (let i = 0; i <= 8; i++) ctx.lineTo(x - 14 + i * 3.5, y + 27 + (i % 2 ? -3 : 3)); ctx.stroke(); }   // bouche qui tremble
    else if (puff) {   // « ouf » : petite bouche ronde et nuage de souffle
      ctx.fillStyle = dark; ctx.arc(x - 4, y + 27, 6, 0, Math.PI * 2); ctx.fill();
      const k = clamp((1.5 - kid.t) / .7, 0, 1); ctx.globalAlpha = 1 - k * .8; ctx.fillStyle = '#fff'; ctx.strokeStyle = '#9fd8ff'; ctx.lineWidth = 2;
      for (const [dx, dy, rr] of [[0, 0, 9], [-12, -4, 11], [-25, 2, 8]]) { ctx.beginPath(); ctx.arc(x - 28 - k * 34 + dx, y + 30 + dy, rr * (.6 + k * .6), 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    else if (m === 3) { ctx.arc(x, y + 14, 16, .12 * Math.PI, .88 * Math.PI); ctx.stroke(); }   // grand sourire apaisé
    else if (m === 4) { ctx.fillStyle = dark; ctx.ellipse(x, y + 29, 9, 11, 0, 0, Math.PI * 2); ctx.fill(); }   // bouche bée
    else if (m === 5) {   // dents serrées
      ctx.fillStyle = '#fff'; ctx.lineWidth = 3; ctx.roundRect(x - 17, y + 20, 34, 14, 6); ctx.fill(); ctx.stroke();
      ctx.lineWidth = 2; ctx.beginPath(); for (const d of [-8, 0, 8]) { ctx.moveTo(x + d, y + 21); ctx.lineTo(x + d, y + 33); } ctx.stroke();
    }
    else if (m === 7) {   // bâillement : la bouche s'ouvre et se referme lentement, « z » qui montent
      const k = .55 + .45 * Math.sin(heatWave * 1.6); ctx.fillStyle = dark; ctx.ellipse(x, y + 31, 9 + 3 * k, 5 + 10 * k, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.ellipse(x, y + 33 + 7 * k, 6, 3, 0, 0, Math.PI * 2); ctx.fill();
    }
    else { ctx.arc(x, y + 16, 12, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
    if (K.head === 'pigtails') {   // frange avec la raie sur le côté, au-dessus des yeux
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 1, Math.PI, 0);
      ctx.quadraticCurveTo(x + r - 8, y - 44, x - 10, y - 46); ctx.quadraticCurveTo(x - r + 6, y - 42, x - r - 1, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (K.head === 'bun') {   // cheveux gris séparés par une raie au milieu, lunettes rondes, rides du sourire
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 1, Math.PI * 1.06, Math.PI * 1.94);
      ctx.quadraticCurveTo(x + 30, y - 38, x, y - 52); ctx.quadraticCurveTo(x - 30, y - 38, x + Math.cos(Math.PI * 1.06) * (r + 1), y + Math.sin(Math.PI * 1.06) * (r + 1)); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = K.glasses; ctx.lineWidth = 4; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 22, y - 9, 21, 0, Math.PI * 2); ctx.stroke(); }
      ctx.beginPath(); ctx.moveTo(x - 3, y - 12); ctx.lineTo(x + 3, y - 12); ctx.stroke();
      ctx.strokeStyle = K.line; ctx.lineWidth = 2.5; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 14, y + 24, 14, s > 0 ? -.5 : Math.PI - .5, s > 0 ? .5 : Math.PI + .5); ctx.stroke(); }
    } else if (K.head === 'afro') {   // naissance des cheveux, haute sur le front
      ctx.fillStyle = K.hair; ctx.beginPath(); ctx.arc(x, y, r + 2, Math.PI * 1.1, Math.PI * 1.9); ctx.quadraticCurveTo(x, y - 66, x + Math.cos(Math.PI * 1.1) * (r + 2), y + Math.sin(Math.PI * 1.1) * (r + 2)); ctx.closePath(); ctx.fill();
    } else if (K.head === 'papi') {   // sourcils broussailleux (sauf inquiet : les sourcils sombres prennent le relais), moustache blanche, trois cheveux sur le crâne
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 2.5;
      if (m !== -1 && m !== 2) for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 23, y - 36 - (joy ? 4 : 0) + (m === 7 ? 4 : 0), 15, 6, s * -.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + s * 14, y + 13, 17, 8, s * .3, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.lineWidth = 3; ctx.lineCap = 'round'; const sw = joy ? Math.sin(heatWave * 30) * 4 : Math.sin(heatWave * 3) * 1.5;
      for (const d of [-9, 0, 9]) { ctx.beginPath(); ctx.moveTo(x + d, y - r + 1); ctx.quadraticCurveTo(x + d, y - r - 10, x + d * 1.6 + sw, y - r - 16); ctx.stroke(); }
    } else if (K.head === 'bob') {   // frange droite, fleur piquée sur le côté
      ctx.fillStyle = K.hair; ctx.strokeStyle = K.hairLine; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 1, Math.PI + .5, Math.PI * 2 - .5); ctx.closePath(); ctx.fill(); ctx.stroke();
      const fx0 = x + 40, fy0 = y - 48, rot = joy ? heatWave * 8 : Math.sin(heatWave * 2) * .2;
      ctx.fillStyle = K.tie; ctx.strokeStyle = shade(K.tie, -.35); ctx.lineWidth = 2; for (let i = 0; i < 5; i++) { const a = rot + i * Math.PI * 2 / 5; ctx.beginPath(); ctx.arc(fx0 + Math.cos(a) * 10, fy0 + Math.sin(a) * 10, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.arc(fx0, fy0, 6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      ctx.fillStyle = '#3B9CFF'; ctx.strokeStyle = '#1e5fb3'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y - 22, r - 4, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();   // casquette, visière vers le bac
      ctx.fillStyle = '#FFC533'; ctx.beginPath(); ctx.moveTo(x - r + 4, y - 24); ctx.lineTo(x - r - 34, y - 12); ctx.lineTo(x - r + 8, y - 4); ctx.closePath(); ctx.fill(); ctx.stroke();
      const spin = joy ? heatWave * 30 : heatWave * 3; ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x - 22 * Math.cos(spin), y - r - 16); ctx.lineTo(x + 22 * Math.cos(spin), y - r - 16); ctx.stroke(); ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x, y - r - 16, 4, 0, Math.PI * 2); ctx.fill();   // hélice
    }
    ctx.restore();
    if (m === 7) for (let i = 0; i < 3; i++) { const t = (heatWave * .5 + i / 3) % 1; text('z', x - 70 - t * 40 + Math.sin(t * 9) * 6, y - 50 - t * 80, { size: 26 + t * 22, color: '#fff', alpha: (1 - t) * .9 }); }
    ctx.fillStyle = skin; ctx.strokeStyle = K.line; ctx.lineWidth = 3;
    if (m === 6) for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(x + s * 70 + Math.sin(heatWave * 14 + s) * 5, y - 34 + Math.cos(heatWave * 14 + s) * 8, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }   // fête : les mains en l'air
    else for (const dx of [-52, 52]) { ctx.beginPath(); ctx.arc(x + dx, BOT + 216 - hop * .3, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }   // mains sur le bord de la nappe
  }
  function drawLemonade(h) {
    const x = 90, y = BOT + 150, gw = 100, gh = 170;   // centre du pied du verre, largeur, hauteur : en bas à gauche, sur la nappe (le bac agrandi occupe le côté droit)
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.12)'; ctx.beginPath(); ctx.ellipse(x + 6, y + 6, gw * .55, 14, 0, 0, Math.PI * 2); ctx.fill();
    const lvl = y - gh * .72; ctx.fillStyle = '#FFE066'; ctx.beginPath(); ctx.moveTo(x - gw / 2 + 6, lvl); ctx.lineTo(x + gw / 2 - 6, lvl); ctx.lineTo(x + gw / 2 - 14, y - 4); ctx.lineTo(x - gw / 2 + 14, y - 4); ctx.closePath(); ctx.fill();
    const ice = 30 * (1 - h * .92) + 3; ctx.fillStyle = 'rgba(225,246,255,.9)'; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2;   // glaçons qui fondent
    [[-18, lvl + 18], [16, lvl + 30]].forEach(([dx, yy]) => { roundRect(x + dx - ice / 2, yy - ice / 2, ice, ice, 6); ctx.fill(); ctx.stroke(); });
    ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.moveTo(x - gw / 2, y - gh); ctx.lineTo(x - gw / 2 + 12, y); ctx.lineTo(x + gw / 2 - 12, y); ctx.lineTo(x + gw / 2, y - gh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(x - gw / 2, y - gh); ctx.lineTo(x - gw / 2 + 12, y); ctx.lineTo(x + gw / 2 - 12, y); ctx.lineTo(x + gw / 2, y - gh); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(x, y - gh, gw / 2, 10, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#FF4D6D'; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x + 10, y - 30); ctx.lineTo(x + 34, y - gh - 50); ctx.stroke();   // paille
    const cx = x - gw / 2 + 4, cy = y - gh; ctx.fillStyle = '#FFD23F'; ctx.strokeStyle = '#F5B800'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.fill(); ctx.stroke();   // rondelle de citron
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 2; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18); ctx.stroke(); }
    if (h > .4) { ctx.fillStyle = 'rgba(200,235,255,.8)'; for (let i = 0; i < 4; i++) { const t = (heatWave * .5 + i * .27) % 1; ctx.beginPath(); ctx.ellipse(x - gw / 2 + 18 + i * 22, y - gh + 30 + t * 110, 4, 6, 0, 0, Math.PI * 2); ctx.fill(); } }   // condensation
    ctx.restore();
  }
  function drawHaze() {   // brume de chaleur : ondulations blanches qui montent sur le bac dans les 10 dernières secondes
    const k = clamp((10 - timeLeft) / 10, 0, 1);
    ctx.save(); ctx.globalAlpha = .2 * k; ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const yb = BOX.y - 40 + 1000 - ((heatWave * 70 + i * 143) % 1000); ctx.beginPath();
      for (let xx = FRAME.x - 20; xx <= FRAME.x + FRAME.w + 20; xx += 20) { const yy = yb + Math.sin(xx * .02 + heatWave * 5 + i) * 10; if (xx === FRAME.x - 20) ctx.moveTo(xx, yy); else ctx.lineTo(xx, yy); }
      ctx.stroke();
    }
    ctx.restore();
  }
  function drawSun(h) {
    const SM = FEATURES.summer; const x = SM ? W - 125 : W - 130, y = SM ? 200 : 230, r = (SM ? 100 : 70) + (SM ? 28 : 20) * h; const col = h > .6 ? '#FF7A3D' : '#FFD23F';   // plein été : gros soleil aux rayons longs
    ctx.save(); ctx.translate(x, y); ctx.rotate(heatWave * .3);
    ctx.strokeStyle = rgba(col, .8); ctx.lineWidth = 10; ctx.lineCap = 'round';
    const RL = SM ? 70 : 0;   // rayons plus longs en plein été
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(a) * (r + 18), Math.sin(a) * (r + 18)); ctx.lineTo(Math.cos(a) * (r + 40 + RL + (i % 2) * 22 + 10 * h), Math.sin(a) * (r + 40 + RL + (i % 2) * 22 + 10 * h)); ctx.stroke(); }
    ctx.restore();
    drawSunDisc(x, y, r, h, col);
    ctx.fillStyle = rgba('#ffffff', .35); ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .35, 0, Math.PI * 2); ctx.fill();
    if (FEATURES.sunFace) drawSunFace(x, y, r, h);
  }
  function drawSunDisc(x, y, r, h, col) {   // disque et halo (ombre floue, la plus coûteuse de l'écran) : une image par palier de chaleur (20 paliers), puis recopie
    const step = Math.round(h * 20), key = step + col; let sp = CACHE.sun[key];
    if (sp === undefined) {
      const SM = FEATURES.summer, hq = step / 20, rq = (SM ? 100 : 70) + (SM ? 28 : 20) * hq, blur = 40 + 60 * hq, M = Math.ceil(rq + blur * 2 + 8);
      sp = offscreen(2 * M, 2 * M); CACHE.sun[key] = sp || null;
      if (sp) { const c = sp.getContext('2d'); c.shadowColor = rgba(col, .8); c.shadowBlur = blur; c.fillStyle = col; c.beginPath(); c.arc(M, M, rq, 0, Math.PI * 2); c.fill(); sp.M = M; }
    }
    if (sp) ctx.drawImage(sp, x - sp.M, y - sp.M);
    else { ctx.save(); ctx.shadowColor = rgba(col, .8); ctx.shadowBlur = 40 + 60 * h; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  }
  // Le soleil personnage (même style de visage que les gelées) : sourire au départ, joues rouges et sourcils en V quand la chaleur monte,
  // puis bouche en « o » et souffle vers le bac (arcs blancs qui filent vers les gelées) dans le dernier tiers.
  function drawSunFace(x, y, r, h) {
    const dark = '#5a2a00', k = r / 80; const tx = MIDX, ty = BOX.y + 200; const d = Math.hypot(tx - x, ty - y), lx = (tx - x) / d * 6 * k, ly = (ty - y) / d * 6 * k;
    const mean = clamp((h - .3) / .5, 0, 1), blow = h > .7;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.fillStyle = rgba('#ff4040', .15 + .5 * mean); for (const sx of [-42, 42]) { ctx.beginPath(); ctx.ellipse(sx, 18, 16, 10, 0, 0, Math.PI * 2); ctx.fill(); }   // joues
    for (const sx of [-26, 26]) {   // yeux à double reflet, regard vers le bac
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx, -8, 15, 18 - 4 * mean, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(sx + lx, -8 + ly, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(sx + lx - 3, -11 + ly, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(sx + lx + 3, -6 + ly, 1.6, 0, Math.PI * 2); ctx.fill();
      if (mean > 0) { ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx - 16 * Math.sign(sx), -34 - 6 * mean); ctx.lineTo(sx + 14 * Math.sign(sx), -30 + 10 * mean); ctx.stroke(); }   // sourcils en V (méchant)
    }
    ctx.strokeStyle = dark; ctx.fillStyle = dark; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath();
    if (blow) { ctx.ellipse(lx * 2.5, 26 + ly * 2, 10, 13, 0, 0, Math.PI * 2); ctx.fill(); }   // bouche en « o »
    else if (mean > .5) { ctx.arc(0, 18, 22, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillRect(-16, 18, 32, 7); }   // grand sourire carnassier
    else { ctx.arc(0, 16, 16 + 6 * (1 - mean), .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
    ctx.restore();
    if (blow) {   // souffle : trois arcs qui filent du soleil vers le bac
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 8; ctx.lineCap = 'round';
      for (let i = 0; i < 3; i++) { const p = ((heatWave * 1.4 + i / 3) % 1); const px = lerp(x, tx, p * .8), py = lerp(y, ty, p * .8); const a = Math.atan2(ty - y, tx - x); ctx.globalAlpha = (1 - p) * .8; ctx.beginPath(); ctx.arc(px, py, 22 + 26 * p, a - 1, a + 1); ctx.stroke(); }
      ctx.restore();
    }
  }
  function drawThermo(h) {
    const x0 = FRAME.x - WALL, x1 = FRAME.x + FRAME.w + WALL, y = FEATURES.bigGates ? 250 : 268, hh = 34;   // remonté quand les trappes débordent de la paroi du haut
    ctx.save(); ctx.fillStyle = 'rgba(0,0,0,.12)'; roundRect(x0 + 4, y - hh / 2 + 6, x1 - x0, hh, hh / 2); ctx.fill();
    ctx.fillStyle = '#fff7e6'; roundRect(x0, y - hh / 2, x1 - x0, hh, hh / 2); ctx.fill();
    const w = (x1 - x0 - 8) * h; const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#FFC533'); g.addColorStop(.6, '#FF7A3D'); g.addColorStop(1, '#FF2D55');
    ctx.fillStyle = g; if (w > 2) { roundRect(x0 + 4, y - hh / 2 + 4, Math.max(hh - 8, w), hh - 8, (hh - 8) / 2); ctx.fill(); }
    ctx.strokeStyle = '#c2410c'; ctx.lineWidth = 4; roundRect(x0, y - hh / 2, x1 - x0, hh, hh / 2); ctx.stroke();
    ctx.restore();
    text(tr('CHALEUR'), x0 + 16, y, { size: 22, color: '#7c2d12', align: 'left', alpha: .8 });
    if (freezeT > 0 && state === 'play') text(tr('GELÉ') + ' ' + Math.ceil(freezeT) + ' s', x1 - 16, y, { size: 26, color: '#1d5fa8', align: 'right' });
    else if (started && state === 'play') text(Math.ceil(timeLeft) + ' s', x1 - 16, y, { size: 26, color: timeLeft < 10 ? '#ff2d55' : '#7c2d12', align: 'right' });
  }
  function drawTray(h) {
    const x = BOX.x - WALL, y = BOX.y - WALL, w = COLS * S + 2 * WALL, hh = ROWS * S + 2 * WALL, B = FEATURES.bakery;
    if (CACHE.trayKey !== boardKey) { CACHE.tray = null; CACHE.trayKey = boardKey; }   // redessiné quand la forme du bac change
    if (!CACHE.tray) { const M = 100; CACHE.tray = offscreen(w + 2 * M, hh + 2 * M); if (CACHE.tray) { const c = CACHE.tray.getContext('2d'); c.translate(M - x, M - y); drawTrayBase(c, x, y, w, hh, B); CACHE.tray.M = M; } }   // boîte : ombre floue, liserés, gaufrage, grille, une fois
    if (CACHE.tray) ctx.drawImage(CACHE.tray, x - CACHE.tray.M, y - CACHE.tray.M); else drawTrayBase(ctx, x, y, w, hh, B);
    for (const g of gates) drawGate(g);
    if (B && labelPos) {   // étiquette manuscrite collée sur une paroi libre
      const lx = BOX.x + (labelPos.i + 1) * S, ly = labelPos.wall === 1 ? BOX.y + ROWS * S + WALL / 2 + 2 : BOX.y - WALL / 2 - 2;
      ctx.save(); ctx.translate(lx, ly); ctx.rotate(-.05); ctx.shadowColor = 'rgba(0,0,0,.2)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = '#FFFDF7'; ctx.strokeStyle = '#D4A24C'; ctx.lineWidth = 3; roundRect(-96, -22, 192, 44, 8); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      text(tr('Gelées'), 0, 1, { size: 32, color: '#7c2d12', font: '"Segoe Script", "Brush Script MT", "Comic Sans MS", cursive' }); ctx.restore();
    }
  }
  function drawTrayBase(c, x, y, w, hh, B) {   // la boîte sans ses trappes ni son étiquette (c = contexte cible, coordonnées de jeu)
    const rr = (x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
    c.save(); c.shadowColor = 'rgba(120,60,0,.35)'; c.shadowBlur = 40; c.shadowOffsetY = 20; c.fillStyle = B ? '#EFDCB8' : '#FFF9EF'; rr(x, y, w, hh, 46); c.fill(); c.restore();
    if (B) {   // boîte de pâtisserie : carton crème (face plus claire en haut), double liseré doré, papier gaufré au fond
      const cg = c.createLinearGradient(0, y, 0, y + hh); cg.addColorStop(0, '#F9ECD2'); cg.addColorStop(1, '#E8D0A4'); c.fillStyle = cg; rr(x, y, w, hh, 46); c.fill();
      c.strokeStyle = '#D4A24C'; c.lineWidth = 6; rr(x + 9, y + 9, w - 18, hh - 18, 38); c.stroke();
      c.strokeStyle = 'rgba(212,162,76,.55)'; c.lineWidth = 2; rr(x + 19, y + 19, w - 38, hh - 38, 30); c.stroke();
      c.fillStyle = FEATURES.summer ? '#E6F7EC' : '#FBF3E4'; rr(BOX.x, BOX.y, COLS * S, ROWS * S, 10); c.fill();   // plein été : fond menthe, pour décoller de la nappe
      if (FEATURES.summer) { c.strokeStyle = '#6B3E1E'; c.lineWidth = 5; rr(x, y, w, hh, 46); c.stroke(); }   // contour cartoon de la boîte
      c.fillStyle = 'rgba(120,80,20,.07)'; for (let yy = BOX.y + 20; yy < BOX.y + ROWS * S; yy += 40) for (let xx = BOX.x + 20 + (Math.round(yy / 40) % 2) * 20; xx < BOX.x + COLS * S; xx += 40) { c.beginPath(); c.arc(xx, yy, 5, 0, Math.PI * 2); c.fill(); }
    } else { c.fillStyle = '#E4EEF6'; rr(BOX.x, BOX.y, COLS * S, ROWS * S, 10); c.fill(); }
    c.strokeStyle = B ? 'rgba(120,80,20,.09)' : 'rgba(30,60,90,.07)'; c.lineWidth = 2;
    for (let k = 1; k < COLS; k++) { c.beginPath(); c.moveTo(BOX.x + k * S, BOX.y); c.lineTo(BOX.x + k * S, BOX.y + ROWS * S); c.stroke(); }
    for (let k = 1; k < ROWS; k++) { c.beginPath(); c.moveTo(BOX.x, BOX.y + k * S); c.lineTo(BOX.x + COLS * S, BOX.y + k * S); c.stroke(); }
    const ig = c.createLinearGradient(0, BOX.y, 0, BOX.y + 60); ig.addColorStop(0, 'rgba(0,0,0,.14)'); ig.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = ig; c.fillRect(BOX.x, BOX.y, COLS * S, 60);
    if (!B) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 3; rr(x + 6, y + 6, w - 12, hh - 12, 42); c.stroke(); }
    // cases murées : le carton de la boîte remonte (même matière que les parois), liseré doré côté cases libres, ombre portée sur la case du dessous
    if (WALLS) {
      const wallAt = (r, k) => r < 0 || k < 0 || r >= ROWS || k >= COLS || isWall(r, k);
      for (let r = 0; r < ROWS; r++) for (let k = 0; k < COLS; k++) {
        if (!isWall(r, k)) continue; const X = BOX.x + k * S, Y = BOX.y + r * S;
        c.fillStyle = B ? '#C9A46C' : '#B8C4D0'; c.fillRect(X - 1, Y - 1, S + 2, S + 2);   // carton kraft, nettement plus soutenu que le fond menthe et que les parois crème : un obstacle, sans couleur vive (ce n'est pas une pièce du jeu)
        c.fillStyle = 'rgba(255,255,255,.16)'; c.fillRect(X + 14, Y + 14, S - 28, S - 28); c.strokeStyle = 'rgba(110,70,25,.16)'; c.lineWidth = 3; c.beginPath(); for (let d = 44; d < 2 * S - 28; d += 40) { c.moveTo(X + Math.max(14, d - S + 14), Y + Math.min(S - 14, d)); c.lineTo(X + Math.min(S - 14, d), Y + Math.max(14, d - S + 14)); } c.stroke();   // panneau central et fines hachures : du relief
        if (!wallAt(r + 1, k)) { const sg = c.createLinearGradient(0, Y + S, 0, Y + S + 26); sg.addColorStop(0, 'rgba(70,40,10,.4)'); sg.addColorStop(1, 'rgba(90,50,10,0)'); c.fillStyle = sg; c.fillRect(X, Y + S, S, 26); }
        c.strokeStyle = B ? '#8A5E2A' : '#7F8E9E'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath();
        if (!wallAt(r - 1, k)) { c.moveTo(X + 3, Y + 3); c.lineTo(X + S - 3, Y + 3); }
        if (!wallAt(r + 1, k)) { c.moveTo(X + 3, Y + S - 3); c.lineTo(X + S - 3, Y + S - 3); }
        if (!wallAt(r, k - 1)) { c.moveTo(X + 3, Y + 3); c.lineTo(X + 3, Y + S - 3); }
        if (!wallAt(r, k + 1)) { c.moveTo(X + S - 3, Y + 3); c.lineTo(X + S - 3, Y + S - 3); }
        c.stroke();
      }
    }
  }
  // Trappe. FEATURES.bigGates : elle déborde de la paroi vers l'extérieur (GATE.ext) et pose un seuil coloré dans le bac (GATE.lip), donc deux fois plus
  // épaisse. Gelée en main : « ok » (sa couleur, elle passe) = trappe qui pulse, chevrons qui défilent vers la sortie, seuil allumé ; « no » (sa couleur,
  // trop étroite) = trappe grisée barrée d'une croix rouge ; « dim » (autre couleur) = estompée. Sans gelée en main, toutes au repos.
  // SYMBOLE PAR COULEUR (réglage « Symboles des couleurs », pour les daltoniens : le reproche fait à Block Out!) : rond, triangle, carré, losange,
  // étoile, croix, dans l'ordre de la palette ; le même sur la gelée et sur sa trappe (à la place des chevrons).
  const symbolsOn = () => !FEATURES.clip && !!(global.Shell && Shell.save && Shell.save.settings && Shell.save.settings.symbols);
  function drawSymbol(color, x, y, r) {
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineWidth = r * .42; ctx.strokeStyle = 'rgba(40,20,10,.8)'; ctx.fillStyle = '#fff'; ctx.beginPath();
    const k = color % 6;
    if (k === 0) ctx.arc(0, 0, r, 0, Math.PI * 2);
    else if (k === 1) { ctx.moveTo(0, -r * 1.1); ctx.lineTo(r * 1.05, r * .8); ctx.lineTo(-r * 1.05, r * .8); ctx.closePath(); }
    else if (k === 2) ctx.rect(-r * .85, -r * .85, r * 1.7, r * 1.7);
    else if (k === 3) { ctx.moveTo(0, -r * 1.2); ctx.lineTo(r, 0); ctx.lineTo(0, r * 1.2); ctx.lineTo(-r, 0); ctx.closePath(); }
    else if (k === 4) { for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .5 : r * 1.2; ctx[i ? 'lineTo' : 'moveTo'](Math.cos(a) * q, Math.sin(a) * q); } ctx.closePath(); }
    else { const t = r * .38; ctx.moveTo(-t, -r); ctx.lineTo(t, -r); ctx.lineTo(t, -t); ctx.lineTo(r, -t); ctx.lineTo(r, t); ctx.lineTo(t, t); ctx.lineTo(t, r); ctx.lineTo(-t, r); ctx.lineTo(-t, t); ctx.lineTo(-r, t); ctx.lineTo(-r, -t); ctx.lineTo(-t, -t); ctx.closePath(); }
    ctx.stroke(); ctx.fill(); ctx.restore();
  }
  function drawGate(g) {
    const col = PALETTE[g.color]; let x, y, w, hh; const B = FEATURES.bakery, BG = FEATURES.bigGates, E = BG ? GATE.ext : 0;
    if (g.wall < 2) { x = BOX.x + g.i * S + 8; w = g.len * S - 16; y = g.wall === 0 ? BOX.y - WALL - E + 6 : BOX.y + ROWS * S + 2; hh = WALL + E - 8; }
    else { y = BOX.y + g.i * S + 8; hh = g.len * S - 16; x = g.wall === 2 ? BOX.x - WALL - E + 6 : BOX.x + COLS * S + 2; w = WALL + E - 8; }
    if (g.shut > .97 && !FEATURES.clip) return;
    const d = BG && drag && state === 'play' ? drag.b : null; const mode = !d ? 'idle' : d.color !== g.color ? 'dim' : fitsGate(d, g) ? 'ok' : 'no';
    const pulse = .5 + .5 * Math.sin(heatWave * 7);
    ctx.save();
    if (mode === 'dim') ctx.globalAlpha = .4;
    if (g.shut > 0 && !FEATURES.clip) ctx.globalAlpha *= 1 - g.shut;
    if (BG) {   // seuil : bande de la couleur de la trappe sur le sol du bac, devant l'ouverture (allumée si la gelée en main passe, rouge si elle ne passe pas)
      const L = GATE.lip; ctx.fillStyle = mode === 'no' ? 'rgba(229,48,60,.4)' : rgba(col, mode === 'ok' ? .45 + .3 * pulse : .3);
      if (g.wall === 0) ctx.fillRect(x, BOX.y, w, L); else if (g.wall === 1) ctx.fillRect(x, BOX.y + ROWS * S - L, w, L); else if (g.wall === 2) ctx.fillRect(BOX.x, y, L, hh); else ctx.fillRect(BOX.x + COLS * S - L, y, L, hh);
    }
    const glow = mode === 'ok' ? .6 + .4 * pulse : mode === 'no' ? 0 : Math.max(g.glow, g.flash);
    if (glow > .02) { ctx.shadowColor = col; ctx.shadowBlur = (BG ? 40 : 30) * glow; }
    ctx.fillStyle = mode === 'no' ? '#5a5a5a' : shade(col, -.45); roundRect(x, y, w, hh, B ? 6 : 12); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = mode === 'no' ? '#9a9a9a' : lerp(0, 1, g.flash) > .5 ? '#fff' : shade(col, mode === 'ok' ? .15 + .2 * pulse : g.glow * .25); roundRect(x + 5, y + 5, w - 10, hh - 10, B ? 4 : 9); ctx.fill();
    if (B && mode !== 'no') {   // fenêtre découpée dans le carton : rabat articulé sur le bord extérieur, entrouvert au repos, grand ouvert quand une gelée passe
      const open = clamp(.55 + .45 * Math.max(g.glow, g.flash * 1.5, mode === 'ok' ? 1 : 0), 0, 1); const th = (1 - open) * (g.wall < 2 ? hh : w);
      ctx.fillStyle = '#E8D0A4'; ctx.strokeStyle = '#D4A24C'; ctx.lineWidth = 2;
      if (g.wall === 0) { ctx.fillRect(x, y, w, th); ctx.strokeRect(x, y, w, th); } else if (g.wall === 1) { ctx.fillRect(x, y + hh - th, w, th); ctx.strokeRect(x, y + hh - th, w, th); }
      else if (g.wall === 2) { ctx.fillRect(x, y, th, hh); ctx.strokeRect(x, y, th, hh); } else { ctx.fillRect(x + w - th, y, th, hh); ctx.strokeRect(x + w - th, y, th, hh); }
    }
    const n = g.len, cx = x + w / 2, cy = y + hh / 2;
    if (mode === 'no') {   // croix rouge : « ta gelée ne passe pas ici »
      const s = BG ? 18 : 10; ctx.lineCap = 'round';
      for (const [lw, c] of [[BG ? 14 : 8, '#fff'], [BG ? 8 : 4, '#E5303C']]) { ctx.lineWidth = lw; ctx.strokeStyle = c; ctx.beginPath(); ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); ctx.stroke(); }
      ctx.restore(); return;
    }
    // chevrons vers l'extérieur (gros et qui défilent vers la sortie quand la gelée en main passe)
    ctx.strokeStyle = rgba('#ffffff', mode === 'ok' ? 1 : .8); ctx.lineWidth = BG ? 7 : 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const s = BG ? GATE.chevron : 9, run = mode === 'ok' ? ((heatWave * 2.2) % 1) * s * 1.2 - s * .6 : 0;
    for (let k = 0; k < n; k++) {
      const t = (k + .5) / n; const px0 = g.wall < 2 ? x + w * t : cx, py0 = g.wall < 2 ? cy : y + hh * t;
      if (symbolsOn()) { drawSymbol(g.color, px0, py0, 15); continue; }
      ctx.beginPath();
      if (g.wall === 0) { const yy = py0 - run; ctx.moveTo(px0 - s, yy + s * .6); ctx.lineTo(px0, yy - s * .6); ctx.lineTo(px0 + s, yy + s * .6); }
      else if (g.wall === 1) { const yy = py0 + run; ctx.moveTo(px0 - s, yy - s * .6); ctx.lineTo(px0, yy + s * .6); ctx.lineTo(px0 + s, yy - s * .6); }
      else if (g.wall === 2) { const xx = px0 - run; ctx.moveTo(xx + s * .6, py0 - s); ctx.lineTo(xx - s * .6, py0); ctx.lineTo(xx + s * .6, py0 + s); }
      else { const xx = px0 + run; ctx.moveTo(xx - s * .6, py0 - s); ctx.lineTo(xx + s * .6, py0); ctx.lineTo(xx - s * .6, py0 + s); }
      ctx.stroke();
    }
    ctx.restore();
  }
  // Lumière du soleil (FEATURES.sunMelt) : elle tombe du haut du bac, colonne par colonne, jusqu'à la première gelée ; dessous, c'est l'ombre.
  // Les colonnes voisines de même profondeur sont fusionnées pour un dessin propre ; léger scintillement.
  function drawSunlight() {
    ctx.save(); ctx.beginPath(); ctx.rect(BOX.x, BOX.y, COLS * S, ROWS * S); ctx.clip();
    const a = .9 + .1 * Math.sin(heatWave * 3);
    for (let c = 0; c < COLS;) {
      let c1 = c; while (c1 + 1 < COLS && sunDepth[c1 + 1] === sunDepth[c]) c1++;
      const depth = sunDepth[c]; const x = BOX.x + c * S, w = (c1 - c + 1) * S, y1 = BOX.y + depth * S;
      const g = ctx.createLinearGradient(0, BOX.y, 0, Math.max(y1, BOX.y + 1)); g.addColorStop(0, rgba('#FFD648', .5 * a)); g.addColorStop(1, rgba('#FFD648', depth >= ROWS ? .12 : .32 * a));
      ctx.fillStyle = g; ctx.fillRect(x, BOX.y, w, y1 - BOX.y);
      if (depth < ROWS) { ctx.fillStyle = rgba('#FFFFFF', .55 * a); ctx.fillRect(x + 4, y1 - 5, w - 8, 5); }   // liseré chaud là où la lumière frappe la gelée
      c = c1 + 1;
    }
    ctx.restore();
  }
  function fillBody(b, x0, y0, grow, color, c = ctx) {   // union des cases arrondies + ponts entre cases voisines (contour propre en dessinant l'union une fois en plus grand)
    c.fillStyle = color; const p = PAD - grow, r = Math.max(4, RADIUS + grow);
    const has = (r, c) => b.cells.some(([rr, cc]) => rr === r && cc === c);
    for (const [rr, cc] of b.cells) {
      c.beginPath(); c.roundRect(x0 + cc * S + p, y0 + rr * S + p, S - 2 * p, S - 2 * p, r); c.fill();
      if (has(rr, cc + 1)) c.fillRect(x0 + cc * S + S / 2, y0 + rr * S + p, S, S - 2 * p);
      if (has(rr + 1, cc)) c.fillRect(x0 + cc * S + p, y0 + rr * S + S / 2, S - 2 * p, S);
    }
  }
  // Une gelée donnée ne change jamais de forme ni de couleur : son corps (contour, liseré, dégradé, cœur), sa silhouette (pour l'ombre) et ses reflets
  // et grains de sucre sont dessinés une fois hors écran, puis recopiés sous les mêmes transformations (déformations de fonte, portage, échelle).
  function drawBlockBody(c, b, x0, y0, col, G, K) {
    const cx = x0 + b.bw * S / 2, cy = y0 + b.bh * S / 2;
    fillBody(b, x0, y0, K ? 7 : 5, shade(col, K ? -.5 : -.38), c);   // contour
    if (G) {
      fillBody(b, x0, y0, 0, 'rgba(255,255,255,.55)', c);   // liseré clair juste sous le contour
      const grad = c.createRadialGradient(cx - b.bw * S * .22, cy - b.bh * S * .28, 6, cx, cy, Math.max(b.bw, b.bh) * S * .8);
      grad.addColorStop(0, shade(col, .3)); grad.addColorStop(.55, col); grad.addColorStop(1, shade(col, -.18));
      fillBody(b, x0, y0, -5, grad, c);
      fillBody(b, x0, y0, -18, rgba(shade(col, -.25), .28), c);   // cœur plus dense : profondeur de la gélatine
    } else fillBody(b, x0, y0, 0, col, c);
    if (b.inner >= 0) { fillBody(b, x0, y0, -19, shade(PALETTE[b.inner], -.35), c); fillBody(b, x0, y0, -24, PALETTE[b.inner], c); fillBody(b, x0, y0, -34, rgba(shade(PALETTE[b.inner], .3), .5), c); }   // deux couches : le cœur a la couleur intérieure
  }
  function drawCrate(b, x0, y0, alpha) {   // caisse en bois : on ne voit ni la couleur ni le visage de la gelée qu'elle cache, seulement le nombre de sorties à attendre
    ctx.save(); ctx.globalAlpha *= alpha;
    fillBody(b, x0, y0, 6, '#6B4423'); fillBody(b, x0, y0, 0, '#C98F52'); fillBody(b, x0, y0, -11, '#DDA96C');
    ctx.strokeStyle = 'rgba(107,68,35,.5)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const [rr, cc] of b.cells) { const x = x0 + cc * S, y = y0 + rr * S; for (const f of [.34, .66]) { ctx.beginPath(); ctx.moveTo(x + 22, y + S * f); ctx.lineTo(x + S - 22, y + S * f); ctx.stroke(); } }
    if (b.ice > 0) { const cell = b.cells[b.face], k = 1 + 1.2 * b.iceT; text(String(b.ice), x0 + (cell[1] + .5) * S, y0 + (cell[0] + .5) * S, { size: 88 * k, color: '#fff', stroke: '#6B4423', strokeW: 14 }); }
    ctx.restore();
  }
  function drawBlockTop(c, b, x0, y0) {   // reflet gélatineux (bande claire en haut de chaque case sans voisine au-dessus, bande sombre en bas) et grains de sucre
    const has = (r, k) => b.cells.some(([rr, cc]) => rr === r && cc === k);
    for (const [rr, cc] of b.cells) {
      const x = x0 + cc * S, y = y0 + rr * S;
      if (!has(rr - 1, cc)) { c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.roundRect(x + PAD + 14, y + PAD + 10, S - 2 * PAD - 28, 22, 11); c.fill(); }
      if (!has(rr + 1, cc)) { c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.roundRect(x + PAD + 12, y + S - PAD - 26, S - 2 * PAD - 24, 16, 8); c.fill(); }
    }
    c.fillStyle = 'rgba(255,255,255,.75)'; for (const s of b.sugar) { c.beginPath(); c.arc(x0 + s.x, y0 + s.y, s.s, 0, Math.PI * 2); c.fill(); }
  }
  function blockSprites(b, col, G, K) {
    if (b.sprites !== undefined) return b.sprites;
    const M = 12, w = b.bw * S + 2 * M, hgt = b.bh * S + 2 * M, body = offscreen(w, hgt), sil = offscreen(w, hgt), top = offscreen(w, hgt);
    if (!body || !sil || !top) return (b.sprites = null);
    const c = body.getContext('2d'); c.translate(M, M); drawBlockBody(c, b, 0, 0, col, G, K);
    const s = sil.getContext('2d'); s.translate(M, M); fillBody(b, 0, 0, 0, G ? shade(col, -.3) : '#000', s);
    const t = top.getContext('2d'); t.translate(M, M); drawBlockTop(t, b, 0, 0);
    return (b.sprites = { body, sil, top, M });
  }
  function drawGoo(b, col) {   // filet de gelée qui s'étire entre la trappe et la gelée qui sort, puis se rompt
    const g = b.gate, p = b.exitT, k = 1 - p / .85; const x0 = BOX.x + b.x * S, y0 = BOX.y + b.y * S;
    let ax, ay, bx, by2, half;   // a : milieu de la trappe, b : milieu du bord arrière de la gelée, half : demi-largeur à la trappe
    if (g.wall < 2) { ax = x0 + b.bw * S / 2; ay = g.wall === 0 ? BOX.y - WALL / 2 : BOX.y + ROWS * S + WALL / 2; bx = ax; by2 = g.wall === 0 ? y0 + b.bh * S - PAD : y0 + PAD; half = b.bw * S * .3 * k; }
    else { ay = y0 + b.bh * S / 2; ax = g.wall === 2 ? BOX.x - WALL / 2 : BOX.x + COLS * S + WALL / 2; by2 = ay; bx = g.wall === 2 ? x0 + b.bw * S - PAD : x0 + PAD; half = b.bh * S * .3 * k; }
    ctx.save(); ctx.globalAlpha = .85 * k; ctx.fillStyle = col; ctx.beginPath();
    if (g.wall < 2) { ctx.moveTo(ax - half, ay); ctx.quadraticCurveTo(ax - half * .3, (ay + by2) / 2, bx - half * .25, by2); ctx.lineTo(bx + half * .25, by2); ctx.quadraticCurveTo(ax + half * .3, (ay + by2) / 2, ax + half, ay); }
    else { ctx.moveTo(ax, ay - half); ctx.quadraticCurveTo((ax + bx) / 2, ay - half * .3, bx, by2 - half * .25); ctx.lineTo(bx, by2 + half * .25); ctx.quadraticCurveTo((ax + bx) / 2, ay + half * .3, ax, ay + half); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  // Glaçon autour d'une gelée glacée, en deux passes : « under » (avant le corps) = le bord du glaçon qui dépasse tout autour ; ensuite, par-dessus le
  // visage, un givre translucide (la couleur et le visage de la gelée restent lisibles : la couleur sert à prévoir sa trappe), des reflets, et le nombre
  // de sorties à attendre (il grossit quand il change). Au dégel (b.thaw 1 → 0) le glaçon gonfle et s'efface.
  function drawIce(b, x0, y0, under) {
    ctx.save(); if (b.ice === 0) { ctx.globalAlpha *= b.thaw; const k = 1 + .25 * (1 - b.thaw), cx = x0 + b.bw * S / 2, cy = y0 + b.bh * S / 2; ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy); }
    if (under) { fillBody(b, x0, y0, 13, '#4f9fe6'); fillBody(b, x0, y0, 10, '#d9f0ff'); ctx.restore(); return; }
    fillBody(b, x0, y0, 4, 'rgba(200,230,255,.36)');
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (const [rr, cc] of b.cells) { const x = x0 + cc * S, y = y0 + rr * S; ctx.beginPath(); ctx.moveTo(x + 24, y + 56); ctx.lineTo(x + 56, y + 24); ctx.moveTo(x + 38, y + 72); ctx.lineTo(x + 48, y + 62); ctx.stroke(); }
    if (b.ice > 0) {   // le compte : au milieu d'une case qui n'est pas celle du visage (dans un coin pour une gelée d'une seule case)
      const one = b.cells.length === 1, cell = b.cells[one ? 0 : b.face === 0 ? 1 : 0], k = 1 + 1.2 * b.iceT;
      text(String(b.ice), x0 + (cell[1] + (one ? .76 : .5)) * S, y0 + (cell[0] + (one ? .27 : .5)) * S, { size: (one ? 56 : 88) * k, color: '#fff', stroke: '#1d5fa8', strokeW: one ? 10 : 14 });
    }
    ctx.restore();
  }
  function drawBlock(b, h) {
    const col = PALETTE[b.color]; const x0 = BOX.x + b.x * S, y0 = BOX.y + (b.y + (b.drop || 0)) * S;   // drop : hauteur de chute restante (entrée de niveau)
    const cx = x0 + b.bw * S / 2, cy = y0 + b.bh * S / 2, by = y0 + b.bh * S - PAD;
    if (b.crate && b.ice > 0) { ctx.save(); ctx.globalAlpha = b.alpha; ctx.translate(cx, cy); ctx.scale(b.sx * b.lift, b.sy * b.lift); ctx.translate(-cx, -cy); drawCrate(b, x0, y0, 1); ctx.restore(); return; }
    const G = FEATURES.glass, M = FEATURES.meltShow && b.melt > 0;
    if (M) {   // flaque qui s'étale sous la gelée (avant toute déformation), les flaques voisines se mélangent
      ctx.save(); ctx.globalAlpha = .8 * Math.min(1, b.melt * 1.4); ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, by + 8, b.bw * S * (.35 + .45 * b.melt), 14 + 22 * b.melt, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(cx - b.bw * S * .15, by + 2, b.bw * S * .15 * b.melt, 5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    const HT = FEATURES.sunMelt && b.melt === 0 && b.state !== 'exit' ? b.heat : 0;   // chaleur au soleil : petite flaque, affaissement, gouttes (avant la vraie fonte)
    if (HT > .25) { ctx.save(); const k = (HT - .25) / .75; ctx.globalAlpha = .55 * k; ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, by + 8, b.bw * S * (.25 + .3 * k), 8 + 14 * k, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    if (b.state === 'exit' && FEATURES.plate && b.gate && b.exitT < .85) drawGoo(b, col);
    ctx.save(); ctx.globalAlpha = b.alpha;
    if (b.melt > 0) { ctx.translate(cx, by); ctx.scale(1 + .4 * b.melt, 1 - (M ? .8 : .72) * b.melt); ctx.translate(-cx, -by); }
    else if (HT > 0) { ctx.translate(cx, by); ctx.scale(1 + .14 * HT, 1 - .12 * HT); ctx.translate(-cx, -by); }
    ctx.translate(cx, cy); ctx.scale(b.sx * b.lift, b.sy * b.lift); ctx.translate(-cx, -cy);
    // ombre (colorée et caustique si translucide)
    const K = FEATURES.contrast;   // contraste vidéo : ombre plus franche, contour plus épais et plus sombre
    const SP = blockSprites(b, col, G, K);   // corps, silhouette et reflets pré-dessinés (null en headless : dessin direct)
    ctx.save(); ctx.globalAlpha = b.alpha * (b.state === 'drag' ? (K ? .4 : .3) : (K ? .28 : .18)); ctx.translate(b.state === 'drag' ? 12 : (K ? 6 : 4), b.state === 'drag' ? 24 : (K ? 11 : 8)); if (SP) ctx.drawImage(SP.sil, x0 - SP.M, y0 - SP.M); else fillBody(b, x0, y0, 0, G ? shade(col, -.3) : '#000'); ctx.restore();
    if (G) { ctx.save(); ctx.globalAlpha = b.alpha * .35; ctx.fillStyle = shade(col, .55); ctx.beginPath(); ctx.ellipse(cx + 6, by + 10, b.bw * S * .36, 12, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }   // caustique : tache de lumière au sol
    if ((b.ice > 0 || b.thaw > 0) && !b.crate) drawIce(b, x0, y0, true);
    if (SP) ctx.drawImage(SP.body, x0 - SP.M, y0 - SP.M); else drawBlockBody(ctx, b, x0, y0, col, G, K);
    if (M) {   // gouttes qui coulent du bord bas (positions tirées du sucre, donc fixes)
      ctx.fillStyle = col; const has = (r, c) => b.cells.some(([rr, cc]) => rr === r && cc === c);
      b.cells.forEach(([rr, cc], i) => { if (has(rr + 1, cc)) return; for (let k = 0; k < 2; k++) { const s = b.sugar[i * 5 + k]; const t = Math.max(0, b.melt - .15 - k * .1); if (t <= 0) continue; const dy = t * (90 + k * 50); ctx.beginPath(); ctx.ellipse(x0 + s.x, y0 + (rr + 1) * S - PAD + dy, 7, 10 + t * 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x0 + s.x - 3, y0 + (rr + 1) * S - PAD - 4, 6, dy); } });
    }
    if (HT > SUN.warn) {   // gouttes qui perlent du bord bas d'une gelée qui chauffe
      ctx.fillStyle = col; const has = (r, c) => b.cells.some(([rr, cc]) => rr === r && cc === c); const t = (HT - SUN.warn) / (1 - SUN.warn);
      b.cells.forEach(([rr, cc], i) => { if (has(rr + 1, cc)) return; const s = b.sugar[i * 5]; const dy = 10 + 40 * t; ctx.beginPath(); ctx.ellipse(x0 + s.x, y0 + (rr + 1) * S - PAD + dy, 6, 8 + 5 * t, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(x0 + s.x - 2.5, y0 + (rr + 1) * S - PAD - 4, 5, dy); });
    }
    // au soleil : bande chaude en haut de chaque case exposée (sous le reflet, comme avant) ; puis reflets et sucre pré-dessinés
    if (FEATURES.sunMelt && b.sun > 0 && b.state !== 'exit') {
      const has = (r, c) => b.cells.some(([rr, cc]) => rr === r && cc === c);
      for (const [rr, cc] of b.cells) if (!has(rr - 1, cc)) { ctx.fillStyle = rgba('#FFE38A', .55 * b.sun); roundRect(x0 + cc * S + PAD + 6, y0 + rr * S + PAD + 3, S - 2 * PAD - 12, 30, 12); ctx.fill(); }
    }
    if (SP) ctx.drawImage(SP.top, x0 - SP.M, y0 - SP.M); else drawBlockTop(ctx, b, x0, y0);
    drawFace(b, x0 + (b.cells[b.face][1] + .5) * S, y0 + (b.cells[b.face][0] + .5) * S + (M ? 34 * b.melt : 0), h, col);   // en fondant, le visage glisse vers le bas
    if (symbolsOn()) { const cell = b.cells[b.face]; drawSymbol(b.color, x0 + (cell[1] + .8) * S, y0 + (cell[0] + .8) * S, 17); }
    if (b.thaw > 0 && b.crate) drawCrate(b, x0, y0, b.thaw); else if (b.ice > 0 || b.thaw > 0) drawIce(b, x0, y0, false);
    ctx.restore();
  }
  function drawFace(b, x, y, h, col) {
    const hot = FEATURES.sunMelt && b.melt === 0 && b.state !== 'exit' ? b.heat : 0;   // chaleur au soleil : inquiète dès SUN.warn, panique dès SUN.panic
    const worried = b.state !== 'exit' && b.melt === 0 && (h > .72 || b.mood === -1 || hot > SUN.warn), happy = b.mood === 2 || b.state === 'drag';
    const dark = '#2b1d2e'; const ex = 20, ey = -6;
    if ((FEATURES.meltShow && b.melt > 0 && b.melt <= .6) || (hot > SUN.panic && b.mood !== 2)) {   // panique : grands yeux, petites pupilles, sourcils levés, bouche ronde
      ctx.fillStyle = 'rgba(255,120,150,.45)'; for (const sx of [-34, 34]) { ctx.beginPath(); ctx.ellipse(x + sx, y + 14, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); }
      for (const sx of [-ex, ex]) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x + sx, y + ey, 17, 21, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x + sx, y + ey + 3, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x + sx, y + ey - 14, 14, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
      }
      ctx.fillStyle = dark; ctx.beginPath(); ctx.ellipse(x, y + 22, 8, 11, 0, 0, Math.PI * 2); ctx.fill(); return;
    }
    if (b.melt > (FEATURES.meltShow ? .6 : .3)) {   // yeux en croix
      ctx.strokeStyle = dark; ctx.lineWidth = 6; ctx.lineCap = 'round';
      for (const sx of [-ex, ex]) { ctx.beginPath(); ctx.moveTo(x + sx - 9, y + ey - 9); ctx.lineTo(x + sx + 9, y + ey + 9); ctx.moveTo(x + sx + 9, y + ey - 9); ctx.lineTo(x + sx - 9, y + ey + 9); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y + 22, 9, 0, Math.PI, true); ctx.stroke(); return;
    }
    // joues
    ctx.fillStyle = 'rgba(255,120,150,.45)'; for (const sx of [-34, 34]) { ctx.beginPath(); ctx.ellipse(x + sx, y + 14, 12, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    for (const sx of [-ex, ex]) {
      if (b.blinkT > 0 || b.mood === 2) { ctx.strokeStyle = dark; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); if (b.mood === 2) ctx.arc(x + sx, y + ey + 4, 10, Math.PI * 1.15, Math.PI * 1.85); else { ctx.moveTo(x + sx - 10, y + ey); ctx.lineTo(x + sx + 10, y + ey); } ctx.stroke(); continue; }
      const rw = happy ? 15 : 13, rh = happy ? 18 : 16;
      ctx.fillStyle = '#fff'; ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x + sx, y + ey, rw, rh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      const lx = b.look.x * 5, ly = b.look.y * 5;
      ctx.fillStyle = dark; ctx.beginPath(); ctx.arc(x + sx + lx, y + ey + ly, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x + sx + lx - 3, y + ey + ly - 3, 3.2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + sx + lx + 3, y + ey + ly + 2, 1.6, 0, Math.PI * 2); ctx.fill();
      if (worried) { ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x + sx - 12, y + ey - rh - (sx < 0 ? 12 : 4)); ctx.lineTo(x + sx + 12, y + ey - rh - (sx < 0 ? 4 : 12)); ctx.stroke(); }
    }
    ctx.strokeStyle = dark; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.fillStyle = dark; ctx.beginPath();
    if (b.mood === 2) { ctx.arc(x, y + 16, 14, 0, Math.PI); ctx.fill(); ctx.fillStyle = '#ff7a9a'; ctx.beginPath(); ctx.arc(x, y + 24, 7, 0, Math.PI * 2); ctx.fill(); }
    else if (worried) { ctx.moveTo(x - 12, y + 22); ctx.quadraticCurveTo(x - 6, y + 14, x, y + 22); ctx.quadraticCurveTo(x + 6, y + 30, x + 12, y + 22); ctx.stroke(); }
    else if (happy) { ctx.arc(x, y + 14, 12, .15 * Math.PI, .85 * Math.PI); ctx.stroke(); }
    else { ctx.arc(x, y + 14, 9, .2 * Math.PI, .8 * Math.PI); ctx.stroke(); }
    if (worried && (h > .72 || hot > SUN.warn)) {   // goutte de sueur qui descend le long de la tempe
      const t = (heatWave * 1.3 + b.id * .7) % 1; ctx.fillStyle = '#7dd3fc'; ctx.strokeStyle = '#0369a1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(x + 40, y - 28 + t * 30, 5, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  function drawOver() {
    ctx.fillStyle = 'rgba(60,20,0,.6)'; ctx.fillRect(0, 0, W, H);
    text(tr('FONDU !'), W / 2, H / 2 - 160, { size: 130, color: '#FFC533', stroke: '#7c2d12', strokeW: 18 });
    const why2 = tr(why === 'sun' ? 'Une gelée a fondu en plein soleil' : 'Trop chaud, les gelées ont fondu'), tip = tr('Mets-la à l’ombre ou sors-la plus tôt');
    text(why2, W / 2, H / 2 - 50, { size: C.fitSize(why2, 44, W - 100), color: '#fff' });   // réduit au besoin : les phrases anglaises sont plus longues
    if (why === 'sun') text(tip, W / 2, H / 2 + 10, { size: C.fitSize(tip, 34, W - 100), color: '#fff', alpha: .8 });
    drawBtn(RETRY_BTN, '#FF4D6D', tr('RECOMMENCER'));
    if (OFFER_RESCUE && !rescued) drawBtn(RESCUE_BTN, '#3B9CFF', tr('+ GLAÇONS · continuer (+{s} s)', { s: TIME.rescue }), 40);
  }
  function drawBtn(B, col, label, size = 52) {
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8; ctx.fillStyle = col; roundRect(B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, B.h / 2); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; roundRect(B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, B.h / 2); ctx.stroke();
    text(label, B.x, B.y, { size: C.fitSize(label, size, B.w - 40), color: '#fff', stroke: shade(col, -.4), strokeW: 8 });
  }

  // ------------------------------------------------------------ débogage / tests
  C.dbg = () => ({ level, state, why, t: +levelT.toFixed(1), timeLeft: +timeLeft.toFixed(1), timeTotal, started, blocks: blocks.filter(b => b.state !== 'gone').length, total: blocks.length, botHuman, botStyle, features: { clip: FEATURES.clip, loop: FEATURES.loop, hook: FEATURES.hook, level: shownLevel() }, finales, camZ: +cam.z.toFixed(2), rescued, stars: starsFor(), diff, drag: drag ? { id: drag.b.id, x: +drag.b.x.toFixed(2), y: +drag.b.y.toFixed(2) } : null, gates: gates.map(g => [g.wall, g.i, g.len, g.color].join(':')).join(' '), layout: blocks.map(b => b.state === 'gone' ? '-' : b.r + ',' + b.c).join(' '), heat: +Math.max(0, ...blocks.filter(b => b.state !== 'gone').map(b => b.heat)).toFixed(2), sunDepth: sunDepth.join(''), plan: plan ? plan.length : null, stats: Object.assign({}, stats, { detours: diff.detours, moves: diff.moves, blocks0: blocks.length, time: timeTotal }) });
  C.test = { level(n) { level = n; C.restart(); }, audioReady() { updateMusic(); return !A || !AUDIO || !AUDIO.music || !musicOn || !trackName || !!trackSrc; }, /* audioReady, pour l'outil de clips : lance le chargement du morceau de la zone et dit s'il joue */ boost(key, i) { if (key === 'ice') return useBoost('ice'); aim = key; useAim(blocks[i]); return true; }, gen(n) { const g = genLevel(n); return { d: g.detours, tries: g.tries, ms: g.ms, rej: g.rej0 || g.rej, fallback: !!g.rej0, board: g.M.board }; }, check(n) { const g = PRE && PRE[n - 1] ? unpackLevel(PRE[n - 1]) : genLevel(n); const s = solve(g.M, g.M.pos, 4000); return { ok: s.ok, detours: s.detours, ice: g.M.blocks.filter(b => b.ice).length }; }, pack(n) { return packLevel(genLevel(n)); }, solve(cap = GEN.nodes, exact = false) { const M = model(); const s = solve(M, M.pos, cap, exact); return { ok: s.ok, detours: s.detours, moves: s.plan.length, nodes: s.nodes, ms: Math.round(s.ms), blocks: M.blocks.length, gen: diff }; }, melt() { if (state === 'play') { started = true; timeLeft = 0; } }, tune(o) { Object.assign(TUNE, o); C.restart(); return Object.assign({}, TUNE); }, model, closure, TIME, GEN };
  const say = s => C.floatText(MIDX, MIDY, s, { color: '#fff', size: 72, dur: 1.4, vy: -70 });
  function onKey(k) {
    if (k === 'b') toggleMusic();
    else if (k === 'p') toggleBotStyle();
    else if (k === 'c') { FEATURES.clip = !FEATURES.clip; C.restart(); say(FEATURES.clip ? 'MODE CLIP' : 'MODE NORMAL'); }
    else if (k === 'l') { FEATURES.loop = !FEATURES.loop; say(FEATURES.loop ? 'BOUCLE' : 'BOUCLE COUPÉE'); }
    else if (k === 'x') { FEATURES.hook = FEATURES.hook + 1 >= HOOKS.length ? -1 : FEATURES.hook + 1; }
  }
  const ICE_ICON = '<svg viewBox="0 0 120 120"><rect x="14" y="14" width="92" height="92" rx="26" fill="#FF4D6D"/><circle cx="46" cy="64" r="7" fill="#3b1a1a"/><circle cx="74" cy="64" r="7" fill="#3b1a1a"/><path d="M50 82q10 8 20 0" fill="none" stroke="#3b1a1a" stroke-width="5" stroke-linecap="round"/><rect x="6" y="6" width="108" height="108" rx="30" fill="rgba(222,243,255,.62)" stroke="#60AAE8" stroke-width="8"/><path d="M26 54 54 26M40 70l10-10" stroke="#fff" stroke-width="8" stroke-linecap="round"/><text x="88" y="46" font-size="40" font-weight="900" text-anchor="middle" fill="#fff" stroke="#1d5fa8" stroke-width="7" paint-order="stroke">3</text></svg>';
  const ICONS = {
    walls: '<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="20" fill="#E6F7EC" stroke="#D4A24C" stroke-width="10"/><rect x="44" y="38" width="32" height="44" rx="6" fill="#F1DFBB" stroke="#D4A24C" stroke-width="6"/><rect x="18" y="80" width="26" height="22" rx="8" fill="#3B9CFF"/><rect x="78" y="20" width="24" height="24" rx="8" fill="#FF4D6D"/></svg>',
    layers: '<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="28" fill="#3B9CFF" stroke="#1d5fa8" stroke-width="6"/><rect x="32" y="32" width="56" height="56" rx="16" fill="#FF4D6D" stroke="#9f1239" stroke-width="5"/><circle cx="50" cy="56" r="6" fill="#3b1a1a"/><circle cx="70" cy="56" r="6" fill="#3b1a1a"/><path d="M52 70q8 7 16 0" fill="none" stroke="#3b1a1a" stroke-width="4" stroke-linecap="round"/></svg>',
    big: '<svg viewBox="0 0 120 120"><rect x="8" y="8" width="104" height="104" rx="18" fill="#E6F7EC" stroke="#D4A24C" stroke-width="8"/><g fill="#FF4D6D"><rect x="20" y="20" width="22" height="22" rx="7"/><rect x="74" y="74" width="26" height="22" rx="7"/></g><g fill="#3ED47E"><rect x="48" y="20" width="22" height="46" rx="7"/><rect x="20" y="74" width="46" height="22" rx="7"/></g><g fill="#FFC533"><rect x="76" y="20" width="22" height="46" rx="7"/><rect x="20" y="48" width="22" height="22" rx="7"/></g></svg>',
    crate: '<svg viewBox="0 0 120 120"><rect x="10" y="10" width="100" height="100" rx="18" fill="#C98F52" stroke="#6B4423" stroke-width="8"/><path d="M24 44h72M24 76h72" stroke="#6B4423" stroke-width="5" opacity=".55" stroke-linecap="round"/><text x="60" y="80" font-size="60" font-weight="900" text-anchor="middle" fill="#fff" stroke="#6B4423" stroke-width="8" paint-order="stroke">?</text></svg>',
    cubes: '<svg viewBox="0 0 120 120"><g stroke="#4f9fe6" stroke-width="7" stroke-linejoin="round"><rect x="14" y="44" width="56" height="56" rx="12" fill="#d9f0ff"/><rect x="52" y="18" width="52" height="52" rx="12" fill="#eef8ff" transform="rotate(12 78 44)"/></g><path d="M26 74 46 54M66 46l14-14" stroke="#fff" stroke-width="7" stroke-linecap="round"/></svg>',
    spoon: '<svg viewBox="0 0 120 120"><path d="M70 62 26 106" stroke="#8a8f98" stroke-width="12" stroke-linecap="round"/><ellipse cx="80" cy="42" rx="24" ry="30" transform="rotate(45 80 42)" fill="#e5e9ee" stroke="#8a8f98" stroke-width="7"/><ellipse cx="78" cy="40" rx="11" ry="15" transform="rotate(45 78 40)" fill="#FF4D6D"/></svg>',
    ladle: '<svg viewBox="0 0 120 120"><path d="M92 12v52" stroke="#8a8f98" stroke-width="11" stroke-linecap="round"/><path d="M22 62h76a38 38 0 0 1-76 0Z" fill="#e5e9ee" stroke="#8a8f98" stroke-width="7" stroke-linejoin="round"/><circle cx="46" cy="60" r="11" fill="#FF4D6D"/><circle cx="68" cy="58" r="11" fill="#FFC533"/><circle cx="58" cy="72" r="10" fill="#3ED47E"/></svg>',
  };
  C.start({ filmBg: ['#FFE0A3', '#FF9E5E'], init, update, draw, pointerDown, pointerMove, pointerUp, autoplay, onKey });
  if (FEATURES.autostart) C.setBot(true);
  // coquille : elle lance les niveaux (carte, « suivant », « rejouer ») et règle la musique
  if (global.Shell) Shell.register({
    startLevel(n) { level = n; C.restart(); },
    setMusic(on) { musicOn = !!on; if (musicGain) musicGain.gain.value = musicOn ? .7 : 0; },
    level: () => level,
    // état du son, affiché en petit en bas des réglages du client de dev (diagnostic sur téléphone, où il n'y a pas de console)
    audioInfo: () => (A ? A.state : 'fermé') + ' · ' + (!AUDIO || !AUDIO.music ? 'générée' : trackSrc ? trackName.replace(/.mp3$/, '') : trackName ? 'chargement' : Object.keys(trackFail).length ? 'échec ×' + Math.max(...Object.values(trackFail)) : 'en attente'),
    hard: hardOf, chapter: chapterOf, symbols: true, useBoost,
    news: [
      { level: WALLS_FROM, key: 'walls', icon: ICONS.walls, title: { fr: 'Bac biscornu', en: 'Odd-shaped box' },
        text: { fr: 'Le bac change de forme : des murs barrent le passage. À toi de les contourner.', en: 'The box changes shape: walls get in the way. Find your way around them.' } },
      { level: ICE_FROM, key: 'ice', icon: ICE_ICON, title: { fr: 'Gelée glacée', en: 'Frozen jelly' },
        text: { fr: 'Elle est prise dans la glace ! Fais sortir d’autres gelées pour la libérer : le chiffre dit combien.', en: 'It’s stuck in ice! Get other jellies out to free it: the number tells you how many.' } },
      { level: LAYER_FROM, key: 'layers', icon: ICONS.layers, title: { fr: 'Gelée à deux couches', en: 'Two-layer jelly' },
        text: { fr: 'Amène-la d’abord à la trappe de sa couleur extérieure : la couche part. Puis à la trappe de la couleur du cœur.', en: 'Take it to the gate of its outer color first: the layer comes off. Then to the gate of its core color.' } },
      { level: BIG_FROM, key: 'big', icon: ICONS.big, title: { fr: 'Grand bac', en: 'Big box' },
        text: { fr: 'Plus de place, plus de gelées : le bac s’agrandit et les gelées rapetissent.', en: 'More room, more jellies: the box grows and the jellies shrink.' } },
      { level: CRATE_FROM, key: 'crate', icon: ICONS.crate, title: { fr: 'Caisse mystère', en: 'Mystery crate' },
        text: { fr: 'Une gelée se cache dans la caisse. Elle s’ouvre quand assez de gelées sont sorties : le chiffre dit combien.', en: 'A jelly hides in the crate. It opens once enough jellies are out: the number tells you how many.' } },
    ],
    boosts: [
      { key: 'ice', level: 6, cost: 120, icon: ICONS.cubes, title: { fr: 'Glaçons', en: 'Ice cubes' },
        text: { fr: 'Arrête la chaleur pendant 10 secondes et rafraîchit toutes les gelées.', en: 'Stops the heat for 10 seconds and cools every jelly down.' } },
      { key: 'spoon', level: 13, cost: 250, icon: ICONS.spoon, title: { fr: 'Cuillère', en: 'Spoon' },
        text: { fr: 'Touche une gelée : elle saute dans l’assiette.', en: 'Tap a jelly: it jumps onto the plate.' } },
      { key: 'ladle', level: 18, cost: 400, icon: ICONS.ladle, title: { fr: 'Louche', en: 'Ladle' },
        text: { fr: 'Touche une gelée : toutes celles de sa couleur sautent dans l’assiette.', en: 'Tap a jelly: every jelly of that color jumps onto the plate.' } },
    ],
  });
})(window);
