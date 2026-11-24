import { api } from '../api.js';
import { html, $, para, tarih, durumRozet, debounce, csvIndir, pencere, bugunStr } from '../ui.js';
import { cariSecici } from '../bilesen.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Satış Fişleri');
  const ay = new Date(); ay.setDate(1);
  const f = { q: '', durum: '', bas: bugunStr(ay), bit: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Satış Fişleri</h2><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel'e aktar</button><button class="btn birincil" id="yeni">+ Yeni satış fişi</button></div>
    <div class="filtre"><input type="search" id="q" placeholder="Fiş no veya cari…">
      <select id="durum"><option value="">Tüm durumlar</option><option value="taslak">Taslak</option><option value="onaylandi">Onaylandı</option><option value="iptal">İptal</option></select>
      <label>Başlangıç <input type="date" id="bas" value="${f.bas}"></label><label>Bitiş <input type="date" id="bit"></label></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/fisler', f);
    const g = veri.filter((x) => x.durum === 'onaylandi');
    const t = (k) => g.reduce((a, x) => a + Number(x[k]), 0);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Fiş no</th><th>Tarih</th><th>Cari</th><th>Durum</th>
      <th class="sayi">KDV hariç</th><th class="sayi">Genel toplam</th><th class="sayi kar-bilgi">Maliyet</th><th class="sayi kar-bilgi">Kâr</th></tr></thead><tbody>
      ${veri.length ? veri.map((x) => html`<tr class="tikla ${x.durum === 'iptal' ? 'iptal' : ''}" data-git="fis/${x.id}">
        <td class="ana-hucre" data-et="">${x.fis_no}${x.is_id ? html`<div class="alt-satir">İş #${x.is_id}</div>` : ''}</td><td data-et="Tarih">${tarih(x.tarih)}</td>
        <td data-et="Cari">${x.unvan}</td><td data-et="Durum">${durumRozet(x.durum)}</td>
        <td class="sayi" data-et="KDV hariç" data-mobil="gizle">${para(x.ara_toplam)}</td><td class="sayi" data-et="Toplam"><b>${para(x.genel_toplam)}</b></td>
        <td class="sayi kar-bilgi" data-et="Maliyet" data-mobil="gizle">${para(x.maliyet_toplam)}</td><td class="sayi kar-bilgi ${x.kar < 0 ? 'negatif' : ''}" data-et="Kâr">${para(x.kar)}</td></tr>`)
        : html`<tr><td colspan="8" class="bos-durum">Fiş yok</td></tr>`}</tbody>
      ${g.length ? html`<tfoot><tr><td colspan="4" data-et="">Onaylı ${g.length} fiş</td><td class="sayi" data-et="KDV hariç" data-mobil="gizle">${para(t('ara_toplam'))}</td>
        <td class="sayi" data-et="Toplam">${para(t('genel_toplam'))}</td><td class="sayi kar-bilgi" data-et="Maliyet" data-mobil="gizle">${para(t('maliyet_toplam'))}</td><td class="sayi kar-bilgi" data-et="Kâr">${para(t('kar'))}</td></tr></tfoot>` : ''}</table>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#durum', el).onchange = (e) => { f.durum = e.target.value; ciz(); };
  $('#bas', el).onchange = (e) => { f.bas = e.target.value; ciz(); };
  $('#bit', el).onchange = (e) => { f.bit = e.target.value; ciz(); };
  $('#csv', el).onclick = () => csvIndir('satis-fisleri', ['Fiş no', 'Tarih', 'Cari', 'Durum', 'KDV hariç', 'KDV', 'Genel toplam', 'Maliyet', 'Kâr'],
    veri.map((x) => [x.fis_no, tarih(x.tarih), x.unvan, x.durum, Number(x.ara_toplam), Number(x.kdv_toplam), Number(x.genel_toplam), Number(x.maliyet_toplam), Number(x.kar)]));
  $('#yeni', el).onclick = async () => { const { yeniSatisFisi } = await import('../bilesen.js'); yeniSatisFisi(ctx); };
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
  await ciz();
}
