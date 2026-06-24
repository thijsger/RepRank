const fs=require("fs");const R2D=180/Math.PI;
function absf(v){return v<0?-v:v;}
// dominante kantelhoek (graden) + swing
function accelAngle(d){
 const {ax,ay,az}=d,n=ax.length;let gx=ax[0],gy=ay[0],gz=az[0];const P=[],Rr=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;
  P.push(Math.atan2(gx,Math.hypot(gy,gz))*R2D);Rr.push(Math.atan2(gy,Math.hypot(gx,gz))*R2D);}
 const ap=Math.max(...P)-Math.min(...P),ar=Math.max(...Rr)-Math.min(...Rr);
 return {sig:ap>=ar?P:Rr, swing:Math.max(ap,ar)};
}
// gladgestreken gyro dominante as
function gyroSig(d){
 const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let sm=0;const out=[];for(let i=0;i<n;i++){sm=sm*0.5+s[i]*0.5;out.push(sm);}return out;
}
// volledige-cyclus telling op één signaal (adaptieve amplitude, min-duur)
function cycles(sig,floor,minDur){
 const n=sig.length;let base=sig[0],amp=floor,state=0,ext=0,last=-999,sign=0,reps=0;
 for(let i=0;i<n;i++){
  const dev=sig[i]-base, ad=absf(dev);
  if(ad>amp)amp=amp*0.7+ad*0.3; else if(ad>amp*0.35)amp=amp*0.99+ad*0.01;
  if(ad<amp*0.4)base=base*0.99+sig[i]*0.01;            // baseline bijregelen dicht bij rust
  if(sign===0&&amp>floor*1.5)sign=dev<0?-1:1; if(sign===0)continue;
  const s=dev*sign,dth=Math.max(amp*0.45,floor),uth=amp*0.18;
  if(state===0){if(s>dth){state=1;ext=s;}}
  else{if(s>ext)ext=s;if(s<uth&&ext>dth&&(i-last)>=minDur){state=0;last=i;reps++;}}}
 return reps;
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
let ok=0;
sets.forEach(({f,d})=>{
 const A=accelAngle(d);
 const useAccel = A.swing>=14;     // grote kanteling -> accel; anders gyro
 const reps = useAccel ? cycles(A.sig,5,8) : cycles(gyroSig(d),18,6);
 const good=reps==d.final; if(good)ok++;
 console.log(f.slice(7,21),"echt="+d.final,"swing="+A.swing.toFixed(0)+"° ->",(useAccel?"ACCEL":"GYRO "),"telt "+reps, good?"✅":"✗");
});
console.log("\n"+ok+"/"+sets.length+" goed");
