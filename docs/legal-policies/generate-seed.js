const fs = require('fs');
const path = require('path');

const policies = [
  {
    slug: 'terms',
    title: 'Terms of Service',
    tabLabel: 'Terms of Service',
    file: 'tnc.html',
    sortOrder: 1,
    isActive: true,
  },
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    tabLabel: 'Privacy Policy',
    file: 'privacy.html',
    sortOrder: 2,
    isActive: true,
  },
  {
    slug: 'refund',
    title: 'Refund & Cancellation Policy',
    tabLabel: 'Refund Policy',
    file: 'refund.html',
    sortOrder: 3,
    isActive: true,
  },
  {
    slug: 'cookie',
    title: 'Cookie Policy',
    tabLabel: 'Cookie Policy',
    file: 'cookie.html',
    sortOrder: 4,
    isActive: true,
  },
  {
    slug: 'saathi-tc',
    title: 'Saathi Volunteer Terms',
    tabLabel: 'Saathi T&C',
    file: 'saathi_tc.html',
    sortOrder: 6,
    isActive: true,
  }
];

let out = `import prisma from './app/core/database';\n\n`;

const existingPath = path.join(__dirname, '../../apps/api/seed-legal-policies.ts');
const existing = fs.readFileSync(existingPath, 'utf8');

const newPolicies = [];

for (const p of policies) {
  const htmlPath = path.join(__dirname, p.file);
  const html = fs.readFileSync(htmlPath, 'utf8');
  const escapedHtml = html.replace(/`/g, '\\`').replace(/\$/g, '\\$');
  
  newPolicies.push(`  {
    slug: '${p.slug}',
    title: '${p.title}',
    tabLabel: '${p.tabLabel}',
    sortOrder: ${p.sortOrder},
    isActive: true,
    sections: [
      {
        id: 'main',
        isHtml: true,
        content: \`${escapedHtml}\`
      }
    ]
  }`);
}

const childSafetyMatch = existing.match(/(\{\s*slug:\s*'child-safety'[\s\S]*?\n\s*\})\r?\n\];/);
if (!childSafetyMatch) {
  throw new Error("Could not find child-safety policy in existing seed file.");
}
const childSafetyStr = childSafetyMatch[1];
newPolicies.push(childSafetyStr);

const fullFile = `import prisma from './app/core/database';

export const initialPolicies = [
${newPolicies.join(',\n')}
];

async function seedLegalPolicies() {
  console.log('🌱 Seeding Legal Policies into database...');

  for (const policy of initialPolicies) {
    const upserted = await (prisma as any).legalPolicy.upsert({
      where: { slug: policy.slug },
      update: {
        title: policy.title,
        tabLabel: policy.tabLabel,
        summary: policy.summary,
        effectiveDate: policy.effectiveDate,
        lastUpdated: policy.lastUpdated,
        appliesTo: policy.appliesTo,
        operatedBy: policy.operatedBy,
        sortOrder: policy.sortOrder,
        isActive: policy.isActive,
        sections: policy.sections,
        footerNote: policy.footerNote,
      },
      create: {
        slug: policy.slug,
        title: policy.title,
        tabLabel: policy.tabLabel,
        summary: policy.summary,
        effectiveDate: policy.effectiveDate,
        lastUpdated: policy.lastUpdated,
        appliesTo: policy.appliesTo,
        operatedBy: policy.operatedBy,
        sortOrder: policy.sortOrder,
        isActive: policy.isActive,
        sections: policy.sections,
        footerNote: policy.footerNote,
      },
    });
    console.log(\`✅ Upserted policy: \${upserted.slug} - "\${upserted.title}"\`);
  }

  console.log('🎉 Legal Policies seeding complete!');
}

if (require.main === module) {
  seedLegalPolicies()
    .catch((err) => {
      console.error('❌ Failed to seed legal policies:', err);
      process.exit(1);
    })
    .finally(async () => {
      process.exit(0);
    });
}
`;

fs.writeFileSync(existingPath, fullFile);
console.log('Generated seed-legal-policies.ts');
