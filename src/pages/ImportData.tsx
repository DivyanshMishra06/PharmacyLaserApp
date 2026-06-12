import { useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Upload, CheckCircle, XCircle, FileSpreadsheet, AlertTriangle } from 'lucide-react';
import { useSales } from '../hooks/useSales';
import { formatCurrency } from '../utils/helpers';

type PayMode = 'Cash' | 'UPI' | 'Credit';

interface ParsedRow {
  sale_date: string;
  invoice_number: string;
  medicine_name: string;
  quantity: number;
  mrp: number;
  discount: number;
  selling_rate: number;
  total_amount: number;
  payment_mode: PayMode;
  customer_name: string;
  mobile_number: string;
  remarks: string;
  _valid: boolean;
  _error: string;
}

// ── helpers ────────────────────────────────────────────────────────────────

function parseExcelDate(raw: unknown): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  // Excel serial number
  if (typeof raw === 'number') {
    const d = XLSX.SSF.parse_date_code(raw);
    return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  const s = String(raw).trim();
  // dd-mm-yyyy or dd/mm/yyyy
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  // dd-mm-yy or dd/mm/yy (2-digit year, e.g. 01-06-26 → 2026-06-01)
  const dmy2 = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
  if (dmy2) {
    const yy = parseInt(dmy2[3], 10);
    const yyyy = yy < 50 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`;
  }
  // yyyy-mm-dd
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().split('T')[0];
}

function normalizePayment(raw: unknown): PayMode {
  const s = String(raw ?? '').toLowerCase().trim();
  if (s === 'upi') return 'UPI';
  if (s.startsWith('cr') || s === 'credit') return 'Credit';
  return 'Cash';
}

function toNum(raw: unknown): number {
  const n = parseFloat(String(raw ?? '').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// Flexible header lookup — finds the column key that contains any of the given keywords
function findCol(row: Record<string, unknown>, ...keywords: string[]): unknown {
  const keys = Object.keys(row);
  for (const kw of keywords) {
    const key = keys.find(k => k.toLowerCase().includes(kw.toLowerCase()));
    if (key !== undefined && row[key] !== '' && row[key] !== null && row[key] !== undefined) {
      return row[key];
    }
  }
  return '';
}

function parseRow(row: Record<string, unknown>, rowIndex: number): ParsedRow {
  const saleDate    = parseExcelDate(findCol(row, 'date'));
  const invRaw      = String(findCol(row, 'invoice', 'inv', 'bill') ?? '').trim();
  const customerRaw = String(findCol(row, 'customer', 'patient', 'client', 'name') ?? '').trim();
  const mobileRaw   = String(findCol(row, 'mobile', 'phone', 'contact') ?? '').trim();
  const medicine    = String(findCol(row, 'medicine', 'drug', 'item', 'product') ?? '').trim();
  const qty         = toNum(findCol(row, 'quantity', 'qty', 'quant'));
  const mrpRaw      = toNum(findCol(row, 'mrp', 'max retail'));
  const discRaw     = toNum(findCol(row, 'disc', 'discount'));
  const rateRaw     = toNum(findCol(row, 'rate', 'selling rate'));
  const netRaw      = toNum(findCol(row, 'net amount', 'net', 'total amount'));
  const amtRaw      = toNum(findCol(row, 'amount'));
  const payRaw      = findCol(row, 'payment', 'mode', 'pay');

  // Clamp discount to valid DB range [0, 100]
  const discount = Math.min(100, Math.max(0, discRaw));

  // Invoice: convert "10" → "INV-0010"; blank → sequential
  const invNum = parseInt(invRaw.replace(/\D/g, ''), 10);
  const invoiceNumber = !isNaN(invNum) && invNum > 0
    ? `INV-${String(invNum).padStart(4, '0')}-${String(rowIndex).padStart(3, '0')}`
    : `INV-IMP-${String(rowIndex).padStart(4, '0')}`;

  // Total: prefer Net Amount > Amount > qty*rate
  let totalAmount = netRaw || amtRaw || (qty * rateRaw);
  // selling_rate: prefer explicit rate column, then compute from mrp+discount, then infer from amount/qty
  let sellingRate = rateRaw
    || (mrpRaw > 0 ? parseFloat((mrpRaw * (1 - discount / 100)).toFixed(2)) : 0);
  if (sellingRate === 0 && qty > 0 && totalAmount > 0) sellingRate = parseFloat((totalAmount / qty).toFixed(2));
  if (totalAmount === 0 && qty > 0 && sellingRate > 0) totalAmount = qty * sellingRate;

  const mrp = mrpRaw || sellingRate;

  const customerName = customerRaw;
  const mobileNumber = (mobileRaw && mobileRaw !== '0') ? mobileRaw : '';

  // Original invoice number kept in remarks
  const remarks = invRaw && invRaw !== invoiceNumber ? `Ref: ${invRaw}` : '';

  const valid = !!(medicine && qty > 0 && totalAmount > 0);
  const error = !medicine ? 'Missing medicine name'
    : qty <= 0 ? 'Invalid quantity'
    : totalAmount <= 0 ? 'Invalid amount'
    : '';

  return {
    sale_date: saleDate,
    invoice_number: invoiceNumber,
    medicine_name: medicine,
    quantity: qty,
    mrp,
    discount,
    selling_rate: sellingRate,
    total_amount: totalAmount,
    payment_mode: normalizePayment(payRaw),
    customer_name: customerName,
    mobile_number: mobileNumber,
    remarks,
    _valid: valid,
    _error: error,
  };
}

// ── component ───────────────────────────────────────────────────────────────

export default function ImportData() {
  const { bulkCreateSales, loading } = useSales();
  const [fileName, setFileName]   = useState('');
  const [rows, setRows]           = useState<ParsedRow[]>([]);
  const [done, setDone]           = useState<{ inserted: number; failed: number } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setDone(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, unknown>[];
      const parsed = json
        .map((r, i) => parseRow(r, i + 1))
        .filter(r => r.medicine_name || r._error); // keep rows with something
      setRows(parsed);
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const validRows  = rows.filter(r => r._valid);
  const invalidRows = rows.filter(r => !r._valid);

  const totalAmount = validRows.reduce((s, r) => s + r.total_amount, 0);

  const handleImport = async () => {
    if (validRows.length === 0) { toast.error('No valid rows to import'); return; }
    // Strip UI-only fields (_valid, _error) before sending to the DB
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const dbRows = validRows.map(({ _valid, _error, ...rest }) => rest);
    const result = await bulkCreateSales(dbRows);
    setDone(result);
    if (result.inserted > 0) {
      toast.success(`Imported ${result.inserted} records successfully!`);
    }
    if (result.failed > 0) {
      toast.error(`${result.failed} records failed to insert (may be duplicates)`);
    }
  };

  const payBadge = (m: PayMode) =>
    m === 'Cash' ? <span className="badge-cash">{m}</span>
    : m === 'UPI' ? <span className="badge-upi">{m}</span>
    : <span className="badge-credit">{m}</span>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Import Sales Data</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload your Excel / CSV sales sheet — all data imports automatically
        </p>
      </div>

      {/* Instructions */}
      <div className="card bg-blue-50 border-blue-100">
        <h2 className="font-semibold text-blue-900 mb-2 text-sm">Expected Column Headers</h2>
        <div className="flex flex-wrap gap-2">
          {['Date', 'Invoice No', 'Customer Name', 'Mobile No', 'Medicine Name',
            'Quantity', 'MRP', 'Rate', 'Net Amount', 'Payment Mode'].map(c => (
            <span key={c} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-700 rounded text-xs font-mono">{c}</span>
          ))}
        </div>
        <p className="text-xs text-blue-600 mt-2">
          Column names are matched flexibly — partial matches work (e.g. "Net Amount" matches "Net Amt", "Amount" etc.)
        </p>
      </div>

      {/* Upload */}
      <div className="card">
        <label className="flex flex-col items-center justify-center w-full h-36 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 cursor-pointer hover:bg-blue-100 transition-colors">
          {fileName ? (
            <>
              <FileSpreadsheet size={28} className="text-green-500 mb-2" />
              <span className="font-semibold text-green-700 text-sm">{fileName}</span>
              <span className="text-xs text-gray-400 mt-1">Click to change file</span>
            </>
          ) : (
            <>
              <Upload size={28} className="text-blue-400 mb-2" />
              <span className="font-semibold text-blue-600 text-sm">Click to upload or drag & drop</span>
              <span className="text-xs text-gray-400 mt-1">.xlsx · .xls · .csv</span>
            </>
          )}
          <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </label>
      </div>

      {/* Summary + Import button */}
      {rows.length > 0 && (
        <div className="card space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5 text-green-700">
                <CheckCircle size={18} />
                <span className="font-semibold">{validRows.length} valid rows</span>
              </div>
              {invalidRows.length > 0 && (
                <div className="flex items-center gap-1.5 text-red-500">
                  <XCircle size={18} />
                  <span className="font-semibold">{invalidRows.length} skipped</span>
                </div>
              )}
              <span className="text-gray-500 text-sm">
                Total value: <strong className="text-gray-900">{formatCurrency(totalAmount)}</strong>
              </span>
            </div>
            <button
              onClick={handleImport}
              disabled={loading || validRows.length === 0}
              className="px-6 py-2.5 bg-blue-600 text-white font-semibold text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Importing...' : `Import ${validRows.length} Records`}
            </button>
          </div>

          {invalidRows.length > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
              <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
              <span>Rows shown in red are missing medicine name, quantity, or amount and will be skipped during import.</span>
            </div>
          )}
        </div>
      )}

      {/* Result banner */}
      {done && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium border ${
          done.inserted > 0
            ? 'bg-green-50 border-green-200 text-green-800'
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {done.inserted > 0
            ? <CheckCircle size={18} className="text-green-600" />
            : <XCircle size={18} className="text-red-500" />}
          {done.inserted > 0
            ? `Successfully imported ${done.inserted} sales records!`
            : 'Import failed — check for duplicate invoice numbers.'}
          {done.failed > 0 && done.inserted > 0 && (
            <span className="ml-2 text-amber-700">({done.failed} rows failed)</span>
          )}
        </div>
      )}

      {/* Preview table — desktop */}
      {rows.length > 0 && (
        <>
          <div className="hidden sm:block card overflow-x-auto">
            <h2 className="font-semibold text-gray-900 mb-3">Data Preview</h2>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-header w-6"></th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Invoice</th>
                  <th className="table-header">Medicine</th>
                  <th className="table-header">Customer</th>
                  <th className="table-header">Qty</th>
                  <th className="table-header">MRP</th>
                  <th className="table-header">Disc%</th>
                  <th className="table-header">Rate</th>
                  <th className="table-header text-right">Total</th>
                  <th className="table-header">Payment</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={row._valid ? 'hover:bg-gray-50' : 'bg-red-50 opacity-60'}>
                    <td className="table-cell">
                      {row._valid
                        ? <CheckCircle size={13} className="text-green-500" />
                        : <XCircle size={13} className="text-red-400" aria-label={row._error} />}
                    </td>
                    <td className="table-cell text-gray-500">{row.sale_date}</td>
                    <td className="table-cell font-mono text-blue-600">{row.invoice_number}</td>
                    <td className="table-cell font-medium max-w-[150px] truncate">
                      {row.medicine_name || <span className="text-red-400">—</span>}
                    </td>
                    <td className="table-cell text-gray-500 max-w-[140px]">
                      <div className="truncate">{row.customer_name || '—'}</div>
                      {row.mobile_number && <div className="text-gray-400 text-[11px]">{row.mobile_number}</div>}
                    </td>
                    <td className="table-cell">{row.quantity || <span className="text-red-400">0</span>}</td>
                    <td className="table-cell">₹{row.mrp}</td>
                    <td className="table-cell">{row.discount > 0 ? `${row.discount}%` : '—'}</td>
                    <td className="table-cell">₹{row.selling_rate}</td>
                    <td className="table-cell text-right font-semibold">{formatCurrency(row.total_amount)}</td>
                    <td className="table-cell">{payBadge(row.payment_mode)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-300">
                  <td colSpan={9} className="px-3 py-2 text-xs font-semibold text-gray-600">
                    Total ({validRows.length} valid records)
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">{formatCurrency(totalAmount)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="sm:hidden space-y-2">
            <h2 className="font-semibold text-gray-900">Data Preview</h2>
            {rows.map((row, i) => (
              <div key={i} className={`card space-y-1.5 ${!row._valid ? 'border-red-200 bg-red-50' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {row._valid
                      ? <CheckCircle size={14} className="text-green-500 flex-shrink-0" />
                      : <XCircle size={14} className="text-red-400 flex-shrink-0" />}
                    <span className="font-medium text-sm">{row.medicine_name || <span className="text-red-400">Missing name</span>}</span>
                  </div>
                  <span className="font-bold text-sm">{formatCurrency(row.total_amount)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{row.sale_date}</span>
                  <span className="font-mono text-blue-500">{row.invoice_number}</span>
                  {payBadge(row.payment_mode)}
                </div>
                {row.customer_name && <p className="text-xs text-gray-400">{row.customer_name}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
