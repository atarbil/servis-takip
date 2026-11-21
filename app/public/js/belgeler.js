// Yazdırılabilir belgeler (tarayıcıdan "PDF olarak kaydet" de yapılabilir)
import { html, para, paraSade, dovizPara, miktar, tarih, zaman, yazdir } from './ui.js';
import { belgeUst, firmaBlok } from './bilesen.js';

export function teslimFormuYazdir(ctx, is) {
  const t = is.teslim;
  yazdir(html`<div class="belge">
    ${belgeUst(ctx, 'SERVİS TESLİM FORMU', html`<div>Form no: <b>${is.id}</b></div><div>${t ? zaman(t.zaman) : ''}</div>`)}
    <table><tbody>
      <tr><th style="width:22%">Müşteri</th><td>${is.cari_unvan || is.iletisim_ad || ''}</td><th style="width:16%">Telefon</th><td>${is.cari_telefon || is.iletisim_tel || ''}</td></tr>
      <tr><th>Adres</th><td colspan="3">${is.adres || is.cari_adres || ''}</td></tr>
      <tr><th>Yapılan iş</th><td colspan="3"><b>${is.baslik}</b>${is.aciklama ? html`<br>${is.aciklama}` : ''}</td></tr>
      ${is.teknisyen_notu ? html`<tr><th>Teknisyen notu</th><td colspan="3">${is.teknisyen_notu}</td></tr>` : ''}
      <tr><th>Ekip</th><td>${is.ekip_ad || ''}</td><th>Süre</th><td>${is.baslama_zamani ? zaman(is.baslama_zamani) : ''} – ${is.bitis_zamani ? zaman(is.bitis_zamani) : ''}</td></tr>
    </tbody></table>
    ${is.malzemeler.length ? html`<h2>Kullanılan / teslim edilen malzemeler</h2>
      <table><thead><tr><th>#</th><th>Ürün</th><th class="sayi">Miktar</th></tr></thead><tbody>
      ${is.malzemeler.map((m, i) => html`<tr><td>${i + 1}</td><td>${m.ad}</td><td class="sayi">${miktar(m.miktar)} ${m.birim}</td></tr>`)}</tbody></table>` : ''}
    <p>${ctx.ayarlar.teslim_metni || ''}</p>
    ${t?.musteri_notu ? html`<p><b>Müşteri notu:</b> ${t.musteri_notu}</p>` : ''}
    <div class="imza-kutular">
      <div><b>Teslim eden</b><br>${t?.teknisyen || ''}</div>
      <div><b>Teslim alan</b><br>${t?.teslim_alan_ad || ''} ${t?.teslim_alan_tel ? '· ' + t.teslim_alan_tel : ''}<br>
        ${t ? html`<img src="/dosya/${t.imza_dosya}" alt="İmza">` : ''}</div>
    </div>
    <div class="kucuk-not">Bu form ${ctx.ayarlar.firma_adi || ''} servis takip sistemi ile elektronik imzalı olarak oluşturulmuştur.
      ${t ? `İmza zamanı: ${zaman(t.zaman)}` : ''}</div>
  </div>`);
}

export function fisYazdir(ctx, f) {
  yazdir(html`<div class="belge">
    ${belgeUst(ctx, 'SATIŞ FİŞİ', html`<div>No: <b>${f.fis_no}</b></div><div>Tarih: ${tarih(f.tarih)}</div>${f.vade ? html`<div>Vade: ${tarih(f.vade)}</div>` : ''}`)}
    <table><tbody><tr><th style="width:18%">Sayın</th><td><b>${f.unvan}</b><br>${f.cari_adres || ''}${f.cari_telefon ? html`<br>${f.cari_telefon}` : ''}
      ${f.vergi_no ? html`<br>${f.vergi_dairesi || ''} ${f.vergi_no}` : ''}</td></tr>
      ${f.is_baslik ? html`<tr><th>İş</th><td>#${f.is_id} ${f.is_baslik}</td></tr>` : ''}</tbody></table>
    <table><thead><tr><th>#</th><th>Açıklama</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat</th><th class="sayi">İsk.</th><th class="sayi">KDV</th><th class="sayi">Tutar</th></tr></thead>
      <tbody>${f.satirlar.map((s, i) => html`<tr><td>${i + 1}</td><td>${s.aciklama}${s.notu ? html`<br><small>${s.notu}</small>` : ''}</td><td class="sayi">${miktar(s.miktar)} ${s.birim}</td>
        <td class="sayi">${paraSade(s.birim_fiyat)}</td><td class="sayi">${s.iskonto_orani ? '%' + s.iskonto_orani : ''}</td><td class="sayi">%${s.kdv_orani}</td><td class="sayi">${paraSade(s.tutar)}</td></tr>`)}</tbody>
      <tfoot><tr><td colspan="6" class="sayi">Ara toplam</td><td class="sayi">${para(f.ara_toplam)}</td></tr>
        <tr><td colspan="6" class="sayi">KDV</td><td class="sayi">${para(f.kdv_toplam)}</td></tr>
        <tr><td colspan="6" class="sayi"><b>GENEL TOPLAM</b></td><td class="sayi"><b>${para(f.genel_toplam)}</b></td></tr></tfoot></table>
    ${f.aciklama ? html`<p>${f.aciklama}</p>` : ''}
    ${ctx.ayarlar.fis_notu ? html`<p>${ctx.ayarlar.fis_notu}</p>` : ''}
    <div class="imza-kutular"><div><b>Teslim eden</b></div><div><b>Teslim alan</b></div></div>
    <div class="kucuk-not">Bu belge mali değeri olan bir fatura değildir; bilgi amaçlı satış fişidir.</div>
  </div>`);
}

export function ekstreYazdir(ctx, e) {
  const son = e.satirlar.at(-1)?.bakiye || 0;
  const tb = e.satirlar.reduce((a, s) => a + Number(s.borc), 0);
  const ta = e.satirlar.reduce((a, s) => a + Number(s.alacak), 0);
  yazdir(html`<div class="belge">
    ${belgeUst(ctx, 'CARİ HESAP EKSTRESİ', html`<div>${tarih(e.bas)} – ${tarih(e.bit)}</div><div>Düzenleme: ${tarih(new Date().toISOString())}</div>`)}
    <table><tbody><tr><th style="width:18%">Cari</th><td><b>${e.cari.unvan}</b>${e.cari.kod ? ' (' + e.cari.kod + ')' : ''}<br>${e.cari.adres || ''} ${e.cari.telefon || ''}</td></tr></tbody></table>
    <table><thead><tr><th>Tarih</th><th>Belge</th><th>Açıklama</th><th>Vade</th><th class="sayi">Borç</th><th class="sayi">Alacak</th><th class="sayi">Bakiye</th></tr></thead>
      <tbody>${e.satirlar.map((s) => html`<tr><td>${tarih(s.tarih)}</td><td>${BELGE[s.belge_tip] || s.belge_tip} ${s.belge_no || ''}</td><td>${s.aciklama || ''}</td>
        <td>${s.vade ? tarih(s.vade) : ''}</td><td class="sayi">${s.borc ? paraSade(s.borc) : ''}</td><td class="sayi">${s.alacak ? paraSade(s.alacak) : ''}</td>
        <td class="sayi">${paraSade(Math.abs(s.bakiye))} ${s.bakiye > 0.004 ? 'B' : s.bakiye < -0.004 ? 'A' : ''}</td></tr>`)}</tbody>
      <tfoot><tr><td colspan="4" class="sayi">Toplam</td><td class="sayi">${paraSade(tb)}</td><td class="sayi">${paraSade(ta)}</td>
        <td class="sayi">${paraSade(Math.abs(son))} ${son > 0.004 ? 'B' : son < -0.004 ? 'A' : ''}</td></tr></tfoot></table>
    <p><b>${son > 0.004 ? `Bakiye: ${para(son)} tarafınızca firmamıza borçlu görünmektedir.` : son < -0.004 ? `Bakiye: ${para(-son)} firmamızca tarafınıza borçlu görünmektedir.` : 'Hesap bakiyesi sıfırdır.'}</b></p>
    <div class="kucuk-not">B: Borç bakiye, A: Alacak bakiye. Mutabakat için lütfen ekstreyi kontrol ederek bize bildiriniz.</div>
  </div>`);
}

export const BELGE = { devir: 'Devir', satis_fisi: 'Satış fişi', alis_faturasi: 'Alış faturası', tahsilat: 'Tahsilat', odeme: 'Ödeme', duzeltme: 'Düzeltme' };

export function tabloYazdir(ctx, baslik, altBaslik, basliklar, satirlar, toplam) {
  yazdir(html`<div class="belge">${belgeUst(ctx, baslik, html`<div>${altBaslik || ''}</div><div>${tarih(new Date().toISOString())}</div>`)}
    <table><thead><tr>${basliklar.map((b) => html`<th class="${b.sayi ? 'sayi' : ''}">${b.ad}</th>`)}</tr></thead>
    <tbody>${satirlar.map((s) => html`<tr>${s.map((v, i) => html`<td class="${basliklar[i].sayi ? 'sayi' : ''}">${v}</td>`)}</tr>`)}</tbody>
    ${toplam ? html`<tfoot><tr>${toplam.map((v, i) => html`<td class="${basliklar[i].sayi ? 'sayi' : ''}">${v}</td>`)}</tr></tfoot>` : ''}</table></div>`);
}

// =====================================================================
// Teklif / proforma / tahsilat makbuzu (Atar Bilişim örnek formatları)
// =====================================================================

const BIRIM_KISA = { adet: 'ad', metre: 'm', paket: 'pk', kutu: 'kt', takım: 'tk', saat: 'sa' };
const miktarBirim = (m, b) => `${miktar(m)} ${BIRIM_KISA[b] || b || ''}`.trim();
const kase = (ctx) => (ctx.ayarlar.kase_imza ? html`<img class="belge-kase" src="/dosya/${ctx.ayarlar.kase_imza}" alt="Kaşe ve imza">` : '');

// Sayıyı Türkçe yazıya çevirir: 1250.5 -> "Bin İki Yüz Elli Türk Lirası Elli Kuruş"
export function tutarYaziyla(tutar) {
  const BIR = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const ON = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const BASAMAK = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon'];
  const uclu = (n) => {
    const y = Math.floor(n / 100); const o = Math.floor((n % 100) / 10); const b = n % 10;
    return [y ? (y === 1 ? 'Yüz' : `${BIR[y]} Yüz`) : '', ON[o], BIR[b]].filter(Boolean).join(' ');
  };
  const yaz = (n) => {
    if (n === 0) return 'Sıfır';
    const parca = [];
    for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
      const g = n % 1000;
      if (!g) continue;
      parca.unshift(i === 1 && g === 1 ? 'Bin' : [uclu(g), BASAMAK[i]].filter(Boolean).join(' '));
    }
    return parca.join(' ');
  };
  const kurus = Math.round(Math.abs(Number(tutar)) * 100);
  const tl = Math.floor(kurus / 100); const kr = kurus % 100;
  return `${yaz(tl)} Türk Lirası${kr ? ` ${yaz(kr)} Kuruş` : ''}`;
}

function kalemTablosu(satirlar, d = 'TRY') {
  const para = (n) => dovizPara(n, d);
  const iskontoVar = satirlar.some((s) => Number(s.iskonto_orani));
  return html`<table class="belge-tablo"><thead><tr><th class="no"></th><th>Açıklama</th><th class="sayi">Miktar</th><th class="sayi">Fiyat</th>
    ${iskontoVar ? html`<th class="sayi">İsk.</th>` : ''}<th class="sayi">KDV (%)</th><th class="sayi">Tutar (KDV Hariç)</th></tr></thead>
    <tbody>${satirlar.map((s, i) => html`<tr><td class="no">${i + 1}</td><td><b>${s.aciklama}</b>${s.notu ? html`<div class="satir-not">${s.notu}</div>` : ''}</td>
      <td class="sayi">${miktarBirim(s.miktar, s.birim)}</td><td class="sayi">${para(s.birim_fiyat)}</td>
      ${iskontoVar ? html`<td class="sayi">${Number(s.iskonto_orani) ? '%' + Number(s.iskonto_orani) : ''}</td>` : ''}
      <td class="sayi">%${Number(s.kdv_orani)}</td><td class="sayi">${para(s.tutar)}</td></tr>`)}</tbody></table>`;
}

function toplamBlok(b) {
  const d = b.doviz || 'TRY';
  const para = (n) => dovizPara(n, d);
  const oranlar = [...new Set(b.satirlar.map((s) => Number(s.kdv_orani)))];
  const kur = Number(b.kur);
  const tlSatir = d !== 'TRY' && b.tl_karsilik_goster && kur > 0
    ? html`<tr class="tl-karsilik"><td>TL karşılığı<small>1 ${d} = ${kur.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} ₺</small></td><td>${dovizPara(Math.round(b.genel_toplam * kur * 100) / 100)}</td></tr>` : '';
  return html`<table class="belge-toplam"><tbody>
    <tr><td>Net</td><td>${para(b.ara_toplam)}</td></tr>
    <tr><td>KDV${oranlar.length === 1 ? ` (%${oranlar[0]})` : ''}</td><td>${para(b.kdv_toplam)}</td></tr>
    <tr class="genel"><td>Toplam</td><td>${para(b.genel_toplam)}</td></tr>${tlSatir}</tbody></table>`;
}

export function proformaYazdir(ctx, t, { kaseImza = t.kase_imza } = {}) {
  yazdir(html`<div class="belge belge2">
    ${firmaBlok(ctx)}
    <div class="belge-baslik">PROFORMA FATURA</div>
    <div class="belge-musteri"><div><b class="musteri-unvan">${t.unvan}</b>
      ${t.vergi_no ? html`<div class="musteri-vn">${t.vergi_dairesi ? `VD:${t.vergi_dairesi} ` : ''}VN:${t.vergi_no}</div>` : ''}</div>
      <div class="tarih"><b>Tarih:</b> ${tarih(t.tarih)}</div></div>
    ${kalemTablosu(t.satirlar, t.doviz)}
    ${toplamBlok(t)}
    ${kaseImza ? html`<div class="kase-alan">${kase(ctx)}</div>` : ''}
  </div>`);
}

export function teklifYazdir(ctx, t, { kaseImza = t.kase_imza } = {}) {
  const a = ctx.ayarlar;
  yazdir(html`<div class="belge belge2">
    ${a.teklif_serit ? html`<img class="belge-serit" src="/dosya/${a.teklif_serit}" alt="">` : firmaBlok(ctx)}
    <div class="belge-baslik">TEKLİF FORMU</div>
    <div class="belge-musteri"><div><b class="musteri-unvan">${t.unvan}</b>
      ${t.cari_adres ? html`<div>${t.cari_adres}${t.ilce || t.il ? ` ${[t.ilce, t.il].filter(Boolean).join('/')}` : ''}</div>` : ''}
      ${t.vergi_dairesi || t.vergi_no ? html`<div>${t.vergi_dairesi ? `VD:${t.vergi_dairesi}` : ''} ${t.vergi_no ? `VN:${t.vergi_no}` : ''}</div>` : ''}</div>
      <div class="tarih"><b>Tarih:</b> ${tarih(t.tarih)}${t.gecerlilik ? html`<div class="gecerlilik">Geçerlilik: ${tarih(t.gecerlilik)}</div>` : ''}</div></div>
    ${t.giris_metni ? html`<p class="belge-metin">${t.giris_metni}</p>` : ''}
    ${kalemTablosu(t.satirlar, t.doviz)}
    ${toplamBlok(t)}
    ${t.kapanis_metni ? html`<p class="belge-metin kapanis">${t.kapanis_metni}</p>` : ''}
    <p class="belge-metin">Saygılarımızla,</p>
    ${kaseImza ? html`<div class="kase-alan">${kase(ctx)}</div>` : ''}
  </div>`);
}

const ODEME_SEKLI = { kasa: 'Nakit', banka: 'Havale / EFT', pos: 'Kredi kartı' };

export function makbuzYazdir(ctx, m, { kaseImza = true, ikiNusha = false } = {}) {
  const bakiye = Number(m.kalan_bakiye || 0);
  const nusha = (etiket) => html`<div class="makbuz">
    ${etiket ? html`<div class="nusha">${etiket}</div>` : ''}
    <div class="makbuz-ust">${firmaBlok(ctx)}
      <div class="makbuz-bilgi"><div class="belge-baslik" style="margin:0 0 .4rem">TAHSİLAT MAKBUZU</div>
        <div><b>No:</b> TM-${String(m.id).padStart(6, '0')}</div><div><b>Tarih:</b> ${tarih(m.tarih)}</div></div></div>
    <div class="makbuz-kutu">
      <div><b>Sayın:</b> ${m.unvan}</div>
      ${m.cari_adres ? html`<div>${m.cari_adres}${m.ilce || m.il ? ` ${[m.ilce, m.il].filter(Boolean).join('/')}` : ''}</div>` : ''}
      ${m.vergi_no ? html`<div>${m.vergi_dairesi ? `VD:${m.vergi_dairesi} ` : ''}VN:${m.vergi_no}</div>` : ''}
    </div>
    <p>Aşağıda belirtilen tutar tarafınızdan tahsil edilmiştir.</p>
    <table class="belge-tablo"><thead><tr><th>Ödeme şekli</th><th>Açıklama</th><th>Belge / dekont no</th><th class="sayi">Tutar</th></tr></thead>
      <tbody><tr><td>${ODEME_SEKLI[m.hesap_tip] || ''} <span class="soluk-yazi">(${m.hesap_ad})</span></td><td>${m.aciklama || ''}</td><td>${m.belge_no || ''}</td>
        <td class="sayi"><b>${para(m.tutar)}</b></td></tr></tbody></table>
    <div class="makbuz-yazi"><b>Yalnız:</b> #${tutarYaziyla(m.tutar)}#</div>
    <div class="makbuz-bakiye">Tahsilat sonrası cari bakiyeniz: <b>${para(Math.abs(bakiye))}</b> ${bakiye > 0.004 ? '(Borç)' : bakiye < -0.004 ? '(Alacak)' : ''}</div>
    <div class="imza-kutular"><div><b>Ödeme yapan</b><br>${m.unvan}</div>
      <div><b>Tahsil eden</b><br>${ctx.ayarlar.firma_adi || ''}${kaseImza ? html`<br>${kase(ctx)}` : ''}</div></div>
  </div>`;
  yazdir(html`<div class="belge belge2">${ikiNusha ? html`${nusha('ASIL')}<div class="kesme-cizgisi"></div>${nusha('SURET')}` : nusha('')}</div>`);
}
