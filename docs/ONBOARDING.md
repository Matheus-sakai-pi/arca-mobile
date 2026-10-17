# New-user onboarding - 2026-10-17

The existing four generic slides are replaced by a short guided introduction:

1. Welcome, existing Arca mascot and a brief introduction.
2. One multiple-choice example, using the app's real question renderer and
   answer validation. Incorrect answers receive an explanation, can be retried,
   and never prevent moving on after verification.
3. Energy: capacity 25, one per first exercise answer in an attempt, recovered
   every 57 minutes 36 seconds. End-of-attempt corrections are free. Already
   recorded answers are not charged again when resuming. The explanatory
   numbers use src/config/energy.ts, not a simulated account balance.
4. Create an account, continue directly to Learn as a guest, or sign in.

Back preserves the example state. Skip goes to the final choice rather than
forcing registration. A synchronous action lock prevents duplicate completion.
Existing users retain the arca.onboarding.v1 completion marker; no reset or
migration is required. Finishing writes the marker only when an entry choice
is selected. Restricted completion storage does not block guest entry.

The example is not a published lesson and does not create attempts, consume
energy, grant XP, write study history, unlock achievements or ask for notification
permission. No new personal questions, backend tables or analytics were added.
The existing reminder invitation after three completed lessons is unchanged.

Original Arca mascot/cutout assets are reused. No panoramic images return.
The normal motion preferences apply. Footer actions remain available while
the page can scroll on short screens or with larger accessibility text.

Tests: three pure unit checks cover navigation, answer validation and isolation.
Playwright covers correct/incorrect answers, retry/back, energy copy, guest entry,
signup/login routing, existing users, persisted completion and restricted storage
at 320, 390 and 1280 px. The existing guest lesson/correction/review flow is also
exercised. Final results: three focused unit tests and all 12 onboarding
Playwright scenarios passed after the compact-layout revision. The three
existing guest lesson/correction/review scenarios passed in the preceding run.
App/test TypeScript, full ESLint and a final changed-file ESLint check passed.
Inspected screenshots are in artifacts/screenshots/onboarding/. Physical Android
back-button behavior remains a device verification.

No AAB, production database change or dashboard deployment is included.
