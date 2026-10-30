/* Three learning goals share the course and tools, never a score container.
 * Pure HTML presentation; the application owns track selection and persistence.
 * Summary: {visited,mastered,correct,total,wrong,examCount}.
 * Exam row: {type,id,at,total:objectiveCount,correct,manual,answered,questionIds}.
 */
(function(global){
  'use strict';
  const TRACKS=Object.freeze([
    Object.freeze({id:'preview',title:'课前预习',short:'预习',order:'01',lead:'先建立直觉，再带着问题听课。',description:'从基础概念和波形演示入手，用基础练习检查自己是否理解。',action:'开始预习',steps:['基础知识讲解','交互演示','预习练习']}),
    Object.freeze({id:'classroom',title:'跟随课堂',short:'课堂',order:'02',lead:'跟着知识点，练清楚每一步。',description:'结合定义、推导和分步例题完成课后练习，用真实答题评估掌握程度。',action:'进入课堂学习',steps:['知识点与例题','课后习题','掌握度评估']}),
    Object.freeze({id:'finals',title:'期末冲刺',short:'冲刺',order:'03',lead:'用综合训练，找到复习的重点。',description:'核对公式与适用条件，进行综合练习和模拟考试，再回到薄弱知识点。',action:'开始期末复习',steps:['公式与方法','综合练习与模拟考试','薄弱项复习']})
  ]);
  const ids=new Set(TRACKS.map(t=>t.id)),idOf=id=>ids.has(id)?id:'classroom';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const count=(v,max=1000000)=>Number.isFinite(v)?Math.max(0,Math.min(max,Math.floor(v))):0;
  const safeId=v=>typeof v==='string'&&/^[A-Za-z0-9][\w.-]{0,159}$/.test(v)?v:null;
  const metadata=id=>TRACKS.find(t=>t.id===idOf(id));
  function scopedLink(trackId,route=''){
    const id=idOf(trackId);return '#path/'+id+(route?'?go='+encodeURIComponent(String(route)):'');
  }
  function summaryOf(raw={},topicCount=45){
    raw=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
    const total=count(raw.total),correct=count(raw.correct,total),topics=count(topicCount)||45;
    return {visited:count(raw.visited,topics),mastered:count(raw.mastered,topics),correct,total,wrong:count(raw.wrong),examCount:count(raw.examCount),topicCount:topics};
  }
  function summaryHTML(raw,topicCount=45,compact=false){
    const s=summaryOf(raw,topicCount);
    if(compact)return `<span class="lp-current-progress">本板块答对 <strong>${s.correct}/${s.total}</strong> 道客观题</span>`;
    return `<dl class="lp-stat-list"><div><dt>本板块已浏览</dt><dd>${s.visited}<span>/${s.topicCount} 个知识点</span></dd></div><div><dt>本板块客观作答</dt><dd>${s.correct}<span>/${s.total} 道答对</span></dd></div><div><dt>已掌握知识点</dt><dd>${s.mastered}</dd></div><div><dt>本板块错题</dt><dd>${s.wrong}</dd></div></dl>`;
  }
  function renderSwitcher(activeTrack,options={}){
    const active=idOf(activeTrack),t=metadata(active);
    return `<section class="lp-switcher" aria-label="当前学习板块"><nav class="lp-track-nav" aria-label="切换学习板块">${TRACKS.map(row=>`<a href="${scopedLink(row.id)}" data-path-switch="${row.id}" class="${active===row.id?'is-active':''}" ${active===row.id?'aria-current="true"':''}>${row.title}</a>`).join('')}</nav><div class="lp-current"><span class="lp-current-label">当前：${t.title}</span>${summaryHTML(options.summary,options.topicCount,true)}</div></section>`;
  }
  function renderHome(options={}){
    const active=idOf(options.activeTrack),tracks=options.tracks||{},topics=options.topicCount||45;
    return `<section class="learning-paths" aria-labelledby="learningPathsTitle"><div class="section-title"><h2 id="learningPathsTitle">按学习目标进入</h2><a href="#diagnostics">共享薄弱项诊断</a></div><p class="lp-isolation-note">三个板块分别保存浏览进度、答题记录与测评结果；共用知识点、实验工具和错因分析。</p><div class="lp-cards">${TRACKS.map(t=>`<section class="card lp-path-card ${active===t.id?'is-current':''}" data-learning-path="${t.id}"><div class="lp-card-head"><span class="lp-order" aria-hidden="true">${t.order}</span><h3>${t.title}</h3>${active===t.id?'<span class="badge">当前板块</span>':''}</div><p>${t.description}</p><ol class="lp-learning-steps">${t.steps.map(s=>`<li>${s}</li>`).join('')}</ol>${summaryHTML(tracks[t.id],topics)}<a class="btn ${active===t.id?'btn-primary':'btn-soft'} lp-enter" href="${scopedLink(t.id)}">${t.action}</a></section>`).join('')}</div></section>`;
  }
  function action(track,route,title,text,primary=false){return `<a class="card lp-action" href="${scopedLink(track,route)}"><div><h3>${title}</h3><p>${text}</p></div><span class="lp-action-label ${primary?'is-primary':''}">打开</span></a>`;}
  function chapterRows(trackId,chapters){
    return (Array.isArray(chapters)?chapters:[]).map((c,index)=>{
      if(!c||typeof c!=='object')return '';const id=safeId(c.id);if(!id)return '';
      const first=(Array.isArray(c.topics)?c.topics:[]).find(t=>safeId(t.id)),target=trackId==='preview'&&first?'lesson/'+id+'/'+first.id:trackId==='finals'?'formulas?chapter='+id:'chapter/'+id;
      return `<a class="lp-chapter-row" href="${scopedLink(trackId,target)}"><span class="lp-chapter-order">${String(index+1).padStart(2,'0')}</span><span><strong>${esc(c.title)}</strong><small>${trackId==='preview'?'从本章第一个知识点开始':trackId==='finals'?'核对本章公式、适用条件与易错点':'学习知识点、分步例题与章节习题'}</small></span><span class="lp-chapter-count">${Array.isArray(c.topics)?count(c.topics.length):0} 个知识点</span></a>`;
    }).join('');
  }
  function recommendationsHTML(trackId,rows){
    const items=(Array.isArray(rows)?rows:[]).slice(0,5).flatMap(r=>{
      if(!r||typeof r!=='object')return [];const questionId=safeId(r.questionId),topicId=safeId(r.topicId),chapter=safeId(r.chapter||r.chapterId),route=questionId?'question/'+questionId:topicId&&chapter?'lesson/'+chapter+'/'+topicId:null;
      return route?[`<li><a href="${scopedLink(trackId,route)}">${esc(r.title||r.topicTitle||'继续相关练习')}</a>${r.reason?`<p>${esc(r.reason)}</p>`:''}</li>`]:[];
    });
    return `<section class="card lp-shared"><h2>共享学习建议</h2><p>知识点和错因规则在三个板块通用；诊断中心会标出记录来源，其他板块的答对或重测不会覆盖本板块成绩。</p>${items.length?`<ul class="lp-recommendations">${items.join('')}</ul>`:''}<div class="btn-row"><a class="btn btn-soft" href="#diagnostics">查看跨板块薄弱项</a><a class="btn" href="${scopedLink(trackId,'review')}">查看本板块复习与评估</a></div></section>`;
  }
  function renderExamHistory(rows,trackId='finals'){
    const exams=(Array.isArray(rows)?rows:[]).filter(r=>r&&r.type==='exam'&&Number.isFinite(r.at)&&r.at>=0&&r.at<=4102444800000&&Number.isSafeInteger(r.total)&&r.total>=0&&Number.isSafeInteger(r.correct)&&r.correct>=0&&r.correct<=r.total&&Number.isSafeInteger(r.answered)&&r.answered>=0&&r.answered<=r.total&&(r.manual===undefined||Number.isSafeInteger(r.manual)&&r.manual>=0)).slice(-30).reverse();
    return `<section class="card lp-exam-history" aria-labelledby="lpExamHistoryTitle"><h2 id="lpExamHistoryTitle">本板块已交卷的模拟考试</h2>${exams.length?`<ol>${exams.map(r=>{const total=count(r.total),correct=count(r.correct,total);return `<li><time datetime="${new Date(r.at).toISOString()}">${esc(new Date(r.at).toLocaleString('zh-CN'))}</time><strong>客观题 ${correct}/${total}</strong><span>已作答 ${count(r.answered,total)}/${total} 道客观题${r.manual?`；自我核对 ${count(r.manual)} 题，单独记录`:''}</span></li>`;}).join('')}</ol>`:'<p class="muted">尚无已交卷记录。交卷后才保存考试结果；浏览题目不算完成考试。</p>'}<a class="btn btn-soft" href="${scopedLink(trackId,'exercises?session=exam')}">开始一次模拟考试</a><p class="assessment-note">客观得分与自我核对分开，长期掌握度仍按不同客观题和完整重测规则计算。</p></section>`;
  }
  function renderPanel(trackId,options={}){
    const id=idOf(trackId),t=metadata(id),chapters=options.chapters||[],topicCount=options.topicCount||45;
    const intro=id==='preview'?'预习记录独立保存；先看直观解释和信号图，再完成基础练习。':id==='finals'?'冲刺记录独立保存；先核对公式前提，再用综合练习与模拟考试检验。':'课堂记录独立保存；按知识点学习、展开例题并完成课后练习。';
    const actions=id==='preview'?[
      action(id,'chapter/'+(safeId(chapters[0]?.id)||'basics'),'基础知识讲解','从定义、单位和最基本的信号开始，先理解它描述什么。',true),
      action(id,'labs','交互演示','调节时间与幅度，观察变换、系统性质及卷积形成过程。'),
      action(id,'exercises?difficulty=1','预习基础练习','优先进入基础难度；反馈与测评只计入课前预习。')
    ]:id==='classroom'?[
      action(id,'map','知识点学习','沿章节结构学习定义、公式、推导、图解和易错点。',true),
      action(id,'chapter/'+(safeId(chapters[0]?.id)||'basics'),'分步例题训练','先独立思考，再逐步展开现有原创例题的推导。'),
      action(id,'exercises','课后习题','按章节、知识点、难度与题型训练，使用原有可靠判题。'),
      action(id,'review','掌握度评估','查看本板块的独立正确率、最低题量门槛及重新测评。')
    ]:[
      action(id,'formulas','公式与方法速查','同时核对变换约定、收敛域和公式适用条件。',true),
      action(id,'exercises?difficulty=advanced','综合练习','优先选择进阶与挑战题，练习跨步骤求解。'),
      action(id,'exercises?session=exam','期末模拟考试','按七章各抽3题，共21题、45分钟；交卷后记录本板块结果。'),
      action(id,'review','薄弱知识点复习','从本板块复习清单回到定义、错题与完整重测。')
    ];
    return `<div class="learning-path-panel" data-path-panel="${id}"><div class="page-heading"><div><h1>${t.title}</h1><p>${t.lead}</p></div><a class="btn btn-sm" href="#home">全部学习目标</a></div><section class="card lp-panel-summary"><h2>本板块学习记录</h2><p class="lp-isolation-note">${intro}</p>${summaryHTML(options.summary,topicCount)}<p class="assessment-note">正确率来自有效客观作答；至少完成5道不同题才评估知识点掌握，不把一次答对等同于掌握。</p></section><div class="lp-action-grid">${actions.join('')}</div><section class="card lp-chapters"><h2>${id==='preview'?'按章节预习':id==='finals'?'按章节核对公式':'按课堂进度学习'}</h2><div>${chapterRows(id,chapters)}</div></section>${id==='finals'?renderExamHistory(options.examHistory,id):''}${recommendationsHTML(id,options.recommendations)}<section class="lp-tool-links" aria-label="共用学习工具"><span>共用工具</span><a href="${scopedLink(id,'labs')}">信号实验室</a><a href="${scopedLink(id,'waveform-editor')}">波形与公式编辑</a><a href="${scopedLink(id,'photo-waveforms')}">照片与关键点绘图</a></section></div>`;
  }
  global.LearningPathsUI=Object.freeze({renderHome,renderPanel,renderSwitcher,renderExamHistory,scopedLink,definitions:()=>TRACKS.map(t=>({...t,steps:[...t.steps]}))});
})(typeof window!=='undefined'?window:globalThis);
