const express = require('express');
const session = require('express-session');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const cron = require('node-cron');
const QRCode = require('qrcode');
const axios = require('axios');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  getContentType,
  downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const config = require('./src/config');
const { handleMessage } = require('./src/messageHandler');
const { handleStatusUpdate } = require('./src/statusHandler');

const AUTH_DIR = path.join(__dirname, 'auth_info');
fs.ensureDirSync(AUTH_DIR);

const logger = pino({ level: 'silent' });

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

let sock = null;
let isConnected = false;

// Anti-delete store
const deletedMsgs = new Map();

function writeStatus(data) {
  try {
    fs.writeJsonSync(path.join(AUTH_DIR, 'pairing_status.json'), data);
    io.emit('statusUpdate', data);
  } catch (e) {}
}

// ═══ BOT ENGINE ══════════════════════════════════════════
async function startBot() {
  try {
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} }

    sock = makeWASocket({
      version, logger,
      printQRInTerminal: false,
      auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
      browser: ['CHALAH-MD', 'Chrome', '3.0'],
      markOnlineOnConnect: config.alwaysOnline,
      syncFullHistory: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, pairingCode } = update;
      if (pairingCode) writeStatus({ status: 'pending', pairingCode });

      if (connection === 'close') {
        isConnected = false;
        const code = lastDisconnect?.error?.output?.statusCode;
        writeStatus({ status: 'disconnected' });
        if (code !== DisconnectReason.loggedOut) setTimeout(() => startBot(), 5000);
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
            image: { url: config.connectImage },
            caption: `╔══════════════════════╗\n║  💎 *CHALAH MD CONNECTED* 💎  ║\n╚══════════════════════╝\n\n✅ *Bot සාර්ථකව සම්බන්ධ විය!*\n\n📱 *Number:* ${botNum}\n🔐 *OTP:* \`${otp}\`\n\n🌐 *Panel:* ${config.panelUrl}\n\n_Panel login: Number + OTP use කරන්න_\n\n> 💎 *CHALAH MD* | ${config.panelUrl}`
          });
        } catch (e) {
          // Fallback without image
          try {
            await sock.sendMessage(botJid, {
              text: `╔══════════════════════╗\n║  💎 *CHALAH MD CONNECTED* 💎  ║\n╚══════════════════════╝\n\n✅ *Bot සාර්ථකව සම්බන්ධ විය!*\n\n📱 *Number:* ${botNum}\n🔐 *OTP:* \`${otp}\`\n\n🌐 *Panel:* ${config.panelUrl}\n\n> 💎 *CHALAH MD* | ${config.panelUrl}`
            });
          } catch (e2) {}
        }

        // Auto update cron
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

      // Store messages for anti-delete
      if (config.antiDelete) {
        for (const msg of m.messages) {
          if (!msg.key.fromMe) {
            deletedMsgs.set(msg.key.id, msg);
            setTimeout(() => deletedMsgs.delete(msg.key.id), 5 * 60 * 1000);
          }
        }
      }

      for (const msg of m.messages) {
        if (msg.key.remoteJid === 'status@broadcast') {
          await handleStatusUpdate(sock, msg);
        } else {
          await handleMessage(sock, m);
          break;
        }
      }
    });

    // Anti-delete
    sock.ev.on('messages.delete', async (item) => {
      if (!config.antiDelete) return;
      const keys = item.keys || [];
      for (const key of keys) {
        const stored = deletedMsgs.get(key.id);
        if (!stored) continue;
        const sender = key.remoteJid;
        const deleterNum = key.participant || sender;
        const msgType = getContentType(stored.message);

        try {
          if (msgType === 'conversation' || msgType === 'extendedTextMessage') {
            const text = stored.message?.conversation || stored.message?.extendedTextMessage?.text;
            await sock.sendMessage(sender, {
              text: `🗑️ *Anti-Delete Alert!*\n\n👤 *From:* @${deleterNum.split('@')[0]}\n📝 *Message:* ${text}\n\n${config.watermark}`,
              mentions: [deleterNum]
            });
          } else if (msgType === 'imageMessage') {
            const stream = await downloadContentFromMessage(stored.message.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(sender, {
              image: buffer,
              caption: `🗑️ *Anti-Delete Alert!*\n👤 From: @${deleterNum.split('@')[0]}\n\n${config.watermark}`,
              mentions: [deleterNum]
            });
          } else if (msgType === 'videoMessage') {
            const stream = await downloadContentFromMessage(stored.message.videoMessage, 'video');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
            await sock.sendMessage(sender, {
              video: buffer,
              caption: `🗑️ *Anti-Delete Alert!*\n👤 From: @${deleterNum.split('@')[0]}\n\n${config.watermark}`,
              mentions: [deleterNum]
            });
          }
        } catch (e) {}
        deletedMsgs.delete(key.id);
      }
    });

    // Anti-call
    sock.ev.on('call', async (calls) => {
      if (!config.antiCall) return;
      for (const call of calls) {
        if (call.status === 'offer') {
          await sock.rejectCall(call.id, call.from);
          await sock.sendMessage(call.from, {
            text: `🚫 *Call Rejected!*\n\nකරුණාකර call නොකරන්න!\nBot busy ඉන්නෙ.\n\n_මෙම පනිවිඩය AI මගින් නිර්මාණය වූයකි_\n\n${config.watermark}`
          });
        }
      }
    });

  } catch (e) {
    console.error('[BOT ERROR]', e.message);
    setTimeout(() => startBot(), 5000);
  }
}

// ═══ QR API ══════════════════════════════════════════════
async function startQRSession() {
  if (sock) { try { sock.end(); sock.ws?.close(); } catch (e) {} sock = null; isConnected = false; }
  await fs.remove(AUTH_DIR);
  await fs.ensureDir(AUTH_DIR);

  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version, logger,
    printQRInTerminal: false,
    auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, logger) },
    browser: ['CHALAH-MD', 'Chrome', '3.0'],
    markOnlineOnConnect: config.alwaysOnline,
  });

  sock.ev.on('creds.update', saveCreds);

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('QR timeout')), 30000);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        clearTimeout(timeout);
        try {
          const qrDataUrl = await QRCode.toDataURL(qr, { width: 300, margin: 2 });
          io.emit('qrCode', { qr: qrDataUrl });
          resolve(qrDataUrl);
        } catch (e) { reject(e); }
      }

      if (connection === 'open') {
        isConnected = true;
        const botJid = sock.user.id;
        const botNum = botJid.split(':')[0];
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        fs.writeJsonSync(path.join(AUTH_DIR, 'otp.json'), { otp, number: botNum, time: Date.now() });
        writeStatus({ status: 'connected', number: botNum });
        io.emit('botConnected', { number: botNum });

        try {
          await sock.sendMessage(botJid, {
            image: { url: config.connectImage },
            caption: `╔══════════════════════╗\n║  💎 *CHALAH MD CONNECTED* 💎  ║\n╚══════════════════════╝\n\n✅ *Bot සාර්ථකව සම්බන්ධ විය!*\n\n📱 *Number:* ${botNum}\n🔐 *OTP:* \`${otp}\`\n\n🌐 *Panel:* ${config.panelUrl}\n\n> 💎 *CHALAH MD*`
          });
        } catch (e) {
          try {
            await sock.sendMessage(botJid, {
              text: `💎 *CHALAH MD CONNECTED!*\n\n📱 ${botNum}\n🔐 OTP: \`${otp}\`\n🌐 ${config.panelUrl}`
            });
          } catch (e2) {}
        }

        // Load handlers
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

        sock.ev.on('call', async (calls) => {
          if (!config.antiCall) return;
          for (const call of calls) {
            if (call.status === 'offer') {
              await sock.rejectCall(call.id, call.from);
              await sock.sendMessage(call.from, {
                text: `🚫 Call rejected!\n_මෙම පනිවිඩය AI මගින් නිර්මාණය වූයකි_\n\n${config.watermark}`
              });
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
  });
}

app.post('/api/qr', async (req, res) => {
  try {
    const qrDataUrl = await startQRSession();
    res.json({ success: true, qr: qrDataUrl });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// ═══ CHANNEL REACT API ═══════════════════════════════════
app.post('/api/channel-react', async (req, res) => {
  const { channelLink, emoji, count } = req.body;
  if (!channelLink || !emoji) return res.json({ success: false, message: 'Channel link and emoji required' });
  if (!isConnected || !sock) return res.json({ success: false, message: 'Bot not connected!' });

  try {
    // Extract channel JID from link
    const code = channelLink.replace('https://whatsapp.com/channel/', '').replace('https://www.whatsapp.com/channel/', '').trim();
    const channelJid = `${code}@newsletter`;
    const reactCount = Math.min(parseInt(count) || 10, 50);

    let sent = 0;
    // Get recent messages from channel and react
    try {
      const msgs = await sock.fetchMessagesFromWABox(channelJid, { count: 5 });
      for (const msg of (msgs || []).slice(0, 3)) {
        for (let i = 0; i < Math.floor(reactCount / 3); i++) {
          await sock.sendMessage(channelJid, {
            react: { text: emoji, key: msg.key }
          });
          await new Promise(r => setTimeout(r, 500));
          sent++;
        }
      }
    } catch (e) {}

    res.json({ success: true, message: `✅ ${sent} reacts sent!`, sent });
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
});

// ═══ PANEL ROUTES ════════════════════════════════════════
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
    if (otpOk && numOk) { req.session.authenticated = true; res.json({ success: true }); }
    else res.json({ success: false, message: 'Invalid number or OTP!' });
  } catch (e) {
    res.json({ success: false, message: '/connect page එකෙන් bot connect කරන්න!' });
  }
});

app.get('/api/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

app.get('/api/status', (req, res) => {
  try {
    const status = fs.readJsonSync(path.join(AUTH_DIR, 'pairing_status.json'));
    res.json({ ...status, connected: isConnected });
  } catch (e) { res.json({ status: 'disconnected', connected: false }); }
});

app.get('/api/stats', requireAuth, (req, res) => {
  try {
    const stats = fs.readJsonSync(path.join(AUTH_DIR, 'stats.json'));
    const today = new Date().toDateString();
    const todayMsgs = stats.messages?.[today] || {};
    const totalUsers = Object.keys(todayMsgs).length;
    const totalMsgs = Object.values(todayMsgs).reduce((a, b) => a + b, 0);
    const media = stats.media?.[today] || {};
    res.json({ success: true, totalUsers, totalMsgs, media, today });
  } catch (e) { res.json({ success: true, totalUsers: 0, totalMsgs: 0, media: {}, today: new Date().toDateString() }); }
});

app.get('/api/config', requireAuth, (req, res) => {
  try {
    delete require.cache[require.resolve('./src/config')];
    res.json({ success: true, config: require('./src/config') });
  } catch (e) { res.json({ success: false, error: e.message }); }
});

app.post('/api/config', requireAuth, (req, res) => {
  try {
    const updates = req.body;
    const cfgPath = path.join(__dirname, 'src/config.js');
    let content = fs.readFileSync(cfgPath, 'utf8');

    ['alwaysOnline','autoTyping','autoSeen','autoStatusSeen','autoStatusLike',
     'autoStatusSave','autoStatusReply','greetingAutoReply','aiMode','antiCall','antiDelete','oneViewReveal'].forEach(key => {
      if (updates[key] !== undefined) {
        const val = updates[key] === 'true' || updates[key] === true;
        content = content.replace(new RegExp(`(${key}:\\s*)(true|false)`), `$1${val}`);
        config[key] = val;
      }
    });

    ['autoStatusLikeEmoji','autoStatusReplyMessage','botName','panelUrl','githubRepo',
     'prefix','menuImage','connectImage','ownerNumber','ownerName'].forEach(key => {
      if (updates[key] !== undefined) {
        content = content.replace(new RegExp(`(${key}:\\s*')[^']*(')`), `$1${updates[key]}$2`);
        config[key] = updates[key];
      }
    });

    fs.writeFileSync(cfgPath, content);
    res.json({ success: true });
  } catch (e) { res.json({ success: false, error: e.message }); }
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
  } catch (e) { res.json({ success: false, error: e.message }); }
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

// ═══ START ═══════════════════════════════════════════════
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n💎 CHALAH MD Panel: http://0.0.0.0:${PORT}`);
  console.log(`📱 Connect: http://0.0.0.0:${PORT}/connect\n`);
  if (fs.existsSync(path.join(AUTH_DIR, 'creds.json'))) {
    console.log('[BOT] Session found, starting...');
    startBot();
  } else {
    console.log('[BOT] No session. Go to /connect');
  }
});
