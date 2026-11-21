import { api } from '../api.js';
import { html, $, para, saat, tarih, durumRozet, sureMetni, bildir } from '../ui.js';
import { planlaPenceresi, kurAl, dovizCeviriciHtml, dovizCeviriciBagla } from '../bilesen.js';

const selam = () => { const s = new Date().getHours(); return s < 6 ? 'İyi geceler' : s < 12 ? 'Günaydın' : s < 18 ? 'İyi günler' : 'İyi akşamlar'; };
const kurFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });

const kart = (baslik, icerik, { sag = '', sayi } = {}) => html`<div class="kart"><div class="kart-ust"><h3>${baslik}</h3>
  ${sayi !== undefined ? html`<span class="sayi-rozet">${sayi}</span>` : ''}${sag}</div><div class="kart-govde sifir">${icerik}</div></div>`;
const bos = (m) => html`<div class="mini-bos">${m}</div>`;

function isListesi(liste, bosMetin) {
  if (!liste.length) return bos(bosMetin);
  return html`<ul class="mini-liste">${liste.map((i) => html`<li class="tikla" data-git="is/${i.id}">
    <span class="saat">${saat(i.plan_baslangic)}</span>
    <div class="ana-metin"><b>${i.baslik}</b><small><span class="nokta" style="background:${i.ekip_renk || '#999'}"></span>${i.ekip_ad || ''}${i.cari_unvan ? ' · ' + i.cari_unvan : ''}</small></div>
    ${durumRozet(i.durum)}</li>`)}</ul>`;
}

export default async function (el, _p, ctx) {
  ctx.baslik('Panel');
  const o = await api.get('/ozet');
  const gun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const k = await kurAl(ctx);

  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>${selam()}, ${ctx.kullanici.ad_soyad.split(' ')[0]}</h2><span class="alt">${gun}</span></div>

    <div class="istatistik genis">
      <a class="ist vurgu" href="#/havuz"><small>Havuzda bekleyen</small><b>${o.havuz}</b></a>
      <a class="ist" href="#/takvim"><small>Bugün planlı</small><b>${o.bugun}</b><span class="ist-alt">yarın ${o.yarin_isler.length}</span></a>
      <a class="ist uyari" href="#/isler?durum=sahada"><small>Şu an sahada</small><b>${o.sahada}</b></a>
      <a class="ist ${o.fis_bekleyen ? 'tehlike' : ''}" href="#/fiyatlandirma"><small>Fiyatlandırma bekleyen</small><b>${o.fis_bekleyen}</b></a>
      <a class="ist" href="#/raporlar/cari-bakiye"><small>Toplam alacak</small><b>${para(o.toplam_alacak)}</b></a>
      <a class="ist ${o.vadesi_gecen > 0 ? 'tehlike' : ''}" href="#/raporlar/vadesi-gecen"><small>Vadesi geçen</small><b>${para(o.vadesi_gecen)}</b></a>
      <a class="ist" href="#/raporlar/aylik"><small>Bu ay satış</small><b>${para(o.bu_ay.ciro)}</b><span class="ist-alt">${o.bu_ay.fis} fiş · KDV hariç</span></a>
      <a class="ist" href="#/raporlar/is-karlilik"><small>Bu ay kâr</small><b class="${o.bu_ay.kar >= 0 ? 'pozitif' : 'negatif'}">${para(o.bu_ay.kar)}</b></a>
    </div>
    ${o.geciken ? html`<div class="uyari-kutu">Tarihi geçmiş ama başlanmamış <b>${o.geciken}</b> planlı iş var. <a href="#/isler?durum=planlandi">İşlere git →</a></div>` : ''}
    ${o.onay_bekleyen_urun ? html`<div class="uyari-kutu">Sahada eklenen <b>${o.onay_bekleyen_urun}</b> ürün maliyet onayı bekliyor. <a href="#/urunler?onay=1">Ürünlere git →</a></div>` : ''}
    ${o.stok_uyari ? html`<div class="uyari-kutu">Kritik seviyede veya eksi stokta <b>${o.stok_uyari}</b> ürün var. <a href="#/raporlar/stok">Stok uyarıları →</a></div>` : ''}

    <div class="izgara uc">
      <div>
        ${kart('Bugünkü işler', isListesi(o.bugun_isler, 'Bugün için planlanmış iş yok.'), { sayi: o.bugun_isler.length, sag: html`<a href="#/takvim" class="btn ikincil kucuk">Takvim</a>` })}
        ${kart('Yarın', isListesi(o.yarin_isler, 'Yarın için planlanmış iş yok.'), { sayi: o.yarin_isler.length })}
        ${kart('Şu an sahada', o.sahada_isler.length ? html`<ul class="mini-liste">${o.sahada_isler.map((i) => html`<li class="tikla" data-git="is/${i.id}">
            <span class="nokta" style="background:${i.ekip_renk || '#999'}"></span>
            <div class="ana-metin"><b>${i.baslik}</b><small>${i.ekip_ad || ''}${i.cari_unvan ? ' · ' + i.cari_unvan : ''}</small></div>
            <small class="sag-deger">${saat(i.baslama_zamani)}'den beri</small></li>`)}</ul>` : bos('Sahada iş yok.'))}
      </div>
      <div>
        ${kart('Havuzda bekleyenler', o.havuz_isler.length ? html`<ul class="mini-liste">${o.havuz_isler.map((i) => html`<li>
            <div class="ana-metin" data-git="is/${i.id}" style="cursor:pointer"><b>${i.oncelik === 1 ? '🔴 ' : ''}${i.baslik}</b><small>${i.unvan || 'Cari bağlı değil'} · ${sureMetni(i.bekleme_sn)} önce</small></div>
            <button class="btn ikincil kucuk" data-planla="${i.id}">📅 Planla</button></li>`)}</ul>
            ${o.havuz > o.havuz_isler.length ? html`<div class="mini-bos"><a href="#/havuz">Tümünü gör (${o.havuz}) →</a></div>` : ''}` : bos('Havuz boş. 👍'),
          { sayi: o.havuz, sag: html`<a href="#/havuz" class="btn ikincil kucuk">Havuz</a>` })}
        ${kart('Fiyatlandırma bekleyen işler', o.fiyat_bekleyen.length ? html`<ul class="mini-liste">${o.fiyat_bekleyen.map((i) => html`<li class="tikla" data-fiyat="${i.id}" data-fis="${i.taslak_fis_id || ''}">
            <div class="ana-metin"><b>${i.baslik}</b><small>${i.unvan || 'Cari bağlı değil'} · bitti ${tarih(i.bitis_zamani)}</small></div>
            <div class="sag-deger"><small>maliyet</small><br><b>${para(i.malzeme_maliyeti)}</b></div></li>`)}</ul>
            ${o.fis_bekleyen > o.fiyat_bekleyen.length ? html`<div class="mini-bos"><a href="#/fiyatlandirma">Tümünü gör (${o.fis_bekleyen}) →</a></div>` : ''}` : bos('Fiyatlandırılmayı bekleyen iş yok.'),
          { sayi: o.fis_bekleyen, sag: html`<a href="#/fiyatlandirma" class="btn ikincil kucuk">Tümü</a>` })}
      </div>
      <div>
    ${k && (k.usd || k.eur) ? html`<div class="kart kur-kart"><div class="kart-ust"><h3>💱 Döviz</h3><span class="bosluk"></span>
        ${k.usd ? html`<span class="kur-cip"><small>USD</small> <b>${kurFmt.format(k.usd.satis)}</b></span>` : ''}${k.eur ? html`<span class="kur-cip"><small>EUR</small> <b>${kurFmt.format(k.eur.satis)}</b></span>` : ''}</div>
      <div class="kart-govde">${dovizCeviriciHtml(k)}</div></div>` : ''}
        ${kart('Kasa / Banka', html`<ul class="mini-liste">${o.hesaplar.map((h) => html`<li class="tikla" data-git="kasa"><div class="ana-metin"><span>${h.ad}</span></div>
            <b class="sag-deger ${h.bakiye < 0 ? 'negatif' : ''}">${para(h.bakiye)}</b></li>`)}
            <li><div class="ana-metin"><small>Tedarikçilere borç</small></div><b class="sag-deger">${para(o.toplam_borc)}</b></li></ul>`,
          { sag: html`<button class="btn ikincil kucuk" data-tahsilat>💰 Tahsilat</button>` })}
        ${kart('Son tahsilatlar', o.son_tahsilatlar.length ? html`<ul class="mini-liste">${o.son_tahsilatlar.map((t) => html`<li class="tikla" data-git="cari/${t.cari_id}">
            <div class="ana-metin"><b>${t.unvan}</b><small>${tarih(t.tarih)} · ${t.hesap}</small></div><b class="sag-deger pozitif">${para(t.tutar)}</b></li>`)}</ul>` : bos('Henüz tahsilat yok.'))}
        ${kart('Vadesi geçen alacaklar', o.vadesi_gecenler.length ? html`<ul class="mini-liste">${o.vadesi_gecenler.map((v) => html`<li class="tikla" data-git="cari/${v.cari_id}">
            <div class="ana-metin"><b>${v.unvan}</b><small>${v.gecikme_gun} gün gecikme${v.telefon ? ' · ' + v.telefon : ''}</small></div><b class="sag-deger negatif">${para(v.gecikmis_tutar)}</b></li>`)}</ul>` : bos('Vadesi geçen alacak yok. 👍'))}
      </div>
    </div>`);

  if ($('[data-cevirici]', el)) dovizCeviriciBagla(el);
  el.addEventListener('click', async (e) => {
    const p = e.target.closest('[data-planla]');
    if (p) {
      const is = o.havuz_isler.find((x) => x.id === Number(p.dataset.planla));
      if (await planlaPenceresi(ctx, is)) ctx.yenile();
      return;
    }
    if (e.target.closest('[data-tahsilat]')) {
      const { finansPenceresi } = await import('../bilesen.js');
      if (await finansPenceresi('tahsilat')) ctx.yenile();
      return;
    }
    const f = e.target.closest('[data-fiyat]');
    if (f) {
      if (f.dataset.fis) return ctx.git(`fis/${f.dataset.fis}`);
      const { fiyatlandir } = await import('./fiyatlandirma.js');
      return fiyatlandir(ctx, Number(f.dataset.fiyat)).catch((err) => bildir(err.message, 'hata'));
    }
    const g = e.target.closest('[data-git]');
    if (g) ctx.git(g.dataset.git);
  });
}
