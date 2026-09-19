-- Supabase Migration: Enable Auth, Project Membership & RLS Policies

-- 1. Create project_members table
create table if not exists public.project_members (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    role text not null check (role in ('owner', 'admin', 'member', 'viewer')) default 'member',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique (project_id, user_id)
);

-- Ensure user_id columns exist on related tables if missing
alter table public.projects add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.workflows add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.task_comments add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.ideas add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Create project_activities table if missing
create table if not exists public.project_activities (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade,
    action text not null,
    description text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table public.project_activities add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Create task_status_history table if missing
create table if not exists public.task_status_history (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade,
    from_status text,
    to_status text not null,
    changed_by text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create ideas table if missing
create table if not exists public.ideas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    description text,
    tags text[] default '{}',
    status text not null default 'inbox',
    converted_id uuid,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Helper Security Functions (Overloaded for both text & uuid type columns)
create or replace function public.is_project_member(p_id text, u_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.projects where id::text = p_id and user_id = u_id
    union
    select 1 from public.project_members where project_id::text = p_id and user_id = u_id
  );
$$;

create or replace function public.is_project_member(p_id uuid, u_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.projects where id = p_id and user_id = u_id
    union
    select 1 from public.project_members where project_id = p_id and user_id = u_id
  );
$$;

create or replace function public.is_project_owner(p_id text, u_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.projects where id::text = p_id and user_id = u_id
    union
    select 1 from public.project_members where project_id::text = p_id and user_id = u_id and role = 'owner'
  );
$$;

create or replace function public.is_project_owner(p_id uuid, u_id uuid)
returns boolean
language sql
security definer
as $$
  select exists (
    select 1 from public.projects where id = p_id and user_id = u_id
    union
    select 1 from public.project_members where project_id = p_id and user_id = u_id and role = 'owner'
  );
$$;

-- 3. Migration Procedure for Legacy Unassigned Data
create or replace function public.migrate_unassigned_data_to_user(target_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Ensure user_id columns exist dynamically
  execute 'alter table public.projects add column if not exists user_id uuid references auth.users(id) on delete cascade';
  execute 'alter table public.workflows add column if not exists user_id uuid references auth.users(id) on delete cascade';
  execute 'alter table public.tasks add column if not exists user_id uuid references auth.users(id) on delete cascade';
  execute 'alter table public.task_comments add column if not exists user_id uuid references auth.users(id) on delete cascade';
  execute 'alter table public.project_activities add column if not exists user_id uuid references auth.users(id) on delete cascade';
  execute 'alter table public.ideas add column if not exists user_id uuid references auth.users(id) on delete cascade';

  -- Assign projects where user_id is null
  update public.projects
  set user_id = target_user_id
  where user_id is null;

  -- Insert owner record in project_members for projects owned by target_user_id
  insert into public.project_members (project_id, user_id, role)
  select id, target_user_id, 'owner'
  from public.projects
  where user_id = target_user_id
  on conflict (project_id, user_id) do update set role = 'owner';

  -- Assign workflows where user_id is null
  update public.workflows
  set user_id = target_user_id
  where user_id is null;

  -- Assign tasks where user_id is null
  update public.tasks
  set user_id = target_user_id
  where user_id is null;

  -- Assign task_comments where user_id is null
  update public.task_comments
  set user_id = target_user_id
  where user_id is null;

  -- Assign project_activities where user_id is null
  update public.project_activities
  set user_id = target_user_id
  where user_id is null;

  -- Assign ideas where user_id is null
  update public.ideas
  set user_id = target_user_id
  where user_id is null;
end;
$$;

-- Grant execution permission for the migration function
grant execute on function public.migrate_unassigned_data_to_user(uuid) to authenticated, anon, service_role;

-- 4. Enable Row Level Security (RLS) on all tables
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.workflows enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.task_status_history enable row level security;
alter table public.project_activities enable row level security;
alter table public.ideas enable row level security;

-- Drop legacy anonymous public policies if they exist
drop policy if exists "Allow public access for projects" on public.projects;
drop policy if exists "Allow public access for workflows" on public.workflows;
drop policy if exists "Allow public access for tasks" on public.tasks;
drop policy if exists "Allow public access for task_comments" on public.task_comments;
drop policy if exists "Allow public access for ideas" on public.ideas;

-- 5. RLS Policies for Projects
create policy "Users can view projects they own or belong to"
  on public.projects for select
  using (public.is_project_member(id, auth.uid()));

create policy "Users can create projects"
  on public.projects for insert
  with check (auth.uid() is not null and (user_id is null or user_id = auth.uid()));

create policy "Owners and admins can update projects"
  on public.projects for update
  using (public.is_project_member(id, auth.uid()))
  with check (public.is_project_member(id, auth.uid()));

create policy "Owners can delete projects"
  on public.projects for delete
  using (public.is_project_owner(id, auth.uid()));

-- 6. RLS Policies for Project Members
create policy "Members can view project membership"
  on public.project_members for select
  using (public.is_project_member(project_id, auth.uid()));

create policy "Owners and admins can add project members"
  on public.project_members for insert
  with check (public.is_project_member(project_id, auth.uid()));

create policy "Owners and admins can update project members"
  on public.project_members for update
  using (public.is_project_member(project_id, auth.uid()));

create policy "Owners and admins can delete project members"
  on public.project_members for delete
  using (public.is_project_member(project_id, auth.uid()));

-- 7. RLS Policies for Workflows
create policy "Members can view project workflows"
  on public.workflows for select
  using (public.is_project_member(project_id, auth.uid()));

create policy "Members can manage project workflows"
  on public.workflows for all
  using (public.is_project_member(project_id, auth.uid()))
  with check (public.is_project_member(project_id, auth.uid()));

-- 8. RLS Policies for Tasks
drop policy if exists "Members can view project tasks" on public.tasks;
drop policy if exists "Members can manage project tasks" on public.tasks;

create policy "Members can view project tasks"
  on public.tasks for select
  using (
    user_id = auth.uid() 
    or public.is_project_member(project_id, auth.uid())
  );

create policy "Members can manage project tasks"
  on public.tasks for all
  using (
    user_id = auth.uid() 
    or public.is_project_member(project_id, auth.uid())
  )
  with check (
    user_id = auth.uid() 
    or public.is_project_member(project_id, auth.uid())
  );

-- 9. RLS Policies for Task Comments
create policy "Members can view task comments"
  on public.task_comments for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "Members can insert task comments"
  on public.task_comments for insert
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "Authors or project members can delete task comments"
  on public.task_comments for delete
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

-- 10. RLS Policies for Task Status History & Project Activities
create policy "Members can view task status history"
  on public.task_status_history for select
  using (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

create policy "Members can insert task status history"
  on public.task_status_history for insert
  with check (exists (
    select 1 from public.tasks t where t.id = task_id and public.is_project_member(t.project_id, auth.uid())
  ));

drop policy if exists "Members can view project activities" on public.project_activities;
drop policy if exists "Members can insert project activities" on public.project_activities;

create policy "Members can view project activities"
  on public.project_activities for select
  using (
    user_id = auth.uid() 
    or (project_id != 'global' and public.is_project_member(project_id, auth.uid()))
  );

create policy "Members can insert project activities"
  on public.project_activities for insert
  with check (
    user_id = auth.uid() 
    or (project_id != 'global' and public.is_project_member(project_id, auth.uid()))
  );

-- 11. RLS Policies for Ideas / Inbox
create policy "Users can view their own ideas"
  on public.ideas for select
  using (user_id = auth.uid());

create policy "Users can manage their own ideas"
  on public.ideas for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- 12. Performance Indexes for Fast Query & RLS Evaluation
create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_project_id on public.tasks(project_id);
create index if not exists idx_tasks_created_at on public.tasks(created_at desc);
create index if not exists idx_tasks_user_created_at on public.tasks(user_id, created_at desc);
create index if not exists idx_projects_user_id on public.projects(user_id);
create index if not exists idx_projects_user_created_at on public.projects(user_id, created_at desc);
create index if not exists idx_project_members_proj_user on public.project_members(project_id, user_id);
create index if not exists idx_project_activities_user_id on public.project_activities(user_id, timestamp desc);
create index if not exists idx_ideas_user_id on public.ideas(user_id, created_at desc);

