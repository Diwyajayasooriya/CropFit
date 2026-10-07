const assert = require('node:assert/strict');
async function run() {
  const web = 'http://localhost:3100';
  const api = 'http://127.0.0.1:8100/api';
  const response = await fetch(web + '/claim?device_id=PREVIEW-CLAIM&code=PREVIEW123&greenhouse=2', { redirect: 'manual' });
  assert.equal(response.status, 307);
  assert.equal(new URL(response.headers.get('location'), web).searchParams.get('redirect'), '/claim?device_id=PREVIEW-CLAIM&code=PREVIEW123&greenhouse=2');
  const login = await fetch(web + '/login?device_id=PREVIEW-CLAIM&code=PREVIEW123');
  assert.equal(login.status, 200);
  assert.match(await login.text(), /Farmer email or username/);
  console.log('PASS: claim redirect preserves all query parameters; login page renders');
  const token = await fetch(api + '/auth/token/', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'preview-farmer',password:'Preview-local-42!'})});
  assert.equal(token.status, 200);
  const headers = {Authorization: 'Bearer ' + (await token.json()).access, 'Content-Type': 'application/json'};
  const profile = await fetch(api + '/auth/me/', {headers});
  assert.equal(profile.status, 200);
  const greenhouses = await (await fetch(api + '/v1/greenhouses/', {headers})).json();
  const rows = Array.isArray(greenhouses) ? greenhouses : greenhouses.results;
  assert.equal(rows.length, 2);
  for (const gh of rows) {
    const response = await fetch(api + '/v1/reports/dashboard/?greenhouse=' + gh.id, {headers});
    assert.equal(response.status, 200);
    assert.equal((await response.json()).tiles.length, 3);
  }
  console.log('PASS: login, profile endpoint and two scoped greenhouse dashboards');
  const claim = await fetch(api + '/v1/nodes/claim/', {method:'POST',headers,body:JSON.stringify({device_id:'PREVIEW-CLAIM',claim_code:'PREVIEW123',greenhouse_id:rows[0].id})});
  assert.equal(claim.status, 200);
  assert.equal((await claim.json()).greenhouse_id, rows[0].id);
  console.log('PASS: isolated test hub claimed into selected greenhouse');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
