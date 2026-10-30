/* Original diagnostic practice. No textbook exercise numbers or copied text.
 * Numeric distractors are explicit mathematical error models, not free-text AI. */
(function(global){
  'use strict';
  const E=global.DiagnosisEngine;if(!E)throw new Error('先加载错因数学规则，再加载针对性练习。');
  const m=String.raw,questions=[];
  const topics=new Map((global.COURSE?.chapters||[]).flatMap(c=>c.topics.map(t=>[t.id,{chapter:c.id,title:t.title}])));
  const definitions=[
    ['time-shift-direction','时间平移方向','time-transform','先解原时间 s=at+b，再得到 t=(s-b)/a；不要只看常数符号。'],
    ['time-reversal-omitted','时间反转遗漏','time-transform','负时间系数会反转区间的左右顺序，幅度跟随原区间。'],
    ['time-scale','时间尺度变换','time-transform','时间坐标除以时间系数；普通函数的幅度不随时间压缩自动缩放。'],
    ['transform-order','平移与尺度顺序','time-transform','把 at+b 写成 a(t+b/a)，最终图形位移是 −b/a。'],
    ['amplitude-scale','幅度变换','time-transform','幅度系数只乘纵坐标，不能替代横轴反转或移动。'],
    ['piecewise-interval','分段区间','time-transform','分别映射每一段的两个端点，再排序；不能只移动一个拐点。'],
    ['linearity','线性判断','linearity','验证任意线性组合；一个有效反例就能否定线性。'],
    ['time-invariance','时不变验证','time-invariance','比较 T{x(t−t₀)} 与 y(t−t₀) 两条路径，必须对任意输入与平移成立。'],
    ['causality','因果性判断','causality','任意当前时刻的输出只能依赖当前和过去输入；不能只检查 t<0。'],
    ['bibo-stability','BIBO稳定条件','bibo-stability','每个有界输入都须产生有界输出；非线性不等于BIBO不稳定。'],
    ['convolution-reversal','卷积翻转方向','ct-convolution','积分核应为 h(t−τ)，先对 τ 反转后再平移；不要换成相关式。'],
    ['convolution-support','卷积支持区间','ct-convolution','非负矩形的卷积支持端点相加，不能取原区间的交集。'],
    ['convolution-overlap','卷积重叠区间','ct-convolution','固定 t 后求两个非零条件的交集，长度随 t 改变。'],
    ['convolution-bounds','积分或求和边界','ct-convolution','连续下限取max、上限取min；离散边界须为整数并包含有效端点。'],
    ['frequency-angular','频率与角频率','ctfs','区分Hz、rad/s与rad/sample：ω=2πf，Ω=2πf/fₛ。'],
    ['fourier-coefficient','傅里叶系数约定','transform-pairs','写出本题的正反变换约定；CTFS和DTFS分析系数分别有1/T和1/N。'],
    ['fourier-shift-phase','时间平移的相位因子','fourier-properties','本平台CTFT正变换用 e^(−jωt)，因此延时t₀乘 e^(−jωt₀)。'],
    ['spectrum-magnitude-phase','幅度谱与相位谱','ctft','幅度为非负模，相位为角度；频谱为0处不定义相位。']
  ];
  const taxonomy=definitions.map(([id,title,topicId,guidance])=>({id,title,topicId,chapter:topics.get(topicId)?.chapter,guidance,scope:'仅对明确预设的数学错误候选匹配；无法唯一归因时保留不确定性。'}));
  const ct=rows=>({version:1,domain:'ct',segments:rows.map(([start,end,y0,y1=y0])=>({start,end,y0,y1})),samples:[],endpoints:[],impulses:[],outside:0});
  const bases=[ct([[0,1,1],[1,3,2]]),ct([[-1,0,0,2],[0,2,2,0]]),ct([[-2,-1,1],[-1,1,-1]])];
  const pretty=model=>model.segments.map(s=>`(${s.start},${s.end})内从${s.y0}线性到${s.y1}`).join('；')+'；其余为0（未规定的孤立端点不影响积分类比较）';
  const num=v=>Number.isInteger(v)?String(v):String(Number(v.toPrecision(8)));
  function base(id,topicId,type,difficulty,title,prompt,answer,idea,solution,commonError,extra={}){
    const topic=topics.get(topicId);if(!topic)throw new Error('未知诊断知识点：'+topicId);
    return {id:'diag-'+id,assessmentKey:'diag-'+id,chapter:topic.chapter,topicId,topic:topic.title,type,category:'针对性错因训练',difficulty,title,prompt,answer,idea,solution,commonError,source:{kind:'original',reference:'奥本海姆《信号与系统》第二版知识体系',page:null},...extra};
  }
  function wave(kind,index,settings,input=bases[index],extra={}){
    const expected=E.transform(input,settings),symbol=`${settings.amplitude===1?'':settings.amplitude}x(${settings.a}t${settings.b<0?'−':'+'}${Math.abs(settings.b)})`,type=taxonomy.find(t=>t.id===kind),s=E.stepsFor({inputModel:input,diagnosis:{transform:settings}});
    const q=base(`wave-${kind}-${index+1}`,'time-transform','waveform',index+1,`${type.title} · 训练${index+1}`,`已知图中的有限信号 x(t)：${pretty(input)}。绘制 y(t)=${symbol}，核对完整区间和幅值。`,pretty(expected),'由原拐点 s 解 t=(s-b)/a，并对每个纵坐标乘幅度系数。',s.slice(1).map(x=>x.explanation),type.guidance,{inputModel:input,expectedModel:expected,systemExpression:'y(t)='+symbol,range:{xmin:-8,xmax:12,ymin:-8,ymax:8},axisStep:{x:1,y:1},grading:{kind:'waveform'},comparisonScope:'finite',endpointConvention:'连续时间未明确规定的孤立端点不单独扣分；跳变以区间极限表示。',diagnosis:{errorTypeIds:[kind],transform:settings,...extra}});
    questions.push(q);return q;
  }
  for(const [i,t]of [{a:1,b:-3,amplitude:1},{a:1,b:2,amplitude:1},{a:1,b:-1,amplitude:1}].entries())wave('time-shift-direction',i,t);
  for(const [i,t]of [{a:-1,b:0,amplitude:1},{a:-1,b:2,amplitude:1},{a:-2,b:4,amplitude:1}].entries())wave('time-reversal-omitted',i,t);
  for(const [i,t]of [{a:2,b:0,amplitude:1},{a:.5,b:0,amplitude:1},{a:3,b:-3,amplitude:1}].entries())wave('time-scale',i,t);
  for(const [i,t]of [{a:2,b:-4,amplitude:1},{a:-2,b:4,amplitude:1},{a:.5,b:-2,amplitude:1}].entries())wave('transform-order',i,t);
  for(const [i,t]of [{a:1,b:0,amplitude:2},{a:1,b:0,amplitude:-2},{a:1,b:0,amplitude:.5}].entries())wave('amplitude-scale',i,t);
  for(const [i,t]of [{a:1,b:1,amplitude:1},{a:-1,b:3,amplitude:1},{a:2,b:2,amplitude:1}].entries()){
    const expected=E.transform(bases[i],t),wrong=JSON.parse(JSON.stringify(expected));wrong.segments.at(-1).end+=.5;
    wave('piecewise-interval',i,t,bases[i],{candidates:[{errorTypeId:'piecewise-interval',model:wrong,reason:'可能只映射了部分边界，最后一段终点没有按同一公式变换。',evidence:'整段与末尾多延长1/2的候选一致；请对每个拐点分别写 t=(s-b)/a。'}]});
  }
  function property(kind,index,prompt,answer,options,proof,misconception){
    const type=taxonomy.find(t=>t.id===kind),wrong=answer===0?1:0;
    questions.push(base(`${kind}-${index}`,type.topicId,'choice',index,type.title+' · '+index,prompt,answer,type.guidance,proof,misconception,{options,diagnosis:{errorTypeIds:[kind],choiceErrors:{[wrong]:{errorTypeId:kind,reason:misconception,evidence:'你选择的判定与下面的定义检验或明确反例不符。'}}}}));
  }
  property('linearity',1,m`系统 $T\{x\}(t)=x^2(t)$ 是否线性？`,1,['线性','非线性'],['取x(t)=1，T{2x}=4，而2T{x}=2。','齐次性已有反例，因此非线性，无需再检查所有输入。'],'平方是对输入的非线性运算，不能因为表达式没有显式t就判线性。');
  property('linearity',2,m`系统 $y(t)=2x(t)-x(t-1)$ 是否线性？`,0,['线性','非线性'],['对任意a,b,x₁,x₂，代入线性组合得到2[ax₁(t)+bx₂(t)]−[ax₁(t−1)+bx₂(t−1)]。','分组后等于aT{x₁}+bT{x₂}；平移输入项不破坏线性。'],'输入存在延时不代表系统非线性；线性与记忆性不同。');
  property('linearity',3,m`系统 $y(t)=x(t)+1$ 是否线性？`,1,['线性','非线性'],['线性系统必须把零输入映成零输出。','这里x=0时y=1，因此非线性；它是仿射而非线性映射。'],'遗漏了与输入无关的常数项，零输入测试已经足以否定线性。');
  property('time-invariance',1,m`对全部实时间定义的系统 $y(t)=t x(t)$ 是否时不变？`,1,['时不变','时变'],['先平移输入再过系统：y₁(t)=t x(t−t₀)。','先过系统再平移：y₂(t)=(t−t₀)x(t−t₀)。','取x=1,t₀=1，两者相差1，所以时变。'],'平移输出时必须连同输出表达式中显式的t一起平移。');
  property('time-invariance',2,m`系统 $y(t)=x(2t)$ 是否时不变？`,0,['时变','时不变'],['先平移输入：y₁(t)=x(2t−t₀)。','先平移输出：y₂(t)=x(2(t−t₀))=x(2t−2t₀)。','取x(t)=t,t₀=1，两条路径分别为2t−1、2t−2，故时变。'],'把输入平移量也自动乘2，会把两条不同路径误写成同一式子。');
  property('time-invariance',3,m`系统 $y(t)=x(t-2)$ 是否时不变？`,1,['时变','时不变'],['先平移输入再延时2：x(t−2−t₀)。','先得到y(t)，再平移t₀：y(t−t₀)=x(t−t₀−2)。','两式对任意输入及平移相等，因此时不变。'],'固定延时不是显式随当前t变化的系数，不能把记忆与时变混为一谈。');
  property('causality',1,m`系统 $y(t)=x(t+1)$ 是否因果？`,1,['因果','非因果'],['在当前t，输出依赖未来t+1处的输入。','可选两输入在截至t的全部时刻相同，在t+1不同，当前输出随之不同，因此非因果。'],'自变量的正号对应访问未来输入；不能仅从“加1”字面理解为延时。');
  property('causality',2,m`系统 $y(t)=x(2t)$ 在整个实时间轴是否因果？`,0,['非因果','因果'],['当t>0时，2t>t，系统访问未来输入。','例如当前t=1依赖x(2)；即使t<0时访问过去，也不能满足对任意当前时刻的因果性要求。'],'只检查负时间部分不足以证明整个系统因果。');
  property('causality',3,m`系统 $y(t)=x(t)-x(t-2)$ 是否因果？`,1,['非因果','因果'],['当前输出只使用当前t和过去t−2的输入。','两个输入若截至t完全相同，这两个取值也相同，故当前输出相同，满足因果定义。'],'系统有记忆并不等于非因果；因果系统可以使用过去输入。');
  property('bibo-stability',1,m`系统 $y(t)=x^2(t)$ 是否BIBO稳定？`,0,['BIBO稳定','BIBO不稳定'],['若|x(t)|≤M，则|y(t)|=|x(t)|²≤M²。','每个有界输入都对应一个有限输出界，因此BIBO稳定；这并不使系统变成线性。'],'把非线性等同于BIBO不稳定是两个性质的混淆。');
  property('bibo-stability',2,m`系统 $y(t)=t x(t)$ 是否BIBO稳定？`,1,['BIBO稳定','BIBO不稳定'],['选择有界输入x(t)=1。','输出y(t)=t在整个时间轴无界，一个有界输入反例足以否定BIBO稳定。'],'固定某个有限t看输出有限，不等于整个输出信号有统一有限上界。');
  property('bibo-stability',3,m`零状态连续LTI系统的 $h(t)=e^t u(t)$。是否BIBO稳定？`,0,['BIBO不稳定','BIBO稳定'],['连续LTI系统的BIBO稳定充要条件为∫|h(t)|dt<∞。','这里∫₀∞e^t dt发散；取有界输入u(t)，输出(e^t−1)u(t)无界。'],'只检查因果性或某个极点位置的局部数值，不能替代BIBO条件。');
  function numeric(kind,index,title,prompt,answer,wrong,proof,reason,extra={}){
    const type=taxonomy.find(t=>t.id===kind);
    questions.push(base(`${kind}-${index}`,type.topicId,'numeric',index,title,prompt,answer,type.guidance,proof,reason,{grading:{absTol:1e-7,relTol:1e-6},diagnosis:{errorTypeIds:[kind],candidates:[{errorTypeId:kind,value:wrong,reason,evidence:'该数值与题目声明的错误公式结果一致；算术巧合仍可能产生同一值，因此仅提供可能原因。'}]},...extra}));
  }
  numeric('convolution-reversal',1,'翻转方向与左边界',m`正单位高度矩形 $x$ 支撑为 $[1,3]$，$h$ 支撑为 $[2,4]$。线性卷积输出支持区间的左边界是多少？`,3,-3,['正确积分核为h(t−τ)，非零索引相加，左边界1+2=3。','若误用h(τ−t)，相关式的左边界会是1−4=−3。'],'可能遗漏了冲激响应对积分变量的翻转。');
  numeric('convolution-reversal',2,'翻转方向与右边界',m`正矩形 $x$ 支撑为 $[0,1]$，$h$ 支撑为 $[2,4]$。$x*h$ 的支持区间右边界是多少？`,5,-1,['卷积支持区间为[0+2,1+4]=[2,5]。','若写成x(τ)h(τ−t)，其右边界为1−2=−1，方向不同。'],'答案可能来自相关式而不是卷积核h(t−τ)。');
  numeric('convolution-reversal',3,'卷积中心不能相减',m`正对称矩形 $x$ 支撑为 $[-1,2]$，$h$ 支撑为 $[1,3]$。卷积支持区间的中点是多少？`,2.5,-1.5,['两个中心分别为1/2和2，卷积输出中心相加为5/2。','将h(τ−t)用于积分会让中心相减，得到−3/2。'],'可能将卷积与相关所用的翻转方向混淆。');
  numeric('convolution-support',1,'支持区间不是交集',m`正矩形 $x$ 支撑 $[1,3]$，$h$ 支撑 $[2,5]$。卷积支持区间左边界是多少？`,3,2,['由于矩形为正，没有相消，支持闭包为[1+2,3+5]=[3,8]。','取max(1,2)=2得到的是原区间交集的左边界，并非卷积支持。'],'可能把支持端点相加误用为原信号区间求交。');
  numeric('convolution-support',2,'检查完整衰减尾段',m`正矩形 $x$ 支撑 $[-1,2]$，$h$ 支撑 $[1,4]$。卷积支持区间右边界是多少？`,6,2,['右端点相加：2+4=6；左端点为−1+1=0。','直到t=6重叠才完全消失，不能在min(2,4)=2处截断。'],'可能把卷积持续范围错误截成两个原区间的交集。');
  numeric('convolution-support',3,'非零持续时间相加',m`两个正矩形持续时间分别为2s、3s。其连续线性卷积的非零区间长度是多少秒？`,5,2,['区间端点和的差为(b−a)+(d−c)=2+3=5。','取较小宽度2仅表示完全重叠时的长度，不能表示整个输出持续时间。'],'可能将峰值时的重叠长度当作卷积输出持续时间。');
  numeric('convolution-overlap',1,'刚进入时的重叠',m`$x(t)=1$于$(0,3)$，$h(t)=1$于$(0,2)$，其余为0。求$(x*h)(1)$。`,1,2,['固定t=1，h(1−τ)非零要求−1<τ<1。','与0<τ<3求交得0<τ<1，重叠长度为1。'],'可能直接使用较窄矩形全宽2，遗漏当前t下的部分重叠。');
  numeric('convolution-overlap',2,'退出时的重叠',m`$x(t)=1$于$(1,4)$，$h(t)=1$于$(2,4)$，其余为0。求$(x*h)(7)$。`,1,2,['h(7−τ)要求3<τ<5。','与1<τ<4求交为3<τ<4，所以积分为1。'],'可能忽略信号退出时重叠长度已经缩短。');
  numeric('convolution-overlap',3,'跨原点的局部重叠',m`$x(t)=1$于$(-1,2)$，$h(t)=1$于$(1,3)$。求$(x*h)(1/2)$。`,.5,2,['h(1/2−τ)要求−5/2<τ<−1/2。','与−1<τ<2求交得−1<τ<−1/2，长度为1/2。'],'可能只比较两矩形宽度，没有先代入当前t求交集。');
  numeric('convolution-bounds',1,'连续卷积下限取max',m`$x$ 在$(0,3)$内为1，$h$ 在$(0,2)$内为1。求$t=1$时有效重叠积分的下限。`,0,-1,['核的区间为t−2<τ<t，即−1<τ<1。','同时要求0<τ<3，因此下限为max(0,−1)=0，上限为min(3,1)=1。'],'可能将积分下限错误地取成两个左边界的min。');
  numeric('convolution-bounds',2,'连续卷积上限取min',m`$x$ 在$(1,4)$内为1，$h$ 在$(2,4)$内为1。求$t=7$时有效积分的上限。`,4,5,['核要求3<τ<5，输入要求1<τ<4。','上限min(4,5)=4，下限max(1,3)=3。'],'可能将积分上限误取max，从而积分到无重叠区域。');
  numeric('convolution-bounds',3,'离散求和包括整数端点',m`$x[k]=1$于$k=0,1,2$，$h[k]=1$于$k=0,1$，其余为0。求$(x*h)[1]$。`,2,1,['0≤k≤2且0≤1−k≤1，故0≤k≤1。','两个有效整数k=0、1均需包含，求和为1+1=2；离散不是连续区间长度1。'],'可能漏掉离散求和的一个有效端点，或把样本数当成连续区间长度。',{topicId:'dt-convolution',chapter:'lti',topic:topics.get('dt-convolution').title});
  numeric('frequency-angular',1,'从Hz到角频率',m`$x(t)=\cos(6\pi t)$。其角频率是多少rad/s？`,6*Math.PI,3,['连续余弦cos(ωt)的自变量系数就是ω=6π。','对应频率为f=ω/(2π)=3Hz，不能把3Hz当成3rad/s。'],'可能将f=3Hz直接作为角频率。');
  numeric('frequency-angular',2,'从周期到Hz',m`某连续周期信号 $T=0.4$s。求基波频率，单位Hz。`,2.5,5*Math.PI,['频率f₀=1/T=2.5Hz。','2π/T=5π是角频率，单位rad/s，不是本题要求的Hz。'],'可能在需要普通频率时使用了角频率公式。');
  numeric('frequency-angular',3,'数字角频率',m`12.5Hz余弦以100Hz采样。求数字角频率rad/sample。`,Math.PI/4,.125,['每样本周期数为12.5/100=1/8。','数字角频率Ω=2π/8=π/4rad/sample。'],'可能漏掉从周期每样本换算到弧度每样本的2π。');
  numeric('fourier-coefficient',1,'CTFT直流值的约定',m`本平台 $X(j\omega)=\int x(t)e^{-j\omega t}dt$。$x(t)=1$于$(-1,1)$。求$X(0)$。`,2,1/Math.PI,['令ω=0，X(0)等于矩形面积2。','正变换前没有1/(2π)；该系数属于逆变换。'],'可能将逆变换的1/(2π)放进了正变换。');
  numeric('fourier-coefficient',2,'CTFS平均值',m`周期T=4的信号每周期在长度1的区间为2，其余为0。CTFS采用$x(t)=\sum a_ke^{jk\omega_0t}$，求$a_0$。`,.5,2,['a₀=(1/T)∫周期x(t)dt。','每周期面积2，除以T=4得1/2。'],'可能只算周期积分，漏掉分析系数1/T。');
  numeric('fourier-coefficient',3,'DTFS归一化',m`周期N=4的序列恒等于3。DTFS采用$x[n]=\sum_{k=0}^{N-1}a_ke^{j2\pi kn/N}$，求$a_0$。`,3,12,['a₀=(1/N)Σₙ₌₀³x[n]。','四项总和12，除以4得3；不能省略1/N。'],'可能将DTFS求和当成未归一化系数。',{topicId:'dtfs',chapter:'fourier',topic:topics.get('dtfs').title});
  for(const [i,delay,omega]of [[1,.5,2],[2,-2,.5],[3,1,.5]])numeric('fourier-shift-phase',i,'时间平移与相位 · '+i,`令x(t)=exp(−t)u(t)，其频谱在所问频率非零。y(t)=x(t−(${delay}))。本平台CTFT约定下，在ω=${omega}处，Y/X的主值相位是多少rad？`,-omega*delay,omega*delay,[`时间平移定理：Y(jω)=exp(−jωt₀)X(jω)，t₀=${delay}。`,`因此相位为−ωt₀=${num(-omega*delay)}rad，位于(−π,π]，不存在取模歧义。`],'可能将时间延时的相位因子符号写反。');
  function spectrum(index,prompt,options,answer,proof,wrongIndex,reason){
    questions.push(base(`spectrum-${index}`,'ctft','choice',index,'幅度与相位 · '+index,prompt,answer,'先求复数的模，再按象限求相位；零幅度不强行给相位。',proof,reason,{options,diagnosis:{errorTypeIds:['spectrum-magnitude-phase'],choiceErrors:{[wrongIndex]:{errorTypeId:'spectrum-magnitude-phase',reason,evidence:'所选项直接交换了模与角度，或给零频谱强行定义了相位。'}}}}));
  }
  spectrum(1,m`某频率处 $X=-2j$，哪一项正确？`,[m`幅度2，相位−π/2`,m`幅度−π/2，相位2`,m`幅度−2，相位0`],0,['模为√(0²+(-2)²)=2。','复数在负虚轴，主值相位−π/2。'],1,'可能把非负幅度与有单位的角度交换。');
  spectrum(2,m`某频率处 $H=1/(1+j)$，哪一项正确？`,[m`幅度−π/4，相位1/√2`,m`幅度1/√2，相位−π/4`,m`幅度√2，相位π/4`],1,['1+j的模为√2、角为π/4。','取倒数后模为1/√2，相位为−π/4。'],0,'可能把幅频响应和相频响应的数值位置交换。');
  spectrum(3,m`某频率处 $X(j\omega)=0$。关于该点幅度与相位，哪一项正确？`,['幅度0，相位必为0','幅度0，相位不定义','幅度可以取负值'],1,['复数0的模为0。','任何角度乘零都得到0，因此该点没有唯一相位；绘图时可以留空，不能把显示占位0当成数学相位。'],0,'可能把绘图使用的零值占位误当作零频谱的唯一相位。');
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  const coverage=taxonomy.map(t=>({errorTypeId:t.id,questionIds:questions.filter(q=>q.diagnosis.errorTypeIds.includes(t.id)).map(q=>q.id)}));
  global.DiagnosisBank=freeze({questions,taxonomy,coverage,reference:'全部为原创有限模型与明确变换约定的诊断练习；没有教材原题编号。'});
})(typeof window!=='undefined'?window:globalThis);
