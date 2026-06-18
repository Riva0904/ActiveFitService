import { Injectable } from '@nestjs/common';
import { Response } from 'express';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

interface ExportRow {
  name: string;
  checkIn: Date;
  checkOut: Date | null;
  duration: number | null;
  status: string;
}

const COLUMNS = ['Member Name', 'Check-In', 'Check-Out', 'Duration', 'Status'];

function formatRow(r: ExportRow): string[] {
  return [
    r.name,
    r.checkIn.toLocaleString('en-IN'),
    r.checkOut ? r.checkOut.toLocaleString('en-IN') : '—',
    r.duration != null ? `${r.duration} min` : '—',
    r.status,
  ];
}

@Injectable()
export class AttendanceExportService {
  toCsv(records: ExportRow[]): string {
    const escape = (v: string) => (v.includes(',') || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [COLUMNS.join(','), ...records.map((r) => formatRow(r).map(escape).join(','))];
    return lines.join('\n');
  }

  async toExcel(records: ExportRow[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Attendance');
    sheet.addRow(COLUMNS).font = { bold: true };
    for (const r of records) sheet.addRow(formatRow(r));
    sheet.columns.forEach((col) => { col.width = 22; });
    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  toPdf(records: ExportRow[], res: Response): void {
    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(16).text('Attendance Report', { align: 'center' });
    doc.moveDown();

    const colWidths = [140, 110, 110, 70, 70];
    const startX = doc.x;
    let y = doc.y;

    doc.fontSize(10).font('Helvetica-Bold');
    COLUMNS.forEach((col, i) => {
      doc.text(col, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
    });
    y += 18;
    doc.font('Helvetica');

    for (const r of records) {
      if (y > 760) { doc.addPage(); y = doc.y; }
      const row = formatRow(r);
      row.forEach((cell, i) => {
        doc.text(cell, startX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, { width: colWidths[i] });
      });
      y += 16;
    }

    doc.end();
  }
}
