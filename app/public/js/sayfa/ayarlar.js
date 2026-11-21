import { api } from '../api.js';
import { html, $, $$, zaman, pencere, bildir, para } from '../ui.js';

export default async function (el, [secili], ctx) {
  ctx.baslik('Ayarlar');
  let sekme = secili || 'firma';
  el.innerHTML = String(html`<div class="sekmeler">${[['firma', 'Firma bilgileri'], ['kullanicilar', 'Kullanıcılar'], ['ekipler', 'Ekipler'], ['hesaplar', 'Kasa / banka hesapları'], ['denetim', 'İşlem kayıtları']]
    .map(([k, a]) => html`<button data-s="${k}">${a}</button>`)}</div><div id="s"></div>`);

  async function ciz() {
    $$('[data-s]', el).forEach((b) => b.classList.toggle('aktif', b.dataset.s === sekme));
    const k = $('#s', el);
    if (sekme === 'firma') {
      const a = await api.get('/ayarlar');
      k.innerHTML = String(html`<form class="kart" id="firma"><div class="kart-govde">
        <p class="soluk" style="margin-top:0">Bu bilgiler teslim formu, satış fişi ve ekstre çıktılarının üstünde görünür.</p>
        <div class="satir2"><label class="alan"><span>Firma adı</span><input name="firma_adi" value="${a.firma_adi || ''}"></label>
          <label class="alan"><span>Telefon</span><input name="firma_telefon" value="${a.firma_telefon || ''}"></label>
          <label class="alan"><span>E-posta</span><input name="firma_eposta" value="${a.firma_eposta || ''}"></label>
          <label class="alan"><span>Vergi dairesi / no</span><input name="firma_vergi" value="${a.firma_vergi || ''}"></label></div>
        <label class="alan"><span>Adres</span><textarea name="firma_adres" rows="2">${a.firma_adres || ''}</textarea></label>
        <label class="alan"><span>Teslim formu metni (müşteri imzası üstünde)</span><textarea name="teslim_metni" rows="2">${a.teslim_metni || ''}</textarea></label>
        <label class="alan"><span>Satış fişi alt notu (banka IBAN vb.)</span><textarea name="fis_notu" rows="2">${a.fis_notu || ''}</textarea></label>
        <button class="btn birincil">Kaydet</button></div></form>`);
      $('#firma', k).onsubmit = async (e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.target));
        try { await api.put('/ayarlar', v); Object.assign(ctx.ayarlar, v); bildir('Kaydedildi.', 'basari'); } catch (err) { bildir(err.message, 'hata'); }
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
