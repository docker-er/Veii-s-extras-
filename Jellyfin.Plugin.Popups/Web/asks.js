/*
 * Asks - client script. Loaded by popups.js when Asks is on.
 * A private inbox: users send problems, requests (with a library title attached) and opinions.
 * Only the sender and the admin can read them. Built with DOM calls only (no innerHTML).
 *
 * Open it from anywhere with JellyfinAsks.open(). In KefinTweaks, add a custom menu link whose
 * Action is  JellyfinAsks.open  to get an "Asks" tab in the header or the side menu.
 */
(function () {
    'use strict';

    if (window.JellyfinAsks && window.JellyfinAsks.ready) {
        return;
    }

    var ROOT_ID = 'jfask-root';
    var INBOX_HASH = '#/configurationpage?name=Asks';

    // ---------------------------------------------------------------- strings
    var STRINGS = {
        en: {
            newMsg: 'New message', mine: 'My messages',
            intro: 'Report a problem, ask for a title, or tell me what you think.',
            privateNote: 'Private: only you and the admin can read this.',
            tProblem: 'Problem', tRequest: 'Request', tOpinion: 'Opinion', tOther: 'Other',
            kindLabel: 'What do you need?', kAdd: 'Add it to the library', kSubs: 'Subtitles', kDub: 'Dub / audio', kOther: 'Something else',
            about: 'About a movie or show (optional)', search: 'Search the library…', searching: 'Searching…', noResults: 'Nothing found in the library',
            titleText: 'Title (if it is not in the library)', titleTextHint: 'Write the name so I can look for it.',
            message: 'Your message',
            phProblem: 'What is not working? What were you doing when it happened?',
            phRequest: 'Tell me what you would like…', phOpinion: 'What do you think?', phOther: 'Write anything…',
            photos: 'Photos', addPhotos: 'Add photos', photosHint: 'Up to 3 photos or screenshots.',
            send: 'Send', sending: 'Sending…', sentTitle: 'Sent!', sentBody: 'Thank you. Only the admin will see it.',
            another: 'Send another', close: 'Close', remove: 'Remove',
            errMessage: 'Write at least a few words.', errRate: 'You have sent a few already. Try again in a while.',
            errGeneric: 'Could not send it. Please try again.', errImage: 'One of the photos could not be used.',
            empty: 'You have not sent anything yet.', statusNew: 'Sent', statusDone: 'Done', reply: 'Reply from the admin',
            loading: 'Loading…', inboxNew: 'new in your inbox', openInbox: 'Open inbox', char: 'characters'
        },
        es: {
            newMsg: 'Nuevo mensaje', mine: 'Mis mensajes',
            intro: 'Reportá un problema, pedí un título o contame qué opinás.',
            privateNote: 'Privado: solo vos y el administrador pueden leerlo.',
            tProblem: 'Problema', tRequest: 'Pedido', tOpinion: 'Opinión', tOther: 'Otro',
            kindLabel: '¿Qué necesitás?', kAdd: 'Agregarlo a la biblioteca', kSubs: 'Subtítulos', kDub: 'Doblaje / audio', kOther: 'Otra cosa',
            about: 'Sobre una película o serie (opcional)', search: 'Buscar en la biblioteca…', searching: 'Buscando…', noResults: 'No se encontró nada en la biblioteca',
            titleText: 'Título (si no está en la biblioteca)', titleTextHint: 'Escribí el nombre para que pueda buscarlo.',
            message: 'Tu mensaje',
            phProblem: '¿Qué no funciona? ¿Qué estabas haciendo cuando pasó?',
            phRequest: 'Contame qué te gustaría…', phOpinion: '¿Qué opinás?', phOther: 'Escribí lo que quieras…',
            photos: 'Fotos', addPhotos: 'Agregar fotos', photosHint: 'Hasta 3 fotos o capturas de pantalla.',
            send: 'Enviar', sending: 'Enviando…', sentTitle: '¡Enviado!', sentBody: 'Gracias. Solo lo va a ver el administrador.',
            another: 'Enviar otro', close: 'Cerrar', remove: 'Quitar',
            errMessage: 'Escribí al menos unas palabras.', errRate: 'Ya mandaste varios. Probá de nuevo en un rato.',
            errGeneric: 'No se pudo enviar. Probá de nuevo.', errImage: 'No se pudo usar una de las fotos.',
            empty: 'Todavía no enviaste nada.', statusNew: 'Enviado', statusDone: 'Listo', reply: 'Respuesta del administrador',
            loading: 'Cargando…', inboxNew: 'nuevos en tu bandeja', openInbox: 'Abrir bandeja', char: 'caracteres'
        }
    };

    function lang() {
        return (document.documentElement.lang || navigator.language || 'en').slice(0, 2).toLowerCase();
    }

    function t(key) {
        return (STRINGS[lang()] || STRINGS.en)[key] || STRINGS.en[key] || key;
    }

    // ---------------------------------------------------------------- helpers
    function el(tag, className, text) {
        var n = document.createElement(tag);
        if (className) { n.className = className; }
        if (text != null) { n.textContent = text; }
        return n;
    }

    var ICONS = {
        chat: 'M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.6-.8L3 21l1.9-5.4A8.4 8.4 0 1 1 21 11.5z',
        x: 'M6 6l12 12M18 6L6 18',
        check: 'M5 12.5l4.5 4.5L19 7.5'
    };

    function icon(name) {
        var ns = 'http://www.w3.org/2000/svg';
        var svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        var p = document.createElementNS(ns, 'path');
        p.setAttribute('d', ICONS[name]);
        p.setAttribute('fill', 'none');
        p.setAttribute('stroke', 'currentColor');
        p.setAttribute('stroke-width', '2.2');
        p.setAttribute('stroke-linecap', 'round');
        p.setAttribute('stroke-linejoin', 'round');
        svg.appendChild(p);
        return svg;
    }

    function api() { return window.ApiClient; }

    function ajax(opts) {
        return Promise.resolve(api().ajax(opts));
    }

    function getJson(path) {
        return ajax({ type: 'GET', url: api().getUrl(path), dataType: 'json' });
    }

    function postJson(path, body) {
        return ajax({ type: 'POST', url: api().getUrl(path), data: JSON.stringify(body), contentType: 'application/json', dataType: 'json' });
    }

    function statusOf(err) {
        return err && (err.status || (err.response && err.response.status));
    }

    function formatDate(iso) {
        var d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }

    // ---------------------------------------------------------------- theme
    // Use the skin's own palette when it sets one, otherwise the page's real colors.
    function solid(c) {
        return c && c !== 'transparent' && !/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*0\s*\)/.test(c) ? c : '';
    }

    function applyTheme(node) {
        var cs = getComputedStyle(document.documentElement);
        var g = function (n) { return cs.getPropertyValue(n).trim(); };
        var bodyCs = getComputedStyle(document.body);
        var bg = g('--jf-palette-background-paper') || solid(bodyCs.backgroundColor) || solid(cs.backgroundColor);
        var text = g('--jf-palette-text-primary') || bodyCs.color;
        var accent = g('--jf-palette-primary-main');
        var accentText = g('--jf-palette-primary-contrastText');
        if (bg) { node.style.setProperty('--jfask-bg', bg); }
        if (text) { node.style.setProperty('--jfask-text', text); }
        if (accent) { node.style.setProperty('--jfask-accent', accent); }
        if (accentText) { node.style.setProperty('--jfask-accent-text', accentText); }
    }

    // The script tag that loaded us, kept for resolving asks.css (currentScript is null later).
    var SELF_SRC = document.currentScript && document.currentScript.src;
    function cssHref() {
        return (SELF_SRC || '../Popups/asks.js').replace(/asks\.js/, 'asks.css');
    }

    function ensureStyles() {
        if (document.getElementById('jfask-css')) { return; }
        var link = document.createElement('link');
        link.id = 'jfask-css';
        link.rel = 'stylesheet';
        link.href = cssHref();
        document.head.appendChild(link);
    }

    // ---------------------------------------------------------------- state
    var cfg = null;
    var root = null;
    var fab = null;
    var timer = null;
    var panel = null; // { overlay, card, close }
    var S = null;

    function freshState() {
        return { view: 'new', type: 'problem', kind: 'add', titleText: '', item: null, message: '', images: [], busy: false, mine: null };
    }

    function ensureRoot() {
        ensureStyles();
        if (!root || !document.body.contains(root)) {
            root = el('div');
            root.id = ROOT_ID;
            document.body.appendChild(root);
        }
        applyTheme(root);
        return root;
    }

    // ---------------------------------------------------------------- floating button
    function hiddenHere() {
        var h = window.location.hash || '';
        return /^#\/(video|dashboard|configurationpage|wizard|login|selectserver|addserver)/i.test(h);
    }

    function signedIn() {
        var a = api();
        return !!(a && typeof a.getCurrentUserId === 'function' && a.getCurrentUserId());
    }

    function ensureFab() {
        if (!cfg || !cfg.showButton) {
            if (fab && fab.parentNode) { fab.parentNode.removeChild(fab); }
            fab = null;
            return;
        }
        ensureRoot();
        if (!fab) {
            fab = el('button', 'jfask-fab');
            fab.type = 'button';
            fab.addEventListener('click', function () { open(); });
        }
        fab.textContent = '';
        fab.setAttribute('data-pos', cfg.buttonPosition === 'bottom-left' ? 'bottom-left' : 'bottom-right');
        fab.setAttribute('aria-label', cfg.buttonText + (cfg.newCount > 0 ? ' (' + cfg.newCount + ')' : ''));
        fab.appendChild(icon('chat'));
        fab.appendChild(el('span', 'jfask-fab-text', cfg.buttonText));
        if (cfg.newCount > 0) { fab.appendChild(el('span', 'jfask-badge', String(cfg.newCount))); }
        if (!fab.parentNode) { root.appendChild(fab); }
    }

    function updateFab() {
        if (!fab) { return; }
        var popupOpen = !!document.querySelector('#jfpop-root .jfpop-overlay');
        fab.hidden = !(signedIn() && !hiddenHere() && !panel && !popupOpen);
    }

    // ---------------------------------------------------------------- panel
    function open() {
        if (!cfg || panel || !signedIn()) { return; }
        ensureRoot();
        S = freshState();

        var overlay = el('div', 'jfask-overlay');
        var card = el('div', 'jfask-card');
        card.setAttribute('role', 'dialog');
        card.setAttribute('aria-modal', 'true');
        card.setAttribute('aria-labelledby', 'jfask-title');
        card.tabIndex = -1;

        var head = el('div', 'jfask-head');
        var title = el('h2', 'jfask-title', cfg.buttonText);
        title.id = 'jfask-title';
        var x = el('button', 'jfask-x');
        x.type = 'button';
        x.setAttribute('aria-label', t('close'));
        x.appendChild(icon('x'));
        head.appendChild(title);
        head.appendChild(x);
        card.appendChild(head);

        var tabs = el('div', 'jfask-tabs');
        tabs.setAttribute('role', 'tablist');
        var tabNew = tabButton(t('newMsg'), 'new');
        var tabMine = tabButton(t('mine'), 'mine');
        tabs.appendChild(tabNew);
        tabs.appendChild(tabMine);
        card.appendChild(tabs);

        var body = el('div', 'jfask-body');
        card.appendChild(body);
        overlay.appendChild(card);
        root.appendChild(overlay);

        var previousFocus = document.activeElement;
        var closed = false;

        function setView(view) {
            S.view = view;
            tabNew.setAttribute('aria-selected', String(view !== 'mine'));
            tabMine.setAttribute('aria-selected', String(view === 'mine'));
            body.textContent = '';
            if (view === 'mine') { renderMine(body); } else if (view === 'sent') { renderSent(body, setView); } else { renderForm(body); }
        }

        function tabButton(label, view) {
            var b = el('button', 'jfask-tab', label);
            b.type = 'button';
            b.setAttribute('role', 'tab');
            b.addEventListener('click', function () { setView(view); });
            return b;
        }

        function onKey(e) {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                close();
                return;
            }
            if (e.key !== 'Tab') { return; }
            var f = card.querySelectorAll('button:not([disabled]), input:not([type=hidden]), textarea, select, a[href]');
            if (!f.length) { return; }
            var first = f[0];
            var last = f[f.length - 1];
            if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) {
                e.preventDefault(); last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault(); first.focus();
            } else if (!card.contains(document.activeElement)) {
                e.preventDefault(); first.focus();
            }
        }

        function close() {
            if (closed) { return; }
            closed = true;
            document.removeEventListener('keydown', onKey, true);
            S.images.forEach(function (im) { URL.revokeObjectURL(im.url); });
            overlay.classList.remove('jfask-in');
            overlay.classList.add('jfask-out');
            var done = function () {
                if (overlay.parentNode) { overlay.parentNode.removeChild(overlay); }
                panel = null;
                updateFab();
                if (previousFocus && typeof previousFocus.focus === 'function') {
                    try { previousFocus.focus(); } catch (e) { /* ignore */ }
                }
            };
            var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduce) { done(); } else { setTimeout(done, 210); }
        }

        panel = { overlay: overlay, card: card, close: close };
        x.addEventListener('click', close);
        overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) { close(); } });
        document.addEventListener('keydown', onKey, true);
        setView('new');
        updateFab();

        requestAnimationFrame(function () {
            overlay.classList.add('jfask-in');
            var first = card.querySelector('.jfask-type[aria-checked="true"], .jfask-textarea');
            try { (first || card).focus({ preventScroll: true }); } catch (e) { card.focus(); }
        });

        // exposed for the sent view
        panel.setView = setView;
    }

    function closePanel() {
        if (panel) { panel.close(); }
    }

    // ---------------------------------------------------------------- the form
    function field(label, control, hint) {
        var wrap = el('div', 'jfask-field');
        if (label) { wrap.appendChild(el('label', 'jfask-label', label)); }
        wrap.appendChild(control);
        if (hint) { wrap.appendChild(el('div', 'jfask-hint', hint)); }
        return wrap;
    }

    function placeholderFor(type) {
        return { problem: t('phProblem'), request: t('phRequest'), opinion: t('phOpinion'), other: t('phOther') }[type];
    }

    function renderForm(body) {
        // Admin shortcut to the inbox
        if (cfg.newCount > 0) {
            var banner = el('div', 'jfask-banner');
            banner.appendChild(el('span', null, cfg.newCount + ' ' + t('inboxNew')));
            var link = el('a', null, t('openInbox'));
            link.href = INBOX_HASH;
            link.addEventListener('click', function (e) { e.preventDefault(); closePanel(); window.location.hash = INBOX_HASH; });
            banner.appendChild(link);
            body.appendChild(banner);
        }

        var note = el('p', 'jfask-note');
        note.appendChild(document.createTextNode((cfg.intro || t('intro')) + ' '));
        note.appendChild(el('strong', null, t('privateNote')));
        body.appendChild(note);

        // Type
        var typeRow = el('div', 'jfask-types');
        typeRow.setAttribute('role', 'radiogroup');
        typeRow.setAttribute('aria-label', t('newMsg'));
        var kindWrap, titleTextWrap, textarea;
        [['problem', 'tProblem'], ['request', 'tRequest'], ['opinion', 'tOpinion'], ['other', 'tOther']].forEach(function (pair) {
            var b = el('button', 'jfask-type', t(pair[1]));
            b.type = 'button';
            b.setAttribute('role', 'radio');
            b.setAttribute('aria-checked', String(S.type === pair[0]));
            b.addEventListener('click', function () {
                S.type = pair[0];
                Array.prototype.forEach.call(typeRow.children, function (c, i) {
                    c.setAttribute('aria-checked', String(['problem', 'request', 'opinion', 'other'][i] === S.type));
                });
                kindWrap.hidden = titleTextWrap.hidden = S.type !== 'request';
                textarea.placeholder = placeholderFor(S.type);
            });
            typeRow.appendChild(b);
        });
        body.appendChild(typeRow);

        // Request kind
        var kindSel = el('select', 'jfask-select');
        [['add', 'kAdd'], ['subtitles', 'kSubs'], ['dub', 'kDub'], ['other', 'kOther']].forEach(function (p) {
            var o = el('option', null, t(p[1]));
            o.value = p[0];
            kindSel.appendChild(o);
        });
        kindSel.value = S.kind;
        kindSel.addEventListener('change', function () { S.kind = kindSel.value; });
        kindSel.setAttribute('aria-label', t('kindLabel'));
        kindWrap = field(t('kindLabel'), kindSel);
        kindWrap.hidden = S.type !== 'request';
        body.appendChild(kindWrap);

        // Attach a library title
        body.appendChild(itemPicker());

        // Typed title (requests)
        var titleInput = el('input', 'jfask-input');
        titleInput.type = 'text';
        titleInput.maxLength = 150;
        titleInput.value = S.titleText;
        titleInput.addEventListener('input', function () { S.titleText = titleInput.value; });
        titleTextWrap = field(t('titleText'), titleInput, t('titleTextHint'));
        titleTextWrap.hidden = S.type !== 'request';
        body.appendChild(titleTextWrap);

        // Message
        textarea = el('textarea', 'jfask-textarea');
        textarea.maxLength = 2000;
        textarea.value = S.message;
        textarea.placeholder = placeholderFor(S.type);
        textarea.setAttribute('aria-label', t('message'));
        var counter = el('div', 'jfask-hint', S.message.length + ' / 2000 ' + t('char'));
        textarea.addEventListener('input', function () {
            S.message = textarea.value;
            counter.textContent = S.message.length + ' / 2000 ' + t('char');
        });
        var msgWrap = field(t('message'), textarea);
        msgWrap.appendChild(counter);
        body.appendChild(msgWrap);

        // Photos
        if (cfg.allowImages) { body.appendChild(photoPicker()); }

        // Send
        var err = el('p', 'jfask-error');
        err.setAttribute('role', 'alert');
        err.hidden = true;
        var send = el('button', 'jfask-btn jfask-btn-primary', t('send'));
        send.type = 'button';
        send.addEventListener('click', function () { submit(send, err); });
        body.appendChild(err);
        var actions = el('div', 'jfask-actions');
        actions.appendChild(send);
        body.appendChild(actions);
    }

    // ---- library title search
    function itemPicker() {
        var wrap = el('div', 'jfask-field');
        wrap.appendChild(el('label', 'jfask-label', t('about')));
        var holder = el('div');
        wrap.appendChild(holder);
        var searchToken = 0;
        var timer2 = null;

        function showChosen() {
            holder.textContent = '';
            var it = S.item;
            var chip = el('div', 'jfask-chip');
            if (it.poster) {
                var img = el('img', 'jfask-poster');
                img.alt = '';
                img.src = it.poster;
                chip.appendChild(img);
            }
            var txt = el('div', 'jfask-chip-text');
            txt.appendChild(el('span', 'jfask-chip-name', it.name));
            if (it.sub) { txt.appendChild(el('span', 'jfask-chip-sub', it.sub)); }
            chip.appendChild(txt);
            var rm = el('button', 'jfask-x');
            rm.type = 'button';
            rm.setAttribute('aria-label', t('remove'));
            rm.appendChild(icon('x'));
            rm.addEventListener('click', function () { S.item = null; showSearch(); });
            chip.appendChild(rm);
            holder.appendChild(chip);
        }

        function showSearch() {
            holder.textContent = '';
            var input = el('input', 'jfask-input');
            input.type = 'search';
            input.placeholder = t('search');
            input.setAttribute('aria-label', t('about'));
            var results = el('div', 'jfask-results');
            results.setAttribute('aria-live', 'polite');
            input.addEventListener('input', function () {
                clearTimeout(timer2);
                var term = input.value.trim();
                results.textContent = '';
                if (term.length < 2) { return; }
                timer2 = setTimeout(function () { run(term, results); }, 300);
            });
            holder.appendChild(input);
            holder.appendChild(results);
        }

        function run(term, results) {
            var token = ++searchToken;
            results.textContent = '';
            results.appendChild(el('div', 'jfask-hint', t('searching')));
            Promise.resolve(api().getItems(api().getCurrentUserId(), {
                SearchTerm: term, IncludeItemTypes: 'Movie,Series,Episode,BoxSet', Recursive: true, Limit: 6
            })).then(function (res) {
                if (token !== searchToken) { return; }
                results.textContent = '';
                var items = (res && res.Items) || [];
                if (!items.length) { results.appendChild(el('div', 'jfask-hint', t('noResults'))); return; }
                items.forEach(function (it) {
                    var info = describe(it);
                    var b = el('button', 'jfask-result');
                    b.type = 'button';
                    if (info.poster) {
                        var img = el('img', 'jfask-poster');
                        img.alt = '';
                        img.loading = 'lazy';
                        img.src = info.poster;
                        b.appendChild(img);
                    }
                    var txt = el('div', 'jfask-chip-text');
                    txt.appendChild(el('span', 'jfask-chip-name', info.name));
                    if (info.sub) { txt.appendChild(el('span', 'jfask-chip-sub', info.sub)); }
                    b.appendChild(txt);
                    b.addEventListener('click', function () { S.item = info; showChosen(); });
                    results.appendChild(b);
                });
            }, function () {
                if (token !== searchToken) { return; }
                results.textContent = '';
                results.appendChild(el('div', 'jfask-hint', t('noResults')));
            });
        }

        if (S.item) { showChosen(); } else { showSearch(); }
        return wrap;
    }

    function describe(it) {
        var name = it.Name || '';
        var sub = [];
        if (it.Type === 'Episode' && it.SeriesName) { name = it.SeriesName + ' – ' + name; }
        if (it.ProductionYear) { sub.push(String(it.ProductionYear)); }
        sub.push(it.Type);
        var poster = '';
        var tag = it.ImageTags && it.ImageTags.Primary;
        if (tag) { poster = api().getImageUrl(it.Id, { type: 'Primary', maxHeight: 120, tag: tag }); }
        return { id: it.Id, name: name, type: it.Type, sub: sub.join(' · '), poster: poster };
    }

    // ---- photos
    function photoPicker() {
        var wrap = el('div', 'jfask-field');
        wrap.appendChild(el('label', 'jfask-label', t('photos')));
        var row = el('div', 'jfask-photos');
        var file = el('input');
        file.type = 'file';
        file.accept = 'image/*';
        file.multiple = true;
        file.className = 'jfask-sr';
        file.tabIndex = -1;
        file.setAttribute('aria-hidden', 'true');
        var add = el('button', 'jfask-btn', t('addPhotos'));
        add.type = 'button';
        var hint = el('div', 'jfask-hint', t('photosHint'));
        var err = el('div', 'jfask-error');
        err.hidden = true;

        function draw() {
            row.textContent = '';
            S.images.forEach(function (im, i) {
                var th = el('div', 'jfask-thumb');
                var img = el('img');
                img.alt = '';
                img.src = im.url;
                var rm = el('button');
                rm.type = 'button';
                rm.setAttribute('aria-label', t('remove'));
                rm.appendChild(icon('x'));
                rm.addEventListener('click', function () {
                    URL.revokeObjectURL(im.url);
                    S.images.splice(i, 1);
                    draw();
                });
                th.appendChild(img);
                th.appendChild(rm);
                row.appendChild(th);
            });
            if (S.images.length < 3) { row.appendChild(add); }
        }

        add.addEventListener('click', function () { file.click(); });
        file.addEventListener('change', function () {
            err.hidden = true;
            var files = Array.prototype.slice.call(file.files || [], 0, 3 - S.images.length);
            file.value = '';
            files.reduce(function (chain, f) {
                return chain.then(function () {
                    return processImage(f).then(function (im) {
                        if (S.images.length < 3) { S.images.push(im); } else { URL.revokeObjectURL(im.url); }
                        draw();
                    }, function () { err.textContent = t('errImage'); err.hidden = false; });
                });
            }, Promise.resolve());
        });

        wrap.appendChild(file);
        wrap.appendChild(row);
        wrap.appendChild(hint);
        wrap.appendChild(err);
        draw();
        return wrap;
    }

    // Every photo is shrunk and re-saved as JPEG in the browser before it is sent.
    function processImage(file) {
        return new Promise(function (resolve, reject) {
            var url = URL.createObjectURL(file);
            var img = new Image();
            img.onload = function () {
                try {
                    var w = img.naturalWidth;
                    var h = img.naturalHeight;
                    if (!w || !h) { throw new Error('size'); }
                    var scale = Math.min(1, 1600 / Math.max(w, h));
                    var c = document.createElement('canvas');
                    c.width = Math.round(w * scale);
                    c.height = Math.round(h * scale);
                    var ctx = c.getContext('2d');
                    ctx.fillStyle = '#fff';
                    ctx.fillRect(0, 0, c.width, c.height);
                    ctx.drawImage(img, 0, 0, c.width, c.height);
                    URL.revokeObjectURL(url);
                    encode(c, [0.82, 0.65, 0.5]).then(resolve, reject);
                } catch (e) {
                    URL.revokeObjectURL(url);
                    reject(e);
                }
            };
            img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
            img.src = url;
        });
    }

    function encode(canvas, qualities) {
        return new Promise(function (resolve, reject) {
            canvas.toBlob(function (blob) {
                if (!blob) { reject(new Error('encode')); return; }
                if (blob.size > 2400000 && qualities.length > 1) { encode(canvas, qualities.slice(1)).then(resolve, reject); return; }
                if (blob.size > 3000000) { reject(new Error('big')); return; }
                var fr = new FileReader();
                fr.onload = function () {
                    var s = String(fr.result);
                    resolve({ b64: s.slice(s.indexOf(',') + 1), url: URL.createObjectURL(blob) });
                };
                fr.onerror = reject;
                fr.readAsDataURL(blob);
            }, 'image/jpeg', qualities[0]);
        });
    }

    // ---- send
    function submit(button, errEl) {
        if (S.busy) { return; }
        var message = S.message.trim();
        errEl.hidden = true;
        if (message.length < 3) {
            errEl.textContent = t('errMessage');
            errEl.hidden = false;
            return;
        }
        S.busy = true;
        button.disabled = true;
        button.textContent = t('sending');
        var isRequest = S.type === 'request';
        postJson('Asks', {
            Type: S.type,
            Kind: isRequest ? S.kind : '',
            TitleText: isRequest ? S.titleText.trim() : '',
            ItemId: S.item ? S.item.id : '',
            ItemName: S.item ? S.item.name : '',
            ItemType: S.item ? S.item.type : '',
            Message: message,
            Images: S.images.map(function (im) { return im.b64; })
        }).then(function () {
            S.busy = false;
            S.images.forEach(function (im) { URL.revokeObjectURL(im.url); });
            S.message = ''; S.titleText = ''; S.item = null; S.images = []; S.mine = null;
            if (panel) { panel.setView('sent'); }
        }, function (e) {
            S.busy = false;
            button.disabled = false;
            button.textContent = t('send');
            errEl.textContent = statusOf(e) === 429 ? t('errRate') : t('errGeneric');
            errEl.hidden = false;
        });
    }

    function renderSent(body, setView) {
        var box = el('div', 'jfask-sent');
        box.appendChild(icon('check'));
        box.appendChild(el('h3', null, t('sentTitle')));
        box.appendChild(el('p', 'jfask-note', t('sentBody')));
        var actions = el('div', 'jfask-actions');
        var again = el('button', 'jfask-btn', t('another'));
        again.type = 'button';
        again.addEventListener('click', function () { setView('new'); });
        var done = el('button', 'jfask-btn jfask-btn-primary', t('close'));
        done.type = 'button';
        done.addEventListener('click', closePanel);
        actions.appendChild(again);
        actions.appendChild(done);
        box.appendChild(actions);
        body.appendChild(box);
        done.focus();
    }

    // ---------------------------------------------------------------- my messages
    function renderMine(body) {
        var loading = el('p', 'jfask-note', t('loading'));
        body.appendChild(loading);
        getJson('Asks/Mine').then(function (list) {
            if (S.view !== 'mine') { return; }
            body.textContent = '';
            list = list || [];
            if (!list.length) { body.appendChild(el('p', 'jfask-note', t('empty'))); return; }
            list.forEach(function (m) {
                var item = el('div', 'jfask-item');
                var top = el('div', 'jfask-item-top');
                var typeName = { problem: 'tProblem', request: 'tRequest', opinion: 'tOpinion', other: 'tOther' }[m.Type] || 'tOther';
                top.appendChild(el('span', 'jfask-pill', t(typeName)));
                var subject = m.ItemName || m.TitleText || '';
                top.appendChild(el('span', 'jfask-item-subject', subject));
                top.appendChild(el('span', 'jfask-pill' + (m.Status === 'done' ? ' jfask-pill-done' : ''), m.Status === 'done' ? t('statusDone') : t('statusNew')));
                item.appendChild(top);
                item.appendChild(el('div', 'jfask-hint', formatDate(m.CreatedUtc)));
                item.appendChild(el('p', 'jfask-item-msg', m.Message));
                if (m.Reply) {
                    var r = el('div', 'jfask-reply');
                    r.appendChild(el('b', null, t('reply')));
                    r.appendChild(document.createTextNode(m.Reply));
                    item.appendChild(r);
                }
                body.appendChild(item);
            });
        }, function () {
            if (S.view !== 'mine') { return; }
            body.textContent = '';
            body.appendChild(el('p', 'jfask-error', t('errGeneric')));
        });
    }

    // ---------------------------------------------------------------- lifecycle
    function init(settings) {
        cfg = {
            enabled: !!settings.enabled,
            showButton: settings.showButton !== false,
            buttonPosition: settings.buttonPosition,
            buttonText: settings.buttonText || 'Asks',
            intro: settings.intro || '',
            allowImages: settings.allowImages !== false,
            newCount: settings.newCount || 0
        };
        ensureFab();
        updateFab();
        if (!timer) {
            timer = setInterval(updateFab, 1000);
            window.addEventListener('hashchange', updateFab);
        }
    }

    // Called when the user signs out: remove everything.
    function reset() {
        closePanel();
        cfg = null;
        if (fab && fab.parentNode) { fab.parentNode.removeChild(fab); }
        fab = null;
    }

    window.JellyfinAsks = {
        ready: true,
        version: 1,
        init: init,
        reset: reset,
        // Works as a KefinTweaks custom menu link action (it is called with no `this`).
        open: function () { open(); },
        close: closePanel
    };
})();
