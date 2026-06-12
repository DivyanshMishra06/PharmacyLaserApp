import { useState } from 'react';
import { Edit2, Save, X, MapPin, FileText, Pill, Phone, Mail, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePharmacyProfile } from '../hooks/usePharmacyProfile';
import type { PharmacyProfile } from '../hooks/usePharmacyProfile';

export default function Profile() {
  const { profile, save } = usePharmacyProfile();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PharmacyProfile>(profile);

  const handleEdit = () => {
    setDraft(profile);
    setEditing(true);
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast.error('Pharmacy name is required');
      return;
    }
    save(draft);
    setEditing(false);
    toast.success('Profile saved');
  };

  const field = (key: keyof PharmacyProfile, value: string) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Pharmacy Profile</h1>
          <p className="text-gray-500 text-sm mt-0.5">Business & license details</p>
        </div>
        {!editing ? (
          <button
            onClick={handleEdit}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 size={16} />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
            >
              <Save size={16} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
            >
              <X size={16} />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Pharmacy Name Banner */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl p-6 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <Pill size={28} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                type="text"
                value={draft.name}
                onChange={(e) => field('name', e.target.value)}
                className="w-full bg-white/20 border border-white/40 rounded-lg px-3 py-2 text-white placeholder-white/60 font-bold text-xl focus:outline-none focus:border-white"
                placeholder="Pharmacy Name"
              />
            ) : (
              <h2 className="text-2xl font-bold leading-tight">{profile.name}</h2>
            )}
            <p className="text-blue-200 text-sm mt-1">Registered Pharmacy</p>
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <MapPin size={17} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">Address</h3>
        </div>
        {editing ? (
          <textarea
            value={draft.address}
            onChange={(e) => field('address', e.target.value)}
            rows={3}
            className="input-field resize-none"
            placeholder="Full address"
          />
        ) : (
          <p className="text-gray-700 leading-relaxed">{profile.address || '—'}</p>
        )}
      </div>

      {/* License Details */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck size={17} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">License & Tax Details</h3>
        </div>

        {/* GST */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-500">GST Number</span>
          {editing ? (
            <input
              type="text"
              value={draft.gst}
              onChange={(e) => field('gst', e.target.value)}
              className="input-field sm:col-span-2 uppercase"
              placeholder="GST number"
            />
          ) : (
            <span className="sm:col-span-2 font-mono font-semibold text-gray-900 text-sm tracking-wider">
              {profile.gst || '—'}
            </span>
          )}
        </div>

        {/* DL 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-500">Drug License No. 1</span>
          {editing ? (
            <input
              type="text"
              value={draft.dl1}
              onChange={(e) => field('dl1', e.target.value)}
              className="input-field sm:col-span-2 uppercase"
              placeholder="DL Number 1"
            />
          ) : (
            <div className="sm:col-span-2 flex items-center gap-2">
              <FileText size={15} className="text-gray-400 flex-shrink-0" />
              <span className="font-mono font-semibold text-gray-900 text-sm tracking-wide">
                {profile.dl1 || '—'}
              </span>
            </div>
          )}
        </div>

        {/* DL 2 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-3">
          <span className="text-sm font-medium text-gray-500">Drug License No. 2</span>
          {editing ? (
            <input
              type="text"
              value={draft.dl2}
              onChange={(e) => field('dl2', e.target.value)}
              className="input-field sm:col-span-2 uppercase"
              placeholder="DL Number 2"
            />
          ) : (
            <div className="sm:col-span-2 flex items-center gap-2">
              <FileText size={15} className="text-gray-400 flex-shrink-0" />
              <span className="font-mono font-semibold text-gray-900 text-sm tracking-wide">
                {profile.dl2 || '—'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Contact Details */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Phone size={17} className="text-blue-600" />
          <h3 className="font-semibold text-gray-800">Contact (optional)</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-3 border-b border-gray-100">
          <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
            <Phone size={13} /> Phone
          </span>
          {editing ? (
            <input
              type="tel"
              value={draft.phone}
              onChange={(e) => field('phone', e.target.value)}
              className="input-field sm:col-span-2"
              placeholder="Phone number"
            />
          ) : (
            <span className="sm:col-span-2 text-gray-700 text-sm">{profile.phone || '—'}</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-center py-3">
          <span className="text-sm font-medium text-gray-500 flex items-center gap-1.5">
            <Mail size={13} /> Email
          </span>
          {editing ? (
            <input
              type="email"
              value={draft.email}
              onChange={(e) => field('email', e.target.value)}
              className="input-field sm:col-span-2"
              placeholder="Email address"
            />
          ) : (
            <span className="sm:col-span-2 text-gray-700 text-sm">{profile.email || '—'}</span>
          )}
        </div>
      </div>
    </div>
  );
}
