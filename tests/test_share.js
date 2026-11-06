// 墨龍飛天：結算畫面「分享成績」— 按鈕位置與顯示條件、一句話（暱稱／分數／主題、各語言）、連結、系統分享、複製備案
const T = require('./common');
const { ok, KEY } = T;
const URL_SHARE = 'https://wangchiapin.github.io/el-dragon-de-tinta/?ref=share';

// mode: ok＝系統分享成功；abort＝玩家自己關掉選單；error＝其他錯誤（應改走複製）；none＝瀏覽器不支援分享選單
async function stub(page, mode){
  await page.evaluate(m => {
    window.__shared = []; window.__copied = [];
    const def = (k, v) => Object.defineProperty(navigator, k, { value: v, configurable: true });
    def('share', m === 'none' ? undefined : async d => {
      window.__shared.push(d);
      if(m === 'abort'){ const e = new Error('cancel'); e.name = 'AbortError'; throw e; }
      if(m === 'error'){ const e = new Error('boom'); e.name = 'NotAllowedError'; throw e; }
    });
    def('clipboard', { writeText: async s => { window.__copied.push(s); } });
  }, mode);
}
const shared = page => page.evaluate(() => window.__shared);
const copied = page => page.evaluate(() => window.__copied);

(async () => {
  const browser = await T.launch();

  // 玩一局到結算：name 暱稱、score 分數
  async function result(opts, name, score){
    const r = await T.open(browser, opts);
    await T.startPlay(r.page, name);
    await r.page.evaluate(s => window.__dragon.setScore(s), score);
    await T.toResult(r.page);
    await r.page.waitForTimeout(800);   // 結算畫面延遲 600ms 才出現內容
    return r;
  }
  const L = (lang, script) => ({ ls: { [KEY]: JSON.stringify({ v: 1, script: script || 'trad', lang, phon: 'pinyin' }) } });

  console.log('\n[1] 按鈕：位置、樣式、0 分不顯示');
  { const { page, ctx, errors } = await result({}, 'Ana', 128);
    ok(await T.visible(page, '#shareBtn'), '有分數時看得到「分享成績」');
    ok(await page.$eval('#shareBtn', e => e.classList.contains('ghost')), '空心外框（ghost）');
    ok((await T.txt(page, '#shareBtn')) === '分享成績 Compartir resultado', '雙行：中文＋西文', await T.txt(page, '#shareBtn'));
    const y = await page.evaluate(() => { const t = id => document.getElementById(id).getBoundingClientRect().top; return [t('againBtn'), t('shareBtn'), t('toMenuBtn')]; });
    ok(y[0] < y[1] && y[1] < y[2], '順序：再飛一次 → 分享成績 → 主選單', y);
    ok(errors.length === 0, '沒有頁面錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await result({}, 'Ana', 0);
    ok(!(await T.visible(page, '#shareBtn')), '0 分不顯示分享鈕');
    await ctx.close(); }
  { const { page, ctx } = await result({}, 'Ana', 40);
    await page.click('#againBtn');
    await page.waitForFunction(() => window.__dragon.state.state === 'play', null, { timeout: 5000 });
    await T.toResult(page); await page.waitForTimeout(800);
    ok(!(await T.visible(page, '#shareBtn')), '再玩一局結果是 0 分時，分享鈕又收起來');
    await ctx.close(); }

  console.log('\n[2] 系統分享：一句話含暱稱、分數、主題；連結乾淨');
  { const { page, ctx, errors } = await result({}, 'Ana', 128);
    await stub(page, 'ok');
    await page.click('#shareBtn');
    await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s.length === 1, '呼叫一次系統分享', s);
    ok(s[0] && s[0].text === '¡Soy Ana y saqué 128 puntos en 墨龍飛天 (tema: comida)! ¿Puedes superarme?', '西文（預設）：含暱稱、分數、主題', s[0] && s[0].text);
    ok(s[0] && s[0].url === URL_SHARE, '連結是公開頁加 ?ref=share', s[0] && s[0].url);
    ok(s[0] && s[0].title === '墨龍飛天 · El dragón de tinta', '標題', s[0] && s[0].title);
    ok((await copied(page)).length === 0, '系統分享成功時不另外複製');
    ok(!(await txt(page)).includes('已複製'), '按鈕沒有跳出「已複製」');
    ok(errors.length === 0, '沒有頁面錯誤', errors);
    await ctx.close(); }
  async function txt(page){ return T.txt(page, '#shareBtn'); }

  console.log('\n[3] 沒填暱稱：句子省略暱稱');
  { const { page, ctx } = await result({}, '', 77);
    await stub(page, 'ok');
    await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && s[0].text === '¡Saqué 77 puntos en 墨龍飛天 (tema: comida)! ¿Puedes superarme?', '沒有「Soy …」', s[0] && s[0].text);
    await ctx.close(); }

  console.log('\n[4] 各語言：英文、只有中文（繁／簡）');
  { const { page, ctx } = await result(L('en'), 'Ana', 128);
    await stub(page, 'ok'); await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && s[0].text === 'I’m Ana and I scored 128 in 墨龍飛天 (theme: food)! Can you beat me?', '英文', s[0] && s[0].text);
    ok((await txt(page)) === '分享成績 Share score', '按鈕：中文＋英文', await txt(page));
    await ctx.close(); }
  { const { page, ctx } = await result(L('zh'), 'Ana', 128);
    await stub(page, 'ok'); await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && s[0].text === '我是Ana，在墨龍飛天（主題：食物）拿到 128 分！你能超過我嗎？', '只有中文（繁體）', s[0] && s[0].text);
    ok((await txt(page)) === '分享成績', '按鈕只有一行中文', await txt(page));
    await ctx.close(); }
  { const { page, ctx } = await result(L('zh', 'simp'), '', 128);
    await stub(page, 'ok'); await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && s[0].text === '我在墨龙飞天（主题：食物）拿到 128 分！你能超过我吗？', '只有中文（简体）、沒暱稱', s[0] && s[0].text);
    ok((await txt(page)) === '分享成绩', '简体按鈕', await txt(page));
    await ctx.close(); }
  { const { page, ctx } = await result(L('es', 'simp'), 'Ana', 9);
    ok((await txt(page)) === '分享成绩 Compartir resultado', '简体＋西文的按鈕', await txt(page));
    await ctx.close(); }

  console.log('\n[5] 不同主題：句子用該主題的名字');
  { const { page, ctx } = await T.open(browser);
    await page.click('#themeGrid button:nth-child(2)');
    await T.startPlay(page, 'Ana');
    await page.evaluate(() => window.__dragon.setScore(50)); await T.toResult(page); await page.waitForTimeout(800);
    await stub(page, 'ok'); await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && /\(tema: animales\)/.test(s[0].text), '第二個主題（動物）→ tema: animales', s[0] && s[0].text);
    await ctx.close(); }

  console.log('\n[6] 玩家自己關掉分享選單：什麼都不做');
  { const { page, ctx, errors } = await result({}, 'Ana', 128);
    await stub(page, 'abort');
    await page.click('#shareBtn'); await page.waitForTimeout(300);
    ok((await shared(page)).length === 1, '有叫出分享選單');
    ok((await copied(page)).length === 0, '沒有改走複製');
    ok(!(await txt(page)).includes('已複製') && (await txt(page)) === '分享成績 Compartir resultado', '按鈕文字不變', await txt(page));
    await page.click('#shareBtn'); await page.waitForTimeout(300);
    ok((await shared(page)).length === 2, '關掉之後還能再按一次（沒有卡住）');
    ok(errors.length === 0, '沒有頁面錯誤', errors);
    await ctx.close(); }

  console.log('\n[7] 不支援分享選單：複製「一句話＋連結」');
  { const { page, ctx, errors } = await result({}, 'Ana', 128);
    await stub(page, 'none');
    await page.click('#shareBtn'); await page.waitForTimeout(300);
    const c = await copied(page);
    ok(c.length === 1 && c[0] === '¡Soy Ana y saqué 128 puntos en 墨龍飛天 (tema: comida)! ¿Puedes superarme?\n' + URL_SHARE, '複製的內容是一句話換行加連結', c);
    ok((await txt(page)) === '已複製，貼到聊天室吧 Copiado: pégalo en tu chat', '按鈕短暫顯示「已複製」', await txt(page));
    await page.waitForTimeout(2500);
    ok((await txt(page)) === '分享成績 Compartir resultado', '過一下就恢復原本文字', await txt(page));
    ok(errors.length === 0, '沒有頁面錯誤', errors);
    await ctx.close(); }

  console.log('\n[8] 系統分享出其他錯誤：改走複製');
  { const { page, ctx } = await result({}, 'Ana', 128);
    await stub(page, 'error');
    await page.click('#shareBtn'); await page.waitForTimeout(300);
    ok((await copied(page)).length === 1, '改走複製');
    ok((await txt(page)).startsWith('已複製'), '顯示已複製', await txt(page));
    await ctx.close(); }

  console.log('\n[9] 複製也失敗：提示自己複製網址');
  { const { page, ctx } = await result({}, 'Ana', 128);
    await stub(page, 'none');
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('denied'); } }, configurable: true });
      document.execCommand = () => false;
    });
    await page.click('#shareBtn'); await page.waitForTimeout(300);
    ok((await txt(page)).startsWith('無法分享'), '顯示「無法分享，請自行複製網址」', await txt(page));
    await ctx.close(); }

  console.log('\n[10] 班級連結：分享的連結不帶班級碼');
  { const { page, ctx } = await result({ qs: '?class=' + T.CID }, 'Ana', 88);
    await stub(page, 'ok');
    await page.click('#shareBtn'); await page.waitForTimeout(200);
    const s = await shared(page);
    ok(s[0] && s[0].url === URL_SHARE && !/class|preview|th=|d=/.test(s[0].url + s[0].text), '連結是公開頁，沒有班級碼', s[0]);
    await ctx.close(); }

  console.log('\n[11] 小螢幕 360×640：三顆按鈕都放得下');
  { const { page, ctx } = await result({ w: 360, h: 640 }, 'Ana', 128);
    const r = await page.evaluate(() => ['againBtn', 'shareBtn', 'toMenuBtn'].map(id => { const b = document.getElementById(id).getBoundingClientRect(); return { id, left: b.left, right: b.right, h: b.height }; }));
    ok(r.every(b => b.left >= 0 && b.right <= 360 && b.h >= 44), '沒超出畫面、高度夠按', r);
    ok(await page.$eval('#res', e => e.scrollHeight >= e.clientHeight), '結算畫面可以捲動到底（按鈕不會被切掉）');
    await ctx.close(); }

  await T.finish(browser);
})();
