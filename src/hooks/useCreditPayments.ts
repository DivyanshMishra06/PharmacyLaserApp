import { useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';

export function useCreditPayments() {
  const [loading, setLoading] = useState(false);

  const fetchTotalPaidByCustomer = useCallback(async (): Promise<Map<string, number>> => {
    try {
      const { data, error } = await supabase
        .from('credit_payments')
        .select('customer_name, amount');
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of data || []) {
        map.set(row.customer_name, (map.get(row.customer_name) || 0) + (row.amount as number));
      }
      return map;
    } catch {
      return new Map();
    }
  }, []);

  const recordPayment = useCallback(async (data: {
    customer_name: string;
    mobile_number?: string;
    amount: number;
    payment_mode: 'Cash' | 'UPI';
    paid_date: string;
    remarks?: string;
  }): Promise<boolean> => {
    setLoading(true);
    try {
      const { error } = await supabase.from('credit_payments').insert({
        customer_name: data.customer_name,
        mobile_number: data.mobile_number || null,
        amount: data.amount,
        payment_mode: data.payment_mode,
        paid_date: data.paid_date,
        remarks: data.remarks?.trim() || null,
      });
      if (error) throw error;
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, fetchTotalPaidByCustomer, recordPayment };
}
