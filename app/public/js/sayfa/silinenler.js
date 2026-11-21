// Silinenler kutusu: 30 gün içinde geri alınabilir
import { api } from '../api.js';
import { html, $, zaman, bildir, onayla } from '../ui.js';

const TUR_AD = {
  satis_fisi: 'Satış fişi', alis_faturasi: 'Alış faturası', teklif: 'Teklif / proforma', finans: 'Kasa / banka',
  is: 'İş', cari: 'Cari', urun: 'Ürün', envanter: 'Envanter', takvim_notu: 'Takvim notu', kullanici: 'Kullanıcı',
};

export default async function (el, _p, ctx) {
  ctx.baslik('Silinenler');
  let durum = ctx.sorgu.durum === 'geri_alindi' ? 'geri_alindi' : 'bekliyor';
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Silinenler</h2><span class="alt">Silinen kayıtlar 30 gün burada durur, geri alınabilir</span></div>
    <div class="sekmeler"><button data-d="bekliyor">Silinenler</button><button data-d="geri_alindi">Geri alınanlar</button></div>
    <div id="liste"></div>`);

  const ciz = async () => {
    el.querySelectorAll('[data-d]').forEach((b) => b.classList.toggle('aktif', b.dataset.d === durum));
    const l = await api.get('/silinenler', { durum });
    $('#liste', el).innerHTML = String(l.length ? html`<div class="silinen-liste">${l.map((s) => html`
      <div class="kart silinen" data-id="${s.id}">
        <div class="silinen-ust">
          <span class="rozet">${TUR_AD[s.tur] || s.tur}</span>
          <b class="silinen-baslik">${s.baslik}</b>
          ${s.adet > 1 ? html`<span class="soluk">+${s.adet - 1} bağlı kayıt</span>` : ''}
          <span class="bosluk"></span>
          ${durum === 'bekliyor' ? html`<span class="rozet ${s.kalan_gun <= 5 ? 'kirmizi' : 'turuncu'}" title="Bu süre sonunda kalıcı olur">${s.kalan_gun} gün kaldı</span>` : ''}
        </div>
        <div class="silinen-alt soluk">${durum === 'bekliyor'
          ? html`${s.silen || 'sistem'} sildi · ${zaman(s.zaman)}`
          : html`${s.silen || 'sistem'} sildi · ${zaman(s.zaman)} — ${s.islem_yapan || ''} geri aldı · ${zaman(s.islem_zamani)}`}</div>
        <details><summary>Ne silindi? (${s.ozet.length})</summary><ul class="sil-ozet">${s.ozet.map((m) => html`<li>${m}</li>`)}</ul></details>
        ${durum === 'bekliyor' ? html`<div class="btn-grup" style="margin-top:.5rem">
          <button class="btn birincil kucuk" data-geri="${s.id}">↩ Geri al</button>
          <button class="btn tehlike-cizgi kucuk" data-kalici="${s.id}">Kalıcı olarak sil</button></div>` : ''}
      </div>`)}</div>`
      : html`<div class="kart"><div class="bos-durum">${durum === 'bekliyor' ? 'Silinen kayıt yok.' : 'Geri alınan kayıt yok.'}</div></div>`);
  };

  el.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-d]');
    if (d) { durum = d.dataset.d; return ciz(); }
    const g = e.target.closest('[data-geri]');
    if (g) {
      g.disabled = true;
      try {
        const r = await api.post(`/silinenler/${g.dataset.geri}/geri-al`);
        bildir(`${r.baslik} geri alındı; bakiye ve stok etkileri yeniden uygulandı.`, 'basari', 5000);
        ctx.sayacYenile?.(); ciz();
      } catch (err) { bildir(err.message, 'hata', 7000); g.disabled = false; }
      return;
    }
    const k = e.target.closest('[data-kalici]');
    if (k && await onayla('Kalıcı olarak silinsin mi? Bu işlem geri alınamaz.', { evet: 'Kalıcı sil', tehlike: true })) {
      try { await api.post(`/silinenler/${k.dataset.kalici}/kalici`); bildir('Kalıcı olarak silindi.'); ciz(); } catch (err) { bildir(err.message, 'hata'); }
    }
  });
  await ciz();
}
