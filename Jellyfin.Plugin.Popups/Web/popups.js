/*
 * Jellyfin Popups - client script.
 * Injected into the Jellyfin web client by the plugin. Works in browsers, the desktop app
 * and the Android / iOS apps (they all run the web client). Native TV clients can't run it.
 *
 * Everything is built with DOM calls (never innerHTML) so popup text can't inject markup.
 */
(function () {
    'use strict';

    if (window.JellyfinPopups) {
        return;
    }

    var script = document.currentScript;
    var LOG = '[Popups]';
    var Z_ROOT_ID = 'jfpop-root';

    // ---------------------------------------------------------------- strings
    var STRINGS = {
        en: { close: 'Close', more: 'More info', gotit: 'Got it', dialog: 'Notice' },
        es: { close: 'Cerrar', more: 'Más info', gotit: 'Entendido', dialog: 'Aviso' },
        pt: { close: 'Fechar', more: 'Mais info', gotit: 'Entendi', dialog: 'Aviso' }
    };

    function t(key) {
        var lang = (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
        return (STRINGS[lang] || STRINGS.en)[key] || STRINGS.en[key];
    }

    // ---------------------------------------------------------------- helpers
    function noop() { }

    function lowerFirst(s) { return s.charAt(0).toLowerCase() + s.slice(1); }

    // The server sends PascalCase JSON; read it as camelCase.
    function camel(obj) {
        var out = {};
        Object.keys(obj || {}).forEach(function (k) { out[lowerFirst(k)] = obj[k]; });
        return out;
    }

    function el(tag, className, text) {
        var node = document.createElement(tag);
        if (className) { node.className = className; }
        if (text != null) { node.textContent = text; }
        return node;
    }

    function svgIcon(pathD) {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var p = document.createElementNS(ns, 'path');
        p.setAttribute('d', pathD);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '2.2');
        p.setAttribute('stroke-linecap', 'round');
        svg.appendChild(p);
        return svg;
    }

    function isSafeUrl(u) {
        return /^https?:\/\//i.test(u) || /^#\//.test(u) || (/^\//.test(u) && !/^\/\//.test(u));
    }

    function getDevice() {
        var cl = document.documentElement.classList;
        if (cl.contains('layout-mobile')) { return 'mobile'; }
        if (cl.contains('layout-desktop') || cl.contains('layout-tv')) { return 'desktop'; }
        return window.matchMedia && window.matchMedia('(max-width: 40em)').matches ? 'mobile' : 'desktop';
    }

    function openLink(url) {
        if (!isSafeUrl(url)) { return; }
        if (/^#\//.test(url)) {
            window.location.hash = url;
            return;
        }
        var abs = new URL(url, window.location.href).href;
        if (window.NativeShell && typeof window.NativeShell.openUrl === 'function') {
            window.NativeShell.openUrl(abs, '_blank');
        } else {
            window.open(abs, '_blank', 'noopener');
        }
    }

    // ---------------------------------------------------------------- stylesheet
    function loadStyles() {
        if (document.getElementById('jfpop-css')) { return; }
        var link = document.createElement('link');
        link.id = 'jfpop-css';
        link.rel = 'stylesheet';
        var href = script && script.src ? script.src.replace(/popups\.js/, 'popups.css') : '../Popups/popups.css';
        link.href = href;
        document.head.appendChild(link);
    }

    // ---------------------------------------------------------------- safe text
    // Supports: blank line = new paragraph, **bold**, [text](url). Nothing else.
    function renderBody(container, text) {
        var paragraphs = String(text).replace(/\r\n?/g, '\n').split(/\n{2,}/);
        paragraphs.forEach(function (para) {
            if (!para.trim()) { return; }
            var p = el('p');
            para.split('\n').forEach(function (line, i) {
                if (i > 0) { p.appendChild(document.createElement('br')); }
                appendInline(p, line);
            });
            container.appendChild(p);
        });
    }

    function appendInline(parent, line) {
        var re = /\*\*(.+?)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
        var last = 0;
        var m;
        while ((m = re.exec(line)) !== null) {
            if (m.index > last) { parent.appendChild(document.createTextNode(line.slice(last, m.index))); }
            if (m[1] != null) {
                parent.appendChild(el('strong', null, m[1]));
            } else if (isSafeUrl(m[3])) {
                var a = el('a', 'jfpop-link', m[2]);
                a.href = m[3];
                a.rel = 'noopener noreferrer';
                a.addEventListener('click', makeLinkHandler(m[3]));
                parent.appendChild(a);
            } else {
                parent.appendChild(document.createTextNode(m[2]));
            }
            last = re.lastIndex;
        }
        if (last < line.length) { parent.appendChild(document.createTextNode(line.slice(last))); }
    }

    var activeClose = null;

    function makeLinkHandler(url) {
        return function (e) {
            e.preventDefault();
            if (activeClose) { activeClose(); }
            openLink(url);
        };
    }

    // ---------------------------------------------------------------- item (library title)
    function loadItem(p) {
        if (!p.itemId || !window.ApiClient) { return Promise.resolve(null); }
        try {
            return Promise.resolve(window.ApiClient.getItem(window.ApiClient.getCurrentUserId(), p.itemId))
                .catch(function () { return null; });
        } catch (e) {
            return Promise.resolve(null);
        }
    }

    function itemImage(item, kind, width) {
        var id = null;
        var tag = null;
        if (kind === 'Backdrop') {
            if (item.BackdropImageTags && item.BackdropImageTags.length) {
                id = item.Id; tag = item.BackdropImageTags[0];
            } else if (item.ParentBackdropImageTags && item.ParentBackdropImageTags.length) {
                id = item.ParentBackdropItemId; tag = item.ParentBackdropImageTags[0];
            }
        } else if (kind === 'Logo') {
            if (item.ImageTags && item.ImageTags.Logo) {
                id = item.Id; tag = item.ImageTags.Logo;
            } else if (item.ParentLogoImageTag) {
                id = item.ParentLogoItemId; tag = item.ParentLogoImageTag;
            }
        } else if (kind === 'Primary') {
            if (item.ImageTags && item.ImageTags.Primary) {
                id = item.Id; tag = item.ImageTags.Primary;
            }
        }
        if (!id) { return null; }
        return window.ApiClient.getImageUrl(id, { type: kind, maxWidth: width, tag: tag, quality: 90 });
    }

    function itemMeta(item) {
        var bits = [];
        if (item.ProductionYear) { bits.push(String(item.ProductionYear)); }
        if (item.OfficialRating) { bits.push(item.OfficialRating); }
        if (item.RunTimeTicks && item.Type === 'Movie') {
            var mins = Math.round(item.RunTimeTicks / 600000000);
            bits.push(mins >= 60 ? Math.floor(mins / 60) + 'h ' + (mins % 60) + 'm' : mins + 'm');
        }
        return bits;
    }

    // ---------------------------------------------------------------- the dialog
    var counter = 0;

    function buildCard(p, item, settings, close) {
        var id = 'jfpop-' + (++counter);
        var overlay = el('div', 'jfpop-overlay');
        overlay.setAttribute('data-size', p.size || 'standard');

        var card = el('div', 'jfpop-card');
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', id + '-title');
        card.tabIndex = -1;
        if (p.accentColor && /^#[0-9a-fA-F]{6}$/.test(p.accentColor)) {
            card.style.setProperty('--jfpop-accent', p.accentColor);
        }

        // Close (X)
        var x = el('button', 'jfpop-close');
        x.type = 'button';
        x.setAttribute('aria-label', t('close'));
        x.appendChild(svgIcon('M6 6l12 12M18 6L6 18'));
        x.addEventListener('click', close);
        card.appendChild(x);

        // Media: library item backdrop, else a custom image
        var mediaUrl = null;
        var logoUrl = null;
        if (item) {
            mediaUrl = itemImage(item, 'Backdrop', 1280) || itemImage(item, 'Primary', 720);
            logoUrl = itemImage(item, 'Logo', 600);
        }
        if (!mediaUrl && p.imageUrl) { mediaUrl = p.imageUrl; }

        if (mediaUrl) {
            var media = el('div', 'jfpop-media');
            var img = el('img', 'jfpop-img');
            img.alt = '';
            img.decoding = 'async';
            img.addEventListener('error', function () {
                if (media.parentNode) { media.parentNode.removeChild(media); }
            });
            img.src = mediaUrl;
            media.appendChild(img);
            if (logoUrl) {
                var logo = el('img', 'jfpop-logo');
                logo.alt = '';
                logo.src = logoUrl;
                logo.addEventListener('error', function () {
                    if (logo.parentNode) { logo.parentNode.removeChild(logo); }
                });
                media.appendChild(logo);
            }
            card.appendChild(media);
        } else {
            card.classList.add('jfpop-no-media');
        }

        // Content
        var body = el('div', 'jfpop-content');
        if (p.label) { body.appendChild(el('div', 'jfpop-label', p.label)); }

        var titleText = p.title || (item && item.Name) || t('dialog');
        var title = el('h2', 'jfpop-title' + (logoUrl && !p.title ? ' jfpop-sr' : ''), titleText);
        title.id = id + '-title';
        body.appendChild(title);

        if (item) {
            var meta = itemMeta(item);
            if (meta.length) { body.appendChild(el('div', 'jfpop-meta', meta.join('  ·  '))); }
        }

        var hasText = !!p.body;
        if (hasText || (item && item.Overview)) {
            var text = el('div', 'jfpop-body');
            text.id = id + '-body';
            if (hasText) {
                renderBody(text, p.body);
            } else {
                text.classList.add('jfpop-clamp');
                text.appendChild(el('p', null, item.Overview));
            }
            body.appendChild(text);
            card.setAttribute('aria-describedby', text.id);
        }

        // Buttons
        var actions = el('div', 'jfpop-actions');
        var primary = null;

        if (p.buttonUrl && isSafeUrl(p.buttonUrl)) {
            primary = el('button', 'jfpop-btn jfpop-btn-primary', p.buttonText || t('more'));
            primary.type = 'button';
            primary.addEventListener('click', function () { close(); openLink(p.buttonUrl); });
            actions.appendChild(primary);
        }
        if (item) {
            var more = el('button', 'jfpop-btn ' + (primary ? 'jfpop-btn-secondary' : 'jfpop-btn-primary'), t('more'));
            more.type = 'button';
            more.addEventListener('click', function () {
                close();
                var sid = window.ApiClient && window.ApiClient.serverId ? window.ApiClient.serverId() : '';
                openLink('#/details?id=' + encodeURIComponent(item.Id) + (sid ? '&serverId=' + encodeURIComponent(sid) : ''));
            });
            actions.appendChild(more);
            if (!primary) { primary = more; }
        }
        if (!primary) {
            primary = el('button', 'jfpop-btn jfpop-btn-primary', t('gotit'));
            primary.type = 'button';
            primary.addEventListener('click', close);
            actions.appendChild(primary);
        }
        body.appendChild(actions);
        card.appendChild(body);
        overlay.appendChild(card);

        if (settings.closeOnBackdropClick) {
            overlay.addEventListener('mousedown', function (e) {
                if (e.target === overlay) { close(); }
            });
        }

        return { overlay: overlay, card: card, primary: primary, closeButton: x };
    }

    // Shows one popup. Resolves after it is closed (or at once if there was nothing to show).
    function showPopup(p, settings, opts) {
        opts = opts || {};
        return loadItem(p).then(function (item) {
            var hasOther = p.title || p.body || p.imageUrl;
            if (p.itemId && !item && !hasOther) { return null; }

            return new Promise(function (resolve) {
                loadStyles();
                var root = document.getElementById(Z_ROOT_ID);
                if (!root) {
                    root = el('div');
                    root.id = Z_ROOT_ID;
                    document.body.appendChild(root);
                }

                var previousFocus = document.activeElement;
                var closed = false;
                var built;

                function onKey(e) {
                    if (e.key === 'Escape' || e.key === 'Esc') {
                        e.stopPropagation();
                        e.preventDefault();
                        close();
                        return;
                    }
                    if (e.key !== 'Tab') { return; }
                    var focusable = built.card.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])');
                    if (!focusable.length) { return; }
                    var first = focusable[0];
                    var last = focusable[focusable.length - 1];
                    if (e.shiftKey && (document.activeElement === first || document.activeElement === built.card)) {
                        e.preventDefault(); last.focus();
                    } else if (!e.shiftKey && document.activeElement === last) {
                        e.preventDefault(); first.focus();
                    } else if (!built.card.contains(document.activeElement)) {
                        e.preventDefault(); first.focus();
                    }
                }

                function close() {
                    if (closed) { return; }
                    closed = true;
                    activeClose = null;
                    document.removeEventListener('keydown', onKey, true);
                    built.overlay.classList.remove('jfpop-in');
                    built.overlay.classList.add('jfpop-out');
                    var done = function () {
                        if (built.overlay.parentNode) { built.overlay.parentNode.removeChild(built.overlay); }
                        if (previousFocus && typeof previousFocus.focus === 'function') {
                            try { previousFocus.focus(); } catch (e) { /* ignore */ }
                        }
                        resolve();
                    };
                    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
                    if (reduce) { done(); } else { setTimeout(done, 220); }
                }

                built = buildCard(p, item, settings, close);
                activeClose = close;
                root.appendChild(built.overlay);
                document.addEventListener('keydown', onKey, true);

                // Next frame so the open animation runs.
                requestAnimationFrame(function () {
                    built.overlay.classList.add('jfpop-in');
                    try { built.primary.focus({ preventScroll: true }); } catch (e) { built.card.focus(); }
                });

                if (typeof opts.onShown === 'function') { opts.onShown(); }
            });
        });
    }

    // ---------------------------------------------------------------- visit logic
    var lastUserId = null;
    var running = false;

    function inVideo() {
        return (window.location.hash || '').indexOf('#/video') === 0;
    }

    function whenNotInVideo(fn) {
        if (!inVideo()) { fn(); return; }
        var handler = function () {
            if (!inVideo()) {
                window.removeEventListener('hashchange', handler);
                fn();
            }
        };
        window.addEventListener('hashchange', handler);
    }

    function markSeen(p) {
        if (p.frequency !== 'once' || !window.ApiClient) { return; }
        try {
            Promise.resolve(window.ApiClient.fetch({
                url: window.ApiClient.getUrl('Popups/Seen/' + encodeURIComponent(p.id) + '?revision=' + encodeURIComponent(p.revision)),
                type: 'POST'
            })).catch(noop);
        } catch (e) { /* ignore */ }
    }

    function runQueue(list, settings) {
        var chain = Promise.resolve();
        list.forEach(function (p) {
            chain = chain.then(function () {
                return new Promise(function (resolve) { whenNotInVideo(resolve); });
            }).then(function () {
                return showPopup(p, settings, { onShown: function () { markSeen(p); } });
            }).then(function () {
                return new Promise(function (r) { setTimeout(r, 250); });
            });
        });
        return chain;
    }

    function startVisit(userId) {
        if (running) { return; }
        running = true;
        lastUserId = userId;

        var api = window.ApiClient;
        Promise.resolve(api.fetch({ url: api.getUrl('Popups/Active'), type: 'GET', dataType: 'json' }))
            .then(function (res) {
                var settings = camel(res && (res.Settings || res.settings));
                startAsks(res && (res.Settings || res.settings));
                var device = getDevice();
                var list = ((res && (res.Popups || res.popups)) || []).map(camel).filter(function (p) {
                    return !p.device || p.device === 'all' || p.device === device;
                });
                list = list.slice(0, Math.max(1, settings.maxPerVisit || 3));
                if (!list.length) { return null; }
                var delay = Math.max(0, settings.showDelaySeconds || 0) * 1000;
                return new Promise(function (r) { setTimeout(r, delay); }).then(function () {
                    return runQueue(list, settings);
                });
            })
            .catch(function (e) { console.debug(LOG, 'skipped:', e); })
            .then(function () { running = false; });
    }

    // ---------------------------------------------------------------- Asks (loaded on demand)
    var asksSettings = null;
    var asksLoading = null;

    function asksUrl() {
        var src = (script && script.src) || '';
        return src.replace(/popups\.js/, 'asks.js');
    }

    function loadAsks() {
        if (window.JellyfinAsks && window.JellyfinAsks.ready) { return Promise.resolve(); }
        if (asksLoading) { return asksLoading; }
        asksLoading = new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = asksUrl();
            s.onload = resolve;
            s.onerror = function () { asksLoading = null; reject(new Error('asks.js')); };
            document.head.appendChild(s);
        });
        return asksLoading;
    }

    function startAsks(raw) {
        var a = raw && (raw.Asks || raw.asks);
        asksSettings = a ? camel(a) : null;
        if (!asksSettings || !asksSettings.enabled) {
            if (window.JellyfinAsks && window.JellyfinAsks.reset) { window.JellyfinAsks.reset(); }
            return;
        }
        loadAsks().then(function () { window.JellyfinAsks.init(asksSettings); }, noop);
    }

    // Early stub so a menu link (KefinTweaks Action: JellyfinAsks.open) works before asks.js is loaded.
    if (!window.JellyfinAsks) {
        window.JellyfinAsks = {
            open: function () {
                if (!asksSettings || !asksSettings.enabled) { return; }
                loadAsks().then(function () { window.JellyfinAsks.init(asksSettings); window.JellyfinAsks.open(); }, noop);
            }
        };
    }

    // Wait for sign-in, then show this visit's popups once. A different user signing in
    // later in the same page load (log out / log in) gets their own visit.
    function watch() {
        var timer = setInterval(function () {
            if (document.hidden) { return; }
            var api = window.ApiClient;
            var uid = api && typeof api.getCurrentUserId === 'function' ? api.getCurrentUserId() : null;
            if (uid && uid !== lastUserId && typeof api.fetch === 'function') {
                startVisit(uid);
            } else if (!uid) {
                lastUserId = null;
                if (window.JellyfinAsks && window.JellyfinAsks.reset) { window.JellyfinAsks.reset(); }
            }
        }, 1500);
        return timer;
    }

    // ---------------------------------------------------------------- public API
    // Used by the admin page's "Preview" button. Preview never records "seen".
    window.JellyfinPopups = {
        version: 1,
        preview: function (popup) {
            var p = camel(popup);
            return showPopup(p, { closeOnBackdropClick: true }, {});
        }
    };

    watch();
})();
