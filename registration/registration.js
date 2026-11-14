"use strict";
const $ = id => document.getElementById(id);
const els = { logos: $("logos"), logoList: $("logoList") };
const NOFOLDERS = { createFolders: false };
const MAX_EXTRA = 5, BLANK_ROWS = 12;
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let extras = [], people = [], leftOut = [], templateBuf = null;

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function refreshButton() {
  $("go").disabled = !(templateBuf && people.length);
  $("step1").classList.toggle("done", people.length > 0);
  $("step2").classList.toggle("done", ["evName", "evDate", "evPlace"].every(i => $(i).value.trim()));
  $("step3").classList.toggle("done", extras.length > 0);
  $("step4").classList.toggle("ready", !$("go").disabled);
}

/* ---------- Reading the table (.xlsx or .csv) ---------- */
const dec = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const txt = p => zip.file(p) ? zip.file(p).async("string") : Promise.resolve("");
  const wb = await txt("xl/workbook.xml"), rels = await txt("xl/_rels/workbook.xml.rels");
  const rid = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb)[1];
  const tag = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => t.includes('Id="' + rid + '"'));
  const target = /Target="([^"]+)"/.exec(tag)[1];
  const sheet = await txt(target.startsWith("/") ? target.slice(1) : "xl/" + target);
  const sst = [...(await txt("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const rows = [];
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1]); if (!ref) continue;
      const col = ref[1].split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = (/\bt="([^"]+)"/.exec(c[1]) || [])[1], body = c[2] || "";
      const v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
      row[col] = t === "s" ? sst[+v] : t === "inlineStr" ? dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join("")) : v === undefined ? "" : dec(v);
    }
    rows.push(row);
  }
  return rows;
}
function readCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const d = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}

/* ---------- Keep STATUS = Allow (or no status), sorted by last name ---------- */
const norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const clean = s => String(s || "").replace(/\s+/g, " ").trim();
function analyse(rows) {
  const hdr = (rows[0] || []).map(norm), find = names => hdr.findIndex(h => names.includes(h));
  const ix = { first: find(["name", "firstname"]), last: find(["lastname", "surname", "familyname"]), org: find(["organisation", "organization"]), status: find(["status"]), event: find(["event"]) };
  const missing = [["first", "Name"], ["last", "Last name"], ["org", "Organisation"]].filter(([k]) => ix[k] < 0).map(x => x[1]);
  if (missing.length) throw new Error("Couldn't find these columns: " + missing.join(", ") + ". Please check that you chose the registrations export.");
  const all = rows.slice(1).map(r => ({ first: clean(r[ix.first]), last: clean(r[ix.last]), org: clean(r[ix.org]), status: ix.status < 0 ? "" : clean(r[ix.status]), event: clean(r[ix.event]) })).filter(p => p.first || p.last);
  const keep = p => !p.status || p.status.toLowerCase() === "allow";
  people = all.filter(keep);
  leftOut = all.filter(p => !keep(p));
  const cmp = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
  people.sort((a, b) => cmp(a.last, b.last) || cmp(a.first, b.first));
  if (people[0] && people[0].event && !$("evName").value.trim()) $("evName").value = people[0].event;
}
function render() {
  $("list").replaceChildren(...people.map(p => Object.assign(document.createElement("li"), { textContent: p.first + " " + p.last + (p.org ? " (" + p.org + ")" : "") })));
  $("count").textContent = people.length ? people.length + (people.length === 1 ? " person" : " people") : "";
  $("summary").textContent = people.length || leftOut.length ? people.length + " kept (status “Allow” or no status), " + leftOut.length + " left out." : "";
  $("leftBox").hidden = !leftOut.length;
  $("leftList").replaceChildren(...leftOut.map(p => Object.assign(document.createElement("li"), { textContent: p.first + " " + p.last + " (status: " + (p.status || "empty") + ")" })));
  refreshButton();
}
async function loadFile(file) {
  if (!file) return;
  setStatus("");
  try {
    analyse(/\.xlsx$/i.test(file.name) ? await readXlsx(await file.arrayBuffer()) : readCsv(await file.text()));
    $("fileMain").textContent = file.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded");
    if (!people.length) setStatus("No one to list in this file.", "error");
  } catch (e) {
    people = []; leftOut = []; $("drop").classList.remove("loaded");
    setStatus(/Couldn't find/.test(e.message) ? e.message : "That file couldn't be read. Please choose an .xlsx or .csv file.", "error");
  }
  render();
}
$("file").addEventListener("change", () => loadFile($("file").files[0]));
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
for (const i of ["evName", "evDate", "evPlace"]) $(i).addEventListener("input", refreshButton);

/* ---------- Logos ---------- */
function renderLogos() {
  els.logoList.replaceChildren(...extras.map((e, i) => {
    const li = document.createElement("li");
    const img = Object.assign(document.createElement("img"), { src: e.url, alt: "" });
    const name = Object.assign(document.createElement("span"), { textContent: e.file.name });
    const btn = Object.assign(document.createElement("button"), { type: "button", className: "linkbtn", textContent: "Remove" });
    btn.setAttribute("aria-label", "Remove " + e.file.name);
    btn.addEventListener("click", () => { URL.revokeObjectURL(e.url); extras.splice(i, 1); renderLogos(); });
    li.append(img, name, btn);
    return li;
  }));
  refreshButton();
}
els.logos.addEventListener("change", async () => {
  setStatus("");
  for (const file of els.logos.files) {
    if (extras.length >= MAX_EXTRA) { setStatus("You can add up to " + MAX_EXTRA + " extra logos.", "error"); break; }
    const ext = /\.png$/i.test(file.name) || file.type === "image/png" ? "png" : /\.jpe?g$/i.test(file.name) || file.type === "image/jpeg" ? "jpeg" : null;
    if (!ext) { setStatus(file.name + " is not a PNG or JPG image.", "error"); continue; }
    try {
      const bmp = await createImageBitmap(file);
      extras.push({ file, ext, w: bmp.width, h: bmp.height, bytes: await file.arrayBuffer(), url: URL.createObjectURL(file) });
    } catch (e) { setStatus("Couldn't read " + file.name + ".", "error"); }
  }
  els.logos.value = "";
  renderLogos();
});

/* ---------- Building the Word document ---------- */
const strip = x => x.replace(/ w14:(?:paraId|textId)="[^"]*"/g, "").replace('w:hRule="exact"', 'w:hRule="atLeast"');
const PB = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>';

async function buildDoc() {
  const zip = await JSZip.loadAsync(templateBuf);
  const read = p => zip.file(p).async("string");
  let doc = await read("word/document.xml");
  const tbl = /<w:tbl>[\s\S]*?<\/w:tbl>/.exec(doc)[0];
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
  const head = strip(rows[0]), blank = strip(rows[1]), open = tbl.slice(0, tbl.indexOf(rows[0]));
  const fill = vals => { let i = 0; return blank.replace(/<w:p\b[\s\S]*?<\/w:p>/g, p => {
    const v = vals[i++]; if (!v) return p;
    const rpr = (/<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(p) || [, ""])[1];
    return p.replace("</w:p>", '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(v) + "</w:t></w:r></w:p>");
  }); };
  const blankTbl = open + head + blank.repeat(BLANK_ROWS) + "</w:tbl>";
  const table = open + head + people.map(p => fill([p.first, p.last, p.org])).join("") + "</w:tbl>" + PB + blankTbl + PB + blankTbl;
  zip.file("word/document.xml", doc.replace(tbl, () => table), NOFOLDERS);

  // Header: event name, date, location (+ extra logos next to the FEPS logo)
  let hd = await read("word/header2.xml");
  const put = (from, to) => { hd = hd.replace(from, () => to); };
  put("[EVENT NAME]", esc($("evName").value.trim()));
  put("[DATE]", esc($("evDate").value.trim()));
  put("<w:t>[</w:t>", "<w:t></w:t>"); put("<w:t>LOCATION</w:t>", "<w:t>" + esc($("evPlace").value.trim()) + "</w:t>"); put("<w:t>]</w:t>", "<w:t></w:t>");
  let types = await read("[Content_Types].xml");
  if (extras.length) {
    const base = /<w:drawing>[\s\S]*?<\/w:drawing>/.exec(hd)[0];
    const H0 = 544195, X0 = 1996440 + 250000, gap = 150000, avail = 9072 * 635 - X0;
    const widths = extras.map(e => H0 * e.w / e.h);
    const k = Math.min(1, avail / (widths.reduce((a, b) => a + b, 0) + gap * (extras.length - 1)));
    let x = X0, runs = "", rels = await read("word/_rels/header2.xml.rels"), relXml = "";
    extras.forEach((e, i) => {
      const w = Math.round(widths[i] * k), h = Math.round(H0 * k), y = -102447 + Math.round((H0 - h) / 2);
      const rid = "rIdLogo" + (i + 1), file = "logo_extra_" + (i + 1) + "." + e.ext, nm = "Logo " + (i + 2);
      zip.file("word/media/" + file, e.bytes, NOFOLDERS);
      relXml += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + file + '"/>';
      const d = base.replace("<wp:posOffset>0</wp:posOffset>", "<wp:posOffset>" + x + "</wp:posOffset>").replace("<wp:posOffset>-102447</wp:posOffset>", "<wp:posOffset>" + y + "</wp:posOffset>")
        .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, '<wp:extent cx="' + w + '" cy="' + h + '"/>').replace(/<a:ext cx="\d+" cy="\d+"\/>/, '<a:ext cx="' + w + '" cy="' + h + '"/>')
        .replace('r:embed="rId1"', 'r:embed="' + rid + '"').replace(/ wp14:(?:anchorId|editId)="[^"]*"/g, "")
        .replace(/<wp:docPr [^>]*\/>/, '<wp:docPr id="' + (9000 + i) + '" name="' + nm + '"/>').replace(/<pic:cNvPr [^>]*\/>/, '<pic:cNvPr id="' + (9000 + i) + '" name="' + nm + '"/>');
      runs += '<w:r><w:rPr><w:noProof/></w:rPr>' + d + "</w:r>";
      x += w + gap;
    });
    put("</w:drawing></w:r>", "</w:drawing></w:r>" + runs);
    zip.file("word/_rels/header2.xml.rels", rels.replace("</Relationships>", relXml + "</Relationships>"), NOFOLDERS);
    for (const ext of new Set(extras.map(e => e.ext)))
      if (!new RegExp('Extension="' + ext + '"', "i").test(types)) types = types.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="' + ext + '" ContentType="image/' + ext + '"/>');
    zip.file("[Content_Types].xml", types, NOFOLDERS);
  }
  zip.file("word/header2.xml", hd, NOFOLDERS);

  // Footer: the total number of pages was typed in by hand ("/4"): make it automatic
  let ft = await read("word/footer2.xml");
  const R = '<w:r><w:rPr><w:rStyle w:val="PageNumber"/></w:rPr>';
  ft = ft.replace(/<w:r\b[^>]*><w:rPr><w:rStyle w:val="PageNumber"\/><\/w:rPr><w:t>4<\/w:t><\/w:r>/, () =>
    R + '<w:fldChar w:fldCharType="begin"/></w:r>' + R + '<w:instrText xml:space="preserve">NUMPAGES  </w:instrText></w:r>' + R + '<w:fldChar w:fldCharType="separate"/></w:r>' + R + "<w:t>4</w:t></w:r>" + R + '<w:fldChar w:fldCharType="end"/></w:r>');
  zip.file("word/footer2.xml", ft, NOFOLDERS);

  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
}
$("go").addEventListener("click", async () => {
  $("go").disabled = true; setStatus("Creating the document…");
  try {
    const blob = await buildDoc(), url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "Registration_List.docx" });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done: Registration_List.docx downloaded (" + people.length + (people.length === 1 ? " person)." : " people)."), "ok");
    $("after").hidden = false;
  } catch (e) { setStatus("Something went wrong: " + e.message, "error"); }
  refreshButton();
});

fetch("Registration_template.docx").then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); })
  .then(b => { templateBuf = b; $("note").textContent = "Word template loaded."; refreshButton(); })
  .catch(() => { $("note").textContent = "The Word template could not be loaded. Please open this page from the website, not from a downloaded file."; });
render();
