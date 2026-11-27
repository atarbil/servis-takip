// Telefon: İşler — Bugün / Havuz / Takvim / Tümü bölümleri, kart listeleri
import { api } from '../api.js';
import { html, $, $$, saat, tarih, gunAdi, bugunStr, durumRozet, sureMetni, debounce, DURUM } from '../ui.js';

const BOLUMLER = [['bugun', 'Bugün'], ['havuz', 'Havuz'], ['takvim', 'Takvim'], ['tum', 'Tümü']];
const gun = (t) => bugunStr(new Date(t));
const gunEkle = (s, n) => { const d = new Date(`${s}T12:00:00`); d.setDate(d.getDate() + n); return bugunStr(d); };
const haftaBasi = (s) => { const d = new Date(`${s}T12:00:00`); const g = (d.getDay() + 6) % 7; d.setDate(d.getDate() - g); return bugunStr(d); };
const gunBasligi = (s) => {
  const b = bugunStr();
  if (s === b) return 'Bugün'; if (s === gunEkle(b, 1)) return 'Yarın'; if (s === gunEkle(b, -1)) return 'Dün';
  return `${tarih(`${s}T12:00:00`)} ${gunAdi(`${s}T12:00:00`)}`;
};

export function isKarti(i, { zamanGoster = 'saat' } = {}) {
  const zmn = i.plan_baslangic ? (zamanGoster === 'tarih' ? `${tarih(i.plan_baslangic)} ${saat(i.plan_baslangic)}` : `${saat(i.plan_baslangic)}${i.plan_bitis ? '–' + saat(i.plan_bitis) : ''}`) : '';
  return html`<a class="mk-kart" href="#/is/${i.id}" style="--serit:${i.ekip_renk || 'var(--cizgi)'}">
    <div class="mk-kart-ust"><b class="mk-kart-baslik">${i.oncelik === 1 ? html`<span class="mk-acil">Acil</span> ` : ''}${i.baslik}</b>${durumRozet(i.durum)}</div>
    ${i.cari_unvan || i.unvan || i.iletisim_ad ? html`<div class="mk-kart-satir">${i.cari_unvan || i.unvan || i.iletisim_ad}</div>` : ''}
    <div class="mk-kart-alt">${zmn ? html`<span>🕒 ${zmn}</span>` : ''}${i.ekip_ad ? html`<span>${i.ekip_ad}</span>` : ''}${i.adres ? html`<span class="mk-kisa">📍 ${i.adres}</span>` : ''}<span class="soluk">#${i.id}</span></div>
  </a>`;
}

export default async function (el, _p, ctx) {
  let bolum = BOLUMLER.some(([k]) => k === ctx.sorgu.b) ? ctx.sorgu.b : 'bugun';
  let ekipId = ctx.sorgu.ekip || '';
  let hafta = haftaBasi(ctx.sorgu.h || bugunStr());
  let aramaQ = ctx.sorgu.q || ''; let durumF = ctx.sorgu.d === 'hepsi' ? '' : (ctx.sorgu.d || 'acik');
  const ekipler = await ctx.ekipler().catch(() => []);
  ctx.baslik('İşler');

  // Bölüm / filtre adreste tutulur: başka sayfadan geri gelince aynı yer açılır
  const adresGuncelle = () => {
    const q = new URLSearchParams({ b: bolum });
    if (ekipId) q.set('ekip', ekipId);
    if (bolum === 'takvim' && hafta !== haftaBasi(bugunStr())) q.set('h', hafta);
    if (bolum === 'tum') { if (aramaQ) q.set('q', aramaQ); if (durumF !== 'acik') q.set('d', durumF || 'hepsi'); }
    history.replaceState(history.state, '', `#/isler?${q}`);
  };

  el.innerHTML = String(html`
    <div class="mk-yapiskan"><div class="mk-bolumler" role="tablist">${BOLUMLER.map(([k, ad]) => html`<button type="button" role="tab" data-bolum="${k}">${ad}</button>`)}</div>
    <div class="mk-arac" id="mk-arac"></div></div>
    <div id="mk-liste"><div class="yukleniyor"><span></span></div></div>`);
  const liste = $('#mk-liste', el); const arac = $('#mk-arac', el);

  const ekipCipleri = () => (ekipler.length > 1 ? html`<div class="mk-cipler">
      <button type="button" class="mk-cip ${!ekipId ? 'secili' : ''}" data-ekip="">Tüm ekipler</button>
      ${ekipler.filter((e) => e.aktif !== false).map((e) => html`<button type="button" class="mk-cip ${String(e.id) === String(ekipId) ? 'secili' : ''}" data-ekip="${e.id}"><span class="nokta" style="background:${e.renk}"></span>${e.ad}</button>`)}</div>` : '');

  let istek = 0;
  async function ciz() {
    const no = ++istek;
    $$('[data-bolum]', el).forEach((b) => { const s = b.dataset.bolum === bolum; b.classList.toggle('secili', s); b.setAttribute('aria-selected', s); });
    adresGuncelle();
    // Araç satırı
    if (bolum === 'bugun') arac.innerHTML = String(ekipCipleri());
    else if (bolum === 'takvim') {
      arac.innerHTML = String(html`<div class="mk-hafta"><button type="button" class="btn ikincil" data-hafta="-7" aria-label="Önceki hafta">‹</button>
        <b>${tarih(`${hafta}T12:00:00`)} – ${tarih(`${gunEkle(hafta, 6)}T12:00:00`)}</b>
        <button type="button" class="btn ikincil" data-hafta="7" aria-label="Sonraki hafta">›</button>
        ${hafta !== haftaBasi(bugunStr()) ? html`<button type="button" class="btn-metin" data-hafta="0">Bu hafta</button>` : ''}</div>${ekipCipleri()}`);
    } else if (bolum === 'tum') {
      if (!$('#mk-ara', arac)) {
        arac.innerHTML = String(html`<input type="search" id="mk-ara" placeholder="Ara: başlık, müşteri, adres, iş no" value="${aramaQ}" enterkeyhint="search">
          <div class="mk-cipler">${[['acik', 'Açık'], ['tamamlandi', 'Tamamlanan'], ['fis_kesildi', 'Fişi kesilen'], ['iptal', 'İptal'], ['', 'Hepsi']].map(([k, ad]) => html`<button type="button" class="mk-cip" data-durum="${k}">${ad}</button>`)}</div>`);
        $('#mk-ara', arac).addEventListener('input', debounce((e) => { aramaQ = e.target.value.trim(); ciz(); }, 300));
      }
      $$('[data-durum]', arac).forEach((b) => b.classList.toggle('secili', b.dataset.durum === durumF));
    } else arac.innerHTML = '';
    if (bolum !== 'tum') liste.innerHTML = '<div class="yukleniyor"><span></span></div>';

    let govde;
    if (bolum === 'bugun') {
      const l = await api.get('/islerim', { ekip_id: ekipId || undefined });
      const b = bugunStr(); const yarin = gunEkle(b, 1);
      const gruplar = [
        ['Şu an sahada', l.filter((i) => i.durum === 'sahada')],
        ['Tarihi geçmiş', l.filter((i) => i.durum === 'planlandi' && gun(i.plan_baslangic) < b)],
        ['Bugün', l.filter((i) => i.durum === 'planlandi' && gun(i.plan_baslangic) === b)],
        ['Yarın', l.filter((i) => i.durum === 'planlandi' && gun(i.plan_baslangic) === yarin)],
        ['Sonraki günler', l.filter((i) => i.durum === 'planlandi' && gun(i.plan_baslangic) > yarin)],
        ['Bugün tamamlanan', l.filter((i) => ['tamamlandi', 'fis_kesildi'].includes(i.durum))],
      ].filter(([, x]) => x.length);
      govde = gruplar.length ? gruplar.map(([ad, x]) => html`<h3 class="mk-grup">${ad} <small>${x.length}</small></h3>
          ${x.map((i) => isKarti(i, { zamanGoster: ad === 'Bugün' || ad === 'Şu an sahada' ? 'saat' : 'tarih' }))}`)
        : html`<div class="mk-bos">Planlı iş yok.<br><a href="#/isler?b=havuz">Havuzdaki işlere bakın</a></div>`;
    } else if (bolum === 'havuz') {
      const l = await api.get('/havuz');
      govde = l.length ? html`<p class="mk-not">${l.length} iş takvime yerleştirilmeyi bekliyor. İşe dokunup <b>Takvime yerleştir</b>'i seçin.</p>
        ${l.map((i) => html`<a class="mk-kart" href="#/is/${i.id}" style="--serit:${i.oncelik === 1 ? 'var(--kirmizi)' : 'var(--cizgi)'}">
          <div class="mk-kart-ust"><b class="havuz-cari ${i.unvan ? '' : 'yok'}">${i.oncelik === 1 ? html`<span class="mk-acil">Acil</span> ` : ''}${i.unvan || 'Cari bağlı değil'}</b></div>
          <div class="havuz-aciklama">${i.baslik}</div>
          <div class="mk-kart-alt"><span>⏳ ${sureMetni(i.bekleme_sn)} bekliyor</span>${i.havuza_donus_sayisi ? html`<span class="turuncu-yazi">${i.havuza_donus_sayisi}. kez havuzda</span>` : ''}${i.adres ? html`<span class="mk-kisa">📍 ${i.adres}</span>` : ''}<span class="soluk">#${i.id}</span></div></a>`)}`
        : html`<div class="mk-bos">Havuz boş 🎉</div>`;
    } else if (bolum === 'takvim') {
      const l = await api.get('/takvim', { bas: `${hafta}T00:00:00`, bit: `${gunEkle(hafta, 7)}T00:00:00` });
      const secili = l.filter((o) => !ekipId || o.tur !== 'is' || String(o.ekip_id) === String(ekipId));
      const ekipAd = Object.fromEntries(ekipler.map((e) => [String(e.id), e.ad]));
      govde = [...Array(7)].map((_, n) => {
        const g = gunEkle(hafta, n);
        const o = secili.filter((x) => gun(x.baslangic) === g || (x.bitis && gun(x.baslangic) < g && gun(x.bitis) >= g));
        return html`<h3 class="mk-grup ${g === bugunStr() ? 'bugun' : ''}">${gunBasligi(g)} ${o.length ? html`<small>${o.length}</small>` : ''}</h3>
          ${o.length ? o.map((x) => (x.tur === 'is'
            ? isKarti({ id: x.id, baslik: x.baslik, durum: x.durum, unvan: x.unvan, adres: x.adres, plan_baslangic: x.baslangic, plan_bitis: x.bitis, ekip_renk: x.renk, ekip_ad: ekipAd[String(x.ekip_id)] })
            : html`<div class="mk-kart mk-notkart" style="--serit:${x.renk || 'var(--mor)'}"><div class="mk-kart-ust"><b class="mk-kart-baslik">📝 ${x.baslik}</b></div>
                <div class="mk-kart-alt">${x.tum_gun ? html`<span>Tüm gün</span>` : html`<span>🕒 ${saat(x.baslangic)}${x.bitis ? '–' + saat(x.bitis) : ''}</span>`}</div>
                ${x.aciklama ? html`<div class="mk-kart-satir">${x.aciklama}</div>` : ''}</div>`))
            : html`<div class="mk-bos-gun">—</div>`}`;
      });
    } else {
      const durum = durumF === 'acik' ? 'havuz,planlandi,sahada' : durumF;
      const l = await api.get('/isler', { q: aramaQ || undefined, durum: durum || undefined, limit: 100 });
      govde = l.length ? l.map((i) => isKarti(i, { zamanGoster: 'tarih' })) : html`<div class="mk-bos">${aramaQ ? 'Aramaya uyan iş yok.' : 'İş yok.'}</div>`;
    }
    if (no !== istek) return;
    liste.innerHTML = String(html`${govde}`);
  }

  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-bolum]');
    if (b) { if (b.dataset.bolum !== bolum) { bolum = b.dataset.bolum; window.scrollTo(0, 0); ciz(); } return; }
    const ek = e.target.closest('[data-ekip]');
    if (ek) { ekipId = ek.dataset.ekip; ciz(); return; }
    const h = e.target.closest('[data-hafta]');
    if (h) { const n = Number(h.dataset.hafta); hafta = n ? gunEkle(hafta, n) : haftaBasi(bugunStr()); ciz(); return; }
    const d = e.target.closest('[data-durum]');
    if (d) { durumF = d.dataset.durum; ciz(); }
  });
  void DURUM;
  await ciz();
}
