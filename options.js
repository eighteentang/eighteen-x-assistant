(function initOptions() {
  const ids = ['enabled', 'keywordFilterEnabled', 'showVelocity', 'leaderboardEnabled', 'leaderboardOpacity', 'velocityFilterEnabled', 'minVelocity', 'keywords', 'whitelist', 'languageFilterEnabled', 'allowedLanguages'];
  let settings = XA_CONFIG.mergeSettings({});
  let saveRevision = 0;

  async function applyToPages() {
    if (!chrome.tabs?.query) return '已保存';
    const tabs = await chrome.tabs.query({ url: ['https://x.com/*', 'https://twitter.com/*'] });
    if (!tabs.length) return '已保存，打开 X 页面后生效。';
    const replies = await Promise.all(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, { type: 'XA_SETTINGS_APPLY' }).catch(() => null)));
    const ready = replies.filter((reply) => reply?.ready);
    if (ready.length !== tabs.length) return '已保存；部分 X 页面未响应。请在扩展管理页重新加载 X-Newfish，再刷新 X 页面。';
    const sum = (key) => ready.reduce((total, reply) => total + reply[key], 0);
    return `已生效：检测到 ${sum('total')} 条帖子，已过滤 ${sum('hidden')} 条；${sum('velocity')} 条有流速数据，${sum('language')} 条有语言信息。`;
  }

  function readForm() {
    return XA_CONFIG.mergeSettings({
      ...settings,
      enabled: document.querySelector('#enabled').checked,
      keywordFilterEnabled: document.querySelector('#keywordFilterEnabled').checked,
      showVelocity: document.querySelector('#showVelocity').checked,
      leaderboardEnabled: document.querySelector('#leaderboardEnabled').checked,
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
    document.querySelector('#leaderboardEnabled').checked = settings.leaderboardEnabled;
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
    const revision = ++saveRevision;
    settings = readForm();
    if (settings.languageFilterEnabled && !settings.allowedLanguages.length) {
      document.querySelector('#status').textContent = '请至少填写一种有效语言代码，例如 zh 或 en。';
      return;
    }
    const editable = Object.fromEntries(ids.map((id) => [id, settings[id]]));
    chrome.storage.local.set(editable).then(async () => {
      const status = document.querySelector('#status');
      const result = await applyToPages().catch(() => '已保存，暂时无法确认 X 页面是否生效，请刷新 X。');
      if (revision === saveRevision) status.textContent = result;
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
  ids.filter((id) => id !== 'leaderboardOpacity').forEach((id) =>
    document.querySelector(`#${id}`).addEventListener('change', save));
  document.querySelector('#leaderboardOpacity').addEventListener('input', () => {
    settings = readForm();
    document.querySelector('#leaderboardOpacityValue').textContent = `${Math.round(settings.leaderboardOpacity * 100)}%`;
    chrome.storage.local.set({ leaderboardOpacity: settings.leaderboardOpacity });
  });
})();
