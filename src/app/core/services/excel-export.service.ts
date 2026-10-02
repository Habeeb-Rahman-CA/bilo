import { Injectable } from '@angular/core';
import { ExportWorkerPayload, ExportWorkerMessage } from '../workers/excel-export.worker';

@Injectable({
  providedIn: 'root'
})
export class ExcelExportService {

  exportToExcel(
    payload: ExportWorkerPayload,
    onProgress?: (progress: number, stepMessage: string) => void
  ): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker(
            new URL('../workers/excel-export.worker', import.meta.url),
            { type: 'module' }
          );

          worker.onmessage = ({ data }: { data: ExportWorkerMessage }) => {
            if (data.type === 'progress') {
              if (onProgress) {
                onProgress(data.progress, data.stepMessage);
              }
            } else if (data.type === 'complete') {
              worker.terminate();
              resolve(data.buffer);
            } else if (data.type === 'error') {
              worker.terminate();
              reject(new Error(data.error));
            }
          };

          worker.onerror = (err) => {
            console.warn('[ExcelExportService] Worker script error, falling back to main-thread processing:', err);
            worker.terminate();
            this.fallbackExport(payload, onProgress).then(resolve).catch(reject);
          };

          worker.postMessage(payload);
          return;
        } catch (e) {
          console.warn('[ExcelExportService] Worker initialization failed, falling back to main-thread processing:', e);
        }
      }

      this.fallbackExport(payload, onProgress).then(resolve).catch(reject);
    });
  }

  private async fallbackExport(
    payload: ExportWorkerPayload,
    onProgress?: (progress: number, stepMessage: string) => void
  ): Promise<ArrayBuffer> {
    const XLSX = await import('xlsx-js-style');

    if (onProgress) onProgress(10, 'Formatting Completed Tasks...');

    const wb = XLSX.utils.book_new();

    // 1. Completed Tasks
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

    const completedRows = (payload.completedTasks || []).map(t => [
      t.taskKey,
      t.title,
      (t.type || 'task').toUpperCase(),
      (t.priority || 'medium').toUpperCase(),
      'COMPLETED',
      t.projectName,
      t.assignee || 'Unassigned',
      this.parseExcelDate(t.dueDate),
      this.parseExcelDate(t.createdAt)
    ]);

    const completedWs = this.createStyledSheetFallback(XLSX, completedHeaders, completedDescriptions, completedRows);
    XLSX.utils.book_append_sheet(wb, completedWs, 'Completed Tasks');

    if (onProgress) onProgress(40, 'Formatting All Workspace Tasks...');

    // 2. All Tasks
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

    const allTaskRows = (payload.allTasks || []).map(t => [
      t.taskKey,
      t.title,
      (t.type || 'task').toUpperCase(),
      (t.priority || 'medium').toUpperCase(),
      t.status.toUpperCase(),
      t.completed ? 'YES' : 'NO',
      t.projectName,
      t.assignee || 'Unassigned',
      this.parseExcelDate(t.dueDate),
      this.parseExcelDate(t.createdAt)
    ]);

    const allTasksWs = this.createStyledSheetFallback(XLSX, allHeaders, allDescriptions, allTaskRows);
    XLSX.utils.book_append_sheet(wb, allTasksWs, 'All Tasks');

    if (onProgress) onProgress(70, 'Formatting Projects & Activity Log...');

    // 3. Projects Summary
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

    const projectRows = (payload.projects || []).map(p => [
      p.key,
      p.name,
      p.description || '',
      (p.status || 'active').toUpperCase(),
      p.totalTasks,
      p.completedTasks,
      p.progressPct
    ]);

    const projectsWs = this.createStyledSheetFallback(XLSX, projectHeaders, projectDescriptions, projectRows);
    XLSX.utils.book_append_sheet(wb, projectsWs, 'Projects Summary');

    // 4. Activity Log Stream
    const activityHeaders = ['Action', 'Description', 'Timestamp'];
    const activityDescriptions = [
      'Operation type (Created, Updated, Deleted)',
      'Detailed log event description',
      'Date and time when action occurred'
    ];

    const activityRows = (payload.activities || []).map(act => [
      act.action,
      act.description,
      this.parseExcelDate(act.timestamp)
    ]);

    const activitiesWs = this.createStyledSheetFallback(XLSX, activityHeaders, activityDescriptions, activityRows);
    XLSX.utils.book_append_sheet(wb, activitiesWs, 'Activity Stream');

    if (onProgress) onProgress(90, 'Generating binary Excel Spreadsheet file...');

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    return wbout;
  }

  private parseExcelDate(dateStr?: string | null): Date | string {
    if (!dateStr || dateStr.trim() === '') return 'N/A';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d;
  }

  private createStyledSheetFallback(
    XLSX: any,
    headers: string[],
    descriptions: string[],
    dataRows: (string | number | Date)[][]
  ): any {
    const ws: any = {};

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

    const totalRows = dataRows.length + 2;
    const totalCols = headers.length;
    ws['!ref'] = XLSX.utils.encode_range(
      { r: 0, c: 0 },
      { r: Math.max(totalRows - 1, 1), c: totalCols - 1 }
    );

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
}
