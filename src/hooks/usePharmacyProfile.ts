import { useState } from 'react';

export interface PharmacyProfile {
  name: string;
  address: string;
  gst: string;
  dl1: string;
  dl2: string;
  phone: string;
  email: string;
}

const STORAGE_KEY = 'pharmacy_profile';

const DEFAULT_PROFILE: PharmacyProfile = {
  name: 'Fahrenheit Pharmacy',
  address: '610/03 Near Police Chowki, Keshav Nagar, Sitapur Road, Lucknow, UP 226020',
  gst: 'AZYPB2220L2Z3',
  dl1: 'RLF20UP2025019436',
  dl2: 'RLF21UP2025019376',
  phone: '',
  email: '',
};

function load(): PharmacyProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_PROFILE;
}

export function usePharmacyProfile() {
  const [profile, setProfile] = useState<PharmacyProfile>(load);

  const save = (updated: PharmacyProfile) => {
    setProfile(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  return { profile, save };
}

export function getPharmacyProfile(): PharmacyProfile {
  return load();
}
