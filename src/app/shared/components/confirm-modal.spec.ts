import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfirmModalComponent } from './confirm-modal';

describe('ConfirmModalComponent', () => {
  let component: ConfirmModalComponent;

  beforeEach(() => {
    component = new ConfirmModalComponent();
  });

  it('should initialize with default inputs', () => {
    expect(component.isOpen).toBe(false);
    expect(component.title).toBe('Confirm Action');
    expect(component.message).toBe('Are you sure you want to proceed?');
    expect(component.confirmText).toBe('Confirm');
    expect(component.cancelText).toBe('Cancel');
    expect(component.type).toBe('warning');
  });

  it('should emit confirm event when onConfirm() is called', () => {
    const spy = vi.fn();
    component.confirm.subscribe(spy);

    component.onConfirm();

    expect(spy).toHaveBeenCalled();
  });

  it('should emit cancel event when onCancel() is called', () => {
    const spy = vi.fn();
    component.cancel.subscribe(spy);

    component.onCancel();

    expect(spy).toHaveBeenCalled();
  });
});
