// ============================================================
// CropFit — Admin Subtree Layout
// Automatically wraps all /admin routes with AdminGuard
// ============================================================

import React from 'react';
import { AdminGuard } from '@/components/admin-guard';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminGuard>{children}</AdminGuard>;
}
