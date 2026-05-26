/* kovs.vault — tiny client. no deps. */
(() => {
  'use strict';

  const $  = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /* ───────────── theme ───────────── */
  const THEME_KEY = 'kovs.vault.theme';
  const root = document.documentElement;

  function setTheme(mode, persist = true) {
    root.setAttribute('data-theme', mode);
    if (persist) localStorage.setItem(THEME_KEY, mode);
    refreshImageSlots(); // some browsers don't recalc bg-image vars in :root cascade for ::before — re-poke
  }
  (function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved) return setTheme(saved, false);
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    setTheme(prefersLight ? 'light' : 'dark', false);
  })();
  $('#themeToggle')?.addEventListener('click', () => {
    setTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  });

  /* ───────────── sidebar toggle ───────────── */
  const app = $('.app');
  $('#sbToggle')?.addEventListener('click', () => {
    if (window.matchMedia('(max-width: 720px)').matches) {
      app.classList.toggle('sb-open');
    } else {
      app.classList.toggle('collapsed');
    }
  });

  /* ───────────── routing (hash) ───────────── */
  const ROUTES = {
    '/':              { title: 'home',           emoji: '💜' },
    '/about':         { title: 'about me',       emoji: '🎀' },
    '/hobby/default': { title: 'default hobby',  emoji: '🌸' },
    '/notes':         { title: 'notes',          emoji: '🗒️' },
    '/links':         { title: 'links',          emoji: '🔗' },
  };

  function currentRoute() {
    const r = location.hash.replace(/^#/, '') || '/';
    return ROUTES[r] ? r : '/';
  }

  function render(route) {
    const meta = ROUTES[route];
    const tpl = document.getElementById('tpl-' + route);
    const page = $('#page');
    if (!tpl || !page) return;

    // remove previously rendered content — keep .page-emoji, .view markers, AND <template>s
    $$('.page > :not(.page-emoji):not(.view):not(template)').forEach(n => n.remove());

    const frag = tpl.content.cloneNode(true);
    page.appendChild(frag);

    // crumb + emoji
    $('#crumbHere').textContent = meta.title;
    const em = $('.page-emoji');
    if (em) em.textContent = meta.emoji;

    // active link
    $$('.page-link[data-route]').forEach(a => {
      a.classList.toggle('active', a.dataset.route === route);
    });

    // outline
    buildOutline();
    // wire newly inserted image slots
    initImageSlots(page);

    // scroll main back to top
    $('.main').scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });

    document.title = `kovs.vault · ${meta.title}`;
  }

  function buildOutline() {
    const list = $('#olList');
    if (!list) return;
    list.innerHTML = '';
    $$('.page h2, .page h3').forEach((h, i) => {
      if (!h.id) h.id = 'h-' + i + '-' + h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const li = document.createElement('li');
      const a  = document.createElement('a');
      a.href = '#' + h.id;
      a.textContent = h.textContent.replace(/^[^a-zA-Z0-9]+/, '').trim();
      a.className = h.tagName === 'H3' ? 'lvl-3' : '';
      li.appendChild(a);
      list.appendChild(li);
    });
  }

  window.addEventListener('hashchange', () => render(currentRoute()));
  document.addEventListener('DOMContentLoaded', () => {
    initImageSlots(document); // also wires the persistent cover + sidebar portrait
    render(currentRoute());
  });

  /* ───────────── image slots ─────────────
     Each .img-slot may have data-dark / data-light attrs.
     We probe (HEAD-style) by loading them as Image() — if they fail,
     leave the wireframe; if any succeed, set the CSS vars + has-img class.
  */
  function initImageSlots(root) {
    $$('.img-slot[data-dark], .img-slot[data-light]', root).forEach(slot => {
      if (slot.dataset.loaded === '1') return;
      slot.dataset.loaded = '1';
      const dark  = slot.getAttribute('data-dark');
      const light = slot.getAttribute('data-light');
      let darkOk = false, lightOk = false, pending = 0;

      const finalize = () => {
        if (pending > 0) return;
        const dUrl = darkOk  ? `url("${dark}")`  : null;
        const lUrl = lightOk ? `url("${light}")` : null;
        // fall back: if one variant missing, use the other so the slot never blanks
        const dFinal = dUrl || lUrl;
        const lFinal = lUrl || dUrl;
        if (dFinal) slot.style.setProperty('--img-dark',  dFinal);
        if (lFinal) slot.style.setProperty('--img-light', lFinal);
        if (dFinal || lFinal) slot.classList.add('has-img');
      };

      const probe = (url, onOk) => {
        if (!url) return;
        pending++;
        const img = new Image();
        img.onload = () => { onOk(); pending--; finalize(); };
        img.onerror = () => { pending--; finalize(); };
        img.src = url;
      };
      probe(dark,  () => darkOk  = true);
      probe(light, () => lightOk = true);
      // also handle case where only one source resolves
      setTimeout(finalize, 0);
    });
  }
  // re-evaluate slots when theme flips (the CSS var swap is automatic, but classlist may need a kick on some browsers)
  function refreshImageSlots() {
    // intentionally light — CSS handles var swap. Hook left for future per-theme behavior.
  }

  /* ───────────── command palette ───────────── */
  const cmdk = $('#cmdk');
  const cmdkInput = $('#cmdkInput');
  const cmdkList  = $('#cmdkList');
  const commands = [
    ...Object.entries(ROUTES).map(([route, meta]) => ({
      kind: 'page', label: meta.title, emoji: meta.emoji, run: () => (location.hash = '#' + route),
    })),
    { kind: 'cmd', label: 'Toggle theme', emoji: '🌗', run: () => $('#themeToggle').click() },
    { kind: 'cmd', label: 'Toggle sidebar', emoji: '☰', run: () => $('#sbToggle').click() },
  ];

  let cmdkIndex = 0;
  function openCmdk() {
    cmdk.hidden = false;
    cmdkInput.value = '';
    renderCmdk('');
    setTimeout(() => cmdkInput.focus(), 0);
  }
  function closeCmdk() { cmdk.hidden = true; }
  function renderCmdk(q) {
    q = q.toLowerCase().trim();
    const items = commands.filter(c => !q || c.label.toLowerCase().includes(q));
    cmdkList.innerHTML = items.map((c, i) =>
      `<li role="option" data-i="${i}" aria-selected="${i === 0}"><span>${c.emoji}</span><span>${c.label}</span><span style="margin-left:auto;font-size:11px;color:var(--text-mute)">${c.kind}</span></li>`
    ).join('');
    cmdkIndex = 0;
    cmdkList._items = items;
  }
  function moveCmdk(delta) {
    const lis = $$('li', cmdkList);
    if (!lis.length) return;
    cmdkIndex = (cmdkIndex + delta + lis.length) % lis.length;
    lis.forEach((li, i) => li.setAttribute('aria-selected', i === cmdkIndex));
    lis[cmdkIndex].scrollIntoView({ block: 'nearest' });
  }
  function runCmdk() {
    const item = (cmdkList._items || [])[cmdkIndex];
    if (item) { closeCmdk(); item.run(); }
  }
  cmdkInput?.addEventListener('input', e => renderCmdk(e.target.value));
  cmdkInput?.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); moveCmdk(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); moveCmdk(-1); }
    else if (e.key === 'Enter') { e.preventDefault(); runCmdk(); }
    else if (e.key === 'Escape') closeCmdk();
  });
  cmdkList?.addEventListener('click', e => {
    const li = e.target.closest('li'); if (!li) return;
    cmdkIndex = +li.dataset.i; runCmdk();
  });
  $('.cmdk-backdrop')?.addEventListener('click', closeCmdk);

  /* ───────────── keyboard ───────────── */
  document.addEventListener('keydown', e => {
    const typing = /^(input|textarea)$/i.test(e.target.tagName) || e.target.isContentEditable;

    // ⌘K / Ctrl+K — palette
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); openCmdk(); return;
    }
    if (typing) return;

    // single-key shortcuts (only when not typing)
    if (e.key === '/') { e.preventDefault(); $('#search')?.focus(); }
    else if (e.key.toLowerCase() === 't') { $('#themeToggle')?.click(); }
    else if (e.key === 'Escape') closeCmdk();
  });

  /* ───────────── workspace pill → palette ───────────── */
  $('.workspace-pill')?.addEventListener('click', openCmdk);

  /* ───────────── search → palette ───────────── */
  $('#search')?.addEventListener('focus', e => {
    // promote to palette on actual typing, but allow tab-out without opening
    const onKey = (ev) => {
      if (ev.key.length === 1) {
        e.target.blur();
        openCmdk();
        cmdkInput.value = ev.key;
        renderCmdk(ev.key);
        e.target.removeEventListener('keydown', onKey);
      }
    };
    e.target.addEventListener('keydown', onKey, { once: false });
    e.target.addEventListener('blur', () => e.target.removeEventListener('keydown', onKey), { once: true });
  });

  /* ───────────── kuromi trail ─────────────
     little sparkle/skull bits follow the cursor. throttled.
  */
  const trail = $('#trail-root');
  const bits = ['✦','✧','♡','💜','🖤','⋆','˚'];
  let lastTrail = 0;
  if (trail && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.addEventListener('pointermove', e => {
      const now = performance.now();
      if (now - lastTrail < 70) return;
      lastTrail = now;
      const s = document.createElement('span');
      s.className = 'trail-bit';
      s.textContent = bits[(Math.random() * bits.length) | 0];
      s.style.left = e.clientX + 'px';
      s.style.top  = e.clientY + 'px';
      s.style.color = Math.random() > .5 ? 'var(--pink-400)' : 'var(--violet-300)';
      trail.appendChild(s);
      setTimeout(() => s.remove(), 950);
    });
  }
})();
