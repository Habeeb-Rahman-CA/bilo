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
});
