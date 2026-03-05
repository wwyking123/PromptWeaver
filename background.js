// ============================================================
// background.js — Service Worker
// Prompt Optimizer Chrome 插件核心 API 路由层
// ============================================================

// ── 元提示词（Meta-Prompt）────────────────────────────────────
function buildMetaPrompt(userText) {
  return `你是一个世界顶尖的 Prompt 工程师。你的任务是将用户提供的简短、模糊的文字，扩写为结构严谨、极具执行力的高级提示词。

【执行步骤】
第一步：分析意图。深入理解用户简短输入的真实目的。
第二步：动态匹配。根据意图，从以下 4 种专业框架中选择最合适的一种进行扩写：

1. [代码与工程框架] (适用于编程、算法、系统设计)
   - 角色设定与技术栈：
   - 业务背景与目标：
   - 核心开发任务：
   - 约束条件与边界处理：(如性能要求、异常捕获)
   - 输出格式：(要求提供注释、思路解析等)

2. [学术与逻辑推导框架] (适用于数学计算、物理推导、哲学理论探讨)
   - 角色设定与学术领域：
   - 核心问题与前置假设：
   - 拆解与推导步骤要求：(强制要求 Step-by-Step)
   - 论证深度与案例结合：
   - 输出规范：(要求使用清晰的数学符号或严谨的学术语言)

3. [文本与创意生成框架] (适用于写作、总结、翻译)
   - 角色设定与行文基调：
   - 目标受众与上下文：
   - 核心创作任务：
   - 风格、语气与特殊限制：
   - 输出格式：

4. [通用万能框架] (如果不属于以上三种)
   - 角色设定：
   - 背景信息：
   - 具体任务：
   - 输出要求：

【输出严格约束】
- 绝对不要输出你的分析过程或选择了哪个框架。
- 绝对不要输出任何前言、后语、解释或问候。
- 请直接输出最终扩写好的高级提示词文本。

【用户输入】
${userText}`;
}

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

  const metaPrompt = buildMetaPrompt(userText);

  const body = {
    model: config.model,
    messages: [
      { role: 'user', content: metaPrompt },
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

  const metaPrompt = buildMetaPrompt(userText);

  const body = {
    contents: [{
      role: 'user',
      parts: [{ text: metaPrompt }],
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

  const metaPrompt = buildMetaPrompt(userText);

  const body = {
    model: config.model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: metaPrompt }],
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
