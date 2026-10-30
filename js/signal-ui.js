/* Reusable offline signal editor and bounded interactive Canvas plot.
 * SignalEngine supplies the parser; user text is never executed as JavaScript.
 */
(function () {
  'use strict';
  const KEY = 'signallab.signals.v1';
  const MAX_ITEMS = 60, MAX_SOURCE = 4000, MAX_IMPORT = 256 * 1024;
  const COLORS = ['#3267e9', '#d17620', '#139d87', '#a06ae8', '#d15162'];
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = value => Number.isFinite(value) ? (Math.abs(value) >= 1e5 || (Math.abs(value)>0 && Math.abs(value)<1e-4) ? value.toExponential(3) : Number(value.toFixed(5)).toString()) : '无有限值';
  let editorSerial = 0;
  const engine = () => { if (!window.SignalEngine) throw new Error('信号解析器尚未加载，请保留完整项目文件。'); return window.SignalEngine; };
  const domainOf = value => value === 'dt' ? 'dt' : 'ct';
  function compile(source, domain) {
    if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new Error(`表达式最多 ${MAX_SOURCE} 个字符。`);
    return engine().compile(source, { domain: domainOf(domain) });
  }
  function normalizeItem(value) {
    if (!value || typeof value !== 'object' || !['ct','dt'].includes(value.domain) || typeof value.source !== 'string' || typeof value.name !== 'string') throw new Error('每个信号须包含名称、ct/dt 类型和文本表达式。');
    const name = value.name.trim();
    if (!name || name.length > 80) throw new Error('信号名称须为 1–80 个字符。');
    compile(value.source, value.domain);
    return { id: typeof value.id==='string' && /^[\w-]{1,100}$/.test(value.id) ? value.id : `sig-${Date.now()}-${Math.random().toString(36).slice(2,10)}`, name, domain:value.domain, source:value.source, favorite:value.favorite===true };
  }
  function readLibrary() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { items:[], error:'' };
      if (raw.length>MAX_IMPORT) throw new Error('已存信号库超出大小限制。');
      const data=JSON.parse(raw);
      if (data.version!==1 || !Array.isArray(data.signals) || data.signals.length>MAX_ITEMS) throw new Error('信号库格式或数量不正确。');
      return {items:data.signals.map(normalizeItem),error:''};
    } catch (error) { return {items:[],error:`信号库暂不可读：${error.message}。未覆盖原有数据。`}; }
  }
  function mountEditor(container, options = {}) {
    if (!container || !container.appendChild) throw new Error('SignalEditor 需要 DOM 容器。');
    const uid = `signal-editor-${++editorSerial}`;
    let destroyed=false, signal=null, domain=domainOf(options.domain), library=readLibrary(), selectedId='', objectUrls=[];
    const lockedDomain=options.lockDomain?domain:null;
    const node=document.createElement('section'); node.className='signal-editor'; node.setAttribute('aria-label','自定义信号编辑器');
    node.innerHTML=`<div class="sge-heading"><strong>自定义信号</strong><label>时间类型<select data-signal-domain aria-label="信号时间类型"><option value="ct">连续时间 CT · t</option><option value="dt">离散时间 DT · n</option></select></label></div>
      <label class="sge-source-label" for="${uid}-source">表达式 <span>仅允许数学表达式，不执行代码</span></label>
      <textarea id="${uid}-source" data-signal-source spellcheck="false" autocapitalize="off" autocomplete="off" rows="3" aria-describedby="${uid}-syntax ${uid}-status"></textarea>
      <div class="sge-shortcuts" aria-label="插入数学符号"></div>
      <div class="sge-actions"><button type="button" class="btn btn-primary" data-signal-apply>应用信号</button><label>载入例子<select data-signal-example aria-label="载入信号例子"></select></label></div>
      <p class="sge-help" id="${uid}-syntax">支持 + − * / ^、括号、pi、e、sin、cos、exp、abs、u、delta，以及 where(条件,成立值,否则值)。乘法请写 *；条件可用 &lt;、&lt;=、&gt;=、&amp;&amp;。</p>
      <div class="sge-status" id="${uid}-status" data-signal-status role="status" aria-live="polite"></div>
      <div class="sge-preview"><span>已应用表达式</span><div data-signal-math class="sge-math"></div><code data-signal-preview></code><small data-signal-details></small></div>
      <details class="sge-piecewise"><summary>分段信号编辑器</summary><p class="sge-help">按行从上到下匹配，第一个成立条件生效；其他位置默认 0。条件中的变量须与 CT/DT 一致。</p><div data-piecewise-rows></div><div class="sge-actions"><button type="button" class="btn" data-piecewise-add>＋ 添加分段</button><button type="button" class="btn btn-soft" data-piecewise-apply>应用分段信号</button><span class="sge-help">默认分支：0</span></div></details>
      <details class="sge-library"><summary>我的信号库 · 在各实验间复用</summary><div class="sge-library-save"><label>信号名称<input data-signal-name maxlength="80" placeholder="例如：单边衰减信号" aria-label="保存的信号名称"></label><button type="button" class="btn" data-signal-save>保存已应用信号</button></div><label class="sge-library-select">已保存信号<select data-signal-library aria-label="已保存信号"><option value="">请选择</option></select></label><div class="sge-actions"><button type="button" class="btn" data-signal-load>载入</button><button type="button" class="btn" data-signal-favorite aria-pressed="false">☆ 收藏</button><button type="button" class="btn" data-signal-rename>修改名称</button><button type="button" class="btn" data-signal-delete>删除选中信号</button></div><div class="sge-actions"><button type="button" class="btn" data-signal-export>导出信号库</button><label class="btn sge-import">导入信号库<input type="file" data-signal-import accept="application/json,.json"></label></div><p class="sge-help" data-library-status aria-live="polite">仅保存信号定义，不保存可执行代码。最多 ${MAX_ITEMS} 项；导入文件最多 256 KB。</p></details>`;
    container.appendChild(node);
    const $ = selector => node.querySelector(selector), source=$('[data-signal-source]'), domainSelect=$('[data-signal-domain]'), status=$('[data-signal-status]'), rows=$('[data-piecewise-rows]'), librarySelect=$('[data-signal-library]'), nameInput=$('[data-signal-name]');
    const notify = (message, bad=false) => { status.textContent=message; status.classList.toggle('is-error',bad); source.setAttribute('aria-invalid',String(bad)); };
    const libraryStatus=(message,bad=false)=>{const el=$('[data-library-status]');el.textContent=message;el.classList.toggle('is-error',bad);};
    function examples() {
      const t=domainSelect.value==='ct'?'t':'n';
      return [
        ['正弦',domainSelect.value==='ct'?'sin(2*pi*t)':'sin(pi*n/3)',domainSelect.value],['因果指数',`exp(-${t})*u(${t})`,domainSelect.value],['单位宽矩形',`u(${t})-u(${t}-1)`,domainSelect.value],
        ['移位冲激',`delta(${t}-1)`,domainSelect.value],['离散冲激组合','delta[n]+2*delta[n-1]','dt'],['分段三角形',`where(${t}>=0 && ${t}<1,${t},where(${t}>=1 && ${t}<2,2-${t},0))`,domainSelect.value]
      ];
    }
    function updateTools() {
      const t=domainSelect.value==='dt'?'n':'t';
      const insertions=[t,'pi','e','+','-','*','/','^','(',')','sin()','cos()','exp()','abs()',`u(${t})`,`delta(${t})`,`where(${t}>=0,1,0)`];
      $('.sge-shortcuts').innerHTML=insertions.map(text=>`<button type="button" data-insert="${esc(text)}" aria-label="插入 ${esc(text)}">${esc(text)}</button>`).join('');
      $('[data-signal-example]').innerHTML='<option value="">选择一个可计算例子</option>'+examples().map((e,i)=>`<option value="${i}">${esc(e[0])}${e[2]==='dt'?' · DT':''}</option>`).join('');
    }
    function updatePreview() {
      $('[data-signal-preview]').textContent=signal?signal.source:'尚无有效信号';
      const math=$('[data-signal-math]');math.textContent='';
      if(signal&&typeof window.katex?.render==='function'&&typeof engine().toLatex==='function'){
        try{window.katex.render(engine().toLatex(signal),math,{displayMode:true,throwOnError:false,trust:false,strict:'ignore',maxExpand:1000});}catch(error){math.textContent='公式预览暂不可用；下方文本表达式仍是当前计算定义。';}
      }
      const atoms=signal?.impulses||[], breaks=signal?.breakpoints||[];
      $('[data-signal-details]').textContent=signal?`${signal.domain==='dt'?'离散时间：仅整数索引':'连续时间：evaluate 计算普通部分'}；${atoms.length} 个冲激${atoms.length?'（位置:权重 '+atoms.slice(0,8).map(a=>`${fmt(a.at)}:${fmt(a.weight)}`).join('，')+'）':''}；${breaks.length} 个已知断点。`:'';
    }
    function commit(text,newDomain,{updateDraft=true,report=true}={}) {
      if(lockedDomain&&domainOf(newDomain)!==lockedDomain){notify('时间类型不匹配：请先切换实验顶部时间类型，再载入此信号。当前信号保持不变。',true);return null;}
      let candidate;
      try { candidate=compile(text,newDomain); }
      catch(error) { const position=Number.isInteger(error.position)?`（第 ${error.position+1} 个字符）`:'';notify(`无法应用${position}：${error.message}。保留上次有效信号。`,true);if(Number.isInteger(error.position)&&document.activeElement===source)source.setSelectionRange(Math.min(source.value.length,error.position),Math.min(source.value.length,error.position+1));return null; }
      signal=candidate;domain=domainOf(newDomain);domainSelect.value=domain;
      if(updateDraft)source.value=signal.source;
      updateTools();updatePreview();if(report)notify('信号已应用。绘图与计算使用上述有效定义。');
      if(typeof options.onChange==='function')options.onChange(signal);
      return signal;
    }
    function addRow(condition='',expression='') {
      if(rows.children.length>=20){notify('分段最多 20 行。',true);return;}
      const row=document.createElement('div');row.className='sge-piecewise-row';
      row.innerHTML='<label>条件<input data-piecewise-condition spellcheck="false" aria-label="分段条件" placeholder="t>=0 && t<1"></label><label>表达式<input data-piecewise-expression spellcheck="false" aria-label="分段表达式" placeholder="t"></label><button type="button" class="btn" data-piecewise-remove aria-label="删除本分段">×</button>';
      row.querySelector('[data-piecewise-condition]').value=condition;row.querySelector('[data-piecewise-expression]').value=expression;rows.appendChild(row);window.SignalIcons?.enhance(row);
    }
    function renderLibrary() {
      const sorted=[...library.items].sort((a,b)=>Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name));
      librarySelect.innerHTML='<option value="">请选择已保存信号</option>'+sorted.map(item=>`<option value="${esc(item.id)}">${item.favorite?'★ ':''}${esc(item.name)} · ${item.domain.toUpperCase()}</option>`).join('');
      if(library.items.some(item=>item.id===selectedId))librarySelect.value=selectedId;else selectedId='';
      const item=library.items.find(item=>item.id===selectedId);
      for(const action of ['load','favorite','rename','delete'])$(`[data-signal-${action}]`).disabled=!item;
      window.SignalIcons?.button($('[data-signal-favorite]'),item?.favorite?'bookmarkCheck':'bookmark',item?.favorite?'已收藏':'收藏',{pressed:!!item?.favorite});$('[data-signal-favorite]').setAttribute('aria-pressed',String(!!item?.favorite));
    }
    function persist(next,message) {
      try { localStorage.setItem(KEY,JSON.stringify({version:1,signals:next}));library={items:next,error:''};renderLibrary();libraryStatus(message);window.dispatchEvent(new CustomEvent('signallab:signals-changed'));return true; }
      catch(error) { selectedId=librarySelect.value;renderLibrary();libraryStatus(`保存失败：${error.message}。原有信号库未修改；可导出信号库备份。`,true);return false; }
    }
    function refreshLibrary(){if(destroyed)return;const fresh=readLibrary();if(!fresh.error){library=fresh;renderLibrary();}else libraryStatus(fresh.error,true);}
    function insert(text){const a=source.selectionStart??source.value.length,b=source.selectionEnd??a;source.setRangeText(text,a,b,'end');source.focus();if(text.endsWith('()'))source.setSelectionRange(a+text.length-1,a+text.length-1);notify('表达式已修改，点击“应用信号”更新计算。');}
    function handleClick(event) {
      const button=event.target.closest('button');if(!button||!node.contains(button))return;
      if(button.hasAttribute('data-insert'))insert(button.dataset.insert);
      else if(button.hasAttribute('data-signal-apply'))commit(source.value,domainSelect.value);
      else if(button.hasAttribute('data-piecewise-add'))addRow();
      else if(button.hasAttribute('data-piecewise-remove'))button.closest('.sge-piecewise-row').remove();
      else if(button.hasAttribute('data-piecewise-apply')){
        try{const values=[...rows.children].map(row=>({condition:row.querySelector('[data-piecewise-condition]').value,expression:row.querySelector('[data-piecewise-expression]').value}));if(!values.length)throw new Error('请至少填写一行分段。');const candidate=engine().piecewise(values,{domain:domainSelect.value});commit(candidate.source,domainSelect.value);}catch(error){notify(`分段信号未应用：${error.message}。保留上次有效信号。`,true);}
      } else if(button.hasAttribute('data-signal-save')){
        if(!signal){libraryStatus('请先应用一个有效信号。',true);return;}
        const name=nameInput.value.trim();if(!name){libraryStatus('请填写信号名称。',true);nameInput.focus();return;}
        const next=library.items.map(item=>({...item})),existing=next.find(item=>item.domain===signal.domain&&item.source===signal.source);
        if(!existing&&next.length>=MAX_ITEMS){libraryStatus(`最多保存 ${MAX_ITEMS} 项，请导出或删除不再需要的定义。`,true);return;}
        const item=normalizeItem({name,source:signal.source,domain:signal.domain,favorite:existing?.favorite});
        if(existing){existing.name=name;selectedId=existing.id;}else{next.push(item);selectedId=item.id;}
        persist(next,'已保存；其他实验的信号库会同步更新。');
      } else if(button.hasAttribute('data-signal-load')){
        const item=library.items.find(v=>v.id===selectedId);if(item){nameInput.value=item.name;commit(item.source,item.domain);}
      } else if(button.hasAttribute('data-signal-favorite')){
        persist(library.items.map(item=>item.id===selectedId?{...item,favorite:!item.favorite}:item),'收藏状态已更新。');
      } else if(button.hasAttribute('data-signal-rename')){
        const name=nameInput.value.trim();if(!name){libraryStatus('先在名称框中填写新名称，再点击“修改名称”。',true);nameInput.focus();return;}persist(library.items.map(item=>item.id===selectedId?{...item,name}:item),'信号名称已更新。');
      } else if(button.hasAttribute('data-signal-delete')){
        const item=library.items.find(v=>v.id===selectedId);if(item)persist(library.items.filter(v=>v.id!==selectedId),`已删除“${item.name}”的保存定义；当前已应用信号仍可使用。`);
      } else if(button.hasAttribute('data-signal-export')){
        const data={version:1,signals:library.items.map(({name,source,domain,favorite})=>({name,source,domain,favorite}))};
        const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));objectUrls.push(url);const a=document.createElement('a');a.href=url;a.download='SignalLab-信号库.json';a.click();libraryStatus(`已导出 ${library.items.length} 个信号定义。`);
      }
    }
    function handleChange(event){
      if(event.target===domainSelect){const old=domainSelect.value==='dt'?'t':'n',next=domainSelect.value==='dt'?'n':'t';source.value=source.value.replace(new RegExp(`\\b${old}\\b`,'g'),next);for(const input of rows.querySelectorAll('input'))input.value=input.value.replace(new RegExp(`\\b${old}\\b`,'g'),next);updateTools();notify('时间类型已切换，点击“应用信号”确认当前表达式。');}
      else if(event.target.matches('[data-signal-example]')&&event.target.value!==''){const example=examples()[Number(event.target.value)];if(example){const text=example[2]==='ct'?example[1].replace(/\bn\b/g,'t'):example[1];commit(text,example[2]);}}
      else if(event.target===librarySelect){selectedId=librarySelect.value;const item=library.items.find(v=>v.id===selectedId);if(item)nameInput.value=item.name;renderLibrary();}
      else if(event.target.matches('[data-signal-import]'))importFile(event.target.files?.[0]);
    }
    async function importFile(file){
      if(!file)return;
      try{if(file.size>MAX_IMPORT)throw new Error('文件超过 256 KB。');const text=await file.text();if(destroyed)return;const parsed=JSON.parse(text);if(parsed?.version!==1||!Array.isArray(parsed.signals)||parsed.signals.length>MAX_ITEMS)throw new Error('须为 version:1 的 signals 数组，最多 60 项。');const incoming=parsed.signals.map(normalizeItem);const next=library.items.map(item=>({...item}));for(const item of incoming){const match=next.find(v=>v.source===item.source&&v.domain===item.domain);if(match)match.favorite=match.favorite||item.favorite;else{item.id=`sig-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;next.push(item);}}if(next.length>MAX_ITEMS)throw new Error('合并后超过 60 项，未导入。');persist(next,`已校验并合并 ${incoming.length} 个信号定义。`);}catch(error){libraryStatus(`导入失败：${error.message}。现有信号库保持原样。`,true);}finally{$('[data-signal-import]').value='';}
    }
    function onInput(event){if(event.target===source)notify('表达式待应用；实验仍使用上一次有效信号。');}
    const storageHandler=event=>{if(!event.key||event.key===KEY)refreshLibrary();};
    node.addEventListener('click',handleClick);node.addEventListener('change',handleChange);node.addEventListener('input',onInput);
    window.addEventListener('storage',storageHandler);window.addEventListener('signallab:signals-changed',refreshLibrary);
    domainSelect.value=domain;domainSelect.disabled=!!lockedDomain;if(lockedDomain)domainSelect.title='时间类型由实验顶部统一控制';source.value=options.source||(domain==='ct'?'sin(2*pi*t)':'0.8^n*u(n)');
    updateTools();addRow(domain==='ct'?'t>=0 && t<1':'n>=0 && n<3',domain==='ct'?'t':'n');addRow(domain==='ct'?'t>=1 && t<2':'n>=3 && n<5',domain==='ct'?'2-t':'5-n');renderLibrary();
    if(library.error)libraryStatus(library.error,true);
    commit(source.value,domain);window.SignalIcons?.enhance(node);
    return { getSignal:()=>signal,getSource:()=>signal?.source||'',setSignal:(text,newDomain=domainSelect.value)=>{if(destroyed)return null;if(lockedDomain&&domainOf(newDomain)!==lockedDomain){notify('时间类型不匹配：请先切换实验顶部时间类型，再载入此信号。当前信号保持不变。',true);return null;}source.value=String(text);domainSelect.value=domainOf(newDomain);return commit(String(text),domainSelect.value);},destroy(){if(destroyed)return;destroyed=true;window.SignalIcons?.destroy(node);window.removeEventListener('storage',storageHandler);window.removeEventListener('signallab:signals-changed',refreshLibrary);node.removeEventListener('click',handleClick);node.removeEventListener('change',handleChange);node.removeEventListener('input',onInput);objectUrls.forEach(url=>URL.revokeObjectURL(url));node.remove();} };
  }

  /* Plot: bounded evaluation, CT discontinuity gaps, DT stems and separate atoms. */
  function mountPlot(container, options={}) {
    if(!container||!container.appendChild)throw new Error('SignalPlot 需要 DOM 容器。');
    const node=document.createElement('section');node.className='signal-plot';node.setAttribute('aria-label',options.title||'交互信号绘图');
    node.innerHTML=`<div class="sgp-toolbar"><strong>${esc(options.title||'交互波形')}</strong><div class="sgp-buttons"><button type="button" class="btn" data-plot-zoom="in" aria-label="放大波形">＋</button><button type="button" class="btn" data-plot-zoom="out" aria-label="缩小波形">−</button><button type="button" class="btn" data-plot-reset>重置视图</button><button type="button" class="btn" data-plot-touch aria-pressed="false">触摸平移：关</button></div></div><div class="sgp-viewport"><canvas tabindex="0" aria-label="信号图。加减键缩放，方向键平移，Home 键重置。"></canvas></div><div class="sgp-legend" data-plot-legend></div><div class="sgp-coordinate" data-plot-coordinate role="status" aria-live="off">移动指针查看坐标；连续时间冲激以独立权重箭头表示。</div><div class="sgp-status" data-plot-status role="status" aria-live="polite"></div><form class="sgp-range" data-plot-range><label>x 最小<input type="number" step="any" data-range="xmin" aria-label="横轴最小值"></label><label>x 最大<input type="number" step="any" data-range="xmax" aria-label="横轴最大值"></label><label>y 最小<input type="number" step="any" data-range="ymin" aria-label="纵轴最小值"></label><label>y 最大<input type="number" step="any" data-range="ymax" aria-label="纵轴最大值"></label><button class="btn" type="submit">应用范围</button></form><p class="sgp-help">滚轮以指针为中心缩放；鼠标拖动平移。触摸默认保留页面滚动，开启“触摸平移”后可单指拖动、双指缩放。图形每次最多计算 12000 个点。</p>`;
    container.appendChild(node);const $=selector=>node.querySelector(selector),canvas=$('canvas'),ctx=canvas.getContext('2d');
    if(!ctx){node.remove();throw new Error('浏览器不支持 Canvas 2D。');}
    let destroyed=false,series=[],highlights=[],domain=domainOf(options.domain),xlabel=options.xlabel?String(options.xlabel).slice(0,80):'',range={xmin:-4,xmax:4,ymin:-2,ymax:2},initialRange,frame=0,width=600,height=280,touchMode=false,cross=null;
    const pointers=new Map();let gesture=null,plot={left:54,top:25,right:580,bottom:240},lastNonfinite=0,lastEvaluations=0;
    const LIMIT=1e6,MINSPAN=1e-7,MAX_EVAL=12000;
    function validRange(value){if(!value||typeof value!=='object')throw new Error('范围须包含 xmin、xmax、ymin、ymax。');const out={};for(const key of ['xmin','xmax','ymin','ymax']){out[key]=Number(value[key]);if(!Number.isFinite(out[key])||Math.abs(out[key])>LIMIT)throw new Error('范围必须为有限数，绝对值不超过 10⁶。');}if(out.xmax-out.xmin<MINSPAN||out.ymax-out.ymin<MINSPAN)throw new Error('横纵轴最大值必须大于最小值，跨度至少 10⁻⁷。');return out;}
    function setStatus(message,bad=false){const el=$('[data-plot-status]');if(el.textContent!==message)el.textContent=message;el.classList.toggle('is-error',bad);}
    function updateInputs(){for(const key of Object.keys(range))$(`[data-range="${key}"]`).value=String(Number(range[key].toPrecision(13)));}
    let paintedTheme='',sampleCache=new Map(),drawCount=0,themeRepaints=0,lastFunctionEvaluations=0,lastCacheHits=0;
    function queue(){if(destroyed||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
    function setRange(next){try{range=validRange(next);updateInputs();queue();return true;}catch(error){setStatus(error.message,true);return false;}}
    function normalizeSeries(values){if(!Array.isArray(values)||values.length>12)throw new Error('一次最多绘制 12 组信号。');return values.map((value,i)=>{const fn=value.fn||(value.signal&&typeof value.signal.evaluate==='function'?x=>value.signal.evaluate(x):null),rawPoints=value.points||[];if(!Array.isArray(rawPoints)||rawPoints.length>MAX_EVAL)throw new Error('每组手动样本最多 12000 个。');const points=rawPoints.map(p=>Array.isArray(p)?{x:Number(p[0]),y:Number(p[1])}:{x:Number(p.x),y:Number(p.y)}).filter(p=>Number.isFinite(p.x)).sort((a,b)=>a.x-b.x);const atoms=value.impulses||value.signal?.impulses||[],breakpoints=value.breakpoints||value.signal?.breakpoints||[];
      const rawSegments=value.exactSegments||[],rawMarkers=value.endpointMarkers||[],rawDash=value.dash||[];
      if(!Array.isArray(rawSegments)||rawSegments.length>160||!Array.isArray(rawMarkers)||rawMarkers.length>1000||!Array.isArray(rawDash)||rawDash.length>8)throw new Error('精确分段、端点或线型数据超出绘图上限。');
      const exactSegments=rawSegments.map(p=>{const next={start:Number(p?.start),end:Number(p?.end),y0:Number(p?.y0),y1:Number(p?.y1)};if(Object.values(next).some(v=>!Number.isFinite(v)||Math.abs(v)>LIMIT)||!(next.end>next.start))throw new Error('精确绘图分段须为有限且起点小于终点的线段。');return next;}).sort((a,b)=>a.start-b.start);
      for(let j=1;j<exactSegments.length;j++)if(exactSegments[j].start<exactSegments[j-1].end)throw new Error('精确绘图分段不能重叠。');
      const endpointMarkers=rawMarkers.map(p=>{const next={x:Number(p?.x),y:Number(p?.y),closed:p?.closed!==false};if(!Number.isFinite(next.x)||!Number.isFinite(next.y)||Math.abs(next.x)>LIMIT||Math.abs(next.y)>LIMIT)throw new Error('特殊端点须为有限坐标。');return next;});
      const dash=rawDash.map(Number);if(dash.some(v=>!Number.isFinite(v)||v<0||v>40))throw new Error('线型长度须在0至40之间。');
      return {exactSegments,endpointMarkers,dash,outsideZero:value.outside===0,name:String(value.name||`信号 ${i+1}`).slice(0,100),color:/^(#[0-9a-f]{3,8}|[a-z]{3,20})$/i.test(value.color||'')?value.color:COLORS[i%COLORS.length],fn,points,impulses:Array.isArray(atoms)?atoms.slice(0,300).filter(a=>Number.isFinite(a.at)&&Number.isFinite(a.weight)):[],breakpoints:Array.isArray(breakpoints)?breakpoints.filter(Number.isFinite).slice(0,400).sort((a,b)=>a-b):[],discrete:value.discrete??(value.signal?.domain==='dt'||domain==='dt')};});}
    function setSeries(next){try{series=normalizeSeries(next);$('[data-plot-legend]').innerHTML=series.map(s=>`<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('');cross=null;queue();return true;}catch(error){setStatus(error.message,true);return false;}}
    function setHighlights(values=[]){try{if(!Array.isArray(values)||values.length>80)throw new Error('一次最多标记80个检查区间。');highlights=values.map(v=>{const start=Number(v?.start),end=Number(v?.end);if(!Number.isFinite(start)||!Number.isFinite(end)||Math.abs(start)>LIMIT||Math.abs(end)>LIMIT||end<start)throw new Error('检查区间必须为有限且按顺序排列的时间坐标。');return{start,end};});queue();return true;}catch(error){setStatus(error.message,true);return false;}}
    const X=x=>plot.left+(x-range.xmin)/(range.xmax-range.xmin)*(plot.right-plot.left),Y=y=>plot.bottom-(y-range.ymin)/(range.ymax-range.ymin)*(plot.bottom-plot.top);
    const toX=x=>range.xmin+(x-plot.left)/(plot.right-plot.left)*(range.xmax-range.xmin),toY=y=>range.ymax-(y-plot.top)/(plot.bottom-plot.top)*(range.ymax-range.ymin);
    function ticks(a,b){const span=b-a,raw=span/6,p=10**Math.floor(Math.log10(raw)),unit=raw/p,step=(unit<=1?1:unit<=2?2:unit<=5?5:10)*p;const out=[];for(let value=Math.ceil(a/step)*step;value<=b+step*1e-8&&out.length<25;value+=step)out.push(value);return out;}
    function contextStyle(){const css=getComputedStyle(node);return {fg:css.getPropertyValue('--text').trim()||'#202c43',muted:css.getPropertyValue('--muted').trim()||'#7c879a',border:css.getPropertyValue('--border').trim()||'#e7ebf2',surface:css.getPropertyValue('--surface').trim()||'#fff',red:css.getPropertyValue('--red').trim()||'#b43f50'};}
    function draw(themeOnly=false){if(destroyed)return;if(!themeOnly)sampleCache=new Map();drawCount++;if(themeOnly)themeRepaints++;let functionCalls=0,cacheHits=0;const css=contextStyle(),dpr=Math.min(window.devicePixelRatio||1,2);width=Math.max(220,Math.floor(canvas.clientWidth||600));height=Math.max(240,Math.floor(canvas.clientHeight||280));if(canvas.width!==Math.round(width*dpr)||canvas.height!==Math.round(height*dpr)){canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.fillStyle=css.surface;ctx.fillRect(0,0,width,height);plot={left:Math.min(58,width*.2),top:26,right:width-18,bottom:height-38};ctx.font='11px "Segoe UI",sans-serif';ctx.lineWidth=1;
      for(const x of ticks(range.xmin,range.xmax)){ctx.strokeStyle=css.border;ctx.beginPath();ctx.moveTo(X(x),plot.top);ctx.lineTo(X(x),plot.bottom);ctx.stroke();ctx.fillStyle=css.muted;ctx.textAlign='center';ctx.fillText(fmt(x),X(x),plot.bottom+18);}
      for(const y of ticks(range.ymin,range.ymax)){ctx.strokeStyle=css.border;ctx.beginPath();ctx.moveTo(plot.left,Y(y));ctx.lineTo(plot.right,Y(y));ctx.stroke();ctx.fillStyle=css.muted;ctx.textAlign='right';ctx.fillText(fmt(y),plot.left-7,Y(y)+4);}
      ctx.strokeStyle=css.muted;ctx.beginPath();if(range.ymin<=0&&range.ymax>=0){ctx.moveTo(plot.left,Y(0));ctx.lineTo(plot.right,Y(0));}if(range.xmin<=0&&range.xmax>=0){ctx.moveTo(X(0),plot.top);ctx.lineTo(X(0),plot.bottom);}ctx.stroke();ctx.fillStyle=css.muted;ctx.textAlign='right';ctx.fillText(xlabel||(domain==='dt'?'n':'t / x'),plot.right,height-5);
      let evaluations=0,nonfinite=0,truncated=false,jumpCount=0;const budget=Math.max(30,Math.floor(MAX_EVAL/Math.max(series.length,1)));
      ctx.save();ctx.beginPath();ctx.rect(plot.left,plot.top,plot.right-plot.left,plot.bottom-plot.top);ctx.clip();
      // Optional diagnosis bands use the same world-to-screen map as zoom/pan.
      // Hatching plus text outside the canvas distinguishes them without color.
      let hatchBudget=600;for(const h of highlights){const a=Math.max(range.xmin,h.start),b=Math.min(range.xmax,h.end);if(b<a)continue;const left=X(a),bandWidth=Math.max(2,X(b)-left);ctx.save();ctx.beginPath();ctx.rect(left,plot.top,bandWidth,plot.bottom-plot.top);ctx.clip();ctx.fillStyle=css.red;ctx.globalAlpha=.13;ctx.fillRect(left,plot.top,bandWidth,plot.bottom-plot.top);ctx.strokeStyle=css.red;ctx.globalAlpha=.42;ctx.lineWidth=1;ctx.beginPath();const diagonal=plot.bottom-plot.top;for(let px=left-diagonal;px<left+bandWidth&&hatchBudget>0;px+=12,hatchBudget--){ctx.moveTo(px,plot.bottom);ctx.lineTo(px+diagonal,plot.top);}ctx.stroke();ctx.restore();}
      for(const s of series){ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.lineWidth=2;ctx.setLineDash(s.dash);
        const safe=x=>{if(evaluations>=MAX_EVAL){truncated=true;return NaN;}evaluations++;let values=sampleCache.get(s);if(!values){values=new Map();sampleCache.set(s,values);}let value;if(themeOnly&&values.has(x)){value=values.get(x);cacheHits++;}else{functionCalls++;try{value=Number(s.fn(x));}catch(error){value=NaN;}values.set(x,value);}if(!Number.isFinite(value)){nonfinite++;return NaN;}return value;};
        const stem=(x,y)=>{if(!Number.isFinite(y)){nonfinite++;return;}if(x<range.xmin||x>range.xmax)return;const px=X(x),py=Y(y),zero=Y(0);ctx.beginPath();ctx.moveTo(px,zero);ctx.lineTo(px,py);ctx.stroke();ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();};
        if(s.exactSegments.length||s.outsideZero&&!s.discrete){
          // Clip affine pieces algebraically. Zooming inside a long segment
          // must not discard it just because both original endpoints are offscreen.
          const pieces=s.exactSegments;let cursor=range.xmin;ctx.beginPath();
          for(const piece of pieces){if(piece.end<range.xmin||piece.start>range.xmax)continue;const a=Math.max(range.xmin,piece.start),b=Math.min(range.xmax,piece.end);if(s.outsideZero&&a>cursor){ctx.moveTo(X(cursor),Y(0));ctx.lineTo(X(a),Y(0));}if(b>a){const slope=(piece.y1-piece.y0)/(piece.end-piece.start);ctx.moveTo(X(a),Y(piece.y0+slope*(a-piece.start)));ctx.lineTo(X(b),Y(piece.y0+slope*(b-piece.start)));}cursor=Math.max(cursor,b);}
          if(s.outsideZero&&cursor<range.xmax){ctx.moveTo(X(cursor),Y(0));ctx.lineTo(X(range.xmax),Y(0));}ctx.stroke();
        }
        else if(s.points.length){let count=0,previous=null;ctx.beginPath();for(const p of s.points){if(p.x<range.xmin||p.x>range.xmax)continue;if(count++>=budget){truncated=true;break;}if(s.discrete)stem(p.x,p.y);else{if(!Number.isFinite(p.y)){nonfinite++;previous=null;continue;}const breakBetween=previous&&s.breakpoints.some(b=>b>=previous.x&&b<=p.x);if(!previous||breakBetween){ctx.moveTo(X(p.x),Y(p.y));if(breakBetween)jumpCount++;}else ctx.lineTo(X(p.x),Y(p.y));previous=p;}}if(!s.discrete)ctx.stroke();}
        else if(s.fn&&s.discrete){const first=Math.ceil(range.xmin),last=Math.floor(range.xmax),count=last-first+1;if(count>budget){truncated=true;const stride=Math.ceil(count/budget);for(let n=first;n<=last;n+=stride)stem(n,safe(n));}else for(let n=first;n<=last;n++)stem(n,safe(n));}
        else if(s.fn){const cuts=[range.xmin,...s.breakpoints.filter(b=>b>range.xmin&&b<range.xmax),range.xmax];jumpCount+=cuts.length-2;const totalSpan=range.xmax-range.xmin,gap=totalSpan/(plot.right-plot.left)*.8;for(let segment=0;segment<cuts.length-1;segment++){let a=cuts[segment]+(segment>0?gap:0),b=cuts[segment+1]-(segment<cuts.length-2?gap:0);if(a>b)continue;const steps=Math.min(budget,Math.max(2,Math.ceil((b-a)/totalSpan*Math.min((plot.right-plot.left)*2,budget))));ctx.beginPath();let open=false,previousY;for(let k=0;k<=steps;k++){const x=a+(b-a)*k/steps,y=safe(x);if(!Number.isFinite(y)){open=false;continue;}const px=X(x),py=Y(y);if(!Number.isFinite(px)||!Number.isFinite(py)){nonfinite++;open=false;continue;}const giantJump=open&&Math.abs(py-previousY)>height*5;if(!open||giantJump){ctx.moveTo(px,py);if(giantJump)jumpCount++;}else ctx.lineTo(px,py);open=true;previousY=py;}ctx.stroke();}}
        ctx.setLineDash([]);for(const point of s.endpointMarkers){if(point.x<range.xmin||point.x>range.xmax)continue;ctx.beginPath();ctx.arc(X(point.x),Y(point.y),3,0,Math.PI*2);ctx.fillStyle=point.closed?s.color:css.surface;ctx.fill();ctx.strokeStyle=s.color;ctx.stroke();}
        for(const atom of s.impulses){if(atom.at<range.xmin||atom.at>range.xmax||atom.weight===0)continue;const px=X(atom.at),base=Math.max(plot.top+25,Math.min(plot.bottom-25,Y(0))),tip=base+(atom.weight>0?-42:42),direction=atom.weight>0?-1:1;ctx.strokeStyle=s.color;ctx.fillStyle=s.color;ctx.beginPath();ctx.moveTo(px,base);ctx.lineTo(px,tip);ctx.stroke();ctx.beginPath();ctx.moveTo(px-5,tip-direction*8);ctx.lineTo(px,tip);ctx.lineTo(px+5,tip-direction*8);ctx.stroke();ctx.textAlign=px>plot.right-80?'right':'left';ctx.fillText(`δ: ${fmt(atom.weight)}`,px+(px>plot.right-80?-7:7),tip+(atom.weight>0?-5:15));}
      }
      if(cross){ctx.setLineDash([4,4]);ctx.strokeStyle=css.muted;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cross.x,plot.top);ctx.lineTo(cross.x,plot.bottom);ctx.moveTo(plot.left,cross.y);ctx.lineTo(plot.right,cross.y);ctx.stroke();ctx.setLineDash([]);}ctx.restore();
      paintedTheme=document.documentElement.dataset.theme;lastFunctionEvaluations=functionCalls;lastCacheHits=cacheHits;lastNonfinite=nonfinite;lastEvaluations=evaluations;const notes=[];if(nonfinite)notes.push(`已跳过 ${nonfinite} 个非有限值或计算异常点（奇点不作为有限波形值）。`);if(jumpCount)notes.push(`已在 ${jumpCount} 处已知断点或数值跳跃处断开连线。`);if(truncated)notes.push('显示点数达到上限，使用有限采样；DT 图可能抽取部分整数样本。');if(series.some(s=>s.impulses.length))notes.push('δ 箭头标注权重，箭头高度仅为标识，不代表 δ 的数值。');setStatus(notes.join(' ')||(series.some(s=>s.exactSegments.length||s.outsideZero&&!s.discrete)?'有限分段按精确仿射线段绘制；跳变断开，特殊端点用空心/实心点标记。判分独立于显示像素。':'普通部分按有限采样绘制；已知断点不连线，离散样本不相连。'),nonfinite>0);
    }
    function localPoint(event){const box=canvas.getBoundingClientRect();return {x:(event.clientX-box.left)*width/box.width,y:(event.clientY-box.top)*height/box.height};}
    function coordinate(point){cross={x:Math.max(plot.left,Math.min(plot.right,point.x)),y:Math.max(plot.top,Math.min(plot.bottom,point.y))};const x=toX(cross.x),y=toY(cross.y),labels=[`坐标 x=${fmt(x)}，y=${fmt(y)}`];for(const s of series.slice(0,4)){const arg=s.discrete?Math.round(x):x;let value=NaN;try{if(s.fn)value=Number(s.fn(arg));else if(s.points.length){const p=s.points.reduce((a,b)=>Math.abs(b.x-x)<Math.abs(a.x-x)?b:a);value=p.y;labels.push(`${s.name} 最近样本 x=${fmt(p.x)}，值=${fmt(value)}`);}}catch(error){}if(s.fn)labels.push(`${s.name}${s.discrete?`[${arg}]`:' 普通部分'}=${fmt(value)}`);const atoms=s.impulses.filter(a=>Math.abs(X(a.at)-cross.x)<7);if(atoms.length)labels.push(`${s.name} 冲激权重：${atoms.map(a=>`${fmt(a.weight)} @ ${fmt(a.at)}`).join('，')}（与普通部分分开）`);} $('[data-plot-coordinate]').textContent=labels.join('；');queue();}
    function zoom(factor,point){const p=point||{x:(plot.left+plot.right)/2,y:(plot.top+plot.bottom)/2},x=toX(p.x),y=toY(p.y);setRange({xmin:x+(range.xmin-x)*factor,xmax:x+(range.xmax-x)*factor,ymin:y+(range.ymin-y)*factor,ymax:y+(range.ymax-y)*factor});}
    function pan(dx,dy,origin){const wx=(origin.xmax-origin.xmin)*dx/(plot.right-plot.left),wy=(origin.ymax-origin.ymin)*dy/(plot.bottom-plot.top);setRange({xmin:origin.xmin-wx,xmax:origin.xmax-wx,ymin:origin.ymin+wy,ymax:origin.ymax+wy});}
    function makeGesture(){const points=[...pointers.values()];if(points.length>=2){const a=points[0],b=points[1];gesture={type:'pinch',range:{...range},mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance:Math.max(10,Math.hypot(a.x-b.x,a.y-b.y))};}else if(points.length===1)gesture={type:'pan',range:{...range},start:points[0]};else gesture=null;}
    function pointerDown(event){if(event.pointerType==='touch'&&!touchMode)return;if(event.button!==0&&event.pointerType!=='touch')return;const point=localPoint(event);pointers.set(event.pointerId,point);try{canvas.setPointerCapture?.(event.pointerId);}catch(error){/* Synthetic/accessibility pointer streams need not have an active capture target. */}makeGesture();event.preventDefault();}
    function pointerMove(event){const point=localPoint(event);if(pointers.has(event.pointerId)){pointers.set(event.pointerId,point);const values=[...pointers.values()];if(gesture?.type==='pinch'&&values.length>=2){const a=values[0],b=values[1],distance=Math.max(10,Math.hypot(a.x-b.x,a.y-b.y)),factor=gesture.distance/distance,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},g=gesture,old=range;range=g.range;const x=toX(g.mid.x),y=toY(g.mid.y),shiftX=(mid.x-g.mid.x)/(plot.right-plot.left)*(g.range.xmax-g.range.xmin)*factor,shiftY=(mid.y-g.mid.y)/(plot.bottom-plot.top)*(g.range.ymax-g.range.ymin)*factor;range=old;setRange({xmin:x+(g.range.xmin-x)*factor-shiftX,xmax:x+(g.range.xmax-x)*factor-shiftX,ymin:y+(g.range.ymin-y)*factor+shiftY,ymax:y+(g.range.ymax-y)*factor+shiftY});}else if(gesture?.type==='pan')pan(point.x-gesture.start.x,point.y-gesture.start.y,gesture.range);event.preventDefault();}coordinate(point);}
    function pointerUp(event){pointers.delete(event.pointerId);makeGesture();}
    function wheel(event){event.preventDefault();zoom(Math.exp(Math.max(-1,Math.min(1,event.deltaY*.002))),localPoint(event));}
    function keydown(event){const factor=event.shiftKey?.25:.1,dx=(range.xmax-range.xmin)*factor,dy=(range.ymax-range.ymin)*factor;let next;if(event.key==='+'||event.key==='=')zoom(.8);else if(event.key==='-')zoom(1.25);else if(event.key==='Home')setRange(initialRange);else if(event.key==='ArrowLeft')next={...range,xmin:range.xmin-dx,xmax:range.xmax-dx};else if(event.key==='ArrowRight')next={...range,xmin:range.xmin+dx,xmax:range.xmax+dx};else if(event.key==='ArrowUp')next={...range,ymin:range.ymin+dy,ymax:range.ymax+dy};else if(event.key==='ArrowDown')next={...range,ymin:range.ymin-dy,ymax:range.ymax-dy};else return;if(next)setRange(next);event.preventDefault();}
    function click(event){if(event.target.closest('[data-plot-zoom="in"]'))zoom(.8);else if(event.target.closest('[data-plot-zoom="out"]'))zoom(1.25);else if(event.target.closest('[data-plot-reset]'))setRange(initialRange);else if(event.target.closest('[data-plot-touch]')){touchMode=!touchMode;canvas.style.touchAction=touchMode?'none':'pan-y';const btn=$('[data-plot-touch]');btn.setAttribute('aria-pressed',String(touchMode));window.SignalIcons?.button(btn,touchMode?'check':'move',`触摸平移：${touchMode?'开':'关'}`,{pressed:touchMode});pointers.clear();gesture=null;}}
    function submit(event){event.preventDefault();const next={};for(const key of Object.keys(range))next[key]=$(`[data-range="${key}"]`).value;setRange(next);}
    canvas.style.touchAction='pan-y';canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('lostpointercapture',pointerUp);canvas.addEventListener('keydown',keydown);node.addEventListener('click',click);$('[data-plot-range]').addEventListener('submit',submit);
    const resize=typeof ResizeObserver!=='undefined'?new ResizeObserver(queue):null;resize?.observe(canvas);const theme=typeof MutationObserver!=='undefined'?new MutationObserver(()=>{if(paintedTheme!==document.documentElement.dataset.theme)themePaint();}):null;theme?.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});window.addEventListener('resize',queue);const themePaint=()=>{const pending=!!frame;if(frame){cancelAnimationFrame(frame);frame=0;}draw(!pending);};document.addEventListener('signallab:themechange',themePaint);
    setRange(options.range||range);initialRange={...range};setSeries(options.series||[]);queue();window.SignalIcons?.enhance(node);
    return {setSeries,setRange,setHighlights,getRange:()=>({...range}),setDomain(next){domain=domainOf(next);queue();},setXLabel(label){xlabel=String(label).slice(0,80);queue();},destroy(){if(destroyed)return;destroyed=true;window.SignalIcons?.destroy(node);if(frame)cancelAnimationFrame(frame);resize?.disconnect();theme?.disconnect();window.removeEventListener('resize',queue);document.removeEventListener('signallab:themechange',themePaint);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('lostpointercapture',pointerUp);canvas.removeEventListener('keydown',keydown);node.remove();},getDiagnostics:()=>({nonfinite:lastNonfinite,evaluations:lastEvaluations,series:series.length,evaluationLimit:MAX_EVAL,draws:drawCount,themeRepaints,functionEvaluations:lastFunctionEvaluations,cacheHits:lastCacheHits,exactSegments:series.reduce((n,s)=>n+s.exactSegments.length,0),highlightRegions:highlights.length})};
  }
  window.SignalEditor={mount:mountEditor,storageKey:KEY};
  window.SignalPlot={mount:mountPlot};
}());
