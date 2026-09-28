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

  describe('requireText validation', () => {
    beforeEach(() => {
      component.requireText = 'My Project';
    });

    it('should disable confirm when typedText does not match requireText', () => {
      component.typedText = 'Wrong Text';
      expect(component.isConfirmDisabled()).toBe(true);

      const spy = vi.fn();
      component.confirm.subscribe(spy);
      component.onConfirm();
      expect(spy).not.toHaveBeenCalled();
    });

    it('should enable confirm when typedText matches requireText case-insensitively', () => {
      component.typedText = 'my project';
      expect(component.isConfirmDisabled()).toBe(false);

      const spy = vi.fn();
      component.confirm.subscribe(spy);
      component.onConfirm();
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('Keyboard navigation & Focus Trap', () => {
    it('should emit cancel event when Escape key is pressed while open', () => {
      component.isOpen = true;
      const spy = vi.fn();
      component.cancel.subscribe(spy);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      const preventSpy = vi.spyOn(event, 'preventDefault');

      component.handleKeyDown(event);

      expect(preventSpy).toHaveBeenCalled();
      expect(spy).toHaveBeenCalled();
    });

    it('should not react to key events when modal is closed', () => {
      component.isOpen = false;
      const spy = vi.fn();
      component.cancel.subscribe(spy);

      const event = new KeyboardEvent('keydown', { key: 'Escape' });
      component.handleKeyDown(event);

      expect(spy).not.toHaveBeenCalled();
    });
  });
});
