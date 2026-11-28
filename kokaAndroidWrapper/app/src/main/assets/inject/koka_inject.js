(function () {
  try {
    sessionStorage.setItem('koka:booted', '1');
  } catch (_) {}

  if (window.__kokaNativeInitialized) {
    if (typeof window.__kokaSyncTheme === 'function') {
      window.__kokaSyncTheme();
    }
    if (typeof window.__kokaSyncAiringStorage === 'function') {
      window.__kokaSyncAiringStorage();
    }
    return;
  }
  window.__kokaNativeInitialized = true;

  var bridge = window.KokaBridge;
  var canvas = null;
  var ctx = null;

  function resolveCssColorToHex(cssColor, fallbackHex) {
    if (!cssColor || cssColor === 'transparent' || cssColor === 'rgba(0, 0, 0, 0)') {
      return fallbackHex;
    }
    try {
      if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        ctx = canvas.getContext('2d', { willReadFrequently: true });
      }
      if (!ctx) return fallbackHex;
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000000';
      ctx.fillStyle = cssColor;
      ctx.fillRect(0, 0, 1, 1);
      var d = ctx.getImageData(0, 0, 1, 1).data;
      if (d[3] === 0) return fallbackHex;
      var toHex = function (n) {
        return ('0' + n.toString(16)).slice(-2);
      };
      return '#' + toHex(d[0]) + toHex(d[1]) + toHex(d[2]);
    } catch (_) {
      return fallbackHex;
    }
  }

  function resolveTokenHex(varName, fallbackHex) {
    try {
      var probe = document.createElement('div');
      probe.style.position = 'fixed';
      probe.style.visibility = 'hidden';
      probe.style.pointerEvents = 'none';
      probe.style.backgroundColor = 'var(' + varName + ')';
      document.body.appendChild(probe);
      var computed = window.getComputedStyle(probe).backgroundColor;
      probe.remove();
      return resolveCssColorToHex(computed, fallbackHex);
    } catch (_) {
      return fallbackHex;
    }
  }

  function isDarkHex(hex) {
    try {
      var clean = hex.replace('#', '');
      if (clean.length !== 6) return true;
      var r = parseInt(clean.substring(0, 2), 16);
      var g = parseInt(clean.substring(2, 4), 16);
      var b = parseInt(clean.substring(4, 6), 16);
      var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance < 0.5;
    } catch (_) {
      return true;
    }
  }

  var lastThemeSig = '';
  function syncTheme() {
    if (!bridge || typeof bridge.onThemeChanged !== 'function') return;
    if (!document.body) return;

    var root = document.documentElement;
    var hasDarkClass = root.classList.contains('dark');
    var defaultBg = hasDarkClass ? '#191213' : '#faf9f6';
    var defaultSurface = hasDarkClass ? '#22191a' : '#fefefe';
    var defaultPrimary = hasDarkClass ? '#d66879' : '#3d90a0';

    var bodyBg = window.getComputedStyle(document.body).backgroundColor;
    var bgHex = resolveCssColorToHex(bodyBg, resolveTokenHex('--background', defaultBg));
    var surfaceHex = resolveTokenHex('--card', resolveTokenHex('--surface', defaultSurface));
    var primaryHex = resolveTokenHex('--primary', defaultPrimary);
    var isDark = hasDarkClass || isDarkHex(bgHex);

    var sig = bgHex + '|' + surfaceHex + '|' + primaryHex + '|' + isDark;
    if (sig !== lastThemeSig) {
      lastThemeSig = sig;
      bridge.onThemeChanged(bgHex, surfaceHex, primaryHex, isDark);
    }
  }
  window.__kokaSyncTheme = syncTheme;

  function hasOpenOverlay() {
    try {
      var selectors = [
        '[role="dialog"]',
        '[role="alertdialog"]',
        '[aria-modal="true"]',
        '[data-state="open"][role="menu"]',
        '[data-state="open"][data-radix-popper-content-wrapper]',
        '.fixed.inset-0.z-50',
        '.fixed.inset-0.z-40'
      ];
      for (var i = 0; i < selectors.length; i++) {
        var nodes = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < nodes.length; j++) {
          var el = nodes[j];
          if (el.getAttribute('aria-hidden') === 'true') continue;
          var style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity || '1') > 0.05) {
            if (el.tagName && el.tagName.toLowerCase() === 'nav') continue;
            return true;
          }
        }
      }
    } catch (_) {}
    return false;
  }

  var lastCanPull = null;
  function updatePullGate() {
    if (!bridge || typeof bridge.onPullToRefreshGateChanged !== 'function') return;
    var scrollTop = Math.max(
      window.scrollY || 0,
      document.documentElement ? document.documentElement.scrollTop : 0,
      document.body ? document.body.scrollTop : 0
    );
    var canPull = scrollTop <= 2 && !hasOpenOverlay();
    if (canPull !== lastCanPull) {
      lastCanPull = canPull;
      bridge.onPullToRefreshGateChanged(canPull);
    }
  }

  window.__kokaHandleBack = function () {
    if (!hasOpenOverlay()) {
      return 'NO_OVERLAY';
    }
    try {
      var escEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true
      });
      document.dispatchEvent(escEvent);
      window.dispatchEvent(escEvent);

      setTimeout(function () {
        if (!hasOpenOverlay()) {
          updatePullGate();
          return;
        }
        var closeBtn = document.querySelector(
          '[role="dialog"] button[aria-label*="Close" i], [aria-modal="true"] button[aria-label*="Close" i], .fixed.inset-0 button[aria-label*="Close" i]'
        );
        if (closeBtn) {
          closeBtn.click();
        } else {
          var backdrop = document.querySelector('.fixed.inset-0[aria-hidden="true"], .fixed.inset-0.bg-black\\/40, .fixed.inset-0.bg-black\\/50, .fixed.inset-0.bg-black\\/60');
          if (backdrop) backdrop.click();
        }
        setTimeout(updatePullGate, 120);
      }, 60);
      return 'DISMISSED_OVERLAY';
    } catch (_) {
      return 'NO_OVERLAY';
    }
  };

  var origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () {
    var href = this.getAttribute('href') || this.href || '';
    var downloadName = this.getAttribute('download') || '';
    if (bridge && typeof bridge.onBlobDownload === 'function' && (href.indexOf('blob:') === 0 || (href.indexOf('data:') === 0 && downloadName))) {
      var fileName = downloadName || ('koka-export-' + Date.now());
      if (href.indexOf('data:') === 0) {
        var commaIdx = href.indexOf(',');
        var meta = commaIdx > 0 ? href.substring(5, commaIdx) : 'application/octet-stream';
        var mime = meta.split(';')[0] || 'application/octet-stream';
        var payload = commaIdx > 0 ? href.substring(commaIdx + 1) : '';
        var isBase64 = meta.indexOf(';base64') !== -1;
        bridge.onBlobDownload(fileName, mime, isBase64 ? payload : btoa(unescape(encodeURIComponent(decodeURIComponent(payload)))));
        return;
      }
      fetch(href)
        .then(function (res) { return res.blob(); })
        .then(function (blob) {
          var reader = new FileReader();
          reader.onloadend = function () {
            var result = typeof reader.result === 'string' ? reader.result : '';
            var idx = result.indexOf(',');
            if (idx > 0) {
              var b64 = result.substring(idx + 1);
              bridge.onBlobDownload(fileName, blob.type || 'application/octet-stream', b64);
            }
          };
          reader.readAsDataURL(blob);
        })
        .catch(function () {
          origClick.apply(this, arguments);
        });
      return;
    }
    return origClick.apply(this, arguments);
  };

  var themeRaf = null;
  function scheduleSync() {
    if (themeRaf) cancelAnimationFrame(themeRaf);
    themeRaf = requestAnimationFrame(function () {
      syncTheme();
      updatePullGate();
    });
  }

  window.addEventListener('scroll', updatePullGate, { passive: true });
  window.addEventListener('touchstart', updatePullGate, { passive: true });
  window.addEventListener('popstate', scheduleSync, { passive: true });

  var rootObserver = new MutationObserver(scheduleSync);
  rootObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme']
  });

  if (document.body) {
    var bodyObserver = new MutationObserver(updatePullGate);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
  }

  scheduleSync();
  setTimeout(scheduleSync, 350);
  setTimeout(function () {
    scheduleSync();
    if (typeof window.__kokaSyncAiringStorage === 'function') {
      window.__kokaSyncAiringStorage();
    }
  }, 1500);
})();
