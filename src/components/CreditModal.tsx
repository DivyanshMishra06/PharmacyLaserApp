import { X, User } from 'lucide-react';
import { formatCurrency } from '../utils/helpers';

export interface CustomerCredit {
  name: string;
  mobile: string;
  amount: number;
}

interface Props {
  customers: CustomerCredit[];
  total: number;
  title?: string;
  onClose: () => void;
}

export default function CreditModal({ customers, total, title = 'Credit Outstanding', onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">All-time credit by customer</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {customers.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">No credit sales recorded</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {customers.map((c, i) => (
                  <tr key={`${c.name}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5 text-sm text-gray-400 font-medium">{i + 1}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <User size={13} className="text-orange-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{c.name || '—'}</p>
                          {c.mobile && <p className="text-xs text-gray-400">{c.mobile}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm font-bold text-orange-600">{formatCurrency(c.amount)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer total */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 bg-orange-50 rounded-b-2xl">
          <span className="text-sm font-semibold text-gray-700">Total Outstanding</span>
          <span className="text-lg font-bold text-orange-600">{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}
