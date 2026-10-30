/* Original v0.4 exercises linking formulas, exact finite models and drawing.
 * Standards are explicit analytic data, not sampled fits or textbook copies. */
(function(global){
  'use strict';
  const m=String.raw,questions=[];
  const topics=new Map((global.COURSE?.chapters||[]).flatMap(c=>c.topics.map(t=>[t.id,{chapter:c.id,title:t.title}])));
  const ct=rows=>({version:1,domain:'ct',segments:rows.map(([start,end,y0,y1=y0])=>({start,end,y0,y1})),samples:[],endpoints:[],impulses:[],outside:0});
  const dt=rows=>({version:1,domain:'dt',segments:[],samples:rows.map(([n,value])=>({n,value})),endpoints:[],impulses:[],outside:0});
  function add(id,topicId,difficulty,title,prompt,inputModel,expectedModel,targetExpression,idea,solution,commonError,extra={}){
    const t=topics.get(topicId);if(!t)throw new Error('Unknown editor training topic: '+topicId);
    questions.push({id:'edit-wave-'+id,assessmentKey:'edit-wave-'+id,type:'waveform',category:'公式与波形双向训练',chapter:t.chapter,topicId,topic:t.title,difficulty,title,prompt,inputModel,expectedModel,targetExpression,
      answer:expectedModel.domain==='ct'?'按解析中的分段区间、幅度及题目指定端点绘制；其余为0。':'按解析中的整数索引和值画茎状图；其余整数样本为0。',
      idea,solution,commonError,range:{xmin:-4,xmax:7,ymin:-5,ymax:5},axisStep:{x:.5,y:.5},grading:{kind:'waveform'},comparisonScope:'finite',
      endpointConvention:expectedModel.domain==='ct'?'除题目明确指定的孤立点外，端点不参与本题积分意义比较；用两侧极限表达跳变。':'仅整数索引有定义；未列样本为0，不在整数间插值。',
      source:{kind:'original',reference:'奥本海姆《信号与系统》第二版知识体系',page:null},editorTraining:true,...extra});
  }
  const trapezoid=ct([[0,1,0,2],[1,2,2],[2,3,2,0]]);
  add('delay-trapezoid','time-transform',1,'梯形脉冲的整体延时',m`图中 $x(t)$ 的拐点为 $(0,0),(1,2),(2,2),(3,0)$，其余为0。用公式或关键点绘制 $y(t)=x(t-2)$。`,trapezoid,ct([[2,3,0,2],[3,4,2],[4,5,2,0]]),
    'where(t>=2 && t<3,2*(t-2),where(t>=3 && t<4,2,where(t>=4 && t<5,2*(5-t),0)))',
    '同一个延时作用于每一个拐点，区间内部的斜率保持不变。',
    [m`令原时间为 $s=t-2$，解得 $t=s+2$。`,m`原时间0、1、2、3分别映到2、3、4、5；幅度0、2、2、0不变。`,m`所以 $y=2(t-2)$（$2<t<3$），$y=2$（$3<t<4$），$y=2(5-t)$（$4<t<5$），其余为0。`],
    '只移动平台而漏掉两段斜坡；或把延时画成提前。',{diagnosis:{errorTypeIds:['time-shift-direction'],transform:{a:1,b:-2,amplitude:1}}});
  add('reverse-signed-step','time-transform',1,'正负阶梯的时间反转',m`已知 $x(t)=3$（$-2<t<-1$），$x(t)=-1$（$-1<t<1$），其余为0。绘制 $y(t)=x(-t)$，注意时间反转不改变幅值符号。`,ct([[-2,-1,3],[-1,1,-1]]),ct([[-1,1,-1],[1,2,3]]),
    'where(t>=-1 && t<1,-1,where(t>=1 && t<2,3,0))',
    '把原区间端点取负并交换左右顺序，保留原来属于该段的高度。',
    [m`由 $-2<-t<-1$ 得 $1<t<2$，该段高度仍为3。`,m`由 $-1<-t<1$ 得 $-1<t<1$，该段高度仍为-1。`,m`按新时间从左到右排列：先画负平台，再画正平台；其余为0。`],
    '把时间反转同时当成幅度取反。',{diagnosis:{errorTypeIds:['time-reversal-omitted'],transform:{a:-1,b:0,amplitude:1}}});
  add('thirds-compression','time-transform',2,'含三分之一边界的压缩',m`已知 $x(t)=1$（$-2<t<-1$），$x(t)=-1$（$-1<t<1$），其余为0。绘制 $y(t)=x(3t+1)$；表格可直接输入分数。`,ct([[-2,-1,1],[-1,1,-1]]),ct([[-1,-2/3,1],[-2/3,0,-1]]),
    'where(t>=-1 && t<-2/3,1,where(t>=-2/3 && t<0,-1,0))',
    '直接解关键点映射，避免先四舍五入再拼接分段。',
    [m`令 $s=3t+1$，则 $t=(s-1)/3$。`,m`原边界 $-2,-1,1$ 分别映到 $-1,-2/3,0$。`,m`第一段宽度为1/3、高1；第二段宽度为2/3、高-1；共享边界必须一致。`],
    '把时间宽度乘3；或给相邻分段输入不同的近似边界。',{diagnosis:{errorTypeIds:['time-scale','transform-order'],transform:{a:3,b:1,amplitude:1}},axisStep:{x:1/3,y:1},range:{xmin:-2,xmax:2,ymin:-2,ymax:2}});
  add('reversed-ramp','time-transform',2,'反转延时后的下降斜坡',m`图中 $x(t)=t$（$0<t<2$），其余为0。绘制 $y(t)=x(3-t)$。`,ct([[0,2,0,2]]),ct([[1,3,2,0]]),
    'where(t>=1 && t<3,3-t,0)',
    '一并处理非零条件和斜坡函数本身的自变量。',
    [m`由 $0<3-t<2$ 得 $1<t<3$。`,m`在该区间代入原表达式，得到 $y(t)=3-t$。`,m`在t=1右侧从2下降，到t=3左侧到0；不是从0上升的斜坡。`],
    '只移动支持区间，没有把上升斜坡反向。',{diagnosis:{errorTypeIds:['time-reversal-omitted','time-shift-direction'],transform:{a:-1,b:3,amplitude:1}}});
  add('negative-half-triangle','time-transform',1,'三角脉冲的负半倍幅度',m`图中 $x(t)$ 顶点为 $(0,0),(1,2),(3,0)$，其余为0。绘制 $y(t)=-x(t)/2$。`,ct([[0,1,0,2],[1,3,2,0]]),ct([[0,1,0,-1],[1,3,-1,0]]),
    'where(t>=0 && t<1,-t,where(t>=1 && t<3,(t-3)/2,0))',
    '幅度缩放只改变纵坐标，不改变任何时间边界。',
    [m`三个拐点的时间仍为0、1、3。`,m`幅值0、2、0分别乘-1/2，变为0、-1、0。`,m`所以两段分别为 $-t$（$0<t<1$）与 $(t-3)/2$（$1<t<3$）。`],
    '把幅度因子1/2用作时间展开，或漏掉负号。',{diagnosis:{errorTypeIds:['amplitude-scale'],transform:{a:1,b:0,amplitude:-.5}}});
  add('combined-affine','time-transform',3,'反转压缩与幅度组合',m`已知 $x(t)=1$（$-1<t<0$），$x(t)=-2$（$0<t<2$），其余为0。绘制 $y(t)=2x(-2t+2)$。`,ct([[-1,0,1],[0,2,-2]]),ct([[0,1,-4],[1,1.5,2]]),
    'where(t>=0 && t<1,-4,where(t>=1 && t<3/2,2,0))',
    '先用原边界解新时间，再单独计算幅度倍率。',
    [m`令 $s=-2t+2$，得到 $t=(2-s)/2$。`,m`原边界-1、0、2映到3/2、1、0；负时间系数使区间顺序反向。`,m`原高度-2的段变到 $(0,1)$，乘2得-4；原高度1的段变到 $(1,3/2)$，乘2得2。`],
    '将+2当成最终右移2；或把时间压缩额外乘进幅值。',{diagnosis:{errorTypeIds:['transform-order','time-reversal-omitted','amplitude-scale'],transform:{a:-2,b:2,amplitude:2}}});

  add('subtract-windows','impulse-step',1,'用两个矩形构造正负分段',m`已知图中 $x(t)=u(t+1)-u(t)$，$h(t)=u(t)-u(t-2)$。绘制 $y(t)=x(t)-h(t)$，并核对其阶跃表达式。`,ct([[-1,0,1]]),ct([[-1,0,1],[0,2,-1]]),
    'u(t+1)-2*u(t)+u(t-2)',
    '分别在所有跃迁时刻之间作逐点相减。',
    [m`跃迁时刻为-1、0、2。在 $(-1,0)$ 只有x=1，故y=1。`,m`在 $(0,2)$ 只有h=1，故y=-1；其余区间两者均为0。`,m`展开得到 $y=u(t+1)-2u(t)+u(t-2)$；0处跃变量为-2。`],
    '误把减去矩形只理解为高度减1，而漏掉0处由+1到-1的跳变。',{auxModel:ct([[0,2,1]]),auxLabel:'h(t) · 被减矩形'});
  add('ramp-window','impulse-step',2,'截窗保留斜坡的原纵坐标',m`图中 $x(t)=t$（$0<t<3$），其余为0；$w(t)=u(t-1/2)-u(t-3/2)$。绘制 $y(t)=x(t)w(t)$。`,ct([[0,3,0,3]]),ct([[.5,1.5,.5,1.5]]),
    't*(u(t-1/2)-u(t-3/2))',
    '取非零区间的交集，但不把斜坡在新左端重置为0。',
    [m`两非零区间的交集为 $(1/2,3/2)$。`,m`窗口在该区间内等于1，因此y=t，左右极限为1/2和3/2。`,m`窗口以外输出为0；在1/2和3/2处有跳变，不用斜线跨接。`],
    '把输出误画成t-1/2，使左端幅度错误为0。',{auxModel:ct([[.5,1.5,1]]),auxLabel:'w(t) · 矩形窗'});
  add('join-ramp-pieces','impulse-step',2,'拼合不等宽的两段斜坡',m`已知 $x(t)=t+1$（$-1\le t<0$），$h(t)=1-t/2$（$0\le t\le2$），各自在其他位置为0。绘制 $y(t)=x(t)+h(t)$，写出分段式。`,ct([[-1,0,0,1]]),ct([[-1,0,0,1],[0,2,1,0]]),
    'where(t>=-1 && t<0,t+1,where(t>=0 && t<=2,1-t/2,0))',
    '把区间规则和端点极限一起拼接，两侧斜率可以不同。',
    [m`在 $-1<t<0$，h为0，所以y=t+1。`,m`在 $0<t<2$，x为0，所以y=1-t/2。`,m`两侧在t=0的极限均为1；顶点为(-1,0)、(0,1)、(2,0)，右侧斜率是-1/2。`],
    '把三角形误画成左右等宽；或将两段不同的斜率写成同一数值。',{auxModel:ct([[0,2,1,0]]),auxLabel:'h(t) · 右侧下降段'});
  const isolated=ct([[0,2,1]]);isolated.endpoints=[{at:1,value:3}];
  add('isolated-point','impulse-step',2,'孤立点不同于冲激',m`图中 $x(t)=u(t)-u(t-2)$。定义 $y(t)=x(t)$，但单独规定 $y(1)=3$。绘制普通函数y，并明确设置该单点；这里不是Dirac冲激。`,ct([[0,2,1]]),isolated,
    'where(t==1,3,where(t>=0 && t<2,1,0))',
    '普通函数的单点覆盖不会产生冲激权重，也不应画成有限宽尖峰。',
    [m`在(0,2)除t=1外高度仍为1；区间之外为0。`,m`在t=1处将普通函数值单独设为3：原平台位置标空心点(1,1)，新值标实心点(1,3)。`,m`该单点不改变积分和能量，但题目明确要求y(1)，因此本题单独核对它；不能写成 $x(t)+2\delta(t-1)$。`],
    '把单点值3误画成冲激或窄三角脉冲。',{endpointChecks:[{at:1,value:3}],endpointConvention:'本题明确核对y(1)=3；普通孤立点不是冲激，其余孤立端点未作要求。'});
  add('disjoint-pulses','impulse-step',1,'保留中间零区间',m`已知 $x(t)=2[u(t+2)-u(t+1)]$，$h(t)=u(t-1)-u(t-3)$。绘制 $y(t)=x(t)-h(t)$；注意两段之间没有非零连接。`,ct([[-2,-1,2]]),ct([[-2,-1,2],[1,3,-1]]),
    '2*(u(t+2)-u(t+1))-(u(t-1)-u(t-3))',
    '有限波形允许不相邻的非零分段，间隙仍须按0处理。',
    [m`在(-2,-1)内x=2、h=0，输出2。`,m`在(1,3)内x=0、h=1，输出-1。`,m`中间(-1,1)以及其他区间两者均为0，不用一条斜线把两个平台连接起来。`],
    '把没有定义的区间连成倾斜直线。',{auxModel:ct([[1,3,1]]),auxLabel:'h(t) · 右侧矩形'});
  const closed=ct([[0,1,2]]);closed.segments[0].leftClosed=false;closed.segments[0].rightClosed=true;
  add('open-closed-window','impulse-step',2,'左开右闭的窗口',m`已知x在 $-1<t<2$ 为2，其余为0。定义 $y(t)=x(t)$（$0<t\le1$），其余为0。绘制y，本题明确要求 $y(0)=0,y(1)=2$。`,ct([[-1,2,2]]),closed,
    'where(t>0 && t<=1,2,0)',
    '区间内部的水平段和端点取值是两个不同层面的条件。',
    [m`在(0,1)内高度为2，区间之外为0。`,m`左边条件为t>0，所以t=0不包含，y(0)=0；平台左端用空心标记。`,m`右边条件为t≤1，所以t=1包含，y(1)=2；平台右端用实心标记。`],
    '默认所有矩形均左闭右开；这与本题特别规定的端点不同。',{endpointChecks:[{at:0,value:0},{at:1,value:2}],endpointConvention:'本题明确检查y(0)=0和y(1)=2；平台区间为(0,1]。'});

  add('delta-sequence','ct-dt',1,'由移位Kronecker冲激组成序列',m`图中x为单位序列 $\delta[n]$。绘制 $y[n]=\delta[n+2]-2\delta[n]+\delta[n-3]$，只允许整数样本。`,dt([[0,1]]),dt([[-2,1],[0,-2],[3,1]]),
    'delta[n+2]-2*delta[n]+delta[n-3]',
    '分别令每个离散冲激的自变量为0，得到索引后读取其系数。',
    [m`δ[n+2]只在n=-2处等于1。`,m`-2δ[n]在n=0处给出-2；δ[n-3]在n=3处给出1。`,m`所以只有(-2,1)、(0,-2)、(3,1)三个非零样本；不作连续插值，也没有CT冲激的尺度面积因子。`],
    '把δ[n+2]放到n=2，或将样本之间连为连续折线。',{range:{xmin:-4,xmax:5,ymin:-3,ymax:3},axisStep:{x:1,y:1}});
  add('discrete-reflect-delay','time-transform',2,'不等间距样本的组合变换',m`已知 $x[-1]=2,x[0]=-1,x[2]=3$，其余为0。绘制 $y[n]=x[2-n]$；原序列在n=1处为0。`,dt([[-1,2],[0,-1],[2,3]]),dt([[0,3],[2,-1],[3,2]]),
    '3*delta[n]-delta[n-2]+2*delta[n-3]',
    '对每个非零原索引k求n=2-k，并保留样本之间的零值。',
    [m`由k=2-n得n=2-k。`,m`原k=-1、0、2映到n=3、2、0，幅度仍为2、-1、3。`,m`因此y[0]=3、y[2]=-1、y[3]=2，y[1]=0；不得把缺口补成连续或相邻非零序列。`],
    '忽略原序列的零间隔，或只作平移而遗漏反转。',{diagnosis:{errorTypeIds:['time-reversal-omitted','time-shift-direction'],transform:{a:-1,b:2,amplitude:1}},range:{xmin:-3,xmax:5,ymin:-2,ymax:4},axisStep:{x:1,y:1}});
  add('weighted-delay-sum','impulse-response',2,'原序列与加权延时相加',m`已知 $x[-1]=1,x[0]=-1,x[1]=2$，其余为0。绘制 $y[n]=x[n]+2x[n-1]$，必须考虑输入结束后的延时贡献。`,dt([[-1,1],[0,-1],[1,2]]),dt([[-1,1],[0,1],[1,0],[2,4]]),
    'delta[n+1]+delta[n]+4*delta[n-2]',
    '先把延时序列乘2，再逐整数索引相加。',
    [m`n=-1：y=1；n=0：y=-1+2×1=1。`,m`n=1：y=2+2×(-1)=0；n=2：y=0+2×2=4。`,m`其余为0。也可理解为与h[n]=δ[n]+2δ[n-1]卷积；输出不能在n=1处直接截断。`],
    '遗漏n=2的样本，或把n=1处的相消画成非零。',{auxModel:dt([[0,1],[1,2]]),auxLabel:'等效h[n]',diagnosis:{operation:'convolution',errorTypeIds:['convolution-support']},range:{xmin:-3,xmax:4,ymin:-3,ymax:5},axisStep:{x:1,y:1}});

  add('ct-shifted-convolution','ct-convolution',2,'移位矩形与双高度矩形卷积',m`已知 $x(t)=1$（$-1<t<1$），$h(t)=2$（$1<t<2$），其余均为0。绘制 $y=x*h$。`,ct([[-1,1,1]]),ct([[0,1,0,2],[1,2,2],[2,3,2,0]]),
    'where(t>=0 && t<1,2*t,where(t>=1 && t<2,2,where(t>=2 && t<3,2*(3-t),0)))',
    '支持端点相加，再乘上两矩形高度与重叠长度。',
    [m`支持区间为[-1+1,1+2]=[0,3]。固定t，重叠为[-1,1]∩[t-2,t-1]。`,m`重叠长度依次为t（0<t<1）、1（1<t<2）、3-t（2<t<3）。`,m`乘高度积1×2，输出分别为2t、2、2(3-t)；其余为0。平台高度2而非4。`],
    '支持区间取交集，或把较宽矩形宽度误当平台高度因子。',{auxModel:ct([[1,2,2]]),auxLabel:'h(t)',diagnosis:{operation:'convolution',errorTypeIds:['convolution-support','convolution-overlap']}});
  add('ct-negative-convolution','ct-convolution',3,'带负幅度的梯形卷积',m`已知 $x(t)=-1$（$0<t<2$），$h(t)=3$（$-1<t<0$），其余为0。绘制 $y=x*h$。`,ct([[0,2,-1]]),ct([[-1,0,0,-3],[0,1,-3],[1,2,-3,0]]),
    'where(t>=-1 && t<0,-3*(t+1),where(t>=0 && t<1,-3,where(t>=1 && t<2,-3*(2-t),0)))',
    '重叠长度非负，但幅度乘积为负；输出应在时间轴下方。',
    [m`支持区间为[0+(-1),2+0]=[-1,2]。`,m`重叠长度为t+1（-1<t<0）、1（0<t<1）、2-t（1<t<2）。`,m`乘高度积(-1)×3=-3，得到-3(t+1)、-3、-3(2-t)，其余为0。`],
    '认为卷积是面积所以总为正，漏掉了乘积函数的负号。',{auxModel:ct([[-1,0,3]]),auxLabel:'h(t)',diagnosis:{operation:'convolution',errorTypeIds:['convolution-reversal','convolution-support']}});
  add('dt-gapped-convolution','dt-convolution',2,'带索引缺口的离散卷积',m`已知 $x[-1]=1,x[0]=2$，$h[0]=-1,h[2]=3$，其余为0。绘制完整线性卷积 $y[n]=(x*h)[n]$。`,dt([[-1,1],[0,2]]),dt([[-1,-1],[0,-2],[1,3],[2,6]]),
    '-delta[n+1]-2*delta[n]+3*delta[n-1]+6*delta[n-2]',
    '逐对乘幅值，并把贡献累加到两个索引之和。',
    [m`(-1)+0=-1贡献1×(-1)=-1；0+0=0贡献2×(-1)=-2。`,m`(-1)+2=1贡献1×3=3；0+2=2贡献2×3=6。`,m`没有其他非零索引对，因此其余为0。h[1]=0不能被自动补成非零。`],
    '把h[2]误当第二个相邻样本h[1]，从而压缩整个输出索引。',{auxModel:dt([[0,-1],[2,3]]),auxLabel:'h[n]',diagnosis:{operation:'convolution',errorTypeIds:['convolution-bounds','convolution-support']},range:{xmin:-3,xmax:4,ymin:-3,ymax:7},axisStep:{x:1,y:1}});
  function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
  global.WaveformEditorQuestions=freeze(questions);
})(typeof window!=='undefined'?window:globalThis);
