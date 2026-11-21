import { api } from '../api.js';
import { html, $, tarih, bakiyeHucre, debounce, csvIndir } from '../ui.js';
import { cariFormu } from '../bilesen.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Cariler');
  const f = { q: '', tip: '', bakiyeli: '', pasif: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Cariler</h2><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><button class="btn birincil" id="yeni">+ Yeni cari</button></div>
    <div class="filtre">
      <input type="search" id="q" placeholder="Ara: ad, telefon, kod…" autofocus>
      <select id="tip"><option value="">Tümü</option><option value="musteri">Müşteriler</option><option value="tedarikci">Tedarikçiler</option></select>
      <label class="kutu-sec" style="margin:0"><input type="checkbox" id="bakiyeli"> Sadece bakiyesi olanlar</label>
      <label class="kutu-sec" style="margin:0"><input type="checkbox" id="pasif"> Pasifleri göster</label>
    </div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/cariler', f);
    const toplam = veri.reduce((a, c) => a + Number(c.bakiye), 0);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Ünvan</th><th>Telefon</th><th>Bölge</th><th>Son hareket</th><th class="sayi">Bakiye</th></tr></thead><tbody>
      ${veri.length ? veri.map((c) => html`<tr class="tikla" data-git="cari/${c.id}">
        <td class="ana-hucre" data-et="">${c.unvan}${c.tip === 'tedarikci' ? html` <span class="rozet">Tedarikçi</span>` : c.tip === 'her_ikisi' ? html` <span class="rozet">M+T</span>` : ''}${!c.aktif ? html` <span class="rozet kirmizi">Pasif</span>` : ''}
          ${c.yetkili ? html`<div class="alt-satir">${c.yetkili}</div>` : ''}</td>
        <td data-et="Telefon">${c.telefon || ''}</td><td data-et="Bölge">${[c.ilce, c.il].filter(Boolean).join(' / ')}</td>
        <td data-et="Son hareket">${c.son_hareket ? tarih(c.son_hareket) : ''}</td>
        <td data-et="Bakiye" class="sayi">${bakiyeHucre(c.bakiye)}</td></tr>`) : html`<tr><td colspan="5" class="bos-durum">Cari bulunamadı</td></tr>`}</tbody>
      ${veri.length ? html`<tfoot><tr><td colspan="4" data-et="">${veri.length} cari · net bakiye</td><td class="sayi" data-et="Toplam">${bakiyeHucre(toplam)}</td></tr></tfoot>` : ''}</table>
      <p class="soluk" style="padding:.5rem 1rem;margin:0;font-size:.82rem">(B) cari size borçlu · (A) siz cariye borçlusunuz</p>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#tip', el).onchange = (e) => { f.tip = e.target.value; ciz(); };
  $('#bakiyeli', el).onchange = (e) => { f.bakiyeli = e.target.checked ? '1' : ''; ciz(); };
  $('#pasif', el).onchange = (e) => { f.pasif = e.target.checked ? '1' : ''; ciz(); };
  $('#yeni', el).onclick = async () => { const c = await cariFormu(); if (c) ctx.git(`cari/${c.id}`); };
  $('#csv', el).onclick = () => csvIndir('cariler', ['Kod', 'Ünvan', 'Tür', 'Telefon', 'İl', 'İlçe', 'Bakiye'],
    veri.map((c) => [c.kod, c.unvan, c.tip, c.telefon, c.il, c.ilce, Number(c.bakiye)]));
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
