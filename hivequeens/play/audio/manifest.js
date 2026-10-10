/* Musiques et bruitages enregistrés de Hive Queens (facultatifs). Tant qu'une entrée est absente, le jeu garde son son synthétisé ; sans morceau, pas de musique.
   Fichiers à poser dans ce dossier, en MP3 (lu partout, iPhone compris ; l'Ogg Vorbis ne l'est pas sur iPhone).
   - music  : liste de morceaux (nom du fichier sans « .mp3 »), un par zone de la carte, en boucle ; la liste recommence quand il y a plus de zones que de morceaux.
              Pour écouter un autre morceau sans rien changer ici : ?musique=<nom> dans l'adresse.
   - sfx    : nom du bruitage → fichier, ou { file, vol }. Noms du jeu : croix (case barrée), reine (reine posée), retire (case vidée), conflit (deux reines
              se gênent), indice, annule, gagne (grille résolue) ; noms communs (menus) : click, ding.
   - credits : lignes affichées en bas des réglages (obligatoires pour les licences avec attribution, CC BY par exemple). */
window.GAME_AUDIO = {
  base: 'audio/',
  musicVol: .5,
  // morceaux de Kevin MacLeod (incompetech.com, CC BY 4.0), choisis calmes et dépouillés (10 oct. 2026, à écouter) : 110 premières secondes, mono,
  // volume égalisé à −19 LUFS, fondus au début et à la fin. Sources : jeux/art/sons-reines-sources/musique.
  //   gymnopedie : Gymnopédie n° 1 (Satie, piano) ; meditation-1, meditation-2 : Meditation Impromptu 01 et 02 (piano seul) ; evening-harp : Evening Fall (harpe)
  music: ['gymnopedie', 'meditation-1', 'evening-harp', 'meditation-2'],
  // bruitages de Kenney (kenney.nl, domaine public CC0), convertis en MP3 (sources : jeux/art/sons-ecrin-sources/kenney). Choisis sur leur nom : à écouter.
  sfx: {
    croix: { file: 'croix.mp3', vol: .5 },       // Interface Sounds, tick_002
    reine: { file: 'reine.mp3', vol: .7 },       // Interface Sounds, drop_002
    retire: { file: 'retire.mp3', vol: .5 },     // Interface Sounds, back_001
    conflit: { file: 'conflit.mp3', vol: .45 },  // Interface Sounds, error_004 (comme le présentoir plein de Jewel Box)
    indice: { file: 'indice.mp3', vol: .6 },     // Interface Sounds, question_002
    annule: { file: 'annule.mp3', vol: .5 },     // Interface Sounds, back_003
    gagne: { file: 'gagne.mp3', vol: .7 },       // Music Jingles, Pizzicato jingles, jingles_PIZZI07
    click: { file: 'click.mp3', vol: .25 },      // Interface Sounds, click_001 (comme Jellies)
    ding: { file: 'ding.mp3', vol: .4 },         // Casino Audio, chips-collide-1 (pièce, comme Jellies)
  },
  credits: [
    { fr: 'Musique : Kevin MacLeod (incompetech.com), licence CC BY 4.0 · Bruitages : Kenney (kenney.nl)',
      en: 'Music: Kevin MacLeod (incompetech.com), CC BY 4.0 license · Sounds: Kenney (kenney.nl)' },
  ],
};
