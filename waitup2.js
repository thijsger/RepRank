const https=require("https"),fs=require("fs");
function post(path,body){return new Promise(r=>{const data=JSON.stringify(body);
 const req=https.request("https://reprank-svu5.onrender.com"+path,{method:"POST",headers:{"Content-Type":"application/json"}},res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({code:res.statusCode,body:d}));});req.write(data);req.end();});}
function get(path){return new Promise(r=>{https.get("https://reprank-svu5.onrender.com"+path,res=>{let d="";res.on("data",c=>d+=c);res.on("end",()=>r({code:res.statusCode,body:d}));});});}
(async()=>{
 let live=false;
 for(let i=0;i<20;i++){const c=await get("/api/tune/count");
  if(c.code===200 && c.body.trim().startsWith("{")){console.log("endpoint live:",c.body);live=true;break;}
  console.log("wachten op redeploy...",i+1,"(code "+c.code+")");await new Promise(x=>setTimeout(x,12000));}
 if(!live){console.log("nog niet live, stop");return;}
 const files=fs.readdirSync("tuning-data").filter(f=>f.endsWith(".json"));
 for(const f of files){const d=JSON.parse(fs.readFileSync("tuning-data/"+f));await post("/api/tune",d);}
 console.log("geupload:",files.length);
 console.log("totaal in DB:",(await get("/api/tune/count")).body);
})();
