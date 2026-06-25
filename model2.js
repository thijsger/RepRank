const fs=require("fs");function absf(v){return v<0?-v:v;}
const pu=JSON.parse(fs.readFileSync("/tmp/all.json")).filter(d=>d.ax&&d.ax.length>20&&d.exercise==="pushups");
// CAUSAAL: lopende as-keuze (geen whole-set), init = eerste waarde (matcht live)
function accelSig(d){const {ax,ay,az}=d,n=ax.length;let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const o=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2);o.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}return o;}
function gyroSig(d){const {rx,ry,rz}=d,n=rx.length;let grx=0,gry=0,grz=0,sm=0;const o=[];
 for(let i=0;i<n;i++){grx=grx*0.98+absf(rx[i])*0.02;gry=gry*0.98+absf(ry[i])*0.02;grz=grz*0.98+absf(rz[i])*0.02;
  const a=(grx>=gry&&grx>=grz)?0:(gry>=grz?1:2);const raw=a===0?rx[i]:(a===1?ry[i]:rz[i]);
  sm=sm*0.5+raw*0.5;o.push(sm);}return o;}
function events(sig,floor){const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,extr=0,out=[];
 for(let i=0;i<n;i++){const mid=(pk+tr)/2,amp=(pk-tr)/2;
  if(sig[i]>pk)pk=sig[i];else pk+=(mid-pk)*0.012; if(sig[i]<tr)tr=sig[i];else tr+=(mid-tr)*0.012;
  if(amp<floor)continue;const dev=sig[i]-mid;
  if(dev<-amp*0.3){armed=true;if(dev<extr)extr=dev;}else if(dev>0&&armed){out.push({i,amp,depth:-extr});armed=false;extr=0;}}return out;}
function candidates(d){const A=accelSig(d),G=gyroSig(d);
 const ea=events(A,4).map(e=>({i:e.i,aAmp:e.amp,aDepth:e.depth,gAmp:0}));
 const eg=events(G,8).map(e=>({i:e.i,aAmp:0,aDepth:0,gAmp:e.amp}));
 const all=ea.concat(eg).sort((p,q)=>p.i-q.i);const merged=[];
 for(const c of all){const last=merged[merged.length-1];
  if(last&&c.i-last.i<8){last.aAmp=Math.max(last.aAmp,c.aAmp);last.aDepth=Math.max(last.aDepth,c.aDepth);last.gAmp=Math.max(last.gAmp,c.gAmp);}
  else merged.push(Object.assign({},c));}
 for(let k=0;k<merged.length;k++)merged[k].gap=k?merged[k].i-merged[k-1].i:99;return merged;}
function feat(c){return [1,c.aDepth/40,c.aAmp/40,c.gAmp/30,Math.min(c.gap,40)/40];}
const sets=pu.map(d=>({cands:candidates(d).map(feat),N:d.final}));
function sigmoid(z){return 1/(1+Math.exp(-z));}
function train(tr,iters,lr){let w=[0,1,1,1,-0.5];for(let it=0;it<iters;it++){const g=w.map(_=>0);
 for(const s of tr){let pred=0;const ps=[];for(const x of s.cands){const z=w.reduce((a,wi,j)=>a+wi*x[j],0);const p=sigmoid(z);ps.push(p);pred+=p;}
  const d=2*(pred-s.N);s.cands.forEach((x,k)=>{const p=ps[k],dp=p*(1-p);for(let j=0;j<w.length;j++)g[j]+=d*dp*x[j];});}
 for(let j=0;j<w.length;j++)w[j]-=lr*g[j]/tr.length;}return w;}
function predict(w,s){let p=0;for(const x of s.cands)p+=sigmoid(w.reduce((a,wi,j)=>a+wi*x[j],0));return Math.round(p);}
let err=0,big=0;
for(let t=0;t<sets.length;t++){const w=train(sets.filter((_,i)=>i!==t),400,0.05);const p=predict(w,sets[t]);const e=absf(p-sets[t].N);err+=e;if(e>=3)big++;}
console.log("CAUSAAL model (LOO cross-val):","MAE="+(err/sets.length).toFixed(2),"grote-missers="+big);
const wF=train(sets,800,0.05);
console.log("finale gewichten [bias,aDepth/40,aAmp/40,gAmp/30,gap/40]:",wF.map(w=>w.toFixed(4)).join(", "));
