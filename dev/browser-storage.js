// This storage substitute is only served by dev/browser-check.js.
window.auditSettings = {
  enabled: true, showVelocity: true, keywords: [], keywordFilterEnabled: true,
  velocityFilterEnabled: false, minVelocity: 0
};
const storageListeners = [];
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
} };
