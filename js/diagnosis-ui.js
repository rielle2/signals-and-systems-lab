/* Post-answer teaching panel. The diagnostic engine owns mathematics and rules;
 * this component only displays confirmed results and exact finite plot pieces. */
(function(){
  'use strict';
  const instances=new Set();
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const format=value=>Number.isFinite(value)?String(Number(value.toPrecision(9))):'—';
  const safeID=value=>typeof value==='string'&&/^[\w.-]{1,100}$/.test(value)?value:null;
  function textEvidence(value){
    if(value===undefined||value===null)return '';
    return typeof value==='string'?value:JSON.stringify(value);
  }
  function lessonFor(topicId){
    for(const chapter of window.COURSE?.chapters||[])if(chapter.topics.some(t=>t.id===topicId))return '#lesson/'+chapter.id+'/'+topicId;
    return null;
  }
  function recommendationsHTML(diagnosis){
    const list=Array.isArray(diagnosis.recommendations)?diagnosis.recommendations.filter(r=>safeID(r.questionId)).slice(0,6):[];
    const examples=Array.isArray(diagnosis.relatedExamples)?diagnosis.relatedExamples.slice(0,4):[];
    if(!list.length&&!examples.length)return '';
    return `<section class="diag-recommendations"><h4>接下来练什么</h4><p class="muted">用不同题目检验同一个方法；普通重做不会重复提高本轮掌握率。</p>${list.length?`<ol>${list.map(r=>`<li><a href="#question/${encodeURIComponent(r.questionId)}">${escape(r.title||r.questionId)}</a>${r.difficulty?` <span class="badge">${['','基础','进阶','综合'][r.difficulty]||'练习'}</span>`:''}</li>`).join('')}</ol>`:''}${examples.map(e=>{const link=lessonFor(e.topicId);return link?`<a class="text-link" href="${link}">相关讲解与分步例题：${escape(e.title||e.topicId)} →</a>`:'';}).join('')}</section>`;
  }
  function modelTable(model,label){
    const body=model.domain==='ct'?model.segments.map(s=>`<tr><td>${s.leftClosed?'[':'('}${format(s.start)}, ${format(s.end)}${s.rightClosed?']':')'}</td><td>${format(s.y0)} → ${format(s.y1)}</td></tr>`).join(''):model.samples.map(s=>`<tr><td>${s.n}</td><td>${format(s.value)}</td></tr>`).join('');
    return `<details class="diag-model"><summary>${escape(label)}的数学数据 · ${model.domain==='ct'?'连续分段':'整数序列'}</summary><div class="diag-table-scroll"><table><thead><tr><th>${model.domain==='ct'?'时间区间':'整数 n'}</th><th>${model.domain==='ct'?'起点 → 终点幅值':'样本值'}</th></tr></thead><tbody>${body||'<tr><td colspan="2">零信号</td></tr>'}</tbody></table></div>${model.endpoints.length?`<p>特殊端点：${model.endpoints.map(p=>`x=${format(p.at)} 时取 ${format(p.value)}`).join('；')}。</p>`:''}<p class="muted">${model.domain==='ct'?'跳变不以斜线连接。是否检查孤立端点由题目约定决定。':'仅整数索引有值，未列样本为0，不连接为连续曲线。'}</p></details>`;
  }
  function finiteModel(raw){const checked=window.WaveformMath?.validate(raw);return checked?.valid?checked.model:null;}
  function graphRange(question,models){
    const r={xmin:-4,xmax:7,ymin:-4,ymax:4,...question.range};
    let lo=r.ymin,hi=r.ymax;
    for(const m of models){for(const s of m.segments){lo=Math.min(lo,s.y0,s.y1);hi=Math.max(hi,s.y0,s.y1);}for(const s of m.samples){lo=Math.min(lo,s.value);hi=Math.max(hi,s.value);}for(const p of m.endpoints){lo=Math.min(lo,p.value);hi=Math.max(hi,p.value);}}
    const padding=Math.max(.25,(hi-lo)*.08);r.ymin=Math.max(-1e6,lo-padding);r.ymax=Math.min(1e6,hi+padding);
    if(question.comparisonScope!=='window'){
      for(const m of models){for(const s of m.segments){r.xmin=Math.min(r.xmin,s.start);r.xmax=Math.max(r.xmax,s.end);}for(const s of m.samples){r.xmin=Math.min(r.xmin,s.n-1);r.xmax=Math.max(r.xmax,s.n+1);}}
    }
    r.xmin=Math.max(-1e6,r.xmin);r.xmax=Math.min(1e6,r.xmax);
    return r;
  }
  function endpointMarkers(model){
    if(model.domain!=='ct')return [];
    const evaluate=x=>window.WaveformMath.evaluate(model,x),map=new Map();
    for(const s of model.segments){for(const [x,y]of [[s.start,s.y0],[s.end,s.y1]]){const value=evaluate(x),closed=Math.abs(value-y)<=Number.EPSILON*32*Math.max(1,Math.abs(value),Math.abs(y));map.set(x+':'+y+':'+closed,{x,y,closed});map.set(x+':actual',{x,y:value,closed:true});}}
    for(const p of model.endpoints)map.set(p.at+':actual',{x:p.at,y:p.value,closed:true});
    return [...map.values()];
  }
  function palette(){return document.documentElement.dataset.theme==='dark'?{original:'#8ab4ff',student:'#ffbe70',standard:'#73d9b5',step:'#c6a6ff'}:{original:'#2563eb',student:'#b86a13',standard:'#128058',step:'#7c48c5'};}
  function toSeries(model,name,color,dash,question){
    const signal=window.WaveformMath.toSignal(model),windowed=question.comparisonScope==='window',range=question.range;
    const evaluate=x=>windowed&&(x<range.xmin||x>range.xmax)?NaN:signal.evaluate(x);
    if(model.domain==='dt')return {name,color,dash,fn:evaluate,points:model.samples.map(p=>({x:p.n,y:p.value})),discrete:true};
    const pieces=windowed?model.segments.flatMap(s=>{const start=Math.max(s.start,range.xmin),end=Math.min(s.end,range.xmax);if(!(end>start))return [];const slope=(s.y1-s.y0)/(s.end-s.start);return [{start,end,y0:s.y0+slope*(start-s.start),y1:s.y0+slope*(end-s.start)}];}):model.segments;
    return {name,color,dash,fn:evaluate,exactSegments:pieces,outside:windowed?undefined:0,endpointMarkers:endpointMarkers(model).filter(p=>!windowed||p.x>=range.xmin&&p.x<=range.xmax),discrete:false};
  }
  function issueRegions(result){return (Array.isArray(result.issues)?result.issues:[]).flatMap(i=>{
    if(Number.isFinite(i.start)&&Number.isFinite(i.end)&&i.end>=i.start)return [{start:i.start,end:i.end}];
    if(Number.isFinite(i.n))return [{start:i.n-.18,end:i.n+.18}];
    if(Number.isFinite(i.at))return [{start:i.at,end:i.at}];
    return [];
  }).slice(0,80);}
  function mount(host,options={}){
    if(!host?.appendChild)throw new Error('错因面板需要有效的容器。');
    for(const i of [...instances])if(i.host===host)i.destroy();
    const question=options.question||{},submission=options.submission,result=options.result||{},diagnosis=options.diagnosis||{};
    const node=document.createElement('section');node.className='diagnosis-panel';node.dataset.diagnosisStatus=diagnosis.status||'unknown';host.appendChild(node);
    let destroyed=false,comparePlot=null,stepPlot=null,timer=0,stepIndex=0,playing=false;
    const plots=[],motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const objective=!window.Assessment||window.Assessment.isObjective(question);
    const graded=objective&&result.valid!==false&&result.gradable!==false&&typeof result.correct==='boolean'&&diagnosis.status!=='ungraded';
    const selected=submission?.model||submission?.selected?.model;
    const actual=graded&&selected?finiteModel(selected):null,expected=graded&&question.expectedModel?finiteModel(question.expectedModel):null,original=graded&&question.inputModel?finiteModel(question.inputModel):null;
    const steps=graded&&Array.isArray(diagnosis.steps)?diagnosis.steps.map(s=>({...s,model:finiteModel(s.model)})).filter(s=>s.model).slice(0,12):[];
    let visible={original:true,student:true,standard:true};
    const $=s=>node.querySelector(s);
    function updatePlayButton(){const b=$('[data-diag-play]');if(!b)return;b.disabled=!!motion?.matches||steps.length<2;window.SignalIcons?.button(b,playing?'pause':'play',playing?'暂停步骤':'播放步骤',{animate:!motion?.matches});b.setAttribute('aria-pressed',String(playing));}
    function stop(){clearTimeout(timer);timer=0;playing=false;updatePlayButton();}
    function redrawComparison(){if(!comparePlot)return;const colors=palette(),series=[];if(original&&visible.original)series.push(toSeries(original,'① 原始输入 · 实线',colors.original,[],question));if(actual&&visible.student)series.push(toSeries(actual,'② 我的答案 · 长虚线',colors.student,[8,4],question));if(expected&&visible.standard)series.push(toSeries(expected,'③ 标准答案 · 点线',colors.standard,[2,4],question));comparePlot.setSeries(series);}
    function redrawStep(){if(!stepPlot||!steps[stepIndex])return;const colors=palette(),current=steps[stepIndex],series=[];if(original)series.push(toSeries(original,'原始输入 · 实线',colors.original,[],question));series.push(toSeries(current.model,'当前步骤 · 虚线',colors.step,[6,3],question));stepPlot.setSeries(series);}
    function theme(){redrawComparison();redrawStep();}
    // Register before SignalPlot's listeners. Series colors are then updated
    // before its synchronous theme paint and before View Transition capture.
    document.addEventListener('signallab:themechange',theme);
    function selectStep(index){if(!steps.length)return;stepIndex=Math.max(0,Math.min(steps.length-1,index));const step=steps[stepIndex];$('[data-diag-step-select]').value=String(stepIndex);$('[data-diag-step-label]').textContent=`第 ${stepIndex+1} / ${steps.length} 步：${step.label||'数学变换'}`;$('[data-diag-step-explanation]').textContent=step.explanation||'';$('[data-diag-step-formula]').textContent=step.formula||'';$('[data-diag-prev]').disabled=stepIndex===0;$('[data-diag-next]').disabled=stepIndex===steps.length-1;redrawStep();window.MathTypeset?.($('[data-diag-step-current]'));}
    function ensureStepPlot(){if(stepPlot||!steps.length||destroyed)return;stepPlot=window.SignalPlot.mount($('[data-diag-step-plot]'),{domain:steps[0].model.domain,title:'正确变换的逐步波形',range:graphRange(question,steps.map(s=>s.model).concat(original?[original]:[]))});plots.push(stepPlot);selectStep(stepIndex);}
    function play(){if(destroyed||motion?.matches||steps.length<2)return;ensureStepPlot();if(playing){stop();return;}if(stepIndex===steps.length-1)selectStep(0);playing=true;updatePlayButton();const advance=()=>{timer=0;if(destroyed||document.hidden||motion?.matches){stop();return;}if(stepIndex>=steps.length-1){stop();return;}selectStep(stepIndex+1);if(stepIndex===steps.length-1){stop();return;}timer=setTimeout(advance,1100);};timer=setTimeout(advance,1100);}
    function onClick(event){const button=event.target.closest('button');if(!button||!node.contains(button))return;if(button.hasAttribute('data-diag-play'))play();if(button.hasAttribute('data-diag-prev')){stop();selectStep(stepIndex-1);}if(button.hasAttribute('data-diag-next')){stop();selectStep(stepIndex+1);}if(button.hasAttribute('data-diag-restart')){stop();selectStep(0);}}
    function onChange(event){if(event.target.matches('[data-diag-step-select]')){stop();selectStep(Number(event.target.value));}if(event.target.matches('[data-diag-toggle-series]')){visible[event.target.dataset.diagToggleSeries]=event.target.checked;redrawComparison();}}
    function onToggle(event){if(event.target.matches('[data-diag-steps]')){if(event.target.open)ensureStepPlot();else stop();}}
    function visibility(){if(document.hidden)stop();}
    function motionChange(){if(motion?.matches)stop();updatePlayButton();const p=$('[data-diag-motion-note]');if(p)p.hidden=!motion?.matches;}
    if(!graded){
      node.innerHTML=`<h3>暂不进行错因诊断</h3><p>${escape(diagnosis.message||result.message||'先完成可靠的数学判分。未确认或不可靠的识别结果不计为知识错误。')}</p><p class="muted">不展示标准波形，不记录掌握证据；可先校正坐标与数字模型，再确认提交。</p>`;
    }else if(result.correct){
      node.innerHTML=`<h3>本次答案正确</h3><p>${escape(diagnosis.message||'未发现本题数学标准范围内的错误。用不同题目继续检验理解。')}</p>${recommendationsHTML(diagnosis)}`;
    }else{
      const errors=Array.isArray(diagnosis.errorTypes)?diagnosis.errorTypes.slice(0,6):[];
      node.innerHTML=`<header class="diag-heading"><span class="badge">错因与纠错</span><h3>${errors.length?'可能的错误原因':'暂不能可靠识别具体错因'}</h3></header><p>${escape(diagnosis.message||'数学答案存在差异；下面说明可验证的差别，不能据此断言你的真实思考过程。')}</p>${errors.length?`<p class="diag-caution">以下是与当前答案吻合的典型错误规则，不是对你思维过程的确定判断。</p><ol class="diag-reasons">${errors.map(e=>`<li data-diagnosis-error="${escape(e.id)}"><strong>${escape(e.title||e.id)}</strong><p>${escape(e.reason||'')}</p>${e.evidence?`<p class="diag-evidence">数学依据：${escape(textEvidence(e.evidence))}</p>`:''}</li>`).join('')}</ol>`:'<p class="diag-caution">先检查题目定义、时间类型、支撑区间与关键点；不要把这里的提示当作确定错因。</p>'}<div data-diag-comparison></div>${steps.length?`<details class="diag-steps" data-diag-steps><summary>逐步查看正确变换与完整推导</summary><div class="diag-step-controls"><label>当前步骤<select data-diag-step-select>${steps.map((s,i)=>`<option value="${i}">${i+1}. ${escape(s.label||'数学变换')}</option>`).join('')}</select></label><div class="btn-row"><button type="button" class="btn" data-diag-prev>上一步</button><button type="button" class="btn" data-diag-play aria-pressed="false">播放步骤</button><button type="button" class="btn" data-diag-next>下一步</button><button type="button" class="btn" data-diag-restart>回到起点</button></div></div><p class="muted" data-diag-motion-note ${motion?.matches?'':'hidden'}>系统已开启减少动态效果；请使用上一步、下一步或步骤列表。</p><div class="diag-step-current" data-diag-step-current><h4 data-diag-step-label></h4><p data-diag-step-explanation></p><p class="diag-step-formula" data-diag-step-formula></p></div><div data-diag-step-plot></div><ol class="diag-full-derivation">${steps.map(s=>`<li><strong>${escape(s.label||'数学变换')}</strong><p>${escape(s.explanation||'')}</p><p class="diag-step-formula">${escape(s.formula||'')}</p></li>`).join('')}</ol><p class="muted">每一步都使用实际构造的数学模型；复合变换的顺序由本题代数关系决定。</p></details>`:''}${recommendationsHTML(diagnosis)}`;
      if(actual&&expected&&actual.domain===expected.domain&&(!original||original.domain===expected.domain)){
        const regionList=(result.issues||[]).slice(0,20),labels=[original?`<label><input type="checkbox" checked data-diag-toggle-series="original"><span class="diag-line original"></span>① 原始输入 · 实线</label>`:'',`<label><input type="checkbox" checked data-diag-toggle-series="student"><span class="diag-line student"></span>② 我的答案 · 长虚线</label>`,`<label><input type="checkbox" checked data-diag-toggle-series="standard"><span class="diag-line standard"></span>③ 标准答案 · 点线</label>`].join('');
        $('[data-diag-comparison]').innerHTML=`<h4>把差异放到同一坐标系</h4><div class="diag-series-controls">${labels}<span class="diag-error-key">斜纹带：需要核对的区间或索引</span></div><div class="diag-compare-plot" data-diag-compare-plot></div><p class="muted">${escape(result.scope||'有限信号的省略部分为0。')} ${escape(result.endpointConvention||question.endpointConvention||'')}</p><details class="diag-region-list"><summary>查看已验证的差异位置 · ${result.issueCount??regionList.length}处</summary><ul>${regionList.map(i=>`<li>${escape(i.message||'请核对该数学位置。')}</li>`).join('')}</ul>${result.issueCount>regionList.length?`<p>这里只展示前${regionList.length}处；未标记不代表其余位置正确。</p>`:''}</details><div class="diag-models">${modelTable(actual,'我的答案')}${modelTable(expected,'标准答案')}</div>`;
        comparePlot=window.SignalPlot.mount($('[data-diag-compare-plot]'),{domain:expected.domain,title:'原始输入、作答与标准答案',range:graphRange(question,[actual,expected,...(original?[original]:[])])});plots.push(comparePlot);redrawComparison();comparePlot.setHighlights?.(issueRegions(result));
      }else if(actual&&expected&&actual.domain!==expected.domain){
        $('[data-diag-comparison]').innerHTML='<p class="diag-caution">连续时间曲线和离散整数序列属于不同时间类型，不能放在同一数学域里比较。请先修正时间类型，再检查变换。</p>';
      }
    }
    node.addEventListener('click',onClick);node.addEventListener('change',onChange);node.addEventListener('toggle',onToggle,true);document.addEventListener('visibilitychange',visibility);window.addEventListener('hashchange',stop);
    if(motion?.addEventListener)motion.addEventListener('change',motionChange);else motion?.addListener?.(motionChange);
    if(steps.length&&graded&&!result.correct)selectStep(0);
    window.MathTypeset?.(node);window.SignalIcons?.enhance(node);
    for(const [selector,name,label]of [['[data-diag-prev]','skipBack','上一步'],['[data-diag-next]','skipForward','下一步'],['[data-diag-restart]','reset','回到起点']]){const button=$(selector);if(button)window.SignalIcons?.button(button,name,label,{animate:false});}
    updatePlayButton();
    const instance={host,getState:()=>({stepIndex,playing,steps:steps.length,visible:{...visible},plots:plots.map(p=>p.getDiagnostics?.())}),destroy(){if(destroyed)return;destroyed=true;clearTimeout(timer);playing=false;for(const p of plots)p.destroy();document.removeEventListener('signallab:themechange',theme);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('hashchange',stop);if(motion?.removeEventListener)motion.removeEventListener('change',motionChange);else motion?.removeListener?.(motionChange);node.removeEventListener('click',onClick);node.removeEventListener('change',onChange);node.removeEventListener('toggle',onToggle,true);window.SignalIcons?.destroy(node);node.remove();instances.delete(instance);}};instances.add(instance);return instance;
  }
  window.DiagnosisUI=Object.freeze({mount,destroy(){for(const instance of [...instances])instance.destroy();},getStats:()=>({mounted:instances.size,playing:[...instances].filter(i=>i.getState().playing).length})});
})();
