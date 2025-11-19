
/* Express server that proxies /api/generateStory to xAI Grok chat completions */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const { getUserKeyFromHeaders, getCredits, addCredits, deductCredits } = require('./services/credits-sqlite');
const healthRouter = require('./routes/health');
const apiRouter = require('./routes/api');


const { Telegraf, Markup } = require('telegraf');
const TelegramBot = require('node-telegram-bot-api');
const USE_NODE_TELEGRAM_API = process.env.USE_NODE_TELEGRAM_API === 'true';

const { USE_TELEGRAM_STARS, PAYMENT_PROVIDER_TOKEN, CREDIT_PACK_STARS, CREDIT_PACK_AMOUNT, COST_PER_STORY } = require('./constants');

// Express app setup (top-level)
const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));


// 新增：非法 JSON 统一返回 400，而不是 HTML 错误页
app.use((err, req, res, next) => {
  // body-parser 的非法 JSON会进入这里
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON payload',
      hint: '请使用合法 JSON：键/字符串用双引号，逗号位置正确，无尾逗号。'
    });
  }
  next(err);
});

app.use('/health', healthRouter);
app.use('/api', apiRouter);

// Telegraf Telegram Bot 集成（长轮询）
const tgToken = process.env.TELEGRAM_BOT_TOKEN;
if (tgToken && !USE_NODE_TELEGRAM_API) {
  const bot = new Telegraf(tgToken);
  console.log('[telegram] telegraf bot started (polling)');

  bot.start(async (ctx) => {
    await ctx.reply('嗨，我是 ShadowDraft Telegraf Bot。\n直接发我一句话，我会帮你生成或续写内容（中文）。');
  });

  bot.on('text', async (ctx) => {
    const userText = ctx.message?.text?.trim() || '';
    const chatId = ctx.chat?.id;

    console.log('[telegram] received text:', userText);

    // 新增判断：仅拦截 /addfunds /balance /helps，其它 /xxxx 不 return
  if (userText.startsWith('/')) {
    const firstToken = userText.split(/\s+/)[0];
    const commandName = firstToken.split('@')[0].toLowerCase();
    const passthrough = new Set(['/addfunds', '/balance', '/helps']);
    if (passthrough.has(commandName)) {
      return; // 这三个命令交给命令处理器
    }
    // 未命中的其它 /xxxx，将继续走 generateStory 的逻辑
  }
    if (!userText) {
      return ctx.reply('我暂时只能处理文本消息~');
    }

    try {
      await ctx.reply('收到啦，我在思考中……');

      const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000/api/generateStory';
      const headers = {
        'Content-Type': 'application/json',
        'X-User-Email': process.env.TELEGRAM_USER_EMAIL || 'you@example.com'
      };

      const payload = {
        prompt: userText,
        max_words: 800,
        target_language: 'zh',
        mode: 'generate'
      };

      const { data } = await axios.post(apiUrl, payload, { headers, timeout: 60000 });
      const title = data?.title || '生成结果';
      const content = data?.content || '';

      const reply = `【${title}】\n${content}`;
      const maxChunk = 3500;
      if (reply.length <= maxChunk) {
        await ctx.reply(reply);
      } else {
        for (let i = 0; i < reply.length; i += maxChunk) {
          await ctx.reply(reply.slice(i, i + maxChunk));
        }
      }
    } catch (err) {
      console.error('[telegram] telegraf error:', err?.response?.data || err?.message || err);
      await ctx.reply('后端好像出了点问题（可能是 API 或模型），稍后再试试~');
    }
  });

  bot.command('addfunds', async (ctx) => {
    try {
      console.log('[telegram] /addfunds command received');
      const userId = ctx.from?.id;
      const defaultOrigin = 'http://localhost:3000';
      const origin = (() => {
        try {
          return new URL(process.env.API_BASE_URL || defaultOrigin).origin;
        } catch (_) {
          return defaultOrigin;
        }
      })();
      const url = `${origin}/api/credits/add`;
      const headers = {
        'Content-Type': 'application/json',
        'X-Telegram-User-Id': String(userId)
      };
      const { data } = await axios.post(url, { amount: 100 }, { headers, timeout: 15000 });
      await ctx.reply(`已为你充值 ${data.added} 点，当前余额：${data.balance}`);
    } catch (err) {
      console.error('[telegram] telegraf /addfunds error:', err?.response?.data || err?.message || err);
      await ctx.reply('充值失败，请稍后再试。');
    }
  });

  // 新增：/balance 命令（查询余额）
  bot.command('balance', async (ctx) => {
    try {
      console.log('[telegram] /balance command received');
      const userId = ctx.from?.id;
      const defaultOrigin = 'http://localhost:3000';
      const origin = (() => {
        try {
          return new URL(process.env.API_BASE_URL || defaultOrigin).origin;
        } catch (_) {
          return defaultOrigin;
        }
      })();
      const url = `${origin}/api/credits/balance`;
      const headers = { 'X-Telegram-User-Id': String(userId) };
      const { data } = await axios.get(url, { headers, timeout: 15000 });
      await ctx.reply(`当前余额：${data.balance} 点`);
    } catch (err) {
      console.error('[telegram] telegraf /balance error:', err?.response?.data || err?.message || err);
      await ctx.reply('查询失败，请稍后再试。');
    }
  });

  // 新增：/helps 命令（返回帮助文本）
  bot.command('helps', async (ctx) => {
    try {
      console.log('[telegram] /helps command received');
      await ctx.reply('helps');
    } catch (err) {
      console.error('[telegram] telegraf /helps error:', err?.response?.data || err?.message || err);
      await ctx.reply('查询失败，请稍后再试。');
    }
  });

  // 在启动轮询前清理 webhook，并丢弃积压更新，避免冲突
  (async () => {
    try {
      await bot.telegram.deleteWebhook({ drop_pending_updates: true });
      await bot.launch();
      console.log('ShadowDraft Telegraf Bot is running...');
    } catch (err) {
      console.error('[telegram] failed to launch telegraf:', err?.response?.data || err?.message || err);
    }
  })();

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.warn('[telegram] TELEGRAM_BOT_TOKEN 未配置，跳过 Telegraf 集成。');
}

const port = Number(process.env.PORT) || 3000;
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`[shadow-draft-chatbot] listening on http://localhost:${port}`);
});
server.on('error', (err) => {
  console.error('Failed to start server:', err && err.code ? err.code : err);
});
