// ─────────────────────────────────────────────
//  server.js  —  App entry point
//  Wires everything together and starts
//  listening for requests.
// ─────────────────────────────────────────────

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const config  = require('./config');  // also validates env vars on startup

const app = express();

// ── Middleware ────────────────────────────────
app.use(cors());
app.use(express.json());                            // parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // serve the frontend files

// ── API Routes ────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));    // register + login
app.use('/api/files', require('./routes/files'));   // upload, list, download, delete

// Health check — used by load balancers and monitoring tools
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ── Frontend pages ────────────────────────────
// Serve the dashboard for the /dashboard URL
app.get('/dashboard', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'))
);

// Anything else goes to the login/register page
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// ── Start ─────────────────────────────────────
app.listen(config.port, () => {
  console.log(`\n🗄  Vault running → http://localhost:${config.port}\n`);
});
