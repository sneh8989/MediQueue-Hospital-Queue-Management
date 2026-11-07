import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { errorHandler, notFoundHandler } from '../middleware/errorHandler.js';
import AppError from '../utils/AppError.js';

process.env.NODE_ENV = 'test';

/**
 * Security hardening (Phase 15): confirms unexpected (non-AppError)
 * exceptions never leak their raw message to the client on a 500, while
 * intentional AppErrors (crafted, safe messages) still pass through
 * normally at any status code.
 */

function buildTestApp() {
  const app = express();
  app.get('/boom-unexpected', () => {
    throw new TypeError('Cannot read properties of undefined (reading "internalDbField")');
  });
  app.get('/boom-apperror-500', () => {
    throw new AppError('A deliberate, safe 500 message', 500);
  });
  app.get('/boom-apperror-404', () => {
    throw new AppError('Widget not found', 404);
  });
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

async function withServer(fn) {
  const app = buildTestApp();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://localhost:${server.address().port}`;
  try {
    await fn(baseUrl);
  } finally {
    server.close();
  }
}

test('an unexpected (non-AppError) exception returns a generic message, not the raw error text', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/boom-unexpected`);
    assert.equal(res.status, 500);
    const json = await res.json();
    assert.equal(json.message, 'Internal server error');
    assert.ok(!json.message.includes('internalDbField'), 'raw internal error text must never reach the client');
  });
});

test('an intentional AppError at 500 still shows its crafted message (it was written to be safe)', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/boom-apperror-500`);
    assert.equal(res.status, 500);
    const json = await res.json();
    assert.equal(json.message, 'A deliberate, safe 500 message');
  });
});

test('an intentional AppError at 404 passes its message through unchanged', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/boom-apperror-404`);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.message, 'Widget not found');
  });
});

test('an unrecognized route returns a structured 404, not a stack trace', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/totally-unknown-route`);
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.match(json.message, /Route not found/);
  });
});
