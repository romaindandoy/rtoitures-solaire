(function(){
'use strict';
/* ================= Données ================= */
var TXT={cgv:'Nos conditions générales de vente, remises avec le présent document, font partie du contrat. Paiement à 30 jours. Client professionnel : intérêt de retard au taux de la loi du 2 août 2002 et indemnité forfaitaire de 10 % (minimum 40 €), de plein droit. Client consommateur : premier rappel gratuit ; à défaut de paiement 14 jours après ce rappel, intérêts et indemnité dans les limites du Livre XIX du Code de droit économique. Contrat conclu hors établissement ou à distance : droit de rétractation de 14 jours (voir conditions générales).',acompteTxt:'Acompte de 40% à payer avant le début des travaux pour la commande des marchandises, 30% à la moitié du travail et le reste est payable à date de la facture.',reserveTxt:'RÉSERVE DE PROPRIÉTÉ : les marchandises restent notre propriété jusqu’au paiement complet du prix.'};
/* coordonnées de l'entreprise : jamais dans le code, seulement dans les réglages de l'appareil (et la synchro chiffrée) */
function CO(){var c=(DB&&DB.company)||{};return Object.assign({name:'',owner:'',address:'',vat:'',iban:'',bic:'',email:'',phone:'',facebook:'',logo:''},TXT,c);}
var DEF={
 prices:{mods:[{n:'Panneau monocristallin 450 Wc full black',wc:450,L:1.762,W:1.134,p:135,g:-0.0034},{n:'Panneau monocristallin 500 Wc full black',wc:500,L:1.961,W:1.134,p:152,g:-0.0030},{n:'Panneau monocristallin 430 Wc full black',wc:430,L:1.722,W:1.134,p:128,g:-0.0034}],
  struct:55,pose:70,invBase:900,invKva:120,hybrid:350,micro:150,batKwh:550,batFix:800,elec:450,rgie:350,chantier:250},
 tariff:{type:'bi',hp:0.40,hc:0.29,mono:0.36,eco:0.25,med:0.33,pic:0.45,inj:0.03,prosumer:false,prosRate:85.84},
 fin:{infl:2,deg:0.4,disc:3,invYear:13,batYear:15,batRep:50,maint:0,loss:10,bats:'5,10'},
 seq:2
};
var TESTMODE=/\/test\//.test(location.pathname),LS=TESTMODE?'rts_test_v1':'rts_v1',DB;
function clone(o){return JSON.parse(JSON.stringify(o));}
function load(){try{DB=JSON.parse(localStorage.getItem(LS)||(TESTMODE?localStorage.getItem('rts_v1'):null)||'null');}catch(e){DB=null;}
 if(!DB)DB={studies:[]};['prices','tariff','fin'].forEach(function(k){DB[k]=Object.assign(clone(DEF[k]),DB[k]||{});});if(!DB.seq)DB.seq=DEF.seq;if(!DB.studies)DB.studies=[];if(!DB.company)DB.company={};}
var saveT=null;function save(){clearTimeout(saveT);saveT=setTimeout(saveNow,300);}
function saveNow(noSync){if(P){P.upd=Date.now();var i=DB.studies.findIndex(function(s){return s.id===P.id;});if(i<0)DB.studies.unshift(P);else DB.studies[i]=P;}
 try{localStorage.setItem(LS,JSON.stringify(DB));}catch(e){toast('⚠ Mémoire du navigateur pleine : exporte puis supprime d’anciennes études');}if(!noSync)Sync.later();}
/* ================= Synchronisation PC ↔ téléphone (gist GitHub privé) ================= */
var Sync=(function(){var KEY=TESTMODE?'rts_test_sync':'rts_sync',FILE='rts-chiffre.json',DESC='rts-sync-v2 (donnees chiffrees, ne pas supprimer)',busy=false,tmr=null,last=0,status='',kc={};
 function b64(u){var s='';u=new Uint8Array(u);for(var i=0;i<u.length;i++)s+=String.fromCharCode(u[i]);return btoa(s);}
 function ub64(t){var s=atob(t),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u;}
 function key(pass,salt){var k=pass+'|'+b64(salt);if(kc[k])return kc[k];var e=new TextEncoder();
  kc[k]=crypto.subtle.importKey('raw',e.encode(pass),'PBKDF2',false,['deriveKey']).then(function(m){return crypto.subtle.deriveKey({name:'PBKDF2',salt:salt,iterations:210000,hash:'SHA-256'},m,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);});return kc[k];}
 function enc(obj){var c=cfg(),salt=c.salt?ub64(c.salt):crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
  return key(c.pass,salt).then(function(k){return crypto.subtle.encrypt({name:'AES-GCM',iv:iv},k,new TextEncoder().encode(JSON.stringify(obj)));}).then(function(ct){return JSON.stringify({v:2,salt:b64(salt),iv:b64(iv),ct:b64(ct)});});}
 function dec(box){var c=cfg(),salt=ub64(box.salt);return key(c.pass,salt).then(function(k){return crypto.subtle.decrypt({name:'AES-GCM',iv:ub64(box.iv)},k,ub64(box.ct));}).then(function(pt){if(!c.salt){c.salt=box.salt;setCfg(c);}return JSON.parse(new TextDecoder().decode(pt));},function(){throw new Error('Mot de passe de synchro différent de celui de ton autre appareil : rien n’a été envoyé');});}
 function cfg(){try{return JSON.parse(localStorage.getItem(KEY)||'null')||{};}catch(e){return {};}}
 function setCfg(c){try{localStorage.setItem(KEY,JSON.stringify(c));}catch(e){}}
 function api(path,opt){var c=cfg();opt=opt||{};opt.headers=Object.assign({'Authorization':'Bearer '+c.token,'Accept':'application/vnd.github+json'},opt.headers||{});
  return fetch('https://api.github.com'+path,opt).then(function(r){if(r.status===401)throw new Error('Clé GitHub refusée (expirée ou mauvaise)');if(!r.ok)throw new Error('GitHub '+r.status);return r.status===204?null:r.json();});}
 function findGist(){var c=cfg();if(c.gist)return Promise.resolve(c.gist);
  return api('/gists?per_page=100').then(function(L){var g=(L||[]).find(function(x){return x.description===DESC&&x.files&&x.files[FILE];});if(g){c.gist=g.id;setCfg(c);return g.id;}
   return enc(pack(DB)).then(function(content){return api('/gists',{method:'POST',body:JSON.stringify({description:DESC,public:false,files:{[FILE]:{content:content}}})});}).then(function(n){c.gist=n.id;setCfg(c);c.fresh=true;return n.id;});});}
 function pack(D){return {v:1,studies:D.studies,deleted:D.deleted||{},prices:D.prices,tariff:D.tariff,fin:D.fin,company:D.company||{},seq:D.seq,setUpd:D.setUpd||0};}
 function readRemote(id){return api('/gists/'+id).then(function(g){var f=g.files[FILE];if(!f)return null;return (f.truncated?fetch(f.raw_url).then(function(r){return r.text();}):Promise.resolve(f.content)).then(function(t){var box;try{box=JSON.parse(t);}catch(e){return null;}if(!box||box.v!==2)return null;return dec(box);});});}
 function merge(L,R){var out={deleted:Object.assign({},R.deleted||{})},ch=false;Object.keys(L.deleted||{}).forEach(function(k){out.deleted[k]=Math.max(out.deleted[k]||0,L.deleted[k]);});
  var map={};(R.studies||[]).forEach(function(s){map[s.id]=s;});(L.studies||[]).forEach(function(s){var r=map[s.id];if(!r||(s.upd||0)>(r.upd||0))map[s.id]=s;});
  out.studies=Object.keys(map).map(function(k){return map[k];}).filter(function(s){return !(out.deleted[s.id]>=(s.upd||0));}).sort(function(a,b){return (b.upd||0)-(a.upd||0);});
  var useL=(L.setUpd||0)>=(R.setUpd||0);['prices','tariff','fin','company'].forEach(function(k){out[k]=(useL?L[k]:R[k])||L[k];});out.setUpd=Math.max(L.setUpd||0,R.setUpd||0);out.seq=Math.max(+L.seq||0,+R.seq||0);return out;}
 function same(a,b){return JSON.stringify(pack(a))===JSON.stringify(pack(b));}
 function run(force){var c=cfg();if(!c.token||!c.pass||busy)return Promise.resolve();if(!window.crypto||!crypto.subtle){show('⚠ Ce navigateur ne sait pas chiffrer : synchro coupée');return Promise.resolve();}busy=true;show('⏳ Synchronisation…');
  return findGist().then(function(id){return readRemote(id).then(function(R){
   var before=JSON.stringify(pack(DB)),M=R?merge(DB,R):pack(DB);
   var curId=P&&P.id,curOld=P?JSON.stringify(P):'';
   DB.studies=M.studies;DB.deleted=M.deleted;DB.prices=M.prices;DB.tariff=M.tariff;DB.fin=M.fin;DB.company=M.company||{};DB.seq=M.seq;DB.setUpd=M.setUpd;
   if(JSON.stringify(pack(DB))!==before){var np=DB.studies.find(function(x){return x.id===curId;});
    if(P&&!np){P=DB.studies[0]||newStudy();onRemote(true);}else if(np&&JSON.stringify(np)!==curOld){P=np;onRemote(false);}else onRemote(null);
    try{localStorage.setItem(LS,JSON.stringify(DB));}catch(e){}}
   if(!R||!same(DB,R))return enc(pack(DB)).then(function(content){return api('/gists/'+id,{method:'PATCH',body:JSON.stringify({files:{[FILE]:{content:content}}})});});});})
  .then(function(){last=Date.now();show('✓ Synchronisé à '+new Date().toLocaleTimeString('fr-BE',{hour:'2-digit',minute:'2-digit'}));})
  .catch(function(e){show('⚠ '+(e&&e.message||'Synchro impossible (internet ?)'));if(e&&/404/.test(e.message)){var c2=cfg();delete c2.gist;setCfg(c2);}})
  .then(function(){busy=false;});}
 function show(t){status=t;var e=document.getElementById('syncst');if(e)e.textContent=t;var d=document.getElementById('syncdot');if(d)d.textContent=/✓/.test(t)?'☁️✓':/⚠/.test(t)?'☁️⚠':'☁️…';}
 function later(){if(!cfg().token)return;clearTimeout(tmr);tmr=setTimeout(run,2500);}
 function start(){if(!cfg().token)return;run();setInterval(function(){if(document.visibilityState==='visible'&&Date.now()-last>15000)run();},5000);document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')run();});}
 return {run:run,later:later,start:start,cfg:cfg,setCfg:setCfg,status:function(){return status;},on:function(){return !!cfg().token;}};})();
function onRemote(changedStudy){RES=null;GRID=null;if(changedStudy!==null){selPan=null;if(mode!=='idle'){mode='idle';drawPts=null;drawLayer.clearLayers();editLayer.clearLayers();stat();}drawPans();}render();if(changedStudy!==null)toast('🔄 Mis à jour depuis ton autre appareil');}
function uid(){return Math.random().toString(36).slice(2,9);}
function newStudy(){return {link:{ref:'',site:'',code:''},id:uid(),created:new Date().toISOString().slice(0,10),client:{name:'',addr:'',email:'',gsm:'',vat:6,phase:'mono'},lat:50.2935,lon:5.0960,zoom:14,pans:[],modIdx:0,
 cons:{annual:3500,profile:'actif',pac:0,vekm:0,vewin:'nuit',flex:0,real:null,realInfo:''},choice:null,devis:{num:'',date:new Date().toISOString().slice(0,10),lines:null,sig:null,sigName:'',sigDate:'',sigTime:'',sigPlace:''}};}
var P;
/* ================= Utilitaires ================= */
function $(s,r){return (r||document).querySelector(s);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function nf(v,d){return (+v||0).toLocaleString('fr-BE',{minimumFractionDigits:d||0,maximumFractionDigits:d||0});}
function eur(v){return nf(Math.round(v))+' €';}
function r2(v){return Math.round((+v||0)*100)/100;}
function pct(v){return Math.round((v||0)*100)+' %';}
function toast(m,ms){var t=$('#toast');t.textContent=m;t.style.display='block';clearTimeout(t._t);t._t=setTimeout(function(){t.style.display='none';},ms||2600);}
function getP(o,path){return path.split('.').reduce(function(a,k){return a==null?a:a[k];},o);}
function setP(o,path,v){var ks=path.split('.'),last=ks.pop(),t=ks.reduce(function(a,k){return a[k];},o);t[last]=v;}
var COLORS=['#f97316','#2563eb','#16a34a','#9333ea','#dc2626','#0891b2','#ca8a04','#db2777'];
function compass(a){var n=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];return n[Math.round(((a%360)+360)%360/22.5)%16];}
/* ================= Géométrie locale ================= */
function L0(){return {lat:P.lat,lon:P.lon,kx:111320*Math.cos(P.lat*RAD),ky:110540};}
function toXY(ll,o){o=o||L0();return [(ll[1]-o.lon)*o.kx,(ll[0]-o.lat)*o.ky];}
function toLL(xy,o){o=o||L0();return [o.lat+xy[1]/o.ky,o.lon+xy[0]/o.kx];}
function polyArea(pts){var a=0;for(var i=0;i<pts.length;i++){var p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function centroid(pts){var x=0,y=0;pts.forEach(function(p){x+=p[0];y+=p[1];});return [x/pts.length,y/pts.length];}
function inPoly(pt,pts){var c=false;for(var i=0,j=pts.length-1;i<pts.length;j=i++){var a=pts[i],b=pts[j];if(((a[1]>pt[1])!==(b[1]>pt[1]))&&(pt[0]<(b[0]-a[0])*(pt[1]-a[1])/(b[1]-a[1])+a[0]))c=!c;}return c;}
function segDist(p,a,b){var dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));var x=a[0]+t*dx-p[0],y=a[1]+t*dy-p[1];return Math.sqrt(x*x+y*y);}
/* repère du pan : e = le long de la gouttière, n = vers le bas de pente (horizontal) */
function panFrame(pan){var o=L0(),xy=pan.pts.map(function(p){return toXY(p,o);}),p0=xy[0],p1=xy[1],ex=p1[0]-p0[0],ey=p1[1]-p0[1],l=Math.hypot(ex,ey)||1;ex/=l;ey/=l;
 var nx=ey,ny=-ex,c=centroid(xy);if((c[0]-p0[0])*nx+(c[1]-p0[1])*ny>0){nx=-nx;ny=-ny;}
 return {o:o,xy:xy,p0:p0,e:[ex,ey],n:[nx,ny],az:((Math.atan2(nx,ny)*DEG)+360)%360};}
function panUS(fr,pt,ct){var dx=pt[0]-fr.p0[0],dy=pt[1]-fr.p0[1];return [dx*fr.e[0]+dy*fr.e[1],-(dx*fr.n[0]+dy*fr.n[1])/ct];}
function usToLL(fr,u,s,ct){var h=s*ct;return toLL([fr.p0[0]+fr.e[0]*u-fr.n[0]*h,fr.p0[1]+fr.e[1]*u-fr.n[1]*h],fr.o);}
function panStats(pan){var fr=panFrame(pan),a=polyArea(fr.xy);return {plan:a,real:a/Math.cos((pan.tilt||0)*RAD),az:fr.az};}
/* ================= Calepinage automatique ================= */
function MOD(){return DB.prices.mods[P.modIdx||0]||DB.prices.mods[0];}
function layout(pan){
 var m=MOD(),fr=panFrame(pan),ct=Math.cos((pan.tilt||30)*RAD),poly=fr.xy.map(function(p){return panUS(fr,p,ct);});
 var pw=pan.orient==='paysage'?m.L:m.W,ph=pan.orient==='paysage'?m.W:m.L,gap=0.02,mg=+pan.margin||0.4;
 var umin=1e9,umax=-1e9,smin=1e9,smax=-1e9;poly.forEach(function(p){umin=Math.min(umin,p[0]);umax=Math.max(umax,p[0]);smin=Math.min(smin,p[1]);smax=Math.max(smax,p[1]);});
 function ok(u,s){var cs=[[u,s],[u+pw,s],[u,s+ph],[u+pw,s+ph]];for(var k=0;k<4;k++){if(!inPoly(cs[k],poly))return false;for(var e=0;e<poly.length;e++)if(segDist(cs[k],poly[e],poly[(e+1)%poly.length])<mg-1e-6)return false;}return true;}
 var best=[];
 for(var ou=0;ou<pw+gap;ou+=0.1)for(var os=0;os<ph+gap;os+=0.25){var res=[];
  for(var s=smin+mg+os;s+ph<=smax-mg+1e-9;s+=ph+gap)for(var u=umin+mg+ou;u+pw<=umax-mg+1e-9;u+=pw+gap)if(ok(u,s))res.push({u:r2(u),s:r2(s),on:true});
  if(res.length>best.length)best=res;}
 pan.panels=best;pan.pw=pw;pan.ph=ph;
}
/* ================= Carte ================= */
var DELALL=null,map,layers,layerI=0,relief=null,panLayer,drawLayer,editLayer,drawPts=null,mode='idle',selPan=null,selV=null,curTab='toit';
var ArcTiles=L.TileLayer.extend({getTileUrl:function(c){var R=6378137,w=2*Math.PI*R/Math.pow(2,c.z+(this.options.zoomOffset||0)),x0=-Math.PI*R+c.x*w,y1=Math.PI*R-c.y*w;
 var sz=this.options.tileSize||256;return GEO+this.options.svc+'/MapServer/export?bbox='+[x0,y1-w,x0+w,y1].map(function(v){return v.toFixed(2);}).join(',')+'&bboxSR=3857&imageSR=3857&size='+sz+','+sz+'&format='+(this.options.fmt||'jpg')+'&transparent=true&f=image';}});
/* tuiles 512 px (4 fois moins de requêtes), zoom natif plafonné à la vraie finesse des photos (25 cm), nouvel essai si une tuile échoue */
function arc(svc,o){var l=new ArcTiles('',Object.assign({svc:svc,tileSize:512,zoomOffset:-1,maxZoom:23,maxNativeZoom:20,keepBuffer:4,updateWhenZooming:false,crossOrigin:false},o||{}));
 l.on('tileerror',function(e){var t=e.tile;t._r=(t._r||0)+1;if(t._r<=2)setTimeout(function(){t.src=l.getTileUrl(e.coords)+'&essai='+t._r;},600*t._r);});return l;}
function initMap(){
 map=L.map('map',{zoomControl:false,attributionControl:true,maxZoom:23,tap:false}).setView([P.lat,P.lon],P.zoom||14);
 L.control.zoom({position:'topright'}).addTo(map);
 layers=[
  {n:'Photo aérienne Wallonie – avril 2026',l:arc('IMAGERIE/ORTHO_2026_PRINTEMPS',{attribution:'© SPW 2026'})},
  {n:'Photo aérienne Wallonie – 2024',l:arc('IMAGERIE/ORTHO_2024',{attribution:'© SPW 2024'})}];
 layers[0].l.addTo(map);
 relief=arc('RELIEF/WALLONIE_MNS_2021_2022_HILLSHADE',{opacity:0.55,fmt:'png'});
 panLayer=L.layerGroup().addTo(map);drawLayer=L.layerGroup().addTo(map);editLayer=L.layerGroup().addTo(map);
 map.on('click',function(e){if(mode==='solar'){mode='idle';tools();solarAt([e.latlng.lat,e.latlng.lng]);return;}if(mode==='pick'){mode='idle';tools();ACT.detectAt([e.latlng.lat,e.latlng.lng]);return;}if(mode==='draw'){addPt([e.latlng.lat,e.latlng.lng]);}else if(selV!=null&&mode==='edit'){selV=null;drawEdit();tools();}});
 map.on('move',function(){if(mode==='draw'){loupeShow(map.getCenter());var lb=$('#mlen');if(lb&&drawPts&&drawPts.length){var c=map.getCenter();lb.textContent=nf(edgeLen(drawPts[drawPts.length-1],[c.lat,c.lng]),2)+' m';lb.style.display='block';}}});
 map.on('moveend',function(){if(P){var c=map.getCenter();P.mlat=c.lat;P.mlon=c.lng;P.zoom=map.getZoom();}});
}
function cross(on){$('#cross').style.display=on?'block':'none';}
var loupe=null,loupeL=null,ORTHO=true;
function loupeShow(ll){var el=$('#loupe');if(!ll){el.style.display='none';return;}el.style.display='block';$('#mstat').style.display='none';
 if(!loupe){loupe=L.map('loupemap',{zoomControl:false,attributionControl:false,dragging:false,touchZoom:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,maxZoom:24});}
 var base=layers[layerI];if(loupeL!==base){if(loupeL&&loupeL._lp)loupe.removeLayer(loupeL._lp);var lp=arc(base.l.options.svc,{maxZoom:24});lp.addTo(loupe);base._lp=lp;loupeL=base;}
 loupe.invalidateSize();loupe.setView(ll,Math.min(24,map.getZoom()+2),{animate:false});
 if(!loupe._ov){loupe._ov=L.layerGroup().addTo(loupe);}loupe._ov.clearLayers();
 var p=selPan&&P.pans.find(function(x){return x.id===selPan;}),src=mode==='draw'?drawPts:(p?p.pts:null);if(src&&src.length>1)L.polygon(src,{color:'#facc15',weight:2,fill:false,interactive:false}).addTo(loupe._ov);}
function loupeAuto(){if(mode==='draw')loupeShow(map.getCenter());else if(mode==='edit'&&selV!=null){var p=P.pans.find(function(x){return x.id===selPan;});if(p&&p.pts[selV])loupeShow(p.pts[selV]);}else loupeShow(null);}
/* équerre : redresse un point si une arête est presque parallèle/perpendiculaire à la gouttière */
var SQUARE=true;
function squareFix(p,k){if(!SQUARE||p.pts.length<3)return;var o=L0(),xy=p.pts.map(function(q){return toXY(q,o);}),n=xy.length;
 var e0=xy[0],e1=xy[1];if(k<=1){var opp=k===0?2:n-1;}var ex=e1[0]-e0[0],ey=e1[1]-e0[1],l=Math.hypot(ex,ey);if(l<0.5)return;ex/=l;ey/=l;
 var dirs=[[ex,ey],[-ey,ex]],c=xy[k],lines=[];
 [(k-1+n)%n,(k+1)%n].forEach(function(nb){if((k===0&&nb===1)||(k===1&&nb===0))return;var a=xy[nb],dx=c[0]-a[0],dy=c[1]-a[1],L=Math.hypot(dx,dy);if(L<0.3)return;
  dirs.forEach(function(d){var cos=Math.abs((dx*d[0]+dy*d[1])/L);if(cos>Math.cos(4*RAD))lines.push({a:a,d:d});});});
 if(!lines.length)return;var np;
 if(lines.length>=2){var A=lines[0],B=lines[1],den=A.d[0]*B.d[1]-A.d[1]*B.d[0];if(Math.abs(den)>0.2){var t=((B.a[0]-A.a[0])*B.d[1]-(B.a[1]-A.a[1])*B.d[0])/den;np=[A.a[0]+A.d[0]*t,A.a[1]+A.d[1]*t];}}
 if(!np){var A2=lines[0],t2=(c[0]-A2.a[0])*A2.d[0]+(c[1]-A2.a[1])*A2.d[1];np=[A2.a[0]+A2.d[0]*t2,A2.a[1]+A2.d[1]*t2];}
 if(Math.hypot(np[0]-c[0],np[1]-c[1])<0.6)p.pts[k]=toLL(np,o);}
var HIST=[];function pushHist(p){HIST.push({id:p.id,pts:JSON.parse(JSON.stringify(p.pts))});if(HIST.length>60)HIST.shift();}
function edgeLen(a,b){var o=L0(),A=toXY(a,o),B=toXY(b,o);return Math.hypot(B[0]-A[0],B[1]-A[1]);}
function stat(m){var s=$('#mstat');if(!m){s.style.display='none';return;}s.innerHTML=m;s.style.display='block';}
/* aimantation : sommet existant le plus proche (< 16 px) */
function snap(ll,skipPan,skipIdx){var pt=map.latLngToContainerPoint(ll),best=null,bd=16;
 P.pans.forEach(function(p){p.pts.forEach(function(q,k){if(p.id===skipPan&&k===skipIdx)return;var d=pt.distanceTo(map.latLngToContainerPoint(q));if(d<bd){bd=d;best=q;}});});
 if(drawPts)drawPts.forEach(function(q,k){if(k===drawPts.length-1)return;var d=pt.distanceTo(map.latLngToContainerPoint(q));if(d<bd&&k!==0){bd=d;best=q;}});
 return best?[best[0],best[1]]:ll;}
function addPt(ll){var lb=$('#mlen');if(lb)lb.style.display='none';ll=snap(ll);if(drawPts.length>=3){var f=map.latLngToContainerPoint(drawPts[0]);if(f.distanceTo(map.latLngToContainerPoint(ll))<16){ACT.endDraw();return;}}drawPts.push(ll);drawRedraw();}
function drawRedraw(){drawLayer.clearLayers();if(!drawPts)return;
 drawPts.forEach(function(p,i){L.circleMarker(p,{radius:i<2?7:5,color:'#fff',weight:2,fillColor:i<2?'#f97316':'#2563eb',fillOpacity:1,interactive:false}).addTo(drawLayer);});
 if(drawPts.length){var cc=map.getCenter(),last=drawPts[drawPts.length-1];L.polyline([last,[cc.lat,cc.lng]],{color:'#facc15',weight:2,dashArray:'4 4',interactive:false}).addTo(drawLayer);}
 if(drawPts.length>1){L.polyline(drawPts.slice(0,2),{color:'#f97316',weight:5,interactive:false}).addTo(drawLayer);L.polyline(drawPts.slice(1),{color:'#2563eb',weight:3,dashArray:'6 4',interactive:false}).addTo(drawLayer);}
 stat(drawPts.length<2?'Place le <b>viseur ✛</b> sur un coin de la <b>gouttière</b> (bas du versant) et touche <b>＋ Point</b>. Puis l’autre coin de la gouttière.':'Ensuite les autres coins du versant (faîte, rives), puis <b>✓ Terminer</b>. Les points s’aimantent aux coins des autres versants.');
 tools();}
/* édition : sommets déplaçables du pan sélectionné */
function drawEdit(){editLayer.clearLayers();if(mode!=='edit'||!selPan)return;var p=P.pans.find(function(x){return x.id===selPan;});if(!p)return;
 p.pts.forEach(function(q,k){var sel=selV===k;var m=L.marker(q,{draggable:true,autoPan:true,zIndexOffset:1000,icon:L.divIcon({className:'',iconSize:[30,30],iconAnchor:[15,15],html:'<div class="vtx'+(sel?' on':'')+(k<2?' eave':'')+'"></div>'})});
  m.on('click',function(e){L.DomEvent.stop(e);selV=k;drawEdit();tools();loupeAuto();});
  m.on('dragstart',function(){pushHist(p);});
  m.on('drag',function(e){var ll=e.target.getLatLng();p.pts[k]=[ll.lat,ll.lng];drawPans(true);loupeShow(ll);});
  m.on('dragend',function(e){var ll=e.target.getLatLng(),sn=snap([ll.lat,ll.lng],p.id,k);p.pts[k]=sn;if(sn[0]===ll.lat&&sn[1]===ll.lng)squareFix(p,k);selV=k;afterGeom(p);loupeAuto();});m.addTo(editLayer);});
 for(var k=0;k<p.pts.length;k++){(function(k){var a=p.pts[k],b=p.pts[(k+1)%p.pts.length],mid=[(a[0]+b[0])/2,(a[1]+b[1])/2];
  L.marker(mid,{icon:L.divIcon({className:'',iconSize:[22,22],iconAnchor:[11,11],html:'<div class="vmid">+</div><div class="elen">'+nf(edgeLen(a,b),2)+' m</div>'})}).on('click',function(e){L.DomEvent.stop(e);pushHist(p);p.pts.splice(k+1,0,mid);selV=k+1;afterGeom(p);loupeAuto();}).addTo(editLayer);})(k);}}
function afterGeom(p){p.az=Math.round(panFrame(p).az);if(GRID)fitFromGrid(p);layout(p);p.horizon=p.horizon||null;dirty();save();drawPans();drawEdit();render();}
function drawPans(light){panLayer.clearLayers();if(!P)return;
 P.pans.forEach(function(pan,i){var sel=selPan===pan.id;
  var poly=L.polygon(pan.pts,{color:pan.color,weight:sel?4:2,fillOpacity:curTab==='pv'?0.06:0.22,interactive:mode!=='draw'});poly.on('click',function(e){if(mode==='draw')return;L.DomEvent.stop(e);selPan=pan.id;if(mode==='edit'){selV=null;drawEdit();}drawPans();render();});poly.addTo(panLayer);
  L.polyline(pan.pts.slice(0,2),{color:pan.color,weight:6,opacity:.9,interactive:false}).addTo(panLayer);
  if(!light&&pan.panels&&pan.panels.length&&pan.tilt!=null&&mode!=='edit'){var fr=panFrame(pan),ct=Math.cos(pan.tilt*RAD);
   pan.panels.forEach(function(pp){var c=[usToLL(fr,pp.u,pp.s,ct),usToLL(fr,pp.u+pan.pw,pp.s,ct),usToLL(fr,pp.u+pan.pw,pp.s+pan.ph,ct),usToLL(fr,pp.u,pp.s+pan.ph,ct)];
    var r=L.polygon(c,{color:pp.on?'#e7e5e4':'#ef4444',weight:1,fillColor:pp.on?'#0f172a':'#fff',fillOpacity:pp.on?0.85:0.25,dashArray:pp.on?null:'3 3',interactive:mode!=='draw'});
    r.on('click',function(e){if(mode==='draw')return;L.DomEvent.stop(e);if(curTab!=='pv'){selPan=pan.id;drawPans();render();return;}pp.on=!pp.on;dirty();save();drawPans();render();});r.addTo(panLayer);});}
  var cc=centroid(pan.pts);L.marker(cc,{icon:L.divIcon({className:'',html:'<div style="background:'+pan.color+';color:#fff;font:700 12px system-ui;border-radius:7px;padding:1px 6px;white-space:nowrap;transform:translate(-50%,-50%);display:inline-block">'+esc(pan.name)+'</div>'}),interactive:false}).addTo(panLayer);
 });}
function tools(){var h='';
 if(mode==='draw')h='<button class="btn sm" data-a="ptHere">＋ Point</button><button class="btn s sm" data-a="undoPt">↶</button><button class="btn sm g" data-a="endDraw"'+(drawPts&&drawPts.length>=3?'':' disabled')+'>✓ Terminer</button><button class="btn s sm" data-a="cancelDraw">✕</button>';
 else if(mode==='edit')h=(selV!=null?'<div class="nudge"><button data-a="nudge" data-d="0,1">▲</button><button data-a="nudge" data-d="-1,0">◀</button><button data-a="nudge" data-d="1,0">▶</button><button data-a="nudge" data-d="0,-1">▼</button></div><button class="btn sm" data-a="vHere">📍 Au viseur</button><button class="btn s sm" data-a="vDel">🗑</button>':'<span class="btn s sm" style="pointer-events:none">Touche ou glisse un point</span>')+'<button class="btn s sm" data-a="undo"'+(HIST.length?'':' disabled')+'>↶</button><button class="btn s sm'+(SQUARE?' on':'')+'" data-a="square">⟂</button><button class="btn sm g" data-a="endEdit">✓ Fini</button>';
 else if(mode==='pick')h='<button class="btn s sm" data-a="detect">✕ Annuler</button>';
 else if(mode==='solar')h='<button class="btn s sm" data-a="solar">✕ Annuler</button>';
 else if(curTab==='toit')h=(gkey()?'<button class="btn sm" data-a="solar">☀️ Google Solar</button>':'')+'<button class="btn sm" data-a="detect">🪄 Détecter le toit</button><button class="btn sm" data-a="startDraw">✏️ Dessiner</button>'+(selPan?'<button class="btn s sm" data-a="startEdit">✥ Modifier</button><button class="btn s sm" data-a="delSel">🗑</button>':'')+(P.pans.length?'<button class="btn s sm" data-a="fit">⤢</button>':'')+(P.pans.length>1?'<button class="btn s sm" data-a="delAll">🗑 Tout effacer</button>':'')+(DELALL&&DELALL.id===P.id&&!P.pans.length?'<button class="btn sm" data-a="undoAll">↶ Remettre les versants</button>':'');
 else if(curTab==='pv')h='<button class="btn sm" data-a="relayout">↻ Recalepiner</button><span class="btn s sm" style="pointer-events:none">Touche un panneau pour l’enlever</span>';
 $('#maptools').innerHTML=h;cross(mode==='draw'||(mode==='edit'&&selV!=null));loupeAuto();}
function fit(){if(!P.pans.length)return;var b=L.latLngBounds([]);P.pans.forEach(function(p){p.pts.forEach(function(q){b.extend(q);});});map.fitBounds(b,{padding:[40,40],maxZoom:21});}
/* ================= Services en ligne ================= */
function geocode(q){
 return fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=be&limit=5&addressdetails=1&q='+encodeURIComponent(q),{headers:{'Accept-Language':'fr'}}).then(function(r){return r.json();});}
/* grille LiDAR en mémoire (repère de l'étude) */
var GRID=null;
function getGrid(cx,cy,half,step,onProg){var o=L0();
 if(GRID&&GRID.lat===o.lat&&GRID.lon===o.lon&&GRID.step<=step&&cx-half>=GRID.x0-0.01&&cy-half>=GRID.y0-0.01&&cx+half<=GRID.x0+(GRID.n-1)*GRID.step+0.01&&cy+half<=GRID.y0+(GRID.n-1)*GRID.step+0.01)return Promise.resolve(GRID);
 return lidarGrid(o,cx,cy,half,step,true,onProg).then(function(G){G.lat=o.lat;G.lon=o.lon;if(G.z.filter(function(v){return v!=null;}).length>G.z.length*0.3)GRID=G;return G;});}
function gridAt(x,y){var G=GRID;if(!G)return null;var i=Math.round((x-G.x0)/G.step),j=Math.round((y-G.y0)/G.step);return gZ(G,i,j);}
/* pente/orientation d'un versant à partir des points LiDAR à l'intérieur */
function fitFromPts(pan,A){var fr=panFrame(pan);
 if(A.length<6){pan.lidar={st:'ko',msg:'Relevé LiDAR inaccessible ici : indique la pente à la main.'};return;}
 var f=fitPlane(A);if(!f){pan.lidar={st:'ko',msg:'Calcul de pente impossible.'};return;}
 // 2e passe : on écarte les points aberrants (cheminée, arbre)
 var A2=A.filter(function(p){return Math.abs(p[2]-(f.a*p[0]+f.b*p[1]+f.c))<Math.max(0.25,2.5*f.rms);});if(A2.length>=6){var f2=fitPlane(A2);if(f2)f=f2;}
 var dAz=Math.abs(((f.az-fr.az+540)%360)-180);
 pan.plane={a:f.a,b:f.b,c:f.c,lat:L0().lat,lon:L0().lon};pan.lidar={st:'ok',tilt:r2(f.tilt),az:Math.round(f.az),rms:r2(f.rms),n:A.length,dAz:Math.round(dAz)};
 if(f.rms<0.45&&f.tilt<=70){pan.tilt=f.tilt<3?0:Math.round(f.tilt*10)/10;pan.tiltSrc='lidar';if(f.tilt<3)pan.lidar.msg='Toit plat : panneaux posés à plat dans l’étude (sur supports inclinés, la production serait un peu meilleure).';}else pan.lidar.msg='Mesure peu fiable (arbre, lucarne, toit très découpé ?) : vérifie la pente.';}
function innerPts(pan,step){var fr=panFrame(pan),c=centroid(fr.xy),inner=fr.xy.map(function(p){return [c[0]+(p[0]-c[0])*0.8,c[1]+(p[1]-c[1])*0.8];});
 var xs=inner.map(function(p){return p[0];}),ys=inner.map(function(p){return p[1];}),x0=Math.min.apply(0,xs),x1=Math.max.apply(0,xs),y0=Math.min.apply(0,ys),y1=Math.max.apply(0,ys),pts=[];
 step=step||Math.max(0.5,Math.sqrt((x1-x0)*(y1-y0)/300));for(var x=x0;x<=x1;x+=step)for(var y=y0;y<=y1;y+=step)if(inPoly([x,y],inner))pts.push([x,y]);return {fr:fr,pts:pts,c:c};}
function fitFromGrid(pan){var I=innerPts(pan,GRID.step),A=[];I.pts.forEach(function(p){var z=gridAt(p[0],p[1]);if(z!=null)A.push([p[0],p[1],z]);});if(A.length>=6)fitFromPts(pan,A);}
function lidarTilt(pan){var I=innerPts(pan);pan.lidar={st:'run'};render();
 return lidarBatch('WALLONIE_MNS_2021_2022',I.pts.map(function(p){return toLL(p,I.fr.o);})).then(function(z){var A=[];I.pts.forEach(function(p,i){if(z[i]!=null)A.push([p[0],p[1],z[i]]);});fitFromPts(pan,A);});}
function panZ(pan,x,y){var pl=pan.plane;if(pl){var o=L0(),dx=(pl.lon-o.lon)*o.kx,dy=(pl.lat-o.lat)*o.ky;return pl.a*(x+dx)+pl.b*(y+dy)+pl.c;}return null;}
/* ligne d'horizon (ombrages proches et lointains) depuis le centre du pan */
var HZ_N=36,HZ_D=[3,4.5,6,8,10.5,13.5,17,21,26,33,42,55,70,90,115,150,200,270,360,500,700,1000,1500,2200];
function horizonScan(pan){var fr=panFrame(pan),c=centroid(fr.xy),pts=[],meta=[];pan.hz={st:'run',p:0};render();
 var z0=panZ(pan,c[0],c[1]);
 for(var a=0;a<HZ_N;a++){var az=a*360/HZ_N;HZ_D.forEach(function(d){var x=c[0]+Math.sin(az*RAD)*d,y=c[1]+Math.cos(az*RAD)*d;if(inPoly([x,y],fr.xy))return;meta.push([a,d]);pts.push(toLL([x,y],fr.o));});}
 var p0=z0!=null?Promise.resolve(z0):lidarBatch('WALLONIE_MNS_2021_2022',[toLL(c,fr.o)]).then(function(r){return r[0];});
 return p0.then(function(z0){if(z0==null){pan.hz={st:'ko',msg:'Relevé LiDAR inaccessible : ombrages non calculés.'};return;}
  return lidarBatch('WALLONIE_MNS_2021_2022',pts,function(f){pan.hz.p=f;var b=$('#hzp'+pan.id);if(b)b.style.width=Math.round(f*100)+'%';}).then(function(z){
   var hz=new Array(HZ_N).fill(0),ok=0;z.forEach(function(v,i){if(v==null)return;ok++;var d=meta[i][1],e=Math.atan((v-(z0+0.3)-d*d/(2*6371000)*0.87)/d)*DEG;if(e>hz[meta[i][0]])hz[meta[i][0]]=e;});
   if(ok<pts.length*0.5){pan.hz={st:'ko',msg:'Trop de points LiDAR manquants : ombrages non calculés.'};pan.horizon=null;return;}
   pan.horizon=hz.map(function(v){return Math.round(Math.min(80,v)*10)/10;});pan.hz={st:'ok'};});});}
/* météo heure par heure : Open-Meteo (5 années réelles) */
var W=null,WK='';
function weatherKey(){return P.lat.toFixed(2)+','+P.lon.toFixed(2);}
function getWeather(){var k=weatherKey();if(W&&WK===k)return Promise.resolve(W);
 try{var c=JSON.parse(localStorage.getItem('rts_w')||'null');if(c&&c.k===k){W=unpackW(c);WK=k;return Promise.resolve(W);}}catch(e){}
 var u='https://archive-api.open-meteo.com/v1/archive?latitude='+P.lat.toFixed(4)+'&longitude='+P.lon.toFixed(4)+'&start_date=2021-01-01&end_date=2025-12-31&hourly=shortwave_radiation,direct_normal_irradiance,diffuse_radiation,temperature_2m&timezone=GMT&timeformat=unixtime';
 return fetch(u).then(function(r){if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}).then(function(j){var h=j.hourly;
  W={t:h.time.map(function(x){return x+3600;}),ghi:h.shortwave_radiation.map(nz),dni:h.direct_normal_irradiance.map(nz),dhi:h.diffuse_radiation.map(nz),ta:h.temperature_2m.map(function(v){return v==null?10:v;}),lat:P.lat,lon:P.lon,src:''};var yy={};W.t.forEach(function(x,i){if(i%720===0)yy[new Date(x*1000).getUTCFullYear()]=1;});var ks=Object.keys(yy);W.src='Open-Meteo (réanalyse ERA5) '+ks[0]+(ks.length>1?'-'+ks[ks.length-1]:'');
  WK=k;try{localStorage.setItem('rts_w',JSON.stringify(packW(W,k)));}catch(e){}return W;})
 .catch(function(){W=synthWeather(P.lat,P.lon);W.src='Moyennes climatiques belges (hors ligne)';WK=k;toast('Météo en ligne indisponible : moyennes belges utilisées',4000);return W;});}
function nz(v){return v==null||v<0?0:v;}
function packW(w,k){return {k:k,src:w.src,t0:w.t[0],n:w.t.length,g:w.ghi.map(Math.round),b:w.dni.map(Math.round),d:w.dhi.map(Math.round),a:w.ta.map(function(v){return Math.round(v*10);})};}
function unpackW(c){var t=[];for(var i=0;i<c.n;i++)t.push(c.t0+i*3600);return {t:t,ghi:c.g,dni:c.b,dhi:c.d,ta:c.a.map(function(v){return v/10;}),lat:+c.k.split(',')[0],lon:+c.k.split(',')[1],src:c.src};}
/* ================= Calcul de l'étude ================= */
var RES=null,specCache={};
function dirty(){RES=null;}
function onPanels(){var L=[];P.pans.forEach(function(p){(p.panels||[]).forEach(function(q){if(q.on)L.push(p);});});return L;}
function invSize(kwc){if(P&&P.client.phase!=='tri'){var s0=invSize0(kwc);return Math.min(5,s0);}return invSize0(kwc);}
function invSize0(kwc){var S=[1.5,2,2.5,3,3.68,4,5,6,8,10,12,15,20];var t=kwc*0.87;for(var i=0;i<S.length;i++)if(S[i]>=t)return S[i];return Math.ceil(t);}
function specFor(pan){var m=MOD(),key=[WK,pan.tilt,Math.round(pan.az),(pan.horizon||[]).join('|'),m.g,DB.fin.loss].join('/');if(specCache[pan.id]&&specCache[pan.id].k===key)return specCache[pan.id].v;
 W.loss=(+DB.fin.loss||10)/100;var v=panSeries(W,{tilt:pan.tilt,az:pan.az,horizon:pan.horizon},{gamma:m.g});specCache[pan.id]={k:key,v:v};return v;}
function costLines(n,bat,micro){var pr=DB.prices,m=MOD(),kwc=n*m.wc/1000,kva=invSize(kwc),L=[];
 L.push({t:'titre',d:'Installation photovoltaïque de '+nf(kwc,2)+' kWc'});
 L.push({d:'Fourniture de panneaux photovoltaïques : '+m.n+' ('+m.wc+' Wc, '+nf(m.L*1000)+' × '+nf(m.W*1000)+' mm) – garantie produit et performance fabricant',u:'pce',q:n,p:pr.mods[P.modIdx||0].p});
 L.push({d:'Système de fixation pour toiture inclinée : crochets inox adaptés à la couverture, rails aluminium, visserie',u:'pce',q:n,p:pr.struct});
 L.push({d:'Pose des panneaux, adaptation de la couverture au droit des crochets, passage des câbles et étanchéité des traversées',u:'pce',q:n,p:pr.pose});
 if(micro)L.push({d:'Micro-onduleurs (un par panneau) avec passerelle de suivi de production',u:'pce',q:n,p:pr.micro});
 else L.push({d:'Onduleur '+(bat?'hybride ':'')+nf(kva,kva%1?2:0)+' kVA '+(kva>5?'triphasé':'monophasé')+' avec suivi de production sur smartphone',u:'pce',q:1,p:r2(+pr.invBase+pr.invKva*kva+(bat?+pr.hybrid:0))});
 if(bat)L.push({d:'Batterie de stockage lithium LFP '+nf(bat,1)+' kWh utiles, installation et paramétrage',u:'pce',q:1,p:r2(pr.batKwh*bat+(+pr.batFix))});
 L.push({d:'Câblage DC et AC, coffret de protection, parafoudre et sectionneur',u:'forfait',q:1,p:pr.elec});
 L.push({d:'Raccordement au tableau, mise en service, contrôle RGIE par un organisme agréé et démarches auprès du gestionnaire de réseau',u:'forfait',q:1,p:pr.rgie});
 L.push({d:'Installation de chantier et protections collectives en toiture',u:'forfait',q:1,p:pr.chantier});
 return L;}
function linesHT(L){return r2(L.reduce(function(a,l){return a+(+l.q||0)*(+l.p||0);},0));}
function runScenario(n,bat,micro){var m=MOD(),ord=RES.order,kwcPan={},left=n;
 ord.forEach(function(o){var take=Math.min(left,o.count);kwcPan[o.id]=take*m.wc/1000;left-=take;});
 var nn=W.t.length,prod=new Float32Array(nn),kwc=n*m.wc/1000,kva=invSize(kwc);
 ord.forEach(function(o){var k=kwcPan[o.id];if(!k)return;var sp=RES.spec[o.id];for(var i=0;i<nn;i++)prod[i]+=sp[i]*k;});
 if(!micro)for(var i=0;i<nn;i++)if(prod[i]>kva)prod[i]=kva;
 var A=simulate(W,prod,RES.cons,{bat:bat,flex:+P.cons.flex||0},DB.tariff);
 var fee=DB.tariff.prosumer?(+DB.tariff.prosRate||0)*kva:0;
 var L=costLines(n,bat,micro),ht=linesHT(L),vat=+P.client.vat||6,inv=ht*(1+vat/100);
 var save1=A.billNo-A.billPv+A.injEur-fee;
 var invCost=micro?0:((+DB.prices.invBase+DB.prices.invKva*kva)*0.8)*(1+vat/100),batCost=bat?(DB.prices.batKwh*bat+(+DB.prices.batFix))*(1+vat/100):0;
 var F=finance(DB.fin,inv,save1,{invCost:invCost,batCost:batCost});
 return {n:n,bat:bat,micro:micro,kwc:kwc,kva:kva,A:A,prod:prod,fee:fee,ht:ht,inv:inv,save1:save1,F:F,kwcPan:kwcPan};}
function compute(onDone){
 if(!P.pans.length){onDone('Dessine au moins un versant de toit.');return;}
 var bad=P.pans.filter(function(p){return p.tilt==null;});if(bad.length){onDone('Indique la pente du versant « '+bad[0].name+' ».');return;}
 var tot=onPanels().length;if(tot<1){onDone('Aucun panneau ne tient sur les versants dessinés.');return;}
 getWeather().then(function(){
  RES={spec:{},order:[],sc:[]};
  P.pans.forEach(function(p){RES.spec[p.id]=specFor(p);});
  var m=MOD();P.pans.forEach(function(p){var s=0,sp=RES.spec[p.id];for(var i=0;i<sp.length;i++)s+=sp[i];var cnt=(p.panels||[]).filter(function(q){return q.on;}).length;p.yield=s/(W.t.length/8766);p.shadeLoss=sp.shadeRatio;if(cnt)RES.order.push({id:p.id,count:cnt,y:p.yield});});
  RES.order.sort(function(a,b){return b.y-a.y;});
  RES.cons=buildCons(W,P.cons);RES.max=tot;
  var cap=P.client.phase!=='tri'?Math.max(4,Math.floor(6.5*1000/m.wc)):1e9,top=Math.min(tot,cap),counts=[],fr=[0.33,0.5,0.66,0.83,1];fr.forEach(function(f){var c=Math.max(Math.min(top,4),Math.round(top*f));if(counts.indexOf(c)<0)counts.push(c);});RES.cap=top;
  var bats=[0].concat(String(DB.fin.bats||'').split(/[;, ]+/).map(Number).filter(function(x){return x>0;}));
  var jobs=[];counts.forEach(function(c){bats.forEach(function(b){jobs.push([c,b]);});});
  var k=0;(function step(){var t0=Date.now();while(k<jobs.length&&Date.now()-t0<60){var r=runScenario(jobs[k][0],jobs[k][1],false);delete r.prod;RES.sc.push(r);k++;}
   var pb=$('#calcp');if(pb)pb.style.width=Math.round(k/jobs.length*100)+'%';
   if(k<jobs.length)return setTimeout(step,0);
   RES.best=RES.sc.slice().sort(function(a,b){return b.F.van-a.F.van;})[0];RES.bestT=RES.sc.slice().sort(function(a,b){return (b.F.irr||-1)-(a.F.irr||-1);})[0];
   if(!P.choice||P.choice.n>tot)P.choice={n:RES.best.n,bat:RES.best.bat,micro:false};
   RES.mine=runScenario(P.choice.n,P.choice.bat,P.choice.micro);save();onDone(null);})();
 });}
function refreshMine(){if(!RES)return;RES.mine=runScenario(P.choice.n,P.choice.bat,P.choice.micro);}
/* ================= Graphiques SVG ================= */
var MO=['J','F','M','A','M','J','J','A','S','O','N','D'];
function chartMonths(A){var w=640,h=230,pad=34,mx=0;A.m.forEach(function(m){mx=Math.max(mx,m.p,m.c);});mx=mx*1.1||1;var bw=(w-pad-10)/12,s='';
 for(var g=0;g<=4;g++){var y=h-24-(h-40)*g/4;s+='<line x1="'+pad+'" x2="'+w+'" y1="'+y+'" y2="'+y+'" stroke="#e7e5e4"/><text x="'+(pad-4)+'" y="'+(y+4)+'" font-size="10" text-anchor="end" fill="#78716c">'+Math.round(mx*g/4)+'</text>';}
 A.m.forEach(function(m,i){var x=pad+i*bw+4,H=function(v){return (h-40)*v/mx;};
  s+='<rect x="'+x+'" y="'+(h-24-H(m.p))+'" width="'+(bw/2-3)+'" height="'+H(m.p)+'" fill="#f59e0b" rx="2"/><rect x="'+x+'" y="'+(h-24-H(m.s))+'" width="'+(bw/2-3)+'" height="'+H(m.s)+'" fill="#c2410c" rx="2"/>'+
  '<rect x="'+(x+bw/2-2)+'" y="'+(h-24-H(m.c))+'" width="'+(bw/2-3)+'" height="'+H(m.c)+'" fill="#475569" rx="2"/><text x="'+(x+bw/2-3)+'" y="'+(h-8)+'" font-size="11" text-anchor="middle" fill="#57534e">'+MO[i]+'</text>';});
 return '<svg viewBox="0 0 '+w+' '+h+'">'+s+'</svg><div class="note"><span class="dot" style="background:#f59e0b"></span> Production · <span class="dot" style="background:#c2410c"></span> dont consommée sur place · <span class="dot" style="background:#475569"></span> Consommation (kWh/mois)</div>';}
function chartDay(prod,cons,month){var p=new Array(24).fill(0),c=new Array(24).fill(0),n=0;
 for(var i=0;i<W.t.length;i++){var l=bxl(W.t[i]*1000);if(l.m!==month)continue;p[l.h]+=prod[i];c[l.h]+=cons[i];if(l.h===12)n++;}
 n=n||1;p=p.map(function(v){return v/n;});c=c.map(function(v){return v/n;});var mx=Math.max.apply(0,p.concat(c))*1.15||1,w=300,h=150,pad=26;
 function path(a){return a.map(function(v,i){return (i?'L':'M')+(pad+i*(w-pad-6)/23).toFixed(1)+','+(h-20-(h-30)*v/mx).toFixed(1);}).join('');}
 var s='<rect x="'+(pad+11*(w-pad-6)/23)+'" y="6" width="'+(6*(w-pad-6)/23)+'" height="'+(h-26)+'" fill="#ecfccb"/>';
 [0,6,12,18,23].forEach(function(hh){s+='<text x="'+(pad+hh*(w-pad-6)/23)+'" y="'+(h-6)+'" font-size="10" text-anchor="middle" fill="#78716c">'+hh+'h</text>';});
 s+='<text x="'+(pad-3)+'" y="14" font-size="10" text-anchor="end" fill="#78716c">'+nf(mx,1)+'</text>';
 s+='<path d="'+path(p)+'L'+(w-6)+','+(h-20)+'L'+pad+','+(h-20)+'Z" fill="#fde68a" stroke="#f59e0b" stroke-width="2"/><path d="'+path(c)+'" fill="none" stroke="#475569" stroke-width="2"/>';
 return '<svg viewBox="0 0 '+w+' '+h+'">'+s+'</svg>';}
function chartHorizon(hz){var w=640,h=200,x0=30,y0=h-22,sx=(w-x0-6)/240,sy=(h-34)/70,s='';
 function X(az){return x0+(az-60)*sx;}function Y(e){return y0-Math.max(0,e)*sy;}
 for(var e=0;e<=70;e+=10)s+='<line x1="'+x0+'" x2="'+w+'" y1="'+Y(e)+'" y2="'+Y(e)+'" stroke="#eee"/><text x="'+(x0-4)+'" y="'+(Y(e)+3)+'" font-size="9" text-anchor="end" fill="#999">'+e+'°</text>';
 [[90,'Est'],[135,'SE'],[180,'Sud'],[225,'SO'],[270,'Ouest']].forEach(function(a){s+='<text x="'+X(a[0])+'" y="'+(h-6)+'" font-size="10" text-anchor="middle" fill="#57534e">'+a[1]+'</text>';});
 [[5,21,'#f59e0b','21 juin'],[2,20,'#84cc16','21 mars'],[11,21,'#60a5fa','21 déc.']].forEach(function(d){var pts=[];for(var m=0;m<24*60;m+=10){var sp=sunPos(Date.UTC(2025,d[0],d[1],0,m),P.lat,P.lon);if(sp.el>0&&sp.az>=60&&sp.az<=300)pts.push(X(sp.az).toFixed(1)+','+Y(sp.el).toFixed(1));}if(pts.length)s+='<polyline points="'+pts.join(' ')+'" fill="none" stroke="'+d[2]+'" stroke-width="2"/><text x="'+pts[Math.floor(pts.length/2)].split(',')[0]+'" y="'+(+pts[Math.floor(pts.length/2)].split(',')[1]-4)+'" font-size="9" fill="'+d[2]+'" text-anchor="middle">'+d[3]+'</text>';});
 if(hz){var pp=[];for(var a=60;a<=300;a+=2.5)pp.push(X(a).toFixed(1)+','+Y(horizonAt(hz,a)).toFixed(1));s+='<polygon points="'+X(60)+','+y0+' '+pp.join(' ')+' '+X(300)+','+y0+'" fill="rgba(68,64,60,.55)"/>';}
 return '<svg viewBox="0 0 '+w+' '+h+'">'+s+'</svg>';}
function chartCash(F,inv){var rows=F.rows,mn=-inv,mx=0;rows.forEach(function(r){mn=Math.min(mn,r.cum);mx=Math.max(mx,r.cum);});var w=640,h=200,x0=50,y0=10,H=h-34;var rg=(mx-mn)||1;
 function Y(v){return y0+H*(mx-v)/rg;}var bw=(w-x0-6)/26,s='<line x1="'+x0+'" x2="'+w+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="#57534e"/>';
 s+='<rect x="'+x0+'" y="'+Y(0)+'" width="'+(bw-2)+'" height="'+(Y(-inv)-Y(0))+'" fill="#b91c1c"/>';
 rows.forEach(function(r,i){var x=x0+(i+1)*bw,v=r.cum;s+='<rect x="'+x+'" y="'+Math.min(Y(0),Y(v))+'" width="'+(bw-2)+'" height="'+Math.abs(Y(v)-Y(0))+'" fill="'+(v<0?'#fca5a5':'#16a34a')+'"/>';if(r.y%5===0)s+='<text x="'+(x+bw/2)+'" y="'+(h-6)+'" font-size="10" text-anchor="middle" fill="#57534e">'+r.y+' ans</text>';});
 [mn,0,mx].forEach(function(v){s+='<text x="'+(x0-4)+'" y="'+(Y(v)+3)+'" font-size="10" text-anchor="end" fill="#78716c">'+nf(Math.round(v/100)*100)+'</text>';});
 return '<svg viewBox="0 0 '+w+' '+h+'">'+s+'</svg>';}
function planSVG(w,h,used){if(!P.pans.length)return '';var o=L0(),all=[];P.pans.forEach(function(p){p.pts.forEach(function(q){all.push(toXY(q,o));});});
 var xs=all.map(function(p){return p[0];}),ys=all.map(function(p){return p[1];}),x0=Math.min.apply(0,xs)-1,x1=Math.max.apply(0,xs)+1,y0=Math.min.apply(0,ys)-1,y1=Math.max.apply(0,ys)+1,sc=Math.min(w/(x1-x0),h/(y1-y0));
 function T(p){return ((p[0]-x0)*sc).toFixed(1)+','+((y1-p[1])*sc).toFixed(1);}var s='';
 P.pans.forEach(function(p){var xy=p.pts.map(function(q){return toXY(q,o);});s+='<polygon points="'+xy.map(T).join(' ')+'" fill="'+p.color+'22" stroke="'+p.color+'" stroke-width="2"/>';
  if(p.panels&&p.tilt!=null){var fr=panFrame(p),ct=Math.cos(p.tilt*RAD);var k=0,lim=used?Math.round((used[p.id]||0)*1000/MOD().wc):1e9;p.panels.forEach(function(pp){if(!pp.on)return;var isU=k++<lim;var c=[[pp.u,pp.s],[pp.u+p.pw,pp.s],[pp.u+p.pw,pp.s+p.ph],[pp.u,pp.s+p.ph]].map(function(us){var h2=us[1]*ct;return [fr.p0[0]+fr.e[0]*us[0]-fr.n[0]*h2,fr.p0[1]+fr.e[1]*us[0]-fr.n[1]*h2];});s+='<polygon points="'+c.map(T).join(' ')+'" fill="'+(isU?'#0f172a':'none')+'" stroke="'+(isU?'#cbd5e1':'#a8a29e')+'" stroke-width=".6"'+(isU?'':' stroke-dasharray="3 2"')+'/>';});}
  var cc=centroid(xy);s+='<text x="'+T(cc).split(',')[0]+'" y="'+T(cc).split(',')[1]+'" font-size="12" font-weight="700" fill="'+p.color+'" text-anchor="middle" stroke="#fff" stroke-width="3" paint-order="stroke">'+esc(p.name)+'</text>';});
 s+='<g transform="translate('+(w-24)+',22)"><circle r="14" fill="#fff" stroke="#999"/><path d="M0,-11 L4,2 L0,0 L-4,2Z" fill="#c2410c"/><text y="-15" font-size="9" text-anchor="middle">N</text></g>';
 return '<svg viewBox="0 0 '+w+' '+h+'" style="width:100%;max-width:'+w+'px;background:#fafaf9;border-radius:8px">'+s+'</svg>';}
/* ================= Vues ================= */
function V(id){return $('#v-'+id);}
function inp(label,path,o){o=o||{};var v=getP(o.db?DB:P,path);var at=(o.db?'data-db':'data-b')+'="'+path+'"'+(o.rr?' data-rr="1"':'');
 if(o.opts)return '<label class="f">'+label+'<select '+at+'>'+o.opts.map(function(x){return '<option value="'+esc(x[0])+'"'+(String(v)===String(x[0])?' selected':'')+'>'+esc(x[1])+'</option>';}).join('')+'</select></label>';
 if(o.area)return '<label class="f">'+label+'<textarea '+at+'>'+esc(v)+'</textarea></label>';
 return '<label class="f">'+label+'<input '+at+' type="'+(o.num?'number':'text')+'"'+(o.num?' inputmode="decimal" step="any"':'')+' value="'+esc(v==null?'':v)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+'></label>';}
function render(){if(!P)return;$('#hpn').textContent=(P.link&&P.link.ref?'🔗 '+P.link.ref+' · ':'')+(P.client.name||'Nouvelle étude')+(P.client.addr?' · '+P.client.addr:'');
 var f={toit:vToit,pv:vPV,conso:vConso,etude:vEtude,devis:vDevis,prix:vPrix}[curTab];V(curTab).innerHTML=f();tools();if(curTab==='devis')setTimeout(fitDoc,0);}
function vToit(){var h='<div class="card"><h3>Client</h3><div class="row">'+inp('Nom du client','client.name',{ph:'ex. Dupont Marc'})+inp('GSM','client.gsm')+'</div>'+inp('Adresse du chantier','client.addr',{ph:'Rue, n°, CP commune'})+'<div class="row">'+inp('E-mail','client.email')+inp('TVA applicable','client.vat',{opts:[[6,'6 % (logement de plus de 10 ans)'],[21,'21 % (logement récent ou pro)']],rr:1})+'</div>'+'<div class="row">'+inp('Référence chantier (Rtoitures App)','link.ref',{ph:'ex. CH-2026-001',rr:1})+'</div>'+inp('Raccordement électrique','client.phase',{opts:[['mono','Monophasé (max. 5 kVA d’onduleur)'],['tri','Triphasé']],rr:1})+'</div>';
 h+='<div class="card"><h3>Versants de toiture</h3>';
 if(!P.pans.length)h+='<p class="note">1. Cherche l’adresse (photo aérienne d’avril 2026).<br>2. <b>🪄 Détecter le toit</b> puis touche la maison : les versants sont trouvés tout seuls grâce au relevé laser LiDAR. Ou <b>✏️ Dessiner</b> : vise chaque coin avec ✛ et touche « ＋ Point », gouttière en premier.<br>3. Sélectionne un versant puis <b>✥ Modifier</b> pour déplacer ses points. Ajoute autant de versants que tu veux.<br>4. <b>⛰</b> affiche le relief LiDAR (les arêtes ressortent), <b>🧊</b> ouvre la maquette 3D avec les ombres.</p>';
 P.pans.forEach(function(p){var st=panStats(p),sel=selPan===p.id;
  h+='<div class="pan'+(sel?' sel':'')+'"><div class="ph"><span class="dot" style="background:'+p.color+'"></span><span>'+esc(p.name)+' — '+compass(p.az)+' ('+Math.round(p.az)+'°)</span><button class="btn s sm" data-a="delPan" data-id="'+p.id+'">🗑</button></div>'+
  '<div class="row">'+inp('Nom','pans.'+P.pans.indexOf(p)+'.name',{rr:1})+inp('Pente (°)','pans.'+P.pans.indexOf(p)+'.tilt',{num:1,rr:1})+inp('Orientation (°, 180 = sud)','pans.'+P.pans.indexOf(p)+'.az',{num:1,rr:1})+'</div>'+
  '<div class="note">Surface au sol '+nf(st.plan,1)+' m² · surface réelle '+nf(p.tilt!=null?st.real:st.plan,1)+' m²'+(p.tiltSrc==='lidar'?' · <b>pente mesurée par LiDAR</b>':'')+'</div>';
  if(p.lidar){if(p.lidar.st==='run')h+='<div class="note">Mesure LiDAR de la pente…</div>';else if(p.lidar.st==='ok')h+='<div class="note">LiDAR : pente '+nf(p.lidar.tilt,1)+'°, orientation '+p.lidar.az+'°, écart moyen '+nf(p.lidar.rms*100)+' cm sur '+p.lidar.n+' points'+(p.lidar.dAz>20?' · ⚠ l’orientation LiDAR diffère de '+p.lidar.dAz+'° : vérifie que tu as bien commencé par la gouttière':'')+'</div>'+(p.lidar.msg?'<div class="warn">'+esc(p.lidar.msg)+'</div>':'');else h+='<div class="warn">'+esc(p.lidar.msg)+'</div>';}
  if(p.gsolar)h+='<div class="note">☀️ Google Solar : pente '+nf(p.gsolar.pitch,1)+'°, orientation '+p.gsolar.az+'°, '+nf(p.gsolar.area,1)+' m²'+(p.gsolar.shape==='rect'?' · contour approximatif (rectangle) : ajuste les points':' · contour recalé sur le LiDAR')+'</div>';
  if(p.hz){if(p.hz.st==='run')h+='<div class="note">Analyse des ombrages (relevé LiDAR jusqu’à 1,6 km)…</div><div class="prog"><i id="hzp'+p.id+'"></i></div>';else if(p.hz.st==='ok')h+='<div class="note">Ombrages analysés ✓ (horizon max '+nf(Math.max.apply(0,p.horizon.slice(Math.round(HZ_N/4),Math.round(HZ_N*3/4)+1)))+'° côté sud)</div>';else h+='<div class="warn">'+esc(p.hz.msg)+'</div>';}
  h+='<div class="btns"><button class="btn s sm" data-a="selEdit" data-id="'+p.id+'">✥ Modifier les points</button><button class="btn s sm" data-a="lidar" data-id="'+p.id+'">📡 Remesurer</button><button class="btn s sm" data-a="flip" data-id="'+p.id+'">⇅ Inverser l’orientation</button></div></div>';});
 if(P.gsolar)h+='<div class="okb">☀️ Google Solar : '+P.gsolar.panels+' panneaux possibles au maximum sur ce toit ('+P.gsolar.area+' m²), ensoleillement jusqu’à '+nf(P.gsolar.sun)+' h/an · photos du '+esc(P.gsolar.date)+' ('+esc(P.gsolar.quality)+').</div>';
 h+='</div><div class="card"><h3>Astuce précision</h3><p class="note">Le LiDAR wallon date de 2021-2022 (environ 13 points/m²) : une extension récente ou un arbre abattu depuis n’y figurent pas. Pour un chantier à fort enjeu, ton relevé drone Pix4D reste la référence.</p></div>';return h;}
function vPV(){var m=MOD(),tot=onPanels().length,h='<div class="card"><h3>Panneaux</h3>'+inp('Modèle de panneau','modIdx',{opts:DB.prices.mods.map(function(x,i){return [i,x.n+' – '+x.wc+' Wc'];}),rr:1})+
 '<div class="kpis"><div class="kpi hi"><div class="v">'+tot+'</div><div class="l">panneaux posables</div></div><div class="kpi hi"><div class="v">'+nf(tot*m.wc/1000,2)+' kWc</div><div class="l">puissance maximale</div></div></div></div>';
 if(!P.pans.length)return h+'<div class="card"><p class="note">Dessine d’abord les versants dans l’onglet Toit.</p></div>';
 P.pans.forEach(function(p,i){var on=(p.panels||[]).filter(function(q){return q.on;}).length,off=(p.panels||[]).length-on;
  h+='<div class="card"><div class="ph" style="display:flex;gap:8px;align-items:center;font-weight:700"><span class="dot" style="background:'+p.color+'"></span>'+esc(p.name)+' : '+on+' panneaux'+(off?' ('+off+' retirés)':'')+'</div><div class="row">'+
  inp('Pose','pans.'+i+'.orient',{opts:[['portrait','Portrait (debout)'],['paysage','Paysage (couché)']],rr:1})+inp('Marge aux bords (m)','pans.'+i+'.margin',{num:1,rr:1})+'</div>'+
  (p.tilt==null?'<div class="warn">Pente inconnue : indique-la dans l’onglet Toit.</div>':'')+'</div>';});
 h+='<div class="card"><p class="note">Marge conseillée : 0,4 m (rives, gouttière) ; garde 0,5 m sous le faîte. Retire à la main les panneaux sur une cheminée, une fenêtre de toit ou une zone d’ombre en les touchant sur la carte.</p></div>';return h;}
function vConso(){var c=P.cons,h='<div class="card"><h3>Consommation du client</h3>'+
 '<div class="row">'+inp('Consommation annuelle (kWh)','cons.annual',{num:1,rr:1})+inp('Mode de vie','cons.profile',{opts:[['actif','Absent en journée (travail)'],['maison','Présent en journée (télétravail, retraité)'],['commerce','Bureau / commerce']],rr:1})+'</div>'+
 '<p class="note">Repère : 2 adultes ≈ 2 500 kWh, famille de 4 ≈ 3 500 à 4 500 kWh (hors chauffage électrique). Le chiffre est sur le décompte annuel du fournisseur.</p>'+
 '<h4>Équipements électriques (en plus)</h4><div class="row">'+inp('Pompe à chaleur (kWh/an)','cons.pac',{num:1,rr:1})+inp('Voiture électrique (km/an)','cons.vekm',{num:1,rr:1})+inp('Recharge voiture','cons.vewin',{opts:[['soir','Le soir (18-23 h)'],['nuit','La nuit (1-7 h)'],['jour','En journée (11-17 h)']],rr:1})+'</div>'+
 '<p class="note">La PAC suit les vraies températures heure par heure (plus en hiver). Repère : PAC air-eau maison moyenne ≈ 3 000 à 5 000 kWh/an.</p>'+
 '<h4>Pilotage</h4>'+inp('Part de la conso déplaçable vers les heures de soleil','cons.flex',{opts:[[0,'Aucune'],[0.1,'10 % (lave-linge, lave-vaisselle programmés)'],[0.2,'20 % (+ boiler piloté)'],[0.3,'30 % (+ recharge voiture pilotée)']],rr:1})+'</div>';
 h+='<div class="card"><h3>Vraie consommation (compteur communicant)</h3><p class="note">Le client télécharge ses données quart-horaires sur son espace ORES ou RESA (fichier CSV ou Excel enregistré en CSV) : l’étude utilise alors sa vraie courbe de charge au lieu d’un profil type.</p>'+
 (c.real?'<div class="okb">✓ '+esc(c.realInfo)+'</div><div class="btns"><button class="btn s sm" data-a="clearReal">Revenir au profil type</button></div>':'<div class="btns"><label class="btn s"><input type="file" accept=".csv,.txt" id="csvin" style="display:none">📄 Importer le fichier CSV</label></div>')+'</div>';
 h+='<div class="card"><h3>Prix de l’électricité du client (TVAC)</h3>'+inp('Formule','tariff.type',{db:1,opts:[['bi','Bihoraire (creuses 11-17 h et 22-7 h)'],['mono','Monohoraire'],['impact','Tarif Impact (ECO / MEDIUM / PIC)']],rr:1});
 var t=DB.tariff.type;h+='<div class="row">'+(t==='bi'?inp('Heures pleines (€/kWh)','tariff.hp',{db:1,num:1,rr:1})+inp('Heures creuses (€/kWh)','tariff.hc',{db:1,num:1,rr:1}):t==='mono'?inp('Prix (€/kWh)','tariff.mono',{db:1,num:1,rr:1}):inp('ECO (€/kWh)','tariff.eco',{db:1,num:1,rr:1})+inp('MEDIUM (€/kWh)','tariff.med',{db:1,num:1,rr:1})+inp('PIC (€/kWh)','tariff.pic',{db:1,num:1,rr:1}))+inp('Rachat du surplus (€/kWh)','tariff.inj',{db:1,num:1,rr:1})+'</div>'+
 '<label class="f"><input type="checkbox" data-db="tariff.prosumer" data-rr="1"'+(DB.tariff.prosumer?' checked':'')+' style="display:inline;width:auto"> Ancien compteur : payer le tarif prosumer forfaitaire ('+inp('','tariff.prosRate',{db:1,num:1}).replace('<label class="f">','').replace('</label>','')+' €/kVA/an)</label>'+
 '<p class="note">Prix moyens TVAC 2026 en Wallonie (énergie + réseau + taxes), à adapter à la facture du client. Depuis 2026, les heures creuses du bihoraire comprennent 11 h–17 h : c’est pile quand les panneaux produisent.</p></div>';
 return h;}
function kpis(R){var A=R.A;return '<div class="kpis">'+
 '<div class="kpi hi"><div class="v">'+nf(R.kwc,2)+' kWc</div><div class="l">'+R.n+' panneaux'+(R.bat?' + batterie '+nf(R.bat,1)+' kWh':'')+'</div></div>'+
 '<div class="kpi"><div class="v">'+nf(Math.round(A.prod/10)*10)+' kWh</div><div class="l">production par an</div></div>'+
 '<div class="kpi"><div class="v">'+pct(A.autoc)+'</div><div class="l">autoconsommation</div></div>'+
 '<div class="kpi"><div class="v">'+pct(A.autonomy)+'</div><div class="l">autonomie (conso couverte)</div></div>'+
 '<div class="kpi hi"><div class="v">'+eur(R.save1)+'</div><div class="l">économie la 1re année</div></div>'+
 '<div class="kpi"><div class="v">'+(R.F.pay!=null?nf(R.F.pay,1)+' ans':'> 25 ans')+'</div><div class="l">retour sur investissement</div></div>'+
 '<div class="kpi"><div class="v">'+(R.F.irr!=null?nf(R.F.irr*100,1)+' %':'–')+'</div><div class="l">rendement annuel (TRI)</div></div>'+
 '<div class="kpi hi"><div class="v">'+eur(R.F.gain)+'</div><div class="l">gain net sur 25 ans</div></div></div>';}
function vEtude(){if(!RES)return '<div class="card"><h3>Calcul de l’étude</h3><p class="note">Météo réelle heure par heure sur 5 ans, ombrages LiDAR, consommation et tarifs : je teste toutes les tailles d’installation, avec et sans batterie.</p><div class="prog"><i id="calcp"></i></div><div class="btns"><button class="btn" data-a="calc">▶ Lancer le calcul</button></div></div>';
 var R=RES.mine,A=R.A,h='';
 h+='<div class="card"><h3>Configuration retenue</h3><div class="row">'+
  '<label class="f">Nombre de panneaux<input type="number" inputmode="numeric" id="chN" min="1" max="'+RES.max+'" value="'+P.choice.n+'"></label>'+
  '<label class="f">Batterie (kWh)<input type="number" inputmode="decimal" id="chB" min="0" step="0.5" value="'+P.choice.bat+'"></label>'+
  '<label class="f">Onduleur<select id="chM"><option value="0"'+(P.choice.micro?'':' selected')+'>Onduleur central</option><option value="1"'+(P.choice.micro?' selected':'')+'>Micro-onduleurs</option></select></label></div>'+
  (RES.best&&(RES.best.n!==P.choice.n||RES.best.bat!==P.choice.bat)?'<div class="warn">La meilleure option calculée est '+RES.best.n+' panneaux'+(RES.best.bat?' + '+RES.best.bat+' kWh':' sans batterie')+'. <button class="btn sm" data-a="useBest">Prendre celle-là</button></div>':'<div class="okb">✓ C’est la configuration la plus rentable sur 25 ans.</div>')+
  (P.client.phase!=='tri'&&RES.cap<RES.max?'<div class="note">Raccordement monophasé : onduleur limité à 5 kVA, donc '+RES.cap+' panneaux au maximum dans les scénarios (le toit en accepte '+RES.max+'). Passe en triphasé dans l’onglet Toit si le client l’a.</div>':'')+(P.client.phase!=='tri'&&R.kwc>6.5&&!R.micro?'<div class="warn">Plus de 6,5 kWc sur un onduleur de 5 kVA : une partie de la production sera écrêtée. Raccordement triphasé conseillé.</div>':'')+
  (R.kva>10?'<div class="warn">Plus de 10 kVA : demande d’étude préalable au gestionnaire de réseau.</div>':'')+
  kpis(R)+'<p class="note">Investissement '+eur(R.inv)+' TVAC (TVA '+P.client.vat+' %) · facture d’électricité '+eur(A.billNo)+' → '+eur(A.billPv-A.injEur+R.fee)+' par an.'+(R.fee?' Tarif prosumer : '+eur(R.fee)+'/an.':'')+'</p></div>';
 h+='<div class="card"><h3>Production et consommation mois par mois</h3><div class="chart">'+chartMonths(A)+'</div></div>';
 h+='<div class="card"><h3>Journée type</h3><div class="row"><div class="chart"><b style="font-size:13px">Juin</b>'+chartDay(R.prod,RES.cons,5)+'</div><div class="chart"><b style="font-size:13px">Décembre</b>'+chartDay(R.prod,RES.cons,11)+'</div></div><p class="note">Jaune : production · gris : consommation (kWh par heure) · vert : heures creuses 11-17 h.</p></div>';
 h+='<div class="card"><h3>Tous les scénarios testés</h3><div class="scroll"><table class="t"><tr><th>Config.</th><th>kWc</th><th>Invest. TVAC</th><th>Autoconso</th><th>Économie an 1</th><th>Retour</th><th>TRI</th><th>Gain 25 ans</th></tr>'+
  RES.sc.map(function(s){var best=s===RES.best,mine=s.n===P.choice.n&&s.bat===P.choice.bat&&!P.choice.micro;return '<tr class="'+(best?'best ':'')+(mine?'mine':'')+'" data-a="pick" data-n="'+s.n+'" data-bat="'+s.bat+'"><td>'+(best?'★ ':'')+(s===RES.bestT?'◆ ':'')+s.n+' pann.'+(s.bat?' + '+s.bat+' kWh':'')+'</td><td>'+nf(s.kwc,2)+'</td><td>'+eur(s.inv)+'</td><td>'+pct(s.A.autoc)+'</td><td>'+eur(s.save1)+'</td><td>'+(s.F.pay!=null?nf(s.F.pay,1)+' a':'–')+'</td><td>'+(s.F.irr!=null?nf(s.F.irr*100,1)+'%':'–')+'</td><td>'+eur(s.F.gain)+'</td></tr>';}).join('')+'</table></div><p class="note">★ = plus gros gain net sur 25 ans · ◆ = meilleur rendement par euro investi (TRI). Touche une ligne pour la choisir.</p></div>';
 h+='<div class="card"><h3>Trésorerie cumulée sur 25 ans</h3><div class="chart">'+chartCash(R.F,R.inv)+'</div><p class="note">Hausse des prix '+DB.fin.infl+' %/an, perte des panneaux '+DB.fin.deg+' %/an'+(R.micro?'':', remplacement de l’onduleur l’année '+DB.fin.invYear)+(R.bat?', batterie renouvelée à '+DB.fin.batRep+' % du prix l’année '+DB.fin.batYear:'')+'.</p>'+
  '<p class="note">Selon la météo réelle de chaque année : '+A.years.map(function(y){return y.y+' : '+nf(Math.round(y.prod/10)*10)+' kWh';}).join(' · ')+'</p></div>';
 h+='<div class="card"><h3>Ombrages par versant</h3>'+P.pans.map(function(p){return '<div style="margin-bottom:8px"><b>'+esc(p.name)+'</b> — '+nf(p.yield||0)+' kWh/kWc/an'+(p.horizon?' · '+pct(p.shadeLoss)+' des heures de plein soleil à l’ombre':' · ombrages non calculés')+'<div class="chart">'+chartHorizon(p.horizon)+'</div></div>';}).join('')+'<p class="note">Gris : relief, arbres et bâtiments vus depuis le versant (LiDAR). Courbes : trajet du soleil.</p></div>';
 h+='<div class="card"><h3>Documents</h3><div class="btns"><button class="btn" data-a="printEtude">🖨 Étude PDF pour le client</button><button class="btn s" data-a="goDevis">✍️ Faire le devis</button><button class="btn s" data-a="calc">↻ Recalculer</button></div><p class="note">Météo : '+esc(W.src)+'.</p></div>';
 return h;}
/* ---- devis ---- */
function devisLines(){if(!P.devis.lines){if(!RES||!RES.mine)return null;P.devis.lines=costLines(P.choice.n,P.choice.bat,P.choice.micro);}return P.devis.lines;}
function solPayload(){var R=RES&&RES.mine,L=devisLines()||[],m=MOD();
 var o={v:1,id:P.id,ref:(P.link&&P.link.ref)||'',site:(P.link&&P.link.site)||'',client:P.client.name,addr:P.client.addr,vat:+P.client.vat||6,objet:'Installation de panneaux photovoltaïques'+(R?' de '+nf(R.kwc,2)+' kWc':''),lines:L.map(function(l){return l.t==='titre'?{t:'titre',d:l.d}:{d:l.d,u:l.u,q:+l.q||0,p:+l.p||0};}),
  sum:R?{kwc:r2(R.kwc),n:R.n,bat:R.bat,prod:Math.round(R.A.prod),autoc:r2(R.A.autoc),save1:Math.round(R.save1),inv:Math.round(R.inv),pay:R.F.pay!=null?r2(R.F.pay):null}:{},
  lat:r2(P.lat*1e4)/1e4,lon:r2(P.lon*1e4)/1e4,phase:P.client.phase==='tri'?'tri':'mono',mod:{n:m.n,wc:m.wc},cons:{annual:+P.cons.annual||0,profile:P.cons.profile,pac:+P.cons.pac||0,vekm:+P.cons.vekm||0,vewin:P.cons.vewin},
  pans:P.pans.filter(function(p){return p.tilt!=null;}).map(function(p){var st=panStats(p);return {name:p.name,area:Math.round(st.real*10)/10,az:Math.round(p.az!=null?p.az:st.az),tilt:Math.round(p.tilt*10)/10,n:(p.panels||[]).filter(function(q){return q.on;}).length,hz:p.horizon?p.horizon.map(function(v){return Math.round(v);}):null};})};
 var b=new TextEncoder().encode(JSON.stringify(o)),t='';for(var i=0;i<b.length;i++)t+=String.fromCharCode(b[i]);return 'RTS1:'+btoa(t);}
function vSendApp(){var ref=P.link&&P.link.ref;
 return '<div class="card" style="border:2px solid #fed7aa"><h3>🔗 Rtoitures App'+(ref?' · chantier '+esc(ref):'')+'</h3>'+(ref?'<p class="note">Le devis officiel (numéro, client, signature) se fait dans ton app, pour garder une seule numérotation. Envoie-lui cette étude :</p>':'<p class="note">Pas encore relié à un chantier : ouvre cette étude depuis le chantier dans Rtoitures App (bouton « 🌐 R Toitures Photovoltaïque »), ou tape la référence chantier dans l’onglet Toit.</p>')+
 '<div class="btns"><button class="btn" data-a="sendApp">📤 Envoyer à Rtoitures App</button></div><p class="note">1. Touche le bouton : le code de l’étude est copié. 2. Dans l’app : chantier '+esc(ref||'…')+' → « ☀️ Étude photovoltaïque » → « 📥 Importer l’étude » → colle. Si tu renvoies une étude modifiée, le même devis brouillon est mis à jour, sans doublon.</p><textarea id="solOut" readonly style="width:100%;height:56px;font-size:11px;display:none"></textarea></div>';}
function vDevis(){if(!CO().name&&!CO().iban){return '<div class="card"><h3>Devis</h3><div class="warn">Ajoute d’abord les coordonnées de ton entreprise dans ⚙️ Réglages → « Mon entreprise » (ou importe le fichier mon-entreprise-rtoitures.json).</div><div class="btns"><button class="btn" data-tab="prix">⚙️ Réglages</button></div></div>';}var L=devisLines();if(!L)return '<div class="card"><h3>Devis</h3><p class="note">Fais d’abord le calcul dans l’onglet Étude : le devis se remplit avec la configuration retenue.</p><div class="btns"><button class="btn" data-a="goEtude">📈 Aller à l’étude</button></div></div>';
 if(!P.devis.num)P.devis.num='DE'+String(new Date().getFullYear()).slice(2)+String(DB.seq).padStart(3,'0');
 var h=vSendApp()+'<div class="card"><h3>Devis'+(P.link&&P.link.ref?' (projet)':'')+'</h3><div class="row">'+inp('N° de devis','devis.num',{rr:1})+inp('Date','devis.date',{rr:1})+inp('Code client','devis.code')+'</div>'+
 L.map(function(l,i){return '<div class="dl"><textarea data-l="'+i+'" data-f="d" rows="2"'+(l.t==='titre'?' style="font-weight:700"':'')+'>'+esc(l.d)+'</textarea>'+(l.t==='titre'?'<button class="btn s sm" data-a="delLine" data-i="'+i+'">✕</button>':'<div class="dlr"><label>Unité<input data-l="'+i+'" data-f="u" value="'+esc(l.u||'')+'"></label><label>Qté<input data-l="'+i+'" data-f="q" inputmode="decimal" value="'+esc(l.q)+'"></label><label>P.U. HTVA<input data-l="'+i+'" data-f="p" inputmode="decimal" value="'+esc(l.p)+'"></label><b>'+eur((+l.q||0)*(+l.p||0))+'</b><button class="btn s sm" data-a="delLine" data-i="'+i+'">✕</button></div>')+'</div>';}).join('')+
 '<div class="btns"><button class="btn s sm" data-a="addLine">＋ Ligne</button><button class="btn s sm" data-a="regen">↻ Reprendre de l’étude</button></div>'+
 '<p class="note">Total : <b>'+eur(linesHT(L))+' HTVA</b> · '+eur(linesHT(L)*(1+P.client.vat/100))+' TVAC ('+P.client.vat+' %)</p>'+
 '<div class="btns"><button class="btn g" data-a="sign">✍️ Faire signer le client</button><button class="btn" data-a="printDevis">🖨 Devis PDF</button><button class="btn s" data-a="printAll">🖨 Étude + devis</button></div>'+(P.devis.sig?'<div class="okb">✓ Signé par '+esc(P.devis.sigName)+' le '+esc(P.devis.sigDate)+' à '+esc(P.devis.sigTime)+'</div>':'')+'</div>';
 h+='<h3 style="margin:14px 2px 6px">Aperçu</h3><div class="docwrap" id="dprev"><div class="docsc">'+civHtml()+'</div></div>';return h;}
function fitDoc(){var w=$('#dprev');if(!w)return;var sc=w.querySelector('.docsc'),k=Math.min(1,(w.clientWidth-20)/794);sc.style.transform='scale('+k+')';sc.style.transformOrigin='top left';sc.style.width='794px';sc.style.height='0';w.style.height=(sc.firstChild.offsetHeight*k+20)+'px';}
function civDate(s){if(!s)return '';var p=String(s).split('-');return p.length===3?p[2]+'-'+p[1]+'-'+p[0].slice(2):s;}
function civN(v){return (Math.round((+v||0)*100)/100).toLocaleString('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2});}
function civHtml(){var c=CO(),d=P.devis,L=devisLines()||[],vat=+P.client.vat||6,ht=linesHT(L),tva=r2(ht*vat/100),ttc=r2(ht+tva);
 var due=new Date((d.date||new Date().toISOString().slice(0,10))+'T12:00:00');due.setMonth(due.getMonth()+3);
 var addr=String(P.client.addr||'').split(/\n|,\s*(?=\d{4}\s)/).filter(Boolean),body='',R=RES&&RES.mine;
 function row(x){return '<tr><td class="cd">'+x+'</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';}
 body+=row('<div class="cobj">Installation de panneaux photovoltaïques</div>');
 body+=row('<div class="cintro">Les prix indiqués ci-dessous s’entendent <u>HTVA</u> et comprennent la fourniture et la pose des marchandises.</div>');
 L.forEach(function(l){if(!String(l.d||'').trim())return;if(l.t==='titre'){body+=row('<div class="ctit">'+esc(l.d)+'</div>');return;}
  body+='<tr><td class="cd">'+esc(l.d)+'</td><td class="cc">'+esc(l.u||'')+'</td><td class="cn">'+civN(l.q)+'</td><td class="cn">'+civN(l.p)+'</td><td class="cn">'+civN(r2((+l.q||0)*(+l.p||0)))+'</td><td class="cn"></td><td class="cn">'+vat+'</td></tr>';});
 if(R)body+=row('<div class="cnote"><b>Performances estimées</b> (étude jointe) : production '+nf(Math.round(R.A.prod/10)*10)+' kWh/an, autoconsommation '+pct(R.A.autoc)+', économie estimée '+eur(R.save1)+' la première année. Estimation basée sur la météo 2021-2025 et le relevé LiDAR de la Wallonie, sans garantie de résultat.</div>');
 body+=row('<div class="cment">TVA '+vat+' %'+(vat===6?' : le client atteste que l’habitation est utilisée principalement comme logement privé et a été occupée pour la première fois il y a au moins 10 ans.':'.')+'</div>');
 return '<div class="civ"><div class="chd"><div class="cl"><div class="clogo">'+(c.logo&&c.logo.indexOf('data:')===0?'<img src="'+c.logo+'" alt="">':'<div class="clogot">'+esc(String(c.name||'').toUpperCase())+'</div>')+'</div><div class="cme"><b>'+esc(String(c.owner).toUpperCase())+'</b><b>'+esc(String(c.address).split(/,\s*(?=\d{4}\s)/)[0]||'')+'</b><b>'+esc((String(c.address).match(/\d{4}\s.*$/)||[''])[0])+'</b>'+
  '<table class="cmt"><tr><td>GSM</td><td>: '+esc(c.phone)+'</td></tr><tr><td>BTW</td><td>: '+esc(c.vat)+'</td></tr><tr><td><b>N° de compte</b></td><td>: '+esc(c.iban)+'  BIC : '+esc(c.bic)+'</td></tr><tr><td><b>Facebook</b></td><td>: '+esc(c.facebook)+'</td></tr><tr><td><b>E-mail</b></td><td>: '+esc(c.email)+'</td></tr></table></div></div>'+
  '<div class="crt"><table class="cbx"><tr><th>Devis N°</th><th>Date</th><th>Echéance</th><th>Code client</th></tr><tr><td><b>'+esc(P.link&&P.link.ref?'PROJET':d.num)+'</b></td><td>'+civDate(d.date)+'</td><td>'+civDate(due.toISOString().slice(0,10))+'</td><td>'+esc(d.code||'')+'</td></tr></table>'+
  '<table class="cbx cpay"><tr><th>A mentioner lors de votre paiement</th></tr><tr><td><b>'+esc(P.link&&P.link.ref?P.link.ref:d.num)+'</b></td></tr></table>'+
  '<div class="ccli"><i class="k1"></i><i class="k2"></i><i class="k3"></i><i class="k4"></i><b>'+esc(P.client.name)+'</b>'+addr.map(function(x){return '<b>'+esc(x)+'</b>';}).join('')+'<b>Belgique</b></div></div></div>'+
 '<div class="cti"><span class="ctt">DEVIS</span><span>N° Entreprise : NA</span><span></span></div>'+
 '<table class="clin"><thead><tr><th>Désignation</th><th>Unité</th><th>Quantité</th><th>P.U. HTVA</th><th>Montant HTVA</th><th>Remise</th><th>Taux</th></tr></thead><tbody>'+body+'<tr class="cfill"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr></tbody></table>'+
 '<div class="cbot"><table class="cvt"><tr><th>Code</th><th>Base HT</th><th>Taux TVA</th><th>Montant TVA</th></tr><tr><td>'+civN(vat)+'</td><td>'+civN(ht)+'</td><td>'+civN(vat)+'</td><td>'+civN(tva)+'</td></tr></table>'+
 '<table class="ctot"><tr><td>Total HTVA</td><td>'+civN(ht)+' €</td></tr><tr><td>Total TVA</td><td>'+civN(tva)+' €</td></tr><tr><td>Total TVAC</td><td>'+civN(ttc)+' €</td></tr><tr><td>Acompte</td><td>€</td></tr><tr class="cnet"><td>TOTAL</td><td>'+civN(ttc)+' €</td></tr></table></div>'+
 '<div class="csig"><div><b>Pour accord</b><br>Date et signature du client, précédées de la mention « Bon pour accord »</div><div class="cbox">'+(d.sig?'<img src="'+d.sig+'" alt="Signature">':'')+'</div></div>'+(d.sig?'<div class="csok">Bon pour accord — '+esc(d.sigName)+(d.sigPlace?', à '+esc(d.sigPlace):'')+', le '+civDate(d.sigDate)+' à '+esc(d.sigTime)+'</div>':'')+
 '<div class="cfoot"><p>Cette offre est valable pour une durée de 3 mois à compter de sa date d’émission.</p><p><span class="red">Conditions générales de paiement :</span> '+esc(c.cgv)+'</p><p class="big">'+esc(c.acompteTxt)+'</p><p><b>Pour acceptation merci de retourner ce devis et conditions générales de vente signé avec la mention "Bon pour Accord".</b></p><p><b>'+esc(c.reserveTxt)+'</b></p></div></div>';}
var VERSION='TEST 12.1 – 13 nov. 2026';
function vSync(){var c=Sync.cfg();
 if(c.token)return '<div class="card"><h3>☁️ Synchronisation PC ↔ téléphone</h3><div class="okb">Activée et chiffrée 🔒 : tout ce que tu fais ici se retrouve sur tes autres appareils, et inversement (toutes les 15 secondes et à chaque ouverture). GitHub ne voit qu’un bloc illisible.</div><p class="note" id="syncst">'+esc(Sync.status()||'')+'</p><div class="btns"><button class="btn" data-a="syncNow">↻ Synchroniser maintenant</button><button class="btn s" data-a="syncOff">Déconnecter cet appareil</button></div></div>';
 return '<div class="card"><h3>☁️ Synchronisation PC ↔ téléphone</h3><p class="note">Tes études, prix et réglages sont gardés dans un coffre privé sur ton compte GitHub (gratuit). À faire <b>une seule fois</b> :</p>'+
 '<ol class="note" style="padding-left:18px;margin:4px 0"><li>Crée un compte sur <a href="https://github.com/signup" target="_blank">github.com</a> (si tu n’en as pas).</li><li>Ouvre <a href="https://github.com/settings/tokens/new?scopes=gist&description=R%20Toitures%20Photovolta%C3%AFque" target="_blank">cette page</a> : choisis « No expiration », laisse seulement « gist » coché, puis « Generate token ».</li><li>Copie la clé (elle commence par ghp_) et colle-la ci-dessous, <b>sur le PC et sur le téléphone</b>.</li></ol>'+
 '<label class="f">Clé GitHub<input id="synctok" placeholder="ghp_…" autocomplete="off"></label><label class="f">Mot de passe de synchro (le même sur le PC et le téléphone, 8 caractères minimum)<input id="syncpw" type="password" autocomplete="new-password"></label><div class="btns"><button class="btn" data-a="syncOn">Activer la synchro</button></div><p class="note">🔒 Tes études, clients, prix et coordonnées sont <b>chiffrés sur ton appareil</b> avec ce mot de passe avant d’être envoyés : GitHub ne peut pas les lire. Garde-le bien : sans lui, la copie en ligne est perdue (tes appareils gardent leurs données). La clé et le mot de passe restent sur tes appareils.</p></div>';}
function vGoogle(){var k=gkey();return '<div class="card"><h3>📷 3D photo de Google</h3>'+(k?'<div class="okb">Clé enregistrée sur cet appareil. Dans la vue 3D, touche « 📷 3D Google ». Dans l’onglet Toit, « ☀️ Google Solar » trouve les versants tout seul.</div><p class="note">Si Google Solar répond « Google refuse » : dans Google Cloud, active <b>Solar API</b> (barre de recherche → Solar API → Activer), puis dans « Identifiants », ouvre ta clé et coche aussi <b>Solar API</b> dans « Restrictions d’API ».</p><div class="btns"><button class="btn s" data-a="gkeyDel">Retirer la clé</button></div>':
 '<p class="note">Pour voir et dessiner sur la vraie 3D photo (comme Google Earth), il faut une clé Google, <b>une seule fois</b> sur chaque appareil :</p><ol class="note" style="padding-left:18px;margin:4px 0"><li>Va sur <a href="https://console.cloud.google.com/" target="_blank">console.cloud.google.com</a>, crée un projet « R Toitures Solaire ».</li><li>Active la facturation (carte bancaire demandée par Google) : les 1 000 premières ouvertures de 3D par mois sont gratuites, ensuite environ 6 $ les 1 000.</li><li>Dans « API et services », active <b>Map Tiles API</b> et <b>Solar API</b>.</li><li>« Identifiants » → « Créer des identifiants » → « Clé API », puis restreins-la à Map Tiles API et Solar API.</li><li>Copie la clé (elle commence par AIza) et colle-la ici.</li></ol><label class="f">Clé Google<input id="gkeyin" placeholder="AIza…" autocomplete="off"></label><div class="btns"><button class="btn" data-a="gkeySave">Enregistrer</button></div>')+
 '<p class="note">La 3D Google couvre Ciney et la plupart des villes, pas toujours les petits villages : là, l’outil garde la maquette LiDAR. Les conditions de Google interdisent de recopier leurs données pour les stocker ailleurs : le relevé de tes versants reste calé sur le LiDAR wallon (pente, hauteurs), Google sert à voir et à viser.</p></div>';}
function vCompany(){var c=DB.company||{},f=function(l,k,ph){return inp(l,'company.'+k,{db:1,ph:ph||''});};
 return '<div class="card"><h3>🏢 Mon entreprise (en-tête des devis)</h3><p class="note">Ces coordonnées restent sur tes appareils (et dans la synchro chiffrée), jamais dans le programme en ligne.</p>'+
 '<div class="row">'+f('Nom de l’entreprise','name')+f('Responsable','owner')+'</div>'+f('Adresse','address','Rue, n°, CP Commune')+'<div class="row">'+f('N° TVA','vat')+f('GSM','phone')+'</div><div class="row">'+f('IBAN','iban')+f('BIC','bic')+'</div><div class="row">'+f('E-mail','email')+f('Facebook / site','facebook')+'</div>'+
 '<div class="btns">'+(c.logo?'<img src="'+c.logo+'" style="height:40px;border-radius:6px">':'')+'<label class="btn s sm"><input type="file" accept="image/*" id="logoin" style="display:none">🖼 Logo</label><label class="btn s sm"><input type="file" accept=".json" id="coin" style="display:none">⬆ Importer mes coordonnées</label></div></div>';}
function vPrix(){var pr=DB.prices,h='<p class="note" style="text-align:right;margin:0 4px 6px">R Toitures Photovoltaïque · version '+VERSION+'</p>'+vSync()+vCompany()+vGoogle()+'<div class="card"><h3>Tes prix de vente (HTVA)</h3><p class="note">Ils servent aux scénarios et au devis. Ce sont des prix de départ du marché belge 2026 : mets les tiens.</p>';
 pr.mods.forEach(function(m,i){h+='<div class="pan"><div class="row">'+inp('Panneau','prices.mods.'+i+'.n',{db:1,rr:1})+inp('Puissance (Wc)','prices.mods.'+i+'.wc',{db:1,num:1,rr:1})+'</div><div class="row">'+inp('Longueur (m)','prices.mods.'+i+'.L',{db:1,num:1,rr:1})+inp('Largeur (m)','prices.mods.'+i+'.W',{db:1,num:1,rr:1})+inp('Prix (€/pce)','prices.mods.'+i+'.p',{db:1,num:1,rr:1})+'</div></div>';});
 h+='<div class="btns"><button class="btn s sm" data-a="addMod">＋ Panneau</button></div><div class="row">'+inp('Fixation (€/panneau)','prices.struct',{db:1,num:1})+inp('Pose (€/panneau)','prices.pose',{db:1,num:1})+inp('Micro-onduleur (€/pce)','prices.micro',{db:1,num:1})+'</div>'+
 '<div class="row">'+inp('Onduleur : base (€)','prices.invBase',{db:1,num:1})+inp('Onduleur : par kVA (€)','prices.invKva',{db:1,num:1})+inp('Supplément hybride (€)','prices.hybrid',{db:1,num:1})+'</div>'+
 '<div class="row">'+inp('Batterie (€/kWh)','prices.batKwh',{db:1,num:1})+inp('Batterie : installation (€)','prices.batFix',{db:1,num:1})+'</div>'+
 '<div class="row">'+inp('Câblage et protections (€)','prices.elec',{db:1,num:1})+inp('Raccordement + RGIE (€)','prices.rgie',{db:1,num:1})+inp('Installation de chantier (€)','prices.chantier',{db:1,num:1})+'</div></div>';
 h+='<div class="card"><h3>Hypothèses de calcul</h3><div class="row">'+inp('Hausse du prix de l’électricité (%/an)','fin.infl',{db:1,num:1})+inp('Perte des panneaux (%/an)','fin.deg',{db:1,num:1})+inp('Taux d’actualisation (%)','fin.disc',{db:1,num:1})+'</div>'+
 '<div class="row">'+inp('Pertes du système (%)','fin.loss',{db:1,num:1})+inp('Remplacement onduleur (année)','fin.invYear',{db:1,num:1})+inp('Remplacement batterie (année)','fin.batYear',{db:1,num:1})+'</div><div class="row">'+inp('Coût batterie à ce moment (% du prix)','fin.batRep',{db:1,num:1})+inp('Entretien (€/an)','fin.maint',{db:1,num:1})+inp('Batteries testées (kWh)','fin.bats',{db:1})+'</div>'+
 '<div class="row">'+inp('Prochain n° de devis','seq',{db:1,num:1})+'</div></div>';
 h+='<div class="card"><h3>Sauvegarde</h3><div class="btns"><button class="btn s" data-a="export">⬇ Exporter tout</button><label class="btn s"><input type="file" accept=".json" id="impin" style="display:none">⬆ Importer</label></div><p class="note">Les études restent dans ce navigateur. Exporte de temps en temps pour garder une copie.</p></div>';return h;}
/* ---- rapport d'étude ---- */
function repPage(inner,n,tot){var C=CO();return '<div class="rep"><div class="rh"><img src="'+C.logo+'" alt=""><div style="flex:1"><b style="font-size:15px">Étude photovoltaïque</b><br><span style="color:#57534e">'+esc(P.client.name)+(P.client.addr?' · '+esc(P.client.addr):'')+'</span></div><div class="rt">'+esc(C.name)+' – '+esc(C.owner)+'<br>'+esc(C.phone)+'<br>'+esc(C.email)+'</div></div>'+inner+'<div class="ft"><span>'+esc(C.name)+' · TVA '+esc(C.vat)+' · '+civDate(new Date().toISOString().slice(0,10))+'</span><span>Page '+n+'/'+tot+'</span></div></div>';}
function reportHtml(){var R=RES.mine,A=R.A,p1='',p2='',p3='';
 p1+='<h1>Votre installation photovoltaïque</h1><p>Étude réalisée pour <b>'+esc(P.client.name||'le client')+'</b>, à partir de la météo réelle de 2021 à 2025 heure par heure, du relevé laser (LiDAR) de la Wallonie pour la pente et les ombrages, et de '+(P.cons.real?'votre vraie consommation (compteur communicant)':'votre consommation de '+nf(P.cons.annual)+' kWh/an')+'.</p>'+kpis(R)+
  '<h2>Implantation des panneaux</h2>'+planSVG(714,235,R.kwcPan)+'<table class="t" style="margin-top:8px"><tr><th>Versant</th><th>Orientation</th><th>Pente</th><th>Panneaux</th><th>Production</th><th>Ombrage</th></tr>'+P.pans.map(function(p){var n=Math.round((R.kwcPan[p.id]||0)*1000/MOD().wc);return '<tr><td>'+esc(p.name)+'</td><td>'+compass(p.az)+' ('+Math.round(p.az)+'°)</td><td>'+Math.round(p.tilt)+'°</td><td>'+n+'</td><td>'+nf(p.yield)+' kWh/kWc</td><td>'+(p.horizon?pct(p.shadeLoss):'–')+'</td></tr>';}).join('')+'</table>'+
  '<h2>Matériel proposé</h2><p>'+R.n+' × '+esc(MOD().n)+' ('+MOD().wc+' Wc) · '+(R.micro?'micro-onduleurs':'onduleur '+(R.bat?'hybride ':'')+nf(R.kva,2)+' kVA')+(R.bat?' · batterie '+nf(R.bat,1)+' kWh':'')+'.<br>Investissement : <b>'+eur(R.inv)+' TVAC</b> (TVA '+P.client.vat+' %).</p>'+
  '<h2>Ombrages (relief, arbres, voisins)</h2>'+(P.pans[0]&&P.pans[0].horizon?'<div class="chart" style="width:80%">'+chartHorizon(P.pans[0].horizon)+'</div><p class="note">Vu depuis « '+esc(P.pans[0].name)+' » : en gris ce qui cache le soleil (relevé LiDAR), en couleur la course du soleil.</p>':'<p class="note">Ombrages non calculés.</p>');
 p2+='<h2>Production et consommation mois par mois</h2><div class="chart">'+chartMonths(A)+'</div><h2>Une journée type</h2><div style="display:flex;gap:16px"><div style="flex:1"><b>Juin</b>'+chartDay(R.prod,RES.cons,5)+'</div><div style="flex:1"><b>Décembre</b>'+chartDay(R.prod,RES.cons,11)+'</div></div><p class="note">Jaune : production · gris : consommation · vert : heures creuses 11-17 h (électricité moins chère depuis 2026).</p>'+
  '<h2>Bilan électrique annuel</h2><table class="t"><tr><td>Production</td><td>'+nf(A.prod)+' kWh</td></tr><tr><td>Consommée directement'+(R.bat?' ou via la batterie':'')+'</td><td>'+nf(A.self)+' kWh ('+pct(A.autoc)+')</td></tr><tr><td>Surplus renvoyé sur le réseau</td><td>'+nf(A.inj)+' kWh</td></tr><tr><td>Encore acheté au réseau</td><td>'+nf(A.grid)+' kWh</td></tr><tr><td>Facture d’électricité sans panneaux</td><td>'+eur(A.billNo)+'/an</td></tr><tr><td>Facture avec panneaux (après rachat du surplus)</td><td>'+eur(A.billPv-A.injEur+R.fee)+'/an</td></tr></table>';
 p3+='<h2>Les options comparées</h2><table class="t"><tr><th>Configuration</th><th>Invest. TVAC</th><th>Autoconso</th><th>Économie an 1</th><th>Retour</th><th>Gain 25 ans</th></tr>'+RES.sc.map(function(s){return '<tr'+(s===RES.best?' class="best"':'')+'><td>'+(s===RES.best?'★ ':'')+s.n+' panneaux'+(s.bat?' + batterie '+s.bat+' kWh':'')+'</td><td>'+eur(s.inv)+'</td><td>'+pct(s.A.autoc)+'</td><td>'+eur(s.save1)+'</td><td>'+(s.F.pay!=null?nf(s.F.pay,1)+' ans':'–')+'</td><td>'+eur(s.F.gain)+'</td></tr>';}).join('')+'</table>'+
  '<h2>Votre argent sur 25 ans</h2><div class="chart">'+chartCash(R.F,R.inv)+'</div>'+
  '<h2>Hypothèses</h2><p class="note" style="font-size:10.5px">Prix TVAC : '+(DB.tariff.type==='bi'?'heures pleines '+DB.tariff.hp+' €/kWh, heures creuses '+DB.tariff.hc+' €/kWh':DB.tariff.type==='mono'?DB.tariff.mono+' €/kWh':'ECO '+DB.tariff.eco+' / MEDIUM '+DB.tariff.med+' / PIC '+DB.tariff.pic+' €/kWh')+', rachat du surplus '+DB.tariff.inj+' €/kWh. Hausse des prix '+DB.fin.infl+' %/an, perte des panneaux '+DB.fin.deg+' %/an, pertes du système '+DB.fin.loss+' %. Météo : '+esc(W.src)+'. Pente et ombrages : MNS LiDAR Wallonie 2021-2022 (SPW). '+(R.micro?'':'Onduleur remplacé l’année '+DB.fin.invYear+'. ')+(R.bat?'Batterie renouvelée l’année '+DB.fin.batYear+'. ':'')+'Il n’existe plus de prime régionale à l’installation en Wallonie ; renseignez-vous auprès de votre commune.<br>Ces chiffres sont des estimations : la production réelle dépend de la météo et la rentabilité de votre consommation et des prix futurs de l’énergie.</p>';
 return repPage(p1,1,3)+repPage(p2,2,3)+repPage(p3,3,3);}
function doPrint(html){var pr=$('#print');pr.innerHTML=html;setTimeout(function(){window.print();},300);}
/* ================= Actions ================= */
var ACT={
 geo:function(){var q=$('#q').value.trim();if(!q)return;toast('Recherche…');geocode(q).then(function(r){if(!r.length){toast('Adresse introuvable');return;}var x=r[0];if(!P.pans.length){P.lat=+x.lat;P.lon=+x.lon;GRID=null;}map.setView([+x.lat,+x.lon],20);if(gkey()&&!P.pans.length)setTimeout(function(){ACT.v3d();},400);if(!P.client.addr)P.client.addr=x.display_name.split(',').slice(0,3).join(',').trim();
  var a=x.address||{};if(a.road&&!(P.link&&P.link.ref&&P.client.addr)){P.client.addr=(a.road+(a.house_number?' '+a.house_number:''))+', '+(a.postcode||'')+' '+(a.city||a.town||a.village||a.municipality||'');}W=null;dirty();save();render();}).catch(function(){toast('Recherche impossible (pas d’internet ?)');});},
 layer:function(){map.removeLayer(layers[layerI].l);layerI=(layerI+1)%layers.length;layers[layerI].l.addTo(map);if(relief&&map.hasLayer(relief))relief.bringToFront();toast(layers[layerI].n);},
 relief:function(){if(map.hasLayer(relief)){map.removeLayer(relief);toast('Relief LiDAR masqué');}else{relief.addTo(map);toast('Relief LiDAR : les arêtes du toit ressortent');}},
 v3d:function(){if(!P.pans.length&&!map){return;}var c=map.getCenter();if(!P.pans.length){P.lat=c.lat;P.lon=c.lng;}View3D.open(H3D(),{google:!!gkey()});},
 startDraw:function(){mode='draw';drawPts=[];selPan=null;editLayer.clearLayers();if(map.getZoom()<19)map.setZoom(20,{animate:false});drawPans();drawRedraw();},
 ptHere:function(){var c=map.getCenter();addPt([c.lat,c.lng]);},
 undoPt:function(){drawPts.pop();drawRedraw();loupeShow(map.getCenter());},
 cancelDraw:function(){mode='idle';drawPts=null;drawLayer.clearLayers();stat();drawPans();tools();},
 endDraw:function(){if(drawPts.length<3)return;newPan(drawPts.slice());mode='idle';drawPts=null;drawLayer.clearLayers();stat();toast('Versant ajouté ✓ — « ✏️ Dessiner » pour le versant suivant',3500);},
 startEdit:function(){if(!selPan)return;mode='edit';selV=null;HIST=[];drawPans();drawEdit();stat('Glisse les points pour les ajuster, ou touche un point puis règle-le avec les flèches (10 cm) ou « 📍 Au viseur ». Les ⊕ ajoutent un point.');tools();},
 endEdit:function(){mode='idle';selV=null;editLayer.clearLayers();stat();var p=P.pans.find(function(x){return x.id===selPan;});drawPans();tools();if(p){p.noSplit=true;measure(p);}},
 vHere:function(){var p=P.pans.find(function(x){return x.id===selPan;});if(!p||selV==null)return;pushHist(p);var c=map.getCenter();p.pts[selV]=snap([c.lat,c.lng],p.id,selV);afterGeom(p);loupeAuto();},
 vDel:function(){var p=P.pans.find(function(x){return x.id===selPan;});if(!p||selV==null)return;if(p.pts.length<=3){toast('Il faut au moins 3 points');return;}pushHist(p);p.pts.splice(selV,1);selV=null;afterGeom(p);loupeAuto();},
 nudge:function(el){var p=P.pans.find(function(x){return x.id===selPan;});if(!p||selV==null)return;pushHist(p);var d=el.dataset.d.split(',').map(Number),o=L0(),xy=toXY(p.pts[selV],o);p.pts[selV]=toLL([xy[0]+d[0]*0.1,xy[1]+d[1]*0.1],o);afterGeom(p);loupeAuto();},
 undo:function(){var h=HIST.pop();if(!h)return;var p=P.pans.find(function(x){return x.id===h.id;});if(!p)return;p.pts=h.pts;if(selV!=null&&selV>=p.pts.length)selV=null;afterGeom(p);loupeAuto();toast('Annulé');},
 square:function(){SQUARE=!SQUARE;toast(SQUARE?'Équerre activée : les angles presque droits sont redressés':'Équerre désactivée');tools();},
 detect:function(){if(mode==='pick'){mode='idle';stat();tools();return;}mode='pick';stat('🪄 Touche la maison sur la carte');tools();},
 detectAt:function(ll){var c={lat:ll[0],lng:ll[1]};if(map.getZoom()<18){map.setView(ll,20,{animate:false});}
  if(!P.pans.length){P.lat=c.lat;P.lon=c.lng;GRID=null;}
  var o=L0(),xy=toXY([c.lat,c.lng],o);stat('🪄 Lecture du relevé LiDAR autour de la maison… <span id="detp">0 %</span>');
  getGrid(xy[0],xy[1],22,0.5,function(f){var e=$('#detp');if(e)e.textContent=Math.round(f*100)+' %';}).then(function(G){
   if(G.z.filter(function(v){return v!=null;}).length<200){stat();toast('Relevé LiDAR inaccessible (internet ?) : dessine le toit à la main.',5000);return;}
   var r=detectRoof(G,xy[0],xy[1]);stat();if(r.err){toast(r.err,5000);return;}
   var n0=P.pans.length;r.pans.forEach(function(d){var pts=d.xy.map(function(q){return toLL(q,o);});
    var dup=P.pans.some(function(p){var c2=toXY(centroid(p.pts),o);return inPoly(c2,d.xy);});if(dup)return;
    var pan=newPan(pts,true);pan.tilt=Math.round(d.tilt*10)/10;pan.tiltSrc='lidar';pan.plane={a:d.pl.a,b:d.pl.b,c:d.pl.c,lat:o.lat,lon:o.lon};pan.lidar={st:'ok',tilt:r2(d.tilt),az:Math.round(d.az),rms:r2(d.rms),n:Math.round(d.area/0.25),dAz:0};});
   var added=P.pans.slice(n0);if(!added.length){toast('Ces versants sont déjà dessinés');return;}
   added.forEach(function(p){layout(p);});dirty();save();drawPans();render();fit();
   toast(added.length+' versant(s) détecté(s) ✓ — vérifie-les et ajuste les points avec « ✥ Modifier »',5000);
   added.reduce(function(pr,p){return pr.then(function(){return horizonScan(p);}).then(function(){save();render();});},Promise.resolve());});},
 solar:function(){if(!gkey()){toast('Il faut la clé Google (⚙️ Réglages)',4000);return;}if(mode==='solar'){mode='idle';stat();tools();return;}mode='solar';stat('☀️ Touche la maison sur la carte');tools();},
 solarAt:function(ll){return solarAt(ll);},
 delPan:function(el){if(!confirm('Supprimer ce versant ?'))return;P.pans=P.pans.filter(function(p){return p.id!==el.dataset.id;});dirty();save();drawPans();render();},
 delAll:function(){var n=P.pans.length;if(!n)return;if(!confirm('Supprimer les '+n+' versants de cette étude ?'))return;if(mode==='edit'){mode='idle';selV=null;editLayer.clearLayers();}DELALL={id:P.id,pans:JSON.parse(JSON.stringify(P.pans))};P.pans=[];selPan=null;dirty();save();drawPans();render();toast('🗑 '+n+' versants supprimés · « ↶ Remettre les versants » pour annuler',5000);},
 undoAll:function(){if(!DELALL||DELALL.id!==P.id)return;P.pans=DELALL.pans;DELALL=null;dirty();save();drawPans();render();toast('Versants remis ✓');},
 delSel:function(){var p=P.pans.find(function(x){return x.id===selPan;});if(!p)return;if(!confirm('Supprimer « '+p.name+' » ?'))return;P.pans=P.pans.filter(function(x){return x.id!==p.id;});selPan=null;dirty();save();drawPans();render();toast('Versant supprimé');},
 selEdit:function(el){selPan=el.dataset.id;window.scrollTo(0,0);ACT.startEdit();},
 lidar:function(el){var p=P.pans.find(function(x){return x.id===el.dataset.id;});if(p){p.zc=null;measure(p);}},
 flip:function(el){var p=P.pans.find(function(x){return x.id===el.dataset.id;});var fr=panFrame(p),a=p.pts,bi=0,bd=-1;for(var i=1;i<a.length;i++){var q=fr.xy[i],r=fr.xy[(i+1)%a.length],m=[(q[0]+r[0])/2-fr.p0[0],(q[1]+r[1])/2-fr.p0[1]],dd=-(m[0]*fr.n[0]+m[1]*fr.n[1]);if(dd>bd){bd=dd;bi=i;}}p.pts=a.slice(bi).concat(a.slice(0,bi));p.az=Math.round(panFrame(p).az);layout(p);dirty();save();drawPans();render();},
 fit:fit,
 relayout:function(){P.pans.forEach(function(p){if(p.tilt!=null)layout(p);});dirty();save();drawPans();render();toast('Calepinage refait');},
 calc:function(){RES=null;render();var b=document.querySelector('[data-a="calc"]');if(b)b.disabled=true;compute(function(err){if(err){toast(err,4000);render();return;}P.devis.lines=P.devis.sig?P.devis.lines:null;render();});},
 useBest:function(){P.choice={n:RES.best.n,bat:RES.best.bat,micro:false};refreshMine();if(!P.devis.sig)P.devis.lines=null;save();render();},
 pick:function(el){P.choice={n:+el.dataset.n,bat:+el.dataset.bat,micro:false};refreshMine();if(!P.devis.sig)P.devis.lines=null;save();render();},
 goDevis:function(){tab('devis');},goEtude:function(){tab('etude');},
 printEtude:function(){if(!RES)return;doPrint(reportHtml());},
 printDevis:function(){doPrint(civHtml());},
 printAll:function(){if(!RES){toast('Fais d’abord le calcul de l’étude');return;}doPrint(reportHtml()+civHtml());},
 addLine:function(){devisLines().push({d:'',u:'pce',q:1,p:0});save();render();},
 delLine:function(el){devisLines().splice(+el.dataset.i,1);save();render();},
 regen:function(){if(P.devis.sig&&!confirm('Le devis est signé. Le refaire efface la signature. Continuer ?'))return;P.devis.lines=null;P.devis.sig=null;save();render();},
 sign:openSign,
 clearReal:function(){P.cons.real=null;P.cons.realInfo='';dirty();save();render();},
 addMod:function(){DB.setUpd=Date.now();DB.prices.mods.push({n:'Nouveau panneau',wc:450,L:1.762,W:1.134,p:135,g:-0.0034});save();render();},
 export:function(){saveNow();var b=new Blob([JSON.stringify(DB)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='rtoitures-solaire-'+new Date().toISOString().slice(0,10)+'.json';a.click();},
 studies:openStudies,
 syncOn:function(){var t=($('#synctok').value||'').trim(),pw=$('#syncpw').value||'';if(!/^(ghp_|github_pat_)[A-Za-z0-9_]{20,}$/.test(t)){toast('Ce n’est pas une clé GitHub valide (ghp_…)');return;}if(pw.length<8){toast('Mot de passe : 8 caractères minimum');return;}Sync.setCfg({token:t,pass:pw});toast('Connexion à GitHub…');Sync.run().then(function(){render();Sync.start();});},
 gkeySave:function(){var k=($('#gkeyin').value||'').trim();if(!/^AIza[0-9A-Za-z_\-]{30,}$/.test(k)){toast('Ce n’est pas une clé Google valide (AIza…)');return;}try{localStorage.setItem('rts_gkey',k);}catch(e){}toast('✓ Clé Google enregistrée');render();},
 gkeyDel:function(){try{localStorage.removeItem('rts_gkey');}catch(e){}render();},
 goSync:function(){tab('prix');setTimeout(function(){var e=$('#v-prix .card');if(e)e.scrollIntoView({behavior:'smooth'});},50);},
 sendApp:function(){if(!RES){toast('Fais d’abord le calcul de l’étude');return;}var code=solPayload(),ta=$('#solOut');ta.value=code;ta.style.display='block';
  (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(code):Promise.reject()).then(function(){toast('✓ Code copié : colle-le dans l’app (chantier → ☀️ Étude photovoltaïque → 📥 Importer)',5000);},function(){ta.select();try{document.execCommand('copy');toast('✓ Code copié');}catch(e){toast('Sélectionne le code affiché et copie-le');}});},
 syncNow:function(){Sync.run().then(render);},
 syncOff:function(){if(!confirm('Déconnecter la synchro sur cet appareil ? Tes données restent ici et sur GitHub.'))return;Sync.setCfg({});render();},
 newS:function(){saveNow();P=newStudy();RES=null;W=null;GRID=null;selPan=null;closeModal();map.setView([P.lat,P.lon],14);drawPans();tab('toit');},
 openS:function(el){saveNow();P=DB.studies.find(function(s){return s.id===el.dataset.id;});RES=null;GRID=null;selPan=null;closeModal();map.setView([P.mlat||P.lat,P.mlon||P.lon],P.zoom||19);drawPans();tab('toit');},
 delS:function(el){if(!confirm('Supprimer cette étude ?'))return;DB.deleted=DB.deleted||{};DB.deleted[el.dataset.id]=Date.now();DB.studies=DB.studies.filter(function(s){return s.id!==el.dataset.id;});if(P&&P.id===el.dataset.id){P=newStudy();drawPans();render();}saveNow();openStudies();},
 close:closeModal
};
/* ===== Google Solar API : versants du toit (pente, orientation, surface) ===== */
function gsolarFetch(lat,lon){var u='https://solar.googleapis.com/v1/buildingInsights:findClosest?location.latitude='+lat.toFixed(6)+'&location.longitude='+lon.toFixed(6)+'&requiredQuality=LOW&key='+encodeURIComponent(gkey());
 return fetch(u).then(function(r){return r.json().catch(function(){return {};}).then(function(j){if(r.status===403||r.status===401)throw new Error('KEY');if(r.status===404)throw new Error('NODATA');if(!r.ok)throw new Error((j.error&&j.error.message)||('Google '+r.status));return j;});});}
function rectFromSeg(sg,o){var c=toXY([sg.center.latitude,sg.center.longitude],o),sw=toXY([sg.boundingBox.sw.latitude,sg.boundingBox.sw.longitude],o),ne=toXY([sg.boundingBox.ne.latitude,sg.boundingBox.ne.longitude],o);
 var W=Math.abs(ne[0]-sw[0]),H=Math.abs(ne[1]-sw[1]),az=(sg.azimuthDegrees||180)*RAD,pitch=(sg.pitchDegrees||0)*RAD,d=[Math.sin(az),Math.cos(az)],e=[Math.cos(az),-Math.sin(az)];
 var plan=((sg.stats&&sg.stats.areaMeters2)||W*H)*Math.cos(pitch),ex=Math.abs(e[0]),ey=Math.abs(e[1]),dx=Math.abs(d[0]),dy=Math.abs(d[1]),det=ex*dy-dx*ey,a,b;
 if(Math.abs(det)>0.25){a=(W*dy-H*dx)/det;b=(H*ex-W*ey)/det;}if(!(a>1&&b>1)){a=b=Math.sqrt(plan);}var k=Math.sqrt(plan/(a*b));a*=k;b*=k;
 var bc=[(sw[0]+ne[0])/2,(sw[1]+ne[1])/2];c=[(c[0]+bc[0])/2,(c[1]+bc[1])/2];
 function P2(s1,s2){return [c[0]+d[0]*b/2*s1+e[0]*a/2*s2,c[1]+d[1]*b/2*s1+e[1]*a/2*s2];}
 return [P2(1,-1),P2(1,1),P2(-1,1),P2(-1,-1)];}
function solarAt(ll){if(map.getZoom()<18)map.setView(ll,20,{animate:false});
 if(!P.pans.length){P.lat=ll[0];P.lon=ll[1];GRID=null;}var o=L0(),xy=toXY(ll,o);
 stat('☀️ Google Solar analyse le toit…');
 var lid=getGrid(xy[0],xy[1],22,0.5).then(function(G){return G.z.filter(function(v){return v!=null;}).length>200?detectRoof(G,xy[0],xy[1]):{err:1};}).catch(function(){return {err:1};});
 return Promise.all([gsolarFetch(ll[0],ll[1]),lid]).then(function(res){var b=res[0],L=res[1],sp=b.solarPotential||{},segs=(sp.roofSegmentStats||[]).filter(function(s){return s.stats&&s.stats.areaMeters2>=4;});
  stat();if(!segs.length){toast('Google Solar ne donne pas de versant pour ce bâtiment : utilise 🪄 Détecter le toit.',5000);return [];}
  var lp=(L&&L.pans)||[],used={},n0=P.pans.length,refined=0;
  segs.forEach(function(sg){var c=toXY([sg.center.latitude,sg.center.longitude],o),best=-1,bd=1e9;
   lp.forEach(function(d,i){if(used[i])return;var cc=centroid(d.xy),dist=Math.hypot(cc[0]-c[0],cc[1]-c[1]),daz=Math.abs(((d.az-sg.azimuthDegrees+540)%360)-180);if(dist<3&&daz<25&&Math.abs(d.tilt-sg.pitchDegrees)<12&&dist<bd){bd=dist;best=i;}});
   var poly,plane=null;if(best>=0){used[best]=1;refined++;poly=lp[best].xy;plane=lp[best].pl;}else poly=rectFromSeg(sg,o);
   var dup=P.pans.some(function(p){return inPoly(toXY(centroid(p.pts),o),poly);});if(dup)return;
   var pan=newPan(poly.map(function(q){return toLL(q,o);}),true);pan.tilt=Math.round(sg.pitchDegrees*10)/10;pan.tiltSrc='google';
   pan.gsolar={pitch:r2(sg.pitchDegrees),az:Math.round(sg.azimuthDegrees),area:r2(sg.stats.areaMeters2),shape:best>=0?'lidar':'rect'};
   if(plane)pan.plane={a:plane.a,b:plane.b,c:plane.c,lat:o.lat,lon:o.lon};else if(GRID)fitFromGrid(pan);
   pan.tilt=Math.round(sg.pitchDegrees*10)/10;pan.tiltSrc='google';pan.lidar=pan.lidar||{st:'ok',tilt:pan.tilt,az:pan.gsolar.az,rms:0,n:0,dAz:0};});
  var added=P.pans.slice(n0);P.gsolar={date:b.imageryDate?b.imageryDate.day+'/'+b.imageryDate.month+'/'+b.imageryDate.year:'',quality:b.imageryQuality||'',sun:Math.round(sp.maxSunshineHoursPerYear||0),panels:sp.maxArrayPanelsCount||0,area:Math.round(sp.maxArrayAreaMeters2||0)};
  if(!added.length){toast('Ces versants sont déjà dessinés');return [];}
  added.forEach(function(p){layout(p);});dirty();save();drawPans();render();fit();
  toast('☀️ '+added.length+' versant(s) de Google Solar'+(refined?' ('+refined+' recalé(s) sur le LiDAR)':'')+' ✓ — vérifie-les avec « ✥ Modifier »',5500);
  added.reduce(function(pr,p){return pr.then(function(){return horizonScan(p);}).then(function(){save();render();});},Promise.resolve());return added;})
 .catch(function(e){stat();var m=e&&e.message;toast(m==='KEY'?'Google refuse : active « Solar API » dans Google Cloud et ajoute-la aux restrictions de ta clé (⚙️ Réglages explique comment).':m==='NODATA'?'Google Solar n’a pas de données pour ce bâtiment : utilise 🪄 Détecter le toit.':'Google Solar indisponible ('+(m||'internet ?')+')',7000);return [];});}
function newPan(pts,silent){var pan={id:uid(),name:'Versant '+(P.pans.length+1),color:COLORS[P.pans.length%COLORS.length],pts:pts,tilt:35,tiltSrc:'défaut',margin:0.4,orient:'portrait',panels:[],horizon:null};
 if(P.pans.length===0&&!GRID){var c=centroid(pan.pts);P.lat=c[0];P.lon=c[1];}
 pan.az=Math.round(panFrame(pan).az);P.pans.push(pan);selPan=pan.id;layout(pan);dirty();save();drawPans();render();if(!silent)measure(pan);return pan;}
function gkey(){try{return localStorage.getItem('rts_gkey')||'';}catch(e){return '';}}
function H3D(){var o=L0();return {o:o,toLL:toLL,gkey:gkey,solar:function(xy){return solarAt(toLL(xy,o));},
 addPan:function(xy){var pan=newPan(xy.map(function(q){return toLL(q,o);}),true);return measure(pan);},
 movePt:function(id,k,xy){var p=P.pans.find(function(x){return x.id===id;});if(!p)return;pushHist(p);p.pts[k]=toLL(xy,o);afterGeom(p);},
 insPt:function(id,k,xy){var p=P.pans.find(function(x){return x.id===id;});if(!p)return;p.pts.splice(k,0,toLL(xy,o));afterGeom(p);},
 delPt:function(id,k){var p=P.pans.find(function(x){return x.id===id;});if(!p||p.pts.length<=3)return false;p.pts.splice(k,1);afterGeom(p);return true;},
 delPan:function(id){P.pans=P.pans.filter(function(x){return x.id!==id;});if(selPan===id)selPan=null;dirty();save();drawPans();render();},
 undo:function(){ACT.undo();},lat:function(){return P.lat;},lon:function(){return P.lon;},
 center:function(){if(!P.pans.length){var c=map.getCenter();return toXY([c.lat,c.lng],o);}var all=[];P.pans.forEach(function(p){p.pts.forEach(function(q){all.push(toXY(q,o));});});return centroid(all);},
 getGrid:function(cx,cy,half,step,pr){return getGrid(cx,cy,half,step,pr);},
 pans3d:function(G){var used=RES&&RES.mine?RES.mine.kwcPan:null,m=MOD();return P.pans.map(function(p){var fr=panFrame(p),ct=Math.cos((p.tilt||30)*RAD);
  var zf=function(x,y){var z=panZ(p,x,y);if(z!=null)return z;var g=gridAt(x,y);return g!=null?g:0;};
  if(!p.plane){var A=[];innerPts(p,G.step).pts.forEach(function(q){var z=gridAt(q[0],q[1]);if(z!=null)A.push([q[0],q[1],z]);});var f=A.length>=6?fitPlane(A):null;if(f)zf=function(x,y){return f.a*x+f.b*y+f.c;};}
  var lim=used?Math.round((used[p.id]||0)*1000/m.wc):1e9,k=0,pans=[];(p.panels||[]).forEach(function(pp){if(!pp.on)return;var c=[[pp.u,pp.s],[pp.u+p.pw,pp.s],[pp.u+p.pw,pp.s+p.ph],[pp.u,pp.s+p.ph]].map(function(us){var h=us[1]*ct;return [fr.p0[0]+fr.e[0]*us[0]-fr.n[0]*h,fr.p0[1]+fr.e[1]*us[0]-fr.n[1]*h];});pans.push({c:c,used:k++<lim});});
  return {id:p.id,name:p.name,color:p.color,xy:fr.xy,z:zf,panels:pans};});}};}
function measure(pan){var fr=panFrame(pan),c=centroid(fr.xy),rad=0;fr.xy.forEach(function(q){rad=Math.max(rad,Math.hypot(q[0]-c[0],q[1]-c[1]));});
 pan.lidar={st:'run'};render();
 return getGrid(c[0],c[1],Math.max(14,rad+5),0.5).then(function(G){
  if(GRID!==G||!getGridCovers(c))return lidarTilt(pan).then(function(){return [pan];});
  var subs=pan.noSplit?null:trySplit(pan,G);
  if(subs&&subs.length>1){var i=P.pans.indexOf(pan);if(i<0)return [pan];P.pans.splice.apply(P.pans,[i,1].concat(subs));selPan=subs[0].id;toast('Tracé coupé en '+subs.length+' versants au faîte ✓ (relevé LiDAR)',4000);return subs;}
  fitFromGrid(pan);if(!pan.lidar||pan.lidar.st==='run')pan.lidar={st:'ko',msg:'Pas assez de points LiDAR ici : indique la pente à la main.'};return [pan];})
 .then(function(list){list.forEach(function(p){if(p.az==null)p.az=Math.round(panFrame(p).az);layout(p);});dirty();save();drawPans();render();
  list.reduce(function(pr,p){return pr.then(function(){return horizonScan(p);}).then(function(){dirty();save();render();});},Promise.resolve());return list;});}
function trySplit(pan,G){var fr=panFrame(pan),poly=fr.xy,o=fr.o,regs=planesIn(G,poly,inPoly);
 // fusionner les morceaux d'un même plan (coupés par une cheminée, un velux…)
 var M=[];regs.forEach(function(r){var tgt=M.find(function(m){if(Math.hypot(m.pl.a-r.pl.a,m.pl.b-r.pl.b)>0.12)return false;var e=0;r.pts.forEach(function(p){e+=Math.abs(p[2]-(m.pl.a*p[0]+m.pl.b*p[1]+m.pl.c));});return e/r.pts.length<0.2;});
  if(tgt){tgt.pts=tgt.pts.concat(r.pts);tgt.cells=tgt.cells.concat(r.cells);tgt.pl=fitPlane(tgt.pts)||tgt.pl;}else M.push({pts:r.pts.slice(),cells:r.cells.slice(),pl:r.pl});});
 M=M.filter(function(m){return m.cells.length*G.step*G.step>=3;}).slice(0,6);
 if(M.length<2)return null;var cov=M.reduce(function(a,m){return a+m.cells.length*G.step*G.step;},0);if(cov<polyArea(poly)*0.35)return null;
 var sb=splitByPlanes(poly,M),pm=sb.part(1),pM=sb.part(-1),sm=sb.score(pm,inPoly),sM=sb.score(pM,inPoly),parts=sm>=sM?pm:pM;if(Math.max(sm,sM)<0.6)return null;
 var out=[];parts.forEach(function(xy,i){if(xy.length<3||polyArea(xy)<2)return;var pl=M[i].pl,e=pickEave(xy,pl);
  var np={id:out.length?uid():pan.id,name:out.length?'Versant '+(P.pans.length+out.length):pan.name,color:out.length?COLORS[(P.pans.length+out.length-1)%COLORS.length]:pan.color,pts:e.map(function(q){return toLL(q,o);}),tilt:pl.tilt<3?0:Math.round(pl.tilt*10)/10,tiltSrc:'lidar',margin:pan.margin,orient:pan.orient,panels:[],horizon:null,noSplit:true,
   plane:{a:pl.a,b:pl.b,c:pl.c,lat:o.lat,lon:o.lon},lidar:{st:'ok',tilt:r2(pl.tilt),az:Math.round(pl.az),rms:r2(pl.rms),n:M[i].cells.length,dAz:0}};
  np.az=Math.round(panFrame(np).az);out.push(np);});
 return out.length>1?out:null;}
function getGridCovers(c){var G=GRID;return G&&G.lat===L0().lat&&G.lon===L0().lon&&c[0]>G.x0+3&&c[1]>G.y0+3&&c[0]<G.x0+(G.n-1)*G.step-3&&c[1]<G.y0+(G.n-1)*G.step-3;}
function tab(t){if(mode==='draw')ACT.cancelDraw();if(mode==='edit'){mode='idle';selV=null;editLayer.clearLayers();stat();}curTab=t;document.querySelectorAll('#tabs button').forEach(function(b){b.classList.toggle('on',b.dataset.tab===t);});document.querySelectorAll('main>section').forEach(function(s){s.classList.toggle('hide',s.id!=='v-'+t);});
 $('#mapwrap').classList.toggle('hide',!(t==='toit'||t==='pv'));if(t==='toit'||t==='pv')setTimeout(function(){map.invalidateSize();},50);drawPans();render();window.scrollTo(0,0);
 if(t==='etude'&&!RES&&P.pans.length)ACT.calc();}
function modal(h){closeModal();var m=document.createElement('div');m.className='modal';m.id='modal';m.innerHTML='<div>'+h+'</div>';m.addEventListener('click',function(e){if(e.target===m)closeModal();});document.body.appendChild(m);}
function closeModal(){var m=$('#modal');if(m)m.remove();}
function openStudies(){saveNow();modal('<h3 style="margin-top:0">Mes études</h3><div class="btns"><button class="btn" data-a="newS">＋ Nouvelle étude</button></div>'+DB.studies.map(function(s){return '<div class="pan"><div class="ph"><span>'+esc(s.client.name||'Sans nom')+'<br><small style="font-weight:400;color:#78716c">'+esc(s.client.addr||'')+' · '+esc(s.created)+'</small></span><button class="btn sm" data-a="openS" data-id="'+s.id+'">Ouvrir</button><button class="btn s sm" data-a="delS" data-id="'+s.id+'">🗑</button></div></div>';}).join('')+'<div class="btns"><button class="btn s" data-a="close">Fermer</button></div>');}
function openSign(){modal('<h3 style="margin-top:0">Signature du client</h3><p class="note">Montant : <b>'+eur(linesHT(devisLines())*(1+P.client.vat/100))+' TVAC</b>. Le client signe avec le doigt.</p><canvas id="sigc"></canvas><label class="f">Nom du signataire<input id="sgn" value="'+esc(P.client.name)+'"></label><label class="f">Lieu<input id="sgp" value="'+esc((String(P.client.addr).match(/\d{4}\s+(.*)$/)||['',''])[1])+'"></label><label class="f"><input type="checkbox" id="sgok" style="display:inline;width:auto"> « Bon pour accord » : j’accepte ce devis et les conditions générales de vente.</label><div class="btns"><button class="btn s" id="sgclr">Effacer</button><button class="btn g" id="sgsave">Valider la signature</button><button class="btn s" data-a="close">Annuler</button></div>');
 var c=$('#sigc'),r=c.getBoundingClientRect();c.width=r.width*2;c.height=r.height*2;var x=c.getContext('2d');x.scale(2,2);x.lineWidth=2.4;x.lineCap='round';x.strokeStyle='#0b1f66';var dn=false,drawn=false,lp=null;
 function pos(e){var b=c.getBoundingClientRect();return [e.clientX-b.left,e.clientY-b.top];}
 c.addEventListener('pointerdown',function(e){dn=true;lp=pos(e);c.setPointerCapture(e.pointerId);});c.addEventListener('pointermove',function(e){if(!dn)return;var p=pos(e);x.beginPath();x.moveTo(lp[0],lp[1]);x.lineTo(p[0],p[1]);x.stroke();lp=p;drawn=true;});c.addEventListener('pointerup',function(){dn=false;});
 $('#sgclr').onclick=function(){x.clearRect(0,0,c.width,c.height);drawn=false;};
 $('#sgsave').onclick=function(){if(!drawn){toast('Le client doit signer');return;}if(!$('#sgok').checked){toast('Coche « Bon pour accord »');return;}var n=new Date();P.devis.sig=c.toDataURL('image/png');P.devis.sigName=$('#sgn').value;P.devis.sigPlace=$('#sgp').value;P.devis.sigDate=n.toISOString().slice(0,10);P.devis.sigTime=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  var num=String(P.devis.num).match(/(\d{3})$/);if(num&&+num[1]>=DB.seq)DB.seq=+num[1]+1;saveNow();closeModal();render();toast('✓ Devis signé');};}
/* import CSV de consommation (ORES / RESA / autre) */
function parseCSV(txt){var lines=txt.split(/\r?\n/).filter(function(l){return l.trim();});if(lines.length<20)return null;
 var dl=[';','\t',','].sort(function(a,b){return lines[0].split(b).length-lines[0].split(a).length;})[0];
 var head=lines[0].split(dl).map(function(s){return s.replace(/"/g,'').trim();}),vc=-1;
 head.forEach(function(h,i){if(vc<0&&/volume|kwh|consommation|valeur|value|afname|quantit/i.test(h))vc=i;});
 var unitWh=head.some(function(h){return /\(wh\)|\bwh\b/i.test(h)&&!/kwh/i.test(h);});
 var sum=new Float64Array(8784),yrs={},cnt=0,keysY={};
 for(var i=1;i<lines.length;i++){var row=lines[i],f=row.split(dl).map(function(s){return s.replace(/"/g,'').trim();});
  if(/injection|injectie|production/i.test(row))continue;
  var dm=row.match(/(\d{2})[\/.\-](\d{2})[\/.\-](\d{4})/),y,m,d;if(dm){d=+dm[1];m=+dm[2];y=+dm[3];}else{dm=row.match(/(\d{4})-(\d{2})-(\d{2})/);if(!dm)continue;y=+dm[1];m=+dm[2];d=+dm[3];}
  var tm=row.match(/[ T;,](\d{1,2}):(\d{2})/),h=tm?+tm[1]:0;
  var v=NaN;if(vc>=0&&f[vc]!=null)v=parseFloat(f[vc].replace(',','.'));if(!isFinite(v)){for(var k=f.length-1;k>=0;k--){if(/:/.test(f[k])||/\d{2}[\/.\-]\d{2}/.test(f[k])||/^\d{15,}$/.test(f[k]))continue;var x=parseFloat(f[k].replace(',','.'));if(isFinite(x)){v=x;break;}}}
  if(!isFinite(v)||v<0||m<1||m>12||h>23)continue;if(unitWh)v/=1000;
  var key=hoyKey(m-1,d,h);sum[key]+=v;keysY[y+'/'+key]=1;yrs[y]=1;cnt++;}
 if(cnt<200)return null;
 var nY={};Object.keys(keysY).forEach(function(s){var k=+s.split('/')[1];nY[k]=(nY[k]||0)+1;});
 var real=new Array(8784),tot=0,miss=0;for(var j=0;j<8784;j++){if(nY[j]){real[j]=Math.round(sum[j]/nY[j]*1000)/1000;tot+=real[j];}else{real[j]=-1;miss++;}}
 var cover=(8784-miss)/8784;return {real:real,info:cnt+' relevés importés ('+Object.keys(yrs).sort().join(', ')+'), '+Math.round(cover*100)+' % de l’année couverte, ≈ '+nf(tot/cover)+' kWh/an',annual:Math.round(tot/cover)};}
/* ================= Événements ================= */
document.addEventListener('click',function(e){var b=e.target.closest('[data-a]');if(b&&ACT[b.dataset.a]&&!b.disabled){e.preventDefault();ACT[b.dataset.a](b);return;}var t=e.target.closest('[data-tab]');if(t)tab(t.dataset.tab);});
document.addEventListener('change',function(e){var el=e.target;
 if(el.id==='csvin'&&el.files[0]){var fr=new FileReader();fr.onload=function(){var r=parseCSV(String(fr.result));if(!r){toast('Fichier non reconnu : il faut un export quart-horaire ou horaire (date, heure, kWh)',5000);return;}P.cons.real=r.real;P.cons.realInfo=r.info;P.cons.annual=r.annual;dirty();save();render();toast('✓ Consommation réelle importée');};fr.readAsText(el.files[0]);return;}
 if(el.id==='logoin'&&el.files[0]){var fl=new FileReader();fl.onload=function(){var im=new Image();im.onload=function(){var c=document.createElement('canvas'),k=Math.min(1,400/im.width);c.width=im.width*k;c.height=im.height*k;c.getContext('2d').drawImage(im,0,0,c.width,c.height);DB.company.logo=c.toDataURL('image/jpeg',0.85);DB.setUpd=Date.now();save();render();toast('✓ Logo enregistré');};im.src=fl.result;};fl.readAsDataURL(el.files[0]);return;}
 if(el.id==='coin'&&el.files[0]){var fc=new FileReader();fc.onload=function(){try{var d=JSON.parse(fc.result).rtoituresCompany;if(!d)throw 0;DB.company=Object.assign({},DB.company,d);DB.setUpd=Date.now();save();render();toast('✓ Coordonnées importées');}catch(x){toast('Fichier de coordonnées non reconnu');}};fc.readAsText(el.files[0]);return;}
 if(el.id==='impin'&&el.files[0]){var f2=new FileReader();f2.onload=function(){try{var d=JSON.parse(f2.result);if(!d.studies)throw 0;if(!confirm('Remplacer les données de ce navigateur par le fichier ('+d.studies.length+' études) ?'))return;localStorage.setItem(LS,JSON.stringify(d));load();P=DB.studies[0]||newStudy();RES=null;drawPans();render();toast('✓ Importé');}catch(x){toast('Fichier invalide');}};f2.readAsText(el.files[0]);return;}
 if(el.id==='chN'||el.id==='chB'||el.id==='chM'){var n=Math.max(1,Math.min(RES.max,Math.round(+$('#chN').value||1))),bt=Math.max(0,+$('#chB').value||0);P.choice={n:n,bat:bt,micro:$('#chM').value==='1'};refreshMine();if(!P.devis.sig)P.devis.lines=null;save();render();return;}
 if(el.dataset.l!=null){var l=devisLines()[+el.dataset.l],fk=el.dataset.f;l[fk]=(fk==='q'||fk==='p')?(parseFloat(String(el.value).replace(',','.'))||0):el.value;save();$('#dprev .docsc').innerHTML=civHtml();fitDoc();return;}
 var path=el.dataset.b||el.dataset.db;if(!path)return;if(/^link\./.test(path)&&!P.link)P.link={ref:'',site:'',code:''};var tgt=el.dataset.b?P:DB,v=el.type==='checkbox'?el.checked:el.value;
 if(el.type==='number'||el.inputMode==='decimal'){v=parseFloat(String(v).replace(',','.'));if(!isFinite(v))v=0;}
 if(path==='modIdx'||path==='client.vat'||path==='cons.flex'){v=+v;}
 if(typeof v==='number'&&!/\.az$/.test(path)&&v<0){v=0;toast('Valeur négative remplacée par 0');}
 if(/\.tilt$/.test(path))v=Math.min(80,v);
 setP(tgt,path,v);if(tgt===DB)DB.setUpd=Date.now();
 if(/^pans\.\d+\.(tilt|orient|margin)$/.test(path)||path==='modIdx'||/^prices\.mods/.test(path)){var pi=path.match(/^pans\.(\d+)/);if(pi){var pp=P.pans[+pi[1]];if(/tilt/.test(path))pp.tiltSrc='manuel';layout(pp);}else P.pans.forEach(function(p){if(p.tilt!=null)layout(p);});drawPans();}
 if(/^pans\.\d+\.az$/.test(path))drawPans();
 if(/^pans\.\d+\.name$/.test(path))drawPans();
 dirty();if(!/^devis|client\.(name|addr|gsm|email)/.test(path)&&!P.devis.sig)P.devis.lines=null;save();if(el.dataset.rr)render();else $('#hpn').textContent=(P.client.name||'Nouvelle étude')+(P.client.addr?' · '+P.client.addr:'');});
window.addEventListener('resize',fitDoc);
$('#q').addEventListener('keydown',function(e){if(e.key==='Enter')ACT.geo();});
/* ================= Démarrage ================= */
load();P=DB.studies[0]?DB.studies[0]:newStudy();
/* ouverture depuis Rtoitures App : #ref=CH-…&site=…&client=…&addr=…&code=… (le # n'est jamais envoyé au serveur) */
var LINK=(function(){var h=location.hash.replace(/^#/,'');if(!/(^|&)ref=/.test(h))return null;var o={};h.split('&').forEach(function(kv){var i=kv.indexOf('=');if(i>0)o[kv.slice(0,i)]=decodeURIComponent(kv.slice(i+1));});try{history.replaceState(null,'',location.pathname);}catch(e){}return o.ref?o:null;})();
if(LINK){var ex=DB.studies.find(function(x){return x.link&&x.link.ref===LINK.ref;});
 if(ex)P=ex;else{P=newStudy();P.client.name=LINK.client||'';P.client.addr=LINK.addr||'';}
 P.link={ref:LINK.ref,site:LINK.site||'',code:LINK.code||''};if(!P.devis.code&&LINK.code)P.devis.code=LINK.code;saveNow();}setTimeout(function(){Sync.start();},800);(function(){var d=$('#syncdot');if(d&&!Sync.on())d.textContent='☁️ Synchro';})();
initMap();if(P.pans.length){map.setView([P.mlat||P.lat,P.mlon||P.lon],P.zoom||19);}drawPans();tab('toit');
if(LINK&&!P.pans.length&&P.client.addr){$('#q').value=P.client.addr;setTimeout(function(){ACT.geo();},300);}
if(LINK)toast('🔗 Chantier '+LINK.ref+' ouvert depuis Rtoitures App',4000);
window.__RT={get map(){return map;},get P(){return P;},get RES(){return RES;},get W(){return W;},ACT:ACT,layout:layout,parseCSV:parseCSV,tab:tab};
})();
