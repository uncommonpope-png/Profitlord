/**
 * PROFITLORD — Visual Upgrade Engine  (ui/visual-upgrade.js)
 * ============================================================
 * NON-DESTRUCTIVE visual enhancement only.
 *
 * Rules:
 *  - Never modifies logic, data, API calls, or event handlers.
 *  - Only adds CSS classes and lightweight DOM wrappers.
 *  - Controlled by  window.PLT_VISUAL_MODE  (default: true).
 *  - If PLT_VISUAL_MODE is falsy, all enhancements are disabled instantly
 *    by removing the "plt-enhanced" class from <body>.
 *
 * Public API:
 *   window.PLT_VISUAL_MODE = false;   // disable all enhancements
 *   window.PLT_VISUAL_MODE = true;    // re-enable
 *   window.pltVisual.toggle();        // convenience toggle
 */
(function pltVisualUpgrade() {
  'use strict';

  // ── 1. Guard ──────────────────────────────────────────────────────────────
  if (window.PLT_VISUAL_MODE === false) return;
  if (typeof window.PLT_VISUAL_MODE === 'undefined') {
    window.PLT_VISUAL_MODE = true;
  }

  // ── 2. Helpers ────────────────────────────────────────────────────────────
  function q(sel)  { return document.querySelector(sel); }
  function qa(sel) { return Array.from(document.querySelectorAll(sel)); }

  function addDecoration(container, tag, cls) {
    if (!container) return;
    if (container.querySelector('.' + cls.split(' ')[0])) return;
    var el = document.createElement(tag);
    el.className = cls;
    container.appendChild(el);
  }

  // ── 3. Apply body class ───────────────────────────────────────────────────
  document.body.classList.add('plt-enhanced');

  // ── 4. Vignette layer ─────────────────────────────────────────────────────
  var app = q('#app');
  if (app) addDecoration(app, 'div', 'plt-vignette');

  // ── 5. Panel enhancements ─────────────────────────────────────────────────
  qa('.panel').forEach(function(panel) {
    addDecoration(panel, 'span', 'plt-edge-top');
    panel.classList.add('plt-hud');
  });

  // ── 6. Economy bar — PLT module visual upgrade ────────────────────────────
  var ecoFormula = q('.eco-formula');
  if (ecoFormula) {
    ecoFormula.querySelectorAll('span').forEach(function(span) {
      var text = span.textContent.trim().toLowerCase();
      if (text === 'profit') span.classList.add('plt-profit-node');
      else if (text === 'love') span.classList.add('plt-love-node');
      else if (text === 'tax') span.classList.add('plt-tax-node');
    });
  }

  var nsvStat = q('.eco-stat.nsv');
  if (nsvStat) nsvStat.classList.add('plt-energy', 'plt-hud');

  var ptsStat = q('.eco-stat.money');
  if (ptsStat) ptsStat.classList.add('plt-scan');

  // ── 7. Scan ticker ────────────────────────────────────────────────────────
  var scanTicker = q('.scan-ticker');
  if (scanTicker) scanTicker.classList.add('plt-scan', 'plt-hud');

  // ── 8. Main panels — glass + depth ────────────────────────────────────────
  qa('main .panel').forEach(function(panel) {
    panel.classList.add('plt-glass', 'plt-depth');
  });

  // ── 9. Leaderboard & bot NSV highlights ───────────────────────────────────
  function enhanceDynamic() {
    qa('.lb-nsv').forEach(function(el) {
      el.classList.add('plt-profit-node');
    });
    qa('.bot-nsv').forEach(function(el) {
      el.classList.add('plt-node');
    });
  }
  enhanceDynamic();

  // ── 10. MutationObserver — keep enhancements on dynamic content ───────────
  var observer = new MutationObserver(function(mutations) {
    var added = mutations.some(function(m) { return m.addedNodes.length > 0; });
    if (!added) return;
    qa('.panel').forEach(function(panel) {
      if (!panel.querySelector('.plt-edge-top')) {
        addDecoration(panel, 'span', 'plt-edge-top');
        panel.classList.add('plt-hud', 'plt-glass', 'plt-depth');
      }
    });
    enhanceDynamic();
  });
  observer.observe(q('#app') || document.body, { childList: true, subtree: true });

  // ── 11. requestAnimationFrame — gentle NSV brightness pulse ───────────────
  var _rafId = null;
  var _lastTick = 0;
  var RAF_INTERVAL = 2000;

  function visualTick(ts) {
    _rafId = requestAnimationFrame(visualTick);
    if (ts - _lastTick < RAF_INTERVAL) return;
    _lastTick = ts;
    var nsvEl = document.getElementById('eco-nsv');
    if (nsvEl) {
      var v = parseFloat(nsvEl.textContent);
      if (!isNaN(v) && v > 0) {
        nsvEl.style.filter = 'brightness(' + Math.min(1 + v / 5000, 1.6).toFixed(2) + ')';
      }
    }
  }
  _rafId = requestAnimationFrame(visualTick);

  // ── 12. Public API ────────────────────────────────────────────────────────
  window.pltVisual = {
    setMode: function(on) {
      window.PLT_VISUAL_MODE = !!on;
      if (on) {
        document.body.classList.add('plt-enhanced');
        if (!_rafId) _rafId = requestAnimationFrame(visualTick);
      } else {
        document.body.classList.remove('plt-enhanced');
        if (_rafId) { cancelAnimationFrame(_rafId); _rafId = null; }
        var nsvEl = document.getElementById('eco-nsv');
        if (nsvEl) nsvEl.style.filter = '';
      }
    },
    toggle: function() { this.setMode(!window.PLT_VISUAL_MODE); },
    isEnabled: function() { return !!window.PLT_VISUAL_MODE; },
  };

})();
