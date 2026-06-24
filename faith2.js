const fs=require("fs");function absf(v){return v<0?-v:v;}
// VOLLEDIG device-model: accel + gyro fusie met gedeelde state/lock/candidateRep
function device(d,minH,gth,accelWeak,REFR,warmup){
 const {ax,ay,az,rx,ry,rz}=d,n=ax.length;
 let tx=0,ty=0,tz=0,haveT=false,gx2=0,gy2=0,gz2=0,sx=0,sy=0,sz=0;
 let useAxis=1,mid2=0,amp2=20,haveMid2=false,state=0,aLock=false;
 let grx=0,gry=0,grz=0,gUseAxis=2,gsm=0,gState=0,gLock=false;
 let lastRep=-99999,reps=0,accelN=0,gyroN=0,t=0;
 function candidateRep(){ if(t<warmup)return; if(t-lastRep>=REFR){lastRep=t;reps++;aLock=true;gLock=true;state=0;gState=0;} }
 for(let i=0;i<n;i++){
  t=i; // tijd in samples
  // --- gyro eerst (zoals onData: processGyroDir vóór processAccel) ---
  grx=grx*0.98+absf(rx[i])*0.02;gry=gry*0.98+absf(ry[i])*0.02;grz=grz*0.98+absf(rz[i])*0.02;
  if(gState===0){gUseAxis=(grx>=gry&&grx>=grz)?0:((gry>=grz)?1:2);}
  const graw=gUseAxis===0?rx[i]:(gUseAxis===1?ry[i]:rz[i]);
  gsm=gsm*0.65+graw*0.35;
  if(gLock){if(absf(gsm)<gth)gLock=false;}
  else if(gsm>gth&&gState<=0){gState=1;}
  else if(gsm<-gth&&gState===1){gState=0;if(amp2<accelWeak){gyroN++;candidateRep();}}
  // --- accel ---
  if(!haveT){tx=ax[i];ty=ay[i];tz=az[i];haveT=true;}
  tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx2=gx2*0.97+tx*0.03;gy2=gy2*0.97+ty*0.03;gz2=gz2*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx2)*0.01;sy=sy*0.99+absf(ty-gy2)*0.01;sz=sz*0.99+absf(tz-gz2)*0.01;
  if(state===0&&!aLock){const best=(sx>=sy&&sx>=sz)?0:((sy>=sz)?1:2);
   const bV=best===0?sx:(best===1?sy:sz),cV=useAxis===0?sx:(useAxis===1?sy:sz);
   if(!haveMid2||bV>cV*1.2){if(best!==useAxis){useAxis=best;mid2=best===0?tx:(best===1?ty:tz);}}}
  const v=useAxis===0?tx:(useAxis===1?ty:tz);if(!haveMid2){mid2=v;haveMid2=true;}
  mid2=mid2*0.94+v*0.06;let dev=absf(v-mid2);
  if(dev>amp2)amp2=amp2*0.75+dev*0.25;else if(dev>amp2*0.4)amp2=amp2*0.99+dev*0.01;
  let h=amp2*0.45;if(h<minH)h=minH;
  if(aLock){if(dev<h)aLock=false;}
  else if(v>mid2+h&&state<=0){state=1;}
  else if(v<mid2-h&&state===1){state=0;accelN++;candidateRep();}
 }
 return {reps,accelN,gyroN};
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync("tuning-data/"+f)));
console.log("echt | dev(auto/accel/gyro) | port(auto/accel/gyro) | match");
sets.forEach(d=>{const r=device(d,35,14,28,8,12);
 const m=(r.accelN===d.accelN&&r.gyroN===d.gyroN&&r.reps===d.auto);
 console.log(String(d.final).padStart(3)," |",(d.auto+"/"+d.accelN+"/"+d.gyroN).padStart(8)," |",(r.reps+"/"+r.accelN+"/"+r.gyroN).padStart(10)," |",m?"✅":"✗");});
