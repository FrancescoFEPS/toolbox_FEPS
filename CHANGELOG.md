# Changelog

## [1.0.2] - 2026-11-21

### Added
- **`assets/gif.js`**: shared animated GIF encoder (no library): one 256-colour table (median cut) for the whole animation, optional ordered dithering, LZW, loop extension.
- **Video to GIF** (`gifmaker/gifmaker.html`, `gifmaker/gifmaker.js`): turns a part of a video into an animated GIF. Choose the start (or take it from the player), the length (up to 15 s), the width (up to 800 px) and the images per second; loop or play once; "smoother colours" option. Limited to 300 images and 60 million pixels in total.
- **Home page** (`index.html`): new "Video to GIF" card, in the Images group.

### Changed
- **Image resizer** (`imageresizer/imageresizer.html`, `imageresizer/imageresizer.js`): the input now also accepts GIF (first image only, not animated), BMP, AVIF (where the browser can read it) and SVG (drawn at least 1600 px on its long side). The result is still JPG, PNG or WebP. Messages and questions updated.
- **Image resizer**: iPhone photos (HEIC/HEIF) are accepted too. They are converted to PNG in the browser by `assets/heic2any.min.js`, loaded only when needed.
- **`README.md`**: added Video to GIF, `gif.js`, `heic2any.min.js` and the new input formats.

## [1.0.1] - 2026-11-20

### Added
- **Flickr link maker** (`flickr/flickr.html`, `flickr/flickr.js`): paste a link and its title, and get the code `🔗 <a href="…" rel="noreferrer nofollow">…</a>` to paste in a Flickr description. Includes a copy button and a preview of the link.
  - A link typed without `https://` gets it added; the rest of the address is kept exactly as typed.
  - The address and the title are escaped, so quotes or `&` cannot break the code.
- **Home page** (`index.html`): new "Flickr link maker" card, in the Images group.

### Changed
- **`README.md`**: added the Flickr link maker (table, structure, how it works) and brought the Nameplates and Registration sections in line with version 1.0.0 (no-logo option, two-row logos, up to 10 extra logos, `people.js`, no status filtering, bold names, wider signature column).

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
