import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ToastService();
  });

  it('should initialize with empty toast queue', () => {
    expect(service.toasts().length).toBe(0);
  });

  it('should add toast items to queue and auto-dismiss after specified duration', () => {
    service.show('First Toast', { duration: 3000 });
    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].message).toBe('First Toast');

    vi.advanceTimersByTime(3000);
    expect(service.toasts().length).toBe(0);
  });

  it('should queue multiple toasts without overwriting or dropping early toasts', () => {
    service.show('Toast 1', { duration: 5000 });
    service.show('Toast 2', { duration: 5000 });
    service.show('Toast 3', { duration: 5000 });

    expect(service.toasts().length).toBe(3);
    expect(service.toasts().map(t => t.message)).toEqual(['Toast 1', 'Toast 2', 'Toast 3']);
  });

  it('should respect maxToasts limit of 5 items', () => {
    for (let i = 1; i <= 7; i++) {
      service.show(`Toast ${i}`);
    }
    expect(service.toasts().length).toBe(5);
    expect(service.toasts()[0].message).toBe('Toast 3');
    expect(service.toasts()[4].message).toBe('Toast 7');
  });

  it('should allow manual dismissal of specific toast by ID', () => {
    const id1 = service.show('Toast A');
    const id2 = service.show('Toast B');

    expect(service.toasts().length).toBe(2);
    service.remove(id1);

    expect(service.toasts().length).toBe(1);
    expect(service.toasts()[0].id).toBe(id2);
  });

  it('should provide helper methods for success, error, warning, info', () => {
    service.success('Success message');
    service.error('Error message');
    service.warning('Warning message');
    service.info('Info message');

    expect(service.toasts().length).toBe(4);
    expect(service.toasts()[0].type).toBe('success');
    expect(service.toasts()[1].type).toBe('error');
    expect(service.toasts()[2].type).toBe('warning');
    expect(service.toasts()[3].type).toBe('info');
  });
});
