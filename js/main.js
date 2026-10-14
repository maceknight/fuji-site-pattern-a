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
       商品詳細：バリエーションのアプリ版（A案(2)）
       components/variation-picker.php の動き。
         ・見出しの切り替えで A案(1)（一覧）と行き来する。選んだ方は覚えておく
         ・タップで選ぶ。写真があれば左のメイン画像を差し替える
         ・生地を選ぶと、その生地の色の段を出す
         ・丸型の型番でしか選べない項目は、角型の型番を選ぶと灰色にする
         ・ダブルクリックで拡大。生地は生地ページへ
    -------------------------------------------------------- */
    var PICKER_KEY = 'fuji.variationMode';

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

        function showOnMain(src, alt) {
            if (!mainImg || !src) return;
            mainImg.src = src;
            mainImg.alt = alt || '';
            main.classList.add('pva-variant');
            // 寸法線は1枚目の写真に合わせた座標なので、差し替え中は隠す
            window.pdMainImgIsTop = false;
            updateSizeMarkers();
        }
        function restoreMain() {
            if (!mainImg || !original || !main.classList.contains('pva-variant')) return;
            mainImg.src = original.src;
            mainImg.alt = original.alt;
            main.classList.remove('pva-variant');
            window.pdMainImgIsTop = true;
            updateSizeMarkers();
        }

        function selected(step) { return step.querySelector('.pva-opt[aria-pressed="true"]'); }

        function updateSummary() {
            if (!summary) return;
            var picks = [];
            steps.forEach(function (step) {
                if (step.hidden) return;
                var opt = selected(step);
                if (opt) picks.push(opt.dataset.label);
            });
            summary.textContent = picks.length ? '選択中：' + picks.join(' ／ ') : summaryDefault;
        }

        // 型番の形に合わない項目を灰色にする（選んでいたら外す）
        function applyShape() {
            var lineup = picker.querySelector('.pva-opt[data-kind="lineup"][aria-pressed="true"]');
            var shape = lineup ? lineup.dataset.shape : '';
            picker.querySelectorAll('.pva-opt[data-requires]').forEach(function (opt) {
                var ok = !shape || opt.dataset.requires === shape;
                opt.disabled = !ok;
                opt.title = ok ? '' : 'この型番では選べません';
                if (!ok) opt.setAttribute('aria-pressed', 'false');
            });
        }

        function showFabric(fabricId) {
            picker.querySelectorAll('.pva-step--colors').forEach(function (step) {
                var show = step.dataset.forFabric === fabricId;
                if (!show) {
                    step.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
                }
                step.hidden = !show;
            });
        }

        picker.querySelectorAll('.pva-opt').forEach(function (opt) {
            opt.setAttribute('aria-pressed', 'false');
            opt.addEventListener('click', function () {
                if (opt.disabled) return;
                var step = opt.closest('.pva-step');
                step.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
                opt.setAttribute('aria-pressed', 'true');

                if (opt.dataset.kind === 'lineup') applyShape();
                if (opt.dataset.kind === 'fabric') showFabric(opt.dataset.fabric || '');
                if (opt.dataset.img) showOnMain(opt.dataset.img, opt.dataset.label);
                updateSummary();
            });
            opt.addEventListener('dblclick', function () {
                if (opt.disabled) return;
                if (opt.dataset.kind === 'fabric') {
                    if (opt.dataset.href) window.location.href = opt.dataset.href;
                    return;
                }
                if (opt.dataset.img || opt.dataset.color) {
                    openLightbox(opt.dataset.img, opt.dataset.color, opt.dataset.label);
                }
            });
        });

        var reset = document.getElementById('pdPickerReset');
        if (reset) reset.addEventListener('click', function () {
            picker.querySelectorAll('.pva-opt').forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
            showFabric(null);
            applyShape();
            restoreMain();
            updateSummary();
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
        initPicker();
        initRelated();
        initAboutSubnav();
    });
})();
