export default async function handler(req, res) {
  // CORS 対応（Webflowドメインからのアクセス許可）
  res.setHeader('Access-Control-Allow-Origin', '*');
  //res.setHeader('Access-Control-Allow-Origin', 'https://your-site.webflow.io');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  //res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // プリフライトリクエスト対策（OPTIONSリクエストへの応答）
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  //const tableName = process.env.AIRTABLE_TABLE_NAME;

  const {
    table,
    sortField = 'Name',
    sortDirection = 'asc',
    offset = '',
    filterField,
    filterValue,
    filterField2,
    filterValue2,
  } = req.query;
  
  let filterFormula = '';

  let tableName;
  switch (table) {
    case '1':
      tableName = process.env.AIRTABLE_TABLE_NAME;
      break;
    case '2':
      tableName = 'Style';
      break;
    default:
      tableName = process.env.AIRTABLE_TABLE_NAME;;
  }



  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;

  if(tableName == 'Tour'){
    // Publish = true のみ取得
    url += `&filterByFormula=${encodeURIComponent("Publish=TRUE()")}`;
  }
  
  // ✅ フィルター条件を追加（任意）
  if (filterField && filterValue !== undefined) {
    url += `&filterByFormula=${encodeURIComponent(`${filterField}=TRUE()`)}`;
  }

  // 第一条件
  if (filterField && filterValue !== undefined) {
    let formula1 = '';
    if (filterValue === 'true' || filterValue === 'TRUE()') {
      formula1 = `{${filterField}}=TRUE()`;
    } else if (filterValue === 'false' || filterValue === 'FALSE()') {
      formula1 = `{${filterField}}=FALSE()`;
    } else {
      formula1 = `FIND("${filterValue}", {${filterField}})`;
    }

    filterFormula = formula1;

    // 第二条件（ANDで結合）
    if (filterField2 && filterValue2 !== undefined) {
      let formula2 = '';
      if (filterValue2 === 'true' || filterValue2 === 'TRUE()') {
        formula2 = `{${filterField2}}=TRUE()`;
      } else if (filterValue2 === 'false' || filterValue2 === 'FALSE()') {
        formula2 = `{${filterField2}}=FALSE()`;
      } else {
        formula2 = `FIND("${filterValue2}", {${filterField2}})`;
      }

      filterFormula = `AND(${formula1}, ${formula2})`;
    }

    url += `&filterByFormula=${encodeURIComponent(filterFormula)}`;
  }

  // ソート条件を追加
  url += `&sort[0][field]=${encodeURIComponent(sortField)}&sort[0][direction]=${encodeURIComponent(sortDirection)}`;
  
  // ページネーションの offset がある場合
  if (offset) url += `&offset=${offset}`;
  
  try {
    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!airtableRes.ok) {
      const error = await airtableRes.text();
      return res.status(airtableRes.status).json({ error });
    }

    const data = await airtableRes.json();
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
