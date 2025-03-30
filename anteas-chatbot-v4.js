// Modified Chat Widget Script v3 - Mogge Pepijn
(function() {
    // --- Default Configuration ---
    const defaultConfig = {
        webhook: { url: '', route: '' },
        branding: {
            logo: '', name: 'Chat', subtitleText: 'Online and ready to help!',
            welcomeText: 'Enter your message...', inputPlaceholder: 'Enter your message...',
            quickReplies: [], whatsappLink: '#', emailLink: '#',
            whatsappViewText: 'Reach us on WhatsApp! Start a conversation using the button below and we will try to reply as soon as possible.',
            whatsappViewButtonText: 'Open WhatsApp',
            emailViewText: 'Reach us via Email using the button below.',
            emailViewButtonText: 'Open Email'
        },
        style: {
            primaryColor: '#007bff', secondaryColor: null, fontColor: '#212529',
            backgroundColor: '#ffffff',
            headerWaveBackgroundColor: '#0a4237', headerFontColor: '#ffffff',
             onlineStatusColor: '#28a745',
            botMessageBorderColor: '#dee2e6', inputBorderColor: '#ced4da',
            bubbleBorderColor: '#ced4da', inputPlaceholderColor: '#8E8E93',
            position: 'right' // Default position
        }
    };
    // --- Merge User Config ---
    const userConfig = window.ChatWidgetConfig || {};
    const config = {
        webhook: { ...defaultConfig.webhook, ...userConfig.webhook },
        branding: { ...defaultConfig.branding, ...userConfig.branding },
        style: { ...defaultConfig.style, ...userConfig.style }
    };
    config.style.onlineStatusColor = config.style.onlineStatusColor || config.style.headerBorderColor || '#28a745'; config.style.bubbleBorderColor = config.style.bubbleBorderColor || config.style.inputBorderColor; config.style.secondaryColor = config.style.secondaryColor || config.style.primaryColor;

    // --- Prevent Multiple Initializations ---
    const widgetId = `n8n-chat-widget-${Math.random().toString(36).substring(2, 9)}`;
    if (document.getElementById(widgetId)) return;

    // --- State Variables ---
    let currentSessionId = ''; let isChatStarted = false; let typingIndicator = null; let quickReplyContainer = null;
    let bubbleCloseButton = null;
    let isBubbleManuallyClosed = false; // Tracks manual close *within the current session*

    // --- MODIFICATION: LocalStorage Persistence Logic ---
    const storageKey = `chatBubbleClosed_${widgetId}`; // Unique key per widget instance is safer
    const hideDuration = 60 * 60 * 1000; // 1 hour in milliseconds
    let shouldBubbleStayHiddenInitially = false;

    const closedTimestampStr = localStorage.getItem(storageKey);
    if (closedTimestampStr) {
        const closedTimestamp = parseInt(closedTimestampStr, 10);
        const timeElapsed = Date.now() - closedTimestamp;

        if (!isNaN(closedTimestamp) && timeElapsed < hideDuration) {
            shouldBubbleStayHiddenInitially = true;
            isBubbleManuallyClosed = true; // Sync state if hidden due to storage
        } else {
            // Duration expired or invalid data, remove the key
            localStorage.removeItem(storageKey);
        }
    }
    // --- END MODIFICATION ---


    // --- Helper Function: Contrast Color ---
    function getContrastColor(hexcolor) { if (!hexcolor) return '#ffffff'; hexcolor = hexcolor.replace("#", ""); if (hexcolor.length === 3) { hexcolor = hexcolor.split('').map(hex => hex + hex).join(''); } if (hexcolor.length !== 6) return '#ffffff'; const r = parseInt(hexcolor.substring(0, 2), 16); const g = parseInt(hexcolor.substring(2, 4), 16); const b = parseInt(hexcolor.substring(4, 6), 16); const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000; return (yiq >= 128) ? '#000000' : '#ffffff'; }

    // --- Create Shadow Host & Apply CSS Variables ---
    const shadowHost = document.createElement('div');
    shadowHost.id = widgetId;
    shadowHost.style.setProperty('--chat--color-primary', config.style.primaryColor);
    shadowHost.style.setProperty('--chat--color-secondary', config.style.secondaryColor);
    shadowHost.style.setProperty('--chat--color-background', config.style.backgroundColor);
    shadowHost.style.setProperty('--chat--color-font', config.style.fontColor);
    shadowHost.style.setProperty('--chat--color-header-wave-bg', config.style.headerWaveBackgroundColor);
    shadowHost.style.setProperty('--chat--color-header-font', config.style.headerFontColor);
    shadowHost.style.setProperty('--chat--color-header-border', 'transparent');
    shadowHost.style.setProperty('--chat--color-online-status', config.style.onlineStatusColor);
    shadowHost.style.setProperty('--chat--color-bot-msg-bg', config.style.BotMessageBackground);
    shadowHost.style.setProperty('--chat--color-bot-msg-border', config.style.botMessageBorderColor || 'transparent');
    shadowHost.style.setProperty('--chat--color-input-border', config.style.inputBorderColor || 'transparent');
    shadowHost.style.setProperty('--chat--color-input-placeholder', config.style.inputPlaceholderColor);
    shadowHost.style.setProperty('--chat--color-bubble-border', config.style.bubbleBorderColor || 'transparent');
    shadowHost.style.setProperty('--chat--contrast-color-primary', getContrastColor(config.style.primaryColor));

    // --- Attach Shadow DOM ---
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

    // --- Define Styles for Shadow DOM ---
    const styles = `
    /* Font import */ @import url('https://cdn.jsdelivr.net/npm/geist@1.0.0/dist/fonts/geist-sans/style.css');

    :host {
        font-family: 'Geist Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        position: relative;
        line-height: 1.5;
        display: block;
    }

    @keyframes fadeInBubble {
        to {
            opacity: 1;
            pointer-events: auto;
        }
    }

    .chat-container {
        position: fixed; bottom: 90px; right: ${config.style.position === 'left' ? 'auto' : '20px'}; left: ${config.style.position === 'left' ? '20px' : 'auto'};
        z-index: 1000; display: none; width: 380px; height: calc(100dvh - 110px); max-height: 650px;
        background: var(--chat--color-background); border-radius: 16px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08); border: none; overflow: hidden;
        font-family: inherit; flex-direction: column; transition: opacity 0.3s ease, transform 0.3s ease;
        opacity: 0; transform: translateY(10px) scale(0.98);
    }
    .chat-container.open { display: flex; opacity: 1; transform: translateY(0) scale(1); }

    .brand-header { padding: 12px 16px 25px; display: flex; align-items: center; gap: 12px; border: none;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.12), 0 4px 8px rgba(0, 0, 0, 0.08); border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;
        position: relative; z-index: 10; background-color: var(--chat--color-header-wave-bg); color: var(--chat--color-header-font); flex-shrink: 0;
    }
    .brand-header img { border: 1px solid #ffffff; width: 40px; height: 40px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
    .header-text { display: flex; flex-direction: column; flex-grow: 1; overflow: hidden; }
    .header-name { font-size: 16px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--chat--color-header-font); }
    .header-status-line { display: flex; align-items: center; gap: 6px; margin-top: 3px; }
    .online-status { background: none; border: 1px solid var(--chat--color-header-font); color: var(--chat--color-header-font); padding: 0px 6px; border-radius: 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; line-height: 1.4; flex-shrink: 0; }
    .header-subtitle { font-size: 12px; opacity: 0.85; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--chat--color-header-font); flex-grow: 1; }
    .close-button { background: none; border: none; color: var(--chat--color-header-font); opacity: 0.7; cursor: pointer; padding: 5px; margin-left: 8px; flex-shrink: 0; line-height: 0; border-radius: 50%; transition: opacity 0.2s, background-color 0.2s; }
    .close-button svg { width: 24px; height: 24px; display: block; fill: currentColor; }
    .close-button:hover { opacity: 1; background-color: rgba(255,255,255,0.15); }

    .chat-interface { display: flex; flex-direction: column; height: 100%; flex-grow: 1; overflow: hidden; position: relative; }
    .chat-content-area { flex-grow: 1; position: relative; overflow: hidden; display: flex; flex-direction: column; margin-top: -16px; z-index: 1; }
    .chat-messages { flex-grow: 1; overflow-y: auto; padding: 32px 16px 16px 16px; background: var(--chat--color-background); border-top-left-radius: 16px; border-top-right-radius: 16px; position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; }
    .chat-messages::-webkit-scrollbar { width: 6px; }
    .chat-messages::-webkit-scrollbar-track { background: transparent; }
    .chat-messages::-webkit-scrollbar-thumb { background-color: rgba(0,0,0,0.2); border-radius: 3px; }
    .chat-messages::-webkit-scrollbar-thumb:hover { background-color: rgba(0,0,0,0.3); }

    .chat-message { padding: 10px 16px; border-radius: 18px; max-width: 80%; word-wrap: break-word; font-size: 15px; line-height: 1.5; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.06), 0 -3px 8px rgba(0, 0, 0, 0.03); border: 1px solid transparent; }
    .chat-message.user { background-color: var(--chat--color-header-wave-bg); color: var(--chat--color-header-font); align-self: flex-end; border-bottom-right-radius: 6px; border-color: transparent; }
    .chat-message.bot { background: var(--chat--color-bot-msg-bg); border-color: transparent; color: var(--chat--color-font); align-self: flex-start; border-bottom-left-radius: 6px; }
    .chat-message a { color: inherit; text-decoration: underline; }
    .chat-message.user a { color: var(--chat--color-header-font); font-weight: 500; opacity: 0.9; }
    .chat-message.bot a { color: var(--chat--color-primary); font-weight: 500; }

    .typing-indicator { display: flex; align-items: center; padding: 10px 14px; margin: 6px 0; border: 1px solid transparent; border-radius: 18px; border-bottom-left-radius: 6px; align-self: flex-start; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.06), 0 -3px 8px rgba(0, 0, 0, 0.03); }
    .typing-indicator span { height: 8px; width: 8px; margin: 0 2px; background-color: #999; border-radius: 50%; display: inline-block; animation: typing 1s infinite ease-in-out; }
    .typing-indicator span:nth-child(1) { animation-delay: 0s; } .typing-indicator span:nth-child(2) { animation-delay: 0.1s; } .typing-indicator span:nth-child(3) { animation-delay: 0.2s; }
    @keyframes typing { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }

    .quick-reply-container { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; margin-top: 12px; padding: 0 16px; align-self: flex-start; width: auto; max-width: 90%; box-sizing: border-box; }
    .quick-reply-button { padding: 10px 16px; border-radius: 18px; border: 1px solid var(--chat--color-header-wave-bg); background-color: var(--chat--color-background); color: var(--chat--color-header-wave-bg); font-size: 14px; font-weight: 500; cursor: pointer; transition: background-color 0.2s, color 0.2s, border-color 0.2s; width: auto; display: inline-block; max-width: 100%; text-align: left; box-sizing: border-box; }
    .quick-reply-button:hover { background-color: var(--chat--color-header-wave-bg); color: var(--chat--color-header-font); border-color: var(--chat--color-header-wave-bg); }

    .chat-input { padding: 10px 12px; background: var(--chat--color-background); display: flex; gap: 10px; align-items: center; flex-shrink: 0; margin: 0 12px 8px 12px; border-radius: 25px; border: none; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.06), 0 -3px 8px rgba(0, 0, 0, 0.03); position: relative; z-index: 11; }
    .chat-input textarea { flex: 1; padding: 0 0 0 8px; border: none; border-radius: 0; background: transparent; color: var(--chat--color-font); resize: none; font-family: inherit; font-size: 15px; max-height: 100px; line-height: 1.4; overflow-y: auto; outline: none; box-shadow: none; }
    .chat-input textarea:focus { background: transparent; }
    .chat-input textarea::placeholder { color: var(--chat--color-input-placeholder); }
    .chat-input button { background: linear-gradient(135deg, var(--chat--color-primary) 0%, var(--chat--color-secondary) 100%); color: var(--chat--contrast-color-primary); border: none; border-radius: 50%; width: 36px; height: 36px; padding: 0; cursor: pointer; transition: transform 0.15s ease, opacity 0.2s; display: flex; align-items: center; justify-content: center; flex-shrink: 0; box-shadow: none; opacity: 1; }
    .chat-input button:not(:disabled):hover { transform: scale(1.08); }
    .chat-input button:disabled { background: #adb5bd; color: #ffffff; cursor: not-allowed; transform: none; box-shadow: none; opacity: 0.6; }
    .chat-input button svg { width: 20px; height: 20px; fill: currentColor; margin-left: 2px; }

    .channel-overlay { position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; background-color: rgba(255, 255, 255, 0.97); z-index: 25; opacity: 0; transition: opacity 0.2s ease-in-out, visibility 0s 0.2s linear; pointer-events: none; visibility: hidden; box-sizing: border-box; margin-top: -16px; padding-top: calc(40px + 16px); border-top-left-radius: 16px; border-top-right-radius: 16px; }
    .channel-overlay.view-active { opacity: 1; pointer-events: auto; visibility: visible; transition-delay: 0s; }
    .channel-info-bubble { display: flex; align-items: flex-start; gap: 12px; padding: 15px; border-radius: 18px; background: var(--chat--color-bot-msg-bg); border: 1px solid transparent; max-width: 90%; margin-bottom: 25px; text-align: left; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.06), 0 -3px 8px rgba(0, 0, 0, 0.03); color: var(--chat--color-font); }
    .channel-info-icon-whatsapp, .channel-info-icon-email { flex-shrink: 0; width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
    .channel-info-icon-whatsapp { background-color: #25D366; }
    .channel-info-icon-email { background-color: #777; }
    .channel-info-icon-whatsapp svg, .channel-info-icon-email svg { width: 24px; height: 24px; fill: #ffffff; }
    .channel-info-bubble p { margin: 0; font-size: 14px; line-height: 1.5; }
    .channel-info-button { display: inline-flex; align-items: center; text-decoration: none; padding: 10px 20px; border-radius: 25px; background-color: var(--chat--color-header-wave-bg); border: none; color: var(--chat--color-header-font); font-weight: 500; transition: filter 0.2s; }
    .channel-info-button:hover { filter: brightness(115%); }
    .channel-info-button svg { margin-left: 8px; width: 16px; height: 16px; fill: currentColor; }

    .chat-footer-actions { display: flex; justify-content: center; align-items: center; padding: 8px 16px; border-top: 0px solid #eee; gap: 20px; background-color: var(--chat--color-background); flex-shrink: 0; position: relative; z-index: 10; }
    .footer-action-btn { display: inline-flex; padding: 5px; border-radius: 50%; line-height: 0; transition: background-color 0.2s, fill 0.2s; cursor: pointer; }
    .footer-action-btn svg { width: 22px; height: 22px; fill: #88898c; transition: fill 0.2s; vertical-align: middle; }
    .footer-action-btn svg[width="16"] { width: 16px !important; height: 16px !important; }
    .footer-action-btn.active svg { fill: var(--chat--color-primary); }
    .footer-action-btn:hover { background-color: rgba(0,0,0,0.05); }
    .footer-action-btn:not(.active):hover svg { fill: var(--chat--color-primary); }

    .chat-toggle {
        position: fixed; bottom: 20px; right: ${config.style.position === 'left' ? 'auto' : '20px'}; left: ${config.style.position === 'left' ? '20px' : 'auto'};
        width: 60px; height: 60px; border-radius: 50%; background: linear-gradient(135deg, var(--chat--color-primary) 0%, var(--chat--color-secondary) 100%); color: var(--chat--contrast-color-primary); border: none; cursor: pointer; box-shadow: 0 5px 15px rgba(0, 0, 0, 0.15), 0 2px 5px rgba(0,0,0,0.1); z-index: 999; transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease, width 0.3s ease, height 0.3s ease;
        display: flex; align-items: center; justify-content: center;
    }
    .chat-toggle:hover { transform: scale(1.1); box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2), 0 4px 8px rgba(0,0,0,0.15); }
    .chat-toggle svg {
        width: 28px; height: 28px; fill: currentColor; transition: transform 0.3s ease, width 0.3s ease, height 0.3s ease;
    }
    .chat-container.open ~ .chat-toggle svg.chat-icon { transform: rotate(90deg) scale(0); }
    .chat-container.open ~ .chat-toggle svg.close-icon { transform: rotate(0) scale(1); }
    .chat-toggle svg.close-icon { position: absolute; transform: scale(0); }

    .chat-bubble {
        position: fixed; bottom: 10px; right: ${config.style.position === 'left' ? 'auto' : '50px'}; left: ${config.style.position === 'left' ? '50px' : 'auto'};
        height: auto; width: auto; max-width: 240px; padding: 30px 15px 15px 25px; background: var(--chat--color-background); color: var(--chat--color-input-placeholder); border-radius: 12px; box-shadow: 0 8px 26px 0 rgba(0, 18, 46, 0.16); line-height: 1.4; z-index: 998;
        opacity: 0; pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease, max-width 0.3s ease, padding 0.3s ease, right 0.3s ease, left 0.3s ease;
        display: block; cursor: pointer; border: none;
        animation: fadeInBubble 0.3s ease 5s forwards; /* Applies delayed fade-in by default */
    }
    .bubble-line {
        width: 70%; margin: 5px 5px 12px; border: none; height: 1px; background-color: var(--chat--color-bubble-border); opacity: 0.5; transition: margin 0.3s ease;
    }
    .bubble-text {
        display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 16px; padding-right: 45px; transition: font-size 0.3s ease, padding-right 0.3s ease;
    }

    .chat-bubble-close {
        position: fixed; bottom: 85px; right: ${config.style.position === 'left' ? 'auto' : '235px'}; left: ${config.style.position === 'left' ? '30px' : 'auto'}; width: 20px; height: 20px; background: rgba(0, 0, 0, 0.4); color: white; border-radius: 50%; border: none; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: bold; line-height: 1; cursor: pointer; z-index: 998;
        opacity: 0; pointer-events: none;
        transition: opacity 0.2s ease, background-color 0.2s ease, right 0.3s ease, left 0.3s ease, bottom 0.3s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        animation: fadeInBubble 0.3s ease 5s forwards; /* Applies delayed fade-in by default */
    }
    .chat-bubble-close:hover { background: rgba(0, 0, 0, 0.6); }

    /* Hiding bubble/close button when chat is open (overrides animation) */
    .chat-container.open ~ .chat-bubble,
    .chat-container.open ~ .chat-bubble-close {
        opacity: 0 !important;
        transform: ${config.style.position === 'left' ? 'translateX(-10px)' : 'translateX(10px)'};
        pointer-events: none !important;
        animation: none !important; /* Ensure animation stops if chat opens */
    }
    /* Hiding close button when bubble is manually closed (overrides animation) */
    /* Note: Inline style from JS on manual close also helps ensure it stays hidden */
    .chat-bubble[style*="opacity: 0"] ~ .chat-bubble-close {
        opacity: 0 !important; pointer-events: none !important;
        animation: none !important; /* Ensure animation stops if manually closed */
    }

    /* --- START: Mobile Size Adjustments --- */
    @media (max-width: 767px) {
        .chat-toggle {
            width: 48px; height: 48px;
        }
        .chat-toggle svg {
            width: 22px; height: 22px;
        }
        .chat-bubble {
            max-width: 192px; padding: 24px 12px 12px 20px;
             right: ${config.style.position === 'left' ? 'auto' : '40px'};
             left: ${config.style.position === 'left' ? '40px' : 'auto'};
        }
         .bubble-line {
             margin: 4px 4px 10px;
         }
         .bubble-text {
             font-size: 13px; padding-right: 36px;
         }
         .chat-bubble-close {
             bottom: 70px; right: 180px; left: auto;
        }
    }
    /* --- END: Mobile Size Adjustments --- */

    `;

    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    shadowRoot.appendChild(styleElement);

    // --- Create Widget Elements (to be added to Shadow Root) ---
    const chatContainer = document.createElement('div'); chatContainer.className = `chat-container`;
    // SVG definitions (remain the same)
    const chatIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>`;
    const whatsappIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12.03 2C6.54 2 2.08 6.46 2.08 11.95c0 1.78.46 3.48 1.31 4.96L2 22l5.28-1.38c1.45.77 3.08 1.2 4.75 1.2h.01c5.48 0 9.94-4.46 9.94-9.94S17.52 2 12.03 2zm4.48 13.66c-.25-.12-1.48-.73-1.71-.82-.23-.08-.39-.12-.56.12-.17.25-.65.81-.79.98-.14.17-.29.18-.54.06s-1.05-.38-2-1.23c-.74-.66-1.23-1.47-1.38-1.72s-.02-.38.11-.51c.12-.12.26-.32.39-.48s.17-.25.26-.42c.09-.17.04-.31-.02-.43s-.56-1.35-.76-1.84c-.2-.48-.41-.42-.56-.42h-.47c-.17 0-.43.06-.66.31-.22.25-.86.84-.86 2.04 0 1.2.88 2.36 1 2.53s1.75 2.66 4.23 3.74c.59.25 1.05.4 1.41.52.57.17 1.09.15 1.5.09.46-.06 1.48-.6 1.69-1.18.21-.58.21-1.08.15-1.18-.07-.13-.24-.2-.5-.33z"/></svg>`;
    const emailIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 14H4V8l8 5 8-5v10zm-8-7L4 6h16l-8 5z"/></svg>`;
    const closeIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`;
    const closeXIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
    const sendIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`;
    const whatsappButtonIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" style="margin-left: 8px;" width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.93 7.93 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.57 6.57 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.31-1.574-.967-.571-.525-.948-1.175-1.077-1.374-.131-.197-.014-.304.098-.403.107-.094.235-.248.354-.368.115-.12.153-.197.23-.33.077-.133.038-.247-.015-.347-.05-.1-.445-1.076-.612-1.47-.16-.389-.327-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-1.18.164-.703.164-1.29.114-1.413-.048-.119-.17-.184-.357-.278z"/></svg>`;

    // --- Define chatInterfaceHTML ---
    const chatInterfaceHTML = `
    <div class="chat-interface">
        <div class="brand-header">
            ${config.branding.logo ? `<img src="${config.branding.logo}" alt="${config.branding.name || ''}">` : ''}
            <div class="header-text">
                <span class="header-name">${config.branding.name}</span>
                <div class="header-status-line">
                    <span class="online-status">Online</span>
                    <span class="header-subtitle">${config.branding.subtitleText}</span>
                </div>
            </div>
            <button class="close-button" aria-label="Sluit Chat"> ${closeIconSVG} </button>
        </div>
        <div class="chat-content-area">
            <div class="chat-messages"></div>
            <div class="channel-overlay whatsapp-overlay view-hidden">
                <div class="channel-info-bubble">
                    <div class="channel-info-icon-whatsapp">${whatsappIconSVG}</div>
                    <p>${config.branding.whatsappViewText}</p>
                </div>
                <a href="${config.branding.whatsappLink}" target="_blank" rel="noopener noreferrer" class="channel-info-button whatsapp-button">
                    ${config.branding.whatsappViewButtonText} ${whatsappButtonIconSVG}
                </a>
            </div>
            <div class="channel-overlay email-overlay view-hidden">
                <div class="channel-info-bubble">
                    <div class="channel-info-icon-email">${emailIconSVG}</div>
                    <p>${config.branding.emailViewText}</p>
                </div>
                <a href="${config.branding.emailLink}" target="_blank" rel="noopener noreferrer" class="channel-info-button email-button">
                    ${config.branding.emailViewButtonText}
                </a>
            </div>
        </div>
        <div class="chat-input">
            <textarea placeholder="${config.branding.inputPlaceholder}" rows="1" aria-label="Chat bericht invoer"></textarea>
            <button type="submit" aria-label="Verstuur Bericht" disabled> ${sendIconSVG} </button>
        </div>
        <div class="chat-footer-actions">
            <a data-view="chat" class="footer-action-btn active" aria-label="Chat"> ${chatIconSVG} </a>
            ${config.branding.whatsappLink && config.branding.whatsappLink !== '#' ? `<a data-view="whatsapp" class="footer-action-btn" aria-label="WhatsApp"> ${whatsappButtonIconSVG.replace(' style="margin-left: 8px;"', '')} </a>` : ''}
            ${config.branding.emailLink && config.branding.emailLink !== '#' ? `<a data-view="email" class="footer-action-btn" aria-label="Email"> ${emailIconSVG} </a>` : ''}
        </div>
    </div>
    `;
    chatContainer.innerHTML = chatInterfaceHTML;

    // Toggle Button
    const toggleButton = document.createElement('button');
    toggleButton.className = `chat-toggle`;
    toggleButton.setAttribute('aria-label', 'Chat openen/sluiten');
    toggleButton.innerHTML = `
        <svg class="chat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="currentColor"><path d="M123.6 391.3c12.9-9.4 29.6-11.8 44.6-6.4c26.5 9.6 56.2 15.1 87.8 15.1c124.7 0 208-80.5 208-160s-83.3-160-208-160S48 160.5 48 240c0 32 12.4 62.8 35.7 89.2c8.6 9.7 12.8 22.5 11.8 35.5c-1.4 18.1-5.7 34.7-11.3 49.4c17-7.9 31.1-16.7 39.4-22.7zM21.2 431.9c1.8-2.7 3.5-5.4 5.1-8.1c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208s-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6c-15.1 6.6-32.3 12.6-50.1 16.1c-.8 .2-1.6 .3-2.4 .5c-4.4 .8-8.7 1.5-13.2 1.9c-.2 0-.5 .1-.7 .1c-5.1 .5-10.2 .8-15.3 .8c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4c4.1-4.2 7.8-8.7 11.3-13.5c1.7-2.3 3.3-4.6 4.8-6.9l.3-.5z"/></svg>
        <svg class="close-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
    `;

    // Text Bubble
    const chatBubble = document.createElement('div'); chatBubble.className = 'chat-bubble'; chatBubble.innerHTML = `<hr class="bubble-line"><span class="bubble-text">${config.branding.welcomeText}</span>`;

    // Bubble Close Button
    bubbleCloseButton = document.createElement('button'); bubbleCloseButton.className = 'chat-bubble-close'; bubbleCloseButton.innerHTML = '&times;'; bubbleCloseButton.setAttribute('aria-label', 'Sluit tooltip');

    // --- MODIFICATION: Apply initial hidden state if needed based on localStorage ---
    if (shouldBubbleStayHiddenInitially) {
        chatBubble.style.opacity = '0';
        chatBubble.style.pointerEvents = 'none';
        chatBubble.style.animation = 'none'; // Prevent delayed fade-in

        bubbleCloseButton.style.opacity = '0';
        bubbleCloseButton.style.pointerEvents = 'none';
        bubbleCloseButton.style.animation = 'none'; // Prevent delayed fade-in
    }
    // --- END MODIFICATION ---


    bubbleCloseButton.addEventListener('click', (e) => {
        e.stopPropagation();
        isBubbleManuallyClosed = true;
        localStorage.setItem(storageKey, Date.now().toString()); // MODIFICATION: Store timestamp

        if (chatBubble) {
             chatBubble.style.opacity = '0';
             chatBubble.style.pointerEvents = 'none';
             chatBubble.style.animation = 'none';
        }
        if (bubbleCloseButton) {
             bubbleCloseButton.style.opacity = '0';
             bubbleCloseButton.style.pointerEvents = 'none';
             bubbleCloseButton.style.animation = 'none';
        }
    });

    // --- Append elements TO SHADOW ROOT ---
    shadowRoot.appendChild(chatContainer);
    shadowRoot.appendChild(chatBubble);
    shadowRoot.appendChild(bubbleCloseButton);
    shadowRoot.appendChild(toggleButton);

    // --- Append SHADOW HOST to document body ---
    document.body.appendChild(shadowHost);

    // --- Get References (using shadowRoot) ---
    const messagesContainer = shadowRoot.querySelector('.chat-messages');
    const textarea = shadowRoot.querySelector('textarea');
    const sendButton = shadowRoot.querySelector('button[type="submit"]');
    const closeButton = shadowRoot.querySelector('.close-button');
    const chatContentArea = shadowRoot.querySelector('.chat-content-area');
    const chatInputContainer = shadowRoot.querySelector('.chat-input');
    const footerActionsContainer = shadowRoot.querySelector('.chat-footer-actions');
    const whatsappOverlayView = shadowRoot.querySelector('.whatsapp-overlay');
    const emailOverlayView = shadowRoot.querySelector('.email-overlay');
    const footerButtons = shadowRoot.querySelectorAll('.footer-action-btn');

    // --- Core Functions (Logic remains mostly the same) ---
    function generateUUID() { return crypto.randomUUID(); }

    function showTypingIndicator() {
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.className = 'chat-message bot typing-indicator';
            typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        }
        if (messagesContainer && !messagesContainer.contains(typingIndicator)) {
            messagesContainer.appendChild(typingIndicator);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    function hideTypingIndicator() {
        if (typingIndicator && messagesContainer && messagesContainer.contains(typingIndicator)) {
            messagesContainer.removeChild(typingIndicator);
        }
    }

    function addMessageToDisplay(text, type = 'bot') {
        const messageDiv = document.createElement('div');
        messageDiv.className = `chat-message ${type}`;
        const tempDiv = document.createElement('div');
        tempDiv.textContent = text;
        messageDiv.innerHTML = tempDiv.innerHTML.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        if (!messagesContainer) { console.error("Messages container not found in Shadow DOM."); return; }

        const isFirstBotMessage = (type === 'bot' && messagesContainer.querySelectorAll('.chat-message.bot').length === 0);
        messagesContainer.appendChild(messageDiv);

        if (isFirstBotMessage && config.branding.quickReplies && config.branding.quickReplies.length > 0) {
            if (quickReplyContainer && quickReplyContainer.parentNode === messagesContainer) {
                quickReplyContainer.remove();
            }
            quickReplyContainer = document.createElement('div');
            quickReplyContainer.className = 'quick-reply-container';
            config.branding.quickReplies.forEach(replyText => {
                const button = document.createElement('button');
                button.className = 'quick-reply-button';
                button.textContent = replyText;
                button.addEventListener('click', () => {
                    sendMessage(replyText);
                    if (quickReplyContainer) {
                        quickReplyContainer.remove();
                        quickReplyContainer = null;
                    }
                });
                quickReplyContainer.appendChild(button);
            });
            messagesContainer.appendChild(quickReplyContainer);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }


    async function startOrResumeConversation() {
        if (isChatStarted) return;
        isChatStarted = true;
        if (!currentSessionId) { currentSessionId = generateUUID(); }
        showTypingIndicator();
        const payload = { action: "loadPreviousSession", sessionId: currentSessionId, route: config.webhook.route, metadata: { userId: "" } };
        try {
            const response = await fetch(config.webhook.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([payload]) });
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const responseData = await response.json();
            hideTypingIndicator();
            const outputData = Array.isArray(responseData) ? responseData[0] : responseData;

            if (!messagesContainer) { console.error("Messages container not found before adding initial messages."); return; }

            if (outputData && outputData.output) {
                if (messagesContainer.children.length === 0 || (messagesContainer.children.length === 1 && messagesContainer.contains(typingIndicator))) {
                    addMessageToDisplay(outputData.output, 'bot');
                }
            } else if (outputData && outputData.messages) {
                messagesContainer.innerHTML = '';
                outputData.messages.forEach(msg => addMessageToDisplay(msg.text, msg.type));
            } else {
                console.warn("No initial message received.");
                if (messagesContainer.children.length === 0) {
                    addMessageToDisplay(config.branding.welcomeText || "Welcome!", 'bot');
                }
            }
        } catch (error) {
            console.error('Error starting:', error);
            hideTypingIndicator();
            addMessageToDisplay('Sorry, could not connect. Please try later.', 'bot');
        } finally {
            if(textarea && chatContainer.classList.contains('open') && chatInputContainer && chatInputContainer.style.display !== 'none') {
                 // textarea.focus(); // <<< MODIFICATION: Commented out this line
            }
        }
    }

    async function sendMessage(message) {
        if (!message || !currentSessionId) return;
        if (messagesContainer && quickReplyContainer && messagesContainer.contains(quickReplyContainer)) {
            quickReplyContainer.remove();
            quickReplyContainer = null;
        }
        addMessageToDisplay(message, 'user');
        if (textarea) {
            textarea.value = '';
            textarea.style.height = 'auto';
        }
        if (sendButton) { sendButton.disabled = true; }
        showTypingIndicator();
        const payload = { action: "sendMessage", sessionId: currentSessionId, route: config.webhook.route, chatInput: message, metadata: { userId: "" } };
        try {
            const response = await fetch(config.webhook.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status}`); }
            const responseData = await response.json();
            hideTypingIndicator();
            const outputData = Array.isArray(responseData) ? responseData[0] : responseData;
            if (outputData && outputData.output) {
                addMessageToDisplay(outputData.output, 'bot');
            } else {
                console.warn("Empty response received.");
            }
        } catch (error) {
            console.error('Error sending:', error);
            hideTypingIndicator();
            addMessageToDisplay('Sorry, error sending message.', 'bot');
        }
    }

    function showOverlay(viewName) {
        if (whatsappOverlayView) whatsappOverlayView.classList.remove('view-active');
        if (emailOverlayView) emailOverlayView.classList.remove('view-active');
        if (chatInputContainer) chatInputContainer.style.display = 'none';
        if (messagesContainer) messagesContainer.style.display = 'none';

        if (viewName === 'whatsapp' && whatsappOverlayView) { whatsappOverlayView.classList.add('view-active'); }
        else if (viewName === 'email' && emailOverlayView) { emailOverlayView.classList.add('view-active'); }
        footerButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.view === viewName); });
    }

    function showChatView() {
        if (whatsappOverlayView) whatsappOverlayView.classList.remove('view-active');
        if (emailOverlayView) emailOverlayView.classList.remove('view-active');
        if (chatInputContainer) chatInputContainer.style.display = 'flex';
        if (messagesContainer) messagesContainer.style.display = 'flex';
        footerButtons.forEach(btn => { btn.classList.toggle('active', btn.dataset.view === 'chat'); });
        if (textarea && chatContainer.classList.contains('open')) {
             // textarea.focus(); // <<< MODIFICATION: Commented out this line
        }
    }

    // --- Event Listeners ---
    if (textarea) {
         textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
             if(sendButton) sendButton.disabled = textarea.value.trim().length === 0;
         });
        textarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const message = textarea.value.trim();
                if (message) { sendMessage(message); }
            }
        });
    } else { console.error("Textarea element not found in Shadow DOM."); }

    if (sendButton) {
        sendButton.addEventListener('click', () => {
            if(textarea) {
                const message = textarea.value.trim();
                if (message) { sendMessage(message); }
            }
        });
    } else { console.error("Send button element not found in Shadow DOM."); }

    // Toggle Button Listener
    toggleButton.addEventListener('click', () => {
        const isOpen = chatContainer.classList.toggle('open');
        if (isOpen) {
            // Hide bubble and its close button when chat opens
            // CSS rule with !important handles this
            if (!isChatStarted) { startOrResumeConversation(); }
            if (!whatsappOverlayView?.classList.contains('view-active') && !emailOverlayView?.classList.contains('view-active')) {
                showChatView();
            }
        } else {
             // When closing chat, elements visibility is handled by CSS animation/rules
             // unless manually closed (which sets inline styles)
        }
    });

    // Header Close Button Listener
    if (closeButton) {
         closeButton.addEventListener('click', () => {
             chatContainer.classList.remove('open');
             // When closing chat, elements visibility is handled by CSS animation/rules
             // unless manually closed (which sets inline styles)
         });
    } else { console.error("Chat widget header close button not found in Shadow DOM."); }

    // Click listener for the bubble itself
    if (chatBubble) {
         chatBubble.addEventListener('click', () => {
             // Only allow opening chat via bubble if it's visible and not manually closed
             // Check computed style opacity as inline style might not be set yet if animation hasn't run
             if (!chatContainer.classList.contains('open') && !isBubbleManuallyClosed && parseFloat(window.getComputedStyle(chatBubble).opacity) > 0) {
                 toggleButton.click();
             }
         });
    }

    // Attach listeners to footer buttons
    footerButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const targetView = e.currentTarget.dataset.view;
            e.preventDefault();
            if (targetView === 'chat') { showChatView(); }
            else if (targetView === 'whatsapp' || targetView === 'email') { showOverlay(targetView); }
        });
    });

    // Initial check
    if (textarea && sendButton) { sendButton.disabled = textarea.value.trim().length === 0; }
    showChatView(); // Initialize with chat view active

})(); // End IIFE
