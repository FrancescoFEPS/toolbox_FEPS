"use strict";
const $ = id => document.getElementById(id);

/* ====================================================================
   QR code encoder (byte mode, versions 1 to 40, error correction L/M/Q/H).
   Follows ISO/IEC 18004. ECL index: 0 = L, 1 = M, 2 = Q, 3 = H.
   ==================================================================== */
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
const FORMAT_BITS = [1, 0, 3, 2];

function rawModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) { const n = Math.floor(ver / 7) + 2; r -= (25 * n - 10) * n - 55; if (ver >= 7) r -= 36; }
  return r;
}
const dataCodewords = (ver, ecl) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
  return z;
}
function rsDivisor(d) {
  const r = new Array(d).fill(0); r[d - 1] = 1;
  let root = 1;
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) { r[j] = gfMul(r[j], root); if (j + 1 < d) r[j] ^= r[j + 1]; }
    root = gfMul(root, 2);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = div.map(() => 0);
  for (const b of data) {
    const f = b ^ r.shift(); r.push(0);
    div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
  }
  return r;
}

function qrEncode(text, ecl) {
  const bytes = Array.from(new TextEncoder().encode(text));
  let ver = 1;
  for (;; ver++) {
    if (ver > 40) throw new Error("too long");
    if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(ver, ecl) * 8) break;
  }
  const cap = dataCodewords(ver, ecl) * 8, bits = [];
  const push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(4, 4); push(bytes.length, ver < 10 ? 8 : 16); bytes.forEach(b => push(b, 8));
  push(0, Math.min(4, cap - bits.length)); push(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let v = 0; for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]; data.push(v); }

  // error correction + interleaving
  const nb = NUM_BLOCKS[ecl][ver], eccLen = ECC_PER_BLOCK[ecl][ver], raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb), div = rsDivisor(eccLen), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const all = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= nShort) all.push(b[i]); });

  // matrix
  const size = ver * 4 + 17;
  const m = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { m[y][x] = d; fn[y][x] = true; };
  const bit = (v, i) => ((v >>> i) & 1) !== 0;
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2, pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    pos.forEach((cx, i) => pos.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
  }
  const drawFormat = mask => {
    const d = FORMAT_BITS[ecl] << 3 | mask; let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = (d << 10 | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const b = ver << 12 | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); }
  }
  // data bits, zigzag
  let k = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && k < all.length * 8) { m[y][x] = bit(all[k >>> 3], 7 - (k & 7)); k++; }
    }
  }
  // masks
  const apply = mask => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const inv = [(x + y) % 2 === 0, y % 2 === 0, x % 3 === 0, (x + y) % 3 === 0, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
        x * y % 2 + x * y % 3 === 0, (x * y % 2 + x * y % 3) % 2 === 0, ((x + y) % 2 + x * y % 3) % 2 === 0][mask];
      if (!fn[y][x] && inv) m[y][x] = !m[y][x];
    }
  };
  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    apply(mask); drawFormat(mask);
    const s = penalty(m, size);
    if (s < bestScore) { bestScore = s; best = mask; }
    apply(mask);
  }
  apply(best); drawFormat(best);
  return { size, version: ver, modules: m, fn };
}

function penalty(m, size) {
  let r = 0, dark = 0;
  const P = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], Q = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const lines = m.slice();
  for (let x = 0; x < size; x++) lines.push(m.map(row => row[x]));
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i < size; i++) {
      if (line[i] === line[i - 1]) { run++; if (run === 5) r += 3; else if (run > 5) r++; } else run = 1;
    }
    for (let i = 0; i + 11 <= size; i++) {
      let a = true, b = true;
      for (let k = 0; k < 11; k++) { const v = line[i + k] ? 1 : 0; if (v !== P[k]) a = false; if (v !== Q[k]) b = false; }
      if (a || b) r += 40;
    }
  }
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x < size - 1 && y < size - 1 && m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) r += 3;
  }
  const total = size * size;
  return r + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

/* ====================================================================
   Interface
   ==================================================================== */
const MARGIN = 4, MAX_CHARS = 800;
let qr = null, logo = null, logoData = "", lastText = "";
const canvas = $("stage"), ctx = canvas.getContext("2d");

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function normalise(t) {
  t = t.trim();
  if (/^[^\s:/@]+\.[^\s]{2,}$/.test(t) && !/^[a-z][a-z0-9+.-]*:/i.test(t)) return "https://" + t;
  return t;
}
const lum = hex => { const c = [1, 3, 5].map(i => parseInt(hex.substr(i, 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; };

function geometry() {
  const n = qr.size + 2 * MARGIN, scale = Math.max(1, Math.floor($("px").value / n)), total = n * scale;
  return { n, scale, total, box: logo ? Math.round(total * $("pct").value / 100) : 0 };
}
/* Where the logo goes, in pixels: bottom-right corner (a little into the white border) or the middle. */
function logoRect(g) {
  const k = Math.min(g.box / logo.width, g.box / logo.height), w = logo.width * k, h = logo.height * k;
  let x, y;
  if ($("pos").value === "corner") { const r = (MARGIN + qr.size + 1) * g.scale; x = r - w; y = r - h; }
  else { x = (g.total - w) / 2; y = (g.total - h) / 2; }
  x += $("side").value * g.scale; y -= $("up").value * g.scale;
  return { x: Math.min(g.total - w, Math.max(0, x)), y: Math.min(g.total - h, Math.max(0, y)), w, h };
}
/* Which code squares are hidden by the logo: those touched by the logo's visible part (plus one square around it),
   or those under a plain square. This is how the transparent parts of the logo are respected. */
function clearedCells(g, r) {
  const N = g.n, S = 4, W = N * S, f = S / g.scale, size = qr.size;
  const oc = document.createElement("canvas"); oc.width = oc.height = W;
  const c = oc.getContext("2d", { willReadFrequently: true }), plain = $("back").value === "square", pad = Math.round(g.box * .12);
  if (plain) { c.fillRect((r.x - pad) * f, (r.y - pad) * f, (r.w + 2 * pad) * f, (r.h + 2 * pad) * f); }
  else c.drawImage(logo, r.x * f, r.y * f, r.w * f, r.h * f);
  const d = c.getImageData(0, 0, W, W).data;
  let hit = Array.from({ length: size }, () => new Array(size).fill(false));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    for (let yy = 0; yy < S && !hit[y][x]; yy++) for (let xx = 0; xx < S; xx++)
      if (d[(((y + MARGIN) * S + yy) * W + (x + MARGIN) * S + xx) * 4 + 3] > 40) { hit[y][x] = true; break; }
  }
  if (!plain) {
    const out = hit.map(row => row.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (hit[y][x])
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < size && xx >= 0 && xx < size) out[yy][xx] = true; }
    hit = out;
  }
  return hit;
}

function render() {
  const text = normalise($("link").value);
  $("step1").classList.toggle("done", !!text);
  $("logoTools").hidden = !logo;
  $("pctVal").textContent = $("pct").value;
  $("dlPng").disabled = $("dlSvg").disabled = true;
  $("step3").classList.remove("ready");
  qr = null;
  $("warn").hidden = true; $("warn").textContent = "";
  if (!text) { canvas.hidden = true; $("empty").hidden = false; $("stats").textContent = ""; $("linkNote").textContent = "Any web address works. Shorter links give simpler codes that are easier to scan."; return; }
  if (text.length > MAX_CHARS) {
    canvas.hidden = true; $("empty").hidden = false; $("stats").textContent = "";
    $("linkNote").textContent = "This link is too long (" + text.length + " characters). Please use a shorter link.";
    return;
  }
  $("linkNote").textContent = text !== $("link").value.trim() ? "The code opens: " + text : "Shorter links give simpler codes that are easier to scan.";
  try { qr = qrEncode(text, logo ? 3 : 1); } catch (e) { canvas.hidden = true; $("empty").hidden = false; $("linkNote").textContent = "This link is too long for a QR code. Please use a shorter link."; return; }
  lastText = text;
  const g = geometry(), fg = $("fg").value, bg = $("bg").value;
  canvas.width = canvas.height = g.total;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, g.total, g.total);
  const r = logo ? logoRect(g) : null, clear = logo ? clearedCells(g, r) : null;
  ctx.fillStyle = fg;
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x] && !(clear && clear[y][x])) ctx.fillRect((x + MARGIN) * g.scale, (y + MARGIN) * g.scale, g.scale, g.scale);
  if (logo) {
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, r.x, r.y, r.w, r.h);
    const lost = clear.flat().filter(Boolean).length / (qr.size * qr.size);
    if (lost > .12) { $("warn").hidden = false; $("warn").textContent = "The logo is large for this code, so it may not scan. Make the logo smaller or the link shorter."; }
  }
  canvas.hidden = false; $("empty").hidden = true;
  $("stats").textContent = "QR code of " + g.total + " × " + g.total + " px" + (logo ? ", made with the highest level of error correction so the logo does not stop it from working." : ".");
  const ratio = (Math.max(lum(fg), lum(bg)) + .05) / (Math.min(lum(fg), lum(bg)) + .05);
  if (lum(fg) > lum(bg) || ratio < 4) { $("warn").hidden = false; $("warn").textContent = ($("warn").textContent ? $("warn").textContent + " " : "") + "Low contrast: use a code colour much darker than the background, or the code may not scan."; }
  $("dlPng").disabled = $("dlSvg").disabled = false;
  $("step3").classList.add("ready");
}

function fileBase() {
  let host = "";
  try { host = new URL(lastText).hostname.replace(/^www\./, ""); } catch (e) {}
  return "qr_" + (host.replace(/[^a-z0-9.-]/gi, "") || "code");
}
function save(blob, name) {
  const url = URL.createObjectURL(blob), a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
  setStatus("Done: " + name + " downloaded.", "ok");
}
$("dlPng").addEventListener("click", () => canvas.toBlob(b => b ? save(b, fileBase() + ".png") : setStatus("Something went wrong while creating the image.", "error"), "image/png"));
$("dlSvg").addEventListener("click", () => {
  const g = geometry(), fg = $("fg").value, bg = $("bg").value, s = g.total, N = g.n, u = 1 / g.scale;
  const r = logo ? logoRect(g) : null, clear = logo ? clearedCells(g, r) : null;
  let d = "";
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.modules[y][x] && !(clear && clear[y][x])) d += "M" + (x + MARGIN) + " " + (y + MARGIN) + "h1v1h-1z";
  let svg = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + N + " " + N + '" width="' + s + '" height="' + s + '" shape-rendering="crispEdges">' +
    '<rect width="' + N + '" height="' + N + '" fill="' + bg + '"/><path d="' + d + '" fill="' + fg + '"/>';
  if (logo) svg += '<image x="' + r.x * u + '" y="' + r.y * u + '" width="' + r.w * u + '" height="' + r.h * u + '" xlink:href="' + logoData + '" href="' + logoData + '"/>';
  save(new Blob([svg + "</svg>"], { type: "image/svg+xml" }), fileBase() + ".svg");
});

/* ---------- Logo: built-in FEPS logo, the user's own logo, or none ---------- */
let builtIn = null, own = null;
const readDataUrl = f => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); });
function applyLogoMode() {
  const m = document.querySelector('input[name="logoMode"]:checked').value, src = m === "feps" ? builtIn : m === "own" ? own : null;
  logo = src ? src.bmp : null; logoData = src ? src.data : "";
  $("ownBox").hidden = m !== "own";
  $("step2").classList.toggle("done", !!logo);
  render();
}
function renderOwn() {
  $("logoList").replaceChildren(...(own ? [(() => {
    const li = document.createElement("li");
    const img = Object.assign(document.createElement("img"), { src: own.data, alt: "" });
    const name = Object.assign(document.createElement("span"), { textContent: own.file.name });
    const btn = Object.assign(document.createElement("button"), { type: "button", className: "linkbtn", textContent: "Remove" });
    btn.setAttribute("aria-label", "Remove " + own.file.name);
    btn.addEventListener("click", () => { own = null; renderOwn(); applyLogoMode(); });
    li.append(img, name, btn); return li;
  })()] : []));
}
for (const r of document.querySelectorAll('input[name="logoMode"]')) r.addEventListener("change", applyLogoMode);
$("logo").addEventListener("change", async () => {
  const f = $("logo").files[0]; $("logo").value = "";
  if (!f) return;
  setStatus("");
  try {
    if (!/^image\/(png|jpeg|webp)$/.test(f.type) && !/\.(png|jpe?g|webp)$/i.test(f.name)) throw new Error("type");
    own = { file: f, bmp: await createImageBitmap(f), data: await readDataUrl(f) };
  } catch (e) { setStatus("That file couldn't be read as an image. Please choose a PNG, JPG or WebP file.", "error"); }
  renderOwn(); applyLogoMode();
});
fetch("logo_FEPS.png").then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
  .then(async b => { builtIn = { bmp: await createImageBitmap(b), data: await readDataUrl(b) }; applyLogoMode(); })
  .catch(() => {
    const none = document.querySelector('input[name="logoMode"][value="none"]');
    document.querySelector('input[name="logoMode"][value="feps"]').disabled = true; none.checked = true;
    $("logoNote").textContent = "The FEPS logo could not be loaded. Open this page from the website, not from a downloaded file, or choose your own logo.";
    applyLogoMode();
  });
/* Choosing a position puts the logo back at that position's usual place; the two sliders then fine-tune it. */
$("pos").addEventListener("input", () => { $("up").value = $("pos").value === "corner" ? 3 : 0; $("side").value = $("pos").value === "corner" ? 1 : 0; });
for (const id of ["link", "fg", "bg", "px", "pct", "pos", "back", "up", "side"]) $(id).addEventListener("input", render);
render();
