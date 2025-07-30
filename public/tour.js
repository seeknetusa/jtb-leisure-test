const apiBaseUrl = "https://jtb-leisure-test.vercel.app/api/airtable-proxy";
const pageSize = 3;
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

  // -----------------------------
  // ツアー日数表示
  // -----------------------------
  clone.querySelector('.tour-length').innerHTML  = `<strong>${f.Days || ''}</strong> DAYS <strong>${f.Nights || ''}</strong> NIGHTS`;

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

  console.log('record', record);

  // -----------------------------
  // 詳細リンクの設定
  // -----------------------------
  const linkEl = clone.querySelector('a.btn');
  if (linkEl) {
    const pdfArray = f.PDF;
    const pdfUrl = Array.isArray(pdfArray) && pdfArray.length > 0 ? pdfArray[0].url : '';
    const isExternal = !!(f.URL || pdfUrl); // 外部リンク判定
    const href = f.URL || pdfUrl || `?id=${record.id}`;

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
    const recordId = urlParams.get('id');
    const recordDestination = urlParams.get('destination');

    let encodedDestinations;
    let encodedKeyword;

    // recordIdがある場合、該当ツアーからDestination情報を抽出
    if (recordId) {
      const Tour = await fetchTour(recordId);
      encodedDestinations = extractUniqueDestinations(Tour.records);
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
        url += `&filterField=${encodeURIComponent("ID (from Style)")}&filterValue=1`;
        url += `&filterField2=${encodeURIComponent("Destination")}&filterValue2=${encodedDestinations}`;
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

      // データを蓄積し、次ページのためのoffset取得
      all.push(...data.records);
      offset = data.offset;
      done = !offset; // offsetが存在しない＝最後のページ
    }

    // -----------------------------
    // ツアーカードの描画
    // -----------------------------
    renderRecommendedCarousel(all, containerId);

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

    // ① タイトルを <h1> にセット
    const titleElement = document.querySelector(".tour-header h1");
    if (titleElement && fields.Name) {
      titleElement.textContent = fields.Name;
    }

    // ★ Name (from Style) を pill にセット
    const pillContainer = document.querySelector(".tour-tags .pill");
    if (pillContainer && fields["Name (from Style)"]?.length > 0) {
      pillContainer.textContent = fields["Name (from Style)"][0];
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





    const descIds = fields.Description; // ← Linked record フィールド名
    if (Array.isArray(descIds) && descIds.length > 0) {
      console.log('descIds', descIds);

      await renderTourDescriptions(descIds);
    }






  }
}

async function fetchDescriptionBlocks(descriptionIds) {
  const url = `${apiBaseUrl}?table=3&filterField=RECORD_ID()&filterValue=${descriptionIds.join(",")}`;

  const res = await fetch(url);
  if (!res.ok) {
    console.error("Failed to fetch descriptions");
    return [];
  }
  const data = await res.json();

  // ID順に並べ替える
  return data.records.sort(
    (a, b) => descriptionIds.indexOf(a.id) - descriptionIds.indexOf(b.id)
  );
}

async function renderTourDescriptions(descriptionIds) {
  const blocks = await fetchDescriptionBlocks(descriptionIds);
  const descSection = document.querySelector(".description-section");
  if (!descSection) return;

  descSection.innerHTML = "";

  blocks.forEach(record => {
    const fields = record.fields;
    const block = document.createElement("div");
    block.className = "description-block";

    const h2 = document.createElement("h2");
    h2.textContent = fields.Name || "";
    block.appendChild(h2);

    const content = fields.Content || "";
    const paragraphs = content
      .split(/\r?\n/)
      .filter(line => line.trim())
      .map(text => {
        const p = document.createElement("p");
        p.textContent = text.replace(/\\\*/g, "*");
        return p;
      });

    const imageObj = fields.Image?.[0];
    const hasImage = imageObj?.thumbnails?.full?.url || imageObj?.url;

    if (hasImage) {
      const wrapper = document.createElement("div");
      wrapper.className = "image-text";

      const img = document.createElement("img");
      img.src = imageObj.thumbnails.full.url || imageObj.url;
      img.alt = imageObj.filename.replace(/\.[^/.]+$/, "");

      const textDiv = document.createElement("div");
      paragraphs.forEach(p => textDiv.appendChild(p));

      wrapper.appendChild(img);
      wrapper.appendChild(textDiv);
      block.appendChild(wrapper);
    } else {
      paragraphs.forEach(p => block.appendChild(p));
    }

    descSection.appendChild(block);
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

/**
 * transform(translateX) + transition で滑らかに動くカルーセル
 * - containerSelector: 例 '#recommended-carousel'
 * - options: { leftBtn, rightBtn, interval, duration, easing }
 */
async function initSmoothTrackCarousel(containerSelector, {
  leftBtn  = null,
  rightBtn = null,
  interval = 4000,
  duration = 500,
  easing   = 'ease'
} = {}) {

  const root = document.querySelector(containerSelector);
  if (!root) return;

  // 画像がある場合はロード完了を待つ（計測安定化）
  await waitImagesLoaded(root);

  // 既に track があれば再利用。なければ .tour-card だけ包み直す
  let track = root.querySelector('.carousel-track');
  if (!track) {
    // root 直下の .tour-card を収集（※深い階層の場合はセレクタを調整）
    const cards = Array.from(root.querySelectorAll(':scope > .tour-card'));
    if (cards.length === 0) return;

    track = document.createElement('div');
    track.className = 'carousel-track';
    track.style.display = 'flex';               // 横並び
    track.style.willChange = 'transform';
    track.style.transform = 'translateX(0)';

    // .tour-card だけを track に移す（矢印ボタンなど他の要素は root に残す）
    cards.forEach(c => track.appendChild(c));
    root.appendChild(track);
  }

  // 親は peek を出さない
  const rootStyle = window.getComputedStyle(root);
  if (rootStyle.overflowX !== 'hidden') root.style.overflowX = 'hidden';

  // 1コマ幅：隣接カードの left 差（gap/margin を含められる）
  function getSlideWidth() {
    const cards = track.querySelectorAll('.tour-card');
    if (cards.length >= 2) {
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return Math.round(b.left - a.left);
    } else if (cards.length === 1) {
      const c = cards[0];
      const cs = getComputedStyle(c);
      const w = c.getBoundingClientRect().width;
      const ml = parseFloat(cs.marginLeft) || 0;
      const mr = parseFloat(cs.marginRight) || 0;
      return Math.round(w + ml + mr);
    }
    return 0;
  }

  let slideW = getSlideWidth();
  if (!slideW || slideW <= 0) {
    // それでも 0 なら少し待って再計測
    await new Promise(r => setTimeout(r, 50));
    slideW = getSlideWidth();
    if (!slideW || slideW <= 0) return;
  }

  // ====== スライド関数（translateX で“スーッ”） ======
  let autoTimer = null;
  let busy = false;

  function slideNext() {
    if (busy) return;
    busy = true;

    track.style.transition = `transform ${duration}ms ${easing}`;
    track.style.transform = `translateX(-${slideW}px)`;

    // アニメ後：先頭を末尾へ → transform を 0 に戻す
    setTimeout(() => {
      track.style.transition = 'none';
      if (track.children.length > 0) {
        track.appendChild(track.children[0]);
      }
      track.style.transform = 'translateX(0)';
      busy = false;
    }, duration);
  }

  function slidePrev() {
    if (busy) return;
    busy = true;

    // 先に末尾を先頭へ → -slideW から 0 へ“スーッ”
    track.style.transition = 'none';
    const last = track.children[track.children.length - 1];
    if (last) track.insertBefore(last, track.children[0]);
    track.style.transform = `translateX(-${slideW}px)`;

    // ダブル rAF でレイアウト確定後に遷移を適用
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        track.style.transition = `transform ${duration}ms ${easing}`;
        track.style.transform = 'translateX(0)';
        setTimeout(() => {
          track.style.transition = 'none';
          busy = false;
        }, duration);
      });
    });
  }

  // ====== 自動スライド ======
  function startAuto() {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(slideNext, interval);
  }
  function stopAuto() {
    if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
  }
  startAuto();

  // ====== 矢印ボタン接続 ======
  if (rightBtn) {
    const el = document.querySelector(rightBtn);
    if (el) {
      el.addEventListener('click', e => {
        e.preventDefault();
        stopAuto();
        slideNext();
        startAuto();
      });
    }
  }
  if (leftBtn) {
    const el = document.querySelector(leftBtn);
    if (el) {
      el.addEventListener('click', e => {
        e.preventDefault();
        stopAuto();
        slidePrev();
        startAuto();
      });
    }
  }

  // 任意：ホバーで一時停止/復帰
  root.addEventListener('mouseenter', stopAuto);
  root.addEventListener('mouseleave', startAuto);

  // リサイズ：位置リセット＆幅再計測
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      track.style.transition = 'none';
      track.style.transform = 'translateX(0)';
      const w = getSlideWidth();
      if (w && w > 0) slideW = w;
    }, 120);
  });
}













/**
 * 予備：transform＋DOM入れ替え型のカルーセル初期化
 * - HTML/CSS は既存のまま（.tour-slider-track .w-dyn-items / .tour-slide）
 * - renderRecommendedCarousel() が描画した後に呼んでください
 *
 * @param {string|Element} containerId - カルーセルのルート（ID文字列 or CSSセレクタ or 要素）
 * @param {number} visibleCount        - 表示枚数の目安（現行ロジックでは幅計算に使わないが、API互換のため残置）
 * @param {number} intervalMs          - 自動スライド間隔（ms）
 * @returns {{next:Function, prev:Function, start:Function, stop:Function, destroy:Function}|null}
 */
/*
function setupTransformCarouselFallback(containerId, visibleCount = 4, intervalMs = 4000) {
  // ルート要素の解決（"#id" でも "id" でも OK、Element を渡してもOK）
  let root = null;
  if (containerId instanceof Element) {
    root = containerId;
  } else if (typeof containerId === 'string') {
    root = document.querySelector(containerId) || document.getElementById(containerId) || document.querySelector(`#${containerId}`);
  }
  if (!root) {
    console.warn('[setupTransformCarouselFallback] container not found:', containerId);
    return null;
  }

  // 多重初期化を防止
  if (root.dataset.carouselInitialized === '1') {
    // 既に初期化済みなら何もしない
    return root._carouselApi || null;
  }

  const track = root.querySelector('.tour-slider-track .w-dyn-items');
  const leftBtn = root.querySelector('.tour-left-arrow');
  const rightBtn = root.querySelector('.tour-right-arrow');

  if (!track) {
    console.warn('[setupTransformCarouselFallback] .tour-slider-track .w-dyn-items not found under container:', root);
    return null;
  }

  // スライドが1枚以下なら自動スライド不要
  const slides = () => track.querySelectorAll('.tour-slide');
  if (slides().length <= 1) {
    // 矢印があれば無効化
    if (leftBtn) leftBtn.disabled = true;
    if (rightBtn) rightBtn.disabled = true;
    return null;
  }

  // 1枚ぶんの幅（gap を CSS で付けている場合は getBoundingClientRect 差分方式にするとより正確）
  function getSlideWidth() {
    const first = slides()[0];
    const second = slides()[1];
    if (!first) return 0;
    if (!second) return first.offsetWidth;
    const r1 = first.getBoundingClientRect();
    const r2 = second.getBoundingClientRect();
    const delta = r2.left - r1.left;
    return delta > 0 ? delta : first.offsetWidth;
  }

  function slideNext() {
    const slideWidth = getSlideWidth();
    if (!slideWidth) return;

    track.style.transition = 'transform 0.5s ease';
    track.style.transform = `translateX(-${slideWidth}px)`;

    // アニメ後に先頭を末尾へ
    nextTick(() => {
      track.style.transition = 'none';
      if (track.children.length > 0) {
        track.appendChild(track.children[0]);
      }
      track.style.transform = 'translateX(0)';
    }, 500);
  }

  function slidePrev() {
    const slideWidth = getSlideWidth();
    if (!slideWidth) return;

    // 末尾を先頭へ → 右から0へ戻す
    track.style.transition = 'none';
    if (track.children.length > 0) {
      track.insertBefore(track.children[track.children.length - 1], track.children[0]);
    }
    track.style.transform = `translateX(-${slideWidth}px)`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        track.style.transition = 'transform 0.5s ease';
        track.style.transform = 'translateX(0)';
      });
    });
  }

  // タイマー管理
  let timer = null;
  function start() {
    stop();
    timer = setInterval(slideNext, intervalMs);
  }
  function stop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  // クリックで一時停止→再開
  if (rightBtn) {
    rightBtn.addEventListener('click', onRightClick);
  }
  if (leftBtn) {
    leftBtn.addEventListener('click', onLeftClick);
  }

  function onRightClick() {
    stop();
    slideNext();
    start();
  }
  function onLeftClick() {
    stop();
    slidePrev();
    start();
  }

  // リサイズ時は位置リセット
  function onResize() {
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';
  }
  window.addEventListener('resize', onResize);

  // DOMContentLoaded 待ちは不要（呼び出し元で描画済みのため）
  start();

  // 後始末 API
  function destroy() {
    stop();
    window.removeEventListener('resize', onResize);
    if (rightBtn) rightBtn.removeEventListener('click', onRightClick);
    if (leftBtn) leftBtn.removeEventListener('click', onLeftClick);
    root.dataset.carouselInitialized = '0';
    delete root._carouselApi;
  }

  // 多重初期化対策のフラグと公開API
  root.dataset.carouselInitialized = '1';
  const api = { next: slideNext, prev: slidePrev, start, stop, destroy };
  root._carouselApi = api;
  return api;

  // ---- helpers ----
  function nextTick(fn, delay) {
    if (typeof delay === 'number' && delay > 0) {
      setTimeout(fn, delay);
    } else {
      requestAnimationFrame(() => requestAnimationFrame(fn));
    }
  }
}

// グローバルにも露出（必要ならESMのexportに変更可）
window.setupTransformCarouselFallback = setupTransformCarouselFallback;
*/



// ============================
//  右方向の無限ループスクロール
// ============================



/*
function setupReverseLoopScroll(carouselId, visibleCount = 4, interval = 4000) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  // ---- 再初期化対策 ----
  if (carousel._autoScrollTimer) {
    clearInterval(carousel._autoScrollTimer);
    carousel._autoScrollTimer = null;
  }
  let restartTimer = null;   // 手動操作後の自動再開用
  let isAnimating = false;   // 自動スクロールの二重実行防止
  let busyClick = false;     // クリック処理中のガード

  // ---- 1コマ幅：隣カードの左座標差（gap/margin込み）----
  function getCardWidth() {
    const cards = carousel.querySelectorAll('.tour-card');
    if (cards.length >= 2) {
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return Math.round(b.left - a.left);
    } else if (cards.length === 1) {
      const card = cards[0];
      const style = window.getComputedStyle(card);
      const w = card.getBoundingClientRect().width;
      const ml = parseFloat(style.marginLeft) || 0;
      const mr = parseFloat(style.marginRight) || 0;
      return Math.round(w + ml + mr);
    }
    return 250; // fallback
  }

  let cardWidth = getCardWidth();
  if (!cardWidth || cardWidth <= 0) return;

  // ---- 初期整列（左方向用：peekなしで 0 スタート）----
  carousel.style.overflowX = carousel.style.overflowX || 'hidden'; // peek防止
  carousel.scrollLeft = 0;
  snapToBoundary();

  // ---- 共通ヘルパー ----
  const animMs  = 400; // 自動スクロール時の scrollBy アニメ時間目安
  const clickMs = 500; // クリック時の transform アニメ時間（使わない場合もあり）

  function snapToBoundary() {
    const n = Math.round(carousel.scrollLeft / cardWidth);
    carousel.scrollLeft = n * cardWidth;
  }

  function pauseAuto() {
    if (carousel._autoScrollTimer) {
      clearInterval(carousel._autoScrollTimer);
      carousel._autoScrollTimer = null;
    }
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function resumeAuto(delay = 1200) {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!carousel._autoScrollTimer) {
        carousel._autoScrollTimer = setInterval(moveNext, interval);
      }
    }, delay);
  }

  // ---- 自動：1コマ進む（左方向：右→左へ流れる）----
  function moveNext() {
    if (isAnimating || busyClick) return;
    isAnimating = true;

    // 右に1コマ分スクロール（見た目は左へ流れる）
    carousel.scrollBy({ left: +cardWidth, behavior: 'smooth' });

    // アニメ後：先頭→末尾へ、位置補正
    setTimeout(() => {
      const first = carousel.firstElementChild;
      if (first) {
        carousel.appendChild(first);
        carousel.scrollLeft -= cardWidth; // 位置補正（境界維持）
      }
      snapToBoundary();
      isAnimating = false;
    }, animMs);
  }

  // ---- 自動：1コマ戻る（右方向）----
  function movePrev() {
    if (isAnimating || busyClick) return;
    isAnimating = true;

    // 事前に末尾→先頭＆位置補正
    const last = carousel.lastElementChild;
    if (last) {
      carousel.prepend(last);
      carousel.scrollLeft += cardWidth; // 位置補正（境界維持）
    }

    // 左へ1コマ分スクロール
    carousel.scrollBy({ left: -cardWidth, behavior: 'smooth' });

    setTimeout(() => {
      snapToBoundary();
      isAnimating = false;
    }, animMs);
  }

  // ---- 自動スクロール開始（左方向へ進む）----
  carousel._autoScrollTimer = setInterval(moveNext, interval);

  // ---- ホバーで一時停止/復帰（任意）----
  carousel.addEventListener('mouseenter', pauseAuto);
  carousel.addEventListener('mouseleave', () => resumeAuto());

  // ======================================================
  // クリック（左右矢印）：イベントデリゲーションで確実に反応
  // - .tour-left-arrow / .tour-right-arrow
  // - 代替で #carousel-left / #carousel-right
  // ======================================================
  const LEFT_SELECTOR  = '.tour-left-arrow, #carousel-left';
  const RIGHT_SELECTOR = '.tour-right-arrow, #carousel-right';

  // 左（戻る）
  document.addEventListener('click', (e) => {
    const leftBtn = e.target.closest(LEFT_SELECTOR);
    if (!leftBtn) return;
    e.preventDefault();

    // 必要なら、該当カルーセル内の矢印のみ受け付けたい場合は下を有効化
    // if (!carousel.contains(leftBtn)) return;

    pauseAuto();
    movePrev();
    resumeAuto();
  }, { passive: false });

  // 右（進む）
  document.addEventListener('click', (e) => {
    const rightBtn = e.target.closest(RIGHT_SELECTOR);
    if (!rightBtn) return;
    e.preventDefault();

    // if (!carousel.contains(rightBtn)) return;

    pauseAuto();
    moveNext();
    resumeAuto();
  }, { passive: false });

  // デバッグ用ログ（見つからないときの気付きに）
  const leftCount  = document.querySelectorAll(LEFT_SELECTOR).length;
  const rightCount = document.querySelectorAll(RIGHT_SELECTOR).length;
  if (leftCount === 0 && rightCount === 0) {
    console.warn('Carousel arrows not found. Looking for .tour-left-arrow/.tour-right-arrow or #carousel-left/#carousel-right');
  }

  // ---- リサイズ時：幅再計測＆境界スナップ（peek再発防止）----
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cardWidth = getCardWidth();
      if (cardWidth > 0) {
        snapToBoundary();
      }
    }, 150);
  });
}
*/



/*
function setupReverseLoopScroll(carouselId, visibleCount = 4, interval = 4000) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  // ---- 再初期化対策 ----
  if (carousel._autoScrollTimer) {
    clearInterval(carousel._autoScrollTimer);
    carousel._autoScrollTimer = null;
  }
  let restartTimer = null;   // 手動操作後の自動再開用
  let isAnimating = false;   // 二重実行防止

  // ---- 幅計算：隣カードの左座標差（gap/margin込み）----
  function getCardWidth() {
    const cards = carousel.querySelectorAll('.tour-card');
    if (cards.length >= 2) {
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return Math.round(b.left - a.left);
    } else if (cards.length === 1) {
      const card = cards[0];
      const style = window.getComputedStyle(card);
      const w = card.getBoundingClientRect().width;
      const ml = parseFloat(style.marginLeft) || 0;
      const mr = parseFloat(style.marginRight) || 0;
      return Math.round(w + ml + mr);
    }
    return 250;
  }

  let cardWidth = getCardWidth();
  if (!cardWidth || cardWidth <= 0) return;

  // ---- 初期整列（左方向用：peekなしで 0 スタート）----
  // ※ 右方向版のような prepend は不要。まずは 0 にスナップ。
  carousel.scrollLeft = 0;
  snapToBoundary();

  // ---- 共通ヘルパー ----
  const animMs = 400; // scrollBy の smooth 相当の時間目安

  function snapToBoundary() {
    const n = Math.round(carousel.scrollLeft / cardWidth);
    carousel.scrollLeft = n * cardWidth;
  }

  function pauseAuto() {
    if (carousel._autoScrollTimer) {
      clearInterval(carousel._autoScrollTimer);
      carousel._autoScrollTimer = null;
    }
    if (restartTimer) {
      clearTimeout(restartTimer);
      restartTimer = null;
    }
  }

  function resumeAuto(delay = 1200) {
    if (restartTimer) clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      if (!carousel._autoScrollTimer) {
        carousel._autoScrollTimer = setInterval(moveNext, interval);
      }
    }, delay);
  }

  // ---- 1コマ進む（左方向：右から左へ）----
  function moveNext() {
    if (isAnimating) return;
    isAnimating = true;

    // 右へ 1コマ分スクロール（= 次のカードが右から入ってくる＝左方向に流れる）
    carousel.scrollBy({ left: +cardWidth, behavior: 'smooth' });

    // アニメ後：先頭→末尾へ送り、位置を 1コマ戻して見た目を継続
    setTimeout(() => {
      const first = carousel.firstElementChild;
      if (first) {
        carousel.appendChild(first);
        carousel.scrollLeft -= cardWidth; // 位置補正（境界維持）
      }
      snapToBoundary();
      isAnimating = false;
    }, animMs);
  }

  // ---- 1コマ戻る（右方向：左から右へ＝左方向の逆）----
  function movePrev() {
    if (isAnimating) return;
    isAnimating = true;

    // アニメ前に：末尾→先頭へ送り、1コマ分右へ寄せておく
    const last = carousel.lastElementChild;
    if (last) {
      carousel.prepend(last);
      carousel.scrollLeft += cardWidth; // 位置補正（境界維持）
    }

    // 左へ 1コマ分スクロール（= 逆方向）
    carousel.scrollBy({ left: -cardWidth, behavior: 'smooth' });

    setTimeout(() => {
      snapToBoundary();
      isAnimating = false;
    }, animMs);
  }

  // ---- 自動スクロール開始（左方向へ進む）----
  carousel._autoScrollTimer = setInterval(moveNext, interval);

  // ---- ホバーで一時停止/復帰（任意）----
  carousel.addEventListener('mouseenter', () => {
    pauseAuto();
  });
  carousel.addEventListener('mouseleave', () => {
    resumeAuto();
  });

  // ---- 矢印ボタン接続（IDはHTMLに合わせて）----
  const leftBtn  = document.getElementById('carousel-left');
  const rightBtn = document.getElementById('carousel-right');

  // 左矢印：右方向に戻る（= movePrev）
  if (leftBtn) {
    leftBtn.addEventListener('click', (e) => {
      e.preventDefault();
      pauseAuto();
      movePrev();
      resumeAuto();
    });
  }
  // 右矢印：左方向に進む（= moveNext）
  if (rightBtn) {
    rightBtn.addEventListener('click', (e) => {
      e.preventDefault();
      pauseAuto();
      moveNext();
      resumeAuto();
    });
  }

  // ---- リサイズ時：幅再計測＆境界スナップ（peek再発防止）----
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      cardWidth = getCardWidth();
      if (cardWidth > 0) {
        snapToBoundary();
      }
    }, 150);
  });
}
*/

/*
function setupReverseLoopScroll(carouselId, visibleCount = 4, interval = 3000) {
  const carousel = document.getElementById(carouselId);
  if (!carousel) return;

  // 二重起動対策（再初期化時）
  if (carousel._autoScrollTimer) {
    clearInterval(carousel._autoScrollTimer);
    carousel._autoScrollTimer = null;
  }

  // 1コマの“実効幅”を取得（margin/gapも含めた隣カードの左座標差）
  function getCardWidth() {
    const cards = carousel.querySelectorAll('.tour-card');
    if (cards.length >= 2) {
      const a = cards[0].getBoundingClientRect();
      const b = cards[1].getBoundingClientRect();
      return Math.round(b.left - a.left);
    } else if (cards.length === 1) {
      const card = cards[0];
      const style = window.getComputedStyle(card);
      const width = card.getBoundingClientRect().width;
      const ml = parseFloat(style.marginLeft) || 0;
      const mr = parseFloat(style.marginRight) || 0;
      return Math.round(width + ml + mr);
    }
    return 250; // fallback
  }

  const cardWidth = getCardWidth();
  if (!cardWidth || cardWidth <= 0) return;

  // --- 初期整列：常に「カード境界」に合わせる（peekなし）
  // 末尾→先頭に visibleCount 個 prepend（右ループの土台）
  for (let i = 0; i < visibleCount; i++) {
    const last = carousel.lastElementChild;
    if (last) carousel.prepend(last);
  }
  // ちょうど visibleCount コマ分だけ右に寄せる（境界にスナップ）
  carousel.scrollLeft = cardWidth * visibleCount;

  const animMs = 400; // アニメ時間の目安

  const tick = () => {
    // 1コマ分だけスクロール（カード境界 → 次のカード境界）
    carousel.scrollBy({ left: -cardWidth, behavior: 'smooth' });

    // アニメ後に末尾→先頭へ移動し、境界にスナップ
    setTimeout(() => {
      const last = carousel.lastElementChild;
      if (last) {
        carousel.prepend(last);
        // “整数倍の境界”にぴったり合わせる
        const n = Math.round(carousel.scrollLeft / cardWidth);
        carousel.scrollLeft = n * cardWidth;
      }
    }, animMs);
  };

  // 自動スクロール開始
  carousel._autoScrollTimer = setInterval(tick, interval);

  // ホバーで一時停止/復帰（任意）
  const pause = () => carousel._autoScrollTimer && clearInterval(carousel._autoScrollTimer);
  const resume = () => !carousel._autoScrollTimer && (carousel._autoScrollTimer = setInterval(tick, interval));
  carousel.addEventListener('mouseenter', pause);
  carousel.addEventListener('mouseleave', resume);

  // ウィンドウリサイズで幅が変わる場合の再スナップ（任意）
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const w = getCardWidth();
      if (w > 0) {
        const n = Math.round(carousel.scrollLeft / w);
        carousel.scrollLeft = n * w;
      }
    }, 150);
  });
}
*/