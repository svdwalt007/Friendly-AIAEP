import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationToastComponent } from './notification-toast.component';

function getToast(
  fixture: ComponentFixture<NotificationToastComponent>,
): HTMLElement {
  const el = fixture.nativeElement.querySelector('.toast');
  expect(el).toBeTruthy();
  return el as HTMLElement;
}

describe('NotificationToastComponent', () => {
  let fixture: ComponentFixture<NotificationToastComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NotificationToastComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(NotificationToastComponent);
    fixture.componentRef.setInput('message', 'Saved');
    await fixture.whenStable();
  });

  it('renders the required message', () => {
    expect(getToast(fixture).querySelector('.message')?.textContent).toContain(
      'Saved',
    );
  });

  it.each([
    ['success', 'toast--success', '✓'],
    ['error', 'toast--error', '✕'],
    ['warning', 'toast--warning', '▲'],
    ['info', 'toast--info', 'ℹ'],
  ] as const)(
    'applies modifier class and icon glyph for type=%s',
    async (type, klass, glyph) => {
      fixture.componentRef.setInput('type', type);
      await fixture.whenStable();
      const toast = getToast(fixture);
      expect(toast.classList.contains(klass)).toBe(true);
      expect(toast.querySelector('.icon')?.textContent?.trim()).toBe(glyph);
    },
  );

  it('emits dismiss when the toast surface is clicked', () => {
    const spy = vi.fn();
    fixture.componentInstance.dismiss.subscribe(spy);
    getToast(fixture).dispatchEvent(new Event('click'));
    expect(spy).toHaveBeenCalledOnce();
  });

  it('emits dismiss when the close button is clicked (without bubbling)', () => {
    const spy = vi.fn();
    fixture.componentInstance.dismiss.subscribe(spy);
    const close = getToast(fixture).querySelector('.close') as HTMLButtonElement;
    close.click();
    expect(spy).toHaveBeenCalledOnce();
  });

  it('defaults type to "info"', () => {
    expect(getToast(fixture).classList.contains('toast--info')).toBe(true);
  });
});
