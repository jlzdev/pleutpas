# Pleut pas ?

Est-ce que je peux prendre mon vélo maintenant, et sinon à quelle heure ? Gros verdict
OUI / NON selon la pluie sur la durée du trajet, prévision fine sur les 2 prochaines
heures, carte animée (pluie observée puis prévue) et vue de la suite de la journée.
Lieu configurable (recherche de ville, géolocalisation ou URL), Besançon par défaut,
zone couverte : France métropolitaine.

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

Le nom du lieu après géolocalisation vient du géocodage inverse BigDataCloud.

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
(Licence Ouverte), géocodage inverse [BigDataCloud](https://www.bigdatacloud.com/).
