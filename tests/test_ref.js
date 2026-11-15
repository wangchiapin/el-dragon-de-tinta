// 墨龍飛天：遊玩紀錄的 ref（從哪裡進來的記號，例如分享連結 ?ref=share）
// 測：網址有 ref → 訪客（visits）與遊玩（plays）紀錄都帶；沒有就不帶；不合格的值（太長、空白、符號、腳本）忽略；
// 大寫轉小寫；分頁暫存（別的頁面收到的記號）也讀得到；暫存壞掉不出錯、紀錄照寫；新分頁不沿用。
// 這個遊戲測試的 Firebase 一般是空殼（common.js），這裡另外把 HGPlays 用的 firebase 10.12.2 換成會記錄寫入的假模組。
const T = require('./common');
const { chromium, ok, finish, startPlay, BASE } = T;
const fs = require('fs');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');

const FAKE = {
  'firebase-app.js': 'export const initializeApp=()=>({});',
  'firebase-auth.js': "export const getAuth=()=>({currentUser:{uid:'dev1'},authStateReady:async()=>{}}); export const signInAnonymously=async()=>{};",
  'firebase-firestore.js': "const W=()=>((window.__hg ||= []));" +
    "export const getFirestore=()=>({}); export const serverTimestamp=()=>'TS';" +
    "export const doc=(db,col,id)=>({col,id}); export const collection=(db,col)=>({col});" +
    "export const setDoc=async(r,d)=>{W().push([r.col,'set',d,r.id]);};" +
    "export const addDoc=async(c,d)=>{W().push([c.col,'add',d]);return {id:'p1'};};" +
    "export const updateDoc=async(r,d)=>{W().push([r.col,'upd',d]);};"
};

async function open(browser, qs, init){
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/*', r => {
    const u = r.request().url();
    if(u.startsWith('http://localhost')) return r.continue();
    const m = u.match(/gstatic\.com\/firebasejs\/[^/]+\/(firebase-[a-z]+\.js)$/);
    if(m && FAKE[m[1]]) return r.fulfill({ status: 200, contentType: 'application/javascript', body: FAKE[m[1]] });
    if(/\.js(\?|$)/.test(u) || u.includes('gstatic')) return r.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    return r.abort();
  });
  await page.addInitScript('window.__SEED=' + JSON.stringify(T.SEED) + ';');
  if(init) await page.addInitScript(init);
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForFunction(() => !!window.__dragon, null, { timeout: 15000 });
  await page.waitForTimeout(300);
  return { page, ctx, errors };
}
const hg = page => page.evaluate(() => window.__hg || []);
async function played(browser, qs, init){
  const r = await open(browser, qs, init);
  await startPlay(r.page, 'Ana');
  await r.page.waitForTimeout(3000);   // 訪客紀錄等頁面載完 2.5 秒才寫
  const w = await hg(r.page);
  r.visit = (w.filter(x => x[0] === 'visits')[0] || [])[2] || null;
  r.play = (w.filter(x => x[0] === 'plays' && x[1] === 'add')[0] || [])[2] || null;
  return r;
}

(async () => {
  const browser = await chromium.launch();

  console.log('\n[1] 網址有 ?ref=share：訪客與遊玩紀錄都帶 ref');
  { const r = await played(browser, '?ref=share');
    ok(r.visit && r.visit.ref === 'share', '訪客紀錄帶 ref=share', r.visit);
    ok(r.play && r.play.ref === 'share', '遊玩紀錄帶 ref=share', r.play);
    ok(r.visit && r.visit.game && r.visit.uid === 'dev1', '訪客紀錄其他欄位照舊（game、uid）', r.visit);
    ok(!r.errors.length, '沒有 pageerror', r.errors); await r.ctx.close(); }

  console.log('\n[2] 沒有 ref：紀錄不帶 ref 欄位');
  { const r = await played(browser, '');
    ok(r.visit && !('ref' in r.visit), '訪客紀錄沒有 ref', r.visit);
    ok(r.play && !('ref' in r.play), '遊玩紀錄沒有 ref', r.play);
    ok(!r.errors.length, '沒有 pageerror', r.errors); await r.ctx.close(); }

  console.log('\n[3] 不合格的 ref 一律忽略；大寫轉小寫');
  const cases = [['?ref=SHARE', 'share'], ['?ref=Ig_story-1', 'ig_story-1'], ['?ref=' + 'a'.repeat(16), 'a'.repeat(16)],
    ['?ref=' + 'a'.repeat(17), null], ['?ref=', null], ['?ref=a%20b', null], ['?ref=%3Cscript%3E', null],
    ['?ref=share%0A', 'share'], ['?ref=' + encodeURIComponent('朋友'), null], ['?ref=a.b', null]];
  for(const [q, want] of cases){
    const r = await played(browser, q);
    ok(r.visit && (want === null ? !('ref' in r.visit) : r.visit.ref === want), 'ref 參數 ' + q + ' → ' + want, r.visit);
    ok(r.play && (want === null ? !('ref' in r.play) : r.play.ref === want), '  遊玩紀錄同樣處理', r.play);
    ok(!r.errors.length, '  沒有 pageerror', r.errors); await r.ctx.close();
  }

  console.log('\n[4] 分頁暫存：別的頁面（例如地圖首頁）收到的記號，這裡也讀得到');
  { const r = await played(browser, '', "try{sessionStorage.setItem('hg.ref','share')}catch(e){}");
    ok(r.visit && r.visit.ref === 'share', '網址沒有 ref、暫存有 → 訪客紀錄帶 ref', r.visit);
    ok(r.play && r.play.ref === 'share', '遊玩紀錄也帶', r.play);
    await r.ctx.close(); }
  { const r = await played(browser, '', "try{sessionStorage.setItem('hg.ref','<bad value>')}catch(e){}");
    ok(r.visit && !('ref' in r.visit), '暫存裡是不合格的值 → 忽略', r.visit); await r.ctx.close(); }
  { const r = await played(browser, '?ref=ig', "try{sessionStorage.setItem('hg.ref','share')}catch(e){}");
    ok(r.visit && r.visit.ref === 'ig', '網址的 ref 優先於暫存', r.visit);
    ok(await r.page.evaluate(() => sessionStorage.getItem('hg.ref')) === 'ig', '並且更新暫存'); await r.ctx.close(); }

  console.log('\n[5] 暫存讀不到（隱私模式）：不出錯、紀錄照寫');
  const BLOCK = "Object.defineProperty(window,'sessionStorage',{get(){throw new Error('blocked')}})";
  { const r = await played(browser, '?ref=share', BLOCK);
    ok(r.visit && r.visit.ref === 'share', '暫存壞掉但網址有 ref：仍帶 ref', r.visit); await r.ctx.close(); }
  { const r = await played(browser, '', BLOCK);
    ok(r.visit && !('ref' in r.visit) && r.play && !r.errors.length, '暫存壞掉、網址沒 ref：紀錄照寫、不出錯', [r.visit, r.errors]); await r.ctx.close(); }

  console.log('\n[6] 新分頁不沿用上一個分頁的記號');
  { const r = await open(browser, '?ref=share');
    const p2 = await r.ctx.newPage(); await p2.goto(BASE + '/index.html'); await p2.waitForTimeout(300);
    ok(await p2.evaluate(() => sessionStorage.getItem('hg.ref')) === null, '另開的新分頁沒有 ref 暫存'); await r.ctx.close(); }

  await finish(browser);
})();
