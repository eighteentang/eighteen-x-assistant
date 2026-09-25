(function initContent(global) {
  const SELECTOR = 'article[data-testid="tweet"]';
  const BADGE_CLASS = 'xa-velocity-badge';
  const STYLE_ID = 'xa-content-style';
  const LEADERBOARD_ID = 'xa-velocity-board';
  let settings = XA_CONFIG.mergeSettings({});
  const metricsById = new Map();
  let observer;
  let refreshTimer;

  const formatVelocity = XA_METRICS.formatVelocity;
  const formatCount = XA_METRICS.formatCount;

  function statusIdFromHref(href) {
    return String(href || '').match(/\/status\/(\d+)/)?.[1] || '';
  }

  function articleId(article) {
    const timeLink = article.querySelector('time')?.closest('a[href*="/status/"]');
    const links = [...article.querySelectorAll('a[href*="/status/"]')];
    return statusIdFromHref(timeLink?.href) || links.map((link) => statusIdFromHref(link.href)).find(Boolean) || '';
  }

  function getArticleMetrics(article) {
    const id = articleId(article);
    const metric = id ? metricsById.get(id) : null;
    if (!metric) return null;
    const value = XA_METRICS.velocity(metric);
    return { ...metric, velocity: value, tier: XA_METRICS.velocityTier(value) };
  }

  function extractDetails(article, metrics) {
    return {
      views: metrics?.views ?? null,
      comments: metrics?.comments ?? null,
      reposts: metrics?.reposts ?? null,
      likes: metrics?.likes ?? null,
      bookmarks: metrics?.bookmarks ?? null,
      score: null,
      publishedAt: metrics?.createdAt ? new Date(metrics.createdAt).toLocaleString() : '未知'
    };
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${BADGE_CLASS} {
        all: initial;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 25px;
        padding: 0 8px;
        margin-left: 8px;
        border: 1px solid var(--xa-badge-border);
        border-radius: 8px;
        background: linear-gradient(145deg, var(--xa-badge-start), var(--xa-badge-end));
        color: var(--xa-badge-text);
        cursor: help;
        font: 700 12px/1 system-ui, sans-serif;
        box-shadow: 0 2px 8px var(--xa-badge-shadow);
        vertical-align: middle;
      }
      .${BADGE_CLASS}[data-tier="steady"] {
        --xa-badge-start: rgba(49, 105, 62, .48);
        --xa-badge-end: rgba(29, 74, 41, .72);
        --xa-badge-border: rgba(153, 207, 161, .52);
        --xa-badge-text: #e4f7e7;
        --xa-badge-shadow: rgba(29, 74, 41, .28);
      }
      .${BADGE_CLASS}[data-tier="rising"] {
        --xa-badge-start: rgba(170, 139, 32, .5);
        --xa-badge-end: rgba(123, 97, 16, .74);
        --xa-badge-border: rgba(232, 211, 117, .54);
        --xa-badge-text: #fff0ae;
        --xa-badge-shadow: rgba(123, 97, 16, .28);
      }
      .${BADGE_CLASS}[data-tier="accelerating"] {
        --xa-badge-start: rgba(178, 99, 32, .52);
        --xa-badge-end: rgba(140, 65, 17, .76);
        --xa-badge-border: rgba(240, 174, 103, .56);
        --xa-badge-text: #ffe0b6;
        --xa-badge-shadow: rgba(140, 65, 17, .3);
      }
      .${BADGE_CLASS}[data-tier="burst"] {
        --xa-badge-start: rgba(180, 59, 76, .54);
        --xa-badge-end: rgba(127, 36, 55, .78);
        --xa-badge-border: rgba(244, 139, 151, .58);
        --xa-badge-text: #ffd2d7;
        --xa-badge-shadow: rgba(127, 36, 55, .32);
      }
      .${BADGE_CLASS}[data-tier="viral"] {
        --xa-badge-start: rgba(101, 56, 118, .56);
        --xa-badge-end: rgba(62, 31, 85, .8);
        --xa-badge-border: rgba(196, 157, 215, .6);
        --xa-badge-text: #eedcf4;
        --xa-badge-shadow: rgba(62, 31, 85, .34);
      }
      .${BADGE_CLASS}[data-tier="unknown"] {
        --xa-badge-start: rgba(83, 100, 113, .26);
        --xa-badge-end: rgba(54, 67, 78, .48);
        --xa-badge-border: rgba(190, 202, 211, .3);
        --xa-badge-text: #d9e1e7;
        --xa-badge-shadow: rgba(54, 67, 78, .18);
      }
      .${BADGE_CLASS}:hover, .${BADGE_CLASS}:focus-visible {
        filter: saturate(1.08) brightness(.98);
        outline: 2px solid rgba(239, 35, 60, .28);
        outline-offset: 2px;
        backdrop-filter: blur(6px);
      }
      .xa-anchor-target {
        scroll-margin-top: 92px;
        outline: 2px solid rgba(239, 35, 60, .58);
        outline-offset: 4px;
        border-radius: 12px;
        animation: xa-anchor-pulse 1.25s ease-out;
      }
      @keyframes xa-anchor-pulse {
        0% { box-shadow: 0 0 0 0 rgba(239, 35, 60, .34); }
        100% { box-shadow: 0 0 0 12px rgba(239, 35, 60, 0); }
      }
      .xa-metrics-tooltip {
        position: fixed;
        z-index: 2147483647;
        width: 226px;
        padding: 12px 13px;
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 11px;
        background: rgba(17,24,39,.97);
        color: white;
        box-shadow: 0 12px 30px rgba(0,0,0,.24);
        pointer-events: none;
        font: 12px/1.45 system-ui, sans-serif;
      }
      .xa-metrics-tooltip strong { display: block; margin-bottom: 8px; color: #ff6171; font-size: 13px; }
      .xa-metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 12px; }
      .xa-metrics-grid span { color: #b8c4d2; }
      .xa-metrics-grid b { color: white; font-weight: 650; }
      #${LEADERBOARD_ID} {
        position: fixed; top: 88px; right: 14px; z-index: 2147483000;
        width: 344px; max-height: min(560px, calc(100vh - 112px)); overflow: auto;
        box-sizing: border-box; padding: 12px;
        border: 1px solid rgba(255,255,255,.14); border-radius: 12px;
        background: rgba(25, 29, 35, var(--xa-board-opacity, .1)); color: #f3f5f7;
        box-shadow: 0 14px 38px rgba(15,20,25,.18);
        backdrop-filter: blur(16px) saturate(120%);
        font: 13px/1.35 system-ui, sans-serif;
      }
      #${LEADERBOARD_ID} .xa-board-title { display:flex; align-items:baseline; justify-content:space-between; margin-bottom: 8px; }
      #${LEADERBOARD_ID} .xa-board-title strong { font-size: 14px; }
      #${LEADERBOARD_ID} .xa-board-title span { color: #aeb7c2; font-size: 11px; }
      #${LEADERBOARD_ID} .xa-board-empty { padding: 14px 4px; color: #aeb7c2; font-size: 12px; }
      #${LEADERBOARD_ID} ol { list-style: none; padding: 0; margin: 0; display: grid; gap: 5px; }
      #${LEADERBOARD_ID} { pointer-events: auto; }
      #${LEADERBOARD_ID} li button { display: grid; grid-template-columns: 22px 1fr auto; gap: 7px; align-items: center; width: 100%; padding: 7px 5px; border: 0; border-radius: 7px; background: transparent; color: inherit; cursor: pointer; text-align: left; pointer-events: auto; }
      #${LEADERBOARD_ID} li button:hover, #${LEADERBOARD_ID} li button:focus-visible { background: rgba(255,255,255,.09); outline: none; }
      #${LEADERBOARD_ID} .xa-board-rank { color: #aeb7c2; font-variant-numeric: tabular-nums; }
      #${LEADERBOARD_ID} .xa-board-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      #${LEADERBOARD_ID} .xa-board-value {
        margin-left: 0;
        cursor: default;
        white-space: nowrap;
      }
      @media (max-width: 1180px) { #${LEADERBOARD_ID} { display: none; } }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function isExplainButton(element) {
    const label = `${element.getAttribute?.('aria-label') || ''} ${element.getAttribute?.('data-testid') || ''} ${element.getAttribute?.('title') || ''} ${element.textContent || ''}`.toLowerCase();
    return label.includes('explain this post') ||
      label.includes('解释这个帖子') ||
      label.includes('grok');
  }

  function getExplainButton(article) {
    return [...article.querySelectorAll('button, [role="button"], a, [aria-label], [data-testid]')]
      .find(isExplainButton) || null;
  }

  function getBadgeHost(article) {
    const time = article.querySelector('time');
    const header = time?.closest('div[role="group"]') || time?.parentElement?.parentElement;
    if (header) return header;
    return article.querySelector('div[data-testid="User-Name"]')?.parentElement || article;
  }

  function placeBadge(article, badge) {
    const explainButton = getExplainButton(article);
    const explainHost = explainButton?.parentElement;
    const host = explainHost || getBadgeHost(article);
    host.style.setProperty('display', 'flex', 'important');
    host.style.setProperty('align-items', 'center', 'important');
    host.style.setProperty('gap', '4px', 'important');
    if (explainButton && explainHost) {
      explainHost.style.setProperty('justify-content', 'flex-end', 'important');
      if (badge.parentElement !== explainHost || badge.nextElementSibling !== explainButton) {
        explainHost.insertBefore(badge, explainButton);
      }
      return;
    }
    host.style.setProperty('justify-content', 'flex-end', 'important');
    if (badge.parentElement !== host) host.appendChild(badge);
  }

  function showTooltip(badge) {
    hideTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'xa-metrics-tooltip';
    tooltip.innerHTML = badge.dataset.tooltip || '';
    document.body.appendChild(tooltip);
    const rect = badge.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.right - tooltip.offsetWidth), window.innerWidth - tooltip.offsetWidth - 8);
    const top = rect.bottom + 8 + tooltip.offsetHeight < window.innerHeight
      ? rect.bottom + 8
      : Math.max(8, rect.top - tooltip.offsetHeight - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    global.__XA_TOOLTIP = tooltip;
  }

  function hideTooltip() {
    global.__XA_TOOLTIP?.remove();
    global.__XA_TOOLTIP = null;
  }

  function focusArticle(article, anchor = null) {
    const target = article?.isConnected ? article : anchor?.isConnected ? anchor : null;
    if (!target) return false;
    target.scrollIntoView({ behavior: 'auto', block: 'center', inline: 'nearest' });
    const rect = target.getBoundingClientRect();
    if ((rect.top < 0 || rect.bottom > global.innerHeight) && typeof global.scrollTo === 'function') {
      global.scrollTo({
        top: Math.max(0, global.scrollY + rect.top - 92),
        behavior: 'auto'
      });
    }
    const highlight = article?.isConnected ? article : anchor?.closest?.(SELECTOR) || target;
    highlight.classList.remove('xa-anchor-target');
    void highlight.offsetWidth;
    highlight.classList.add('xa-anchor-target');
    clearTimeout(highlight.__xaAnchorTimer);
    highlight.__xaAnchorTimer = setTimeout(() => {
      highlight.classList.remove('xa-anchor-target');
    }, 1400);
    return true;
  }

  function findTweetTarget(tweetId) {
    const id = String(tweetId || '');
    if (!id) return null;
    const article = [...document.querySelectorAll(SELECTOR)]
      .find((candidate) => articleId(candidate) === id) || null;
    if (article) {
      const anchor = [...article.querySelectorAll('a[href*="/status/"]')]
        .find((link) => statusIdFromHref(link.href) === id) || null;
      return { article, anchor };
    }
    const anchor = [...document.querySelectorAll('a[href*="/status/"]')]
      .find((link) => statusIdFromHref(link.href) === id) || null;
    return anchor ? { article: anchor.closest(SELECTOR), anchor } : null;
  }

  function focusTweet(tweetId, attempt = 0) {
    const target = findTweetTarget(tweetId);
    if (target && focusArticle(target.article, target.anchor)) return true;
    if (attempt < 4) {
      setTimeout(() => focusTweet(tweetId, attempt + 1), 100);
    }
    return false;
  }

  function handleLeaderboardButton(event, tweetId) {
    const button = event.currentTarget;
    const now = Date.now();
    const handledAt = Number(button.dataset.xaPointerHandledAt || 0);
    if (event.type === 'click' && now - handledAt < 500) return;
    if (event.type === 'pointerdown') button.dataset.xaPointerHandledAt = String(now);
    event.preventDefault();
    event.stopPropagation();
    focusTweet(tweetId);
  }

  function ensureLeaderboard() {
    let board = document.getElementById(LEADERBOARD_ID);
    if (board) return board;
    board = document.createElement('aside');
    board.id = LEADERBOARD_ID;
    board.setAttribute('aria-label', '本页流速榜');
    document.body.appendChild(board);
    return board;
  }

  function renderLeaderboard() {
    const board = ensureLeaderboard();
    const opacity = Number(settings.leaderboardOpacity);
    board.style.setProperty('--xa-board-opacity', Number.isFinite(opacity) ? String(Math.min(1, Math.max(0, opacity))) : '0.1');
    board.style.display = settings.enabled ? '' : 'none';
    if (!settings.enabled) return;
    const rows = [...document.querySelectorAll(SELECTOR)]
      .map((article) => ({ article, metric: getArticleMetrics(article) }))
      .filter((item) => item.article.style.display !== 'none' && Number.isFinite(item.metric?.velocity))
      .sort((a, b) => b.metric.velocity - a.metric.velocity)
      .slice(0, 10);
    const title = document.createElement('div');
    title.className = 'xa-board-title';
    title.innerHTML = '<strong>本页流速榜</strong><span>实时排序</span>';
    board.replaceChildren(title);
    if (!rows.length) {
      const empty = document.createElement('div');
      empty.className = 'xa-board-empty';
      empty.textContent = '等待 X 返回帖子数据…';
      board.appendChild(empty);
      return;
    }
    const list = document.createElement('ol');
    rows.forEach(({ article, metric }, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      const tweetId = articleId(article);
      button.dataset.tweetId = tweetId;
      button.addEventListener('pointerdown', (event) => handleLeaderboardButton(event, tweetId));
      button.addEventListener('click', (event) => handleLeaderboardButton(event, tweetId));
      const rank = document.createElement('span');
      rank.className = 'xa-board-rank';
      rank.textContent = `${index + 1}`;
      const text = document.createElement('span');
      text.className = 'xa-board-text';
      text.textContent = article.querySelector('[data-testid="tweetText"]')?.innerText?.trim() || `帖子 ${articleId(article)}`;
      const value = document.createElement('span');
      value.className = `${BADGE_CLASS} xa-board-value`;
      value.dataset.tier = metric.tier?.key || 'unknown';
      value.textContent = `${metric.tier?.emoji || ''} ${formatVelocity(metric.velocity)}`.trim();
      button.setAttribute('aria-label', `定位到第 ${index + 1} 条，${formatVelocity(metric.velocity)}`);
      button.append(rank, text, value);
      item.appendChild(button);
      list.appendChild(item);
    });
    board.appendChild(list);
  }

  function matchesKeyword(article) {
    if (!settings.keywordFilterEnabled || settings.keywords.length === 0) return false;
    const text = (article.innerText || '').toLowerCase();
    return settings.keywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }

  function handleTweetMetrics(event) {
    if (event.source !== global || event.data?.type !== 'XA_TWEET_METRICS') return;
    (event.data.tweets || []).forEach((metric) => {
      if (metric?.id) metricsById.set(String(metric.id), metric);
    });
    scheduleRefresh();
  }

  function renderArticle(article) {
    if (!article.isConnected) return;
    const metrics = getArticleMetrics(article);
    const details = extractDetails(article, metrics);
    const hiddenByKeyword = matchesKeyword(article);
    const hiddenByVelocity = settings.velocityFilterEnabled &&
      Number.isFinite(metrics?.velocity) && metrics.velocity < Number(settings.minVelocity || 0);
    article.style.display = settings.enabled && !hiddenByKeyword && !hiddenByVelocity ? '' : 'none';

    let badge = article.querySelector(`.${BADGE_CLASS}`);
    if (!settings.enabled || !settings.showVelocity) {
      if (badge) badge.remove();
      return;
    }
    if (!badge) {
      badge = document.createElement('span');
      badge.className = BADGE_CLASS;
      badge.setAttribute('aria-label', 'X-Newfish 流速等级');
      badge.setAttribute('role', 'button');
      badge.tabIndex = 0;
      badge.textContent = '';
      badge.addEventListener('mouseenter', () => showTooltip(badge));
      badge.addEventListener('mouseleave', hideTooltip);
      badge.addEventListener('focus', () => showTooltip(badge));
      badge.addEventListener('blur', hideTooltip);
    }
    placeBadge(article, badge);
    const tier = metrics?.tier;
    badge.textContent = Number.isFinite(metrics?.velocity)
      ? `${tier?.emoji || ''} ${formatVelocity(metrics.velocity)}`.trim()
      : '流速等待';
    badge.dataset.tier = tier?.key || 'unknown';
    badge.dataset.tooltip = `<strong>X-Newfish 流量详情</strong><div class="xa-metrics-grid"><span>流速等级</span><b>${tier ? `${tier.emoji} ${tier.label}` : '未知'}</b><span>浏览量</span><b>${formatCount(details.views)}</b><span>评论</span><b>${formatCount(details.comments)}</b><span>转发</span><b>${formatCount(details.reposts)}</b><span>点赞</span><b>${formatCount(details.likes)}</b><span>收藏</span><b>${formatCount(details.bookmarks)}</b><span>流速</span><b>${formatVelocity(metrics?.velocity)}</b><span>评分</span><b>${details.score === null ? '未知' : details.score}</b><span>发帖时间</span><b>${details.publishedAt}</b></div>`;
    badge.dataset.state = Number.isFinite(metrics?.velocity) ? 'ready' : 'unknown';
  }

  function refresh() {
    document.querySelectorAll(SELECTOR).forEach(renderArticle);
    renderLeaderboard();
  }

  function scheduleRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 100);
  }

  function start() {
    injectStyles();
    if (observer) observer.disconnect();
    observer = new MutationObserver((mutations) => {
      const relevant = mutations.some((mutation) => {
        const target = mutation.target;
        if (target?.closest?.(`#${LEADERBOARD_ID}`)) return false;
        return [...mutation.addedNodes].some((node) => {
          if (node.nodeType !== 1) return true;
          return node.id !== LEADERBOARD_ID && !node.closest?.(`#${LEADERBOARD_ID}`);
        });
      });
      if (relevant) scheduleRefresh();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    refresh();
  }

  chrome.storage.local.get(XA_CONFIG.DEFAULTS).then((stored) => {
    settings = XA_CONFIG.mergeSettings(stored);
    start();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = {};
    Object.keys(changes).forEach((key) => { next[key] = changes[key].newValue; });
    settings = XA_CONFIG.mergeSettings({ ...settings, ...next });
    scheduleRefresh();
  });

  global.addEventListener?.('message', handleTweetMetrics);

  global.XA_TEST = Object.freeze({ articleId, statusIdFromHref, findTweetTarget, getArticleMetrics, matchesKeyword, formatVelocity });
})(globalThis);
