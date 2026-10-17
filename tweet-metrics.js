(() => {
  if (!window.__xaNet || !window.XA_METRICS) return;
  const graphQlPattern = /\/graphql\//i;
  const cache = new Map();

  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'XA_METRICS_REQUEST') return;
    window.postMessage({ type: 'XA_TWEET_METRICS', tweets: [...cache.values()] }, '*');
  });

  async function readResponse(response) {
    try {
      if (typeof response.clone === 'function') return await response.clone().text();
      if (typeof response.text === 'function') return await response.text();
    } catch (_) {}
    return '';
  }

  window.__xaNet.onResponse(graphQlPattern, async ({ response }) => {
    const text = await readResponse(response);
    const tweets = window.XA_METRICS.cacheTweets(cache, window.XA_METRICS.parseResponseText(text));
    if (tweets.length) window.postMessage({ type: 'XA_TWEET_METRICS', tweets }, '*');
  });
})();
