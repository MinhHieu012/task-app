import { TestBed } from '@angular/core/testing';

import { NotifyService } from './notify.service';

describe('NotifyService', () => {
  let n: NotifyService;
  beforeEach(() => (n = TestBed.inject(NotifyService)));

  it('keeps only the newest three toasts', () => {
    for (const i of [1, 2, 3, 4]) n.toast(`m${i}`, 't');
    expect(n.toasts().map((t) => t.message)).toEqual(['m2', 'm3', 'm4']);
  });

  it('resolves a confirm with the answer, and a replaced one with false', async () => {
    const first = n.confirm('a');
    const second = n.confirm('b');
    n.answer(true);
    expect(await first).toBe(false);
    expect(await second).toBe(true);
    expect(n.ask()).toBeNull();
  });
});
