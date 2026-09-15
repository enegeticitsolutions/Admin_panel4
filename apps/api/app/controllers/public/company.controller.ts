import { Request, Response } from 'express';
import prisma from '../../core/database';

export const getCompanyConfig = async (req: Request, res: Response) => {
  // Fetch specific keys related to company config, or we can just send hardcoded defaults if not found
  const configs = await prisma.systemConfig.findMany({
    where: {
      key: {
        in: [
          'COMPANY_NAME',
          'COMPANY_GSTIN',
          'COMPANY_PAN',
          'COMPANY_CIN',
          'COMPANY_ADDRESS',
          'COMPANY_EMAIL',
          'COMPANY_PHONE',
          'COMPANY_BANK_NAME',
          'COMPANY_BANK_ACCOUNT',
          'COMPANY_BANK_IFSC',
          'COMPANY_UPI_ID',
          'EMERGENCY_HELPLINE_NUMBER',
          'SATHI_COORDINATOR_NUMBER',
          'EMERGENCY_SERVICES_NUMBER'
        ]
      }
    }
  });

  // Default values mapping based on the template if missing from DB
  const defaultConfigs: Record<string, string> = {
    COMPANY_NAME: 'MaiHoonNa Eldercare Private Limited',
    COMPANY_ADDRESS: 'DLF Phase V, Gurugram, Haryana',
    COMPANY_GSTIN: '06AAUCM9447N1ZE',
    COMPANY_PAN: 'AAUCM9447N',
    COMPANY_CIN: 'U86900HR2026PTC145612',
    COMPANY_EMAIL: 'info@maihoonna.com',
    COMPANY_PHONE: '8507070049',
    COMPANY_BANK_NAME: 'HDFC Bank',
    COMPANY_BANK_ACCOUNT: '000000000000',
    COMPANY_BANK_IFSC: 'HDFC0000000',
    COMPANY_UPI_ID: 'maihoonna@upi',
    EMERGENCY_HELPLINE_NUMBER: '01142258823',
    SATHI_COORDINATOR_NUMBER: '+91 1244495435',
    EMERGENCY_SERVICES_NUMBER: '112'
  };

  const configMap = { ...defaultConfigs };
  
  for (const c of configs) {
    configMap[c.key] = c.value;
  }

  res.json({
    success: true,
    data: configMap
  });
};
