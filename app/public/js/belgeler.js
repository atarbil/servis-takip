// Yazdırılabilir belgeler (tarayıcıdan "PDF olarak kaydet" de yapılabilir)
import { html, paraSade, tarih, yazdir, pencere } from './ui.js';
import { belgeUst } from './bilesen.js';
import { api } from './api.js';
import { belgeHtml, sayfaStili, veriHazirla, TUR_AD, tutarYaziyla } from './form.js';

export { tutarYaziyla };

export function teslimFormuYazdir(ctx, is) { return formYazdir(ctx, 'teslim', is); }

export function fisYazdir(ctx, f) { return formYazdir(ctx, 'satis_fisi', f); }

export function ekstreYazdir(ctx, e) { return formYazdir(ctx, 'ekstre', e); }

export const BELGE = { devir: 'Devir', satis_fisi: 'Satış fişi', alis_faturasi: 'Alış faturası', tahsilat: 'Tahsilat', odeme: 'Ödeme', duzeltme: 'Düzeltme' };

export function tabloYazdir(ctx, baslik, altBaslik, basliklar, satirlar, toplam) {
  yazdir(html`<div class="belge">${belgeUst(ctx, baslik, html`<div>${altBaslik || ''}</div><div>${tarih(new Date().toISOString())}</div>`)}
    <table><thead><tr>${basliklar.map((b) => html`<th class="${b.sayi ? 'sayi' : ''}">${b.ad}</th>`)}</tr></thead>
    <tbody>${satirlar.map((s) => html`<tr>${s.map((v, i) => html`<td class="${basliklar[i].sayi ? 'sayi' : ''}">${v}</td>`)}</tr>`)}</tbody>
    ${toplam ? html`<tfoot><tr>${toplam.map((v, i) => html`<td class="${basliklar[i].sayi ? 'sayi' : ''}">${v}</td>`)}</tr></tfoot>` : ''}</table></div>`);
}

export function proformaYazdir(ctx, t, { kaseImza = t.kase_imza } = {}) { return formYazdir(ctx, 'proforma', t, { kase: !!kaseImza }); }

export function teklifYazdir(ctx, t, { kaseImza = t.kase_imza } = {}) { return formYazdir(ctx, 'teklif', t, { kase: !!kaseImza }); }

export function makbuzYazdir(ctx, m, { kaseImza = true, ikiNusha = false } = {}) {
  return formYazdir(ctx, 'makbuz', m, { kase: kaseImza, nusha: ikiNusha ? 2 : 1 });
}

// Dış servis: müşteriye verilen "cihaz teslim alındı" fişi (varsayılan A4'e 2 nüsha: müşteri + firma)
export function disServisFisYazdir(ctx, d) { return formYazdir(ctx, 'dis_servis', d); }

// ---------- Şablonlu yazdırma ----------
let onbellek = { zaman: 0, liste: null };
export const sablonOnbellekSil = () => { onbellek = { zaman: 0, liste: null }; };
async function sablonlar() {
  if (!onbellek.liste || Date.now() - onbellek.zaman > 30000) onbellek = { zaman: Date.now(), liste: await api.get('/sablonlar') };
  return onbellek.liste;
}
// Türün şablonları birden fazlaysa hangisiyle yazdırılacağı sorulur (varsayılan seçili gelir)
export async function formYazdir(ctx, tur, ham, secenek = {}) {
  let liste = [];
  try { liste = (await sablonlar()).filter((x) => x.tur === tur); } catch { /* şablonlar okunamazsa standart */ }
  let sablon = liste.find((x) => String(x.id) === String(secenek.sablonId)) || liste.find((x) => x.varsayilan) || liste[0] || { ayar: {} };
  if (liste.length > 1 && !secenek.sablonId) {
    const sec = await pencere({
      baslik: `${TUR_AD[tur]} — şablon seçin`, kaydetMetin: '🖨 Yazdır',
      icerik: html`<div class="sablon-sec">${liste.map((x) => html`<label class="kutu-sec"><input type="radio" name="sablon" value="${x.id}" ${x.id === sablon.id ? 'checked' : ''}>
        ${x.ad}${x.varsayilan ? html` <span class="rozet">varsayılan</span>` : ''}</label>`)}</div>`,
    });
    if (!sec) return;
    sablon = liste.find((x) => String(x.id) === String(sec.sablon)) || sablon;
  }
  const veri = veriHazirla(tur, ham);
  yazdir(`<style>${sayfaStili(tur, sablon.ayar)}</style>${belgeHtml(ctx, tur, sablon.ayar, veri, secenek)}`);
}
