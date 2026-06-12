import { useMemo, useState } from 'react';
import { FileDown, FileText } from 'lucide-react';
import type { Sale } from '../../types';
import { formatCurrency, formatDate } from '../../utils/helpers';
import InvoiceModal from '../InvoiceModal';
import { exportSummaryToExcel } from '../../utils/exportExcel';
import { exportToPdf } from '../../utils/exportPdf';

interface Props {
  sales: Sale[];
  dateLabel: string;
  startDate: string;
}

function groupByInvoice(sales: Sale[]): Sale[][] {
  const map = new Map<string, Sale[]>();
  const order: string[] = [];
  for (const s of sales) {
    if (!map.has(s.invoice_number)) {
      map.set(s.invoice_number, []);
      order.push(s.invoice_number);
    }
    map.get(s.invoice_number)!.push(s);
  }
  return order.map((inv) => map.get(inv)!);
}

function PaymentBadge({ mode }: { mode: string }) {
  if (mode === 'Cash') return <span className="badge-cash">{mode}</span>;
  if (mode === 'UPI') return <span className="badge-upi">{mode}</span>;
  return <span className="badge-credit">{mode}</span>;
}

export default function SalesRegisterReport({ sales, dateLabel, startDate }: Props) {
  const [selectedInvoice, setSelectedInvoice] = useState<Sale[] | null>(null);

  const invoiceGroups = useMemo(() => groupByInvoice(sales), [sales]);
  const summary = useMemo(() => ({
    total: sales.reduce((s, x) => s + x.total_amount, 0),
    cash: sales.filter((x) => x.payment_mode === 'Cash').reduce((s, x) => s + x.total_amount, 0),
    upi: sales.filter((x) => x.payment_mode === 'UPI').reduce((s, x) => s + x.total_amount, 0),
    credit: sales.filter((x) => x.payment_mode === 'Credit').reduce((s, x) => s + x.total_amount, 0),
  }), [sales]);

  if (sales.length === 0) {
    return <p className="text-center py-16 text-gray-400 text-sm">No sales data for this period.</p>;
  }

  return (
    <>
      <div className="flex justify-end gap-2 mb-4">
        <button
          onClick={() => exportSummaryToExcel(sales, summary, `sales-register-${startDate}`)}
          className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
        >
          <FileDown size={15} /> Excel
        </button>
        <button
          onClick={() => exportToPdf(sales, summary, dateLabel, `sales-register-${startDate}`)}
          className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <FileText size={15} /> PDF
        </button>
      </div>

      {/* Mobile cards */}
      <div className="space-y-2 sm:hidden">
        {invoiceGroups.map((group) => {
          const first = group[0];
          const groupTotal = group.reduce((s, x) => s + x.total_amount, 0);
          return (
            <div key={first.invoice_number} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <button
                    onClick={() => setSelectedInvoice(group)}
                    className="font-mono text-sm text-blue-600 font-semibold hover:underline"
                  >
                    {first.invoice_number}
                  </button>
                  <p className="text-xs text-gray-500 mt-0.5">{formatDate(first.sale_date)}</p>
                  {first.customer_name && <p className="text-sm text-gray-700 mt-0.5">{first.customer_name}</p>}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">{formatCurrency(groupTotal)}</p>
                  <div className="mt-1"><PaymentBadge mode={first.payment_mode} /></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="table-header">Date</th>
              <th className="table-header">Invoice</th>
              <th className="table-header">Customer</th>
              <th className="table-header text-right">Amount</th>
              <th className="table-header">Payment</th>
              <th className="table-header text-center">Items</th>
            </tr>
          </thead>
          <tbody>
            {invoiceGroups.map((group) => {
              const first = group[0];
              const groupTotal = group.reduce((s, x) => s + x.total_amount, 0);
              return (
                <tr key={first.invoice_number} className="hover:bg-gray-50 border-b border-gray-100 transition-colors">
                  <td className="table-cell text-xs text-gray-500">{formatDate(first.sale_date)}</td>
                  <td className="table-cell">
                    <button
                      onClick={() => setSelectedInvoice(group)}
                      className="font-mono text-xs text-blue-600 hover:underline font-semibold"
                    >
                      {first.invoice_number}
                    </button>
                  </td>
                  <td className="table-cell text-gray-700 max-w-[180px] truncate">{first.customer_name || '—'}</td>
                  <td className="table-cell text-right font-semibold tabular-nums">{formatCurrency(groupTotal)}</td>
                  <td className="table-cell"><PaymentBadge mode={first.payment_mode} /></td>
                  <td className="table-cell text-center text-sm text-gray-500">{group.length}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 border-t-2 border-gray-300">
              <td colSpan={3} className="px-3 py-2.5 text-sm font-semibold text-gray-600">
                Total ({invoiceGroups.length} invoices)
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900 tabular-nums">
                {formatCurrency(summary.total)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
      </div>

      {selectedInvoice && (
        <InvoiceModal sales={selectedInvoice} onClose={() => setSelectedInvoice(null)} />
      )}
    </>
  );
}
