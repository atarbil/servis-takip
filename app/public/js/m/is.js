// Telefon: iş detayı. İşlemler bilgisayar sayfasıyla ortak (sayfa/is.js → isOlaylari)
import { api } from '../api.js';
import { html, para, saat, tarih, zaman, durumRozet, haritaLink, ONCELIK, DURUM } from '../ui.js';
import { isOlaylari } from '../sayfa/is.js';
import { tanimsizAkisi } from '../sayfa/saha.js';
import { malzemeBolumu, malzemeBagla } from '../malzeme.js';
import { islemListesi, ustDugme, tetikle } from './ortak.js';

const telNo = (t) => String(t || '').replace(/[^\d+]/g, '');

export default async function (el, [id], ctx) {
  const is = await api.get(`/isler/${id}`);
  ctx.baslik(`İş #${is.id}`);
  const k = is.karlilik || {};
  const malzemeAcik = ['havuz', 'planlandi', 'sahada', 'tamamlandi'].includes(is.durum);
  const aktifFis = (is.fisler || []).find((f) => f.durum !== 'iptal');
  const tel = is.iletisim_tel || is.cari_telefon;
  const adres = is.adres || is.cari_adres;

  // Ana işlemler (büyük düğmeler) ve ⋯ menüsündekiler
  const ana = {
    havuz: [['planla', '📅 Takvime yerleştir', 'birincil'], ['teslimet', '✓ Teslim et / Tamamla', 'basari']],
    planlandi: [['planla', '📅 Taşı / yeniden planla', 'birincil'], ['teslimet', '✓ Teslim et / Tamamla', 'basari']],
    sahada: [['teslimet', '✓ Teslim et / Tamamla', 'basari']],
    tamamlandi: [aktifFis ? null : ['fis', '🧾 Satış fişi oluştur', 'birincil'], ['form', '🖨 Teslim formu', 'ikincil']],
    fis_kesildi: [['form', '🖨 Teslim formu', 'ikincil']],
    iptal: [['havuz', '↩ Havuza geri al', 'ikincil']],
  }[is.durum].filter(Boolean);
  const diger = [
    ['planlandi', 'sahada'].includes(is.durum) && { k: 'saha', ad: '🛠 Saha ekranı' },
    is.durum !== 'fis_kesildi' && is.durum !== 'iptal' && { k: 'duzenle', ad: '✎ Düzenle' },
    is.durum !== 'fis_kesildi' && { k: 'cari', ad: is.cari_id ? '👤 Cariyi değiştir' : '👤 Cari bağla' },
    is.cari_id && { k: 'cihaz', ad: '🖥 İlgili cihaz' },
    ['planlandi', 'sahada'].includes(is.durum) && { k: 'havuz', ad: '↩ Havuza geri al' },
    ['havuz', 'planlandi'].includes(is.durum) && { k: 'iptal', ad: 'İşi iptal et', tehlike: true },
    ctx.yonetici && { k: 'sil', ad: '🗑 Sil', tehlike: true },
  ].filter(Boolean);
  ctx.ustEylem(ustDugme('⋯', async () => {
    const s = await islemListesi(`İş #${is.id}`, diger);
    if (s === 'saha') ctx.git(`saha/${is.id}`);
    else if (s) tetikle(el, 'data-a', s);
  }, { etiket: 'Diğer işlemler' }));

  el.innerHTML = String(html`
    <section class="mk-blok mk-is-ust">
      <div class="mk-rozetler"><span class="soluk">#${is.id}</span>${durumRozet(is.durum)}${is.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}
        ${is.ekip_ad ? html`<span class="mk-ekip"><span class="nokta" style="background:${is.ekip_renk}"></span>${is.ekip_ad}</span>` : ''}</div>
      <h2>${is.baslik}</h2>
      ${is.plan_baslangic ? html`<div class="mk-plan">📅 ${tarih(is.plan_baslangic)} · ${saat(is.plan_baslangic)}–${saat(is.plan_bitis)}</div>` : ''}
      ${is.durum === 'iptal' ? html`<div class="uyari-kutu">İptal nedeni: ${is.iptal_nedeni || '-'}</div>` : ''}
      ${is.durum === 'tamamlandi' && !is.cari_id ? html`<div class="uyari-kutu">Fiş kesmek için önce bu işe bir cari bağlayın.</div>` : ''}
      ${aktifFis ? html`<a class="btn birincil mk-tam" href="#/fis/${aktifFis.id}">${is.durum === 'fis_kesildi' ? `Fişe git (${aktifFis.fis_no})` : 'Taslak fişe git'}</a>` : ''}
      ${ana.length ? html`<div class="mk-dugmeler">${ana.map(([a, ad, s]) => html`<button type="button" class="btn ${s}" data-a="${a}">${ad}</button>`)}</div>` : ''}
      <div class="mk-hizli">
        ${tel ? html`<a href="tel:${telNo(tel)}">📞<span>Ara</span></a>` : ''}
        ${tel ? html`<a href="https://wa.me/${telNo(tel).replace(/^0/, '90').replace(/^\+/, '')}" target="_blank" rel="noopener">💬<span>WhatsApp</span></a>` : ''}
        ${adres ? html`<a href="${haritaLink(adres)}" target="_blank" rel="noopener">🗺<span>Yol tarifi</span></a>` : ''}
        ${is.cari_id ? html`<a href="#/cari/${is.cari_id}">👤<span>Cari</span></a>` : ''}
      </div>
    </section>

    <section class="mk-blok">
      <h3>Bilgiler</h3>
      <dl class="mk-dl">
        <dt>Cari</dt><dd>${is.cari_id ? html`<a href="#/cari/${is.cari_id}"><b>${is.cari_unvan}</b></a>` : html`<span class="turuncu-yazi">Bağlı değil</span>`}
          ${is.durum !== 'fis_kesildi' ? html` <button type="button" class="btn-metin" data-a="cari">${is.cari_id ? 'değiştir' : 'cari bağla'}</button>` : ''}</dd>
        ${is.cari_id ? html`<dt>Cihaz</dt><dd>${is.cihaz ? [is.cihaz.tur, is.cihaz.marka, is.cihaz.model].filter(Boolean).join(' ') : html`<span class="soluk">seçilmedi</span>`}
          <button type="button" class="btn-metin" data-a="cihaz">${is.cihaz ? 'değiştir' : 'seç'}</button></dd>` : ''}
        ${is.iletisim_ad ? html`<dt>İletişim</dt><dd>${is.iletisim_ad}</dd>` : ''}
        ${tel ? html`<dt>Telefon</dt><dd><a href="tel:${telNo(tel)}">${tel}</a></dd>` : ''}
        ${adres ? html`<dt>Adres</dt><dd>${adres}</dd>` : ''}
        <dt>Öncelik</dt><dd>${ONCELIK[is.oncelik]}</dd>
        ${is.baslama_zamani ? html`<dt>Sahada</dt><dd>${zaman(is.baslama_zamani)} → ${is.bitis_zamani ? zaman(is.bitis_zamani) : 'devam ediyor'}</dd>` : ''}
        <dt>Kayıt</dt><dd>${zaman(is.olusturma)}${is.olusturan ? ` · ${is.olusturan}` : ''}</dd>
      </dl>
      ${is.aciklama ? html`<div class="mk-metin"><small>Açıklama</small>${is.aciklama}</div>` : ''}
      ${is.teknisyen_notu ? html`<div class="mk-metin"><small>Teknisyen notu</small>${is.teknisyen_notu}</div>` : ''}
      ${is.ham_mesaj && is.ham_mesaj !== is.baslik ? html`<div class="mk-metin"><small>İlk yazılan not</small>${is.ham_mesaj}</div>` : ''}
    </section>

    <section class="mk-blok">
      <h3>Malzemeler <small data-mz-sayi>${is.malzemeler.length || ''}</small></h3>
      ${malzemeBolumu(is, { duzenlenebilir: malzemeAcik, maliyet: !ctx.muhasebe })}
    </section>

    <section class="mk-blok">
      <h3>Fotoğraflar <small>${is.fotograflar.length || ''}</small></h3>
      <button type="button" class="btn ikincil mk-tam" data-akis="foto">📷 Fotoğraf ekle</button>
      ${is.fotograflar.length ? html`<div class="mk-foto">${is.fotograflar.map((f) => html`<a href="/dosya/${f.dosya_yolu}" target="_blank"><img src="/dosya/${f.dosya_yolu}" loading="lazy" alt=""></a>`)}</div>` : ''}
    </section>

    ${is.teslim ? html`<section class="mk-blok"><h3>Müşteri teslim onayı</h3>
      <dl class="mk-dl"><dt>Teslim alan</dt><dd><b>${is.teslim.teslim_alan_ad || ''}</b> ${is.teslim.teslim_alan_tel || ''}</dd>
        <dt>Zaman</dt><dd>${zaman(is.teslim.zaman)}</dd>${is.teslim.teknisyen ? html`<dt>Teknisyen</dt><dd>${is.teslim.teknisyen}</dd>` : ''}
        ${is.teslim.musteri_notu ? html`<dt>Not</dt><dd>${is.teslim.musteri_notu}</dd>` : ''}</dl>
      ${is.teslim.imza_dosya ? html`<img class="imza-gor" src="/dosya/${is.teslim.imza_dosya}" alt="İmza">` : html`<p class="soluk">İmza alınmadı</p>`}</section>` : ''}

    <section class="mk-blok kar-bilgi"><h3>Maliyet ve kâr</h3>
      <dl class="mk-dl sayilar">
        <dt>Malzeme maliyeti</dt><dd>${para(k.malzeme_maliyeti || 0)}</dd>
        ${k.maliyetsiz_kalem ? html`<dt class="turuncu-yazi">Maliyeti girilmemiş</dt><dd class="turuncu-yazi">${k.maliyetsiz_kalem} kalem</dd>` : ''}
        <dt>Satış (KDV hariç)</dt><dd>${k.satis_kdv_haric != null ? para(k.satis_kdv_haric) : '—'}</dd>
        <dt><b>Kâr</b></dt><dd><b class="${(k.kar || 0) >= 0 ? 'pozitif' : 'negatif'}">${k.kar != null ? para(k.kar) : '—'}${k.kar_orani != null ? ` · %${k.kar_orani}` : ''}</b></dd>
      </dl></section>

    ${(is.fisler || []).length ? html`<section class="mk-blok"><h3>Fişler</h3>
      ${is.fisler.map((f) => html`<a class="mk-satir ${f.durum === 'iptal' ? 'iptal' : ''}" href="#/fis/${f.id}"><span>${f.fis_no}</span>${durumRozet(f.durum)}<b>${para(f.genel_toplam)}</b></a>`)}</section>` : ''}

    <details class="mk-blok mk-gecmis"><summary><h3>Geçmiş <small>${is.gecmis.length}</small></h3></summary>
      <ul class="zaman-cizgisi">${is.gecmis.map((g) => html`<li><b>${g.yeni_durum ? DURUM[g.yeni_durum]?.ad : ''}</b> ${g.aciklama ? html`– ${g.aciklama}` : ''}
        <div class="soluk">${zaman(g.zaman)} · ${g.ad_soyad || 'sistem'}</div></li>`)}</ul></details>`);

  isOlaylari(el, is, ctx);
  malzemeBagla(el, is, ctx, { maliyet: !ctx.muhasebe, tanimsiz: (o) => tanimsizAkisi(is.id, o) });
}
