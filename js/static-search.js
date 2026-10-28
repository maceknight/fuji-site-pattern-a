/*
 * 公開プレビュー（GitHub Pages）用の製品検索。tools/build_static.php が js/ に置き、products.html だけで読む。
 *
 * 静的なファイルなので PHP の検索（config/queries.php の searchProducts）は動かない。
 * 代わりに書き出しのときに作った search-index.json（全商品の文字・寸法・商品カードの HTML）を読み、
 * ブラウザの中で同じ条件で絞り込む：
 *   キーワード … 商品名・品番・種別・説明・ブランド名・ライン名・型番・品番に含まれる（大文字小文字は区別しない）
 *   カテゴリ   … 大分類
 *   寸法       … 寸法の1行（型番・品番ごと）が、指定した範囲をすべて満たす。値の無い項目は当たらない
 * 結果の出し方は products.php の #search-results と同じ。条件は URL（?q=…&cat=…）にも残す。
 */
(function () {
    'use strict';

    var form = document.getElementById('productSearch');
    if (!form) return;

    var index = null;
    var loading = fetch('search-index.json').then(function (r) { return r.json(); }).then(function (data) {
        index = data;
        return data;
    });

    function fieldsFor(cat) {
        var map = {};
        try { map = JSON.parse(form.dataset.fields || '{}'); } catch (e) { map = {}; }
        return map[cat] || map[''] || {};
    }

    function readForm() {
        var fd = new FormData(form);
        var cat = (fd.get('cat') || '').toString();
        var fields = fieldsFor(cat);
        var ranges = {};
        Object.keys(fields).forEach(function (key) {
            var min = (fd.get('min_' + key) || '').toString().trim();
            var max = (fd.get('max_' + key) || '').toString().trim();
            min = min !== '' && !isNaN(min) ? parseFloat(min) : null;
            max = max !== '' && !isNaN(max) ? parseFloat(max) : null;
            if (min !== null || max !== null) ranges[key] = [min, max];
        });
        return { q: (fd.get('q') || '').toString().trim(), cat: cat, ranges: ranges, fields: fields };
    }

    function sizeOk(row, ranges) {
        return Object.keys(ranges).every(function (key) {
            var v = row[key];
            if (v === null || v === undefined) return false;
            var r = ranges[key];
            return (r[0] === null || v >= r[0]) && (r[1] === null || v <= r[1]);
        });
    }

    function search(c) {
        var kw = c.q.toLowerCase();
        var hasRange = Object.keys(c.ranges).length > 0;
        var hits = [];
        index.products.forEach(function (p) {
            if (c.cat && p.cat !== c.cat) return;
            var rows = p.sizes.filter(function (row) { return sizeOk(row, c.ranges); });
            if (hasRange && !rows.length) return;
            var parts = [];
            if (kw) {
                rows.forEach(function (row) {
                    if (row.part && row.part.toLowerCase().indexOf(kw) !== -1 && parts.indexOf(row.part) === -1) parts.push(row.part);
                });
                var inText = p.text.some(function (t) { return t.toLowerCase().indexOf(kw) !== -1; });
                if (!inText && !parts.length) return;
            }
            hits.push({ p: p, parts: parts });
        });
        return hits;
    }

    function labelsOf(c) {
        var out = [];
        if (c.q) out.push('「' + c.q + '」');
        if (c.cat) {
            var opt = form.querySelector('#searchCat option[value="' + c.cat + '"]');
            if (opt) out.push(opt.textContent.trim());
        }
        var rl = Object.keys(c.ranges).map(function (key) {
            var r = c.ranges[key];
            return c.fields[key] + ' ' + (r[0] !== null ? r[0] : '') + '〜' + (r[1] !== null ? r[1] : '');
        });
        if (rl.length) out.push(rl.join('・'));
        return out;
    }

    function render(c, hits) {
        var old = document.getElementById('search-results');
        if (old) old.remove();
        var active = c.q || c.cat || Object.keys(c.ranges).length;
        if (!active) return;

        var box = document.createElement('div');
        box.id = 'search-results';
        box.className = 'visible';
        var label = document.createElement('p');
        label.className = 'results-label';
        label.textContent = labelsOf(c).join(' ／ ') + ' の検索結果 ' + hits.length + '件';
        var clear = document.createElement('a');
        clear.href = 'products.html';
        clear.style.marginLeft = '16px';
        clear.style.color = 'var(--stone)';
        clear.textContent = '× 条件をクリア';
        label.appendChild(clear);
        box.appendChild(label);

        if (hits.length) {
            var grid = document.createElement('div');
            grid.className = 'cat-grid';
            hits.forEach(function (h) {
                var cell = document.createElement('div');
                cell.className = 'search-hit';
                cell.innerHTML = h.p.card;
                if (h.parts.length) {
                    var parts = document.createElement('p');
                    parts.className = 'search-hit-parts';
                    parts.textContent = '該当品番：' + h.parts.join('、');
                    cell.appendChild(parts);
                }
                grid.appendChild(cell);
            });
            box.appendChild(grid);
        } else {
            var empty = document.createElement('p');
            empty.className = 'empty-note';
            empty.textContent = '該当する製品が見つかりませんでした。品番の一部やブランド名でもお探しいただけます。';
            box.appendChild(empty);
        }

        var header = document.querySelector('.products-header');
        header.parentNode.insertBefore(box, header.nextSibling);
        if (window.fujiFitNames) window.fujiFitNames(box);
    }

    function toQuery(c) {
        var qs = new URLSearchParams();
        if (c.q) qs.set('q', c.q);
        if (c.cat) qs.set('cat', c.cat);
        Object.keys(c.ranges).forEach(function (key) {
            if (c.ranges[key][0] !== null) qs.set('min_' + key, c.ranges[key][0]);
            if (c.ranges[key][1] !== null) qs.set('max_' + key, c.ranges[key][1]);
        });
        var s = qs.toString();
        return location.pathname + (s ? '?' + s : '');
    }

    function run(scroll) {
        loading.then(function () {
            var c = readForm();
            render(c, search(c));
            history.replaceState(null, '', toQuery(c));
            var box = document.getElementById('search-results');
            if (scroll && box) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        run(true);
    });

    // URL に条件があれば（?q=…&cat=… など）、フォームに戻してから検索する
    var params = new URLSearchParams(location.search);
    if (params.toString()) {
        var q = form.querySelector('[name="q"]');
        var cat = form.querySelector('#searchCat');
        if (q) q.value = params.get('q') || '';
        if (cat && params.get('cat')) {
            cat.value = params.get('cat');
            cat.dispatchEvent(new Event('change'));
        }
        var anyRange = false;
        params.forEach(function (v, k) {
            var input = /^(min|max)_/.test(k) ? form.querySelector('[name="' + k + '"]') : null;
            if (input) { input.value = v; anyRange = true; }
        });
        var more = form.querySelector('.search-more');
        if (more && anyRange) more.open = true;
        run(false);
    }
})();
