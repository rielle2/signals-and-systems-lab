/* Head-first theme selection; independent of routing, signals and study records. */
(function(){
  'use strict';
  const root=document.documentElement,KEY='signallab.theme.v2';
  const system=window.matchMedia?.('(prefers-color-scheme: dark)');
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const DURATION=680,EASING='cubic-bezier(.22,.68,.22,1)';
  let preference='system',sequence=0,current=null,timer=0,overlays=[];
  let state={active:false,method:'none',sequence:0,origin:null,radius:0};
  const valid=value=>['light','dark','system'].includes(value);
  const reduced=()=>!!motion?.matches;
  const resolved=()=>preference==='system'?(system?.matches?'dark':'light'):preference;
  try{
    const saved=localStorage.getItem(KEY);
    if(valid(saved))preference=saved;
    else{
      const legacy=JSON.parse(localStorage.getItem('signallab.learning.v1')||'null');
      if(valid(legacy?.theme))preference=legacy.theme;
    }
  }catch{/* A blocked store never prevents this session's theme selection. */}

  function refresh(){
    const selector=document.getElementById('themePreference');
    if(selector)selector.value=preference;
    const button=document.getElementById('themeToggle');
    if(button){
      const dark=resolved()==='dark';
      button.setAttribute('aria-label','深色模式');
      button.setAttribute('aria-pressed',String(dark));
      button.title=dark?'切换浅色模式':'切换深色模式';
    }
    window.ThemeSwitch?.getInstance()?.sync();
  }
  function apply(){
    root.dataset.theme=resolved();
    root.dataset.themePreference=preference;
    const meta=document.querySelector('meta[name="theme-color"]');
    if(meta)meta.content=resolved()==='dark'?'#10192a':'#f7f9fc';
    refresh();
    // Redraw Canvas synchronously in the capture callback. Never await rAF here.
    document.dispatchEvent(new CustomEvent('signallab:themechange',{
      detail:{theme:resolved(),preference,reducedMotion:reduced()}
    }));
  }
  root.dataset.theme=resolved();
  root.dataset.themePreference=preference;
  const initialMeta=document.querySelector('meta[name="theme-color"]');
  if(initialMeta)initialMeta.content=resolved()==='dark'?'#10192a':'#f7f9fc';

  function clearVisuals(){
    clearTimeout(timer);timer=0;
    overlays.forEach(node=>node.remove());overlays=[];
    root.classList.remove('theme-colors-changing');
    delete root.dataset.themeTransition;
  }
  function cancel(){
    const previous=current;current=null;
    previous?.animation?.cancel();
    previous?.view?.skipTransition?.();
    clearVisuals();
    state={...state,active:false,sequence};
  }
  function finish(token){
    if(token!==sequence||!state.active)return;
    current?.animation?.cancel();
    current=null;clearVisuals();state={...state,active:false};
    document.dispatchEvent(new CustomEvent('signallab:themesettled',{
      detail:{theme:resolved(),preference,method:state.method}
    }));
  }
  function geometry(origin){
    let x,y;
    const element=origin&&typeof origin.getBoundingClientRect==='function'?origin:document.getElementById('themeToggle');
    if(origin&&Number.isFinite(origin.x)&&Number.isFinite(origin.y)){x=origin.x;y=origin.y;}
    else if(element){const box=element.getBoundingClientRect();x=box.left+box.width/2;y=box.top+box.height/2;}
    const width=innerWidth,height=innerHeight;
    x=Math.max(0,Math.min(width,Number.isFinite(x)?x:width/2));
    y=Math.max(0,Math.min(height,Number.isFinite(y)?y:height/2));
    const radius=Math.max(Math.hypot(x,y),Math.hypot(width-x,y),Math.hypot(x,height-y),Math.hypot(width-x,height-y))+2;
    return {origin:{x,y},radius};
  }
  function snapshotCanvases(){
    for(const canvas of document.querySelectorAll('canvas')){
      const box=canvas.getBoundingClientRect();
      if(!canvas.width||!canvas.height||box.bottom<=0||box.top>=innerHeight||box.right<=0||box.left>=innerWidth||box.width<1)continue;
      try{
        const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
        copy.getContext('2d').drawImage(canvas,0,0);copy.className='theme-canvas-snapshot';
        copy.setAttribute('aria-hidden','true');
        Object.assign(copy.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});
        document.body.append(copy);overlays.push(copy);
      }catch{/* An unavailable snapshot still permits the actual Canvas redraw. */}
    }
  }
  function fallback(token,shape){
    snapshotCanvases();root.classList.add('theme-colors-changing');root.dataset.themeTransition='fallback';
    state={active:true,method:'fallback',sequence:token,...shape};apply();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      if(token===sequence)overlays.forEach(node=>{node.style.opacity='0';});
    }));
    timer=setTimeout(()=>finish(token),320);
  }
  function setPreference(value,options={}){
    if(!valid(value))return;
    preference=value;
    const token=++sequence,animate=options.animate!==false&&!reduced()&&!!document.body;
    const changed=root.dataset.theme!==resolved();
    if(options.persist!==false)try{localStorage.setItem(KEY,preference);}catch{/* Session-only changes remain usable. */}
    document.dispatchEvent(new CustomEvent('signallab:themepreference',{
      detail:{preference,theme:resolved(),animate:animate&&changed,reducedMotion:reduced()}
    }));
    cancel();
    if(!changed||!animate){state={active:false,method:'none',sequence:token,origin:null,radius:0};apply();return;}
    const shape=geometry(options.origin);
    const native=typeof document.startViewTransition==='function'&&typeof root.animate==='function'&&window.CSS?.supports?.('clip-path','circle(1px at 1px 1px)');
    if(!native){fallback(token,shape);return;}
    state={active:true,method:'native',sequence:token,...shape};root.dataset.themeTransition='native';
    try{
      const view=document.startViewTransition(()=>{if(token===sequence)apply();});
      const run={view,animation:null};current=run;
      // A renderer/viewport abort must still leave the latest requested theme usable.
      const recover=()=>{if(token!==sequence||!state.active)return;view.skipTransition?.();apply();finish(token);};
      view.updateCallbackDone?.catch(recover);
      view.ready.then(()=>{
        if(token!==sequence)return;
        try{
          const {x,y}=shape.origin;
          run.animation=root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${shape.radius}px at ${x}px ${y}px)`]},
            {duration:DURATION,easing:EASING,pseudoElement:'::view-transition-new(root)',fill:'both'});
          run.animation.finished.then(()=>{},()=>{});
        }catch{recover();}
      },recover);
      view.finished.then(()=>finish(token),recover);
      timer=setTimeout(recover,DURATION+1200);
    }catch{fallback(token,shape);}
  }
  function toggle(options={}){setPreference(resolved()==='dark'?'light':'dark',options);}
  const follow=()=>{if(preference==='system')setPreference('system',{animate:false,persist:false});};
  // Older WebKit's MediaQueryList exposes addListener instead of addEventListener.
  const listen=(query,fn)=>{if(query?.addEventListener)query.addEventListener('change',fn);else query?.addListener?.(fn);};
  listen(system,follow);
  listen(motion,()=>{if(reduced()){++sequence;cancel();apply();}});
  window.addEventListener('storage',event=>{
    if(event.key===KEY&&(valid(event.newValue)||event.newValue===null))setPreference(event.newValue||'system',{animate:false,persist:false});
  });
  window.addEventListener('resize',()=>{if(state.active){++sequence;cancel();apply();}});
  window.addEventListener('scroll',()=>{if(state.active&&state.method==='fallback'){++sequence;cancel();apply();}},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.active){++sequence;cancel();apply();}});
  window.SignalTheme=Object.freeze({setPreference,toggle,getPreference:()=>preference,getTheme:resolved,isReducedMotion:reduced,
    refresh,storageKey:KEY,getTransitionState:()=>({...state,origin:state.origin?{...state.origin}:null,duration:DURATION})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})();
