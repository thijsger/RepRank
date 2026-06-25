const fs=require("fs");function absf(v){return v<0?-v:v;}
const all=JSON.parse(fs.readFileSync("/tmp/all.json")).filter(d=>d.ax&&d.ax.length>20);
// faithful offline-port van de live-teller, met instelbare params + gyro aan/uit
function run(d,P,useGyro){const {ax,ay,az,rx,ry,rz}=d,n=ax.length;
 let tx=0,ty=0,tz=0,hT=false,gx2=0,gy2=0,gz2=0,sx=0,sy=0,sz=0,uA=1,apk=0,atr=0,hA=false,aArm=false;
 let grx=0,gry=0,grz=0,gU=2,gsm=0,gpk=0,gtr=0,hG=false,gArm=false,t=0,lastC=-1e9,reps=0;
 function tryC(){if(t-lastC>=P.gap){lastC=t;reps++;}}
 for(let i=0;i<n;i++){
  if(useGyro){grx=grx*0.98+absf(rx[i])*0.02;gry=gry*0.98+absf(ry[i])*0.02;grz=grz*0.98+absf(rz[i])*0.02;
   gU=(grx>=gry&&grx>=grz)?0:((gry>=grz)?1:2);const graw=gU===0?rx[i]:(gU===1?ry[i]:rz[i]);
   gsm=gsm*0.5+graw*0.5; if(!hG){gpk=gsm;gtr=gsm;hG=true;}
   const mid=(gpk+gtr)/2,amp=(gpk-gtr)/2; if(gsm>gpk)gpk=gsm;else gpk+=(mid-gpk)*P.gd; if(gsm<gtr)gtr=gsm;else gtr+=(mid-gtr)*P.gd;
   if(amp>=P.gf){const dev=gsm-mid; if(dev<-amp*0.4)gArm=true; else if(dev>0&&gArm){gArm=false; if(amp>P.gg)tryC();}}}
  if(!hT){tx=ax[i];ty=ay[i];tz=az[i];hT=true;}
  tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx2=gx2*0.97+tx*0.03;gy2=gy2*0.97+ty*0.03;gz2=gz2*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx2)*0.01;sy=sy*0.99+absf(ty-gy2)*0.01;sz=sz*0.99+absf(tz-gz2)*0.01;
  if(t>20)uA=(sx>=sy&&sx>=sz)?0:((sy>=sz)?1:2);
  const sig=uA===0?tx-gx2:(uA===1?ty-gy2:tz-gz2);
  if(!hA){apk=sig;atr=sig;hA=true;}
  const mid=(apk+atr)/2,amp=(apk-atr)/2; if(sig>apk)apk=sig;else apk+=(mid-apk)*P.ad; if(sig<atr)atr=sig;else atr+=(mid-atr)*P.ad;
  if(amp>=P.af){const dev=sig-mid; if(dev<-amp*P.adn)aArm=true; else if(dev>0&&aArm){aArm=false;tryC();}}
  t++;
 }
 return reps;
}
function gridSearch(sets,useGyro){let best=null;
 for(const af of [4,6,8,10]) for(const ad of [0.004,0.008,0.015]) for(const adn of [0.3,0.4,0.5])
 for(const gf of (useGyro?[6,8,12]:[999])) for(const gg of (useGyro?[10,15,20]:[999])) for(const gap of [16,20,25]){
  const P={af,ad,adn,gf,gd:0.04,gg,gap};let err=0,big=0;
  sets.forEach(d=>{const r=run(d,P,useGyro);const e=absf(r-d.final);err+=e;if(e>=3)big++;});
  const score=err+big*3;
  if(!best||score<best.score)best={P,err,big,score};}
 return best;}
const pu=all.filter(d=>d.exercise==="pushups"), sq=all.filter(d=>d.exercise==="squats");
const bp=gridSearch(pu,true), bs=gridSearch(sq,false);
console.log("PUSH-UPS ("+pu.length+" sets): beste params",JSON.stringify(bp.P));
console.log("  MAE="+(bp.err/pu.length).toFixed(2),"grote-missers="+bp.big);
console.log("SQUATS ("+sq.length+" sets): beste params",JSON.stringify(bs.P));
console.log("  MAE="+(bs.err/sq.length).toFixed(2),"grote-missers="+bs.big);
