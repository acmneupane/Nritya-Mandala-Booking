# Nritya Mandala — Studio Management

Internal tool for Nritya Mandala (Nepali dance studio) to manage kids, guardians,
classes, weekly bookings, attendance, class packages/payments status, and skill
levels. Parents look up their kid via a short code to see bookings, history, and
check in for today's class.

## Status

This repo currently holds the **legacy prototype** (`legacy-artifact/`) — a
single-file React app originally built as a Claude Artifact. It validated the
full feature set and data model with real use, but Claude Artifacts require a
logged-in Claude account to read/write persistent data, which blocks the
parent-facing side of this tool (parents shouldn't need a Claude account).

**Next step:** rebuild as a real deployed app:
- Frontend: React, hosted as a static site on Render
- Database: Supabase (Postgres + auto-generated API + row-level security)
- No custom backend server needed — the frontend talks to Supabase directly,
  secured via RLS policies

The legacy artifact stays in this repo as a reference for the data model,
UI, and business logic (packages/payment tracking, level progression, weekly
recurring bookings, parent code lookup) — nothing there needs to be
re-invented, just re-hosted properly.

## Data model (validated in the legacy artifact)

- `kids` — name, age, level, notes, short lookup code
- `guardians` — name, phone, relation, emergency-contact flag (linked to kids)
- `classes` — day, time, label, level focus, capacity
- `enrollments` — kid ↔ class, recurring weekly booking
- `attendance` — kid ↔ class ↔ date, attended/missed, linked to the package
  credit it consumed
- `levels` — studio-defined name/order/description, no built-in deletion
  (only a full reset) to protect kids' progress history
- `levelHistory` — level changes over time, per kid
- `packages` — classes paid for, notes (amount/discount — free text, not
  structured), consumed automatically as attendance is marked
