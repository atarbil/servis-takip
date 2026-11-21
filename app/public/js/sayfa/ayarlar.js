import { api } from '../api.js';
import { silOnay } from '../bilesen.js';

// Görseli tarayıcıda hazırlar: PNG ise saydamlık korunur, en büyük kenar sınırlanır
function gorselHazirla(dosya, enBuyuk) {
  return new Promise((coz, reddet) => {
    const r = new Image();
    r.onload = () => {
      const oran = Math.min(1, enBuyuk / Math.max(r.width, r.height));
      const c = document.createElement('canvas');
      c.width = Math.round(r.width * oran); c.height = Math.round(r.height * oran);
      c.getContext('2d').drawImage(r, 0, 0, c.width, c.height);
      URL.revokeObjectURL(r.src);
      coz(dosya.type === 'image/png' ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.92));
    };
    r.onerror = () => reddet(new Error('Görsel okunamadı.'));
    r.src = URL.createObjectURL(dosya);
  });
}
import { html, $, $$, zaman, pencere, bildir, para, onayla } from '../ui.js';

export default async function (el, [secili], ctx) {
  ctx.baslik('Ayarlar');
  let sekme = secili || 'firma';
  el.innerHTML = String(html`<div class="sekmeler">${[['firma', 'Firma bilgileri'], ['kullanicilar', 'Kullanıcılar'], ['ekipler', 'Ekipler'], ['hesaplar', 'Kasa / banka hesapları'], ['telegram', 'Telegram'], ['denetim', 'İşlem kayıtları']]
    .map(([k, a]) => html`<button data-s="${k}">${a}</button>`)}</div><div id="s"></div>`);

  async function ciz() {
    $$('[data-s]', el).forEach((b) => b.classList.toggle('aktif', b.dataset.s === sekme));
    const k = $('#s', el);
    if (sekme === 'firma') {
      const a = await api.get('/ayarlar');
      const GORSEL = [
        ['logo', 'firma_logo', 'Firma logosu', 'Sol üst köşede, giriş ekranında ve tüm çıktılarda görünür. Beyaz veya saydam arka planlı PNG önerilir.'],
        ['kase', 'kase_imza', 'Kaşe ve imza', 'Teklif, proforma ve makbuzlarda isteğe bağlı eklenir. Saydam arka planlı PNG önerilir.'],
        ['serit', 'teklif_serit', 'Teklif başlık şeridi', 'Teklif formunun en üstünde görünen geniş görsel (logo, marka logoları, iletişim). Yoksa logo ve firma bilgileri kullanılır.'],
      ];
      k.innerHTML = String(html`<div class="izgara iki"><form class="kart" id="firma"><div class="kart-ust"><h3>Firma bilgileri</h3></div><div class="kart-govde">
        <p class="soluk" style="margin-top:0">Teklif, proforma, makbuz, satış fişi, teslim formu ve ekstre çıktılarının üstünde görünür.</p>
        <label class="alan"><span>Firma ünvanı</span><input name="firma_adi" value="${a.firma_adi || ''}"></label>
        <label class="alan"><span>Adres</span><textarea name="firma_adres" rows="2">${a.firma_adres || ''}</textarea></label>
        <div class="satir2">
          <label class="alan"><span>Telefon</span><input name="firma_telefon" value="${a.firma_telefon || ''}"></label>
          <label class="alan"><span>GSM</span><input name="firma_gsm" value="${a.firma_gsm || ''}"></label>
          <label class="alan"><span>E-posta</span><input name="firma_eposta" value="${a.firma_eposta || ''}"></label>
          <label class="alan"><span>Web</span><input name="firma_web" value="${a.firma_web || ''}" placeholder="www.ornek.com"></label>
          <label class="alan"><span>Vergi dairesi</span><input name="firma_vergi_dairesi" value="${a.firma_vergi_dairesi || ''}"></label>
          <label class="alan"><span>Vergi no</span><input name="firma_vergi_no" value="${a.firma_vergi_no || ''}"></label>
        </div>
        <label class="alan"><span>Teklif giriş metni (varsayılan)</span><textarea name="teklif_giris" rows="2">${a.teklif_giris || ''}</textarea></label>
        <label class="alan"><span>Teklif kapanış metni (varsayılan)</span><textarea name="teklif_kapanis" rows="2">${a.teklif_kapanis || ''}</textarea></label>
        <label class="alan"><span>Teslim formu metni (müşteri imzası üstünde)</span><textarea name="teslim_metni" rows="2">${a.teslim_metni || ''}</textarea></label>
        <label class="alan"><span>Satış fişi alt notu (banka IBAN vb.)</span><textarea name="fis_notu" rows="2">${a.fis_notu || ''}</textarea></label>
        <button class="btn birincil">Kaydet</button></div></form>
        <div class="kart"><div class="kart-ust"><h3>Görseller</h3></div><div class="kart-govde">
          ${GORSEL.map(([tur, anahtar, ad, aciklama]) => html`<div class="gorsel-kutu">
            <div class="onizleme">${a[anahtar] ? html`<img src="/dosya/${a[anahtar]}" alt="">` : html`<span class="soluk">Yüklenmedi</span>`}</div>
            <div class="bilgi"><b>${ad}</b><p class="soluk" style="font-size:.84rem;margin:.2rem 0 .5rem">${aciklama}</p>
              <div class="btn-grup"><button type="button" class="btn ikincil kucuk" data-yukle="${tur}">${a[anahtar] ? 'Değiştir' : 'Yükle'}</button>
              ${a[anahtar] ? html`<button type="button" class="btn tehlike-cizgi kucuk" data-gorsel-sil="${tur}">Kaldır</button>` : ''}</div></div></div>`)}
        </div></div></div>`);
      $('#firma', k).onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        try { await api.put('/ayarlar', v); Object.assign(ctx.ayarlar, v); bildir('Kaydedildi.', 'basari'); } catch (err) { bildir(err.message, 'hata'); }
      };
      k.onclick = async (e) => {
        const y = e.target.closest('[data-yukle]');
        if (y) {
          const inp = document.createElement('input');
          inp.type = 'file'; inp.accept = 'image/png,image/jpeg,image/webp';
          inp.onchange = async () => {
            const dosya = inp.files[0];
            if (!dosya) return;
            try {
              // PNG saydamlığı korunur; çok büyük görseller küçültülür
              const veri = await gorselHazirla(dosya, y.dataset.yukle === 'serit' ? 2400 : 1200);
              await api.post('/ayarlar/gorsel', { tur: y.dataset.yukle, veri });
              ctx.ayarlar = await api.get('/ayarlar');
              bildir('Görsel yüklendi.', 'basari');
              if (y.dataset.yukle === 'logo') location.reload(); else ciz();
            } catch (err) { bildir(err.message, 'hata'); }
          };
          inp.click();
          return;
        }
        const sl = e.target.closest('[data-gorsel-sil]');
        if (sl && await onayla('Görsel kaldırılsın mı?', { evet: 'Kaldır', tehlike: true })) {
          await api.post('/ayarlar/gorsel-sil', { tur: sl.dataset.gorselSil });
          ctx.ayarlar = await api.get('/ayarlar');
          if (sl.dataset.gorselSil === 'logo') location.reload(); else ciz();
        }
      };
    } else if (sekme === 'kullanicilar') {
      const [liste, ekipler] = await Promise.all([api.get('/kullanicilar'), ctx.ekipler(true)]);
      k.innerHTML = String(html`<div class="sayfa-ust"><span class="soluk">Teknisyenler sadece kendi ekiplerinin işlerini görür; fiyat, maliyet ve cari bilgisi göremez.</span><span class="bosluk"></span>
        <button class="btn birincil" id="k-yeni">+ Kullanıcı ekle</button></div>
        <div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr><th>Ad soyad</th><th>Kullanıcı adı</th><th>Rol</th><th>Ekip</th><th>Son giriş</th><th></th></tr></thead><tbody>
        ${liste.map((u) => html`<tr class="${u.aktif ? '' : 'iptal'}"><td class="ana-hucre" data-et="">${u.ad_soyad}</td><td data-et="Kullanıcı adı">${u.kullanici_adi}</td>
          <td data-et="Rol">${u.rol === 'yonetici' ? html`<span class="rozet mavi">Yönetici</span>` : html`<span class="rozet">Teknisyen</span>`}</td>
          <td data-et="Ekip">${u.ekip_ad || '-'}</td><td data-et="Son giriş">${u.son_giris ? zaman(u.son_giris) : '-'}</td>
          <td data-et=""><button class="btn ikincil kucuk" data-k="${u.id}">Düzenle</button></td></tr>`)}</tbody></table></div></div>`);
      const form = (u) => pencere({
        baslik: u ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı',
        icerik: html`<div class="satir2"><label class="alan"><span>Ad soyad *</span><input name="ad_soyad" value="${u?.ad_soyad || ''}" required></label>
          <label class="alan"><span>Kullanıcı adı *</span><input name="kullanici_adi" value="${u?.kullanici_adi || ''}" ${u ? 'readonly' : ''} autocapitalize="none" required></label>
          <label class="alan"><span>Rol</span><select name="rol"><option value="teknisyen">Teknisyen</option><option value="yonetici" ${u?.rol === 'yonetici' ? 'selected' : ''}>Yönetici</option></select></label>
          <label class="alan"><span>Ekip</span><select name="ekip_id"><option value="">—</option>${ekipler.map((e) => html`<option value="${e.id}" ${u?.ekip_id === e.id ? 'selected' : ''}>${e.ad}</option>`)}</select></label>
          <label class="alan"><span>Telefon</span><input name="telefon" value="${u?.telefon || ''}"></label>
          <label class="alan"><span>${u ? 'Yeni şifre (değiştirmek için)' : 'Şifre *'}</span><input name="sifre" type="password" autocomplete="new-password" placeholder="en az 8 karakter"></label></div>
          ${u ? html`<label class="kutu-sec"><input type="checkbox" name="aktif" ${u.aktif ? 'checked' : ''}> Aktif (pasif kullanıcı giriş yapamaz)</label>` : ''}`,
        altBilgi: u && u.id !== ctx.kullanici.id ? html`<button type="button" class="btn tehlike-cizgi" data-k-sil>🗑 Sil</button>` : '',
        acildi: (d, kapat) => { const sb = $('[data-k-sil]', d); if (sb) sb.onclick = async () => { if (await silOnay('kullanici', u.id)) kapat({ silindi: true }); }; },
        kaydet: async (v) => {
          const g = { ...v, ekip_id: v.ekip_id ? Number(v.ekip_id) : null };
          if (u) { if (!g.sifre) delete g.sifre; await api.put(`/kullanicilar/${u.id}`, g); } else await api.post('/kullanicilar', g);
        },
      }).then((r) => { if (r) { bildir('Kaydedildi.', 'basari'); ciz(); } });
      $('#k-yeni', k).onclick = () => form(null);
      k.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) form(liste.find((x) => x.id === Number(b.dataset.k))); };
    } else if (sekme === 'ekipler') {
      const ekipler = await ctx.ekipler(true);
      k.innerHTML = String(html`<div class="sayfa-ust"><span class="soluk">Ekip rengi takvimde görünür.</span><span class="bosluk"></span><button class="btn birincil" id="e-yeni">+ Ekip ekle</button></div>
        <div class="kart"><div class="tablo-kap"><table class="tablo"><thead><tr><th>Ekip</th><th>Üyeler</th><th>Durum</th><th></th></tr></thead><tbody>
        ${ekipler.map((e) => html`<tr><td><span class="nokta" style="background:${e.renk}"></span><b>${e.ad}</b></td><td>${e.uyeler || '-'}</td>
          <td>${e.aktif ? 'Aktif' : html`<span class="rozet kirmizi">Pasif</span>`}</td><td><button class="btn ikincil kucuk" data-e="${e.id}">Düzenle</button></td></tr>`)}</tbody></table></div></div>`);
      const form = (e) => pencere({
        baslik: e ? 'Ekibi düzenle' : 'Yeni ekip',
        icerik: html`<label class="alan"><span>Ekip adı</span><input name="ad" value="${e?.ad || ''}" required></label>
          <label class="alan"><span>Renk</span><input type="color" name="renk" value="${e?.renk || '#7c3aed'}"></label>
          ${e ? html`<label class="kutu-sec"><input type="checkbox" name="aktif" ${e.aktif ? 'checked' : ''}> Aktif</label>` : ''}`,
        kaydet: async (v) => { if (!v.ad) throw new Error('Ad gerekli.'); if (e) await api.put(`/ekipler/${e.id}`, v); else await api.post('/ekipler', v); },
      }).then((r) => { if (r) ciz(); });
      $('#e-yeni', k).onclick = () => form(null);
      k.onclick = (ev) => { const b = ev.target.closest('[data-e]'); if (b) form(ekipler.find((x) => x.id === Number(b.dataset.e))); };
    } else if (sekme === 'hesaplar') {
      const h = await api.get('/hesaplar');
      k.innerHTML = String(html`<div class="sayfa-ust"><span class="bosluk"></span><button class="btn birincil" id="h-yeni">+ Hesap ekle</button></div>
        <div class="kart"><div class="tablo-kap"><table class="tablo"><thead><tr><th>Hesap</th><th>Tür</th><th class="sayi">Bakiye</th><th></th></tr></thead><tbody>
        ${h.map((x) => html`<tr class="${x.aktif ? '' : 'iptal'}"><td><b>${x.ad}</b></td><td>${{ kasa: 'Kasa', banka: 'Banka', pos: 'POS / kredi kartı' }[x.tip]}</td><td class="sayi">${para(x.bakiye)}</td>
          <td><button class="btn ikincil kucuk" data-h="${x.id}">Düzenle</button></td></tr>`)}</tbody></table></div></div>`);
      const form = (x) => pencere({
        baslik: x ? 'Hesabı düzenle' : 'Yeni hesap',
        icerik: html`<label class="alan"><span>Hesap adı</span><input name="ad" value="${x?.ad || ''}" required placeholder="Örn: Ziraat Bankası"></label>
          <label class="alan"><span>Tür</span><select name="tip">${[['kasa', 'Kasa'], ['banka', 'Banka'], ['pos', 'POS / kredi kartı']].map(([v, a]) => html`<option value="${v}" ${x?.tip === v ? 'selected' : ''}>${a}</option>`)}</select></label>
          ${x ? html`<label class="kutu-sec"><input type="checkbox" name="aktif" ${x.aktif ? 'checked' : ''}> Aktif</label>` : ''}`,
        kaydet: async (v) => { if (!v.ad) throw new Error('Ad gerekli.'); if (x) await api.put(`/hesaplar/${x.id}`, v); else await api.post('/hesaplar', v); },
      }).then((r) => { if (r) ciz(); });
      $('#h-yeni', k).onclick = () => form(null);
      k.onclick = (ev) => { const b = ev.target.closest('[data-h]'); if (b) form(h.find((x) => x.id === Number(b.dataset.h))); };
    } else if (sekme === 'telegram') {
      const t = await api.get('/telegram');
      const bot = t.bot?.kullanici_adi;
      k.innerHTML = String(html`<div class="izgara esit">
        <div class="kart"><div class="kart-ust"><h3>Telegram ile havuza iş ekleme</h3></div><div class="kart-govde">
          ${!t.yapilandirildi ? html`<div class="uyari-kutu"><b>Bot henüz kurulmamış.</b> Sunucuda <code>.env</code> dosyasına
              <code>TELEGRAM_TOKEN</code> eklenmeli. Kurulum adımları README dosyasında.</div>`
            : t.bot?.son_hata ? html`<div class="uyari-kutu">Bot Telegram'a bağlanamıyor: ${t.bot.son_hata}</div>`
              : html`<div class="basari-kutu">Bot çalışıyor: <b>@${bot || '…'}</b></div>`}
          <p>Bota yazdığınız her mesaj <b>havuza iş</b> olarak eklenir. Mesajda telefon numarası varsa müşteri otomatik bulunur,
            <b>acil</b> diye başlayan mesajlar acil öncelikli olur. Rehberden kişi paylaşırsanız ad ve telefonla iş açılır.</p>
          <p class="soluk">Komutlar: <code>/havuz</code> havuzda bekleyenler · <code>/bugun</code> bugünkü işler</p>
          ${t.benim ? html`<div class="bilgi-kutu">Telegram hesabınız bağlı: <b>${t.benim.ad}</b></div>
              <button class="btn tehlike-cizgi" data-tg-kaldir="">Bağlantıyı kaldır</button>`
            : t.yapilandirildi ? html`<button class="btn birincil" id="tg-kod">Telegram hesabımı bağla</button><div id="tg-kod-alan"></div>` : ''}
        </div></div>
        <div class="kart"><div class="kart-ust"><h3>Bağlı hesaplar</h3></div><div class="kart-govde sifir">
          ${t.bagli_hesaplar.length ? html`<table class="tablo"><tbody>${t.bagli_hesaplar.map((b) => html`<tr><td><b>${b.ad_soyad}</b><div class="alt-satir">${b.telegram_ad || ''}</div></td>
            <td>${b.rol === 'yonetici' ? 'Yönetici' : 'Teknisyen'}</td><td class="sayi"><button class="btn ikincil kucuk" data-tg-kaldir="${b.id}">Kaldır</button></td></tr>`)}</tbody></table>`
            : html`<div class="bos-durum">Bağlı hesap yok</div>`}
          <p class="soluk" style="padding:0 1rem;font-size:.85rem">Sadece bağlı <b>yönetici</b> hesaplarından gelen mesajlar işe çevrilir; diğer kişilerin mesajları reddedilir.</p>
        </div></div></div>
        <div class="kart" style="margin-top:1rem"><div class="kart-ust"><h3>Bildirimler</h3><span class="soluk">Bağlı yönetici hesaplarına Telegram'dan gönderilir</span></div>
        <form class="kart-govde" id="tg-bildirim">
          <div class="bildirim-liste">
            ${[['is_tamamlandi', '✅ İş tamamlandı', 'Teknisyen işi bitirip imza aldığında — fiyatlandırma bekliyor'],
              ['urun_onay', '🟠 Sahada tanımsız ürün', 'Teknisyen sistemde olmayan bir ürün eklediğinde'],
              ['sabah', '☀️ Sabah planı', 'Her sabah ekip ekip bugünün işleri, havuz ve bekleyenler'],
              ['aksam', '🌙 Akşam özeti', 'Biten işler, tahsilatlar, kesilen fişler, yarının planı']]
              .map(([k2, ad, acik]) => html`<label class="kutu-sec bildirim-satir"><input type="checkbox" name="${k2}" ${t.bildirimler?.[k2] !== false ? 'checked' : ''}>
                <span><b>${ad}</b><small>${acik}</small></span></label>`)}
          </div>
          <div class="satir3" style="margin-top:.6rem">
            <label class="alan"><span>Sabah planı saati</span><input type="time" name="sabah_saat" value="${t.sabah_saat}"></label>
            <label class="alan"><span>Akşam özeti saati</span><input type="time" name="aksam_saat" value="${t.aksam_saat}"></label>
          </div>
          <p class="soluk" style="font-size:.82rem">İşaretler sizin hesabınız içindir; saatler tüm yöneticiler için ortaktır.</p>
          <div class="btn-grup"><button class="btn birincil">Kaydet</button>
            ${t.benim ? html`<button type="button" class="btn ikincil" data-ozet="sabah">Sabah planını şimdi gönder</button>
              <button type="button" class="btn ikincil" data-ozet="aksam">Akşam özetini şimdi gönder</button>` : ''}</div>
        </form></div>`);
      $('#tg-bildirim', k).onsubmit = async (e) => {
        e.preventDefault();
        const f = e.target;
        const bildirimler = Object.fromEntries(['is_tamamlandi', 'urun_onay', 'sabah', 'aksam'].map((x) => [x, f.elements[x].checked]));
        try { await api.put('/telegram/bildirimler', { bildirimler, sabah_saat: f.elements.sabah_saat.value, aksam_saat: f.elements.aksam_saat.value }); bildir('Bildirim ayarları kaydedildi.', 'basari'); }
        catch (err) { bildir(err.message, 'hata'); }
      };
      const kb = $('#tg-kod', k);
      if (kb) kb.onclick = async () => {
        try {
          const r = await api.post('/telegram/kod');
          $('#tg-kod-alan', k).innerHTML = String(html`<div class="bilgi-kutu" style="margin-top:1rem">
            <b>1.</b> Telegram'da ${r.bot ? html`<a href="https://t.me/${r.bot}" target="_blank" rel="noopener"><b>@${r.bot}</b></a>` : 'botunuzu'} açın.<br>
            <b>2.</b> Şunu gönderin: <code style="font-size:1.15rem;user-select:all">/baglan ${r.kod}</code><br>
            <small>Kod ${r.gecerlilik_dk} dakika geçerlidir ve tek kullanımlıktır. Bağladıktan sonra bu sayfayı yenileyin.</small></div>`);
        } catch (err) { bildir(err.message, 'hata'); }
      };
      k.onclick = async (e) => {
        const oz = e.target.closest('[data-ozet]');
        if (oz) { try { await api.post('/telegram/ozet', { tur: oz.dataset.ozet }); bildir('Telegram\'a gönderildi.', 'basari'); } catch (err) { bildir(err.message, 'hata'); } return; }
        const b = e.target.closest('[data-tg-kaldir]');
        if (!b || !await onayla('Telegram bağlantısı kaldırılsın mı? Bu hesaptan gelen mesajlar artık kabul edilmez.', { evet: 'Kaldır', tehlike: true })) return;
        try { await api.post('/telegram/kaldir', b.dataset.tgKaldir ? { kullanici_id: Number(b.dataset.tgKaldir) } : {}); bildir('Bağlantı kaldırıldı.'); ciz(); } catch (err) { bildir(err.message, 'hata'); }
      };
    } else {
      const d = await api.get('/denetim');
      const TABLO = { isler: 'İş', cariler: 'Cari', cari_hareketler: 'Cari hareket', satis_fisleri: 'Satış fişi', satis_fisi_satirlari: 'Fiş satırı', alis_faturalari: 'Alış faturası',
        alis_faturasi_satirlari: 'Alış satırı', finans_hareketleri: 'Kasa/banka', urunler: 'Ürün', urun_barkodlari: 'Barkod', is_malzemeleri: 'İş malzemesi', teslim_onaylari: 'Teslim onayı',
        kullanicilar: 'Kullanıcı', ekipler: 'Ekip', hesaplar: 'Hesap', takvim_notlari: 'Takvim notu' };
      const ISLEM = { INSERT: 'Ekledi', UPDATE: 'Değiştirdi', DELETE: 'Sildi' };
      const ozet = (x) => {
        if (x.islem !== 'UPDATE' || !x.eski || !x.yeni) return '';
        return Object.keys(x.yeni).filter((a) => JSON.stringify(x.eski[a]) !== JSON.stringify(x.yeni[a]) && !['guncelleme'].includes(a))
          .map((a) => `${a}: ${x.eski[a] ?? '—'} → ${x.yeni[a] ?? '—'}`).join(' · ');
      };
      k.innerHTML = String(html`<p class="soluk">Sistemdeki tüm değişikliklerin kaydı (son 500). Kayıtlar silinemez.</p>
        <div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart"><thead><tr><th>Zaman</th><th>Kullanıcı</th><th>İşlem</th><th>Kayıt</th><th>Değişiklik</th></tr></thead><tbody>
        ${d.map((x) => html`<tr><td data-et="Zaman" class="nowrap">${zaman(x.zaman)}</td><td data-et="Kullanıcı">${x.ad_soyad || 'sistem'}</td><td class="ana-hucre" data-et="">${ISLEM[x.islem]}</td>
          <td data-et="Kayıt">${TABLO[x.tablo] || x.tablo} #${x.kayit_id}</td><td data-et="Değişiklik" style="font-size:.82rem;max-width:520px;word-break:break-word">${ozet(x)}</td></tr>`)}</tbody></table></div></div>`);
    }
  }
  el.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { sekme = b.dataset.s; history.replaceState(null, '', `#/ayarlar/${sekme}`); ciz(); } });
  await ciz();
}
