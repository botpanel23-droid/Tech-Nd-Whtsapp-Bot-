const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const config = require('../config');
const Jimp = require('jimp');
const axios = require('axios');

async function getImageBuffer(msg) {
  const imageMsg = msg.message?.imageMessage ||
    msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage;
  if (!imageMsg) return { buffer: null, imageMsg: null };
  const stream = await downloadContentFromMessage(imageMsg, 'image');
  let buffer = Buffer.from([]);
  for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
  return { buffer, imageMsg };
}

async function handle(sock, msg, sender, command, args, body) {
  const prefix = config.prefix;

  // ─── AI IMAGE EDIT ──────────────────────────────────────
  if (command === 'edit') {
    const prompt = args.join(' ');
    const { buffer, imageMsg } = await getImageBuffer(msg);

    if (!buffer || !prompt) {
      await sock.sendMessage(sender, {
        text: `🎨 *AI Image Edit*\n\nImage attach/quote කරලා:\n\`${prefix}edit කාර් එකක් add කරන්න\`\n\nExamples:\n\`${prefix}edit make it sunset\`\n\`${prefix}edit add snow\`\n\`${prefix}edit make anime style\``
      });
      return true;
    }

    await sock.sendMessage(sender, { text: '🎨 AI image edit කරනවා... ⏳' });

    try {
      const base64 = buffer.toString('base64');
      const mimeType = imageMsg.mimetype || 'image/jpeg';

      const res = await axios.post(
        `${config.apiBase}/image/editv1?apikey=${config.apiKey}`,
        { image: `data:${mimeType};base64,${base64}`, prompt },
        { timeout: 60000 }
      );

      const data = res.data;
      const resultUrl = data?.result || data?.url || data?.image || data?.output || data?.data;

      if (resultUrl && typeof resultUrl === 'string' && resultUrl.startsWith('http')) {
        const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer', timeout: 30000 });
        await sock.sendMessage(sender, {
          image: Buffer.from(imgRes.data),
          caption: `✅ *AI Edit Done!*\n📝 ${prompt}`
        });
      } else if (resultUrl && resultUrl.startsWith('data:')) {
        const base64Data = resultUrl.split(',')[1];
        await sock.sendMessage(sender, {
          image: Buffer.from(base64Data, 'base64'),
          caption: `✅ *AI Edit Done!*\n📝 ${prompt}`
        });
      } else {
        await sock.sendMessage(sender, { text: `❌ Edit failed!\nResponse: ${JSON.stringify(data).substring(0, 200)}` });
      }
    } catch (e) {
      await sock.sendMessage(sender, { text: `❌ Error: ${e.message}` });
    }
    return true;
  }

  // ─── STICKER ────────────────────────────────────────────
  if (command === 'sticker' || command === 's') {
    const { buffer } = await getImageBuffer(msg);
    if (!buffer) {
      await sock.sendMessage(sender, { text: `Image attach/quote කරලා \`${prefix}sticker\` ගහන්න!` });
      return true;
    }
    await sock.sendMessage(sender, { sticker: buffer });
    return true;
  }

  // ─── TO IMAGE ───────────────────────────────────────────
  if (command === 'toimg') {
    const stickerMsg = msg.message?.stickerMessage ||
      msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage;
    if (!stickerMsg) {
      await sock.sendMessage(sender, { text: `Sticker quote කරලා \`${prefix}toimg\` ගහන්න!` });
      return true;
    }
    const stream = await downloadContentFromMessage(stickerMsg, 'sticker');
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    await sock.sendMessage(sender, { image: buffer, caption: '✅ Sticker → Image' });
    return true;
  }

  // ─── BLUR ───────────────────────────────────────────────
  if (command === 'blur') {
    const { buffer } = await getImageBuffer(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image attach කරලා \`${prefix}blur\` ගහන්න!` }); return true; }
    const img = await Jimp.read(buffer);
    img.blur(parseInt(args[0]) || 10);
    const result = await img.getBufferAsync(Jimp.MIME_JPEG);
    await sock.sendMessage(sender, { image: result, caption: '✅ Blurred!' });
    return true;
  }

  // ─── ENHANCE ────────────────────────────────────────────
  if (command === 'enhance') {
    const { buffer } = await getImageBuffer(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Image attach කරලා \`${prefix}enhance\` ගහන්න!` }); return true; }
    const img = await Jimp.read(buffer);
    img.contrast(0.2).brightness(0.05);
    const result = await img.getBufferAsync(Jimp.MIME_JPEG);
    await sock.sendMessage(sender, { image: result, caption: '✅ Enhanced!' });
    return true;
  }

  // ─── RESIZE ─────────────────────────────────────────────
  if (command === 'resize') {
    const { buffer } = await getImageBuffer(msg);
    if (!buffer) { await sock.sendMessage(sender, { text: `Usage: Image + \`${prefix}resize 800 600\`` }); return true; }
    const w = parseInt(args[0]) || 800, h = parseInt(args[1]) || 600;
    const img = await Jimp.read(buffer);
    img.resize(w, h);
    const result = await img.getBufferAsync(Jimp.MIME_JPEG);
    await sock.sendMessage(sender, { image: result, caption: `✅ Resized ${w}x${h}` });
    return true;
  }

  return false;
}

module.exports = { handle };
