import { api } from '../api.js';
import { html, $, saat, tarih, durumRozet, debounce, csvIndir, DURUM } from '../ui.js';
import { yeniIsPenceresi } from '../bilesen.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Tüm İşler');
  const ekipler = await ctx.ekipler();
  const f = { q: '', durum: ctx.sorgu.durum || '', ekip_id: '', bas: '', bit: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Tüm İşler</h2><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><button class="btn birincil" id="yeni">+ Yeni iş</button></div>
    <div class="filtre">
      <input type="search" id="q" placeholder="Ara: başlık, müşteri, adres, iş no…">
      <select id="durum"><option value="">Tüm durumlar</option>${Object.entries(DURUM).filter(([k]) => !['taslak', 'onaylandi'].includes(k)).map(([k, v]) => html`<option value="${k}" ${f.durum === k ? 'selected' : ''}>${v.ad}</option>`)}</select>
      <select id="ekip"><option value="">Tüm ekipler</option>${ekipler.map((e) => html`<option value="${e.id}">${e.ad}</option>`)}</select>
      <input type="date" id="bas" title="Başlangıç"><input type="date" id="bit" title="Bitiş">
    </div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/isler', f);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>No</th><th>İş</th><th>Durum</th><th>Ekip</th><th>Tarih</th></tr></thead><tbody>
      ${veri.length ? veri.map((i) => html`<tr class="tikla" data-git="is/${i.id}">
        <td data-et="No">#${i.id}</td>
        <td class="ana-hucre" data-et="">${i.baslik}<div class="alt-satir">${i.cari_unvan || i.iletisim_tel || ''}</div></td>
        <td data-et="Durum">${durumRozet(i.durum)}</td>
        <td data-et="Ekip">${i.ekip_ad ? html`<span class="nokta" style="background:${i.ekip_renk}"></span>${i.ekip_ad}` : '-'}</td>
        <td data-et="Tarih" class="nowrap">${i.plan_baslangic ? `${tarih(i.plan_baslangic)} ${saat(i.plan_baslangic)}` : html`<span class="soluk">kayıt ${tarih(i.olusturma)}</span>`}</td></tr>`)
        : html`<tr><td colspan="5" class="bos-durum">Kayıt bulunamadı</td></tr>`}</tbody></table>`);
  };
  const degis = (k, v) => { f[k] = v; ciz(); };
  $('#q', el).addEventListener('input', debounce((e) => degis('q', e.target.value), 300));
  for (const [id, k] of [['durum', 'durum'], ['ekip', 'ekip_id'], ['bas', 'bas'], ['bit', 'bit']]) $('#' + id, el).onchange = (e) => degis(k, e.target.value);
  $('#yeni', el).onclick = async () => { const r = await yeniIsPenceresi(ctx); if (r) ctx.git(`is/${r.id}`); };
  $('#csv', el).onclick = () => csvIndir('isler', ['No', 'Başlık', 'Cari', 'Durum', 'Ekip', 'Plan', 'Adres'],
    veri.map((i) => [i.id, i.baslik, i.cari_unvan, DURUM[i.durum]?.ad, i.ekip_ad, i.plan_baslangic ? `${tarih(i.plan_baslangic)} ${saat(i.plan_baslangic)}` : '', i.adres]));
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
