# Profile layout correction - 2026-10-17

The owner's installed Android screenshot shows an oversized blue avatar button
and missing streak/XP values. The shared components contained native layout
hazards absent from the earlier browser checks:

- Button.face used flex: 1 inside a content-sized Pressable in a ScrollView.
  Removing that expansion keeps the existing minimum touch height, intrinsic
  multiline sizing, raised face, loading state and pressed translation.
- AnimatedNumber used a read-only animated TextInput only on native, with
  percentage width/height and a hidden measuring label. All platforms now use
  normal AppText with absolute edge constraints over the same reserved label.
  Reanimated still drives the interpolation; only rounded value changes are
  scheduled onto React. Cleanup, reduced-motion preference, completion callback
  generation guard and the single accessible final-value label are retained.

No XP, energy, progression, profile data or server behavior was modified.
The visible values and the avatar picker can be checked in the web preview.
204 unit tests and 27 Playwright cases passed, including Profile, onboarding,
exercise feedback, results, button press geometry and picker controls at
320/390/1280 px. Profile is exercised with both motion preferences. Full lint
and app/test TypeScript passed. Inspected captures are under
artifacts/screenshots/profile-layout/.

No Android device was attached to ADB, so installed-app rendering/performance
are still unverified. The owner explicitly requested preview only for now:
no new AAB, OTA update or Play Store submission was generated. VersionCode 6
does not contain these source changes and its installed layout will not change
until a subsequent app build is distributed.
