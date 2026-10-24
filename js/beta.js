/* Public Beta metadata. The release preparer injects only the public repo URL. */
(function(){
  'use strict';
  const repository='https://github.com/rielle2/signals-and-systems-lab';
  const configured=/^https:\/\/github\.com\/[a-zA-Z0-9-]+\/[a-zA-Z0-9_.-]+$/.test(repository);
  const version='2.2.1-beta.1';
  const issueURL=configured?repository+'/issues/new?template=bug_report.yml&title=%5BBeta%5D%20':'';
  const header=document.querySelector('.topbar-actions');
  if(!header)return;
  const badge=document.createElement('span');badge.className='beta-badge';badge.textContent='BETA';badge.dataset.betaBadge='';badge.title='公开测试版 '+version;
  const feedback=document.createElement('button');feedback.type='button';feedback.className='beta-feedback';feedback.dataset.betaFeedback='';feedback.setAttribute('aria-label','反馈问题');feedback.innerHTML='反馈<span class="beta-desktop">问题</span>';
  header.prepend(badge,feedback);
  const dialog=document.createElement('dialog');dialog.id='betaFeedbackDialog';dialog.setAttribute('aria-labelledby','betaFeedbackTitle');
  dialog.innerHTML='<div class="dialog-head"><h2 id="betaFeedbackTitle">反馈问题 · Beta 测试</h2><button class="icon-btn" data-beta-close aria-label="关闭反馈窗口">×</button></div><p>感谢帮助改进课程讲解、数学结果和交互体验。请通过 GitHub Issues 说明问题；模板会引导填写复现步骤、预期与实际结果、设备和浏览器。</p><div class="beta-meta"><div>版本：<strong data-beta-version></strong></div><div>当前页面：<span data-beta-route></span></div></div><p class="beta-privacy"><strong>反馈是公开的，请勿提交个人隐私。</strong><br>不要上传密码、Token、手机号、邮箱、学号、成绩或含个人信息的截图。请仅附复现所需的匿名信号表达式与步骤。</p><p class="beta-note">学习进度、错题和自定义信号仍保存在本机浏览器，不会由本网站自动上传。访问 GitHub 和提交 Issue 需使用你自己的 GitHub 账号。</p><div class="beta-dialog-actions"><a class="btn btn-primary" data-beta-issue target="_blank" rel="noopener noreferrer">前往 GitHub 填写反馈 ↗</a><button class="btn" data-beta-copy>复制测试环境信息</button></div><div data-beta-copy-status role="status" aria-live="polite"></div><p class="beta-note" data-beta-config-note></p>';
  document.body.append(dialog);
  dialog.querySelector('[data-beta-version]').textContent=version;
  const link=dialog.querySelector('[data-beta-issue]');
  if(configured)link.href=issueURL;
  else{link.hidden=true;dialog.querySelector('[data-beta-config-note]').textContent='当前是待发布的本地副本，GitHub 反馈入口会在准备发布副本时配置。';}
  const route=()=>/^#(?:home|chapter|lesson|labs|exercises|question|formulas|review|bookmarks|map|about|signal-guide)(?:[\/a-zA-Z0-9_-]*)$/.test(location.hash.split('?')[0])?location.hash.split('?')[0]:'#home';
  feedback.addEventListener('click',()=>{dialog.querySelector('[data-beta-route]').textContent=route();dialog.querySelector('[data-beta-copy-status]').textContent='';dialog.showModal();});
  dialog.querySelector('[data-beta-close]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)dialog.close();}});
  dialog.querySelector('[data-beta-copy]').addEventListener('click',async()=>{
    const text=['SignalLab '+version,'页面：'+route(),'浏览器：'+navigator.userAgent,'视口：'+innerWidth+' × '+innerHeight,'说明：此为浏览器报告，不代表实际设备已验证。'].join('\n');
    const status=dialog.querySelector('[data-beta-copy-status]');
    try{await navigator.clipboard.writeText(text);status.textContent='已复制。请检查内容后，再决定是否粘贴到公开反馈中。';}
    catch{status.textContent=text;status.style.whiteSpace='pre-wrap';}
  });
  window.SignalLabBeta=Object.freeze({version,repository:configured?repository:null,issueURL:issueURL||null});
})();
