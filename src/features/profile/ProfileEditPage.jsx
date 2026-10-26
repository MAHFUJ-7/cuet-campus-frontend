// Edit Profile — port of profile_edit_screen.dart.
// The CUET email + academic details are locked (coordinator-managed).
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Icon,
  PageHeader,
  PageShell,
  Spinner,
  TextField,
} from '../../components/ui/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { batchNumberLabel, parseUserProfile } from '../../lib/models.js';
import { validateName } from '../../lib/validators.js';
import { getProfile } from '../../api/endpoints.js';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';

function LockedRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-6 py-1.5">
      <span className="shrink-0 text-body-md text-ink-muted">{label}</span>
      <span className="text-right text-body-md font-bold text-ink">{value}</span>
    </div>
  );
}

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const toast = useToast();

  const profile = auth.profile;
  const [name, setName] = useState(profile?.name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const hydrated = useRef(false);

  // On a hard refresh the profile may arrive after mount — hydrate the fields.
  useEffect(() => {
    if (hydrated.current || !profile) return;
    hydrated.current = true;
    setName((current) => current || profile.name || '');
    setPhone((current) => current || profile.phone || '');
  }, [profile]);

  // Prefer the authoritative server phone when reachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getProfile();
        const parsed = parseUserProfile(extractPayload(response));
        if (!cancelled && parsed) {
          setName((current) => current || parsed.name || '');
          setPhone((current) => current || parsed.phone || '');
        }
      } catch {
        /* offline: keep the cached value prefilled */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const validate = () => {
    const next = {
      name: validateName(name.trim()),
      phone: (() => {
        const trimmed = phone.trim();
        if (!trimmed) return null; // optional
        if (trimmed.length < 6 || trimmed.length > 20) return 'Enter a valid phone number';
        return null;
      })(),
    };
    setErrors(next);
    return Object.values(next).every((v) => !v);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();

    try {
      if (auth.isOfflineSession) {
        await auth.updateProfileLocal({ name: trimmedName, phone: trimmedPhone });
        toast.success('Profile updated on this device');
        navigate(-1);
        return;
      }

      await auth.updateProfileServer({ name: trimmedName, phone: trimmedPhone });
      toast.success('Profile updated');
      navigate(-1);
    } catch (error) {
      // Degrade gracefully: keep the edits locally so nothing is lost.
      try {
        await auth.updateProfileLocal({ name: trimmedName, phone: trimmedPhone });
        toast.warning('Saved on this device — will sync when server is back');
        navigate(-1);
      } catch {
        toast.error(describeApiError(error));
      }
    } finally {
      setSaving(false);
    }
  };

  const email = profile?.email ?? '';
  const isStudentEmail = email.endsWith('@student.cuet.ac.bd');

  return (
    <PageShell className="max-w-2xl">
      <PageHeader title="Edit Profile" onBack={() => navigate(-1)} />

      {/* Locked identity */}
      <div className="flex items-center gap-3 rounded-2xl border border-outline bg-surface-variant/60 p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light">
          <Icon name="lock" size={20} />
        </span>
        <div className="min-w-0">
          <p className="text-label-md tracking-wide text-ink-muted">CUET EMAIL</p>
          <p className="truncate text-title-sm font-bold text-ink">{email}</p>
          <p className="text-label-sm text-ink-muted">
            {isStudentEmail
              ? 'Permanent student identity — cannot be changed'
              : 'Permanent staff identity — cannot be changed'}
          </p>
        </div>
      </div>

      {/* Locked academic block */}
      {profile && (
        <div className="mt-6">
          <h2 className="mb-2 text-title-lg font-bold text-ink">Academic Information</h2>
          <div className="rounded-2xl border border-outline bg-surface-variant/60 p-4">
            <LockedRow label="Student ID" value={profile.studentId || 'N/A'} />
            <LockedRow label="Department" value={profile.department?.name ?? 'N/A'} />
            <LockedRow
              label="Batch"
              value={batchNumberLabel(profile.batch) || 'N/A'}
            />
            <LockedRow label="Section" value={profile.section?.name ?? 'N/A'} />
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="mt-6">
        <h2 className="mb-3 text-title-lg font-bold text-ink">Personal Information</h2>
        <TextField
          label="Full name"
          icon="person"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <div className="mt-4">
          <TextField
            label="Phone (optional)"
            icon="call"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-title-md font-semibold text-white transition-colors hover:bg-primary-light disabled:opacity-60"
        >
          {saving ? <Spinner size={18} /> : <Icon name="save" size={20} />}
          {saving ? 'Saving…' : 'Save changes'}
        </button>

        <p className="mt-2.5 text-center text-label-md text-ink-muted">
          Only your name and phone can be changed. Academic details are managed by your Course
          Coordinator.
        </p>
      </form>
    </PageShell>
  );
}
