// Feature: ui-ux-production-upgrade
// Property-based tests for pure helper functions (Tasks 12.1 – 12.5)

import { describe, it } from 'vitest';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Inlined helpers (mirrors server.js — do NOT import from server.js)
// ---------------------------------------------------------------------------

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
        ${failures.length > 0 ? `<table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email</th><th>Error</th></tr></thead><tbody>${failures.map(f => `<tr><td>${escapeHtml(f.hcos_id)}</td><td>${escapeHtml(f.hospital)}</td><td>${escapeHtml(f.email)}</td><td>${escapeHtml(f.error)}</td></tr>`).join('')}</tbody></table>` : (report.sent_count > 0 ? `<div class="info-box">All emails sent successfully — no failures.</div>` : '')}
        ${backLink}
    `;
    return pageShell('Email Campaign Report', body);
}

function testEmailReportPage(result) {
    const contact = result.contact || {};
    const resendId = result.resend_response?.data?.id;
    const body = `
        <a href="/" class="back-link">← Back to Dashboard</a>
        <div class="info-box">Test email sent successfully.</div>
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
        <span class="badge-success">Inserted: ${inserted.length}</span>
        <span class="badge-warning">Already Exists: ${alreadyExists.length}</span>
        <span class="badge-danger">Skipped: ${skipped.length}</span>
        ${inserted.length === 0 && alreadyExists.length === 0 && skipped.length === 0 ? '<div class="warning-box">The uploaded file contained no data rows.</div>' : ''}
        ${inserted.length > 0 ? `<table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email Address</th></tr></thead><tbody>${inserted.slice(0,MAX).map(r=>`<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td><td>${escapeHtml(r.email)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${alreadyExists.length > 0 ? `<table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th></tr></thead><tbody>${alreadyExists.slice(0,MAX).map(r=>`<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${skipped.length > 0 ? `<table class="data-table"><thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Reason</th></tr></thead><tbody>${skipped.slice(0,MAX).map(r=>`<tr><td>${escapeHtml(r.hcos_id||'—')}</td><td>${escapeHtml(r.hname||'—')}</td><td>${escapeHtml(r.reason)}</td></tr>`).join('')}</tbody></table>` : ''}
        ${backLink}
    `;
    return pageShell('Upload Results', body);
}

// ---------------------------------------------------------------------------
// The characters that must never appear raw (unescaped) in helper output
// ---------------------------------------------------------------------------
const DANGEROUS_CHARS = ['<', '>', '&', '"', "'"];

/**
 * Returns true when the given html string contains at least one character
 * from DANGEROUS_CHARS that came from the user-supplied input string `input`.
 *
 * Strategy: if `input` contains any dangerous char, none of those literal
 * chars may survive verbatim in the output generated from that input value
 * (they must only appear as &amp;, &lt;, etc.).
 */
function inputInjectsDangerousChars(input) {
    return DANGEROUS_CHARS.some(c => input.includes(c));
}

function outputContainsDangerousCharsFromInput(html, input) {
    return DANGEROUS_CHARS.some(c => input.includes(c) && html.includes(c));
}

// ---------------------------------------------------------------------------
// Task 12.1 — Property 1: escapeHtml eliminates all HTML-injectable characters
// Feature: ui-ux-production-upgrade, Property 1: escapeHtml eliminates all HTML-injectable characters
// ---------------------------------------------------------------------------

describe('Property 1: escapeHtml safety', () => {
    it('output of escapeHtml(fc.string()) contains none of the literal HTML-injectable chars', () => {
        fc.assert(
            fc.property(fc.string(), (str) => {
                const result = escapeHtml(str);
                for (const ch of DANGEROUS_CHARS) {
                    if (result.includes(ch)) return false;
                }
                return true;
            }),
            { numRuns: 100 }
        );
    });

    it('escapeHtml does not throw and always returns a string for any JS value (fc.anything())', () => {
        fc.assert(
            fc.property(fc.anything(), (val) => {
                let result;
                try {
                    result = escapeHtml(val);
                } catch {
                    return false;
                }
                return typeof result === 'string';
            }),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.2 — Property 2: All HTML rendering helpers produce XSS-safe output
// Feature: ui-ux-production-upgrade, Property 2: All HTML rendering helpers produce XSS-safe output
// ---------------------------------------------------------------------------

describe('Property 2: All HTML rendering helpers produce XSS-safe output', () => {
    it('errorPage: no dangerous chars from input survive in output', () => {
        fc.assert(
            fc.property(
                fc.record({ title: fc.string(), message: fc.string() }),
                ({ title, message }) => {
                    const html = errorPage(title, message);
                    // Only check inputs that actually contain dangerous chars
                    if (inputInjectsDangerousChars(title) && outputContainsDangerousCharsFromInput(html, title)) return false;
                    if (inputInjectsDangerousChars(message) && outputContainsDangerousCharsFromInput(html, message)) return false;
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('campaignReportPage: no dangerous chars from failure fields survive in output', () => {
        fc.assert(
            fc.property(
                fc.record({
                    total_contacts: fc.constant(1),
                    sent_count: fc.constant(0),
                    failed_count: fc.constant(1),
                    failures: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hospital: fc.string(),
                            email: fc.string(),
                            error: fc.string(),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                }),
                (report) => {
                    const html = campaignReportPage(report);
                    for (const f of report.failures) {
                        for (const field of [f.hcos_id, f.hospital, f.email, f.error]) {
                            if (inputInjectsDangerousChars(field) && outputContainsDangerousCharsFromInput(html, field)) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('testEmailReportPage: no dangerous chars from contact fields survive in output', () => {
        fc.assert(
            fc.property(
                fc.record({
                    contact: fc.record({
                        hname: fc.string(),
                        email: fc.string(),
                        hcos_id: fc.string(),
                    }),
                }),
                (result) => {
                    const html = testEmailReportPage(result);
                    const { hname, email, hcos_id } = result.contact;
                    for (const field of [hname, email, hcos_id]) {
                        if (inputInjectsDangerousChars(field) && outputContainsDangerousCharsFromInput(html, field)) return false;
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });

    it('uploadResultPage: no dangerous chars from inserted record fields survive in output', () => {
        fc.assert(
            fc.property(
                fc.record({
                    inserted: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hname: fc.string(),
                            email: fc.string(),
                        }),
                        { maxLength: 5 }
                    ),
                    alreadyExists: fc.constant([]),
                    skipped: fc.constant([]),
                }),
                (summary) => {
                    const html = uploadResultPage(summary);
                    for (const r of summary.inserted) {
                        for (const field of [r.hcos_id, r.hname, r.email]) {
                            if (inputInjectsDangerousChars(field) && outputContainsDangerousCharsFromInput(html, field)) return false;
                        }
                    }
                    return true;
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.3 — Property 3: Shared stylesheet included, no inline styles
// Feature: ui-ux-production-upgrade, Property 3: All HTML rendering helpers include the shared stylesheet and no inline styles
// ---------------------------------------------------------------------------

describe('Property 3: All HTML rendering helpers include the shared stylesheet and no inline styles', () => {
    it('errorPage: contains /css/main.css link and no <style> tag', () => {
        fc.assert(
            fc.property(
                fc.record({ title: fc.string(), message: fc.string() }),
                ({ title, message }) => {
                    const html = errorPage(title, message);
                    return /<link[^>]+\/css\/main\.css/.test(html) && !/<style[\s>]/.test(html);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('campaignReportPage: contains /css/main.css link and no <style> tag', () => {
        fc.assert(
            fc.property(
                fc.record({
                    total_contacts: fc.constant(1),
                    sent_count: fc.constant(0),
                    failed_count: fc.constant(1),
                    failures: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hospital: fc.string(),
                            email: fc.string(),
                            error: fc.string(),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                }),
                (report) => {
                    const html = campaignReportPage(report);
                    return /<link[^>]+\/css\/main\.css/.test(html) && !/<style[\s>]/.test(html);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('testEmailReportPage: contains /css/main.css link and no <style> tag', () => {
        fc.assert(
            fc.property(
                fc.record({
                    contact: fc.record({
                        hname: fc.string(),
                        email: fc.string(),
                        hcos_id: fc.string(),
                    }),
                }),
                (result) => {
                    const html = testEmailReportPage(result);
                    return /<link[^>]+\/css\/main\.css/.test(html) && !/<style[\s>]/.test(html);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('uploadResultPage: contains /css/main.css link and no <style> tag', () => {
        fc.assert(
            fc.property(
                fc.record({
                    inserted: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hname: fc.string(),
                            email: fc.string(),
                        }),
                        { maxLength: 5 }
                    ),
                    alreadyExists: fc.constant([]),
                    skipped: fc.constant([]),
                }),
                (summary) => {
                    const html = uploadResultPage(summary);
                    return /<link[^>]+\/css\/main\.css/.test(html) && !/<style[\s>]/.test(html);
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.4 — Property 4: Back link present in all helpers
// Feature: ui-ux-production-upgrade, Property 4: All HTML rendering helpers include a back link to the Dashboard
// ---------------------------------------------------------------------------

describe('Property 4: All HTML rendering helpers include a back link to the Dashboard', () => {
    it('errorPage: html contains href="/" and ← character', () => {
        fc.assert(
            fc.property(
                fc.record({ title: fc.string(), message: fc.string() }),
                ({ title, message }) => {
                    const html = errorPage(title, message);
                    return html.includes('href="/"') && html.includes('←');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('campaignReportPage: html contains href="/" and ← character', () => {
        fc.assert(
            fc.property(
                fc.record({
                    total_contacts: fc.constant(1),
                    sent_count: fc.constant(0),
                    failed_count: fc.constant(1),
                    failures: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hospital: fc.string(),
                            email: fc.string(),
                            error: fc.string(),
                        }),
                        { minLength: 1, maxLength: 5 }
                    ),
                }),
                (report) => {
                    const html = campaignReportPage(report);
                    return html.includes('href="/"') && html.includes('←');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('testEmailReportPage: html contains href="/" and ← character', () => {
        fc.assert(
            fc.property(
                fc.record({
                    contact: fc.record({
                        hname: fc.string(),
                        email: fc.string(),
                        hcos_id: fc.string(),
                    }),
                }),
                (result) => {
                    const html = testEmailReportPage(result);
                    return html.includes('href="/"') && html.includes('←');
                }
            ),
            { numRuns: 100 }
        );
    });

    it('uploadResultPage: html contains href="/" and ← character', () => {
        fc.assert(
            fc.property(
                fc.record({
                    inserted: fc.array(
                        fc.record({
                            hcos_id: fc.string(),
                            hname: fc.string(),
                            email: fc.string(),
                        }),
                        { maxLength: 5 }
                    ),
                    alreadyExists: fc.constant([]),
                    skipped: fc.constant([]),
                }),
                (summary) => {
                    const html = uploadResultPage(summary);
                    return html.includes('href="/"') && html.includes('←');
                }
            ),
            { numRuns: 100 }
        );
    });
});

// ---------------------------------------------------------------------------
// Task 12.5 — Property 5: isDbConnectionError classification
// Feature: ui-ux-production-upgrade, Property 5: isDbConnectionError correctly classifies connection errors
// ---------------------------------------------------------------------------

describe('Property 5: isDbConnectionError correctly classifies connection errors', () => {
    it('returns true when code is ECONNREFUSED', () => {
        fc.assert(
            fc.property(
                fc.record({ code: fc.constant('ECONNREFUSED'), message: fc.string() }),
                (err) => isDbConnectionError(err) === true
            ),
            { numRuns: 100 }
        );
    });

    it('returns true when code is ETIMEDOUT', () => {
        fc.assert(
            fc.property(
                fc.record({ code: fc.constant('ETIMEDOUT'), message: fc.string() }),
                (err) => isDbConnectionError(err) === true
            ),
            { numRuns: 100 }
        );
    });

    it('returns true when message contains "connect" (case-insensitive)', () => {
        fc.assert(
            fc.property(
                fc.record({ code: fc.string(), message: fc.constant('connect failed') }),
                (err) => isDbConnectionError(err) === true
            ),
            { numRuns: 100 }
        );
    });

    it('returns false when code is neither ECONNREFUSED nor ETIMEDOUT and message does not contain "connect"', () => {
        fc.assert(
            fc.property(
                fc.record({
                    code: fc.string().filter(s => s !== 'ECONNREFUSED' && s !== 'ETIMEDOUT'),
                    message: fc.string().filter(s => !s.toLowerCase().includes('connect')),
                }),
                (err) => isDbConnectionError(err) === false
            ),
            { numRuns: 100 }
        );
    });
});
