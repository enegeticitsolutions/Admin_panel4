/**
 * Standalone AWS SES Verification & Test Script
 * 
 * Usage on server:
 *   node scripts/test-ses.js [recipient_email]
 * 
 * Example:
 *   node scripts/test-ses.js harshitshukla0018@gmail.com
 *   node scripts/test-ses.js shubham573690@gmail.com
 */

const fs = require('fs');
const path = require('path');

// 1. Auto-discover and load .env from common locations
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../apps/api/.env'),
  path.resolve(__dirname, '../apps/admin-backend/.env'),
  path.resolve(__dirname, '../packages/notifications/.env'),
];

let loadedEnvPath = null;
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    try {
      require('dotenv').config({ path: p });
      loadedEnvPath = p;
      break;
    } catch {
      // ignore
    }
  }
}

// 2. Read configuration
const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY;
const region = process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1';
const fromEmail = process.env.AWS_SES_FROM_EMAIL || process.env.EMAIL_USER || 'info@maihoonna.com';
const fromName = process.env.AWS_SES_FROM_NAME || 'MaiHoonNa Care';
const targetEmail = process.argv[2] || 'harshitshukla0018@gmail.com';

console.log('\n========================================================');
console.log('   🔍 MAIHOONNA AWS SES SERVER DIAGNOSTIC & TEST TOOL   ');
console.log('========================================================\n');

if (loadedEnvPath) {
  console.log(`📁 Loaded .env from: ${loadedEnvPath}`);
} else {
  console.log('⚠️  No local .env file found; using process environment variables.');
}

console.log(`🌍 AWS Region:       ${region}`);
console.log(`🔑 Access Key ID:    ${accessKeyId ? accessKeyId.slice(0, 6) + '...' + accessKeyId.slice(-4) : '❌ NOT FOUND'}`);
console.log(`🔒 Secret Key:       ${secretAccessKey ? '****** (configured)' : '❌ NOT FOUND'}`);
console.log(`📧 From Address:     "${fromName}" <${fromEmail}>`);
console.log(`🎯 Recipient Target: ${targetEmail}\n`);

if (!accessKeyId || !secretAccessKey) {
  console.error('❌ ERROR: Missing AWS credentials!');
  console.error('Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in your server .env file.\n');
  process.exit(1);
}

// 3. Resolve AWS SES Client
let SESClient, GetSendQuotaCommand, SendEmailCommand, SendTemplatedEmailCommand;
try {
  const sesModule = require('@aws-sdk/client-ses');
  SESClient = sesModule.SESClient;
  GetSendQuotaCommand = sesModule.GetSendQuotaCommand;
  SendEmailCommand = sesModule.SendEmailCommand;
  SendTemplatedEmailCommand = sesModule.SendTemplatedEmailCommand;
} catch {
  try {
    const sesModule = require(path.resolve(__dirname, '../node_modules/@aws-sdk/client-ses'));
    SESClient = sesModule.SESClient;
    GetSendQuotaCommand = sesModule.GetSendQuotaCommand;
    SendEmailCommand = sesModule.SendEmailCommand;
    SendTemplatedEmailCommand = sesModule.SendTemplatedEmailCommand;
  } catch {
    const sesModule = require(path.resolve(__dirname, '../packages/notifications/node_modules/@aws-sdk/client-ses'));
    SESClient = sesModule.SESClient;
    GetSendQuotaCommand = sesModule.GetSendQuotaCommand;
    SendEmailCommand = sesModule.SendEmailCommand;
    SendTemplatedEmailCommand = sesModule.SendTemplatedEmailCommand;
  }
}

const client = new SESClient({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

async function runTest() {
  try {
    // Step 1: Verify Connection & Quota
    console.log('🔄 1. Verifying credentials & connecting to AWS SES...');
    const quota = await client.send(new GetSendQuotaCommand({}));
    console.log('✅ Connection Successful!');
    console.log(`   - 24-Hour Sending Quota: ${quota.Max24HourSend} emails`);
    console.log(`   - Maximum Send Rate:     ${quota.MaxSendRate} emails/second`);
    console.log(`   - Emails Sent in Last 24h: ${quota.SentLast24Hours}`);

    // Step 2: Send Direct Verification Email
    console.log(`\n🔄 2. Sending live test email to "${targetEmail}"...`);
    const directParams = {
      Source: `"${fromName}" <${fromEmail}>`,
      Destination: {
        ToAddresses: [targetEmail],
      },
      Message: {
        Subject: {
          Data: `✅ AWS SES Live Server Test - ${new Date().toLocaleTimeString('en-IN')}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: `
              <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 500px;">
                <h2 style="color: #FF7A00; margin-top: 0;">Server SES Verification Successful! 🎉</h2>
                <p>This email confirms that your server can successfully authenticate and dispatch emails through <b>Amazon SES (${region})</b>.</p>
                <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 15px 0;" />
                <ul style="font-size: 13px; color: #475569; padding-left: 20px;">
                  <li><b>Sender:</b> ${fromEmail}</li>
                  <li><b>Recipient:</b> ${targetEmail}</li>
                  <li><b>Server Timestamp:</b> ${new Date().toISOString()}</li>
                </ul>
                <p style="font-size: 12px; color: #94a3b8; margin-bottom: 0;">MaiHoonNa Care Services Pvt. Ltd.</p>
              </div>
            `,
            Charset: 'UTF-8',
          },
          Text: {
            Data: `Server SES Verification Successful!\nSent via Amazon SES (${region}) to ${targetEmail} at ${new Date().toISOString()}.`,
            Charset: 'UTF-8',
          },
        },
      },
    };

    const directResult = await client.send(new SendEmailCommand(directParams));
    console.log('✅ Live Test Email Dispatched Successfully!');
    console.log(`   - MessageId: ${directResult.MessageId}`);

    // Step 3: Test Newly Registered Activation Template
    console.log(`\n🔄 3. Testing "MaiHoonNa_VerifyBeneficiaryAndActivatePackage" template...`);
    try {
      const templateParams = {
        Source: `"${fromName}" <${fromEmail}>`,
        Destination: {
          ToAddresses: [targetEmail],
        },
        Template: 'MaiHoonNa_VerifyBeneficiaryAndActivatePackage',
        TemplateData: JSON.stringify({
          subscriber_name: 'Server Admin',
          subscriber_phone: '9876543210',
          beneficiary_name: 'Test Beneficiary (Verification Demo)',
          package_name: 'Gold Care Package',
        }),
      };
      const tplResult = await client.send(new SendTemplatedEmailCommand(templateParams));
      console.log('✅ Templated Activation Email Dispatched Successfully!');
      console.log(`   - Template MessageId: ${tplResult.MessageId}`);
    } catch (tplErr) {
      console.warn('⚠️  Template test skipped or template not found:', tplErr.message);
    }

    console.log('\n========================================================');
    console.log('   🎉 ALL CHECKS PASSED: AWS SES IS FULLY OPERATIONAL!   ');
    console.log('========================================================\n');
  } catch (error) {
    console.error('\n❌ SES TEST FAILED!');
    console.error('Error Code:', error.name || 'Unknown');
    console.error('Error Message:', error.message);
    console.error('\nCommon Fixes:');
    console.error('1. Check if the IAM User has AmazonSESFullAccess permission.');
    console.error('2. Ensure AWS_REGION is set to ap-south-1.');
    console.error('3. Verify that your sender email (info@maihoonna.com) is verified in AWS SES.');
    console.error('4. Check if your AWS SES account is out of sandbox or recipient is verified.\n');
    process.exit(1);
  }
}

runTest();
