const https=require("https"),fs=require("fs");
function post(path,body){return new Promise(r=>{const data=JSON.stringify(body);
 const req=https.request("https://reprank-svu5.onrender.com"+path,{method:"POST",headers:{"Content-Type":"application/json"}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({code:res.statusCode,body:d}));});req.write(data);req.end();});}
function get(path){return new Promise(r=>{https.get("https://reprank-svu5.onrender.com"+path,res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r(d));});});}
(async()=>{
 // wacht tot de nieuwe count-endpoint live is
 for(let i=0;i<15;i++){const c=await get("/api/tune/count");if(c.includes("count")){console.log("endpoint live:",c);break;}console.log("wachten op redeploy...",i+1);await new Promise(x=>setTimeout(x,12000));}
 // upload de 6 lokale sets
 const files=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json"));
 for(const f of files){const d=JSON.parse(fs.readFileSync("tuning-data/"+f));
  const r=await post("/api/tune",d); }
 console.log("geupload:",files.length,"sets");
 console.log("totaal in DB nu:",await get("/api/tune/count"));
})();
