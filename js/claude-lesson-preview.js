/* Claude Engineering Notebook — presentation for course lessons.
 * The continuous-time convolution lesson retains its original live plate.
 * This module only re-arranges the nodes produced by app.js renderLesson().
 * It never touches curriculum data, grading, storage or theme algorithms.
 * All moved nodes stay inside #main, which app.render() replaces on the
 * next route; unmount() removes the body scope class and listeners. */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const ORDER = ['intuition', 'definition', 'formulas', 'derivation', 'example', 'pitfalls', 'quick'];
  const LABEL = {intuition:'直观理解', definition:'严格定义', formulas:'核心公式', derivation:'一步步推导', visual:'图形与实验', example:'原创例题', pitfalls:'易错点', quick:'快速自测'};
  let state = null;

  function withDesign(href) {
    try {
      const u = new URL(href, location.href);
      const [path, query = ''] = u.hash.slice(1).split('?');
      const p = new URLSearchParams(query); p.set('design', 'claude');
      u.hash = path + '?' + p.toString();
      return u.href;
    } catch { return href; }
  }

  function buildTitle(text) {
    const [main, sub] = String(text).split(/[：:]/);
    if (!sub) return `<span class="cl-title-main">${esc(text)}</span>`;
    const steps = sub.split('、').map((s, i) => `<span class="cl-step"><span class="cl-step-no" aria-hidden="true">${i + 1}</span>${esc(s)}</span>`).join('<span class="cl-step-sep" aria-hidden="true"></span>');
    return `<span class="cl-title-main">${esc(main)}</span><span class="cl-title-sub"><span class="sr-only">：</span>${steps}</span>`;
  }

  function mount(main, ctx = {}) {
    unmount();
    const head = $('.lesson-head', main), layout = $('.lesson-layout', main);
    if (!head || !layout) return;
    const article = $('.lesson-content', layout), aside = $('.lesson-aside', layout);
    const switcher = $('.lp-switcher', main), examBanner = $('.exam-banner', main);
    const back = $('.btn-row a.small', head), modeSwitch = $('.mode-switch', head);
    const titleText = $('h1', head)?.textContent || '';
    const metaSpans = $$('h1 + .btn-row > span', head);
    const chapter = ctx.chapter || {}, topics = chapter.topics || [];
    const topicNo = Math.max(0, topics.findIndex(t => t.id === ctx.topic?.id)) + 1;

    const page = el('div', 'cl-page');
    page.dataset.clPreview = '';

    /* ---------- Masthead of the lesson ---------- */
    const hero = el('header', 'cl-hero');
    const top = el('div', 'cl-hero-top');
    if (back) { back.className = 'cl-back'; top.append(back); }
    if (switcher) { switcher.classList.add('cl-tracks'); top.append(switcher); }
    hero.append(top);
    hero.append(el('p', 'cl-kicker', `<span class="cl-kicker-no">第 <b>${(ctx.chapterIndex ?? 0) + 1}</b> 章</span><span>${esc(chapter.title || metaSpans[0]?.textContent || '')}</span><span class="cl-kicker-dot" aria-hidden="true"></span><span>知识点 <b>${topicNo}</b> / ${topics.length || '—'}</span>`));
    const convolution = ctx.topic?.id === 'ct-convolution';
    const h1 = el('h1', 'cl-title', convolution ? buildTitle(titleText) : `<span class="cl-title-main">${esc(titleText)}</span>`);
    hero.append(h1);
    const meta = el('div', 'cl-meta');
    const facts = el('p', 'cl-facts');
    if (metaSpans[1]) facts.append(el('span', 'cl-fact', `<span class="cl-fact-k">时长</span>${esc(metaSpans[1].textContent.replace('◷', '').trim())}`));
    if (metaSpans[2]) facts.append(el('span', 'cl-fact', `<span class="cl-fact-k">掌握</span>${esc(metaSpans[2].textContent.trim())}`));
    meta.append(facts);
    if (modeSwitch) { modeSwitch.classList.add('cl-mode'); modeSwitch.setAttribute('role', 'group'); modeSwitch.setAttribute('aria-label', '讲解模式'); $$('button', modeSwitch).forEach(b => b.setAttribute('aria-pressed', String(b.classList.contains('active')))); meta.append(modeSwitch); }
    hero.append(meta);
    if (examBanner) { examBanner.classList.add('cl-exam-note'); hero.append(examBanner); }
    page.append(hero);

    /* ---------- Figure plate: waveforms first ---------- */
    const visual = article && $('#visual', article);
    let liveButton = null, liveHost = null;
    if (visual) {
      visual.className = 'cl-plate';
      visual.setAttribute('aria-labelledby', 'clPlateTitle');
      const h2 = $('h2', visual);
      if (h2) { h2.id = 'clPlateTitle'; h2.className = 'cl-plate-title'; h2.innerHTML = `<span class="cl-plate-no">图 1</span>${LABEL.visual}`; }
      const figure = $('.concept-visual', visual);
      if (figure) {
        figure.classList.add('cl-scope');
        figure.tabIndex = 0;
        figure.setAttribute('role', 'region');
        figure.setAttribute('aria-label', convolution ? '卷积波形图，可横向滚动' : '信号示意图，可横向滚动');
      }
      const labLink = $('a.btn', visual);
      const tools = el('div', 'cl-plate-tools');
      if (convolution) {
        liveButton = el('button', 'cl-live-toggle', '在本页打开实时卷积实验');
        liveButton.type = 'button';
        liveButton.setAttribute('aria-expanded', 'false');
        liveButton.setAttribute('aria-controls', 'labHost');
        tools.append(liveButton);
      }
      if (labLink) { labLink.className = 'cl-link'; tools.append(labLink); }
      visual.append(tools);
      if (convolution) {
        liveHost = el('div', 'cl-live');
        liveHost.id = 'labHost';
        liveHost.hidden = true;
        visual.append(liveHost);
      }
      page.append(visual);
    }

    /* ---------- Reading body: rail · text · margin ---------- */
    const body = el('div', 'cl-body');
    const rail = el('nav', 'cl-rail');
    rail.setAttribute('aria-label', '本节导航');
    rail.append(el('p', 'cl-rail-head', '本节'));
    const list = el('ol', 'cl-rail-list');
    rail.append(list);
    const text = el('article', 'cl-text');
    const margin = el('aside', 'cl-margin');
    margin.setAttribute('aria-label', '练习与收藏');

    let n = 0;
    for (const id of ORDER) {
      const sec = article && $('#' + id, article);
      if (!sec) continue;
      n++;
      sec.className = `cl-sec cl-sec--${id}`;
      const h2 = $('h2', sec);
      if (h2) {
        h2.className = 'cl-sec-head';
        const no = $('.section-no', h2);
        if (no) { no.className = 'cl-sec-no'; no.textContent = String(n).padStart(2, '0'); no.setAttribute('aria-hidden', 'true'); }
      }
      if (id === 'definition') {
        const p = $('p', sec);
        if (p) { const box = el('div', 'cl-def'); box.append(el('span', 'cl-def-tag', '定义'), p); sec.append(box); }
      }
      if (id === 'example') {
        $$('.worked-example', sec).forEach((ex, i) => {
          ex.classList.add('cl-ex');
          const h3 = $('h3', ex);
          if (h3) h3.insertAdjacentHTML('afterbegin', `<span class="cl-ex-no" aria-hidden="true">例 ${i + 1}</span>`);
        });
        const cta = $(':scope > a.btn-primary', sec);
        if (cta) cta.classList.add('cl-cta');
      }
      text.append(sec);
    }
    const bottom = article && $('.lesson-bottom', article);
    if (bottom) { bottom.className = 'cl-pager'; text.append(bottom); }

    /* Rail links are the original data-scroll anchors, so app.js binds them. */
    const tocLinks = aside ? $$('.toc a[data-scroll]', aside) : [];
    const byId = Object.fromEntries(tocLinks.map(a => [a.dataset.scroll, a]));
    const railIds = (visual ? ['visual'] : []).concat(ORDER.filter(id => $('#' + id, text)));
    let k = 0;
    for (const id of railIds) {
      const a = byId[id];
      if (!a) continue;
      const label = id === 'visual' ? '图' : String(++k).padStart(2, '0');
      a.className = 'cl-rail-link';
      if (ctx.keepDesign) a.href = withDesign(a.href);
      a.innerHTML = `<span class="cl-rail-no">${label}</span><span class="cl-rail-label">${LABEL[id]}</span>`;
      const li = el('li'); li.append(a); list.append(li);
    }

    if (aside) {
      $$(':scope > section', aside).forEach(card => {
        if (card.classList.contains('toc')) return;
        card.className = 'cl-note';
        $$('[style]', card).forEach(x => x.removeAttribute('style'));
        margin.append(card);
      });
    }

    body.append(rail, text, margin);
    page.append(body);

    main.replaceChildren(page);
    document.body.classList.add('cl-preview');

    state = {main, page, rail, liveButton, liveHost, labOpen: false, observer: null, typeset: ctx.typeset};
    if (liveButton) liveButton.addEventListener('click', toggleLive);
    observe(list);
  }

  function toggleLive() {
    if (!state?.liveHost) return;
    const {liveHost, liveButton} = state;
    if (state.labOpen) {
      window.Labs?.destroy();
      liveHost.replaceChildren();
      liveHost.hidden = true;
      state.labOpen = false;
      liveButton.setAttribute('aria-expanded', 'false');
      liveButton.textContent = '在本页打开实时卷积实验';
      return;
    }
    if (!window.Labs?.render) return;
    liveHost.hidden = false;
    window.Labs.render('convolution', liveHost);
    try { state.typeset?.(liveHost); } catch {}
    window.SignalIcons?.enhance(liveHost);
    state.labOpen = true;
    liveButton.setAttribute('aria-expanded', 'true');
    liveButton.textContent = '收起实时实验';
  }

  function observe(list) {
    if (!('IntersectionObserver' in window)) return;
    const links = $$('a[data-scroll]', list);
    const targets = links.map(a => document.getElementById(a.dataset.scroll)).filter(Boolean);
    if (!targets.length) return;
    const io = new IntersectionObserver(entries => {
      const hit = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!hit) return;
      const current = links.find(a => a.dataset.scroll === hit.target.id);
      links.forEach(a => {
        if (a === current) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      if (current && list.scrollWidth > list.clientWidth) {
        const link = current.getBoundingClientRect(), strip = list.getBoundingClientRect();
        if (link.left < strip.left || link.right > strip.right) {
          list.scrollLeft += (link.left + link.width / 2) - (strip.left + strip.width / 2);
        }
      }
    }, {rootMargin: '-25% 0px -65% 0px'});
    targets.forEach(t => io.observe(t));
    state.observer = io;
  }

  function unmount() {
    document.body.classList.remove('cl-preview');
    if (!state) return;
    state.observer?.disconnect();
    state.liveButton?.removeEventListener('click', toggleLive);
    if (state.labOpen) window.Labs?.destroy();
    state = null;
  }

  window.ClaudeLessonPreview = {mount, unmount, isMounted: () => !!state};
})();
