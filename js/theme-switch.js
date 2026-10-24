/* Coastal day/night capsule. Theme preference and page transitions belong to SignalTheme.
 * Load after theme.js; call ThemeSwitch.mount() once the header exists. Mount is idempotent.
 */
(function () {
  'use strict';
  let current=null,serial=0;
  const validTheme=value=>value==='light'||value==='dark';
  const validPreference=value=>['system','light','dark'].includes(value);
  const labels={system:'跟随系统',light:'始终浅色',dark:'始终深色'};
  const animationLabels={auto:'自动选择',full:'完整圆形扩散',optimized:'优化圆形扩散',simple:'轻量过渡',off:'无动画'};
  const validAnimation=value=>Object.prototype.hasOwnProperty.call(animationLabels,value);
  function mount(target=document.getElementById('themeToggle')) {
    const button=typeof target==='string'?document.querySelector(target):target;
    if(!button||button.tagName!=='BUTTON')return null;
    if(current?.button===button)return current;
    current?.destroy();
    const api=window.SignalTheme;if(typeof api?.setPreference!=='function')return null;
    const suffix=++serial,prefix=`coastal-theme-${suffix}`;
    const original={parent:button.parentNode,next:button.nextSibling,html:button.innerHTML,className:button.className,attrs:{}};
    for(const name of ['aria-label','aria-pressed','aria-checked','role','title','type','data-theme-target'])original.attrs[name]=button.getAttribute(name);
    const wrapper=document.createElement('div');wrapper.className='theme-control';wrapper.dataset.themeControl='';
    original.parent.insertBefore(wrapper,button);wrapper.appendChild(button);
    const header=wrapper.closest('.topbar'),headerHadSceneClass=header?.classList.contains('has-scene-theme');header?.classList.add('has-scene-theme');
    button.type='button';button.classList.add('theme-scene-toggle');button.removeAttribute('role');button.removeAttribute('aria-checked');
    button.setAttribute('aria-label','深色模式');button.setAttribute('aria-pressed','false');
    button.innerHTML=`<svg class="theme-scene" viewBox="0 0 96 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${prefix}-day" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#77cfff"/><stop offset="1" stop-color="#d7f4ff"/></linearGradient>
        <linearGradient id="${prefix}-night" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#142e54"/><stop offset="1" stop-color="#385d87"/></linearGradient>
        <linearGradient id="${prefix}-sea-day" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#40b8d7"/><stop offset="1" stop-color="#238ebb"/></linearGradient>
        <linearGradient id="${prefix}-sea-night" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#244b76"/><stop offset="1" stop-color="#142e54"/></linearGradient>
      </defs>
      <rect class="theme-sky-day" width="96" height="44" fill="url(#${prefix}-day)"/>
      <rect class="theme-sky-night" width="96" height="44" fill="url(#${prefix}-night)"/>
      <g class="theme-clouds" fill="#f8fdff">
        <path d="M46 15c-.2-2.5 1.7-4.7 4.3-4.7 1-3.3 5.7-4 7.5-1 3.4-1.6 7 .8 6.8 4.3 2.5.1 3.4 2.1 2.3 3.4H46.9c-1-.2-1.5-1.3-.9-2Z" opacity=".94"/>
        <path d="M73 7c.1-1.8 1.6-3.1 3.4-2.9 1-2.5 4.4-2.6 5.7-.2 2.4-.7 4.6 1 4.4 3.3H73Z" opacity=".65"/>
        <path d="M68 22c.1-1.3 1.4-2.3 2.9-2 1.4-2.6 5.2-2.2 5.9.6 2.1-.9 4.4.6 4.3 2.7H68Z" opacity=".6"/>
      </g>
      <g class="theme-stars" fill="#e4f1ff">
        <path d="m16 8 .8 2.3 2.3.8-2.3.8-.8 2.3-.8-2.3-2.3-.8 2.3-.8Z"/>
        <path d="m38 6 .6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6Z" opacity=".92"/>
        <path d="m28 18 .55 1.5 1.5.55-1.5.55-.55 1.5-.55-1.5-1.5-.55 1.5-.55Z" opacity=".75"/>
        <circle cx="7" cy="21" r=".7"/><circle cx="27" cy="7" r=".65" opacity=".8"/><circle cx="45" cy="18" r=".7"/><circle cx="36" cy="26" r=".5" opacity=".6"/>
      </g>
      <g class="theme-water-day"><path d="M0 29c11-2.2 21 2.2 32 0s21-1.8 32 .2S85 27 96 29v15H0Z" fill="url(#${prefix}-sea-day)"/><path d="M0 33c14-2.2 24 2.2 39 .1s25-1.2 39 .4 14-.6 18-.7" fill="none" stroke="#bceef5" stroke-opacity=".65" stroke-width=".8"/><path d="M47 40h11m15-3h8M8 38h7" stroke="#e5faff" stroke-opacity=".5" stroke-width=".8" stroke-linecap="round"/></g>
      <g class="theme-water-night"><path d="M0 29c11-2.2 21 2.2 32 0s21-1.8 32 .2S85 27 96 29v15H0Z" fill="url(#${prefix}-sea-night)"/><path d="M0 33c14-2.2 24 2.2 39 .1s25-1.2 39 .4 14-.6 18-.7" fill="none" stroke="#88b4d5" stroke-opacity=".36" stroke-width=".8"/><path d="M64 35h8m-13 3h16m-10 3h6" stroke="#c2dbee" stroke-opacity=".42" stroke-width=".8" stroke-linecap="round"/></g>
      <g class="theme-boat">
        <path d="M49 27v10" stroke="#527d92" stroke-width=".8" stroke-linecap="round"/>
        <path d="m48.1 27.4-5.6 8h5.6Z" fill="#f8fdff"/><path d="m50 28.4 5.4 7H50Z" fill="#d4edf5"/>
        <path d="M41.5 37h15l-2.8 3.3H45Z" fill="#f8fdff"/><path d="M43 40.9h12" stroke="#a8d9e7" stroke-width=".8" stroke-linecap="round" opacity=".8"/>
      </g>
      <path class="theme-scene-glass" d="M19 1.5h58a20.5 20.5 0 0 1 17.2 10.7" fill="none" stroke="#fff" stroke-opacity=".42" stroke-width="1"/>
    </svg>
    <span class="theme-orb" aria-hidden="true"><svg viewBox="0 0 36 36" focusable="false">
      <defs><radialGradient id="${prefix}-sun" cx=".3" cy=".25" r=".8"><stop stop-color="#ffe9a3"/><stop offset=".65" stop-color="#ffd675"/><stop offset="1" stop-color="#ffbc5c"/></radialGradient><radialGradient id="${prefix}-moon" cx=".3" cy=".25" r=".85"><stop stop-color="#f8fdff"/><stop offset=".7" stop-color="#dae8f4"/><stop offset="1" stop-color="#b8cce0"/></radialGradient></defs>
      <g class="theme-sun"><circle cx="18" cy="18" r="17" fill="url(#${prefix}-sun)"/><path d="M6.2 15.5A12 12 0 0 1 18 6" fill="none" stroke="#fff7ce" stroke-width="1.2" stroke-linecap="round" opacity=".7"/><circle cx="12" cy="11" r="2.6" fill="#fff5c7" opacity=".45"/></g>
      <g class="theme-moon"><circle cx="18" cy="18" r="17" fill="url(#${prefix}-moon)"/><circle cx="23.5" cy="11.5" r="3.6" fill="#acc3d8" opacity=".5"/><circle cx="11.5" cy="22.8" r="2.6" fill="#adc4d9" opacity=".4"/><circle cx="24" cy="25.4" r="1.9" fill="#a9bfd4" opacity=".45"/><path d="M7 14A12.1 12.1 0 0 1 17 6" fill="none" stroke="#fff" stroke-opacity=".65" stroke-linecap="round"/></g>
    </svg></span>`;
    const settings=document.createElement('button');settings.id='themeSettingsToggle';settings.className='theme-settings-toggle';settings.type='button';settings.setAttribute('aria-label','主题设置');settings.setAttribute('aria-haspopup','menu');settings.setAttribute('aria-expanded','false');settings.setAttribute('aria-controls','themeSettingsMenu');
    settings.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="m6.5 8.5 3.5 3.5 3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="theme-auto-dot" aria-hidden="true"></span>';
    const menu=document.createElement('div');menu.id='themeSettingsMenu';menu.className='theme-settings-menu';menu.hidden=true;menu.setAttribute('role','menu');menu.setAttribute('aria-label','主题偏好');
    menu.innerHTML='<p class="theme-menu-heading" aria-hidden="true">主题偏好</p>'+[['system','Auto','跟随系统','<path d="M3 4h14v10H3zM7 17h6m-3-3v3"/>'],['light','Light','始终浅色','<circle cx="10" cy="10" r="3.4"/><path d="M10 1.5v1.3m0 14.4v1.3m8.5-8.5h-1.3M2.8 10H1.5m14.5-6-.9.9M4.9 15.1l-.9.9m12 0-.9-.9M4.9 4.9 4 4"/>'],['dark','Dark','始终深色','<path d="M16.7 12.4A7.1 7.1 0 0 1 7.6 3.3a7.2 7.2 0 1 0 9.1 9.1Z"/>']].map(([value,en,zh,icon])=>`<button type="button" role="menuitemradio" aria-checked="false" tabindex="-1" data-theme-option="${value}"><svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">${icon}</svg><span><strong>${en}</strong><small>${zh}</small></span><svg class="theme-option-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 8 3 3 7-7"/></svg></button>`).join('');
    const animationSection=document.createElement('div');animationSection.className='theme-animation-section';animationSection.setAttribute('role','none');
    animationSection.innerHTML='<button type="button" class="theme-animation-toggle" role="menuitem" tabindex="-1" data-theme-animation-toggle aria-haspopup="menu" aria-expanded="false" aria-controls="themeAnimationMenu"><span>动画效果</span><small data-theme-animation-summary>自动</small><svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m6 4 4 4-4 4"/></svg></button><div id="themeAnimationMenu" class="theme-animation-menu" role="menu" aria-label="动画效果" aria-describedby="themeAnimationHelp themeAnimationEffective" hidden><p id="themeAnimationHelp" class="theme-animation-help" role="presentation">自动按连续有效测量调整；若仍卡顿，可手动选优化圆形。</p><p id="themeAnimationEffective" class="theme-animation-effective" data-theme-animation-effective role="presentation"></p>'+Object.entries(animationLabels).map(([value,label])=>`<button type="button" role="menuitemradio" aria-checked="false" tabindex="-1" data-theme-animation-option="${value}"><span><strong>${label}</strong></span><svg class="theme-option-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="m3 8 3 3 7-7"/></svg></button>`).join('')+'</div>';
    menu.appendChild(animationSection);
    const diagnosticToggle=document.createElement('button');diagnosticToggle.type='button';diagnosticToggle.className='theme-diagnostic-toggle';diagnosticToggle.dataset.themeDiagnosticsToggle='';diagnosticToggle.setAttribute('role','menuitem');diagnosticToggle.setAttribute('tabindex','-1');diagnosticToggle.setAttribute('aria-haspopup','dialog');diagnosticToggle.textContent='动画诊断';animationSection.querySelector('#themeAnimationMenu').append(diagnosticToggle);
    const diagnostic=document.createElement('dialog');diagnostic.className='theme-diagnostics';diagnostic.setAttribute('aria-labelledby',prefix+'-diagnostics-title');
    diagnostic.innerHTML=`<header><h2 id="${prefix}-diagnostics-title">动画诊断</h2><button type="button" data-theme-diagnostics-close aria-label="关闭动画诊断">关闭</button></header><p class="theme-diagnostics-intro">比较浏览器的站点版本、实际动画路径与最近切换记录。这里只读取技术信息，不读取学习进度、答题记录或自定义信号。</p><dl data-theme-diagnostics-summary></dl><p class="theme-diagnostics-note">rAF 与长任务数据仅反映主线程响应，不是 GPU 耗时或真实设备帧率。尚无记录时，请先切换主题后再查看。</p><details data-theme-diagnostics-details><summary>查看诊断 JSON</summary><textarea data-theme-diagnostics-json aria-label="可复制的技术诊断 JSON" readonly spellcheck="false"></textarea></details><footer><button type="button" data-theme-diagnostics-refresh>刷新诊断</button><button type="button" data-theme-diagnostics-copy>复制诊断</button></footer><p class="theme-diagnostics-status" data-theme-diagnostics-status role="status" aria-live="polite"></p>`;
    document.body.append(diagnostic);
    const announcement=document.createElement('span');announcement.className='theme-switch-announcement';announcement.setAttribute('aria-live','polite');announcement.setAttribute('role','status');
    wrapper.append(settings,menu,announcement);
    const options=[...menu.querySelectorAll('[data-theme-option]')],animationToggle=menu.querySelector('[data-theme-animation-toggle]'),animationMenu=menu.querySelector('#themeAnimationMenu'),animationSummary=menu.querySelector('[data-theme-animation-summary]'),animationEffective=menu.querySelector('[data-theme-animation-effective]'),animationOptions=[...menu.querySelectorAll('[data-theme-animation-option]')],animationItems=[...animationOptions,diagnosticToggle],menuItems=[...options,animationToggle];let disposed=false,diagnosticRequest=0;
    const getPreference=()=>{const value=typeof api.getPreference==='function'?api.getPreference():typeof api.preference==='function'?api.preference():document.documentElement.dataset.themePreference;return validPreference(value)?value:'system';};
    const resolve=value=>value==='system'?(window.matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):value;
    const getTheme=()=>{const value=typeof api.getTheme==='function'?api.getTheme():typeof api.theme==='function'?api.theme():document.documentElement.dataset.theme;return validTheme(value)?value:resolve(getPreference());};
    const getAnimation=()=>{const value=api.getAnimationPreference?.();return validAnimation(value)?value:'auto';};
    function syncAnimation(event){const detail=event?.detail||{},value=validAnimation(detail.preference)?detail.preference:validAnimation(detail.policy?.preference)?detail.policy.preference:getAnimation();animationSummary.textContent=animationLabels[value];animationToggle.setAttribute('aria-label',`动画偏好：${animationLabels[value]}`);for(const option of animationOptions){const selected=option.dataset.themeAnimationOption===value;option.setAttribute('aria-checked',String(selected));option.tabIndex=selected?0:-1;}const policy=detail.policy||(detail.profile?detail:api.getAnimationPolicy?.());if(policy&&['full','optimized','simple','none'].includes(policy.profile)){const reason=policy.reason==='reduced-motion'?'（遵循系统减少动态效果）':/^missing-/.test(policy.reason||'')?'（浏览器能力限制）':'';animationEffective.hidden=false;animationEffective.textContent=`当前效果：${policy.profile==='none'||policy.reason==='reduced-motion'||(policy.level===3&&policy.reason==='repeated-observed-delay')?animationLabels.off:animationLabels[policy.profile]}${reason}`;}else animationEffective.hidden=true;}
    function paint(theme,preference){
      if(disposed)return;wrapper.dataset.themeTarget=theme;wrapper.dataset.themePreference=preference;button.dataset.themeTarget=theme;button.setAttribute('aria-pressed',String(theme==='dark'));
      button.title=theme==='dark'?'切换浅色模式':'切换深色模式';settings.setAttribute('aria-label',`主题设置，当前${labels[preference]}`);settings.title=`主题设置 · ${labels[preference]}`;
      for(const option of options){const selected=option.dataset.themeOption===preference;option.setAttribute('aria-checked',String(selected));option.tabIndex=selected?0:-1;}
    }
    function sync(event){const detail=event?.detail||{},pref=validPreference(detail.preference)?detail.preference:getPreference();const theme=validTheme(detail.theme)?detail.theme:resolve(pref);paint(theme,pref);syncAnimation();}
    function focusMenuItem(item){item.focus({preventScroll:true});const box=item.getBoundingClientRect(),bounds=menu.getBoundingClientRect();if(box.bottom>bounds.bottom-8)menu.scrollTop+=box.bottom-bounds.bottom+8;else if(box.top<bounds.top+8)menu.scrollTop-=bounds.top+8-box.top;}
    function closeAnimation(returnFocus=false){animationMenu.hidden=true;animationToggle.setAttribute('aria-expanded','false');if(returnFocus)focusMenuItem(animationToggle);}
    function openAnimation(index){animationMenu.hidden=false;animationToggle.setAttribute('aria-expanded','true');const selected=animationOptions.findIndex(option=>option.getAttribute('aria-checked')==='true');focusMenuItem(animationOptions[index??Math.max(0,selected)]);}
    function closeMenu(returnFocus=false){if(menu.hidden)return;closeAnimation();menu.hidden=true;settings.setAttribute('aria-expanded','false');wrapper.classList.remove('theme-menu-open');if(returnFocus)settings.focus({preventScroll:true});}
    function openMenu(index){menu.hidden=false;settings.setAttribute('aria-expanded','true');wrapper.classList.add('theme-menu-open');const selected=options.findIndex(option=>option.getAttribute('aria-checked')==='true');focusMenuItem(menuItems[index??(selected<0?0:selected)]);}
    function apply(preference){
      if(!validPreference(preference))return;closeMenu(false);const theme=resolve(preference);paint(theme,preference);announcement.textContent=`${labels[preference]}，当前${theme==='dark'?'夜间':'日间'}主题`;
      try{api.setPreference(preference,{animate:true,origin:button});}catch(error){paint(getTheme(),getPreference());announcement.textContent='主题暂未切换，请重试。';}
    }
    function toggle(){apply(button.dataset.themeTarget==='dark'?'light':'dark');}
    function settingsClick(){if(menu.hidden)openMenu();else closeMenu(true);}
    function settingKey(event){if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openMenu(event.key==='ArrowUp'?menuItems.length-1:0);}}
    function menuClick(event){const option=event.target.closest('[data-theme-option]');if(!option||!menu.contains(option))return;apply(option.dataset.themeOption);settings.focus({preventScroll:true});}
    function menuKey(event){if(animationMenu.contains(event.target))return;const index=Math.max(0,menuItems.indexOf(document.activeElement));let next;if(event.key==='ArrowDown')next=(index+1)%menuItems.length;else if(event.key==='ArrowUp')next=(index+menuItems.length-1)%menuItems.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=menuItems.length-1;else if(event.key==='ArrowRight'&&document.activeElement===animationToggle){event.preventDefault();openAnimation();return;}else if(event.key==='Tab'){closeMenu(false);settings.focus({preventScroll:true});return;}else return;event.preventDefault();focusMenuItem(menuItems[next]);}
    function animationClick(){if(animationMenu.hidden)openAnimation();else closeAnimation(true);}
    function animationSelect(event){const option=event.target.closest('[data-theme-animation-option]');if(!option||!animationMenu.contains(option))return;const value=option.dataset.themeAnimationOption;if(!validAnimation(value)||typeof api.setAnimationPreference!=='function')return;try{api.setAnimationPreference(value);syncAnimation();announcement.textContent=`动画偏好已设为${animationLabels[value]}`;closeMenu(false);settings.focus({preventScroll:true});}catch{syncAnimation();announcement.textContent='动画偏好暂未更改，请重试。';}}
    function animationKey(event){const index=Math.max(0,animationItems.indexOf(document.activeElement));let next;if(event.key==='ArrowDown')next=(index+1)%animationItems.length;else if(event.key==='ArrowUp')next=(index+animationItems.length-1)%animationItems.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=animationItems.length-1;else if(event.key==='ArrowLeft'){event.preventDefault();closeAnimation(true);return;}else if(event.key==='Tab'){closeMenu(false);settings.focus({preventScroll:true});return;}else return;event.preventDefault();focusMenuItem(animationItems[next]);}
    const diagnosticSummary=diagnostic.querySelector('[data-theme-diagnostics-summary]'),diagnosticJSON=diagnostic.querySelector('[data-theme-diagnostics-json]'),diagnosticStatus=diagnostic.querySelector('[data-theme-diagnostics-status]');
    // Explicit fields prevent future diagnostics from exporting learning data or URLs.
    function selectFields(source,keys){const result={};for(const key of keys){const value=source?.[key];if(typeof value==='boolean'||(typeof value==='number'&&Number.isFinite(value)))result[key]=value;else if(typeof value==='string')result[key]=value.slice(0,240);}return result;}
    function safeDiagnostics(raw){
      const count=value=>Array.isArray(value)?value.length:Number.isFinite(value)?value:null;
      return {version:{site:typeof raw?.version?.site==='string'?raw.version.site.slice(0,100):'unknown',assets:selectFields(raw?.version?.assets,['themeAnimation','theme','themeSwitch','themeCSS','sceneCSS']),consistent:raw?.version?.consistent===true},
        userAgent:typeof raw?.userAgent==='string'?raw.userAgent.slice(0,400):'not provided',preference:validAnimation(raw?.preference)?raw.preference:getAnimation(),
        policy:selectFields(raw?.policy,['level','profile','reason','duration','easing','immediate']),
        capabilities:selectFields(raw?.capabilities,['viewTransition','clipPath','webAnimations','pseudoAnimation','visualViewport','reducedMotion','longTasks']),
        lastTransition:selectFields(raw?.lastTransition,['active','method','level','profile','reason','duration','coordinateSpace','toolbarDelay']),
        samples:(Array.isArray(raw?.samples)?raw.samples:[]).slice(-6).map(sample=>selectFields(sample,['level','eligible','readyMs','updateMs','frameCount','p95Ms','maxGapMs','slowRatio','longTaskMs','durationMs','measurement'])),
        cache:{serviceWorkerControlled:!!raw?.cache?.serviceWorkerControlled,registrations:count(raw?.cache?.registrations),cacheCount:count(raw?.cache?.cacheNames??raw?.cache?.cacheCount)},
        measurement:'Main-thread rAF and Long Tasks proxies, not GPU cost or real-device FPS.'};
    }
    async function refreshDiagnostics(){
      const request=++diagnosticRequest;diagnosticJSON.value='';diagnosticStatus.textContent='正在读取技术信息…';
      try{
        if(typeof window.ThemeAnimation?.getDiagnostics!=='function')throw new Error('unavailable');
        const result=safeDiagnostics(await window.ThemeAnimation.getDiagnostics());if(disposed||request!==diagnosticRequest||!diagnostic.open)return;
        const last=result.samples.at(-1),milliseconds=value=>Number.isFinite(value)?value.toFixed(1)+' ms':'未提供';
        const rows=[['站点版本',result.version.site],['主题资源版本',Object.entries(result.version.assets).map(([key,value])=>`${key}: ${value}`).join(' · ')||'未提供'],['版本是否一致',result.version.consistent?'一致':'未确认，请正常刷新后复核'],['动画偏好',animationLabels[result.preference]],['实际策略',`${result.policy.profile||'未提供'} · ${result.policy.reason||'未提供'}`],['最近执行路径',result.lastTransition.method||'尚未切换'],['浏览器能力',Object.entries(result.capabilities).map(([key,value])=>`${key}: ${value}`).join(' · ')||'未提供'],['过渡就绪 / 更新',last?`${milliseconds(last.readyMs)} / ${milliseconds(last.updateMs)}`:'尚无测量'],['最近长任务',result.capabilities.longTasks===false?'浏览器不支持此项测量':last?milliseconds(last.longTaskMs):'尚无测量'],['Service Worker',result.cache.serviceWorkerControlled?'当前页面受控':'当前页面未受控'],['注册 / 缓存数量',`${result.cache.registrations??'未知'} / ${result.cache.cacheCount??'未知'}`]];
        diagnosticSummary.replaceChildren();for(const [label,value]of rows){const term=document.createElement('dt'),description=document.createElement('dd');term.textContent=label;description.textContent=value;diagnosticSummary.append(term,description);}
        diagnosticJSON.value=JSON.stringify(result,null,2);diagnosticStatus.textContent='诊断已更新；不会清除任何网站数据。';
      }catch{if(!disposed&&request===diagnosticRequest&&diagnostic.open){diagnosticJSON.value='';diagnosticSummary.replaceChildren();diagnosticStatus.textContent='当前资源未提供诊断信息，请正常刷新页面后重试。';}}
    }
    function openDiagnostics(){closeMenu(false);if(typeof diagnostic.showModal==='function')diagnostic.showModal();else diagnostic.setAttribute('open','');diagnostic.scrollTop=0;diagnostic.querySelector('[data-theme-diagnostics-close]').focus({preventScroll:true});refreshDiagnostics();}
    function closeDiagnostics(){++diagnosticRequest;if(typeof diagnostic.close==='function')diagnostic.close();else diagnostic.removeAttribute('open');settings.focus({preventScroll:true});}
    async function copyDiagnostics(){if(!diagnosticJSON.value)return;try{if(!navigator.clipboard?.writeText)throw new Error('clipboard-unavailable');await navigator.clipboard.writeText(diagnosticJSON.value);if(!disposed)diagnosticStatus.textContent='技术诊断已复制，可贴到问题反馈中。';}catch{if(disposed)return;diagnostic.querySelector('[data-theme-diagnostics-details]').open=true;diagnosticJSON.focus();diagnosticJSON.select();diagnosticStatus.textContent='浏览器未允许自动复制；诊断文本已选中，可手动复制。';}}
    function diagnosticClick(event){if(event.target.closest('[data-theme-diagnostics-close]'))closeDiagnostics();else if(event.target.closest('[data-theme-diagnostics-refresh]'))refreshDiagnostics();else if(event.target.closest('[data-theme-diagnostics-copy]'))copyDiagnostics();}
    function diagnosticCancel(event){event.preventDefault();closeDiagnostics();}
    function outside(event){if(!wrapper.contains(event.target))closeMenu(false);}
    function escape(event){if(event.key==='Escape'&&!menu.hidden){event.preventDefault();if(!animationMenu.hidden)closeAnimation(true);else closeMenu(true);}}
    function hashChange(){closeMenu(false);if(diagnostic.open)closeDiagnostics();}
    button.addEventListener('click',toggle);settings.addEventListener('click',settingsClick);settings.addEventListener('keydown',settingKey);menu.addEventListener('click',menuClick);menu.addEventListener('keydown',menuKey);
    animationToggle.addEventListener('click',animationClick);animationMenu.addEventListener('click',animationSelect);animationMenu.addEventListener('keydown',animationKey);document.addEventListener('signallab:animationpreference',syncAnimation);document.addEventListener('signallab:animationpolicy',syncAnimation);
    diagnosticToggle.addEventListener('click',openDiagnostics);diagnostic.addEventListener('click',diagnosticClick);diagnostic.addEventListener('cancel',diagnosticCancel);
    document.addEventListener('pointerdown',outside,true);document.addEventListener('keydown',escape);document.addEventListener('signallab:themepreference',sync);document.addEventListener('signallab:themechange',sync);window.addEventListener('hashchange',hashChange);
    const observer=new MutationObserver(()=>paint(getTheme(),getPreference()));observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme','data-theme-preference']});
    paint(getTheme(),getPreference());syncAnimation();
    const instance={button,wrapper,sync,closeMenu,destroy(){if(disposed)return;disposed=true;++diagnosticRequest;diagnosticToggle.removeEventListener('click',openDiagnostics);diagnostic.removeEventListener('click',diagnosticClick);diagnostic.removeEventListener('cancel',diagnosticCancel);diagnostic.remove();observer.disconnect();button.removeEventListener('click',toggle);settings.removeEventListener('click',settingsClick);settings.removeEventListener('keydown',settingKey);menu.removeEventListener('click',menuClick);menu.removeEventListener('keydown',menuKey);animationToggle.removeEventListener('click',animationClick);animationMenu.removeEventListener('click',animationSelect);animationMenu.removeEventListener('keydown',animationKey);document.removeEventListener('signallab:animationpreference',syncAnimation);document.removeEventListener('signallab:animationpolicy',syncAnimation);document.removeEventListener('pointerdown',outside,true);document.removeEventListener('keydown',escape);document.removeEventListener('signallab:themepreference',sync);document.removeEventListener('signallab:themechange',sync);window.removeEventListener('hashchange',hashChange);button.innerHTML=original.html;button.className=original.className;for(const [name,value]of Object.entries(original.attrs))value===null?button.removeAttribute(name):button.setAttribute(name,value);if(wrapper.isConnected){wrapper.replaceWith(button);}else if(original.parent.isConnected){original.parent.insertBefore(button,original.next?.parentNode===original.parent?original.next:null);}if(!headerHadSceneClass)header?.classList.remove('has-scene-theme');if(current===instance)current=null;}};
    current=instance;return instance;
  }
  window.ThemeSwitch=Object.freeze({version:'2.2.2-beta.1',mount,sync:()=>current?.sync(),closeMenu:(returnFocus=false)=>current?.closeMenu(returnFocus),getInstance:()=>current});
}());
