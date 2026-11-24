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

// ---------- Detaylı cari ekstre (ekranda ve çıktıda aynı kurumsal görünüm; vade yok) ----------
const HESAP_TIP = { kasa: 'Nakit', banka: 'Banka', pos: 'Kredi kartı', kredi_karti: 'Kredi kartı' };
const bakiyeYaz = (n) => { const v = Math.round(Number(n || 0) * 100) / 100; return Math.abs(v) < 0.005 ? '0,00' : `${paraSade(Math.abs(v))} ${v > 0 ? '(B)' : '(A)'}`; };
export function detayliEkstreHtml(ctx, e) {
  const c = e.cari;
  const yer = [c.ilce, c.il].filter(Boolean).join(' / ');
  const kalan = e.toplam.bakiye;
  return html`<div class="belge dekstre">
    ${belgeUst(ctx, 'CARİ HESAP EKSTRESİ', html`<div class="dek-donem">Dönem: <b>${tarih(e.bas)} – ${tarih(e.bit)}</b></div><div>Düzenleme: ${tarih(new Date().toISOString())}</div>`)}
    <div class="dek-cari">
      <div><div class="dek-etiket">SAYIN</div><div class="dek-unvan">${c.unvan}</div>
        ${c.adres || yer ? html`<div>${c.adres || ''} ${yer}</div>` : ''}
        ${c.vergi_dairesi || c.vergi_no ? html`<div>${c.vergi_dairesi ? `V.D.: ${c.vergi_dairesi}` : ''}${c.vergi_dairesi && c.vergi_no ? ' · ' : ''}${c.vergi_no ? `V.N./TCKN: ${c.vergi_no}` : ''}</div>` : ''}
        ${c.telefon || c.eposta ? html`<div>${[c.telefon && `Tel: ${c.telefon}`, c.eposta].filter(Boolean).join(' · ')}</div>` : ''}</div>
      <div class="dek-cari-sag">${c.kod ? html`<div>Cari kodu: <b>${c.kod}</b></div>` : ''}<div>Hareket: <b>${e.satirlar.length}</b></div></div>
    </div>
    <table class="dek-tablo"><thead><tr><th class="dek-t">Tarih</th><th class="dek-b">Belge</th><th>Açıklama</th><th class="sayi dek-p">Borç</th><th class="sayi dek-p">Alacak</th><th class="sayi dek-p">Bakiye</th></tr></thead>
      <tbody>
        <tr class="dek-devir"><td>${tarih(e.bas)}</td><td>Devir</td><td>${tarih(e.bas)} öncesi bakiye</td><td class="sayi">${e.devir > 0 ? paraSade(e.devir) : ''}</td><td class="sayi">${e.devir < 0 ? paraSade(-e.devir) : ''}</td><td class="sayi"><b>${bakiyeYaz(e.devir)}</b></td></tr>
        ${e.satirlar.map((s) => html`<tr class="dek-satir ${s.kalemler.length ? 'kalemli' : ''}" ${s.belge_tip === 'satis_fisi' && s.belge_id ? html`data-fis="${s.belge_id}"` : s.belge_tip === 'alis_faturasi' && s.belge_id ? html`data-alis="${s.belge_id}"` : ''}>
            <td>${tarih(s.tarih)}</td><td><b>${BELGE[s.belge_tip] || s.belge_tip}</b>${s.belge_no ? html`<div class="dek-no">${s.belge_no}</div>` : ''}</td>
            <td>${s.aciklama || ''}${s.odeme ? html`<div class="dek-no">${HESAP_TIP[s.odeme.hesap_tip] || 'Ödeme'} · ${s.odeme.hesap}</div>` : ''}</td>
            <td class="sayi">${s.borc ? paraSade(s.borc) : ''}</td><td class="sayi">${s.alacak ? paraSade(s.alacak) : ''}</td><td class="sayi"><b>${bakiyeYaz(s.bakiye)}</b></td></tr>
          ${s.kalemler.length ? html`<tr class="dek-kalem-satir"><td></td><td colspan="5"><table class="dek-kalem"><thead><tr><th>${s.belge_tip === 'alis_faturasi' ? 'Alınan ürün / hizmet' : 'Aldığı ürün / hizmet'}</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat</th><th class="sayi">İsk. %</th><th class="sayi">KDV %</th><th class="sayi">Tutar (KDV dahil)</th></tr></thead>
            <tbody>${s.kalemler.map((k) => html`<tr><td>${k.ad}</td><td class="sayi">${String(k.miktar).replace('.', ',')} ${k.birim || ''}</td><td class="sayi">${paraSade(k.birim_fiyat)}</td><td class="sayi">${k.iskonto_orani ? String(k.iskonto_orani).replace('.', ',') : ''}</td><td class="sayi">${k.kdv_orani}</td><td class="sayi">${paraSade(k.kdvli)}</td></tr>`)}</tbody></table></td></tr>` : ''}`)}
        ${!e.satirlar.length ? html`<tr><td colspan="6" class="dek-bos">Bu dönemde hareket yok.</td></tr>` : ''}
      </tbody>
      <tfoot><tr><td colspan="3">Dönem toplamı</td><td class="sayi">${paraSade(e.toplam.borc)}</td><td class="sayi">${paraSade(e.toplam.alacak)}</td><td class="sayi">${bakiyeYaz(kalan)}</td></tr></tfoot>
    </table>
    <div class="dek-ozet">
      <div><span>Devir bakiyesi</span><b>${bakiyeYaz(e.devir)}</b></div>
      <div><span>Dönem borç toplamı<small>satışlar · aldıkları</small></span><b>${paraSade(e.toplam.borc)}</b></div>
      <div><span>Dönem alacak toplamı<small>tahsilatlar · ödedikleri</small></span><b>${paraSade(e.toplam.alacak)}</b></div>
      <div class="dek-kalan ${kalan > 0.004 ? 'borclu' : kalan < -0.004 ? 'alacakli' : ''}"><span>Kalan bakiye<small>${kalan > 0.004 ? 'Cari borçlu' : kalan < -0.004 ? 'Cari alacaklı' : 'Hesap kapalı'}</small></span><b>${paraSade(Math.abs(kalan))}</b></div>
    </div>
    <div class="dek-not">(B) borç bakiyesi: cari firmamıza borçlu · (A) alacak bakiyesi: firmamız cariye borçlu. Bu ekstre ${tarih(new Date().toISOString())} tarihinde düzenlenmiştir; mutabık değilseniz 15 gün içinde bildirmenizi rica ederiz.</div>
  </div>`;
}
export function detayliEkstreYazdir(ctx, e) { yazdir(detayliEkstreHtml(ctx, e)); }

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
