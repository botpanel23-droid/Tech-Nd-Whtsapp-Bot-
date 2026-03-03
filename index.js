// ═══════════════════════════════════════
//  WA-BOT - Single Entry Point
//  Panel + Bot in one process
// ═══════════════════════════════════════
const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const cron = require('node-cron');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} = require('@whiskeysockets/baileys');

const config = require('./src/config');
const { handleMessage } = require('./src/messageHandler');
const { handleStatusUpdate } = require('./src/statusHandler');

// ─── Paths ───────────────────────────────────────────────
const AUTH_DIR = path.join(__dirname, 'auth_info');
fs.ensureDirSync(AUTH_DIR);

const logger = pino({ level: 'silent' });

// ─── Express ─────────────────────────────────────────────
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'panel/public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'wabot-2024',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000 }
}));

// ─── Bot State ───────────────────────────────────────────
let sock = null;
let isConnected = false;

function writeStatus(data) {
  try {
    fs.writeJsonSync(path.join(AUTH_DIR, 'pairing_status.json'), data);
    io.emit('statusUpdate', data);
  } catch (e) {}
}

// ═══════════════════════════════════════
//  BOT ENGINE
// ═══════════════════════════════════════
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) {
      try { sock.end(); sock.ws?.close(); } catch (e) {}
    }

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      browser: ['WA-BOT', 'Chrome', '3.0'],
      markOnlineOnConnect: config.alwaysOnline,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, pairingCode } = update;

      if (pairingCode) {
        console.log('[PAIR CODE]', pairingCode);
        writeStatus({ status: 'pending', pairingCode });
      }

      if (connection === 'close') {
        isConnected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        writeStatus({ status: 'disconnected' });
        console.log('[BOT] Closed. Code:', code);
        if (code !== DisconnectReason.loggedOut) {
          setTimeout(() => startBot(), 5000);
        }
      }

      if (connection === 'open') {
        isConnected = true;
        const botJid = sock.user.id;
        const botNum = botJid.split(':')[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
        writeStatus({ status: 'connected', number: botNum });

        console.log(`[BOT] Connected! ${botNum} | OTP: ${otp}`);

        try {
          await sock.sendMessage(botJid, {
            text: `┏━━━━━━━━━━━━━━━━━━━━┓\n┃   🤖 *BOT CONNECTED!* 🤖   ┃\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n✅ *සාර්ථකව සම්බන්ධ විය!*\n\n📱 *Number:* ${botNum}\n🔐 *OTP:* \`${otp}\`\n\n🌐 *Panel:* ${config.panelUrl}\n\n_Panel login: Number + OTP_\n\n💫 *WA-BOT*`
          });
        } catch (e) {}

        // Auto update
        if (config.githubRepo) {
          cron.schedule('*/30 * * * *', async () => {
            try {
              const git = require('simple-git')(__dirname);
              await git.fetch();
              const st = await git.status();
              if (st.behind > 0) {
                await git.pull();
                await sock.sendMessage(botJid, { text: '🔄 Auto Updated! Restarting...' });
                setTimeout(() => process.exit(0), 2000);
              }
            } catch (e) {}
          });
        }
      }
    });

    // Messages
    sock.ev.on('messages.upsert', async (m) => {
      if (!isConnected) return;
      for (const msg of m.messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          await handleStatusUpdate(sock, msg);
        } else {
          await handleMessage(sock, m);
          break;
        }
      }
    });

  } catch (e) {
    console.error('[BOT ERROR]', e.message);
    setTimeout(() => startBot(), 5000);
  }
}

// ═══════════════════════════════════════
//  PAIR CODE API
// ═══════════════════════════════════════
app.post('/api/pair', async (req, res) => {
  const { number } = req.body;
  if (!number) return res.json({ success: false, message: 'Number required' });

  const cleanNumber = number.replace(/[^0-9]/g, '');

  try {
    // Stop current connection
    if (sock) {
      try { sock.end(); sock.ws?.close(); } catch (e) {}
      sock = null;
      isConnected = false;
    }

    // Clear old auth
    await fs.remove(AUTH_DIR);
    await fs.ensureDir(AUTH_DIR);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      browser: ['WA-BOT', 'Chrome', '3.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    // Wait then request pair code
    await new Promise(r => setTimeout(r, 2000));

    if (!sock.authState.creds.registered) {
      const code = await sock.requestPairingCode(cleanNumber);
      const formatted = code?.match(/.{1,4}/g)?.join('-') || code;

      writeStatus({ status: 'pending', pairingCode: formatted, number: cleanNumber });
      io.emit('pairingCode', { code: formatted });

      res.json({ success: true, code: formatted });

      // Handle connection after pair
      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === 'open') {
          isConnected = true;
          const botJid = sock.user.id;
          const botNum = botJid.split(':')[0];
          const otp = Math.floor(100000 + Math.random() * 900000).toString();

          fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
          writeStatus({ status: 'connected', number: botNum });
          io.emit('botConnected', { number: botNum });

          console.log(`[BOT] Paired! ${botNum} | OTP: ${otp}`);

          try {
            await sock.sendMessage(botJid, {
              text: `┏━━━━━━━━━━━━━━━━━━━━┓\n┃   🤖 *BOT CONNECTED!* 🤖   ┃\n┗━━━━━━━━━━━━━━━━━━━━┛\n\n✅ *සාර්ථකව සම්බන්ධ විය!*\n\n📱 *Number:* ${botNum}\n🔐 *OTP:* \`${otp}\`\n\n🌐 *Panel:* ${config.panelUrl}\n\n_Panel login: Number + OTP_\n\n💫 *WA-BOT*`
            });
          } catch (e) {}

          // Load message handlers
          sock.ev.on('messages.upsert', async (m) => {
            if (!isConnected) return;
            for (const msg of m.messages) {
              if (msg.key.remoteJid === 'status@broadcast') {
                await handleStatusUpdate(sock, msg);
              } else {
                await handleMessage(sock, m);
                break;
              }
            }
          });

        } else if (connection === 'close') {
          isConnected = false;
          const code = lastDisconnect?.error?.output?.statusCode;
          writeStatus({ status: 'disconnected' });
          if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
        }
      });

    } else {
      res.json({ success: false, message: 'Already registered! Restart.' });
    }

  } catch (e) {
    console.error('[PAIR ERROR]', e.message);
    if (!res.headersSent) res.json({ success: false, message: e.message });
  }
});

// ═══════════════════════════════════════
//  PANEL ROUTES
// ═══════════════════════════════════════
const requireAuth = (req, res, next) => req.session.authenticated ? next() : res.redirect('/login');

app.get('/', requireAuth, (req, res) => res.sendFile(path.join(__dirname, 'panel/public/index.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'panel/public/login.html')));
app.get('/connect', (req, res) => res.sendFile(path.join(__dirname, 'panel/public/connect.html')));

app.post('/api/login', (req, res) => {
  const { number, otp } = req.body;
  try {
    const otpData = fs.readJsonSync(path.join(AUTH_DIR, 'otp.json'));
    const status = fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json'));
    const botNum = status.number?.replace(/[^0-9]/g, '');
    const inputNum = number?.replace(/[^0-9]/g, '');
    const otpOk = otpData.otp === otp && (Date.now() - otpData.time) < 600000;
    const numOk = botNum && inputNum && (botNum.includes(inputNum) || inputNum.includes(botNum));

    if (otpOk && numOk) {
      req.session.authenticated = true;
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Invalid number or OTP!' });
    }
  } catch (e) {
    res.json({ success: false, message: '/connect වලින් bot connect කරන්න!' });
  }
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.get('/api/status', (req, res) => {
  try {
    const status = fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json'));
    res.json({ ...status, connected: isConnected });
  } catch (e) {
    res.json({ status: 'disconnected', connected: false });
  }
});

app.get('/api/config', requireAuth, (req, res) => {
  try {
    delete require.cache[require.resolve('./src/config')];
    res.json({ success: true, config: require('./src/config') });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/config', requireAuth, (req, res) => {
  try {
    const updates = req.body;
    const cfgPath = path.join(__dirname, 'src/config.js');
    let content = fs.readFileSync(cfgPath, 'utf8');

    ['alwaysOnline','autoTyping','autoSeen','autoStatusSeen','autoStatusLike',
     'autoStatusSave','autoStatusReply','greetingAutoReply','aiMode'].forEach(key => {
      if (updates[key] !== undefined) {
        const val = updates[key] === 'true' || updates[key] === true;
        content = content.replace(new RegExp(`(${key}:\\s*)(true|false)`), `$1${val}`);
        config[key] = val; // live update
      }
    });

    ['autoStatusLikeEmoji','autoStatusReplyMessage','botName','panelUrl','githubRepo','prefix'].forEach(key => {
      if (updates[key] !== undefined) {
        content = content.replace(new RegExp(`(${key}:\\s*')[^']*(')`), `$1${updates[key]}$2`);
        config[key] = updates[key]; // live update
      }
    });

    fs.writeFileSync(cfgPath, content);
    res.json({ success: true });
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/update', requireAuth, async (req, res) => {
  try {
    const git = require('simple-git')(__dirname);
    await git.fetch();
    const status = await git.status();
    if (status.behind > 0) {
      await git.pull();
      res.json({ success: true, message: `${status.behind} commits pulled! Restarting...` });
      setTimeout(() => process.exit(0), 2000);
    } else {
      res.json({ success: true, message: 'Already up to date!' });
    }
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── Socket.io ────────────────────────────────────────────
io.on('connection', (socket) => {
  try {
    const status = fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json'));
    socket.emit('statusUpdate', { ...status, connected: isConnected });
  } catch (e) {
    socket.emit('statusUpdate', { status: 'disconnected', connected: false });
  }
});

// ═══════════════════════════════════════
//  START SERVER
// ═══════════════════════════════════════
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🌐 Panel: http://0.0.0.0:${PORT}`);
  console.log(`📱 Connect: http://0.0.0.0:${PORT}/connect\n`);

  // Auto-start if session exists
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('[BOT] Existing session found, starting...');
    startBot();
  } else {
    console.log('[BOT] No session. Go to /connect');
  }
});
