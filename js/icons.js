/* Original 24x24 stroke icons + the locally bundled Morphicons DOM adapter.
 * State belongs to controls, never to an animation. No observers or idle loops. */
(function(){
  'use strict';
  const NS='http://www.w3.org/2000/svg';
  const paths=Object.freeze({
    home:'M4.5 3h4A1.5 1.5 0 0 1 10 4.5v4A1.5 1.5 0 0 1 8.5 10h-4A1.5 1.5 0 0 1 3 8.5v-4A1.5 1.5 0 0 1 4.5 3ZM15.5 3h4A1.5 1.5 0 0 1 21 4.5v4a1.5 1.5 0 0 1-1.5 1.5h-4A1.5 1.5 0 0 1 14 8.5v-4A1.5 1.5 0 0 1 15.5 3ZM4.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 8.5 21h-4A1.5 1.5 0 0 1 3 19.5v-4A1.5 1.5 0 0 1 4.5 14ZM15.5 14h4a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-4a1.5 1.5 0 0 1 1.5-1.5Z',
    lab:'M9 3h6M10 3v7L4 19q-1 2 2 2h12q3 0 2-2l-6-9V3M8 15h8',
    exercise:'M7 4h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2ZM9 2v4h7V2M9 11h7M9 15h7',
    review:'M4 8a9 9 0 1 1-1 7M4 3v5h5M12 7v5l3 2',
    formula:'M18 3H9l-4 9 4 9h9M7 12h10',
    map:'M10 2h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1ZM3 17h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM17 17h4a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1ZM12 7v5H5v5M12 12h7v5',
    bookmark:'M6 3h12v18l-6-4-6 4Z',
    bookmarkCheck:'M6 3h12v18l-6-4-6 4ZM9 9l2 2 4-4',
    check:'m5 12 4 4L19 6',
    clock:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 6v6l4 2',
    wrong:'M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm3 6 6 6m0-6-6 6',
    menu:'M4 6h16M4 12h16M4 18h16',
    close:'m6 6 12 12M6 18 18 6',
    x:'m6 6 12 12M6 18 18 6',
    play:'m8 4 12 8-12 8Z',
    pause:'M7 5v14M17 5v14',
    chevronDown:'m6 9 6 6 6-6',
    chevronUp:'m6 15 6-6 6 6',
    search:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    eye:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    eyeOff:'m3 3 18 18M10 5.2a11 11 0 0 1 2-.2c6 0 10 7 10 7a20 20 0 0 1-3 3.7M6.2 6.2A23 23 0 0 0 2 12s4 7 10 7a12 12 0 0 0 5.8-1.8M9.8 9.8a3.1 3.1 0 0 0 4.4 4.4',
    upload:'M12 16V3m-5 5 5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
    download:'M12 3v13m-5-5 5 5 5-5M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3',
    camera:'M3 6h4l2-3h6l2 3h4v14H3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    photo:'M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1ZM3 17l6-6 4 4 3-3 5 5M9 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
    edit:'m15 4 5 5M4 20l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19l-6 1Z',
    skipBack:'M5 5v14M19 5l-10 7 10 7Z',
    skipForward:'M19 5v14M5 5l10 7-10 7Z',
    reset:'M3 10a9 9 0 1 1 2 8M3 4v6h6',
    zoomIn:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM6 10h8M10 6v8',
    zoomOut:'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM6 10h8',
    rotateLeft:'M3 10a9 9 0 1 1 3 9M3 4v6h6',
    rotateRight:'M21 10a9 9 0 1 0-3 9M21 4v6h-6',
    crop:'M7 2v15h15M2 7h15v15',
    move:'M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4',
    trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',
    settings:'M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1 1-3ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    alert:'M12 3 2 21h20L12 3ZM12 9v5M12 17v1',
    arrowLeft:'M20 12H4m6-6-6 6 6 6',
    arrowRight:'M4 12h16m-6-6 6 6-6 6',
    arrowDown:'M12 4v16m-6-6 6 6 6-6',
    plus:'M12 5v14M5 12h14',
    save:'M4 3h13l4 4v14H3V3h1ZM7 3v6h10V3M7 21v-8h10v8',
    copy:'M8 3h13v14H8ZM4 7H3v14h13v-1',
    split:'M5 3v5a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v5M5 21v-5a4 4 0 0 1 4-4M15 5l4-3 3 3M19 2v6',
    crosshair:'M12 2v5M12 17v5M2 12h5M17 12h5M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
    perspective:'m5 6 14-3 2 15-17 3L5 6ZM4 21l15-18',
    print:'M7 8V3h10v5M7 18H3V8h18v10h-4M7 14h10v7H7ZM17 11h1'
  });
  // Reusing frozen data gives the library stable identities for its plan cache.
  const nodes=Object.freeze(Object.fromEntries(Object.entries(paths).map(([key,d])=>[key,Object.freeze([Object.freeze(['path',Object.freeze({d})])])])));
  const known=name=>Object.prototype.hasOwnProperty.call(paths,name)?name:'alert';
  const motion=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const records=new Map(),counts={mounted:0,destroyed:0,morphCalls:0,setCalls:0,fallbacks:0};
  const query=(root,selector)=>{const list=[];if(root?.nodeType===1&&root.matches(selector))list.push(root);if(root?.querySelectorAll)list.push(...root.querySelectorAll(selector));return list;};
  const excluded=el=>!el||el.id==='themeToggle'||!!el.closest?.('.theme-control');
  function svg(name){const key=known(name);return `<svg class="ui-icon" data-icon-name="${key}" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${paths[key]}"/></svg>`;}
  function release(record){try{record.driver?.destroy();}catch{/* A missing optional animation never changes a control. */}record.driver=null;records.delete(record.el);counts.destroyed++;}
  function prune(){for(const record of records.values())if(!record.el.isConnected||record.svg.parentNode!==record.el)release(record);}
  function ensure(el,name){
    let record=records.get(el);
    if(record&&record.svg.parentNode===el&&record.path.parentNode===record.svg)return record;
    if(record)release(record);
    let image=Array.from(el.children).find(node=>node.matches?.('svg.ui-icon'));
    if(!image){image=document.createElementNS(NS,'svg');el.insertBefore(image,el.firstChild);}
    image.setAttribute('class','ui-icon');image.setAttribute('viewBox','0 0 24 24');image.setAttribute('width','18');image.setAttribute('height','18');image.setAttribute('fill','none');image.setAttribute('stroke','currentColor');image.setAttribute('stroke-width','1.65');image.setAttribute('stroke-linecap','round');image.setAttribute('stroke-linejoin','round');image.setAttribute('aria-hidden','true');image.setAttribute('focusable','false');
    let path=image.querySelector('path');if(!path){path=document.createElementNS(NS,'path');image.append(path);}
    record={el,svg:image,path,name:known(name),driver:null,label:null};path.setAttribute('d',paths[record.name]);image.dataset.iconName=record.name;records.set(el,record);counts.mounted++;return record;
  }
  function settle(record){if(record.driver){try{record.driver.set(nodes[record.name]);counts.setCalls++;return;}catch{try{record.driver.destroy();}catch{}record.driver=null;counts.fallbacks++;}}record.path.setAttribute('d',paths[record.name]);}
  function update(record,name,animate){
    const key=known(name),previous=record.name;record.svg.dataset.iconName=key;
    if(previous===key)return;
    record.name=key;
    const permitted=animate!==false&&!motion?.matches&&!document.hidden&&!document.documentElement.dataset.themeTransition&&!window.SignalTheme?.getTransitionState?.().active;
    if(!permitted){settle(record);return;}
    try{
      if(!record.driver){const create=window.MorphiconsDOM?.createMorph;if(typeof create!=='function'){counts.fallbacks++;settle(record);return;}record.driver=create(record.path,nodes[previous],{reducedMotion:'user',strokeWidth:1.65});}
      record.driver.morphTo(nodes[key],{stiffness:1600,damping:80});counts.morphCalls++;
    }catch{try{record.driver?.destroy();}catch{}record.driver=null;counts.fallbacks++;settle(record);}
  }
  function button(el,name,label,options={}){
    if(excluded(el))return el;
    const key=known(name),record=ensure(el,key);
    if(!record.label||record.label.parentNode!==el){
      record.label=Array.from(el.children).find(child=>child.classList?.contains('ui-icon-label'))||document.createElement('span');record.label.classList.add('ui-icon-label');
      // Inputs and any other semantic children are retained. Only old text nodes
      // are replaced, so file/keyboard controls and their listeners stay intact.
      for(const child of Array.from(el.childNodes))if(child.nodeType===3)child.remove();
      if(record.label.parentNode!==el)el.append(record.label);
    }
    if(label!==undefined&&record.label.textContent!==String(label))record.label.textContent=String(label);
    el.classList.add('ui-icon-button');el.classList.toggle('ui-icon-only',label==='');el.dataset.uiIcon=key;
    if(Object.prototype.hasOwnProperty.call(options,'pressed'))el.setAttribute('aria-pressed',String(!!options.pressed));
    update(record,key,options.animate);return el;
  }
  function summary(el,animate=false){
    if(excluded(el)||el.parentElement?.tagName!=='DETAILS')return;
    const name=el.parentElement.open?'chevronUp':'chevronDown',record=ensure(el,name);el.classList.add('ui-icon-summary');
    if(record.svg!==el.lastElementChild)el.append(record.svg);
    update(record,name,animate);
  }
  function staticIcon(el,name){
    if(excluded(el)||Array.from(el.children).some(child=>child.classList?.contains('ui-icon')))return;
    const box=document.createElement('span');box.innerHTML=svg(name);el.insertBefore(box.firstElementChild,el.firstChild);el.classList.add('ui-icon-static');
  }
  const labelOf=el=>el.textContent.trim().replace(/^[★☆✓＋−←→]\s*/,'').replace(/\s*[←→↗]$/,'');
  function enhance(root=document){
    if(!root)return;prune();
    function decorate(selector,name,options={}){for(const el of query(root,selector)){if(excluded(el)||records.has(el))continue;const label=options.iconOnly?'':labelOf(el);button(el,typeof name==='function'?name(el):name,label,{animate:false,...options});}}
    decorate('#menuToggle',el=>el.getAttribute('aria-expanded')==='true'?'close':'menu',{iconOnly:true});
    decorate('[data-close-search],[data-beta-close]','close',{iconOnly:true});
    for(const el of query(root,'#searchOpen'))staticIcon(el,'search');
    decorate('#conv-play,#cc-play',el=>el.textContent.includes('暂停')?'pause':'play');
    decorate('#conv-prev,#cc-prev','skipBack');decorate('#conv-next,#cc-next','skipForward');decorate('#conv-reset,[data-plot-reset],[data-practice-new],[data-retry],[data-practice-retry],[data-pw-retry]','reset');
    for(const el of query(root,'[data-bookmark],[data-favorite],[data-signal-favorite]'))if(!records.has(el)){const active=el.getAttribute('aria-pressed')==='true'||el.textContent.includes('已收藏');button(el,active?'bookmarkCheck':'bookmark',labelOf(el),{animate:false,pressed:active});}
    for(const el of query(root,'[data-review-topic]'))if(!records.has(el)){const active=el.getAttribute('aria-pressed')==='true'||el.textContent.includes('已标记');button(el,active?'check':'clock',labelOf(el),{animate:false,pressed:active});}
    decorate('[data-remove-topic],[data-remove-question],[data-signal-delete]','trash');decorate('[data-piecewise-remove]','trash',{iconOnly:true});
    decorate('[data-submit],[data-practice-submit]','arrowRight');decorate('[data-pw-submit],[data-signal-apply],[data-piecewise-apply],[data-pw-apply-image],[data-self="yes"]','check');
    decorate('[data-self="no"]','alert');decorate('[data-reveal]','eye');decorate('[data-signal-save]','save');decorate('[data-signal-rename],[data-pw-manual]','edit');
    decorate('[data-signal-export],#exportData','download');decorate('[data-signal-load]','arrowDown');decorate('[data-piecewise-add],[data-we-add]','plus');
    decorate('[data-beta-copy]','copy');decorate('[data-print]','print');decorate('[data-prev]','arrowLeft');decorate('[data-next]','arrowRight');
    decorate('[data-plot-zoom="in"]','zoomIn',{iconOnly:true});decorate('[data-plot-zoom="out"]','zoomOut',{iconOnly:true});decorate('[data-plot-touch]',el=>el.getAttribute('aria-pressed')==='true'?'check':'move');
    decorate('[data-pw-action="left"]','rotateLeft');decorate('[data-pw-action="right"]','rotateRight');decorate('[data-pw-action="reset"]','reset');decorate('[data-pw-pick="crop"]','crop');decorate('[data-pw-pick="perspective"]','perspective');
    decorate('[data-pw-pick="origin"],[data-pw-pick="xPoint"],[data-pw-pick="yPoint"],[data-pw-axes]','crosshair');decorate('[data-pw-origin-suggestion]','check');decorate('[data-pw-analyze]','search');
    for(const input of query(root,'[data-pw-camera],[data-pw-file],[data-signal-import],#importData')){const label=input.closest('label');if(label)staticIcon(label,input.hasAttribute('data-pw-camera')?'camera':'upload');}
    for(const el of query(root,'details > summary'))summary(el,false);
    for(const el of query(root,'.feedback.success > strong,.photo-grade.is-correct > strong')){for(const node of el.childNodes)if(node.nodeType===3)node.textContent=node.textContent.replace(/^\s*✓\s*/,'');staticIcon(el,'check');}
    for(const el of query(root,'.feedback.error > strong,.photo-grade.is-wrong > strong'))staticIcon(el,'x');
    for(const el of query(root,'.lp-feedback.is-correct'))staticIcon(el,'check');for(const el of query(root,'.lp-feedback.is-wrong'))staticIcon(el,'x');
  }
  function destroy(root){if(!root)return;for(const record of records.values())if(record.el===root||root.contains?.(record.el))release(record);}
  function settleAll(){prune();for(const record of records.values())settle(record);}
  document.addEventListener('toggle',event=>{if(event.target?.tagName==='DETAILS'&&event.target.isConnected){const el=Array.from(event.target.children).find(node=>node.tagName==='SUMMARY');if(el)summary(el,true);}},true);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)settleAll();});
  document.addEventListener('signallab:themepreference',settleAll);
  if(motion?.addEventListener)motion.addEventListener('change',()=>{if(motion.matches)settleAll();});else motion?.addListener?.(()=>{if(motion.matches)settleAll();});
  window.addEventListener('hashchange',()=>{if(typeof queueMicrotask==='function')queueMicrotask(prune);else Promise.resolve().then(prune);});
  window.SignalIcons=Object.freeze({svg,button,enhance,destroy,getStats(){prune();let driverCount=0,activeAnimations=0;for(const record of records.values())if(record.driver){driverCount++;const p=record.driver.progress;if(Number.isFinite(p)&&Math.abs(p-1)>1e-7)activeAnimations++;}return Object.freeze({...counts,managed:records.size,driverCount,activeAnimations,version:'1.0.0'});}});
  if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',()=>enhance(document),{once:true});
  if(document.readyState!=='loading')enhance(document);
})();
