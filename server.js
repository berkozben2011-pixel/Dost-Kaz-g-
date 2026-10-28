'use strict';
const express = require('express'), http = require('http'), path = require('path'), crypto = require('crypto');
const { Server } = require('socket.io');
const { CATEGORIES, pool } = require('./questions');
const MAX = 12, MIN = 3;
const CAT_IDS = CATEGORIES.map((c) => c.id);
const DEFAULT_CATS = CATEGORIES.filter((c) => !c.adult).map((c) => c.id);

function start(port = +process.env.PORT || 3000, opts = {}) {
  const HOST_GRACE = opts.hostGrace ?? (+process.env.HOST_GRACE_MS || 15000);
  const STALL = opts.stall ?? (+process.env.STALL_MS || 30000);
  const EMPTY_TTL = opts.emptyTtl ?? 60000;
  const app = express();
  app.use(express.static(path.join(__dirname, 'public')));
  app.get('/health', (q, r) => r.send('ok'));
  const server = http.createServer(app);
  const io = new Server(server, { maxHttpBufferSize: 100e3 });
  const rooms = new Map(), fails = new Map();
  const T = (fn, ms) => { const t = setTimeout(fn, ms); t.unref(); return t; };
  const uid = () => crypto.randomBytes(6).toString('hex');
  const newCode = () => { let c; do { c = String(crypto.randomInt(100000, 1000000)); } while (rooms.has(c)); return c; };
  const cleanName = (n) => (typeof n === 'string' ? n.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16) : '');
  const okPhoto = (p) => p == null || p === '' || (typeof p === 'string' && p.length <= 60000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(p));
  const ipOf = (s) => (s.handshake.headers['x-forwarded-for'] || '').split(',')[0].trim() || s.handshake.address;
  const recent = (k) => { const a = (fails.get(k) || []).filter((t) => Date.now() - t < 60000); fails.set(k, a); return a; };
  const limited = (s) => recent(ipOf(s)).length >= 8;
  const fail = (s) => recent(ipOf(s)).push(Date.now());
  setInterval(() => fails.clear(), 300000).unref();

  const ctx = (s) => { const r = s.data.code && rooms.get(s.data.code); const p = r && r.players.get(s.data.pid); return p ? { r, p } : {}; };
  const plist = (r) => [...r.players.values()];

  function view(r, p) {
    const o = {
      code: r.code, state: r.state, hostId: r.hostId, me: p.id, adult: r.adult, cats: r.cats, min: MIN, max: MAX, roundNo: r.n,
      categories: CATEGORIES.map(({ id, name, adult }) => ({ id, name, adult })),
      players: plist(r).map((x) => ({
        id: x.id, name: x.name, connected: x.connected, waiting: x.waiting, stalled: x.stalled,
        inRound: !!r.round && r.round.part.has(x.id), answered: !!r.round && r.round.answers.has(x.id),
      })),
    };
    if (r.round) { o.question = r.round.q; o.myLocked = r.round.answers.has(p.id); o.inRound = r.round.part.has(p.id); }
    if (r.state === 'results') o.results = r.round.results; // seçimler yalnızca burada, herkes cevapladıktan sonra gider
    return o;
  }
  function broadcast(r) { for (const p of r.players.values()) if (p.sid) io.to(p.sid).emit('state', view(r, p)); }
  function sendPhotos(sock, r) { for (const p of r.players.values()) if (p.photo) sock.emit('photo', { id: p.id, photo: p.photo }); }

  function transferHost(r, force) {
    const old = r.hostId, all = plist(r).filter((x) => x.id !== old);
    const n = all.find((x) => x.connected) || (force ? all[0] : null);
    if (!n) return;
    r.hostId = n.id;
    io.to(r.code).emit('hostChanged', { id: n.id, name: n.name });
    broadcast(r);
  }
  function closeRoom(r) { for (const p of r.players.values()) clearTimeout(p.stallT); clearTimeout(r.hostT); clearTimeout(r.closeT); io.to(r.code).emit('roomClosed'); rooms.delete(r.code); }

  function checkDone(r) {
    if (r.state !== 'question') return;
    const rd = r.round;
    for (const id of rd.part) if (!rd.answers.has(id)) return;
    const counts = {}, who = {};
    const votes = [...rd.answers].map(([from, to]) => { counts[to] = (counts[to] || 0) + 1; return { from, to }; });
    for (const v of votes) for (const id of [v.from, v.to]) { const p = r.players.get(id); who[id] = p ? p.name : (rd.names[id] || '?'); }
    const max = Math.max(0, ...Object.values(counts));
    rd.results = { question: rd.q, votes, counts, who, winners: max ? Object.keys(counts).filter((k) => counts[k] === max) : [] };
    r.history.push(rd.results); if (r.history.length > 200) r.history.shift();
    r.state = 'results';
  }
  function removePlayer(r, p) {
    clearTimeout(p.stallT);
    if (r.round) {
      r.round.names[p.id] = p.name;
      r.round.part.delete(p.id); r.round.answers.delete(p.id);
      for (const [from, to] of r.round.answers) if (to === p.id) r.round.answers.delete(from); // o kişiyi seçenler yeniden seçsin
    }
    r.players.delete(p.id);
    if (!r.players.size) return closeRoom(r);
    if (r.hostId === p.id) transferHost(r, true);
    checkDone(r); broadcast(r);
  }
  function newRound(r) {
    for (const p of r.players.values()) p.waiting = false;
    let list = pool(r.cats, r.adult).filter((q) => !r.used.has(q.text));
    if (!list.length) { r.used.clear(); list = pool(r.cats, r.adult); }
    const q = list[crypto.randomInt(list.length)];
    r.used.add(q.text); r.n++;
    r.round = { q, answers: new Map(), part: new Set(r.players.keys()), results: null, names: {} };
    r.state = 'question';
  }
  function join(sock, r, name, photo, cb) {
    const p = { id: uid(), token: crypto.randomBytes(16).toString('hex'), name, photo: photo || '', sid: sock.id, connected: true, waiting: r.state !== 'lobby', stalled: false };
    r.players.set(p.id, p);
    sock.data = { code: r.code, pid: p.id }; sock.join(r.code);
    cb({ ok: true, code: r.code, token: p.token, id: p.id });
    sendPhotos(sock, r);
    if (p.photo) sock.to(r.code).emit('photo', { id: p.id, photo: p.photo });
    broadcast(r);
  }
  const wrap = (fn) => (d, cb) => { cb = typeof cb === 'function' ? cb : () => {}; try { fn(d, cb); } catch (e) { console.error(e); cb({ error: 'Sunucu hatası' }); } };

  io.on('connection', (sock) => {
    sock.data = {};
    sock.on('create', wrap((d, cb) => {
      if (sock.data.code) return cb({ error: 'Zaten bir odadasın' });
      if (!d || typeof d !== 'object') return cb({ error: 'Geçersiz istek' });
      const name = cleanName(d.name);
      if (!name) return cb({ error: 'Bir ad yazmalısın' });
      if (!okPhoto(d.photo)) return cb({ error: 'Fotoğraf geçersiz (JPEG, küçük boyutlu olmalı)' });
      const r = { code: newCode(), hostId: null, players: new Map(), state: 'lobby', adult: false, cats: [...DEFAULT_CATS], round: null, used: new Set(), history: [], n: 0 };
      rooms.set(r.code, r);
      join(sock, r, name, d.photo, (res) => { r.hostId = res.id; cb(res); broadcast(r); });
    }));
    sock.on('join', wrap((d, cb) => {
      if (limited(sock)) return cb({ error: 'Çok fazla hatalı deneme. Bir dakika bekle.' });
      if (sock.data.code) return cb({ error: 'Zaten bir odadasın' });
      if (!d || typeof d !== 'object') return cb({ error: 'Geçersiz istek' });
      const name = cleanName(d.name);
      if (!name) return cb({ error: 'Bir ad yazmalısın' });
      if (!okPhoto(d.photo)) return cb({ error: 'Fotoğraf geçersiz (JPEG, küçük boyutlu olmalı)' });
      const r = typeof d.code === 'string' && /^\d{6}$/.test(d.code) ? rooms.get(d.code) : null;
      if (!r) { fail(sock); return cb({ error: 'Oda bulunamadı' }); }
      if (r.players.size >= MAX) return cb({ error: 'Oda dolu (en fazla 12 kişi)' });
      join(sock, r, name, d.photo, cb);
    }));
    sock.on('rejoin', wrap((d, cb) => {
      if (limited(sock)) return cb({ error: 'Çok fazla hatalı deneme.' });
      const r = d && typeof d.code === 'string' ? rooms.get(d.code) : null;
      const p = r && typeof d.token === 'string' ? plist(r).find((x) => x.token === d.token) : null;
      if (!p) { fail(sock); return cb({ error: 'Oturum bulunamadı' }); }
      if (p.sid && p.sid !== sock.id) { const old = io.sockets.sockets.get(p.sid); if (old) { old.data = {}; old.leave(r.code); } }
      p.sid = sock.id; p.connected = true; p.stalled = false; clearTimeout(p.stallT); clearTimeout(r.closeT);
      if (r.hostId === p.id) clearTimeout(r.hostT);
      sock.data = { code: r.code, pid: p.id }; sock.join(r.code);
      cb({ ok: true, code: r.code, token: p.token, id: p.id });
      sendPhotos(sock, r); broadcast(r);
    }));
    sock.on('settings', wrap((d, cb) => {
      const { r, p } = ctx(sock);
      if (!r || r.hostId !== p.id) return cb({ error: 'Yalnızca oda sahibi yapabilir' });
      if (r.state === 'question') return cb({ error: 'Tur sırasında değiştirilemez' });
      if (!d || !Array.isArray(d.cats) || typeof d.adult !== 'boolean') return cb({ error: 'Geçersiz ayar' });
      const adult = d.adult, cats = [...new Set(d.cats)].filter((c) => CAT_IDS.includes(c) && (adult || c !== 'yetiskin'));
      if (!cats.length) return cb({ error: 'En az bir kategori seç' });
      r.adult = adult; r.cats = cats; cb({ ok: true }); broadcast(r);
    }));
    sock.on('start', wrap((d, cb) => {
      const { r, p } = ctx(sock);
      if (!r || r.hostId !== p.id) return cb({ error: 'Yalnızca oda sahibi yapabilir' });
      if (r.state !== 'lobby') return cb({ error: 'Oyun zaten başladı' });
      if (r.players.size < MIN) return cb({ error: `En az ${MIN} oyuncu gerekli` });
      newRound(r); cb({ ok: true }); broadcast(r);
    }));
    sock.on('next', wrap((d, cb) => {
      const { r, p } = ctx(sock);
      if (!r || r.hostId !== p.id) return cb({ error: 'Yalnızca oda sahibi yeni soruya geçebilir' });
      if (r.state !== 'results') return cb({ error: 'Sonuçlar henüz açıklanmadı' });
      if (r.players.size < 2) return cb({ error: 'Yeterli oyuncu yok' });
      newRound(r); cb({ ok: true }); broadcast(r);
    }));
    sock.on('answer', wrap((d, cb) => {
      const { r, p } = ctx(sock);
      if (!r || r.state !== 'question') return cb({ error: 'Şu an cevap verilemez' });
      if (!r.round.part.has(p.id)) return cb({ error: 'Bu tura sonraki soruda katılacaksın' });
      if (r.round.answers.has(p.id)) return cb({ error: 'Zaten cevap verdin' });
      const t = d && d.target;
      if (typeof t !== 'string' || t === p.id || !r.players.has(t)) return cb({ error: 'Geçersiz seçim' });
      r.round.answers.set(p.id, t); checkDone(r); cb({ ok: true }); broadcast(r);
    }));
    sock.on('resolve', wrap((d, cb) => { // oda sahibi: bağlantısı kopan oyuncuyu atla / çıkar
      const { r, p } = ctx(sock);
      if (!r || r.hostId !== p.id) return cb({ error: 'Yalnızca oda sahibi yapabilir' });
      const t = d && r.players.get(d.id);
      if (!t || t.id === p.id) return cb({ error: 'Geçersiz oyuncu' });
      if (d.action === 'skip' && r.state === 'question') { r.round.part.delete(t.id); r.round.answers.delete(t.id); checkDone(r); broadcast(r); }
      else if (d.action === 'kick') { const s = t.sid && io.sockets.sockets.get(t.sid); if (s) { s.emit('kicked'); s.leave(r.code); s.data = {}; } removePlayer(r, t); }
      else return cb({ error: 'Geçersiz işlem' });
      cb({ ok: true });
    }));
    sock.on('leave', wrap((d, cb) => {
      const { r, p } = ctx(sock);
      if (!r) return cb({ ok: true });
      sock.leave(r.code); sock.data = {}; removePlayer(r, p); cb({ ok: true });
    }));
    sock.on('disconnect', () => {
      const { r, p } = ctx(sock);
      if (!r || p.sid !== sock.id) return;
      p.connected = false; p.sid = null;
      p.stallT = T(() => { if (!p.connected) { p.stalled = true; broadcast(r); } }, STALL);
      if (r.hostId === p.id) { clearTimeout(r.hostT); r.hostT = T(() => { if (!p.connected && r.hostId === p.id) transferHost(r); }, HOST_GRACE); }
      if (plist(r).every((x) => !x.connected)) { clearTimeout(r.closeT); r.closeT = T(() => closeRoom(r), EMPTY_TTL); }
      broadcast(r);
    });
  });

  return new Promise((res) => server.listen(port, () => res({ server, io, rooms, port: server.address().port, close: () => new Promise((ok) => io.close(ok)) })));
}
if (require.main === module) start().then((s) => console.log(`Dost Kazığı Online: http://localhost:${s.port}`));
module.exports = { start };
