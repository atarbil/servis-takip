// Sayfalar arası ortak parçalar
import { api } from './api.js';
import { html, $, pencere, secici, bildir, para, miktar, sayiCoz, sayiGiris, yerelDT, bugunStr, bakiyeHucre, esc, debounce } from './ui.js';

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
export const urunAltBilgi = (u) => [u.marka, u.model, [u.ana_grup, u.alt_grup].filter(Boolean).join(' › '), u.kod].filter(Boolean).join(' · ');

export function urunSecici(input, sec, { yonetici = true, yeniIzin = false } = {}) {
  return secici(input, {
    getir: (q) => api.get('/urunler', { q, limit: 30 }),
    goster: (u) => html`<div class="urun-oneri"><div class="ad"><b>${u.ad}</b>${u.onay_bekliyor ? html` <span class="rozet turuncu">onay bekliyor</span>` : ''}
        <small>${urunAltBilgi(u)}</small></div>
      ${yonetici && u.stok_miktari !== undefined ? html`<div class="deger"><span class="${u.stok_miktari > 0 ? 'stokta' : 'stok-yok'}">${miktar(u.stok_miktari)} ${u.birim}</span>
        ${u.onerilen_satis != null ? html`<small>${para(u.onerilen_satis)}</small>` : ''}</div>` : ''}</div>`,
    sec,
    bosMetin: 'Ürün bulunamadı',
    ekstra: yeniIzin ? (q) => html`<span class="secici-ekstra" data-yeni-urun="${q}">+ "${q || 'Yeni ürün'}" oluştur</span>` : null,
  });
}

// ---------- Stok listesi: filtreli, çoklu seçimli ürün ekleme penceresi ----------
// Seçilen ürünleri [{urun, miktar}] olarak döndürür. fiyat: 'satis' (fiş/teklif) veya 'maliyet' (alış)
export async function stokListesi({ fiyat = 'satis', baslik = 'Stok listesi' } = {}) {
  const gruplar = await api.get('/urun-gruplari');
  const f = { q: '', marka: '', ana_grup: '', alt_grup: '', stokta: '' };
  const secilen = new Map(); // urun_id -> {urun, miktar}
  let liste = [];
  return pencere({
    baslik, genis: true, kaydetMetin: 'Seçilenleri ekle',
    icerik: html`<div class="stok-filtre">
        <input type="search" id="sl-q" placeholder="Ara: ad, model, marka, kod…" autofocus>
        <select id="sl-marka"><option value="">Tüm markalar</option>${gruplar.markalar.map((m) => html`<option>${m}</option>`)}</select>
        <select id="sl-ana"><option value="">Tüm ana gruplar</option>${gruplar.gruplar.map((g) => html`<option>${g.ana}</option>`)}</select>
        <select id="sl-alt" disabled><option value="">Tüm alt gruplar</option></select>
        <label class="kutu-sec" style="margin:0;white-space:nowrap"><input type="checkbox" id="sl-stokta"> Sadece stokta olanlar</label>
      </div>
      <div class="stok-liste" id="sl-liste"></div>`,
    altBilgi: html`<span class="soluk" id="sl-secim">Seçili ürün yok</span>`,
    acildi: (d) => {
      const ciz = async () => {
        liste = await api.get('/urunler', { ...f, limit: 500 });
        $('#sl-liste', d).innerHTML = String(liste.length ? html`<table class="tablo"><thead><tr><th style="width:36px"></th><th>Ürün</th><th>Grup</th>
            <th class="sayi">Stok</th><th class="sayi">${fiyat === 'satis' ? 'Satış fiyatı' : 'Ort. maliyet'}</th><th class="sayi" style="width:110px">Miktar</th></tr></thead><tbody>
          ${liste.map((u) => { const s = secilen.get(u.id); return html`<tr class="${s ? 'secili' : ''}" data-u="${u.id}">
            <td><input type="checkbox" data-sec="${u.id}" ${s ? 'checked' : ''}></td>
            <td><b>${u.ad}</b><div class="alt-satir">${[u.marka, u.model, u.kod].filter(Boolean).join(' · ')}</div></td>
            <td class="alt-satir">${[u.ana_grup, u.alt_grup].filter(Boolean).join(' › ')}</td>
            <td class="sayi ${u.stok_miktari > 0 ? '' : 'negatif'}">${miktar(u.stok_miktari)} ${u.birim}</td>
            <td class="sayi">${fiyat === 'satis' ? (u.onerilen_satis != null ? para(u.onerilen_satis) : '—') : para(u.ort_maliyet)}</td>
            <td class="sayi"><input class="sayi" data-mik="${u.id}" inputmode="decimal" value="${s ? sayiGiris(s.miktar) : ''}" placeholder="1" style="width:90px;min-height:34px;padding:.3rem .5rem"></td></tr>`; })}</tbody></table>`
          : html`<div class="bos-durum">Bu filtrelere uygun ürün yok.</div>`);
      };
      const ozet = () => { $('#sl-secim', d).textContent = secilen.size ? `${secilen.size} ürün seçildi` : 'Seçili ürün yok'; };
      const altDoldur = () => {
        const g = gruplar.gruplar.find((x) => x.ana === f.ana_grup);
        const sel = $('#sl-alt', d);
        sel.innerHTML = String(html`<option value="">Tüm alt gruplar</option>${(g?.altlar || []).map((a) => html`<option>${a}</option>`)}`);
        sel.disabled = !g || !g.altlar.length;
      };
      $('#sl-q', d).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
      $('#sl-q', d).addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
      $('#sl-marka', d).onchange = (e) => { f.marka = e.target.value; ciz(); };
      $('#sl-ana', d).onchange = (e) => { f.ana_grup = e.target.value; f.alt_grup = ''; altDoldur(); ciz(); };
      $('#sl-alt', d).onchange = (e) => { f.alt_grup = e.target.value; ciz(); };
      $('#sl-stokta', d).onchange = (e) => { f.stokta = e.target.checked ? '1' : ''; ciz(); };
      const isaretle = (id, acik, miktarDeger) => {
        const u = liste.find((x) => x.id === id);
        if (acik) secilen.set(id, { urun: u, miktar: miktarDeger || secilen.get(id)?.miktar || 1 }); else secilen.delete(id);
        const tr = d.querySelector(`tr[data-u="${id}"]`);
        if (tr) { tr.classList.toggle('secili', acik); tr.querySelector('[data-sec]').checked = acik; const m = tr.querySelector('[data-mik]'); if (acik && !m.value) m.value = '1'; if (!acik) m.value = ''; }
        ozet();
      };
      d.addEventListener('change', (e) => { const c = e.target.dataset.sec; if (c) isaretle(Number(c), e.target.checked); });
      d.addEventListener('input', (e) => {
        const m = e.target.dataset.mik; if (!m) return;
        const v = sayiCoz(e.target.value);
        if (v && v > 0) isaretle(Number(m), true, v); else if (!e.target.value) isaretle(Number(m), false);
      });
      // Satırın boş yerine tıklayınca seç/bırak
      d.addEventListener('click', (e) => {
        const tr = e.target.closest('tr[data-u]');
        if (!tr || e.target.closest('input')) return;
        const id = Number(tr.dataset.u); isaretle(id, !secilen.has(id));
      });
      ciz();
    },
    kaydet: () => { if (!secilen.size) throw new Error('Listeden en az bir ürün seçin.'); return [...secilen.values()]; },
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
  const gruplar = await api.get('/urun-gruplari').catch(() => ({ markalar: [], gruplar: [] }));
  const altlar = [...new Set(gruplar.gruplar.flatMap((g) => g.altlar))];
  return pencere({
    baslik: urun ? 'Ürünü düzenle' : 'Yeni ürün',
    genis: true,
    icerik: html`
      <div class="satir2">
        <label class="alan"><span>Ürün adı *</span><input name="ad" value="${u.ad || ''}" required></label>
        <label class="alan"><span>Ürün kodu</span><input name="kod" value="${u.kod || ''}"></label>
        <label class="alan"><span>Marka</span><input name="marka" value="${u.marka || ''}" list="marka-liste" placeholder="Örn: Hikvision">
          <datalist id="marka-liste">${gruplar.markalar.map((k) => html`<option value="${k}">`)}</datalist></label>
        <label class="alan"><span>Model</span><input name="model" value="${u.model || ''}" placeholder="Örn: DS-2CD1043G0-I"></label>
        <label class="alan"><span>Ana grup</span><input name="ana_grup" value="${u.ana_grup || ''}" list="ana-liste" placeholder="Örn: Güvenlik Kamerası">
          <datalist id="ana-liste">${gruplar.gruplar.map((g) => html`<option value="${g.ana}">`)}</datalist></label>
        <label class="alan"><span>Alt grup</span><input name="alt_grup" value="${u.alt_grup || ''}" list="alt-liste" placeholder="Örn: IP Kamera">
          <datalist id="alt-liste">${altlar.map((k) => html`<option value="${k}">`)}</datalist></label>
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

// ---------- Tahsilat makbuzu ----------
export function makbuzTercih(deger) {
  try {
    if (deger === undefined) return localStorage.getItem('makbuzYazdir') !== '0';
    localStorage.setItem('makbuzYazdir', deger ? '1' : '0');
  } catch { /* */ }
  return true;
}
// Makbuzu yazdırma seçenekleriyle açar
export async function makbuzAc(finansId) {
  const ctx = window.__ctx;
  const m = await api.get(`/finans/${finansId}/makbuz`);
  const s = await pencere({
    baslik: 'Tahsilat makbuzu',
    icerik: html`<p style="margin-top:0"><b>${m.unvan}</b> · ${para(m.tutar)}</p>
      <label class="kutu-sec"><input type="checkbox" name="kase" ${ctx.ayarlar.kase_imza ? 'checked' : 'disabled'}> Kaşe ve imza ekle
        ${!ctx.ayarlar.kase_imza ? html`<small>(Ayarlar'dan yüklenmemiş)</small>` : ''}</label>
      <label class="kutu-sec"><input type="checkbox" name="iki"> 2 nüsha (asıl + suret, aynı sayfada)</label>`,
    kaydetMetin: '🖨 Yazdır',
  });
  if (!s) return;
  const { makbuzYazdir } = await import('./belgeler.js');
  makbuzYazdir(ctx, m, { kaseImza: !!s.kase, ikiNusha: !!s.iki });
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
      ${cari && cari.bakiye !== undefined ? html`<p class="soluk">Güncel bakiye: ${bakiyeHucre(cari.bakiye)}</p>` : ''}
      ${tur === 'tahsilat' ? html`<label class="kutu-sec"><input type="checkbox" name="makbuz" ${makbuzTercih() ? 'checked' : ''}> Kaydettikten sonra tahsilat makbuzu yazdır</label>` : ''}`,
    acildi: (d) => {
      const inp = $('#f-cari', d);
      if (inp) cariSecici(inp, (c) => { secilen = c; inp.value = c.unvan; }, { yeniIzin: false });
    },
    kaydet: async (v) => {
      const t = sayiCoz(v.tutar);
      if (!t || t <= 0) throw new Error('Geçerli bir tutar girin.');
      if ((tur === 'tahsilat' || tur === 'odeme') && !secilen) throw new Error('Cari seçin.');
      const r = await api.post(`/finans/${tur}`, { ...v, tutar: t, cari_id: secilen?.id });
      bildir(`${AD.split(' ')[0]} kaydedildi: ${para(t)}`, 'basari');
      if (tur === 'tahsilat') {
        makbuzTercih(v.makbuz);
        if (v.makbuz && r?.id) setTimeout(() => makbuzAc(r.id), 300);
      }
    },
  });
}

// ---------- Belge başlığı (yazdırma) ----------
// Firma bloğu: logo, ünvan, adres, iletişim ve vergi bilgileri (proforma örneğindeki düzen)
export function firmaBlok(ctx) {
  const a = ctx.ayarlar;
  const vd = a.firma_vergi_dairesi || ''; const vn = a.firma_vergi_no || '';
  return html`<div class="belge-firma">
    ${a.firma_logo ? html`<img class="belge-logo" src="/logo?v=${encodeURIComponent(a.firma_logo)}" alt="">` : ''}
    <div class="belge-unvan">${a.firma_adi || ''}</div>
    ${a.firma_adres ? html`<div>Adres: ${a.firma_adres}</div>` : ''}
    <div>${[a.firma_eposta && `E-Posta : ${a.firma_eposta}`, a.firma_telefon && `Tel: ${a.firma_telefon}`, a.firma_gsm && `Gsm: ${a.firma_gsm}`, a.firma_web && `Web: ${a.firma_web}`]
      .filter(Boolean).map((x, i) => html`${i ? html`<span class="ara"></span>` : ''}${x}`)}</div>
    ${vd || vn ? html`<div><span style="display:inline-block;min-width:46%">Vergi Dairesi : ${vd}</span>Vergi No : ${vn}</div>`
      : a.firma_vergi ? html`<div>${a.firma_vergi}</div>` : ''}
  </div>`;
}

export function belgeUst(ctx, baslik, sag = '') {
  return html`<div class="belge-ust">${firmaBlok(ctx)}<div class="sag"><h1>${baslik}</h1>${sag}</div></div>`;
}

export const tabloBos = (metin, kolon = 1) => html`<tr><td colspan="${kolon}" class="bos-durum">${metin}</td></tr>`;
export { esc };
