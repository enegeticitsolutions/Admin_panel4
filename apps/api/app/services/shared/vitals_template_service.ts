import prisma from '../../core/database';
import { v4 as uuidv4 } from 'uuid';

export interface FormattedTemplateItem {
  id: string;
  vitalDefinitionId: string;
  code: string;
  name: string;
  unit: string | null;
  dataType: string;
  frequency: string;
  isMandatory: boolean;
  displayOrder: number;
}

export interface FormattedVitalTemplate {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  isActive: boolean;
  items: FormattedTemplateItem[];
}

/**
 * Seeds default vital config templates if none exist in the database.
 * Matches the bundles configured in admin operations:
 * - Standard care (Default): SPO2, BP, TEMP, PULSE, WEIGHT
 * - Cardiac care: SPO2, BP, PULSE (mandatory), TEMP, WEIGHT
 * - Diabetic care: SPO2, BP, TEMP, PULSE, BLOOD_GLUCOSE (mandatory), WEIGHT
 * - Post-surgery: SPO2, BP, TEMP, PULSE, VAS/Pain (mandatory), WEIGHT
 */
export async function seedDefaultVitalTemplates(client: any = prisma): Promise<void> {
  const existingCount = await client.vitalConfigTemplate.count();
  if (existingCount > 0) return;

  const vitals = await client.vitalDefinition.findMany({
    where: { isLatestVersion: true },
  });

  const byCode: Record<string, string> = {};
  vitals.forEach((v: any) => {
    byCode[v.code.toUpperCase()] = v.id;
  });

  const templatesToCreate = [
    {
      name: 'Standard care',
      description: 'Applied to all new beneficiaries unless overridden',
      isDefault: true,
      codes: [
        { code: 'SPO2', freq: 'every_visit', mandatory: false },
        { code: 'BP', freq: 'every_visit', mandatory: false },
        { code: 'TEMP', freq: 'every_visit', mandatory: false },
        { code: 'PULSE', freq: 'every_visit', mandatory: false },
        { code: 'WEIGHT', freq: 'weekly', mandatory: false },
      ],
    },
    {
      name: 'Diabetic care',
      description: 'For beneficiaries with diabetes requiring blood glucose tracking',
      isDefault: false,
      codes: [
        { code: 'SPO2', freq: 'every_visit', mandatory: false },
        { code: 'BP', freq: 'every_visit', mandatory: false },
        { code: 'TEMP', freq: 'every_visit', mandatory: false },
        { code: 'PULSE', freq: 'every_visit', mandatory: false },
        { code: 'BLOOD_GLUCOSE', freq: 'every_visit', mandatory: true },
        { code: 'WEIGHT', freq: 'weekly', mandatory: false },
      ],
    },
    {
      name: 'Cardiac care',
      description: 'For beneficiaries with heart conditions and hypertension',
      isDefault: false,
      codes: [
        { code: 'SPO2', freq: 'every_visit', mandatory: true },
        { code: 'BP', freq: 'every_visit', mandatory: true },
        { code: 'PULSE', freq: 'every_visit', mandatory: true },
        { code: 'TEMP', freq: 'every_visit', mandatory: false },
        { code: 'WEIGHT', freq: 'weekly', mandatory: false },
      ],
    },
    {
      name: 'Post-surgery',
      description: 'Intensive recovery monitoring post-operation with pain tracking',
      isDefault: false,
      codes: [
        { code: 'SPO2', freq: 'every_visit', mandatory: true },
        { code: 'BP', freq: 'every_visit', mandatory: true },
        { code: 'TEMP', freq: 'every_visit', mandatory: true },
        { code: 'PULSE', freq: 'every_visit', mandatory: true },
        { code: 'VAS', freq: 'every_visit', mandatory: true },
        { code: 'WEIGHT', freq: 'weekly', mandatory: false },
      ],
    },
  ];

  for (const t of templatesToCreate) {
    const validItems = t.codes
      .filter(c => byCode[c.code])
      .map((c, idx) => ({
        id: uuidv4(),
        vitalDefinitionId: byCode[c.code],
        frequency: c.freq,
        isMandatory: c.mandatory,
        displayOrder: idx,
      }));

    await client.vitalConfigTemplate.create({
      data: {
        id: uuidv4(),
        name: t.name,
        description: t.description,
        isDefault: t.isDefault,
        isActive: true,
        items: validItems.length > 0 ? { create: validItems } : undefined,
      },
    });
  }
}

/**
 * Returns all active vital configuration templates with their definitions.
 * Formatted cleanly for mobile app consumption.
 */
export async function getActiveVitalTemplates(
  packageType?: string,
  client: any = prisma
): Promise<FormattedVitalTemplate[]> {
  await seedDefaultVitalTemplates(client);

  const templates = await client.vitalConfigTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    include: {
      items: {
        orderBy: { displayOrder: 'asc' },
        include: {
          vitalDefinition: true,
        },
      },
    },
  });

  return templates.map((t: any) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    isDefault: t.isDefault,
    isActive: t.isActive,
    items: (t.items || []).map((i: any) => ({
      id: i.id,
      vitalDefinitionId: i.vitalDefinitionId,
      code: i.vitalDefinition?.code || '',
      name: i.vitalDefinition?.name || 'Vital',
      unit: i.vitalDefinition?.unit || null,
      dataType: i.vitalDefinition?.dataType || 'numeric',
      frequency: i.frequency || 'every_visit',
      isMandatory: !!i.isMandatory,
      displayOrder: i.displayOrder || 0,
    })),
  }));
}

/**
 * Provisions standard/default care vitals for a beneficiary if they have 0 active configs.
 * Idempotent: does not touch or overwrite existing active vitals.
 */
export async function ensureDefaultVitalsForBeneficiary(
  beneficiaryId: string,
  client: any = prisma
): Promise<void> {
  const activeCount = await client.beneficiaryVitalConfig.count({
    where: { beneficiaryId, isActive: true },
  });

  if (activeCount > 0) return;

  await seedDefaultVitalTemplates(client);

  // Find the default template (Standard care)
  let defaultTemplate = await client.vitalConfigTemplate.findFirst({
    where: { isDefault: true, isActive: true },
    include: {
      items: {
        include: { vitalDefinition: true },
      },
    },
  });

  if (!defaultTemplate) {
    defaultTemplate = await client.vitalConfigTemplate.findFirst({
      where: { name: { contains: 'Standard', mode: 'insensitive' }, isActive: true },
      include: {
        items: {
          include: { vitalDefinition: true },
        },
      },
    });
  }

  if (defaultTemplate && defaultTemplate.items?.length > 0) {
    for (const item of defaultTemplate.items) {
      await client.beneficiaryVitalConfig.upsert({
        where: {
          beneficiaryId_vitalDefinitionId: {
            beneficiaryId,
            vitalDefinitionId: item.vitalDefinitionId,
          },
        },
        update: {
          isActive: true,
          templateId: defaultTemplate.id,
          frequency: item.frequency || 'every_visit',
          isMandatory: item.isMandatory || false,
        },
        create: {
          id: uuidv4(),
          beneficiaryId,
          vitalDefinitionId: item.vitalDefinitionId,
          templateId: defaultTemplate.id,
          isActive: true,
          frequency: item.frequency || 'every_visit',
          isMandatory: item.isMandatory || false,
        },
      });
    }
  } else {
    // Fallback: assign all system vitals
    const systemVitals = await client.vitalDefinition.findMany({
      where: { isSystemVital: true, isLatestVersion: true, isActive: true },
    });

    for (const v of systemVitals) {
      await client.beneficiaryVitalConfig.upsert({
        where: {
          beneficiaryId_vitalDefinitionId: {
            beneficiaryId,
            vitalDefinitionId: v.id,
          },
        },
        update: { isActive: true },
        create: {
          id: uuidv4(),
          beneficiaryId,
          vitalDefinitionId: v.id,
          isActive: true,
          frequency: 'every_visit',
        },
      });
    }
  }
}
