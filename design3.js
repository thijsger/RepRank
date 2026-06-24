const fs=require("fs");
function absf(v){return v<0?-v:v;}

// bouw het accel-tilt-deviatiesignaal (dominante as, afwijking van trage baseline)
function accelDev(d){
 const {ax,ay,az}=d,n=ax.length;
 let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;
 const out=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20){uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2);}
  out.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}
 return out;
}

// VOLLEDIGE-CYCLUS-DETECTIE (relatief): tel een swing naar het dominante uiterste en terug
function countCycles(sig, cfg){
 const n=sig.length;
 const MINDUR=cfg.minDur, DOWN=cfg.down, UP=cfg.up, FRAC=cfg.quietFrac;
 let amp=10, state=0, ext=0, last=-999, reps=0, hits=[];
 // bepaal swing-teken (gaat de rep naar - of +?) uit de eerste sterke excursie
 let sign=0;
 for(let i=0;i<n;i++){
  const v=sig[i], av=absf(v);
  // envelope: snel omhoog, bevroren bij stilstand
  if(av>amp) amp=amp*0.7+av*0.3;
  else if(av>amp*FRAC) amp=amp*0.99+av*0.01;
  if(sign===0 && amp>15){ sign = v<0?-1:1; } // richting van de eerste echte swing
  if(sign===0) continue;
  const s = v*sign; // s>0 = in de "rep-richting"
  const dth=amp*DOWN, uth=amp*UP;
  if(state===0){ if(s>dth){state=1; ext=s;} }
  else { if(s>ext)ext=s; if(s<uth && ext>dth && (i-last)>=MINDUR){state=0; reps++; last=i; hits.push(i);} }
 }
 return {reps,hits};
}

const files=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json"));
const cfg={minDur:8, down:0.45, up:0.15, quietFrac:0.35};
files.forEach(f=>{
 const d=JSON.parse(fs.readFileSync("tuning-data/"+f));
 const sig=accelDev(d);
 const r=countCycles(sig,cfg);
 console.log(f.slice(0,30),"echt="+d.final,"-> cyclus="+r.reps, r.reps==d.final?"OK":"FOUT", "momenten:",r.hits.join(" "));
});
