const config = require('./config');
const axios = require('axios');
const fs = require('fs-extra');

const imageCommands = require('./commands/imageCommands');
const utilCommands = require('./commands/utilCommands');
const botCommands = require('./commands/botCommands');

// Stats tracking
const stats = { messages: {}, media: {} };

function trackStat(type, senderNum) {
  const today = new Date().toDateString();
  if (!stats.messages[today]) stats.messages[today] = {};
  if (!stats.messages[today][senderNum]) stats.messages[today][senderNum] = 0;
  stats.messages[today][senderNum]++;
  if (type !== 'text') {
    if (!stats.media[today]) stats.media[today] = {};
    if (!stats.media[today][type]) stats.media[today][type] = 0;
    stats.media[today][type]++;
  }
  try { fs.writeJsonSync('./auth_info/stats.json', stats); } catch (e) {}
}

async function handleMessage(sock, m) {
  try {
    const msg = m.messages[0];
    if (!msg || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const isGroup = sender.endsWith('@g.us');
    const pushName = msg.pushName || 'User';
    const senderJid = msg.key.participant || sender;
    const senderNum = senderJid.split('@')[0];

    const body = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption ||
      msg.message?.buttonsResponseMessage?.selectedButtonId || '';

    // Detect media type
    const msgType = Object.keys(msg.message || {})[0];
    trackStat(msgType || 'text', senderNum);

    const prefix = config.prefix;
    const isCommand = body.startsWith(prefix);
    const command = isCommand ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
    const args = isCommand ? body.trim().split(/\s+/).slice(1) : [];

    if (config.autoSeen) await sock.readMessages([msg.key]);
    if (config.autoTyping && isCommand) {
      await sock.sendPresenceUpdate('composing', sender);
      await new Promise(r => setTimeout(r, 800));
    }

    // ── STATS COMMAND ──────────────────────────────────────
    if (isCommand && command === 'stats') {
      const today = new Date().toDateString();
      const todayMsgs = stats.messages[today] || {};
      const totalUsers = Object.keys(todayMsgs).length;
      const totalMsgs = Object.values(todayMsgs).reduce((a, b) => a + b, 0);
      const todayMedia = stats.media[today] || {};
      const mediaList = Object.entries(todayMedia).map(([k, v]) => `• ${k}: ${v}`).join('\n') || '• None';
      await sock.sendMessage(sender, {
        text: `📊 *Bot Stats - Today*\n\n👥 *Users:* ${totalUsers}\n💬 *Messages:* ${totalMsgs}\n\n📁 *Media Sent:*\n${mediaList}\n\n${config.watermark}`
      });
      return;
    }

    // ── ANTI-CALL ──────────────────────────────────────────
    // (handled in index.js call.update event)

    // ── ONE VIEW REVEAL ───────────────────────────────────
    if (config.oneViewReveal && msg.message?.viewOnceMessage) {
      const inner = msg.message.viewOnceMessage.message;
      const type = inner?.imageMessage ? 'image' : inner?.videoMessage ? 'video' : null;
      if (type) {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const mediaMsg = inner.imageMessage || inner.videoMessage;
        const stream = await downloadContentFromMessage(mediaMsg, type);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        await sock.sendMessage(sender, {
          [type]: buffer,
          caption: `👁️ *One View Revealed!*\n\n${config.watermark}`
        });
      }
      if (!isCommand) return;
    }

    // ── GREETING AUTO REPLY ───────────────────────────────
    if (!isCommand && config.greetingAutoReply) {
      const lower = body.toLowerCase().trim();

      if (lower.startsWith('save:')) {
        const parts = body.split(':');
        if (parts.length >= 4) {
          await fs.ensureDir('./auth_info/users');
          await fs.writeJson(`./auth_info/users/${senderNum}.json`, { name: parts[1], city: parts[2], age: parts[3] });
          await sock.sendMessage(sender, {
            text: `✅ *Saved!*\n👤 ${parts[1]} | 📍 ${parts[2]} | 🎂 ${parts[3]}\n\n${config.watermark}`
          });
          return;
        }
      }

      if (config.greetingKeywords.some(k => lower === k || lower.startsWith(k + ' '))) {
        let userData = null;
        try { userData = await fs.readJson(`./auth_info/users/${senderNum}.json`); } catch (e) {}
        if (!userData) {
          await sock.sendMessage(sender, {
            text: `👋 *හෙලෝ ${pushName}!*\n\n🤖 *${config.botName}* ට සාදරයෙන් පිළිගනිමු!\n\nSave: \`save:Name:City:Age\`\n\n${config.watermark}`
          });
        } else {
          await sock.sendMessage(sender, {
            text: `👋 *හෙලෝ ${userData.name}!*\n📍 ${userData.city} | 🎂 ${userData.age}\n\n💡 \`${prefix}menu\` commands\n\n${config.watermark}`
          });
        }
        return;
      }
    }

    // ── AI AUTO REPLY ─────────────────────────────────────
    if (!isCommand && config.aiMode && body.length > 2) {
      try {
        await sock.sendPresenceUpdate('composing', sender);
        const res = await axios.get(
          `${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(body)}`,
          { timeout: 25000 }
        );
        const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text;
        if (reply) await sock.sendMessage(sender, { text: `🤖 ${reply}\n\n${config.watermark}` });
      } catch (e) {}
      return;
    }

    if (!isCommand) return;

    // ── ROUTE COMMANDS ────────────────────────────────────
    const handled =
      await imageCommands.handle(sock, msg, sender, command, args, body) ||
      await utilCommands.handle(sock, msg, sender, command, args, body) ||
      await botCommands.handle(sock, msg, sender, command, args, body);

    if (!handled) {
      await sock.sendMessage(sender, {
        text: `❓ \`${prefix}${command}\` command නෑ.\n\n💡 \`${prefix}menu\` commands list\n\n${config.watermark}`
      });
    }

  } catch (e) {
    console.log('[MSG ERROR]', e.message);
  }
}

module.exports = { handleMessage };
