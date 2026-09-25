import { describe, it, expect } from 'vitest';
import {
  validateAndSanitizeTask,
  validateAndSanitizeProject,
  validateAndSanitizeWorkflow,
  validateAndSanitizeImportData
} from './data-validator.util';

describe('DataValidatorUtil Runtime Type Protection', () => {
  describe('validateAndSanitizeTask', () => {
    it('should sanitize corrupt task with non-string fields and invalid types', () => {
      const corruptTask = {
        id: 12345, // number instead of string
        title: null, // null title
        status: { name: 'Invalid' }, // object instead of string
        completed: 'true', // string instead of boolean
        priority: 'SUPER_URGENT', // invalid enum
        labels: 'bug,frontend', // string instead of array
        estimated_hours: '4.5', // string instead of number
        created_at: 'invalid-date' // invalid date
      };

      const result = validateAndSanitizeTask(corruptTask);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('12345');
      expect(result?.title).toBe('Untitled Task');
      expect(result?.status).toBe('Backlog');
      expect(result?.completed).toBe(true);
      expect(result?.priority).toBe('medium');
      expect(result?.labels).toEqual(['bug', 'frontend']);
      expect(result?.estimated_hours).toBe(4.5);
      expect(typeof result?.created_at).toBe('string');
    });

    it('should return null for non-object task inputs', () => {
      expect(validateAndSanitizeTask(null)).toBeNull();
      expect(validateAndSanitizeTask(123)).toBeNull();
      expect(validateAndSanitizeTask('not a task')).toBeNull();
    });
  });

  describe('validateAndSanitizeProject', () => {
    it('should sanitize project with corrupt color and missing name', () => {
      const corruptProj = {
        id: 'proj-123',
        name: null,
        color: 'invalid-red'
      };

      const result = validateAndSanitizeProject(corruptProj);
      expect(result).not.toBeNull();
      expect(result?.name).toBe('Untitled Project');
      expect(result?.color).toBe('#3b82f6'); // Fallback default hex color
    });
  });

  describe('validateAndSanitizeWorkflow', () => {
    it('should sanitize workflow with invalid position and transition array', () => {
      const corruptWorkflow = {
        id: 'wf-1',
        project_id: 'proj-1',
        name: 'In Review',
        color: '#a855f7',
        position: 'not-a-number',
        allowed_transitions: ['wf-todo', 123, null]
      };

      const result = validateAndSanitizeWorkflow(corruptWorkflow);
      expect(result).not.toBeNull();
      expect(result?.position).toBe(0);
      expect(result?.allowed_transitions).toEqual(['wf-todo']);
    });
  });

  describe('validateAndSanitizeImportData', () => {
    it('should gracefully handle invalid JSON syntax without crashing', () => {
      const res = validateAndSanitizeImportData('{ invalid json payload }');
      expect(res.tasks).toEqual([]);
      expect(res.errors.length).toBeGreaterThan(0);
      expect(res.errors[0]).toContain('Invalid JSON format');
    });

    it('should parse and sanitize structured import payloads with mixed corrupt items', () => {
      const payload = {
        tasks: [
          { id: 't1', title: 'Valid Task', status: 'To Do' },
          { id: 99, title: 404, status: null } // Corrupt item
        ],
        projects: [
          { id: 'p1', name: 'Valid Project', color: '#22c55e' }
        ]
      };

      const res = validateAndSanitizeImportData(payload);
      expect(res.tasks.length).toBe(2);
      expect(res.tasks[0].title).toBe('Valid Task');
      expect(res.tasks[1].title).toBe('404');
      expect(res.projects.length).toBe(1);
      expect(res.errors.length).toBe(0);
    });
  });
});
