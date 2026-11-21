import { api } from '../api.js';
import { html, $, $$, para, tarih, debounce, csvIndir, pencere } from '../ui.js';
import { cariSecici, cariYeniYakala } from '../bilesen.js';

export const TEKLIF_DURUM = {
  taslak: { ad: 'Taslak', renk: 'gri' }, gonderildi: { ad: 'Gönderildi', renk: 'mavi' }, kabul: { ad: 'Kabul edildi', renk: 'yesil' },
  red: { ad: 'Reddedildi', renk: 'kirmizi' }, iptal: { ad: 'İptal', renk: 'kirmizi' },
};
export const teklifRozet = (d) => html`<span class="rozet ${TEKLIF_DURUM[d]?.renk}">${TEKLIF_DURUM[d]?.ad || d}</span>`;
export const TUR_AD = { teklif: 'Teklif', proforma: 'Proforma' };

// Cari seçip yeni teklif/proforma ekranını açar
export async function yeniBelge(ctx, tur, cari) {
  if (cari) return ctx.git(`teklif/yeni?tur=${tur}&cari=${cari.id}`);
  let secilen = null;
  const r = await pencere({
    baslik: tur === 'teklif' ? 'Yeni teklif' : 'Yeni proforma fatura',
    icerik: html`<label class="alan"><span>Cari *</span><input id="c" placeholder="Ara: ünvan, telefon…" autofocus></label>
      <p class="soluk" style="font-size:.86rem">Listede yoksa "oluştur" ile yeni cari açabilirsiniz.</p>`,
    acildi: (d) => { const i = $('#c', d); const s = (c) => { secilen = c; i.value = c.unvan; }; cariSecici(i, s); cariYeniYakala(d, s); },
    kaydetMetin: 'Devam',
    kaydet: () => { if (!secilen) throw new Error('Cari seçin.'); return secilen; },
  });
  if (r) ctx.git(`teklif/yeni?tur=${tur}&cari=${r.id}`);
}

export default async function (el, _p, ctx) {
  ctx.baslik('Teklif / Proforma');
  const f = { tur: ctx.sorgu.tur || '', durum: '', q: '', bas: '', bit: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Teklif / Proforma</h2><span class="alt">Stoğu ve cariyi etkilemez; kabul edilince satış fişine dönüştürülür</span><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel</button>
      <button class="btn ikincil" data-yeni="proforma">+ Proforma fatura</button><button class="btn birincil" data-yeni="teklif">+ Teklif</button></div>
    <div class="sekmeler">${[['', 'Tümü'], ['teklif', 'Teklifler'], ['proforma', 'Proformalar']].map(([k, a]) => html`<button data-tur="${k}">${a}</button>`)}</div>
    <div class="filtre"><input type="search" id="q" placeholder="Belge no veya cari…">
      <select id="durum"><option value="">Tüm durumlar</option>${Object.entries(TEKLIF_DURUM).map(([k, v]) => html`<option value="${k}">${v.ad}</option>`)}</select>
      <label>Başlangıç <input type="date" id="bas"></label><label>Bitiş <input type="date" id="bit"></label></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    $$('[data-tur]', el).forEach((b) => b.classList.toggle('aktif', b.dataset.tur === f.tur));
    veri = await api.get('/teklifler', f);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Belge no</th><th>Tür</th><th>Tarih</th><th>Cari</th><th>Durum</th>
      <th class="sayi">KDV hariç</th><th class="sayi">Toplam</th><th>Fiş</th></tr></thead><tbody>
      ${veri.length ? veri.map((t) => html`<tr class="tikla ${t.durum === 'iptal' ? 'iptal' : ''}" data-git="teklif/${t.id}">
        <td class="ana-hucre" data-et="">${t.belge_no}</td><td data-et="Tür">${TUR_AD[t.tur]}</td><td data-et="Tarih">${tarih(t.tarih)}</td>
        <td data-et="Cari">${t.unvan}</td><td data-et="Durum">${teklifRozet(t.durum)}</td>
        <td class="sayi" data-et="KDV hariç">${para(t.ara_toplam)}</td><td class="sayi" data-et="Toplam"><b>${para(t.genel_toplam)}</b></td>
        <td data-et="Fiş">${t.fis_no || ''}</td></tr>`)
        : html`<tr><td colspan="8" class="bos-durum"><b>Belge yok</b>Sağ üstten yeni teklif veya proforma oluşturun.</td></tr>`}</tbody></table>`);
  };
  el.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tur]'); if (t) { f.tur = t.dataset.tur; return ciz(); }
    const y = e.target.closest('[data-yeni]'); if (y) return yeniBelge(ctx, y.dataset.yeni);
    const g = e.target.closest('[data-git]'); if (g) ctx.git(g.dataset.git);
  });
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  for (const k of ['durum', 'bas', 'bit']) $('#' + k, el).onchange = (e) => { f[k] = e.target.value; ciz(); };
  $('#csv', el).onclick = () => csvIndir('teklif-proforma', ['Belge no', 'Tür', 'Tarih', 'Cari', 'Durum', 'KDV hariç', 'KDV', 'Toplam', 'Fiş'],
    veri.map((t) => [t.belge_no, TUR_AD[t.tur], tarih(t.tarih), t.unvan, TEKLIF_DURUM[t.durum]?.ad, Number(t.ara_toplam), Number(t.kdv_toplam), Number(t.genel_toplam), t.fis_no]));
  await ciz();
}
