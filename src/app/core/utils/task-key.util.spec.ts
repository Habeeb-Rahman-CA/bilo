import { describe, it, expect } from 'vitest';
import { getTaskKey } from './task-key.util';
import { Task, Project } from '../models/project.model';

describe('getTaskKey Utility', () => {
  it('should return default fallback DEV-1 when task is null or undefined', () => {
    expect(getTaskKey(null)).toBe('DEV-1');
    expect(getTaskKey(undefined)).toBe('DEV-1');
  });

  it('should return default fallback DEV-1 when task has no id', () => {
    const emptyTask = { id: '' } as Task;
    expect(getTaskKey(emptyTask)).toBe('DEV-1');
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
    expect(key).toMatch(/^DEV-\d+$/);
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

  it('should generate collision-free sequential keys (BMS-1, BMS-2) when allTasks is provided', () => {
    const projects: Project[] = [
      { id: 'p1', name: 'Bilo Management System', slug: 'bilo', status: 'active', created_at: '', updated_at: '' }
    ];
    const tasks: Task[] = [
      { id: 't-101', title: 'Task 1', project_id: 'p1', type: 'task', priority: 'high', position: 0, completed: false, created_at: '2026-01-01T10:00:00Z', updated_at: '' },
      { id: 't-102', title: 'Task 2', project_id: 'p1', type: 'task', priority: 'high', position: 1, completed: false, created_at: '2026-01-01T10:05:00Z', updated_at: '' },
      { id: 't-103', title: 'Task 3', project_id: 'p1', type: 'task', priority: 'high', position: 2, completed: false, created_at: '2026-01-01T10:10:00Z', updated_at: '' }
    ];

    expect(getTaskKey(tasks[0], projects, tasks)).toBe('BMS-1');
    expect(getTaskKey(tasks[1], projects, tasks)).toBe('BMS-2');
    expect(getTaskKey(tasks[2], projects, tasks)).toBe('BMS-3');
  });

  it('should maintain stable prefix before and after projects array loads', () => {
    const proj: Project = { id: 'p100', name: 'Bilo Management App', slug: 'bilo-management-app', status: 'active', created_at: '', updated_at: '' };
    const task: Task = {
      id: 'task-100',
      title: 'Auth fix',
      project_id: 'p100',
      type: 'task',
      priority: 'high',
      position: 0,
      completed: false,
      created_at: '',
      updated_at: ''
    };

    // Before projects finish loading (projects = undefined/empty) defaults to DEV prefix
    const keyBeforeLoad = getTaskKey(task, []);
    expect(keyBeforeLoad.startsWith('DEV-')).toBe(true);

    // After projects finish loading, uses project name/slug BMA prefix
    const keyAfterLoad = getTaskKey(task, [proj]);
    expect(keyAfterLoad.startsWith('BMS-') || keyAfterLoad.startsWith('BMA-')).toBe(true);
  });
});
