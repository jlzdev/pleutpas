# Changelog

Les changements notables du site sont consignés ici. Les versions suivent le principe de
[SemVer](https://semver.org/lang/fr/) et chaque version publiée correspond à un tag git
`vX.Y.Z`, qui déclenche le déploiement sur https://pleutpas.fr.

## [Non publié]

## [1.14.2] - 2026-11-27

### Améliorations

- Sous le verdict, le risque de verglas s'écrit "Risque de verglas 70 %." sans la mention "(Météo-France)", la source étant déjà celle de toute la page.

## [1.14.1] - 2026-11-20

### Améliorations

- Réglages : un lieu choisi s'affiche en texte fixe dans sa case (nom en gras), un appui dessus rouvre la saisie avec le texte sélectionné, la croix retire l'arrivée ou vide le départ pour en saisir un autre.
- Réglages : "Ma position" est désormais la première suggestion du champ sur lequel on tape, départ ou arrivée, à la place de la puce qui ne s'appliquait qu'au départ.

### Corrections

- Réglages : après avoir vidé le champ Départ avec la croix, "Ma position" (ou le choix du même lieu) remplit de nouveau le champ.

## [1.14.0] - 2026-11-20

### Améliorations

- Trajets enregistrés : puce "Sauvegarder" à côté de "Ma position" dans les réglages, qui demande un nom et garde le trajet affiché (départ, arrivée, durée), six au plus ; la puce devient "Enregistré" quand le trajet affiché est déjà dans la liste et se cache tant qu'un champ de l'itinéraire est vide ; pour modifier un trajet, le retirer de "Mes trajets" et le sauvegarder à nouveau. Les trajets enregistrés se rappellent d'un appui dans une rangée de puces sous l'en-tête (sous les réglages quand ils sont ouverts), et les deux premiers sont dans le menu de l'icône de l'app (appui long sur Android, liens ?fav=1 et ?fav=2).
- Partager un trajet enregistré : icône de partage sur chaque ligne de "Mes trajets", qui ouvre le partage du téléphone (ou copie le lien) ; le lien ouvre Pleut pas ? directement sur le trajet.
- Réglages refaits sur le modèle d'un itinéraire : départ et arrivée empilés avec cercle, pointillés et épingle, bouton d'inversion à droite, puces "Ma position" et "Sauvegarder", durée du trajet, "Mes trajets" replié, affichage, "C'est bon". Les champs affichent le lieu en place et la croix de l'arrivée la retire en un appui.
- Thème clair affiné : champs de saisie blancs à bordure marquée, distincts des boutons, textes secondaires et titres plus foncés. Pictos de partage, lecture, pause et inversion en icônes vectorielles centrées.
- La note de nuit sous le verdict dit "Nuit à 17h34." au lieu de "Nuit à partir de 17h34."

### Retraits

- Le rappel dans l'agenda (fichier .ics) : pas utilisé, il prenait de la place dans les réglages.
- La vigilance Météo-France du département (neige-verglas depuis la 1.6.0) n'est plus affichée sous le verdict : le vent fort est déjà signalé dans la ligne des conditions, et la neige ou le verglas annoncés restent indiqués.

## [1.13.0] - 2026-11-20

### Améliorations

- Thème clair, lisible en plein soleil : réglage "Affichage" Auto / Clair / Sombre dans les réglages (Auto suit le réglage du téléphone), couleurs de l'interface en variables partagées, barre d'état du téléphone assortie (iPhone compris en PWA), pas de flash au chargement. Audit d'accessibilité axe sans violation dans les deux thèmes, contrastes recalculés (bleu d'accent plus foncé en clair).
- Réglages : la phrase sous le titre est retirée, le bouton "C'est bon" suffit.
- Nouvelle version : quand une mise à jour du site est prête, un bandeau "Nouvelle version disponible" propose de recharger (ou "plus tard"), au lieu de laisser l'ancienne version en place jusqu'au prochain lancement ; vérification toutes les heures quand l'app reste ouverte.

### Performances

- La carte (Leaflet) est chargée à part, après le verdict : le bundle principal passe de 96 à 51 Ko compressés, un emplacement de la même hauteur évite tout saut de page.
- Les appels Météo-France (pluie dans l'heure, prévision) et les manifests d'images partent dès le HTML, avant le chargement du code, pour le lieu mémorisé ou celui de l'adresse.
- Au retour au premier plan, seule la pluie dans l'heure est rechargée tant que la prévision a moins de 15 minutes et que rien ne manque (la prévision Météo-France change au plus tous les quarts d'heure) ; si la carte ne se charge pas, elle réessaie trois fois puis l'indique au lieu de rester sur "Chargement".

## [1.12.0] - 2026-11-20

### Améliorations

- Heure de départ au choix : "Départ maintenant" dans le pied du verdict ouvre le sélecteur d'heure du téléphone ; le verdict, la frise des deux heures et la suite de la journée se calent sur cette heure (aujourd'hui si elle est à venir, sinon demain), pour le retour du soir ou le départ de demain matin, avec une croix pour revenir à maintenant. Oubliée au prochain chargement.
- Cartouche du verdict allégé : température, vent, hiver, vigilance et nuit forment un seul paragraphe, l'heure de départ et la durée du trajet partagent la ligne du pied, qui ne répète plus l'heure des données (affichée sous les cartes).
- Réglages : plus de croix en haut (elle se lisait "annuler"), une phrase rappelle que chaque changement s'applique tout de suite et un bouton "C'est bon" ferme la carte.
- Nuit indiquée sous le verdict : "Nuit jusqu'à 7h45." quand il fait nuit au départ, "Nuit à partir de 17h34." quand elle tombe pendant le trajet ou dans l'heure qui suit (lever et coucher du soleil calculés sur l'appareil, sans appel réseau).
- Accessibilité : curseur de la carte libellé et lu avec son instant, boutons de zoom en français, liens du pied de page agrandis à 24 px, frise des deux heures décrite aux lecteurs d'écran par sa phrase. Audit axe (WCAG 2.2 AA) sans violation sur l'accueil et la page principale.

### Corrections

- Quand la pluie commence au premier pas de "pluie dans l'heure" (au prochain multiple de 5 min après le départ), le verdict dit "en ce moment" au lieu de "prévue vers 8h05", en mode point comme en mode trajet, et la frise des deux heures le voit aussi.

### Développement

- Tests automatisés (vitest, `npm test`, lancés par la CI) sur la logique du verdict, de la frise, de la journée, de l'hiver, des formats d'heure et du soleil.

## [1.11.0] - 2026-11-20

### Corrections

- Plus de fond blanc avant l'application du style au chargement (fond sombre posé directement dans la page).
- Suite de la journée : le changement de jour n'est plus marqué par un trait vertical (pris pour un curseur) mais seulement par le nom du jour en gras sur l'axe, "demain" ou le jour de la semaine selon l'heure de consultation ; et quand le graphique commence déjà le lendemain (consultation après 22 h), le premier repère l'indique ("demain 1h").

### Améliorations

- Accueil (premier lancement) : présentation en trois points de ce que donne l'app (verdict, deux prochaines heures, carte animée), bouton de géolocalisation mis en avant, exemples de villes à essayer d'un appui (Paris, Strasbourg, Grenoble, Nantes, Bordeaux) et rappel que le lieu reste sur l'appareil.

## [1.10.0] - 2026-11-14

### Corrections

- Au chargement d'un trajet, les repères de départ et d'arrivée n'apparaissent plus brièvement agrandis : le recadrage de la carte se fait sans animation de zoom.

### Améliorations

- Choix d'un lieu directement sur la carte : bouton épingle à droite de la carte (bleu quand le mode est actif), carte centrée sur le départ (ou laissée où tu l'as déplacée), épingle fixe au centre, adresse visée affichée en direct, boutons "Partir d'ici", "Arriver ici" (durée du trajet calée sur la distance) et "Retirer l'arrivée, garder le départ" quand un trajet est en place ; les boutons restent actifs pendant la recherche de l'adresse et se grisent quand l'épingle est déjà sur le lieu, le radar reste visible pendant le choix.
- Bouton de géolocalisation sur la carte, sous l'épingle : centre la carte sur ta position (point vert), en mode visée l'adresse sous l'épingle se met à jour.
- Le fond de carte vélo (CyclOSM) et son bouton de choix sont retirés, la carte garde le plan OpenStreetMap.

## [1.9.0] - 2026-11-14

### Améliorations

- La suite de la journée devient un ruban de 24 cases horaires, de la même facture que la
  frise des 2 heures, lisible sans infobulle : case colorée = pluie prévue (couleur =
  intensité maximale de l'heure, comme sur la frise), case hachurée de cette couleur = pluie
  prévue mais incertaine (risque sous 70 %), case hachurée de bleu = averse possible (risque
  d'au moins 40 %) avec une étiquette "averses possibles (40 %)", case grise = heure sèche ; trait et repère "demain" à minuit, repères toutes les
  3 heures, ruban réduit à un filet les jours secs. Une heure sous le seuil de pluie du
  verdict n'est jamais colorée (plus de petites barres "traces" sous une phrase "pas de
  pluie"). La phrase de synthèse gagne deux cas : "Averses possibles entre 21h et 3h, sans
  cumul notable." et, quand le graphique est sec, la prochaine pluie connue au-delà ("Pas de
  pluie prévue d'ici demain 18h, prochaine pluie vers demain 20h."), cohérente avec le "Sec
  jusqu'à" du verdict. Le nombre et son unité ne se séparent plus en fin de ligne.
- Les réglages s'ouvrent juste sous l'en-tête, au-dessus du verdict, sous le bouton qu'on vient
  de toucher.
- "Comment ça marche" est replié par défaut.

## [1.8.0] - 2026-11-14

### Améliorations

- Suite de la journée : le fond bleu de probabilité (Météo-France, par tranche de 3 h et
  par paliers de 10 %) est plafonné à 60 % de la hauteur pour ne plus écraser les barres de
  pluie quand il vaut 100 %, et la légende indique la source et le pas (Météo-France par
  tranche de 3 h, Open-Meteo par heure). Infobulles réécrites en clair, sur la journée ("17h à
  18h : 5,7 mm de pluie, probabilité 100 %") comme sur la frise ("15h20 à 15h25 : pluie
  légère, 0,3 mm par quart d'heure").

### Corrections

- Neige et risque de verglas étaient lus une heure (et 3 h pour le risque) trop tard : la
  prévision Météo-France horodate la fin de chaque période, comme pour la pluie.
- La vigilance de demain est demandée toute la journée (elle est servie dès le bulletin du
  matin) et, quand elle est plus sévère que celle du jour, la phrase donne les deux
  ("Vigilance jaune neige-verglas, orange demain.").
- Avec une arrivée, l'info hiver retient le lieu le plus exposé même à type égal (risque
  plus fort, ou neige en cours plutôt qu'annoncée).
- Une erreur passagère de Météo-France ne fait plus disparaître l'info hiver ni la
  vigilance, la valeur précédente est conservée jusqu'au rafraîchissement suivant.
- Une heure sans cumul dans la prévision Météo-France est sautée au lieu d'interrompre la
  série.
- Hors de France, Open-Meteo est lancé en parallèle de Météo-France dès le second
  chargement, le verdict n'attend plus deux appels successifs.
- Une arrivée mémorisée n'est plus ressuscitée quand le lieu de départ mémorisé est
  illisible.
- Une géolocalisation en cours est annulée dès qu'on choisit un lieu à la main, son résultat
  tardif n'écrase plus le choix.
- L'infobulle de la suite de la journée dit "pas de pluie" avec le même critère que
  l'étiquette en gras et la phrase de synthèse.

### Nouveautés

- Plus de lieu par défaut : au premier lancement (ou si le lieu mémorisé est illisible), une
  carte d'accueil propose d'utiliser sa position ou de chercher sa ville ou son adresse, et
  rien ne se charge tant qu'un lieu n'est pas choisi. Besançon disparaît du code. Les liens
  partagés avec coordonnées continuent de poser le lieu directement.

## [1.7.0] - 2026-11-14

### Données

- Au-delà de l'heure couverte par "pluie dans l'heure", la prévision vient maintenant de
  Météo-France (prévision de l'application mobile, la même que pour la neige et le verglas)
  en France : verdict, frise, suite de la journée, température, ressenti et vent. Open-Meteo
  reste la source hors de France et prend le relais sans rien dire si Météo-France ne répond
  pas ou répond tronqué. Jusqu'ici Open-Meteo servait en France les données du modèle
  allemand ICON.
- Ce qui change à l'écran : au-delà de la première heure, la frise et le verdict sont au pas
  horaire (couleur uniforme sur l'heure, les heures annoncées tombent sur des heures rondes),
  la probabilité de pluie de la suite de la journée est donnée par tranches de 3 h, "Sec
  jusqu'à" est à 3 h près au-delà d'environ 36 h, la ligne température / vent change une fois
  par heure et le vent est arrondi au m/s par Météo-France.
- Le cache hors réseau est renouvelé : la première visite après la mise à jour demande une
  connexion.

### Améliorations

- Pied de page : Météo-France en tête, adresse de contact rétablie, Open-Meteo en dernier
  avec la mention "repli".
- L'en-tête est aligné sur la largeur des cartes sur grand écran (il dépassait de 14 px de
  chaque côté).
- Réglages : le rappel agenda, facultatif, est replié par défaut derrière une ligne "Rappel
  dans mon agenda" à déplier.

## [1.6.0] - 2026-11-14

### Nouveautés

- Le sous-titre du OUI devient "Ça roule" au lieu de "Prends ton vélo" : l'app sert aussi à
  pied, en randonnée ou en trottinette.
- Sous le verdict, sur une ligne à part sous la température et le vent, deux informations
  hiver en texte seul, affichées seulement quand il y a quelque chose à dire et sans effet sur le verdict OUI /
  PLUIE : la vigilance neige-verglas Météo-France du département (jaune, orange ou rouge, et
  "demain" à partir de 16 h quand elle ne vaut que pour le lendemain), et la neige, la pluie
  verglaçante ou le risque de verglas annoncés par la prévision Météo-France pour les deux
  prochaines heures ("Neige vers 8h.", "Risque de verglas 45 % (Météo-France)."). Avec une
  arrivée, départ et arrivée sont lus et la phrase précise le lieu.

## [1.5.1] - 2026-10-11

### Améliorations

- La durée du trajet se cale d'elle-même sur l'estimation à 15 km/h quand on choisit une
  arrivée (modifiable ensuite), le curseur monte à 120 min avec ou sans arrivée, et l'aide
  prévient en ambre quand le trajet dépasse 2 h : la lecture sur le parcours suppose alors
  qu'on le fait en 2 h, il faut se fier surtout au départ et à l'arrivée.

## [1.5.0] - 2026-10-11

### Données

- Cartes de pluie à la résolution native de Météo-France (grille de 1 km, 1551 x 1051
  points) au lieu d'une grille réduite de moitié où trois points sur quatre étaient jetés :
  les petites averses d'un kilomètre ne disparaissent plus de la carte ni du verdict. Les
  images passent en palette indexée et pèsent 12 Ko en moyenne au lieu de 19 à 53, un run
  complet passe de 2,9 Mo à environ 1 Mo.
- La carte garde 1 h de pluie passée au lieu de 2 (12 images de moins par run), la légende
  du lecteur donne l'heure réelle de la première image.

### Nouveautés

- Arrivée facultative dans les réglages (recherche de ville ou d'adresse, "Inverser le
  sens", croix pour la retirer). La pluie est alors lue tout le long du trajet, en ligne
  droite, à l'heure où l'on passe à chaque endroit : Météo-France "pluie dans l'heure" aux deux bouts, images
  PIAF et AROME entre les deux, Open-Meteo en dernier recours. Le verdict précise où la
  pluie tombe ("au départ", "en route", "à l'arrivée"), la carte trace le trajet et cadre
  les deux villes, la timeline devient "Si tu pars dans les 2 prochaines heures" (une case
  = un départ, couleur = la pluie la plus forte sur le trajet, même calcul que le prochain
  départ au sec), le vent est donné "de face", "de dos" ou "de travers", la durée peut
  monter à 120 min, l'URL (`alat`, `alon`, `anom`) et le rappel agenda portent l'arrivée.
  Sans arrivée, rien ne change.
- Recherche de lieu à la frappe (dès 3 lettres, 300 ms après la dernière touche, Entrée
  choisit le premier résultat, Échap ferme la liste), classée par proximité du lieu courant,
  étendue aux rues, lieux-dits et numéros ("rue de Vesoul Besançon", "3 rue de Vesoul"),
  proposés après les communes, avec une icône ville ou épingle devant chaque résultat. Utile pour un trajet de plus de 5 km dans une
  même grande ville. Le bouton "Chercher" disparaît, la géolocalisation devient une icône
  à droite du champ Départ, et une croix dans le champ efface la saisie (ou retire
  l'arrivée quand rien n'est tapé).
- La carte zoome jusqu'au niveau 14 (12 avant) et cadre le trajet A-B jusqu'au niveau 13.
- La géolocalisation nomme le lieu par la rue la plus proche ("Rue battant, Besançon") quand
  il y en a une à moins de 200 m, sinon par la commune comme avant. L'adresse ne s'affiche
  que dans les réglages : l'en-tête, le titre, le verdict et le rappel agenda donnent la
  commune, ou les rues quand le trajet reste dans une même commune.
- Sur la carte, deux flèches sur le trait indiquent le sens du trajet, et un bouton ⇄ dans
  l'en-tête inverse le sens en un geste (le matin dans un sens, le soir dans l'autre).
- Une croix en haut de la carte Réglages la referme sans remonter au bouton ⚙.
- La mention "vélo boulot" disparaît de l'en-tête, l'app sert aussi hors trajet domicile-travail.

### Améliorations

- Avec une arrivée, le verdict s'affiche dès que les images autour de l'heure de départ sont
  lues, le reste de l'animation se charge en arrière-plan ; la lecture des images ne dessine
  plus que la zone du trajet (9 fois plus rapide, mesuré 175 ms au lieu de 1,5 s pour 44
  images sur ordinateur).
- Open-Meteo est interrogé en un seul appel pour les deux lieux.
- Animation de la carte plus légère : le fondu entre deux images est redessiné au plus 30
  fois par seconde, et coupé sur les appareils à 4 cœurs ou moins.
- Verdict "Données incomplètes" quand la prévision manque sur une partie du trajet, au
  lieu d'une fausse pluie.

## [1.4.1] - 2026-10-10

### Améliorations

- Cartouche du verdict densifié sur téléphone (interlignes réduits entre le sous-titre,
  la ligne température et vent et la ligne "Trajet de ...").
- "Comment ça marche" ne décrit plus la température et le vent.

## [1.4.0] - 2026-10-10

### Nouveautés

- Température, ressenti et vent du moment sur une ligne sous le verdict : "8 °C, ressenti
  5 °C. Vent d'ouest 20 km/h, rafales 45." Le ressenti n'apparaît que s'il s'écarte de la
  température, les rafales que si elles comptent, et "Vent fort" est mis en évidence à
  partir de 50 km/h de rafales. Le verdict reste décidé par la pluie seule. Mêmes données
  Open-Meteo que la pluie, aucun appel en plus.

### Améliorations

- Cartouche du verdict plus compact : OUI / PLUIE un peu plus petit, et la phrase "Pas de
  pluie prévue jusqu'à ... (fin des prévisions)" disparaît, elle n'apportait rien.
- Sous-titres sans conseil vestimentaire : "En ce moment" / "Prévue vers 8h10" sous PLUIE
  (fini le "sors le poncho"), "Pluie faible en ce moment" / "Bruine prévue vers 8h10" sous
  le OUI orange (fini le "sors la veste").
- Le bouton Actualiser n'apparaît plus sur téléphone (tirer l'écran vers le bas recharge
  la page), il reste sur ordinateur.
- "Comment ça marche" précise que le vent est celui mesuré à 10 m en terrain dégagé, plus
  faible en ville.

## [1.3.1] - 2026-10-10

### Améliorations

- Référencement : sitemap.xml (déclaré dans robots.txt), titre et balise Open Graph plus
  parlants ("Pleut pas ? Je peux rouler à vélo ?"), description structurée JSON-LD
  (WebApplication) et texte de présentation visible sans JavaScript, remplacé par
  l'application au chargement.
- Carte "Comment ça marche" en bas de page, avant les crédits.
- Crédits réduits à une ligne de liens (sources et licences, le détail reste dans le
  README), adresse de contact retirée.
- Les heures sont affichées dans le fuseau du lieu consulté (fourni par Open-Meteo) et non
  plus dans celui de l'appareil : quelqu'un au Québec qui regarde Besançon lit désormais les
  heures de Besançon, avec la mention "heure de Besançon" sous les données. Rien ne change
  quand on consulte le lieu où l'on se trouve. Le rappel agenda reste à l'heure de l'appareil.

## [1.3.0] - 2026-10-10

### Améliorations

- Le verdict "NON" sur fond rouge devient "PLUIE" sur fond bleu : la pluie est une
  information, pas une interdiction de rouler. Même grammaire que le OUI orange : "En ce
  moment, sors le poncho" ou "Prévue vers 8h10, sors le poncho", puis "Sinon, prochain
  départ au sec : 8h40".
- Sur la carte, le bouton de choix du fond (Plan / Vélo) a la même taille que les boutons
  de zoom.

## [1.2.0] - 2026-10-02

### Fonctionnalités

- Bandeau d'installation : à la première visite hors application installée, le site propose
  de l'ajouter à l'écran d'accueil (bouton "Installer" sur Android, consigne Partager puis
  "Sur l'écran d'accueil" sur iPhone). Fermable, ne revient pas une fois fermé.
- Recherche de lieu dans les pays voisins couverts par les grilles Météo-France (Belgique,
  Luxembourg, Suisse, Allemagne du sud-ouest, nord de l'Italie, Catalogne, sud de
  l'Angleterre), avec le pays entre parenthèses. La géolocalisation hors de France nomme
  désormais la commune au lieu de "Ma position".
- Rappel avant le départ : dans les réglages, une heure de départ et un bouton "Ajouter à mon
  agenda" génèrent un fichier .ics (du lundi au vendredi, 15 min avant, lien vers la météo
  du lieu). Sans serveur, c'est l'agenda du téléphone qui notifie.

### Améliorations

- Le bouton "Chercher" affiche un anneau qui tourne pendant la recherche de lieu (deux
  services interrogés, le "Recherche..." sous le champ passait inaperçu).
- Recherche de lieu tolérante aux lenteurs : 6 s au plus par service, et 1,5 s de grâce pour
  le second dès que le premier a répondu. Si la Base Adresse Nationale ne répond pas à
  temps, les communes françaises viennent de Photon (avec leur département).
- Dans les résultats, les communes dont le nom correspond exactement à la recherche passent
  en tête ("Gand" en Belgique avant Gandrange, Gandelu...).

## [1.1.0] - 2026-09-16

### Fonctionnalités

- Verdict nuancé : la bruine ou la pluie faible seule sur le trajet donne un OUI orange
  "sors la veste" avec l'heure du prochain départ au sec, le NON est réservé à la vraie
  pluie (à partir de 0,75 mm / 15 min, niveau "modérée" de Météo-France).
- Fond de carte vélo CyclOSM en option (sélecteur de calques sur la carte, choix mémorisé),
  en plus du plan OpenStreetMap.

### Améliorations

- Recherche de lieu via le géocodage de la Géoplateforme (Base Adresse Nationale) : communes
  françaises avec le département entre parenthèses, à la place des régions Open-Meteo.
  La commune après géolocalisation vient de geo.api.gouv.fr (fiable en pleine campagne).
- Animation de la carte plus rapide (150 ms par image) et sans scintillement : les images
  sont décodées avant d'être affichées, dessinées sur un seul canvas, et s'enchaînent en
  fondu.

## [1.0.0] - 2026-08-29

Première version publiée.

### Fonctionnalités

- Verdict OUI / NON "je peux rouler" sur la durée du trajet (réglable), avec l'heure de la
  prochaine fenêtre sèche sinon.
- Les 2 prochaines heures en cases de 5 minutes, fusion Météo-France "pluie dans l'heure"
  et Open-Meteo, cohérente par construction avec le verdict.
- Carte animée : 2 heures de pluie observée (lame d'eau PIAF) puis prévision PIAF et
  AROME-PI jusqu'à environ 6 heures, bornée à la France métropolitaine.
- La suite de la journée : cumuls horaires sur 24 heures dans le prolongement de la timeline.
- Lieu configurable par recherche de ville, géolocalisation ou URL (`?lat=&lon=&nom=`),
  PWA installable, données mises en cache localement.

### Fiabilité et sécurité

- Les indisponibilités passagères de l'API Météo-France ne font plus échouer les workflows
  de données tant que les frames déjà publiées restent fraîches ; un échec n'est signalé
  que si la panne dure.
- Actions GitHub épinglées par SHA de commit complet, dépendances des workflows installées
  depuis le lockfile (`npm ci`), credentials git non persistés dans les checkouts.
- Déploiement du site uniquement sur tag de version, plus à chaque push sur main.
