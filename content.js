// ============================================================
// content.js — Content Script
// Prompt Optimizer 网页交互层：注入魔法棒按钮 & 预览浮层
// ============================================================

(function () {
  'use strict';

  // ── 常量 ──────────────────────────────────────────────────
  const BTN_ID = 'prompt-optimizer-magic-btn';
  const TOAST_ID = 'prompt-optimizer-toast';
  const PANEL_ID = 'prompt-optimizer-preview-panel';
  const OVERLAY_ID = 'prompt-optimizer-overlay';
  const BTN_OFFSET_RIGHT = 10;
  const BTN_OFFSET_BOTTOM = 10;
  const BTN_SIZE = 38;

  // ── 状态 ──────────────────────────────────────────────────
  let activeInput = null;
  let magicBtn = null;
  let isLoading = false;
  let isButtonHovered = false;
  let lastGeneratedText = '';   // 缓存最后一次生成结果（供重新生成前保存原文）
  let originalText = '';   // 用户原始输入（供重新生成时参考）

  // ── 拖拽状态 ────────────────────────────────────────────────
  let isDragging = false;           // 当前是否处于拖拽中
  let dragStartX = 0;               // mousedown 时的鼠标 X
  let dragStartY = 0;               // mousedown 时的鼠标 Y
  let dragBtnStartX = 0;            // mousedown 时按钮的 left
  let dragBtnStartY = 0;            // mousedown 时按钮的 top
  let hasDragged = false;           // 本次 mousedown→mouseup 是否超过阈值
  const DRAG_THRESHOLD = 5;         // 区分 click 与 drag 的像素阈值
  let dragOffsetX = 0;              // 用户拖拽后相对于自动定位的 X 偏移
  let dragOffsetY = 0;              // 用户拖拽后相对于自动定位的 Y 偏移
  let hasUserDragged = false;       // 用户是否手动拖拽过（用于决定是否跟随输入框）

  // ── 初始化 ─────────────────────────────────────────────────
  injectStyles();
  document.addEventListener('focusin', handleFocusIn, true);
  document.addEventListener('focusout', handleFocusOut, true);
  window.addEventListener('scroll', updateButtonPosition, true);
  window.addEventListener('resize', updateButtonPosition);

  // ════════════════════════════════════════════════════════════
  // 焦点事件处理
  // ════════════════════════════════════════════════════════════

  function handleFocusIn(event) {
    const target = event.target;
    // 点击预览面板内时不处理
    const panel = document.getElementById(PANEL_ID);
    if (panel && panel.contains(target)) return;

    if (isValidInput(target)) {
      activeInput = target;
      showMagicButton(target);
    }
  }

  function handleFocusOut(event) {
    if (event.relatedTarget === magicBtn) return;
    // 面板打开中，不允许按钮随焦点消失
    if (document.getElementById(PANEL_ID)) return;

    setTimeout(() => {
      if (isButtonHovered || isLoading) return;
      if (isValidInput(document.activeElement)) return;
      hideMagicButton();
    }, 300);
  }

  function isValidInput(el) {
    if (!el) return false;
    if (el.tagName === 'TEXTAREA') return true;
    if (el.tagName === 'INPUT' && ['text', 'search', ''].includes(el.type || '')) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // ════════════════════════════════════════════════════════════
  // 魔法棒按钮
  // ════════════════════════════════════════════════════════════

  function showMagicButton(inputEl) {
    if (!magicBtn) {
      magicBtn = createMagicButton();
      document.body.appendChild(magicBtn);
    }
    // 切换到新输入框时重置拖拽偏移
    if (activeInput !== inputEl) {
      hasUserDragged = false;
      dragOffsetX = 0;
      dragOffsetY = 0;
    }
    positionButton(inputEl);
    magicBtn.style.opacity = '1';
    magicBtn.style.pointerEvents = 'auto';
  }

  function hideMagicButton() {
    if (magicBtn) {
      magicBtn.style.opacity = '0';
      magicBtn.style.pointerEvents = 'none';
    }
  }

  function createMagicButton() {
    const btn = document.createElement('div');
    btn.id = BTN_ID;
    btn.setAttribute('title', 'Prompt Optimizer：一键优化提示词（可拖拽）');
    btn.innerHTML = `
      <span class="po-btn-icon">🪄</span>
      <span class="po-btn-spinner"></span>
    `;
    btn.addEventListener('mouseenter', () => { isButtonHovered = true; });
    btn.addEventListener('mouseleave', () => { isButtonHovered = false; });

    // ── 拖拽 + 点击 统一处理 ──
    btn.addEventListener('mousedown', onDragStart);
    return btn;
  }

  // ── 拖拽事件处理 ────────────────────────────────────────────
  function onDragStart(e) {
    // 只响应鼠标左键
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDragging = true;
    hasDragged = false;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragBtnStartX = parseInt(magicBtn.style.left, 10) || 0;
    dragBtnStartY = parseInt(magicBtn.style.top, 10) || 0;

    magicBtn.classList.add('po-grabbing');
    document.addEventListener('mousemove', onDragMove, true);
    document.addEventListener('mouseup', onDragEnd, true);
  }

  function onDragMove(e) {
    if (!isDragging) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;

    // 判定是否超过拖拽阈值
    if (!hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      hasDragged = true;
    }

    if (hasDragged) {
      magicBtn.style.left = `${dragBtnStartX + dx}px`;
      magicBtn.style.top = `${dragBtnStartY + dy}px`;
    }
  }

  function onDragEnd(e) {
    if (!isDragging) return;
    isDragging = false;
    magicBtn.classList.remove('po-grabbing');
    document.removeEventListener('mousemove', onDragMove, true);
    document.removeEventListener('mouseup', onDragEnd, true);

    if (hasDragged) {
      // 拖拽完成 → 记录偏移量，使按钮停留在新位置
      hasUserDragged = true;
      if (activeInput) {
        const rect = activeInput.getBoundingClientRect();
        const autoLeft = rect.right - BTN_SIZE - BTN_OFFSET_RIGHT;
        const autoTop = rect.bottom - BTN_SIZE - BTN_OFFSET_BOTTOM;
        dragOffsetX = parseInt(magicBtn.style.left, 10) - autoLeft;
        dragOffsetY = parseInt(magicBtn.style.top, 10) - autoTop;
      }
    } else {
      // 移动距离未超过阈值 → 视为点击
      handleButtonClick();
    }
  }

  function positionButton(inputEl) {
    if (!magicBtn || !inputEl) return;
    // 使用 fixed 定位，直接用 getBoundingClientRect（视口坐标）
    const rect = inputEl.getBoundingClientRect();
    const baseLeft = rect.right - BTN_SIZE - BTN_OFFSET_RIGHT;
    const baseTop = rect.bottom - BTN_SIZE - BTN_OFFSET_BOTTOM;
    magicBtn.style.left = `${baseLeft + (hasUserDragged ? dragOffsetX : 0)}px`;
    magicBtn.style.top = `${baseTop + (hasUserDragged ? dragOffsetY : 0)}px`;
  }

  function updateButtonPosition() {
    // 拖拽过程中不重新定位，避免跳动
    if (isDragging) return;
    if (activeInput && magicBtn && magicBtn.style.opacity !== '0') {
      positionButton(activeInput);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 点击事件：调用 API → 显示预览浮层
  // ════════════════════════════════════════════════════════════

  async function handleButtonClick() {
    if (isLoading) return;
    if (!activeInput) return;

    const text = getInputText(activeInput);
    if (!text.trim()) {
      showToast('💡 请先在输入框中输入一些内容');
      return;
    }

    originalText = text.trim();
    await doGenerate(originalText);
  }

  // 封装生成逻辑（首次 + 重新生成复用）
  async function doGenerate(userText) {
    setLoading(true);
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'optimizePrompt',
        text: userText,
      });

      if (response.success) {
        lastGeneratedText = response.result;
        showPreviewPanel(response.result);
      } else {
        showToast(`❌ ${response.error}`, true);
      }
    } catch (err) {
      showToast(`❌ 连接失败：${err.message}`, true);
    } finally {
      setLoading(false);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 预览浮层
  // ════════════════════════════════════════════════════════════

  function showPreviewPanel(text) {
    // 先移除旧面板
    removePreviewPanel();

    // 半透明遮罩（点击可关闭）
    const overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.addEventListener('click', removePreviewPanel);
    document.body.appendChild(overlay);

    // 主面板
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    // 阻止面板内的点击冒泡到遮罩
    panel.addEventListener('click', (e) => e.stopPropagation());

    // 标题栏
    const header = document.createElement('div');
    header.className = 'po-panel-header';
    header.innerHTML = `
      <span class="po-panel-title">✨ 优化结果预览</span>
      <button class="po-panel-close" title="关闭">✕</button>
    `;
    header.querySelector('.po-panel-close').addEventListener('click', removePreviewPanel);

    // 原文对比区（可选，折叠展示）
    const originalSection = document.createElement('div');
    originalSection.className = 'po-panel-original';
    originalSection.textContent = `📝 原始输入：${originalText.substring(0, 80)}${originalText.length > 80 ? '…' : ''}`;

    // 结果文本区（可编辑，方便用户微调）
    const textarea = document.createElement('textarea');
    textarea.className = 'po-panel-textarea';
    textarea.value = text;
    textarea.setAttribute('spellcheck', 'false');
    // 防止 textarea 聚焦时触发 focusin 逻辑
    textarea.addEventListener('mousedown', (e) => e.stopPropagation());

    // 字数统计
    const counter = document.createElement('div');
    counter.className = 'po-panel-counter';
    counter.textContent = `${text.length} 字`;
    textarea.addEventListener('input', () => {
      counter.textContent = `${textarea.value.length} 字`;
    });

    // 操作按钮区
    const actions = document.createElement('div');
    actions.className = 'po-panel-actions';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'po-action-btn po-btn-cancel';
    btnCancel.innerHTML = '✕ 取消';
    btnCancel.addEventListener('click', removePreviewPanel);

    const btnRegen = document.createElement('button');
    btnRegen.className = 'po-action-btn po-btn-regen';
    btnRegen.innerHTML = '🔄 重新生成';
    btnRegen.addEventListener('click', async () => {
      removePreviewPanel();
      await doGenerate(originalText);
    });

    const btnAccept = document.createElement('button');
    btnAccept.className = 'po-action-btn po-btn-accept';
    btnAccept.innerHTML = '✅ 接受并使用';
    btnAccept.addEventListener('click', () => {
      // 用面板中可能被用户编辑过的内容（不一定是原始生成结果）
      const finalText = textarea.value;
      removePreviewPanel();
      if (activeInput) {
        setInputText(activeInput, finalText);
        showToast('✅ 提示词已插入输入框！');
      }
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnRegen);
    actions.appendChild(btnAccept);

    // 组装面板
    panel.appendChild(header);
    panel.appendChild(originalSection);
    panel.appendChild(textarea);
    panel.appendChild(counter);
    panel.appendChild(actions);
    document.body.appendChild(panel);

    // 进场动画
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        overlay.classList.add('po-overlay-show');
        panel.classList.add('po-panel-show');
      });
    });

    // 自动聚焦 textarea
    setTimeout(() => textarea.focus(), 50);
  }

  function removePreviewPanel() {
    const panel = document.getElementById(PANEL_ID);
    const overlay = document.getElementById(OVERLAY_ID);
    if (panel) {
      panel.classList.remove('po-panel-show');
      setTimeout(() => panel.remove(), 250);
    }
    if (overlay) {
      overlay.classList.remove('po-overlay-show');
      setTimeout(() => overlay.remove(), 250);
    }
  }

  // ════════════════════════════════════════════════════════════
  // 输入框文本读写兼容层
  // ════════════════════════════════════════════════════════════

  function getInputText(el) {
    if (el.isContentEditable) return el.innerText || el.textContent || '';
    return el.value || '';
  }

  function setInputText(el, text) {
    if (el.isContentEditable) {
      el.focus();
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      if (!el.innerText.trim()) {
        el.innerText = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    } else {
      el.focus();
      const nativeInputValueSetter =
        Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set ||
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, text);
      } else {
        el.value = text;
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ════════════════════════════════════════════════════════════
  // Loading 状态
  // ════════════════════════════════════════════════════════════

  function setLoading(loading) {
    isLoading = loading;
    if (!magicBtn) return;
    magicBtn.classList.toggle('po-loading', loading);
  }

  // ════════════════════════════════════════════════════════════
  // Toast 轻提示
  // ════════════════════════════════════════════════════════════

  function showToast(message, isError = false) {
    let toast = document.getElementById(TOAST_ID);
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = TOAST_ID;
    toast.textContent = message;
    if (isError) toast.classList.add('po-toast-error');
    document.body.appendChild(toast);
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('po-toast-show')));
    setTimeout(() => {
      toast.classList.remove('po-toast-show');
      setTimeout(() => toast.remove(), 400);
    }, 3500);
  }

  // ════════════════════════════════════════════════════════════
  // 样式注入
  // ════════════════════════════════════════════════════════════

  function injectStyles() {
    if (document.getElementById('prompt-optimizer-styles')) return;
    const style = document.createElement('style');
    style.id = 'prompt-optimizer-styles';
    style.textContent = `
      /* ── 魔法棒按钮 ── */
      #${BTN_ID} {
        position: fixed;
        z-index: 2147483640;
        width: ${BTN_SIZE}px;
        height: ${BTN_SIZE}px;
        border-radius: 50%;
        background: linear-gradient(135deg, #7C3AED, #A855F7);
        box-shadow: 0 4px 15px rgba(124, 58, 237, 0.5);
        cursor: grab;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        user-select: none;
        -webkit-user-select: none;
      }
      #${BTN_ID}:hover {
        transform: scale(1.12);
        box-shadow: 0 6px 20px rgba(124, 58, 237, 0.7);
      }
      #${BTN_ID}:active { transform: scale(0.95); }
      /* 拖拽中：grabbing 指针 + 禁用 hover/active 动画 */
      #${BTN_ID}.po-grabbing {
        cursor: grabbing;
        transform: none !important;
      }
      #${BTN_ID} .po-btn-icon { font-size: 18px; line-height: 1; display: block; }
      #${BTN_ID} .po-btn-spinner {
        display: none;
        width: 18px; height: 18px;
        border: 2.5px solid rgba(255,255,255,0.3);
        border-top-color: #fff;
        border-radius: 50%;
        animation: po-spin 0.7s linear infinite;
      }
      #${BTN_ID}.po-loading .po-btn-icon    { display: none; }
      #${BTN_ID}.po-loading .po-btn-spinner { display: block; }
      @keyframes po-spin { to { transform: rotate(360deg); } }

      /* ── 遮罩层 ── */
      #${OVERLAY_ID} {
        position: fixed;
        inset: 0;
        z-index: 2147483641;
        background: rgba(0, 0, 0, 0);
        transition: background 0.25s ease;
        backdrop-filter: blur(0px);
      }
      #${OVERLAY_ID}.po-overlay-show {
        background: rgba(0, 0, 0, 0.45);
        backdrop-filter: blur(3px);
      }

      /* ── 预览面板 ── */
      #${PANEL_ID} {
        position: fixed;
        z-index: 2147483642;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -44%) scale(0.96);
        width: min(620px, 92vw);
        max-height: 80vh;
        background: #130D2A;
        border: 1px solid rgba(139, 92, 246, 0.35);
        border-radius: 18px;
        box-shadow:
          0 25px 60px rgba(0, 0, 0, 0.6),
          0 0 0 1px rgba(139, 92, 246, 0.2),
          inset 0 1px 0 rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
          'Microsoft YaHei', sans-serif;
      }
      #${PANEL_ID}.po-panel-show {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }

      /* 标题栏 */
      .po-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px 12px;
        border-bottom: 1px solid rgba(139, 92, 246, 0.2);
        background: linear-gradient(180deg, rgba(124,58,237,0.12), transparent);
      }
      .po-panel-title {
        font-size: 15px;
        font-weight: 700;
        background: linear-gradient(90deg, #C4B5FD, #F0ABFC);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .po-panel-close {
        background: none;
        border: none;
        color: rgba(200, 185, 240, 0.5);
        font-size: 16px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 6px;
        transition: color 0.15s, background 0.15s;
        line-height: 1;
      }
      .po-panel-close:hover {
        color: #fff;
        background: rgba(255,255,255,0.08);
      }

      /* 原始输入提示 */
      .po-panel-original {
        padding: 8px 20px;
        font-size: 11.5px;
        color: rgba(180, 160, 230, 0.5);
        border-bottom: 1px solid rgba(139, 92, 246, 0.1);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      /* 可编辑结果文本区 */
      .po-panel-textarea {
        flex: 1;
        min-height: 200px;
        max-height: 50vh;
        resize: none;
        border: none;
        outline: none;
        background: transparent;
        color: #E8E0FF;
        font-size: 13.5px;
        line-height: 1.7;
        padding: 16px 20px 8px;
        font-family: inherit;
        overflow-y: auto;
      }
      .po-panel-textarea::-webkit-scrollbar { width: 5px; }
      .po-panel-textarea::-webkit-scrollbar-track { background: transparent; }
      .po-panel-textarea::-webkit-scrollbar-thumb {
        background: rgba(139,92,246,0.3);
        border-radius: 3px;
      }

      /* 字数统计 */
      .po-panel-counter {
        padding: 0 20px 10px;
        font-size: 11px;
        color: rgba(150, 130, 200, 0.4);
        text-align: right;
      }

      /* 操作按钮区 */
      .po-panel-actions {
        display: flex;
        gap: 10px;
        padding: 12px 20px 16px;
        border-top: 1px solid rgba(139, 92, 246, 0.15);
        background: rgba(0,0,0,0.15);
      }
      .po-action-btn {
        flex: 1;
        padding: 10px 8px;
        border: none;
        border-radius: 10px;
        font-size: 13px;
        font-weight: 600;
        font-family: inherit;
        cursor: pointer;
        transition: transform 0.15s, filter 0.15s, box-shadow 0.15s;
        letter-spacing: 0.01em;
      }
      .po-action-btn:hover   { filter: brightness(1.1); transform: translateY(-1px); }
      .po-action-btn:active  { transform: translateY(0); filter: brightness(0.95); }

      .po-btn-cancel {
        background: rgba(255,255,255,0.06);
        color: rgba(200, 185, 240, 0.7);
        border: 1px solid rgba(255,255,255,0.08);
        flex: 0.7;
      }
      .po-btn-cancel:hover { background: rgba(255,255,255,0.1); color: #fff; }

      .po-btn-regen {
        background: rgba(139,92,246,0.15);
        color: #C4B5FD;
        border: 1px solid rgba(139,92,246,0.3);
      }
      .po-btn-regen:hover { background: rgba(139,92,246,0.25); }

      .po-btn-accept {
        background: linear-gradient(135deg, #7C3AED, #A855F7);
        color: #fff;
        box-shadow: 0 4px 15px rgba(124,58,237,0.4);
        flex: 1.3;
      }
      .po-btn-accept:hover { box-shadow: 0 6px 20px rgba(124,58,237,0.6); }

      /* ── Toast ── */
      #${TOAST_ID} {
        position: fixed;
        bottom: 32px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        z-index: 2147483647;
        background: rgba(30, 20, 50, 0.92);
        color: #fff;
        padding: 12px 22px;
        border-radius: 24px;
        font-size: 14px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        border: 1px solid rgba(168, 85, 247, 0.4);
        backdrop-filter: blur(10px);
        opacity: 0;
        transition: opacity 0.3s ease, transform 0.3s ease;
        pointer-events: none;
        white-space: nowrap;
        box-shadow: 0 8px 30px rgba(0,0,0,0.3);
      }
      #${TOAST_ID}.po-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }
      #${TOAST_ID}.po-toast-error {
        border-color: rgba(239,68,68,0.5);
        background: rgba(50,20,20,0.92);
      }
    `;
    document.head.appendChild(style);
  }

})();
