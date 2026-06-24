const fs=require("fs");function absf(v){return v<0?-v:v;}
function accelDev(d){const {ax,ay,az}=d,n=ax.length;let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const o=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2);o.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}return o;}
function gyroDom(d){const {rx,ry,rz}=d,n=rx.length;const g=[0,0,0];
 for(let i=0;i<n;i++){g[0]+=absf(rx[i]);g[1]+=absf(ry[i]);g[2]+=absf(rz[i]);}
 const a=g[2]>=g[1]&&g[2]>=g[0]?2:(g[1]>=g[0]?1:0);const s=a===0?rx:(a===1?ry:rz);
 let sm=0;const o=[];for(let i=0;i<n;i++){sm=sm*0.5+s[i]*0.5;o.push(sm);}return o;}
function exEvents(sig,floor,decay){
 const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,reps=[];
 for(let i=0;i<n;i++){const mid=(pk+tr)/2,amp=(pk-tr)/2;
  if(sig[i]>pk)pk=sig[i];else pk+=(mid-pk)*decay; if(sig[i]<tr)tr=sig[i];else tr+=(mid-tr)*decay;
  if(amp<floor)continue;const dev=sig[i]-mid;
  if(dev<-amp*0.4){armed=true;} else if(dev>0&&armed){reps.push(i);armed=false;}}
 return reps;}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync("tuning-data/"+f)));
const truth=sets.map(d=>d.final);
function fuse(d,GAP){
 const ea=exEvents(accelDev(d),10,0.008), eg=exEvents(gyroDom(d),15,0.04);
 const all=ea.concat(eg).sort((a,b)=>a-b); let last=-1e9,c=0;
 for(const t of all){if(t-last>=GAP){c++;last=t;}} return c;}
for(const GAP of [8,12,16,20,25,30]){
 const res=sets.map(d=>fuse(d,GAP));const err=res.reduce((a,r,i)=>a+absf(r-truth[i]),0);
 console.log("GAP="+String(GAP).padStart(2),res.map((r,i)=>r+"/"+truth[i]).join("  "),"fout="+err);
}
