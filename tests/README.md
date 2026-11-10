# Feature regression checks

Run `npm ci` and `npm test` with Google Chrome installed. Alternatively set
`CHROME_PATH` to a Chromium executable. Tests extract and parse the application
module without starting Firebase. All database calls use an isolated mock.

Coverage: additional assignment authorization, duplicate and input validation,
preservation of existing section/unknown data, assigned-project visibility,
escaped assignment display, adding multiple editable slides, naming image slots,
saved HTML reopening and continued editing, slide print pagination, poster A1
default, landscape/A3/custom PDF page dimensions, saved poster settings and invalid
dimension handling. HTML download serialization is captured before the browser
download to keep this test independent of download policies.

Additional assignments are stored only in `projectAssignments` using a transaction.
Existing assignment fields, department status, dates and evaluations are untouched.
Old records require no migration. Normal project updates preserve this new field.

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
