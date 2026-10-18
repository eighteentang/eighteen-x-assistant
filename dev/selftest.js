const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const root = require('node:path').resolve(__dirname, '..');
const config = require(require('node:path').join(root, 'config.js'));
const metrics = require(require('node:path').join(root, 'metrics-core.js'));
const filters = require(require('node:path').join(root, 'filter-core.js'));

assert.equal(config.normalizeKeywords('广告, 抽奖\n广告').length, 2);
assert.equal(config.normalizeKeywords('广告, 抽奖')[1], '抽奖');
assert.equal(config.mergeSettings({}).leaderboardOpacity, 0.1);
assert.equal(config.mergeSettings({ leaderboardOpacity: 2 }).leaderboardOpacity, 1);
assert.equal(config.mergeSettings({ leaderboardOpacity: -1 }).leaderboardOpacity, 0);
const legacySettings = config.mergeSettings({ velocityFilterEnabled: true, minVelocity: 500,
  maxEntitlement: false, entitlement: { status: 'inactive' } });
assert.equal(legacySettings.velocityFilterEnabled, true);
assert.equal(legacySettings.minVelocity, 500);
assert.equal(Object.hasOwn(legacySettings, 'maxEntitlement'), false);
assert.equal(Object.hasOwn(legacySettings, 'entitlement'), false);
assert.deepEqual(config.normalizeHandles('@Trusted, @TRUSTED\ninvalid-name'), ['trusted']);
assert.deepEqual(config.normalizeLanguages('zh-CN,en,und,!!!'), ['zh', 'en']);
const ruleSettings = config.mergeSettings({ keywords: ['广告'], languageFilterEnabled: true,
  velocityFilterEnabled: true, minVelocity: 1000, whitelist: ['@Trusted'] });
assert.equal(filters.reasons(ruleSettings, { text: '广告', author: 'trusted', language: 'fr', velocity: 1 }).length, 0);
assert.equal(filters.reasons(ruleSettings, { text: '广告', author: 'other', language: 'fr', velocity: 1 }).length, 3);
assert.equal(filters.reasons(config.mergeSettings({ languageFilterEnabled: true }), { language: 'und' }).length, 0);
assert.equal(filters.reasons(config.mergeSettings({ languageFilterEnabled: true }), { language: 'zh-Hant' }).length, 0);
assert.equal(filters.reasons(config.mergeSettings({ languageFilterEnabled: true, allowedLanguages: [] }), { language: 'fr' }).length, 0);
assert.equal(filters.reasons(config.mergeSettings({ enabled: false, keywords: ['广告'] }), { text: '广告' }).length, 0);
const payload = {
  data: {
    tweet_results: {
      result: {
        rest_id: '123',
        legacy: {
          created_at: 'Wed Sep 25 10:00:00 +0000 2026',
          full_text: '测试帖子',
          lang: 'en',
          favorite_count: 20,
          reply_count: 3,
          retweet_count: 4,
          bookmark_count: 2
        },
        views: { count: '1200' },
        core: { user_results: { result: { legacy: { screen_name: 'Author_One' } } } }
      }
    }
  }
};
const extracted = metrics.extractFromPayload(payload);
assert.equal(extracted.length, 1);
assert.equal(extracted[0].id, '123');
assert.equal(extracted[0].views, 1200);
assert.equal(extracted[0].likes, 20);
assert.equal(extracted[0].language, 'en');
assert.equal(extracted[0].author, 'Author_One');
assert.equal(metrics.velocity(extracted[0], Date.parse('Wed Sep 25 12:00:00 +0000 2026')), 600);
assert.equal(metrics.velocity({
  ...extracted[0],
  createdAt: Date.parse('Wed Sep 25 11:59:00 +0000 2026')
}, Date.parse('Wed Sep 25 12:00:00 +0000 2026')), 14400);
assert.equal(metrics.velocityTier(99).key, 'steady');
assert.equal(metrics.velocityTier(100).key, 'rising');
assert.equal(metrics.velocityTier(1000).key, 'accelerating');
assert.equal(metrics.velocityTier(5000).key, 'burst');
assert.equal(metrics.velocityTier(10000).key, 'viral');
assert.equal(metrics.velocityTier(10000).emoji, '☄️');

const source = fs.readFileSync(require('node:path').join(root, 'content.js'), 'utf8');
assert.match(source, /explainHost\.insertBefore\(badge, explainButton\)/);
assert.match(source, /button\.dataset\.tweetId = tweetId/);
assert.match(source, /findTweetTarget\(tweetId\)/);
assert.match(source, /width: 344px/);
assert.match(source, /--xa-board-opacity, \.1/);
assert.match(source, /value\.className = `\$\{BADGE_CLASS\} xa-board-value`/);
assert.match(source, /statusIdFromHref/);
assert.match(source, /leaderboardOpacity/);
assert.match(source, /button\.addEventListener\('pointerdown'/);
assert.match(source, /behavior: 'auto'/);
const mockElement = () => ({
  setAttribute() {},
  appendChild() {},
  replaceChildren() {},
  append() {},
  addEventListener() {},
  style: { setProperty() {} },
  dataset: {},
  className: '',
  textContent: '',
  innerHTML: ''
});
const context = {
  globalThis: {},
  XA_CONFIG: config,
  XA_METRICS: metrics,
  XA_FILTERS: filters,
  document: { querySelectorAll: () => [], getElementById: () => null, createElement: mockElement, head: { appendChild() {} }, documentElement: { appendChild() {} }, body: { appendChild() {} } },
  MutationObserver: class { observe() {} disconnect() {} },
  chrome: { storage: { local: { get: () => Promise.resolve({}), onChanged: { addListener() {} } }, onChanged: { addListener() {} } } },
  setTimeout,
  clearTimeout,
  Date,
  Number,
  Math,
  String,
  Object,
  Array,
  RegExp,
  URL,
  console
};
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.XA_TEST;
assert.equal(api.formatVelocity(1200), '1.2K/h');
assert.equal(api.formatVelocity(null), '流速未知');
assert.equal(api.statusIdFromHref('https://x.com/example/status/123?s=20'), '123');
assert.equal(api.statusIdFromHref('https://x.com/example/status/not-a-tweet'), '');

const cache = new Map();
metrics.cacheTweets(cache, extracted);
metrics.cacheTweets(cache, [{ id: '123', views: null, likes: 0, text: '' }]);
assert.equal(cache.get('123').views, 1200);
assert.equal(cache.get('123').createdAt, extracted[0].createdAt);
assert.equal(cache.get('123').likes, 0);
assert.equal(cache.get('123').text, '测试帖子');
metrics.cacheTweets(cache, [{ id: '123', views: 1500 }]);
assert.equal(cache.get('123').views, 1500);
assert.equal(metrics.cacheTweets(cache, { id: '123' }).length, 0);
assert.equal(metrics.cacheTweets(cache, [null, { id: 'bad-id' }]).length, 0);
for (let i = 0; i < 2100; i++) metrics.cacheTweets(cache, [{ id: String(10000 + i), views: i }]);
assert.equal(cache.size, 2000);
assert.equal(cache.has('10000'), false);
assert.equal(cache.get('12099').views, 2099);
const duplicate = metrics.extractFromPayload([payload, { result: {
  rest_id: '123', legacy: { ...payload.data.tweet_results.result.legacy }, views: {}
} }]);
assert.equal(duplicate[0].views, 1200);

console.log('X-Newfish self-test: all checks passed');
