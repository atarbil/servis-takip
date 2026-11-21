import { api } from '../api.js';
import { html, $, para, miktar, debounce, csvIndir } from '../ui.js';
import { urunFormu } from '../bilesen.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Ürünler / Stok');
  const f = { q: '', onay_bekliyor: ctx.sorgu.onay ? '1' : '', kategori: '' };
  const kategoriler = await api.get('/urun-kategorileri');
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Ürünler / Stok</h2><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><button class="btn birincil" id="yeni">+ Yeni ürün</button></div>
    <div class="filtre"><input type="search" id="q" placeholder="Ürün adı, kod veya barkod…">
      <button class="btn ikincil" id="barkod" title="Barkodla ara">📷</button>
      <select id="kat"><option value="">Tüm kategoriler</option>${kategoriler.map((k) => html`<option>${k}</option>`)}</select>
      <label class="kutu-sec" style="margin:0"><input type="checkbox" id="onay" ${f.onay_bekliyor ? 'checked' : ''}> Sadece onay bekleyenler</label></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/urunler', { ...f, limit: 2000 });
    const deger = veri.reduce((a, u) => a + Math.max(0, Number(u.stok_miktari)) * Number(u.ort_maliyet), 0);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Ürün</th><th>Kategori</th><th class="sayi">Stok</th><th class="sayi">Ort. maliyet</th><th class="sayi">Satış fiyatı</th><th>Barkod</th></tr></thead><tbody>
      ${veri.length ? veri.map((u) => html`<tr class="tikla" data-git="urun/${u.id}">
        <td class="ana-hucre" data-et="">${u.ad}${u.onay_bekliyor ? html` <span class="rozet turuncu">Onay bekliyor</span>` : ''}${u.kod ? html`<div class="alt-satir">${u.kod}</div>` : ''}</td>
        <td data-et="Kategori">${u.kategori || ''}</td>
        <td class="sayi" data-et="Stok"><span class="${u.stok_miktari < 0 ? 'negatif' : u.kritik_stok != null && u.stok_miktari <= u.kritik_stok ? 'negatif' : ''}">${miktar(u.stok_miktari)} ${u.birim}</span></td>
        <td class="sayi" data-et="Ort. maliyet">${para(u.ort_maliyet)}</td><td class="sayi" data-et="Satış">${u.onerilen_satis != null ? para(u.onerilen_satis) : ''}</td>
        <td data-et="Barkod" style="font-family:ui-monospace,monospace;font-size:.82rem">${u.barkodlar || ''}</td></tr>`)
        : html`<tr><td colspan="6" class="bos-durum">Ürün bulunamadı</td></tr>`}</tbody>
      ${veri.length ? html`<tfoot><tr><td colspan="3" data-et="">${veri.length} ürün</td><td colspan="3" class="sayi" data-et="Stok değeri">Stok değeri: ${para(deger)}</td></tr></tfoot>` : ''}</table>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#kat', el).onchange = (e) => { f.kategori = e.target.value; ciz(); };
  $('#onay', el).onchange = (e) => { f.onay_bekliyor = e.target.checked ? '1' : ''; ciz(); };
  $('#barkod', el).onclick = async () => {
    const { barkodOku } = await import('../barkod.js');
    const b = await barkodOku(); if (!b) return;
    $('#q', el).value = b; f.q = b; ciz();
  };
  $('#yeni', el).onclick = async () => { const u = await urunFormu(); if (u) ctx.git(`urun/${u.id}`); };
  $('#csv', el).onclick = () => csvIndir('urunler', ['Kod', 'Ürün', 'Kategori', 'Birim', 'Stok', 'Ort. maliyet', 'Satış fiyatı', 'KDV', 'Barkodlar'],
    veri.map((u) => [u.kod, u.ad, u.kategori, u.birim, Number(u.stok_miktari), Number(u.ort_maliyet), u.onerilen_satis != null ? Number(u.onerilen_satis) : '', Number(u.kdv_orani), u.barkodlar]));
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
