"use strict";
const $ = id => document.getElementById(id);
/* The same four replacements as the original tool, applied in the same order. */
const RULES = [
  [/<body id="conteneur" style="width:100%;background-color:#f6f1f1;/g, '<div id="conteneur" style="width:100%;background-color:transparent;', "The <body> became a <div> with a transparent background"],
  [/<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f1f1;">/g, '<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;">', "The table background became white"],
  [/<\/body>\s*<\/html>/g, '</div>\n</html>', "The closing </body></html> became </div></html>"],
  [/<\/title>\s*<style type="text\/css">/g, '</title>\n   <style type="text/css">\n.singlePostContent{background-color:#f6f1f1};', "The .singlePostContent style line was added"]
];
$("inputCode").addEventListener("input", () => {
  const has = !!$("inputCode").value.trim();
  $("go").disabled = !has; $("step1").classList.toggle("done", has);
});
$("go").addEventListener("click", () => {
  let code = $("inputCode").value, applied = 0;
  const items = RULES.map(([re, to, label]) => {
    const hit = code.search(re) >= 0;
    if (hit) { code = code.replace(re, to); applied++; }
    return { hit, label };
  });
  $("outputCode").value = code;
  $("report").replaceChildren(...items.map(i => Object.assign(document.createElement("li"), { textContent: (i.hit ? "✓ " : "– Not found: ") + i.label, className: i.hit ? "" : "miss" })));
  const ok = applied > 0;
  $("status").textContent = ok ? "Done: " + applied + " of 4 changes applied." : "Nothing was changed. Please check that you pasted the raw HTML code of a Sarbacane newsletter.";
  $("status").className = ok ? "ok" : "error";
  $("step2").classList.toggle("done", ok); $("copy").disabled = !ok; $("copied").textContent = "";
});
$("copy").addEventListener("click", async () => {
  const out = $("outputCode");
  try { await navigator.clipboard.writeText(out.value); }
  catch (e) { out.select(); document.execCommand("copy"); }
  $("copied").textContent = "Copied.";
});
