/* Head-first theme selection; preserves study state and existing desktop motion. */
(function(){
  'use strict';
  const root=document.documentElement,KEY='signallab.theme.v2',engine=window.ThemeAnimation;
  const system=window.matchMedia?.('(prefers-color-scheme: dark)'),motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let preference='system',sequence=0,current=null,timer=0,toolbarTimer=0,toolbarFrame=0,overlays=[];
  let state={active:false,method:'none',sequence:0,origin:null,radius:0};
  const valid=value=>['light','dark','system'].includes(value),reduced=()=>!!motion?.matches;
  const resolved=()=>preference==='system'?(system?.matches?'dark':'light'):preference;
  try{
    const saved=localStorage.getItem(KEY);
    if(valid(saved))preference=saved;
    else{const legacy=JSON.parse(localStorage.getItem('signallab.learning.v1')||'null');if(valid(legacy?.theme))preference=legacy.theme;}
  }catch{/* Session-only selection remains usable. */}
  function toolbar(){const meta=document.querySelector('meta[name="theme-color"]');if(meta)meta.content=resolved()==='dark'?'#182237':'#ffffff';}
  function refresh(){
    const selector=document.getElementById('themePreference');if(selector)selector.value=preference;
    const button=document.getElementById('themeToggle');
    if(button){const dark=resolved()==='dark';button.setAttribute('aria-label','深色模式');button.setAttribute('aria-pressed',String(dark));button.title=dark?'切换浅色模式':'切换深色模式';}
    window.ThemeSwitch?.getInstance()?.sync();
  }
  function apply({deferToolbar=false}={}){
    root.dataset.theme=resolved();root.dataset.themePreference=preference;
    if(!deferToolbar)toolbar();refresh();
    // Redraw existing Canvas synchronously before the new snapshot. No rAF await.
    document.dispatchEvent(new CustomEvent('signallab:themechange',{detail:{theme:resolved(),preference,reducedMotion:reduced()}}));
  }
  root.dataset.theme=resolved();root.dataset.themePreference=preference;toolbar();
  function clearVisuals(){
    clearTimeout(timer);clearTimeout(toolbarTimer);cancelAnimationFrame(toolbarFrame);timer=0;toolbarTimer=0;toolbarFrame=0;
    overlays.forEach(node=>node.remove());overlays=[];root.classList.remove('theme-colors-changing');delete root.dataset.themeTransition;
  }
  function cancel(){
    const previous=current;current=null;
    previous?.animation?.cancel();previous?.view?.skipTransition?.();
    clearVisuals();state={...state,active:false,sequence};
  }
  function finish(token){
    if(token!==sequence||!state.active)return;
    current?.animation?.cancel();current=null;
    toolbar();clearVisuals();state={...state,active:false};
    document.dispatchEvent(new CustomEvent('signallab:themesettled',{detail:{theme:resolved(),preference,method:state.method}}));
  }
  function snapshotCanvases(){
    const v=engine.viewport();
    for(const canvas of document.querySelectorAll('canvas')){
      const box=canvas.getBoundingClientRect();
      if(!canvas.width||!canvas.height||box.bottom<=v.top||box.top>=v.top+v.height||box.right<=v.left||box.left>=v.left+v.width||box.width<1)continue;
      try{
        const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;
        copy.getContext('2d').drawImage(canvas,0,0);copy.className='theme-canvas-snapshot';copy.setAttribute('aria-hidden','true');
        Object.assign(copy.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});document.body.append(copy);overlays.push(copy);
      }catch{/* A failed optional copy never prevents the actual redraw. */}
    }
  }
  function fallback(token,shape,next){
    snapshotCanvases();root.classList.add('theme-colors-changing');root.dataset.themeTransition='fallback';
    state={active:true,sequence:token,...shape,...next,method:'fallback'};apply();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token===sequence)overlays.forEach(node=>{node.style.opacity='0';});}));
    timer=setTimeout(()=>finish(token),next.duration+70);
  }
  function setPreference(value,options={}){
    if(!valid(value))return;
    preference=value;const token=++sequence,next=engine.policy(),changed=root.dataset.theme!==resolved();
    const animate=options.animate!==false&&!reduced()&&!!document.body;
    if(options.persist!==false)try{localStorage.setItem(KEY,preference);}catch{/* Current session remains effective. */}
    document.dispatchEvent(new CustomEvent('signallab:themepreference',{detail:{preference,theme:resolved(),animate:animate&&changed,reducedMotion:reduced()}}));
    cancel();
    if(!changed||!animate||next.immediate){
      state={...next,active:false,method:'none',duration:0,sequence:token,origin:null,radius:0};apply();return;
    }
    const shape=engine.geometry(options.origin);
    if(next.method==='fallback'){fallback(token,shape,next);return;}
    state={active:true,sequence:token,...shape,...next,method:'native'};root.dataset.themeTransition='native';
    try{
      const view=document.startViewTransition(()=>{
        if(token!==sequence)return;apply({deferToolbar:true});
      });
      const run={view,animation:null,shape};current=run;
      const recover=()=>{if(token!==sequence||!state.active)return;view.skipTransition?.();state={...state,method:'none',reason:'capture-failed'};apply();finish(token);};
      view.updateCallbackDone?.catch(recover);
      view.ready.then(()=>{
        if(token!==sequence)return;
        try{
          const mapped=engine.snapshotGeometry(shape);run.shape=mapped;state={...state,...mapped};
          const {x,y}=mapped.origin;
          run.animation=root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${mapped.radius}px at ${x}px ${y}px)`]},
            {duration:next.duration,easing:next.easing,pseudoElement:'::view-transition-new(root)',fill:'both'});
          if(run.animation.effect?.pseudoElement!=='::view-transition-new(root)'){recover();return;}
          run.animation.finished.then(()=>{},()=>{});
          const delay=engine.toolbarDelay(mapped,next);state.toolbarDelay=delay;
          // WAAPI's start time may resolve a frame after ready. Wall-clock time
          // alone can tint browser chrome before the circle reaches the top.
          const syncToolbar=()=>{
            if(token!==sequence||!state.active)return;
            const elapsed=Number(run.animation.currentTime)||0;
            if(elapsed<delay){toolbarTimer=setTimeout(syncToolbar,Math.max(8,Math.min(32,delay-elapsed)));return;}
            toolbarFrame=requestAnimationFrame(()=>{if(token===sequence&&state.active)toolbar();});
          };
          toolbarTimer=setTimeout(syncToolbar,delay);
        }catch{recover();}
      },recover);
      view.finished.then(()=>finish(token),recover);timer=setTimeout(recover,next.duration+1200);
    }catch{fallback(token,shape,{...next,method:'fallback',profile:'fallback',duration:220,reason:'capture-failed'});}
  }
  function toggle(options={}){setPreference(resolved()==='dark'?'light':'dark',options);}
  function interrupt(){if(!state.active)return;++sequence;cancel();apply();}
  function viewportChanged(){
    if(!state.active)return;
    const before=current?.shape?.viewport||state.viewport,after=engine.viewport();if(!before){interrupt();return;}
    const keyboard=/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName||'')&&before.height-after.height>96;
    // Height-only toolbar expansion is covered by the full snapshot bounds; do not restart.
    if(Math.abs(after.layoutWidth-before.layoutWidth)>1||Math.abs(after.width-before.width)>1||Math.abs(after.scale-before.scale)>.01||Math.abs(after.left-before.left)>1||Math.abs(after.top-before.top)>1||keyboard)interrupt();
  }
  const follow=()=>{if(preference==='system')setPreference('system',{animate:false,persist:false});};
  const listen=(query,fn)=>{if(query?.addEventListener)query.addEventListener('change',fn);else query?.addListener?.(fn);};
  listen(system,follow);listen(motion,()=>{if(reduced())interrupt();});
  window.addEventListener('storage',event=>{
    if(event.key===KEY&&(valid(event.newValue)||event.newValue===null))setPreference(event.newValue||'system',{animate:false,persist:false});
  });
  window.addEventListener('resize',viewportChanged);window.visualViewport?.addEventListener('resize',viewportChanged);
  window.visualViewport?.addEventListener('scroll',viewportChanged,{passive:true});
  window.addEventListener('orientationchange',interrupt);
  window.addEventListener('hashchange',interrupt);
  window.addEventListener('scroll',()=>{if(!state.active)return;const v=current?.shape?.viewport||state.viewport;if(state.method==='fallback'||!v||Math.abs(scrollY-v.scrollY)>2||Math.abs(scrollX-v.scrollX)>2)interrupt();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
  window.SignalTheme=Object.freeze({version:'3.0.0-beta.1',setPreference,toggle,getPreference:()=>preference,getTheme:resolved,isReducedMotion:reduced,refresh,storageKey:KEY,
    getTransitionState:()=>({...state,origin:state.origin?{...state.origin}:null,viewport:state.viewport?{...state.viewport}:null,duration:state.duration??engine.policy().duration})});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',refresh,{once:true});else refresh();
})();
