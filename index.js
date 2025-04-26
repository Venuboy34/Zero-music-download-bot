const { Telegraf } = require('telegraf');
const axios = require('axios');
const yts = require('yt-search');

// Bot token from environment variable or hardcoded
const bot = new Telegraf(process.env.BOT_TOKEN || "7657837342:AAE29dsv6Vcqi3hUhs8D7VCBBxBgRxBsa6w");

// Start command
bot.start(async (ctx) => {
  const name = ctx.from.first_name;
  const welcomeImageUrl = "https://envs.sh/C_W.jpg";
  
  try {
    await ctx.replyWithPhoto(
      { url: welcomeImageUrl },
      { 
        caption: `🎧 Hello ${name}!\n\nSend me a music name and I'll find it on YouTube and send it back to you as MP3!\n\n🔍 Just type something like:\nBeliever by Imagine Dragons`,
        parse_mode: "Markdown"
      }
    );
  } catch (error) {
    console.error("Error sending welcome message:", error);
    await ctx.reply(`🎧 Hello ${name}!\n\nSend me a music name and I'll find it on YouTube and send it back to you as MP3!`);
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return; // Skip commands
  
  const searchQuery = ctx.message.text;
  const name = ctx.from.first_name;
  
  const statusMsg = await ctx.reply(`🔎 Searching for: ${searchQuery}...`);
  
  try {
    // Search for video using yt-search
    const searchResults = await yts(searchQuery);
    if (!searchResults.videos.length) {
      return ctx.reply("⚠️ No results found for your query.");
    }
    
    const video = searchResults.videos[0];
    const videoId = video.videoId;
    const title = video.title;
    const artist = video.author.name;
    const thumbnailUrl = video.thumbnail;
    const duration = video.seconds; // Duration in seconds
    
    await ctx.reply(`✅ Found: "${title}" by ${artist}\n\n⬇️ Processing audio...`);
    
    // Check if video is too long (>10 minutes might be problematic)
    if (duration > 600) {
      return ctx.reply("⚠️ Sorry, the video is too long (>10 minutes). Please try a shorter one.");
    }
    
    // Use a public YouTube to MP3 API service instead of processing locally
    const mp3Url = `https://yt-download.org/api/button/mp3/${videoId}`;
    const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Create a nice response with buttons
    await ctx.reply(`🎵 *${title}*\n👤 By: ${artist}\n\nDownload your music using the link below:`, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            { text: "⬇️ Download MP3", url: mp3Url }
          ],
          [
            { text: "🎬 Watch on YouTube", url: youtubeUrl }
          ]
        ]
      }
    });
    
  } catch (error) {
    console.error("Error processing request:", error);
    await ctx.reply("⚠️ Error: Couldn't find or process the music request.");
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
