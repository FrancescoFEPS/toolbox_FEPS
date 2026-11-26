"use strict";
const $ = id => document.getElementById(id);
const els = { logos: $("logos"), logoList: $("logoList") };
const NOFOLDERS = { createFolders: false };
const MAX_EXTRA = 5, BLANK_ROWS = 12, SMALL = 0.65;   // extra logos are 65% of the height of the FEPS logo
/* Escapes text for XML and removes invisible control characters (Word would say the file needs repair). */
const esc = s => String(s || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
let extras = [], people = [], templateBuf = null, warnings = [];

function setStatus(t, k) {
  $("status").textContent = t || "";
  $("status").className = k || "";
}

function refreshButton() {
  $("go").disabled = !(templateBuf && people.length);
  $("step1").classList.toggle("done", people.length > 0);
  $("step2").classList.toggle("done", ["evName", "evDate", "evPlace"].every(i => $(i).value.trim()));
  $("step3").classList.toggle("done", extras.length > 0 || ($("noLogo") && $("noLogo").checked));
  $("step4").classList.toggle("ready", !$("go").disabled);
}

/* ---------- The list of people (file + pasted), sorted by last name, with a Remove button ---------- */
const cmp = (a, b) => a.localeCompare(b, "en", { sensitivity: "base" });
const personKey = p => (p.first + " " + p.last).replace(/\s+/g, " ").trim().toLowerCase();

function render() {
  people.sort((a, b) => cmp(a.last || a.first, b.last || b.first) || cmp(a.first, b.first));
  const seen = new Map();
  for (const p of people) seen.set(personKey(p), (seen.get(personKey(p)) || 0) + 1);
  let dups = 0;

  $("list").replaceChildren(...people.map(p => {
    const li = document.createElement("li");
    const fullName = (p.first + " " + p.last).trim();
    const twice = seen.get(personKey(p)) > 1;
    const btn = Object.assign(document.createElement("button"), {
      type: "button",
      className: "linkbtn",
      textContent: "Remove"
    });
    btn.style.cssText = "float:right;margin:0";
    btn.setAttribute("aria-label", "Remove " + fullName);
    btn.addEventListener("click", () => {
      people = people.filter(x => x !== p);
      render();
    });
    if (twice) dups++;
    li.append(
      btn,
      document.createTextNode(
        fullName +
        (p.org ? " (" + p.org + ")" : "") +
        (twice ? " – listed more than once?" : "")
      )
    );
    return li;
  }));

  $("count").textContent = people.length
    ? people.length + (people.length === 1 ? " person" : " people") + (dups ? ", " + dups + " listed more than once" : "")
    : "";
  refreshButton();
}

async function loadFile(file) {
  if (!file) return;
  setStatus("");
  try {
    const rows = /\.xlsx$/i.test(file.name)
      ? await readXlsx(await file.arrayBuffer())
      : readCsv(await file.text());

    if (!Array.isArray(rows) || !rows.length) {
      throw new Error("The file appears to be empty.");
    }

    const { people: found, event } = readPeople(rows);
    people = people.filter(p => p.src !== "file").concat(found.map(p => Object.assign({}, p, { src: "file" })));
    if (event && !$("evName").value.trim()) $("evName").value = event;
    $("fileMain").textContent = file.name;
    $("fileSub").textContent = "Click to change.";
    $("drop").classList.add("loaded");

    if (!found.length) {
      setStatus("No one found in this file.", "error");
    } else {
      setStatus(found.length + (found.length === 1 ? " person loaded from file." : " people loaded from file."), "ok");
    }
  } catch (e) {
    $("drop").classList.remove("loaded");
    const msg = e && e.message ? e.message : "";
    setStatus(
      /Couldn't find|empty/i.test(msg)
        ? msg
        : "That file couldn't be read. Please choose a valid .xlsx or .csv file.",
      "error"
    );
  }
  render();
}

$("file").addEventListener("change", () => {
  if ($("file").files && $("file").files[0]) loadFile($("file").files[0]);
  $("file").value = "";
});
for (const ev of ["dragenter", "dragover"]) {
  $("drop").addEventListener(ev, e => {
    e.preventDefault();
    $("drop").classList.add("over");
  });
}
for (const ev of ["dragleave", "drop"]) {
  $("drop").addEventListener(ev, e => {
    e.preventDefault();
    $("drop").classList.remove("over");
  });
}
$("drop").addEventListener("drop", e => {
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) {
    loadFile(e.dataTransfer.files[0]);
  }
});
for (const i of ["evName", "evDate", "evPlace"]) {
  if ($(i)) $(i).addEventListener("input", refreshButton);
}
if ($("noLogo")) {
  $("noLogo").addEventListener("change", () => {
    if ($("logoBox")) $("logoBox").hidden = $("noLogo").checked;
    if ($("noLogoNote")) {
      $("noLogoNote").textContent = $("noLogo").checked
        ? "All logos (including FEPS) will be removed from the header."
        : "";
    }
    refreshButton();
  });
}

/* Pasted people: "Firstname Lastname, Organisation" per line, or cells copied from Excel (Name, Last name, Organisation). */
function parseManual(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map(l => l.replace(/^\uFEFF/, "").replace(/^\s*(?:[*\-•–·]+|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .map(l => {
      const tab = l.includes("\t");
      const c = (tab ? l.split("\t") : l.split(/\s*[,;]\s*/)).map(clean);
      if (tab && c.length >= 3) {
        return { first: c[0], last: c[1], org: c.slice(2).filter(Boolean).join(", "), event: "" };
      }
      const split = typeof splitName === "function"
        ? splitName(c[0])
        : { first: c[0] || "", last: "" };
      return Object.assign(split, { org: c.slice(1).filter(Boolean).join(", "), event: "" });
    })
    .filter(p => p.first || p.last);
}

$("manualAdd").addEventListener("click", () => {
  const add = parseManual($("manualText").value);
  if (!add.length) {
    setStatus("Type or paste at least one name first.", "error");
    return;
  }
  setStatus("");
  people = people.concat(add.map(p => Object.assign({}, p, { src: "manual" })));
  $("manualText").value = "";
  render();
  setStatus(add.length + (add.length === 1 ? " person added to the list." : " people added to the list."), "ok");
});

/* ---------- Logos ---------- */
function renderLogos() {
  els.logoList.replaceChildren(...extras.map((e, i) => {
    const li = document.createElement("li");
    const img = Object.assign(document.createElement("img"), { src: e.url, alt: "" });
    const name = Object.assign(document.createElement("span"), { textContent: e.file.name });
    const btn = Object.assign(document.createElement("button"), {
      type: "button",
      className: "linkbtn",
      textContent: "Remove"
    });
    btn.setAttribute("aria-label", "Remove " + e.file.name);
    btn.addEventListener("click", () => {
      URL.revokeObjectURL(e.url);
      extras.splice(i, 1);
      renderLogos();
    });
    li.append(img, name, btn);
    return li;
  }));
  refreshButton();
}

els.logos.addEventListener("change", async () => {
  setStatus("");
  for (const file of els.logos.files) {
    if (extras.length >= MAX_EXTRA) {
      setStatus("You can add up to " + MAX_EXTRA + " extra logos.", "error");
      break;
    }
    const ext = /\.png$/i.test(file.name) || file.type === "image/png"
      ? "png"
      : /\.jpe?g$/i.test(file.name) || file.type === "image/jpeg"
        ? "jpeg"
        : null;
    if (!ext) {
      setStatus(file.name + " is not a PNG or JPG image.", "error");
      continue;
    }
    try {
      const bmp = await createImageBitmap(file);
      extras.push({
        file,
        ext,
        w: bmp.width,
        h: bmp.height,
        bytes: await file.arrayBuffer(),
        url: URL.createObjectURL(file)
      });
    } catch (e) {
      setStatus("Couldn't read " + file.name + ".", "error");
    }
  }
  els.logos.value = "";
  renderLogos();
});

/* ---------- Building the Word document ---------- */
const strip = x => x.replace(/ w14:(?:paraId|textId)="[^"]*"/g, "").replace('w:hRule="exact"', 'w:hRule="atLeast"');
const PB = '<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="20" w:lineRule="exact"/><w:rPr><w:sz w:val="2"/></w:rPr></w:pPr><w:r><w:rPr><w:sz w:val="2"/></w:rPr><w:br w:type="page"/></w:r></w:p>';
/* "organizers" -> "organisers" (also when Word has split the word over several pieces) */
const britishise = x => x.replace(/(organi)((?:<[^>]*>)*)z(ers)/gi, "$1$2s$3");

/* Adds bold to a run-properties block (kept in the order Word expects) */
function bold(rpr) {
  rpr = rpr.replace(/<w:b w:val="(?:0|false)"\/>/, "");
  if (/<w:b\/>/.test(rpr)) return rpr;
  if (!rpr) return "<w:rPr><w:b/></w:rPr>";
  if (/<w:rFonts\b[^>]*\/>/.test(rpr)) return rpr.replace(/(<w:rFonts\b[^>]*\/>)/, "$1<w:b/>");
  if (/<w:rStyle\b[^>]*\/>/.test(rpr)) return rpr.replace(/(<w:rStyle\b[^>]*\/>)/, "$1<w:b/>");
  return rpr.replace("<w:rPr>", "<w:rPr><w:b/>");
}

function findPart(zip, candidates, pattern) {
  for (const p of candidates) {
    if (zip.file(p)) return p;
  }
  if (pattern) {
    const match = Object.keys(zip.files).find(k => pattern.test(k));
    if (match) return match;
  }
  return null;
}

async function buildDoc() {
  warnings = [];
  if (!templateBuf) {
    throw new Error("The Word template is not loaded yet.");
  }

  const zip = await JSZip.loadAsync(templateBuf);
  const readOptional = async p => {
    if (!p || !zip.file(p)) return null;
    return zip.file(p).async("string");
  };
  const requirePart = async (p, label) => {
    const content = await readOptional(p);
    if (content === null) {
      throw new Error("Missing part in Word template: " + label + ".");
    }
    return content;
  };

  const docPath = findPart(zip, ["word/document.xml"], /^word\/document\.xml$/i);
  let doc = britishise(await requirePart(docPath, "word/document.xml"));
  const tblMatch = /<w:tbl>[\s\S]*?<\/w:tbl>/.exec(doc);
  if (!tblMatch) {
    throw new Error("Could not find the registration table in the Word template.");
  }
  const tbl = tblMatch[0];
  const rows = tbl.match(/<w:tr\b[\s\S]*?<\/w:tr>/g);
  if (!rows || rows.length < 2) {
    throw new Error("The registration table in the Word template must have a header row and a template row.");
  }
  let open = tbl.slice(0, tbl.indexOf(rows[0]));

  // Wider signature column (the last one): it grows to 160% of its width, at most 45% of the table; the others shrink.
  const grid = [...open.matchAll(/<w:gridCol w:w="(\d+)"/g)].map(m => +m[1]);
  let newW = null;
  if (grid.length >= 3 && (rows[0].match(/<w:tcW w:w="\d+"/g) || []).length === grid.length) {
    const tot = grid.reduce((a, b) => a + b, 0);
    const lastW = grid[grid.length - 1];
    const sig = Math.min(Math.round(tot * 0.45), Math.round(lastW * 1.6));
    const k = (tot - sig) / (tot - lastW);
    if (sig > lastW) newW = grid.map((w, i) => i === grid.length - 1 ? sig : Math.round(w * k));
  }
  const reW = x => {
    if (!newW) return x;
    let i = 0;
    return x.replace(/<w:tcW w:w="\d+"/g, m => i < newW.length ? '<w:tcW w:w="' + newW[i++] + '"' : m);
  };
  if (newW) {
    let j = 0;
    open = open.replace(/<w:gridCol w:w="\d+"/g, m => '<w:gridCol w:w="' + newW[j++] + '"');
  }
  const head = reW(strip(rows[0])), blank = reW(strip(rows[1]));

  // First name and last name in bold
  const fill = vals => {
    let i = 0;
    return blank.replace(/<w:p\b[\s\S]*?<\/w:p>/g, p => {
      const idx = i++, v = vals[idx];
      if (!v) return p;
      let rpr = (/<w:pPr>[\s\S]*?(<w:rPr>[\s\S]*?<\/w:rPr>)[\s\S]*?<\/w:pPr>/.exec(p) || [, ""])[1];
      if (idx < 2) rpr = bold(rpr);
      return p.replace("</w:p>", () => '<w:r>' + rpr + '<w:t xml:space="preserve">' + esc(v) + "</w:t></w:r></w:p>");
    });
  };
  const blankTbl = open + head + blank.repeat(BLANK_ROWS) + "</w:tbl>";
  const table = open + head + people.map(p => fill([p.first, p.last, p.org])).join("") + "</w:tbl>" + PB + blankTbl + PB + blankTbl;
  zip.file(docPath, doc.replace(tbl, () => table), NOFOLDERS);

  // Header: event name, date, location (+ extra logos next to the FEPS logo)
  const hdPath = findPart(zip, ["word/header2.xml", "word/header1.xml"], /^word\/header\d+\.xml$/i);
  let hd = await readOptional(hdPath);
  if (hd !== null) {
    hd = britishise(hd);
    const put = (from, to, label) => {
      if (!hd.includes(from)) {
        warnings.push(label);
        return;
      }
      hd = hd.replace(from, () => to);
    };
    put("[EVENT NAME]", esc($("evName").value.trim()), "[EVENT NAME]");
    put("[DATE]", esc($("evDate").value.trim()), "[DATE]");
    put("<w:t>[</w:t>", "<w:t></w:t>", "[LOCATION]");
    put("<w:t>LOCATION</w:t>", "<w:t>" + esc($("evPlace").value.trim()) + "</w:t>", "[LOCATION]");
    put("<w:t>]</w:t>", "<w:t></w:t>", "[LOCATION]");

    if ($("noLogo") && $("noLogo").checked) {
      hd = hd.replace(/<w:drawing>[\s\S]*?<\/w:drawing>/g, "");
    }

    const hdFileName = hdPath.split("/").pop();
    const relsPath = "word/_rels/" + hdFileName + ".rels";
    let rels = await readOptional(relsPath);
    let types = await readOptional("[Content_Types].xml");

    if (extras.length) {
      const drawMatch = /<w:drawing>[\s\S]*?<\/w:drawing>/.exec(hd);
      if (!drawMatch || !rels || !types) {
        warnings.push("extra logos in the header");
      } else {
        const base = drawMatch[0];
        const H0 = 544195, HS = H0 * SMALL, X0 = 1996440 + 250000, gap = 150000, avail = 9072 * 635 - X0;
        const widths = extras.map(e => HS * e.w / e.h);
        const k = Math.min(1, avail / (widths.reduce((a, b) => a + b, 0) + gap * (extras.length - 1)));
        let x = X0, runs = "", relXml = "";

        extras.forEach((e, i) => {
          const w = Math.round(widths[i] * k), h = Math.round(HS * k), y = -102447 + Math.round((H0 - h) / 2);
          const rid = "rIdLogo" + (i + 1), file = "logo_extra_" + (i + 1) + "." + e.ext, nm = "Logo " + (i + 2);
          zip.file("word/media/" + file, e.bytes, NOFOLDERS);
          relXml += '<Relationship Id="' + rid + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/' + file + '"/>';
          const d = base
            .replace("<wp:posOffset>0</wp:posOffset>", "<wp:posOffset>" + x + "</wp:posOffset>")
            .replace("<wp:posOffset>-102447</wp:posOffset>", "<wp:posOffset>" + y + "</wp:posOffset>")
            .replace(/<wp:extent cx="\d+" cy="\d+"\/>/, '<wp:extent cx="' + w + '" cy="' + h + '"/>')
            .replace(/<a:ext cx="\d+" cy="\d+"\/>/, '<a:ext cx="' + w + '" cy="' + h + '"/>')
            .replace('r:embed="rId1"', 'r:embed="' + rid + '"')
            .replace(/ wp14:(?:anchorId|editId)="[^"]*"/g, "")
            .replace(/<wp:docPr [^>]*\/>/, '<wp:docPr id="' + (9000 + i) + '" name="' + nm + '"/>')
            .replace(/<pic:cNvPr [^>]*\/>/, '<pic:cNvPr id="' + (9000 + i) + '" name="' + nm + '"/>');
          runs += '<w:r><w:rPr><w:noProof/></w:rPr>' + d + "</w:r>";
          x += w + gap;
        });

        put("</w:drawing></w:r>", "</w:drawing></w:r>" + runs, "the logo in the header");
        zip.file(relsPath, rels.replace("</Relationships>", relXml + "</Relationships>"), NOFOLDERS);
        for (const ext of new Set(extras.map(e => e.ext))) {
          if (!new RegExp('Extension="' + ext + '"', "i").test(types)) {
            types = types.replace(/(<Types\b[^>]*>)/, '$1<Default Extension="' + ext + '" ContentType="image/' + ext + '"/>');
          }
        }
        zip.file("[Content_Types].xml", types, NOFOLDERS);
      }
    }

    zip.file(hdPath, hd, NOFOLDERS);
  } else {
    warnings.push("the header in the Word template");
  }

  // Footer: the total number of pages was typed in by hand ("/4"): make it automatic
  const ftPath = findPart(zip, ["word/footer2.xml", "word/footer1.xml"], /^word\/footer\d+\.xml$/i);
  let ft = await readOptional(ftPath);
  if (ft !== null) {
    ft = britishise(ft);
    const R = '<w:r><w:rPr><w:rStyle w:val="PageNumber"/></w:rPr>';
    const ft0 = ft;
    ft = ft.replace(
      /<w:r\b[^>]*><w:rPr><w:rStyle w:val="PageNumber"\/><\/w:rPr><w:t>\d+<\/w:t><\/w:r>/,
      () => R + '<w:fldChar w:fldCharType="begin"/></w:r>' +
        R + '<w:instrText xml:space="preserve">NUMPAGES  </w:instrText></w:r>' +
        R + '<w:fldChar w:fldCharType="separate"/></w:r>' +
        R + "<w:t>4</w:t></w:r>" +
        R + '<w:fldChar w:fldCharType="end"/></w:r>'
    );
    if (ft === ft0) warnings.push("the total number of pages in the footer");
    zip.file(ftPath, ft, NOFOLDERS);
  } else {
    warnings.push("the footer in the Word template");
  }

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE"
  });
}

$("go").addEventListener("click", async () => {
  $("go").disabled = true;
  setStatus("Creating the document…");
  try {
    const blob = await buildDoc();
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: "Registration_List.docx" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);

    const done = "Done: Registration_List.docx downloaded (" + people.length + (people.length === 1 ? " person)." : " people).");
    if (warnings.length) {
      setStatus(
        done + " Warning: " + [...new Set(warnings)].join(", ") + " could not be found in the Word template, so check these parts in the document.",
        "error"
      );
    } else {
      setStatus(done, "ok");
    }
    $("after").hidden = false;
  } catch (e) {
    setStatus("Something went wrong: " + (e && e.message ? e.message : "Unknown error."), "error");
  }
  refreshButton();
});

fetch("Registration_template.docx")
  .then(r => {
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r.arrayBuffer();
  })
  .then(b => {
    templateBuf = b;
    $("note").textContent = "Word template loaded.";
    refreshButton();
  })
  .catch(() => {
    $("note").textContent = "The Word template could not be loaded. Please open this page from the website, not from a downloaded file.";
  });

render();
