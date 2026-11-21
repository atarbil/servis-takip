import { api } from '../api.js';
import { html, $, $$, bildir, pencere, onayla, saat, bugunStr, durumRozet } from '../ui.js';
import { planlaPenceresi, yeniIsPenceresi } from '../bilesen.js';
import { havuzKarti } from './havuz.js';

const SAAT_BAS = 7;
const SAAT_BIT = 21;
const SAAT_YUK = 56;
const ADIM_DK = 15;
const GUNLER = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

const gunBasi = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const gunEkle = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const haftaBasi = (d) => { const x = gunBasi(d); const g = (x.getDay() + 6) % 7; return gunEkle(x, -g); };
const ayniGun = (a, b) => bugunStr(a) === bugunStr(b);

function oku() { try { return JSON.parse(localStorage.getItem('takvim') || '{}'); } catch { return {}; } }
function yaz(v) { try { localStorage.setItem('takvim', JSON.stringify(v)); } catch { /* */ } }

export default async function (el, _p, ctx) {
  ctx.baslik('Takvim');
  const ekipler = (await ctx.ekipler(true)).filter((e) => e.aktif);
  const kayit = oku();
  const mobil = matchMedia('(max-width: 860px)').matches;
  const durum = {
    gorunum: kayit.gorunum && !(mobil && kayit.gorunum === 'hafta') ? kayit.gorunum : (mobil ? 'gun' : 'hafta'),
    tarih: ctx.sorgu.tarih ? new Date(ctx.sorgu.tarih + 'T12:00') : new Date(),
    ekipler: new Set(kayit.ekipler?.length ? kayit.ekipler.filter((id) => ekipler.some((e) => e.id === id)) : ekipler.map((e) => e.id)),
    notlar: kayit.notlar !== false,
  };
  if (!durum.ekipler.size) ekipler.forEach((e) => durum.ekipler.add(e.id));
  let olaylar = [];
  let havuz = [];

  el.innerHTML = String(html`
    <div class="takvim-ust">
      <div class="btn-grup"><button class="btn ikincil kucuk" data-git="-1">‹</button><button class="btn ikincil kucuk" data-git="0">Bugün</button>
        <button class="btn ikincil kucuk" data-git="1">›</button></div>
      <h2 id="tk-baslik"></h2>
      <div class="segment" id="tk-gorunum">${[['gun', 'Gün'], ['3gun', '3 Gün'], ['hafta', 'Hafta'], ['ay', 'Ay']].map(([v, a]) => html`<button data-v="${v}">${a}</button>`)}</div>
      <input type="date" id="tk-tarih" style="width:auto;min-height:34px;padding:.25rem .5rem">
      <span class="bosluk"></span>
      <div class="ekip-filtre">${ekipler.map((e) => html`<label><input type="checkbox" data-ekip="${e.id}"><span class="nokta" style="background:${e.renk}"></span>${e.ad}</label>`)}
        <label><input type="checkbox" id="tk-not-goster"><span class="nokta" style="background:#f59e0b"></span>Notlar</label></div>
    </div>
    <div class="takvim-duzen">
      <aside class="takvim-havuz kart"><div class="kart-ust"><h3>İş havuzu</h3><span class="rozet" id="havuz-sayi">0</span></div>
        <div class="kart-govde" id="tk-havuz"></div></aside>
      <div id="tk-alan"></div>
    </div>`);

  // ---------- Aralık ----------
  function aralik() {
    const t = gunBasi(durum.tarih);
    if (durum.gorunum === 'gun') return { bas: t, gun: 1 };
    if (durum.gorunum === '3gun') return { bas: t, gun: 3 };
    if (durum.gorunum === 'hafta') return { bas: haftaBasi(t), gun: 7 };
    const ilk = new Date(t.getFullYear(), t.getMonth(), 1);
    return { bas: haftaBasi(ilk), gun: 42 };
  }
  function baslikMetni() {
    const { bas, gun } = aralik();
    if (durum.gorunum === 'ay') return durum.tarih.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    if (gun === 1) return bas.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const son = gunEkle(bas, gun - 1);
    return `${bas.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })} – ${son.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }

  async function yukle() {
    const { bas, gun } = aralik();
    const [o, h] = await Promise.all([
      api.get('/takvim', { bas: bas.toISOString(), bit: gunEkle(bas, gun).toISOString() }),
      api.get('/havuz'),
    ]);
    olaylar = o; havuz = h;
    ciz();
  }

  function gorunenler() {
    return olaylar.filter((o) => (o.tur === 'not' ? durum.notlar : durum.ekipler.has(o.ekip_id)));
  }

  // ---------- Çizim ----------
  function ciz() {
    yaz({ gorunum: durum.gorunum, ekipler: [...durum.ekipler], notlar: durum.notlar });
    $('#tk-baslik', el).textContent = baslikMetni();
    $('#tk-tarih', el).value = bugunStr(durum.tarih);
    $$('#tk-gorunum button', el).forEach((b) => b.classList.toggle('aktif', b.dataset.v === durum.gorunum));
    $$('[data-ekip]', el).forEach((c) => { c.checked = durum.ekipler.has(Number(c.dataset.ekip)); });
    $('#tk-not-goster', el).checked = durum.notlar;
    $('#havuz-sayi', el).textContent = havuz.length;
    $('#tk-havuz', el).innerHTML = String(havuz.length
      ? html`<p class="soluk" style="margin:0 0 .6rem;font-size:.85rem">Takvime sürükleyin veya tıklayın.</p>${havuz.map((i) => havuzKarti(i, { surukle: true }))}`
      : html`<div class="bos-durum" style="padding:1rem">Havuz boş</div>`);
    if (durum.gorunum === 'ay') ayCiz(); else saatCiz();
  }

  function saatCiz() {
    const { bas, gun } = aralik();
    const gunler = Array.from({ length: gun }, (_, i) => gunEkle(bas, i));
    const kolon = `52px repeat(${gun}, minmax(${gun > 3 ? 90 : 120}px, 1fr))`;
    const bugun = new Date();
    const liste = gorunenler();
    const toplamYuk = (SAAT_BIT - SAAT_BAS) * SAAT_YUK;
    $('#tk-alan', el).innerHTML = String(html`<div class="tk" style="--saat-yuk:${SAAT_YUK}px"><div class="tablo-kap">
      <div style="min-width:${gun > 3 ? 52 + gun * 90 : 0}px">
      <div class="tk-bas" style="grid-template-columns:${kolon}"><div></div>${gunler.map((g) => html`
        <div class="${ayniGun(g, bugun) ? 'bugun' : ''}">${GUNLER[(g.getDay() + 6) % 7]}<b>${g.getDate()}</b></div>`)}</div>
      <div class="tk-tumgun" style="grid-template-columns:${kolon}"><div class="tk-saat-et">Not</div>${gunler.map((g) => html`
        <div data-tumgun="${bugunStr(g)}">${liste.filter((o) => o.tur === 'not' && ayniGun(new Date(o.baslangic), g)).map((n) => html`
          <div class="tk-not ${n.durum === 'tamamlandi' ? 'tamam' : ''}" data-not="${n.id}" title="${n.baslik}">${n.tum_gun ? '' : saat(n.baslangic) + ' '}${n.baslik}</div>`)}</div>`)}</div>
      <div class="tk-govde" style="grid-template-columns:${kolon}">
        <div class="tk-saatler">${Array.from({ length: SAAT_BIT - SAAT_BAS }, (_, i) => html`<div>${i ? String(SAAT_BAS + i).padStart(2, '0') + ':00' : ''}</div>`)}</div>
        ${gunler.map((g) => html`<div class="tk-gun ${ayniGun(g, bugun) ? 'bugun' : ''}" data-gun="${bugunStr(g)}" style="height:${toplamYuk}px">
          ${yerlesim(liste.filter((o) => o.tur === 'is' && ayniGun(new Date(o.baslangic), g))).map(olayHtml)}
          ${ayniGun(g, bugun) && bugun.getHours() >= SAAT_BAS && bugun.getHours() < SAAT_BIT
            ? html`<div class="tk-simdi" style="top:${((bugun.getHours() - SAAT_BAS) * 60 + bugun.getMinutes()) * SAAT_YUK / 60}px"></div>` : ''}
        </div>`)}
      </div></div></div></div>`);
    // Sabah saatine kaydır
    const govde = $('.tk-govde', el);
    const hedefSaat = gunler.some((g) => ayniGun(g, bugun)) ? Math.max(SAAT_BAS, bugun.getHours() - 1) : 8;
    govde.scrollTop = (hedefSaat - SAAT_BAS) * SAAT_YUK;
  }

  // Çakışan işleri yan yana diz
  function yerlesim(liste) {
    const s = liste.map((o) => ({ ...o, _b: new Date(o.baslangic).getTime(), _s: new Date(o.bitis || new Date(new Date(o.baslangic).getTime() + 3600000)).getTime() }))
      .sort((a, b) => a._b - b._b || b._s - a._s);
    let kume = []; let kumeSon = 0;
    const bitir = () => {
      const seritler = [];
      for (const o of kume) {
        let i = seritler.findIndex((son) => son <= o._b);
        if (i < 0) { i = seritler.length; seritler.push(0); }
        seritler[i] = o._s; o._serit = i;
      }
      kume.forEach((o) => { o._toplam = seritler.length; });
      kume = [];
    };
    for (const o of s) {
      if (kume.length && o._b >= kumeSon) bitir();
      kume.push(o); kumeSon = Math.max(kumeSon, o._s);
    }
    bitir();
    return s;
  }

  function olayHtml(o) {
    const b = new Date(o._b); const s = new Date(o._s);
    const dk = (d) => (d.getHours() - SAAT_BAS) * 60 + d.getMinutes();
    const ust = Math.max(0, Math.min(dk(b), (SAAT_BIT - SAAT_BAS) * 60 - 30));
    const alt = Math.max(ust + 22, Math.min(dk(s) + (ayniGun(b, s) ? 0 : 24 * 60), (SAAT_BIT - SAAT_BAS) * 60));
    const gen = 100 / o._toplam;
    return html`<div class="tk-olay ${o.durum}" data-olay="${o.id}" data-durum="${o.durum}"
      style="top:${ust * SAAT_YUK / 60}px;height:${Math.max(22, (alt - ust) * SAAT_YUK / 60 - 2)}px;left:calc(${o._serit * gen}% + 2px);width:calc(${gen}% - 4px);right:auto;background:${o.renk}"
      title="${o.baslik} · ${saat(o.baslangic)}${o.unvan ? ' · ' + o.unvan : ''}">
      <b>${o.baslik}</b><small>${saat(o.baslangic)}${o.unvan ? ' · ' + o.unvan : ''}</small>${(alt - ust) > 60 && o.adres ? html`<small>📍 ${o.adres}</small>` : ''}</div>`;
  }

  function ayCiz() {
    const { bas } = aralik();
    const ay = durum.tarih.getMonth();
    const bugun = new Date();
    const liste = gorunenler();
    $('#tk-alan', el).innerHTML = String(html`<div class="tk"><div class="tk-ay-bas">${GUNLER.map((g) => html`<div>${g}</div>`)}</div>
      <div class="tk-ay">${Array.from({ length: 42 }, (_, i) => {
        const g = gunEkle(bas, i);
        const gunun = liste.filter((o) => ayniGun(new Date(o.baslangic), g)).sort((a, b) => (a.tur === 'not' ? -1 : 0) - (b.tur === 'not' ? -1 : 0) || new Date(a.baslangic) - new Date(b.baslangic));
        const sinir = mobil ? 2 : 4;
        return html`<div class="tk-ay-gun ${g.getMonth() !== ay ? 'disarida' : ''} ${ayniGun(g, bugun) ? 'bugun' : ''}" data-ay-gun="${bugunStr(g)}">
          <span class="gun-no">${g.getDate()}</span>
          ${gunun.slice(0, sinir).map((o) => (o.tur === 'not'
            ? html`<div class="tk-not" data-not="${o.id}">${o.baslik}</div>`
            : html`<div class="tk-ay-olay" style="background:${o.renk}" data-olay="${o.id}">${saat(o.baslangic)} ${o.baslik}</div>`))}
          ${gunun.length > sinir ? html`<div class="tk-ay-fazla">+${gunun.length - sinir} daha</div>` : ''}</div>`;
      })}</div></div>`);
  }

  // ---------- Etkileşim ----------
  const zamanBul = (gunEl, clientY) => {
    const r = gunEl.getBoundingClientRect();
    const dk = Math.max(0, Math.min((clientY - r.top) / SAAT_YUK * 60, (SAAT_BIT - SAAT_BAS) * 60 - ADIM_DK));
    const yuvarla = Math.floor(dk / 30) * 30;
    const d = new Date(gunEl.dataset.gun + 'T00:00');
    d.setHours(SAAT_BAS, yuvarla, 0, 0);
    return d;
  };
  const tekEkip = () => (durum.ekipler.size === 1 ? [...durum.ekipler][0] : ekipler[0]?.id);

  async function bosAlanaTikla(zaman, tumGun = false) {
    const secim = await pencere({
      baslik: zaman.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }) + (tumGun ? '' : ' · ' + saat(zaman)),
      icerik: html`<div style="display:grid;gap:.5rem">
        <button type="button" class="btn birincil buyuk" data-sec="yeni">+ Yeni iş oluştur</button>
        <button type="button" class="btn ikincil buyuk" data-sec="havuz" ${havuz.length ? '' : 'disabled'}>Havuzdan iş seç (${havuz.length})</button>
        <button type="button" class="btn ikincil buyuk" data-sec="not">Hatırlatma notu ekle</button></div>`,
      kaydetMetin: null,
      acildi: (d, kapat) => d.addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (b) kapat(b.dataset.sec); }),
    });
    if (secim === 'yeni') { if (await yeniIsPenceresi(ctx, { baslangic: zaman, ekipId: tekEkip() })) yukle(); }
    else if (secim === 'havuz') havuzdanSec(zaman);
    else if (secim === 'not') notPenceresi(null, zaman);
  }

  async function havuzdanSec(zaman) {
    const is = await pencere({
      baslik: 'Havuzdan iş seç',
      icerik: html`<div>${havuz.map((i) => html`<div style="cursor:pointer" data-sec-is="${i.id}">${havuzKarti(i)}</div>`)}</div>`,
      kaydetMetin: null,
      acildi: (d, kapat) => d.addEventListener('click', (e) => { const b = e.target.closest('[data-sec-is]'); if (b) kapat(havuz.find((x) => x.id === Number(b.dataset.secIs))); }),
    });
    if (is && await planlaPenceresi(ctx, is, { baslangic: zaman, ekipId: tekEkip() })) yukle();
  }

  async function notPenceresi(not, zaman) {
    const n = not || { baslik: '', aciklama: '', baslangic: zaman.toISOString(), tum_gun: true };
    const r = await pencere({
      baslik: not ? 'Not' : 'Hatırlatma notu',
      icerik: html`<label class="alan"><span>Not *</span><input name="baslik" value="${n.baslik}" required></label>
        <label class="alan"><span>Açıklama</span><textarea name="aciklama" rows="3">${n.aciklama || ''}</textarea></label>
        <label class="alan"><span>Tarih</span><input type="date" name="tarih" value="${bugunStr(new Date(n.baslangic))}"></label>
        ${not ? html`<label class="kutu-sec"><input type="checkbox" name="tamamlandi" ${n.durum === 'tamamlandi' ? 'checked' : ''}> Tamamlandı</label>` : ''}`,
      altBilgi: not ? html`<button type="button" class="btn tehlike-cizgi" data-sil>Sil</button>` : '',
      acildi: (d, kapat) => { const s = $('[data-sil]', d); if (s) s.onclick = async () => { if (await onayla('Not silinsin mi?')) { await api.del(`/notlar/${not.id}`); kapat('silindi'); } }; },
      kaydet: async (v) => {
        if (!v.baslik) throw new Error('Not yazın.');
        const govde = { baslik: v.baslik, aciklama: v.aciklama, baslangic: new Date(v.tarih + 'T09:00').toISOString(), tum_gun: true, tamamlandi: v.tamamlandi };
        if (not) await api.put(`/notlar/${not.id}`, govde); else await api.post('/notlar', govde);
      },
    });
    if (r) yukle();
  }

  // Not detayı: takvim beslemesinde açıklama yok, notu notlar listesinden alırız
  async function notAc(id) {
    const n = olaylar.find((o) => o.tur === 'not' && o.id === id);
    if (n) notPenceresi(n);
  }

  el.addEventListener('click', async (e) => {
    const git = e.target.closest('[data-git]');
    if (git) {
      const y = Number(git.dataset.git);
      if (y === 0) durum.tarih = new Date();
      else {
        const { gun } = aralik();
        if (durum.gorunum === 'ay') durum.tarih = new Date(durum.tarih.getFullYear(), durum.tarih.getMonth() + y, 1);
        else durum.tarih = gunEkle(durum.tarih, y * (durum.gorunum === 'hafta' ? 7 : gun));
      }
      return yukle();
    }
    const gv = e.target.closest('#tk-gorunum button');
    if (gv) { durum.gorunum = gv.dataset.v; return yukle(); }
    if (el._suruklendi) { el._suruklendi = false; return; }
    const o = e.target.closest('[data-olay]');
    if (o) return ctx.git(`is/${o.dataset.olay}`);
    const n = e.target.closest('[data-not]');
    if (n) return notAc(Number(n.dataset.not));
    const hk = e.target.closest('.takvim-havuz [data-is]');
    if (hk) { const is = havuz.find((x) => x.id === Number(hk.dataset.is)); if (is && await planlaPenceresi(ctx, is, { ekipId: tekEkip() })) yukle(); return; }
    const ag = e.target.closest('[data-ay-gun]');
    if (ag) {
      if (e.target.closest('.gun-no') || e.target.closest('.tk-ay-fazla')) { durum.tarih = new Date(ag.dataset.ayGun + 'T12:00'); durum.gorunum = 'gun'; return yukle(); }
      const z = new Date(ag.dataset.ayGun + 'T09:00');
      return bosAlanaTikla(z, true);
    }
    const tg = e.target.closest('[data-tumgun]');
    if (tg) return notPenceresi(null, new Date(tg.dataset.tumgun + 'T09:00'));
    const g = e.target.closest('.tk-gun');
    if (g) return bosAlanaTikla(zamanBul(g, e.clientY));
  });

  el.addEventListener('change', (e) => {
    if (e.target.dataset.ekip) {
      const id = Number(e.target.dataset.ekip);
      if (e.target.checked) durum.ekipler.add(id); else durum.ekipler.delete(id);
      ciz();
    } else if (e.target.id === 'tk-not-goster') { durum.notlar = e.target.checked; ciz(); }
    else if (e.target.id === 'tk-tarih' && e.target.value) { durum.tarih = new Date(e.target.value + 'T12:00'); yukle(); }
  });

  // ---------- Havuzdan sürükle-bırak (masaüstü) ----------
  el.addEventListener('dragstart', (e) => {
    const k = e.target.closest('[data-is]');
    if (!k) return;
    e.dataTransfer.setData('text/plain', k.dataset.is);
    e.dataTransfer.effectAllowed = 'move';
  });
  el.addEventListener('dragover', (e) => {
    const g = e.target.closest('.tk-gun, [data-ay-gun]');
    if (!g) return;
    e.preventDefault();
    $$('.uzerinde', el).forEach((x) => x !== g && x.classList.remove('uzerinde'));
    g.classList.add('uzerinde');
  });
  el.addEventListener('dragleave', (e) => { const g = e.target.closest('.tk-gun, [data-ay-gun]'); if (g && !g.contains(e.relatedTarget)) g.classList.remove('uzerinde'); });
  el.addEventListener('drop', async (e) => {
    const g = e.target.closest('.tk-gun, [data-ay-gun]');
    if (!g) return;
    e.preventDefault();
    g.classList.remove('uzerinde');
    const is = havuz.find((x) => x.id === Number(e.dataTransfer.getData('text/plain')));
    if (!is) return;
    const zaman = g.dataset.gun ? zamanBul(g, e.clientY) : new Date(g.dataset.ayGun + 'T09:00');
    if (await planlaPenceresi(ctx, is, { baslangic: zaman, ekipId: tekEkip() })) yukle();
  });

  // ---------- Planlı işi sürükleyerek taşıma (fare) ----------
  el.addEventListener('pointerdown', (e) => {
    const olayEl = e.target.closest('.tk-olay');
    if (!olayEl || e.pointerType !== 'mouse' || e.button !== 0) return;
    if (olayEl.dataset.durum !== 'planlandi') return;
    const o = olaylar.find((x) => x.tur === 'is' && x.id === Number(olayEl.dataset.olay));
    const r = olayEl.getBoundingClientRect();
    const tutma = e.clientY - r.top;
    const basX = e.clientX; const basY = e.clientY;
    let hareket = false; let hedef = null;
    const sure = new Date(o.bitis || o.baslangic).getTime() - new Date(o.baslangic).getTime() || 3600000;
    const tasi = (m) => {
      if (!hareket && Math.hypot(m.clientX - basX, m.clientY - basY) < 6) return;
      if (!hareket) { hareket = true; olayEl.classList.add('surukleniyor'); }
      const altta = document.elementFromPoint(m.clientX, m.clientY)?.closest('.tk-gun');
      if (!altta) return;
      if (olayEl.parentElement !== altta) { altta.append(olayEl); olayEl.style.left = '2px'; olayEl.style.width = 'calc(100% - 4px)'; }
      const gr = altta.getBoundingClientRect();
      let dk = Math.round(((m.clientY - tutma - gr.top) / SAAT_YUK * 60) / ADIM_DK) * ADIM_DK;
      dk = Math.max(0, Math.min(dk, (SAAT_BIT - SAAT_BAS) * 60 - ADIM_DK));
      olayEl.style.top = `${dk * SAAT_YUK / 60}px`;
      const z = new Date(altta.dataset.gun + 'T00:00'); z.setHours(SAAT_BAS, dk, 0, 0);
      hedef = z;
      $('small', olayEl).textContent = `${saat(z)} → taşınıyor`;
    };
    const birak = async () => {
      document.removeEventListener('pointermove', tasi);
      document.removeEventListener('pointerup', birak);
      if (!hareket) return;
      el._suruklendi = true;
      setTimeout(() => { el._suruklendi = false; }, 50);
      if (!hedef || hedef.getTime() === new Date(o.baslangic).getTime()) return ciz();
      try {
        await api.post(`/isler/${o.id}/planla`, { ekip_id: o.ekip_id, baslangic: hedef.toISOString(), bitis: new Date(hedef.getTime() + sure).toISOString() });
        bildir(`Taşındı: ${hedef.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })} ${saat(hedef)}`, 'basari');
        yukle();
      } catch (err) { bildir(err.message, 'hata'); ciz(); }
    };
    document.addEventListener('pointermove', tasi);
    document.addEventListener('pointerup', birak);
  });

  await yukle();
  void durumRozet;
}
