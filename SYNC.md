# Setting up free sync (≈5 minutes, once)

Inkwell works fully offline without an account. If you also want your projects and posts on **every device** — the Mac app, the Windows app and the browser version — under **one login**, connect Inkwell to a free [Supabase](https://supabase.com) project that **you own**. Your writing goes to your own database, not to anyone else's server.

**Cost:** $0. At the time of writing, Supabase's free plan includes 500 MB of database storage (thousands of posts) and 50,000 monthly users.
**One thing to know:** free Supabase projects are *paused after 7 days with no activity*. If you take a long break, open your Supabase dashboard and press **Restore** — nothing is lost, and Inkwell keeps working offline in the meantime and catches up afterwards.

## 1. Create the project
1. Sign up at **[supabase.com/dashboard](https://supabase.com/dashboard)** (GitHub or email login).
2. Click **New project**. Pick any name (e.g. `inkwell`), set a database password (you won't need it in Inkwell), choose a region near you, and keep the **Free** plan.
3. Wait about a minute for it to start.

## 2. Create the sync table
1. In the project, open **SQL Editor → New query**.
2. In Inkwell, open **Settings → Sync across devices → Set up** and press **Copy SQL** (or copy the script below).
3. Paste it into the SQL editor and press **Run**. You should see "Success. No rows returned".

<details><summary>The setup SQL</summary>

```sql
create table if not exists public.inkwell_records (
  user_id    uuid    not null default auth.uid() references auth.users(id) on delete cascade,
  store      text    not null,
  id         text    not null,
  data       jsonb,
  updated_at bigint  not null,
  deleted    boolean not null default false,
  synced_at  bigint  not null default 0,
  primary key (user_id, store, id)
);
create index if not exists inkwell_records_cursor on public.inkwell_records (user_id, synced_at);
alter table public.inkwell_records enable row level security;
drop policy if exists "own rows" on public.inkwell_records;
create policy "own rows" on public.inkwell_records for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create or replace function public.inkwell_records_touch() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old; -- never let an older edit overwrite a newer one
  end if;
  new.synced_at := (extract(epoch from clock_timestamp()) * 1000)::bigint;
  return new;
end $$;
drop trigger if exists inkwell_records_touch on public.inkwell_records;
create trigger inkwell_records_touch before insert or update on public.inkwell_records
  for each row execute function public.inkwell_records_touch();
```
</details>

The **row-level security policy** means each login can only ever read and write its own rows.

## 3. Connect Inkwell
1. In Supabase open **Project Settings → API** (or **Connect**). Copy the **Project URL** and the **anon / publishable key**. (Never use the `service_role` / secret key.)
   The URL should be just `https://<your-project>.supabase.co`. If you copy one ending in `/rest/v1/`, Inkwell trims it for you.
2. In Inkwell: **Settings → Sync across devices → Set up**, paste both, press **Continue**.
3. Press **Create account**, using your email and a password.
   Supabase sends a confirmation email by default — click the link, then come back and press **Sign in**.
   *(Optional: to skip the email step, in Supabase go to **Authentication → Sign In / Providers → Email** and turn off "Confirm email".)*

## 4. Add your other devices
On the first device: **Settings → Sync → Manage → Copy setup code**. On each other device (Mac app, Windows app or browser): **Set up sync → paste the code → Continue → Sign in** with the same email and password.

When a device that already has posts signs in, Inkwell asks whether to **merge** them with your account or **use your account's posts only**.

## How it behaves
- **Offline first.** Everything saves locally instantly. Sync runs in the background a few seconds after you stop typing, every minute, and when you come back online.
- **Conflicts:** each post is compared individually and the most recent edit wins — so avoid editing the *same* post on two devices while one is offline.
- **What syncs:** projects, posts (including images, covers and tags) and writing stats. Version history and app settings (theme, fonts) stay per device.
- The sidebar footer shows the status: *Synced · 2m ago*, *Syncing…*, *Offline · will sync later*, or *Sync problem* (click it for details).
