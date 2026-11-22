import { api } from '../api.js';
import { html, $, para, dovizPara, paraSade, miktar, zaman, pencere, bildir, sayiCoz, sayiGiris, gorselKucult } from '../ui.js';
import { urunFormu, urunSecici, silOnay } from '../bilesen.js';

const KAYNAK = { alis: 'Alış', is_malzeme: 'İşte kullanıldı', satis: 'Satış', sayim: 'Sayım', duzeltme: 'Düzeltme' };

export default async function (el, [id], ctx) {
  const u = await api.get(`/urunler/${id}`);
  ctx.baslik(u.ad);
  el.innerHTML = String(html`
    <div class="detay-ust"><div style="flex:1;min-width:240px"><a href="#/urunler" class="btn-metin">← Ürünler</a>
      <h2>${u.ad}</h2><div class="soluk">${[u.marka, u.model, [u.ana_grup, u.alt_grup].filter(Boolean).join(' › '), u.kod, u.birim].filter(Boolean).join(' · ')}${!u.aktif ? ' · PASİF' : ''}</div></div>
      <div class="btn-grup"><button class="btn ikincil" data-a="duzenle">Düzenle</button><button class="btn ikincil" data-a="sayim">Stok sayımı</button><button class="btn tehlike-cizgi" data-a="sil">🗑 Sil</button></div></div>
    ${u.onay_bekliyor ? html`<div class="uyari-kutu"><b>Bu ürün sahada teknisyen tarafından eklendi ve maliyet onayı bekliyor.</b>
      ${u.sahadan_not ? html`<br>Teknisyen notu: ${u.sahadan_not}` : ''}
      <div class="btn-grup" style="margin-top:.6rem"><button class="btn birincil" data-a="onayla">Maliyet gir ve onayla</button>
        <button class="btn ikincil" data-a="birlestir">Zaten var olan bir ürün → birleştir</button></div></div>` : ''}
    <div class="istatistik">
      <div class="ist vurgu"><small>Stok</small><b class="${u.stok_miktari < 0 ? 'negatif' : ''}">${miktar(u.stok_miktari)} ${u.birim}</b></div>
      <div class="ist"><small>Ortalama maliyet</small><b>${para(u.ort_maliyet)}</b></div>
      <div class="ist"><small>Satış fiyatı (KDV hariç)</small><b>${u.onerilen_satis != null ? dovizPara(u.onerilen_satis, u.satis_doviz) : '—'}</b></div>
      <div class="ist"><small>Stok değeri</small><b>${para(Math.max(0, u.stok_miktari) * u.ort_maliyet)}</b></div>
    </div>
    <div class="kart urun-resim-kart"><div class="kart-ust"><h3>Resim ve raf yeri</h3><span class="soluk">yazdırma şablonlarında kullanılır</span></div>
      <div class="kart-govde urun-resim-govde">
        <div class="urun-resim-kutu">${u.resim ? html`<img src="/dosya/${u.resim}" alt="">` : html`<span class="soluk">Resim yok</span>`}</div>
        <div class="urun-resim-islem">
          <label class="btn ikincil kucuk">📷 ${u.resim ? 'Resmi değiştir' : 'Resim yükle'}<input type="file" accept="image/*" id="urun-resim" hidden></label>
          ${u.resim ? html`<button class="btn tehlike-cizgi kucuk" data-a="resim-sil">Resmi kaldır</button>` : ''}
          <label class="alan" style="margin-top:.6rem"><span>Raf yeri</span><input id="raf-yeri" value="${u.raf_yeri || ''}" placeholder="ör. A-3, Depo 2. raf" maxlength="40"></label>
        </div></div></div>
    <div class="kart"><div class="kart-ust"><h3>Barkodlar</h3></div><div class="kart-govde">${u.barkodlar.length ? u.barkodlar.map((b) => html`<span class="cip" style="padding-right:.65rem">${b}</span>`) : html`<span class="soluk">Barkod tanımlı değil</span>`}</div></div>
    <div class="kart"><div class="kart-ust"><h3>Stok hareketleri</h3><span class="soluk">son 200</span></div><div class="tablo-kap">
      <table class="tablo mobil-kart"><thead><tr><th>Zaman</th><th>İşlem</th><th>Açıklama</th><th class="sayi">Miktar</th><th class="sayi">Birim maliyet</th><th>Kullanıcı</th></tr></thead><tbody>
      ${u.hareketler.length ? u.hareketler.map((h) => html`<tr class="${h.kaynak === 'is_malzeme' && h.kaynak_id ? 'tikla' : ''}" ${h.kaynak === 'is_malzeme' && h.kaynak_id ? html`data-git="is/${h.kaynak_id}"` : ''}>
        <td data-et="Zaman" class="nowrap">${zaman(h.zaman)}</td><td class="ana-hucre" data-et="">${KAYNAK[h.kaynak] || h.kaynak}</td><td data-et="Açıklama">${h.aciklama || ''}</td>
        <td class="sayi ${h.miktar < 0 ? 'negatif' : 'pozitif'}" data-et="Miktar">${h.miktar > 0 ? '+' : ''}${miktar(h.miktar)}</td>
        <td class="sayi" data-et="Maliyet">${paraSade(h.birim_maliyet)}</td><td data-et="Kullanıcı">${h.ad_soyad || ''}</td></tr>`)
        : html`<tr><td colspan="6" class="bos-durum">Hareket yok</td></tr>`}</tbody></table></div></div>`);

  $('#urun-resim', el)?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { await api.post(`/urunler/${id}/resim`, { veri: await gorselKucult(f, 800, 0.85) }); bildir('Resim kaydedildi', 'basari'); ctx.yenile(); } catch (h) { bildir(h.message, 'hata'); }
  });
  $('#raf-yeri', el)?.addEventListener('change', async (e) => {
    try { await api.put(`/urunler/${id}`, { raf_yeri: e.target.value.trim() || null }); bildir('Raf yeri kaydedildi', 'basari'); } catch (h) { bildir(h.message, 'hata'); }
  });
  el.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-git]'); if (g) return ctx.git(g.dataset.git);
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'duzenle') { if (await urunFormu(u)) ctx.yenile(); }
      else if (a === 'sil') { if (await silOnay('urun', u.id)) ctx.git('urunler'); }
      else if (a === 'resim-sil') { await api.post(`/urunler/${id}/resim`, {}); ctx.yenile(); }
      else if (a === 'sayim') {
        const r = await pencere({
          baslik: 'Stok sayımı',
          icerik: html`<p style="margin-top:0">Sistemdeki stok: <b>${miktar(u.stok_miktari)} ${u.birim}</b></p>
            <label class="alan"><span>Sayılan miktar</span><input name="miktar" inputmode="decimal" value="${sayiGiris(u.stok_miktari)}" autofocus></label>
            <label class="alan"><span>Açıklama</span><input name="aciklama" value="Sayım"></label>`,
          kaydet: async (v) => { const m = sayiCoz(v.miktar); if (m === null) throw new Error('Miktar girin.'); await api.post(`/urunler/${u.id}/sayim`, { miktar: m, aciklama: v.aciklama }); },
        });
        if (r) { bildir('Stok güncellendi.', 'basari'); ctx.yenile(); }
      } else if (a === 'onayla') {
        const r = await pencere({
          baslik: 'Ürünü onayla',
          icerik: html`<label class="alan"><span>Ürün adı</span><input name="ad" value="${u.ad}"></label>
            <div class="satir2"><label class="alan"><span>Birim maliyet (KDV hariç) *</span><input name="birim_maliyet" inputmode="decimal" required autofocus></label>
            <label class="alan"><span>Satış fiyatı (KDV hariç)</span><div class="fiyat-doviz"><input name="onerilen_satis" inputmode="decimal">
              <select name="satis_doviz"><option value="TRY">₺ TL</option><option>USD</option><option>EUR</option></select></div></label>
            <label class="alan"><span>Ürün kodu</span><input name="kod" value="${u.kod || ''}"></label></div>
            <p class="soluk">Bu maliyet, ürünün kullanıldığı ve fişi henüz kesilmemiş işlere de yansıtılır.</p>`,
          kaydet: async (v) => {
            const m = sayiCoz(v.birim_maliyet); if (m === null || m < 0) throw new Error('Maliyet girin.');
            await api.post(`/urunler/${u.id}/onayla`, { ...v, birim_maliyet: m, onerilen_satis: sayiCoz(v.onerilen_satis) });
          },
        });
        if (r) { bildir('Ürün onaylandı.', 'basari'); ctx.yenile(); }
      } else if (a === 'birlestir') {
        let hedef = null;
        const r = await pencere({
          baslik: 'Var olan ürünle birleştir',
          icerik: html`<p style="margin-top:0">Teknisyenin eklediği <b>${u.ad}</b> aslında sistemde var olan bir ürünse onu seçin. İş kayıtları, stok ve barkod o ürüne aktarılır.</p>
            <label class="alan"><span>Asıl ürün</span><input id="h" placeholder="Ara…" autofocus></label>`,
          acildi: (d) => { const i = $('#h', d); urunSecici(i, (x) => { if (x.id === u.id) return; hedef = x; i.value = x.ad; }); },
          kaydetMetin: 'Birleştir',
          kaydet: async () => { if (!hedef) throw new Error('Ürün seçin.'); await api.post(`/urunler/${u.id}/birlestir`, { hedef_id: hedef.id }); return hedef; },
        });
        if (r) { bildir('Ürünler birleştirildi.', 'basari'); ctx.git(`urun/${r.id}`); }
      }
    } catch (err) { bildir(err.message, 'hata'); }
  });
}
