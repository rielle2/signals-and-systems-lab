/* SignalEngine: bounded parser + explicit ordinary/atomic distribution model.
 * No eval / Function / implicit property access. CT evaluate() is the ordinary
 * part only; impulses contain exact Dirac weights. DT delta is Kronecker.
 * where(condition,yes,no) and piecewise(condition,yes,no) are lazy branches.
 * Conditions use affine comparisons with && / ||. u(0)=1. */
(function(global){
  'use strict';
  const LIMIT={source:4096,tokens:2048,nodes:1024,depth:64,rows:32,steps:32768,frequencies:512,work:8388608};
  class SignalError extends Error{constructor(message,position=0){super(`${message}（位置 ${position+1}）`);this.name='SignalError';this.position=position;}}
  const fail=(message,node)=>{throw new SignalError(message,typeof node==='number'?node:node?.pos||0);};
  const finite=(v,node)=>{if(typeof v!=='number'||!Number.isFinite(v))fail('运算结果不是有限实数，请检查定义域、分母与参数',node);return v;};
  const num=(value,pos=0)=>({type:'number',value,pos});
  const bin=(op,left,right,pos=0)=>({type:'binary',op,left,right,pos});
  const functions=new Set(['sin','cos','tan','exp','log','sqrt','abs','floor','ceil','u','delta','where','piecewise']);
  function tokenize(source){
    if(typeof source!=='string'||!source.trim())fail('请输入信号表达式',0);
    if(source.length>LIMIT.source)fail(`表达式最多 ${LIMIT.source} 个字符`,LIMIT.source);
    const ts=[];let i=0;
    while(i<source.length){
      if(/\s/.test(source[i])){i++;continue;}
      const start=i,rest=source.slice(i);let match;
      if((match=/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(rest))){ts.push({type:'number',value:finite(Number(match[0]),start),pos:start});i+=match[0].length;}
      else if((match=/^[a-zA-Z_][a-zA-Z_0-9]*/.exec(rest))){ts.push({type:'id',value:match[0],pos:start});i+=match[0].length;}
      else if(source[i]==='π'){ts.push({type:'id',value:'pi',pos:start});i++;}
      else{const two=source.slice(i,i+2);if(['<=','>=','==','!=','&&','||'].includes(two)){ts.push({type:two,pos:start});i+=2;}else if('+-*/^(),[]<>'.includes(source[i])){ts.push({type:source[i],pos:start});i++;}else fail(`不支持字符“${source[i]}”`,start);}
      if(ts.length>LIMIT.tokens)fail('表达式过于复杂',start);
    }
    ts.push({type:'end',pos:source.length});return ts;
  }
  function parse(source,domain){
    const ts=tokenize(source);let index=0,nodes=0,depth=0;
    const peek=()=>ts[index],take=()=>ts[index++];
    function make(n){if(++nodes>LIMIT.nodes)fail('表达式节点过多',n);return n;}
    function expect(type){if(peek().type!==type)fail(`此处需要 ${type}`,peek());return take();}
    function enter(fn){if(++depth>LIMIT.depth)fail('括号或幂运算嵌套过深',peek());try{return fn();}finally{depth--;}}
    function primary(){return enter(()=>{
      const t=take();
      if(t.type==='number')return make(num(t.value,t.pos));
      if(t.type==='('){const n=or();expect(')');return n;}
      if(t.type!=='id')fail('此处需要数值、变量或函数',t);
      if(t.value==='pi'||t.value==='e')return make(num(t.value==='pi'?Math.PI:Math.E,t.pos));
      if(t.value===(domain==='dt'?'n':'t'))return make({type:'var',pos:t.pos});
      if(!functions.has(t.value))fail(`未知名称 ${t.value}；请使用显式乘号 *`,t);
      const bracket=peek().type==='[';
      if(bracket&&!['delta','u'].includes(t.value))fail('方括号只用于离散阶跃或冲激',peek());
      if(bracket&&domain!=='dt')fail('连续时间函数请使用圆括号',peek());
      expect(bracket?'[':'(');const args=[or()];
      while(peek().type===','){take();args.push(or());if(args.length>3)fail('函数参数过多',t);}
      expect(bracket?']':')');const arity=['where','piecewise'].includes(t.value)?3:1;
      if(args.length!==arity)fail(`${t.value} 需要 ${arity} 个参数`,t);
      return make({type:'call',name:t.value==='piecewise'?'where':t.value,args,pos:t.pos});
    });}
    function power(){const left=primary();return peek().type==='^'?(take(),make(bin('^',left,unary(),left.pos))):left;}
    function unary(){return enter(()=>{if(['+','-'].includes(peek().type)){const t=take();return make({type:'unary',op:t.type,arg:unary(),pos:t.pos});}return power();});}
    function multiply(){let n=unary();while(['*','/'].includes(peek().type)){const t=take();n=make(bin(t.type,n,unary(),t.pos));}return n;}
    function add(){let n=multiply();while(['+','-'].includes(peek().type)){const t=take();n=make(bin(t.type,n,multiply(),t.pos));}return n;}
    function compare(){let n=add();if(['<','>','<=','>=','==','!='].includes(peek().type)){const t=take();n=make(bin(t.type,n,add(),t.pos));}return n;}
    function and(){let n=compare();while(peek().type==='&&'){const t=take();n=make(bin(t.type,n,compare(),t.pos));}return n;}
    function or(){let n=and();while(peek().type==='||'){const t=take();n=make(bin(t.type,n,and(),t.pos));}return n;}
    const ast=or();if(peek().type!=='end')fail('表达式未结束；乘法必须写 *，比较须用 && 或 || 连接',peek());return ast;
  }
  const comparisons=new Set(['<','>','<=','>=','==','!=']);
  function evaluate(n,x){
    let a,b,v;
    if(n.type==='number')return n.value;if(n.type==='var')return x;
    if(n.type==='unary')return finite((n.op==='-'?-1:1)*evaluate(n.arg,x),n);
    if(n.type==='binary'){
      a=evaluate(n.left,x);
      if(n.op==='&&')return a?evaluate(n.right,x):false;
      if(n.op==='||')return a?true:evaluate(n.right,x);
      b=evaluate(n.right,x);
      switch(n.op){case '+':v=a+b;break;case '-':v=a-b;break;case '*':v=a*b;break;case '/':if(b===0)fail('分母不能为零',n);v=a/b;break;case '^':v=a**b;break;case '<':return a<b;case '>':return a>b;case '<=':return a<=b;case '>=':return a>=b;case '==':return a===b;case '!=':return a!==b;default:fail('未知运算',n);}
      return finite(v,n);
    }
    if(n.name==='where')return evaluate(n.args[evaluate(n.args[0],x)?1:2],x);
    a=evaluate(n.args[0],x);
    switch(n.name){case 'u':return a>=0?1:0;case 'delta':if(!Number.isInteger(a))fail('离散冲激的索引必须是整数',n);return a===0?1:0;case 'log':v=Math.log(a);break;case 'tan':if(Math.abs(Math.cos(a))<1e-14)fail('tan 在此处接近奇点，不能按有限函数值求值',n);v=Math.tan(a);break;default:v=Math[n.name](a);}
    return finite(v,n);
  }
  function affine(n){
    if(n.type==='number')return {a:0,b:n.value};if(n.type==='var')return {a:1,b:0};
    if(n.type==='unary'){const p=affine(n.arg),s=n.op==='-'?-1:1;return {a:s*p.a,b:s*p.b};}
    if(n.type==='binary'&&['+','-','*','/'].includes(n.op)){
      const p=affine(n.left),q=affine(n.right);
      if(n.op==='+')return {a:finite(p.a+q.a,n),b:finite(p.b+q.b,n)};
      if(n.op==='-')return {a:finite(p.a-q.a,n),b:finite(p.b-q.b,n)};
      if(n.op==='*'&&(p.a===0||q.a===0))return {a:finite(p.a*q.b+q.a*p.b,n),b:finite(p.b*q.b,n)};
      if(n.op==='/'&&q.a===0&&q.b!==0)return {a:finite(p.a/q.b,n),b:finite(p.b/q.b,n)};
    }
    fail('此处仅支持仿射表达式 a*t+b 或 a*n+b',n);
  }
  const isZero=n=>n.type==='number'&&n.value===0;
  function combine(op,a,b,pos){
    if(['+','-','*'].includes(op)&&isZero(a)&&isZero(b))return {...num(0,pos),atomicZero:!!(a.atomicZero||b.atomicZero)};
    if(op==='+'&&isZero(a))return b;if(['+','-'].includes(op)&&isZero(b))return a;
    if(op==='*'&&((isZero(a)&&a.atomicZero)||(isZero(b)&&b.atomicZero)))return {...num(0,pos),atomicZero:true};
    if(a.type==='number'&&b.type==='number'){try{return num(evaluate(bin(op,a,b,pos),0),pos);}catch(e){if(!(e instanceof SignalError))throw e;}}
    return bin(op,a,b,pos);
  }
  function mergeAtoms(atoms){const out=[];for(const p of atoms){finite(p.at);finite(p.weight);const q=out.find(x=>x.at===p.at);if(q)q.weight=finite(q.weight+p.weight);else out.push({at:p.at,weight:p.weight});}return out.filter(p=>p.weight!==0).sort((a,b)=>a.at-b.at);}
  function condition(n,breaks){
    if(n.type==='binary'&&['&&','||'].includes(n.op)){condition(n.left,breaks);condition(n.right,breaks);return;}
    if(n.type!=='binary'||!comparisons.has(n.op))fail('条件必须是仿射比较，可用 &&、|| 连接',n);
    const p=affine(n.left),q=affine(n.right),a=p.a-q.a,b=p.b-q.b;
    if(a!==0)breaks.push(finite(-b/a,n));
  }
  function continuousAt(n,at){
    if(n.type==='number'||n.type==='var')return;
    if(n.type==='unary'){continuousAt(n.arg,at);return;}
    if(n.type==='binary'){continuousAt(n.left,at);continuousAt(n.right,at);finite(evaluate(n,at),n);return;}
    if(n.name==='where'){
      const points=[];condition(n.args[0],points);if(points.some(p=>Math.abs(p-at)<=1e-12*Math.max(1,Math.abs(at))))fail('冲激支撑处的分段乘子有边界，不能指定冲激乘不连续函数',n);
      continuousAt(n.args[evaluate(n.args[0],at)?1:2],at);return;
    }
    continuousAt(n.args[0],at);const v=evaluate(n.args[0],at);
    if(n.name==='u'){const p=affine(n.args[0]);if(p.a!==0&&Math.abs(v)<1e-12)fail('u 的跳变点不能直接与同位置的 Dirac 冲激相乘',n);}
    if(['floor','ceil'].includes(n.name)&&containsVariable(n.args[0])&&Number.isInteger(v))fail('冲激不能与整数边界处的 floor/ceil 乘子相乘',n);
    if(n.name==='sqrt'&&v===0&&containsVariable(n.args[0]))fail('冲激乘子的平方根定义域边界不支持',n);
    finite(evaluate(n,at),n);
  }
  function containsVariable(n){return n.type==='var'||(n.type==='unary'&&containsVariable(n.arg))||(n.type==='binary'&&(containsVariable(n.left)||containsVariable(n.right)))||(n.type==='call'&&n.args.some(containsVariable));}
  function split(ast,domain,breaks,singularities){
    function visit(n){
      if(n.type==='number'||n.type==='var')return {regular:n,atoms:[]};
      if(n.type==='unary'){const p=visit(n.arg);return {regular:isZero(p.regular)?p.regular:{...n,arg:p.regular},atoms:p.atoms.map(a=>({at:a.at,weight:(n.op==='-'?-1:1)*a.weight}))};}
      if(n.type==='binary'){
        if(!['+','-','*','/','^'].includes(n.op))fail('比较运算只能出现在 where/piecewise 的条件中',n);
        const p=visit(n.left),q=visit(n.right);
        if(['+','-'].includes(n.op))return {regular:combine(n.op,p.regular,q.regular,n.pos),atoms:mergeAtoms([...p.atoms,...q.atoms.map(a=>({at:a.at,weight:(n.op==='-'?-1:1)*a.weight}))])};
        if(n.op==='^'&&(p.atoms.length||q.atoms.length))fail('不支持冲激的幂或非线性运算',n);
        if(n.op==='/'&&q.atoms.length)fail('冲激不能作为分母',n);
        if(n.op==='*'&&p.atoms.length&&q.atoms.length)fail('Dirac 冲激之间不能直接相乘',n);
        if(n.op==='/'){
          try{const a=affine(q.regular);if(a.a!==0){const root=-a.b/a.a;breaks.push(root);singularities.push(root);}}catch(e){if(!(e instanceof SignalError))throw e;}
        }
        const atoms=[];
        if(p.atoms.length)for(const a of p.atoms){continuousAt(q.regular,a.at);const v=evaluate(q.regular,a.at);if(n.op==='/'&&v===0)fail('冲激除数在支撑处为零',n);atoms.push({at:a.at,weight:finite(n.op==='/'?a.weight/v:a.weight*v,n)});}
        if(q.atoms.length)for(const a of q.atoms){continuousAt(p.regular,a.at);atoms.push({at:a.at,weight:finite(a.weight*evaluate(p.regular,a.at),n)});}
        return {regular:combine(n.op,p.regular,q.regular,n.pos),atoms:mergeAtoms(atoms)};
      }
      if(n.name==='where'){
        const boundaries=[];condition(n.args[0],boundaries);breaks.push(...boundaries);
        if(!containsVariable(n.args[0]))return visit(n.args[evaluate(n.args[0],0)?1:2]);
        const yes=visit(n.args[1]),no=visit(n.args[2]),atoms=[];
        for(const [part,wanted] of [[yes,true],[no,false]])for(const a of part.atoms){
          if(boundaries.some(p=>Math.abs(p-a.at)<=1e-12*Math.max(1,Math.abs(a.at))))fail('分段边界上的冲激选择不明确，请改变边界或单独相加',n);
          if(Boolean(evaluate(n.args[0],a.at))===wanted)atoms.push(a);
        }
        return {regular:isZero(yes.regular)&&isZero(no.regular)?{...num(0),atomicZero:!!(yes.regular.atomicZero||no.regular.atomicZero)}:{...n,args:[n.args[0],yes.regular,no.regular]},atoms:mergeAtoms(atoms)};
      }
      if(['u','delta'].includes(n.name)){
        const p=affine(n.args[0]);
        if(domain==='dt'&&(!Number.isInteger(p.a)||!Number.isInteger(p.b)))fail('离散阶跃/冲激的仿射索引系数和位移必须是整数',n);
        if(n.name==='delta'&&domain==='ct'){
          if(p.a===0)fail('连续冲激 delta(a*t+b) 要求 a 非零',n);
          const at=finite(-p.b/p.a,n);breaks.push(at);return {regular:{...num(0),atomicZero:true},atoms:[{at,weight:finite(1/Math.abs(p.a),n)}]};
        }
        if(p.a!==0)breaks.push(finite(-p.b/p.a,n));return {regular:n,atoms:[]};
      }
      const p=visit(n.args[0]);if(p.atoms.length)fail('冲激不能放入普通非线性函数',n);
      const regular={...n,args:[p.regular]};
      if(!containsVariable(regular)){try{return {regular:num(evaluate(regular,0),n.pos),atoms:[]};}catch(e){if(!(e instanceof SignalError))throw e;}}
      return {regular,atoms:[]};
    }
    return visit(ast);
  }
  const internals=new WeakMap();
  function makeSignal(ast,source,domain){
    const breaks=[],singularities=[],parts=split(ast,domain,breaks,singularities);
    if(!containsVariable(parts.regular))finite(evaluate(parts.regular,0),parts.regular);
    const signal={domain,source,impulses:Object.freeze(mergeAtoms(parts.atoms).map(Object.freeze)),breakpoints:Object.freeze([...new Set(breaks)].filter(Number.isFinite).sort((a,b)=>a-b)),regularZero:isZero(parts.regular),
      evaluate(x){finite(x);if(domain==='dt'&&!Number.isInteger(x))fail('离散信号只在整数索引处定义');return finite(evaluate(parts.regular,x),parts.regular);}};
    internals.set(signal,{ast,regular:parts.regular,singularities});return Object.freeze(signal);
  }
  function compile(source,{domain='ct'}={}){if(!['ct','dt'].includes(domain))fail('domain 必须是 ct 或 dt');if(typeof source!=='string')fail('信号表达式必须是字符串');if(source.length>LIMIT.source)fail(`表达式最多 ${LIMIT.source} 个字符`,LIMIT.source);const trimmed=source.trim();return makeSignal(parse(trimmed,domain),trimmed,domain);}
  function piecewise(rows,{domain='ct'}={}){
    if(!Array.isArray(rows)||rows.length>LIMIT.rows)fail(`分段行数必须不超过 ${LIMIT.rows}`);
    let source='0';for(let i=rows.length-1;i>=0;i--){const r=rows[i];if(!r||typeof r.condition!=='string'||typeof r.expression!=='string')fail('每个分段需要 condition 和 expression 字符串');source=`where((${r.condition}),(${r.expression}),(${source}))`;}
    return compile(source,{domain});
  }
  function known(signal){if(!internals.has(signal))fail('请使用 SignalEngine.compile/piecewise 创建信号');return internals.get(signal);}
  // Read-only syntax description for exact finite-waveform certification.
  // Callers receive a clone, never the parser's internal nodes or executable code.
  function inspect(signal){const {ast}=known(signal);return {ast:JSON.parse(JSON.stringify(ast))};}
  function stringAST(n,variable){
    if(n.type==='number')return `(${n.value})`;if(n.type==='var')return variable;
    if(n.type==='unary')return `(${n.op}${stringAST(n.arg,variable)})`;
    if(n.type==='binary')return `(${stringAST(n.left,variable)}${n.op}${stringAST(n.right,variable)})`;
    return `${n.name}(${n.args.map(a=>stringAST(a,variable)).join(',')})`;
  }
  function transform(signal,{a=1,b=0,A=1}={}){
    const {ast}=known(signal);[a,b,A].forEach(v=>finite(v));
    if(signal.domain==='dt'&&(!Number.isInteger(a)||!Number.isInteger(b)))fail('离散时间变换要求 a、b 为整数，不能隐式插值');
    if(signal.domain==='ct'&&a===0&&signal.impulses.length)fail('带冲激的连续时间信号不能按 a=0 缩放');
    const variable=signal.domain==='dt'?'n':'t',arg=`((${a})*${variable}+(${b}))`;
    return compile(`(${A})*(${stringAST(ast,arg)})`,{domain:signal.domain});
  }
  function bounds(options={},domain='ct'){
    const min=options.min??-10,max=options.max??10,steps=options.steps??2048;[min,max,steps].forEach(v=>finite(v));
    if(!(max>min)||Math.abs(min)>1e9||Math.abs(max)>1e9||max-min>1e6)fail('积分/求和窗口需有限且 min < max，长度不超过 10^6');
    if(domain==='dt'&&(!Number.isInteger(min)||!Number.isInteger(max)))fail('离散求和窗口端点必须为整数');
    if(!Number.isInteger(steps)||steps<8||steps>LIMIT.steps)fail(`steps 必须是 8 至 ${LIMIT.steps} 的整数`);
    if(domain==='dt'&&max-min+1>LIMIT.steps)fail('离散求和样本数超过预算');return {min,max,steps};
  }
  function ensureNoKnownSingularity(signal,min,max,reflection){
    for(const root of known(signal).singularities){const at=reflection===undefined?root:reflection-root;if(at>=min&&at<=max)fail('窗口包含已知分母零点，不能把网格抵消当作收敛积分');}
  }
  // Conservative interval-domain guard. A rejected window is unsupported, not a
  // claim of divergence: integrable endpoint singularities also need analytics.
  function interval(n,lo,hi){
    const ordered=v=>[finite(Math.min(...v),n),finite(Math.max(...v),n)];
    if(n.type==='number')return [n.value,n.value];if(n.type==='var')return [lo,hi];
    if(n.type==='unary'){const r=interval(n.arg,lo,hi);return n.op==='-'?[-r[1],-r[0]]:r;}
    if(n.type==='binary'){
      const a=interval(n.left,lo,hi),b=interval(n.right,lo,hi);
      if(n.op==='+')return ordered([a[0]+b[0],a[1]+b[1]]);
      if(n.op==='-')return ordered([a[0]-b[1],a[1]-b[0]]);
      if(n.op==='*'){
        if(stringAST(n.left,'t')===stringAST(n.right,'t'))return [a[0]<=0&&a[1]>=0?0:Math.min(a[0]**2,a[1]**2),finite(Math.max(a[0]**2,a[1]**2),n)];
        return ordered([a[0]*b[0],a[0]*b[1],a[1]*b[0],a[1]*b[1]]);
      }
      if(n.op==='/'){
        if(b[0]<=0&&b[1]>=0)fail('积分窗口不能证明分母远离零点；奇异积分或可去奇点需另写解析模型',n);
        return ordered([a[0]/b[0],a[0]/b[1],a[1]/b[0],a[1]/b[1]]);
      }
      if(n.op==='^'){
        if(b[0]===b[1]&&Number.isInteger(b[0])){
          const power=b[0];if(power<0&&a[0]<=0&&a[1]>=0)fail('负幂在积分窗口内可能有奇点',n);
          const values=[a[0]**power,a[1]**power];if(power>0&&power%2===0&&a[0]<=0&&a[1]>=0)values.push(0);return ordered(values);
        }
        if(a[0]<0||(a[0]===0&&b[0]<=0))fail('积分窗口内不能保证非整数幂的实数定义域',n);
        return ordered([a[0]**b[0],a[0]**b[1],a[1]**b[0],a[1]**b[1]]);
      }
      fail('不支持对条件本身作积分',n);
    }
    if(n.name==='where')return interval(n.args[evaluate(n.args[0],lo+(hi-lo)/2)?1:2],lo,hi);
    const a=interval(n.args[0],lo,hi);
    if(n.name==='u')return [a[0]>=0?1:0,a[1]>=0?1:0];
    if(n.name==='abs')return [a[0]<=0&&a[1]>=0?0:Math.min(Math.abs(a[0]),Math.abs(a[1])),Math.max(Math.abs(a[0]),Math.abs(a[1]))];
    if(n.name==='sqrt'&&a[0]<0)fail('积分窗口不能保证 sqrt 的非负定义域',n);
    if(n.name==='log'&&a[0]<=0)fail('积分窗口包含 log 的非正值或奇异端点',n);
    if(n.name==='tan'){
      const k=Math.ceil((a[0]-Math.PI/2)/Math.PI),pole=Math.PI/2+k*Math.PI;
      if((pole>=a[0]-1e-14&&pole<=a[1]+1e-14)||Math.abs(Math.cos(a[0]))<1e-14||Math.abs(Math.cos(a[1]))<1e-14)fail('积分窗口内可能有 tan 奇点',n);
    }
    if(n.name==='sin'||n.name==='cos'){
      if(a[1]-a[0]>=2*Math.PI)return [-1,1];const values=[Math[n.name](a[0]),Math[n.name](a[1])],offset=n.name==='sin'?Math.PI/2:0;
      for(let k=Math.ceil((a[0]-offset)/Math.PI);offset+k*Math.PI<=a[1];k++)values.push(Math[n.name](offset+k*Math.PI));return ordered(values);
    }
    return ordered([Math[n.name](a[0]),Math[n.name](a[1])]);
  }
  function validateWindow(signal,min,max){
    const data=known(signal),cuts=[min,...signal.breakpoints.filter(p=>p>min&&p<max),max];
    for(let i=0;i<cuts.length-1;i++)interval(data.regular,cuts[i],cuts[i+1]);
  }
  function midpoint(fn,b,points){
    const cuts=[b.min,...points.filter(x=>Number.isFinite(x)&&x>b.min&&x<b.max),b.max].sort((a,c)=>a-c).filter((x,i,a)=>!i||x!==a[i-1]);
    function grid(multiplier){let result=0;for(let i=0;i<cuts.length-1;i++){const left=cuts[i],right=cuts[i+1],n=Math.max(1,Math.ceil(b.steps*multiplier*(right-left)/(b.max-b.min))),d=(right-left)/n;for(let j=0;j<n;j++)result=finite(result+finite(fn(left+(j+.5)*d))*d);}return result;}
    const coarse=grid(1),value=grid(2);return {value,error:Math.abs(value-coarse)};
  }
  function convolutionImpulses(x,h){known(x);known(h);if(x.domain!==h.domain)fail('不能卷积不同时间域的信号');if(x.domain==='dt')return [];if(x.impulses.length*h.impulses.length>LIMIT.nodes)fail('冲激卷积项过多');return mergeAtoms(x.impulses.flatMap(a=>h.impulses.map(b=>({at:finite(a.at+b.at),weight:finite(a.weight*b.weight)}))));}
  function convolve(x,h,t,options={}){
    known(x);known(h);if(x.domain!==h.domain)fail('不能卷积不同时间域的信号');finite(t);const b=bounds(options,x.domain);
    if(x.domain==='dt'){
      if(!Number.isInteger(t))fail('离散卷积的输出索引必须为整数');let value=0;
      for(let k=b.min;k<=b.max;k++)value=finite(value+finite(x.evaluate(k)*h.evaluate(t-k)));
      return {value,error:0,approximate:true,bounds:b,label:'有限整数窗口求和；窗口内逐项计算，未声称覆盖无限序列'};
    }
    let ordinary={value:0,error:0};
    if(!x.regularZero&&!h.regularZero){validateWindow(x,b.min,b.max);validateWindow(h,t-b.max,t-b.min);ordinary=midpoint(k=>x.evaluate(k)*h.evaluate(t-k),b,[...x.breakpoints,...h.breakpoints.map(p=>t-p)]);}
    let value=ordinary.value;
    for(const atom of x.impulses)value=finite(value+atom.weight*h.evaluate(t-atom.at));
    for(const atom of h.impulses)value=finite(value+atom.weight*x.evaluate(t-atom.at));
    return {value,error:ordinary.error,approximate:true,bounds:b,label:'普通部分在窗口积分；全部冲激平移项解析求值；误差为两种网格差估计，非严格误差上界；跳变点按 u(0)=1 的点值约定；冲激×冲激见 convolutionImpulses'};
  }
  function spectrum(signal,options={}){
    known(signal);const b=bounds(options,signal.domain),frequencies=options.frequencies??Array.from({length:129},(_,i)=>(i-64)*Math.PI/16);
    if(!Array.isArray(frequencies)||frequencies.length>LIMIT.frequencies)fail(`频率数组最多 ${LIMIT.frequencies} 项`);
    frequencies.forEach(w=>finite(w));const work=(signal.domain==='dt'?b.max-b.min+1:b.steps*3)*frequencies.length;
    if(work>LIMIT.work)fail('频谱频点数乘以网格数超过计算预算');if(signal.domain==='ct'&&!signal.regularZero)validateWindow(signal,b.min,b.max);
    let error=0,mass=0;
    if(signal.domain==='dt'){for(let n=b.min;n<=b.max;n++)mass=finite(mass+Math.abs(signal.evaluate(n)));}
    else{if(!signal.regularZero)mass=midpoint(t=>Math.abs(signal.evaluate(t)),b,signal.breakpoints).value;for(const atom of signal.impulses)mass=finite(mass+Math.abs(atom.weight));}
    const phaseThreshold=32*Number.EPSILON*mass;
    const out=frequencies.map(w=>{
      let re=0,im=0;
      if(signal.domain==='dt'){for(let n=b.min;n<=b.max;n++){const v=signal.evaluate(n);re=finite(re+v*Math.cos(w*n));im=finite(im-v*Math.sin(w*n));}}
      else{
        if(!signal.regularZero){const r=midpoint(t=>signal.evaluate(t)*Math.cos(w*t),b,signal.breakpoints),i=midpoint(t=>-signal.evaluate(t)*Math.sin(w*t),b,signal.breakpoints);re=r.value;im=i.value;error=Math.max(error,Math.hypot(r.error,i.error));}
        for(const atom of signal.impulses){re=finite(re+atom.weight*Math.cos(w*atom.at));im=finite(im-atom.weight*Math.sin(w*atom.at));}
      }
      const magnitude=finite(Math.hypot(re,im)),phase=magnitude<=phaseThreshold?null:Math.atan2(im,re);return {frequency:w,re,im,magnitude,phase};
    });
    out.metadata={domain:signal.domain,bounds:b,approximate:true,error,phaseThreshold,label:signal.domain==='ct'?'普通部分的有限窗口 CTFT 近似，加上全部冲激的解析频谱；不保证完整 CTFT 存在；误差为两种网格差估计，非严格误差上界；相位在相对数值零阈值下隐藏':'有限整数窗口 DTFT；没有把有限和等同于无限序列的完整 DTFT；相位在相对数值零阈值下隐藏'};
    return out;
  }
  function toLatex(signal){
    const {ast}=known(signal),variable=signal.domain==='dt'?'n':'t';
    function tex(n){
      if(n.type==='number'){if(n.value===Math.PI)return '\\pi';if(n.value===Math.E)return 'e';const value=String(n.value),match=/^([^e]+)e([+-]?\d+)$/.exec(value);return match?`${match[1]}\\times10^{${Number(match[2])}}`:value;}if(n.type==='var')return variable;
      if(n.type==='unary')return `${n.op}\\left(${tex(n.arg)}\\right)`;
      if(n.type==='binary'){const a=tex(n.left),b=tex(n.right);if(n.op==='/')return `\\frac{${a}}{${b}}`;if(n.op==='^')return `{\\left(${a}\\right)}^{${b}}`;const op=({'*':'\\,','&&':'\\land','||':'\\lor','<=':'\\le','>=':'\\ge','==':'=','!=':'\\ne'})[n.op]||n.op;return `\\left(${a}${op}${b}\\right)`;}
      if(n.name==='where')return `\\begin{cases}${tex(n.args[1])}&${tex(n.args[0])}\\\\${tex(n.args[2])}&\\text{其他}\\end{cases}`;
      if(n.name==='sqrt')return `\\sqrt{${tex(n.args[0])}}`;if(n.name==='abs')return `\\left|${tex(n.args[0])}\\right|`;
      const name=n.name==='delta'?'\\delta':n.name==='u'?'u':['sin','cos','tan','exp','log'].includes(n.name)?'\\'+n.name:`\\operatorname{${n.name}}`;return name+`\\left(${tex(n.args[0])}\\right)`;
    }
    return tex(ast);
  }
  global.SignalEngine=Object.freeze({compile,piecewise,transform,convolve,convolutionImpulses,spectrum,toLatex,inspect,SignalError,limits:Object.freeze(LIMIT)});
})(typeof window!=='undefined'?window:globalThis);
