const fs=require("fs");function absf(v){return v<0?-v:v;}
// EXACTE port van RepCounter.processAccel (push-ups: minH=35, K=0.45, gyro uit voor deze test)
function deviceAccel(d, minH){
 const {ax,ay,az}=d,n=ax.length;
 let tx=ax[0],ty=ay[0],tz=az[0];
 let gx2=tx,gy2=ty,gz2=tz, sx=0,sy=0,sz=0;
 let useAxis=1, mid2=0, amp2=20, haveMid2=false, state=0, aLock=false;
 let last=-999, reps=0; const REFR=8; // 320ms ~ 8 samples @25Hz
 for(let i=0;i<n;i++){
  tx=tx*0.85+ax[i]*0.15; ty=ty*0.85+ay[i]*0.15; tz=tz*0.85+az[i]*0.15;
  gx2=gx2*0.97+tx*0.03; gy2=gy2*0.97+ty*0.03; gz2=gz2*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx2)*0.01; sy=sy*0.99+absf(ty-gy2)*0.01; sz=sz*0.99+absf(tz-gz2)*0.01;
  if(state===0 && !aLock){
   const best=(sx>=sy&&sx>=sz)?0:((sy>=sz)?1:2);
   const bestV=best===0?sx:(best===1?sy:sz), curV=useAxis===0?sx:(useAxis===1?sy:sz);
   if(!haveMid2 || bestV>curV*1.2){ if(best!==useAxis){useAxis=best; mid2=best===0?tx:(best===1?ty:tz);} }
  }
  const v=useAxis===0?tx:(useAxis===1?ty:tz);
  if(!haveMid2){mid2=v;haveMid2=true;}
  mid2=mid2*0.94+v*0.06; let dev=absf(v-mid2);
  if(dev>amp2)amp2=amp2*0.75+dev*0.25; else if(dev>amp2*0.4)amp2=amp2*0.99+dev*0.01;
  let h=amp2*0.45; if(h<minH)h=minH;
  if(aLock){ if(dev<h)aLock=false; }
  else if(v>mid2+h && state<=0){state=1;}
  else if(v<mid2-h && state===1){ state=0; if(i-last>=REFR){reps++;last=i;aLock=true;} }
 }
 return reps;
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
console.log("set         echt | device-accelN | mijn-port | match?");
sets.forEach(({f,d})=>{
 const port=deviceAccel(d,35);
 console.log(f.slice(7,20).padEnd(13),String(d.final).padStart(2)," |",String(d.accelN).padStart(8)," |",String(port).padStart(7)," |",port===d.accelN?"JA ✅":"NEE");
});
