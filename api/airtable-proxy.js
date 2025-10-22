export default async function handler(req, res) {
  // 許可するオリジン一覧
  const allowedOrigins = [
    'https://leisure.jtbusa.com',
    'http://jtbtour.com',
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }

  // プリフライト (OPTIONS) 対応
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
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
    sortField = '',
    sortDirection = '',
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
    case '3':
      tableName = 'Description';
      break;
    case '4':
      tableName = 'Itinerary';
      break;
    case '5':
      tableName = 'Remarks';
      break;
    case '6':
      tableName = 'Inquiry';
      break;
    case '7':
      tableName = 'Features';
      break;
    default:
      tableName = process.env.AIRTABLE_TABLE_NAME;;
  }

  let formulas = [];

  // 固定の公開フラグ（Tourのみ）
  if (tableName === 'Tour') {
    formulas.push(`{Publish}=TRUE()`);
  }

  //console.log('tableName2', tableName);
  //console.log('filterField2', filterField);
  //console.log('filterValue2', filterValue);

  // filterField 1
  if (filterField && filterValue !== undefined) {
    const values = decodeURIComponent(filterValue).split(',').map(v => v.trim());

    //console.log('tableName', tableName);
    //console.log('values', values);
    //console.log('filterValue', filterValue);

    if (filterField === 'RECORD_ID()') {
      if (values.length > 1) {
        const conditions = values.map(id => `RECORD_ID()="${id}"`);
        formulas.push(`OR(${conditions.join(',')})`);
      } else {
        formulas.push(`RECORD_ID()="${values[0]}"`);
      }
    } else if (filterValue === 'true') {
      formulas.push(`{${filterField}}=TRUE()`);
    } else if (filterValue === 'false') {
      formulas.push(`{${filterField}}=FALSE()`);
    } else {
      if (values.length > 1) {
        const subFormulas = values.map(val => `FIND("${val}", ARRAYJOIN({${filterField}}))`);
        formulas.push(`OR(${subFormulas.join(',')})`);
      } else if (!isNaN(values[0])) {
        formulas.push(`SEARCH(",${values[0]},", "," & ARRAYJOIN({${filterField}}, ",") & ",")`);
      } else {
        formulas.push(`FIND("${values[0]}", ARRAYJOIN({${filterField}}))`);
      }
    }
  }

  // filterField 2（必要なら）
  if (filterField2 && filterValue2 !== undefined) {
    const values2 = decodeURIComponent(filterValue2).split(',').map(v => v.trim());

    if (filterField2 === 'RECORD_ID()') {
      if (values2.length > 1) {
        const conditions2 = values2.map(id => `RECORD_ID()="${id}"`);
        formulas.push(`OR(${conditions2.join(',')})`);
      } else {
        formulas.push(`RECORD_ID()="${values2[0]}"`);
      }
    } else if (filterValue2 === 'true') {
      formulas.push(`{${filterField2}}=TRUE()`);
    } else if (filterValue2 === 'false') {
      formulas.push(`{${filterField2}}=FALSE()`);
    } else {
      // カンマ区切りなら OR 条件で部分一致（例：Destination=Tokyo,Osaka）
      const values = decodeURIComponent(filterValue2).split(',').map(v => v.trim());

      if (values.length > 1) {
        const subFormulas = values.map(val => `FIND("${val}", ARRAYJOIN({${filterField2}}))`);
        formulas.push(`OR(${subFormulas.join(',')})`);
      } else if (!isNaN(values[0])) {
        formulas.push(`SEARCH(",${values[0]},", "," & ARRAYJOIN({${filterField2}}, ",") & ",")`);
      } else {
        formulas.push(`FIND("${values[0]}", ARRAYJOIN({${filterField2}}))`);
      }
    }
  }

  // Airtable URL 構築
  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;

  if (formulas.length > 0) {
    const finalFormula = formulas.length === 1 ? formulas[0] : `AND(${formulas.join(',')})`;
    url += `&filterByFormula=${encodeURIComponent(finalFormula)}`;
  }

  // ソート条件を追加
  if(sortField && sortDirection){
    url += `&sort[0][field]=${encodeURIComponent(sortField)}&sort[0][direction]=${encodeURIComponent(sortDirection)}`;
  }
  
  // 第2ソート条件（例：同一値のときNameで昇順ソート）
const secondarySortField = 'Name';
const secondarySortDirection = 'asc';
url += `&sort[1][field]=${encodeURIComponent(secondarySortField)}&sort[1][direction]=${encodeURIComponent(secondarySortDirection)}`;


  // ページネーションの offset がある場合
  if (offset) url += `&offset=${offset}`;
  
  //console.log('url', url);

  try {
    const airtableRes = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!airtableRes.ok) {
      const error = await airtableRes.text();
      return res.status(airtableRes.status).json({ error });
    }

    const data = await airtableRes.json();
    //console.log('data', data);

    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: 'Server error', detail: e.message });
  }
}
