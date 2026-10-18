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
  document.querySelector('#xa-velocity-board button').click();
  record('榜单点击高亮正确帖子', true, article('a1').classList.contains('xa-anchor-target'));
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

  const output = { done: true, passed: results.filter((result) => result.pass).length, total: results.length, results };
  document.getElementById('report').textContent = JSON.stringify(output, null, 2);
  document.getElementById('summary').textContent = `${output.passed}/${output.total} 项通过`;
})().catch((error) => {
  document.getElementById('summary').textContent = '检查异常';
  document.getElementById('report').textContent = error.stack;
});
