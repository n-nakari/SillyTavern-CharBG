// SillyTavern Third-Party Extension: 角色背景与开屏美化
// Author: @tomato_king0809

(() => {
    const STORAGE_KEY = 'char_bg_data';
    const MENU_BTN_ID = 'st-char-bg-ext-btn';
    const PANEL_ID = 'char-bg-panel';
    const BG_STYLE_ID = 'char-bg-filter-style';
    const OVERRIDE_STYLE_ID = 'char-bg-override-style';
    const SPLASH_STAGE_ID = 'char-bg-splash-stage';

    const RESET_ICON_SVG = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path>
            <path d="M3 3v5h5"></path>
        </svg>
    `;

    let lastBgStyleKey = '';
    let lastOverrideKey = '';
    let updateRaf = null;
    let splashCarouselTimer = null;
    let lastSplashUrlsKey = '';
    let lastSplashHost = null;

    // 读取本地配置（纯同步，供开屏首帧使用）
    const readSavedConfig = () => {
        try {
            const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            return {
                enabled: Boolean(raw.enabled),
                clearChat: Boolean(raw.clearChat),
                clearTop: Boolean(raw.clearTop),
                clearBottom: Boolean(raw.clearBottom),
                bright: raw.bright !== undefined ? String(raw.bright) : '40',
                sat: raw.sat !== undefined ? String(raw.sat) : '100',
                blur: raw.blur !== undefined ? String(raw.blur) : '8',
                splashEnabled: Boolean(raw.splashEnabled),
                splashMode: raw.splashMode === 'custom' ? 'custom' : 'current',
                customInputs: Array.isArray(raw.customInputs)
                    ? [raw.customInputs[0] || '', raw.customInputs[1] || '', raw.customInputs[2] || '']
                    : ['', '', ''],
                cachedCustomUrls: Array.isArray(raw.cachedCustomUrls) ? raw.cachedCustomUrls : [],
                theme: raw.theme === 'light' ? 'light' : 'dark',
                lastAvatar: typeof raw.lastAvatar === 'string' ? raw.lastAvatar : '',
            };
        } catch (e) {
            return {
                enabled: false,
                clearChat: false,
                clearTop: false,
                clearBottom: false,
                bright: '40',
                sat: '100',
                blur: '8',
                splashEnabled: false,
                splashMode: 'current',
                customInputs: ['', '', ''],
                cachedCustomUrls: [],
                theme: 'dark',
                lastAvatar: '',
            };
        }
    };

    let state = readSavedConfig();

    const saveConfig = () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    };

    const ensureStyleTag = (id) => {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement('style');
            el.id = id;
            (document.head || document.documentElement).appendChild(el);
        }
        return el;
    };

    // 更新 #bg1 样式（角色卡面 + 滤镜 + 模糊外扩防白边）
    const applyBgCss = (isEnabled, bright, sat, blur, avatarSrc) => {
        const activeImg = (isEnabled && avatarSrc) ? avatarSrc : '';
        const blurNum = Math.max(0, Number(blur) || 0);
        const key = `${isEnabled}|${bright}|${sat}|${blurNum}|${activeImg}`;
        if (key === lastBgStyleKey) return;
        lastBgStyleKey = key;

        const filterVal = `brightness(${bright}%) saturate(${sat}%) blur(${blurNum}px)`;
        const pad = blurNum * 2;
        const expandCss = pad > 0 ? `
            position: fixed !important;
            top: -${pad}px !important;
            left: -${pad}px !important;
            right: auto !important;
            bottom: auto !important;
            width: calc(100vw + ${pad * 2}px) !important;
            height: calc(100vh + ${pad * 2}px) !important;
            clip-path: inset(${pad}px) !important;
            -webkit-clip-path: inset(${pad}px) !important;` : '';

        const styleEl = ensureStyleTag(BG_STYLE_ID);
        if (activeImg) {
            const safeSrc = activeImg.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
            styleEl.textContent = `
                #bg1 {
                    background-image: url("${safeSrc}") !important;
                    background-size: cover !important;
                    background-position: center !important;
                    background-repeat: no-repeat !important;${expandCss}
                    filter: ${filterVal} !important;
                    -webkit-filter: ${filterVal} !important;
                }
            `;
        } else {
            styleEl.textContent = `
                #bg1 {${expandCss}
                    filter: ${filterVal} !important;
                    -webkit-filter: ${filterVal} !important;
                }
            `;
        }
    };

    // 更新“消除美化原有遮罩”CSS
    const applyOverrideCss = (clearChat, clearTop, clearBottom) => {
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

        const styleEl = ensureStyleTag(OVERRIDE_STYLE_ID);
        if (selectors.length === 0) {
            styleEl.textContent = '';
            return;
        }

        styleEl.textContent = `
            ${selectors.join(',\n            ')} {
                background: none !important;
                background-color: transparent !important;
                filter: none !important;
                -webkit-filter: none !important;
                backdrop-filter: none !important;
                -webkit-backdrop-filter: none !important;
            }
        `;
    };

    // 获取当前角色卡面链接
    const getTargetAvatarSrc = () => {
        const allAvatars = document.querySelectorAll('#chat .mes[is_user="false"] .avatar img');
        const lastDomAvatar = allAvatars.length > 0 ? allAvatars[allAvatars.length - 1] : null;
        const domSrc = lastDomAvatar?.getAttribute('src');
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

    // 将单个自定义输入项解析为图片链接（支持直接图床/路径 或 角色名字）
    const resolveCustomEntry = (rawValue) => {
        const val = (rawValue || '').trim();
        if (!val) return '';

        if (
            /^(https?:\/\/|\/|\.\/|\.\.\/|data:|blob:)/i.test(val) ||
            /\.(png|jpe?g|webp|gif|avif|bmp|svg)(\?.*)?$/i.test(val)
        ) {
            return val;
        }

        try {
            const ctx = window.SillyTavern?.getContext?.();
            const chars = Array.isArray(ctx?.characters) ? ctx.characters : [];
            if (chars.length === 0) return null; // 上下文角色库尚未加载

            const lower = val.toLowerCase();
            const matched =
                chars.find(c => c?.name === val) ||
                chars.find(c => c?.name?.toLowerCase() === lower) ||
                chars.find(c => c?.avatar && c.avatar.replace(/\.[^.]+$/, '').toLowerCase() === lower);

            if (matched?.avatar) {
                if (typeof ctx.getThumbnailUrl === 'function') {
                    return ctx.getThumbnailUrl('avatar', matched.avatar);
                }
                return `/characters/${encodeURIComponent(matched.avatar)}`;
            }
        } catch (e) {}

        return '';
    };

    // 获取自定义模式下的最终有效图片数组
    const resolveCustomSplashUrls = () => {
        let contextPending = false;
        const resolved = [];

        for (const item of state.customInputs) {
            const url = resolveCustomEntry(item);
            if (url === null) {
                contextPending = true;
                break;
            }
            if (url) resolved.push(url);
        }

        if (contextPending) {
            return state.cachedCustomUrls || [];
        }

        const prevKey = (state.cachedCustomUrls || []).join('|');
        const nextKey = resolved.join('|');
        if (prevKey !== nextKey) {
            state.cachedCustomUrls = resolved;
            saveConfig();
        }
        return resolved;
    };

    const stopSplashCarousel = () => {
        if (splashCarouselTimer) {
            clearInterval(splashCarouselTimer);
            splashCarouselTimer = null;
        }
    };

    const getVisibleSplashHost = () => {
        const loader = document.getElementById('loader');
        if (loader && loader.getClientRects().length > 0) return loader;

        const preloader = document.getElementById('preloader');
        if (preloader && preloader.getClientRects().length > 0) return preloader;

        return null;
    };

    // 挂载并控制开屏画面（支持单图展示与多图视差左滑轮换）
    const renderSplashStage = () => {
        document.documentElement.classList.toggle('char-bg-splash-active', state.splashEnabled);

        const existingStage = document.getElementById(SPLASH_STAGE_ID);
        if (!state.splashEnabled) {
            stopSplashCarousel();
            if (existingStage) existingStage.remove();
            lastSplashUrlsKey = '';
            lastSplashHost = null;
            return;
        }

        const host = getVisibleSplashHost();
        if (!host) {
            stopSplashCarousel();
            return;
        }

        const currentAvatar = getTargetAvatarSrc();
        const fallbackAvatar = currentAvatar || state.lastAvatar;
        const urls = state.splashMode === 'custom'
            ? resolveCustomSplashUrls()
            : [fallbackAvatar].filter(Boolean);

        const urlsKey = urls.join('|');
        if (existingStage && existingStage.parentElement === host && urlsKey === lastSplashUrlsKey) {
            return;
        }

        lastSplashUrlsKey = urlsKey;
        lastSplashHost = host;

        stopSplashCarousel();
        if (existingStage) existingStage.remove();

        const stage = document.createElement('div');
        stage.id = SPLASH_STAGE_ID;
        if (urls.length === 0) {
            stage.className = 'is-empty';
        }

        const slides = [];
        urls.forEach((url, idx) => {
            const slide = document.createElement('div');
            slide.className = 'char-bg-splash-slide' + (idx === 0 ? ' is-active' : '');
            slide.style.backgroundImage = `url("${url.replace(/"/g, '\\"')}")`;
            stage.appendChild(slide);
            slides.push(slide);
        });

        const vignette = document.createElement('div');
        vignette.className = 'char-bg-splash-vignette';
        stage.appendChild(vignette);

        host.insertBefore(stage, host.firstChild);

        // 多于一张图时：视差左移 + 柔滑缩放切换
        if (slides.length > 1) {
            let currentIdx = 0;
            splashCarouselTimer = setInterval(() => {
                if (host.getClientRects().length === 0) {
                    stopSplashCarousel();
                    return;
                }

                const prevIdx = currentIdx;
                currentIdx = (currentIdx + 1) % slides.length;
                const prevSlide = slides[prevIdx];
                const nextSlide = slides[currentIdx];

                nextSlide.style.transition = 'none';
                nextSlide.classList.remove('is-active', 'is-leaving');
                void nextSlide.offsetWidth;
                nextSlide.style.transition = '';

                prevSlide.classList.remove('is-active');
                prevSlide.classList.add('is-leaving');
                nextSlide.classList.add('is-active');

                setTimeout(() => {
                    prevSlide.classList.remove('is-leaving');
                }, 950);
            }, 2400);
        }
    };

    // ========== 1. 脚本顶部同步首帧初始化 ==========
    applyBgCss(state.enabled, state.bright, state.sat, state.blur, state.lastAvatar);
    applyOverrideCss(state.clearChat, state.clearTop, state.clearBottom);
    renderSplashStage();

    // ========== 2. UI 面板与完整事件生命周期 ==========
    const syncUiFromState = () => {
        if (!document.getElementById(PANEL_ID)) return;
        $('#char-bg-toggle').prop('checked', state.enabled);
        $('#char-bg-clear-chat').prop('checked', state.clearChat);
        $('#char-bg-clear-top').prop('checked', state.clearTop);
        $('#char-bg-clear-bottom').prop('checked', state.clearBottom);

        $('#char-bg-bright').val(state.bright);
        $('#val-bright').text(state.bright);
        $('#char-bg-sat').val(state.sat);
        $('#val-sat').text(state.sat);
        $('#char-bg-blur').val(state.blur);
        $('#val-blur').text(state.blur);

        $('#char-bg-splash-toggle').prop('checked', state.splashEnabled);
        $(`input[name="char-bg-splash-mode"][value="${state.splashMode}"]`).prop('checked', true);
        $('#char-bg-custom-1').val(state.customInputs[0] || '');
        $('#char-bg-custom-2').val(state.customInputs[1] || '');
        $('#char-bg-custom-3').val(state.customInputs[2] || '');

        $('#char-bg-splash-sub').css('display', state.splashEnabled ? 'flex' : 'none');
        $('#char-bg-custom-box').css('display', state.splashMode === 'custom' ? 'flex' : 'none');

        $(`#${PANEL_ID}`).attr('class', state.theme);
        $('#theme-toggle').text(state.theme === 'light' ? '☀︎' : '☾⋆');
    };

    const updateAll = (shouldSave = true) => {
        const currentSrc = getTargetAvatarSrc();
        let needSaveAvatar = false;
        if (currentSrc && currentSrc !== state.lastAvatar) {
            state.lastAvatar = currentSrc;
            needSaveAvatar = true;
        }
        const avatarSrc = currentSrc || state.lastAvatar;

        const bg1 = document.getElementById('bg1');
        if (bg1) bg1.style.filter = '';

        applyBgCss(state.enabled, state.bright, state.sat, state.blur, avatarSrc);
        applyOverrideCss(state.clearChat, state.clearTop, state.clearBottom);
        renderSplashStage();

        if (shouldSave || needSaveAvatar) {
            saveConfig();
        }
    };

    const scheduleUpdate = () => {
        if (updateRaf) cancelAnimationFrame(updateRaf);
        updateRaf = requestAnimationFrame(() => {
            updateRaf = null;
            updateAll(false);
        });
    };

    const initPanel = () => {
        if (document.getElementById(PANEL_ID)) return;

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
                    <!-- 第一行：绑定为角色卡面 -->
                    <div class="char-bg-section">
                        <label class="char-bg-inline-label">
                            <input type="checkbox" id="char-bg-toggle">
                            <span>绑定为角色卡面</span>
                        </label>
                    </div>

                    <!-- 第二行：消除美化原有遮罩 -->
                    <div class="char-bg-section char-bg-group-row">
                        <span class="char-bg-group-title">消除美化原有遮罩：</span>
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

                    <!-- 亮度 / 饱和度 / 模糊 -->
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

                    <!-- 最底部：开屏美化 -->
                    <div class="char-bg-section" style="margin-bottom:0;">
                        <label class="char-bg-inline-label">
                            <input type="checkbox" id="char-bg-splash-toggle">
                            <span>开屏美化</span>
                        </label>

                        <div id="char-bg-splash-sub" class="char-bg-splash-sub">
                            <div class="char-bg-group-row">
                                <label class="char-bg-inline-label">
                                    <input type="radio" name="char-bg-splash-mode" value="current">
                                    <span>当前角色卡面</span>
                                </label>
                                <label class="char-bg-inline-label">
                                    <input type="radio" name="char-bg-splash-mode" value="custom">
                                    <span>自定义</span>
                                </label>
                            </div>

                            <div id="char-bg-custom-box" class="char-bg-custom-box">
                                <div class="char-bg-custom-hint">输入角色名字或图床</div>
                                <input type="text" id="char-bg-custom-1" class="char-bg-custom-input" placeholder="图片 1（角色名或图床链接）">
                                <input type="text" id="char-bg-custom-2" class="char-bg-custom-input" placeholder="图片 2（可选）">
                                <input type="text" id="char-bg-custom-3" class="char-bg-custom-input" placeholder="图片 3（可选）">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);

        syncUiFromState();

        $('#reset-bright').on('click', () => { $('#char-bg-bright').val(100).trigger('input'); });
        $('#reset-sat').on('click', () => { $('#char-bg-sat').val(100).trigger('input'); });

        $('#theme-toggle').on('click', () => {
            state.theme = state.theme === 'dark' ? 'light' : 'dark';
            syncUiFromState();
            saveConfig();
        });

        $('#char-bg-toggle').on('change', function() {
            state.enabled = $(this).is(':checked');
            updateAll(true);
        });

        $('#char-bg-clear-chat, #char-bg-clear-top, #char-bg-clear-bottom').on('change', () => {
            state.clearChat = $('#char-bg-clear-chat').is(':checked');
            state.clearTop = $('#char-bg-clear-top').is(':checked');
            state.clearBottom = $('#char-bg-clear-bottom').is(':checked');
            updateAll(true);
        });

        $('#char-bg-bright, #char-bg-sat, #char-bg-blur').on('input', () => {
            state.bright = $('#char-bg-bright').val();
            state.sat = $('#char-bg-sat').val();
            state.blur = $('#char-bg-blur').val();
            $('#val-bright').text(state.bright);
            $('#val-sat').text(state.sat);
            $('#val-blur').text(state.blur);
            updateAll(true);
        });

        $('#char-bg-splash-toggle').on('change', function() {
            state.splashEnabled = $(this).is(':checked');
            $('#char-bg-splash-sub').css('display', state.splashEnabled ? 'flex' : 'none');
            updateAll(true);
        });

        $('input[name="char-bg-splash-mode"]').on('change', function() {
            state.splashMode = $(this).val() === 'custom' ? 'custom' : 'current';
            $('#char-bg-custom-box').css('display', state.splashMode === 'custom' ? 'flex' : 'none');
            updateAll(true);
        });

        $('#char-bg-custom-1, #char-bg-custom-2, #char-bg-custom-3').on('input change', () => {
            state.customInputs = [
                $('#char-bg-custom-1').val(),
                $('#char-bg-custom-2').val(),
                $('#char-bg-custom-3').val(),
            ];
            updateAll(true);
        });

        $('#char-bg-close').on('click', () => $(`#${PANEL_ID}`).hide());
    };

    const mountMenuButton = () => {
        const $menu = $('#extensionsMenu');
        if ($menu.length > 0 && $(`#${MENU_BTN_ID}`).length === 0) {
            const $btn = $(`<div id="${MENU_BTN_ID}" class="list-group-item">角色背景调整</div>`);
            $btn.on('click', () => {
                initPanel();
                $(`#${PANEL_ID}`).toggle();
            });
            $menu.append($btn);
        }
    };

    jQuery(async () => {
        initPanel();
        mountMenuButton();
        updateAll(false);

        try {
            const ctx = window.SillyTavern?.getContext?.();
            if (ctx?.eventSource && ctx?.event_types) {
                if (ctx.event_types.APP_READY) {
                    ctx.eventSource.on(ctx.event_types.APP_READY, () => {
                        mountMenuButton();
                        scheduleUpdate();
                    });
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
        const chatObserver = new MutationObserver(scheduleUpdate);
        chatObserver.observe(chatEl, { childList: true, subtree: true });

        // 监听全局弹窗/加载器出现或关闭，及时挂载或清理轮换
        const bodyObserver = new MutationObserver(() => {
            if (!state.splashEnabled) return;
            const host = getVisibleSplashHost();
            if (!host) {
                stopSplashCarousel();
            } else if (host !== lastSplashHost || !document.getElementById(SPLASH_STAGE_ID)) {
                renderSplashStage();
            }
        });
        bodyObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class', 'open'] });
    });
})();
