// Yönetici iş detayı
import { api } from '../api.js';
import { html, $, bildir, pencere, sor, onayla, para, saat, tarih, zaman, durumRozet, telLink, haritaLink, ONCELIK, DURUM } from '../ui.js';
import { planlaPenceresi, cariSecici, cariYeniYakala, cariFormu } from '../bilesen.js';
import { malzemeListesi, listedenAkisi, barkodAkisi, tanimsizAkisi, fotoAkisi } from './saha.js';
import { teslimFormuYazdir } from '../belgeler.js';

export default async function (el, [id], ctx) {
  const is = await api.get(`/isler/${id}`);
  ctx.baslik(`İş #${is.id}`);
  const k = is.karlilik || {};
  const malzemeAcik = ['planlandi', 'sahada', 'tamamlandi'].includes(is.durum);
  const aktifFis = (is.fisler || []).find((f) => f.durum !== 'iptal');

  const aksiyon = {
    havuz: html`<button class="btn birincil" data-a="planla">📅 Takvime yerleştir</button><button class="btn ikincil" data-a="duzenle">Düzenle</button><button class="btn tehlike-cizgi" data-a="iptal">İptal et</button>`,
    planlandi: html`<button class="btn birincil" data-a="planla">Taşı / yeniden planla</button><button class="btn ikincil" data-a="havuz">↩ Havuza geri al</button>
      <a class="btn ikincil" href="#/saha/${is.id}">Saha ekranı</a><button class="btn ikincil" data-a="duzenle">Düzenle</button><button class="btn tehlike-cizgi" data-a="iptal">İptal</button>`,
    sahada: html`<a class="btn birincil" href="#/saha/${is.id}">Saha ekranı</a><button class="btn ikincil" data-a="havuz">↩ Havuza geri al</button><button class="btn ikincil" data-a="duzenle">Düzenle</button>`,
    tamamlandi: html`${aktifFis ? html`<a class="btn birincil" href="#/fis/${aktifFis.id}">Taslak fişe git</a>` : html`<button class="btn birincil" data-a="fis">🧾 Satış fişi oluştur</button>`}
      <button class="btn ikincil" data-a="form">🖨 Teslim formu</button><button class="btn ikincil" data-a="duzenle">Düzenle</button>`,
    fis_kesildi: html`${aktifFis ? html`<a class="btn birincil" href="#/fis/${aktifFis.id}">Fişe git (${aktifFis.fis_no})</a>` : ''}<button class="btn ikincil" data-a="form">🖨 Teslim formu</button>`,
    iptal: html`<button class="btn ikincil" data-a="havuz">↩ Havuza geri al</button>`,
  }[is.durum];

  el.innerHTML = String(html`
    <div class="detay-ust">
      <div style="flex:1;min-width:260px"><div class="btn-grup"><span class="no">#${is.id}</span>${durumRozet(is.durum)}
        ${is.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}
        ${is.ekip_ad ? html`<span><span class="nokta" style="background:${is.ekip_renk}"></span>${is.ekip_ad}</span>` : ''}
        ${is.plan_baslangic ? html`<span class="soluk">📅 ${tarih(is.plan_baslangic)} ${saat(is.plan_baslangic)}–${saat(is.plan_bitis)}</span>` : ''}</div>
        <h2 style="margin-top:.35rem">${is.baslik}</h2></div>
      <div class="btn-grup">${aksiyon}</div>
    </div>
    ${is.durum === 'iptal' ? html`<div class="uyari-kutu">İptal nedeni: ${is.iptal_nedeni || '-'}</div>` : ''}
    ${is.durum === 'tamamlandi' && !is.cari_id ? html`<div class="uyari-kutu">Fiş kesmek için önce bu işe bir cari bağlayın.</div>` : ''}
    <div class="izgara iki">
      <div>
        <div class="kart"><div class="kart-ust"><h3>Bilgiler</h3></div><div class="kart-govde">
          <dl class="bilgi-liste">
            <dt>Cari</dt><dd>${is.cari_id ? html`<a href="#/cari/${is.cari_id}"><b>${is.cari_unvan}</b></a> · ` : html`<span style="color:var(--turuncu)">Bağlı değil</span> · `}
              ${is.durum !== 'fis_kesildi' ? html`<button class="btn-metin" style="color:var(--ana)" data-a="cari">${is.cari_id ? 'değiştir' : 'cari bağla'}</button>` : ''}</dd>
            ${is.cari_id ? html`<dt>İlgili cihaz</dt><dd>${is.cihaz ? html`<b>${[is.cihaz.tur, is.cihaz.marka, is.cihaz.model].filter(Boolean).join(' ')}</b>
                ${is.cihaz.konum ? html` · ${is.cihaz.konum}` : ''}${is.cihaz.seri_no ? html` · SN ${is.cihaz.seri_no}` : ''}${is.cihaz.ip_adresi ? html` · ${is.cihaz.ip_adresi}` : ''} · ` : ''}
              <button class="btn-metin" style="color:var(--ana)" data-a="cihaz">${is.cihaz ? 'değiştir' : 'cihaz seç'}</button></dd>` : ''}
            ${is.iletisim_ad ? html`<dt>İletişim</dt><dd>${is.iletisim_ad}</dd>` : ''}
            <dt>Telefon</dt><dd>${telLink(is.iletisim_tel || is.cari_telefon) || '-'}</dd>
            <dt>Adres</dt><dd>${is.adres || is.cari_adres ? html`${is.adres || is.cari_adres} · <a href="${haritaLink(is.adres || is.cari_adres)}" target="_blank" rel="noopener">haritada aç</a>` : '-'}</dd>
            <dt>Öncelik</dt><dd>${ONCELIK[is.oncelik]}</dd>
            ${is.aciklama ? html`<dt>Açıklama</dt><dd style="white-space:pre-wrap">${is.aciklama}</dd>` : ''}
            ${is.teknisyen_notu ? html`<dt>Teknisyen notu</dt><dd style="white-space:pre-wrap">${is.teknisyen_notu}</dd>` : ''}
            ${is.baslama_zamani ? html`<dt>Sahada</dt><dd>${zaman(is.baslama_zamani)} → ${is.bitis_zamani ? zaman(is.bitis_zamani) : 'devam ediyor'}</dd>` : ''}
            <dt>Kayıt</dt><dd>${zaman(is.olusturma)} · ${is.olusturan || ''}${is.kaynak === 'telegram' ? ' · 📱 Telegram\'dan' : ''}</dd>
          </dl>
          ${is.ham_mesaj && is.ham_mesaj !== is.baslik ? html`<div style="margin-top:.8rem"><small>Telefonda yazılan ilk not</small><div class="ham-mesaj">${is.ham_mesaj}</div></div>` : ''}
        </div></div>

        <div class="kart"><div class="kart-ust"><h3>Malzemeler</h3><span class="bosluk"></span>
          ${malzemeAcik ? html`<button class="btn ikincil kucuk" data-akis="liste">+ Ekle</button><button class="btn ikincil kucuk" data-akis="barkod">📷 Barkod</button><button class="btn ikincil kucuk" data-akis="tanimsiz">Tanımsız</button>` : ''}</div>
          <div>${malzemeListesi(is, { silinebilir: malzemeAcik, maliyet: true })}</div></div>

        <div class="kart"><div class="kart-ust"><h3>Fotoğraflar</h3><span class="bosluk"></span><button class="btn ikincil kucuk" data-akis="foto">+ Fotoğraf</button></div>
          <div class="kart-govde">${is.fotograflar.length ? html`<div class="foto-izgara">${is.fotograflar.map((f) => html`<a href="/dosya/${f.dosya_yolu}" target="_blank" title="${f.ad_soyad || ''} ${zaman(f.zaman)}"><img src="/dosya/${f.dosya_yolu}" loading="lazy" alt=""></a>`)}</div>` : html`<span class="soluk">Fotoğraf yok</span>`}</div></div>

        <div class="kart"><div class="kart-ust"><h3>Müşteri teslim onayı</h3></div><div class="kart-govde">
          ${is.teslim ? html`<dl class="bilgi-liste"><dt>Teslim alan</dt><dd><b>${is.teslim.teslim_alan_ad}</b> ${is.teslim.teslim_alan_tel || ''}</dd>
              <dt>Zaman</dt><dd>${zaman(is.teslim.zaman)}</dd><dt>Teknisyen</dt><dd>${is.teslim.teknisyen || ''}</dd>
              ${is.teslim.musteri_notu ? html`<dt>Müşteri notu</dt><dd>${is.teslim.musteri_notu}</dd>` : ''}</dl>
              <img class="imza-gor" style="margin-top:.6rem" src="/dosya/${is.teslim.imza_dosya}" alt="İmza">`
            : html`<span class="soluk">Henüz alınmadı. Teknisyen saha ekranından müşteriye imza attırır.</span>`}</div></div>
      </div>

      <div>
        <div class="kart"><div class="kart-ust"><h3>Maliyet ve kâr</h3></div><div class="kart-govde">
          <div class="toplam-kutu" style="width:100%">
            <div><span>Malzeme maliyeti</span><b>${para(k.malzeme_maliyeti || 0)}</b></div>
            ${k.maliyetsiz_kalem ? html`<div style="color:var(--turuncu)"><span>Maliyeti girilmemiş kalem</span><b>${k.maliyetsiz_kalem}</b></div>` : ''}
            <div><span>Satış (KDV hariç)</span><b>${k.satis_kdv_haric != null ? para(k.satis_kdv_haric) : '—'}</b></div>
            <div class="genel"><span>Kâr</span><span class="${(k.kar || 0) >= 0 ? 'pozitif' : 'negatif'}">${k.kar != null ? para(k.kar) : '—'}</span></div>
            ${k.kar_orani != null ? html`<div class="kar-satir"><span>Kâr oranı</span><span>%${k.kar_orani}</span></div>` : ''}
          </div></div></div>
        ${(is.fisler || []).length ? html`<div class="kart"><div class="kart-ust"><h3>Fişler</h3></div><div class="kart-govde sifir"><table class="tablo"><tbody>
          ${is.fisler.map((f) => html`<tr class="tikla ${f.durum === 'iptal' ? 'iptal' : ''}" data-git="fis/${f.id}"><td>${f.fis_no}</td><td>${durumRozet(f.durum)}</td><td class="sayi">${para(f.genel_toplam)}</td></tr>`)}
          </tbody></table></div></div>` : ''}
        <div class="kart"><div class="kart-ust"><h3>Geçmiş</h3></div><div class="kart-govde">
          <ul class="zaman-cizgisi">${is.gecmis.map((g) => html`<li><b>${g.yeni_durum ? DURUM[g.yeni_durum]?.ad : ''}</b> ${g.aciklama ? html`– ${g.aciklama}` : ''}
            <div class="soluk">${zaman(g.zaman)} · ${g.ad_soyad || 'sistem'}</div></li>`)}</ul></div></div>
      </div>
    </div>`);

  const yenile = () => ctx.yenile();
  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-git]');
    if (g) return ctx.git(g.dataset.git);
    const ak = e.target.closest('[data-akis]');
    if (ak) {
      const t = ak.dataset.akis;
      const r = t === 'liste' ? await listedenAkisi(is.id, ctx) : t === 'barkod' ? await barkodAkisi(is.id) : t === 'tanimsiz' ? await tanimsizAkisi(is.id) : await fotoAkisi(is.id);
      if (r) yenile();
      return;
    }
    const ms = e.target.closest('[data-malzeme-sil]');
    if (ms) {
      if (await onayla('Malzeme işten çıkarılsın mı? Stok geri eklenecek.', { evet: 'Çıkar', tehlike: true })) {
        try { await api.del(`/malzeme/${ms.dataset.malzemeSil}`); yenile(); } catch (err) { bildir(err.message, 'hata'); }
      }
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'planla') { if (await planlaPenceresi(ctx, is)) yenile(); }
      else if (a === 'havuz') {
        const neden = await sor('Havuza geri al', 'Neden? (ertelendi, müşteri iptal etti…)');
        if (neden === null) return;
        await api.post(`/isler/${is.id}/havuza-al`, { neden });
        bildir('İş havuza alındı.', 'basari'); yenile();
      } else if (a === 'iptal') {
        const neden = await sor('İşi iptal et', 'İptal nedeni', { zorunlu: true });
        if (!neden) return;
        await api.post(`/isler/${is.id}/iptal`, { neden });
        bildir('İş iptal edildi.'); yenile();
      } else if (a === 'fis') {
        if (!is.cari_id) { bildir('Önce işe bir cari bağlayın.', 'uyari'); return cariBagla(); }
        const r = await api.post(`/isler/${is.id}/fis`);
        ctx.git(`fis/${r.id}`);
      } else if (a === 'form') teslimFormuYazdir(ctx, is);
      else if (a === 'cari') cariBagla();
      else if (a === 'duzenle') duzenle();
      else if (a === 'cihaz') cihazSec();
    } catch (err) { bildir(err.message, 'hata'); }
  });

  async function cariBagla() {
    let secilen = null;
    const r = await pencere({
      baslik: 'Cari bağla',
      icerik: html`<label class="alan"><span>Cari ara</span><input id="c-ara" placeholder="Ad, telefon…" autofocus></label>
        <div id="c-secili" class="bilgi-kutu" hidden></div>
        <button type="button" class="btn ikincil" id="c-yeni">+ Bu iş bilgileriyle yeni cari oluştur</button>`,
      acildi: (d) => {
        const inp = $('#c-ara', d);
        const sec = (c) => { secilen = c; inp.value = c.unvan; const s = $('#c-secili', d); s.hidden = false; s.textContent = `Seçildi: ${c.unvan}`; };
        cariSecici(inp, sec);
        cariYeniYakala(d, sec);
        $('#c-yeni', d).onclick = async () => {
          const c = await cariFormu(null, { unvan: is.iletisim_ad || '', telefon: is.iletisim_tel || '', adres: is.adres || '' });
          if (c) sec(c);
        };
      },
      kaydetMetin: 'Bağla',
      kaydet: async () => {
        if (!secilen) throw new Error('Bir cari seçin.');
        await api.put(`/isler/${is.id}`, { cari_id: secilen.id, ...(is.adres ? {} : { adres: secilen.adres || null }) });
      },
    });
    if (r) { bildir('Cari bağlandı.', 'basari'); yenile(); }
  }

  async function cihazSec() {
    const { envanterTablosu, envanterFormu, cihazAdi } = await import('./envanter.js');
    const liste = await api.get(`/isler/${is.id}/envanter`);
    const r = await pencere({
      baslik: `${is.cari_unvan} · cihazlar`, genis: true, kaydetMetin: null, iptalMetin: 'Kapat',
      icerik: html`<p class="soluk" style="margin-top:0">Bu işin ilgili olduğu cihazı seçin.</p>
        <div class="tablo-kap">${envanterTablosu(liste, { bosMetin: 'Bu kurum için kayıtlı cihaz yok.' })}</div>
        <div class="btn-grup" style="margin-top:.8rem"><button type="button" class="btn ikincil" data-yeni-cihaz>+ Yeni cihaz ekle</button>
          ${is.cihaz ? html`<button type="button" class="btn tehlike-cizgi" data-cihaz-kaldir>Bağlantıyı kaldır</button>` : ''}</div>`,
      acildi: (d, kapat) => d.addEventListener('click', async (e) => {
        const t = e.target.closest('[data-env]'); if (t) return kapat({ id: Number(t.dataset.env) });
        if (e.target.closest('[data-cihaz-kaldir]')) return kapat({ id: null });
        if (e.target.closest('[data-yeni-cihaz]')) { const y = await envanterFormu(null, { cari: { id: is.cari_id, unvan: is.cari_unvan } }); if (y) kapat({ id: y.id }); }
      }),
    });
    if (!r) return;
    await api.put(`/isler/${is.id}`, { envanter_id: r.id });
    bildir(r.id ? 'Cihaz işe bağlandı.' : 'Bağlantı kaldırıldı.', 'basari');
    void cihazAdi; yenile();
  }

  async function duzenle() {
    const r = await pencere({
      baslik: 'İşi düzenle', genis: true,
      icerik: html`<label class="alan"><span>Başlık *</span><input name="baslik" value="${is.baslik}" required></label>
        <div class="satir3"><label class="alan"><span>İletişim kişisi</span><input name="iletisim_ad" value="${is.iletisim_ad || ''}"></label>
          <label class="alan"><span>Telefon</span><input name="iletisim_tel" value="${is.iletisim_tel || ''}"></label>
          <label class="alan"><span>Öncelik</span><select name="oncelik">${[1, 2, 3].map((o) => html`<option value="${o}" ${is.oncelik === o ? 'selected' : ''}>${ONCELIK[o]}</option>`)}</select></label></div>
        <label class="alan"><span>Adres</span><textarea name="adres" rows="2">${is.adres || ''}</textarea></label>
        <label class="alan"><span>Açıklama</span><textarea name="aciklama" rows="3">${is.aciklama || ''}</textarea></label>`,
      kaydet: async (v) => { if (!v.baslik) throw new Error('Başlık gerekli.'); await api.put(`/isler/${is.id}`, { ...v, oncelik: Number(v.oncelik) }); },
    });
    if (r) yenile();
  }
}
