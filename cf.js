const fs=require("fs");const R2D=180/Math.PI;
function absf(v){return v<0?-v:v;}
function corr(a,b){let n=a.length,ma=0,mb=0;for(let i=0;i<n;i++){ma+=a[i];mb+=b[i];}ma/=n;mb/=n;
 let c=0,va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return c/Math.sqrt(va*vb+1e-9);}
// complementair filter -> één kantelhoek-signaal dat traag (accel) en snel (gyro) toont
function fusedSignal(d){
 const {ax,ay,az,rx,ry,rz}=d,n=ax.length,dt=0.04,A=0.95;
 // trage zwaartekracht voor accel-hoek
 let gx=ax[0],gy=ay[0],gz=az[0];const pit=[],rol=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;
  pit.push(Math.atan2(gx,Math.hypot(gy,gz))*R2D); rol.push(Math.atan2(gy,Math.hypot(gx,gz))*R2D);}
 // kies dominante accel-hoek
 const ap=Math.max(...pit)-Math.min(...pit), ar=Math.max(...rol)-Math.min(...rol);
 const acc = ap>=ar?pit:rol;
 // afgeleide van accel-hoek -> kies gyro-as + sign die er het best mee matcht
 const da=acc.map((v,i)=>i?v-acc[i-1]:0);
 const cs=[corr(da,rx),corr(da,ry),corr(da,rz)];
 const gi=cs.map(c=>Math.abs(c)).indexOf(Math.max(...cs.map(c=>Math.abs(c))));
 const gsign=cs[gi]<0?-1:1; const gyr=(gi===0?rx:gi===1?ry:rz).map(v=>v*gsign);
 // complementair: fused += gyro*dt ; trek langzaam naar accel-hoek
 let f=acc[0];const out=[];
 for(let i=0;i<n;i++){ f=A*(f+gyr[i]*dt)+(1-A)*acc[i]; out.push(f); }
 return {out, accSwing:Math.max(ap,ar)};
}
const d=JSON.parse(fs.readFileSync("tuning-data/pushups_8reps_1782289540543.json"));
const {out}=fusedSignal(d);
const mn=Math.min(...out),mx=Math.max(...out),mid=(mn+mx)/2;
console.log("EXTREEM SNELLE set (echt=8, accel zag 0). Gefuseerd signaal swing="+(mx-mn).toFixed(0)+"°:");
let s="";for(let i=0;i<out.length;i+=3){s+=Math.round((out[i]-mid)/(mx-mn)*9)+" ";}
console.log(s);
