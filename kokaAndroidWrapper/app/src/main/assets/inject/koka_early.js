(function () {
  try {
    sessionStorage.setItem('koka:booted', '1');
  } catch (_) {}

  if (window.__kokaEarlyBridgeInstalled) return;
  window.__kokaEarlyBridgeInstalled = true;

  var pendingPermResolvers = {};
  var nextPermReqId = 1;

  window.__kokaResolveNotifPermission = function (reqId, status) {
    var entry = pendingPermResolvers[reqId];
    if (!entry) return;
    delete pendingPermResolvers[reqId];
    try {
      if (typeof entry.cb === 'function') entry.cb(status);
    } catch (_) {}
    entry.resolve(status);
  };

  function getNativePermission() {
    try {
      if (window.KokaBridge && typeof window.KokaBridge.getNotificationPermission === 'function') {
        return String(window.KokaBridge.getNotificationPermission() || 'default');
      }
    } catch (_) {}
    return 'default';
  }

  function showNativeNotification(title, options) {
    try {
      if (window.KokaBridge && typeof window.KokaBridge.showNotification === 'function') {
        var opts = options || {};
        var body = typeof opts.body === 'string' ? opts.body : '';
        var tag = typeof opts.tag === 'string' ? opts.tag : '';
        var url = opts.data && typeof opts.data.url === 'string' ? opts.data.url : '/';
        window.KokaBridge.showNotification(String(title || 'Koka'), body, tag, url);
      }
    } catch (_) {}
  }

  function NativeNotification(title, options) {
    this.title = String(title || '');
    this.body = options && options.body ? String(options.body) : '';
    this.tag = options && options.tag ? String(options.tag) : '';
    this.data = options && options.data ? options.data : null;
    showNativeNotification(title, options);
  }

  NativeNotification.prototype.close = function () {};

  Object.defineProperty(NativeNotification, 'permission', {
    get: function () {
      return getNativePermission();
    },
    configurable: true
  });

  NativeNotification.requestPermission = function (callback) {
    return new Promise(function (resolve) {
      var bridge = window.KokaBridge;
      if (!bridge || typeof bridge.requestNotificationPermission !== 'function') {
        var current = getNativePermission();
        if (typeof callback === 'function') {
          try { callback(current); } catch (_) {}
        }
        resolve(current);
        return;
      }
      var id = String(nextPermReqId++);
      pendingPermResolvers[id] = { resolve: resolve, cb: callback };
      try {
        bridge.requestNotificationPermission(id);
      } catch (_) {
        delete pendingPermResolvers[id];
        resolve('denied');
      }
    });
  };

  try {
    Object.defineProperty(window, 'Notification', {
      value: NativeNotification,
      writable: true,
      configurable: true
    });
  } catch (_) {
    window.Notification = NativeNotification;
  }

  if (typeof window.ServiceWorkerRegistration !== 'undefined' && window.ServiceWorkerRegistration.prototype) {
    try {
      window.ServiceWorkerRegistration.prototype.showNotification = function (title, options) {
        showNativeNotification(title, options);
        return Promise.resolve();
      };
    } catch (_) {}
  }

  function mergeBackgroundNotifiedKeys() {
    try {
      var bridge = window.KokaBridge;
      if (!bridge || typeof bridge.consumeBackgroundNotifiedKeys !== 'function') return;
      var rawBg = bridge.consumeBackgroundNotifiedKeys();
      if (!rawBg) return;
      var bgKeys = JSON.parse(rawBg);
      if (!Array.isArray(bgKeys) || bgKeys.length === 0) return;
      var existingRaw = localStorage.getItem('koka_aired_notified');
      var existing = existingRaw ? JSON.parse(existingRaw) : [];
      if (!Array.isArray(existing)) existing = [];
      var set = {};
      for (var i = 0; i < existing.length; i++) set[existing[i]] = true;
      for (var j = 0; j < bgKeys.length; j++) {
        if (!set[bgKeys[j]]) {
          existing.push(bgKeys[j]);
          set[bgKeys[j]] = true;
        }
      }
      localStorage.setItem('koka_aired_notified', JSON.stringify(existing.slice(-400)));
    } catch (_) {}
  }

  function syncAiringStorageToNative() {
    try {
      var bridge = window.KokaBridge;
      if (!bridge || typeof bridge.onSyncAiringData !== 'function') return;
      var pending = localStorage.getItem('koka_airing_pending') || '{}';
      var notified = localStorage.getItem('koka_aired_notified') || '[]';
      bridge.onSyncAiringData(pending, notified);
    } catch (_) {}
  }

  window.__kokaSyncAiringStorage = syncAiringStorageToNative;

  try {
    var origSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      origSetItem.apply(this, arguments);
      if (this === window.localStorage && (key === 'koka_airing_pending' || key === 'koka_aired_notified')) {
        syncAiringStorageToNative();
      }
    };
  } catch (_) {}

  mergeBackgroundNotifiedKeys();
  syncAiringStorageToNative();
})();
