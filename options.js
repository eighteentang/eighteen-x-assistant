(function initOptions() {
  const ids = ['enabled', 'keywordFilterEnabled', 'showVelocity', 'leaderboardOpacity', 'velocityFilterEnabled', 'minVelocity', 'keywords'];
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
      keywords: XA_CONFIG.normalizeKeywords(document.querySelector('#keywords').value)
    });
  }

  function render() {
    document.querySelector('#enabled').checked = settings.enabled;
    document.querySelector('#keywordFilterEnabled').checked = settings.keywordFilterEnabled;
    document.querySelector('#showVelocity').checked = settings.showVelocity;
    document.querySelector('#leaderboardOpacity').value = settings.leaderboardOpacity;
    document.querySelector('#leaderboardOpacityValue').textContent = `${Math.round(settings.leaderboardOpacity * 100)}%`;
    document.querySelector('#velocityFilterEnabled').checked = settings.velocityFilterEnabled;
    document.querySelector('#minVelocity').value = settings.minVelocity;
    document.querySelector('#keywords').value = settings.keywords.join('\n');
    const max = settings.maxEntitlement && settings.entitlement.status === 'active';
    document.querySelector('#maxStatus').textContent = max ? '当前状态：MAX 已激活' : '当前状态：免费版';
  }

  function save() {
    settings = readForm();
    chrome.storage.local.set(settings).then(() => {
      const status = document.querySelector('#status');
      status.textContent = '已保存';
      setTimeout(() => { status.textContent = ''; }, 1600);
    });
  }

  chrome.storage.local.get(XA_CONFIG.DEFAULTS).then((stored) => {
    settings = XA_CONFIG.mergeSettings(stored);
    render();
  });
  document.querySelector('#save').addEventListener('click', save);
  ids.forEach((id) => document.querySelector(`#${id}`).addEventListener('change', () => { settings = readForm(); }));
  document.querySelector('#leaderboardOpacity').addEventListener('input', () => {
    settings = readForm();
    document.querySelector('#leaderboardOpacityValue').textContent = `${Math.round(settings.leaderboardOpacity * 100)}%`;
    chrome.storage.local.set({ leaderboardOpacity: settings.leaderboardOpacity });
  });
})();
