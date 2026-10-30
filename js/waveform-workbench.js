/* Two-way learning workspace. Arbitrary supported formulas remain formula plots;
 * only exact finite models are offered for point/segment editing. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>v==null?null:JSON.parse(JSON.stringify(v));
  function mount(host,options={}){
    if(!host?.appendChild)throw new Error('双向编辑器需要有效容器。');
    let domain=options.domain==='dt'?'dt':'ct',model=null,signal=null,source='',valid=false,destroyed=false,editor=null,preview=null,applied=null;
    const range={xmin:-4,xmax:8,ymin:-3,ymax:4,...options.range};
    host.innerHTML=`<section class="waveform-workbench"><div class="wb-toolbar"><label>时间类型<select data-wb-domain ${options.lockDomain?'disabled':''}><option value="ct">连续时间 x(t)</option><option value="dt">离散时间 x[n]</option></select></label><span class="badge">公式 ↔ 波形</span></div><label class="wb-source-label">信号公式<textarea rows="3" data-wb-source spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="x(t)=u(t)-u(t-2)"></textarea></label><div class="btn-row wb-actions"><button type="button" class="btn btn-primary" data-wb-apply>由公式生成波形</button><button type="button" class="btn" data-wb-copy>复制当前有效公式</button>${typeof options.onUse==='function'?'<button type="button" class="btn btn-soft" data-wb-use>应用到当前实验</button>':''}</div><div class="wb-examples" data-wb-examples></div><p class="wb-status" data-wb-status role="status"></p><div class="wb-math" data-wb-math></div><div data-wb-preview hidden></div><div data-wb-editor></div><p class="small muted wb-scope">图像不是公式证明。有限分段/整数模型按完整区间和端点转换，不通过少量采样推断相等；复杂函数保留原式绘图，连续冲激保持独立权重箭头。</p></section>`;
    const $=s=>host.querySelector(s),field=$('[data-wb-source]'),status=$('[data-wb-status]');$('[data-wb-domain]').value=domain;
    function message(text,bad=false){status.textContent=text;status.classList.toggle('is-error',bad);if($('[data-wb-use]'))$('[data-wb-use]').disabled=!valid;}
    function examples(){const rows=domain==='dt'?[['冲激差','x[n]=δ[n]-δ[n-2]'],['有限矩形','u(n)-u(n-4)'],['无限余弦 · 仅绘图','cos(pi*n/3)']]:[['矩形','x(t)=u(t)-u(t-2)'],['有限斜坡','t*(u(t)-u(t-2))'],['分段','where(t>=0&&t<1,t,where(t>=1&&t<2,2-t,0))'],['指数 · 仅绘图','x(t)=exp(-t)u(t)'],['正弦 · 仅绘图','x(t)=sin(2πt)']];$('[data-wb-examples]').innerHTML=rows.map(([title,text])=>`<button type="button" class="btn btn-sm" data-wb-example="${esc(text)}">${esc(title)}</button>`).join('');}
    function typeset(latex){const target=$('[data-wb-math]');if(window.katex)window.katex.render(latex,target,{displayMode:true,throwOnError:false,trust:false});else target.textContent=source;}
    function notify(){const value={source,domain,model:clone(model),signal};options.onSignal?.(value);return value;}
    function destroyViews(){editor?.destroy();editor=null;preview?.destroy();preview=null;$('[data-wb-editor]').replaceChildren();$('[data-wb-preview]').replaceChildren();}
    function visualChange(next){
      try{model=clone(next);source=window.WaveformExpressions.toExpression(model);signal=window.SignalEngine.compile(source,{domain});valid=true;field.value=source;applied={source,domain,model:clone(model),signal,editable:true};typeset(window.WaveformExpressions.toLatex(model));message('波形已精确更新公式。开放端点与特殊单点取值均保留；可以继续编辑或送入实验。');notify();}
      catch(e){valid=false;message('模型有效，但尚不能生成可用公式：'+e.message,true);options.onInvalid?.(e.message);}
    }
    function apply(text=field.value){
      if(destroyed)return false;
      try{
        const result=window.WaveformExpressions.analyze(text,{domain});
        destroyViews();source=result.source;domain=result.domain;signal=result.signal;model=clone(result.model);valid=true;applied=result;field.value=source;$('[data-wb-domain]').value=domain;typeset(result.latex);
        if(result.editable&&model){
          $('[data-wb-preview]').hidden=true;$('[data-wb-editor]').hidden=false;
          editor=window.WaveformEditor.mount($('[data-wb-editor]'),{domain,range,axisStep:options.axisStep||{x:1,y:1},model,formulaControls:false,onChange:visualChange,onInvalid(text){valid=false;message(text,true);options.onInvalid?.(text);}});
          message('精确有限模型：可拖动拐点、编辑区间与端点；每次有效修改都会实时生成公式。');
        }else{
          $('[data-wb-editor]').hidden=true;$('[data-wb-preview]').hidden=false;
          preview=window.SignalPlot.mount($('[data-wb-preview]'),{domain,title:'按原公式绘制（仅绘图模式）',range,series:[{signal,name:domain==='dt'?'x[n]':'x(t)',color:'#3267e9'}]});
          message('仅按原公式绘图：'+(result.reason||'当前公式不能精确转成有限分段或有限整数序列。')+' 不生成拟合解析式，也不把截窗数据当作完整信号。');
        }
        examples();notify();return true;
      }catch(e){valid=false;message('公式未应用：'+e.message+'。图中若有波形，仍为上一次成功应用的结果。',true);options.onInvalid?.(e.message);return false;}
    }
    function input(e){if(e.target===field){valid=false;message('公式草稿尚未应用；图中仍是上一次有效结果。请应用后再使用。',true);options.onInvalid?.('公式草稿未应用');}}
    function click(e){
      if(e.target.closest('[data-wb-apply]'))apply();
      const example=e.target.closest('[data-wb-example]');if(example){field.value=example.dataset.wbExample;apply();}
      if(e.target.closest('[data-wb-use]')){if(!valid||!signal){message('请先成功应用有效公式。',true);return;}options.onUse?.({source,domain,model:clone(model),signal});}
      if(e.target.closest('[data-wb-copy]')){if(!valid||!source){message('请先应用有效公式，避免复制旧结果。',true);return;}const text=source;if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(()=>{if(!destroyed)message('当前有效公式已复制。');},()=>{if(!destroyed){field.focus();field.select();message('请复制选中的表达式。');}});else{field.focus();field.select();message('请复制选中的表达式。');}}
    }
    function change(e){if(e.target.matches('[data-wb-domain]')){if(options.lockDomain){e.target.value=domain;return;}domain=e.target.value==='dt'?'dt':'ct';field.value=domain==='dt'?'delta[n]-delta[n-2]':'u(t)-u(t-2)';apply();}}
    host.addEventListener('input',input);host.addEventListener('click',click);host.addEventListener('change',change);examples();
    if(options.model){try{field.value=window.WaveformExpressions.toExpression(options.model);}catch(e){message(e.message,true);}}else field.value=String(options.source|| (domain==='dt'?'delta[n]-delta[n-2]':'u(t)-u(t-2)'));
    apply();
    return {getSignal(){if(!valid||!signal)throw new Error('公式或波形草稿尚未有效应用。');return signal;},getSource(){if(!valid)throw new Error('公式草稿尚未应用。');return source;},getModel(){if(!valid||!model)throw new Error('当前不是有效的有限可编辑模型。');return clone(model);},getState:()=>({domain,source,valid,editable:!!model,model:clone(model),mode:model?'finite':'plot-only',editor:editor?.getDiagnostics?.()||null}),setSource(text,nextDomain=domain){if(options.lockDomain&&nextDomain!==domain){message('当前实验锁定时间类型，请先切换实验类型。',true);return false;}domain=nextDomain==='dt'?'dt':'ct';field.value=String(text);return apply();},destroy(){if(destroyed)return;destroyed=true;destroyViews();host.removeEventListener('input',input);host.removeEventListener('click',click);host.removeEventListener('change',change);host.replaceChildren();}};
  }
  window.WaveformWorkbench=Object.freeze({mount});
})();
