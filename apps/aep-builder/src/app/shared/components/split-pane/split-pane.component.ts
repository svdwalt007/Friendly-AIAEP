import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type SplitPaneDirection = 'horizontal' | 'vertical';

@Component({
  selector: 'app-split-pane',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './split-pane.component.html',
  styleUrl: './split-pane.component.scss',
})
export class SplitPaneComponent implements OnInit, OnDestroy {
  @ViewChild('divider', { static: true }) divider!: ElementRef<HTMLDivElement>;
  @ViewChild('leftPane', { static: true }) leftPane!: ElementRef<HTMLDivElement>;
  @ViewChild('rightPane', { static: true }) rightPane!: ElementRef<HTMLDivElement>;

  @Input() direction: SplitPaneDirection = 'horizontal';
  @Input() initialSplit: number = 50; // Percentage
  @Input() minSize: number = 20; // Percentage
  @Input() maxSize: number = 80; // Percentage
  @Input() resizable: boolean = true;
  @Input() snapThreshold: number = 5; // Pixels

  @Output() splitChange = new EventEmitter<number>();
  @Output() resizeStart = new EventEmitter<void>();
  @Output() resizeEnd = new EventEmitter<number>();

  private isDragging = signal(false);
  splitPosition = signal(50);

  // Computed values
  readonly isHorizontal = computed(() => this.direction === 'horizontal');
  readonly leftPaneStyle = computed(() => ({
    [this.isHorizontal() ? 'width' : 'height']: `${this.splitPosition()}%`,
  }));
  readonly rightPaneStyle = computed(() => ({
    [this.isHorizontal() ? 'width' : 'height']: `${100 - this.splitPosition()}%`,
  }));

  private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
  private mouseUpListener: ((e: MouseEvent) => void) | null = null;
  private touchMoveListener: ((e: TouchEvent) => void) | null = null;
  private touchEndListener: ((e: TouchEvent) => void) | null = null;

  ngOnInit(): void {
    this.splitPosition.set(this.clampSplit(this.initialSplit));
  }

  ngOnDestroy(): void {
    this.removeEventListeners();
  }

  onDividerMouseDown(event: MouseEvent): void {
    if (!this.resizable) return;
    event.preventDefault();
    this.startDragging();
  }

  onDividerTouchStart(event: TouchEvent): void {
    if (!this.resizable) return;
    event.preventDefault();
    this.startDragging();
  }

  onDividerKeyDown(event: KeyboardEvent): void {
    if (!this.resizable) return;

    let delta = 0;
    const step = 5; // Percentage

    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        delta = -step;
        event.preventDefault();
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        delta = step;
        event.preventDefault();
        break;
      case 'Home':
        this.updateSplit(this.minSize);
        event.preventDefault();
        return;
      case 'End':
        this.updateSplit(this.maxSize);
        event.preventDefault();
        return;
    }

    if (delta !== 0) {
      const newSplit = this.clampSplit(this.splitPosition() + delta);
      this.updateSplit(newSplit);
    }
  }

  private startDragging(): void {
    this.isDragging.set(true);
    this.resizeStart.emit();

    this.mouseMoveListener = (e: MouseEvent) => this.onMouseMove(e);
    this.mouseUpListener = (e: MouseEvent) => this.stopDragging(e);
    this.touchMoveListener = (e: TouchEvent) => this.onTouchMove(e);
    this.touchEndListener = (e: TouchEvent) => this.stopDragging(e);

    document.addEventListener('mousemove', this.mouseMoveListener);
    document.addEventListener('mouseup', this.mouseUpListener);
    document.addEventListener('touchmove', this.touchMoveListener, { passive: false });
    document.addEventListener('touchend', this.touchEndListener);
    document.body.style.cursor = this.isHorizontal() ? 'col-resize' : 'row-resize';
    document.body.style.userSelect = 'none';
  }

  private stopDragging(event: MouseEvent | TouchEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    this.removeEventListeners();
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    this.resizeEnd.emit(this.splitPosition());
  }

  private onMouseMove(event: MouseEvent): void {
    event.preventDefault();
    this.updateSplitFromPosition(event.clientX, event.clientY);
  }

  private onTouchMove(event: TouchEvent): void {
    event.preventDefault();
    const touch = event.touches[0];
    this.updateSplitFromPosition(touch.clientX, touch.clientY);
  }

  private updateSplitFromPosition(clientX: number, clientY: number): void {
    const container = this.leftPane.nativeElement.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    let percentage: number;

    if (this.isHorizontal()) {
      const position = clientX - rect.left;
      percentage = (position / rect.width) * 100;
    } else {
      const position = clientY - rect.top;
      percentage = (position / rect.height) * 100;
    }

    const clampedPercentage = this.clampSplit(percentage);
    this.updateSplit(clampedPercentage);
  }

  private updateSplit(percentage: number): void {
    this.splitPosition.set(percentage);
    this.splitChange.emit(percentage);
  }

  private clampSplit(percentage: number): number {
    return Math.max(this.minSize, Math.min(this.maxSize, percentage));
  }

  private removeEventListeners(): void {
    if (this.mouseMoveListener) {
      document.removeEventListener('mousemove', this.mouseMoveListener);
      this.mouseMoveListener = null;
    }
    if (this.mouseUpListener) {
      document.removeEventListener('mouseup', this.mouseUpListener);
      this.mouseUpListener = null;
    }
    if (this.touchMoveListener) {
      document.removeEventListener('touchmove', this.touchMoveListener);
      this.touchMoveListener = null;
    }
    if (this.touchEndListener) {
      document.removeEventListener('touchend', this.touchEndListener);
      this.touchEndListener = null;
    }
  }

  getDraggingClass(): string {
    return this.isDragging() ? 'dragging' : '';
  }
}
