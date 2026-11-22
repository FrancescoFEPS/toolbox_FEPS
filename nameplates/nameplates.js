"use strict";

/* ---------- Names ---------- */
function cleanName(line) {
  line = line.replace(/^\uFEFF/, "").trim();
  line = line.replace(/^\s*(?:[*\-•–·]+|\d+[.)])\s*/, "");      // leading bullet or number
  line = line.split(/[,;\t]|\s[-–—]\s/)[0];                      // drop title / organisation
  return line.trim();
}
function parseNames(text) {
  return text.split(/\r?\n/).map(cleanName).filter(Boolean);
}

/* ---------- PPTX helpers ---------- */
/* Escapes text for XML and removes invisible control characters (PowerPoint would say the file needs repair). */
const escapeXml = s => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const relsPathOf = p => p.replace(/([^/]+)$/, "_rels/$1.rels");
const dirOf = p => p.slice(0, p.lastIndexOf("/"));

function attr(tag, name) {
  const m = new RegExp("\\b" + name + '="([^"]*)"').exec(tag);
  return m ? m[1] : null;
}
function parseRels(xml) {
  return [...xml.matchAll(/<Relationship\b[^>]*>/g)].map(m => ({
    raw: m[0], id: attr(m[0], "Id"), type: attr(m[0], "Type") || "", target: attr(m[0], "Target") || ""
  }));
}
function resolvePath(baseDir, target) {
  if (target.startsWith("/")) return target.slice(1);
  const out = [];
  for (const part of (baseDir + "/" + target).split("/")) {
    if (part === "..") out.pop();
    else if (part && part !== ".") out.push(part);
  }
  return out.join("/");
}
function listSlides(presXml, presRelsXml) {
  const rels = parseRels(presRelsXml);
  return [...presXml.matchAll(/<p:sldId\b[^>]*>/g)].map(m => {
    const rid = attr(m[0], "r:id");
    const rel = rels.find(r => r.id === rid);
    if (!rel) throw new Error("This file has a broken slide list.");
    return { tag: m[0], numId: parseInt(attr(m[0], "id"), 10), rel, path: resolvePath("ppt", rel.target) };
  });
}

/* Put `name` in every text box (the template has it twice: upright and upside down). */
function setName(xml, name) {
  const esc = escapeXml(name);
  return xml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/g, body => {
    if (![...body.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].some(m => m[1].trim())) return body;
    let first = true;
    return body.replace(/<a:t(\s[^>]*)?>[\s\S]*?<\/a:t>/g, (_, attrs) => {
      const text = first ? esc : "";
      first = false;
      return "<a:t" + (attrs || "") + ">" + text + "</a:t>";
    });
  });
}

/* ---------- Logos ---------- */
const REL_IMAGE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";
const ROW_LIMIT = 5;   // more than 5 logos in total: they go on two rows

/* One row up to 5 logos, two rows above that. `off` = vertical shift of the logo's row, in EMU, for the upright copy
   (the upside-down copy gets the opposite shift). */
function layoutLogos(logos, W, H) {
  const n = logos.length, rows = n > ROW_LIMIT ? 2 : 1, perRow = Math.ceil(n / rows);
  const M = Math.round(W * 0.07), gap = Math.round(W * 0.02);
  const hMax = rows === 2 ? H * 0.085 : H * 0.107, spacing = H * 0.095;
  return logos.map((l, i) => {
    const row = Math.floor(i / perRow), inRow = Math.min(perRow, n - row * perRow), idx = i - row * perRow;
    const cw = (W - 2 * M) / inRow;
    const k = Math.min((cw - gap) / l.w, hMax / l.h);
    const cx = Math.round(l.w * k), cy = Math.round(l.h * k);
    return { cx, cy, x: Math.round(M + cw * idx + (cw - cx) / 2), off: rows === 2 ? Math.round((row - 0.5) * spacing) : 0 };
  });
}
function withGeom(p, x, y, cx, cy, rot, id, name) {
  p = p.replace(/<a:off x="-?\d+" y="-?\d+"\/><a:ext cx="\d+" cy="\d+"\/>/, '<a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/>');
  p = p.replace(/<a:xfrm[^>]*>/, rot ? '<a:xfrm rot="10800000">' : "<a:xfrm>");
  if (id !== null) {
    p = p.replace(/(<p:cNvPr\b[^>]*?)\bid="\d+"/, '$1id="' + id + '"').replace(/(<p:cNvPr\b[^>]*?)\bname="[^"]*"/, '$1name="' + name + '"');
    p = p.replace(/(<p:cNvPr\b[^>]*>)<a:extLst>[\s\S]*?<\/a:extLst>(<\/p:cNvPr>)/, "$1$2");
  }
  return p;
}
function newPic(id, name, rid, rot, x, y, cx, cy) {
  return '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="' + name + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="' + rid + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm' + (rot ? ' rot="10800000"' : "") + '><a:off x="' + x + '" y="' + y + '"/><a:ext cx="' + cx + '" cy="' + cy + '"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
}
/* Re-lays out all logos of the model slide (upright) and its upside-down copy, adding the extra logos. */
function addLogos(xml, rels, types, zip, extras, W, H) {
  const pics = [...xml.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map(m => m[0]);
  let nextId = Math.max(1, ...[...xml.matchAll(/<p:cNvPr\b[^>]*?\bid="(\d+)"/g)].map(m => +m[1])) + 1;
  const geom = p => { const m = /<a:off x="(-?\d+)" y="(-?\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(p); return m ? { x: +m[1], cx: +m[3], cy: +m[4] } : null; };
  const base = pics.filter(p => !/<a:xfrm[^>]*rot="10800000"/.test(p)).map(p => ({ xml: p, g: geom(p) })).filter(b => b.g).sort((a, b) => a.g.x - b.g.x);
  for (const p of pics) xml = xml.replace(p, "");
  const logos = base.map(b => ({ w: b.g.cx, h: b.g.cy })).concat(extras.map(e => ({ w: e.w, h: e.h })));
  const pos = layoutLogos(logos, W, H);
  const yU = Math.round(H * 0.635), yR = Math.round(H * 0.414);
  let relXml = "", out = "";
  logos.forEach((l, i) => {
    const { x, cx, cy, off } = pos[i], yu = yU + off - Math.round(cy / 2), yr = yR - off - Math.round(cy / 2), xr = W - x - cx;
    const label = "Logo " + (i + 1);
    if (i < base.length) {
      out += withGeom(base[i].xml, x, yu, cx, cy, false, null, "") + withGeom(base[i].xml, xr, yr, cx, cy, true, nextId++, label + " (rotated)");
    } else {
      const j = i - base.length + 1, e = extras[j - 1], rid = "rIdLogo" + j, file = "logo_extra_" + j + "." + e.ext;
      zip.file("ppt/media/" + file, e.bytes, NOFOLDERS);
      relXml += '<Relationship Id="' + rid + '" Type="' + REL_IMAGE + '" Target="../media/' + file + '"/>';
      out += newPic(nextId++, label, rid, false, x, yu, cx, cy) + newPic(nextId++, label + " (rotated)", rid, true, xr, yr, cx, cy);
    }
  });
  for (const ext of new Set(extras.map(e => e.ext))) {
    if (!new RegExp('Extension="' + ext + '"', "i").test(types))
      types = types.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="' + ext + '" ContentType="image/' + ext + '"/>');
  }
  return { xml: xml.replace("</p:spTree>", out + "</p:spTree>"), rels: rels.replace("</Relationships>", relXml + "</Relationships>"), types };
}

const NOFOLDERS = { createFolders: false };

async function buildDeck(buffer, names, extras = [], noLogo = false) {
  const zip = await JSZip.loadAsync(buffer);
  const read = async p => {
    const f = zip.file(p);
    if (!f) throw new Error("This doesn't look like a valid .pptx file (missing " + p + ").");
    return f.async("string");
  };
  const dropFile = p => zip.remove(p);

  let pres = await read("ppt/presentation.xml");
  let presRels = await read("ppt/_rels/presentation.xml.rels");
  let types = await read("[Content_Types].xml");
  const slides = listSlides(pres, presRels);
  if (!slides.length) throw new Error("The template has no slides.");

  const model = slides[0];
  let modelXml = await read(model.path);
  const modelRelsPath = relsPathOf(model.path);
  let modelRels = zip.file(modelRelsPath) ? await zip.file(modelRelsPath).async("string") : null;

  const removeOverride = path => {
    types = types.replace(new RegExp('<Override\\b[^>]*PartName="/' + escapeRegex(path) + '"[^>]*/>'), "");
  };

  if (noLogo) {
    modelXml = modelXml.replace(/<p:pic>[\s\S]*?<\/p:pic>/g, "");   // no logo at all, not even FEPS
  } else if (extras.length) {
    const W = parseInt(/<p:sldSz[^>]*\bcx="(\d+)"/.exec(pres)[1], 10), H = parseInt(/<p:sldSz[^>]*\bcy="(\d+)"/.exec(pres)[1], 10);
    ({ xml: modelXml, rels: modelRels, types } = addLogos(modelXml, modelRels, types, zip, extras, W, H));
    zip.file(modelRelsPath, modelRels, NOFOLDERS);
  }

  // 1. Remove every slide except the first one (and their notes pages)
  for (const s of slides.slice(1)) {
    const rp = relsPathOf(s.path);
    if (zip.file(rp)) {
      const rels = parseRels(await zip.file(rp).async("string"));
      for (const r of rels.filter(r => /\/notesSlide$/.test(r.type))) {
        const np = resolvePath(dirOf(s.path), r.target);
        dropFile(np); dropFile(relsPathOf(np)); removeOverride(np);
      }
    }
    dropFile(s.path); dropFile(rp); removeOverride(s.path);
    pres = pres.replace(s.tag, "");
    presRels = presRels.replace(s.rel.raw, "");
  }

  // 2. First name goes into the model slide itself
  zip.file(model.path, setName(modelXml, names[0]), NOFOLDERS);

  // 3. One new slide per additional name, copied from the model
  const nums = Object.keys(zip.files).map(f => /^ppt\/slides\/slide(\d+)\.xml$/.exec(f)).filter(Boolean).map(m => +m[1]);
  let nextSlide = Math.max(0, ...nums) + 1;
  let nextSldId = Math.max(255, model.numId) + 1;
  let nextRid = Math.max(0, ...[...presRels.matchAll(/Id="rId(\d+)"/g)].map(m => +m[1])) + 1;
  const copyRels = modelRels && modelRels.replace(/<Relationship\b[^>]*\/notesSlide"[^>]*\/>/g, "");

  let newIds = "", newRels = "", newTypes = "";
  for (const name of names.slice(1)) {
    const file = "ppt/slides/slide" + nextSlide + ".xml";
    zip.file(file, setName(modelXml, name), NOFOLDERS);
    if (copyRels) zip.file(relsPathOf(file), copyRels, NOFOLDERS);
    newTypes += '<Override PartName="/' + file + '" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>';
    newRels += '<Relationship Id="rId' + nextRid + '" Type="' + model.rel.type + '" Target="slides/slide' + nextSlide + '.xml"/>';
    newIds += '<p:sldId id="' + nextSldId + '" r:id="rId' + nextRid + '"/>';
    nextSlide++; nextSldId++; nextRid++;
  }
  pres = pres.replace("</p:sldIdLst>", newIds + "</p:sldIdLst>");
  presRels = presRels.replace("</Relationships>", newRels + "</Relationships>");
  types = types.replace("</Types>", newTypes + "</Types>");
  // A template with PowerPoint "sections" lists its slides by id: those ids no longer exist, so PowerPoint would ask to repair the file.
  pres = pres.replace(/<p:ext uri="\{521415D9-36F7-43E2-AB2F-B90AF26B5E84\}">[\s\S]*?<\/p:ext>/, "");

  zip.file("ppt/presentation.xml", pres, NOFOLDERS);
  zip.file("ppt/_rels/presentation.xml.rels", presRels, NOFOLDERS);
  zip.file("[Content_Types].xml", types, NOFOLDERS);

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    compression: "DEFLATE"
  });
}

/* ---------- Interface ---------- */
const $ = id => document.getElementById(id);
const els = {
  file: $("file"), drop: $("drop"), main: $("fileMain"), sub: $("fileSub"),
  names: $("names"), go: $("go"), status: $("status"),
  top: $("pvTop"), bottom: $("pvBottom"), list: $("list"), count: $("count")
};
els.logos = $("logos"); els.logoList = $("logoList"); els.note = $("designNote");
let extras = [];
const MAX_EXTRA = 10;
let templateBuffer = null;
let templateName = "";

function setStatus(text, kind) {
  els.status.textContent = text;
  els.status.className = kind || "";
}
function refreshButton() {
  const hasNames = parseNames(els.names.value).length > 0;
  els.go.disabled = !(templateBuffer && hasNames);
  $("step1").classList.toggle("done", extras.length > 0 || $("noLogo").checked);
  $("step2").classList.toggle("done", hasNames);
  $("step3").classList.toggle("ready", !!templateBuffer && hasNames);
}

function refreshNames() {
  const names = parseNames(els.names.value);
  els.list.replaceChildren(...names.map(n => Object.assign(document.createElement("li"), { textContent: n })));
  els.count.textContent = names.length ? names.length + (names.length === 1 ? " slide" : " slides") : "";
  const shown = names[0] || "Firstname SURNAME";
  for (const el of [els.top, els.bottom]) {
    el.textContent = shown;
    el.classList.toggle("placeholder", !names.length);
    el.style.setProperty("--fs", Math.min(7.5, 100 / Math.max(shown.length, 1)) + "cqw");
  }
  refreshButton();
}

async function loadTemplate(file, builtIn = false) {
  setStatus("");
  if (!file) return;
  try {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    if (!zip.file("ppt/presentation.xml")) throw new Error("not a presentation");
    const count = listSlides(await zip.file("ppt/presentation.xml").async("string"),
                             await zip.file("ppt/_rels/presentation.xml.rels").async("string")).length;
    if (!count) throw new Error("no slides");
    templateBuffer = buffer;
    templateName = file.name;
    els.drop.classList.add("loaded");
    els.main.textContent = file.name;
    els.sub.textContent = count > 1 ? count + " slides found: only the first one will be used. Click to change." : "Ready. Click to change.";
    els.note.textContent = builtIn ? "Nameplate design: built-in FEPS design." : "Nameplate design: " + file.name + " (your own file).";
  } catch (e) {
    templateBuffer = null;
    els.drop.classList.remove("loaded");
    els.main.textContent = "Choose a .pptx file";
    els.sub.textContent = "or drop it here";
    if (builtIn) els.note.textContent = "The built-in design could not be loaded. Open “Use a different nameplate design” below and choose your template file.";
    else setStatus("That file couldn't be read as a PowerPoint (.pptx). Please choose another one.", "error");
  }
  refreshButton();
}

els.file.addEventListener("change", () => loadTemplate(els.file.files[0]));
for (const ev of ["dragenter", "dragover"]) els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.add("over"); });
for (const ev of ["dragleave", "drop"]) els.drop.addEventListener(ev, e => { e.preventDefault(); els.drop.classList.remove("over"); });
els.drop.addEventListener("drop", e => loadTemplate(e.dataTransfer.files[0]));
els.names.addEventListener("input", refreshNames);

els.go.addEventListener("click", async () => {
  const names = parseNames(els.names.value), noLogo = $("noLogo").checked;
  els.go.disabled = true;
  setStatus("Creating " + names.length + (names.length === 1 ? " nameplate…" : " nameplates…"));
  try {
    const blob = await buildDeck(templateBuffer, names, extras, noLogo);
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "Nameplates_final.pptx" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    $("after").hidden = false;
    setStatus("Done: Nameplates_final.pptx downloaded (" + names.length + (names.length === 1 ? " slide)." : " slides)."), "ok");
  } catch (e) {
    setStatus("Something went wrong: " + e.message, "error");
  }
  refreshButton();
});

/* "No logo at all": the logos are removed from the nameplates, so adding logos is switched off. */
$("noLogo").addEventListener("change", () => {
  const off = $("noLogo").checked;
  els.logos.disabled = off;
  $("logoBox").style.opacity = off ? ".5" : "";
  $("noLogoNote").textContent = off ? "The nameplates will have no logo at all, not even FEPS." : "";
  refreshButton();
});

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

fetch("Nameplates_FEPS.pptx")
  .then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); })
  .then(b => loadTemplate(new File([b], "Nameplates_FEPS.pptx"), true))
  .catch(() => { els.note.textContent = "The built-in design could not be loaded. Open “Use a different nameplate design” below and choose your template file."; });

$("example").addEventListener("click", () => {
  els.names.value = "Andreas SCHIEDER\n* Ania Skrzypek, Director for Research and Training, FEPS\n- Anna Pacześniak, Wrocław University";
  refreshNames();
  els.names.focus();
});

/* Names from an Excel / CSV file: "Name" + "Last name", or one column holding the full name. */
$("namesFile").addEventListener("change", async () => {
  const file = $("namesFile").files[0], note = $("namesFileNote");
  if (!file) return;
  note.className = "hint";
  try {
    const { people } = readPeople(await readTable(file));
    const lines = people.map(p => (p.first + " " + p.last).trim()).filter(Boolean);
    if (!lines.length) { note.textContent = "No names found in this file."; note.className = "hint error"; return; }
    els.names.value = lines.join("\n");
    refreshNames();
    note.textContent = lines.length + (lines.length === 1 ? " name" : " names") + " loaded from " + file.name + ". You can still edit them below.";
  } catch (e) {
    note.textContent = /Couldn't find/.test(e.message) ? e.message : "That file couldn't be read. Please choose an .xlsx or .csv file."; note.className = "hint error";
  } finally { $("namesFile").value = ""; }
});

refreshNames();
