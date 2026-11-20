"use strict";
const $ = id => document.getElementById(id);
const EMOJI = "\u{1F517}";   // 🔗
const attr = s => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const html = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function normalise(u) {
  u = u.trim();
  return u && !/^[a-z][a-z0-9+.-]*:/i.test(u) ? "https://" + u : u;
}
function refresh() {
  const url = normalise($("link").value), text = $("text").value.trim().replace(/\s+/g, " ");
  const ok = !!url && !!text;
  $("step1").classList.toggle("done", ok); $("step2").classList.toggle("ready", ok);
  $("copy").disabled = !ok; $("copied").textContent = "";
  $("empty").hidden = ok; $("result").hidden = !ok;
  $("out").value = ok ? EMOJI + ' <a href="' + attr(url) + '" rel="noreferrer nofollow">' + html(text) + "</a>" : "";
  if (!ok) return;
  const a = Object.assign(document.createElement("a"), { href: url, target: "_blank", rel: "noopener", textContent: text });
  $("result").replaceChildren(document.createTextNode(EMOJI + " "), a);
}
$("copy").addEventListener("click", async () => {
  const out = $("out");
  try { await navigator.clipboard.writeText(out.value); }
  catch (e) { out.select(); document.execCommand("copy"); }
  $("copied").textContent = "Copied.";
  $("step2").classList.add("done");
});
$("link").addEventListener("input", refresh);
$("text").addEventListener("input", refresh);
refresh();
