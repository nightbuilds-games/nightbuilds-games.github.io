/* shell.js — COQUILLE commune des jeux (30 sept. 2026) : écran titre, carte des niveaux, pause, écran de résultat, réglages, sauvegarde.
   Menus en HTML par-dessus le canevas (nets à toute taille, accessibles, et le jeu est en pause dessous : aucun dessin, batterie épargnée).

   Contrat avec le jeu :
     le jeu appelle  Shell.register({ startLevel(n), setMusic(on), level() })  après Core.start(),
     puis  Shell.levelWon({ level, stars, time })  à la victoire et  Shell.levelFailed({ level })  à l'échec.
   Configuration par jeu :  Shell.init({ id, title: { fr, en }, colors: { … }, maxShown })  (voir gelees/index.html).

   Sauvegarde : un objet JSON par jeu (clé « <id>.save »), chargé une fois au démarrage puis réécrit à chaque changement. Aujourd'hui dans
   localStorage ; dans l'appli, le module Preferences de Capacitor (stockage natif, que iOS ne purge pas) prend le relais automatiquement.
   Format versionné (v) : un changement de format se migre dans migrate().

   ÉCONOMIE (30 sept. 2026, modèle hybride du genre : pub récompensée, pub entre niveaux limitée, « Sans pubs », pièces et bonus) :
     - pièces : 100 offertes ; première victoire d'un niveau = 10 + 5 par étoile, victoire rejouée = 5 ; « ×2 » par pub récompensée
       sur l'écran de résultat (une fois par victoire) ; pièces gratuites par pub dans la boutique (5 par jour) ;
     - secours : le jeu appelle  Shell.requestRescue({ onAccept, onDecline })  quand le joueur touche son bouton de secours : 60 pièces,
       ou une pub récompensée, ou « non merci » (onDecline, facultatif : le jeu garde sinon son écran d'échec) ;
     - pub entre niveaux : seulement en passant au niveau suivant, à partir du niveau ECONOMY.interFrom, au plus une toutes les
       ECONOMY.interGap s, jamais après « Sans pubs » ; les pubs récompensées restent proposées après « Sans pubs » (le joueur les choisit) ;
     - boutique : packs de pièces, « Sans pubs », restauration des achats. Pubs et achats passent par engine/monet.js (simulés en dev).

   PROGRESSION (4 oct. 2026, d'après la veille concurrence, concurrence-jellies.md) : le jeu peut décrire ses niveaux à l'enregistrement,
     Shell.register({ …, hard(n) → 0 | 1 | 2, chapter(n) → { index, from, to, name, color }, news: [{ level, key, icon, title, text }] }) :
     - carte des niveaux en chemin (du bas vers le haut), bandeau par zone, zone suivante annoncée avec son cadenas ET son niveau ;
     - niveaux difficiles annoncés (carte, bouton JOUER) et mieux payés ; cadeau en pièces tous les ECONOMY.gift.every niveaux ;
     - nouveauté : écran « NOUVEAU ! » avant le premier niveau qui l'utilise, annoncée à l'avance sur l'écran titre et sur la carte.
     Tout est facultatif : un jeu qui ne décrit rien garde une carte en chemin simple, avec les cadeaux.

   AIDES EN COURS DE NIVEAU (4 oct. 2026) : le jeu déclare  boosts: [{ key, level, cost, icon, title, text }]  et  useBoost(key) → true si l'aide
     a pu servir ou attend sa cible. La coquille pose une rangée de boutons en bas du canevas (cadenas ET niveau tant que l'aide n'est pas
     débloquée, le compte ensuite, « + » à zéro), en offre une au déblocage (écran « NOUVEAU ! »), puis vend les recharges en pièces. Le jeu
     appelle  Shell.boostUsed(key)  quand l'aide a vraiment servi, et  Shell.boostAim(key | null)  pendant qu'elle attend sa cible.
   RÉGLAGE « Symboles des couleurs » (daltoniens) : proposé si le jeu déclare  symbols: true  ; le jeu lit  Shell.save.settings.symbols.
   DEMANDE DE NOTE (module natif InAppReview, sans effet ailleurs) : une seule fois, après une victoire à 3 étoiles à partir du niveau
     ECONOMY.reviewFrom, sur l'écran de résultat (jamais en plein niveau). Apple décide seul d'afficher ou non sa fenêtre.

   DÉMO DU SITE (5 oct. 2026, plan.md section 13.3) : Shell.init({ demo: { levels, url, label } }), ou window.GAME_DEMO posé par la page
     (jeux/build.js --demo). Les `levels` premiers niveaux seulement, puis l'écran « La suite dans l'appli » ; pubs et achats coupés, pas de
     boutique ; bouton de téléchargement (`url` du store, `label` : 'preorder' ou 'download' ; sans `url`, « Bientôt sur l'App Store ») sur
     l'écran titre, l'écran de résultat et l'écran de fin ; sauvegarde à part (« <id>.demo.save »), dans le navigateur seulement.

   AIDES ILLIMITÉES (10 oct. 2026, facultatif) : un jeu qui déclare  unlimited: true  propose en boutique l'achat « Sans pubs + aides illimitées »
     (produit no_ads_plus) ; une fois acheté (`plus` dans la sauvegarde, qui vaut aussi « Sans pubs »), les aides ne se décomptent plus et affichent « ∞ ».

   GRILLE DU JOUR (10 oct. 2026, facultative) : le jeu déclare  daily: { start(), active() }  ; la coquille pose le bouton « GRILLE DU JOUR » sur l'écran
     titre (série de jours, « faite aujourd'hui »), lance  daily.start()  et tient la série dans la sauvegarde (`daily` : dernier jour réussi, série, record).
     Le jeu appelle  Shell.dailyWon({ stars, time })  à la victoire : série, pièces (ECONOMY.daily, une fois par jour), écran de résultat. Pas dans la démo.

   TUTORIEL (30 sept. 2026) : Shell.hint(clé, { path, text }) / Shell.hintDone(clé), une main animée qui montre le geste jusqu'au premier succès. */
(function (global) {
  const C = global.Core;
  // textes des menus : traduits, puis typographie française (espace insécable avant ! ? : ; — sinon « RÉUSSI ! » laisse le « ! » seul à la ligne)
  const tr = (s, v) => C.tr(s, v).replace(/ ([!?:;])/g, ' $1');
  C.i18n({
    'JOUER': 'PLAY', 'NIVEAU {n}': 'LEVEL {n}', 'NIVEAUX': 'LEVELS', 'RÉGLAGES': 'SETTINGS', 'PAUSE': 'PAUSED', 'REPRENDRE': 'RESUME',
    'RECOMMENCER': 'RESTART', 'SUIVANT': 'NEXT', 'REJOUER': 'REPLAY', 'Son': 'Sound', 'Musique': 'Music', 'Vibrations': 'Vibration',
    'NIVEAU {n} RÉUSSI !': 'LEVEL {n} CLEARED!', 'Temps : {t}': 'Time: {t}', 'Record : {t}': 'Best: {t}', 'NOUVEAU RECORD !': 'NEW BEST!',
    'Effacer la progression': 'Reset progress', 'Effacer toute la progression ? Les étoiles et les niveaux débloqués seront perdus.': 'Reset all progress? Stars and unlocked levels will be lost.',
    'Retour': 'Back', 'Pause': 'Pause', 'Niveau verrouillé': 'Locked level', 'Politique de confidentialité': 'Privacy policy',
    'BOUTIQUE': 'SHOP', 'Pièces': 'Coins', '×2 avec une pub': '×2 with an ad', 'CONTINUER ?': 'CONTINUE?', 'CONTINUER': 'CONTINUE', 'Continuer · {c}': 'Continue · {c}',
    'Regarder une pub': 'Watch an ad', 'Non merci': 'No thanks', 'Pas assez de pièces': 'Not enough coins', 'Sans pubs': 'No ads', 'Acheté': 'Owned',
    'Pièces gratuites (pub)': 'Free coins (ad)', 'Restaurer les achats': 'Restore purchases', 'Plus de pièces gratuites aujourd’hui': 'No more free coins today',
    'Plus de pubs entre les niveaux': 'Removes ads between levels', 'Statistiques anonymes': 'Anonymous statistics', 'Confidentialité des pubs': 'Ad privacy choices', 'Achats restaurés': 'Purchases restored', 'Aucun achat à restaurer': 'No purchases to restore', 'Pubs et achats simulés (développement)': 'Simulated ads and purchases (development)',
    'DIFFICILE': 'HARD', 'TRÈS DIFFICILE': 'VERY HARD', 'Zone {z}': '{z} zone', 'NOUVEAU !': 'NEW!', 'C’EST PARTI': 'LET’S GO', 'niveau {n}': 'level {n}',
    'NOUVELLE AIDE !': 'NEW HELPER!', 'Une offerte pour l’essayer': 'One free to try it', 'Acheter · {c}': 'Buy · {c}', 'Symboles des couleurs': 'Color symbols', 'Niv. {n}': 'Lv. {n}',
    'LA SUITE DANS L’APPLI': 'MORE IN THE APP', 'BRAVO !': 'WELL DONE!', 'Tu as fini la démo. Dans l’appli : six mondes, des centaines de niveaux et de nouvelles surprises.': 'You finished the demo. In the app: six worlds, hundreds of levels and new surprises.',
    'Télécharger': 'Download', 'Précommander': 'Pre-order', 'Bientôt': 'Coming soon', 'sur l’App Store': 'on the App Store', 'Gratuit sur iPhone': 'Free on iPhone',
    'Démo : {n} niveaux. Ta progression reste dans ce navigateur.': 'Demo: {n} levels. Your progress stays in this browser.',
    'Sans pubs + aides illimitées': 'No ads + unlimited helpers', 'Plus de pubs entre les niveaux, indices et vérifications à volonté': 'No ads between levels, unlimited hints and checks', 'Aides illimitées': 'Unlimited helpers',
    'GRILLE DU JOUR': 'DAILY PUZZLE', 'GRILLE DU JOUR RÉUSSIE !': 'DAILY PUZZLE SOLVED!', 'Série : {n} jours': 'Streak: {n} days', 'Série : {n} jour': 'Streak: {n} day',
    'Faite aujourd’hui': 'Done today', 'Une nouvelle grille chaque jour': 'A new puzzle every day', 'Reviens demain pour continuer ta série': 'Come back tomorrow to keep your streak',
    'Cadeau au niveau {n}': 'Gift at level {n}', 'Cadeau du niveau {n}': 'Level {n} gift', 'Bonus niveau difficile': 'Hard level bonus', 'Nouveauté': 'New', 'Prochaine nouveauté': 'Coming up', 'Prochaine aide': 'Next booster', 'Encore {n} niveaux': '{n} levels to go', 'Encore {n} niveau': '{n} level to go', 'Au prochain niveau !': 'Next level!',
  });
  const ECONOMY = { start: 100, firstWin: 10, perStar: 5, replayWin: 5, rescue: 60, freeCoins: 25, freePerDay: 5, interFrom: 8, interGap: 150,
    hardBonus: 10, gift: { every: 5, coins: 30 }, reviewFrom: 8, daily: 20 };   // daily : pièces de la grille du jour (une fois par jour)
   // bonus de première victoire d'un niveau difficile (×2 si très difficile) ; cadeau tous les 5 niveaux (première victoire)
  // Un jeu peut régler sa propre économie : Shell.register({ economy: { firstWin, perStar, … } }) remplace les valeurs ci-dessus pour ce jeu seulement.

  // ------------------------------------------------------------ stockage
  const cap = () => C.native('Preferences');
  const store = {
    async get(k) { const p = cap(); if (p) { const r = await p.get({ key: k }); return r && r.value; } try { return localStorage.getItem(k); } catch (_) { return null; } },
    async set(k, v) { const p = cap(); if (p) return p.set({ key: k, value: v }); try { localStorage.setItem(k, v); } catch (_) { } },
  };
  const DEFAULT = () => ({ v: 1, unlocked: 1, stars: {}, best: {}, wins: {}, fails: {}, settings: { sound: true, music: true, haptics: true, stats: true, symbols: false },
    coins: ECONOMY.start, noAds: false, plus: false, free: { day: '', n: 0 }, spent: 0, earned: 0, rescues: 0, tuto: {}, seen: {}, boosts: {}, asked: 0, daily: { last: 0, streak: 0, best: 0 } });   // seen : nouveautés déjà présentées
  function migrate(s) { const d = DEFAULT(); if (!s || typeof s !== 'object') return d; s = Object.assign(d, s); s.settings = Object.assign(DEFAULT().settings, s.settings); s.daily = Object.assign(DEFAULT().daily, s.daily); return s; }
  let cfg = null, save = DEFAULT(), game = null, key = '';
  const demo = () => (cfg && cfg.demo) || null;   // démo du site : niveaux limités, ni pubs, ni achats, ni boutique
  const inDemo = n => !demo() || n <= demo().levels;
  const persist = () => store.set(key, JSON.stringify(save));
  // statistiques (engine/stats.js) : sans effet si le jeu n'a pas de clés GameAnalytics, ou en développement (voir stats.js)
  const S = global.Stats || { init() { }, setEnabled() { }, level() { }, coins() { }, ad() { }, purchase() { }, event() { } };
  async function rewarded(place) { S.ad('rewarded_video', place, 'show'); const ok = await Monet.ads.rewarded(); if (ok) S.ad('rewarded_video', place, 'reward_received'); return ok; }

  // ------------------------------------------------------------ éléments
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
  const ICON = {
    pause: '<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" rx="1.5"/><rect x="14" y="4" width="4" height="16" rx="1.5"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8.4 2.3-1.9-.3a6.9 6.9 0 0 0-.7-1.6l1.1-1.6a.8.8 0 0 0-.1-1l-1.1-1.1a.8.8 0 0 0-1-.1l-1.6 1.1c-.5-.3-1-.5-1.6-.7l-.3-1.9a.8.8 0 0 0-.8-.6h-1.6a.8.8 0 0 0-.8.6l-.3 1.9c-.6.2-1.1.4-1.6.7L6.5 5.1a.8.8 0 0 0-1 .1L4.4 6.3a.8.8 0 0 0-.1 1l1.1 1.6c-.3.5-.5 1-.7 1.6l-1.9.3a.8.8 0 0 0-.6.8v1.6c0 .4.3.7.6.8l1.9.3c.2.6.4 1.1.7 1.6l-1.1 1.6a.8.8 0 0 0 .1 1l1.1 1.1c.3.3.7.3 1 .1l1.6-1.1c.5.3 1 .5 1.6.7l.3 1.9c.1.4.4.6.8.6h1.6c.4 0 .7-.3.8-.6l.3-1.9c.6-.2 1.1-.4 1.6-.7l1.6 1.1c.3.2.7.2 1-.1l1.1-1.1c.3-.3.3-.7.1-1l-1.1-1.6c.3-.5.5-1 .7-1.6l1.9-.3c.4-.1.6-.4.6-.8v-1.6a.8.8 0 0 0-.6-.8Z"/></svg>',
    back: '<svg viewBox="0 0 24 24"><path d="M15.5 4.5 8 12l7.5 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock: '<svg viewBox="0 0 24 24"><path d="M7 10V7.5a5 5 0 0 1 10 0V10h.5c.8 0 1.5.7 1.5 1.5v8c0 .8-.7 1.5-1.5 1.5h-11c-.8 0-1.5-.7-1.5-1.5v-8c0-.8.7-1.5 1.5-1.5H7Zm2.5 0h5V7.5a2.5 2.5 0 0 0-5 0V10Z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 2.6 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8Z"/></svg>',
    coin: '<svg class="coin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#FFC533" stroke="#b45309" stroke-width="2"/><circle cx="12" cy="12" r="6" fill="none" stroke="#b45309" stroke-width="1.6" opacity=".6"/><path d="M12 8v8" stroke="#b45309" stroke-width="2" stroke-linecap="round"/></svg>',
    shop: '<svg viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7L6 7Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M12 2c1 3.5 5.5 6 5.5 11.5a5.5 5.5 0 0 1-11 0c0-2 .8-3.4 1.8-4.6.4 1.5 1.2 2.3 2 2.6C9.8 8.5 10.5 5 12 2Z"/></svg>',
    gift: '<svg viewBox="0 0 24 24"><rect x="3.5" y="10.5" width="17" height="10.5" rx="2"/><rect x="2" y="6.5" width="20" height="4.6" rx="1.5"/><rect x="10.6" y="6.5" width="2.8" height="14.5" fill="#fff" opacity=".8"/><path d="M12 6.4C10 2 5.6 3.2 7.2 6.4M12 6.4c2-4.4 6.4-3.2 4.8 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ad: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="3"/><path d="m10 9 5 3-5 3Z" fill="rgba(0,0,0,.45)"/></svg>',
  };
  const coinTxt = n => '<span class="cointxt">' + ICON.coin + n + '</span>';
  let root, screens = {}, hudPause, current = null;
  const stars = (n, cls = '') => '<span class="stars ' + cls + '">' + [0, 1, 2].map(i => '<i class="' + (i < n ? 'on' : '') + '">' + ICON.star + '</i>').join('') + '</span>';
  function button(label, cls, onTap) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.addEventListener('click', e => { e.stopPropagation(); C.unlockAudio(); C.sfx.click(); C.haptic('light'); onTap(e); });
    return b;
  }
  // démo : bouton vers l'App Store (précommande puis téléchargement) ; sans adresse, simple annonce
  function storeButton(place, cls) {
    const D = demo(), b = el(D.url ? 'a' : 'span', 'btn store ' + (cls || '') + (D.url ? '' : ' soon'), '<small>' + tr(!D.url ? 'Bientôt' : D.label === 'preorder' ? 'Précommander' : 'Télécharger') + '</small>' + tr('sur l’App Store'));
    if (D.url) { b.href = D.url; b.target = '_blank'; b.rel = 'noopener'; b.addEventListener('click', e => { e.stopPropagation(); S.event('demo:store:' + place); }); }
    return b;
  }
  function toShop(back) { if (demo()) return; shopBack = back; show('shop'); }   // pas de boutique dans la démo
  function toggle(label, getOn, setOn) {
    const b = button('', 'toggle', () => { setOn(!getOn()); paint(); });
    const paint = () => { b.innerHTML = '<span>' + label + '</span><b>' + (getOn() ? 'ON' : 'OFF') + '</b>'; b.classList.toggle('off', !getOn()); };
    paint(); b.repaint = paint; return b;
  }

  // ------------------------------------------------------------ écrans
  // ------------------------------------------------------------ progression décrite par le jeu (facultative)
  const hardOf = n => game && game.hard ? game.hard(n) : 0;
  const chapterOf = n => game && game.chapter ? game.chapter(n) : null;
  const boostList = () => (game && game.boosts) || [];
  const illimite = () => !!(save.plus && game && game.unlimited);   // aides illimitées achetées
  // nouveautés du jeu, plus une par aide (présentée à son niveau de déblocage, avec un exemplaire offert)
  const newsList = () => ((game && game.news) || []).concat(boostList().map(b => ({ level: b.level, key: 'boost:' + b.key, icon: b.icon, title: b.title, text: b.text, boost: b.key })));
  const hardLabel = h => tr(h > 1 ? 'TRÈS DIFFICILE' : 'DIFFICILE');
  const nextGift = () => Math.ceil(save.unlocked / ECONOMY.gift.every) * ECONOMY.gift.every;   // prochain niveau à cadeau pas encore gagné
  let wallet;   // compteur de pièces (en haut à droite, sur tous les menus)
  function paintWallet(pop) { wallet.innerHTML = ICON.coin + '<b>' + save.coins + '</b>'; if (pop) { wallet.classList.remove('pop'); void wallet.offsetWidth; wallet.classList.add('pop'); } }
  function addCoins(n, why) { save.coins = Math.max(0, save.coins + n); if (n > 0) save.earned += n; else save.spent -= n; persist(); paintWallet(n > 0); if (n > 0) C.sfx.ding(4); S.coins(n, why); }
  function show(name) {
    for (const k in screens) screens[k].classList.toggle('on', k === name);
    current = name; root.classList.toggle('open', !!name);
    hudPause.classList.toggle('on', !name); if (boostBar) { boostBar.classList.toggle('on', !name && boostList().length > 0); if (!name) paintBoosts(); } wallet.classList.toggle('on', !!name && name !== 'pause' && name !== 'settings'); paintWallet();
    if (name) { if (screens[name].refresh) screens[name].refresh(); C.pause(true); } else C.pause(false);
  }
  // grille du jour : numéro du jour (date du téléphone), série en cours (perdue si un jour entier a été sauté)
  const today = () => { const d = new Date(); return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5); };
  const streakNow = () => save.daily.last >= today() - 1 ? save.daily.streak : 0;
  const streakTxt = n => tr(n > 1 ? 'Série : {n} jours' : 'Série : {n} jour', { n });
  function startDaily() { show(null); hint = null; S.event('daily:start'); game.daily.start(); }
  function buildTitle() {
    const s = el('section', 'screen title');
    const t = el('h1', 'logo'); s.appendChild(t);
    const zone = el('div', 'zone'); s.appendChild(zone);
    const teasers = el('div', 'teasers');
    const play = button('', 'big primary', () => startLevel(save.unlocked));
    const D = demo();
    const row = el('div', 'row');
    row.appendChild(button(tr('NIVEAUX'), 'secondary', () => { levelsBack = 'title'; show('levels'); }));
    if (!D) row.appendChild(button(ICON.shop, 'icon', () => toShop('title')));
    row.appendChild(button(ICON.gear, 'icon', () => { settingsBack = 'title'; show('settings'); }));
    const dailyBtn = button('', 'secondary daily', startDaily);
    s.appendChild(play); if (!D) s.appendChild(dailyBtn); s.appendChild(row); s.appendChild(teasers);
    if (D) { s.appendChild(storeButton('title')); s.appendChild(el('p', 'demo-note', tr('Démo : {n} niveaux. Ta progression reste dans ce navigateur.', { n: D.levels }))); }
    s.refresh = () => {
      const n = save.unlocked, h = hardOf(n), ch = chapterOf(n);
      t.textContent = C.byLang(cfg.title);
      play.innerHTML = tr('JOUER') + '<small>' + (inDemo(n) ? tr('NIVEAU {n}', { n }) + (h ? ' · ' + hardLabel(h) : '') : tr('LA SUITE DANS L’APPLI')) + '</small>'; play.classList.toggle('hard', !!h && inDemo(n));
      dailyBtn.style.display = game && game.daily ? '' : 'none';
      if (game && game.daily) { const done = save.daily.last === today(), st = streakNow(); dailyBtn.classList.toggle('done', done);
        dailyBtn.innerHTML = ICON.flame + tr('GRILLE DU JOUR') + '<small>' + (done ? tr('Faite aujourd’hui') + (st ? ' · ' : '') : '') + (st ? streakTxt(st) : done ? '' : tr('Une nouvelle grille chaque jour')) + '</small>'; }
      zone.style.display = ch ? '' : 'none';
      if (ch) { const len = ch.to - ch.from + 1, done = n - ch.from; zone.innerHTML = '<b>' + tr('Zone {z}', { z: ch.name }) + '</b><i><u style="width:' + Math.round(100 * done / len) + '%;background:' + ch.color + '"></u></i><span>' + done + ' / ' + len + '</span>'; }
      const nw = newsList().filter(x => x.level >= n && !save.seen[x.key] && inDemo(x.level)).sort((a, b) => a.level - b.level)[0];
      teasers.innerHTML = (inDemo(nextGift()) ? '<span class="tag gift">' + ICON.gift + tr('Cadeau au niveau {n}', { n: nextGift() }) + '</span>' : '') +
        (nw ? '<span class="tag news">' + ICON.lock + C.byLang(nw.title) + ' · ' + tr('niveau {n}', { n: nw.level }) + '</span>' : '');
    };
    return s;
  }
  function buildLevels() {
    const s = el('section', 'screen levels');
    const head = el('header'); head.appendChild(button(ICON.back, 'icon', () => show(levelsBack))); head.appendChild(el('h2', '', tr('NIVEAUX'))); s.appendChild(head);
    // CHEMIN (4 oct. 2026, à la place de la grille) : le niveau 1 en bas, on monte ; un bandeau au début de chaque zone, la zone suivante annoncée
    // (cadenas et niveau, toujours les deux) ; niveaux difficiles marqués d'une flamme ; cadeau tous les 5 niveaux ; nouveautés à leur niveau.
    const map = el('div', 'map'); s.appendChild(map);
    s.refresh = () => {
      map.innerHTML = '';
      const cur = save.unlocked, chapters = !!(game && game.chapter), G = ECONOMY.gift;
      const D = demo(), last = D ? D.levels : chapters ? chapterOf(cur + 4).to : Math.max(cfg.maxShown || 24, Math.ceil((cur + 8) / 4) * 4);   // démo : la carte s'arrête au dernier niveau offert
      const ROW = 96, BAN = 84, items = []; let y = 30, curY = 0;   // y : distance au bas de la carte
      for (let i = 1; i <= last; i++) {
        const ch = chapterOf(i); if (ch && ch.from === i) { items.push({ ban: ch, y }); y += BAN; }
        items.push({ n: i, y, x: 50 + 26 * Math.sin(i * 1.1) }); y += ROW;
      }
      if (D) { items.push({ more: true, y }); y += BAN; } else if (chapters) { items.push({ ban: chapterOf(last + 1), y }); y += BAN; }
      const total = y + 20, inner = el('div', 'map-in'); inner.style.height = total + 'px';
      const pts = items.filter(it => it.n).map(it => [it.x, total - it.y - ROW / 2]);
      let d = 'M' + pts[0][0] + ' ' + pts[0][1]; for (let k = 1; k < pts.length; k++) { const [x0, y0] = pts[k - 1], [x1, y1] = pts[k], ym = (y0 + y1) / 2; d += ' C' + x0 + ' ' + ym + ' ' + x1 + ' ' + ym + ' ' + x1 + ' ' + y1; }
      inner.innerHTML = '<svg class="map-path" viewBox="0 0 100 ' + total + '" preserveAspectRatio="none"><path d="' + d + '" vector-effect="non-scaling-stroke"/></svg>';
      for (const it of items) {
        if (it.more) { const b = el('div', 'zone-ban locked', ICON.lock + '<b>' + tr('LA SUITE DANS L’APPLI') + '</b>'); b.style.bottom = it.y + 12 + 'px'; inner.appendChild(b); continue; }
        if (it.ban) {
          const lock = it.ban.from > cur;
          const b = el('div', 'zone-ban' + (lock ? ' locked' : ''), (lock ? ICON.lock : '') + '<b>' + tr('Zone {z}', { z: it.ban.name }) + '</b><small>' + (lock ? tr('niveau {n}', { n: it.ban.from }) : it.ban.from + ' – ' + it.ban.to) + '</small>');
          b.style.bottom = it.y + 12 + 'px'; if (!lock) b.style.background = it.ban.color; inner.appendChild(b); continue;
        }
        const i = it.n, open = i <= cur, h = hardOf(i);
        const b = el('button', 'node' + (open ? '' : ' locked') + (i === cur ? ' next' : '') + (h ? ' hard' + (h > 1 ? ' vhard' : '') : ''));
        b.innerHTML = '<b>' + i + '</b>' + (i < cur ? stars(save.stars[i] || 0, 'small') : '') + (h ? '<i class="flame">' + ICON.flame + '</i>' : '') + (open ? '' : '<i class="lock">' + ICON.lock + '</i>');
        b.style.left = it.x + '%'; b.style.bottom = it.y + 14 + 'px';
        b.setAttribute('aria-label', (open ? tr('NIVEAU {n}', { n: i }) : tr('Niveau verrouillé')) + (h ? ' · ' + hardLabel(h) : ''));
        if (open) b.addEventListener('click', () => { C.unlockAudio(); C.sfx.click(); C.haptic('light'); startLevel(i); });
        inner.appendChild(b); if (i === cur) curY = it.y;
        const tags = [], nw = newsList().find(x => x.level === i);
        if (h) tags.push('<span class="tag hardtag' + (h > 1 ? ' v' : '') + '">' + ICON.flame + hardLabel(h) + '</span>');
        if (nw) tags.push('<span class="tag news">' + (nw.icon || '') + C.byLang(nw.title) + '</span>');
        if (i % G.every === 0) tags.push('<span class="tag gift' + (save.wins[i] ? ' got' : '') + '">' + (save.wins[i] ? ICON.check : ICON.gift) + coinTxt(G.coins) + '</span>');
        if (tags.length) { const right = it.x < 50, t = el('div', 'tags ' + (right ? 'right' : 'left'), tags.join('')); t.style.bottom = it.y + 14 + 'px'; t.style[right ? 'left' : 'right'] = 'calc(' + (right ? it.x : 100 - it.x) + '% + 48px)'; inner.appendChild(t); }
      }
      map.appendChild(inner);
      setTimeout(() => { map.scrollTop = total - curY - ROW / 2 - map.clientHeight / 2; }, 0);
    };
    return s;
  }
  let levelsBack = 'title', settingsBack = 'title';
  function buildPause() {
    const s = el('section', 'screen pause'); const p = el('div', 'panel');
    p.appendChild(el('h2', '', tr('PAUSE')));
    p.appendChild(button(tr('REPRENDRE'), 'big primary', () => show(null)));
    p.appendChild(button(tr('RECOMMENCER'), 'secondary', () => game.daily && game.daily.active() ? startDaily() : startLevel(game.level())));
    p.appendChild(button(tr('NIVEAUX'), 'secondary', () => { levelsBack = 'pause'; show('levels'); }));
    if (!demo()) p.appendChild(button(tr('BOUTIQUE'), 'secondary', () => toShop('pause')));
    const tg = [soundToggle(), musicToggle()]; const row = el('div', 'row'); tg.forEach(x => row.appendChild(x));
    row.appendChild(button(ICON.gear, 'icon', () => { settingsBack = 'pause'; show('settings'); })); p.appendChild(row);
    s.appendChild(p); s.refresh = () => tg.forEach(x => x.repaint()); return s;
  }
  let resultEl = null;
  function buildResult() {
    const s = el('section', 'screen result'); const p = el('div', 'panel');
    resultEl = { h: el('h2'), st: el('div', 'bigstars'), time: el('p', 'time'), best: el('p', 'best'), gain: el('p', 'gain'), extra: el('div', 'extra'), next: el('div', 'nextnews') };
    // gain de pièces, doublé par une pub récompensée (une fois par victoire)
    resultEl.dbl = button('', 'ad', async () => {
      if (resultEl.doubled) return; resultEl.dbl.disabled = true;
      if (await rewarded('double')) { resultEl.doubled = true; addCoins(resultEl.coins, 'double'); resultEl.gain.innerHTML = '+' + coinTxt(resultEl.coins * 2); resultEl.dbl.style.display = 'none'; }
      else resultEl.dbl.disabled = false;
    });
    p.appendChild(resultEl.h); p.appendChild(resultEl.st); p.appendChild(resultEl.time); p.appendChild(resultEl.best); p.appendChild(resultEl.gain); p.appendChild(resultEl.extra); p.appendChild(resultEl.next); p.appendChild(resultEl.dbl);
    p.appendChild(button(tr('SUIVANT'), 'big primary', () => resultEl.daily ? startLevel(save.unlocked) : nextLevel(resultEl.level + 1)));   // après la grille du jour : retour au niveau en cours
    const row = el('div', 'row');
    row.appendChild(button(tr('REJOUER'), 'secondary', () => resultEl.daily ? startDaily() : startLevel(resultEl.level)));
    row.appendChild(button(tr('NIVEAUX'), 'secondary', () => { levelsBack = 'result'; show('levels'); }));
    p.appendChild(row); if (demo()) p.appendChild(storeButton('result', 'small')); s.appendChild(p); return s;
  }
  // démo : écran de fin, après le dernier niveau offert
  function buildDemoEnd() {
    const s = el('section', 'screen news demo-end'); const p = el('div', 'panel'); s.appendChild(p);
    p.appendChild(el('h2', '', tr('BRAVO !'))); p.appendChild(el('h3', '', tr('LA SUITE DANS L’APPLI')));
    p.appendChild(el('p', '', tr('Tu as fini la démo. Dans l’appli : six mondes, des centaines de niveaux et de nouvelles surprises.')));
    p.appendChild(storeButton('end', 'big')); p.appendChild(el('p', 'best', tr('Gratuit sur iPhone')));
    p.appendChild(button(tr('NIVEAUX'), 'secondary', () => { levelsBack = 'demo'; show('levels'); }));
    s.refresh = () => S.event('demo:end');
    return s;
  }
  // pièces qui s'envolent du gain vers le compteur, une à une, avec un tintement qui monte (vu chez Color Block Jam : la récompense se voit et s'entend)
  function flyCoins(from, n) {
    setTimeout(() => {
      const a = from.getBoundingClientRect(), b = wallet.getBoundingClientRect(); if (current !== 'result' || !a.width || !b.width) return;
      for (let i = 0; i < n; i++) setTimeout(() => {
        const c = el('div', 'flycoin', ICON.coin); document.body.appendChild(c);
        c.style.transform = 'translate(' + (a.left + a.width / 2 - 14 + (Math.random() - .5) * 70) + 'px,' + (a.top + a.height / 2 - 14 + (Math.random() - .5) * 24) + 'px) scale(.7)';
        void c.offsetWidth; c.style.transform = 'translate(' + (b.left + 6) + 'px,' + (b.top + 6) + 'px) scale(1)';
        setTimeout(() => { c.remove(); wallet.classList.remove('pop'); void wallet.offsetWidth; wallet.classList.add('pop'); C.sfx.ding(Math.min(i, 7) * 2 - 5); C.haptic('light'); }, 520);
      }, i * 80);
    }, 420);
  }
  // ---------------- aides en cours de niveau : rangée de boutons posée sur le bas du canevas (placée par placeHud), fenêtre d'achat à zéro
  let boostBar = null, buyKey = null, aimKey = null;
  function paintBoosts() {
    if (!boostBar) return; const list = boostList(); boostBar.innerHTML = ''; let changed = false;
    for (const b of list) {
      const k = 'boost:' + b.key, open = save.unlocked >= b.level;
      if (save.unlocked > b.level && !save.seen[k]) { save.seen[k] = true; save.boosts[b.key] = (save.boosts[b.key] || 0) + 1; changed = true; }   // sauvegarde d'avant les aides : l'exemplaire offert n'est pas perdu
      const n = illimite() ? '∞' : save.boosts[b.key] || 0;
      const el2 = el('button', 'boost' + (open ? '' : ' locked') + (aimKey === b.key ? ' aim' : ''), '<span class="ic">' + (b.icon || '') + '</span>' +
        (open ? '<b class="' + (n ? '' : 'plus') + '">' + (n || '+') + '</b>' : '<i>' + ICON.lock + '</i><small>' + tr('Niv. {n}', { n: b.level }) + '</small>'));
      el2.setAttribute('aria-label', C.byLang(b.title));
      el2.addEventListener('click', e => {
        e.stopPropagation(); C.unlockAudio(); C.sfx.click(); C.haptic('light'); if (!open || current) return;
        if (illimite() || (save.boosts[b.key] || 0) > 0) game.useBoost(b.key); else { buyKey = b.key; show('buy'); }
      });
      boostBar.appendChild(el2);
    }
    if (changed) persist();
  }
  function buildBuy() {
    const s = el('section', 'screen news buy'); const p = el('div', 'panel'); s.appendChild(p);
    s.refresh = () => {
      const b = boostList().find(x => x.key === buyKey); p.innerHTML = ''; if (!b) return;
      const enough = save.coins >= b.cost;
      p.appendChild(el('div', 'news-icon', b.icon || '')); p.appendChild(el('h3', '', C.byLang(b.title))); p.appendChild(el('p', '', C.byLang(b.text)));
      p.appendChild(button(tr('Acheter · {c}', { c: coinTxt(b.cost) }), 'big primary', () => {
        if (!enough) return toShop('buy');
        addCoins(-b.cost, 'boost:' + b.key); save.boosts[b.key] = (save.boosts[b.key] || 0) + 1; persist(); S.event('boost:buy:' + b.key); show(null); game.useBoost(b.key);
      }));
      if (!enough) p.appendChild(el('p', 'best', tr('Pas assez de pièces')));
      if (game.unlimited && !demo() && Monet.store.available) p.appendChild(button(tr('Aides illimitées'), 'secondary', () => toShop('buy')));
      p.appendChild(button(tr('Non merci'), 'danger', () => show(null)));
    };
    return s;
  }
  // nouveauté : présentée une fois, juste avant le premier niveau qui l'utilise
  let newsPending = null;
  function buildNews() {
    const s = el('section', 'screen news'); const p = el('div', 'panel'); s.appendChild(p);
    s.refresh = () => {
      const nw = newsPending.item; p.innerHTML = '';
      p.appendChild(el('h2', '', tr(nw.boost ? 'NOUVELLE AIDE !' : 'NOUVEAU !'))); p.appendChild(el('div', 'news-icon', nw.icon || '')); p.appendChild(el('h3', '', C.byLang(nw.title))); p.appendChild(el('p', '', C.byLang(nw.text)));
      if (nw.boost) p.appendChild(el('p', 'best record', tr('Une offerte pour l’essayer')));
      p.appendChild(button(tr('C’EST PARTI'), 'big primary', () => { save.seen[nw.key] = true; if (nw.boost) save.boosts[nw.boost] = (save.boosts[nw.boost] || 0) + 1; persist(); S.event('news:' + nw.key); const n = newsPending.level; newsPending = null; startLevel(n); }));
    };
    return s;
  }
  let shopBack = 'title', shopMsg = '';
  function buildShop() {
    const s = el('section', 'screen shop');
    const head = el('header'); head.appendChild(button(ICON.back, 'icon', () => show(shopBack))); head.appendChild(el('h2', '', tr('BOUTIQUE'))); s.appendChild(head);
    const p = el('div', 'panel'); s.appendChild(p);
    s.refresh = () => {
      p.innerHTML = '';
      const today = new Date().toISOString().slice(0, 10), freeLeft = save.free.day === today ? ECONOMY.freePerDay - save.free.n : ECONOMY.freePerDay;
      if (Monet.ads.available) {   // pièces gratuites contre une pub, 5 fois par jour
        const b = button(ICON.ad + '<span>' + tr('Regarder une pub') + '</span>' + coinTxt('+' + ECONOMY.freeCoins), 'item ad', async () => {
          if (freeLeft <= 0) return; b.disabled = true;
          if (await rewarded('free')) { save.free = { day: today, n: (save.free.day === today ? save.free.n : 0) + 1 }; addCoins(ECONOMY.freeCoins, 'free'); }
          s.refresh();
        });
        if (freeLeft <= 0) { b.disabled = true; b.innerHTML = '<span>' + tr('Plus de pièces gratuites aujourd’hui') + '</span>'; }
        p.appendChild(b);
      }
      // prix lus depuis le store : la boutique se redessine quand ils arrivent ; un produit sans prix n'est pas proposé
      if (Monet.store.available && !Monet.store.loaded) Monet.store.load().then(() => { if (Monet.store.loaded && current === 'shop') s.refresh(); });
      if (Monet.store.available) for (const pr of Monet.store.products) {
        if (!pr.price || (pr.kind === 'plus' && !(game && game.unlimited))) continue;
        const owned = (pr.kind === 'noads' && save.noAds) || (pr.kind === 'plus' && save.plus);
        const label = pr.kind === 'coins' ? coinTxt(pr.amount) : pr.kind === 'plus' ? '<span>' + tr('Sans pubs + aides illimitées') + '<small>' + tr('Plus de pubs entre les niveaux, indices et vérifications à volonté') + '</small></span>'
          : '<span>' + tr('Sans pubs') + '<small>' + tr('Plus de pubs entre les niveaux') + '</small></span>';
        const b = button(label + '<b>' + (owned ? tr('Acheté') : pr.price) + '</b>', 'item', async () => {
          if (owned) return; b.disabled = true;
          if (await Monet.store.buy(pr.id)) { S.purchase(pr); if (pr.kind === 'coins') addCoins(pr.amount, 'buy'); else { save.noAds = true; if (pr.kind === 'plus') save.plus = true; persist(); } C.haptic('success'); }
          s.refresh();
        });
        if (owned) b.disabled = true;
        p.appendChild(b);
      }
      if (Monet.store.available) p.appendChild(button(tr('Restaurer les achats'), 'danger', async e => {
        e.currentTarget.disabled = true; const ids = await Monet.store.restore(), ok = ids.includes('no_ads'); if (ok) { save.noAds = true; if (ids.includes('no_ads_plus')) save.plus = true; persist(); }
        shopMsg = tr(ok ? 'Achats restaurés' : 'Aucun achat à restaurer'); s.refresh();
      }));
      if (shopMsg) { p.appendChild(el('p', 'best', shopMsg)); shopMsg = ''; }
      if (Monet.simulated) p.appendChild(el('p', 'version', tr('Pubs et achats simulés (développement)')));
    };
    return s;
  }
  // secours payant : 60 pièces, ou une pub récompensée, ou « non merci »
  let rescueCb = null;
  function buildRescue() {
    const s = el('section', 'screen rescue'); const p = el('div', 'panel'); s.appendChild(p);
    s.refresh = () => {
      p.innerHTML = ''; p.appendChild(el('h2', '', tr('CONTINUER ?')));
      const enough = save.coins >= ECONOMY.rescue;
      const pay = button(tr('CONTINUER') + '<small>' + coinTxt(ECONOMY.rescue) + '</small>', 'big primary', () => { if (!enough) return toShop('rescue'); addCoins(-ECONOMY.rescue, 'rescue'); save.rescues++; persist(); S.event('rescue:coins'); finishRescue(true); });
      p.appendChild(pay);
      if (!enough) p.appendChild(el('p', 'best', tr('Pas assez de pièces')));
      if (Monet.ads.available) p.appendChild(button(ICON.ad + '<span>' + tr('Regarder une pub') + '</span>', 'ad', async e => { const b = e.currentTarget; b.disabled = true; if (await rewarded('rescue')) { save.rescues++; persist(); S.event('rescue:ad'); finishRescue(true); } else b.disabled = false; }));
      p.appendChild(button(tr('Non merci'), 'danger', () => { S.event('rescue:declined'); finishRescue(false); }));
    };
    return s;
  }
  function finishRescue(ok) { const cb = rescueCb; rescueCb = null; show(null); if (cb) (ok ? cb.onAccept : cb.onDecline || (() => { }))(); }
  function soundToggle() { return toggle(tr('Son'), () => save.settings.sound, on => { save.settings.sound = on; C.setSound(on); persist(); }); }
  function musicToggle() { return toggle(tr('Musique'), () => save.settings.music, on => { save.settings.music = on; if (game) game.setMusic(on); persist(); }); }
  function buildSettings() {
    const s = el('section', 'screen settings');
    const head = el('header'); head.appendChild(button(ICON.back, 'icon', () => show(settingsBack))); head.appendChild(el('h2', '', tr('RÉGLAGES'))); s.appendChild(head);
    const p = el('div', 'panel');
    const tg = [soundToggle(), musicToggle(), toggle(tr('Vibrations'), () => save.settings.haptics, on => { save.settings.haptics = on; C.setHaptics(on); if (on) C.haptic('medium'); persist(); }),
      toggle(tr('Statistiques anonymes'), () => save.settings.stats, on => { save.settings.stats = on; S.setEnabled(on); persist(); })];
    const symbols = toggle(tr('Symboles des couleurs'), () => save.settings.symbols, on => { save.settings.symbols = on; persist(); }); tg.splice(3, 0, symbols);   // daltoniens : proposé si le jeu sait les dessiner
    tg.forEach(x => p.appendChild(x));
    // rouvrir le choix de consentement des pubs : seulement là où il s'applique (Google l'exige alors)
    const adPrivacy = button(tr('Confidentialité des pubs'), 'secondary', () => Monet.ads.privacyOptions()); p.appendChild(adPrivacy);
    if (cfg.privacyUrl) { const a = el('a', 'link', tr('Politique de confidentialité')); a.href = cfg.privacyUrl; a.target = '_blank'; a.rel = 'noopener'; p.appendChild(a); }
    // développement seulement (page servie en http par le PC : navigateur et client de dev) ; ni dans la version store, ni sur le site
    if (location.protocol === 'http:') p.appendChild(button(tr('Effacer la progression'), 'danger', () => {
      if (!global.confirm(tr('Effacer toute la progression ? Les étoiles et les niveaux débloqués seront perdus.'))) return;
      const keep = save.settings, noAds = save.noAds, plus = save.plus; save = DEFAULT(); save.settings = keep; save.noAds = noAds; save.plus = plus; persist(); show(settingsBack);   // « Sans pubs » est un achat : il survit à l'effacement
    }));
    if (Monet.devTools) {   // client de dev seulement : refaire le parcours de consentement, retester les pubs entre niveaux
      p.appendChild(button('Dev : redemander le consentement', 'danger', () => Monet.resetConsent().then(() => setTimeout(() => location.reload(), 500))));
      p.appendChild(button('Dev : annuler « Sans pubs »', 'danger', () => { save.noAds = false; save.plus = false; persist(); show(settingsBack); }));
    }
    const version = el('p', 'version'); p.appendChild(version);
    const credits = (global.GAME_AUDIO && global.GAME_AUDIO.credits) || []; if (credits.length) p.appendChild(el('p', 'version credits', credits.map(c => typeof c === 'string' ? c : C.byLang(c)).join('<br>')));   // crédits des musiques (licences avec attribution)
    s.appendChild(p); s.refresh = () => { version.textContent = (cfg.version || '') + (C.DEV ? ' · dev' : '') + (Monet.devTools && game && game.audioInfo ? ' · ' + game.audioInfo() : ''); tg.forEach(x => x.repaint()); symbols.style.display = game && game.symbols ? '' : 'none'; if (demo() && !demo().stats) tg[4].style.display = 'none';   /* démo sans statistiques : pas de réglage pour elles */ adPrivacy.style.display = Monet.ads.privacyRequired ? '' : 'none'; }; return s;
  }

  // ------------------------------------------------------------ tutoriel (premier lancement) : une main animée refait le geste du jeu
  // Le jeu décrit le geste :  Shell.hint(clé, { path() → [[x, y], …] en unités du canevas, ou null s'il n'y a rien à montrer pour l'instant,
  //   text, textY })  — un point = une tape, plusieurs = un glissé le long du tracé ; path() est relu à chaque image (cibles qui bougent).
  // Il appelle  Shell.hintDone(clé)  au premier geste réussi : la main ne revient plus jamais (clé retenue dans la sauvegarde).
  // La main se cache pendant que le joueur touche l'écran et revient après 1,5 s sans toucher, tant que le geste n'est pas réussi.
  const HAND = '<svg viewBox="0 0 64 80"><path d="M24 6c3.3 0 6 2.7 6 6v22l2-.6V28c0-3 2.4-5 5-5s5 2 5 5v6l1-.3c.6-2.7 2.8-4.7 5.4-4.7 3 0 5.6 2.5 5.6 5.6V52c0 13-9 22-21 22h-3c-7 0-12-3-16-9L3 52c-1.6-2.6-.8-6 1.8-7.6 2.3-1.4 5.3-.9 7 1.2L18 52V12c0-3.3 2.7-6 6-6Z"/></svg>';
  let hint = null, hintEls = null, hintQuiet = 0, hintT0 = 0;
  function hintBuild() {
    hintEls = { hand: el('div', 'hint-hand', HAND), ring: el('div', 'hint-ring'), cap: el('div', 'hint-cap') };
    for (const k in hintEls) document.body.appendChild(hintEls[k]);
    window.addEventListener('pointerdown', () => { hintQuiet = Infinity; }, true);
    window.addEventListener('pointerup', () => { hintQuiet = performance.now() + 1500; hintT0 = hintQuiet; }, true);
  }
  function hintHide() { if (hintEls) for (const k in hintEls) hintEls[k].style.opacity = 0; }
  function hintFrame(now) {
    if (!hint) return hintHide();
    requestAnimationFrame(hintFrame);
    const pts = !current && !C.paused && !C.bot.active && now > hintQuiet ? hint.path() : null;
    if (!pts || !pts.length) return hintHide();
    const r = C.canvas.getBoundingClientRect(), k = r.width / C.W, X = x => r.left + x * k, Y = y => r.top + y * k;
    const tap = pts.length === 1, T = tap ? 1.3 : 2.4, u = ((now - hintT0) / 1000) % T;
    // déroulé d'un cycle : apparition, appui (l'onde part du doigt), glissé le long du tracé (ou relâché pour une tape), disparition
    let pos = pts[0], press = u > .25 && u < (tap ? .55 : 1.7), alpha = Math.min(1, u / .25, (T - u) / .35);
    if (!tap) {
      const segs = []; let len = 0; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(d); len += d; }
      let f = C.clamp((u - .45) / 1.1, 0, 1); f = f < .5 ? 2 * f * f : 1 - 2 * (1 - f) * (1 - f); let d = f * len, i = 0;
      while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
      const a = pts[i], b = pts[i + 1], t = segs[i] ? Math.min(1, d / segs[i]) : 1; pos = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    const size = 170 * k, h = hintEls.hand.style;
    h.width = size + 'px'; h.height = size * 1.25 + 'px'; h.opacity = alpha;
    h.transform = 'translate(' + (X(pos[0]) - size * .375) + 'px,' + (Y(pos[1]) - size * .12) + 'px) scale(' + (press ? .88 : 1) + ')';
    const ru = u - .25, rs = 140 * k, g = hintEls.ring.style;   // onde : part du point d'appui
    g.width = g.height = rs + 'px'; g.opacity = ru > 0 && ru < .6 ? (1 - ru / .6) * alpha : 0;
    g.transform = 'translate(' + (X(pts[0][0]) - rs / 2) + 'px,' + (Y(pts[0][1]) - rs / 2) + 'px) scale(' + (.3 + ru * 1.6) + ')';
    const c = hintEls.cap.style;
    if (hint.text) { hintEls.cap.textContent = hint.text; c.opacity = 1; c.left = r.left + r.width * .05 + 'px'; c.width = r.width * .9 + 'px'; c.top = Y(hint.textY || C.H * .82) + 'px'; c.fontSize = Math.max(15, 44 * k) + 'px'; }
    else c.opacity = 0;
  }

  // ------------------------------------------------------------ déroulement
  function startLevel(n) {
    n = Math.max(1, Math.min(n, save.unlocked));
    if (!inDemo(n)) return show('demo');   // démo : après le dernier niveau offert, « La suite dans l'appli »
    const nw = newsList().find(x => x.level === n && !save.seen[x.key]); if (nw) { newsPending = { item: nw, level: n }; return show('news'); }
    show(null); hint = null; S.level('Start', n); game.startLevel(n);
  }
  // passage au niveau suivant : c'est le SEUL moment où une pub entre niveaux peut passer (jamais après un échec, ni en rejouant)
  let lastInter = Date.now();
  async function nextLevel(n) {
    if (!save.noAds && Monet.ads.interReady && n >= ECONOMY.interFrom && Date.now() - lastInter > ECONOMY.interGap * 1000) { lastInter = Date.now(); S.ad('interstitial', 'next_level', 'show'); await Monet.ads.interstitial(); }
    startLevel(n);
  }
  // ÉCRAN DE DÉMARRAGE (8 oct. 2026) : iOS n'affiche le sien que le temps de lancer l'appli, un éclair. La page le reprend à l'identique
  // (splash.webp du jeu, fabriqué par tools/splash-web.js) et le garde SPLASH_MS après le début du chargement, puis fond vers le menu.
  // Dans l'appli seulement (ou ?splash dans le navigateur, pour l'essayer) ; image absente ou illisible : rien, le menu vient tout de suite.
  const SPLASH_MS = 1500;
  function splash(c) {
    const native = global.Capacitor && Capacitor.isNativePlatform && Capacitor.isNativePlatform();
    if (!c.splash || c.demo || global.ART || !(native || C.URLP.splash)) return;
    const d = el('div', ''), img = new Image(), off = () => { d.classList.add('out'); setTimeout(() => d.remove(), 400); };
    d.id = 'splash'; d.style.backgroundColor = c.splash.bg || '#000'; document.body.appendChild(d);
    img.onload = () => { d.style.backgroundImage = 'url(' + img.src + ')'; setTimeout(off, Math.max(300, SPLASH_MS - performance.now())); };
    img.onerror = off; img.src = c.splash.src || 'splash.webp';
  }
  const fmt = t => t < 60 ? t.toFixed(1) + ' s' : Math.floor(t / 60) + ' min ' + String(Math.round(t % 60)).padStart(2, '0');
  const Shell = {
    async init(c) {
      cfg = c; if (!c.demo && global.GAME_DEMO) c.demo = global.GAME_DEMO;   // démo du site : réglée par la page (jeux/build.js --demo)
      splash(c);
      key = c.id + (c.demo ? '.demo' : '') + '.save';   // la démo a sa propre sauvegarde
      try { save = migrate(JSON.parse(await store.get(key) || 'null')); } catch (_) { save = DEFAULT(); }
      // essais en développement (serveur du PC seulement, jamais dans l'appli ni sur le site) : ?debloque=81 ouvre les niveaux jusqu'au 81
      const dq = /^(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)$/.test(location.hostname) && (location.search.match(/[?&]debloque=(\d+)/) || [])[1];
      if (dq && !c.demo) save.unlocked = Math.max(save.unlocked, +dq);
      C.setSound(save.settings.sound); C.setHaptics(save.settings.haptics);
      S.init(Object.assign({ id: c.id, version: c.version || '0', enabled: save.settings.stats }, c.demo ? Object.assign({ web: true }, c.demo.stats) : c.stats));   // démo : ses propres clés (jeu GameAnalytics séparé), sans rien garder dans le navigateur ; sans clés, rien
      // pubs et achats : consentement puis pubs, achats configurés (sans effet hors de l'appli) ; le son du jeu se coupe pendant une pub
      Monet.onAd = on => C.setSound(on ? false : save.settings.sound);
      Monet.init(c.demo ? { off: true } : { ads: c.ads, store: c.store, game: c.id });   // démo : ni pubs ni achats, pas même simulés
      if (c.colors) for (const k in c.colors) document.documentElement.style.setProperty('--' + k, c.colors[k]);
      root = el('div', ''); root.id = 'shell'; document.body.appendChild(root);
      screens = { title: buildTitle(), levels: buildLevels(), pause: buildPause(), result: buildResult(), settings: buildSettings(), shop: buildShop(), rescue: buildRescue(), news: buildNews(), buy: buildBuy() };
      if (c.demo) screens.demo = buildDemoEnd();
      for (const k in screens) root.appendChild(screens[k]);
      wallet = el('div', 'wallet'); root.appendChild(wallet); paintWallet();
      hudPause = button(ICON.pause, 'hud-pause', () => show('pause')); hudPause.setAttribute('aria-label', tr('Pause')); document.body.appendChild(hudPause);
      boostBar = el('div', 'boosts'); document.body.appendChild(boostBar);
      placeHud(); window.addEventListener('resize', placeHud);
      // appli ou onglet mis de côté en pleine partie : on revient sur le menu pause
      document.addEventListener('visibilitychange', () => { if (document.hidden && !current && game) show('pause'); });
      Shell.ready = true; if (game) boot();
    },
    register(g) { game = g; if (g.economy) Object.assign(ECONOMY, g.economy); if (Shell.ready) boot(); },
    levelWon({ level, stars: st, time }) {
      time = Math.round(time * 10) / 10;   // même arrondi pour le temps affiché et le record
      const first = !save.wins[level]; save.wins[level] = (save.wins[level] || 0) + 1;
      save.stars[level] = Math.max(save.stars[level] || 0, st);
      const record = save.best[level] === undefined || time < save.best[level]; if (record) save.best[level] = time;
      save.unlocked = Math.max(save.unlocked, level + 1); persist();
      S.level('Complete', level, { attempt: save.wins[level] + (save.fails[level] || 0), score: st });
      resultEl.daily = false; resultEl.level = level; resultEl.h.textContent = tr('NIVEAU {n} RÉUSSI !', { n: level });
      resultEl.st.innerHTML = stars(st, 'big'); resultEl.time.textContent = tr('Temps : {t}', { t: fmt(time) });
      resultEl.best.textContent = first ? '' : record ? tr('NOUVEAU RECORD !') : tr('Record : {t}', { t: fmt(save.best[level]) }); resultEl.best.classList.toggle('record', record && !first);   // premier passage : pas de record à comparer
      // pièces : première victoire 10 + 5 par étoile, victoire rejouée 5 ; « ×2 » par pub récompensée
      // niveau difficile : bonus à la première victoire ; cadeau tous les ECONOMY.gift.every niveaux (première victoire, hors « ×2 »)
      const h = hardOf(level), bonus = first && h ? ECONOMY.hardBonus * h : 0, gift = first && level % ECONOMY.gift.every === 0 ? ECONOMY.gift.coins : 0;
      resultEl.coins = (first ? ECONOMY.firstWin + ECONOMY.perStar * st : ECONOMY.replayWin) + bonus; resultEl.doubled = false;
      resultEl.gain.innerHTML = '+' + coinTxt(resultEl.coins);
      resultEl.extra.innerHTML = (bonus ? '<span class="tag hardtag">' + ICON.flame + tr('Bonus niveau difficile') + ' +' + bonus + '</span>' : '') +
        (gift ? '<span class="tag gift got">' + ICON.gift + tr('Cadeau du niveau {n}', { n: level }) + ' +' + coinTxt(gift) + '</span>'
          : inDemo(nextGift()) ? '<span class="tag gift">' + ICON.gift + tr('Cadeau au niveau {n}', { n: nextGift() }) + '</span>' : '');
      // PROCHAINE NOUVEAUTÉ (8 oct. 2026, vue chez Sort Factory! et Pig Loop!) : la nouveauté ou l'aide qui vient, et le chemin déjà fait depuis la précédente
      const nws = newsList().filter(x => inDemo(x.level)).sort((a, b) => a.level - b.level), nw = nws.find(x => x.level > level && !save.seen[x.key]);
      resultEl.next.style.display = nw ? '' : 'none';
      if (nw) {
        const from = Math.max(0, ...nws.filter(x => x.level <= level).map(x => x.level)), left = nw.level - level - 1, pct = Math.round(100 * (level + 1 - from) / (nw.level - from));
        resultEl.next.innerHTML = '<span class="ic">' + (nw.icon || '') + '</span><div><b>' + tr(nw.boost ? 'Prochaine aide' : 'Prochaine nouveauté') + ' · ' + C.byLang(nw.title) + '</b><i><u style="width:' + pct + '%"></u></i>' +
          '<small>' + (left > 0 ? tr(left > 1 ? 'Encore {n} niveaux' : 'Encore {n} niveau', { n: left }) : tr('Au prochain niveau !')) + '</small></div>';
      }
      resultEl.dbl.innerHTML = ICON.ad + '<span>' + tr('×2 avec une pub') + '</span>'; resultEl.dbl.disabled = false; resultEl.dbl.style.display = Monet.ads.available ? '' : 'none';
      C.haptic('success'); show('result'); addCoins(resultEl.coins, 'win'); if (gift) addCoins(gift, 'gift');
      flyCoins(resultEl.gain, Math.min(10, 3 + Math.round((resultEl.coins + gift) / 8)));
      // demande de note : une fois, après une belle victoire, sur l'écran de résultat (Color Block Jam la pose en plein niveau 4 : à ne pas imiter)
      const rv = C.native('InAppReview');
      if (rv && !save.asked && st === 3 && level >= ECONOMY.reviewFrom) { save.asked = level; persist(); S.event('review:asked'); setTimeout(() => { if (current === 'result') { try { rv.requestReview(); } catch (_) { } } }, 1800); }
    },
    // grille du jour réussie : série de jours, pièces une fois par jour, écran de résultat (« suivant » ramène au niveau en cours)
    dailyWon({ stars: st, time }) {
      const t = today(), d = save.daily, first = d.last !== t;
      if (first) { d.streak = d.last === t - 1 ? d.streak + 1 : 1; d.last = t; d.best = Math.max(d.best, d.streak); }
      persist(); S.event('daily:win'); if (first) S.event('daily:streak:' + Math.min(d.streak, 30));
      resultEl.daily = true; resultEl.level = save.unlocked - 1; resultEl.h.textContent = tr('GRILLE DU JOUR RÉUSSIE !');
      resultEl.st.innerHTML = stars(st, 'big'); resultEl.time.textContent = tr('Temps : {t}', { t: fmt(Math.round(time * 10) / 10) });
      resultEl.best.textContent = streakTxt(d.streak); resultEl.best.classList.add('record');
      resultEl.coins = first ? ECONOMY.daily : 0; resultEl.doubled = false; resultEl.gain.innerHTML = resultEl.coins ? '+' + coinTxt(resultEl.coins) : '';
      resultEl.extra.innerHTML = '<span class="tag gift">' + ICON.flame + tr('Reviens demain pour continuer ta série') + '</span>'; resultEl.next.style.display = 'none';
      resultEl.dbl.innerHTML = ICON.ad + '<span>' + tr('×2 avec une pub') + '</span>'; resultEl.dbl.disabled = false; resultEl.dbl.style.display = resultEl.coins && Monet.ads.available ? '' : 'none';
      C.haptic('success'); show('result'); if (resultEl.coins) { addCoins(resultEl.coins, 'daily'); flyCoins(resultEl.gain, 5); }
    },
    // le joueur touche le bouton de secours du jeu : 60 pièces, pub récompensée ou « non merci » (onDecline facultatif)
    requestRescue(cb) { rescueCb = cb; S.event('rescue:offered'); show('rescue'); },
    // aides : le jeu signale qu'une aide a servi (le compte baisse), ou qu'elle attend sa cible (bouton allumé)
    boostUsed(key) { if (!illimite()) save.boosts[key] = Math.max(0, (save.boosts[key] || 0) - 1); aimKey = null; persist(); S.event('boost:use:' + key); paintBoosts(); },
    boostAim(key) { if (aimKey === key) return; aimKey = key; paintBoosts(); },
    // tutoriel : voir hintFrame ; renvoie false si ce geste a déjà été appris
    hint(key, spec) {
      if (save.tuto[key] || C.KIT.clip || C.KIT.loop) return false;
      if (!hintEls) hintBuild();
      const was = hint; hint = Object.assign({ key }, spec); hintT0 = performance.now(); if (!was) requestAnimationFrame(hintFrame);
      return true;
    },
    hintDone(key) { if (hint && hint.key === key) hint = null; if (!save.tuto[key]) { save.tuto[key] = true; persist(); S.event('tuto:' + key); } },
    levelFailed({ level }) { save.fails[level] = (save.fails[level] || 0) + 1; persist(); C.haptic('fail'); S.level('Fail', level, { attempt: (save.wins[level] || 0) + save.fails[level] }); },
    get save() { return save; },
  };
  function boot() {
    game.setMusic(save.settings.music);
    // une image du niveau en cours est dessinée, puis le jeu se met en pause derrière l'écran titre
    requestAnimationFrame(() => requestAnimationFrame(() => show('title')));
  }
  // bouton pause : coin haut gauche du canevas (qui est centré, en 9:16) par défaut, dans la zone sûre de l'écran. Réglable par jeu :
  // Shell.init({ pause: { x, y, size } }) en unités du canevas (1080 × 1920). Les titres des jeux laissent C.HUD_CLEAR de marge de chaque côté.
  function placeHud() {
    const r = C.canvas.getBoundingClientRect(), k = r.width / C.W, P = Object.assign({ x: 28, y: 28, size: 104 }, cfg.pause);
    hudPause.style.left = Math.round(r.left + P.x * k) + 'px'; hudPause.style.top = 'max(' + Math.round(r.top + P.y * k) + 'px, env(safe-area-inset-top))';
    hudPause.style.width = hudPause.style.height = Math.round(Math.max(40, P.size * k)) + 'px';
    if (boostBar) {   // rangée des aides : centrée, tout en bas du canevas (Shell.init({ boosts: { y, size } }) pour la déplacer)
      const Bp = Object.assign({ y: 1852, size: 108 }, cfg.boosts), sz = Math.round(Math.max(40, Bp.size * k));
      boostBar.style.left = Math.round(r.left) + 'px'; boostBar.style.width = Math.round(r.width) + 'px'; boostBar.style.top = Math.round(r.top + Bp.y * k - sz / 2) + 'px';
      boostBar.style.setProperty('--bs', sz + 'px');
    }
  }
  global.Shell = Shell;
})(window);
