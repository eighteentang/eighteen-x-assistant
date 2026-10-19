// This storage substitute is only served by dev/browser-check.js.
window.auditSettings = {
  enabled: true, showVelocity: true, keywords: [], keywordFilterEnabled: true,
  velocityFilterEnabled: false, minVelocity: 0
};
const storageListeners = [];
const messageListeners = [];
window.chrome = { storage: {
  onChanged: { addListener(listener) { storageListeners.push(listener); } },
  local: {
    get(defaults) { return Promise.resolve({ ...defaults, ...window.auditSettings }); },
    set(next) {
      const changes = {};
      for (const [key, value] of Object.entries(next)) {
        changes[key] = { oldValue: window.auditSettings[key], newValue: value };
        window.auditSettings[key] = value;
      }
      storageListeners.forEach((listener) => listener(changes, 'local'));
      const output = document.getElementById('audit-storage');
      if (output) output.textContent = JSON.stringify(window.auditSettings, null, 2);
      return Promise.resolve();
    }
  }
}, runtime: {
  onMessage: { addListener(listener) { messageListeners.push(listener); } },
  sendMessage(message) {
    return new Promise((resolve) => {
      if (!messageListeners.some((listener) => listener(message, {}, resolve) === true)) resolve(undefined);
    });
  }
} };

// Read-only layout/CSS checks, enabled only for the local popup fixture.
if (location.pathname === '/options' && new URLSearchParams(location.search).has('check')) {
  window.addEventListener('load', () => {
    const sheet = [...document.styleSheets].find((item) => item.href?.endsWith('/options.css'));
    const selectors = [...(sheet?.cssRules || [])].map((rule) => rule.selectorText).filter(Boolean);
    const expected = ['.app', '.tabs', '.panels', '.app-footer', '[hidden]', '.switch::before', 'fieldset:disabled', '.status[data-state="error"]'];
    const output = document.createElement('pre'); output.id = 'popup-css-report';
    output.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere';
    output.textContent = JSON.stringify({ cssRules: sheet?.cssRules.length || 0,
      missing: expected.filter((selector) => !selectors.includes(selector)),
      appWidth: Math.round(document.querySelector('.app').getBoundingClientRect().width),
      appHeight: Math.round(document.querySelector('.app').getBoundingClientRect().height),
      hiddenPanelDisplay: getComputedStyle(document.querySelector('#panel-filters')).display }, null, 2);
    document.body.append(output);
  });
}
