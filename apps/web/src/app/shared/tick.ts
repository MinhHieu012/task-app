import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { Icon } from './icon';

/** The round done-toggle. Its ring carries the priority colour (1 to 4); checked fills it in success green. */
@Component({
  selector: 'app-tick',
  imports: [Icon],
  template: `
    <button type="button" role="checkbox" class="tick" [attr.aria-checked]="checked()" [attr.aria-label]="label()" [disabled]="disabled()"
      [style.--ring]="'var(--color-p' + priority() + ')'" [style.width.px]="size()" [style.height.px]="size()" (click)="flip.emit()">
      <app-icon name="check" [size]="size() * 0.55" [stroke]="3" />
    </button>
  `,
  styles: `
    .tick { display: inline-grid; place-items: center; flex: none; border-radius: 50%; border: 2px solid var(--ring); background: var(--color-sheet);
      color: transparent; cursor: pointer; padding: 0; position: relative;
      transition: background-color var(--dur-micro) var(--ease-out), color var(--dur-micro) var(--ease-out), border-color var(--dur-micro) var(--ease-out); }
    .tick::after { content: ''; position: absolute; inset: -8px; }
    .tick:hover { color: var(--ring); background: color-mix(in oklab, var(--ring) 10%, var(--color-sheet)); }
    .tick:active { background: color-mix(in oklab, var(--ring) 20%, var(--color-sheet)); }
    .tick:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; transition: none; }
    .tick[aria-checked='true'] { background: var(--color-success); border-color: var(--color-success); color: var(--color-accent-ink); }
    .tick:disabled { opacity: 0.55; cursor: progress; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Tick {
  readonly checked = input(false);
  readonly priority = input(4);
  readonly size = input(24);
  readonly disabled = input(false);
  readonly label = input('');
  readonly flip = output();
}
