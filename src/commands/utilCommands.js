const config = require('../config');
const axios = require('axios');

const quotes = ["ජීවිතය කෙටිය, සිහිනය දිගය.", "The only way to do great work is to love what you do. - Steve Jobs", "හිතන්ට කලින් හදිස්සි වෙන්න එපා."];
const jokes = ["Teacher: Why late?\nStudent: Sign said 'School Ahead, Go Slow!' 😂", "Programmer: Fixed 1 bug → Found 3 more 😅"];
const facts = ["🐙 Octopuses have 3 hearts!", "🍯 Honey never expires!", "🧠 Brain uses 20% of body energy."];

async function handle(sock, msg, sender, command, args, body) {
  const prefix = config.prefix;

  // ─── SOCIAL MEDIA DOWNLOADERS ───────────────────────────

  // YouTube
  if (command === 'yt' || command === 'youtube') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}yt [youtube url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ YouTube downloading...' });
    try {
      const res = await axios.get(`https://api.fabdl.com/youtube/mp4?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const dlUrl = res.data?.result?.download_url || res.data?.url;
      if (!dlUrl) throw new Error('No download URL');
      const vid = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 60000 });
      await sock.sendMessage(sender, {
        video: Buffer.from(vid.data),
        caption: `✅ YouTube Video\n\n${config.watermark}`
      });
    } catch (e) {
      // Try alternate API
      try {
        const res2 = await axios.get(`https://yt-api.p.rapidapi.com/dl?id=${url}`, { timeout: 15000 });
        await sock.sendMessage(sender, { text: `❌ Direct download failed. Try: https://y2mate.com` });
      } catch {
        await sock.sendMessage(sender, { text: `❌ YouTube download error! URL valid ද?` });
      }
    }
    return true;
  }

  // TikTok
  if (command === 'tt' || command === 'tiktok') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}tt [tiktok url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ TikTok downloading...' });
    try {
      const res = await axios.get(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const videoUrl = res.data?.video?.noWatermark || res.data?.video?.watermark;
      if (!videoUrl) throw new Error('No video');
      const vid = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 40000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: `✅ TikTok (No Watermark)\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ TikTok download error!` });
    }
    return true;
  }

  // Facebook
  if (command === 'fb' || command === 'facebook') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}fb [facebook url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ Facebook downloading...' });
    try {
      const res = await axios.get(`https://fdownloader.net/api/ajaxSearch`, {
        params: { q: url, lang: 'en' }, timeout: 15000
      });
      const links = res.data?.data?.match(/https?:\/\/[^"'\s]+\.mp4[^"'\s]*/g);
      if (!links || !links[0]) throw new Error('No video');
      const vid = await axios.get(links[0], { responseType: 'arraybuffer', timeout: 50000 });
      await sock.sendMessage(sender, { video: Buffer.from(vid.data), caption: `✅ Facebook Video\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Facebook download error!` });
    }
    return true;
  }

  // Instagram
  if (command === 'ig' || command === 'instagram') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}ig [instagram url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '⏳ Instagram downloading...' });
    try {
      const res = await axios.get(`https://api.instagramdl.net/?url=${encodeURIComponent(url)}`, { timeout: 15000 });
      const mediaUrl = res.data?.url || res.data?.media?.[0]?.url;
      if (!mediaUrl) throw new Error('No media');
      const isVideo = mediaUrl.includes('.mp4');
      const media = await axios.get(mediaUrl, { responseType: 'arraybuffer', timeout: 40000 });
      const buf = Buffer.from(media.data);
      if (isVideo) {
        await sock.sendMessage(sender, { video: buf, caption: `✅ Instagram Video\n\n${config.watermark}` });
      } else {
        await sock.sendMessage(sender, { image: buf, caption: `✅ Instagram Photo\n\n${config.watermark}` });
      }
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Instagram download error!` });
    }
    return true;
  }

  // TikTok Like
  if (command === 'ttlike') {
    const url = args[0];
    if (!url) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}ttlike [tiktok url]\`` }); return true; }
    await sock.sendMessage(sender, { text: '❤️ TikTok like send කරනවා...' });
    try {
      const res = await axios.get(`${config.apiBase}/tools/ttlike?apikey=${config.apiKey}&url=${encodeURIComponent(url)}`, { timeout: 20000 });
      const d = res.data;
      await sock.sendMessage(sender, { text: `✅ *TikTok Like Sent!*\n\n${JSON.stringify(d, null, 2)}\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // Free Fire
  if (command === 'ff' || command === 'freefire') {
    const uid = args[0];
    if (!uid) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}ff [uid]\`` }); return true; }
    await sock.sendMessage(sender, { text: '🔍 Free Fire info ගන්නවා...' });
    try {
      const res = await axios.get(`${config.apiBase}/stalker/freefire?apikey=${config.apiKey}&uid=${uid}`, { timeout: 15000 });
      const d = res.data;
      const name = d?.name || d?.nickname || d?.basicInfo?.nickname || 'N/A';
      const level = d?.level || d?.basicInfo?.level || 'N/A';
      const rank = d?.rank || d?.rankingInfo?.brRankPoint || 'N/A';
      const likes = d?.likes || d?.socialInfo?.likes || 'N/A';
      const region = d?.region || d?.basicInfo?.region || 'N/A';
      const guild = d?.guild || d?.clanBasicInfo?.clanName || 'None';
      await sock.sendMessage(sender, {
        text: `🎮 *FREE FIRE INFO*\n\n👤 *Name:* ${name}\n🆔 *UID:* ${uid}\n⭐ *Level:* ${level}\n🏆 *Rank Points:* ${rank}\n❤️ *Likes:* ${likes}\n🌍 *Region:* ${region}\n⚔️ *Guild:* ${guild}\n\n${config.watermark}`
      });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // Quote / Joke / Fact
  if (command === 'quote' || command === 'q') {
    await sock.sendMessage(sender, { text: `💬 _"${quotes[Math.floor(Math.random()*quotes.length)]}"_\n\n${config.watermark}` });
    return true;
  }
  if (command === 'joke' || command === 'j') {
    await sock.sendMessage(sender, { text: `😂 ${jokes[Math.floor(Math.random()*jokes.length)]}\n\n${config.watermark}` });
    return true;
  }
  if (command === 'fact' || command === 'f') {
    await sock.sendMessage(sender, { text: `🧠 ${facts[Math.floor(Math.random()*facts.length)]}\n\n${config.watermark}` });
    return true;
  }

  // Weather
  if (command === 'weather' || command === 'w') {
    const city = args.join(' ') || 'Colombo';
    try {
      const res = await axios.get(`https://wttr.in/${encodeURIComponent(city)}?format=j1`, { timeout: 8000 });
      const c = res.data.current_condition[0];
      const a = res.data.nearest_area[0];
      await sock.sendMessage(sender, {
        text: `🌤️ *Weather - ${a.areaName[0].value}*\n\n🌡️ *Temp:* ${c.temp_C}°C\n☁️ *Sky:* ${c.weatherDesc[0].value}\n💧 *Humidity:* ${c.humidity}%\n💨 *Wind:* ${c.windspeedKmph}km/h\n\n${config.watermark}`
      });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Weather error!` });
    }
    return true;
  }

  // Translate
  if (command === 'translate' || command === 'tr') {
    const lang = args[0] || 'si', text = args.slice(1).join(' ');
    if (!text) { await sock.sendMessage(sender, { text: `Usage: \`${prefix}translate si Your text\`` }); return true; }
    try {
      const res = await axios.get(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(text)}`, { timeout: 8000 });
      await sock.sendMessage(sender, { text: `🌐 *Translation*\n\n📝 ${text}\n✅ ${res.data[0][0][0]}\n\n${config.watermark}` });
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Translation error!` });
    }
    return true;
  }

  return false;
}

module.exports = { handle };
