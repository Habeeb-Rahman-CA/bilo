-- Fix RLS policy for project_members table to allow insertion by project owners or users adding themselves
drop policy if exists "Owners and admins can add project members" on public.project_members;

create policy "Owners and admins can add project members"
  on public.project_members for insert
  with check (
    public.is_project_member(project_id, auth.uid())
    or user_id = auth.uid()
  );
