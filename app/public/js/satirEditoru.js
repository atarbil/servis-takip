// Hizmet / malzeme satırları: "+ İş ekle → İşi ben yaptım" ve "Teslim et / Tamamla" pencerelerinde ortak.
// Her satır bir stok kartına bağlıdır (ürün ya da hizmet kartı); serbest açıklama satırı yoktur.
import { api } from './api.js';
import { html, $, $$, bildir, sayiGiris, sayiCoz } from './ui.js';
import { urunSecici, urunBulunamadi } from './bilesen.js';

export const bosSatir = () => ({ tip: 'urun', urun_id: null, aciklama: '', miktar: 1, birim_fiyat: '' });

// Pencere içeriğine konacak sağ sütun. id'ler pencere başına tektir.
export const satirEditoruHtml = ({ baslik = 'Verilen hizmet ve kullanılan malzeme', not = '', gizli = false } = {}) => html`
  <div id="hi-detay" class="hi-sag" ${gizli ? 'hidden' : ''}>
    <div class="hi-sag-baslik"><b>${baslik}</b></div>
    <div id="hi-satirlar" data-secici-sabit></div>
    <div class="btn-grup hi-ekle-dugmeler">
      <button type="button" class="btn ikincil kucuk" data-hi-ekle>+ Kalem (ürün / hizmet)</button>
      <button type="button" class="btn ikincil kucuk" data-hi-barkod>📷 Barkod</button></div>
    <p class="soluk" style="font-size:.8rem;margin:.35rem 0 0">Her kalem stok kartından seçilir. İşçilik / servis ücreti için <b>Hizmet</b> türünde kart açın.</p>
    ${not ? html`<p class="soluk" style="font-size:.82rem;margin:.4rem 0 0">${not}</p>` : ''}
  </div>`;

// Satır dizisini pencereye bağlar; dizi yerinde güncellenir.
export function satirEditoruBagla(d, satirlar) {
  const sec = (i, u) => { Object.assign(satirlar[i], { tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_id: u.id, aciklama: u.ad }); ciz(); $(`tr[data-i="${i}"] [data-k=miktar]`, d)?.select(); };
  const ciz = () => {
    const k = $('#hi-satirlar', d);
    k.innerHTML = String(html`${satirlar.length ? html`<table class="hi-tablo"><thead><tr><th>Ürün / hizmet</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat (ops.)</th><th></th></tr></thead><tbody>
      ${satirlar.map((x, i) => html`<tr data-i="${i}">
        <td>${x.urun_id ? html`<b>${x.aciklama}</b>${x.tip === 'hizmet' ? html` <span class="rozet mavi">hizmet</span>` : ''} <button type="button" class="btn-metin" style="color:var(--ana)" data-hi-degistir="${i}">değiştir</button>`
          : html`<input data-k="aciklama" class="hi-urun" value="${x.aciklama}" placeholder="Ürün / hizmet ara… (ad, kod, model)">`}</td>
        <td><input class="sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(x.miktar)}"></td>
        <td><input class="sayi" data-k="birim_fiyat" inputmode="decimal" value="${x.birim_fiyat === '' ? '' : sayiGiris(x.birim_fiyat)}" placeholder="stok kartından"></td>
        <td><button type="button" class="btn-ikon" data-hi-sil="${i}" title="Satırı sil">✕</button></td></tr>`)}</tbody></table>`
      : html`<p class="soluk" style="margin:.5rem">Verdiğiniz hizmeti ve teslim ettiğiniz malzemeyi ekleyin.</p>`}`);
    $$('.hi-urun', k).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      urunSecici(inp, (u) => sec(i, u), { bulunamadi: true, iptal: () => { satirlar[i].aciklama = ''; ciz(); } });
    });
  };
  const detay = $('#hi-detay', d);
  $('#hi-satirlar', d).addEventListener('scroll', () => $$('#hi-satirlar .secici-liste', d).forEach((k) => { k.hidden = true; }));
  detay.addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]'); const k = e.target.dataset.k; if (!tr || !k) return;
    const x = satirlar[Number(tr.dataset.i)];
    if (k === 'aciklama') { x.aciklama = e.target.value; x.urun_id = null; }
    else x[k] = e.target.value === '' && k === 'birim_fiyat' ? '' : (sayiCoz(e.target.value) ?? '');
  });
  detay.addEventListener('click', async (e) => {
    if (e.target.closest('[data-hi-ekle]')) { satirlar.push(bosSatir()); ciz(); const k2 = $('#hi-satirlar', d); k2.scrollTop = k2.scrollHeight; $(`tr[data-i="${satirlar.length - 1}"] [data-k=aciklama]`, d)?.focus(); return; }
    const sl = e.target.closest('[data-hi-sil]');
    if (sl) { satirlar.splice(Number(sl.dataset.hiSil), 1); ciz(); return; }
    const dg = e.target.closest('[data-hi-degistir]');
    if (dg) { const i = Number(dg.dataset.hiDegistir); Object.assign(satirlar[i], { urun_id: null, aciklama: '' }); ciz(); $(`tr[data-i="${i}"] [data-k=aciklama]`, d)?.focus(); return; }
    if (e.target.closest('[data-hi-barkod]')) {
      const { barkodOku } = await import('./barkod.js');
      const b = await barkodOku(); if (!b) return;
      let u = null;
      try { u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`); } catch { u = await urunBulunamadi('', { barkod: b }); }
      if (!u) return;
      const v = satirlar.find((x) => x.urun_id === u.id);
      if (v) v.miktar = Number(v.miktar || 0) + 1;
      else { const bos = satirlar.findIndex((x) => !x.urun_id && !String(x.aciklama).trim()); const y = { tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_id: u.id, aciklama: u.ad, miktar: 1, birim_fiyat: '' }; if (bos >= 0) satirlar[bos] = y; else satirlar.push(y); }
      ciz(); bildir(`${u.ad} eklendi.`, 'basari');
    }
  });
  ciz();
  return { ciz };
}

// Gönderilecek satırlar: boşlar atılır; stok kartı seçilmemiş satır hata
export function satirlariHazirla(satirlar) {
  const dolu = satirlar.filter((x) => x.urun_id || String(x.aciklama || '').trim());
  const eksik = dolu.find((x) => !x.urun_id);
  if (eksik) throw new Error(`"${eksik.aciklama}" bir stok kartına bağlı değil. Listeden seçin ya da yeni stok kartı açın.`);
  return dolu.map((x) => ({ tip: x.tip, urun_id: x.urun_id, aciklama: x.aciklama, miktar: x.miktar || 1, birim_fiyat: x.birim_fiyat === '' ? null : x.birim_fiyat }));
}
