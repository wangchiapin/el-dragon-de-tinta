// 墨龍飛天：主題測試 — 公開 3 個主題、老師才有的 7 個主題，每個都開一局，檢查「該吃的字」真的來自該主題
const T = require('./common');
const { ok, THEMES, ZH } = T;
const PUBLIC = ['food', 'animal', 'color'];
const TEACHER_ONLY = ['fruit', 'transport', 'body', 'clothes', 'job', 'weather', 'home'];
const byId = id => THEMES.find(t => t.id === id);

// 玩約 3.5 秒，記下出現過的字，檢查：該吃的字都屬於這個主題；干擾字都不屬於這個主題
async function playAndCheck(page, id, label){
  const th = byId(id), mine = new Set(ZH(th, false));
  await T.startPlay(page, 'Tester');
  await page.evaluate(() => window.__dragon.setScore(40));
  await T.watchItems(page);
  await page.waitForTimeout(4500);
  const s = await T.seen(page);
  const good = Object.keys(s).filter(k => s[k].good), bad = Object.keys(s).filter(k => s[k].bad);
  ok(good.length >= 1, label + '：畫面上出現至少 1 個該吃的字', good);
  ok(good.every(g => mine.has(g)), label + '：所有該吃的字都在「' + th.name[0] + '」字庫裡', good.filter(g => !mine.has(g)));
  ok(bad.every(b => !mine.has(b)), label + '：干擾字沒有混進本主題的字', bad.filter(b => mine.has(b)));
  const others = new Set(THEMES.filter(t => t.id !== id).flatMap(t => ZH(t, false)));
  ok(bad.every(b => others.has(b)), label + '：干擾字都來自其他主題', bad.filter(b => !others.has(b)));
  ok(await page.evaluate(i => document.getElementById('themeChip').innerText.includes(i), th.name[0]), label + '：左上角標籤寫「只吃：' + th.name[0] + '」');
  await T.toResult(page);
  ok(await page.evaluate(k => !!localStorage.getItem(k), 'dragonInk.best.' + id), label + '：最高分記在 dragonInk.best.' + id);
}

(async () => {
  const browser = await T.launch();

  console.log('\n[T1] 公開頁：食物／動物／顏色各玩一局，字來自所選主題');
  for(const id of PUBLIC){
    const { page, ctx, errors } = await T.open(browser);
    const names = await T.themeBtns(page);
    ok(names.length === 3 && names.some(n => n.t.startsWith(byId(id).name[0])), '[' + id + '] 公開頁有 3 個主題按鈕，含「' + byId(id).name[0] + '」', names);
    const idx = THEMES.filter(t => PUBLIC.includes(t.id)).findIndex(t => t.id === id);
    await page.click('#themeGrid button:nth-child(' + (idx + 1) + ')');
    const after = await T.themeBtns(page);
    ok(after.filter(n => n.on).length === 1 && after[idx].on, '[' + id + '] 點了之後只有它被標成選中', after);
    ok(await page.evaluate(() => localStorage.getItem('dragonInk.theme')) === id, '[' + id + '] 選擇記在 dragonInk.theme');
    await playAndCheck(page, id, '[' + id + ']');
    await page.waitForTimeout(700);
    const boards = await T.db(page, T.M);
    const keys = Object.keys(boards).filter(k => k.startsWith('inkdragon_boards/'));
    ok(keys.length === 1 && keys[0] === 'inkdragon_boards/' + id + '/entries', '[' + id + '] 分數只進這個主題的公開排行榜', keys);
    ok(errors.length === 0, '[' + id + '] 沒有程式錯誤', errors);
    await ctx.close();
  }

  console.log('\n[T2] 記住上次選的主題；公開頁無法靠舊紀錄選到老師才有的主題');
  { const { page, ctx } = await T.open(browser);
    await page.click('#themeGrid button:nth-child(2)');   // 動物
    await page.reload(); await page.waitForFunction(() => !!window.__dragon); await page.waitForTimeout(500);
    const b = await T.themeBtns(page);
    ok(b[1].on && !b[0].on && !b[2].on, '重新整理後仍選著「動物」', b);
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { ls: { 'dragonInk.theme': 'fruit' } });
    const b = await T.themeBtns(page);
    ok(b.length === 3 && b.filter(x => x.on).length === 1, '舊紀錄是老師主題（水果）時，公開頁仍只有 3 個主題、有一個選中', b);
    ok((await T.txt(page, '#themeChip')).includes('食物'), '自動退回第一個公開主題「食物」', await T.txt(page, '#themeChip'));
    await ctx.close(); }

  console.log('\n[T3] 老師才有的 7 個主題：各用 ?th= 開一局，字來自該主題');
  for(const id of TEACHER_ONLY){
    const { page, ctx, errors } = await T.open(browser, { qs: '?th=' + id });
    const names = await T.themeBtns(page);
    ok(names.length === 1 && names[0].on && names[0].t.startsWith(byId(id).name[0]), '[' + id + '] 只列一個主題「' + byId(id).name[0] + '」且已選中', names);
    await playAndCheck(page, id, '[' + id + ']');
    await page.waitForTimeout(500);
    ok(Object.keys((await T.db(page, T.M))).filter(k => k.startsWith('inkdragon_boards/')).length === 0, '[' + id + '] 練習連結不進公開排行榜');
    ok(Object.keys((await T.db(page, T.C)).class_scores || {}).length === 0, '[' + id + '] 練習連結不寫班級成績');
    ok(errors.length === 0, '[' + id + '] 沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[T4] 一個連結同時開 7 個老師主題：按鈕齊全、逐一切換');
  { const { page, ctx } = await T.open(browser, { qs: '?th=' + TEACHER_ONLY.join('-') });
    const names = await T.themeBtns(page);
    ok(names.length === 7, '列出 7 個主題', names);
    ok(TEACHER_ONLY.every((id, i) => names.some(n => n.t.startsWith(byId(id).name[0]))), '7 個主題名稱都在');
    ok(!names.some(n => /^(食物|動物|顏色)/.test(n.t)), '沒有混進沒指定的公開主題');
    let allOk = true; const bad = [];
    const ids = THEMES.filter(t => TEACHER_ONLY.includes(t.id)).map(t => t.id);
    for(let i = 0; i < names.length; i++){
      await page.click('#themeGrid button:nth-child(' + (i + 1) + ')');
      const now = await T.themeBtns(page);
      await page.click('#startBtn'); await page.waitForFunction(() => window.__dragon.state.state === 'play');
      const chip = await T.txt(page, '#themeChip');
      if(!(now[i].on && now.filter(n => n.on).length === 1 && chip.includes(byId(ids[i]).name[0]))){ allOk = false; bad.push([i, chip]); }
      await page.click('#pauseBtn'); await page.click('#pauseMenuBtn');
    }
    ok(allOk, '逐一點 7 個主題並開始：選中狀態與遊戲中的「只吃：…」標籤都對', bad);
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { qs: '?th=fruit-nosuchtheme' });
    ok((await T.themeBtns(page)).length === 1, '連結裡不存在的主題代碼會被忽略，只留 1 個（水果）'); await ctx.close(); }

  await T.finish(browser);
})().catch(e => { console.error(e); process.exit(1); });
