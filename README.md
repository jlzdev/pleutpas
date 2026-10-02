# Pleut pas ?

Est-ce que je peux prendre mon vélo maintenant, et sinon à quelle heure ? Gros verdict
OUI / NON selon la pluie sur la durée du trajet, prévision fine sur les 2 prochaines
heures, carte animée (pluie observée puis prévue) et vue de la suite de la journée.
Lieu configurable (recherche de ville, géolocalisation ou URL), Besançon par défaut,
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
   modèle, nouveau run toutes les 5 min. Elle alimente la carte (2 h de passé et la
   prévision jusqu'à +3 h) et sert de repli au verdict quand la source 1 est muette.
   AROME-PI (pas de 15 min) prend le relais sur la carte au-delà, jusqu'à environ +6 h.
3. Open-Meteo (minutely_15 et hourly) : au-delà de l'heure couverte par Météo-France,
   et pour la suite de la journée.

La recherche de lieu interroge le géocodage de la Géoplateforme (Base Adresse Nationale,
communes seulement, département affiché entre parenthèses) et, pour les pays voisins,
Photon (komoot, données OpenStreetMap, pays affiché entre parenthèses) ; après
géolocalisation, la commune vient de l'API Découpage administratif (geo.api.gouv.fr), puis
de Photon hors de France.

Le site est une PWA installable (bandeau "Ajoute Pleut pas ? à ton écran d'accueil" à la
première visite) et propose un rappel quotidien sous forme de fichier .ics à ajouter à son
agenda, sans serveur ni notification push.

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

`npm run build` inclut le typecheck (vue-tsc). Pour générer les frames en local,
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
fonds de carte [OpenStreetMap](https://www.openstreetmap.org/) et
[CyclOSM](https://www.cyclosm.org/).
