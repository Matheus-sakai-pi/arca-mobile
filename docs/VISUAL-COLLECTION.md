# Arca visual collection - 2026-10-16

## Current app selection

Energy artwork was subsequently replaced with assets/icons/battery-pink.png.
The old energy.png is now unused source artwork. See ENERGY-V2.md for the
new battery asset provenance and current gameplay rules.

The user requested removal of the rectangular chapter panoramas. Their banners,
expansion modal and asset imports have been removed from unit trails, lessons
and reading cards. The ten JPEGs below are retained only as unused source
artwork, not bundled app assets. The seven PNG cutouts, existing backgrounds,
unit-card illustrations, characters, checkpoints and motion remain unchanged.
The sections below record the original generation and its initial verification.

Removal regression checks: four focused unit checks and all three mobile
Playwright scenarios passed, including banner absence, answer submission,
unchanged XP, real checkpoints and retained supporting artwork. App/test
TypeScript checks passed.

## Original artwork

17 new images were generated using the built-in image_gen tool. Only Arca's
existing artwork was used as a style reference. No extracted third-party app
resources are bundled. The complete prompts and original output paths are in
artifacts/visual-collection/manifest.json.

Final project assets are under assets/visuals/:

| File | Use |
| --- | --- |
| foundations.jpg | Bible foundations chapter |
| stories.jpg | Characters and foundational stories chapter |
| genesis.jpg | Genesis and patriarchs chapter |
| exodus.jpg | Exodus and desert chapter |
| wisdom.jpg | Kings, poetry and wisdom chapter |
| prophets.jpg | Prophets and rebuilding chapter |
| gospels.jpg | Life of Jesus chapter |
| parables.jpg | Teachings and parables chapter |
| community.jpg | Acts and early communities chapter |
| letters.jpg | Letters and final overview chapter |
| friends.png | Friends and empty people search |
| review.png | Empty and populated review introduction |
| history.png | Empty history and empty weekly summary |
| challenge.png | Challenge invitations, first question and receipt |
| energy.png | Energy details and exhausted-energy gate |
| waypoint.png | Halfway/completed unit checkpoint |
| streak.png | Daily streak widget |

Chapter panoramas are context for a whole unit, not historical reconstructions
or question-specific answer diagrams. They appear in unit trails, the first
exercise of each lesson and reading cards. They can be expanded in a modal
without starting/restarting a lesson or changing the selected answer.

## Motion

- Supporting art makes two gentle movements on focus, then rests. Backgrounding
  or leaving a screen cancels it. The bitmap always has a fixed layout footprint.
- Lesson results and achievement celebrations get a short confetti burst.
  The account-scoped motion ledger prevents repeats during the same session.
- Existing achievement art is preserved. Streak milestones rise; unit/lesson
  milestones tilt; XP milestones pulse. No extra achievement or XP is awarded.
- The system and in-app reduced-motion settings disable these effects.
- No new mandatory introduction screen, timer, sound or permission prompt.
- No GIF/video downloads, new native packages or external image requests.

## Packaging

scripts/prepare-visual-collection.mjs mechanically resizes/compresses the generated
files, retaining PNG alpha for cutouts. Panoramas are local 960x640 JPEGs; cutouts
fit within 512x512. The 17 final assets total 4,058,212 bytes (about 3.87 MiB).
Original generator outputs remain intact. Prompts/QA are excluded by .easignore.

## Verification

Unit checks cover all 100 lesson/unit mappings, fallback IDs, honest checkpoint
counts, unique/nonblank decoded pixels, alpha preservation, payload budget and
bounded optional motion. Playwright covers image expansion, answer persistence,
unchanged XP/authorization, halfway/completed checkpoints, all illustrated empty
states, energy details and reduced/full-motion results at 320, 390 and 1280 px.

Final checks: 267 unit/integration tests passed; all 66 Playwright cases passed.
After correcting panorama sizing, all nine visual-collection Playwright cases
passed again, including image-bound/aspect-ratio assertions. App/test TypeScript
checks and zero-warning ESLint passed. Inspected screenshots are retained in
artifacts/screenshots/visual-collection/.

Physical Android rendering and performance still need an installed-build check.
No new AAB or production database update is part of this visual change.
