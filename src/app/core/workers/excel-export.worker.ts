import * as XLSX from 'xlsx-js-style';

export interface ExportWorkerTaskData {
  id: string;
  taskKey: string;
  title: string;
  type?: string;
  priority?: string;
  status: string;
  completed: boolean;
  projectName: string;
  assignee?: string;
  dueDate?: string | null;
  createdAt?: string | null;
}

export interface ExportWorkerProjectData {
  id: string;
  key: string;
  name: string;
  description?: string;
  status?: string;
  totalTasks: number;
  completedTasks: number;
  progressPct: string;
}

export interface ExportWorkerActivityData {
  action: string;
  description: string;
  timestamp: string;
}

export interface ExportWorkerPayload {
  completedTasks: ExportWorkerTaskData[];
  allTasks: ExportWorkerTaskData[];
  projects: ExportWorkerProjectData[];
  activities: ExportWorkerActivityData[];
}

export type ExportWorkerMessage =
  | { type: 'progress'; progress: number; stepMessage: string }
  | { type: 'complete'; buffer: ArrayBuffer }
  | { type: 'error'; error: string };

function parseExcelDate(dateStr?: string | null): Date | string {
  if (!dateStr || dateStr.trim() === '') return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d;
}

function createStyledSheet(
  headers: string[],
  descriptions: string[],
  dataRows: (string | number | Date)[][]
): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  // 1. Header Row
  headers.forEach((h, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    ws[cellRef] = {
      v: h,
      t: 's',
      s: {
        font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
        fill: { fgColor: { rgb: '1C1917' } },
        alignment: { vertical: 'center', horizontal: 'left' }
      }
    };
  });

  // 2. Field Description Row
  descriptions.forEach((desc, colIdx) => {
    const cellRef = XLSX.utils.encode_cell({ r: 1, c: colIdx });
    ws[cellRef] = {
      v: desc,
      t: 's',
      s: {
        font: { italic: true, color: { rgb: '78716C' }, sz: 9, name: 'Calibri' },
        fill: { fgColor: { rgb: 'F3F0E6' } },
        alignment: { vertical: 'center', horizontal: 'left' }
      }
    };
  });

  // 3. Data Rows
  dataRows.forEach((row, rowIdx) => {
    row.forEach((val, colIdx) => {
      const cellRef = XLSX.utils.encode_cell({ r: rowIdx + 2, c: colIdx });
      const isNum = typeof val === 'number';
      const isDateObj = val instanceof Date && !isNaN(val.getTime());

      if (isDateObj) {
        const hasTime = val.getHours() !== 0 || val.getMinutes() !== 0 || val.getSeconds() !== 0;
        const dateFormat = hasTime ? 'yyyy-mm-dd hh:mm' : 'yyyy-mm-dd';
        ws[cellRef] = {
          v: val,
          t: 'd',
          z: dateFormat,
          s: {
            numFmt: dateFormat,
            font: { sz: 10, name: 'Calibri', color: { rgb: '1C1917' } },
            alignment: { vertical: 'center', horizontal: 'left' }
          }
        };
      } else {
        ws[cellRef] = {
          v: val ?? '',
          t: isNum ? 'n' : 's',
          s: {
            font: { sz: 10, name: 'Calibri', color: { rgb: '1C1917' } },
            alignment: { vertical: 'center', horizontal: isNum ? 'right' : 'left' }
          }
        };
      }
    });
  });

  // Range bounds definition
  const totalRows = dataRows.length + 2;
  const totalCols = headers.length;
  ws['!ref'] = XLSX.utils.encode_range(
    { r: 0, c: 0 },
    { r: Math.max(totalRows - 1, 1), c: totalCols - 1 }
  );

  // Auto Column Widths calculation
  ws['!cols'] = headers.map((h, colIdx) => {
    let maxLen = Math.max(h.length, (descriptions[colIdx] || '').length);
    dataRows.forEach(r => {
      const cellVal = r[colIdx];
      const str = cellVal instanceof Date ? cellVal.toISOString().slice(0, 10) : String(cellVal ?? '');
      if (str.length > maxLen) maxLen = str.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 15), 55) };
  });

  return ws;
}

addEventListener('message', ({ data }: { data: ExportWorkerPayload }) => {
  try {
    (self as any).postMessage({ type: 'progress', progress: 10, stepMessage: 'Formatting Completed Tasks in Web Worker...' });

    const wb = XLSX.utils.book_new();

    // 1. Sheet: Completed Tasks
    const completedHeaders = ['Task ID', 'Title / Summary', 'Issue Type', 'Priority', 'Status', 'Project Name', 'Assignee', 'Due Date', 'Created Date'];
    const completedDescriptions = [
      'Unique task identifier code',
      'Brief summary title of completed work',
      'Work category (Task, Bug, Story, Epic)',
      'Urgency priority level',
      'Completion status state',
      'Parent workspace project',
      'Assigned team member',
      'Target due date (YYYY-MM-DD)',
      'Timestamp when task was logged'
    ];

    const completedRows: (string | number | Date)[][] = (data.completedTasks || []).map(t => [
      t.taskKey,
      t.title,
      (t.type || 'task').toUpperCase(),
      (t.priority || 'medium').toUpperCase(),
      'COMPLETED',
      t.projectName,
      t.assignee || 'Unassigned',
      parseExcelDate(t.dueDate),
      parseExcelDate(t.createdAt)
    ]);

    const completedWs = createStyledSheet(completedHeaders, completedDescriptions, completedRows);
    XLSX.utils.book_append_sheet(wb, completedWs, 'Completed Tasks');

    (self as any).postMessage({ type: 'progress', progress: 40, stepMessage: 'Formatting All Workspace Tasks in Web Worker...' });

    // 2. Sheet: All Workspace Tasks
    const allHeaders = ['Task ID', 'Title / Summary', 'Issue Type', 'Priority', 'Status', 'Completed', 'Project Name', 'Assignee', 'Due Date', 'Created Date'];
    const allDescriptions = [
      'Unique task identifier code',
      'Brief summary title of work item',
      'Work category (Task, Bug, Story, Epic)',
      'Urgency priority level',
      'Current workflow state (Todo, In Progress, Done)',
      'Completion status indicator (YES/NO)',
      'Parent workspace project',
      'Assigned team member',
      'Target due date (YYYY-MM-DD)',
      'Timestamp when task was logged'
    ];

    const allTaskRows: (string | number | Date)[][] = (data.allTasks || []).map(t => [
      t.taskKey,
      t.title,
      (t.type || 'task').toUpperCase(),
      (t.priority || 'medium').toUpperCase(),
      t.status.toUpperCase(),
      t.completed ? 'YES' : 'NO',
      t.projectName,
      t.assignee || 'Unassigned',
      parseExcelDate(t.dueDate),
      parseExcelDate(t.createdAt)
    ]);

    const allTasksWs = createStyledSheet(allHeaders, allDescriptions, allTaskRows);
    XLSX.utils.book_append_sheet(wb, allTasksWs, 'All Tasks');

    (self as any).postMessage({ type: 'progress', progress: 70, stepMessage: 'Formatting Projects & Activity Log in Web Worker...' });

    // 3. Sheet: Projects Summary
    const projectHeaders = ['Project Key', 'Project Name', 'Description', 'Status', 'Total Tasks', 'Completed Tasks', 'Progress (%)'];
    const projectDescriptions = [
      'Unique project code identifier',
      'Name of workspace project',
      'Project overview and objectives',
      'Lifecycle status (Active, Completed)',
      'Total count of assigned tasks',
      'Count of finished tasks',
      'Calculated completion percentage'
    ];

    const projectRows = (data.projects || []).map(p => [
      p.key,
      p.name,
      p.description || '',
      (p.status || 'active').toUpperCase(),
      p.totalTasks,
      p.completedTasks,
      p.progressPct
    ]);

    const projectsWs = createStyledSheet(projectHeaders, projectDescriptions, projectRows);
    XLSX.utils.book_append_sheet(wb, projectsWs, 'Projects Summary');

    // 4. Sheet: Activity Log Stream
    const activityHeaders = ['Action', 'Description', 'Timestamp'];
    const activityDescriptions = [
      'Operation type (Created, Updated, Deleted)',
      'Detailed log event description',
      'Date and time when action occurred'
    ];

    const activityRows = (data.activities || []).map(act => [
      act.action,
      act.description,
      parseExcelDate(act.timestamp)
    ]);

    const activitiesWs = createStyledSheet(activityHeaders, activityDescriptions, activityRows);
    XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activity Stream');

    (self as any).postMessage({ type: 'progress', progress: 90, stepMessage: 'Generating binary Excel Spreadsheet file in Web Worker...' });

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;

    (self as any).postMessage({ type: 'complete', buffer: wbout }, [wbout]);
  } catch (err: any) {
    (self as any).postMessage({ type: 'error', error: err?.message || 'Unknown Web Worker Export Error' });
  }
});
