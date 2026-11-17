// Blog likes and comments without sign-in, stored in Google Sheets.
// Paste this whole file into Extensions > Apps Script in a NEW Google Sheet.

const OWNER_EMAIL = "";      // optional: your email, to be told about each new comment
const AUTO_APPROVE = false;  // false = you approve each comment in the sheet first (safer)
const C = "Comments", L = "Likes";

// Run this ONCE from the editor (choose "setup", then Run).
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const c = ss.getSheetByName(C) || ss.insertSheet(C);
  c.getRange(1, 1, 1, 6).setValues([["Time", "Post", "Name", "Stars", "Comment", "Status"]])
    .setFontWeight("bold");
  c.setFrozenRows(1);
  c.setColumnWidth(5, 420);
  c.getRange(2, 6, 2000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(["Pending", "Approved", "Hidden"], true).build());
  const l = ss.getSheetByName(L) || ss.insertSheet(L);
  l.getRange(1, 1, 1, 2).setValues([["Post", "Likes"]]).setFontWeight("bold");
}

function doPost(e) {
  const p = (e && e.parameter) || {};
  try {
    if (p.action === "list") return out(list(p));
    if (p.action === "comment") return out(comment(p));
    if (p.action === "like") return out(like(p));
    return out({ ok: false, error: "Unknown request." });
  } catch (err) {
    return out({ ok: false, error: "Server error. Please try again later." });
  }
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
function sheet(n) { return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(n); }
function clean(v, max) {
  v = String(v || "").trim().slice(0, max);
  return /^[=+\-@]/.test(v) ? "'" + v : v;   // stops spreadsheet formula tricks
}
function postKey(p) { return String(p.post || "").slice(0, 200); }

function getLikes(post) {
  const rows = sheet(L).getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) if (rows[i][0] === post) return Number(rows[i][1]) || 0;
  return 0;
}

function list(p) {
  const post = postKey(p);
  const rows = sheet(C).getDataRange().getValues();
  const res = []; let sum = 0, n = 0;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r[1] === post && r[5] === "Approved") {
      const st = Number(r[3]) || 0;
      if (st > 0) { sum += st; n++; }
      res.push({ name: r[2], stars: st, text: r[4],
                 date: Utilities.formatDate(new Date(r[0]), "Asia/Dhaka", "d MMM yyyy") });
    }
  }
  res.reverse();
  return { ok: true, comments: res.slice(0, 100), rated: n,
           avg: n ? Math.round(sum / n * 10) / 10 : 0, likes: getLikes(post) };
}

function comment(p) {
  if (p.website) return { ok: true, pending: true };            // spam trap
  const post = postKey(p);
  if (post.charAt(0) !== "/") return { ok: false, error: "Something went wrong." };
  const name = clean(p.name, 60), text = clean(p.text, 1000);
  const stars = Math.min(5, Math.max(0, parseInt(p.stars, 10) || 0));
  if (!name || text.length < 3) return { ok: false, error: "Please enter your name and a comment." };
  if (/https?:|www\./i.test(name + " " + text)) {
    return { ok: false, error: "Please do not include links in comments." };
  }
  const cache = CacheService.getScriptCache();
  const key = "n" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHH");
  const n = Number(cache.get(key) || 0);
  if (n >= 30) return { ok: false, error: "Too many comments right now. Please try again later." };
  cache.put(key, String(n + 1), 3600);

  const status = AUTO_APPROVE ? "Approved" : "Pending";
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet(C).appendRow([new Date(), post, name, stars, text, status]);
  } finally { lock.releaseLock(); }
  if (OWNER_EMAIL) {
    MailApp.sendEmail(OWNER_EMAIL, "New blog comment (" + status + ")",
      name + " (" + stars + " stars) on " + post + ":\n\n" + text);
  }
  return { ok: true, pending: !AUTO_APPROVE };
}

function like(p) {
  const post = postKey(p);
  if (post.charAt(0) !== "/") return { ok: false };
  const delta = parseInt(p.delta, 10) === -1 ? -1 : 1;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet(L);
    const rows = sh.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === post) {
        const v = Math.max(0, (Number(rows[i][1]) || 0) + delta);
        sh.getRange(i + 1, 2).setValue(v);
        return { ok: true, likes: v };
      }
    }
    const v = delta > 0 ? 1 : 0;
    sh.appendRow([post, v]);
    return { ok: true, likes: v };
  } finally { lock.releaseLock(); }
}
