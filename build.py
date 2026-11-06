"""Assemble index.html (un seul fichier) à partir de src/ et vendor/."""
import os
d=os.path.dirname(os.path.abspath(__file__))
r=lambda p:open(os.path.join(d,p),encoding='utf-8').read()
css=r('src/style.css')+r('src/civ.css')
html=f'''<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>R Toitures Solaire</title><meta name="theme-color" content="#1c1917">
<style>{r('vendor/leaflet.css')}</style><style>{css}</style></head><body>
{r('src/body.html')}
<script>{r('vendor/leaflet.js')}</script>
<script>{r('vendor/three.bundle.js')}</script>
<script>{r('src/sim.js')}
{r('src/lidar.js')}</script>
<script>{r('src/view3d.js')}</script>
<script>{r('src/app.js')}</script>
</body></html>'''
open(os.path.join(d,'index.html'),'w',encoding='utf-8').write(html)
print('index.html',len(html))
