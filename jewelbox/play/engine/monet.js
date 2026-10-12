/* monet.js — pubs et achats intégrés des jeux, derrière une interface unique (30 sept. 2026). Chargé après core.js, avant shell.js.

     Monet.ads.rewarded()      → Promise<boolean>  pub récompensée ; true seulement si elle a été regardée jusqu'au bout
     Monet.ads.interstitial()  → Promise<void>     pub entre deux niveaux (la coquille décide QUAND, voir shell.js)
     Monet.ads.available       → booléen            une pub récompensée peut-elle être proposée (chargée et prête) ?
     Monet.ads.interReady      → booléen            une pub entre niveaux est-elle prête ?
     Monet.ads.privacyRequired → booléen            faut-il offrir « Confidentialité des pubs » dans les réglages (exigé par Google
                                 là où le consentement s'applique) ? Monet.ads.privacyOptions() rouvre le choix.
     Monet.init({ ads: { rewarded, interstitial, testDevices }, store: { revenuecat } })   identifiants du jeu (index.html), donnés par
                                 la coquille au démarrage : lance le consentement puis les pubs, et configure les achats
     Monet.onAd = on => …       appelé quand une vraie pub s'ouvre (true) et se ferme (false) : la coquille coupe le son du jeu
     Monet.store.products      → [{ id, kind: 'coins'|'noads', amount?, price, value, currency }]  price = texte à afficher, tel que
                                 le store le donne (devise et format du pays) ; null tant que le store n'a pas répondu
     Monet.store.load()        → Promise<void>     lit les prix du store (une fois) ; la boutique se redessine ensuite
     Monet.store.buy(id)       → Promise<boolean>  achat confirmé ?
     Monet.store.restore()     → Promise<string[]> identifiants des achats définitifs à rétablir (« Sans pubs »)
     Monet.store.available     → booléen

   Trois régimes, choisis tout seuls :
     - appli avec les vrais modules (AdMob pour les pubs, RevenueCat pour les achats) et un jeu qui a ses identifiants : vraies pubs,
       vrais achats (dans le client de dev : pubs de test de Google et achats du bac à sable d'Apple) ;
     - développement (page servie en http par jeux/serve.js, navigateur ou client de dev) : SIMULATION, une fausse pub de 3 s et une
       fenêtre « achat simulé », pour régler l'économie sans compte ni compilation ;
     - sinon (appli store sans module) : rien n'est proposé (available = false). Jamais de simulation hors développement : un achat simulé
       dans la version publiée donnerait des pièces gratuites.
   Démo du site (Monet.init({ off: true }), demandé par la coquille en mode démo) : tout est coupé, ni module, ni simulation. Il faut le
   dire explicitement, car la démo est servie en http(s) comme le développement. */
(function (global) {
  const C = global.Core;
  const DEV = /^https?:$/.test(location.protocol);
  let off = false; const sim = () => DEV && !off;   // simulation : en développement seulement, et jamais dans la démo du site
  C.i18n({
    'PUBLICITÉ (simulation)': 'AD (simulation)', 'Fermer': 'Close', 'Passer': 'Skip', 'Récompense dans {s} s': 'Reward in {s} s',
    'Achat simulé': 'Simulated purchase', 'Acheter': 'Buy', 'Annuler': 'Cancel', 'Aucun paiement réel (développement)': 'No real payment (development)',
  });
  // Les prix ne sont PAS écrits ici : ils viennent du store (par pays, dans la devise du joueur). En développement, la simulation
  // affiche des prix indicatifs (SIM_PRICES), mis en forme comme le ferait le store.
  const PRODUCTS = [
    { id: 'coins_500', kind: 'coins', amount: 500, price: null, value: 0, currency: '' },
    { id: 'coins_1500', kind: 'coins', amount: 1500, price: null, value: 0, currency: '' },
    { id: 'no_ads', kind: 'noads', price: null, value: 0, currency: '' },
    { id: 'no_ads_plus', kind: 'plus', price: null, value: 0, currency: '' },   // « Sans pubs + aides illimitées » : proposé seulement par un jeu qui déclare unlimited (10 oct. 2026)
  ];
  const SIM_PRICES = { coins_500: 1.99, coins_1500: 4.99, no_ads: 3.99, no_ads_plus: 6.99 };
  function setPrice(id, value, currency, text) { const p = PRODUCTS.find(x => x.id === id); if (p) { p.value = value; p.currency = currency; p.price = text; } }
  function simPrices() {
    const fr = C.lang === 'fr', cur = fr ? 'EUR' : 'USD';
    for (const id in SIM_PRICES) {
      let t; try { t = new Intl.NumberFormat(fr ? 'fr-FR' : 'en-US', { style: 'currency', currency: cur }).format(SIM_PRICES[id]); } catch (_) { t = SIM_PRICES[id] + ' ' + cur; }
      setPrice(id, SIM_PRICES[id], cur, t);
    }
  }

  // ------------------------------------------------------------ simulation (développement seulement)
  function overlay(html) {
    const o = document.createElement('div');
    o.style.cssText = 'position:fixed;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;background:rgba(10,10,20,.94);color:#fff;font:700 20px system-ui,sans-serif;text-align:center;padding:24px';
    o.innerHTML = html; document.body.appendChild(o); return o;
  }
  const btn = (label, bg) => '<button style="font:800 18px system-ui;border:0;border-radius:999px;padding:14px 26px;color:#fff;background:' + bg + '">' + label + '</button>';
  function simAd(rewarded) {
    return new Promise(resolve => {
      const o = overlay('<div style="font-size:14px;opacity:.7">' + C.tr('PUBLICITÉ (simulation)') + '</div><div id="simad" style="font-size:44px">▶</div><div id="simtxt"></div><div id="simbtns"></div>');
      let s = global.MONET_SIM_SECONDS !== undefined ? global.MONET_SIM_SECONDS : 3; const txt = o.querySelector('#simtxt'), btns = o.querySelector('#simbtns');   // MONET_SIM_SECONDS = 0 : tests automatiques
      const done = ok => { clearInterval(iv); o.remove(); resolve(ok); };
      const paint = () => {
        txt.textContent = s > 0 ? (rewarded ? C.tr('Récompense dans {s} s', { s }) : s + ' s') : '';
        btns.innerHTML = s > 0 ? (rewarded ? btn(C.tr('Passer'), '#475569') : '') : btn(C.tr('Fermer'), '#16a34a');
        const b = btns.querySelector('button'); if (b) b.onclick = () => done(s <= 0);
      };
      const iv = setInterval(() => { s--; paint(); }, 1000); paint();
    });
  }
  function simBuy(p) {
    return new Promise(resolve => {
      const what = p.kind === 'coins' ? p.amount + ' 🪙' : p.kind === 'plus' ? 'Sans pubs + aides illimitées / No ads + unlimited helpers' : 'Sans pubs / No ads';
      const o = overlay('<div style="font-size:14px;opacity:.7">' + C.tr('Achat simulé') + '</div><div style="font-size:30px">' + what + '</div><div>' + p.price + '</div>' +
        '<div style="display:flex;gap:12px">' + btn(C.tr('Acheter'), '#16a34a') + btn(C.tr('Annuler'), '#475569') + '</div><div style="font-size:13px;opacity:.6">' + C.tr('Aucun paiement réel (développement)') + '</div>');
      const [yes, no] = o.querySelectorAll('button');
      yes.onclick = () => { o.remove(); resolve(true); }; no.onclick = () => { o.remove(); resolve(false); };
    });
  }

  // ------------------------------------------------------------ vrais modules (appli) : démarrés par Monet.init, appelé par la coquille
  let ads = null, shop = null, loading = null;
  const realAds = () => ads, realStore = () => shop;
  // journal de mise au point (client de dev seulement) : chaque étape des vrais modules est envoyée au PC (journal de jeux/serve.js)
  const err = e => (e && (e.message || e.errorMessage || e.code)) || String(e);
  const dbg = (...a) => { if (!DEV) return; try { fetch('/__log', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '[monet] ' + a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ') }).catch(() => { }); } catch (_) { } };

  // AdMob (@capacitor-community/admob). Ordre : initialisation du module, puis consentement (message RGPD dans l'EEE, message d'explication
  // puis demande de suivi d'Apple ailleurs ; les deux messages sont réglés dans AdMob, « Confidentialité et messages »), ensuite seulement
  // le chargement des pubs. Une pub de chaque sorte est gardée chargée d'avance ; après un échec, nouvel essai 30 s plus tard.
  // Client de dev (page servie par le PC) : pubs de test de Google, quel que soit l'identifiant.
  function startAds(c) {
    const A = C.native('AdMob'); dbg('AdMob : module', !!A, 'identifiants', !!(c && c.rewarded)); if (!A || !c || !c.rewarded) return;
    const st = { rew: false, inter: false, privacy: false };
    let rewDone = null, earned = false, interDone = null;
    const mute = on => { if (Monet.onAd) Monet.onAd(on); };
    const loader = (flag, call, adId) => { let busy = false; const load = () => { if (st[flag] || busy || !adId) return; busy = true; A[call]({ adId, isTesting: DEV }).then(() => { busy = false; st[flag] = true; dbg(call, 'chargée'); }, e => { busy = false; dbg(call, 'échec', err(e)); setTimeout(load, 30000); }); }; return load; };
    const loadRew = loader('rew', 'prepareRewardVideoAd', c.rewarded), loadInter = loader('inter', 'prepareInterstitial', c.interstitial);
    const endRew = ok => { if (!rewDone) return; const r = rewDone; rewDone = null; mute(false); r(ok); loadRew(); };
    const endInter = () => { if (!interDone) return; const r = interDone; interDone = null; mute(false); r(); loadInter(); };
    A.addListener('onRewardedVideoAdReward', () => { earned = true; });
    A.addListener('onRewardedVideoAdDismissed', () => endRew(earned));
    A.addListener('onRewardedVideoAdFailedToShow', () => endRew(false));
    A.addListener('interstitialAdDismissed', endInter);
    A.addListener('interstitialAdFailedToShow', endInter);
    ads = {
      get ready() { return st.rew; }, get interReady() { return st.inter; }, get privacy() { return st.privacy; },
      rewarded() { if (!st.rew) { loadRew(); return Promise.resolve(false); } st.rew = false; earned = false; mute(true); return new Promise(res => { rewDone = res; A.showRewardVideoAd().catch(() => endRew(false)); }); },
      interstitial() { if (!st.inter) { loadInter(); return Promise.resolve(); } st.inter = false; mute(true); return new Promise(res => { interDone = res; A.showInterstitial().catch(endInter); }); },
      privacyOptions() { return A.showPrivacyOptionsForm().catch(() => { }); },
      resetConsent() { return A.resetConsentInfo().then(() => dbg('consentement oublié'), e => dbg('oubli du consentement : échec', err(e))); },   // mise au point
    };
    (async () => {
      // initialize() d'abord, impérativement : c'est lui qui relie le module à l'écran de l'appli. Sans lui, le message de consentement
      // échoue avec « No ViewController » (constaté le 1er oct. 2026). Aucune pub n'est demandée pour autant avant le consentement.
      const test = c.testDevices || [];
      try { await A.initialize({ initializeForTesting: test.length > 0, testingDevices: test }); dbg('AdMob initialisé'); } catch (e) { dbg('AdMob : initialisation en échec', err(e)); return; }
      let info = null;
      try { info = await A.requestConsentInfo(); dbg('consentement', info); if (info.isConsentFormAvailable) { info = Object.assign(info, await A.showConsentForm()); dbg('après le message', info); } } catch (e) { dbg('consentement : échec', err(e)); }
      // filet : aucun message à afficher (hors EEE, message d'explication absent) et suivi jamais demandé → demande de suivi d'Apple directe
      try { const t = await A.trackingAuthorizationStatus(); dbg('suivi', t); if (info && info.status === 'NOT_REQUIRED' && t.status === 'notDetermined') await A.requestTrackingAuthorization(); } catch (e) { dbg('suivi : échec', err(e)); }
      if (!info || !info.canRequestAds) return;   // pas de réponse (hors ligne) ou pubs non permises : aucune pub cette fois-ci
      st.privacy = info.privacyOptionsRequirementStatus === 'REQUIRED';
      loadRew(); loadInter();
    })();
  }

  // RevenueCat (@revenuecat/purchases-capacitor). Le jeu achète par identifiant de PACKAGE de l'offre « default » (no_ads, coins_500,
  // coins_1500, no_ads_plus : ceux de PRODUCTS) ; RevenueCat fait le lien avec les identifiants du store. « Sans pubs » = droit « no_ads » ;
  // « Sans pubs + aides illimitées » = droit « plus », qui vaut aussi « Sans pubs ».
  function startStore(c) {
    const P = C.native('Purchases'); dbg('RevenueCat : module', !!P, 'clé', !!(c && c.revenuecat)); if (!P || !c || !c.revenuecat) return;
    const pk = {}, ready = P.configure({ apiKey: c.revenuecat }); ready.then(() => dbg('RevenueCat configuré'), e => dbg('RevenueCat : configuration en échec', err(e)));
    const droits = info => { const a = (info && info.entitlements && info.entitlements.active) || {}, ids = []; if (a.no_ads || a.plus) ids.push('no_ads'); if (a.plus) ids.push('no_ads_plus'); return ids; };
    shop = {
      async load() {
        await ready; let o; try { o = await P.getOfferings(); } catch (e) { dbg('offres : échec', err(e)); throw e; }
        const off = (o.all && o.all.default) || o.current; dbg('offres', Object.keys(o.all || {}), off ? off.availablePackages.map(p => p.identifier + ' ' + p.product.priceString + ' ' + p.product.currencyCode) : 'aucune');
        if (DEV) P.getStorefront().then(sf => dbg('boutique du compte', sf), e => dbg('boutique du compte : échec', err(e)));   // mise au point : prix en dollars en test
        if (!off || !off.availablePackages.length) throw new Error('offre absente');
        for (const p of off.availablePackages) { pk[p.identifier] = p; setPrice(p.identifier, p.product.price, p.product.currencyCode, p.product.priceString); }
      },
      async buy(p) { if (!pk[p.id]) return false; try { await P.purchasePackage({ aPackage: pk[p.id] }); return true; } catch (e) { dbg('achat : échec', err(e)); return false; } },   // achat annulé ou refusé : rejet
      async restore() { try { await ready; const r = await P.restorePurchases(); return droits(r.customerInfo); } catch (_) { return []; } },
    };
  }

  // PUBS MAISON (engine/house.js, 8 oct. 2026) : elles prennent la place d'une pub payante qui n'est pas prête, et une part des pubs entre
  // niveaux (catalogue). En développement la simulation reste la règle ; ?maison les montre à sa place.
  const H = () => global.House && House.ready ? House : null;
  const Monet = global.Monet = {
    init(c) {
      c = c || {}; if (c.off) { off = true; return; }
      if (global.House) House.init({ game: c.game });
      if (!ads) startAds(c.ads); if (!shop) startStore(c.store);
      if (realAds()) { let o = {}; try { o = Intl.DateTimeFormat().resolvedOptions(); } catch (_) { } dbg('réglages du téléphone', { langue: navigator.language, langues: navigator.languages, region: o.locale, fuseau: o.timeZone }); }   // mise au point
    },
    onAd: null,
    ads: {
      get available() { const r = realAds(); return (r && r.ready) || !!H() || (!r && sim()); },
      get interReady() { const r = realAds(); return (r && r.interReady) || !!H() || (!r && sim()); },
      get privacyRequired() { const r = realAds(); return !!r && r.privacy; },
      privacyOptions() { const r = realAds(); return r ? r.privacyOptions() : Promise.resolve(); },
      rewarded() { const r = realAds(), h = H(); if (r && r.ready) return r.rewarded(); if (h && (r || !sim() || h.forced)) return h.show(true); return r ? r.rewarded() : sim() ? simAd(true) : Promise.resolve(false); },
      interstitial() {
        const r = realAds(), h = H();
        if (h && (r ? !r.interReady || h.turn() : !sim() || h.forced)) return h.show(false).then(() => { });   // pub payante absente, ou tour de la pub maison
        return r ? r.interstitial() : sim() ? simAd(false).then(() => { }) : Promise.resolve();
      },
    },
    store: {
      products: PRODUCTS,
      loaded: false,
      get available() { return !!realStore() || sim(); },
      load() {   // une seule lecture réussie ; en cas d'échec (pas de réseau), la prochaine ouverture de la boutique réessaie
        if (loading) return loading;
        const r = realStore();
        loading = (r ? r.load() : Promise.resolve(sim() ? simPrices() : undefined)).then(() => { Monet.store.loaded = true; }, () => { loading = null; });
        return loading;
      },
      buy(id) { const p = PRODUCTS.find(x => x.id === id); if (!p || !p.price) return Promise.resolve(false); const r = realStore(); return r ? r.buy(p) : sim() ? simBuy(p) : Promise.resolve(false); },
      restore() { const r = realStore(); return r ? r.restore() : Promise.resolve([]); },
    },
    // mise au point dans le client de dev (vrais modules, page servie par le PC) : la coquille y ajoute deux boutons dans les réglages
    get devTools() { return DEV && !!realAds(); },
    resetConsent() { const r = realAds(); return r ? r.resetConsent() : Promise.resolve(); },
    get simulated() { return sim() && !realAds() && !realStore(); },
  };
})(window);
