"use strict";
const $ = id => document.getElementById(id);
const { PDFDocument } = PDFLib;
let items = [];   // { name, bytes, pages, size }

const mode = () => document.querySelector('input[name="mode"]:checked').value;
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }

/* "1-3, 7, 10-" -> [0,1,2,6,9,...] (0-based page numbers) */
function parseRanges(text, n) {
  const out = [];
  for (const tok of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d*)-(\d*)$/.exec(tok) || /^(\d+)$/.exec(tok);
    if (!m) throw new Error("“" + tok + "” is not a page or a range. Use for example 1-3, 7, 10-");
    const a = m[2] === undefined ? +m[1] : (m[1] ? +m[1] : 1), b = m[2] === undefined ? +m[1] : (m[2] ? +m[2] : n);
    if (a < 1 || b > n || a > b) throw new Error("“" + tok + "” does not fit: this PDF has " + n + " pages.");
    for (let p = a; p <= b; p++) out.push(p - 1);
  }
  if (!out.length) throw new Error("Type the pages to keep, for example 1-3, 7.");
  return out;
}
const load = bytes => PDFDocument.load(bytes, { updateMetadata: false });

/* ---------- Interface ---------- */
function refresh() {
  const m = mode(), single = m !== "merge";
  $("extractBox").hidden = m !== "extract"; $("splitBox").hidden = m !== "split";
  $("files").multiple = !single;
  $("addLabel").textContent = single ? (items.length ? "Choose another PDF" : "Choose a PDF") : "Add PDF files";
  $("addHint").textContent = single ? "Choose the PDF to work on." : "Add them in any order: you can move them afterwards.";
  $("go").textContent = m === "merge" ? "Merge the PDFs" : m === "extract" ? "Create the new PDF" : "Split the PDF";
  $("fileList").replaceChildren(...items.map((it, i) => {
    const li = document.createElement("li");
    const nm = Object.assign(document.createElement("span"), { className: "nm2", textContent: (single ? "" : (i + 1) + ". ") + it.name });
    const meta = Object.assign(document.createElement("span"), { className: "meta", textContent: it.pages + (it.pages === 1 ? " page, " : " pages, ") + kb(it.size) });
    li.append(nm, meta);
    if (!single) {
      const mk = (t, label, fn, dis) => { const b = Object.assign(document.createElement("button"), { type: "button", textContent: t, disabled: dis }); b.setAttribute("aria-label", label + " " + it.name); b.addEventListener("click", fn); return b; };
      li.append(mk("Up", "Move up", () => { [items[i - 1], items[i]] = [items[i], items[i - 1]]; refresh(); }, i === 0),
        mk("Down", "Move down", () => { [items[i + 1], items[i]] = [items[i], items[i + 1]]; refresh(); }, i === items.length - 1));
    }
    const rm = mk2("Remove", it.name, () => { items.splice(i, 1); refresh(); }); li.append(rm);
    return li;
  }));
  const total = items.reduce((a, b) => a + b.pages, 0);
  $("sum").textContent = items.length > 1 ? "Total: " + total + " pages." : "";
  const ready = m === "merge" ? items.length >= 2 : items.length === 1;
  $("go").disabled = !ready;
  $("step2").classList.toggle("done", ready); $("step3").classList.toggle("ready", ready); $("step1").classList.add("done");
}
function mk2(t, name, fn) { const b = Object.assign(document.createElement("button"), { type: "button", className: "rm", textContent: t }); b.setAttribute("aria-label", t + " " + name); b.addEventListener("click", fn); return b; }
for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener("change", () => { if (mode() !== "merge" && items.length > 1) items = items.slice(0, 1); setStatus(""); refresh(); });

$("files").addEventListener("change", async () => {
  const list = [...$("files").files]; $("files").value = "";
  setStatus("");
  if (mode() !== "merge") items = [];
  for (const f of mode() === "merge" ? list : list.slice(0, 1)) {
    try {
      const bytes = await f.arrayBuffer(), doc = await load(bytes);
      items.push({ name: f.name, bytes, pages: doc.getPageCount(), size: f.size });
    } catch (e) {
      setStatus("“" + f.name + "” could not be used. It may be protected with a password, or it is not a valid PDF.", "error");
    }
  }
  refresh();
});

/* ---------- Doing the work ---------- */
function save(blob, name) {
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
const stem = n => n.replace(/\.pdf$/i, "");
async function pick(srcDoc, indices) {
  const out = await PDFDocument.create();
  for (const p of await out.copyPages(srcDoc, indices)) out.addPage(p);
  return out.save();
}
$("go").addEventListener("click", async () => {
  const m = mode();
  $("go").disabled = true; setStatus("Working…");
  try {
    if (m === "merge") {
      const out = await PDFDocument.create();
      for (const it of items) { const d = await load(it.bytes); for (const p of await out.copyPages(d, d.getPageIndices())) out.addPage(p); }
      save(new Blob([await out.save()], { type: "application/pdf" }), "merged.pdf");
      setStatus("Done: merged.pdf downloaded (" + items.reduce((a, b) => a + b.pages, 0) + " pages).", "ok");
    } else {
      const it = items[0], d = await load(it.bytes);
      if (m === "extract") {
        const idx = parseRanges($("ranges").value, d.getPageCount());
        save(new Blob([await pick(d, idx)], { type: "application/pdf" }), stem(it.name) + "_pages.pdf");
        setStatus("Done: " + stem(it.name) + "_pages.pdf downloaded (" + idx.length + (idx.length === 1 ? " page)." : " pages)."), "ok");
      } else {
        const n = Math.max(1, parseInt($("every").value, 10) || 1), total = d.getPageCount(), zip = new JSZip(); let parts = 0;
        for (let s = 0; s < total; s += n) {
          const e = Math.min(total, s + n), idx = Array.from({ length: e - s }, (_, k) => s + k);
          zip.file(stem(it.name) + "_p" + (s + 1 === e ? s + 1 : (s + 1) + "-" + e) + ".pdf", await pick(d, idx), { createFolders: false }); parts++;
        }
        save(await zip.generateAsync({ type: "blob", compression: "STORE" }), stem(it.name) + "_split.zip");
        setStatus("Done: " + stem(it.name) + "_split.zip downloaded (" + parts + (parts === 1 ? " file)." : " files)."), "ok");
      }
    }
  } catch (e) { setStatus(/page|range|pages|Type/.test(e.message) ? e.message : "Something went wrong: " + e.message, "error"); }
  refresh();
});
refresh();
