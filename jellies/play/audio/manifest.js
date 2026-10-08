/* Musiques et bruitages enregistrés des Gelées (facultatifs). Tant qu'une entrée est absente, le jeu garde son son synthétisé.
   Fichiers à poser dans ce dossier, en MP3 (lu partout, iPhone compris ; l'Ogg Vorbis ne l'est pas sur iPhone).
   - music : un morceau par zone, dans l'ordre (Fraise, Myrtille, Pomme, Citron, Cassis, Orange) ; null = musique générée pour cette zone.
   - sfx : nom du bruitage → fichier, ou { file, vol }. Noms du jeu : grab, drop, bump, exit, land, peel, tink, crack, ice, splash, melt,
     meltLong, fanfare, finale, heart, tic, drip ; noms communs (menus) : click, ding (pièce), win, fail.
   - credits : lignes (texte, ou { fr, en }) affichées en bas des réglages (obligatoires pour les licences avec attribution, CC BY par exemple). */
window.GAME_AUDIO = {
  base: 'audio/',
  musicVol: .6,
  music: ['zone1-carefree.mp3', 'zone2-wallpaper.mp3', 'zone3-easy-lemon.mp3', 'zone4-bossa-antigua.mp3', 'zone5-lobby-time.mp3', 'zone6-life-of-riley.mp3'],   // 110 premières secondes de chaque morceau, mono, 64 kbit/s
  // Équilibre des morceaux (5 oct. 2026) : ils ont le même volume global (−18 à −20 LUFS), mais « Carefree » est bien plus riche en médiums et
  // en aigus ; sur le haut-parleur d'un téléphone, qui ne rend pas les graves, les cinq autres paraissaient faibles (6 à 9 dB de moins au-dessus
  // de 500 Hz). Correction à la lecture, par morceau, en décibels : bass = étagère basse à 300 Hz, treble = étagère haute à 1,5 kHz, gain = volume.
  // Résultat mesuré : −19 à −21 LUFS en entier, −26 à −27 LUFS au-dessus de 500 Hz, pour les six. Un morceau absent de la liste est joué tel quel.
  musicTone: {
    'zone2-wallpaper.mp3': { bass: -9, gain: 5.5 }, 'zone3-easy-lemon.mp3': { bass: -9, treble: 1.5, gain: 5.5 }, 'zone4-bossa-antigua.mp3': { bass: -9, treble: 3, gain: 7 },
    'zone5-lobby-time.mp3': { bass: -9, treble: 4, gain: 5 }, 'zone6-life-of-riley.mp3': { bass: -6, gain: 3 },
  },
  // bruitages de Kenney (kenney.nl, domaine public CC0), convertis en MP3 ; les autres bruitages du jeu restent synthétisés
  sfx: {
    click: { file: 'click.mp3', vol: .25 },   // Interface Sounds, click_001
    ding: { file: 'ding.mp3', vol: .4 },      // Casino Audio, chips-collide-1 (pièce)
    grab: { file: 'grab.mp3', vol: .3 },      // Interface Sounds, select_001
    drop: { file: 'drop.mp3', vol: .35 },     // Interface Sounds, drop_002
    bump: { file: 'bump.mp3', vol: .4 },      // Impact Sounds, impactSoft_medium_000
    exit: { file: 'exit.mp3', vol: .55 },     // Interface Sounds, confirmation_001
    tink: { file: 'tink.mp3', vol: .35 },     // Interface Sounds, glass_001
    crack: { file: 'crack.mp3', vol: .5 },    // Impact Sounds, impactGlass_medium_000
    wood: { file: 'wood.mp3', vol: .5 },      // Impact Sounds, impactPlank_medium_000
  },
  credits: [
    // version courte (les réglages doivent tenir à l'écran) ; les titres des morceaux sont sur la page du jeu, nightbuilds.app/jellies
    { fr: 'Musique : Kevin MacLeod (incompetech.com), licence CC BY 4.0 · Bruitages : Kenney (kenney.nl)',
      en: 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0 license · Sounds: Kenney (kenney.nl)' },
  ],
};
