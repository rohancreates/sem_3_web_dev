/* ==========================================================================
   ROHAN — PORTFOLIO SCRIPT
   Modular vanilla JS. No dependencies.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initReveal();
  initCursorGlow();
  initMagnetic();
  initMobileNav();
  initRoleCycle();
  initClocks();
  initGestureDemo();
  initProjectModal();
  initCommandPalette();
  initDsaVisualizer();
  initActivityHeatmap();
  initScrollCue();
});

/* ---------------------------------------------------------------------- */
/* Theme (dark default, persisted)                                        */
/* ---------------------------------------------------------------------- */
function initTheme(){
  const root = document.body;
  const toggle = document.getElementById('themeToggle');
  const saved = localStorage.getItem('rohan-theme');
  const initial = saved || 'dark';
  root.setAttribute('data-theme', initial);
  toggle.setAttribute('aria-pressed', String(initial === 'light'));

  toggle.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    toggle.setAttribute('aria-pressed', String(next === 'light'));
    try { localStorage.setItem('rohan-theme', next); } catch (e) { /* storage unavailable */ }
  });
}

/* ---------------------------------------------------------------------- */
/* Hero reveal — one orchestrated entrance sequence                       */
/* ---------------------------------------------------------------------- */
function initReveal(){
  const items = document.querySelectorAll('.reveal');
  items.forEach((el, i) => {
    setTimeout(() => el.classList.add('is-in'), 90 * i);
  });
}

/* ---------------------------------------------------------------------- */
/* Cursor-following glow (desktop / hover-capable only)                   */
/* ---------------------------------------------------------------------- */
function initCursorGlow(){
  const glow = document.getElementById('cursorGlow');
  if (!glow || window.matchMedia('(hover: none)').matches) return;
  let raf = null, x = 0, y = 0;

  window.addEventListener('pointermove', (e) => {
    x = e.clientX; y = e.clientY;
    if (raf) return;
    raf = requestAnimationFrame(() => {
      glow.style.transform = `translate(${x - 210}px, ${y - 210}px)`;
      raf = null;
    });
  });
}

/* ---------------------------------------------------------------------- */
/* Magnetic buttons                                                        */
/* ---------------------------------------------------------------------- */
function initMagnetic(){
  if (window.matchMedia('(hover: none)').matches) return;
  document.querySelectorAll('.magnetic').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const relX = e.clientX - r.left - r.width / 2;
      const relY = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${relX * 0.18}px, ${relY * 0.35}px)`;
    });
    btn.addEventListener('pointerleave', () => { btn.style.transform = ''; });
  });
}

/* ---------------------------------------------------------------------- */
/* Mobile nav                                                               */
/* ---------------------------------------------------------------------- */
function initMobileNav(){
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('primaryNav');
  toggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
    toggle.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
  });
  nav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => {
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }));
}

/* ---------------------------------------------------------------------- */
/* Hero role text cycle                                                    */
/* ---------------------------------------------------------------------- */
function initRoleCycle(){
  const el = document.getElementById('roleCycle');
  if (!el) return;
  const roles = ['Web Developer', 'Problem Solver', 'Builder', 'C++ / DSA', 'Creative Technologist'];
  let i = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  setInterval(() => {
    i = (i + 1) % roles.length;
    el.style.opacity = '0';
    setTimeout(() => {
      el.textContent = roles[i];
      el.style.transition = 'opacity 320ms ease';
      el.style.opacity = '1';
    }, 220);
  }, 2600);
}

/* ---------------------------------------------------------------------- */
/* Local time + footer clock (IST-friendly, uses viewer's local time)      */
/* ---------------------------------------------------------------------- */
function initClocks(){
  const local = document.getElementById('localTime');
  const footer = document.getElementById('footerClock');

  function tick(){
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (local) local.textContent = timeStr;
    if (footer) {
      const ist = now.toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
      footer.textContent = `IST ${ist}`;
    }
  }
  tick();
  setInterval(tick, 30000);
}

/* ---------------------------------------------------------------------- */
/* Featured project — animated cursor demo                                 */
/* ---------------------------------------------------------------------- */
function initGestureDemo(){
  const cursor = document.getElementById('gestureCursor');
  if (!cursor) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const points = [
    { left: '30%', top: '30%' }, { left: '68%', top: '22%' },
    { left: '55%', top: '62%' }, { left: '20%', top: '55%' },
    { left: '62%', top: '40%' }
  ];
  let i = 0;
  setInterval(() => {
    i = (i + 1) % points.length;
    cursor.style.left = points[i].left;
    cursor.style.top = points[i].top;
  }, 1600);
}

/* ---------------------------------------------------------------------- */
/* Project data + modal                                                    */
/* ---------------------------------------------------------------------- */
const PROJECT_DATA = {
  gesture: {
    status: 'Prototype',
    title: 'Hand Gesture Cursor Control',
    problem: 'Traditional input devices are a barrier for certain interactions — the goal was to explore whether hand movement alone could reliably drive a cursor.',
    built: 'A computer-vision pipeline that tracks hand position and gestures through a webcam feed and translates that motion into real-time cursor movement and clicks.',
    how: 'Frames from a webcam are analyzed to detect hand landmarks, which are mapped to screen coordinates and smoothed to reduce jitter before being sent to the system cursor.',
    tech: '[ADD TECH STACK]',
    challenges: 'Getting tracking to feel responsive rather than laggy, and handling inconsistent lighting conditions.',
    learned: 'A much deeper appreciation for how much smoothing and calibration real-time HCI systems need to feel natural.',
    github: 'https://github.com/rohancreates',
    demo: '[ADD DEMO URL]'
  },
  sarthi: {
    status: 'Hackathon Concept',
    title: 'Sarthi',
    problem: 'Tourists in unfamiliar places often lack quick, localized guidance and safety information.',
    built: 'A concept for an AI-assisted assistant that could help travellers navigate unfamiliar areas and surface relevant safety information.',
    how: 'Explored as an idea during a hackathon — architecture and implementation details are still being worked out.',
    tech: '[ADD TECH STACK]',
    challenges: '[ADD HERE]',
    learned: '[ADD HERE]',
    github: 'https://github.com/rohancreates',
    demo: ''
  },
  blood: {
    status: 'Hackathon Concept',
    title: 'Emergency Blood-Donor App',
    problem: 'Finding a compatible blood donor quickly during a campus emergency can be slow and disorganized.',
    built: 'A concept for a lightweight app connecting emergency blood requests with nearby willing donors on campus.',
    how: 'Sketched out during a hackathon as a full-stack idea — donor matching and notification logic are still conceptual.',
    tech: '[ADD TECH STACK]',
    challenges: '[ADD HERE]',
    learned: '[ADD HERE]',
    github: 'https://github.com/rohancreates',
    demo: ''
  }
};

function initProjectModal(){
  const overlay = document.getElementById('modalOverlay');
  const content = document.getElementById('modalContent');
  const closeBtn = document.getElementById('modalClose');
  let lastFocused = null;

  function openModal(key){
    const data = PROJECT_DATA[key];
    if (!data) return;
    lastFocused = document.activeElement;

    content.innerHTML = `
      <span class="m-status">${data.status}</span>
      <h3 id="modalTitle">${data.title}</h3>
      <dl>
        <div><dt>Problem</dt><dd>${data.problem}</dd></div>
        <div><dt>What I built</dt><dd>${data.built}</dd></div>
        <div><dt>How it works</dt><dd>${data.how}</dd></div>
        <div><dt>Technologies</dt><dd>${data.tech}</dd></div>
        <div><dt>Challenges</dt><dd>${data.challenges}</dd></div>
        <div><dt>What I learned</dt><dd>${data.learned}</dd></div>
      </dl>
      <div class="m-links">
        <a href="${data.github}">GitHub</a>
        ${data.demo ? `<a href="${data.demo}">Live demo</a>` : ''}
      </div>
    `;
    overlay.hidden = false;
    requestAnimationFrame(() => overlay.classList.add('is-open'));
    closeBtn.focus();
    document.body.style.overflow = 'hidden';
  }

  function closeModal(){
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 260);
    if (lastFocused) lastFocused.focus();
  }

  document.querySelectorAll('[data-project]').forEach((card) => {
    card.addEventListener('click', () => openModal(card.dataset.project));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(card.dataset.project);
      }
    });
  });

  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) closeModal();
  });
}

/* ---------------------------------------------------------------------- */
/* Command palette (Ctrl/Cmd + K)                                          */
/* ---------------------------------------------------------------------- */
function initCommandPalette(){
  const overlay = document.getElementById('cmdkOverlay');
  const input = document.getElementById('cmdkInput');
  const list = document.getElementById('cmdkList');
  const trigger = document.getElementById('cmdkTrigger');
  let lastFocused = null;
  let selected = 0;

  const commands = [
    { label: 'Go home', hint: 'Top', action: () => scrollToId('top') },
    { label: 'About', hint: '#about', action: () => scrollToId('about') },
    { label: 'Projects', hint: '#work', action: () => scrollToId('work') },
    { label: 'Skills', hint: '#stack', action: () => scrollToId('stack') },
    { label: 'Education', hint: '#education', action: () => scrollToId('education') },
    { label: 'Now', hint: '#now', action: () => scrollToId('now') },
    { label: 'GitHub', hint: '↗', action: () => window.open('https://github.com/rohancreates', '_blank') },
    { label: 'LinkedIn', hint: '↗', action: () => window.open('https://www.linkedin.com/in/rohankumarcreates/', '_blank') },
    { label: 'LeetCode', hint: '↗', action: () => window.open('https://leetcode.com/u/rohancreates/', '_blank') },
    { label: 'Contact', hint: '#contact', action: () => scrollToId('contact') },
    { label: 'Toggle theme', hint: '⇧T', action: () => document.getElementById('themeToggle').click() }
  ];

  function scrollToId(id){
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  function render(filter){
    const q = (filter || '').toLowerCase();
    const filtered = commands.filter((c) => c.label.toLowerCase().includes(q));
    list.innerHTML = filtered.map((c, i) => `
      <li role="option" aria-selected="${i === selected}" data-index="${i}">
        <span>${c.label}</span><span class="cmdk-hint">${c.hint}</span>
      </li>
    `).join('');
    return filtered;
  }

  let currentList = commands;

  function open(){
    lastFocused = document.activeElement;
    overlay.hidden = false;
    selected = 0;
    input.value = '';
    currentList = render('');
    requestAnimationFrame(() => {
      overlay.classList.add('is-open');
      input.focus();
    });
    document.body.style.overflow = 'hidden';
  }

  function close(){
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; }, 200);
    if (lastFocused) lastFocused.focus();
  }

  trigger.addEventListener('click', open);

  document.addEventListener('keydown', (e) => {
    const isK = e.key === 'k' || e.key === 'K';
    if ((e.metaKey || e.ctrlKey) && isK) {
      e.preventDefault();
      overlay.hidden ? open() : close();
    }
    if (e.key === 'Escape' && !overlay.hidden) close();
  });

  input.addEventListener('input', () => {
    selected = 0;
    currentList = render(input.value);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selected = Math.min(selected + 1, currentList.length - 1);
      render(input.value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selected = Math.max(selected - 1, 0);
      render(input.value);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = currentList[selected];
      if (cmd) { close(); cmd.action(); }
    }
  });

  list.addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const cmd = currentList[Number(li.dataset.index)];
    if (cmd) { close(); cmd.action(); }
  });

  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

/* ---------------------------------------------------------------------- */
/* DSA visualizer — tiny structure demos                                   */
/* ---------------------------------------------------------------------- */
function initDsaVisualizer(){
  const tabs = document.querySelectorAll('.dsa-tab');
  const stage = document.getElementById('dsaStage');
  if (!stage) return;

  const structures = {
    array: [4, 8, 2, 9, 5, 1],
    stack: [3, 6, 2, 7],
    linkedlist: [1, 2, 3, 4, 5]
  };

  function render(kind){
    const values = structures[kind];
    stage.innerHTML = values.map((v, i) => {
      const height = 34 + v * 7;
      return `<div class="dsa-cell" style="width:38px;height:${height}px;" data-i="${i}">${v}</div>`;
    }).join('');

    const cells = stage.querySelectorAll('.dsa-cell');
    let i = 0;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) return;
    clearInterval(stage._interval);
    stage._interval = setInterval(() => {
      cells.forEach((c) => c.classList.remove('is-active'));
      cells[i]?.classList.add('is-active');
      i = (i + 1) % cells.length;
    }, 700);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      render(tab.dataset.structure);
    });
  });

  render('array');
}

/* ---------------------------------------------------------------------- */
/* Activity heatmap placeholder (no fake data — empty cells only)          */
/* ---------------------------------------------------------------------- */
function initActivityHeatmap(){
  const el = document.getElementById('activityHeatmap');
  if (!el) return;
  const cellCount = 26 * 7;
  el.innerHTML = Array.from({ length: cellCount }, () => '<span></span>').join('');
}

/* ---------------------------------------------------------------------- */
/* Scroll cue                                                              */
/* ---------------------------------------------------------------------- */
function initScrollCue(){
  const cue = document.getElementById('scrollCue');
  if (!cue) return;
  cue.addEventListener('click', () => {
    document.getElementById('about')?.scrollIntoView({ behavior: 'smooth' });
  });
}
