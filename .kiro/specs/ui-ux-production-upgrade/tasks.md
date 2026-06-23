# Implementation Plan: UI/UX Production Upgrade

## Overview

This plan transforms the MediNeti Email Outreach application from its current inconsistent, partially broken state to a polished production-grade internal tool. The implementation follows three parallel workstreams: creating a unified Design System in `/css/main.css`, upgrading all server routes to return fully-styled HTML with XSS-safe output, and applying reliability fixes including duplicate route removal, database error handling, and loading overlays.

## Tasks

- [x] 1. Create Design System stylesheet
  - [x] 1.1 Create `/public/css/main.css` with complete Design System
    - Define CSS reset, base styles, and box-sizing
    - Define body gradient background (`#0f172a` → `#134e4a`), flex-centered layout
    - Define `.page-card` container (max-width 1100px, border-radius 20px, white, drop shadow)
    - Define `.page-header` component (teal background, white text, title/subtitle typography)
    - Define `.page-content` and `.page-footer` components
    - Define button styles: `.btn-primary` (teal fill) and `.btn-secondary` (teal ghost)
    - Define badge variants: `.badge-success`, `.badge-warning`, `.badge-danger`, `.badge-info` (border-radius 999px)
    - Define `.warning-box` (amber left-border card) and `.info-box` (light-gray card)
    - Define `.data-table` (full-width, collapsed borders, alternating row shading, sticky header)
    - Define `.back-link` (color `#64748b`, hover `#0f766e`, no underline, `←` prefix)
    - Define `#loading-overlay` (fixed full-viewport, semi-opaque dark backdrop, z-index 9999, centered spinner + message)
    - Add responsive breakpoint at 700px (single column grid, padding ≤ 16px)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10_

- [x] 2. Implement core server-side utilities
  - [x] 2.1 Add `escapeHtml(str)` utility function to `server.js`
    - Implement string coercion via `String()`
    - Replace `&`, `<`, `>`, `"`, `'` with HTML entities
    - Place function at top of `server.js` before all route handlers
    - _Requirements: 9.1, 9.3_
  
  - [x] 2.2 Add `pageShell(title, bodyHtml)` wrapper function to `server.js`
    - Generate complete HTML document structure with `<!DOCTYPE html>`
    - Include `<meta charset="UTF-8">` and viewport meta tag
    - Include `<link rel="stylesheet" href="/css/main.css">`
    - Render `.page-card` wrapper with `.page-header`, `.page-content`, and `.page-footer`
    - Apply `escapeHtml()` to title parameter
    - Place function after `escapeHtml()` and before all rendering helpers
    - _Requirements: 1.2, 1.4, 1.5_
  
  - [x] 2.3 Add `isDbConnectionError(err)` helper to `server.js`
    - Check if `err.code` is `ECONNREFUSED` or `ETIMEDOUT`
    - Check if `err.message` (case-insensitive) contains "connect"
    - Return false if `err` is null or undefined
    - Place function after `pageShell()` and before rendering helpers
    - _Requirements: 10.1_

- [x] 3. Implement HTML rendering helpers
  - [x] 3.1 Implement `errorPage(title, message, { details = [], stack = '', statusCode = 500 })` helper
    - Call `pageShell()` with title
    - Render back link at top (`.back-link`, `href="/"`)
    - Render error heading with `.text-danger` class and escaped title
    - Render status subtitle ("400 – Bad Request", "404 – Not Found", "500 – Server Error", or `${statusCode} – Error`)
    - Render summary message (truncate to 500 chars server-side before escaping)
    - Render `<ul>` of detail items if `details.length > 0` (escape each item)
    - Render `<pre style="overflow:auto">` for stack if provided (escape stack)
    - Ensure no inline `<style>` blocks are present
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_
  
  - [x] 3.2 Implement `campaignReportPage(report)` helper
    - Call `pageShell()` with "Email Campaign Report"
    - Render back links at top and bottom (`.back-link`, `href="/"`)
    - Render three summary badges: total contacts, sent (`.badge-success`), failed (`.badge-danger`)
    - If `report.total_contacts === 0`: render info banner "No pending contacts found…"
    - If `report.failures.length > 0`: render failures table (`.data-table`, columns: HCOS ID, Hospital Name, Email, Error)
    - If `report.failures.length === 0` and `report.sent_count > 0`: render success banner
    - Apply `escapeHtml()` to all dynamic values: hospital names, email addresses, error messages
    - Ensure no inline `<style>` blocks are present
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [x] 3.3 Implement `testEmailReportPage(result)` helper
    - Call `pageShell()` with "Test Email Report"
    - Render back link at top (`.back-link`, `href="/"`)
    - Render success banner "Test email sent successfully."
    - Render info box with labeled contact details: Hospital Name, Email Address, HCOS ID
    - If Resend API response ID is present, display it in the info box
    - Apply `escapeHtml()` to all dynamic values: hospital name, email, HCOS ID, Resend response fields
    - Ensure no inline `<style>` blocks are present
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8_
  
  - [x] 3.4 Implement `uploadResultPage(summary)` helper
    - Call `pageShell()` with "Upload Results"
    - Render back links at top and bottom (`.back-link`, `href="/"`)
    - Render three summary badges: inserted (`.badge-success`), already-exists (`.badge-warning`), skipped (`.badge-danger`)
    - If all three lists are empty: render warning banner "The uploaded file contained no data rows."
    - If `inserted` contains records: render inserted records table (`.data-table`, columns: HCOS ID, Hospital Name, Email Address) — max 500 rows with truncation notice
    - If `alreadyExists` contains records: render already-exists table (`.data-table`, columns: HCOS ID, Hospital Name) — max 500 rows
    - If `skipped` contains records: render skipped records table (`.data-table`, columns: HCOS ID or "—", Hospital Name or "—", Reason) — max 500 rows
    - Apply `escapeHtml()` to all dynamic values: hospital names, email addresses, skip reasons
    - Ensure no inline `<style>` blocks are present
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

- [ ] 4. Update server routes and remove duplicate handler
  - [~] 4.1 Remove duplicate `GET /send` route (the JSON stub)
    - Delete the second `GET /send` handler that returns `{ success: true }` JSON
    - Verify only one `GET /send` handler remains in `server.js`
    - _Requirements: 4.1, 4.2_
  
  - [~] 4.2 Update `GET /send` route to use `campaignReportPage()`
    - Wrap existing logic in try/catch
    - In catch block: check `isDbConnectionError(err)` → respond with 503 and `errorPage('Database Connection Error', ...)`
    - If `sendPendingEmails()` returns `success: false`, respond with 500 and `errorPage('Campaign Failed', report.error)`
    - If successful, respond with `campaignReportPage(report)`
    - Remove all inline HTML string literals from route handler
    - _Requirements: 4.3, 4.4, 5.5, 10.1_
  
  - [~] 4.3 Update `GET /test-send` route to use `testEmailReportPage()`
    - Wrap existing logic in try/catch
    - In catch block: check `isDbConnectionError(err)` → respond with 503 and `errorPage('Database Connection Error', ...)`
    - If `testSend()` returns `success: false` and `result.message` contains "No contact found", respond with 404 and `errorPage('Test Contact Not Found', 'No contact record exists with hcos_id = 0. Please insert a test record first.', { statusCode: 404 })`
    - If `testSend()` returns `success: false` due to other error, respond with 500 and `errorPage('Test Email Failed', result.error)`
    - If successful, respond with `testEmailReportPage(result)`
    - Remove all JSON response code
    - _Requirements: 6.4, 6.5, 10.1_
  
  - [~] 4.4 Add `GET /upload` route that serves `public/upload.html`
    - Register `app.get('/upload', ...)` handler
    - Use `res.sendFile(path.join(__dirname, 'public', 'upload.html'))`
    - Wrap in try/catch; on error respond with 500 and `errorPage('Server Error', 'Failed to load upload page.', { stack: err.stack })`
    - _Requirements: 13.1, 13.2, 13.3, 13.4_
  
  - [~] 4.5 Update `POST /upload-contacts` route to use `uploadResultPage()`
    - Replace `successPage()` call with `uploadResultPage({ inserted, alreadyExists, skipped })`
    - In catch block: add `isDbConnectionError(err)` check → respond with 503 and `errorPage('Database Connection Error', 'The database is unreachable. Please verify the connection configuration.')`
    - For "No file" error: respond with 400 and `errorPage('Upload Failed', 'No file was uploaded.', { details: ['Choose a CSV or Excel file.', 'Supported formats: .csv .xlsx .xls'] })`
    - For empty file: respond with 400 and `errorPage('Invalid File', 'The uploaded file contained no data rows.')`
    - For missing columns: respond with 400 and `errorPage('Invalid Excel Format', 'Required columns are missing.', { details: [`Required: ${requiredHeaders.join(', ')}`, `Found: ${headers.join(', ')}`] })`
    - For unexpected errors: respond with 500 and `errorPage('Upload Failed', err.message, { stack: err.stack })`
    - Ensure `fs.unlinkSync(req.file.path)` is called in all early-return error paths
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 10.1_

- [ ] 5. Add pool idle-error listener at server startup
  - [x] 5.1 Register `pool.on('error', ...)` listener after pool is created
    - Add listener immediately after `const pool = new Pool(...)` declaration
    - Log error message with `console.error('PostgreSQL pool idle error:', err.message)`
    - Do not rethrow the error (allow pool to recover automatically)
    - _Requirements: 10.2, 10.3_

- [ ] 6. Update `public/home.html` with Design System and loading overlay
  - [~] 6.1 Remove all backtick and fenced-code-block artifacts from `home.html`
    - Search for and remove any ` ``` ` sequences in the HTML
    - _Requirements: 2.1_
  
  - [~] 6.2 Replace `<style>` block in `home.html` with `<link>` to `/css/main.css`
    - Remove entire `<style>...</style>` block from `<head>`
    - Add `<link rel="stylesheet" href="/css/main.css">`
    - _Requirements: 1.2, 2.2_
  
  - [~] 6.3 Update Dashboard HTML structure to use Design System classes
    - Wrap content in `.page-card` div
    - Apply `.page-header` to header section
    - Apply `.page-content` to main content area
    - Apply `.page-footer` to footer section
    - Apply `.btn-primary` to all action buttons
    - Apply `.badge-warning` to "Internal Use Only" badge
    - Apply `.warning-box` to internal-use warning section
    - Ensure three action cards use Design System card component
    - _Requirements: 2.2, 2.5, 2.6, 2.7_
  
  - [~] 6.4 Add loading overlay HTML and JavaScript to `home.html`
    - Add `<div id="loading-overlay" aria-hidden="true">` with spinner and message `<p>` before closing `</body>`
    - Add `<script>` tag with event listeners for `[data-loading-message]` elements
    - Add `data-loading-message="Sending campaign emails… please wait."` to "Start Campaign" link
    - Add `data-loading-message="Sending test email… please wait."` to "Send Test Email" link
    - Ensure overlay becomes visible within 100ms via `removeAttribute('hidden')` and `textContent` update
    - _Requirements: 2.3, 2.4, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 7. Update `public/upload.html` with Design System and loading overlay
  - [~] 7.1 Replace `<link>` to `/css/style.css` with `/css/main.css` in `upload.html`
    - Update `<link rel="stylesheet" href="/css/main.css">`
    - _Requirements: 1.2, 3.1_
  
  - [~] 7.2 Update upload page HTML structure to use Design System classes
    - Wrap content in `.page-card` div
    - Apply `.page-header` to header section
    - Apply `.page-content` to main content area
    - Apply `.info-box` to "Required Columns" section
    - Apply `.btn-primary` to Upload button
    - _Requirements: 3.1, 3.2_
  
  - [~] 7.3 Add back link to Dashboard at top of content area in `upload.html`
    - Add `<a href="/" class="back-link">← Back to Dashboard</a>` before the form
    - _Requirements: 3.3, 12.5, 12.6_
  
  - [~] 7.4 Add client-side file validation to `upload.html`
    - Add `<span id="file-error" style="color: #dc2626;"></span>` below file input
    - Add `<script>` tag with form submit event listener
    - Check if file input has value; if not, prevent submit and display "Please select a file before uploading." in `#file-error`
    - _Requirements: 3.6_
  
  - [~] 7.5 Add loading overlay HTML and JavaScript to `upload.html`
    - Add `<div id="loading-overlay" aria-hidden="true">` with spinner and message `<p>` before closing `</body>`
    - In form submit event listener: set `button[type=submit]` to `disabled = true`
    - Set loading message to "Uploading and processing contacts… please wait."
    - Call `removeAttribute('hidden')` on overlay
    - Ensure overlay becomes visible within 100ms and button remains disabled while upload is in progress
    - _Requirements: 3.4, 3.5, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [~] 8. Checkpoint — Ensure all tests pass
  - Verify the application starts without errors
  - Manually test each route: `/`, `/upload`, `/send`, `/test-send`, `/upload-contacts`
  - Ensure all dynamic HTML includes back links and uses Design System
  - Ensure no backtick artifacts remain in `home.html`
  - Ask the user if questions arise.

- [x] 9. Install testing dependencies
  - [x] 9.1 Install `vitest` and `fast-check` as dev dependencies
    - Run `npm install --save-dev vitest fast-check`
    - _Requirements: Testing strategy (Design document)_

- [ ] 10. Write unit tests for server utilities
  - [ ]* 10.1 Write unit tests for `escapeHtml()` utility
    - Test known special characters: `& < > " '` are replaced correctly
    - Test non-string inputs: `null`, `undefined`, `42`, `true`, `[]`, `{}` all return strings without throwing
    - _Requirements: 9.1, 9.3_
  
  - [ ]* 10.2 Write unit tests for `pageShell()` wrapper
    - Test output contains `<link rel="stylesheet" href="/css/main.css">`
    - Test output contains no `<style>` tags
    - _Requirements: 1.2_
  
  - [ ]* 10.3 Write unit tests for `isDbConnectionError()` helper
    - Test returns true for `err.code === 'ECONNREFUSED'`
    - Test returns true for `err.code === 'ETIMEDOUT'`
    - Test returns true for `err.message` containing "connect" (case-insensitive)
    - Test returns false for errors not meeting any condition
    - Test returns false for `null` and `undefined` inputs
    - _Requirements: 10.1_

- [ ] 11. Write unit tests for HTML rendering helpers
  - [ ]* 11.1 Write unit tests for `errorPage()` helper
    - Test correct subtitle for status codes 400, 404, 500, and other
    - Test `<pre>` block present when stack is provided and content is escaped
    - Test `<ul>` is absent when `details` is empty
    - Test back link is present (`href="/"`)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10, 8.11_
  
  - [ ]* 11.2 Write unit tests for `campaignReportPage()` helper
    - Test info banner present when `report.total_contacts === 0`
    - Test success banner present when `report.failures.length === 0` and `report.sent_count > 0`
    - Test failures table present when `report.failures.length > 0` with correct column count
    - Test back links are present at top and bottom
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [ ]* 11.3 Write unit tests for `testEmailReportPage()` helper
    - Test success banner present
    - Test contact details visible: hospital name, email, HCOS ID
    - Test Resend API response ID is displayed if present
    - Test back link is present at top
    - _Requirements: 6.1, 6.2, 6.3, 6.6, 6.7, 6.8_
  
  - [ ]* 11.4 Write unit tests for `uploadResultPage()` helper
    - Test warning banner present when all three lists are empty
    - Test inserted records table present when `inserted.length > 0`
    - Test already-exists table present when `alreadyExists.length > 0`
    - Test skipped records table present when `skipped.length > 0`
    - Test truncation notice present when any table has over 500 rows
    - Test back links are present at top and bottom
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9_

- [ ] 12. Write property-based tests using fast-check
  - [ ]* 12.1 Write property test for `escapeHtml()` safety (Property 1)
    - **Property 1: `escapeHtml` eliminates all HTML-injectable characters**
    - **Validates: Requirements 9.1, 9.3**
    - Use `fc.string()` arbitrary including full Unicode
    - Assert output contains none of `< > & " '` as literal chars (only entity equivalents)
    - Use `fc.anything()` arbitrary to test type coercion
    - Assert no throw; returns a string for any JavaScript type
  
  - [ ]* 12.2 Write property test for HTML rendering helpers XSS-safety (Property 2)
    - **Property 2: All HTML rendering helpers produce XSS-safe output**
    - **Validates: Requirements 5.8, 6.8, 7.9, 8.7, 9.2**
    - Use `fc.record(...)` with `fc.string()` for each dynamic field (including HTML special chars, script tags, event handlers, Unicode)
    - For each helper (`errorPage`, `campaignReportPage`, `testEmailReportPage`, `uploadResultPage`): assert no adversarial literal survives in output
    - Assert if input `s` contains `< > & " '`, those literals do not appear in output HTML (only entity-escaped forms)
  
  - [ ]* 12.3 Write property test for shared stylesheet inclusion (Property 3)
    - **Property 3: All HTML rendering helpers include the shared stylesheet and no inline styles**
    - **Validates: Requirements 1.2**
    - Use same record arbitraries as Property 2
    - For each helper: assert output matches `/<link[^>]+\/css\/main\.css/.test(html)`
    - For each helper: assert output does not match `/<style/.test(html)`
  
  - [ ]* 12.4 Write property test for back link presence (Property 4)
    - **Property 4: All HTML rendering helpers include a back link to the Dashboard**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**
    - Use same record arbitraries as Property 2
    - For each helper: assert output contains `href="/"` and `←`
  
  - [ ]* 12.5 Write property test for `isDbConnectionError()` classification (Property 5)
    - **Property 5: `isDbConnectionError` correctly classifies connection errors**
    - **Validates: Requirements 10.1**
    - Use `fc.record({ code: fc.string(), message: fc.string() })` with specific keyword injection
    - Assert returns `true` for `code === 'ECONNREFUSED'`, `code === 'ETIMEDOUT'`, or `message.toLowerCase().includes('connect')`
    - Assert returns `false` for errors not meeting any condition

- [~] 13. Final checkpoint — Ensure all tests pass
  - Run `npm test` to execute all unit tests and property-based tests
  - Verify no test failures
  - Verify application still starts and all routes respond correctly
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation of core functionality
- Property-based tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses vanilla JavaScript, Node.js, and Express with no external frontend libraries
- All HTML output is XSS-safe via `escapeHtml()` utility applied to every dynamic value
- The Design System eliminates all inline `<style>` blocks and ensures visual consistency

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "9.1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "5.1"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["6.1", "6.2", "6.3", "7.1", "7.2", "7.3"] },
    { "id": 5, "tasks": ["6.4", "7.4", "7.5"] },
    { "id": 6, "tasks": ["10.1", "10.2", "10.3", "11.1", "11.2", "11.3", "11.4"] },
    { "id": 7, "tasks": ["12.1", "12.2", "12.3", "12.4", "12.5"] }
  ]
}
```
