/* stats.js — statistiques de jeu envoyées à GameAnalytics (1er oct. 2026). Chargé après core.js, avant shell.js ; la coquille l'appelle.

     Stats.init({ id, version, key, secret, enabled })   clés du jeu dans GameAnalytics (Shell.init({ stats: { key, secret } }))
     Stats.setEnabled(on)                                réglage « Statistiques anonymes » de la coquille
     Stats.level('Start'|'Complete'|'Fail', n, { attempt, score })   progression (niveau commencé, réussi, raté)
     Stats.coins(n, why)                                 pièces gagnées (n > 0) ou dépensées (n < 0) : win, double, free, buy, rescue
     Stats.ad(type, placement, action)                   'rewarded_video'|'interstitial' ; show, reward_received, failed_show
     Stats.purchase(product)                             achat confirmé (jamais en simulation)
     Stats.event('a:b:c', valeur)                        tout le reste (secours, tutoriel…)

   Sans dépendance : on parle directement à l'API de collecte de GameAnalytics (REST v2), signée en HMAC-SHA256 avec la « secret key »
   du jeu. Cette clé est embarquée dans l'appli comme dans tous les SDK de GameAnalytics : elle authentifie le jeu, pas un compte.

   Ce qui part : un identifiant aléatoire créé au premier lancement (ni l'identifiant publicitaire, ni rien qui vienne du téléphone),
   le système et sa version, la version du jeu, et les événements ci-dessus. Les événements attendent dans une file sauvegardée :
   une partie jouée hors ligne est envoyée à la connexion suivante.

   Trois régimes, choisis tout seuls :
     - appli (page embarquée, hors http) : envoi réel ;
     - développement (page servie en http par jeux/serve.js) : RIEN n'est envoyé, pour ne pas polluer les chiffres ;
       ?stats=log affiche les événements dans la console, ?stats les envoie pour de bon avec la version suffixée « -dev » ;
     - pas de clés pour ce jeu, ou réglage coupé : rien. */
(function (global) {
  const C = global.Core, U = C.URLP || {};
  const HTTP = /^https?:$/.test(location.protocol), LOG = U.stats === 'log', SEND = !HTTP || (U.stats !== undefined && !LOG);
  const API = 'https://api.gameanalytics.com/v2/', SDK = 'rest api v2', MAX_QUEUE = 500, BATCH = 100, EVERY = 15000;

  // ------------------------------------------------------------ HMAC-SHA256 (crypto.subtle n'existe pas sur une page http du réseau local)
  const K = (() => { const k = [], isP = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; }; for (let n = 2; k.length < 64; n++) if (isP(n)) k.push((Math.cbrt(n) % 1) * 4294967296 | 0); return k; })();
  function sha256(bytes) {
    const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], len = bytes.length;
    const pad = new Uint8Array(((len + 9 + 63) >> 6) << 6); pad.set(bytes); pad[len] = 0x80;
    const dv = new DataView(pad.buffer); dv.setUint32(pad.length - 8, Math.floor(len / 0x20000000)); dv.setUint32(pad.length - 4, (len << 3) >>> 0);
    const w = new Int32Array(64), rot = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < pad.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getInt32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (rot(a, 7) ^ rot(a, 18) ^ (a >>> 3)) + w[i - 7] + (rot(b, 17) ^ rot(b, 19) ^ (b >>> 10))) | 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + (rot(e, 6) ^ rot(e, 11) ^ rot(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0, t2 = ((rot(a, 2) ^ rot(a, 13) ^ rot(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0; h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer); h.forEach((x, i) => ov.setInt32(i * 4, x)); return out;
  }
  const utf8 = s => new TextEncoder().encode(s);
  function hmacB64(secret, body) {
    let k = utf8(secret); if (k.length > 64) k = sha256(k);
    const ip = new Uint8Array(64).fill(0x36), op = new Uint8Array(64).fill(0x5c); k.forEach((b, i) => { ip[i] ^= b; op[i] ^= b; });
    const cat = (a, b) => { const r = new Uint8Array(a.length + b.length); r.set(a); r.set(b, a.length); return r; };
    return btoa(String.fromCharCode(...sha256(cat(op, sha256(cat(ip, utf8(body)))))));
  }

  // ------------------------------------------------------------ état : identifiant, numéro de session, file d'attente
  const cap = () => C.native('Preferences');
  const store = {
    async get(k) { const p = cap(); if (p) { const r = await p.get({ key: k }); return r && r.value; } try { return localStorage.getItem(k); } catch (_) { return null; } },
    async set(k, v) { const p = cap(); if (p) return p.set({ key: k, value: v }); try { localStorage.setItem(k, v); } catch (_) { } },
  };
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3) | 8).toString(16); });
  function system() {   // plateforme et version, au format attendu par GameAnalytics (« ios 17.5 »)
    const ua = navigator.userAgent || '', capP = global.Capacitor && global.Capacitor.getPlatform && global.Capacitor.getPlatform();
    let m;
    if ((m = /(?:iPhone|iPad|iPod).*? OS (\d+)[_.](\d+)/.exec(ua)) || capP === 'ios') return { platform: 'ios', os: 'ios ' + (m ? m[1] + '.' + m[2] : '0.0'), maker: 'apple' };
    if ((m = /Android (\d+(?:\.\d+)?)/.exec(ua)) || capP === 'android') return { platform: 'android', os: 'android ' + (m ? m[1] : '0'), maker: 'unknown' };
    if ((m = /Mac OS X (\d+)[_.](\d+)/.exec(ua))) return { platform: 'mac_osx', os: 'mac_osx ' + m[1] + '.' + m[2], maker: 'apple' };
    if ((m = /Windows NT (\d+)/.exec(ua))) return { platform: 'windows', os: 'windows ' + m[1], maker: 'unknown' };
    return { platform: 'linux', os: 'linux 0', maker: 'unknown' };
  }
  let cfg = null, st = null, key = '', on = false, sys = null, session = '', t0 = 0, tsOff = 0, ready = false, timer = 0, busy = false;
  const persist = () => store.set(key, JSON.stringify(st));
  const active = () => !!cfg && on && (SEND || LOG);
  const now = () => Math.floor(Date.now() / 1000) + tsOff;

  async function post(path, body, keepalive) {
    const r = await fetch(API + cfg.key + '/' + path, { method: 'POST', keepalive: !!keepalive, headers: { 'Content-Type': 'application/json', Authorization: hmacB64(cfg.secret, body) }, body });
    return { status: r.status, text: await r.text().catch(() => '') };
  }
  function push(category, fields) {
    if (!active() || !session) return;
    const e = Object.assign({ category, device: 'unknown', v: 2, user_id: st.uid, client_ts: now(), sdk_version: SDK, os_version: sys.os, manufacturer: sys.maker,
      platform: sys.platform, session_id: session, session_num: st.n, build: cfg.version + (HTTP ? '-dev' : '') }, fields);
    if (LOG) return console.log('[stats]', category, JSON.stringify(fields || {}));
    st.q.push(e); if (st.q.length > MAX_QUEUE) st.q.splice(0, st.q.length - MAX_QUEUE);
    persist(); if (!timer) timer = setTimeout(flush, EVERY);
  }
  async function flush(keepalive) {
    clearTimeout(timer); timer = 0;
    if (!SEND || !ready || busy || !st.q.length) return;
    busy = true; const batch = st.q.slice(0, BATCH);
    try {
      const r = await post('events', JSON.stringify(batch), keepalive);
      // 200 : reçus. 400 : refusés par GameAnalytics (format) — les renvoyer ne servirait à rien, on les abandonne. Autre : on réessaiera.
      if (r.status === 200 || r.status === 400) { st.q.splice(0, batch.length); persist(); if (r.status === 400) console.warn('[stats] événements refusés : ' + r.text); }
    } catch (_) { }
    busy = false; if (st.q.length && !timer) timer = setTimeout(flush, EVERY);
  }
  function open() {   // nouvelle session : au lancement, et à chaque retour au premier plan
    session = uuid(); t0 = Date.now(); st.n++; persist(); push('user');
  }
  function close() { if (!session) return; push('session_end', { length: Math.max(0, Math.round((Date.now() - t0) / 1000)) }); session = ''; flush(true); }
  async function start() {
    if (!active() || session) return;
    if (SEND && !ready) {
      try {   // l'appel init dit si le jeu est accepté et donne l'heure du serveur (l'horloge du téléphone peut être fausse)
        const r = await post('init', JSON.stringify({ platform: sys.platform, os_version: sys.os, sdk_version: SDK })), j = JSON.parse(r.text || '{}');
        if (r.status === 200 && j.enabled === false) { on = false; return; }
        if (r.status === 200 && j.server_ts) tsOff = j.server_ts - Math.floor(Date.now() / 1000);
        if (r.status === 401) { console.warn('[stats] clés refusées par GameAnalytics'); on = false; return; }
      } catch (_) { }   // hors ligne : on joue quand même, la file partira plus tard
      ready = true;
    }
    if (!active() || session) return;
    open(); flush();
  }
  const pad = n => String(n).padStart(4, '0');
  const SOURCE = { win: 'reward:win', double: 'ad:double', free: 'ad:free', buy: 'iap:pack' }, SINK = { rescue: 'boost:rescue' };

  global.Stats = {
    async init(c) {
      if (!c || !c.key || !c.secret) return;
      cfg = c; key = c.id + '.stats'; sys = system(); on = c.enabled !== false;
      try { st = JSON.parse(await store.get(key) || 'null'); } catch (_) { st = null; }
      if (!st || !st.uid) st = { uid: uuid(), n: 0, tx: 0, q: [] }; if (!Array.isArray(st.q)) st.q = [];
      document.addEventListener('visibilitychange', () => { if (document.hidden) close(); else start(); });
      global.addEventListener('pagehide', close);
      start();
    },
    setEnabled(v) { if (!cfg) return; if (v) { on = true; start(); } else { close(); on = false; st.q = []; persist(); } },
    level(status, n, o) { const f = { event_id: status + ':level_' + pad(n) }; if (o && o.attempt) f.attempt_num = o.attempt; if (o && o.score !== undefined) f.score = Math.round(o.score); push('progression', f); },
    coins(n, why) { if (!n) return; push('resource', { event_id: (n > 0 ? 'Source:coins:' + (SOURCE[why] || 'other:' + why) : 'Sink:coins:' + (SINK[why] || 'other:' + why)), amount: Math.abs(n) }); },
    ad(type, placement, action) { push('ads', { ad_sdk_name: global.Monet && global.Monet.simulated ? 'simulation' : 'admob', ad_placement: placement, ad_type: type, ad_action: action }); },
    purchase(p) {   // prix en centimes, dans la devise donnée par le store ; le revenu exact est suivi par RevenueCat
      if (global.Monet && global.Monet.simulated) return push('design', { event_id: 'shop:simulated:' + p.id });
      st.tx++; push('business', { event_id: p.kind + ':' + p.id, amount: Math.round((p.value || 0) * 100), currency: p.currency || 'USD', transaction_num: st.tx, cart_type: 'shop' });
    },
    event(id, value) { const f = { event_id: id }; if (value !== undefined) f.value = value; push('design', f); },
    flush, get active() { return active(); }, get mode() { return !cfg ? 'off' : LOG ? 'log' : SEND ? 'send' : 'off'; }, _hmac: hmacB64,
  };
})(window);
