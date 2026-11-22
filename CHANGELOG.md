# Changelog

Newest first. One entry per delivery.

## 2026-11-22

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

Not changed on purpose: the Sarbacane cleaner, and the size limit of the Image resizer (large images are needed for Canva).

Not done yet (ideas): `?v=` on scripts against browser cache, one shared `common.js` for the code repeated between tools, automatic tests with Playwright.
