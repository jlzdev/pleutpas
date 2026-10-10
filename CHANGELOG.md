# Changelog

Les changements notables du site sont consignés ici. Les versions suivent le principe de
[SemVer](https://semver.org/lang/fr/) et chaque version publiée correspond à un tag git
`vX.Y.Z`, qui déclenche le déploiement sur https://pleutpas.fr.

## [Non publié]

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
