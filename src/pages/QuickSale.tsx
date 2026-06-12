import { useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { CheckCircle } from 'lucide-react';
import SaleForm from '../components/SaleForm';
import { useSales } from '../hooks/useSales';
import { useSuggestions } from '../hooks/useSuggestions';
import type { SaleFormData, MedicineItem } from '../types';

const EMPTY_MEDICINE: MedicineItem = {
  medicine_name: '',
  batch_number: '',
  expiry_date: '',
  quantity: '',
  mrp: '',
  selling_rate: '',
  discount: '',
  total_amount: '',
};

function makeEmptyForm(customer = '', mobile = ''): SaleFormData {
  return {
    customer_name: customer,
    mobile_number: mobile,
    payment_mode: 'Cash',
    remarks: '',
    bill_discount: '',
    medicines: [{ ...EMPTY_MEDICINE }],
  };
}

// Formula: Total = (Qty × MRP) − Discount (Rate column removed)
function calcRowTotal(qty: string, mrp: string, discount: string): string {
  const q = parseFloat(qty) || 0;
  const m = parseFloat(mrp) || 0;
  const d = parseFloat(discount) || 0;
  if (q <= 0 && m <= 0) return '';
  return Math.max(0, q * m * (1 - d / 100)).toFixed(2);
}

function validate(data: SaleFormData): string | null {
  const filled = data.medicines.filter((m) => m.medicine_name.trim());
  if (filled.length === 0) return 'At least one medicine is required';
  for (let i = 0; i < filled.length; i++) {
    const med = filled[i];
    const label = filled.length > 1 ? ` (Medicine ${i + 1})` : '';
    const qty = parseFloat(med.quantity);
    if (!qty || qty <= 0) return `Quantity must be > 0${label}`;
    const mrp = parseFloat(med.mrp);
    if (isNaN(mrp) || mrp <= 0) return `MRP must be > 0${label}`;
  }
  return null;
}

export default function QuickSale() {
  const { createSale, loading } = useSales();
  const { customers, mobiles, medicines, medicineDetails, mobileToCustomer } = useSuggestions();
  const [searchParams] = useSearchParams();
  const [formData, setFormData] = useState<SaleFormData>(
    makeEmptyForm(searchParams.get('customer') || '', searchParams.get('mobile') || ''),
  );
  const [lastInvoice, setLastInvoice] = useState<string | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  const handleFieldChange = (field: keyof Omit<SaleFormData, 'medicines'>, value: string) => {
    if (field === 'mobile_number') {
      const matched = mobileToCustomer.get(value.trim());
      setFormData((prev) => ({
        ...prev,
        mobile_number: value,
        ...(matched ? { customer_name: matched } : {}),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleMedicineChange = (index: number, field: keyof MedicineItem, value: string) => {
    setFormData((prev) => {
      const medicines = [...prev.medicines];
      const updated = { ...medicines[index], [field]: value };
      // Auto-recalculate row total on qty / mrp / discount change
      if (field === 'quantity' || field === 'mrp' || field === 'discount') {
        updated.total_amount = calcRowTotal(
          field === 'quantity' ? value : updated.quantity,
          field === 'mrp' ? value : updated.mrp,
          field === 'discount' ? value : updated.discount,
        );
      }
      medicines[index] = updated;
      return { ...prev, medicines };
    });
  };

  const handleAddMedicine = () => {
    setFormData((prev) => {
      if (prev.medicines.length >= 10) return prev;
      return { ...prev, medicines: [...prev.medicines, { ...EMPTY_MEDICINE }] };
    });
  };

  const handleRemoveMedicine = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      medicines: prev.medicines.filter((_, i) => i !== index),
    }));
  };

  const handleMedicineNameSelect = (index: number, name: string) => {
    const detail = medicineDetails.get(name);
    if (!detail) return;
    setFormData((prev) => {
      const medicines = [...prev.medicines];
      const updated = {
        ...medicines[index],
        ...(detail.batch_number ? { batch_number: detail.batch_number } : {}),
        ...(detail.expiry_date ? { expiry_date: detail.expiry_date } : {}),
        ...(detail.mrp ? { mrp: detail.mrp } : {}),
      };
      if (detail.mrp) {
        updated.total_amount = calcRowTotal(updated.quantity, detail.mrp, updated.discount);
      }
      medicines[index] = updated;
      return { ...prev, medicines };
    });
  };

  const handleDuplicateMedicine = (index: number) => {
    setFormData((prev) => {
      const medicines = [...prev.medicines];
      medicines.splice(index + 1, 0, { ...medicines[index] });
      return { ...prev, medicines };
    });
  };

  const submitSale = async (): Promise<boolean> => {
    const filled = formData.medicines.filter((m) => m.medicine_name.trim());
    const filledData = { ...formData, medicines: filled };
    // Remove empty rows from the visible form too
    if (filled.length < formData.medicines.length) {
      setFormData((prev) => ({ ...prev, medicines: filled.length ? filled : [{ ...EMPTY_MEDICINE }] }));
    }
    const err = validate(filledData);
    if (err) { toast.error(err); return false; }
    const sales = await createSale(filledData);
    if (sales && sales.length > 0) {
      setLastInvoice(sales[0].invoice_number);
      toast.success(`Saved! Invoice: ${sales[0].invoice_number}`);
      return true;
    }
    toast.error('Failed to save sale — check browser console.');
    return false;
  };

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const ok = await submitSale();
    if (ok) setFormData(makeEmptyForm());
  };

  const handleSaveNew = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const ok = await submitSale();
    if (ok) {
      setFormData(makeEmptyForm());
      topRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-4" ref={topRef}>
      <div>
        <h1 className="page-title">Sale Entry</h1>
        <p className="text-gray-500 text-sm mt-0.5">Create a new customer bill</p>
      </div>

      {lastInvoice && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 text-sm">
          <CheckCircle size={18} className="text-green-600 flex-shrink-0" />
          <span>Last saved: <strong>{lastInvoice}</strong></span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <SaleForm
          formData={formData}
          onFieldChange={handleFieldChange}
          onMedicineChange={handleMedicineChange}
          onAddMedicine={handleAddMedicine}
          onRemoveMedicine={handleRemoveMedicine}
          onDuplicateMedicine={handleDuplicateMedicine}
          onSubmit={handleSave}
          onSubmitNew={handleSaveNew}
          loading={loading}
          customerSuggestions={customers}
          mobileSuggestions={mobiles}
          medicineSuggestions={medicines}
          onMedicineNameSelect={handleMedicineNameSelect}
        />
      </div>
    </div>
  );
}
