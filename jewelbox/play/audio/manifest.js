/* Musiques et bruitages enregistrés de Jewel Box (facultatifs). Tant qu'une entrée est absente, le jeu garde son son synthétisé.
   Fichiers à poser dans ce dossier, en MP3 (lu partout, iPhone compris ; l'Ogg Vorbis ne l'est pas sur iPhone).
   - music  : le morceau de chaque zone (clé de ECRIN_ZONES dans objets.js) ; base = le morceau des zones qui n'ont pas encore le leur ; null = musique générée.
              Pour écouter un autre morceau sans rien changer ici : ?musique=frost-waltz dans l'adresse (nom du fichier sans « .mp3 »).
   - tracks : pour chaque morceau, key = la tonique de son majeur (0 = do … 11 = si ; pour un morceau mineur, son relatif majeur), mesurée par
              `node jeux/tools/tonalite.js <fichier>`. Les bruitages à hauteur de note (gemme posée, étoiles, combo, final) sont transposés dans cette
              tonalité : ils sonnent juste sur le morceau au lieu de frotter contre lui.
   - sfx    : nom du bruitage → fichier, ou { file, vol }. Noms du jeu : unset (gemme dessertie), set (gemme posée dans l'écrin), tray (posée sur le
              présentoir), close (écrin qui se ferme), drop et bounce (pièce qui tombe, qui rebondit), reveal (gemme dévoilée), full (présentoir plein),
              blocked (gemme couverte ou cadenassée), unlock (cadenas qui sautent), links (gemmes enchaînées), tick ; noms communs (menus) : click, ding.
   - credits : lignes affichées en bas des réglages (obligatoires pour les licences avec attribution, CC BY par exemple). */
window.GAME_AUDIO = {
  base: 'audio/',
  musicVol: .55,
  // un morceau par zone (8 oct. 2026) : dix morceaux pour quinze zones, un même morceau ne revient pas avant cinq zones
  music: { base: 'frost-waltz', joyaux: 'music-box-theme', bijoux: 'fairytale-waltz', jardin: 'garden-music', campagne: 'enchanted-valley', mer: 'aquarium',
    gourmandises: 'sugar-plum-fairy', palais: 'frost-waltz', musique: 'dreamy-flashback', jungle: 'enchanted-journey', voyage: 'enchanted-valley',
    merveilles: 'garden-music', maison: 'music-box-theme', contes: 'atlantean-twilight', fetes: 'sugar-plum-fairy', curiosites: 'fairytale-waltz' },
  // morceaux de Kevin MacLeod (incompetech.com, CC BY 4.0) : 110 premières secondes au plus, mono, volume égalisé à −19 LUFS, fondus au début et à la fin
  tracks: {
    'aquarium': { key: 0 },              // Aquarium (Saint-Saëns), la mineur
    'frost-waltz': { key: 3 },           // Frost Waltz, do mineur
    'dreamy-flashback': { key: 0 },      // Dreamy Flashback, do majeur
    'atlantean-twilight': { key: 3 },    // Atlantean Twilight, do mineur
    'music-box-theme': { key: 7 },       // Music Box Theme, sol majeur
    'fairytale-waltz': { key: 3 },       // Fairytale Waltz, do mineur
    'enchanted-valley': { key: 9 },      // Enchanted Valley, la majeur
    // candidats du 8 oct. 2026, à écouter (?musique=<nom>) pour remplacer Floating Cities
    'sugar-plum-fairy': { key: 7 },      // Dance of the Sugar Plum Fairy (Tchaïkovski), mi mineur
    'enchanted-journey': { key: 0 },     // Enchanted Journey, do majeur
    'garden-music': { key: 0 },          // Garden Music, do majeur
  },
  // bruitages de Kenney (kenney.nl, domaine public CC0), convertis en MP3 ; les autres bruitages du jeu restent synthétisés
  sfx: {
    unset: { file: 'unset.mp3', vol: .55 },     // Impact Sounds, impactGlass_light_000
    set: { file: 'set.mp3', vol: .6 },          // Casino Audio, chips-stack-2
    tray: { file: 'tray.mp3', vol: .6 },        // Impact Sounds, impactSoft_medium_001
    close: { file: 'close.mp3', vol: .8 },      // RPG Audio, bookClose
    drop: { file: 'drop.mp3', vol: .5 },        // Impact Sounds, impactPlate_light_002
    bounce: { file: 'bounce.mp3', vol: .4 },    // Impact Sounds, impactPlate_medium_001
    reveal: { file: 'reveal.mp3', vol: .35 },   // Interface Sounds, glass_003
    full: { file: 'full.mp3', vol: .45 },       // Interface Sounds, error_004
    blocked: { file: 'blocked.mp3', vol: .5 },  // RPG Audio, metalClick
    unlock: { file: 'unlock.mp3', vol: .8 },    // RPG Audio, metalLatch
    links: { file: 'links.mp3', vol: .6 },      // RPG Audio, handleCoins
    tick: { file: 'tick.mp3', vol: .3 },        // Interface Sounds, pluck_001
    click: { file: 'click.mp3', vol: .25 },     // Interface Sounds, click_001 (comme Jellies)
    ding: { file: 'ding.mp3', vol: .4 },        // Casino Audio, chips-collide-1 (pièce, comme Jellies)
  },
  credits: [
    { fr: 'Musique : Kevin MacLeod (incompetech.com), licence CC BY 4.0 · Bruitages : Kenney (kenney.nl)',
      en: 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0 license · Sounds: Kenney (kenney.nl)' },
  ],
};
