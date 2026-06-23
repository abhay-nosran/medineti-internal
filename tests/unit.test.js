// Unit tests for server.js helper functions
// Functions are inlined here — server.js is not modified.
import { describe, it, expect } from 'vitest';

// ─── Inlined helpers from server.js ───────────────────────────────────────────

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function isDbConnectionError(err) {
    if (!err) return false;
    const code = err.code || '';
    const msg  = (err.message || '').toLowerCase();
    return code === 'ECONNREFUSED'
        || code === 'ETIMEDOUT'
        || msg.includes('connect');
}

function pageShell(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — MediNeti Outreach</title>
  <link rel="stylesheet" href="/css/main.css">
</head>
<body>
<div class="page-card">
  <div class="page-header">
    <h1>MediNeti Outreach System</h1>
    <p>NABH Renewal Campaign Management Portal</p>
  </div>
  <div class="page-content">
    ${bodyHtml}
  </div>
  <div class="page-footer">
    MediNeti Healthcare Solutions • Outreach Management System
  </div>
</div>
</body>
</html>`;
}

function errorPage(title, message, { details = [], stack = '', statusCode = 500 } = {}) {
    const subtitleMap = { 400: '400 – Bad Request', 404: '404 – Not Found', 500: '500 – Server Error' };
    const subtitle = subtitleMap[statusCode] || `${statusCode} – Error`;
    const truncated = String(message).slice(0, 500);
    const body = `
        <a href="/" class="back-link">← Back to Dashboard</a>
        <h2 class="text-danger">${escapeHtml(title)}</h2>
        <p style="color:#64748b;margin:4px 0 16px;">${escapeHtml(subtitle)}</p>
        <p>${escapeHtml(truncated)}</p>
        ${details.length > 0 ? `<ul>${details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
        ${stack ? `<pre style="overflow:auto;background:#f8fafc;padding:16px;border-radius:8px;font-size:0.85rem;margin-top:16px;">${escapeHtml(stack)}</pre>` : ''}
    `;
    return pageShell(title, body);
}

function campaignReportPage(report) {
    const backLink = `<a href="/" class="back-link">← Back to Dashboard</a>`;
    const failures = report.failures || [];
    const body = `
        ${backLink}
        <h2>Email Campaign Report</h2>
        <div style="margin:16px 0;display:flex;gap:12px;flex-wrap:wrap;">
            <span>Total Contacts: <strong>${escapeHtml(report.total_contacts)}</strong></span>
            <span class="badge-success">Sent: ${escapeHtml(report.sent_count)}</span>
            <span class="badge-danger">Failed: ${escapeHtml(report.failed_count)}</span>
        </div>
        ${report.total_contacts === 0 ? `<div class="info-box">No pending contacts found. All contacts may have already been sent an email.</div>` : ''}
        ${failures.length > 0 ? `
            <h3 style="margin-top:24px;">Failed Emails</h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email</th><th>Error</th></tr></thead>
                    <tbody>${failures.map(f => `<tr><td>${escapeHtml(f.hcos_id)}</td><td>${escapeHtml(f.hospital)}</td><td>${escapeHtml(f.email)}</td><td>${escapeHtml(f.error)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        ` : (report.sent_count > 0 ? `<div class="info-box" style="border-left:4px solid #16a34a;background:#f0fdf4;">All emails sent successfully — no failures.</div>` : '')}
        ${backLink}
    `;
    return pageShell('Email Campaign Report', body);
}

function testEmailReportPage(result) {
    const contact = result.contact || {};
    const resendId = result.resend_response?.data?.id;
    const body = `
        <a href="/" class="back-link">← Back to Dashboard</a>
        <div class="info-box" style="border-left:4px solid #16a34a;background:#f0fdf4;margin-bottom:16px;">Test email sent successfully.</div>
        <div class="info-box">
            <p><strong>Hospital Name:</strong> ${escapeHtml(contact.hname)}</p>
            <p><strong>Email Address:</strong> ${escapeHtml(contact.email)}</p>
            <p><strong>HCOS ID:</strong> ${escapeHtml(contact.hcos_id)}</p>
            ${resendId ? `<p><strong>Resend Response ID:</strong> ${escapeHtml(resendId)}</p>` : ''}
        </div>
    `;
    return pageShell('Test Email Report', body);
}

function uploadResultPage(summary) {
    const inserted = summary.inserted || [];
    const alreadyExists = summary.alreadyExists || [];
    const skipped = summary.skipped || [];
    const MAX = 500;
    const backLink = `<a href="/" class="back-link">← Back to Dashboard</a>`;
    const body = `
        ${backLink}
        <h2>Upload Results</h2>
        <div style="margin:16px 0;display:flex;gap:12px;flex-wrap:wrap;">
            <span class="badge-success">Inserted: ${inserted.length}</span>
            <span class="badge-warning">Already Exists: ${alreadyExists.length}</span>
            <span class="badge-danger">Skipped: ${skipped.length}</span>
        </div>
        ${inserted.length === 0 && alreadyExists.length === 0 && skipped.length === 0 ? `<div class="warning-box">The uploaded file contained no data rows.</div>` : ''}
        ${inserted.length > 0 ? `<h3 style="margin-top:24px;">Inserted Records (${inserted.length})</h3>${inserted.length > MAX ? `<p style="color:#64748b;font-size:0.85rem;">Showing first ${MAX} of ${inserted.length} rows.</p>` : ''}<div class="table-wrapper"><table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email Address</th></tr></thead><tbody>${inserted.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td><td>${escapeHtml(r.email)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${alreadyExists.length > 0 ? `<h3 style="margin-top:24px;">Already Exists (${alreadyExists.length})</h3>${alreadyExists.length > MAX ? `<p>Showing first ${MAX} of ${alreadyExists.length} rows.</p>` : ''}<div class="table-wrapper"><table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th></tr></thead><tbody>${alreadyExists.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${skipped.length > 0 ? `<h3 style="margin-top:24px;">Skipped Records (${skipped.length})</h3>${skipped.length > MAX ? `<p>Showing first ${MAX} of ${skipped.length} rows.</p>` : ''}<div class="table-wrapper"><table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Reason</th></tr></thead><tbody>${skipped.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id || '—')}</td><td>${escapeHtml(r.hname || r.row?.hname || '—')}</td><td>${escapeHtml(r.reason)}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${backLink}
    `;
    return pageShell('Upload Results', body);
}

// ─── Task 10.1 — escapeHtml ───────────────────────────────────────────────────

describe('escapeHtml', () => {
    it('replaces & with &amp;', () => {
        expect(escapeHtml('a & b')).toBe('a &amp; b');
    });

    it('replaces < with &lt;', () => {
        expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
    });

    it('replaces > with &gt;', () => {
        expect(escapeHtml('a > b')).toBe('a &gt; b');
    });

    it('replaces " with &quot;', () => {
        expect(escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
    });

    it("replaces ' with &#39;", () => {
        expect(escapeHtml("it's")).toBe('it&#39;s');
    });

    it('handles all special characters combined', () => {
        expect(escapeHtml('& < > " \'')).toBe('&amp; &lt; &gt; &quot; &#39;');
    });

    it('converts null to the string "null" without throwing', () => {
        expect(escapeHtml(null)).toBe('null');
    });

    it('converts undefined to the string "undefined" without throwing', () => {
        expect(escapeHtml(undefined)).toBe('undefined');
    });

    it('converts number 42 to string "42"', () => {
        expect(escapeHtml(42)).toBe('42');
    });

    it('converts boolean true to string "true"', () => {
        expect(escapeHtml(true)).toBe('true');
    });

    it('converts [] to a string without throwing', () => {
        expect(() => escapeHtml([])).not.toThrow();
        expect(typeof escapeHtml([])).toBe('string');
    });

    it('converts {} to a string without throwing', () => {
        expect(() => escapeHtml({})).not.toThrow();
        expect(typeof escapeHtml({})).toBe('string');
    });
});

// ─── Task 10.2 — pageShell ────────────────────────────────────────────────────

describe('pageShell', () => {
    it('output contains the shared stylesheet link', () => {
        const html = pageShell('Test Title', '<p>body</p>');
        expect(html).toContain('<link rel="stylesheet" href="/css/main.css">');
    });

    it('output contains no <style> tags', () => {
        const html = pageShell('Test Title', '<p>body</p>');
        expect(html).not.toMatch(/<style/i);
    });

    it('title appears in the <title> element (escaped)', () => {
        const html = pageShell('My <Page>', '<p>body</p>');
        expect(html).toContain('My &lt;Page&gt; — MediNeti Outreach');
    });

    it('bodyHtml is injected into page-content', () => {
        const html = pageShell('T', '<span id="injected">hello</span>');
        expect(html).toContain('<span id="injected">hello</span>');
    });
});

// ─── Task 10.3 — isDbConnectionError ─────────────────────────────────────────

describe('isDbConnectionError', () => {
    it('returns true for { code: "ECONNREFUSED" }', () => {
        expect(isDbConnectionError({ code: 'ECONNREFUSED' })).toBe(true);
    });

    it('returns true for { code: "ETIMEDOUT" }', () => {
        expect(isDbConnectionError({ code: 'ETIMEDOUT' })).toBe(true);
    });

    it('returns true when message contains "connect" (exact case)', () => {
        expect(isDbConnectionError({ message: 'connect ECONNREFUSED 127.0.0.1' })).toBe(true);
    });

    it('returns true when message contains "connect" (mixed case — case-insensitive)', () => {
        expect(isDbConnectionError({ message: 'Connection refused' })).toBe(true);
    });

    it('returns false for an unrelated error code and message', () => {
        expect(isDbConnectionError({ code: 'OTHER', message: 'some error' })).toBe(false);
    });

    it('returns false for null', () => {
        expect(isDbConnectionError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isDbConnectionError(undefined)).toBe(false);
    });
});

// ─── Task 11.1 — errorPage ────────────────────────────────────────────────────

describe('errorPage', () => {
    it('status 400 → subtitle contains "400 – Bad Request"', () => {
        const html = errorPage('Bad', 'msg', { statusCode: 400 });
        expect(html).toContain('400 – Bad Request');
    });

    it('status 404 → subtitle contains "404 – Not Found"', () => {
        const html = errorPage('NotFound', 'msg', { statusCode: 404 });
        expect(html).toContain('404 – Not Found');
    });

    it('status 500 → subtitle contains "500 – Server Error"', () => {
        const html = errorPage('Error', 'msg', { statusCode: 500 });
        expect(html).toContain('500 – Server Error');
    });

    it('unknown status 418 → subtitle contains "418 – Error"', () => {
        const html = errorPage('Teapot', 'msg', { statusCode: 418 });
        expect(html).toContain('418 – Error');
    });

    it('when stack provided → <pre> tag is present in output', () => {
        const html = errorPage('Err', 'msg', { stack: 'Error\n  at fn (file.js:1)' });
        expect(html).toContain('<pre');
    });

    it('when stack provided → stack content is HTML-escaped in output', () => {
        const html = errorPage('Err', 'msg', { stack: '<script>alert(1)</script>' });
        expect(html).toContain('&lt;script&gt;');
        expect(html).not.toContain('<script>alert(1)</script>');
    });

    it('when details is empty → <ul> is NOT present', () => {
        const html = errorPage('Err', 'msg', { details: [] });
        expect(html).not.toContain('<ul>');
    });

    it('when details provided → <ul> IS present with escaped items', () => {
        const html = errorPage('Err', 'msg', { details: ['first detail', 'second detail'] });
        expect(html).toContain('<ul>');
        expect(html).toContain('<li>first detail</li>');
        expect(html).toContain('<li>second detail</li>');
    });

    it('back link href="/" is present', () => {
        const html = errorPage('Err', 'msg');
        expect(html).toContain('href="/"');
    });
});

// ─── Task 11.2 — campaignReportPage ──────────────────────────────────────────

describe('campaignReportPage', () => {
    it('when total_contacts === 0 → "No pending contacts found" info banner is present', () => {
        const html = campaignReportPage({
            total_contacts: 0,
            sent_count: 0,
            failed_count: 0,
            failures: []
        });
        expect(html).toContain('No pending contacts found');
    });

    it('when failures is empty and sent_count > 0 → success banner is present', () => {
        const html = campaignReportPage({
            total_contacts: 5,
            sent_count: 5,
            failed_count: 0,
            failures: []
        });
        expect(html).toContain('All emails sent successfully');
    });

    it('when failures.length > 0 → failures table with 4 <th> headers is present', () => {
        const html = campaignReportPage({
            total_contacts: 2,
            sent_count: 1,
            failed_count: 1,
            failures: [{
                hcos_id: '001',
                hospital: 'Test Hospital',
                email: 'test@example.com',
                error: 'SMTP error'
            }]
        });
        const thMatches = html.match(/<th>/g) || [];
        expect(thMatches.length).toBeGreaterThanOrEqual(4);
        expect(html).toContain('<th>HCOS ID</th>');
        expect(html).toContain('<th>Hospital Name</th>');
        expect(html).toContain('<th>Email</th>');
        expect(html).toContain('<th>Error</th>');
    });

    it('back links (href="/") appear at least twice', () => {
        const html = campaignReportPage({
            total_contacts: 1,
            sent_count: 1,
            failed_count: 0,
            failures: []
        });
        const matches = html.match(/href="\/"/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});

// ─── Task 11.3 — testEmailReportPage ─────────────────────────────────────────

describe('testEmailReportPage', () => {
    const baseResult = {
        contact: {
            hcos_id: 'HC001',
            hname: 'City Hospital',
            email: 'admin@cityhospital.com'
        },
        resend_response: null
    };

    it('success banner "Test email sent successfully" is present', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).toContain('Test email sent successfully');
    });

    it('hospital name appears in the output', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).toContain('City Hospital');
    });

    it('email address appears in the output', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).toContain('admin@cityhospital.com');
    });

    it('HCOS ID appears in the output', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).toContain('HC001');
    });

    it('when resendId is present → Resend Response ID line is displayed', () => {
        const result = {
            ...baseResult,
            resend_response: { data: { id: 'resend-abc-123' } }
        };
        const html = testEmailReportPage(result);
        expect(html).toContain('Resend Response ID');
        expect(html).toContain('resend-abc-123');
    });

    it('when resendId is absent → Resend Response ID line is NOT displayed', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).not.toContain('Resend Response ID');
    });

    it('back link href="/" is present', () => {
        const html = testEmailReportPage(baseResult);
        expect(html).toContain('href="/"');
    });
});

// ─── Task 11.4 — uploadResultPage ────────────────────────────────────────────

describe('uploadResultPage', () => {
    it('when all lists empty → warning banner "no data rows" is present', () => {
        const html = uploadResultPage({ inserted: [], alreadyExists: [], skipped: [] });
        expect(html).toContain('no data rows');
    });

    it('when inserted.length > 0 → inserted table is present', () => {
        const html = uploadResultPage({
            inserted: [{ hcos_id: '1', hname: 'Alpha Hospital', email: 'a@a.com' }],
            alreadyExists: [],
            skipped: []
        });
        expect(html).toContain('Inserted Records');
        expect(html).toContain('<th>Email Address</th>');
        expect(html).toContain('Alpha Hospital');
    });

    it('when alreadyExists.length > 0 → already-exists table is present', () => {
        const html = uploadResultPage({
            inserted: [],
            alreadyExists: [{ hcos_id: '2', hname: 'Beta Hospital' }],
            skipped: []
        });
        expect(html).toContain('Already Exists');
        expect(html).toContain('Beta Hospital');
    });

    it('when skipped.length > 0 → skipped table is present', () => {
        const html = uploadResultPage({
            inserted: [],
            alreadyExists: [],
            skipped: [{ hcos_id: '3', hname: 'Gamma Hospital', reason: 'Missing email' }]
        });
        expect(html).toContain('Skipped Records');
        expect(html).toContain('Gamma Hospital');
        expect(html).toContain('Missing email');
    });

    it('when inserted list has 501 entries → truncation notice "Showing first 500" is present', () => {
        const bigList = Array.from({ length: 501 }, (_, i) => ({
            hcos_id: String(i),
            hname: `Hospital ${i}`,
            email: `h${i}@test.com`
        }));
        const html = uploadResultPage({ inserted: bigList, alreadyExists: [], skipped: [] });
        expect(html).toContain('Showing first 500');
        // Only 500 rows should be rendered (not 501)
        const rowMatches = html.match(/Hospital 4\d\d/g) || [];
        expect(html).not.toContain('Hospital 500');
    });

    it('when alreadyExists list has 501 entries → truncation notice "Showing first 500" is present', () => {
        const bigList = Array.from({ length: 501 }, (_, i) => ({
            hcos_id: String(i),
            hname: `Clinic ${i}`
        }));
        const html = uploadResultPage({ inserted: [], alreadyExists: bigList, skipped: [] });
        expect(html).toContain('Showing first 500');
    });

    it('when skipped list has 501 entries → truncation notice "Showing first 500" is present', () => {
        const bigList = Array.from({ length: 501 }, (_, i) => ({
            hcos_id: String(i),
            hname: `Ward ${i}`,
            reason: 'bad data'
        }));
        const html = uploadResultPage({ inserted: [], alreadyExists: [], skipped: bigList });
        expect(html).toContain('Showing first 500');
    });

    it('back links (href="/") appear at least twice', () => {
        const html = uploadResultPage({
            inserted: [{ hcos_id: '1', hname: 'A', email: 'a@a.com' }],
            alreadyExists: [],
            skipped: []
        });
        const matches = html.match(/href="\/"/g) || [];
        expect(matches.length).toBeGreaterThanOrEqual(2);
    });
});
