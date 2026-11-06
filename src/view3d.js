/* ===== Vue 3D : maquette LiDAR + orthophoto 2026 + versants + panneaux + ombres, dessin et modification sur la maquette ===== */
var View3D=(function(){
 var st=null;
 function inPoly(pt,pts){var c=false;for(var i=0,j=pts.length-1;i<pts.length;j=i++){var a=pts[i],b=pts[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
 function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
 function merc(lat,lon){var R=6378137;return [lon*RAD*R,Math.log(Math.tan(Math.PI/4+lat*RAD/2))*R];}
 function loadTex(H,G,half,px){var o=H.o,c=[G.x0+half,G.y0+half],sw=H.toLL([c[0]-half,c[1]-half],o),ne=H.toLL([c[0]+half,c[1]+half],o),a=merc(sw[0],sw[1]),b=merc(ne[0],ne[1]);
  var u=GEO+'IMAGERIE/ORTHO_2026_PRINTEMPS/MapServer/export?bbox='+[a[0],a[1],b[0],b[1]].join(',')+'&bboxSR=3857&imageSR=3857&size='+(px||2048)+','+(px||2048)+'&format=jpg&f=image';
  return fetch(u).then(function(r){if(!r.ok)throw 0;return r.blob();}).then(function(bl){if(!/image/.test(bl.type))throw 0;return createImageBitmap(bl,{imageOrientation:'flipY'});}).then(function(im){var t=new THREE.Texture(im);t.flipY=false;t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}).catch(function(){return null;});}
 function open(H){
  close();
  var ov=el('<div id="v3d" style="position:fixed;inset:0;z-index:2600;background:#0b0f19;color:#fff;font:14px system-ui"><canvas style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>'+
   '<div style="position:absolute;left:8px;right:8px;top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button data-v="close" class="btn sm">✕ Fermer</button><select data-v="date" style="padding:7px;border-radius:9px;border:0;font:inherit"><option value="5-21">21 juin</option><option value="2-20">21 mars</option><option value="11-21">21 décembre</option><option value="now">Aujourd’hui</option></select>'+
   '<label style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.5);padding:4px 8px;border-radius:9px">🕑 <input data-v="hour" type="range" min="5" max="22" step="0.25" value="13" style="width:110px"><b data-v="hl">13:00</b></label><button data-v="play" class="btn s sm">▶ Journée</button><button data-v="top" class="btn s sm">⤓ Dessus</button><button data-v="google" class="btn s sm">📷 3D Google</button></div>'+
   '<div data-v="attr" style="position:absolute;right:8px;bottom:50px;font:10px system-ui;color:#fff;text-shadow:0 0 3px #000;max-width:70%;text-align:right;pointer-events:none"></div>'+
   '<div data-v="tools" style="position:absolute;left:8px;right:8px;bottom:64px;display:flex;gap:6px;flex-wrap:wrap"></div>'+
   '<div data-v="info" style="position:absolute;left:8px;bottom:10px;right:8px;background:rgba(0,0,0,.6);border-radius:10px;padding:7px 10px;font-size:13px">Chargement du relevé LiDAR…</div></div>');
  document.body.appendChild(ov);var cv=ov.querySelector('canvas'),info=ov.querySelector('[data-v=info]');
  var R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
  var S=new THREE.Scene();S.background=new THREE.Color(0xbfd7ee);S.fog=new THREE.Fog(0xbfd7ee,120,420);
  var cam=new THREE.PerspectiveCamera(45,1,0.3,3000);
  var ctl=new OrbitControls(cam,cv);ctl.enableDamping=true;ctl.maxPolarAngle=Math.PI*0.49;
  S.add(new THREE.HemisphereLight(0xdfeeff,0x6b5b45,1.1));
  var sun=new THREE.DirectionalLight(0xfff4dd,2.2);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);var sc=sun.shadow.camera;sc.left=-34;sc.right=34;sc.top=34;sc.bottom=-34;sc.near=1;sc.far=400;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;S.add(sun);S.add(sun.target);
  st={ov:ov,R:R,S:S,cam:cam,ctl:ctl,sun:sun,H:H,raf:0,panelPts:[],terrain:null,play:null,solids:[],dyn:null,mode:'view',draw:[],sel:null,selV:null,google:false,tiles:null,dz:0};
  function resize(){var w=ov.clientWidth,h=ov.clientHeight;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  window.addEventListener('resize',resize);st.resize=resize;resize();
  (function loop(){st.raf=requestAnimationFrame(loop);ctl.update();if(st.tiles&&st.google){cam.updateMatrixWorld();st.tiles.update();}R.render(S,cam);})();
  ov.addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b)return;var v=b.dataset.v;
   if(v==='close')close();else if(v==='top'){var t=ctl.target;cam.position.set(t.x,t.y+60,t.z+0.01);}
   else if(v==='play'){if(st.play){clearInterval(st.play);st.play=null;b.textContent='▶ Journée';return;}b.textContent='⏸ Pause';var hr=ov.querySelector('[data-v=hour]');st.play=setInterval(function(){var x=+hr.value+0.25;if(x>21)x=5.5;hr.value=x;updSun();},180);}
   else if(ACT3[v])ACT3[v]();});
  ov.querySelector('[data-v=hour]').addEventListener('input',updSun);ov.querySelector('[data-v=date]').addEventListener('change',updSun);
  // toucher court = pointer un endroit (pas une rotation)
  var down=null;cv.addEventListener('pointerdown',function(e){down={x:e.clientX,y:e.clientY,t:Date.now(),n:e.isPrimary};});
  cv.addEventListener('pointerup',function(e){if(!down)return;var d=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=Date.now()-down.t;down=null;if(d<8&&dt<500)tap(e.clientX,e.clientY);});
  var half=30,c=H.center();
  H.getGrid(c[0],c[1],half,0.5,function(f){info.textContent='Chargement du relevé LiDAR… '+Math.round(f*100)+' %';}).then(function(G){
   if(!G||G.z.filter(function(v){return v!=null;}).length<100){info.textContent='Relevé LiDAR inaccessible (internet ?). La vue 3D a besoin du LiDAR wallon.';return;}
   info.textContent='Chargement de la photo aérienne 2026…';
   return loadTex(H,G,half).then(function(tex){st.G=G;st.tex=tex;st.half=half;base(G,tex);rebuild(true);});});
 }
 /* décor fixe : grande photo de contexte, lumières */
 function base(G,tex){var n=G.n,zmin=1e9;G.z.forEach(function(v){if(v!=null&&v<zmin)zmin=v;});st.zmin=zmin;
  var cx=G.x0+G.step*(n-1)/2,cy=G.y0+G.step*(n-1)/2;
  loadTex(st.H,{x0:cx-200,y0:cy-200},200,1024).then(function(t2){if(!t2||!st)return;var pm2=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({map:t2}));pm2.rotation.x=-Math.PI/2;var gz=gGround(G,cx,cy);pm2.position.set(cx,(gz!=null?gz:zmin)-zmin-0.15,-cy);pm2.receiveShadow=true;st.S.add(pm2);});}
 /* tout ce qui dépend des versants : terrain nettoyé, bâtiment, panneaux, poignées */
 function rebuild(first){if(!st||!st.G)return;var G=st.G,tex=st.tex,H=st.H,n=G.n,zmin=st.zmin,i,j,k;
  if(st.dyn){st.S.remove(st.dyn);st.dyn.traverse(function(o){if(o.geometry)o.geometry.dispose();});}
  var root=new THREE.Group(),grp=new THREE.Group(),over=new THREE.Group();root.add(grp);root.add(over);st.dyn=root;st.S.add(root);st.solids=[];st.handles=[];
  grp.visible=!st.google;over.position.y=st.google?st.dz:0;st.over=over;
  var z=G.z.slice();for(k=0;k<z.length;k++)if(z[k]==null){var s=0,c=0;[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].forEach(function(o){var q=k+o[0]+o[1]*n;if(q>=0&&q<z.length&&G.z[q]!=null){s+=G.z[q];c++;}});z[k]=c?s/c:zmin;}
  var plist=H.pans3d(G);st.plist=plist;
  var fp=plist.map(function(p){var c=[0,0];p.xy.forEach(function(q){c[0]+=q[0]/p.xy.length;c[1]+=q[1]/p.xy.length;});return p.xy.map(function(q){var dx=q[0]-c[0],dy=q[1]-c[1],L=Math.hypot(dx,dy)||1;return [q[0]+dx/L*0.9,q[1]+dy/L*0.9];});});
  if(G.gz&&plist.length){for(j=0;j<n;j++)for(i=0;i<n;i++){var x=G.x0+i*G.step,y=G.y0+j*G.step;if(fp.some(function(f){return inPoly([x,y],f);})){var g=gGround(G,x,y);if(g!=null)z[j*n+i]=g;}}}
  var geo=new THREE.BufferGeometry(),pos=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),idx=[];
  for(j=0;j<n;j++)for(i=0;i<n;i++){k=j*n+i;pos[k*3]=G.x0+i*G.step;pos[k*3+1]=z[k]-zmin;pos[k*3+2]=-(G.y0+j*G.step);uv[k*2]=i/(n-1);uv[k*2+1]=j/(n-1);}
  for(j=0;j<n-1;j++)for(i=0;i<n-1;i++){var a=j*n+i,b=a+1,c2=a+n,d2=c2+1;if(Math.abs(z[a]-z[d2])<Math.abs(z[b]-z[c2]))idx.push(a,b,d2,a,d2,c2);else idx.push(a,b,c2,b,d2,c2);}
  geo.setIndex(idx);geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.computeVertexNormals();
  var mat=tex?new THREE.MeshLambertMaterial({map:tex}):new THREE.MeshLambertMaterial({color:0xd6cfc4});
  var mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;grp.add(mesh);st.terrain=mesh;
  var span=G.step*(n-1),wallMat=new THREE.MeshStandardMaterial({color:0xece6dc,roughness:0.95,side:THREE.DoubleSide}),roofMat=tex?new THREE.MeshStandardMaterial({map:tex,roughness:0.85}):new THREE.MeshStandardMaterial({color:0x8a4b3a,roughness:0.85});
  function shared(p,a,b){return plist.some(function(o){if(o===p)return false;for(var k=0;k<o.xy.length;k++){var c=o.xy[k],d=o.xy[(k+1)%o.xy.length];if((Math.hypot(c[0]-a[0],c[1]-a[1])<0.35&&Math.hypot(d[0]-b[0],d[1]-b[1])<0.35)||(Math.hypot(c[0]-b[0],c[1]-b[1])<0.35&&Math.hypot(d[0]-a[0],d[1]-a[1])<0.35))return true;}return false;});}
  var pmat=new THREE.MeshStandardMaterial({color:0x0c1830,roughness:0.25,metalness:0.4,side:THREE.DoubleSide}),fmat=new THREE.LineBasicMaterial({color:0xcbd5e1}),pts=[];
  plist.forEach(function(p){var sel=st.sel===p.id,col=new THREE.Color(p.color);
   var tri=THREE.ShapeUtils.triangulateShape(p.xy.map(function(q){return new THREE.Vector2(q[0],q[1]);}),[]),pp=[],uu=[];
   p.xy.forEach(function(q){pp.push(q[0],p.z(q[0],q[1])-zmin,-q[1]);uu.push((q[0]-G.x0)/span,(q[1]-G.y0)/span);});
   var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uu,2));
   var ix=[];tri.forEach(function(t){ix.push(t[0],t[1],t[2]);});g.setIndex(ix);g.computeVertexNormals();if(g.attributes.normal.getY(0)<0){ix=[];tri.forEach(function(t){ix.push(t[0],t[2],t[1]);});g.setIndex(ix);g.computeVertexNormals();}
   var rm=new THREE.Mesh(g,roofMat);rm.castShadow=true;rm.receiveShadow=true;rm.userData.pan=p.id;grp.add(rm);st.solids.push(rm);
   if(sel||st.google){var hm=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:sel?0xfacc15:col,transparent:true,opacity:sel?0.35:0.18,depthWrite:false,side:THREE.DoubleSide}));hm.position.y=0.05;hm.userData.pan=p.id;over.add(hm);if(st.google)st.solids.push(hm);}
   var wp=[];for(var k=0;k<p.xy.length;k++){var a=p.xy[k],b=p.xy[(k+1)%p.xy.length];if(shared(p,a,b))continue;var za=p.z(a[0],a[1])-zmin,zb=p.z(b[0],b[1])-zmin,ga=gGround(G,a[0],a[1]),gb=gGround(G,b[0],b[1]);ga=(ga==null?zmin:ga)-zmin;gb=(gb==null?zmin:gb)-zmin;
    wp.push(a[0],za,-a[1],a[0],ga,-a[1],b[0],gb,-b[1],a[0],za,-a[1],b[0],gb,-b[1],b[0],zb,-b[1]);}
   if(wp.length){var wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(wp,3));wg.computeVertexNormals();var wm=new THREE.Mesh(wg,wallMat);wm.castShadow=true;wm.receiveShadow=true;wm.userData.pan=p.id;grp.add(wm);st.solids.push(wm);}
   var lp=[];p.xy.forEach(function(q){lp.push(q[0],p.z(q[0],q[1])-zmin+0.04,-q[1]);});lp.push(lp[0],lp[1],lp[2]);var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));over.add(new THREE.Line(lg,new THREE.LineBasicMaterial({color:sel?0xfacc15:col})));
   if(st.mode!=='edit')p.panels.forEach(function(q){var v=q.c.map(function(c){return [c[0],p.z(c[0],c[1])-zmin+0.16,-c[1]];});var g2=new THREE.BufferGeometry();g2.setAttribute('position',new THREE.Float32BufferAttribute([].concat(v[0],v[1],v[2],v[0],v[2],v[3]),3));g2.computeVertexNormals();
    var pm=new THREE.Mesh(g2,q.used?pmat:new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.25,side:THREE.DoubleSide}));pm.receiveShadow=true;over.add(pm);
    var e=new THREE.BufferGeometry();e.setAttribute('position',new THREE.Float32BufferAttribute([].concat(v[0],v[1],v[2],v[3],v[0]),3));over.add(new THREE.Line(e,fmat));
    if(q.used){pts.push(new THREE.Vector3((v[0][0]+v[2][0])/2,(v[0][1]+v[2][1])/2+0.05+(st.google?st.dz:0),(v[0][2]+v[2][2])/2));}});
   // poignées de modification
   if(st.mode==='edit'&&sel){p.xy.forEach(function(q,k){var on=st.selV===k;var sp=new THREE.Mesh(new THREE.SphereGeometry(on?0.32:0.25,16,12),new THREE.MeshBasicMaterial({color:on?0xfacc15:(k<2?0xf97316:0x2563eb),depthTest:false}));sp.renderOrder=10;sp.position.set(q[0],p.z(q[0],q[1])-zmin+0.1,-q[1]);sp.userData={pan:p.id,v:k};over.add(sp);st.handles.push(sp);
     var r=p.xy[(k+1)%p.xy.length],m=[(q[0]+r[0])/2,(q[1]+r[1])/2],ms=new THREE.Mesh(new THREE.SphereGeometry(0.16,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true,opacity:0.85}));ms.renderOrder=10;ms.position.set(m[0],p.z(m[0],m[1])-zmin+0.1,-m[1]);ms.userData={pan:p.id,mid:k+1,xy:m};over.add(ms);st.handles.push(ms);});}});
  st.panelPts=pts;
  // tracé en cours
  if(st.draw.length){var dp=[];st.draw.forEach(function(q,k){var sp=new THREE.Mesh(new THREE.SphereGeometry(0.25,16,12),new THREE.MeshBasicMaterial({color:k<2?0xf97316:0x2563eb,depthTest:false}));sp.renderOrder=10;sp.position.set(q[0],q[2]+0.1,-q[1]);over.add(sp);dp.push(q[0],q[2]+0.12,-q[1]);});
   if(dp.length>3){var dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(dp,3));var ln=new THREE.Line(dg,new THREE.LineBasicMaterial({color:0xfacc15,depthTest:false}));ln.renderOrder=11;over.add(ln);}}
  if(first){var c=H.center(),cz=0;var hit=pick3(c[0],c[1]);var t=new THREE.Vector3(c[0],(hit!=null?hit:4)*0.6,-c[1]);st.ctl.target.copy(t);st.cam.position.set(t.x-14,t.y+34,t.z+44);}
  tools();updSun();}
 function pick3(x,y){var G=st.G,i=Math.round((x-G.x0)/G.step),j=Math.round((y-G.y0)/G.step);var v=(i>=0&&j>=0&&i<G.n&&j<G.n)?G.z[j*G.n+i]:null;return v==null?null:v-st.zmin;}
 /* toucher la maquette */
 function tap(cx,cy){if(!st||!st.terrain)return;var r=st.R.domElement.getBoundingClientRect(),m=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,st.cam);
  if(st.mode==='edit'&&st.handles.length){var hh=rc.intersectObjects(st.handles,false);if(hh.length){var u=hh[0].object.userData;if(u.mid!=null){st.H.insPt(u.pan,u.mid,u.xy);st.selV=u.mid;rebuild();return;}st.selV=u.v;rebuild();info('Point '+(u.v+1)+' choisi : touche maintenant sa bonne place sur la maquette.');return;}}
  var hits=st.google?rc.intersectObjects(st.solids.filter(function(o){return o.userData.pan;}),false).concat(rc.intersectObject(st.tiles.group,true)).sort(function(a,b){return a.distance-b.distance;}):rc.intersectObjects(st.solids.concat([st.terrain]),false);
  if(st.google&&st.mode!=='view')hits=rc.intersectObject(st.tiles.group,true).concat(hits.filter(function(x){return x.object.userData&&x.object.userData.pan;}));
  if(!hits.length)return;var h=hits[0],P3=h.point,xy=[P3.x,-P3.z];
  if(st.mode==='draw'){xy=snap(xy);st.draw.push([xy[0],xy[1],P3.y-(st.google?st.dz:0)]);rebuild();info(st.draw.length<2?'Touche l’autre coin de la gouttière.':'Touche les autres coins du versant (faîte, rives), puis ✓ Terminer.');return;}
  if(st.mode==='edit'&&st.sel!=null&&st.selV!=null){st.H.movePt(st.sel,st.selV,snap(xy,st.sel,st.selV));rebuild();info('Point déplacé ✓. Choisis un autre point, ou ✓ Fini.');return;}
  var pid=h.object.userData&&h.object.userData.pan;st.sel=pid||null;st.selV=null;rebuild();if(pid)info('Versant sélectionné : ✥ Modifier ses points ou 🗑 le supprimer.');}
 function snap(xy,skipPan,skipV){var best=null,bd=0.4;(st.plist||[]).forEach(function(p){p.xy.forEach(function(q,k){if(p.id===skipPan&&k===skipV)return;var d=Math.hypot(q[0]-xy[0],q[1]-xy[1]);if(d<bd){bd=d;best=q;}});});st.draw.forEach(function(q){var d=Math.hypot(q[0]-xy[0],q[1]-xy[1]);if(d<bd&&d>0.01){bd=d;best=[q[0],q[1]];}});return best?[best[0],best[1]]:xy;}
 function info(t){if(st)st.ov.querySelector('[data-v=info]').textContent=t;}
 function tools(){if(!st)return;var h='';
  if(st.mode==='draw')h='<button data-v="undoD" class="btn s sm">↶ Point</button><button data-v="endD" class="btn sm g"'+(st.draw.length>=3?'':' disabled')+'>✓ Terminer</button><button data-v="cancel" class="btn s sm">✕ Annuler</button>';
  else if(st.mode==='edit')h=(st.selV!=null?'<button data-v="delV" class="btn s sm">🗑 Ce point</button>':'')+'<button data-v="undoE" class="btn s sm">↶</button><button data-v="endE" class="btn sm g">✓ Fini</button>';
  else h='<button data-v="startD" class="btn sm">✏️ Dessiner un versant</button>'+(st.sel?'<button data-v="startE" class="btn s sm">✥ Modifier</button><button data-v="delP" class="btn s sm">🗑 Supprimer</button>':'');
  st.ov.querySelector('[data-v=tools]').innerHTML=h;}
 function startGoogle(){var key=st.H.gkey&&st.H.gkey();if(!key){info('Pour la 3D photo de Google, colle ta clé Google dans ⚙️ Réglages (une seule fois).');return false;}
  if(!st.tiles){var T=new TilesRenderer('https://tile.googleapis.com/v1/3dtiles/root.json');T.registerPlugin(new GoogleCloudAuthPlugin({apiToken:key,autoRefreshToken:true}));
   var dl=new DRACOLoader();dl.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');T.registerPlugin(new GLTFExtensionsPlugin({dracoLoader:dl}));T.registerPlugin(new TileCompressionPlugin());
   T.registerPlugin(new ReorientationPlugin({lat:st.H.lat()*RAD,lon:st.H.lon()*RAD,height:st.zmin+45.5,up:'+y',recenter:true}));
   T.errorTarget=2;T.setCamera(st.cam);T.setResolutionFromRenderer(st.cam,st.R);
   T.addEventListener('load-model',function(e){e.scene.traverse(function(c){if(c.material){var m=c.material;c.material=new THREE.MeshLambertMaterial({map:m.map||null,color:m.map?0xffffff:(m.color||0xffffff)});c.castShadow=true;c.receiveShadow=true;}});st.needAlign=true;});
   T.addEventListener('load-error',function(){info('⚠ Google refuse la 3D : vérifie la clé et que « Map Tiles API » est activée (Réglages).');});
   var wrap=new THREE.Group();wrap.rotation.y=Math.PI;wrap.add(T.group);st.S.add(wrap);st.tiles=T;st.wrap=wrap;st.dz=0;st.aligned=0;
   st.alignT=setInterval(align,1500);}
  return true;}
 function align(){if(!st||!st.tiles||!st.needAlign)return;st.needAlign=false;var G=st.G,c=st.H.center(),rc=new THREE.Raycaster(),d=[];
  for(var a=-4;a<=4;a+=2)for(var b=-4;b<=4;b+=2){var x=c[0]+a,y=c[1]+b,lz=pick3(x,y);if(lz==null)continue;rc.set(new THREE.Vector3(x,800,-y),new THREE.Vector3(0,-1,0));var h=rc.intersectObject(st.tiles.group,true);if(h.length)d.push(h[0].point.y-lz);}
  if(d.length<5)return;d.sort(function(p,q){return p-q;});var dz=d[Math.floor(d.length/2)];if(Math.abs(dz-st.dz)>0.05){st.dz=dz;if(st.over)st.over.position.y=st.google?dz:0;}st.aligned++;
  if(st.aligned>8&&st.alignT){clearInterval(st.alignT);st.alignT=null;}var at=st.tiles.getAttributions?st.tiles.getAttributions().filter(function(x){return x.type==='string';}).map(function(x){return x.value;}).join(' · '):'';st.ov.querySelector('[data-v=attr]').textContent='Google'+(at?' · '+at:'');}
 var ACT3={
  google:function(){if(!st.google){if(!startGoogle())return;st.google=true;if(st.wrap)st.wrap.visible=true;info('3D photo de Google : chargement… Tu peux dessiner et déplacer les points directement dessus.');}else{st.google=false;if(st.wrap)st.wrap.visible=false;st.ov.querySelector('[data-v=attr]').textContent='';info('Maquette LiDAR.');}
   var b=st.ov.querySelector('[data-v=google]');b.classList.toggle('on',st.google);rebuild();},
  startD:function(){st.mode='draw';st.draw=[];st.sel=null;rebuild();info('Touche un coin de la gouttière (bas du versant) sur la maquette. Fais tourner la vue entre deux points si besoin.');},
  undoD:function(){st.draw.pop();rebuild();},
  cancel:function(){st.mode='view';st.draw=[];rebuild();info('Dessin annulé.');},
  endD:function(){if(st.draw.length<3)return;var xy=st.draw.map(function(q){return [q[0],q[1]];});st.mode='view';st.draw=[];info('Mesure de la pente et découpe au faîte…');
   st.H.addPan(xy).then(function(list){if(!st)return;st.sel=list&&list[0]?list[0].id:null;rebuild();info(list&&list.length>1?'Tracé coupé en '+list.length+' versants au faîte ✓':'Versant ajouté ✓ (pente '+(list&&list[0]?list[0].tilt:'?')+'°)');});},
  startE:function(){if(!st.sel)return;st.mode='edit';st.selV=null;rebuild();info('Touche un point (rond bleu ou orange), puis sa nouvelle place. Les petits ronds blancs ajoutent un point.');},
  endE:function(){st.mode='view';st.selV=null;rebuild();info('Modifications enregistrées ✓');},
  undoE:function(){st.H.undo();st.selV=null;rebuild();},
  delV:function(){if(st.selV==null)return;if(!st.H.delPt(st.sel,st.selV)){info('Il faut au moins 3 points.');return;}st.selV=null;rebuild();},
  delP:function(){if(!st.sel||!confirm('Supprimer ce versant ?'))return;st.H.delPan(st.sel);st.sel=null;rebuild();info('Versant supprimé.');}
 };
 function updSun(){if(!st)return;var ov=st.ov,hr=+ov.querySelector('[data-v=hour]').value,dv=ov.querySelector('[data-v=date]').value,now=new Date(),m,d;
  if(dv==='now'){m=now.getMonth();d=now.getDate();}else{m=+dv.split('-')[0];d=+dv.split('-')[1];}
  var y=new Date().getFullYear(),loc=Date.UTC(y,m,d,Math.floor(hr),Math.round((hr%1)*60)),guess=loc-3600000;if(bxl(guess).h!==Math.floor(hr))guess=loc-7200000;
  var sp=sunPos(guess,st.H.lat(),st.H.lon());ov.querySelector('[data-v=hl]').textContent=Math.floor(hr)+':'+String(Math.round((hr%1)*60)).padStart(2,'0');
  var t=st.ctl.target,D=150,el=sp.el*RAD,az=sp.az*RAD;
  st.sun.target.position.copy(t);st.sun.position.set(t.x+D*Math.cos(el)*Math.sin(az),t.y+D*Math.sin(el),t.z-D*Math.cos(el)*Math.cos(az));
  st.sun.intensity=sp.el>0?2.2:0;st.S.background.set(sp.el>0?0xbfd7ee:0x1e293b);
  if(!st.terrain||st.mode!=='view')return;
  if(sp.el<=0){info('Soleil couché ('+Math.round(sp.el)+'°).');return;}
  var rc=new THREE.Raycaster(),dir=new THREE.Vector3().subVectors(st.sun.position,t).normalize(),sh=0;
  st.panelPts.forEach(function(p){rc.set(p,dir);rc.far=500;if((st.google?rc.intersectObject(st.tiles.group,true):rc.intersectObjects([st.terrain].concat(st.solids),false)).length)sh++;});
  info('Soleil : hauteur '+Math.round(sp.el)+'°, direction '+Math.round(sp.az)+'° · '+(st.panelPts.length?(sh+' / '+st.panelPts.length+' panneaux à l’ombre'):'aucun panneau')+'. Un doigt : tourner · deux doigts : zoomer · toucher un toit : le choisir.');}
 function close(){if(!st)return;cancelAnimationFrame(st.raf);if(st.alignT)clearInterval(st.alignT);if(st.tiles)try{st.tiles.dispose();}catch(e){}if(st.play)clearInterval(st.play);window.removeEventListener('resize',st.resize);st.R.dispose();st.ov.remove();st=null;}
 return {open:open,close:close,_st:function(){return st;}};})();
