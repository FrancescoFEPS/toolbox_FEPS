# Changelog

Newest first. One entry per delivery. Old entries are kept as a history.

## [1.0.4] - 2026-11-23

### Added
- **PDF text cleaner** (`pdftext/pdftext.html`, `pdftext/pdftext.js`): new tool in the group "Newsletter and website". Glues back the lines of a text copied from a PDF, keeps the real paragraphs, repairs words cut with a hyphen, turns joined letters (ﬁ, ﬂ) back into normal letters, and has a "Copy" button for WordPress.
- **Home page** (`index.html`): new "PDF text cleaner" card, in the Newsletter and website group.

### Changed
- **README** (`README.md`): the tool is added to the table, the structure and "How each tool works".

## [1.0.3] - 2026-11-22

### Fixed
Fixes found while reading the code. No change to the look of any tool.

- **Excel reading** (`assets/table.js`): an empty row that Excel saves as `<row r="3"/>` no longer swallows the row after it, and skipped rows stay empty. This affects the List cleaner, the Nameplates and the Registration list.
- **Names** (`assets/people.js`): small words that belong to a surname stay with it, so "Ursula von der Leyen" gives the last name "von der Leyen" (von, van, de, de la, del, di, da, du, ter...). The first name is never swallowed.
- **Blur and hide** (`blur/blur.js`): the size of the blocks now depends on the rectangle that was drawn, not on the image. A small name on a big screenshot is now as unreadable as a big face.
- **Registration list** (`registration/registration.js`):
  - invisible control characters from Excel cells are removed before they are written in the Word file (Word would otherwise ask to repair it);
  - a person who appears twice is marked "listed more than once?" in the list, and the number is shown next to the count;
  - if a placeholder is missing in the Word template (event name, date, location, header logo, page total), a warning is shown instead of failing silently.
- **List cleaner** (`cleaner/cleaner.js`): a column is read as dates only if its title contains the word "date", "time" or "timestamp". "Candidate", "Update" or "Timeline" are no longer touched.
- **Nameplates** (`nameplates/nameplates.js`): invisible control characters are removed from names, and the PowerPoint "sections" list of a custom template is removed (the slides it listed no longer exist, so PowerPoint would ask to repair the file).
- **Add to calendar** (`calendar/calendar.js`): the links in the Sarbacane code now have `rel="noopener"`.
- **Image resizer** (`imageresizer/imageresizer.html`): the FAQ about adding formats no longer asks colleagues to edit a JavaScript file.
- **README**: `assets/people.js` added to the structure; the Registration section no longer mentions the STATUS filter (removed on purpose: people are removed by hand with "Remove"); notes updated for the changes above.

### Changed
- **README** (`README.md`): brought up to date with everything that exists: Video to GIF and Flickr link maker (tables, structure, how they work), `assets/gif.js` and `assets/heic2any.min.js`, the new input formats of the Image resizer (GIF, BMP, AVIF, SVG, HEIC), and details missing for Nameplates, Registration, List cleaner, QR code and Blur. A short section explains how README and CHANGELOG are kept up to date.
- **Changelog** (`CHANGELOG.md`): the entry of 2026-11-22 now follows the version logic (Added / Changed / Fixed). No old entry was removed.

Not changed on purpose: the Sarbacane cleaner, and the size limit of the Image resizer (large images are needed for Canva).

Not done yet (ideas): `?v=` on scripts against browser cache, one shared `common.js` for the code repeated between tools, automatic tests with Playwright.

## [1.0.2] - 2026-11-21

### Added
- **`assets/gif.js`**: shared animated GIF encoder (no library): one 256-colour table (median cut) for the whole animation, optional ordered dithering, LZW, loop extension.
- **Video to GIF** (`gifmaker/gifmaker.html`, `gifmaker/gifmaker.js`): turns a part of a video into an animated GIF. Choose the start (or take it from the player), the length (up to 15 s), the width (up to 800 px) and the images per second; loop or play once; "smoother colours" option. Limited to 300 images and 60 million pixels in total.
- **Home page** (`index.html`): new "Video to GIF" card, in the Images group.

### Changed
- **Image resizer** (`imageresizer/imageresizer.html`, `imageresizer/imageresizer.js`): the input now also accepts GIF (first image only, not animated), BMP, AVIF (where the browser can read it) and SVG (drawn at least 1600 px on its long side). The result is still JPG, PNG or WebP. Messages and questions updated.

## [1.0.1] - 2026-11-20

### Added
- **Flickr link maker** (`flickr/flickr.html`, `flickr/flickr.js`): paste a link and its title, and get the code `🔗 <a href="…" rel="noreferrer nofollow">…</a>` to paste in a Flickr description. Includes a copy button and a preview of the link.
  - A link typed without `https://` gets it added; the rest of the address is kept exactly as typed.
  - The address and the title are escaped, so quotes or `&` cannot break the code.
- **Home page** (`index.html`): new "Flickr link maker" card, in the Images group.

## [1.0.0] - 2026-11-20

### Added
- **`assets/people.js`**: Shared helper to parse names and organisations from Excel or CSV files across Nameplates and Registration.
- **Nameplates – No-logo option**: Added the `"No logo at all (not even FEPS)"` checkbox in `nameplates/nameplates.html` and `nameplates/nameplates.js` to strip all images from the first slide.
- **Nameplates – Two-row logo layout**: Automatically wraps logos onto two rows when the total count (including FEPS) exceeds 5, and raised the added logo limit from 5 to 10.
- **Nameplates – Combined name column support**: Enabled Excel imports with first and last names in a single column.
- **Registration – Remove button**: Added a `Remove` button next to each participant in the list (`registration/registration.js`, `registration/registration.html`).
- **Registration – Manual paste input**: Added a text area supporting one entry per line (`First Name Last Name, Organisation`) as well as pasted Excel cells (`Name`, `Last name`, `Organisation`).

### Changed
- **Registration – Status filtering removed**: Removed status-based filtering so all imported participants are retained.
- **Registration – Name & organisation parsing**:
  - Maps `Name` or `First name` to first name, pairing with `Last name` or `Surname` when available.
  - Splits combined full-name columns by treating uppercase words as the last name (e.g., `Andreas SCHIEDER`), or falling back to the final word.
  - Supports organisation columns such as `Organisation / Job title` and `Company`, leaving the field blank when absent.
- **Registration – Word export (`Registration_template.docx`)**:
  - Formatted first and last names in bold.
  - Scaled the signature column width to **160%** of its original width, capped at **45%** of the total table width (assuming it is the last column).
  - Scaled added logos to **65%** of the FEPS logo height.
  - Replaced `"organizers"` with `"organisers"` across the document body, header, and footer.
