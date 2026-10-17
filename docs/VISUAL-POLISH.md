# Visual refinement - 2026-10-16

The supplied Manna design inventory is reference material only. No Manna code,
artwork, fonts, copy or animation files are included in Arca. Existing Arca
landscapes, learning rules, profile identity and original unit illustrations stay.

## Design decisions

- Keep Nunito. Reading text uses Regular, commands Bold, important headings ExtraBold.
- Neutral cool canvas, white controls, blue actions, semantic green/red feedback.
- Separate answer targets with 8 px corners, visible borders and at least 64 px height.
- Raised buttons have a stable outer footprint and a face that travels 4 px down.
  Remove decorative gloss, keep optional preference-controlled tactile feedback.
- Exercises and results are unframed, without the scenic backdrop. Unit trails,
  rankings and learning overview retain their illustrations.
- Compact unit cards use one fixed title scale and fixed artwork bounds. Accent
  colors identify units without recoloring their original illustrations.
- Mistakes receive encouragement; thinking and success have distinct mascot poses.
  Mascot motion is a single short gesture, never an infinite reading distraction.
- Results show the introduction, XP, statistics, then unit progress. Existing
  achievement queues remain deferred until leaving the result. Optional reminder
  invitations wait until the sequence finishes. Reduced motion skips animation.
- Empty/error/loading states share spacing, icon size, text hierarchy and actions.

## Original generated assets

Built-in image_gen was used with assets/mascot/idle.png as the identity reference.
All three PNGs retain transparency. Original files have not been overwritten.

- assets/mascot/encouraging-v2.png
- assets/mascot/thinking-v2.png
- assets/mascot/correct-v2.png

Prompt set:

1. Preserve the original Arca elderly guide's face, brown eyes, white wavy hair
   and beard, ivory robe, red sash, brown belt and soft 3D illustration style.
   Create a calm reassuring closed-mouth smile, empathetic raised eyebrows, one
   hand over the heart and a small thumbs-up near the chest. No book, no text,
   no glow or backdrop. Centered bust, whole hands visible, transparent padding.
2. Preserve the same identity and rendering style. Create a curious expression,
   looking slightly up with one finger gently touching the beard and the other
   arm resting near the waist. No book, symbols, yellow shape, glow or text.
   Centered bust, whole hands visible, genuine transparent background.
3. Preserve the same identity, lighting and rendering. Create a delighted smile,
   eyes open and pleased, one index finger raised beside the face in a small
   affirming gesture, other hand supporting the closed Bible near the waist.
   This is a correct answer, not the arms-up lesson celebration. Centered bust,
   whole hands visible, transparent padding, no glow, backdrop, text or border.

## Verification

- Theme tests measure normal-text AA contrast for reading/action/feedback pairs.
- Browser tests cover compact cards, scenic trails, stable press geometry,
  selected/correct/wrong answers, mascot assets, result progress, reduced/full
  motion, empty search and recoverable errors at 320, 390 and 1280 px.
- Existing learning, energy, reports, friends and challenge flows remain in the
  browser regression suite. Database and scoring tests run without production data.
- Physical Android appearance, haptic feel and font scaling still require an
  installed build; web checks do not substitute for a device test.

Validation record:

- Full unit/integration run: 262 passed. Subsequent focused checks of the theme,
  new PNG poses, reward behavior and preserved scenery: 20 passed.
- Browser regression: all 45 existing workflow cases passed at the three sizes.
- Final visual cases: 9 passed in the visual run, then the 3 error-recovery cases
  passed after making the simulated outage stable during profile hydration.
- App/test type checks and lint passed. Screenshots are retained under
  artifacts/screenshots/visual-polish/ with viewport suffixes 320, 390 and 1280.
- Preview uses port 8087 because the previous preview already occupies 8086.
