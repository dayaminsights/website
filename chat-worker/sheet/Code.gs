/* Dayam Insights: the lead sheet. One row per website lead (contact form or chatbot).
   Setup, once:
     1. In the Google Sheet: Extensions → Apps Script, paste this file over Code.gs, save.
     2. Project Settings (gear) → Script properties → add SHEET_TOKEN = the secret the Worker uses.
     3. Deploy → New deployment → type "Web app"; Execute as: Me; Who has access: Anyone → Deploy,
        allow access, copy the Web app URL. The Worker stores that URL as SHEET_URL.
   Redeploying after an edit: Deploy → Manage deployments → edit → Version: New version,
   which keeps the same URL. */

var HEADERS = ['Received', 'Source', 'Page', 'Name', 'Phone', 'Email', 'Business', 'Website', 'Systems', 'Need', 'Message',
  'Readiness', 'Sector', 'Country', 'City', 'Preferred call time', 'Pages suggested', 'Conversation (JSON)'];
// Row keys sent by the Worker (chat-worker/src/sheet.ts SheetRow), in column order; null is the timestamp.
var FIELDS = [null, 'source', 'page', 'name', 'phone', 'email', 'business', 'website', 'systems', 'need', 'message',
  'readiness', 'sector', 'country', 'city', 'preferred_time', 'pages_suggested', 'conversation'];

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return reply({ ok: false, error: 'bad json' }); }
  var token = PropertiesService.getScriptProperties().getProperty('SHEET_TOKEN');
  if (!token || !body || body.token !== token) return reply({ ok: false, error: 'forbidden' });
  var row = body.row || {};
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var book = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = book.getSheetByName('Leads') || book.insertSheet('Leads');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    }
    var received = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyyy-MM-dd HH:mm');
    sheet.appendRow(FIELDS.map(function (f) { return f ? safe(row[f]) : received; }));
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

// A visitor's words must never run as a formula: anything starting = + - @ is kept as text.
function safe(v) {
  if (v === undefined || v === null) return '';
  var s = String(v).slice(0, 45000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
