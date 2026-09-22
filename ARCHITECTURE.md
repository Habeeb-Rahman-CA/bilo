# bilo - Technical Architecture Specification

## 1. Executive Overview

**bilo** is a personal, minimalist project management application designed specifically for solo developers building and maintaining multiple software projects. It answers the core question: **"What should I work on next?"** without the bloat of enterprise tools.

---

## 2. Product Principles & Architecture Goals

1. **Minimalist & Fast**: Sub-second UI interactions, streamlined data models, keyboard-driven navigation.
2. **Developer-First Data Model**: Built-in support for code repos, technical notes, bug reports, and task stories.
3. **Personal-First Isolation**: No multi-tenant permissions overhead; simple single-user auth with strict PostgreSQL Row-Level Security (RLS).
4. **Anywhere Access**: Responsive layout + Progressive Web App (PWA) with offline support.
5. **Zero Infrastructure Management**: Jamstack architecture using Vercel for edge hosting and Supabase for backend services.

---

## 3. High-Level Architecture Diagram

```
+-----------------------------------------------------------------------+
|                           CLIENT LAYER                                |
|  +-----------------------------------------------------------------+  |
|  |             Browser / Mobile Web App / Installed PWA            |  |
|  |  +-----------------------------------------------------------+  |  |
|  |  |                     Angular Application                   |  |  |
|  |  |  - Standalone Components & Router Guards                   |  |  |
|  |  |  - Angular Signals (State Management)                     |  |  |
|  |  |  - Service Worker (Offline Cache & PWA Manifest)          |  |  |
|  |  +-----------------------------+-----------------------------+  |  |
|  +--------------------------------|--------------------------------+  |
+-----------------------------------|-----------------------------------+
                                    | HTTPS / WebSockets
                                    v
+-----------------------------------------------------------------------+
|                           BACKEND & DATA LAYER                        |
|  +-----------------------------------------------------------------+  |
|  |                          Supabase BaaS                          |  |
|  |  +---------------------+   +---------------------------------+  |  |
|  |  |    Supabase Auth    |   |     PostgreSQL DB with RLS      |  |  |
|  |  | (Email Magic Links) |   | (projects, tasks, notes, etc.)  |  |  |
|  |  +---------------------+   +---------------------------------+  |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
                                    ^
                                    | Continuous Deployment (Git push)
+-----------------------------------|-----------------------------------+
|                         HOSTING & INFRASTRUCTURE                      |
|                        Vercel Global Edge Network                      |
+-----------------------------------------------------------------------+
```

---

## 4. Technology Stack Summary

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | Angular (v21+) + TypeScript | Structured, type-safe reactive SPA with standalone components & signals |
| **Styling & Theme** | Modern CSS Variables & Responsive Utilities | Lightweight, high-contrast developer theme (Dark/Light) |
| **Backend & Auth** | Supabase (BaaS) | Managed REST/Realtime API and Supabase Auth |
| **Database** | PostgreSQL | Relational storage with Row-Level Security (RLS) policies |
| **App Delivery** | PWA (Service Worker + Manifest) | Fast loading on desktop & mobile with offline resilience |
| **Hosting & CI/CD** | Vercel + GitHub Integration | Automated static build deployment at the edge |

---

## 5. Database Schema & Security (PostgreSQL + Supabase)

### 5.1 Tables Definition
```sql
-- 1. Projects Table
create table public.projects (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references auth.users(id) on delete cascade not null,
    name text not null,
    slug text not null,
    description text,
    repository_url text,
    status text not null default 'active', -- 'active', 'archived', 'completed'
    color text default '#3b82f6',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Workflows Table (Custom Board Columns per Project)
create table public.workflows (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade not null,
    name text not null,
    position integer not null default 0,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Tasks Table
create table public.tasks (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade not null,
    workflow_id uuid references public.workflows(id) on delete set null,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    description text,
    type text not null default 'task', -- 'task', 'bug', 'story', 'note'
    priority text not null default 'medium', -- 'low', 'medium', 'high', 'urgent'
    labels text[],
    attachments text[], -- Array of image/attachment URLs
    due_date date,
    position integer not null default 0,
    is_next boolean default false, -- Dynamic "What to work on next" queue flag
    completed boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tech Notes Table
create table public.tech_notes (
    id uuid primary key default uuid_generate_v4(),
    project_id uuid references public.projects(id) on delete cascade not null,
    user_id uuid references auth.users(id) on delete cascade not null,
    title text not null,
    content text not null,
    tags text[],
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
```

### 5.2 Row Level Security Policies
Row Level Security ensures that every developer can only read and write their own data:
```sql
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.tech_notes enable row level security;

create policy "Individual user access" 
    on public.projects for all 
    using (auth.uid() = user_id) 
    with check (auth.uid() = user_id);
```

---

## 6. Angular Application Structure

```
src/
├── app/
│   ├── core/
│   │   ├── guards/          # Auth & route protection guards
│   │   ├── models/          # TypeScript interfaces (Project, Task, etc.)
│   │   └── services/        # Supabase, Auth, and State Signal services
│   ├── features/
│   │   ├── dashboard/       # "What should I work on next?" central view
│   │   ├── projects/        # Project creation & board views
│   │   ├── tasks/           # Task creation modal & quick capture
│   │   └── tech-notes/      # Developer notes & markdown viewer
│   ├── shared/
│   │   ├── components/      # UI buttons, status badges, modal wrappers
│   │   └── pipes/           # Date & markdown formatting
│   ├── app.config.ts        # Routes and global provider configuration
│   └── app.ts               # Shell root component
├── assets/                  # Icons, PWA manifests, images
└── styles.css               # Global theme tokens and responsive utility classes
```

---

## 7. Progressive Web App (PWA) & Offline Strategy

1. **Manifest File (`public/manifest.webmanifest`)**:
   - Short Name: `bilo`
   - Start URL: `/`
   - Theme Color: `#0f172a`
   - Display: `standalone`
2. **Service Worker Caching Strategy**:
   - **Network First** for API dynamic requests (Supabase queries).
   - **Cache First** for static assets (HTML, JS, CSS, Web Fonts).

---

## 8. Deployment Architecture (Vercel)

- **Build Output Directory**: `dist/bilo/browser`
- **Build Command**: `npm run build`
- **Single Page Application Fallback**: SPA rewrite rules configured in `vercel.json` (`/(.*)` -> `/index.html`).
- **Environment Variables**:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
