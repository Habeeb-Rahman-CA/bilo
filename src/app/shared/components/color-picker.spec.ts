import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ColorPickerComponent } from './color-picker';

describe('ColorPickerComponent Mobile UX', () => {
  let component: ColorPickerComponent;

  beforeEach(() => {
    const mockElementRef = {
      nativeElement: {
        contains: () => false
      }
    };
    component = new ColorPickerComponent(mockElementRef as any);
  });

  it('should initialize with default color and closed popover state', () => {
    expect(component.color).toBe('#3b82f6');
    expect(component.isOpen()).toBe(false);
  });

  it('should toggle popover on trigger click', () => {
    const event = new MouseEvent('click');
    vi.spyOn(event, 'stopPropagation');

    component.togglePopover(event);
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(component.isOpen()).toBe(true);

    component.closePopover();
    expect(component.isOpen()).toBe(false);
  });

  it('should emit colorChange when preset swatch is selected', () => {
    const spy = vi.fn();
    component.colorChange.subscribe(spy);

    component.selectColor('#ef4444');
    expect(component.color).toBe('#ef4444');
    expect(spy).toHaveBeenCalledWith('#ef4444');
  });

  it('should format hex input and emit formatted color code', () => {
    const spy = vi.fn();
    component.colorChange.subscribe(spy);

    component.onHexInputChange('22c55e');
    expect(component.color).toBe('#22c55e');
    expect(spy).toHaveBeenCalledWith('#22c55e');
  });

  it('should close popover on document click outside element', () => {
    component.isOpen.set(true);
    const outsideEvent = new MouseEvent('click');
    component.onDocumentClick(outsideEvent);
    expect(component.isOpen()).toBe(false);
  });
});
