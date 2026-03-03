const config = require('../config');
const fs = require('fs-extra');
const axios = require('axios');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function handle(sock, msg, sender, command, args, body) {
  const prefix = config.prefix;
  const isGroup = sender.endsWith('@g.us');
  const senderJid = msg.key.participant || sender;
  const senderNum = senderJid.split('@')[0];

  // ─── MENU ───────────────────────────────────────────────
  if (command === 'menu' || command === 'help' || command === 'start') {
    const menuText = `╔══════════════════════════╗
║   💎 *CHALAH MD BOT* 💎       ║
╚══════════════════════════╝

👋 හෙලෝ *${msg.pushName || 'User'}*!
🤖 Bot Version: *${config.botVersion}*

━━━━━━━━━━━━━━━━━━━━━━━

🎨 *IMAGE COMMANDS*
┣ \`${prefix}edit [prompt]\` - AI Image Edit ✨
┣ \`${prefix}sticker\` - Image → Sticker
┣ \`${prefix}toimg\` - Sticker → Image
┣ \`${prefix}blur\` - Blur Image
┣ \`${prefix}enhance\` - Enhance Image
┗ \`${prefix}resize w h\` - Resize Image

📥 *DOWNLOADER*
┣ \`${prefix}yt [url]\` - YouTube Download
┣ \`${prefix}tt [url]\` - TikTok Download
┣ \`${prefix}fb [url]\` - Facebook Download
┣ \`${prefix}ig [url]\` - Instagram Download
┗ \`${prefix}ttlike [url]\` - TikTok Free Like ❤️

🎮 *TOOLS*
┣ \`${prefix}ff [uid]\` - Free Fire Info
┣ \`${prefix}weather [city]\` - Weather
┣ \`${prefix}translate [lang] [text]\` - Translate
┣ \`${prefix}ai [question]\` - Ask AI 🤖
┗ \`${prefix}joke / quote / fact\`

👥 *GROUP COMMANDS*
┣ \`${prefix}kick @user\` - Kick Member
┣ \`${prefix}add 94xxxxxxx\` - Add Member
┣ \`${prefix}promote @user\` - Make Admin
┣ \`${prefix}demote @user\` - Remove Admin
┣ \`${prefix}tagall\` - Tag All Members
┣ \`${prefix}mute / unmute\` - Mute Group
┣ \`${prefix}groupinfo\` - Group Info
┗ \`${prefix}link\` - Get Invite Link

⚙️ *BOT SETTINGS*
┣ \`${prefix}settings\` - All Settings
┣ \`${prefix}aimode on/off\` - AI Auto Reply
┣ \`${prefix}anticall on/off\` - Anti Call
┣ \`${prefix}antidelete on/off\` - Anti Delete
┗ \`${prefix}autoseen on/off\` - Auto Seen

🔧 *SYSTEM*
┣ \`${prefix}ping\` - Ping Bot
┣ \`${prefix}info\` - Bot Info
┣ \`${prefix}bot [number]\` - Deploy Bot
┗ \`${prefix}update\` - Update Bot

━━━━━━━━━━━━━━━━━━━━━━━
${config.watermark}`;

    try {
      await sock.sendMessage(sender, {
        image: { url: config.menuImage },
        caption: menuText,
        buttons: [
          { buttonId: `${prefix}ping`, buttonText: { displayText: '🏓 Ping' }, type: 1 },
          { buttonId: `${prefix}info`, buttonText: { displayText: '📊 Info' }, type: 1 },
          { buttonId: `${prefix}settings`, buttonText: { displayText: '⚙️ Settings' }, type: 1 },
        ],
        footer: `💎 CHALAH MD v${config.botVersion}`,
      });
    } catch (e) {
      // Fallback without image if URL invalid
      await sock.sendMessage(sender, { text: menuText });
    }
    return true;
  }

  // ─── PING ───────────────────────────────────────────────
  if (command === 'ping') {
    const start = Date.now();
    await sock.sendMessage(sender, {
      text: `🏓 *Pong!*\n⚡ Speed: *${Date.now() - start}ms*\n\n${config.watermark}`
    });
    return true;
  }

  // ─── INFO ───────────────────────────────────────────────
  if (command === 'info') {
    const up = process.uptime();
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
    await sock.sendMessage(sender, {
      text: `╔══════════════════╗\n║   🤖 *BOT INFO*   ║\n╚══════════════════╝\n\n🏷️ *Name:* ${config.botName}\n📌 *Version:* ${config.botVersion}\n⏱️ *Uptime:* ${h}h ${m}m\n👑 *Owner:* ${config.ownerName}\n🌐 *Panel:* ${config.panelUrl}\n\n⚙️ *Features:*\n• 🤖 AI Mode: ${config.aiMode ? '✅' : '❌'}\n• 👁️ Auto Seen: ${config.autoSeen ? '✅' : '❌'}\n• ❤️ Auto Like: ${config.autoStatusLike ? '✅' : '❌'}\n• 🟢 Always Online: ${config.alwaysOnline ? '✅' : '❌'}\n• 🚫 Anti Call: ${config.antiCall ? '✅' : '❌'}\n• 🗑️ Anti Delete: ${config.antiDelete ? '✅' : '❌'}\n\n${config.watermark}`
    });
    return true;
  }

  // ─── SETTINGS ───────────────────────────────────────────
  if (command === 'settings') {
    const settingsText = `╔══════════════════════╗\n║   ⚙️ *BOT SETTINGS*   ║\n╚══════════════════════╝\n\n🤖 *AI Mode:* ${config.aiMode ? '✅ ON' : '❌ OFF'}\n👁️ *Auto Seen:* ${config.autoSeen ? '✅ ON' : '❌ OFF'}\n⌨️ *Auto Typing:* ${config.autoTyping ? '✅ ON' : '❌ OFF'}\n🟢 *Always Online:* ${config.alwaysOnline ? '✅ ON' : '❌ OFF'}\n📸 *Status Seen:* ${config.autoStatusSeen ? '✅ ON' : '❌ OFF'}\n❤️ *Status Like:* ${config.autoStatusLike ? '✅ ON' : '❌ OFF'} ${config.autoStatusLikeEmoji}\n💬 *Status Reply:* ${config.autoStatusReply ? '✅ ON' : '❌ OFF'}\n💾 *Status Save:* ${config.autoStatusSave ? '✅ ON' : '❌ OFF'}\n👋 *Greeting:* ${config.greetingAutoReply ? '✅ ON' : '❌ OFF'}\n🚫 *Anti Call:* ${config.antiCall ? '✅ ON' : '❌ OFF'}\n🗑️ *Anti Delete:* ${config.antiDelete ? '✅ ON' : '❌ OFF'}\n\n_Toggle: \`${prefix}[setting] on/off\`_\n_Example: \`${prefix}aimode on\`_\n\n${config.watermark}`;
    await sock.sendMessage(sender, { text: settingsText });
    return true;
  }

  // ─── SETTINGS TOGGLES ────────────────────────────────────
  const toggleMap = {
    'autoseen': ['autoSeen', 'Auto Seen'],
    'autolike': ['autoStatusLike', 'Auto Status Like'],
    'autoreply': ['autoStatusReply', 'Auto Status Reply'],
    'alwaysonline': ['alwaysOnline', 'Always Online'],
    'autotyping': ['autoTyping', 'Auto Typing'],
    'aimode': ['aiMode', 'AI Auto Reply'],
    'anticall': ['antiCall', 'Anti Call'],
    'antidelete': ['antiDelete', 'Anti Delete'],
    'autostatus': ['autoStatusSeen', 'Auto Status Seen'],
    'autosave': ['autoStatusSave', 'Auto Status Save'],
    'greeting': ['greetingAutoReply', 'Greeting Auto Reply'],
    'oneview': ['oneViewReveal', 'One View Reveal'],
  };

  if (toggleMap[command]) {
    const [key, label] = toggleMap[command];
    const val = args[0]?.toLowerCase();
    if (val === 'on') {
      config[key] = true;
      await sock.sendMessage(sender, { text: `✅ *${label}* ON කළා!\n\n${config.watermark}` });
    } else if (val === 'off') {
      config[key] = false;
      await sock.sendMessage(sender, { text: `❌ *${label}* OFF කළා!\n\n${config.watermark}` });
    } else {
      await sock.sendMessage(sender, { text: `⚙️ *${label}*: ${config[key] ? '✅ ON' : '❌ OFF'}\n\nUsage: \`${prefix}${command} on/off\`` });
    }
    return true;
  }

  // ─── SET EMOJI ──────────────────────────────────────────
  if (command === 'setemoji' && args[0]) {
    config.autoStatusLikeEmoji = args[0];
    await sock.sendMessage(sender, { text: `✅ Status like emoji: ${args[0]}` });
    return true;
  }

  // ─── SET IMAGE ──────────────────────────────────────────
  if (command === 'setmenuimg') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}setmenuimg [image url]\`` }); return true; }
    config.menuImage = url;
    await sock.sendMessage(sender, { text: `✅ Menu image updated!` });
    return true;
  }

  if (command === 'setconnectimg') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}setconnectimg [image url]\`` }); return true; }
    config.connectImage = url;
    await sock.sendMessage(sender, { text: `✅ Connect image updated!` });
    return true;
  }

  if (command === 'setbotname') {
    const name = args.join(' ');
    if (!name) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}setbotname My Bot\`` }); return true; }
    config.botName = name;
    await sock.sendMessage(sender, { text: `✅ Bot name: ${name}` });
    return true;
  }

  // ─── AI COMMAND ─────────────────────────────────────────
  if (command === 'ai' || command === 'ask') {
    const q = args.join(' ');
    if (!q) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}ai ඔබේ question\`` }); return true; }
    await sock.sendPresenceUpdate('composing', sender);
    try {
      const res = await axios.get(
        `${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(q)}`,
        { timeout: 25000 }
      );
      const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text || 'No response';
      await sock.sendMessage(sender, { text: `🤖 *AI Reply*\n\n${reply}\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ AI error: ${e.message}` });
    }
    return true;
  }

  // ─── BOT DEPLOY (send pair code to number) ──────────────
  if (command === 'bot') {
    const num = args[0]?.replace(/[^0-9]/g, '');
    if (!num) {
      await sock.sendMessage(sender, {
        text: `🤖 *Deploy Bot*\n\nUsage: \`${prefix}bot 94xxxxxxxxx\`\n\nBot deploy කිරීමට panel link:\n🌐 ${config.panelUrl}/connect\n\n${config.watermark}`
      });
      return true;
    }
    await sock.sendMessage(sender, {
      text: `🚀 *Bot Deploy Info*\n\n📱 Number: *${num}*\n\n1️⃣ මෙම link open කරන්න:\n🌐 *${config.panelUrl}/connect*\n\n2️⃣ Number enter කරලා QR code scan කරන්න\n\n3️⃣ Inbox OTP ලැබෙනවා → Login!\n\n${config.watermark}`
    });
    // Try to send panel link directly to that number
    try {
      await sock.sendMessage(`${num}@s.whatsapp.net`, {
        text: `🤖 *CHALAH MD Bot Deploy*\n\nඔබට bot deploy කරගන්න:\n\n🌐 *${config.panelUrl}/connect*\n\nQR code scan කරලා connect කරන්න!\n\n${config.watermark}`
      });
    } catch (e) {}
    return true;
  }

  // ─── SAVE STATUS ────────────────────────────────────────
  if (command === 'save') {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) { await sock.sendMessage(sender, { text: `Status quote කරලා \`${prefix}save\` ගහන්න!` }); return true; }
    try {
      const type = quoted.imageMessage ? 'image' : quoted.videoMessage ? 'video' : null;
      if (!type) { await sock.sendMessage(sender, { text: `Image/Video status quote කරන්න!` }); return true; }
      const mediaMsg = quoted.imageMessage || quoted.videoMessage;
      const ext = type === 'image' ? 'jpg' : 'mp4';
      const stream = await downloadContentFromMessage(mediaMsg, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await fs.ensureDir('./saved_status');
      await fs.writeFile(`./saved_status/status_${Date.now()}.${ext}`, buffer);
      await sock.sendMessage(sender, { [type]: buffer, caption: `✅ Status Saved!\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // ─── UPDATE ─────────────────────────────────────────────
  if (command === 'update') {
    try {
      const simpleGit = require('simple-git');
      const git = simpleGit('./');
      await git.fetch();
      const status = await git.status();
      if (status.behind > 0) {
        await git.pull();
        await sock.sendMessage(sender, { text: `✅ Updated! ${status.behind} commits. Restarting...` });
        setTimeout(() => process.exit(0), 2000);
      } else {
        await sock.sendMessage(sender, { text: `✅ Already up to date!\n\n${config.watermark}` });
      }
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Update error: ${e.message}` });
    }
    return true;
  }

  // ═══ GROUP COMMANDS ═══════════════════════════════════════
  if (isGroup) {
    const groupMeta = await sock.groupMetadata(sender).catch(() => null);
    const participants = groupMeta?.participants || [];
    const botId = sock.user.id.split(':')[0] + '@s.whatsapp.net';
    const botIsAdmin = participants.find(p => p.id === botId)?.admin != null;
    const senderIsAdmin = participants.find(p => p.id === senderJid)?.admin != null;

    // ─── TAG ALL ──────────────────────────────────────────
    if (command === 'tagall' || command === 'everyone') {
      if (!senderIsAdmin && senderNum !== config.ownerNumber) {
        await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true;
      }
      const text = args.join(' ') || '📢 Attention everyone!';
      const mentions = participants.map(p => p.id);
      const mentionText = mentions.map(m => `@${m.split('@')[0]}`).join(' ');
      await sock.sendMessage(sender, {
        text: `📢 *${text}*\n\n${mentionText}\n\n${config.watermark}`,
        mentions
      });
      return true;
    }

    // ─── KICK ─────────────────────────────────────────────
    if (command === 'kick' || command === 'remove') {
      if (!botIsAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
      if (!senderIsAdmin && senderNum !== config.ownerNumber) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) { await sock.sendMessage(sender, { text: `Usage: @mention \`${prefix}kick\`` }); return true; }
      await sock.groupParticipantsUpdate(sender, mentioned, 'remove');
      await sock.sendMessage(sender, { text: `✅ ${mentioned.length} member(s) kicked!\n\n${config.watermark}` });
      return true;
    }

    // ─── ADD ──────────────────────────────────────────────
    if (command === 'add') {
      if (!botIsAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
      if (!senderIsAdmin && senderNum !== config.ownerNumber) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
      const num = args[0]?.replace(/[^0-9]/g, '');
      if (!num) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}add 94xxxxxxxx\`` }); return true; }
      await sock.groupParticipantsUpdate(sender, [`${num}@s.whatsapp.net`], 'add');
      await sock.sendMessage(sender, { text: `✅ Added ${num}!\n\n${config.watermark}` });
      return true;
    }

    // ─── PROMOTE / DEMOTE ─────────────────────────────────
    if (command === 'promote' || command === 'demote') {
      if (!botIsAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
      if (!senderIsAdmin && senderNum !== config.ownerNumber) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
      const mentioned = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
      if (!mentioned.length) { await sock.sendMessage(sender, { text: `@mention \`${prefix}${command}\`` }); return true; }
      const action = command === 'promote' ? 'promote' : 'demote';
      await sock.groupParticipantsUpdate(sender, mentioned, action);
      await sock.sendMessage(sender, { text: `✅ ${command}d!\n\n${config.watermark}` });
      return true;
    }

    // ─── MUTE / UNMUTE ────────────────────────────────────
    if (command === 'mute' || command === 'unmute') {
      if (!botIsAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
      if (!senderIsAdmin && senderNum !== config.ownerNumber) { await sock.sendMessage(sender, { text: `❌ Admin only!` }); return true; }
      await sock.groupSettingUpdate(sender, command === 'mute' ? 'announcement' : 'not_announcement');
      await sock.sendMessage(sender, { text: `${command === 'mute' ? '🔇 Muted' : '🔊 Unmuted'}!\n\n${config.watermark}` });
      return true;
    }

    // ─── GROUP INFO ───────────────────────────────────────
    if (command === 'groupinfo' || command === 'ginfo') {
      if (!groupMeta) { await sock.sendMessage(sender, { text: `❌ Group info ගන්නට බැරිවුණා` }); return true; }
      const admins = participants.filter(p => p.admin).map(p => `• @${p.id.split('@')[0]}`).join('\n');
      await sock.sendMessage(sender, {
        text: `📊 *Group Info*\n\n👥 *Name:* ${groupMeta.subject}\n📝 *Desc:* ${groupMeta.desc || 'N/A'}\n👤 *Members:* ${participants.length}\n👑 *Admins:*\n${admins}\n🆔 *ID:* ${sender}\n\n${config.watermark}`,
        mentions: participants.filter(p => p.admin).map(p => p.id)
      });
      return true;
    }

    // ─── INVITE LINK ──────────────────────────────────────
    if (command === 'link' || command === 'invite') {
      if (!botIsAdmin) { await sock.sendMessage(sender, { text: `❌ Bot admin නෑ!` }); return true; }
      const code = await sock.groupInviteCode(sender);
      await sock.sendMessage(sender, {
        text: `🔗 *Group Invite Link*\n\nhttps://chat.whatsapp.com/${code}\n\n${config.watermark}`
      });
      return true;
    }
  }

  return false;
}

module.exports = { handle };
