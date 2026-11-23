"use strict";
const $ = id => document.getElementById(id);
const MAX_PIXELS = 50e6;   // limit for one page, so the browser does not run out of memory
let pdfjs = null, pdf = null, file = null, busy = false;

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
const stem = n => n.replace(/\.pdf$/i, "");

/* pdf.js is a module: it is loaded only when a PDF is chosen. */
async function lib() {
  if (!pdfjs) {
    pdfjs = await import("../assets/pdf.min.mjs");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("../assets/pdf.worker.min.mjs", location.href).href;
  }
  return pdfjs;
}

/* "1-3, 7, 10-" -> [1,2,3,7,10,...] (page numbers starting at 1) */
function parseRanges(text, n) {
  const out = [];
  for (const tok of text.split(/[,;\s]+/).filter(Boolean)) {
    const m = /^(\d*)-(\d*)$/.exec(tok) || /^(\d+)$/.exec(tok);
    if (!m || tok === "-") throw new Error("“" + tok + "” is not a page or a range. Use for example 1-3, 7, 10-");
    const a = m[2] === undefined ? +m[1] : (m[1] ? +m[1] : 1), b = m[2] === undefined ? +m[1] : (m[2] ? +m[2] : n);
    if (a < 1 || b > n || a > b) throw new Error("“" + tok + "” does not fit: this PDF has " + n + " pages.");
    for (let p = a; p <= b; p++) if (!out.includes(p)) out.push(p);
  }
  if (!out.length) throw new Error("Type the pages to convert, for example 1-3, 7.");
  return out;
}
const pages = () => $("pAll").checked ? Array.from({ length: pdf.numPages }, (_, i) => i + 1) : parseRanges($("ranges").value, pdf.numPages);

/* Draws one page on a white canvas (a JPG cannot be transparent). */
async function draw(page, scale, canvas) {
  let vp = page.getViewport({ scale });
  const px = vp.width * vp.height;
  let capped = false;
  if (px > MAX_PIXELS) { vp = page.getViewport({ scale: scale * Math.sqrt(MAX_PIXELS / px) }); capped = true; }
  canvas.width = Math.max(1, Math.round(vp.width)); canvas.height = Math.max(1, Math.round(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, canvas, viewport: vp }).promise;
  return capped;
}

function refresh() {
  $("rangeBox").hidden = $("pAll").checked;
  $("qVal").textContent = $("q").value;
  const ready = !!pdf && !busy;
  $("go").disabled = !ready;
  $("step2").classList.toggle("done", !!pdf); $("step3").classList.toggle("ready", ready);
}

async function loadFile(f) {
  if (!f) return;
  setStatus("Reading the PDF…"); pdf = null; $("prevBox").hidden = true; $("empty").hidden = false; $("info").textContent = "";
  try {
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") throw new Error("type");
    const L = await lib();
    pdf = await L.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    file = f;
    $("fileMain").textContent = f.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded"); $("step1").classList.add("done");
    $("srcInfo").textContent = pdf.numPages + (pdf.numPages === 1 ? " page." : " pages.");
    const p1 = await pdf.getPage(1);
    await draw(p1, Math.min(2, 700 / p1.getViewport({ scale: 1 }).width), $("prev"));
    $("prevBox").hidden = false; $("empty").hidden = true; $("info").textContent = "Page 1 of " + pdf.numPages + ".";
    setStatus("");
  } catch (e) {
    pdf = null; $("drop").classList.remove("loaded"); $("fileMain").textContent = "Choose a PDF"; $("fileSub").textContent = "or drop it here"; $("srcInfo").textContent = "";
    setStatus(e && e.name === "PasswordException" ? "This PDF is protected with a password. Remove the protection first, then try again."
      : e && e.message === "type" ? "That file is not a PDF. Please choose a .pdf file."
      : "That file couldn't be read. It may be damaged, or your browser may be too old.", "error");
  }
  refresh();
}
$("file").addEventListener("change", () => { loadFile($("file").files[0]); $("file").value = ""; });
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
for (const id of ["pAll", "pSome", "q", "dpi"]) $(id).addEventListener("input", refresh);

function save(blob, name) {
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
$("go").addEventListener("click", async () => {
  let list;
  try { list = pages(); } catch (e) { setStatus(e.message, "error"); return; }
  busy = true; refresh(); $("bar").hidden = false; $("bar").value = 0;
  const scale = +$("dpi").value / 72, quality = $("q").value / 100, pad = String(pdf.numPages).length, base = stem(file.name);
  const cv = document.createElement("canvas"), out = []; let capped = false;
  try {
    for (let i = 0; i < list.length; i++) {
      setStatus("Converting page " + list[i] + " (" + (i + 1) + " of " + list.length + ")…");
      const page = await pdf.getPage(list[i]);
      if (await draw(page, scale, cv)) capped = true;
      const blob = await new Promise(r => cv.toBlob(r, "image/jpeg", quality));
      if (!blob) throw new Error("the browser could not create the image");
      out.push({ name: base + "_p" + String(list[i]).padStart(pad, "0") + ".jpg", blob });
      page.cleanup(); $("bar").value = Math.round((i + 1) / list.length * 100);
    }
    let name;
    if (out.length === 1) { name = out[0].name; save(out[0].blob, name); }
    else {
      const zip = new JSZip();
      for (const o of out) zip.file(o.name, o.blob, { createFolders: false });
      name = base + "_jpg.zip"; save(await zip.generateAsync({ type: "blob", compression: "STORE" }), name);
    }
    setStatus("Done: " + name + " downloaded (" + out.length + (out.length === 1 ? " image)." : " images).") +
      (capped ? " Some pages were very large, so they were made a little smaller to fit in the browser." : ""), "ok");
  } catch (e) { setStatus("Something went wrong: " + e.message, "error"); }
  cv.width = cv.height = 0; $("bar").hidden = true; busy = false; refresh();
});
refresh();
