"use strict";
const $ = id => document.getElementById(id);
const FONT = "Arial, Helvetica, sans-serif", SERIF = "Georgia, 'Times New Roman', serif";
const RED = "#c8102e", INK = "#14161b";
const STYLES = {
  red:   { bg: RED, quote: "#ffffff", mark: "#ffffff", name: "#ffffff", role: "rgba(255,255,255,.88)", ring: "#ffffff" },
  white: { bg: "#ffffff", quote: INK, mark: RED, name: INK, role: "#566070", ring: RED, bar: RED },
  dark:  { bg: INK, quote: "#ffffff", mark: RED, name: "#ffffff", role: "#d5dae1", ring: RED }
};
/* w, h: size in px; p: margin; q: biggest and smallest quote font; mark: size of the opening quotation mark */
const FORMATS = {
  square:   { w: 1080, h: 1080, p: 90, q: [76, 34], mark: 210 },
  portrait: { w: 1080, h: 1350, p: 90, q: [84, 36], mark: 230 },
  wide:     { w: 1200, h: 630, p: 64, q: [52, 26], mark: 150 }
};
const SAMPLE = { quote: "A short, striking sentence from the speaker goes here.", name: "Firstname LASTNAME", role: "Title, Organisation" };
let photo = null, logo = null, photoFile = null, logoFile = null;
const cv = $("stage"), ctx = cv.getContext("2d");
const val = id => $(id).value.replace(/\s+/g, " ").trim();
const style = () => document.querySelector('input[name="style"]:checked').value;
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }

function wrap(text, maxW) {
  const lines = [];
  for (const para of text.split(/\n/)) {
    let line = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? line + " " + word : word;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}
/* Biggest font size at which the quote fits in the box; if it never fits, the text is cut with “…”. */
function fit(text, maxW, maxH, [big, small]) {
  let size = big, lines;
  for (; size >= small; size -= 2) {
    ctx.font = "700 " + size + "px " + FONT; lines = wrap(text, maxW);
    if (lines.length * size * 1.27 <= maxH) return { size, lines, cut: false };
  }
  size = small; ctx.font = "700 " + size + "px " + FONT; lines = wrap(text, maxW);
  const n = Math.max(1, Math.floor(maxH / (size * 1.27)));
  lines = lines.slice(0, n); lines[n - 1] = lines[n - 1].replace(/[\s.,;:!?]*$/, "") + "…";
  return { size, lines, cut: true };
}
function drawCircle(img, cx, cy, d, ring) {
  const r = d / 2, s = Math.min(img.width, img.height);
  ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  ctx.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, cx - r, cy - r, d, d); ctx.restore();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(4, d * .03); ctx.strokeStyle = ring; ctx.stroke();
}
function drawLogo(x, y, maxW, maxH, align, st) {
  const k = Math.min(maxW / logo.width, maxH / logo.height), w = logo.width * k, h = logo.height * k, lx = align === "right" ? x - w : x;
  if ($("plate").checked) {
    const pad = Math.round(Math.min(w, h) * .22); ctx.fillStyle = "#ffffff"; ctx.beginPath();
    ctx.roundRect(lx - pad, y - pad, w + 2 * pad, h + 2 * pad, pad * .6); ctx.fill();
  }
  ctx.imageSmoothingQuality = "high"; ctx.drawImage(logo, lx, y, w, h);
  return { w, h };
}

function draw() {
  const f = FORMATS[$("format").value], st = STYLES[style()], W = f.w, H = f.h, P = f.p, wide = W > H;
  cv.width = W; cv.height = H;
  const quote = $("quote").value.replace(/^[\s"“”«»]+|[\s"“”«»]+$/g, "").trim() || SAMPLE.quote;
  const name = val("name") || SAMPLE.name, role = $("role").value.trim() || ($("name").value.trim() ? "" : SAMPLE.role);
  ctx.fillStyle = st.bg; ctx.fillRect(0, 0, W, H);
  if (st.bar) { ctx.fillStyle = st.bar; ctx.fillRect(0, 0, W, Math.round(W * .014)); }
  ctx.textBaseline = "top"; ctx.textAlign = "left";
  const nameSize = Math.round(Math.min(W, 1080) * .037), roleSize = Math.round(Math.min(W, 1080) * .027);
  const logoMaxW = Math.round(W * .2), logoMaxH = Math.round(Math.min(W, H) * .09);
  const markH = Math.round(f.mark * .5);
  const drawMark = (x, y) => { ctx.fillStyle = st.mark; ctx.font = "700 " + f.mark + "px " + SERIF; ctx.fillText("\u201C", x, y - Math.round(f.mark * .22)); };
  let cut = false;

  if (!wide) {
    const avatar = photo ? Math.round(W * .12) : 0, gap = avatar ? 26 : 0;
    const nameH = Math.round(nameSize * 1.3) + (role ? Math.round(roleSize * 1.4) : 0), footH = Math.max(avatar, nameH);
    const footY = H - P - footH, logoW = logo ? logoMaxW + 40 : 0;
    drawMark(P, P);
    const top = P + markH + 24, box = fit(quote, W - 2 * P, footY - 44 - top, f.q); cut = box.cut;
    ctx.fillStyle = st.quote; ctx.font = "700 " + box.size + "px " + FONT;
    box.lines.forEach((l, i) => ctx.fillText(l, P, top + i * box.size * 1.27));
    if (avatar) drawCircle(photo, P + avatar / 2, footY + footH / 2, avatar, st.ring);
    const tx = P + avatar + gap, ty = footY + (footH - nameH) / 2, mw = W - P - tx - logoW;
    ctx.fillStyle = st.name; ctx.font = "700 " + nameSize + "px " + FONT; ctx.fillText(name, tx, ty, mw);
    if (role) { ctx.fillStyle = st.role; ctx.font = "400 " + roleSize + "px " + FONT; ctx.fillText(role, tx, ty + Math.round(nameSize * 1.3), mw); }
    if (logo) { const g = logo && drawLogoSize(); drawLogo(W - P, footY + (footH - g.h) / 2, logoMaxW, logoMaxH, "right", st); }
  } else {
    const d = photo ? Math.round(H * .42) : 0, tx = photo ? P + d + Math.round(P * .8) : P, tw = W - tx - P;
    const nameH = Math.round(nameSize * 1.3) + (role ? Math.round(roleSize * 1.4) : 0), gap = 26;
    const box = fit(quote, tw, H - 2 * P - markH - gap - nameH - (logo ? 0 : 0), f.q); cut = box.cut;
    const qH = box.lines.length * box.size * 1.27, total = markH + qH + gap + nameH, y0 = Math.max(P, (H - total) / 2);
    if (photo) drawCircle(photo, P + d / 2, H / 2, d, st.ring);
    drawMark(tx, y0);
    ctx.fillStyle = st.quote; ctx.font = "700 " + box.size + "px " + FONT;
    box.lines.forEach((l, i) => ctx.fillText(l, tx, y0 + markH + i * box.size * 1.27));
    const ny = y0 + markH + qH + gap;
    ctx.fillStyle = st.name; ctx.font = "700 " + nameSize + "px " + FONT; ctx.fillText(name, tx, ny, tw);
    if (role) { ctx.fillStyle = st.role; ctx.font = "400 " + roleSize + "px " + FONT; ctx.fillText(role, tx, ny + Math.round(nameSize * 1.3), tw); }
    if (logo) drawLogo(W - Math.round(P * .7), Math.round(P * .7), logoMaxW * .8, logoMaxH, "right", st);
  }
  $("info").textContent = W + " × " + H + " px" + (cut ? ". The quote is too long and was cut: please shorten it." : "");
  const ok = !!$("quote").value.trim();
  $("go").disabled = !ok; $("step1").classList.toggle("done", ok); $("step3").classList.toggle("ready", ok);
}
function drawLogoSize() { const k = Math.min(FORMATS[$("format").value].w * .2 / logo.width, Math.min(FORMATS[$("format").value].w, FORMATS[$("format").value].h) * .09 / logo.height); return { w: logo.width * k, h: logo.height * k }; }

/* ---------- Photo and logo ---------- */
function listOf(ul, file, url, remove) {
  ul.replaceChildren(...(file ? [(() => {
    const li = document.createElement("li"), img = Object.assign(document.createElement("img"), { src: url, alt: "" });
    const nm = Object.assign(document.createElement("span"), { textContent: file.name });
    const b = Object.assign(document.createElement("button"), { type: "button", className: "linkbtn", textContent: "Remove" });
    b.setAttribute("aria-label", "Remove " + file.name); b.addEventListener("click", remove);
    li.append(img, nm, b); return li;
  })()] : []));
}
let photoUrl = "", logoUrl = "";
function picker(id, set) {
  $(id).addEventListener("change", async () => {
    const f = $(id).files[0]; $(id).value = ""; if (!f) return; setStatus("");
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(f.type) && !/\.(png|jpe?g|webp)$/i.test(f.name)) throw new Error("type");
      set(f, await createImageBitmap(f));
    } catch (e) { setStatus("That file couldn't be read as an image. Please choose a PNG, JPG or WebP file.", "error"); }
    refresh();
  });
}
picker("photo", (f, b) => { photo = b; photoFile = f; URL.revokeObjectURL(photoUrl); photoUrl = URL.createObjectURL(f); });
picker("logo", (f, b) => { logo = b; logoFile = f; URL.revokeObjectURL(logoUrl); logoUrl = URL.createObjectURL(f); });
function refresh() {
  listOf($("photoList"), photo && photoFile, photoUrl, () => { photo = null; photoFile = null; refresh(); });
  listOf($("logoList"), logo && logoFile, logoUrl, () => { logo = null; logoFile = null; refresh(); });
  $("plateBox").hidden = !logo; $("step2").classList.toggle("done", !!(photo || logo));
  draw();
}
for (const id of ["quote", "name", "role", "format", "plate"]) $(id).addEventListener("input", draw);
for (const r of document.querySelectorAll('input[name="style"]')) r.addEventListener("change", draw);

$("go").addEventListener("click", () => {
  cv.toBlob(b => {
    if (!b) { setStatus("Something went wrong while creating the image.", "error"); return; }
    const slug = val("name").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase() || "quote";
    const fileName = "quote_" + slug + "_" + $("format").value + ".png", url = URL.createObjectURL(b), a = Object.assign(document.createElement("a"), { href: url, download: fileName });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
    setStatus("Done: " + fileName + " downloaded.", "ok");
  }, "image/png");
});
refresh();
