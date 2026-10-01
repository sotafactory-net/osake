// Osake Web 閲覧ページ。分割構造（list.json + <id>/info.json + <id>/画像）を読み込む。
// GitHub Pages 上で JavaScript だけで動く（サーバサイド不要）。

(function () {
  "use strict";

  // ---- 言語（Android の Loc と同じ文言）----
  var CATEGORY_ORDER = ["All", "Sake", "Wine", "Whisky", "Sour", "Other"];
  var SORT_OPTIONS = [
    { key: "rating", asc: false },
    { key: "rating", asc: true },
    { key: "brand",  asc: false },
    { key: "brand",  asc: true },
    { key: "date",   asc: false },
    { key: "date",   asc: true }
  ];
  var RATING_MINS = [0, 1, 2, 3, 4];
  var PAGE_SIZE = 10;
  var EC_TITLES = { Amazon: "Amazon", Rakuten: "Rakuten", Yahoo: "Yahoo" };

  // 日英の文言テーブル。
  var I18N = {
    ja: {
      "cat.All": "すべて", "cat.Sake": "日本酒", "cat.Wine": "ワイン",
      "cat.Whisky": "ウイスキー", "cat.Sour": "サワー", "cat.Other": "その他",
      "rating.0": "すべて", "rating.1": "★1以上", "rating.2": "★2以上", "rating.3": "★3以上", "rating.4": "★4以上",
      "sort.ratingDesc": "評価（降順）", "sort.ratingAsc": "評価（昇順）",
      "sort.brandDesc": "銘柄（降順）", "sort.brandAsc": "銘柄（昇順）",
      "sort.dateDesc": "年月日（降順）", "sort.dateAsc": "年月日（昇順）",
      "page.items": "表示件数: {0}〜{1}",
      "acc.position": "ポジション", "acc.taste": "味わい",
      "pos.rich": "濃醇", "pos.light": "淡麗", "pos.dry": "辛口", "pos.sweet": "甘口",
      "taste.top": "フルーティ高", "taste.bottom": "フルーティ低",
      "taste.left": "甘味度 低", "taste.right": "甘味度 高",
      "d.fruity": "果実度", "d.sweetness": "甘味度",
      "d.alcohol": "度数: {0} %", "d.volume": "容量: {0} ml", "d.volumeNone": "容量: -",
      "d.origin": "産地: {0}", "d.untitled": "(無題)", "d.noImage": "No Image",
      "ec.noPrice": "-", "ec.amazonSearch": "Amazonで検索", "ec.view": "見る",
      "status.loading": "読み込み中...", "status.empty": "該当する記録がありません",
      "status.loadFail": "データの読み込みに失敗しました: {0}",
      "app.name": "お酒記録",
      "footer.sub": "Google Play で手に入れよう"
    },
    en: {
      "cat.All": "All", "cat.Sake": "Sake", "cat.Wine": "Wine",
      "cat.Whisky": "Whisky", "cat.Sour": "Sour", "cat.Other": "Other",
      "rating.0": "All", "rating.1": "★1+", "rating.2": "★2+", "rating.3": "★3+", "rating.4": "★4+",
      "sort.ratingDesc": "Rating (High→Low)", "sort.ratingAsc": "Rating (Low→High)",
      "sort.brandDesc": "Name (Z→A)", "sort.brandAsc": "Name (A→Z)",
      "sort.dateDesc": "Date (New→Old)", "sort.dateAsc": "Date (Old→New)",
      "page.items": "Items: {0}-{1}",
      "acc.position": "Position", "acc.taste": "Taste",
      "pos.rich": "Rich", "pos.light": "Light", "pos.dry": "Dry", "pos.sweet": "Sweet",
      "taste.top": "Fruity High", "taste.bottom": "Fruity Low",
      "taste.left": "Sweetness Low", "taste.right": "Sweetness High",
      "d.fruity": "Fruity", "d.sweetness": "Sweet",
      "d.alcohol": "ABV: {0} %", "d.volume": "Volume: {0} ml", "d.volumeNone": "Volume: -",
      "d.origin": "Origin: {0}", "d.untitled": "(Untitled)", "d.noImage": "No Image",
      "ec.noPrice": "-", "ec.amazonSearch": "Search on Amazon", "ec.view": "View",
      "status.loading": "Loading...", "status.empty": "No records found",
      "status.loadFail": "Failed to load data: {0}",
      "app.name": "Drink Log",
      "footer.sub": "Get it on Google Play"
    }
  };

  // サブカテゴリ（保存値は日本語）→英語ローマ字表記。Android の subcat.* と同じ。
  var SUBCAT_EN = {
    "その他": "Other",
    "純米大吟醸": "Junmai Daiginjo",
    "純米吟醸": "Junmai Ginjo",
    "特別純米酒": "Tokubetsu Junmai",
    "純米酒": "Junmai",
    "大吟醸": "Daiginjo",
    "吟醸": "Ginjo",
    "特別本醸造": "Tokubetsu Honjozo",
    "本醸造": "Honjozo",
    "赤": "Red",
    "白": "White",
    "ロゼ": "Rose",
    "スパークリング": "Sparkling",
    "シングルモルト": "Single Malt",
    "ブレンデッド": "Blended",
    "バーボン": "Bourbon",
    "レモン": "Lemon",
    "グレープフルーツ": "Grapefruit"
  };
  // サブカテゴリを現在の言語で表示する。英語かつ対応があれば英語、無ければそのまま。
  function subCatLabel(ja) {
    if (!ja) return "";
    if (lang === "en" && SUBCAT_EN[ja]) return SUBCAT_EN[ja];
    return ja;
  }

  var lang = detectLang(); // "ja" or "en"

  function detectLang() {
    var saved = null;
    try { saved = localStorage.getItem("osake.lang"); } catch (e) {}
    if (saved === "ja" || saved === "en") return saved;
    return (navigator.language || "").toLowerCase().indexOf("ja") === 0 ? "ja" : "en";
  }
  function setLang(l) {
    lang = l;
    try { localStorage.setItem("osake.lang", l); } catch (e) {}
  }
  function t(key) {
    var table = I18N[lang] || I18N.ja;
    return (key in table) ? table[key] : key;
  }
  function tf(key) {
    var s = t(key);
    for (var i = 1; i < arguments.length; i++) {
      s = s.replace("{" + (i - 1) + "}", arguments[i]);
    }
    return s;
  }
  function catLabel(c) { return t("cat." + (c || "Other")); }

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
    buildLangDropdown();
    buildDropdowns();
    applyStaticTexts();
    bindAccordions();
    bindDialog();
    loadData();
  }

  function loadData() {
    setStatus(t("status.loading"));
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
        setStatus(tf("status.loadFail", e.message));
      });
  }

  // 言語プルダウン（EN/JP）。切替時に全文言を作り直す。
  function buildLangDropdown() {
    var sel = document.getElementById("filter-lang");
    if (!sel) return;
    sel.innerHTML = "";
    sel.appendChild(opt("ja", "JP"));
    sel.appendChild(opt("en", "EN"));
    sel.value = lang;
    sel.addEventListener("change", function () {
      setLang(sel.value);
      rebuildDropdownLabels();
      applyStaticTexts();
      render();
    });
  }

  // ---- ドロップダウン生成 ----
  function buildDropdowns() {
    var cat = document.getElementById("filter-category");
    CATEGORY_ORDER.forEach(function (key) { cat.appendChild(opt(key, catLabel(key))); });
    cat.value = state.category;
    cat.addEventListener("change", function () { state.category = cat.value; state.page = 0; render(); });

    var rating = document.getElementById("filter-rating");
    RATING_MINS.forEach(function (m, i) { rating.appendChild(opt(String(i), t("rating." + m))); });
    rating.value = "0";
    rating.addEventListener("change", function () { state.ratingMin = RATING_MINS[parseInt(rating.value, 10)]; state.page = 0; render(); });

    var sort = document.getElementById("filter-sort");
    SORT_OPTIONS.forEach(function (o, i) { sort.appendChild(opt(String(i), sortLabel(i))); });
    sort.value = String(state.sortIndex);
    sort.addEventListener("change", function () { state.sortIndex = parseInt(sort.value, 10); state.page = 0; render(); });

    document.getElementById("filter-page").addEventListener("change", function (e) {
      state.page = parseInt(e.target.value, 10) || 0; render();
    });
  }

  // ソートインデックスに対応するラベルキー。
  var SORT_KEYS = ["sort.ratingDesc", "sort.ratingAsc", "sort.brandDesc", "sort.brandAsc", "sort.dateDesc", "sort.dateAsc"];
  function sortLabel(i) { return t(SORT_KEYS[i]); }

  // 言語切替時に、選択状態を保ったままドロップダウンのラベルを作り直す。
  function rebuildDropdownLabels() {
    var cat = document.getElementById("filter-category");
    var catVal = cat.value;
    cat.innerHTML = "";
    CATEGORY_ORDER.forEach(function (key) { cat.appendChild(opt(key, catLabel(key))); });
    cat.value = catVal;

    var rating = document.getElementById("filter-rating");
    var rVal = rating.value;
    rating.innerHTML = "";
    RATING_MINS.forEach(function (m, i) { rating.appendChild(opt(String(i), t("rating." + m))); });
    rating.value = rVal;

    var sort = document.getElementById("filter-sort");
    var sVal = sort.value;
    sort.innerHTML = "";
    SORT_OPTIONS.forEach(function (o, i) { sort.appendChild(opt(String(i), sortLabel(i))); });
    sort.value = sVal;
  }

  // アコーディオン見出し・軸ラベル・フッターなど固定文言を反映する。
  function applyStaticTexts() {
    setText("acc-title-position", t("acc.position"));
    setText("acc-title-taste", t("acc.taste"));
    setText("pos-axis-top", t("pos.rich"));
    setText("pos-axis-bottom", t("pos.light"));
    setText("pos-axis-left", t("pos.dry"));
    setText("pos-axis-right", t("pos.sweet"));
    setText("taste-axis-top", t("taste.top"));
    setText("taste-axis-bottom", t("taste.bottom"));
    setText("taste-axis-left", t("taste.left"));
    setText("taste-axis-right", t("taste.right"));
    setText("footer-name", t("app.name"));
    setText("footer-sub", t("footer.sub"));
    document.documentElement.lang = lang;
  }

  function setText(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function rebuildPageDropdown(total) {
    var page = document.getElementById("filter-page");
    var pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (state.page >= pages) state.page = 0;
    page.innerHTML = "";
    for (var i = 0; i < pages; i++) {
      var from = i * PAGE_SIZE + 1;
      var to = Math.min((i + 1) * PAGE_SIZE, total);
      page.appendChild(opt(String(i), tf("page.items", from, to)));
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
    if (items.length === 0) { setStatus(t("status.empty")); return; }
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
        img.src = imgUrl(r.id, r.thumb, r.updatedAt);
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
    ph.textContent = r.brand || t("d.noImage");
    return ph;
  }
  function swapPlaceholder(img, r) {
    var ph = placeholderEl(r);
    if (img.parentNode) img.parentNode.replaceChild(ph, img);
  }

  // 画像URL: <id>/<filename>?v=<version>
  // ver に updatedAt を付けると、同名で中身が変わった画像もキャッシュを回避して最新を表示できる。
  function imgUrl(id, filename, ver) {
    var u = encodeURIComponent(id) + "/" + encodeURIComponent(filename);
    if (ver) u += "?v=" + encodeURIComponent(ver);
    return u;
  }

  // ---- ダイアログ ----
  var dialogState = { photos: [], photoIndex: 0, id: null, items: [], itemIndex: 0, ver: "" };

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

    // 前後移動のため、現在のリストと位置を保持する。
    dialogState.items = items || [];
    dialogState.itemIndex = (typeof index === "number") ? index : 0;

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
    dialogState.ver = r.updatedAt || "";

    var frag = document.createDocumentFragment();

    // 写真
    var pw = document.createElement("div");
    pw.className = "d-photo-wrap";
    var photos = dialogState.photos;
    if (photos.length > 0) {
      var img = document.createElement("img");
      img.className = "d-photo";
      img.src = imgUrl(r.id, photos[0], dialogState.ver);
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
      pw.textContent = r.brand || t("d.noImage");
    }
    frag.appendChild(pw);

    // 写真より下の全コンテンツをまとめるコンテナ。ここ全面をスワイプで前後移動できる。
    var below = document.createElement("div");
    below.className = "d-below";

    below.appendChild(box("d-box", r.brand || t("d.untitled")));

    var row = document.createElement("div");
    row.className = "d-row";
    var ratingBox = box("d-box", "");
    ratingBox.innerHTML = '<span class="d-rating">' + stars(r.rating) + "</span> " + (num(r.rating).toFixed(1));
    row.appendChild(ratingBox);
    row.appendChild(box("d-box", formatDate(r.date)));
    below.appendChild(row);

    below.appendChild(box("d-box", r.place || ""));
    below.appendChild(box("d-box d-comment", r.comment || ""));

    // 上段: カテゴリ / サブカテゴリ（横2列、見出し文字なし）
    var catRow = document.createElement("div");
    catRow.className = "d-row";
    catRow.appendChild(box("d-box", catLabel(r.category)));
    catRow.appendChild(box("d-box", subCatLabel(r.subCategory)));
    below.appendChild(catRow);

    // 中段: 左（フルーティ/甘味度/度数/容量）＋ 右（Position 正方形）
    var detail = document.createElement("div");
    detail.className = "d-detail";

    var left = document.createElement("div");
    left.className = "d-detail-left";
    left.appendChild(sliderRow(t("d.fruity"), num(r.fruity), -5, 5));
    left.appendChild(sliderRow(t("d.sweetness"), num(r.sweetness), -5, 5));
    left.appendChild(box("d-box", tf("d.alcohol", fmtNum(r.alcoholPercent))));
    left.appendChild(box("d-box", r.volumeMl > 0 ? tf("d.volume", r.volumeMl) : t("d.volumeNone")));

    var right = document.createElement("div");
    right.className = "d-detail-right";

    var sake = (r.category === "Sake");
    if (sake) {
      // 日本酒モード: 4象限画像を背景に。軸ラベルは画像に含まれるため出さない。
      right.classList.add("sake-mode");
      right.style.backgroundImage = "url('" + positionImageUrl() + "')";
    } else {
      right.appendChild(miniAxis(t("pos.rich"), "top"));
      right.appendChild(miniAxis(t("pos.light"), "bottom"));
      right.appendChild(miniAxis(t("pos.dry"), "left"));
      right.appendChild(miniAxis(t("pos.sweet"), "right"));
    }
    var pc = positionCoord(r);
    var dot = document.createElement("div");
    dot.className = "d-pos-marker";
    dot.style.left = pc.x + "%";
    dot.style.top = pc.y + "%";
    right.appendChild(dot);

    detail.appendChild(left);
    detail.appendChild(right);
    below.appendChild(detail);

    below.appendChild(box("d-box", tf("d.origin", r.origin || "")));

    var ec = buildEc(r.ecItems);
    if (ec) below.appendChild(ec);

    frag.appendChild(below);

    // 写真より下の領域全体を左右スワイプすると、リストの前後の商品へ移動する。
    // 写真エリア(pw)は別なので、写真送りと競合しない。
    attachSwipe(below, moveItem);

    return frag;
  }

  // ダイアログをリストの前後アイテムへ切り替える。dir=+1 次、-1 前。端では何もしない。
  function moveItem(dir) {
    var items = dialogState.items || [];
    var n = dialogState.itemIndex + dir;
    if (n < 0 || n >= items.length) return;
    openDialog(items[n], items, n);
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
    img.src = imgUrl(dialogState.id, dialogState.photos[n], dialogState.ver);
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

      var hasPrice = it.price > 0;

      if (it.iconUrl) {
        var img = document.createElement("img");
        img.src = it.iconUrl;
        img.alt = p;
        // 画像が読めなかった場合はプレースホルダに差し替える（アイコンが出ない不具合対策）。
        img.onerror = function () {
          var ph = ecPlaceholder(p, hasPrice);
          if (img.parentNode) img.parentNode.replaceChild(ph, img);
        };
        a.appendChild(img);
      } else {
        // iconUrl 無し（Amazon申請中など）→ プレースホルダを表示。
        a.appendChild(ecPlaceholder(p, hasPrice));
      }

      var price = document.createElement("div");
      price.className = "d-ec-price";
      // 価格があれば金額、無ければ「見る/検索」の案内。
      if (hasPrice) {
        price.textContent = "¥" + Number(it.price).toLocaleString();
      } else {
        price.textContent = (p === "Amazon") ? t("ec.amazonSearch") : t("ec.view");
      }
      a.appendChild(price);

      wrap.appendChild(a);
    });
    return wrap;
  }

  // EC画像が無い/読めないときの代替表示（画像枠と同じ高さの箱）。
  function ecPlaceholder(provider, hasPrice) {
    var ph = document.createElement("div");
    ph.className = "d-ec-noimg";
    // Amazon申請中などアイコンが無い場合の案内文。
    ph.textContent = (provider === "Amazon" && !hasPrice) ? t("ec.amazonSearch") : t("ec.view");
    return ph;
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
    var lbl = document.createElement("span"); lbl.className = "d-slider-label"; lbl.textContent = label;
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
