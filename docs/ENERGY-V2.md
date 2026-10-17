# Exercise battery - 2026-10-17

## Rules and configuration

All current gameplay numbers live in src/config/energy.ts. Run
`npm run energy:config` after changing them; `energy:config:check` rejects a
different generated SQL seed. Historical v1 constants exist only for migration
regression tests, not for current app behavior.

- Capacity 30; each exercise's first answer in an attempt costs 1, right or wrong.
- Reading cards and subsequent end-of-attempt mistake corrections cost zero.
- A new review attempt charges its first answers too. Resuming and replaying an
  already recorded answer do not charge again. Friend challenges remain free.
- One energy returns every 2,880 seconds (48 minutes): 30 in 24 hours. Raised from 25 by migration 202610180001_battery_capacity_30.sql (full wallets become 30).
- Correct-answer streak milestones 5 and 10 each roll 5-8 energy. Every graded
  answer, including a free correction, increments or resets the streak.
- Perfect first answers throughout a lesson grant +5, confirmed by the owner.
- Each milestone and perfect reward is claimable once per wallet and lesson,
  including across repeated attempts. Reopening/reviewing cannot farm rewards.
- Overflow defaults off. The receipt and animation display actual added energy,
  not the random roll if the cap reduces it. At full capacity a bonus can add 0.
- No purchases, ads, subscriptions or manual refills were introduced.

## Unit chest rewards

`CHEST_ENERGY_CONFIG` in the same configuration file sets the range (5-7) and
required completed fraction (half). The chest opens on demand once per wallet
and unit. Migration 202610170003 extends the existing RPC without changing
exercise costs, answer receipts, XP or streak rewards. Its standalone activation
file is `artifacts/battery/ativar-baus.sql`; the configuration checker also
validates its generated values.

Authenticated eligibility uses server-owned completed lesson progress. Guest
eligibility counts distinct server-confirmed completed battery sessions; local
history or claimed completion counters cannot unlock a chest. Old guest lessons
without server proof must be confirmed by completing them again. Opening a
chest requires a connection. Wallet locks and the unique wallet/unit receipt
prevent duplicate bonuses across retries, tabs and reloads. Receipts are private
under RLS and cascade with wallet/account deletion.

A full battery leaves the chest untouched. A partial fill caps the actual bonus
at capacity unless the existing overflow setting is enabled; the dialog warns
before claiming and shows the actual amount afterwards. The drawn amount is
saved separately. The chest cannot be re-rolled by retrying a request. Errors
from an unavailable chest deployment do not reset energy or grant a local bonus.

## Persistence, clock and offline behavior

The server owns the wallet, UTC refill time, answer order, first answers, queue,
streak, mastery and last acknowledged draft. A wallet lock serializes requests;
attempt/turn receipts make retrying after a lost response idempotent. A different
answer for an already committed turn is rejected. Correctness is calculated
from published questions on the server, never a client-provided boolean.

An insufficient-balance warning compares energy with remaining chargeable
exercises. Exhaustion keeps the selected answer and offers save-and-exit.
Drafts are retained for at least the configured 72 hours; no automatic expiry
cleanup is scheduled in this release, so they currently last longer. Account
deletion cascades through its wallet and answer data.

Every answer confirmation requires a connection, including free corrections.
There is no provisional offline wallet or delayed client reward. A failed
request keeps the draft and selection; retry reconciles with the server receipt.
The display countdown uses server time plus a monotonic elapsed timer; changing
the device date never creates energy. Only a server response changes balance.

Guests receive a server-generated random capability stored privately through
the app's session storage (SecureStore on native). Only its hash is stored in
the server wallet. No Auth account is created. Guest XP/history still remain
local. Clearing guest storage creates a new identity; this is not device
attestation or a strong defense against automated creation of guest identities.

Guest identity recovery was corrected after switching the web preview from its
disposable database to the hosted backend. Storage keys are now backend-scoped
and SecureStore-safe. A legacy capability is validated before adoption, retaining
its existing server wallet and balance when valid. Only an explicit
P0001/battery_guest_required rejection allows registration of a replacement;
network/server failures never reset a known identity or grant a refill. Calls
share one registration promise, and a rejected runtime identity retries at most
once. No local history/XP is deleted or imported into a server wallet. Answers
that existed only in a different test database are not fabricated as receipts
on the real backend. Ten focused unit checks and eight mobile Playwright cases
passed, including stale test identity recovery, persisted charge after reload,
and failure recovery without replacing a valid wallet. App/test types passed.
This source correction is not part of the existing versionCode 6 AAB.

## Upgrade and deployment

Migrations 202610170001 and 202610170002 add private RLS-protected battery
tables, RPCs, grading/receipt validation, and compatible push/admin aggregates.
Direct table access and private helpers are revoked from anon/authenticated.
The old completion function is private behind the new receipt-checking wrapper.

Existing server balances migrate proportionally from 5 to 25, with remaining
refill time rescaled. A pre-upgrade server reservation, or an unfinished attempt
already known to the server at migration time, is grandfathered without
retroactive charges or rewards. A local-only unproven old outbox cannot silently
bypass the new server validation and is retained for recovery rather than lost.

The generated artifacts/battery/ativar-bateria.sql combines the two migrations.
It requires preceding migrations through 202610160005. Apply once, coordinating
with the compatible app release: the upgraded server intentionally rejects
old energy-entry calls from incompatible clients when energy is enabled.
Do not apply both the bundle and its individual migrations twice.

No production SQL, new AAB, remote push deployment or physical Android test
is included here. Existing push consent/quiet hours/rate limits remain intact.
Generated legal-site pages describe the new storage, but were not published.

`npm run energy:preview` serves a disposable local SQL database on 127.0.0.1:8092
and a guest-only web preview on localhost:8089. It has no production credentials,
does not forward traffic to production, and resets test data on restart.

## Artwork

Built-in image_gen generated a new original transparent bitmap. Reference:
the user's pink battery example, not its character or background. Prompt:
"Tiny game energy icon; original single pink horizontal rounded battery;
short terminal on the right; thick white border and large white lightning bolt;
light-pink upper-left gloss; near-front slight tilt; clean 2D cartoon readable at
24-32px; true transparency; no text, numbers, mascot, scenery, yellow background,
sparks or additional objects."

Original output:
C:/Users/mathe/.codex/generated_images/01a10dea-ccf2-78d0-8ea5-daced40b2107/exec-26ac3030-e349-47bd-8654-977e0185d94b.png

scripts/prepare-battery.mjs mechanically resizes it to
assets/icons/battery-pink.png (384x256 RGBA). Transparency and nonblank pink
pixels are tested. The asset replaces the old energy artwork and appears beside
the lesson progress bar, in meters, details, warnings and reward feedback.
Existing motion preferences govern the short reward animation.

## Verification

279 unit/integration tests passed, including SQL migration, all published
question-format grading parity, owner isolation, guest capabilities, duplicate
requests, lost receipts, free corrections, server refill, cap/overflow, legacy
attempt preservation, perfect rewards and account deletion.

Playwright exercises mobile/desktop entry, battery placement, charge accuracy,
clock tampering, lost responses, exhaustion/resume, zero-balance corrections,
reward feedback, reload and offline recovery. Screenshots are retained under
artifacts/screenshots/battery/. All 81 regression scenarios passed, followed by
all 18 battery scenarios again after the final synchronization/migration edits.
App/test TypeScript and full zero-warning ESLint passed. Physical Android behavior and a production
upgrade rehearsal with an existing installed client remain release checks.

The actual local guest preview also passed onboarding, a 25-to-24 server charge
and persisted feedback after reload, with no route mocks or production calls.
