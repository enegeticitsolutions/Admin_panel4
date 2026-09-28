const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres.ggjbkdlioayfegcsbprv:HarHarMahadev%4007@aws-1-ap-south-1.pooler.supabase.com:5432/postgres' });
client.connect().then(async () => {
  await client.query(`
    UPDATE "invoices"
    SET "discountAmount" = 1185,
        "taxAmount" = 2815.68,
        "totalAmount" = 16340.68
    WHERE "discountAmount" = 1050
  `);
  console.log("Updated invoices successfully!");
  client.end();
}).catch(console.error);
