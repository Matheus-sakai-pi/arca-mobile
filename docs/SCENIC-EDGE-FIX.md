# Scrolling scenery edge fix - 2026-10-17

The owner's Android screenshots show the ark scenery ending short of the right
edge on Home and Profile. The gap is consistent with the two horizontal content
insets: native percentage sizing can resolve against the padded inner width,
while the absolutely positioned child starts at the outside left edge.

ScrollingIllustration now uses left: 0 and right: 0 with its existing aspect
ratio, instead of width: '100%'. No bitmap, content spacing, safe-area rule,
continuous scene or bottom fade was changed. This avoids shifting the image
by a device-specific offset.

The native style-contract regression passed. Three Playwright cases passed at
320, 390 and 1280 px, each checking Home and Profile edge alignment, image
loading, aspect ratio and scenery movement during scrolling. Inspected captures
are under artifacts/screenshots/scenic-edge/. Full ESLint and app/test
TypeScript passed. Android installation verification remains pending.

This source change is AFTER AAB versionCode 6. That existing artifact has not
been altered; the correction will require a new Android build for device use.
