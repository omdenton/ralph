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

const { parseLogLine, parseTasks, startServer } = require('./server.js');
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
// 1b. Task parsing (unit)
// ---------------------------------------------------------------------------

describe('parseTasks', () => {
  test('parses DONE, IN PROGRESS, and pending tasks with criteria', () => {
    const md = [
      '# Plan',
      '### Task 1 — Create fizzbuzz.js ✅ DONE',
      '**Acceptance Criteria:**',
      '- fizzbuzz(3) returns "Fizz"',
      '- fizzbuzz(15) returns "FizzBuzz"',
      '',
      '### Task 2 — Create main.js 🔄 IN PROGRESS',
      '### Task 3 — Create test.js',
    ].join('\n');
    const tasks = parseTasks(md);
    assert.equal(tasks.length, 3);
    assert.equal(tasks[0].status, 'done');
    assert.equal(tasks[0].desc, 'Create fizzbuzz.js');
    assert.equal(tasks[0].criteria.length, 2);
    assert.equal(tasks[0].criteria[0], 'fizzbuzz(3) returns "Fizz"');
    assert.equal(tasks[1].status, 'in_progress');
    assert.equal(tasks[1].desc, 'Create main.js');
    assert.equal(tasks[2].status, 'pending');
    assert.equal(tasks[2].desc, 'Create test.js');
  });

  test('parses bracket-style status markers', () => {
    const md = '### Task 1 — Build widget [DONE]';
    const tasks = parseTasks(md);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0].status, 'done');
  });

  test('returns empty array for no tasks', () => {
    assert.deepEqual(parseTasks('# Nothing here'), []);
  });
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
    assert.ok(Array.isArray(s.tasks), 'tasks should be an array');
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
      assert.equal(typeof data.state, 'string');
      assert.ok(VALID_STATES.has(data.state), `state "${data.state}" should be valid`);
      assert.equal(typeof data.lastLog, 'string');
      assert.equal(typeof data.timestamp, 'string');
      assert.ok(!isNaN(Date.parse(data.timestamp)), 'timestamp should be ISO 8601');
      assert.equal(typeof data.containerRunning, 'boolean');
      assert.ok(Array.isArray(data.tasks), 'tasks should be an array');
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
  test('contains task-list', () => assert.ok(html.includes('task-list')));
});

// ---------------------------------------------------------------------------
// 6. Canvas rendering
// ---------------------------------------------------------------------------

describe('canvas rendering', () => {
  function makeCtx(w, h) {
    w = w || 640;
    h = h || 360;
    var canvas = createCanvas(w, h);
    return canvas.getContext('2d');
  }

  function getPixel(ctx, x, y) {
    var d = ctx.getImageData(x, y, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2], a: d[3] };
  }

  function isBlank(ctx, x, y) {
    var p = getPixel(ctx, x, y);
    return p.a === 0;
  }

  function hasAnyNonBlankRegion(ctx, sx, sy, w, h) {
    for (var dy = 0; dy < h; dy++) {
      for (var dx = 0; dx < w; dx++) {
        if (!isBlank(ctx, sx + dx, sy + dy)) return true;
      }
    }
    return false;
  }

  test('drawOffice: not all pixels same colour', () => {
    var ctx = makeCtx();
    Game.drawOffice(ctx);
    var p1 = getPixel(ctx, 0, 0);
    var p2 = getPixel(ctx, 320, 120);
    var same = (p1.r === p2.r && p1.g === p2.g && p1.b === p2.b);
    assert.ok(!same, 'office should have multiple colours');
  });

  test('floor tiles are tan/beige coloured (scan floor region)', () => {
    var ctx = makeCtx();
    Game.drawOffice(ctx);
    var found = false;
    outer: for (var y = 80; y < 220; y++) {
      for (var x = 200; x < 480; x++) {
        var p = getPixel(ctx, x, y);
        if (p.r > 180 && p.g > 140 && p.b > 100) { found = true; break outer; }
      }
    }
    assert.ok(found, 'floor region should contain tan/beige pixels');
  });

  test('north wall has blue-grey pixels (scan wall region)', () => {
    var ctx = makeCtx();
    Game.drawOffice(ctx);
    var found = false;
    outer: for (var y = 0; y < 80; y++) {
      for (var x = 300; x < 500; x++) {
        var p = getPixel(ctx, x, y);
        if (p.a > 0 && p.r < 150 && p.b > p.r) { found = true; break outer; }
      }
    }
    assert.ok(found, 'north wall region should have blue-grey pixels');
  });

  test('drawWhiteboard(ctx, 1, 1) produces non-blank pixels', () => {
    var ctx = makeCtx();
    Game.drawWhiteboard(ctx, 1, 1);
    assert.ok(hasAnyNonBlankRegion(ctx, 280, 20, 80, 60), 'whiteboard should have non-blank pixels');
  });

  test('drawWorkbench(ctx, 8, 5) produces non-blank pixels', () => {
    var ctx = makeCtx();
    Game.drawWorkbench(ctx, 8, 5);
    assert.ok(hasAnyNonBlankRegion(ctx, 300, 80, 120, 80), 'workbench should have non-blank pixels');
  });

  test('drawCoffeeMachine(ctx, 1, 7) produces non-blank pixels', () => {
    var ctx = makeCtx();
    Game.drawCoffeeMachine(ctx, 1, 7);
    assert.ok(hasAnyNonBlankRegion(ctx, 180, 60, 80, 60), 'coffee machine should have non-blank pixels');
  });

  test('drawRalph produces non-blank pixels', () => {
    var ctx = makeCtx();
    Game.drawRalph(ctx, 200, 200, 0);
    var p = getPixel(ctx, 207, 215);
    assert.ok(p.a > 0, 'ralph body pixel should be non-blank');
  });

  test('drawRalph hat is yellow: R > 200, G > 180, B < 100', () => {
    var ctx = makeCtx();
    Game.drawRalph(ctx, 200, 200, 0);
    var p = getPixel(ctx, 206, 203);
    assert.ok(p.r > 200, 'R=' + p.r + ' should be > 200 (yellow)');
    assert.ok(p.g > 180, 'G=' + p.g + ' should be > 180 (yellow)');
    assert.ok(p.b < 100, 'B=' + p.b + ' should be < 100 (yellow)');
  });

  test('drawRalph animFrame 0 vs 1 produces different pixel data', () => {
    var ctx0 = makeCtx();
    Game.drawRalph(ctx0, 200, 200, 0);
    var data0 = ctx0.getImageData(190, 220, 40, 40).data;

    var ctx1 = makeCtx();
    Game.drawRalph(ctx1, 200, 200, 1);
    var data1 = ctx1.getImageData(190, 220, 40, 40).data;

    var differs = false;
    for (var i = 0; i < data0.length; i++) {
      if (data0[i] !== data1[i]) { differs = true; break; }
    }
    assert.ok(differs, 'animFrame 0 and 1 should produce different pixel data (walk cycle)');
  });

  test('canvas is 640x360', () => {
    assert.equal(Game.CANVAS_W, 640);
    assert.equal(Game.CANVAS_H, 360);
    assert.equal(Game.TILE_SIZE, 32);
  });

  test('floor has checkerboard pattern (two distinct tile shades)', () => {
    var ctx = makeCtx();
    Game.drawOffice(ctx);
    // Tile(5,5) center at ~(320, 145), tile(6,5) at ~(336, 153)
    // (5+5)%2=0 and (6+5)%2=1 → different shades
    var p1 = getPixel(ctx, 324, 148);
    var p2 = getPixel(ctx, 340, 156);
    var same = (p1.r === p2.r && p1.g === p2.g && p1.b === p2.b);
    assert.ok(!same, 'adjacent tiles should have different shades (checkerboard)');
  });

  test('whiteboard scrawl is on the board, not the wall', () => {
    // Scrawl at (gx+0.3, gy=1) renders near (325, 83)
    // If wrong (gy=0), it would be near (341, 75) — on the wall above
    var ctx = makeCtx();
    Game.drawWhiteboard(ctx, 1, 1);
    // Check for green scrawl pixels (#4a8a5a) on the board surface
    var foundOnBoard = false;
    outer: for (var y = 50; y < 70; y++) {
      for (var x = 320; x < 340; x++) {
        var p = getPixel(ctx, x, y);
        if (p.g > 100 && p.g > p.r && p.g > p.b && p.a > 0) {
          foundOnBoard = true; break outer;
        }
      }
    }
    assert.ok(foundOnBoard, 'green scrawl pixels should be on the whiteboard surface');
  });

  test('whiteboard scrawl is NOT on the wall (gy=0 region)', () => {
    var ctx = makeCtx();
    Game.drawWhiteboard(ctx, 1, 1);
    // The wrong region (gy=0) would be around (341, 45..48)
    // There should be no green scrawl pixels in the wall-only zone
    var foundOnWall = false;
    for (var y = 38; y < 48; y++) {
      for (var x = 338; x < 360; x++) {
        var p = getPixel(ctx, x, y);
        if (p.g > 100 && p.g > p.r && p.g > p.b && p.a > 0) {
          foundOnWall = true; break;
        }
      }
    }
    assert.ok(!foundOnWall, 'no green scrawl pixels should appear in the wall-only zone');
  });

  test('bookshelf books render on the front (SW) face', () => {
    var ctx = makeCtx();
    Game.drawBookshelf(ctx, 9, 2);
    // Front face at gy+0.8=2.8, books should appear near (422-446, 130-170)
    var foundBook = false;
    outer: for (var y = 125; y < 165; y++) {
      for (var x = 418; x < 450; x++) {
        var p = getPixel(ctx, x, y);
        // Check for book colours: red (#b03020), blue (#2050b0), green (#20a040)
        var isRed = (p.r > 150 && p.g < 80 && p.b < 80);
        var isBlue = (p.r < 80 && p.g < 120 && p.b > 140);
        var isGreen = (p.r < 80 && p.g > 130 && p.b < 100);
        if (isRed || isBlue || isGreen) { foundBook = true; break outer; }
      }
    }
    assert.ok(foundBook, 'book-coloured pixels should appear on the front face of bookshelf');
  });

  test('couch/bed renders with blue cushion at sleep location', () => {
    var ctx = makeCtx();
    Game.drawCoffeeMachine(ctx, 1, 7);
    // Cushion is blue (#4a6a8a top face) — scan the couch region near (224, 115..155)
    var foundCushion = false;
    outer: for (var y = 110; y < 160; y++) {
      for (var x = 210; x < 270; x++) {
        var p = getPixel(ctx, x, y);
        // Blue cushion: R<100, G in 80-130, B in 100-160
        if (p.a > 0 && p.r < 100 && p.g > 70 && p.g < 140 && p.b > 90 && p.b < 170) {
          foundCushion = true; break outer;
        }
      }
    }
    assert.ok(foundCushion, 'couch should have blue cushion pixels');
  });

  test('couch/bed has a pillow (light/white pixels)', () => {
    var ctx = makeCtx();
    Game.drawCoffeeMachine(ctx, 1, 7);
    var foundPillow = false;
    outer: for (var y = 105; y < 150; y++) {
      for (var x = 210; x < 260; x++) {
        var p = getPixel(ctx, x, y);
        // Pillow is off-white (#d0d0c8): R>190, G>190, B>170
        if (p.a > 0 && p.r > 190 && p.g > 190 && p.b > 170) {
          foundPillow = true; break outer;
        }
      }
    }
    assert.ok(foundPillow, 'couch should have pillow (light/white pixels)');
  });

  test('drawRalph has eyes (dark pixels on face)', () => {
    var ctx = makeCtx();
    Game.drawRalph(ctx, 200, 200, 0);
    // Eyes at (205,208) and (209,208) — 2x2 dark dots
    var leftEye = getPixel(ctx, 205, 208);
    var rightEye = getPixel(ctx, 209, 208);
    assert.ok(leftEye.r < 50 && leftEye.g < 50 && leftEye.b < 50, 'left eye should be dark');
    assert.ok(rightEye.r < 50 && rightEye.g < 50 && rightEye.b < 50, 'right eye should be dark');
  });

  test('drawRalph has boots (dark pixels below legs)', () => {
    var ctx = makeCtx();
    Game.drawRalph(ctx, 200, 200, 0);
    // Boots at y+32 area
    var boot = getPixel(ctx, 203, 232);
    assert.ok(boot.a > 0 && boot.r < 60 && boot.g < 60 && boot.b < 60, 'boots should be dark');
  });
});
