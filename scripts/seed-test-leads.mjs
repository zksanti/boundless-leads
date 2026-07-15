// Temporary verification script: inserts one clearly-marked test lead per
// discovery segment (status=accepted, varied stages) so the CRM band layout
// can be checked, or deletes them with --clean. Safe on the shared DB: only
// touches rows whose company_name starts with '[TEST]'.
import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.POSTGRES_URL)

if (process.argv.includes('--clean')) {
  const rows = await sql`DELETE FROM leads WHERE company_name LIKE '[TEST]%' RETURNING id`
  console.log(`deleted ${rows.length} test leads`)
  process.exit(0)
}

const testLeads = [
  { name: '[TEST] Platform Co', segment: 'platforms', use_case: 'batch', stage: 'needs_outreach' },
  { name: '[TEST] MediaGen Co', segment: 'media_gen', use_case: 'media', stage: 'replied' },
  { name: '[TEST] AgentPT Co', segment: 'agents_pt', use_case: 'agents', stage: 'in_evaluation' },
]

for (const t of testLeads) {
  const rows = await sql`
    INSERT INTO leads (company_name, website_url, company_linkedin_url, description, signal, use_case, segment, tier, status, crm_stage, swiped_at)
    VALUES (${t.name}, 'https://example.com', 'https://www.linkedin.com/company/example', 'Test lead for CRM band verification', 'test signal', ${t.use_case}, ${t.segment}, 1, 'accepted', ${t.stage}, NOW())
    RETURNING id
  `
  await sql`
    INSERT INTO contacts (lead_id, name, title, email, linkedin_url, is_primary)
    VALUES (${rows[0].id}, 'Test Person', 'CTO', 'test@example.com', '', TRUE)
  `
  console.log(`inserted ${t.name} (${t.segment}, ${t.stage})`)
}
