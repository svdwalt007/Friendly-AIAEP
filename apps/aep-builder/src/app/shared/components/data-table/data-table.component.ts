/**
 * @file DataTableComponent — generic sortable, selectable, paginated table.
 * Standalone, signals-based (Angular 17+). No external table library.
 * @license MIT
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Friendly Technologies
 */
import { Component, input, output, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn<T = Record<string, unknown>> {
  /** Key into the data row object */
  key: string;
  /** Display header label */
  label: string;
  /** Whether this column is sortable. Defaults to parent `sortable` input. */
  sortable?: boolean;
  /** Optional cell formatter */
  format?: (value: unknown, row: T) => string;
}

export type SortDirection = 'asc' | 'desc' | null;

export interface SortEvent {
  key: string;
  direction: SortDirection;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dt-wrapper">
      <table class="dt" role="grid" [attr.aria-rowcount]="data().length + 1">

        <thead class="dt__head">
          <tr>
            @if (selectable()) {
              <th class="dt__th dt__th--check" scope="col">
                <input
                  type="checkbox"
                  class="dt__checkbox"
                  [indeterminate]="isIndeterminate()"
                  [checked]="isAllSelected()"
                  (change)="toggleAll($event)"
                  aria-label="Select all rows"
                />
              </th>
            }
            @for (col of columns(); track col.key) {
              <th
                class="dt__th"
                scope="col"
                [class.dt__th--sortable]="isSortable(col)"
                [attr.aria-sort]="sortAriaLabel(col.key)"
                (click)="isSortable(col) && handleSort(col.key)"
                (keydown.enter)="isSortable(col) && handleSort(col.key)"
                [tabindex]="isSortable(col) ? 0 : -1"
              >
                <span class="dt__th-inner">
                  {{ col.label }}
                  @if (isSortable(col)) {
                    <span class="dt__sort-icon" aria-hidden="true">
                      @if (sortKey() === col.key && sortDir() === 'asc') { ↑ }
                      @else if (sortKey() === col.key && sortDir() === 'desc') { ↓ }
                      @else { ⇅ }
                    </span>
                  }
                </span>
              </th>
            }
          </tr>
        </thead>

        <tbody class="dt__body">
          @for (row of pagedRows(); track rowId(row, $index)) {
            <tr
              class="dt__row"
              [class.dt__row--selected]="isRowSelected(row)"
              (click)="handleRowClick(row)"
              (keydown.enter)="handleRowClick(row)"
              tabindex="0"
              role="row"
            >
              @if (selectable()) {
                <td class="dt__td dt__td--check">
                  <input
                    type="checkbox"
                    class="dt__checkbox"
                    [checked]="isRowSelected(row)"
                    (click)="$event.stopPropagation(); toggleRow(row)"
                    [attr.aria-label]="'Select row'"
                  />
                </td>
              }
              @for (col of columns(); track col.key) {
                <td class="dt__td">{{ cellValue(row, col) }}</td>
              }
            </tr>
          }
          @if (pagedRows().length === 0) {
            <tr>
              <td
                class="dt__empty"
                [attr.colspan]="columns().length + (selectable() ? 1 : 0)"
              >No data</td>
            </tr>
          }
        </tbody>
      </table>

      @if (showPager()) {
        <div class="dt__pager" role="navigation" aria-label="Table pagination">
          <span class="dt__pager-info">
            {{ pageStart() + 1 }}–{{ pageEnd() }} of {{ data().length }}
          </span>
          <button
            class="dt__pager-btn"
            [disabled]="currentPage() === 0"
            (click)="goTo(currentPage() - 1)"
            aria-label="Previous page"
          >‹</button>
          <button
            class="dt__pager-btn"
            [disabled]="currentPage() >= lastPage()"
            (click)="goTo(currentPage() + 1)"
            aria-label="Next page"
          >›</button>
        </div>
      }
    </div>
  `,
  styles: [`
    .dt-wrapper {
      width: 100%;
      overflow-x: auto;
    }

    .dt {
      width: 100%;
      border-collapse: collapse;
      font-size: var(--ft-font-size-sm, 0.875rem);
      color: var(--ft-text-primary);
      background: var(--ft-surface-primary);
    }

    .dt__head {
      background: var(--ft-surface-secondary);
      border-bottom: 2px solid var(--ft-border-color);
    }

    .dt__th {
      padding: 10px 14px;
      text-align: left;
      font-weight: var(--ft-font-weight-semibold, 600);
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
      text-transform: uppercase;
      letter-spacing: var(--ft-letter-spacing-wider, 0.05em);
      white-space: nowrap;
      outline: none;
    }

    .dt__th--sortable {
      cursor: pointer;
      user-select: none;
    }

    .dt__th--sortable:hover,
    .dt__th--sortable:focus-visible {
      color: var(--ft-text-primary);
    }

    .dt__th--check,
    .dt__td--check {
      width: 40px;
      text-align: center;
    }

    .dt__th-inner {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    .dt__sort-icon {
      font-size: 10px;
      opacity: 0.6;
    }

    .dt__body .dt__row {
      border-bottom: 1px solid var(--ft-border-light, var(--ft-border-color));
      outline: none;
      cursor: pointer;
      transition: background 0.1s;
    }

    .dt__body .dt__row:hover {
      background: var(--ft-surface-hover, var(--ft-surface-secondary));
    }

    .dt__body .dt__row:focus-visible {
      box-shadow: inset 0 0 0 2px var(--ft-primary, #1e88e5);
    }

    .dt__row--selected {
      background: var(--ft-primary-light, var(--ft-primary-50, #e3f2fd)) !important;
    }

    .dt__td {
      padding: 10px 14px;
      vertical-align: middle;
    }

    .dt__checkbox {
      cursor: pointer;
      width: 16px;
      height: 16px;
      accent-color: var(--ft-primary, #1e88e5);
    }

    .dt__empty {
      padding: 32px;
      text-align: center;
      color: var(--ft-text-secondary);
      font-size: var(--ft-font-size-sm, 0.875rem);
    }

    .dt__pager {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      padding: 10px 14px;
      border-top: 1px solid var(--ft-border-color);
      background: var(--ft-surface-secondary);
    }

    .dt__pager-info {
      font-size: var(--ft-font-size-xs, 0.75rem);
      color: var(--ft-text-secondary);
      margin-right: 8px;
    }

    .dt__pager-btn {
      width: 28px;
      height: 28px;
      border: 1px solid var(--ft-border-color);
      border-radius: var(--ft-radius-sm, 4px);
      background: var(--ft-surface-primary);
      color: var(--ft-text-primary);
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background 0.1s;
    }

    .dt__pager-btn:hover:not([disabled]) {
      background: var(--ft-surface-hover, var(--ft-surface-secondary));
    }

    .dt__pager-btn[disabled] {
      opacity: var(--ft-disabled-opacity, 0.38);
      cursor: not-allowed;
    }
  `],
})
export class DataTableComponent {
  columns  = input<TableColumn[]>([]);
  data     = input<Record<string, unknown>[]>([]);
  sortable = input<boolean>(false);
  selectable = input<boolean>(false);
  pageSize  = input<number>(20);
  pageIndex = input<number>(0);

  sort            = output<SortEvent>();
  rowClick        = output<Record<string, unknown>>();
  selectionChange = output<Record<string, unknown>[]>();

  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<SortDirection>(null);
  readonly currentPage = signal<number>(0);
  readonly selectedRows = signal<Set<Record<string, unknown>>>(new Set());

  readonly sortedRows = computed(() => {
    const key = this.sortKey();
    const dir = this.sortDir();
    const rows = [...this.data()];
    if (!key || !dir) return rows;
    return rows.sort((a, b) => {
      const av = a[key] ?? '';
      const bv = b[key] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return dir === 'asc' ? cmp : -cmp;
    });
  });

  readonly lastPage = computed(() =>
    Math.max(0, Math.ceil(this.data().length / this.pageSize()) - 1),
  );

  readonly pageStart = computed(() => this.currentPage() * this.pageSize());

  readonly pageEnd = computed(() =>
    Math.min(this.pageStart() + this.pageSize(), this.data().length),
  );

  readonly pagedRows = computed(() =>
    this.sortedRows().slice(this.pageStart(), this.pageEnd()),
  );

  readonly showPager = computed(() => this.data().length > this.pageSize());

  readonly isAllSelected = computed(() => {
    const rows = this.pagedRows();
    if (rows.length === 0) return false;
    return rows.every((r) => this.selectedRows().has(r));
  });

  readonly isIndeterminate = computed(() => {
    const rows = this.pagedRows();
    const sel = rows.filter((r) => this.selectedRows().has(r)).length;
    return sel > 0 && sel < rows.length;
  });

  isSortable(col: TableColumn): boolean {
    return this.sortable() && (col.sortable !== false);
  }

  handleSort(key: string): void {
    if (this.sortKey() === key) {
      const next: SortDirection = this.sortDir() === 'asc' ? 'desc' : this.sortDir() === 'desc' ? null : 'asc';
      this.sortDir.set(next);
      if (next === null) this.sortKey.set(null);
    } else {
      this.sortKey.set(key);
      this.sortDir.set('asc');
    }
    this.sort.emit({ key, direction: this.sortDir() });
  }

  sortAriaLabel(key: string): string | null {
    if (this.sortKey() !== key) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  handleRowClick(row: Record<string, unknown>): void {
    this.rowClick.emit(row);
  }

  cellValue(row: Record<string, unknown>, col: TableColumn): string {
    const val = row[col.key];
    if (col.format) return col.format(val, row);
    return val == null ? '' : String(val);
  }

  rowId(row: Record<string, unknown>, index: number): string {
    return String(row['id'] ?? index);
  }

  toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = new Set(this.selectedRows());
    this.pagedRows().forEach((r) => (checked ? current.add(r) : current.delete(r)));
    this.selectedRows.set(current);
    this.selectionChange.emit([...current]);
  }

  toggleRow(row: Record<string, unknown>): void {
    const current = new Set(this.selectedRows());
    current.has(row) ? current.delete(row) : current.add(row);
    this.selectedRows.set(current);
    this.selectionChange.emit([...current]);
  }

  isRowSelected(row: Record<string, unknown>): boolean {
    return this.selectedRows().has(row);
  }

  goTo(page: number): void {
    this.currentPage.set(Math.max(0, Math.min(page, this.lastPage())));
  }
}
