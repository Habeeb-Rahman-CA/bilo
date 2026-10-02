import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerModal,
  unregisterModal,
  isTopModal,
  getModalZIndex,
  getActiveModalCount,
  resetModalStack
} from './modal-stack.util';

describe('ModalStackUtil', () => {
  beforeEach(() => {
    resetModalStack();
  });

  it('should register modal and return incremented z-index', () => {
    const z1 = registerModal('modal-1');
    expect(z1).toBe(2020);
    expect(getActiveModalCount()).toBe(1);

    const z2 = registerModal('modal-2');
    expect(z2).toBe(2040);
    expect(getActiveModalCount()).toBe(2);
  });

  it('should identify the topmost modal in stack', () => {
    registerModal('modal-1');
    registerModal('modal-2');

    expect(isTopModal('modal-2')).toBe(true);
    expect(isTopModal('modal-1')).toBe(false);
  });

  it('should update z-index and stack when unregistering modals', () => {
    registerModal('modal-1');
    registerModal('modal-2');
    registerModal('modal-3');

    expect(isTopModal('modal-3')).toBe(true);

    unregisterModal('modal-3');
    expect(getActiveModalCount()).toBe(2);
    expect(isTopModal('modal-2')).toBe(true);
    expect(isTopModal('modal-1')).toBe(false);
  });

  it('should re-promote existing modal to top of stack if registered again', () => {
    registerModal('modal-1');
    registerModal('modal-2');
    const z1 = registerModal('modal-1');

    expect(z1).toBe(2040);
    expect(isTopModal('modal-1')).toBe(true);
    expect(getActiveModalCount()).toBe(2);
  });
});
