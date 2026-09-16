# Changelog

Les changements notables du site sont consignés ici. Les versions suivent le principe de
[SemVer](https://semver.org/lang/fr/) et chaque version publiée correspond à un tag git
`vX.Y.Z`, qui déclenche le déploiement sur https://pleutpas.fr.

## [Non publié]

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
