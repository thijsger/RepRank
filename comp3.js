const fs=require("fs");
function absf(v){return v<0?-v:v;}
// accel-tilt deviatie (dominante as)
function accelDev(d){
 const {ax,ay,az}=d,n=ax.length;
 let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const out=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2); out.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}
 return out;
}
// leaky-integraal van dominante gyro-as
function gyroInt(d){
 const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let gi=0;const out=[];for(let i=0;i<n;i++){gi=gi*0.90+s[i];out.push(gi);}return out;
}
function norm(sig){const m=Math.max(...sig.map(absf))||1;return sig.map(v=>v/m);}
function corr(a,b){let c=0;for(let i=0;i<a.length;i++)c+=a[i]*b[i];return c;}
// gefuseerd signaal: genormaliseerd accel + sign-aligned genormaliseerd gyro
function fused(d){
 const A=norm(accelDev(d)); let G=norm(gyroInt(d));
 if(corr(A,G)<0)G=G.map(v=>-v);
 return A.map((v,i)=>v+G[i]);
}
// volledige-cyclus-detectie (relatief)
function count(sig){
 const n=sig.length;let amp=0.2,state=0,ext=0,last=-999,sign=0,reps=0;const hits=[];
 for(let i=0;i<n;i++){const v=sig[i],av=absf(v);
  if(av>amp)amp=amp*0.7+av*0.3; else if(av>amp*0.35)amp=amp*0.99+av*0.01;
  if(sign===0&&amp>0.4)sign=v<0?-1:1; if(sign===0)continue;
  const s=v*sign,dth=amp*0.40,uth=amp*0.15;
  if(state===0){if(s>dth){state=1;ext=s;}}
  else{if(s>ext)ext=s; if(s<uth&&ext>dth&&(i-last)>=8){state=0;last=i;reps++;hits.push(i);}}}
 return {reps,hits};
}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
sets.forEach(({f,d})=>{const r=count(fused(d));console.log(f.slice(7,28),"echt="+d.final,"-> GEFUSEERD="+r.reps,r.reps==d.final?"OK ✅":"FOUT","|",r.hits.join(" "));});
