/* Computed concept diagrams. Every plot states its own model and units. */
(function () {
  'use strict';
  const blue = 'var(--blue)', purple = '#a855f7', orange = '#f59e0b', green = '#10b981', muted = 'var(--muted)';
  const pi = Math.PI;
  let serial = 0;
  const xml = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const txt = (x, y, value, color = muted, size = 12, anchor = 'start') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" text-anchor="${anchor}">${xml(value)}</text>`;
  const line = (x1,y1,x2,y2,color=muted,dash='') => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="1.5" ${dash?`stroke-dasharray="${dash}"`:''}/>`;
  const sinc = x => Math.abs(x)<1e-10?1:Math.sin(pi*x)/(pi*x);
  const rect = (x,a,b) => x>=a&&x<=b?1:0;
  const exp = (x,a=1) => x>=0?Math.exp(-a*x):0;
  const base = (caption,body) => ({svg:`<svg viewBox="0 0 660 255" role="img" aria-label="${xml(caption)}" style="font-family:inherit">${body}</svg>`,caption});
  function plot(o) {
    const {x=42,y=42,w=570,h=160,xmin=-3,xmax=3,ymin=-1.3,ymax=1.3,curves=[],stems=[],title='',xlabel='t',ylabel='x',xticks,yticks,shade}=o;
    const X=v=>x+(v-xmin)/(xmax-xmin)*w,Y=v=>y+h-(v-ymin)/(ymax-ymin)*h;
    const clip=`concept-clip-${++serial}`;
    let g=`<defs><clipPath id="${clip}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath></defs>`;
    g+=txt(x,y-14,title,muted,12);
    const zeroX=X(Math.max(xmin,Math.min(0,xmax))),zeroY=Y(Math.max(ymin,Math.min(0,ymax)));
    g+=line(x,zeroY,x+w,zeroY)+line(zeroX,y,zeroX,y+h);
    const ticksX=xticks||[xmin,(xmin+xmax)/2,xmax],ticksY=yticks||[ymin,ymax];
    for(const v of ticksX)g+=line(X(v),zeroY-3,X(v),zeroY+3)+txt(X(v),y+h+17,Number(v.toFixed(2)),muted,10,'middle');
    for(const v of ticksY)g+=txt(x-7,Y(v)+4,Number(v.toFixed(2)),muted,10,'end');
    g+=txt(x+w,y+h+32,xlabel,muted,11,'end')+txt(x-3,y-3,ylabel,muted,10,'end');
    g+=`<g clip-path="url(#${clip})">`;
    if(shade)g+=shade({X,Y,x,y,w,h});
    for(const c of curves){let path='';for(let i=0;i<=900;i++){const t=xmin+i/900*(xmax-xmin);let z=c.f(t);if(!Number.isFinite(z)){path+=' ';continue;}path+=`${i?'L':'M'}${X(t).toFixed(2)},${Y(z).toFixed(2)} `;}g+=`<path d="${path}" fill="none" stroke="${c.color||blue}" stroke-width="${c.width||2.4}" ${c.dash?'stroke-dasharray="5 4"':''}/>`;}
    for(const st of stems){for(let n=Math.ceil(st.min??xmin);n<=Math.floor(st.max??xmax);n++){const z=st.f(n);g+=line(X(n),Y(0),X(n),Y(z),st.color||blue)+`<circle cx="${X(n)}" cy="${Y(z)}" r="3" fill="${st.color||blue}"/>`;}}
    g+='</g>';
    return {g,X,Y};
  }
  const legend = entries => entries.map(([name,color],i)=>line(43+i*200,234,62+i*200,234,color)+txt(68+i*200,238,name,color,11)).join('');
  function one(caption,o,labels){const p=plot(o);return base(caption,p.g+(labels?legend(labels):''));}
  function two(caption,a,b,labels){return base(caption,plot({...a,x:42,w:255}).g+plot({...b,x:365,w:255}).g+(labels?legend(labels):''));}
  function blocks(caption, rows) {
    let g='';
    rows.forEach((r,i)=>{const y=35+i*77;g+=txt(42,y,r[0],blue,13)+`<rect x="210" y="${y-20}" width="225" height="40" rx="8" fill="none" stroke="${purple}" stroke-width="1.5"/>`+txt(322,y+5,r[1],purple,13,'middle')+line(120,y,200,y,blue)+txt(185,y-6,'→',blue,18)+line(445,y,485,y,purple)+txt(470,y-6,'→',purple,18)+txt(495,y+5,r[2],blue,13);});
    return base(caption,g);
  }
  function plane(caption,{mode='s',poles=[],zeros=[],roc='right',bound=0.6,lo=-3,hi=3,title='复平面',sub=''}={}){
    const w=(hi-lo)*40,x=(660-w)/2;
    const p=plot({x,w,xmin:lo,xmax:hi,ymin:-2,ymax:2,title:'',xlabel:mode==='s'?'Re(s) = σ':'Re(z)',ylabel:mode==='s'?'Im(s)':'Im(z)',curves:[],xticks:[lo,0,hi],yticks:[-2,2]});
    const {X,Y}=p;let g=txt(42,23,title,muted,12)+p.g;
    if(mode==='s'){
      const a=roc==='right'?bound:lo,b=roc==='right'?hi:bound;
      if(roc==='strip'){g+=`<rect x="${X(bound[0])}" y="42" width="${X(bound[1])-X(bound[0])}" height="160" fill="${blue}" opacity=".13"/>`+line(X(bound[0]),42,X(bound[0]),202,blue,'4 4')+line(X(bound[1]),42,X(bound[1]),202,blue,'4 4');}
      else g+=`<rect x="${X(a)}" y="42" width="${X(b)-X(a)}" height="160" fill="${blue}" opacity=".13"/>`+line(X(bound),42,X(bound),202,blue,'4 4');
    }else{
      const radius=(X(bound)-X(0)),rx=X(1)-X(0),ry=Y(0)-Y(1),ryBound=ry*bound;
      if(roc==='inside')g+=`<ellipse cx="${X(0)}" cy="${Y(0)}" rx="${radius}" ry="${ryBound}" fill="${blue}" opacity=".13"/>`;
      else g+=`<path d="M${x} 42H${x+w}V202H${x}Z M${X(0)-radius} ${Y(0)}a${radius} ${ryBound} 0 1 0 ${2*radius} 0a${radius} ${ryBound} 0 1 0 ${-2*radius} 0" fill="${blue}" opacity=".13" fill-rule="evenodd"/>`;
      g+=`<ellipse cx="${X(0)}" cy="${Y(0)}" rx="${rx}" ry="${ry}" stroke="${muted}" stroke-dasharray="5 4" fill="none"/><ellipse cx="${X(0)}" cy="${Y(0)}" rx="${radius}" ry="${ryBound}" stroke="${blue}" fill="none" stroke-dasharray="3 3"/>`+txt(X(0),Y(1)-8,'|z|=1',muted,10,'middle');
    }
    poles.forEach(([a,b])=>{g+=line(X(a)-5,Y(b)-5,X(a)+5,Y(b)+5,purple)+line(X(a)-5,Y(b)+5,X(a)+5,Y(b)-5,purple)+txt(X(a)+8,Y(b)-8,`p=${a}${b?`${b>0?'+':''}${b}j`:''}`,purple,11);});
    zeros.forEach(([a,b])=>{g+=`<circle cx="${X(a)}" cy="${Y(b)}" r="5" fill="none" stroke="${green}" stroke-width="2"/>`;});
    g+=txt(42,243,sub||'淡蓝区域为 ROC；边界虚线及极点均不属于 ROC。',muted,11);
    return base(caption,g);
  }
  const defs = {
    'ct-dt':()=>one('同一采样时刻的连续曲线与样本。横轴为样本坐标 n，连续曲线使用 t=0.01n s；f₀=10 Hz，fₛ=100 Hz。',{xmin:0,xmax:12,ymin:-1.3,ymax:1.3,title:'x_c(0.01n) = cos(0.2πn)，蓝色点为整数样本',xlabel:'n（t=0.01n s）',ylabel:'幅度',curves:[{f:n=>Math.cos(.2*pi*n),color:purple}],stems:[{f:n=>Math.cos(.2*pi*n)}],xticks:[0,5,10]},[['连续波形（映射横轴）',purple],['离散样本',blue]]),
    'impulse-step':()=>{const p=plot({xmin:-2,xmax:3,ymin:-.2,ymax:1.4,title:'连续阶跃 u(t) 与连续冲激 δ(t) 的符号示意',ylabel:'幅度 / 冲激权重',curves:[{f:t=>t>=0?1:0}],xticks:[-2,0,3],yticks:[0,1]});return base('阶跃蓝线是普通函数；紫色箭头仅表示 δ(t) 的权重为 1，箭头高度不是函数值。',p.g+line(p.X(0),p.Y(0),p.X(0),p.Y(1.25),purple)+txt(p.X(0),p.Y(1.25)+6,'↑',purple,24,'middle')+txt(p.X(0)+15,p.Y(1.2),'δ(t)：面积 1',purple)+legend([['u(t)',blue],['δ(t) 为分布',purple]]));},
    'exponential-sinusoid':()=>one('阻尼正弦 2e⁻ᵗcos(3t)，虚线是 ±2e⁻ᵗ 包络；图示范围 t≥0。',{xmin:0,xmax:5,ymin:-2.3,ymax:2.3,title:'2e⁻ᵗcos(3t) 与指数包络',curves:[{f:t=>2*Math.exp(-t)*Math.cos(3*t)},{f:t=>2*Math.exp(-t),color:purple,dash:true},{f:t=>-2*Math.exp(-t),color:purple,dash:true}],xticks:[0,2,4]},[['阻尼正弦',blue],['上下包络',purple]]),
    'periodicity':()=>one('序列 cos(πn/3)+sin(πn/2) 在 n=0…11 与 12…23 的样本完全重复，基本周期为 12。',{xmin:0,xmax:24,ymin:-2.2,ymax:2.2,title:'N₀ = lcm(6,4) = 12',xlabel:'n',stems:[{f:n=>Math.cos(pi*n/3)+Math.sin(pi*n/2)}],xticks:[0,6,12,18,24]}),
    'even-odd':()=>one('例题 x(t)=3+2t+t² 的原信号、偶分量与奇分量，三条曲线均按解析式计算。',{xmin:-2,xmax:2,ymin:-5,ymax:12,title:'x = x_e + x_o',curves:[{f:t=>3+2*t+t*t},{f:t=>3+t*t,color:purple},{f:t=>2*t,color:orange}],xticks:[-2,0,2]},[['原信号',blue],['偶分量 3+t²',purple],['奇分量 2t',orange]]),
    'time-transform':()=>one('原矩形在 (0,1) 为 1；变换 2x(2−t) 在 (1,2) 为 2。原左端点映到右端点，体现反转。',{xmin:-1,xmax:3,ymin:-.3,ymax:2.5,title:'x(t) 与 2x(2−t)',curves:[{f:t=>rect(t,0,1),color:purple},{f:t=>2*rect(t,1,2)}],xticks:[-1,0,1,2,3],yticks:[0,1,2]},[['原信号 x(t)',purple],['2x(2−t)',blue]]),
    'energy-power':()=>one('例题 x=e⁻²ᵗu(t) 的模平方为 e⁻⁴ᵗu(t)。阴影为能量被积函数，完整面积为 1/4。',{xmin:-.5,xmax:3,ymin:-.1,ymax:1.2,title:'能量对 |x(t)|² 积分',curves:[{f:t=>exp(t,2)},{f:t=>exp(t,4),color:purple}],shade:({X,Y})=>{let p=`M${X(0)},${Y(0)}`;for(let i=0;i<=200;i++){const t=i/200*3;p+=`L${X(t)},${Y(Math.exp(-4*t))}`;}return `<path d="${p}L${X(3)},${Y(0)}Z" fill="${purple}" opacity=".14"/>`;},xticks:[0,1,2,3],yticks:[0,1]},[['x(t)',blue],['|x(t)|²',purple]]),
    'complex-frequency':()=>{const p=plot({xmin:-.5,xmax:.8,ymin:-.6,ymax:.4,title:'H(j2) = 0.2 − j0.4',xlabel:'实部',ylabel:'虚部',xticks:[0,.2],yticks:[-.4,0]});return base('复平面上的点 (0.2,−0.4) 对应 H(j2)=1/(1+j2)，模为 1/√5，相位约 −63.435°。',p.g+line(p.X(0),p.Y(0),p.X(.2),p.Y(-.4),blue)+line(p.X(.2),p.Y(0),p.X(.2),p.Y(-.4),purple,'4 4')+`<circle cx="${p.X(.2)}" cy="${p.Y(-.4)}" r="5" fill="${blue}"/>`+txt(p.X(.2)+10,p.Y(-.4)-10,'0.2 − j0.4',blue)+txt(42,241,'相位用 atan2(−0.4, 0.2) 计算，避免象限错误。'));},
    'linearity':()=>one('非线性反例 T{x}=x²：取 x₁(t)=1、x₂(t)=t，路径 A 为 (1+t)²，路径 B 为 1+t²，两者一般不同。',{xmin:-1,xmax:1,ymin:-.2,ymax:4.5,title:'线性检验：先叠加再平方 vs 分别平方后相加',curves:[{f:t=>(1+t)**2},{f:t=>1+t*t,color:purple}],xticks:[-1,0,1],yticks:[0,2,4]},[['路径 A：(1+t)²',blue],['路径 B：1+t²',purple]]),
    'time-invariance':()=>one('反例 T{x}(t)=x(2t)，取 x(t)=t、平移量 τ=1。A=2t−1，B=2t−2，差值恒为 1，所以系统时变。',{xmin:-1,xmax:2,ymin:-4,ymax:4,title:'时不变两路径，x(t)=t，τ=1',curves:[{f:t=>2*t-1},{f:t=>2*t-2,color:purple}],xticks:[-1,0,1,2],yticks:[-4,0,4]},[['A：先平移输入',blue],['B：先系统后平移输出',purple]]),
    'causality':()=>{let g=line(60,140,610,140)+txt(610,165,'输入时间 t',muted,12,'end');for(let k=-1;k<=3;k++){let x=60+(k+1)*130;g+=line(x,134,x,146)+txt(x,165,k,muted,12,'middle');}g+=`<rect x="60" y="90" width="260" height="85" fill="${blue}" opacity=".1"/>`+txt(190,115,'允许访问：t ≤ 1',blue,13,'middle')+txt(320,70,'当前时刻 t₀=1',blue,13,'middle')+line(320,80,320,145,blue,'4 4')+txt(450,90,'x(2t₀)=x(2)',purple,13,'middle')+line(450,100,450,140,purple)+txt(450,130,'↓',purple,20,'middle')+txt(42,225,'在 t₀=1 输出 x(2t₀) 要读取未来 t=2，得到非因果反例。');return base('对时间压缩系统 x(2t)，当前时刻 1 需要未来输入 x(2)，违反因果定义。',g);},
    'bibo-stability':()=>one('有界输入 x(t)=1 经过 T{x}=tx(t) 得斜坡 t；图只显示有限窗口，解析式说明在全时间上无界。紫色 sin(t) 始终有界。',{xmin:-4,xmax:4,ymin:-4.5,ymax:4.5,title:'无界斜坡与有界正弦的比较',curves:[{f:t=>t},{f:t=>Math.sin(t),color:purple}],xticks:[-4,0,4],yticks:[-4,0,4]},[['t·1 = t',blue],['sin(t)',purple]]),
    'memory':()=>blocks('两种不同的数据访问：无记忆只读取当前样本；延时系统需要历史样本。',[['当前 x[n]','取绝对值 |·|','|x[n]|'],['过去 x[n−2]','保存并延时两拍','x[n−2]'],['当前 x(t)','乘已知时间 t','t·x(t)']]),
    'invertibility':()=>blocks('平方系统把 +1 与 −1 变成同一输出，丢失符号信息；在非负输入集合上可由平方根恢复。',[['输入 +1','平方','输出 1'],['输入 −1','平方','输出 1'],['限制 x≥0','平方根求逆','唯一恢复 x']]),
    'impulse-response':()=>two('h[n]=(1/2)ⁿu[n]；输入 δ[n]+2δ[n−2] 使第二个响应延时两拍并放大两倍。',{xmin:-1,xmax:7,ymin:-.2,ymax:1.3,title:'冲激响应 h[n]',xlabel:'n',stems:[{f:n=>n>=0?.5**n:0}],xticks:[0,2,4,6],yticks:[0,1]},{xmin:-1,xmax:7,ymin:-.2,ymax:2.6,title:'输出 h[n]+2h[n−2]',xlabel:'n',stems:[{f:n=>(n>=0?.5**n:0)+(n>=2?2*.5**(n-2):0)}],xticks:[0,2,4,6],yticks:[0,1,2]}),
    'ct-convolution':()=>{const a=plot({x:42,w:255,xmin:-1,xmax:2,ymin:-.2,ymax:1.4,title:'固定 t=0.4：重叠区间 [0,0.4]',xlabel:'τ',curves:[{f:t=>rect(t,0,1)},{f:t=>rect(t,-.6,.4),color:purple}],shade:({X,Y})=>`<rect x="${X(0)}" y="${Y(1)}" width="${X(.4)-X(0)}" height="${Y(0)-Y(1)}" fill="${green}" opacity=".3"/>`,xticks:[0,.4,1],yticks:[0,1]});const b=plot({x:365,w:255,xmin:-.2,xmax:2.2,ymin:-.2,ymax:1.3,title:'卷积输出 y(t)',curves:[{f:t=>t<0||t>2?0:t<=1?t:2-t}],xticks:[0,1,2],yticks:[0,1]});return base('两个 [0,1] 单位矩形卷积。左图蓝线 x(τ)、紫线 h(0.4−τ)，绿色重叠面积为 0.4，右图圆点标出对应输出。',a.g+b.g+`<circle cx="${b.X(.4)}" cy="${b.Y(.4)}" r="5" fill="${purple}"/>`+legend([['x(τ)',blue],['h(0.4−τ)',purple],['重叠乘积',green]]));},
    'dt-convolution':()=>two('例题 x=[1,2,1]、h=[1,−1] 从索引 0 起，线性卷积 y=[1,1,−1,−1]。',{xmin:-1,xmax:4,ymin:-1.5,ymax:2.5,title:'输入 x[n] 与 h[n]',xlabel:'n',stems:[{f:n=>[1,2,1][n]||0},{f:n=>[1,-1][n]||0,color:purple}],xticks:[0,1,2,3],yticks:[-1,0,2]},{xmin:-1,xmax:4,ymin:-1.5,ymax:2.5,title:'卷积 y[n]',xlabel:'n',stems:[{f:n=>[1,1,-1,-1][n]||0}],xticks:[0,1,2,3],yticks:[-1,0,2]}),
    'convolution-properties':()=>blocks('LTI 系统连接法则：串联响应卷积，并联响应相加，单位冲激为卷积单位元。',[['输入 x','串联 h₁ → h₂','x∗(h₁∗h₂)'],['输入 x','并联 h₁ 与 h₂','x∗(h₁+h₂)'],['输入 x','冲激响应 δ','恢复 x']]),
    'differential-difference':()=>one('零状态递推 h[n]=0.5h[n−1]+δ[n]：h[0]=1，后续每拍减半。',{xmin:-1,xmax:10,ymin:-.1,ymax:1.2,title:'h[n] = (1/2)ⁿu[n]',xlabel:'n',stems:[{f:n=>n>=0?.5**n:0}],xticks:[0,2,4,6,8,10],yticks:[0,1]}),
    'zero-input-state':()=>one('方程 y′+2y=u(t)、y(0⁻)=3。零输入与零状态响应之和为总响应，图示 t≥0。',{xmin:0,xmax:3,ymin:-.15,ymax:3.3,title:'y = 3e⁻²ᵗ + (1−e⁻²ᵗ)/2',curves:[{f:t=>3*Math.exp(-2*t),color:purple},{f:t=>(1-Math.exp(-2*t))/2,color:orange},{f:t=>.5+2.5*Math.exp(-2*t)}],xticks:[0,1,2,3],yticks:[0,.5,3]},[['总响应',blue],['零输入',purple],['零状态',orange]]),
    'response-methods':()=>one('x=e⁻²ᵗu(t)、h=e⁻ᵗu(t)，卷积结果为 (e⁻ᵗ−e⁻²ᵗ)u(t)，不是两指数逐点相乘。',{xmin:-.3,xmax:5,ymin:-.05,ymax:1.15,title:'卷积输出的初值为 0，随后上升再衰减',curves:[{f:t=>exp(t,2),color:purple},{f:t=>exp(t,1),color:orange},{f:t=>t>=0?Math.exp(-t)-Math.exp(-2*t):0}],xticks:[0,1,3,5],yticks:[0,.5,1]},[['输出 x∗h',blue],['输入 x',purple],['响应 h',orange]]),
    'ctfs':()=>one('x(t)=2+3cos(4t)，基频 ω₀=4 rad/s。离散谱线是级数系数，非 CTFT 冲激权重。',{xmin:-3,xmax:3,ymin:-.2,ymax:2.4,title:'CTFS 系数 a₀=2，a±₁=1.5',xlabel:'谐波编号 k（ω=4k）',ylabel:'a_k',stems:[{f:k=>k===0?2:Math.abs(k)===1?1.5:0}],xticks:[-2,-1,0,1,2],yticks:[0,1.5,2]}),
    'dtfs':()=>one('周期序列 [1,0,−1,0] 的 DTFS 系数以 4 重复；一个独立系数周期为 [0,1/2,0,1/2]。',{xmin:-1,xmax:8,ymin:-.05,ymax:.7,title:'N=4，a[k+4]=a[k]',xlabel:'k',ylabel:'a_k',stems:[{f:k=>Math.abs(k%2)===1?.5:0}],xticks:[0,1,2,3,4,5,6,7],yticks:[0,.5]}),
    'ctft':()=>one('x(t)=e⁻³ᵗu(t) 的连续幅度谱 |X(jω)|=1/√(9+ω²)，在 ω=0 处为 1/3。',{xmin:-10,xmax:10,ymin:-.02,ymax:.4,title:'连续频率上的幅度谱，不是谐波线',xlabel:'ω（rad/s）',ylabel:'|X|',curves:[{f:w=>1/Math.sqrt(9+w*w)}],xticks:[-10,-3,0,3,10],yticks:[0,1/3]}),
    'dtft':()=>one('x[n]=(1/2)ⁿu[n] 的 DTFT 幅度 1/|1−0.5e⁻ʲω|；横轴 ω/π，频谱每隔 2π 重复。',{xmin:-3,xmax:3,ymin:-.1,ymax:2.3,title:'非周期序列的频谱仍以 2π 为周期',xlabel:'ω/π',ylabel:'|X|',curves:[{f:r=>1/Math.sqrt(1.25-Math.cos(pi*r))}],xticks:[-3,-2,-1,0,1,2,3],yticks:[0,2/3,2]}),
    'fourier-properties':()=>two('以 x=e⁻ᵗu(t)、y=x(t−2) 为例，幅度完全相同，展开相位额外减去 2ω。此图用于平移性质，不含例题额外幅度系数。',{xmin:-3,xmax:3,ymin:-.1,ymax:1.2,title:'幅度谱：两曲线重合',xlabel:'ω',ylabel:'幅度',curves:[{f:w=>1/Math.sqrt(1+w*w),color:purple,width:5},{f:w=>1/Math.sqrt(1+w*w)}],xticks:[-3,0,3],yticks:[0,1]},{xmin:-3,xmax:3,ymin:-8,ymax:8,title:'展开相位：−atan(ω) 与 −atan(ω)−2ω',xlabel:'ω',ylabel:'rad',curves:[{f:w=>-Math.atan(w),color:purple},{f:w=>-Math.atan(w)-2*w}],xticks:[-3,0,3],yticks:[-8,0,8]},[['原信号',purple],['延时信号',blue]]),
    'transform-pairs':()=>one('宽度 2 的单位矩形对应 X(jω)=2sin(ω)/ω。横轴 ω/π，正负首零点分别在 ±1，即 ω=±π。',{xmin:-3,xmax:3,ymin:-.6,ymax:2.3,title:'矩形的 CTFT：2 sinc(ω/π)',xlabel:'ω/π',ylabel:'X（实数）',curves:[{f:r=>2*sinc(r)}],xticks:[-3,-2,-1,0,1,2,3],yticks:[0,2]}),
    'magnitude-phase':()=>defs['fourier-properties'](),
    'frequency-response':()=>two('系统 h=e⁻ᵗu(t)，持续输入 2cos(t) 输出 √2 cos(t−π/4)。右图为该系统的频率响应幅度。',{xmin:0,xmax:10,ymin:-2.4,ymax:2.4,title:'时域：幅度衰减，相位滞后',xlabel:'t（s）',curves:[{f:t=>2*Math.cos(t),color:purple},{f:t=>Math.sqrt(2)*Math.cos(t-pi/4)}],xticks:[0,5,10],yticks:[-2,0,2]},{xmin:0,xmax:4,ymin:-.1,ymax:1.2,title:'|H(jω)| = 1/√(1+ω²)',xlabel:'ω（rad/s）',ylabel:'|H|',curves:[{f:w=>1/Math.sqrt(1+w*w)}],xticks:[0,1,2,4],yticks:[0,1]},[['输入 2cos(t)',purple],['输出',blue]]),
    'filtering':()=>two('理想低通截止角频率 ωc=2。频域矩形的逆变换 h(t)=sin(2t)/(πt) 在负时间非零，因此精确理想低通非因果。',{xmin:-5,xmax:5,ymin:-.15,ymax:1.3,title:'理想低通 H(jω)',xlabel:'ω（rad/s）',ylabel:'H',curves:[{f:w=>Math.abs(w)<2?1:0}],xticks:[-5,-2,0,2,5],yticks:[0,1]},{xmin:-6,xmax:6,ymin:-.2,ymax:.75,title:'双边冲激响应 h(t)',xlabel:'t（s）',ylabel:'h',curves:[{f:t=>Math.abs(t)<1e-9?2/pi:Math.sin(2*t)/(pi*t),color:purple}],xticks:[-6,-3,0,3,6],yticks:[0,2/pi]}),
    'gibbs':()=>one('标准 ±1 方波的 1 项与 8 项非零奇次谐波合成。横轴 θ/π，跳变附近更窄但仍有过冲。跳变点部分和为 0。',{xmin:0,xmax:2,ymin:-1.4,ymax:1.4,title:'x_M = (4/π) Σ sin((2m+1)θ)/(2m+1)',xlabel:'θ/π',curves:[{f:r=>4/pi*Math.sin(pi*r),color:purple},{f:r=>{let z=0;for(let m=0;m<8;m++)z+=Math.sin((2*m+1)*pi*r)/(2*m+1);return 4/pi*z;}}],xticks:[0,.5,1,1.5,2],yticks:[-1,0,1]},[['1 项',purple],['8 项',blue]]),
    'sampling-process':()=>one('频谱示意取 X(f)=max(1−|f|/100,0)，fs=300 Hz。为比较形状，纵轴显示 Ts·Xs，真实采样频谱为图值再除以 Ts。',{xmin:-450,xmax:450,ymin:-.1,ymax:1.3,title:'频谱复制中心在 k·300 Hz',xlabel:'f（Hz）',ylabel:'T_sX_s',curves:[{f:f=>Math.max(1-Math.abs(f)/100,0)},{f:f=>Math.max(1-Math.abs(f-300)/100,0)+Math.max(1-Math.abs(f+300)/100,0),color:purple}],xticks:[-300,-100,0,100,300],yticks:[0,1]},[['基带',blue],['相邻复制',purple]]),
    'nyquist':()=>two('示意带限三角频谱带宽 100 Hz。fs=300 Hz 时复制不重叠；fs=160 Hz 时相邻复制与基带重叠。纵轴采用 Ts 缩放比较形状。',{xmin:-250,xmax:400,ymin:-.1,ymax:1.3,title:'fs=300 Hz：留有间隔',xlabel:'f（Hz）',ylabel:'归一化谱',curves:[{f:f=>Math.max(1-Math.abs(f)/100,0)},{f:f=>Math.max(1-Math.abs(f-300)/100,0),color:purple}],xticks:[-100,0,100,300],yticks:[0,1]},{xmin:-250,xmax:400,ymin:-.1,ymax:1.3,title:'fs=160 Hz：产生重叠',xlabel:'f（Hz）',ylabel:'归一化谱',curves:[{f:f=>Math.max(1-Math.abs(f)/100,0)},{f:f=>Math.max(1-Math.abs(f-160)/100,0),color:purple}],xticks:[0,100,160,260],yticks:[0,1]}),
    'aliasing':()=>one('800 Hz 与 200 Hz 余弦按 1000 Hz 采样。蓝色样本落在两条不同连续曲线上，说明离散样本无法区分它们。',{xmin:0,xmax:10,ymin:-1.3,ymax:1.3,title:'fs=1000 Hz，每 1 ms 一个样本',xlabel:'t（ms）',ylabel:'幅度',curves:[{f:t=>Math.cos(2*pi*.8*t),color:purple},{f:t=>Math.cos(2*pi*.2*t),color:orange}],stems:[{f:t=>Math.cos(2*pi*.2*t)}],xticks:[0,2,4,6,8,10],yticks:[-1,0,1]},[['800 Hz',purple],['200 Hz',orange],['共同采样点',blue]]),
    'reconstruction':()=>one('原信号 cos(2πt)、fs=4 Hz。蓝色为 n=−20…20 的有限 sinc 重建，紫色虚线为原信号；截断后只近似理想无限和。',{xmin:-1,xmax:1,ymin:-1.3,ymax:1.3,title:'sinc 插值由样本加权核叠加得到',xlabel:'t（s）',curves:[{f:t=>Math.cos(2*pi*t),color:purple,dash:true},{f:t=>{let z=0;for(let n=-20;n<=20;n++)z+=Math.cos(pi*n/2)*sinc(4*t-n);return z;}}],shade:({X,Y})=>{let q='';for(let n=-4;n<=4;n++)q+=`<circle cx="${X(n/4)}" cy="${Y(Math.cos(pi*n/2))}" r="3" fill="${orange}"/>`;return q;},xticks:[-1,-.5,0,.5,1],yticks:[-1,0,1]},[['有限 sinc 和',blue],['原波形',purple],['样本',orange]]),
    'laplace-bilateral':()=>one('取 σ=3：e²ᵗu(t) 乘 e⁻³ᵗ 后成为 e⁻ᵗu(t)。原信号正向增长，加权后可积分，说明 ROC 条件 σ>2。',{xmin:0,xmax:2,ymin:-.1,ymax:8,title:'指数加权改变收敛性（原曲线超出纵轴后截断）',curves:[{f:t=>Math.exp(2*t),color:purple},{f:t=>Math.exp(-t)}],xticks:[0,1,2],yticks:[0,1,4,8]},[['原信号 e²ᵗ',purple],['加权后 e⁻ᵗ',blue]]),
    'laplace-roc':()=>plane('X(s)=1/((s+1)(s+3)) 的 ROC 条带 −3<Re(s)<−1。两个边界极点不属于收敛域。',{mode:'s',poles:[[-3,0],[-1,0]],roc:'strip',bound:[-3,-1],lo:-4,hi:2,title:'双边信号对应中间 ROC 条带'}),
    'unilateral-laplace':()=>defs['zero-input-state'](),
    'laplace-inverse':()=>one('重复极点例题：1/(s+2)²、ROC Re(s)>−2，对应 te⁻²ᵗu(t)。最大值在 t=1/2，幅度 1/(2e)。',{xmin:-.3,xmax:4,ymin:-.02,ymax:.23,title:'重极点产生 t 因子',curves:[{f:t=>t>=0?t*Math.exp(-2*t):0}],xticks:[0,.5,1,2,4],yticks:[0,1/(2*Math.E)]}),
    'laplace-system':()=>plane('同一系统函数 H(s)=1/(s−1)。图示稳定的非因果选择 Re(s)<1，包含虚轴；因果选择 Re(s)>1 则不稳定。',{mode:'s',poles:[[1,0]],roc:'left',bound:1,lo:-3,hi:3,title:'稳定选择：ROC 在极点左侧，含虚轴',sub:'蓝色 ROC：Re(s)<1。因果选择必须改到右侧 Re(s)>1。'}),
    'z-definition':()=>plane('X(z)=z/(z−0.6) 的右边序列 ROC 为 |z|>0.6，包含单位圆；绿色圆圈标记零点 z=0，零点位置本身不决定 ROC。',{mode:'z',poles:[[.6,0]],zeros:[[0,0]],roc:'outside',bound:.6,lo:-2,hi:2,title:'右边序列的圆外 ROC',sub:'淡蓝区域 |z|>0.6；灰虚线为单位圆，紫叉为极点，绿圈为零点。'}),
    'z-roc':()=>plane('X(z)=z/(z−0.5)，图示 |z|<0.5，对应 −(0.5)ⁿu[−n−1]。ROC 不包含单位圆，因而不是绝对可和序列。',{mode:'z',poles:[[.5,0]],zeros:[[0,0]],roc:'inside',bound:.5,lo:-2,hi:2,title:'左边序列的圆内 ROC',sub:'淡蓝区域 |z|<0.5，灰虚线 |z|=1 不在 ROC 内。'}),
    'z-inverse':()=>one('逆变换例题 x[n]=[2(0.5)ⁿ−(0.25)ⁿ]u[n]。前几项为 1、0.75、0.4375、0.234375。',{xmin:-1,xmax:9,ymin:-.1,ymax:1.2,title:'部分分式回到样本序列',xlabel:'n',stems:[{f:n=>n>=0?2*.5**n-.25**n:0}],xticks:[0,1,2,3,6,9],yticks:[0,.5,1]}),
    'z-system-equations':()=>one('y[n]−0.5y[n−1]=u[n]，y[−1]=2。零输入 (0.5)ⁿ 与零状态 2−(0.5)ⁿ 相加，总输出恒等于 2。',{xmin:0,xmax:8,ymin:-.1,ymax:2.4,title:'n≥0：初始状态恰好处于稳态',xlabel:'n',curves:[{f:n=>2}],stems:[{f:n=>.5**n,color:purple},{f:n=>2-.5**n,color:orange}],xticks:[0,2,4,6,8],yticks:[0,1,2]},[['总响应 2',blue],['零输入',purple],['零状态',orange]]),
    'z-stability-poles':()=>one('因果单极点响应：h₁=(0.8)ⁿu[n] 衰减且绝对和为 5；h₂=(1.1)ⁿu[n] 增长。严格圆内与圆外决定因果模式的稳定性。',{xmin:0,xmax:15,ymin:-.2,ymax:4.5,title:'极点模 0.8 与 1.1 的自然响应',xlabel:'n',stems:[{f:n=>.8**n},{f:n=>1.1**n,color:purple}],xticks:[0,5,10,15],yticks:[0,1,4]},[['p=0.8：衰减',blue],['p=1.1：增长',purple]])
  };
  window.ConceptVisuals = t => defs[t.id] ? defs[t.id]() : null;
}());
