// ============================================================
// background.js — Service Worker
// Prompt Optimizer Chrome 插件核心 API 路由层
// ============================================================

// ── 元提示词（Meta-Prompt）────────────────────────────────────
const META_PROMPT_SYSTEM = `你是一个顶尖的 Prompt 工程师。你的任务是将用户提供的简短、模糊的文字，扩写为一个结构清晰的专业提示词。

扩写后的提示词必须包含以下四个部分（用标题标注）：
1. 【角色设定】：定义 AI 应扮演的角色和专业背景
2. 【背景与上下文】：任务的背景信息和前提条件
3. 【核心任务】：明确、具体的目标和要求
4. 【输出规范】：对输出格式、长度、风格的具体要求

重要约束：
- 不改变原始意图，只扩展和完善细节
- 直接输出优化后的提示词，不要加任何解释性前缀（如"好的，这是优化后的..."）
- 使用简体中文`;

// ── 各 Provider 默认配置 ──────────────────────────────────────
const PROVIDER_DEFAULTS = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
  },
  kimi: {
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    model: 'gemini-1.5-flash',
  },
  claude: {
    baseUrl: 'https://api.anthropic.com',
    model: 'claude-3-haiku-20240307',
  },
};

// ── 消息监听入口 ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'optimizePrompt') {
    handleOptimize(request.text)
      .then(sendResponse)
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true; // 保持异步通道开放
  }
});

// ── 主处理函数 ────────────────────────────────────────────────
async function handleOptimize(userText) {
  // 1. 读取用户配置（新增 customModel）
  const settings = await chrome.storage.local.get(['provider', 'apiKey', 'customBaseUrl', 'customModel']);
  const provider = settings.provider || 'openai';
  const apiKey = settings.apiKey || '';
  const customBaseUrl = settings.customBaseUrl || '';
  const customModel = settings.customModel || '';   // 用户自定义模型名

  if (!apiKey) {
    return { success: false, error: '请先在插件设置中填写 API Key' };
  }

  // 2. 若用户指定了 customModel，临时覆盖该 provider 的默认 model
  //    不修改全局对象，只在本次调用中生效
  const providerConfig = {
    ...PROVIDER_DEFAULTS[provider],
    ...(customModel ? { model: customModel } : {}),
  };

  // 3. 路由到对应适配器
  try {
    let result;
    switch (provider) {
      case 'openai':
      case 'deepseek':
      case 'qwen':
      case 'kimi':
        result = await openaiCompatAdapter(providerConfig, apiKey, customBaseUrl, userText);
        break;
      case 'gemini':
        result = await geminiAdapter(providerConfig, apiKey, customBaseUrl, userText);
        break;
      case 'claude':
        result = await claudeAdapter(providerConfig, apiKey, customBaseUrl, userText);
        break;
      default:
        return { success: false, error: `未知的 Provider: ${provider}` };
    }
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ================================================================
// 适配器 1：OpenAI 兼容格式（OpenAI / DeepSeek / 千问 / Kimi）
// ================================================================
async function openaiCompatAdapter(config, apiKey, customBaseUrl, userText) {
  const baseUrl = customBaseUrl.trim() || config.baseUrl;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const body = {
    model: config.model,
    messages: [
      { role: 'system', content: META_PROMPT_SYSTEM },
      { role: 'user', content: `请优化以下提示词：\n\n${userText}` },
    ],
    temperature: 0.7,
    max_tokens: 2048,
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`API 请求失败 (${response.status}): ${parseErrorMessage(errText)}`);
  }

  const json = await response.json();
  return json.choices?.[0]?.message?.content?.trim() || '响应内容为空';
}

// ================================================================
// 适配器 2：Google Gemini
// ================================================================
async function geminiAdapter(config, apiKey, customBaseUrl, userText) {
  const baseUrl = customBaseUrl.trim() || config.baseUrl;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1beta/models/${config.model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: META_PROMPT_SYSTEM }] },
    contents: [{
      role: 'user',
      parts: [{ text: `请优化以下提示词：\n\n${userText}` }],
    }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini 请求失败 (${response.status}): ${parseErrorMessage(errText)}`);
  }

  const json = await response.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '响应内容为空';
}

// ================================================================
// 适配器 3：Anthropic Claude
// ================================================================
async function claudeAdapter(config, apiKey, customBaseUrl, userText) {
  const baseUrl = customBaseUrl.trim() || config.baseUrl;
  const endpoint = `${baseUrl.replace(/\/$/, '')}/v1/messages`;

  const body = {
    model: config.model,
    max_tokens: 2048,
    system: META_PROMPT_SYSTEM,
    messages: [{ role: 'user', content: `请优化以下提示词：\n\n${userText}` }],
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude 请求失败 (${response.status}): ${parseErrorMessage(errText)}`);
  }

  const json = await response.json();
  return json.content?.[0]?.text?.trim() || '响应内容为空';
}

// ── 错误信息解析工具 ──────────────────────────────────────────
function parseErrorMessage(errText) {
  try {
    const json = JSON.parse(errText);
    return (
      json?.error?.message ||
      json?.message ||
      json?.error ||
      errText.substring(0, 200)
    );
  } catch {
    return errText.substring(0, 200);
  }
}
