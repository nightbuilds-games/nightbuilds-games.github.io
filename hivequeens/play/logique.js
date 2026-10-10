/* logique.js — règles et raisonnements du jeu de reines (9 oct. 2026). Sans dépendance : chargé par le jeu (indices expliqués, contrôle
   des erreurs) et par l'outil des niveaux (jeux/tools/reines-niveaux.js : unicité de la solution et difficulté).

   RÈGLE : grille n × n découpée en n zones ; k reines dans chaque ligne, chaque colonne et chaque zone (k = 1 : « Queens » ; k = 2 :
   « Star Battle ») ; deux reines ne se touchent jamais, même en diagonale.

   Une grille : G = grille(n, k, zones) où zones est une chaîne de n × n lettres (A = zone 0…), ligne par ligne.
   Un état : s[i] = VIDE, REINE ou CROIX pour la case i = ligne × n + colonne. Il est toujours « rangé » : poser() coche aussitôt les voisines
   de la reine et le reste des lignes, colonnes et zones devenues complètes (ce que fait le jeu avec les croix automatiques).

   RAISONNEMENTS, du plus simple au plus dur (etape() renvoie le premier qui s'applique, avec de quoi l'expliquer au joueur) :
     seul    : il reste juste assez de cases libres dans une ligne, une colonne ou une zone → ce sont des reines ;
     confine : m zones tiennent dans m lignes (ou colonnes) → le reste de ces lignes est exclu ; ou m lignes tiennent dans m zones → le reste
               de ces zones est exclu (m = 1 : « cette zone tient dans une seule colonne ») ;
     bloque  : une reine sur cette case ne laisserait plus de place dans une ligne, une colonne ou une zone → case exclue ;
     essai   : une reine sur cette case mène à une impasse quelques coups plus loin → case exclue (le plus dur, réservé aux niveaux difficiles).
   Une grille que resoudre() termine a une solution unique, trouvable sans deviner. */
(function (root) {
  'use strict';
  const VIDE = 0, REINE = 1, CROIX = 2;

  function grille(n, k, zones) {
    const N = n * n, reg = new Uint8Array(N);
    for (let i = 0; i < N; i++) reg[i] = typeof zones === 'string' ? zones.charCodeAt(i) - 65 : zones[i];
    const units = [];
    for (let r = 0; r < n; r++) units.push({ type: 'ligne', index: r, cells: Array.from({ length: n }, (_, c) => r * n + c) });
    for (let c = 0; c < n; c++) units.push({ type: 'colonne', index: c, cells: Array.from({ length: n }, (_, r) => r * n + c) });
    const zs = Array.from({ length: n }, () => []); for (let i = 0; i < N; i++) zs[reg[i]].push(i);
    zs.forEach((cells, z) => units.push({ type: 'zone', index: z, cells }));
    const nb = [], of = [];
    for (let i = 0; i < N; i++) {
      const r = i / n | 0, c = i % n, a = [];
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const rr = r + dr, cc = c + dc; if ((dr || dc) && rr >= 0 && rr < n && cc >= 0 && cc < n) a.push(rr * n + cc); }
      nb.push(a); of.push([r, n + c, 2 * n + reg[i]]);
    }
    return { n, k, N, reg, units, nb, of };
  }
  const touche = (G, i, j) => Math.abs((i / G.n | 0) - (j / G.n | 0)) <= 1 && Math.abs(i % G.n - j % G.n) <= 1;
  const reines = (s, u) => { let x = 0; for (const i of u.cells) if (s[i] === REINE) x++; return x; };
  const libres = (s, u) => u.cells.filter(i => s[i] === VIDE);
  const manque = (G, s, u) => G.k - reines(s, u);

  // pose une reine et range l'état ; renvoie les cases cochées au passage
  function poser(G, s, i) {
    const out = []; s[i] = REINE;
    for (const j of G.nb[i]) if (s[j] === VIDE) { s[j] = CROIX; out.push(j); }
    for (const ui of G.of[i]) { const u = G.units[ui]; if (reines(s, u) >= G.k) for (const j of u.cells) if (s[j] === VIDE) { s[j] = CROIX; out.push(j); } }
    return out;
  }
  // peut-on encore poser `need` reines dans ces cases libres (sans qu'elles se touchent) ?
  function tient(G, free, need) {
    if (need <= 0) return true; if (need === 1) return free.length > 0; if (free.length < need) return false;
    const pris = [];
    const rec = (a, left) => {
      if (!left) return true;
      for (; a <= free.length - left; a++) { const i = free[a]; if (pris.every(j => !touche(G, i, j))) { pris.push(i); if (rec(a + 1, left - 1)) return true; pris.pop(); } }
      return false;
    };
    return rec(0, need);
  }
  // première ligne, colonne ou zone qui ne peut plus être complétée (ou trop pleine) ; null si tout va bien
  function impasse(G, s) {
    for (const u of G.units) { const m = manque(G, s, u); if (m < 0 || (m > 0 && !tient(G, libres(s, u), m))) return u; }
    return null;
  }

  // m zones dans m lignes (sens 'zones') ou m lignes dans m zones (sens 'lignes'), pour les lignes puis les colonnes, m croissant
  function confine(G, s, mMax) {
    const n = G.n, zones = G.units.slice(2 * n), zm = zones.map(z => manque(G, s, z)), zf = zones.map(z => libres(s, z));
    for (let m = 1; m <= Math.min(mMax, n - 1); m++) for (const o of [0, 1]) for (let a = 0; a + m <= n; a++) {
      const b = a + m - 1, lines = G.units.slice(o * n + a, o * n + b + 1), pos = i => o ? i % n : i / n | 0, dans = i => pos(i) >= a && pos(i) <= b;
      let needL = 0; for (const l of lines) needL += manque(G, s, l);
      if (!needL) continue;
      // (A) les zones entièrement dans la bande prennent-elles toutes ses reines ?
      const zin = []; let needZ = 0;
      zones.forEach((z, zi) => { if (zm[zi] > 0 && zf[zi].length && zf[zi].every(dans)) { zin.push(zi); needZ += zm[zi]; } });
      if (needZ > needL) return { t: 'faux', unit: lines[0] };
      if (needZ === needL) { const out = []; for (const l of lines) for (const i of l.cells) if (s[i] === VIDE && !zin.includes(G.reg[i])) out.push(i); if (out.length) return { t: 'confine', sens: 'zones', o, a, b, m, zones: zin, out }; }
      // (B) les lignes de la bande ne touchent-elles que des zones qui n'ont rien d'autre à donner ?
      const zt = []; let needT = 0;
      zones.forEach((z, zi) => { if (zf[zi].some(dans)) { zt.push(zi); needT += zm[zi]; } });
      if (needT < needL) return { t: 'faux', unit: lines[0] };
      if (needT === needL) { const out = []; for (const zi of zt) for (const i of zf[zi]) if (!dans(i)) out.push(i); if (out.length) return { t: 'confine', sens: 'lignes', o, a, b, m, zones: zt, out }; }
    }
    return null;
  }
  function seul(G, s) {
    for (const u of G.units) {
      const m = manque(G, s, u); if (m <= 0) { if (m < 0) return { t: 'faux', unit: u }; continue; }
      const f = libres(s, u); if (f.length < m || !tient(G, f, m)) return { t: 'faux', unit: u };
      if (f.length === m) return { t: 'seul', unit: u, place: f };
    }
    return null;
  }
  // applique une étape ; false si elle révèle une contradiction
  function appliquer(G, s, e) {
    if (e.t === 'faux') return false;
    if (e.place) for (const i of e.place) { if (s[i] !== VIDE) return false; poser(G, s, i); }
    if (e.out) for (const i of e.out) if (s[i] === VIDE) s[i] = CROIX;
    return true;
  }
  // déroule seul + confine jusqu'au bout ; false si contradiction
  function derouler(G, s, mMax) {
    for (;;) { const e = seul(G, s) || confine(G, s, mMax); if (!e) return !impasse(G, s); if (!appliquer(G, s, e)) return false; }
  }
  // Prochaine déduction depuis l'état s (rangé), ou null si aucun raisonnement connu ne s'applique. niveau : 1 seul, 2 confine, 3 bloque, 4 essai.
  function etape(G, s, niveau = 4) {
    let e = seul(G, s); if (e) return e;
    if (niveau < 2) return null;
    e = confine(G, s, G.n); if (e) return e;
    if (niveau < 3) return null;
    for (let i = 0; i < G.N; i++) if (s[i] === VIDE) { const t = s.slice(); poser(G, t, i); const u = impasse(G, t); if (u) return { t: 'bloque', cell: i, unit: u, out: [i] }; }
    if (niveau < 4) return null;
    for (let i = 0; i < G.N; i++) if (s[i] === VIDE) { const t = s.slice(); poser(G, t, i); if (!derouler(G, t, 2)) return { t: 'essai', cell: i, out: [i] }; }
    return null;
  }
  const POIDS = { seul: 1, bloque: 6, essai: 16 }, RANG = { seul: 1, confine: 2, bloque: 3, essai: 4 };
  const poids = e => e.t === 'confine' ? (e.m === 1 ? 2 : e.m === 2 ? 4 : 7) + (e.sens === 'lignes' ? 1 : 0) : POIDS[e.t];
  // Résout par raisonnement. { ok, s (solution), score, rang (raisonnement le plus dur : 1 à 4), m (plus grande bande confinée), compte: { seul, confine… } }
  function resoudre(G, niveau = 4) {
    const s = new Uint8Array(G.N), r = { ok: false, s, score: 0, rang: 0, m: 0, compte: { seul: 0, confine: 0, bloque: 0, essai: 0 }, etapes: 0 };
    for (;;) {
      if (s.indexOf(VIDE) < 0) { r.ok = !impasse(G, s) && G.units.every(u => reines(s, u) === G.k); return r; }
      const e = etape(G, s, niveau); if (!e || !appliquer(G, s, e)) return r;
      r.score += poids(e); r.compte[e.t]++; r.etapes++; r.rang = Math.max(r.rang, RANG[e.t]); if (e.t === 'confine') r.m = Math.max(r.m, e.m);
    }
  }
  // Compte les solutions par essais systématiques (jusqu'à `max`) : contrôle indépendant des raisonnements. Renvoie la liste des solutions (cases des reines).
  function solutions(G, max = 2) {
    const n = G.n, k = G.k, col = new Uint8Array(n), zon = new Uint8Array(n), q = [], found = [];
    const row = (r, c0, left) => {
      if (found.length >= max) return;
      if (!left) { if (r === n - 1) found.push(q.slice()); else row(r + 1, 0, k); return; }
      for (let c = c0; c < n; c++) {
        const i = r * n + c, z = G.reg[i]; if (col[c] >= k || zon[z] >= k) continue;
        let bad = false; for (let x = q.length - 1; x >= 0 && q[x] >= (r - 1) * n; x--) if (touche(G, i, q[x])) { bad = true; break; }
        if (bad) continue;
        col[c]++; zon[z]++; q.push(i); row(r, c + 2, left - 1); q.pop(); col[c]--; zon[z]--;
        if (found.length >= max) return;
      }
    };
    row(0, 0, k); return found;
  }

  // ------------------------------------------------------------ FABRICATION DES GRILLES (10 oct. 2026 : ici et plus dans l'outil, pour que le jeu
  // fabrique lui-même la grille du jour et les niveaux au-delà du fichier). Tout part d'une graine et n'utilise que des opérations exactes (entiers,
  // multiplications, comparaisons : ni puissance ni fonction mathématique dont le dernier chiffre varie d'un téléphone à l'autre) : la même graine donne
  // la même grille partout. Une grille : une solution au hasard, des zones qui poussent à partir des reines, puis des retouches de frontière tant qu'une
  // autre solution existe (la case d'une reine de l'autre solution change de zone : l'autre solution tombe, la nôtre reste).
  function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const melanger = (a, rnd) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  const voisins4 = (n, i) => { const r = i / n | 0, c = i % n, a = []; if (r) a.push(i - n); if (r < n - 1) a.push(i + n); if (c) a.push(i - 1); if (c < n - 1) a.push(i + 1); return a; };
  // une solution au hasard : k reines par ligne et par colonne, sans contact
  function solutionAuHasard(n, k, rnd) {
    const col = new Uint8Array(n), q = [], t = (i, j) => Math.abs((i / n | 0) - (j / n | 0)) <= 1 && Math.abs(i % n - j % n) <= 1;
    const row = (r, left) => {
      if (!left) return r === n - 1 || row(r + 1, k);
      for (const c of melanger(Array.from({ length: n }, (_, c) => c), rnd)) {
        const i = r * n + c; if (col[c] >= k || q.some(j => t(i, j))) continue;
        if (n - 1 - r < k - col[c] - 1) continue;   // cette colonne ne pourrait plus être complétée
        col[c]++; q.push(i); if (row(r, left - 1)) return true; q.pop(); col[c]--;
      }
      return false;
    };
    return row(0, k) ? q.slice().sort((a, b) => a - b) : null;
  }
  // zones qui poussent à partir de n reines, chacune finissant avec k reines ; null si la pousse se coince
  function zonesAuHasard(n, k, sol, rnd) {
    const N = n * n, reg = new Int8Array(N).fill(-1), isQ = new Uint8Array(N); for (const i of sol) isQ[i] = 1;
    const seeds = melanger(sol.slice(), rnd).slice(0, n), nq = new Uint8Array(n), w = [], front = [];
    seeds.forEach((i, z) => { const x = rnd(); reg[i] = z; nq[z] = 1; w.push(.25 + x * x * 3); front.push(voisins4(n, i)); });   // poids inégaux : des zones de tailles variées
    for (;;) {
      let tot = 0; for (let z = 0; z < n; z++) if (front[z].length) tot += w[z];
      if (!tot) break;
      let x = rnd() * tot, z = 0; for (; z < n; z++) if (front[z].length && (x -= w[z]) <= 0) break; if (z >= n) z = front.findIndex(f => f.length);
      const f = front[z], a = Math.floor(rnd() * f.length), i = f[a]; f[a] = f[f.length - 1]; f.pop();
      if (reg[i] >= 0 || (isQ[i] && nq[z] >= k)) continue;
      reg[i] = z; nq[z] += isQ[i]; for (const j of voisins4(n, i)) if (reg[j] < 0) f.push(j);
    }
    if (reg.includes(-1) || nq.some(x => x !== k)) return null;
    return reg;
  }
  function connexeSans(n, reg, z, b) {
    const cells = []; for (let i = 0; i < reg.length; i++) if (reg[i] === z && i !== b) cells.push(i);
    if (!cells.length) return false;
    const seen = new Set([cells[0]]), todo = [cells[0]];
    while (todo.length) for (const j of voisins4(n, todo.pop())) if (reg[j] === z && j !== b && !seen.has(j)) { seen.add(j); todo.push(j); }
    return seen.size === cells.length;
  }
  const lettres = reg => { const map = {}; let next = 0, s = ''; for (const z of reg) { if (map[z] === undefined) map[z] = next++; s += String.fromCharCode(65 + map[z]); } return s; };
  // une grille à solution unique { n, k, z, sol }, ou null
  function fabriquer(n, k, rnd) {
    const sol = solutionAuHasard(n, k, rnd); if (!sol) return null;
    const reg = zonesAuHasard(n, k, sol, rnd); if (!reg) return null;
    const inA = new Set(sol), same = q => q.every(i => inA.has(i));
    for (let it = 0; it < 400; it++) {
      const other = solutions(grille(n, k, reg), 2).find(q => !same(q));
      if (!other) return { n, k, z: lettres(reg), sol };
      let done = false;
      for (const b of melanger(other.filter(i => !inA.has(i)), rnd)) {
        const z = reg[b], zs = [...new Set(voisins4(n, b).map(j => reg[j]).filter(y => y !== z))];
        if (!zs.length || !connexeSans(n, reg, z, b)) continue;
        reg[b] = zs[Math.floor(rnd() * zs.length)]; done = true; break;
      }
      if (!done) return null;
    }
    return null;
  }
  // note une grille fabriquée : { n, k, z, score, rang, m, compte }, ou null si le raisonnement ne suffit pas
  function noter(g) {
    const r = resoudre(grille(g.n, g.k, g.z)); if (!r.ok) return null;
    return { n: g.n, k: g.k, z: g.z, score: r.score, rang: r.rang, m: r.m, compte: r.compte };
  }
  // Grille de côté n pour une graine : la plus proche du score visé parmi `essais` grilles sans essai (rang 3 au plus). Sert à la grille du jour et aux
  // niveaux au-delà du fichier. `essais` grilles à fabriquer : garder ce nombre petit sur un téléphone.
  function choisir(n, graine, score, essais) {
    const rnd = seeded(graine); let best = null;
    for (let got = 0, t = 0; got < essais && t < essais * 80; t++) {
      const g = fabriquer(n, 1, rnd), x = g && noter(g); if (!x || x.rang > 3) continue;
      got++; if (!best || Math.abs(x.score - score) < Math.abs(best.score - score)) best = x;
    }
    return best;
  }
  // score visé à la place p (0 = la plus facile, 1 = la plus dure) d'après les déciles d'une taille (11 valeurs, écrites dans niveaux.js par l'outil)
  function scoreVise(deciles, p) { const x = Math.max(0, Math.min(1, p)) * 10, i = Math.min(9, Math.floor(x)); return deciles[i] + (deciles[i + 1] - deciles[i]) * (x - i); }
  // COURBE SANS FIN (niveaux après la montée des tailles) : une vague de 20 niveaux qui remonte doucement, un niveau difficile tous les 5, un répit juste après
  function vague(L) {
    if (L % 5 === 0) return { p: .92 + .06 * ((L % 20) / 20), h: 1 };
    if (L % 5 === 1) return { p: .18, h: 0 };
    return { p: .38 + .4 * ((L % 20) / 20) + ((L % 5) - 3) * .03, h: 0 };
  }

  const api = { VIDE, REINE, CROIX, grille, poser, etape, appliquer, resoudre, solutions, impasse, touche, reines, libres, manque,
    seeded, fabriquer, noter, choisir, scoreVise, vague };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Logique = api;
})(typeof window !== 'undefined' ? window : globalThis);
