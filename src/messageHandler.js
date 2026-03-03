const config = require('./config');
const axios = require('axios');
const fs = require('fs-extra');

const imageCommands = require('./commands/imageCommands');
const utilCommands = require('./commands/utilCommands');
const botCommands = require('./commands/botCommands');

async function handleMessage(sock, m) {
  try {
    const msg = m.messages[0];
    if (!msg || msg.key.fromMe) return;

    const sender = msg.key.remoteJid;
    const pushName = msg.pushName || 'User';
    const senderNumber = msg.key.participant?.split('@')[0] || sender.split('@')[0];

    const body = msg.message?.conversation ||
      msg.message?.extendedTextMessage?.text ||
      msg.message?.imageMessage?.caption ||
      msg.message?.videoMessage?.caption || '';

    const prefix = config.prefix;
    const isCommand = body.startsWith(prefix);
    const command = isCommand ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : '';
    const args = isCommand ? body.trim().split(/\s+/).slice(1) : [];

    if (config.autoSeen) {
      await sock.readMessages([msg.key]);
    }

    if (config.autoTyping && isCommand) {
      await sock.sendPresenceUpdate('composing', sender);
      await new Promise(r => setTimeout(r, 1000));
    }

    // ── Greeting auto reply ──────────────────────────────
    if (!isCommand && config.greetingAutoReply) {
      const lower = body.toLowerCase().trim();

      // Save user data
      if (lower.startsWith('save:')) {
        const parts = body.split(':');
        if (parts.length >= 4) {
          await fs.ensureDir('./auth_info/users');
          await fs.writeJson(`./auth_info/users/${senderNumber}.json`, { name: parts[1], city: parts[2], age: parts[3] });
          await sock.sendMessage(sender, {
            text: `✅ *Saved!*\n👤 Name: ${parts[1]}\n📍 City: ${parts[2]}\n🎂 Age: ${parts[3]}\n\nදැන් \`${prefix}menu\` ගහලා commands බලන්න!`
          });
          return;
        }
      }

      if (config.greetingKeywords.some(k => lower === k || lower.startsWith(k + ' '))) {
        let userData = null;
        try { userData = await fs.readJson(`./auth_info/users/${senderNumber}.json`); } catch (e) {}

        if (!userData) {
          await sock.sendMessage(sender, {
            text: `👋 *හෙලෝ ${pushName}!*\n\nමම *${config.botName}* 🤖\n\nඔබව save කරගන්නද?\n\nFormat: \`save:Name:City:Age\`\nExample: \`save:Kamal:Colombo:22\``
          });
        } else {
          await sock.sendMessage(sender, {
            text: `👋 *හෙලෝ ${userData.name}!*\n📍 ${userData.city} | 🎂 ${userData.age}\n\n💡 \`${prefix}menu\` ගහලා commands බලන්න!`
          });
        }
        return;
      }
    }

    // ── AI Auto Reply ────────────────────────────────────
    if (!isCommand && config.aiMode && body.length > 2) {
      try {
        await sock.sendPresenceUpdate('composing', sender);
        const res = await axios.get(
          `${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(body)}`,
          { timeout: 25000 }
        );
        const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text || res.data?.message;
        if (reply) {
          await sock.sendMessage(sender, { text: `🤖 ${reply}` });
        }
      } catch (e) {}
      return;
    }

    if (!isCommand) return;

    // ── Route commands ───────────────────────────────────
    const handled =
      await imageCommands.handle(sock, msg, sender, command, args, body) ||
      await utilCommands.handle(sock, msg, sender, command, args, body) ||
      await botCommands.handle(sock, msg, sender, command, args, body);

    if (!handled) {
      await sock.sendMessage(sender, {
        text: `❓ \`${prefix}${command}\` command නෑ.\n\n💡 \`${prefix}menu\` ගහලා commands බලන්න!`
      });
    }

  } catch (e) {
    console.log('[MSG ERROR]', e.message);
  }
}

module.exports = { handleMessage };
