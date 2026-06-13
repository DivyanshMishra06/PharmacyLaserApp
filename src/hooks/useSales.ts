import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import type { Sale, SaleFormData } from '../types';
import { todayISO, generateInvoiceNumber } from '../utils/helpers';

export function useSales() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSalesByDateRange = useCallback(async (startDate: string, endDate: string): Promise<Sale[]> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('sales')
        .select('*')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('created_at', { ascending: false });
      if (err) throw err;
      return data || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch sales';
      setError(msg);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTodaySales = useCallback(async (): Promise<Sale[]> => {
    const today = todayISO();
    return fetchSalesByDateRange(today, today);
  }, [fetchSalesByDateRange]);

  const getNextInvoiceNumber = useCallback(async (): Promise<string> => {
    const { data } = await supabase
      .from('sales')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    if (!data || data.length === 0) return 'INV-0001';

    const last = data[0].invoice_number as string;
    const match = last.match(/INV-(\d+)/);
    if (!match) return 'INV-0001';
    return generateInvoiceNumber(parseInt(match[1], 10));
  }, []);

  const createSale = useCallback(async (formData: SaleFormData): Promise<Sale[] | null> => {
    setLoading(true);
    setError(null);
    try {
      const invoiceNumber = await getNextInvoiceNumber();
      const mobile = formData.mobile_number.trim();
      const billDiscFactor = 1 - (parseFloat(formData.bill_discount) || 0) / 100;
      const records = formData.medicines.map((med) => {
        const batch = med.batch_number.trim();
        const expiry = med.expiry_date.trim();
        const rowTotal = parseFloat(med.total_amount) || 0;
        const mrpVal = parseFloat(med.mrp) || 0;
        const discVal = parseFloat(med.discount) || 0;
        const sellingRate = parseFloat((mrpVal * (1 - discVal / 100)).toFixed(2));
        return {
          sale_date: todayISO(),
          invoice_number: invoiceNumber,
          medicine_name: med.medicine_name.trim(),
          quantity: parseFloat(med.quantity) || 0,
          mrp: mrpVal,
          selling_rate: sellingRate,
          discount: discVal,
          bill_discount: parseFloat(formData.bill_discount) || 0,
          total_amount: parseFloat((rowTotal * billDiscFactor).toFixed(2)) || 0,
          payment_mode: formData.payment_mode,
          customer_name: formData.customer_name.trim() || null,
          remarks: formData.remarks.trim() || null,
          ...(mobile ? { mobile_number: mobile } : {}),
          ...(batch ? { batch_number: batch } : {}),
          ...(expiry ? { expiry_date: expiry } : {}),
        };
      });
      const { data, error: err } = await supabase
        .from('sales')
        .insert(records)
        .select();
      if (err) throw err;
      return data || [];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create sale';
      console.error('createSale error:', err);
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, [getNextInvoiceNumber]);

  const updateSale = useCallback(async (
    id: string,
    formData: SaleFormData,
    invoiceNumber?: string,
  ): Promise<Sale | null> => {
    setLoading(true);
    setError(null);
    try {
      const med = formData.medicines[0];
      const mobile = formData.mobile_number.trim();
      const batch = med.batch_number.trim();
      const expiry = med.expiry_date.trim();
      const mrpVal = parseFloat(med.mrp) || 0;
      const discVal = parseFloat(med.discount) || 0;
      const sellingRate = parseFloat((mrpVal * (1 - discVal / 100)).toFixed(2));

      // Invoice-level fields shared across all rows of the same invoice
      const invoiceFields = {
        payment_mode: formData.payment_mode,
        customer_name: formData.customer_name.trim() || null,
        mobile_number: mobile || null,
        remarks: formData.remarks.trim() || null,
      };

      const payload = {
        medicine_name: med.medicine_name.trim(),
        quantity: parseFloat(med.quantity) || 0,
        mrp: mrpVal,
        selling_rate: sellingRate,
        discount: discVal,
        total_amount: parseFloat(med.total_amount) || 0,
        ...invoiceFields,
        ...(batch ? { batch_number: batch } : {}),
        ...(expiry ? { expiry_date: expiry } : {}),
      };

      const { data, error: err } = await supabase
        .from('sales')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;

      // Propagate invoice-level fields to sibling rows (same invoice, different medicine rows)
      if (invoiceNumber) {
        await supabase
          .from('sales')
          .update(invoiceFields)
          .eq('invoice_number', invoiceNumber)
          .neq('id', id);
      }

      return data;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update sale';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const saveInvoiceEdit = useCallback(async (
    invoiceNumber: string,
    originalSaleDate: string,
    formData: SaleFormData,
    removedIds: string[],
  ): Promise<{ updated: Sale[]; inserted: Sale[] } | null> => {
    setLoading(true);
    setError(null);
    try {
      const mobile = formData.mobile_number.trim();
      const billDiscFactor = 1 - (parseFloat(formData.bill_discount) || 0) / 100;
      const invoiceFields = {
        payment_mode: formData.payment_mode,
        customer_name: formData.customer_name.trim() || null,
        mobile_number: mobile || null,
        remarks: formData.remarks.trim() || null,
      };

      // 1. Delete removed rows
      if (removedIds.length > 0) {
        const { error: delErr } = await supabase.from('sales').delete().in('id', removedIds);
        if (delErr) throw delErr;
      }

      // 2. Update existing rows
      const billDiscVal = parseFloat(formData.bill_discount) || 0;
      const updated: Sale[] = [];
      for (const med of formData.medicines.filter((m) => m.id)) {
        const mrpVal = parseFloat(med.mrp) || 0;
        const discVal = parseFloat(med.discount) || 0;
        const rowTotal = parseFloat(med.total_amount) || 0;
        const { data, error: updErr } = await supabase
          .from('sales')
          .update({
            medicine_name: med.medicine_name.trim(),
            quantity: parseFloat(med.quantity) || 0,
            mrp: mrpVal,
            selling_rate: parseFloat((mrpVal * (1 - discVal / 100)).toFixed(2)),
            discount: discVal,
            bill_discount: billDiscVal,
            total_amount: parseFloat((rowTotal * billDiscFactor).toFixed(2)),
            batch_number: med.batch_number.trim() || null,
            expiry_date: med.expiry_date.trim() || null,
            ...invoiceFields,
          })
          .eq('id', med.id!)
          .select()
          .single();
        if (updErr) throw updErr;
        if (data) updated.push(data);
      }

      // 3. Insert new rows (use original sale_date, not today)
      const inserted: Sale[] = [];
      const newMeds = formData.medicines.filter((m) => !m.id);
      if (newMeds.length > 0) {
        const records = newMeds.map((med) => {
          const mrpVal = parseFloat(med.mrp) || 0;
          const discVal = parseFloat(med.discount) || 0;
          const rowTotal = parseFloat(med.total_amount) || 0;
          const batch = med.batch_number.trim();
          const expiry = med.expiry_date.trim();
          return {
            sale_date: originalSaleDate,
            invoice_number: invoiceNumber,
            medicine_name: med.medicine_name.trim(),
            quantity: parseFloat(med.quantity) || 0,
            mrp: mrpVal,
            selling_rate: parseFloat((mrpVal * (1 - discVal / 100)).toFixed(2)),
            discount: discVal,
            bill_discount: billDiscVal,
            total_amount: parseFloat((rowTotal * billDiscFactor).toFixed(2)),
            ...invoiceFields,
            ...(batch ? { batch_number: batch } : {}),
            ...(expiry ? { expiry_date: expiry } : {}),
          };
        });
        const { data, error: insErr } = await supabase.from('sales').insert(records).select();
        if (insErr) throw insErr;
        if (data) inserted.push(...data);
      }

      return { updated, inserted };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save invoice';
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateInvoiceCustomer = useCallback(async (
    invoiceNumber: string,
    customerName: string,
    mobileNumber: string,
  ): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase
        .from('sales')
        .update({
          customer_name: customerName.trim() || null,
          mobile_number: mobileNumber.trim() || null,
        })
        .eq('invoice_number', invoiceNumber);
      if (err) throw err;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update customer info';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteSale = useCallback(async (id: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.from('sales').delete().eq('id', id);
      if (err) throw err;
      return true;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete sale';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const bulkCreateSales = useCallback(async (rows: {
    sale_date: string;
    invoice_number: string;
    medicine_name: string;
    quantity: number;
    mrp: number;
    discount?: number;
    selling_rate: number;
    total_amount: number;
    payment_mode: 'Cash' | 'UPI' | 'Credit';
    customer_name?: string;
    mobile_number?: string;
    remarks?: string;
  }[]): Promise<{ inserted: number; failed: number }> => {
    setLoading(true);
    setError(null);
    let inserted = 0;
    let failed = 0;
    // Insert in batches of 50
    const BATCH = 50;
    try {
      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH);
        const { data, error: err } = await supabase
          .from('sales')
          .insert(batch)
          .select();
        if (err) {
          failed += batch.length;
        } else {
          inserted += (data || []).length;
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk insert failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
    return { inserted, failed };
  }, []);

  const fetchAllSales = useCallback(async (): Promise<Sale[]> => {
    try {
      const { data, error: err } = await supabase
        .from('sales')
        .select('medicine_name, batch_number, expiry_date, sale_date, quantity')
        .not('expiry_date', 'is', null)
        .neq('expiry_date', '')
        .order('sale_date', { ascending: false });
      if (err) throw err;
      return (data || []) as Sale[];
    } catch {
      return [];
    }
  }, []);

  return {
    loading,
    error,
    fetchTodaySales,
    fetchSalesByDateRange,
    fetchAllSales,
    createSale,
    updateSale,
    saveInvoiceEdit,
    updateInvoiceCustomer,
    deleteSale,
    getNextInvoiceNumber,
    bulkCreateSales,
  };
}
