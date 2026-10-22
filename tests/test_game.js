// 墨龍飛天的自動測試：主選單與老師管理中心按鈕、設定、班級／練習／範圍連結、一局到結算、排行榜寫入
// 用法：node tests/run.js（或設定 BASE_URL 後直接執行這個檔）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const KEY = 'hanziGames.settings';
const HOME = 'https://wangchiapin.github.io/profesor/#/home';
let pass = 0, fail = 0;
function ok(c, name, extra){ if(c){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } }

const C = 'subscription-48d3c', M = 'memorma-24dab';
const CID = 'classdrag0001', SET = 'setdrag00001';
const WORDS = ['甲\t甲\tjiǎ\ta\ta', '乙\t乙\tyǐ\tb\tb', '丙\t丙\tbǐng\tc\tc', '丁\t丁\tdīng\td\td', '戊\t戊\twù\te\te', '己\t己\tjǐ\tf\tf'];
const SEED = {
  [C]: {
    classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: true, updatedAt: 1 } },
    shared_dragon: { [SET]: { owner: 'u1', name: '範圍測試', builtin: ['food'], custom: [{ id: 'mytheme1', name: '我的主題', words: WORDS }], updatedAt: 1 } },
    class_scores: {}
  },
  [M]: {}
};

async function open(browser, { qs = '', ls = null, w = 390, h = 844 } = {}){
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return r.abort();
  });
  await page.addInitScript('window.__SEED=' + JSON.stringify(SEED) + ';');
  if(ls) await page.addInitScript('try{' + Object.keys(ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(ls[k]) + ');').join('') + '}catch(e){}');
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForFunction(() => !!window.__dragon, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, ctx, errors };
}
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const visible = (page, sel) => page.$eval(sel, e => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
const themes = page => page.$$eval('#themeGrid button', bs => bs.map(b => b.innerText.replace(/\s+/g, ' ').trim()));
const settings = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const db = (page, pid) => page.evaluate(p => window.__DB[p], pid);

(async () => {
  const browser = await chromium.launch();

  console.log('\n[1] 公開頁主選單與「老師管理中心」按鈕');
  { const { page, ctx, errors } = await open(browser);
    ok(await visible(page, '#teacherLink'), '公開頁有老師管理中心按鈕');
    ok(await page.$eval('#teacherLink', e => e.href) === HOME, '按鈕連到老師管理中心首頁 #/home', await page.$eval('#teacherLink', e => e.href));
    ok(await page.$eval('#teacherLink', e => e.classList.contains('ghost') && e.tagName === 'A'), '空心外框（ghost）的連結');
    ok((await txt(page, '#teacherLink')) === '老師管理中心 Centro para profesores', '雙行：中文＋西文', await txt(page, '#teacherLink'));
    const box = await page.$eval('#teacherLink', e => { const r = e.getBoundingClientRect(); const s = document.getElementById('startBtn').getBoundingClientRect(); return { top: r.top, startBottom: s.bottom, h: r.height, right: r.right, vw: innerWidth }; });
    ok(box.top >= box.startBottom && box.h >= 44 && box.right <= box.vw, '在「開始飛」下面、高度夠按、沒有超出畫面', box);
    ok((await themes(page)).length === 3, '公開頁只有 3 個主題', await themes(page));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[2] 設定：預設值、繁簡、語言');
  { const { page, ctx } = await open(browser);
    ok(await settings(page) === null, '沒有存過設定時用預設值（繁體、中＋西、拼音），不強迫寫入');
    ok((await txt(page, '#startBtn')) === '開始飛 Empezar', '預設介面：繁體＋西文', await txt(page, '#startBtn'));
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'fast', other: 'keep' }) } });
    await page.click('#menuGear');
    await page.click('#dlg [data-v="simp"], .opt[data-v="simp"]');
    await page.click('#dlgDone');
    const s = await settings(page);
    ok(s && s.script === 'simp' && s.lang === 'es', '在設定改成简体後，共用設定也跟著改', s);
    ok(s && s.rate === 'fast' && s.other === 'keep', '不會動到別款遊戲用的語速與其他欄位', s);
    ok((await txt(page, '#startBtn')).startsWith('开始飞'), '主選單立刻變簡體', await txt(page, '#startBtn'));
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'simp', lang: 'en', phon: 'zhuyin', rate: 'fast' }) } });
    ok((await txt(page, '#teacherLink')) === '老师管理中心 Teacher center', '簡體＋英文：老师管理中心／Teacher center', await txt(page, '#teacherLink'));
    ok((await txt(page, '#startBtn')).startsWith('开始飞'), '開始按鈕是簡體', await txt(page, '#startBtn'));
    await ctx.close(); }
  { const { page, ctx } = await open(browser, { ls: { [KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'zh', phon: 'off', rate: 'normal' }) } });
    ok((await txt(page, '#teacherLink')) === '老師管理中心', '只有中文：一行，沒有小字', await txt(page, '#teacherLink'));
    await ctx.close(); }

  console.log('\n[3] 練習連結 ?th=：不顯示老師按鈕、只列指定主題');
  { const { page, ctx, errors } = await open(browser, { qs: '?th=food-animal' });
    ok(!(await visible(page, '#teacherLink')), '練習連結看不到老師管理中心按鈕');
    ok((await themes(page)).length === 2, '只有 2 個主題', await themes(page));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[4] 練習範圍連結 ?d=：讀老師的範圍與自訂主題');
  { const { page, ctx, errors } = await open(browser, { qs: '?d=' + SET });
    await page.waitForFunction(() => document.querySelectorAll('#themeGrid button').length > 0, null, { timeout: 8000 }).catch(() => {});
    ok(!(await visible(page, '#teacherLink')), '範圍連結看不到老師管理中心按鈕');
    const t = await themes(page);
    ok(t.length === 2 && t.some(x => x.includes('我的主題')), '內建＋自訂主題各 1', t);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[5] 失效的連結');
  { const { page, ctx } = await open(browser, { qs: '?class=zzzzzzzz9999' });
    await page.waitForSelector('#fatal', { timeout: 8000 }).catch(() => {});
    const t = await page.$eval('#fatal', e => e.innerText).catch(() => '');
    ok(t.includes('這個連結已失效'), '班級碼不存在：顯示「這個連結已失效」', t);
    await ctx.close(); }

  console.log('\n[6] 班級連結：要名字、成績回傳、班級排行榜');
  { const { page, ctx, errors } = await open(browser, { qs: '?class=' + CID });
    await page.waitForFunction(() => !document.getElementById('classTag') || true);
    await page.waitForTimeout(800);
    ok(!(await visible(page, '#teacherLink')), '班級連結看不到老師管理中心按鈕');
    await page.click('#startBtn');
    ok(await page.$eval('#nameInp', e => e.classList.contains('need')), '沒填名字不能開始（輸入框標紅）');
    ok((await page.evaluate(() => window.__dragon.state.state)) !== 'play', '還沒開始遊戲');
    await page.fill('#nameInp', 'Ana');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__dragon.state.state === 'play', null, { timeout: 5000 });
    ok(true, '填名字後開始遊戲');
    await page.evaluate(() => window.__dragon.setScore(321));
    await page.evaluate(() => window.__dragon.endNow());
    await page.waitForSelector('#res:not([hidden])', { timeout: 5000 });
    ok((await txt(page, '#resScore')) === '321', '結果畫面顯示分數 321', await txt(page, '#resScore'));
    await page.waitForFunction(() => /回傳|Resultado enviado/.test(document.getElementById('lbBox').innerText), null, { timeout: 5000 }).catch(() => {});
    const msg = await txt(page, '#lbBox');
    ok(/成績已回傳|Resultado enviado/.test(msg), '顯示「成績已回傳給老師」', msg);
    const cs = (await db(page, C)).class_scores;
    const rec = Object.values(cs)[0];
    ok(Object.keys(cs).length === 1 && rec.cid === CID && rec.game === 'dragon' && rec.nick === 'Ana' && rec.best === 321 && rec.owner === 'u1', '成績寫進 class_scores（班級、遊戲、暱稱、分數、老師）', rec);
    ok(Object.keys(cs)[0].startsWith(CID + '_dragon_'), '文件編號是 班級碼_dragon_主題_雜湊', Object.keys(cs)[0]);
    ok(/Ana/.test(await txt(page, '#lbBox')), '班級有開排行榜：看得到自己', await txt(page, '#lbBox'));
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[7] 公開頁玩一局：結算、個人最高分、公開排行榜');
  { const { page, ctx, errors } = await open(browser);
    await page.fill('#nameInp', 'Beto');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__dragon.state.state === 'play', null, { timeout: 5000 });
    await page.evaluate(() => window.__dragon.setScore(150));
    await page.evaluate(() => window.__dragon.endNow());
    await page.waitForSelector('#res:not([hidden])', { timeout: 5000 });
    ok((await txt(page, '#resScore')) === '150', '結果畫面顯示分數 150', await txt(page, '#resScore'));
    ok(await visible(page, '#againBtn') && await visible(page, '#toMenuBtn'), '有「再玩一次」與「回主選單」');
    await page.waitForTimeout(800);
    const lb = (await db(page, M))['inkdragon_boards/food/entries'];
    const mine = lb && Object.values(lb)[0];
    ok(lb && Object.keys(lb).length === 1 && mine.name === 'Beto' && mine.score === 150, '分數寫進公開排行榜（inkdragon_boards/食物/entries，一台裝置一筆）', lb);
    ok(await page.evaluate(() => localStorage.getItem('dragonInk.best.food')) === '150', '個人最高分記在這台裝置');
    await page.click('#toMenuBtn');
    ok(await visible(page, '#teacherLink'), '回到主選單又看得到老師管理中心按鈕');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[8] 小螢幕（360×640）主選單放得下');
  { const { page, ctx } = await open(browser, { w: 360, h: 640 });
    const r = await page.$eval('#teacherLink', e => { const b = e.getBoundingClientRect(); const sc = document.getElementById('menu'); return { right: b.right, left: b.left, vw: innerWidth, scrollable: sc.scrollHeight >= sc.clientHeight }; });
    ok(r.left >= 0 && r.right <= r.vw, '按鈕沒有超出左右邊界', r);
    await page.$eval('#teacherLink', e => e.scrollIntoView());
    ok(await page.$eval('#teacherLink', e => { const b = e.getBoundingClientRect(); return b.bottom <= innerHeight; }), '捲動後完整看得到按鈕');
    await ctx.close(); }

  await browser.close();
  console.log('\n通過 ' + pass + '，失敗 ' + fail);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
