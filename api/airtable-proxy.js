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

  const { sortField = 'Name', sortDirection = 'asc', offset = '', table = '1' } = req.query;

  const tableMap = {
    '1': process.env.AIRTABLE_TABLE_NAME,
    '2': 'Style',
  };

  const tableName = tableMap[table];

  let url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?pageSize=100`;

  // Publish = true のみ取得
  url += `&filterByFormula=${encodeURIComponent("Publish=TRUE()")}`;
  
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
