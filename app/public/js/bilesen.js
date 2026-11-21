// Sayfalar arası ortak parçalar
import { api } from './api.js';
import { html, $, pencere, secici, bildir, para, miktar, sayiCoz, yerelDT, bugunStr, bakiyeHucre, esc } from './ui.js';

// ---------- Cari seçici ----------
// input'a bağlanır, seçilen cari {id, unvan, ...} sec() ile döner. yeniIzin: listede "Yeni cari oluştur" seçeneği
export function cariSecici(input, sec, { tip, yeniIzin = true } = {}) {
  return secici(input, {
    getir: (q) => api.get('/cariler', { q, tip, limit: 30 }),
    goster: (c) => html`<b>${c.unvan}</b><small>${[c.telefon, c.il].filter(Boolean).join(' · ')} ${c.bakiye ? html`· ${bakiyeHucre(c.bakiye)}` : ''}</small>`,
    sec,
    bosMetin: 'Cari bulunamadı',
    ekstra: yeniIzin ? (q) => html`<span class="secici-ekstra" data-yeni-cari="${q}">+ "${q || 'Yeni cari'}" oluştur</span>` : null,
  });
}
// "Yeni cari oluştur" tıklamasını yakalar
export function cariYeniYakala(kok, sonra, { tip } = {}) {
  kok.addEventListener('mousedown', async (e) => {
    const el = e.target.closest('[data-yeni-cari]');
    if (!el) return;
    e.preventDefault();
    const c = await cariFormu(null, { unvan: el.dataset.yeniCari, tip });
    if (c) sonra(c);
  });
}

export async function cariFormu(cari, varsayilan = {}) {
  const c = { tip: 'musteri', ...varsayilan, ...(cari || {}) };
  return pencere({
    baslik: cari ? 'Cariyi düzenle' : 'Yeni cari',
    genis: true,
    icerik: html`
      <div class="satir2">
        <label class="alan"><span>Ünvan / Ad soyad *</span><input name="unvan" value="${c.unvan || ''}" required></label>
        <label class="alan"><span>Tür</span><select name="tip">
          ${[['musteri', 'Müşteri'], ['tedarikci', 'Tedarikçi'], ['her_ikisi', 'Müşteri + Tedarikçi']].map(([v, a]) => html`<option value="${v}" ${c.tip === v ? 'selected' : ''}>${a}</option>`)}
        </select></label>
        <label class="alan"><span>Telefon</span><input name="telefon" type="tel" value="${c.telefon || ''}"></label>
        <label class="alan"><span>2. Telefon</span><input name="telefon2" type="tel" value="${c.telefon2 || ''}"></label>
        <label class="alan"><span>Yetkili kişi</span><input name="yetkili" value="${c.yetkili || ''}"></label>
        <label class="alan"><span>E-posta</span><input name="eposta" type="email" value="${c.eposta || ''}"></label>
      </div>
      <label class="alan"><span>Adres</span><textarea name="adres" rows="2">${c.adres || ''}</textarea></label>
      <div class="satir3">
        <label class="alan"><span>İl</span><input name="il" value="${c.il || ''}"></label>
        <label class="alan"><span>İlçe</span><input name="ilce" value="${c.ilce || ''}"></label>
        <label class="alan"><span>Cari kodu</span><input name="kod" value="${c.kod || ''}"></label>
        <label class="alan"><span>Vergi dairesi</span><input name="vergi_dairesi" value="${c.vergi_dairesi || ''}"></label>
        <label class="alan"><span>Vergi / TC no</span><input name="vergi_no" value="${c.vergi_no || ''}"></label>
      </div>
      <label class="alan"><span>Notlar</span><textarea name="notlar" rows="2">${c.notlar || ''}</textarea></label>
      ${cari ? html`<label class="kutu-sec"><input type="checkbox" name="aktif" ${c.aktif !== false ? 'checked' : ''}> Aktif</label>`
        : html`<div class="satir2"><label class="alan"><span>Açılış bakiyesi (eski programdan)</span><input name="devir_bakiye" inputmode="decimal" placeholder="0,00">
          <small>+ müşteri size borçlu, − siz borçlusunuz</small></label>
          <label class="alan"><span>Açılış tarihi</span><input name="devir_tarih" type="date" value="${bugunStr()}"></label></div>`}`,
    kaydet: async (v) => {
      if (!v.unvan) throw new Error('Ünvan gerekli.');
      if (cari) { await api.put(`/cariler/${cari.id}`, v); return { ...cari, ...v }; }
      if (v.devir_bakiye) v.devir_bakiye = sayiCoz(v.devir_bakiye);
      const r = await api.post('/cariler', v);
      bildir(`${r.unvan} eklendi.`, 'basari');
      return { ...v, ...r };
    },
  });
}

// ---------- Ürün seçici ----------
export function urunSecici(input, sec, { yonetici = true, yeniIzin = false } = {}) {
  return secici(input, {
    getir: (q) => api.get('/urunler', { q, limit: 30 }),
    goster: (u) => html`<b>${u.ad}</b><small>${[u.kod, u.kategori].filter(Boolean).join(' · ')}
      ${yonetici && u.stok_miktari !== undefined ? html` · Stok: ${miktar(u.stok_miktari)} ${u.birim}` : ''}
      ${yonetici && u.ort_maliyet ? html` · Maliyet: ${para(u.ort_maliyet)}` : ''}
      ${u.onay_bekliyor ? html` · <span class="rozet turuncu">onay bekliyor</span>` : ''}</small>`,
    sec,
    bosMetin: 'Ürün bulunamadı',
    ekstra: yeniIzin ? (q) => html`<span class="secici-ekstra" data-yeni-urun="${q}">+ "${q || 'Yeni ürün'}" oluştur</span>` : null,
  });
}
export function urunYeniYakala(kok, sonra) {
  kok.addEventListener('mousedown', async (e) => {
    const el = e.target.closest('[data-yeni-urun]');
    if (!el) return;
    e.preventDefault();
    const u = await urunFormu(null, { ad: el.dataset.yeniUrun });
    if (u) sonra(u);
  });
}

export async function urunFormu(urun, varsayilan = {}) {
  const u = { birim: 'adet', kdv_orani: 20, ...varsayilan, ...(urun || {}) };
  const barkodlar = [...(u.barkodlar || [])];
  const kategoriler = await api.get('/urun-kategorileri').catch(() => []);
  return pencere({
    baslik: urun ? 'Ürünü düzenle' : 'Yeni ürün',
    genis: true,
    icerik: html`
      <div class="satir2">
        <label class="alan"><span>Ürün adı *</span><input name="ad" value="${u.ad || ''}" required></label>
        <label class="alan"><span>Ürün kodu</span><input name="kod" value="${u.kod || ''}"></label>
        <label class="alan"><span>Kategori</span><input name="kategori" value="${u.kategori || ''}" list="kat-liste">
          <datalist id="kat-liste">${kategoriler.map((k) => html`<option value="${k}">`)}</datalist></label>
        <label class="alan"><span>Birim</span><input name="birim" value="${u.birim || 'adet'}" list="birim-liste">
          <datalist id="birim-liste"><option value="adet"><option value="metre"><option value="paket"><option value="kutu"><option value="takım"><option value="saat"></datalist></label>
        <label class="alan"><span>Önerilen satış fiyatı (KDV hariç)</span><input name="onerilen_satis" inputmode="decimal" value="${u.onerilen_satis ?? ''}"></label>
        <label class="alan"><span>KDV %</span><input name="kdv_orani" inputmode="decimal" value="${u.kdv_orani ?? 20}"></label>
        <label class="alan"><span>Kritik stok seviyesi</span><input name="kritik_stok" inputmode="decimal" value="${u.kritik_stok ?? ''}"></label>
        ${!urun ? html`<label class="alan"><span>Açılış stoğu</span><input name="acilis_stok" inputmode="decimal" placeholder="0"></label>
          <label class="alan"><span>Birim maliyet (KDV hariç)</span><input name="ort_maliyet" inputmode="decimal" placeholder="0,00">
          <small>Alış faturası girdikçe otomatik güncellenir</small></label>` : ''}
      </div>
      <div class="alan"><span>Barkodlar</span>
        <div id="barkod-cipler"></div>
        <div class="btn-grup"><input id="barkod-yeni" placeholder="Barkod okutun veya yazın" style="flex:1;min-width:160px">
          <button type="button" class="btn ikincil" id="barkod-ekle">Ekle</button>
          <button type="button" class="btn ikincil" id="barkod-kamera">📷 Kamerayla</button></div>
      </div>
      ${urun ? html`<label class="kutu-sec"><input type="checkbox" name="aktif" ${u.aktif !== false ? 'checked' : ''}> Aktif</label>` : ''}`,
    acildi: (d) => {
      const ciz = () => { $('#barkod-cipler', d).innerHTML = String(html`${barkodlar.map((b, i) => html`<span class="cip">${b}<button type="button" data-sil="${i}">×</button></span>`)}`); };
      ciz();
      const ekle = (b) => { b = String(b || '').trim(); if (b && !barkodlar.includes(b)) barkodlar.push(b); ciz(); $('#barkod-yeni', d).value = ''; };
      $('#barkod-ekle', d).onclick = () => ekle($('#barkod-yeni', d).value);
      $('#barkod-yeni', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ekle(e.target.value); } });
      $('#barkod-cipler', d).onclick = (e) => { const s = e.target.dataset.sil; if (s !== undefined) { barkodlar.splice(Number(s), 1); ciz(); } };
      $('#barkod-kamera', d).onclick = async () => { const { barkodOku } = await import('./barkod.js'); const b = await barkodOku(); if (b) ekle(b); };
    },
    kaydet: async (v) => {
      if (!v.ad) throw new Error('Ürün adı gerekli.');
      for (const k of ['onerilen_satis', 'kdv_orani', 'kritik_stok', 'acilis_stok', 'ort_maliyet']) if (k in v) v[k] = sayiCoz(v[k]);
      v.barkodlar = barkodlar;
      if (urun) { await api.put(`/urunler/${urun.id}`, v); return { ...urun, ...v }; }
      const r = await api.post('/urunler', v);
      bildir(`${r.ad} eklendi.`, 'basari');
      return { ...v, ...r };
    },
  });
}

// ---------- Planlama ----------
export async function planlaPenceresi(ctx, is, { baslangic, ekipId } = {}) {
  const ekipler = (await ctx.ekipler()).filter((e) => e.aktif);
  const bas = baslangic ? new Date(baslangic) : (is.plan_baslangic ? new Date(is.plan_baslangic) : yarinSaat(9));
  const sureDk = is.plan_baslangic && is.plan_bitis ? Math.round((new Date(is.plan_bitis) - new Date(is.plan_baslangic)) / 60000) : 120;
  return pencere({
    baslik: is.plan_baslangic ? 'İşi taşı' : 'Takvime yerleştir',
    icerik: html`<p class="soluk" style="margin-top:0"><b>#${is.id}</b> ${is.baslik}</p>
      <label class="alan"><span>Ekip *</span><select name="ekip_id" required>
        ${ekipler.map((e) => html`<option value="${e.id}" ${(ekipId || is.ekip_id) === e.id ? 'selected' : ''}>${e.ad}${e.uyeler ? ' (' + e.uyeler + ')' : ''}</option>`)}</select></label>
      <div class="satir2">
        <label class="alan"><span>Tarih ve saat *</span><input type="datetime-local" name="baslangic" value="${yerelDT(bas)}" step="900" required></label>
        <label class="alan"><span>Tahmini süre</span><select name="sure">
          ${[30, 60, 90, 120, 180, 240, 360, 480].map((d) => html`<option value="${d}" ${d === sureDk ? 'selected' : ''}>${d < 60 ? d + ' dk' : (d / 60) + ' saat'}</option>`)}</select></label>
      </div>`,
    kaydetMetin: 'Takvime ekle',
    kaydet: async (v) => {
      if (!v.baslangic) throw new Error('Tarih seçin.');
      const b = new Date(v.baslangic);
      await api.post(`/isler/${is.id}/planla`, { ekip_id: Number(v.ekip_id), baslangic: b.toISOString(), bitis: new Date(b.getTime() + Number(v.sure) * 60000).toISOString() });
      bildir('İş takvime yerleştirildi.', 'basari');
    },
  });
}
export function yarinSaat(s) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(s, 0, 0, 0); return d; }

// ---------- Yeni iş (takvimden veya havuzdan) ----------
export async function yeniIsPenceresi(ctx, { baslangic, ekipId, havuza = false, cari } = {}) {
  const ekipler = (await ctx.ekipler()).filter((e) => e.aktif);
  let secilenCari = cari || null;
  const bas = baslangic ? new Date(baslangic) : null;
  return pencere({
    baslik: havuza ? 'Havuza yeni iş' : 'Takvime yeni iş',
    genis: true,
    icerik: html`
      <label class="alan"><span>Ne yapılacak? *</span><input name="baslik" required placeholder="Örn: 4 kamera arızalı, kayıt cihazı kontrol"></label>
      <div class="satir2">
        <label class="alan"><span>Cari (müşteri)</span><input id="is-cari" value="${cari?.unvan || ''}" placeholder="Ara: ad, telefon…"></label>
        <label class="alan"><span>Öncelik</span><select name="oncelik"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select></label>
        <label class="alan"><span>İletişim kişisi</span><input name="iletisim_ad"></label>
        <label class="alan"><span>Telefon</span><input name="iletisim_tel" type="tel" value="${cari?.telefon || ''}"></label>
      </div>
      <label class="alan"><span>Adres</span><textarea name="adres" id="is-adres" rows="2">${cari?.adres || ''}</textarea></label>
      <label class="alan"><span>Açıklama</span><textarea name="aciklama" rows="2"></textarea></label>
      <label class="kutu-sec"><input type="checkbox" name="takvime" id="is-takvime" ${havuza ? '' : 'checked'}> Takvime yerleştir (işaretli değilse havuza düşer)</label>
      <div id="is-plan" ${havuza ? 'hidden' : ''}><div class="satir3">
        <label class="alan"><span>Ekip</span><select name="ekip_id">${ekipler.map((e) => html`<option value="${e.id}" ${ekipId === e.id ? 'selected' : ''}>${e.ad}</option>`)}</select></label>
        <label class="alan"><span>Tarih ve saat</span><input type="datetime-local" name="baslangic" step="900" value="${bas ? yerelDT(bas) : yerelDT(yarinSaat(9))}"></label>
        <label class="alan"><span>Süre</span><select name="sure">${[30, 60, 90, 120, 180, 240, 360, 480].map((d) => html`<option value="${d}" ${d === 120 ? 'selected' : ''}>${d < 60 ? d + ' dk' : (d / 60) + ' saat'}</option>`)}</select></label>
      </div></div>`,
    acildi: (d) => {
      const inp = $('#is-cari', d);
      const sec = (c) => { secilenCari = c; inp.value = c.unvan; if (!d.querySelector('[name=adres]').value && c.adres) d.querySelector('[name=adres]').value = c.adres; if (!d.querySelector('[name=iletisim_tel]').value && c.telefon) d.querySelector('[name=iletisim_tel]').value = c.telefon; };
      cariSecici(inp, sec);
      cariYeniYakala(d, sec);
      inp.addEventListener('input', () => { if (!inp.value) secilenCari = null; });
      $('#is-takvime', d).onchange = (e) => { $('#is-plan', d).hidden = !e.target.checked; };
    },
    kaydetMetin: 'İşi oluştur',
    kaydet: async (v) => {
      if (!v.baslik) throw new Error('İş başlığı gerekli.');
      const govde = { baslik: v.baslik, cari_id: secilenCari?.id || null, oncelik: Number(v.oncelik), iletisim_ad: v.iletisim_ad, iletisim_tel: v.iletisim_tel, adres: v.adres, aciklama: v.aciklama };
      if (v.takvime) {
        const b = new Date(v.baslangic);
        Object.assign(govde, { ekip_id: Number(v.ekip_id), plan_baslangic: b.toISOString(), plan_bitis: new Date(b.getTime() + Number(v.sure) * 60000).toISOString() });
      }
      const r = await api.post('/isler', govde);
      bildir(v.takvime ? 'İş takvime eklendi.' : 'İş havuza eklendi.', 'basari');
      return r;
    },
  });
}

// ---------- Tahsilat / ödeme ----------
export async function finansPenceresi(tur, { cari, tutar } = {}) {
  const hesaplar = (await api.get('/hesaplar')).filter((h) => h.aktif);
  let secilen = cari || null;
  const AD = { tahsilat: 'Tahsilat al', odeme: 'Ödeme yap', masraf: 'Masraf gir', virman: 'Hesaplar arası virman' }[tur];
  return pencere({
    baslik: AD,
    icerik: html`
      ${tur === 'tahsilat' || tur === 'odeme' ? html`<label class="alan"><span>Cari *</span>${cari
        ? html`<input value="${cari.unvan}" readonly>` : html`<input id="f-cari" placeholder="Ara…">`}</label>` : ''}
      ${tur === 'virman' ? html`<div class="satir2">
          <label class="alan"><span>Çıkış hesabı</span><select name="kaynak_id">${hesaplar.map((h) => html`<option value="${h.id}">${h.ad} (${para(h.bakiye)})</option>`)}</select></label>
          <label class="alan"><span>Giriş hesabı</span><select name="hedef_id">${hesaplar.map((h, i) => html`<option value="${h.id}" ${i === 1 ? 'selected' : ''}>${h.ad}</option>`)}</select></label></div>`
        : html`<label class="alan"><span>${tur === 'tahsilat' ? 'Nereye' : 'Nereden'} *</span><select name="hesap_id">${hesaplar.map((h) => html`<option value="${h.id}">${h.ad} (${para(h.bakiye)})</option>`)}</select></label>`}
      <div class="satir2">
        <label class="alan"><span>Tutar (₺) *</span><input name="tutar" inputmode="decimal" value="${tutar ? String(tutar).replace('.', ',') : ''}" required autofocus></label>
        <label class="alan"><span>Tarih</span><input name="tarih" type="date" value="${bugunStr()}"></label>
      </div>
      <label class="alan"><span>Açıklama${tur === 'masraf' ? ' *' : ''}</span><input name="aciklama" placeholder="${tur === 'tahsilat' ? 'Nakit, havale, kredi kartı…' : ''}"></label>
      ${tur === 'tahsilat' || tur === 'odeme' ? html`<label class="alan"><span>Belge / dekont no</span><input name="belge_no"></label>` : ''}
      ${cari && cari.bakiye !== undefined ? html`<p class="soluk">Güncel bakiye: ${bakiyeHucre(cari.bakiye)}</p>` : ''}`,
    acildi: (d) => {
      const inp = $('#f-cari', d);
      if (inp) cariSecici(inp, (c) => { secilen = c; inp.value = c.unvan; }, { yeniIzin: false });
    },
    kaydet: async (v) => {
      const t = sayiCoz(v.tutar);
      if (!t || t <= 0) throw new Error('Geçerli bir tutar girin.');
      if ((tur === 'tahsilat' || tur === 'odeme') && !secilen) throw new Error('Cari seçin.');
      await api.post(`/finans/${tur}`, { ...v, tutar: t, cari_id: secilen?.id });
      bildir(`${AD.split(' ')[0]} kaydedildi: ${para(t)}`, 'basari');
    },
  });
}

// ---------- Belge başlığı (yazdırma) ----------
export function belgeUst(ctx, baslik, sag = '') {
  const a = ctx.ayarlar;
  return html`<div class="belge-ust"><div><h1>${a.firma_adi || ''}</h1>
    <div>${a.firma_adres || ''}</div><div>${[a.firma_telefon, a.firma_eposta].filter(Boolean).join(' · ')}</div>
    ${a.firma_vergi ? html`<div>${a.firma_vergi}</div>` : ''}</div>
    <div class="sag"><h1>${baslik}</h1>${sag}</div></div>`;
}

export const tabloBos = (metin, kolon = 1) => html`<tr><td colspan="${kolon}" class="bos-durum">${metin}</td></tr>`;
export { esc };
