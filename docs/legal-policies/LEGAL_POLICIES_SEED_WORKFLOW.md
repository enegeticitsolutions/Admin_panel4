# Legal Policies Database Seeding & Formatting Workflow

This document records the exact steps taken to migrate the legal policies from raw Word (`.docx`) files into the Supabase database, while preserving all internal formatting (tables, bold text, lists).

## The Goal
The primary objective was to move all legal policy text out of the frontend and into a database table (`legal_policies`), so that future updates only require a database update rather than a full website rebuild. Additionally, the content needed to exactly match the formatting of the original Word documents.

## Step 1: Converting `.docx` to HTML
We used the `mammoth` library to convert the raw Word documents into HTML files. This preserves semantic formatting like headings (`<h1>`), paragraphs (`<p>`), lists (`<ul>`), and tables (`<table>`).

The commands used were:
```bash
cd docs/legal-policies
npx --yes mammoth MaiHoonNa_Cookies_Policy_Website_App.docx cookie.html
npx --yes mammoth MaiHoonNa_Privacy_Policy_Website_App.docx privacy.html
npx --yes mammoth MaiHoonNa_Refund_Policy_Website_App.docx refund.html
npx --yes mammoth MaiHoonNa_Saathi_TC_Website_App_V2.docx saathi_tc.html
npx --yes mammoth MaiHoonNa_TnC_Website_App_V2.docx tnc.html
```
*Note: These `.html` files were left in the `docs/legal-policies/` folder for future reference and migrations.*

## Step 2: Generating the Seed Script
Instead of manually copying and escaping large blocks of HTML, we created a Node script (`generate-seed.js`) to automatically read the HTML files and regenerate the `apps/api/seed-legal-policies.ts` typescript file.

The script does the following:
1. Maps each HTML file to its respective database `slug` (e.g., `tnc.html` -> `terms`).
2. Escapes backticks and dollar signs to prevent JS template literal errors.
3. Builds the `initialPolicies` array, setting the `sections` field to a single object: 
   ```json
   { "id": "main", "isHtml": true, "content": "<raw html string>" }
   ```
4. Reads the existing `seed-legal-policies.ts` to preserve the previously hardcoded `child-safety` policy.
5. Writes the final code to `apps/api/seed-legal-policies.ts`.

*Note: The `generate-seed.js` script is preserved in the `docs/legal-policies/` directory for future use.*

## Step 3: Seeding the Database
Once the seed script was generated with the correct HTML payloads, we populated the database. 

From the `apps/api` directory, we ran:
```bash
npx ts-node seed-legal-policies.ts
```
This utilized Prisma's `upsert` function to create or update the policies in the `legal_policies` table.

## Step 4: Updating the Frontend (`LegalPage.jsx`)
To properly render the raw HTML stored in the database, we updated the `apps/website/src/pages/LegalPage.jsx` component.

1. **Rendering HTML:** We checked for the `isHtml` flag in the section. If true, we bypassed standard text rendering and used React's `dangerouslySetInnerHTML`:
   ```jsx
   {section.content && section.isHtml ? (
     <div 
       className="legal-html-content"
       style={{ color: "#334155" }}
       dangerouslySetInnerHTML={{ __html: section.content }} 
     />
   ) : section.content && (
     <div style={{ whiteSpace: "pre-line", color: "#334155" }}>
       {section.content}
     </div>
   )}
   ```
2. **Styling:** Because the HTML came directly from `mammoth`, it lacked CSS classes. We injected global styles for the `.legal-html-content` class directly into the page to ensure standard elements (tables, headers, lists) looked clean and matched the application's design system.
3. **Routing:** Added `saathi-tc` to the `HASH_MAP` and normalization logic so the "Saathi Volunteer Terms" could be linked directly via URL hashes.

## Future Updates
When policies change in the future:
1. Replace the `.docx` files in `docs/legal-policies/`.
2. Navigate to `docs/legal-policies/` and rerun the `mammoth` conversion (Step 1).
3. Rerun `node generate-seed.js` (Step 2) from within the `docs/legal-policies/` folder.
4. Navigate to `apps/api/` and run `npx ts-node seed-legal-policies.ts` (Step 3).
