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
document.getElementById('search-button').addEventListener('click', () => {
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

// ソートセレクトボックスの変更イベント
document.getElementById('sort-select').addEventListener('change', async (e) => {
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

// 「すべてクリア」ボタンがクリックされたときの処理
document.getElementById('clear-filters').addEventListener('click', () => {

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
  // ツアータイトル・スタイル名
  // -----------------------------
  clone.querySelector('.tour-title').textContent = f.Name || '';
  clone.querySelector('.tour-style').textContent = f["Name (from Style)"]?.[0] || '';

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
    const href = f.URL || pdfUrl || `?id=${record.id}`;

    const hasLink = f.URL || pdfUrl;

    const icon = hasLink
      ? 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/687fe53ee93aa36b8503d408_arrow-up-right-from-square-regular-full-red.svg'
      : 'https://cdn.prod.website-files.com/6865cdc559f013614975d0bc/687fe4d5ddfd614d8bec3764_arrow-right-regular-full-red.svg';

    linkEl.href = href;
    linkEl.innerHTML = `View Itinerary <span><img src="${icon}" alt=""></span>`;
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
