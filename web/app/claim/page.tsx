// ============================================================
// CropFit — Device Claiming Page (`/claim`)
// Allows farmers to scan the QR sticker on their Raspberry Pi
// and link the device to their greenhouse account.
// ============================================================

'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { toast } from '@/lib/store/toast-store';
import { SproutIcon, ChevronRightIcon } from '@/components/icons';

function ClaimContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, token } = useAuthStore();

  const [claimCode, setClaimCode] = useState('');
  const [nodeName, setNodeName] = useState('');
  const [greenhouseId, setGreenhouseId] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [claimedDevice, setClaimedDevice] = useState<{
    deviceId: string;
    nodeName: string;
    greenhouseName: string;
  } | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      setClaimCode(code.toUpperCase());
    }
  }, [searchParams]);

  const handleClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimCode.trim()) {
      toast.error('Please enter the 8-character claim code.', 'Code Required');
      return;
    }

    if (!isAuthenticated) {
      // Save intended claim code and prompt login
      sessionStorage.setItem('cropfit_redirect', `/claim?code=${claimCode.trim()}`);
      toast.info('Please log in or create an account to claim this hub.', 'Login Required');
      router.push('/login');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/v1/nodes/claim/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          claim_code: claimCode.trim().toUpperCase(),
          greenhouse_id: parseInt(greenhouseId, 10) || 1,
          node_name: nodeName.trim() || 'Greenhouse Edge Hub',
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to claim device. Please verify your code.');
      }

      setClaimedDevice({
        deviceId: data.device_id,
        nodeName: data.node_name,
        greenhouseName: data.greenhouse_name || 'Greenhouse',
      });

      toast.success('Your GreenNode Hub is now active and syncing telemetry!', 'Hub Claimed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Claim failed';
      toast.error(message, 'Claim Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-emerald-100/60 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 mb-1">
            <SproutIcon className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Claim Your GreenNode Hub
          </h1>
          <p className="text-sm text-slate-500 max-w-xs mx-auto">
            Scan the QR sticker on your Raspberry Pi or enter the 8-character claim code below.
          </p>
        </div>

        {/* Claim Success State */}
        {claimedDevice ? (
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-emerald-200 space-y-5 text-center">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Hub Successfully Linked!</h2>
              <p className="text-sm text-slate-600 mt-1">
                <span className="font-medium text-slate-800">{claimedDevice.nodeName}</span> ({claimedDevice.deviceId}) is now assigned to <span className="font-medium text-slate-800">{claimedDevice.greenhouseName}</span>.
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 text-left">
              <strong>Next step:</strong> Your Raspberry Pi will automatically receive its cloud authorization token and transition into production mode. Telemetry will appear on your dashboard within seconds.
            </div>
            <button
              onClick={() => router.push('/')}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20"
            >
              Go to Greenhouse Dashboard
            </button>
          </div>
        ) : (
          /* Claim Form */
          <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-slate-200/80 space-y-5">
            <form onSubmit={handleClaim} className="space-y-4">
              <div>
                <label htmlFor="claimCode" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Device Claim Code
                </label>
                <input
                  id="claimCode"
                  type="text"
                  required
                  maxLength={12}
                  value={claimCode}
                  onChange={(e) => setClaimCode(e.target.value.toUpperCase())}
                  placeholder="e.g. GN-A8F2"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-base font-mono tracking-widest uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
                <p className="text-xs text-slate-400 mt-1">
                  Found on the QR label attached to your Raspberry Pi case.
                </p>
              </div>

              <div>
                <label htmlFor="nodeName" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Hub Name (Optional)
                </label>
                <input
                  id="nodeName"
                  type="text"
                  value={nodeName}
                  onChange={(e) => setNodeName(e.target.value)}
                  placeholder="e.g. Greenhouse 1 - Main Gateway"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label htmlFor="greenhouseId" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Assign to Greenhouse
                </label>
                <select
                  id="greenhouseId"
                  value={greenhouseId}
                  onChange={(e) => setGreenhouseId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all bg-white"
                >
                  <option value="1">Primary Greenhouse (ID: 1)</option>
                  <option value="2">Secondary Greenhouse (ID: 2)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-2 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-600/20 active:scale-[0.99] cursor-pointer"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Claim & Link Hub</span>
                    <ChevronRightIcon className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <Link href="/" className="hover:text-emerald-600 transition-colors">
                ← Back to Dashboard
              </Link>
              {!isAuthenticated && (
                <Link href="/login" className="text-emerald-600 font-semibold hover:underline">
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <ClaimContent />
    </Suspense>
  );
}
