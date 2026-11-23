"use strict";
const $ = id => document.getElementById(id);

/* Ligature letters that PDFs often keep as one character (ﬁ, ﬂ...) */
const LIGATURES = { "\uFB00": "ff", "\uFB01": "fi", "\uFB02": "fl", "\uFB03": "ffi", "\uFB04": "ffl", "\uFB05": "st", "\uFB06": "st" };
/* A line that starts like this is a list item: it always starts a new paragraph. */
const BULLET = /^(?:[•▪◦●■►‣]\s*|[-–—]\s+)/;
/* A line that ends like this can be the last line of a paragraph. */
const SENTENCE_END = /[.!?…:”"»)\]]$/;

/* Turns the text copied from a PDF into clean paragraphs. */
function cleanText(raw, opt) {
  const st = { ligatures: 0, hyphens: 0, glued: 0, paragraphs: 0 };
  const text = raw.replace(/\r\n?/g, "\n").replace(/\f/g, "\n\n").replace(/\u00AD/g, "")
    .replace(/[\uFB00-\uFB06]/g, c => { st.ligatures++; return LIGATURES[c]; });
  const lines = text.split("\n").map(l => l.replace(/[\s\u00A0]+/g, " ").trim());
  const blocks = []; let block = [];
  for (const l of lines) { if (l) block.push(l); else if (block.length) { blocks.push(block); block = []; } }
  if (block.length) blocks.push(block);

  const paras = [];
  for (const b of blocks) {
    const max = Math.max(...b.map(l => l.length));
    let cur = "";
    const flush = () => { if (cur) paras.push(cur); cur = ""; };
    b.forEach((l, i) => {
      if (cur && (BULLET.test(l) || (opt.short && SENTENCE_END.test(b[i - 1]) && b[i - 1].length < 0.7 * max))) flush();
      if (!cur) { cur = l; return; }
      if (opt.hyphen && /\p{L}-$/u.test(cur) && /^\p{Ll}/u.test(l)) { cur = cur.slice(0, -1) + l; st.hyphens++; }
      else cur += " " + l;
      st.glued++;
    });
    flush();
  }
  st.paragraphs = paras.length;
  return { text: paras.join("\n\n"), st };
}

function setStatus(t, k) { $("status").textContent = t; $("status").className = k || ""; }
function run() {
  const raw = $("inputText").value, has = !!raw.trim();
  $("step1").classList.toggle("done", has);
  $("copy").disabled = !has; $("copied").textContent = "";
  if (!has) { $("outputText").value = ""; $("report").replaceChildren(); setStatus(""); $("step3").classList.remove("ready"); return; }
  const { text, st } = cleanText(raw, { hyphen: $("oHyphen").checked, short: $("oShort").checked });
  $("outputText").value = text;
  const items = [
    st.glued + (st.glued === 1 ? " line was joined to the one before it." : " lines were joined to the one before them."),
    st.paragraphs + (st.paragraphs === 1 ? " paragraph in the result." : " paragraphs in the result.")
  ];
  if (st.hyphens) items.push(st.hyphens + (st.hyphens === 1 ? " word split with a hyphen was repaired." : " words split with a hyphen were repaired."));
  if (st.ligatures) items.push(st.ligatures + (st.ligatures === 1 ? " joined letter (such as ﬁ) was turned back into normal letters." : " joined letters (such as ﬁ) were turned back into normal letters."));
  $("report").replaceChildren(...items.map(t => Object.assign(document.createElement("li"), { textContent: t })));
  setStatus("Done: the text is cleaned. Read it once before you copy it.", "ok");
  $("step2").classList.add("done"); $("step3").classList.add("ready");
}
$("inputText").addEventListener("input", run);
$("oHyphen").addEventListener("change", run);
$("oShort").addEventListener("change", run);
$("example").addEventListener("click", () => {
  $("inputText").value = "FEPS, in cooperation with Friedrich-Ebert-Stiftung Warsaw and the Amicus Europae Foundation, relaunched its Ones to Watch (O2W) programme with a meeting in Warsaw\nduring 19-21 November 2026. Bringing together promising young progressive politicians\nand representatives from across Central and Eastern Europe, the initiative provided a\nspace for political exchange and for the build-\ning of lasting networks.\n\nThe next meeting will take place in the spring.";
  run(); $("inputText").focus();
});
$("copy").addEventListener("click", async () => {
  const out = $("outputText");
  try { await navigator.clipboard.writeText(out.value); }
  catch (e) { out.select(); document.execCommand("copy"); }
  $("copied").textContent = "Copied.";
});
run();
