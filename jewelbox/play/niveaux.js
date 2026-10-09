/* Réglage de chaque niveau de Jewel Box (voir « RÉGLAGE PAR NIVEAU » dans game.js). NE PAS MODIFIER À LA MAIN : fichier écrit par
   node jeux/tools/ecrin-difficulte.js --regler, à partir de jeux/tools/ecrin-niveaux.json (qui garde la cible et les taux d'échec mesurés de chaque niveau).
   Un mot par niveau, vingt par ligne (une zone) : numéro du tirage, puis f (facile), + ou - (places du présentoir), c (une couleur de plus). */
window.ECRIN_NIVEAUX = [
  '0f 0f 0f 0f 0f 0f 0f 1f 1 5 5 6 1 9 1 4 8 19 11 6',
  '0f 3 1 13 7 0 2 0f 31 13 1 10 4 0f 8 6 3 12 2c 0',
  '5 0 0 4 3 0 4 0 13 4 1 4 4 4+ 6 8 5 2 7 2',
  '8 2 0 8 3 20 0 0 2 0 3 14 18 0 2 11 2 8 2 2',
  '0 0 0 0 8 10 1 1 9 9 9 9 17 2 3 4 4 32 7 4',
  '0 2 0 9 17c 20 5 3 5 6 8 2 3 8 1 14 26c 9 5 1',
  '0 11 0 1 12 8 9c 1 2 1 7 3 4 4 5 16 9 2 5 0',
  '8 9 23 1 15 16 17 15 6 4 14 13 19 1 0 10 2c 14 9 20',
  '2 12 13 2 5 2 5 20 5 6 9 20 0 12 2 10 13 26 9 2',
  '13 0 13 32 16 14 5 0 4 10 12 8 0 21+ 3 4 26c 14 10 16+',
  '0 5 9 17 12 6 22c 0 6 5 14 3 0 19 29 18 5 20 38 5',
  '1 1 0 5 6 10 3 6 3 2 30 0 5 1 2 0 10 16+ 4 18+',
  '0 35 0 7 8 4 1 2 7 15 7 34 5 2 5 0 14 7 13 19',
  '5 26c 6 12 13 0 3 1 2 0 4 9 2 6+ 8 9 2 1 20 1',
  '4 1 13 3 1 2 2 0 8 1 0 5 15 17 2c 0 3 8 14 1',
].join(' ');
