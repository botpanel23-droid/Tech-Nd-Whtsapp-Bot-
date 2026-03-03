const config = require('../config');
const fs = require('fs-extra');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

async function handle(sock, msg, sender, command, args, body) {
  const prefix = config.prefix;

  if (command === 'menu' || command === 'help') {
    await sock.sendMessage(sender, {
      text: `┏━━━━━━━━━━━━━━━━━━━━┓
┃      🤖 *${config.botName} MENU* 🤖      ┃
┗━━━━━━━━━━━━━━━━━━━━┛

🎨 *IMAGE COMMANDS*
┣ \`${prefix}edit prompt\` - AI Image Edit ✨
┣ \`${prefix}sticker\` - Image → Sticker
┣ \`${prefix}toimg\` - Sticker → Image
┣ \`${prefix}blur\` - Image blur
┣ \`${prefix}enhance\` - Image enhance
┗ \`${prefix}resize w h\` - Resize image

🎮 *TOOLS*
┣ \`${prefix}ttlike url\` - TikTok Free Like ❤️
┣ \`${prefix}ff uid\` - Free Fire Info 🎮
┣ \`${prefix}tt url\` - TikTok Download
┗ \`${prefix}weather city\` - Weather

🤖 *AI*
┗ \`${prefix}ai question\` - Ask AI (or enable AI Mode)

💾 *STATUS*
┣ \`${prefix}save\` - Save status (quote it)
┣ \`${prefix}autoseen on/off\`
┣ \`${prefix}autolike on/off\`
┗ \`${prefix}setemoji 💖\`

⚙️ *SETTINGS*
┣ \`${prefix}alwaysonline on/off\`
┣ \`${prefix}autotyping on/off\`
┣ \`${prefix}aimode on/off\` - AI Auto Reply
┗ \`${prefix}autoreply on/off\`

🔧 *SYSTEM*
┣ \`${prefix}ping\` - Ping
┣ \`${prefix}info\` - Bot info
┗ \`${prefix}update\` - GitHub update

━━━━━━━━━━━━━━━━━━━━
🌐 Panel: ${config.panelUrl}`
    });
    return true;
  }

  if (command === 'ping') {
    const start = Date.now();
    await sock.sendMessage(sender, { text: `🏓 *Pong!* ${Date.now() - start}ms` });
    return true;
  }

  if (command === 'info') {
    const up = process.uptime();
    const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60);
    await sock.sendMessage(sender, {
      text: `🤖 *BOT INFO*\n\n🏷️ Name: ${config.botName}\n⏱️ Uptime: ${h}h ${m}m\n🤖 AI Mode: ${config.aiMode ? '✅ ON' : '❌ OFF'}\n🟢 Always Online: ${config.alwaysOnline ? '✅' : '❌'}\n👁️ Auto Seen: ${config.autoSeen ? '✅' : '❌'}\n❤️ Auto Like: ${config.autoStatusLike ? '✅' : '❌'}`
    });
    return true;
  }

  // AI command (direct)
  if (command === 'ai' || command === 'ask') {
    const q = args.join(' ');
    if (!q) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}ai ඔබේ question\`` }); return true; }
    await sock.sendPresenceUpdate('composing', sender);
    try {
      const axios = require('axios');
      const res = await axios.get(
        `${config.apiBase}/ai/claude?apikey=${config.apiKey}&q=${encodeURIComponent(q)}`,
        { timeout: 25000 }
      );
      const reply = res.data?.result || res.data?.response || res.data?.answer || res.data?.text || res.data?.message || JSON.stringify(res.data);
      await sock.sendMessage(sender, { text: `🤖 *AI Reply*\n\n${reply}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ AI error: ${e.message}` });
    }
    return true;
  }

  // Settings toggles
  const settingsMap = {
    'autoseen': ['autoSeen', 'Auto Seen'],
    'autolike': ['autoStatusLike', 'Auto Status Like'],
    'autoreply': ['autoStatusReply', 'Auto Status Reply'],
    'alwaysonline': ['alwaysOnline', 'Always Online'],
    'autotyping': ['autoTyping', 'Auto Typing'],
    'aimode': ['aiMode', 'AI Auto Reply'],
  };

  if (settingsMap[command]) {
    const [key, label] = settingsMap[command];
    const val = args[0]?.toLowerCase();
    if (val === 'on') { config[key] = true; await sock.sendMessage(sender, { text: `✅ *${label}* ON!` }); }
    else if (val === 'off') { config[key] = false; await sock.sendMessage(sender, { text: `❌ *${label}* OFF!` }); }
    else { await sock.sendMessage(sender, { text: `⚙️ *${label}*: ${config[key] ? '✅ ON' : '❌ OFF'}\n\nUsage: \`${prefix}${command} on/off\`` }); }
    return true;
  }

  if (command === 'setemoji') {
    if (args[0]) { config.autoStatusLikeEmoji = args[0]; await sock.sendMessage(sender, { text: `✅ Emoji: ${args[0]}` }); }
    return true;
  }

  if (command === 'save') {
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    if (!quoted) { await sock.sendMessage(sender, { text: `Status quote කරලා \`${prefix}save\` ගහන්න!` }); return true; }
    try {
      let mediaMsg = quoted.imageMessage || quoted.videoMessage;
      if (!mediaMsg) { await sock.sendMessage(sender, { text: `Image/Video status quote කරන්න!` }); return true; }
      const type = quoted.imageMessage ? 'image' : 'video';
      const ext = type === 'image' ? 'jpg' : 'mp4';
      const stream = await downloadContentFromMessage(mediaMsg, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
      await fs.ensureDir('./saved_status');
      await fs.writeFile(`./saved_status/status_${Date.now()}.${ext}`, buffer);
      await sock.sendMessage(sender, { [type]: buffer, caption: '✅ Status Saved!' });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Save error: ${e.message}` });
    }
    return true;
  }

  if (command === 'update') {
    if (!config.githubRepo) { await sock.sendMessage(sender, { text: `❌ GitHub repo config නෑ. Panel → Update settings.` }); return true; }
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
        await sock.sendMessage(sender, { text: `✅ Already up to date!` });
      }
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Update error: ${e.message}` });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
