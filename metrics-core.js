(function initMetricsCore(global) {
  const MIN_VELOCITY_AGE_MS = 5 * 60 * 1000;
  const VELOCITY_TIERS = Object.freeze([
    Object.freeze({ key: 'steady', label: '平稳', emoji: '🌱', min: 0, max: 100 }),
    Object.freeze({ key: 'rising', label: '起量', emoji: '↗️', min: 100, max: 1000 }),
    Object.freeze({ key: 'accelerating', label: '加速', emoji: '📈', min: 1000, max: 5000 }),
    Object.freeze({ key: 'burst', label: '爆发', emoji: '🚀', min: 5000, max: 10000 }),
    Object.freeze({ key: 'viral', label: '出圈', emoji: '☄️', min: 10000, max: Infinity })
  ]);

  function parseCount(value) {
    if (value === null || value === undefined || value === '') return null;
    const text = String(value).trim().toLowerCase().replace(/,/g, '');
    const match = text.match(/([\d.]+)\s*([km万亿])?/i);
    if (!match) return null;
    const number = Number(match[1]);
    if (!Number.isFinite(number)) return null;
    const multiplier = {
      k: 1000,
      m: 1000000,
      万: 10000,
      亿: 100000000
    }[match[2]] || 1;
    return Math.round(number * multiplier);
  }

  function parseDate(value) {
    const time = Date.parse(String(value || ''));
    return Number.isFinite(time) ? time : null;
  }

  function asNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const parsed = parseCount(value);
    return parsed === null ? null : parsed;
  }

  function normalizeTweet(node) {
    const legacy = node?.legacy;
    if (!node || !legacy || typeof legacy !== 'object') return null;
    const id = String(node.rest_id || legacy.id_str || '');
    const createdAt = parseDate(legacy.created_at);
    // User objects also have rest_id/legacy.created_at; they are not tweets.
    if (!/^\d+$/.test(id) || (!Object.hasOwn(legacy, 'full_text') && node.__typename !== 'Tweet')) return null;
    const views = asNumber(node.views?.count ?? legacy.views?.count);
    const user = node.core?.user_results?.result;
    return {
      id,
      createdAt,
      views,
      comments: asNumber(legacy.reply_count),
      reposts: asNumber(legacy.retweet_count),
      likes: asNumber(legacy.favorite_count),
      bookmarks: asNumber(legacy.bookmark_count),
      text: String(legacy.full_text || ''),
      language: String(legacy.lang || ''),
      author: String(user?.legacy?.screen_name || user?.core?.screen_name || '')
    };
  }

  function extractFromPayload(payload) {
    const result = new Map();
    const seen = new Set();
    function walk(value) {
      if (!value || typeof value !== 'object' || seen.has(value)) return;
      seen.add(value);
      const tweet = normalizeTweet(value);
      if (tweet) result.set(tweet.id, mergeTweet(result.get(tweet.id), tweet));
      if (Array.isArray(value)) {
        value.forEach(walk);
      } else {
        Object.keys(value).forEach((key) => walk(value[key]));
      }
    }
    walk(payload);
    return [...result.values()];
  }

  function mergeTweet(previous, next) {
    const merged = { ...previous, id: String(next.id) };
    for (const key of ['createdAt', 'views', 'comments', 'reposts', 'likes', 'bookmarks']) {
      const value = next[key];
      if (Number.isFinite(value) && value >= 0) merged[key] = value;
      else if (merged[key] === undefined) merged[key] = null;
    }
    merged.text = next.text || previous?.text || '';
    merged.language = next.language || previous?.language || '';
    merged.author = next.author || previous?.author || '';
    return merged;
  }

  function cacheTweets(cache, tweets) {
    if (!Array.isArray(tweets)) return [];
    const updated = [];
    for (const tweet of tweets) {
      if (!tweet || !/^\d+$/.test(String(tweet.id || ''))) continue;
      const id = String(tweet.id);
      const merged = mergeTweet(cache.get(id), tweet);
      cache.delete(id);
      cache.set(id, merged);
      updated.push(merged);
    }
    while (cache.size > 2000) cache.delete(cache.keys().next().value);
    return updated;
  }

  function parseResponseText(text) {
    const value = String(text || '').trim();
    if (!value) return [];
    try {
      return extractFromPayload(JSON.parse(value));
    } catch (_) {
      return value.split(/\r?\n/).flatMap((line) => {
        try { return extractFromPayload(JSON.parse(line)); } catch (_) { return []; }
      });
    }
  }

  function velocity(metric, now = Date.now()) {
    if (!metric || !Number.isFinite(metric.views) || !Number.isFinite(metric.createdAt)) return null;
    const ageHours = Math.max((now - metric.createdAt) / 3600000, MIN_VELOCITY_AGE_MS / 3600000);
    return Math.max(0, Math.round(metric.views / ageHours));
  }

  function velocityTier(value) {
    if (!Number.isFinite(value) || value < 0) return null;
    return VELOCITY_TIERS.find((tier) => value < tier.max) || VELOCITY_TIERS[VELOCITY_TIERS.length - 1];
  }

  function formatCount(value) {
    if (!Number.isFinite(value)) return '未知';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(value);
  }

  function formatVelocity(value) {
    if (!Number.isFinite(value)) return '流速未知';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M/h`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K/h`;
    return `${value}/h`;
  }

  const api = Object.freeze({
    parseCount,
    normalizeTweet,
    mergeTweet,
    cacheTweets,
    extractFromPayload,
    parseResponseText,
    velocity,
    velocityTier,
    VELOCITY_TIERS,
    formatCount,
    formatVelocity
  });
  global.XA_METRICS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
