'use strict';

// game.js — Ralph Shop 2.5D 8-bit office visualiser
// Dual-environment: browser (window.Game) or Node.js (module.exports)

(function (exports) {

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  var TILE_SIZE = 16;
  var CANVAS_W  = 320;
  var CANVAS_H  = 180;

  // Wall occupies rows 0-2 (y 0-47); floor fills the rest.
  var WALL_ROWS = 3;

  // -------------------------------------------------------------------------
  // State → tile position map
  // -------------------------------------------------------------------------

  var locationMap = {
    starting: { x: 18, y: 9 },
    planning:  { x: 2,  y: 2 },
    building:  { x: 13, y: 5 },
    sleeping:  { x: 2,  y: 8 },
    idle:      { x: 10, y: 6 },
    complete:  { x: 10, y: 5 },
    error:     { x: 10, y: 7 },
  };

  // -------------------------------------------------------------------------
  // Colour palette
  // -------------------------------------------------------------------------

  var CLR_FLOOR   = '#c8a97e'; // warm tan   R=200 G=169 B=126
  var CLR_WALL    = '#7a8fa6'; // blue-grey  R=122 G=143 B=166
  var CLR_CEILING = '#5a6f82'; // darker bg  R= 90 G=111 B=130
  var CLR_SKIRTING = '#4a3a2a';
  var CLR_SKIN    = '#f4b97a'; // face
  var CLR_HAT     = '#f5d000'; // hard hat   R=245 G=208 B=  0  ← yellow
  var CLR_BODY    = '#3a5da8'; // blue overalls
  var CLR_LEGS    = '#1e3a6e'; // dark blue legs
  var CLR_WHITE   = '#f0f0e8'; // off-white
  var CLR_SCRAWL  = '#4a8a5a'; // whiteboard green ink
  var CLR_WOOD    = '#5c3d1e'; // dark wood
  var CLR_GREY    = '#8a8a8a'; // monitor/chrome
  var CLR_RED     = '#c0302a'; // coffee machine
  var CLR_CHROME  = '#c0c0c0'; // chrome accents

  // -------------------------------------------------------------------------
  // Helper: tile → pixel
  // -------------------------------------------------------------------------

  function px(tile) { return tile * TILE_SIZE; }

  // -------------------------------------------------------------------------
  // Office background
  // -------------------------------------------------------------------------

  function drawOffice(ctx) {
    // Floor (whole canvas)
    ctx.fillStyle = CLR_FLOOR;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Back wall (top WALL_ROWS rows)
    ctx.fillStyle = CLR_WALL;
    ctx.fillRect(0, 0, CANVAS_W, WALL_ROWS * TILE_SIZE);

    // Ceiling strip (top row)
    ctx.fillStyle = CLR_CEILING;
    ctx.fillRect(0, 0, CANVAS_W, TILE_SIZE);

    // Skirting board (wall/floor divider)
    ctx.fillStyle = CLR_SKIRTING;
    ctx.fillRect(0, WALL_ROWS * TILE_SIZE, CANVAS_W, 3);

    // Furniture
    drawWhiteboard(ctx, 2, 2);
    drawWorkbench(ctx, 13, 5);
    drawCoffeeMachine(ctx, 2, 8);
    drawShelf(ctx, 6, 1);
    drawPlant(ctx, 18, 7);
    drawClock(ctx, 10, 1);
    drawBookshelf(ctx, 17, 2);
    drawDoor(ctx, 5, 1);
    drawWindow(ctx, 15, 1);
  }

  // -------------------------------------------------------------------------
  // Furniture draw functions (tile coordinates tx, ty)
  // -------------------------------------------------------------------------

  function drawWhiteboard(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Wooden frame
    ctx.fillStyle = '#8a6a4a';
    ctx.fillRect(x - 2, y - 2, 36, 26);
    // Board surface
    ctx.fillStyle = CLR_WHITE;
    ctx.fillRect(x, y, 32, 22);
    // Chalk/marker scribbles
    ctx.fillStyle = CLR_SCRAWL;
    ctx.fillRect(x + 4,  y + 4,  16, 2);
    ctx.fillRect(x + 4,  y + 8,  12, 2);
    ctx.fillRect(x + 4,  y + 13, 18, 2);
    ctx.fillStyle = '#3a6aaa';
    ctx.fillRect(x + 22, y + 4,   6, 6);
  }

  function drawWorkbench(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Monitor screen
    ctx.fillStyle = '#1a1a3a';
    ctx.fillRect(x + 8, y - 12, 28, 20);
    ctx.fillStyle = '#2a4a8a';
    ctx.fillRect(x + 10, y - 10, 24, 16);
    // Monitor stand
    ctx.fillStyle = CLR_GREY;
    ctx.fillRect(x + 18, y + 4, 4, 8);
    // Desk surface
    ctx.fillStyle = CLR_WOOD;
    ctx.fillRect(x, y + 8, 48, 8);
    // Desk legs
    ctx.fillStyle = '#3a2a0e';
    ctx.fillRect(x + 2,  y + 16, 4, 12);
    ctx.fillRect(x + 42, y + 16, 4, 12);
  }

  function drawCoffeeMachine(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Body
    ctx.fillStyle = CLR_RED;
    ctx.fillRect(x, y, 16, 20);
    // Chrome top
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(x + 2, y + 2, 12, 4);
    // Front panel
    ctx.fillStyle = '#8a1a1a';
    ctx.fillRect(x + 2, y + 8, 12, 8);
    // Spout
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(x + 4, y + 14, 8, 4);
    // Mug
    ctx.fillStyle = CLR_WHITE;
    ctx.fillRect(x + 2, y + 20, 10, 8);
    // Mug handle
    ctx.fillStyle = CLR_GREY;
    ctx.fillRect(x + 12, y + 22, 4, 4);
  }

  function drawShelf(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Shelf board
    ctx.fillStyle = CLR_WOOD;
    ctx.fillRect(x, y + 12, 32, 4);
    // Books on shelf
    ctx.fillStyle = '#c03020';
    ctx.fillRect(x + 2,  y + 4, 6, 8);
    ctx.fillStyle = '#2060a0';
    ctx.fillRect(x + 10, y + 2, 6, 10);
    ctx.fillStyle = '#20a030';
    ctx.fillRect(x + 18, y + 6, 6, 6);
  }

  function drawPlant(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Leaves
    ctx.fillStyle = '#2a8a3a';
    ctx.fillRect(x,      y,      8,  14);
    ctx.fillRect(x + 6,  y + 2,  8,  12);
    ctx.fillRect(x + 3,  y + 4,  10, 10);
    // Pot
    ctx.fillStyle = '#a05030';
    ctx.fillRect(x + 2,  y + 12, 12, 10);
    // Soil
    ctx.fillStyle = '#6a4020';
    ctx.fillRect(x + 3,  y + 12, 10, 3);
  }

  function drawClock(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Frame
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(x, y, 16, 16);
    // Face
    ctx.fillStyle = CLR_WHITE;
    ctx.fillRect(x + 2, y + 2, 12, 12);
    // Clock hands
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 7, y + 4, 2, 5); // 12-o'clock
    ctx.fillRect(x + 7, y + 7, 4, 2); // 3-o'clock
  }

  function drawWindow(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Frame
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x, y, 32, 24);
    // Sky
    ctx.fillStyle = '#7aaad0';
    ctx.fillRect(x + 2, y + 2, 28, 20);
    // Cross divider
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x + 14, y + 2,  4, 20);
    ctx.fillRect(x + 2,  y + 10, 28, 4);
  }

  function drawBookshelf(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Cabinet
    ctx.fillStyle = CLR_WOOD;
    ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#f0e8d0';
    ctx.fillRect(x + 2, y + 2, 28, 28);
    // Shelves
    ctx.fillStyle = CLR_WOOD;
    ctx.fillRect(x + 2, y + 12, 28, 2);
    ctx.fillRect(x + 2, y + 22, 28, 2);
    // Books
    ctx.fillStyle = '#b03020';
    ctx.fillRect(x + 4,  y + 4, 4, 8);
    ctx.fillStyle = '#2050b0';
    ctx.fillRect(x + 10, y + 4, 4, 8);
    ctx.fillStyle = '#20a040';
    ctx.fillRect(x + 16, y + 4, 4, 8);
  }

  function drawDoor(ctx, tx, ty) {
    var x = px(tx), y = px(ty);
    // Frame
    ctx.fillStyle = '#6a5a4a';
    ctx.fillRect(x, y, 24, 32);
    // Door panel
    ctx.fillStyle = '#c8a870';
    ctx.fillRect(x + 2, y + 2, 20, 30);
    // Upper recess
    ctx.fillStyle = '#b09060';
    ctx.fillRect(x + 4, y + 4, 16, 12);
    // Lower recess
    ctx.fillRect(x + 4, y + 18, 16, 12);
    // Doorknob
    ctx.fillStyle = CLR_CHROME;
    ctx.fillRect(x + 16, y + 15, 4, 4);
  }

  // -------------------------------------------------------------------------
  // Ralph sprite
  // -------------------------------------------------------------------------

  function drawRalph(ctx, x, y, animFrame) {
    // Legs — alternate position each frame to drive walk cycle
    ctx.fillStyle = CLR_LEGS;
    if (animFrame % 2 === 0) {
      ctx.fillRect(x,     y + 14, 3, 4); // left leg forward
      ctx.fillRect(x + 5, y + 12, 3, 4); // right leg back
    } else {
      ctx.fillRect(x,     y + 12, 3, 4); // left leg back
      ctx.fillRect(x + 5, y + 14, 3, 4); // right leg forward
    }
    // Body (blue overalls)
    ctx.fillStyle = CLR_BODY;
    ctx.fillRect(x, y + 6, 8, 8);
    // Head (skin)
    ctx.fillStyle = CLR_SKIN;
    ctx.fillRect(x + 1, y, 6, 6);
    // Yellow hard hat — sits on top of head
    ctx.fillStyle = CLR_HAT;
    ctx.fillRect(x, y - 3, 8, 3);
  }

  // -------------------------------------------------------------------------
  // Game-loop state (browser-side)
  // -------------------------------------------------------------------------

  var ralphX       = locationMap.idle.x * TILE_SIZE;
  var ralphY       = locationMap.idle.y * TILE_SIZE;
  var targetX      = ralphX;
  var targetY      = ralphY;
  var currentState = 'idle';
  var animFrame    = 0;
  var animTimer    = 0;

  /** Called by WebSocket message handler in index.html */
  function updateState(newState) {
    if (!locationMap[newState]) return;
    currentState = newState;
    targetX = locationMap[newState].x * TILE_SIZE;
    targetY = locationMap[newState].y * TILE_SIZE;
  }

  /**
   * renderFrame — stateless render; useful for tests and for the game loop
   * to supply pre-computed coordinates.
   */
  function renderFrame(ctx, state, rX, rY, aFrame) {
    drawOffice(ctx);
    drawRalph(ctx, rX, rY, aFrame);
  }

  /**
   * gameLoop — advances internal state then renders.
   * Called from requestAnimationFrame in index.html.
   */
  function gameLoop(ctx) {
    animTimer++;

    var moving = (ralphX !== targetX || ralphY !== targetY);

    if (moving) {
      // Move horizontally first, then vertically (~1 px/frame = ~60 px/s ≈ 3.75 tiles/s)
      // Spec says "~2 tiles/second" so we throttle to 1 px per 2 frames
      if (animTimer % 2 === 0) {
        if (ralphX !== targetX) {
          ralphX += (ralphX < targetX) ? 1 : -1;
        } else if (ralphY !== targetY) {
          ralphY += (ralphY < targetY) ? 1 : -1;
        }
      }
      // Walk animation: cycle every 8 game frames (~8fps at 60fps)
      animFrame = Math.floor(animTimer / 8) % 4;
    } else {
      // Location-specific idle animation
      switch (currentState) {
        case 'planning': animFrame = Math.floor(animTimer / 30) % 2; break;
        case 'building': animFrame = Math.floor(animTimer / 15) % 2; break;
        case 'sleeping': animFrame = Math.floor(animTimer / 60) % 2; break;
        case 'complete': animFrame = Math.floor(animTimer / 8)  % 4; break;
        case 'error':    animFrame = Math.floor(animTimer / 30) % 2; break;
        default:         animFrame = Math.floor(animTimer / 60) % 2; break; // idle blink
      }
    }

    renderFrame(ctx, currentState, ralphX, ralphY, animFrame);
  }

  // -------------------------------------------------------------------------
  // Exports
  // -------------------------------------------------------------------------

  exports.TILE_SIZE         = TILE_SIZE;
  exports.CANVAS_W          = CANVAS_W;
  exports.CANVAS_H          = CANVAS_H;
  exports.locationMap       = locationMap;
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
  exports.gameLoop          = gameLoop;

})(typeof module !== 'undefined' ? module.exports : (window.Game = {}));
