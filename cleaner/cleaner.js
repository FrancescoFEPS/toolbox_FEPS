"use strict";
const $ = id => document.getElementById(id);
let src = null, other = null, result = null;

const FORMATS = [["keep", "Leave as is"], ["cap", "Fix capitals (Jean-Pierre)"], ["lower", "all lowercase"], ["upper", "ALL CAPITALS"]];
const capWord = s => s.toLowerCase().replace(/(^|[\s\-'’.(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const FMT = {
  keep: s => s,
  cap: s => s && (s === s.toUpperCase() || s === s.toLowerCase()) ? capWord(s) : s,
  lower: s => s.toLowerCase(),
  upper: s => s.toUpperCase()
};
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/;
const key = s => s.replace(/\s+/g, " ").trim().toLowerCase();
const colName = i => { let s = ""; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }

/* Excel keeps dates as numbers (45123 = 2023-07-15): turn them back into dates. */
function serialToDate(v) {
  const n = Number(v);
  if (!isFinite(n) || n < 20000 || n > 80000) return null;
  const d = new Date(Math.round((n - 25569) * 86400000)), p = x => String(x).padStart(2, "0");
  const day = d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  return n % 1 > 1e-6 ? day + " " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()) : day;
}

/* ---------- Reading a list ---------- */
async function readList(file) {
  const rows = await readTable(file);
  const head = (rows[0] || []).map(c => clean(c));
  let w = head.length; while (w > 0 && !head[w - 1]) w--;
  if (!w) throw new Error("empty");
  const header = Array.from({ length: w }, (_, i) => head[i] || "Column " + (i + 1));
  return { name: file.name, header, rows: rows.slice(1) };
}
function guessFormat(h) {
  const n = norm(h);
  if (/mail/.test(n)) return "lower";
  if (n === "name" || n === "firstname" || n === "prenom") return "cap";
  return "keep";
}
function setupColumns() {
  const H = src.header, ei = H.findIndex(h => /mail/.test(norm(h)));
  $("colTable").replaceChildren(...H.map((h, i) => {
    const tr = document.createElement("tr"), td1 = document.createElement("td"), td2 = document.createElement("td");
    td1.textContent = h;
    const sel = document.createElement("select"); sel.setAttribute("aria-label", "Capitals for column " + h);
    for (const [v, t] of FORMATS) sel.append(Object.assign(document.createElement("option"), { value: v, textContent: t }));
    sel.value = guessFormat(h);
    td2.append(sel); tr.append(td1, td2); return tr;
  }));
  $("dupKey").replaceChildren(Object.assign(document.createElement("option"), { value: "all", textContent: "same values in every column" }),
    ...H.map((h, i) => Object.assign(document.createElement("option"), { value: i, textContent: "same “" + h + "”" })));
  $("dupKey").value = ei >= 0 ? ei : "all";
  $("emailBox").hidden = ei < 0;
  updateCompare();
}
function updateCompare() {
  $("cmpBox").hidden = !other;
  if (!src || !other) return;
  const common = src.header.map((h, i) => [h, i]).filter(([h]) => other.header.some(o => norm(o) === norm(h)));
  if (!common.length) { other = null; $("cmpBox").hidden = true; $("cmpNote").textContent = "The two files have no column with the same title, so they cannot be compared."; $("cmpNote").className = "hint error"; return; }
  const ei = src.header.findIndex(h => /mail/.test(norm(h)));
  $("cmpCol").replaceChildren(...common.map(([h, i]) => Object.assign(document.createElement("option"), { value: i, textContent: h })));
  if (common.some(([, i]) => i === ei)) $("cmpCol").value = ei;
}

/* ---------- Cleaning ---------- */
function process() {
  if (!src) return;
  const H0 = src.header, rep = [], note = (text, det) => rep.push({ text, det });
  let R = src.rows.map(r => H0.map((_, i) => String(r[i] == null ? "" : r[i])));
  const rowsIn = R.length;
  const show = r => r.filter(c => c).slice(0, 3).join(" | ");
  if ($("oSpaces").checked) {
    let n = 0;
    R = R.map(r => r.map(c => { const x = c.replace(/\s+/g, " ").trim(); if (x !== c) n++; return x; }));
    if (n) note(n + (n === 1 ? " cell with extra spaces was fixed." : " cells with extra spaces were fixed."));
  }
  if ($("oEmptyRows").checked) {
    const b = R.length; R = R.filter(r => r.some(c => c.trim() !== ""));
    if (b - R.length) note((b - R.length) + (b - R.length === 1 ? " empty row was removed." : " empty rows were removed."));
  }
  H0.forEach((h, i) => {
    if (!/date|time/.test(norm(h))) return;
    let n = 0;
    for (const r of R) { const v = r[i].trim(); if (/^\d+(\.\d+)?$/.test(v)) { const d = serialToDate(v); if (d) { r[i] = d; n++; } } }
    if (n) note("Dates in “" + h + "” were shown as numbers: " + n + " turned back into dates.");
  });
  const sel = [...document.querySelectorAll("#colTable select")].map(s => s.value);
  H0.forEach((h, i) => {
    const f = FMT[sel[i] || "keep"]; if (f === FMT.keep) return;
    let n = 0; for (const r of R) { const v = f(r[i]); if (v !== r[i]) { r[i] = v; n++; } }
    if (n) note(n + (n === 1 ? " value" : " values") + " in “" + h + "” changed (" + FORMATS.find(x => x[0] === sel[i])[1] + ").");
  });
  const ei = H0.findIndex(h => /mail/.test(norm(h)));
  if (ei >= 0) {
    const bad = R.filter(r => r[ei] !== "" && !EMAIL_RE.test(r[ei].trim()));
    if (bad.length) {
      const rm = $("oEmailRemove").checked;
      note(bad.length + (bad.length === 1 ? " email address looks wrong" : " email addresses look wrong") + (rm ? " (rows removed)." : " (rows kept: tick the box in step 2 to remove them)."), bad.slice(0, 20).map(r => r[ei]));
      if (rm) R = R.filter(r => !bad.includes(r));
    }
    $("emailNote").textContent = bad.length ? bad.length + " found in this file." : "None found in this file.";
  }
  if ($("oDup").checked) {
    const k = $("dupKey").value, seen = new Set(), dups = [];
    R = R.filter(r => {
      const v = k === "all" ? r.map(key).join("\u0001") : key(r[+k]);
      if (k !== "all" && !v) return true;
      if (seen.has(v)) { dups.push(show(r)); return false; }
      seen.add(v); return true;
    });
    if (dups.length) note(dups.length + (dups.length === 1 ? " duplicate was removed." : " duplicates were removed."), dups.slice(0, 20));
    else note("No duplicates found.");
  }
  if (other && !$("cmpBox").hidden) {
    const i = +$("cmpCol").value, j = other.header.findIndex(h => norm(h) === norm(H0[i]));
    const there = new Set(other.rows.map(r => key(String(r[j] == null ? "" : r[j]))).filter(Boolean)), keep = $("cmpMode").value === "keep", gone = [];
    R = R.filter(r => { const inOther = there.has(key(r[i])), ok = keep ? inOther : !inOther; if (!ok) gone.push(show(r)); return ok; });
    note(gone.length + (gone.length === 1 ? " row was removed" : " rows were removed") + " by the comparison with " + other.name + ".", gone.slice(0, 20));
  }
  let H = H0.slice();
  if ($("oEmptyCols").checked) {
    const keepIdx = H0.map((_, i) => i).filter(i => R.some(r => r[i] !== ""));
    if (keepIdx.length < H0.length) {
      note((H0.length - keepIdx.length) + " empty column" + (H0.length - keepIdx.length === 1 ? " was" : "s were") + " removed.");
      H = keepIdx.map(i => H0[i]); R = R.map(r => keepIdx.map(i => r[i]));
    }
  }
  rep.unshift({ text: rowsIn + " rows in your file, " + R.length + " in the result." });
  result = { H, R };
  render(rep);
}
function render(rep) {
  $("report").replaceChildren(...rep.map(x => {
    const li = document.createElement("li");
    if (!x.det) { li.textContent = x.text; return li; }
    const d = document.createElement("details"), s = document.createElement("summary"), ul = document.createElement("ul");
    s.textContent = x.text; ul.append(...x.det.map(t => Object.assign(document.createElement("li"), { textContent: t })));
    d.append(s, ul); li.append(d); return li;
  }));
  const { H, R } = result;
  $("pvHead").replaceChildren(Object.assign(document.createElement("tr"), {}));
  $("pvHead").firstChild.append(...H.map(h => Object.assign(document.createElement("th"), { textContent: h })));
  $("pvBody").replaceChildren(...R.slice(0, 10).map(r => { const tr = document.createElement("tr"); tr.append(...r.map(c => Object.assign(document.createElement("td"), { textContent: c }))); return tr; }));
  $("empty").hidden = true; $("tableWrap").hidden = false;
  $("count").textContent = R.length + (R.length === 1 ? " row" : " rows");
  $("pvNote").textContent = R.length > 10 ? "The first 10 rows are shown here. The file you download has all of them." : "";
  $("go").disabled = !R.length;
  $("step2").classList.add("done"); $("step3").classList.toggle("ready", R.length > 0);
}

/* ---------- Downloading ---------- */
const xml = s => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function buildXlsx(H, R) {
  const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"', REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const cell = (c, r, v, st) => v === "" ? "" : '<c r="' + colName(c) + r + '"' + (st ? ' s="1"' : "") + ' t="inlineStr"><is><t xml:space="preserve">' + xml(v) + "</t></is></c>";
  const rowXml = (vals, r, st) => '<row r="' + r + '">' + vals.map((v, c) => cell(c, r, v, st)).join("") + "</row>";
  const widths = H.map((h, i) => Math.min(50, Math.max(8, 2 + Math.max(h.length, ...R.slice(0, 200).map(r => r[i].length)))));
  const sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet ' + NS + '><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>' +
    widths.map((w, i) => '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>').join("") + "</cols><sheetData>" + rowXml(H, 1, true) + R.map((r, i) => rowXml(r, i + 2)).join("") + "</sheetData></worksheet>";
  const zip = new JSZip(), O = { createFolders: false };
  zip.file("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>', O);
  zip.file("_rels/.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/officeDocument" Target="xl/workbook.xml"/></Relationships>', O);
  zip.file("xl/workbook.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook ' + NS + ' xmlns:r="' + REL + '"><sheets><sheet name="List" sheetId="1" r:id="rId1"/></sheets></workbook>', O);
  zip.file("xl/_rels/workbook.xml.rels", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + REL + '/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + REL + '/styles" Target="styles.xml"/></Relationships>', O);
  zip.file("xl/styles.xml", '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet ' + NS + '><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>', O);
  zip.file("xl/worksheets/sheet1.xml", sheet, O);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", compression: "DEFLATE" });
}
function save(blob, name) {
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  setStatus("Done: " + name + " downloaded (" + result.R.length + " rows).", "ok");
}
$("go").addEventListener("click", async () => {
  const { H, R } = result, base = src.name.replace(/\.[^.]+$/, "") + "_cleaned";
  try {
    if ($("fmt").value === "csv") {
      const sep = $("sep").value, q = c => /["\r\n]/.test(c) || c.includes(sep) ? '"' + c.replace(/"/g, '""') + '"' : c;
      save(new Blob(["\uFEFF" + [H, ...R].map(r => r.map(q).join(sep)).join("\r\n")], { type: "text/csv;charset=utf-8" }), base + ".csv");
    } else save(await buildXlsx(H, R), base + ".xlsx");
  } catch (e) { setStatus("Something went wrong: " + e.message, "error"); }
});
$("fmt").addEventListener("change", () => { $("sepBox").hidden = $("fmt").value !== "csv"; });

/* ---------- Loading files ---------- */
async function loadFile(file) {
  if (!file) return;
  setStatus("");
  try {
    src = await readList(file); other = null; $("cmpNote").textContent = "For example, the people who already received a mailing."; $("cmpNote").className = "hint";
    $("fileMain").textContent = file.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded"); $("step1").classList.add("done");
    $("srcInfo").textContent = src.rows.length + " rows, " + src.header.length + " columns.";
    setupColumns(); process();
  } catch (e) {
    setStatus(e.message === "empty" ? "No column titles found on the first row of the file." : "That file couldn't be read. Please choose an .xlsx or .csv file.", "error");
  }
}
$("file").addEventListener("change", () => { loadFile($("file").files[0]); });
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
$("cmpFile").addEventListener("change", async () => {
  const f = $("cmpFile").files[0]; $("cmpFile").value = "";
  if (!f) return;
  $("cmpNote").className = "hint";
  if (!src) { $("cmpNote").textContent = "Upload your own list first (step 1)."; $("cmpNote").className = "hint error"; return; }
  try { other = await readList(f); $("cmpNote").textContent = "Other list: " + f.name + " (" + other.rows.length + " rows)."; updateCompare(); process(); }
  catch (e) { other = null; $("cmpNote").textContent = "That file couldn't be read. Please choose an .xlsx or .csv file."; $("cmpNote").className = "hint error"; }
});
$("cmpClear").addEventListener("click", () => { other = null; $("cmpNote").textContent = "For example, the people who already received a mailing."; $("cmpNote").className = "hint"; updateCompare(); process(); });
for (const id of ["oSpaces", "oEmptyRows", "oEmptyCols", "oEmailRemove", "oDup", "dupKey", "cmpCol", "cmpMode"]) $(id).addEventListener("change", process);
$("colTable").addEventListener("change", process);
