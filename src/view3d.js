/* ===== Vue 3D (v12.1) : maquette LiDAR réaliste (ardoises, tuiles, gouttières, panneaux vitrés, ciel),
   pose des points au doigt avec loupe, aimant et cotes, présentation « 3D scroll » ===== */
var View3D=(function(){
 var st=null,TXC={};
 function inPoly(pt,pts){var c=false;for(var i=0,j=pts.length-1;i<pts.length;j=i++){var a=pts[i],b=pts[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
 function el(h){var d=document.createElement('div');d.innerHTML=h;return d.firstChild;}
 function merc(lat,lon){var R=6378137;return [lon*RAD*R,Math.log(Math.tan(Math.PI/4+lat*RAD/2))*R];}
 function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
 function ease(t){return t<0.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;}
 function sstep(t){t=clamp(t,0,1);return t*t*(3-2*t);}
 function fr2(v,n){return v.toFixed(n==null?2:n).replace('.',',');}
 function hrand(i,j,s){var x=Math.sin(i*127.1+j*311.7+s*74.7)*43758.5453;return x-Math.floor(x);}

 /* ---------- photo aérienne ---------- */
 function loadTex(H,G,half,px){var o=H.o,c=[G.x0+half,G.y0+half],sw=H.toLL([c[0]-half,c[1]-half],o),ne=H.toLL([c[0]+half,c[1]+half],o),a=merc(sw[0],sw[1]),b=merc(ne[0],ne[1]);
  var u=GEO+'IMAGERIE/ORTHO_2026_PRINTEMPS/MapServer/export?bbox='+[a[0],a[1],b[0],b[1]].join(',')+'&bboxSR=3857&imageSR=3857&size='+(px||2048)+','+(px||2048)+'&format=jpg&f=image';
  return fetch(u).then(function(r){if(!r.ok)throw 0;return r.blob();}).then(function(bl){if(!/image/.test(bl.type))throw 0;return createImageBitmap(bl,{imageOrientation:'flipY'});}).then(function(im){var t=new THREE.Texture(im);t.flipY=false;t.needsUpdate=true;t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;
   try{var c2=document.createElement('canvas');c2.width=c2.height=128;var x=c2.getContext('2d');x.drawImage(im,0,0,128,128);t.userData.px=x.getImageData(0,0,128,128).data;}catch(e){}
   return t;}).catch(function(){return null;});}

 /* ---------- matières fabriquées (ardoises, tuiles, crépi, panneaux) ---------- */
 function normalFrom(Hh,n,k){var c=document.createElement('canvas');c.width=c.height=n;var x=c.getContext('2d'),im=x.createImageData(n,n),d=im.data;
  for(var j=0;j<n;j++)for(var i=0;i<n;i++){var l=Hh[j*n+(i+n-1)%n],r=Hh[j*n+(i+1)%n],u=Hh[((j+n-1)%n)*n+i],dn=Hh[((j+1)%n)*n+i];
   var nx=-(r-l)*k,ny=(dn-u)*k,L=Math.hypot(nx,ny,1),o=(j*n+i)*4;d[o]=(nx/L*0.5+0.5)*255;d[o+1]=(ny/L*0.5+0.5)*255;d[o+2]=(1/L*0.5+0.5)*255;d[o+3]=255;}
  x.putImageData(im,0,0);return c;}
 function wrapTex(c,srgb){var t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
 function texRoof(kind){if(TXC[kind])return TXC[kind];var tu=kind==='tuile',n=512,c=document.createElement('canvas');c.width=c.height=n;var x=c.getContext('2d'),im=x.createImageData(n,n),d=im.data,Hh=new Float32Array(n*n);
  var cols=tu?5:6,rows=tu?3:10;
  for(var j=0;j<n;j++){var f=j/n*rows,row=Math.floor(f),t=f-row; // t : 0 = haut de l'élément, 1 = son bord bas (visible)
   for(var i=0;i<n;i++){var fc=i/n*cols+((!tu&&row%2)?0.5:0),col=Math.floor(fc)%cols,s=fc-Math.floor(fc),o=(j*n+i)*4,v=hrand(col,row,tu?3:7),gr=0.93+hrand(i,j,1)*0.14,h,R,G,B,b,sh;
    if(tu){var w=0.5+0.5*Math.cos((s-0.3)*2*Math.PI);h=w*0.75+t*0.25;sh=(0.7+0.3*w)*(t<0.05?0.7:1)*(s<0.03?0.65:1);b=0.86+v*0.28;R=170*b*sh;G=93*b*sh;B=66*b*sh;}
    else{var jt=(s<0.018||s>0.982);h=t*0.8-(jt?0.5:0);sh=(t<0.07?0.5:0.88+0.12*t)*(jt?0.55:1);b=0.86+v*0.28;var st2=0.96+0.08*hrand(i,row,5);R=56*b*sh*st2;G=60*b*sh*st2;B=69*b*sh*st2;}
    d[o]=R*gr;d[o+1]=G*gr;d[o+2]=B*gr;d[o+3]=255;Hh[j*n+i]=h;}}
  x.putImageData(im,0,0);
  return TXC[kind]={c:c,nc:normalFrom(Hh,n,tu?2.2:1.6),su:tu?1.1:1.2,sv:tu?1.02:1.1,rough:tu?0.82:0.5,mean:tu?[150,82,58]:[50,54,62]};}
 function texWall(){if(TXC.wall)return TXC.wall;var n=256,c=document.createElement('canvas');c.width=c.height=n;var x=c.getContext('2d'),im=x.createImageData(n,n),d=im.data,Hh=new Float32Array(n*n);
  for(var j=0;j<n;j++)for(var i=0;i<n;i++){var a=hrand(i,j,2),b=hrand(i>>2,j>>2,4),o=(j*n+i)*4,v=222+a*20+b*13;d[o]=d[o+1]=d[o+2]=v;d[o+3]=255;Hh[j*n+i]=a*0.6+b*0.4;}
  x.putImageData(im,0,0);return TXC.wall={c:c,nc:normalFrom(Hh,n,0.9)};}
 function texPanel(land){var k=land?'panL':'panP';if(TXC[k])return TXC[k];var W=land?960:576,Hc=land?576:960,c=document.createElement('canvas');c.width=W;c.height=Hc;var x=c.getContext('2d');
  x.fillStyle='#0a0c11';x.fillRect(0,0,W,Hc);var m=14,nc=land?20:6,nr=land?6:20,cw=(W-2*m)/nc,ch=(Hc-2*m)/nr;
  for(var r=0;r<nr;r++)for(var q=0;q<nc;q++){var X=m+q*cw+1.4,Y=m+r*ch+1.4,w=cw-2.8,h=ch-2.8;
   if(land){if(q===nc/2-1)w-=3;if(q===nc/2){X+=3;w-=3;}}else{if(r===nr/2-1)h-=3;if(r===nr/2){Y+=3;h-=3;}}
   var v0=hrand(q,r,9)*9,g=x.createLinearGradient(X,Y,X+w,Y+h);g.addColorStop(0,'rgb('+(16+v0|0)+','+(22+v0|0)+','+(44+v0|0)+')');g.addColorStop(1,'rgb(7,10,24)');x.fillStyle=g;x.fillRect(X,Y,w,h);
   x.strokeStyle='rgba(175,186,210,0.17)';x.lineWidth=0.8;x.beginPath();if(land){for(var e=1;e<10;e++){var yy=Y+h*e/10;x.moveTo(X,yy);x.lineTo(X+w,yy);}}else{for(var e2=1;e2<10;e2++){var xx=X+w*e2/10;x.moveTo(xx,Y);x.lineTo(xx,Y+h);}}x.stroke();}
  x.strokeStyle='#1c1f26';x.lineWidth=4;x.strokeRect(2,2,W-4,Hc-4);var t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return TXC[k]=t;}

 /* ---------- ouverture ---------- */
 function open(H,opt){opt=opt||{};
  close();
  var B='class="btn s sm"';
  var ov=el('<div id="v3d" style="position:fixed;inset:0;z-index:2600;background:#0b0f19;color:#fff;font:14px system-ui;overflow:hidden"><canvas style="position:absolute;inset:0;width:100%;height:100%;touch-action:none"></canvas>'+
   '<div data-v="labs" style="position:absolute;inset:0;pointer-events:none;overflow:hidden"></div>'+
   '<div data-v="loupe" style="position:absolute;display:none;width:150px;height:150px;box-sizing:border-box;border:3px solid #facc15;border-radius:14px;box-shadow:0 6px 22px rgba(0,0,0,.55);pointer-events:none;background:linear-gradient(#facc15,#facc15) 50% 50%/1px 100% no-repeat,linear-gradient(#facc15,#facc15) 50% 50%/100% 1px no-repeat"><i style="position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-8px;border:1px solid #fff;border-radius:50%;box-shadow:0 0 0 1px #000"></i></div>'+
   '<div data-ui="top" style="position:absolute;left:8px;right:8px;top:8px;display:flex;gap:6px;align-items:center;flex-wrap:wrap"><button data-v="close" class="btn sm">✕ Fermer</button><select data-v="date" style="padding:7px;border-radius:9px;border:0;font:inherit"><option value="5-21">21 juin</option><option value="2-20">21 mars</option><option value="11-21">21 décembre</option><option value="now">Aujourd’hui</option></select>'+
   '<label style="display:flex;align-items:center;gap:6px;background:rgba(0,0,0,.5);padding:4px 8px;border-radius:9px">🕑 <input data-v="hour" type="range" min="5" max="22" step="0.25" value="13" style="width:110px"><b data-v="hl">13:00</b></label><button data-v="play" '+B+'>▶ Journée</button><button data-v="top" '+B+'>⤓ Dessus</button><button data-v="roof" '+B+'>🏠 Toit : auto</button><button data-v="google" '+B+'>📷 3D Google</button><button data-v="pres" class="btn sm">🎬 Présentation</button><button data-v="pv" class="btn sm g">▦ Poser les panneaux</button></div>'+
   '<div data-v="attr" style="position:absolute;right:8px;bottom:50px;font:10px system-ui;color:#fff;text-shadow:0 0 3px #000;max-width:70%;text-align:right;pointer-events:none"></div>'+
   '<div data-v="tools" data-ui="tools" style="position:absolute;left:8px;right:8px;bottom:64px;display:flex;gap:6px;flex-wrap:wrap;align-items:center"></div>'+
   '<div data-v="info" data-ui="info" style="position:absolute;left:8px;bottom:10px;right:8px;background:rgba(0,0,0,.6);border-radius:10px;padding:7px 10px;font-size:13px">Chargement du relevé LiDAR…</div>'+
   '<div data-v="presUI" style="display:none;position:absolute;left:0;right:0;bottom:0;padding:90px 22px 20px;background:linear-gradient(0deg,rgba(6,8,16,.92),rgba(6,8,16,.55) 55%,rgba(6,8,16,0));pointer-events:none">'+
    '<div data-v="pk" style="font:600 12px system-ui;letter-spacing:.22em;text-transform:uppercase;color:#facc15"></div>'+
    '<div data-v="pt" style="font:800 clamp(26px,6vw,46px)/1.05 system-ui;letter-spacing:-.02em;margin:6px 0 8px;max-width:16em"></div>'+
    '<div data-v="ps" style="font:400 clamp(14px,2.6vw,17px)/1.4 system-ui;color:#cbd5e1;max-width:34em;min-height:2.8em"></div>'+
    '<div style="display:flex;align-items:center;gap:10px;margin-top:12px;pointer-events:auto"><button data-v="pPrev" '+B+'>‹</button><div data-v="pbar" style="flex:1;max-width:260px;height:3px;background:rgba(255,255,255,.2);border-radius:2px"><i style="display:block;height:100%;width:0;background:#facc15;border-radius:2px"></i></div><button data-v="pNext" class="btn sm">Suite ›</button><button data-v="pExit" '+B+'>✕ Quitter</button></div></div></div>');
  document.body.appendChild(ov);var cv=ov.querySelector('canvas');
  var R=new THREE.WebGLRenderer({canvas:cv,antialias:true});R.setPixelRatio(Math.min(2,window.devicePixelRatio||1));R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.outputColorSpace=THREE.SRGBColorSpace;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.05;
  var S=new THREE.Scene();S.background=new THREE.Color(0xbfd7ee);S.fog=new THREE.Fog(0xbfd7ee,140,460);
  var cam=new THREE.PerspectiveCamera(45,1,0.3,3000),lcam=new THREE.PerspectiveCamera(3,1,0.3,3000);
  var ctl=new OrbitControls(cam,cv);ctl.enableDamping=true;ctl.maxPolarAngle=Math.PI*0.49;ctl.minDistance=2;ctl.maxDistance=400;ctl.zoomSpeed=1.4;
  var hemi=new THREE.HemisphereLight(0xdfeeff,0x8a7a62,1.0);S.add(hemi);
  var sun=new THREE.DirectionalLight(0xfff4dd,2.2);sun.castShadow=true;sun.shadow.mapSize.set(4096,4096);var sc=sun.shadow.camera;sc.left=-34;sc.right=34;sc.top=34;sc.bottom=-34;sc.near=1;sc.far=400;sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.04;S.add(sun);S.add(sun.target);
  // ciel : dégradé + halo du soleil
  var skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,fog:false,uniforms:{sun:{value:new THREE.Vector3(0.3,0.8,0.5)},day:{value:1}},
   vertexShader:'varying vec3 vD;void main(){vD=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'uniform vec3 sun;uniform float day;varying vec3 vD;void main(){vec3 d=normalize(vD);float h=max(d.y,0.0);vec3 zen=mix(vec3(0.015,0.02,0.06),vec3(0.16,0.40,0.80),day);vec3 hor=mix(vec3(0.05,0.07,0.12),vec3(0.72,0.83,0.93),day);vec3 c=mix(hor,zen,pow(h,0.45));float s=max(dot(d,normalize(sun)),0.0);c+=vec3(1.0,0.70,0.40)*pow(s,6.0)*0.35*day*(1.0-clamp(sun.y*1.6,0.0,0.85));c+=vec3(1.0,0.95,0.85)*pow(s,700.0)*3.0*step(0.0,sun.y);gl_FragColor=vec4(c,1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'});
  var sky=new THREE.Mesh(new THREE.SphereGeometry(1000,32,16),skyMat);sky.frustumCulled=false;sky.renderOrder=-5;S.add(sky);
  try{var pm=new THREE.PMREMGenerator(R),es=new THREE.Scene();var em=skyMat.clone();em.uniforms.sun.value.set(0,-1,0);es.add(new THREE.Mesh(sky.geometry,em));S.environment=pm.fromScene(es,0.03).texture;pm.dispose();if('environmentIntensity' in S)S.environmentIntensity=0.85;}catch(e){}
  st={ov:ov,R:R,S:S,cam:cam,lcam:lcam,ctl:ctl,sun:sun,hemi:hemi,sky:sky,H:H,raf:0,panelPts:[],terrain:null,play:null,solids:[],handles:[],dyn:null,mode:'view',draw:[],sel:null,selV:null,google:false,tiles:null,dz:0,
   roof:'auto',mag:true,labs:[],pmesh:[],w:1,h:1,fly:null,pres:null,drag:null,lp:null,aim:false};
  function resize(){var w=ov.clientWidth,h=ov.clientHeight;st.w=w;st.h=h;R.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix();}
  window.addEventListener('resize',resize);st.resize=resize;resize();
  (function loop(){if(!st)return;st.raf=requestAnimationFrame(loop);var now=performance.now();
   if(st.fly)stepFly(now);if(st.pres)stepPres(now);ctl.update();sky.position.copy(cam.position);
   if(st.tiles&&st.google){cam.updateMatrixWorld();st.tiles.update();}
   sizeHandles();R.setScissorTest(false);R.setViewport(0,0,st.w,st.h);R.render(S,cam);
   if(st.lp)renderLoupe();placeLabels();})();
  ov.addEventListener('click',function(e){var b=e.target.closest('[data-v]');if(!b||!st)return;var v=b.dataset.v;
   if(v==='close')close();else if(v==='top'){var t=ctl.target;fly(new THREE.Vector3(t.x,t.y+60,t.z+0.01),t.clone(),800);}
   else if(v==='play'){if(st.play){clearInterval(st.play);st.play=null;b.textContent='▶ Journée';return;}b.textContent='⏸ Pause';var hr=ov.querySelector('[data-v=hour]');st.play=setInterval(function(){var x=+hr.value+0.25;if(x>21)x=5.5;hr.value=x;updSun();},180);}
   else if(ACT3[v])ACT3[v]();});
  ov.querySelector('[data-v=hour]').addEventListener('input',updSun);ov.querySelector('[data-v=date]').addEventListener('change',updSun);
  /* gestes : toucher court = pointer ; glisser un point = le déplacer (loupe) ; appui long en dessin = visée à la loupe */
  var down=null;
  ov.addEventListener('pointerdown',function(e){if(!st||e.target!==cv)return;st.fly=null;
   if(st.pres){st.pres.sw={y:e.clientY,p:st.pres.pt};return;}
   if(!e.isPrimary){clearTimeout(st.lpT);return;}
   if(st.mode==='edit'){var h=hitHandle(e.clientX,e.clientY);if(h&&h.userData.mid==null){e.stopPropagation();e.preventDefault();st.drag={pan:h.userData.pan,k:h.userData.v,x:e.clientX,y:e.clientY,moved:false,h:h,id:e.pointerId,xy:null};try{cv.setPointerCapture(e.pointerId);}catch(_){}return;}}
   down={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:Date.now()};
   if(st.mode==='draw'){clearTimeout(st.lpT);st.lpT=setTimeout(function(){if(down&&st&&st.mode==='draw'){st.aim=true;ctl.enabled=false;aimAt(down.lx,down.ly);}},380);}},true);
  ov.addEventListener('pointermove',function(e){if(!st)return;
   if(st.pres){var sw=st.pres.sw;if(sw&&e.buttons){st.pres.pt=clamp(sw.p+(sw.y-e.clientY)*0.005,0,3);st.pres.idle=performance.now();}return;}
   var D=st.drag;if(D&&e.pointerId===D.id){if(!D.moved&&Math.hypot(e.clientX-D.x,e.clientY-D.y)<5)return;D.moved=true;dragTo(e.clientX,e.clientY);return;}
   if(down){down.lx=e.clientX;down.ly=e.clientY;if(st.aim)aimAt(e.clientX,e.clientY);else if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>8)clearTimeout(st.lpT);}});
  function up(e){if(!st)return;clearTimeout(st.lpT);if(st.pres){st.pres.sw=null;st.pres.idle=performance.now();return;}
   var D=st.drag;if(D&&e.pointerId===D.id){st.drag=null;loupe(null);st.selV=D.k;
    if(D.moved&&D.xy&&e.type!=='pointercancel'){st.H.movePt(D.pan,D.k,D.xy);rebuild();say('Point déplacé ✓ — les flèches l’ajustent de 5 cm. Choisis un autre point, ou ✓ Fini.');}
    else{rebuild();say('Point '+(D.k+1)+' choisi : glisse-le avec le doigt (loupe), touche sa bonne place, ou ajuste avec les flèches (5 cm).');}return;}
   if(st.aim){st.aim=false;ctl.enabled=true;loupe(null);var a=st.aimHit;st.aimHit=null;down=null;if(a&&e.type!=='pointercancel')place(a);return;}
   if(!down)return;var d=Math.hypot(e.clientX-down.x,e.clientY-down.y),dt=Date.now()-down.t;down=null;if(e.type!=='pointercancel'&&d<8&&dt<500)tap(e.clientX,e.clientY);}
  ov.addEventListener('pointerup',up);ov.addEventListener('pointercancel',up);
  ov.addEventListener('wheel',function(e){if(st&&st.pres){e.preventDefault();e.stopPropagation();st.pres.pt=clamp(st.pres.pt+e.deltaY*0.0016,0,3);st.pres.idle=performance.now();}},{capture:true,passive:false});
  st.key=function(e){if(!st||!st.pres)return;if(e.key==='ArrowRight'||e.key==='ArrowDown'||e.key===' ')ACT3.pNext();else if(e.key==='ArrowLeft'||e.key==='ArrowUp')ACT3.pPrev();else if(e.key==='Escape')ACT3.pExit();};window.addEventListener('keydown',st.key);
  var half=30,c=H.center();
  H.getGrid(c[0],c[1],half,0.5,function(f){say('Chargement du relevé LiDAR… '+Math.round(f*100)+' %');}).then(function(G){if(!st)return;
   if(!G||G.z.filter(function(v){return v!=null;}).length<100){say('Relevé LiDAR inaccessible (internet ?). La vue 3D a besoin du LiDAR wallon.');return;}
   say('Chargement de la photo aérienne 2026…');
   return loadTex(H,G,half).then(function(tex){if(!st)return;st.G=G;st.tex=tex;st.half=half;base(G,tex);rebuild(true);if(opt.google&&st)ACT3.google();if(opt.mode==='pv'&&st)ACT3.pv();});});
 }
 /* décor fixe : grande photo de contexte */
 function base(G,tex){var n=G.n,zmin=1e9;G.z.forEach(function(v){if(v!=null&&v<zmin)zmin=v;});st.zmin=zmin;
  var cx=G.x0+G.step*(n-1)/2,cy=G.y0+G.step*(n-1)/2;
  loadTex(st.H,{x0:cx-200,y0:cy-200},200,1024).then(function(t2){if(!t2||!st)return;var pm2=new THREE.Mesh(new THREE.PlaneGeometry(400,400),new THREE.MeshLambertMaterial({map:t2}));pm2.rotation.x=-Math.PI/2;var gz=gGround(G,cx,cy);pm2.position.set(cx,(gz!=null?gz:zmin)-zmin-0.15,-cy);pm2.receiveShadow=true;st.S.add(pm2);});}

 /* ---------- géométrie d'un versant : plan, surface, pente ---------- */
 function planeOf(p){var c=[0,0],n=p.xy.length,A=0,zm=0,i;p.xy.forEach(function(q){c[0]+=q[0]/n;c[1]+=q[1]/n;});
  var z0=p.z(c[0],c[1]),a=p.z(c[0]+1,c[1])-z0,b=p.z(c[0],c[1]+1)-z0;p.xy.forEach(function(q){zm+=p.z(q[0],q[1])/n;});
  for(i=0;i<n;i++){var q=p.xy[i],r=p.xy[(i+1)%n];A+=q[0]*r[1]-r[0]*q[1];}
  p.c0=c;p.z0=z0;p.a=a;p.b=b;p.g=Math.hypot(a,b);p.zm=zm;p.area=Math.abs(A)/2*Math.sqrt(1+p.g*p.g);p.tiltD=Math.atan(p.g)/RAD;}
 function meanCol(p){var px=st.tex&&st.tex.userData.px;if(!px)return null;var G=st.G,span=G.step*(G.n-1),s=[0,0,0],n=0;
  [p.c0].concat(p.xy.map(function(q){return [(q[0]+p.c0[0])/2,(q[1]+p.c0[1])/2];})).forEach(function(q){var i=Math.round((q[0]-G.x0)/span*127),j=Math.round((q[1]-G.y0)/span*127);if(i<0||j<0||i>127||j>127)return;var o=(j*128+i)*4;s[0]+=px[o];s[1]+=px[o+1];s[2]+=px[o+2];n++;});
  return n?[s[0]/n,s[1]/n,s[2]/n]:null;}
 function roofKind(p){if(st.mode!=='view')return 'photo';if(st.roof!=='auto')return st.roof;if(p.g<0.14)return 'photo';var c=meanCol(p);if(!c)return 'ardoise';return (c[0]>c[2]*1.22&&c[0]>70)?'tuile':'ardoise';}
 function roofMaterial(p,photoMat){var kind=roofKind(p);p.kind=kind;if(kind==='photo')return photoMat;var T=texRoof(kind);
  if(!T.map){T.map=wrapTex(T.c,true);T.nm=wrapTex(T.nc,false);}
  var m=new THREE.MeshStandardMaterial({map:T.map,normalMap:T.nm,roughness:T.rough,metalness:0,side:THREE.DoubleSide,envMapIntensity:0.6}),c=meanCol(p);
  if(c){if(kind==='tuile')m.color.setRGB(0.5+0.5*clamp(c[0]/T.mean[0],0.6,1.4),0.5+0.5*clamp(c[1]/T.mean[1],0.6,1.4),0.5+0.5*clamp(c[2]/T.mean[2],0.6,1.4));
   else m.color.setScalar(clamp((0.299*c[0]+0.587*c[1]+0.114*c[2])/62,0.75,1.55));}
  return m;}
 function quad(arr,a,b,c,d){arr.push(a[0],a[1],a[2],b[0],b[1],b[2],c[0],c[1],c[2],a[0],a[1],a[2],c[0],c[1],c[2],d[0],d[1],d[2]);}
 function meshOf(arr,mat,shadow){var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));g.computeVertexNormals();var m=new THREE.Mesh(g,mat);if(shadow){m.castShadow=true;m.receiveShadow=true;}return m;}

 /* tout ce qui dépend des versants : terrain nettoyé, bâtiment, panneaux, poignées */
 function rebuild(first){if(!st||!st.G)return;var G=st.G,tex=st.tex,H=st.H,n=G.n,zmin=st.zmin,i,j,k;
  if(st.dyn){st.S.remove(st.dyn);st.dyn.traverse(function(o){if(o.geometry)o.geometry.dispose();});}
  var root=new THREE.Group(),grp=new THREE.Group(),over=new THREE.Group(),hg=new THREE.Group();root.add(grp);root.add(over);over.add(hg);st.dyn=root;st.S.add(root);st.solids=[];st.handles=[];st.pmesh=[];st.pvHit=[];st.pvs=st.H.pv?st.H.pv():null;st.hg=hg;st.prev=null;
  grp.visible=!st.google;over.position.y=st.google?st.dz:0;st.over=over;
  var z=G.z.slice();for(k=0;k<z.length;k++)if(z[k]==null){var s=0,c=0;[[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]].forEach(function(o){var q=k+o[0]+o[1]*n;if(q>=0&&q<z.length&&G.z[q]!=null){s+=G.z[q];c++;}});z[k]=c?s/c:zmin;}
  var plist=H.pans3d(G);st.plist=plist;plist.forEach(planeOf);
  var fp=plist.map(function(p){var c=p.c0;return p.xy.map(function(q){var dx=q[0]-c[0],dy=q[1]-c[1],L=Math.hypot(dx,dy)||1;return [q[0]+dx/L*0.9,q[1]+dy/L*0.9];});});
  if(G.gz&&plist.length){for(j=0;j<n;j++)for(i=0;i<n;i++){var x=G.x0+i*G.step,y=G.y0+j*G.step;if(fp.some(function(f){return inPoly([x,y],f);})){var g=gGround(G,x,y);if(g!=null)z[j*n+i]=g;}}}
  var geo=new THREE.BufferGeometry(),pos=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),idx=[];
  for(j=0;j<n;j++)for(i=0;i<n;i++){k=j*n+i;pos[k*3]=G.x0+i*G.step;pos[k*3+1]=z[k]-zmin;pos[k*3+2]=-(G.y0+j*G.step);uv[k*2]=i/(n-1);uv[k*2+1]=j/(n-1);}
  for(j=0;j<n-1;j++)for(i=0;i<n-1;i++){var a=j*n+i,b=a+1,c2=a+n,d2=c2+1;if(Math.abs(z[a]-z[d2])<Math.abs(z[b]-z[c2]))idx.push(a,b,d2,a,d2,c2);else idx.push(a,b,c2,b,d2,c2);}
  geo.setIndex(idx);geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.computeVertexNormals();
  var mat=tex?new THREE.MeshLambertMaterial({map:tex}):new THREE.MeshLambertMaterial({color:0xb9c2a5});
  // décor : les faces raides du relevé (façades voisines, bords d'arbres) en teinte façade au lieu de la photo étirée
  mat.onBeforeCompile=function(sh){sh.fragmentShader=sh.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n float upW=dot(normal,normalize((viewMatrix*vec4(0.0,1.0,0.0,0.0)).xyz));diffuseColor.rgb=mix(vec3(0.58,0.55,0.51),diffuseColor.rgb,smoothstep(0.30,0.62,upW));');};
  var mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;grp.add(mesh);st.terrain=mesh;
  var span=G.step*(n-1),TW=texWall();if(!TW.map){TW.map=wrapTex(TW.c,true);TW.nm=wrapTex(TW.nc,false);}
  var wallMat=new THREE.MeshStandardMaterial({color:0xece6dc,map:TW.map,normalMap:TW.nm,roughness:0.95,side:THREE.DoubleSide,envMapIntensity:1}),photoMat=tex?new THREE.MeshStandardMaterial({map:tex,roughness:0.85,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:0x6b6f76,roughness:0.85,side:THREE.DoubleSide}),
   fasMat=new THREE.MeshStandardMaterial({color:0x2e2b29,roughness:0.7,side:THREE.DoubleSide}),zincMat=new THREE.MeshStandardMaterial({color:0xa9b0b5,roughness:0.45,metalness:0.35,side:THREE.DoubleSide,envMapIntensity:1}),
   glass=function(land){return new THREE.MeshPhysicalMaterial({map:texPanel(land),roughness:0.25,metalness:0,clearcoat:0.12,clearcoatRoughness:0.06,specularIntensity:0.12,envMapIntensity:0.45});},gP=glass(false),gL=glass(true),frameMat=new THREE.MeshStandardMaterial({color:0x15171c,roughness:0.5,metalness:0.6}),
   ghostMat=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.25,side:THREE.DoubleSide,depthWrite:false}),fmat=new THREE.LineBasicMaterial({color:0xcbd5e1}),pts=[],boxes={},caps={};
  function shared(p,a,b){return plist.some(function(o){if(o===p)return false;for(var k=0;k<o.xy.length;k++){var c=o.xy[k],d=o.xy[(k+1)%o.xy.length];if((Math.hypot(c[0]-a[0],c[1]-a[1])<0.35&&Math.hypot(d[0]-b[0],d[1]-b[1])<0.35)||(Math.hypot(c[0]-b[0],c[1]-b[1])<0.35&&Math.hypot(d[0]-a[0],d[1]-a[1])<0.35))return true;}return false;});}
  var Y3=function(p,x,y){return p.z(x,y)-zmin;},gY=function(x,y){var g=gGround(G,x,y);return (g==null?zmin:g)-zmin;};
  plist.forEach(function(p){var sel=st.sel===p.id,col=new THREE.Color(p.color),N=p.xy.length;
   var rmat=roofMaterial(p,photoMat),proc=p.kind!=='photo',T=proc?texRoof(p.kind):null;
   // sens de pose : rangs de niveau, recouvrement vers le haut de la pente
   var upx,upy;if(p.g>0.03){upx=p.a/p.g;upy=p.b/p.g;}else{var e0=p.xy[0],e1=p.xy[1],L0=Math.hypot(e1[0]-e0[0],e1[1]-e0[1])||1;upx=-(e1[1]-e0[1])/L0;upy=(e1[0]-e0[0])/L0;}
   var sl=Math.sqrt(1+p.g*p.g);
   var tri=THREE.ShapeUtils.triangulateShape(p.xy.map(function(q){return new THREE.Vector2(q[0],q[1]);}),[]),pp=[],uu=[];
   p.xy.forEach(function(q){pp.push(q[0],Y3(p,q[0],q[1]),-q[1]);if(proc){var dx=q[0]-p.c0[0],dy=q[1]-p.c0[1];uu.push((-dx*upy+dy*upx)/T.su,(dx*upx+dy*upy)*sl/T.sv);}else uu.push((q[0]-G.x0)/span,(q[1]-G.y0)/span);});
   var g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pp,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uu,2));
   var ix=[];tri.forEach(function(t){ix.push(t[0],t[1],t[2]);});g.setIndex(ix);g.computeVertexNormals();if(g.attributes.normal.getY(0)<0){ix=[];tri.forEach(function(t){ix.push(t[0],t[2],t[1]);});g.setIndex(ix);g.computeVertexNormals();}
   var rm=new THREE.Mesh(g,rmat);rm.castShadow=true;rm.receiveShadow=true;rm.userData.pan=p.id;grp.add(rm);st.solids.push(rm);
   if(sel||st.google){var hm=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:sel?0xfacc15:col,transparent:true,opacity:sel?(st.google?0.35:(st.mode==='view'?0.16:0.07)):0.18,depthWrite:false,side:THREE.DoubleSide}));hm.position.y=0.05;hm.userData.pan=p.id;over.add(hm);if(st.google)st.solids.push(hm);}
   // bords : murs en retrait sous le débord, planches de rive, gouttière, faîtières
   var E=[];for(k=0;k<N;k++){var A=p.xy[k],Bq=p.xy[(k+1)%N],L=Math.hypot(Bq[0]-A[0],Bq[1]-A[1])||1,dx=(Bq[0]-A[0])/L,dy=(Bq[1]-A[1])/L,nx=-dy,ny=dx,mx=(A[0]+Bq[0])/2,my=(A[1]+Bq[1])/2;
    if(!inPoly([mx+nx*0.15,my+ny*0.15],p.xy)){nx=-nx;ny=-ny;}
    var za=Y3(p,A[0],A[1]),zb=Y3(p,Bq[0],Bq[1]),level=Math.abs(za-zb)/L<0.08,sh=shared(p,A,Bq);
    E.push({A:A,B:Bq,L:L,dx:dx,dy:dy,nx:nx,ny:ny,za:za,zb:zb,level:level,sh:sh,ins:sh?0:(level?0.25:0.06),low:level&&p.g>0.1&&(za+zb)/2<p.zm-zmin-0.05});}
   var wp=[],fa=[],gu=[];E.forEach(function(e,k){var pv=E[(k+N-1)%N],nxE=E[(k+1)%N];
    if(e.sh){var key=[Math.round(Math.min(e.A[0],e.B[0])*2),Math.round(Math.min(e.A[1],e.B[1])*2),Math.round(Math.max(e.A[0],e.B[0])*2),Math.round(Math.max(e.A[1],e.B[1])*2)].join('_');
     if(!caps[key]&&proc){caps[key]=1;var mx=(e.A[0]+e.B[0])/2,my=(e.A[1]+e.B[1])/2,zmid=(e.za+e.zb)/2;
      if(Y3(p,mx+e.nx*0.6,my+e.ny*0.6)<zmid-0.04){var va=new THREE.Vector3(e.A[0],e.za+0.03,-e.A[1]),vb=new THREE.Vector3(e.B[0],e.zb+0.03,-e.B[1]),len=va.distanceTo(vb),cm=new THREE.Mesh(new THREE.CylinderGeometry(0.075,0.075,len,10),rmat===photoMat?fasMat:new THREE.MeshStandardMaterial({color:new THREE.Color(p.kind==='tuile'?0x7d412d:0x24272c).multiply(rmat.color),roughness:0.65}));
       cm.position.copy(va).lerp(vb,0.5);cm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),vb.clone().sub(va).normalize());cm.castShadow=true;grp.add(cm);}}
     return;}
    var ta=pv.sh?0:pv.ins,tb=nxE.sh?0:nxE.ins;if(ta+tb>e.L-0.2){ta=tb=0;}
    var ax=e.A[0]+e.nx*e.ins+e.dx*ta,ay=e.A[1]+e.ny*e.ins+e.dy*ta,bx=e.B[0]+e.nx*e.ins-e.dx*tb,by=e.B[1]+e.ny*e.ins-e.dy*tb;
    quad(wp,[ax,Y3(p,ax,ay),-ay],[ax,gY(ax,ay),-ay],[bx,gY(bx,by),-by],[bx,Y3(p,bx,by),-by]);
    quad(fa,[e.A[0],e.za,-e.A[1]],[e.A[0],e.za-0.17,-e.A[1]],[e.B[0],e.zb-0.17,-e.B[1]],[e.B[0],e.zb,-e.B[1]]);
    if(e.low&&proc){var r=0.065,prevR=null;for(var q=0;q<=6;q++){var th=Math.PI*q/6,off=r*(1-Math.cos(th)),dz=-0.03-r*Math.sin(th),ra=[e.A[0]-e.nx*off,e.za+dz,-(e.A[1]-e.ny*off)],rb=[e.B[0]-e.nx*off,e.zb+dz,-(e.B[1]-e.ny*off)];if(prevR)quad(gu,prevR[0],ra,rb,prevR[1]);prevR=[ra,rb];}}});
   if(wp.length){var wm=meshOf(wp,wallMat,true);var wu=[],pa=wm.geometry.attributes.position;for(k=0;k<pa.count;k++)wu.push((pa.getX(k)+pa.getZ(k))/1.6,pa.getY(k)/1.6);wm.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(wu,2));wm.userData.pan=p.id;grp.add(wm);st.solids.push(wm);}
   if(fa.length)grp.add(meshOf(fa,fasMat,true));if(gu.length)grp.add(meshOf(gu,zincMat,true));
   var lp=[];p.xy.forEach(function(q){lp.push(q[0],Y3(p,q[0],q[1])+0.04,-q[1]);});lp.push(lp[0],lp[1],lp[2]);var lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));var ol=new THREE.Line(lg,new THREE.LineBasicMaterial({color:sel?0xfacc15:col,transparent:true,opacity:(sel||st.google||st.mode!=='view')?1:0.55}));ol.userData.outline=1;over.add(ol);
   // panneaux : vrais modules (cadre, cellules, verre) posés sur rails
   if(st.mode!=='edit')p.panels.forEach(function(q){var pvm=st.mode==='pv';if(q.off&&!pvm)return;var v=q.c.map(function(c){return new THREE.Vector3(c[0],Y3(p,c[0],c[1]),-c[1]);});
    var U=v[1].clone().sub(v[0]),W=v[3].clone().sub(v[0]),lu=U.length(),lw=W.length(),X=U.clone().normalize(),Yn=X.clone().cross(W.clone().normalize()).normalize();if(Yn.y<0)Yn.negate();var Z=X.clone().cross(Yn).normalize(),ctr=v[0].clone().add(v[2]).multiplyScalar(0.5);
    if(pvm?q.off:!q.used){if(st.pres)return;var g2=new THREE.BufferGeometry(),o=Yn.clone().multiplyScalar(0.07),w4=v.map(function(a){return a.clone().add(o);});g2.setAttribute('position',new THREE.Float32BufferAttribute([].concat(w4[0].toArray(),w4[1].toArray(),w4[2].toArray(),w4[0].toArray(),w4[2].toArray(),w4[3].toArray()),3));var gh=new THREE.Mesh(g2,pvm?qMat(p.id):ghostMat);if(pvm){gh.userData={pan:p.id,k:q.k,slot:1};st.pvHit.push(gh);}over.add(gh);
     var e=new THREE.BufferGeometry();e.setAttribute('position',new THREE.Float32BufferAttribute([].concat(w4[0].toArray(),w4[1].toArray(),w4[2].toArray(),w4[3].toArray(),w4[0].toArray()),3));over.add(new THREE.Line(e,fmat));return;}
    var bk=Math.round(lu*100)+'x'+Math.round(lw*100),bg=boxes[bk]||(boxes[bk]=new THREE.BoxGeometry(lu-0.02,0.035,lw-0.02)),land=lu>lw,gm=land?gL:gP;
    var pm=new THREE.Mesh(bg,[frameMat,frameMat,gm,frameMat,frameMat,frameMat]);pm.matrixAutoUpdate=false;pm.userData.base=ctr.clone().add(Yn.clone().multiplyScalar(0.075));pm.userData.n=Yn;pm.userData.X=X;pm.userData.Z=Z;setPanel(pm,0);pm.castShadow=true;pm.receiveShadow=true;over.add(pm);st.pmesh.push(pm);pm.userData.pan=p.id;pm.userData.k=q.k;if(pvm)st.pvHit.push(pm);if(st.pop&&st.pop===p.id+':'+q.k){st.pop=null;popAnim(pm);}
    pts.push(ctr.clone().add(Yn.clone().multiplyScalar(0.2)).add(new THREE.Vector3(0,st.google?st.dz:0,0)));});
   // poignées de modification
   if(st.mode==='edit'&&sel){p.xy.forEach(function(q,k){var on=st.selV===k;var sp=new THREE.Mesh(new THREE.SphereGeometry(1,18,12),new THREE.MeshBasicMaterial({color:on?0xfacc15:(k<2?0xf97316:0x2563eb),depthTest:false,transparent:true,opacity:0.95}));sp.renderOrder=10;sp.position.set(q[0],Y3(p,q[0],q[1])+0.05,-q[1]);sp.userData={pan:p.id,v:k,on:on};hg.add(sp);st.handles.push(sp);
     var r=p.xy[(k+1)%N],m=[(q[0]+r[0])/2,(q[1]+r[1])/2],ms=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0xffffff,depthTest:false,transparent:true,opacity:0.85}));ms.renderOrder=10;ms.position.set(m[0],Y3(p,m[0],m[1])+0.05,-m[1]);ms.userData={pan:p.id,mid:k+1,xy:m};hg.add(ms);st.handles.push(ms);});}});
  st.panelPts=pts;
  // tracé en cours
  if(st.draw.length){var dp=[];st.draw.forEach(function(q,k){var sp=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:k<2?0xf97316:0x2563eb,depthTest:false}));sp.renderOrder=10;sp.position.set(q[0],q[2]+0.05,-q[1]);sp.userData={dot:1};hg.add(sp);st.handles.push(sp);dp.push(q[0],q[2]+0.12,-q[1]);});
   if(dp.length>3){var dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(dp,3));var ln=new THREE.Line(dg,new THREE.LineBasicMaterial({color:0xfacc15,depthTest:false}));ln.renderOrder=11;over.add(ln);}}
  dims();
  if(first){var c=H.center();var hit=pick3(c[0],c[1]);var t=new THREE.Vector3(c[0],(hit!=null?hit:4)*0.6,-c[1]);st.ctl.target.copy(t);st.cam.position.set(t.x-70,t.y+150,t.z+170);var fk=fitK();fly(new THREE.Vector3(t.x-22*fk,t.y+17*fk,t.z+24*fk),t.clone(),2200);}
  tools();updSun();}
 function popAnim(pm){var t0=performance.now();(function f(){if(!st)return;var t=Math.min(1,(performance.now()-t0)/340),e=1-t;setPanel(pm,0.7*e*e*e);if(t<1)requestAnimationFrame(f);})();}
 function qMat(id){var s=st.pvs&&st.pvs.per[id],f=s?s.f:1,c=f>=0.9?0x22c55e:f>=0.78?0xfacc15:f>=0.62?0xf97316:0xef4444;if(!st.qm)st.qm={};return st.qm[c]||(st.qm[c]=new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:0.4,side:THREE.DoubleSide,depthWrite:false}));}
 function esc3(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
 function pvBar(){var s=st.pvs;if(!s||(!s.n&&st.mode!=='pv'))return '';var f=function(x,d){return (+x||0).toLocaleString('fr-BE',{minimumFractionDigits:d,maximumFractionDigits:d});};
  return '<div class="pvc3"><span><b>▦ '+s.n+'</b> panneaux</span><span><b>⚡ '+f(s.kwc,1)+'</b> kWc</span><span class="y"><b>☀️ ≈ '+f(s.kwh,0)+'</b> kWh/an</span>'+(st.mode==='pv'?'<i>cases : 🟩 très bien · 🟨 bien · 🟧 moyen · 🟥 faible</i>':'')+'</div>';}
 function setPanel(pm,lift){var u=pm.userData,p=u.base.clone().add(u.n.clone().multiplyScalar(lift));pm.matrix.makeBasis(u.X,u.n,u.Z).setPosition(p);pm.matrixWorldNeedsUpdate=true;}
 function pick3(x,y){var G=st.G,i=Math.round((x-G.x0)/G.step),j=Math.round((y-G.y0)/G.step);var v=(i>=0&&j>=0&&i<G.n&&j<G.n)?G.z[j*G.n+i]:null;return v==null?null:v-st.zmin;}
 function panById(id){return (st.plist||[]).find(function(p){return p.id===id;});}

 /* ---------- cotes et étiquettes (suivent la maquette) ---------- */
 function setLabels(list){var box=st.ov.querySelector('[data-v=labs]');while(st.labs.length>list.length)box.removeChild(st.labs.pop().el);
  list.forEach(function(L,i){var o=st.labs[i];if(!o){o={el:document.createElement('div')};o.el.style.cssText='position:absolute;left:0;top:0;white-space:nowrap;font:700 12px system-ui;padding:2px 7px;border-radius:9px;color:#fff;background:rgba(15,23,42,.86);box-shadow:0 1px 4px rgba(0,0,0,.4);will-change:transform';box.appendChild(o.el);st.labs.push(o);}
   o.v=L.v;if(o.t!==L.t){o.t=L.t;o.el.textContent=L.t;}var bg=L.big?'rgba(250,204,21,.95)':'rgba(15,23,42,.86)';if(o.bg!==bg){o.bg=bg;o.el.style.background=bg;o.el.style.color=L.big?'#111':'#fff';}});}
 function placeLabels(){if(!st.labs.length)return;var dy=st.over?st.over.position.y:0,v=new THREE.Vector3();st.labs.forEach(function(o){v.copy(o.v);v.y+=dy;v.project(st.cam);var ok=v.z<1&&Math.abs(v.x)<1.05&&Math.abs(v.y)<1.05;o.el.style.display=ok?'':'none';if(ok)o.el.style.transform='translate(-50%,-50%) translate('+((v.x+1)/2*st.w).toFixed(1)+'px,'+((1-v.y)/2*st.h).toFixed(1)+'px)';});}
 function edgeLabels(p,xy){var out=[],N=xy.length,zm=st.zmin;for(var k=0;k<N;k++){var a=xy[k],b=xy[(k+1)%N],za=p.z(a[0],a[1]),zb=p.z(b[0],b[1]),L=Math.hypot(b[0]-a[0],b[1]-a[1],zb-za);if(L<0.25)continue;out.push({v:new THREE.Vector3((a[0]+b[0])/2,(za+zb)/2-zm+0.15,-(a[1]+b[1])/2),t:fr2(L)+' m'});}return out;}
 function dims(dragXY){if(!st||st.pres)return;var L=[];
  if(st.mode==='draw'){for(var k=0;k+1<st.draw.length;k++){var a=st.draw[k],b=st.draw[k+1];L.push({v:new THREE.Vector3((a[0]+b[0])/2,(a[2]+b[2])/2+0.2,-(a[1]+b[1])/2),t:fr2(Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]))+' m'});}}
  else if(st.sel!=null){var p=panById(st.sel);if(p){L=edgeLabels(p,dragXY||p.xy);if(!dragXY)L.push({v:new THREE.Vector3(p.c0[0],p.z0-st.zmin+0.3,-p.c0[1]),t:(p.name||'Versant')+' · '+fr2(p.area,1)+' m² · '+fr2(p.tiltD,0)+'°',big:1});}}
  setLabels(L);}

 /* ---------- poignées : taille constante à l'écran, prise large au doigt ---------- */
 function sizeHandles(){if(!st.handles.length)return;var v=new THREE.Vector3();st.handles.forEach(function(h){h.getWorldPosition(v);var d=st.cam.position.distanceTo(v),u=h.userData;h.scale.setScalar(clamp(d*(u.mid!=null?0.0075:(u.on?0.015:0.012)),0.05,1.6));});}
 function hitHandle(cx,cy){var r=st.R.domElement.getBoundingClientRect(),best=null,bd=1e9,v=new THREE.Vector3();st.handles.forEach(function(h){if(h.userData.dot)return;h.getWorldPosition(v).project(st.cam);if(v.z>1)return;var sx=r.left+(v.x+1)/2*r.width,sy=r.top+(1-v.y)/2*r.height,lim=h.userData.mid!=null?15:30,d=Math.hypot(sx-cx,sy-cy)/lim;if(d<1&&d<bd){bd=d;best=h;}});return best;}
 function rayAt(cx,cy){var r=st.R.domElement.getBoundingClientRect(),m=new THREE.Vector2((cx-r.left)/r.width*2-1,-(cy-r.top)/r.height*2+1),rc=new THREE.Raycaster();rc.setFromCamera(m,st.cam);return rc;}

 /* ---------- loupe : zoom ×4 autour du point visé ---------- */
 function loupe(pt,cx,cy){var d=st.ov.querySelector('[data-v=loupe]');if(!pt){st.lp=null;d.style.display='none';return;}
  var tb=st.ov.querySelector('[data-ui=top]').offsetHeight+16,left=(cx<200&&cy<tb+190)?st.w-160:10,top=Math.max(8,Math.min(tb,st.h-160));st.lp={pt:pt,left:left,top:top};d.style.display='block';d.style.left=left+'px';d.style.top=top+'px';}
 function renderLoupe(){var L=st.lp,c=st.lcam,s=150,R=st.R;c.position.copy(st.cam.position);c.up.copy(st.cam.up);c.lookAt(L.pt);c.fov=clamp(s*st.cam.fov/(4*st.h),0.4,25);c.updateProjectionMatrix();
  if(st.hg)st.hg.visible=false;R.setScissorTest(true);R.setScissor(L.left,st.h-L.top-s,s,s);R.setViewport(L.left,st.h-L.top-s,s,s);R.render(st.S,c);R.setScissorTest(false);R.setViewport(0,0,st.w,st.h);if(st.hg)st.hg.visible=true;}

 /* ---------- aimant : coins voisins, équerre, bords des autres versants ---------- */
 function snapV(xy,skipPan,skipV){var best=null,bd=0.4;(st.plist||[]).forEach(function(p){p.xy.forEach(function(q,k){if(p.id===skipPan&&k===skipV)return;var d=Math.hypot(q[0]-xy[0],q[1]-xy[1]);if(d<bd){bd=d;best=q;}});});st.draw.forEach(function(q){var d=Math.hypot(q[0]-xy[0],q[1]-xy[1]);if(d<bd&&d>0.01){bd=d;best=[q[0],q[1]];}});return best?[best[0],best[1]]:null;}
 function square(xy,pts,k){var n=pts.length;if(n<3)return null;var P=pts[(k+n-1)%n],Nx=pts[(k+1)%n],ref=null,bl=0;
  for(var i=0;i<n;i++){var j=(i+1)%n;if(i===k||j===k)continue;var L=Math.hypot(pts[j][0]-pts[i][0],pts[j][1]-pts[i][1]),w=L*(i===0?3:1);if(L>0.3&&w>bl){bl=w;ref=[(pts[j][0]-pts[i][0])/L,(pts[j][1]-pts[i][1])/L];}}
  if(!ref)return null;var dirs=[ref,[-ref[1],ref[0]]],cons=[];
  [P,Nx].forEach(function(Q){var best=null,bd=0.22;dirs.forEach(function(d){var t=(xy[0]-Q[0])*d[0]+(xy[1]-Q[1])*d[1],px=Q[0]+d[0]*t,py=Q[1]+d[1]*t,dist=Math.hypot(xy[0]-px,xy[1]-py);if(dist<bd&&Math.abs(t)>0.3){bd=dist;best={Q:Q,d:d,pt:[px,py]};}});if(best)cons.push(best);});
  if(!cons.length)return null;if(cons.length===1)return cons[0].pt;
  var A=cons[0],B=cons[1],det=A.d[0]*B.d[1]-A.d[1]*B.d[0];if(Math.abs(det)<0.2)return A.pt;var t=((B.Q[0]-A.Q[0])*B.d[1]-(B.Q[1]-A.Q[1])*B.d[0])/det;return [A.Q[0]+A.d[0]*t,A.Q[1]+A.d[1]*t];}
 function snapE(xy,skipPan){var best=null,bd=0.25;(st.plist||[]).forEach(function(p){if(p.id===skipPan)return;for(var k=0;k<p.xy.length;k++){var a=p.xy[k],b=p.xy[(k+1)%p.xy.length],dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;if(L2<0.01)continue;var t=clamp(((xy[0]-a[0])*dx+(xy[1]-a[1])*dy)/L2,0,1),px=a[0]+dx*t,py=a[1]+dy*t,d=Math.hypot(xy[0]-px,xy[1]-py);if(d<bd){bd=d;best=[px,py];}}});return best;}
 function snap(xy,skipPan,skipV,pts){st.snapK='';if(!st.mag)return xy;var v=snapV(xy,skipPan,skipV);if(v){st.snapK='coin';return v;}
  if(pts){var s=square(xy,pts,skipV);if(s){st.snapK='équerre';return s;}}
  var e=snapE(xy,skipPan);if(e){st.snapK='bord';return e;}return xy;}

 /* ---------- déplacer un point en le glissant : il reste dans le plan du versant ---------- */
 function dragTo(cx,cy){var D=st.drag,p=panById(D.pan);if(!p)return;var rc=rayAt(cx,cy),O=rc.ray.origin,d=rc.ray.direction,off=st.google?st.dz:0;
  var den=d.y-p.a*d.x+p.b*d.z;if(Math.abs(den)<1e-4)return;var t=(p.z0-st.zmin+off+p.a*(O.x-p.c0[0])+p.b*(-O.z-p.c0[1])-O.y)/den;if(t<=0)return;
  var xy=[O.x+t*d.x,-(O.z+t*d.z)],q0=p.xy[D.k];if(Math.hypot(xy[0]-q0[0],xy[1]-q0[1])>60)return;
  xy=snap(xy,D.pan,D.k,p.xy);D.xy=xy;var y=p.z(xy[0],xy[1])-st.zmin;D.h.position.set(xy[0],y+0.05,-xy[1]);D.h.material.color.set(st.snapK?0x22c55e:0xfacc15);
  var nxy=p.xy.map(function(q,i){return i===D.k?xy:q;}),lp=[];nxy.forEach(function(q){lp.push(q[0],p.z(q[0],q[1])-st.zmin+0.06,-q[1]);});lp.push(lp[0],lp[1],lp[2]);
  if(!st.prev){st.prev=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0xfacc15,depthTest:false}));st.prev.renderOrder=11;st.over.add(st.prev);}
  st.prev.geometry.setAttribute('position',new THREE.Float32BufferAttribute(lp,3));st.prev.geometry.computeBoundingSphere();
  dims(nxy);loupe(new THREE.Vector3(xy[0],y+off,-xy[1]),cx,cy);say(st.snapK?'🧲 Aimant : '+st.snapK:'Glisse le point à sa place, relâche pour valider.');}
 /* ---------- toucher la maquette ---------- */
 function hitModel(cx,cy){var rc=rayAt(cx,cy),hits;
  hits=st.google?rc.intersectObjects(st.solids.filter(function(o){return o.userData.pan;}),false).concat(rc.intersectObject(st.tiles.group,true)).sort(function(a,b){return a.distance-b.distance;}):rc.intersectObjects(st.solids.concat([st.terrain]),false);
  if(st.google&&st.mode!=='view')hits=rc.intersectObject(st.tiles.group,true).concat(hits.filter(function(x){return x.object.userData&&x.object.userData.pan;}));
  return hits.length?hits[0]:null;}
 function aimAt(cx,cy){var h=hitModel(cx,cy);if(!h)return;st.aimHit=h;loupe(h.point.clone(),cx,cy);say('Visée à la loupe : glisse pour ajuster, relâche pour poser le point.');}
 function place(h){var P3=h.point,xy=snap([P3.x,-P3.z]);st.draw.push([xy[0],xy[1],P3.y-(st.google?st.dz:0)]);rebuild();say(st.draw.length<2?'Touche l’autre coin de la gouttière.':'Touche les autres coins du versant (faîte, rives), puis ✓ Terminer. Appui long = visée à la loupe.');}
 function tap(cx,cy){if(!st||!st.terrain||st.pres)return;
  if(st.mode==='pv'){var hp=rayAt(cx,cy).intersectObjects(st.pvHit||[],false);if(hp.length){var u=hp[0].object.userData,on=st.H.tog(u.pan,u.k);if(on==null)return;st.sel=u.pan;st.pop=on?u.pan+':'+u.k:null;rebuild();say(on?'➕ Panneau posé. Touche une autre case, ou ✨ Remplir pour tout le versant.':'➖ Panneau enlevé.');return;}
   var h0=hitModel(cx,cy),pid0=h0&&h0.object.userData&&h0.object.userData.pan;st.sel=pid0||null;rebuild();say(pid0?'Versant choisi : ✨ Remplir, 🧹 Vider, ou ↻ pour tourner les panneaux.':'Touche une case pour poser un panneau, ou un versant pour le choisir.');return;}
  if(st.mode==='edit'&&st.handles.length){var hh=hitHandle(cx,cy);if(hh){var u=hh.userData;if(u.mid!=null){st.H.insPt(u.pan,u.mid,u.xy);st.selV=u.mid;rebuild();return;}st.selV=u.v;rebuild();say('Point '+(u.v+1)+' choisi : glisse-le, touche sa bonne place, ou ajuste avec les flèches (5 cm).');return;}}
  var h=hitModel(cx,cy);if(!h)return;var P3=h.point,xy=[P3.x,-P3.z];
  if(st.mode==='draw'){place(h);return;}
  if(st.mode==='edit'&&st.sel!=null&&st.selV!=null){var p=panById(st.sel);st.H.movePt(st.sel,st.selV,snap(xy,st.sel,st.selV,p&&p.xy));rebuild();say('Point déplacé ✓. Choisis un autre point, ou ✓ Fini.');return;}
  var pid=h.object.userData&&h.object.userData.pan;st.sel=pid||null;st.selV=null;rebuild();if(pid)say('Versant sélectionné : ✥ Modifier ses points ou 🗑 le supprimer.');}
 function say(t){if(st)st.ov.querySelector('[data-v=info]').textContent=t;}
 function tools(){if(!st)return;var h='',B='class="btn s sm"',mg='<button data-v="mag" '+B+'>🧲 Aimant : '+(st.mag?'oui':'non')+'</button>';
  if(st.mode==='draw')h='<button data-v="undoD" '+B+'>↶ Point</button><button data-v="endD" class="btn sm g"'+(st.draw.length>=3?'':' disabled')+'>✓ Terminer</button>'+mg+'<button data-v="cancel" '+B+'>✕ Annuler</button>';
  else if(st.mode==='edit')h=(st.selV!=null?'<button data-v="nL" '+B+'>◀</button><button data-v="nU" '+B+'>▲</button><button data-v="nD" '+B+'>▼</button><button data-v="nR" '+B+'>▶</button><button data-v="delV" '+B+'>🗑 Ce point</button>':'')+mg+'<button data-v="undoE" '+B+'>↶</button><button data-v="endE" class="btn sm g">✓ Fini</button>';
  else if(st.mode==='pv'){var ps=st.pvs&&st.sel&&st.pvs.per[st.sel];h='<button data-v="pvFillAll" class="btn sm g">✨ Tout remplir</button><button data-v="pvClearAll" '+B+'>🧹 Tout vider</button>'+(ps?'<span class="pvsel">'+esc3(ps.name)+'</span><button data-v="pvFill" class="btn sm g">✨ Remplir</button><button data-v="pvClear" '+B+'>🧹 Vider</button><button data-v="pvOri" '+B+'>↻ '+(ps.orient==='paysage'?'En portrait':'En paysage')+'</button>':'')+'<button data-v="pvCalc" class="btn sm">📈 Calcul complet</button>';}
  else h=(st.H.gkey&&st.H.gkey()?'<button data-v="solar" class="btn sm">☀️ Versants Google</button>':'')+'<button data-v="startD" class="btn sm">✏️ Dessiner un versant</button>'+(st.sel?'<button data-v="startE" '+B+'>✥ Modifier</button><button data-v="delP" '+B+'>🗑 Supprimer</button>':'');
  h=pvBar()+h;var tb=st.ov.querySelector('[data-ui=top] [data-v=pv]');if(tb)tb.textContent=st.mode==='pv'?'✓ Panneaux posés':'▦ Poser les panneaux';
  st.ov.querySelector('[data-v=tools]').innerHTML=h;}

 /* ---------- caméra : déplacements fluides ---------- */
 function fitK(){return Math.max(1,0.8/(st.cam.aspect||1));}
 function fly(pos,tgt,ms,cb){if(!st)return;st.fly={p0:st.cam.position.clone(),t0:st.ctl.target.clone(),p1:pos,t1:tgt,s:performance.now(),ms:ms||900,cb:cb};}
 function sphLerp(a,b,k){var d=b.theta-a.theta;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;return new THREE.Spherical(a.radius+(b.radius-a.radius)*k,a.phi+(b.phi-a.phi)*k,a.theta+d*k);}
 function stepFly(now){var f=st.fly,k=ease(clamp((now-f.s)/f.ms,0,1)),tg=f.t0.clone().lerp(f.t1,k),a=new THREE.Spherical().setFromVector3(f.p0.clone().sub(f.t0)),b=new THREE.Spherical().setFromVector3(f.p1.clone().sub(f.t1));
  st.cam.position.setFromSpherical(sphLerp(a,b,k)).add(tg);st.ctl.target.copy(tg);if(k>=1){st.fly=null;if(f.cb)f.cb();}}
 function faceOn(p){var c=new THREE.Vector3(p.c0[0],p.z0-st.zmin+(st.google?st.dz:0),-p.c0[1]),rad=0;p.xy.forEach(function(q){rad=Math.max(rad,Math.hypot(q[0]-p.c0[0],q[1]-p.c0[1]));});
  var n=new THREE.Vector3(-p.a,1,p.b).normalize().add(new THREE.Vector3(0,0.7,0)).normalize();fly(c.clone().add(n.multiplyScalar(clamp(rad*1.3/(0.414*Math.min(1,st.cam.aspect||1)),10,160))),c,900);}

 /* ---------- 3D photo Google ---------- */
 function startGoogle(){var key=st.H.gkey&&st.H.gkey();if(!key){say('Pour la 3D photo de Google, colle ta clé Google dans ⚙️ Réglages (une seule fois).');return false;}
  if(!st.tiles){var T=new TilesRenderer('https://tile.googleapis.com/v1/3dtiles/root.json');T.registerPlugin(new GoogleCloudAuthPlugin({apiToken:key,autoRefreshToken:true}));
   var dl=new DRACOLoader();dl.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');T.registerPlugin(new GLTFExtensionsPlugin({dracoLoader:dl}));T.registerPlugin(new TileCompressionPlugin());
   T.registerPlugin(new ReorientationPlugin({lat:st.H.lat()*RAD,lon:st.H.lon()*RAD,height:st.zmin+45.5,up:'+y',recenter:true}));
   T.errorTarget=0.8;T.lruCache.minSize=1500;T.lruCache.maxSize=3000;T.setCamera(st.cam);T.setResolutionFromRenderer(st.cam,st.R);
   T.addEventListener('load-model',function(e){if(st)st.gOK=true;e.scene.traverse(function(c){if(c.material&&c.material.map){c.material.map.anisotropy=8;c.material.map.colorSpace=THREE.SRGBColorSpace;}});st.needAlign=true;});
   T.addEventListener('load-error',function(){if(!st||st.gFail)return;if(!st.gOK){st.gFail=true;if(st.google)ACT3.google();say('⚠ Google refuse la 3D photo (clé, ou « Map Tiles API » à activer dans ⚙️ Réglages) : je reste sur la maquette LiDAR.');return;}say('⚠ Google : une partie de la 3D photo n’a pas chargé.');});
   var wrap=new THREE.Group();wrap.rotation.y=Math.PI;wrap.add(T.group);st.S.add(wrap);st.tiles=T;st.wrap=wrap;st.dz=0;st.aligned=0;
   st.alignT=setInterval(align,1500);}
  return true;}
 function align(){if(!st||!st.tiles||!st.needAlign)return;st.needAlign=false;var c=st.H.center(),rc=new THREE.Raycaster(),d=[];
  for(var a=-4;a<=4;a+=2)for(var b=-4;b<=4;b+=2){var x=c[0]+a,y=c[1]+b,lz=pick3(x,y);if(lz==null)continue;rc.set(new THREE.Vector3(x,800,-y),new THREE.Vector3(0,-1,0));var h=rc.intersectObject(st.tiles.group,true);if(h.length)d.push(h[0].point.y-lz);}
  if(d.length<5)return;d.sort(function(p,q){return p-q;});var dz=d[Math.floor(d.length/2)];if(Math.abs(dz-st.dz)>0.05){st.dz=dz;if(st.over)st.over.position.y=st.google?dz:0;}st.aligned++;
  if(st.aligned>8&&st.alignT){clearInterval(st.alignT);st.alignT=null;}var at=st.tiles.getAttributions?st.tiles.getAttributions().filter(function(x){return x.type==='string';}).map(function(x){return x.value;}).join(' · '):'';st.ov.querySelector('[data-v=attr]').textContent='Google'+(at?' · '+at:'');}

 /* ---------- présentation « 3D scroll » : la molette / le doigt fait avancer l'histoire ---------- */
 var STEPS=[['01 — Votre toit','Votre toit en 3D'],['02 — Le relevé','Chaque versant mesuré'],['03 — L’installation','Vos panneaux, posés'],['04 — L’ensoleillement','Le soleil sur votre toit']];
 function presText(i){var L=st.plist||[],S=0,mn=99,mx=0,n=st.pmesh.length;L.forEach(function(p){S+=p.area;mn=Math.min(mn,p.tiltD);mx=Math.max(mx,p.tiltD);});var wc=0;try{wc=(typeof MOD==='function'&&MOD().wc)||0;}catch(e){}
  if(i===0)return 'Maquette construite à partir du relevé LiDAR de la Wallonie et de la photo aérienne 2026.';
  if(i===1)return L.length?L.length+' versant'+(L.length>1?'s':'')+' · '+fr2(S,1)+' m² de toiture · pente'+(L.length>1&&mx-mn>1?'s de '+fr2(mn,0)+'° à '+fr2(mx,0)+'°':' de '+fr2(mx,0)+'°'):'Les versants ne sont pas encore dessinés.';
  if(i===2)return n?n+' panneau'+(n>1?'x':'')+(wc?' · '+fr2(n*wc/1000,2)+' kWc':'')+', placés sur les versants les mieux exposés.':'Les panneaux ne sont pas encore placés.';
  return st.pres&&st.pres.sunTxt||'';}
 function presStart(){var L=st.plist||[],b=[1e9,1e9,-1e9,-1e9],zt=0,main=null,mc=-1;st.mode='view';st.sel=null;st.selV=null;st.draw=[];if(st.play){clearInterval(st.play);st.play=null;st.ov.querySelector('[data-v=play]').textContent='▶ Journée';}
  st.pres={p:0,pt:0,idx:-1,idle:performance.now(),sunT:0,sunTxt:''};rebuild();
  L.forEach(function(p){var c=p.panels.filter(function(q){return q.used;}).length*1000+p.area;if(c>mc){mc=c;main=p;}zt=Math.max(zt,p.zm-st.zmin);p.xy.forEach(function(q){b[0]=Math.min(b[0],q[0]);b[1]=Math.min(b[1],q[1]);b[2]=Math.max(b[2],q[0]);b[3]=Math.max(b[3],q[1]);});});
  var c=L.length?[(b[0]+b[2])/2,(b[1]+b[3])/2]:st.H.center(),rad=L.length?Math.hypot(b[2]-b[0],b[3]-b[1])/2:8,T=new THREE.Vector3(c[0],(zt||4)*0.6+(st.google?st.dz:0),-c[1]);
  var th=main&&main.g>0.03?Math.atan2(-main.a/main.g,main.b/main.g):0.6;
  var fk=fitK();st.pres.T=T;st.pres.K=[{th:th+0.95,ph:1.08,r:(rad*3.6+16)*fk},{th:th+0.3,ph:0.3,r:(rad*3.0+12)*fk},{th:th-0.2,ph:1.16,r:(rad*1.9+7)*fk},{th:th-1.5,ph:1.02,r:(rad*3.2+13)*fk}];
  st.ctl.enabled=false;['top','tools','info'].forEach(function(k){st.ov.querySelector('[data-ui='+k+']').style.display='none';});st.ov.querySelector('[data-v=presUI]').style.display='block';
  // on rejoint la première vue en douceur
  var k0=st.pres.K[0];st.pres.hold=true;fly(new THREE.Vector3().setFromSpherical(new THREE.Spherical(k0.r,k0.ph,k0.th)).add(T),T.clone(),1200,function(){if(st&&st.pres)st.pres.hold=false;});}
 function presEnd(){if(!st.pres)return;st.pres=null;st.ctl.enabled=true;['top','tools','info'].forEach(function(k){st.ov.querySelector('[data-ui='+k+']').style.display='';});st.ov.querySelector('[data-v=presUI]').style.display='none';st.ov.querySelector('[data-v=hour]').value=13;st.pmesh.forEach(function(m){m.visible=true;setPanel(m,0);});setLabels([]);rebuild();}
 function stepPres(now){var P=st.pres,ui=st.ov,dt=Math.min(0.25,(now-(P.last||now))/1000);P.last=now;if(!P.sw&&now-P.idle>900){var r=Math.round(P.pt);P.pt+=(r-P.pt)*(1-Math.exp(-dt*3.5));}
  P.p+=(P.pt-P.p)*(1-Math.exp(-dt*4.2));var p=P.p,seg=Math.min(2,Math.floor(p)),f=sstep(p-seg),A=P.K[seg],Bk=P.K[seg+1];
  if(!P.hold){var s=sphLerp(new THREE.Spherical(A.r,A.ph,A.th),new THREE.Spherical(Bk.r,Bk.ph,Bk.th),f);s.theta+=Math.sin(now/5200)*0.035;st.cam.position.setFromSpherical(s).add(P.T);st.ctl.target.copy(P.T);st.cam.lookAt(P.T);}
  // panneaux : ils arrivent un à un entre l'étape 2 et l'étape 3
  var n=st.pmesh.length,rv=clamp((p-1.25)/0.65,0,1)*n;st.pmesh.forEach(function(m,i){var e=clamp(rv-i,0,1);m.visible=e>0;if(e>0)setPanel(m,(1-(1-Math.pow(1-e,3)))*1.4);});
  // soleil : la journée défile à la dernière étape
  var hr=ui.querySelector('[data-v=hour]'),hv=p>2?7.5+(p-2)*12:13;if(Math.abs(+hr.value-hv)>0.02){hr.value=hv;var sp=sunAt();if(now-P.sunT>350){P.sunT=now;var c=shade(sp);P.sunTxt=ui.querySelector('[data-v=hl]').textContent.replace(':',' h ')+' · '+(sp.el<=0?'soleil couché':(st.panelPts.length?(st.panelPts.length-c)+' panneau'+(st.panelPts.length-c>1?'x':'')+' sur '+st.panelPts.length+' au soleil':'ombres portées en temps réel'))+' ('+ui.querySelector('[data-v=date]').selectedOptions[0].textContent+')';if(P.idx===3)ui.querySelector('[data-v=ps]').textContent=P.sunTxt;}}
  var i=Math.round(p),o=clamp(1-Math.abs(p-i)*2.6,0,1),box=ui.querySelector('[data-v=presUI]');
  if(i!==P.idx){P.idx=i;ui.querySelector('[data-v=pk]').textContent=STEPS[i][0];ui.querySelector('[data-v=pt]').textContent=STEPS[i][1];ui.querySelector('[data-v=ps]').textContent=presText(i)||'Faites défiler pour voir la journée passer sur le toit.';ui.querySelector('[data-v=pNext]').textContent=i===3?'↺ Revoir':'Suite ›';
   setLabels(i===1?(st.plist||[]).map(function(q){return {v:new THREE.Vector3(q.c0[0],q.z0-st.zmin+0.4,-q.c0[1]),t:fr2(q.area,1)+' m² · '+fr2(q.tiltD,0)+'°',big:1};}):[]);}
  ['pk','pt','ps'].forEach(function(k,j){var e=ui.querySelector('[data-v='+k+']');e.style.opacity=o;e.style.transform='translateY('+((1-o)*(14+j*8)).toFixed(1)+'px)';});
  st.ov.querySelector('[data-v=labs]').style.opacity=i===1?o:1;box.querySelector('[data-v=pbar] i').style.width=(p/3*100).toFixed(1)+'%';}

 var ACT3={
  google:function(){if(!st.google){if(!startGoogle())return;st.google=true;if(st.wrap)st.wrap.visible=true;var t=st.ctl.target;fly(new THREE.Vector3(t.x-9,t.y+20,t.z+24),t.clone(),900);st.R.toneMapping=THREE.NoToneMapping;say('3D photo de Google : chargement… Tu peux dessiner et déplacer les points directement dessus.');}else{st.google=false;st.R.toneMapping=THREE.ACESFilmicToneMapping;if(st.wrap)st.wrap.visible=false;st.ov.querySelector('[data-v=attr]').textContent='';say('Maquette LiDAR.');}
   var b=st.ov.querySelector('[data-v=google]');b.classList.toggle('on',st.google);rebuild();},
  roof:function(){var o=['auto','photo','ardoise','tuile'],n={auto:'auto',photo:'photo',ardoise:'ardoises',tuile:'tuiles'};st.roof=o[(o.indexOf(st.roof)+1)%4];st.ov.querySelector('[data-v=roof]').textContent='🏠 Toit : '+n[st.roof];rebuild();},
  mag:function(){st.mag=!st.mag;tools();say(st.mag?'🧲 Aimant activé : coins voisins, équerre et bords des autres versants.':'Aimant coupé : pose libre.');},
  pres:function(){if(!st.G)return;presStart();},pExit:function(){presEnd();},
  pv:function(){if(!st.G)return;if(st.mode==='pv'){st.mode='view';st.sel=null;rebuild();updSun();return;}st.mode='pv';st.draw=[];st.selV=null;rebuild();say('▦ Touche une case pour poser un panneau, touche un panneau pour l’enlever. Couleur des cases : vert = très bon soleil, rouge = faible.');},
  pvFillAll:function(){st.H.fill(null);rebuild();say(st.pvs&&st.pvs.n?'✨ Les versants bien exposés sont remplis. Touche un panneau pour l’enlever.':'Aucun versant bien exposé : choisis un versant puis ✨ Remplir.');},
  pvClearAll:function(){st.H.clear(null);rebuild();say('🧹 Tous les panneaux sont enlevés.');},
  pvFill:function(){if(st.sel){st.H.fill(st.sel);rebuild();}},
  pvClear:function(){if(st.sel){st.H.clear(st.sel);rebuild();}},
  pvOri:function(){if(st.sel){var o=st.H.orient(st.sel);rebuild();if(o)say('↻ Panneaux en '+o+'.');}},
  pvCalc:function(){var H=st.H;close();if(H.calc)H.calc();},
  pNext:function(){var P=st.pres;if(!P)return;P.pt=Math.round(P.pt)>=3?0:Math.round(P.pt)+1;P.idle=performance.now();},
  pPrev:function(){var P=st.pres;if(!P)return;P.pt=Math.max(0,Math.round(P.pt)-1);P.idle=performance.now();},
  solar:function(){say('☀️ Google Solar analyse le toit…');var c=st.ctl.target;st.H.solar([c.x,-c.z]).then(function(list){if(!st)return;if(list&&list.length){st.sel=list[0].id;rebuild();say('☀️ '+list.length+' versant(s) trouvé(s) par Google Solar. Touche un toit puis ✥ Modifier pour ajuster.');}else say('Pas de nouveau versant trouvé (voir le message en bas de l’écran).');});},
  startD:function(){st.mode='draw';st.draw=[];st.sel=null;rebuild();say('Touche un coin de la gouttière (bas du versant). Appui long = visée précise à la loupe. Fais tourner la vue entre deux points si besoin.');},
  undoD:function(){st.draw.pop();rebuild();},
  cancel:function(){st.mode='view';st.draw=[];rebuild();say('Dessin annulé.');},
  endD:function(){if(st.draw.length<3)return;var xy=st.draw.map(function(q){return [q[0],q[1]];});st.mode='view';st.draw=[];say('Mesure de la pente et découpe au faîte…');
   st.H.addPan(xy).then(function(list){if(!st)return;st.sel=list&&list[0]?list[0].id:null;rebuild();say(list&&list.length>1?'Tracé coupé en '+list.length+' versants au faîte ✓':'Versant ajouté ✓ (pente '+(list&&list[0]?list[0].tilt:'?')+'°)');});},
  startE:function(){if(!st.sel)return;st.mode='edit';st.selV=null;rebuild();var p=panById(st.sel);if(p)faceOn(p);say('Glisse un point (rond bleu ou orange) avec le doigt : la loupe montre l’endroit exact. Les petits ronds blancs ajoutent un point.');},
  endE:function(){st.mode='view';st.selV=null;rebuild();say('Modifications enregistrées ✓');},
  undoE:function(){st.H.undo();st.selV=null;rebuild();},
  delV:function(){if(st.selV==null)return;if(!st.H.delPt(st.sel,st.selV)){say('Il faut au moins 3 points.');return;}st.selV=null;rebuild();},
  delP:function(){if(!st.sel||!confirm('Supprimer ce versant ?'))return;st.H.delPan(st.sel);st.sel=null;rebuild();say('Versant supprimé.');},
  nL:function(){nudge(-1,0);},nR:function(){nudge(1,0);},nU:function(){nudge(0,1);},nD:function(){nudge(0,-1);}
 };
 /* flèches : 5 cm, dans le sens de l'écran */
 function nudge(dx,dy){var p=panById(st.sel);if(!p||st.selV==null||!p.xy[st.selV])return;var q=st.cam.quaternion,r=new THREE.Vector3(1,0,0).applyQuaternion(q),u=new THREE.Vector3(0,1,0).applyQuaternion(q),rx=r.x,ry=-r.z,ux=u.x,uy=-u.z,lr=Math.hypot(rx,ry)||1,lu=Math.hypot(ux,uy);
  if(lu<0.25){var d=new THREE.Vector3();st.cam.getWorldDirection(d);ux=d.x;uy=-d.z;lu=Math.hypot(ux,uy)||1;}
  var o=p.xy[st.selV],xy=[o[0]+(rx/lr*dx+ux/lu*dy)*0.05,o[1]+(ry/lr*dx+uy/lu*dy)*0.05];st.H.movePt(st.sel,st.selV,xy);rebuild();say('Point décalé de 5 cm.');}

 /* ---------- soleil ---------- */
 function sunAt(){var ov=st.ov,hr=+ov.querySelector('[data-v=hour]').value,dv=ov.querySelector('[data-v=date]').value,now=new Date(),m,d;
  if(dv==='now'){m=now.getMonth();d=now.getDate();}else{m=+dv.split('-')[0];d=+dv.split('-')[1];}
  var y=new Date().getFullYear(),loc=Date.UTC(y,m,d,Math.floor(hr),Math.round((hr%1)*60)),guess=loc-3600000;if(bxl(guess).h!==Math.floor(hr))guess=loc-7200000;
  var sp=sunPos(guess,st.H.lat(),st.H.lon());ov.querySelector('[data-v=hl]').textContent=Math.floor(hr)+':'+String(Math.round((hr%1)*60)%60).padStart(2,'0');
  var t=st.ctl.target,D=150,el=sp.el*RAD,az=sp.az*RAD,dir=new THREE.Vector3(Math.cos(el)*Math.sin(az),Math.sin(el),-Math.cos(el)*Math.cos(az));
  st.sun.target.position.copy(t);st.sun.position.copy(t).addScaledVector(dir,D);
  var day=sstep((sp.el+5)/13),low=1-sstep(sp.el/28);st.sun.intensity=sp.el>0?2.3*sstep(sp.el/6):0;st.sun.color.setRGB(1,0.957-0.22*low,0.867-0.5*low);
  st.hemi.intensity=0.2+0.8*day;st.sky.material.uniforms.sun.value.copy(dir);st.sky.material.uniforms.day.value=day;
  var fc=new THREE.Color(0x0f1420).lerp(new THREE.Color(0xbfd7ee),day);st.S.fog.color.copy(fc);st.S.background.copy(fc);if('environmentIntensity' in st.S)st.S.environmentIntensity=0.1+0.75*day;
  st.sunDir=dir;return sp;}
 function shade(sp){if(sp.el<=0)return st.panelPts.length;var rc=new THREE.Raycaster(),sh=0;st.panelPts.forEach(function(p){rc.set(p,st.sunDir);rc.far=500;if((st.google?rc.intersectObject(st.tiles.group,true):rc.intersectObjects([st.terrain].concat(st.solids),false)).length)sh++;});return sh;}
 function updSun(){if(!st)return;var sp=sunAt();
  if(!st.terrain||st.mode!=='view'||st.pres)return;
  if(sp.el<=0){say('Soleil couché ('+Math.round(sp.el)+'°).');return;}
  var sh=shade(sp);
  say('Soleil : hauteur '+Math.round(sp.el)+'°, direction '+Math.round(sp.az)+'° · '+(st.panelPts.length?(sh+' / '+st.panelPts.length+' panneaux à l’ombre'):'aucun panneau')+'. Un doigt : tourner · deux doigts : zoomer · toucher un toit : le choisir.');}
 function close(){if(!st)return;cancelAnimationFrame(st.raf);clearTimeout(st.lpT);if(st.alignT)clearInterval(st.alignT);if(st.tiles)try{st.tiles.dispose();}catch(e){}if(st.play)clearInterval(st.play);window.removeEventListener('resize',st.resize);window.removeEventListener('keydown',st.key);st.R.dispose();st.ov.remove();st=null;}
 return {open:open,close:close,_st:function(){return st;}};})();
