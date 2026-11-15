# toolbox_FEPS

Small online tools for the team. Everything runs in the browser: **nothing is uploaded anywhere**, there is no server and no build step.

## The tools

| Tool | Folder | What it does |
|---|---|---|
| Nameplates generator | `nameplates/` | Turns a list of names into a PowerPoint with one slide per name, ready to print as folded table nameplates. |
| Sarbacane code cleaner | `sarbacane/` | Applies 4 fixed replacements to the raw HTML of a Sarbacane newsletter. |
| Registration list | `registration/` | Turns the registrations exported from the website (Excel) into the printable signature list (Word). |
| Image resizer | `imageresizer/` | Crops, resizes and compresses an image for the website, the newsletter or social media. |
| QR code maker | `qrcode/` | Turns a link into a QR code, with an optional logo in the middle, as PNG or SVG. |

## Structure

```
index.html                 home page listing the tools (uses assets/style.css)
assets/
  style.css                shared look (all pages)
  jszip.min.js             JSZip 3.10.1, one shared copy
  table.js                 shared reader for .xlsx / .csv files (needs JSZip)
favicon/favicon.png
nameplates/    nameplates.html + nameplates.js      (+ Nameplates_FEPS.pptx)
registration/  registration.html + registration.js  (+ Registration_template.docx)
sarbacane/     sarbacane.html + sarbacane.js
imageresizer/  imageresizer.html + imageresizer.js
qrcode/        qrcode.html + qrcode.js  (+ logo_FEPS.png)
```

Rules of the structure:

- One folder per tool: a light HTML page and one JS file. No library is pasted inside a page.
- Script order on a page: `../assets/jszip.min.js`, then `../assets/table.js` (only if the tool reads Excel/CSV), then the tool's own JS.
- Shared look = `assets/style.css`. Only what is specific to one page goes in a small `<style>` in that page.
- No CDN and no external request: the tools work without internet once the page is loaded.
- `Nameplates_FEPS.pptx`, `Registration_template.docx` and `logo_FEPS.png` are loaded by the page with `fetch`, so they must stay in the same folder as their page.

## How each tool works

**Nameplates generator**
- The first slide of `Nameplates_FEPS.pptx` is the model: it is copied once per name and the other slides are removed. A user can choose their own .pptx instead (first slide used, same rules).
- The name replaces the text in every text box of the slide (upright and upside down), so no other text should be in a text box on that slide. Every picture on the slide is treated as a logo.
- Up to 5 extra logos (PNG or JPG) are added after the existing logos, in the order chosen, on both the upright and the upside-down copy.
- Names: typed or pasted one per line, or loaded from an Excel/CSV file (only the columns Name and Last name or Surname are used). Leading bullets or numbers are removed, and anything after a comma, semicolon, tab or " - " (title, organisation) is ignored. Capitals are kept as typed.

**Sarbacane code cleaner**
- Four replacements, always the same and in the same order: `<body>` becomes a `<div>` with a transparent background; the main table background goes from #f6f1f1 to white; the closing `</body></html>` becomes `</div></html>`; a `.singlePostContent` style line (background #f6f1f1) is added at the top of the styles.
- The page shows which of the 4 were applied and which were not found. Text and images are never touched.

**Registration list**
- Input: the Excel (.xlsx) or CSV exported from the website. First row = column titles, first sheet.
- Required columns: Name, Last name (or Surname), Organisation. Optional: STATUS and Event (the event name pre-fills the form).
- Who is kept: STATUS "Allow" or empty. If there is no STATUS column, everybody is kept. Any other status is left out and listed under "Who was left out?".
- Order: last name, then first name, A to Z, accents ignored.
- Output `Registration_List.docx`, built from `Registration_template.docx`: the people table, followed by 2 blank pages of 12 lines for guests who did not register online. The event name, date and location replace the placeholders `[EVENT NAME]`, `[DATE]` and `[LOCATION]` in the header. Extra logos (up to 5) go next to the existing logo in the header. The total number of pages in the footer is an automatic field.
- The template must keep: a first table whose first row is the header and second row is the blank row to copy, the three placeholders in header 2, and the hand-typed page total in footer 2.

**Image resizer**
- Three modes: crop to an exact format (drag and zoom to choose what is kept), only change the size (whole image, never enlarged, width and/or height as maximums), exact format with a background added (colour or transparent).
- Output as JPG, PNG or WebP, with a quality setting. The weight is shown before and after.
- Ready-made formats are listed in `PRESETS` at the top of `imageresizer.js`: add or edit lines there. Sizes are limited to 8000 px on a side.

**QR code maker**
- The QR encoder is written in `qrcode.js` itself (no library): byte mode, versions 1 to 40, all four error-correction levels. With a logo the code uses level H (about 30% can be lost), without a logo level M.
- A link typed without `https://` gets it added. Links are limited to 800 characters.
- The FEPS logo (`logo_FEPS.png`, transparent PNG, loaded with `fetch` like the templates) is used by default. The user can switch to their own logo (PNG, JPG or WebP) or to no logo. The logo is shown at 10 to 25% of the code width, on a background-coloured rounded square. Colours and image size are adjustable, with a low-contrast warning.
- Output: PNG, or SVG (vector, for print, logo embedded).

## Running it on your computer

Open the folder in a terminal and start a small local server, then open the address it shows:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Do not open the pages by double-clicking the files: the browser then blocks the loading of the PowerPoint and Word templates.

## Adding a tool

1. Create a folder `<tool>/` with `<tool>.html` and `<tool>.js`.
2. In the page, link `../assets/style.css`; add `../assets/jszip.min.js` and `../assets/table.js` only if needed.
3. Follow the layout of the other tools: back link, title, one-sentence explanation, numbered steps, questions, footer saying the data stays in the browser.
4. Add a block in `index.html` (copy a whole `<a class="tool">` block and change the link, title and sentence).
5. Add the tool to the tables above in this README.

## Good to know

- The tools handle personal data (registrations, names): it stays in the browser tab and is gone when the page is closed. The Word and PowerPoint files created are saved on the user's computer, so they should be kept safely and deleted when no longer needed.
- JSZip 3.10.1 is MIT / GPLv3 dual licensed; its licence notice is at the top of `assets/jszip.min.js`.
