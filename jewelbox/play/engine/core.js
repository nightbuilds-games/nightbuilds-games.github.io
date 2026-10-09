/* core.js — moteur des JEUX (produit), issu du tronc commun des prototypes (prototypes/shared/core.js, 30 sept. 2026).
   Canvas logique 1080x1920 (9:16), tweens, particules, sons synthétisés (Web Audio), bot d'auto-play, bannières, langue des textes,
   banc d'essai et compteur de surface. Aucune dépendance.
   Différences avec les prototypes (qui restent figés pour les clips de la campagne) : langue du téléphone par défaut (anglais sauf
   français), raccourcis clavier et doigt de tournage réservés au mode développeur (?dev), pause (C.pause), son réglable (C.setSound),
   vibrations (C.haptic). La coquille (shell.js : menus, sauvegarde, réglages) s'appuie dessus. */
(function (global) {
  const W = 1080, H = 1920;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // ------------------------------------------------------------ COMPTEUR DE SURFACE (?overdraw, 30 sept. 2026)
  // Sur téléphone, le coût graphique d'une image suit surtout la surface que la puce doit remplir. Le temps mesuré sur le PC de dev (portable
  // dont la fréquence varie avec la chaleur) est trop bruité pour juger une optimisation ; cette surface, elle, est la même d'un essai à l'autre.
  // Chaque ordre de dessin sur le canevas principal ajoute l'aire de son rectangle englobant, rognée à l'écran, en « écrans » (1 = tout l'écran),
  // par type : images (drawImage), formes (fill), traits (stroke), textes, et en plus la surface dessinée avec une ombre floue (flou). Les
  // découpes (clip) et les formes rondes ne sont pas déduites : c'est une borne haute, faite pour comparer avant / après. Les canevas hors écran
  // (caches, dessinés une fois) ne comptent pas. Résultat moyen par image dans le tableau du banc d'essai. Ralentit le dessin : ne pas mêler aux
  // mesures de temps.
  const URLP0 = { overdraw: (/[?&#]overdraw(?:=(\w+))?/.exec(String(window.location && window.location.href)) || [])[1] || (/[?&#]overdraw/.test(String(window.location && window.location.href)) ? true : undefined) };
  const OD = URLP0.overdraw ? { cur: odZero(), sum: odZero(), n: 0, lines: {} } : null;
  function odZero() { return { images: 0, formes: 0, traits: 0, textes: 0, flou: 0, appels: 0, degrades: 0 }; }
  if (OD) {
    const P = CanvasRenderingContext2D.prototype; let bb = null;
    const grow = (b, m, x, y) => { const X = m.a * x + m.c * y + m.e, Y = m.b * x + m.d * y + m.f; if (!b) return [X, Y, X, Y]; if (X < b[0]) b[0] = X; if (Y < b[1]) b[1] = Y; if (X > b[2]) b[2] = X; if (Y > b[3]) b[3] = Y; return b; };
    const box = (b, x, y, w, h) => { const m = ctx.getTransform(); b = grow(b, m, x, y); b = grow(b, m, x + w, y); b = grow(b, m, x, y + h); return grow(b, m, x + w, y + h); };
    const area = b => { if (!b) return 0; const cw = canvas.width, ch = canvas.height, w = Math.min(cw, b[2]) - Math.max(0, b[0]), h = Math.min(ch, b[3]) - Math.max(0, b[1]); return w > 0 && h > 0 ? w * h / (cw * ch) : 0; };
    const blurred = () => ctx.shadowBlur > 0 && !/^transparent$|,\s*0\s*\)$/.test(ctx.shadowColor) && ctx.shadowColor !== 'rgba(0, 0, 0, 0)';
    const scale = () => { const m = ctx.getTransform(); return Math.hypot(m.a, m.b); };
    // ?overdraw=detail : chaque surface est aussi attribuée à la ligne du jeu qui l'a dessinée (première ligne de game.js dans la pile d'appels) ;
    // le classement sort dans la console (window.OVERDRAW_DETAIL()) et dans BENCH_RESULT.surface_detail. Encore plus lent.
    const DETAIL = URLP0.overdraw === 'detail';
    const where = () => { const st = new Error().stack.split('\n'); for (const l of st) { const m = /\/([\w-]+\/game\.js):(\d+)/.exec(l); if (m) return m[1] + ':' + m[2]; } return 'core'; };
    const count = (kind, b, extra = 0) => {
      const a = area(b) + extra; OD.cur[kind] += a; OD.cur.appels++;
      let fl = 0; if (blurred() && b) { const e = ctx.shadowBlur * 2 * scale(); fl = area([b[0] - e, b[1] - e, b[2] + e, b[3] + e]); OD.cur.flou += fl; }
      if (DETAIL) { const k = where() + ' ' + kind; OD.lines[k] = (OD.lines[k] || 0) + a + fl; }
    };
    const wrap = (name, before) => { const orig = P[name]; ctx[name] = function (...a) { before(...a); return orig.apply(this, a); }; };
    wrap('beginPath', () => { bb = null; });
    wrap('moveTo', (x, y) => { bb = grow(bb, ctx.getTransform(), x, y); });
    wrap('lineTo', (x, y) => { bb = grow(bb, ctx.getTransform(), x, y); });
    wrap('quadraticCurveTo', (cx, cy, x, y) => { const m = ctx.getTransform(); bb = grow(grow(bb, m, cx, cy), m, x, y); });
    wrap('bezierCurveTo', (ax, ay, bx, by, x, y) => { const m = ctx.getTransform(); bb = grow(grow(grow(bb, m, ax, ay), m, bx, by), m, x, y); });
    wrap('arcTo', (ax, ay, x, y) => { const m = ctx.getTransform(); bb = grow(grow(bb, m, ax, ay), m, x, y); });
    wrap('arc', (x, y, r) => { bb = box(bb, x - r, y - r, 2 * r, 2 * r); });
    wrap('ellipse', (x, y, rx, ry) => { const r = Math.max(rx, ry); bb = box(bb, x - r, y - r, 2 * r, 2 * r); });
    wrap('rect', (x, y, w, h) => { bb = box(bb, x, y, w, h); });
    wrap('roundRect', (x, y, w, h) => { bb = box(bb, x, y, w, h); });
    wrap('fill', () => count('formes', bb));
    wrap('stroke', () => {   // un trait : son contour (périmètre du rectangle englobant × épaisseur), sans dépasser la boîte
      if (!bb) return; const lw = ctx.lineWidth * scale(), w = bb[2] - bb[0], h = bb[3] - bb[1];
      const b = [bb[0] - lw / 2, bb[1] - lw / 2, bb[2] + lw / 2, bb[3] + lw / 2], full = area(b), ring = Math.min(1, 2 * (w + h) * lw / Math.max(1, (w + lw) * (h + lw)));
      OD.cur.traits += full * ring; OD.cur.appels++; if (blurred()) OD.cur.flou += full;
      if (DETAIL) { const k = where() + ' traits'; OD.lines[k] = (OD.lines[k] || 0) + full * ring + (blurred() ? full : 0); }
    });
    wrap('fillRect', (x, y, w, h) => count('formes', box(null, x, y, w, h)));
    wrap('strokeRect', (x, y, w, h) => count('traits', box(null, x, y, w, h)));
    wrap('drawImage', (img, ...a) => {
      const [x, y, w, h] = a.length >= 8 ? a.slice(4, 8) : a.length >= 4 ? a.slice(0, 4) : [a[0], a[1], img.width, img.height];
      count('images', box(null, x, y, w, h));
    });
    const textBox = (str, x, y) => {
      const size = +((/(\d+(?:\.\d+)?)px/.exec(ctx.font) || [0, 16])[1]), w = P.measureText.call(ctx, str).width, al = ctx.textAlign;
      const x0 = al === 'center' ? x - w / 2 : (al === 'right' || al === 'end') ? x - w : x;
      return box(null, x0, y - size * .8, w, size * 1.4);
    };
    wrap('fillText', (s, x, y) => count('textes', textBox(s, x, y)));
    wrap('strokeText', (s, x, y) => count('textes', textBox(s, x, y)));
    for (const g of ['createLinearGradient', 'createRadialGradient', 'createPattern']) wrap(g, () => { OD.cur.degrades++; });
  }
  function odFrame() { for (const k in OD.cur) { OD.sum[k] += OD.cur[k]; OD.cur[k] = 0; } OD.n++; }
  function odReset() { OD.sum = odZero(); OD.n = 0; OD.lines = {}; }
  // les 20 lignes qui remplissent le plus (écrans par image, flou compris)
  function odDetail() { return Object.entries(OD.lines).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, v]) => [k, +(v / Math.max(1, OD.n)).toFixed(3)]); }
  global.OVERDRAW_DETAIL = () => OD && odDetail();
  function odResult() {
    const r = {}; for (const k in OD.sum) r[k] = +(OD.sum[k] / Math.max(1, OD.n)).toFixed(k === 'appels' || k === 'degrades' ? 0 : 2);
    r.total = +(r.images + r.formes + r.traits + r.textes).toFixed(2); return r;
  }
  global.OVERDRAW = () => OD && odResult();   // dans la console, hors banc d'essai : moyenne depuis le chargement

  // ------------------------------------------------------------ utils
  const rand = (a = 1, b) => (b === undefined ? Math.random() * a : a + Math.random() * (b - a));
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  const shuffle = (arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };

  const ease = {
    linear: t => t,
    outQuad: t => 1 - (1 - t) * (1 - t),
    inQuad: t => t * t,
    inOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    outCubic: t => 1 - Math.pow(1 - t, 3),
    inCubic: t => t * t * t,
    inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
    inBack: t => { const c1 = 1.70158, c3 = c1 + 1; return c3 * t * t * t - c1 * t * t; },
    outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
    outBounce: t => { const n1 = 7.5625, d1 = 2.75; if (t < 1 / d1) return n1 * t * t; if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + .75; if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + .9375; return n1 * (t -= 2.625 / d1) * t + .984375; },
  };

  function hexToRgb(hex) { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function rgbToHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
  // shade(hex, -0.3) assombrit, shade(hex, 0.3) éclaircit
  function shade(hex, amt) { const [r, g, b] = hexToRgb(hex); const t = amt < 0 ? 0 : 255; const p = Math.abs(amt); return rgbToHex(lerp(r, t, p), lerp(g, t, p), lerp(b, t, p)); }
  function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; }

  // ------------------------------------------------------------ dessin
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  // police embarquée (engine/fonts, déclarée dans shell.css) ; les suivantes servent de secours (symboles, page sans la coquille)
  const FONT = '"Nunito", "Arial Black", Impact, "Segoe UI", sans-serif';
  function text(str, x, y, o = {}) {
    // un texte à ombre floue (titres, accroches) coûte cher à la puce graphique à chaque image : il est dessiné une fois hors écran puis recopié.
    // Automatique si ses couleurs sont de simples chaînes ; un texte à dégradé (objet) doit donner lui-même une clé `cache: 'nom'` (son dégradé ne change pas).
    if (o.shadow && o.cache !== false && (o.cache || (typeof (o.color || '#fff') === 'string' && (!o.stroke || typeof o.stroke === 'string'))) && typeof document !== 'undefined' && document.createElement) return cachedText(str, x, y, o);
    ctx.save(); drawText(ctx, str, x, y, o); ctx.restore();
  }
  function drawText(c, str, x, y, o) {
    const { size = 60, color = '#fff', stroke = null, strokeW = 10, align = 'center', font = FONT, baseline = 'middle', alpha = 1, shadow = 0 } = o;
    c.globalAlpha = alpha;
    c.font = '900 ' + size + 'px ' + font;
    c.textAlign = align; c.textBaseline = baseline;
    c.lineJoin = 'round';
    if (shadow) { c.shadowColor = 'rgba(0,0,0,.45)'; c.shadowBlur = shadow; c.shadowOffsetY = shadow / 2; }
    if (stroke) { c.lineWidth = strokeW; c.strokeStyle = stroke; c.strokeText(str, x, y); }
    c.fillStyle = color; c.fillText(str, x, y);
  }
  // image du texte, liée à sa position (un dégradé est en coordonnées d'écran) et à l'échelle du dessin (arrondie au demi : net sans multiplier les copies)
  const textCache = new Map();
  // le canevas ne charge pas une police de lui-même : on la demande tout de suite ; les textes mis en cache avant son arrivée (dessinés
  // avec la police de secours) sont jetés une fois qu'elle est là
  if (typeof document !== 'undefined' && document.fonts && document.fonts.load) Promise.all(['800', '900'].map(w => document.fonts.load(w + ' 60px Nunito', 'Aéœ'))).then(() => textCache.clear(), () => { });
  function cachedText(str, x, y, o) {
    const m = ctx.getTransform(), k = clamp(Math.ceil(Math.hypot(m.a, m.b) * 2) / 2, .5, 3), ls = ctx.letterSpacing || '';
    const { size = 60, color = '#fff', stroke = null, strokeW = 10, align = 'center', font = FONT, baseline = 'middle', alpha = 1, shadow = 0 } = o;
    const key = [o.cache || '', str, x, y, k, ls, size, o.cache ? '' : color, stroke, strokeW, align, font, baseline, shadow].join('|');
    let sp = textCache.get(key);
    if (!sp) {
      if (textCache.size > 300) textCache.clear();   // textes changeants (compteurs) : on repart de zéro plutôt que de grossir sans fin
      ctx.save(); ctx.font = '900 ' + size + 'px ' + font; const w = ctx.measureText(str).width; ctx.restore();
      const pad = Math.ceil(shadow * 2.5 + (stroke ? strokeW : 0) + size * .15) + 4;
      const left = align === 'center' ? x - w / 2 : (align === 'right' || align === 'end') ? x - w : x;
      const top = baseline === 'middle' ? y - size * .75 : baseline === 'top' ? y - size * .25 : y - size * 1.1;
      sp = { x: left - pad, y: top - pad, w: w + 2 * pad, h: size * 1.6 + 2 * pad + shadow };
      sp.cv = document.createElement('canvas'); sp.cv.width = Math.ceil(sp.w * k); sp.cv.height = Math.ceil(sp.h * k);
      const c = sp.cv.getContext('2d'); c.scale(k, k); c.translate(-sp.x, -sp.y); if (ls) c.letterSpacing = ls;
      drawText(c, str, x, y, Object.assign({}, o, { alpha: 1 }));
      textCache.set(key, sp);
    }
    const a = ctx.globalAlpha; ctx.globalAlpha = alpha; ctx.drawImage(sp.cv, sp.x, sp.y, sp.w, sp.h); ctx.globalAlpha = a;
  }
  function emoji(str, x, y, size, alpha = 1) {
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.font = size + 'px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000'; // un fillStyle translucide rendrait l emoji transparent (Chrome)
    ctx.fillText(str, x, y + size * 0.06);
    ctx.restore();
  }
  // taille de police maximale (<= size) pour que str tienne dans maxW
  function fitSize(str, size, maxW, font = FONT) {
    ctx.save(); ctx.font = '900 ' + size + 'px ' + font; const w = ctx.measureText(str).width; ctx.restore();
    return w > maxW ? Math.floor(size * maxW / w) : size;
  }
  // recopie la partie (x, y, w, h) d'une image posée en (ox, oy) — tout en coordonnées de jeu — avec des bords calés sur les pixels réels de
  // l'écran : une image découpée en morceaux jointifs (pour ne pas recopier ses zones vides ou cachées) ne laisse alors aucune ligne à la jointure.
  function blit(img, ox, oy, x, y, w, h) {
    const m = ctx.getTransform();
    if (m.b || m.c) { if (w > 0 && h > 0) ctx.drawImage(img, x - ox, y - oy, w, h, x, y, w, h); return; }   // rotation : pas de calage possible
    const sx = v => (Math.round(v * m.a + m.e) - m.e) / m.a, sy = v => (Math.round(v * m.d + m.f) - m.f) / m.d;
    const x0 = sx(Math.max(x, ox)), y0 = sy(Math.max(y, oy)), x1 = sx(Math.min(x + w, ox + img.width)), y1 = sy(Math.min(y + h, oy + img.height));
    if (x1 > x0 && y1 > y0) ctx.drawImage(img, x0 - ox, y0 - oy, x1 - x0, y1 - y0, x0, y0, x1 - x0, y1 - y0);
  }
  function bgGradient(c1, c2) {
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); g.addColorStop(1, c2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }

  // ------------------------------------------------------------ tweens
  const tweens = [];
  function tween(obj, to, dur, o = {}) {
    const t = { obj, to, from: {}, dur: Math.max(0.0001, dur), t: 0, ease: o.ease || ease.outCubic, delay: o.delay || 0, onDone: o.onDone, onUpdate: o.onUpdate, dead: false, started: false };
    tweens.push(t); return t;
  }
  function killTweens(obj) { for (const t of tweens) if (t.obj === obj) t.dead = true; }
  function updateTweens(dt) {
    for (let i = 0; i < tweens.length; i++) {
      const t = tweens[i]; if (t.dead) continue;
      t.t += dt; if (t.t < t.delay) continue;
      if (!t.started) { t.started = true; for (const k in t.to) t.from[k] = t.obj[k]; }
      const p = clamp((t.t - t.delay) / t.dur, 0, 1); const e = t.ease(p);
      for (const k in t.to) t.obj[k] = t.from[k] + (t.to[k] - t.from[k]) * e;
      if (t.onUpdate) t.onUpdate(p);
      if (p >= 1) { t.dead = true; if (t.onDone) t.onDone(); }
    }
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].dead) tweens.splice(i, 1);
  }
  // minuteries : after(0.5, fn)
  const timers = [];
  function after(d, fn) { timers.push({ d, fn }); }
  function updateTimers(dt) { for (let i = timers.length - 1; i >= 0; i--) { timers[i].d -= dt; if (timers[i].d <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); } } }

  // ------------------------------------------------------------ particules / textes flottants
  const parts = [];
  function burst(x, y, o = {}) {
    const { color = '#fff', colors = null, count = 18, speed = 700, size = 16, life = 0.7, gravity = 1600, spread = Math.PI * 2, angle = -Math.PI / 2, shape = 'circle', drag = 2 } = o;
    for (let i = 0; i < count; i++) {
      const a = angle + (Math.random() - .5) * spread; const v = speed * rand(.35, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, size: size * rand(.5, 1.2), color: colors ? pick(colors) : color, gravity, shape, rot: rand(Math.PI * 2), vrot: rand(-10, 10), drag });
    }
  }
  const CONFETTI = ['#FF3B6B', '#FFC312', '#2ED573', '#1E90FF', '#A55EEA', '#FF7F11', '#00D2D3', '#ffffff'];
  function confetti(x, y, o = {}) {
    burst(x, y, Object.assign({ colors: CONFETTI, count: 60, speed: 1300, size: 22, life: 1.8, gravity: 1100, spread: Math.PI * 1.1, shape: 'rect', drag: 1.6 }, o));
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
      p.vy += p.gravity * dt; p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * .3 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vrot * dt;
    }
  }
  function drawParts() {
    for (const p of parts) {
      const k = p.life / p.maxLife;
      ctx.save(); ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = p.color; ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      if (p.shape === 'rect') { const w = p.size, h = p.size * .6 * Math.abs(Math.cos(p.rot * 2 + p.x * .01)); ctx.fillRect(-w / 2, -h / 2, w, h); }
      else { ctx.beginPath(); ctx.arc(0, 0, p.size / 2 * (.4 + .6 * k), 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }
  const floaters = [];
  // keep: true garde le texte entier à l'écran (il est recentré s'il déborde d'un bord : texte long né près d'un bord, traductions plus longues)
  function floatText(x, y, str, o = {}) {
    if (o.keep) { ctx.save(); ctx.font = '900 ' + (o.size || 64) + 'px ' + FONT; const hw = ctx.measureText(str).width / 2 + 24; ctx.restore(); x = hw * 2 > W ? W / 2 : clamp(x, hw, W - hw); }
    floaters.push({ x, y, str, t: 0, dur: o.dur || 0.9, size: o.size || 64, color: o.color || '#fff', stroke: o.stroke === undefined ? '#00000088' : o.stroke, vy: o.vy || -220 });
  }
  function updateFloaters(dt) { for (let i = floaters.length - 1; i >= 0; i--) { const f = floaters[i]; f.t += dt; f.y += f.vy * dt; if (f.t >= f.dur) floaters.splice(i, 1); } }
  function drawFloaters() { for (const f of floaters) { const p = f.t / f.dur; const s = ease.outBack(clamp(p * 4, 0, 1)); ctx.save(); ctx.translate(f.x, f.y); ctx.scale(s, s); text(f.str, 0, 0, { size: f.size, color: f.color, stroke: f.stroke, strokeW: 12, alpha: 1 - clamp((p - .6) / .4, 0, 1) }); ctx.restore(); } }

  // ------------------------------------------------------------ secousse, flash, bannière
  let shakeT = 0, shakeDur = 0, shakePow = 0;
  function shake(pow = 14, dur = 0.3) { shakePow = Math.max(shakePow, pow); shakeDur = shakeT = Math.max(shakeT, dur); }
  let flashA = 0, flashColor = '#fff';
  function flash(color = '#fff', a = .5) { flashColor = color; flashA = a; }
  let banner = null;
  function showBanner(str, sub = '', dur = 2.2, color = '#FFC312') { banner = { str, sub, dur, t: 0, color }; }

  // ------------------------------------------------------------ audio synthétisé
  const FORCE_MUTE = /[?&#]mute/.test(String(window.location && window.location.href));   // ?mute dans l'URL : aucun son, quels que soient les réglages (tests de Claude)
  let actx = null, master = null, gameBus = null, muted = FORCE_MUTE;   // gameBus : sortie donnée aux jeux (musique, sons propres), coupée pendant la pause
  function ensureAudio() {
    if (actx) { wake(); return; }
    try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    master = actx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(actx.destination);
    gameBus = actx.createGain(); gameBus.gain.value = paused ? 0 : 1; gameBus.connect(master); decodeSamples();
  }
  // Reprise du son. Sur iPhone, une veille de l'écran, un appel ou une pub en plein écran font passer le contexte à l'état « interrupted »
  // (et non « suspended ») : on reprend donc depuis tout état autre que « running ».
  function wake() { if (actx && actx.state !== 'running' && actx.state !== 'closed') { try { const p = actx.resume(); if (p && p.catch) p.catch(() => { }); } catch (_) { } } }
  function tone({ type = 'sine', f0 = 440, f1 = null, dur = .15, vol = .3, delay = 0 }) {
    if (!actx) return; const t = actx.currentTime + delay; if (f1 === null) f1 = f0;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .05);
  }
  let noiseBuf = null;
  function noise({ dur = .2, vol = .2, f = 1200, q = 0.8, delay = 0, f1 = null }) {
    if (!actx) return; const t = actx.currentTime + delay;
    if (!noiseBuf) { noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const s = actx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const fl = actx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + dur); fl.Q.value = q;
    const g = actx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(master); s.start(t); s.stop(t + dur + .05);
  }
  const sfx = {
    pop(p = 1) { tone({ type: 'sine', f0: 320 * p, f1: 950 * p, dur: .1, vol: .35 }); },
    plop(p = 1) { tone({ type: 'sine', f0: 700 * p, f1: 180 * p, dur: .14, vol: .35 }); },
    click() { tone({ type: 'square', f0: 1600, f1: 900, dur: .035, vol: .07 }); },
    ding(n = 0) { const f = 880 * Math.pow(2, n / 12); tone({ type: 'triangle', f0: f, dur: .5, vol: .22 }); tone({ type: 'sine', f0: f * 2, dur: .25, vol: .07 }); },
    whoosh() { noise({ dur: .22, vol: .2, f: 600, f1: 2200 }); },
    slide() { noise({ dur: .28, vol: .12, f: 400, f1: 900, q: 1.5 }); },
    fail() { tone({ type: 'sawtooth', f0: 200, f1: 90, dur: .3, vol: .18 }); tone({ type: 'square', f0: 150, f1: 70, dur: .3, vol: .06 }); },
    thud() { tone({ type: 'sine', f0: 150, f1: 40, dur: .2, vol: .45 }); noise({ dur: .08, vol: .1, f: 200 }); },
    screw() { for (let i = 0; i < 4; i++) tone({ type: 'square', f0: 700 + i * 120, f1: 900 + i * 120, dur: .04, vol: .05, delay: i * .045 }); },
    win() { [0, 4, 7, 12, 16].forEach((n, i) => tone({ type: 'triangle', f0: 523 * Math.pow(2, n / 12), dur: .55, vol: .2, delay: i * .09 })); },
    lock() { tone({ type: 'square', f0: 500, f1: 250, dur: .08, vol: .12 }); tone({ type: 'sine', f0: 1200, f1: 600, dur: .12, vol: .15, delay: .05 }); },
  };
  // SONS ENREGISTRÉS (oct. 2026) : un jeu peut remplacer des bruitages synthétisés par des fichiers (<jeu>/audio/manifest.js → window.GAME_AUDIO).
  // loadSamples(base, { nom: 'fichier.mp3' | { file, vol } }) télécharge tout de suite et décode dès que l'audio est ouvert (premier geste) ;
  // playSample(nom, { vol, rate, delay }) joue le son et renvoie true, ou false s'il n'existe pas ou n'est pas prêt : l'appelant garde alors son bruitage synthétisé.
  const samples = {};
  // fetchBytes(url) : contenu d'un fichier son. Dans l'appli iPhone (version store, jeu embarqué), Capacitor sert les fichiers audio et vidéo
  // sans code HTTP quand la demande n'a pas d'en-tête Range : `r.ok` est alors faux alors que le fichier est bien là, et tout retombait sur les
  // sons synthétisés. On demande donc une plage (réponse 206 en règle), et on accepte aussi un code 0 si le contenu n'est pas vide.
  function fetchBytes(url) {
    return fetch(url, { headers: { Range: 'bytes=0-' } }).then(r => r.ok || r.status === 0 ? r.arrayBuffer() : Promise.reject()).then(a => a && a.byteLength ? a : Promise.reject());
  }
  function loadSamples(base, map) {
    if (typeof fetch === 'undefined' || !map) return;
    for (const k in map) { const e = typeof map[k] === 'string' ? { file: map[k] } : map[k]; const s = samples[k] = { vol: e.vol === undefined ? 1 : e.vol, raw: null, buf: null }; fetchBytes(base + e.file).then(a => { s.raw = a; decodeSamples(); }).catch(() => { }); }
  }
  function decodeSamples() { if (!actx) return; for (const k in samples) { const s = samples[k]; if (s.raw && !s.buf) { const raw = s.raw; s.raw = null; try { actx.decodeAudioData(raw, b => { s.buf = b; }, () => { }); } catch (_) { } } } }
  function playSample(name, o = {}) {
    const s = samples[name]; if (!actx || !s || !s.buf) return false;
    const src = actx.createBufferSource(), g = actx.createGain(); src.buffer = s.buf; if (o.rate) src.playbackRate.value = o.rate; g.gain.value = s.vol * (o.vol === undefined ? 1 : o.vol);
    src.connect(g); g.connect(master); src.start(actx.currentTime + (o.delay || 0)); return true;
  }
  for (const k of ['click', 'ding', 'win', 'fail', 'pop', 'plop']) { const syn = sfx[k]; sfx[k] = (...a) => playSample(k, k === 'ding' ? { rate: Math.pow(2, (a[0] || 0) / 12) } : {}) || syn(...a); }   // bruitages communs (menus, pièces) remplaçables eux aussi
  function toggleMute() { muted = !muted || FORCE_MUTE; if (master) master.gain.value = muted ? 0 : 0.5; updateLegend(); }
  function setSound(on) { muted = !on || FORCE_MUTE; if (master) master.gain.value = muted ? 0 : 0.5; }   // réglage « son » de la coquille (la musique, elle, est réglée par le jeu)
  // vibrations : l'API du navigateur quand elle existe (Android) ; dans l'appli, le module Haptics de Capacitor prendra le relais (iPhone compris)
  // module natif de Capacitor (Preferences, Haptics…) : seulement dans l'appli (engine/vendor/capacitor.js fait le pont) ; null dans un navigateur
  const nativeCache = {};
  function native(name) {
    const Cap = global.Capacitor;
    if (!Cap || !Cap.isNativePlatform || !Cap.isNativePlatform()) return null;
    if (!(name in nativeCache)) nativeCache[name] = (Cap.isPluginAvailable && !Cap.isPluginAvailable(name)) ? null : (Cap.registerPlugin ? Cap.registerPlugin(name) : (Cap.Plugins && Cap.Plugins[name]) || null);
    return nativeCache[name];
  }
  let hapticsOn = true;
  const HAPTIC_MS = { light: 8, medium: 18, heavy: 35, success: [12, 60, 18], fail: [40, 60, 40] };
  function haptic(kind = 'light') {
    if (!hapticsOn) return;
    const cap = native('Haptics');
    if (cap) { try { if (kind === 'success' || kind === 'fail') cap.notification({ type: kind === 'success' ? 'SUCCESS' : 'ERROR' }); else cap.impact({ style: kind.toUpperCase() }); } catch (_) { } return; }
    if (typeof navigator !== 'undefined' && navigator.vibrate) try { navigator.vibrate(HAPTIC_MS[kind] || 10); } catch (_) { }
  }

  // ------------------------------------------------------------ entrées (pointeur unifié + bot)
  const pointer = { x: W / 2, y: H / 2, down: false, inside: false, idle: 0, showFinger: /[?&#]dev/.test(String(window.location && window.location.href)) };   // doigt de tournage : mode dev seulement
  // MODE TOURNAGE (touche T) : pour filmer en 9:16 pour TikTok / Instagram. Leur interface recouvre le haut (onglets), le quart bas (légende, musique)
  // et une bande à droite (boutons) : le jeu entier est réduit et remonté dans la zone sûre, légèrement décalé à gauche, présenté comme une carte aux
  // coins arrondis sur un fond aux couleurs du jeu (`filmBg: [haut, bas]` dans start()). L'aide est masquée, le doigt affiché. Les jeux ne voient que
  // des coordonnées de jeu : le pointeur réel est reconverti ici. Un jeu qui gère lui-même son cadrage déclare `ownFilm: true` (proto 3).
  let film = false;
  const FILM = { s: .82, cx: 520, oy: 120 };
  // en mode tournage l'aide est cachée par la classe `film` (H ne la réaffiche pas : elle finirait dans la vidéo)
  function toggleFilm() { film = !film; pointer.showFinger = true; if (document.body && document.body.classList) document.body.classList.toggle('film', film); }
  function toLocal(e) {
    const r = canvas.getBoundingClientRect(); let x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (film) { x = (x - FILM.cx) / FILM.s + W / 2; y = (y - FILM.oy) / FILM.s; }
    return { x, y };
  }
  let game = null;
  canvas.addEventListener('pointerdown', e => {
    ensureAudio(); if (bot.active) return;
    const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; pointer.down = true; pointer.inside = true; pointer.idle = 0;
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { }
    if (game && game.pointerDown) game.pointerDown(p.x, p.y);
    e.preventDefault();
  });
  window.addEventListener('pointermove', e => {
    if (bot.active) return;
    const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; pointer.idle = 0;
    pointer.inside = p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
    if (game && game.pointerMove) game.pointerMove(p.x, p.y);
  });
  const up = e => { if (bot.active) return; if (!pointer.down) return; pointer.down = false; const p = e.clientX !== undefined ? toLocal(e) : pointer; if (game && game.pointerUp) game.pointerUp(p.x, p.y); };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  const bot = { active: false, steps: [], x: W / 2, y: H / 2, down: false, speed: 3200 };
  Object.defineProperty(bot, 'idle', { get() { return bot.steps.length === 0; } });
  bot.moveTo = (x, y, dur) => { bot.steps.push({ type: 'move', x, y, dur }); return bot; };
  bot.press = () => { bot.steps.push({ type: 'down' }); return bot; };
  bot.release = () => { bot.steps.push({ type: 'up' }); return bot; };
  bot.wait = (d) => { bot.steps.push({ type: 'wait', dur: d }); return bot; };
  bot.tap = (x, y) => bot.moveTo(x, y).wait(.04).press().wait(.09).release().wait(.12);
  bot.drag = (x1, y1, x2, y2, dur) => bot.moveTo(x1, y1).press().wait(.07).moveTo(x2, y2, dur).wait(.06).release().wait(.12);
  bot.clear = () => { bot.steps.length = 0; };
  function setBot(on) {
    if (bot.active === on) return;
    bot.active = on; bot.clear();
    if (!on && bot.down) { bot.down = false; pointer.down = false; if (game.pointerUp) game.pointerUp(bot.x, bot.y); }
    if (on) { bot.x = pointer.x; bot.y = pointer.y; pointer.down = false; }
    updateLegend();
  }
  function updateBot(dt) {
    if (!bot.active) return;
    if (bot.steps.length === 0) { if (game.autoplay) game.autoplay(); if (bot.steps.length === 0) return; }
    const s = bot.steps[0];
    if (s.type === 'move') {
      if (s.t === undefined) { s.t = 0; s.sx = bot.x; s.sy = bot.y; if (s.dur === undefined) s.dur = clamp(dist(s.sx, s.sy, s.x, s.y) / bot.speed, .12, .55); }
      s.t += dt; const p = clamp(s.t / s.dur, 0, 1); const e = ease.inOutQuad(p);
      bot.x = lerp(s.sx, s.x, e); bot.y = lerp(s.sy, s.y, e);
      pointer.x = bot.x; pointer.y = bot.y; pointer.inside = true; pointer.idle = 0;
      if (game.pointerMove) game.pointerMove(bot.x, bot.y);
      if (p >= 1) bot.steps.shift();
    } else if (s.type === 'down') { bot.down = true; pointer.down = true; if (game.pointerDown) game.pointerDown(bot.x, bot.y); bot.steps.shift(); }
    else if (s.type === 'up') { bot.down = false; pointer.down = false; if (game.pointerUp) game.pointerUp(bot.x, bot.y); bot.steps.shift(); }
    else if (s.type === 'wait') { s.t = (s.t || 0) + dt; if (s.t >= s.dur) bot.steps.shift(); }
  }

  // ------------------------------------------------------------ KIT DE CLIP (campagne organique TikTok / Instagram, 18 sept. 2026)
  // Fonctions de tournage communes, pour que les 4 protos partent à armes égales dans la campagne (voir ../campagne-clips.md). Un jeu qui
  // déclare `useKit: true` dans start() (protos 1 et 3) les reçoit ; les protos 2 et 4 gardent leur propre bloc FEATURES, plus complet.
  // Tout se règle par l'URL : `?clip&loop&hook=1&level=47&auto&bot=2&endcard=0&film`, ou en jeu par C (clip), L (boucle), X (accroche).
  // Le jeu ne lit que KIT (réglages) et appelle kit.* (accroche, carte de fin, numéro affiché) : pour retirer une fonctionnalité, la mettre à false suffit.
  const URLP = (() => { const o = {}; const href = String(window.location && window.location.href || ''); href.split(/[?#]/).slice(1).join('&').split('&').forEach(kv => { if (!kv) return; const [k, v] = kv.split('='); o[k] = v === undefined ? true : decodeURIComponent(v); }); return o; })();
  const KIT = {
    clip: !!URLP.clip,                                   // C : niveau court calibré pour un clip de 15-30 s (CLIP dans chaque game.js), quel que soit le niveau atteint
    loop: !!URLP.loop,                                   // L : le même niveau repart à l'identique après une victoire, cartes de fin raccourcies (montage en boucle parfaite)
    hook: URLP.hook !== undefined ? +URLP.hook : -1,     // X : accroche affichée en haut à la place du titre (liste `hooks` de kit.setup), -1 = titre
    fakeLevel: URLP.level ? +URLP.level : 0,             // ?level=47 : numéro de niveau affiché (suggère la progression et la difficulté)
    endcard: URLP.endcard === '1',                       // jeux : coupée par défaut (?endcard=1 pour la réactiver). Fin de niveau : question qui appelle les commentaires (`endcards` à la victoire, `failcards` à l'échec)
    autostart: !!URLP.auto,                              // ?auto : le bot joue dès la première image (action dès la première frame)
    bot: URLP.bot !== undefined ? +URLP.bot : -1,        // ?bot=N : style de bot au démarrage (0 parfait, 1 humain, 2 suspense, 3 suspense raté), -1 = celui par défaut du jeu
  };
  // ?fs=0.88 : échelle du mode tournage (défaut 0,82 : tout le jeu dans la zone sûre TikTok / Instagram). Plus grand = plus lisible, mais le bas du jeu
  // passe sous la légende TikTok et le haut sous les onglets ; à juger sur un post « visible par moi seulement ». La carte reste centrée dans la zone sûre.
  if (URLP.fs) { const s = clamp(+URLP.fs || .82, .6, 1); FILM.s = s; FILM.cx = Math.round(520 - (s - .82) * 300); FILM.oy = Math.max(20, Math.round(120 - (s - .82) * 800)); }
  // ------------------------------------------------------------ LANGUE (22 sept. 2026) : ?lang=en affiche les textes du jeu en anglais
  // Les jeux gardent leurs textes en français dans le code et les passent par C.tr('…') ; chaque jeu déclare sa table français → anglais
  // avec C.i18n({ 'VIRÉ !': 'FIRED!' }). Un texte sans traduction reste en français et se signale une fois dans la console (pour le trouver).
  // Les variables s'écrivent {n} : C.tr('NIVEAU {n} RÉUSSI !', { n: 47 }). Les listes (accroches, cartes de fin) se déclarent par langue :
  // C.byLang({ fr: [...], en: [...] }). Sans ?lang, ou avec une langue inconnue, tout reste en français : les clips déjà tournés ne changent pas.
  // jeux : langue du téléphone (français si le téléphone est en français, anglais sinon) ; ?lang=fr / ?lang=en pour forcer
  // AUTRES LANGUES (5 oct. 2026 : espagnol, portugais du Brésil) : une table par langue, toujours à partir du texte français,
  // C.i18n({ 'JOUER': 'JUGAR' }, 'es') (engine/lang.js pour la coquille, <jeu>/lang.js pour le jeu). Un texte absent de la table de la langue
  // retombe sur l'anglais, puis sur le français. C.byLang({ fr, en }) cherche aussi le texte français dans la table de la langue.
  // Langue du téléphone si elle est dans LANGS, anglais sinon ; ?lang=es, ?lang=pt… pour forcer.
  const LANGS = ['fr', 'en', 'es', 'pt'];
  const LANG = (() => { const l = String(URLP.lang || (typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase().slice(0, 2); return LANGS.includes(l) ? l : 'en'; })();
  const DEV = !!URLP.dev;   // ?dev : raccourcis clavier (bot, recommencer, tournage…) et doigt affiché, comme dans les prototypes
  const dicts = { en: {} }, untranslated = new Set();
  const lookup = fr => { const d = dicts[LANG]; return d && d[fr] !== undefined ? d[fr] : dicts.en[fr]; };   // la langue, sinon l'anglais
  function tr(fr, vars) {
    let s = fr;
    if (LANG !== 'fr') { const e = lookup(fr); if (e !== undefined) s = e; else if (!untranslated.has(fr)) { untranslated.add(fr); console.warn('[lang=' + LANG + '] pas de traduction : ' + fr); } }
    if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
    return s;
  }
  function i18n(table, lang) { Object.assign(dicts[lang || 'en'] || (dicts[lang] = {}), table); }
  function byLang(o) { return o[LANG] || (LANG !== 'fr' && ((typeof o.fr === 'string' && dicts[LANG] && dicts[LANG][o.fr]) || o.en)) || o.fr; }
  const kitTexts = { hooks: [], endcards: [], failcards: [] }; let endcardI = 0, failcardI = 0;
  const kit = {
    setup(t) { for (const k in t) kitTexts[k] = Array.isArray(t[k]) ? t[k] : byLang(t[k]); },   // listes simples, ou { fr: [...], en: [...] }
    level(level) { return KIT.fakeLevel || level; },                      // numéro de niveau à afficher
    hook(level) { if (KIT.hook < 0 || !kitTexts.hooks.length) return null; return kitTexts.hooks[KIT.hook % kitTexts.hooks.length].replace(/\{n\}/g, kit.level(level)).split('|'); },
    // dessine l'accroche en haut (« | » = retour à la ligne) ; renvoie false si aucune accroche n'est active (le jeu dessine alors son titre)
    drawHook(level, o = {}) {
      const lines = kit.hook(level); if (!lines) return false;
      const { y = 110, size = 62, gap = 68, color = '#fff', stroke = '#7f1d1d', strokeW = 12 } = o;
      lines.forEach((line, i) => text(line, W / 2, y + (i - (lines.length - 1) / 2) * gap, { size: fitSize(line, size, W - 120), color, stroke, strokeW, shadow: 10 }));
      return true;
    },
    // question de fin de niveau (tourne dans la liste), ou `fallback` si la carte de fin est coupée
    endcard(kind = 'win', fallback = '') {
      const list = kind === 'fail' ? kitTexts.failcards : kitTexts.endcards;
      if (!KIT.endcard || !list.length) return fallback;
      return kind === 'fail' ? list[failcardI++ % list.length] : list[endcardI++ % list.length];
    },
    status() { return [KIT.clip && 'clip', KIT.loop && 'boucle', KIT.hook >= 0 && 'accroche ' + KIT.hook, KIT.fakeLevel && 'niveau ' + KIT.fakeLevel, LANG !== 'fr' && 'lang ' + LANG].filter(Boolean).join(' · '); },
  };
  function kitKey(k) {
    if (k === 'c') { KIT.clip = !KIT.clip; restart(); floatText(W / 2, H / 2 - 300, KIT.clip ? 'MODE CLIP' : 'MODE NORMAL', { color: '#fff', size: 64, dur: 1.4, vy: -40 }); }
    else if (k === 'l') { KIT.loop = !KIT.loop; floatText(W / 2, H / 2 - 300, KIT.loop ? 'BOUCLE' : 'BOUCLE COUPÉE', { color: '#fff', size: 64, dur: 1.4, vy: -40 }); }
    else if (k === 'x') { KIT.hook = KIT.hook + 1 >= kitTexts.hooks.length ? -1 : KIT.hook + 1; }
    updateLegend();
  }
  // générateur à graine (mulberry32) : niveaux et mises en place déterministes (die and retry, boucle de clip)
  function seeded(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

  // ------------------------------------------------------------ clavier
  window.addEventListener('keydown', e => {
    ensureAudio();
    if (!DEV) return;   // jeux : les raccourcis ne servent qu'au développement (?dev)
    const k = e.key.toLowerCase();
    if (k === 'r') restart();
    else if (k === 'a') setBot(!bot.active);
    else if (k === 'm') toggleMute();
    else if (k === 'f') { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); }
    else if (k === 'h') document.body.classList.toggle('nolegend');
    else if (k === 'd') { pointer.showFinger = !pointer.showFinger; }
    else if (k === 't' && !(game && game.ownFilm)) toggleFilm();
    else if (game && game.useKit && (k === 'c' || k === 'l' || k === 'x')) kitKey(k);
    else if (game && game.onKey) game.onKey(k);
  });
  function updateLegend() {
    const el = document.getElementById('legend'); if (!el) return;
    const a = el.querySelector('[data-k="a"]'); if (a) a.classList.toggle('on', bot.active);
    const m = el.querySelector('[data-k="m"]'); if (m) m.classList.toggle('on', muted);
    const kEl = el.querySelector('[data-k="kit"]'); if (kEl) { const s = kit.status(); kEl.innerHTML = '<b>C</b> clip · <b>L</b> boucle · <b>X</b> accroche' + (s ? ' — ' + s : ''); kEl.classList.toggle('on', !!s); }
  }

  // ------------------------------------------------------------ boucle
  // ?res=1 : canevas de 1080×1920 pixels réels quelle que soit la fenêtre (?res=2 : 2160×3840, le « canevas quatre fois plus grand » qui simule
  // une puce graphique faible sur le PC). Sans ?res, taille de la fenêtre × densité de l'écran plafonnée à 2 (ce que verra le joueur).
  const RES = URLP.res ? clamp(+URLP.res || 1, .25, 3) : 0;
  // QUALITÉ ADAPTATIVE (30 sept. 2026) : la limite des protos est la puce graphique (pixels à remplir), pas le JavaScript. Si l'intervalle médian
  // entre images dépasse 20 ms (< 50 i/s) sur une fenêtre de 2 s, la résolution du canevas baisse d'un cran (QUALITY), sans jamais descendre sous
  // 1 pixel réel par pixel CSS ; la médiane ignore les à-coups isolés (génération de niveau), qui ne se règlent pas en baissant la résolution.
  // Elle ne remonte pas (évite le yoyo). Coupée avec ?res (résolution imposée), en mode tournage (le PC d'OBS doit filmer net) et par ?adapt=0.
  const QUALITY = [1, .85, .7, .6];
  const ADAPT = { on: !RES && URLP.adapt !== '0', level: 0, win: [], winT: 0 };
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = Math.floor(W * s) + 'px'; canvas.style.height = Math.floor(H * s) + 'px';
    const k = RES || s * Math.max(Math.min(dpr, 1), dpr * QUALITY[ADAPT.level]);
    canvas.width = Math.floor(W * k); canvas.height = Math.floor(H * k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
  }
  window.addEventListener('resize', resize); resize();
  function adaptRecord(realMs) {
    if (!ADAPT.on || film || ADAPT.level >= QUALITY.length - 1) return;
    ADAPT.win.push(realMs); ADAPT.winT += realMs; if (ADAPT.winT < 2000) return;
    const med = ADAPT.win.slice().sort((a, b) => a - b)[ADAPT.win.length >> 1]; ADAPT.win.length = 0; ADAPT.winT = 0;
    if (med <= 20) return;
    const before = canvas.width; ADAPT.level++; resize();
    if (canvas.width === before) ADAPT.level = QUALITY.length - 1;   // déjà au plancher (écran de densité 1) : inutile de continuer
    console.log('[qualité] cran ' + ADAPT.level + ' (intervalle médian ' + med.toFixed(1) + ' ms) : canevas ' + canvas.width + '×' + canvas.height);
  }
  // Arrière-plan (autre appli, écran verrouillé, onglet caché) : le navigateur arrête déjà les images ; on suspend aussi le son (musiques en boucle)
  // et l'horloge repart à zéro au retour, pour ne pas compter la pause comme une image très lente.
  if (document.addEventListener) document.addEventListener('visibilitychange', () => {   // (absent du faux document de headless.js)
    if (document.hidden) { if (BENCH) BENCH.hidden = true; if (actx && actx.state === 'running') actx.suspend().catch(() => { }); }
    else { last = 0; if (!paused) wake(); }
  });

  // ------------------------------------------------------------ BANC D'ESSAI (30 sept. 2026) : ?bench ou ?bench=120 (secondes, 60 par défaut)
  // Le bot joue tout seul ; après 3 s de chauffe, chaque image est mesurée : intervalle entre deux images (ce que voit le joueur, puce graphique
  // comprise) et temps processeur de la logique (update) et du dessin (render, envoi des ordres de dessin seulement). À la fin, le bot s'arrête
  // et un tableau s'affiche sur le jeu (lisible sur téléphone, à photographier) ; aussi dans la console et dans window.BENCH_RESULT.
  // Image lente : plus de 25 ms (une image à 60 i/s ratée) ; saccade : plus de 50 ms (visible). Un onglet caché pendant la mesure l'invalide.
  // À combiner avec ?res=1 ou ?res=2 pour comparer des machines à résolution égale, et ?mute pour les essais répétés.
  const BENCH = URLP.bench ? { dur: clamp(URLP.bench === true ? 60 : (+URLP.bench || 60), 10, 600), warm: 3, t: 0, iv: [], upd: [], rnd: [], hidden: false, result: null, long: [], prev: null } : null;
  const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0;
  const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
  function benchRecord(realMs, updMs, rndMs) {
    const b = BENCH; if (b.result) return;
    b.t += realMs / 1000; if (document.hidden) b.hidden = true;
    if (b.t < b.warm) { if (OD) odReset(); return; }
    b.iv.push(realMs); b.upd.push(updMs); b.rnd.push(rndMs);
    // image longue (> 34 ms) : le travail qui l'a retardée a eu lieu à l'image PRÉCÉDENTE (logique ou dessin), ou hors de la boucle (autre tâche)
    if (realMs > 34) { const d = game && global.Core.dbg ? global.Core.dbg() : {}; b.long.push({ t: +(b.t - b.warm).toFixed(1), ms: Math.round(realMs), logique_avant: +(b.prev ? b.prev[0] : 0).toFixed(1), dessin_avant: +(b.prev ? b.prev[1] : 0).toFixed(1), niveau: d.level, etat: d.state, t_niveau: d.t }); }
    b.prev = [updMs, rndMs];
    if (b.t >= b.warm + b.dur) benchFinish();
  }
  function benchFinish() {
    const b = BENCH, iv = b.iv.slice().sort((x, y) => x - y), upd = b.upd.slice().sort((x, y) => x - y), rnd = b.rnd.slice().sort((x, y) => x - y);
    const total = b.iv.reduce((s, v) => s + v, 0), slow = b.iv.filter(v => v > 25).length, hitch = b.iv.filter(v => v > 50).length;
    const r = b.result = {
      jeu: document.title, secondes: Math.round(total / 1000), images: iv.length,
      fps: +(iv.length / (total / 1000)).toFixed(1), rafraichissement_hz: Math.round(1000 / pct(iv, .1)),
      intervalle_ms: { median: +pct(iv, .5).toFixed(1), p95: +pct(iv, .95).toFixed(1), p99: +pct(iv, .99).toFixed(1), max: +iv[iv.length - 1].toFixed(0) },
      images_lentes: slow, images_lentes_pct: +(slow / iv.length * 100).toFixed(1), saccades: hitch,
      update_ms: { moy: +avg(upd).toFixed(2), p95: +pct(upd, .95).toFixed(2) }, render_ms: { moy: +avg(rnd).toFixed(2), p95: +pct(rnd, .95).toFixed(2) },
      canevas: canvas.width + '×' + canvas.height, dpr: window.devicePixelRatio || 1, res: RES || 'fenêtre', qualite_cran: ADAPT.level, invalide: b.hidden,
      appareil: (navigator.userAgent.match(/\(([^)]+)\)/) || [, ''])[1],
    };
    r.longues = b.long.sort((x, y) => y.ms - x.ms).slice(0, 12);   // les 12 images les plus longues, pour trouver ce qui les cause
    if (OD) { r.surface = odResult(); if (Object.keys(OD.lines).length) r.surface_detail = odDetail(); }   // ?overdraw : écrans remplis par image (voir « Compteur de surface »)
    // verdict : vert = fluide ; orange = quelques accrocs ; rouge = le joueur le sent
    r.verdict = b.hidden ? 'INVALIDE' : (r.intervalle_ms.p95 <= 20 && r.images_lentes_pct < 1 && hitch <= 2) ? 'FLUIDE' : (r.intervalle_ms.p95 <= 34 && r.images_lentes_pct < 5) ? 'LIMITE' : 'SACCADÉ';
    setBot(false);
    window.BENCH_RESULT = r; console.log('[bench]', JSON.stringify(r)); console.table({ intervalle_ms: r.intervalle_ms, update_ms: r.update_ms, render_ms: r.render_ms });
  }
  function drawBench() {
    const b = BENCH;
    if (!b.result) {   // pendant la mesure : discret, en haut à droite
      const s = b.t < b.warm ? 'BANC : chauffe…' : 'BANC ' + Math.floor(b.t - b.warm) + ' / ' + b.dur + ' s';
      text(s, W - 24, 44, { size: 30, color: '#fff', stroke: '#000', strokeW: 7, align: 'right' }); return;
    }
    const r = b.result, col = { FLUIDE: '#7CFF7C', LIMITE: '#FFC312', 'SACCADÉ': '#ff5a5a', INVALIDE: '#ff5a5a' }[r.verdict];
    const lines = [
      [r.fps + ' i/s en moyenne', '#fff'], ['écran ~' + r.rafraichissement_hz + ' Hz', '#cbd5e1'],
      ['intervalle médian ' + r.intervalle_ms.median + ' ms', '#fff'], ['p95 ' + r.intervalle_ms.p95 + ' · p99 ' + r.intervalle_ms.p99 + ' · max ' + r.intervalle_ms.max + ' ms', '#fff'],
      ['images lentes ' + r.images_lentes + ' (' + r.images_lentes_pct + ' %) · saccades ' + r.saccades, '#fff'],
      ['logique ' + r.update_ms.moy + ' ms (p95 ' + r.update_ms.p95 + ')', '#cbd5e1'], ['dessin ' + r.render_ms.moy + ' ms (p95 ' + r.render_ms.p95 + ')', '#cbd5e1'],
      ['canevas ' + r.canevas + ' · dpr ' + r.dpr + (r.qualite_cran ? ' · qualité −' + r.qualite_cran : '') + ' · ' + r.images + ' images / ' + r.secondes + ' s', '#94a3b8'], [r.appareil, '#94a3b8'],
    ];
    if (r.surface) { const s = r.surface; lines.unshift(['surface ' + s.total + ' écrans/image · flou ' + s.flou, '#7dd3fc'], ['images ' + s.images + ' · formes ' + s.formes + ' · traits ' + s.traits + ' · textes ' + s.textes, '#7dd3fc'], [s.appels + ' ordres · ' + s.degrades + ' dégradés/image', '#7dd3fc']); }
    ctx.save(); ctx.fillStyle = 'rgba(2,6,23,.88)'; roundRect(50, 380, W - 100, 170 + lines.length * 72, 36); ctx.fill(); ctx.restore();
    text(r.verdict, W / 2, 470, { size: 96, color: col, stroke: '#000', strokeW: 14 });
    lines.forEach(([s, c], i) => text(s, W / 2, 590 + i * 72, { size: fitSize(s, 44, W - 180), color: c }));
  }

  let last = 0, time = 0, resumeAt = 0, fpsAvg = 0;
  // Plafond à 60 i/s : les écrans à 120 Hz (iPhone Pro, beaucoup d'Android) appelleraient frame() deux fois plus souvent, pour deux fois plus de
  // travail, de chauffe et de batterie sans gain visible dans ces jeux. Une image arrivée moins de 12 ms après la précédente est sautée (à 60 Hz,
  // l'intervalle ne descend jamais si bas). ?cap=0 enlève le plafond.
  const CAP_MS = URLP.cap === '0' ? 0 : 12;
  // PAUSE (menus de la coquille) : ni logique ni dessin, la dernière image reste à l'écran (zéro travail graphique, batterie épargnée), le son
  // est suspendu. `C.pause(false)` reprend là où on en était ; l'horloge repart sans compter la pause.
  // Un bouton de menu réveille le son pour son clic (unlockAudio) : la sortie des jeux reste donc coupée tant que dure la pause, sinon la
  // musique repartait dès qu'on ouvrait la boutique ou la carte des niveaux depuis la pause.
  let paused = false;
  function pause(on) {
    on = !!on; if (on === paused) return; paused = on; last = 0;
    if (gameBus) gameBus.gain.value = on ? 0 : 1;
    if (actx) { if (on && actx.state === 'running') actx.suspend().catch(() => { }); else if (!on) wake(); }
  }
  function frame(ts) {
    requestAnimationFrame(frame);
    if (paused) return;
    if (last && ts - last < CAP_MS) return;
    if (!document.hidden && actx && actx.state !== 'running' && ts > resumeAt) { resumeAt = ts + 1000; wake(); }   // navigateur sans geste utilisateur (OBS) : on tente de reprendre l'audio chaque seconde
    // pas de temps plafonné à 1/15 s (et non 1/30) : un navigateur qui ne rend que 20 images/s (source « navigateur » d'OBS sans accélération matérielle)
    // faisait tourner le jeu au ralenti (prise du 19 sept. 2026 : 22 s de chrono pour 30 s de vidéo). Au-dessous de 15 images/s le ralenti revient.
    const real = last ? (ts - last) / 1000 : 1 / 60, dt = Math.min(1 / 15, real); last = ts;
    fpsAvg = fpsAvg ? fpsAvg * .95 + (1 / Math.max(real, 1e-3)) * .05 : 60;
    adaptRecord(real * 1000);
    if (!BENCH) { step(dt); render(); if (OD) odFrame(); return; }
    const t0 = performance.now(); step(dt); const t1 = performance.now(); render(); const t2 = performance.now();
    if (OD) odFrame(); benchRecord(real * 1000, t1 - t0, t2 - t1);
  }
  function step(dt) {
    time += dt;
    updateTimers(dt); updateBot(dt); updateTweens(dt);
    if (game && game.update) game.update(dt);
    updateParts(dt); updateFloaters(dt);
    if (shakeT > 0) shakeT -= dt; else shakePow = 0;
    if (flashA > 0) flashA = Math.max(0, flashA - dt * 2.5);
    if (banner) { banner.t += dt; if (banner.t > banner.dur) banner = null; }
    pointer.idle += dt;
  }
  // avance la simulation de N secondes d un coup (tests / debug)
  function tick(sec) { const n = Math.round(sec * 60); for (let i = 0; i < n; i++) step(1 / 60); render(); }
  function render() {
    if (film) {
      const [c1, c2] = (game && game.filmBg) || ['#1e293b', '#020617'], x0 = FILM.cx - W / 2 * FILM.s, w = W * FILM.s, h = H * FILM.s;
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, shade(c1, -.45)); g.addColorStop(1, shade(c2, -.45)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 18; ctx.fillStyle = '#000'; roundRect(x0, FILM.oy, w, h, 44); ctx.fill(); ctx.restore();
      ctx.save(); roundRect(x0, FILM.oy, w, h, 44); ctx.clip(); ctx.translate(x0, FILM.oy); ctx.scale(FILM.s, FILM.s);
      renderGame(); ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 4; roundRect(x0, FILM.oy, w, h, 44); ctx.stroke();
      return;
    }
    renderGame();
  }
  function renderGame() {
    ctx.save();
    if (shakeT > 0) { const k = shakeT / shakeDur; ctx.translate(rand(-1, 1) * shakePow * k, rand(-1, 1) * shakePow * k); }
    if (game && game.draw) game.draw(ctx);
    drawParts(); drawFloaters();
    ctx.restore();
    if (flashA > 0) { ctx.save(); ctx.globalAlpha = flashA; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (banner) drawBanner();
    drawFinger();
    if (BENCH) drawBench();
    if (URLP.fps) text(Math.round(fpsAvg) + ' i/s', 24, 44, { size: 34, color: fpsAvg < 50 ? '#ff5a5a' : '#7CFF7C', stroke: '#000', strokeW: 8, align: 'left' });   // ?fps : cadence réelle du navigateur (diagnostic OBS, à retirer pour la prise)
  }
  function drawBanner() {
    const b = banner; const pin = clamp(b.t / .35, 0, 1), pout = clamp((b.t - (b.dur - .3)) / .3, 0, 1);
    const s = ease.outBack(pin) * (1 - ease.inBack(pout) * .3);
    ctx.save(); ctx.globalAlpha = 1 - pout;
    ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, H / 2 - 220 * s, W, 440 * s);
    ctx.translate(W / 2, H / 2); ctx.scale(s, s);
    text(b.str, 0, b.sub ? -40 : 0, { size: fitSize(b.str, 118, W - 140), color: b.color, stroke: '#000', strokeW: 18 });
    if (b.sub) text(b.sub, 0, 70, { size: fitSize(b.sub, 56, W - 160), color: '#fff', stroke: '#000', strokeW: 12 });
    ctx.restore();
  }
  function drawFinger() {
    if (!pointer.showFinger) return;
    const show = bot.active || (pointer.inside && pointer.idle < 2.5) || pointer.down;
    if (!show) return;
    const x = pointer.x, y = pointer.y;
    ctx.save();
    if (pointer.down) {
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 46, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 30, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function restart() { tweens.length = 0; timers.length = 0; parts.length = 0; floaters.length = 0; banner = null; bot.clear(); if (bot.down) { bot.down = false; pointer.down = false; } if (game && game.init) game.init(); }
  function start(g) {
    game = g; requestAnimationFrame(frame); if (g.init) g.init();
    if (URLP.film && !g.ownFilm && !film) toggleFilm();   // ?film : mode tournage dès le chargement (les protos 2 et 3, ownFilm, le font eux-mêmes)
    if (URLP.auto) ensureAudio();   // tournage sans les mains (source « navigateur » d'OBS, aucun clic) : on ouvre l'audio tout de suite ; s'il reste suspendu, frame() réessaie
    if (g.useKit && KIT.autostart) setBot(true);          // kit de clip : ?auto (les protos 2 et 4 le font eux-mêmes)
    if (BENCH) { setBot(true); if (document.body) document.body.classList.add('nolegend'); }   // ?bench : le bot joue pendant la mesure, aide masquée (H la rend)
    updateLegend();
  }

  // HUD_CLEAR : largeur (unités du canevas) laissée libre à gauche et à droite du titre d'un jeu, pour le bouton pause de la coquille
  global.Core = { W, H, ctx, canvas, rand, randi, pick, lerp, clamp, dist, shuffle, ease, shade, rgba, roundRect, text, fitSize, emoji, bgGradient, blit, FONT, CONFETTI,
    tween, killTweens, after, tick, tone, noise, audio: () => ({ ctx: actx, master: gameBus }), burst, confetti, floatText, shake, flash, showBanner, sfx, pointer, bot, setBot, start, restart,
    URLP, KIT, kit, seeded, updateLegend, FILM, lang: LANG, tr, i18n, byLang, get time() { return time; }, get film() { return film; },
    pause, get paused() { return paused; }, HUD_CLEAR: 170, setSound, loadSamples, fetchBytes, playSample, haptic, setHaptics(on) { hapticsOn = !!on; }, unlockAudio: ensureAudio, native, DEV };
})(window);
