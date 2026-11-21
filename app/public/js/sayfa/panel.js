import { api } from '../api.js';
import { html, para, saat, durumRozet, $ } from '../ui.js';
import { hizliKutu } from './havuz.js';

const selam = () => { const s = new Date().getHours(); return s < 6 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : 'İyi akşamlar'; };

export default async function (el, _p, ctx) {
  ctx.baslik('Panel');
  const o = await api.get('/ozet');
  const gun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>${selam()}, ${ctx.kullanici.ad_soyad.split(' ')[0]}</h2><span class="alt">${gun}</span></div>
    <div class="istatistik">
      <a class="ist vurgu" href="#/havuz"><small>Havuzda bekleyen</small><b>${o.havuz}</b></a>
      <a class="ist" href="#/takvim"><small>Bugün planlı</small><b>${o.bugun}</b></a>
      <a class="ist uyari" href="#/isler?durum=sahada"><small>Şu an sahada</small><b>${o.sahada}</b></a>
      <a class="ist ${o.fis_bekleyen ? 'tehlike' : ''}" href="#/isler?durum=tamamlandi"><small>Fişi kesilecek</small><b>${o.fis_bekleyen}</b></a>
      ${o.geciken ? html`<a class="ist tehlike" href="#/isler?durum=planlandi"><small>Tarihi geçen plan</small><b>${o.geciken}</b></a>` : ''}
    </div>
    <div class="istatistik">
      <a class="ist" href="#/raporlar/cari-bakiye"><small>Toplam alacak</small><b>${para(o.toplam_alacak)}</b></a>
      <a class="ist ${o.vadesi_gecen > 0 ? 'tehlike' : ''}" href="#/raporlar/vadesi-gecen"><small>Vadesi geçen</small><b>${para(o.vadesi_gecen)}</b></a>
      <a class="ist" href="#/raporlar/aylik"><small>Bu ay satış (KDV hariç)</small><b>${para(o.bu_ay.ciro)}</b></a>
      <a class="ist" href="#/raporlar/is-karlilik"><small>Bu ay kâr</small><b class="${o.bu_ay.kar >= 0 ? 'pozitif' : 'negatif'}">${para(o.bu_ay.kar)}</b></a>
    </div>
    ${o.onay_bekleyen_urun ? html`<div class="uyari-kutu">Sahada eklenen <b>${o.onay_bekleyen_urun}</b> ürün maliyet onayı bekliyor. <a href="#/urunler?onay=1">Ürünlere git →</a></div>` : ''}
    ${o.stok_uyari ? html`<div class="uyari-kutu">Kritik seviyede veya eksi stokta <b>${o.stok_uyari}</b> ürün var. <a href="#/raporlar/stok">Stok uyarıları →</a></div>` : ''}
    <div class="izgara iki">
      <div>
        <div class="kart"><div class="kart-ust"><h3>Telefonla gelen işi yaz</h3></div><div class="kart-govde" id="hizli"></div></div>
        <div class="kart"><div class="kart-ust"><h3>Bugünkü işler</h3><a href="#/takvim" class="btn ikincil kucuk">Takvim</a></div>
          <div class="kart-govde sifir">${o.bugun_isler.length ? html`<table class="tablo"><tbody>${o.bugun_isler.map((i) => html`
            <tr class="tikla" data-git="is/${i.id}"><td class="nowrap"><b>${saat(i.plan_baslangic)}</b></td>
              <td>${i.baslik}<div class="alt-satir">${i.cari_unvan || ''}</div></td>
              <td><span class="nokta" style="background:${i.ekip_renk || '#999'}"></span>${i.ekip_ad || ''}</td>
              <td>${durumRozet(i.durum)}</td></tr>`)}</tbody></table>`
            : html`<div class="bos-durum">Bugün için planlanmış iş yok.</div>`}</div></div>
      </div>
      <div>
        <div class="kart"><div class="kart-ust"><h3>Kasa / Banka</h3><a href="#/kasa" class="btn ikincil kucuk">Detay</a></div>
          <div class="kart-govde sifir"><table class="tablo"><tbody>${o.hesaplar.map((h) => html`
            <tr><td>${h.ad}</td><td class="sayi"><b class="${h.bakiye < 0 ? 'negatif' : ''}">${para(h.bakiye)}</b></td></tr>`)}</tbody></table></div></div>
        <div class="kart"><div class="kart-govde">
          <div class="bilgi-liste"><dt>Bu ay kesilen fiş</dt><dd><b>${o.bu_ay.fis}</b></dd>
          <dt>Tedarikçilere borç</dt><dd><b>${para(o.toplam_borc)}</b></dd></div></div></div>
      </div>
    </div>`);
  hizliKutu($('#hizli', el), ctx, () => ctx.yenile());
  el.addEventListener('click', (e) => { const t = e.target.closest('[data-git]'); if (t) ctx.git(t.dataset.git); });
}
