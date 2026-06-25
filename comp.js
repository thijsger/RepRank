const fs=require("fs");const R2D=180/Math.PI;function absf(v){return v<0?-v:v;}
function corr(a,b){let n=a.length,ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;
 let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return c/Math.sqrt(va*vb+1e-9);}
// complementair filter -> één kantelsignaal (graden), accel traag + gyro snel
function compSignal(d,COMP){const {ax,ay,az,rx,ry,rz}=d,n=ax.length,dt=0.04;
 let gx=ax[0],gy=ay[0],gz=az[0];const pit=[],rol=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;
  pit.push(Math.atan2(gx,Math.hypot(gy,gz))*R2D);rol.push(Math.atan2(gy,Math.hypot(gx,gz))*R2D);}
 const useRoll=(Math.max(...rol)-Math.min(...rol))>(Math.max(...pit)-Math.min(...pit));
 const acc=useRoll?rol:pit;
 const da=acc.map((v,i)=>i?v-acc[i-1]:0);
 const cs=[corr(da,rx),corr(da,ry),corr(da,rz)];const gi=cs.map(c=>absf(c)).indexOf(Math.max(...cs.map(c=>absf(c))));
 const gsign=cs[gi]<0?-1:1;const gyr=(gi===0?rx:gi===1?ry:rz);
 let f=acc[0];const out=[];
 for(let i=0;i<n;i++){f=COMP*(f+gsign*gyr[i]*dt)+(1-COMP)*acc[i];out.push(f);}
 return out;
}
// excursie-detectie (volledige neer-op beweging) op het kantelsignaal
function count(sig,floor,decay,down){const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,reps=0;
 for(let i=0;i<n;i++){const mid=(pk+tr)/2,amp=(pk-tr)/2;
  if(sig[i]>pk)pk=sig[i];else pk+=(mid-pk)*decay; if(sig[i]<tr)tr=sig[i];else tr+=(mid-tr)*decay;
  if(amp<floor)continue;const dev=sig[i]-mid;
  if(dev<-amp*down){armed=true;}else if(dev>0&&armed){reps++;armed=false;}}return reps;}
const pu=JSON.parse(fs.readFileSync("/tmp/all.json")).filter(d=>d.ax&&d.ax.length>20&&d.exercise==="pushups");
let best=null;
for(const COMP of [0.9,0.95,0.98]) for(const floor of [3,5,8]) for(const decay of [0.01,0.02]) for(const down of [0.3,0.4]){
 let err=0,big=0;pu.forEach(d=>{const r=count(compSignal(d,COMP),floor,decay,down);const e=absf(r-d.final);err+=e;if(e>=3)big++;});
 if(!best||err+big*3<best.score)best={COMP,floor,decay,down,err,big,score:err+big*3};}
console.log("COMPLEMENTAIR FILTER op "+pu.length+" push-ups:");
console.log("beste:",JSON.stringify({COMP:best.COMP,floor:best.floor,decay:best.decay,down:best.down}));
console.log("MAE="+(best.err/pu.length).toFixed(2),"grote-missers(>=3)="+best.big);
pu.slice(0,14).forEach(d=>{const r=count(compSignal(d,best.COMP),best.floor,best.decay,best.down);const e=r-d.final;
 console.log(" echt="+String(d.final).padStart(2),"->"+String(r).padStart(2),(e===0?"OK":(e>0?"+":"")+e),(d.labels&&d.labels.tempo||"?"));});
