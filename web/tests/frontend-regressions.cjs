/* eslint-disable @typescript-eslint/no-require-imports -- Node's dependency-free CommonJS test harness. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const { create } = require('zustand');

function load(file, dependencies, globals = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const exports = {};
  vm.runInNewContext(compiled, {
    exports, console: { ...console, error() {} }, process, URL, URLSearchParams, Error, ...globals,
    require(name) {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename: file });
  return exports;
}

test('greenhouse cards scope real hubs and distinguish offline, unavailable and unlinked states', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const icon = () => null;
  const { GreenhouseCard } = load('components/greenhouse/GreenhouseCard.tsx', {
    react: React,
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/utils': { timeAgo: value => value || 'Never received' },
    '@/components/ui': {
      Card: ({ children }) => React.createElement('div', null, children),
      StatusBadge: ({ children }) => React.createElement('span', null, children),
    },
    '@/components/icons': { WifiIcon: icon, WifiOffIcon: icon, ThermometerIcon: icon, DropletIcon: icon, ChevronRightIcon: icon },
  });
  const greenhouse = { id: 3, name: 'Farm A', crop: 'Tomato', node_count: 2 };
  const nodes = [
    { id: 1, greenHouse: 3, node_id: 'REAL-OFFLINE', node_name: 'North hub', is_online: false, last_seen: null },
    { id: 2, greenHouse: 3, node_id: 'REAL-ONLINE', node_name: 'South hub', is_online: true, last_seen: 'recent' },
    { id: 3, greenHouse: 4, node_id: 'OTHER-GREENHOUSE', is_online: true },
  ];
  const render = props => renderToStaticMarkup(React.createElement(GreenhouseCard, { greenhouse, nodes, ...props }));
  const html = render({});
  for (const value of ['REAL-OFFLINE', 'REAL-ONLINE', 'North hub', 'South hub', 'Offline', 'Online', 'Never received', '2 linked', 'Health: No data']) {
    assert.ok(html.includes(value), value);
  }
  assert.doesNotMatch(html, /OTHER-GREENHOUSE|GN-HUB-C554|29\.4|46%|Health: Good/);
  const stale = render({ nodesError: 'Network failed' });
  assert.match(stale, /Status unknown/);
  assert.doesNotMatch(stale, />Online|>Offline/);
  const loading = render({ nodes: [], loading: true });
  assert.match(loading, /Loading hubs/);
  assert.doesNotMatch(loading, /No hub linked/);
  assert.match(render({ nodes: [] }), /No hub linked/);
});

test('sidebar shows actual hubs and does not report stale or missing data as online', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { SidebarHubStatus } = load('components/layout/SidebarHubStatus.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: ({ children, ...props }) => React.createElement('a', props, children) },
    '@/lib/utils': { timeAgo: value => value || 'Never received' },
  });
  const render = props => renderToStaticMarkup(React.createElement(SidebarHubStatus, {
    loading: false, error: null, onRetry() {}, ...props,
  }));
  const nodes = [
    { id: 1, node_id: 'MY-HUB-1', node_name: 'North hub', greenHouse: 3, is_online: true, last_seen: 'recent' },
    { id: 2, node_id: 'MY-HUB-2', node_name: 'South hub', greenHouse: 4, is_online: false, last_seen: null },
  ];
  const html = render({ nodes });
  for (const expected of ['MY-HUB-1', 'MY-HUB-2', 'Online', 'Offline', 'href="/greenhouses/3"', 'href="/greenhouses/4"']) {
    assert.ok(html.includes(expected), expected);
  }
  assert.doesNotMatch(html, /GN-HUB-C554/);
  const stale = render({ nodes, error: 'Network unavailable' });
  assert.match(stale, /Status unknown/);
  assert.doesNotMatch(stale, />Online</);
  assert.match(render({ nodes: [] }), /No hubs linked/);
  const loading = render({ nodes: null, loading: true });
  assert.match(loading, /Loading hubs/);
  assert.doesNotMatch(loading, /Online|GN-HUB/);
});

test('list accepts arrays and follows pagination without forwarding tokens to a next-link host', async () => {
  const paths = [];
  const { list } = load('lib/api-functions.ts', { '@/lib/api': { apiFetch: {
    get: async endpoint => {
      paths.push(endpoint);
      return paths.length === 1 ? { results: [{ id: 1 }], next: 'https://other-host/api/v1/greenhouses/?page=2' } : [{ id: 2 }];
    },
  } } });
  const data = await list('/greenhouses/');
  assert.equal(data.length, 2);
  assert.deepEqual(paths, ['/greenhouses/', '/greenhouses/?page=2']);
});

test('list rejects malformed API responses instead of rendering an empty success state', async () => {
  const { list } = load('lib/api-functions.ts', { '@/lib/api': { apiFetch: { get: async () => ({ detail: 'failure' }) } } });
  await assert.rejects(list('/greenhouses/'), /Unexpected response/);
});

function dashboard(apiFetch, handlers = {}) {
  return load('lib/store/dashboard-store.ts', {
    zustand: { create }, '@/lib/api': { apiFetch },
    '@/lib/store/toast-store': { toast: { error() {} } },
    '@/lib/websocket': { createWebSocket: () => ({
      on: (type, handler) => { handlers[type] = handler; }, connect() {}, disconnect() {},
    }) },
  }).useDashboardStore;
}

test('dashboard errors clear old readings and never substitute demo data', async () => {
  const store = dashboard({ get: async () => { throw new Error('Backend unavailable'); } });
  store.setState({ summary: { tiles: [{ value: 25 }], actuators: [] } });
  await store.getState().fetchDashboard(7);
  assert.equal(store.getState().summary, null);
  assert.equal(store.getState().error, 'Backend unavailable');
  assert.equal(store.getState().isLoading, false);
});

test('dashboard requests are greenhouse scoped', async () => {
  let requested;
  const store = dashboard({ get: async endpoint => { requested = endpoint; return { tiles: [], actuators: [] }; } });
  await store.getState().fetchDashboard(7);
  assert.equal(requested, '/reports/dashboard/?greenhouse=7');
});

test('incoming actuator updates do not send another device command', () => {
  let commands = 0;
  const handlers = {};
  const store = dashboard({ post: async () => { commands++; } }, handlers);
  store.setState({ summary: { tiles: [], actuators: [{ actuator_id: 'pump', is_active: false }] } });
  store.getState().connectWS('test-token');
  handlers.actuator_update({ actuator_id: 'pump', is_active: true });
  assert.equal(commands, 0);
  assert.equal(store.getState().summary.actuators[0].is_active, true);
});

test('a failed actuator command preserves the confirmed state', async () => {
  const store = dashboard({ post: async () => { throw new Error('Offline'); } });
  store.setState({ summary: { tiles: [], actuators: [{ actuator_id: 'pump', is_active: false }] } });
  await store.getState().updateActuator('pump', true);
  assert.equal(store.getState().summary.actuators[0].is_active, false);
});

test('session hydration rejects a failed profile check without authenticating a mock farmer', async () => {
  let cleared = false;
  const { useAuthStore } = load('lib/store/auth-store.ts', {
    zustand: { create }, '@/lib/mock-data': { mockUsersByRole: {} },
    '@/lib/api': {
      getTokens: () => ({ access: 'invalid', refresh: 'invalid' }),
      clearTokens: () => { cleared = true; },
      api: async () => { throw new Error('Invalid session'); },
    },
  }, { window: {}, localStorage: {} });
  await useAuthStore.getState().hydrate();
  assert.equal(cleared, true);
  assert.equal(useAuthStore.getState().isAuthenticated, false);
  assert.equal(useAuthStore.getState().user, null);
});

test('a greenhouse without readings is not labelled healthy', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { GreenhouseHealth } = load('components/dashboard/DashboardPanels.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'),
    'next/link': { default: () => null },
    '@/lib/utils': { timeAgo: () => 'Just now' },
    '@/components/hub-status': { HubStatus: () => null },
    '@/components/actuator-control': { ActuatorControl: () => null },
  });
  const html = renderToStaticMarkup(React.createElement(GreenhouseHealth, {
    summary: { tiles: [], actuators: [], overall_status: 'healthy', message: 'All healthy' },
  }));
  assert.match(html, /Awaiting readings/);
  assert.doesNotMatch(html, /All healthy/);
});

test('claim intent takes priority over onboarding and preserves the selected greenhouse', () => {
  const { loginDestination } = load('lib/navigation.ts', {});
  assert.equal(loginDestination('?device_id=GN-1&code=A%26B&greenhouse=7', null, false), '/claim?device_id=GN-1&code=A%26B&greenhouse=7');
  assert.equal(loginDestination('?redirect=%2Fclaim%3Fcode%3DABC', '/', false), '/claim?code=ABC');
  assert.equal(loginDestination('', '/claim?device_id=GN-2', false), '/claim?device_id=GN-2');
  assert.equal(loginDestination('', null, false), '/onboarding');
});

test('external redirects and authentication loops are rejected', () => {
  const { safeReturnPath, loginDestination } = load('lib/navigation.ts', {});
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/login', '/admin/login', '/\nevil.test']) assert.equal(safeReturnPath(path), null);
  assert.equal(loginDestination('?redirect=https://evil.test', null, true), '/');
});

test('queue acceptance preserves confirmed actuator state', async () => {
  const store = dashboard({ post: async () => ({status: 'pending'}) });
  store.setState({ summary: { tiles: [], actuators: [{ actuator_id: 'pump', is_active: false }] } });
  await store.getState().updateActuator('pump', true);
  assert.equal(store.getState().summary.actuators[0].is_active, false);
});

test('sensor cards preserve zero and distinguish missing readings', () => {
  const React = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { SensorCard } = load('components/dashboard/DashboardPanels.tsx', {
    'react/jsx-runtime': require('react/jsx-runtime'), 'next/link': { default: () => null },
    '@/lib/utils': { timeAgo: () => 'Just now' }, '@/components/hub-status': { HubStatus: () => null },
    '@/components/actuator-control': { ActuatorControl: () => null },
  });
  const tile = { sensor_name: 'Temperature', sensor_kind: 'temperature', unit: 'C', trend: null, updated_at: '2026-10-07T00:00:00Z' };
  const missing = renderToStaticMarkup(React.createElement(SensorCard, { tile: { ...tile, value: null } }));
  const zero = renderToStaticMarkup(React.createElement(SensorCard, { tile: { ...tile, value: 0 } }));
  assert.match(missing, /No data/);
  assert.doesNotMatch(zero, /No data/);
  assert.match(zero, />0</);
  assert.doesNotMatch(missing, /Stable/);
});
