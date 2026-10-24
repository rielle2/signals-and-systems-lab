/* SignalLab — buildless, local-first application. No fetch, module loader or account. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const STORE_KEY='signallab.learning.v1',day=86400000,A=window.Assessment,UI=window.LearningUI;
  const chapters=window.COURSE.chapters;
  const topics=chapters.flatMap(c=>c.topics.map(t=>({...t,chapter:c.id,chapterTitle:c.title})));
  const oldTopicIds=('periodicity periodicity impulse-step energy-power even-odd time-transform energy-power energy-power periodicity time-transform linearity time-invariance time-invariance linearity causality invertibility bibo-stability memory time-invariance invertibility dt-convolution ct-convolution impulse-response zero-input-state differential-difference differential-difference convolution-properties convolution-properties impulse-response ct-convolution ctft ctfs dtfs dtft fourier-properties transform-pairs frequency-response fourier-properties gibbs transform-pairs nyquist aliasing aliasing nyquist sampling-process sampling-process reconstruction nyquist reconstruction aliasing laplace-bilateral laplace-roc laplace-inverse laplace-roc laplace-system unilateral-laplace unilateral-laplace laplace-roc laplace-system laplace-bilateral z-definition z-definition z-roc z-stability-poles z-roc z-system-equations z-system-equations z-stability-poles z-stability-poles z-inverse').split(' ');
  const questionBank=[...window.QUESTIONS,...(window.PRACTICE_QUESTIONS||[])].map(q=>{const topicId=q.topicId||oldTopicIds[Number(q.id.slice(1))-1],topic=topics.find(t=>t.id===topicId);return {...q,topicId,topic:topic?.title||q.topic,originalTopic:q.topic,category:q.category||(!A.isObjective(q)?'公式推导':q.chapter==='systems'?'系统性质判断':topicId?.includes('convolution')?'卷积计算':q.chapter==='fourier'?'傅里叶分析':q.chapter==='basics'?'波形分析':'基础应用')};});
  const familyCatalog=(window.LabPractice?.listFamilies?.()||[]).map(f=>({...f,id:f.id||f.familyId,familyId:f.familyId||f.id,assessmentKey:f.familyId||f.id,type:'numeric',answer:0}));
  const assessmentCatalog=[...questionBank,...familyCatalog];
  const blank=()=>({version:2,theme:window.SignalTheme?.getPreference()||'system',mode:'detail',visited:[],mastered:{},legacyMastered:{},bookmarks:[],favorites:[],wrong:[],attempts:{},quick:{},last:null,activity:{},assessment:A.create()});
  let store=blank(),storageOK=true,toastTimer,examTimer,currentLab=null,currentCustom=false,currentPractice=false;
  try{const saved=JSON.parse(localStorage.getItem(STORE_KEY)||'null');if(saved&&[1,2].includes(saved.version))store=sanitize(saved);}catch{storageOK=false;}
  function sanitize(saved){
    const d=blank(),topicIds=new Set(topics.map(t=>t.id)),questionIds=new Set(questionBank.map(q=>q.id));
    const safe=(list,valid)=>Array.isArray(list)?[...new Set(list.filter(id=>typeof id==='string'&&valid.has(id)))]:[];
    for(const key of ['visited','bookmarks','favorites','wrong'])d[key]=safe(saved[key],['visited','bookmarks'].includes(key)?topicIds:questionIds);
    d.mode=saved.mode==='exam'?'exam':'detail';
    if(saved.last&&topics.some(t=>t.id===saved.last.topic&&t.chapter===saved.last.chapter))d.last={chapter:saved.last.chapter,topic:saved.last.topic};
    for(const [id,v]of Object.entries(saved.version===1?saved.mastered||{}:saved.legacyMastered||{}))if(topicIds.has(id)&&v&&Number.isFinite(v.at)&&Number.isFinite(v.due))d.legacyMastered[id]={at:v.at,due:v.due,level:Number(v.level)||0};
    for(const [id,v]of Object.entries(saved.attempts||{}))if(questionIds.has(id)&&v&&Number.isFinite(v.total)&&Number.isFinite(v.correct))d.attempts[id]={total:Math.max(0,v.total),correct:Math.max(0,Math.min(v.correct,v.total)),lastCorrect:!!v.lastCorrect,at:Number(v.at)||0};
    for(const [id,v]of Object.entries(saved.quick||{}))if(topicIds.has(id)&&typeof v==='boolean')d.quick[id]=v;
    for(const [date,v]of Object.entries(saved.activity||{}))if(/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(v))d.activity[date]=Math.max(0,v);
    d.assessment=A.migrate(saved,assessmentCatalog,[...topicIds]);return d;
  }
  function syncMastery(){const next={};for(const topic of topics){const stats=A.topicStats(store.assessment,topic.id);if(stats.status==='mastered')next[topic.id]={at:stats.evaluatedAt,due:stats.evaluatedAt+7*day,level:0};}store.mastered=next;}
  function persist() { syncMastery();store.theme=window.SignalTheme?.getPreference()||store.theme;try {localStorage.setItem(STORE_KEY,JSON.stringify(store));storageOK=true;} catch {storageOK=false;} $('#storageWarning').hidden = storageOK; }
  function notify(message) {const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2800);}
  function dateKey(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
  function activity(){const key=dateKey();store.activity[key]=(store.activity[key]||0)+1;}
  const findTopic = id => topics.find(t=>t.id===id);
  const chapterOf = id => chapters.find(c=>c.id===id);
  const topicURL = t => `#lesson/${t.chapter}/${t.id}`;
  const formula = latex => `<div class="math-display" data-latex="${esc(latex)}"></div>`;
  window.MathTypeset = function(root=document) {
    $$('[data-latex]',root).forEach(el=>{try{window.katex.render(el.dataset.latex,el,{displayMode:true,throwOnError:true,strict:'ignore',trust:false});}catch(e){el.textContent=el.dataset.latex;el.classList.add('math-error');console.error('Formula error',el.dataset.latex,e.message);}});
    if(window.renderMathInElement) window.renderMathInElement(root,{delimiters:[{left:'$$',right:'$$',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false},{left:'\\[',right:'\\]',display:true}],throwOnError:false,strict:'ignore',trust:false});
  };
  const icons = {
    home:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    lab:'<path d="M9 3h6M10 3v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3M8 15h8"/>',
    exercise:'<rect x="5" y="4" width="15" height="17" rx="2"/><path d="M9 2v4h7V2M9 11h7M9 15h7"/>',
    review:'<path d="M4 8a9 9 0 1 1-1 7M4 3v5h5M12 7v5l3 2"/>',
    formula:'<path d="M18 3H9l-4 9 4 9h9M7 12h10"/>',
    map:'<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5H5v5M12 12h7v5"/>',
    bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    wrong:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="m9 9 6 6m0-6-6 6"/>'
  };
  const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.lab}</svg>`;
  const labInfo = [
    {id:'transform',name:'信号变换',en:'Signal transformations',symbol:'↔',text:'拖动时间轴，理解平移、反转与尺度变化。'},
    {id:'systems',name:'系统性质',en:'System properties',symbol:'⇄',text:'沿两条路径检验时不变性，分清系统的六种性质。'},
    {id:'convolution',name:'卷积可视化',en:'Convolution',symbol:'∗',text:'从翻转到积分，把每一个重叠面积变成输出。'},
    {id:'fourier',name:'傅里叶合成',en:'Fourier synthesis',symbol:'∑',text:'逐个加入谐波，观察频谱、相位与吉布斯现象。'},
    {id:'sampling',name:'采样与混叠',en:'Sampling & aliasing',symbol:'⋮',text:'改变采样率，看到不同连续信号如何产生相同样本。'},
    {id:'poles',name:'极点与零点',en:'Poles & zeros',symbol:'⊗',text:'拖动实根或共轭根，联系收敛域、响应与稳定性。'}
  ];
  const chapterEnglish = ['Signals & fundamentals','System properties','Linear time-invariant systems','Fourier analysis','Sampling theory','Laplace transform','Z-transform'];
  const symbols = ['∿','⇄','∗','ℱ','⋮','ℒ','ℤ'];
  function waveSVG(kind=0,hero=false){
    let path='';for(let i=0;i<=300;i++){let x=i/300*360,y=60-27*Math.sin(i/300*Math.PI*6)*(hero?Math.exp(-Math.pow((i-150)/140,2)):1);if(kind===1)y=60-(i%80<40?23:-23);if(kind===2)y=90-55*Math.exp(-Math.pow((i-140)/70,2));path+=`${i?'L':'M'}${x.toFixed(1)},${y.toFixed(1)} `;}
    return `<svg viewBox="0 0 360 120" aria-hidden="true"><defs><pattern id="grid${kind}${hero}" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M24 0H0V24" fill="none" stroke="currentColor" opacity=".08"/></pattern></defs><rect width="360" height="120" fill="url(#grid${kind}${hero})" style="color:var(--blue)"/><path d="M0 60H360" stroke="currentColor" opacity=".16" style="color:var(--blue)"/><path d="${path}" fill="none" stroke="var(--blue)" stroke-width="2.3"/>${hero?'<text x="240" y="24" fill="var(--blue)" font-size="12">x(t)</text><path d="M0 68Q90 105 180 50T360 66" fill="none" stroke="var(--teal)" opacity=".5" stroke-width="1.5"/>':''}</svg>`;
  }
  function renderSidebar(route) {
    const top = route[0]||'home';
    const links=[['home','学习概览','home'],['labs','交互实验室','lab'],['exercises','习题中心','exercise'],['review','复习计划','review'],['formulas','公式速查','formula'],['map','知识结构','map'],['bookmarks','我的收藏','bookmark']];
    $('#sidebar').innerHTML=`<a class="brand" href="#home"><img class="brand-logo" src="assets/favicon.svg" alt=""><div><strong>SignalLab<span style="color:var(--blue)">.</span></strong><small>信号与系统 · 交互学习</small></div></a><div class="nav-label">LEARNING SPACE</div><nav>${links.map(([id,title,ico])=>`<a class="nav-link ${top===id?'active':''}" href="#${id}">${icon(ico)}${title}${id==='labs'?'<span class="nav-count">06</span>':id==='review'&&wrongCount()?`<span class="nav-count">${wrongCount()}</span>`:''}</a>`).join('')}</nav><div class="nav-label">COURSE CHAPTERS</div><nav aria-label="课程章节">${chapters.map((c,i)=>`<details class="chapter-nav" ${route[1]===c.id?'open':''}><summary><span class="chapter-num">${String(i+1).padStart(2,'0')}</span>${esc(c.title)}</summary><a href="#chapter/${c.id}">章节概览</a>${c.topics.map(t=>`<a class="${route[2]===t.id?'active':''}" href="#lesson/${c.id}/${t.id}">${esc(t.title)}</a>`).join('')}</details>`).join('')}</nav><div class="sidebar-bottom"><div class="offline-box"><strong><span class="status-dot"></span>离线学习，随时开始</strong><div>学习数据保存在当前浏览器</div><button class="backup-btn" data-go-backup>数据备份与恢复 ↗</button></div></div>`;
    $('[data-go-backup]').onclick=()=>{location.hash='about';setTimeout(()=>$('#dataBackup')?.scrollIntoView(),50);};
  }
  const progressOf=c=>{const stats=A.chapterStats(store.assessment,c.id,c.topics.length);return {n:c.topics.filter(t=>store.mastered[t.id]).length,total:c.topics.length,pct:stats.percent,assessment:stats};};
  function heading(title,sub,right=''){return `<div class="page-heading"><div><h1>${title}</h1><p>${sub}</p></div>${right}</div>`;}
  function empty(title,text,link='#home',label='回到学习概览'){return `<div class="card empty"><div class="empty-symbol">◇</div><h2>${title}</h2><p>${text}</p><a class="btn btn-primary" href="${link}">${label} →</a></div>`;}
  const stepList = arr => `<ol class="steps">${(arr||[]).map(s=>`<li><div>${esc(s)}</div></li>`).join('')}</ol>`;
  function wrongCount(){return store.wrong.length+Object.keys(store.assessment.wrongLabs).length;}
  function masteredCount(){return topics.filter(t=>store.mastered[t.id]).length;}
  function dueTopics(){return topics.filter(t=>store.assessment.reviewFlags[t.id]||(store.mastered[t.id]&&store.mastered[t.id].due<=Date.now())||A.topicStats(store.assessment,t.id).status==='strengthen');}
  function nextTopic(){return topics.find(t=>!store.mastered[t.id])||topics[0];}
  function lastTopic(){return findTopic(store.last?.topic)||nextTopic();}
  function chapterCard(c,i){const p=progressOf(c);return `<a class="chapter-card card" href="#chapter/${c.id}"><div class="chapter-top"><div class="chapter-icon">${symbols[i]}</div><div><h3>${String(i+1).padStart(2,'0')} · ${esc(c.title)}</h3><div class="en">${chapterEnglish[i]}</div></div></div><p>${esc(c.subtitle||c.topics.slice(0,3).map(t=>t.title).join(' · '))}</p><div class="chapter-meta"><span>${c.topics.length} 个知识点</span><span>${p.assessment.total?`${p.assessment.correct}/${p.assessment.total} · ${p.assessment.label}`:'尚未测评 ↗'}</span></div><div class="progress"><span style="width:${p.pct}%"></span></div></a>`;}
  function renderHome(){
    const n=masteredCount(),pct=Math.round(n/topics.length*100),due=dueTopics(),last=lastTopic(),suggest=due[0]||nextTopic();
    const date=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
    return `${heading('把信号，看得更清楚。','从直觉到推导，从一条波形到整个系统。',`<div class="date-label">${date}</div>`)}<div class="home-top"><section class="hero"><div class="hero-badge">✦ 你的信号与系统学习空间</div><h2>理解每一次变换，<br>建立属于你的<span>系统直觉。</span></h2><p>跟随奥本海姆的知识体系，通过推导、交互实验与练习，把抽象概念真正学懂。</p><div class="btn-row"><a class="btn btn-primary" href="${topicURL(last)}">${store.last?'继续上次学习':'开始第一课'} <span>→</span></a><a class="btn" href="#labs">进入信号实验室 ↗</a></div><div class="hero-wave">${waveSVG(0,true)}</div></section><section class="card today-card"><div class="today-title"><h3>今日学习建议</h3><span class="today-icon">☀</span></div><div><p>${due.length?`有 ${due.length} 个知识点到达复习时间，趁记忆还在，巩固一下。`:'每天一点，建立连续的理解。今天可以从这里开始。'}</p><a class="today-task" href="${topicURL(suggest)}"><span class="task-ring"></span>${esc(suggest.title)}</a><a class="today-task" href="#exercises"><span class="task-ring"></span>完成 5 道章节练习</a><a class="today-task" href="#labs/convolution"><span class="task-ring"></span>观察一次卷积的形成</a></div><div class="today-foot">◷ 建议投入 20–30 分钟 <span style="float:right">循序渐进</span></div></section></div><div class="stats-grid">${[
      ['课程学习进度',`${pct}<span style="font-size:13px">%</span>`,'home',`共 ${topics.length} 个知识点`,`<div class="progress" style="width:60px"><span style="width:${pct}%"></span></div>`],
      ['已掌握知识点',n,'check',`已浏览 ${store.visited.filter(id=>findTopic(id)).length} 个知识点`,'继续积累 ↗'],
      ['待复习知识点',due.length,'clock','需要加强、主动标记或测评7天后','今日计划 ↗'],
      ['错题本',wrongCount(),'wrong',`题库共 ${questionBank.length} 道原创题`,'去巩固 ↗']
    ].map(([label,value,ico,foot,extra],i)=>`<a href="${['#map','#review','#review','#exercises/wrong'][i]}" class="card stat" style="color:var(--text)"><span class="stat-label">${label}</span><strong>${value}</strong><div class="stat-icon" ${i===2?'style="color:var(--orange);background:color-mix(in srgb,var(--orange) 10%,transparent)"':i===3?'style="color:var(--red);background:color-mix(in srgb,var(--red) 10%,transparent)"':''}>${icon(ico)}</div><div class="stat-foot"><span>${foot}</span><span>${extra}</span></div></a>`).join('')}</div><div class="home-bottom"><section><div class="section-title"><h2>课程章节 <span class="muted" style="font-weight:400;margin-left:9px;font-size:11px">一条清晰的学习路径</span></h2><a href="#map">查看知识结构 →</a></div><div class="chapters-grid">${chapters.map(chapterCard).join('')}</div></section><aside class="home-side"><div class="section-title"><h2>在实验中理解</h2><span class="badge">INTERACTIVE</span></div><section class="card lab-promo"><h3>让公式动起来</h3><div class="mini-wave">${waveSVG(2)}</div><p>自己调参数，比看十遍结论更直观。</p><div class="lab-list">${labInfo.slice(0,3).map(l=>`<a href="#labs/${l.id}"><span style="color:var(--blue)">${l.symbol}</span>${l.name}<span>↗</span></a>`).join('')}</div><a class="text-link" style="display:block;margin-top:15px;font-size:10px" href="#labs">探索全部 6 个实验室 →</a></section><section class="card tip-card"><h3>✧ 学习小提示</h3><p>卷积中，真正移动的是翻转后的冲激响应。先看清自变量，再找两段信号重叠的范围。</p><div class="formula-inline">$y(t)=\\int_{-\\infty}^{\\infty}x(\\tau)h(t-\\tau)\\,d\\tau$</div><a class="text-link" style="font-size:10px;display:block;margin-top:14px" href="#labs/convolution">亲手试一试 →</a></section></aside></div>`;
  }

  function renderChapter(id){
    const c=chapterOf(id);if(!c)return empty('未找到章节','请通过左侧导航选择课程。');
    const i=chapters.indexOf(c),p=progressOf(c);
    return `${heading(c.title,`第 ${i+1} 章 · ${chapterEnglish[i]}`)}<div class="card chapter-banner"><div class="eyebrow">CHAPTER ${String(i+1).padStart(2,'0')}</div><h2>${esc(c.subtitle||'从概念、定义到方法与应用')}</h2><p>${c.topics.length} 个知识点 · 原创分步例题、客观练习与实验训练。</p>${UI.assessment(p.assessment,true)}<p class="assessment-note">知识点已掌握 ${p.n} / ${p.total}。章节正确率按不同题目计算，旧自评不计入。</p></div><div class="topic-list">${c.topics.map((t,j)=>{const stats=A.topicStats(store.assessment,t.id);return `<a class="card topic-row" href="#lesson/${c.id}/${t.id}"><span class="topic-number">${String(j+1).padStart(2,'0')}</span><div class="topic-info"><h3>${esc(t.title)}</h3><p>${esc(t.intuition).replace(/\$[^$]+\$/g,'…').slice(0,85)}</p></div><span class="topic-state assessment-label ${stats.status}">${stats.label}<small>${stats.correct}/${stats.total} · ${stats.total?stats.percent+'%':'需5题'}</small></span></a>`;}).join('')}</div>${UI.chapterExamples(c.id)}<div class="btn-row spaced"><a class="btn btn-primary" href="#exercises?chapter=${c.id}">本章习题 →</a><a class="btn" href="#formulas?chapter=${c.id}">本章公式速查</a></div>`;
  }
  function conceptVisual(t){
    if(window.ConceptVisuals){
      const visual=window.ConceptVisuals(t);
      const lab=t.lab||({basics:'transform',systems:'systems',lti:'convolution',fourier:'fourier',sampling:'sampling',laplace:'poles',z:'poles'})[t.chapter];
      if(visual?.svg)return `<div class="concept-visual">${visual.svg}</div><p class="visual-caption">${esc(visual.caption)}</p><a class="btn btn-soft btn-sm spaced" href="#labs/${lab}">进入${labInfo.find(l=>l.id===lab)?.name||'交互'}实验室 →</a>`;
    }
    const kind=t.visual?.kind||'sine';let path='';let stems='';
    for(let i=0;i<=400;i++){const x=(i/400)*8-4;let y=Math.sin(x*2);if(kind==='rect')y=x>=-1&&x<=1?1:0;else if(kind==='exp')y=x>=0?Math.exp(-x):0;else if(kind==='step')y=x>=0?1:0;else if(kind==='discrete')y=x>=0?Math.pow(.65,Math.floor(x+1e-6)):0;let X=35+(x+4)/8*530,Y=100-y*50;if(kind==='discrete'){if(i%50===0)stems+=`<path d="M${X} 100V${Y}" stroke="var(--blue)" stroke-width="2"/><circle cx="${X}" cy="${Y}" r="3" fill="var(--blue)"/>`;}else path+=`${i?'L':'M'}${X.toFixed(2)},${Y.toFixed(2)} `;}
    const preview=`<svg viewBox="0 0 600 150" role="img" aria-label="${esc(t.visual?.caption||'信号示意图')}"><path d="M35 100H575M300 20V125" stroke="var(--muted)" opacity=".5"/><text x="573" y="118" fill="var(--muted)" font-size="11">${kind==='discrete'?'n':'t'}</text><text x="306" y="115" fill="var(--muted)" font-size="10">0</text><path d="${path}" fill="none" stroke="var(--blue)" stroke-width="2.5"/>${stems}</svg>`;
    const lab=t.lab||({basics:'transform',systems:'systems',lti:'convolution',fourier:'fourier',sampling:'sampling',laplace:'poles',z:'poles'})[t.chapter];
    return `<div class="concept-visual">${preview}</div><p class="visual-caption">${esc(t.visual?.caption||'波形示意帮助建立直觉。具体参数和完整计算可在对应实验室中观察。')}</p><a class="btn btn-soft btn-sm spaced" href="#labs/${lab}">进入${labInfo.find(l=>l.id===lab)?.name||'交互'}实验室 →</a>`;
  }
  function lessonSection(id,no,title,body){return `<section class="card lesson-section" id="${id}"><h2><span class="section-no">${no}</span>${title}</h2>${body}</section>`;}
  function renderLesson(chapter,id){
    const t=topics.find(t=>t.id===id&&t.chapter===chapter);if(!t)return empty('未找到知识点','使用章节导航重新选择。');
    if(!store.visited.includes(id)){store.visited.push(id);activity();}store.last={chapter,topic:id};persist();
    const exam=store.mode==='exam',index=topics.findIndex(x=>x.id===id),c=chapterOf(chapter);
    return `<div class="lesson-head"><div class="btn-row" style="justify-content:space-between"><a class="small" href="#chapter/${chapter}">← ${esc(c.title)}</a><div class="mode-switch"><button data-mode="detail" class="${!exam?'active':''}">详细讲解</button><button data-mode="exam" class="${exam?'active':''}">考试速记</button></div></div><h1>${esc(t.title)}</h1><div class="btn-row"><span class="badge">${esc(c.title)}</span><span class="muted small">◷ ${t.minutes||12} 分钟</span><span class="muted small">${A.topicStats(store.assessment,id).label}</span></div></div>${exam?'<div class="exam-banner">考试速记模式 · 聚焦核心公式、典型解题步骤与易错点。切换“详细讲解”查看定义和推导。</div>':''}<div class="lesson-layout"><article class="lesson-content">${!exam?lessonSection('intuition','01','直观理解',`<p>${esc(t.intuition)}</p>`)+lessonSection('definition','02','严格定义',`<p>${esc(t.definition)}</p>`):''}${lessonSection('formulas','03','核心公式',`<div class="formula-box">${t.formulas.map(formula).join('')}</div>`)}${!exam?lessonSection('derivation','04','一步步推导',stepList(t.derivation))+lessonSection('visual','05','图形与实验',conceptVisual(t)):''}${lessonSection('example','06','原创例题 · 分步练习',UI.examplesFor(t,exam))}${lessonSection('pitfalls','07','易错点',`<ul class="pitfalls">${t.pitfalls.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`)}${!exam?lessonSection('quick','08','快速自测',`<p class="assessment-note">即时概念反馈，不计入客观掌握率；请完成下方知识点练习。</p><p>${esc(t.quick.question)}</p><div class="quick-options">${t.quick.options.map((o,i)=>`<button class="option" data-quick="${i}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span></button>`).join('')}</div><div id="quickFeedback" aria-live="polite"></div>`):''}<div class="lesson-bottom">${index>0?`<a class="btn" href="${topicURL(topics[index-1])}">← 上一个知识点</a>`:'<span></span>'}${index<topics.length-1?`<a class="btn btn-primary" href="${topicURL(topics[index+1])}">下一个知识点 →</a>`:`<a class="btn btn-primary" href="#review">进入复习计划 →</a>`}</div></article><aside class="lesson-aside"><section class="card"><h3>练习评估</h3>${UI.assessment(A.topicStats(store.assessment,id))}<p class="assessment-note">每题本轮首次作答计分；普通重做不改测评分。完成5道不同题的重新测评后，可更新掌握状态。</p><a class="btn btn-primary spaced" style="width:100%" href="#exercises?chapter=${chapter}&topic=${id}">完成知识点练习</a><button class="btn spaced" data-reassess="${id}" style="width:100%">重新测评 · 5道不同题</button><button class="btn spaced" data-review-topic="${id}" style="width:100%">${store.assessment.reviewFlags[id]?'✓ 已标记需要复习':'标记需要复习'}</button><button class="btn spaced" data-bookmark="${id}" style="width:100%;margin-top:9px">${store.bookmarks.includes(id)?'★ 已收藏知识点':'☆ 收藏知识点'}</button></section><section class="card toc"><h3>本节导航</h3>${['直观理解','严格定义','核心公式','一步步推导','图形与实验','典型例题','易错点','快速自测'].map((s,i)=>`<a href="javascript:void(0)" data-scroll="${['intuition','definition','formulas','derivation','visual','example','pitfalls','quick'][i]}">${String(i+1).padStart(2,'0')} ${s}</a>`).join('')}</section><section class="card"><h3>用练习检验理解</h3><p class="muted small">自测通过后，再尝试本章不同题型。</p><a class="btn btn-soft spaced" style="width:100%" href="#exercises?chapter=${chapter}">进入本章习题 →</a></section></aside></div>`;
  }
  function bindLesson(id){const t=findTopic(id);if(!t)return;
    $$('[data-mode]').forEach(b=>b.onclick=()=>{store.mode=b.dataset.mode;persist();render();});
    $$('[data-scroll]').forEach(a=>a.onclick=e=>{e.preventDefault();$('#'+a.dataset.scroll)?.scrollIntoView({behavior:'smooth'});});
    $('[data-review-topic]').onclick=()=>{if(store.assessment.reviewFlags[id])delete store.assessment.reviewFlags[id];else store.assessment.reviewFlags[id]=true;persist();render();};
    $('[data-reassess]').onclick=()=>{location.hash=`exercises?chapter=${t.chapter}&topic=${id}&reassess=1`;};
    $('[data-bookmark]').onclick=()=>{toggleId(store.bookmarks,id);persist();render();notify(store.bookmarks.includes(id)?'已收藏知识点':'已取消收藏');};
    $$('[data-quick]').forEach(b=>b.onclick=()=>{const i=+b.dataset.quick,correct=i===t.quick.answer;store.quick[id]=correct;activity();persist();$$('[data-quick]').forEach(x=>{x.classList.remove('selected','correct','incorrect');if(+x.dataset.quick===t.quick.answer)x.classList.add('correct');if(+x.dataset.quick===i&&!correct)x.classList.add('incorrect');});$('#quickFeedback').innerHTML=`<div class="feedback ${correct?'success':'error'}"><strong>${correct?'回答正确，继续巩固。':'还差一点，再看看定义。'}</strong><div>${esc(t.quick.explanation)}</div></div>`;MathTypeset($('#quickFeedback'));});
  }
  function toggleId(arr,id){const i=arr.indexOf(id);if(i===-1)arr.push(id);else arr.splice(i,1);}
  function renderLabs(id,params){if(!id)return `${heading('交互式信号实验室','从预设教学到自定义表达式，使用同一信号探索时域与频域。')}<div class="card" style="margin-bottom:22px;background:var(--blue-soft)"><div class="eyebrow">CUSTOM SIGNALS · 新增通用信号核心</div><h2>输入你自己的 x(t) 或 x[n]</h2><p class="muted small spaced">安全数学表达式、分段编辑、信号收藏与缩放拖动画布，可用于变换、系统性质、卷积、频谱和采样。</p><div class="btn-row spaced"><a class="btn btn-primary" href="#labs/transform?mode=custom">自定义信号分析 →</a><a class="btn" href="#signal-guide">查看输入语法与计算范围</a></div></div><div class="labs-grid">${labInfo.map((l,i)=>`<div class="card lab-card"><div class="lab-card-preview">${waveSVG(i%3)}</div><div class="eyebrow" style="margin-top:18px">LAB ${String(i+1).padStart(2,'0')} · ${l.en.toUpperCase()}</div><h3>${l.symbol} ${l.name}</h3><p>${l.text}</p><div class="btn-row"><a class="btn btn-soft btn-sm" href="#labs/${l.id}">预设教学 →</a>${l.id!=='poles'?`<a class="btn btn-sm" href="#labs/${l.id}?mode=custom">自定义信号 ↗</a><a class="btn btn-primary btn-sm" href="#labs/${l.id}?mode=practice">练习模式 →</a>`:''}</div></div>`).join('')}</div><div class="lab-note">计算约定：连续时间角频率使用 rad/s，采样率使用 Hz，离散角频率使用 rad/sample。自定义信号频谱采用明确时间窗口，不能直接当作无限区间变换。</div>`;
    const l=labInfo.find(l=>l.id===id);if(!l)return empty('未找到实验室','请从实验室首页选择。','#labs','返回实验室');
    currentLab=id;currentPractice=params.get('mode')==='practice'&&id!=='poles';currentCustom=params.get('mode')==='custom'&&id!=='poles';
    return `${heading(l.name,currentPractice?'先读图、独立作答，再看证明与动画；有效练习自动进入学习评估。':currentCustom?'将自定义信号用于实时计算；计算窗口、数值精度与限制会在结果旁说明。':l.text,`<a class="btn btn-sm" href="#labs">全部实验室 ↗</a>`)}<nav class="lab-tabs" aria-label="切换实验室">${labInfo.map(l=>`<a class="${l.id===id?'active':''}" href="#labs/${l.id}${l.id!=='poles'?(currentPractice?'?mode=practice':currentCustom?'?mode=custom':''):''}">${l.symbol} ${l.name}</a>`).join('')}</nav>${id!=='poles'?`<div class="btn-row" style="justify-content:space-between;margin-bottom:22px"><div class="mode-switch"><button data-lab-mode="preset" class="${!currentCustom&&!currentPractice?'active':''}">预设教学实验</button><button data-lab-mode="custom" class="${currentCustom?'active':''}">自定义信号分析</button><button data-lab-mode="practice" class="${currentPractice?'active':''}">练习模式</button></div><a class="small" href="#signal-guide">输入语法与支持范围 ↗</a></div>`:''}<div id="labHost"></div>`;
  }
  function renderSignalGuide(){return `${heading('自定义信号使用指南','表达式经过白名单解析，信号模型和计算边界对所有实验保持一致。')}<div class="about-content"><section class="card"><h2>基本语法</h2><p>连续信号使用变量 <code>t</code>，离散信号使用 <code>n</code>。乘法显式写 <code>*</code>，幂写 <code>^</code>，括号可嵌套。支持实数、科学计数法、常数 <code>pi</code> 与 <code>e</code>。</p><div class="formula-box"><code>sin(2*pi*t)<br>exp(-t)*u(t)<br>u(t)-u(t-2)<br>cos(2*t)+sin(3*t)<br>t*(u(t)-u(t-1))<br>delta[n]-delta[n-2]</code></div><p>常用函数：<code>sin cos tan exp log sqrt abs floor ceil</code>。阶跃 <code>u(t)</code> 或 <code>u(n)</code>；离散冲激可写 <code>delta[n]</code> 或 <code>delta(n)</code>。函数名必须使用小写；不支持属性访问、赋值或 JavaScript。</p></section><section class="card"><h2>分段表达式</h2><p>输入组件提供逐行条件与表达式编辑。条件可写 <code>t&gt;=0 &amp;&amp; t&lt;1</code>，按从上到下第一条成立的规则选值，其他区间默认为 0。也可输入 <code>where(t&gt;=0 &amp;&amp; t&lt;1,t,0)</code>；完整语法以输入区内提示为准。</p><p class="spaced">离散信号只在整数索引处定义。时间尺度与平移使用整数参数；分数索引不会自动插值。</p></section><section class="card"><h2>冲激与数值计算</h2><p>连续时间 <code>delta(t-a)</code> 由普通函数部分和独立的冲激列表表示。绘图箭头标注权重，不用有限高脉冲替代。对非零 a，δ(at+b)=δ(t+b/a)/|a|。</p><p class="spaced">δ 的平方、含 δ 的分母和非线性函数、冲激与其支点处不连续系数的乘积等不支持的操作会被拒绝。自定义系统与采样目前只接收普通函数输入；冲激可用于变换、卷积和有限窗口频谱。</p><p class="spaced">自定义卷积使用明示积分区间或求和范围。自定义频谱是时间截窗后的数值 CTFT / 有限序列 DTFT；改变窗口和步长检验收敛。网格差只是估计，不能充当严格误差上界，也不能由有限样本证明带限。</p></section><section class="card"><h2>保存与跨实验复用</h2><p>在输入组件中命名并保存信号，再通过信号库加载到其他实验。收藏与信号定义保存在当前浏览器，和原有课程学习记录分开；请使用信号库内的 JSON 导出备份。页面无法保存时会显示提示。</p><div class="btn-row spaced"><a class="btn btn-primary" href="#labs/transform?mode=custom">开始自定义实验 →</a><a class="btn" href="#labs/convolution?mode=custom">自定义卷积</a></div></section></div>`;}
  let filters={chapter:'all',topic:'all',difficulty:'all',type:'all',category:'all',source:'all'};
  let pool=[],qIndex=0,answers={},drafts={},selected=null,session=null;

  function filteredQuestions(){return questionBank.filter(q=>(filters.chapter==='all'||q.chapter===filters.chapter)&&(filters.topic==='all'||q.topicId===filters.topic)&&(filters.difficulty==='all'||q.difficulty===+filters.difficulty)&&(filters.type==='all'||q.type===filters.type)&&(filters.category==='all'||q.category===filters.category)&&(filters.source==='all'||(filters.source==='wrong'?store.wrong:store.favorites).includes(q.id)));}
  function shuffle(a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

  function prepareSession(type,topicId){
    if(type==='reassess'){pool=shuffle(questionBank.filter(q=>q.topicId===topicId&&A.isObjective(q))).slice(0,5);if(pool.length<5){notify('该知识点的客观题不足5道，暂不能重新测评。');return false;}session={type,topicId,start:Date.now(),limit:0,ended:false};}
    else if(type==='exam'){pool=shuffle(chapters.flatMap(c=>shuffle(questionBank.filter(q=>q.chapter===c.id)).slice(0,3)));session={type,start:Date.now(),limit:45*60000,ended:false};}
    else{pool=shuffle(filteredQuestions()).slice(0,10);session={type:'random',start:Date.now(),limit:0,ended:false};}
    if(!pool.length){notify('当前筛选下没有题目，请调整条件。');session=null;return false;}
    answers={};drafts={};qIndex=0;selected=null;return true;
  }
  function startSession(type){if(prepareSession(type,filters.topic))renderExerciseArea();}

  function labWrongHTML(){const list=Object.values(store.assessment.wrongLabs);return list.length?`<section class="card spaced"><h2>实验室错题 · ${list.length} 道题型</h2><p class="assessment-note">保留当时随机参数，正确重做同一题后移出；测评分仍遵守每题型族一次的规则。</p><div class="lab-wrong-list">${list.map(r=>`<a class="btn" href="#labs/${esc(r.labId)}?mode=practice&family=${encodeURIComponent(r.familyId)}&seed=${r.seed}">${esc(r.prompt)} →</a>`).join('')}</div></section>`:'';}
  function renderExercises(params,sub){
    if(sub==='wrong'||sub==='favorites'||params.has('chapter')||params.has('topic')){session=null;answers={};drafts={};qIndex=0;}
    if(!session){if(params.has('chapter')){filters.chapter=params.get('chapter');filters.topic='all';}if(params.has('topic')){filters.topic=params.get('topic');filters.type='all';filters.category='all';filters.difficulty='all';}filters.source=sub==='wrong'?'wrong':sub==='favorites'?'favorites':'all';pool=filteredQuestions();qIndex=Math.min(qIndex,Math.max(0,pool.length-1));}
    if(params.get('reassess')==='1'&&params.has('topic'))prepareSession('reassess',params.get('topic'));
    const objective=questionBank.filter(A.isObjective).length;
    return `${heading('习题中心',`${questionBank.length} 道原创练习 · ${objective} 道客观题与 ${questionBank.length-objective} 道分步自我核对题。`,`<a class="btn btn-sm" href="#exercises/wrong">错题本 <span class="badge red">${store.wrong.length+Object.keys(store.assessment.wrongLabs).length}</span></a>`)}<div class="objective-note">掌握依据真实客观作答。每轮同一题只计一次；知识点至少5题，章节至少10题且覆盖3个知识点。复杂推导的自评不参与正确率。</div>${sub==='wrong'?labWrongHTML():''}<div id="exerciseArea"></div>`;
  }

  function filterHTML(){const opts=(list,value)=>list.map(([v,t])=>`<option value="${esc(v)}" ${String(value)===String(v)?'selected':''}>${esc(t)}</option>`).join(''),topicOptions=topics.filter(t=>filters.chapter==='all'||t.chapter===filters.chapter);return `<div class="filters"><label>课程章节<select data-filter="chapter">${opts([['all','全部章节'],...chapters.map(c=>[c.id,c.title])],filters.chapter)}</select></label><label>知识点<select data-filter="topic">${opts([['all','全部知识点'],...topicOptions.map(t=>[t.id,t.title])],filters.topic)}</select></label><label>难度<select data-filter="difficulty">${opts([['all','全部难度'],[1,'基础'],[2,'进阶'],[3,'挑战']],filters.difficulty)}</select></label><label>题型<select data-filter="type">${opts([['all','全部题型'],...Object.entries(UI.labels)],filters.type)}</select></label><label>训练内容<select data-filter="category">${opts([['all','全部内容'],...([...new Set(questionBank.map(q=>q.category))].map(c=>[c,c]))],filters.category)}</select></label><label>题目来源<select data-filter="source">${opts([['all','全部题目'],['wrong','我的错题'],['favorites','我的收藏']],filters.source)}</select></label></div>`;}
  function renderExerciseArea(){
    clearInterval(examTimer);const host=$('#exerciseArea');if(!host)return;UI.destroyPlots();
    if(session?.ended){host.innerHTML=renderSessionResult();bindSessionResults();MathTypeset(host);return;}
    const q=pool[qIndex],record=q?(answers[q.id]||drafts[q.id]):null;selected=record?.selected??null;
    host.innerHTML=`${!session?filterHTML():`<div class="session-banner"><div><strong>${session.type==='reassess'?'知识点重新测评':session.type==='exam'?'期末模拟练习':'随机测试'}</strong><div class="small muted">${pool.length} 题 · ${session.type==='reassess'?'测评交卷后更新掌握；单题历史和错题会保存，未交卷的测评答案仅保留当前页面':'客观题逐题更新掌握，自评不计客观分；未交卷的测试状态仅保留当前页面'}</div></div><span class="timer" id="examClock"></span><button class="btn btn-sm" data-finish>交卷</button></div>`}<div class="exercise-layout"><div>${q?`<section class="card exercise-topic-progress">${UI.assessment(A.topicStats(store.assessment,q.topicId))}</section>`:''}${q?renderQuestion(q,record):empty('这里还没有题目',filters.source==='wrong'?'做错的题会自动进入错题本，重做正确后移出。':'试试调整章节、难度或题型筛选。','#exercises','查看全部习题')}</div><aside class="question-aside">${!session?`<section class="card"><h3>来一次完整练习</h3><p>随机测试使用当前筛选；期末模拟按七章各抽 3 题，共 21 题，45 分钟。</p><button class="btn btn-primary spaced" style="width:100%" data-start="random">随机测试 · 最多 10 题</button><button class="btn spaced" style="width:100%;margin-top:9px" data-start="exam">期末模拟练习 →</button></section>`:''}<section class="card navigator-card"><div class="btn-row" style="justify-content:space-between"><h3>题目导航</h3><span class="small muted">${pool.length} 题</span></div><div class="question-numbers">${pool.map((x,i)=>`<button data-question-index="${i}" class="${qIndex===i?'active':''} ${answers[x.id]?.graded?(answers[x.id].correct?'done':'wrong'):''}" aria-label="第 ${i+1} 题">${i+1}</button>`).join('')}</div></section><section class="card"><h3>解题小习惯</h3><p>先写出定义和适用条件，再计算。遇到拉普拉斯与 Z 变换，别忘记给出收敛域。</p><a class="text-link" style="display:block;margin-top:12px;font-size:11px" href="#formulas">打开公式速查 →</a></section></aside></div>`;
    $$('[data-filter]',host).forEach(s=>s.onchange=()=>{filters[s.dataset.filter]=s.value;if(s.dataset.filter==='chapter')filters.topic='all';session=null;pool=filteredQuestions();qIndex=0;answers={};drafts={};selected=null;renderExerciseArea();});
    $$('[data-start]',host).forEach(b=>b.onclick=()=>startSession(b.dataset.start));
    $('.empty a',host)?.addEventListener('click',e=>{e.preventDefault();filters={chapter:'all',topic:'all',difficulty:'all',type:'all',category:'all',source:'all'};session=null;answers={};drafts={};qIndex=0;pool=filteredQuestions();renderExerciseArea();});
    $$('[data-question-index]',host).forEach(b=>b.onclick=()=>{qIndex=+b.dataset.questionIndex;renderExerciseArea();});
    $('[data-finish]',host)?.addEventListener('click',finishSession);
    $('[data-prev]',host)?.addEventListener('click',()=>{qIndex=Math.max(0,qIndex-1);renderExerciseArea();});
    $('[data-next]',host)?.addEventListener('click',()=>{qIndex=Math.min(pool.length-1,qIndex+1);renderExerciseArea();});
    if(q)bindQuestion(q,record);
    if(session?.limit){const tick=()=>{const remaining=Math.max(0,session.limit-(Date.now()-session.start));const el=$('#examClock');if(el)el.textContent=`${Math.floor(remaining/60000).toString().padStart(2,'0')}:${Math.floor(remaining/1000%60).toString().padStart(2,'0')}`;if(!remaining)finishSession();};tick();examTimer=setInterval(tick,1000);}
    MathTypeset(host);UI.mountPlots(host);
  }

  function renderQuestion(q,r){return UI.question(q,r,{index:qIndex,total:pool.length,favorite:store.favorites.includes(q.id),chapterTitle:chapterOf(q.chapter)?.title,reassessment:session?.type==='reassess'});}

  function renderSolution(q,self){return UI.solution(q,self);}

  function bindQuestion(q,r){
    $('[data-favorite]').onclick=()=>{toggleId(store.favorites,q.id);persist();renderExerciseArea();};
    $$('[data-answer]').forEach(b=>b.onclick=()=>{const value=+b.dataset.answer;if(q.type==='multiple'){const set=new Set(Array.isArray(selected)?selected:[]);set.has(value)?set.delete(value):set.add(value);selected=[...set].sort((a,b)=>a-b);}else selected=value;drafts[q.id]={selected};$$('[data-answer]').forEach(x=>{const chosen=q.type==='multiple'?selected.includes(+x.dataset.answer):selected===+x.dataset.answer;x.classList.toggle('selected',chosen);if(q.type==='multiple')x.setAttribute('aria-pressed',String(chosen));});});
    $('[data-submit]')?.addEventListener('click',()=>{const value=['numeric','fill'].includes(q.type)?$('#answerInput').value:selected,result=A.grade(q,value);if(!result.valid){notify(result.message||'请填写有效答案。');return;}gradeQuestion(q,result.correct,value);});
    $('[data-reveal]')?.addEventListener('click',()=>{answers[q.id]={revealed:true,graded:false};renderExerciseArea();});
    $$('[data-self]').forEach(b=>b.onclick=()=>gradeQuestion(q,b.dataset.self==='yes','self'));
    $('[data-retry]')?.addEventListener('click',()=>{delete answers[q.id];delete drafts[q.id];selected=null;renderExerciseArea();});
    $('#answerInput')?.addEventListener('input',e=>{drafts[q.id]={selected:e.target.value};});
    $('#answerInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('[data-submit]')?.click();});
  }

  function gradeQuestion(q,correct,value){
    const manual=!A.isObjective(q),pending=session?.type==='reassess';let counted=false;
    if(manual)A.manual(store.assessment,q,correct);else if(!pending)counted=A.record(store.assessment,q,A.grade(q,value)).counted;
    answers[q.id]={graded:true,correct,selected:value,revealed:true,counted,pending};
    const a=store.attempts[q.id]||{total:0,correct:0};a.total++;a.correct+=correct?1:0;a.lastCorrect=correct;a.at=Date.now();store.attempts[q.id]=a;
    if(correct)store.wrong=store.wrong.filter(id=>id!==q.id);else{if(!store.wrong.includes(q.id))store.wrong.push(q.id);store.assessment.reviewFlags[q.topicId]=true;}
    activity();persist();renderExerciseArea();document.dispatchEvent(new CustomEvent('signallab:assessmentchange'));
  }

  function finishSession(){if(!session||session.ended)return;
    if(session.type==='reassess'&&!session.reassessed){
      if(pool.some(q=>!answers[q.id]?.graded)){notify('请完成本轮全部5道不同题，再提交测评。');return;}
      try{A.reassess(store.assessment,pool.map(q=>({id:q.id,value:answers[q.id].selected})),questionBank);for(const q of pool){answers[q.id].pending=false;answers[q.id].counted=true;}session.reassessed=true;persist();}catch(error){notify(error.message);return;}
    }
    clearInterval(examTimer);session.ended=true;session.elapsed=Date.now()-session.start;renderExerciseArea();
  }

  function renderSessionResult(){const objective=pool.filter(A.isObjective),correct=objective.filter(q=>answers[q.id]?.graded&&answers[q.id].correct),manual=pool.filter(q=>!A.isObjective(q)&&answers[q.id]?.graded);return `<div class="card"><div class="eyebrow">PRACTICE COMPLETE</div><h2>${session.type==='reassess'?'重新测评已完成':'完成一次练习，看见下一步。'}</h2><p class="assessment-note">本次客观得分以 ${objective.length} 道客观题为分母（未作答计本次未得分），${manual.length} 道已自我核对题单独记录。长期掌握率只计算有效作答、每题本轮首次结果。</p><div class="results-grid"><div class="card"><strong>${objective.length?Math.round(correct.length/objective.length*100)+'%':'—'}</strong><span>本次客观得分</span></div><div class="card"><strong>${correct.length} / ${objective.length}</strong><span>客观答对题目</span></div><div class="card"><strong>${manual.length}</strong><span>已自我核对 · 不计客观分</span></div></div>${session.topicId?UI.assessment(A.topicStats(store.assessment,session.topicId)):''}<div>${pool.map((q,i)=>`<div class="review-item"><span class="badge ${answers[q.id]?.correct?'green':'orange'}">${!A.isObjective(q)?(answers[q.id]?.graded?'已自我核对':'待核对'):answers[q.id]?.graded?(answers[q.id].correct?'正确':'待巩固'):'未作答'}</span><span style="flex:1">${i+1}. ${esc(q.topic)}</span><button class="text-link" data-result-question="${i}">查看题目</button></div>`).join('')}</div><div class="btn-row spaced"><button class="btn btn-primary" data-end-session>返回日常练习 →</button><a class="btn" href="#review">查看学习评估</a></div></div>`;}
  function bindSessionResults(){ $$('[data-result-question]').forEach(b=>b.onclick=()=>{session.ended=false;session.limit=0;qIndex=+b.dataset.resultQuestion;renderExerciseArea();});$('[data-end-session]').onclick=()=>{session=null;answers={};qIndex=0;pool=filteredQuestions();renderExerciseArea();};}
  function renderFormulas(params){const ch=params.get('chapter')||'all';return `${heading('公式速查','先确认定义与适用条件，再代入公式。',`<button class="btn btn-sm" data-print>打印速查表 ↗</button>`)}<div class="filters"><label style="max-width:300px">章节<select id="formulaChapter"><option value="all">全部章节</option>${chapters.map(c=>`<option value="${c.id}" ${ch===c.id?'selected':''}>${esc(c.title)}</option>`).join('')}</select></label></div><div class="lab-note" style="margin:0 0 20px">约定：CTFT 正变换不带系数，逆变换带 1/(2π)；DTFS 正变换带 1/N，逆变换不带系数；DTFT 为 2π 周期。所有拉普拉斯与 Z 变换都需连同收敛域理解。</div><div class="formula-grid">${topics.filter(t=>ch==='all'||t.chapter===ch).map(t=>`<section class="card formula-card"><div class="btn-row" style="justify-content:space-between"><h3>${esc(t.title)}</h3><span class="badge">${esc(t.chapterTitle)}</span></div><div class="formula-box">${t.formulas.map(formula).join('')}</div><p class="small muted">${esc(t.pitfalls[0]||'请注意公式的适用条件。')}</p><a style="display:block;margin-top:12px" href="${topicURL(t)}">查看推导与例题 →</a></section>`).join('')}</div>`;}

  function renderReview(){const due=dueTopics(),n=masteredCount(),stats=A.stats(store.assessment,()=>true,5),manual=Object.keys(store.assessment.manual).length;return `${heading('学习评估与复习','用真实练习检验理解，用完整测评更新掌握。',`<button class="btn btn-primary" data-exam-mode>考试复习模式 →</button>`)}<div class="results-grid"><div class="card"><strong>${n} / ${topics.length}</strong><span>已掌握知识点</span></div><div class="card"><strong>${stats.total?stats.percent+'%':'—'}</strong><span>当前客观正确率 · ${stats.correct}/${stats.total} 道不同题</span></div><div class="card"><strong>${manual}</strong><span>自我核对题 · 不计客观分</span></div></div><div class="objective-note">知识点需至少5道不同客观题，章节至少10道且覆盖3个知识点；低于60%需要加强、60%～不足80%学习中、达到80%已掌握。同一题重复作答不会增加权重。知识点重新测评需完成5道不同题并交卷，随后采用新一轮结果；历史练习次数仍保留。</div>${Object.keys(store.legacyMastered).length?'<p class="legacy-note">旧版手动掌握标记与历史作答已保留。旧客观题按最近一次结果每题计一条证据；旧自评不参与客观评估，旧手动掌握标记已转为需要复习。</p>':''}<div class="review-grid"><section class="card"><h2>需要复习 · ${due.length}</h2><p class="assessment-note">包括主动标记、需要加强，以及测评达到掌握7天后的复习提醒。</p>${due.length?due.map(t=>`<div class="review-item"><span class="badge orange">${A.topicStats(store.assessment,t.id).label}</span><a href="${topicURL(t)}">${esc(t.title)}</a></div>`).join(''):'<p class="muted spaced">暂时没有复习提醒，完成新练习或在知识点页标记需要复习。</p>'}</section><section class="card"><h2>错题巩固</h2><p class="assessment-note">普通重做可移出错题本，但不覆盖本轮首次测评分。要更新掌握，请在知识点页发起重新测评。</p><p>${store.wrong.length} 道题库错题 · ${Object.keys(store.assessment.wrongLabs).length} 个实验室错题型</p><a class="btn btn-soft spaced" href="#exercises/wrong">打开错题本 →</a></section><section class="card"><h2>章节掌握度</h2>${chapters.map(c=>`<div class="chapter-assessment"><a href="#chapter/${c.id}">${esc(c.title)}</a>${UI.assessment(A.chapterStats(store.assessment,c.id,c.topics.length),true)}</div>`).join('')}</section><section class="card"><h2>知识点评估</h2>${topics.map(t=>{const a=A.topicStats(store.assessment,t.id);return `<div class="review-item"><a href="${topicURL(t)}">${esc(t.title)}</a><span class="assessment-label ${a.status}">${a.correct}/${a.total} · ${a.label}</span></div>`;}).join('')}</section></div>`;}
  function renderBookmarks(){const saved=topics.filter(t=>store.bookmarks.includes(t.id)),qs=questionBank.filter(q=>store.favorites.includes(q.id));return `${heading('我的收藏','把反复思考的概念和题目，放在随时能回来的地方。')}<div class="review-grid"><section class="card"><h2>重点知识点 <span class="badge">${saved.length}</span></h2>${saved.length?saved.map(t=>`<div class="review-item"><a href="${topicURL(t)}">${esc(t.title)}</a><button class="text-link" data-remove-topic="${t.id}">移除</button></div>`).join(''):'<p class="muted spaced small">在知识点详情中点击“收藏知识点”，即可加入这里。</p>'}</section><section class="card"><h2>收藏题目 <span class="badge">${qs.length}</span></h2>${qs.length?qs.map(q=>`<div class="review-item"><a href="#question/${q.id}">${esc(q.topic)} · ${esc(q.prompt).replace(/\$[^$]+\$/g,'…').slice(0,45)}</a><button class="text-link" data-remove-question="${q.id}">移除</button></div>`).join(''):'<p class="muted spaced small">在习题卡片右上角点击“收藏”，方便下次重做。</p>'}${qs.length?'<a class="btn btn-soft spaced" href="#exercises/favorites">练习收藏题目 →</a>':''}</section></div>`;}
  function renderMap(){
    const node=(c,i)=>`<section class="card map-node"><div class="btn-row" style="justify-content:space-between"><h2><span style="color:var(--blue);margin-right:9px">${symbols[i]}</span>${i+1}. ${esc(c.title)}</h2><a class="small" href="#chapter/${c.id}">章节概览 →</a></div><p>${esc(c.subtitle||chapterEnglish[i])}</p><div class="map-topics">${c.topics.map(t=>`<a href="#lesson/${c.id}/${t.id}">${store.mastered[t.id]?'✓ ':''}${esc(t.title)}</a>`).join('')}</div></section>`;
    return `${heading('知识结构','七个章节，一条从时域走向变换域的理解路径。')}<div class="lab-note" style="margin:0 0 22px">先修关系：基础 → 系统性质 → LTI → 傅里叶 → 采样。拉普拉斯与 Z 变换分别延伸连续时间与离散时间的频域分析，两者可以并行学习。</div><div class="map-chain">${chapters.slice(0,5).map((c,i)=>`${i?'<div class="map-arrow" aria-hidden="true">↓</div>':''}${node(c,i)}`).join('')}<div class="map-arrow" aria-hidden="true">↙ &nbsp;&nbsp;&nbsp; ↘</div><div class="small muted">连续时间扩展 / 离散时间扩展（两条并行路径）</div><div class="map-tail">${chapters.slice(5).map((c,i)=>node(c,i+5)).join('')}</div></div>`;
  }
  function renderAbout(){return `${heading('关于 SignalLab','一个可离线使用、数据保存在你手中的学习工具。')}<div class="about-content"><section class="card"><h2>内容与符号约定</h2><p>本平台以奥本海姆《信号与系统》第二版（中文版）的知识体系为参考，组织原创中文讲解与原创练习。适合本科课程理解与复习；并非教材全文或官方配套产品。</p><ul class="pitfalls spaced">${(COURSE.conventions||[]).map(x=>`<li>${esc(x)}</li>`).join('')}<li>连续时间冲激是广义函数，图上的箭头表示强度；有限高度的脉冲不能当成真正冲激。</li><li>实验室给出参数模型及数值误差范围。有限样本一致不能证明系统对所有输入时不变。</li></ul></section><section class="card"><h2>外观与动态效果</h2><label class="theme-preference-label">主题偏好<select id="themePreference"><option value="system">跟随系统</option><option value="light">浅色</option><option value="dark">深色</option></select></label><p class="assessment-note">自动尊重系统的“减少动态效果”设置。主题切换同步更新公式、SVG 与画布。</p></section><section class="card" id="dataBackup"><h2>数据备份与恢复</h2><p>进度、收藏与错题通过 localStorage 保存在当前浏览器。隐私模式、清理网站数据或移动文件位置可能影响记录。建议定期导出；备份可用于不同设备之间手动迁移。</p><div class="btn-row spaced"><button class="btn btn-primary" id="exportData">导出学习记录 JSON ↓</button><label class="btn upload-label">合并导入学习记录<input id="importData" type="file" accept=".json,application/json"></label></div><p class="inline-info">导入会合并收藏、错题与学习记录；每题保留较新的测评证据；旧自评不计客观正确率。不会上传任何数据。</p><p class="inline-info" id="storageState">当前保存状态：${storageOK?'浏览器本地存储可用':'存储不可用，仅在本次会话保留'}。</p></section><section class="card"><h2>如何离线打开与使用</h2><ol class="pitfalls"><li>保留整个项目目录结构，双击 index.html，在 Edge、Chrome、Firefox 或 Safari 中打开。</li><li>无需安装依赖或启动服务；课程、习题、字体与公式渲染库均在目录内。</li><li>iPad 支持触摸布局；iPadOS 的“文件”快速预览不等于浏览器，若不能执行脚本，请通过支持本地 HTML 的浏览器/阅读工具打开，或使用电脑的局域网静态服务访问。</li><li>通过网页访问 iPad 时，首次打开仍需要能连接静态文件服务；纯本地使用应使用完整离线文件夹。</li></ol></section><section class="card"><h2>参考资料与开源依赖</h2><p>课程结构与关键变换约定对照 MIT OpenCourseWare 的相关公开讲义，站内讲解与题目为原创。</p><ul class="pitfalls spaced">${(COURSE.sources?.length?COURSE.sources:[{title:'MIT OCW · Signals and Systems · Lecture Notes',url:'https://ocw.mit.edu/courses/res-6-007-signals-and-systems-spring-2011/pages/lecture-notes/'}]).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)} ↗</a></li>`).join('')}<li><a href="https://katex.org/docs/browser" target="_blank" rel="noopener noreferrer">KaTeX 0.16.22</a> · MIT License，字体及许可随项目附带。</li></ul></section></div>`;}
  function exportData(){const blob=new Blob([JSON.stringify({...store,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`SignalLab-学习记录-${dateKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);notify('已导出学习记录。');}
  async function importData(file){
    if(!file)return;if(file.size>2e6){notify('文件过大，请选择学习记录 JSON。');return;}
    try{
      const raw=JSON.parse(await file.text());if(![1,2].includes(raw.version)||!Array.isArray(raw.visited))throw new Error('invalid');
      const s=sanitize(raw);
      for(const key of ['visited','bookmarks','favorites','wrong'])store[key]=[...new Set([...store[key],...s[key]])];
      Object.assign(store.legacyMastered,s.legacyMastered);A.merge(store.assessment,s.assessment);
      for(const [key,value]of Object.entries(s.attempts))if(!store.attempts[key]||value.at>store.attempts[key].at)store.attempts[key]=value;
      const wrong=new Set(store.wrong);
      for(const [id,a]of Object.entries(store.attempts)){if(a.lastCorrect)wrong.delete(id);else wrong.add(id);}
      store.wrong=[...wrong];
      for(const [key,value]of Object.entries(s.activity))store.activity[key]=Math.max(store.activity[key]||0,value);
      Object.assign(store.quick,s.quick);persist();render();notify('学习记录已合并。');
    }catch{notify('导入失败：请使用本平台导出的有效 JSON 文件。');}
  }
  function renderSearch(){const query=$('#searchInput').value.trim().toLowerCase();if(!query){$('#searchResults').innerHTML='<p class="muted small" style="padding:12px">输入关键词，查找知识点、核心公式与习题。</p>';return;}const ts=topics.filter(t=>[t.title,t.intuition,t.definition,...t.formulas,...t.pitfalls].join(' ').toLowerCase().includes(query));const qs=questionBank.filter(q=>[q.prompt,q.topic,q.idea].join(' ').toLowerCase().includes(query));$('#searchResults').innerHTML=ts.slice(0,12).map(t=>`<a class="search-result" href="${topicURL(t)}"><strong>${esc(t.title)}</strong><small>知识点 · ${esc(t.chapterTitle)}</small></a>`).join('')+qs.slice(0,8).map(q=>`<a class="search-result" href="#question/${q.id}"><strong>${esc(q.topic)} · ${esc(q.prompt).slice(0,100)}</strong><small>习题 · ${esc(chapterOf(q.chapter)?.title)}</small></a>`).join('')||'<p class="muted small" style="padding:12px">没有找到相关内容，请试试更短的关键词。</p>';MathTypeset($('#searchResults'));$$('a',$('#searchResults')).forEach(a=>a.onclick=()=>$('#searchDialog').close());}
  function bindPage(route,params){
    if(route[0]==='lesson')bindLesson(route[2]);
    if(route[0]==='labs'&&currentLab){
      if(currentPractice)window.LabPractice?.mount(currentLab,$('#labHost'),{familyId:params.get('family')||undefined,seed:params.has('seed')?Number(params.get('seed')):undefined,onGrade:(q,correct,value)=>{
        const result=A.grade(q,value);A.recordLabResult(store.assessment,{...q,labId:currentLab},result);
        activity();persist();document.dispatchEvent(new CustomEvent('signallab:assessmentchange'));
      },getStats:q=>q?.topicId?A.topicStats(store.assessment,q.topicId):A.stats(store.assessment)});
      else(currentCustom?window.CustomLabs:window.Labs)?.render(currentLab,$('#labHost'));MathTypeset($('#labHost'));
    }
    $$('[data-lab-mode]').forEach(b=>b.onclick=()=>{location.hash=`labs/${currentLab}${b.dataset.labMode==='practice'?'?mode=practice':b.dataset.labMode==='custom'?'?mode=custom':''}`;});
    if(route[0]==='exercises'||route[0]==='question')renderExerciseArea();
    $('#formulaChapter')?.addEventListener('change',e=>{location.hash=`formulas?chapter=${e.target.value}`;});
    $('[data-print]')?.addEventListener('click',()=>window.print());
    $('[data-exam-mode]')?.addEventListener('click',()=>{store.mode='exam';persist();location.hash=topicURL(dueTopics()[0]||lastTopic());notify('已切换为考试速记模式。');});
    $$('[data-remove-topic]').forEach(b=>b.onclick=()=>{toggleId(store.bookmarks,b.dataset.removeTopic);persist();render();});
    $$('[data-remove-question]').forEach(b=>b.onclick=()=>{toggleId(store.favorites,b.dataset.removeQuestion);persist();render();});
    $('#themePreference')?.addEventListener('change',e=>window.SignalTheme.setPreference(e.target.value));window.SignalTheme?.refresh();UI.mountPlots($('#main'));
    $('#exportData')?.addEventListener('click',exportData);
    $('#importData')?.addEventListener('change',e=>importData(e.target.files[0]));
  }
  function closeMenu(){$('#sidebar').classList.remove('open');$('#scrim').classList.remove('open');$('#menuToggle').setAttribute('aria-expanded','false');}
  function render(){
    clearInterval(examTimer);UI.destroyPlots();window.LabPractice?.destroy();window.Labs?.destroy();window.CustomLabs?.destroy();currentLab=null;currentCustom=false;currentPractice=false;
    const hash=location.hash.slice(1)||'home';const [path,query='']=hash.split('?');const route=path.split('/'),params=new URLSearchParams(query);
    syncMastery();renderSidebar(route);closeMenu();window.SignalTheme?.refresh();
    let html;switch(route[0]){
      case 'home':html=renderHome();break;
      case 'chapter':html=renderChapter(route[1]);break;
      case 'lesson':html=renderLesson(route[1],route[2]);break;
      case 'labs':html=renderLabs(route[1],params);break;
      case 'signal-guide':html=renderSignalGuide();break;
      case 'exercises':html=renderExercises(params,route[1]);break;
      case 'question':session=null;answers={};qIndex=0;pool=questionBank.filter(q=>q.id===route[1]);html=heading('习题练习','独立作答后，查看详细解析。')+'<div id="exerciseArea"></div>';break;
      case 'formulas':html=renderFormulas(params);break;
      case 'review':html=renderReview();break;
      case 'bookmarks':html=renderBookmarks();break;
      case 'map':html=renderMap();break;
      case 'about':html=renderAbout();break;
      default:html=empty('这里暂时没有内容','请通过导航打开课程或实验室。');
    }
    $('#main').innerHTML=html;$('#main').classList.remove('fade-in');void $('#main').offsetWidth;$('#main').classList.add('fade-in');
    const title=({home:'学习概览',chapter:chapterOf(route[1])?.title,lesson:findTopic(route[2])?.title,labs:labInfo.find(l=>l.id===route[1])?.name||'交互实验室',exercises:'习题中心',question:'习题练习',formulas:'公式速查',review:'复习计划',bookmarks:'我的收藏',map:'知识结构',about:'项目说明','signal-guide':'自定义信号指南'})[route[0]]||'学习空间';
    $('#breadcrumb').innerHTML=`学习空间 <span>/</span> ${esc(title)}`;document.title=`${title} · SignalLab 信号与系统`;
    bindPage(route,params);MathTypeset($('#main'));$('#storageWarning').hidden=storageOK;
  }
  $('#searchOpen').onclick=()=>{$('#searchDialog').showModal();renderSearch();$('#searchInput').focus();};
  $('[data-close-search]').onclick=()=>$('#searchDialog').close();
  $('#searchInput').oninput=renderSearch;
  $('#searchDialog').addEventListener('click',e=>{if(e.target===$('#searchDialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  // Theme preference has its own durable key. Keep export metadata current without serializing all assessment data during capture.
  document.addEventListener('signallab:themepreference',()=>{store.theme=window.SignalTheme?.getPreference()||store.theme;});
  $('#menuToggle').onclick=()=>{const open=!$('#sidebar').classList.contains('open');$('#sidebar').classList.toggle('open',open);$('#scrim').classList.toggle('open',open);$('#menuToggle').setAttribute('aria-expanded',String(open));};
  $('#scrim').onclick=closeMenu;
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){e.preventDefault();$('#searchOpen').click();}});
  window.addEventListener('hashchange',()=>{render();window.scrollTo(0,0);});
  window.ThemeSwitch?.mount();
  persist();render();
  // Expose read-only snapshots for reproducible offline QA, never used as application state.
  window.SignalLab={getState:()=>JSON.parse(JSON.stringify(store)),counts:()=>({topics:topics.length,questions:questionBank.length,chapters:chapters.length}),getAssessmentStats:id=>id?A.topicStats(store.assessment,id):A.stats(store.assessment),getQuestionCatalog:()=>questionBank.map(q=>({...q})),contentCounts:()=>({examples:45+Object.values(window.WORKED_EXAMPLES?.byTopic||{}).reduce((n,a)=>n+a.length,0)+Object.values(window.WORKED_EXAMPLES?.byChapter||{}).reduce((n,a)=>n+a.length,0),labFamilies:familyCatalog.length,objectiveQuestions:questionBank.filter(A.isObjective).length}),version:'2.2.2-beta.1'};
})();
