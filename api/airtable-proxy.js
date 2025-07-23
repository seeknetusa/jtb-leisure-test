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


  // 固定の公開フラグ（Tourのみ）
  if (tableName === 'Tour') {
    formulas.push(`{Publish}=TRUE()`);
  }
  
  // filterField 1
  if (filterField && filterValue !== undefined) {
    if (filterValue === 'true') {
      formulas.push(`{${filterField}}=TRUE()`);
    } else if (filterValue === 'false') {
      formulas.push(`{${filterField}}=FALSE()`);
    } else {
      formulas.push(`FIND("${filterValue}", {${filterField}})`);
    }
  }

  // filterField 2（必要なら）
  if (filterField2 && filterValue2 !== undefined) {
    if (filterValue2 === 'true') {
      formulas.push(`{${filterField2}}=TRUE()`);
    } else if (filterValue2 === 'false') {
      formulas.push(`{${filterField2}}=FALSE()`);
    } else {
      formulas.push(`FIND("${filterValue2}", {${filterField2}})`);
    }
  }

  // Airtable URL 構築
  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;

  if (formulas.length > 0) {
    const finalFormula = formulas.length === 1 ? formulas[0] : `AND(${formulas.join(',')})`;
    url += `&filterByFormula=${encodeURIComponent(finalFormula)}`;
  }

  // ソート条件を追加
  url += `&sort[0][field]=${encodeURIComponent(sortField)}&sort[0][direction]=${encodeURIComponent(sortDirection)}`;
  
  // ページネーションの offset がある場合
  if (offset) url += `&offset=${offset}`;
  
  try {
    //console.log('url', url);


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
