const config = require('../config');
const axios = require('axios');

const quotes = [
  "ජීවිතය කෙටිය, සිහිනය දිගය.",
  "ශක්තිය physical force නොවෙයි, indomitable will ශක්තිය.",
  "The only way to do great work is to love what you do. - Steve Jobs",
  "හිතන්ට කලින් හදිස්සි වෙන්න එපා.",
];
const jokes = [
  "Teacher: Why are you late?\nStudent: I saw 'School Ahead, Go Slow!' 😂",
  "Programmer: Fixed 1 bug → Found 3 more 😅",
  "WhatsApp bot: Auto reply ON\nMe: Finally peace\nBot: Hi! How can I help? 🤖",
];
const facts = [
  "🐙 Octopuses have 3 hearts!",
  "🍯 Honey never expires - 3000yr old honey found in Egypt!",
  "🧠 Brain uses 20% of body's total energy.",
];

async function handle(sock, msg, sender, command, args, body) {
  const prefix = config.prefix;

  // ─── TIKTOK LIKE ────────────────────────────────────────
  if (command === 'ttlike') {
    const url = args[0];
    if (!url) {
      await sock.sendMessage(sender, {
        text: `❤️ *TikTok Free Like*\n\nUsage:\n\`${prefix}ttlike https://tiktok.com/@user/video/123\``
      });
      return true;
    }
    await sock.sendMessage(sender, { text: '❤️ TikTok like send කරනවා...' });
    try {
      const res = await axios.get(
        `${config.apiBase}/tools/ttlike?apikey=${config.apiKey}&url=${encodeURIComponent(url)}`,
        { timeout: 20000 }
      );
      const d = res.data;
      const likes = d?.likes || d?.count || d?.result || 'Sent!';
      await sock.sendMessage(sender, {
        text: `✅ *TikTok Like Sent!*\n\n❤️ Likes: ${likes}\n🔗 Video: ${url}`
      });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // ─── FREE FIRE INFO ─────────────────────────────────────
  if (command === 'ff' || command === 'freefire') {
    const uid = args[0];
    if (!uid) {
      await sock.sendMessage(sender, {
        text: `🎮 *Free Fire Info*\n\nUsage:\n\`${prefix}ff 1234567890\``
      });
      return true;
    }
    await sock.sendMessage(sender, { text: '🔍 Free Fire info ගන්නවා...' });
    try {
      const res = await axios.get(
        `${config.apiBase}/stalker/freefire?apikey=${config.apiKey}&uid=${uid}`,
        { timeout: 15000 }
      );
      const d = res.data;
      const name = d?.name || d?.nickname || d?.playerName || d?.basicInfo?.nickname || 'N/A';
      const level = d?.level || d?.basicInfo?.level || 'N/A';
      const rank = d?.rank || d?.rankPoint || d?.rankingInfo?.brRankPoint || 'N/A';
      const likes = d?.likes || d?.socialInfo?.likes || 'N/A';
      const region = d?.region || d?.basicInfo?.region || 'N/A';
      const guild = d?.guild || d?.clanBasicInfo?.clanName || 'N/A';

      await sock.sendMessage(sender, {
        text: `🎮 *FREE FIRE INFO*\n\n👤 *Name:* ${name}\n🆔 *UID:* ${uid}\n⭐ *Level:* ${level}\n🏆 *Rank Points:* ${rank}\n❤️ *Likes:* ${likes}\n🌍 *Region:* ${region}\n⚔️ *Guild:* ${guild}`
      });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // ─── QUOTE ──────────────────────────────────────────────
  if (command === 'quote' || command === 'q') {
    const q = quotes[Math.floor(Math.random() * quotes.length)];
    await sock.sendMessage(sender, { text: `💬 *Quote*\n\n_"${q}"_` });
    return true;
  }

  // ─── JOKE ───────────────────────────────────────────────
  if (command === 'joke' || command === 'j') {
    await sock.sendMessage(sender, { text: `😂 *Joke*\n\n${jokes[Math.floor(Math.random() * jokes.length)]}` });
    return true;
  }

  // ─── FACT ───────────────────────────────────────────────
  if (command === 'fact' || command === 'f') {
    await sock.sendMessage(sender, { text: `🧠 *Did You Know?*\n\n${facts[Math.floor(Math.random() * facts.length)]}` });
    return true;
  }

  // ─── WEATHER ────────────────────────────────────────────
  if (command === 'weather' || command === 'w') {
    const city = args.join(' ') || 'Colombo';
    try {
      const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 8000 });
      const c = res.data.current_condition[0];
      const a = res.data.nearest_area[0];
      await sock.sendMessage(sender, {
        text: `🌤️ *Weather - ${a.areaName[0].value}, ${a.country[0].value}*\n\n🌡️ *Temp:* ${c.temp_C}°C (Feels ${c.FeelsLikeC}°C)\n☁️ *Sky:* ${c.weatherDesc[0].value}\n💧 *Humidity:* ${c.humidity}%\n💨 *Wind:* ${c.windspeedKmph} km/h`
      });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Weather error!` });
    }
    return true;
  }

  // ─── TRANSLATE ──────────────────────────────────────────
  if (command === 'translate' || command === 'tr') {
    const lang = args[0] || 'si';
    const text = args.slice(1).join(' ');
    if (!text) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}translate si Your text\`` }); return true; }
    try {
      const res = await axios.get(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`,
        { timeout: 8000 }
      );
      await sock.sendMessage(sender, { text: `🌐 *Translation*\n📝 Original: ${text}\n✅ ${lang}: ${res.data[0][0][0]}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Translation error!` });
    }
    return true;
  }

  // ─── TIKTOK DOWNLOAD ────────────────────────────────────
  if (command === 'tt' || command === 'tiktok') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}tt https://tiktok.com/...\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ Downloading...' });
    try {
      const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 15000 });
      const videoUrl = res.data?.video?.noWatermark;
      if (!videoUrl) throw new Error('No video URL');
      const vid = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 30000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: '✅ TikTok (No Watermark)' });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Download error!` });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
