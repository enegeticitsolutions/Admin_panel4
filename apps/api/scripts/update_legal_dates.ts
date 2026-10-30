import prisma from '../app/core/database';

async function main() {
  console.log('🔄 Checking and updating Legal Policies dates to 1 Oct 2026...');

  const policies = await (prisma as any).legalPolicy.findMany();
  console.log(`Found ${policies.length} legal policies in database.`);

  let updatedCount = 0;

  for (const policy of policies) {
    const rawSections = JSON.stringify(policy.sections || []);
    const hasPlaceholder = /insert date on publish/i.test(rawSections);

    if (hasPlaceholder || !policy.lastUpdated || policy.lastUpdated.includes('insert date')) {
      const updatedSectionsStr = rawSections.replace(/\[insert date on publish\]/gi, '1 Oct 2026');
      const updatedSections = JSON.parse(updatedSectionsStr);

      await (prisma as any).legalPolicy.update({
        where: { id: policy.id },
        data: {
          sections: updatedSections,
          lastUpdated: '1 Oct 2026',
        },
      });

      console.log(`✅ Updated "${policy.title}" (${policy.slug}) -> lastUpdated: "1 Oct 2026"`);
      updatedCount++;
    } else {
      console.log(`ℹ️  "${policy.title}" (${policy.slug}) already up to date (${policy.lastUpdated})`);
    }
  }

  console.log(`\n🎉 Done! Successfully updated ${updatedCount} policies to "1 Oct 2026".`);
}

main()
  .catch((err) => {
    console.error('❌ Error updating legal policies:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
