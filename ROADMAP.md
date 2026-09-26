# Nritya Mandala — Roadmap

What's planned, what's waiting on a decision, and what's parked. Updated as
work is agreed or finished. (Shipped work lives in the git history.)

_Last updated: 26 Sep 2026 (weekly digest tested; switch on in Admin Config)_

## Next up

### Weekly digest email (staff) — tested ✓, waiting for you to switch it on
- Test send verified on 26 Sep 2026. The studio email can now be unticked too.
- Admin Config → Weekly digest: tick "Send the weekly digest automatically"
  and pick team members. It's off until you do.
- Default: Friday 8:00pm Sydney time, to the studio email plus the team
  members you pick. No money section, no roadmap section.

## Waiting on you
- **Mobile apps** (Android / iOS builds) — on hold until finance confirms the
  apps are worth it. Everything app-related waits for this.
- **High-resolution logo** (1024×1024 or larger) — for app icons and store listings.
- **Apple Developer ($99/yr) and Google Play ($25)** — only once the apps go ahead.

## Dates to remember
- **30 Oct 2026 — Supabase grants change.** New database tables no longer get
  Data API access automatically; each new table needs explicit grants in the
  same migration (details in `CLAUDE.md`). Existing tables are unaffected.

## Waiting on your OK — anti-spam gaps (found 26 Sep 2026)
Every public form goes through the anti-spam check (Turnstile) in the
`submit-form` edge function. But some database functions can still be called
directly with the public key, skipping that check:
- **`submit_enrollment_request`** (the current enrolment/transfer one) —
  anyone can call it directly and create enrolment requests with no anti-spam
  check. Fix: only the `submit-form` function (service role) may call it.
- **`submit_package_renewal`** — an old single-student renewal the app no
  longer uses (renewals go through `submit_family_renewal`). Fix: remove it.
- **`apply_referral_reward`** — not a form, but anyone can call it and link a
  student to a referrer (which can award free classes). Fix: admins only.

Fine as they are (by design or already protected): the parent-page functions
that need a student code (absences, video consent, family lookup), and
`admin_set_display_name` / `sync_renewal_reminder_cron`, which check for an
admin inside.

## Next phases

### Parent monthly digest email
Monthly email to each family: upcoming classes, classes left on the package,
birthday wishes, and similar.

### Forms — later phase
- "Invite to enrol" from a response, reusing its reference code as the student code.
- Link responses to students once they enrol.
- Branching questions.

### Mobile app — phase 1 (remaining) — on hold (finance)
- Push notifications: device registration, sending, clean-up of stale devices.
- Over-the-air updates (Capgo; may need finance approval).
- Deep links that open the app.
- Check the anti-spam widget and policy links inside the app.
- Release signing and store listings.

### Mobile app — phase 2 — on hold (finance)
- Parents edit their own mobile/email, with an audit trail of which device changed it.
- Revoke access for a device.

## Parked (low priority)
- Birthday shoutouts to families and coupons.
- Waitlist.
- SMS.
- Making the platform a configurable SaaS product.
