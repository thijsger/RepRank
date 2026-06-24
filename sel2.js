const fs=require("fs");function absf(v){return v<0?-v:v;}
// ruwe accel-tilt-deviatie (licht gladgestreken, zoals het horloge - goed voor traag)
function accelDev(d){
 const {ax,ay,az}=d,n=ax.length;let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const out=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2); out.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}
 return out;
}
function gyroDom(d){
 const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let sm=0;const out=[];for(let i=0;i<n;i++){sm=sm*0.5+s[i]*0.5;out.push(sm);}return out;
}
// simpele +/- cyclus-teller met adaptieve drempel
function cyc(sig,floor,minDur){
 const n=sig.length;let amp=floor,st=0,last=-999,reps=0;
 for(let i=0;i<n;i++){const av=absf(sig[i]);if(av>amp)amp=amp*0.7+av*0.3;else amp=amp*0.995+av*0.005;
  let h=amp*0.4;if(h<floor)h=floor;
  if(sig[i]>h&&st<=0){st=1;}else if(sig[i]<-h&&st===1&&(i-last)>=minDur){st=0;reps++;last=i;}}
 return reps;
}
function rms(s){let q=0;for(const v of s)q+=v*v;return Math.sqrt(q/s.length);}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
console.log("set         echt | gyroRMS | accelTelt | gyroTelt");
sets.forEach(({f,d})=>{
 const gr=rms(gyroDom(d));
 const a=cyc(accelDev(d),12,8), g=cyc(gyroDom(d),18,5);
 console.log(f.slice(7,20).padEnd(13),String(d.final).padStart(2)," |",gr.toFixed(0).padStart(5)," |",String(a).padStart(6)," |",g);
});
