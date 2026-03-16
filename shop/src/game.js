'use strict';

// game.js — Ralph Shop isometric office visualiser (v2)
// Dual-environment: browser (window.Game) or Node.js (module.exports)

(function (exports) {

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  var TILE_SIZE = 32;
  var CANVAS_W  = 640;
  var CANVAS_H  = 360;

  var TILE_W  = 32;
  var TILE_H  = 16;

  var COLS   = 12;
  var ROWS   = 10;
  var WALL_H = 60;

  var originX = 320;
  var originY = 65;

  var WALL_SLOPE = TILE_H / TILE_W; // 0.5

  // -------------------------------------------------------------------------
  // Coordinate conversion
  // -------------------------------------------------------------------------

  function isoToScreen(gx, gy) {
    return {
      sx: originX + (gx - gy) * (TILE_W / 2),
      sy: originY + (gx + gy) * (TILE_H / 2)
    };
  }

  // -------------------------------------------------------------------------
  // Colour palette
  // -------------------------------------------------------------------------

  var CLR_FLOOR_A = '#c8a97e';
  var CLR_FLOOR_B = '#bfa072';
  var CLR_FLOOR_EDGE = '#a8905e';
  var CLR_WALL_N  = '#7a8fa6';
  var CLR_WALL_W  = '#5a6f86';
  var CLR_CEIL    = '#2a3a4e';
  var CLR_SKIN    = '#f4b97a';
  var CLR_HAT     = '#f5d000';
  var CLR_HAT_D   = '#c8a800';
  var CLR_BODY    = '#3a5da8';
  var CLR_LEGS    = '#1e3a6e';
  var CLR_BOOTS   = '#2a2a2a';
  var CLR_WHITE   = '#f0f0e8';
  var CLR_SCRAWL  = '#4a8a5a';
  var CLR_WOOD    = '#6a4420';
  var CLR_WOOD_D  = '#4a2a0e';
  var CLR_WOOD_DD = '#3a1a0a';
  var CLR_GREY    = '#8a8a8a';
  var CLR_RED     = '#c0302a';
  var CLR_CHROME  = '#c0c0c0';
  var CLR_BELT    = '#2a2a2a';

  // -------------------------------------------------------------------------
  // State -> grid position map
  // -------------------------------------------------------------------------

  var locationMap = {
    starting: { gx: 11, gy: 1 },
    planning:  { gx: 2,  gy: 3 },
    building:  { gx: 9,  gy: 7 },
    sleeping:  { gx: 2,  gy: 8 },
    idle:      { gx: 6,  gy: 5 },
    complete:  { gx: 6,  gy: 4 },
    error:     { gx: 6,  gy: 6 },
  };

  // -------------------------------------------------------------------------
  // Drawing helpers
  // -------------------------------------------------------------------------

  function fillPoly(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.fill();
  }

  function strokePoly(ctx, pts, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width || 1;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.closePath();
    ctx.stroke();
  }

  // -------------------------------------------------------------------------
  // Isometric box (top + right + left visible faces)
  // -------------------------------------------------------------------------

  function drawIsoBox(ctx, gx, gy, gw, gd, ph, cTop, cRight, cLeft) {
    var tl = isoToScreen(gx,      gy);
    var tr = isoToScreen(gx + gw, gy);
    var br = isoToScreen(gx + gw, gy + gd);
    var bl = isoToScreen(gx,      gy + gd);

    // Left face (SW)
    ctx.fillStyle = cLeft;
    fillPoly(ctx, [
      { x: bl.sx, y: bl.sy - ph },
      { x: br.sx, y: br.sy - ph },
      { x: br.sx, y: br.sy },
      { x: bl.sx, y: bl.sy }
    ]);

    // Right face (SE)
    ctx.fillStyle = cRight;
    fillPoly(ctx, [
      { x: tr.sx, y: tr.sy - ph },
      { x: br.sx, y: br.sy - ph },
      { x: br.sx, y: br.sy },
      { x: tr.sx, y: tr.sy }
    ]);

    // Top face
    ctx.fillStyle = cTop;
    fillPoly(ctx, [
      { x: tl.sx, y: tl.sy - ph },
      { x: tr.sx, y: tr.sy - ph },
      { x: br.sx, y: br.sy - ph },
      { x: bl.sx, y: bl.sy - ph }
    ]);
  }

  // -------------------------------------------------------------------------
  // Wall detail helper — draws a properly skewed parallelogram on the north wall
  // Uses fractional grid coordinates for horizontal position (auto-skewed)
  // and pixel offsets for vertical position (straight up/down)
  // -------------------------------------------------------------------------

  function drawNorthWallPoly(ctx, gxLeft, gxRight, topDown, botUp, color) {
    // gxLeft, gxRight: fractional grid x positions on the wall
    // topDown: pixels down from the wall ceiling
    // botUp: pixels up from the wall floor
    var l = isoToScreen(gxLeft, 0);
    var r = isoToScreen(gxRight, 0);
    ctx.fillStyle = color;
    fillPoly(ctx, [
      { x: l.sx, y: l.sy - WALL_H + topDown },
      { x: r.sx, y: r.sy - WALL_H + topDown },
      { x: r.sx, y: r.sy - botUp },
      { x: l.sx, y: l.sy - botUp }
    ]);
  }

  // -------------------------------------------------------------------------
  // Office background + furniture
  // -------------------------------------------------------------------------

  function drawOffice(ctx) {
    // Background
    ctx.fillStyle = CLR_CEIL;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // North wall
    ctx.fillStyle = CLR_WALL_N;
    var n0 = isoToScreen(0,    0);
    var nC = isoToScreen(COLS, 0);
    fillPoly(ctx, [
      { x: n0.sx, y: n0.sy - WALL_H },
      { x: nC.sx, y: nC.sy - WALL_H },
      { x: nC.sx, y: nC.sy },
      { x: n0.sx, y: n0.sy }
    ]);

    // North wall baseboard
    drawNorthWallPoly(ctx, 0, COLS, WALL_H - 5, 0, '#6a7f96');

    // West wall
    ctx.fillStyle = CLR_WALL_W;
    var w0 = isoToScreen(0, 0);
    var wR = isoToScreen(0, ROWS);
    fillPoly(ctx, [
      { x: w0.sx, y: w0.sy - WALL_H },
      { x: wR.sx, y: wR.sy - WALL_H },
      { x: wR.sx, y: wR.sy },
      { x: w0.sx, y: w0.sy }
    ]);

    // Floor tiles (checkerboard, painter's order)
    for (var sum = 0; sum < COLS + ROWS; sum++) {
      for (var gxf = 0; gxf < COLS; gxf++) {
        var gyf = sum - gxf;
        if (gyf < 0 || gyf >= ROWS) continue;
        var t  = isoToScreen(gxf,     gyf);
        var r  = isoToScreen(gxf + 1, gyf);
        var b  = isoToScreen(gxf + 1, gyf + 1);
        var l  = isoToScreen(gxf,     gyf + 1);
        var tilePts = [
          { x: t.sx, y: t.sy },
          { x: r.sx, y: r.sy },
          { x: b.sx, y: b.sy },
          { x: l.sx, y: l.sy }
        ];
        ctx.fillStyle = (gxf + gyf) % 2 === 0 ? CLR_FLOOR_A : CLR_FLOOR_B;
        fillPoly(ctx, tilePts);
        strokePoly(ctx, tilePts, CLR_FLOOR_EDGE, 0.5);
      }
    }

    // Furniture — sorted back-to-front by gx+gy
    var furniture = [
      { fn: drawWindow,        gx: 4,  gy: 0 },
      { fn: drawClock,         gx: 7,  gy: 0 },
      { fn: drawDoor,          gx: 11, gy: 0 },
      { fn: drawWhiteboard,    gx: 1,  gy: 1 },
      { fn: drawShelf,         gx: 5,  gy: 1 },
      { fn: drawBookshelf,     gx: 9,  gy: 2 },
      { fn: drawWorkbench,     gx: 8,  gy: 5 },
      { fn: drawChair,         gx: 8.5, gy: 6.5 },
      { fn: drawCoffeeMachine, gx: 1,  gy: 7 },
      { fn: drawPlant,         gx: 10, gy: 9 },
    ];
    furniture.sort(function (a, b) { return (a.gx + a.gy) - (b.gx + b.gy); });
    furniture.forEach(function (f) { f.fn(ctx, f.gx, f.gy); });
  }

  // -------------------------------------------------------------------------
  // Furniture draw functions
  // -------------------------------------------------------------------------

  function drawWhiteboard(ctx, gx, gy) {
    var gd = 0.4;
    var fy = gy + gd; // front face y
    // Frame as iso box leaning on wall
    drawIsoBox(ctx, gx, gy, 2.5, gd, 40, '#8a6a4a', '#7a5a3a', '#6a4a2a');
    // White surface (on the front/SW face at fy)
    var tl = isoToScreen(gx + 0.1, fy);
    var tr = isoToScreen(gx + 2.4, fy);
    ctx.fillStyle = CLR_WHITE;
    fillPoly(ctx, [
      { x: tl.sx, y: tl.sy - 36 },
      { x: tr.sx, y: tr.sy - 36 },
      { x: tr.sx, y: tr.sy - 4 },
      { x: tl.sx, y: tl.sy - 4 }
    ]);
    // "PLAN" text on the board using canvas text API with transform to match board skew
    var textAnchor = isoToScreen(gx + 0.4, fy);
    var skewAngle = Math.atan2(TILE_H, TILE_W); // wall slope angle
    ctx.save();
    ctx.translate(textAnchor.sx, textAnchor.sy - 30);
    ctx.transform(1, Math.tan(skewAngle), 0, 1, 0, 0); // horizontal shear
    ctx.fillStyle = '#2a5a8a';
    ctx.font = 'bold 10px monospace';
    ctx.fillText('PLAN', 0, 0);
    ctx.restore();

    // Diagram lines below (skewed to board)
    ctx.fillStyle = CLR_SCRAWL;
    var dl = isoToScreen(gx + 0.3, fy);
    var dr = isoToScreen(gx + 2.0, fy);
    fillPoly(ctx, [
      { x: dl.sx, y: dl.sy - 20 },
      { x: dr.sx, y: dr.sy - 20 },
      { x: dr.sx, y: dr.sy - 18 },
      { x: dl.sx, y: dl.sy - 18 }
    ]);
    var d2r = isoToScreen(gx + 1.5, fy);
    fillPoly(ctx, [
      { x: dl.sx, y: dl.sy - 14 },
      { x: d2r.sx, y: d2r.sy - 14 },
      { x: d2r.sx, y: d2r.sy - 12 },
      { x: dl.sx, y: dl.sy - 12 }
    ]);
    var d3r = isoToScreen(gx + 1.8, fy);
    fillPoly(ctx, [
      { x: dl.sx, y: dl.sy - 8 },
      { x: d3r.sx, y: d3r.sy - 8 },
      { x: d3r.sx, y: d3r.sy - 6 },
      { x: dl.sx, y: dl.sy - 6 }
    ]);
    // Tray
    var trL = isoToScreen(gx + 0.2, fy);
    var trR = isoToScreen(gx + 2.3, fy);
    ctx.fillStyle = '#5a4a3a';
    fillPoly(ctx, [
      { x: trL.sx, y: trL.sy - 3 },
      { x: trR.sx, y: trR.sy - 3 },
      { x: trR.sx, y: trR.sy },
      { x: trL.sx, y: trL.sy }
    ]);
  }

  function drawWorkbench(ctx, gx, gy) {
    // Desk surface
    drawIsoBox(ctx, gx, gy, 2.5, 1.2, 14, CLR_WOOD, CLR_WOOD_D, CLR_WOOD_DD);
    // Monitor back
    var ml = isoToScreen(gx + 0.4, gy + 0.1);
    var mr = isoToScreen(gx + 1.6, gy + 0.1);
    ctx.fillStyle = '#1a1a2e';
    fillPoly(ctx, [
      { x: ml.sx, y: ml.sy - 40 },
      { x: mr.sx, y: mr.sy - 40 },
      { x: mr.sx, y: mr.sy - 14 },
      { x: ml.sx, y: ml.sy - 14 }
    ]);
    // Monitor screen
    var sl = isoToScreen(gx + 0.55, gy + 0.1);
    var sr = isoToScreen(gx + 1.45, gy + 0.1);
    ctx.fillStyle = '#2a4a8a';
    fillPoly(ctx, [
      { x: sl.sx, y: sl.sy - 37 },
      { x: sr.sx, y: sr.sy - 37 },
      { x: sr.sx, y: sr.sy - 17 },
      { x: sl.sx, y: sl.sy - 17 }
    ]);
    // Screen glow line
    ctx.fillStyle = '#4a6aaa';
    fillPoly(ctx, [
      { x: sl.sx, y: sl.sy - 33 },
      { x: sr.sx, y: sr.sy - 33 },
      { x: sr.sx, y: sr.sy - 31 },
      { x: sl.sx, y: sl.sy - 31 }
    ]);
    ctx.fillStyle = '#3a5a9a';
    fillPoly(ctx, [
      { x: sl.sx, y: sl.sy - 27 },
      { x: sr.sx, y: sr.sy - 27 },
      { x: sr.sx, y: sr.sy - 25 },
      { x: sl.sx, y: sl.sy - 25 }
    ]);
    // Monitor stand
    var st = isoToScreen(gx + 0.9, gy + 0.15);
    ctx.fillStyle = CLR_GREY;
    ctx.fillRect(st.sx - 2, st.sy - 14, 6, 8);
    // Keyboard
    drawIsoBox(ctx, gx + 0.2, gy + 0.6, 1.0, 0.4, 2, '#3a3a3a', '#2a2a2a', '#1a1a1a');
  }

  function drawChair(ctx, gx, gy) {
    // Office chair — pedestal, seat, backrest facing desk (low gy = toward desk)
    // Pedestal/base
    var base = isoToScreen(gx + 0.5, gy + 0.5);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(base.sx - 3, base.sy - 2, 6, 4);
    // Star base legs
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(base.sx - 6, base.sy, 4, 2);
    ctx.fillRect(base.sx + 2, base.sy, 4, 2);
    ctx.fillRect(base.sx - 1, base.sy + 1, 3, 2);
    // Stem
    ctx.fillRect(base.sx - 1, base.sy - 6, 3, 5);
    // Seat
    drawIsoBox(ctx, gx + 0.05, gy + 0.05, 0.9, 0.9, 8, '#3a3a3a', '#2a2a2a', '#1a1a1a');
  }

  function drawCoffeeMachine(ctx, gx, gy) {
    // Bed — drawn as flat shapes to avoid iso box overlap issues

    // Headboard (tall, at the wall-side / low-gx end)
    drawIsoBox(ctx, gx, gy, 0.15, 1.2, 28, '#5a3418', '#4a2a0e', '#3a1a0a');

    // Bed frame (low wooden box)
    drawIsoBox(ctx, gx, gy, 2.2, 1.2, 8, '#6a4420', '#4a2a0e', '#3a1a0a');

    // Mattress (sits on top of frame — white/cream, slightly inset)
    drawIsoBox(ctx, gx + 0.15, gy + 0.1, 1.9, 1.0, 12, '#e8e0d0', '#d8d0c0', '#c8c0b0');

    // Blanket (covers the foot half of the mattress)
    drawIsoBox(ctx, gx + 1.0, gy + 0.15, 1.0, 0.9, 14, '#4a6a8a', '#3a5a7a', '#2a4a6a');

    // (pillow removed — looked like a floating cube)
  }

  function drawShelf(ctx, gx, gy) {
    // Shelf board (skewed to wall angle)
    drawNorthWallPoly(ctx, gx, gx + 2.5, 12, WALL_H - 18, CLR_WOOD);
    drawNorthWallPoly(ctx, gx, gx + 2.5, 18, WALL_H - 20, CLR_WOOD_D);
    // Books on shelf (skewed to wall)
    drawNorthWallPoly(ctx, gx + 0.15, gx + 0.55, 13, WALL_H - 13, '#c03020');
    drawNorthWallPoly(ctx, gx + 0.6,  gx + 0.95, 14, WALL_H - 13, '#2060a0');
    drawNorthWallPoly(ctx, gx + 1.0,  gx + 1.4,  13, WALL_H - 14, '#20a030');
    drawNorthWallPoly(ctx, gx + 1.5,  gx + 1.8,  14, WALL_H - 13, '#a06020');
  }

  function drawPlant(ctx, gx, gy) {
    // Terracotta pot
    drawIsoBox(ctx, gx, gy, 1, 1, 16, '#a05030', '#803020', '#602010');
    // Soil
    drawIsoBox(ctx, gx + 0.1, gy + 0.1, 0.8, 0.8, 17, '#3a2a1a', '#3a2a1a', '#3a2a1a');
    // Stem
    var p = isoToScreen(gx + 0.5, gy + 0.5);
    ctx.fillStyle = '#2a6a2a';
    ctx.fillRect(p.sx - 1, p.sy - 36, 3, 20);
    // Leaves (small iso-ish shapes)
    ctx.fillStyle = '#3aaa4a';
    fillPoly(ctx, [
      { x: p.sx, y: p.sy - 36 },
      { x: p.sx + 10, y: p.sy - 32 },
      { x: p.sx + 6, y: p.sy - 26 },
      { x: p.sx - 2, y: p.sy - 30 }
    ]);
    ctx.fillStyle = '#2a9a3a';
    fillPoly(ctx, [
      { x: p.sx, y: p.sy - 34 },
      { x: p.sx - 10, y: p.sy - 28 },
      { x: p.sx - 6, y: p.sy - 22 },
      { x: p.sx + 2, y: p.sy - 28 }
    ]);
    ctx.fillStyle = '#4aba5a';
    fillPoly(ctx, [
      { x: p.sx, y: p.sy - 38 },
      { x: p.sx + 7, y: p.sy - 40 },
      { x: p.sx + 4, y: p.sy - 34 },
      { x: p.sx - 3, y: p.sy - 36 }
    ]);
  }

  function drawClock(ctx, gx, gy) {
    // Frame on north wall (skewed)
    drawNorthWallPoly(ctx, gx - 0.5, gx + 0.5, 6, WALL_H - 22, '#5a3a1a');
    // Face
    drawNorthWallPoly(ctx, gx - 0.35, gx + 0.35, 8, WALL_H - 20, CLR_WHITE);
    // Hour hand (vertical on wall = straight up)
    var cp = isoToScreen(gx, 0);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cp.sx - 1, cp.sy - WALL_H + 10, 2, 7);
    // Minute hand
    ctx.fillRect(cp.sx, cp.sy - WALL_H + 14, 5, 2);
    // Center dot
    ctx.fillStyle = '#c02020';
    ctx.fillRect(cp.sx - 1, cp.sy - WALL_H + 14, 3, 3);
  }

  function drawWindow(ctx, gx, gy) {
    // Frame (skewed to wall)
    drawNorthWallPoly(ctx, gx - 1, gx + 1, 6, 4, '#6a5a4a');
    // Glass
    drawNorthWallPoly(ctx, gx - 0.85, gx + 0.85, 9, 7, '#7aaad0');
    // Lighter sky reflection
    drawNorthWallPoly(ctx, gx - 0.85, gx + 0.85, 9, WALL_H / 2 - 2, '#8abae0');
    // Vertical divider (thin, negligible skew)
    var mid = isoToScreen(gx, 0);
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(mid.sx - 1, mid.sy - WALL_H + 9, 3, WALL_H - 16);
    // Horizontal divider (skewed)
    drawNorthWallPoly(ctx, gx - 0.85, gx + 0.85, WALL_H / 2 - 3, WALL_H / 2 - 6, '#6a5a4a');
  }

  function drawBookshelf(ctx, gx, gy) {
    var gd = 0.8;
    // Cabinet body
    drawIsoBox(ctx, gx, gy, 1.8, gd, 44, CLR_WOOD, CLR_WOOD_D, CLR_WOOD_DD);
    // Interior visible on left (SW) face — at gy + gd
    var fy = gy + gd;
    var il = isoToScreen(gx + 0.15, fy);
    var ir = isoToScreen(gx + 1.65, fy);
    ctx.fillStyle = '#f0e8d0';
    fillPoly(ctx, [
      { x: il.sx, y: il.sy - 40 },
      { x: ir.sx, y: ir.sy - 40 },
      { x: ir.sx, y: ir.sy - 2 },
      { x: il.sx, y: il.sy - 2 }
    ]);
    // Shelf dividers
    ctx.fillStyle = CLR_WOOD;
    fillPoly(ctx, [
      { x: il.sx, y: il.sy - 26 },
      { x: ir.sx, y: ir.sy - 26 },
      { x: ir.sx, y: ir.sy - 24 },
      { x: il.sx, y: il.sy - 24 }
    ]);
    fillPoly(ctx, [
      { x: il.sx, y: il.sy - 13 },
      { x: ir.sx, y: ir.sy - 13 },
      { x: ir.sx, y: ir.sy - 11 },
      { x: il.sx, y: il.sy - 11 }
    ]);
    // Books on shelves (on the front face)
    var b1l = isoToScreen(gx + 0.2, fy);
    var b1r = isoToScreen(gx + 0.55, fy);
    var b2l = isoToScreen(gx + 0.6, fy);
    var b2r = isoToScreen(gx + 0.95, fy);
    var b3l = isoToScreen(gx + 1.0, fy);
    var b3r = isoToScreen(gx + 1.3, fy);
    // Top shelf books
    ctx.fillStyle = '#b03020';
    fillPoly(ctx, [
      { x: b1l.sx, y: b1l.sy - 38 }, { x: b1r.sx, y: b1r.sy - 38 },
      { x: b1r.sx, y: b1r.sy - 27 }, { x: b1l.sx, y: b1l.sy - 27 }
    ]);
    ctx.fillStyle = '#2050b0';
    fillPoly(ctx, [
      { x: b2l.sx, y: b2l.sy - 38 }, { x: b2r.sx, y: b2r.sy - 38 },
      { x: b2r.sx, y: b2r.sy - 27 }, { x: b2l.sx, y: b2l.sy - 27 }
    ]);
    ctx.fillStyle = '#20a040';
    fillPoly(ctx, [
      { x: b3l.sx, y: b3l.sy - 36 }, { x: b3r.sx, y: b3r.sy - 36 },
      { x: b3r.sx, y: b3r.sy - 27 }, { x: b3l.sx, y: b3l.sy - 27 }
    ]);
    // Middle shelf books
    ctx.fillStyle = '#a06020';
    fillPoly(ctx, [
      { x: b1l.sx, y: b1l.sy - 23 }, { x: b1r.sx, y: b1r.sy - 23 },
      { x: b1r.sx, y: b1r.sy - 14 }, { x: b1l.sx, y: b1l.sy - 14 }
    ]);
    ctx.fillStyle = '#8020a0';
    fillPoly(ctx, [
      { x: b2l.sx, y: b2l.sy - 23 }, { x: b2r.sx, y: b2r.sy - 23 },
      { x: b2r.sx, y: b2r.sy - 14 }, { x: b2l.sx, y: b2l.sy - 14 }
    ]);
  }

  function drawDoor(ctx, gx, gy) {
    // Door frame (skewed to wall)
    drawNorthWallPoly(ctx, gx - 0.8, gx + 0.8, 0, 0, '#6a5a4a');
    // Door panel
    drawNorthWallPoly(ctx, gx - 0.65, gx + 0.65, 3, 3, '#c8a870');
    // Upper panel
    drawNorthWallPoly(ctx, gx - 0.5, gx + 0.5, 6, WALL_H / 2 + 2, '#b89860');
    // Lower panel
    drawNorthWallPoly(ctx, gx - 0.5, gx + 0.5, WALL_H / 2 + 6, 6, '#b89860');
    // Knob
    var kp = isoToScreen(gx + 0.3, 0);
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(kp.sx, kp.sy - WALL_H / 2 - 2, 4, 4);
    ctx.fillStyle = '#e0e0e0';
    ctx.fillRect(kp.sx + 1, kp.sy - WALL_H / 2 - 1, 2, 2);
  }

  // -------------------------------------------------------------------------
  // Ralph sprite (screen pixel coordinates)
  // -------------------------------------------------------------------------

  function drawRalph(ctx, x, y, animFrame) {
    // (x, y) is the top-left of the hat
    // Total sprite: ~16px wide, ~36px tall

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    fillPoly(ctx, [
      { x: x - 1,  y: y + 35 },
      { x: x + 17, y: y + 35 },
      { x: x + 15, y: y + 38 },
      { x: x + 1,  y: y + 38 }
    ]);

    // Legs — alternate each frame for walk cycle
    ctx.fillStyle = CLR_LEGS;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x + 2,  y + 27, 5, 6);
      ctx.fillRect(x + 9,  y + 25, 5, 6);
    } else {
      ctx.fillRect(x + 2,  y + 25, 5, 6);
      ctx.fillRect(x + 9,  y + 27, 5, 6);
    }

    // Boots
    ctx.fillStyle = CLR_BOOTS;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x + 1,  y + 32, 7, 3);
      ctx.fillRect(x + 8,  y + 30, 7, 3);
    } else {
      ctx.fillRect(x + 1,  y + 30, 7, 3);
      ctx.fillRect(x + 8,  y + 32, 7, 3);
    }

    // Body (blue overalls)
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x + 1, y + 15, 14, 12);

    // Arms (swing with walk)
    ctx.fillStyle = CLR_BODY;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x - 2, y + 16, 3, 8);
      ctx.fillRect(x + 15, y + 18, 3, 8);
    } else {
      ctx.fillRect(x - 2, y + 18, 3, 8);
      ctx.fillRect(x + 15, y + 16, 3, 8);
    }
    // Hands
    ctx.fillStyle = CLR_SKIN;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x - 2, y + 23, 3, 2);
      ctx.fillRect(x + 15, y + 25, 3, 2);
    } else {
      ctx.fillRect(x - 2, y + 25, 3, 2);
      ctx.fillRect(x + 15, y + 23, 3, 2);
    }

    // Overall straps
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(x + 3, y + 15, 3, 4);
    ctx.fillRect(x + 10, y + 15, 3, 4);

    // Belt
    ctx.fillStyle = CLR_BELT;
    ctx.fillRect(x + 1, y + 25, 14, 2);
    // Buckle
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(x + 7, y + 25, 3, 2);

    // Head
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x + 3, y + 5, 10, 10);

    // Eyes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 5, y + 8, 2, 2);
    ctx.fillRect(x + 9, y + 8, 2, 2);

    // Mouth
    ctx.fillStyle = '#c08060';
    ctx.fillRect(x + 6, y + 12, 4, 1);

    // Hard hat
    ctx.fillStyle = CLR_HAT;
    ctx.fillRect(x + 2, y + 1, 12, 5);
    // Hat brim
    ctx.fillRect(x, y + 5, 16, 2);
    // Hat highlight
    ctx.fillStyle = '#ffe040';
    ctx.fillRect(x + 4, y + 2, 8, 2);
    // Hat shadow
    ctx.fillStyle = CLR_HAT_D;
    ctx.fillRect(x, y + 6, 16, 1);
  }

  // -------------------------------------------------------------------------
  // Ralph sitting pose (at desk — upper body only, no legs)
  // -------------------------------------------------------------------------

  function drawRalphSitting(ctx, x, y, animFrame) {
    // 3/4 back view — Ralph angled toward the monitor (upper-left in iso)
    // Body shifted right and narrower to show the turn

    // Body (blue overalls) — angled, slightly narrower
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x + 3, y + 15, 12, 10);

    // Arms reaching toward keyboard (forward and slightly right)
    // Far arm (left)
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x + 2, y + 15, 4, 5);
    ctx.fillRect(x + 3, y + 12, 4, 5);
    // Far hand on keyboard
    ctx.fillStyle = CLR_SKIN;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x + 4, y + 10, 4, 3);
    } else {
      ctx.fillRect(x + 4, y + 11, 4, 3);
    }

    // Near arm (right)
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x + 10, y + 15, 4, 4);
    ctx.fillRect(x + 12, y + 12, 4, 4);
    // Near hand on keyboard
    ctx.fillStyle = CLR_SKIN;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x + 14, y + 10, 4, 3);
    } else {
      ctx.fillRect(x + 14, y + 11, 4, 3);
    }

    // Overall strap (only near side visible)
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(x + 11, y + 15, 3, 4);

    // Belt
    ctx.fillStyle = CLR_BELT;
    ctx.fillRect(x + 3, y + 23, 12, 2);

    // Head — 3/4 back view, turned toward screen
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x + 3, y + 5, 10, 10);
    // Hair covers most of back of head, small skin sliver on near side
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x + 3, y + 7, 7, 6);
    // Ear on near side
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x + 12, y + 8, 2, 3);

    // Hard hat — angled
    ctx.fillStyle = CLR_HAT;
    ctx.fillRect(x + 2, y + 1, 12, 5);
    ctx.fillRect(x, y + 5, 15, 2);
    ctx.fillStyle = '#ffe040';
    ctx.fillRect(x + 3, y + 2, 8, 2);
    ctx.fillStyle = CLR_HAT_D;
    ctx.fillRect(x, y + 6, 15, 1);
  }

  // -------------------------------------------------------------------------
  // Ralph sleeping pose (in bed — lying horizontal)
  // -------------------------------------------------------------------------

  function drawRalphSleeping(ctx, x, y) {
    // Draw Ralph lying along the bed's gx axis (upper-left to lower-right, slope 0.5)
    // Head at the headboard end (low gx = upper-left), feet toward high gx (lower-right)
    // (x, y) is the anchor point at the bed center

    var s = 0.5; // iso slope

    // Body under blanket — angled bump following the bed
    ctx.fillStyle = '#3a5878';
    fillPoly(ctx, [
      { x: x - 6,  y: y - 3 - 3 },
      { x: x + 14, y: y - 3 + 7 },
      { x: x + 14, y: y - 6 + 7 },
      { x: x + 6,  y: y - 8 + 3 },
      { x: x - 2,  y: y - 8 - 1 },
      { x: x - 6,  y: y - 5 - 3 }
    ]);

    // Head on pillow (at the headboard end — upper-left)
    ctx.fillStyle = CLR_SKIN;
    fillPoly(ctx, [
      { x: x - 12, y: y - 6 - 6 },
      { x: x - 4,  y: y - 6 - 2 },
      { x: x - 4,  y: y - 0 - 2 },
      { x: x - 12, y: y - 0 - 6 }
    ]);

    // Eyes closed (small dashes on the face, angled)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x - 11, y - 8, 3, 1);
    ctx.fillRect(x - 8,  y - 7, 3, 1);

    // Hat (sideways, angled with the bed)
    ctx.fillStyle = CLR_HAT;
    fillPoly(ctx, [
      { x: x - 15, y: y - 10 - 5 },
      { x: x - 7,  y: y - 10 - 1 },
      { x: x - 7,  y: y - 7 - 1 },
      { x: x - 15, y: y - 7 - 5 }
    ]);
    ctx.fillStyle = '#ffe040';
    fillPoly(ctx, [
      { x: x - 14, y: y - 9 - 5 },
      { x: x - 8,  y: y - 9 - 2 },
      { x: x - 8,  y: y - 8 - 2 },
      { x: x - 14, y: y - 8 - 5 }
    ]);

    // Zzz (floating above, angled upward)
    ctx.fillStyle = 'rgba(200,200,255,0.5)';
    ctx.fillRect(x - 8, y - 18, 4, 4);
    ctx.fillRect(x - 5, y - 22, 3, 3);
    ctx.fillRect(x - 2, y - 25, 2, 2);
  }

  // -------------------------------------------------------------------------
  // Game-loop state
  // -------------------------------------------------------------------------

  var ralphGX      = locationMap.idle.gx;
  var ralphGY      = locationMap.idle.gy;
  var targetGX     = ralphGX;
  var targetGY     = ralphGY;
  var currentState = 'idle';
  var animFrame    = 0;
  var animTimer    = 0;

  function updateState(newState) {
    if (!locationMap[newState]) return;
    currentState = newState;
    targetGX = locationMap[newState].gx;
    targetGY = locationMap[newState].gy;
  }

  function renderFrame(ctx, state, rX, rY, aFrame) {
    drawOffice(ctx);
    drawRalph(ctx, rX, rY, aFrame);
    drawChairBackrest(ctx);
  }

  function drawRalphFacingAway(ctx, x, y, animFrame) {
    // Same as drawRalph but no eyes/mouth — facing the furniture

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    fillPoly(ctx, [
      { x: x - 1,  y: y + 35 },
      { x: x + 17, y: y + 35 },
      { x: x + 15, y: y + 38 },
      { x: x + 1,  y: y + 38 }
    ]);

    // Legs (standing still — no walk animation)
    ctx.fillStyle = CLR_LEGS;
    ctx.fillRect(x + 2,  y + 27, 5, 5);
    ctx.fillRect(x + 9,  y + 27, 5, 5);
    // Boots
    ctx.fillStyle = CLR_BOOTS;
    ctx.fillRect(x + 1,  y + 31, 7, 3);
    ctx.fillRect(x + 8,  y + 31, 7, 3);

    // Body
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x + 1, y + 15, 14, 12);

    // Arms at sides (still, working)
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x - 2, y + 16, 3, 9);
    ctx.fillRect(x + 15, y + 16, 3, 9);
    // Hands
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x - 2, y + 24, 3, 2);
    ctx.fillRect(x + 15, y + 24, 3, 2);

    // Overall straps
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(x + 3, y + 15, 3, 4);
    ctx.fillRect(x + 10, y + 15, 3, 4);

    // Belt
    ctx.fillStyle = CLR_BELT;
    ctx.fillRect(x + 1, y + 25, 14, 2);
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(x + 7, y + 25, 3, 2);

    // Head — back of head, no face
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x + 3, y + 5, 10, 10);
    // Hair/back of head detail
    ctx.fillStyle = '#8a6a3a';
    ctx.fillRect(x + 4, y + 7, 8, 6);

    // Hard hat
    ctx.fillStyle = CLR_HAT;
    ctx.fillRect(x + 2, y + 1, 12, 5);
    ctx.fillRect(x, y + 5, 16, 2);
    ctx.fillStyle = '#ffe040';
    ctx.fillRect(x + 4, y + 2, 8, 2);
    ctx.fillStyle = CLR_HAT_D;
    ctx.fillRect(x, y + 6, 16, 1);
  }

  function drawChairBackrest(ctx) {
    // Draw the chair backrest in front of Ralph (after he's drawn)
    var chairGX = 8.5, chairGY = 6.5;
    drawIsoBox(ctx, chairGX + 0.1, chairGY + 0.75, 0.8, 0.15, 20, '#3a3a3a', '#2a2a2a', '#1a1a1a');
  }

  function renderFramePose(ctx, state, rX, rY, aFrame) {
    drawOffice(ctx);
    if (state === 'building') {
      drawRalphSitting(ctx, rX, rY, aFrame);
    } else if (state === 'sleeping') {
      drawRalphSleeping(ctx, rX, rY);
    } else if (state === 'planning') {
      drawRalphFacingAway(ctx, rX, rY, aFrame);
    } else {
      drawRalph(ctx, rX, rY, aFrame);
    }
    drawChairBackrest(ctx);
  }

  function gameLoop(ctx) {
    animTimer++;

    var moving = (ralphGX !== targetGX || ralphGY !== targetGY);

    if (moving) {
      if (animTimer % 8 === 0) {
        if (ralphGX !== targetGX) {
          ralphGX += (ralphGX < targetGX) ? 1 : -1;
        } else if (ralphGY !== targetGY) {
          ralphGY += (ralphGY < targetGY) ? 1 : -1;
        }
      }
      animFrame = Math.floor(animTimer / 8) % 4;
    } else {
      switch (currentState) {
        case 'planning': animFrame = Math.floor(animTimer / 30) % 2; break;
        case 'building': animFrame = Math.floor(animTimer / 15) % 2; break;
        case 'sleeping': animFrame = Math.floor(animTimer / 60) % 2; break;
        case 'complete': animFrame = Math.floor(animTimer / 8)  % 4; break;
        case 'error':    animFrame = Math.floor(animTimer / 30) % 2; break;
        default:         animFrame = Math.floor(animTimer / 60) % 2; break;
      }
    }

    var screen = isoToScreen(ralphGX, ralphGY);
    if (moving) {
      renderFrame(ctx, currentState, screen.sx - 8, screen.sy - 36, animFrame);
    } else if (currentState === 'sleeping') {
      // Sleeping Ralph lies on the bed — center on mattress
      renderFramePose(ctx, currentState, screen.sx + 8, screen.sy - 2, animFrame);
    } else if (currentState === 'building') {
      // Sitting Ralph — lower than standing so he's on the chair seat
      renderFramePose(ctx, currentState, screen.sx - 8, screen.sy - 26, animFrame);
    } else {
      renderFramePose(ctx, currentState, screen.sx - 8, screen.sy - 36, animFrame);
    }
  }

  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  exports.TILE_SIZE         = TILE_SIZE;
  exports.CANVAS_W          = CANVAS_W;
  exports.CANVAS_H          = CANVAS_H;
  exports.locationMap       = locationMap;
  exports.isoToScreen       = isoToScreen;
  exports.drawOffice        = drawOffice;
  exports.drawRalph         = drawRalph;
  exports.drawWhiteboard    = drawWhiteboard;
  exports.drawWorkbench     = drawWorkbench;
  exports.drawCoffeeMachine = drawCoffeeMachine;
  exports.drawShelf         = drawShelf;
  exports.drawPlant         = drawPlant;
  exports.drawClock         = drawClock;
  exports.drawWindow        = drawWindow;
  exports.drawBookshelf     = drawBookshelf;
  exports.drawDoor          = drawDoor;
  exports.updateState       = updateState;
  exports.renderFrame       = renderFrame;
  exports.renderFramePose   = renderFramePose;
  exports.gameLoop          = gameLoop;

})(typeof module !== 'undefined' ? module.exports : (window.Game = {}));
