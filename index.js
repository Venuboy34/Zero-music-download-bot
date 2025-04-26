const { Telegraf } = require('telegraf');
const ytdl = require('ytdl-core');
const yts = require('yt-search');
const fs = require('fs');
const axios = require('axios');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const os = require('os');

// Bot token
const bot = new Telegraf(process.env.BOT_TOKEN || "7657837342:AAE29dsv6Vcqi3hUhs8D7VCBBxBgRxBsa6w");

// Function to create temp directory if it doesn't exist
const tempDir = path.join(os.tmpdir(), 'music-bot');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Start command
bot.start(async (ctx) => {
  const name = ctx.from.first_name;
  const welcomeImageUrl = "https://envs.sh/C_W.jpg";
  
  try {
    await ctx.replyWithPhoto(
      { url: welcomeImageUrl },
      { 
        caption: `🎧 Hello ${name}!\n\nSend me a music name and I'll find it on YouTube, extract the audio, and send it back to you as MP3!\n\n🔍 Just type something like:\nBeliever by Imagine Dragons`,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    console.error("Error sending welcome message:", error);
    await ctx.reply(`🎧 Hello ${name}!\n\nSend me a music name and I'll find it on YouTube, extract the audio, and send it back to you as MP3!`);
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Skip commands
  
  const searchQuery = ctx.message.text;
  const name = ctx.from.first_name;
  
  const statusMsg = await ctx.reply(`🔎 Searching for: ${searchQuery}...`);
  
  try {
    // Search for video
    const searchResults = await yts(searchQuery);
    if (!searchResults.videos.length) {
      return ctx.reply("⚠️ No results found for your query.");
    }
    
    const video = searchResults.videos[0];
    const videoUrl = video.url;
    const title = video.title;
    const artist = video.author.name;
    const thumbnailUrl = video.thumbnail;
    
    await ctx.reply(`✅ Found: "${title}" by ${artist}\n\n⬇️ Downloading audio...`);
    
    // File paths
    const audioPath = path.join(tempDir, `${ctx.from.id}_${Date.now()}.mp3`);
    const thumbPath = path.join(tempDir, `${ctx.from.id}_${Date.now()}_thumb.jpg`);
    
    // Download thumbnail
    if (thumbnailUrl) {
      const response = await axios({
        method: 'GET',
        url: thumbnailUrl,
        responseType: 'stream'
      });
      
      const writer = fs.createWriteStream(thumbPath);
      response.data.pipe(writer);
      
      await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    }
    
    // Download and convert audio
    const stream = ytdl(videoUrl, { 
      quality: 'highestaudio',
      filter: 'audioonly'
    });
    
    await new Promise((resolve, reject) => {
      ffmpeg(stream)
        .audioBitrate(192)
        .save(audioPath)
        .on('end', resolve)
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        });
    });
    
    // Send audio file
    await ctx.replyWithAudio(
      { source: audioPath },
      {
        title: title,
        performer: artist,
        thumb: fs.existsSync(thumbPath) ? { source: thumbPath } : undefined,
        caption: `🎶 ${title}\n👤 By: ${artist}\n\nEnjoy, ${name}!`,
        parse_mode: "Markdown"
      }
    );
    
    // Clean up files
    setTimeout(() => {
      try {
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        if (fs.existsSync(thumbPath)) fs.unlinkSync(thumbPath);
      } catch (e) {
        console.error('Error cleaning up files:', e);
      }
    }, 1000);
    
  } catch (error) {
    console.error("Error processing request:", error);
    await ctx.reply("⚠️ Error: Couldn't find or download the music.");
  }
});

// Set up webhook for Vercel
const webhookCallback = bot.webhookCallback('/api/webhook');

// Export the webhook callback function for Vercel
module.exports = (req, res) => {
  if (req.method === 'GET') {
    res.status(200).send('Bot is running');
    return;
  }
  
  if (req.method === 'POST') {
    webhookCallback(req, res);
    return;
  }
  
  res.status(405).send('Method not allowed');
};

// Start polling if not in production (for local development)
if (process.env.NODE_ENV !== 'production') {
  bot.launch();
  console.log('Bot started in polling mode');
}

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
