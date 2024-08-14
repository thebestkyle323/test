import fs from 'fs-extra';
import util from 'util';
import dayjs from 'dayjs';
import * as cheerio from 'cheerio';
import _ from 'lodash';
import telegraf from 'telegraf';

const { Telegraf } = telegraf;

const TOKEN = process.env.TOKEN;
const CHANNEL_ID_1 = process.env.CHANNEL_ID_1; // 第一个 Telegram 频道 ID

const TRENDING_URL =
  'https://m.weibo.cn/api/container/getIndex?containerid=106003type%3D25%26t%3D3%26disable_hot%3D1%26filter_type%3Drealtimehot';
const TRENDING_DETAIL_URL = 'https://m.s.weibo.com/topic/detail?q=%s';

// 提供一个固定的图片链接
const IMAGE_URL = 'https://app.iwanshare.club/uploads/20240814/cf643ec476d0a9afff266f7a18695bea.jpg'; // 替换成实际的图片链接

const bot = new Telegraf(TOKEN);

let RETRY_TIME = 5;

async function sendTgMessage(data) {
  const ranks = [
    '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.', '10.', '11.', '12.', '13.', '14.', '15.', '16.', '17.', '18.', '19.', '20.', '21.', '22.', '23.', '24.', '25.'
  ];

  // 过滤掉带有推广的信息
  const filteredData = data.filter(o => !o.promotion);

  const text = filteredData.splice(1, 25).map((o, i) => {
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
    )} ([查看更多](https://nav.iosfans.club))\n`,
  );

  // 将图片和文本一起发送到第一个频道
  await bot.telegram.sendPhoto(CHANNEL_ID_1, IMAGE_URL, {
    caption: text.join('\n'),
    parse_mode: 'Markdown',
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
