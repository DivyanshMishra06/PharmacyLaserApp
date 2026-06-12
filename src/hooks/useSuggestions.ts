import { useEffect, useState } from 'react';
import { supabase } from '../utils/supabase';

export interface MedicineDetail {
  batch_number: string;
  expiry_date: string;
  mrp: string;
}

export function useSuggestions() {
  const [customers, setCustomers] = useState<string[]>([]);
  const [mobiles, setMobiles] = useState<string[]>([]);
  const [medicines, setMedicines] = useState<string[]>([]);
  const [medicineDetails, setMedicineDetails] = useState<Map<string, MedicineDetail>>(new Map());
  const [mobileToCustomer, setMobileToCustomer] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    supabase
      .from('sales')
      .select('customer_name, mobile_number')
      .not('customer_name', 'is', null)
      .limit(2000)
      .then(({ data }) => {
        if (data) {
          const seen = new Set<string>();
          const unique: string[] = [];
          [...data]
            .filter((d) => d.customer_name)
            .sort((a, b) => (a.customer_name as string).localeCompare(b.customer_name as string))
            .forEach((d) => {
              const name = (d.customer_name as string).trim();
              const mobile = ((d.mobile_number as string) || '').trim();
              const key = `${name}||${mobile}`;
              if (!seen.has(key)) {
                seen.add(key);
                unique.push(mobile ? `${name} | ${mobile}` : name);
              }
            });
          setCustomers(unique);

          // Build mobile suggestions list ("MOBILE | NAME") and reverse map
          const mobileMap = new Map<string, string>();
          const mobileSeen = new Set<string>();
          const mobileList: string[] = [];
          data.filter((d) => d.mobile_number).forEach((d) => {
            const mobile = (d.mobile_number as string).trim();
            const name = (d.customer_name as string || '').trim();
            if (!mobile) return;
            if (name && !mobileMap.has(mobile)) mobileMap.set(mobile, name);
            const entry = name ? `${mobile} | ${name}` : mobile;
            if (!mobileSeen.has(entry)) { mobileSeen.add(entry); mobileList.push(entry); }
          });
          setMobiles(mobileList.sort());
          setMobileToCustomer(mobileMap);
        }
      });

    // Fetch most-recent batch/expiry per medicine (order DESC so first hit = latest)
    supabase
      .from('sales')
      .select('medicine_name, batch_number, expiry_date, mrp')
      .order('created_at', { ascending: false })
      .limit(2000)
      .then(({ data }) => {
        if (data) {
          const namesSeen = new Set<string>();
          const names: string[] = [];
          const details = new Map<string, MedicineDetail>();

          data.filter((d) => d.medicine_name).forEach((d) => {
            const name = (d.medicine_name as string).trim();
            if (!namesSeen.has(name)) {
              namesSeen.add(name);
              names.push(name);
              details.set(name, {
                batch_number: (d.batch_number as string) || '',
                expiry_date: (d.expiry_date as string) || '',
                mrp: d.mrp != null ? String(d.mrp) : '',
              });
            }
          });

          setMedicines(names.sort((a, b) => a.localeCompare(b)));
          setMedicineDetails(details);
        }
      });
  }, []);

  return { customers, mobiles, medicines, medicineDetails, mobileToCustomer };
}
