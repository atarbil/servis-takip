// Fiyatlandırma bekleyenler: tamamlanmış ama fişi kesilmemiş işler
import { api } from '../api.js';
import { html, $, para, tarih, saat, sureMetni, bildir } from '../ui.js';

// İşin fişini açar: taslak varsa ona gider, yoksa oluşturur. Cari bağlı değilse iş detayına yönlendirir.
export async function fiyatlandir(ctx, isId) {
  try {
    const r = await api.post(`/isler/${isId}/fis`);
    ctx.git(`fis/${r.id}`);
  } catch (e) {
    if (e.kod === 'CARI_YOK') { bildir('Fiş kesmek için önce işe bir cari bağlayın.', 'uyari', 5000); ctx.git(`is/${isId}`); return; }
    throw e;
  }
}

export default async function (el, _p, ctx) {
  ctx.baslik('Fiyatlandırma');
  const liste = await api.get('/fiyatlandirma');
  ctx.sayacYenile?.();
  const toplamMaliyet = liste.reduce((a, i) => a + Number(i.malzeme_maliyeti), 0);
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Fiyatlandırma bekleyen işler</h2><span class="alt">Tamamlanmış, satış fişi henüz onaylanmamış işler</span></div>
    <div class="istatistik">
      <div class="ist ${liste.length ? 'tehlike' : ''}"><small>Bekleyen iş</small><b>${liste.length}</b></div>
      <div class="ist"><small>Taslak fişi açılmış</small><b>${liste.filter((i) => i.taslak_fis_id).length}</b></div>
      <div class="ist"><small>Toplam malzeme maliyeti</small><b>${para(toplamMaliyet)}</b></div>
    </div>
    ${liste.some((i) => i.onaysiz_urun) ? html`<div class="uyari-kutu">Bazı işlerde maliyeti girilmemiş (sahada eklenen) ürün var. Fiş onaylanmadan önce bu ürünler onaylanmalı.</div>` : ''}
    <div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr>
      <th>İş</th><th>Cari</th><th>Ekip</th><th>Tamamlandı</th><th class="sayi">Malzeme</th><th class="sayi">Maliyet</th><th>Fiş</th><th></th></tr></thead><tbody>
      ${liste.length ? liste.map((i) => html`<tr>
        <td class="ana-hucre" data-et=""><a href="#/is/${i.id}">#${i.id} ${i.baslik}</a></td>
        <td data-et="Cari">${i.unvan ? html`<a href="#/cari/${i.cari_id}">${i.unvan}</a>` : html`<span style="color:var(--turuncu)">bağlı değil</span>`}</td>
        <td data-et="Ekip">${i.ekip ? html`<span class="nokta" style="background:${i.ekip_renk}"></span>${i.ekip}` : '-'}</td>
        <td data-et="Tamamlandı" class="nowrap">${tarih(i.bitis_zamani)} ${saat(i.bitis_zamani)}<div class="alt-satir">${sureMetni(i.bekleme_sn)} önce</div></td>
        <td class="sayi" data-et="Malzeme">${i.malzeme_kalem} kalem${i.onaysiz_urun ? html`<div class="alt-satir" style="color:var(--turuncu)">${i.onaysiz_urun} onaysız</div>` : ''}</td>
        <td class="sayi" data-et="Maliyet">${para(i.malzeme_maliyeti)}</td>
        <td data-et="Fiş">${i.taslak_fis_id ? html`<span class="rozet">Taslak ${i.taslak_fis_no}</span>` : html`<span class="soluk">yok</span>`}</td>
        <td data-et=""><button class="btn birincil kucuk" data-fiyat="${i.id}" data-fis="${i.taslak_fis_id || ''}">${i.taslak_fis_id ? 'Fişe devam et' : 'Fiyatlandır'}</button></td></tr>`)
        : html`<tr><td colspan="8" class="bos-durum"><b>Bekleyen iş yok</b>Tamamlanan işler burada listelenir.</td></tr>`}</tbody></table></div></div>`);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-fiyat]');
    if (!b) return;
    if (b.dataset.fis) return ctx.git(`fis/${b.dataset.fis}`);
    b.disabled = true;
    try { await fiyatlandir(ctx, Number(b.dataset.fiyat)); } catch (err) { bildir(err.message, 'hata'); b.disabled = false; }
  });
  void $;
}
