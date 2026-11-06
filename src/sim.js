/* ===== Moteur de calcul : soleil, irradiance, production, conso, batterie, tarifs, finances ===== */
var RAD=Math.PI/180,DEG=180/Math.PI;
function sunPos(tMs,lat,lon){
 var d=tMs/86400000-10957.5; // jours depuis J2000.0
 var g=(357.529+0.98560028*d)*RAD,q=280.459+0.98564736*d;
 var L=(q+1.915*Math.sin(g)+0.020*Math.sin(2*g))*RAD,e=(23.439-0.00000036*d)*RAD;
 var ra=Math.atan2(Math.cos(e)*Math.sin(L),Math.cos(L)),dec=Math.asin(Math.sin(e)*Math.sin(L));
 var gmst=(18.697374558+24.06570982441908*d)%24;
 var ha=((gmst*15+lon)*RAD-ra),la=lat*RAD;
 var sel=Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha);
 var el=Math.asin(Math.max(-1,Math.min(1,sel)));
 var az=Math.atan2(Math.sin(ha),Math.cos(ha)*Math.sin(la)-Math.tan(dec)*Math.cos(la))*DEG+180;
 return {el:el*DEG,az:((az%360)+360)%360};
}
/* heure locale Bruxelles (UTC+1 / été UTC+2) */
function lastSunday(y,m){var d=new Date(Date.UTC(y,m+1,0));return d.getUTCDate()-d.getUTCDay();}
var _dstC={};
function bxl(tMs){
 var u=new Date(tMs),y=u.getUTCFullYear();
 var c=_dstC[y]||(_dstC[y]=[Date.UTC(y,2,lastSunday(y,2),1),Date.UTC(y,9,lastSunday(y,9),1)]);
 var off=(tMs>=c[0]&&tMs<c[1])?2:1,l=new Date(tMs+off*3600000);
 return {y:l.getUTCFullYear(),m:l.getUTCMonth(),d:l.getUTCDate(),h:l.getUTCHours(),wd:l.getUTCDay(),doy:Math.floor((Date.UTC(l.getUTCFullYear(),l.getUTCMonth(),l.getUTCDate())-Date.UTC(l.getUTCFullYear(),0,1))/86400000)};
}
function horizonAt(hz,az){ // hz: tableau d'élévations (°) réparties sur 360°
 if(!hz||!hz.length)return 0;var n=hz.length,x=az/360*n,i=Math.floor(x)%n,f=x-Math.floor(x);return hz[i]*(1-f)+hz[(i+1)%n]*f;
}
/* Production horaire spécifique (kWh par kWc DC, avant onduleur) d'un pan, sur toute la série météo */
function panSeries(W,pan,mod){
 var n=W.t.length,out=new Float32Array(n),beta=pan.tilt*RAD,pa=pan.az,cb=Math.cos(beta),hz=pan.horizon||null;
 var svf=1;if(hz){var s=0;for(var k=0;k<hz.length;k++){var h=Math.max(0,hz[k])*RAD;s+=Math.cos(h)*Math.cos(h);}svf=s/hz.length;}
 var gam=(mod.gamma||-0.0035),noct=mod.noct||45,lossF=1-(W.loss||0.08);
 var shadedH=0,totH=0;
 for(var i=0;i<n;i++){
  var ghi=W.ghi[i];if(ghi<=0){out[i]=0;continue;}
  var dni=W.dni[i],dhi=W.dhi[i],ta=W.ta[i];
  var sp=sunPos(W.t[i]*1000-1800000,W.lat,W.lon);
  var el=sp.el;if(el<=0.5){var poa0=dhi*(1+cb)/2*svf;out[i]=poa0/1000*(1+gam*(ta+poa0*(noct-20)/800-25))*lossF;continue;}
  var se=Math.sin(el*RAD),ce=Math.cos(el*RAD);
  var ci=se*cb+ce*Math.sin(beta)*Math.cos((sp.az-pa)*RAD);
  var shaded=hz?el<horizonAt(hz,sp.az):false;
  var ea=1367*(1+0.033*Math.cos(2*Math.PI*bxl(W.t[i]*1000).doy/365));
  var ai=Math.min(1,Math.max(0,dni/ea)),rb=Math.max(0,ci)/Math.max(0.087,se);
  var beam=(!shaded&&ci>0)?dni*ci*(1-0.05*(1/Math.max(ci,0.1)-1)):0;
  if(beam<0)beam=0;
  var circ=shaded?0:dhi*ai*rb,iso=dhi*(1-ai)*(1+cb)/2*svf,grd=ghi*0.2*(1-cb)/2;
  var poa=beam+circ+iso+grd;
  if(dni>50){totH++;if(shaded&&ci>0)shadedH++;}
  var tc=ta+poa*(noct-20)/800;
  out[i]=Math.max(0,poa/1000*(1+gam*(tc-25))*lossF);
 }
 out.shadeRatio=totH?shadedH/totH:0;
 return out;
}
/* Consommation synthétique (kWh/h) */
var PROF={
 actif:{wk:[.30,.25,.23,.22,.23,.30,.55,.85,.70,.45,.38,.38,.42,.38,.36,.40,.55,.90,1.25,1.30,1.15,.95,.70,.45],we:[.32,.27,.24,.23,.23,.26,.35,.55,.80,.90,.88,.85,.85,.75,.68,.66,.75,.95,1.20,1.25,1.10,.92,.70,.45]},
 maison:{wk:[.30,.25,.23,.22,.23,.28,.45,.70,.80,.80,.82,.85,.88,.78,.70,.68,.75,.95,1.20,1.22,1.08,.90,.68,.45],we:[.32,.27,.24,.23,.23,.26,.35,.55,.80,.90,.88,.85,.85,.75,.68,.66,.75,.95,1.20,1.25,1.10,.92,.70,.45]},
 commerce:{wk:[.25,.25,.25,.25,.25,.30,.50,.95,1.30,1.40,1.40,1.35,1.30,1.35,1.40,1.35,1.20,.85,.50,.35,.30,.28,.26,.25],we:[.25,.25,.25,.25,.25,.25,.27,.30,.35,.40,.40,.40,.40,.38,.35,.32,.30,.28,.27,.26,.26,.25,.25,.25]}
};
var SEAS=[1.28,1.20,1.08,.96,.86,.80,.80,.82,.88,1.00,1.15,1.27];
function buildCons(W,C){
 var n=W.t.length,out=new Float32Array(n),pr=PROF[C.profile]||PROF.actif;
 var i,ny=Math.max(1,Math.round(n/8766*100)/100);
 // 1) base
 var raw=new Float32Array(n),s=0;
 for(i=0;i<n;i++){var b=bxl(W.t[i]*1000),we=b.wd===0||b.wd===6;raw[i]=(we?pr.we:pr.wk)[b.h]*SEAS[b.m];s+=raw[i];}
 var base=+C.annual||0,k=s?base*ny/s:0;for(i=0;i<n;i++)out[i]=raw[i]*k;
 // 2) pompe à chaleur : degrés-heures sous 16 °C + 18 % eau chaude sanitaire
 var pac=+C.pac||0;if(pac>0){var dh=new Float32Array(n),sd=0;for(i=0;i<n;i++){dh[i]=Math.max(0,16-W.ta[i]);sd+=dh[i];}
  var kh=sd?pac*0.82*ny/sd:0,ke=pac*0.18/(8760);for(i=0;i<n;i++)out[i]+=dh[i]*kh+ke*(bxl(W.t[i]*1000).h>=11&&bxl(W.t[i]*1000).h<16?2:0.6);}
 // 3) voiture électrique
 var ve=(+C.vekm||0)*0.18;if(ve>0){var win=C.vewin==='jour'?[11,12,13,14,15,16]:C.vewin==='nuit'?[1,2,3,4,5,6]:[18,19,20,21,22];var per=ve/365/win.length;
  for(i=0;i<n;i++){var hh=bxl(W.t[i]*1000).h;if(win.indexOf(hh)>=0)out[i]+=per;}}
 // 4) consommation réelle importée : remplace la base
 if(C.real&&C.real.length===8784){var tmp=new Float32Array(n),st=0;for(i=0;i<n;i++){var r=bxl(W.t[i]*1000),key=hoyKey(r.m,r.d,r.h);var v=C.real[key];tmp[i]=v>=0?v:out[i];}
  out=tmp;if(pac>0||ve>0){/* déjà incluses dans le relevé si existantes */}}
 return out;
}
function hoyKey(m,d,h){var cum=[0,31,60,91,121,152,182,213,244,274,305,335];return (cum[m]+d-1)*24+h;}
/* prix d'achat selon l'heure locale */
function buyPrice(T,h){
 if(T.type==='mono')return +T.mono;
 if(T.type==='impact'){if(h>=17&&h<22)return +T.pic;if((h>=7&&h<11)||h>=22||h<1)return +T.med;return +T.eco;}
 return ((h>=7&&h<11)||(h>=17&&h<22))?+T.hp:+T.hc;
}
/* Simulation d'un scénario : production (kWh/h) déjà calculée, conso, batterie, pilotage */
function simulate(W,prod,cons,opt,T){
 var n=W.t.length,bat=+opt.bat||0,eff=Math.sqrt(0.92),pmax=bat?Math.max(2.5,bat*0.5):0,soc=bat*0.5,smin=bat*0.08;
 var flex=+opt.flex||0,inj=+T.inj||0;
 var Y={},cur=null;
 function yr(y){return Y[y]||(Y[y]={prod:0,cons:0,self:0,inj:0,grid:0,billNo:0,billPv:0,injEur:0,m:new Array(12).fill(0).map(function(){return {p:0,c:0,s:0};}),hrs:0});}
 // pilotage : par jour, déplacer une part de la conso vers les heures de surplus
 var c2=cons;
 if(flex>0){c2=new Float32Array(cons);var i0=0;
  while(i0<n){var l0=bxl(W.t[i0]*1000),i1=i0;while(i1<n){var l1=bxl(W.t[i1]*1000);if(l1.d!==l0.d||l1.m!==l0.m)break;i1++;}
   var dc=0,sur=0,j;for(j=i0;j<i1;j++){dc+=cons[j];sur+=Math.max(0,prod[j]-cons[j]);}
   var mv=Math.min(dc*flex,sur*0.9);
   if(mv>0.01){var non=0;for(j=i0;j<i1;j++)if(prod[j]<=cons[j])non+=cons[j];
    if(non>0){var take=Math.min(mv,non*0.6);for(j=i0;j<i1;j++){if(prod[j]<=cons[j])c2[j]-=cons[j]/non*take;else c2[j]+=Math.max(0,prod[j]-cons[j])/sur*take;}}}
   i0=i1;}
 }
 for(var i=0;i<n;i++){
  var l=bxl(W.t[i]*1000),y=yr(l.y),p=prod[i],c=c2[i],pr=buyPrice(T,l.h);
  y.hrs++;y.prod+=p;y.cons+=c;y.billNo+=cons[i]*pr;
  var direct=Math.min(p,c),sur=p-direct,def=c-direct,fromBat=0,toBat=0;
  if(bat){if(sur>0){toBat=Math.min(sur,pmax,(bat-soc)/eff);soc+=toBat*eff;sur-=toBat;}
   else if(def>0){fromBat=Math.min(def,pmax,(soc-smin)*eff);if(fromBat<0)fromBat=0;soc-=fromBat/eff;def-=fromBat;}}
  y.self+=direct+fromBat;y.inj+=sur;y.grid+=def;y.billPv+=def*pr;y.injEur+=sur*inj;
  var mm=y.m[l.m];mm.p+=p;mm.c+=c;mm.s+=direct+fromBat;
 }
 var ks=Object.keys(Y).filter(function(k){return Y[k].hrs>8000;});if(!ks.length)ks=Object.keys(Y);
 var A={prod:0,cons:0,self:0,inj:0,grid:0,billNo:0,billPv:0,injEur:0,m:new Array(12).fill(0).map(function(){return {p:0,c:0,s:0};}),years:[]};
 ks.forEach(function(k){var y=Y[k];['prod','cons','self','inj','grid','billNo','billPv','injEur'].forEach(function(f){A[f]+=y[f]/ks.length;});y.m.forEach(function(mm,j){A.m[j].p+=mm.p/ks.length;A.m[j].c+=mm.c/ks.length;A.m[j].s+=mm.s/ks.length;});A.years.push({y:+k,prod:y.prod,save:y.billNo-y.billPv+y.injEur});});
 A.autoc=A.prod?A.self/A.prod:0;A.autonomy=A.cons?A.self/A.cons:0;
 return A;
}
function finance(F,inv,save1,opt){
 var cf=[-inv],cum=-inv,pay=null,van=-inv,rows=[],r=(+F.disc||3)/100,infl=(+F.infl||2)/100,deg=(+F.deg||0.4)/100;
 for(var y=1;y<=25;y++){
  var s=save1*Math.pow(1+infl,y-1)*Math.pow(1-deg,y-1)-(+F.maint||0)*Math.pow(1+infl,y-1),x=0;
  if(y===(+F.invYear||13)&&opt.invCost)x+=opt.invCost;
  if(y===(+F.batYear||15)&&opt.batCost)x+=opt.batCost*(+F.batRep||50)/100;
  var net=s-x;cf.push(net);var prev=cum;cum+=net;van+=net/Math.pow(1+r,y);
  if(pay===null&&cum>=0)pay=y-1+(-prev)/(net||1);
  rows.push({y:y,s:s,x:x,cum:cum});
 }
 var lo=-0.99,hi=1,irr=null;function npv(rt){var v=0;for(var k=0;k<cf.length;k++)v+=cf[k]/Math.pow(1+rt,k);return v;}
 if(npv(lo)*npv(hi)<0){for(var it=0;it<80;it++){var mid=(lo+hi)/2;if(npv(mid)>0)lo=mid;else hi=mid;}irr=(lo+hi)/2;}
 return {pay:pay,van:van,irr:irr,gain:cum,rows:rows};
}
/* Météo de secours (si internet indisponible) : profil ciel clair ajusté aux moyennes belges */
function synthWeather(lat,lon){
 var GHI=[22,38,75,115,145,150,150,128,90,55,26,17],TA=[3,4,7,10,14,17,19,19,15,11,6,3];
 var t=[],ghi=[],dni=[],dhi=[],ta=[],y=2023,start=Date.UTC(y,0,1)/1000,days={},sums=new Array(12).fill(0),cs=[];
 for(var i=0;i<8760;i++){var ts=start+i*3600+3600;var sp=sunPos(ts*1000-1800000,lat,lon);var v=sp.el>0?Math.pow(Math.sin(sp.el*RAD),1.2)*1000:0;cs.push(v);sums[new Date(ts*1000-1800000).getUTCMonth()]+=v/1000;t.push(ts);}
 for(i=0;i<8760;i++){var m=new Date(t[i]*1000-1800000).getUTCMonth(),g=cs[i]*GHI[m]/sums[m];var kt=Math.min(.8,GHI[m]/(sums[m]*1.15));var df=Math.min(1,Math.max(.25,1-1.1*kt));
  var se=Math.max(.05,Math.sin(Math.max(0,sunPos(t[i]*1000-1800000,lat,lon).el)*RAD));ghi.push(g);dhi.push(g*df);dni.push(g>0?g*(1-df)/se:0);
  var h=new Date(t[i]*1000).getUTCHours();ta.push(TA[m]+4*Math.sin((h-9)/24*2*Math.PI));}
 return {t:t,ghi:ghi,dni:dni,dhi:dhi,ta:ta,lat:lat,lon:lon,synthetic:true};
}
if(typeof module!=='undefined')module.exports={sunPos:sunPos,bxl:bxl,panSeries:panSeries,buildCons:buildCons,simulate:simulate,finance:finance,synthWeather:synthWeather,buyPrice:buyPrice};
