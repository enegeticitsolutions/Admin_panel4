const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ggjbkdlioayfegcsbprv:HarHarMahadev%4007@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
client.connect().then(async () => {
  const res = await client.query('SELECT "id", "discountAmount", "taxAmount", "totalAmount", "issuedAt" FROM "invoices" ORDER BY "issuedAt" DESC LIMIT 5');
  console.log(res.rows);
  client.end();
}).catch(console.error);
