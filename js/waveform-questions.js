/* Original waveform drawing exercises. No textbook exercise numbers or images.
 * All finite models are exact piecewise-linear CT functions or integer DT
 * sequences. The one unit-step question explicitly compares an observed window.
 */
(function(global){
  'use strict';
  const m=String.raw,questions=[];
  const topics=new Map((global.COURSE?.chapters||[]).flatMap(c=>c.topics.map(t=>[t.id,{chapter:c.id,title:t.title}])));
  const ct=rows=>({version:1,domain:'ct',segments:rows.map(([start,end,y0,y1=y0])=>({start,end,y0,y1})),samples:[],impulses:[],endpoints:[],outside:0});
  const dt=rows=>({version:1,domain:'dt',segments:[],samples:rows.map(([n,value])=>({n,value})),impulses:[],endpoints:[],outside:0});
  function add(id,topicId,difficulty,title,prompt,inputModel,expectedModel,answer,idea,solution,commonError,extra={}){
    const topic=topics.get(topicId);if(!topic)throw new Error('Unknown waveform topic: '+topicId);
    const item={id:'wave-'+id,type:'waveform',assessmentKey:'wave-'+id,category:'绘制输出波形',chapter:topic.chapter,topicId,topic:topic.title,difficulty,title,prompt,inputModel,expectedModel,answer,idea,solution,commonError,
      range:{xmin:-4,xmax:7,ymin:-4,ymax:4},axisStep:{x:1,y:1},grading:{kind:'waveform'},comparisonScope:'finite',
      endpointConvention:inputModel.domain==='ct'?'除题目另有明确规定，连续时间孤立端点取值不参与本题判分；竖直线仅标记跳变。':'离散序列只在整数索引上定义，未列出的整数样本均为0。',
      source:{kind:'original',reference:'奥本海姆《信号与系统》第二版知识体系',page:null},...extra};
    questions.push(item);
  }
  const rectangle=ct([[0,2,1]]),asymmetric=ct([[0,1,1],[1,3,2]]),triangle=ct([[0,1,0,1],[1,2,1,0]]),ramp=ct([[0,2,0,2]]);
  add('ct-delay','time-transform',1,'矩形脉冲右移',
    m`已知 $x(t)=u(t)-u(t-2)$。绘制 $y(t)=x(t-3)$ 的完整波形，未列出区间为0。`,rectangle,ct([[3,5,1]]),
    m`$y(t)=u(t-3)-u(t-5)$；在 $(3,5)$ 内为1，其余区间为0。`,
    '让原信号的自变量落入非零区间，解出新时间的范围。',
    [m`原信号非零条件为 $0<t<2$，高度为1。`,m`对 $x(t-3)$ 写出 $0<t-3<2$。`,m`加3得 $3<t<5$。整个矩形右移3，高度和宽度不变。`],
    '把 x(t-3) 误画成左移3，或只移动其中一个跳变。',{inputExpression:'u(t)-u(t-2)',systemExpression:'y(t)=x(t-3)'});
  add('ct-advance','time-transform',1,'提前而不改变宽度',
    m`已知 $x(t)=2[u(t+1)-u(t-1)]$。绘制 $y(t)=x(t+2)$ 的完整波形。`,ct([[-1,1,2]]),ct([[-3,-1,2]]),
    m`$y(t)=2[u(t+3)-u(t+1)]$；在 $(-3,-1)$ 内为2，其余区间为0。`,
    '用不等式判断向左移动，避免只靠“正负号口诀”。',
    [m`原脉冲的时间范围为 $-1<t<1$。`,m`代入 $t+2$：$-1<t+2<1$。`,m`减2得 $-3<t<-1$；高度仍为2，宽度仍为2。`],
    '把提前与延时弄反，或误把高度也加2。',{inputExpression:'2*(u(t+1)-u(t-1))',systemExpression:'y(t)=x(t+2)'});
  add('ct-reverse','time-transform',1,'不对称阶梯的反转',
    m`已知 $x(t)$ 在 $(0,1)$ 内为1，在 $(1,3)$ 内为2，其余为0。绘制 $y(t)=x(-t)$。`,asymmetric,ct([[-3,-1,2],[-1,0,1]]),
    m`$y(t)=2$（$-3<t<-1$），$y(t)=1$（$-1<t<0$），其余为0。`,
    '把每个拐点关于 t=0 映射，幅度随该段一起移动。',
    [m`原区间 $(1,3)$ 由 $1<-t<3$ 变为 $-3<t<-1$，高度2。`,m`原区间 $(0,1)$ 变为 $-1<t<0$，高度1。`,m`按时间从左到右排列，先画高度2的宽段，再画高度1的窄段。`],
    '只把横坐标取负，却保留了原来从左到右的高度顺序。',{inputExpression:'where(t>=0 && t<1,1,where(t>=1 && t<3,2,0))',systemExpression:'y(t)=x(-t)'});
  add('ct-compress','time-transform',2,'斜坡的时间压缩',
    m`已知 $x(t)=t$（$0<t<2$），其余为0。绘制 $y(t)=x(2t)$。`,ramp,ct([[0,1,0,2]]),
    m`$y(t)=2t$（$0<t<1$），其余为0。`,
    '同时检查非零区间与区间内部的函数值。',
    [m`非零条件 $0<2t<2$ 给出 $0<t<1$。`,m`在该区间将自变量代入斜坡，得到 $x(2t)=2t$。`,m`斜坡宽度从2压到1，右端极限仍为2，斜率从1变为2。`],
    '缩短区间后仍画原斜率，导致峰值也错误缩小。',{inputExpression:'where(t>=0 && t<2,t,0)',systemExpression:'y(t)=x(2t)',range:{xmin:-1,xmax:3,ymin:-1,ymax:3}});
  add('ct-amplitude','time-transform',1,'三角脉冲的幅度反相',
    m`已知图中的三角脉冲 $x(t)$，顶点为 $(0,0),(1,1),(2,0)$，其余为0。绘制 $y(t)=-2x(t)$。`,triangle,ct([[0,1,0,-2],[1,2,-2,0]]),
    m`$y(t)=-2t$（$0<t<1$），$y(t)=2t-4$（$1<t<2$），其余为0。`,
    '每个时间坐标保持不变，只把纵坐标乘以-2。',
    [m`三个顶点的时间仍为0、1、2。`,m`幅值分别变为0、-2、0。`,m`在 $(0,1)$ 内斜率为-2；在 $(1,2)$ 内斜率为2。`],
    '把幅度反相误当成时间反转，或只改变符号而漏掉倍数。',{inputExpression:'where(t>=0 && t<1,t,where(t>=1 && t<2,2-t,0))',systemExpression:'y(t)=-2x(t)',range:{xmin:-1,xmax:3,ymin:-3,ymax:2}});
  add('ct-two-minus','time-transform',2,'先解自变量的组合反转',
    m`已知 $x(t)$ 在 $(0,1)$ 内为1，在 $(1,3)$ 内为2，其余为0。绘制 $y(t)=x(2-t)$。`,asymmetric,ct([[-1,1,2],[1,2,1]]),
    m`$y(t)=2$（$-1<t<1$），$y(t)=1$（$1<t<2$），其余为0。`,
    '对每个原始时间 s 使用 t=2-s，不要混淆平移和反转的顺序。',
    [m`原拐点 $s=0,1,3$ 分别映到 $t=2,1,-1$。`,m`原高度2的区间由 $1<2-t<3$ 得 $-1<t<1$。`,m`原高度1的区间映到 $1<t<2$；按从左到右重新排列。`],
    '误写为 x(-t-2)，或反转以后仍保留原来的幅度顺序。',{inputExpression:'where(t>=0 && t<1,1,where(t>=1 && t<3,2,0))',systemExpression:'y(t)=x(2-t)',range:{xmin:-3,xmax:4,ymin:-1,ymax:3}});
  add('ct-reverse-compress','time-transform',3,'反转、压缩与移位',
    m`已知 $x(t)$ 在 $(0,1)$ 内为1，在 $(1,3)$ 内为2，其余为0。绘制 $y(t)=x(-2t+4)$。`,asymmetric,ct([[.5,1.5,2],[1.5,2,1]]),
    m`$y(t)=2$（$1/2<t<3/2$），$y(t)=1$（$3/2<t<2$），其余为0。`,
    '直接把原拐点 s 映到 t=(4-s)/2，可靠地同时处理三种操作。',
    [m`令 $s=-2t+4$，解得 $t=(4-s)/2$。`,m`原拐点0、1、3分别映到2、3/2、1/2；区间顺序反向。`,m`从左向右先画高度2的宽度1，再画高度1的宽度1/2。幅值不受时间缩放影响。`],
    '把+4当成最终右移4；提取-2后实际中心移位是2。',{inputExpression:'where(t>=0 && t<1,1,where(t>=1 && t<3,2,0))',systemExpression:'y(t)=x(-2t+4)',range:{xmin:-1,xmax:4,ymin:-1,ymax:3},axisStep:{x:.5,y:1}});
  add('ct-expand-delay','time-transform',2,'斜坡展开与延时',
    m`已知 $x(t)=t+1$（$-1<t<1$），其余为0。绘制 $y(t)=x((t-1)/2)$。`,ct([[-1,1,0,2]]),ct([[-1,3,0,2]]),
    m`$y(t)=(t+1)/2$（$-1<t<3$），其余为0。`,
    '展开改变持续时间和斜率，延时改变最终位置。',
    [m`求 $-1<(t-1)/2<1$，得到 $-1<t<3$。`,m`将 $(t-1)/2$ 代入 $s+1$，得到 $(t+1)/2$。`,m`持续时间变为4，斜率变为1/2，左右端极限为0与2。`],
    '展开之后忘记把斜率减半，或把区间错画成(0,4)。',{inputExpression:'where(t>=-1 && t<1,t+1,0)',systemExpression:'y(t)=x((t-1)/2)',range:{xmin:-3,xmax:5,ymin:-1,ymax:3}});
  add('ct-add','impulse-step',1,'两个阶跃组合相加',
    m`已知 $x(t)=u(t)-u(t-2)$，$h(t)=u(t-1)-u(t-3)$。绘制 $y(t)=x(t)+h(t)$，注意这不是卷积。`,rectangle,ct([[0,1,1],[1,2,2],[2,3,1]]),
    m`$y(t)=1$（$0<t<1$或$2<t<3$），$y(t)=2$（$1<t<2$），其余为0。`,
    '把所有跃迁时刻排序，在每一小段逐点相加。',
    [m`两信号的跃迁时刻并集为0、1、2、3。`,m`区间(0,1)只有x为1；区间(1,2)两者均为1；区间(2,3)只有h为1。`,m`依次画高度1、2、1的三个单位宽区间。`],
    '把逐点相加误当成卷积，画成三角形。',{inputExpression:'u(t)-u(t-2)',auxModel:ct([[1,3,1]]),auxLabel:'h(t)',auxExpression:'u(t-1)-u(t-3)',systemExpression:'y(t)=x(t)+h(t)',range:{xmin:-1,xmax:4,ymin:-1,ymax:3}});
  add('ct-window-product','impulse-step',2,'矩形窗截取斜坡',
    m`已知 $x(t)=t$（$0<t<3$），其余为0，$w(t)=u(t-1)-u(t-2)$。绘制 $y(t)=x(t)w(t)$。`,ct([[0,3,0,3]]),ct([[1,2,1,2]]),
    m`$y(t)=t$（$1<t<2$），其余为0。`,
    '乘法先取两信号非零区间的交集，再保留该处原函数值。',
    [m`斜坡非零区间为(0,3)，窗口非零区间为(1,2)，交集为(1,2)。`,m`窗口在交集内等于1，因此输出仍为t。`,m`在t=1右侧从幅值1开始，在t=2左侧到幅值2结束，不能从0重新爬升。`],
    '把被截取斜坡误画为t-1，或把逐点乘法当成卷积。',{inputExpression:'where(t>=0 && t<3,t,0)',auxModel:ct([[1,2,1]]),auxLabel:'w(t)',auxExpression:'u(t-1)-u(t-2)',systemExpression:'y(t)=x(t)w(t)',range:{xmin:-1,xmax:4,ymin:-1,ymax:4}});
  add('ct-convolution-triangle','ct-convolution',2,'单位宽矩形的卷积',
    m`零状态LTI系统输入 $x(t)=u(t)-u(t-1)$，冲激响应 $h(t)=u(t)-u(t-1)$。绘制 $y(t)=(x*h)(t)$。`,ct([[0,1,1]]),triangle,
    m`$y(t)=t$（$0<t<1$），$y(t)=2-t$（$1<t<2$），其余为0。`,
    '卷积输出等于两个单位高度矩形的重叠长度。',
    [m`固定t，重叠范围是 $[0,1]\cap[t-1,t]$。`,m`当0<t<1时长度为t；当1<t<2时长度为2-t。`,m`支持区间为[0,2]，在t=1处达到峰值1。其余时刻重叠为空。`],
    '直接把两个矩形逐点相乘，仍画成矩形；或漏掉下降段。',{inputExpression:'u(t)-u(t-1)',auxModel:ct([[0,1,1]]),auxLabel:'h(t)',auxExpression:'u(t)-u(t-1)',systemExpression:'y(t)=(x*h)(t)',range:{xmin:-1,xmax:3,ymin:-1,ymax:2}});
  add('ct-convolution-trapezoid','ct-convolution',3,'不同宽度矩形的卷积',
    m`零状态LTI系统输入 $x(t)=u(t)-u(t-2)$，冲激响应 $h(t)=u(t)-u(t-1)$。绘制 $y(t)=(x*h)(t)$。`,rectangle,ct([[0,1,0,1],[1,2,1],[2,3,1,0]]),
    m`$y(t)=t$（$0<t<1$），$y(t)=1$（$1<t<2$），$y(t)=3-t$（$2<t<3$），其余为0。`,
    '较窄矩形完全进入较宽矩形时出现平台，不再是尖顶三角形。',
    [m`重叠范围为 $[0,2]\cap[t-1,t]$。`,m`0<t<1时重叠长度t；1<t<2时单位宽窗口完全重叠，长度1。`,m`2<t<3时长度为3-t；t<0或t>3时为0。`],
    '把峰值误写为2，或把平台省略成对称三角形。',{inputExpression:'u(t)-u(t-2)',auxModel:ct([[0,1,1]]),auxLabel:'h(t)',auxExpression:'u(t)-u(t-1)',systemExpression:'y(t)=(x*h)(t)',range:{xmin:-1,xmax:4,ymin:-1,ymax:2}});
  const stepInput=ct([[0,4,1]]),stepObserved=ct([[1,4,1]]);stepInput.segments[0].rightClosed=true;stepObserved.segments[0].rightClosed=true;
  add('ct-step-window','impulse-step',1,'只观察给定窗口的阶跃',
    m`仅在观察窗口 $-2\le t\le4$ 内绘制 $y(t)=u(t-1)$。本题不推断窗口外信号，未规定跃迁单点的取值。`,stepInput,stepObserved,
    m`在本题窗口内，$t<1$ 时为0，$t>1$ 时为1。窗口外仍是原阶跃的定义，不是有限矩形。`,
    '观察窗口限制了判题范围，不会改变阶跃本身的无限持续时间。',
    [m`阶跃自变量t-1在t<1时为负，因此y=0。`,m`在t>1时自变量为正，因此y=1。`,m`图上画到窗口右边界4，不能据此推断t>4时输出变为0。`],
    '把观察窗口右边界当成信号终止时刻，从而把阶跃解释为矩形。',{inputExpression:'u(t)',systemExpression:'y(t)=u(t-1)',comparisonScope:'window',observation:'只比较[-2,4]窗口；数据中的outside:0仅是画布表示约定，不表示阶跃窗外为0。',range:{xmin:-2,xmax:4,ymin:-1,ymax:2}});
  const sequence=dt([[-1,1],[0,2],[1,-1]]);
  add('dt-delay','time-transform',1,'有限序列的延时',
    m`已知 $x[-1]=1,x[0]=2,x[1]=-1$，其余为0。用茎状图绘制 $y[n]=x[n-2]$。`,sequence,dt([[1,1],[2,2],[3,-1]]),
    m`$y[1]=1,y[2]=2,y[3]=-1$，其余整数索引为0。`,
    '每一个原整数索引k映到n=k+2，样本幅值不变。',
    [m`令n-2=k，解得n=k+2。`,m`原索引-1、0、1分别映到1、2、3。`,m`在1、2、3处画幅值1、2、-1的茎，其余整数处为0，不连成连续曲线。`],
    '延时方向弄反，或把两个整数之间也定义成折线。',{inputExpression:'delta[n+1]+2*delta[n]-delta[n-1]',systemExpression:'y[n]=x[n-2]',range:{xmin:-3,xmax:5,ymin:-3,ymax:3}});
  add('dt-reverse','time-transform',1,'离散序列的反转',
    m`已知 $x[-1]=1,x[0]=2,x[1]=-1$，其余为0。用茎状图绘制 $y[n]=x[-n]$。`,sequence,dt([[-1,-1],[0,2],[1,1]]),
    m`$y[-1]=-1,y[0]=2,y[1]=1$，其余整数索引为0。`,
    '样本的横坐标取相反数，纵坐标保持原值。',
    [m`原索引-1变为1，幅值仍为1。`,m`原索引1变为-1，幅值仍为-1。`,m`n=0处不移动，幅值仍为2。按整数索引绘制茎状图。`],
    '时间反转时把样本幅值也取负。',{inputExpression:'delta[n+1]+2*delta[n]-delta[n-1]',systemExpression:'y[n]=x[-n]',range:{xmin:-3,xmax:3,ymin:-3,ymax:3}});
  add('dt-combined','time-transform',2,'序列反转、平移与反相',
    m`已知 $x[-1]=1,x[0]=2,x[1]=-1$，其余为0。绘制 $y[n]=-2x[1-n]$。`,sequence,dt([[0,2],[1,-4],[2,-2]]),
    m`$y[0]=2,y[1]=-4,y[2]=-2$，其余整数索引为0。`,
    '先映射索引n=1-k，再把原幅值乘以-2。',
    [m`令k=1-n，得到n=1-k。`,m`原k=-1、0、1分别映到n=2、1、0。`,m`对应幅值1、2、-1乘以-2，得到n=2处-2、n=1处-4、n=0处2。`],
    '反转后忘记重新排列索引，或漏掉幅度倍数-2。',{inputExpression:'delta[n+1]+2*delta[n]-delta[n-1]',systemExpression:'y[n]=-2x[1-n]',range:{xmin:-3,xmax:4,ymin:-5,ymax:3}});
  add('dt-add','ct-dt',1,'两个有限序列逐点相加',
    m`已知 $x[0..2]=[1,2,1]$，$h[0..1]=[1,-1]$，未列出样本为0。绘制 $y[n]=x[n]+h[n]$。`,dt([[0,1],[1,2],[2,1]]),dt([[0,2],[1,1],[2,1]]),
    m`$y[0..2]=[2,1,1]$，其余为0。`,
    '相同整数索引的幅值相加，不移动索引。',
    [m`n=0：1+1=2。`,m`n=1：2+(-1)=1。`,m`n=2：1+0=1；其余整数位置两信号均为0。`],
    '把逐点相加误当成卷积，输出多出一个样本。',{inputExpression:'delta[n]+2*delta[n-1]+delta[n-2]',auxModel:dt([[0,1],[1,-1]]),auxLabel:'h[n]',auxExpression:'delta[n]-delta[n-1]',systemExpression:'y[n]=x[n]+h[n]',range:{xmin:-2,xmax:5,ymin:-2,ymax:3}});
  add('dt-convolution','dt-convolution',2,'有限序列的线性卷积',
    m`已知 $x[0..2]=[1,2,1]$，$h[0..1]=[1,-1]$，其余为0。绘制线性卷积 $y[n]=(x*h)[n]$。`,dt([[0,1],[1,2],[2,1]]),dt([[0,1],[1,1],[2,-1],[3,-1]]),
    m`$y[0..3]=[1,1,-1,-1]$，其余为0。`,
    '按所有索引对的和归并贡献；输出最多有3+2-1=4个样本。',
    [m`y[0]=1；y[1]=2-1=1。`,m`y[2]=1-2=-1；y[3]=-1。`,m`其余整数索引没有非零索引对，输出为0。离散卷积不乘连续积分步长。`],
    '误用逐点相乘，或把连续卷积积分中的步长乘到离散求和里。',{inputExpression:'delta[n]+2*delta[n-1]+delta[n-2]',auxModel:dt([[0,1],[1,-1]]),auxLabel:'h[n]',auxExpression:'delta[n]-delta[n-1]',systemExpression:'y[n]=(x*h)[n]',range:{xmin:-2,xmax:5,ymin:-2,ymax:3}});
  add('dt-lti-output','impulse-response',2,'两抽头LTI系统的输出',
    m`零状态LTI系统的冲激响应为 $h[n]=\delta[n]+\delta[n-1]$。输入 $x[0]=1,x[1]=-1,x[2]=2$，其余为0。绘制输出 $y[n]$。`,dt([[0,1],[1,-1],[2,2]]),dt([[0,1],[1,0],[2,1],[3,2]]),
    m`$y[n]=x[n]+x[n-1]$，所以 $y[0..3]=[1,0,1,2]$，其余为0。`,
    '冲激响应的两个抽头表示原输入加一个延时1的输入。',
    [m`由卷积与移位冲激性质得到y[n]=x[n]+x[n-1]。`,m`依次计算：y[0]=1，y[1]=-1+1=0，y[2]=2-1=1。`,m`n=3仍有延时贡献2，因此y[3]=2；不能在输入结束时立刻截断输出。`],
    '漏掉最后一个延时样本，或把n=1处的相消画成非零。',{inputExpression:'delta[n]-delta[n-1]+2*delta[n-2]',auxModel:dt([[0,1],[1,1]]),auxLabel:'h[n]',auxExpression:'delta[n]+delta[n-1]',systemExpression:'y[n]=x[n]+x[n-1]',range:{xmin:-2,xmax:5,ymin:-2,ymax:3}});
  function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
  global.WaveformQuestions=freeze(questions);
})(typeof window!=='undefined'?window:globalThis);
