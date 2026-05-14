import { ComponentFixture, TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DataTableComponent,
  SortEvent,
  TableColumn,
} from './data-table.component';

const COLS: TableColumn[] = [
  { key: 'name', label: 'Name' },
  { key: 'count', label: 'Count' },
];

const ROWS = [
  { id: 'a', name: 'Charlie', count: 3 },
  { id: 'b', name: 'Alpha', count: 1 },
  { id: 'c', name: 'Bravo', count: 2 },
];

function setup(): ComponentFixture<DataTableComponent> {
  TestBed.configureTestingModule({ imports: [DataTableComponent] });
  return TestBed.createComponent(DataTableComponent);
}

describe('DataTableComponent', () => {
  let fixture: ComponentFixture<DataTableComponent>;

  beforeEach(async () => {
    fixture = setup();
    fixture.componentRef.setInput('columns', COLS);
    fixture.componentRef.setInput('data', ROWS);
    fixture.componentRef.setInput('pageSize', 20);
    await fixture.whenStable();
  });

  it('renders one header per column plus data rows', () => {
    const ths = fixture.nativeElement.querySelectorAll('thead .dt__th');
    expect(ths.length).toBe(2);
    const bodyRows = fixture.nativeElement.querySelectorAll(
      'tbody tr.dt__row',
    );
    expect(bodyRows.length).toBe(3);
  });

  it('renders "No data" empty state when data is empty', async () => {
    fixture.componentRef.setInput('data', []);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.dt__empty')?.textContent).toBe(
      'No data',
    );
  });

  describe('sorting', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('sortable', true);
      await fixture.whenStable();
    });

    it('cycles asc → desc → none on repeated clicks', () => {
      fixture.componentInstance.handleSort('name');
      expect(fixture.componentInstance.sortDir()).toBe('asc');
      fixture.componentInstance.handleSort('name');
      expect(fixture.componentInstance.sortDir()).toBe('desc');
      fixture.componentInstance.handleSort('name');
      expect(fixture.componentInstance.sortDir()).toBe(null);
      expect(fixture.componentInstance.sortKey()).toBe(null);
    });

    it('sorts rows ascending by string column', async () => {
      fixture.componentInstance.handleSort('name');
      await fixture.whenStable();
      const names = fixture.componentInstance
        .pagedRows()
        .map((r) => r['name']);
      expect(names).toEqual(['Alpha', 'Bravo', 'Charlie']);
    });

    it('sorts numerically with localeCompare numeric option', async () => {
      fixture.componentInstance.handleSort('count');
      await fixture.whenStable();
      const counts = fixture.componentInstance
        .pagedRows()
        .map((r) => r['count']);
      expect(counts).toEqual([1, 2, 3]);
    });

    it('emits sort event with key + direction', () => {
      const spy = vi.fn<(e: SortEvent) => void>();
      fixture.componentInstance.sort.subscribe(spy);
      fixture.componentInstance.handleSort('name');
      expect(spy).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
    });

    it('returns "none" aria-sort label for non-active column', () => {
      expect(fixture.componentInstance.sortAriaLabel('name')).toBe('none');
    });

    it('returns ascending/descending aria-sort label for active column', () => {
      fixture.componentInstance.handleSort('name');
      expect(fixture.componentInstance.sortAriaLabel('name')).toBe('ascending');
      fixture.componentInstance.handleSort('name');
      expect(fixture.componentInstance.sortAriaLabel('name')).toBe('descending');
    });

    it('isSortable respects column-level override (sortable: false)', () => {
      const col: TableColumn = { key: 'name', label: 'Name', sortable: false };
      expect(fixture.componentInstance.isSortable(col)).toBe(false);
    });
  });

  describe('selection', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('selectable', true);
      await fixture.whenStable();
    });

    it('toggles a row in/out of selection', () => {
      const spy = vi.fn();
      fixture.componentInstance.selectionChange.subscribe(spy);
      fixture.componentInstance.toggleRow(ROWS[0]);
      expect(fixture.componentInstance.isRowSelected(ROWS[0])).toBe(true);
      fixture.componentInstance.toggleRow(ROWS[0]);
      expect(fixture.componentInstance.isRowSelected(ROWS[0])).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it('toggleAll selects all visible rows when checked', () => {
      const evt = { target: { checked: true } } as unknown as Event;
      fixture.componentInstance.toggleAll(evt);
      expect(fixture.componentInstance.isAllSelected()).toBe(true);
    });

    it('toggleAll clears selection when unchecked', () => {
      fixture.componentInstance.toggleAll({
        target: { checked: true },
      } as unknown as Event);
      fixture.componentInstance.toggleAll({
        target: { checked: false },
      } as unknown as Event);
      expect(fixture.componentInstance.isAllSelected()).toBe(false);
    });

    it('isIndeterminate is true when some but not all rows selected', () => {
      fixture.componentInstance.toggleRow(ROWS[0]);
      expect(fixture.componentInstance.isIndeterminate()).toBe(true);
    });
  });

  describe('pagination', () => {
    beforeEach(async () => {
      fixture.componentRef.setInput('pageSize', 2);
      await fixture.whenStable();
    });

    it('showPager is true when rows exceed pageSize', () => {
      expect(fixture.componentInstance.showPager()).toBe(true);
    });

    it('lastPage reflects (rows / pageSize) - 1', () => {
      expect(fixture.componentInstance.lastPage()).toBe(1);
    });

    it('goTo clamps to [0, lastPage]', () => {
      fixture.componentInstance.goTo(-5);
      expect(fixture.componentInstance.currentPage()).toBe(0);
      fixture.componentInstance.goTo(99);
      expect(fixture.componentInstance.currentPage()).toBe(1);
    });

    it('pagedRows returns only the current page slice', async () => {
      fixture.componentInstance.goTo(1);
      await fixture.whenStable();
      expect(fixture.componentInstance.pagedRows().length).toBe(1);
    });
  });

  describe('cellValue', () => {
    it('returns formatted value when format function is supplied', () => {
      const col: TableColumn = {
        key: 'count',
        label: 'Count',
        format: (v) => `#${v}`,
      };
      expect(fixture.componentInstance.cellValue(ROWS[0], col)).toBe('#3');
    });
    it('coerces null/undefined to empty string', () => {
      const col: TableColumn = { key: 'missing', label: '' };
      expect(fixture.componentInstance.cellValue({}, col)).toBe('');
    });
    it('stringifies non-null values', () => {
      const col: TableColumn = { key: 'count', label: '' };
      expect(fixture.componentInstance.cellValue({ count: 7 }, col)).toBe('7');
    });
  });

  it('rowId prefers row.id and falls back to index', () => {
    expect(fixture.componentInstance.rowId(ROWS[0], 0)).toBe('a');
    expect(fixture.componentInstance.rowId({}, 5)).toBe('5');
  });

  it('handleRowClick emits the row', () => {
    const spy = vi.fn();
    fixture.componentInstance.rowClick.subscribe(spy);
    fixture.componentInstance.handleRowClick(ROWS[0]);
    expect(spy).toHaveBeenCalledWith(ROWS[0]);
  });
});
