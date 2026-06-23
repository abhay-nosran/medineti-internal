# Requirements Document

## Introduction

This feature upgrades the MediNeti Email Outreach web application from its current basic, partially broken state to a polished, production-grade internal tool. The upgrade covers three areas: a consistent and modern visual design system applied to all pages, comprehensive and clearly visible error/status reporting surfaced to the UI on every operation, and production-grade reliability fixes including XSS-safe output, removal of the duplicate route bug, loading states, navigation, and graceful handling of infrastructure failures.

---

## Glossary

- **Dashboard**: The main landing page (`/`) rendered from `home.html`, showing action cards for all operations.
- **Upload_Page**: The contact file upload page served from `public/upload.html` via the `/upload` route.
- **Campaign_Report_Page**: The HTML page returned by the server after a `/send` request completes.
- **Test_Email_Report_Page**: The HTML page returned by the server after a `/test-send` request completes.
- **Upload_Result_Page**: The HTML page returned by the server after a `/upload-contacts` POST completes.
- **Error_Page**: A full-page HTML response rendered by the server when a request fails.
- **Design_System**: A shared CSS stylesheet (`/css/main.css`) and set of component conventions applied consistently across all pages.
- **Inline_HTML_Helper**: A server-side JavaScript function that generates complete HTML strings for responses (currently `errorPage()` and `successPage()`).
- **Loading_Overlay**: A full-page visual indicator shown immediately when a user triggers a slow operation.
- **XSS_Escape**: The process of replacing characters `<`, `>`, `"`, `'`, and `&` with their HTML entity equivalents before inserting dynamic strings into HTML output.
- **Campaign**: The email send operation targeting all contacts where `already_sent = FALSE`, up to 25 per run.
- **Test_Contact**: The database record with `hcos_id = 0`, used as the target for test email sends.
- **Back_Link**: An anchor element on result pages that navigates the user back to the Dashboard at `/`.
- **Route_Conflict**: The bug where two `GET /send` handlers are registered; Express only executes the first, but the second dead code creates confusion and maintenance risk.
- **Resend_API**: The third-party email delivery service used via the `resend` npm package.
- **PostgreSQL_Pool**: The `pg` Pool instance used for all database queries.
- **Multer**: The Express middleware handling `multipart/form-data` file uploads.
- **HCOS_ID**: A numeric identifier for a healthcare organization, unique per contact record.

---

## Requirements

---

### Requirement 1: Unified Design System

**User Story:** As a MediNeti team member, I want all pages to share a consistent visual language, so that the application feels professional and trustworthy rather than like a collection of unrelated screens.

#### Acceptance Criteria

1. THE Design_System SHALL define a single shared CSS file at `/css/main.css` containing all typography, color tokens, spacing rules, button styles, card styles, table styles, and badge styles used across all pages.
2. THE Dashboard, Upload_Page, Campaign_Report_Page, Test_Email_Report_Page, Upload_Result_Page, and Error_Page SHALL each reference `/css/main.css` via a `<link>` tag and SHALL NOT contain any `<style>` blocks embedded in the HTML.
3. THE Design_System SHALL define a primary brand color (`#0f766e`), a background gradient (dark navy to dark teal), a card surface color (white), a danger color (`#dc2626`), a success color (`#16a34a`), and a warning color (`#f59e0b`).
4. THE Design_System SHALL define a consistent page layout: full-viewport gradient background, centered card with `max-width: 1100px`, `border-radius: 20px`, and a drop shadow.
5. THE Design_System SHALL define a header component with teal background, white text, the title "MediNeti Outreach System", and a subtitle line.
6. THE Design_System SHALL define button styles including a primary filled variant (teal background, white text, `border-radius: 8px`) and a secondary ghost variant (white background, teal border).
7. THE Design_System SHALL define a status badge component with `border-radius: 999px` in success (green), danger (red), warning (amber), and info (blue) variants.
8. THE Design_System SHALL define a data table style where odd and even rows have visually distinct background shades, with `1px` column borders and a fixed header row with a light gray background.
9. THE Design_System SHALL define a back-link component styled with a subdued color lighter than the primary body text, no underline by default, and a `←` prefix character.
10. WHILE the viewport width is less than 700px, THE Design_System SHALL reflow the card grid to a single column and set card padding to no more than 16px so all content remains readable without horizontal scrolling.

---

### Requirement 2: Dashboard Page Cleanup and Upgrade

**User Story:** As a MediNeti team member, I want the dashboard to be clean and functional, so that I can navigate to any operation without encountering broken markup or confusing artifacts.

#### Acceptance Criteria

1. THE Dashboard SHALL contain no backtick or fenced-code-block artifacts (` ``` `) anywhere in its HTML source.
2. THE Dashboard SHALL render the three action cards — Upload Contacts, Send Email Campaign, and Test Email — using the Design_System card component with the primary button style for each action link.
3. WHEN a user clicks "Start Campaign" on the Dashboard, THE Dashboard SHALL display a Loading_Overlay with the message "Sending campaign emails… please wait." within 100ms before the browser navigates to `/send`.
4. WHEN a user clicks "Send Test Email" on the Dashboard, THE Dashboard SHALL display a Loading_Overlay with the message "Sending test email… please wait." within 100ms before the browser navigates to `/test-send`.
5. THE Dashboard SHALL display the "Internal Use Only" badge using the Design_System warning (amber) badge variant.
6. THE Dashboard SHALL display the internal-use warning box as a Design_System amber warning card.
7. THE Dashboard SHALL include a footer showing "MediNeti Healthcare Solutions • Outreach Management System" using the Design_System footer component.

---

### Requirement 3: Upload Page Upgrade

**User Story:** As a MediNeti team member, I want the upload page to match the rest of the application visually and give me clear feedback while my file is uploading, so that I do not click the button twice or wonder if the upload started.

#### Acceptance Criteria

1. THE Upload_Page SHALL use the Design_System layout, header, card, and primary button component styles.
2. THE Upload_Page SHALL display a "Required Columns" info box listing `hname`, `email`, and `hcos_id` using a Design_System info-box component.
3. THE Upload_Page SHALL include a Back_Link to `/` positioned in the DOM before the upload form element.
4. WHEN a user selects a file and submits the form, THE Upload_Page SHALL display a Loading_Overlay with the text "Uploading and processing contacts… please wait." within 100ms and SHALL disable the Upload button to prevent double submission.
5. WHILE an upload is in progress (after form submission until the browser navigates away), THE Upload_Page SHALL keep the Upload button in a disabled state.
6. IF no file is selected when the user clicks Upload, THEN THE Upload_Page SHALL display the validation message "Please select a file before uploading." directly below the file input field without submitting the form.

---

### Requirement 4: Duplicate Route Removal

**User Story:** As a developer maintaining this codebase, I want only one `GET /send` handler to exist, so that the application behaves predictably and the dead code does not cause confusion during future maintenance.

#### Acceptance Criteria

1. THE Server SHALL register exactly one handler for the `GET /send` route.
2. THE Server SHALL remove the second `GET /send` handler (the one that returns `{ success: true }` JSON).
3. WHEN `GET /send` is requested, THE Server SHALL execute `sendPendingEmails()` and return an HTML response showing: total contacts fetched, count of emails sent, count of failures, a table of failure details if any failures occurred, and a success message if no failures occurred.
4. IF `sendPendingEmails()` throws an unhandled exception or returns `success: false`, THEN THE Server SHALL respond with HTTP 500 and the Error_Page HTML.

---

### Requirement 5: Campaign Report Page

**User Story:** As a MediNeti team member, I want to see a clear, complete report after running a campaign, so that I know exactly how many emails were sent and can identify every failure with enough detail to act on it.

#### Acceptance Criteria

1. WHEN `sendPendingEmails()` returns with at least one contact processed, THE Campaign_Report_Page SHALL display the total contacts fetched, the count of successfully sent emails, and the count of failures using Design_System badge components (green for sent, red for failures).
2. WHEN `report.failures` contains one or more entries, THE Campaign_Report_Page SHALL display a failures table with columns: HCOS ID, Hospital Name, Email Address, and Error Message.
3. WHEN `report.failures` is empty and at least one email was sent, THE Campaign_Report_Page SHALL display a success banner reading "All emails sent successfully — no failures."
4. WHEN `report.total_contacts` equals 0, THE Campaign_Report_Page SHALL display an info banner reading "No pending contacts found. All contacts may have already been sent an email."
5. WHEN `sendPendingEmails()` returns `success: false`, THE Campaign_Report_Page SHALL render the Error_Page with title "Campaign Failed", the error message, and any available stack trace detail, with HTTP 500.
6. THE Campaign_Report_Page SHALL include a Back_Link to `/` at both the top and bottom of the content area.
7. THE Campaign_Report_Page SHALL use the Design_System stylesheet and layout.
8. THE Campaign_Report_Page SHALL XSS-escape all dynamic values — hospital names, email addresses, and error messages — before inserting them into the HTML output.

---

### Requirement 6: Test Email Report Page

**User Story:** As a MediNeti team member, I want to see a proper result page after sending a test email instead of raw JSON, so that I can confirm what was sent and spot problems immediately.

#### Acceptance Criteria

1. WHEN `GET /test-send` is requested and the test contact exists and the email sends successfully, THE Test_Email_Report_Page SHALL display a success banner with the text "Test email sent successfully."
2. WHEN the test email is sent successfully, THE Test_Email_Report_Page SHALL display the target contact details — hospital name, email address, and HCOS ID — in a labeled info box.
3. WHEN the test email is sent successfully and a Resend API response ID is present, THE Test_Email_Report_Page SHALL display that response ID in the info box.
4. WHEN `testSend()` returns `success: false` due to an API or database error (not a missing contact), THE Server SHALL render the Error_Page with the title "Test Email Failed" and the full error message, with HTTP 500.
5. WHEN no contact with `hcos_id = 0` exists in the database, THE Server SHALL render the Error_Page with title "Test Contact Not Found", the message "No contact record exists with hcos_id = 0. Please insert a test record first.", and HTTP 404.
6. THE Test_Email_Report_Page SHALL include a Back_Link to `/` at the top of the content area.
7. THE Test_Email_Report_Page SHALL use the Design_System stylesheet and layout.
8. THE Test_Email_Report_Page SHALL XSS-escape all dynamic values — hospital name, email address, HCOS ID, and Resend API response fields — before inserting them into the HTML output.

---

### Requirement 7: Upload Result Page

**User Story:** As a MediNeti team member, I want the upload result page to show me exactly what happened to every row in my file, so that I can verify the import was complete and understand any rows that were skipped.

#### Acceptance Criteria

1. WHEN `/upload-contacts` completes successfully, THE Upload_Result_Page SHALL display three summary counters: inserted count (using a `.badge-success` green badge), already-exists count (using a `.badge-warning` amber badge), and skipped count (using a `.badge-danger` red badge).
2. WHEN `inserted` contains records, THE Upload_Result_Page SHALL display an inserted records table with columns: HCOS ID, Hospital Name, and Email Address.
3. WHEN `alreadyExists` contains records, THE Upload_Result_Page SHALL display an already-exists table with columns: HCOS ID and Hospital Name.
4. WHEN `skipped` contains records, THE Upload_Result_Page SHALL display a skipped records table with columns: HCOS ID (or "—" if absent), Hospital Name (or "—" if absent), and Reason.
5. WHEN all three lists are empty, THE Upload_Result_Page SHALL display an HTML page with a visually distinct warning banner reading "The uploaded file contained no data rows."
6. WHEN any table contains more than 500 rows, THE Upload_Result_Page SHALL display only the first 500 rows and include a notice stating the total count and that the display is truncated.
7. THE Upload_Result_Page SHALL include a Back_Link to `/` at both the top and bottom of the content area.
8. THE Upload_Result_Page SHALL use the Design_System stylesheet and layout.
9. THE Upload_Result_Page SHALL XSS-escape all dynamic values — hospital names, email addresses, and error reason strings — before inserting them into the HTML output.

---

### Requirement 8: Unified Error Page

**User Story:** As a MediNeti team member, I want every error — whether from a file upload, a campaign run, or a test send — to be displayed in a consistent, readable page with full detail, so that I never face a cryptic or blank response when something goes wrong.

#### Acceptance Criteria

1. WHEN the server renders an error response, THE Error_Page SHALL display an error heading in the Design_System danger color (`#dc2626`).
2. WHEN the server renders an error response, THE Error_Page SHALL display an error title string and a summary message of no more than 500 characters.
3. WHEN additional detail items are provided, THE Error_Page SHALL display them in a Design_System styled unordered list below the summary message.
4. WHEN a stack trace or technical detail string is provided, THE Error_Page SHALL display it in a `<pre>` element with `overflow: auto` so long traces do not break the layout.
5. THE Error_Page SHALL include a Back_Link to `/` at the top of the content area.
6. THE Error_Page SHALL use the Design_System stylesheet and layout, with no inline `<style>` blocks.
7. THE Error_Page SHALL XSS-escape the title, message, all detail items, and the stack trace before inserting them into HTML output.
8. IF the HTTP response status code is 400, THEN THE Error_Page SHALL display "400 – Bad Request" as a subtitle beneath the error heading.
9. IF the HTTP response status code is 404, THEN THE Error_Page SHALL display "404 – Not Found" as a subtitle beneath the error heading.
10. IF the HTTP response status code is 500, THEN THE Error_Page SHALL display "500 – Server Error" as a subtitle beneath the error heading.
11. IF the HTTP response status code is not 400, 404, or 500, THEN THE Error_Page SHALL display the numeric status code followed by "– Error" as the subtitle.

---

### Requirement 9: XSS Output Sanitization

**User Story:** As a developer responsible for this internal tool, I want all user-influenced or database-sourced strings rendered into HTML to be HTML-escaped, so that a hospital name or email address containing `<script>` or `<img onerror=...>` cannot execute arbitrary JavaScript in an operator's browser.

#### Acceptance Criteria

1. THE Server SHALL define a helper function `escapeHtml(str)` that replaces `&` with `&amp;`, `<` with `&lt;`, `>` with `&gt;`, `"` with `&quot;`, and `'` with `&#39;` in the input string.
2. THE Server SHALL apply `escapeHtml()` to every dynamic value rendered into HTML responses in the operator's browser — including hospital name, email address, error messages, `error.stack`, `report.error`, skip reasons, column header lists, and Resend API response fields.
3. IF `escapeHtml()` receives a value that is not of type `string` (including number, boolean, null, undefined, object, or array), THEN THE Server SHALL coerce the value to a string via `String()` before applying the escape replacements.

---

### Requirement 10: Database Connection Error Handling

**User Story:** As a MediNeti team member, I want to see a clear error page if the database is unreachable, so that I know the problem is infrastructure-level rather than spending time debugging the application.

#### Acceptance Criteria

1. WHEN a database query in any route throws an error whose message contains "connect" or whose `code` property is `ECONNREFUSED` or `ETIMEDOUT`, THE Server SHALL respond with HTTP 503 and the Error_Page titled "Database Connection Error" describing that the database is unreachable and that the operator should verify the connection configuration.
2. WHEN the PostgreSQL_Pool emits an `error` event (idle client error), THE Server SHALL record the error details and continue to accept and process incoming requests without terminating the process.
3. WHEN the Server starts, THE Server SHALL register an error listener on the PostgreSQL_Pool so that idle client errors are captured and the process does not crash.

---

### Requirement 11: Loading States

**User Story:** As a MediNeti team member, I want immediate visual feedback when I trigger a campaign send or file upload, so that I know the operation is in progress and am not tempted to click again.

#### Acceptance Criteria

1. THE Loading_Overlay SHALL cover the full viewport with a backdrop whose opacity is between 0.5 and 0.8, rendered above all other page content via `z-index`.
2. THE Loading_Overlay SHALL display a centered spinner animation and the status message sourced from the triggering element's `data-loading-message` attribute.
3. WHEN a user clicks a campaign or test-send link on the Dashboard, THE Loading_Overlay SHALL become visible within 100ms.
4. WHEN a user submits the upload form, THE Loading_Overlay SHALL become visible within 100ms.
5. WHILE the Loading_Overlay is visible, it SHALL remain visible until the browser unloads the current page.
6. THE Loading_Overlay SHALL be implemented using pure CSS and vanilla JavaScript with no external libraries.
7. WHEN JavaScript is disabled, THE Loading_Overlay SHALL not appear and all forms and links SHALL continue to function normally.

---

### Requirement 12: Back Navigation on All Result Pages

**User Story:** As a MediNeti team member, I want a clearly visible "Back to Dashboard" link on every result and error page, so that I can return to the main screen without using the browser's back button.

#### Acceptance Criteria

1. THE Campaign_Report_Page SHALL display a Back_Link at both the top and bottom of the content area.
2. THE Upload_Result_Page SHALL display a Back_Link at both the top and bottom of the content area.
3. THE Test_Email_Report_Page SHALL display an HTML result page (not raw JSON) that includes a Back_Link at the top of the content area.
4. THE Error_Page SHALL display a Back_Link at the top of the content area.
5. THE Back_Link SHALL navigate to `/` (the Dashboard).
6. THE Back_Link SHALL be styled with text color `#64748b` by default, `#0f766e` on hover, no underline by default, and a `←` prefix character.

---

### Requirement 13: Upload Route Alignment

**User Story:** As a MediNeti team member, I want the "Open Upload Portal" link on the Dashboard to actually reach the upload page, so that I am not confused by a 404.

#### Acceptance Criteria

1. WHEN a user sends a `GET /upload` request, THE Server SHALL respond with HTTP 200 and an HTML response that contains a file upload form with `action="/upload-contacts"`.
2. THE Dashboard "Open Upload Portal" button SHALL use `/upload` as its `href` value.
3. WHEN a user visits `/upload`, THE Server SHALL respond with the Upload_Page HTML with HTTP status 200.
4. WHEN the `/upload` route handler encounters a file-system or server error while serving the page, THE Server SHALL respond with HTTP 500 and the Error_Page.
