# Feature regression checks

Run `npm ci` and `npm test` with Google Chrome installed. Alternatively set
`CHROME_PATH` to a Chromium executable. Tests extract and parse the application
module without starting Firebase. All database calls use an isolated mock.

Coverage: all three department heads can select engineers in any department's
existing project form. Non-head permissions stay unchanged. Cross-department
selection preserves status, dates, evaluation, notes and other stored values.
Browser checks verify enabled engineer checkboxes beside locked status and notes.
The separate work-assignment button has been removed. Any records already saved
in projectAssignments remain visible and are not deleted or migrated.

Additional coverage: multiple editable slides, saved HTML reopening, slide print
pagination, A1 default, landscape/A3/custom PDF dimensions and saved settings.
Tests capture HTML download serialization before the browser download.

The repository contains only a static client and no Firestore security rules or
trusted authentication service. Authorization checks follow the existing app-user
model; these checks cannot establish server-side identity. This change does not
alter authentication, deployed rules, user records or existing permissions.
Server-side authorization needs a separate authenticated backend/rules review.

Posters use the same millimetre geometry for preview and browser print/Save as PDF.
Landscape uses a two-column composition. Other aspect ratios fit the full design
inside the chosen sheet without cropping; margins can appear for unusual ratios.
Use the browser's CSS page size, zero margins and 100% scale; physical printer
paper support and printable margins still depend on the printer.
