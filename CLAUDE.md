# Nritya Mandala — notes for Claude

Dance studio booking app: React 19 + Vite, Tailwind v4, Supabase (project
`llflbysghhjjyjlusirg`), hosted on Render (admin.nrityamandala.com /
app.nrityamandala.com). Plans and parked work live in `ROADMAP.md`.

## Working rules
- Commit and push each change straight to `main`.
- Before every commit: `npm run build`, `npm run lint`, `npm test`, and a quick
  browser smoke test — the live pages must never break.
- When the user asks for suggestions, suggest only; implement just the items
  that are clear. "Plan" means plan, not build.
- The mobile apps are on hold (finance) — nothing app-related until told.
- Emails to team members may reach non-admins: never mention Admin Config
  details (settings screens, recipient lists, who triggered a send) in them.

## Supabase: new tables need explicit grants (from 30 Oct 2026)
From **30 October 2026**, Supabase no longer grants Data API access to new
tables in `public` automatically. A table created without grants is
unreachable from supabase-js / PostgREST ("permission denied"). Existing
tables keep their grants (all current tables were checked on 26 Sep 2026:
RLS on, grants present).

So every migration that **creates a table** must, in the same migration:
1. `alter table public.<table> enable row level security;` and add policies
   (RLS is what actually protects the data — grants only open the door).
2. Add explicit grants — only for the roles that need the table:

```sql
grant select, insert, update, delete on public.<table> to authenticated;
grant select, insert, update, delete on public.<table> to service_role;
-- only if the public site / parent page reads it directly:
grant select on public.<table> to anon;
```

Views that the app reads (e.g. `student_package_summary`) need the same
grants. Edge functions use `service_role`, so it needs the grant too.
