/* Pure grading and evidence-based assessment. No user code execution or storage I/O. */
(function(global){
  'use strict';
  const MANUAL=new Set(['calculation','derivation','manual']);
  const norm=value=>String(value??'').trim().replace(/\s/g,'').replace(/[−–]/g,'-').replace(/[，、]/g,',').replace(/。$/,'').toLowerCase();
  const isObjective=q=>!!q&&!MANUAL.has(q.type)&&q.grading?.kind!=='manual';
  const keyOf=q=>String(q.assessmentKey||q.familyId||q.id);
  function number(value){
    if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('请输入有限数值。');return value;}
    const source=String(value??'').trim().replace(/π/g,'pi').replace(/(\d)E([+-]?\d)/g,'$1e$2').replace(/[−–]/g,'-').replace(/×/g,'*').replace(/÷/g,'/').replace(/（/g,'(').replace(/）/g,')');
    if(!source||source.length>180)throw new Error('请输入数值或简短常数表达式，例如 1/2、2*pi、sqrt(2)。');
    const identifiers=source.match(/[a-zA-Z_]+/g)||[];
    if(identifiers.some(id=>!['pi','e','sin','cos','tan','exp','log','sqrt','abs','floor','ceil'].includes(id)))throw new Error('数值答案只接受常数表达式，不含变量、单位或代码。');
    if(!global.SignalEngine)throw new Error('数学解析器未加载。');
    const result=global.SignalEngine.compile(source,{domain:'ct'}).evaluate(0);
    if(!Number.isFinite(result))throw new Error('结果必须是有限实数。');return result;
  }
  function grade(q,value){
    if(!isObjective(q))return {gradable:false,valid:true,correct:null,message:'此题需要人工核对，不计入客观正确率。'};
    if(q.type==='numeric'){
      let parsed;try{parsed=number(value);}catch(error){return {gradable:true,valid:false,correct:false,message:error.message};}
      const expected=Number(q.answer),a=q.grading?.absTol??1e-7,r=q.grading?.relTol??1e-6;
      if(!Number.isFinite(expected))return {gradable:false,valid:false,correct:null,message:'标准数值无效，此题不参与评估。'};
      const tolerance=Math.max(0,Number(a)||0)+Math.max(0,Number(r)||0)*Math.abs(expected);
      return {gradable:true,valid:true,correct:Math.abs(parsed-expected)<=tolerance,value:parsed,tolerance};
    }
    if(q.type==='multiple'){
      if(!Array.isArray(value)||!value.length||value.some(v=>!Number.isInteger(v)||v<0||v>=q.options.length))return {gradable:true,valid:false,correct:false,message:'请至少选择一个有效选项。'};
      const actual=[...new Set(value)].sort((a,b)=>a-b),expected=[...new Set(q.answer)].sort((a,b)=>a-b);
      return {gradable:true,valid:true,correct:actual.length===expected.length&&actual.every((v,i)=>v===expected[i]),value:actual};
    }
    if(q.type==='choice'||q.type==='judge'){
      if(!Number.isInteger(value)||value<0||value>=q.options.length)return {gradable:true,valid:false,correct:false,message:'请先选择一个选项。'};
      return {gradable:true,valid:true,correct:value===q.answer,value};
    }
    if(!String(value??'').trim())return {gradable:true,valid:false,correct:false,message:'请先填写答案。'};
    const accepted=[q.answer,...(q.accept||[])];let correct=accepted.some(a=>norm(a)===norm(value));
    if(!correct)for(const a of accepted){try{const target=number(a);if(Math.abs(number(value)-target)<=1e-7+Math.abs(target)*1e-6){correct=true;break;}}catch{/* Symbolic/text fills use their explicit accepted spellings. */}}
    return {gradable:true,valid:true,correct,value:String(value).slice(0,500)};
  }
  function create(){return {version:1,records:{},manual:{},reviewFlags:{},wrongLabs:{},labResolutions:{},rounds:[],activeRounds:{}};}
  const dictionary=bank=>new Map(bank.map(q=>[keyOf(q),q]));
  function sanitize(raw,bank,topicIds){
    const state=create(),known=dictionary(bank),validTopics=new Set(topicIds);
    if(!raw||typeof raw!=='object')return state;
    for(const [key,r]of Object.entries(raw.records||{})){
      const q=known.get(key);if(!q||!isObjective(q)||!r||typeof r.correct!=='boolean'||r.topicId!==q.topicId||r.chapter!==q.chapter)continue;
      state.records[key]={questionId:String(r.questionId||q.id||key).slice(0,160),topicId:q.topicId,chapter:q.chapter,correct:r.correct,lastCorrect:typeof r.lastCorrect==='boolean'?r.lastCorrect:r.correct,at:Number.isFinite(r.at)?Math.max(0,r.at):0,lastAt:Number.isFinite(r.lastAt)?Math.max(0,r.lastAt):0,attempts:Math.min(100000,Math.max(1,Math.floor(Number(r.attempts)||1))),origin:r.origin==='legacy-last'?'legacy-last':'objective',round:String(r.round||'initial').slice(0,100)};
    }
    for(const [key,r]of Object.entries(raw.manual||{})){const q=known.get(key);if(q&&!isObjective(q)&&r&&typeof r.correct==='boolean')state.manual[key]={correct:r.correct,at:Math.max(0,Number(r.at)||0)};}
    for(const id of validTopics)if(raw.reviewFlags?.[id])state.reviewFlags[id]=true;
    for(const [key,r]of Object.entries(raw.wrongLabs||{})){const q=known.get(key);if(q?.familyId&&r&&Number.isInteger(r.seed))state.wrongLabs[key]={labId:q.labId,familyId:q.familyId,seed:r.seed,prompt:String(r.prompt||q.title||'实验室错题').slice(0,1200),at:Math.max(0,Number(r.at)||0)};}
    for(const r of Object.values(raw.labResolutions||{})){const q=known.get(r?.familyId);if(q?.familyId&&Number.isInteger(r.seed)&&Number.isFinite(r.at))state.labResolutions[q.familyId+':'+r.seed]={familyId:q.familyId,seed:r.seed,at:Math.max(0,r.at)};}pruneResolvedLabs(state);
    state.rounds=Array.isArray(raw.rounds)?raw.rounds.filter(r=>r&&validTopics.has(r.topicId)&&Number.isFinite(r.at)&&Number.isInteger(r.total)&&r.total>=5&&r.total<=100&&Number.isInteger(r.correct)&&r.correct>=0&&r.correct<=r.total).slice(-100).map(r=>({topicId:r.topicId,at:r.at,total:r.total,correct:r.correct})):[];
    for(const id of validTopics){const at=Math.max(0,Number(raw.activeRounds?.[id])||0,...state.rounds.filter(r=>r.topicId===id).map(r=>r.at));if(at&&Object.values(state.records).filter(r=>r.topicId===id&&r.round==='round-'+at).length>=5)state.activeRounds[id]=at;}
    return state;
  }
  function migrate(legacy,bank,topicIds){
    const state=sanitize(legacy.assessment,bank,topicIds);
    if(!legacy.assessment){
      for(const q of bank){const a=legacy.attempts?.[q.id];if(!a||!isObjective(q)||!(a.total>0))continue;state.records[keyOf(q)]={questionId:q.id,topicId:q.topicId,chapter:q.chapter,correct:!!a.lastCorrect,lastCorrect:!!a.lastCorrect,at:Number(a.at)||0,lastAt:Number(a.at)||0,attempts:Math.max(1,Math.floor(a.total)),origin:'legacy-last',round:'legacy'};}
      for(const id of Object.keys(legacy.mastered||{}))if(topicIds.includes(id))state.reviewFlags[id]=true;
    }
    return state;
  }
  function record(state,q,result,at=Date.now()){
    const key=keyOf(q);if(!isObjective(q)||!result.gradable||!result.valid)return {counted:false,objective:false};
    const old=state.records[key],round=currentRound(state,q.topicId);
    if(old&&(old.round===round||(round==='initial'&&old.round==='legacy'))){old.lastCorrect=!!result.correct;old.lastAt=at;old.attempts=Math.min(100000,old.attempts+1);return {counted:false,objective:true};}
    state.records[key]={questionId:q.id,topicId:q.topicId,chapter:q.chapter,correct:!!result.correct,lastCorrect:!!result.correct,at,lastAt:at,attempts:(old?.attempts||0)+1,origin:'objective',round};
    return {counted:true,objective:true};
  }
  function manual(state,q,correct,at=Date.now()){if(isObjective(q))throw new Error('客观题不可通过自评计分。');state.manual[keyOf(q)]={correct:!!correct,at};}
  function pruneResolvedLabs(state){
    const entries=Object.entries(state.labResolutions).sort((a,b)=>b[1].at-a[1].at).slice(0,5000);state.labResolutions=Object.fromEntries(entries);
    for(const [key,r]of Object.entries(state.wrongLabs))if((state.labResolutions[r.familyId+':'+r.seed]?.at??-1)>=r.at)delete state.wrongLabs[key];
  }
  function recordLabResult(state,q,result,at=Date.now()){
    if(!result.valid||!result.gradable)return {counted:false,objective:false};
    const evidence=record(state,q,result,at),key=keyOf(q);
    if(result.correct){state.labResolutions[q.familyId+':'+q.seed]={familyId:q.familyId,seed:q.seed,at};if(state.wrongLabs[key]?.seed===q.seed)delete state.wrongLabs[key];}
    else{state.reviewFlags[q.topicId]=true;state.wrongLabs[key]={labId:q.labId,familyId:q.familyId,seed:q.seed,prompt:q.prompt,at};}
    pruneResolvedLabs(state);return evidence;
  }
  function currentRound(state,topicId){return state.activeRounds?.[topicId]?'round-'+state.activeRounds[topicId]:'initial';}
  function stats(state,predicate=()=>true,min=5,minTopics=1){
    const rows=Object.values(state.records).filter(r=>(r.round===currentRound(state,r.topicId)||(currentRound(state,r.topicId)==='initial'&&r.round==='legacy'))&&predicate(r)),total=rows.length,correct=rows.filter(r=>r.correct).length,coverage=new Set(rows.map(r=>r.topicId)).size,eligible=total>=min&&coverage>=minTopics;
    const status=!eligible?'insufficient':correct*5>=total*4?'mastered':correct*5>=total*3?'learning':'strengthen';
    return {total,correct,incorrect:total-correct,percent:total?Math.round(correct/total*1000)/10:0,status,label:({insufficient:'样本不足',mastered:'已掌握',learning:'学习中',strengthen:'需要加强'})[status],eligible,minimum:min,coverage,minTopics,evaluatedAt:Math.max(0,...rows.map(r=>r.at||0))};
  }
  const topicStats=(state,id)=>stats(state,r=>r.topicId===id,5);
  const chapterStats=(state,id,topicCount)=>stats(state,r=>r.chapter===id,10,Math.min(3,topicCount||3));
  function reassess(state,submissions,bank,at=Date.now()){
    const known=new Map(bank.map(q=>[q.id,q])),seen=new Set(),rows=[];
    for(const s of submissions){const q=known.get(s.id);if(!q||!isObjective(q)||seen.has(keyOf(q)))throw new Error('重新测评必须使用不同的有效客观题。');const result=grade(q,s.value);if(!result.valid||!result.gradable)throw new Error('请完成每道题的有效作答。');seen.add(keyOf(q));rows.push({q,result});}
    if(rows.length<5||new Set(rows.map(r=>r.q.topicId)).size!==1)throw new Error('至少完成同一知识点的 5 道不同客观题，才能更新测评。');
    const round='round-'+at,topicId=rows[0].q.topicId;
    for(const {q,result}of rows){const key=keyOf(q),old=state.records[key];state.records[key]={questionId:q.id,topicId:q.topicId,chapter:q.chapter,correct:!!result.correct,lastCorrect:!!result.correct,at,lastAt:at,attempts:(old?.attempts||0)+1,origin:'objective',round};}
    state.activeRounds[topicId]=at;state.rounds.push({topicId,at,total:rows.length,correct:rows.filter(r=>r.result.correct).length});state.rounds=state.rounds.slice(-100);
    if(topicStats(state,topicId).status==='mastered')delete state.reviewFlags[topicId];
    return topicStats(state,topicId);
  }
  function merge(a,b){
    const roundTime=r=>r.round?.startsWith('round-')?Number(r.round.slice(6))||0:0;
    for(const [key,r]of Object.entries(b.records)){const old=a.records[key];if(!old||roundTime(r)>roundTime(old)||(roundTime(r)===roundTime(old)&&(r.at>old.at||(r.at===old.at&&r.lastAt>old.lastAt))))a.records[key]={...r};}
    for(const [key,r]of Object.entries(b.manual))if(!a.manual[key]||r.at>a.manual[key].at)a.manual[key]={...r};
    Object.assign(a.reviewFlags,b.reviewFlags);for(const [key,r]of Object.entries(b.wrongLabs))if(!a.wrongLabs[key]||r.at>a.wrongLabs[key].at)a.wrongLabs[key]={...r};
    for(const [key,r]of Object.entries(b.labResolutions||{}))if(!a.labResolutions[key]||r.at>a.labResolutions[key].at)a.labResolutions[key]={...r};pruneResolvedLabs(a);
    for(const [id,at]of Object.entries(b.activeRounds||{}))a.activeRounds[id]=Math.max(a.activeRounds[id]||0,at);
    a.rounds=[...new Map([...a.rounds,...b.rounds].map(r=>[r.topicId+':'+r.at,r])).values()].sort((x,y)=>x.at-y.at).slice(-100);return a;
  }
  global.Assessment=Object.freeze({number,grade,isObjective,keyOf,create,sanitize,migrate,record,recordLabResult,manual,stats,topicStats,chapterStats,reassess,merge});
})(typeof window!=='undefined'?window:globalThis);
