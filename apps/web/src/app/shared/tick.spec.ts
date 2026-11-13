import { TestBed } from '@angular/core/testing';

import { Tick } from './tick';

describe('Tick', () => {
  it('is a labelled checkbox that emits on click', () => {
    const f = TestBed.createComponent(Tick);
    f.componentRef.setInput('label', 'Done');
    f.componentRef.setInput('checked', true);
    let flips = 0;
    f.componentInstance.flip.subscribe(() => flips++);
    f.detectChanges();
    const b = (f.nativeElement as HTMLElement).querySelector('button')!;
    expect(b.getAttribute('role')).toBe('checkbox');
    expect(b.getAttribute('aria-checked')).toBe('true');
    expect(b.getAttribute('aria-label')).toBe('Done');
    b.click();
    expect(flips).toBe(1);
  });
});
