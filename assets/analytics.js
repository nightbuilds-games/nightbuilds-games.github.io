/* Mesure d'audience du site nightbuilds.app (ajoutée le 18 oct. 2026) : Google Analytics 4, propriété « nightbuilds.app » du compte
   Google de Pierre, flux web d'ID G-62XCHG9FC9. Sert à voir d'où viennent les visiteurs (TikTok, Instagram, YouTube…), les pages vues
   et les clics vers l'App Store (mesure améliorée de GA : liens sortants).
   Consentement (CNIL) : Google Analytics n'est chargé qu'après « Accepter ». À la première visite, un bandeau en bas de page propose
   Accepter / Refuser, avec le même poids ; le choix est gardé six mois dans le navigateur (localStorage « nb-consent »), puis redemandé.
   Sans accord, rien n'est envoyé à Google. Un lien a.consent-open (page de confidentialité) rouvre le bandeau ; refuser après avoir
   accepté efface les cookies _ga. À charger après site.js, qui fixe la langue de la page (anglais, français, espagnol, portugais). */
(function () {
  const ID = 'G-62XCHG9FC9', KEY = 'nb-consent', KEEP = 182 * 864e5;
  const T = {
    en: ['We’d like to use Google Analytics to count visits and see which pages you enjoy. Is that OK?', 'Accept', 'Refuse', 'Learn more'],
    fr: ['Nous aimerions utiliser Google Analytics pour compter les visites et voir les pages qui vous plaisent. D’accord ?', 'Accepter', 'Refuser', 'En savoir plus'],
    es: ['Nos gustaría usar Google Analytics para contar las visitas y ver qué páginas te gustan. ¿Te parece bien?', 'Aceptar', 'Rechazar', 'Más información'],
    pt: ['Gostaríamos de usar o Google Analytics para contar as visitas e ver de quais páginas você gosta. Tudo bem?', 'Aceitar', 'Recusar', 'Saiba mais'],
  };

  function read() {
    try { const c = JSON.parse(localStorage.getItem(KEY)); return c && Date.now() - c.t < KEEP ? c.v : null; } catch (e) { return null; }
  }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify({ v, t: Date.now() })); } catch (e) {} }

  let loaded = false;
  function load() {
    if (loaded) return;
    loaded = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', ID, { cookie_expires: 13 * 30 * 86400 });   // 13 mois au plus (CNIL) ; GA garde 2 ans par défaut
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(s);
  }
  // refus après accord : on coupe l'envoi et on efface les cookies de GA (_ga, _ga_…), posés sur le domaine principal
  function forget() {
    window['ga-disable-' + ID] = true;
    document.cookie.split(';').map(c => c.split('=')[0].trim()).filter(n => /^_ga/.test(n)).forEach(n => {
      for (const d of ['', '; domain=' + location.hostname, '; domain=.' + location.hostname.replace(/^www\./, '')])
        document.cookie = n + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + d;
    });
  }

  function banner() {
    if (document.querySelector('.consent')) return;
    const l = (document.documentElement.lang || 'en').slice(0, 2), t = T[l] || T.en;
    const b = document.createElement('div');
    b.className = 'consent';
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Google Analytics');
    b.innerHTML = '<p></p><div class="consent-btns"><button type="button" data-v="yes"></button><button type="button" data-v="no"></button></div>';
    const p = b.querySelector('p'), more = document.createElement('a');
    p.textContent = t[0] + ' ';
    more.href = '/privacy.html' + (l === 'fr' ? '?lang=fr#site' : '?lang=en#site-en');
    more.textContent = t[3];
    p.appendChild(more);
    b.querySelector('[data-v=yes]').textContent = t[1];
    b.querySelector('[data-v=no]').textContent = t[2];
    b.addEventListener('click', e => {
      const v = e.target.dataset && e.target.dataset.v;
      if (!v) return;
      save(v);
      if (v === 'yes') load(); else forget();
      b.remove();
    });
    document.body.appendChild(b);
  }

  const c = read();
  if (c === 'yes') load();
  else if (c !== 'no') banner();
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a.consent-open');
    if (a) { e.preventDefault(); banner(); }
  });
})();
