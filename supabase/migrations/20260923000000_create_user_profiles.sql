-- Migration: Create user_profiles table for post-login profile metadata
-- Decouples user profile metadata from auth.users JWT bearer tokens

create table if not exists public.user_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.user_profiles enable row level security;

-- Policies for public user_profiles access
drop policy if exists "Allow authenticated read user_profiles" on public.user_profiles;
create policy "Allow authenticated read user_profiles"
    on public.user_profiles for select
    using (true);

drop policy if exists "Allow users to update own user_profiles" on public.user_profiles;
create policy "Allow users to update own user_profiles"
    on public.user_profiles for all
    using (auth.uid() = id or auth.uid() is null)
    with check (auth.uid() = id or auth.uid() is null);
