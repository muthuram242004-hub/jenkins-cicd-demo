// Unit tests using Node's built-in test runner (no extra packages needed).
const test = require('node:test');
const assert = require('node:assert');
const { createServer } = require('../src/app');

let server;
let base;

test.before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://localhost:${server.address().port}`;
});

test.after(() => server.close());

test('GET / returns the welcome page', async () => {
  const res = await fetch(`${base}/`);
  assert.strictEqual(res.status, 200);
  assert.match(await res.text(), /Hello from Jenkins CI\/CD!/);
});

test('GET /health reports UP', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  const body = await res.json();
  assert.strictEqual(body.status, 'UP');
});

test('unknown route returns 404', async () => {
  const res = await fetch(`${base}/nope`);
  assert.strictEqual(res.status, 404);
});
