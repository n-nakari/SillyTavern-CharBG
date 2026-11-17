const MENU_BTN_ID = 'st-char-bg-ext-btn';
const PANEL_ID = 'char-bg-panel';
const BG_STYLE_ID = 'char-bg-filter-style';
const OVERRIDE_STYLE_ID = 'char-bg-override-style';
const SPLASH_STYLE_ID = 'char-bg-splash-style';

let lastBgStyleKey = '';
let lastOverrideKey = '';
let lastSplashKey = '';
let cachedAvatarSrc = '';
let updateRaf = null;

// 解析开屏美化输入框：支持输入角色名称或图片链接
const resolveSplashInputUrl = (rawInput) => {
    const input = (rawInput || '').trim();
    if (!input) return '';
    if (/^(https?:\/\/|\/\/|data:|blob:|\/|\.\.?\/)/i.test(input) || input.includes('/')) {
        return input;
    }
    const hasExt = /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(input);
    const fileName = hasExt ? input : `${input}.png`;
    return `/characters/${encodeURIComponent(fileName)}`;
};

// 生成开屏美化 CSS
const buildSplashCss = (bgUrl) => {
    const hasCardImg = Boolean(bgUrl);
    const safeSrc = hasCardImg ? bgUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"') : '';

    const preloaderBgColor = hasCardImg ? 'transparent' : '#0b0d13';
    const preloaderBgImage = hasCardImg
        ? `linear-gradient(
        180deg,
        rgba(8, 10, 16, 0.2) 0%,
        rgba(0, 0, 0, 0) 20%,
        rgba(0, 0, 0, 0) 60%,
        rgba(8, 10, 16, 0.4) 80%,
        rgba(5, 7, 12, 0.8) 100%
    ),
    url("${safeSrc}")`
        : `linear-gradient(
        180deg,
        rgba(14, 17, 26, 0.7) 0%,
        rgba(8, 10, 16, 0.92) 80%,
        rgba(5, 7, 12, 0.98) 100%
    )`;

    return `html body dialog.popup:has(#loader.splash-screen),
html body dialog.popup[open]:has(#loader.splash-screen),
html body .popup[open]:has(#loader.splash-screen),
html body dialog.popup:has(#loader.splash-screen) .popup-body,
html body dialog.popup[open]:has(#loader.splash-screen) .popup-body,
html body .popup[open]:has(#loader.splash-screen) .popup-body,
html body dialog.popup:has(#loader.splash-screen) .popup-content,
html body dialog.popup[open]:has(#loader.splash-screen) .popup-content,
html body .popup[open]:has(#loader.splash-screen) .popup-content {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: none !important;
    background-image: none !important;
    background-color: transparent !important;
    filter: none !important;
    -webkit-filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

html body dialog.popup:has(#loader.splash-screen)::backdrop,
html body dialog.popup[open]:has(#loader.splash-screen)::backdrop,
html body .popup[open]:has(#loader.splash-screen)::backdrop {
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    background: none !important;
    background-image: none !important;
    background-color: transparent !important;
    filter: none !important;
    -webkit-filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

#preloader {
    position: fixed !important;
    inset: 0 !important;
    z-index: 99999 !important;
    background-color: ${preloaderBgColor} !important;
    background-image: ${preloaderBgImage} !important;
    background-size: cover !important;
    background-position: center !important;
    background-repeat: no-repeat !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
}

#loader.splash-screen {
    display: block !important;
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    animation: none !important;
    transform: none !important;
    font-size: 0 !important;
    color: transparent !important;
    pointer-events: none !important;
}

#loader.splash-screen > * {
    display: none !important;
}

#loader.splash-screen::before {
    content: "LOADING..." !important;
    display: block !important;
    position: fixed !important;
    left: 50% !important;
    bottom: 58px !important;
    transform: translateX(-50%) !important;
    width: min(520px, 82vw) !important;
    z-index: 2 !important;
    box-sizing: border-box !important;
    padding-left: 0.55em !important;
    text-align: center !important;
    font-family: "PingFang SC", "Helvetica Neue", "Segoe UI Light", "Segoe UI", Arial, sans-serif !important;
    font-size: 12px !important;
    font-weight: 300 !important;
    line-height: 1.4 !important;
    letter-spacing: 0.55em !important;
    color: rgba(255, 255, 255, 0.86) !important;
    text-shadow: 0 2px 12px rgba(0, 0, 0, 0.85) !important;
    pointer-events: none !important;
    animation: st-char-splash-breathe 2.2s ease-in-out infinite !important;
}

#loader.splash-screen::after {
    content: "" !important;
    display: block !important;
    position: fixed !important;
    left: 50% !important;
    bottom: 40px !important;
    transform: translateX(-50%) !important;
    width: min(520px, 82vw) !important;
    height: 3px !important;
    z-index: 2 !important;
    border-radius: 999px !important;
    background-color: rgba(255, 255, 255, 0.16) !important;
    background-image: linear-gradient(
        90deg,
        rgba(155, 205, 255, 0.4) 0%,
        rgba(220, 240, 255, 0.92) 75%,
        #ffffff 100%
    ) !important;
    background-repeat: no-repeat !important;
    background-size: 0% 100%;
    box-shadow: 0 0 14px rgba(195, 228, 255, 0.35), 0 0 2px rgba(255, 255, 255, 0.5) !important;
    pointer-events: none !important;
    animation: st-char-splash-progress 3.8s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
}

@keyframes st-char-splash-breathe {
    0%, 100% { opacity: 0.58; }
    50% { opacity: 1; }
}

@keyframes st-char-splash-progress {
    0% { background-size: 0% 100%; }
    25% { background-size: 35% 100%; }
    55% { background-size: 66% 100%; }
    82% { background-size: 88% 100%; }
    100% { background-size: 96% 100%; }
}`;
};

// 更新开屏美化注入样式（原生扩展直接操作主页面 document）
const updateSplashCss = (isSplashEnabled, isBgEnabled, avatarSrc, splashInput) => {
    if (!isSplashEnabled) {
        if (lastSplashKey !== '') {
            lastSplashKey = '';
            const el = document.getElementById(SPLASH_STYLE_ID);
            if (el) el.textContent = '';
        }
        return;
    }

    const customUrl = resolveSplashInputUrl(splashInput);
    const targetBgUrl = customUrl || (isBgEnabled ? avatarSrc : '');
    const key = `${isSplashEnabled}|${targetBgUrl}`;
    if (key === lastSplashKey) return;
    lastSplashKey = key;

    let el = document.getElementById(SPLASH_STYLE_ID);
    if (!el) {
        el = document.createElement('style');
        el.id = SPLASH_STYLE_ID;
        (document.head || document.documentElement).appendChild(el);
    }
    el.textContent = buildSplashCss(targetBgUrl);
};

// 模块加载第一时间立即同步注入开屏美化样式（不等待 DOM Ready）
(() => {
    try {
        const earlyData = JSON.parse(localStorage.getItem('char_bg_data') || '{}');
        if (earlyData.lastAvatar) cachedAvatarSrc = earlyData.lastAvatar;
        if (earlyData.splashEnabled) {
            updateSplashCss(
                true,
                Boolean(earlyData.enabled),
                cachedAvatarSrc,
                earlyData.splashInput || ''
            );
        }
    } catch (e) {}
})();

const RESET_ICON_SVG = `
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
        <path d="M3 3v5h5"></path>
    </svg>
`;

// 保存配置到 localStorage（沿用原 key，设置可无缝继承）
const saveCfg = () => {
    const config = {
        enabled: $('#char-bg-toggle').is(':checked'),
        splashEnabled: $('#char-bg-splash-toggle').is(':checked'),
        splashInput: $('#char-bg-splash-input').val(),
        bright: $('#char-bg-bright').val(),
        sat: $('#char-bg-sat').val(),
        blur: $('#char-bg-blur').val(),
        clearChat: $('#char-bg-clear-chat').is(':checked'),
        clearTop: $('#char-bg-clear-top').is(':checked'),
        clearBottom: $('#char-bg-clear-bottom').is(':checked'),
        theme: $(`#${PANEL_ID}`).attr('class') || 'dark',
        lastAvatar: cachedAvatarSrc
    };
    localStorage.setItem('char_bg_data', JSON.stringify(config));
};

// 获取当前目标头像/卡面地址
const getTargetAvatarSrc = () => {
    const $avatar = $('#chat .mes[is_user="false"] .avatar img').last();
    const domSrc = $avatar.attr('src');
    if (domSrc) return domSrc;

    try {
        const ctx = window.SillyTavern?.getContext?.();
        const chid = ctx?.characterId;
        const char = (chid !== undefined && chid !== null) ? ctx?.characters?.[chid] : null;
        if (char?.avatar) {
            if (typeof ctx.getThumbnailUrl === 'function') {
                return ctx.getThumbnailUrl('avatar', char.avatar);
            }
            return `/characters/${encodeURIComponent(char.avatar)}`;
        }
    } catch (e) {}

    return '';
};

const ensureDynamicStyles = () => {
    if ($(`#${BG_STYLE_ID}`).length === 0) {
        $('head').append(`<style id="${BG_STYLE_ID}"></style>`);
    }
    if ($(`#${OVERRIDE_STYLE_ID}`).length === 0) {
        $('head').append(`<style id="${OVERRIDE_STYLE_ID}"></style>`);
    }
    if ($(`#${SPLASH_STYLE_ID}`).length === 0) {
        $('head').append(`<style id="${SPLASH_STYLE_ID}"></style>`);
    }
};

const updateOverrideCss = (clearChat = false, clearTop = false, clearBottom = false) => {
    const key = `${clearChat}|${clearTop}|${clearBottom}`;
    if (key === lastOverrideKey) return;
    lastOverrideKey = key;

    const selectors = [];

    if (clearChat) {
        selectors.push(
            'html body #sheld#sheld',
            'html body #chat#chat'
        );
    }

    if (clearTop) {
        selectors.push(
            'html body #top-bar#top-bar',
            'html body.no-blur #top-bar#top-bar',
            'html body #top-settings-holder#top-settings-holder',
            'html body #extensionTopBar#extensionTopBar',
            'html body #extensionConnectionProfiles#extensionConnectionProfiles'
        );
    }

    if (clearBottom) {
        selectors.push(
            'html body #form_sheld#form_sheld',
            'html body #send_form#send_form',
            'html body.no-blur #send_form#send_form'
        );
    }

    if (selectors.length === 0) {
        $(`#${OVERRIDE_STYLE_ID}`).text('');
        return;
    }

    $(`#${OVERRIDE_STYLE_ID}`).text(`
        ${selectors.join(',\n        ')} {
            background: none !important;
            background-color: transparent !important;
            filter: none !important;
            -webkit-filter: none !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
        }
    `);
};

const updateBgCss = (isEnabled, b, s, blur, avatarSrc) => {
    const activeImg = (isEnabled && avatarSrc) ? avatarSrc : '';
    const key = `${isEnabled}|${b}|${s}|${blur}|${activeImg}`;
    if (key === lastBgStyleKey) return;
    lastBgStyleKey = key;

    const filterVal = `brightness(${b}%) saturate(${s}%) blur(${blur}px)`;
    const blurNum = Math.max(0, parseFloat(blur) || 0);
    const scaleVal = (1 + blurNum * 0.006).toFixed(3);

    if (activeImg) {
        const safeSrc = activeImg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        $(`#${BG_STYLE_ID}`).text(`
            html body #bg1#bg1 {
                background-image: url("${safeSrc}") !important;
                background-size: cover !important;
                background-position: center !important;
                background-repeat: no-repeat !important;
                filter: ${filterVal} !important;
                -webkit-filter: ${filterVal} !important;
                transform: scale(${scaleVal}) !important;
                transform-origin: center center !important;
            }
        `);
    } else {
        $(`#${BG_STYLE_ID}`).text(`
            html body #bg1#bg1 {
                filter: ${filterVal} !important;
                -webkit-filter: ${filterVal} !important;
                transform: scale(${scaleVal}) !important;
                transform-origin: center center !important;
            }
        `);
    }
};

const updateCharBg = (shouldSave = true) => {
    if ($(`#${PANEL_ID}`).length === 0) return;

    const isEnabled = $('#char-bg-toggle').is(':checked');
    const isSplashEnabled = $('#char-bg-splash-toggle').is(':checked');
    const splashInput = $('#char-bg-splash-input').val();
    const clearChat = $('#char-bg-clear-chat').is(':checked');
    const clearTop = $('#char-bg-clear-top').is(':checked');
    const clearBottom = $('#char-bg-clear-bottom').is(':checked');
    const b = $('#char-bg-bright').val();
    const s = $('#char-bg-sat').val();
    const blur = $('#char-bg-blur').val();

    $('#char-bg-splash-input-row').toggle(isSplashEnabled);

    const currentSrc = getTargetAvatarSrc();
    let needSaveAvatar = false;
    if (currentSrc && currentSrc !== cachedAvatarSrc) {
        cachedAvatarSrc = currentSrc;
        needSaveAvatar = true;
    }
    const avatarSrc = currentSrc || cachedAvatarSrc;

    $('#bg1').css('filter', '');
    updateBgCss(isEnabled, b, s, blur, avatarSrc);
    updateOverrideCss(clearChat, clearTop, clearBottom);
    updateSplashCss(isSplashEnabled, isEnabled, avatarSrc, splashInput);

    if (shouldSave || needSaveAvatar) saveCfg();
};

const scheduleUpdate = () => {
    if (updateRaf) cancelAnimationFrame(updateRaf);
    updateRaf = requestAnimationFrame(() => {
        updateRaf = null;
        updateCharBg(false);
    });
};

const loadCfg = () => {
    const data = JSON.parse(localStorage.getItem('char_bg_data') || '{}');
    if (data.lastAvatar) cachedAvatarSrc = data.lastAvatar;
    if (data.enabled !== undefined) $('#char-bg-toggle').prop('checked', data.enabled);
    if (data.splashEnabled !== undefined) $('#char-bg-splash-toggle').prop('checked', data.splashEnabled);
    if (data.splashInput !== undefined) $('#char-bg-splash-input').val(data.splashInput);
    if (data.bright !== undefined) {
        $('#char-bg-bright').val(data.bright);
        $('#val-bright').text(data.bright);
    }
    if (data.sat !== undefined) {
        $('#char-bg-sat').val(data.sat);
        $('#val-sat').text(data.sat);
    }
    if (data.blur !== undefined) {
        $('#char-bg-blur').val(data.blur);
        $('#val-blur').text(data.blur);
    }
    if (data.clearChat !== undefined) $('#char-bg-clear-chat').prop('checked', data.clearChat);
    if (data.clearTop !== undefined) $('#char-bg-clear-top').prop('checked', data.clearTop);
    if (data.clearBottom !== undefined) $('#char-bg-clear-bottom').prop('checked', data.clearBottom);
    if (data.theme) {
        $(`#${PANEL_ID}`).attr('class', data.theme);
        $('#theme-toggle').text(data.theme === 'light' ? '☀︎' : '☾⋆');
    }
    updateCharBg(false);
};

function initPanel() {
    if ($(`#${PANEL_ID}`).length > 0) return;
    $('body').append(`
        <div id="${PANEL_ID}" class="dark">
            <div class="char-bg-header">
                <span>背景设置</span>
                <div>
                    <span id="theme-toggle" style="cursor:pointer;">☾⋆</span>
                    <span id="char-bg-close" style="cursor:pointer; margin-left:10px;">×</span>
                </div>
            </div>
            <div class="char-bg-content">
                <div class="char-bg-top-row">
                    <label class="char-bg-inline-label">
                        <input type="checkbox" id="char-bg-toggle">
                        <span>角色卡面</span>
                    </label>
                    <label class="char-bg-inline-label">
                        <input type="checkbox" id="char-bg-splash-toggle">
                        <span>开屏美化</span>
                    </label>
                </div>
                <div class="ctrl-row" id="char-bg-splash-input-row" style="display: none;">
                    <input type="text" id="char-bg-splash-input" class="text_pole" placeholder="输入角色名称或图片链接">
                </div>
                <div class="ctrl-row">
                    <span class="ctrl-label-line">亮度: <span id="val-bright">40</span>% <span class="reset-btn" id="reset-bright" title="恢复默认">${RESET_ICON_SVG}</span></span>
                    <input type="range" id="char-bg-bright" min="0" max="200" value="40">
                </div>
                <div class="ctrl-row">
                    <span class="ctrl-label-line">饱和度: <span id="val-sat">100</span>% <span class="reset-btn" id="reset-sat" title="恢复默认">${RESET_ICON_SVG}</span></span>
                    <input type="range" id="char-bg-sat" min="0" max="200" value="100">
                </div>
                <div class="ctrl-row">
                    <span>模糊: <span id="val-blur">8</span>px</span>
                    <input type="range" id="char-bg-blur" min="0" max="50" value="8">
                </div>
                <div class="char-bg-clear-row">
                    <span class="char-bg-clear-title">消除原底色：</span>
                    <label class="char-bg-inline-label">
                        <input type="checkbox" id="char-bg-clear-chat">
                        <span>聊天背景</span>
                    </label>
                    <label class="char-bg-inline-label">
                        <input type="checkbox" id="char-bg-clear-top">
                        <span>顶栏</span>
                    </label>
                    <label class="char-bg-inline-label">
                        <input type="checkbox" id="char-bg-clear-bottom">
                        <span>底栏</span>
                    </label>
                </div>
            </div>
        </div>
    `);

    loadCfg();

    $('#reset-bright').on('click', () => { $('#char-bg-bright').val(100).trigger('input'); });
    $('#reset-sat').on('click', () => { $('#char-bg-sat').val(100).trigger('input'); });
    $('#theme-toggle').on('click', () => {
        const isDark = $(`#${PANEL_ID}`).hasClass('dark');
        $(`#${PANEL_ID}`).attr('class', isDark ? 'light' : 'dark');
        $('#theme-toggle').text(isDark ? '☀︎' : '☾⋆');
        saveCfg();
    });

    $('#char-bg-toggle, #char-bg-splash-toggle, #char-bg-clear-chat, #char-bg-clear-top, #char-bg-clear-bottom').on('change', () => updateCharBg(true));
    $('#char-bg-splash-input').on('input', () => updateCharBg(true));
    $('#char-bg-bright, #char-bg-sat, #char-bg-blur').on('input', () => {
        $('#val-bright').text($('#char-bg-bright').val());
        $('#val-sat').text($('#char-bg-sat').val());
        $('#val-blur').text($('#char-bg-blur').val());
        updateCharBg(true);
    });
    $('#char-bg-close').on('click', () => $(`#${PANEL_ID}`).hide());
}

const mountMenuButton = () => {
    if ($('#extensionsMenu').length > 0 && $(`#${MENU_BTN_ID}`).length === 0) {
        const $btn = $(`<div id="${MENU_BTN_ID}" class="list-group-item"><i class="fa-solid fa-image"></i> 角色背景调整</div>`);
        $btn.on('click', () => {
            initPanel();
            $(`#${PANEL_ID}`).toggle();
        });
        $('#extensionsMenu').append($btn);
        return true;
    }
    return $(`#${MENU_BTN_ID}`).length > 0;
};

jQuery(() => {
    ensureDynamicStyles();
    updateOverrideCss(false, false, false);
    initPanel();

    try {
        const ctx = window.SillyTavern?.getContext?.();
        if (ctx?.eventSource && ctx?.event_types) {
            if (ctx.event_types.APP_READY) {
                ctx.eventSource.on(ctx.event_types.APP_READY, scheduleUpdate);
            }
            if (ctx.event_types.CHAT_CHANGED) {
                ctx.eventSource.on(ctx.event_types.CHAT_CHANGED, scheduleUpdate);
            }
            if (ctx.event_types.CHARACTER_EDITED) {
                ctx.eventSource.on(ctx.event_types.CHARACTER_EDITED, scheduleUpdate);
            }
        }
    } catch (e) {}

    const chatEl = document.getElementById('chat') || document.body;
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(chatEl, { childList: true, subtree: true });

    if (!mountMenuButton()) {
        const menuTimer = setInterval(() => {
            if (mountMenuButton()) clearInterval(menuTimer);
        }, 1000);
    }
});
