"use strict";
const $ = id => document.getElementById(id);
const MAX_FRAMES = 300, MAX_PIXELS = 60e6;   // limits, so the browser does not run out of memory
const vid = $("vid");
let file = null, url = "", gifUrl = "", busy = false;

const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
const sec = n => Math.round(n * 10) / 10 + " s";
function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function setStatus2(t, k) { $("status2").textContent = t; $("status2").className = k || ""; }

/* What the settings give: size of the GIF and number of images */
function plan() {
  if (!vid.videoWidth) return null;
  const start = Math.max(0, parseFloat($("start").value) || 0), dur = vid.duration;
  let len = Math.min(15, parseFloat($("len").value) || 0);
  const w = Math.min(800, Math.max(100, parseInt($("w").value, 10) || 0)), fps = +$("fps").value;
  if (!(len > 0)) return { error: "Type how many seconds to keep (up to 15)." };
  if (start >= dur) return { error: "The start is after the end of the video (" + sec(dur) + ")." };
  len = Math.min(len, dur - start);
  const W = Math.min(w, vid.videoWidth), H = Math.max(1, Math.round(W * vid.videoHeight / vid.videoWidth));
  const n = Math.max(2, Math.min(MAX_FRAMES, Math.round(len * fps)));
  return { start, len, W, H, n, fps, small: w > vid.videoWidth };
}
function refresh() {
  const p = plan(), ready = !!p && !p.error && !busy;
  $("go").disabled = !ready;
  $("here").disabled = !vid.videoWidth;
  $("step1").classList.toggle("done", !!vid.videoWidth); $("step2").classList.toggle("done", !!p && !p.error); $("step3").classList.toggle("ready", ready);
  $("warn").hidden = true;
  if (!p) { $("estimate").textContent = ""; return; }
  if (p.error) { $("estimate").textContent = p.error; return; }
  $("estimate").textContent = "The GIF will be " + p.W + " × " + p.H + " px, " + sec(p.len) + " long, with " + p.n + " images.";
  const msgs = [];
  if (p.small) msgs.push("The video is only " + vid.videoWidth + " px wide, so the GIF is made at that width.");
  if (p.W * p.H * p.n > MAX_PIXELS) { msgs.push("This is too big for the browser. Make the GIF shorter, narrower or with fewer images per second."); $("go").disabled = true; }
  if (msgs.length) { $("warn").hidden = false; $("warn").textContent = msgs.join(" "); }
}
for (const id of ["start", "len", "w", "fps"]) $(id).addEventListener("input", refresh);
$("fps").addEventListener("change", refresh);
$("here").addEventListener("click", () => { $("start").value = Math.round(vid.currentTime * 10) / 10; refresh(); });

/* ---------- Loading the video ---------- */
async function loadVideo(f) {
  if (!f) return;
  setStatus(""); setStatus2("");
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(f);
  vid.hidden = true; $("empty").hidden = false;
  try {
    await new Promise((ok, no) => {
      const done = () => { vid.removeEventListener("error", bad); ok(); };
      const bad = () => { vid.removeEventListener("loadeddata", done); no(new Error("read")); };
      vid.addEventListener("loadeddata", done, { once: true }); vid.addEventListener("error", bad, { once: true });
      vid.src = url; vid.load();
    });
    if (!vid.videoWidth || !isFinite(vid.duration)) throw new Error("read");
    file = f;
    $("fileMain").textContent = f.name; $("fileSub").textContent = "Click to change."; $("drop").classList.add("loaded");
    $("srcInfo").textContent = "Video: " + vid.videoWidth + " × " + vid.videoHeight + " px, " + sec(vid.duration) + ", " + kb(f.size) + ".";
    $("start").value = 0; $("len").value = Math.min(3, Math.round(vid.duration * 10) / 10) || 3;
    $("empty").hidden = true; vid.hidden = false;
  } catch (e) {
    file = null; vid.removeAttribute("src"); vid.load();
    $("drop").classList.remove("loaded"); $("fileMain").textContent = "Choose a video"; $("fileSub").textContent = "or drop it here"; $("srcInfo").textContent = "";
    setStatus("That video couldn't be read by your browser. MP4 and WebM work almost everywhere; for an iPhone video, try Safari or convert it to MP4 first.", "error");
  }
  refresh();
}
$("file").addEventListener("change", () => loadVideo($("file").files[0]));
for (const ev of ["dragenter", "dragover"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.add("over"); });
for (const ev of ["dragleave", "drop"]) $("drop").addEventListener(ev, e => { e.preventDefault(); $("drop").classList.remove("over"); });
$("drop").addEventListener("drop", e => loadVideo(e.dataTransfer.files[0]));

/* ---------- Taking the images, then building the GIF ---------- */
function seek(t) {
  return new Promise((ok, no) => {
    if (Math.abs(vid.currentTime - t) < 0.001 && vid.readyState >= 2) { ok(); return; }
    const timer = setTimeout(() => { vid.removeEventListener("seeked", h); no(new Error("The video took too long to move to the next image.")); }, 8000);
    const h = () => { clearTimeout(timer); ok(); };
    vid.addEventListener("seeked", h, { once: true });
    vid.currentTime = t;
  });
}
const pause = () => new Promise(r => setTimeout(r, 0));

$("go").addEventListener("click", async () => {
  const p = plan(); if (!p || p.error) return;
  busy = true; refresh(); vid.pause();
  $("bar").hidden = false; $("bar").value = 0; $("resultBox").hidden = true;
  const cv = Object.assign(document.createElement("canvas"), { width: p.W, height: p.H }), cx = cv.getContext("2d", { willReadFrequently: true });
  const frames = [], back = vid.currentTime, last = Math.max(0, vid.duration - 0.05);
  try {
    for (let i = 0; i < p.n; i++) {
      setStatus2("Taking image " + (i + 1) + " of " + p.n + "…");
      await seek(Math.min(last, p.start + i * (p.len / p.n)));
      cx.drawImage(vid, 0, 0, p.W, p.H);
      frames.push(cx.getImageData(0, 0, p.W, p.H).data);
      $("bar").value = Math.round((i + 1) / p.n * 70);
    }
    setStatus2("Building the GIF… this can take a few seconds."); $("bar").value = 80; await pause(); await pause();
    const bytes = GIF.encode(frames, p.W, p.H, { delayCs: 100 / p.fps, loop: $("loop").checked, dither: $("dither").checked });
    $("bar").value = 100;
    const blob = new Blob([bytes], { type: "image/gif" });
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    gifUrl = URL.createObjectURL(blob);
    $("out").src = gifUrl; $("resultBox").hidden = false;
    $("stats").textContent = "Result: " + p.W + " × " + p.H + " px, " + p.n + " images, " + kb(blob.size) + ".";
    const name = file.name.replace(/\.[^.]+$/, "") + "_" + p.W + "px.gif";
    const a = Object.assign(document.createElement("a"), { href: gifUrl, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setStatus2("Done: " + name + " downloaded (" + kb(blob.size) + ").", "ok");
  } catch (e) {
    setStatus2("Something went wrong: " + e.message, "error");
  }
  try { vid.currentTime = back; } catch (e) {}
  $("bar").hidden = true; busy = false; refresh();
});
refresh();
