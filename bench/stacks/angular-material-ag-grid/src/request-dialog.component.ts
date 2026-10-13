import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { dataset } from '@perception-bench/scenarios';
import type { RequestRecord } from './request-record';

@Component({
  selector: 'request-dialog',
  standalone: true,
  imports: [FormsModule, MatDialogModule, MatButtonModule, MatFormFieldModule, MatInputModule],
  template: `
    <h2 mat-dialog-title>{{ data.mode === 'details' ? 'Request ' + data.record.id : 'Reassign owner for ' + data.record.id }}</h2>
    <mat-dialog-content>
      @if (data.mode === 'details') {
        <p class="eyebrow">Purchase request · Operations</p>
        <dl class="request-details">
          <dt>Request</dt><dd>{{ data.record.id }}</dd>
          <dt>Supplier</dt><dd>{{ data.record.supplier }}</dd>
          <dt>Amount</dt><dd>{{ data.record.amount }}</dd>
          <dt>Status</dt><dd>{{ data.record.status }}</dd>
          <dt>Owner</dt><dd>{{ data.record.owner }}</dd>
        </dl>
        <p class="muted">Review the request with its owner before making changes to the purchasing workflow.</p>
      } @else {
        <p>{{ data.record.supplier }} · {{ data.record.amount }}</p>
        <p>Current owner: <strong>{{ data.record.owner }}</strong></p>
        <mat-form-field appearance="outline">
          <mat-label>New owner</mat-label>
          <select matNativeControl [(ngModel)]="owner">
            @for (person of owners; track person) { <option [value]="person">{{ person }}</option> }
          </select>
        </mat-form-field>
        <p class="muted">Changes apply to this local workspace. Reset restores the original assignments.</p>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ data.mode === 'details' ? 'Close' : 'Cancel' }}</button>
      @if (data.mode === 'reassign') {
        <button mat-flat-button [disabled]="owner === data.record.owner" (click)="dialog.close(owner)">Save assignment</button>
      }
    </mat-dialog-actions>
  `,
})
export class RequestDialogComponent {
  readonly data = inject<{ mode: 'details' | 'reassign'; record: RequestRecord }>(MAT_DIALOG_DATA);
  readonly dialog = inject(MatDialogRef<RequestDialogComponent, string>);
  readonly owners = [...new Set(dataset.requests.map(record => record.owner))];
  owner = this.data.record.owner;
}
