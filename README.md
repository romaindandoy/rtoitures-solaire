# R Toitures Photovoltaïque

Outil d'étude photovoltaïque pour couvreur : adresse → versants du toit (LiDAR Wallonie, photos aériennes SPW 2026, 3D photo Google en option) → panneaux → consommation → étude heure par heure sur 5 ans de météo réelle → devis signé.

**Ouvrir l'outil** : voir l'adresse GitHub Pages du dépôt (Settings → Pages).

## Confidentialité
- Le dépôt et le site sont **publics** : ils ne contiennent **aucune donnée** (ni clients, ni études, ni coordonnées d'entreprise, ni clés).
- Les études, les prix et les coordonnées de l'entreprise restent dans le navigateur de chaque appareil.
- La synchro PC ↔ téléphone passe par un gist privé, **chiffré sur l'appareil** (AES-256, mot de passe connu seulement de l'utilisateur) : GitHub ne peut pas lire son contenu.
- La clé Google et la clé GitHub restent dans le navigateur de l'appareil.
- Ne jamais mettre de nom de client, de clé ou de mot de passe dans les issues ou les commits.

## Développer
- Le code est dans `src/` : `app.js` (interface), `sim.js` (calculs solaires et financiers), `lidar.js` (relevé LiDAR, détection des versants), `view3d.js` (vue 3D).
- `python3 build.py` assemble tout dans `index.html` (un seul fichier, fonctionne aussi hors ligne en partie).
- À chaque `push` sur `main`, GitHub Actions vérifie le code, contrôle qu'aucune donnée sensible n'est dans le site, puis publie sur GitHub Pages.
- Idées et problèmes : onglet **Issues** (modèles « Idée » et « Problème »).

## Sources de données
LiDAR MNS/MNT 2021-2022 et orthophotos © SPW (geoservices.wallonie.be) · météo Open-Meteo (ERA5) · géocodage OpenStreetMap Nominatim · 3D photo Google Map Tiles API (clé personnelle) · three.js, Leaflet, 3d-tiles-renderer.
