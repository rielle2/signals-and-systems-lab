/* Offline, rule-based teaching diagnostics. A matching mathematical mistake
 * model is evidence of a possible cause, never proof of a student's thoughts. */
(function(global){
  'use strict';
  const legacyTransforms=Object.freeze({
    'wave-ct-delay':{a:1,b:-3,amplitude:1},'wave-ct-advance':{a:1,b:2,amplitude:1},
    'wave-ct-reverse':{a:-1,b:0,amplitude:1},'wave-ct-compress':{a:2,b:0,amplitude:1},
    'wave-ct-amplitude':{a:1,b:0,amplitude:-2},'wave-ct-two-minus':{a:-1,b:2,amplitude:1},
    'wave-ct-reverse-compress':{a:-2,b:4,amplitude:1},'wave-ct-expand-delay':{a:.5,b:-.5,amplitude:1},
    'wave-dt-delay':{a:1,b:-2,amplitude:1},'wave-dt-reverse':{a:-1,b:0,amplitude:1},
    'wave-dt-combined':{a:-1,b:1,amplitude:-2}
  });
  const legacyConvolutions=new Set(['wave-ct-convolution-triangle','wave-ct-convolution-trapezoid','wave-dt-convolution','wave-dt-lti-output']);
  const systemFamilies=Object.freeze({'systems-linear':'linearity','systems-ti':'time-invariance','systems-causal':'causality','systems-stable':'bibo-stability'});
  const knownLabFamilies=new Set([...Object.keys(systemFamilies),'read-frequency','fourier-coefficient-magnitude','fourier-harmonic-frequency','fourier-coefficient-phase','convolution-ct-value','convolution-dt-value','convolution-ct-support','convolution-dt-support']);
  const unique=values=>[...new Set(values)].sort((a,b)=>a-b);
  const fmt=value=>Number.isInteger(value)?String(value):String(Number(value.toPrecision(8)));
  const wm=()=>{if(!global.WaveformMath)throw new Error('有限波形数学模块尚未加载。');return global.WaveformMath;};
  function parameters(raw){
    const value={a:raw?.a,b:raw?.b??0,amplitude:raw?.amplitude??1};
    if(Object.values(value).some(v=>typeof v!=='number'||!Number.isFinite(v))||value.a===0)throw new Error('时间系数须为非零有限数，平移和幅度须为有限数。');
    return value;
  }
  function transform(raw,settings){
    const model=wm().normalize(raw),{a,b,amplitude:A}=parameters(settings);
    if(model.domain==='dt'){
      if(!Number.isInteger(a)||!Number.isInteger(b))throw new Error('离散变换仅支持整数 a、b；不为非整数索引虚构插值。');
      return wm().normalize({version:1,domain:'dt',outside:0,samples:model.samples.map(s=>({n:(s.n-b)/a,value:A*s.value})).filter(s=>Number.isInteger(s.n)),segments:[],endpoints:[],impulses:[]});
    }
    const segments=model.segments.map(s=>a>0?{start:(s.start-b)/a,end:(s.end-b)/a,y0:A*s.y0,y1:A*s.y1,leftClosed:s.leftClosed,rightClosed:s.rightClosed}:{start:(s.end-b)/a,end:(s.start-b)/a,y0:A*s.y1,y1:A*s.y0,leftClosed:s.rightClosed,rightClosed:s.leftClosed});
    return wm().normalize({version:1,domain:'ct',outside:0,segments,samples:[],impulses:[],endpoints:model.endpoints.map(p=>({at:(p.at-b)/a,value:A*p.value}))});
  }
  function getTransform(q){const raw=q?.diagnosis?.transform||legacyTransforms[q?.id];if(!raw)return null;try{return parameters(raw);}catch{return null;}}
  function bounds(raw){const model=wm().normalize(raw);return model.domain==='ct'?model.segments.flatMap(s=>[s.start,s.end]).concat(model.endpoints.map(p=>p.at)):model.samples.map(p=>p.n);}
  function sameModel(q,actual,expected){
    try{
      const discrete=actual.domain==='dt',positions=bounds(actual).concat(bounds(expected),discrete?[]:[q.range?.xmin??0,q.range?.xmax??1]);
      const lo=positions.length?Math.min(...positions)-(discrete?0:1):0,hi=positions.length?Math.max(lo+1,Math.max(...positions)+(discrete?0:1)):1;
      const result=wm().grade({...q,expectedModel:expected,comparisonScope:'finite',endpointChecks:undefined,range:{xmin:lo,xmax:hi},grading:{timeTol:q.grading?.timeTol??.04*(q.axisStep?.x??1),ampTol:q.grading?.ampTol??.04*(q.axisStep?.y??1)}},actual,{confirmed:true});
      if(!result.gradable||!result.correct)return false;
      // Respect explicit isolated-point requirements when comparing candidates.
      if(Array.isArray(q.endpointChecks))for(const p of q.endpointChecks){if(Math.abs(wm().evaluate(actual,p.at)-wm().evaluate(expected,p.at))>(q.grading?.ampTol??.04*(q.axisStep?.y??1)))return false;}
      return true;
    }catch{return false;}
  }
  function exactFiniteConvolution(xRaw,hRaw){
    const x=wm().normalize(xRaw),h=wm().normalize(hRaw);if(x.domain!==h.domain)throw new Error('卷积信号的时间类型必须一致。');
    if(x.domain==='dt'){
      if(x.samples.length*h.samples.length>100000)throw new Error('有限卷积超出本地诊断预算。');
      const values=new Map();for(const a of x.samples)for(const b of h.samples)values.set(a.n+b.n,(values.get(a.n+b.n)||0)+a.value*b.value);
      return wm().normalize({version:1,domain:'dt',samples:[...values].map(([n,value])=>({n,value})),segments:[],endpoints:[],impulses:[],outside:0});
    }
    if([...x.segments,...h.segments].some(s=>s.y0!==s.y1))throw new Error('本轮精确连续卷积诊断限分段常数输入；一般分段线性卷积可能为二次曲线。');
    if(x.segments.length*h.segments.length>4000)throw new Error('有限卷积超出本地诊断预算。');
    const terms=[];for(const a of x.segments)for(const b of h.segments){const c=a.y0*b.y0;terms.push([a.start+b.start,c],[a.end+b.start,-c],[a.start+b.end,-c],[a.end+b.end,c]);}
    const knots=unique(terms.map(t=>t[0]));if(knots.length>wm().limits.segments+1)throw new Error('精确卷积结果超过有限分段预算。');
    const value=t=>terms.reduce((s,[k,c])=>s+c*Math.max(0,t-k),0),segments=[];
    for(let i=1;i<knots.length;i++)segments.push({start:knots[i-1],end:knots[i],y0:value(knots[i-1]),y1:value(knots[i])});
    return wm().normalize({version:1,domain:'ct',segments,samples:[],endpoints:[],impulses:[],outside:0});
  }
  function transformCandidates(q){
    const t=getTransform(q);if(!t||!q.inputModel)return [];
    const list=[],add=(id,settings,reason,evidence)=>{try{list.push({errorTypeId:id,model:transform(q.inputModel,settings),reason,evidence});}catch{/* Unsupported candidate has no diagnostic authority. */}};
    if(t.b!==0)add('time-shift-direction',{...t,b:-t.b},'自变量中平移常数的符号可能取反了。',`该答案与 ${t.amplitude}x(${t.a}t${t.b>0?'-':'+'}${fmt(Math.abs(t.b))}) 的完整有限波形一致。`);
    if(t.a<0)add('time-reversal-omitted',{...t,a:Math.abs(t.a)},'可能保留了压缩/平移，却遗漏时间反转。','非对称区间的先后顺序与省略负时间系数的候选一致。');
    if(Math.abs(t.a)!==1){
      add('time-scale',{...t,a:1/t.a},'可能把时间压缩与展开的倍率倒置。','结果与使用时间系数倒数的候选一致。');
      add('time-scale',{...t,a:Math.sign(t.a)},'可能遗漏时间尺度变化。','结果与只保留时间系数符号的候选一致。');
      add('time-scale',{...t,amplitude:t.amplitude/Math.abs(t.a)},'时间压缩本身不应改变函数的幅值。','结果与额外把幅度除以时间倍率的候选一致。');
    }
    if(t.b!==0&&t.a!==1){
      add('transform-order',{...t,b:t.a*t.b},'可能把自变量常数当成最终图形位移，混淆了平移与尺度/反转顺序。',`x(at+b) 的最终位移是 -b/a=${fmt(-t.b/t.a)}，不是 -b。`);
      add('transform-order',{...t,b:t.b/t.a},'可能在提取时间系数后又对平移量重复除了一次。','请直接用原拐点 s 映到 t=(s-b)/a，避免操作顺序口诀。');
    }
    if(t.amplitude!==1)add('amplitude-scale',{...t,amplitude:1},'可能漏掉了整体幅度倍率。','时间位置吻合，但纵坐标与未乘幅度系数的候选一致。');
    add('amplitude-scale',{...t,amplitude:-t.amplitude},'可能多取或漏取了幅度的负号。','结果与保持时间映射、整体幅度取相反数的候选一致。');
    return list;
  }
  function convolutionCandidates(q){
    if(!(q.diagnosis?.operation==='convolution'||legacyConvolutions.has(q.id))||!q.inputModel||!q.auxModel)return [];
    const list=[],add=(errorTypeId,model,reason,evidence)=>list.push({errorTypeId,model,reason,evidence});
    try{add('convolution-reversal',exactFiniteConvolution(q.inputModel,transform(q.auxModel,{a:-1,b:0,amplitude:1})),'可能使用了相关式的方向，而非 h(t−τ) 的翻转。','你的完整有限波形与 x*h(-·) 一致；它只是一个可能的错误模型。');}catch{}
    try{
      const expected=wm().normalize(q.expectedModel);
      if(expected.domain==='ct'&&expected.segments.length>1)add('convolution-support',{...expected,segments:expected.segments.slice(0,-1)},'可能在最后一段重叠尚未消失时提前截断了输出。','该候选删去了标准输出的最后一段；需核对支持区间之和。');
      if(expected.domain==='dt'&&expected.samples.length>1)add('convolution-support',{...expected,samples:expected.samples.slice(0,-1)},'可能遗漏了输入结束之后仍存在的最后一个卷积样本。','有限线性卷积通常需要检查全部索引和，而非在输入结束时截断。');
    }catch{}
    return list;
  }
  function formula(t,domain){const v=domain==='dt'?'n':'t',inside=`${fmt(t.a)}${v}${t.b<0?'−':'+'}${fmt(Math.abs(t.b))}`;return `y(${v})=${fmt(t.amplitude)}x(${inside})`;
  }
  function labCandidates(q,submission){
    const id=q.familyId,p=q.params||{},list=[],add=(errorTypeId,value,reason,evidence)=>{if(Number.isFinite(value))list.push({errorTypeId,value,reason,evidence});};
    if(systemFamilies[id]&&typeof q.proof==='string')return [{errorTypeId:systemFamilies[id],reason:'当前性质判定与该系统的定义检验不符；请核对两条路径或反例，而非只看波形外观。',evidence:q.proof}];
    if(['convolution-ct-support','convolution-dt-support'].includes(id))return [{errorTypeId:'convolution-support',reason:'所选支持范围与非零索引对的和不符。这里只能确定区间判定有误，不能确定你使用了哪种错误算法。',evidence:(q.solution||[]).join(' ')}];
    if(id==='read-frequency')add('frequency-angular',2*Math.PI*p.f,'可能把要求的Hz写成rad/s。','该数值等于2πf，而本题要求f。');
    if(id==='fourier-harmonic-frequency')add('frequency-angular',2*Math.PI*p.k*p.f,'可能把谱线的Hz位置写成角频率。','该数值等于2πkf，题目横轴单位为Hz。');
    if(id==='fourier-coefficient-magnitude')add('fourier-coefficient',p.A,'可能把余弦的全部幅度分给了单个复指数系数。','实余弦的正、负频率系数各为A/2。');
    if(id==='fourier-coefficient-phase'&&p.phase!==0){const wrongLabel=p.phase>0?'−π/2':'π/2';if(q.options?.[submission]===wrongLabel)list.push({errorTypeId:'spectrum-magnitude-phase',reason:'可能混用了正、负频率系数的相位。',evidence:'对A>0的余弦，正频率系数为(A/2)exp(jφ)，不是exp(−jφ)。'});}
    if(['convolution-ct-value','convolution-dt-value'].includes(id)&&['ct','dt'].includes(p.domain)&&['a','b','L','M','s1','s2','t'].every(k=>Number.isFinite(p[k]))){
      const d=p.domain==='dt'?1:0,lo=Math.max(p.s1,p.t-(p.s2+p.M)+d),hi=Math.min(p.s1+p.L-d,p.t-p.s2),gain=p.a*p.b;
      add('convolution-bounds',gain*Math.max(0,hi-lo+(d?0:1)),'可能混淆了连续重叠长度与离散整数点数。',d?'离散闭区间的样本数为上限−下限+1。':'连续积分使用区间长度，不能额外加1。');
      add('convolution-overlap',gain*Math.min(p.L,p.M),'可能把较短矩形的完整宽度当成当前重叠量。','固定当前t后必须先对两个非零区间求交。');
      const correlationLength=Math.max(0,Math.min(p.s1+p.L-d,p.t+p.s2+p.M-d)-Math.max(p.s1,p.t+p.s2)+d);
      add('convolution-reversal',gain*correlationLength,'可能使用h(τ−t)代替h(t−τ)。','该数值与相关方向的区间交集一致；仅为可能原因。');
    }
    return list;
  }
  function stepsFor(q){
    if(!q?.inputModel)return [];
    try{
      const original=wm().normalize(q.inputModel),t=getTransform(q),steps=[{label:'原始信号',model:original,formula:q.inputExpression||'x',explanation:'先读出原时间坐标、区间与幅值；跳变不是连接两段的斜线。'}];
      if(t){
        const direct=transform(original,t);
        if(original.domain==='dt'&&(!Number.isInteger(t.b/t.a))){steps.push({label:'整数索引直接映射',model:direct,formula:formula(t,'dt'),explanation:'对每个原整数索引 k 解 n=(k-b)/a；只保留整数 n。中间的分数样本平移不一定有定义，因此不套用连续时间的分步顺序。'});}
        else{
          let current=original,name='x';
          if(t.a<0){current=transform(current,{a:-1,b:0,amplitude:1});steps.push({label:'时间反转',model:current,formula:'r(s)=x(−s)',explanation:'横坐标关于0反转，幅值随所属区间一起移动；重新按从左到右排列。'});name='r';}
          if(Math.abs(t.a)!==1){current=transform(current,{a:Math.abs(t.a),b:0,amplitude:1});steps.push({label:'时间尺度',model:current,formula:`z(t)=${name}(${fmt(Math.abs(t.a))}t)`,explanation:`当前横坐标除以 ${fmt(Math.abs(t.a))}，此步不改变各拐点的纵坐标。`});name='z';}
          if(t.b!==0){current=transform(current,{a:1,b:t.b/t.a,amplitude:1});steps.push({label:'最终时间平移',model:current,formula:`w(t)=${name}(t${t.b/t.a<0?'−':'+'}${fmt(Math.abs(t.b/t.a))})`,explanation:`将前一步图形平移 −b/a=${fmt(-t.b/t.a)}。这是由 a(t+b/a)=at+b 推出的当前步骤，不是把 b 直接当位移。`});name='w';}
          if(t.amplitude!==1){current=transform(current,{a:1,b:0,amplitude:t.amplitude});steps.push({label:'幅度变换',model:current,formula:`y=${fmt(t.amplitude)}${name}`,explanation:`每个纵坐标乘 ${fmt(t.amplitude)}，时间位置保持。`});}
        }
        steps.push({label:'最终答案',model:direct,formula:formula(t,original.domain),explanation:`逐个原拐点使用 t=(s-b)/a=${fmt(1/t.a)}s${-t.b/t.a<0?'−':'+'}${fmt(Math.abs(t.b/t.a))}，并把原幅值乘 ${fmt(t.amplitude)}。连续时间按分段比较，离散时间只比较整数索引。`});return steps;
      }
      if(q.diagnosis?.operation==='convolution'||legacyConvolutions.has(q.id)){
        const flipped=transform(q.auxModel,{a:-1,b:0,amplitude:1}),scan=q.diagnosis?.scanTime??1,shifted=transform(flipped,{a:1,b:-scan,amplitude:1});
        steps.push({label:'响应翻转',model:flipped,formula:'h(−τ)',explanation:'这一阶段横轴读作积分变量τ；对冲激响应翻转，不把它误当输入反转。'},{label:`固定 t=${fmt(scan)} 的核`,model:shifted,formula:`h(${fmt(scan)}−τ)`,explanation:'翻转后按当前t平移，再与x(τ)求交集；这张图是积分核，不是输出。'},{label:'最终卷积输出',model:wm().normalize(q.expectedModel),formula:q.systemExpression||'y=x*h',explanation:'连续情况积分重叠乘积；离散情况求和。输出横轴重新读作t或n，完整支持范围必须检查。'});return steps;
      }
    }catch{/* Unsupported representations receive text guidance, not fake finite plots. */}
    return [];
  }
  function recommendations(errorIds,q){
    const bank=[...(global.DiagnosisBank?.questions||[]),...(global.WaveformEditorQuestions||[]),...(global.WaveformQuestions||[])],ids=new Set(errorIds),preferred=bank.filter(p=>p.id!==q?.id&&(p.diagnosis?.errorTypeIds||[]).some(id=>ids.has(id))),sameTopic=bank.filter(p=>p.id!==q?.id&&p.topicId===q?.topicId),seen=new Set();
    return [...preferred.sort((a,b)=>a.difficulty-b.difficulty),...sameTopic.sort((a,b)=>a.difficulty-b.difficulty)].filter(p=>{if(seen.has(p.id))return false;seen.add(p.id);return true;}).slice(0,6).map(p=>({questionId:p.id,title:p.title||p.prompt,topicId:p.topicId,difficulty:p.difficulty}));
  }
  function relatedExamples(q){
    const actual=global.WORKED_EXAMPLES?.byTopic?.[q?.topicId]||[],topic=(global.COURSE?.chapters||[]).flatMap(c=>c.topics.map(t=>({...t,chapter:c.id}))).find(t=>t.id===q?.topicId);
    if(actual.length)return actual.slice(0,2).map(e=>({topicId:q.topicId,chapter:q.chapter,exampleId:e.id,title:e.title,href:`#lesson/${q.chapter}/${q.topicId}`}));
    return topic?[{topicId:topic.id,chapter:topic.chapter,title:'返回知识点的定义与分步例题',href:`#lesson/${topic.chapter}/${topic.id}`}]:[];
  }
  function taxonomy(){return global.DiagnosisBank?.taxonomy||[];}
  function coverage(){return taxonomy().map(t=>{const ids=(global.DiagnosisBank?.questions||[]).filter(q=>q.diagnosis?.errorTypeIds?.includes(t.id)).map(q=>q.id);return {...t,practiceCount:ids.length,questionIds:ids,minimumMet:ids.length>=3};});}
  function analyze(q,submission,result){
    const base={supported:!!(q?.diagnosis||getTransform(q)||legacyConvolutions.has(q?.id)||knownLabFamilies.has(q?.familyId)),status:'unknown',errorTypes:[],message:'目前不能从这个答案可靠确定具体错因。请按定义与解题步骤检查；未把猜测当作事实。',steps:[],recommendations:[],relatedExamples:relatedExamples(q),issues:result?.issues||[]};
    if(!result||result.valid!==true||result.gradable!==true||typeof result.correct!=='boolean')return {...base,status:'ungraded',message:'尚未获得有效的数学判题结果；不记录知识错误，也不更新正确率。'};
    if(result.correct)return {...base,status:'correct',message:'数学答案正确；不推断或记录错误类型。',steps:stepsFor(q)};
    let candidates=[];
    if(q.type==='waveform'){
      const checked=wm().validate(submission?.model);if(!checked.valid||submission?.confirmed!==true||submission?.reviewed!==true||submission.source==='photo'&&!['candidate','corrected'].includes(submission.recognition))return {...base,status:'ungraded',message:'波形尚未有效校正并确认，不能据此诊断知识错误。'};
      candidates=[...transformCandidates(q),...convolutionCandidates(q),...(q.diagnosis?.candidates||[])].filter(c=>c.model&&sameModel(q,checked.model,c.model)&&!sameModel(q,q.expectedModel,c.model));
    }else if(q.type==='numeric'){
      let value;try{value=Number.isFinite(result.value)?result.value:global.Assessment.number(submission);}catch{return base;}
      const tolerance=(q.grading?.absTol??1e-7)+(q.grading?.relTol??1e-6)*Math.abs(Number(q.answer));
      candidates=[...(q.diagnosis?.candidates||[]),...labCandidates(q,submission)].filter(c=>Number.isFinite(c.value)&&Math.abs(c.value-Number(q.answer))>tolerance&&Math.abs(value-c.value)<=tolerance);
    }else if(['choice','judge','multiple'].includes(q.type)){
      const indices=Array.isArray(submission)?submission:[submission];for(const index of indices){const c=q.diagnosis?.choiceErrors?.[index];if(c)candidates.push(c);}
      candidates.push(...labCandidates(q,submission));
    }
    const entries=new Map();for(const c of candidates){const type=taxonomy().find(t=>t.id===c.errorTypeId);if(type&&!entries.has(type.id))entries.set(type.id,{id:type.id,title:type.title,reason:c.reason||type.guidance,evidence:c.evidence||'答案与题目预先声明的错误模型一致。',confidence:'possible',match:'mathematical-candidate'});}
    base.errorTypes=[...entries.values()];base.steps=stepsFor(q);base.recommendations=recommendations([...entries.keys()],q);
    if(entries.size){base.status='possible';base.message=entries.size>1?'答案同时符合多个已验证的错误模型，无法唯一确定思路。以下都是可能的原因，请逐项核对。':'答案与一个已验证的错误模型一致。下面是可能的错误原因，并不代表程序知道你的思考过程。';}
    return base;
  }
  global.DiagnosisEngine=Object.freeze({analyze,transform,getTransform,stepsFor,sameModel,exactFiniteConvolution,recommendations,coverage,taxonomy});
})(typeof window!=='undefined'?window:globalThis);
