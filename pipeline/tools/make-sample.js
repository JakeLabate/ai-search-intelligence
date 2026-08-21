/* Fixture generator — emits a bundle in exactly the shape src/run.js build writes,
   so you can wire up and eyeball the visualisation before spending a cent on APIs.
   Content is invented. Replace with a real run before showing anyone. */
import { write, DATA } from "../src/util.js";
import path from "node:path";

const platforms = [
  { id: "chatgpt", name: "ChatGPT" }, { id: "claude", name: "Claude" },
  { id: "perplexity", name: "Perplexity" }, { id: "gemini", name: "Gemini" },
  { id: "aio", name: "Google AI Overviews" },
];
const themes = [
  { id: "pricing", name: "Pricing & plans" }, { id: "security", name: "Security & trust" },
  { id: "setup", name: "Setup & onboarding" }, { id: "support", name: "Support & SLAs" },
  { id: "integrations", name: "Integrations" }, { id: "scale", name: "Scale & reliability" },
];
const brands = [
  { id: "client", name: "Acme Pay", client: true },
  { id: "comp0", name: "Northwind" }, { id: "comp1", name: "Contoso" },
  { id: "none", name: "No brand (general)" },
];
const sources = [
  ["reddit.com","community",.55],["trustpilot.com","community",.44],["news.ycombinator.com","community",.55],
  ["techcrunch.com","editorial",.74],["cnbc.com","editorial",.85],["theverge.com","editorial",.77],
  ["g2.com","review",.68],["capterra.com","review",.60],["nerdwallet.com","review",.84],
  ["acmepay.com","owned",.88],["northwind.example","owned",.72],
  ["wikipedia.org","reference",.80],["investopedia.com","reference",.79],["youtube.com","video",.50],
].map(([dom,type,auth])=>({ id: dom.replace(/[^a-z0-9]+/g,"-"), dom, type, auth }));

const intents = ["compare","recommend","howto","info","problem"];
const prompts = Array.from({length:24},(_,i)=>({
  id:`q${i}`, text:[
    "best payment platform for small business","acme pay vs northwind fees",
    "is acme pay secure for online payments","how to set up acme pay on shopify",
    "cheapest payment processor 2026","acme pay support response time",
    "payment platform with best api docs","northwind vs contoso for enterprise",
    "acme pay payout delays","which processor handles high volume best",
  ][i%10]+(i>9?` (${Math.floor(i/10)+1})`:""),
  intent:intents[i%5], theme:themes[i%themes.length].id,
}));

const TONES=["Endorsing","Neutral-factual","Hedged","Comparative","Cautionary","Skeptical","Recommending"];
const NUANCE=["first citation","buried citation","anecdote as evidence","own-domain echo","stale data","competitor favoured","recommendation list"];
let seed=7; const rnd=()=>((seed=seed*1103515245+12345&0x7fffffff)/0x7fffffff);
const pick=a=>a[Math.floor(rnd()*a.length)];

const records=[]; let id=0;
for(let week=1;week<=8;week++)
  for(const pl of platforms)
    for(const q of prompts){
      if(rnd()<.25) continue;
      const aid=`${week}-${pl.id}-${q.id}`;
      const n=2+Math.floor(rnd()*3);
      for(let k=0;k<n;k++){
        const src=pick(sources);
        const brand=rnd()<.45?"client":pick(brands).id;
        const base=src.type==="community"?-.25:src.type==="owned"?.45:.08;
        const sent=Math.max(-1,Math.min(1,+(base+(rnd()*2-1)*.55+(week-4)*.02).toFixed(2)));
        records.push({
          id:`r${id++}`, aid, platform:pl.id, prompt:q.id, theme:q.theme, intent:q.intent,
          source:src.id, stype:src.type, brand,
          sent, bandId:sent>=.22?"pos":sent<=-.22?"neg":"neu",
          rank:k+1, week, auth:src.auth, tone:pick(TONES),
          claim:"Sample claim extracted from the answer.",
          text:`${pl.name} used ${src.dom} to support a point about ${brands.find(b=>b.id===brand).name} in the context of "${q.text}".`,
          nuance:[pick(NUANCE)].concat(k===0?["first citation"]:[]).slice(0,2),
        });
      }
    }

write(path.join(DATA,"records.json"),{
  meta:{ brand:"Acme Pay", product:"Acme Pay Checkout", site:"acmepay.com",
         generated:new Date().toISOString().slice(0,10), weeks:8,
         promptSetVersion:1, snapshots:["fixture"] },
  platforms, themes, brands, sources, prompts, records,
});
console.log(`✓ fixture: ${records.length} citations → data/records.json`);
