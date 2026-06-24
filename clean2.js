const fs=require("fs");const R2D=180/Math.PI;
function absf(v){return v<0?-v:v;}
function accelAngle(d){
 const {ax,ay,az}=d,n=ax.length;let gx=ax[0],gy=ay[0],gz=az[0];const P=[],Rr=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;
  P.push(Math.atan2(gx,Math.hypot(gy,gz))*R2D);Rr.push(Math.atan2(gy,Math.hypot(gx,gz))*R2D);}
 const ap=Math.max(...P)-Math.min(...P),ar=Math.max(...Rr)-Math.min(...Rr);return ap>=ar?P:Rr;
}
function gyroSig(d){
 const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let sm=0;const out=[];for(let i=0;i<n;i++){sm=sm*0.5+s[i]*0.5;out.push(sm);}return out;
}
// piek/dal-envelope middellijn (tempo-onafhankelijk) + volledige-excursie telling
function countCycles(sig,floorAmp,minDur,decay){
 const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,last=-999,reps=0;
 for(let i=0;i<n;i++){
  const mid=(pk+tr)/2;
  if(sig[i]>pk)pk=sig[i]; else pk+=(mid-pk)*decay;
  if(sig[i]<tr)tr=sig[i]; else tr+=(mid-tr)*decay;
  const amp=(pk-tr)/2;
  if(amp<floorAmp)continue;                 // te weinig beweging (rust/begin)
  const d=sig[i]-mid;
  if(d < -amp*0.35){armed=true;}            // ging echt naar beneden
  else if(d > amp*0.35 && armed && (i-last)>=minDur){reps++;last=i;armed=false;} // kwam echt omhoog
 }
 return reps;
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
console.log("set            echt | ACCEL | GYRO");
sets.forEach(({f,d})=>{
 const a=countCycles(accelAngle(d),5,7,0.02), g=countCycles(gyroSig(d),20,5,0.04);
 console.log(f.slice(7,21).padEnd(15),String(d.final).padStart(2)," | ",String(a).padStart(3)," | ",g);
});
