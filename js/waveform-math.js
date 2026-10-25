/* Finite real piecewise-linear CT / integer DT waveform contract and grading.
 * No image pixels, parser execution, network or storage. A confirmed waveform is
 * compared as a mathematical object; CT single points matter only if specified.
 */
(function(global){
  'use strict';
  const LIMIT={segments:160,samples:1000,endpoints:160,magnitude:1e6,index:10000};
  const finite=(value,name)=>{if(typeof value!=='number'||!Number.isFinite(value)||Math.abs(value)>LIMIT.magnitude)throw new Error(`${name}必须是绝对值不超过${LIMIT.magnitude}的有限数值。`);return value;};
  const copyIssue=(code,message,extra={})=>({code,message,...extra});
  const fail=(message,code='invalid-model')=>{const error=new Error(message);error.code=code;throw error;};
  const unique=values=>[...new Set(values)].sort((a,b)=>a-b);
  const cleanZero=value=>Object.is(value,-0)?0:value;
  const line=(s,x)=>s.y0+(s.y1-s.y0)*((x-s.start)/(s.end-s.start));
  const sameNumber=(a,b)=>a===b||Math.abs(a-b)<=Number.EPSILON*32*Math.max(Number.MIN_VALUE,Math.abs(a),Math.abs(b));
  function normalize(raw){
    if(!raw||typeof raw!=='object'||!['ct','dt'].includes(raw.domain))fail('请选择连续时间CT或离散时间DT。');
    if(raw.version!==undefined&&raw.version!==1)fail('暂不支持此波形数据版本。');
    if(raw.outside!==undefined&&raw.outside!==0)fail('第一版有限波形的未列出位置须为0；无限信号须由题目明确观察窗口。','unsupported-outside');
    if(!Array.isArray(raw.impulses||[])||(raw.impulses||[]).length)fail('连续冲激箭头的位置和权重需要专门模型；第一版不能按普通有限高度波形自动判分。','unsupported-impulses');
    const result={version:1,domain:raw.domain,segments:[],samples:[],impulses:[],outside:0,endpoints:[]};
    if(!Array.isArray(raw.segments||[])||!Array.isArray(raw.samples||[])||!Array.isArray(raw.endpoints||[]))fail('波形分段、样本和端点须为数组。');
    if((raw.segments||[]).length>LIMIT.segments||(raw.samples||[]).length>LIMIT.samples||(raw.endpoints||[]).length>LIMIT.endpoints)fail('波形数据过多，请合并冗余分段或缩小有限序列。');
    if(raw.domain==='ct'){
      if((raw.samples||[]).length)fail('连续波形不能用离散茎状样本替代，请改用分段。','domain-model-mismatch');
      result.segments=(raw.segments||[]).map((s,i)=>{
        if(!s||typeof s!=='object')fail(`第${i+1}段格式不正确。`);
        const start=finite(s.start,`第${i+1}段起点`),end=finite(s.end,`第${i+1}段终点`),y0=finite(s.y0,`第${i+1}段起始幅值`),y1=finite(s.y1,`第${i+1}段终止幅值`);
        if(!(end>start))fail(`第${i+1}段的终点必须大于起点；竖直跳变不另画成时间区间。`);
        for(const k of ['leftClosed','rightClosed'])if(s[k]!==undefined&&typeof s[k]!=='boolean')fail('开闭端点须为布尔值。');
        return {start:cleanZero(start),end:cleanZero(end),y0:cleanZero(y0),y1:cleanZero(y1),leftClosed:s.leftClosed!==false,rightClosed:s.rightClosed===true};
      }).sort((a,b)=>a.start-b.start||a.end-b.end);
      for(let i=1;i<result.segments.length;i++)if(result.segments[i].start<result.segments[i-1].end)fail('分段时间区间重叠，无法唯一确定普通信号值。','overlapping-segments');
      const seen=new Set();
      result.endpoints=(raw.endpoints||[]).map(p=>{if(!p||typeof p!=='object')fail('特殊端点格式不正确。');const at=finite(p.at,'端点位置'),value=finite(p.value,'端点幅值');if(seen.has(at))fail('同一时刻不能重复定义特殊端点。');seen.add(at);return {at:cleanZero(at),value:cleanZero(value)};}).sort((a,b)=>a.at-b.at);
      for(let i=1;i<result.segments.length;i++){
        const a=result.segments[i-1],b=result.segments[i];
        if(a.end===b.start&&a.rightClosed&&b.leftClosed&&a.y1!==b.y0&&!seen.has(b.start))fail('同一端点被两段定义为不同闭点，请保留一个闭点或明确特殊端点值。','ambiguous-endpoint');
      }
    }else{
      if((raw.segments||[]).length||(raw.endpoints||[]).length)fail('离散信号只在整数索引有值，不能用连续折线或连续端点替代。','domain-model-mismatch');
      const seen=new Set();
      result.samples=(raw.samples||[]).map((s,i)=>{if(!s||typeof s!=='object')fail(`第${i+1}个样本格式不正确。`);const n=finite(s.n,'样本索引'),value=finite(s.value,'样本幅值');if(!Number.isInteger(n)||Math.abs(n)>LIMIT.index)fail(`离散索引必须是绝对值不超过${LIMIT.index}的整数。`,'noninteger-index');if(seen.has(n))fail('同一个整数索引不能定义两个样本。','duplicate-index');seen.add(n);return {n:cleanZero(n),value:cleanZero(value)};}).sort((a,b)=>a.n-b.n);
    }
    return result;
  }
  function validate(raw){try{return {valid:true,model:normalize(raw),issues:[]};}catch(error){return {valid:false,issues:[copyIssue(error.code||'invalid-model',error.message)]};}}
  function evaluator(model){
    if(model.domain==='dt'){const values=new Map(model.samples.map(p=>[p.n,p.value]));return n=>{if(!Number.isInteger(n))throw new Error('离散信号只在整数索引上定义。');return values.get(n)??0;};}
    const endpoints=new Map(model.endpoints.map(p=>[p.at,p.value]));
    return t=>{
      if(!Number.isFinite(t))throw new Error('时间必须是有限实数。');
      if(endpoints.has(t))return endpoints.get(t);
      for(const s of model.segments)if(t>s.start&&t<s.end||t===s.start&&s.leftClosed||t===s.end&&s.rightClosed)return line(s,t);
      return 0;
    };
  }
  function evaluate(raw,x){return evaluator(normalize(raw))(x);}
  function toSignal(raw){
    const model=normalize(raw),fn=evaluator(model),breakpoints=model.domain==='ct'?unique(model.segments.flatMap(s=>[s.start,s.end]).concat(model.endpoints.map(p=>p.at))):[];
    return Object.freeze({domain:model.domain,source:model.domain==='ct'?'已确认的有限分段波形':'已确认的有限整数序列',evaluate:fn,breakpoints,impulses:[],regularZero:model.domain==='ct'?model.segments.every(s=>s.y0===0&&s.y1===0)&&model.endpoints.every(p=>p.value===0):model.samples.every(p=>p.value===0),model});
  }
  function canonicalSegments(segments){
    const result=[];
    for(const segment of segments){
      const s={...segment},previous=result.at(-1);
      if(s.y0===0&&s.y1===0)continue;
      if(previous&&previous.end===s.start&&previous.y1===s.y0){
        const a=(previous.y1-previous.y0)*(s.end-s.start),b=(s.y1-s.y0)*(previous.end-previous.start);
        if(sameNumber(a,b)){previous.end=s.end;previous.y1=s.y1;previous.rightClosed=s.rightClosed;continue;}
      }
      result.push(s);
    }
    return result;
  }
  function limitsAt(segments,x){
    let left=null,right=null;for(const s of segments){if(s.start<x&&s.end>=x)left=s;if(s.start<=x&&s.end>x)right=s;}
    return {left:left?line(left,x):0,right:right?line(right,x):0,leftSlope:left?(left.y1-left.y0)/(left.end-left.start):0,rightSlope:right?(right.y1-right.y0)/(right.end-right.start):0};
  }
  function structural(segments){return unique(segments.flatMap(s=>[s.start,s.end])).filter(x=>{const l=limitsAt(segments,x);return !sameNumber(l.left,l.right)||!sameNumber(l.leftSlope,l.rightSlope);});}
  function snapTimes(segments,expected,timeTolerance){
    const targets=structural(expected),mapping=new Map(),occupied=new Map(),snaps=[];
    for(const x of structural(segments)){
      let closest=null,distance=Infinity;for(const target of targets){const d=Math.abs(target-x);if(d<distance){closest=target;distance=d;}}
      if(closest===null||distance>timeTolerance)continue;
      if(occupied.has(closest)&&occupied.get(closest)!==x)return {uncertain:true,message:'两个不同拐点在时间容差内挤到同一位置；为避免吞掉短波形，请放大并手动修正。'};
      occupied.set(closest,x);mapping.set(x,closest);if(x!==closest)snaps.push({from:x,to:closest});
    }
    const result=segments.map(s=>({...s,start:mapping.get(s.start)??s.start,end:mapping.get(s.end)??s.end}));
    for(let i=0;i<result.length;i++)if(!(result[i].end>result[i].start)||i&&result[i].start<result[i-1].end)return {uncertain:true,message:'时间校准会折叠或重叠一个非零分段，请放大并修正；本次不计分。'};
    return {segments:result,snaps};
  }
  function activeSegment(segments,a,b){return segments.find(s=>s.start<=a&&s.end>=b&&s.end>a&&s.start<b)||null;}
  function uncertain(message,issues=[],extra={}){return {gradable:false,valid:false,correct:null,status:'uncertain',message,summary:message,issues,...extra};}
  function grade(q,raw,options={}){
    if(options.confirmed!==true)return uncertain('请先对照照片和数字波形确认坐标、分段及幅值；未确认的识别结果不计分。',[copyIssue('confirmation-required','识别结果尚未确认。')]);
    if((options.reliable===false||options.recognitionUncertain===true||raw?.uncertain===true)&&options.corrected!==true)return uncertain('识别可靠性不足，请重新校准或手动修正后再确认；本次不计分。',[copyIssue('recognition-uncertain','不能用不可靠的图像提取结果扣分。')]);
    let actual,expected;try{actual=normalize(raw);expected=normalize(q?.expectedModel);}catch(error){return uncertain(error.message,[copyIssue(error.code||'invalid-model',error.message)]);}
    const stepX=Number(q?.axisStep?.x??1),stepY=Number(q?.axisStep?.y??1);
    if(!(stepX>0&&stepY>0))return uncertain('题目的坐标步长无效，请反馈此题。');
    const timeTolerance=Math.min(.05*stepX,Math.max(0,Number(q?.grading?.timeTol??.04*stepX))),amplitudeTolerance=Math.min(.05*stepY,Math.max(0,Number(q?.grading?.ampTol??.04*stepY)));
    if(!Number.isFinite(timeTolerance)||!Number.isFinite(amplitudeTolerance))return uncertain('题目的容差设置无效，请反馈此题。');
    const tolerance={time:timeTolerance,amplitude:amplitudeTolerance,discreteIndex:0};
    if(actual.domain!==expected.domain){const message='时间类型不匹配：连续曲线与离散整数样本不能互相替代。';return {gradable:true,valid:true,correct:false,status:'wrong',score:0,message,summary:message,issues:[copyIssue('domain-mismatch',message)],tolerance};}
    const range=q?.range,xmin=range?.xmin,xmax=range?.xmax;
    if(!Number.isFinite(xmin)||!Number.isFinite(xmax)||!(xmax>xmin)||expected.domain==='dt'&&xmax-xmin>2*LIMIT.index)return uncertain('题目必须给出有限且有效的比较范围。');
    if(q.comparisonScope!=='window'){
      const outside=model=>model.domain==='ct'?model.segments.some(s=>(s.y0!==0||s.y1!==0)&&(s.start<xmin||s.end>xmax))||model.endpoints.some(p=>p.value!==0&&(p.at<xmin||p.at>xmax)):model.samples.some(p=>p.value!==0&&(p.n<xmin||p.n>xmax));
      if(outside(expected))return uncertain('标准模型超出题目范围，请反馈此题，暂不计分。');
      if(outside(actual))return uncertain('检测到观察范围外的非零波形。请扩展检查并修正，不会截掉这些分段后判为正确。',[copyIssue('outside-range','有限信号的全部非零部分必须在本题坐标范围内。')],{tolerance});
    }
    const issues=[],details={kind:actual.domain==='dt'?'finite-integer-sequence':'piecewise-linear-intervals',checkedIntervals:0,numericSamplingUsed:false,timeSnaps:[]};
    if(actual.domain==='dt'){
      const a=new Map(actual.samples.map(s=>[s.n,s.value])),e=new Map(expected.samples.map(s=>[s.n,s.value]));
      const positions=unique([...a.keys(),...e.keys()]).filter(n=>n>=Math.ceil(xmin)&&n<=Math.floor(xmax));
      for(const n of positions){details.checkedIntervals++;const av=a.get(n)??0,ev=e.get(n)??0,rounding=Number.EPSILON*32*Math.max(stepY,Math.abs(av),Math.abs(ev));if(Math.abs(av-ev)>amplitudeTolerance+rounding)issues.push(copyIssue('sample-mismatch',`索引 n=${n} 处应为${ev}，当前为${av}。`,{n,actual:av,expected:ev}));}
    }else{
      const expectedSegments=canonicalSegments(expected.segments),snapped=snapTimes(canonicalSegments(actual.segments),expectedSegments,timeTolerance);
      if(snapped.uncertain)return uncertain(snapped.message,[copyIssue('time-resolution',snapped.message)],{tolerance});
      details.timeSnaps=snapped.snaps;const actualSegments=snapped.segments;
      const positions=unique([xmin,xmax,...expectedSegments.flatMap(s=>[s.start,s.end]),...actualSegments.flatMap(s=>[s.start,s.end])]).filter(x=>x>=xmin&&x<=xmax);
      for(let i=1;i<positions.length;i++){
        const start=positions[i-1],end=positions[i];if(!(end>start))continue;details.checkedIntervals++;
        const a=activeSegment(actualSegments,start,end),e=activeSegment(expectedSegments,start,end),actualStart=a?line(a,start):0,actualEnd=a?line(a,end):0,expectedStart=e?line(e,start):0,expectedEnd=e?line(e,end):0;
        // A linear difference reaches its maximum absolute value at an interval
        // limit. Never skip a short interval or use a coarse display sample grid.
        const rounding=Number.EPSILON*32*Math.max(stepY,Math.abs(actualStart),Math.abs(actualEnd),Math.abs(expectedStart),Math.abs(expectedEnd));
        if(Math.max(Math.abs(actualStart-expectedStart),Math.abs(actualEnd-expectedEnd))>amplitudeTolerance+rounding)issues.push(copyIssue('interval-mismatch',`区间 (${Number(start.toPrecision(7))}, ${Number(end.toPrecision(7))}) 内的幅值、形状或斜率不匹配。`,{start,end,actualStart,actualEnd,expectedStart,expectedEnd}));
      }
      if(Array.isArray(q.endpointChecks)){
        const fn=evaluator(actual);for(const point of q.endpointChecks){if(!Number.isFinite(point.at)||!Number.isFinite(point.value))return uncertain('题目指定的端点标准无效。');const value=fn(point.at),rounding=Number.EPSILON*32*Math.max(stepY,Math.abs(value),Math.abs(point.value));if(Math.abs(value-point.value)>amplitudeTolerance+rounding)issues.push(copyIssue('endpoint-mismatch',`题目明确要求 t=${point.at} 处的值为${point.value}，当前为${value}。`,{at:point.at,actual:value,expected:point.value}));}
      }
    }
    const correct=issues.length===0,message=correct?'波形正确：时间位置、分段形状和幅值符合本题数学标准及容差。':'波形有误：请对照标出的区间或整数索引，检查时间变换、幅值和斜率。';
    return {gradable:true,valid:true,correct,status:correct?'correct':'wrong',score:correct?100:0,message,summary:message,issues:issues.slice(0,20),issueCount:issues.length,tolerance,comparison:details,scope:q.comparisonScope==='window'?'只比较题目指定观察窗口；不推断窗外信号':'有限信号全部非零部分均在题目范围内，未列出位置为0',endpointConvention:Array.isArray(q.endpointChecks)?'只检查题目明确规定的端点':'连续时间未规定的孤立端点值不影响本题判分'};
  }
  global.WaveformMath=Object.freeze({normalize,validate,evaluate,toSignal,grade,limits:Object.freeze(LIMIT)});
})(typeof window!=='undefined'?window:globalThis);
