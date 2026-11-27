# Pleut pas ?

Est-ce que je peux prendre mon vélo maintenant, et sinon à quelle heure ? Gros verdict
OUI / BRUINE / PLUIE selon la pluie sur la durée du trajet, prévision fine sur les 2 prochaines
heures, carte animée (pluie observée puis prévue) et vue de la suite de la journée,
pour un départ maintenant ou à l'heure de son choix (retour du soir, lendemain matin) ;
nuit au départ ou pendant le trajet indiquée sous le verdict (lever et coucher calculés localement),
thème sombre ou clair (lisible en plein soleil), automatique ou au choix,
lieux et trajets favoris (étoile à côté du lieu) rappelés d'un appui (et depuis le menu de l'icône sur Android), partage d'un lieu ou d'un trajet par lien, rappel facultatif dans l'agenda (fichier .ics, sans serveur).
Lieu choisi au premier lancement (géolocalisation, recherche de ville ou d'adresse, épingle posée sur la carte, ou URL), mémorisé sur l'appareil,
arrivée facultative (la pluie est alors lue tout le long du trajet, en ligne droite, à
l'heure où l'on passe à chaque endroit, et le vent devient "de face", "de dos" ou "de
travers"),
zone couverte : France métropolitaine et pays voisins jusqu'aux bords des grilles Météo-France
(Belgique, Luxembourg, Suisse, sud-ouest de l'Allemagne, nord de l'Italie, Catalogne, sud de
l'Angleterre). Hors de France, la source "pluie dans l'heure" est muette et le verdict repose
sur PIAF et Open-Meteo.

Site 100 % statique, en ligne sur https://pleutpas.fr

## Données

Trois familles de sources, par ordre d'autorité sur le verdict :

1. Météo-France "pluie dans l'heure" fait foi sur le moment présent (pas de 5 min sur
   environ 1 h).
2. PIAF (portail API Météo-France) : lame d'eau qui fusionne extrapolation radar et
   modèle, nouveau run toutes les 5 min. Elle alimente la carte (1 h de passé et la
   prévision jusqu'à +3 h) et sert de repli au verdict quand la source 1 est muette.
   AROME-PI (pas de 15 min) prend le relais sur la carte au-delà, jusqu'à environ +6 h.
3. Prévision Météo-France (endpoint de l'application mobile, comme la pluie dans l'heure,
   pas horaire sur environ 36 h puis 3 h) : au-delà de l'heure couverte par la source 1,
   pour la suite de la journée, et pour la température, le ressenti, le vent et la
   probabilité de pluie par tranche de 3 h. Open-Meteo (minutely_15 et hourly, pas de
   15 min) reste la source hors de France et le repli silencieux si Météo-France ne répond
   pas ; les composants lisent une prévision point unifiée sans connaître la source.

À titre d'information, sans effet sur le verdict : la neige, la pluie verglaçante ou le
risque de verglas des deux prochaines heures, lus sur la prévision Météo-France (endpoint de
l'application mobile, comme la pluie dans l'heure, France seulement).

Avec une arrivée, le trajet est une ligne droite échantillonnée dans l'espace et le temps
(25 positions, une image par instant de passage) : Météo-France "pluie dans l'heure" aux deux
extrémités, images PIAF puis AROME-PI entre les deux, Open-Meteo de l'extrémité la plus proche
en dernier recours. Pas de calcul d'itinéraire : les images servies ont des pixels d'environ
1,5 x 2,2 km et sont lues sur une fenêtre de 3 x 3 pixels, un vrai itinéraire urbain s'écarte
de la ligne droite de moins que ça.

La recherche de lieu interroge le géocodage de la Géoplateforme (Base Adresse Nationale,
communes puis rues et numéros, département affiché entre parenthèses, résultats classés par
proximité du lieu courant) et, pour les pays voisins,
Photon (komoot, données OpenStreetMap, pays affiché entre parenthèses) ; après
géolocalisation ou choix à l'épingle sur la carte, l'adresse vient du géocodage inverse de
la Géoplateforme, la commune de l'API Découpage administratif (geo.api.gouv.fr), puis
de Photon hors de France.

Le site est une PWA installable (bandeau "Ajoute Pleut pas ? à ton écran d'accueil" à la
première visite), sans serveur ni notification push.

## Architecture

- Front : Vue 3, TypeScript, Vite, Tailwind CSS 4, Leaflet, PWA via vite-plugin-pwa.
  Aucune clé ni secret côté front.
- Pipelines de données : deux workflows GitHub Actions ([piaf.yml](.github/workflows/piaf.yml),
  [data.yml](.github/workflows/data.yml)) téléchargent les grilles WCS Météo-France,
  les colorisent en PNG (palette partagée [src/lib/palette.json](src/lib/palette.json),
  la même que la timeline) et publient frames et manifest sur les branches orphelines
  `piaf` et `data`, servies au front par raw.githubusercontent.com. La clé du portail
  API Météo-France (gratuite) est stockée en secret de repo `MF_API_KEY`.

## Développement

```bash
npm install
npm run dev
```

`npm run build` inclut le typecheck (vue-tsc). `npm test` lance les tests vitest de la
logique métier (`src/lib/meteo.test.ts`, `src/lib/sun.test.ts`), exécutés aussi par la CI.
Pour générer les frames en local,
mettre la clé dans `.env.local` (`MF_API_KEY=...`, fichier non versionné) puis
`npm run piaf` ou `npm run data`.

## Versions

Le site est déployé sur GitHub Pages à chaque tag `vX.Y.Z` (workflow
[deploy.yml](.github/workflows/deploy.yml)). L'historique est tenu dans
[CHANGELOG.md](CHANGELOG.md), la version courante est affichée dans le pied de page.

## Attributions

Prévisions [Open-Meteo](https://open-meteo.com/) (CC-BY 4.0), pluie dans l'heure,
lame d'eau et prévisions PIAF / AROME-PI [Météo-France](https://meteofrance.com/)
(Licence Ouverte), lieux [Base Adresse Nationale](https://adresse.data.gouv.fr/) et
[API Découpage administratif](https://geo.api.gouv.fr/decoupage-administratif) (Licence
Ouverte), hors de France [Photon](https://photon.komoot.io/) (données OpenStreetMap, ODbL),
fond de carte [OpenStreetMap](https://www.openstreetmap.org/).
