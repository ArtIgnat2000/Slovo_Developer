// Замер стоимости одной записи прогресса (parse + stringify) на синтетическом профиле.
// Запуск: node docs/audits/2026-11-01/bench-write-cost.mjs — см. 02-performance.md, §2.5.
// Не входит в npm-скрипты и CI: это разовый замер для аудита.
// Синтетический профиль: 257 слов, 365 дней дневной статистики, 30 дней сессий.
function makeState(days, sessionsPerDay){
  const words={}; for(let i=0;i<257;i++) words[`w${i}`]={ step:i%7, due:Date.now()+i*1000, ease:2.5, lapses:i%3, seen:10+i, correct:8+i%5, lastSeen:Date.now()-i*999, history:Array.from({length:6},(_,k)=>({t:k,ok:k%2===0})) };
  const dayMap={}; for(let d=0;d<days;d++){ dayMap[`2026-${String(1+(d%12)).padStart(2,'0')}-${String(1+(d%28)).padStart(2,'0')}#${d}`]={xp:30,tasks:12,correct:9,wrong:3,minutes:14}; }
  const sessions=[]; for(let d=0;d<30;d++) for(let s=0;s<sessionsPerDay;s++) sessions.push({id:`s${d}-${s}`,day:'2026-10-01',startedAt:1,lastActivityAt:2,activeSeconds:400,mode:'lesson',tasks:12,correct:9,wrong:3,errorWords:{w1:2,w5:1},taskKindErrors:{gap:2},recoveredWords:['w1'],status:'completed'});
  return { state:{ profiles:[{id:'p1',name:'Аня',avatar:'🦊',xp:1234,gems:50,words,days:dayMap,studySessions:sessions,lessons:{},errors:{},achievements:[]}], activeId:'p1', settings:{}, vault:{log:Array.from({length:40},(_,i)=>({at:i,kind:'boot',text:'x'.repeat(40)})),trash:[],snapshots:[]}}, version:1 };
}
for (const [label,days,spd] of [['≈1 год статистики, 30 дн. сессий (≈1 ребёнок)',365,1],['≈10 лет дневной статистики',365*10,1],['стресс: ≈50 лет статистики, ×2 сессии',365*50,2]]){
  const raw = JSON.stringify(makeState(days,spd));
  const N=200; let t=process.hrtime.bigint();
  for(let i=0;i<N;i++){ JSON.stringify(makeState(0,0)); } // baseline noise
  const tStr=process.hrtime.bigint();
  let s=0; for(let i=0;i<N;i++){ s+=JSON.stringify(JSON.parse(raw)).length; } // parse+stringify ≈ один цикл записи (readRecord + serialize)
  const per=Number(process.hrtime.bigint()-tStr)/N/1e6;
  console.log(label.padEnd(44), 'размер', (raw.length/1024).toFixed(1).padStart(8),'КБ', ' parse+stringify ≈', per.toFixed(2).padStart(7),'мс');
}
