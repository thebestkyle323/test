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
  const ranks = [
    '0️⃣1️⃣', '0️⃣2️⃣', '0️⃣3️⃣', '0️⃣4️⃣', '0️⃣5️⃣', '0️⃣6️⃣', '0️⃣7️⃣', '0️⃣8️⃣', '0️⃣9️⃣', '1️⃣0️⃣',
    '1️⃣1️⃣', '1️⃣2️⃣', '1️⃣3️⃣', '1️⃣4️⃣', '1️⃣5️⃣', '1️⃣6️⃣', '1️⃣7️⃣', '1️⃣8️⃣', '1️⃣9️⃣', '2️⃣0️⃣',
    '2️⃣1️⃣', '2️⃣2️⃣', '2️⃣3️⃣', '2️⃣4️⃣', '2️⃣5️⃣', '2️⃣6️⃣', '2️⃣7️⃣', '2️⃣8️⃣', '2️⃣9️⃣', '3️⃣0️⃣',
    '3️⃣1️⃣', '3️⃣2️⃣', '3️⃣3️⃣', '3️⃣4️⃣', '3️⃣5️⃣', '3️⃣6️⃣', '3️⃣7️⃣', '3️⃣8️⃣', '3️⃣9️⃣', '4️⃣0️⃣',
    '4️⃣1️⃣', '4️⃣2️⃣', '4️⃣3️⃣', '4️⃣4️⃣', '4️⃣5️⃣', '4️⃣6️⃣', '4️⃣7️⃣', '4️⃣8️⃣', '4️⃣9️⃣', '5️⃣0️⃣'
  ];

  // 过滤掉带有推广的信息
  const filteredData = data.filter(o => !o.promotion);

  const text = filteredData.splice(1, 50).map((o, i) => {
    const containerid = encodeURIComponent(
      new URL(o.scheme).searchParams.get('containerid'),
    );
    const url = `https://m.weibo.cn/search?containerid=${containerid}`;

    // 检查 desc_extr 是否为有效数字
    const hotValue = parseFloat(o.desc_extr);
    const hotText = isNaN(hotValue) ? '' : `| ${(hotValue / 10000).toFixed(2)} 万`;

    if (ranks[i]) {
      return `${ranks[i]} [${o.desc}](${url}) ${hotText}`;
    }
  }).filter(Boolean); // 过滤掉任何 undefined 值

  text.unshift(
    `**微博实时热搜** ${dayjs().format(
      'YYYY-MM-DD HH:mm:ss',
    )} ([查看更多]())\n`,
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
