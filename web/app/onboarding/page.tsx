// ============================================================
// CropFit — Dedicated Farmer Onboarding Wizard (`/onboarding`)
// Clean, intentional, distraction-free flow:
// Step 1: Create Greenhouse
// Step 2: Pair Edge Hub
// Step 3: Configure / Detect Sensors
// Step 4: Review & Finish
// ============================================================

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import { apiFetch } from '@/lib/api';
import { SproutIcon, DevicesIcon, CheckCircleIcon, LogOutIcon } from '@/components/icons';

interface GreenhouseData {
  id: number;
  name: string;
  location: string;
  crop: string;
}

interface HubData {
  id: number;
  node_id: string;
  node_name: string;
}

const CROP_OPTIONS = [
  { value: 'Tomato', label: 'Tomato' },
  { value: 'Bell Pepper', label: 'Bell Pepper / Capsicum' },
  { value: 'Cucumber', label: 'Cucumber' },
  { value: 'Strawberry', label: 'Strawberry' },
  { value: 'Chili', label: 'Chili' },
  { value: 'Leafy Greens', label: 'Leafy Greens / Lettuce' },
  { value: 'Other', label: 'Other' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuthStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [submitting, setSubmitting] = useState(false);

  // Step 1: Greenhouse fields
  const [ghName, setGhName] = useState('');
  const [ghLocation, setGhLocation] = useState('');
  const [ghCrop, setGhCrop] = useState('Tomato');
  const [ghArea, setGhArea] = useState('500');
  const [ghAreaUnit, setGhAreaUnit] = useState('m²');
  const [activeGreenhouse, setActiveGreenhouse] = useState<GreenhouseData | null>(null);

  // Step 2: Hub pairing fields
  const [hubId, setHubId] = useState('GN-HUB-8F21');
  const [claimCode, setClaimCode] = useState('');
  const [activeHub, setActiveHub] = useState<HubData | null>(null);

  // Step 3: Devices / Sensors fields
  const [deviceCategory, setDeviceCategory] = useState<'sensor' | 'actuator'>('sensor');
  const [deviceId, setDeviceId] = useState('dht22-north-01');
  const [deviceModel, setDeviceModel] = useState('DHT22 Temperature & Humidity');
  const [deviceUnit, setDeviceUnit] = useState('°C');
  const [configuredDevices, setConfiguredDevices] = useState<
    Array<{ id: string; name: string; type: string; category: 'sensor' | 'actuator' }>
  >([]);

  // Safe display name helper (avoids 'undefined undefined')
  const displayName =
    user?.first_name && user?.last_name
      ? `${user.first_name} ${user.last_name}`
      : user?.username || user?.email || 'Farmer';

  // Restore onboarding progress from backend
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login?redirect=/onboarding');
      return;
    }

    async function restoreProgress() {
      try {
        const res = await apiFetch.get<{
          onboarding_completed: boolean;
          onboarding_step: 'CREATE_GREENHOUSE' | 'CLAIM_HUB' | 'CONFIGURE_DEVICES' | 'COMPLETED';
          greenhouse?: GreenhouseData;
          hub?: HubData;
        }>('/auth/onboarding-status/');

        if (res.greenhouse) {
          setActiveGreenhouse(res.greenhouse);
          setGhName(res.greenhouse.name || '');
          setGhLocation(res.greenhouse.location || '');
          setGhCrop(res.greenhouse.crop || 'Tomato');
        }

        if (res.hub) {
          setActiveHub(res.hub);
          setHubId(res.hub.node_id || 'GN-HUB-8F21');
        }

        if (res.onboarding_completed) {
          router.replace('/');
          return;
        }

        if (res.onboarding_step === 'CLAIM_HUB') {
          setStep(2);
        } else if (res.onboarding_step === 'CONFIGURE_DEVICES') {
          setStep(3);
        } else if (res.onboarding_step === 'COMPLETED') {
          setStep(4);
        } else {
          setStep(1);
        }
      } catch (err) {
        console.warn('Could not restore onboarding step:', err);
      }
    }

    if (isAuthenticated) {
      restoreProgress();
    }
  }, [isAuthenticated, isLoading, router]);

  // STEP 1 SUBMIT: Create Greenhouse
  const handleCreateGreenhouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ghName.trim()) {
      toast.error('Greenhouse name is required', 'Missing Input');
      return;
    }

    setSubmitting(true);
    try {
      const fullLocation = ghLocation.trim()
        ? `${ghLocation.trim()} (${ghArea} ${ghAreaUnit})`
        : `${ghArea} ${ghAreaUnit}`;

      const created = await apiFetch.post<GreenhouseData>('/greenhouses/', {
        name: ghName.trim(),
        location: fullLocation,
        crop: ghCrop,
      });

      setActiveGreenhouse(created);
      toast.success(`Greenhouse "${created.name}" created!`, 'Step 1 Complete');
      setStep(2);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create greenhouse';
      toast.error(msg, 'Greenhouse Error');
    } finally {
      setSubmitting(false);
    }
  };

  // QR Code & Live Pairing State
  const [hubStatusState, setHubStatusState] = useState<'idle' | 'pairing' | 'waiting_heartbeat' | 'online'>('idle');

  // Helper: Parse pasted or scanned QR payload
  const handleClaimCodeChange = (raw: string) => {
    // Check if user pasted a QR payload: cropfit://claim?device=GN-HUB-8F21&code=482193
    if (raw.includes('cropfit://claim') || raw.includes('code=')) {
      try {
        const urlObj = new URL(raw.startsWith('cropfit://') ? raw.replace('cropfit://', 'http://localhost/') : raw);
        const dev = urlObj.searchParams.get('device');
        const cd = urlObj.searchParams.get('code');
        if (dev) setHubId(dev.toUpperCase());
        if (cd) setClaimCode(cd.toUpperCase());
        return;
      } catch {
        // Fallback standard text
      }
    }
    setClaimCode(raw.toUpperCase());
  };

  // STEP 2 SUBMIT: Pair Edge Hub
  const handlePairHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) {
      toast.error('Please enter the 8-character claim code from your Raspberry Pi.', 'Claim Code Needed');
      return;
    }

    if (!activeGreenhouse) {
      toast.error('Greenhouse context missing. Returning to Step 1.', 'Context Error');
      setStep(1);
      return;
    }

    setSubmitting(true);
    setHubStatusState('pairing');

    try {
      const claimed = await apiFetch.post<{
        status: string;
        device_id: string;
        node_name: string;
        id?: number;
      }>('/nodes/claim/', {
        device_id: hubId.trim().toUpperCase(),
        claim_code: claimCode.trim().toUpperCase(),
        greenhouse_id: activeGreenhouse.id,
        node_name: `${activeGreenhouse.name} Edge Hub`,
      });

      const currentHub = {
        id: claimed.id || 1,
        node_id: claimed.device_id || hubId,
        node_name: claimed.node_name || `${activeGreenhouse.name} Hub`,
      };
      setActiveHub(currentHub);

      toast.success(`Hub ${currentHub.node_id} claimed! Waiting for heartbeat...`, 'Hub Paired');
      setHubStatusState('waiting_heartbeat');

      // Poll node status for up to 10 seconds to verify online heartbeat
      let online = false;
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const checkNode = await apiFetch.get<{ is_online?: boolean; id?: number }>(`/nodes/${currentHub.id}/`);
          if (checkNode && checkNode.is_online) {
            online = true;
            break;
          }
        } catch {
          // Non-blocking
        }
      }

      setHubStatusState(online ? 'online' : 'idle');
      if (online) {
        toast.success(`Hub is ONLINE and streaming!`, 'Connected');
      }

      setStep(3);
    } catch (err: unknown) {
      setHubStatusState('idle');
      const msg = err instanceof Error ? err.message : 'Claim failed. Check code and verify hub is online.';
      toast.error(msg, 'Pairing Error');
    } finally {
      setSubmitting(false);
    }
  };


  // STEP 3 SUBMIT: Add Device
  const handleAddDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceId.trim()) {
      toast.error('Hardware device ID is required', 'Input Needed');
      return;
    }

    if (!activeHub) {
      toast.error('Edge Hub required before configuring devices.', 'Hub Error');
      return;
    }

    setSubmitting(true);
    try {
      if (deviceCategory === 'sensor') {
        await apiFetch.post('/sensors/', {
          node: activeHub.id,
          sensor_id: deviceId.trim(),
          sensor_type: deviceModel.trim(),
          unit: deviceUnit.trim(),
          is_active: true,
        });
        setConfiguredDevices((prev) => [
          ...prev,
          { id: deviceId.trim(), name: deviceModel.trim(), type: `${deviceModel} (${deviceUnit})`, category: 'sensor' },
        ]);
        toast.success(`Sensor ${deviceId} added & synced to Pi!`, 'Sensor Registered');
      } else {
        await apiFetch.post('/actuators/', {
          node: activeHub.id,
          actuator_id: deviceId.trim(),
          actuator_type: deviceModel.trim(),
          is_active: false,
        });
        setConfiguredDevices((prev) => [
          ...prev,
          { id: deviceId.trim(), name: deviceModel.trim(), type: deviceModel, category: 'actuator' },
        ]);
        toast.success(`Actuator ${deviceId} added & synced to Pi!`, 'Actuator Registered');
      }

      // Reset ID for next entry
      setDeviceId('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register device';
      toast.error(msg, 'Device Registration Error');
    } finally {
      setSubmitting(false);
    }
  };

  // Quick Preset Helper for Step 3
  const applyPreset = (preset: { category: 'sensor' | 'actuator'; id: string; model: string; unit: string }) => {
    setDeviceCategory(preset.category);
    setDeviceId(preset.id);
    setDeviceModel(preset.model);
    setDeviceUnit(preset.unit);
  };

  // STEP 4 FINISH: Mark Onboarding Complete
  const handleFinishOnboarding = async () => {
    setSubmitting(true);
    try {
      await apiFetch.post('/auth/onboarding-status/', { completed: true });
      // Update in-memory auth store user
      const currentUser = useAuthStore.getState().user;
      if (currentUser) {
        useAuthStore.setState({
          user: { ...currentUser, onboarding_completed: true, onboarding_step: 'COMPLETED' },
        });
      }
      toast.success('Greenhouse setup complete! Loading your live dashboard.', 'Welcome to CropFit');
      router.replace('/');
    } catch (err) {
      console.warn('Failed to update onboarding completed flag:', err);
      router.replace('/');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-emerald-50/20 text-slate-900 flex flex-col justify-between p-4 sm:p-6 md:p-10 relative overflow-hidden">
      
      {/* Focused Onboarding Top Header */}
      <header className="max-w-3xl w-full mx-auto flex items-center justify-between pb-6 border-b border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
            <SproutIcon size={22} />
          </div>
          <div>
            <span className="font-extrabold text-lg tracking-tight text-slate-900">CropFit</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
              Greenhouse Setup
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
          <span className="hidden sm:inline">Signed in as <strong className="text-slate-900">{displayName}</strong></span>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
          >
            <LogOutIcon size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Focused Wizard Container */}
      <main className="max-w-xl w-full mx-auto my-6 sm:my-8 bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 sm:p-10 space-y-8 relative z-10">
        
        {/* Stepper Progress */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span>Step {step} of 4</span>
            <span className="text-emerald-700 font-extrabold">
              {step === 1 && 'Create Greenhouse'}
              {step === 2 && 'Pair Edge Hub'}
              {step === 3 && 'Configure Sensors'}
              {step === 4 && 'Review & Finish'}
            </span>
          </div>

          {/* Stepper Nodes */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((s) => (
              <div
                key={s}
                className={`h-2 rounded-full transition-all duration-300 ${
                  s === step
                    ? 'bg-emerald-600 ring-2 ring-emerald-600/20'
                    : s < step
                    ? 'bg-emerald-500'
                    : 'bg-slate-100'
                }`}
              />
            ))}
          </div>
        </div>

        {/* ============================================================ */}
        {/* STEP 1: CREATE GREENHOUSE                                   */}
        {/* ============================================================ */}
        {step === 1 && (
          <form onSubmit={handleCreateGreenhouse} className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Create your first greenhouse</h2>
              <p className="text-xs text-slate-500">
                Register your growing environment before pairing hardware and sensors.
              </p>
            </div>

            <div className="space-y-4">
              {/* Greenhouse Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Greenhouse Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Example: Main Tomato Greenhouse"
                  value={ghName || ''}
                  onChange={(e) => setGhName(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-emerald-600 focus:border-emerald-600 transition-all bg-white"
                />
              </div>

              {/* Location & Crop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Location / Zone
                  </label>
                  <input
                    type="text"
                    placeholder="Example: Kandy - Block A"
                    value={ghLocation || ''}
                    onChange={(e) => setGhLocation(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-emerald-600 focus:border-emerald-600 transition-all bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Target Crop
                  </label>
                  <select
                    value={ghCrop}
                    onChange={(e) => setGhCrop(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-emerald-600 focus:border-emerald-600 transition-all bg-white cursor-pointer"
                  >
                    {CROP_OPTIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Greenhouse Area */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Greenhouse Area
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min="1"
                    value={ghArea || '500'}
                    onChange={(e) => setGhArea(e.target.value)}
                    placeholder="500"
                    className="col-span-2 px-4 py-3 rounded-xl border border-slate-300 text-sm focus:outline-emerald-600 focus:border-emerald-600 transition-all bg-white"
                  />
                  <select
                    value={ghAreaUnit || 'm²'}
                    onChange={(e) => setGhAreaUnit(e.target.value)}
                    className="col-span-1 px-3 py-3 rounded-xl border border-slate-300 text-sm focus:outline-emerald-600 bg-white cursor-pointer"
                  >
                    <option value="m²">m²</option>
                    <option value="sq ft">sq ft</option>
                    <option value="acres">acres</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? 'Creating...' : 'Create Greenhouse & Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* STEP 2: PAIR EDGE HUB                                       */}
        {/* ============================================================ */}
        {step === 2 && (
          <form onSubmit={handlePairHub} className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Pair Your CropFit Hub</h2>
              <p className="text-xs text-slate-500">
                Connect your Raspberry Pi gateway to your newly created greenhouse.
              </p>
            </div>

            {/* Greenhouse Association Badge */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/90 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Greenhouse:</span>
                <span className="font-extrabold text-emerald-900">{activeGreenhouse?.name || 'Greenhouse'}</span>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-white px-2.5 py-0.5 rounded-full border border-emerald-200">
                <CheckCircleIcon size={13} /> Selected
              </span>
            </div>

            {/* Quick Provisioning Instructions Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-600">
              <span className="font-bold text-slate-800 uppercase tracking-wider text-[10px] block">
                How to connect your hub:
              </span>
              <ol className="space-y-1.5 list-decimal list-inside text-[11px] leading-relaxed">
                <li>Power ON your Raspberry Pi CropFit Edge Hub.</li>
                <li>Connect your phone/laptop to hotspot <code className="bg-slate-200 px-1 py-0.5 rounded text-emerald-800 font-mono font-bold">CropFit-Hub-{(hubId || '').slice(-4) || 'XXXX'}</code>.</li>
                <li>Open <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-800 font-mono">http://192.168.4.1</code> and configure your Wi-Fi password.</li>
                <li>Enter the device information from the QR sticker below:</li>
              </ol>
            </div>

            <div className="space-y-4">
              {/* Hub ID / Serial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Device ID / Serial Number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="GN-HUB-8F21"
                  value={hubId || ''}
                  onChange={(e) => setHubId(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm font-mono focus:outline-emerald-600 bg-white uppercase"
                />
              </div>

              {/* Claim Code */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex justify-between items-center">
                  <span>Claim Code *</span>
                  <span className="text-[10px] font-normal text-slate-400">or paste QR code text</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={64}
                  placeholder="e.g. 482193 or CROPFIT1"
                  value={claimCode || ''}
                  onChange={(e) => handleClaimCodeChange(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 text-base font-mono tracking-widest text-center uppercase font-extrabold focus:outline-emerald-600 bg-white"
                />
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Enter the claim code printed on your Raspberry Pi QR sticker.
                </p>
              </div>
            </div>

            {/* Live Status Indicator */}
            {hubStatusState !== 'idle' && (
              <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/50 flex items-center gap-3 text-xs">
                {hubStatusState === 'pairing' && (
                  <>
                    <span className="w-3 h-3 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin" />
                    <span className="font-semibold text-emerald-800">Pairing hub with greenhouse...</span>
                  </>
                )}
                {hubStatusState === 'waiting_heartbeat' && (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-emerald-800">Waiting for hub telemetry heartbeat...</span>
                  </>
                )}
                {hubStatusState === 'online' && (
                  <>
                    <CheckCircleIcon size={16} className="text-emerald-600" />
                    <span className="font-bold text-emerald-800">Hub is ONLINE and ready!</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-2"
              >
                {submitting ? 'Pairing Hub...' : 'Pair Hub & Continue →'}
              </button>
            </div>
          </form>
        )}

        {/* ============================================================ */}
        {/* STEP 3: CONFIGURE / DETECT SENSORS                          */}
        {/* ============================================================ */}
        {step === 3 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-slate-900">Configure / Detect Sensors</h2>
              <p className="text-xs text-slate-500">
                Register sensors and actuators for <span className="font-semibold text-emerald-700">{activeHub?.node_name || 'Hub'}</span>.
                These are automatically synchronized down to your Raspberry Pi.
              </p>
            </div>

            {/* Quick Presets */}
            <div className="space-y-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                Quick Sensor Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyPreset({ category: 'sensor', id: 'dht22-north-01', model: 'DHT22 Temperature & Humidity', unit: '°C' })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 cursor-pointer"
                >
                  + DHT22 Temp & Humidity
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ category: 'sensor', id: 'soil-moist-01', model: 'Capacitive Soil Moisture', unit: '%' })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 cursor-pointer"
                >
                  + Soil Moisture
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ category: 'actuator', id: 'exhaust-fan-01', model: 'Exhaust Fan', unit: '' })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 cursor-pointer"
                >
                  + Exhaust Fan
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset({ category: 'actuator', id: 'valve-irrigation-01', model: 'Irrigation Solenoid Valve', unit: '' })}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-700 hover:border-emerald-500 cursor-pointer"
                >
                  + Water Valve
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleAddDevice} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
              <div className="grid grid-cols-2 gap-2 pb-2 border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => { setDeviceCategory('sensor'); setDeviceUnit('°C'); }}
                  className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    deviceCategory === 'sensor' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border text-slate-600'
                  }`}
                >
                  Sensor
                </button>
                <button
                  type="button"
                  onClick={() => { setDeviceCategory('actuator'); setDeviceUnit(''); }}
                  className={`py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                    deviceCategory === 'actuator' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-white border text-slate-600'
                  }`}
                >
                  Actuator / Relay
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Device Hardware ID</label>
                  <input
                    type="text"
                    required
                    value={deviceId || ''}
                    onChange={(e) => setDeviceId(e.target.value)}
                    placeholder="e.g. dht22-north-01"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Model / Type</label>
                  <input
                    type="text"
                    required
                    value={deviceModel || ''}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    placeholder="e.g. DHT22"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-emerald-600"
                  />
                </div>
              </div>

              {deviceCategory === 'sensor' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Unit</label>
                  <input
                    type="text"
                    value={deviceUnit || ''}
                    onChange={(e) => setDeviceUnit(e.target.value)}
                    placeholder="°C, %, lux"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-emerald-600"
                  />
                </div>
              )}

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : '+ Add Device'}
                </button>
              </div>
            </form>

            {/* Tray of added devices */}
            {configuredDevices.length > 0 && (
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                  Configured Hardware ({configuredDevices.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {configuredDevices.map((d, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-emerald-50 border border-emerald-300 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-1.5"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {d.id} ({d.name})
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-md shadow-emerald-600/20 cursor-pointer"
              >
                Continue to Review →
              </button>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* STEP 4: REVIEW & FINISH                                      */}
        {/* ============================================================ */}
        {step === 4 && (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-lg shadow-emerald-600/10">
                <CheckCircleIcon size={32} />
              </div>
              <h2 className="text-xl font-bold text-slate-900">Review & Launch</h2>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Everything is configured and ready to start streaming live greenhouse telemetry.
              </p>
            </div>

            {/* Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Greenhouse:</span>
                <span className="font-bold text-slate-900">{activeGreenhouse?.name || ghName || 'Main Greenhouse'}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Target Crop:</span>
                <span className="font-bold text-emerald-800">{activeGreenhouse?.crop || ghCrop}</span>
              </div>
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Edge Gateway:</span>
                <span className="font-bold text-slate-900">{activeHub?.node_id || hubId} (Active)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Connected Devices:</span>
                <span className="font-bold text-slate-900">
                  {configuredDevices.length > 0 ? `${configuredDevices.length} configured` : 'Ready for auto-detection'}
                </span>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={handleFinishOnboarding}
                className="w-full py-3.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm transition-all shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50"
              >
                {submitting ? 'Finalizing Setup...' : 'Complete Setup & Launch Dashboard →'}
              </button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  ← Modify Configured Devices
                </button>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* Focused Onboarding Footer */}
      <footer className="text-center text-xs text-slate-400 py-3">
        CropFit GreenNode Edge Ecosystem • Need assistance? Check our hardware installation guide.
      </footer>
    </div>
  );
}
