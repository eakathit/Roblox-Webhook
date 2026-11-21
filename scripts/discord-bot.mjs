import {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Events,
  PermissionFlagsBits,
  ChannelType,
  OverwriteType
} from 'discord.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_BOT_TOKEN || process.argv[2];
const WEB_APP_HOST = process.env.WEB_APP_HOST || 'http://localhost:3000';
const FARM_CATEGORY_NAME = process.env.DISCORD_FARM_CATEGORY || 'webhook-macro';

if (!token) {
  console.log('======================================================');
  console.log('🤖 ANIME CRUSADERS X - DISCORD COMMUNITY BOT');
  console.log('======================================================');
  console.log('⚠️  ยังไม่ได้ใส่ DISCORD_BOT_TOKEN');
  console.log('วิธีรัน: node scripts/discord-bot.mjs <YOUR_BOT_TOKEN>');
  console.log('======================================================');
  process.exit(0);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ],
  partials: [Partials.Channel, Partials.Message],
});

async function ensureFarmCategory(guild) {
  const existingCategory = guild.channels.cache.find(
    (channel) =>
      channel.type === ChannelType.GuildCategory &&
      channel.name.toLowerCase() === FARM_CATEGORY_NAME.toLowerCase()
  );

  if (existingCategory) return existingCategory;

  return guild.channels.create({
    name: FARM_CATEGORY_NAME,
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel],
      },
      {
        id: client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.ManageChannels,
          PermissionFlagsBits.ManageWebhooks,
        ],
      },
    ],
  });
}

function isFarmChannel(channel) {
  const name = channel.name?.toLowerCase() || '';
  return channel.type === ChannelType.GuildText &&
    (name.startsWith('🔒-farm-') || name.startsWith('farm-'));
}

async function migrateFarmChannels(guild, farmCategory) {
  const misplacedChannels = guild.channels.cache.filter(
    (channel) => isFarmChannel(channel) && channel.parentId !== farmCategory.id
  );

  let moved = 0;
  for (const channel of misplacedChannels.values()) {
    await channel.setParent(farmCategory.id, { lockPermissions: false });
    moved += 1;
  }
  return moved;
}

client.once(Events.ClientReady, async () => {
  console.log('======================================================');
  console.log(`🚀 บอทออนไลน์แล้ว: ${client.user.tag}`);
  console.log(`🤖 พร้อมดูแลระบบ ยืนยันตัวตน + สร้าง Webhook อัตโนมัติ`);
  console.log('======================================================');

  for (const guild of client.guilds.cache.values()) {
    try {
      await guild.channels.fetch();
      const farmCategory = await ensureFarmCategory(guild);
      const moved = await migrateFarmChannels(guild, farmCategory);
      console.log(`[farm-category] ${guild.name}: moved ${moved} channel(s) into ${FARM_CATEGORY_NAME}`);
    } catch (err) {
      console.error(`[farm-category] Failed to organize channels in ${guild.name}:`, err);
    }
  }
});

// Command dispatcher: พิมพ์ !setup-verify หรือ !setup-webhook ในห้องที่ต้องการ
client.on('messageCreate', async (message) => {
  if (message.author.bot) {
    // ดักจับข้อความจาก Webhook ของเกม
    if (message.embeds && message.embeds.length > 0) {
      handleGameWebhook(message);
    }
    return;
  }

  // คำสั่งสำหรับ Admin ตั้งค่าปุ่มในห้อง
  if (message.content === '!setup-verify') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ใช้คำสั่งนี้ได้');
    }

    const embed = new EmbedBuilder()
      .setColor(0x9333ea) // Purple
      .setTitle('⚔️ ยืนยันตัวตน | Anime Crusaders Tracker')
      .setDescription(
        'ยินดีต้อนรับสู่คอมมูนิตี้ **Anime Crusaders X Farm Tracker**!\n\n' +
        'กรุณากดปุ่มด้านล่างเพื่อยืนยันตัวตน รับยศ **Member** และปลดล็อกการเข้าใช้งานเซิร์ฟเวอร์ครับ\n\n' +
        '📌 *เมื่อยืนยันแล้ว คุณจะสามารถสร้างห้อง Webhook ส่วนตัวสำหรับฟาร์มในเกมได้ทันที*'
      )
      .setFooter({ text: 'Anime Crusaders X • Verification System' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_verify')
        .setLabel('✅ ยืนยันตัวตน (Verify)')
        .setStyle(ButtonStyle.Success)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    console.log('✨ ส่งการ์ดยืนยันตัวตนเรียบร้อย');
  }

  if (message.content === '!setup-webhook') {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('❌ เฉพาะผู้ดูแลระบบ (Admin) เท่านั้นที่ใช้คำสั่งนี้ได้');
    }

    const embed = new EmbedBuilder()
      .setColor(0xec4899) // Pink
      .setTitle('⚡ สร้าง Webhook ฟาร์มส่วนตัว (Anime Crusaders X)')
      .setDescription(
        'คลิกปุ่มด้านล่างเพื่อสร้างห้องฟาร์มและรับลิงก์ Webhook เฉพาะของคุณทันที!\n\n' +
        '🔒 **ความเป็นส่วนตัว:** บอทจะสร้างห้องลับเฉพาะคุณ (คนอื่นในเซิร์ฟมองไม่เห็น)\n' +
        '🎮 **ใช้งานง่าย:** นำลิงก์ไปวางในช่อง Webhook ในเกมได้เลย ไม่ติดสีแดง\n' +
        '📊 **มีหน้าเว็บ Dashboard:** ดูสรุปของดรอปและสถิติผ่านเว็บได้ทุกที่ทุกเวลา'
      )
      .setFooter({ text: 'Anime Crusaders X • Auto Webhook Generator' });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_create_webhook')
        .setLabel('⚡ สร้าง Webhook ฟาร์มของฉัน')
        .setStyle(ButtonStyle.Primary)
    );

    await message.channel.send({ embeds: [embed], components: [row] });
    await message.delete().catch(() => {});
    console.log('✨ ส่งการ์ดสร้าง Webhook เรียบร้อย');
  }
});

// จัดการเมื่อมีคนกดปุ่ม (Button Interactions)
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const guild = interaction.guild;
  const user = interaction.user;

  // 1. ปุ่มยืนยันตัวตน
  if (interaction.customId === 'btn_verify') {
    const memberRole = guild.roles.cache.find((r) => r.name === 'Member');
    if (!memberRole) {
      return interaction.reply({
        content: '⚠️ ไม่พบยศ "Member" ในเซิร์ฟเวอร์ กรุณาแจ้ง Admin',
        ephemeral: true,
      });
    }

    try {
      const member = await guild.members.fetch(user.id);
      if (member.roles.cache.has(memberRole.id)) {
        return interaction.reply({
          content: 'คุณมียศ Member และยืนยันตัวตนเรียบร้อยแล้วครับ!',
          ephemeral: true,
        });
      }

      await member.roles.add(memberRole);
      return interaction.reply({
        content: '🎉 **ยืนยันตัวตนสำเร็จแล้ว!** ปลดล็อกห้องในเซิร์ฟเวอร์เรียบร้อย ยินดีต้อนรับครับ',
        ephemeral: true,
      });
    } catch (err) {
      console.error('Error adding role:', err);
      return interaction.reply({
        content: '❌ เกิดข้อผิดพลาดในการให้ยศ (โปรดตรวจสอบว่ายศของบอทอยู่สูงกว่ายศ Member หรือไม่)',
        ephemeral: true,
      });
    }
  }

  // 2. ปุ่มสร้างห้อง Webhook ส่วนตัว
  if (interaction.customId === 'btn_create_webhook') {
    await interaction.deferReply({ ephemeral: true });

    const userKey = user.username.toLowerCase().replace(/[^a-z0-9]/g, '') || user.id;
    const channelName = `🔒-farm-${userKey}`;

    let farmCategory;
    try {
      await guild.channels.fetch();
      farmCategory = await ensureFarmCategory(guild);
    } catch (err) {
      console.error('Failed to create or find farm category:', err);
      return interaction.editReply({
        content: '❌ ไม่สามารถสร้างหรือเข้าถึงหมวด webhook-macro ได้ โปรดตรวจสอบสิทธิ์ Manage Channels ของบอท',
      });
    }

    // เช็คว่ามีห้องอยู่แล้วหรือไม่
    const existingChannel = guild.channels.cache.find(
      (c) => c.name === channelName && c.type === ChannelType.GuildText
    );

    let targetChannel = existingChannel;

    if (!targetChannel) {
      try {
        // หา Category หรือสร้างห้องแบบ Private
        targetChannel = await guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          parent: farmCategory.id,
          permissionOverwrites: [
            {
              id: guild.roles.everyone.id,
              deny: [PermissionFlagsBits.ViewChannel], // ซ่อนจากทุกคน
            },
            {
              id: user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.ReadMessageHistory,
              ],
              deny: [PermissionFlagsBits.SendMessages], // ดูได้อย่างเดียว ไม่ต้องพิมพ์
            },
            {
              id: client.user.id,
              allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageWebhooks,
              ],
            },
          ],
        });
      } catch (err) {
        console.error('Failed to create channel:', err);
        return interaction.editReply({
          content: '❌ ไม่สามารถสร้างห้องส่วนตัวได้ (โปรดตรวจสอบสิทธิ์ Manage Channels ของบอท)',
        });
      }
    }

    if (targetChannel.parentId !== farmCategory.id) {
      await targetChannel.setParent(farmCategory.id, { lockPermissions: false }).catch((err) => {
        console.error('Failed to move farm channel into category:', err);
      });
    }

    // สร้างหรือดึง Webhook ของห้องนั้น
    let webhook;
    try {
      const webhooks = await targetChannel.fetchWebhooks();
      webhook = webhooks.first();

      if (!webhook) {
        webhook = await targetChannel.createWebhook({
          name: `ACX-${user.username}`,
          avatar: client.user.displayAvatarURL(),
        });
      }
    } catch (err) {
      console.error('Failed to create webhook:', err);
      return interaction.editReply({
        content: '❌ ไม่สามารถสร้าง Webhook ได้ (โปรดตรวจสอบสิทธิ์ Manage Webhooks ของบอท)',
      });
    }

    const dashboardUrl = `${WEB_APP_HOST}/?user=${encodeURIComponent(userKey)}`;

    // ส่งข้อความต้อนรับในห้องส่วนตัว
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x10b981) // Green
      .setTitle(`🎮 ห้องฟาร์มส่วนตัวของคุณ: ${user.username}`)
      .setDescription(
        'ห้องนี้เป็นห้องลับเฉพาะคุณสำหรับรับแจ้งเตือนจากเกม **Anime Crusaders X**!\n\n' +
        '📋 **ลิงก์ Webhook สำหรับนำไปวางในเกม:**\n' +
        `\`\`\`text\n${webhook.url}\n\`\`\`\n` +
        '📊 **หน้าเว็บ Web Dashboard ดูสถิติและของดรอป:**\n' +
        `👉 [คลิกเปิด Web Dashboard ของคุณ](${dashboardUrl})\n\n` +
        '💡 *นำลิงก์ Webhook ด้านบนไปใส่ในเกม แล้วกด Enter จากนั้นเปิด Use webhook ปล่อยฟาร์มได้เลยครับ*'
      );

    await targetChannel.send({ embeds: [welcomeEmbed] });

    return interaction.editReply({
      content:
        `🎉 **สร้างห้องฟาร์มส่วนตัวสำเร็จแล้ว!**\n\n` +
        `📍 ห้องของคุณคือ: <#${targetChannel.id}>\n\n` +
        `🔗 **Webhook Link สำหรับใส่ในเกม:**\n\`${webhook.url}\`\n\n` +
        `📊 **ลิงก์ดูหน้าเว็บ Dashboard:**\n${dashboardUrl}`,
    });
  }
});

// ฟังก์ชันดักจับข้อความจาก Webhook ในเกม แล้วส่งต่อเข้า Web App
async function handleGameWebhook(message) {
  const embed = message.embeds[0];
  if (!embed) return;

  const channelName = message.channel.name || '';
  const isFarmChannel = channelName.startsWith('🔒-farm-') || channelName.startsWith('farm-');
  if (!isFarmChannel) return;

  const title = embed.title || '';
  // เช็คว่าเป็นข้อความจาก Macro ของเกมจริงไหม
  if (
    title.includes('Run Finished') ||
    title.includes('Rejoined') ||
    title.includes('Test') ||
    embed.footer?.text?.includes('Anime Crusaders')
  ) {
    console.log(`[${new Date().toLocaleTimeString('th-TH')}] 📥 ได้รับผลฟาร์มจากห้อง: #${message.channel.name} ("${title}")`);

    // ดึง User ID จากชื่อห้อง เช่น 🔒-farm-omgom
    const userId = channelName.replace('🔒-farm-', '').replace('farm-', '') || 'default';
    const ownerOverwrite = message.channel.permissionOverwrites.cache.find(
      (overwrite) => overwrite.type === OverwriteType.Member && overwrite.id !== client.user.id
    );
    const owner = ownerOverwrite
      ? await message.guild.members.fetch(ownerOverwrite.id).catch(() => null)
      : null;

    const payload = {
      content: message.content || '',
      trackerProfile: owner ? {
        displayName: owner.displayName || owner.user.username,
        avatarUrl: owner.user.displayAvatarURL({ extension: 'png', size: 128 }),
        discordUserId: owner.id,
      } : undefined,
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
      const res = await fetch(`${WEB_APP_HOST}/api/webhooks/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log(`   ✨ อัปเดตสถิติขึ้นหน้าเว็บ Dashboard ของ ${userId} เรียบร้อย!`);
      }
    } catch (err) {
      console.error('   ❌ ไม่สามารถส่งเข้า Web App ได้:', err.message);
    }
  }
}

client.login(token);
