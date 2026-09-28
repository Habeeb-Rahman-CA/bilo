import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DatePickerComponent } from './date-picker';

describe('DatePickerComponent - Date Range Constraints', () => {
  let component: DatePickerComponent;
  let mockElementRef: any;

  beforeEach(() => {
    mockElementRef = {
      nativeElement: document.createElement('div')
    };

    component = new DatePickerComponent(mockElementRef);
  });

  it('should create component', () => {
    expect(component).toBeTruthy();
  });

  it('should enforce default date range boundaries (1900-01-01 to 2100-12-31)', () => {
    expect(component.isDateDisabled('1899-12-31')).toBe(true);
    expect(component.isDateDisabled('1900-01-01')).toBe(false);
    expect(component.isDateDisabled('2026-09-28')).toBe(false);
    expect(component.isDateDisabled('2100-12-31')).toBe(false);
    expect(component.isDateDisabled('2101-01-01')).toBe(true);
  });

  it('should respect custom minDate and maxDate inputs', () => {
    component.minDate = '2026-01-01';
    component.maxDate = '2026-12-31';

    expect(component.isDateDisabled('2025-12-31')).toBe(true);
    expect(component.isDateDisabled('2026-01-01')).toBe(false);
    expect(component.isDateDisabled('2026-06-15')).toBe(false);
    expect(component.isDateDisabled('2026-12-31')).toBe(false);
    expect(component.isDateDisabled('2027-01-01')).toBe(true);
  });

  it('should support min and max alias inputs', () => {
    component.min = '2026-05-10';
    component.max = '2026-05-20';

    expect(component.isDateDisabled('2026-05-09')).toBe(true);
    expect(component.isDateDisabled('2026-05-10')).toBe(false);
    expect(component.isDateDisabled('2026-05-20')).toBe(false);
    expect(component.isDateDisabled('2026-05-21')).toBe(true);
  });

  it('should prevent selecting date out of min/max range', () => {
    component.minDate = '2026-09-01';
    component.maxDate = '2026-09-30';

    const valueSpy = vi.fn();
    component.valueChange.subscribe(valueSpy);

    // Attempt to select date before min
    component.selectDate('2026-08-31');
    expect(component.value).toBe('');
    expect(valueSpy).not.toHaveBeenCalled();

    // Select valid in-range date
    component.selectDate('2026-09-15');
    expect(component.value).toBe('2026-09-15');
    expect(valueSpy).toHaveBeenCalledWith('2026-09-15');
  });

  it('should flag disabled days in calendarDays matrix', () => {
    component.minDate = '2026-09-10';
    component.maxDate = '2026-09-20';
    component.viewDate.set(new Date('2026-09-15'));

    const days = component.calendarDays();
    const day5 = days.find(d => d.dateStr === '2026-09-05');
    const day15 = days.find(d => d.dateStr === '2026-09-15');
    const day25 = days.find(d => d.dateStr === '2026-09-25');

    expect(day5?.isDisabled).toBe(true);
    expect(day15?.isDisabled).toBe(false);
    expect(day25?.isDisabled).toBe(true);
  });

  it('should disable prevMonth navigation when previous month is below minDate', () => {
    component.minDate = '2026-09-01';
    component.viewDate.set(new Date('2026-09-15'));

    expect(component.isPrevMonthDisabled()).toBe(true);

    const initialMonth = component.viewDate().getMonth();
    component.prevMonth();
    expect(component.viewDate().getMonth()).toBe(initialMonth);
  });

  it('should disable nextMonth navigation when next month exceeds maxDate', () => {
    component.maxDate = '2026-09-30';
    component.viewDate.set(new Date('2026-09-15'));

    expect(component.isNextMonthDisabled()).toBe(true);

    const initialMonth = component.viewDate().getMonth();
    component.nextMonth();
    expect(component.viewDate().getMonth()).toBe(initialMonth);
  });

  describe('Click-Outside & Parent Modal Conflict Prevention', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should stop propagation on selectDate click event and defer popover closure', () => {
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');
      const valueSpy = vi.fn();
      component.valueChange.subscribe(valueSpy);

      component.selectDate('2026-09-15', clickEvent);

      expect(stopSpy).toHaveBeenCalled();
      expect(component.value).toBe('2026-09-15');
      expect(valueSpy).toHaveBeenCalledWith('2026-09-15');

      // Popover closure deferred to next tick so parent modal contains() checks work on attached nodes
      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });

    it('should stop propagation on clearDate click event', () => {
      component.value = '2026-09-15';
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      const stopSpy = vi.spyOn(clickEvent, 'stopPropagation');

      component.clearDate(clickEvent);

      expect(stopSpy).toHaveBeenCalled();
      expect(component.value).toBe('');

      vi.advanceTimersByTime(0);
      expect(component.isOpen()).toBe(false);
    });

    it('should tag popover with data-bilo-popover attribute when appended to document.body', () => {
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
      expect(document.body.contains(mockPopover)).toBe(true);

      component.ngOnDestroy();
      expect(document.body.contains(mockPopover)).toBe(false);
    });
  });
});
