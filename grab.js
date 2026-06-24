// haalt alle tune-records op en bewaart nieuwe lokaal (dedup op 'at')
const https=require("https"),fs=require("fs");
https.get("https://reprank-svu5.onrender.com/api/tune",r=>{let s="";r.on("data",c=>s+=c);r.on("end",()=>{
  const all=JSON.parse(s); let n=0;
  if(!fs.existsSync("tuning-data"))fs.mkdirSync("tuning-data");
  const have=new Set(fs.readdirSync("tuning-data").map(f=>f.split("_").pop().replace(".json","")));
  all.forEach(d=>{ if(!d.ax||d.ax.length<20)return; if(have.has(String(d.at)))return;
    fs.writeFileSync("tuning-data/"+d.exercise+"_"+d.final+"reps_"+d.at+".json",JSON.stringify(d)); n++; });
  console.log("nieuwe sets bewaard:",n,"| totaal in map:",fs.readdirSync("tuning-data").length);
});});
