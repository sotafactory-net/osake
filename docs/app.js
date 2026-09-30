// Osake Web 閲覧ページ。分割構造（list.json + <id>/info.json + <id>/画像）を読み込む。
// GitHub Pages 上で JavaScript だけで動く（サーバサイド不要）。

(function () {
  "use strict";

  // ---- 定数（Android の CategoryMaster / Loc と対応）----
  var CATEGORY_LABELS = {
    All: "すべて",
    Sake: "日本酒",
    Wine: "ワイン",
    Whisky: "ウイスキー",
    Sour: "サワー",
    Other: "その他"
  };
  var CATEGORY_ORDER = ["All", "Sake", "Wine", "Whisky", "Sour", "Other"];

  var SORT_OPTIONS = [
    { key: "rating", asc: false, label: "評価（降順）" },
    { key: "rating", asc: true,  label: "評価（昇順）" },
    { key: "brand",  asc: false, label: "銘柄（降順）" },
    { key: "brand",  asc: true,  label: "銘柄（昇順）" },
    { key: "date",   asc: false, label: "年月日（降順）" },
    { key: "date",   asc: true,  label: "年月日（昇順）" }
  ];

  var RATING_OPTIONS = [
    { min: 0, label: "すべて" },
    { min: 1, label: "★1以上" },
    { min: 2, label: "★2以上" },
    { min: 3, label: "★3以上" },
    { min: 4, label: "★4以上" }
  ];

  var PAGE_SIZE = 10;
  var EC_TITLES = { Amazon: "Amazon", Rakuten: "Rakuten", Yahoo: "Yahoo Shopping" };

  // ---- 状態 ----
  var allItems = [];    // list.json の items（deleted除外）
  var viewItems = [];   // フィルタ・ソート適用後
  var infoCache = {};   // id -> info.json（取得済みキャッシュ）
  var state = {
    category: "All",
    ratingMin: 0,
    sortIndex: 4, // 既定: 年月日（降順）
    page: 0
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    buildDropdowns();
    bindAccordions();
    bindDialog();
    loadData();
  }

  function loadData() {
    setStatus("読み込み中...");
    fetch("list.json?_=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (lf) {
        var items = (lf && lf.items) ? lf.items : [];
        allItems = items.filter(function (r) { return r && !r.deleted; });
        setStatus("");
        render();
      })
      .catch(function (e) {
        setStatus("データの読み込みに失敗しました: " + e.message);
      });
  }

  // ---- ドロップダウン生成 ----
  function buildDropdowns() {
    var cat = document.getElementById("filter-category");
    CATEGORY_ORDER.forEach(function (key) { cat.appendChild(opt(key, CATEGORY_LABELS[key])); });
    cat.value = state.category;
    cat.addEventListener("change", function () { state.category = cat.value; state.page = 0; render(); });

    var rating = document.getElementById("filter-rating");
    RATING_OPTIONS.forEach(function (o, i) { rating.appendChild(opt(String(i), o.label)); });
    rating.value = "0";
    rating.addEventListener("change", function () { state.ratingMin = RATING_OPTIONS[parseInt(rating.value, 10)].min; state.page = 0; render(); });

    var sort = document.getElementById("filter-sort");
    SORT_OPTIONS.forEach(function (o, i) { sort.appendChild(opt(String(i), o.label)); });
    sort.value = String(state.sortIndex);
    sort.addEventListener("change", function () { state.sortIndex = parseInt(sort.value, 10); state.page = 0; render(); });

    document.getElementById("filter-page").addEventListener("change", function (e) {
      state.page = parseInt(e.target.value, 10) || 0; render();
    });
  }

  function rebuildPageDropdown(total) {
    var page = document.getElementById("filter-page");
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page >= pages) state.page = 0;
    page.innerHTML = "";
    for (var i = 0; i < pages; i++) {
      var from = i * PAGE_SIZE + 1;
      var to = Math.min((i + 1) * PAGE_SIZE, total);
      page.appendChild(opt(String(i), "表示件数: " + from + "〜" + to));
    }
    page.value = String(state.page);
  }

  function opt(value, label) {
    var o = document.createElement("option");
    o.value = value; o.textContent = label;
    return o;
  }

  // ---- 描画 ----
  function render() {
    viewItems = allItems.filter(function (r) {
      if (state.category !== "All" && (r.category || "Other") !== state.category) return false;
      if ((r.rating || 0) < state.ratingMin) return false;
      return true;
    });

    var s = SORT_OPTIONS[state.sortIndex];
    viewItems.sort(function (a, b) { return compareBy(a, b, s.key, s.asc); });

    rebuildPageDropdown(viewItems.length);

    var start = state.page * PAGE_SIZE;
    var pageItems = viewItems.slice(start, start + PAGE_SIZE);

    renderMap("position-plot", pageItems, positionCoord, start);
    renderMap("taste-plot", pageItems, tasteCoord, start);
    renderCards(pageItems, start);

    // カテゴリが日本酒のとき、ポジションマップを4象限画像の背景に切り替える。
    applyPositionBackground(state.category === "Sake");
  }

  // 日本酒モード: ポジションマップに4象限画像を敷き、HTMLの軸ラベルを隠す。
  function applyPositionBackground(sake) {
    var map = document.getElementById("position-map");
    if (!map) return;
    if (sake) {
      map.classList.add("sake-mode");
      map.style.backgroundImage = "url('" + positionImageUrl() + "')";
    } else {
      map.classList.remove("sake-mode");
      map.style.backgroundImage = "";
    }
  }

  // 端末言語で日本語/英語の4象限画像URLを返す。
  function positionImageUrl() {
    var ja = (navigator.language || "").toLowerCase().indexOf("ja") === 0;
    return ja ? "assets/position_sake.png" : "assets/position_sake_en.png";
  }

  function compareBy(a, b, key, asc) {
    var va, vb;
    if (key === "rating") { va = a.rating || 0; vb = b.rating || 0; return asc ? va - vb : vb - va; }
    if (key === "brand") { return cmpStr(a.brand || "", b.brand || "", asc); }
    return cmpStr(a.date || "", b.date || "", asc);
  }
  function cmpStr(a, b, asc) {
    if (a < b) return asc ? -1 : 1;
    if (a > b) return asc ? 1 : -1;
    return 0;
  }

  // ---- マップ ----
  function positionCoord(r) {
    var x = ((num(r.sweetnessDryness) + 1) / 2) * 100;
    var y = (1 - (num(r.richnessLightness) + 1) / 2) * 100;
    return { x: clampPct(x), y: clampPct(y) };
  }
  function tasteCoord(r) {
    var x = ((num(r.sweetness) + 5) / 10) * 100;
    var y = (1 - (num(r.fruity) + 5) / 10) * 100;
    return { x: clampPct(x), y: clampPct(y) };
  }

  function renderMap(plotId, items, coordFn, startIndex) {
    var plot = document.getElementById(plotId);
    plot.innerHTML = "";
    items.forEach(function (r, i) {
      var c = coordFn(r);
      var m = document.createElement("div");
      m.className = "marker";
      m.style.left = c.x + "%";
      m.style.top = c.y + "%";
      m.textContent = String(startIndex + i + 1); // ページ通算の番号
      m.addEventListener("click", function () { openDialog(r, items, i); });
      plot.appendChild(m);
    });
  }

  // ---- カード ----
  function renderCards(items, startIndex) {
    var wrap = document.getElementById("cards");
    wrap.innerHTML = "";
    if (items.length === 0) { setStatus("該当する記録がありません"); return; }
    setStatus("");

    items.forEach(function (r, i) {
      var card = document.createElement("div");
      card.className = "card";

      var idx = document.createElement("div");
      idx.className = "card-index";
      idx.textContent = String(startIndex + i + 1); // ページ通算の番号
      card.appendChild(idx);

      if (r.thumb) {
        var img = document.createElement("img");
        img.className = "card-photo";
        img.loading = "lazy";
        img.src = imgUrl(r.id, r.thumb);
        img.alt = r.brand || "";
        img.onerror = function () { swapPlaceholder(img, r); };
        card.appendChild(img);
      } else {
        card.appendChild(placeholderEl(r));
      }

      var meta = document.createElement("div");
      meta.className = "card-meta";
      var rt = document.createElement("div");
      rt.className = "card-rating";
      rt.textContent = stars(r.rating);
      var dt = document.createElement("div");
      dt.className = "card-date";
      dt.textContent = formatDate(r.date);
      meta.appendChild(rt); meta.appendChild(dt);
      card.appendChild(meta);

      card.addEventListener("click", function () { openDialog(r, items, i); });
      wrap.appendChild(card);
    });
  }

  function placeholderEl(r) {
    var ph = document.createElement("div");
    ph.className = "card-photo placeholder";
    ph.textContent = r.brand || "No Image";
    return ph;
  }
  function swapPlaceholder(img, r) {
    var ph = placeholderEl(r);
    if (img.parentNode) img.parentNode.replaceChild(ph, img);
  }

  // 画像URL: <id>/<filename>
  function imgUrl(id, filename) {
    return encodeURIComponent(id) + "/" + encodeURIComponent(filename);
  }

  // ---- ダイアログ ----
  var dialogState = { photos: [], photoIndex: 0, id: null };

  function bindDialog() {
    document.getElementById("dialog-close").addEventListener("click", closeDialog);
    document.getElementById("dialog-overlay").addEventListener("click", function (e) {
      if (e.target.id === "dialog-overlay") closeDialog();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeDialog(); });
  }

  function openDialog(listItem, items, index) {
    var overlay = document.getElementById("dialog-overlay");
    var content = document.getElementById("dialog-content");
    overlay.hidden = false;
    content.innerHTML = "<div class='status'>読み込み中...</div>";

    fetchInfo(listItem.id)
      .then(function (info) {
        content.innerHTML = "";
        content.appendChild(buildDialogBody(info || fallbackInfo(listItem)));
      })
      .catch(function () {
        content.innerHTML = "";
        content.appendChild(buildDialogBody(fallbackInfo(listItem)));
      });
  }

  function fetchInfo(id) {
    if (infoCache[id]) return Promise.resolve(infoCache[id]);
    return fetch(encodeURIComponent(id) + "/info.json?_=" + Date.now())
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (info) { infoCache[id] = info; return info; });
  }

  // info.json が取れないときは list の情報だけで最低限表示する。
  function fallbackInfo(li) {
    return {
      id: li.id, brand: li.brand, rating: li.rating, date: li.date,
      category: li.category, sweetnessDryness: li.sweetnessDryness,
      richnessLightness: li.richnessLightness, fruity: li.fruity, sweetness: li.sweetness,
      images: li.thumb ? [li.thumb] : [], ecItems: []
    };
  }

  function closeDialog() {
    document.getElementById("dialog-overlay").hidden = true;
  }

  function buildDialogBody(r) {
    dialogState.id = r.id;
    dialogState.photos = (r.images || []).filter(function (x) { return !!x; });
    dialogState.photoIndex = 0;

    var frag = document.createDocumentFragment();

    // 写真
    var pw = document.createElement("div");
    pw.className = "d-photo-wrap";
    var photos = dialogState.photos;
    if (photos.length > 0) {
      var img = document.createElement("img");
      img.className = "d-photo";
      img.src = imgUrl(r.id, photos[0]);
      img.onerror = function () { img.style.display = "none"; };
      pw.appendChild(img);
      if (photos.length > 1) {
        var count = document.createElement("div");
        count.className = "d-photo-count";
        count.textContent = "1/" + photos.length;
        var prev = navBtn("‹", "d-photo-prev");
        var next = navBtn("›", "d-photo-next");
        prev.addEventListener("click", function () { movePhoto(img, count, -1); });
        next.addEventListener("click", function () { movePhoto(img, count, 1); });
        pw.appendChild(prev); pw.appendChild(next); pw.appendChild(count);

        // スワイプ（タッチ／マウス）で写真を切り替える。
        attachSwipe(pw, function (dir) { movePhoto(img, count, dir); });
      }
    } else {
      pw.textContent = r.brand || "No Image";
    }
    frag.appendChild(pw);

    frag.appendChild(box("d-box", r.brand || "(無題)"));

    var row = document.createElement("div");
    row.className = "d-row";
    var ratingBox = box("d-box", "");
    ratingBox.innerHTML = '<span class="d-rating">' + stars(r.rating) + "</span> " + (num(r.rating).toFixed(1));
    row.appendChild(ratingBox);
    row.appendChild(box("d-box", formatDate(r.date)));
    frag.appendChild(row);

    frag.appendChild(box("d-box", r.place || ""));
    frag.appendChild(box("d-box d-comment", r.comment || ""));

    // 上段: カテゴリ / サブカテゴリ（横2列、見出し文字なし）
    var catRow = document.createElement("div");
    catRow.className = "d-row";
    catRow.appendChild(box("d-box", CATEGORY_LABELS[r.category] || "その他"));
    catRow.appendChild(box("d-box", r.subCategory || ""));
    frag.appendChild(catRow);

    // 中段: 左（フルーティ/甘味度/度数/容量）＋ 右（Position 正方形）
    var detail = document.createElement("div");
    detail.className = "d-detail";

    var left = document.createElement("div");
    left.className = "d-detail-left";
    left.appendChild(sliderRow("フルーティ", num(r.fruity), -5, 5));
    left.appendChild(sliderRow("甘味度", num(r.sweetness), -5, 5));
    left.appendChild(box("d-box", "度数: " + fmtNum(r.alcoholPercent) + " %"));
    left.appendChild(box("d-box", "容量: " + (r.volumeMl > 0 ? r.volumeMl + " ml" : "-")));

    var right = document.createElement("div");
    right.className = "d-detail-right";

    var sake = (r.category === "Sake");
    if (sake) {
      // 日本酒モード: 4象限画像を背景に。軸ラベルは画像に含まれるため出さない。
      right.classList.add("sake-mode");
      right.style.backgroundImage = "url('" + positionImageUrl() + "')";
    } else {
      right.appendChild(miniAxis("濃醇", "top"));
      right.appendChild(miniAxis("淡麗", "bottom"));
      right.appendChild(miniAxis("辛口", "left"));
      right.appendChild(miniAxis("甘口", "right"));
    }
    var pc = positionCoord(r);
    var dot = document.createElement("div");
    dot.className = "d-pos-marker";
    dot.style.left = pc.x + "%";
    dot.style.top = pc.y + "%";
    right.appendChild(dot);

    detail.appendChild(left);
    detail.appendChild(right);
    frag.appendChild(detail);

    frag.appendChild(box("d-box", "産地: " + (r.origin || "")));

    var ec = buildEc(r.ecItems);
    if (ec) frag.appendChild(ec);

    return frag;
  }

  // 要素に横スワイプ検出を付ける。左スワイプ=次(+1)、右スワイプ=前(-1)。
  function attachSwipe(el, onSwipe) {
    var startX = 0, startY = 0, tracking = false;
    var THRESHOLD = 40; // これ以上の横移動でスワイプと判定

    el.addEventListener("touchstart", function (e) {
      if (!e.touches || e.touches.length === 0) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    el.addEventListener("touchend", function (e) {
      if (!tracking) return;
      tracking = false;
      var t = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : null;
      if (!t) return;
      handle(t.clientX - startX, t.clientY - startY);
    });

    // マウスドラッグにも対応（PC確認用）。
    el.addEventListener("mousedown", function (e) {
      startX = e.clientX; startY = e.clientY; tracking = true;
    });
    el.addEventListener("mouseup", function (e) {
      if (!tracking) return;
      tracking = false;
      handle(e.clientX - startX, e.clientY - startY);
    });

    function handle(dx, dy) {
      if (Math.abs(dx) < THRESHOLD || Math.abs(dx) < Math.abs(dy)) return; // 横スワイプのみ
      onSwipe(dx < 0 ? 1 : -1);
    }
  }

  function movePhoto(img, countEl, dir) {
    var n = dialogState.photoIndex + dir;
    if (n < 0 || n >= dialogState.photos.length) return;
    dialogState.photoIndex = n;
    img.style.display = "";
    img.src = imgUrl(dialogState.id, dialogState.photos[n]);
    countEl.textContent = (n + 1) + "/" + dialogState.photos.length;
  }

  function buildEc(items) {
    if (!items || items.length === 0) return null;
    var order = ["Amazon", "Rakuten", "Yahoo"];
    var byProvider = {};
    items.forEach(function (it) { if (it && it.provider) byProvider[it.provider] = it; });
    if (!order.some(function (p) { return byProvider[p]; })) return null;

    var wrap = document.createElement("div");
    wrap.className = "d-ec";
    order.forEach(function (p) {
      var it = byProvider[p];
      if (!it) return;
      var a = document.createElement("a");
      a.className = "d-ec-item";
      a.href = it.productUrl || "#";
      a.target = "_blank";
      a.rel = "noopener";

      var title = document.createElement("div");
      title.className = "d-ec-title";
      title.textContent = EC_TITLES[p] || p;
      a.appendChild(title);

      if (it.iconUrl) {
        var img = document.createElement("img");
        img.src = it.iconUrl;
        img.alt = p;
        img.onerror = function () { img.style.display = "none"; };
        a.appendChild(img);
      }

      var price = document.createElement("div");
      price.className = "d-ec-price";
      price.textContent = it.price > 0 ? "¥" + Number(it.price).toLocaleString() : "-";
      a.appendChild(price);

      wrap.appendChild(a);
    });
    return wrap;
  }

  // ---- UIヘルパ ----
  function box(cls, text) {
    var d = document.createElement("div");
    d.className = cls; d.textContent = text;
    return d;
  }
  function navBtn(glyph, cls) {
    var b = document.createElement("button");
    b.className = "d-photo-nav " + cls; b.textContent = glyph;
    return b;
  }
  function miniAxis(text, pos) {
    var s = document.createElement("span");
    s.className = "axis axis-" + pos; s.textContent = text;
    return s;
  }
  function sliderRow(label, value, min, max) {
    var row = document.createElement("div");
    row.className = "d-box d-slider";
    var lbl = document.createElement("span"); lbl.textContent = label;
    var track = document.createElement("div"); track.className = "d-slider-track";
    var dot = document.createElement("div"); dot.className = "d-slider-dot";
    var pct = ((value - min) / (max - min)) * 100;
    dot.style.left = clampPct(pct) + "%";
    track.appendChild(dot);
    var val = document.createElement("span");
    val.textContent = (value > 0 ? "+" : "") + value;
    row.appendChild(lbl); row.appendChild(track); row.appendChild(val);
    return row;
  }

  function bindAccordions() {
    var headers = document.querySelectorAll(".acc-header");
    headers.forEach(function (h) {
      h.addEventListener("click", function () { h.parentNode.classList.toggle("collapsed"); });
    });
  }

  function stars(rating) {
    var v = Math.round((num(rating)) * 2) / 2;
    var full = Math.floor(v);
    var half = (v - full) >= 0.5;
    var s = "";
    for (var i = 0; i < full && i < 5; i++) s += "★";
    if (half && full < 5) { s += "☆"; full++; }
    for (var j = full; j < 5; j++) s += "☆";
    return s;
  }
  function formatDate(d) { return d ? d.replace(/-/g, "/") : ""; }
  function fmtNum(n) { var v = num(n); return (Math.round(v * 10) / 10).toString(); }
  function num(v) { return typeof v === "number" ? v : (parseFloat(v) || 0); }
  function clampPct(p) { return Math.max(0, Math.min(100, p)); }
  function setStatus(msg) { document.getElementById("status").textContent = msg || ""; }
})();
