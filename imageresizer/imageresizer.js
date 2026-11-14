"use strict";
const $ = id => document.getElementById(id);

/* Ready-made formats: [label, width, height]. Edit this list to add your own. */
const PRESETS = [
  ["Link preview / social landscape (1200 × 630)", 1200, 630],
  ["Square post (1080 × 1080)", 1080, 1080],
  ["Portrait post (1080 × 1350)", 1080, 1350],
  ["Website banner, long and low (1920 × 500)", 1920, 500],
  ["LinkedIn banner (1584 × 396)", 1584, 396],
  ["X / Twitter header (1500 × 500)", 1500, 500],
  ["YouTube channel banner (2560 × 1440)", 2560, 1440],
  ["Wide banner 16:9 (1600 × 900)", 1600, 900],
  ["Thumbnail 4:3 (800 × 600)", 800, 600]
];
const MAX_SIDE = 8000;
const EXT = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

let bmp = null, file = null, zoom = 1, cx = null, cy = null, timer = 0;
const canvas = $("stage"), ctx = canvas.getContext("2d");

/* ---------- Small helpers ---------- */
const mode = () => document.querySelector('input[name="mode"]:checked').value;
const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function target() {
  const clamp = v => Math.min(MAX_SIDE, parseInt(v, 10));
  const W = clamp($("w").value), H = clamp($("h").value);
  const okW = W > 0, okH = H > 0;
  if (mode() === "fit") return okW || okH ? { W: okW ? W : Infinity, H: okH ? H : Infinity } : null;
  return okW && okH ? { W, H } : null;
}

/* ---------- Presets ---------- */
$("preset").replaceChildren(...PRESETS.map((p, i) => Object.assign(document.createElement("option"), { value: i, textContent: p[0] })), Object.assign(document.createElement("option"), { value: "custom", textContent: "Custom size" }));
function applyPreset() {
  const v = $("preset").value;
  if (v !== "custom") { $("w").value = PRESETS[v][1]; $("h").value = PRESETS[v][2]; }
  cx = cy = null; render();
}
$("preset").addEventListener("change", applyPreset);
for (const id of ["w", "h"]) $(id).addEventListener("input", () => { $("preset").value = "custom"; cx = cy = null; render(); });
$("swap").addEventListener("click", () => { [$("w").value, $("h").value] = [$("h").value, $("w").value]; $("preset").value = "custom"; cx = cy = null; render(); });
$("preset").value = "0"; applyPreset();

/* ---------- Drawing ---------- */
function render() {
  const m = mode(), t = target();
  $("cropTools").hidden = m !== "crop";
  $("bgTools").hidden = m !== "pad";
  canvas.className = m === "crop" ? "crop" : "";
  $("step2").classList.toggle("done", !!bmp && !!t);
  $("go").disabled = !(bmp && t);
  $("step3").classList.toggle("ready", !!bmp && !!t);
  $("qBox").hidden = $("fmt").value === "image/png";
  if (!bmp) return;
  $("empty").hidden = true; canvas.hidden = false;
  if (!t) { $("stats").textContent = "Type a width and a height to see the result."; return; }
  const iw = bmp.width, ih = bmp.height, fmt = $("fmt").value;
  let cw, ch, dx, dy, dw, dh, small = false;
  if (m === "crop") {
    cw = t.W; ch = t.H;
    const cover = Math.max(cw / iw, ch / ih), s = cover * zoom;
    dw = iw * s; dh = ih * s; small = s > 1;
    if (cx === null) { cx = cw / 2; cy = ch / 2; }
    cx = Math.min(dw / 2, Math.max(cw - dw / 2, cx)); cy = Math.min(dh / 2, Math.max(ch - dh / 2, cy));
    dx = cx - dw / 2; dy = cy - dh / 2;
  } else if (m === "fit") {
    const s = Math.min(1, t.W / iw, t.H / ih);
    cw = Math.max(1, Math.round(iw * s)); ch = Math.max(1, Math.round(ih * s)); dx = 0; dy = 0; dw = cw; dh = ch;
  } else {
    cw = t.W; ch = t.H;
    const s = Math.min(cw / iw, ch / ih);
    dw = iw * s; dh = ih * s; dx = (cw - dw) / 2; dy = (ch - dh) / 2; small = s > 1;
  }
  canvas.width = cw; canvas.height = ch;
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const transparent = m === "pad" && $("transparent").checked && fmt !== "image/jpeg";
  if (fmt === "image/jpeg" || (m === "pad" && !transparent)) {
    ctx.fillStyle = m === "pad" && !transparent ? $("bg").value : "#ffffff";
    ctx.fillRect(0, 0, cw, ch);
  }
  ctx.drawImage(bmp, dx, dy, dw, dh);
  $("warn").hidden = !small;
  $("warn").textContent = small ? "The original image is smaller than this size: it is enlarged and may look blurry." : "";
  scheduleStats(cw, ch);
}

/* ---------- Result size and download ---------- */
function toBlob() { return new Promise(res => canvas.toBlob(res, $("fmt").value, $("q").value / 100)); }
function scheduleStats(cw, ch) {
  clearTimeout(timer);
  $("stats").textContent = "Result: " + cw + " × " + ch + " px";
  timer = setTimeout(async () => {
    const b = await toBlob();
    if (!b) return;
    const extra = b.type !== $("fmt").value ? " (this browser cannot save that file type; it will be saved as " + EXT[b.type].toUpperCase() + ")" : "";
    $("stats").textContent = "Result: " + cw + " × " + ch + " px, about " + kb(b.size) + " (original: " + kb(file.size) + ")" + extra;
  }, 250);
}
$("fmt").addEventListener("change", render);
$("transparent").addEventListener("change", render);
$("bg").addEventListener("input", render);
$("q").addEventListener("input", () => { $("qVal").textContent = $("q").value; render(); });
$("zoom").addEventListener("input", () => { zoom = $("zoom").value / 100; render(); });
for (const r of document.querySelectorAll('input[name="mode"]')) r.addEventListener("change", () => { cx = cy = null; render(); });

$("go").addEventListener("click", async () => {
  setStatus("Preparing the image…");
  try {
    const b = await toBlob();
    if (!b) throw new Error("the browser could not create the image");
    const base = file.name.replace(/\.[^.]+$/, "");
    const url = URL.createObjectURL(b);
    const a = Object.assign(document.createElement("a"), { href: url, download: base + "_" + canvas.width + "x" + canvas.height + "." + EXT[b.type] });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done: " + a.download + " downloaded (" + kb(b.size) + ").", "ok");
  } catch (e) { setStatus("Something went wrong: " + e.message, "error"); }
});

/* ---------- Dragging the image (crop mode) ---------- */
let drag = null;
canvas.addEventListener("pointerdown", e => {
  if (mode() !== "crop") return;
  drag = { x: e.clientX, y: e.clientY, cx, cy }; canvas.setPointerCapture(e.pointerId); canvas.classList.add("drag");
});
canvas.addEventListener("pointermove", e => {
  if (!drag) return;
  const k = canvas.width / canvas.getBoundingClientRect().width;
  cx = drag.cx + (e.clientX - drag.x) * k; cy = drag.cy + (e.clientY - drag.y) * k; render();
});
for (const ev of ["pointerup", "pointercancel"]) canvas.addEventListener(ev, () => { drag = null; canvas.classList.remove("drag"); });

/* ---------- Loading the image ---------- */
async function loadImage(f) {
  if (!f) return;
  setStatus("");
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) throw new Error("type");
    const b = await createImageBitmap(f);
    bmp = b; file = f; zoom = 1; cx = cy = null; $("zoom").value = 100;
    $("fmt").value = f.type === "image/png" ? "image/png" : f.type === "image/webp" ? "image/webp" : "image/jpeg";
    $("fileMain").textContent = f.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded");
    $("srcInfo").textContent = "Original: " + b.width + " × " + b.height + " px, " + kb(f.size) + ".";
    $("step1").classList.add("done");
  } catch (e) {
    setStatus("That file couldn't be read as an image. Please choose a JPG, PNG or WebP file.", "error");
  }
  render();
}
$("file").addEventListener("change", () => loadImage($("file").files[0]));
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadImage(e.dataTransfer.files[0]));
render();
