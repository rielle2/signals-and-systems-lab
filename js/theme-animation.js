/* One circular theme transition. Compatibility is internal, never a user setting. */
(function(){
  'use strict';
  const root=document.documentElement,VERSION='3.0.0-beta.1';
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let capabilityCache;
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
    if(motion?.matches)return {method:'none',profile:'none',duration:0,reason:'reduced-motion',immediate:true};
    const missing=capability();
    if(missing)return {method:'fallback',profile:'fallback',duration:220,easing:'ease-out',reason:missing};
    return {method:'native',profile:'circle',duration:680,easing:'cubic-bezier(.22,.68,.22,1)',reason:'supported'};
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
  window.ThemeAnimation=Object.freeze({version:VERSION,policy,geometry,snapshotGeometry,toolbarDelay,viewport});
})();
