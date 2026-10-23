/* Runs in <head> before styles: choose the first painted theme without a flash. */
(function(){
  'use strict';
  const root=document.documentElement,KEY='signallab.theme.v2';
  const system=window.matchMedia?.('(prefers-color-scheme: dark)'),motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let preference='system',transition=null,sequence=0,timer,overlays=[];
  const valid=value=>['light','dark','system'].includes(value);
  try{const saved=localStorage.getItem(KEY);if(valid(saved))preference=saved;else{const legacy=JSON.parse(localStorage.getItem('signallab.learning.v1')||'null');if(valid(legacy?.theme))preference=legacy.theme;}}catch{/* The app separately offers a storage warning and backup. */}
  const resolved=()=>preference==='system'?(system?.matches?'dark':'light'):preference;
  root.dataset.theme=resolved();root.dataset.themePreference=preference;
  const reduced=()=>!!motion?.matches;
  function icon(){const button=document.getElementById('themeToggle');if(!button)return;
    if(!button.querySelector('svg'))button.innerHTML='<svg class="theme-symbol" viewBox="0 0 24 24" aria-hidden="true"><g class="theme-sun" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></g><path class="theme-moon" d="M20.7 14A9 9 0 0 1 10 3.3 9 9 0 1 0 20.7 14Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>';
    const label=resolved()==='dark'?'切换浅色模式':'切换深色模式';button.setAttribute('aria-label',label);button.title=label+'；跟随系统可在项目说明中设置';button.setAttribute('aria-pressed',String(resolved()==='dark'));
    const selector=document.getElementById('themePreference');if(selector)selector.value=preference;
  }
  function clearOverlays(){for(const el of overlays)el.remove();overlays=[];clearTimeout(timer);root.classList.remove('theme-colors-changing');}
  function snapshotCanvases(){
    for(const canvas of document.querySelectorAll('canvas')){const box=canvas.getBoundingClientRect();if(!canvas.width||!canvas.height||box.bottom<0||box.top>innerHeight||box.width<1)continue;
      try{const copy=document.createElement('canvas');copy.width=canvas.width;copy.height=canvas.height;copy.getContext('2d').drawImage(canvas,0,0);copy.className='theme-canvas-snapshot';copy.setAttribute('aria-hidden','true');Object.assign(copy.style,{left:box.left+'px',top:box.top+'px',width:box.width+'px',height:box.height+'px'});document.body.append(copy);overlays.push(copy);}catch{/* A redraw still occurs when snapshots are unavailable. */}
    }
  }
  function update(){root.dataset.theme=resolved();root.dataset.themePreference=preference;icon();document.dispatchEvent(new CustomEvent('signallab:themechange',{detail:{theme:resolved(),preference,reducedMotion:reduced()}}));}
  function setPreference(value,options={}){
    if(!valid(value))return;preference=value;const token=++sequence;
    try{localStorage.setItem(KEY,preference);}catch{/* No storage is required to change the current session. */}
    document.dispatchEvent(new CustomEvent('signallab:themepreference',{detail:{preference}}));
    transition?.skipTransition?.();clearOverlays();
    if(root.dataset.theme===resolved()||reduced()||options.animate===false||!document.body){update();return;}
    if(typeof document.startViewTransition==='function'){
      try{transition=document.startViewTransition(()=>{if(token!==sequence)return;update();});transition.ready.catch(()=>{});transition.finished.catch(()=>{});return;}catch{/* Color/canvas fallback below works without View Transitions. */}
    }
    snapshotCanvases();root.classList.add('theme-colors-changing');update();
    requestAnimationFrame(()=>requestAnimationFrame(()=>{if(token!==sequence)return;for(const el of overlays)el.style.opacity='0';}));
    timer=setTimeout(clearOverlays,360);
  }
  function toggle(){setPreference(resolved()==='dark'?'light':'dark');}
  function bind(){icon();document.getElementById('themeToggle')?.addEventListener('click',toggle);}
  const follow=()=>{if(preference==='system')setPreference('system');};system?.addEventListener?.('change',follow);
  motion?.addEventListener?.('change',()=>{if(reduced()){transition?.skipTransition?.();clearOverlays();}});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
  window.SignalTheme=Object.freeze({setPreference,toggle,getPreference:()=>preference,getTheme:resolved,isReducedMotion:reduced,refresh:icon,storageKey:KEY});
})();
