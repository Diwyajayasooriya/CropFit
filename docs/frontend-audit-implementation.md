# Frontend audit implementation

Implemented on 2026-10-06, continuing the existing partial layout, greenhouse, and automation changes.

## Delivered

- Responsive sidebar and mobile navigation, including access to Settings on mobile.
- Shared dashboard and greenhouse-detail view with greenhouse selection, sensor cards, telemetry charts with time-range selection, health summary, hub heartbeat status, actuator overview, recent unresolved alerts, and next steps derived from alerts and offline hubs.
- Greenhouse list, creation form, and API-backed editing in Settings.
- Device registry using the actual node/sensor/actuator routes, real hub online status, device creation, and command failure handling. Removed fabricated devices/readings and success notifications for failed commands.
- Automation overview and rules routes, retaining `/rules` as a redirect. Rule controls match the backend's admin-only write permission and its `above`, `below`, and `equals` conditions.
- Alerts use `is_resolved` and PATCH acknowledgement, with greenhouse, severity, and resolution filters.
- Hub claiming supplies the required device ID, claim code, and a real greenhouse selection through the central authenticated API client. Login redirects preserve claim query parameters.
- Settings loads account details, greenhouse forms, and hub status from the API.
- Shared loading/error/retry states and typed list helpers supporting both arrays and paginated responses.
- Session restoration checks the current-user endpoint instead of falling back to a mock farmer. Demo authentication helpers are development-only.
- Dashboard failures clear readings instead of substituting demo data. Incoming WebSocket actuator updates no longer send commands back to devices.

## Validation

- TypeScript: passed.
- Production build: passed; all 14 application routes generated successfully.
- ESLint: passed with zero errors and five existing warnings (unused imports and full-page authentication navigation).
- Regression suite: 8/8 passed using `node --test tests/frontend-regressions.cjs` from `web`.
- Regression coverage includes pagination, malformed responses, dashboard outage behavior, greenhouse scoping, actuator event feedback, failed commands, failed session restoration, and unknown health before readings arrive.
- Authenticated browser flows and commands against physical devices were not exercised. Compilation and regression tests do not establish live end-to-end integration.

## Remaining backend and deployment considerations

- Account updates and notification preferences have no corresponding backend endpoints. Settings presents account information and the current notification limitation without pretending to save unsupported changes.
- Recommendations are derived from current alerts and hub status; no crop-specific recommendation service was added.
- Existing backend authorization needs separate attention: `AlertViewSet` uses `AllowAny`, and the telemetry/rules querysets do not apply owner filtering. Frontend greenhouse filters are not access control. These backend policies were not changed as part of this frontend implementation.
- Next.js reports that the existing middleware convention is deprecated in favor of proxy.
- No deployment was performed. Existing backend source/database changes were preserved.
