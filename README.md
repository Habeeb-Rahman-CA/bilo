<p align="center">
  <img src="public/bilo-icon-dark.png" width="120" height="120" alt="Bilo Logo">
</p>

<h1 align="center">Bilo</h1>

<p align="center">
  <strong>Minimalist Project Manager & Focus Workspace</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.1-blue.svg" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green.svg" alt="License">
  <img src="https://img.shields.io/badge/offline-supported-06b6d4.svg" alt="Offline Ready">
</p>

---

## Welcome to Bilo

**Bilo** is your sleek, distraction-free workspace for managing personal projects, tracking tasks, and staying focused on what to work on next. Designed to eliminate clutter, Bilo gives you total clarity over your tasks without unnecessary steps or complicated setups.

---

## Key Workspaces

Bilo is organized into dedicated workspaces to keep your workflow clear and structured:

| Workspace | Description |
| :--- | :--- |
| **01 TODAY** | Your main focus dashboard. Highlights urgent tasks due today and items queued up for your immediate focus. |
| **02 PROJECTS** | Manage your project workspaces, set custom colors, and configure status column workflows tailored to each project. |
| **03 BACKLOG** | A clean space to capture new ideas, backlog items, and unscheduled tasks before assigning them to a release date. |
| **04 BOARD** | An interactive drag-and-drop Kanban board to move tasks seamlessly between workflow columns. |
| **05 CALENDAR** | An interactive monthly calendar. Drag unscheduled items directly onto any day to schedule their due dates. |
| **06 ARCHIVE** | View all completed work, audit activity streams, and export comprehensive, beautifully formatted Excel (`.xlsx`) workbooks. |

---

## User Guide & Quick Tips

### 1. Creating & Managing Tasks
- Click the **+ New Task** button anywhere in the application to log a new task.
- Set the task title, issue type (*Story*, *Bug*, *Task*, *Epic*), priority level, assignee, due date, and custom tags (`#label`).
- Drag and drop task cards on the **04 BOARD** view to update their progress state.

### 2. Customizing Project Workflows
- Navigate to **02 PROJECTS** and click **Configure Columns**.
- Add custom status columns (e.g. *In Review*, *Testing*, *Deployed*), change column colors, and drag to reorder columns.

### 3. Scheduling on the Calendar
- Go to **05 CALENDAR** and open the **Schedule** drawer.
- Simply drag any unscheduled task card onto a calendar date to instantly set its due date.

### 4. Exporting Reports & Excel Audits
- Open **06 ARCHIVE** and click **Export**.
- Download a styled Excel file containing separate formatted sheets for *Completed Tasks*, *All Workspace Tasks*, *Projects Summary*, and *Activity Stream*.

---

## Shortcuts & Command Palette

Bilo is designed for fast navigation without leaving your keyboard:

- **`Ctrl + K`** or **`Cmd + K`**: Open the **Command Palette** to search any task, switch workspaces, or run commands instantly.
- **`?`**: Press `?` anywhere to open the **Keyboard Shortcuts** guide modal.
- **`Esc`**: Close open modals, drawers, or command palette overlays.

---

## Use Bilo Anywhere (Offline & Mobile)

- **Offline Capable**: Bilo automatically saves your work locally when offline and synchronizes your changes when your connection returns.
- **Installable PWA**: Click *Install App* in your web browser to install Bilo as a native desktop or mobile application.

---

## Technical Documentation

For developers, contributors, and architects:
- **[Architecture Specification](file:///home/habrmnc/habrmnc/bilo/ARCHITECTURE.md)**: System architecture diagrams (Mermaid), Angular 21 SSR & Hydration lifecycle, offline sync sequences, and testing pipeline.
- **[API & Data Specification](file:///home/habrmnc/habrmnc/bilo/docs/API.md)**: Complete Angular service method signatures, Signals reactive state model, utilities reference (`getTaskKey`), and PostgreSQL Row-Level Security (RLS) schema definitions.

---

## License

Bilo is open-source software licensed under the [MIT License](LICENSE).
