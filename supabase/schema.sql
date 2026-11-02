-- M2D website CMS: run this whole file once in Supabase (SQL Editor > New query > paste > Run).
-- Safe to run again: it only adds what is missing and refreshes the security rules.
--
-- Roles
--   owner   everything, including team accounts
--   editor  pages, portfolio, blog, photos and contact details
--   writer  blog and photos only (for an SEO writer)

-- 1. Team ---------------------------------------------------------------------------------
create table if not exists cms_users (
  email text primary key,
  name  text,
  role  text not null default 'writer' check (role in ('owner', 'editor', 'writer')),
  added_at timestamptz default now()
);

-- the owner account. CHANGE THIS EMAIL to the one Benjamin will sign in with, then create the same
-- email under Authentication > Users > Add user (tick "Auto Confirm User").
insert into cms_users (email, name, role) values ('enquire@m2decor.com.sg', 'Benjamin Toh', 'owner')
on conflict (email) do update set role = 'owner';

create or replace function cms_role() returns text
language sql stable security definer set search_path = public as $$
  select role from cms_users where lower(email) = lower(auth.email());
$$;
create or replace function cms_is_member() returns boolean
language sql stable security definer set search_path = public as $$ select cms_role() is not null; $$;
create or replace function cms_can_pages() returns boolean
language sql stable security definer set search_path = public as $$ select cms_role() in ('owner', 'editor'); $$;
create or replace function cms_is_owner() returns boolean
language sql stable security definer set search_path = public as $$ select cms_role() = 'owner'; $$;

-- 2. Content --------------------------------------------------------------------------------
-- page words, page photos, contact details and the lists on the pages (one row per part, e.g. "copy", "team")
create table if not exists cms_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz default now(),
  updated_by text
);

-- portfolio projects; `sort` is the order on the Portfolio page
create table if not exists cms_projects (
  slug text primary key,
  data jsonb not null default '{}',
  enabled boolean not null default true,
  sort int not null default 1000,
  updated_at timestamptz default now(),
  updated_by text
);

-- blog posts; a published post with a future date waits until that day
create table if not exists cms_posts (
  slug text primary key,
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  published date default current_date,
  data jsonb not null default '{}',
  updated_at timestamptz default now(),
  updated_by text
);
create index if not exists cms_posts_published on cms_posts (published desc);

-- every save keeps the previous version
create table if not exists cms_revisions (
  id bigint generated always as identity primary key,
  kind text not null,          -- content | project | post
  ref text not null,           -- settings key, project slug or post slug
  data jsonb not null,
  saved_at timestamptz default now(),
  saved_by text
);
create index if not exists cms_revisions_ref on cms_revisions (kind, ref, saved_at desc);

create table if not exists cms_media (
  id uuid primary key default gen_random_uuid(),
  path text not null unique,
  url text not null,
  thumb_url text,
  kind text default 'image',
  alt text,
  width int,
  height int,
  bytes int,
  created_at timestamptz default now(),
  created_by text
);

create table if not exists cms_publishes (
  id bigint generated always as identity primary key,
  requested_by text,
  requested_at timestamptz default now(),
  status text default 'queued',
  note text
);

-- 3. Security: only signed-in team members, and only what their role allows -------------------
alter table cms_users     enable row level security;
alter table cms_settings  enable row level security;
alter table cms_projects  enable row level security;
alter table cms_posts     enable row level security;
alter table cms_revisions enable row level security;
alter table cms_media     enable row level security;
alter table cms_publishes enable row level security;

do $$
declare r record;
begin
  for r in select policyname, tablename from pg_policies where schemaname = 'public' and tablename like 'cms_%' loop
    execute format('drop policy if exists %I on %I', r.policyname, r.tablename);
  end loop;
end $$;

create policy "own row" on cms_users for select to authenticated using (lower(email) = lower(auth.email()) or cms_is_owner());
create policy "owner manages team" on cms_users for all to authenticated using (cms_is_owner()) with check (cms_is_owner());
-- everyone on the team can read everything; writers only change blog posts and photos
create policy "team reads settings" on cms_settings for select to authenticated using (cms_is_member());
create policy "editors write settings" on cms_settings for all to authenticated using (cms_can_pages()) with check (cms_can_pages());
create policy "team reads projects" on cms_projects for select to authenticated using (cms_is_member());
create policy "editors write projects" on cms_projects for all to authenticated using (cms_can_pages()) with check (cms_can_pages());
create policy "team posts" on cms_posts for all to authenticated using (cms_is_member()) with check (cms_is_member());
create policy "team media" on cms_media for all to authenticated using (cms_is_member()) with check (cms_is_member());
create policy "team revisions" on cms_revisions for all to authenticated using (cms_is_member()) with check (cms_is_member());
create policy "team publishes" on cms_publishes for select to authenticated using (cms_is_member());

-- 4. Photos and videos: a public bucket called "media" (50 MB per file) ------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'])
on conflict (id) do update set public = true, file_size_limit = 52428800, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4'];
drop policy if exists "m2d public read media" on storage.objects;
create policy "m2d public read media" on storage.objects for select using (bucket_id = 'media');
drop policy if exists "m2d team adds media" on storage.objects;
create policy "m2d team adds media" on storage.objects for insert to authenticated with check (bucket_id = 'media' and cms_is_member());
drop policy if exists "m2d team updates media" on storage.objects;
create policy "m2d team updates media" on storage.objects for update to authenticated using (bucket_id = 'media' and cms_is_member());
drop policy if exists "m2d team removes media" on storage.objects;
create policy "m2d team removes media" on storage.objects for delete to authenticated using (bucket_id = 'media' and cms_is_member());

-- 5. Keep updated_at fresh ------------------------------------------------------------------
create or replace function cms_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
do $$
declare t text;
begin
  foreach t in array array['cms_settings', 'cms_projects', 'cms_posts'] loop
    execute format('drop trigger if exists touch on %I', t);
    execute format('create trigger touch before update on %I for each row execute function cms_touch()', t);
  end loop;
end $$;
