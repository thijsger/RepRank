const fs=require("fs");
const R2D=180/Math.PI;
function smooth(d){ // trage zwaartekracht-richting
 const {ax,ay,az}=d,n=ax.length;let gx=ax[0],gy=ay[0],gz=az[0];const G=[];
 for(let i=0;i<n;i++){gx=gx*0.9+ax[i]*0.1;gy=gy*0.9+ay[i]*0.1;gz=gz*0.9+az[i]*0.1;G.push([gx,gy,gz]);}
 return G;
}
function angles(G){ // pitch & roll in graden
 return G.map(([x,y,z])=>[Math.atan2(x,Math.hypot(y,z))*R2D, Math.atan2(y,Math.hypot(x,z))*R2D, Math.atan2(z,Math.hypot(x,y))*R2D]);
}
function ampOf(s){return Math.max(...s)-Math.min(...s);}
function corr(a,b){let c=0,n=a.length;const ma=a.reduce((x,y)=>x+y,0)/n,mb=b.reduce((x,y)=>x+y,0)/n;
 let va=0,vb=0;for(let i=0;i<n;i++){c+=(a[i]-ma)*(b[i]-mb);va+=(a[i]-ma)**2;vb+=(b[i]-mb)**2;}return c/Math.sqrt(va*vb);}
const sets=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json")).map(f=>({f,d:JSON.parse(fs.readFileSync("tuning-data/"+f))}));
sets.forEach(({f,d})=>{
 const A=angles(smooth(d));
 const p=A.map(a=>a[0]),r=A.map(a=>a[1]),q=A.map(a=>a[2]);
 const amps=[ampOf(p),ampOf(r),ampOf(q)];
 const best=amps.indexOf(Math.max(...amps)); const ang=[p,r,q][best];
 // afgeleide van de hoek
 const da=ang.map((v,i)=>i?(v-ang[i-1]):0);
 const {rx,ry,rz}=d;
 const cs=[corr(da,rx),corr(da,ry),corr(da,rz)];
 const gax=cs.map(absf=>Math.abs(absf)).indexOf(Math.max(...cs.map(c=>Math.abs(c))));
 console.log(f.slice(7,20),"echt="+d.final,"| beste hoek="+["pitch","roll","yaw"][best],"swing="+amps[best].toFixed(0)+"°",
   "| gyro-as="+["x","y","z"][gax],"corr="+cs[gax].toFixed(2));
});
