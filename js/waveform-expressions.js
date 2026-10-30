/* Exact structural bridge, not a sampled curve fitter. SignalEngine owns the
 * bounded grammar; a cloned AST proves every interval affine and both tails
 * zero before a finite WaveformMath model is exposed for editing/grading. */
(function(global){
  'use strict';
  const LIMIT=Object.freeze({source:4096,tokens:2048,cuts:160,work:220000,degree:8});
  const FUNCTIONS=new Set(['sin','cos','tan','exp','log','sqrt','abs','floor','ceil','u','delta','where','piecewise']);
  const CONSTANTS=new Set(['pi','e']);
  class Unsupported extends Error{}
  const unsupported=message=>{throw new Unsupported(message);};
  const finite=v=>{if(typeof v!=='number'||!Number.isFinite(v))unsupported('符号运算超出有限实数范围。');return Object.is(v,-0)?0:v;};
  const product=(a,b)=>{const value=finite(a*b);if(a!==0&&b!==0&&value===0)unsupported('系数乘法发生浮点下溢，不能证明完整零尾部。');return value;};
  const quotient=(a,b)=>{const value=finite(a/b);if(a!==0&&value===0)unsupported('系数除法发生浮点下溢，不能生成可靠解析模型。');return value;};
  const number=v=>String(finite(v));
  const unique=xs=>[...new Set(xs.map(x=>Object.is(x,-0)?0:x))].sort((a,b)=>a-b);
  function domainOf(domain){if(!['ct','dt'].includes(domain))throw new Error('时间类型须为ct或dt。');return domain;}
  function normalizeSource(text,domain='ct'){
    domainOf(domain);if(typeof text!=='string'||!text.trim())throw new Error('请输入信号表达式。');if(text.length>LIMIT.source)throw new Error('表达式最多4096个字符。');
    let source=text.trim().replace(/[−–]/g,'-').replace(/[×·]/g,'*');
    const prefix=/^[xy]\s*(\(\s*t\s*\)|\[\s*n\s*\])\s*=/.exec(source);
    if(prefix){if((prefix[1].includes('[')?'dt':'ct')!==domain)throw new Error('公式左侧的时间类型与当前CT/DT选择不一致。');source=source.slice(prefix[0].length);}
    const tokens=[];let i=0;
    while(i<source.length){
      if(/\s/.test(source[i])){i++;continue;}const rest=source.slice(i);let match,token;
      if((match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest))){if(!Number.isFinite(Number(match[0])))throw new Error('数值须为有限实数。');token={type:'number',text:match[0]};i+=match[0].length;}
      else if(source[i]==='π'){token={type:'constant',text:'pi'};i++;}
      else if(source[i]==='δ'){token={type:'function',text:'delta'};i++;}
      else if((match=/^[A-Za-z_][A-Za-z_0-9]*/.exec(rest))){const name=match[0];if(FUNCTIONS.has(name))token={type:'function',text:name};else if(CONSTANTS.has(name))token={type:'constant',text:name};else if(name===(domain==='dt'?'n':'t'))token={type:'variable',text:name};else throw new Error('未知名称 '+name+'；不拆分未知名称，也不执行JavaScript。');i+=name.length;}
      else{const two=source.slice(i,i+2);if(['<=','>=','==','!=','&&','||'].includes(two)){token={type:two,text:two};i+=2;}else if('+-*/^(),[]<>'.includes(source[i])){token={type:source[i],text:source[i]};i++;}else throw new Error('不支持字符“'+source[i]+'”。');}
      tokens.push(token);if(tokens.length>LIMIT.tokens)throw new Error('表达式符号过多。');
    }
    const ends=t=>['number','constant','variable',')',']'].includes(t?.type),starts=t=>['number','constant','variable','function','('].includes(t?.type);
    let out='';for(let k=0;k<tokens.length;k++){const previous=tokens[k-1],current=tokens[k];if(ends(previous)&&starts(current)){if(previous.type==='number'&&current.type==='number')throw new Error('相邻数字之间请明确输入乘号。');out+='*';}out+=current.text;}
    if(!out||out.length>LIMIT.source)throw new Error('规范化后的表达式为空或超过4096字符。');return out;
  }
  const trim=p=>{while(p.length>1&&p.at(-1)===0)p.pop();return p;};
  const zero=p=>p.length===1&&p[0]===0;
  function plus(a,b,sign=1){const p=Array(Math.max(a.length,b.length)).fill(0);for(let i=0;i<p.length;i++)p[i]=finite((a[i]||0)+sign*(b[i]||0));return trim(p);}
  function times(a,b){if(a.length+b.length-2>LIMIT.degree)unsupported('多项式阶数超出本轮精确编辑范围。');const p=Array(a.length+b.length-1).fill(0);for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)p[i+j]=finite(p[i+j]+product(a[i],b[j]));return trim(p);}
  const scale=(p,k)=>trim(p.map(v=>product(v,k)));
  function affine(n){
    if(n.type==='number')return [n.value,0];if(n.type==='var')return [0,1];if(n.type==='unary'){const p=affine(n.arg);return p&&p.map(v=>n.op==='-'?-v:v);}
    if(n.type!=='binary'||!['+','-','*','/','^'].includes(n.op))return null;const a=affine(n.left),b=affine(n.right);if(!a||!b)return null;
    let p;if(n.op==='+'||n.op==='-')p=[a[0]+(n.op==='+'?1:-1)*b[0],a[1]+(n.op==='+'?1:-1)*b[1]];
    else if(n.op==='*'&&(a[1]===0||b[1]===0))p=[product(a[0],b[0]),finite(product(a[1],b[0])+product(a[0],b[1]))];
    else if(n.op==='/'&&b[1]===0&&b[0]!==0)p=[quotient(a[0],b[0]),quotient(a[1],b[0])];
    else if(n.op==='^'&&b[1]===0&&b[0]===0)p=[1,0];else if(n.op==='^'&&b[1]===0&&b[0]===1)p=a;else return null;
    return p.every(Number.isFinite)?p:null;
  }
  function signOn(p,cell){
    const b=p[0],a=p[1]||0;if(a===0)return Math.sign(b);const root=finite(-b/a);if(cell.hi<=root)return -Math.sign(a);if(cell.lo>=root)return Math.sign(a);unsupported('区间内仍有未解析的分界点，不能以少量采样代替数学证明。');
  }
  function condition(n,cell){
    if(n.type==='binary'&&n.op==='&&')return condition(n.left,cell)&&condition(n.right,cell);
    if(n.type==='binary'&&n.op==='||')return condition(n.left,cell)||condition(n.right,cell);
    if(n.type!=='binary'||!['<','>','<=','>=','==','!='].includes(n.op))unsupported('分段条件须为仿射比较。');
    const a=affine(n.left),b=affine(n.right);if(!a||!b)unsupported('分段条件不是已支持的仿射比较。');const sign=signOn([finite(a[0]-b[0]),finite(a[1]-b[1])],cell);
    return ({'<':sign<0,'>':sign>0,'<=':sign<=0,'>=':sign>=0,'==':sign===0,'!=':sign!==0})[n.op];
  }
  function calculate(op,a,b){if(op==='+')return finite(a+b);if(op==='-')return finite(a-b);if(op==='*')return product(a,b);if(op==='/')return quotient(a,b);if(op==='^')return finite(a**b);unsupported('未知算术运算。');}
  function callValue(name,a){const f={sin:Math.sin,cos:Math.cos,tan:Math.tan,exp:Math.exp,log:Math.log,sqrt:Math.sqrt,abs:Math.abs,floor:Math.floor,ceil:Math.ceil}[name];if(!f)unsupported('函数尚不支持精确转换。');if(name==='tan'&&Math.abs(Math.cos(a))<1e-14)unsupported('正切接近奇点。');const value=finite(f(a));if(name==='exp'&&value===0)unsupported('指数发生浮点下溢，保留原公式绘图。');return value;}
  function certificate(ast,domain,signal){
    const cuts=[...signal.breakpoints];let work=0;
    function gather(n){if(n.type==='call'&&n.name==='abs'){const p=affine(n.args[0]);if(p&&p[1]!==0)cuts.push(finite(-p[0]/p[1]));}if(n.type==='unary')gather(n.arg);if(n.type==='binary'){gather(n.left);gather(n.right);}for(const a of n.args||[])gather(a);}
    gather(ast);const boundaries=unique(cuts);
    if(boundaries.length>LIMIT.cuts||boundaries.some(v=>Math.abs(v)>global.WaveformMath.limits.magnitude))unsupported('分界点数量或范围超过有限波形编辑预算。');
    function poly(n,cell){
      if(++work>LIMIT.work)unsupported('精确分段分析超过计算预算。');
      if(n.type==='number')return [n.value];if(n.type==='var')return [0,1];if(n.type==='unary')return scale(poly(n.arg,cell),n.op==='-'?-1:1);
      if(n.type==='binary'){
        if(!['+','-','*','/','^'].includes(n.op))unsupported('比较条件只能放在where或piecewise中。');const a=poly(n.left,cell),b=poly(n.right,cell);
        if(n.op==='+')return plus(a,b);if(n.op==='-')return plus(a,b,-1);if(n.op==='*')return times(a,b);
        if(n.op==='/'){if(b.length!==1||b[0]===0)unsupported('仅能把非零常数分母转换为精确分段模型。');return trim(a.map(v=>quotient(v,b[0])));}
        if(b.length!==1||!Number.isInteger(b[0])||b[0]<0||b[0]>LIMIT.degree)unsupported('当前仅分析有限非负整数幂。');let p=[1];for(let i=0;i<b[0];i++)p=times(p,a);return p;
      }
      if(n.type!=='call')unsupported('未知语法节点。');
      if(n.name==='where')return poly(n.args[condition(n.args[0],cell)?1:2],cell);
      if(n.name==='u'||n.name==='delta'){
        const a=affine(n.args[0]);if(!a)unsupported('阶跃和冲激的自变量须为仿射式。');if(n.name==='delta'){if(domain==='ct')return [0];return [a[1]===0&&a[0]===0?1:0];}return [signOn(a,cell)>=0?1:0];
      }
      const p=poly(n.args[0],cell);
      if(n.name==='abs'){if(p.length>2)unsupported('绝对值内的表达式超出分段线性范围。');return scale(p,signOn(p,cell)<0?-1:1);}
      if(p.length!==1)unsupported('该函数不是有限分段常数或分段线性信号；保留原公式绘图，不生成折线解析式。');
      return [callValue(n.name,p[0])];
    }
    // Resolve only conditions whose sign was proved over the entire open cell.
    // A zero coefficient polynomial is not alone a numerical zero proof:
    // ((t+1e16)-t)-1e16 can have a nonzero IEEE-754 residual.
    function resolved(n,cell){
      if(++work>LIMIT.work)unsupported('精确分析超过计算预算。');
      const constant=value=>({value:finite(value),key:'N'+number(value)});
      if(n.type==='number')return constant(n.value);if(n.type==='var')return {key:'V'};
      if(n.type==='unary'){const a=resolved(n.arg,cell);return a.value!==undefined?constant(n.op==='-'?-a.value:a.value):n.op==='+'?a:{key:'-('+a.key+')'};}
      if(n.type==='call'){
        if(n.name==='where')return resolved(n.args[condition(n.args[0],cell)?1:2],cell);
        if(n.name==='u'||n.name==='delta'){const a=affine(n.args[0]);if(!a)unsupported('自变量须为仿射式。');return constant(n.name==='u'?(signOn(a,cell)>=0?1:0):domain==='dt'&&a[1]===0&&a[0]===0?1:0);}
        const a=resolved(n.args[0],cell);return a.value!==undefined?constant(callValue(n.name,a.value)):{key:n.name+'('+a.key+')'};
      }
      const a=resolved(n.left,cell),b=resolved(n.right,cell);
      if(a.value!==undefined&&b.value!==undefined)return constant(calculate(n.op,a.value,b.value));
      if(n.op==='-'&&a.key===b.key)return constant(0);
      if(n.op==='+'&&a.value===0)return b;if(['+','-'].includes(n.op)&&b.value===0)return a;
      if(n.op==='*'){if(a.value===0||b.value===0)return constant(0);if(a.value===1)return b;if(b.value===1)return a;}
      if(n.op==='/'&&b.value===1)return a;
      if(n.op==='^'&&b.value===0)return constant(1);
      return {key:'('+a.key+n.op+b.key+')'};
    }
    function valueOn(n,x,cell){
      if(++work>LIMIT.work)unsupported('精确分析超过计算预算。');
      if(n.type==='number')return n.value;if(n.type==='var')return x;if(n.type==='unary')return finite((n.op==='-'?-1:1)*valueOn(n.arg,x,cell));
      if(n.type==='binary')return calculate(n.op,valueOn(n.left,x,cell),valueOn(n.right,x,cell));
      if(n.name==='where')return valueOn(n.args[condition(n.args[0],cell)?1:2],x,cell);
      if(n.name==='u'||n.name==='delta'){const a=affine(n.args[0]);return n.name==='u'?(signOn(a,cell)>=0?1:0):domain==='dt'&&a[1]===0&&a[0]===0?1:0;}
      return callValue(n.name,valueOn(n.args[0],x,cell));
    }
    const largest=b=>Math.max(Math.abs(b.lo),Math.abs(b.hi));
    function stableCondition(n,cell){
      if(n.type==='binary'&&['&&','||'].includes(n.op)){stableCondition(n.left,cell);stableCondition(n.right,cell);return;}
      const a=affine(n.left),b=affine(n.right),left=roundoff(n.left,cell),right=roundoff(n.right,cell);
      if(!a||!b)unsupported('条件不能可靠转换为仿射比较。');
      const slope=finite(a[1]-b[1]),offset=finite(a[0]-b[0]),size=Math.max(1,Math.abs(offset+slope*cell.lo),Math.abs(offset+slope*cell.hi));
      if(left.error+right.error>1e-11*size)unsupported('分段条件存在严重浮点消减，无法可靠确定跳变位置。');
    }
    function roundoff(n,cell){
      if(++work>LIMIT.work)unsupported('精确分析超过计算预算。');
      const fixed=v=>({lo:finite(v),hi:finite(v),error:0,key:'N'+number(v),constant:true});
      if(n.type==='number')return fixed(n.value);if(n.type==='var')return {lo:cell.lo,hi:cell.hi,error:0,key:'V',constant:false};
      if(n.type==='unary'){const a=roundoff(n.arg,cell);return n.op==='-'?{...a,lo:-a.hi,hi:-a.lo,key:'-('+a.key+')'}:a;}
      if(n.type==='call'){
        if(n.name==='where'){stableCondition(n.args[0],cell);return roundoff(n.args[condition(n.args[0],cell.proof||cell)?1:2],cell);}
        if(n.name==='u'||n.name==='delta'){
          const a=affine(n.args[0]),argument=roundoff(n.args[0],cell),size=Math.max(1,Math.abs(a[0]+a[1]*cell.lo),Math.abs(a[0]+a[1]*cell.hi));
          if(argument.error>1e-11*size)unsupported('阶跃或冲激自变量存在严重浮点消减，无法可靠确定支点。');
          return fixed(valueOn(n,0,cell.proof||cell));
        }
        const a=roundoff(n.args[0],cell);if(a.constant)return fixed(callValue(n.name,a.lo));
        if(n.name==='abs'){const s=signOn(poly(n.args[0],cell.proof||cell),cell.proof||cell);return s<0?{...a,lo:-a.hi,hi:-a.lo,key:'abs('+a.key+')'}:{...a,key:'abs('+a.key+')'};}
        unsupported('非线性区间不转换为折线。');
      }
      const a=roundoff(n.left,cell),b=roundoff(n.right,cell);
      if(a.constant&&b.constant)return fixed(calculate(n.op,a.lo,b.lo));
      if(n.op==='-'&&a.key===b.key)return fixed(0);
      if(n.op==='*'&&(a.lo===0&&a.hi===0&&a.error===0||b.lo===0&&b.hi===0&&b.error===0))return fixed(0);
      if(n.op==='+'&&a.lo===0&&a.hi===0&&a.error===0)return b;if(['+','-'].includes(n.op)&&b.lo===0&&b.hi===0&&b.error===0)return a;
      if(n.op==='*'&&a.constant&&a.lo===1)return b;if(['*','/'].includes(n.op)&&b.constant&&b.lo===1)return a;
      let lo,hi,error;
      if(n.op==='+'||n.op==='-'){
        lo=finite(n.op==='+'?a.lo+b.lo:a.lo-b.hi);hi=finite(n.op==='+'?a.hi+b.hi:a.hi-b.lo);
        // Sterbenz's lemma: subtracting nearby same-sign floating numbers is
        // exact. This keeps (t-start)/(end-start) stable for narrow intervals.
        const aa=[Math.min(Math.abs(a.lo),Math.abs(a.hi)),largest(a)],bb=[Math.min(Math.abs(b.lo),Math.abs(b.hi)),largest(b)];
        const exact=n.op==='-'&&a.error===0&&b.error===0&&(a.lo>0&&b.lo>0||a.hi<0&&b.hi<0)&&aa[1]<=2*bb[0]&&bb[1]<=2*aa[0];
        error=a.error+b.error+(exact?0:4*Number.EPSILON*(largest(a)+largest(b)));
      }else if(n.op==='*'){
        const values=[a.lo*b.lo,a.lo*b.hi,a.hi*b.lo,a.hi*b.hi].map(finite);lo=Math.min(...values);hi=Math.max(...values);error=largest(a)*b.error+largest(b)*a.error+a.error*b.error+4*Number.EPSILON*Math.max(Math.abs(lo),Math.abs(hi));
      }else if(n.op==='/'&&b.constant&&b.lo!==0){
        const values=[a.lo/b.lo,a.hi/b.lo].map(finite);lo=Math.min(...values);hi=Math.max(...values);error=a.error/Math.abs(b.lo)+4*Number.EPSILON*Math.max(Math.abs(lo),Math.abs(hi));
      }else if(n.op==='^'&&b.constant&&Number.isInteger(b.lo)&&b.lo>=0&&b.lo<=LIMIT.degree){
        const values=[a.lo**b.lo,a.hi**b.lo,...(a.lo<=0&&a.hi>=0&&b.lo>0?[0]:[])].map(finite);lo=Math.min(...values);hi=Math.max(...values);error=b.lo*Math.max(1,largest(a)**Math.max(0,b.lo-1))*a.error+8*Number.EPSILON*Math.max(Math.abs(lo),Math.abs(hi));
      }else unsupported('该运算的浮点稳定性无法在整个区间内保证。');
      return {lo,hi,error:finite(error),key:'('+a.key+n.op+b.key+')',constant:false};
    }
    const edges=[-Infinity,...boundaries,Infinity],cells=[];
    for(let i=0;i<edges.length-1;i++){const cell={lo:edges[i],hi:edges[i+1]},p=poly(ast,cell);if((i===0||i===edges.length-2)&&!zero(p))unsupported('这是无限支撑信号；不会把绘图窗口之外强行设为0。');if(p.length>2)unsupported('存在二次或更高次区间，不能准确表示为分段线性波形。');if(zero(p)&&resolved(ast,cell).value!==0)unsupported('代数系数抵消不能保证数值零尾部；请改写为更稳定的公式。');cells.push({...cell,p});}
    const model={version:1,domain,segments:[],samples:[],endpoints:[],impulses:[],outside:0};
    if(domain==='ct'){
      for(const c of cells){
        const finiteCell={lo:Math.max(-global.WaveformMath.limits.magnitude,c.lo),hi:Math.min(global.WaveformMath.limits.magnitude,c.hi),proof:c};
        const guard=roundoff(ast,finiteCell);if(zero(c.p)){if(guard.lo!==0||guard.hi!==0||guard.error!==0)unsupported('数值零区间尚不能可靠证明。');continue;}
        const y0=valueOn(ast,c.lo,c),y1=valueOn(ast,c.hi,c),scale=Math.max(1,Math.abs(y0),Math.abs(y1));
        if(guard.error>1e-11*scale)unsupported('公式存在严重浮点消减，不能可靠转换为分段线性模型；请使用(t-起点)形式或分段编辑。');
        model.segments.push({start:c.lo,end:c.hi,y0,y1,leftClosed:false,rightClosed:false});
      }
      for(const at of boundaries){const value=signal.evaluate(at),right=model.segments.find(s=>s.start===at&&s.y0===value),left=model.segments.find(s=>s.end===at&&s.y1===value);if(right)right.leftClosed=true;else if(left)left.rightClosed=true;else if(value!==0)model.endpoints.push({at,value});}
    }else{
      for(const c of cells)if(zero(c.p)){
        const clip={lo:Math.max(-global.WaveformMath.limits.index,c.lo),hi:Math.min(global.WaveformMath.limits.index,c.hi),proof:c};
        if(clip.lo<=clip.hi){const guard=roundoff(ast,clip);if(guard.lo!==0||guard.hi!==0||guard.error!==0)unsupported('离散零区间存在无法可靠消除的数值误差。');}
      }
      const indices=new Set(boundaries.filter(Number.isInteger));
      for(const c of cells)if(!zero(c.p))for(let n=Math.floor(c.lo)+1;n<=Math.ceil(c.hi)-1;n++){indices.add(n);if(indices.size>global.WaveformMath.limits.samples)unsupported('有限序列的有效样本超过1000个。');}
      if(indices.size>global.WaveformMath.limits.samples||[...indices].some(n=>Math.abs(n)>global.WaveformMath.limits.index))unsupported('有限序列数量或索引超出编辑范围。');
      for(const n of [...indices].sort((a,b)=>a-b)){const value=signal.evaluate(n);if(value!==0)model.samples.push({n,value});}
    }
    return global.WaveformMath.normalize(model);
  }
  function expressionForLine(s,variable){if(s.y0===s.y1)return number(s.y0);return `(${number(s.y0)})+((${number(s.y1)})-(${number(s.y0)}))*((${variable}-(${number(s.start)}))/((${number(s.end)})-(${number(s.start)})))`;}
  function toExpression(raw){
    const model=global.WaveformMath.normalize(raw),v=model.domain==='dt'?'n':'t';let terms=[];
    if(model.domain==='dt')terms=model.samples.filter(s=>s.value!==0).map(s=>`(${number(s.value)})*delta[${s.n===0?'n':`n-(${number(s.n)})`}]`);
    else{
      const points=unique(model.segments.flatMap(s=>[s.start,s.end]).concat(model.endpoints.map(p=>p.at))),overrides=[];
      for(const at of points){const s=model.segments.find(s=>at>=s.start&&at<s.end),base=s?s.y0+(s.y1-s.y0)*((at-s.start)/(s.end-s.start)):0,value=global.WaveformMath.evaluate(model,at);if(value!==base)overrides.push({at,value});}
      for(const s of model.segments)if(s.y0!==0||s.y1!==0){const exclusions=overrides.filter(p=>p.at>=s.start&&p.at<s.end).map(p=>`&&t!=(${number(p.at)})`).join('');terms.push(`where(t>=(${number(s.start)})&&t<(${number(s.end)})${exclusions},${expressionForLine(s,v)},0)`);}
      for(const p of overrides)if(p.value!==0)terms.push(`where(t==(${number(p.at)}),${number(p.value)},0)`);
    }
    const source=terms.length?terms.map(s=>'('+s+')').join('+'):'0';if(source.length>LIMIT.source)throw new Error('精确公式超过4096字符预算，请减少分段或孤立端点；没有生成近似公式。');
    try{global.SignalEngine.compile(source,{domain:model.domain});}catch(error){throw new Error('精确公式超出当前解析预算，请减少分段；'+error.message);}return source;
  }
  const texNumber=v=>{const s=number(v),m=/^([^e]+)e([+-]?\d+)$/.exec(s);return m?`${m[1]}\\times10^{${Number(m[2])}}`:s;};
  function toLatex(raw){
    const m=global.WaveformMath.normalize(raw);if(m.domain==='dt')return m.samples.filter(s=>s.value!==0).map(s=>`(${texNumber(s.value)})\\delta[n-(${texNumber(s.n)})]`).join('+')||'0';
    const rows=m.endpoints.map(p=>`${texNumber(p.value)}&t=${texNumber(p.at)}`);
    for(const s of m.segments){const line=s.y0===s.y1?texNumber(s.y0):`${texNumber(s.y0)}+\\frac{(${texNumber(s.y1)})-(${texNumber(s.y0)})}{(${texNumber(s.end)})-(${texNumber(s.start)})}(t-(${texNumber(s.start)}))`;const exclusions=m.endpoints.filter(p=>p.at>=s.start&&p.at<=s.end).map(p=>`,\\;t\\ne ${texNumber(p.at)}`).join('');rows.push(`${line}&${texNumber(s.start)}${s.leftClosed?'\\le':'<'}t${s.rightClosed?'\\le':'<'}${texNumber(s.end)}${exclusions}`);}
    return rows.length?'\\begin{cases}'+rows.concat('0&\\text{其他}').join('\\\\')+'\\end{cases}':'0';
  }
  function analyze(text,options={}){
    const domain=domainOf(options.domain||'ct'),source=normalizeSource(text,domain),signal=global.SignalEngine.compile(source,{domain}),latex=global.SignalEngine.toLatex(signal);
    const base={source,domain,signal,editable:false,model:null,reason:'',latex};
    if(domain==='ct'&&signal.impulses.length)return {...base,reason:'连续Dirac冲激按位置与权重符号绘图；不能当成有限高度分段波形拖动或自动判题。'};
    try{const model=certificate(global.SignalEngine.inspect(signal).ast,domain,signal);toExpression(model);return {...base,editable:true,model,reason:'已按完整分界区间和零尾部证明为有限信号，可精确编辑；不是采样拟合。'};}
    catch(error){if(error instanceof Unsupported||error instanceof Error)return {...base,reason:error.message};throw error;}
  }
  global.WaveformExpressions=Object.freeze({normalizeSource,analyze,toExpression,toLatex,limits:LIMIT});
})(typeof window!=='undefined'?window:globalThis);
