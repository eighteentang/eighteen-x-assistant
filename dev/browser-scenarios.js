(async () => {
  const results = [];
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const record = (name, expected, actual) => results.push({
    name, expected, actual, pass: JSON.stringify(expected) === JSON.stringify(actual)
  });
  const article = (id) => document.getElementById(id);
  const shown = (id) => getComputedStyle(article(id)).display !== 'none';
  const setting = async (next) => { await chrome.storage.local.set(next); await wait(250); };
  const metric = async (id, extra = '') => { await fetch(`/graphql/${id}${extra}`); await wait(250); };

  // Force the first network response to arrive before the content script exists.
  await fetch('/graphql/101');
  await wait(100);
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/content.js';
    script.onload = resolve;
    script.onerror = reject;
    document.body.append(script);
  });
  await wait(300);
  record('首屏早到指标可补交', 'ready', article('a1').querySelector('.xa-velocity-badge').dataset.state);
  await metric('101');
  await metric('102');
  record('后续响应可显示流速', 'ready', article('a1').querySelector('.xa-velocity-badge').dataset.state);

  const beforeUrl = location.href;
  const firstRanked = document.querySelector('#xa-velocity-board li button');
  const rankedTarget = [...document.querySelectorAll('article')].find((node) => node.querySelector('a')?.getAttribute('href').endsWith(`/status/${firstRanked.dataset.tweetId}`));
  firstRanked.click();
  record('榜单点击高亮正确帖子', true, rankedTarget?.classList.contains('xa-anchor-target'));
  record('榜单点击不改变路由', beforeUrl, location.href);
  const badge = article('a1').querySelector('.xa-velocity-badge');
  badge.dispatchEvent(new MouseEvent('mouseenter'));
  record('详情显示评论和转发', true, document.querySelector('.xa-metrics-tooltip').textContent.includes('评论3转发4'));
  badge.dispatchEvent(new MouseEvent('mouseleave'));
  record('离开徽章关闭详情', null, document.querySelector('.xa-metrics-tooltip'));

  const fresh = article('a3').cloneNode(true);
  fresh.id = 'a5';
  fresh.querySelector('a').href = '/tester/status/105';
  fresh.querySelector('.xa-velocity-badge')?.remove();
  document.querySelector('main').append(fresh);
  await wait(250);
  record('新增推文挂载徽章', 1, fresh.querySelectorAll('.xa-velocity-badge').length);
  await metric('105');
  record('新增推文接收指标', 'ready', fresh.querySelector('.xa-velocity-badge').dataset.state);
  fresh.remove();
  await wait(250);
  const explainParent = article('a1').querySelector('button').parentElement;
  record('徽章位于解释按钮之前', true, article('a1').querySelector('button').previousElementSibling.classList.contains('xa-velocity-badge'));
  record('正文含 Grok 不改变徽章落位', 'HEADER', article('a4').querySelector('.xa-velocity-badge').parentElement.tagName);
  let badgeChanges = 0;
  const counter = new MutationObserver((mutations) => { badgeChanges += mutations.length; });
  counter.observe(badge, { childList: true, subtree: true, characterData: true });
  await wait(650);
  counter.disconnect();
  record('静止页面不循环重写徽章', 0, badgeChanges);

  await setting({ enabled: false });
  record('关闭总开关恢复所有推文', 4, [...document.querySelectorAll('article')].filter((node) => getComputedStyle(node).display !== 'none').length);
  record('插件不改写原布局', '', explainParent.style.justifyContent);
  await setting({ enabled: true, showVelocity: false, keywords: ['广告'] });
  record('关键词命中隐藏', false, shown('a2'));
  record('关键词未命中保留', true, shown('a1'));
  await setting({ keywordFilterEnabled: false });
  record('关闭关键词过滤恢复', true, shown('a2'));
  record('恢复原始 display 值及优先级', ['block', 'important'], [article('a2').style.display, article('a2').style.getPropertyPriority('display')]);

  await setting({ keywords: [], keywordFilterEnabled: true, velocityFilterEnabled: true, minVelocity: 1201 });
  record('无需授权即可按阈值过滤', false, shown('a1'));
  record('缺少指标不隐藏', true, shown('a3'));
  await setting({ minVelocity: 1200 });
  record('等于阈值保留', true, shown('a1'));
  await setting({ minVelocity: 0 });
  record('零阈值保留', true, shown('a1'));
  await setting({ minVelocity: 999999, maxEntitlement: false });
  record('旧版关闭授权字段不影响过滤', false, shown('a1'));
  await setting({ maxEntitlement: true, entitlement: { status: 'inactive', entitlements: ['velocity_filter'] } });
  record('旧版失效授权不影响过滤', false, shown('a1'));
  await setting({ entitlement: { status: 'active', entitlements: [] } });
  record('旧版权益列表不影响过滤', false, shown('a1'));
  await setting({ velocityFilterEnabled: false, showVelocity: true, keywords: ['流速'] });
  record('关键词排除插件自身文案', true, shown('a3'));
  await setting({ showVelocity: false, keywords: [] });
  const beforeRows = document.querySelectorAll('#xa-velocity-board li').length;
  article('a2').remove();
  await wait(300);
  record('仅移除推文时更新榜单', beforeRows - 1, document.querySelectorAll('#xa-velocity-board li').length);
  await setting({ showVelocity: true });
  await metric('101', '?partial=1');
  record('缺失字段不覆盖有效缓存', 'ready', article('a1').querySelector('.xa-velocity-badge').dataset.state);

  // Reuse a tweet element without adding any child nodes.
  article('a1').querySelector('a').href = '/tester/status/106';
  await wait(250);
  record('节点复用不沿用旧帖子指标', 'unknown', article('a1').querySelector('.xa-velocity-badge').dataset.state);
  await metric('106');
  record('复用节点可接收新指标', 'ready', article('a1').querySelector('.xa-velocity-badge').dataset.state);
  await setting({ keywords: ['变更正文'], showVelocity: false });
  article('a3').querySelector('[data-testid="tweetText"]').firstChild.data = '变更正文';
  await wait(250);
  record('仅文本变化仍应用过滤', false, shown('a3'));
  await setting({ enabled: false });
  record('关闭后恢复已过滤帖子', true, shown('a3'));
  record('关闭后没有残留徽章', 0, document.querySelectorAll('article .xa-velocity-badge').length);

  await setting({ enabled: true, keywords: ['变更正文'] });
  const notice = () => article('a3').previousElementSibling;
  record('过滤提示说明命中原因', true, notice().textContent.includes('关键词：变更正文'));
  record('过滤提示紧邻对应推文', true, notice().classList.contains('xa-filter-notice'));
  notice().querySelector('button').click();
  await wait(250);
  record('显示这条可恢复推文', true, shown('a3'));
  record('恢复后可重新隐藏', true, notice().textContent.includes('重新隐藏'));
  await setting({ leaderboardOpacity: 0.2 });
  record('调整外观不取消临时恢复', true, shown('a3'));
  notice().querySelector('button').click();
  await wait(250);
  record('重新隐藏重新应用过滤', false, shown('a3'));
  const allow = [...notice().querySelectorAll('button')].find((node) => node.textContent.includes('@trusted'));
  allow.click();
  await wait(250);
  record('一键加入账号白名单', true, window.auditSettings.whitelist.includes('trusted'));
  record('白名单恢复命中关键词的推文', true, shown('a3'));
  record('白名单恢复后清除过滤提示', false, notice().classList.contains('xa-filter-notice'));
  article('a3').querySelector('[data-testid="tweetText"]').setAttribute('lang', 'fr');
  await setting({ languageFilterEnabled: true, allowedLanguages: ['zh', 'en'] });
  record('白名单优先于语言过滤', true, shown('a3'));
  await setting({ whitelist: ['trusted', 'tester'], velocityFilterEnabled: true, minVelocity: 999999 });
  record('白名单优先于流速过滤', true, shown('a1'));
  await setting({ whitelist: [], keywords: [], velocityFilterEnabled: false });
  record('非允许语言隐藏', false, shown('a3'));
  record('语言过滤提示包含语言代码', true, notice().textContent.includes('语言：fr'));
  record('缺少语言信息保留', true, shown('a4'));
  article('a3').querySelector('[data-testid="tweetText"]').setAttribute('lang', 'zh-CN');
  await wait(250);
  record('中文地区变体保留', true, shown('a3'));
  article('a3').querySelector('[data-testid="tweetText"]').setAttribute('lang', 'und');
  await setting({ allowedLanguages: ['ja'] });
  record('未知语言不误隐藏', true, shown('a3'));
  article('a1').querySelector('[data-testid="tweetText"]').setAttribute('lang', 'ja');
  await wait(250);
  record('语言以网络数据为优先', false, shown('a1'));
  await setting({ languageFilterEnabled: false });
  record('关闭语言过滤恢复', true, shown('a1'));
  await setting({ keywords: ['变更正文'] });
  notice().querySelector('button').click();
  await wait(250);
  await setting({ minVelocity: 100 });
  record('修改过滤规则重新评估临时恢复', false, shown('a3'));
  const removedNotice = notice();
  article('a3').remove();
  await wait(250);
  record('移除推文时清除对应提示', false, removedNotice.isConnected);
  await setting({ enabled: false });
  record('关闭总开关清除全部过滤提示', 0, document.querySelectorAll('.xa-filter-notice').length);

  // Reproduce a real timeline: stale network counts, abbreviated DOM views,
  // a quoted post, and a post whose metrics request was missed entirely.
  const real = document.createElement('article');
  real.dataset.testid = 'tweet'; real.id = 'real';
  real.innerHTML = `<header><a role="link" href="/real/status/301"><time datetime="${new Date(Date.now() - 2 * 60000).toISOString()}">2分钟</time></a></header>
    <div data-testid="tweetText" lang="en">Just type hello</div>
    <div role="link"><a href="/quote/status/302"><time datetime="2020-01-01T00:00:00Z">引用</time></a><div data-testid="tweetText" lang="fr">citation</div><button data-testid="reply">999</button><a href="/quote/status/302/analytics">9M</a></div>
    <div role="group"><button data-testid="reply">46</button><button data-testid="retweet">5</button><button data-testid="like">10</button><a role="link" href="/real/status/301/analytics">180</a></div>`;
  document.querySelector('main').append(real);
  window.postMessage({ type: 'XA_TWEET_METRICS', tweets: [{ id: '301', createdAt: Date.now() - 2 * 60000, views: 180, comments: 24, reposts: 5, likes: 10, language: 'en' }] }, '*');
  await setting({ enabled: true, showVelocity: true, keywords: [], whitelist: [], languageFilterEnabled: false, velocityFilterEnabled: false });
  const liveBadge = real.querySelector('.xa-velocity-badge');
  liveBadge.dispatchEvent(new MouseEvent('mouseenter'));
  record('实际页面评论46优先于旧网络24', true, document.querySelector('.xa-metrics-tooltip').textContent.includes('评论46'));
  record('引用帖指标不串入主帖', 180, XA_TEST.getArticleMetrics(real).views);
  real.querySelector('[role="group"] [data-testid="reply"]').textContent = '47';
  await wait(250);
  record('悬浮过程中详情同步更新', true, document.querySelector('.xa-metrics-tooltip').textContent.includes('评论47'));
  record('不足5分钟计算口径明确', true, document.querySelector('.xa-metrics-tooltip').textContent.includes('不足 5 分钟'));
  liveBadge.dispatchEvent(new MouseEvent('mouseleave'));
  await setting({ velocityFilterEnabled: true, minVelocity: 2200 });
  record('实际页面2.2K以下按精确2160过滤', 'none', real.style.display);
  await setting({ velocityFilterEnabled: false, languageFilterEnabled: true, allowedLanguages: ['zh'] });
  record('只允许中文时过滤英文主帖', 'none', real.style.display);
  await setting({ allowedLanguages: ['en'] });
  record('引用帖法语不影响英文主帖', '', real.style.display);
  const missed = real.cloneNode(true);
  missed.id = 'missed';
  missed.querySelector('.xa-velocity-badge')?.remove();
  missed.querySelector('header a').href = '/missed/status/303';
  missed.querySelector('[role="group"] a').href = '/missed/status/303/analytics';
  missed.querySelector('[data-testid="tweetText"]').innerHTML = '<span lang="ja">こんにちは</span>';
  missed.querySelector('[data-testid="tweetText"]').removeAttribute('lang');
  document.querySelector('main').append(missed);
  await setting({ languageFilterEnabled: false, velocityFilterEnabled: false });
  record('漏抓网络时使用本帖浏览量计算', 2160, XA_TEST.getArticleMetrics(missed).velocity);
  record('漏抓网络时标明页面读数', true, missed.querySelector('.xa-velocity-badge').dataset.tooltip.includes('页面读数'));
  await setting({ velocityFilterEnabled: true, minVelocity: 2200 });
  record('漏抓网络时流速过滤仍生效', 'none', missed.style.display);
  await setting({ velocityFilterEnabled: false, languageFilterEnabled: true, allowedLanguages: ['zh'] });
  record('正文子节点语言可用于过滤', 'none', missed.style.display);
  record('正文子节点语言不取引用语言', 'ja', XA_TEST.articleLanguage(missed, null));
  const applied = await chrome.runtime.sendMessage({ type: 'XA_SETTINGS_APPLY' });
  record('设置应用后返回页面确认', true, applied.ready);
  record('页面确认报告实际过滤数量', 3, applied.hidden);
  record('页面确认报告流速覆盖数量', 3, applied.velocity);
  await setting({ languageFilterEnabled: false });
  real.querySelector('[role="group"] a').textContent = '1.2K';
  window.postMessage({ type: 'XA_TWEET_METRICS', tweets: [{ id: '301', views: 1234 }] }, '*');
  await wait(250);
  record('缩写读数保留网络精确值', 1234, XA_TEST.getArticleMetrics(real).views);
  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', '/graphql/303'); xhr.responseType = 'json';
    xhr.onload = resolve; xhr.onerror = reject; xhr.send();
  });
  await wait(250);
  record('XHR JSON响应可提取指标', 2, XA_TEST.getArticleMetrics(missed).bookmarks);
  real.remove(); missed.remove();

  document.querySelector('main').replaceChildren();
  const rankingMetrics = [];
  for (let i = 0; i < 26; i++) {
    const sample = document.createElement('article'); sample.dataset.testid = 'tweet';
    sample.innerHTML = `<header><a href="/reader_${i}/status/${400 + i}"><time>样本</time></a></header><div data-testid="tweetText">排名样本${i}</div>`;
    document.querySelector('main').append(sample);
    rankingMetrics.push({ id: String(400 + i), createdAt: i === 25 ? null : Date.now() - (i === 24 ? 8 * 86400000 : (i + 1) * 1800000),
      views: (i + 1) * 1000, likes: i === 25 ? null : 25 - i, bookmarks: i === 25 ? null : i % 5, author: `reader_${i}` });
  }
  document.querySelector('main').append(document.querySelector('main article').cloneNode(true));
  window.postMessage({ type: 'XA_TWEET_METRICS', tweets: rankingMetrics }, '*');
  await setting({ leaderboardSort: 'velocity', leaderboardHours: 0, leaderboardLimit: 10, leaderboardCollapsed: false, leaderboardEnabled: true });
  const board = document.getElementById('xa-velocity-board');
  const boardRows = () => [...board.querySelectorAll('li button')];
  const choose = async (label, value) => {
    const select = board.querySelector(`select[aria-label="${label}"]`);
    select.value = String(value); select.dispatchEvent(new Event('change', { bubbles: true })); await wait(250);
  };
  record('榜单默认显示Top10', 10, boardRows().length);
  record('榜单显示作者', true, board.querySelector('.xa-board-author').textContent.includes('@reader_'));
  await choose('榜单显示条数', 20);
  record('榜单可切换Top20并保存', [20, 20], [boardRows().length, window.auditSettings.leaderboardLimit]);
  await choose('榜单显示条数', 50);
  record('相同Tweet ID去重且缺少流速不参与流速榜', 25, boardRows().length);
  await choose('榜单排序', 'views');
  record('浏览量排序包含缺少发帖时间的帖子', '425', boardRows()[0].dataset.tweetId);
  record('浏览量榜不显示每小时单位', false, boardRows()[0].textContent.includes('/h'));
  record('原帖入口指向对应ID且在新页打开', ['https://x.com/i/status/425', '_blank', 'noopener noreferrer'],
    ['href', 'target', 'rel'].map((key) => board.querySelector('.xa-board-open').getAttribute(key)));
  await choose('榜单排序', 'likes');
  record('点赞数排序正确', '400', boardRows()[0].dataset.tweetId);
  await choose('榜单排序', 'bookmarks');
  record('收藏数相同优先新帖', '404', boardRows()[0].dataset.tweetId);
  record('未知收藏数不冒充零参与榜单', 25, boardRows().length);
  await choose('榜单发帖时间', 1);
  record('最近1小时过滤旧帖', ['400'], boardRows().map((button) => button.dataset.tweetId));
  await choose('榜单排序', 'views');
  await choose('榜单发帖时间', 24);
  record('最近24小时排除旧帖和未知时间', 24, boardRows().length);
  const sortControl = board.querySelector('[aria-label="榜单排序"]');
  sortControl.focus();
  await setting({ leaderboardOpacity: 0.25 });
  record('榜单刷新保留选择控件和焦点', true, sortControl.isConnected && document.activeElement === sortControl);
  board.querySelector('.xa-board-toggle').click(); await wait(250);
  record('可收起榜单且保存状态', [true, true, 'false'], [board.querySelector('#xa-board-body').hidden, window.auditSettings.leaderboardCollapsed, board.querySelector('.xa-board-toggle').getAttribute('aria-expanded')]);
  board.querySelector('.xa-board-toggle').click(); await wait(250);
  record('展开恢复已选榜单', [false, 'views', '24'], [board.querySelector('#xa-board-body').hidden, sortControl.value, board.querySelector('[aria-label="榜单发帖时间"]').value]);
  await setting({ leaderboardEnabled: false });
  record('可独立关闭排行榜', 'none', board.style.display);
  await setting({ leaderboardEnabled: true, showVelocity: false, keywords: ['排名样本0'] });
  record('关闭徽章不关闭榜单', true, boardRows().length > 0);
  record('被过滤帖子不进入榜单', false, boardRows().some((button) => button.dataset.tweetId === '400'));
  await setting({ keywords: [], showVelocity: true, leaderboardSort: 'velocity', leaderboardHours: 24, leaderboardLimit: 10 });

  // The reply dialog has a role=group outside its embedded tweet. A badge
  // must never use that outer group as its host, even after repeated refreshes.
  const dialog = document.createElement('div'); dialog.setAttribute('role', 'dialog');
  dialog.style.cssText = 'position:fixed;left:0;right:0;top:100px;display:flex;justify-content:center;z-index:2147483001;pointer-events:none';
  dialog.innerHTML = '<div role="group" id="reply-outer" style="display:flex;width:max-content;background:#111;border-radius:12px;pointer-events:auto"><div style="width:600px;padding:12px;box-sizing:border-box"><article data-testid="tweet" id="reply-context"><header><a href="/reply_author/status/600"><time datetime="2026-10-18T00:00:00Z">原帖</time></a></header><div data-testid="tweetText">回复上下文</div></article><article data-testid="tweet" id="draft-context"><div data-testid="User-Name">我</div><div contenteditable="true" role="textbox" aria-label="回复内容" style="min-height:120px">正在写回复</div></article></div></div>';
  document.body.append(dialog);
  await wait(250);
  const replyContext = dialog.querySelector('#reply-context');
  const draft = dialog.querySelector('#draft-context');
  const replyLeft = Math.round(dialog.querySelector('#reply-outer').getBoundingClientRect().left);
  record('回复结构可复现旧代码越界宿主', false, replyContext.contains(replyContext.querySelector('time').closest('div[role="group"]')));
  record('回复原帖的徽章留在原帖内部', 1, replyContext.querySelectorAll('.xa-velocity-badge').length);
  record('回复草稿不插入流速等待', 0, draft.querySelectorAll('.xa-velocity-badge').length);
  const orphan = document.createElement('span'); orphan.className = 'xa-velocity-badge'; orphan.textContent = '流速等待';
  dialog.querySelector('#reply-outer').append(orphan);
  const duplicateBadge = replyContext.querySelector('.xa-velocity-badge').cloneNode(true); replyContext.append(duplicateBadge);
  for (let i = 0; i < 4; i++) {
    replyContext.querySelector('[data-testid="tweetText"]').textContent = `回复上下文${i}`;
    await wait(250);
  }
  record('反复刷新只保留一枚原帖徽章', 1, replyContext.querySelectorAll('.xa-velocity-badge').length);
  record('清理逃出帖子的旧徽章', false, orphan.isConnected);
  record('不向回复外层group追加徽章', 0, dialog.querySelectorAll('#reply-outer > .xa-velocity-badge').length);
  record('回复框位置保持稳定', replyLeft, Math.round(dialog.querySelector('#reply-outer').getBoundingClientRect().left));
  record('清理游离徽章不误删榜单数值', true, board.querySelectorAll('.xa-board-value').length > 0);
  if (new URLSearchParams(location.search).get('preview') !== 'reply') dialog.remove();

  const output = { done: true, passed: results.filter((result) => result.pass).length, total: results.length, results };
  document.getElementById('report').textContent = JSON.stringify(output, null, 2);
  document.getElementById('summary').textContent = `${output.passed}/${output.total} 项通过`;
})().catch((error) => {
  document.getElementById('summary').textContent = '检查异常';
  document.getElementById('report').textContent = error.stack;
});
