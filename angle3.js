const fs=require("fs");
const R2D=180/Math.PI;
function absf(v){return v<0?-v:v;}
// twee kantelhoeken (pitch/roll) uit trage zwaartekracht
function tiltAngles(d){
 const {ax,ay,az}=d,n=ax.length;let gx=ax[0],gy=ay[0],gz=az[0];const P=[],Rr=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;
  P.push(Math.atan2(gx,Math.hypot(gy,gz))*R2D); Rr.push(Math.atan2(gy,Math.hypot(gx,gz))*R2D);}
 return [P,Rr];
}
// cyclus-detectie op de hoek: relatief + fysieke bodem in graden
function count(d,cfg){
 const [P,Rr]=tiltAngles(d),n=P.length;
 // kies dominante hoek-as op lopende oscillatie
 let mp=P[0],mr=Rr[0],op=0,orr=0;
 let baseline=0,swing=cfg.minDeg,state=0,ext=0,last=-999,sign=0,reps=0,have=false;const hits=[];
 for(let i=0;i<n;i++){
  mp=mp*0.97+P[i]*0.03; mr=mr*0.97+Rr[i]*0.03;
  op=op*0.99+absf(P[i]-mp)*0.01; orr=orr*0.99+absf(Rr[i]-mr)*0.01;
  const useRoll=orr>op; const ang=useRoll?Rr[i]:P[i]; const mid=useRoll?mr:mp;
  if(!have){baseline=ang;have=true;}
  // baseline traag, bevroren bij stilstand
  const dev=ang-baseline;
  if(absf(dev)>swing) swing=swing*0.7+absf(dev)*0.3; else if(absf(dev)>swing*0.35) swing=swing*0.99+absf(dev)*0.01;
  if(absf(dev)<swing*0.4) baseline=baseline*0.98+ang*0.02; // alleen bijregelen dicht bij rust
  if(sign===0 && swing>cfg.minDeg*1.5) sign=dev<0?-1:1;
  if(sign===0) continue;
  const s=dev*sign, dth=Math.max(swing*cfg.down,cfg.minDeg), uth=swing*cfg.up;
  if(state===0){if(s>dth){state=1;ext=s;}}
  else{if(s>ext)ext=s; if(s<uth && ext>dth && (i-last)>=cfg.minDur){state=0;last=i;reps++;hits.push(i);}}
 }
 return {reps,hits};
}
const cfg={minDeg:7, down:0.5, up:0.2, minDur:8};
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
let ok=0;
sets.forEach(({f,d})=>{const r=count(d,cfg);const good=r.reps==d.final;if(good)ok++;
 console.log(f.slice(7,20),"echt="+d.final,"-> HOEK="+r.reps,good?"OK ✅":"FOUT","|",r.hits.join(" "));});
console.log("\n"+ok+"/"+sets.length+" goed");
