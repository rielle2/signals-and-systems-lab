/* Theme strategy, snapshot coordinates and bounded, session-only measurements.
 * A phone name, viewport width, DPR or hardware hint is never a performance score.
 */
(function(){
  'use strict';
  const root=document.documentElement,KEY='signallab.theme.animation.v1';
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const valid=value=>['auto','full','optimized','simple'].includes(value);
  let preference='auto',automaticLevel=1,samples=[],refreshInterval=1000/60,capabilityCache;
  try{const saved=localStorage.getItem(KEY);if(valid(saved))preference=saved;}catch{/* Session preference remains available. */}
  const profiles={
    1:{level:1,profile:'full',duration:680,easing:'cubic-bezier(.22,.68,.22,1)'},
    2:{level:2,profile:'optimized',duration:520,easing:'cubic-bezier(.2,.65,.3,1)'},
    3:{level:3,profile:'simple',duration:220,easing:'ease-out'}
  };
  function capability(){
    if(typeof document.startViewTransition!=='function'||typeof root.animate!=='function'||!window.CSS?.supports?.('clip-path','circle(1px at 1px 1px)'))return 'missing-view-transition';
    const start=document.startViewTransition,animate=root.animate,effectType=window.KeyframeEffect;
    if(capabilityCache&&capabilityCache.start===start&&capabilityCache.animate===animate&&capabilityCache.effectType===effectType)return capabilityCache.result;
    let result=null;
    try{
      // Older engines may silently ignore animate({pseudoElement:...}).
      const effect=new KeyframeEffect(root,[],{duration:1,pseudoElement:'::view-transition-new(root)'});
      if(effect.pseudoElement!=='::view-transition-new(root)')result='missing-pseudo-animation';
    }catch{result='missing-pseudo-animation';}
    capabilityCache={start,animate,effectType,result};return result;
  }
  function policy(){
    let level=preference==='auto'?automaticLevel:preference==='full'?1:preference==='optimized'?2:3;
    let reason=preference==='auto'?(automaticLevel===1?'unmeasured-or-within-budget':'repeated-observed-delay'):'user-choice';
    const unavailable=capability();
    if(motion?.matches){level=3;reason='reduced-motion';}
    else if(unavailable){level=3;reason=unavailable;}
    return {...profiles[level],preference,reason};
  }
  function publish(){
    const next=policy();root.dataset.themeAnimationLevel=String(next.level);
    document.dispatchEvent(new CustomEvent('signallab:animationpolicy',{detail:next}));return next;
  }
  function setPreference(value){
    if(!valid(value))return false;
    preference=value;automaticLevel=1;samples=[];
    try{localStorage.setItem(KEY,value);}catch{/* Session-only preference is still effective. */}
    const next=publish();document.dispatchEvent(new CustomEvent('signallab:animationpreference',{detail:{preference,policy:next}}));return true;
  }
  function viewport(){
    const visual=window.visualViewport;
    const width=visual&&visual.width>0?visual.width:innerWidth,height=visual&&visual.height>0?visual.height:innerHeight;
    return {left:visual?.offsetLeft||0,top:visual?.offsetTop||0,width,height,scale:visual?.scale||1,
      layoutWidth:innerWidth,layoutHeight:innerHeight,scrollX,scrollY};
  }
  function geometry(origin){
    const element=origin&&typeof origin.getBoundingClientRect==='function'?origin:document.getElementById('themeToggle');
    const control=document.querySelector('.theme-control'),box=element?.getBoundingClientRect(),controlBox=control?.getBoundingClientRect();
    const rect=viewport();
    // An Element is always an Element; do not mistake a nonstandard .x/.y for a point.
    let x=box?box.left+box.width/2:rect.left+rect.width/2,y=box?box.top+box.height/2:rect.top+rect.height/2;
    if(origin&&!origin.nodeType&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)){x=origin.x;y=origin.y;}
    x=Math.max(rect.left,Math.min(rect.left+rect.width,x));y=Math.max(rect.top,Math.min(rect.top+rect.height,y));
    const corners=[[rect.left,rect.top],[rect.left+rect.width,rect.top],[rect.left,rect.top+rect.height],[rect.left+rect.width,rect.top+rect.height]];
    return {origin:{x,y},radius:Math.max(...corners.map(([cx,cy])=>Math.hypot(cx-x,cy-y)))+2,viewport:rect,
      control:controlBox?{left:controlBox.left,top:controlBox.top}:null,coordinateSpace:'layout'};
  }
  function snapshotGeometry(shape){
    if(!shape.control||typeof DOMMatrixReadOnly!=='function')return shape;
    try{
      const group=getComputedStyle(root,'::view-transition-group(root)');
      const control=getComputedStyle(root,'::view-transition-group(theme-control)');
      if(!(parseFloat(control.width)>0))return shape;
      const rootMatrix=new DOMMatrixReadOnly(group.transform==='none'?undefined:group.transform);
      const controlMatrix=new DOMMatrixReadOnly(control.transform==='none'?undefined:control.transform);
      const inverse=rootMatrix.inverse(),v=shape.viewport;
      const map=(x,y)=>inverse.transformPoint(controlMatrix.transformPoint({x:x-shape.control.left,y:y-shape.control.top}));
      const center=map(shape.origin.x,shape.origin.y);
      const top=[map(v.left,v.top),map(v.left+v.width,v.top)];
      const corners=[...top,map(v.left,v.top+v.height),map(v.left+v.width,v.top+v.height)];
      const width=parseFloat(group.width),height=parseFloat(group.height);
      // Include the browser's actual snapshot bounds, not the document's scrollHeight.
      if(width>0&&height>0)corners.push({x:0,y:0},{x:width,y:0},{x:0,y:height},{x:width,y:height});
      if(![center.x,center.y,...corners.flatMap(p=>[p.x,p.y])].every(Number.isFinite))return shape;
      return {...shape,origin:{x:center.x,y:center.y},radius:Math.max(...corners.map(p=>Math.hypot(p.x-center.x,p.y-center.y)))+2,
        topRadius:Math.max(...top.map(p=>Math.hypot(p.x-center.x,p.y-center.y)))+2,
        snapshot:{width,height},coordinateSpace:'snapshot'};
    }catch{return shape;}
  }
  function toolbarDelay(shape,next){
    // Invert monotonic cubic-bezier y, then use its x as the elapsed-time fraction.
    const match=next.easing.match(/cubic-bezier\(([^)]+)\)/);
    if(!match)return next.duration;
    const [x1,y1,x2,y2]=match[1].split(',').map(Number),ratio=Math.min(1,(shape.topRadius||shape.radius)/shape.radius);
    const curve=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
    let low=0,high=1;for(let i=0;i<20;i++){const middle=(low+high)/2;if(curve(middle,y1,y2)<ratio)low=middle;else high=middle;}
    return Math.ceil(curve((low+high)/2,x1,x2)*next.duration);
  }
  const percentile=(values,p)=>{const sorted=values.slice().sort((a,b)=>a-b);return sorted.length?sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*p))]:0;};
  function nextLevel(history,level){
    const recent=history.slice(-2);
    if(recent.length!==2||recent.some(s=>!s.eligible||s.level!==level))return level;
    const poor=s=>(s.readyMs>220&&s.updateMs>50)||(s.frameCount>=12&&s.slowRatio>.25&&s.p95Ms>50);
    const severe=s=>(s.readyMs>450&&s.longTaskMs>120)||(s.frameCount>=12&&s.slowRatio>.4&&s.p95Ms>80);
    if(level===1&&recent.every(poor))return 2;
    if(level===2&&recent.every(severe))return 3;
    return level;
  }
  function measure(next){
    const start=performance.now(),intervals=[];let readyAt=0,updateStart=0,updateMs=0,previous=0,frame=0,longTaskMs=0,observer,stopped=false,animation,wasPaused=false,fontLoading=document.fonts?.status==='loading';
    const fontsChanged=()=>{fontLoading=true;};document.fonts?.addEventListener?.('loading',fontsChanged);
    try{observer=new PerformanceObserver(list=>{for(const entry of list.getEntries())if(entry.startTime>=start)longTaskMs+=entry.duration;});observer.observe({type:'longtask',buffered:false});}catch{/* Unsupported: this metric stays unavailable, never guessed. */}
    function tick(time){if(stopped)return;if(animation?.playState==='paused')wasPaused=true;if(previous)intervals.push(time-previous);previous=time;frame=requestAnimationFrame(tick);}
    return {
      updateStart(){updateStart=performance.now();},updateEnd(){updateMs=performance.now()-updateStart;},
      ready(active){animation=active;readyAt=performance.now();frame=requestAnimationFrame(tick);},
      stop({complete=false,paused=false}={}){
        if(stopped)return;stopped=true;cancelAnimationFrame(frame);
        for(const entry of observer?.takeRecords()||[])if(entry.startTime>=start)longTaskMs+=entry.duration;
        observer?.disconnect();document.fonts?.removeEventListener?.('loading',fontsChanged);
        const eligible=complete&&!paused&&!wasPaused&&!fontLoading&&!document.hidden&&document.fonts?.status!=='loading'&&readyAt>0&&intervals.length>=12;
        const budget=Math.max(1000/60,refreshInterval),sample={level:next.level,eligible,readyMs:readyAt?readyAt-start:0,updateMs,
          frameCount:intervals.length,p95Ms:percentile(intervals,.95),maxGapMs:Math.max(0,...intervals),
          slowRatio:intervals.filter(value=>value>Math.max(42,budget*2.5)).length/Math.max(1,intervals.length),longTaskMs,
          durationMs:performance.now()-start,measurement:'foreground main-thread rAF/Long Tasks proxies; not GPU or physical-device FPS'};
        samples.push(sample);samples=samples.slice(-6);
        if(preference==='auto'&&eligible){const target=nextLevel(samples,automaticLevel);if(target!==automaticLevel){automaticLevel=target;publish();}}
      }
    };
  }
  function calibrate(){
    let last=0;const gaps=[];function step(time){if(document.hidden)return;if(last)gaps.push(time-last);last=time;
      if(gaps.length<24)requestAnimationFrame(step);else{const clean=gaps.filter(x=>x>=4&&x<=50);if(clean.length>=12)refreshInterval=Math.max(1000/60,percentile(clean,.5));}}
    requestAnimationFrame(step);
  }
  root.dataset.themeAnimationLevel=String(policy().level);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',calibrate,{once:true});else calibrate();
  window.ThemeAnimation=Object.freeze({getPreference:()=>preference,setPreference,policy,publish,geometry,snapshotGeometry,toolbarDelay,viewport,measure,
    getSamples:()=>samples.map(s=>({...s})),evaluateHistory:nextLevel,storageKey:KEY});
})();
