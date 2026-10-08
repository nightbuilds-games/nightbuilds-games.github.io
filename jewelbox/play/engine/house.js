/* house.js — PUBS MAISON (8 oct. 2026) : chaque jeu du studio présente les autres, aux mêmes emplacements que les pubs payantes.
   Chargé après core.js, avant monet.js, qui s'en sert tout seul : la coquille et les jeux n'ont rien à savoir.

     House.init({ game, off })   game : identifiant du jeu en cours (Shell.init) ; il n'est jamais présenté à ses propres joueurs
     House.ready               → booléen : une pub maison est prête (catalogue lu, un autre jeu sorti sur ce store, sa vidéo chargée)
     House.show(rewarded)      → Promise<boolean> : true si elle a été regardée jusqu'au bout (récompense), comme Monet.ads.rewarded()
     House.turn()              → booléen : est-ce au tour d'une pub maison de prendre une pub entre niveaux ? (part réglée au catalogue)

   OÙ MONET.JS S'EN SERT
     - pub récompensée et pub entre niveaux : quand aucune pub payante n'est prête (pas de réseau publicitaire, pas d'annonce), la pub
       maison prend la place ; le joueur garde donc son bonus, et l'emplacement sert quand même ;
     - pub entre niveaux : une part réglable (catalogue, « share ») va à la pub maison même quand une pub payante est prête.
     Tout le reste est inchangé : la coquille décide toujours QUAND (pas avant le niveau 8, jamais après « Sans pubs », etc.).

   LE CATALOGUE (engine/house-catalog.json) : la copie embarquée sert d'abord ; elle est ensuite relue sur le site (site/promo/catalog.json,
     publié par jeux/tools/pubs-maison.js) et gardée en mémoire du téléphone, pour qu'un jeu sorti plus tard soit présenté par les applis
     déjà installées. Un jeu sans lien pour le store du téléphone n'est jamais présenté.

   LA PUB : plein écran, la vidéo verticale du jeu (muette), son icône, son nom, une accroche et un bouton vers le store. Elle porte la
     mention « Pub », comme toute publicité : on ne la déguise pas en contenu du jeu. En revanche elle ne nomme pas le studio, pas plus
     qu'une pub payante ne nomme son annonceur. Fermeture après 5 s (entre niveaux) ou à la fin du décompte (récompensée).

   MISE AU POINT (développement seulement) : ?maison force les pubs maison à la place de la simulation, même pour un jeu sans lien de store
     (le bouton n'ouvre alors rien) ; ?maison=ecrin choisit le jeu présenté. */
(function (global) {
  const C = global.Core, DEV = /^https?:$/.test(location.protocol), U = C.URLP || {};
  const REMOTE = 'https://nightbuilds.app/promo/catalog.json', KEY = 'house.catalog', FORCE = DEV && U.maison !== undefined ? U.maison : null;
  const INTER_S = 5, REWARD_S = 15;
  C.i18n({ 'Pub': 'Ad', 'OBTENIR': 'GET', 'Récompense dans {s} s': 'Reward in {s} s', 'Fermer dans {s} s': 'Close in {s} s', 'Fermer': 'Close' });

  let me = null, cat = null, off = false, ready = null, count = 0, lastId = null;
  const platform = () => { const p = global.Capacitor && global.Capacitor.getPlatform ? global.Capacitor.getPlatform() : 'web'; return p === 'android' ? 'android' : 'ios'; };   // dans un navigateur : comme sur iPhone (mise au point)
  const link = g => (g.store && g.store[platform()]) || '';
  const eligible = () => !cat ? [] : cat.games.filter(g => g.id !== me && g.clip && (FORCE !== null ? (FORCE === true || FORCE === g.id) : !!link(g)));

  function accept(c) { if (!c || !Array.isArray(c.games) || (cat && (c.version || 0) < (cat.version || 0))) return false; cat = c; return true; }
  // prépare la prochaine pub : le jeu suivant du catalogue (jamais deux fois de suite le même s'il y en a plusieurs), vidéo chargée d'avance
  function prepare() {
    ready = null; const list = eligible(); if (!list.length || off) return;
    const pool = list.length > 1 ? list.filter(x => x.id !== lastId) : list, g = pool[count % pool.length];
    const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; if (g.poster) v.poster = g.poster;
    // prête dès que la vidéo est connue (durée, taille) : l'iPhone ne charge pas la suite avant la lecture, l'image d'attente fait le lien
    v.addEventListener('loadedmetadata', () => { ready = { g, v }; }, { once: true });
    v.addEventListener('error', () => setTimeout(prepare, 60000), { once: true });   // pas de réseau : nouvel essai plus tard
    v.src = g.clip; v.load();
  }
  function loadCatalog() {
    try { accept(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (_) { }
    const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const here = 'engine/house-catalog.json', embedded = json(DEV ? '../' + here : here).catch(() => json(DEV ? here : '../' + here)).then(accept, () => false);   // appli : moteur à côté de la page ; développement : un dossier plus haut
    embedded.then(() => { prepare(); if (DEV) return;   // en développement, seule la copie du dépôt compte
      fetch(REMOTE, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(c => { if (accept(c)) { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (_) { } if (!ready) prepare(); } }, () => { }); });
  }
  const stat = (what, g) => { try { if (global.Stats && Stats.event) Stats.event('house:' + what + ':' + g.id); } catch (_) { } };
  function open(g) {
    let url = link(g); stat('click', g); if (!url) return;
    if (/apps\.apple\.com/.test(url)) url += (url.includes('?') ? '&' : '?') + (cat.pt ? 'pt=' + cat.pt + '&' : '') + 'ct=house-' + me;   // campagne App Store : d'où vient le téléchargement
    try { global.open(url, '_system'); } catch (_) { location.href = url; }
  }

  function show(rewarded) {
    const r = ready; if (!r) return Promise.resolve(false);
    ready = null; count++; lastId = r.g.id; stat('show', r.g);
    return new Promise(resolve => {
      const g = r.g, v = r.v, lang = C.lang, tag = (g.tagline && (g.tagline[lang] || g.tagline.en)) || '';
      const o = document.createElement('div'); o.className = 'house-ad';
      o.style.cssText = 'position:fixed;inset:0;z-index:60;background:#05050c;display:flex;align-items:center;justify-content:center;font-family:Nunito,system-ui,sans-serif;color:#fff;-webkit-user-select:none;user-select:none';
      v.style.cssText = 'height:100%;max-width:100%;aspect-ratio:9/16;object-fit:cover;display:block';
      o.appendChild(v);
      const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const ui = document.createElement('div'); ui.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:max(14px,env(safe-area-inset-top)) 14px max(18px,env(safe-area-inset-bottom));pointer-events:none';
      ui.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">' +
          '<span style="font-weight:800;font-size:12px;letter-spacing:.5px;background:rgba(0,0,0,.55);border-radius:6px;padding:3px 8px">' + C.tr('Pub') + '</span>' +
          '<button class="x" aria-label="' + C.tr('Fermer') + '" style="pointer-events:auto;min-width:40px;height:40px;border:0;border-radius:999px;background:rgba(0,0,0,.6);color:#fff;font:800 14px Nunito,system-ui,sans-serif;padding:0 12px"></button>' +
        '</div>' +
        '<div class="card" style="pointer-events:auto;display:flex;align-items:center;gap:12px;background:rgba(12,12,24,.82);border-radius:22px;padding:12px;box-shadow:0 10px 30px rgba(0,0,0,.5);max-width:520px;width:100%;margin:0 auto;box-sizing:border-box">' +
          (g.icon ? '<img src="' + esc(g.icon) + '" alt="" style="width:64px;height:64px;border-radius:15px;flex:none">' : '') +
          '<div style="flex:1;min-width:0;text-align:left"><div style="font-weight:900;font-size:19px;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + esc(g.name) + '</div><div style="font-weight:700;font-size:14px;opacity:.85;line-height:1.2;margin-top:3px">' + esc(tag) + '</div></div>' +
          '<span style="flex:none;font-weight:900;font-size:17px;border-radius:999px;padding:11px 20px;background:' + esc(g.color || '#2E6BFF') + ';box-shadow:0 4px 0 rgba(0,0,0,.35)">' + C.tr('OBTENIR') + '</span>' +
        '</div>';
      o.appendChild(ui); document.body.appendChild(o);
      if (global.Monet && Monet.onAd) Monet.onAd(true);
      try { v.currentTime = 0; const p = v.play(); if (p && p.catch) p.catch(() => { }); } catch (_) { }
      const x = ui.querySelector('.x'); let s = rewarded ? REWARD_S : INTER_S; if (global.MONET_SIM_SECONDS !== undefined) s = global.MONET_SIM_SECONDS;   // tests automatiques
      const paint = () => { x.textContent = s > 0 ? (rewarded ? C.tr('Récompense dans {s} s', { s }) : C.tr('Fermer dans {s} s', { s })) : '✕'; x.style.opacity = s > 0 ? .85 : 1; };
      const done = () => { clearInterval(iv); try { v.pause(); } catch (_) { } o.remove(); if (global.Monet && Monet.onAd) Monet.onAd(false); prepare(); resolve(true); };
      const iv = setInterval(() => { if (s > 0) { s--; paint(); } }, 1000); paint();
      x.addEventListener('click', e => { e.stopPropagation(); if (s <= 0) done(); });
      ui.querySelector('.card').addEventListener('click', e => { e.stopPropagation(); open(g); });
      v.addEventListener('click', () => open(g));
    });
  }

  global.House = {
    init(c) { c = c || {}; me = c.game || null; off = !!c.off; if (off || !me) return; loadCatalog(); },
    get ready() { return !off && !!ready; },
    get forced() { return FORCE !== null; },
    turn() { if (!ready || !cat) return false; const share = FORCE !== null ? 1 : +cat.share || 0; return share > 0 && Math.random() < share; },
    show,
  };
})(window);
