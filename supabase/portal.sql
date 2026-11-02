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
