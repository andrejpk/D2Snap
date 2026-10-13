import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AgGridAngular } from 'ag-grid-angular';
import type { ColDef, GridApi, GridOptions, GridReadyEvent, SelectionChangedEvent } from 'ag-grid-community';
import { dataset } from '@perception-bench/scenarios';
import { RequestDialogComponent } from './request-dialog.component';
import type { RequestRecord } from './request-record';

@Component({
  selector: 'operations-app',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatDialogModule, MatFormFieldModule,
    MatInputModule, MatToolbarModule, AgGridAngular],
  templateUrl: './app.component.html',
})
export class AppComponent {
  readonly corpus = dataset;
  private readonly dialogs = inject(MatDialog);
  private api?: GridApi<RequestRecord>;
  records: RequestRecord[] = dataset.requests.map(record => ({ ...record }));
  visibleRecords = this.records;
  query = '';
  status = 'All statuses';
  selected: RequestRecord | null = null;
  announcement = '';

  readonly columns: ColDef<RequestRecord>[] = [
    { field: 'id', headerName: 'Request', width: 145, cellClass: 'request-id' },
    { field: 'supplier', headerName: 'Supplier', flex: 1, minWidth: 205 },
    { field: 'amount', headerName: 'Amount', width: 145, cellClass: 'amount' },
    { field: 'status', headerName: 'Status', width: 130, cellClassRules: {
      'status-overdue': params => params.value === 'Overdue',
      'status-approved': params => params.value === 'Approved',
      'status-pending': params => params.value === 'Pending',
    } },
    { field: 'owner', headerName: 'Owner', flex: 1, minWidth: 170 },
  ];
  readonly gridOptions: GridOptions<RequestRecord> = {
    theme: 'legacy',
    rowSelection: { mode: 'singleRow', checkboxes: false, enableClickSelection: true },
    defaultColDef: { sortable: true, resizable: true, suppressMovable: true },
    getRowId: params => params.data.id,
    ensureDomOrder: true,
    suppressColumnVirtualisation: true,
    suppressRowVirtualisation: true,
    animateRows: false,
    rowHeight: 54,
    headerHeight: 44,
    tooltipShowDelay: 0,
    overlayNoRowsTemplate: '<span>No requests match these filters.</span>',
  };

  gridReady(event: GridReadyEvent<RequestRecord>): void {
    this.api = event.api;
    event.api.setGridAriaProperty('label', 'Purchase requests');
  }

  selectionChanged(event: SelectionChangedEvent<RequestRecord>): void {
    this.selected = event.api.getSelectedRows()[0] ?? null;
  }

  filterRecords(): void {
    this.clearSelection();
    const query = this.query.trim().toLocaleLowerCase('en-US');
    this.visibleRecords = this.records.filter(record =>
      (this.status === 'All statuses' || record.status === this.status) &&
      Object.values(record).some(value => value.toLocaleLowerCase('en-US').includes(query)),
    );
    this.announcement = '';
  }

  clearSelection(): void {
    this.api?.deselectAll();
    this.selected = null;
  }

  reset(): void {
    this.dialogs.closeAll();
    this.clearSelection();
    this.query = '';
    this.status = 'All statuses';
    this.records = dataset.requests.map(record => ({ ...record }));
    this.visibleRecords = this.records;
    this.api?.applyColumnState({ defaultState: { sort: null } });
    this.api?.resetColumnState();
    this.announcement = '';
  }

  openDialog(mode: 'details' | 'reassign'): void {
    if (!this.selected) return;
    const record = this.selected;
    this.dialogs.open(RequestDialogComponent, {
      data: { mode, record: { ...record } },
      width: '520px',
      autoFocus: 'first-tabbable',
      enterAnimationDuration: 0,
      exitAnimationDuration: 0,
    }).afterClosed().subscribe((owner: string | undefined) => {
      if (mode !== 'reassign' || !owner || owner === record.owner) return;
      this.records = this.records.map(item => item.id === record.id ? { ...item, owner } : item);
      const updated = this.records.find(item => item.id === record.id)!;
      this.filterRecords();
      this.announcement = `${updated.id} is now assigned to ${owner}.`;
    });
  }

  countStatus(status: string): number {
    return this.records.filter(record => record.status === status).length;
  }
}
