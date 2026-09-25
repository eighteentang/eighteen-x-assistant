const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const root = require('node:path').resolve(__dirname, '..');
const config = require(require('node:path').join(root, 'config.js'));
const metrics = require(require('node:path').join(root, 'metrics-core.js'));
const style = require(require('node:path').join(root, 'style-profile.js'));

assert.equal(config.normalizeKeywords('广告, 抽奖\n广告').length, 2);
assert.equal(config.normalizeKeywords('广告, 抽奖')[1], '抽奖');
assert.equal(config.mergeSettings({}).leaderboardOpacity, 0.1);
assert.equal(config.mergeSettings({ leaderboardOpacity: 2 }).leaderboardOpacity, 1);
assert.equal(config.mergeSettings({ leaderboardOpacity: -1 }).leaderboardOpacity, 0);
assert.equal(config.hasEntitlement(config.mergeSettings({ maxEntitlement: true, entitlement: { status: 'active', entitlements: ['velocity_badge'] } }), 'velocity_badge'), true);
assert.equal(config.hasEntitlement(config.mergeSettings({ maxEntitlement: true, entitlement: { status: 'inactive', entitlements: ['velocity_badge'] } }), 'velocity_badge'), false);
const styleStore = style.addSample(style.defaultStore(), '关键不在工具，而在执行频率。', { context: '测试帖子' });
assert.equal(styleStore.profile.sampleCount, 1);
assert.equal(styleStore.profile.tags.includes('短句'), true);
assert.match(style.buildPrompt({ tweetText: '如何提高效率？', store: styleStore }), /执行频率/);
const payload = {
  data: {
    tweet_results: {
      result: {
        rest_id: '123',
        legacy: {
          created_at: 'Wed Sep 25 10:00:00 +0000 2026',
          full_text: '测试帖子',
          favorite_count: 20,
          reply_count: 3,
          retweet_count: 4,
          bookmark_count: 2
        },
        views: { count: '1200' }
      }
    }
  }
};
const extracted = metrics.extractFromPayload(payload);
assert.equal(extracted.length, 1);
assert.equal(extracted[0].id, '123');
assert.equal(extracted[0].views, 1200);
assert.equal(extracted[0].likes, 20);
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
  XA_STYLE: style,
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
  console
};
context.globalThis = context;
vm.runInNewContext(source, context);
const api = context.XA_TEST;
assert.equal(api.formatVelocity(1200), '1.2K/h');
assert.equal(api.formatVelocity(null), '流速未知');
assert.equal(api.statusIdFromHref('https://x.com/example/status/123?s=20'), '123');
assert.equal(api.statusIdFromHref('https://x.com/example/status/not-a-tweet'), '');

console.log('X-Newfish self-test: 34 assertions passed');
