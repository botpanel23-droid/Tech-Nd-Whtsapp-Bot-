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

// ─── AI IMAGE EDIT (With Retry & Custom API) ────────────────
if (command === 'edit') {
    const prompt = args.join(' ');
    
    // Image එකක් mention/quote කර ඇත්දැයි බැලීම
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = msg.message?.imageMessage || quoted?.imageMessage;

    if (!isImage || !prompt) {
        await sock.sendMessage(sender, {
            text: `🎨 *AI Image Edit*\n\nභාවිතය: රූපයක් mention කර හෝ caption එකේ මෙසේ ලියන්න:\n\`${prefix}edit <prompt>\` \n\nනිදසුන්:\n\`${prefix}edit add a gold chain\`\n\`${prefix}edit රතු පාට කරන්න\``
        });
        return true;
    }

    await sock.sendMessage(sender, { text: '🎨 AI මගින් රූපය සකසමින් පවතී... ⏳' });

    // Image Buffer එක ලබා ගැනීම
    const media = quoted ? quoted.imageMessage : msg.message.imageMessage;
    const buffer = await sock.downloadMediaMessage(media);
    const base64 = buffer.toString('base64');
    const mimeType = media.mimetype || 'image/jpeg';

    // API විස්තර
    const apiUrl = `https://public-apis-site-1b025aa8b541.herokuapp.com/api/image/editv1?apikey=dex_hQO5V4ggt814y1XIMPZQKvSIyz1fdUI4qkHYXtJnruZmTLwp`;

    // Process කරන Function එක (Retry එක සඳහා)
    const processEdit = async () => {
        const res = await axios.post(apiUrl, {
            image: `data:${mimeType};base64,${base64}`,
            prompt: prompt
        }, { timeout: 90000 }); // තත්පර 90ක් timeout ලබා දී ඇත
        return res.data;
    };

    try {
        let resultData;
        let success = false;

        // පළමු උත්සාහය (Attempt 1)
        try {
            resultData = await processEdit();
            success = true;
        } catch (err) {
            console.log("පළමු උත්සාහය අසාර්ථකයි, නැවත උත්සාහ කරයි...");
            // දෙවන උත්සාහය (Attempt 2 - Retry)
            resultData = await processEdit();
            success = true;
        }

        if (success) {
            // API එකෙන් ලැබෙන විවිධ JSON key වලට ගැලපෙන සේ සැකසීම
            const resultUrl = resultData?.result || resultData?.url || resultData?.image || resultData?.output;

            if (resultUrl && resultUrl.startsWith('http')) {
                const imgRes = await axios.get(resultUrl, { responseType: 'arraybuffer' });
                await sock.sendMessage(sender, {
                    image: Buffer.from(imgRes.data),
                    caption: `✅ *AI Edit සාර්ථකයි!*\n📝 Prompt: ${prompt}`
                }, { quoted: msg });
            } else {
                await sock.sendMessage(sender, { text: `❌ Edit අසාර්ථකයි. (API Error)` });
            }
        }
    } catch (e) {
        console.error(e);
        await sock.sendMessage(sender, { text: `❌ දෝෂයක් ඇති විය: ${e.message}` });
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
