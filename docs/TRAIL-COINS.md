# Owner-provided trail coins - 2026-10-17

The supplied moeda.png and moeda2.png were copied byte-for-byte to
assets/ui/trail-coin-blue.png and trail-coin-gray.png. Their original 1024x1024
resolution and transparent background are preserved; no image generation,
recoloring, cropping or resampling was used.

Completed, available and current nodes use the blue artwork; locked nodes use
the gray artwork at its original opacity. The current ring and playable-node
play badges remain. Redundant completed/locked badges were removed because the
new images already include their check and padlock. Node dimensions remain
104x104. Existing press handling, lesson ordering, progression, XP and finite
completion animation are preserved; the completion glow now uses a cool tint.

Five focused unit checks passed, including source hashes and alpha, and three
Playwright cases passed at 320/390/1280 px. They verify image loading/dimensions,
completed/current/locked states, locked-node hints and current-lesson navigation
without changing completion. App/test TypeScript and full ESLint passed.
Inspected screenshots: artifacts/screenshots/trail-coins/.

This source change is not included in the existing versionCode 6 AAB. Physical
Android rendering still needs verification with a subsequent build.
