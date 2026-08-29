# Changelog

Les changements notables du site sont consignés ici. Les versions suivent le principe de
[SemVer](https://semver.org/lang/fr/) et chaque version publiée correspond à un tag git
`vX.Y.Z`, qui déclenche le déploiement sur https://pleutpas.fr.

## [Non publié]

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
