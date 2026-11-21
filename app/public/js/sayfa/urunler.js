import { api } from '../api.js';
import { html, $, para, dovizPara, miktar, debounce, csvIndir } from '../ui.js';
import { urunFormu } from '../bilesen.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Ürünler / Stok');
  const f = { q: '', onay_bekliyor: ctx.sorgu.onay ? '1' : '', marka: '', ana_grup: '', alt_grup: '' };
  const gruplar = await api.get('/urun-gruplari');
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Ürünler / Stok</h2><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><button class="btn birincil" id="yeni">+ Yeni ürün</button></div>
    <div class="filtre"><input type="search" id="q" placeholder="Ürün adı, kod veya barkod…">
      <button class="btn ikincil" id="barkod" title="Barkodla ara">📷</button>
      <select id="marka"><option value="">Tüm markalar</option>${gruplar.markalar.map((k) => html`<option>${k}</option>`)}</select>
      <select id="ana"><option value="">Tüm ana gruplar</option>${gruplar.gruplar.map((g) => html`<option>${g.ana}</option>`)}</select>
      <select id="alt" disabled><option value="">Tüm alt gruplar</option></select>
      <label class="kutu-sec" style="margin:0"><input type="checkbox" id="onay" ${f.onay_bekliyor ? 'checked' : ''}> Sadece onay bekleyenler</label></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/urunler', { ...f, limit: 2000 });
    const deger = veri.reduce((a, u) => a + Math.max(0, Number(u.stok_miktari)) * Number(u.ort_maliyet), 0);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Ürün</th><th>Marka / model</th><th>Grup</th><th class="sayi">Stok</th><th class="sayi">Ort. maliyet</th><th class="sayi">Satış fiyatı</th><th>Barkod</th></tr></thead><tbody>
      ${veri.length ? veri.map((u) => html`<tr class="tikla" data-git="urun/${u.id}">
        <td class="ana-hucre" data-et="">${u.ad}${u.onay_bekliyor ? html` <span class="rozet turuncu">Onay bekliyor</span>` : ''}${u.kod ? html`<div class="alt-satir">${u.kod}</div>` : ''}</td>
        <td data-et="Marka / model">${[u.marka, u.model].filter(Boolean).join(' · ')}</td>
        <td data-et="Grup">${[u.ana_grup, u.alt_grup].filter(Boolean).join(' › ')}</td>
        <td class="sayi" data-et="Stok"><span class="${u.stok_miktari < 0 ? 'negatif' : u.kritik_stok != null && u.stok_miktari <= u.kritik_stok ? 'negatif' : ''}">${miktar(u.stok_miktari)} ${u.birim}</span></td>
        <td class="sayi" data-et="Ort. maliyet">${para(u.ort_maliyet)}</td><td class="sayi" data-et="Satış">${u.onerilen_satis != null ? dovizPara(u.onerilen_satis, u.satis_doviz) : ''}</td>
        <td data-et="Barkod" style="font-family:ui-monospace,monospace;font-size:.82rem">${u.barkodlar || ''}</td></tr>`)
        : html`<tr><td colspan="7" class="bos-durum">Ürün bulunamadı</td></tr>`}</tbody>
      ${veri.length ? html`<tfoot><tr><td colspan="4" data-et="">${veri.length} ürün</td><td colspan="3" class="sayi" data-et="Stok değeri">Stok değeri: ${para(deger)}</td></tr></tfoot>` : ''}</table>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#marka', el).onchange = (e) => { f.marka = e.target.value; ciz(); };
  $('#ana', el).onchange = (e) => {
    f.ana_grup = e.target.value; f.alt_grup = '';
    const g = gruplar.gruplar.find((x) => x.ana === f.ana_grup); const sel = $('#alt', el);
    sel.innerHTML = String(html`<option value="">Tüm alt gruplar</option>${(g?.altlar || []).map((a) => html`<option>${a}</option>`)}`);
    sel.disabled = !g || !g.altlar.length; ciz();
  };
  $('#alt', el).onchange = (e) => { f.alt_grup = e.target.value; ciz(); };
  $('#onay', el).onchange = (e) => { f.onay_bekliyor = e.target.checked ? '1' : ''; ciz(); };
  $('#barkod', el).onclick = async () => {
    const { barkodOku } = await import('../barkod.js');
    const b = await barkodOku(); if (!b) return;
    $('#q', el).value = b; f.q = b; ciz();
  };
  $('#yeni', el).onclick = async () => { const u = await urunFormu(); if (u) ctx.git(`urun/${u.id}`); };
  $('#csv', el).onclick = () => csvIndir('urunler', ['Kod', 'Ürün', 'Marka', 'Model', 'Ana grup', 'Alt grup', 'Birim', 'Stok', 'Ort. maliyet', 'Satış fiyatı', 'Para birimi', 'KDV', 'Barkodlar'],
    veri.map((u) => [u.kod, u.ad, u.marka, u.model, u.ana_grup, u.alt_grup, u.birim, Number(u.stok_miktari), Number(u.ort_maliyet), u.onerilen_satis != null ? Number(u.onerilen_satis) : '', u.satis_doviz || 'TRY', Number(u.kdv_orani), u.barkodlar]));
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
