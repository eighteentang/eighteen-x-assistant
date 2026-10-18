(() => {
  if (window.__xaNet) {
    window.__xaNet._resetSubs?.();
    return;
  }
  const responseSubs = [];

  function getUrl(input) {
    if (input instanceof Request) return input.url;
    if (input instanceof URL) return input.href;
    return typeof input === 'string' ? input : null;
  }

  function notify(list, url, payload) {
    if (!url) return;
    list.forEach((item) => {
      if (!item.matcher.test(url)) return;
      try { item.callback(payload); } catch (_) {}
    });
  }

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const url = getUrl(args[0]);
    const response = await originalFetch.apply(this, args);
    notify(responseSubs, url, { url, response, source: 'fetch' });
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xaNet = { url: String(url || '') };
    this.addEventListener('load', () => {
      const state = this.__xaNet;
      if (!state?.url) return;
      notify(responseSubs, state.url, {
        url: state.url,
        source: 'xhr',
        response: { status: this.status, text: () => Promise.resolve(this.responseText), json: () => Promise.resolve(JSON.parse(this.responseText)) }
      });
    });
    return originalOpen.call(this, method, url, ...rest);
  };
  window.__xaNet = {
    onResponse(matcher, callback) { responseSubs.push({ matcher, callback }); },
    _resetSubs() { responseSubs.length = 0; }
  };
})();
