/* Interactions communes du site nightbuilds.app (refonte du 1er oct. 2026). Sans dépendance.
   - langue : anglais dans la page, français dans les attributs data-fr (texte), data-fr-src, data-fr-alt, data-fr-href ; le français
     s'applique si le navigateur est en français ou avec ?lang=fr ; le lien .lang bascule ;
   - gelées : <div class="jelly" data-color="pink" data-w="1" data-h="2" style="left:…;top:…;width:…"> devient une gelée du jeu
     (SVG) dont le regard suit le pointeur ; on peut l'attraper et la lâcher (elle revient en rebondissant) ou la tapoter (éclats) ;
   - apparition des blocs .reveal au défilement, clip lancé quand il entre à l'écran, rangée de captures qui se tire à la souris ;
   - boutons de téléchargement : STORE (plus bas), vide tant que le jeu n'est pas sur l'App Store. */
(function () {
  const STORE = { jellies: '' };   // lien App Store par jeu : précommande puis téléchargement

  // ------------------------------------------------------------ langue
  const q = new URLSearchParams(location.search).get('lang');
  const lang = (q || navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
  if (lang === 'fr') {
    const root = document.documentElement; root.lang = 'fr';
    if (root.dataset.frTitle) document.title = root.dataset.frTitle;
    document.querySelectorAll('[data-fr]').forEach(e => { e.innerHTML = e.dataset.fr; });
    document.querySelectorAll('[data-fr-src]').forEach(e => { e.src = e.dataset.frSrc; });
    document.querySelectorAll('[data-fr-alt]').forEach(e => { e.alt = e.dataset.frAlt; });
    document.querySelectorAll('[data-fr-href]').forEach(e => { e.href = e.dataset.frHref; });
  }
  document.querySelectorAll('a.lang').forEach(a => { a.textContent = lang === 'fr' ? 'English' : 'Français'; a.href = '?lang=' + (lang === 'fr' ? 'en' : 'fr'); });
  // la langue choisie suit les liens internes du site
  if (q) document.querySelectorAll('a[href]').forEach(a => { const h = a.getAttribute('href'); if (/^(\.\.?\/|[\w-]+\/|[\w-]+\.html)/.test(h) && !/[?#]/.test(h)) a.setAttribute('href', h + '?lang=' + lang); });

  // ------------------------------------------------------------ boutons de téléchargement
  document.querySelectorAll('[data-store]').forEach(b => {
    const url = STORE[b.dataset.store];
    if (!url) return;
    b.href = url; b.classList.remove('soon');
    const s = b.querySelector('small'); if (s) s.textContent = lang === 'fr' ? 'Télécharger dans l’' : 'Download on the';
  });

  // ------------------------------------------------------------ gelées
  const COLORS = { pink: ['#FF5C7A', '#BE123C', '#FFB3C1'], yellow: ['#FFC533', '#B45309', '#FFE9A3'], green: ['#4CCB6F', '#15803D', '#B4F0C6'], blue: ['#4AA3FF', '#1D4ED8', '#B9DCFF'], purple: ['#A970F7', '#6B21A8', '#DCC4FD'], orange: ['#FF9A3D', '#C2410C', '#FFD2A8'] };
  let uid = 0;
  const jellies = [];
  document.querySelectorAll('.jelly').forEach(el => {
    const w = +el.dataset.w || 1, h = +el.dataset.h || 1, W = 100 * w, H = 100 * h, [base, dark, light] = COLORS[el.dataset.color] || COLORS.pink, id = 'j' + (uid++);
    const cx = W / 2, cy = h > 1 ? 62 : H * .44, gap = 17;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${light}"/><stop offset=".38" stop-color="${base}"/><stop offset="1" stop-color="${base}"/></linearGradient></defs>
      <rect x="5" y="5" width="${W - 10}" height="${H - 10}" rx="27" fill="url(#${id})" stroke="${dark}" stroke-width="6"/>
      <rect x="15" y="13" width="${W - 30}" height="15" rx="7.5" fill="#fff" opacity=".42"/>
      <ellipse cx="${cx - gap - 14}" cy="${cy + 15}" rx="8" ry="5" fill="${dark}" opacity=".28"/><ellipse cx="${cx + gap + 14}" cy="${cy + 15}" rx="8" ry="5" fill="${dark}" opacity=".28"/>
      <g class="eyes"><circle cx="${cx - gap}" cy="${cy}" r="11" fill="#fff" stroke="${dark}" stroke-width="2"/><circle cx="${cx + gap}" cy="${cy}" r="11" fill="#fff" stroke="${dark}" stroke-width="2"/>
      <g class="pupils"><circle cx="${cx - gap}" cy="${cy}" r="5.5" fill="#2b1708"/><circle cx="${cx + gap}" cy="${cy}" r="5.5" fill="#2b1708"/><circle cx="${cx - gap + 2}" cy="${cy - 2}" r="1.8" fill="#fff"/><circle cx="${cx + gap + 2}" cy="${cy - 2}" r="1.8" fill="#fff"/></g></g>
      <path class="smile" d="M${cx - 8} ${cy + 17}q8 9 16 0" fill="none" stroke="#2b1708" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse class="oh" cx="${cx}" cy="${cy + 21}" rx="6" ry="8" fill="#2b1708" style="display:none"/></svg>`;
    el.style.setProperty('--tilt', (el.dataset.tilt || (uid % 2 ? 3 : -3)) + 'deg'); el.style.animationDelay = (-uid * .9) + 's';
    const j = { el, pupils: el.querySelector('.pupils'), smile: el.querySelector('.smile'), oh: el.querySelector('.oh'), base, light };
    jellies.push(j);
    // attraper, déplacer, lâcher (retour élastique) ; simple tape = éclats de gelée
    let sx = 0, sy = 0, moved = false, held = false;
    el.addEventListener('pointerdown', e => { held = true; moved = false; sx = e.clientX; sy = e.clientY; el.setPointerCapture(e.pointerId); el.classList.remove('pop'); el.classList.add('held'); el.style.transition = 'none'; j.smile.style.display = 'none'; j.oh.style.display = ''; e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (!held) return; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.hypot(dx, dy) > 6) moved = true; el.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-18, Math.min(18, dx / 9))}deg) scale(1.06)`; });
    const drop = e => {
      if (!held) return; held = false; j.smile.style.display = ''; j.oh.style.display = 'none';
      el.style.transition = 'transform .7s cubic-bezier(.2, 1.9, .35, 1)'; el.style.transform = '';
      setTimeout(() => { el.style.transition = ''; el.classList.remove('held'); if (!moved) { void el.offsetWidth; el.classList.add('pop'); setTimeout(() => el.classList.remove('pop'), 550); } }, moved ? 700 : 0);
      if (!moved) burst(e.clientX, e.clientY, [base, light, '#fff']);
    };
    el.addEventListener('pointerup', drop); el.addEventListener('pointercancel', drop);
    el.addEventListener('animationend', e => { if (e.animationName === 'squish') el.classList.remove('pop'); });   // puis elle reprend son balancement
  });
  // le regard suit le pointeur (ou le doigt)
  window.addEventListener('pointermove', e => {
    for (const j of jellies) { const r = j.el.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height * .4), d = Math.hypot(dx, dy) || 1, k = Math.min(4.5, d / 40); j.pupils.setAttribute('transform', `translate(${dx / d * k} ${dy / d * k})`); }
  }, { passive: true });
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burst(x, y, colors) {
    if (calm) return;
    for (let i = 0; i < 14; i++) {
      const b = document.createElement('i'); b.className = 'bit'; b.style.background = colors[i % colors.length]; b.style.left = x - 6 + 'px'; b.style.top = y - 6 + 'px'; document.body.appendChild(b);
      const a = Math.random() * Math.PI * 2, v = 70 + Math.random() * 110, dx = Math.cos(a) * v, dy = Math.sin(a) * v - 60;
      b.animate([{ transform: 'translate(0,0) rotate(0) scale(1)', opacity: 1 }, { transform: `translate(${dx}px, ${dy + 170}px) rotate(${(Math.random() - .5) * 720}deg) scale(.4)`, opacity: 0 }], { duration: 700 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.4,1)', fill: 'forwards' });
      setTimeout(() => b.remove(), 1200);   // retrait par minuterie : sûr même si l'animation est suspendue (onglet en arrière-plan)
    }
  }
  // un clic sur un bouton en relief fait aussi quelques éclats
  document.querySelectorAll('.btn:not(.soon)').forEach(b => b.addEventListener('pointerdown', e => burst(e.clientX, e.clientY, ['#FFC533', '#FF4D6D', '#fff'])));

  // ------------------------------------------------------------ apparition au défilement, clip, captures
  const rev = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !calm) {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
    rev.forEach((e, i) => { e.style.transitionDelay = (i % 3) * 90 + 'ms'; io.observe(e); });
    document.querySelectorAll('video[data-auto]').forEach(v => new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) v.play().catch(() => { }); else v.pause(); }), { threshold: .4 }).observe(v));
  } else rev.forEach(e => e.classList.add('in'));
  document.querySelectorAll('.shots').forEach(s => {
    let down = false, x0 = 0, l0 = 0;
    s.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; x0 = e.clientX; l0 = s.scrollLeft; s.classList.add('drag'); });
    window.addEventListener('pointermove', e => { if (down) s.scrollLeft = l0 - (e.clientX - x0); });
    window.addEventListener('pointerup', () => { down = false; s.classList.remove('drag'); });
  });
})();
