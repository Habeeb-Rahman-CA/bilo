-- bilo Personal Project Manager - Supabase PostgreSQL Schema

-- 1. Projects Table
create table if not exists public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    slug text not null,
    description text,
    repository_url text,
    status text not null default 'active', -- active, archived, completed
    labels text[] default '{}',
    color text default '#06b6d4',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Workflows Table (Dedicated status columns per project)
create table if not exists public.workflows (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade,
    name text not null,
    color text default '#06b6d4',
    position integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tasks Table (Stories, Bugs, Tasks, Epics)
create table if not exists public.tasks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid references public.projects(id) on delete cascade not null,
    workflow_id uuid references public.workflows(id) on delete set null,
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    description text,
    type text not null default 'task', -- task, bug, story, epic
    status text not null default '', -- status column name or workflow_id
    priority text not null default 'medium', -- low, medium, high, urgent
    labels text[] default '{}',
    attachments text[] default '{}',
    assignee text default 'Self',
    due_date date,
    position integer not null default 0,
    is_next bool default false,
    completed boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Task Comments Table
create table if not exists public.task_comments (
    id uuid primary key default gen_random_uuid(),
    task_id uuid references public.tasks(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade,
    author_name text not null default 'Developer',
    content text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Ideas / Inbox Table
create table if not exists public.ideas (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete cascade,
    title text not null,
    description text,
    tags text[] default '{}',
    status text not null default 'inbox', -- inbox, converted_project, converted_task, archived
    converted_id uuid,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.projects enable row level security;
alter table public.workflows enable row level security;
alter table public.tasks enable row level security;
alter table public.task_comments enable row level security;
alter table public.ideas enable row level security;

-- Row Level Security Policies
create policy "Allow public access for projects" 
    on public.projects for all 
    using (true) 
    with check (true);

create policy "Allow public access for workflows" 
    on public.workflows for all 
    using (true) 
    with check (true);

create policy "Allow public access for tasks" 
    on public.tasks for all 
    using (true) 
    with check (true);

create policy "Allow public access for task_comments" 
    on public.task_comments for all 
    using (true) 
    with check (true);

create policy "Allow public access for ideas" 
    on public.ideas for all 
    using (true) 
    with check (true);

-- 6. User Profiles Table (Decoupled profile metadata)
create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.user_profiles enable row level security;

create policy "Allow public access for user_profiles"
    on public.user_profiles for all
    using (true)
    with check (true);

