// Yazdırılabilir belgeler (tarayıcıdan "PDF olarak kaydet" de yapılabilir)
import { html, para, paraSade, miktar, tarih, zaman, yazdir } from './ui.js';
import { belgeUst } from './bilesen.js';

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
