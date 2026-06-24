const fs=require("fs");
function absf(v){return v<0?-v:v;}
function accelDev(d){
 const {ax,ay,az}=d,n=ax.length;
 let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const out=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2); out.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}
 return out;
}
function gyroInt(d){
 const {rx,ry,rz}=d,n=rx.length;const gsum=[0,0,0];
 for(let i=0;i<n;i++){gsum[0]+=absf(rx[i]);gsum[1]+=absf(ry[i]);gsum[2]+=absf(rz[i]);}
 const a=gsum[2]>=gsum[1]&&gsum[2]>=gsum[0]?2:(gsum[1]>=gsum[0]?1:0);
 const s=a===0?rx:(a===1?ry:rz);let gi=0;const out=[];
 for(let i=0;i<n;i++){gi=gi*0.90+s[i];out.push(gi);} return out;
}
// volledige-cyclus events op één signaal (relatief, bevroren bij stilstand)
function cycleEvents(sig,minAmp){
 const n=sig.length;let amp=10,state=0,ext=0,last=-999,sign=0;const hits=[];
 for(let i=0;i<n;i++){const v=sig[i],av=absf(v);
  if(av>amp)amp=amp*0.7+av*0.3; else if(av>amp*0.35)amp=amp*0.99+av*0.01;
  if(sign===0&&amp>minAmp)sign=v<0?-1:1; if(sign===0)continue;
  const s=v*sign,dth=amp*0.40,uth=amp*0.15;
  if(state===0){if(s>dth){state=1;ext=s;}}
  else{if(s>ext)ext=s; if(s<uth&&ext>dth&&(i-last)>=6){state=0;last=i;hits.push(i);}}}
 return hits;
}
// merge: union van accel- en gyro-events, dedup binnen MERGE samples
function fuse(d,MERGE){
 const ea=cycleEvents(accelDev(d),15), eg=cycleEvents(gyroInt(d),20);
 const all=ea.map(x=>[x,"a"]).concat(eg.map(x=>[x,"g"])).sort((p,q)=>p[0]-q[0]);
 const merged=[];let lastT=-999;
 for(const [t,src] of all){ if(t-lastT>=MERGE){merged.push(t+src);lastT=t;} }
 return {n:merged.length, ea:ea.length, eg:eg.length, merged};
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
for(const MERGE of [12,16,20,24]){
 console.log("MERGE="+MERGE+":");
 sets.forEach(({f,d})=>{const r=fuse(d,MERGE);console.log("   echt="+d.final,"accel-cycli="+r.ea,"gyro-cycli="+r.eg,"-> GEFUSEERD="+r.n, r.n==d.final?"OK":"FOUT");});
}
