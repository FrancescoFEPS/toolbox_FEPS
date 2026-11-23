# toolbox_FEPS

Small online tools for the team. Everything runs in the browser: **nothing is uploaded anywhere**, there is no server and no build step.

See `CHANGELOG.md` for what changed and when (versions, newest first, old entries are kept as a history).

## The tools

On the home page the tools are grouped by type, with a title per group.

| Group | Tool | Folder | What it does |
|---|---|---|---|
| Events | Nameplates generator | `nameplates/` | Turns a list of names into a PowerPoint with one slide per name, ready to print as folded table nameplates. |
| Events | Registration list | `registration/` | Turns the registrations exported from the website (Excel) into the printable signature list (Word). |
| Events | Add to calendar | `calendar/` | Makes an .ics file and Google / Outlook "add to calendar" links for an event, plus ready-to-paste HTML for Sarbacane. |
| Newsletter and website | Sarbacane code cleaner | `sarbacane/` | Applies 4 fixed replacements to the raw HTML of a Sarbacane newsletter. |
| Newsletter and website | QR code maker | `qrcode/` | Turns a link into a QR code, with an optional logo in the middle, as PNG or SVG. |
| Newsletter and website | PDF text cleaner | `pdftext/` | Glues back the lines of a text copied from a PDF, so it can be pasted in WordPress without broken sentences. |
| Images | Image resizer | `imageresizer/` | Crops, resizes, compresses or changes the format of an image for the website, the newsletter or social media. |
| Images | Blur and hide | `blur/` | Pixelates, blurs or blacks out parts of an image, and removes its hidden photo data. |
| Images | Video to GIF | `gifmaker/` | Turns a short part of a video into an animated GIF. |
| Images | Flickr link maker | `flickr/` | Makes the code of a 🔗 link to paste in a Flickr description. |
| Lists and documents | List cleaner | `cleaner/` | Cleans an Excel/CSV list (spaces, capitals, empty rows, duplicates, wrong emails, comparison with another list). |
| Lists and documents | PDF merge and split | `pdf/` | Merges PDFs, takes pages out of a PDF, or splits a PDF into several files. |

Set aside for now: **Quote visuals** (`quotecard/`). It was removed from the repository and from the home page until a better style is found.

## Structure

```
index.html                 home page listing the tools by group (uses assets/style.css)
CHANGELOG.md               what changed, by version, newest first (old entries are kept)
assets/
  style.css                shared look (all pages)
  jszip.min.js             JSZip 3.10.1, one shared copy
  table.js                 shared reader for .xlsx / .csv files (needs JSZip)
  people.js                shared reader for people (name, last name, organisation) from a table (needs table.js)
  gif.js                   small animated GIF encoder (no library), used by Video to GIF
  pdf-lib.min.js           pdf-lib 1.17.1 (MIT), used by the PDF tool
  heic2any.min.js          converts iPhone photos (HEIC) to PNG, used by the Image resizer (loaded only when needed)
favicon/favicon.png
nameplates/    nameplates.html + nameplates.js      (+ Nameplates_FEPS.pptx)
registration/  registration.html + registration.js  (+ Registration_template.docx)
sarbacane/     sarbacane.html + sarbacane.js
imageresizer/  imageresizer.html + imageresizer.js
qrcode/        qrcode.html + qrcode.js  (+ logo_FEPS.png)
pdftext/       pdftext.html + pdftext.js
calendar/      calendar.html + calendar.js
cleaner/       cleaner.html + cleaner.js
pdf/           pdf.html + pdf.js
blur/          blur.html + blur.js
gifmaker/      gifmaker.html + gifmaker.js
flickr/        flickr.html + flickr.js
```

Rules of the structure:

- One folder per tool: a light HTML page and one JS file. No library is pasted inside a page.
- Script order on a page: `../assets/jszip.min.js`, then `../assets/table.js` (only if the tool reads Excel/CSV), then `../assets/people.js` (only if the tool reads people: Nameplates and Registration), then the tool's own JS. Other shared files are added only where needed: `pdf-lib.min.js` (PDF), `gif.js` (Video to GIF). `heic2any.min.js` is not in the page: the Image resizer loads it by itself when an iPhone photo is chosen.
- Shared look = `assets/style.css`. Only what is specific to one page goes in a small `<style>` in that page.
- No CDN and no external request: the tools work without internet once the page is loaded.
- `Nameplates_FEPS.pptx`, `Registration_template.docx` and `logo_FEPS.png` are loaded by the page with `fetch`, so they must stay in the same folder as their page.

## How each tool works

**Nameplates generator**
- The first slide of `Nameplates_FEPS.pptx` is the model: it is copied once per name and the other slides are removed. A user can choose their own .pptx instead (first slide used, same rules). The PowerPoint "sections" list of the template is removed, because the slides it lists no longer exist.
- The name replaces the text in every text box of the slide (upright and upside down), so no other text should be in a text box on that slide. Every picture on the slide is treated as a logo.
- Up to 10 extra logos (PNG or JPG) are added after the existing logos, in the order chosen, on both the upright and the upside-down copy. With more than 5 logos in total they go on two rows. "No logo at all" removes every logo, FEPS included.
- Names: typed or pasted one per line, or loaded from an Excel/CSV file (the columns Name and Last name or Surname, or one column holding the full name; the names then fill the box and can still be edited). Leading bullets or numbers are removed, and anything after a comma, semicolon, tab or " - " (title, organisation) is ignored. Capitals are kept as typed. Invisible control characters are removed.
- "Fill in example names" fills the box with three examples. The preview on the right shows the first name, upright and upside down, and the list of slides to create.

**Sarbacane code cleaner**
- Four replacements, always the same and in the same order: `<body>` becomes a `<div>` with a transparent background; the main table background goes from #f6f1f1 to white; the closing `</body></html>` becomes `</div></html>`; a `.singlePostContent` style line (background #f6f1f1) is added at the top of the styles.
- The page shows which of the 4 were applied and which were not found. Text and images are never touched.

**Registration list**
- Input: the Excel (.xlsx) or CSV exported from the website. First row = column titles, first sheet.
- Columns: Name and Last name (or Surname), or one column with the full name. Optional: Organisation (it may also hold the job title) and Event (the event name pre-fills the form).
- Everybody in the file is listed. To leave someone out, use "Remove" next to their name in the list (the STATUS column is not used). People can also be added by hand (one per line, "Ania Skrzypek, FEPS", or cells copied from Excel). A person who appears twice is marked "listed more than once?", and the number is shown next to the count.
- Order: last name, then first name, A to Z, accents ignored. In a full-name column, small words such as "von", "van", "de la" stay with the last name.
- Output `Registration_List.docx`, built from `Registration_template.docx`: the people table (first and last name in bold, wider signature column), followed by 2 blank pages of 12 lines for guests who did not register online. The event name, date and location replace the placeholders `[EVENT NAME]`, `[DATE]` and `[LOCATION]` in the header. Extra logos (up to 5, 65% of the height of the FEPS logo) go next to the existing logo in the header. "No logo at all" is also offered. The total number of pages in the footer is an automatic field. "organizers" becomes "organisers" everywhere. If one of the placeholders or the page total is not found in the template, a warning is shown after the download.
- The template must keep: a first table whose first row is the header and second row is the blank row to copy, the three placeholders in header 2, and the hand-typed page total in footer 2.
- Invisible control characters in the cells are removed, so Word does not ask to repair the file.

**Image resizer**
- Input: JPG, PNG, WebP, GIF (first image only, not animated), BMP, AVIF (where the browser can read it), SVG (drawn at least 1600 px on its long side, so it stays sharp) and HEIC (iPhone photos, converted to PNG first by `assets/heic2any.min.js`, loaded only when needed; it needs the page to be opened from the website).
- Four modes: crop to an exact format (drag and zoom to choose what is kept), only change the size (whole image, never enlarged, width and/or height as maximums), exact format with a background added (colour or transparent), and **keep the original size and change only the file type** (the width and height fields are hidden; the image is re-saved as JPG, PNG or WebP at its own size).
- Output as JPG, PNG or WebP, with a quality setting. The weight is shown before and after. When a transparent PNG is saved as JPG, the transparent parts become white. A warning appears when the image has to be enlarged.
- Ready-made formats are listed in `PRESETS` at the top of `imageresizer.js`: add or edit lines there. Sizes typed in the fields are limited to 8000 px on a side (this limit does not apply to the "keep the original size" mode). Very large images are allowed on purpose, because they are needed for Canva.

**QR code maker**
- The QR encoder is written in `qrcode.js` itself (no library): byte mode, versions 1 to 40, all four error-correction levels. With a logo the code uses level H (about 30% can be lost), without a logo level M.
- A link typed without `https://` gets it added. Links are limited to 800 characters.
- The FEPS logo (`logo_FEPS.png`, transparent PNG, loaded with `fetch` like the templates) is used by default. The user can switch to their own logo (PNG, JPG or WebP) or to no logo.
- The logo is placed in the bottom-right corner by default (or in the middle), at 10 to 25% of the code width, and two sliders ("Move up", "Sideways") fine-tune its position. By default the code squares are removed only where the visible part of the logo (plus one square around it) is, so the transparent parts of the logo are respected; "Plain square" clears a rectangle instead. A warning appears if the logo hides too much of the code.
- Colours and image size (about 500 to 4000 px) are adjustable, with a low-contrast warning.
- Output: PNG, or SVG (vector, for print, logo embedded).

**PDF text cleaner**
- The user pastes text copied from a PDF. The result is updated as they type and copied with one button, to be pasted in WordPress. Only line breaks and spaces change: the words are never touched.
- Lines are cleaned (spaces trimmed, double spaces removed) and grouped in blocks separated by blank lines. Inside a block, lines are glued with one space. Blocks stay separate paragraphs, separated by a blank line in the result.
- A line that starts with a bullet (•, ▪, ◦, ●, ■, ►, ‣) or with a dash followed by a space always starts a new paragraph.
- Option "Repair words cut with a hyphen" (on by default): a line ending with a letter and a hyphen, followed by a line starting with a lowercase letter, is glued without the hyphen ("politi-" + "cal" gives "political"). A real hyphenated word cut at the hyphen loses it (explained on the page).
- Option "Start a new paragraph after a short line that ends a sentence" (on by default): inside a block, a line shorter than 70% of the longest line of the block and ending with . ! ? … : ” " » ) ] starts a new paragraph. It is for PDFs with no blank line between paragraphs.
- Always on: ligature characters (ﬀ ﬁ ﬂ ﬃ ﬄ ﬅ ﬆ) become normal letters, soft hyphens and form feeds are removed, non-breaking spaces become normal spaces.
- Not handled: page numbers, headers and footers copied with the text (the page tells the user to delete them by hand).

**Add to calendar**
- One event form: title, time zone of the event (Brussels by default), start date and time (or "All day"), optional end (empty = one hour, or one day if all day), place or online link, description and event page link.
- Times are converted from the chosen time zone to UTC with `Intl`, so summer and winter time are handled. The .ics file and the Google link use UTC times; every person then sees the event at the right time in their own calendar.
- Output: the .ics file (CRLF lines, text escaped, long lines folded), a Google Calendar link, an Outlook link for work or school accounts (outlook.office.com) and one for personal accounts (outlook.live.com), each with "Open" and "Copy the link".
- Sarbacane: the page builds a small HTML block with the links the user ticks (links open in a new tab with `rel="noopener"`). The .ics link only appears once the user pastes the address of the file after putting it online (for example in the website media library), because a newsletter cannot carry a file by itself.
- The links follow the public formats of Google and Microsoft; they should be tested with a real account when something changes on their side (in particular the Outlook links for an "All day" event, where the end date is the day after the last day).

**List cleaner**
- Reads the first sheet of an .xlsx, or a CSV (comma, semicolon or tab). The first row must hold the column titles.
- Options: remove extra spaces, remove empty rows or columns, fix capitals per column (only changes values that are all capitals or all small letters, so "McDonald" is left alone; also all lowercase / all capitals), remove rows with a wrong-looking email, remove duplicates (whole row or one chosen column, first one kept, capitals and spaces ignored), and compare with a second list (remove the people who are in it, or keep only them; the matching column must have the same title in both files).
- Excel dates read as numbers (45123) are turned back into dates in columns whose title contains the word "date", "time" or "timestamp" (so "Candidate" or "Update" are not touched).
- The list of changes is shown, with the removed rows in detail. The first 10 rows of the result are previewed.
- Output: .xlsx (written by the tool with JSZip, bold frozen header row) or .csv (UTF-8 with BOM, semicolon or comma). The original file is never changed.

**PDF merge and split**
- Uses `assets/pdf-lib.min.js`. Three actions: merge (order chosen with Up/Down), take pages out (ranges such as `1-3, 7, 10-`, in the order typed), split every N pages (zip of PDFs named `<file>_p1-2.pdf`).
- Password-protected PDFs are refused with a clear message. Pages are copied as they are (no compression); links, bookmarks and forms may be lost.

**Blur and hide**
- Images only (JPG, PNG, WebP). The user drags rectangles on the image (mouse or finger); each is pixelated, blurred or covered with a black box. The result is a flat new image, so the hidden pixels cannot be recovered, and the original's metadata (EXIF, GPS) is not copied.
- Pixelate and blur are drawn by shrinking and enlarging the zone (no `ctx.filter`, so it also works in Safari). The size of the blocks depends on the rectangle, not on the image: its short side is cut into only a few blocks (fewer blocks at higher strength). Strength is one setting for all pixelate/blur zones.
- Rectangles can be removed one by one, undone, or all cleared. Output as PNG or JPG.
- Not done yet: PDFs (idea: render each page to an image with pdf.js, hide, rebuild).

**Video to GIF**
- Input: an MP4, MOV or WebM video that the browser can read (iPhone HEVC videos only work in Safari). The video is shown on the right with its player.
- Settings: start (in seconds, or "Start from where the video is now"), length (up to 15 s), width (100 to 800 px, never larger than the video), images per second (5, 8, 10, 15 or 20), loop or play once, and "Smoother colours" (ordered dithering, heavier file). The size and number of images are shown before creating.
- Limits, so the browser does not run out of memory: 300 images and 60 million pixels in total (width × height × images). Beyond that, the button is switched off and a message explains what to reduce.
- How it works: the page moves the video to each moment, copies the image to a canvas, then `assets/gif.js` builds the GIF: one 256-colour table (median cut) for the whole animation so colours do not flicker, LZW compression, loop extension. The GIF is shown, with its size, and downloaded as `<video>_<width>px.gif`. There is no sound.

**Flickr link maker**
- Two boxes: the link and the text of the link. The code is always `🔗 <a href="…" rel="noreferrer nofollow">text</a>`.
- A link typed without `https://` gets it added; the rest of the address is kept exactly as typed. The address and the text are escaped, so quotes or `&` cannot break the code. Extra spaces in the text are removed.
- A preview shows how the link will look; a button copies the code.

## Running it on your computer

Open the folder in a terminal and start a small local server, then open the address it shows:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Do not open the pages by double-clicking the files: the browser then blocks the loading of the PowerPoint and Word templates (and of the HEIC converter).

## Adding a tool

1. Create a folder `<tool>/` with `<tool>.html` and `<tool>.js`.
2. In the page, link `../assets/style.css`; add `../assets/jszip.min.js`, `../assets/table.js`, `../assets/people.js` (or another shared file) only if needed.
3. Follow the layout of the other tools: back link, title, one-sentence explanation, numbered steps, questions, footer saying the data stays in the browser.
4. In `index.html`, copy a whole `<a class="tool">` block into the right group (Events, Newsletter and website, Images, Lists and documents) and change the link, title and sentence. If no group fits, copy a whole `<section class="group">` to start a new one.
5. Add the tool to the table above in this README (and a section in "How each tool works"), and an entry to `CHANGELOG.md`.

## Keeping the documentation up to date

- Every change updates **`README.md`** (tables, structure, how the tool works) and **`CHANGELOG.md`**.
- `CHANGELOG.md` follows one logic: newest version first, `## [x.y.z] - date`, then `### Added`, `### Changed`, `### Fixed`, with the files in brackets. **Old entries are never deleted**: they are the history.

## Good to know

- The tools handle personal data (registrations, names): it stays in the browser tab and is gone when the page is closed. The Word and PowerPoint files created are saved on the user's computer, so they should be kept safely and deleted when no longer needed.
- JSZip 3.10.1 is MIT / GPLv3 dual licensed; its licence notice is at the top of `assets/jszip.min.js`.
