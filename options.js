(function initOptions() {
  const ids = ['enabled', 'keywordFilterEnabled', 'showVelocity', 'leaderboardOpacity', 'velocityFilterEnabled', 'minVelocity', 'keywords', 'whitelist', 'languageFilterEnabled', 'allowedLanguages'];
  let settings = XA_CONFIG.mergeSettings({});

  function readForm() {
    return XA_CONFIG.mergeSettings({
      ...settings,
      enabled: document.querySelector('#enabled').checked,
      keywordFilterEnabled: document.querySelector('#keywordFilterEnabled').checked,
      showVelocity: document.querySelector('#showVelocity').checked,
      leaderboardOpacity: Number(document.querySelector('#leaderboardOpacity').value),
      velocityFilterEnabled: document.querySelector('#velocityFilterEnabled').checked,
      minVelocity: Math.max(0, Number(document.querySelector('#minVelocity').value || 0)),
      keywords: XA_CONFIG.normalizeKeywords(document.querySelector('#keywords').value),
      whitelist: XA_CONFIG.normalizeHandles(document.querySelector('#whitelist').value),
      languageFilterEnabled: document.querySelector('#languageFilterEnabled').checked,
      allowedLanguages: XA_CONFIG.normalizeLanguages(document.querySelector('#allowedLanguages').value)
    });
  }

  function render() {
    document.querySelector('#enabled').checked = settings.enabled;
    document.querySelector('#keywordFilterEnabled').checked = settings.keywordFilterEnabled;
    document.querySelector('#showVelocity').checked = settings.showVelocity;
    document.querySelector('#leaderboardOpacity').value = settings.leaderboardOpacity;
    document.querySelector('#leaderboardOpacityValue').textContent = `${Math.round(settings.leaderboardOpacity * 100)}%`;
    document.querySelector('#minVelocity').value = settings.minVelocity;
    document.querySelector('#keywords').value = settings.keywords.join('\n');
    document.querySelector('#velocityFilterEnabled').checked = settings.velocityFilterEnabled;
    document.querySelector('#whitelist').value = settings.whitelist.map((handle) => `@${handle}`).join('\n');
    document.querySelector('#languageFilterEnabled').checked = settings.languageFilterEnabled;
    document.querySelector('#allowedLanguages').value = settings.allowedLanguages.join('\n');
  }

  function save() {
    settings = readForm();
    if (settings.languageFilterEnabled && !settings.allowedLanguages.length) {
      document.querySelector('#status').textContent = '请至少填写一种有效语言代码，例如 zh 或 en。';
      return;
    }
    const editable = Object.fromEntries(ids.map((id) => [id, settings[id]]));
    chrome.storage.local.set(editable).then(() => {
      const status = document.querySelector('#status');
      status.textContent = '已保存';
      setTimeout(() => { status.textContent = ''; }, 1600);
    }).catch(() => { document.querySelector('#status').textContent = '保存失败，请重试。'; });
  }

  chrome.storage.local.get(XA_CONFIG.DEFAULTS).then((stored) => {
    settings = XA_CONFIG.mergeSettings(stored);
    render();
  });
  document.querySelector('#save').addEventListener('click', save);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.whitelist) return;
    settings = XA_CONFIG.mergeSettings({ ...settings, whitelist: changes.whitelist.newValue });
    if (document.activeElement !== document.querySelector('#whitelist')) {
      document.querySelector('#whitelist').value = settings.whitelist.map((handle) => `@${handle}`).join('\n');
    }
  });
  ids.forEach((id) => document.querySelector(`#${id}`).addEventListener('change', () => { settings = readForm(); }));
  document.querySelector('#leaderboardOpacity').addEventListener('input', () => {
    settings = readForm();
    document.querySelector('#leaderboardOpacityValue').textContent = `${Math.round(settings.leaderboardOpacity * 100)}%`;
    chrome.storage.local.set({ leaderboardOpacity: settings.leaderboardOpacity });
  });
})();
