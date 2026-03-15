'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { WebSocketServer } = require('ws');

// ---------------------------------------------------------------------------
// Log-line parser — pure function, exported for testing
// ---------------------------------------------------------------------------

const LOG_RULES = [
  ['Ralph Loop Started',          'starting'],
  ['Ralph entering Planning Mode','planning'],
  ['Ralph entering Build Mode',   'building'],
  ['Sleeping for',                'sleeping'],
  ['Project marked as COMPLETE',  'complete'],
  ['ERROR:',                      'error'],
  ['Loop appears stuck',          'error'],
];

function parseLogLine(line) {
  for (const [pattern, state] of LOG_RULES) {
    if (line.includes(pattern)) return state;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Plan file parser — extracts tasks from IMPLEMENTATION_PLAN.md
// ---------------------------------------------------------------------------

function parseTasks(content) {
  const tasks = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^###\s+Task\s+\d+\s*[—–\-]\s*(.+)$/);
    if (match) {
      let desc = match[1].trim();
      let status = 'pending';
      if (/\bDONE\b/i.test(desc) || /✅/.test(desc)) {
        status = 'done';
        desc = desc.replace(/\s*[\[(]?\s*(✅\s*)?DONE\s*[\])]?\s*$/i, '').trim();
      } else if (/IN[\s_]*PROGRESS/i.test(desc) || /🔄/.test(desc)) {
        status = 'in_progress';
        desc = desc.replace(/\s*[\[(]?\s*(🔄\s*)?IN[\s_]*PROGRESS\s*[\])]?\s*$/i, '').trim();
      }
      // Extract acceptance criteria lines following this task heading
      const criteria = [];
      let inCriteria = false;
      for (let j = i + 1; j < lines.length; j++) {
        if (/^###/.test(lines[j]) || /^---/.test(lines[j])) break;
        if (/acceptance\s*criteria/i.test(lines[j])) { inCriteria = true; continue; }
        if (inCriteria && /^\s*-\s+/.test(lines[j])) {
          criteria.push(lines[j].replace(/^\s*-\s+/, '').trim());
        }
        // Stop collecting criteria if we hit another section header
        if (inCriteria && /^\*\*\w/.test(lines[j]) && !/acceptance/i.test(lines[j])) {
          inCriteria = false;
        }
      }
      tasks.push({ desc, status, criteria });
    }
  }
  return tasks;
}

// ---------------------------------------------------------------------------
// Server factory — exported for testing (port 0 → OS-assigned)
// ---------------------------------------------------------------------------

function startServer(port) {
  port = port != null ? port : (parseInt(process.env.PORT, 10) || 8080);

  // Current state object
  let appState = {
    state: 'idle',
    lastLog: '',
    timestamp: new Date().toISOString(),
    containerRunning: false,
    tasks: [],
  };

  // ---- HTTP server -------------------------------------------------------

  const server = http.createServer((req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/') {
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, (err, data) => {
          if (err) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data);
        });
      } else if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, state: appState.state }));
      } else if (req.method === 'GET' && req.url === '/game.js') {
        const jsPath = path.join(__dirname, 'game.js');
        fs.readFile(jsPath, (err, data) => {
          if (err) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'application/javascript' });
          res.end(data);
        });
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    } catch (err) {
      console.error('HTTP handler error:', err);
    }
  });

  // ---- WebSocket server --------------------------------------------------

  const wss = new WebSocketServer({ server });

  function broadcast(data) {
    const msg = JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(msg);
      }
    }
  }

  function setState(updates) {
    const changed = Object.keys(updates).some(k => {
      if (k === 'tasks') return JSON.stringify(appState.tasks) !== JSON.stringify(updates.tasks);
      return appState[k] !== updates[k];
    });
    Object.assign(appState, updates);
    if (changed) broadcast(appState);
  }

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify(appState));
  });

  // Ping all clients every 30 seconds to keep connections alive
  const pingInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.ping();
      }
    }
  }, 30000);

  wss.on('close', () => clearInterval(pingInterval));

  // ---- Log file tailer ----------------------------------------------------

  const logFile = process.env.RALPH_LOG_FILE || '/tmp/ralph.log';
  let tailProc = null;
  let retryTimer = null;

  function tailLog() {
    try {
      tailProc = spawn('tail', ['-n', '0', '-F', logFile], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      setState({ containerRunning: true });

      function handleLine(line) {
        line = line.trim();
        if (!line) return;
        const newState = parseLogLine(line);
        const update = { lastLog: line, timestamp: new Date().toISOString() };
        if (newState) update.state = newState;
        setState(update);
      }

      let buf = '';
      tailProc.stdout.on('data', (chunk) => {
        buf += chunk.toString();
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) handleLine(line);
      });

      tailProc.on('close', (code) => {
        tailProc = null;
        setState({ state: 'idle', containerRunning: false, timestamp: new Date().toISOString() });
        retryTimer = setTimeout(tailLog, 5000);
      });

      tailProc.on('error', (err) => {
        console.error('tail spawn error:', err.message);
        tailProc = null;
        setState({ state: 'idle', containerRunning: false, timestamp: new Date().toISOString() });
        retryTimer = setTimeout(tailLog, 5000);
      });

    } catch (err) {
      console.error('tailLog error:', err.message);
      setState({ state: 'idle', containerRunning: false, timestamp: new Date().toISOString() });
      retryTimer = setTimeout(tailLog, 5000);
    }
  }

  // ---- Plan file watcher --------------------------------------------------

  const planFile = process.env.RALPH_PLAN_FILE || '/app/project/IMPLEMENTATION_PLAN.md';
  let planPollTimer = null;
  let lastPlanContent = '';

  function pollPlan() {
    fs.readFile(planFile, 'utf8', (err, content) => {
      if (err) return; // file may not exist yet
      if (content !== lastPlanContent) {
        lastPlanContent = content;
        const tasks = parseTasks(content);
        setState({ tasks });
      }
    });
  }

  // ---- Start listening ---------------------------------------------------

  server.listen(port, () => {
    const addr = server.address();
    console.log(`Ralph Shop server listening on port ${addr.port}`);
    tailLog();
    pollPlan();
    planPollTimer = setInterval(pollPlan, 5000);
  });

  // Expose internals for testing / clean shutdown
  server._appState = appState;
  server._wss = wss;
  server._stopDocker = () => {
    clearInterval(pingInterval);
    if (planPollTimer) clearInterval(planPollTimer);
    if (retryTimer) clearTimeout(retryTimer);
    if (tailProc) {
      tailProc.removeAllListeners();
      tailProc.stdout && tailProc.stdout.destroy();
      tailProc.kill();
      tailProc = null;
    }
    wss.close();
  };
  server._getState = () => appState;

  return server;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { parseLogLine, parseTasks, startServer };

// ---------------------------------------------------------------------------
// Auto-start
// ---------------------------------------------------------------------------

if (require.main === module) {
  startServer();
}
