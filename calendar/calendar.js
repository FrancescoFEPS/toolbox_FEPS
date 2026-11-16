"use strict";
const $ = id => document.getElementById(id);
let cur = null, icsText = "";

/* ---------- Time zones: local time in a chosen zone -> UTC ---------- */
function tzOffsetMinutes(utcMs, tz) {
  const parts = {};
  for (const p of new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs))) parts[p.type] = p.value;
  return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - utcMs) / 60000;
}
function zonedToUtcMs(y, mo, d, h, mi, tz) {
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = tzOffsetMinutes(guess, tz);
  let ms = guess - off * 60000;
  const off2 = tzOffsetMinutes(ms, tz);
  if (off2 !== off) ms = guess - off2 * 60000;
  return ms;
}
const fmtUtc = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");   // 20261112T130000Z
const fmtDay = ms => new Date(ms).toISOString().slice(0, 10).replace(/-/g, "");                 // 20261112
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);                                   // 2026-11-12
const isoUtc = ms => new Date(ms).toISOString().replace(/\.\d{3}/, "");                        // 2026-11-12T13:00:00Z

/* ---------- Reading the form ---------- */
function read() {
  const title = $("title").value.trim(), date = $("date").value;
  if (!title || !date) return { empty: true };
  const allDay = $("allDay").checked, endDate = $("endDate").value || date;
  const [y, m, d] = date.split("-").map(Number), [ey, em, ed] = endDate.split("-").map(Number);
  const ev = { title, allDay, place: $("place").value.trim(), desc: $("desc").value.trim(), url: $("link").value.trim(), tz: $("tz").value };
  if (allDay) {
    const s = Date.UTC(y, m - 1, d), e = Date.UTC(ey, em - 1, ed);
    if (e < s) return { error: "The end date is before the start date." };
    ev.start = s; ev.end = e + 86400000;
  } else {
    if (!$("time").value) return { error: "Add the start time, or tick “All day”." };
    const [h, mi] = $("time").value.split(":").map(Number);
    const s = zonedToUtcMs(y, m, d, h, mi, ev.tz);
    let e;
    if ($("endTime").value) { const [eh, emi] = $("endTime").value.split(":").map(Number); e = zonedToUtcMs(ey, em, ed, eh, emi, ev.tz); }
    else if ($("endDate").value && $("endDate").value !== date) return { error: "Add the end time, or clear the end date." };
    else e = s + 3600000;
    if (e <= s) return { error: "The end must be after the start." };
    ev.start = s; ev.end = e;
  }
  return { ev };
}

/* ---------- Building the file and the links ---------- */
const fullDesc = ev => ev.desc + (ev.url ? (ev.desc ? "\n\n" : "") + ev.url : "");
const esc = s => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const enc = new TextEncoder(); let out = "", cur = "", bytes = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (bytes + n > 73) { out += cur + "\r\n "; cur = ""; bytes = 0; }
    cur += ch; bytes += n;
  }
  return out + cur;
}
function buildIcs(ev) {
  const uid = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(16).slice(2)) + "@toolbox-feps";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FEPS//Toolbox//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "BEGIN:VEVENT", "UID:" + uid, "DTSTAMP:" + fmtUtc(Date.now())];
  if (ev.allDay) L.push("DTSTART;VALUE=DATE:" + fmtDay(ev.start), "DTEND;VALUE=DATE:" + fmtDay(ev.end));
  else L.push("DTSTART:" + fmtUtc(ev.start), "DTEND:" + fmtUtc(ev.end));
  L.push("SUMMARY:" + esc(ev.title));
  if (ev.place) L.push("LOCATION:" + esc(ev.place));
  if (fullDesc(ev)) L.push("DESCRIPTION:" + esc(fullDesc(ev)));
  if (ev.url) L.push("URL:" + ev.url);
  L.push("END:VEVENT", "END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
const q = o => Object.entries(o).filter(([, v]) => v !== "" && v != null).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
function buildLinks(ev) {
  const google = "https://calendar.google.com/calendar/render?" + q({ action: "TEMPLATE", text: ev.title,
    dates: ev.allDay ? fmtDay(ev.start) + "/" + fmtDay(ev.end) : fmtUtc(ev.start) + "/" + fmtUtc(ev.end), details: fullDesc(ev), location: ev.place }).replace(/dates=[^&]*/, m => m.replace(/%2F/g, "/"));
  const outlook = host => "https://" + host + "/calendar/0/deeplink/compose?" + q({ path: "/calendar/action/compose", rru: "addevent", subject: ev.title,
    startdt: ev.allDay ? isoDay(ev.start) : isoUtc(ev.start), enddt: ev.allDay ? isoDay(ev.end) : isoUtc(ev.end), allday: ev.allDay ? "true" : "", body: fullDesc(ev), location: ev.place });
  return { google, o365: outlook("outlook.office.com"), outlook: outlook("outlook.live.com") };
}
const attr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const slug = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "event";

/* ---------- Showing everything ---------- */
function copyText(text, done) {
  const fallback = () => { const t = Object.assign(document.createElement("textarea"), { value: text }); document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); };
  (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).catch(fallback).then(done);
}
function summaryText(ev) {
  if (ev.allDay) {
    const f = ms => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", dateStyle: "full" }).format(new Date(ms));
    const last = ev.end - 86400000;
    return f(ev.start) + (last > ev.start ? " to " + f(last) : "") + " (all day)";
  }
  const f = ms => new Intl.DateTimeFormat("en-GB", { timeZone: ev.tz, dateStyle: "full", timeStyle: "short" }).format(new Date(ms));
  return f(ev.start) + " to " + f(ev.end) + " (" + ev.tz.replace(/_/g, " ") + ")";
}
function refresh() {
  const allDay = $("allDay").checked;
  $("timeBox").hidden = $("endTimeBox").hidden = allDay;
  $("endNote").textContent = allDay ? "If you leave the end date empty, the event lasts one day." : "If you leave the end empty, the event lasts one hour.";
  $("icsBox").hidden = !$("chkIcs").checked;
  const r = read();
  $("msg").textContent = r.error || "";
  cur = r.ev || null;
  $("empty").hidden = !!cur;
  $("out").hidden = !cur;
  $("dlIcs").disabled = !cur; $("copySnippet").disabled = !cur;
  $("step1").classList.toggle("done", !!cur); $("step2").classList.toggle("ready", !!cur);
  $("copied").textContent = "";
  if (!cur) { $("snippet").value = ""; icsText = ""; return; }
  icsText = buildIcs(cur);
  const L = buildLinks(cur);
  $("summary").replaceChildren(Object.assign(document.createElement("strong"), { textContent: cur.title }), document.createTextNode(summaryText(cur)));
  const items = [["Google Calendar", L.google], ["Outlook (work or school account)", L.o365], ["Outlook.com (personal account)", L.outlook]];
  $("links").replaceChildren(...items.map(([label, href]) => {
    const li = document.createElement("li"), b = document.createElement("b"), acts = Object.assign(document.createElement("div"), { className: "acts" });
    b.textContent = label;
    const open = Object.assign(document.createElement("a"), { href, target: "_blank", rel: "noopener", textContent: "Open" });
    open.setAttribute("aria-label", "Open the " + label + " link");
    const copy = Object.assign(document.createElement("button"), { type: "button", textContent: "Copy the link" });
    copy.setAttribute("aria-label", "Copy the " + label + " link");
    copy.addEventListener("click", () => copyText(href, () => { copy.textContent = "Copied"; setTimeout(() => copy.textContent = "Copy the link", 1500); }));
    acts.append(open, copy); li.append(b, acts); return li;
  }));
  const parts = [];
  if ($("chkG").checked) parts.push('<a href="' + attr(L.google) + '" target="_blank">Add to Google Calendar</a>');
  if ($("chkO365").checked) parts.push('<a href="' + attr(L.o365) + '" target="_blank">Add to Outlook</a>');
  if ($("chkOL").checked) parts.push('<a href="' + attr(L.outlook) + '" target="_blank">Add to Outlook.com</a>');
  if ($("chkIcs").checked && $("icsUrl").value.trim()) parts.push('<a href="' + attr($("icsUrl").value.trim()) + '" target="_blank">Add to Apple Calendar</a>');
  $("snippet").value = parts.length ? '<p style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;">\n' + parts.join(" &nbsp;|&nbsp;\n") + "\n</p>" : "";
}

/* ---------- Actions ---------- */
$("dlIcs").addEventListener("click", () => {
  if (!cur) return;
  const url = URL.createObjectURL(new Blob([icsText], { type: "text/calendar;charset=utf-8" })), name = slug(cur.title) + ".ics";
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  $("status").textContent = "Done: " + name + " downloaded."; $("status").className = "ok";
  $("step2").classList.add("done");
});
$("copySnippet").addEventListener("click", () => {
  if (!$("snippet").value) { $("copied").textContent = "Tick at least one link first."; return; }
  copyText($("snippet").value, () => { $("copied").textContent = "Copied."; $("step3").classList.add("done"); });
});
for (const el of document.querySelectorAll("input, select, textarea")) { el.addEventListener("input", refresh); el.addEventListener("change", refresh); }
refresh();
