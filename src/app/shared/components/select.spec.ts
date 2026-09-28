import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SelectComponent } from './select';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let mockElementRef: any;

  beforeEach(() => {
    vi.useFakeTimers();

    mockElementRef = {
      nativeElement: document.createElement('div')
    };

    component = new SelectComponent(mockElementRef);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  describe('Enter Key Handling & Form Submission Prevention', () => {
    it('should call preventDefault and stopPropagation on trigger Enter keydown', () => {
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      const preventSpy = vi.spyOn(enterEvent, 'preventDefault');
      const stopSpy = vi.spyOn(enterEvent, 'stopPropagation');

      component.onTriggerKeydown(enterEvent);

      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should intercept Enter key on popover even when options list is empty', () => {
      component.options = [];
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      const preventSpy = vi.spyOn(enterEvent, 'preventDefault');
      const stopSpy = vi.spyOn(enterEvent, 'stopPropagation');

      component.onPopoverKeydown(enterEvent);

      expect(preventSpy).toHaveBeenCalled();
      expect(stopSpy).toHaveBeenCalled();
    });

    it('should select active option on Enter keydown when popover is open', () => {
      component.options = [
        { value: 'opt-1', label: 'Option 1' },
        { value: 'opt-2', label: 'Option 2' }
      ];

      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.onSearchChange(''); // activeIndex set to 0
      const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
      component.onPopoverKeydown(enterEvent);

      expect(component.valueSignal()).toBe('opt-1');
      expect(valueSpy).toHaveBeenCalledWith('opt-1');

      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });
  });

  describe('Click-Outside & Parent Modal Conflict Prevention', () => {
    it('should stop propagation on selectOption click event and defer popover closure', () => {
      component.options = [
        { value: 'opt-1', label: 'Option 1' }
      ];

      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.selectOption({ value: 'opt-1', label: 'Option 1' }, clickEvent);

      expect(stopSpy).toHaveBeenCalled();
      expect(component.valueSignal()).toBe('opt-1');
      expect(valueSpy).toHaveBeenCalledWith('opt-1');

      // Popover closure deferred to next tick to allow event processing
      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });

    it('should stop propagation on clearSelection click event', () => {
      component.value = 'opt-1';
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');

      component.clearSelection(clickEvent);

      expect(stopSpy).toHaveBeenCalled();
      expect(component.valueSignal()).toBe(null);

      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });

    it('should mark popover element with data-bilo-popover attribute when appended', () => {
      const mockTrigger = document.createElement('div');
      const mockPopover = document.createElement('div');
      vi.spyOn(mockTrigger, 'getBoundingClientRect').mockReturnValue({
        top: 100, left: 100, bottom: 140, right: 200, width: 100, height: 40, x: 100, y: 100, toJSON: () => {}
      });

      component.triggerEl = { nativeElement: mockTrigger } as any;
      component.popoverEl = { nativeElement: mockPopover } as any;

      component.openPopover();
      vi.advanceTimersByTime(0);

      expect(mockPopover.getAttribute('data-bilo-popover')).toBe('true');
    });
  });

  describe('Popover & Scroll Positioning Alignment', () => {
    it('should calculate triggerRect when openPopover is called', () => {
      const mockTrigger = document.createElement('div');
      vi.spyOn(mockTrigger, 'getBoundingClientRect').mockReturnValue({
        top: 100,
        left: 200,
        bottom: 140,
        right: 350,
        width: 150,
        height: 40,
        x: 200,
        y: 100,
        toJSON: () => {}
      });

      component.triggerEl = { nativeElement: mockTrigger } as any;

      component.openPopover();

      expect(component.isOpen()).toBe(true);
      expect(component.triggerRect()).toEqual({
        top: 100,
        left: 200,
        bottom: 140,
        right: 350,
        width: 150,
        height: 40
      });
    });

    it('should update triggerRect on scroll events when popover is open', () => {
      const mockTrigger = document.createElement('div');
      let currentTop = 100;

      vi.spyOn(mockTrigger, 'getBoundingClientRect').mockImplementation(() => ({
        top: currentTop,
        left: 200,
        bottom: currentTop + 40,
        right: 350,
        width: 150,
        height: 40,
        x: 200,
        y: currentTop,
        toJSON: () => {}
      }));

      component.triggerEl = { nativeElement: mockTrigger } as any;
      component.openPopover();

      // Simulate parent container scrolling downwards
      currentTop = 250;
      const scrollEvent = new Event('scroll', { bubbles: true });
      document.dispatchEvent(scrollEvent);

      expect(component.triggerRect()?.top).toBe(250);
      expect(component.isOpen()).toBe(true);
    });

    it('should auto-close popover when trigger scrolls completely out of viewport bounds', () => {
      const mockTrigger = document.createElement('div');
      let currentTop = 100;

      vi.spyOn(mockTrigger, 'getBoundingClientRect').mockImplementation(() => ({
        top: currentTop,
        left: 200,
        bottom: currentTop + 40,
        right: 350,
        width: 150,
        height: 40,
        x: 200,
        y: currentTop,
        toJSON: () => {}
      }));

      component.triggerEl = { nativeElement: mockTrigger } as any;
      component.openPopover();
      expect(component.isOpen()).toBe(true);

      // Scroll completely past top of viewport
      currentTop = -500;
      const scrollEvent = new Event('scroll', { bubbles: true });
      document.dispatchEvent(scrollEvent);

      expect(component.isOpen()).toBe(false);
    });
  });

  describe('Option Selection & Value Binding', () => {
    it('should normalize string options array to SelectOption objects', () => {
      component.options = ['Option A', 'Option B'];
      const normalized = component.normalizedOptions();

      expect(normalized.length).toBe(2);
      expect(normalized[0]).toEqual({ value: 'Option A', label: 'Option A' });
    });

    it('should emit valueChange and selectionChange on selectOption', () => {
      component.options = [
        { value: 'opt-1', label: 'Option 1' },
        { value: 'opt-2', label: 'Option 2' }
      ];

      const valueSpy = vi.fn();
      const selectionSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);
      component.selectionChange.subscribe(selectionSpy);

      component.selectOption({ value: 'opt-2', label: 'Option 2' });

      expect(component.valueSignal()).toBe('opt-2');
      expect(valueSpy).toHaveBeenCalledWith('opt-2');
      expect(selectionSpy).toHaveBeenCalledWith({ value: 'opt-2', label: 'Option 2' });

      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });
  });
});
