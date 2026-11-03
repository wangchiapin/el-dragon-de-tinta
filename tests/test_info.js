// 墨龍飛天：ⓘ 說明視窗＋標題的龍 — 開關、7 條說明、繁／簡 × 西／英／只有中文、不遮住按鈕
const T = require('./common');
const { ok, KEY } = T;

// 標準答案（照 index.html 的 I18N 表手寫）：第 3 條（計分）每個語言的開頭
const H3 = {
  trad: '吃對加分，連續吃對 5 個', simp: '吃对加分，连续吃对 5 个',
  es: 'Cada acierto suma puntos', en: 'Correct words score points'
};

(async () => {
  const browser = await T.launch();
  async function run(ls, label, fn){
    const { page, errors } = await T.open(browser, { ls: ls && { [KEY]: JSON.stringify(ls) } });
    console.log('\n[' + label + ']');
    await fn(page);
    ok(errors.length === 0, label + '：沒有頁面錯誤', errors);
    await page.context().close();
  }

  await run(null, '預設（繁體＋西文）', async page => {
    ok(await T.visible(page, '#menuInfo'), '主選單有 ⓘ 鈕');
    ok(await T.visible(page, '#menuGear'), '主選單有 ⚙ 鈕');
    ok(!(await T.visible(page, '#infoScr')), '一開始說明視窗是關的');
    // ⓘ 和 ⚙ 不重疊、也不壓到標題
    const r = await page.evaluate(() => {
      const b = id => document.getElementById(id).getBoundingClientRect();
      const i = b('menuInfo'), g = b('menuGear'), t = document.querySelector('#menu h1').getBoundingClientRect();
      return { gap: g.left - i.right, below: t.top - Math.max(i.bottom, g.bottom) };
    });
    ok(r.gap >= 8, 'ⓘ 和 ⚙ 之間有空隙', r);
    ok(r.below >= 0, '標題在 ⓘ／⚙ 下面，不被壓到', r);
    ok(await page.$$eval('#menu .dgB', e => e.length) === 1, '標題下面有龍（背景那層）');
    ok(await page.$eval('#menu .dgB', e => getComputedStyle(e).pointerEvents) === 'none', '龍不會擋住點擊');
    // 開、關
    await page.click('#menuInfo');
    ok(await T.visible(page, '#infoScr'), '點 ⓘ 開出說明視窗');
    ok(await page.$$eval('#infoCard li', e => e.length) === 7, '說明有 7 條');
    ok((await T.txt(page, '#infoCard h2')).startsWith('ⓘ 說明'), '標題：ⓘ 說明');
    ok((await T.txt(page, '#infoCard')).includes(H3.trad) && (await T.txt(page, '#infoCard')).includes(H3.es), '第 3 條有繁中＋西文');
    await page.click('#infoDone');
    ok(!(await T.visible(page, '#infoScr')), '按「完成」關掉');
    await page.click('#menuInfo');
    await page.mouse.click(4, 4);
    ok(!(await T.visible(page, '#infoScr')), '點視窗外面也會關');
    // 開說明時不會開始遊戲
    ok((await T.st(page)).state !== 'play', '看說明不會開始遊戲');
  });

  await run({ v: 1, script: 'simp', lang: 'en', phon: 'pinyin' }, '簡體＋英文', async page => {
    await page.click('#menuInfo');
    const t = await T.txt(page, '#infoCard');
    ok(t.includes(H3.simp) && t.includes(H3.en), '第 3 條有簡中＋英文');
    ok(t.startsWith('ⓘ 说明 Help'), '標題：ⓘ 说明 Help', t.slice(0, 30));
  });

  await run({ v: 1, script: 'trad', lang: 'zh', phon: 'pinyin' }, '只有中文', async page => {
    await page.click('#menuInfo');
    ok(await page.$$eval('#infoCard li small', e => e.length) === 0, '只有中文時沒有小字翻譯');
    ok(await page.$$eval('#infoCard li', e => e.length) === 7, '仍然 7 條');
  });

  await T.finish(browser);
})();
