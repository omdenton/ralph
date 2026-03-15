'use strict';

/**
 * test.js — All tests for Ralph Shop Visualiser
 * Runner: node:test + node:assert (no external framework)
 */

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocket } = require('ws');
const { createCanvas } = require('canvas');

const { parseLogLine, startServer } = require('./server.js');
const Game = require('./game.js');

// ---------------------------------------------------------------------------
// 1. Log parsing (unit)
// ---------------------------------------------------------------------------

describe('parseLogLine', () => {
  const cases = [
    ['Ralph Loop Started. Press Ctrl+C to stop.',               'starting'],
    ['Ralph entering Planning Mode... (Sun Mar 15 ...)',         'planning'],
    ['Ralph entering Build Mode... (Sun Mar 15 ...)',            'building'],
    ['Ralph iteration complete. Sleeping for 15 seconds...',    'sleeping'],
    ['✓ Project marked as COMPLETE',                            'complete'],
    ['ERROR: AI (Planning) failed.',                            'error'],
    ['ERROR: Loop appears stuck (identical output 3 times)',     'error'],
    ['INFO: Git remote found: ...',                             null],
    ['some random line of output',                              null],
    ['',                                                        null],
  ];

  for (const [input, expected] of cases) {
    test(`"${input.slice(0, 50)}" → ${expected}`, () => {
      assert.equal(parseLogLine(input), expected);
    });
  }
});

// ---------------------------------------------------------------------------
// 2. State object shape (unit)
// ---------------------------------------------------------------------------

const VALID_STATES = new Set(['idle', 'starting', 'planning', 'building', 'sleeping', 'complete', 'error']);

describe('state object shape', () => {
  let server;

  before((_, done) => {
    server = startServer(0);
    server.once('listening', done);
  });

  after((_, done) => {
    server._stopDocker();
    server.close(done);
  });

  test('has all required fields with correct types', () => {
    const s = server._getState();
    assert.equal(typeof s.state, 'string', 'state should be string');
    assert.ok(VALID_STATES.has(s.state), `state "${s.state}" should be one of 7 valid states`);
    assert.equal(typeof s.lastLog, 'string', 'lastLog should be string');
    assert.equal(typeof s.timestamp, 'string', 'timestamp should be string');
    assert.ok(!isNaN(Date.parse(s.timestamp)), 'timestamp should be ISO 8601');
    assert.equal(typeof s.containerRunning, 'boolean', 'containerRunning should be boolean');
  });
});

// ---------------------------------------------------------------------------
// 3. HTTP integration
// ---------------------------------------------------------------------------

describe('HTTP routes', () => {
  let server;
  let port;

  before((_, done) => {
    server = startServer(0);
    server.once('listening', () => {
      port = server.address().port;
      done();
    });
  });

  after((_, done) => {
    server._stopDocker();
    server.close(done);
  });

  function get(urlPath) {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
        let body = '';
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
      }).on('error', reject);
    });
  }

  test('GET / → 200 text/html containing <canvas', async () => {
    const { status, headers, body } = await get('/');
    assert.equal(status, 200);
    assert.ok(headers['content-type'].includes('text/html'), 'content-type should be text/html');
    assert.ok(body.includes('<canvas'), 'body should contain <canvas');
  });

  test('GET /health → 200 JSON with ok:true and valid state', async () => {
    const { status, headers, body } = await get('/health');
    assert.equal(status, 200);
    assert.ok(headers['content-type'].includes('application/json'));
    const json = JSON.parse(body);
    assert.equal(json.ok, true);
    assert.ok(VALID_STATES.has(json.state), `state "${json.state}" should be valid`);
  });

  test('GET /nonexistent → 404', async () => {
    const { status } = await get('/nonexistent');
    assert.equal(status, 404);
  });
});

// ---------------------------------------------------------------------------
// 4. WebSocket integration
// ---------------------------------------------------------------------------

describe('WebSocket', () => {
  let server;
  let port;

  before((_, done) => {
    server = startServer(0);
    server.once('listening', () => {
      port = server.address().port;
      done();
    });
  });

  after((_, done) => {
    server._stopDocker();
    server.close(done);
  });

  test('on connect, client receives current state JSON', (_, done) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.on('message', (raw) => {
      const data = JSON.parse(raw.toString());
      // Check all 4 fields
      assert.equal(typeof data.state, 'string');
      assert.ok(VALID_STATES.has(data.state), `state "${data.state}" should be valid`);
      assert.equal(typeof data.lastLog, 'string');
      assert.equal(typeof data.timestamp, 'string');
      assert.ok(!isNaN(Date.parse(data.timestamp)), 'timestamp should be ISO 8601');
      assert.equal(typeof data.containerRunning, 'boolean');
      ws.close();
      done();
    });
    ws.on('error', done);
  });
});

// ---------------------------------------------------------------------------
// 5. Frontend smoke test
// ---------------------------------------------------------------------------

describe('index.html smoke test', () => {
  let html;

  before(() => {
    html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  });

  test('contains <canvas', () => assert.ok(html.includes('<canvas')));
  test('contains id="game"', () => assert.ok(html.includes('id="game"')));
  test('contains WebSocket', () => assert.ok(html.includes('WebSocket')));
  test('contains requestAnimationFrame', () => assert.ok(html.includes('requestAnimationFrame')));
  test('contains state-badge or hud', () => {
    assert.ok(html.includes('state-badge') || html.includes('hud'));
  });
});

// ---------------------------------------------------------------------------
// 6. Canvas rendering
// ---------------------------------------------------------------------------

describe('canvas rendering', () => {
  function makeCtx(w = 320, h = 180) {
    const canvas = createCanvas(w, h);
    return canvas.getContext('2d');
  }

  function getPixel(ctx, x, y) {
    const d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }

  function isBlank(ctx, x, y) {
    const p = getPixel(ctx, x, y);
    return p.a === 0;
  }

  function hasAnyNonBlank(ctx, tx, ty) {
    const x = tx * 16, y = ty * 16;
    for (let dy = 0; dy < 16; dy++) {
      for (let dx = 0; dx < 16; dx++) {
        if (!isBlank(ctx, x + dx, y + dy)) return true;
      }
    }
    return false;
  }

  test('drawOffice: not all pixels same colour', () => {
    const ctx = makeCtx();
    Game.drawOffice(ctx);
    const p1 = getPixel(ctx, 0, 0);
    const p2 = getPixel(ctx, 160, 120);
    // Floor and ceiling strip are different colours
    const same = (p1.r === p2.r && p1.g === p2.g && p1.b === p2.b);
    assert.ok(!same, 'office should have multiple colours');
  });

  test('floor pixel at (160, 120) is beige/tan', () => {
    const ctx = makeCtx();
    Game.drawOffice(ctx);
    const p = getPixel(ctx, 160, 120);
    assert.ok(p.r > 180, `R=${p.r} should be > 180`);
    assert.ok(p.g > 150, `G=${p.g} should be > 150`);
    assert.ok(p.b > 100, `B=${p.b} should be > 100`);
  });

  test('wall pixel at (50, 24) is blue-grey: R < 150, B > R', () => {
    const ctx = makeCtx();
    Game.drawOffice(ctx);
    const p = getPixel(ctx, 50, 24);
    assert.ok(p.r < 150, `R=${p.r} should be < 150`);
    assert.ok(p.b > p.r, `B=${p.b} should be > R=${p.r}`);
  });

  test('drawWhiteboard(ctx, 2, 2) produces non-blank pixels', () => {
    const ctx = makeCtx();
    Game.drawWhiteboard(ctx, 2, 2);
    assert.ok(hasAnyNonBlank(ctx, 2, 2), 'whiteboard tile should have non-blank pixels');
  });

  test('drawWorkbench(ctx, 13, 5) produces non-blank pixels', () => {
    const ctx = makeCtx();
    Game.drawWorkbench(ctx, 13, 5);
    assert.ok(hasAnyNonBlank(ctx, 13, 5), 'workbench tile should have non-blank pixels');
  });

  test('drawCoffeeMachine(ctx, 2, 8) produces non-blank pixels', () => {
    const ctx = makeCtx();
    Game.drawCoffeeMachine(ctx, 2, 8);
    assert.ok(hasAnyNonBlank(ctx, 2, 8), 'coffee machine tile should have non-blank pixels');
  });

  test('drawRalph produces non-blank pixels', () => {
    const ctx = makeCtx();
    Game.drawRalph(ctx, 100, 100, 0);
    // Body at (100, 106) — blue overalls
    const p = getPixel(ctx, 104, 106);
    assert.ok(p.a > 0, 'ralph body pixel should be non-blank');
  });

  test('drawRalph hat at (100, 97) is yellow: R > 200, G > 200, B < 100', () => {
    const ctx = makeCtx();
    Game.drawRalph(ctx, 100, 100, 0);
    // Hat is drawn at (x, y-3) = (100, 97), width 8, height 3
    const p = getPixel(ctx, 100, 97);
    assert.ok(p.r > 200, `R=${p.r} should be > 200 (yellow)`);
    assert.ok(p.g > 200, `G=${p.g} should be > 200 (yellow)`);
    assert.ok(p.b < 100, `B=${p.b} should be < 100 (yellow)`);
  });

  test('drawRalph animFrame 0 vs 1 produces different pixel data', () => {
    const ctx0 = makeCtx();
    Game.drawRalph(ctx0, 100, 100, 0);
    const data0 = ctx0.getImageData(90, 100, 30, 30).data;

    const ctx1 = makeCtx();
    Game.drawRalph(ctx1, 100, 100, 1);
    const data1 = ctx1.getImageData(90, 100, 30, 30).data;

    let differs = false;
    for (let i = 0; i < data0.length; i++) {
      if (data0[i] !== data1[i]) { differs = true; break; }
    }
    assert.ok(differs, 'animFrame 0 and 1 should produce different pixel data (walk cycle)');
  });
});
