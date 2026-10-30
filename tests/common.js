// 新增測試共用的小工具（不是測試檔：檔名不以 test_ 開頭，run.js 不會直接執行它）
let chromium; try{ ({ chromium } = require('playwright')); }catch(e){ ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }
const fs = require('fs'), vm = require('vm');
const MOCK = fs.readFileSync(__dirname + '/firebase-mock.js', 'utf8');
const SRC = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const BASE = process.env.BASE_URL || 'http://localhost:8765';
const KEY = 'hanziGames.settings';
const C = 'subscription-48d3c', M = 'memorma-24dab';
const CID = 'classdrag0001';
const SEED = {
  [C]: { classes: { [CID]: { owner: 'u1', slot: 0, name: '週三班', showBoard: true, updatedAt: 1 } }, shared_dragon: {}, class_scores: {} },
  [M]: {}
};

let pass = 0, fail = 0, notes = 0;
function ok(c, name, extra){ if(c){ pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); } }
function note(name, extra){ notes++; console.log('  ⚠ 已知疑似問題（只記錄，不算失敗）：', name, extra !== undefined ? '→ ' + JSON.stringify(extra) : ''); }
function finish(browser){
  return browser.close().then(() => { console.log('\n通過 ' + pass + '，失敗 ' + fail + (notes ? '，疑似問題備註 ' + notes : '')); process.exit(fail ? 1 : 0); });
}

// 從遊戲原始碼取出內建主題字庫（和網頁裡的 THEMES 同一份），測試才有「標準答案」可以比對
const a = SRC.indexOf('const THEMES = ['), b = SRC.indexOf('\n];\n', a) + 3;
const THEMES = vm.runInNewContext(SRC.slice(a, b).replace('const THEMES =', 'THEMES =') + ';THEMES');
const ZH = (t, simp) => t.words.map(w => simp ? w[1] : w[0]);
const ALL_WORDS = THEMES.flatMap(t => t.words);

async function launch(){ return chromium.launch(); }
async function open(browser, { qs = '', ls = null, w = 390, h = 844, seed = SEED } = {}){
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
  await page.addInitScript('window.__SEED=' + JSON.stringify(seed) + ';');
  if(ls) await page.addInitScript('try{' + Object.keys(ls).map(k => 'localStorage.setItem(' + JSON.stringify(k) + ',' + JSON.stringify(ls[k]) + ');').join('') + '}catch(e){}');
  await page.addInitScript(MOCK);
  await page.goto(BASE + '/index.html' + qs);
  await page.waitForFunction(() => !!window.__dragon, null, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { page, ctx, errors };
}
const txt = (page, sel) => page.$eval(sel, e => e.innerText.replace(/\s+/g, ' ').trim());
const visible = (page, sel) => page.$eval(sel, e => !e.hidden && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0);
const themeBtns = page => page.$$eval('#themeGrid button', bs => bs.map(b => ({ t: b.innerText.replace(/\s+/g, ' ').trim(), on: b.classList.contains('on') })));
const st = page => page.evaluate(() => window.__dragon.state);
const settings = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const db = (page, pid) => page.evaluate(p => window.__DB[p], pid);
async function startPlay(page, name){
  if(name !== undefined) await page.fill('#nameInp', name);
  await page.click('#startBtn');
  await page.waitForFunction(() => window.__dragon.state.state === 'play', null, { timeout: 5000 });
}
async function toResult(page){
  await page.evaluate(() => window.__dragon.endNow());
  await page.waitForSelector('#res:not([hidden])', { timeout: 5000 });
}
// 在遊戲進行中，每 80ms 記一次畫面上出現過的字（文字 → 是不是「該吃的」）
async function watchItems(page){
  await page.evaluate(() => { window.__seen = {}; clearInterval(window.__seenT); window.__seenT = setInterval(() => { window.__dragon.state.items.forEach(i => { (window.__seen[i.text] = window.__seen[i.text] || {})[i.good ? 'good' : 'bad'] = true; }); }, 80); });
}
const seen = page => page.evaluate(() => { clearInterval(window.__seenT); return window.__seen; });

module.exports = { chromium, launch, open, ok, note, finish, txt, visible, themeBtns, st, settings, db, startPlay, toResult, watchItems, seen, THEMES, ZH, ALL_WORDS, KEY, C, M, CID, SEED, BASE, counts: () => ({ pass, fail }) };
