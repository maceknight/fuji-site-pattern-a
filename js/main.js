/* ============================================================
   FUJI co.,LTD. — 公開ページ用スクリプト
   ------------------------------------------------------------
   外部ライブラリは使わない。各機能は対象の要素が無いページでは
   何もしないようにしてある。
   ============================================================ */
(function () {
    'use strict';

    var ready = function (fn) {
        if (document.readyState !== 'loading') {
            fn();
        } else {
            document.addEventListener('DOMContentLoaded', fn);
        }
    };

    /* --------------------------------------------------------
       ヘッダー（スマートフォンのメニュー）
    -------------------------------------------------------- */
    function initNav() {
        var toggle = document.getElementById('navToggle');
        var drawer = document.getElementById('navDrawer');
        if (!toggle || !drawer) return;

        toggle.addEventListener('click', function () {
            var open = drawer.hasAttribute('hidden');
            if (open) {
                drawer.removeAttribute('hidden');
            } else {
                drawer.setAttribute('hidden', '');
            }
            toggle.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
    }

    /* --------------------------------------------------------
       商品一覧：カテゴリ行の開閉と横スクロール

       ・閉じている時 … 横スクロールのプレビュー行（.cat-scroll-area）
       ・開いている時 … 小分類ごとのグリッド（.cat-grid-wrap）
       見切れている行にカーソルを乗せて 2 秒経つと自動で右へ流れ、
       カーソルが外れると先頭へ戻る（仕様書 第1部2-2）。
       ドラッグでの手動スクロールにも対応し、ドラッグと判定した場合は
       開閉トグルも商品リンクへの遷移も発生させない。
    -------------------------------------------------------- */
    var AUTO_SCROLL_DELAY = 2000;   // カーソルを乗せてから自動スクロール開始まで(ms)
    var AUTO_SCROLL_SPEED = 0.7;    // 1フレームあたりの移動量(px)

    function initCategoryBlocks() {
        document.querySelectorAll('.cat-block').forEach(function (block) {
            var titleRow   = block.querySelector(':scope > .cat-title-row');
            var scrollArea = block.querySelector(':scope > .cat-scroll-area');
            var inner      = scrollArea ? scrollArea.querySelector(':scope > .cat-scroll-inner') : null;

            function toggle() {
                var expanded = block.classList.toggle('expanded');
                if (titleRow) titleRow.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                if (expanded) fitNamesWithin(block);
            }

            if (titleRow) {
                titleRow.addEventListener('click', toggle);
                titleRow.addEventListener('keydown', function (e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggle();
                    }
                });
            }
            if (!scrollArea || !inner) return;

            var hoverTimer = null, rafId = null;
            var isHovering = false, isDragging = false, dragMoved = false;
            var dragStartX = 0, dragStartLeft = 0;

            function stopAuto() {
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            }
            function startAuto() {
                stopAuto();
                (function step() {
                    var max = inner.scrollWidth - inner.clientWidth;
                    if (max <= 0) { rafId = null; return; }
                    inner.scrollLeft = Math.min(inner.scrollLeft + AUTO_SCROLL_SPEED, max);
                    rafId = inner.scrollLeft < max ? requestAnimationFrame(step) : null;
                })();
            }
            function armTimer() {
                window.clearTimeout(hoverTimer);
                hoverTimer = window.setTimeout(startAuto, AUTO_SCROLL_DELAY);
            }
            function resetScroll() {
                stopAuto();
                if (inner.scrollLeft !== 0) inner.scrollTo({ left: 0, behavior: 'smooth' });
            }

            scrollArea.addEventListener('mouseenter', function () {
                isHovering = true;
                if (!isDragging) armTimer();
            });
            scrollArea.addEventListener('mouseleave', function () {
                isHovering = false;
                window.clearTimeout(hoverTimer);
                if (!isDragging) resetScroll();
            });

            inner.addEventListener('mousedown', function (e) {
                isDragging = true; dragMoved = false;
                dragStartX = e.pageX; dragStartLeft = inner.scrollLeft;
                window.clearTimeout(hoverTimer);
                stopAuto();
                inner.classList.add('is-dragging');
            });
            inner.addEventListener('dragstart', function (e) { e.preventDefault(); });

            window.addEventListener('mousemove', function (e) {
                if (!isDragging) return;
                var dx = e.pageX - dragStartX;
                if (Math.abs(dx) > 4) dragMoved = true;
                inner.scrollLeft = dragStartLeft - dx;
            });
            window.addEventListener('mouseup', function () {
                if (!isDragging) return;
                isDragging = false;
                inner.classList.remove('is-dragging');
                if (isHovering) { armTimer(); } else { resetScroll(); }
            });

            // TOPページから #cat-xxx 付きで来たときは、その行だけ開いておく
            if (window.location.hash && window.location.hash.slice(1) === block.id) {
                block.classList.add('expanded');
                if (titleRow) titleRow.setAttribute('aria-expanded', 'true');
            }

            // 余白のクリックで開閉。商品リンク自体は素通りさせる。
            scrollArea.addEventListener('click', function (e) {
                if (dragMoved) {
                    e.preventDefault();
                    e.stopPropagation();
                    dragMoved = false;
                    return;
                }
                if (e.target.closest('.scroll-item')) return;
                toggle();
            });
        });
    }

    /* --------------------------------------------------------
       商品名の自動長体（横方向の圧縮表示）

       商品名タグ（.product-name-sm／.scroll-label）が見切れる場合だけ、
       内側の span に scaleX をかけて縮める。100%→90%→…→60% の
       10%刻みで収まる最大の段階を採用し、60%でも収まらないものは
       末尾を「…」に置き換える（仕様書 第1部2-3 の改善要望）。
       ※ scaleX をかける要素と幅を固定して切り取る要素は必ず分ける。
         同じ要素に両方かけると、縮小前の幅で先に切られてしまう。
    -------------------------------------------------------- */
    var NAME_FIT_STEPS = [0.9, 0.8, 0.7, 0.6];

    function fitName(el) {
        var inner = el.querySelector(':scope > .name-fit-inner');
        if (!inner) {
            inner = document.createElement('span');
            inner.className = 'name-fit-inner';
            while (el.firstChild) inner.appendChild(el.firstChild);
            el.appendChild(inner);
        }
        if (!inner.dataset.full) {
            inner.dataset.full = inner.textContent;
        }
        inner.textContent = inner.dataset.full;
        inner.style.transform = 'none';
        inner.style.marginLeft = '0px';

        var boxWidth = el.clientWidth;
        if (!boxWidth) return;

        var contentWidth = inner.scrollWidth;
        var scale = 1;

        if (contentWidth > boxWidth) {
            var ratio = boxWidth / contentWidth;
            scale = NAME_FIT_STEPS[NAME_FIT_STEPS.length - 1];
            for (var i = 0; i < NAME_FIT_STEPS.length; i++) {
                if (NAME_FIT_STEPS[i] <= ratio) { scale = NAME_FIT_STEPS[i]; break; }
            }
            inner.style.transformOrigin = 'left center';
            inner.style.transform = 'scaleX(' + scale + ')';

            // 下限の60%でも収まらない場合は末尾を省略する
            if (contentWidth * scale > boxWidth) {
                var text = inner.dataset.full;
                while (text.length > 1 && inner.scrollWidth * scale > boxWidth) {
                    text = text.slice(0, -1);
                    inner.textContent = text + '…';
                }
                el.title = inner.dataset.full;
            }
            contentWidth = inner.scrollWidth;
        }

        // 中央寄せは text-align に頼らず計算する（scaleX と併用すると左へずれるため）
        var visibleWidth = contentWidth * scale;
        inner.style.marginLeft = Math.max(0, Math.round((boxWidth - visibleWidth) / 2)) + 'px';
    }

    function fitNamesWithin(container) {
        container.querySelectorAll('.product-name-sm, .scroll-label').forEach(fitName);
    }

    function initNameFit() {
        if (!document.querySelector('.product-name-sm, .scroll-label')) return;

        if ('ResizeObserver' in window) {
            var observer = new ResizeObserver(function (entries) {
                entries.forEach(function (entry) { fitNamesWithin(entry.target); });
            });
            document.querySelectorAll('.product-card, .scroll-item').forEach(function (card) {
                observer.observe(card);
            });
        } else {
            var timer = null;
            window.addEventListener('resize', function () {
                window.clearTimeout(timer);
                timer = window.setTimeout(function () { fitNamesWithin(document); }, 150);
            });
        }

        window.addEventListener('load', function () { fitNamesWithin(document); });
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { fitNamesWithin(document); });
        }
    }

    /* --------------------------------------------------------
       お知らせモーダル
       data-body が空の項目は、リンクがあればそちらへ遷移する。
    -------------------------------------------------------- */
    function initNewsModal() {
        var bg = document.getElementById('newsModalBg');
        if (!bg) return;

        var elDate  = document.getElementById('newsModalDate');
        var elTag   = document.getElementById('newsModalTag');
        var elTitle = document.getElementById('newsModalTitle');
        var elBody  = document.getElementById('newsModalBody');
        var elLink  = document.getElementById('newsModalLink');
        var elClose = document.getElementById('newsModalClose');

        function close() { bg.classList.remove('open'); }

        function open(item) {
            var body = item.dataset.body || '';
            var link = item.dataset.link || '';
            if (!body) {
                if (link) window.open(link, '_blank', 'noopener');
                return;
            }
            elDate.textContent  = item.dataset.date || '';
            elTag.textContent   = item.dataset.tag || '';
            elTitle.textContent = item.dataset.title || '';
            elBody.textContent  = body;
            if (link) {
                elLink.href = link;
                elLink.removeAttribute('hidden');
            } else {
                elLink.setAttribute('hidden', '');
            }
            bg.classList.add('open');
        }

        document.querySelectorAll('.hero-news-item, .about-news-item').forEach(function (item) {
            item.addEventListener('click', function () { open(item); });
            item.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') open(item);
            });
        });

        elClose.addEventListener('click', close);
        bg.addEventListener('click', function (e) { if (e.target === bg) close(); });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* --------------------------------------------------------
       商品詳細：メイン画像の切替とサブ画像の送り
       サブ画像が6枚以上あるときだけ ◀▶ を出し、10秒放置でも送る。
    -------------------------------------------------------- */
    var THUMB_STEP = 5;
    var IDLE_MS = 10000;

    function initGallery() {
        var main = document.getElementById('pdMainImg');
        if (!main) return;

        var mainImg = main.querySelector('img');
        var thumbs = Array.prototype.slice.call(document.querySelectorAll('.pd-gallery-thumb'));

        thumbs.forEach(function (thumb, index) {
            thumb.addEventListener('click', function () {
                thumbs.forEach(function (t) { t.classList.remove('active'); });
                thumb.classList.add('active');
                if (mainImg && thumb.dataset.full) {
                    mainImg.src = thumb.dataset.full;
                    mainImg.alt = thumb.dataset.alt || mainImg.alt;
                }
                // 2枚目以降は撮影が異なり寸法線の座標が合わないため、マーカーは隠す
                window.pdMainImgIsTop = index === 0;
                updateSizeMarkers();
            });
        });

        initScroller(document.querySelector('.pd-gallery-thumbs-wrap'), '.pd-gallery-thumbs', THUMB_STEP, 80);
    }

    /**
     * 横スクロール領域に ◀▶ と放置送りを付ける共通処理。
     * @param {Element} wrap    ボタンを含む外枠
     * @param {string}  sel     スクロールする要素のセレクタ
     * @param {number}  step    1回で送る件数
     * @param {number}  itemW   1件あたりの幅(px)
     */
    function initScroller(wrap, sel, step, itemW) {
        if (!wrap) return;
        var scroller = wrap.querySelector(sel);
        var prev = wrap.querySelector('.pd-scroll-btn--prev');
        var next = wrap.querySelector('.pd-scroll-btn--next');
        if (!scroller) return;

        function amount() { return itemW * step; }
        function max() { return scroller.scrollWidth - scroller.clientWidth; }

        if (prev) prev.addEventListener('click', function () {
            scroller.scrollBy({ left: -amount(), behavior: 'smooth' });
            restartIdle();
        });
        if (next) next.addEventListener('click', function () {
            scroller.scrollBy({ left: amount(), behavior: 'smooth' });
            restartIdle();
        });

        var idleTimer = null;
        function tick() {
            if (max() <= 0) return;
            var left = scroller.scrollLeft + amount();
            scroller.scrollTo({ left: left > max() ? 0 : left, behavior: 'smooth' });
        }
        function restartIdle() {
            window.clearInterval(idleTimer);
            idleTimer = window.setInterval(tick, IDLE_MS);
        }
        scroller.addEventListener('mouseenter', function () { window.clearInterval(idleTimer); });
        scroller.addEventListener('mouseleave', restartIdle);
        restartIdle();
    }

    /* --------------------------------------------------------
       商品詳細：ラインナップの「詳しく見る」と寸法線
    -------------------------------------------------------- */
    window.pdMainImgIsTop = true;
    var sizeDetailExpanded = false;

    function updateSizeMarkers() {
        var main = document.getElementById('pdMainImg');
        if (!main) return;
        main.classList.toggle('pd-show-size-markers', sizeDetailExpanded && window.pdMainImgIsTop);
    }

    function initLineupToggle() {
        var btn = document.getElementById('pdSizeToggle');
        var wrap = document.getElementById('pdSizeTableWrap');
        if (!btn || !wrap) return;

        btn.addEventListener('click', function () {
            sizeDetailExpanded = wrap.classList.toggle('pd-size-table-expanded');
            btn.textContent = sizeDetailExpanded ? '閉じる' : '詳しく見る';
            btn.setAttribute('aria-expanded', sizeDetailExpanded ? 'true' : 'false');
            updateSizeMarkers();
        });
    }

    /* --------------------------------------------------------
       商品詳細：タブ（関連商品）
    -------------------------------------------------------- */
    function initTabs() {
        var bar = document.querySelector('.pd-tab-bar');
        if (!bar) return;
        bar.querySelectorAll('.pd-tab').forEach(function (tab) {
            tab.addEventListener('click', function () {
                bar.querySelectorAll('.pd-tab').forEach(function (t) { t.classList.remove('active'); });
                document.querySelectorAll('.pd-tab-panel').forEach(function (p) { p.classList.remove('active'); });
                tab.classList.add('active');
                var panel = document.getElementById(tab.dataset.panel);
                if (panel) panel.classList.add('active');
            });
        });
    }

    /* --------------------------------------------------------
       商品詳細：バリエーションの拡大表示（ページ遷移しない）
    -------------------------------------------------------- */
    var openLightbox = function () {};

    function initLightbox() {
        var box = document.getElementById('pdLightbox');
        if (!box) return;

        var img    = document.getElementById('pdLightboxImg');
        var swatch = document.getElementById('pdLightboxSwatch');
        var label  = document.getElementById('pdLightboxLabel');

        // バリエーションのアプリ版（initPicker）からも使う
        openLightbox = function (src, color, text) {
            if (src) {
                img.src = src;
                img.alt = text || '';
                img.removeAttribute('hidden');
                swatch.setAttribute('hidden', '');
            } else {
                img.setAttribute('hidden', '');
                swatch.style.background = color || 'var(--fog)';
                swatch.removeAttribute('hidden');
            }
            label.textContent = text || '';
            box.classList.add('is-open');
            box.setAttribute('aria-hidden', 'false');
        };

        document.querySelectorAll('.pd-lightbox-trigger').forEach(function (btn) {
            btn.addEventListener('click', function () {
                openLightbox(btn.dataset.img || '', btn.dataset.color, btn.dataset.label);
            });
        });

        function close() {
            box.classList.remove('is-open');
            box.setAttribute('aria-hidden', 'true');
        }
        box.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', close);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* --------------------------------------------------------
       商品詳細：バリエーションの項目の「？ 詳細」
       components/variation-help.php のボタンの data-help-* を、小窓（#pdHelp）に流し込んで開く。
       天幕カラーなど生地ページのある項目に連動している項目（data-help-links）は、
       アプリ型で連動元（天幕種類）を選んでいれば、その生地ページへそのまま飛ぶ
    -------------------------------------------------------- */
    function initVariationHelp() {
        var box = document.getElementById('pdHelp');
        if (!box) return;
        var title  = document.getElementById('pdHelpTitle');
        var text   = document.getElementById('pdHelpText');
        var images = document.getElementById('pdHelpImages');
        var linkBox = document.getElementById('pdHelpLinks');
        var opener = null;

        function parse(json) {
            try { return JSON.parse(json || '[]') || []; } catch (e) { return []; }
        }

        // アプリ型で、連動元の段で選んでいる値の生地ページ
        function selectedFabricPage(btn) {
            var picker = btn.closest('#pdPicker');
            if (!picker || !btn.dataset.helpWatch) return '';
            var step = picker.querySelector('.pva-step[data-group="' + btn.dataset.helpWatch + '"]');
            var sel = step ? step.querySelector('.pva-opt[aria-pressed="true"]') : null;
            return sel && sel.dataset.href ? sel.dataset.href : '';
        }

        function open(btn) {
            opener = btn;
            var links = parse(btn.dataset.helpLinks);
            var list = linkBox.querySelector('ul');
            list.innerHTML = '';
            links.forEach(function (link) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                a.href = link.href;
                a.textContent = link.label + ' →';
                li.appendChild(a);
                list.appendChild(li);
            });
            linkBox.hidden = !links.length;
            title.textContent = btn.dataset.helpTitle || '';
            text.textContent = btn.dataset.helpText || '';
            text.hidden = !btn.dataset.helpText;
            images.innerHTML = '';
            parse(btn.dataset.helpImages).forEach(function (item) {
                var fig = document.createElement('figure');
                var img = document.createElement('img');
                img.src = item.src;
                img.alt = item.caption || '';
                fig.appendChild(img);
                if (item.caption) {
                    var cap = document.createElement('figcaption');
                    cap.textContent = item.caption;
                    fig.appendChild(cap);
                }
                images.appendChild(fig);
            });
            box.classList.add('is-open');
            box.setAttribute('aria-hidden', 'false');
            box.querySelector('.pd-lightbox-close').focus();
        }
        function close() {
            if (!box.classList.contains('is-open')) return;
            box.classList.remove('is-open');
            box.setAttribute('aria-hidden', 'true');
            if (opener) opener.focus();
        }

        document.querySelectorAll('.pd-help-btn').forEach(function (btn) {
            btn.addEventListener('click', function (e) {
                e.stopPropagation();
                var page = selectedFabricPage(btn);
                if (page) {
                    window.location.href = page;
                    return;
                }
                open(btn);
            });
        });
        box.querySelectorAll('[data-close]').forEach(function (el) {
            el.addEventListener('click', close);
        });
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') close();
        });
    }

    /* --------------------------------------------------------
       商品詳細：バリエーションのアプリ版（A案(2)）
       components/variation-picker.php の動き。先方の商品データ入力アプリのプレビューと同じ規則にしている。
         ・見出しの切り替えで A案(1)（一覧）と行き来する。選んだ方は覚えておく
         ・タップで選ぶ（もう一度タップで外す）。写真があれば左のメイン画像を差し替える
         ・連動：段の data-react が grey なら合わない値を灰色に、filter なら隠す（合う値が無ければ段ごと隠す）。
           合うかどうかは、data-watch の段で選んだ値の data-tags と、自分の値の data-tags が1つでも一致するか
         ・ある段の選択を変えたら、その段を見張っている段の選択を外す（さらにその先も）
         ・段の番号（①②…）は見えている段だけで振り直す
         ・ダブルクリックで拡大。生地ページに当たる項目は生地ページへ
    -------------------------------------------------------- */
    var PICKER_KEY = 'fuji.variationMode';
    var CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', '⑪', '⑫'];

    function initPicker() {
        var picker = document.getElementById('pdPicker');
        var list = document.getElementById('pdVariationWrap');
        var switcher = document.querySelector('.pva-switch');
        if (!picker || !list || !switcher) return;

        var main = document.getElementById('pdMainImg');
        var mainImg = main ? main.querySelector('img') : null;
        var original = mainImg ? { src: mainImg.src, alt: mainImg.alt } : null;
        var summary = document.getElementById('pdPickerSummary');
        var summaryDefault = summary ? summary.textContent : '';
        var steps = Array.prototype.slice.call(picker.querySelectorAll('.pva-step'));
        var byId = {};
        steps.forEach(function (s) { byId[s.dataset.group] = s; });
        var shownBy = null; // いま左に出している写真の持ち主（.pva-opt）

        function tagsOf(opt) {
            try { return JSON.parse(opt.dataset.tags || '[]'); } catch (e) { return []; }
        }
        function selected(step) { return step ? step.querySelector('.pva-opt[aria-pressed="true"]') : null; }
        function opts(step) { return Array.prototype.slice.call(step.querySelectorAll('.pva-opt')); }

        function setMode(mode) {
            var app = mode === '2';
            picker.hidden = !app;
            list.hidden = app;
            switcher.querySelectorAll('button').forEach(function (b) {
                b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
            });
            if (!app) restoreMain();
            try { localStorage.setItem(PICKER_KEY, mode); } catch (e) {}
        }
        switcher.querySelectorAll('button').forEach(function (b) {
            b.addEventListener('click', function () { setMode(b.dataset.mode); });
        });
        try { if (localStorage.getItem(PICKER_KEY) === '2') setMode('2'); } catch (e) {}

        function showOnMain(opt) {
            if (!mainImg || !opt.dataset.img) return;
            mainImg.src = opt.dataset.img;
            mainImg.alt = opt.dataset.label || '';
            main.classList.add('pva-variant');
            shownBy = opt;
            // 寸法線は1枚目の写真に合わせた座標なので、差し替え中は隠す
            window.pdMainImgIsTop = false;
            updateSizeMarkers();
        }
        function restoreMain() {
            shownBy = null;
            if (!mainImg || !original || !main.classList.contains('pva-variant')) return;
            mainImg.src = original.src;
            mainImg.alt = original.alt;
            main.classList.remove('pva-variant');
            window.pdMainImgIsTop = true;
            updateSizeMarkers();
        }
        // 出していた写真の項目が外れたら、ほかに選ばれている写真つきの項目（下の段から）に戻す。無ければ元の写真
        function refreshMain() {
            if (shownBy && shownBy.getAttribute('aria-pressed') === 'true' && !shownBy.closest('.pva-step').hidden) return;
            var picks = steps.filter(function (s) { return !s.hidden; }).map(selected)
                .filter(function (o) { return o && o.dataset.img; });
            if (picks.length) showOnMain(picks[picks.length - 1]); else restoreMain();
        }

        // gid の選択が変わったとき、gid を見張っている段の選択を外す（さらにその先も）
        function clearDependents(gid) {
            var frontier = [gid];
            var guard = 0;
            while (frontier.length && guard++ < 20) {
                var next = [];
                steps.forEach(function (s) {
                    if (s.dataset.react !== 'none' && frontier.indexOf(s.dataset.watch) !== -1) {
                        var o = selected(s);
                        if (o) o.setAttribute('aria-pressed', 'false');
                        next.push(s.dataset.group);
                    }
                });
                frontier = next;
            }
        }

        // 連動の反映（アプリの variationsPreview と同じ判定）と、段番号の振り直し
        function apply() {
            var n = 0;
            steps.forEach(function (s) {
                var react = s.dataset.react;
                var own = {};
                opts(s).forEach(function (o) { tagsOf(o).forEach(function (t) { own[t] = true; }); });
                var matching = [];
                var watched = byId[s.dataset.watch];
                if (react !== 'none' && watched && !watched.hidden) {
                    var w = selected(watched);
                    if (w) matching = tagsOf(w).filter(function (t) { return own[t]; });
                }
                var hasVocab = Object.keys(own).length > 0;
                var hideStep = react === 'filter' && hasVocab && matching.length === 0;
                opts(s).forEach(function (o) {
                    var fits = tagsOf(o).some(function (t) { return matching.indexOf(t) !== -1; });
                    var hide = react === 'filter' && matching.length > 0 && !fits;
                    var grey = react === 'grey' && matching.length > 0 && !fits;
                    o.hidden = hide;
                    o.disabled = grey;
                    o.title = grey ? 'この組み合わせでは選べません' : '';
                    if ((hide || grey) && o.getAttribute('aria-pressed') === 'true') o.setAttribute('aria-pressed', 'false');
                });
                if (!hideStep && opts(s).every(function (o) { return o.hidden; })) hideStep = true;
                s.hidden = hideStep;
                var num = s.querySelector('.pva-num');
                if (!hideStep && num) num.textContent = CIRCLED[n] || (n + 1) + '.';
                if (!hideStep) n++;
            });
            refreshMain();
            if (summary) {
                var picks = steps.filter(function (s) { return !s.hidden; }).map(selected)
                    .filter(Boolean).map(function (o) { return o.dataset.label; });
                summary.textContent = picks.length ? '選択中：' + picks.join(' ／ ') : summaryDefault;
            }
        }

        picker.querySelectorAll('.pva-opt').forEach(function (opt) {
            opt.setAttribute('aria-pressed', 'false');
            opt.addEventListener('click', function () {
                if (opt.disabled) return;
                var step = opt.closest('.pva-step');
                var was = opt.getAttribute('aria-pressed') === 'true';
                opts(step).forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
                if (!was) opt.setAttribute('aria-pressed', 'true');
                clearDependents(step.dataset.group);
                if (!was && opt.dataset.img) showOnMain(opt);
                apply();
            });
            opt.addEventListener('dblclick', function () {
                if (opt.disabled) return;
                if (opt.dataset.href) { window.location.href = opt.dataset.href; return; }
                if (opt.dataset.img || opt.dataset.color) {
                    openLightbox(opt.dataset.img, opt.dataset.color, opt.dataset.label);
                }
            });
        });

        var reset = document.getElementById('pdPickerReset');
        if (reset) reset.addEventListener('click', function () {
            picker.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
            restoreMain();
            apply();
        });
        apply();
    }

    /* --------------------------------------------------------
       製品一覧：カテゴリを選び直したら、寸法の項目をそのカテゴリのものに入れ替える
       （項目の定義は config/queries.php の sizeSearchFields()。form の data-fields に入っている）
    -------------------------------------------------------- */
    function initProductSearch() {
        var form = document.getElementById('productSearch');
        var select = document.getElementById('searchCat');
        var box = document.getElementById('searchRanges');
        if (!form || !select || !box) return;
        var map = {};
        try { map = JSON.parse(form.dataset.fields || '{}'); } catch (e) { return; }

        select.addEventListener('change', function () {
            var fields = map[select.value] || map[''] || {};
            // 入力済みの値は、同じ項目なら引き継ぐ
            var kept = {};
            box.querySelectorAll('input').forEach(function (i) { kept[i.name] = i.value; });
            box.innerHTML = '';
            Object.keys(fields).forEach(function (key) {
                var wrap = document.createElement('div');
                wrap.className = 'search-filter';
                var label = document.createElement('span');
                label.textContent = fields[key];
                var range = document.createElement('div');
                range.className = 'search-range';
                ['min', 'max'].forEach(function (side, i) {
                    var input = document.createElement('input');
                    input.type = 'number';
                    input.name = side + '_' + key;
                    input.placeholder = side === 'min' ? '下限' : '上限';
                    input.min = '0';
                    input.step = 'any';
                    input.value = kept[input.name] || '';
                    range.appendChild(input);
                    if (i === 0) {
                        var sep = document.createElement('span');
                        sep.textContent = '〜';
                        range.appendChild(sep);
                    }
                });
                wrap.appendChild(label);
                wrap.appendChild(range);
                box.appendChild(wrap);
            });
        });
    }

    /* --------------------------------------------------------
       関連商品の横送り（4件以上のとき）
    -------------------------------------------------------- */
    function initRelated() {
        initScroller(document.querySelector('.pd-related-wrap'), '.pd-related-scroll', 3, 176);
    }

    /* --------------------------------------------------------
       会社情報：セクションのサブナビ
    -------------------------------------------------------- */
    function initAboutSubnav() {
        var items = Array.prototype.slice.call(document.querySelectorAll('.about-subnav-item'));
        if (!items.length) return;

        var sections = items.map(function (item) {
            return document.querySelector(item.getAttribute('href'));
        });

        window.addEventListener('scroll', function () {
            var pos = window.scrollY + 140;
            var current = 0;
            sections.forEach(function (section, i) {
                if (section && section.offsetTop <= pos) current = i;
            });
            items.forEach(function (item, i) {
                item.classList.toggle('active', i === current);
            });
        }, { passive: true });
    }

    ready(function () {
        initNav();
        initCategoryBlocks();
        initNameFit();
        initNewsModal();
        initGallery();
        initLineupToggle();
        initTabs();
        initLightbox();
        initVariationHelp();
        initPicker();
        initProductSearch();
        initRelated();
        initAboutSubnav();
    });
})();
