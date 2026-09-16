const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

// Auto-discover DATABASE_URL if not directly supplied in process.env
if (!process.env.DATABASE_URL) {
  const candidateEnvPaths = [
    path.resolve(__dirname, '../.env'),
    path.resolve(__dirname, '../../../apps/api/.env'),
    path.resolve(process.cwd(), '.env'),
  ];

  for (const envPath of candidateEnvPaths) {
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.startsWith('DATABASE_URL=')) {
          let val = trimmed.substring('DATABASE_URL='.length).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          process.env.DATABASE_URL = val;
          break;
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

const homePageContent = {
  testimonials: [
    {
      name: "Anita Kapoor",
      role: "Daughter · caring for her 82-year-old mother",
      location: "New Delhi",
      tag: "Found a Care Mitra in 2 days",
      quote: "MaiHoonNa found us a wonderful Care Mitra in just 2 days. She is now like family to my mother. What gave us the most peace of mind was the 24/7 support line — knowing someone is always there, even at 2 AM.",
      image: "https://ui-avatars.com/api/?name=Anita+Kapoor&background=FE6700&color=FFFFFF&size=600&bold=true",
    },
    {
      name: "Rajesh Menon",
      role: "Son · caring for his 78-year-old father",
      location: "Bengaluru",
      tag: "Matched with Hindi & Malayalam speaker",
      quote: "Finding a Care Mitra who could speak both Hindi and Malayalam was a blessing. The weekly vitals reports give me real peace of mind since I reside in Chicago. The live Happiness Score is genuine transparency.",
      image: "https://ui-avatars.com/api/?name=Rajesh+Menon&background=7C3AED&color=FFFFFF&size=600&bold=true",
    },
    {
      name: "Sunita Sharma",
      role: "Daughter · caring for her 85-year-old father",
      location: "Mumbai",
      tag: "Daily walks & medicine tracking",
      quote: "My father looks forward to his Saathi visits every Tuesday and Friday. From medicine tracking to daily walks, the Care Mitra manages everything professionally. It feels like having a second family member in India.",
      image: "https://ui-avatars.com/api/?name=Sunita+Sharma&background=059669&color=FFFFFF&size=600&bold=true",
    }
  ]
};

async function main() {
  const isLocal =
    process.env.DATABASE_URL.includes('localhost') ||
    process.env.DATABASE_URL.includes('127.0.0.1');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: isLocal ? false : { rejectUnauthorized: false },
    max: 2,
    idleTimeoutMillis: 5000,
  });

  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("Seeding home_page content...");
  
  await prisma.websiteContent.upsert({
    where: { pageKey: 'home_page' },
    update: {
      content: homePageContent
    },
    create: {
      pageKey: 'home_page',
      content: homePageContent
    }
  });

  console.log("Seeded home_page content successfully!");
  
  await prisma.$disconnect();
  await pool.end();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
