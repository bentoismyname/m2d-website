-- M2D: website CMS + client portal. Paste this whole file into Supabase > SQL Editor > New query, then Run. Safe to run again.

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


-- M2D client portal: run this whole file once in Supabase (SQL Editor > New query > paste > Run),
-- after schema.sql (the website CMS). Safe to run again: it only adds what is missing and refreshes the rules.
--
-- Roles (portal_users.role)
--   admin       Benjamin: sees every project, creates staff accounts, assigns projects
--   designer    own login; sees and edits the projects assigned to them
--   supervisor  own login; ticks stages, adds photos on projects they are added to
--   client      homeowner; sees their own project read-only (matched by email)
-- The website CMS owner (cms_users.role = 'owner') is automatically a portal admin.

-- 1. People ------------------------------------------------------------------------------------
create table if not exists portal_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name  text,
  role  text not null default 'client' check (role in ('admin', 'designer', 'supervisor', 'client')),
  phone text,
  created_at timestamptz default now()
);
create unique index if not exists portal_users_email on portal_users (lower(email));

create or replace function portal_role() returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select role from portal_users where user_id = auth.uid()),
    (select case when role = 'owner' then 'admin' end from cms_users where lower(email) = lower(auth.email())),
    'client');
$$;
create or replace function portal_is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select portal_role() = 'admin'; $$;
create or replace function portal_is_staff() returns boolean
language sql stable security definer set search_path = public as $$ select portal_role() in ('admin', 'designer', 'supervisor'); $$;

-- 2. Projects --------------------------------------------------------------------------------
-- stages and checklist are kept as JSON, in the same shape the progress tracker uses, so its logic carries over unchanged.
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text default '',
  client_name text default '',
  client_email text default '',
  designer_id uuid references auth.users(id),
  designer_name text default '',
  designer_email text default '',
  staff_ids uuid[] not null default '{}',       -- supervisors and other staff who may update this project
  stages jsonb not null default '[]',
  checklist jsonb not null default '[]',
  status text not null default 'active' check (status in ('active', 'completed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  updated_by text
);
create index if not exists projects_client_email on projects (lower(client_email));
create index if not exists projects_designer on projects (designer_id);

-- who may see / change a project
create or replace function portal_can_view(p projects) returns boolean
language sql stable security definer set search_path = public as $$
  select portal_is_admin()
      or p.designer_id = auth.uid()
      or auth.uid() = any(p.staff_ids)
      or lower(p.client_email) = lower(auth.email());
$$;
create or replace function portal_can_edit(p projects) returns boolean
language sql stable security definer set search_path = public as $$
  select portal_is_admin()
      or (portal_is_staff() and (p.designer_id = auth.uid() or auth.uid() = any(p.staff_ids)));
$$;

-- 3. Photos (one row per site photo; the file lives in the project-photos bucket) ------------------
create table if not exists project_photos (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  stage_id text not null,
  path text not null,
  created_at timestamptz default now(),
  created_by text
);
create index if not exists project_photos_project on project_photos (project_id);

-- 4. Security rules ---------------------------------------------------------------------------
alter table portal_users enable row level security;
alter table projects enable row level security;
alter table project_photos enable row level security;

drop policy if exists "own profile" on portal_users;
drop policy if exists "staff see staff" on portal_users;
drop policy if exists "admin manages people" on portal_users;
create policy "own profile" on portal_users for select to authenticated using (user_id = auth.uid());
create policy "staff see staff" on portal_users for select to authenticated using (portal_is_staff() and role <> 'client');
create policy "admin manages people" on portal_users for all to authenticated using (portal_is_admin()) with check (portal_is_admin());

drop policy if exists "view own projects" on projects;
drop policy if exists "staff create projects" on projects;
drop policy if exists "edit own projects" on projects;
drop policy if exists "admin deletes projects" on projects;
create policy "view own projects" on projects for select to authenticated using (portal_can_view(projects));
create policy "staff create projects" on projects for insert to authenticated
  with check (portal_role() in ('admin', 'designer') and (portal_is_admin() or designer_id = auth.uid()));
create policy "edit own projects" on projects for update to authenticated using (portal_can_edit(projects)) with check (portal_can_edit(projects));
create policy "admin deletes projects" on projects for delete to authenticated using (portal_is_admin());

drop policy if exists "view project photos" on project_photos;
drop policy if exists "staff add photos" on project_photos;
drop policy if exists "staff remove photos" on project_photos;
create policy "view project photos" on project_photos for select to authenticated
  using (exists (select 1 from projects p where p.id = project_id and portal_can_view(p)));
create policy "staff add photos" on project_photos for insert to authenticated
  with check (exists (select 1 from projects p where p.id = project_id and portal_can_edit(p)));
create policy "staff remove photos" on project_photos for delete to authenticated
  using (exists (select 1 from projects p where p.id = project_id and portal_can_edit(p)));

-- 5. Photo storage: private bucket, files under <project id>/<stage>/<file>.jpg ------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('project-photos', 'project-photos', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "portal read photos" on storage.objects;
drop policy if exists "portal add photos" on storage.objects;
drop policy if exists "portal remove photos" on storage.objects;
create policy "portal read photos" on storage.objects for select to authenticated
  using (bucket_id = 'project-photos' and exists (select 1 from projects p where p.id::text = (storage.foldername(name))[1] and portal_can_view(p)));
create policy "portal add photos" on storage.objects for insert to authenticated
  with check (bucket_id = 'project-photos' and exists (select 1 from projects p where p.id::text = (storage.foldername(name))[1] and portal_can_edit(p)));
create policy "portal remove photos" on storage.objects for delete to authenticated
  using (bucket_id = 'project-photos' and exists (select 1 from projects p where p.id::text = (storage.foldername(name))[1] and portal_can_edit(p)));

-- 6. Live updates: the client's page listens for changes to its project row --------------------
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'projects') then
    alter publication supabase_realtime add table projects;
  end if;
end $$;

-- 7. Keep updated_at fresh ----------------------------------------------------------------------
create or replace function portal_touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); new.updated_by = coalesce(auth.email(), new.updated_by); return new; end $$;
drop trigger if exists projects_touch on projects;
create trigger projects_touch before update on projects for each row execute function portal_touch();
