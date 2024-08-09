import fs from 'fs-extra';
import util from 'util';
import dayjs from 'dayjs';
import * as cheerio from 'cheerio';
import _ from 'lodash';
import telegraf from 'telegraf';

const { Telegraf } = telegraf;

const TOKEN = process.env.TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;
const TRENDING_URL =
  'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot';
const TRENDING_DETAIL_URL = 'https://m.s.weibo.com/topic/detail?q=%s';

const bot = new Telegraf(TOKEN);

let RETRY_TIME = 5;

async function sendTgMessage(data) {
  const ranks = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣'];
  const text = data.splice(1, 30).map((o, i) => {
    const containerid = encodeURIComponent(
      new URL(o.scheme).searchParams.get('containerid'),
    );
    const url = `https://m.weibo.cn/search?containerid=${containerid}`;
    
    if (ranks[i]) {
      return `${ranks[i]} [${o.desc}](${url}) ${(o.desc_extr / 10000).toFixed(
        2,
      )} 万`;
    }
    return `🔥 [${o.desc}](${url}) ${(o.desc_extr / 10000).toFixed(2)} 万`;
  });
  text.unshift(
    `${dayjs().format(
      'YYYY-MM-DD HH:mm:ss',
    )} 的微博热搜([查看更多](https://nav.iosfans.club))`,
  );
  await bot.telegram.sendMessage(CHANNEL_ID, text.join('\n'), {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
  });
}

async function fetchTrendingDetail(title) {
  try {
    const res = await fetch(util.format(TRENDING_DETAIL_URL, title));
    const data = await res.text();
    const $ = cheerio.load(data);
    return {
      category: $('#pl_topicband dl>dd').first().text(),
      desc: $('#pl_topicband dl:eq(1)').find('dd:not(.host-row)').last().text(),
    };
  } catch {
    return {};
  }
}

async function bootstrap() {
  while (RETRY_TIME > 0) {
    try {
      const res = await fetch(TRENDING_URL);
      const data = await res.json();
      if (data.ok === 1) {
        const items = data.data.cards[0]?.card_group;
        if (items) {
          for (let item of items) {
            const { category, desc } = await fetchTrendingDetail(
              encodeURIComponent(item.desc),
            );
            item.category = category || item.category;
            item.description = desc || item.description;
          }
          await saveRawJson(items);
          await writeMDFile();
          await sendTgMessage(items);
        }
      }
      RETRY_TIME = 0;
    } catch (err) {
      console.log(err);
      RETRY_TIME -= 1;
    }
  }
  process.exit(0);
}

bootstrap();
