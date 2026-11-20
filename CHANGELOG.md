# Changelog

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
