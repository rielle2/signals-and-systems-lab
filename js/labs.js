(function () {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const C = ['#3478f6', '#ec8a2e', '#13a89e', '#a06ae8'];
  let cleanup = [];
  const fmt = (x, d = 2) => Number.isFinite(x) ? Number(x.toFixed(d)).toString() : '—';
  const esc = s => String(s).replace(/[&<>"']/g, a => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[a]));
  const pulse = t => t < 0 || t > 2 ? 0 : t < 1 ? t : (3 - t) / 2;
  const transformSignal = (kind,t) => kind==='rect'?(t>=0&&t<1?1:0):kind==='exp'?(t>=0?Math.exp(-t):0):kind==='step'?(t>=0?1:0):kind==='sine'?Math.sin(Math.PI*t):pulse(t);
  const input = t => Math.exp(-t * t / 2) * (1 + .5 * Math.sin(2 * t));
  function ctSignal(kind, t) { return t < 0 ? 0 : kind === 'rect' ? (t < 1 ? 1 : 0) : kind === 'exp' ? Math.exp(-t) : 1; }
  function dtSignal(kind, n) { return !Number.isInteger(n) || n < 0 ? 0 : kind === 'rect' ? (n < 4 ? 1 : 0) : kind === 'exp' ? Math.pow(.6, n) : 1; }
  function ctBounds(x, h, t) { return [Math.max(0, h === 'rect' ? t - 1 : 0), Math.min(t, x === 'rect' ? 1 : t)]; }
  function ctConvolution(x, h, t) {
    const [a,b] = ctBounds(x,h,t); if (b <= a) return 0;
    const lx = x === 'exp' ? 1 : 0, lh = h === 'exp' ? 1 : 0, k = lh - lx;
    if(k===0)return Math.exp(-lh*t)*(b-a);
    // Evaluate with nonpositive exponents so long causal tails cannot produce 0 * Infinity.
    return k===1?Math.exp(-(t-b))-Math.exp(-(t-a)):Math.exp(-a)-Math.exp(-b);
  }
  function dtConvolution(x, h, n) {
    if (!Number.isInteger(n) || n < 0) return 0;
    let y = 0; for (let k = 0; k <= n; k++) y += dtSignal(x,k) * dtSignal(h,n-k); return y;
  }
  const aliasFrequency = (f, fs) => Math.abs(((f + fs / 2) % fs + fs) % fs - fs / 2);
  function samplingSpectrum(f,fs,range) {
    const coeffs=new Map(),K=Math.ceil((range+f)/fs)+1;
    for(let k=-K;k<=K;k++)for(const sign of [-1,1]){const freq=k*fs+sign*f;if(Math.abs(freq)>range+1e-8)continue;const key=Math.round(freq*1e8)/1e8;coeffs.set(key,(coeffs.get(key)||0)-sign*.5);}
    return [...coeffs].map(([freq,imag])=>[freq,Math.abs(imag)]).filter(q=>q[1]>1e-10);
  }
  const sinc = v => Math.abs(v) < 1e-10 ? 1 : Math.sin(Math.PI*v)/(Math.PI*v);
  function harmonics(kind, count, amp) {
    const terms = [];
    for (let k=1; k<=count; k++) {
      if (kind === 'square' && k % 2) terms.push({k,b:4*amp/(Math.PI*k)});
      if (kind === 'saw') terms.push({k,b:2*amp*Math.pow(-1,k+1)/(Math.PI*k)});
      if (kind === 'triangle' && k % 2) terms.push({k,b:8*amp*Math.pow(-1,(k-1)/2)/(Math.PI*Math.PI*k*k)});
    }
    return terms;
  }
  function synth(kind, count, amp, f, t) { return harmonics(kind,count,amp).reduce((v,q)=>v+q.b*Math.sin(2*Math.PI*q.k*f*t),0); }
  function parseSystem(raw) {
    let s = raw.toLowerCase().replace(/\s/g,'').replace(/×|·/g,'*').replace(/²/g,'^2').replace(/^y\(t\)=/,'');
    if (s === 't*x(t)' || s === 'tx(t)') return {kind:'time',formula:'y(t) = t x(t)'};
    if (s === 'x(t)^2' || s === 'x^2(t)') return {kind:'square',formula:'y(t) = x²(t)'};
    let m=s.match(/^x\(t(?:([+-])((?:\d+(?:\.\d*)?|\.\d+)))?\)$/);
    if(m) { const d=m[1] ? (m[1]==='-'?1:-1)*Number(m[2]) : 0; return {kind:'delay',d,formula:'y(t) = x(t '+(d<0?'+':'−')+' '+fmt(Math.abs(d))+')'}; }
    m=s.match(/^x\(([+-]?(?:\d+(?:\.\d*)?|\.\d+))\*?t\)$/);
    if(m && Math.abs(Number(m[1]))<=10) return {kind:'scale',a:Number(m[1]),formula:'y(t) = x('+fmt(Number(m[1]))+'t)'};
    m=s.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\*?x\(t\)$/);
    if(m && Math.abs(Number(m[1]))<=100) return {kind:'gain',k:Number(m[1]),formula:'y(t) = '+fmt(Number(m[1]))+' x(t)'};
    if(s==='x(-t)') return {kind:'scale',a:-1,formula:'y(t) = x(−t)'};
    throw new Error('支持 x(t−2)、x(t+1)、t*x(t)、x(2t)、x(-t)、x(t)^2、3*x(t)；请使用半角符号。');
  }
  function systemAt(s, f, t) { return s.kind==='time'?t*f(t):s.kind==='square'?f(t)**2:s.kind==='delay'?f(t-s.d):s.kind==='scale'?f(s.a*t):s.k*f(t); }
  function properties(s) {
    const delay=s.kind==='delay', scale=s.kind==='scale', gain=s.kind==='gain';
    return {
      linear:s.kind!=='square', ti:delay||gain||s.kind==='square'||(scale&&s.a===1),
      causal:delay?s.d>=0:scale?s.a===1:true,
      stable:s.kind!=='time', memoryless:gain||s.kind==='time'||s.kind==='square'||(delay&&s.d===0)||(scale&&s.a===1),
      invertible:delay||(gain&&s.k!==0)||(scale&&s.a!==0)
    };
  }
  function poleModel(domain,p,z) {
    const cancelled = p === z;
    return {cancelled,stable:cancelled||(domain==='ct'?p<0:Math.abs(p)<1),
      response:v=>domain==='ct'?(v<0?0:(p-z)*Math.exp(p*v)):(v<0||!Number.isInteger(v)?0:v===0?1:(p-z)*Math.pow(p,v-1)),
      magnitude:w=>cancelled?1:domain==='ct'?Math.hypot(w,z)/Math.hypot(w,p):Math.hypot(Math.cos(w)-z,Math.sin(w))/Math.hypot(Math.cos(w)-p,Math.sin(w))};
  }
  function pairModel(domain,pr,pi,zr,zi) {
    pi=Math.abs(pi);zi=Math.abs(zi);
    const p2=pr*pr+pi*pi,z2=zr*zr+zi*zi,a=2*(pr-zr),b=z2-p2,d=b+a*pr;
    const cancelled=pr===zr&&pi===zi,stable=cancelled||(domain==='ct'?pr<0:Math.hypot(pr,pi)<1),cache=[1,2*pr-2*zr];
    function response(v) {
      if(v<0)return 0;
      if(domain==='ct')return cancelled?0:Math.exp(pr*v)*(a*Math.cos(pi*v)+(pi===0?d*v:d*Math.sin(pi*v)/pi));
      if(!Number.isInteger(v))return 0;
      for(let n=cache.length;n<=v;n++)cache[n]=2*pr*cache[n-1]-p2*cache[n-2]+(n===2?z2:0);
      return cache[v];
    }
    function step(v) {
      if(v<0)return 0;
      if(domain==='dt'){let y=0;for(let n=0;n<=Math.floor(v);n++)y+=response(n);return y;}
      if(cancelled)return 1;
      if(Math.hypot(pr,pi)*v<.05){
        // Integrate the convergent Taylor solution near a zero/repeated pole without subtracting nearly equal numbers.
        let sum=0,prev=a,cur=a*pr+d,power=v,fact=1;
        for(let k=0;k<18;k++){let derivative;if(k===0)derivative=a;else if(k===1)derivative=cur;else{const next=2*pr*cur-p2*prev;prev=cur;cur=next;derivative=next;}fact*=k+1;sum+=derivative*power/fact;power*=v;}
        return 1+sum;
      }
      if(pi===0){
        if(pr===0)return 1+a*v+d*v*v/2;
        const q=pr*v,It=Math.abs(q)<1e-4?v*v*(.5+q/3+q*q/8+q*q*q/30):(Math.exp(q)*(q-1)+1)/(pr*pr);
        return 1+a*Math.expm1(q)/pr+d*It;
      }
      const co=Math.cos(pi*v),si=Math.sin(pi*v),c=d/pi;
      return 1+(Math.exp(pr*v)*(a*(pr*co+pi*si)+c*(pr*si-pi*co))-(a*pr-c*pi))/p2;
    }
    return {cancelled,stable,response,step,
      magnitude:w=>cancelled?1:domain==='ct'?Math.hypot(z2-w*w,-2*zr*w)/Math.hypot(p2-w*w,-2*pr*w):Math.hypot(Math.cos(2*w)-2*zr*Math.cos(w)+z2,Math.sin(2*w)-2*zr*Math.sin(w))/Math.hypot(Math.cos(2*w)-2*pr*Math.cos(w)+p2,Math.sin(2*w)-2*pr*Math.sin(w)),
      coefficients:{den:[1,-2*pr,p2],num:[1,-2*zr,z2],a,b,d}};
  }
  window.LabMath = {pulse,transformSignal,ctSignal,dtSignal,ctConvolution,dtConvolution,aliasFrequency,samplingSpectrum,sinc,harmonics,synth,parseSystem,systemAt,properties,poleModel,pairModel};
  function style() {
    if(document.getElementById('lab-styles'))return;
    const el=document.createElement('style'); el.id='lab-styles'; el.textContent=`
      .lab-workspace{display:grid;gap:18px}.lab-workspace .card{min-width:0}.lab-intro{margin:0;color:var(--muted);line-height:1.8}.lab-controls{display:flex;align-items:end;gap:16px;flex-wrap:wrap}.lab-controls label{display:grid;gap:7px;flex:1 1 150px;font-size:.87rem;color:var(--muted)}.lab-controls input[type=range]{width:100%;accent-color:var(--blue);min-height:24px}.lab-controls select,.lab-controls input[type=text],.lab-controls input[type=number]{background:var(--surface2);color:var(--text);border:1px solid var(--border);border-radius:9px;padding:10px;min-width:0;font:inherit}.lab-controls input[type=text]{width:100%}.lab-controls button{white-space:nowrap}.lab-presets{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.lab-presets .btn{font-size:.83rem;padding:8px 12px}.lab-plots{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.lab-plot{border:1px solid var(--border);border-radius:13px;padding:13px;background:var(--surface);min-width:0}.lab-plot h3{font-size:.91rem;margin:0 0 8px}.lab-svg{width:100%;height:auto;display:block;overflow:hidden;touch-action:pan-y}.lab-note{background:var(--surface2);padding:14px 16px;border-radius:11px;line-height:1.8;font-size:.91rem;margin:0}.lab-note strong{color:var(--text)}.lab-legend{display:flex;gap:16px;flex-wrap:wrap;font-size:.77rem;color:var(--muted);margin-top:4px}.lab-legend span:before{content:'';display:inline-block;width:14px;height:3px;background:var(--legend);vertical-align:middle;margin-right:5px}.lab-status{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.lab-status span{padding:5px 10px;border-radius:7px;font-size:.8rem;background:var(--surface2)}.lab-good{color:#0c917a}.lab-bad{color:#dc6a39}.lab-stage{display:flex;gap:8px;flex-wrap:wrap;font-size:.78rem;margin:12px 0}.lab-stage span{padding:6px 10px;border:1px solid var(--border);border-radius:20px}.lab-stage .active{border-color:var(--blue);color:var(--blue);background:color-mix(in srgb,var(--blue) 8%,transparent)}.lab-math{font-family:Cambria,'Times New Roman',serif;font-size:1.12rem;color:var(--text)}.lab-pole-svg{touch-action:none}.lab-error{color:#c64d39;font-size:.85rem;min-height:1.5em}.lab-caption{font-size:.78rem;color:var(--muted);line-height:1.6;margin:6px 0 0}.lab-check-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.lab-check-grid span{background:var(--surface2);padding:8px;border-radius:8px;font-size:.82rem}.lab-workspace .btn:focus-visible,.lab-workspace input:focus-visible,.lab-workspace select:focus-visible{outline:3px solid #79a8ff;outline-offset:3px}@media(max-width:760px){.lab-plots{grid-template-columns:1fr}.lab-controls{gap:12px}.lab-check-grid{grid-template-columns:repeat(2,1fr)}.lab-plot{padding:10px}}`;
    el.textContent+='@media(min-width:761px) and (max-width:1100px){.lab-plots{grid-template-columns:1fr}}';
    document.head.append(el);
  }
  function chart(target,series,opt={}) {
    const visibleWidth=target.getBoundingClientRect().width||640, font=Math.max(11,Math.min(24,11*640/visibleWidth));
    const W=640,H=290,P={l:Math.max(50,font*3.5),r:20,t:25,b:Math.max(33,font*1.8)},xTicks=visibleWidth<420?4:8;
    const xmin=opt.xmin??-4,xmax=opt.xmax??4,ymin=opt.ymin??-1.5,ymax=opt.ymax??1.5;
    const X=x=>P.l+(x-xmin)/(xmax-xmin)*(W-P.l-P.r),Y=y=>H-P.b-(y-ymin)/(ymax-ymin)*(H-P.t-P.b);
    const clip='lc'+Math.random().toString(36).slice(2);
    let out=`<svg class="lab-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opt.label||'信号图像')}"><defs><clipPath id="${clip}"><rect x="${P.l}" y="${P.t}" width="${W-P.l-P.r}" height="${H-P.t-P.b}"/></clipPath></defs>`;
    for(let i=0;i<=4;i++) {const y=ymin+(ymax-ymin)*i/4, label=Math.abs(y)>=1e4?y.toExponential(1):fmt(y,1);out+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(y)}" y2="${Y(y)}" stroke="var(--border)" opacity=".55"/><text x="${P.l-7}" y="${Y(y)+font*.35}" text-anchor="end" fill="var(--muted)" font-size="${font}">${label}</text>`;}
    for(let i=0;i<=xTicks;i++){const x=xmin+(xmax-xmin)*i/xTicks;out+=`<text x="${X(x)}" y="${H-9}" text-anchor="${i===xTicks?'end':'middle'}" fill="var(--muted)" font-size="${font}">${fmt(x,1)}</text>`;}
    out+=`<line x1="${P.l}" x2="${W-P.r}" y1="${Y(Math.max(ymin,Math.min(ymax,0)))}" y2="${Y(Math.max(ymin,Math.min(ymax,0)))}" stroke="var(--muted)" opacity=".65"/>`;
    if(xmin<=0&&xmax>=0)out+=`<line x1="${X(0)}" x2="${X(0)}" y1="${P.t}" y2="${H-P.b}" stroke="var(--muted)" opacity=".65"/>`;
    out+=`<g clip-path="url(#${clip})">`;
    if(opt.region) out+=`<rect x="${X(opt.region[0])}" y="${P.t}" width="${Math.max(0,X(opt.region[1])-X(opt.region[0]))}" height="${H-P.t-P.b}" fill="${C[2]}" opacity=".09"/>`;
    series.forEach((s,j)=>{
      const col=s.color||C[j%C.length], points=s.points||Array.from({length:601},(_,i)=>{const x=xmin+(xmax-xmin)*i/600;return [x,s.fn(x)];});
      if(s.stem) points.forEach(([x,y])=>{if(Number.isFinite(y))out+=`<line x1="${X(x)}" x2="${X(x)}" y1="${Y(0)}" y2="${Y(y)}" stroke="${col}" stroke-width="1.8"/><circle cx="${X(x)}" cy="${Y(y)}" r="3.1" fill="${col}"/>`;});
      else { const d=points.filter(q=>Number.isFinite(q[1])).map(([x,y],i)=>(i?'L':'M')+fmt(X(x),2)+' '+fmt(Y(y),2)).join(' ');out+=`<path d="${d}" stroke="${col}" fill="none" stroke-width="${s.width||2.2}" ${s.dash?'stroke-dasharray="6 5"':''}/>`; }
      if(s.fill){const d=`M${X(points[0][0])} ${Y(0)} `+points.map(([x,y])=>`L${X(x)} ${Y(y)}`).join(' ')+` L${X(points.at(-1)[0])} ${Y(0)} Z`;out+=`<path d="${d}" fill="${col}" opacity=".11"/>`;}
    });
    if(opt.cursor!=null)out+=`<line x1="${X(opt.cursor)}" x2="${X(opt.cursor)}" y1="${P.t}" y2="${H-P.b}" stroke="${C[3]}" stroke-dasharray="5 4" stroke-width="1.5"/>`;
    out+=`</g><text x="${W-P.r}" y="${font*.8}" text-anchor="end" fill="var(--muted)" font-size="${font}">${esc(opt.xlabel||'t')}</text></svg>`;
    if(series.some(s=>s.name))out+=`<div class="lab-legend">${series.filter(s=>s.name).map((s,j)=>`<span style="--legend:${s.color||C[j%C.length]}">${esc(s.name)}</span>`).join('')}</div>`;
    target.innerHTML=out;
  }
  function shell(c,html) { c.innerHTML=`<div class="lab-workspace">${html}</div>`; return q=>c.querySelector(q); }
  const plot=(id,title)=>`<div class="lab-plot"><h3>${title}</h3><div id="${id}"></div></div>`;
  function transform(c) {
    const $=shell(c,`<p class="lab-intro">把输入时间先变成 a t + b，再读取原波形的值。观察峰值与左右端点，可以分清平移、反转和压缩。</p><div class="card"><div class="lab-presets"><button class="btn" data-a="1" data-b="-2">x(t − 2)</button><button class="btn" data-a="2" data-b="0">x(2t)</button><button class="btn" data-a="-1" data-b="0">x(−t)</button><button class="btn" data-a="-1" data-b="2">x(2 − t)</button><button class="btn" data-a="1" data-b="0">重置</button></div><div class="lab-controls"><label>时间尺度 a <output id="av"></output><input id="a" type="range" min="-3" max="3" step=".1" value="1"></label><label>时间参数 b <output id="bv"></output><input id="b" type="range" min="-4" max="4" step=".1" value="0"></label><label>幅度 A <output id="Av"></output><input id="A" type="range" min="-2" max="2" step=".1" value="1"></label></div></div>${plot('transform-plot','原信号与变换结果')}<div class="lab-note" id="transform-note"></div>`);
    $('.lab-controls').insertAdjacentHTML('afterbegin','<label>原始信号<select id="transform-kind"><option value="pulse">非对称分段脉冲</option><option value="rect">单位矩形脉冲</option><option value="exp">因果指数 e⁻ᵗu(t)</option><option value="step">单位阶跃 u(t)</option><option value="sine">正弦 sin(πt)</option></select></label>');
    function draw(){const a=+$('#a').value,b=+$('#b').value,A=+$('#A').value,kind=$('#transform-kind').value,base=t=>transformSignal(kind,t); $('#av').textContent=fmt(a);$('#bv').textContent=fmt(b);$('#Av').textContent=fmt(A);
      chart($('#transform-plot'),[{fn:base,name:'原信号 x(t)',dash:true},{fn:t=>A*base(a*t+b),name:'变换 A x(a t + b)'}],{xmin:-6,xmax:6,ymin:-2.2,ymax:2.2});
      const anchor=kind==='rect'?[0,1]:kind==='step'?[0]:kind==='exp'?[0,1]:kind==='sine'?[0,.5,1]:[0,1,2],end=kind==='rect'?1:2;
      let support=A===0?'A=0，输出恒为零。':a===0?`a=0，输出为常数 A x(b)=${fmt(A*base(b))}，不再是时间轴的一一映射。`:`原波形在 s=${anchor.join('、')} 的特征移动到 t=${anchor.map(s=>fmt((s-b)/a)).join('、')}。`;
      if(A!==0&&a!==0)support+=kind==='pulse'||kind==='rect'?`变换后的支撑闭包为 [${fmt(Math.min(-b/a,(end-b)/a))}, ${fmt(Math.max(-b/a,(end-b)/a))}]。`:kind==='sine'?`正弦没有紧支撑；变换后的周期为 ${fmt(2/Math.abs(a))}。`:`信号无限延伸；非零部分位于 t ${a>0?'≥':'≤'} ${fmt(-b/a)}，图中只显示有限时间窗口。`;
      const definitions={pulse:'x(t)=t（0≤t<1），x(t)=(3−t)/2（1≤t≤2），其余为0。',rect:'x(t)=1（0≤t<1），其余为0。',exp:'x(t)=e⁻ᵗ（t≥0），其余为0；s=1 为衰减到 e⁻¹ 的时刻。',step:'x(t)=1（t≥0），其余为0；跳变点是最清楚的时间锚点。',sine:'x(t)=sin(πt)，原周期为2；s=0、0.5、1 分别为过零、正峰值、过零。'};
      $('#transform-note').innerHTML=`<div class="lab-math">y(t) = ${fmt(A)} x(${fmt(a)}t ${b<0?'−':'+'} ${fmt(Math.abs(b))})</div>${support}<br><strong>读图方法：</strong>求新图在 t 处的值，就回原图查 s = a t + b。a &lt; 0 表示反转；|a| &gt; 1 表示压缩。a ≠ 0 时也可写成 x(a(t + b/a))：先对 x(t) 作尺度变换，再整体平移 −b/a。<br><span class="muted">本例原波形：${esc(definitions[kind])} 端点单点取值不影响连续时间积分。</span>`;
    }
    c.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',draw)); c.querySelectorAll('[data-a]').forEach(e=>e.addEventListener('click',()=>{$('#a').value=e.dataset.a;$('#b').value=e.dataset.b;$('#A').value=1;draw();}));draw();
  }
  function systems(c) {
    const $=shell(c,`<p class="lab-intro">同一个延时，沿两条路径传递。图像给出一个具体输入的检验；最终性质由对任意输入、任意实数时刻成立的定义判断。</p><div class="card"><div class="lab-controls"><label>预设系统<select id="sys-preset"><option value="x(t-2)">延时：x(t − 2)</option><option value="t*x(t)">时变增益：t x(t)</option><option value="x(2t)">时间压缩：x(2t)</option><option value="x(t)^2">平方器：x²(t)</option></select></label><label>输入表达式（受限安全语法）<input type="text" id="sys-expression" value="x(t-2)" spellcheck="false"></label><button class="btn btn-primary" id="sys-apply">应用系统</button><label>检验延时 t₀ <output id="sys-delay-value"></output><input id="sys-delay" type="range" min="-2" max="2" step=".1" value="1"></label></div><div class="lab-error" id="sys-error" role="status"></div><div id="sys-classification" class="lab-check-grid"></div></div><div class="lab-plots">${plot('sys-input','① 输入 x(t) 与输出 T{x}(t)')}${plot('sys-ti','② 时不变性：两条路径叠加')}${plot('sys-linear','③ 线性：T{2x₁ − x₂} 与 2T{x₁} − T{x₂}')}${plot('sys-causal','④ 因果性：过去相同、未来不同的两种输入')}</div><div class="lab-note" id="sys-note"></div>`);
    let s=parseSystem('x(t-2)');
    function draw(){const d=+$('#sys-delay').value,p=properties(s);$('#sys-delay-value').textContent=fmt(d);
      const path1=t=>systemAt(s,v=>input(v-d),t),path2=t=>systemAt(s,input,t-d),x2=t=>Math.cos(t)*Math.exp(-t*t/6),lin1=t=>systemAt(s,v=>2*input(v)-x2(v),t),lin2=t=>2*systemAt(s,input,t)-systemAt(s,x2,t);
      chart($('#sys-input'),[{fn:input,name:'x(t)'},{fn:t=>systemAt(s,input,t),name:'T{x}(t)'}],{xmin:-5,xmax:5,ymin:-2,ymax:2});
      chart($('#sys-ti'),[{fn:path1,name:'先延时输入：T{x(t − t₀)}'},{fn:path2,name:'先过系统：(Tx)(t − t₀)',dash:true}],{xmin:-5,xmax:5,ymin:-3,ymax:3});
      chart($('#sys-linear'),[{fn:lin1,name:'先线性组合，再过系统'},{fn:lin2,name:'分别过系统，再线性组合',dash:true}],{xmin:-5,xmax:5,ymin:-4,ymax:5});
      // For any noncausal preset choose an output instant whose requested input is in the future.
      const ttest=s.kind==='scale'&&s.a<1?-1:1, boundary=ttest, past=t=>input(t),future=t=>input(t)+(t>boundary?.8*(1-Math.exp(-(t-boundary))):0);
      chart($('#sys-causal'),[{fn:t=>systemAt(s,past,t),name:'输入一对应输出'},{fn:t=>systemAt(s,future,t),name:'输入二对应输出',dash:true}],{xmin:-4,xmax:4,ymin:-2,ymax:3,cursor:boundary});
      const labels={linear:'线性',ti:'时不变',causal:'因果',stable:'BIBO 稳定',memoryless:'无记忆',invertible:'可逆'};$('#sys-classification').innerHTML=Object.keys(labels).map(k=>`<span class="${p[k]?'lab-good':'lab-bad'}">${p[k]?'✓':'✕'} ${labels[k]}</span>`).join('');
      let err=0;for(let t=-5;t<=5;t+=.025)err=Math.max(err,Math.abs(path1(t)-path2(t)));
      const reason=s.kind==='time'?'T{x(t−t₀)} = t x(t−t₀)，但 (Tx)(t−t₀) = (t−t₀)x(t−t₀)。系数差 t₀，所以不是时不变系统。':s.kind==='scale'?`两条路径分别为 x(${fmt(s.a)}t−t₀) 与 x(${fmt(s.a)}t−${fmt(s.a)}t₀)。只有 a=1 时对任意输入和延时相等。`:s.kind==='square'?'两条路径都为 x²(t−t₀)，故平方器时不变；但平方不满足叠加，所以非线性。':s.kind==='delay'?`两条路径都为 x(t−t₀−${fmt(s.d)})，故任意输入与任意延时均成立。`:'常数增益可与平移、线性组合交换，故系统既线性又时不变。';
      const cause=s.kind==='delay'?`输出在 t 读取输入 t−${fmt(s.d)}，${p.causal?'不会使用未来值。':'需要未来值，因此非因果。'}`:s.kind==='scale'?`输出读取 x(${fmt(s.a)}t)。在整个实数时间轴上，只有 a=1 才始终满足 at≤t；其他 a 均存在使用未来输入的时刻。`:'输出只使用当前输入值，因此因果且无记忆。';
      $('#sys-note').innerHTML=`<strong>${esc(s.formula)}</strong><br>${reason}<br>本次输入、绘图区间内两路径最大采样差：${fmt(err,5)}。<strong>差值为零只是一组实验，不能代替全称证明。</strong><br>${cause}<br>因果图的两输入在虚线时刻 t*=${boundary} 及之前完全相同，之后不同；查看 t≤t* 的输出是否出现差别。BIBO 的时间范围为全部实数：t x(t) 对有界输入 x(t)=1 产生无界输出。平方器对每个有界输入仍输出有界，故 BIBO 稳定。`;
    }
    function apply(){try{s=parseSystem($('#sys-expression').value.replace(/−/g,'-'));$('#sys-error').textContent='';draw();}catch(e){$('#sys-error').textContent=e.message;}}
    $('#sys-preset').addEventListener('change',()=>{$('#sys-expression').value=$('#sys-preset').value;apply();});$('#sys-apply').addEventListener('click',apply);$('#sys-expression').addEventListener('keydown',e=>{if(e.key==='Enter')apply();});$('#sys-delay').addEventListener('input',draw);draw();
  }
  function convolution(c) {
    const choices=`<option value="rect">矩形</option><option value="exp">因果指数</option><option value="step">单位阶跃</option>`;
    const $=shell(c,`<p class="lab-intro">移动的是 h(t−τ)，积分变量是 τ。每个时刻的重叠乘积面积或求和，就是下方结果曲线上对应的一点。</p><div class="card"><div class="lab-controls"><label>时间类型<select id="conv-domain"><option value="ct">连续时间：积分</option><option value="dt">离散时间：求和</option></select></label><label>输入 x<select id="conv-x">${choices}</select></label><label>响应 h<select id="conv-h">${choices}</select></label><label>扫描时刻 <output id="conv-time-value"></output><input id="conv-time" type="range" min="-1" max="7" step=".05" value=".5"></label><label>播放速度<select id="conv-speed"><option value=".5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label></div><div class="lab-presets"><button class="btn btn-primary" id="conv-play">播放</button><button class="btn" id="conv-prev">上一帧</button><button class="btn" id="conv-next">下一帧</button><button class="btn" id="conv-reset">回到起点</button></div><div class="lab-stage"><span>① 翻转 h(−τ)</span><span>② 平移 h(t−τ)</span><span>③ 重叠</span><span>④ 相乘</span><span>⑤ 积分 / 求和</span></div></div><div class="lab-plots">${plot('conv-flip','① 原响应与时间翻转')}${plot('conv-overlap','②③ 输入与平移后的响应')}${plot('conv-product','④ 逐点乘积')}${plot('conv-result','⑤ 卷积结果（整条曲线已计算）')}</div><div class="lab-note" id="conv-note"></div>`);
    $('#conv-h').value='exp';let timer=null;
    const stop=()=>{if(timer)clearInterval(timer);timer=null;const button=$('#conv-play');if(button)button.textContent='播放';};cleanup.push(stop);
    function draw(){const dt=$('#conv-domain').value==='dt',x=$('#conv-x').value,h=$('#conv-h').value,t=+$('#conv-time').value;$('#conv-time-value').textContent=(dt?'n = ':'t = ')+fmt(t);
      const sf=dt?dtSignal:ctSignal,conv=dt?dtConvolution:ctConvolution,lo=dt?-5:-2,hi=dt?18:8;
      const data=f=>dt?{points:Array.from({length:hi-lo+1},(_,i)=>[lo+i,f(lo+i)]),stem:true}:{fn:f};
      const opt={xmin:lo,xmax:hi,ymin:-.15,ymax:1.25,xlabel:dt?'k':'τ'};
      chart($('#conv-flip'),[{...data(v=>sf(h,v)),name:'h(τ / k)'},{...data(v=>sf(h,-v)),name:'h(−τ / −k)',dash:true}],opt);
      const bounds=dt?[Math.max(0,h==='rect'?t-3:0),Math.min(t,x==='rect'?3:t)]:ctBounds(x,h,t);
      chart($('#conv-overlap'),[{...data(v=>sf(x,v)),name:'x(τ / k)'},{...data(v=>sf(h,t-v)),name:dt?'h[n−k]':'h(t−τ)'}],{...opt,region:bounds});
      chart($('#conv-product'),[{...data(v=>sf(x,v)*sf(h,t-v)),name:dt?'x[k] h[n−k]':'x(τ) h(t−τ)',color:C[2],fill:!dt}],{...opt,region:bounds});
      const maxY=Math.max(1,...Array.from({length:121},(_,i)=>conv(x,h,dt?Math.round(i*18/120):i*7/120)))*1.12;
      chart($('#conv-result'),[{...(dt?{points:Array.from({length:21},(_,n)=>[n-2,conv(x,h,n-2)]),stem:true}:{fn:v=>conv(x,h,v)}),name:'y = x ∗ h',color:C[3]},{points:[[t,conv(x,h,t)]],stem:true,color:C[1],name:'当前输出'}],{xmin:dt?-2:-1,xmax:dt?18:7,ymin:-.15,ymax:maxY,cursor:t,xlabel:dt?'n':'t'});
      const signalDef=dt?'矩形：1（0≤n≤3）；指数：(0.6)ⁿu[n]；阶跃：u[n]。':'矩形：1（0≤t&lt;1）；指数：e⁻ᵗu(t)；阶跃：u(t)。';
      $('#conv-note').innerHTML=`<div class="lab-math">${dt?'y[n] = Σₖ x[k] h[n−k]':'y(t) = ∫₋∞⁺∞ x(τ) h(t−τ) dτ'} = ${fmt(conv(x,h,t),5)}</div>${signalDef}<br>${dt?'所有信号均因果，固定 n≥0 时只有 k=0,…,n 可能非零；本图逐项精确求和，没有把无限长序列截成短序列。':'所有信号均因果，固定 t≥0 时积分只需 τ∈[0,t]；矩形再缩小重叠区间。曲线由指数积分的解析式计算，无任意尾部截断。'}<br>当前非零重叠${bounds[1]<bounds[0]?'为空。':`在 [${fmt(bounds[0])}, ${fmt(bounds[1])}] 内${dt?'的整数点':'（端点单点不影响积分）'}。`} ${x==='step'&&h==='step'?'两个阶跃的卷积虽然随时间增长，但对每个有限时刻都有有限值；“卷积存在”不等于“输出有界”。':''}`;
    }
    function frame(dir=1){const e=$('#conv-time'),step=$('#conv-domain').value==='dt'?1:.1;let v=+e.value+dir*step;e.value=Math.min(+e.max,Math.max(+e.min,v));draw();if(v>=+e.max&&dir>0)stop();}
    $('#conv-domain').addEventListener('change',()=>{stop();const dt=$('#conv-domain').value==='dt',e=$('#conv-time');e.min=dt?-2:-1;e.max=dt?16:7;e.step=dt?1:.05;e.value=0;draw();});
    ['#conv-x','#conv-h'].forEach(id=>$(id).addEventListener('change',draw));$('#conv-time').addEventListener('input',draw);$('#conv-play').addEventListener('click',()=>{if(timer){stop();return;}if(+$('#conv-time').value>=+$('#conv-time').max)$('#conv-time').value=$('#conv-time').min;$('#conv-play').textContent='暂停';timer=setInterval(()=>frame(),160/(+$('#conv-speed').value));});$('#conv-speed').addEventListener('change',()=>{if(timer){stop();$('#conv-play').click();}});$('#conv-prev').addEventListener('click',()=>{stop();frame(-1);});$('#conv-next').addEventListener('click',()=>{stop();frame();});$('#conv-reset').addEventListener('click',()=>{stop();$('#conv-time').value=$('#conv-time').min;draw();});draw();
  }
  function fourier(c) {
    const $=shell(c,`<p class="lab-intro">将正弦谐波逐项相加，观察波形如何形成。这里研究周期信号的傅里叶级数；离散谱线与非周期信号的连续傅里叶变换要区分。</p><div class="card"><div class="lab-controls"><label>周期波形<select id="fourier-kind"><option value="square">方波</option><option value="saw">锯齿波</option><option value="triangle">三角波</option></select></label><label>最高谐波阶数 K <output id="fourier-k-value"></output><input id="fourier-k" type="range" min="1" max="51" step="1" value="9"></label><label>基频 f₀ / Hz <output id="fourier-f-value"></output><input id="fourier-f" type="range" min=".5" max="3" step=".1" value="1"></label><label>幅度 A <output id="fourier-a-value"></output><input id="fourier-a" type="range" min=".2" max="2" step=".1" value="1"></label></div></div>${plot('fourier-wave','时域：目标波形与有限项合成')}<div class="lab-plots">${plot('fourier-mag','双边复指数系数幅度 |cₖ|')}${plot('fourier-phase','系数相位 arg(cₖ) / rad')}</div><div class="lab-note" id="fourier-note"></div>`);
    function draw(){const kind=$('#fourier-kind').value,K=+$('#fourier-k').value,f=+$('#fourier-f').value,A=+$('#fourier-a').value,terms=harmonics(kind,K,A);['k','f','a'].forEach(k=>$('#fourier-'+k+'-value').textContent=$('#fourier-'+k).value);
      const target=t=>kind==='square'?A*Math.sign(Math.sin(2*Math.PI*f*t)):kind==='triangle'?2*A/Math.PI*Math.asin(Math.sin(2*Math.PI*f*t)):2*A*(f*t-Math.floor(f*t+.5));
      const samples=Math.max(1800,Math.ceil(40*K*f)), wave=t=>terms.reduce((v,q)=>v+q.b*Math.sin(2*Math.PI*q.k*f*t),0);
      chart($('#fourier-wave'),[{points:Array.from({length:samples+1},(_,i)=>{const t=-1+2*i/samples;return[t,target(t)]}),name:'目标周期信号',dash:true,color:C[1]},{points:Array.from({length:samples+1},(_,i)=>{const t=-1+2*i/samples;return[t,wave(t)]}),name:'谐波合成',color:C[0]}],{xmin:-1,xmax:1,ymin:-1.35*A,ymax:1.35*A,xlabel:'t / s'});
      const mag=[],phase=[];terms.forEach(q=>{mag.push([-q.k*f,Math.abs(q.b)/2],[q.k*f,Math.abs(q.b)/2]);phase.push([-q.k*f,Math.sign(q.b)*Math.PI/2],[q.k*f,-Math.sign(q.b)*Math.PI/2]);});
      const axis=Math.max(3,K)*f;chart($('#fourier-mag'),[{points:mag,stem:true,name:'|cₖ|（正负频率各一半）'}],{xmin:-axis-1,xmax:axis+1,ymin:0,ymax:A*.8,xlabel:'f / Hz'});chart($('#fourier-phase'),[{points:phase,stem:true,name:'非零系数相位',color:C[2]}],{xmin:-axis-1,xmax:axis+1,ymin:-Math.PI,ymax:Math.PI,xlabel:'f / Hz'});
      const formula=kind==='square'?'x_K(t) = (4A/π) Σ_{k≤K, k奇} sin(kω₀t)/k':kind==='saw'?'x_K(t) = (2A/π) Σ_{k=1}^K (−1)ᵏ⁺¹ sin(kω₀t)/k':'x_K(t) = (8A/π²) Σ_{k≤K, k奇} (−1)⁽ᵏ⁻¹⁾⁄² sin(kω₀t)/k²';
      let peak=0;for(let i=0;i<5000;i++)peak=Math.max(peak,Math.abs(wave(i/(5000*f))));
      $('#fourier-note').innerHTML=`<div class="lab-math">${formula}</div>ω₀ = 2πf₀；当前实际非零正弦项 ${terms.length} 项，最高允许阶数 K=${K}。若 x(t)=Σ cₖeʲᵏω₀ᵗ，而某项为 bₖ sin(kω₀t)，则 cₖ=bₖ/(2j)，c₋ₖ=cₖ*；零系数的相位无定义，故不绘出。<br>${kind==='triangle'?'三角波连续，系数按 1/k² 衰减；拐角处收敛较慢，但不存在跳变点处持续的吉布斯超调。':`跳变附近有吉布斯振荡。增加 K 会缩窄振荡区域，超调高度不趋于零；极限约为跳变高度的 8.95%，不是幅度 A 的 8.95%。当前密集采样估计峰值为 ${fmt(peak,4)}。在跳变处，级数收敛到左右极限的平均值。`}`;
    }
    c.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',draw));draw();
  }
  function sampling(c) {
    const $=shell(c,`<p class="lab-intro">蓝线是真实连续正弦，橙点是实际样本。采样点可能同时落在另一条低频正弦上，这就是采样无法区分的混叠。</p><div class="card"><div class="lab-controls"><label>原信号频率 f / Hz <output id="sample-f-value"></output><input id="sample-f" type="range" min="1" max="20" step=".5" value="5"></label><label>采样频率 fₛ / Hz <output id="sample-fs-value"></output><input id="sample-fs" type="range" min="2" max="60" step="1" value="18"></label><label>显示有限 sinc 重建<select id="sample-reconstruct"><option value="yes">显示（81 个样本）</option><option value="no">隐藏</option></select></label></div><div id="sample-status" class="lab-status"></div></div>${plot('sample-wave','连续波形、采样点和重建')}<div class="lab-plots">${plot('sample-spectrum','冲激采样频谱：复系数相加后的归一化幅度')}${plot('sample-alias','基带内可匹配采样点的混叠正弦')}</div><div class="lab-note" id="sample-note"></div>`);
    function draw(){const f=+$('#sample-f').value,fs=+$('#sample-fs').value,alias=aliasFrequency(f,fs),signed=((f+fs/2)%fs+fs)%fs-fs/2;$('#sample-f-value').textContent=fmt(f);$('#sample-fs-value').textContent=fmt(fs);
      const samples=Array.from({length:Math.ceil(fs)+1},(_,n)=>[n/fs,Math.sin(2*Math.PI*f*n/fs)]).filter(q=>q[0]<=1),recon=t=>{let y=0;const center=Math.floor(fs/2);for(let n=center-40;n<=center+40;n++)y+=Math.sin(2*Math.PI*f*n/fs)*sinc(fs*t-n);return y;};
      const series=[{fn:t=>Math.sin(2*Math.PI*f*t),name:'原始信号',color:C[0]},{points:samples,stem:true,name:'采样点',color:C[1]}];if($('#sample-reconstruct').value==='yes')series.push({fn:recon,name:'有限 sinc 插值',color:C[2],dash:true});
      chart($('#sample-wave'),series,{xmin:0,xmax:1,ymin:-1.5,ymax:1.5,xlabel:'t / s'});
      const range=Math.max(2*fs,2*f),replicas=samplingSpectrum(f,fs,range);
      chart($('#sample-spectrum'),[{points:replicas,stem:true,name:'谱线系数幅度 ÷ fₛ',color:C[0]}],{xmin:-range,xmax:range,ymin:0,ymax:.7,xlabel:'f / Hz',region:[-fs/2,fs/2]});
      chart($('#sample-alias'),[{fn:t=>Math.sin(2*Math.PI*signed*t),name:'混叠信号（含折叠相位符号）',color:C[3]},{points:samples,stem:true,name:'完全相同的样本',color:C[1]}],{xmin:0,xmax:1,ymin:-1.3,ymax:1.3,xlabel:'t / s'});
      const equality=Math.abs(fs-2*f)<1e-8,ok=fs>2*f;$('#sample-status').innerHTML=`<span class="${ok?'lab-good':'lab-bad'}">${ok?'✓ 严格满足 fₛ > 2f':equality?'临界采样：本例样本全为零':'出现频率折叠'}</span><span>奈奎斯特频率：${fmt(fs/2)} Hz</span><span>折叠频率：${fmt(alias)} Hz</span>`;
      $('#sample-note').innerHTML=`<div class="lab-math">x[n] = sin(2π ${fmt(f/fs,4)} n)；f<sub>alias</sub> = |((f + fₛ/2) mod fₛ) − fₛ/2| = ${fmt(alias)} Hz</div>对任意整数 n，原正弦和以带符号频率 ${fmt(signed)} Hz 构成的正弦具有相同样本；若折到负频率，需要保留相位反号。<br>对最高频率为 B 的理想带限信号，使用 fₛ &gt; 2B 可无混叠重建；在 fₛ=2B 的边界，不能对任意端点频率与相位保证恢复，本例 sin(πn)=0。<br>理想重建为 Σₙ x[n] sinc(fₛt−n)，需无限样本。这里截取以 n=⌊fₛ/2⌋ 为中心的 81 项，因此边界和截断误差是数值近似；混叠时它也不能找回原高频。实际冲激采样为 Xₛ(f)=fₛΣₖX(f−kfₛ)。频谱图覆盖所示频率范围的全部副本，系数先按复数相加，再取幅值并除以 fₛ；重合的相反虚系数会抵消（临界采样时此例所有谱线抵消）。`;
    }
    c.querySelectorAll('input,select').forEach(e=>e.addEventListener('input',draw));draw();
  }
  function poles(c) {
    const $=shell(c,`<p class="lab-intro">拖动实轴上的 × 极点和 ○ 零点，观察因果一阶系统的收敛域、频率响应与冲激响应。此实验严格限定实极点、实零点，以保持实系数模型。</p><div class="card"><div class="lab-controls"><label>系统类型<select id="pole-domain"><option value="ct">连续时间：s 平面</option><option value="dt">离散时间：z 平面</option></select></label><label>极点 p<input id="pole-p" type="number" min="-2" max="2" step=".05" value="-0.7"></label><label>零点 z₀<input id="pole-z" type="number" min="-2" max="2" step=".05" value="-1.4"></label></div><div id="pole-status" class="lab-status"></div><p class="lab-caption">在实轴上拖动，或用数字框精确输入。收敛域采用因果右边响应；不切换到反因果解释。</p></div><div class="lab-plots">${plot('pole-plane','极点、零点与因果收敛域（阴影）')}${plot('pole-response','冲激响应')}${plot('pole-frequency','频率响应的幅度')}${plot('pole-step','零状态单位阶跃响应')}</div><div class="lab-note" id="pole-note"></div>`);
    $('.lab-intro').textContent='拖动 × 极点与 ○ 零点，联系收敛域、响应和稳定性。先从一阶实根开始，再切换共轭对模式，在复平面中自由移动；共轭根同步变化，保持实系数与实响应。';
    $('.lab-controls').insertAdjacentHTML('afterbegin','<label>模型阶数<select id="pole-order"><option value="real">一阶：实极点、实零点</option><option value="pair">二阶：共轭极点、零点对</option></select></label>');
    $('.lab-controls').insertAdjacentHTML('beforeend','<label id="pole-pi-field" style="display:none">极点虚部 |Im p|<input id="pole-pi" type="number" min="0" max="2" step=".05" value=".7"></label><label id="pole-zi-field" style="display:none">零点虚部 |Im z₀|<input id="pole-zi" type="number" min="0" max="2" step=".05" value=".4"></label>');
    $('.card .lab-caption').textContent='一阶模式沿实轴拖动；共轭对模式可二维拖动任意一个根，其共轭根自动同步。也可用数字框精确输入。收敛域固定采用因果右边响应。';
    let domain='ct',p=-.7,z=-1.4,pi=.7,zi=.4,paired=false;
    const getModel=()=>paired?pairModel(domain,p,pi,z,zi):poleModel(domain,p,z);
    function plane(){const W=640,H=350,cx=320,cy=175,scale=65,X=v=>cx+scale*v,Y=v=>cy-scale*v;const model=getModel(),circleR=scale*(paired?Math.hypot(p,pi):Math.abs(p)),fontScale=Math.max(1,Math.min(2.2,640/($('#pole-plane').getBoundingClientRect().width||640)));
      let s=`<svg id="pole-svg" class="lab-svg lab-pole-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="可拖动的复平面极点零点图"><defs><clipPath id="pole-roi"><rect x="30" y="15" width="580" height="320"/></clipPath></defs><g clip-path="url(#pole-roi)">`;
      if(model.cancelled)s+=`<rect x="30" y="15" width="580" height="320" fill="${C[2]}" opacity=".1"/>`;
      else if(domain==='ct')s+=`<rect x="${X(p)}" y="15" width="${610-X(p)}" height="320" fill="${C[2]}" opacity=".12"/><line x1="${X(p)}" x2="${X(p)}" y1="15" y2="335" stroke="${C[2]}" stroke-dasharray="6 5"/>`;
      else s+=`<path d="M30 15H610V335H30Z M${cx-circleR} ${cy}a${circleR},${circleR} 0 1,0 ${2*circleR},0a${circleR},${circleR} 0 1,0 ${-2*circleR},0" fill="${C[2]}" fill-rule="evenodd" opacity=".12"/>`;
      for(let i=-4;i<=4;i++)s+=`<line x1="${X(i)}" x2="${X(i)}" y1="15" y2="335" stroke="var(--border)"/><text x="${X(i)}" y="${cy+20}" text-anchor="middle" fill="var(--muted)" font-size="11">${i}</text>`;
      for(let i=-2;i<=2;i++)if(i)s+=`<line x1="30" x2="610" y1="${Y(i)}" y2="${Y(i)}" stroke="var(--border)"/><text x="${cx+8}" y="${Y(i)-5}" fill="var(--muted)" font-size="11">${i}j</text>`;
      s+=`<line x1="30" x2="610" y1="${cy}" y2="${cy}" stroke="var(--muted)"/><line x1="${cx}" x2="${cx}" y1="15" y2="335" stroke="var(--muted)"/>`;
      if(domain==='dt')s+=`<circle cx="${cx}" cy="${cy}" r="${scale}" fill="none" stroke="${C[0]}" stroke-dasharray="5 4"/><text x="${cx+scale+5}" y="${cy-scale+12}" fill="${C[0]}" font-size="12">单位圆</text>`;
      const hit=20*fontScale,cursor=paired?'move':'ew-resize';
      function rootMark(key,re,im,conjugate=false){const xx=X(re),yy=Y(im),color=key==='p'?C[1]:C[3];return `<circle data-drag="${key}" cx="${xx}" cy="${yy}" r="${hit+(key==='p'?8:0)}" fill="transparent" style="cursor:${cursor}"/>`+(key==='p'?`<path d="M${xx-7} ${yy-7}L${xx+7} ${yy+7}M${xx-7} ${yy+7}L${xx+7} ${yy-7}" stroke="${color}" stroke-width="3" pointer-events="none"/>`:`<circle cx="${xx}" cy="${yy}" r="9" fill="var(--surface)" stroke="${color}" stroke-width="3" pointer-events="none"/>`)+(conjugate?'':`<text x="${xx}" y="${key==='p'?Math.max(42,yy-30):Math.min(310,yy+40)}" fill="${color}" text-anchor="middle" font-size="12" pointer-events="none">${key==='p'?'p':'z₀'}=${fmt(re)}${paired?' ± '+fmt(im)+'j':''}</text>`);}
      s+=rootMark('p',p,paired?pi:0)+rootMark('z',z,paired?zi:0);
      if(paired&&pi!==0)s+=rootMark('p',p,-pi,true);if(paired&&zi!==0)s+=rootMark('z',z,-zi,true);
      s+=`</g><text x="603" y="${cy-12}" fill="var(--muted)" font-size="12">Re</text><text x="${cx+12}" y="25" fill="var(--muted)" font-size="12">Im</text></svg>`;
      s=s.replace(/font-size="(\d+)"/g,(_,size)=>`font-size="${Number(size)*fontScale}"`);
      const caption=model.cancelled?'极零完全相消：H ≡ 1，收敛域为整个有限平面':domain==='ct'?'阴影：Re(s) > Re(p)（边界不属于 ROC）':'阴影：|z| > |p|（边界不属于 ROC）';
      const existing=$('#pole-svg');
      if(existing){existing.innerHTML=s.slice(s.indexOf('>')+1,-6);$('#pole-plane .lab-caption').textContent=caption;return;}
      $('#pole-plane').innerHTML=s+'<p class="lab-caption">'+caption+'</p>';const svg=$('#pole-svg');let dragging=null;
      svg.addEventListener('pointerdown',e=>{const item=e.target.closest('[data-drag]');if(!item)return;dragging=item.dataset.drag;svg.setPointerCapture(e.pointerId);e.preventDefault();});
      svg.addEventListener('pointermove',e=>{if(!dragging)return;const box=svg.getBoundingClientRect(),v=Math.max(-2,Math.min(2,((e.clientX-box.left)/box.width*640-cx)/scale)),iv=Math.max(0,Math.min(2,Math.abs((cy-(e.clientY-box.top)/box.height*350)/scale)));if(dragging==='p'){p=Math.round(v*100)/100;$('#pole-p').value=p;if(paired){pi=Math.round(iv*100)/100;$('#pole-pi').value=pi;}}else{z=Math.round(v*100)/100;$('#pole-z').value=z;if(paired){zi=Math.round(iv*100)/100;$('#pole-zi').value=zi;}}draw(false);plane();
      });
      const finish=e=>{if(!dragging)return;dragging=null;draw();};svg.addEventListener('pointerup',finish);svg.addEventListener('pointercancel',finish);
    }
    function draw(redrawPlane=true){const model=getModel();if(redrawPlane)plane();
      const dt=domain==='dt',nmax=16,tmax=6;
      const vals=Array.from({length:dt?nmax+1:401},(_,i)=>model.response(dt?i:i*tmax/400));let ymin=Math.min(0,...vals),ymax=Math.max(1,...vals);const margin=(ymax-ymin)*.12;
      chart($('#pole-response'),[{...(dt?{points:vals.map((y,n)=>[n,y]),stem:true}:{fn:model.response}),name:dt?'h[n]（含 n=0 的直通项）':'h(t) 的普通函数部分；另有 δ(t)',color:C[1]}],{xmin:0,xmax:dt?nmax:tmax,ymin:ymin-margin,ymax:ymax+margin,xlabel:dt?'n':'t'});
      const fmax=dt?Math.PI:6,mag=Array.from({length:401},(_,i)=>[i*fmax/400,model.magnitude(i*fmax/400)]),finite=mag.filter(q=>Number.isFinite(q[1]));let limit=Math.max(2,...finite.map(q=>q[1]))*1.1;
      chart($('#pole-frequency'),model.stable?[{points:mag,name:dt?'|H(eʲω)|':'|H(jω)|',color:C[0]}]:[{points:[],name:'ROC 不含频率轴 / 单位圆，无通常意义的频率响应'}],{xmin:0,xmax:fmax,ymin:0,ymax:limit,xlabel:dt?'ω / rad':'ω / rad·s⁻¹'});
      const step=t=>{if(paired)return model.step(t);if(t<0)return 0;if(dt){let y=0;for(let n=0;n<=t;n++)y+=model.response(n);return y;}return 1+(p-z)*(p===0?t:Math.expm1(p*t)/p);};
      const stepVals=Array.from({length:dt?nmax+1:401},(_,i)=>[dt?i:i*tmax/400,step(dt?i:i*tmax/400)]);ymin=Math.min(0,...stepVals.map(q=>q[1]));ymax=Math.max(1,...stepVals.map(q=>q[1]));
      chart($('#pole-step'),[{points:stepVals,stem:dt,name:'零状态阶跃响应',color:C[2]}],{xmin:0,xmax:dt?nmax:tmax,ymin:ymin-.1*(ymax-ymin),ymax:ymax+.1*(ymax-ymin),xlabel:dt?'n':'t'});
      $('#pole-status').innerHTML=`<span class="${model.stable?'lab-good':'lab-bad'}">${model.stable?'✓ BIBO 稳定':'✕ 非 BIBO 稳定'}</span><span>因果${paired?'二阶':'一阶'}系统</span><span>${model.cancelled?'极零完全相消':dt?'ROC：|z| > '+fmt(paired?Math.hypot(p,pi):Math.abs(p)):'ROC：Re(s) > '+fmt(p)}</span>`;
      $('#pole-note').innerHTML=dt?`<div class="lab-math">H(z) = (1 − z₀z⁻¹)/(1 − pz⁻¹)<br>h[n] = δ[n] + (p − z₀)pⁿ⁻¹u[n−1]</div>在 n=0 时 h[0]=1；在 n≥1 时按几何级数计算。因果 ROC 为 |z|&gt;|p|（退化和相消时按约分后的表达式判断）。BIBO 稳定当且仅当 ROC 包含单位圆，即未相消时 |p|&lt;1。p=0、z₀≠0 时 H(z)=1−z₀z⁻¹ 是有限冲激响应，ROC 为 z≠0。${model.cancelled?'<br><strong>此时分子分母完全相消，H=1，h=δ，稳定；原表达式中的 p 不再是真实极点。</strong>':''}<br>频率响应只有单位圆包含在 ROC 内时才作为 DTFT 存在；不稳定情况下不把代数代入误称为频率响应。`:`<div class="lab-math">H(s) = (s − z₀)/(s − p) = 1 + (p − z₀)/(s − p)<br>h(t) = δ(t) + (p − z₀)eᵖᵗu(t)</div>冲激 δ(t) 是单位面积的广义函数，不能画成有限高度的普通波形，所以上图只画指数部分，并明确保留 δ(t) 直通项。阶跃响应包含直通产生的 u(t)。因果 ROC 为 Re(s)&gt;p；未相消时 p&lt;0 才包含虚轴并 BIBO 稳定。${model.cancelled?'<br><strong>此时 p=z₀，H=1，h=δ，ROC 为整个有限 s 平面；表观极点已消去。</strong>':''}<br>频率响应只有虚轴包含在 ROC 内时才作为傅里叶变换存在；此处讨论的是输入输出 BIBO 稳定性，不推断隐藏内部状态的稳定性。`;
      if(paired){const cancelledNote=model.cancelled?'<br><strong>极点对与零点对完全相消：H=1，h=δ，ROC 为整个有限平面；此时表观极点不影响输入输出 BIBO 稳定。</strong>':'';
        $('#pole-note').innerHTML=dt?`<div class="lab-math">p=r±jv，z₀=q±jw<br>H(z) = (1−2qz⁻¹+|z₀|²z⁻²)/(1−2rz⁻¹+|p|²z⁻²)<br>h[n]−2rh[n−1]+|p|²h[n−2] = δ[n]−2qδ[n−1]+|z₀|²δ[n−2]</div>从初始静止出发，h[n]=0（n&lt;0），h[0]=1，h[1]=2(r−q)，随后逐项应用上式；图中以精确实系数递推计算，不截断系统记忆。阶跃响应为 Σₖ₌₀ⁿh[k]。共轭极点位于单位圆内（|p|&lt;1）时因果系统 BIBO 稳定；未相消时 ROC 为 |z|&gt;|p|。虚部为0时退化为二重实根。${cancelledNote}<br>频率响应仅在单位圆包含于 ROC 时绘出。模型固定为一对共轭极点及一对共轭零点，不包含反因果或任意高阶系统。`:`<div class="lab-math">p=r±jv，z₀=q±jw<br>H(s) = (s²−2qs+|z₀|²)/(s²−2rs+|p|²)<br>h(t) = δ(t) + eʳᵗ[a cos(vt) + d sin(vt)/v]u(t)</div>a=2(r−q)，b=|z₀|²−|p|²，d=b+ar。v=0 时，sin(vt)/v 取连续极限 t，得到二重实极点的真实响应。冲激的单位直通项单独保留；上图画普通函数部分。阶跃响应用该表达式的解析积分计算。未相消时，因果 ROC 为 Re(s)&gt;r；r&lt;0 才包含虚轴并 BIBO 稳定。${cancelledNote}<br>共轭根自动同步以保持实系数。模型固定为一对共轭极点及一对共轭零点，不包含反因果或任意高阶系统；频率响应只在虚轴属于 ROC 时绘出。`;
      }
    }
    $('#pole-domain').addEventListener('change',()=>{domain=$('#pole-domain').value;p=domain==='ct'?-.7:.6;z=domain==='ct'?-1.4:-.3;pi=domain==='ct'?.7:.45;zi=.4;$('#pole-p').value=p;$('#pole-z').value=z;$('#pole-pi').value=pi;$('#pole-zi').value=zi;draw();});
    $('#pole-order').addEventListener('change',()=>{paired=$('#pole-order').value==='pair';$('#pole-pi-field').style.display=paired?'grid':'none';$('#pole-zi-field').style.display=paired?'grid':'none';$('#pole-p').parentElement.firstChild.textContent=paired?'极点实部 Re p':'极点 p';$('#pole-z').parentElement.firstChild.textContent=paired?'零点实部 Re z₀':'零点 z₀';draw();});
    ['p','z','pi','zi'].forEach(k=>$('#pole-'+k).addEventListener('input',()=>{const v=Number($('#pole-'+k).value);if(!Number.isFinite(v)||$('#pole-'+k).value==='')return;const value=Math.max(k.length===2?0:-2,Math.min(2,v));if(k==='p')p=value;else if(k==='z')z=value;else if(k==='pi')pi=value;else zi=value;draw();}));draw();
  }
  window.Labs={render(id,container){this.destroy();style();const renderers={transform,systems,convolution,fourier,sampling,poles};if(renderers[id])renderers[id](container);else container.textContent='未找到实验室。';},destroy(){cleanup.forEach(fn=>fn());cleanup=[];}};
})();
