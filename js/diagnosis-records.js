/* Diagnostic practice evidence and portable learning backups. Pure functions:
 * no storage, DOM, image, network or user-code execution. Assessment remains
 * the authority for objective mastery; these records explain practice history. */
(function(global){
  'use strict';
  const DAY=86400000,MAX_TIME=4102444800000;
  const LIMITS=Object.freeze({events:1000,retakes:100,backupBytes:5*1024*1024,depth:24,nodes:500000,entries:10000});
  const FORMAT='signallab.learning.backup',FORMAT_VERSION=3;
  const BAD_KEYS=new Set(['__proto__','prototype','constructor']);
  const ID=/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/;
  const isObject=value=>{if(!value||typeof value!=='object'||Array.isArray(value))return false;const p=Object.getPrototypeOf(value);return p===null||Object.getPrototypeOf(p)===null;};
  const id=value=>typeof value==='string'&&ID.test(value)&&!BAD_KEYS.has(value);
  const time=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=MAX_TIME;
  const copy=value=>JSON.parse(JSON.stringify(value));
  function create(){return {version:1,events:[],retakes:[]};}
  const eventKey=e=>JSON.stringify([e.questionId,e.round,e.correct,e.errorTypeIds]);
  const allowed=(set,value)=>!set||set.has(value);
  const setOf=value=>value?new Set(value):null;
  function filters(options={}){return {topics:setOf(options.topicIds),questions:setOf(options.questionIds),errors:setOf(options.errorTypeIds)};}
  function eventOf(raw,f){
    if(!isObject(raw)||!id(raw.questionId)||!id(raw.topicId)||typeof raw.correct!=='boolean'||!time(raw.at)||raw.kind&&raw.kind!=='objective')return null;
    if(!allowed(f.topics,raw.topicId)||!allowed(f.questions,raw.questionId))return null;
    if(!Array.isArray(raw.errorTypeIds)||raw.errorTypeIds.length>20||raw.errorTypeIds.some(x=>!id(x)))return null;
    const errors=raw.correct?[]:[...new Set(raw.errorTypeIds.filter(x=>allowed(f.errors,x)))].sort();
    const round=raw.round===undefined?'initial':raw.round,attemptKey=raw.attemptKey===undefined?`${round}:${raw.questionId}:${raw.correct}`:raw.attemptKey;
    if(!id(round)||!id(attemptKey)||raw.lastAt!==undefined&&!time(raw.lastAt)||raw.correctedAt!==undefined&&(!time(raw.correctedAt)||raw.correct||raw.correctedAt<raw.at))return null;
    const event={questionId:raw.questionId,topicId:raw.topicId,errorTypeIds:errors,correct:raw.correct,at:raw.at,lastAt:Math.max(raw.at,raw.lastAt??raw.at),attemptKey,round,kind:'objective'};
    if(raw.correctedAt!==undefined)event.correctedAt=raw.correctedAt;
    return event;
  }
  function retakeOf(raw,f){
    if(!isObject(raw)||!id(raw.topicId)||!allowed(f.topics,raw.topicId)||!time(raw.at)||!Array.isArray(raw.results)||raw.results.length<5||raw.results.length>100)return null;
    const round=raw.round===undefined?'round-'+raw.at:raw.round;if(!id(round))return null;
    const seen=new Set(),results=[];
    for(const r of raw.results){if(!isObject(r)||!id(r.questionId)||!allowed(f.questions,r.questionId)||typeof r.correct!=='boolean'||seen.has(r.questionId)||r.topicId!==undefined&&r.topicId!==raw.topicId)return null;seen.add(r.questionId);results.push({questionId:r.questionId,correct:r.correct});}
    return {topicId:raw.topicId,at:raw.at,round,results:results.sort((a,b)=>a.questionId.localeCompare(b.questionId))};
  }
  function normalize(raw,options={}){
    const result=create(),f=filters(options);if(!isObject(raw)||raw.version!==1)return result;
    const byKey=new Map(),attempts=new Map();
    for(const row of (Array.isArray(raw.events)?raw.events:[]).slice(-LIMITS.entries)){
      const e=eventOf(row,f);if(!e)continue;const key=eventKey(e),old=byKey.get(key),other=attempts.get(e.attemptKey);
      if(other&&other!==key)continue;
      if(old){old.at=Math.min(old.at,e.at);old.lastAt=Math.max(old.lastAt,e.lastAt);if(e.correctedAt!==undefined)old.correctedAt=Math.max(old.correctedAt??0,e.correctedAt);}else{byKey.set(key,e);attempts.set(e.attemptKey,key);}
    }
    result.events=[...byKey.values()].sort((a,b)=>a.lastAt-b.lastAt||eventKey(a).localeCompare(eventKey(b))).slice(-LIMITS.events);
    const retakes=new Map();
    for(const row of (Array.isArray(raw.retakes)?raw.retakes:[]).slice(-LIMITS.entries)){
      const r=retakeOf(row,f);if(!r)continue;const key=JSON.stringify([r.topicId,r.round,r.at]),old=retakes.get(key);
      if(old){const results=new Map(old.results.map(x=>[x.questionId,x.correct]));for(const x of r.results)results.set(x.questionId,(results.get(x.questionId)??true)&&x.correct);old.results=[...results].map(([questionId,correct])=>({questionId,correct})).sort((a,b)=>a.questionId.localeCompare(b.questionId));}
      else retakes.set(key,r);
    }
    // Retakes are a bounded audit trail. Preserve their latest relevant proof
    // with each retained wrong event before old audit rows leave that trail.
    // A later wrong answer updates lastAt and invalidates an earlier proof.
    const correctionTimes=new Map();
    for(const r of retakes.values())for(const answer of r.results)if(answer.correct){const key=JSON.stringify([r.topicId,answer.questionId]);correctionTimes.set(key,Math.max(correctionTimes.get(key)??0,r.at));}
    for(const e of result.events)if(!e.correct){const at=correctionTimes.get(JSON.stringify([e.topicId,e.questionId]));if(at!==undefined&&at>=e.lastAt)e.correctedAt=Math.max(e.correctedAt??0,at);}
    result.retakes=[...retakes.values()].sort((a,b)=>a.at-b.at||a.round.localeCompare(b.round)).slice(-LIMITS.retakes);
    return result;
  }
  function replace(state,next){state.version=1;state.events=next.events;state.retakes=next.retakes;return state;}
  function record(state,input){
    if(!isObject(state))throw new Error('错因记录容器无效。');
    if(input?.kind&&input.kind!=='objective'||input?.valid===false||input?.gradable===false)return {recorded:false,reason:'ungraded'};
    const e=eventOf(input,filters());if(!e)return {recorded:false,reason:'invalid'};
    const next=normalize(state),key=eventKey(e),same=next.events.find(x=>eventKey(x)===key),duplicate=next.events.find(x=>x.attemptKey===e.attemptKey);
    if(duplicate&&eventKey(duplicate)!==key)return {recorded:false,reason:'duplicate-attempt'};
    if(same){same.lastAt=Math.max(same.lastAt,e.lastAt);replace(state,normalize(next));return {recorded:false,reason:'same-question-round',updated:true};}
    next.events.push(e);replace(state,normalize(next));return {recorded:true};
  }
  function completeRetake(state,input){
    const r=retakeOf(input,filters());if(!r)throw new Error('诊断重测须完成同一知识点至少5道不同的有效客观题。');
    const next=normalize(state);next.retakes.push(r);replace(state,normalize(next));return stats(state);
  }
  function merge(a,b,options={}){const left=normalize(a,options),right=normalize(b,options);return replace(a,normalize({version:1,events:[...left.events,...right.events],retakes:[...left.retakes,...right.retakes]},options));}
  function stats(raw){
    const state=normalize(raw),wrong=state.events.filter(e=>!e.correct),errors=new Map(),topics=new Map();
    function resolve(row){
      const later=state.events.filter(e=>e.correct&&e.questionId===row.questionId&&e.topicId===row.topicId&&e.lastAt>=row.lastAt);
      const confirmed=state.retakes.filter(r=>r.topicId===row.topicId&&r.at>=row.lastAt&&r.results.some(x=>x.questionId===row.questionId&&x.correct));
      const retainedProof=row.correctedAt!==undefined&&row.correctedAt>=row.lastAt;
      const correctedAt=Math.max(0,retainedProof?row.correctedAt:0,...confirmed.map(r=>r.at));return {status:retainedProof||confirmed.length?'corrected':later.length?'provisional':'active',correctedAt};
    }
    function summarize(rows){
      const latest=new Map();for(const r of rows){const old=latest.get(r.questionId);if(!old||old.lastAt<=r.lastAt)latest.set(r.questionId,r);}
      const states=[...latest.values()].map(row=>({questionId:row.questionId,...resolve(row)}));
      const last=rows.reduce((a,b)=>a.lastAt>b.lastAt?a:b),active=states.filter(x=>x.status==='active'),provisional=states.filter(x=>x.status==='provisional'),corrected=states.filter(x=>x.status==='corrected');
      return {count:rows.length,questionCount:latest.size,lastAt:last.lastAt,latestQuestionId:last.questionId,topicId:last.topicId,status:active.length?'active':provisional.length?'provisional':'corrected',correctedAt:Math.max(0,...corrected.map(x=>x.correctedAt)),activeQuestions:active.map(x=>x.questionId),provisionalQuestions:provisional.map(x=>x.questionId),correctedQuestions:corrected.map(x=>x.questionId)};
    }
    for(const row of wrong){if(!topics.has(row.topicId))topics.set(row.topicId,[]);topics.get(row.topicId).push(row);for(const id of row.errorTypeIds){if(!errors.has(id))errors.set(id,[]);errors.get(id).push(row);}}
    const errorRows=[...errors].map(([id,rows])=>({id,...summarize(rows)})).sort((a,b)=>b.lastAt-a.lastAt||a.id.localeCompare(b.id));
    const topicRows=[...topics].map(([topicId,rows])=>{
      const s=summarize(rows),scheduled=s.questionCount>=2?Math.min(MAX_TIME,s.lastAt+DAY):null;
      const delayedRetake=scheduled!==null&&[...new Set(rows.map(x=>x.questionId))].every(q=>rows.some(e=>e.questionId===q&&e.correctedAt!==undefined&&e.correctedAt>=scheduled)||state.retakes.some(r=>r.topicId===topicId&&r.at>=scheduled&&r.results.some(x=>x.questionId===q&&x.correct)));
      return {topicId,...s,errorCount:new Set(rows.flatMap(x=>x.errorTypeIds)).size,lastErrorTypeId:rows.reduce((a,b)=>a.lastAt>b.lastAt?a:b).errorTypeIds.at(-1)||null,dueAt:scheduled!==null&&!delayedRetake?scheduled:null,delayedRetakeRequired:scheduled!==null&&!delayedRetake};
    }).sort((a,b)=>b.lastAt-a.lastAt||a.topicId.localeCompare(b.topicId));
    const last=wrong.length?wrong.reduce((a,b)=>a.lastAt>b.lastAt?a:b):null;
    return {errors:errorRows,topics:topicRows,totalWrong:wrong.length,totalEntries:state.events.length,retainedLimit:LIMITS.events,lastError:last?{questionId:last.questionId,topicId:last.topicId,errorTypeIds:[...last.errorTypeIds],at:last.lastAt}:null,correctedErrorCount:errorRows.filter(x=>x.status==='corrected').length};
  }
  function due(state,now=Date.now()){if(!time(now))return [];return stats(state).topics.filter(t=>t.dueAt!==null&&t.dueAt<=now);}

  // Backup parsing is deliberately strict and read-only. The application may
  // sanitize catalog IDs after this check, then ask before merge/replacement.
  function fail(path,message){throw new Error(`备份${path}：${message}`);}
  function object(v,path){if(!isObject(v))fail(path,'须为普通对象。');return v;}
  function keys(v,allowedKeys,path){object(v,path);for(const k of Object.keys(v))if(!allowedKeys.includes(k))fail(path+'.'+k,'不支持的数据字段。');}
  function integer(v,min,max,path){if(!Number.isSafeInteger(v)||v<min||v>max)fail(path,'整数超出允许范围。');}
  function timestamp(v,path){if(!time(v))fail(path,'时间须为1970至2100年的有限时间戳。');}
  function identifier(v,path){if(!id(v))fail(path,'标识符不正确。');}
  function boolean(v,path){if(typeof v!=='boolean')fail(path,'须为布尔值。');}
  function list(v,max,path){if(!Array.isArray(v)||v.length>max)fail(path,'数组格式或长度不正确。');return v;}
  function dictionary(v,path,visit,max=LIMITS.entries){object(v,path);const rows=Object.entries(v);if(rows.length>max)fail(path,'记录过多。');for(const [key,value]of rows){identifier(key,path);visit(value,path+'.'+key,key);}}
  function identifierList(v,path,max=LIMITS.entries){list(v,max,path);for(const x of v)identifier(x,path);}
  function treeCheck(root){
    let nodes=0;const seen=new Set();
    function visit(v,depth){
      if(++nodes>LIMITS.nodes||depth>LIMITS.depth)fail('','结构过深或过于复杂。');
      if(v===null||typeof v==='boolean')return;
      if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>1e15)fail('','数值无效或过大。');return;}
      if(typeof v==='string'){if(v.length>20000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v)||/(?:^\s*(?:data:|blob:|javascript:)|<\s*script\b)/i.test(v))fail('','不能包含图片、对象URL、脚本或异常长文本。');return;}
      if(typeof v!=='object'||seen.has(v))fail('','只接受无循环的JSON数据。');seen.add(v);
      if(Array.isArray(v)){if(v.length>LIMITS.entries)fail('','数组过长。');for(const x of v)visit(x,depth+1);}
      else{object(v,'');const names=Object.keys(v);if(names.length>LIMITS.entries)fail('','对象字段过多。');for(const name of names){if(BAD_KEYS.has(name))fail('','禁止原型相关字段。');if(name.length>240)fail('','字段名过长。');const field=Object.getOwnPropertyDescriptor(v,name);if(field.get||field.set)fail('','不接受可执行访问器。');visit(field.value,depth+1);}}
      seen.delete(v);
    }
    visit(root,0);
  }
  function validateModel(model,path){
    keys(model,['version','domain','segments','samples','endpoints','impulses','outside'],path);
    if(!global.WaveformMath)fail(path,'波形数学模块尚未加载。');
    const result=global.WaveformMath.validate(model);if(!result.valid)fail(path,result.issues[0]?.message||'波形模型无效。');
    for(const s of model.segments||[])keys(s,['start','end','y0','y1','leftClosed','rightClosed'],path+'.segments');
    for(const s of model.samples||[])keys(s,['n','value'],path+'.samples');
    for(const s of model.endpoints||[])keys(s,['at','value'],path+'.endpoints');
  }
  function validateAssessment(a,path){
    keys(a,['version','records','manual','reviewFlags','wrongLabs','labResolutions','rounds','activeRounds'],path);if(a.version!==1)fail(path,'评估记录版本不受支持。');
    if(a.records!==undefined)dictionary(a.records,path+'.records',(r,p)=>{keys(r,['questionId','topicId','chapter','correct','lastCorrect','at','lastAt','attempts','origin','round'],p);for(const k of ['questionId','topicId','chapter'])identifier(r[k],p+'.'+k);boolean(r.correct,p+'.correct');if(r.lastCorrect!==undefined)boolean(r.lastCorrect,p+'.lastCorrect');for(const k of ['at','lastAt'])if(r[k]!==undefined)timestamp(r[k],p+'.'+k);if(r.attempts!==undefined)integer(r.attempts,1,100000,p+'.attempts');if(r.origin!==undefined&&!['objective','legacy-last'].includes(r.origin))fail(p,'评估来源无效。');if(r.round!==undefined)identifier(r.round,p+'.round');});
    if(a.manual!==undefined)dictionary(a.manual,path+'.manual',(r,p)=>{keys(r,['correct','at'],p);boolean(r.correct,p+'.correct');timestamp(r.at,p+'.at');});
    if(a.reviewFlags!==undefined)dictionary(a.reviewFlags,path+'.reviewFlags',(v,p)=>boolean(v,p));
    if(a.wrongLabs!==undefined)dictionary(a.wrongLabs,path+'.wrongLabs',(r,p)=>{keys(r,['labId','familyId','seed','prompt','at'],p);identifier(r.labId,p+'.labId');identifier(r.familyId,p+'.familyId');integer(r.seed,0,4294967295,p+'.seed');timestamp(r.at,p+'.at');if(typeof r.prompt!=='string'||r.prompt.length>1200)fail(p,'实验题描述无效。');});
    if(a.labResolutions!==undefined)dictionary(a.labResolutions,path+'.labResolutions',(r,p)=>{keys(r,['familyId','seed','at'],p);identifier(r.familyId,p+'.familyId');integer(r.seed,0,4294967295,p+'.seed');timestamp(r.at,p+'.at');},5000);
    if(a.rounds!==undefined)for(const r of list(a.rounds,100,path+'.rounds')){keys(r,['topicId','at','total','correct'],path+'.rounds');identifier(r.topicId,path+'.rounds');timestamp(r.at,path+'.rounds');integer(r.total,5,100,path+'.rounds');integer(r.correct,0,r.total,path+'.rounds');}
    if(a.activeRounds!==undefined)dictionary(a.activeRounds,path+'.activeRounds',(v,p)=>timestamp(v,p));
  }
  function validateDiagnostics(d,path){
    keys(d,['version','events','retakes'],path);if(d.version!==1)fail(path,'错因记录版本不受支持。');
    for(const e of list(d.events,LIMITS.events,path+'.events')){keys(e,['questionId','topicId','errorTypeIds','correct','at','lastAt','attemptKey','round','kind','correctedAt'],path+'.events');if(!eventOf(e,filters()))fail(path,'错因记录字段无效。');}
    for(const r of list(d.retakes,LIMITS.retakes,path+'.retakes')){keys(r,['topicId','at','round','results'],path+'.retakes');for(const x of list(r.results,100,path+'.retakes.results'))keys(x,['questionId','correct'],path+'.retakes.results');if(!retakeOf(r,filters()))fail(path,'错因重测记录无效。');}
  }
  const DATA_KEYS=['version','theme','mode','visited','mastered','legacyMastered','bookmarks','favorites','wrong','attempts','quick','last','activity','assessment','waveformHistory','diagnostics','exportedAt'];
  function validateData(data){
    keys(data,DATA_KEYS,'.data');if(![1,2].includes(data.version))fail('.data.version','只支持旧版1/2学习记录。');
    identifierList(data.visited,'.data.visited');for(const k of ['bookmarks','favorites','wrong'])if(data[k]!==undefined)identifierList(data[k],'.data.'+k);
    if(data.theme!==undefined&&!['system','light','dark'].includes(data.theme))fail('.data.theme','主题偏好无效。');
    if(data.mode!==undefined&&!['detail','exam'].includes(data.mode))fail('.data.mode','学习模式无效。');
    for(const k of ['mastered','legacyMastered'])if(data[k]!==undefined)dictionary(data[k],'.data.'+k,(r,p)=>{keys(r,['at','due','level'],p);timestamp(r.at,p+'.at');timestamp(r.due,p+'.due');if(r.level!==undefined)integer(r.level,0,100000,p+'.level');});
    if(data.attempts!==undefined)dictionary(data.attempts,'.data.attempts',(r,p)=>{keys(r,['total','correct','lastCorrect','at'],p);integer(r.total,0,100000,p+'.total');integer(r.correct,0,r.total,p+'.correct');boolean(r.lastCorrect,p+'.lastCorrect');timestamp(r.at,p+'.at');});
    if(data.quick!==undefined)dictionary(data.quick,'.data.quick',(v,p)=>boolean(v,p));
    if(data.last!==undefined&&data.last!==null){keys(data.last,['chapter','topic'],'.data.last');identifier(data.last.chapter,'.data.last.chapter');identifier(data.last.topic,'.data.last.topic');}
    if(data.activity!==undefined){object(data.activity,'.data.activity');if(Object.keys(data.activity).length>LIMITS.entries)fail('.data.activity','日期记录过多。');for(const [date,n]of Object.entries(data.activity)){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)fail('.data.activity','日期无效。');integer(n,0,10000000,'.data.activity');}}
    if(data.assessment!==undefined)validateAssessment(data.assessment,'.data.assessment');
    if(data.waveformHistory!==undefined)for(const r of list(data.waveformHistory,80,'.data.waveformHistory')){keys(r,['questionId','at','correct','model','source','counted','pending'],'.data.waveformHistory');identifier(r.questionId,'.data.waveformHistory');timestamp(r.at,'.data.waveformHistory');boolean(r.correct,'.data.waveformHistory');if(!['manual','photo'].includes(r.source))fail('.data.waveformHistory','波形来源无效。');for(const k of ['counted','pending'])if(r[k]!==undefined)boolean(r[k],'.data.waveformHistory');validateModel(r.model,'.data.waveformHistory.model');}
    if(data.diagnostics!==undefined)validateDiagnostics(data.diagnostics,'.data.diagnostics');
    if(data.exportedAt!==undefined)dateString(data.exportedAt,'.data.exportedAt');
  }
  function dateString(value,path){if(typeof value!=='string'||value.length>40||!Number.isFinite(Date.parse(value))||!time(Date.parse(value)))fail(path,'导出时间无效。');}
  function validateSnapshot(rows){
    for(const r of list(rows,100,'.chapterMastery')){keys(r,['chapterId','correct','total','percent','status','eligible'],'.chapterMastery');identifier(r.chapterId,'.chapterMastery');integer(r.total,0,LIMITS.entries,'.chapterMastery');integer(r.correct,0,r.total,'.chapterMastery');if(typeof r.percent!=='number'||!Number.isFinite(r.percent)||r.percent<0||r.percent>100)fail('.chapterMastery','正确率无效。');if(!['insufficient','strengthen','learning','mastered'].includes(r.status))fail('.chapterMastery','掌握状态无效。');boolean(r.eligible,'.chapterMastery');}
  }
  function bytes(text){let n=0;for(const c of text){const cp=c.codePointAt(0);n+=cp<=127?1:cp<=2047?2:cp<=65535?3:4;if(n>LIMITS.backupBytes)break;}return n;}
  function parseBackup(text){
    if(typeof text!=='string'||text.length>LIMITS.backupBytes||bytes(text)>LIMITS.backupBytes)fail('','文件超过5MiB限制。');
    let raw;try{raw=JSON.parse(text);}catch{fail('','不是有效JSON文件。');}
    treeCheck(raw);let data,legacy=false;
    if(raw?.format===FORMAT){keys(raw,['format','formatVersion','exportedAt','data','chapterMastery'],'');if(raw.formatVersion!==FORMAT_VERSION)fail('.formatVersion','数据格式版本不受支持。');dateString(raw.exportedAt,'.exportedAt');data=raw.data;if(raw.chapterMastery!==undefined)validateSnapshot(raw.chapterMastery);}
    else{legacy=true;data=raw;}
    validateData(data);const clean=copy(data);delete clean.exportedAt;
    return {data:clean,formatVersion:legacy?data.version:FORMAT_VERSION,legacy,summary:{visited:data.visited.length,objectiveRecords:Object.keys(data.assessment?.records||{}).length,wrongQuestions:(data.wrong||[]).length,diagnosticEvents:data.diagnostics?.events.length||0}};
  }
  function buildBackup(store,options={}){
    object(store,'.data');const selected={};for(const k of DATA_KEYS){const field=Object.getOwnPropertyDescriptor(store,k);if(!field||k==='exportedAt')continue;if(field.get||field.set)fail('.data','不接受可执行访问器。');if(field.value!==undefined)selected[k]=field.value;}
    treeCheck(selected);validateData(selected);const data=copy(selected);data.diagnostics=normalize(data.diagnostics);
    let rows=options.chapterMastery||[];if(!Array.isArray(rows)){object(rows,'.chapterMastery');rows=Object.entries(rows).map(([chapterId,value])=>({chapterId,...value}));}
    const chapterMastery=rows.map(r=>({chapterId:r.chapterId||r.id,correct:r.correct,total:r.total,percent:r.percent,status:r.status,eligible:r.eligible}));validateSnapshot(chapterMastery);
    const result={format:FORMAT,formatVersion:FORMAT_VERSION,exportedAt:new Date().toISOString(),data,chapterMastery};
    const text=JSON.stringify(result);if(bytes(text)>LIMITS.backupBytes)fail('','记录超过5MiB，请减少冗余历史后再导出。');return result;
  }
  global.DiagnosisRecords=Object.freeze({create,normalize,record,completeRetake,merge,stats,due,parseBackup,buildBackup,format:FORMAT,formatVersion:FORMAT_VERSION,limits:LIMITS});
})(typeof window!=='undefined'?window:globalThis);
