(() => {
  const ENDPOINT = 'https://grok.x.com/2/grok/add_response.json';
  let capturedTxId = window.__xaGrok?.capturedTxId || null;

  window.__xaNet?.onRequest(/\/2\/grok\/add_response\.json/, ({ headers }) => {
    const tx = headers?.['x-client-transaction-id'];
    if (typeof tx === 'string' && tx.length >= 16) capturedTxId = tx;
  });

  function cookieValue(name) {
    const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]) : '';
  }

  function conversationId() {
    try {
      const epoch = 1288834974657n;
      return String(((BigInt(Date.now()) - epoch) << 22n) + BigInt(Math.floor(Math.random() * 4194304)));
    } catch (_) {
      return `${Date.now()}${Math.floor(Math.random() * 1000000)}`;
    }
  }

  function buildBody(prompt) {
    return JSON.stringify({
      responses: [{ message: prompt, sender: 1, promptSource: '', fileAttachments: [] }],
      systemPromptName: '',
      grokModelOptionId: 'grok-3-latest',
      modelMode: 'MODEL_MODE_FAST',
      conversationId: conversationId(),
      returnSearchResults: false,
      returnCitations: false,
      promptMetadata: { promptSource: 'NATURAL', action: 'INPUT' },
      imageGenerationCount: 0,
      requestFeatures: { eagerTweets: false, serverHistory: false },
      enableSideBySide: true,
      toolOverrides: {},
      modelConfigOverride: {},
      isTemporaryChat: true
    });
  }

  function extractFinalText(raw) {
    return String(raw || '').split(/\r?\n/).map((line) => {
      try {
        const payload = JSON.parse(line);
        const result = payload?.result || payload;
        return result?.sender === 'ASSISTANT' && result?.messageTag === 'final' && typeof result.message === 'string' ? result.message : '';
      } catch (_) { return ''; }
    }).join('');
  }

  function extractCandidates(raw) {
    const text = extractFinalText(raw) || String(raw || '');
    const blocks = [...text.matchAll(/```(?:[\w-]+)?\s*([\s\S]*?)```/g)].map((match) => match[1].trim()).filter(Boolean);
    const source = blocks.length ? blocks.join('\n') : text;
    const list = source.split(/\n+(?=\s*(?:\d+[.)]|[-*])\s+)/).map((item) => item.replace(/^\s*(?:\d+[.)]|[-*])\s+/, '').trim()).filter((item) => item.length >= 2 && item.length <= 1000);
    return [...new Set((list.length ? list : blocks).filter(Boolean))].slice(0, 10);
  }

  async function generate(prompt) {
    if (!capturedTxId) throw new Error('请先打开 x.com/i/grok 并手动发一条消息，插件才能获得当前会话签名。');
    const headers = {
      authorization: window.__xaNet?.getBearer() || '',
      'content-type': 'text/plain;charset=UTF-8',
      accept: '*/*',
      'x-csrf-token': cookieValue('ct0'),
      'x-twitter-active-user': 'yes',
      'x-twitter-auth-type': 'OAuth2Session',
      'x-twitter-client-language': navigator.language?.toLowerCase() || 'en',
      'x-xai-request-id': crypto.randomUUID(),
      'x-client-transaction-id': capturedTxId
    };
    if (!headers.authorization) throw new Error('未捕获到 X 登录会话。请先打开 x.com/i/grok 并发送一条消息。');
    const response = await (window.__xaNet?.originalFetch || window.fetch)(ENDPOINT, { method: 'POST', headers, body: buildBody(prompt), credentials: 'include' });
    const raw = await response.text();
    if (!response.ok) throw new Error(`Grok 请求失败：${response.status}`);
    const candidates = extractCandidates(raw);
    if (!candidates.length) throw new Error('Grok 返回中没有解析到候选回复。');
    return candidates;
  }

  window.__xaGrok = { generate, extractFinalText, extractCandidates, get capturedTxId() { return capturedTxId; } };
  window.addEventListener('message', async (event) => {
    if (event.source !== window || event.data?.type !== 'XA_GROK_GENERATE') return;
    const { requestId, prompt } = event.data;
    try {
      const candidates = await generate(prompt);
      window.postMessage({ type: 'XA_GROK_RESULT', requestId, candidates }, '*');
    } catch (error) {
      window.postMessage({ type: 'XA_GROK_RESULT', requestId, error: error?.message || 'Grok 生成失败' }, '*');
    }
  });
})();
