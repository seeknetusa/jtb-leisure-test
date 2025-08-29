const apiBaseUrl = "https://jtb-leisure.vercel.app/api/airtable-proxy";
const pageSize = 6;
let currentPage = 1;
let totalPages = 0;
let currentSortField = 'Name';
let currentSortDirection = 'asc';
let allData = [];
let filteredData = [];


//const urlParams = new URLSearchParams(window.location.search);
//const urlType = urlParams.get("style");  // 例: "japan_day_tours"
const pathParts = window.location.pathname.split('/').filter(Boolean);
let urlType = pathParts[pathParts.length - 1];  // 最後の部分だけ抽出（例: "tailor-made-tours"）
if(urlType == 'japan-tours' || urlType == 'airtable5.html') urlType = '';

//console.log('pathParts', pathParts[pathParts.length - 1]);
//console.log('urlType', urlType);
//urlType = 'tailor-made-tours';

let minDays = 1;
let maxDays = 30; 
let urlTypeCheckedSet = false; // グローバルに一度だけ適用するためのフラグ

/**
 * Airtable APIからすべてのTourデータを取得し、allDataとfilteredDataに格納。
 * 必要に応じてフィルターUIの描画も行う。
 * 
 * @param {boolean} withUI - UIの再描画を行うかどうか
 */
async function fetchAndStoreData(withUI = true) {
  let all = [];               // 全レコード格納用
  let offset = null;         // Airtableのページネーション用オフセット
  let done = false;          // データ取得完了フラグ

  try {
    // Airtable API から全データ取得（ページネーション対応）
    while (!done) {
      let url = `${apiBaseUrl}?table=1&sortField=${encodeURIComponent(currentSortField)}&sortDirection=${encodeURIComponent(currentSortDirection)}`;
      if (offset) url += `&offset=${offset}`;

      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        alert(`APIエラー: ${res.status}\n${err}`);
        return;
      }

      const data = await res.json();
      if (!data.records) {
        alert("Airtableからの形式が不正です。");
        return;
      }

      all.push(...data.records);  // レコード追加
      offset = data.offset;       // 次のページのオフセット
      done = !offset;             // offsetがなければ終了
    }

    // 取得した全レコードを保持
    allData = all;
    filteredData = [...allData];

    // UI更新が必要な場合
    if (withUI) {
      generateFilters();          
      //generateSearchDropdowns(); 

      let typApplied = false;

      if (urlType && !typApplied) {
        document.querySelectorAll('input[name="style"]').forEach(input => {
          const normalizedLabel = input.value.replace(/^\d+\.\s*/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
          const normalizedUrlType = urlType.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (normalizedLabel === normalizedUrlType) {
            input.checked = true;
            typApplied = true;
          }
        });
      }

      // ✅ フィルターが適用されたかに関係なく描画処理は必ず行う
      if (typApplied) {
        applyFilter(); // チェックボックスがONになっていればフィルターを適用
      } else {
        paginateAndDisplay(); // そうでなければ全件表示
      }
    }
  } catch (e) {
    console.error(e);
    alert("データ取得に失敗しました");
  }
}

/**
 * Tourデータのフィルター（STYLE、INTEREST、DESTINATION）UIを生成し、チェック状態やドロップダウン、スライダーも初期化。
 */
function generateFilters() {
  // 選択中のフィルター値を取得
  const selectedStyles = Array.from(document.querySelectorAll('input[name="style"]:checked')).map(el => el.value.trim());
  const selectedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked')).map(el => el.value.trim());
  const selectedDestinations = Array.from(document.querySelectorAll('input[name="destination"]:checked')).map(el => el.value.trim());

  // 重複排除のためにSetを使用
  const styleSet = new Set();
  const interestSet = new Set();
  const destinationSet = new Set();

  // TourデータからユニークなSTYLE・INTEREST・DESTINATIONを抽出
  filteredData.forEach(r => {
    const styleField = r.fields["Name (from Style)"];
    const interestField = r.fields["Interest"];
    const destinationField = r.fields["Destination"];

    if (Array.isArray(styleField)) {
      styleField.forEach(s => styleSet.add(s.trim()));
    } else if (typeof styleField === 'string') {
      styleField.split(',').forEach(s => styleSet.add(s.trim()));
    }

    if (typeof interestField === 'string') {
      interestSet.add(interestField.trim());
    } else if (Array.isArray(interestField)) {
      interestField.forEach(val => interestSet.add(val.trim()));
    }

    if (typeof destinationField === 'string') {
      destinationSet.add(destinationField.trim());
    } else if (Array.isArray(destinationField)) {
      destinationField.forEach(val => destinationSet.add(val.trim()));
    }
  });

  // 名前順に並べ替え
  const sortedStyles = Array.from(styleSet).sort((a, b) => a.localeCompare(b, 'ja'));
  const sortedInterests = Array.from(interestSet).sort((a, b) => a.localeCompare(b, 'ja'));
  const sortedDestinations = Array.from(destinationSet).sort((a, b) => a.localeCompare(b, 'ja'));

  // フィルター用のHTML要素を取得
  const styleContainer = document.getElementById('filter-style');
  const interestContainer = document.getElementById('filter-interest');
  const destinationContainer = document.getElementById('filter-destination');
  styleContainer.innerHTML = '';
  interestContainer.innerHTML = '';
  destinationContainer.innerHTML = '';

  // 項目ごとの出現数をカウント
  const countValues = (key) => {
    const counts = {};
    filteredData.forEach(r => {
      const values = r.fields[key];
      if (Array.isArray(values)) {
        values.forEach(val => {
          const trimmed = val.trim();
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        });
      } else if (typeof values === 'string') {
        values.split(',').forEach(val => {
          const trimmed = val.trim();
          counts[trimmed] = (counts[trimmed] || 0) + 1;
        });
      }
    });
    return counts;
  };

  const styleCounts = countValues("Name (from Style)");
  const interestCounts = countValues("Interest");
  const destinationCounts = countValues("Destination");

  // チェックボックス生成関数
  const renderCheckboxes = (container, sortedItems, selectedList, countMap, name) => {
    sortedItems.forEach(c => {
      const value = c.trim();
      const label = value.replace(/^\d+\.\s*/, '');
      const normalized = label.toLowerCase().replace(/\s+/g, '_');
      const count = countMap[value] || 0;
      let checked = '';

      if (selectedList.includes(value)) {
        checked = 'checked';
      } else if (!urlTypeCheckedSet && normalized === urlType) {
        checked = 'checked';
        selectedList.push(value);
        urlTypeCheckedSet = true;
      }

      container.innerHTML += `
        <label>
          <input type="checkbox" name="${name}" value="${value}" ${checked}>
          ${label} (${count})
        </label><br>`;
    });
  };

  // STYLE・INTEREST・DESTINATIONチェックボックスを描画
  renderCheckboxes(styleContainer, sortedStyles, selectedStyles, styleCounts, 'style');
  renderCheckboxes(interestContainer, sortedInterests, selectedInterests, interestCounts, 'interest');
  renderCheckboxes(destinationContainer, sortedDestinations, selectedDestinations, destinationCounts, 'destination');

  // チェックボックスの変更でフィルターを再適用
  document.querySelectorAll('#filter-style input, #filter-interest input, #filter-destination input').forEach(el => {
    el.addEventListener('change', () => {
      applyFilter();
    });
  });

  // 検索バーのドロップダウンを更新


  // Trip Length（日数）用スライダーの設定
  const dayValues = allData
    .map(r => r.fields.Days)
    .filter(v => typeof v === 'number' && !isNaN(v));

  if (dayValues.length > 0) {
    const minDays = Math.min(...dayValues);
    const maxDays = Math.max(...dayValues);
    const tripSlider = document.getElementById('trip-length-slider');

    if (!tripSlider.noUiSlider) {
      noUiSlider.create(tripSlider, {
        start: [minDays, maxDays],
        connect: true,
        range: { min: minDays, max: maxDays },
        step: 1,
        format: {
          to: value => `${Math.round(value)} day`,
          from: value => Number(value.replace(' day', ''))
        }
      });

      const minDisplay = document.getElementById('trip-length-min');
      const maxDisplay = document.getElementById('trip-length-max');

      tripSlider.noUiSlider.on('update', function (values, handle) {
        const [minVal, maxVal] = values.map(v => parseInt(v));
        minDisplay.textContent = `${minVal} day`;
        maxDisplay.textContent = `${maxVal} day`;
      });

      tripSlider.noUiSlider.on('change', applyFilter);
    }
  }
}

// Tourデータに対して現在のフィルター設定を適用する関数
function applyFilter() {
  const selectedStyles = Array.from(document.querySelectorAll('input[name="style"]:checked')).map(el => el.value.trim());
  const selectedInterests = Array.from(document.querySelectorAll('input[name="interest"]:checked')).map(el => el.value.trim());
  const selectedDestinations = Array.from(document.querySelectorAll('input[name="destination"]:checked')).map(el => el.value.trim());

  // noUiSliderからTrip Length（日数）の範囲を取得
  let selectedMinDays = null;
  let selectedMaxDays = null;

  const tripSlider = document.getElementById('trip-length-slider');
  if (tripSlider && tripSlider.noUiSlider) {
    const values = tripSlider.noUiSlider.get();
    selectedMinDays = parseInt(values[0]);
    selectedMaxDays = parseInt(values[1]);
  }

  // 各フィルター条件を満たすレコードのみ残す
  filteredData = allData.filter(record => {
    const styleField = record.fields["Name (from Style)"] || '';
    const interestField = record.fields["Interest"] || '';
    const destinationField = record.fields["Destination"] || '';
    const days = record.fields.Days;

    // --- Style フィルター判定 ---
    let styleMatch = false;
    if (selectedStyles.length === 0) {
      styleMatch = true;
    } else if (typeof styleField === 'string') {
      styleMatch = selectedStyles.some(val => styleField.includes(val));
    } else if (Array.isArray(styleField)) {
      styleMatch = styleField.some(val => selectedStyles.includes(val.trim()));
    }

    // --- Interest フィルター判定 ---
    let interestMatch = false;
    if (selectedInterests.length === 0) {
      interestMatch = true;
    } else if (typeof interestField === 'string') {
      interestMatch = selectedInterests.includes(interestField.trim());
    } else if (Array.isArray(interestField)) {
      interestMatch = interestField.some(val => selectedInterests.includes(val.trim()));
    }

    // --- Destination フィルター判定 ---
    let destinationMatch = false;
    if (selectedDestinations.length === 0) {
      destinationMatch = true;
    } else if (typeof destinationField === 'string') {
      destinationMatch = selectedDestinations.includes(destinationField.trim());
    } else if (Array.isArray(destinationField)) {
      destinationMatch = destinationField.some(val => selectedDestinations.includes(val.trim()));
    }

    // --- Trip Length（日数）フィルター判定 ---
    let daysMatch = false;
    if (typeof days === 'number' && !isNaN(days) && selectedMinDays !== null && selectedMaxDays !== null) {
      daysMatch = days >= selectedMinDays && days <= selectedMaxDays;
    }

    return styleMatch && interestMatch && destinationMatch && daysMatch;
  });

  // ページをリセットし再描画
  currentPage = 1;
  generateFilters();
  paginateAndDisplay();
}

// ページネーションと結果の表示をまとめて行う関数
function paginateAndDisplay() {
  // 総ページ数を計算（1ページあたりの件数で割る）
  totalPages = Math.ceil(filteredData.length / pageSize);

  // 総件数を画面に表示
  document.getElementById('total-count').innerHTML  = `<div id="total-count"><strong>${filteredData.length}</strong>  Tours Found`;

  // ページネーションボタンを生成
  generatePaginationButtons();

  // 現在のページのデータを表示
  displayCurrentPage();
}

// 現在のページに表示すべきTourレコードを描画する関数
async function displayCurrentPage() {
  const container = document.getElementById('airtable-data');
  container.innerHTML = '';

  const list = document.createElement('ul');
  list.className = 'airtable-list'; 

  const start = (currentPage - 1) * pageSize;
  const end = start + pageSize;
  const pageItems = filteredData.slice(start, end);

  const logoMap = await fetchStyles();

  for (const record of pageItems) {
    const card = createTourCardElement(record, logoMap);
    list.appendChild(card);
  }

  container.appendChild(list);
}

// 日付文字列を "Jan 1st (Sun), 2025" のような形式に整形する関数
function formatDateVerbose(dateStr) {
  if (!dateStr) return ''; // 入力が空なら空文字を返す

  const d = new Date(dateStr); // 文字列から日付オブジェクトを生成

  // 月と曜日の英語表記
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const day = d.getDate();

  // 日付の序数（1st, 2nd, 3rd, 4th...）を決定する関数
  const suffix = (n) => {
    if (n >= 11 && n <= 13) return 'th';
    switch (n % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  // フォーマットされた日付文字列を返す
  const formatted = `${monthNames[d.getMonth()]} ${day}${suffix(day)} (${weekdayNames[d.getDay()]}), ${d.getFullYear()}`;
  return formatted;
}

// ページネーションボタンを生成・表示する関数
function generatePaginationButtons() {
  const pagination = document.getElementById('pagination');
  pagination.innerHTML = ''; // 既存のボタンをクリア

  const maxButtons = 7; // 表示する最大ボタン数（省略記号含む）

  // ページボタン生成ユーティリティ関数
  const createButton = (page, label = null) => {
    const btn = document.createElement('button');
    btn.textContent = label || page;  // ページ番号または "..." 表示
    btn.className = 'page-button';

    if (page === currentPage) {
      btn.classList.add('active');  // 現在ページをハイライト
    }

    if (label !== '...') {
      btn.addEventListener('click', () => {
        currentPage = page;            // ページ更新
        displayCurrentPage();          // 表示更新
        generatePaginationButtons();   // ボタン再生成
      });
    } else {
      btn.disabled = true; // "..." はクリック不可
    }

    pagination.appendChild(btn);
  };

  // 総ページ数が最大ボタン数以下の場合：すべてのページを表示
  if (totalPages <= maxButtons) {
    for (let i = 1; i <= totalPages; i++) {
      createButton(i);
    }
  } else {
    // 1ページ目
    createButton(1);

    // "..." を表示するかどうか
    if (currentPage > 4) createButton(null, '...');

    // 現在ページの前後を表示（2〜n−1 ページ）
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      createButton(i);
    }

    // "..." を表示するかどうか（終わり近くなければ）
    if (currentPage < totalPages - 3) createButton(null, '...');

    // 最終ページ
    createButton(totalPages);
  }
}

// [未使用]
// 検索バーのドロップダウン（Style, Destination, Days）を生成・更新する関数
function generateSearchDropdowns() {
  const styleSelect = document.getElementById('search-style');
  const destinationSelect = document.getElementById('search-destination');
  const daysSelect = document.getElementById('search-days');

  // 現在の選択状態を保持（リセット時に復元するため）
  const currentSelectedStyle = styleSelect.value;
  const currentSelectedDestination = destinationSelect.value;
  const currentSelectedDays = daysSelect.value;

  const styleSet = new Set();
  const destinationSet = new Set();
  const daysSet = new Set();

  // 全レコードからスタイル・デスティネーション・日数を収集
  filteredData.forEach(r => {
    const styleField = r.fields["Name (from Style)"];
    const destinationField = r.fields["Destination"];
    const days = r.fields["Days"];

    if (Array.isArray(styleField)) {
      styleField.forEach(s => styleSet.add(s.trim()));
    } else if (typeof styleField === 'string') {
      styleField.split(',').forEach(s => styleSet.add(s.trim()));
    }

    if (Array.isArray(destinationField)) {
      destinationField.forEach(d => destinationSet.add(d.trim()));
    } else if (typeof destinationField === 'string') {
      destinationField.split(',').forEach(d => destinationSet.add(d.trim()));
    }

    if (typeof days === 'number' && !isNaN(days)) {
      daysSet.add(days);
    }
  });

  const sortedStyles = Array.from(styleSet).sort((a, b) => a.localeCompare(b, 'ja'));
  const sortedDestinations = Array.from(destinationSet).sort((a, b) => a.localeCompare(b, 'ja'));
  const sortedDays = Array.from(daysSet).sort((a, b) => a - b);

  // 初期化（"-- Select --" は残す）
  styleSelect.innerHTML = '<option value="">-- Select --</option>';
  destinationSelect.innerHTML = '<option value="">-- Select --</option>';
  daysSelect.innerHTML = '<option value="">-- Select --</option>';

  // Tour Style オプション生成
  sortedStyles.forEach(style => {
    const label = style.replace(/^\d+\.\s*/, '');
    const option = document.createElement('option');
    option.value = style;
    option.textContent = label;
    if (style === currentSelectedStyle) option.selected = true;
    styleSelect.appendChild(option);
  });

  // Destination オプション生成
  sortedDestinations.forEach(dest => {
    const label = dest.replace(/^\d+\.\s*/, '');
    const option = document.createElement('option');
    option.value = dest;
    option.textContent = label;
    if (dest === currentSelectedDestination) option.selected = true;
    destinationSelect.appendChild(option);
  });

  // Trip Length（日数）オプション生成
  sortedDays.forEach(day => {
    const option = document.createElement('option');
    option.value = day;
    option.textContent = `${day} days`;
    if (String(day) === currentSelectedDays) option.selected = true;
    daysSelect.appendChild(option);
  });

  // --- Tour Style の選択に連動して Destination と Days を更新 ---
  document.getElementById('search-style').addEventListener('change', () => {
    const selectedStyle = document.getElementById('search-style').value;
    const destinationSet = new Set();
    const daysSet = new Set();

    const previousDestination = destinationSelect.value;
    const previousDay = daysSelect.value;

    // 条件に一致するレコードから目的地・日数を収集
    allData.forEach(record => {
      const styleField = record.fields["Name (from Style)"];
      const destinationField = record.fields["Destination"];
      const days = record.fields["Days"];

      // style の一致を確認
      const matchesStyle = !selectedStyle ||
        (Array.isArray(styleField) && styleField.includes(selectedStyle)) ||
        (typeof styleField === 'string' && styleField === selectedStyle);

      if (matchesStyle) {
        if (Array.isArray(destinationField)) {
          destinationField.forEach(dest => destinationSet.add(dest.trim()));
        } else if (typeof destinationField === 'string') {
          destinationField.split(',').forEach(dest => destinationSet.add(dest.trim()));
        }

        if (typeof days === 'number' && !isNaN(days)) {
          daysSet.add(days);
        }
      }
    });

    // Destination 更新
    destinationSelect.innerHTML = '<option value="">-- Select --</option>';
    Array.from(destinationSet).sort((a, b) => a.localeCompare(b, 'ja')).forEach(dest => {
      const label = dest.replace(/^\d+\.\s*/, '');
      const option = document.createElement('option');
      option.value = dest;
      option.textContent = label;
      destinationSelect.appendChild(option);
    });
    if (destinationSet.has(previousDestination)) {
      destinationSelect.value = previousDestination;
    }

    // Days 更新
    daysSelect.innerHTML = '<option value="">-- Select --</option>';
    Array.from(daysSet).sort((a, b) => a - b).forEach(day => {
      const option = document.createElement('option');
      option.value = day;
      option.textContent = `${day} days`;
      daysSelect.appendChild(option);
    });
    if (daysSet.has(Number(previousDay))) {
      daysSelect.value = previousDay;
    }
  });
}

// 検索ボタンのクリックイベント
const button = document.getElementById('search-button');
if (button) {
  button.addEventListener('click', () => {
    // 検索条件の取得
    const keyword = document.getElementById('search-keyword').value.trim().toLowerCase();

    // データのフィルタリング
    filteredData = allData.filter(record => {
      const name = (record.fields.Name || '').toLowerCase();
    
      // キーワード検索（Nameフィールド）
      const keywordMatch = !keyword || name.includes(keyword);

      return keywordMatch;
    });

    // ページ番号を初期化し、再描画
    currentPage = 1;
    generateFilters();
    paginateAndDisplay();
  });
}

// ソートセレクトボックスの変更イベント
const sort = document.getElementById('sort-select');
if (sort) {
  sort.addEventListener('change', async (e) => {
    // 選択された値を分割してソート条件を取得（例: "Name|asc" → field = "Name", direction = "asc"）
    const [field, direction] = e.target.value.split('|');
    currentSortField = field;
    currentSortDirection = direction;

    // ページ番号を初期化
    currentPage = 1;

    // データの再取得（UIの再描画は行わない）
    await fetchAndStoreData(false);

    // ★ フィルターを再適用（UIの選択状態を維持するため）
    applyFilter();
  });
}

// 「すべてクリア」ボタンがクリックされたときの処理
const clear = document.getElementById('clear-filters');
if (clear) {
  clear.addEventListener('click', () => {

    // ✅ チェックボックス（Style, Interest, Destination）をすべてオフにする
    document.querySelectorAll('#filter-style input, #filter-interest input, #filter-destination input')
      .forEach(el => {
        el.checked = false;
      });

    // ✅ Trip Length（Days）のmin/maxを全データから再計算
    const dayValues = allData
      .map(r => r.fields.Days)
      .filter(v => typeof v === 'number' && !isNaN(v));

    if (dayValues.length > 0) {
      const newMin = Math.min(...dayValues);
      const newMax = Math.max(...dayValues);

      const tripSlider = document.getElementById('trip-length-slider');
      if (tripSlider && tripSlider.noUiSlider) {

        // スライダーのレンジ更新
        tripSlider.noUiSlider.updateOptions({
          range: {
            min: newMin,
            max: newMax
          }
        });

        // スライダーのつまみ位置を初期位置に戻す
        tripSlider.noUiSlider.set([newMin, newMax]);

        // 表示テキストも更新
        document.getElementById('trip-length-min').textContent = `${newMin} day`;
        document.getElementById('trip-length-max').textContent = `${newMax} day`;
      }
    }

    // ✅ 検索フォームも初期化
    document.getElementById('search-keyword').value = '';
    
    // ✅ フィルターを再適用
    applyFilter();
  });
}

/**
 * Airtableから取得したレコードとスタイル別ロゴのマップをもとに、
 * ツアーカードのDOM要素を生成して返す関数。
 *
 * @param {Object} record - Airtableの1件分のツアーデータレコード
 * @param {Object} logoMap - Style IDとロゴURLをマッピングしたオブジェクト
 * @returns {DocumentFragment} - 複製されたツアーカードのDOMフラグメント
 */
function createTourCardElement(record, logoMap) {
  const f = record.fields;
  const template = document.getElementById('tour-card-template');
  const clone = template.content.cloneNode(true); // テンプレートを複製

  console.log('f', f); // デバッグ用：レコード内容を確認

  const newLabel = clone.querySelector(".new-label");
  if (newLabel) {
    if (f["New"] === true) {
      newLabel.style.display = "block";
    } else {
      newLabel.style.display = "none";
    }
  }
  
  const campLabel = clone.querySelector(".camp-label");
  if (campLabel) {
    if (f["Campaign"] === true) {
      campLabel.style.display = "block";
    } else {
      campLabel.style.display = "none";
    }
  }

  // -----------------------------
  // メイン画像の設定
  // -----------------------------
  const images = f.Images || [];
  const imageUrl = (Array.isArray(images) && images.length > 0)
    ? images[0].thumbnails?.full?.url || images[0].url
    : '';
  const imageEl = clone.querySelector('.tour-image');
  if (imageUrl && imageEl) imageEl.src = imageUrl;
  else if (imageEl) imageEl.remove(); // 画像がなければ要素を削除

  // -----------------------------
  // ロゴ画像の設定（Style参照）
  // -----------------------------
  const styleId = f["Style"]?.[0];
  const logoUrl = logoMap[styleId] || '';
  const logoEl = clone.querySelector('.tour-logo');
  if (logoUrl && logoEl) logoEl.src = logoUrl;
  else if (logoEl) logoEl.remove(); // ロゴがなければ要素を削除

  // -----------------------------
  // ツアータイトル・スタイル名（番号除去）
  // -----------------------------
  clone.querySelector('.tour-title').textContent = f.Name || '';

  // "1. Something" → "Something" に変換
  const rawStyleName = f["Name (from Style)"]?.[0] || '';
  const cleanedStyleName = rawStyleName.replace(/^\d+\.\s*/, '');
  clone.querySelector('.tour-style').textContent = cleanedStyleName;

  /*
  // -----------------------------
  // 日付表示（カスタムテキスト優先）
  // -----------------------------
  const startDate = f["Tour Start Date (from Inquiry)"]?.[0] || f["Start Date"];
  const endDate = f["Tour End Date (from Inquiry)"]?.[0] || f["End Date"];
  const dateText = f["Tour Date Text (from Inquiry)"]?.[0] || '';
  const dateEl = clone.querySelector('.tour-dates');
  if (dateText) {
    dateEl.textContent = dateText; // カスタムテキスト優先
  } else {
    dateEl.textContent = `${formatDateVerbose(startDate)} - ${formatDateVerbose(endDate)}`;
  }
*/

  // -----------------------------
  // ツアー日数表示
  // -----------------------------
  clone.querySelector('.tour-length').innerHTML  = `<strong>${f.Days || ''}</strong> DAYS <strong>${f.Nights || ''}</strong> NIGHTS`;

  /*
  // -----------------------------
  // 価格表示（テキスト or 数値）
  // -----------------------------
  const priceText = f["Price Text (from Inquiry)"]?.[0] || '';
  const priceArray = f["Price (Adult) (from Inquiry)"];
  const raw = Array.isArray(priceArray) && priceArray.length > 0 ? priceArray[0] : '';
  const numeric = parseFloat(raw.toString().replace(/[^\d.]/g, ''));
  const priceFormatted = isNaN(numeric)
    ? raw
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(numeric);
  const priceEl = clone.querySelector('.tour-price');
  priceEl.innerHTML = priceText || `from <strong>${priceFormatted}</strong> per person`;
*/
  
  const primary = f["Primary (from Inquiry)"]?.[0] || "";
  const parsed = parsePrimaryField(primary);

  // 日付差し込み
  const dateEl = clone.querySelector('.tour-dates');
  if (dateEl) {
    dateEl.textContent = parsed.dateText || "";
  }

  // 価格差し込み
  const priceEl = clone.querySelector('.tour-price');
  if (priceEl) {
    priceEl.innerHTML = parsed.priceHtml || "";
  }

  // -----------------------------
  // 詳細リンクの設定
  // -----------------------------
  const linkEl = clone.querySelector('a.btn');
  if (linkEl) {
    const pdfArray = f.PDF;
    const pdfUrl = Array.isArray(pdfArray) && pdfArray.length > 0 ? pdfArray[0].url : '';
    const isExternal = !!(f.URL || pdfUrl); // 外部リンク判定
    const href = f.URL || pdfUrl || `tour-details?tid=${record.id}`;

    // アイコン画像（赤と白）を外部／内部リンクで切り替え
    const redIcon = isExternal
      ? 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/687fe53ee93aa36b8503d408_arrow-up-right-from-square-regular-full-red.svg'
      : 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/687fe4d5ddfd614d8bec3764_arrow-right-regular-full-red.svg';

    const whiteIcon = isExternal
      ? 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/6882d379e9ce953474fff05f_arrow-up-right-from-square-regular-full-white.svg'
      : 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/6882d37975de70d79974a06c_arrow-right-regular-full-white.svg';

    linkEl.href = href;

    // target属性を明示的に初期化
    if (isExternal) {
      linkEl.target = "_blank";
      linkEl.rel = "noopener noreferrer"; // セキュリティ対策として追加推奨
    } else {
      linkEl.removeAttribute('target'); // 明示的に削除
      linkEl.removeAttribute('rel');
    }

    linkEl.innerHTML = `
      View Itinerary
      <span class="red"><img src="${redIcon}" alt=""></span>
      <span class="white"><img src="${whiteIcon}" alt=""></span>
    `;
  }

  return clone; // 完成したDOMノードを返す
}

function parsePrimaryField(primaryText) {
  const result = {
    priceHtml: '',     // for innerHTML
    dateText: '',      // for textContent
  };

  if (!primaryText || !primaryText.trim()) return result;

  // --- 分割: 価格 : 日付形式（:が含まれるか確認）
  const parts = primaryText.split(":").map(p => p.trim());

  const pricePart = parts[0] || '';
  const datePart = parts[1] || '';

  // --- 価格の整形
  if (pricePart.startsWith("$")) {
    const numeric = parseFloat(pricePart.replace(/[^\d.]/g, ''));
    if (!isNaN(numeric)) {
      result.priceHtml = `from <strong>$${numeric.toLocaleString()}</strong> per person`;
    } else {
      result.priceHtml = pricePart; // フォールバック
    }
  } else if (pricePart) {
    result.priceHtml = pricePart;
  }

  // --- 日付の整形
  if (datePart) {
    // "YYYY-MM-DD - YYYY-MM-DD" や "YYYY-MM-DD -" に対応
    const match = datePart.match(/^(\d{4}-\d{2}-\d{2})(?:\s*-\s*(\d{4}-\d{2}-\d{2})?)?$/);
    if (match) {
      const start = match[1];
      const end = match[2] || match[1]; // 終了日がなければ開始日だけ
      result.dateText = formatTourDateRange(start, end);
    } else {
      result.dateText = datePart; // e.g. "All year round"
    }
  }

  return result;
}

/**
 * ページURLやhiddenフィールドから条件を取得し、
 * Airtableからツアーデータを取得してカルーセルに表示する関数
 *
 * @param {string} containerId - ツアーカードを描画するDOMコンテナのID
 */
async function fetchRecommendedTours(containerId) {
  let all = [];
  let offset = null;
  let done = false;

  try {
    // -----------------------------
    // URLクエリパラメータの取得
    // -----------------------------
    const urlParams = new URLSearchParams(window.location.search);
    const recordId = urlParams.get('tid');
    const recordDestination = urlParams.get('destination');

    let encodedDestinations;
    let encodedKeyword;

    // recordIdがある場合、該当ツアーからDestination情報を抽出
    if (recordId) {
      const Tour = await fetchTour(recordId);
      //encodedDestinations = extractUniqueDestinations(Tour.records);
      console.log('Tour', Tour);
      //console.log('records', Tour.records[0]);
      styleId = Tour.records[0].fields['ID (from Style)'][0];
      console.log('styleId', styleId);
    }

    // destinationクエリパラメータがある場合はそれを利用
    if (recordDestination) {
      encodedDestinations = recordDestination;
    }

    // -----------------------------
    // hidden inputからの取得
    // -----------------------------
    const hiddenDestinationElement = document.getElementById('destination');
    const hiddenDestination = hiddenDestinationElement ? hiddenDestinationElement.value : null;
    if (hiddenDestination) {
      encodedDestinations = encodeURIComponent(hiddenDestination);
    }

    const hiddenkeywordElement = document.getElementById('keyword');
    const hiddenkeyword = hiddenkeywordElement ? hiddenkeywordElement.value : null;
    if (hiddenkeyword) {
      encodedKeyword = encodeURIComponent(hiddenkeyword);
    }

    // -----------------------------
    // Airtableからデータをフェッチ（複数ページに対応）
    // -----------------------------
    while (!done) {
      let url = `${apiBaseUrl}?table=1`;

      // 条件に応じたフィルターパラメータを構築
      if (recordId) {
        //url += `&filterField=${encodeURIComponent("ID (from Style)")}&filterValue=1`;
        //url += `&filterField2=${encodeURIComponent("Destination")}&filterValue2=${encodedDestinations}`;
        url += `&filterField=${encodeURIComponent("ID (from Style)")}&filterValue=${styleId}`;
      } else if (recordDestination) {
        url += `&filterField2=${encodeURIComponent("Destination")}&filterValue2=${encodeURIComponent(encodedDestinations)}`;
      } else if (hiddenDestination) {
        url += `&filterField2=${encodeURIComponent("Destination")}&filterValue2=${encodeURIComponent(encodedDestinations)}`;
      } else if (hiddenkeyword) {
        url += `&filterField2=${encodeURIComponent("Name")}&filterValue2=${encodeURIComponent(encodedKeyword)}`;
      } else {
        url += `&filterField=Recommended&filterValue=true`; // デフォルト：おすすめツアー
      }

      // ページング対応
      if (offset) url += `&offset=${offset}`;

      // API呼び出し
      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.text();
        console.error(`API error: ${res.status}\n${err}`);
        return;
      }

      const data = await res.json();

      if (!data.records) {
        console.error("Invalid format received from Airtable");
        return;
      }

      if(recordId){
        // recordId を除外
        const filtered = data.records.filter(r => r.id !== recordId);

        // データを蓄積し、次ページのためのoffset取得
        all.push(...filtered);
      }else{
        // データを蓄積し、次ページのためのoffset取得
        all.push(...data.records);
      }

      offset = data.offset;
      done = !offset; // offsetが存在しない＝最後のページ
    }

    const shuffled = shuffleArray(all);

    // -----------------------------
    // ツアーカードの描画
    // -----------------------------
    renderRecommendedCarousel(shuffled, containerId);

    // ★ 描画が終わったら自動ループ開始
    //setupReverseLoopScroll(containerId, 4, 4000);
    //setupTransformCarousel(containerId, 4, 4000);
    //setupTransformCarouselFallback(containerId, 4, 4000);
  } catch (e) {
    console.error("Failed to fetch data:", e);
  }
}

/**
 * Airtable の Style テーブル（table=2）からスタイルIDとロゴ画像のマッピングを取得する関数
 * @returns {Promise<Object>} スタイルIDをキー、ロゴ画像URLを値とするマップ（例: { "recXXXX": "https://..." }）
 */
async function fetchStyles() {
  try {
    // Airtable API の URL を生成（table=2 は Style テーブルを指す）
    let url = `${apiBaseUrl}?table=2`;

    // データを取得
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      console.error(`API error: ${res.status}\n${err}`);
      return;
    }

    // JSON に変換
    const data = await res.json();

    // 結果を格納するマップ（key: record ID, value: logo URL）
    const logoMap = {};

    // 各レコードをループしてロゴ画像のURLを抽出
    data.records.forEach(record => {
      const id = record.id;
      const logoArray = record.fields.Logo;

      // ロゴが配列として存在し、少なくとも1つある場合
      if (Array.isArray(logoArray) && logoArray.length > 0) {
        const fullThumb = logoArray[0]?.thumbnails?.full?.url;
        if (fullThumb) {
          logoMap[id] = fullThumb;
        }
      }
    });

    return logoMap;
  } catch (e) {
    console.error("Failed to fetch data:", e);
  }
}

/**
 * 指定されたレコードIDに一致するツアー情報を Airtable の Tour テーブル（table=1）から取得する関数
 * @param {string} recordId - Airtable のレコードID（例: "recXXXXXXXXXXXXX"）
 * @returns {Promise<Object>} ツアーデータオブジェクト（例: { records: [...] }）
 */
async function fetchTour(recordId) {
  try {
    // Airtable API のエンドポイント（Tour テーブル: table=1）
    let url = `${apiBaseUrl}?table=1`;

    // RECORD_ID() を使用したフィルターを追加
    url += `&filterField=RECORD_ID()&filterValue=${recordId}`;

    // データ取得
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text();
      console.error(`API error: ${res.status}\n${err}`);
      return;
    }

    // JSON に変換して返す
    const data = await res.json();
    return data;
  } catch (e) {
    console.error("Failed to fetch data:", e);
  }
}

/**
 * おすすめツアーをランダムな順番でカルーセル要素に描画する関数
 * @param {Array} tours - Airtableから取得したツアーの配列
 * @param {string} containerId - ツアーカードを描画する対象HTML要素のID
 */
async function renderRecommendedCarousel(tours, containerId) {
  const container = document.getElementById(containerId);
  container.innerHTML = ''; // 既存の内容をクリア

  const logoMap = await fetchStyles(); // スタイルIDとロゴ画像URLのマップを取得

  const shuffled = shuffleArray(tours); // ツアーをランダムに並び替え

  shuffled.forEach(record => {
    const card = createTourCardElement(record, logoMap); // 各ツアーのカード要素を作成
    container.appendChild(card); // カードをカルーセルに追加
  });
}

async function renderTourDetail(recordId) {
  // recordIdがある場合、該当ツアーからDestination情報を抽出
  if (recordId) {
    const Tour = await fetchTour(recordId);
    console.log('Tour', Tour);
    
    const fields = Tour?.records?.[0]?.fields;
    if (!fields) return;

    if (fields?.Interest?.length) {
      const keywordsEl = document.querySelector(".tour-tags .keywords");
      if (keywordsEl) {
        keywordsEl.textContent = fields.Interest.join(" | ");
      }
    }

    // パンくずにタイトルをセット
    const bread = document.getElementById("tour-bread");
    if (bread && fields.Name) {
      bread.textContent = fields.Name;
    }

    // タイトルを <h1> にセット
    const titleElement = document.querySelector(".tour-header h1");
    if (titleElement && fields.Name) {
      titleElement.textContent = fields.Name;
    }

    // ★ Name (from Style) を pill にセット
    const pillContainer = document.querySelector(".tour-tags .pill");
    if (pillContainer && fields["Name (from Style)"]?.length > 0) {
      const rawStyleName = fields["Name (from Style)"]?.[0] || '';
      pillContainer.textContent = rawStyleName.replace(/^\d+\.\s*/, '');
    }

    const heroImagesContainer = document.querySelector(".hero-images");
    if (heroImagesContainer && fields.Images?.length > 0) {
      heroImagesContainer.innerHTML = ""; // 既存のimgをクリア

      fields.Images.forEach(image => {
        const url = image.thumbnails?.full?.url || image.url;
        const alt = image.filename.replace(/\.[^/.]+$/, ""); // 拡張子を除く
        const img = document.createElement("img");
        img.src = url;
        img.alt = alt;
        heroImagesContainer.appendChild(img);
      });
    }

    const highlightsSection = document.querySelector(".tour-highlights");
    if (highlightsSection) {
      // --- ULリストに Highlights をセット ---
      const ul = highlightsSection.querySelector("ul");
      if (ul && fields.Highlights) {
        // 改行で分割 → <li>要素として追加
        const lines = fields.Highlights.split(/\r?\n/).filter(line => line.trim() !== "");
        ul.innerHTML = lines.map(item => `<li>${item}</li>`).join("");
      }

      // --- 説明文を <div> に挿入 ---
      const descriptionDiv = highlightsSection.querySelector("div");
      if (descriptionDiv && fields["Highlights - Description"]) {
        descriptionDiv.textContent = fields["Highlights - Description"].replace(/\\\*/g, "*");
      }

      // --- 地図画像を <img> に挿入 ---
      const mapImg = highlightsSection.querySelector("img");
      if (mapImg && fields["Highlights - Image"]?.length > 0) {
        const imgObj = fields["Highlights - Image"][0];
        mapImg.src = imgObj.thumbnails?.full?.url || imgObj.url;
        mapImg.alt = imgObj.filename.replace(/\.[^/.]+$/, "");
      }
    }

    const descIds = fields.Description;
    if (Array.isArray(descIds) && descIds.length > 0) {
      console.log('descIds', descIds);

      await renderTourDescriptions(descIds);
    }

    // ★ Itinerary の描画を追加
    const itiIds = fields.Itinerary;
    if (Array.isArray(itiIds) && itiIds.length > 0) {
      await renderTourItinerary(itiIds, 4);
    }

    // Feature & Remarks を反映
    await renderFeatureAndRemarks(fields, 5);

    // ★ サイドバータイトルに Name をセット
    const sidebarTitle = document.querySelector(".sidebar .title");
    if (sidebarTitle && fields.Name) {
      sidebarTitle.textContent = fields.Name;
    }

    // ★ サイドバーのタグに Style 名をセット
    const sidebarTag = document.querySelector(".sidebar .tag");
    if (sidebarTag && fields["Name (from Style)"]?.length > 0) {
      const rawStyleName = fields["Name (from Style)"]?.[0] || '';
      sidebarTag.textContent = rawStyleName.replace(/^\d+\.\s*/, '');
    }
    
    // ★ サイドバーの Day/Night 情報をセット
    const dayNightElement = document.querySelector(".sidebar .day");
    if (dayNightElement && fields.Days && fields.Nights) {
      dayNightElement.innerHTML = `<strong>${fields.Days}</strong> DAYS <strong>${fields.Nights}</strong> NIGHTS`;
    }

    // ★ 出発地を差し込み
    const departureCityEl = document.querySelector(".sidebar .departure_city strong");
    if (departureCityEl && fields["Departure City"]) {
      departureCityEl.textContent = fields["Departure City"];
    }
    
    // ★ ツアーナンバーを差し込み
    const tourNumberEl = document.querySelector(".sidebar .tour_number strong");
    if (tourNumberEl && fields["Tour Number"]) {
      tourNumberEl.textContent = fields["Tour Number"];
    }
    
    // ★ Inquiry 情報の描画を追加
    const inquiryIds = fields.Inquiry;

    document.querySelector(".inquiry-btn")?.addEventListener("click", () => {
      const recordId = Tour?.records?.[0]?.id;
      if (recordId) {
        window.location.href = `./contact?tid=${encodeURIComponent(recordId)}`;
      }
    });

    console.log('fields.Inquiry', fields.Inquiry);

    if (Array.isArray(inquiryIds) && inquiryIds.length > 0) {
      await renderInquiryDetails(inquiryIds);
    }      
  }
}

function sortRecordsByIdOrder(records, orderedIds) {
  const idToRecordMap = new Map(records.map(r => [r.id, r]));
  return orderedIds.map(id => idToRecordMap.get(id)).filter(Boolean);
}

async function renderInquiryDetails(inquiryIds) {
  const inquiryContainer = document.querySelector(".sidebar .inquiry");
  if (!inquiryContainer) return;

  inquiryContainer.innerHTML = ""; // 一旦リセット

  const records = await fetchByRecordIds(6, inquiryIds); // テーブル番号3: Inquiry
  const inquiries = sortRecordsByIdOrder(records, inquiryIds)

  inquiries.forEach(record => {
    const inf = record.fields;

    // --- 日付の整形 ---
    let dateText = "";
    if (inf["Tour Start Date"] && inf["Tour End Date"]) {
      dateText = formatTourDateRange(inf["Tour Start Date"], inf["Tour End Date"]);
    } else if (inf["Tour Date Text"]) {
      dateText = inf["Tour Date Text"];
    }

    // --- 価格の整形 ---
    let priceText = "";
    if (inf["Price (Adult)"]) {
      const price = Number(inf["Price (Adult)"]).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      priceText = `from <strong>$${price}</strong> per person`;
    } else if (inf["Price Text"]) {
      priceText = inf["Price Text"];
    }

    // --- DOM に差し込み ---
    inquiryContainer.innerHTML += `
      <p class="tour_date">${dateText}</p>
      <p class="tour_price">${priceText}</p>
      <hr>
    `;
  });
}

function formatTourDateRange(start, end) {
  const parseLocalDate = (dateStr) => {
    const [year, month, day] = dateStr.split("-").map(Number);
    return new Date(year, month - 1, day); // ローカルタイムとして作成（ズレない）
  };

  const startDate = parseLocalDate(start);
  const endDate = parseLocalDate(end);

  const startStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short"
  });
  const endStr = endDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short"
  });

  return `${startStr} - ${endStr}, ${endDate.getFullYear()}`;
}

// サムネ優先URL
function pickAttachmentUrl(att) {
  if (!att) return "";
  const t = att.thumbnails || {};
  return t.full?.url || t.large?.url || t.small?.url || att.url || "";
}

// 拡張子除去
function fileNameWithoutExt(name = "") {
  return String(name).replace(/\.[^/.]+$/, "");
}

// ---- 共通: RECORD_ID() + カンマ区切りでまとめ取得（vercel proxy仕様）----
async function fetchByRecordIds(tableNumber, ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const idParam = encodeURIComponent(ids.join(','));

  let all = [];
  let offset = null;
  let guard = 0;
  do {
    let url = `${apiBaseUrl}?table=${tableNumber}&filterField=RECORD_ID()&filterValue=${idParam}`;
    if (offset) url += `&offset=${offset}`;

    const res = await fetch(url);
    if (!res.ok) {
      console.error(`Airtable API error ${res.status}: ${await res.text()}`);
      break;
    }
    const data = await res.json();
    all.push(...(data?.records || []));
    offset = data?.offset;
    guard++;
  } while (offset && guard < 50);

  return all;
}

/**
 * Feature/Remarks の差し込み
 * @param {Object} fields - Tour の fields オブジェクト
 * @param {number} remarksTableNumber - Remarks テーブル番号（例: 4）※実環境に合わせて
 */
async function renderFeatureAndRemarks(fields, remarksTableNumber = 2) {
  // -------- Feature --------
  const featureSection = document.querySelector('.feature');
  if (featureSection) {
    const depWrap = featureSection.querySelector('.departure_date');
    const arrWrap = featureSection.querySelector('.arrangement');

    // Departure Date
    const depP = depWrap?.querySelector('p');
    if (depP) {
      const depText = fields["Feature - Departure Date"] || "";
      if (String(depText).trim()) {
        depP.textContent = depText;
        depWrap.style.display = "";
      } else {
        // 空ならブロックごと非表示（常に見せたいならこの行を外す）
        depWrap.style.display = "none";
      }
    }

    // Type of travel arrangement
    const arrP = arrWrap?.querySelector('p');
    if (arrP) {
      const arrText = fields["Feature - Type of travel arrangement"] || "";
      if (String(arrText).trim()) {
        arrP.textContent = arrText;
        arrWrap.style.display = "";
      } else {
        arrWrap.style.display = "none";
      }
    }
  }

  // -------- Remarks --------
  const remarksSection = document.querySelector('.remarks');
  if (!remarksSection) return;

  const ol = remarksSection.querySelector('ol');
  if (!ol) return;

  // 既存の li をクリア
  ol.innerHTML = "";

  const remarkIds = fields.Remarks;
  if (!Array.isArray(remarkIds) || remarkIds.length === 0) {
    // 何も無ければセクションを隠す（必要なら見出しだけ残すように変更可能）
    remarksSection.style.display = "none";
    return;
  }

  // Remarks テーブルから一括取得
  let recs = await fetchByRecordIds(remarksTableNumber, remarkIds);

  // Tour 側のリンク順を維持（Airtableは順不同で返ることがある）
  const orderMap = new Map(remarkIds.map((id, idx) => [id, idx]));
  recs.sort((a, b) => (orderMap.get(a.id) ?? 9999) - (orderMap.get(b.id) ?? 9999));

  // Content っぽいフィールド名をフォールバックで拾う
  recs.forEach(rec => {
    const f = rec.fields || {};
    const content =
      f.Content ||
      f["Content (from Remarks)"] ||
      f.Remark ||
      f.Note ||
      "";

    const text = String(content || "").trim();
    if (!text) return;

    const li = document.createElement('li');
    // 改行を可視化（不要なら textContent に）
    li.innerHTML = text.replace(/\r?\n/g, "<br>");
    ol.appendChild(li);
  });

  // すべて空だった場合はセクションを隠す
  if (!ol.children.length) {
    remarksSection.style.display = "none";
  } else {
    remarksSection.style.display = "";
  }
}

/**
 * Itinerary の ID 配列から Day/Title/Detail/Image/Accommodation/Meal/Transportaion/Note を取得し、
 * <section class="tour-itinerary"> 内の .day テンプレを複製して差し込む。
 *
 * @param {string[]} itineraryIds  Tour.fields.Itinerary の ID 配列
 * @param {number} tableNumber     Itinerary テーブル番号（例: 2）※実環境に合わせて
 */

async function renderTourItinerary(itineraryIds = [], tableNumber = 2) {
  if (!Array.isArray(itineraryIds) || itineraryIds.length === 0) return;

  let records = await fetchByRecordIds(tableNumber, itineraryIds);
  records.sort((a, b) => {
    const da = Number(a?.fields?.Day ?? Infinity);
    const db = Number(b?.fields?.Day ?? Infinity);
    return da - db;
  });

  const section = document.querySelector(".tour-itinerary");
  if (!section) return;

  let dayTpl = section.querySelector(".day.day-template");
  if (!dayTpl) return;

  dayTpl.hidden = true; // テンプレート自体は非表示のまま

  // 既存の .day（テンプレート以外）を削除
  section.querySelectorAll(".day:not(.day-template)").forEach(el => el.remove());

  for (const rec of records) {
    const f = rec.fields || {};
    const node = dayTpl.cloneNode(true);
    node.classList.remove("day-template");
    node.hidden = false;

    const dayNum = f.Day != null ? String(f.Day) : "";
    const title = f.Title || f.Name || "";
    const detail = f.Details || "";

    const accText = f.Accommodation || "";
    const mealText = f.Meal || f.Meals || "";
    const trspText = f.Transportaion || f.Transportation || "";
    const noteText = f.Note || f.Notes || "";

    const images =
      f["Itinerary Images"] || f.Images || f.Image || [];
    const imageList = Array.isArray(images) ? images : [];

    // 見出し
    const h3 = node.querySelector(".day-content h3");
    if (h3) {
      h3.textContent = `DAY ${dayNum}${title ? ` ${title}` : ""}`;
    }

    // 詳細
    const descP = node.querySelector(".day-content p");
    if (descP) {
      descP.innerHTML = String(detail).replace(/\r?\n/g, "<br>");
    }

    // 画像
    const picsContainer = node.querySelector(".day-pics");
    if (picsContainer) {
      picsContainer.innerHTML = ""; // 既存クリア
      imageList.forEach(att => {
        const url = pickAttachmentUrl(att);
        const alt = att?.filename ? fileNameWithoutExt(att.filename) : "";
        if (url) {
          const fig = document.createElement("figure");
          fig.className = "day-pic";
          fig.innerHTML = `
            <img src="${url}" alt="${alt}" loading="lazy">
            <figcaption>${alt}</figcaption>
          `;
          picsContainer.appendChild(fig);
        }
      });
    }

    // 補足項目差し込み
    const setField = (selector, content, fallbackSelector = "p") => {
      const wrap = node.querySelector(selector);
      if (!wrap) return;
      const text = String(content || "").trim();
      if (!text) {
        wrap.style.display = "none";
        return;
      }
      const p = wrap.querySelector(fallbackSelector);
      if (p) p.innerHTML = text.replace(/\r?\n/g, "<br>");
      wrap.style.display = "";
    };

    setField(".accommodation", accText);
    setField(".meal", mealText);
    setField(".transportaion", trspText);
    setField(".note", noteText);

    // すべての補足項目が空なら day-additional 全体を非表示
    const hasAdditionalInfo = [accText, mealText, trspText, noteText].some(val => String(val || "").trim());
    const additionalWrap = node.querySelector(".day-additional");
    if (additionalWrap) {
      additionalWrap.style.display = hasAdditionalInfo ? "" : "none";
    }

    section.appendChild(node);
  }
}

/*
async function renderTourItinerary(itineraryIds = [], tableNumber = 2) {
  if (!Array.isArray(itineraryIds) || itineraryIds.length === 0) return;

  // 取得 → Day 昇順
  let records = await fetchByRecordIds(tableNumber, itineraryIds);
  records.sort((a, b) => {
    const da = Number(a?.fields?.Day ?? Infinity);
    const db = Number(b?.fields?.Day ?? Infinity);
    return da - db;
  });

  const section = document.querySelector(".tour-itinerary");
  if (!section) return;

  // ---- .day テンプレを確保（最初の1つをひな形化）----
  let dayTpl = section.querySelector(".day.day-template");
  if (!dayTpl) {
    dayTpl = section.querySelector(".day");
    if (!dayTpl) {
      // 万一 .day が無ければ、骨組みを作る（保険）
      dayTpl = document.createElement("div");
      dayTpl.className = "day";
      dayTpl.innerHTML = `
        <h3></h3>
        <p></p>
        <img src="" alt="">
        <div class="accommodation">ACCOMMODATION:<p></p></div>
        <div class="meal">MEAL:<p></p></div>
        <div class="transportaion">Transportaion:<p></p></div>
        <div class="note">Note:<p></p></div>`;
      section.appendChild(dayTpl);
    }
    dayTpl.classList.add("day-template");
    dayTpl.hidden = true;
  }

  // ---- 既存の出力（テンプレ以外の .day）を削除 ----
  Array.from(section.querySelectorAll(".day:not(.day-template)")).forEach(n => n.remove());

  // ---- 差し込み ----
  records.forEach(rec => {
    const f = rec.fields || {};

    const dayNum = f.Day != null ? String(f.Day) : "";
    const title  = f.Title || f.Name || "";
    const detail = f.Details || "";

    // 画像（Images / Image / Itinerary Images のいずれか）
    const imageArray =
      (Array.isArray(f.Images) && f.Images.length ? f.Images : null) ||
      (Array.isArray(f.Image) && f.Image.length ? f.Image : null) ||
      (Array.isArray(f["Itinerary Images"]) && f["Itinerary Images"].length ? f["Itinerary Images"] : null) ||
      [];
    const att    = imageArray[0];
    const imgUrl = pickAttachmentUrl(att);
    const imgAlt = att?.filename ? fileNameWithoutExt(att.filename) : (dayNum ? `Day ${dayNum}` : "Itinerary");

    // 付帯情報
    const accText  = f.Accommodation || f["Accommodation"] || "";
    const mealText = f.Meal || f["Meals"] || "";
    const trspText = f.Transportaion || f.Transportation || f["Transportaion"] || f["Transportation"] || "";
    const noteText = f.Note || f.Notes || "";

    // テンプレ複製
    const node = dayTpl.cloneNode(true);
    node.classList.remove("day-template");
    node.hidden = false;

    // 見出し
    const h3 = node.querySelector("h3");
    if (h3) h3.textContent = `Day ${dayNum}${title ? `: ${title}` : ""}`;

    // 本文（Detail）
    const p = node.querySelector(":scope > p");

    if (p) {
      // 改行を活かすなら： p.innerHTML = String(detail).replace(/\r?\n/g, "<br>");
      p.textContent = detail;
    }

    // 画像
    const img = node.querySelector(":scope > img");
    if (imgUrl && img) {
      img.src = imgUrl;
      img.alt = imgAlt;
      img.loading = "lazy";
    } else if (img) {
      img.remove(); // 画像が無ければ削除
    }

    // テキストを <div> 内の <p> に差し込むヘルパー
    const setInfo = (selector, text) => {
      const wrap = node.querySelector(selector);
      if (!wrap) return;
      const content = String(text || "").trim();
      if (!content) {
        // 中身が空なら、そのブロックごと非表示
        wrap.style.display = "none";
        return;
      }
      const pp = wrap.querySelector("p");
      if (pp) {
        // 改行は <br> に
        pp.innerHTML = content.replace(/\r?\n/g, "<br>");
      }
      wrap.style.display = ""; // 念のため表示
    };

    // 付帯情報差し込み（.day の内側）
    setInfo(".accommodation",  accText);
    setInfo(".meal",           mealText);
    setInfo(".transportaion",  trspText); // クラス名はご提示の綴りに合わせています
    setInfo(".note",           noteText);

    section.appendChild(node);
  });
}
*/

// 添付1件から最適なURLを取り出す（full -> large -> small -> url）
function pickAttachmentUrl(att) {
  if (!att) return "";
  const t = att.thumbnails || {};
  return t.full?.url || t.large?.url || t.small?.url || att.url || "";
}

// ファイル名から拡張子を除く
function fileNameWithoutExt(name = "") {
  return String(name).replace(/\.[^/.]+$/, "");
}

// ← 'sync function' ではなく async に修正
async function fetchDescriptionBlocks(descriptionIds) {
  if (!Array.isArray(descriptionIds) || descriptionIds.length === 0) return [];

  // カンマ区切りをまとめてエンコード
  const idParam = encodeURIComponent(descriptionIds.join(","));

  let all = [];
  let offset = null;
  let guard = 0;

  do {
    const url = `${apiBaseUrl}?table=3&filterField=RECORD_ID()&filterValue=${idParam}` + (offset ? `&offset=${offset}` : "");
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch descriptions");
      return [];
    }
    const data = await res.json();
    all.push(...(data.records || []));
    offset = data.offset;
    guard++;
  } while (offset && guard < 50);

  // ID順に並べ替え（descIdsの順序を尊重）
  all.sort((a, b) => descriptionIds.indexOf(a.id) - descriptionIds.indexOf(b.id));
  return all;
}

async function renderTourDescriptions(descriptionIds) {
  const blocks = await fetchDescriptionBlocks(descriptionIds);
  const section = document.querySelector(".description-section");
  if (!section) return;

  // --- テンプレ確保（最初の .description-block を雛形化）---
  let template = section.querySelector(".description-block.description-template");
  if (!template) {
    template = section.querySelector(".description-block");
    if (!template) {
      // スケルトンが無い場合は生成（念のため）
      template = document.createElement("div");
      template.className = "description-block";
      template.innerHTML = `
        <h2></h2>
        <div class="image-text">
          <img src="" alt="">
          <div><p></p></div>
        </div>`;
      section.appendChild(template);
    }
    template.classList.add("description-template");
    template.hidden = true;
  }

  // 既存のテンプレ以外の description-block を削除（毎回作り直し）
  Array.from(section.querySelectorAll(".description-block:not(.description-template)")).forEach(n => n.remove());

  // --- ブロック差し込み ---
  blocks.forEach(record => {
    const f = record.fields || {};

    const title = f.Name || f["Name (from Description)"] || f.Title || "";
    // Contentを段落に分割（空行は除外）
    const contentRaw = f.Content || f["Content (from Description)"] || "";
    const lines = String(contentRaw).split(/\r?\n/).map(s => s.trim()).filter(Boolean);

    // 画像（Image / Images / Image (from Description) のいずれか）
    const imageArr =
      (Array.isArray(f.Image) && f.Image.length ? f.Image : null) ||
      (Array.isArray(f.Images) && f.Images.length ? f.Images : null) ||
      (Array.isArray(f["Image (from Description)"]) && f["Image (from Description)"].length ? f["Image (from Description)"] : null) ||
      [];
    const att = imageArr[0];
    const imgUrl = pickAttachmentUrl(att);
    const imgAlt = att?.filename ? fileNameWithoutExt(att.filename) : (title || "Description");

    // テンプレ複製
    const node = template.cloneNode(true);
    node.classList.remove("description-template");
    node.hidden = false;

    // h2
    const h2 = node.querySelector("h2");
    if (h2) h2.textContent = title;

    // 画像とテキストエリア（image-text）
    const wrapper = node.querySelector(".image-text");
    const img = wrapper ? wrapper.querySelector("img") : null;
    const textDiv = wrapper ? wrapper.querySelector("div") : null;

    // 画像
    if (imgUrl && img) {
      img.src = imgUrl;
      img.alt = imgAlt;
      img.loading = "lazy";
    } else if (img) {
      // 画像無し → <img> を削除し、ブロックにクラスを付ける（CSSで縦並びなどに）
      img.remove();
      node.classList.add("no-image");
    }

    // テキスト（pを差し替え）
    if (textDiv) {
      textDiv.innerHTML = ""; // 既存pをクリア
      lines.forEach(line => {
        const p = document.createElement("p");
        // Airtable由来の \* を * に戻す処理（必要な場合）
        p.textContent = line.replace(/\\\*/g, "*");
        textDiv.appendChild(p);
      });
    }

    section.appendChild(node);
  });
}

/**
 * 配列の要素をランダムにシャッフルする関数（Fisher-Yates風）
 * @param {Array} array - シャッフル対象の配列
 * @returns {Array} シャッフルされた配列
 */
function shuffleArray(array) {
  return array
    .map((value) => ({ value, sort: Math.random() })) // 各要素にランダムなソートキーを付与
    .sort((a, b) => a.sort - b.sort)                  // ソートキーで並び替え
    .map(({ value }) => value);                       // 元の値だけ取り出して返却
}

/**
 * ツアーデータから一意なDestination（目的地）一覧を抽出して、
 * カンマ区切りでまとめ、URLエンコードされた文字列として返す
 * @param {Array} tours - Airtableのツアーレコード配列
 * @returns {string} encodeURIComponentされた "Tokyo,Kyoto,Nara" のような文字列
 */
function extractUniqueDestinations(tours) {
  const all = tours.flatMap(tour => tour.fields.Destination || []); // すべてのDestinationをまとめる
  const unique = [...new Set(all)]; // 重複を排除して一意にする
  return encodeURIComponent(unique.join(',')); // カンマ区切りで結合し、URLエンコードして返す
}

// 画像ロード待ち（幅0対策）
function waitImagesLoaded(scope) {
  const imgs = scope.querySelectorAll('.tour-card img');
  const jobs = [];
  imgs.forEach(img => {
    if (!img.complete) {
      jobs.push(new Promise(res => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      }));
    }
  });
  return Promise.all(jobs);
}


// Inquiryページへの初期値セット
if (window.location.pathname.includes('/custom-tour-inquiry-form')) {
  (async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const tid = urlParams.get('tid');

    if (!tid) return;

    try {
      const tours = await fetchTour(tid); // tours は配列

      console.log('tourstours', tours)

      console.log('tours:', tours.records);
      if (!Array.isArray(tours.records) || tours.records.length === 0) {
        console.warn('Tour データがありません');
        return;
      }

      const tourName = tours.records[0]?.fields?.Name || '';
      const tourNumber = tours.records[0]?.fields?.['Tour Number'] || '';

      const name = document.querySelector('#name');
      if (name) {
        name.value = tourName;
      }

      const email = document.querySelector('#email');
      if (email) {
        email.value = tourNumber;
      }
    } catch (err) {
      console.error('Tour取得エラー:', err);
    }
  })();
}

