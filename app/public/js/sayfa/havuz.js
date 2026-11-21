import { api } from '../api.js';
import { html, $, bildir, pencere, sor, onayla, sureMetni, telLink, ONCELIK } from '../ui.js';
import { planlaPenceresi, yeniIsPenceresi } from '../bilesen.js';

// Hızlı iş kutusu: panel ve havuz sayfasında kullanılır
export function hizliKutu(kap, ctx, sonra) {
  kap.innerHTML = String(html`<form class="hizli-kutu">
    <textarea name="mesaj" placeholder="Örn: Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33" required></textarea>
    <div class="btn-grup"><button class="btn birincil">Havuza ekle</button>
      <select name="oncelik" style="width:auto"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select>
      <span class="soluk" style="font-size:.85rem">Telefon numarası yazarsanız müşteri otomatik bulunur. Ctrl+Enter ile ekleyin.</span></div></form>`);
  const f = $('form', kap);
  f.mesaj.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit(); });
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.mesaj.value.trim()) return;
    const btn = $('button', f); btn.disabled = true;
    try {
      const r = await api.post('/isler/hizli', { mesaj: f.mesaj.value, oncelik: Number(f.oncelik.value) });
      bildir(r.cari ? `Havuza eklendi · ${r.cari.unvan} ile eşleşti` : 'Havuza eklendi (müşteri eşleşmedi, sonra bağlayabilirsiniz)', 'basari', 4500);
      f.reset();
      sonra?.(r);
    } catch (err) { bildir(err.message, 'hata'); }
    btn.disabled = false;
  };
}

// Üst çubuktaki "+ Hızlı iş" düğmesi
export function hizliIs(ctx) {
  let sonuc = null;
  pencere({
    baslik: 'Hızlı iş ekle',
    icerik: html`<div id="hizli-p"></div>`,
    kaydetMetin: null, iptalMetin: 'Kapat',
    acildi: (d, kapat) => hizliKutu($('#hizli-p', d), ctx, (r) => { sonuc = r; kapat(r); }),
  }).then(() => { if (sonuc && /havuz|panel|takvim/.test(location.hash || '#/panel')) ctx.yenile(); });
}

export function havuzKarti(i, { surukle = false } = {}) {
  return html`<div class="is-kart oncelik-${i.oncelik} ${surukle ? 'surukle' : ''}" data-is="${i.id}" ${surukle ? html`draggable="true"` : ''}>
    <div class="is-ust"><div class="is-baslik">${i.baslik}</div>${i.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}</div>
    <div class="is-bilgi"><span>#${i.id}</span>${i.unvan ? html`<span>👤 ${i.unvan}</span>` : html`<span style="color:var(--turuncu)">Cari bağlı değil</span>`}
      ${i.iletisim_tel ? html`<span>📞 ${i.iletisim_tel}</span>` : ''}
      <span>⏱ ${sureMetni(i.bekleme_sn)} önce</span>${i.havuza_donus_sayisi ? html`<span>↩ ${i.havuza_donus_sayisi} kez ertelendi</span>` : ''}</div>
    ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}
  </div>`;
}

export default async function (el, _p, ctx) {
  ctx.baslik('İş Havuzu');
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>İş Havuzu</h2><span class="alt">Takvime yerleştirilmeyi bekleyen işler</span><span class="bosluk"></span>
      <button class="btn ikincil" id="yeni-detayli">+ Detaylı iş</button></div>
    <div class="kart"><div class="kart-govde" id="hizli"></div></div>
    <div id="liste"></div>`);
  const ciz = async () => {
    const liste = await api.get('/havuz');
    $('#liste', el).innerHTML = String(liste.length ? html`
      <div class="grup-baslik">${liste.length} iş bekliyor</div>
      ${liste.map((i) => html`<div class="is-kart oncelik-${i.oncelik}">
        <div class="is-ust"><a class="is-baslik" href="#/is/${i.id}">${i.baslik}</a>
          <span class="rozet ${i.oncelik === 1 ? 'kirmizi' : i.oncelik === 3 ? '' : 'mavi'}">${ONCELIK[i.oncelik]}</span></div>
        <div class="is-bilgi"><span>#${i.id}</span>
          ${i.unvan ? html`<span>👤 ${i.unvan}</span>` : html`<span style="color:var(--turuncu)">Cari bağlı değil</span>`}
          ${i.iletisim_tel ? html`<span>📞 ${telLink(i.iletisim_tel)}</span>` : ''}
          <span>⏱ ${sureMetni(i.bekleme_sn)} önce</span>
          ${i.havuza_donus_sayisi ? html`<span>↩ ${i.havuza_donus_sayisi} kez havuza döndü</span>` : ''}</div>
        ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}
        ${i.ham_mesaj && i.ham_mesaj !== i.baslik ? html`<div class="is-bilgi" style="white-space:pre-wrap">💬 ${i.ham_mesaj}</div>` : ''}
        <div class="btn-grup">
          <button class="btn birincil kucuk" data-planla="${i.id}">📅 Takvime yerleştir</button>
          <a class="btn ikincil kucuk" href="#/is/${i.id}">Detay / düzenle</a>
          <button class="btn tehlike-cizgi kucuk" data-iptal="${i.id}">İptal</button>
        </div></div>`)}`
      : html`<div class="bos-durum"><b>Havuz boş</b>Telefonla gelen işi yukarıdaki kutuya yazın.</div>`);
    el._liste = liste;
  };
  hizliKutu($('#hizli', el), ctx, ciz);
  await ciz();
  $('#yeni-detayli', el).onclick = async () => { if (await yeniIsPenceresi(ctx, { havuza: true })) ciz(); };
  el.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-planla]');
    if (p) {
      const is = el._liste.find((x) => x.id === Number(p.dataset.planla));
      if (await planlaPenceresi(ctx, is)) ciz();
    }
    const ip = e.target.closest('[data-iptal]');
    if (ip) {
      const neden = await sor('İşi iptal et', 'İptal nedeni', { zorunlu: true });
      if (!neden) return;
      try { await api.post(`/isler/${ip.dataset.iptal}/iptal`, { neden }); bildir('İş iptal edildi.'); ciz(); } catch (err) { bildir(err.message, 'hata'); }
    }
  });
  void onayla;
}
