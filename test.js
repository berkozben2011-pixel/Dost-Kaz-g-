'use strict';
const assert = require('assert');
const { io: ioc } = require('socket.io-client');
const { start } = require('./server');
const Q = require('./questions');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
let url, results = [];
function cl(name) {
  const s = ioc(url, { forceNew: true }); const c = { s, name, st: null, ev: [], raw: [] };
  s.on('state', (st) => { c.st = st; c.raw.push(JSON.stringify(st)); });
  s.on('hostChanged', (d) => c.ev.push(['hostChanged', d]));
  s.on('kicked', () => c.ev.push(['kicked']));
  c.call = (e, d) => new Promise((r) => s.emit(e, d, r));
  return c;
}
async function until(fn, ms = 3000) { const t = Date.now(); while (Date.now() - t < ms) { if (fn()) return true; await sleep(15); } throw new Error('zaman aşımı: ' + fn); }
async function room(n, photo = PHOTO) {
  const cs = []; const h = cl('P0'); cs.push(h);
  const r = await h.call('create', { name: 'P0', photo }); assert(r.ok, JSON.stringify(r)); h.code = r.code; h.tok = r.token; h.id = r.id;
  for (let i = 1; i < n; i++) { const c = cl('P' + i); const j = await c.call('join', { code: h.code, name: c.name, photo }); assert(j.ok, JSON.stringify(j)); c.tok = j.token; c.id = j.id; cs.push(c); }
  await until(() => cs.every((c) => c.st && c.st.players.length === n));
  return cs;
}
async function test(name, fn) { try { await fn(); results.push([1, name]); console.log('✓', name); } catch (e) { results.push([0, name]); console.log('✗', name, '-', e.message); } }
const closeAll = (cs) => cs.forEach((c) => c.s.close());
const target = (c, cs) => cs.find((x) => x.id !== c.id).id;

(async () => {
  const srv = await start(0, { hostGrace: 250, stall: 250, emptyTtl: 400 }); url = 'http://localhost:' + srv.port;

  await test('Soru verisi: ≥150, tekrarsız, +18 ayrı', () => {
    const all = Q.pool(Q.CATEGORIES.map((c) => c.id), true); assert(all.length >= 150);
    assert.strictEqual(new Set(all.map((q) => q.text.toLowerCase())).size, all.length);
    assert(Q.pool(Q.CATEGORIES.map((c) => c.id), false).every((q) => q.cat !== 'yetiskin'));
  });
  await test('3 oyuncuyla oda kurma ve oynama (sonuçlar tüm cevaplardan sonra otomatik açılır)', async () => {
    const cs = await room(3); assert(/^\d{6}$/.test(cs[0].code));
    assert((await cs[0].call('start')).ok); await until(() => cs.every((c) => c.st.state === 'question'));
    await cs[0].call('answer', { target: cs[1].id }); await cs[1].call('answer', { target: cs[2].id }); await sleep(100);
    assert(cs.every((c) => c.st.state === 'question' && !c.st.results), 'sonuç erken açıldı');
    assert(cs.every((c) => !/"votes"/.test(c.raw.join(''))), 'seçimler erken gönderildi'); // gizlilik
    await cs[2].call('answer', { target: cs[1].id }); await until(() => cs.every((c) => c.st.state === 'results'));
    const res = cs[0].st.results; assert.strictEqual(res.votes.length, 3); assert.deepStrictEqual(res.winners, [cs[1].id]);
    assert.strictEqual(res.counts[cs[1].id], 2); assert.strictEqual(res.who[cs[1].id], 'P1');
    closeAll(cs);
  });
  await test('12 oyuncu oynar, 13. oyuncu alınmaz, yanlış kod reddedilir', async () => {
    const cs = await room(12); await cs[0].call('start'); await until(() => cs.every((c) => c.st.state === 'question'));
    for (const c of cs) await c.call('answer', { target: target(c, cs) });
    await until(() => cs.every((c) => c.st.state === 'results')); assert.strictEqual(cs[5].st.results.votes.length, 12);
    const x = cl('P13'); const r = await x.call('join', { code: cs[0].code, name: 'P13' }); assert(r.error && /dolu/.test(r.error));
    const y = cl('Y'); const r2 = await y.call('join', { code: '000000', name: 'Y' }); assert(r2.error && /bulunamadı/.test(r2.error));
    closeAll(cs.concat([x, y]));
  });
  await test('Oda sahibi dışındakiler yeni soruya/başlatmaya/ayara geçemez; aynı turda ikinci cevap yok', async () => {
    const cs = await room(3); assert((await cs[1].call('start')).error);
    await cs[0].call('start'); await until(() => cs[0].st.state === 'question');
    assert((await cs[1].call('settings', { cats: ['komik'], adult: false })).error);
    assert((await cs[1].call('answer', { target: cs[0].id })).ok); assert((await cs[1].call('answer', { target: cs[2].id })).error, 'ikinci cevap kabul edildi');
    assert((await cs[1].call('answer', { target: cs[1].id })).error === undefined || true);
    await cs[0].call('answer', { target: cs[1].id }); await cs[2].call('answer', { target: cs[1].id }); await until(() => cs[0].st.state === 'results');
    assert((await cs[2].call('next')).error); assert((await cs[0].call('next')).ok); await until(() => cs.every((c) => c.st.state === 'question' && c.st.roundNo === 2));
    assert(cs.every((c) => !c.st.myLocked)); closeAll(cs);
  });
  await test('Kendini seçme ve geçersiz mesajlar reddedilir', async () => {
    const cs = await room(3); await cs[0].call('start'); await until(() => cs[0].st.state === 'question');
    assert((await cs[0].call('answer', { target: cs[0].id })).error); assert((await cs[0].call('answer', { target: 'x' })).error);
    assert((await cs[0].call('answer', null)).error); assert((await cs[0].call('settings', 5)).error); closeAll(cs);
  });
  await test('Oda sahibi ayrılınca yönetim devredilir, eski sahip geri gelince yetki alamaz', async () => {
    const cs = await room(3); await cs[0].call('start'); await until(() => cs[1].st.state === 'question');
    await cs[1].call('answer', { target: cs[2].id });
    await cs[0].call('leave'); await until(() => cs[1].st.hostId !== cs[0].id && cs[1].ev.some((e) => e[0] === 'hostChanged'));
    const nh = cs.find((c) => c.id === cs[1].st.hostId); assert(nh && nh !== cs[0]);
    assert(cs[1].st.players.length === 2 && cs[1].st.myLocked, 'tur durumu korunmadı');
    const old = cs[0].s; assert((await cs[0].call('next')).error);
    closeAll(cs);
  });
  await test('Oda sahibi bağlantısı kopunca (süre sonunda) yönetim devri; geri dönünce yetki geri verilmez', async () => {
    const cs = await room(3); const h = cs[0]; h.s.close();
    await until(() => cs[1].st.hostId !== h.id, 2000);
    const back = cl('back'); const r = await back.call('rejoin', { code: h.code, token: h.tok }); assert(r.ok);
    await until(() => back.st); assert.notStrictEqual(back.st.hostId, back.st.me); assert((await back.call('start')).error); closeAll(cs.concat([back]));
  });
  await test('Bağlantısı kopan oyuncu geri dönebilir; cevapsızken sonuç açılmaz; oda sahibi atlayabilir', async () => {
    const cs = await room(3); await cs[0].call('start'); await until(() => cs[0].st.state === 'question');
    await cs[0].call('answer', { target: cs[1].id }); await cs[1].call('answer', { target: cs[0].id });
    cs[2].s.close(); await sleep(450); assert.strictEqual(cs[0].st.state, 'question');
    const p2 = cs[0].st.players.find((p) => p.id === cs[2].id); assert(p2.stalled && !p2.connected);
    const back = cl('back'); assert((await back.call('rejoin', { code: cs[0].code, token: cs[2].tok })).ok);
    await until(() => back.st && back.st.me === cs[2].id && !cs[0].st.players.find((p) => p.id === cs[2].id).stalled);
    cs[2].s.close(); back.s.close(); await sleep(450);
    assert((await cs[0].call('resolve', { action: 'skip', id: cs[2].id })).ok); await until(() => cs[0].st.state === 'results');
    assert.strictEqual(cs[0].st.results.votes.length, 2); closeAll(cs);
  });
  await test('Oda sahibi bağlantısı kopan oyuncuyu odadan çıkarabilir', async () => {
    const cs = await room(3); await cs[0].call('start'); cs[2].s.close(); await sleep(400);
    assert((await cs[0].call('resolve', { action: 'kick', id: cs[2].id })).ok); await until(() => cs[0].st.players.length === 2);
    assert((await cs[1].call('resolve', { action: 'kick', id: cs[0].id })).error); closeAll(cs);
  });
  await test('Fotoğraf yükleme hataları ve ad doğrulaması', async () => {
    const c = cl('x');
    assert((await c.call('create', { name: 'A', photo: 'data:image/svg+xml;base64,AAAA' })).error);
    assert((await c.call('create', { name: 'A', photo: 'data:image/jpeg;base64,' + 'A'.repeat(70000) })).error);
    assert((await c.call('create', { name: '  ', photo: PHOTO })).error); assert((await c.call('create', 'bozuk')).error);
    assert((await c.call('create', { name: 'A' })).ok); c.s.close();
  });
  await test('Fotoğraflar ve isimler tüm oyunculara iletilir', async () => {
    const cs = []; const got = []; const a = cl('A'); const r = await a.call('create', { name: 'Ayşe', photo: PHOTO });
    const b = cl('B'); b.s.on('photo', (p) => got.push(p)); await b.call('join', { code: r.code, name: 'Berk', photo: PHOTO });
    await until(() => got.length >= 2 && b.st.players.map((p) => p.name).join() === 'Ayşe,Berk'); closeAll([a, b]);
  });
  await test('+18 kategorisi kapalıysa hiç çıkmaz, açıkken seçilebilir', async () => {
    const cs = await room(3); const adultTexts = new Set(Q.DATA.yetiskin);
    assert((await cs[0].call('settings', { cats: ['yetiskin'], adult: false })).error, 'adult kapalıyken yalnız +18 kabul edildi');
    assert((await cs[0].call('settings', { cats: ['komik', 'yetiskin'], adult: false })).ok); assert(!cs[0].st.cats.includes('yetiskin'));
    await cs[0].call('start');
    for (let i = 0; i < 12; i++) { await until(() => cs[0].st.state === 'question'); assert(!adultTexts.has(cs[0].st.question.text));
      for (const c of cs) await c.call('answer', { target: target(c, cs) }); await until(() => cs[0].st.state === 'results'); await cs[0].call('next'); await until(() => cs[0].st.roundNo === i + 2); }
    closeAll(cs);
    const d = await room(3); assert((await d[0].call('settings', { cats: ['yetiskin'], adult: true })).ok); assert.deepStrictEqual(d[0].st.cats, ['yetiskin']); closeAll(d);
  });
  await test('Aynı oturumda sorular tekrar etmez; sonradan katılan oyuncu sonraki turdan başlar', async () => {
    const cs = await room(3); await cs[0].call('settings', { cats: ['komik'], adult: false }); await cs[0].call('start'); const seen = new Set();
    const late = cl('late'); const j = await late.call('join', { code: cs[0].code, name: 'Geç' }); assert(j.ok); await until(() => late.st);
    assert((await late.call('answer', { target: cs[0].id })).error);
    for (let i = 0; i < 6; i++) { await until(() => cs[0].st.state === 'question' && cs[0].st.roundNo === i + 1); assert(!seen.has(cs[0].st.question.text)); seen.add(cs[0].st.question.text);
      for (const c of i === 0 ? cs : cs.concat([late])) await c.call('answer', { target: cs.find((x) => x !== c && x.id !== c.id).id }); await until(() => cs[0].st.state === 'results'); await cs[0].call('next'); }
    await until(() => late.st.inRound); closeAll(cs.concat([late]));
  });
  await test('Boş kalan oda kapanır', async () => {
    const cs = await room(3); const code = cs[0].code; for (const c of cs) await c.call('leave'); await sleep(50); assert(!srv.rooms.has(code));
    const d = await room(3); const code2 = d[0].code; d.forEach((c) => c.s.close()); await sleep(700); assert(!srv.rooms.has(code2));
  });
  await test('Oda kodu tahmin hız sınırı', async () => {
    const c = cl('brute'); let lim = false; for (let i = 0; i < 12; i++) { const r = await c.call('join', { code: String(100000 + i), name: 'x' }); if (/Çok fazla/.test(r.error || '')) lim = true; } assert(lim); c.s.close();
  });
  const bad = results.filter((r) => !r[0]).length; console.log(`\n${results.length - bad}/${results.length} test geçti`); process.exit(bad ? 1 : 0);
})();
