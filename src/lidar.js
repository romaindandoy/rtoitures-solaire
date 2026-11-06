/* ===== LiDAR Wallonie : lecture par paquets, grille 3D, détection des pans ===== */
var GEO='https://geoservices.wallonie.be/arcgis/rest/services/';
function pixVal(r){var a=r.attributes||{},v=null;for(var k in a){if(/pixel value|stretched value/i.test(k)){v=parseFloat(String(a[k]).replace(',','.'));break;}}if(v==null&&r.value!=null)v=parseFloat(r.value);return (isFinite(v)&&v>-100&&v<1000)?v:null;}
/* pts : [[lat,lon],...] -> Promise<[z|null]> ; 500 points par requête POST */
function lidarBatch(svc,pts,onProg){var out=new Array(pts.length).fill(null),chunks=[],i;for(i=0;i<pts.length;i+=500)chunks.push(i);var done=0;
 function one(st){var sl=pts.slice(st,st+500),lo=1e9,la=1e9,LO=-1e9,LA=-1e9;sl.forEach(function(p){la=Math.min(la,p[0]);LA=Math.max(LA,p[0]);lo=Math.min(lo,p[1]);LO=Math.max(LO,p[1]);});
  var fd=new URLSearchParams({f:'json',geometryType:'esriGeometryMultipoint',sr:'4326',layers:'all',tolerance:'0',returnGeometry:'false',imageDisplay:'400,400,96',mapExtent:[lo-0.0003,la-0.0003,LO+0.0003,LA+0.0003].join(','),geometry:JSON.stringify({points:sl.map(function(p){return [p[1],p[0]];}),spatialReference:{wkid:4326}})});
  return fetch(GEO+'RELIEF/'+svc+'/MapServer/identify',{method:'POST',body:fd}).then(function(r){return r.json();}).then(function(j){var R=j.results||[];if(R.length===sl.length)R.forEach(function(r,k){out[st+k]=pixVal(r);});else R.forEach(function(r,k){if(k<sl.length)out[st+k]=pixVal(r);});})
   .catch(function(){}).then(function(){done++;onProg&&onProg(done/chunks.length);});}
 var q=chunks.slice();function worker(){if(!q.length)return Promise.resolve();return one(q.shift()).then(worker);}
 return Promise.all([worker(),worker(),worker(),worker()]).then(function(){return out;});}
/* grille régulière autour d'un centre (m) ; o = repère local {lat,lon,kx,ky} */
function lidarGrid(o,cx,cy,half,step,withGround,onProg){var n=Math.round(2*half/step)+1,pts=[],xy=[];
 for(var j=0;j<n;j++)for(var i=0;i<n;i++){var x=cx-half+i*step,y=cy-half+j*step;xy.push([x,y]);pts.push([o.lat+y/o.ky,o.lon+x/o.kx]);}
 var pa=lidarBatch('WALLONIE_MNS_2021_2022',pts,function(f){onProg&&onProg(f*(withGround?0.6:1));});
 return pa.then(function(zs){var G={n:n,step:step,x0:cx-half,y0:cy-half,z:zs};if(!withGround)return G;
  // terrain (MNT) sur une grille 4x plus lâche
  var gs=step*4,gn=Math.round(2*half/gs)+1,gp=[];for(var j=0;j<gn;j++)for(var i=0;i<gn;i++)gp.push([o.lat+(cy-half+j*gs)/o.ky,o.lon+(cx-half+i*gs)/o.kx]);
  return lidarBatch('WALLONIE_MNT_2021_2022',gp,function(f){onProg&&onProg(0.6+0.4*f);}).then(function(gz){G.gn=gn;G.gs=gs;G.gz=gz;return G;});});}
function gZ(G,i,j){if(i<0||j<0||i>=G.n||j>=G.n)return null;return G.z[j*G.n+i];}
function gGround(G,x,y){if(!G.gz)return null;var fi=(x-G.x0)/G.gs,fj=(y-G.y0)/G.gs,i=Math.max(0,Math.min(G.gn-2,Math.floor(fi))),j=Math.max(0,Math.min(G.gn-2,Math.floor(fj))),u=fi-i,v=fj-j;
 var a=G.gz[j*G.gn+i],b=G.gz[j*G.gn+i+1],c=G.gz[(j+1)*G.gn+i],d=G.gz[(j+1)*G.gn+i+1];if(a==null||b==null||c==null||d==null)return a||b||c||d;return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
function fitPlane(P3){var s={xx:0,xy:0,yy:0,x:0,y:0,n:P3.length,xz:0,yz:0,z:0};if(P3.length<3)return null;var mx=0,my=0;P3.forEach(function(a){mx+=a[0];my+=a[1];});mx/=P3.length;my/=P3.length;
 P3.forEach(function(a){var x=a[0]-mx,y=a[1]-my;s.xx+=x*x;s.xy+=x*y;s.yy+=y*y;s.x+=x;s.y+=y;s.xz+=x*a[2];s.yz+=y*a[2];s.z+=a[2];});
 var X=solve3([[s.xx,s.xy,s.x],[s.xy,s.yy,s.y],[s.x,s.y,s.n]],[s.xz,s.yz,s.z]);if(!X)return null;
 var a=X[0],b=X[1],c=X[2]-a*mx-b*my,rm=0;P3.forEach(function(p){var e=p[2]-(a*p[0]+b*p[1]+c);rm+=e*e;});
 return {a:a,b:b,c:c,rms:Math.sqrt(rm/P3.length),tilt:Math.atan(Math.hypot(a,b))*DEG,az:((Math.atan2(-a,-b)*DEG)+360)%360};}
function solve3(M,B){var a=M.map(function(r,i){return r.concat([B[i]]);});for(var i=0;i<3;i++){var mx=i;for(var k=i+1;k<3;k++)if(Math.abs(a[k][i])>Math.abs(a[mx][i]))mx=k;var t=a[i];a[i]=a[mx];a[mx]=t;if(Math.abs(a[i][i])<1e-9)return null;for(k=0;k<3;k++)if(k!==i){var f=a[k][i]/a[i][i];for(var j=i;j<4;j++)a[k][j]-=f*a[i][j];}}return [a[0][3]/a[0][0],a[1][3]/a[1][1],a[2][3]/a[2][2]];}
/* détection des pans du bâtiment situé au point (cx,cy) */
function detectRoof(G,cx,cy){var n=G.n,s=G.step,N=n*n,i,j,k;
 function X(i){return G.x0+i*s;}function Y(j){return G.y0+j*s;}
 var hag=new Float32Array(N),nx=new Float32Array(N),ny=new Float32Array(N),ok=new Uint8Array(N);
 for(j=1;j<n-1;j++)for(i=1;i<n-1;i++){k=j*n+i;var z=G.z[k];if(z==null)continue;var g=gGround(G,X(i),Y(j));hag[k]=g==null?99:z-g;
  var pts=[];for(var dj=-1;dj<=1;dj++)for(var di=-1;di<=1;di++){var zz=gZ(G,i+di,j+dj);if(zz!=null)pts.push([di*s,dj*s,zz]);}
  if(pts.length<8)continue;var f=fitPlane(pts);if(!f)continue;nx[k]=f.a;ny[k]=f.b;if(f.rms<0.12&&hag[k]>2.2&&f.tilt<70)ok[k]=1;}
 // bâtiment sous le viseur : composante connexe des cellules hautes
 var ci=Math.round((cx-G.x0)/s),cj=Math.round((cy-G.y0)/s),seed=-1,best=1e9;
 for(j=Math.max(0,cj-6);j<=Math.min(n-1,cj+6);j++)for(i=Math.max(0,ci-6);i<=Math.min(n-1,ci+6);i++){k=j*n+i;if(hag[k]>2.2){var d=(i-ci)*(i-ci)+(j-cj)*(j-cj);if(d<best){best=d;seed=k;}}}
 if(seed<0)return {err:'Aucun bâtiment trouvé sous le viseur (relevé 2021-2022).'};
 var bld=new Uint8Array(N),st=[seed];bld[seed]=1;while(st.length){k=st.pop();var ki=k%n,kj=(k-ki)/n;[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var a=ki+d[0],b=kj+d[1];if(a<0||b<0||a>=n||b>=n)return;var q=b*n+a;if(!bld[q]&&hag[q]>2.0){bld[q]=1;st.push(q);}});}
 // croissance de régions planes
 var lab=new Int32Array(N).fill(-1),regs=[],order=[];for(k=0;k<N;k++)if(ok[k]&&bld[k])order.push(k);
 order.sort(function(p,q){return (Math.hypot(nx[p],ny[p])-Math.hypot(nx[q],ny[q]))*0;});
 order.forEach(function(sk){if(lab[sk]>=0)return;var id=regs.length,cells=[sk],P3=[[X(sk%n),Y((sk-sk%n)/n),G.z[sk]]],pl={a:nx[sk],b:ny[sk],c:G.z[sk]-nx[sk]*X(sk%n)-ny[sk]*Y((sk-sk%n)/n)},q=[sk];lab[sk]=id;var add=0;
  while(q.length){var k2=q.shift(),i2=k2%n,j2=(k2-i2)/n;[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var a=i2+d[0],b=j2+d[1];if(a<1||b<1||a>=n-1||b>=n-1)return;var r=b*n+a;if(lab[r]>=0||!ok[r]||!bld[r])return;
   var dn=Math.hypot(nx[r]-pl.a,ny[r]-pl.b);var zr=G.z[r],e=Math.abs(zr-(pl.a*X(a)+pl.b*Y(b)+pl.c));if(dn<0.16&&e<0.22){lab[r]=id;cells.push(r);q.push(r);P3.push([X(a),Y(b),zr]);add++;if(add%25===0){var f=fitPlane(P3);if(f)pl=f;}}});}
  var f=fitPlane(P3);regs.push({id:id,cells:cells,pl:f||pl});});
 // garder les vrais pans
 var keep=regs.filter(function(r){return r.cells.length*s*s>=5&&r.pl&&r.pl.rms<0.2;}).sort(function(a,b){return b.cells.length-a.cells.length;}).slice(0,10);
 if(!keep.length)return {err:'Pas de pan net détecté : dessine-le à la main.'};
 return {pans:keep.map(function(r){return regionToPan(G,r,lab);}).filter(Boolean)};}
function regionToPan(G,r,lab){var n=G.n,s=G.step,set={};r.cells.forEach(function(k){set[k]=1;});
 // fermeture : combler les trous d'une cellule
 r.cells.slice().forEach(function(k){var i=k%n,j=(k-i)/n;[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(d){var q=(j+d[1])*n+i+d[0];if(!set[q]){var c=0;[[1,0],[-1,0],[0,1],[0,-1]].forEach(function(e){if(set[(j+d[1]+e[1])*n+i+d[0]+e[0]])c++;});if(c>=3)set[q]=1;}});});
 // contour : arêtes de cellules au bord, chaînées
 var E={},cnt=0;function key(x,y){return x+','+y;}
 Object.keys(set).forEach(function(ks){var k=+ks,i=k%n,j=(k-i)/n;
  if(!set[k-n])E[key(i,j)]=key(i+1,j);if(!set[k+1])E[key(i+1,j)]=key(i+1,j+1);if(!set[k+n])E[key(i+1,j+1)]=key(i,j+1);if(!set[k-1])E[key(i,j+1)]=key(i,j);});
 var loops=[],used={};Object.keys(E).forEach(function(st){if(used[st])return;var L=[],c=st,g=0;while(c&&!used[c]&&g<100000){used[c]=1;L.push(c);c=E[c];g++;}if(L.length>3)loops.push(L);});
 if(!loops.length)return null;loops.sort(function(a,b){return b.length-a.length;});
 var pts=loops[0].map(function(c){var p=c.split(',');return [G.x0+(+p[0]-0.5)*s,G.y0+(+p[1]-0.5)*s];});
 var simp=dp(pts.concat([pts[0]]),0.45);simp.pop();if(simp.length<3)return null;
 simp=regularize(simp,r.pl.az);if(!simp||simp.length<3)return null;
 // gouttière = arête la plus basse et perpendiculaire à la pente
 var dx=Math.sin(r.pl.az*RAD),dy=Math.cos(r.pl.az*RAD),bi=0,bs=-1e9;
 for(var i=0;i<simp.length;i++){var a=simp[i],b=simp[(i+1)%simp.length],ex=b[0]-a[0],ey=b[1]-a[1],L=Math.hypot(ex,ey);if(L<0.8)continue;var par=Math.abs((ex*dx+ey*dy)/L),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,down=mx*dx+my*dy;var sc=down*1.0-par*20+L*0.05;if(sc>bs){bs=sc;bi=i;}}
 simp=simp.slice(bi).concat(simp.slice(0,bi));
 return {xy:simp,tilt:r.pl.tilt,az:r.pl.az,rms:r.pl.rms,area:r.cells.length*s*s,pl:r.pl};}
function dp(P,t){if(P.length<3)return P.slice();var a=P[0],b=P[P.length-1],mi=0,md=-1;for(var i=1;i<P.length-1;i++){var d=segD(P[i],a,b);if(d>md){md=d;mi=i;}}if(md>t){var l=dp(P.slice(0,mi+1),t),r=dp(P.slice(mi),t);return l.slice(0,-1).concat(r);}return [a,b];}
function segD(p,a,b){var dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy,t=l?((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l:0;t=Math.max(0,Math.min(1,t));return Math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1]);}
/* redresse les arêtes presque parallèles / perpendiculaires à la pente */
function regularize(P,az){var m=P.length,base=Math.atan2(Math.cos(az*RAD),Math.sin(az*RAD)),lines=[];
 for(var i=0;i<m;i++){var a=P[i],b=P[(i+1)%m],ang=Math.atan2(b[1]-a[1],b[0]-a[0]),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,best=ang;
  for(var q=0;q<4;q++){var c=base+q*Math.PI/2,d=Math.atan2(Math.sin(ang-c),Math.cos(ang-c));if(Math.abs(d)<14*RAD){best=c;break;}}
  lines.push({p:[mx,my],d:[Math.cos(best),Math.sin(best)]});}
 var out=[];for(i=0;i<m;i++){var L1=lines[(i-1+m)%m],L2=lines[i],den=L1.d[0]*L2.d[1]-L1.d[1]*L2.d[0];
  if(Math.abs(den)<0.15){out.push(P[i]);continue;}var t=((L2.p[0]-L1.p[0])*L2.d[1]-(L2.p[1]-L1.p[1])*L2.d[0])/den,x=L1.p[0]+L1.d[0]*t,y=L1.p[1]+L1.d[1]*t;
  if(Math.hypot(x-P[i][0],y-P[i][1])>2)out.push(P[i]);else out.push([x,y]);}
 // supprimer les sommets en ligne droite
 var o2=[];for(i=0;i<out.length;i++){var p=out[(i-1+out.length)%out.length],c=out[i],nx=out[(i+1)%out.length];if(segD(c,p,nx)>0.15)o2.push(c);}return o2;}
/* plans de toit à l'intérieur d'un tracé (pour couper un tracé en versants) */
function planesIn(G,poly,inPolyFn){var n=G.n,s=G.step,N=n*n,i,j,k,nx=new Float32Array(N),ny=new Float32Array(N),ok=new Uint8Array(N);
 function X(i){return G.x0+i*s;}function Y(j){return G.y0+j*s;}
 for(j=1;j<n-1;j++)for(i=1;i<n-1;i++){k=j*n+i;if(G.z[k]==null||!inPolyFn([X(i),Y(j)],poly))continue;var pts=[];for(var dj=-1;dj<=1;dj++)for(var di=-1;di<=1;di++){var zz=gZ(G,i+di,j+dj);if(zz!=null)pts.push([di*s,dj*s,zz]);}
  if(pts.length<8)continue;var f=fitPlane(pts);if(!f)continue;nx[k]=f.a;ny[k]=f.b;if(f.rms<0.12&&f.tilt<70)ok[k]=1;}
 var lab=new Int32Array(N).fill(-1),regs=[];
 for(k=0;k<N;k++){if(!ok[k]||lab[k]>=0)continue;var id=regs.length,cells=[k],ki=k%n,P3=[[X(ki),Y((k-ki)/n),G.z[k]]],pl={a:nx[k],b:ny[k],c:G.z[k]-nx[k]*X(ki)-ny[k]*Y((k-ki)/n)},q=[k],add=0;lab[k]=id;
  while(q.length){var k2=q.shift(),i2=k2%n,j2=(k2-i2)/n;for(var d=0;d<4;d++){var a=i2+[1,-1,0,0][d],b=j2+[0,0,1,-1][d];if(a<1||b<1||a>=n-1||b>=n-1)continue;var r=b*n+a;if(lab[r]>=0||!ok[r])continue;
   if(Math.hypot(nx[r]-pl.a,ny[r]-pl.b)<0.16&&Math.abs(G.z[r]-(pl.a*X(a)+pl.b*Y(b)+pl.c))<0.22){lab[r]=id;cells.push(r);q.push(r);P3.push([X(a),Y(b),G.z[r]]);if(++add%25===0){var f2=fitPlane(P3);if(f2)pl=f2;}}}}
  regs.push({cells:cells,pl:fitPlane(P3)||pl,pts:P3});}
 return regs.filter(function(r){return r.cells.length*s*s>=3&&r.pl.rms<0.2;}).sort(function(a,b){return b.cells.length-a.cells.length;});}
function clipHalf(P,f){var out=[];for(var i=0;i<P.length;i++){var a=P[i],b=P[(i+1)%P.length],fa=f(a),fb=f(b);if(fa<=0)out.push(a);if((fa<=0)!==(fb<=0)){var t=fa/(fa-fb);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
/* découpe le tracé selon l'enveloppe des plans (min pour un toit en bâtière/croupe, max pour les noues) */
function splitByPlanes(poly,regs){function part(sign){return regs.map(function(r,i){var P=poly.slice();regs.forEach(function(o,j){if(i===j||!P.length)return;P=clipHalf(P,function(p){return sign*((r.pl.a-o.pl.a)*p[0]+(r.pl.b-o.pl.b)*p[1]+(r.pl.c-o.pl.c));});});return P;});}
 function score(parts,inP){var ok=0,tot=0;regs.forEach(function(r,i){r.pts.forEach(function(p,k){if(k%3)return;tot++;if(parts[i].length>=3&&inP([p[0],p[1]],parts[i]))ok++;});});return tot?ok/tot:0;}
 return {part:part,score:score};}
function pickEave(xy,pl){var dx=Math.sin(pl.az*RAD),dy=Math.cos(pl.az*RAD),bi=0,bs=-1e9;
 for(var i=0;i<xy.length;i++){var a=xy[i],b=xy[(i+1)%xy.length],ex=b[0]-a[0],ey=b[1]-a[1],L=Math.hypot(ex,ey);if(L<0.8)continue;var par=Math.abs((ex*dx+ey*dy)/L),down=(a[0]+b[0])/2*dx+(a[1]+b[1])/2*dy,sc=down-par*20+L*0.05;if(sc>bs){bs=sc;bi=i;}}
 return xy.slice(bi).concat(xy.slice(0,bi));}
