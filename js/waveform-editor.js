/* Editable finite signal model. Images, recognition and assessment live elsewhere. */
(function(){
  'use strict';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=value=>JSON.parse(JSON.stringify(value));
  // Editable endpoints must round-trip exactly. Rounding adjacent 2/3 bounds
  // in the table can manufacture an overlap when the next field is edited.
  const fmt=v=>Number.isFinite(v)?String(v):'';
  function mount(host,options={}){
    const domain=options.domain==='dt'?'dt':'ct',range={xmin:-4,xmax:8,ymin:-3,ymax:4,...options.range},step=options.axisStep||{x:1,y:1};
    let model={version:1,domain,segments:[],samples:[],impulses:[],outside:0,endpoints:[]},readonly=false,destroyed=false,drag=null,issues=[],expected=null,draftValid=true;
    host.innerHTML=`<div class="wave-editor"><div class="wave-editor-toolbar"><strong>${domain==='dt'?'离散采样值':'分段线性信号'}</strong><label><input type="checkbox" data-we-snap checked>拖动吸附刻度</label><button class="btn btn-sm" type="button" data-we-add>${domain==='dt'?'添加采样点':'添加线段'}</button><button class="btn btn-sm" type="button" data-we-zero>明确设为零信号</button></div><p class="small muted">拖动圆点或编辑下表。${domain==='dt'?'每个 n 必须为整数；未列出的整数采样为0，不连接成连续折线。':'相邻线段可在同一时刻具有不同幅度，表示跳变；未绘制的区间为0。'}</p><svg class="wave-edit-svg" viewBox="0 0 600 280" role="img" aria-label="可编辑的答案波形；也可通过下方表格输入坐标"></svg><div class="wave-table-scroll"><table class="wave-point-table"><thead></thead><tbody></tbody></table></div><p class="wave-editor-error" data-we-error role="status"></p><details><summary>缩放、拖动与坐标读数</summary><div data-we-plot></div></details></div>`;
    const svg=host.querySelector('svg'),body=host.querySelector('tbody'),head=host.querySelector('thead'),error=host.querySelector('[data-we-error]');
    const X=x=>42+(x-range.xmin)/(range.xmax-range.xmin)*538,Y=y=>242-(y-range.ymin)/(range.ymax-range.ymin)*220;
    const fromPoint=e=>{const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const v=p.matrixTransform(svg.getScreenCTM().inverse());return{x:range.xmin+(v.x-42)/538*(range.xmax-range.xmin),y:range.ymin+(242-v.y)/220*(range.ymax-range.ymin)};};
    const plot=window.SignalPlot.mount(host.querySelector('[data-we-plot]'),{domain,title:'答案波形：缩放与坐标检查',range});
    if(options.comparisonScope==='window')host.querySelector('.wave-editor>p').textContent='拖动圆点或编辑下表。仅描述题目观察窗内的分段；窗内省略处为0，窗外不推断。';
    function plotSignal(value){const signal=window.WaveformMath.toSignal(value);return options.comparisonScope==='window'?{...signal,evaluate:x=>x<range.xmin||x>range.xmax?NaN:signal.evaluate(x)}:signal;}
    function path(m,color,dashed=false){
      if(m.domain==='dt')return (m.samples||[]).map(p=>`<path d="M${X(p.n)} ${Y(0)}V${Y(p.value)}" stroke="${color}"/><circle cx="${X(p.n)}" cy="${Y(p.value)}" r="3" fill="${color}"/>`).join('');
      return (m.segments||[]).map(s=>`<path d="M${X(s.start)} ${Y(s.y0)}L${X(s.end)} ${Y(s.y1)}" stroke="${color}" stroke-width="2.5" fill="none" ${dashed?'stroke-dasharray="7 4"':''}/>`).join('');
    }
    function draw(){
      if(destroyed)return;let grid='';
      for(let x=Math.ceil(range.xmin);x<=range.xmax&&x<=range.xmin+24;x++){grid+=`<path d="M${X(x)} 20V242" class="we-grid"/><text x="${X(x)}" y="261" text-anchor="middle">${x}</text>`;}
      for(let y=Math.ceil(range.ymin);y<=range.ymax&&y<=range.ymin+16;y++){grid+=`<path d="M42 ${Y(y)}H580" class="we-grid"/><text x="34" y="${Y(y)+4}" text-anchor="end">${y}</text>`;}
      let handles='';if(!readonly){
        handles=domain==='ct'?model.segments.map((s,i)=>[[s.start,s.y0,0],[s.end,s.y1,1]].map(([x,y,end])=>`<circle class="we-handle" data-we-handle="${i}:${end}" cx="${X(x)}" cy="${Y(y)}" r="7"><title>线段${i+1}${end?'终点':'起点'} (${fmt(x)}, ${fmt(y)})</title></circle>`).join('')).join(''):model.samples.map((s,i)=>`<circle class="we-handle" data-we-handle="${i}:0" cx="${X(s.n)}" cy="${Y(s.value)}" r="7"><title>采样 (${s.n}, ${fmt(s.value)})</title></circle>`).join('');
      }
      const marks=issues.filter(i=>Number.isFinite(i.start)||Number.isFinite(i.n)).map(i=>{const a=i.start??i.n-.16,b=i.end??i.n+.16;return `<rect x="${X(Math.max(range.xmin,a))}" y="20" width="${Math.max(2,X(Math.min(range.xmax,b))-X(Math.max(range.xmin,a)))}" height="222" class="we-error-zone"/>`;}).join('');
      svg.innerHTML=`<defs><clipPath id="we-${serial}"><rect x="42" y="20" width="538" height="222"/></clipPath></defs>${grid}<path d="M42 ${Y(0)}H580M${X(0)} 20V242" class="we-axis"/><text x="577" y="277">${domain==='dt'?'n':'t'}</text><g clip-path="url(#we-${serial})">${marks}${expected?path(expected,'var(--blue)',true):''}${path(model,'var(--teal)')}${handles}</g>`;
      const series=[{signal:plotSignal(model),name:'我的答案',color:'#149c96'}];if(expected)series.push({signal:plotSignal(expected),name:'标准答案',color:'#3267e9'});plot.setSeries(series);
    }
    const serial=++mount.serial;
    function table(){
      head.innerHTML=domain==='ct'?'<tr><th>起始 t</th><th>结束 t</th><th>起始幅度</th><th>结束幅度</th><th>端点</th><th>编辑</th></tr>':'<tr><th>整数 n</th><th>幅度</th><th>编辑</th></tr>';
      const fields=domain==='ct'?['start','end','y0','y1']:['n','value'],rows=domain==='ct'?model.segments:model.samples;
      body.innerHTML=rows.map((row,i)=>`<tr>${fields.map(key=>`<td><input aria-label="第${i+1}行 ${key}" data-we-row="${i}" data-we-field="${key}" value="${esc(fmt(row[key]))}" inputmode="decimal" ${readonly?'disabled':''}></td>`).join('')}${domain==='ct'?`<td><select aria-label="第${i+1}行右端点" data-we-end="${i}" ${readonly?'disabled':''}><option value="open" ${row.rightClosed!==true?'selected':''}>右开</option><option value="closed" ${row.rightClosed===true?'selected':''}>右闭</option></select></td>`:''}<td>${domain==='ct'?`<button type="button" class="text-link" data-we-split="${i}" ${readonly?'disabled':''}>拆段</button>`:''}<button type="button" class="text-link" data-we-remove="${i}" ${readonly?'disabled':''}>删除</button></td></tr>`).join('');
      host.querySelectorAll('[data-we-add],[data-we-zero],[data-we-snap]').forEach(n=>n.disabled=readonly);
    }
    function changed(next,notify=true){
      try{model=window.WaveformMath.normalize(next);draftValid=true;error.textContent='';issues=[];expected=null;table();draw();if(notify)options.onChange?.(clone(model));return true;}
      catch(e){invalid(e.message);return false;}
    }
    function invalid(message){draftValid=false;error.textContent=message;options.onInvalid?.(message);}
    function input(e){if(e.target.hasAttribute('data-we-field'))invalid('正在编辑坐标；完成输入并离开此输入框后再确认。');}
    function focusout(e){if(!draftValid&&e.target.hasAttribute('data-we-field'))change(e);}
    function change(e){
      if(readonly||!e.target.hasAttribute('data-we-field')&&!e.target.hasAttribute('data-we-end'))return;
      // Read the entire visible draft, not just the last changed field. Otherwise
      // leaving an unchanged neighbour could silently restore an invalid cell
      // from the previous model and allow an answer the learner did not submit.
      const next=clone(model),rows=domain==='ct'?next.segments:next.samples;
      try{for(const node of body.querySelectorAll('[data-we-row][data-we-field]'))rows[+node.dataset.weRow][node.dataset.weField]=window.Assessment.number(node.value);for(const node of body.querySelectorAll('[data-we-end]'))next.segments[+node.dataset.weEnd].rightClosed=node.value==='closed';changed(next);}catch(err){invalid(err.message);}
    }
    function click(e){
      if(readonly)return;const add=e.target.closest('[data-we-add]'),zero=e.target.closest('[data-we-zero]'),remove=e.target.closest('[data-we-remove]'),split=e.target.closest('[data-we-split]'),next=clone(model);
      if(zero){next.segments=[];next.samples=[];changed(next);}
      if(add){if(domain==='ct'){if(next.segments.length>=40){error.textContent='本版最多40个线段，请合并多余段。';return;}const start=next.segments.at(-1)?.end??Math.max(0,range.xmin);next.segments.push({start,end:start+(step.x||1),y0:1,y1:1,leftClosed:true,rightClosed:false});}else{const occupied=new Set(next.samples.map(s=>s.n));let n=Math.ceil(range.xmin);while(occupied.has(n))n++;next.samples.push({n,value:1});}changed(next);}
      if(remove){next[domain==='ct'?'segments':'samples'].splice(+remove.dataset.weRemove,1);changed(next);}
      if(split){const i=+split.dataset.weSplit,s=next.segments[i],middle=(s.start+s.end)/2,y=(s.y0+s.y1)/2;next.segments.splice(i,1,{...s,end:middle,y1:y,rightClosed:false},{...s,start:middle,y0:y,leftClosed:true});changed(next);}
    }
    function down(e){if(readonly)return;const handle=e.target.closest('[data-we-handle]');let chosen;if(handle){const [index,end]=handle.dataset.weHandle.split(':').map(Number);chosen={index,end};}else{const matrix=svg.getScreenCTM(),rows=domain==='dt'?model.samples.flatMap((s,index)=>[{x:s.n,y:s.value,index,end:0}]):model.segments.flatMap((s,index)=>[{x:s.start,y:s.y0,index,end:0},{x:s.end,y:s.y1,index,end:1}]);let best=22;for(const row of rows){const p=svg.createSVGPoint();p.x=X(row.x);p.y=Y(row.y);const at=p.matrixTransform(matrix),distance=Math.hypot(at.x-e.clientX,at.y-e.clientY);if(distance<best){best=distance;chosen=row;}}}if(!chosen)return;drag={index:chosen.index,end:chosen.end,id:e.pointerId};svg.setPointerCapture(e.pointerId);e.preventDefault();}
    function move(e){if(!drag||e.pointerId!==drag.id)return;const p=fromPoint(e),next=clone(model),snap=host.querySelector('[data-we-snap]').checked;let x=Math.max(range.xmin,Math.min(range.xmax,p.x)),y=Math.max(range.ymin,Math.min(range.ymax,p.y));if(snap){x=Math.round(x/(step.x||1))*(step.x||1);y=Math.round(y/(step.y||1))*(step.y||1);}if(domain==='dt'){const s=next.samples[drag.index],before=next.samples[drag.index-1]?.n??Math.ceil(range.xmin)-1,after=next.samples[drag.index+1]?.n??Math.floor(range.xmax)+1;s.n=Math.max(before+1,Math.min(after-1,Math.round(x)));s.value=y;}else{const s=next.segments[drag.index];if(drag.end){s.end=Math.max(s.start+.01,x);s.y1=y;}else{s.start=Math.min(s.end-.01,x);s.y0=y;}}changed(next);e.preventDefault();}
    function up(){drag=null;}
    host.addEventListener('change',change);host.addEventListener('input',input);host.addEventListener('focusout',focusout);host.addEventListener('click',click);svg.addEventListener('pointerdown',down);svg.addEventListener('pointermove',move);svg.addEventListener('pointerup',up);svg.addEventListener('pointercancel',up);
    changed(options.model||model,false);
    return {getModel(){if(!draftValid)throw new Error(error.textContent||'坐标输入尚未通过校验');return clone(model);},isValid:()=>draftValid,setModel:(next,notify=false)=>changed(next,notify),setReadOnly(value){readonly=!!value;table();draw();},showComparison(target,problems=[]){expected=target?window.WaveformMath.normalize(target):null;issues=problems;draw();},destroy(){destroyed=true;plot.destroy();host.removeEventListener('change',change);host.removeEventListener('input',input);host.removeEventListener('focusout',focusout);host.removeEventListener('click',click);svg.removeEventListener('pointerdown',down);svg.removeEventListener('pointermove',move);svg.removeEventListener('pointerup',up);svg.removeEventListener('pointercancel',up);host.replaceChildren();}};
  }
  mount.serial=0;window.WaveformEditor=Object.freeze({mount});
})();
