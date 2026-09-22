import { describe, it, expect } from 'vitest';
import { getTaskKey } from './task-key.util';
import { Task, Project } from '../models/project.model';

describe('getTaskKey Utility', () => {
  it('should return default fallback DEV-100 when task is null or undefined', () => {
    expect(getTaskKey(null)).toBe('DEV-100');
    expect(getTaskKey(undefined)).toBe('DEV-100');
  });

  it('should return default fallback DEV-100 when task has no id', () => {
    const emptyTask = { id: '' } as Task;
    expect(getTaskKey(emptyTask)).toBe('DEV-100');
  });

  it('should default to DEV prefix when no projects are provided', () => {
    const task: Task = {
      id: 'task-uuid-1',
      title: 'Fix auth bug',
      project_id: 'proj-1',
      type: 'bug',
      priority: 'high',
      position: 0,
      completed: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const key = getTaskKey(task);
    expect(key.startsWith('DEV-')).toBe(true);
    expect(key).toMatch(/^DEV-\d{3}$/);
  });

  it('should derive prefix from multi-word project names', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Bilo Management System', slug: 'bilo', status: 'active', created_at: '', updated_at: '' }
    ];
    const task: Task = {
      id: 'task-123',
      title: 'Test',
      project_id: 'p1',
      type: 'task',
      priority: 'medium',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    };

    const key = getTaskKey(task, projects);
    // Bilo Management System -> 'B' + 'M' + 'S' = BMS
    expect(key.startsWith('BMS-')).toBe(true);
  });

  it('should derive prefix from two-word project names', () => {
    const projects: Project[] = [
      { id: 'p2', name: 'Task Tracker', slug: 'task-tracker', status: 'active', created_at: '', updated_at: '' }
    ];
    const task: Task = {
      id: 'task-456',
      title: 'Test',
      project_id: 'p2',
      type: 'task',
      priority: 'medium',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    };

    const key = getTaskKey(task, projects);
    // Task Tracker -> 'T' + 'T' + 'r' = TTR
    expect(key.startsWith('TTR-')).toBe(true);
  });

  it('should derive prefix from single-word project name', () => {
    const projects: Project[] = [
      { id: 'p3', name: 'Frontend', slug: 'frontend', status: 'active', created_at: '', updated_at: '' }
    ];
    const task: Task = {
      id: 'task-789',
      title: 'Test',
      project_id: 'p3',
      type: 'task',
      priority: 'medium',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    };

    const key = getTaskKey(task, projects);
    // Frontend -> FRO
    expect(key.startsWith('FRO-')).toBe(true);
  });

  it('should produce deterministic key numbers for identical task IDs', () => {
    const task: Task = {
      id: 'fixed-task-id-abc',
      title: 'Test',
      project_id: '',
      type: 'task',
      priority: 'medium',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    };

    const key1 = getTaskKey(task);
    const key2 = getTaskKey(task);
    expect(key1).toBe(key2);
  });
});
