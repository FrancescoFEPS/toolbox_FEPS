/* Shared helpers to read a table from an .xlsx or .csv file (needs JSZip loaded first). */
"use strict";
const norm = s => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
const clean = s => String(s || "").replace(/\s+/g, " ").trim();
const dec = s => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
async function readXlsx(buf) {
  const zip = await JSZip.loadAsync(buf);
  const txt = p => zip.file(p) ? zip.file(p).async("string") : Promise.resolve("");
  const wb = await txt("xl/workbook.xml"), rels = await txt("xl/_rels/workbook.xml.rels");
  const rid = /<sheet\b[^>]*r:id="([^"]+)"/.exec(wb)[1];
  const tag = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => t.includes('Id="' + rid + '"'));
  const target = /Target="([^"]+)"/.exec(tag)[1];
  const sheet = await txt(target.startsWith("/") ? target.slice(1) : "xl/" + target);
  const sst = [...(await txt("xl/sharedStrings.xml")).matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m => dec([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(t => t[1]).join("")));
  const rows = [];
  for (const r of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const row = [];
    for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = /r="([A-Z]+)\d+"/.exec(c[1]); if (!ref) continue;
      const col = ref[1].split("").reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
      const t = (/\bt="([^"]+)"/.exec(c[1]) || [])[1], body = c[2] || "";
      const v = (/<v>([\s\S]*?)<\/v>/.exec(body) || [])[1];
      row[col] = t === "s" ? sst[+v] : t === "inlineStr" ? dec([...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(m => m[1]).join("")) : v === undefined ? "" : dec(v);
    }
    rows.push(row);
  }
  return rows;
}
function readCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const first = text.split(/\r?\n/)[0];
  const d = [",", ";", "\t"].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"') q = true;
    else if (c === d) { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur || row.length) { row.push(cur); rows.push(row); }
  return rows;
}
const readTable = async file => /\.xlsx$/i.test(file.name) ? readXlsx(await file.arrayBuffer()) : readCsv(await file.text());
