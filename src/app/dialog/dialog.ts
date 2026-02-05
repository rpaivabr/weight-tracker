import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogActions, MatDialogContent, MatDialogModule, MatDialogRef, MatDialogTitle } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { Record } from '../app';

@Component({
  selector: 'app-dialog',
  imports: [    
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatDatepickerModule,
    MatNativeDateModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  providers: [],
  templateUrl: './dialog.html',
  styleUrl: './dialog.scss',
})
export class Dialog {
  dialogRef = inject(MatDialogRef<Dialog>);
  data = inject<Record>(MAT_DIALOG_DATA);
  edit = !!this.data;
  constructor() {
    console.log(this.data)
  }
  recordForm = new FormGroup({
    date: new FormControl(this.data?.date ?? new Date(), { nonNullable: true }),
    weight: new FormControl(this.data ? String(this.data.weight) : '', { nonNullable: true })
  });
  remove(): void {
    this.dialogRef.close(null);
  }
  save(): void {
    const { date, weight } = this.recordForm.getRawValue();
    this.dialogRef.close({ date, weight: Number(weight) } satisfies Record);
  }
}
