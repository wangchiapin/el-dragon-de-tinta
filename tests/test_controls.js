// 墨龍飛天：操作測試 — 暫停／繼續／回主選單、鍵盤、拖曳、音樂開關、靜音鈕、真的吃字（加分／扣命／結束）、再玩一次、?preview 與練習連結的成績
const T = require('./common');
const { ok, note } = T;

const dpos = async page => (await T.st(page)).dragon;
const frozenSnap = async page => { const s = await T.st(page); return { score: s.score, items: s.items.map(i => i.text + ':' + Math.round(i.y)).join('|'), alt: await T.txt(page, '#altNum'), x: Math.round(s.dragon.x), y: Math.round(s.dragon.y) }; };
const waitItems = (page, n = 1) => page.waitForFunction(k => window.__dragon.state.items.length >= k, n, { timeout: 8000 });
async function canvasBox(page){ return page.$eval('#c', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }); }
// 讓龍飛去吃某個字（want = 'good' | 'bad'），直到 stop(state) 成立或逾時
async function chase(page, want, stop, ms = 25000){
  const t0 = Date.now();
  while(Date.now() - t0 < ms){
    const s = await T.st(page);
    if(s.state !== 'play' || stop(s)) return s;
    const c = s.items.filter(i => (want === 'good') === i.good && i.y > 120 && i.y < s.H * 0.85 && !(i.text === '金'));
    if(c.length){ c.sort((a, b) => Math.abs(a.y - s.dragon.y) - Math.abs(b.y - s.dragon.y)); await page.evaluate(([x, y]) => window.__dragon.moveTo(x, y), [c[0].x, c[0].y]); }
    await page.waitForTimeout(50);
  }
  return T.st(page);
}

(async () => {
  const browser = await T.launch();

  console.log('\n[C1] 暫停／繼續：畫面真的凍結、繼續後又動起來');
  { const { page, ctx, errors } = await T.open(browser);
    await T.startPlay(page, 'Pau');
    await waitItems(page, 2);
    ok(await T.visible(page, '#hud') && !(await T.visible(page, '#pauseScr')), '遊戲中：HUD 看得到、暫停畫面沒有');
    await page.click('#pauseBtn');
    ok((await T.st(page)).paused === true && await T.visible(page, '#pauseScr'), '按 ❚❚：進入暫停並出現暫停畫面');
    const a = await frozenSnap(page);
    await page.waitForTimeout(800);
    const b = await frozenSnap(page);
    ok(a.items === b.items && a.alt === b.alt && a.score === b.score, '暫停 0.8 秒：字的位置、高度、分數都沒變', { a, b });
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
    ok(Math.abs((await dpos(page)).x - a.x) < 2, '暫停中按方向鍵：龍不會動', { before: a.x, after: (await dpos(page)).x });
    // 暫停畫面蓋在上面，滑鼠點不到畫布，所以直接對畫布送出拖曳事件，確認遊戲本身也會擋掉
    await page.evaluate(() => { const c = document.getElementById('c'); const ev = (t, x, y) => c.dispatchEvent(new PointerEvent(t, { clientX: x, clientY: y, pointerId: 1, bubbles: true })); ev('pointerdown', 200, 500); ev('pointermove', 260, 500); ev('pointermove', 320, 500); ev('pointerup', 320, 500); });
    await page.waitForTimeout(250);
    ok(Math.abs((await dpos(page)).x - a.x) < 2, '暫停中拖曳畫面：龍不會動');
    await page.click('#resumeBtn');
    ok((await T.st(page)).paused === false && !(await T.visible(page, '#pauseScr')), '按「繼續」：暫停畫面消失、遊戲繼續');
    await page.waitForTimeout(600);
    const c = await frozenSnap(page);
    ok(c.alt !== b.alt && c.items !== b.items, '繼續後：高度與字的位置又在變', { b, c });
    // Esc 鍵
    await page.keyboard.press('Escape');
    ok((await T.st(page)).paused === true && await T.visible(page, '#pauseScr'), '按 Esc：暫停');
    await page.keyboard.press('Escape');
    ok((await T.st(page)).paused === false && !(await T.visible(page, '#pauseScr')), '再按 Esc：繼續');
    // 暫停 → 設定 → Esc 關設定 → 仍在暫停
    await page.click('#pauseBtn'); await page.click('#pauseSetBtn');
    ok(await T.visible(page, '#dlg') && (await T.st(page)).paused, '暫停畫面可以開設定，遊戲仍暫停');
    await page.keyboard.press('Escape');
    ok(!(await T.visible(page, '#dlg')) && await T.visible(page, '#pauseScr') && (await T.st(page)).paused, 'Esc 關掉設定後回到暫停畫面（不會直接開始跑）');
    await page.keyboard.press('Escape');
    ok(!(await T.st(page)).paused, '再按 Esc 才繼續');
    // 直接按 ⚙：暫停，按完成就繼續
    await page.click('#gear');
    ok((await T.st(page)).paused === true && await T.visible(page, '#dlg') && !(await T.visible(page, '#pauseScr')), '遊戲中按 ⚙：遊戲暫停、出現設定（沒有暫停畫面）');
    const g1 = await frozenSnap(page); await page.waitForTimeout(500); const g2 = await frozenSnap(page);
    ok(g1.items === g2.items && g1.alt === g2.alt, '開著設定時畫面是凍結的');
    await page.click('#dlgDone');
    ok(!(await T.st(page)).paused && !(await T.visible(page, '#dlg')), '按「完成」：遊戲自動繼續');
    // 分頁被藏起來 → 自動暫停
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    ok((await T.st(page)).paused === true && await T.visible(page, '#pauseScr'), '切到別的分頁／縮小視窗：自動暫停');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); });
    // 暫停 → 回主選單
    await page.click('#pauseMenuBtn');
    const s = await T.st(page);
    ok(s.state === 'menu' && !s.paused && await T.visible(page, '#menu') && !(await T.visible(page, '#hud')) && !(await T.visible(page, '#pauseScr')), '暫停裡按「主選單」：回到主選單、HUD 和暫停畫面都收起來');
    await page.keyboard.press('Escape');
    ok(!(await T.visible(page, '#pauseScr')) && (await T.st(page)).state === 'menu', '在主選單按 Esc：什麼都不會發生');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.__dragon.state.state === 'play');
    const s2 = await T.st(page);
    ok(s2.score <= 20 && s2.hearts === 3 && !s2.paused, '從主選單重新開始：分數歸零、3 顆心、沒有卡在暫停', s2);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[C2] 鍵盤操作（方向鍵與 WASD）');
  for(const [key, axis, sign] of [['ArrowLeft', 'x', -1], ['ArrowRight', 'x', 1], ['ArrowUp', 'y', -1], ['ArrowDown', 'y', 1], ['a', 'x', -1], ['d', 'x', 1], ['w', 'y', -1], ['s', 'y', 1], ['A', 'x', -1], ['W', 'y', -1]]){
    const { page, ctx } = await T.open(browser);
    await T.startPlay(page, 'Key');
    await page.waitForTimeout(500);
    const p0 = await dpos(page);
    await page.keyboard.down(key); await page.waitForTimeout(250); await page.keyboard.up(key);
    await page.waitForTimeout(300);
    const p1 = await dpos(page), other = axis === 'x' ? 'y' : 'x';
    ok(sign * (p1[axis] - p0[axis]) > 30 && Math.abs(p1[other] - p0[other]) < 15, '按 ' + key + '：龍往' + (axis === 'x' ? (sign < 0 ? '左' : '右') : (sign < 0 ? '上' : '下')) + '移動，另一軸幾乎沒動', { p0, p1 });
    await page.waitForTimeout(300);
    const p2 = await dpos(page);
    ok(Math.abs(p2[axis] - p1[axis]) < 3, '放開 ' + key + ' 後龍停下來', { p1, p2 });
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser);
    await T.startPlay(page, 'Key');
    await page.waitForTimeout(400);
    const p0 = await dpos(page);
    await page.keyboard.down('ArrowRight'); await page.keyboard.down('ArrowUp'); await page.waitForTimeout(250); await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(300);
    const p1 = await dpos(page);
    ok(p1.x - p0.x > 30 && p0.y - p1.y > 20, '同時按右＋上：斜著飛', { p0, p1 });
    // 按著鍵時視窗失焦：不能一直卡著飛
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(150);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForTimeout(250);
    const q1 = await dpos(page); await page.waitForTimeout(350); const q2 = await dpos(page);
    ok(Math.abs(q2.x - q1.x) < 3, '按著方向鍵時視窗失焦：龍會停下來，不會卡鍵一直飛', { q1, q2 });
    await page.keyboard.up('ArrowLeft');
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser);
    await page.fill('#nameInp', 'wasdwasd');
    ok(await page.inputValue('#nameInp') === 'wasdwasd', '在名字欄打 wasd：字會打進去');
    await page.click('#startBtn'); await page.waitForFunction(() => window.__dragon.state.state === 'play');
    await page.waitForTimeout(500);
    const p0 = await dpos(page); await page.waitForTimeout(500);
    ok(Math.abs((await dpos(page)).x - p0.x) < 3, '在名字欄打字不會讓龍卡在移動狀態', p0);
    ok(await page.evaluate(() => localStorage.getItem('dragonInk.name')) === 'wasdwasd', '名字記在這台裝置（dragonInk.name）');
    await ctx.close(); }

  console.log('\n[C3] 滑鼠／手指拖曳');
  { const { page, ctx } = await T.open(browser);
    await T.startPlay(page, 'Drag'); await page.waitForTimeout(300);
    const p0 = await dpos(page), bx = await canvasBox(page);
    await page.mouse.move(bx.x + 195, bx.y + 500); await page.mouse.down(); await page.mouse.move(bx.x + 255, bx.y + 460, { steps: 6 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const p1 = await dpos(page);
    ok(p1.x - p0.x > 40 && p0.y - p1.y > 25, '往右上拖 60/40 像素：龍往右上移動', { p0, p1 });
    await page.waitForTimeout(300); const p2 = await dpos(page);
    ok(Math.abs(p2.x - p1.x) < 3 && Math.abs(p2.y - p1.y) < 3, '放開後龍停在原地');
    await page.mouse.move(bx.x + 100, bx.y + 300); await page.mouse.move(bx.x + 20, bx.y + 300, { steps: 4 }); await page.waitForTimeout(300);
    ok(Math.abs((await dpos(page)).x - p2.x) < 3, '沒按著滑鼠就移動：龍不會動');
    await page.mouse.move(bx.x + 195, bx.y + 640); await page.mouse.down(); await page.mouse.move(bx.x + 195, bx.y + 10, { steps: 8 }); await page.mouse.up();
    await page.waitForTimeout(400);
    const hh = (await T.st(page)).H;
    ok((await dpos(page)).y >= Math.min(150, hh * 0.3) - 2, '一路往上拖：龍最高只到標籤下面（不會衝出畫面）', await dpos(page));
    await ctx.close(); }

  console.log('\n[C4] 音樂開關（♪ 鈕、設定裡的背景音樂）與一鍵靜音鈕');
  { const { page, ctx } = await T.open(browser);
    ok(await page.evaluate(() => window.__dragon.musicStep) === 0, '主選單：還沒有音樂在跑');
    await T.startPlay(page, 'Mus');
    await page.waitForTimeout(900);
    const m1 = await page.evaluate(() => window.__dragon.musicStep);
    ok(m1 > 0, '開始玩：音樂開始排程（musicStep 前進）', m1);
    ok(!(await page.$eval('#musicBtn', e => e.classList.contains('off'))), '預設：♪ 鈕是亮的（音樂開）');
    await page.click('#musicBtn');
    ok(await page.$eval('#musicBtn', e => e.classList.contains('off')), '按 ♪：鈕變灰加刪除線');
    ok(await page.evaluate(() => localStorage.getItem('dragonInk.music')) === '0', '音樂關閉記在 dragonInk.music = 0');
    await page.waitForTimeout(300);
    const m2 = await page.evaluate(() => window.__dragon.musicStep); await page.waitForTimeout(900);
    ok(await page.evaluate(() => window.__dragon.musicStep) === m2, '音樂關掉後 0.9 秒：不再排新的音符', m2);
    ok((await T.st(page)).state === 'play' && !(await T.st(page)).paused, '關音樂不會暫停遊戲');
    await page.click('#musicBtn');
    ok(!(await page.$eval('#musicBtn', e => e.classList.contains('off'))) && await page.evaluate(() => localStorage.getItem('dragonInk.music')) === '1', '再按 ♪：音樂開回來（記成 1）');
    await page.waitForTimeout(900);
    ok(await page.evaluate(() => window.__dragon.musicStep) > m2, '音樂開回來：又開始排音符');
    // 暫停時音樂停
    await page.click('#pauseBtn'); await page.waitForTimeout(400);
    const m3 = await page.evaluate(() => window.__dragon.musicStep); await page.waitForTimeout(800);
    ok(await page.evaluate(() => window.__dragon.musicStep) === m3, '暫停中：音樂停止', m3);
    // 設定裡的背景音樂
    await page.click('#pauseSetBtn');
    ok(await page.$eval('#gMusic .opt[data-v="on"]', e => e.classList.contains('on')), '設定視窗：背景音樂「開」被選中');
    await page.click('#gMusic .opt[data-v="off"]');
    ok(await page.$eval('#gMusic .opt[data-v="off"]', e => e.classList.contains('on')) && await page.$eval('#musicBtn', e => e.classList.contains('off')) && await page.evaluate(() => localStorage.getItem('dragonInk.music')) === '0', '設定裡選「關」：♪ 鈕同步變灰、記成 0');
    await page.click('#gMusic .opt[data-v="on"]');
    ok(!(await page.$eval('#musicBtn', e => e.classList.contains('off'))), '設定裡選回「開」：♪ 鈕同步亮起');
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { ls: { 'dragonInk.music': '0' } });
    await T.startPlay(page, 'Mus2');
    ok(await page.$eval('#musicBtn', e => e.classList.contains('off')), '之前關過音樂：重新打開遊戲 ♪ 鈕仍是灰的');
    await page.waitForTimeout(1200);
    ok(await page.evaluate(() => window.__dragon.musicStep) === 0, '之前關過音樂：整局都不排音符');
    await page.click('#gear');
    ok(await page.$eval('#gMusic .opt[data-v="off"]', e => e.classList.contains('on')), '設定視窗顯示背景音樂「關」');
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser);
    const mute = async () => page.$eval('#hgMute', e => ({ txt: e.textContent, pressed: e.getAttribute('aria-pressed'), ls: localStorage.getItem('hg.mute.dragon') }));
    const gain = () => page.evaluate(() => new (window.AudioContext || window.webkitAudioContext)().destination.gain.value);
    let m = await mute();
    ok(m.txt === '🔊' && m.pressed === 'false' && await gain() === 1, '靜音鈕預設：🔊、總音量 1', m);
    await page.click('#hgMute');
    m = await mute();
    ok(m.txt === '🔇' && m.pressed === 'true' && m.ls === '1' && await gain() === 0, '按靜音：🔇、記成 1、總音量變 0', m);
    ok((await T.st(page)).state === 'menu', '按靜音鈕不會誤觸開始遊戲');
    await T.startPlay(page, 'Mute');
    await page.click('#hgMute');
    ok((await mute()).txt === '🔊' && await gain() === 1 && !(await T.st(page)).paused, '遊戲中再按一次：取消靜音、總音量回 1、不會暫停遊戲');
    await page.click('#hgMute');
    await page.reload(); await page.waitForFunction(() => !!window.__dragon); await page.waitForTimeout(500);
    m = await mute();
    ok(m.txt === '🔇' && m.pressed === 'true' && await gain() === 0, '重新整理後仍是靜音（🔇、總音量 0）', m);
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { ls: { 'hg.mute.dragon': '1' } });
    ok((await page.$eval('#hgMute', e => e.textContent)) === '🔇' && await page.evaluate(() => new AudioContext().destination.gain.value) === 0, '之前靜音過：一打開就是靜音');
    await ctx.close(); }

  console.log('\n[C5] 真的吃字：吃對加分、吃錯扣命、三顆心用完自動結算');
  { const { page, ctx, errors } = await T.open(browser);
    await T.startPlay(page, 'Eat');
    let s = await chase(page, 'good', x => x.correct >= 1);
    ok(s.correct >= 1 && s.score >= 10 && s.combo >= 1, '吃到對的字：吃對 +1、加分（每個 10 分）、連擊 +1', { correct: s.correct, score: s.score, combo: s.combo });
    const sc1 = s.score;
    s = await chase(page, 'bad', x => x.hearts < 3);
    ok(s.hearts <= 2 && s.combo === 0, '吃到錯的字：少一顆心、連擊歸零', { hearts: s.hearts, combo: s.combo });
    ok((await page.$eval('#hearts', e => e.querySelectorAll('.off').length)) === 3 - s.hearts, '上方心形顯示的空心數量對得上', await page.$eval('#hearts', e => e.innerHTML));
    ok(s.score >= sc1, '吃錯不扣分（只扣命）', { sc1, now: s.score });
    s = await chase(page, 'bad', x => x.hearts <= 0, 40000);
    await page.waitForSelector('#res:not([hidden])', { timeout: 6000 });
    ok(s.state === 'over' || s.state === 'menu' || s.hearts <= 0, '三顆心用完：遊戲自動結束', s.state);
    ok(await T.visible(page, '#res') && !(await T.visible(page, '#hud')), '自動進入結算畫面、HUD 收起來');
    const rows = await page.$$eval('#revList .rv .tag', ts => ts.map(t => t.textContent));
    ok(rows.some(t => t.startsWith('吃錯')), '複習清單有標「吃錯」的字', rows);
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }

  console.log('\n[C6] 再玩一次／回主選單／新紀錄');
  { const { page, ctx, errors } = await T.open(browser);
    await T.startPlay(page, 'Again');
    await page.evaluate(() => window.__dragon.setScore(200)); await T.toResult(page);
    await page.waitForTimeout(800);
    ok(await T.txt(page, '#resScore') === '200' && await T.visible(page, '#resRec') && (await T.txt(page, '#resRec')).includes('新紀錄'), '第一局 200 分：顯示「新紀錄！」');
    ok((await T.txt(page, '#resStat')).includes('最高分 200'), '統計列最高分 200', await T.txt(page, '#resStat'));
    await page.click('#againBtn');
    await page.waitForFunction(() => window.__dragon.state.state === 'play');
    let s = await T.st(page);
    ok(s.score <= 20 && s.hearts === 3 && s.level === 0 && !s.paused && !(await T.visible(page, '#res')) && await T.visible(page, '#hud'), '按「再飛一次」：馬上開新局（分數歸零、3 顆心、等級 0、HUD 回來、結算收起）', s);
    await page.evaluate(() => window.__dragon.setScore(120)); await T.toResult(page); await page.waitForTimeout(800);
    ok(await T.txt(page, '#resScore') === '120' && !(await T.visible(page, '#resRec')), '第二局 120 分（比 200 低）：不顯示新紀錄');
    ok((await T.txt(page, '#resStat')).includes('最高分 200') && await page.evaluate(() => localStorage.getItem('dragonInk.best.food')) === '200', '最高分仍是 200', await T.txt(page, '#resStat'));
    await page.click('#againBtn'); await page.waitForFunction(() => window.__dragon.state.state === 'play');
    await page.evaluate(() => window.__dragon.setScore(310)); await T.toResult(page); await page.waitForTimeout(800);
    ok(await T.visible(page, '#resRec') && (await T.txt(page, '#resStat')).includes('最高分 310'), '第三局 310 分：又刷新紀錄');
    await page.waitForTimeout(600);
    const lb = (await T.db(page, T.M))['inkdragon_boards/food/entries'];
    ok(lb && Object.keys(lb).length === 1 && Object.values(lb)[0].score === 310, '公開排行榜同一台裝置只留最高分 310（不是三筆）', lb);
    await page.click('#toMenuBtn');
    s = await T.st(page);
    ok(s.state === 'menu' && await T.visible(page, '#menu') && !(await T.visible(page, '#res')), '按「主選單」：回到主選單');
    ok(await page.inputValue('#nameInp') === 'Again', '名字欄還留著剛才的名字');
    await page.click('#startBtn'); await page.waitForFunction(() => window.__dragon.state.state === 'play');
    ok((await T.st(page)).score <= 20, '再從主選單開始：新的一局');
    ok(errors.length === 0, '沒有程式錯誤', errors);
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser);
    await T.startPlay(page, 'Zero');
    await T.toResult(page); await page.waitForTimeout(900);
    ok(await T.txt(page, '#resScore') === '0' && !(await T.visible(page, '#resRec')), '0 分結束：不算新紀錄');
    ok(Object.keys((await T.db(page, T.M))['inkdragon_boards/food/entries'] || {}).length === 0, '0 分不會寫進排行榜（讀取排行榜不算寫入）');
    await ctx.close(); }

  console.log('\n[C7] ?preview（老師預覽）與練習連結的成績');
  { const { page, ctx } = await T.open(browser, { qs: '?th=fruit-body' });
    ok(await T.visible(page, '#modeNote') && (await T.txt(page, '#modeNote')).includes('練習模式：成績不會記錄'), '練習連結：主選單寫著「練習模式：成績不會記錄」', await T.txt(page, '#modeNote'));
    await T.startPlay(page, 'Prac'); await page.evaluate(() => window.__dragon.setScore(90)); await T.toResult(page); await page.waitForTimeout(900);
    ok(Object.keys(await T.db(page, T.M)).length === 0 && Object.keys((await T.db(page, T.C)).class_scores || {}).length === 0, '練習連結玩一局 90 分：兩個資料庫都沒有新資料');
    ok(!(await T.visible(page, '#lbBox')), '練習連結結算畫面沒有排行榜');
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { qs: '?class=' + T.CID });
    ok((await T.txt(page, '#modeNote')).includes('班級模式'), '班級連結：主選單寫著班級模式說明', await T.txt(page, '#modeNote'));
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { qs: '?class=' + T.CID + '&preview=1' });
    await T.startPlay(page, 'Prev'); await page.evaluate(() => window.__dragon.setScore(77)); await T.toResult(page); await page.waitForTimeout(1200);
    const cs = (await T.db(page, T.C)).class_scores || {};
    ok(Object.keys(cs).length === 0, '?class=…&preview=1 玩一局：沒有寫進班級成績（筆數 ' + Object.keys(cs).length + '）');
    await ctx.close(); }
  { const { page, ctx } = await T.open(browser, { qs: '?preview=1' });
    await T.startPlay(page, 'Prev2'); await page.evaluate(() => window.__dragon.setScore(77)); await T.toResult(page); await page.waitForTimeout(1200);
    const lb = (await T.db(page, T.M))['inkdragon_boards/food/entries'];
    ok(!lb, '?preview=1（沒有班級參數）玩一局：沒有寫進公開排行榜');
    await ctx.close(); }

  await T.finish(browser);
})().catch(e => { console.error(e); process.exit(1); });
