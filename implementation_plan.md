# Bug 修复计划 — Prompt Optimizer v1.0

## 问题一：无法自定义模型名称（无法使用智谱 GLM 等第三方模型）

### 根本原因
[background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js) 中每个 provider 的 `model` 字段是**硬编码**的（如 `'qwen-plus'`），即便用户在高级设置填写了智谱的 Base URL，实际请求依然会用错误的模型名，导致 API 返回 404 或模型不存在错误。Popup 界面也没有提供模型名称输入框。

### 修复方案

#### [MODIFY] [popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html)
在高级设置折叠区的 Base URL 下方，**新增「自定义模型名」输入框** `#customModel`。

#### [MODIFY] [popup.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.js)
- 为每个 provider 预置默认 model placeholder（如选择 [openai](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#95-130) 时显示 `gpt-4o-mini`，选智谱时显示 `glm-4`）
- 监听 `provider` 切换事件，同步更新 model 输入框的 placeholder
- 保存/加载时读写 `customModel` 字段

#### [MODIFY] [background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js)
- 从 `chrome.storage.local` 读取 `customModel`
- 若用户填写了 `customModel`，则**覆盖**硬编码的默认 model 名再发起请求

> **说明**：智谱 GLM（`https://open.bigmodel.cn/api/paas/v4`）与 OpenAI Chat Completions 格式完全兼容，无需新增适配器，只需填写 Base URL + 模型名即可。

---

## 问题二：工具栏图标显示为破损图片（⊠）

### 根本原因
使用 PIL 对 AI 生成图片缩放后保存的 PNG 文件，在某些场景下可能存在元数据或色彩模式问题，导致 Chrome 图标无法正常渲染，显示为破损占位符（⊠）。

### 修复方案

#### [MODIFY] icons/icon16.png · icon48.png · icon128.png
放弃从 AI 生成图复用的方式，改为用 **Pillow 纯代码几何绘制**重新生成图标：
- 绘制紫色渐变圆形背景
- 中心渲染白色魔法棒 SVG 路径（或用文字 `🪄` 配合 `ImageDraw`）
- 强制输出为标准 `RGBA` → `RGB` 的合规 PNG，并验证文件头

> 如果 Pillow 绘制 emoji 存在字体兼容问题，则改为绘制简洁的白色「P」字母作为替代图标。

---

## 问题三：魔法棒按钮莫名消失

### 根本原因
[content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js) 中的 [handleFocusOut](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js#42-53) 存在两处缺陷：

```js
// 问题代码（当前）
setTimeout(() => {
  if (magicBtn && !magicBtn.matches(':hover') && !isLoading) {
    const related = document.activeElement;
    if (!isValidInput(related)) hideMagicButton(); // ← 过于激进
  }
}, 200);
```

1. **`:hover` 状态不可靠**：`setTimeout` 的 200ms 回调执行时，CSS `:hover` 状态在某些浏览器/场景下已失效，导致鼠标悬停在按钮上时仍触发隐藏
2. **ChatGPT 等页面的焦点抖动**：这类页面的输入框是多层嵌套结构，内部点击会产生短暂的 `focusout` → `focusin` 序列，触发了错误的隐藏逻辑
3. **`relatedTarget` 未被检查**：标准做法是先检查 `event.relatedTarget`（焦点去往的元素）是否就是按钮本身，若是则直接跳过隐藏

### 修复方案

#### [MODIFY] [content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js)
采用**双轨道防抖机制**：

```js
// 修复方案（伪代码）
let isButtonHovered = false;  // 用事件精确追踪，不依赖 CSS :hover

magicBtn.addEventListener('mouseenter', () => isButtonHovered = true);
magicBtn.addEventListener('mouseleave', () => isButtonHovered = false);

function handleFocusOut(event) {
  // 优先检查：焦点是否直接移入了按钮
  if (event.relatedTarget === magicBtn) return;

  setTimeout(() => {
    // 按钮 hover 中 或 正在 loading → 不隐藏
    if (isButtonHovered || isLoading) return;
    // 焦点转移到了另一个有效输入框 → 不隐藏（会由 focusin 重新定位）
    if (isValidInput(document.activeElement)) return;
    hideMagicButton();
  }, 300); // 延迟略微加大，给页面内焦点切换留余量
}
```

---

## 改动文件汇总

| 文件 | 改动内容 |
|------|---------|
| [popup/popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html) | 高级设置区新增 `#customModel` 输入框 |
| [popup/popup.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.js) | 读写 `customModel`；provider 切换时更新 model placeholder |
| [background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js) | 读取 `customModel` 并覆盖默认 model 名 |
| [content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js) | 引入 `isButtonHovered`；检查 `relatedTarget`；延迟改 300ms |
| `icons/*.png` | 用 Pillow 纯代码重新绘制生成 |

---

## 项目文件目录树

```
f:\VScode Files\vibe_coding\Prompt Optimizer\
│
├── manifest.json           # 插件核心配置 (MV3)
├── background.js           # Service Worker：API路由、消息枢纽
├── content.js              # 内容脚本：注入魔法棒按钮、文本回填
│
├── popup/
│   ├── popup.html          # 设置面板：模型选择、Key输入、高级设置
│   ├── popup.css           # 设置面板样式
│   └── popup.js            # 设置面板逻辑：存储读写、UI交互
│
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 各文件职责详述

### [manifest.json](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/manifest.json)
- `manifest_version: 3`，声明插件名称、版本、描述
- `permissions`: `["storage", "activeTab", "scripting"]`
- `host_permissions`: `["<all_urls>"]`（允许在所有页面注入 content script）
- `background.service_worker`: 指向 [background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js)
- `action.default_popup`: 指向 [popup/popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html)
- `content_scripts`: 配置 [content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js) 注入到所有 URL (`matches: ["<all_urls>"]`)
- `icons`: 绑定三个尺寸图标

---

### [popup/popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html)
- 顶部 Logo + 插件名称标题栏
- **模型选择区**：`<select id="provider">` 含六个 `<option>`：
  - [openai](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#95-130) → OpenAI (GPT)
  - [gemini](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#131-170) → Google Gemini
  - [claude](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#171-206) → Anthropic Claude
  - `deepseek` → DeepSeek
  - `qwen` → 通义千问 (Qwen)
  - `kimi` → Kimi (Moonshot)
- **API Key 输入区**：`<input type="password" id="apiKey">`，placeholder 根据当前选择的 provider 动态变化
- **高级设置（可折叠）**：点击展开，内含 `<input id="customBaseUrl">` 用于自定义 Base URL（兼容 OneAPI / 本地代理）
- **保存按钮** + 状态反馈区（保存成功/失败提示）
- **安全提示**：小字注明"密钥仅保存在本地浏览器，不会上传任何服务器"
- `<link>` 引入 [popup.css](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.css)；`<script>` 引入 [popup.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.js)

---

### [popup/popup.css](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.css)
- 整体风格：深色主题（Dark mode），圆角卡片式布局，精简美观
- 颜色系统：使用 CSS 变量（`--primary`, `--bg`, `--text` 等）
- 输入框聚焦效果、按钮 Hover/Active 动画
- 高级设置折叠区：CSS `max-height` 过渡动画实现平滑展开/收起
- 响应式控制弹出窗口宽度固定（建议 360px）

---

### [popup/popup.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.js)

**核心职责：**
1. **初始化加载**：`DOMContentLoaded` 时从 `chrome.storage.local` 读取已保存的 `provider`、`apiKey` 和 `customBaseUrl`，回填到表单
2. **动态 Placeholder**：监听 `provider` 的 `change` 事件，根据选择更新 `apiKey` 输入框的提示文本（如选择 Gemini 显示"输入 Google AI Studio API Key"）
3. **高级设置折叠**：点击"高级设置"标签，切换折叠内容区的 class 控制展开/收起
4. **保存逻辑**：点击保存按钮 → 收集表单数据 → `chrome.storage.local.set(...)` → 显示"✅ 保存成功"提示 2 秒后消失

---

### [content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js) — 网页交互核心

**核心职责：**

**① 检测激活输入框（聚焦监听）**
```js
// 监听聚焦事件（捕获阶段）
document.addEventListener('focusin', handleFocusIn, true);

function handleFocusIn(event) {
  const target = event.target;
  // 检测 textarea 或 contenteditable div
  if (isValidInput(target)) {
    attachMagicButton(target);
  }
}
```

**② 注入魔法棒按钮**
- 创建一个绝对定位的 `div.prompt-optimizer-btn`（包含🪄图标）
- 计算目标输入框的 `getBoundingClientRect()` 动态定位到其右下角
- 监听 `scroll` 和 `resize` 更新位置
- 同一个输入框若已注入则不重复添加

**③ 点击事件处理**
```js
magicBtn.addEventListener('click', async () => {
  const text = getInputText(activeInput); // 兼容 value / innerText
  if (!text.trim()) {
    showToast('请先在输入框内输入内容！'); return;
  }
  setButtonLoading(true); // 显示旋转Loading
  
  // 向 background 发消息
  const response = await chrome.runtime.sendMessage({
    action: 'optimizePrompt',
    text: text
  });
  
  if (response.success) {
    setInputText(activeInput, response.result); // 回填优化后的文本
  } else {
    showToast(`错误：${response.error}`);
  }
  setButtonLoading(false);
});
```

**④ 文本读写兼容层**
- 普通 `<textarea>`：读写 `.value`，触发 `input` 事件（保证 React/Vue 响应式更新）
- `contenteditable div`：读写 `innerText`，同样 `dispatchEvent` 触发框架感知

---

### [background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js) — 多模型 API 适配器

**消息监听入口：**
```js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'optimizePrompt') {
    handleOptimize(request.text).then(sendResponse);
    return true; // 保持通道异步开放
  }
});
```

**核心流程 [handleOptimize(userText)](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#58-94)：**
```
1. 读取配置
   settings = await chrome.storage.local.get(['provider','apiKey','customBaseUrl'])

2. 组装元提示词 (Meta-Prompt)
   systemPrompt = "你是一个顶尖的 Prompt 工程师..."
   userPrompt   = `请优化以下提示词：${userText}`

3. 路由到对应适配器
   switch(settings.provider) {
     case 'openai':   return openaiAdapter(...)
     case 'gemini':   return geminiAdapter(...)
     case 'claude':   return claudeAdapter(...)
     case 'deepseek': return deepseekAdapter(...)
   }

4. 统一返回格式
   { success: true, result: "..." }
   或
   { success: false, error: "错误描述" }
```

**适配器设计详解（伪代码）：**

```
┌─────────────────────────────────────────────────────────┐
│                   API 适配器模式                         │
├──────────────┬──────────────────────────────────────────┤
│ Provider     │ 实现细节                                  │
├──────────────┼──────────────────────────────────────────┤
│ openai       │ Endpoint: https://api.openai.com/v1/      │
│ deepseek     │   chat/completions                        │
│ qwen         │ Body: { model, messages:[system,user],    │
│ kimi         │   temperature:0.7, max_tokens:2048 }      │
│ (共用OpenAI  │ Header: Authorization: Bearer {apiKey}    │
│  兼容格式)   │ 解析: json.choices[0].message.content     │
│              │ 各自默认 Base URL：                       │
│              │   deepseek: api.deepseek.com/v1           │
│              │   qwen:     dashscope.aliyuncs.com/       │
│              │             compatible-mode/v1            │
│              │   kimi:     api.moonshot.cn/v1            │
│              │ customBaseUrl → 优先替换 Base URL         │
├──────────────┼──────────────────────────────────────────┤
│ gemini       │ Endpoint: https://generativelanguage.     │
│              │   googleapis.com/v1beta/models/           │
│              │   gemini-pro:generateContent?key={apiKey} │
│              │ Body: { contents:[{parts:[{text:...}]}],  │
│              │   systemInstruction:{parts:[{text:...}]}  │
│              │ 解析: json.candidates[0].content.parts    │
│              │   [0].text                                │
│              │ customBaseUrl → 替换整个 Endpoint         │
├──────────────┼──────────────────────────────────────────┤
│ claude       │ Endpoint: https://api.anthropic.com/      │
│              │   v1/messages                             │
│              │ Body: { model, max_tokens, system,        │
│              │   messages:[{role:user, content:...}] }   │
│              │ Header: x-api-key: {apiKey},              │
│              │   anthropic-version: "2023-06-01"         │
│              │ 解析: json.content[0].text                │
│              │ customBaseUrl → 替换 Base URL 前缀        │
└──────────────┴──────────────────────────────────────────┘
```

**错误处理链：**
```
try {
  const res = await fetch(...)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`)
  return { success: true, result: parseResponse(json) }
} catch(e) {
  return { success: false, error: e.message }
}
```

---

## 元提示词（Meta-Prompt）设计

```
【系统提示词】
你是一个顶尖的 Prompt 工程师。你的任务是将用户提供的简短、模糊的文字，
扩写为一个结构清晰的专业提示词。

扩写后的提示词必须包含以下四个部分（用标题标注）：
1. 【角色设定】：定义 AI 应扮演的角色和专业背景
2. 【背景与上下文】：任务的背景信息和前提条件
3. 【核心任务】：明确、具体的目标和要求
4. 【输出规范】：对输出格式、长度、风格的具体要求

重要约束：
- 不改变原始意图，只扩展和完善细节
- 直接输出优化后的提示词，不要加任何解释或前缀

【用户输入】
${userText}
```

---

## 技术难点与解决方案

| 难点 | 解决方案 |
|------|----------|
| 跨框架 textarea/contenteditable 兼容 | `focusin` 捕获阶段监听 + 区分 value/innerText + 手动触发 input/inputEvent 保证 React/Vue 更新 |
| 魔法棒按钮定位漂移 | 监听 scroll/resize 事件实时重新计算位置；用 `fixedOffset` 配合 `getBoundingClientRect` 确保吸附精确 |
| Background 异步消息 | `onMessage.addListener` 返回 `true` 保持通道开放；使用 async/await |
| Claude CORS 限制 | background.js 是 Service Worker，不受浏览器 CORS 限制，可以直接调用 Claude API |
| 同页面多输入框 | 维护 `currentButton` 引用，聚焦新输入框时移动（而非重新创建）按钮 |

---

## 分阶段开发计划

### 阶段 1：骨架搭建（Step 1）
- [ ] 创建项目目录，生成 [manifest.json](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/manifest.json)
- [ ] 创建三个占位文件：[background.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js)、[content.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/content.js)、[popup/popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html)
- [ ] 在 Chrome 中加载，验证插件可正常识别

### 阶段 2：Popup 设置面板（Step 2）
- [ ] 编写完整的 [popup.html](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.html) + [popup.css](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.css)（深色主题UI）
- [ ] 编写 [popup.js](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/popup/popup.js) 实现 Storage 读写和动态 Placeholder

### 阶段 3：Background API 适配器（Step 3）
- [ ] 实现 [handleOptimize](file:///f:/VScode%20Files/vibe_coding/Prompt%20Optimizer/background.js#58-94) 主函数和消息监听
- [ ] 实现 OpenAI/DeepSeek 适配器（共用格式）
- [ ] 实现 Gemini 适配器
- [ ] 实现 Claude 适配器
- [ ] 完善错误处理

### 阶段 4：Content Script 注入（Step 4）
- [ ] 实现 `focusin` 监听与输入框检测
- [ ] 实现魔法棒按钮的创建、定位与样式
- [ ] 实现点击事件、Loading 状态与文本回填
- [ ] 实现 Toast 提示组件

### 阶段 5：整合测试（Step 5）
- [ ] 在 ChatGPT / Claude.ai / Gemini 页面实测
- [ ] 验证各提供商 API 调用
- [ ] 边界情况测试（空文本、无 Key、Key 错误）

---

## 验证计划

### 手动验证步骤
1. 打开 `chrome://extensions/`，开启开发者模式，点击"加载已解压的扩展程序"，选择项目根目录
2. 点击插件图标，打开 Popup，选择 OpenAI，输入有效 Key，点击保存 → 应显示"✅ 保存成功"
3. 打开 `https://chat.openai.com`，点击输入框 → 右下角应出现🪄按钮
4. 在输入框输入 "写一篇文章" → 点击🪄 → 等待 2-5 秒 → 输入框内容应被替换为结构化提示词
5. 测试空输入的 Toast 提示
6. 测试错误 Key 的 Toast 错误提示
7. 重复测试其他 Provider（Gemini、Claude、DeepSeek）
