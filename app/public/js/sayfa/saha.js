// Teknisyen saha ekranı + saha işlemleri (yönetici iş detayında da kullanılır)
import { api } from '../api.js';
import { html, $, bildir, pencere, onayla, saat, tarih, zaman, miktar, durumRozet, telLink, haritaLink, sayiCoz, gorselKucult, sayiGiris } from '../ui.js';
import { urunSecici } from '../bilesen.js';
import { teslimFormuYazdir } from '../belgeler.js';

// ---------- Malzeme ekleme akışları ----------
function miktarPenceresi(urun, baslik = 'Miktar') {
  return pencere({
    baslik,
    icerik: html`<p style="margin-top:0"><b>${urun.ad}</b>${urun.kod ? html` <small>${urun.kod}</small>` : ''}</p>
      <div class="miktar-giris"><button type="button" data-d="-1">−</button><input name="miktar" inputmode="decimal" value="1"><button type="button" data-d="1">+</button>
      <span style="min-width:3rem">${urun.birim || 'adet'}</span></div>`,
    kaydetMetin: 'Ekle',
    acildi: (d) => {
      const inp = $('[name=miktar]', d);
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) inp.value = sayiGiris(Math.max(1, (sayiCoz(inp.value) || 0) + Number(b.dataset.d)));
      });
      setTimeout(() => inp.select(), 50);
    },
    kaydet: (v) => { const m = sayiCoz(v.miktar); if (!m || m <= 0) throw new Error('Miktar girin.'); return m; },
  });
}

export async function barkodAkisi(isId) {
  const { barkodOku } = await import('../barkod.js');
  const barkod = await barkodOku();
  if (!barkod) return false;
  try {
    const urun = await api.get(`/urunler/barkod/${encodeURIComponent(barkod)}`);
    const m = await miktarPenceresi(urun, 'Barkod okundu');
    if (!m) return false;
    await api.post(`/isler/${isId}/malzeme`, { barkod, miktar: m });
    bildir(`${urun.ad} × ${miktar(m)} eklendi`, 'basari');
    return true;
  } catch (e) {
    if (e.kod === 'BARKOD_TANIMSIZ') {
      bildir('Bu barkod sistemde yok. Ürünü tanımlayın.', 'uyari');
      return tanimsizAkisi(isId, { barkod });
    }
    bildir(e.message, 'hata');
    return false;
  }
}

export async function listedenAkisi(isId, ctx) {
  let secilen = null;
  const r = await pencere({
    baslik: 'Malzeme seç',
    icerik: html`<label class="alan"><span>Ürün ara</span><input id="u-ara" placeholder="Ürün adı veya kodu…" autofocus></label>
      <div id="u-secili" class="bilgi-kutu" hidden></div>
      <div class="miktar-giris"><button type="button" data-d="-1">−</button><input name="miktar" inputmode="decimal" value="1"><button type="button" data-d="1">+</button></div>
      <p class="soluk" style="font-size:.85rem">Listede yoksa "Tanımsız ürün" ile ekleyin.</p>`,
    kaydetMetin: 'Ekle',
    acildi: (d) => {
      const inp = $('#u-ara', d);
      urunSecici(inp, (u) => { secilen = u; inp.value = u.ad; const k = $('#u-secili', d); k.hidden = false; k.textContent = `Seçildi: ${u.ad}`; }, { yonetici: ctx.yonetici });
      d.addEventListener('click', (e) => {
        const b = e.target.closest('[data-d]');
        if (b) { const m = $('[name=miktar]', d); m.value = sayiGiris(Math.max(1, (sayiCoz(m.value) || 0) + Number(b.dataset.d))); }
      });
    },
    kaydet: async (v) => {
      if (!secilen) throw new Error('Listeden bir ürün seçin.');
      const m = sayiCoz(v.miktar);
      if (!m || m <= 0) throw new Error('Miktar girin.');
      await api.post(`/isler/${isId}/malzeme`, { urun_id: secilen.id, miktar: m });
      bildir(`${secilen.ad} × ${miktar(m)} eklendi`, 'basari');
    },
  });
  return !!r;
}

export async function tanimsizAkisi(isId, { barkod = '' } = {}) {
  const r = await pencere({
    baslik: 'Tanımsız ürün ekle',
    icerik: html`<div class="bilgi-kutu">Sistemde olmayan bir ürün kullandıysanız buradan ekleyin. Yönetici daha sonra maliyetini girecek.</div>
      <label class="alan"><span>Ürün nedir? *</span><input name="ad" required placeholder="Örn: Dahua 2MP dome kamera" autofocus></label>
      <div class="satir2"><label class="alan"><span>Miktar *</span><input name="miktar" inputmode="decimal" value="1"></label>
        <label class="alan"><span>Barkod</span><input name="barkod" value="${barkod}" inputmode="numeric"></label></div>
      <label class="alan"><span>Not (nereden alındı, marka vs.)</span><input name="not"></label>`,
    kaydetMetin: 'Ekle',
    kaydet: async (v) => {
      if (!v.ad) throw new Error('Ürün açıklaması yazın.');
      const m = sayiCoz(v.miktar);
      if (!m || m <= 0) throw new Error('Miktar girin.');
      await api.post(`/isler/${isId}/tanimsiz-urun`, { ...v, miktar: m });
      bildir('Ürün eklendi, yönetici onayına gönderildi.', 'basari');
    },
  });
  return !!r;
}

export function fotoAkisi(isId) {
  return new Promise((coz) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment'; inp.multiple = true;
    inp.onchange = async () => {
      const dosyalar = [...inp.files];
      if (!dosyalar.length) return coz(false);
      bildir(`${dosyalar.length} fotoğraf yükleniyor…`);
      let ok = 0;
      for (const d of dosyalar) {
        try { const veri = await gorselKucult(d); await api.post(`/isler/${isId}/foto`, { veri }); ok++; } catch (e) { bildir(e.message, 'hata'); }
      }
      if (ok) bildir(`${ok} fotoğraf eklendi.`, 'basari');
      coz(ok > 0);
    };
    inp.click();
  });
}

export async function imzaAkisi(ctx, is) {
  const { imzaAl } = await import('../imza.js');
  const s = await imzaAl({ ad: is.cari_yetkili || is.iletisim_ad || '', tel: is.iletisim_tel || is.cari_telefon || '', metin: ctx.ayarlar.teslim_metni });
  if (!s) return false;
  try {
    await api.post(`/isler/${is.id}/teslim`, s);
    bildir('Müşteri onayı alındı.', 'basari');
    return true;
  } catch (e) { bildir(e.message, 'hata'); return false; }
}

export function malzemeListesi(is, { silinebilir, maliyet = false }) {
  if (!is.malzemeler.length) return html`<div class="bos-durum" style="padding:1.2rem">Henüz malzeme eklenmedi.</div>`;
  return html`${is.malzemeler.map((m) => html`<div class="malzeme-satir">
    <div class="ad">${m.ad}${m.onay_bekliyor ? html` <span class="rozet turuncu">onay bekliyor</span>` : ''}
      <small>${m.barkodla_eklendi ? '📷 barkod · ' : ''}${m.sahada_eklendi ? 'sahada eklendi' : 'planlı'} · ${m.ekleyen || ''} · ${saat(m.zaman)}
      ${maliyet ? html` · maliyet ${m.birim_maliyet ? Number(m.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : html`<b style="color:var(--turuncu)">girilmedi</b>`}` : ''}</small></div>
    <div class="mik">${miktar(m.miktar)} ${m.birim}</div>
    ${silinebilir ? html`<button class="btn-ikon" data-malzeme-sil="${m.id}" title="Çıkar">✕</button>` : ''}</div>`)}`;
}

// ---------- Sayfa ----------
export default async function (el, [id], ctx) {
  const is = await api.get(`/isler/${id}`);
  ctx.baslik(`İş #${is.id}`);
  const islemde = ['planlandi', 'sahada'].includes(is.durum);
  const sahada = is.durum === 'sahada';
  const adres = is.adres || is.cari_adres;
  const tel = is.iletisim_tel || is.cari_telefon;

  el.innerHTML = String(html`
    <a href="#/${ctx.yonetici ? 'is/' + is.id : 'islerim'}" class="btn-metin">← ${ctx.yonetici ? 'İş detayına dön' : 'İşlerim'}</a>
    <div class="saha-baslik">
      <div class="btn-grup">${durumRozet(is.durum)}<span class="soluk">#${is.id} · ${is.plan_baslangic ? `${tarih(is.plan_baslangic)} ${saat(is.plan_baslangic)}` : ''}</span></div>
      <h2>${is.baslik}</h2>
      ${is.cari_unvan || is.iletisim_ad ? html`<div><b>${is.cari_unvan || is.iletisim_ad}</b></div>` : ''}
      ${adres ? html`<div class="soluk">📍 ${adres}</div>` : ''}
      ${is.aciklama ? html`<p style="white-space:pre-wrap">${is.aciklama}</p>` : ''}
    </div>
    <div class="saha-aksiyon">
      ${tel ? html`<a class="btn ikincil buyuk" href="tel:${String(tel).replace(/[^\d+]/g, '')}">📞 Ara</a>` : html`<span></span>`}
      ${adres ? html`<a class="btn ikincil buyuk" href="${haritaLink(adres)}" target="_blank" rel="noopener">🧭 Yol tarifi</a>` : html`<span></span>`}
    </div>
    ${is.cihaz ? html`<div class="bilgi-kutu">🔧 İlgili cihaz: <b>${[is.cihaz.tur, is.cihaz.marka, is.cihaz.model].filter(Boolean).join(' ')}</b>
      ${is.cihaz.konum ? html` · ${is.cihaz.konum}` : ''}${is.cihaz.seri_no ? html` · SN ${is.cihaz.seri_no}` : ''}${is.cihaz.ip_adresi ? html` · IP ${is.cihaz.ip_adresi}` : ''}</div>` : ''}
    ${is.durum === 'planlandi' ? html`<button class="btn birincil buyuk tam" id="basla" style="margin-bottom:1rem">▶ İşe başla</button>` : ''}

    ${sahada || is.malzemeler.length ? html`<div class="kart">
      <div class="kart-ust"><div class="adim ${is.malzemeler.length ? 'tamam' : ''}"><span class="adim-no">1</span><h3>Kullanılan malzemeler</h3></div></div>
      <div id="malzemeler">${malzemeListesi(is, { silinebilir: sahada })}</div>
      ${sahada ? html`<div class="kart-govde" style="border-top:1px solid var(--cizgi2)">
        <button class="btn birincil buyuk tam" data-akis="barkod" style="margin-bottom:.5rem">📷 Barkod okut</button>
        <div class="saha-aksiyon" style="margin:0"><button class="btn ikincil" data-akis="liste">Listeden seç</button><button class="btn ikincil" data-akis="tanimsiz">Tanımsız ürün</button></div>
      </div>` : ''}</div>` : ''}

    ${sahada || is.fotograflar.length ? html`<div class="kart">
      <div class="kart-ust"><div class="adim ${is.fotograflar.length ? 'tamam' : ''}"><span class="adim-no">2</span><h3>Fotoğraflar</h3></div><span class="bosluk"></span>
        ${islemde || ctx.yonetici ? html`<button class="btn ikincil kucuk" data-akis="foto">+ Fotoğraf</button>` : ''}</div>
      <div class="kart-govde">${is.fotograflar.length ? html`<div class="foto-izgara">${is.fotograflar.map((f) => html`<a href="/dosya/${f.dosya_yolu}" target="_blank"><img src="/dosya/${f.dosya_yolu}" loading="lazy" alt=""></a>`)}</div>`
        : html`<span class="soluk">İsteğe bağlı: işin önce/sonra fotoğrafları</span>`}</div></div>` : ''}

    ${sahada || is.teslim ? html`<div class="kart">
      <div class="kart-ust"><div class="adim ${is.teslim ? 'tamam' : ''}"><span class="adim-no">3</span><h3>Müşteri teslim onayı</h3></div></div>
      <div class="kart-govde">${is.teslim ? html`<div class="basari-kutu" style="margin-bottom:.6rem">✓ ${is.teslim.teslim_alan_ad} tarafından ${zaman(is.teslim.zaman)} tarihinde onaylandı.</div>
          <img class="imza-gor" src="/dosya/${is.teslim.imza_dosya}" alt="İmza">${is.teslim.musteri_notu ? html`<p>Not: ${is.teslim.musteri_notu}</p>` : ''}`
        : html`<p class="soluk" style="margin-top:0">İş bitince müşteriye telefondan imza attırın. İmza olmadan iş kapatılamaz.</p>
          <button class="btn birincil buyuk tam" data-akis="imza">✍️ Müşteri imzası al</button>`}</div></div>` : ''}

    ${sahada ? html`<div class="kart">
      <div class="kart-ust"><div class="adim"><span class="adim-no">4</span><h3>İşi tamamla</h3></div></div>
      <div class="kart-govde"><label class="alan"><span>Yapılan işlem notu</span><textarea id="tek-not" rows="3" placeholder="Örn: 2 kamera değiştirildi, kayıt cihazı ayarlandı">${is.teknisyen_notu || ''}</textarea></label>
        <button class="btn basari buyuk tam" id="tamamla" ${is.teslim ? '' : 'disabled'}>✓ İşi tamamla</button>
        ${!is.teslim ? html`<small style="display:block;text-align:center;margin-top:.4rem">Önce müşteri imzası alınmalı</small>` : ''}</div></div>` : ''}

    ${is.cari_id ? html`<details class="kart envanter-kart" id="envanter-kart"><summary class="kart-ust"><h3>Müşterideki cihazlar</h3><span class="soluk" id="env-sayi"></span></summary>
      <div class="tablo-kap" id="env-liste"><div class="yukleniyor"><span></span></div></div>
      ${islemde ? html`<div class="kart-govde" style="border-top:1px solid var(--cizgi2)"><button class="btn ikincil tam" data-akis="envanter">+ Kurulan cihazı envantere ekle</button></div>` : ''}
    </details>` : ''}

    ${['tamamlandi', 'fis_kesildi'].includes(is.durum) ? html`<div class="basari-kutu">Bu iş ${zaman(is.bitis_zamani)} tarihinde tamamlandı.</div>
      <button class="btn ikincil tam" id="form-yazdir">🖨 Teslim formunu göster / yazdır</button>` : ''}`);

  const yenile = () => ctx.yenile();
  // Müşterideki cihazlar (açılınca yüklenir)
  const envKart = $('#envanter-kart', el);
  if (envKart) {
    api.get(`/isler/${is.id}/envanter`).then(async (liste) => {
      const { envanterTablosu } = await import('./envanter.js');
      $('#env-sayi', el).textContent = `${liste.length} cihaz`;
      $('#env-liste', el).innerHTML = String(envanterTablosu(liste, { yonetici: false, bosMetin: 'Bu müşteri için kayıtlı cihaz yok.' }));
      if (liste.length && liste.length <= 6) envKart.open = true;
    }).catch(() => { $('#env-liste', el).innerHTML = ''; });
  }
  el.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-akis]');
    if (a) {
      const t = a.dataset.akis;
      const sonuc = t === 'barkod' ? await barkodAkisi(is.id)
        : t === 'liste' ? await listedenAkisi(is.id, ctx)
          : t === 'tanimsiz' ? await tanimsizAkisi(is.id)
            : t === 'foto' ? await fotoAkisi(is.id)
              : t === 'imza' ? await imzaAkisi(ctx, is)
                : t === 'envanter' ? await (await import('./envanter.js')).envanterFormu(null, { isId: is.id, yonetici: false }) : false;
      if (sonuc) yenile();
      return;
    }
    const s = e.target.closest('[data-malzeme-sil]');
    if (s && await onayla('Bu malzeme işten çıkarılsın mı? Stok geri eklenecek.', { evet: 'Çıkar', tehlike: true })) {
      try { await api.del(`/malzeme/${s.dataset.malzemeSil}`); yenile(); } catch (err) { bildir(err.message, 'hata'); }
    }
  });
  const basla = $('#basla', el);
  if (basla) basla.onclick = async () => {
    basla.disabled = true;
    try { await api.post(`/isler/${is.id}/baslat`); bildir('İş başlatıldı. Kolay gelsin!', 'basari'); yenile(); } catch (err) { bildir(err.message, 'hata'); basla.disabled = false; }
  };
  const tamamla = $('#tamamla', el);
  if (tamamla) tamamla.onclick = async () => {
    if (!is.malzemeler.length && !await onayla('Hiç malzeme eklenmedi. Yine de tamamlansın mı?', { evet: 'Tamamla' })) return;
    tamamla.disabled = true;
    try { await api.post(`/isler/${is.id}/tamamla`, { not: $('#tek-not', el).value }); bildir('İş tamamlandı. Teşekkürler!', 'basari'); ctx.git(ctx.yonetici ? `is/${is.id}` : 'islerim'); }
    catch (err) { bildir(err.message, 'hata'); tamamla.disabled = false; }
  };
  const fy = $('#form-yazdir', el);
  if (fy) fy.onclick = () => teslimFormuYazdir(ctx, is);
}
