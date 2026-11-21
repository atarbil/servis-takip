// Teklif / proforma düzenleyici
import { api } from '../api.js';
import { html, $, $$, para, paraSade, bildir, onayla, sayiCoz, sayiGiris, bugunStr, zaman, esc } from '../ui.js';
import { cariSecici, urunSecici } from '../bilesen.js';
import { teklifYazdir, proformaYazdir } from '../belgeler.js';
import { TEKLIF_DURUM, teklifRozet, TUR_AD } from './teklifler.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const kdvDahilOku = () => { try { return localStorage.getItem('kdvDahil') === '1'; } catch { return false; } };

export default async function (el, [id], ctx) {
  let t;
  if (id === 'yeni') {
    const tur = ctx.sorgu.tur === 'proforma' ? 'proforma' : 'teklif';
    const c = ctx.sorgu.cari ? await api.get(`/cariler/${ctx.sorgu.cari}`) : null;
    t = { id: null, tur, durum: 'taslak', tarih: bugunStr(), gecerlilik: '', cari_id: c?.id || null, unvan: c?.unvan || '', satirlar: [],
      kase_imza: true, aciklama: '',
      giris_metni: tur === 'teklif' ? ctx.ayarlar.teklif_giris || '' : '', kapanis_metni: tur === 'teklif' ? ctx.ayarlar.teklif_kapanis || '' : '' };
  } else t = await api.get(`/teklifler/${id}`);
  let satirlar = t.satirlar.map((s) => ({ ...s }));
  let cari = t.cari_id ? { id: t.cari_id, unvan: t.unvan } : null;
  let kdvDahil = kdvDahilOku();
  let degisti = id === 'yeni';
  const kilitli = () => t.durum === 'iptal' || !!t.fis_id;
  ctx.baslik(t.id ? t.belge_no : `Yeni ${TUR_AD[t.tur].toLowerCase()}`);

  const hesap = (s) => { const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0) * (1 - Number(s.iskonto_orani || 0) / 100)); return { net, kdv: r2(net * Number(s.kdv_orani || 0) / 100) }; };
  const toplam = () => { let ara = 0; let kdv = 0; for (const s of satirlar) { const h = hesap(s); ara += h.net; kdv += h.kdv; } return { ara: r2(ara), kdv: r2(kdv), genel: r2(ara + kdv) }; };
  const goster = (s) => (kdvDahil ? r2(Number(s.birim_fiyat) * (1 + Number(s.kdv_orani) / 100)) : Number(s.birim_fiyat));

  function ciz() {
    const ac = !kilitli();
    el.innerHTML = String(html`
      <div class="detay-ust"><div style="flex:1;min-width:240px"><a href="#/teklifler" class="btn-metin">← Teklif / Proforma</a>
        <div class="btn-grup"><h2>${t.id ? t.belge_no : `Yeni ${TUR_AD[t.tur].toLowerCase()}`}</h2><span class="rozet mavi">${TUR_AD[t.tur]}</span>${t.id ? teklifRozet(t.durum) : ''}</div>
        ${t.kaynak_belge_no ? html`<div class="soluk">${t.kaynak_belge_no} numaralı belgeden kopyalandı</div>` : ''}
        ${t.fis_id ? html`<div class="soluk">Satış fişine dönüştürüldü: <a href="#/fis/${t.fis_id}">${t.fis_no}</a></div>` : ''}
        ${t.olusturma ? html`<div class="soluk">Oluşturma: ${zaman(t.olusturma)}</div>` : ''}</div>
        <div class="btn-grup">
          ${ac ? html`<button class="btn ikincil" data-a="kaydet">Kaydet</button>` : ''}
          <button class="btn birincil" data-a="yazdir">🖨 Yazdır / PDF</button>
          ${t.id && !t.fis_id && t.durum !== 'iptal' ? html`<button class="btn basari" data-a="fis">🧾 Satış fişine dönüştür</button>` : ''}
          ${t.id ? html`<button class="btn ikincil" data-a="kopyala">${t.tur === 'teklif' ? 'Proformaya kopyala' : 'Teklife kopyala'}</button>` : ''}
        </div></div>
      ${t.durum === 'iptal' ? html`<div class="uyari-kutu">Bu belge iptal edildi.</div>` : ''}
      <div class="kart"><div class="kart-govde">
        <div class="satir3">
          <label class="alan"><span>Cari *</span><input id="t-cari" value="${cari?.unvan || ''}" placeholder="Ara…" ${ac ? '' : 'readonly'}>
            ${cari ? html`<small><a href="#/cari/${cari.id}">Cari kartı →</a></small>` : ''}</label>
          <label class="alan"><span>Tarih</span><input type="date" id="t-tarih" value="${t.tarih}" ${ac ? '' : 'readonly'}></label>
          <label class="alan"><span>${t.tur === 'teklif' ? 'Geçerlilik tarihi' : 'Son ödeme / geçerlilik'}</span><input type="date" id="t-gecerlilik" value="${t.gecerlilik || ''}" ${ac ? '' : 'readonly'}></label>
        </div>
        ${t.tur === 'teklif' ? html`<label class="alan"><span>Giriş metni</span><textarea id="t-giris" rows="2" ${ac ? '' : 'readonly'}>${t.giris_metni || ''}</textarea></label>
          <label class="alan"><span>Kapanış metni</span><textarea id="t-kapanis" rows="2" ${ac ? '' : 'readonly'}>${t.kapanis_metni || ''}</textarea></label>` : ''}
        <div class="satir2">
          <label class="alan" style="margin:0"><span>İç not (çıktıda görünmez)</span><input id="t-aciklama" value="${t.aciklama || ''}"></label>
          <div class="alan" style="margin:0"><span>Seçenekler</span>
            <label class="kutu-sec" style="margin:.4rem 0 0"><input type="checkbox" id="t-kase" ${t.kase_imza ? 'checked' : ''}> Kaşe ve imza ekle
              ${!ctx.ayarlar.kase_imza ? html`<small style="color:var(--turuncu)">(Ayarlar'dan kaşe görseli yüklenmemiş)</small>` : ''}</label></div>
        </div>
        ${t.id ? html`<div class="btn-grup" style="margin-top:.8rem"><span class="soluk">Durum:</span>${Object.entries(TEKLIF_DURUM).filter(([k]) => k !== 'iptal' || t.durum !== 'iptal')
          .map(([k, v]) => html`<button class="btn kucuk ${t.durum === k ? 'birincil' : 'ikincil'}" data-durum="${k}" ${t.fis_id && k !== 'kabul' ? 'disabled' : ''}>${v.ad}</button>`)}</div>` : ''}
      </div></div>

      <div class="kart"><div class="kart-ust"><h3>Kalemler</h3><span class="bosluk"></span>
        ${ac ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="kdv-dahil" ${kdvDahil ? 'checked' : ''}> Fiyatları KDV dahil gir</label>` : ''}</div>
        <div class="tablo-kap fis-tablo-kap"><table class="tablo fis-satirlar"><thead><tr><th>Ürün / açıklama</th><th class="sayi">Miktar</th><th>Birim</th>
          <th class="sayi">Birim fiyat ${kdvDahil && ac ? '(KDV dahil)' : '(KDV hariç)'}</th><th class="sayi">İsk.%</th><th class="sayi">KDV%</th><th class="sayi">Tutar</th>${ac ? html`<th></th>` : ''}</tr></thead>
          <tbody>${satirlar.map((s, i) => (ac ? html`<tr data-i="${i}">
            <td style="min-width:260px">${s.urun_id ? html`<div><b>${s.aciklama}</b> <button type="button" class="btn-metin" style="color:var(--ana);font-size:.82rem" data-urun-degistir="${i}">değiştir</button></div>`
              : html`<input data-k="aciklama" class="urun-ara" value="${s.aciklama || ''}" placeholder="Ürün ara veya serbest açıklama yazın…">`}
              <input data-k="notu" value="${s.notu || ''}" placeholder="Not: model, garanti, teslim süresi…" style="margin-top:.3rem;font-size:.86rem;min-height:32px"></td>
            <td><input class="s-mik sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(s.miktar)}"></td>
            <td><input class="s-birim" data-k="birim" value="${s.birim || 'adet'}"></td>
            <td><input class="s-fiyat sayi" data-k="birim_fiyat" inputmode="decimal" value="${sayiGiris(goster(s))}" placeholder="0,00"></td>
            <td><input class="s-isk sayi" data-k="iskonto_orani" inputmode="decimal" value="${sayiGiris(s.iskonto_orani || 0)}"></td>
            <td><input class="s-kdv sayi" data-k="kdv_orani" inputmode="decimal" value="${sayiGiris(s.kdv_orani)}"></td>
            <td class="sayi s-tutar" style="vertical-align:middle">${paraSade(hesap(s).net)}</td>
            <td><button class="btn-ikon" data-sil="${i}" title="Sil">✕</button></td></tr>`
            : html`<tr><td><b>${s.aciklama}</b>${s.notu ? html`<div class="alt-satir">${s.notu}</div>` : ''}</td><td class="sayi">${sayiGiris(s.miktar)}</td><td>${s.birim}</td>
              <td class="sayi">${paraSade(s.birim_fiyat)}</td><td class="sayi">${Number(s.iskonto_orani) || ''}</td><td class="sayi">${Number(s.kdv_orani)}</td><td class="sayi">${paraSade(hesap(s).net)}</td></tr>`))}
          ${!satirlar.length ? html`<tr><td colspan="8" class="bos-durum">Kalem ekleyin</td></tr>` : ''}</tbody></table></div>
        ${ac ? html`<div class="kart-govde btn-grup" style="border-top:1px solid var(--cizgi2)"><button class="btn ikincil kucuk" data-ekle>+ Kalem</button>
          <button class="btn ikincil kucuk" data-barkod>📷 Barkodla ürün</button>
          <span class="soluk" style="font-size:.84rem">Listeden ürün seçebilir veya stokta olmayan bir kalemi serbest yazabilirsiniz.</span></div>` : ''}</div>
      <div class="kart"><div class="kart-govde"><div class="toplam-kutu" id="toplam"></div></div></div>
      ${t.id && t.durum !== 'iptal' && !t.fis_id ? html`<div style="text-align:right"><button class="btn tehlike-cizgi" data-a="iptal">Belgeyi iptal et</button></div>` : ''}`);
    toplamCiz();
    if (!ac) return;
    const ci = $('#t-cari', el);
    cariSecici(ci, (c) => { cari = c; ci.value = c.unvan; degisti = true; }, { yeniIzin: false });
    $$('.urun-ara', el).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      urunSecici(inp, (u) => {
        Object.assign(satirlar[i], { urun_id: u.id, aciklama: u.ad, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20) });
        if (!Number(satirlar[i].birim_fiyat) && u.onerilen_satis) satirlar[i].birim_fiyat = Number(u.onerilen_satis);
        degisti = true; ciz();
        setTimeout(() => $(`tr[data-i="${i}"] [data-k=miktar]`, el)?.select(), 30);
      });
    });
    $('#kdv-dahil', el).onchange = (e) => { kdvDahil = e.target.checked; try { localStorage.setItem('kdvDahil', kdvDahil ? '1' : '0'); } catch { /* */ } ciz(); };
  }
  function toplamCiz() {
    const x = toplam();
    $('#toplam', el).innerHTML = String(html`<div><span>Net (KDV hariç)</span><b>${para(x.ara)}</b></div><div><span>KDV</span><b>${para(x.kdv)}</b></div>
      <div class="genel"><span>Toplam</span><span>${para(x.genel)}</span></div>`);
  }

  // Başlık alanları duruma yazılır (yeniden çizimde kaybolmasın)
  const BASLIK = { 't-tarih': 'tarih', 't-gecerlilik': 'gecerlilik', 't-giris': 'giris_metni', 't-kapanis': 'kapanis_metni', 't-aciklama': 'aciklama' };
  const baslikYaz = (e) => { const k = BASLIK[e.target.id]; if (k) { t[k] = e.target.value; degisti = true; return true; } if (e.target.id === 't-kase') { t.kase_imza = e.target.checked; degisti = true; return true; } return false; };
  el.addEventListener('change', baslikYaz);
  el.addEventListener('input', (e) => {
    if (baslikYaz(e)) return;
    const tr = e.target.closest('tr[data-i]'); const k = e.target.dataset.k;
    if (!tr || !k) return;
    const s = satirlar[Number(tr.dataset.i)];
    degisti = true;
    if (k === 'aciklama' || k === 'notu' || k === 'birim') { s[k] = e.target.value; return; }
    const v = sayiCoz(e.target.value) ?? 0;
    if (k === 'birim_fiyat') s.birim_fiyat = kdvDahil ? r2(v / (1 + Number(s.kdv_orani) / 100)) : v;
    else if (k === 'kdv_orani') { const d = goster(s); s.kdv_orani = v; if (kdvDahil) s.birim_fiyat = r2(d / (1 + v / 100)); }
    else s[k] = v;
    $('.s-tutar', tr).textContent = paraSade(hesap(s).net);
    toplamCiz();
  });

  async function kaydet() {
    if (!cari) throw new Error('Cari seçin.');
    if (!satirlar.length) throw new Error('En az bir kalem ekleyin.');
    for (const s of satirlar) if (!String(s.aciklama || '').trim()) throw new Error('Açıklaması boş kalem var.');
    const govde = { tur: t.tur, cari_id: cari.id, tarih: t.tarih, gecerlilik: t.gecerlilik || null, giris_metni: t.giris_metni, kapanis_metni: t.kapanis_metni,
      aciklama: t.aciklama, kase_imza: t.kase_imza,
      satirlar: satirlar.map((s) => ({ urun_id: s.urun_id || null, aciklama: s.aciklama, notu: s.notu, miktar: s.miktar, birim: s.birim, birim_fiyat: s.birim_fiyat, iskonto_orani: s.iskonto_orani, kdv_orani: s.kdv_orani })) };
    const yeni = !t.id;
    t = yeni ? await api.post('/teklifler', govde) : await api.put(`/teklifler/${t.id}`, govde);
    satirlar = t.satirlar.map((s) => ({ ...s }));
    cari = { id: t.cari_id, unvan: t.unvan };
    degisti = false;
    if (yeni) { history.replaceState(null, '', `#/teklif/${t.id}`); ctx.baslik(t.belge_no); }
  }

  el.addEventListener('click', async (e) => {
    const ud = e.target.closest('[data-urun-degistir]');
    if (ud) { Object.assign(satirlar[Number(ud.dataset.urunDegistir)], { urun_id: null, aciklama: '' }); degisti = true; return ciz(); }
    const sil = e.target.closest('[data-sil]');
    if (sil) { satirlar.splice(Number(sil.dataset.sil), 1); degisti = true; return ciz(); }
    if (e.target.closest('[data-ekle]')) { satirlar.push({ urun_id: null, aciklama: '', miktar: 1, birim: 'adet', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20 }); degisti = true; ciz(); $$('.urun-ara', el).at(-1)?.focus(); return; }
    if (e.target.closest('[data-barkod]')) {
      const { barkodOku } = await import('../barkod.js');
      const b = await barkodOku(); if (!b) return;
      try {
        const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
        const v = satirlar.find((s) => s.urun_id === u.id);
        if (v) v.miktar = Number(v.miktar) + 1; else satirlar.push({ urun_id: u.id, aciklama: u.ad, miktar: 1, birim: u.birim, birim_fiyat: Number(u.onerilen_satis || 0), iskonto_orani: 0, kdv_orani: Number(u.kdv_orani ?? 20) });
        degisti = true; ciz();
      } catch (err) { bildir(err.message, 'hata'); }
      return;
    }
    const d = e.target.closest('[data-durum]');
    if (d && t.id) {
      try { if (degisti && !kilitli()) await kaydet(); t = await api.post(`/teklifler/${t.id}/durum`, { durum: d.dataset.durum }); satirlar = t.satirlar.map((s) => ({ ...s })); ciz(); }
      catch (err) { bildir(err.message, 'hata'); }
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'kaydet') { await kaydet(); bildir('Kaydedildi.', 'basari'); ciz(); }
      else if (a === 'yazdir') {
        if (degisti && !kilitli()) { await kaydet(); ciz(); }
        if (!t.id) return;
        (t.tur === 'teklif' ? teklifYazdir : proformaYazdir)(ctx, t, { kaseImza: t.kase_imza });
        if (t.durum === 'taslak') { t = await api.post(`/teklifler/${t.id}/durum`, { durum: 'gonderildi' }); satirlar = t.satirlar.map((s) => ({ ...s })); setTimeout(ciz, 500); }
      } else if (a === 'fis') {
        if (degisti && !kilitli()) await kaydet();
        if (!await onayla(html`<b>${esc(t.belge_no)}</b> taslak satış fişine dönüştürülecek ve belge "Kabul edildi" olarak işaretlenecek.
          Fiş onaylanınca cariye borç yazılır ve stok düşer.`, { evet: 'Dönüştür' })) return;
        const r = await api.post(`/teklifler/${t.id}/fise-donustur`);
        bildir('Satış fişi oluşturuldu.', 'basari');
        ctx.git(`fis/${r.id}`);
      } else if (a === 'kopyala') {
        if (degisti && !kilitli()) await kaydet();
        const hedef = t.tur === 'teklif' ? 'proforma' : 'teklif';
        const r = await api.post(`/teklifler/${t.id}/kopyala`, { tur: hedef });
        bildir(`${TUR_AD[hedef]} oluşturuldu.`, 'basari');
        ctx.git(`teklif/${r.id}`);
      } else if (a === 'iptal') {
        if (!await onayla('Belge iptal edilsin mi?', { evet: 'İptal et', tehlike: true })) return;
        t = await api.post(`/teklifler/${t.id}/durum`, { durum: 'iptal' }); satirlar = t.satirlar.map((s) => ({ ...s })); ciz();
      }
    } catch (err) { bildir(err.message, 'hata', 6000); }
  });

  ciz();
}
