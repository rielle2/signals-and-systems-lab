/* Three learning contexts share a catalogue and saved items, never answer
 * evidence. Pure data helpers: no storage/network and no grading decisions. */
(function(global){
  'use strict';
  const IDS=Object.freeze(['preview','classroom','finals']);
  const LABELS=Object.freeze({preview:'课前预习',classroom:'跟随课堂',finals:'期末冲刺'});
  const SHARED=['theme','bookmarks','favorites'];
  const FIELDS=['version','mode','visited','mastered','legacyMastered','wrong','attempts','quick','last','activity','assessment','waveformHistory','diagnostics','examHistory'];
  const MAX_TIME=4102444800000,ID=/^[A-Za-z0-9][A-Za-z0-9_.:@/-]{0,199}$/;
  const BAD=new Set(['__proto__','constructor','prototype']);
  const object=v=>{if(!v||typeof v!=='object'||Array.isArray(v))return false;const p=Object.getPrototypeOf(v);return p===null||Object.getPrototypeOf(p)===null;};
  const identifier=v=>typeof v==='string'&&ID.test(v)&&!BAD.has(v);
  const copy=v=>JSON.parse(JSON.stringify(v));
  const own=(v,k)=>Object.prototype.hasOwnProperty.call(v,k);
  function checkTree(root){
    let nodes=0;const seen=new Set();
    function visit(v,depth){
      if(++nodes>500000||depth>24)throw new Error('学习记录结构过深或过大。');
      if(v===null||typeof v==='string'||typeof v==='boolean')return;
      if(typeof v==='number'){if(!Number.isFinite(v))throw new Error('学习记录包含非有限数值。');return;}
      if(typeof v!=='object'||seen.has(v))throw new Error('学习记录须为无循环的JSON数据。');
      if(!Array.isArray(v)&&!object(v))throw new Error('学习记录须为普通对象。');
      const keys=Object.keys(v);if(keys.length>10000)throw new Error('学习记录字段过多。');seen.add(v);
      for(const k of keys){if(BAD.has(k))throw new Error('禁止原型相关字段。');const d=Object.getOwnPropertyDescriptor(v,k);if(d.get||d.set)throw new Error('学习记录不能含可执行访问器。');visit(d.value,depth+1);}
      seen.delete(v);
    }
    visit(root,0);
  }
  function callbacks(options){if(typeof options?.blank!=='function'||typeof options?.sanitize!=='function')throw new Error('学习板块需要现有空记录与校验函数。');return options;}
  function sanitizeExamHistory(raw){
    if(!Array.isArray(raw))return [];
    try{checkTree(raw);}catch{return [];}
    const byId=new Map();
    for(const r of raw.slice(-10000)){
      if(!object(r)||!identifier(r.id)||!['exam','random','reassess'].includes(r.type)||!Number.isFinite(r.at)||r.at<0||r.at>MAX_TIME||!Array.isArray(r.questionIds)||r.questionIds.length>100||r.questionIds.some(id=>!identifier(id))||new Set(r.questionIds).size!==r.questionIds.length)continue;
      if(!['total','correct','manual','answered'].every(k=>Number.isSafeInteger(r[k])&&r[k]>=0)||r.total>r.questionIds.length||r.answered>r.total||r.correct>r.answered||r.manual>r.questionIds.length-r.total)continue;
      const next={id:r.id,type:r.type,at:r.at,total:r.total,correct:r.correct,manual:r.manual,answered:r.answered,questionIds:r.questionIds.slice()};
      const old=byId.get(next.id);
      // A session ID identifies its first submitted result, not an editable
      // draft. A newer review/import cannot improve that original score.
      const rate=r=>r.correct/Math.max(1,r.total),tie=old&&next.at===old.at;
      if(!old||next.at<old.at||tie&&(rate(next)<rate(old)||rate(next)===rate(old)&&(next.correct<old.correct||next.correct===old.correct&&JSON.stringify(next)<JSON.stringify(old))))byId.set(next.id,next);
    }
    return [...byId.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-30);
  }
  function selected(raw,fields){const result={};for(const k of fields)if(own(raw,k)&&raw[k]!==undefined)result[k]=copy(raw[k]);return result;}
  function bind(workspace){for(const id of IDS){const track=workspace.tracks[id];track.theme=workspace.shared.theme;track.bookmarks=workspace.shared.bookmarks;track.favorites=workspace.shared.favorites;}return workspace;}
  function load(raw,options){
    callbacks(options);if(raw!==null&&raw!==undefined)checkTree(raw);
    const isWorkspace=object(raw)&&raw.version===3;
    if(raw!==null&&raw!==undefined&&(!object(raw)||![1,2,3].includes(raw.version)))throw new Error('不支持的学习数据版本；原数据未改动。');
    if(isWorkspace&&(!object(raw.tracks)||!object(raw.shared)||!IDS.includes(raw.activeTrack)||IDS.some(id=>!object(raw.tracks[id]))||Object.keys(raw.tracks).some(id=>!IDS.includes(id))))throw new Error('三板块学习记录结构不完整。');
    const seed=options.blank('classroom'),sharedRaw=isWorkspace?raw.shared:raw||seed;
    const safeShared=options.sanitize({...seed,...selected(sharedRaw,SHARED)});
    const theme=['system','light','dark'].includes(sharedRaw.theme)?sharedRaw.theme:safeShared.theme;
    const shared={theme:['system','light','dark'].includes(theme)?theme:'system',bookmarks:(safeShared.bookmarks||[]).slice(),favorites:(safeShared.favorites||[]).slice()};
    const workspace={version:3,activeTrack:isWorkspace?raw.activeTrack:'classroom',shared,tracks:{}};
    for(const id of IDS){
      const incoming=isWorkspace?raw.tracks[id]:id==='classroom'?raw:null;
      if(incoming!==null&&incoming!==undefined&&!object(incoming))throw new Error('学习板块记录格式不正确。');
      const input=incoming?{...selected(incoming,FIELDS),...shared}:options.blank(id);
      const track=options.sanitize(input);track.version=2;track.examHistory=sanitizeExamHistory(incoming?.examHistory||input.examHistory);workspace.tracks[id]=track;
    }
    return bind(workspace);
  }
  function assertWorkspace(workspace){if(!object(workspace)||workspace.version!==3||!IDS.includes(workspace.activeTrack)||!object(workspace.tracks)||!object(workspace.shared)||IDS.some(id=>!object(workspace.tracks[id])))throw new Error('学习板块工作区无效。');}
  function current(workspace){assertWorkspace(workspace);return workspace.tracks[workspace.activeTrack];}
  function capture(workspace,store=workspace.tracks[workspace.activeTrack]){
    assertWorkspace(workspace);if(!object(store)||store.version!==2||IDS.some(id=>id!==workspace.activeTrack&&workspace.tracks[id]===store))throw new Error('当前板块记录无效，不能覆盖其他板块。');
    // Keep the active facade live. References of objective/diagnostic evidence
    // belong to exactly one track; only saved-item arrays are shared.
    workspace.tracks[workspace.activeTrack]=store;
    workspace.shared={theme:['system','light','dark'].includes(store.theme)?store.theme:workspace.shared.theme,bookmarks:Array.isArray(store.bookmarks)?store.bookmarks:workspace.shared.bookmarks,favorites:Array.isArray(store.favorites)?store.favorites:workspace.shared.favorites};
    return bind(workspace);
  }
  function activate(workspace,id,store){if(!IDS.includes(id))throw new Error('未知学习板块。');capture(workspace,store);workspace.activeTrack=id;return current(workspace);}
  function serialize(workspace,store){
    capture(workspace,store);const result={version:3,activeTrack:workspace.activeTrack,shared:copy(workspace.shared),tracks:{}};
    for(const id of IDS){result.tracks[id]=selected(workspace.tracks[id],FIELDS);result.tracks[id].version=2;result.tracks[id].examHistory=sanitizeExamHistory(workspace.tracks[id].examHistory);}
    return result;
  }
  function merge(left,right,options){
    callbacks(options);if(typeof options.mergeTrack!=='function')throw new Error('合并需要现有学习记录合并函数。');
    const a=load(left,options),b=load(right,options),out=load(serialize(a),options);
    out.shared.bookmarks=[...new Set([...a.shared.bookmarks,...b.shared.bookmarks])];out.shared.favorites=[...new Set([...a.shared.favorites,...b.shared.favorites])];
    for(const id of IDS){out.tracks[id]=options.mergeTrack(copy(a.tracks[id]),copy(b.tracks[id]));out.tracks[id].version=2;out.tracks[id].examHistory=sanitizeExamHistory([...a.tracks[id].examHistory,...b.tracks[id].examHistory]);}
    return bind(out);
  }
  global.LearningTracks=Object.freeze({ids:IDS,labels:LABELS,load,current,capture,activate,serialize,merge,sanitizeExamHistory});
})(typeof window!=='undefined'?window:globalThis);
