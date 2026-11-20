"use strict";
const $ = id => document.getElementById(id);
const els = { logos: $("logos"), logoList: $("logoList") };
const NOFOLDERS = { createFolders: false };
const MAX_EXTRA = 5, BLANK_ROWS = 12, SMALL = 0.65;   // extra logos are 65% of the height of the FEPS logo
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let extras = [], people = [], tpl = { feps: null, plain: null };   // feps = with logo, plain = no logo at all
const noLogo = () => $("noLogo").checked;

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function refreshButton() {
  $("go").disabled = !(tpl[noLogo() ? "plain" : "feps"] && people.length);
  $("step1").classList.toggle("done", people.length > 0);
  $("step2").classList.toggle("done", ["evName", "evDate", "evPlace"].every(i => $(i).value.trim()));
  $("step3").classList.toggle("done", extras.length > 0 || noLogo());
  $("step4").classList.toggle("ready", !$("go").disabled);
}

/* ---------- The list of people (file + pasted), sorted by last name, with a Remove button ---------- */
const cmp = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
function render() {
  people.sort((a, b) => cmp(a.last || a.first, b.last || b.first) || cmp(a.first, b.first));
  $("list").replaceChildren(...people.map(p => {
    const li = document.createElement("li");
    const btn = Object.assign(document.createElement("button"), { type: "button", className: "linkbtn", textContent: "Remove" });
    btn.style.cssText = "float:right;margin:0";
    btn.setAttribute("aria-label", "Remove " + p.first + " " + p.last);
    btn.addEventListener("click", () => { people = people.filter(x => x !== p); render(); });
    li.append(btn, document.createTextNode((p.first + " " + p.last).trim() + (p.org ? " (" + p.org + ")" : "")));
    return li;
  }));
  $("count").textContent = people.length ? people.length + (people.length === 1 ? " person" : " people") : "";
  refreshButton();
}
async function loadFile(file) {
  if (!file) return;
  setStatus("");
  try {
    const { people: found, event } = readPeople(/\.xlsx$/i.test(file.name) ? await readXlsx(await file.arrayBuffer()) : readCsv(await file.text()));
    people = people.filter(p => p.src !== "file").concat(found.map(p => Object.assign(p, { src: "file" })));
    if (event && !$("evName").value.trim()) $("evName").value = event;
    $("fileMain").textContent = file.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded");
    if (!found.length) setStatus("No one found in this file.", "error");
  } catch (e) {
    $("drop").classList.remove("loaded");
    setStatus(/Couldn't find/.test(e.message) ? e.message : "That file couldn't be read. Please choose an .xlsx or .csv file.", "error");
  }
  render();
}
$("file").addEventListener("change", () => { loadFile($("file").files[0]); $("file").value = ""; });
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
for (const i of ["evName", "evDate", "evPlace"]) $(i).addEventListener("input", refreshButton);

/* Pasted people: "Firstname Lastname, Organisation" per line, or cells copied from Excel (Name, Last name, Organisation). */
function parseManual(text) {
  return text.split(/\r?\n/).map(l => l.replace(/^\uFEFF/, "").replace(/^\s*(?:[*\-•–·]+|\d+[.)])\s*/, "").trim()).filter(Boolean).map(l => {
    const tab = l.includes("\t"), c = (tab ? l.split("\t") : l.split(/\s*[,;]\s*/)).map(clean);
    if (tab && c.length >= 3) return { first: c[0], last: c[1], org: c.slice(2).filter(Boolean).join(", ") };
    return Object.assign(splitName(c[0]), { org: c.slice(1).filter(Boolean).join(", ") });
  }).filter(p => p.first || p.last);
}
$("manualAdd").addEventListener("click", () => {
  const add = parseManual($("manualText").value);
  if (!add.length) { setStatus("Type or paste at least one name first.", "error"); return; }
  setStatus("");
  people = people.concat(add.map(p => Object.assign(p, { src: "manual" })));
  $("manualText").value = ""; render();
  setStatus(add.length + (add.length === 1 ? " person added to the list." : " people added to the list."), "ok");
});

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
/* "organizer(s)" -> "organiser(s)" (also when Word has split the word over several pieces) */
const britishise = x => x.replace(/(organi)((?:<[^>]*>)*)z(er)/gi, "$1$2s$3");
/* Adds bold to a run-properties block (kept in the order Word expects) */
function bold(rpr) {
  rpr = rpr.replace(/<w:b w:val="(?:0|false)"\/>/, "");
  if (/<w:b\/>/.test(rpr)) return rpr;
  if (!rpr) return "<w:rPr><w:b/></w:rPr>";
  if (/<w:rFonts\b[^>]*\/>/.test(rpr)) return rpr.replace(/(<w:rFonts\b[^>]*\/>)/, "$1<w:b/>");
  if (/<w:rStyle\b[^>]*\/>/.test(rpr)) return rpr.replace(/(<w:rStyle\b[^>]*\/>)/, "$1<w:b/>");
  return rpr.replace("<w:rPr>", "<w:rPr><w:b/>");
}

/* d = { people, extras, ev: { name, date, place } }. `buf` is the template with the FEPS logo, or the one without any logo
   (then `extras` must be empty). */
async function buildDoc(buf, d) {
  const zip = await JSZip.loadAsync(buf);
  const read = p => zip.file(p).async("string");
  const names = Object.keys(zip.files);
  let doc = britishise(await read("word/document.xml"));
  const tbl = /<w:tbl>[\s\S]*?<\/w:tbl>/.exec(doc)[0];
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
  let open = tbl.slice(0, tbl.indexOf(rows[0]));

  // Wider "Signature" column: about 1.6 times wider, the space is taken from the Organisation column and the last one
  const grid = [...open.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => +m[1]);
  const heads = (rows[0].match(/<w:tc>[\s\S]*?<\/w:tc>/g) || []).map(c => (c.match(/<w:t[^>]*>[^<]*/g) || []).join(""));
  const si = heads.findIndex(t => /signature/i.test(t));
  let newW = null;
  if (si >= 2 && heads.length === grid.length) {
    const sig = Math.round(grid[si] * 1.6), delta = sig - grid[si];
    const donors = grid.map((_, i) => i).filter(i => i >= 2 && i !== si), sum = donors.reduce((a, i) => a + grid[i], 0);
    newW = grid.map((w, i) => i === si ? sig : donors.includes(i) ? Math.round(w - delta * w / sum) : w);
  }
  const reW = x => { if (!newW) return x; let i = 0; return x.replace(/<w:tcW w:w="\d+"/g, m => i < newW.length ? '<w:tcW w:w="' + newW[i++] + '"' : m); };
  if (newW) { let j = 0; open = open.replace(/<w:gridCol w:w="\d+"/g, m => '<w:gridCol w:w="' + newW[j++] + '"'); }
  const head = reW(strip(rows[0])), blank = reW(strip(rows[1]));

  // First name and last name in bold
  const fill = vals => { let i = 0; return blank.replace(/<w:p\b[\s\S]*?<\/w:p>/g, p => {
    const idx = i++, v = vals[idx]; if (!v) return p;
    let rpr = (/<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(p) || [, ""])[1];
    if (idx < 2) rpr = bold(rpr);
    return p.replace("</w:p>", () => '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(v) + "</w:t></w:r></w:p>");
  }); };
  const blankTbl = open + head + blank.repeat(BLANK_ROWS) + "</w:tbl>";
  const table = open + head + d.people.map(p => fill([p.first, p.last, p.org])).join("") + "</w:tbl>" + PB + blankTbl + PB + blankTbl;
  zip.file("word/document.xml", doc.replace(tbl, () => table), NOFOLDERS);

  // Header (the file that holds the placeholders): event name, date, location (+ extra logos next to the FEPS logo)
  let hdPath = null, hd = "";
  for (const n of names.filter(n => /^word\/header\d+\.xml$/.test(n))) { const x = await read(n); if (x.includes("[EVENT NAME]")) { hdPath = n; hd = britishise(x); } }
  if (!hdPath) throw new Error("the Word template has no [EVENT NAME] placeholder in its header");
  const put = (from, to) => { hd = hd.replace(from, () => to); };
  put("[EVENT NAME]", esc(d.ev.name));
  put("[DATE]", esc(d.ev.date));
  put("<w:t>[</w:t>", "<w:t></w:t>"); put("<w:t>LOCATION</w:t>", "<w:t>" + esc(d.ev.place) + "</w:t>"); put("<w:t>]</w:t>", "<w:t></w:t>");
  if (d.extras.length && /<w:drawing>/.test(hd)) {
    let types = await read("[Content_Types].xml");
    const relsPath = hdPath.replace("word/", "word/_rels/") + ".rels", extras = d.extras;
    const base = /<w:drawing>[\s\S]*?<\/w:drawing>/.exec(hd)[0];
    const H0 = 544195, HS = H0 * SMALL, X0 = 1996440 + 250000, gap = 150000, avail = 9072 * 635 - X0;
    const widths = extras.map(e => HS * e.w / e.h);
    const k = Math.min(1, avail / (widths.reduce((a, b) => a + b, 0) + gap * (extras.length - 1)));
    let x = X0, runs = "", rels = await read(relsPath), relXml = "";
    extras.forEach((e, i) => {
      const w = Math.round(widths[i] * k), h = Math.round(HS * k), y = -102447 + Math.round((H0 - h) / 2);
      const rid = "rIdLogo" + (i + 1), file = "logo_extra_" + (i + 1) + "." + e.ext, nm = "Logo " + (i + 2);
      zip.file("word/media/" + file, e.bytes, NOFOLDERS);
      relXml += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + file + '"/>';
      const dr = base.replace("<wp:posOffset>0</wp:posOffset>", "<wp:posOffset>" + x + "</wp:posOffset>").replace("<wp:posOffset>-102447</wp:posOffset>", "<wp:posOffset>" + y + "</wp:posOffset>")
        .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, '<wp:extent cx="' + w + '" cy="' + h + '"/>').replace(/<a:ext cx="\d+" cy="\d+"\/>/, '<a:ext cx="' + w + '" cy="' + h + '"/>')
        .replace('r:embed="rId1"', 'r:embed="' + rid + '"').replace(/ wp14:(?:anchorId|editId)="[^"]*"/g, "")
        .replace(/<wp:docPr [^>]*\/>/, '<wp:docPr id="' + (9000 + i) + '" name="' + nm + '"/>').replace(/<pic:cNvPr [^>]*\/>/, '<pic:cNvPr id="' + (9000 + i) + '" name="' + nm + '"/>');
      runs += '<w:r><w:rPr><w:noProof/></w:rPr>' + dr + "</w:r>";
      x += w + gap;
    });
    put("</w:drawing></w:r>", "</w:drawing></w:r>" + runs);
    zip.file(relsPath, rels.replace("</Relationships>", relXml + "</Relationships>"), NOFOLDERS);
    for (const ext of new Set(extras.map(e => e.ext)))
      if (!new RegExp('Extension="' + ext + '"', "i").test(types)) types = types.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="' + ext + '" ContentType="image/' + ext + '"/>');
    zip.file("[Content_Types].xml", types, NOFOLDERS);
  }
  zip.file(hdPath, hd, NOFOLDERS);

  // Footer (the file with the hand-typed page total "/4"): make the total automatic
  const R = '<w:r><w:rPr><w:rStyle w:val="PageNumber"/></w:rPr>', tot = /<w:r\b[^>]*><w:rPr><w:rStyle w:val="PageNumber"\/><\/w:rPr><w:t>4<\/w:t><\/w:r>/;
  for (const n of names.filter(n => /^word\/footer\d+\.xml$/.test(n))) {
    let ft = britishise(await read(n));
    if (tot.test(ft)) ft = ft.replace(tot, () => R + '<w:fldChar w:fldCharType="begin"/></w:r>' + R + '<w:instrText xml:space="preserve">NUMPAGES  </w:instrText></w:r>' + R + '<w:fldChar w:fldCharType="separate"/></w:r>' + R + "<w:t>4</w:t></w:r>" + R + '<w:fldChar w:fldCharType="end"/></w:r>');
    zip.file(n, ft, NOFOLDERS);
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "DEFLATE" });
}
/* ---- browser part (not needed by the tests) ---- */
if (typeof document !== "undefined" && document.getElementById("go")) {
$("go").addEventListener("click", async () => {
  $("go").disabled = true; setStatus("Creating the document…");
  try {
    const plain = noLogo();
    const blob = await buildDoc(tpl[plain ? "plain" : "feps"], { people, extras: plain ? [] : extras, ev: { name: $("evName").value.trim(), date: $("evDate").value.trim(), place: $("evPlace").value.trim() } });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "Registration_List.docx" });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done: Registration_List.docx downloaded (" + people.length + (people.length === 1 ? " person)." : " people)."), "ok");
    $("after").hidden = false;
  } catch (e) { setStatus("Something went wrong: " + e.message, "error"); }
  refreshButton();
});

/* "No logo at all": uses the template without any logo, so extra logos are switched off. */
$("noLogo").addEventListener("change", () => {
  const off = noLogo();
  els.logos.disabled = off; $("logoBox").style.opacity = off ? ".5" : "";
  $("noLogoNote").textContent = off ? "The document will have no logo at all, not even FEPS." : "";
  refreshButton();
});

const getTpl = name => fetch(name).then(r => { if (!r.ok) throw 0; return r.arrayBuffer(); });
Promise.all([getTpl("Registration_template_FEPS.docx"), getTpl("Registration_template.docx")])
  .then(([a, b]) => { tpl.feps = a; tpl.plain = b; $("note").textContent = "Word templates loaded."; refreshButton(); })
  .catch(() => { $("note").textContent = "The Word templates could not be loaded. Please open this page from the website, not from a downloaded file."; });
render();
}
