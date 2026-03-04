// ============================================================
// popup.js — 设置面板交互逻辑
// Prompt Optimizer Chrome 插件
// ============================================================

// ── API Key 提示文本映射 ───────────────────────────────────────
const KEY_HINTS = {
    openai: 'OpenAI API Key（格式：sk-...），从 platform.openai.com 获取',
    gemini: 'Google AI Studio API Key，从 aistudio.google.com 获取',
    claude: 'Anthropic API Key（格式：sk-ant-...），从 console.anthropic.com 获取',
    deepseek: 'DeepSeek API Key，从 platform.deepseek.com 获取',
    qwen: '阿里云 DashScope API Key，从 dashscope.aliyuncs.com 获取',
    kimi: 'Moonshot API Key，从 platform.moonshot.cn 获取',
};

const KEY_PLACEHOLDERS = {
    openai: 'sk-...',
    gemini: 'AIza...',
    claude: 'sk-ant-...',
    deepseek: '请输入 DeepSeek API Key',
    qwen: '请输入阿里云 DashScope API Key',
    kimi: '请输入 Moonshot API Key',
};

// ── 默认模型名（用于 placeholder 提示） ───────────────────────
const MODEL_PLACEHOLDERS = {
    openai: 'gpt-4o-mini',
    gemini: 'gemini-1.5-flash',
    claude: 'claude-3-haiku-20240307',
    deepseek: 'deepseek-chat',
    qwen: 'qwen-plus',
    kimi: 'moonshot-v1-8k',
};

// 第三方兼容提示（填写了 Base URL 时额外显示）
const MODEL_HINTS = {
    openai: '也可填写其他 OpenAI 兼容模型，如 gpt-4o、o1-mini',
    gemini: '可填写 gemini-1.5-pro、gemini-2.0-flash 等',
    claude: '可填写 claude-3-5-sonnet-20241022 等',
    deepseek: '可填写 deepseek-reasoner 等',
    qwen: '可填写 qwen-max、qwen-turbo 等',
    kimi: '可填写 moonshot-v1-32k、moonshot-v1-128k 等',
};

// ── DOM 元素引用 ───────────────────────────────────────────────
const providerEl = document.getElementById('provider');
const apiKeyEl = document.getElementById('apiKey');
const keyHintEl = document.getElementById('keyHint');
const toggleKeyBtn = document.getElementById('toggleKey');
const eyeIconEl = document.getElementById('eyeIcon');
const customBaseUrlEl = document.getElementById('customBaseUrl');
const customModelEl = document.getElementById('customModel');
const modelHintEl = document.getElementById('modelHint');
const advancedToggle = document.getElementById('advancedToggle');
const advancedContent = document.getElementById('advancedContent');
const advancedArrow = document.getElementById('advancedArrow');
const saveBtn = document.getElementById('saveBtn');
const saveBtnText = document.getElementById('saveBtnText');
const statusMsg = document.getElementById('statusMsg');

// ════════════════════════════════════════════════════════════
// 初始化：读取已保存配置并回填
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', async () => {
    const data = await chrome.storage.local.get(['provider', 'apiKey', 'customBaseUrl', 'customModel']);

    if (data.provider) providerEl.value = data.provider;
    if (data.apiKey) apiKeyEl.value = data.apiKey;
    if (data.customBaseUrl) customBaseUrlEl.value = data.customBaseUrl;
    if (data.customModel) customModelEl.value = data.customModel;

    // 如有自定义 URL 或 Model，自动展开高级设置
    if (data.customBaseUrl || data.customModel) openAdvanced();

    // 更新提示文本
    updateHints(providerEl.value);
});

// ════════════════════════════════════════════════════════════
// 事件绑定
// ════════════════════════════════════════════════════════════

// 模型切换 → 更新提示
providerEl.addEventListener('change', () => {
    updateHints(providerEl.value);
    clearStatus();
});

// 密码可见性切换
toggleKeyBtn.addEventListener('click', () => {
    const isPassword = apiKeyEl.type === 'password';
    apiKeyEl.type = isPassword ? 'text' : 'password';
    eyeIconEl.textContent = isPassword ? '🙈' : '👁';
});

// 高级设置折叠
advancedToggle.addEventListener('click', () => {
    advancedContent.classList.contains('open') ? closeAdvanced() : openAdvanced();
});

// 保存按钮
saveBtn.addEventListener('click', saveSettings);

// Enter 键快捷保存
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) saveSettings();
});

// ════════════════════════════════════════════════════════════
// 核心功能
// ════════════════════════════════════════════════════════════

async function saveSettings() {
    const provider = providerEl.value;
    const apiKey = apiKeyEl.value.trim();
    const customBaseUrl = customBaseUrlEl.value.trim();
    const customModel = customModelEl.value.trim();

    if (!apiKey) {
        showStatus('⚠️ 请先填写 API Key', 'error');
        apiKeyEl.focus();
        return;
    }

    saveBtn.disabled = true;
    saveBtnText.textContent = '保存中...';

    try {
        await chrome.storage.local.set({ provider, apiKey, customBaseUrl, customModel });
        showStatus('✅ 保存成功！设置已生效', 'success');
    } catch (err) {
        showStatus(`❌ 保存失败：${err.message}`, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtnText.textContent = '💾 保存设置';
    }
}

// ════════════════════════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════════════════════════

function updateHints(provider) {
    // Key 提示
    keyHintEl.textContent = KEY_HINTS[provider] || '';
    apiKeyEl.placeholder = KEY_PLACEHOLDERS[provider] || '请输入 API Key';
    // Model 提示
    customModelEl.placeholder = MODEL_PLACEHOLDERS[provider] || '留空使用默认模型';
    if (modelHintEl) modelHintEl.textContent = MODEL_HINTS[provider] || '';
}

function openAdvanced() {
    advancedContent.classList.add('open');
    advancedArrow.classList.add('open');
}

function closeAdvanced() {
    advancedContent.classList.remove('open');
    advancedArrow.classList.remove('open');
}

let statusTimer = null;

function showStatus(msg, type = 'success') {
    statusMsg.textContent = msg;
    statusMsg.className = `status-msg${type === 'error' ? ' error' : ''}`;
    clearTimeout(statusTimer);
    if (type !== 'error') {
        statusTimer = setTimeout(clearStatus, 3000);
    }
}

function clearStatus() {
    statusMsg.textContent = '';
    statusMsg.className = 'status-msg';
}
