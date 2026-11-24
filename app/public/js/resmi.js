// Resmi faturalar: ortak tablo, ayrıntı penceresi, elle KDV kaydı (liste, cari ekranı ve KDV durumu kullanır)
import { api } from './api.js';
import { html, $, pencere, onayla, para, sayiGiris, sayiCoz, bildir, bugunStr } from './ui.js';
import { cariSecici } from './bilesen.js';

export const GIDER_TURLERI = ['Akaryakıt', 'Telefon / internet', 'Kira', 'Kargo', 'Yemek', 'Elektrik / su / doğalgaz', 'Kırtasiye', 'Diğer'];
export const tarihYaz = (t) => (t ? String(t).slice(0, 10).split('-').reverse().join('.') : '');
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

// Resmi fatura satırları için tablo (yon: 'satis' | 'alis')
export function resmiTablo(liste, { yon, cariGoster = true, bos = 'Kayıt yok.' } = {}) {
  if (!liste.length) return html`<div class="bos-durum">${bos}</div>`;
  const top = liste.reduce((t, x) => { t.m += Number(x.matrah); t.k += Number(x.kdv); t.t += Number(x.toplam); return t; }, { m: 0, k: 0, t: 0 });
  return html`<div class="tablo-kap"><table class="tablo rf-tablo"><thead><tr><th>Tarih</th><th>Fatura no</th>${cariGoster ? html`<th>${yon === 'satis' ? 'Müşteri' : 'Tedarikçi'}</th>` : ''}
      <th class="sayi">Fatura tutarı</th><th class="sayi">KDV tutarı</th><th class="sayi">Toplam tutar</th></tr></thead>
    <tbody>${liste.map((x) => html`<tr class="tikla ${yon === 'alis' ? 'rf-satir-gider' : ''}" data-resmi="${x.id}">
      <td>${tarihYaz(x.tarih)}</td>
      <td>${x.belge_no || '—'}${x.kaynak === 'elle' ? html` <span class="rozet">elle</span>` : ''}${x.tip && !['SATIS', 'TEMELFATURA'].includes(x.tip) ? html` <span class="rozet">${x.tip}</span>` : ''}${x.gider_turu ? html` <span class="rozet rf-gider-rozet">${x.gider_turu}</span>` : ''}</td>
      ${cariGoster ? html`<td>${x.cari_id ? html`<b>${x.cari_unvan}</b>` : html`${x.karsi_unvan}${yon === 'satis' ? html` <span class="rozet turuncu">eşleşmedi</span>` : ''}`}${x.karsi_vkn ? html`<small class="rf-vkn-yazi">VKN ${x.karsi_vkn}</small>` : ''}</td>` : ''}
      <td class="sayi">${para(x.matrah)}</td><td class="sayi">${para(x.kdv)}${Number(x.tevkifat) ? html`<small class="rf-vkn-yazi">tevkifat ${para(x.tevkifat)}</small>` : ''}</td><td class="sayi"><b>${para(x.toplam)}</b></td></tr>`)}</tbody>
    <tfoot><tr><td colspan="${cariGoster ? 3 : 2}"><b>${liste.length} fatura</b></td><td class="sayi"><b>${para(r2(top.m))}</b></td><td class="sayi"><b>${para(r2(top.k))}</b></td><td class="sayi"><b>${para(r2(top.t))}</b></td></tr></tfoot>
  </table></div>`;
}

// Ayrıntı penceresi; değişiklik olduysa true döner
export async function resmiDetay(id) {
  const x = await api.get(`/resmi/${id}`);
  let degisti = false;
  const kalemler = Array.isArray(x.kalemler) ? x.kalemler : [];
  const dokum = Array.isArray(x.kdv_dokum) ? x.kdv_dokum : [];
  await pencere({
    baslik: `${x.yon === 'satis' ? 'Kesilen fatura' : 'Gider faturası (yalnız KDV)'} ${x.belge_no || ''}`,
    genis: true, kaydetMetin: null, iptalMetin: 'Kapat',
    icerik: html`<div class="rf-detay ${x.yon === 'alis' ? 'rf-gider' : ''}"><span tabindex="-1" autofocus></span>
      <div class="rf-detay-ust">
        <div><div class="fatura-etiket">${x.yon === 'satis' ? 'Müşteri (faturadan)' : 'Tedarikçi'}</div><b>${x.karsi_unvan}</b>
          <div class="soluk">${[x.karsi_vkn && `VKN/TCKN ${x.karsi_vkn}`, x.karsi_vergi_dairesi && `V.D. ${x.karsi_vergi_dairesi}`, [x.karsi_ilce, x.karsi_il].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')}</div></div>
        <div><div class="fatura-etiket">Fatura</div><b>${tarihYaz(x.tarih)}</b> · ${[x.profil, x.tip].filter(Boolean).join(' · ') || (x.kaynak === 'elle' ? 'elle girildi' : '')}
          ${x.doviz !== 'TRY' ? html`<div class="soluk">${x.doviz} · kur ${sayiGiris(x.kur)}</div>` : ''}${x.gider_turu ? html`<div><span class="rozet rf-gider-rozet">${x.gider_turu}</span></div>` : ''}</div>
      </div>
      <div class="rf-cari-satir"><span class="fatura-etiket">Programdaki cari</span>
        ${x.cari_id ? html`<a href="#/cari/${x.cari_id}?sekme=resmi" data-git>${x.cari_unvan}</a> <button type="button" class="btn-metin" data-cari-kaldir>bağı kaldır</button>` : html`<span class="soluk">bağlı değil</span>`}
        <div class="rf-bagla"><input id="rd-cari" placeholder="${x.cari_id ? 'Başka cariye bağla…' : 'Cari ara ve bağla…'}"><button type="button" class="btn ikincil kucuk" data-yeni-cari>Faturadaki bilgilerle yeni cari aç</button></div></div>
      ${kalemler.length ? html`<table class="tablo"><thead><tr><th>Kalem</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat</th><th class="sayi">KDV %</th><th class="sayi">Tutar</th></tr></thead>
        <tbody>${kalemler.map((k) => html`<tr><td>${k.ad}</td><td class="sayi">${sayiGiris(k.miktar)} ${k.birim || ''}</td><td class="sayi">${sayiGiris(k.birim_fiyat)}${Number(k.iskonto_orani) ? html`<small class="soluk"> isk. %${sayiGiris(k.iskonto_orani)}</small>` : ''}</td><td class="sayi">${sayiGiris(k.kdv_orani)}</td><td class="sayi">${sayiGiris(k.tutar)}</td></tr>`)}</tbody></table>` : ''}
      <table class="kdv-hesap rf-detay-toplam"><tbody>
        ${dokum.map((o) => html`<tr><td>KDV %${sayiGiris(o.oran)} <small>matrah ${para(o.matrah)}</small></td><td>${para(o.kdv)}</td></tr>`)}
        <tr><td>Fatura tutarı (KDV hariç)</td><td>${para(x.matrah)}</td></tr>
        <tr><td>KDV tutarı</td><td>${para(x.kdv)}</td></tr>
        ${Number(x.tevkifat) ? html`<tr><td>Tevkifat <small>alıcının ödeyeceği</small></td><td>${para(x.tevkifat)}</td></tr>` : ''}
        <tr class="kdv-net"><td>Toplam tutar</td><td>${para(x.toplam)}</td></tr></tbody></table>
      <p class="soluk" style="font-size:.8rem">Bilgi amaçlıdır: cari bakiyesini, stoğu ve kasayı etkilemez; yalnız KDV durumunda kullanılır.</p>
    </div>`,
    altBilgi: html`<button type="button" class="btn tehlike-cizgi" data-sil>🗑 Sil</button>${x.yon === 'alis' && x.kaynak === 'xml' ? html` <button type="button" class="btn ikincil" data-stoklu>Stoklu alışa çevir</button>` : ''}`,
    acildi: (d, kapat) => {
      const bagla = async (govde) => {
        try { const r = await api.put(`/resmi/${x.id}/cari`, govde); degisti = true; bildir(`Cari güncellendi${r.digerleri ? ` (aynı vergi no'lu ${r.digerleri} fatura daha bağlandı)` : ''}.`, 'basari'); kapat(true); } catch (e) { bildir(e.message, 'hata'); }
      };
      cariSecici($('#rd-cari', d), (c) => bagla({ cari_id: c.id }), { yeniIzin: false });
      d.addEventListener('click', async (e) => {
        if (e.target.closest('[data-git]')) { kapat(false); return; }
        if (e.target.closest('[data-yeni-cari]')) { await bagla({ yeni_cari: true }); return; }
        if (e.target.closest('[data-cari-kaldir]')) { await bagla({ cari_id: null }); return; }
        if (e.target.closest('[data-sil]')) {
          if (!await onayla('Bu resmi fatura kaydı silinecek (yalnız KDV hesabından çıkar; başka bir şeyi etkilemez).', { evet: 'Sil', tehlike: true })) return;
          try { await api.del(`/resmi/${x.id}`); degisti = true; bildir('Silindi.'); kapat(true); } catch (err) { bildir(err.message, 'hata'); }
          return;
        }
        if (e.target.closest('[data-stoklu]')) {
          if (!await onayla('Gider kaydı silinecek ve bu tedarikçi "stoklu alış" olarak hatırlanacak. Sonra faturanın XML\'ini Resmi fatura yükleme ekranına yeniden yükleyip ürünleri eşleştirin.', { evet: 'Çevir' })) return;
          try { await api.post(`/resmi/${x.id}/stokluya`); degisti = true; kapat(true); location.hash = '#/resmi-yukle'; } catch (err) { bildir(err.message, 'hata'); }
        }
      });
    },
  });
  return degisti;
}

// Elle KDV kaydı (e-Fatura olmayan kâğıt fatura / fiş)
export function elleKayit({ yon = 'alis', cari = null } = {}) {
  let secili = cari;
  return pencere({
    baslik: 'Elle KDV kaydı',
    icerik: html`<div class="rf-elle">
      <div class="rf-yon"><label><input type="radio" name="yon" value="alis" ${yon === 'alis' ? 'checked' : ''}> Alış (gider)</label>
        <label><input type="radio" name="yon" value="satis" ${yon === 'satis' ? 'checked' : ''}> Satış</label></div>
      <div class="satir2"><label class="alan"><span>Tarih *</span><input type="date" name="tarih" value="${bugunStr()}" required></label>
        <label class="alan"><span>Belge no</span><input name="belge_no"></label></div>
      <label class="alan"><span>Firma / kişi *</span><input name="karsi_unvan" id="el-unvan" value="${cari?.unvan || ''}" placeholder="Ad yazın ya da cariden seçin" required></label>
      <div class="satir2"><label class="alan"><span>Vergi no / TCKN</span><input name="karsi_vkn" inputmode="numeric" value="${cari?.vergi_no || ''}"></label>
        <label class="alan rf-gider-alan"><span>Gider türü</span><select name="gider_turu"><option value="">—</option>${GIDER_TURLERI.map((g) => html`<option>${g}</option>`)}</select></label></div>
      <div class="satir2"><label class="alan"><span>Fatura tutarı (KDV hariç) *</span><input name="matrah" id="el-matrah" inputmode="decimal" required></label>
        <label class="alan"><span>KDV oranı %</span><select name="kdv_orani" id="el-oran">${[20, 10, 1, 0].map((o) => html`<option value="${o}">${o}</option>`)}</select></label></div>
      <div class="rf-elle-ozet" id="el-ozet"></div>
    </div>`,
    kaydetMetin: 'Kaydet',
    acildi: (d) => {
      const ozet = () => {
        const m = sayiCoz($('#el-matrah', d).value) || 0; const o = Number($('#el-oran', d).value) || 0;
        const k = r2(m * o / 100);
        $('#el-ozet', d).innerHTML = String(html`KDV tutarı <b>${para(k)}</b> · Toplam tutar <b>${para(r2(m + k))}</b>`);
        d.querySelector('.rf-gider-alan').hidden = d.querySelector('[name=yon]:checked').value !== 'alis';
      };
      d.addEventListener('input', ozet); d.addEventListener('change', ozet); ozet();
      cariSecici($('#el-unvan', d), (c) => { secili = c; $('#el-unvan', d).value = c.unvan; if (c.vergi_no) d.querySelector('[name=karsi_vkn]').value = c.vergi_no; }, { yeniIzin: false });
    },
    kaydet: async (v) => {
      const cariId = secili && secili.unvan === v.karsi_unvan ? secili.id : null;
      return api.post('/resmi/elle', { ...v, matrah: sayiCoz(v.matrah), cari_id: cariId });
    },
  });
}
