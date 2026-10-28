'use strict';
const $ = (s) => document.querySelector(s);
const socket = io();
const store = { get: () => { try { return JSON.parse(sessionStorage.getItem('dk')); } catch { return null; } }, set: (v) => sessionStorage.setItem('dk', JSON.stringify(v)), clear: () => sessionStorage.removeItem('dk') };
let S = null, photos = {}, myPhoto = '', sel = null, lastRound = 0, dismissed = new Set();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nameOf = (id) => (S && (S.players.find((p) => p.id === id) || {}).name) || (S?.results?.who?.[id]) || '?';
const av = (id, c = '') => photos[id] ? `<img class="av ${c}" src="${photos[id]}" alt="">` : `<div class="av ph ${c}">${esc(nameOf(id)[0]?.toUpperCase())}</div>`;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); setTimeout(() => t.classList.remove('on'), 3000); }
const emit = (e, d) => new Promise((r) => socket.emit(e, d, r));
const act = async (e, d) => { const r = await emit(e, d); if (r && r.error) toast(r.error); return r; };

/* ---- Profil ---- */
function resize(file) {
  return new Promise((ok, no) => {
    if (!file || !/^image\//.test(file.type)) return no('Lütfen bir görsel seç.');
    if (file.size > 20e6) return no('Dosya çok büyük (en fazla 20 MB).');
    const im = new Image(), u = URL.createObjectURL(file);
    im.onload = () => { const n = 160, c = document.createElement('canvas'); c.width = c.height = n; const s = Math.min(im.width, im.height);
      c.getContext('2d').drawImage(im, (im.width - s) / 2, (im.height - s) / 2, s, s, 0, 0, n, n); URL.revokeObjectURL(u); ok(c.toDataURL('image/jpeg', .75)); };
    im.onerror = () => no('Görsel okunamadı.'); im.src = u;
  });
}
const setErr = (m) => ($('#err').textContent = m || '');
$('#name').value = sessionStorage.getItem('dk-name') || '';
$('#file').onchange = async (e) => {
  try { myPhoto = await resize(e.target.files[0]); $('#prev').outerHTML = `<img id="prev" class="av big" src="${myPhoto}">`; setErr(); }
  catch (m) { setErr(m); } e.target.value = '';
};
async function enter(ev, extra) {
  const name = $('#name').value.trim(); if (!name) return setErr('Önce adını yaz.');
  sessionStorage.setItem('dk-name', name); setErr();
  const r = await emit(ev, { name, photo: myPhoto, ...extra });
  if (r.error) return setErr(r.error);
  store.set({ code: r.code, token: r.token }); photos[r.id] = myPhoto;
}
$('#create').onclick = () => enter('create');
$('#join').onclick = () => enter('join', { code: $('#code').value.trim() });
$('#code').oninput = (e) => (e.target.value = e.target.value.replace(/\D/g, ''));

/* ---- Bağlantı ---- */
socket.on('connect', async () => {
  const s = store.get(); if (!s) return;
  const r = await emit('rejoin', s);
  if (r.error) { store.clear(); S = null; show(false); setErr('Oturum sona erdi, yeniden katıl.'); }
});
socket.on('disconnect', () => toast('Bağlantı koptu, yeniden bağlanılıyor…'));
socket.on('photo', ({ id, photo }) => { photos[id] = photo; if (S) render(); });
socket.on('hostChanged', ({ id, name }) => toast(id === S?.me ? 'Artık oda sahibisin 👑' : `Yeni oda sahibi: ${name} 👑`));
socket.on('kicked', () => { store.clear(); S = null; show(false); setErr('Odadan çıkarıldın.'); });
socket.on('roomClosed', () => { store.clear(); S = null; show(false); setErr('Oda kapandı.'); });
socket.on('state', (s) => {
  if (s.roundNo !== lastRound) { sel = null; dismissed.clear(); lastRound = s.roundNo; }
  S = s; render();
});
function show(inRoom) { $('#v-profile').hidden = inRoom; $('#v-room').hidden = !inRoom; }

/* ---- Ekranlar ---- */
const card = (p, extra = '', cls = '', tag = 'div') => `<${tag} class="pc ${cls} ${p.connected ? '' : 'off'}" ${extra}>${av(p.id, 'xl')}<span>${esc(p.name)}${p.id === S.me ? ' (sen)' : ''}</span><span class="dot ${p.connected ? '' : 'x'}"></span>${S.hostId === p.id ? '<small>👑 oda sahibi</small>' : ''}</${tag}>`;
function render() {
  if (!S) return; show(true);
  const host = S.hostId === S.me, el = $('#v-room');
  const head = `<div class="bar"><span>Oda: <b>${S.code}</b></span><button class="btn alt sm" data-a="leave">Ayrıl</button></div>`;
  let h = head;
  if (S.state === 'lobby') {
    h += `<h1>Oda Kodu</h1><div class="code">${S.code}</div><p class="note" style="text-align:center">Arkadaşların bu kodla katılsın (${S.players.length}/${S.max})</p>
    <div class="grid">${S.players.map((p) => card(p)).join('')}</div>`;
    if (host) h += `<div class="box"><b>Kategoriler</b><div class="chips" style="margin:10px 0">${S.categories.filter((c) => !c.adult || S.adult).map((c) => `<label class="chip"><input type="checkbox" data-cat="${c.id}" ${S.cats.includes(c.id) ? 'checked' : ''}>${esc(c.name)}</label>`).join('')}</div>
      <label class="chip"><input type="checkbox" data-adult ${S.adult ? 'checked' : ''}>+18 kategorisini aç (odadaki herkes 18 yaşından büyük)</label>
      <p class="note">Yaş doğrulaması yalnızca oda sahibinin beyanına dayanır; gerçek bir yaş kontrolü yapılmaz.</p></div>
      <button class="btn" data-a="start" ${S.players.length < S.min ? 'disabled' : ''}>${S.players.length < S.min ? `En az ${S.min} oyuncu gerekli` : 'Oyunu Başlat'}</button>`;
    else h += `<p class="note" style="text-align:center">Oda sahibinin oyunu başlatması bekleniyor…${S.adult ? ' (+18 açık)' : ''}</p>`;
  } else {
    const q = S.question, cat = (S.categories.find((c) => c.id === q.cat) || {}).name || '';
    h += `<div class="qcard"><small>Tur ${S.roundNo} · ${esc(cat)}</small>${esc(q.text)}</div>`;
    if (S.state === 'question') {
      const part = S.players.filter((p) => p.inRound), done = part.filter((p) => p.answered).length;
      if (!S.inRound) h += `<p class="note" style="text-align:center">Bu tura yetişemedin, sonraki soruda oynayacaksın.</p>`;
      else if (S.myLocked) h += `<p class="note" style="text-align:center">✅ Cevabın kilitlendi. Diğerleri bekleniyor…</p>`;
      else h += `<div class="grid">${S.players.filter((p) => p.id !== S.me).map((p) => card(p, `data-pick="${p.id}"`, sel === p.id ? 'sel' : '', 'button')).join('')}</div>
        <button class="btn" data-a="lock" ${sel ? '' : 'disabled'}>${sel ? `${esc(nameOf(sel))} için KİLİTLE` : 'Bir kişi seç'}</button>`;
      h += `<div class="bar"><span>${done}/${part.length} kişi cevapladı</span></div><div class="chips">${part.map((p) => `<span class="chip">${p.answered ? '✅' : '⏳'} ${esc(p.name)}${p.connected ? '' : ' 📴'}</span>`).join('')}</div>`;
      if (host) for (const p of part.filter((x) => x.stalled && !x.answered && !dismissed.has(x.id)))
        h += `<div class="stall"><span>${esc(p.name)} bir süredir bağlı değil.</span><button class="btn sm alt" data-a="wait" data-id="${p.id}">Bekle</button><button class="btn sm alt" data-a="skip" data-id="${p.id}">Bu tur atla</button><button class="btn sm" data-a="kick" data-id="${p.id}">Odadan çıkar</button></div>`;
    } else {
      const r = S.results, order = S.players.filter((p) => r.counts[p.id] || true).sort((a, b) => (r.counts[b.id] || 0) - (r.counts[a.id] || 0));
      h += `<div class="grid">${order.map((p) => `<div class="pc ${r.winners.includes(p.id) ? 'win' : ''}">${r.winners.includes(p.id) ? '<span class="crown">👑</span>' : ''}${av(p.id, 'xl')}<span>${esc(p.name)}</span><span class="cnt">${r.counts[p.id] || 0} oy</span></div>`).join('')}</div>
      <p style="text-align:center"><b>${r.winners.length > 1 ? 'Eşitlik! ' : ''}En çok seçilen: ${r.winners.map((id) => esc(nameOf(id))).join(', ') || '—'}</b></p>
      ${r.votes.map((v, i) => `<div class="vote" style="animation-delay:${i * .25}s">${av(v.from)}<span>${esc(nameOf(v.from))}</span><b>→</b>${av(v.to)}<span>${esc(nameOf(v.to))}</span></div>`).join('')}
      ${host ? '<button class="btn" data-a="next">YENİ SORU</button>' : '<p class="note" style="text-align:center">Yeni soruyu oda sahibi başlatacak…</p>'}`;
    }
  }
  const keep = el.querySelector('.vote') && S.state === 'results' && el.dataset.round == S.roundNo;
  if (keep) return; // sonuç animasyonu yeniden oynamasın
  el.dataset.round = S.state === 'results' ? S.roundNo : ''; el.innerHTML = h;
}
$('#v-room').addEventListener('click', async (e) => {
  const t = e.target.closest('[data-pick],[data-a]'); if (!t || !S) return;
  if (t.dataset.pick) { sel = t.dataset.pick; return render(); }
  const a = t.dataset.a;
  if (a === 'leave') { if (confirm('Odadan ayrılmak istiyor musun?')) { await emit('leave'); store.clear(); S = null; show(false); } }
  else if (a === 'start' || a === 'next') await act(a);
  else if (a === 'lock') { const r = await act('answer', { target: sel }); if (r.ok) sel = null; }
  else if (a === 'wait') { dismissed.add(t.dataset.id); render(); }
  else if (a === 'skip' || a === 'kick') await act('resolve', { action: a, id: t.dataset.id });
});
$('#v-room').addEventListener('change', (e) => {
  if (!e.target.matches('[data-cat],[data-adult]')) return;
  const box = $('#v-room'), adult = !!box.querySelector('[data-adult]').checked;
  act('settings', { adult, cats: [...box.querySelectorAll('[data-cat]:checked')].map((x) => x.dataset.cat) });
});
