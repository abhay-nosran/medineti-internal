# Design Document — ui-ux-production-upgrade

## Overview

This document describes the technical design for upgrading the MediNeti Email Outreach web application from its current state (inconsistent styles, broken markup, raw-JSON responses, XSS-unsafe output, duplicate route) to a polished, production-grade internal tool.

The upgrade is split into three coherent workstreams:

1. **Design System** — a single `/css/main.css` stylesheet and a set of component conventions applied to every page, eliminating all inline `<style>` blocks and visual inconsistency.
2. **UI-complete responses** — every server route now returns fully-styled HTML with a back link, status badges, tables, and XSS-escaped content, replacing raw JSON and bare `<html>` strings.
3. **Reliability fixes** — duplicate route removal, `/upload` route addition, database-error detection with graceful 503 response, pool idle-error listener, and loading overlays.

No external frontend libraries, no build step, and no new runtime dependencies are introduced. The entire implementation is vanilla HTML + CSS + JavaScript on the client, and plain Node.js/Express on the server.

---

## Architecture

The application remains a single-process Express 5 server (`server.js`) serving static files from `/public` and generating dynamic HTML responses inline.

```
Browser
  │
  ├─ GET /            → public/home.html     (static)
  ├─ GET /upload      → public/upload.html   (static, served via route)
  │
  ├─ GET /send        → sendPendingEmails() → campaignReportPage(report)
  ├─ GET /test-send   → testSend()          → testEmailReportPage(result)
  └─ POST /upload-contacts → multer → XLSX parse → DB → uploadResultPage(summary)
```

All dynamic HTML is assembled inside **Inline_HTML_Helper** functions in `server.js`. These functions now share a common `pageShell()` wrapper, include `/css/main.css`, and call `escapeHtml()` on every dynamic value before injecting it.

Static assets under `/public` (home.html, upload.html, css/main.css) are served by `express.static`.

### Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| CSS location | `/public/css/main.css` | Served by existing `express.static` at `/css/main.css`; replaces both the old `style.css` and all inline `<style>` blocks |
| HTML helper structure | `pageShell(title, body)` wrapper + per-page helpers | Eliminates repetition of `<!DOCTYPE>`, `<head>`, and `<link>` across all helpers |
| `escapeHtml` placement | Top of `server.js`, exported if needed | Pure function, no dependencies, co-located with all callers |
| Duplicate route | Remove the second `GET /send` (the JSON stub) | First registered handler wins in Express; the dead code only causes confusion |
| `/upload` route | Add `app.get('/upload', ...)` that sends `public/upload.html` | `express.static` does not serve files at non-matching paths; explicit route needed |
| DB error detection | `isDbConnectionError(err)` helper | Centralises the ECONNREFUSED / ETIMEDOUT / "connect" check so all routes call it consistently |
| Pool idle error | `pool.on('error', handler)` at startup | Prevents the default unhandled-rejection crash on idle connection drops |
| Loading overlay | CSS class toggle + vanilla JS event listeners | No external library; `<noscript>` path works normally because overlay is never shown |

---

## Components and Interfaces

### 1. `/public/css/main.css` — Shared Design System

The sole CSS file for the entire application. Contains:

- **Reset & base** — `box-sizing: border-box`, `margin: 0`, `padding: 0`
- **Body** — full-viewport gradient background (`#0f172a` → `#134e4a`), flex-centred
- **`.page-card`** — centred container, `max-width: 1100px`, `border-radius: 20px`, white background, drop shadow
- **`.page-header`** — teal (`#0f766e`) background, white text, standard title/subtitle typography
- **`.page-content`** — `padding: 40px`
- **`.page-footer`** — `border-top`, muted gray text, centred
- **Buttons**: `.btn-primary` (teal fill), `.btn-secondary` (teal ghost)
- **Badges**: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info` — all `border-radius: 999px`
- **Warning box**: `.warning-box` — amber left-border card
- **Info box**: `.info-box` — light-gray background card
- **Data table**: `.data-table` — full-width, collapsed borders, alternating row shading, sticky header
- **Back link**: `.back-link` — `color: #64748b`, `← ` prefix, no underline; hover `color: #0f766e`
- **Loading overlay**: `#loading-overlay` — fixed full-viewport, semi-opaque dark backdrop, `z-index: 9999`, centred spinner + message
- **Responsive**: `@media (max-width: 700px)` — card grid collapses to single column, padding ≤ 16px

`style.css` is retained as a file (to avoid a 404 for anything that may still reference it) but `upload.html` will be updated to point to `/css/main.css` instead.

### 2. `escapeHtml(str)` — XSS Utility

```js
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
```

- Accepts any value; coerces via `String()` before processing.
- Declared at the top of `server.js` before any route or helper function.
- Called on every dynamic value before interpolation into an HTML template literal.

### 3. `pageShell(title, bodyHtml)` — Common HTML Wrapper

```js
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
```

All four per-page helper functions call `pageShell` and inject only their specific body markup.

### 4. `isDbConnectionError(err)` — DB Error Classifier

```js
function isDbConnectionError(err) {
    if (!err) return false;
    const code = err.code || '';
    const msg  = (err.message || '').toLowerCase();
    return code === 'ECONNREFUSED'
        || code === 'ETIMEDOUT'
        || msg.includes('connect');
}
```

Used in every route's catch block before falling through to the generic 500 handler.

### 5. Inline HTML Helpers

All helpers share the `pageShell` wrapper and call `escapeHtml` on every interpolated value.

#### `errorPage(title, message, { details = [], stack = '', statusCode = 500 })`

Returns a full error page. Renders:
- Back link at top
- `<h1 class="text-danger">` with `escapeHtml(title)`
- Status subtitle (e.g., "500 – Server Error") derived from `statusCode`
- Summary `<p>` capped to 500 chars (server-side truncation before escaping)
- `<ul>` of detail items if `details.length > 0`
- `<pre style="overflow:auto">` for `stack` if provided
- No inline `<style>` block

#### `campaignReportPage(report)`

Returns the campaign result page. Renders:
- Back link at top and bottom
- Three summary badges: total contacts, sent (`.badge-success`), failed (`.badge-danger`)
- If `report.total_contacts === 0`: info banner "No pending contacts found…"
- If `report.failures.length > 0`: failures table (HCOS ID, Hospital Name, Email, Error) — all cells escaped
- If `report.failures.length === 0` and `report.sent_count > 0`: success banner
- All dynamic values escaped

#### `testEmailReportPage(result)`

Returns the test-send result page. Renders:
- Back link at top
- Success banner "Test email sent successfully."
- Info box: Hospital Name, Email Address, HCOS ID, Resend response ID (if present)
- All dynamic values escaped

#### `uploadResultPage(summary)`

Returns the upload result page. Renders:
- Back link at top and bottom
- Three summary badges: inserted (`.badge-success`), already-exists (`.badge-warning`), skipped (`.badge-danger`)
- If all three lists are empty: warning banner "The uploaded file contained no data rows."
- Inserted table (HCOS ID, Hospital, Email) — first 500 rows, truncation notice if over 500
- Already-exists table (HCOS ID, Hospital) — first 500 rows
- Skipped table (HCOS ID or "—", Hospital or "—", Reason) — first 500 rows
- All dynamic values escaped

### 6. Loading Overlay — HTML + CSS + Vanilla JS

Added once to `home.html` and `upload.html`:

```html
<div id="loading-overlay" aria-hidden="true">
  <div class="spinner"></div>
  <p id="loading-message"></p>
</div>
```

The overlay is hidden by default via CSS (`display: none` or `opacity: 0; pointer-events: none`). JavaScript reveals it by adding a class.

**home.html script:**
```js
document.querySelectorAll('[data-loading-message]').forEach(el => {
    el.addEventListener('click', () => {
        document.getElementById('loading-message').textContent =
            el.dataset.loadingMessage;
        document.getElementById('loading-overlay').removeAttribute('hidden');
    });
});
```

Each action link carries `data-loading-message="Sending campaign emails… please wait."` (or equivalent). No `<noscript>` change required — if JS is disabled the overlay never appears and links/forms work normally.

**upload.html script:**
```js
document.querySelector('form').addEventListener('submit', (e) => {
    const fileInput = document.querySelector('input[type=file]');
    if (!fileInput.value) {
        e.preventDefault();
        document.getElementById('file-error').textContent =
            'Please select a file before uploading.';
        return;
    }
    document.querySelector('button[type=submit]').disabled = true;
    document.getElementById('loading-message').textContent =
        'Uploading and processing contacts… please wait.';
    document.getElementById('loading-overlay').removeAttribute('hidden');
});
```

### 7. Route Changes in `server.js`

| Route | Change |
|---|---|
| `GET /` | No change; still sends `home.html` |
| `GET /upload` | **New** — `res.sendFile(path.join(__dirname, 'public', 'upload.html'))` |
| `GET /send` | **Remove duplicate**; single handler calls `sendPendingEmails()` and renders `campaignReportPage` or `errorPage` |
| `GET /test-send` | **Replace JSON response** with `testEmailReportPage` or `errorPage` |
| `POST /upload-contacts` | **Replace `successPage`** with `uploadResultPage`; add `isDbConnectionError` check |

---

## Data Models

No schema changes. The `contacts` table is unchanged. The data flowing through the new helper functions is:

### Campaign Report Object
```js
{
    success: boolean,
    total_contacts: number,
    sent_count: number,
    failed_count: number,
    failures: Array<{
        hcos_id: number | string,
        hospital: string,
        email: string,
        error: string
    }>,
    error?: string    // present only when success === false
}
```

### Upload Summary Object
```js
{
    inserted: Array<{ hcos_id, hname, email }>,
    alreadyExists: Array<{ hcos_id, hname }>,
    skipped: Array<{ hcos_id?, hname?, reason: string }>
}
```

### Test Send Result Object
```js
{
    success: boolean,
    contact?: { id, hcos_id, hname, email },
    resend_response?: { data?: { id: string }, ... },
    error?: string,
    message?: string   // for "no test contact found" case
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature is a good candidate for property-based testing on its pure server-side logic: the `escapeHtml` utility, the HTML-rendering helpers, and the error-classification function. These are all pure (or near-pure) functions with large input spaces where adversarial edge cases matter greatly. UI rendering and CSS are excluded from PBT per the standard guidelines.

The PBT library chosen is **[fast-check](https://github.com/dubzzz/fast-check)** for Node.js/ESM. It integrates cleanly with any Node test runner (Vitest or Jest) and has strong support for arbitrary string generation including Unicode and HTML-special-character sequences.

---

### Property 1: `escapeHtml` eliminates all HTML-injectable characters

*For any* string (including strings containing `<`, `>`, `&`, `"`, `'`, or any combination thereof), calling `escapeHtml(str)` SHALL return a string that contains none of the literal characters `<`, `>`, unescaped `&`, `"`, or `'` — only their entity equivalents.

Additionally, *for any* value of any JavaScript type (number, boolean, null, undefined, object, array), `escapeHtml` SHALL not throw and SHALL return a string.

**Validates: Requirements 9.1, 9.3**

---

### Property 2: All HTML rendering helpers produce XSS-safe output

*For any* combination of adversarial input strings (containing HTML special characters, script tags, event handlers, and Unicode) passed to any of the four rendering helpers — `errorPage`, `campaignReportPage`, `testEmailReportPage`, `uploadResultPage` — the returned HTML string SHALL not contain any unescaped occurrence of those adversarial strings in positions that originated from dynamic data.

Concretely: if the input string `s` contains `<`, `>`, `&`, `"`, or `'`, none of those literal characters from `s` SHALL appear in the output HTML (they must appear only as entity-escaped forms).

**Validates: Requirements 5.8, 6.8, 7.9, 8.7, 9.2**

---

### Property 3: All HTML rendering helpers include the shared stylesheet and no inline styles

*For any* valid input to any of the four rendering helpers (`errorPage`, `campaignReportPage`, `testEmailReportPage`, `uploadResultPage`), the returned HTML string SHALL contain exactly one `<link rel="stylesheet" href="/css/main.css">` element and SHALL contain zero `<style` tags.

**Validates: Requirements 1.2**

---

### Property 4: All HTML rendering helpers include a back link to the Dashboard

*For any* valid input to any of the four rendering helpers, the returned HTML string SHALL contain at least one anchor element with `href="/"` and the text content `←` somewhere in that anchor's markup.

**Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

---

### Property 5: `isDbConnectionError` correctly classifies connection errors

*For any* error object whose `code` is `ECONNREFUSED` or `ETIMEDOUT`, or whose `message` contains the substring `"connect"` (case-insensitive), `isDbConnectionError(err)` SHALL return `true`.

*For any* error object that does NOT meet any of those conditions, `isDbConnectionError(err)` SHALL return `false`.

**Validates: Requirements 10.1**

---

## Error Handling

### Route-Level Error Strategy

Every route wraps its async logic in `try/catch`. The catch block follows this decision tree:

```
catch (err)
  │
  ├─ isDbConnectionError(err)?
  │     └─ res.status(503).send(errorPage('Database Connection Error', ...))
  │
  └─ else
        └─ res.status(500).send(errorPage('Unexpected Error', err.message, { stack: err.stack }))
```

### Pool Idle-Error Listener

Registered once at server startup:

```js
pool.on('error', (err) => {
    console.error('PostgreSQL pool idle error:', err.message);
    // do not rethrow — pool recovers automatically
});
```

This prevents Node.js from treating the idle error as an uncaught exception that would crash the process.

### Upload-Specific Errors

- No file: 400 + `errorPage('Upload Failed', 'No file was uploaded.', { details: [...] })`
- Empty file: 400 + `errorPage('Invalid File', 'The uploaded file contained no data rows.')`
- Missing columns: 400 + `errorPage('Invalid Excel Format', 'Required columns are missing.', { details: [...] })`
- DB connection: 503 + `errorPage('Database Connection Error', ...)`
- Unexpected: 500 + `errorPage('Upload Failed', err.message)`
- Temp file cleanup: `fs.unlinkSync` is called in all early-return error paths before the response is sent.

### Test Send Specific Errors

- Contact not found (`testSend` returns `success: false` with message "No contact found with hcos_id = 0"): 404 + `errorPage('Test Contact Not Found', '...', { statusCode: 404 })`
- API / DB failure: 500 + `errorPage('Test Email Failed', result.error)`

---

## Testing Strategy

### Unit Tests (example-based)

Use **Vitest** (zero-config, ESM-native, fast). Target pure utility functions and route response content.

| Test | What is verified |
|---|---|
| `escapeHtml` with known special characters | Each of `& < > " '` is replaced correctly |
| `escapeHtml` with non-string inputs | `null`, `undefined`, `42`, `true`, `[]`, `{}` all return strings without throwing |
| `pageShell` | Output contains `<link … /css/main.css>` and no `<style>` |
| `errorPage` — 400/404/500/other | Correct subtitle rendered for each status code |
| `errorPage` — with stack | `<pre>` block present, content is escaped |
| `errorPage` — no details | `<ul>` is absent |
| `campaignReportPage` — zero contacts | Info banner present |
| `campaignReportPage` — all success | Success banner present, no failures table |
| `campaignReportPage` — some failures | Failures table with correct column count |
| `testEmailReportPage` — success | Contact details visible, success banner present |
| `uploadResultPage` — all empty | Warning banner present |
| `uploadResultPage` — over 500 rows | Truncation notice present, only 500 rows in table |
| `isDbConnectionError` | Returns true for ECONNREFUSED, ETIMEDOUT, "connect" in message; false for others |
| Route `GET /upload` | Response status 200, body contains `action="/upload-contacts"` |
| Route `GET /send` (single handler) | Express app has exactly one route registered for GET /send |

### Property-Based Tests

Use **fast-check**. Each property runs a minimum of **100 iterations** by default (fast-check default is 100; set `numRuns: 100` explicitly for documentation purposes).

```
// Tag format: Feature: ui-ux-production-upgrade, Property N: <property_text>
```

| Property | fast-check Arbitrary | Assertion |
|---|---|---|
| **Property 1** — `escapeHtml` safety | `fc.string()` including full Unicode | Output contains none of `< > & " '` as literal chars |
| **Property 1** — type coercion | `fc.anything()` | No throw; returns a string |
| **Property 2** — Rendering helpers XSS-safe | `fc.record(...)` with `fc.string()` for each dynamic field | For each helper, no adversarial literal survives in output |
| **Property 3** — CSS link present, no inline style | Same record arbitraries | `/<link[^>]+\/css\/main\.css/.test(html)` is true; `/<style/.test(html)` is false |
| **Property 4** — Back link present | Same record arbitraries | `html` contains `href="/"` and `←` |
| **Property 5** — `isDbConnectionError` | `fc.record({ code: fc.string(), message: fc.string() })` with specific keyword injection | Correct boolean returned |

### Integration / Smoke Tests

- Start the server against a test database (or mock `pool.query`) and verify:
  - `GET /` returns 200 with `home.html` content
  - `GET /upload` returns 200 with upload form
  - `POST /upload-contacts` with no file returns 400 with error page HTML
  - Pool error listener is registered (check `pool.listenerCount('error') >= 1`)

These are run as part of `npm test` after unit and property tests.

### What is not tested with PBT

- CSS visual correctness — requires browser/visual regression tooling
- Loading overlay DOM behavior — requires a browser environment (Playwright/Cypress if needed)
- The `buildEmailHtml` function — side-effect output to Resend, no pure assertion to make
- Cron job behavior — disabled; not in scope for this upgrade
