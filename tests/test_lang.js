// 墨龍飛天：語言測試 — 字形（繁／簡）× 翻譯（西／英／只有中文）× 讀音（拼音／注音／兩個／關），檢查主選單、遊戲中、暫停、結算畫面
const T = require('./common');
const { ok, THEMES, ZH } = T;
const food = THEMES.find(t => t.id === 'food');
const ALLW = THEMES.flatMap(t => t.words);

// 標準答案（照 index.html 的 I18N 表，自己手寫，不是從網頁讀出來）
const L = {
  title:   { trad: '墨龍飛天', simp: '墨龙飞天', es: 'El dragón de tinta', en: 'Ink Dragon' },
  start:   { trad: '開始飛', simp: '开始飞', es: 'Empezar', en: 'Start' },
  choose:  { trad: '選一個主題', simp: '选一个主题', es: 'Elige un tema', en: 'Pick a theme' },
  name:    { trad: '你的名字', simp: '你的名字', es: 'Tu nombre', en: 'Your name' },
  teacher: { trad: '老師管理中心', simp: '老师管理中心', es: 'Centro para profesores', en: 'Teacher center' },
  chip:    { trad: '只吃：', simp: '只吃：', es: 'Solo come: ', en: 'Only eat: ' },
  pause:   { trad: '暫停', simp: '暂停', es: 'Pausa', en: 'Paused' },
  resume:  { trad: '繼續', simp: '继续', es: 'Continuar', en: 'Resume' },
  toMenu:  { trad: '主選單', simp: '主选单', es: 'Menú principal', en: 'Main menu' },
  score:   { trad: '得分', simp: '得分', es: 'Puntos', en: 'Score' },
  again:   { trad: '再飛一次', simp: '再飞一次', es: 'Volar otra vez', en: 'Fly again' },
  eaten:   { trad: '吃對', simp: '吃对', es: 'Aciertos', en: 'Correct' },
  best:    { trad: '最高分', simp: '最高分', es: 'Récord', en: 'Best' },
  revT:    { trad: '複習清單', simp: '复习清单', es: 'Para repasar', en: 'To review' },
};
const THN = { food: ['食物', '食物', 'Comida', 'Food'], animal: ['動物', '动物', 'Animales', 'Animals'], color: ['顏色', '颜色', 'Colores', 'Colors'] };
// 雙行：上面中文，下面小字（只有中文就一行）
const two = (key, script, lang) => { const z = L[key][script]; const s = lang === 'zh' ? '' : L[key][lang]; return (z + (s ? ' ' + s : '')).trim(); };

const COMBOS = [
  { script: 'trad', lang: 'es', phon: 'pinyin' }, { script: 'trad', lang: 'en', phon: 'zhuyin' }, { script: 'trad', lang: 'zh', phon: 'both' },
  { script: 'simp', lang: 'es', phon: 'off' }, { script: 'simp', lang: 'en', phon: 'pinyin' }, { script: 'simp', lang: 'zh', phon: 'zhuyin' },
];
const BOPOMOFO = /[ㄅ-ㄯ]/;

(async () => {
  const browser = await T.launch();

  for(const c of COMBOS){
    const tag = '[' + c.script + '/' + c.lang + '/' + c.phon + ']';
    console.log('\n' + tag + ' 主選單 → 遊戲 → 暫停 → 結算 → 複習清單');
    // 視窗矮一點，字很快就會掉出去（變成「漏掉」的字），才有複習清單可以檢查
    const { page, ctx, errors } = await T.open(browser, { h: 420, ls: { [T.KEY]: JSON.stringify(Object.assign({ v: 1, rate: 'fast' }, c)) } });
    // 主選單
    const h1 = await T.txt(page, '#menu h1');
    ok(h1 === two('title', c.script, c.lang), tag + ' 標題：' + two('title', c.script, c.lang), h1);
    ok(await T.txt(page, '#startBtn') === two('start', c.script, c.lang), tag + ' 開始鈕', await T.txt(page, '#startBtn'));
    ok(await T.txt(page, '#menu .lbl') === two('choose', c.script, c.lang), tag + ' 「選一個主題」', await T.txt(page, '#menu .lbl'));
    ok(await T.txt(page, '#teacherLink') === two('teacher', c.script, c.lang), tag + ' 老師管理中心按鈕', await T.txt(page, '#teacherLink'));
    const nameLbl = await page.$$eval('#menu .lbl', es => es[1].innerText.replace(/\s+/g, ' ').trim());
    ok(nameLbl === two('name', c.script, c.lang), tag + ' 「你的名字」標籤', nameLbl);
    const tb = (await T.themeBtns(page)).map(b => b.t);
    const exp = ['food', 'animal', 'color'].map(id => (c.script === 'simp' ? THN[id][1] : THN[id][0]) + (c.lang === 'zh' ? '' : ' ' + THN[id][c.lang === 'es' ? 2 : 3]));
    ok(JSON.stringify(tb) === JSON.stringify(exp), tag + ' 三個主題按鈕的名稱', { tb, exp });
    ok(await page.evaluate(() => document.documentElement.lang) === (c.script === 'simp' ? 'zh-Hans' : 'zh-Hant'), tag + ' <html lang> 跟著字形');
    ok(await page.title() === L.title[c.script], tag + ' 網頁標題', await page.title());

    // 遊戲中
    await T.startPlay(page, 'Lang');
    await T.watchItems(page);
    const chip = await T.txt(page, '#themeChip');
    const expChip = (L.chip[c.script] + (c.script === 'simp' ? THN.food[1] : THN.food[0])) + (c.lang === 'zh' ? '' : ' ' + L.chip[c.lang].trim() + ' ' + THN.food[c.lang === 'es' ? 2 : 3]);
    ok(chip.replace(/\s+/g, '') === expChip.replace(/\s+/g, ''), tag + ' 左上角標籤', { chip, expChip });
    ok((await T.txt(page, '#altNum')).startsWith('高度'), tag + ' 高度顯示');
    // 暫停畫面
    await page.click('#pauseBtn');
    ok(await T.txt(page, '#pauseScr .card > div:first-child') === two('pause', c.script, c.lang), tag + ' 暫停標題', await T.txt(page, '#pauseScr .card > div:first-child'));
    ok(await T.txt(page, '#resumeBtn') === two('resume', c.script, c.lang), tag + ' 繼續鈕', await T.txt(page, '#resumeBtn'));
    ok(await T.txt(page, '#pauseMenuBtn') === two('toMenu', c.script, c.lang), tag + ' 暫停裡的「主選單」鈕');
    await page.click('#resumeBtn');
    // 等到有「漏掉」或「吃錯」的字
    await page.waitForFunction(() => { const r = window.__dragon.review; return r.miss.length + r.wrong.length > 0; }, null, { timeout: 12000 }).catch(() => {});
    const s = await T.seen(page);
    const wordsSet = new Set(ZH(food, c.script === 'simp'));
    const allSet = new Set(ALLW.map(w => c.script === 'simp' ? w[1] : w[0]));
    const keys = Object.keys(s);
    ok(keys.length >= 2 && keys.every(k => allSet.has(k)), tag + ' 飛過的字都是「' + (c.script === 'simp' ? '簡體' : '繁體') + '」寫法', keys.filter(k => !allSet.has(k)));
    const other = new Set(ALLW.map(w => c.script === 'simp' ? w[0] : w[1]).filter(x => !allSet.has(x)));
    ok(keys.every(k => !other.has(k)), tag + ' 沒有另一種字形混進來', keys.filter(k => other.has(k)));
    await T.toResult(page).catch(async () => { await page.waitForSelector('#res:not([hidden])', { timeout: 5000 }); });
    await page.waitForTimeout(800);
    // 結算畫面
    ok(await T.txt(page, '#res .lbl') === two('score', c.script, c.lang), tag + ' 結算「得分」', await T.txt(page, '#res .lbl'));
    ok(await T.txt(page, '#againBtn') === two('again', c.script, c.lang), tag + ' 「再飛一次」', await T.txt(page, '#againBtn'));
    ok(await T.txt(page, '#toMenuBtn') === two('toMenu', c.script, c.lang), tag + ' 結算「主選單」');
    const stat = await T.txt(page, '#resStat');
    ok(stat.includes(L.eaten[c.script]) && stat.includes(L.best[c.script]) && stat.includes('高度'), tag + ' 結算統計列用對字形', stat);
    ok(await T.txt(page, '#revT') === two('revT', c.script, c.lang), tag + ' 複習清單標題', await T.txt(page, '#revT'));
    // 複習清單：字形、讀音、翻譯
    const rows = await page.$$eval('#revList .rv', rs => rs.map(r => ({ w: r.querySelector('.w').textContent, span: (r.querySelector('.m span') || {}).textContent || null, small: (r.querySelector('.m small') || {}).textContent || null })));
    ok(rows.length >= 1, tag + ' 複習清單至少 1 列', rows);
    for(const r of rows){
      const w = ALLW.find(x => (c.script === 'simp' ? x[1] : x[0]) === r.w);
      if(!w){ ok(false, tag + ' 複習字找得到字庫：' + r.w); continue; }
      if(c.phon === 'off') ok(r.span === null, tag + ' ' + r.w + ' 讀音關閉：沒有讀音', r);
      else if(c.phon === 'pinyin') ok(r.span === w[2], tag + ' ' + r.w + ' 拼音＝' + w[2], r);
      else if(c.phon === 'zhuyin') ok(r.span && BOPOMOFO.test(r.span) && !/[a-z]/i.test(r.span), tag + ' ' + r.w + ' 注音（沒有英文字母）', r);
      else ok(r.span && r.span.startsWith(w[2]) && BOPOMOFO.test(r.span), tag + ' ' + r.w + ' 拼音＋注音都有', r);
      if(c.lang === 'zh') ok(r.small === null, tag + ' ' + r.w + ' 只有中文：沒有翻譯', r);
      else ok(r.small === (c.lang === 'es' ? w[3] : w[4]), tag + ' ' + r.w + ' 翻譯＝' + (c.lang === 'es' ? w[3] : w[4]), r);
    }
    ok(errors.length === 0, tag + ' 沒有程式錯誤', errors);
    await ctx.close();
  }

  console.log('\n[L2] 在遊戲裡（暫停 → 設定）即時換語言，畫面立刻跟著變，且不動共用設定的語速');
  { const { page, ctx } = await T.open(browser, { ls: { [T.KEY]: JSON.stringify({ v: 1, script: 'trad', lang: 'es', phon: 'pinyin', rate: 'slow' }) } });
    await T.startPlay(page, 'Live');
    await page.click('#pauseBtn');
    await page.click('#pauseSetBtn');
    ok(await T.visible(page, '#dlg'), '暫停裡可以開設定');
    ok(await T.txt(page, '#dlg .card > div:first-child') === '基本設定 Ajustes', '設定標題（繁／西）', await T.txt(page, '#dlg .card > div:first-child'));
    await page.click('#gLang .opt[data-v="en"]');
    ok(await T.txt(page, '#dlg .card > div:first-child') === '基本設定 Settings', '改英文：設定標題變 Settings', await T.txt(page, '#dlg .card > div:first-child'));
    ok((await T.txt(page, '#themeChip')).includes('Only eat: Food'), '改英文：左上角標籤變英文', await T.txt(page, '#themeChip'));
    await page.click('#gScript .opt[data-v="simp"]');
    ok(await T.txt(page, '#dlg .card > div:first-child') === '基本设定 Settings', '改簡體：設定標題變簡體', await T.txt(page, '#dlg .card > div:first-child'));
    await page.click('#gLang .opt[data-v="zh"]');
    ok(await T.txt(page, '#themeChip') === '只吃：食物', '改只有中文：標籤只剩一行', await T.txt(page, '#themeChip'));
    const sv = await T.settings(page);
    ok(sv.script === 'simp' && sv.lang === 'zh' && sv.rate === 'slow' && sv.phon === 'pinyin', '共用設定寫入新值、語速不變', sv);
    ok(await page.$eval('#gLang .opt[data-v="zh"]', e => e.classList.contains('on')) && await page.$eval('#gScript .opt[data-v="simp"]', e => e.classList.contains('on')), '設定視窗的選中狀態正確');
    await page.click('#dlgDone');
    ok(await T.visible(page, '#pauseScr') && (await T.txt(page, '#resumeBtn')) === '继续', '關掉設定回到暫停畫面，繼續鈕已是簡體「继续」', await T.txt(page, '#resumeBtn'));
    await ctx.close(); }

  console.log('\n[L3] 主選單換語言：重新整理後仍記得');
  { const { page, ctx } = await T.open(browser);
    await page.click('#menuGear'); await page.click('#gLang .opt[data-v="en"]'); await page.click('#gPhon .opt[data-v="zhuyin"]'); await page.click('#dlgDone');
    ok(await T.txt(page, '#startBtn') === '開始飛 Start', '主選單立刻變英文', await T.txt(page, '#startBtn'));
    await page.reload(); await page.waitForFunction(() => !!window.__dragon); await page.waitForTimeout(500);
    ok(await T.txt(page, '#startBtn') === '開始飛 Start', '重新整理後仍是英文');
    const sv = await T.settings(page); ok(sv && sv.lang === 'en' && sv.phon === 'zhuyin', '共用設定記得 英文＋注音', sv);
    await ctx.close(); }

  await T.finish(browser);
})().catch(e => { console.error(e); process.exit(1); });
