const fs=require("fs");function absf(v){return v<0?-v:v;}
const pu=JSON.parse(fs.readFileSync("/tmp/all.json")).filter(d=>d.ax&&d.ax.length>20&&d.exercise==="pushups");

// ---- kandidaat-events met features (losse detectie = hoge recall) ----
function accelSig(d){const {ax,ay,az}=d,n=ax.length;let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const o=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2);o.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}return o;}
function gyroSig(d){const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let sm=0;const o=[];for(let i=0;i<n;i++){sm=sm*0.5+s[i]*0.5;o.push(sm);}return o;}
// excursie-events met lokale amplitude
function events(sig,floor){const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,extr=0,out=[];
 for(let i=0;i<n;i++){const mid=(pk+tr)/2,amp=(pk-tr)/2;
  if(sig[i]>pk)pk=sig[i];else pk+=(mid-pk)*0.012; if(sig[i]<tr)tr=sig[i];else tr+=(mid-tr)*0.012;
  if(amp<floor)continue;const dev=sig[i]-mid;
  if(dev<-amp*0.3){armed=true;if(dev<extr)extr=dev;}
  else if(dev>0&&armed){out.push({i,amp,depth:-extr});armed=false;extr=0;}}return out;}
// kandidaten = accel- en gyro-events samengevoegd; per kandidaat features
function candidates(d){
 const A=accelSig(d),G=gyroSig(d);
 const ea=events(A,4).map(e=>({i:e.i,aAmp:e.amp,aDepth:e.depth,gAmp:0}));
 const eg=events(G,8).map(e=>({i:e.i,aAmp:0,aDepth:0,gAmp:e.amp}));
 const all=ea.concat(eg).sort((p,q)=>p.i-q.i);
 // dichtbij elkaar (<8 samples) samenvoegen tot één kandidaat, features combineren
 const merged=[];for(const c of all){const last=merged[merged.length-1];
  if(last&&c.i-last.i<8){last.aAmp=Math.max(last.aAmp,c.aAmp);last.aDepth=Math.max(last.aDepth,c.aDepth);last.gAmp=Math.max(last.gAmp,c.gAmp);}
  else merged.push(Object.assign({},c));}
 for(let k=0;k<merged.length;k++)merged[k].gap=k?merged[k].i-merged[k-1].i:99;
 return merged;
}
// feature-vector (genormaliseerd, schaal-ongevoelig)
function feat(c){return [1, c.aDepth/40, c.aAmp/40, c.gAmp/30, Math.min(c.gap,40)/40];}
const sets=pu.map(d=>({cands:candidates(d).map(feat),N:d.final}));

// ---- logistisch counting-model: pred=Σσ(w·x), loss=(pred-N)^2 ----
function sigmoid(z){return 1/(1+Math.exp(-z));}
function train(train,iters,lr){
 let w=[0,1,1,1,-0.5];
 for(let it=0;it<iters;it++){const g=w.map(_=>0);
  for(const s of train){let pred=0;const ps=[];
   for(const x of s.cands){const z=w.reduce((a,wi,j)=>a+wi*x[j],0);const p=sigmoid(z);ps.push(p);pred+=p;}
   const d=2*(pred-s.N);
   s.cands.forEach((x,k)=>{const p=ps[k];const dp=p*(1-p);for(let j=0;j<w.length;j++)g[j]+=d*dp*x[j];});}
  for(let j=0;j<w.length;j++)w[j]-=lr*g[j]/train.length;}
 return w;}
function predict(w,s){let pred=0;for(const x of s.cands)pred+=sigmoid(w.reduce((a,wi,j)=>a+wi*x[j],0));return Math.round(pred);}

// leave-one-out cross-validatie
let err=0,big=0;const preds=[];
for(let t=0;t<sets.length;t++){
 const tr=sets.filter((_,i)=>i!==t);const w=train(tr,400,0.05);
 const p=predict(w,sets[t]);preds.push(p);const e=absf(p-sets[t].N);err+=e;if(e>=3)big++;}
console.log("MODEL (leave-one-out cross-validatie) op "+sets.length+" push-ups:");
console.log("MAE="+(err/sets.length).toFixed(2),"grote-missers(>=3)="+big,"exact="+preds.filter((p,i)=>p===sets[i].N).length+"/"+sets.length);
preds.slice(0,14).forEach((p,i)=>{const e=p-sets[i].N;console.log(" echt="+String(sets[i].N).padStart(2),"->model "+String(p).padStart(2),(e===0?"OK":(e>0?"+":"")+e));});

// ---- finale gewichten op ALLE data (voor deployment) ----
const wFinal=train(sets,800,0.05);
console.log("\nFINALE GEWICHTEN (voor het horloge):");
console.log("[bias, aDepth/40, aAmp/40, gAmp/30, gap/40] =");
console.log(wFinal.map(w=>w.toFixed(4)).join(", "));
// check soft-sum vs hard-threshold (P>0.5) voor live tellen
let errSoft=0,errHard=0;
sets.forEach(s=>{let soft=0,hard=0;for(const x of s.cands){const p=sigmoid(wFinal.reduce((a,wi,j)=>a+wi*x[j],0));soft+=p;if(p>0.5)hard++;}
 errSoft+=absf(Math.round(soft)-s.N);errHard+=absf(hard-s.N);});
console.log("in-sample MAE: soft-sum="+(errSoft/sets.length).toFixed(2),"hard(P>0.5)="+(errHard/sets.length).toFixed(2));
