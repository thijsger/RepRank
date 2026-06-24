const fs=require("fs");function absf(v){return v<0?-v:v;}
function accelDev(d){const {ax,ay,az}=d,n=ax.length;let tx=ax[0],ty=ay[0],tz=az[0],gx=tx,gy=ty,gz=tz,sx=0,sy=0,sz=0,uA=1;const o=[];
 for(let i=0;i<n;i++){tx=tx*0.85+ax[i]*0.15;ty=ty*0.85+ay[i]*0.15;tz=tz*0.85+az[i]*0.15;
  gx=gx*0.97+tx*0.03;gy=gy*0.97+ty*0.03;gz=gz*0.97+tz*0.03;
  sx=sx*0.99+absf(tx-gx)*0.01;sy=sy*0.99+absf(ty-gy)*0.01;sz=sz*0.99+absf(tz-gz)*0.01;
  if(i>20)uA=(sx>=sy&&sx>=sz)?0:(sy>=sz?1:2);o.push(uA===0?tx-gx:(uA===1?ty-gy:tz-gz));}return o;}
function excursion(sig,floor,minGap,decay,downFrac){
 const n=sig.length;let pk=sig[0],tr=sig[0],armed=false,last=-1e9,reps=0;
 for(let i=0;i<n;i++){const mid=(pk+tr)/2,amp=(pk-tr)/2;
  if(sig[i]>pk)pk=sig[i];else pk+=(mid-pk)*decay; if(sig[i]<tr)tr=sig[i];else tr+=(mid-tr)*decay;
  if(amp<floor)continue;const dev=sig[i]-mid;
  if(dev<-amp*downFrac){armed=true;} else if(dev>0&&armed&&(i-last)>=minGap){reps++;last=i;armed=false;}}
 return reps;}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).sort().map(f=>JSON.parse(fs.readFileSync("tuning-data/"+f)));
const sigs=sets.map(accelDev);const truth=sets.map(d=>d.final);
let best=null;
for(const floor of [8,10,12,15]) for(const decay of [0.005,0.008,0.012,0.02]) for(const df of [0.3,0.4,0.5]) for(const gap of [3,5,8]){
 const res=sigs.map(s=>excursion(s,floor,gap,decay,df));
 const err=res.reduce((a,r,i)=>a+absf(r-truth[i]),0);
 if(!best||err<best.err)best={floor,decay,df,gap,res:res.slice(),err};
}
console.log("beste params:",JSON.stringify({floor:best.floor,decay:best.decay,df:best.df,gap:best.gap}));
console.log("resultaat:",best.res.map((r,i)=>r+"/"+truth[i]).join("  "),"| totale fout:",best.err);
