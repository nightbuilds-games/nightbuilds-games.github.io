/* lang.js — textes de la coquille (engine/shell.js) dans les langues autres que le français et l'anglais (5 oct. 2026).
   Chargé après core.js. La clé est toujours le texte français du code ; un texte absent d'une table retombe sur l'anglais (voir core.js).
   Espagnol : neutre (Amérique latine et Espagne), tutoiement. Portugais : du Brésil, « você ».
   Vérification : `node jeux/tools/langues.js` signale les textes sans traduction et les variables {n} oubliées.
   Les textes de la simulation des pubs et des achats (développement seulement) ne sont pas traduits. */
(function (C) {
  C.i18n({
    'JOUER': 'JUGAR', 'NIVEAU {n}': 'NIVEL {n}', 'NIVEAUX': 'NIVELES', 'RÉGLAGES': 'AJUSTES', 'PAUSE': 'PAUSA', 'REPRENDRE': 'REANUDAR',
    'RECOMMENCER': 'REINICIAR', 'SUIVANT': 'SIGUIENTE', 'REJOUER': 'REPETIR', 'Son': 'Sonido', 'Musique': 'Música', 'Vibrations': 'Vibración',
    'NIVEAU {n} RÉUSSI !': '¡NIVEL {n} SUPERADO!', 'Temps : {t}': 'Tiempo: {t}', 'Record : {t}': 'Récord: {t}', 'NOUVEAU RECORD !': '¡NUEVO RÉCORD!',
    'Effacer la progression': 'Borrar el progreso', 'Effacer toute la progression ? Les étoiles et les niveaux débloqués seront perdus.': '¿Borrar todo el progreso? Se perderán las estrellas y los niveles desbloqueados.',
    'Retour': 'Volver', 'Pause': 'Pausa', 'Niveau verrouillé': 'Nivel bloqueado', 'Politique de confidentialité': 'Política de privacidad',
    'BOUTIQUE': 'TIENDA', 'Pièces': 'Monedas', '×2 avec une pub': '×2 con un anuncio', 'CONTINUER ?': '¿CONTINUAR?', 'CONTINUER': 'CONTINUAR', 'Continuer · {c}': 'Continuar · {c}',
    'Regarder une pub': 'Ver un anuncio', 'Non merci': 'No, gracias', 'Pas assez de pièces': 'No tienes suficientes monedas', 'Sans pubs': 'Sin anuncios', 'Acheté': 'Comprado',
    'Pièces gratuites (pub)': 'Monedas gratis (anuncio)', 'Restaurer les achats': 'Restaurar compras', 'Plus de pièces gratuites aujourd’hui': 'No hay más monedas gratis hoy',
    'Plus de pubs entre les niveaux': 'Quita los anuncios entre niveles', 'Statistiques anonymes': 'Estadísticas anónimas', 'Confidentialité des pubs': 'Privacidad de los anuncios', 'Achats restaurés': 'Compras restauradas', 'Aucun achat à restaurer': 'No hay compras que restaurar',
    'DIFFICILE': 'DIFÍCIL', 'TRÈS DIFFICILE': 'MUY DIFÍCIL', 'Zone {z}': 'Zona {z}', 'NOUVEAU !': '¡NUEVO!', 'C’EST PARTI': '¡VAMOS!', 'niveau {n}': 'nivel {n}',
    'NOUVELLE AIDE !': '¡NUEVA AYUDA!', 'Une offerte pour l’essayer': 'Una gratis para probarla', 'Acheter · {c}': 'Comprar · {c}', 'Symboles des couleurs': 'Símbolos de colores', 'Niv. {n}': 'Niv. {n}',
    'LA SUITE DANS L’APPLI': 'SIGUE EN LA APP', 'BRAVO !': '¡BRAVO!', 'Tu as fini la démo. Dans l’appli : six mondes, des centaines de niveaux et de nouvelles surprises.': 'Terminaste la demo. En la app: seis mundos, cientos de niveles y nuevas sorpresas.',
    'Télécharger': 'Descargar', 'Précommander': 'Reservar', 'Bientôt': 'Próximamente', 'sur l’App Store': 'en el App Store', 'Gratuit sur iPhone': 'Gratis en iPhone',
    'Démo : {n} niveaux. Ta progression reste dans ce navigateur.': 'Demo: {n} niveles. Tu progreso se queda en este navegador.',
    'Cadeau au niveau {n}': 'Regalo en el nivel {n}', 'Cadeau du niveau {n}': 'Regalo del nivel {n}', 'Bonus niveau difficile': 'Bonus por nivel difícil', 'Nouveauté': 'Novedad', 'Pub': 'Anuncio', 'OBTENIR': 'OBTENER', 'Récompense dans {s} s': 'Recompensa en {s} s', 'Fermer dans {s} s': 'Cerrar en {s} s', 'Fermer': 'Cerrar', 'Prochaine nouveauté': 'Próxima novedad', 'Prochaine aide': 'Próxima ayuda', 'Encore {n} niveaux': 'Faltan {n} niveles', 'Encore {n} niveau': 'Falta {n} nivel', 'Au prochain niveau !': '¡En el próximo nivel!',
  }, 'es');
  C.i18n({
    'JOUER': 'JOGAR', 'NIVEAU {n}': 'NÍVEL {n}', 'NIVEAUX': 'NÍVEIS', 'RÉGLAGES': 'AJUSTES', 'PAUSE': 'PAUSA', 'REPRENDRE': 'RETOMAR',
    'RECOMMENCER': 'REINICIAR', 'SUIVANT': 'PRÓXIMO', 'REJOUER': 'REPETIR', 'Son': 'Som', 'Musique': 'Música', 'Vibrations': 'Vibração',
    'NIVEAU {n} RÉUSSI !': 'NÍVEL {n} CONCLUÍDO!', 'Temps : {t}': 'Tempo: {t}', 'Record : {t}': 'Recorde: {t}', 'NOUVEAU RECORD !': 'NOVO RECORDE!',
    'Effacer la progression': 'Apagar o progresso', 'Effacer toute la progression ? Les étoiles et les niveaux débloqués seront perdus.': 'Apagar todo o progresso? As estrelas e os níveis desbloqueados serão perdidos.',
    'Retour': 'Voltar', 'Pause': 'Pausa', 'Niveau verrouillé': 'Nível bloqueado', 'Politique de confidentialité': 'Política de privacidade',
    'BOUTIQUE': 'LOJA', 'Pièces': 'Moedas', '×2 avec une pub': '×2 com um anúncio', 'CONTINUER ?': 'CONTINUAR?', 'CONTINUER': 'CONTINUAR', 'Continuer · {c}': 'Continuar · {c}',
    'Regarder une pub': 'Ver um anúncio', 'Non merci': 'Não, obrigado', 'Pas assez de pièces': 'Moedas insuficientes', 'Sans pubs': 'Sem anúncios', 'Acheté': 'Comprado',
    'Pièces gratuites (pub)': 'Moedas grátis (anúncio)', 'Restaurer les achats': 'Restaurar compras', 'Plus de pièces gratuites aujourd’hui': 'Sem mais moedas grátis hoje',
    'Plus de pubs entre les niveaux': 'Remove os anúncios entre os níveis', 'Statistiques anonymes': 'Estatísticas anônimas', 'Confidentialité des pubs': 'Privacidade dos anúncios', 'Achats restaurés': 'Compras restauradas', 'Aucun achat à restaurer': 'Nenhuma compra para restaurar',
    'DIFFICILE': 'DIFÍCIL', 'TRÈS DIFFICILE': 'MUITO DIFÍCIL', 'Zone {z}': 'Zona {z}', 'NOUVEAU !': 'NOVIDADE!', 'C’EST PARTI': 'VAMOS LÁ', 'niveau {n}': 'nível {n}',
    'NOUVELLE AIDE !': 'NOVA AJUDA!', 'Une offerte pour l’essayer': 'Uma grátis para experimentar', 'Acheter · {c}': 'Comprar · {c}', 'Symboles des couleurs': 'Símbolos das cores', 'Niv. {n}': 'Nív. {n}',
    'LA SUITE DANS L’APPLI': 'CONTINUA NO APP', 'BRAVO !': 'PARABÉNS!', 'Tu as fini la démo. Dans l’appli : six mondes, des centaines de niveaux et de nouvelles surprises.': 'Você terminou a demo. No app: seis mundos, centenas de níveis e novas surpresas.',
    'Télécharger': 'Baixar', 'Précommander': 'Pré-venda', 'Bientôt': 'Em breve', 'sur l’App Store': 'na App Store', 'Gratuit sur iPhone': 'Grátis no iPhone',
    'Démo : {n} niveaux. Ta progression reste dans ce navigateur.': 'Demo: {n} níveis. Seu progresso fica neste navegador.',
    'Cadeau au niveau {n}': 'Presente no nível {n}', 'Cadeau du niveau {n}': 'Presente do nível {n}', 'Bonus niveau difficile': 'Bônus de nível difícil', 'Nouveauté': 'Novidade', 'Pub': 'Anúncio', 'OBTENIR': 'OBTER', 'Récompense dans {s} s': 'Recompensa em {s} s', 'Fermer dans {s} s': 'Fechar em {s} s', 'Fermer': 'Fechar', 'Prochaine nouveauté': 'Próxima novidade', 'Prochaine aide': 'Próxima ajuda', 'Encore {n} niveaux': 'Faltam {n} níveis', 'Encore {n} niveau': 'Falta {n} nível', 'Au prochain niveau !': 'No próximo nível!',
  }, 'pt');
})(window.Core);
