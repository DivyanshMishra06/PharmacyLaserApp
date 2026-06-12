import * as XLSX from 'xlsx';
import type { Sale } from '../types';
import { formatDate, formatCurrency } from './helpers';

export function exportToExcel(sales: Sale[], filename: string = 'pharmacy-sales'): void {
  const data = sales.map((s) => ({
    Date: formatDate(s.sale_date),
    'Invoice No': s.invoice_number,
    'Medicine Name': s.medicine_name,
    Quantity: s.quantity,
    MRP: s.mrp,
    'Selling Rate': s.selling_rate,
    'Total Amount': s.total_amount,
    'Payment Mode': s.payment_mode,
    'Customer Name': s.customer_name || '',
    Remarks: s.remarks || '',
  }));

  const ws = XLSX.utils.json_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 8 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 20 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sales');
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export function exportSummaryToExcel(
  sales: Sale[],
  summary: { total: number; cash: number; upi: number; credit: number },
  filename: string = 'pharmacy-report'
): void {
  const wb = XLSX.utils.book_new();

  // Summary sheet
  const summaryData = [
    ['Pharmacy Sales Report'],
    [],
    ['Summary'],
    ['Total Sales', formatCurrency(summary.total)],
    ['Cash Collection', formatCurrency(summary.cash)],
    ['UPI Collection', formatCurrency(summary.upi)],
    ['Credit Collection', formatCurrency(summary.credit)],
    ['Total Transactions', sales.length],
    [],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 20 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary');

  // Detailed transactions
  const detailData = sales.map((s) => ({
    Date: formatDate(s.sale_date),
    'Invoice No': s.invoice_number,
    'Medicine Name': s.medicine_name,
    Quantity: s.quantity,
    MRP: s.mrp,
    'Selling Rate': s.selling_rate,
    'Total Amount': s.total_amount,
    'Payment Mode': s.payment_mode,
    'Customer Name': s.customer_name || '',
    Remarks: s.remarks || '',
  }));
  const detailWs = XLSX.utils.json_to_sheet(detailData);
  detailWs['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 8 },
    { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 20 }, { wch: 20 },
  ];
  XLSX.utils.book_append_sheet(wb, detailWs, 'Transactions');

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
