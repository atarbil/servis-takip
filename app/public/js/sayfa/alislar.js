import { api } from '../api.js';
import { html, $, para, tarih, durumRozet, debounce, csvIndir } from '../ui.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Alış Faturaları');
  const f = { q: '', durum: '', bas: '', bit: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Alış Faturaları</h2><span class="alt">Ürün maliyetleri buradan oluşur</span><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><a class="btn birincil" href="#/alis/yeni">+ Alış faturası gir</a></div>
    <div class="filtre"><input type="search" id="q" placeholder="Fatura no veya tedarikçi…">
      <select id="durum"><option value="">Tüm durumlar</option><option value="taslak">Taslak</option><option value="onaylandi">Onaylandı</option><option value="iptal">İptal</option></select>
      <label>Başlangıç <input type="date" id="bas"></label><label>Bitiş <input type="date" id="bit"></label></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/alislar', f);
    const g = veri.filter((x) => x.durum === 'onaylandi');
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Fatura no</th><th>Tarih</th><th>Tedarikçi</th><th>Durum</th><th class="sayi">KDV hariç</th><th class="sayi">Toplam</th></tr></thead><tbody>
      ${veri.length ? veri.map((x) => html`<tr class="tikla ${x.durum === 'iptal' ? 'iptal' : ''}" data-git="alis/${x.id}">
        <td class="ana-hucre" data-et="">${x.belge_no}</td><td data-et="Tarih">${tarih(x.tarih)}</td><td data-et="Tedarikçi">${x.unvan}</td><td data-et="Durum">${durumRozet(x.durum)}</td>
        <td class="sayi" data-et="KDV hariç">${para(x.ara_toplam)}</td><td class="sayi" data-et="Toplam"><b>${para(x.genel_toplam)}</b></td></tr>`)
        : html`<tr><td colspan="6" class="bos-durum">Fatura yok</td></tr>`}</tbody>
      ${g.length ? html`<tfoot><tr><td colspan="4" data-et="">Onaylı ${g.length} fatura</td><td class="sayi" data-et="KDV hariç">${para(g.reduce((a, x) => a + Number(x.ara_toplam), 0))}</td>
        <td class="sayi" data-et="Toplam">${para(g.reduce((a, x) => a + Number(x.genel_toplam), 0))}</td></tr></tfoot>` : ''}</table>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#durum', el).onchange = (e) => { f.durum = e.target.value; ciz(); };
  $('#bas', el).onchange = (e) => { f.bas = e.target.value; ciz(); };
  $('#bit', el).onchange = (e) => { f.bit = e.target.value; ciz(); };
  $('#csv', el).onclick = () => csvIndir('alis-faturalari', ['Fatura no', 'Tarih', 'Tedarikçi', 'Durum', 'KDV hariç', 'KDV', 'Toplam'],
    veri.map((x) => [x.belge_no, tarih(x.tarih), x.unvan, x.durum, Number(x.ara_toplam), Number(x.kdv_toplam), Number(x.genel_toplam)]));
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
