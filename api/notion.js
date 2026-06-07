// api/notion.js — Vercel serverless function
// Proxies Notion API calls so the browser never needs the secret token

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID  = 'eb7f5fcaec8140588eefbd998f9467ab';
const NOTION_API   = 'https://api.notion.com/v1';

export default async function handler(req, res) {
  // CORS — allow your GitHub Pages domain + localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const headers = {
    'Authorization': `Bearer ${NOTION_TOKEN}`,
    'Notion-Version': '2022-06-28',
    'Content-Type': 'application/json',
  };

  try {
    // GET /api/notion — fetch all entries from Reading Notes database
    if (req.method === 'GET') {
      const r = await fetch(`${NOTION_API}/databases/${DATABASE_ID}/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sorts: [{ property: 'Date', direction: 'descending' }],
          page_size: 100,
        }),
      });
      const data = await r.json();

      // Map Notion pages → clean entry objects
      const entries = (data.results || []).map(page => ({
        id:                   page.id,
        notion_url:           page.url,
        title:                page.properties['Title']?.title?.[0]?.plain_text || '',
        book:                 page.properties['Book']?.rich_text?.[0]?.plain_text || '',
        page:                 page.properties['Page']?.rich_text?.[0]?.plain_text || '',
        value_tag:            page.properties['Value Tag']?.select?.name || '',
        quote_or_idea:        page.properties['H 原文']?.rich_text?.[0]?.plain_text || '',
        resonance:            page.properties['R 为什么击中我']?.rich_text?.[0]?.plain_text || '',
        connection:           page.properties['C 连接已知']?.rich_text?.[0]?.plain_text || '',
        personal_application: page.properties['A 如何应用']?.rich_text?.[0]?.plain_text || '',
        question:             page.properties['Q 产生的问题']?.rich_text?.[0]?.plain_text || '',
        date:                 page.properties['Date']?.date?.start || '',
      }));

      return res.status(200).json({ entries });
    }

    // POST /api/notion — create a new entry
    if (req.method === 'POST') {
      const e = req.body;
      const r = await fetch(`${NOTION_API}/pages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          parent: { database_id: DATABASE_ID },
          properties: {
            'Title':          { title:     [{ text: { content: e.title || e.quote_or_idea?.slice(0,80) || 'New Entry' } }] },
            'Book':           { rich_text: [{ text: { content: e.book || '' } }] },
            'Page':           { rich_text: [{ text: { content: e.page || '' } }] },
            'Value Tag':      { select:    { name: e.value_tag || 'Personal Growth' } },
            'H 原文':          { rich_text: [{ text: { content: e.quote_or_idea || '' } }] },
            'R 为什么击中我':   { rich_text: [{ text: { content: e.resonance || '' } }] },
            'C 连接已知':      { rich_text: [{ text: { content: e.connection || '' } }] },
            'A 如何应用':      { rich_text: [{ text: { content: e.personal_application || '' } }] },
            'Q 产生的问题':    { rich_text: [{ text: { content: e.question || '' } }] },
            'Date':           { date: { start: e.date || new Date().toISOString().split('T')[0] } },
          },
        }),
      });
      const created = await r.json();
      if (!r.ok) return res.status(r.status).json(created);
      return res.status(200).json({ success: true, id: created.id, url: created.url });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
