import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SelectComponent } from './select';

describe('SelectComponent', () => {
  let component: SelectComponent;
  let mockElementRef: any;

  beforeEach(() => {
    mockElementRef = {
      nativeElement: document.createElement('div')
    };

    component = new SelectComponent(mockElementRef);
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
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
      expect(component.isOpen()).toBe(false);
    });
  });
});
