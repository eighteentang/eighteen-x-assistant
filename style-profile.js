(function initStyleProfile(global) {
  const STORAGE_KEY = 'replyStyle';
  const MAX_SAMPLES = 100;
  const MAX_PROMPT_SAMPLES = 8;
  const EMPTY_PROFILE = {
    sampleCount: 0,
    averageLength: 0,
    averageSentences: 0,
    emojiRate: 0,
    questionRate: 0,
    exclamationRate: 0,
    paragraphRate: 0,
    tags: []
  };

  function defaultStore() {
    return { version: 1, samples: [], profile: { ...EMPTY_PROFILE }, updatedAt: null };
  }

  function countMatches(text, pattern) {
    return (String(text || '').match(pattern) || []).length;
  }

  function analyzeText(text) {
    const value = String(text || '').trim();
    const sentences = value.split(/[。！？!?；;\n]+/).map((item) => item.trim()).filter(Boolean);
    const paragraphs = value.split(/\n{2,}/).map((item) => item.trim()).filter(Boolean);
    const emoji = countMatches(value, /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu);
    const question = countMatches(value, /[?？]/g);
    const exclamation = countMatches(value, /[!！]/g);
    const tags = [];
    if (value.length <= 35) tags.push('短句');
    if (value.length >= 100) tags.push('展开');
    if (/因为|所以|关键|本质|说明|意味着|however|because|therefore/i.test(value)) tags.push('解释型');
    if (/我认为|我觉得|我的看法|in my view|i think/i.test(value)) tags.push('观点型');
    if (/你|是否|怎么|为何|why|how|do you/i.test(value)) tags.push('互动型');
    if (emoji === 0) tags.push('少用表情');
    if (question === 0) tags.push('少用问句');
    return {
      length: value.length,
      sentences: sentences.length || (value ? 1 : 0),
      emoji,
      question,
      exclamation,
      paragraphs: paragraphs.length || (value ? 1 : 0),
      tags
    };
  }

  function normalizeStore(value) {
    const source = value && typeof value === 'object' ? value : {};
    const samples = Array.isArray(source.samples)
      ? source.samples.filter((sample) => sample && typeof sample.text === 'string' && sample.text.trim()).slice(-MAX_SAMPLES)
      : [];
    return {
      version: 1,
      samples,
      profile: rebuildProfile(samples),
      updatedAt: source.updatedAt || null
    };
  }

  function rebuildProfile(samples) {
    if (!samples.length) return { ...EMPTY_PROFILE };
    const features = samples.map((sample) => sample.features || analyzeText(sample.text));
    const total = features.length;
    const average = (key) => Math.round(features.reduce((sum, item) => sum + Number(item[key] || 0), 0) / total * 10) / 10;
    const tagCounts = new Map();
    features.forEach((item) => (item.tags || []).forEach((tag) => tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)));
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .filter((entry) => entry[1] / total >= 0.3)
      .slice(0, 6)
      .map((entry) => entry[0]);
    return {
      sampleCount: total,
      averageLength: average('length'),
      averageSentences: average('sentences'),
      emojiRate: Math.round(features.filter((item) => item.emoji > 0).length / total * 100) / 100,
      questionRate: Math.round(features.filter((item) => item.question > 0).length / total * 100) / 100,
      exclamationRate: Math.round(features.filter((item) => item.exclamation > 0).length / total * 100) / 100,
      paragraphRate: Math.round(features.filter((item) => item.paragraphs > 1).length / total * 100) / 100,
      tags
    };
  }

  function addSample(store, text, context = {}) {
    const value = String(text || '').trim();
    if (!value) return normalizeStore(store);
    const current = normalizeStore(store);
    const sample = {
      id: `sample_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      text: value,
      context: String(context.context || '').trim().slice(0, 1200),
      sourceTweetId: String(context.sourceTweetId || ''),
      features: analyzeText(value),
      createdAt: new Date().toISOString()
    };
    const samples = [...current.samples, sample].slice(-MAX_SAMPLES);
    return { version: 1, samples, profile: rebuildProfile(samples), updatedAt: sample.createdAt };
  }

  function removeSample(store, id) {
    const current = normalizeStore(store);
    const samples = current.samples.filter((sample) => sample.id !== id);
    return { version: 1, samples, profile: rebuildProfile(samples), updatedAt: new Date().toISOString() };
  }

  function buildPrompt({ tweetText, store }) {
    const current = normalizeStore(store);
    const profile = current.profile;
    const recent = current.samples.slice(-MAX_PROMPT_SAMPLES).map((sample, index) => `${index + 1}. ${sample.text}`).join('\n');
    return `你是我的 X 回复助手。请只生成 3 条候选回复，不要自动发送。\n\n我的回复风格档案：\n- 样本数：${profile.sampleCount}\n- 平均长度：约 ${profile.averageLength} 字\n- 平均句数：${profile.averageSentences}\n- 常见风格：${profile.tags.join('、') || '尚未形成明显风格'}\n- 使用表情概率：${Math.round(profile.emojiRate * 100)}%\n- 使用问句概率：${Math.round(profile.questionRate * 100)}%\n\n我的最近风格样本：\n${recent || '暂无样本，请用自然、具体、克制的方式回复。'}\n\n当前要回复的帖子：\n${String(tweetText || '').trim()}\n\n要求：\n- 学习样本的表达方式，不要复制原句或冒充样本作者\n- 回复要具体，避免空泛夸赞和营销话术\n- 每条候选回复单独放在代码块中\n- 只输出候选回复，不要解释过程`;
  }

  const api = Object.freeze({
    STORAGE_KEY,
    MAX_SAMPLES,
    defaultStore,
    analyzeText,
    normalizeStore,
    rebuildProfile,
    addSample,
    removeSample,
    buildPrompt
  });
  global.XA_STYLE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
