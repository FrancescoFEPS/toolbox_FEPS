"use strict";
const $ = id => document.getElementById(id);
const { PDFDocument, PDFName, PDFDict, PDFArray } = PDFLib;
let links = [], fileName = "";

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }

/* Reads the clickable links of a PDF: each one is stored whole in the file, so a link that is cut over two lines on the page is complete here. */
async function findLinks(bytes) {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const found = [];
  doc.getPages().forEach((page, pi) => {
    const annots = page.node.Annots();
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      try {
        const a = annots.lookup(i, PDFDict);
        if (a.lookup(PDFName.of("Subtype")) !== PDFName.of("Link")) continue;
        const act = a.lookup(PDFName.of("A"));
        if (!(act instanceof PDFDict) || act.lookup(PDFName.of("S")) !== PDFName.of("URI")) continue;
        const raw = act.lookup(PDFName.of("URI"));
        const url = raw && raw.decodeText ? raw.decodeText().replace(/[\s\u0000-\u001F\u00AD\u200B]+/g, "") : "";
        if (url) found.push({ url, page: pi + 1 });
      } catch (e) { /* an unreadable link is skipped */ }
    }
  });
  return { links: found, pages: doc.getPageCount() };
}

/* One line per link; with "each link once", the pages where it appears are grouped. */
function grouped(list, once) {
  if (!once) return list.map(l => ({ url: l.url, pages: [l.page] }));
  const map = new Map();
  for (const l of list) { const g = map.get(l.url) || { url: l.url, pages: [] }; if (!g.pages.includes(l.page)) g.pages.push(l.page); map.set(l.url, g); }
  return [...map.values()];
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const t = Object.assign(document.createElement("textarea"), { value: text }); document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); }
}
const isWeb = u => /^https?:\/\//i.test(u);

function render() {
  const rows = grouped(links, $("once").checked);
  $("count").textContent = rows.length ? rows.length + (rows.length === 1 ? " link" : " links") : "";
  $("list").replaceChildren(...rows.map(r => {
    const li = document.createElement("li");
    const a = Object.assign(document.createElement("span"), { className: "url", textContent: r.url });
    const pg = Object.assign(document.createElement("span"), { className: "pg", textContent: (r.pages.length === 1 ? "page " : "pages ") + r.pages.join(", ") });
    const acts = Object.assign(document.createElement("span"), { className: "acts" });
    const cp = Object.assign(document.createElement("button"), { type: "button", textContent: "Copy" });
    cp.setAttribute("aria-label", "Copy the link " + r.url);
    cp.addEventListener("click", () => copyText(r.url).then(() => { cp.textContent = "Copied"; setTimeout(() => cp.textContent = "Copy", 1500); }));
    acts.append(cp);
    if (isWeb(r.url)) {
      const op = Object.assign(document.createElement("a"), { href: r.url, target: "_blank", rel: "noopener noreferrer", textContent: "Open" });
      op.setAttribute("aria-label", "Open the link " + r.url);
      acts.append(op);
    }
    li.append(a, pg, acts); return li;
  }));
  $("copyAll").disabled = !rows.length; $("copied").textContent = "";
  $("step2").classList.toggle("ready", rows.length > 0);
}

async function loadFile(f) {
  if (!f) return;
  setStatus("Reading the PDF…"); links = [];
  try {
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") throw new Error("type");
    const res = await findLinks(await f.arrayBuffer());
    links = res.links; fileName = f.name;
    $("fileMain").textContent = f.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded"); $("step1").classList.add("done");
    const diff = new Set(links.map(l => l.url)).size;
    $("summary").textContent = links.length
      ? links.length + (links.length === 1 ? " link" : " links") + " found in " + res.pages + (res.pages === 1 ? " page" : " pages") + (diff !== links.length ? " (" + diff + " different)." : ".")
      : "";
    $("none").hidden = links.length > 0;
    setStatus(links.length ? "Done: the links are complete, even those that were cut over two lines." : "", links.length ? "ok" : "");
  } catch (e) {
    $("drop").classList.remove("loaded"); $("fileMain").textContent = "Choose a PDF"; $("fileSub").textContent = "or drop it here";
    $("summary").textContent = ""; $("none").hidden = true;
    setStatus("That file couldn't be read. It may be protected with a password, or it is not a valid PDF.", "error");
  }
  render();
}
$("file").addEventListener("change", () => { loadFile($("file").files[0]); $("file").value = ""; });
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
$("once").addEventListener("change", render);
$("copyAll").addEventListener("click", async () => {
  await copyText(grouped(links, $("once").checked).map(r => r.url).join("\n"));
  $("copied").textContent = "Copied."; $("step2").classList.add("done");
});
render();
if (typeof module !== "undefined") module.exports = { findLinks };
