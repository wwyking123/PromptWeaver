# 🪄 Prompt Optimizer

> 一个轻量级的 Chrome 插件，利用大模型（如 OpenAI、Gemini、Claude、DeepSeek 等）将你简短、模糊的输入一键扩写为结构化的专业提示词。支持 BYOK（自带密钥），无后端，纯本地运行，保护隐私。 A lightweight Chrome extension that uses LLMs (OpenAI, Gemini, Claude, DeepSeek) to instantly expand your short, vague inputs into highly structured, professional prompts. BYOK supported, backend-free, and privacy-focused.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-blueviolet)
![License](https://img.shields.io/badge/License-MIT-green)

---

## ✨ 功能简介

在使用 ChatGPT、Claude、Gemini 等网页版 AI 时，只需在输入框中写下简短的想法，点击右下角的 🪄 魔法棒按钮，插件会**自动识别意图**，从 4 种专业框架（代码工程 / 学术推导 / 文本创意 / 通用万能）中动态匹配最合适的一种，扩写为结构严谨、极具执行力的高级提示词。

🖱️ **魔法棒按钮支持自由拖拽**，遮挡输入框时随手拖到其他位置即可。

**生成结果不会直接替换原文**，而是弹出预览面板，你可以：
- ✅ **接受并使用** — 将结果（可手动编辑）填入输入框
- 🔄 **重新生成** — 重新调用 AI 生成新版本
- ✕ **取消** — 关闭面板，保留原文

---

## 🤖 支持的模型

| 提供商 | 默认模型 | API 文档 |
|--------|---------|---------|
| OpenAI | gpt-4o-mini | [platform.openai.com](https://platform.openai.com) |
| Google Gemini | gemini-1.5-flash | [aistudio.google.com](https://aistudio.google.com) |
| Anthropic Claude | claude-3-haiku-20240307 | [console.anthropic.com](https://console.anthropic.com) |
| DeepSeek | deepseek-chat | [platform.deepseek.com](https://platform.deepseek.com) |
| 通义千问 | qwen-plus | [dashscope.aliyuncs.com](https://dashscope.aliyuncs.com) |
| Kimi | moonshot-v1-8k | [platform.moonshot.cn](https://platform.moonshot.cn) |
| **任意兼容 OpenAI 格式的模型**（如智谱 GLM、本地模型等）| 自定义 | 填写 Base URL + 模型名即可 |

> **BYOK（自带密钥）**：插件无后端服务器，所有 API 密钥仅保存在本地浏览器，绝不上传。

---

## 📦 安装方法

### 方式一：加载未打包扩展（开发/本地使用）

1. 下载或克隆本仓库到本地
2. 打开 Chrome，访问 `chrome://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择项目根目录（含 `manifest.json` 的那一层）
5. 插件图标出现在工具栏即安装成功 🎉

---

## 🚀 使用方法

### 第一步：配置 API Key

1. 点击工具栏中的 🪄 图标，打开设置面板
2. 选择**模型提供商**
3. 填写对应的 **API Key**
4. 点击 **💾 保存设置**

### 第二步：使用优化功能

1. 打开任意 AI 网站（ChatGPT、Claude.ai、Gemini、DeepSeek 等）
2. 点击聊天输入框，右下角出现 🪄 按钮
3. 在输入框中输入简短想法，如：`帮我写一封邮件`
4. 点击 🪄 按钮，等待 2~5 秒
5. 预览面板弹出，查看、编辑或接受生成的结构化提示词

### 高级设置

展开设置面板中的 **⚙️ 高级设置** 可配置：

- **自定义 Base URL**：支持 OneAPI、本地代理（如 Ollama）等转发服务
- **自定义模型名**：可指定任意模型名称（如 `glm-4`、`gpt-4o`、`claude-3-5-sonnet-20241022`）

**使用智谱 GLM 示例：**
```
提供商：OpenAI（选任意 OpenAI 兼容格式）
Base URL：https://open.bigmodel.cn/api/paas/v4
模型名：glm-4
```

---

## 📁 项目结构

```
Prompt Optimizer/
├── manifest.json        # 插件配置 (Manifest V3)
├── background.js        # Service Worker：动态意图识别 + 多模型 API 适配器
├── content.js           # Content Script：可拖拽魔法棒按钮 & 预览浮层
├── CHANGELOG.md         # 更新日志
├── popup/
│   ├── popup.html       # 设置面板
│   ├── popup.css        # 深色主题样式
│   └── popup.js         # 设置逻辑（Storage 读写）
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 🔒 隐私说明

- API Key 使用 `chrome.storage.local` 存储，**仅保留在本地设备**
- 插件**无任何后端服务器**，不收集任何用户数据
- 网络请求仅发往你所选择的 AI 服务商

---

## 🛠️ 技术栈

- **原生 HTML / CSS / JavaScript (ES6+)**，无任何框架和构建工具
- **Chrome Extension Manifest V3**
- API 适配器支持 OpenAI Chat Completions 格式、Google Gemini API、Anthropic Messages API

---

## 📋 更新日志

详见 [CHANGELOG.md](./CHANGELOG.md)

---

## 📄 License

MIT License © 2026
