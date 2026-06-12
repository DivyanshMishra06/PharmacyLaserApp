// Generates a standalone HTML QA report from playwright-report/results.json
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultsPath = join(__dirname, 'playwright-report', 'results.json');

let raw;
try {
  raw = JSON.parse(readFileSync(resultsPath, 'utf-8'));
} catch {
  console.error('No results.json found. Run: npx playwright test first.');
  process.exit(1);
}

// ── Parse results ────────────────────────────────────────────────────────────
const suites = raw.suites || [];
const allTests = [];

function collectTests(suite, suitePath = []) {
  const path = [...suitePath, suite.title].filter(Boolean);
  for (const spec of (suite.specs || [])) {
    for (const test of (spec.tests || [])) {
      const status = test.results?.[0]?.status ?? 'unknown';
      allTests.push({
        suite:    path.join(' › '),
        title:    spec.title,
        status,  // 'passed' | 'failed' | 'timedOut' | 'skipped'
        duration: test.results?.[0]?.duration ?? 0,
        error:    test.results?.[0]?.error?.message ?? '',
      });
    }
  }
  for (const child of (suite.suites || [])) collectTests(child, path);
}

for (const suite of suites) collectTests(suite);

const passed   = allTests.filter((t) => t.status === 'passed');
const failed   = allTests.filter((t) => t.status === 'failed' || t.status === 'timedOut');
const skipped  = allTests.filter((t) => t.status === 'skipped');
const total    = allTests.length;
const passRate = total > 0 ? ((passed.length / total) * 100).toFixed(1) : '0';

// ── Group by describe block ───────────────────────────────────────────────────
const byDescribe = {};
for (const t of allTests) {
  const key = t.suite || 'Uncategorised';
  (byDescribe[key] = byDescribe[key] || []).push(t);
}

// ── Go-live verdict ───────────────────────────────────────────────────────────
const criticalFailed = failed.filter((t) =>
  !t.title.includes('[KNOWN BUG]') &&
  !t.title.includes('[BUG-DOC]')
);

const verdict = criticalFailed.length === 0 && parseFloat(passRate) >= 85
  ? { label: 'GO LIVE ✓', cls: 'green', text: 'All critical checks passed. Proceed with caution on noted issues.' }
  : parseFloat(passRate) >= 60
  ? { label: 'CONDITIONAL', cls: 'yellow', text: 'Some failures found. Address issues before go-live.' }
  : { label: 'NOT READY', cls: 'red', text: 'Critical test failures detected. Do not go live.' };

// ── HTML ─────────────────────────────────────────────────────────────────────
function statusBadge(status) {
  if (status === 'passed')  return '<span class="badge pass">PASS</span>';
  if (status === 'skipped') return '<span class="badge skip">SKIP</span>';
  return '<span class="badge fail">FAIL</span>';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

const groupRows = Object.entries(byDescribe).map(([describe, tests]) => {
  const gPass = tests.filter((t) => t.status === 'passed').length;
  const gFail = tests.filter((t) => t.status !== 'passed' && t.status !== 'skipped').length;
  const rows  = tests.map((t) => `
    <tr class="${t.status === 'passed' ? '' : 'row-fail'}">
      <td class="test-title">${escHtml(t.title)}</td>
      <td>${statusBadge(t.status)}</td>
      <td class="duration">${(t.duration / 1000).toFixed(1)}s</td>
      <td class="error-msg">${t.error ? `<details><summary>Error</summary><pre>${escHtml(t.error.slice(0, 400))}</pre></details>` : ''}</td>
    </tr>`).join('');
  return `
  <div class="section">
    <div class="section-header">
      <h2>${escHtml(describe)}</h2>
      <span class="badge ${gFail === 0 ? 'pass' : 'fail'}">${gPass}/${tests.length} passed</span>
    </div>
    <table>
      <thead><tr><th>Test</th><th>Result</th><th>Duration</th><th>Details</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}).join('');

const knownBugs = [
  { id: 'BUG-001', sev: 'Low', title: 'selling_rate always stored as MRP', detail: 'In useSales.ts line 68, selling_rate = parseFloat(med.mrp) ignores any actual selling rate entered. Margin reports will always show 0% margin per medicine.' },
  { id: 'BUG-002', sev: 'Medium', title: 'Edit modal only updates first medicine in multi-medicine invoice', detail: 'updateSale() in useSales.ts always uses medicines[0]. Editing a multi-medicine invoice from the Sales List only saves changes to the first medicine row.' },
  { id: 'BUG-003', sev: 'Low', title: 'Reports.tsx: setState called synchronously in useEffect', detail: 'Suppressed ESLint rule react-hooks/set-state-in-effect. May cause cascading renders and perceived lag in report tab switching.' },
  { id: 'BUG-004', sev: 'Low', title: 'Schema SQL missing mobile_number, batch_number, expiry_date, discount, bill_discount columns', detail: 'schema.sql does not include ALTER TABLE statements for these fields, so running schema.sql on a fresh DB will create a broken table. These columns must exist or INSERTs will fail silently.' },
];

const bugRows = knownBugs.map((b) => `
  <tr>
    <td><code>${b.id}</code></td>
    <td><span class="badge ${b.sev === 'Medium' ? 'warn' : 'info'}">${b.sev}</span></td>
    <td>${escHtml(b.title)}</td>
    <td class="error-msg">${escHtml(b.detail)}</td>
  </tr>`).join('');

const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'full', timeStyle: 'short' });

const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PharmacyLaserApp — QA Go/No-Go Report</title>
  <style>
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f0f4f8;color:#1a202c}
    header{background:linear-gradient(135deg,#1a365d,#2b6cb0);color:#fff;padding:28px 40px}
    header h1{font-size:1.75rem;font-weight:700}
    header p{margin-top:6px;opacity:.8;font-size:.9rem}
    .container{max-width:1100px;margin:32px auto;padding:0 24px}
    .verdict{border-radius:12px;padding:24px 28px;margin-bottom:28px;display:flex;align-items:center;gap:20px;box-shadow:0 2px 8px rgba(0,0,0,.1)}
    .verdict.green{background:#c6f6d5;border-left:6px solid #38a169}
    .verdict.yellow{background:#fefcbf;border-left:6px solid #d69e2e}
    .verdict.red{background:#fed7d7;border-left:6px solid #e53e3e}
    .verdict-label{font-size:2rem;font-weight:800}
    .verdict.green .verdict-label{color:#276749}
    .verdict.yellow .verdict-label{color:#744210}
    .verdict.red .verdict-label{color:#742a2a}
    .verdict-text{font-size:.95rem;color:#4a5568;margin-top:4px}
    .summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:28px}
    .card{background:#fff;border-radius:10px;padding:20px 24px;box-shadow:0 1px 4px rgba(0,0,0,.08);border-top:4px solid}
    .card.green{border-color:#38a169}.card.red{border-color:#e53e3e}.card.yellow{border-color:#d69e2e}.card.blue{border-color:#3182ce}
    .card .val{font-size:2.2rem;font-weight:700;line-height:1}
    .card.green .val{color:#38a169}.card.red .val{color:#e53e3e}.card.yellow .val{color:#d69e2e}.card.blue .val{color:#3182ce}
    .card .lbl{font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;margin-top:4px}
    .section{background:#fff;border-radius:10px;box-shadow:0 1px 4px rgba(0,0,0,.08);margin-bottom:20px;overflow:hidden}
    .section-header{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid #e2e8f0}
    .section-header h2{font-size:.95rem;font-weight:600}
    h3{font-size:1rem;font-weight:600;padding:16px 20px 8px;color:#2d3748}
    table{width:100%;border-collapse:collapse}
    thead th{background:#f7fafc;font-size:.72rem;text-transform:uppercase;letter-spacing:.06em;color:#718096;padding:10px 16px;text-align:left;border-bottom:1px solid #e2e8f0}
    tbody td{padding:10px 16px;font-size:.83rem;border-bottom:1px solid #edf2f7;vertical-align:top}
    tbody tr:last-child td{border-bottom:none}
    tbody tr.row-fail{background:#fff5f5}
    .test-title{font-size:.82rem;color:#2d3748;max-width:380px}
    .duration{color:#a0aec0;white-space:nowrap}
    .error-msg{font-size:.75rem;color:#718096;max-width:360px}
    .error-msg pre{white-space:pre-wrap;font-size:.72rem;color:#c53030;background:#fff5f5;padding:8px;border-radius:4px;margin-top:4px}
    .badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700}
    .badge.pass{background:#c6f6d5;color:#276749}
    .badge.fail{background:#fed7d7;color:#742a2a}
    .badge.skip{background:#e2e8f0;color:#4a5568}
    .badge.warn{background:#fefcbf;color:#744210}
    .badge.info{background:#bee3f8;color:#2a4365}
    footer{text-align:center;font-size:.75rem;color:#a0aec0;padding:28px}
    details summary{cursor:pointer;color:#3182ce;font-size:.75rem}
    code{font-family:monospace;background:#edf2f7;padding:1px 4px;border-radius:3px;font-size:.8rem}
  </style>
</head>
<body>
<header>
  <h1>PharmacyLaserApp — QA Go/No-Go Report</h1>
  <p>E2E Test Suite · Playwright · Generated: ${now}</p>
</header>

<div class="container">

  <!-- Verdict -->
  <div class="verdict ${verdict.cls}">
    <div>
      <div class="verdict-label">${verdict.label}</div>
      <div class="verdict-text">${verdict.text}</div>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="summary">
    <div class="card ${parseFloat(passRate) >= 85 ? 'green' : parseFloat(passRate) >= 60 ? 'yellow' : 'red'}">
      <div class="val">${passRate}%</div>
      <div class="lbl">Pass Rate</div>
    </div>
    <div class="card green"><div class="val">${passed.length}</div><div class="lbl">Tests Passed</div></div>
    <div class="card red"><div class="val">${failed.length}</div><div class="lbl">Tests Failed</div></div>
    <div class="card yellow"><div class="val">${skipped.length}</div><div class="lbl">Skipped</div></div>
    <div class="card blue"><div class="val">${total}</div><div class="lbl">Total Tests</div></div>
  </div>

  <!-- Known Bugs -->
  <h3>Known Bugs (Code Review Findings)</h3>
  <div class="section">
    <div class="section-header"><h2>Pre-existing Issues Found During QA</h2><span class="badge warn">${knownBugs.length} issues</span></div>
    <table>
      <thead><tr><th>ID</th><th>Severity</th><th>Issue</th><th>Detail</th></tr></thead>
      <tbody>${bugRows}</tbody>
    </table>
  </div>

  <!-- Test Results by Suite -->
  <h3>Test Results by Suite</h3>
  ${groupRows}

</div>
<footer>PharmacyLaserApp QA Report · ${now}</footer>
</body>
</html>`;

const outPath = join(__dirname, 'qa-report.html');
writeFileSync(outPath, html, 'utf-8');
console.log(`\nQA Report written to: ${outPath}`);
console.log(`Pass rate: ${passRate}% (${passed.length}/${total})`);
console.log(`Verdict: ${verdict.label}`);
