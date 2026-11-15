"use strict";
const $ = id => document.getElementById(id);
const KINDS = { pixel: "Pixelated", black: "Black box", blur: "Blurred" };
let bmp = null, file = null, zones = [], drag = null;
const stage = $("stage"), sctx = stage.getContext("2d");
const work = document.createElement("canvas"), wctx = work.getContext("2d");
const tmp = () => document.createElement("canvas");
const kind = () => document.querySelector('input[name="kind"]:checked').value;
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }

/* Draws a copy of the zone of the original image, made small, then scaled up again. */
function shrink(z, f, smooth) {
  const sw = Math.max(1, Math.ceil(z.w / f)), sh = Math.max(1, Math.ceil(z.h / f));
  let c = tmp(); c.width = sw; c.height = sh;
  const x = c.getContext("2d"); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = "high";
  x.drawImage(bmp, z.x, z.y, z.w, z.h, 0, 0, sw, sh);
  if (smooth) {   // grow in small steps so the result is soft, not blocky
    while (c.width * 2 < z.w || c.height * 2 < z.h) {
      const n = tmp(); n.width = Math.min(z.w, c.width * 2); n.height = Math.min(z.h, c.height * 2);
      const nx = n.getContext("2d"); nx.imageSmoothingEnabled = true; nx.imageSmoothingQuality = "high"; nx.drawImage(c, 0, 0, n.width, n.height); c = n;
    }
  }
  return c;
}
function paintZone(z) {
  const level = +$("str").value, base = Math.max(bmp.width, bmp.height) / 120;
  if (z.kind === "black") { wctx.fillStyle = "#000"; wctx.fillRect(z.x, z.y, z.w, z.h); return; }
  const f = Math.max(4, Math.round(base * level * (z.kind === "pixel" ? 1.6 : 1.1)));
  const c = shrink(z, f, z.kind === "blur");
  wctx.imageSmoothingEnabled = z.kind === "blur"; wctx.imageSmoothingQuality = "high";
  wctx.drawImage(c, 0, 0, c.width, c.height, z.x, z.y, z.w, z.h);
  wctx.imageSmoothingEnabled = true;
}
function rebuild() {
  if (!bmp) return;
  wctx.clearRect(0, 0, work.width, work.height); wctx.drawImage(bmp, 0, 0);
  zones.forEach(paintZone);
  show();
  $("zoneList").replaceChildren(...zones.map((z, i) => {
    const li = document.createElement("li"), s = Object.assign(document.createElement("span"), { textContent: (i + 1) + ". " + KINDS[z.kind] });
    const b = Object.assign(document.createElement("button"), { type: "button", className: "linkbtn", textContent: "Remove" });
    b.style.marginTop = "0"; b.setAttribute("aria-label", "Remove rectangle " + (i + 1));
    b.addEventListener("click", () => { zones.splice(i, 1); rebuild(); });
    li.append(s, b); return li;
  }));
  $("undo").disabled = $("clearAll").disabled = !zones.length;
  $("go").disabled = false;
  $("step2").classList.toggle("done", zones.length > 0); $("step3").classList.toggle("ready", zones.length > 0);
}
function show() {
  sctx.drawImage(work, 0, 0);
  if (drag && drag.w > 0 && drag.h > 0) {
    const u = Math.max(2, stage.width / 400);
    sctx.save(); sctx.lineWidth = u; sctx.strokeStyle = "#c8102e"; sctx.setLineDash([u * 3, u * 2]); sctx.fillStyle = "rgba(200,16,46,.18)";
    sctx.fillRect(drag.x, drag.y, drag.w, drag.h); sctx.strokeRect(drag.x, drag.y, drag.w, drag.h); sctx.restore();
  }
}

/* ---------- Drawing rectangles with the mouse or a finger ---------- */
const pt = e => {
  const r = stage.getBoundingClientRect(), k = stage.width / r.width;
  return { x: Math.min(stage.width, Math.max(0, (e.clientX - r.left) * k)), y: Math.min(stage.height, Math.max(0, (e.clientY - r.top) * k)) };
};
let start = null;
stage.addEventListener("pointerdown", e => { if (!bmp) return; start = pt(e); drag = { x: start.x, y: start.y, w: 0, h: 0 }; stage.setPointerCapture(e.pointerId); });
stage.addEventListener("pointermove", e => {
  if (!start) return;
  const p = pt(e); drag = { x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) }; show();
});
const finish = () => {
  if (!start) return;
  const d = drag; start = null; drag = null;
  if (d && d.w >= 6 && d.h >= 6) zones.push({ x: Math.round(d.x), y: Math.round(d.y), w: Math.round(d.w), h: Math.round(d.h), kind: kind() });
  rebuild();
};
stage.addEventListener("pointerup", finish); stage.addEventListener("pointercancel", finish);
$("undo").addEventListener("click", () => { zones.pop(); rebuild(); });
$("clearAll").addEventListener("click", () => { zones = []; rebuild(); });
$("str").addEventListener("input", () => { $("strVal").textContent = $("str").value; rebuild(); });
for (const r of document.querySelectorAll('input[name="kind"]')) r.addEventListener("change", () => { $("strBox").hidden = kind() === "black"; });

/* ---------- Loading and saving ---------- */
async function loadImage(f) {
  if (!f) return;
  setStatus("");
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type) && !/\.(jpe?g|png|webp)$/i.test(f.name)) throw new Error("type");
    const b = await createImageBitmap(f);
    if (b.width * b.height > 100e6) throw new Error("big");
    bmp = b; file = f; zones = [];
    work.width = stage.width = b.width; work.height = stage.height = b.height;
    $("fmt").value = f.type === "image/jpeg" ? "image/jpeg" : "image/png";
    $("fileMain").textContent = f.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded"); $("step1").classList.add("done");
    $("info").textContent = b.width + " × " + b.height + " px";
    stage.hidden = false; $("empty").hidden = true;
    rebuild();
  } catch (e) { setStatus(e.message === "big" ? "This image is too large. Please reduce it first." : "That file couldn't be read as an image. Please choose a JPG, PNG or WebP file.", "error"); }
}
$("file").addEventListener("change", () => loadImage($("file").files[0]));
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadImage(e.dataTransfer.files[0]));
$("go").addEventListener("click", () => {
  const type = $("fmt").value, ext = type === "image/jpeg" ? "jpg" : "png", out = tmp();
  out.width = work.width; out.height = work.height;
  const x = out.getContext("2d"); if (type === "image/jpeg") { x.fillStyle = "#fff"; x.fillRect(0, 0, out.width, out.height); }
  x.drawImage(work, 0, 0);
  out.toBlob(b => {
    if (!b) { setStatus("Something went wrong while creating the image.", "error"); return; }
    const name = file.name.replace(/\.[^.]+$/, "") + "_hidden." + ext, url = URL.createObjectURL(b), a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done: " + name + " downloaded.", "ok");
  }, type, .92);
});
