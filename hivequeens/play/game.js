/* Hive Queens (dossier reines, 9 oct. 2026 ; habillage ruche du 10 oct.) — casse-tête de logique à grille, premier jeu de la série « un jeu par semaine » (étude de marché du 9 oct. 2026).
   RÈGLE : une reine par ligne, par colonne et par zone de couleur ; deux reines ne se touchent jamais, même en coin.
   GESTE (celui du genre) : toucher une case = croix, toucher encore = reine, encore = vide ; glisser = poser (ou effacer) des croix.
   Ce qui le distingue des meneurs (Meowdoku, Queens Master) : pas de vies, croix automatiques, indice qui EXPLIQUE le raisonnement,
   toutes les grilles à solution unique trouvable sans deviner (reines/logique.js, niveaux fabriqués par tools/reines-niveaux.js).
   HABILLAGE : une ruche. Chaque zone est un rayon de miel de couleur (une alvéole par case), la pièce est une reine des abeilles (reine.webp).
   Le plateau (fond, zones, traits) est dessiné une fois par niveau hors écran ; chaque image ne redessine que les croix, les reines et les textes. */
(function (global) {
  const C = global.Core, L = global.Logique, NIV = global.NIVEAUX, { W, H, ctx, tr } = C, { VIDE, REINE, CROIX } = L;
  C.i18n({
    'Une reine par ligne, par colonne et par zone de couleur.': 'One queen in every row, column and color zone.',
    'Deux reines ne se touchent jamais, même en coin.': 'Two queens never touch, not even diagonally.',
    'ANNULER': 'UNDO', 'CROIX AUTO': 'AUTO X', 'OUI': 'ON', 'NON': 'OFF', 'DIFFICILE': 'HARD', 'RÉSOLU !': 'SOLVED!',
    'Il ne reste qu’une case libre dans cette ligne : c’est une reine.': 'Only one free cell is left in this row: it’s a queen.',
    'Il ne reste qu’une case libre dans cette colonne : c’est une reine.': 'Only one free cell is left in this column: it’s a queen.',
    'Il ne reste qu’une case libre dans cette zone : c’est une reine.': 'Only one free cell is left in this zone: it’s a queen.',
    'Cette zone tient dans une seule ligne : sa reine y sera. Le reste de la ligne est exclu.': 'This zone fits in a single row: its queen goes there. The rest of the row is ruled out.',
    'Cette zone tient dans une seule colonne : sa reine y sera. Le reste de la colonne est exclu.': 'This zone fits in a single column: its queen goes there. The rest of the column is ruled out.',
    'Ces {m} zones tiennent dans {m} lignes : elles en prennent toutes les reines. Le reste de ces lignes est exclu.': 'These {m} zones fit in {m} rows: they take all their queens. The rest of those rows is ruled out.',
    'Ces {m} zones tiennent dans {m} colonnes : elles en prennent toutes les reines. Le reste de ces colonnes est exclu.': 'These {m} zones fit in {m} columns: they take all their queens. The rest of those columns is ruled out.',
    'Les cases libres de cette ligne sont toutes dans la même zone : le reste de la zone est exclu.': 'The free cells of this row are all in the same zone: the rest of the zone is ruled out.',
    'Les cases libres de cette colonne sont toutes dans la même zone : le reste de la zone est exclu.': 'The free cells of this column are all in the same zone: the rest of the zone is ruled out.',
    'Les cases libres de ces {m} lignes sont dans {m} zones seulement : le reste de ces zones est exclu.': 'The free cells of these {m} rows lie in only {m} zones: the rest of those zones is ruled out.',
    'Les cases libres de ces {m} colonnes sont dans {m} zones seulement : le reste de ces zones est exclu.': 'The free cells of these {m} columns lie in only {m} zones: the rest of those zones is ruled out.',
    'Une reine ici ne laisserait aucune case libre dans cette ligne : case exclue.': 'A queen here would leave no free cell in this row: ruled out.',
    'Une reine ici ne laisserait aucune case libre dans cette colonne : case exclue.': 'A queen here would leave no free cell in this column: ruled out.',
    'Une reine ici ne laisserait aucune case libre dans cette zone : case exclue.': 'A queen here would leave no free cell in this zone: ruled out.',
    'Une reine ici mène à une impasse quelques coups plus loin : case exclue.': 'A queen here leads to a dead end a few moves later: ruled out.',
    'Voici une reine.': 'Here is a queen.', 'Ces cases étaient fausses : elles sont effacées.': 'These cells were wrong: they have been cleared.',
    'COMMENT JOUER': 'HOW TO PLAY', 'PASSER': 'SKIP', 'À TOI DE JOUER !': 'YOUR TURN!', 'Touche-la deux fois.': 'Tap it twice.', 'Cette zone n’a qu’une case : sa reine est ici.': 'This zone has only one cell: its queen goes here.', 'Encore une fois !': 'Once more!',
    'Une reine barre sa ligne, sa colonne, sa zone et les cases qui la touchent. Touche l’écran pour continuer.': 'A queen crosses out its row, its column, its zone and the cells touching it. Tap the screen to continue.',
    'Astuce : touche une fois pour barrer une case, glisse pour en barrer plusieurs.': 'Tip: tap once to cross out a cell, drag to cross out several.',
    'PREMIERS PAS': 'FIRST STEPS', 'GRILLES {n} × {n}': '{n} × {n} GRIDS', 'RUCHER {n}': 'APIARY {n}', 'GRILLE DU JOUR': 'DAILY PUZZLE',
    'Il y a {n} erreur sur le plateau.': 'There is {n} mistake on the board.', 'Il y a {n} erreurs sur le plateau.': 'There are {n} mistakes on the board.', 'Tout est juste jusqu’ici.': 'Everything is right so far.',
  });

  // ------------------------------------------------------------ réglages
  const ZONES = ['#F7C948', '#F29E6D', '#9CCBEE', '#A9D99A', '#F3A6BE', '#C9B3EE', '#EFE3C2', '#E8806E', '#86D3C3', '#C9A27C', '#AEB9F2'];   // une couleur de miel par rayon (pastels, lisibles sous une croix sombre)
  const BOARD = { x: 40, y: 330, s: 1000 }, INK = '#3a2408';
  const BTN = { undo: { x: 290, y: 1432, w: 440, h: 104 }, auto: { x: 790, y: 1432, w: 440, h: 104 } };
  const PANEL = { x: 60, y: 1510, w: W - 120, h: 262 };   // explication de l'indice (la rangée des aides de la coquille est en dessous)

  let level = 1, lv, G, n, cell, p, auto, bad, sol, hist, state, elapsed, hintsUsed, hint, drag, anim, wonT, musicOn = true, autoX = true, tuto = null, sansTuto = false, lance = !global.Shell;   // lance : un niveau a été lancé (avant, le jeu n'est que le fond de l'écran titre : pas de textes)
  let fond = null, fondKey = '', crown = null;

  // ------------------------------------------------------------ niveau
  // TUTORIEL (10 oct. 2026) : au premier lancement du niveau 1, une petite grille guidée de bout en bout. Le joueur pose lui-même les quatre reines :
  // seule la case montrée répond, chaque coup est expliqué (les mêmes phrases que l'indice), une pause montre ce qu'une reine barre. Ensuite le vrai
  // niveau 1 commence. Retenu dans la sauvegarde de la coquille (tuto['reines.tuto']) ; « PASSER » le saute.
  const TUTO = { n: 4, z: 'BBAADAACDAAADAAA', d: 4, r: 1 };
  const tutoDu = () => level === 1 && !sansTuto && !!global.Shell && !!Shell.ready && !!Shell.save && !!Shell.save.tuto && !Shell.save.tuto['reines.tuto'] && !C.bot.active && !global.ART && !C.KIT.clip;
  const ax = () => autoX || !!tuto;   // croix automatiques : toujours pendant le tutoriel
  function tutoCible() {
    const e = prochaine(), hl = new Uint8Array(G.N); for (const i of e.unit ? e.unit.cells : []) hl[i] = 1;
    tuto.phase = 'pose'; tuto.cell = e.place[0]; hl[tuto.cell] = 1;
    const debut = !p.includes(REINE);
    hint = { text: (debut ? tr('Cette zone n’a qu’une case : sa reine est ici.') : texteIndice(e)) + ' ' + tr('Touche-la deux fois.'), cells: [tuto.cell], hl, band: null };
  }
  function tutoToucher(x, y) {
    if (tuto.phase === 'regle') { snd.croix(); tutoCible(); return; }
    const i = cellAt(x, y); if (i !== tuto.cell) return;
    toucher(i);
    if (p[i] !== REINE) { hint.text = tr('Encore une fois !'); return; }
    ranger(); if (state !== 'play') return;
    if (p.filter(v => v === REINE).length > 1) return tutoCible();
    const hl = new Uint8Array(G.N); for (let j = 0; j < G.N; j++) hl[j] = auto[j] || p[j] === REINE ? 1 : 0;
    tuto.phase = 'regle'; hint = { text: tr('Une reine barre sa ligne, sa colonne, sa zone et les cases qui la touchent. Touche l’écran pour continuer.'), cells: [], hl, band: null };
  }
  function tutoFini() { tuto = null; if (global.Shell) Shell.hintDone('reines.tuto'); C.restart(); }
  // NIVEAUX SANS FIN (10 oct. 2026) : après le dernier niveau du fichier, le jeu fabrique lui-même la grille du niveau, toujours la même pour un numéro
  // donné (graine = le numéro, voir fabrication dans logique.js) et sur la même vague de difficulté que la fin du fichier (L.vague).
  const DEC = global.NIVEAUX_DECILES || {};
  let auDela = null;   // dernier niveau fabriqué (un « recommencer » ne le refabrique pas)
  function niveauAuDela(k) {
    if (auDela && auDela.k === k) return auDela.lv;
    const c = L.vague(k), x = L.choisir(10, 7919 * k + 10, L.scoreVise(DEC[10], c.p), 3);
    auDela = { k, lv: { n: 10, z: x.z, d: x.score, r: x.rang, h: c.h } }; return auDela.lv;
  }
  const difficile = k => k <= NIV.length ? (NIV[k - 1].h ? 1 : 0) : L.vague(k).h;
  // GRILLE DU JOUR (10 oct. 2026) : une grille par date (graine = la date du téléphone). La coquille tient la série de jours et la récompense
  // (Shell.dailyWon) ; ici, seulement la grille et le mode de jeu.
  // À LA MESURE DU JOUEUR (12 oct. 2026) : la grille a la taille des grilles de son niveau le plus haut (de 5 × 5 à 10 × 10) et sa difficulté monte avec
  // cette taille (un débutant reçoit une grille facile) ; le décor et la musique sont ceux de la zone de ce niveau. Deux joueurs de la même zone ont
  // la même grille ; `haut` : ce niveau, donné par la coquille (daily.start).
  let daily = null, haut = 1;
  const zoneDe = () => daily ? haut : level;   // niveau dont on montre la zone (décor, musique)
  const jour = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
  const tailleDuJour = () => Math.max(5, Math.min(10, haut <= NIV.length ? NIV[haut - 1].n : 10));
  function grilleDuJour(j, k) { const x = L.choisir(k, j * 31 + k, L.scoreVise(DEC[k], k <= 6 ? .4 : k === 7 ? .55 : .65), k < 10 ? 4 : 3); return { n: k, z: x.z, d: x.score, r: x.rang, h: 0 }; }
  function startDaily(top) { lance = true; haut = Math.max(1, top | 0 || haut); const j = jour(), k = tailleDuJour(); daily = { j, k, lv: daily && daily.j === j && daily.k === k ? daily.lv : grilleDuJour(j, k) }; C.restart(); }
  let defiVu = false, cacheX = false, defiT = -1, fauxEtape = 0, fauxFx = null, carte = '', mielT = -1, mielVu = false;   // clips « défi » et « faux coup », carte de fin (voir le robot, plus bas)
  // EFFETS (10 oct. 2026) : la reine arrive en volant et s'écrase un peu (T_POSE : durée du vol), ses croix automatiques partent d'elle en vague
  // (autoT : instant où chaque croix apparaît) avec un tic qui monte, chaque reine joue la note suivante d'une gamme (GAMME, demi-tons), sa zone
  // s'illumine (eclats), et à la victoire les reines sautent en vague sous un reflet de miel, avec un léger zoom.
  const T_POSE = .16, GAMME = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21]; let autoT = null, eclats = [], pose = -1;
  // la note est fabriquée ici (le « ding » enregistré est un bruit de jeton, sans hauteur) : une lame douce, sol majeur pentatonique à partir du sol 4
  function note(k, o = {}) {
    const a = C.audio(); if (!a.ctx) return false;
    const f = 392 * Math.pow(2, GAMME[k % GAMME.length] / 12), t = a.ctx.currentTime + (o.delay || 0), v = .3 * (o.vol === undefined ? 1 : o.vol);
    for (const [m, g, d] of [[1, 1, .75], [2, .28, .4], [3, .08, .22]]) {
      const os = a.ctx.createOscillator(), ga = a.ctx.createGain(); os.type = 'sine'; os.frequency.value = f * m;
      ga.gain.setValueAtTime(.0001, t); ga.gain.exponentialRampToValueAtTime(v * g, t + .006); ga.gain.exponentialRampToValueAtTime(.0001, t + d);
      os.connect(ga); ga.connect(a.master); os.start(t); os.stop(t + d + .05);
    }
    return true;
  }
  function init() {
    tuto = !daily && tutoDu() ? { phase: 'pose', cell: -1 } : null;
    lv = tuto ? TUTO : daily ? daily.lv : level <= NIV.length ? NIV[level - 1] : niveauAuDela(level); n = lv.n; G = L.grille(n, 1, lv.z); cell = BOARD.s / n;
    p = new Uint8Array(G.N); auto = new Uint8Array(G.N); bad = new Uint8Array(G.N); anim = new Float32Array(G.N).fill(-9); autoT = new Float32Array(G.N).fill(-9); eclats = []; pose = -1;
    sol = L.resoudre(G).s; hist = []; state = 'play'; elapsed = 0; hintsUsed = 0; hint = null; drag = null; wonT = 0; fondKey = '';
    if (tuto) tutoCible();
    mielT = MIEL ? C.time : -1; mielVu = false; defiVu = false; defiT = -1; fauxEtape = 0; fauxFx = null; carte = ''; cacheX = DEFI > 0 && !tuto; if (cacheX) { for (let g = 0; g < 400 && Array.from(p).filter(v => v === REINE).length < n - DEFI; g++) { const e = prochaine(); for (const i of e.place || []) p[i] = REINE; for (const i of e.out || []) p[i] = CROIX; ranger(); } }
  }
  const centre = i => ({ x: BOARD.x + (i % n + .5) * cell, y: BOARD.y + ((i / n | 0) + .5) * cell });
  const cellAt = (x, y) => { const c = Math.floor((x - BOARD.x) / cell), r = Math.floor((y - BOARD.y) / cell); return c >= 0 && c < n && r >= 0 && r < n ? r * n + c : -1; };
  const vu = i => p[i] === REINE ? REINE : cacheX ? VIDE : p[i] === CROIX || (ax() && auto[i]) ? CROIX : VIDE;   // ce que le joueur voit dans la case
  // croix automatiques (voisines d'une reine, reste de sa ligne, de sa colonne et de sa zone) et reines en conflit
  function ranger() {
    const avant = auto.slice(), src = pose; pose = -1; auto.fill(0); bad.fill(0);
    const q = []; for (let i = 0; i < G.N; i++) if (p[i] === REINE) q.push(i);
    for (const i of q) { for (const j of G.nb[i]) { if (p[j] === REINE) bad[i] = 1; else auto[j] = 1; } for (const ui of G.of[i]) for (const j of G.units[ui].cells) if (j !== i) { if (p[j] === REINE) bad[i] = 1; else auto[j] = 1; } }
    const vol = src >= 0 && p[src] === REINE, t0 = C.time + (vol ? T_POSE : 0); let loin = 0;
    for (let j = 0; j < G.N; j++) if (auto[j] && !avant[j]) { const d = vol ? Math.max(Math.abs(j % n - src % n), Math.abs((j / n | 0) - (src / n | 0))) : 0; autoT[j] = t0 + d * .045; if (d > loin) loin = d; }
    if (vol && !bad[src]) {
      eclats.push({ reg: G.reg[src], t: t0 });
      if (ax() && !cacheX) for (let d = 1; d <= loin; d++) C.playSample('croix', { rate: .85 + d * .06, vol: C.KIT.hook >= 0 ? .12 : .4, delay: T_POSE + d * .045 });
    }
    if (state === 'play' && q.length === n && !bad.includes(1)) gagner();
  }
  // état du joueur vu par le raisonnement (seulement si rien n'est faux) : reines posées et rangées, croix du joueur
  function etatLogique() {
    const s = new Uint8Array(G.N);
    for (let i = 0; i < G.N; i++) if (p[i] === REINE) L.poser(G, s, i);
    for (let i = 0; i < G.N; i++) if (p[i] === CROIX && s[i] === VIDE) s[i] = CROIX;
    return s;
  }
  const faux = () => { const a = []; for (let i = 0; i < G.N; i++) if ((p[i] === REINE) !== (sol[i] === REINE) && p[i] !== VIDE) a.push(i); return a; };
  function prochaine() {   // prochaine déduction, ou une reine donnée si aucun raisonnement connu ne s'applique
    let e = L.etape(G, etatLogique(), 4);
    if (!e || e.t === 'faux') { const i = sol.findIndex((v, j) => v === REINE && p[j] !== REINE); e = { t: 'don', place: [i] }; }
    return e;
  }

  // ------------------------------------------------------------ gestes
  function pointerDown(x, y) {
    if (tuto) { const B = BTN.auto; if (Math.abs(x - B.x) < B.w / 2 && Math.abs(y - B.y) < B.h / 2) { C.sfx.click(); return tutoFini(); } if (state === 'play') tutoToucher(x, y); return; }
    if (state !== 'play') return;
    for (const k in BTN) { const B = BTN[k]; if (Math.abs(x - B.x) < B.w / 2 && Math.abs(y - B.y) < B.h / 2) { if (k === 'undo') annuler(); else { C.sfx.click(); autoX = !autoX; sauverReglage(); } return; } }
    const i = cellAt(x, y); if (i < 0) return;
    drag = { start: i, last: i, moved: false, op: null, snap: p.slice() };
  }
  function pointerMove(x, y) {
    if (!drag) return; const i = cellAt(x, y); if (i < 0 || i === drag.last) return;
    if (!drag.moved) { drag.moved = true; drag.op = p[drag.start] === CROIX ? 'erase' : 'paint'; peindre(drag.start); }
    peindre(i); drag.last = i;
  }
  function pointerUp() {
    if (!drag) return; const d = drag; drag = null;
    if (!d.moved) toucher(d.start);
    if (d.snap.some((v, i) => v !== p[i])) { hist.push(d.snap); if (hist.length > 400) hist.shift(); hint = null; ranger(); if (!d.moved && p[d.start] === REINE && bad[d.start]) { snd.conflit(); C.haptic('medium'); } }
  }
  function peindre(i) {
    if (drag.op === 'paint' ? p[i] === VIDE : p[i] === CROIX) { p[i] = drag.op === 'paint' ? CROIX : VIDE; anim[i] = C.time; snd.croix(); }
  }
  function toucher(i) {
    const was = p[i]; p[i] = was === REINE ? VIDE : was === CROIX || (ax() && auto[i]) ? REINE : CROIX; anim[i] = C.time;
    if (p[i] === REINE) {
      pose = i; snd.reine(i); note(p.filter(v => v === REINE).length - 1, { delay: T_POSE }); C.haptic('light');
      C.after(T_POSE, () => { if (p[i] === REINE && state === 'play') { const c = centre(i); C.burst(c.x, c.y + cell * .3, { colors: ['#FFE38A', '#fff', '#FFC933'], count: 8, speed: 380, size: 10, life: .45 }); } });
    } else if (p[i] === CROIX) snd.croix(); else snd.retire();
  }
  function annuler() { if (!hist.length) return; p = hist.pop(); hint = null; snd.annule(); ranger(); }
  function sauverReglage() { try { localStorage.setItem('reines.autoX', autoX ? '1' : '0'); } catch (_) { } }
  try { autoX = localStorage.getItem('reines.autoX') !== '0'; } catch (_) { }

  // ------------------------------------------------------------ indice expliqué (aide de la coquille)
  const NOM = { ligne: 'ligne', colonne: 'colonne', zone: 'zone' };
  function texteIndice(e) {
    if (e.t === 'seul') return tr('Il ne reste qu’une case libre dans cette ' + NOM[e.unit.type] + ' : c’est une reine.');
    if (e.t === 'confine') {
      const l = e.o ? 'colonne' : 'ligne';
      if (e.sens === 'zones') return e.m === 1 ? tr('Cette zone tient dans une seule ' + l + ' : sa reine y sera. Le reste de la ' + l + ' est exclu.') : tr('Ces {m} zones tiennent dans {m} ' + l + 's : elles en prennent toutes les reines. Le reste de ces ' + l + 's est exclu.', { m: e.m });
      return e.m === 1 ? tr('Les cases libres de cette ' + l + ' sont toutes dans la même zone : le reste de la zone est exclu.') : tr('Les cases libres de ces {m} ' + l + 's sont dans {m} zones seulement : le reste de ces zones est exclu.', { m: e.m });
    }
    if (e.t === 'bloque') return tr('Une reine ici ne laisserait aucune case libre dans cette ' + NOM[e.unit.type] + ' : case exclue.');
    if (e.t === 'essai') return tr('Une reine ici mène à une impasse quelques coups plus loin : case exclue.');
    return tr('Voici une reine.');
  }
  function donnerIndice() {
    hist.push(p.slice()); hintsUsed++;
    const f = faux();
    if (f.length) { for (const i of f) { p[i] = VIDE; anim[i] = C.time; } hint = { text: tr('Ces cases étaient fausses : elles sont effacées.'), cells: f, hl: null, band: null }; snd.retire(); ranger(); return; }
    const e = prochaine(), hl = new Uint8Array(G.N); let band = null;
    if (e.unit) for (const i of e.unit.cells) hl[i] = 1;
    if (e.t === 'confine') { for (let i = 0; i < G.N; i++) if (e.zones.includes(G.reg[i])) hl[i] = 1; band = { o: e.o, a: e.a, b: e.b }; }
    if (e.t === 'don' || e.t === 'essai') hl.fill(1);
    for (const i of e.place || []) { p[i] = REINE; anim[i] = C.time; hl[i] = 1; pose = i; }
    for (const i of e.out || []) { p[i] = CROIX; anim[i] = C.time; hl[i] = 1; }
    hint = { text: texteIndice(e), cells: (e.place || []).concat(e.out || []), hl, band };
    snd.indice(); C.haptic('light'); ranger();
  }
  // VÉRIFIER (aide moins chère que l'indice) : dit seulement combien de reines ou de croix sont fausses, sans les montrer
  function verifier() {
    if (!p.some(v => v !== VIDE)) return false;
    const k = faux().length;
    hint = { text: k ? tr(k > 1 ? 'Il y a {n} erreurs sur le plateau.' : 'Il y a {n} erreur sur le plateau.', { n: k }) : tr('Tout est juste jusqu’ici.'), cells: [], hl: null, band: null };
    if (k) snd.conflit(); else snd.indice(); C.haptic('light'); return true;
  }
  function useBoost(key) {
    if (state !== 'play' || tuto) return false;
    if (key === 'hint') donnerIndice(); else if (key !== 'check' || !verifier()) return false;
    if (global.Shell) Shell.boostUsed(key); return true;
  }

  // ------------------------------------------------------------ victoire
  function gagner() {
    state = 'won'; wonT = C.time; hint = null; fauxFx = null; if (C.KIT.hook >= 0) carte = C.byLang(CARTES)[DEFI > 0 ? 0 : FAUX ? 1 : 2];
    const q = []; for (let i = 0; i < G.N; i++) if (p[i] === REINE) q.push(i);
    q.forEach((i, a) => C.after(.35 + a * .09, () => { anim[i] = C.time; note(a) || C.sfx.ding(GAMME[a % GAMME.length] - 9); const c = centre(i); C.burst(c.x, c.y, { colors: ['#FFC933', '#fff', '#3a2408'], count: 10, speed: 520, size: 14, life: .6 }); }));
    C.after(.35 + q.length * .09 + .15, () => { snd.gagne(); C.confetti(W / 2, BOARD.y + BOARD.s / 2); });
    if (tuto) { C.after(q.length * .09 + 2, tutoFini); return; }
    const stars = hintsUsed === 0 ? 3 : hintsUsed === 1 ? 2 : 1, t = elapsed, lvl = level;
    if (daily && global.Shell && Shell.dailyWon) { C.after(q.length * .09 + 1.9, () => Shell.dailyWon({ stars, time: t })); return; }
    C.after(q.length * .09 + 1.9, () => { if (global.Shell) Shell.levelWon({ level: lvl, stars, time: t }); else { level++; C.restart(); } });
  }

  // ------------------------------------------------------------ sons et musique enregistrés (audio/manifest.js → window.GAME_AUDIO)
  // Un bruitage sans fichier (ou pas encore chargé) garde sa version synthétisée du moteur. La musique : le morceau de la zone, en boucle ; aucun morceau
  // dans le manifeste = pas de musique.
  const AUDIO = global.GAME_AUDIO || null, MUSIQUE_URL = (String(location.href).match(/[?&]musique=([\w-]+)/) || [])[1];
  if (AUDIO && AUDIO.sfx) C.loadSamples(AUDIO.base || 'audio/', AUDIO.sfx);
  // dans un clip (accroche affichée), le tic des croix est très adouci : répété par le robot, il agaçait (11 oct. 2026)
  const snd = {
    croix: () => C.playSample('croix', { vol: C.KIT.hook >= 0 ? .25 : 1 }) || C.sfx.click(), reine: i => C.playSample('reine') || C.sfx.pop(1 + (i % n) * .03),
    retire: () => C.playSample('retire') || C.sfx.plop(), conflit: () => C.playSample('conflit') || C.sfx.fail(), indice: () => C.playSample('indice') || C.sfx.pop(),
    annule: () => C.playSample('annule') || C.sfx.click(), gagne: () => C.playSample('gagne') || C.sfx.win(),
  };
  let musGain = null, trackSrc = null, trackName = null;
  function musique() {
    const M = AUDIO && AUDIO.music, name = MUSIQUE_URL || (M && M.length ? M[chapterOf(zoneDe()).index % M.length] : null), a = C.audio();
    if (!name || !a.ctx) return;
    if (!musGain) { musGain = a.ctx.createGain(); musGain.connect(a.master); }
    musGain.gain.value = musicOn ? (AUDIO && AUDIO.musicVol !== undefined ? AUDIO.musicVol : .5) : 0;
    if (name === trackName) return;
    trackName = name; if (trackSrc) { try { trackSrc.stop(); } catch (_) { } trackSrc = null; }
    C.fetchBytes(((AUDIO && AUDIO.base) || 'audio/') + name + '.mp3').then(buf => new Promise((ok, ko) => a.ctx.decodeAudioData(buf, ok, ko))).then(b => {
      if (trackName !== name) return;
      trackSrc = a.ctx.createBufferSource(); trackSrc.buffer = b; trackSrc.loop = true; trackSrc.connect(musGain); trackSrc.start();
    }).catch(() => { });
  }

  function update(dt) { if (state === 'play' && !tuto) elapsed += dt; musique(); }

  // ------------------------------------------------------------ dessin
  // alvéole (hexagone pointe en haut) de rayon R ; trait seul ou remplie et cernée
  function hexa(c, x, y, R, traitSeul) {
    c.beginPath(); for (let a = 0; a < 6; a++) { const t = Math.PI / 6 + a * Math.PI / 3, px = x + R * Math.cos(t), py = y + R * Math.sin(t); if (a) c.lineTo(px, py); else c.moveTo(px, py); }
    c.closePath(); if (!traitSeul) c.fill(); c.stroke();
  }
  // REINE : l'image reine.webp (Gemini, détourée par tools/art-reines.js), réduite une fois à la taille de la case. Tant qu'elle n'est pas chargée
  // (ou si elle manque), une reine dessinée la remplace : ailes, corps rayé, tête, petite couronne.
  const redessiner = () => { fondKey = ''; if (C.paused) C.tick(0); };   // image arrivée pendant la pause (jeu derrière un menu) : une image est redessinée
  const IMG = new Image(); IMG.onload = redessiner; IMG.src = 'reine.webp';
  function faireReine(px) {
    const cv = document.createElement('canvas'); cv.width = cv.height = Math.max(8, Math.ceil(px)); const c = cv.getContext('2d'), s = cv.width, BRUN = '#3a2408';
    if (IMG.complete && IMG.naturalWidth) { c.imageSmoothingQuality = 'high'; c.drawImage(IMG, 0, 0, s, s); return cv; }
    c.translate(s / 2, s / 2); c.scale(s, s); c.lineJoin = 'round'; c.lineWidth = .035; c.strokeStyle = BRUN;
    for (const k of [-1, 1]) { c.save(); c.translate(k * .23, .0); c.rotate(k * .5); c.beginPath(); c.ellipse(0, 0, .2, .115, 0, 0, 7); c.fillStyle = 'rgba(235,247,255,.92)'; c.fill(); c.stroke(); c.restore(); }
    c.beginPath(); c.moveTo(-.05, .36); c.lineTo(0, .46); c.lineTo(.05, .36); c.closePath(); c.fillStyle = BRUN; c.fill();   // dard
    c.beginPath(); c.ellipse(0, .13, .17, .25, 0, 0, 7); c.fillStyle = '#FFC933'; c.fill();
    c.save(); c.clip(); c.fillStyle = BRUN; c.fillRect(-.3, .04, .6, .075); c.fillRect(-.3, .19, .6, .075); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-.07, .02, .05, .12, .3, 0, 7); c.fill(); c.restore();
    c.beginPath(); c.ellipse(0, .13, .17, .25, 0, 0, 7); c.stroke();
    c.beginPath(); c.arc(0, -.17, .125, 0, 7); c.fillStyle = BRUN; c.fill();
    c.fillStyle = '#fff'; for (const k of [-1, 1]) { c.beginPath(); c.arc(k * .055, -.18, .028, 0, 7); c.fill(); }
    c.beginPath(); c.moveTo(-.13, -.27); c.lineTo(-.16, -.43); c.lineTo(-.07, -.35); c.lineTo(0, -.46); c.lineTo(.07, -.35); c.lineTo(.16, -.43); c.lineTo(.13, -.27); c.closePath();
    c.lineWidth = .03; c.strokeStyle = '#7a4a00'; c.fillStyle = '#FFE27A'; c.fill(); c.stroke();
    return cv;
  }
  // DÉCOR DE ZONE (10 oct. 2026) : une zone qui a son image (reines/decors/<nom>.webp, Gemini, mise au format par tools/art-reines.js) la montre à la
  // place du fond brun et de ses alvéoles ; le haut et le bas sont assombris pour que les textes blancs restent lisibles. Sans image, ou tant qu'elle
  // n'est pas chargée : le fond brun. DECORS[i] : décor de la i-ième zone de la carte (la liste recommence au-delà).
  const DECORS = ['prairie', 'verger', 'lavande', 'foret', 'nuit', 'hiver'], decorImgs = {}; let surDecor = false;   // surDecor : image claire derrière → les textes et les boutons reçoivent un fond foncé
  function decorDe(k) {
    const nom = DECORS[chapterOf(k).index % DECORS.length]; if (!nom) return null;
    const im = decorImgs[nom] || (decorImgs[nom] = Object.assign(new Image(), { onload: redessiner, src: 'decors/' + nom + '.webp' }));
    return im.complete && im.naturalWidth ? im : null;
  }
  function faireFond() {
    const k = C.canvas.width / W, cv = document.createElement('canvas'); cv.width = C.canvas.width; cv.height = C.canvas.height;
    const c = cv.getContext('2d'); c.scale(k, k);
    const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#6b4210'); g.addColorStop(1, '#1d1205'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    const decor = decorDe(zoneDe()); surDecor = !!decor;
    if (decor) { c.imageSmoothingQuality = 'high'; c.drawImage(decor, 0, 0, W, H); const v = c.createLinearGradient(0, 0, 0, H); v.addColorStop(0, 'rgba(29,18,5,.42)'); v.addColorStop(.14, 'rgba(29,18,5,.12)'); v.addColorStop(.24, 'rgba(29,18,5,0)'); v.addColorStop(.72, 'rgba(29,18,5,0)'); v.addColorStop(.86, 'rgba(29,18,5,.18)'); v.addColorStop(1, 'rgba(29,18,5,.4)'); c.fillStyle = v; c.fillRect(0, 0, W, H); }
    else { c.strokeStyle = 'rgba(255,200,90,.07)'; c.lineWidth = 4; for (let r = 0, R = 62; r * R * 1.5 < H + R; r++) for (let q = -1; q * R * 1.732 < W + R; q++) hexa(c, q * R * 1.732 + (r % 2 ? R * .866 : 0), r * R * 1.5, R, true); }
    // les bandes de la page, au-dessus et au-dessous du canevas sur un téléphone allongé, prennent la couleur moyenne des bords du fond
    try {
      const moy = y => { const d = c.getImageData(0, y, cv.width, 2).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const k = d.length / 4; return '#' + [r, g, b].map(v => Math.round(v / k).toString(16).padStart(2, '0')).join(''); };
      const st = document.documentElement.style; st.setProperty('--bg-top', moy(0)); st.setProperty('--bg-bottom', moy(cv.height - 2));
    } catch (_) { }
    const B = BOARD;
    c.save(); c.shadowColor = 'rgba(0,0,0,.5)'; c.shadowBlur = 40; c.shadowOffsetY = 14; c.fillStyle = INK; c.beginPath(); c.roundRect(B.x - 10, B.y - 10, B.s + 20, B.s + 20, 34); c.fill(); c.restore();
    c.save(); c.beginPath(); c.roundRect(B.x, B.y, B.s, B.s, 26); c.clip();
    for (let i = 0; i < G.N; i++) { c.fillStyle = ZONES[G.reg[i] % ZONES.length]; c.fillRect(B.x + (i % n) * cell - .5, B.y + (i / n | 0) * cell - .5, cell + 1, cell + 1); }
    // une alvéole plus claire dans chaque case
    // (10 oct. 2026) la case est la cire, un peu plus sombre ; l'alvéole est pleine de miel : dégradé clair en haut, bord foncé, petit reflet
    for (let i = 0; i < G.N; i++) {
      const col = ZONES[G.reg[i] % ZONES.length], x = B.x + (i % n + .5) * cell, y = B.y + ((i / n | 0) + .5) * cell, R = cell * .455;
      c.fillStyle = C.shade(col, -.1); c.fillRect(x - cell / 2 - .5, y - cell / 2 - .5, cell + 1, cell + 1);
      const gr = c.createLinearGradient(0, y - R, 0, y + R); gr.addColorStop(0, C.shade(col, .42)); gr.addColorStop(.55, C.shade(col, .2)); gr.addColorStop(1, C.shade(col, .02));
      c.fillStyle = gr; c.strokeStyle = C.rgba(C.shade(col, -.38), .55); c.lineWidth = Math.max(2, cell * .028); c.lineJoin = 'round'; hexa(c, x, y, R);
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = Math.max(2, cell * .045); c.lineCap = 'round'; c.beginPath(); c.moveTo(x - R * .5, y - R * .42); c.lineTo(x - R * .22, y - R * .6); c.stroke();
    }
    // traits fins entre cases d'une même zone, épais entre deux zones
    for (const thick of [false, true]) {
      c.beginPath(); c.lineWidth = thick ? Math.max(7, cell * .07) : 2; c.strokeStyle = thick ? INK : 'rgba(58,36,8,.22)'; c.lineCap = 'round';
      for (let i = 0; i < G.N; i++) {
        const r = i / n | 0, col = i % n, x = B.x + col * cell, y = B.y + r * cell;
        if (col < n - 1 && (G.reg[i] !== G.reg[i + 1]) === thick) { c.moveTo(x + cell, y); c.lineTo(x + cell, y + cell); }
        if (r < n - 1 && (G.reg[i] !== G.reg[i + n]) === thick) { c.moveTo(x, y + cell); c.lineTo(x + cell, y + cell); }
      }
      c.stroke();
    }
    c.restore();
    crown = faireReine(cell * .92 * k);
    return cv;
  }
  function pilule(B, label, on) {
    ctx.save(); ctx.fillStyle = surDecor ? (on ? 'rgba(58,36,8,.78)' : 'rgba(58,36,8,.5)') : on ? 'rgba(255,255,255,.16)' : 'rgba(255,255,255,.07)'; C.roundRect(B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, B.h / 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore();
    C.text(label, B.x, B.y + 2, { size: C.fitSize(label, 40, B.w - 60), color: on ? '#fff' : 'rgba(255,255,255,.45)' });
  }
  function lignes(str, size, maxW) {
    ctx.save(); ctx.font = '900 ' + size + 'px ' + C.FONT; const out = []; let cur = '';
    for (const w of str.split(' ')) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > maxW) { out.push(cur); cur = w; } else cur = t; }
    if (cur) out.push(cur); ctx.restore(); return out;
  }
  const temps = t => Math.floor(t / 60) + ':' + String(Math.floor(t % 60)).padStart(2, '0');
  // ÉCRAN DE DÉMARRAGE (développement) : /reines/?art=splash&res=1.423 puis ART.save() → jeux/art/reines-splash.png, puis `node jeux/tools/splash-web.js reines`.
  // Rayon de miel et reine de Gemini (jeux/art/reines-sources/), titre dans la police du jeu. L'icône, elle, est composée par tools/art-reines.js.
  let artImg = null;
  function drawArt() {
    ART.bg = '#8a4a0c';
    if (!artImg) { artImg = ['rayon.jpg', 'reine-detouree.png'].map(n => { const i = new Image(); i.src = '../art/reines-sources/' + n; return i; }); }
    if (ART.kind !== 'splash' || !artImg.every(i => i.complete && i.naturalWidth)) { ctx.fillStyle = ART.bg; ctx.fillRect(0, 0, W, H); return; }
    ctx.imageSmoothingQuality = 'high'; ctx.drawImage(artImg[0], (W - H) / 2, 0, H, H);
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(58,26,2,.55)'); g.addColorStop(.3, 'rgba(58,26,2,0)'); g.addColorStop(.62, 'rgba(58,26,2,0)'); g.addColorStop(1, 'rgba(40,18,2,.8)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const halo = ctx.createRadialGradient(W / 2, 800, 60, W / 2, 800, 560); halo.addColorStop(0, 'rgba(255,244,200,.75)'); halo.addColorStop(1, 'rgba(255,244,200,0)'); ctx.fillStyle = halo; ctx.fillRect(0, 200, W, 1200);
    // un iPhone ne montre que la bande centrale de l'image (environ 880 des 1080 unités de large) : la reine et le titre tiennent dans 720
    ctx.drawImage(artImg[1], W / 2 - 300, 800 - 300, 600, 600);
    C.text('HIVE QUEENS', W / 2, 1300, { size: C.fitSize('HIVE QUEENS', 170, 720), color: '#FFE38A', stroke: INK, strokeW: 26, shadow: 18, cache: false });
  }
  function draw() {   // à la victoire, toute l'image se rapproche un peu du plateau
    const u = state === 'won' && !tuto && !global.ART ? C.clamp((C.time - wonT) / .7, 0, 1) : 0, z = 1 + .03 * (1 - (1 - u) * (1 - u) * (1 - u)), cy = BOARD.y + BOARD.s / 2;
    ctx.save(); if (u > 0) { ctx.translate(W / 2, cy); ctx.scale(z, z); ctx.translate(-W / 2, -cy); }
    if (fauxFx && fauxFx.t >= 0 && C.time - fauxFx.t < .45) { const a = (C.time - fauxFx.t) / .45; ctx.translate(Math.sin(a * 38) * 16 * (1 - a), 0); }   // faux coup : secousse
    dessiner(); ctx.restore();
    if (mielT >= 0 && C.time - mielT < 1.6) voileDeMiel(C.time - mielT);
  }
  // voile de miel du début d'un clip : il couvre tout, puis son bord du haut descend (bord ondulé, coulures à la traîne, reflet)
  function voileDeMiel(t) {
    const r = C.clamp((t - .2) / 1.2, 0, 1), e = r * r * (3 - 2 * r), y0 = -160 + e * (H + 420);
    const bord = x => y0 + Math.sin(x * .011 + t * 4) * 22 + Math.sin(x * .027 + 1.3) * 14;
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 900); g.addColorStop(0, '#FFD75E'); g.addColorStop(.25, '#F7B21C'); g.addColorStop(1, '#D8860A');
    ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-200, H + 400); ctx.lineTo(-200, bord(-200)); for (let x = -200; x <= W + 200; x += 24) ctx.lineTo(x, bord(x)); ctx.lineTo(W + 200, H + 400); ctx.closePath(); ctx.fill();
    // coulures : des filets qui restent en arrière du bord et s'amincissent
    for (let k = 0; k < 9; k++) { const x = 70 + k * 118 + Math.sin(k * 7.3) * 30, len = (120 + (k * 53 % 160)) * (1 - r * .6) * Math.min(1, r * 6), w = 26 + (k * 17 % 22); ctx.beginPath(); ctx.roundRect(x - w / 2, bord(x) - len, w, len + 30, w / 2); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,250,215,.75)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); for (let x = -200; x <= W + 200; x += 24) ctx.lineTo(x, bord(x) + 20); ctx.stroke();
    ctx.restore();
  }
  function dessiner() {
    if (global.ART) return drawArt();
    if (!C.canvas.width || !C.canvas.height) return;   // fenêtre pas encore mesurée
    const key = level + '|' + C.canvas.width + '|' + C.canvas.height; if (key !== fondKey) { fond = faireFond(); fondKey = key; }
    ctx.drawImage(fond, 0, 0, W, H);
    const B = BOARD, now = C.time;
    // en-tête (rien tant qu'aucun niveau n'est lancé : le plateau sert de fond à l'écran titre)
    if (lance) {
    const accroche = !tuto && C.kit.drawHook(level, { y: 96, size: 56, gap: 60, color: '#fff', stroke: INK, strokeW: 12 });   // clips : accroche à la place du numéro de niveau
    if (!accroche) C.text(tuto ? tr('COMMENT JOUER') : daily ? tr('GRILLE DU JOUR') : tr('NIVEAU {n}', { n: level }), W / 2, 92, { size: C.fitSize(daily ? tr('GRILLE DU JOUR') : '', 68, W - 2 * C.HUD_CLEAR), color: '#fff', stroke: INK, strokeW: surDecor ? 12 : 0.01, shadow: surDecor ? 10 : 0 });
    if (!tuto && !accroche) C.text(n + ' × ' + n + (lv.h ? '  ·  ' + tr('DIFFICILE') : ''), W / 2, 172, { size: 38, color: lv.h ? '#FFB3A8' : surDecor ? '#fff' : 'rgba(255,255,255,.6)', stroke: surDecor ? INK : null, strokeW: 8 });
    if (!tuto) C.text(temps(elapsed), W - 60, 172, { size: 38, color: surDecor ? '#fff' : 'rgba(255,255,255,.6)', stroke: surDecor ? INK : null, strokeW: 8, align: 'right' });
    if (tuto || (!daily && level <= 3)) {
      C.text(tr('Une reine par ligne, par colonne et par zone de couleur.'), W / 2, 238, { size: C.fitSize(tr('Une reine par ligne, par colonne et par zone de couleur.'), 36, W - 80), color: '#FFE38A', stroke: surDecor ? INK : null, strokeW: 8 });
      C.text(tr('Deux reines ne se touchent jamais, même en coin.'), W / 2, 286, { size: C.fitSize(tr('Deux reines ne se touchent jamais, même en coin.'), 36, W - 80), color: '#FFE38A', stroke: surDecor ? INK : null, strokeW: 8 });
    }
    }
    // indice : tout ce qui n'est pas concerné est assombri, la bande de lignes ou de colonnes est encadrée
    if (hint && hint.hl) {
      ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.s, B.s, 26); ctx.clip(); ctx.fillStyle = tuto ? 'rgba(29,18,5,.4)' : 'rgba(29,18,5,.55)';
      for (let i = 0; i < G.N; i++) if (!hint.hl[i]) ctx.fillRect(B.x + (i % n) * cell, B.y + (i / n | 0) * cell, cell + .5, cell + .5);
      ctx.restore();
    }
    // zone qui vient de recevoir sa reine : un éclat doré qui s'éteint
    if (eclats.length) {
      eclats = eclats.filter(e => now - e.t < .7);
      ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.s, B.s, 26); ctx.clip();
      for (const e of eclats) { const a = (now - e.t) / .7; if (a < 0) continue; ctx.fillStyle = 'rgba(255,240,170,' + (.6 * (1 - a) * (1 - a)).toFixed(3) + ')'; for (let i = 0; i < G.N; i++) if (G.reg[i] === e.reg) ctx.fillRect(B.x + (i % n) * cell, B.y + (i / n | 0) * cell, cell + .5, cell + .5); }
      ctx.restore();
    }
    // croix et reines
    const cs = cell * .17;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = Math.max(5, cell * .065);
    for (let i = 0; i < G.N; i++) {
      const v = vu(i); if (v === VIDE) continue;
      const x = B.x + (i % n + .5) * cell, y = B.y + ((i / n | 0) + .5) * cell, a = C.clamp((now - anim[i]) / .18, 0, 1);
      if (v === CROIX) {
        const av = p[i] === CROIX ? a : C.clamp((now - autoT[i]) / .16, 0, 1); if (av <= 0) continue;   // croix automatique : elle attend son tour dans la vague
        const s = cs * C.ease.outBack(av);
        ctx.strokeStyle = p[i] === CROIX ? 'rgba(58,36,8,.62)' : 'rgba(58,36,8,.26)';
        ctx.beginPath(); ctx.moveTo(x - s, y - s); ctx.lineTo(x + s, y + s); ctx.moveTo(x + s, y - s); ctx.lineTo(x - s, y + s); ctx.stroke();
      } else {
        if (bad[i]) { ctx.fillStyle = 'rgba(229,23,63,.55)'; C.roundRect(x - cell * .42, y - cell * .42, cell * .84, cell * .84, cell * .16); ctx.fill(); }
        const S = cell * .92, t = now - anim[i];
        if (state === 'won') {   // saut à son tour, puis un petit balancement en vague
          const j = Math.sin(Math.PI * C.clamp(t / .42, 0, 1)), s = S * (1 + .18 * j), bob = now - wonT > 1.4 ? Math.abs(Math.sin(now * 5 - (i % n) * .7)) * cell * .06 : 0;
          ctx.drawImage(crown, x - s / 2, y - s / 2 - j * cell * .36 - bob, s, s);
        } else {   // vol d'arrivée, puis écrasement amorti, pieds posés ; un anneau de miel part de l'atterrissage
          const f = C.clamp(t / T_POSE, 0, 1), l = C.clamp((t - T_POSE) / .34, 0, 1), sq = f < 1 ? -.08 : Math.sin(l * Math.PI * 2.5) * (1 - l) * .2;
          if (f >= 1 && t < T_POSE + .45) { const r = (t - T_POSE) / .45; ctx.save(); ctx.strokeStyle = 'rgba(255,215,94,' + (.75 * (1 - r)).toFixed(3) + ')'; ctx.lineWidth = cell * .08 * (1 - r) + 1; ctx.beginPath(); ctx.arc(x, y + cell * .12, cell * (.28 + .6 * r), 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
          const w = S * (1 + sq), h = S * (1 - sq);
          ctx.globalAlpha = Math.min(1, f * 2.5 + .15); ctx.drawImage(crown, x - w / 2 + (1 - f) * cell * .3, y + S / 2 - h - (1 - f * f) * cell * 1.05, w, h); ctx.globalAlpha = 1;
        }
      }
    }
    ctx.restore();
    if (hint) {
      const pulse = .55 + .45 * Math.sin(now * 6);
      ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,' + pulse + ')'; ctx.lineWidth = 6;
      for (const i of hint.cells) { C.roundRect(B.x + (i % n) * cell + 7, B.y + (i / n | 0) * cell + 7, cell - 14, cell - 14, cell * .16); ctx.stroke(); }
      if (hint.band) { const b = hint.band, a0 = b.a * cell, len = (b.b - b.a + 1) * cell; ctx.setLineDash([18, 12]); ctx.strokeStyle = '#fff'; ctx.lineWidth = 7; C.roundRect(B.x + (b.o ? a0 : 0) + 4, B.y + (b.o ? 0 : a0) + 4, (b.o ? len : B.s) - 8, (b.o ? B.s : len) - 8, 18); ctx.stroke(); }
      ctx.restore();
      ctx.save(); ctx.fillStyle = surDecor ? 'rgba(58,36,8,.82)' : 'rgba(255,255,255,.12)'; C.roundRect(PANEL.x, PANEL.y, PANEL.w, PANEL.h, 30); ctx.fill(); ctx.restore();
      const ls = lignes(hint.text, 40, PANEL.w - 70), y0 = PANEL.y + PANEL.h / 2 - (ls.length - 1) * 26;
      ls.forEach((s, a) => C.text(s, W / 2, y0 + a * 52, { size: 40, color: '#fff' }));
    }
    if (lance && !hint && !tuto && !daily && level <= 2 && state === 'play') { const ls = lignes(tr('Astuce : touche une fois pour barrer une case, glisse pour en barrer plusieurs.'), 36, PANEL.w - 70); ls.forEach((t, k) => C.text(t, W / 2, PANEL.y + PANEL.h / 2 - (ls.length - 1) * 24 + k * 48, { size: 36, color: surDecor ? '#fff' : 'rgba(255,255,255,.7)', stroke: surDecor ? INK : null, strokeW: 8 })); }
    if (defiT >= 0 && state === 'play') {   // défi : compte à rebours et barre qui se vide
      const r = Math.max(0, ATTENTE - (now - defiT)), fr = r - Math.floor(r), y = PANEL.y + PANEL.h / 2 - 30;
      C.text(String(Math.max(1, Math.ceil(r))), W / 2, y, { size: 170 * (1 + .3 * fr * fr * fr), color: '#FFE38A', stroke: INK, strokeW: 16, shadow: 12, cache: false });
      ctx.save(); ctx.fillStyle = 'rgba(58,36,8,.7)'; C.roundRect(W / 2 - 300, y + 128, 600, 22, 11); ctx.fill(); ctx.fillStyle = '#FFC933'; C.roundRect(W / 2 - 300, y + 128, Math.max(22, 600 * r / ATTENTE), 22, 11); ctx.fill(); ctx.restore();
    }
    if (fauxFx && fauxFx.t >= 0) {   // faux coup : l'unité condamnée en rouge, le mot et la raison
      const a = now - fauxFx.t;
      ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.s, B.s, 26); ctx.clip(); ctx.fillStyle = 'rgba(229,23,63,' + (.38 + .14 * Math.sin(now * 9)).toFixed(3) + ')';
      for (const i of fauxFx.cells) ctx.fillRect(B.x + (i % n) * cell, B.y + (i / n | 0) * cell, cell + .5, cell + .5); ctx.restore();
      C.text(C.byLang(FAUXMOT), W / 2, PANEL.y + PANEL.h / 2 - 50, { size: 120 * C.ease.outBack(C.clamp(a / .25, 0, 1)), color: '#FF5470', stroke: INK, strokeW: 16, shadow: 12, cache: false });
      if (a > .5) C.text(C.byLang(RAISON)[fauxFx.type], W / 2, PANEL.y + PANEL.h / 2 + 60, { size: 46, color: '#fff', stroke: INK, strokeW: 10, alpha: C.clamp((a - .5) / .25, 0, 1) });
    }
    if (state === 'won' && carte) C.text(carte, W / 2, PANEL.y + PANEL.h / 2 + 100, { size: 54, color: '#fff', stroke: INK, strokeW: 10, alpha: C.clamp((now - wonT - .7) / .3, 0, 1) });
    if (state === 'won') {   // reflet de miel qui traverse le plateau en diagonale
      const r = (now - wonT - .1) / .85;
      if (r > 0 && r < 1) { const x0 = B.x - B.s * .7 + r * B.s * 2.1, g = ctx.createLinearGradient(x0, B.y, x0 + B.s * .45, B.y + B.s * .45); g.addColorStop(0, 'rgba(255,244,190,0)'); g.addColorStop(.5, 'rgba(255,244,190,.6)'); g.addColorStop(1, 'rgba(255,244,190,0)'); ctx.save(); ctx.beginPath(); ctx.roundRect(B.x, B.y, B.s, B.s, 26); ctx.clip(); ctx.fillStyle = g; ctx.fillRect(B.x, B.y, B.s, B.s); ctx.restore(); }
    }
    if (state === 'won') C.text(tr(tuto ? 'À TOI DE JOUER !' : 'RÉSOLU !'), W / 2, PANEL.y + PANEL.h / 2, { size: 96, color: '#FFE38A', stroke: INK, strokeW: 14, shadow: 12, alpha: C.clamp((now - wonT) / .3, 0, 1) });
    if (!lance) return;
    if (tuto) { pilule(BTN.auto, tr('PASSER'), true); return; }
    if (C.KIT.hook >= 0) return;   // clip avec accroche : pas de boutons dans l'image
    pilule(BTN.undo, '↶  ' + tr('ANNULER'), hist.length > 0 && state === 'play');
    pilule(BTN.auto, tr('CROIX AUTO') + ' : ' + tr(autoX ? 'OUI' : 'NON'), autoX);
  }

  // ------------------------------------------------------------ robot (mode développeur, clips) : joue le raisonnement, coup par coup
  // Clips (10 oct. 2026), par l'URL : ?hook=N accroche en haut à la place du numéro de niveau ; ?defi=K la grille s'ouvre déjà remplie par le
  // raisonnement (croix cachées pendant l'attente), il manque K reines, le robot attend ?attente=S secondes (4) puis finit ; ?astuce : le robot demande l'indice, le laisse lire, puis joue ;
  // pendant l'attente du défi, un compte à rebours ; ?faux : le robot commence par un coup faux, expliqué puis retiré ; avec une accroche, une question
  // s'affiche sous « RÉSOLU ! » (CARTES) ; ?miel : le clip s'ouvre sur un voile de miel qui s'écoule et découvre la grille (1,4 s).
  // ?pas=S : pause entre deux déductions du robot (0,25).
  const UP = new URLSearchParams(global.location ? location.search : ''), DEFI = +UP.get('defi') || 0, ASTUCE = UP.has('astuce'), FAUX = UP.has('faux'), MIEL = UP.has('miel'), ATTENTE = +UP.get('attente') || 4, PAS = UP.has('pas') ? +UP.get('pas') : .25; 
  C.kit.setup({ hooks: {
    fr: ['Où va la dernière reine ?', 'Tu places les 3 dernières reines ?', 'Une reine par ligne, colonne et couleur.|Jamais deux côte à côte.', 'Ça a l’air facile.|Ça ne l’est pas.', 'L’astuce que presque tout le monde rate', 'Regarde cette grille tomber|sans rien deviner', 'Ce coup a l’air bon.|Il est faux.'],
    en: ['Where does the last queen go?', 'Can you place the last 3 queens?', 'One queen per row, column and color.|Never two side by side.', 'Looks easy.|It is not.', 'The trick almost everyone misses', 'Watch this grid fall|without a single guess', 'This move looks fine.|It is wrong.'],
  } });
  const CARTES = { fr: ['Tu l’avais ?', 'Tu l’avais vu venir ?', 'Ton temps ?'], en: ['Did you get it?', 'Did you see it coming?', 'Your time?'] };
  const RAISON = { fr: { zone: 'Plus de place dans cette zone', ligne: 'Plus de place dans cette ligne', colonne: 'Plus de place dans cette colonne' }, en: { zone: 'No room left in this zone', ligne: 'No room left in this row', colonne: 'No room left in this column' } };
  const FAUXMOT = { fr: 'FAUX !', en: 'WRONG!' };
  // une case libre, hors solution, dont la reine condamne d'un coup une zone (de préférence), une ligne ou une colonne
  function coupFaux() {
    let best = null;
    for (let i = 0; i < G.N; i++) {
      if (p[i] !== VIDE || auto[i] || sol[i] === REINE) continue;
      const e = etatLogique(); if (e[i] !== VIDE) continue; L.poser(G, e, i);
      for (const u of G.units) if (!u.cells.some(j => e[j] === REINE || e[j] === VIDE)) { const sc = (u.type === 'zone' ? 100 : 0) + u.cells.length; if (!best || sc > best.sc) best = { i, cells: u.cells, type: u.type, sc }; }
    }
    return best;
  }
  function autoplay() {
    if (state !== 'play') return; const f = faux();
    if (MIEL && !mielVu) { mielVu = true; C.bot.wait(1.5); return; }
    if (!defiVu && (DEFI > 0 || ASTUCE)) {
      defiVu = true;
      if (ASTUCE) donnerIndice(); else { defiT = C.time; for (let k = 0; k < ATTENTE; k++) note(k >= ATTENTE - 1 ? 5 : k >= ATTENTE - 3 ? 2 : 0, { vol: k >= ATTENTE - 3 ? .5 : .28, delay: k }); }   // compte à rebours : une note douce par seconde, plus haute sur les trois dernières
      C.bot.wait(ATTENTE); return;
    }
    cacheX = false; defiT = -1;   // fin de l'attente du défi : les croix reviennent, le robot finit   // clips « défi » et « astuce » : le temps de chercher, ou de lire l'indice
    const taps = (i, want) => { let v = p[i], k = 0; while (v !== want && k < 3) { v = v === REINE ? VIDE : v === CROIX || (ax() && auto[i]) ? REINE : CROIX; k++; } return k; };
    const go = (i, want) => { const c = centre(i); for (let k = taps(i, want); k > 0; k--) C.bot.tap(c.x, c.y); };
    // clip « faux coup » : une reine qui a l'air possible, la secousse et la raison (une ligne, une colonne ou une zone n'a plus de place), puis on la retire
    if (FAUX && fauxEtape === 0) { fauxEtape = 1; const w = coupFaux(); if (w) { fauxFx = { cells: w.cells, type: w.type, t: -1 }; go(w.i, REINE); C.bot.wait(.75); return; } }
    if (fauxEtape === 1) { fauxEtape = 2; if (fauxFx) { fauxFx.t = C.time; snd.conflit(); C.bot.wait(2.4); return; } }
    if (f.length) { fauxFx = null; go(f[0], VIDE); C.bot.wait(.35); return; }
    const e = prochaine(); for (const i of e.place || []) go(i, REINE); for (const i of e.out || []) go(i, CROIX);
    C.bot.wait(PAS);
  }

  // console : Core.test.level(12), Core.test.gagner() (pose la solution), Core.test.indice()
  C.test = {
    level(k) { lance = true; level = Math.max(1, k | 0); sansTuto = true; C.restart(); return n + '×' + n + ' score ' + lv.d; },
    gagner() { for (let i = 0; i < G.N; i++) p[i] = sol[i] === REINE ? REINE : VIDE; ranger(); return state; },
    indice() { donnerIndice(); return hint.text; },
    tuto() { sansTuto = false; if (global.Shell) delete Shell.save.tuto['reines.tuto']; level = 1; C.restart(); return !!tuto; },   // Core.test.tuto() : rejoue le tutoriel
    jour(top) { startDaily(top); return lv.n + '×' + lv.n + ' score ' + lv.d; },   // Core.test.jour() : lance la grille du jour
    auDela: k => { const x = niveauAuDela(k || NIV.length + 1); return x.z.slice(0, 12) + '…' + x.d; },   // à comparer avec `reines-niveaux.js verify`
    etat: () => ({ jour: !!daily, tuto: tuto && tuto.phase, level, n, state, reines: Array.from(p).filter(v => v === REINE).length, indices: hintsUsed, faux: faux().length }),
  };
  C.dbg = () => ({ level, state: state === 'won' ? 'done' : state, t: +elapsed.toFixed(1) });   // « done » : le mot qu'attendent les outils de tournage (tools/clip-site.js)
  C.start({ init, update, draw, pointerDown, pointerMove, pointerUp, autoplay, filmBg: ['#6b4210', '#1d1205'] });

  // zones de la carte des niveaux : une par taille de grille pendant la montée (les deux premières tailles ensemble), puis un « rucher » tous les
  // 100 niveaux, sans fin (les niveaux au-delà du fichier compris)
  const MONTEE = Math.min(300, NIV.length);
  const CHAPTERS = (() => {
    const out = []; let from = 1;
    for (let i = 1; i <= MONTEE; i++) if (i === MONTEE || (NIV[i].n !== NIV[i - 1].n && NIV[i].n > 5)) {
      const k = NIV[i - 1].n; out.push({ index: out.length, from, to: i, name: k <= 5 ? tr('PREMIERS PAS') : tr('GRILLES {n} × {n}', { n: k }), color: C.shade(ZONES[out.length % ZONES.length], -.35) }); from = i + 1;
    }
    return out;
  })();
  const chapterOf = k => {
    if (k <= MONTEE) return CHAPTERS.find(c => k >= c.from && k <= c.to) || CHAPTERS[0];
    const i = Math.floor((k - MONTEE - 1) / 100), index = CHAPTERS.length + i;
    return { index, from: MONTEE + 1 + i * 100, to: MONTEE + (i + 1) * 100, name: tr('RUCHER {n}', { n: i + 1 }), color: C.shade(ZONES[index % ZONES.length], -.35) };
  };
  const ICON_HINT = '<svg viewBox="0 0 120 120"><path d="M60 14c-21 0-36 15-36 34 0 13 7 22 14 29 4 4 6 8 6 13h32c0-5 2-9 6-13 7-7 14-16 14-29 0-19-15-34-36-34Z" fill="#FFE38A" stroke="#7a4a00" stroke-width="6"/><rect x="45" y="94" width="30" height="14" rx="6" fill="#7a4a00"/><path d="M50 52l10 10 10-10M60 62v22" fill="none" stroke="#F5A300" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_CHECK = '<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="#B6E8B0" stroke="#2f6b2a" stroke-width="6"/><path d="m38 62 15 15 30-33" fill="none" stroke="#2f6b2a" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (global.Shell) Shell.register({
    startLevel(k) { lance = true; daily = null; level = Math.max(1, k | 0); C.restart(); },
    daily: { start: startDaily, active: () => !!daily }, unlimited: true,   // unlimited : l'achat « Sans pubs + aides illimitées » est proposé
    setMusic(on) { musicOn = !!on; },
    level: () => level,
    hard: difficile,
    // ÉCONOMIE (10 oct. 2026), celle de Jewel Box : environ 15 pièces par niveau (11 pour trois étoiles, 20 tous les cinq niveaux) au lieu de 33 avec les
    // réglages de la coquille, soit un indice tous les quatre niveaux. On pourra desserrer après la sortie ; resserrer fâcherait les joueurs.
    economy: { firstWin: 5, perStar: 2, replayWin: 2, gift: { every: 5, coins: 20 }, daily: 20 },
    chapter: chapterOf, useBoost,
    boosts: [
      { key: 'hint', level: 3, cost: 60, icon: ICON_HINT, title: { fr: 'Indice', en: 'Hint' }, text: { fr: 'Joue le prochain coup et explique le raisonnement.', en: 'Plays the next move and explains the reasoning.' } },
      { key: 'check', level: 6, cost: 25, icon: ICON_CHECK, title: { fr: 'Vérifier', en: 'Check' }, text: { fr: 'Dit si tes reines et tes croix sont justes, sans montrer la suite.', en: 'Tells you whether your queens and X’s are right, without showing what comes next.' } },
    ],
  });
  if (/[?&#]auto/.test(String(location.href))) C.setBot(true);
})(window);
