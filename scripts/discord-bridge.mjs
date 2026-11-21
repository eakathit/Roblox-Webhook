import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN || process.argv[2];
const targetChannelId = process.env.DISCORD_CHANNEL_ID || '1572613980927566095'; // Channel #acx-farm from user's screenshot
const webAppUrl = process.env.WEB_APP_URL || 'http://localhost:3000/api/webhooks/user_main';

if (!token) {
  console.log('======================================================');
  console.log('🤖 ANIME CRUSADERS X - DISCORD BRIDGE BOT');
  console.log('======================================================');
  console.log('⚠️  ยังไม่ได้ใส่ DISCORD_BOT_TOKEN');
  console.log('วิธีใช้งาน:');
  console.log('node scripts/discord-bridge.mjs <YOUR_BOT_TOKEN>');
  console.log('หรือสร้างไฟล์ .env แล้วใส่ DISCORD_BOT_TOKEN=xxxx');
  console.log('======================================================');
  process.exit(0);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.on('ready', () => {
  console.log('======================================================');
  console.log(`✅ บอทเชื่อมต่อ Discord สำเร็จ: ${client.user.tag}`);
  console.log(`🎯 กำลังดักฟังห้องแจ้งเตือน (Channel ID: ${targetChannelId})`);
  console.log(`🌐 ส่งข้อมูลไปยัง Web App: ${webAppUrl}`);
  console.log('======================================================');
});

client.on('messageCreate', async (message) => {
  // Only process if targetChannelId is specified or any channel if empty
  if (targetChannelId && message.channelId !== targetChannelId) {
    return;
  }

  if (message.embeds && message.embeds.length > 0) {
    const embed = message.embeds[0];
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] 📥 ได้รับข้อมูลจากเกม: "${embed.title || 'Event'}"`);

    const payload = {
      content: message.content || '',
      embeds: message.embeds.map((e) => ({
        title: e.title,
        description: e.description,
        color: e.color,
        fields: e.fields?.map((f) => ({
          name: f.name,
          value: f.value,
          inline: f.inline,
        })),
        footer: e.footer ? { text: e.footer.text } : undefined,
        timestamp: e.timestamp,
      })),
    };

    try {
      const res = await fetch(webAppUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log(`   ✨ บันทึกลง Web Dashboard สำเร็จ!`);
      } else {
        console.error(`   ⚠️ Web App ตอบกลับสถานะ: ${res.status}`);
      }
    } catch (err) {
      console.error(`   ❌ เชื่อมต่อ Web App ล้มเหลว: ${err.message}`);
    }
  }
});

client.login(token);
