(function initFilters(global) {
  function keywordMatch(settings, text) {
    if (!settings.keywordFilterEnabled) return '';
    const value = String(text || '').toLowerCase();
    return settings.keywords.find((keyword) => value.includes(keyword.toLowerCase())) || '';
  }

  function reasons(settings, details) {
    if (!settings.enabled) return [];
    const author = String(details.author || '').toLowerCase();
    if (author && settings.whitelist.includes(author)) return [];
    const result = [];
    const keyword = keywordMatch(settings, details.text);
    if (keyword) result.push(`关键词：${keyword}`);
    const language = String(details.language || '').toLowerCase().split('-')[0];
    const knownLanguage = /^[a-z]{2,3}$/.test(language) && !['und', 'mul', 'zxx'].includes(language);
    if (settings.languageFilterEnabled && settings.allowedLanguages.length && knownLanguage &&
        !settings.allowedLanguages.includes(language)) result.push(`语言：${language}（未在允许列表中）`);
    if (settings.velocityFilterEnabled && Number.isFinite(details.velocity) &&
        details.velocity < Number(settings.minVelocity || 0)) result.push(`流速低于 ${settings.minVelocity}/h`);
    return result;
  }

  const api = Object.freeze({ keywordMatch, reasons });
  global.XA_FILTERS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
