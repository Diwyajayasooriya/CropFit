# CropFit Frontend Audit Report

## 1. Current Page Routes

| Route | File | Status |
|---|---|---|
| `/` | `app/page.tsx` | Monolithic dashboard — no greenhouse selector, no charts, no recommendations |
| `/login` | `app/login/page.tsx` | ✅ Working — real JWT auth to Django |
| `/onboarding` | `app/onboarding/page.tsx` | ✅ Working — 4-step wizard (greenhouse → hub → devices → review) |
| `/claim` | `app/claim/page.tsx` | ⚠️ Partially working — calls `/api/v1/nodes/claim/` but uses `token` prop that doesn't exist on auth store |
| `/devices` | `app/devices/page.tsx` | ⚠️ Mixed — imports mock data as fallback, also fetches from real API |
| `/rules` | `app/rules/page.tsx` | ✅ Working — fetches from `/api/v1/rules/` with role-based toggle |
| `/alerts` | `app/alerts/page.tsx` | ⚠️ Uses `is_read` but backend uses `is_resolved` — field mismatch |
| `/settings` | `app/settings/page.tsx` | ❌ Static dummy form — no API integration |
| `/admin` | `app/admin/page.tsx` | ✅ Working admin portal with separate guard |
| `/admin/login` | `app/admin/login/page.tsx` | ✅ Working admin login |
| `/greenhouses` | — | ❌ **Missing** |
| `/greenhouses/[id]` | — | ❌ **Missing** |
| `/automation` | — | ❌ **Missing** |
| `/automation/rules` | — | ❌ **Missing** (rules currently at `/rules`) |

## 2. Current Components

| Component | File | Reuse? |
|---|---|---|
| `AppShell` | `components/app-shell.tsx` | **Replace** — 386-line monolith, split into Sidebar + Topbar + MobileNav |
| `LayoutWrapper` | `components/layout-wrapper.tsx` | **Reuse** with minor update to exclude `/claim` properly |
| `AuthGuard` | `components/auth-guard.tsx` | ✅ **Reuse as-is** |
| `AdminGuard` | `components/admin-guard.tsx` | ✅ **Reuse as-is** |
| `Icons` | `components/icons.tsx` | ✅ **Reuse** — excellent zero-dep SVG icons (30+ icons) |
| `Skeletons` | `components/skeletons.tsx` | ✅ **Reuse** with additions for new pages |
| `ToastContainer` | `components/toast.tsx` | ✅ **Reuse as-is** |
| `ErrorBoundary` | `components/error-boundary.tsx` | ✅ **Reuse as-is** |

## 3. Current API Layer

### `lib/api.ts` — ✅ Excellent, Reuse as-is
- Centralized `api<T>()` and `apiFetch` wrappers
- Automatic JWT injection via `Authorization: Bearer <token>`
- Auto-refresh when token is within 60s of expiry
- Cookie sync for Next.js middleware (`cropfit_auth`, `cropfit_role`)
- Proper `ApiRequestError` class with DRF error extraction
- Environment variable: `NEXT_PUBLIC_API_URL` (defaults to `http://localhost:8000`)

### Django Backend Endpoints Available

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/auth/token/` | POST | Farmer JWT login |
| `/api/auth/admin/token/` | POST | Admin JWT login |
| `/api/auth/token/refresh/` | POST | Refresh access token |
| `/api/auth/me/` | GET | Current user profile + onboarding state |
| `/api/auth/onboarding-status/` | GET/POST | Onboarding progress check/update |
| `/api/v1/greenhouses/` | GET/POST | List/create greenhouses (auto-scoped to user) |
| `/api/v1/greenhouses/<id>/` | GET/PUT/PATCH/DELETE | Single greenhouse CRUD |
| `/api/v1/nodes/nodes/` | GET | List claimed nodes (hubs) |
| `/api/v1/nodes/nodes/<id>/sensors/` | GET | Sensors for a specific node |
| `/api/v1/nodes/nodes/<id>/actuators/` | GET | Actuators for a specific node |
| `/api/v1/nodes/claim/` | POST | Claim hub with device_id + claim_code + greenhouse_id |
| `/api/v1/nodes/sensors/` | GET/POST | All sensors CRUD |
| `/api/v1/nodes/actuators/` | GET/POST | All actuators CRUD |
| `/api/v1/nodes/actuators/<id>/command/` | POST | Send ON/OFF command |
| `/api/v1/devices/` | GET | Device registry (filterable by `?node=` and `?type=`) |
| `/api/v1/conditions/readings/` | GET | Telemetry history (filterable by `?device_id=` and `?hours=`) |
| `/api/v1/conditions/thresholds/` | GET | Condition thresholds |
| `/api/v1/rules/` | GET/POST/PATCH | Automation rules CRUD |
| `/api/v1/alerts/` | GET | Alert list (filterable by `?greenhouse=`, `?severity=`, `?resolved=`) |
| `/api/v1/alerts/<id>/acknowledge/` | PATCH | Mark alert as resolved |
| `/api/v1/reports/dashboard/` | GET | Dashboard summary (tiles + actuators + status) |
| `/api/v1/reports/summary/` | GET | Aggregated metrics (avg/min/max temp/humidity/soil) |

## 4. Authentication Mechanism
- **JWT tokens** stored in `localStorage` (`cropfit_tokens`) + mirrored as cookies
- **Zustand store** (`auth-store.ts`) with `login()`, `loginAdmin()`, `logout()`, `hydrate()`
- **Route protection**: Server-side via `middleware.ts` + client-side via `AuthGuard`
- **Onboarding guard**: Dashboard page checks `user.onboarding_completed === false` → redirects to `/onboarding`

## 5. State Management
- **Zustand v5** — three stores:
  - `auth-store.ts` — user auth, roles, login/logout
  - `dashboard-store.ts` — dashboard tiles, actuator states, WebSocket connection
  - `toast-store.ts` — notification toasts

## 6. Installed Frontend Libraries

| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.4 | Framework |
| `react` / `react-dom` | 19.2.8 | UI |
| `zustand` | ^5 | State management |
| `recharts` | ^2 | ✅ Charts — already installed, use for sensor history |
| `tailwindcss` | ^4 | Styling |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin |
| `typescript` | ^5 | Type checking |

## 7. What to Reuse ✅
- `lib/api.ts` — central fetch wrapper with JWT
- `lib/store/auth-store.ts` — authentication (remove `loginDemo`/`switchRole` mock paths later)
- `lib/store/dashboard-store.ts` — dashboard data fetching (update to accept greenhouse param)
- `lib/store/toast-store.ts` — toast notifications
- `lib/websocket.ts` — WebSocket client (keep for future use)
- `components/auth-guard.tsx` — route protection
- `components/admin-guard.tsx` — admin protection
- `components/icons.tsx` — SVG icons (add new greenhouse/automation icons)
- `components/toast.tsx` — toast container
- `components/error-boundary.tsx` — error boundary
- `components/skeletons.tsx` — loading skeletons
- `types/index.ts` — TypeScript interfaces (extend with Greenhouse type)
- `middleware.ts` — server-side route protection
- `app/login/page.tsx` — farmer login page
- `app/onboarding/page.tsx` — onboarding wizard
- `app/admin/*` — admin portal

## 8. What to Replace / Rebuild 🔄
- `components/app-shell.tsx` → Split into `Sidebar.tsx`, `Topbar.tsx`, `MobileNav.tsx`, `DashboardLayout.tsx`
- `app/page.tsx` → Full redesign with greenhouse health, sensor cards, charts, recommendations
- `app/devices/page.tsx` → Restructured with GreenNode hub + sensor/actuator sections
- `app/rules/page.tsx` → Move to `/automation/rules`, add farmer-friendly `/automation` overview
- `app/alerts/page.tsx` → Fix `is_read` → `is_resolved` field mismatch, add filters
- `app/settings/page.tsx` → Real settings with API integration

## 9. Current Mock Data Usage 🚩
- `lib/mock-data.ts` — 339-line file with fake users, devices, dashboard, rules, alerts
- **Used by**:
  - `auth-store.ts` → `loginDemo()` and `switchRole()` use `mockUsersByRole`
  - `auth-store.ts` → `hydrate()` falls back to `mockUsersByRole.farmer` on JWT decode failure
  - `dashboard-store.ts` → `fetchDashboard()` falls back to `mockDashboard` when API fails
  - `app/devices/page.tsx` → Directly imports `mockHub`, `mockSensors`, `mockActuators`
- **Action**: Keep as dev fallback but never show permanently. All pages must try real API first.

## 10. Implementation Plan

### Phase 1: ✅ Audit (this document)

### Phase 2: Layout Components
- Create `components/layout/Sidebar.tsx` — new nav with Greenhouses + Automation links
- Create `components/layout/Topbar.tsx` — greeting, greenhouse selector, GreenNode status
- Create `components/layout/MobileNav.tsx` — bottom tab bar for mobile
- Create `components/layout/DashboardLayout.tsx` — wrapper combining sidebar + topbar + content
- Update `LayoutWrapper` to use new layout
- Add new icons: Greenhouse, Automation/Lightning, Leaf

### Phase 3: Dashboard Redesign
- Create `components/dashboard/DashboardHeader.tsx`
- Create `components/dashboard/GreenhouseHealth.tsx`
- Create `components/dashboard/SensorCard.tsx` + `SensorGrid.tsx`
- Create `components/dashboard/SensorChart.tsx` (using recharts)
- Create `components/dashboard/RecommendationCard.tsx`
- Create `components/dashboard/AutomationSummary.tsx`
- Create `components/dashboard/RecentAlerts.tsx`
- Create `components/dashboard/GreenNodeStatus.tsx`
- Rebuild `app/page.tsx`

### Phase 4: Greenhouses Pages
- Create `app/greenhouses/page.tsx` — greenhouse list cards
- Create `app/greenhouses/[id]/page.tsx` — detailed greenhouse dashboard

### Phase 5: Devices Page
- Rebuild `app/devices/page.tsx` — GreenNode hub + sensors + actuators sections

### Phase 6: Automation + Rules
- Create `app/automation/page.tsx` — farmer-friendly overview
- Move rules to `app/automation/rules/page.tsx`

### Phase 7: Alerts
- Rebuild `app/alerts/page.tsx` — fix field mapping, add severity filters

### Phase 8: Settings
- Rebuild `app/settings/page.tsx` — account, greenhouse, GreenNode, notifications sections

### Phase 9: API Integration
- Create typed API functions in `lib/api.ts` or new `lib/api-functions.ts`
- Add `Greenhouse` type to `types/index.ts`
- Connect all pages to real backend endpoints

### Phase 10–12: Polish
- Responsive cleanup
- Loading/error/empty states on every page
- TypeScript + build validation
