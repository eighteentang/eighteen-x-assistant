(() => {
  if (window.__xaNet) {
    window.__xaNet._resetSubs?.();
    return;
  }
  const requestSubs = [];
  const responseSubs = [];
  let latestBearer = null;

  function getUrl(input) {
    if (input instanceof Request) return input.url;
    if (input instanceof URL) return input.href;
    return typeof input === 'string' ? input : null;
  }

  function normalize(headers) {
    const result = {};
    try {
      if (headers instanceof Headers) headers.forEach((value, key) => { result[key.toLowerCase()] = value; });
      else if (headers && typeof headers === 'object') Object.keys(headers).forEach((key) => { result[key.toLowerCase()] = headers[key]; });
    } catch (_) {}
    return result;
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
    const init = args[1] || {};
    const headers = normalize(init.headers || (args[0] instanceof Request ? args[0].headers : null));
    if (headers.authorization) latestBearer = headers.authorization;
    notify(requestSubs, url, { url, init, headers, source: 'fetch' });
    const response = await originalFetch.apply(this, args);
    notify(responseSubs, url, { url, response, source: 'fetch' });
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__xaNet = { method, url: String(url || ''), headers: {} };
    this.addEventListener('load', () => {
      const state = this.__xaNet;
      if (!state?.url) return;
      notify(requestSubs, state.url, { url: state.url, init: { method: state.method }, headers: state.headers, source: 'xhr' });
      notify(responseSubs, state.url, {
        url: state.url,
        source: 'xhr',
        response: { status: this.status, text: () => Promise.resolve(this.responseText), json: () => Promise.resolve(JSON.parse(this.responseText)) }
      });
    });
    return originalOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
    if (this.__xaNet) {
      this.__xaNet.headers[String(name).toLowerCase()] = value;
      if (String(name).toLowerCase() === 'authorization') latestBearer = value;
    }
    return originalSetRequestHeader.apply(this, arguments);
  };

  window.__xaNet = {
    originalFetch,
    onRequest(matcher, callback) { requestSubs.push({ matcher, callback }); },
    onResponse(matcher, callback) { responseSubs.push({ matcher, callback }); },
    getBearer() { return latestBearer; },
    _resetSubs() { requestSubs.length = 0; responseSubs.length = 0; }
  };
})();
