import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TasksComponent } from './tasks';
import { CdkDragStart, CdkDrag } from '@angular/cdk/drag-drop';

describe('TasksComponent - Drag Interruption Safeguards', () => {
  let component: any;

  beforeEach(() => {
    component = Object.create(TasksComponent.prototype);
    component.activeDragItem = null;
  });

  it('should track active drag item when drag starts', () => {
    const mockDrag = { reset: vi.fn() } as unknown as CdkDrag<any>;
    const mockEvent = { source: mockDrag } as CdkDragStart<any>;

    component.onDragStarted(mockEvent);

    expect(component.activeDragItem).toBe(mockDrag);
  });

  it('should reset active drag item and cleanup stray DOM elements on window blur or visibility change', () => {
    const mockDrag = { reset: vi.fn() } as unknown as CdkDrag<any>;
    component.onDragStarted({ source: mockDrag } as CdkDragStart<any>);

    const previewEl = document.createElement('div');
    previewEl.className = 'cdk-drag-preview';
    document.body.appendChild(previewEl);

    const placeholderEl = document.createElement('div');
    placeholderEl.className = 'cdk-drag-placeholder';
    document.body.appendChild(placeholderEl);

    component.onWindowBlurOrHide();

    expect(mockDrag.reset).toHaveBeenCalled();
    expect(component.activeDragItem).toBeNull();
    expect(document.querySelector('.cdk-drag-preview')).toBeNull();
    expect(document.querySelector('.cdk-drag-placeholder')).toBeNull();
  });

  it('should dispatch synthetic mouseup/pointerup events to cancel active browser drag loop', () => {
    const spy = vi.spyOn(window, 'dispatchEvent');

    component.cancelActiveDrag();

    expect(spy).toHaveBeenCalled();
    expect(document.querySelector('.cdk-drag-preview')).toBeNull();
  });
});
