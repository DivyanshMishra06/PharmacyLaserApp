import { useState, useEffect } from 'react';
import { X, User, Phone, Receipt, Edit2, Trash2 } from 'lucide-react';
import type { Sale } from '../types';
import { formatCurrency, formatDate } from '../utils/helpers';

interface InvoiceModalProps {
  sales: Sale[];
  onClose: () => void;
  onEdit?: (sale: Sale) => void;
  onDelete?: (id: string) => void;
}

export default function InvoiceModal({ sales, onClose, onEdit, onDelete }: InvoiceModalProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (sales.length === 0) return null;

  const first = sales[0];
  const total = sales.reduce((s, x) => s + x.total_amount, 0);

  const paymentBadge = (mode: string) => {
    if (mode === 'Cash') return <span className="badge-cash">{mode}</span>;
    if (mode === 'UPI') return <span className="badge-upi">{mode}</span>;
    return <span className="badge-credit">{mode}</span>;
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <Receipt size={18} className="text-blue-600" />
            <div>
              <h2 className="font-bold text-gray-900">{first.invoice_number}</h2>
              <p className="text-xs text-gray-500">{formatDate(first.sale_date)}</p>
            </div>
            {paymentBadge(first.payment_mode)}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={22} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Customer info */}
          {(first.customer_name || first.mobile_number) && (
            <div className="flex flex-wrap items-center gap-4 bg-gray-50 rounded-lg px-4 py-3">
              {first.customer_name && (
                <div className="flex items-center gap-2">
                  <User size={14} className="text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">{first.customer_name}</span>
                </div>
              )}
              {first.mobile_number && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <span className="text-sm text-gray-600">{first.mobile_number}</span>
                </div>
              )}
            </div>
          )}

          {/* Medicines table */}
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header">#</th>
                  <th className="table-header">Medicine</th>
                  <th className="table-header hidden sm:table-cell">Batch</th>
                  <th className="table-header hidden sm:table-cell">Expiry</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">MRP</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header text-right">Total</th>
                  {(onEdit || onDelete) && (
                    <th className="table-header text-center">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {sales.map((sale, idx) => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="table-cell text-gray-400 text-xs">{idx + 1}</td>
                    <td className="table-cell font-medium">{sale.medicine_name}</td>
                    <td className="hidden sm:table-cell px-3 py-3 text-xs text-gray-500 border-b border-gray-100">
                      {sale.batch_number || '-'}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-3 text-xs text-gray-500 border-b border-gray-100">
                      {sale.expiry_date || '-'}
                    </td>
                    <td className="table-cell">{sale.quantity}</td>
                    <td className="table-cell text-sm">₹{sale.mrp}</td>
                    <td className="table-cell text-sm">₹{sale.selling_rate}</td>
                    <td className="table-cell text-right font-semibold">
                      {formatCurrency(sale.total_amount)}
                    </td>
                    {(onEdit || onDelete) && (
                      <td className="table-cell">
                        <div className="flex items-center justify-center gap-1">
                          {onEdit && (
                            <button
                              onClick={() => onEdit(sale)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {onDelete && (
                            confirmId === sale.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() => { onDelete(sale.id); setConfirmId(null); }}
                                  className="px-2 py-1 bg-red-500 text-white rounded text-xs font-medium"
                                >
                                  Yes
                                </button>
                                <button
                                  onClick={() => setConfirmId(null)}
                                  className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmId(sale.id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-blue-50 border-t-2 border-blue-200">
                  <td colSpan={99} className="px-3 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-600">
                        Grand Total &middot; {sales.length} {sales.length === 1 ? 'medicine' : 'medicines'}
                      </span>
                      <span className="font-bold text-blue-700 text-base">
                        {formatCurrency(total)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
