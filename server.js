import express from "express";
import dotenv from "dotenv";
import { Pool } from "pg";
import { Resend } from "resend";
import cron from "node-cron";
import multer from "multer";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const upload = multer({
    dest: "uploads/",
});
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false,
    },
});


pool.on('error', (err) => {
    console.error('PostgreSQL pool idle error:', err.message);
    // do not rethrow — pool recovers automatically
});

const resend = new Resend(process.env.RESEND_API_KEY);

const PORT = process.env.PORT || 3000;

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function pageShell(title, bodyHtml) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} — MediNeti Outreach</title>
  <base target="_parent">
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

function isDbConnectionError(err) {
    if (!err) return false;
    const code = err.code || '';
    const msg  = (err.message || '').toLowerCase();
    return code === 'ECONNREFUSED'
        || code === 'ETIMEDOUT'
        || msg.includes('connect');
}

function buildEmailHtml(hospitalName) {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>NABH Renewal Support</title>
</head>

<body style="margin:0;padding:0;background-color:#f5f7fa;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f7fa;padding:30px 15px;">
<tr>
<td align="center">

<table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background:#ffffff;border-radius:10px;overflow:hidden;">

<tr>
<td>
<img
src="https://resend-attachments.s3.amazonaws.com/0fc2b339-ad74-41c5-8f9a-575c50da7958"
alt="MediNeti"
width="600"
style="display:block;width:100%;height:auto;">
</td>
</tr>

<tr>
<td style="padding:35px 40px;color:#333333;font-size:15px;line-height:1.7;">

<p>Dear Sir/Madam,</p>

<p>Greetings from <strong>MediNeti Healthcare Solutions</strong>.</p>

<p>
I am <strong>Abhay Nosran</strong> from MediNeti.
While reviewing NABH-accredited healthcare organizations,
we noticed that <strong>${hospitalName}</strong>'s NABH accreditation
is approaching its renewal period.
</p>

<p>MediNeti supports hospitals with:</p>

<ul>
<li>NABH Gap Assessments</li>
<li>Documentation & SOP Development</li>
<li>Internal Audits & Mock Assessments</li>
<li>Staff Training</li>
<li>Compliance & Quality Monitoring</li>
<li>End-to-End NABH Renewal Support</li>
</ul>

<p>
We would be happy to offer a complimentary NABH Readiness Assessment
to help identify any gaps before renewal.
</p>

<p>
If this is relevant to your team, I would appreciate
the opportunity for a brief 15-minute discussion.
</p>

<p>Looking forward to hearing from you.</p>

<p>
Warm Regards,<br>
<strong>Abhay Nosran</strong><br>
Business Development Manager<br>
MediNeti Healthcare Solutions
</p>

<p>
📞 +91 7011296281<br>
✉️ abhay@medineti.com
</p>

</td>
</tr>

<tr>
<td style="background:#0f172a;padding:25px;text-align:center;">

<p style="color:#ffffff;font-weight:bold;margin:0;">
MediNeti Healthcare Solutions
</p>

<p>
<a href="https://www.medineti.com"
style="color:#5eead4;text-decoration:none;">
www.medineti.com
</a>
</p>

<p>
<a href="mailto:info@medineti.com"
style="color:#5eead4;text-decoration:none;">
info@medineti.com
</a>
</p>

<p style="font-size:12px;color:#94a3b8;">
Healthcare Quality • NABH Accreditation • Compliance Excellence
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`;
}

async function sendPendingEmails() {
const report = {
success: true,
total_contacts: 0,
sent_count: 0,
failed_count: 0,
failures: []
};


try {

    const result = await pool.query(`
        SELECT *
        FROM contacts
        WHERE already_sent = FALSE
        AND email IS NOT NULL
        LIMIT 25
    `);

    report.total_contacts = result.rows.length;

    if (result.rows.length === 0) {
        return {
            ...report,
            message: "No pending emails found."
        };
    }

    for (const contact of result.rows) {

        try {

            const response =
                await resend.emails.send({

                    from:
                    "MediNeti Healthcare Solutions <noreply@contact.medineti.com>",

                    replyTo:
                    "abhay@medineti.com",

                    to: contact.email,

                    subject:
                    `NABH Renewal Support for ${contact.hname}`,

                    html:
                    buildEmailHtml(contact.hname),
                });

            await pool.query(
                `
                UPDATE contacts
                SET
                    already_sent = TRUE,
                    sent_at = NOW(),
                    resend_email_id = $1
                WHERE id = $2
                `,
                [
                    response.data?.id || null,
                    contact.id
                ]
            );

            report.sent_count++;

        } catch (err) {

            report.failed_count++;

            report.failures.push({
                hcos_id: contact.hcos_id,
                hospital: contact.hname,
                email: contact.email,
                error: err.message
            });

            console.error(
                `Failed -> ${contact.hname}`,
                err.message
            );
        }
    }

    return report;

} catch (error) {

    console.error(error);

    return {
        success: false,
        error: error.message,
        total_contacts: 0,
        sent_count: 0,
        failed_count: 0
    };
}


}


async function testSend() {
    try {
        const result = await pool.query(`
            SELECT *
            FROM contacts
            WHERE hcos_id = 0
            LIMIT 1
        `);

        if (result.rows.length === 0) {
            console.log("No test contact found");

            return {
                success: false,
                message: "No contact found with hcos_id = 0"
            };
        }

        const contact = result.rows[0];

        const response = await resend.emails.send({
            from: "MediNeti Healthcare Solutions <noreply@contact.medineti.com>",

            replyTo: "abhay@medineti.com",

            to: contact.email,

            subject: `TEST - NABH Renewal Support for ${contact.hname}`,

            html: buildEmailHtml(contact.hname),
        });

        console.log(`Test mail sent -> ${contact.hname}`);

        return {
            success: true,
            contact: {
                id: contact.id,
                hcos_id: contact.hcos_id,
                hname: contact.hname,
                email: contact.email
            },
            resend_response: response
        };

    } catch (error) {
        console.error(error);

        return {
            success: false,
            error: error.message
        };
    }
}

function errorPage(title, message, { details = [], stack = '', statusCode = 500 } = {}) {
    const subtitleMap = {
        400: '400 – Bad Request',
        404: '404 – Not Found',
        503: '503 – Service Unavailable',
        500: '500 – Server Error',
    };
    const subtitle = subtitleMap[statusCode] || `${statusCode} – Error`;
    const truncated = String(message).slice(0, 500);
    const body = `
        <a href="/" class="back-link">← Back to Dashboard</a>
        <h2 class="text-danger">${escapeHtml(title)}</h2>
        <p class="text-muted" style="margin:4px 0 16px;font-size:0.9rem;">${escapeHtml(subtitle)}</p>
        <div class="info-box" style="border-left-color:#dc2626;background:#fff5f5;">
            <p>${escapeHtml(truncated)}</p>
            ${details.length > 0 ? `<ul style="margin-top:10px;padding-left:18px;">${details.map(d => `<li style="margin-top:4px;">${escapeHtml(d)}</li>`).join('')}</ul>` : ''}
        </div>
        ${stack ? `<pre style="overflow:auto;background:#f8fafc;padding:16px;border-radius:8px;font-size:0.8rem;margin-top:16px;border:1px solid #e2e8f0;color:#475569;">${escapeHtml(stack)}</pre>` : ''}
    `;
    return pageShell(title, body);
}

function campaignReportPage(report) {
    const backLink = `<a href="/" class="back-link">← Back to Dashboard</a>`;
    const failures = report.failures || [];
    const body = `
        ${backLink}
        <h2>Email Campaign Report</h2>
        <div class="stat-row">
            <div class="stat-chip">Total Contacts <strong>${escapeHtml(String(report.total_contacts))}</strong></div>
            <div class="stat-chip badge-success">Sent <strong>${escapeHtml(String(report.sent_count))}</strong></div>
            <div class="stat-chip badge-danger">Failed <strong>${escapeHtml(String(report.failed_count))}</strong></div>
        </div>
        ${report.total_contacts === 0
            ? `<div class="info-box">No pending contacts found. All contacts may have already been sent an email.</div>`
            : ''}
        ${failures.length > 0 ? `
            <h3>Failed Emails</h3>
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email</th><th>Error</th></tr></thead>
                    <tbody>
                        ${failures.map(f => `<tr>
                            <td>${escapeHtml(f.hcos_id)}</td>
                            <td>${escapeHtml(f.hospital)}</td>
                            <td>${escapeHtml(f.email)}</td>
                            <td>${escapeHtml(f.error)}</td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        ` : (report.sent_count > 0
            ? `<div class="info-box" style="border-left-color:#16a34a;background:#f0fdf4;color:#166534;">All emails sent successfully — no failures.</div>`
            : '')}
    `;
    return pageShell('Email Campaign Report', body);
}

function testEmailReportPage(result) {
    const contact = result.contact || {};
    const resendId = result.resend_response?.data?.id;
    const body = `
        <a href="/" class="back-link">← Back to Dashboard</a>
        <h2>Test Email Sent</h2>
        <div class="info-box" style="border-left-color:#16a34a;background:#f0fdf4;color:#166534;margin-bottom:20px;">
            ✓ Test email dispatched successfully.
        </div>
        <div class="info-box">
            <p><strong>Hospital Name:</strong> ${escapeHtml(contact.hname)}</p>
            <p style="margin-top:8px;"><strong>Email Address:</strong> ${escapeHtml(contact.email)}</p>
            <p style="margin-top:8px;"><strong>HCOS ID:</strong> ${escapeHtml(String(contact.hcos_id))}</p>
            ${resendId ? `<p style="margin-top:8px;"><strong>Resend ID:</strong> <code style="font-size:0.82rem;background:var(--surface-3,#f1f5f9);padding:2px 6px;border-radius:4px;">${escapeHtml(resendId)}</code></p>` : ''}
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
        <div class="stat-row">
            <div class="stat-chip badge-success">Inserted <strong>${inserted.length}</strong></div>
            <div class="stat-chip badge-warning">Already Exists <strong>${alreadyExists.length}</strong></div>
            <div class="stat-chip badge-danger">Skipped <strong>${skipped.length}</strong></div>
        </div>
        ${inserted.length === 0 && alreadyExists.length === 0 && skipped.length === 0
            ? `<div class="warning-box">The uploaded file contained no data rows.</div>`
            : ''}
        ${inserted.length > 0 ? `
            <h3>Inserted Records (${inserted.length})</h3>
            ${inserted.length > MAX ? `<p class="text-muted" style="font-size:0.85rem;margin-bottom:8px;">Showing first ${MAX} of ${inserted.length} rows.</p>` : ''}
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Email Address</th></tr></thead>
                    <tbody>${inserted.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td><td>${escapeHtml(r.email)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        ` : ''}
        ${alreadyExists.length > 0 ? `
            <h3>Already Exists (${alreadyExists.length})</h3>
            ${alreadyExists.length > MAX ? `<p class="text-muted" style="font-size:0.85rem;margin-bottom:8px;">Showing first ${MAX} of ${alreadyExists.length} rows.</p>` : ''}
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>HCOS ID</th><th>Hospital Name</th></tr></thead>
                    <tbody>${alreadyExists.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id)}</td><td>${escapeHtml(r.hname)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        ` : ''}
        ${skipped.length > 0 ? `
            <h3>Skipped Records (${skipped.length})</h3>
            ${skipped.length > MAX ? `<p class="text-muted" style="font-size:0.85rem;margin-bottom:8px;">Showing first ${MAX} of ${skipped.length} rows.</p>` : ''}
            <div class="table-wrapper">
                <table class="data-table">
                    <thead><tr><th>HCOS ID</th><th>Hospital Name</th><th>Reason</th></tr></thead>
                    <tbody>${skipped.slice(0, MAX).map(r => `<tr><td>${escapeHtml(r.hcos_id || '—')}</td><td>${escapeHtml(r.hname || '—')}</td><td>${escapeHtml(r.reason)}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        ` : ''}
    `;
    return pageShell('Upload Results', body);
}

// ── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        // API calls get JSON; browser navigation gets a redirect
        const acceptsHtml = req.headers.accept && req.headers.accept.includes("text/html");
        if (acceptsHtml) {
            return res.redirect("/login");
        }
        return res.status(401).json({ success: false, error: "Missing or invalid Authorization header." });
    }
    const token = authHeader.slice(7);
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = payload;
        next();
    } catch (err) {
        const acceptsHtml = req.headers.accept && req.headers.accept.includes("text/html");
        if (acceptsHtml) {
            return res.redirect("/login");
        }
        return res.status(401).json({ success: false, error: "Token invalid or expired." });
    }
}

// ── GET /login — serve login page (public) ───────────────────────────────────

app.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "login.html"));
});

// ── POST /login ──────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
    const { username, password } = req.body || {};

    if (!username || !password) {
        return res.status(400).json({ success: false, error: "username and password are required." });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM admins WHERE username = $1 AND is_active = TRUE",
            [username]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, error: "Invalid credentials." });
        }

        const admin = result.rows[0];
        const match = await bcrypt.compare(password, admin.password_hash);

        if (!match) {
            return res.status(401).json({ success: false, error: "Invalid credentials." });
        }

        // Update last login timestamp
        await pool.query(
            "UPDATE admins SET last_login_at = NOW() WHERE id = $1",
            [admin.id]
        );

        const token = jwt.sign(
            { adminId: admin.id, username: admin.username },
            process.env.JWT_SECRET,
            { expiresIn: "24h" }
        );

        return res.json({ success: true, token });

    } catch (err) {
        if (isDbConnectionError(err)) {
            return res.status(503).json({ success: false, error: "Database connection error." });
        }
        console.error("Login error:", err.message);
        return res.status(500).json({ success: false, error: "Internal server error." });
    }
});

// ── Protected routes below ───────────────────────────────────────────────────

// Home page — auth is enforced client-side (JS checks localStorage token).
// Server-side requireAuth can't work here because browser navigation
// doesn't send Authorization headers.
app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "home.html")
    );
});


app.get("/send", requireAuth, async (req, res) => {
    try {
        const report = await sendPendingEmails();
        if (!report.success) {
            return res.status(500).send(errorPage('Campaign Failed', report.error || 'Unknown error'));
        }
        return res.send(campaignReportPage(report));
    } catch (err) {
        if (isDbConnectionError(err)) {
            return res.status(503).send(errorPage('Database Connection Error', 'The database is unreachable. Please verify the connection configuration.', { statusCode: 503 }));
        }
        return res.status(500).send(errorPage('Unexpected Error', err.message, { stack: err.stack }));
    }
});




app.get("/test-send", requireAuth, async (req, res) => {
    try {
        const result = await testSend();
        if (!result.success) {
            if (result.message && result.message.includes('No contact found')) {
                return res.status(404).send(errorPage('Test Contact Not Found', 'No contact record exists with hcos_id = 0. Please insert a test record first.', { statusCode: 404 }));
            }
            return res.status(500).send(errorPage('Test Email Failed', result.error || result.message || 'Unknown error'));
        }
        return res.send(testEmailReportPage(result));
    } catch (err) {
        if (isDbConnectionError(err)) {
            return res.status(503).send(errorPage('Database Connection Error', 'The database is unreachable. Please verify the connection configuration.', { statusCode: 503 }));
        }
        return res.status(500).send(errorPage('Test Email Failed', err.message, { stack: err.stack }));
    }
});

app.get("/upload", (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'upload.html'));
    } catch (err) {
        res.status(500).send(errorPage('Server Error', 'Failed to load upload page.', { stack: err.stack }));
    }
});

app.post("/upload-contacts",
    requireAuth,
    upload.single("contacts"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    error: "No file was uploaded.",
                    details: [
                        "Choose a CSV or Excel file.",
                        "Supported formats: .csv .xlsx .xls"
                    ]
                });
            }

        
  const workbook = XLSX.readFile(req.file.path);

  const sheetName = workbook.SheetNames[0];

  const rows = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheetName],
    {
      defval: null,
    }
  );

  if (rows.length === 0) {
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      success: false,
      error: 'The uploaded file contained no data rows.',
      details: ['The uploaded file contained no data rows.']
    });
  }

  // Normalise headers: trim whitespace and lowercase for comparison
  const rawHeaders = Object.keys(rows[0]);
  const headers = rawHeaders.map(h => h.trim().toLowerCase());

  // Build a lookup so we can read rows using the original (possibly whitespaced) keys
  const headerMap = {};
  rawHeaders.forEach(h => { headerMap[h.trim().toLowerCase()] = h; });

  const requiredHeaders = [
    "hname",
    "email",
    "hcos_id",
  ];

  const missingHeaders = requiredHeaders.filter(
    (header) => !headers.includes(header)
  );

  if (missingHeaders.length > 0) {
    fs.unlinkSync(req.file.path);

    return res.status(400).json({
      success: false,
      error: 'Required columns are missing.',
      details: [
        `Required: ${requiredHeaders.join(", ")}`,
        `Found: ${rawHeaders.join(", ")}`
      ]
    });
  }

  const inserted = [];
  const alreadyExists = [];
  const skipped = [];

  for (const row of rows) {
    try {
      // Read values using normalised column names (handles whitespace/case in headers)
      const hcosId = row[headerMap['hcos_id']];
      const hname  = row[headerMap['hname']];
      const email  = row[headerMap['email']];

      // Only skip if value is null, undefined, or empty string — not if it's 0
      if (hcosId == null || hcosId === '' || !hname || !email) {
        skipped.push({
          hcos_id: hcosId ?? null,
          hname:   hname  ?? null,
          email:   email  ?? null,
          reason: "Missing hcos_id, hname or email",
        });

        continue;
      }

      const existing = await pool.query(
        `
        SELECT id
        FROM contacts
        WHERE hcos_id = $1
                `,
        [hcosId]
      );

      if (existing.rows.length > 0) {
        alreadyExists.push({
          hcos_id: hcosId,
          hname,
          message: "already in the db",
        });

        continue;
      }

      await pool.query(
        `
        INSERT INTO contacts(
                    hcos_id,
                    hname,
                    email,
                    already_sent
                )
            VALUES($1, $2, $3, FALSE)
                `,
        [
          hcosId,
          hname.trim(),
          email.trim().toLowerCase(),
        ]
      );

      inserted.push({
        hcos_id: hcosId,
        hname,
        email,
      });

    } catch (err) {

        let reason = err.message;

        if (err.code === "23503") {
            reason =
                "Referenced hcos_id does not exist in hcos table";
        }

        if (err.code === "23505") {
            reason =
                "Duplicate record already exists";
        }

        skipped.push({
            hcos_id: hcosId ?? null,
            hname:   hname  ?? null,
            email:   email  ?? null,
            reason,
            postgres_code: err.code,
        });
    }
  }

  fs.unlinkSync(req.file.path);

  return res.json({
    success: true,
    inserted,
    alreadyExists,
    skipped
  });

} catch (error) {
  console.error(error);

  if (isDbConnectionError(error)) {
      return res.status(503).json({
        success: false,
        error: 'The database is unreachable. Please verify the connection configuration.'
      });
  }
  return res.status(500).json({
    success: false,
    error: error.message
  });
}


        }
);

// cron.schedule("*/30 * * * *", async () => {
//   console.log("Running email campaign...");
//   await sendPendingEmails();
// });

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});