/* ═══════════════════════════════════════════════════════════════════════════
   PROFITLORD — VISUAL UPGRADE ENHANCER
   File: /ui/visual-upgrade.js
   Role: Non-destructive DOM enhancer — ONLY visual. No logic, no API calls.

   Exposes:
     window.PLT_VISUAL_MODE          — true/false
     window.PLT_DISABLE_VISUALS()    — instantly disable all enhancements
     window.PLT_ENABLE_VISUALS()     — re-enable enhancements
   ═══════════════════════════════════════════════════════════════════════════ */
;(function () {
  'use strict';

  /* ── 1. GLOBAL TOGGLE ─────────────────────────────────────────────────── */
  window.PLT_VISUAL_MODE = true;

  window.PLT_DISABLE_VISUALS = function () {
    window.PLT_VISUAL_MODE = false;
    document.body.classList.add('plt-visual-disabled');
    if (_raf) { cancelAnimationFrame(_raf); _raf = null; }
  };

  window.PLT_ENABLE_VISUALS = function () {
    window.PLT_VISUAL_MODE = true;
    document.body.classList.remove('plt-visual-disabled');
    _startParticles();
  };

  /* ── 2. HELPERS ──────────────────────────────────────────────────────── */
  function _el(id)  { return document.getElementById(id); }
  function _qs(sel) { return document.querySelector(sel); }
  function _qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

  function _safeWrap(el, wrapperEl) {
    if (!el || !wrapperEl) return;
    if (el.parentNode) el.parentNode.insertBefore(wrapperEl, el);
    wrapperEl.appendChild(el);
  }

  /* ── 3. DEPTH GRID ───────────────────────────────────────────────────── */
  function _addDepthGrid() {
    if (document.querySelector('.plt-depth-grid')) return;
    var grid = document.createElement('div');
    grid.className = 'plt-depth-grid';
    document.body.insertBefore(grid, document.body.firstChild);
  }

  /* ── 4. PARTICLE CANVAS ──────────────────────────────────────────────── */
  var _raf = null;
  var _canvas = null;
  var _ctx    = null;
  var _particles = [];

  var PARTICLE_COUNT = 28;

  function _initParticles() {
    if (document.querySelector('.plt-particle-canvas')) return;

    _canvas = document.createElement('canvas');
    _canvas.className = 'plt-particle-canvas';
    document.body.insertBefore(_canvas, document.body.firstChild);

    _ctx = _canvas.getContext('2d');
    _resizeCanvas();
    window.addEventListener('resize', _resizeCanvas, { passive: true });

    _particles = [];
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      _particles.push(_makeParticle());
    }
    _startParticles();
  }

  function _resizeCanvas() {
    if (!_canvas) return;
    _canvas.width  = window.innerWidth;
    _canvas.height = window.innerHeight;
  }

  function _makeParticle() {
    var colors = [
      'rgba(0,229,255,',
      'rgba(255,0,255,',
      'rgba(0,255,65,',
      'rgba(255,215,0,'
    ];
    return {
      x:     Math.random() * window.innerWidth,
      y:     Math.random() * window.innerHeight,
      r:     0.5 + Math.random() * 1.5,
      vx:    (Math.random() - 0.5) * 0.25,
      vy:    (Math.random() - 0.5) * 0.25,
      alpha: 0.1 + Math.random() * 0.4,
      color: colors[Math.floor(Math.random() * colors.length)]
    };
  }

  function _startParticles() {
    if (_raf) cancelAnimationFrame(_raf);
    if (!_canvas || !_ctx) return;

    function tick() {
      if (!window.PLT_VISUAL_MODE) return;
      _ctx.clearRect(0, 0, _canvas.width, _canvas.height);

      for (var i = 0; i < _particles.length; i++) {
        var p = _particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = _canvas.width;
        if (p.x > _canvas.width)  p.x = 0;
        if (p.y < 0) p.y = _canvas.height;
        if (p.y > _canvas.height) p.y = 0;

        _ctx.beginPath();
        _ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        _ctx.fillStyle = p.color + p.alpha + ')';
        _ctx.fill();
      }
      _raf = requestAnimationFrame(tick);
    }
    _raf = requestAnimationFrame(tick);
  }

  /* ── 5. PANEL ENHANCEMENTS ───────────────────────────────────────────── */
  function _enhancePanels() {
    _qsa('.panel').forEach(function (panel) {
      if (panel.dataset.pltEnhanced) return;
      panel.dataset.pltEnhanced = '1';
      panel.classList.add('plt-panel');

      /* scan line */
      var scan = document.createElement('div');
      scan.className = 'plt-scan-line';
      panel.appendChild(scan);

      /* edge glow */
      var edge = document.createElement('div');
      edge.className = 'plt-edge-glow';
      panel.appendChild(edge);
    });
  }

  /* ── 6. PLT MODULE RINGS ─────────────────────────────────────────────── */
  function _enhancePLTFormula() {
    /* Works on dashboard.html eco-formula and nreal NSV law element */
    var selectors = [
      '.eco-formula',
      '[style*="Profit"]',        /* catch inline-styled spans */
    ];

    /* Target the eco-formula spans directly */
    _qsa('.eco-formula span').forEach(function (span) {
      if (span.dataset.pltRing) return;
      var txt = span.textContent.trim().toLowerCase();
      var cls = '';
      if (txt === 'profit') cls = 'plt-ring-profit';
      if (txt === 'love')   cls = 'plt-ring-love';
      if (txt === 'tax')    cls = 'plt-ring-tax';
      if (!cls) return;

      span.dataset.pltRing = '1';
      var wrap = document.createElement('span');
      wrap.className = 'plt-ring-wrap ' + cls;
      _safeWrap(span, wrap);
    });

    /* nreal.html: inline styled spans inside NSV LAW block */
    _qsa('[style*="color:var(--green)"], [style*="color:var(--magenta)"], [style*="color:var(--red)"]')
      .forEach(function (span) {
        if (span.dataset.pltRing) return;
        var txt = span.textContent.trim().toLowerCase();
        var cls = '';
        if (txt === 'profit') cls = 'plt-ring-profit';
        if (txt === 'love')   cls = 'plt-ring-love';
        if (txt === 'tax')    cls = 'plt-ring-tax';
        if (!cls) return;

        span.dataset.pltRing = '1';
        var wrap = document.createElement('span');
        wrap.className = 'plt-ring-wrap ' + cls;
        _safeWrap(span, wrap);
      });
  }

  /* ── 7. HUD ELEMENTS ─────────────────────────────────────────────────── */
  function _enhanceHUD() {
    /* Add .plt-node to eco-val items */
    _qsa('.eco-val').forEach(function (v) {
      v.classList.add('plt-node');
    });

    /* Add .plt-energy to live status dot */
    var dot = _el('status-dot');
    if (dot) dot.classList.add('plt-energy');

    /* Add .plt-scan to scan ticker label */
    var tickerLabel = _qs('.ticker-label');
    if (tickerLabel) tickerLabel.classList.add('plt-scan');

    /* Add .plt-glow to header logo */
    var logo = _qs('.hdr-logo');
    if (logo) logo.classList.add('plt-glow');

    /* Add .plt-hud to cmd-area textareas / inputs */
    _qsa('.hud-textarea, .hud-input').forEach(function (inp) {
      inp.classList.add('plt-hud');
    });
  }

  /* ── 8. BOT CARD ENHANCEMENTS ────────────────────────────────────────── */
  function _enhanceBotCards() {
    _qsa('.bot-card').forEach(function (card) {
      if (card.dataset.pltCard) return;
      card.dataset.pltCard = '1';
      card.classList.add('plt-node');
    });
  }

  /* ── 9. LEADERBOARD ENHANCEMENTS ─────────────────────────────────────── */
  function _enhanceLB() {
    _qsa('.lb-row').forEach(function (row) {
      if (row.dataset.pltLB) return;
      row.dataset.pltLB = '1';
      row.classList.add('plt-node');
    });
  }

  /* ── 10. RE-APPLY on dynamic DOM updates ────────────────────────────── */
  function _reApply() {
    if (!window.PLT_VISUAL_MODE) return;
    _enhancePanels();
    _enhancePLTFormula();
    _enhanceBotCards();
    _enhanceLB();
  }

  /* MutationObserver to catch dynamically added cards/rows */
  var _observer = null;
  function _watchDOM() {
    if (_observer) return;
    _observer = new MutationObserver(function (mutations) {
      var relevant = mutations.some(function (m) {
        return m.addedNodes.length > 0;
      });
      if (relevant) _reApply();
    });
    _observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ── 11. BOOT ─────────────────────────────────────────────────────────── */
  function _boot() {
    if (!window.PLT_VISUAL_MODE) return;

    _addDepthGrid();
    _initParticles();
    _enhancePanels();
    _enhancePLTFormula();
    _enhanceHUD();
    _enhanceBotCards();
    _enhanceLB();
    _watchDOM();
  }

  /* Boot when DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _boot);
  } else {
    /* DOM already parsed */
    _boot();
  }

})();
