// Telefon: satış fişi. Kalemler kısa kart ("3 adet × 100,00 = 300,00 ₺"); dokununca tam ekran düzenleme.
// Kayıt / onay / iptal / yazdırma kuralları bilgisayar sayfasıyla aynı API'yi kullanır.
import { api } from '../api.js';
import { html, ham, $, para, paraSade, dovizPara, miktar, tarih, zaman, durumRozet, bildir, onayla, pencere, sayiCoz, sayiGiris, esc, secici, vurgula } from '../ui.js';
import { cariSecici, finansPenceresi, kurAl, kurDegeri, urunFiyati, silOnay, urunBulunamadi } from '../bilesen.js';
import { fisYazdir } from '../belgeler.js';
import { islemListesi, ustDugme } from './ortak.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const yerel = { al: (k, v) => { try { return localStorage.getItem(k) ?? v; } catch { return v; } }, yaz: (k, v) => { try { localStorage.setItem(k, v); } catch { /* */ } } };
const STOKSUZ = { iscilik: 'İşçilik', egitim: 'Eğitim', hizmet: 'Hizmet' };

export default async function (el, [id], ctx) {
  let f = await api.get(`/fisler/${id}`);
  ctx.baslik(f.fis_no);
  let kur = f.durum === 'taslak' ? await kurAl(ctx) : null;
  const kurFmt = (n) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const fiyatAlanlari = (u) => { const x = urunFiyati(u, kur, 'TRY'); delete x.kur_yok; return x; };
  let kdvDahil = yerel.al('kdvDahil', '0') === '1';
  const maliyetGoster = () => !ctx.muhasebe && yerel.al('fisMaliyet', '1') !== '0';
  let satirlar = []; let degisti = false; let cari = null; let dokumAcik = false;

  const yukle = () => {
    satirlar = f.satirlar.map((s) => ({ ...s, _tahmin: Number(s.birim_maliyet) || Number(s.urun_maliyet || 0) }));
    cari = { id: f.cari_id, unvan: f.unvan };
  };
  yukle();

  const hesap = (s) => {
    const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0) * (1 - Number(s.iskonto_orani || 0) / 100));
    const kdv = r2(net * Number(s.kdv_orani || 0) / 100);
    const maliyet = r2(Number(s.miktar || 0) * Number(s.birim_maliyet || s._tahmin || 0));
    return { net, kdv, maliyet };
  };
  const toplamlar = () => {
    let ara = 0; let kdv = 0; let maliyet = 0; let brut = 0; const oranlar = new Map();
    for (const s of satirlar) {
      const h = hesap(s); ara += h.net; kdv += h.kdv; maliyet += h.maliyet;
      brut += r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0));
      const o = Number(s.kdv_orani || 0); const x = oranlar.get(o) || { matrah: 0, kdv: 0 }; x.matrah += h.net; x.kdv += h.kdv; oranlar.set(o, x);
    }
    return { ara: r2(ara), kdv: r2(kdv), genel: r2(ara + kdv), maliyet: r2(maliyet), kar: r2(ara - maliyet), iskonto: r2(brut - ara), oranlar };
  };
  const gosterFiyat = (s) => (kdvDahil ? r2(Number(s.birim_fiyat) * (1 + Number(s.kdv_orani) / 100)) : Number(s.birim_fiyat));
  const stoksuzMu = (s) => !s.urun_id && !!STOKSUZ[s.tip];
  const bosSatir = (tip) => ({ tip, urun_id: null, aciklama: STOKSUZ[tip] || '', miktar: 1, birim: tip === 'hizmet' ? 'adet' : 'saat', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20, _tahmin: 0 });
  const urunSatiri = (u, m = 1) => ({ tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_id: u.id, aciklama: u.ad, miktar: m, birim: u.birim, ...fiyatAlanlari(u),
    iskonto_orani: 0, kdv_orani: Number(u.kdv_orani ?? 20), _tahmin: Number(u.ort_maliyet || 0), onay_bekliyor: u.onay_bekliyor, _kod: u.kod });
  const isaretle = () => { degisti = true; const r = $('[data-kaydedilmedi]', el); if (r) r.hidden = false; };

  // ---------- Çizim ----------
  function kalemKarti(s, i, taslak, mg) {
    const h = hesap(s);
    const fiyatYok = !Number(s.birim_fiyat);
    const kar = r2(h.net - h.maliyet);
    const ic = html`
      <div class="mf-kalem-ust"><b>${stoksuzMu(s) ? html`<span class="rozet satir-tur ${s.tip}">${STOKSUZ[s.tip]}</span> ` : ''}${s.aciklama || 'Ürün seçilmedi'}</b>
        ${taslak ? html`<span class="mf-ok" aria-hidden="true">›</span>` : ''}</div>
      <div class="mf-kalem-alt">
        <span>${miktar(s.miktar)} ${s.birim} × ${fiyatYok ? html`<em>Fiyat girin</em>` : paraSade(gosterFiyat(s))}${Number(s.iskonto_orani) ? html` <small>−%${miktar(s.iskonto_orani)}</small>` : ''}</span>
        <b>${para(h.net)}</b></div>
      ${s.notu ? html`<div class="mf-kalem-not">${s.notu}</div>` : ''}
      ${s.doviz ? html`<div class="mf-kalem-not">${dovizPara(s.doviz_fiyat, s.doviz)}${s.kur ? ` × ${kurFmt(s.kur)}` : ' · kur yok'}</div>` : ''}
      ${s.stoktan_dus === false ? html`<div class="mf-kalem-not">işte kullanıldı (stoktan işte düştü)</div>` : ''}
      ${mg && s.urun_id ? html`<div class="mf-kalem-kar kar-bilgi">maliyet ${paraSade(h.maliyet)} · kâr <span class="${kar >= 0 ? 'pozitif' : 'negatif'}">${paraSade(kar)}</span></div>` : ''}`;
    const sinif = `mf-kalem ${fiyatYok ? 'fiyatsiz' : ''} ${!s.urun_id && !stoksuzMu(s) ? 'eksik' : ''}`;
    return taslak ? html`<button type="button" class="${sinif}" data-kalem="${i}">${ic}</button>` : html`<div class="${sinif}">${ic}</div>`;
  }

  function ciz() {
    const taslak = f.durum === 'taslak';
    const mg = maliyetGoster();
    const t = toplamlar();
    const bakiye = Number(f.cari_bakiye || 0);
    const onaysiz = satirlar.filter((s) => s.onay_bekliyor);
    el.innerHTML = String(html`
      <section class="mk-blok mf-ust">
        <div class="mk-rozetler">${durumRozet(f.durum)}<span class="rozet turuncu" data-kaydedilmedi ${degisti && taslak ? '' : 'hidden'}>kaydedilmedi</span>
          ${kdvDahil && taslak ? html`<span class="rozet mavi">fiyatlar KDV dahil</span>` : ''}</div>
        ${taslak && !f.is_id
          ? html`<button type="button" class="mf-cari" data-cari-sec><span>👤</span><b>${cari.unvan || 'Cari seçin'}</b><span class="mf-ok">›</span></button>`
          : html`<a class="mf-cari" href="#/cari/${f.cari_id}"><span>👤</span><b>${f.unvan}</b><span class="mf-ok">›</span></a>`}
        <div class="mf-bakiye">Cari bakiye: <b class="${bakiye > 0.004 ? 'negatif' : bakiye < -0.004 ? 'pozitif' : ''}">${para(Math.abs(bakiye))} ${bakiye > 0.004 ? '(B)' : bakiye < -0.004 ? '(A)' : ''}</b></div>
        ${!taslak ? html`<dl class="mk-dl mf-bilgi-salt">
            <dt>Tarih</dt><dd>${tarih(f.tarih)}</dd>${f.vade ? html`<dt>Vade</dt><dd>${tarih(f.vade)}</dd>` : ''}
            ${f.onay_zamani ? html`<dt>Onay</dt><dd>${zaman(f.onay_zamani)}</dd>` : ''}
            ${f.is_id ? html`<dt>İş</dt><dd><a href="#/is/${f.is_id}">#${f.is_id} ${f.is_baslik || ''}</a></dd>` : ''}
            ${f.aciklama ? html`<dt>Açıklama</dt><dd>${f.aciklama}</dd>` : ''}</dl>` : ''}
        <details class="mf-bilgi" ${taslak ? '' : 'hidden'}><summary>Fiş bilgileri · ${tarih(f.tarih)}${f.vade ? ` · vade ${tarih(f.vade)}` : ''}</summary>
          <div class="mf-bilgi-govde">
            <label class="alan"><span>Tarih</span><input type="date" data-baslik="tarih" value="${f.tarih}" ${taslak ? '' : 'readonly'}></label>
            <label class="alan"><span>Vade</span><input type="date" data-baslik="vade" value="${f.vade || ''}" ${taslak ? '' : 'readonly'}></label>
            <label class="alan tam"><span>Açıklama</span><input data-baslik="aciklama" value="${f.aciklama || ''}" ${taslak ? '' : 'readonly'} placeholder="—"></label>
            ${f.is_id ? html`<div class="tam">İş: <a href="#/is/${f.is_id}">#${f.is_id} ${f.is_baslik || ''}</a></div>` : ''}
            ${f.onay_zamani ? html`<div class="tam soluk">Onay: ${zaman(f.onay_zamani)}</div>` : ''}
          </div></details>
      </section>
      ${f.durum === 'iptal' ? html`<div class="uyari-kutu">Bu fiş iptal edilmiştir. Cari ve stok etkileri geri alındı.</div>` : ''}
      ${onaysiz.length ? html`<div class="uyari-kutu kar-bilgi">Maliyeti girilmemiş (sahada eklenen) ürün var: ${onaysiz.map((s, i) => html`${i ? ', ' : ''}<a href="#/urun/${s.urun_id}">${s.aciklama}</a>`)}. Onaylamadan önce ürünü onaylayıp maliyetini girin.</div>` : ''}

      ${taslak ? html`<section class="mk-blok mf-ekle">
        <div class="mz-ust"><input type="search" class="mz-ara" data-urun-ara placeholder="Ürün ekle: ad, kod, barkod…" enterkeyhint="search" autocomplete="off">
          <button type="button" class="btn ikincil mz-barkod" data-barkod aria-label="Barkod okut">📷</button></div>
        <div class="mz-cipler mf-cipler">${Object.entries(STOKSUZ).map(([k, ad]) => html`<button type="button" class="mz-cip" data-stoksuz="${k}">+ ${ad}</button>`)}
          <button type="button" class="mz-cip" data-stok-listesi>📦 Stok listesi</button></div>
      </section>` : ''}

      <section class="mk-blok mf-kalemler">
        <h3>Kalemler <small>${satirlar.length || ''}</small></h3>
        ${satirlar.length ? satirlar.map((s, i) => kalemKarti(s, i, taslak, mg)) : html`<div class="mz-bos">${taslak ? 'Henüz kalem yok. Yukarıdan ürün arayın ya da İşçilik / Hizmet ekleyin.' : 'Kalem yok.'}</div>`}
      </section>

      <div class="mf-alt-cubuk">
        <button type="button" class="mf-toplam" data-dokum aria-expanded="${dokumAcik}"><small>Genel toplam ${dokumAcik ? '▾' : '▴'}</small><b>${para(t.genel)}</b></button>
        ${taslak ? html`<button type="button" class="btn ikincil" data-a="kaydet">Kaydet</button><button type="button" class="btn basari" data-a="onayla">✓ Onayla</button>`
          : f.durum === 'onaylandi' ? html`<button type="button" class="btn birincil" data-a="tahsilat">💰 Tahsilat</button>` : ''}
        <div class="mf-dokum" ${dokumAcik ? '' : 'hidden'}>
          ${t.iskonto > 0.004 ? html`<div><span>İskonto</span><span>−${para(t.iskonto)}</span></div>` : ''}
          <div><span>Ara toplam</span><span>${para(t.ara)}</span></div>
          ${[...t.oranlar.entries()].sort((a, b) => b[0] - a[0]).map(([o, x]) => html`<div><span>KDV %${o} <small>(matrah ${paraSade(r2(x.matrah))})</small></span><span>${para(r2(x.kdv))}</span></div>`)}
          ${mg ? html`<div class="kar-bilgi"><span>Maliyet · kâr</span><span>${para(t.maliyet)} · <b class="${t.kar >= 0 ? 'pozitif' : 'negatif'}">${para(t.kar)}</b></span></div>` : ''}
        </div>
      </div>`);
    document.body.classList.add('mf-cubuk-var');
    if (taslak) bagla();
    ctx.ustEylem(ustDugme('⋯', menu, { etiket: 'Diğer işlemler' }));
  }

  // ---------- ⋯ menüsü ----------
  async function menu() {
    const taslak = f.durum === 'taslak';
    const k = await islemListesi(f.fis_no, [
      taslak && { k: 'kdvdahil', ad: `${kdvDahil ? '☑' : '☐'} Fiyatları KDV dahil gir` },
      !ctx.muhasebe && { k: 'maliyet', ad: `${maliyetGoster() ? '☑' : '☐'} Maliyet / kâr göster` },
      taslak && satirlar.some((s) => s.doviz) && { k: 'kurguncelle', ad: '💱 Dövizli kalemleri bugünkü kurla hesapla' },
      { k: 'yazdir', ad: '🖨 Yazdır / PDF' },
      f.durum === 'onaylandi' && { k: 'tahsilat', ad: '💰 Tahsilat al' },
      f.is_id && { k: 'is', ad: `🔧 İş #${f.is_id}` },
      { k: 'cari', ad: '👤 Cari kartı' },
      f.durum === 'onaylandi' && { k: 'iptal', ad: 'Fişi iptal et', tehlike: true },
      { k: 'sil', ad: '🗑 Sil', tehlike: true },
    ]);
    if (!k) return;
    if (k === 'kdvdahil') { kdvDahil = !kdvDahil; yerel.yaz('kdvDahil', kdvDahil ? '1' : '0'); return ciz(); }
    if (k === 'maliyet') { yerel.yaz('fisMaliyet', maliyetGoster() ? '0' : '1'); return ciz(); }
    if (k === 'is') return ctx.git(`is/${f.is_id}`);
    if (k === 'cari') return ctx.git(`cari/${f.cari_id}`);
    islem(k);
  }

  // ---------- Kalem düzenleme (tam ekran) ----------
  async function kalemDuzenle(i, { yeni = false } = {}) {
    const s = satirlar[i];
    const stoksuz = stoksuzMu(s);
    const fiyatEt = `Birim fiyat${kdvDahil ? ' (KDV dahil)' : ' (KDV hariç)'}`;
    const r = await pencere({
      baslik: stoksuz ? STOKSUZ[s.tip] : (s.aciklama || 'Kalem'),
      sinif: 'mf-kalem-pencere',
      icerik: html`
        ${stoksuz ? html`<label class="alan"><span>Açıklama</span><input name="aciklama" value="${s.aciklama || ''}" placeholder="${s.tip === 'egitim' ? 'NVR kullanım eğitimi' : s.tip === 'iscilik' ? 'Kamera montaj işçiliği' : 'Uzaktan destek'}"></label>` : ''}
        <div class="alan"><span>Miktar (${s.birim})</span>
          <div class="miktar-giris"><button type="button" data-d="-1" aria-label="Azalt">−</button><input name="miktar" inputmode="decimal" value="${sayiGiris(s.miktar)}"><button type="button" data-d="1" aria-label="Arttır">+</button></div></div>
        <label class="alan"><span>${fiyatEt}</span><input name="birim_fiyat" class="mf-fiyat" inputmode="decimal" value="${Number(s.birim_fiyat) ? sayiGiris(gosterFiyat(s)) : ''}" placeholder="0,00"></label>
        <div class="mf-canli" data-canli></div>
        <details class="mf-daha"><summary>Daha fazla: iskonto, KDV, birim, not</summary>
          <div class="mf-daha-govde">
            <label class="alan"><span>İskonto %</span><input name="iskonto_orani" inputmode="decimal" value="${Number(s.iskonto_orani) ? sayiGiris(s.iskonto_orani) : ''}" placeholder="0"></label>
            <label class="alan"><span>KDV %</span><input name="kdv_orani" inputmode="decimal" value="${sayiGiris(s.kdv_orani)}"></label>
            <label class="alan"><span>Birim</span><input name="birim" value="${s.birim || 'adet'}"></label>
            <label class="alan tam"><span>Not (seri no, garanti…)</span><input name="notu" value="${s.notu || ''}"></label>
          </div></details>`,
      altBilgi: html`<button type="button" class="btn tehlike-cizgi" data-kalem-sil>Sil</button>`,
      kaydetMetin: 'Tamam',
      iptalMetin: yeni ? 'Vazgeç' : 'Kapat',
      acildi: (d, kapat) => {
        const canli = () => {
          const g = (n) => sayiCoz($(`[name=${n}]`, d).value);
          const kdv = g('kdv_orani') ?? Number(s.kdv_orani);
          let fiyat = g('birim_fiyat') ?? 0; if (kdvDahil) fiyat = fiyat / (1 + kdv / 100);
          const net = r2((g('miktar') ?? 0) * fiyat * (1 - (g('iskonto_orani') ?? 0) / 100));
          $('[data-canli]', d).innerHTML = String(html`<span>Tutar (KDV hariç)</span><b>${para(net)}</b>`);
        };
        canli();
        d.addEventListener('input', canli);
        d.addEventListener('click', (e) => {
          const b = e.target.closest('[data-d]');
          if (b) { const m = $('[name=miktar]', d); m.value = sayiGiris(Math.max(0, r2((sayiCoz(m.value) || 0) + Number(b.dataset.d)))); canli(); }
          if (e.target.closest('[data-kalem-sil]')) kapat('sil');
        });
        // Fiyatı girilmemişse fiyat kutusu, değilse hiçbiri odaklanmaz (klavye kendiliğinden açılmasın)
        if (!Number(s.birim_fiyat) && !stoksuz) setTimeout(() => $('[name=birim_fiyat]', d)?.focus(), 250);
      },
      kaydet: (v) => {
        const m = sayiCoz(v.miktar);
        if (m == null || m <= 0) throw new Error('Miktar girin.');
        if (stoksuz && !String(v.aciklama || '').trim()) throw new Error('Açıklama yazın.');
        return v;
      },
    });
    if (r === 'sil') { satirlar.splice(i, 1); isaretle(); return ciz(); }
    if (!r) { if (yeni) { satirlar.splice(i, 1); ciz(); } return; }
    const kdv = sayiCoz(r.kdv_orani) ?? Number(s.kdv_orani);
    const fiyat = sayiCoz(r.birim_fiyat) ?? 0;
    const yeniFiyat = kdvDahil ? r2(fiyat / (1 + kdv / 100)) : fiyat;
    if (Math.abs(yeniFiyat - Number(s.birim_fiyat)) > 0.004 && s.doviz) { s.doviz = null; s.doviz_fiyat = null; s.kur = null; }
    Object.assign(s, { miktar: sayiCoz(r.miktar), birim_fiyat: yeniFiyat, kdv_orani: kdv, iskonto_orani: sayiCoz(r.iskonto_orani) ?? 0, birim: r.birim || s.birim, notu: r.notu || null });
    if (stoksuz) s.aciklama = r.aciklama.trim();
    isaretle(); ciz();
  }

  // Ürün ekle: aynı ürün varsa miktar artar; fiyatı yoksa kalem penceresi açılır
  function urunEkle(u, m = 1) {
    const v = satirlar.findIndex((x) => x.urun_id === u.id && x.stoktan_dus !== false);
    if (v >= 0) { satirlar[v].miktar = Number(satirlar[v].miktar) + m; isaretle(); ciz(); bildir(`${u.ad} → ${miktar(satirlar[v].miktar)} ${u.birim}`, 'basari', 2000); return; }
    satirlar.push(urunSatiri(u, m)); isaretle(); ciz();
    if (!Number(satirlar.at(-1).birim_fiyat)) kalemDuzenle(satirlar.length - 1);
    else bildir(`${u.ad} eklendi`, 'basari', 2000);
  }

  function bagla() {
    const ara = $('[data-urun-ara]', el);
    if (ara) {
      secici(ara, {
        getir: (q) => api.get('/urunler', { q, limit: 30 }),
        goster: (u, q) => {
          const stok = Number(u.stok_miktari); const hizmet = u.tur === 'hizmet';
          return html`<div class="secici-satir"><div class="ss-ana"><b>${ham(vurgula(u.ad, q))}</b>${hizmet ? html` <span class="rozet mavi">hizmet</span>` : ''}
              ${u.kod || u.marka ? html`<small>${ham([u.marka, u.kod].filter(Boolean).map((x) => vurgula(x, q)).join(' · '))}</small>` : ''}</div>
            <div class="ss-deger">${!hizmet && u.stok_miktari != null ? html`<span class="stok-rozet ${stok <= 0 ? 'yok' : 'var'}">${stok <= 0 ? 'stokta yok' : `${miktar(stok)} ${u.birim}`}</span>` : ''}
              ${u.onerilen_satis != null ? html`<small>${dovizPara(u.onerilen_satis, u.satis_doviz)}</small>` : ''}</div></div>`;
        },
        sec: (u) => { ara.value = ''; ara.blur(); urunEkle(u); },
        bulunamadi: async (metin) => { ara.value = ''; const u = await urunBulunamadi(metin); if (u) urunEkle(u); },
        sonKullanilan: 'urun',
        bosMetin: 'Stokta eşleşen ürün yok',
      });
    }
  }

  // ---------- Olaylar ----------
  el.addEventListener('change', (e) => { const k = e.target.dataset.baslik; if (k) { f[k] = e.target.value; isaretle(); } });
  el.addEventListener('click', async (e) => {
    const t = e.target;
    const kl = t.closest('[data-kalem]');
    if (kl) return kalemDuzenle(Number(kl.dataset.kalem));
    if (t.closest('[data-dokum]')) { dokumAcik = !dokumAcik; $('.mf-dokum', el).hidden = !dokumAcik; $('[data-dokum] small', el).textContent = `Genel toplam ${dokumAcik ? '▾' : '▴'}`; return; }
    const sk = t.closest('[data-stoksuz]');
    if (sk) { satirlar.push(bosSatir(sk.dataset.stoksuz)); return kalemDuzenle(satirlar.length - 1, { yeni: true }); }
    if (t.closest('[data-cari-sec]')) return cariSec();
    if (t.closest('[data-barkod]')) return barkodOkut();
    if (t.closest('[data-stok-listesi]')) {
      const { stokListesi } = await import('../bilesen.js');
      const sec = await stokListesi({ fiyat: 'satis' });
      if (!sec) return;
      for (const { urun: u, miktar: m } of sec) {
        const v = satirlar.find((x) => x.urun_id === u.id && x.stoktan_dus !== false);
        if (v) v.miktar = Number(v.miktar) + m; else satirlar.push(urunSatiri(u, m));
      }
      isaretle(); ciz(); bildir(`${sec.length} ürün eklendi.`, 'basari'); return;
    }
    const a = t.closest('[data-a]')?.dataset.a;
    if (a) islem(a);
  });

  async function cariSec() {
    let secilen = null;
    const r = await pencere({
      baslik: 'Cari seç', kaydetMetin: 'Seç',
      icerik: html`<label class="alan"><span>Cari ara</span><input id="mf-cari-ara" placeholder="Ünvan, telefon…" autocomplete="off"></label>`,
      acildi: (d, kapat) => cariSecici($('#mf-cari-ara', d), (c) => { secilen = c; kapat(c); }, { yeniIzin: true }),
      kaydet: () => { if (!secilen) throw new Error('Listeden bir cari seçin.'); return secilen; },
    });
    if (!r) return;
    cari = { id: r.id, unvan: r.unvan }; f.cari_id = r.id; f.unvan = r.unvan; f.cari_bakiye = r.bakiye;
    isaretle(); ciz();
  }

  async function barkodOkut() {
    const { barkodOku } = await import('../barkod.js');
    const bilinmeyen = new Set();
    await barkodOku({
      baslik: 'Barkod okutun (arka arkaya)',
      surekli: async (b) => {
        try {
          const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
          const v = satirlar.find((x) => x.urun_id === u.id && x.stoktan_dus !== false);
          if (v) v.miktar = Number(v.miktar) + 1; else satirlar.push(urunSatiri(u));
          isaretle();
          return `✓ ${u.ad}${v ? ` × ${miktar(v.miktar)}` : ''}`;
        } catch { bilinmeyen.add(b); throw new Error(`${b}: stokta yok — "Bitti" deyince kart açarsınız`); }
      },
    });
    ciz();
    for (const b of bilinmeyen) { const u = await urunBulunamadi('', { barkod: b }); if (u) urunEkle(u); }
  }

  function govde() {
    return {
      cari_id: cari.id, tarih: f.tarih, vade: f.vade || null, aciklama: f.aciklama,
      satirlar: satirlar.map((s) => ({ id: s.id, tip: s.tip, urun_id: s.urun_id, aciklama: s.aciklama, miktar: s.miktar, birim: s.birim,
        birim_fiyat: s.birim_fiyat, iskonto_orani: s.iskonto_orani, kdv_orani: s.kdv_orani, notu: s.notu, doviz: s.doviz, doviz_fiyat: s.doviz_fiyat, kur: s.kur })),
    };
  }
  async function kaydet() {
    satirlar = satirlar.filter((s) => s.urun_id || stoksuzMu(s));
    f = await api.put(`/fisler/${f.id}`, govde());
    yukle(); degisti = false;
  }

  async function islem(a) {
    try {
      if (a === 'kaydet') { await kaydet(); bildir('Fiş kaydedildi.', 'basari'); ciz(); }
      else if (a === 'onayla') {
        await kaydet(); ciz();
        if (!satirlar.length) throw new Error('Fişte kalem yok.');
        const t = toplamlar();
        const sifir = satirlar.filter((s) => !Number(s.birim_fiyat));
        if (!await onayla(html`${sifir.length ? html`<span style="color:var(--turuncu)"><b>${sifir.length} kalemin fiyatı 0.</b></span><br>` : ''}
          <b>${esc(f.unvan)}</b> carisine <b>${para(t.genel)}</b> borç yazılacak. Onaylanan fiş değiştirilemez (sadece iptal edilebilir).`, { evet: 'Onayla' })) return;
        f = await api.post(`/fisler/${f.id}/onayla`);
        yukle(); bildir('Fiş onaylandı ve cariye işlendi.', 'basari'); ciz();
      } else if (a === 'kurguncelle') {
        ctx.kur = null; kur = await kurAl(ctx);
        if (!kur) throw new Error('Kur bilgisi alınamadı.');
        let n = 0;
        for (const s of satirlar) { const k = s.doviz && kurDegeri(kur, s.doviz); if (k && s.doviz_fiyat != null) { s.kur = k; s.birim_fiyat = r2(Number(s.doviz_fiyat) * k); n++; } }
        isaretle(); ciz(); bildir(`${n} kalem güncel kurla hesaplandı.`, 'basari');
      } else if (a === 'yazdir') { if (degisti && f.durum === 'taslak') await kaydet(); fisYazdir(ctx, f); }
      else if (a === 'tahsilat') {
        const c = await api.get(`/cariler/${f.cari_id}`);
        await finansPenceresi('tahsilat', { cari: c, tutar: Math.min(f.genel_toplam, Math.max(0, c.bakiye)) || f.genel_toplam });
      } else if (a === 'iptal') {
        if (!await onayla('Fiş iptal edilecek: cari borcu ve stok hareketleri geri alınacak. Devam edilsin mi?', { evet: 'İptal et', tehlike: true })) return;
        f = await api.post(`/fisler/${f.id}/iptal`); yukle(); bildir('Fiş iptal edildi.'); ciz();
      } else if (a === 'sil') { degisti = false; if (await silOnay('satis_fisi', f.id)) ctx.kapatVeGit(f.is_id ? `is/${f.is_id}` : 'fisler'); }
    } catch (err) { bildir(err.message, 'hata', 6000); }
  }

  // Sayfadan çıkarken kaydedilmemiş taslak kendiliğinden kaydedilir (telefonda "kaydetmeyi unuttum" olmasın)
  el.kirliMi = () => degisti && f.durum === 'taslak';
  el.ayrilirken = async () => {
    document.body.classList.remove('mf-cubuk-var');
    if (!el.kirliMi()) return;
    try { await kaydet(); bildir('Fiş taslağı kaydedildi.', 'basari', 2500); } catch (e) { bildir(`Fiş kaydedilemedi: ${e.message}`, 'hata', 6000); }
  };

  // "+ Satış fişi" ile yeni açıldıysa ürün kutusu hazır
  let ilk = false;
  try { ilk = sessionStorage.getItem('fis-ilk-satir') === String(f.id); sessionStorage.removeItem('fis-ilk-satir'); } catch { /* */ }
  ciz();
  if (ilk && f.durum === 'taslak' && !satirlar.length) setTimeout(() => $('[data-urun-ara]', el)?.focus(), 80);
  void ham;
}
