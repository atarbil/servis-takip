// Teklif / proforma düzenleyici
import { api } from '../api.js';
import { izgaraBagla, KISAYOL_YARDIM } from '../izgara.js';
import { html, $, $$, para, paraSade, dovizPara, pencere, bildir, onayla, sayiCoz, sayiGiris, bugunStr, zaman, esc } from '../ui.js';
import { cariSecici, urunSecici, kurAl, kurDegeri, urunFiyati, silOnay } from '../bilesen.js';
import { teklifYazdir, proformaYazdir, tutarYaziyla } from '../belgeler.js';
import { TEKLIF_DURUM, teklifRozet, TUR_AD } from './teklifler.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const kdvDahilOku = () => { try { return localStorage.getItem('kdvDahil') === '1'; } catch { return false; } };

export default async function (el, [id], ctx) {
  let t;
  if (id === 'yeni') {
    const tur = ctx.sorgu.tur === 'proforma' ? 'proforma' : 'teklif';
    const c = ctx.sorgu.cari ? await api.get(`/cariler/${ctx.sorgu.cari}`) : null;
    t = { id: null, tur, durum: 'taslak', tarih: bugunStr(), gecerlilik: '', cari_id: c?.id || null, unvan: c?.unvan || '', satirlar: [],
      cari_adres: c?.adres, il: c?.il, ilce: c?.ilce, cari_telefon: c?.telefon, vergi_dairesi: c?.vergi_dairesi, vergi_no: c?.vergi_no, cari_bakiye: c?.bakiye,
      kase_imza: true, aciklama: '', doviz: 'TRY', kur: null, tl_karsilik_goster: false,
      giris_metni: tur === 'teklif' ? ctx.ayarlar.teklif_giris || '' : '', kapanis_metni: tur === 'teklif' ? ctx.ayarlar.teklif_kapanis || '' : '' };
  } else t = await api.get(`/teklifler/${id}`);
  let satirlar = t.satirlar.map((s) => ({ ...s }));
  const piyasa = await kurAl(ctx);
  const kurYaz = (n) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  const dp = (n) => dovizPara(n, t.doviz);
  // Ürün fiyatı belgenin para birimine çevrilir
  const urunBelgeFiyati = (u) => {
    const x = urunFiyati(u, piyasa, t.doviz || 'TRY');
    if (x.kur_yok) bildir('Kur bilgisi alınamadı; fiyatı elle girin.', 'hata');
    return x.birim_fiyat;
  };
  let cari = t.cari_id ? { id: t.cari_id, unvan: t.unvan } : null;
  let kdvDahil = kdvDahilOku();
  let degisti = id === 'yeni';
  const kilitli = () => t.durum === 'iptal' || !!t.fis_id;
  ctx.baslik(t.id ? t.belge_no : `Yeni ${TUR_AD[t.tur].toLowerCase()}`);

  const hesap = (s) => { const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0) * (1 - Number(s.iskonto_orani || 0) / 100)); return { net, kdv: r2(net * Number(s.kdv_orani || 0) / 100) }; };
  const toplam = () => { let ara = 0; let kdv = 0; for (const s of satirlar) { const h = hesap(s); ara += h.net; kdv += h.kdv; } return { ara: r2(ara), kdv: r2(kdv), genel: r2(ara + kdv) }; };
  const goster = (s) => (kdvDahil ? r2(Number(s.birim_fiyat) * (1 + Number(s.kdv_orani) / 100)) : Number(s.birim_fiyat));

  // Excel gibi klavye ile gezinme (yeniden çizimde odak korunur)
  let izgara = null;
  function ciz() { const o = izgara?.odakNe(); cizIc(); if (o) izgara.odakla(o); }
  const enterYeniSatir = () => { try { return localStorage.getItem('enterYeniSatir') === '1'; } catch { return false; } };
  const STOKSUZ_AD = { iscilik: 'İşçilik', egitim: 'Eğitim', hizmet: 'Hizmet' };
  const bosSatir = (tip = 'urun') => (STOKSUZ_AD[tip]
    ? { tip, urun_id: null, aciklama: STOKSUZ_AD[tip], miktar: 1, birim: tip === 'hizmet' ? 'adet' : 'saat', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20 }
    : { tip: 'urun', urun_id: null, aciklama: '', miktar: 1, birim: 'adet', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20 });
  const kartAlanlari = (u) => ({ tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_tur: u.tur, urun_id: u.id, aciklama: u.ad, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20), urun_kod: u.kod, urun_maliyet: Number(u.ort_maliyet || 0) });
  izgara = izgaraBagla(el, {
    yeniSatir: () => { if (!enterYeniSatir()) return false; satirlar.push(bosSatir()); degisti = true; ciz(); return true; },
    satirSil: (i) => { satirlar.splice(i, 1); degisti = true; ciz(); },
    satirEkle: (i) => { satirlar.splice(i, 0, bosSatir()); degisti = true; ciz(); },
    kisayollar: {
      F4: () => $('[data-stok-listesi]', el)?.click(),
      'Ctrl+B': () => $('[data-barkod]', el)?.click(),
      'Ctrl+S': () => $('[data-a=kaydet]', el)?.click(),
    },
  });
  const STOKSUZ = { iscilik: 'İşçilik', egitim: 'Eğitim', hizmet: 'Hizmet' };
  const stoksuzMu = (x) => !x.urun_id && !!STOKSUZ[x.tip];
  const turRozet = (x) => (stoksuzMu(x) ? html`<span class="rozet satir-tur ${x.tip}">${STOKSUZ[x.tip]}</span>` : x.urun_id && (x.tip === 'hizmet' || x.urun_tur === 'hizmet') ? html`<span class="rozet mavi satir-tur">hizmet</span>` : '');
  const maliyetGoster = () => { try { return localStorage.getItem('teklifMaliyet') === '1'; } catch { return false; } };
  // Birim maliyet belge para biriminde (ürün kartındaki ortalama maliyet TL)
  const belgeKur = () => (t.doviz && t.doviz !== 'TRY' ? Number(t.kur) || kurDegeri(piyasa, t.doviz) || 0 : 1);
  const satirMaliyet = (x) => { if (!x.urun_id) return 0; const k = belgeKur(); return k ? r2(Number(x.miktar || 0) * Number(x.urun_maliyet || 0) / k) : 0; };

  function satirHtml(x, i, ac) {
    const h = hesap(x); const ml = satirMaliyet(x); const kar = r2(h.net - ml);
    const kod = x.urun_kod || x._kod || '';
    if (!ac) {
      return html`<tr><td class="no">${i + 1}</td><td class="kod">${kod}</td>
        <td class="aciklama-hucre">${turRozet(x)} ${x.aciklama}${x.notu ? html`<div class="alt-satir">${x.notu}</div>` : ''}</td>
        <td class="sayi" data-et="Miktar">${sayiGiris(x.miktar)}</td><td class="brm" data-et="Birim">${x.birim}</td><td class="sayi" data-et="Birim fiyat">${dp(x.birim_fiyat)}</td>
        <td class="sayi" data-et="İsk. %">${Number(x.iskonto_orani) || ''}</td><td class="sayi" data-et="KDV %">${Number(x.kdv_orani)}</td><td class="sayi tutar" data-et="Tutar"><b>${paraSade(h.net)}</b></td>
        <td class="sayi maliyet soluk" data-et="Maliyet">${x.urun_id ? paraSade(ml) : ''}</td></tr>`;
    }
    return html`<tr data-i="${i}" class="${!x.urun_id && !stoksuzMu(x) ? 'eksik' : ''}">
      <td class="no">${i + 1}</td>
      <td class="kod">${kod}</td>
      <td class="aciklama-hucre">${stoksuzMu(x)
        ? html`<div class="stoksuz-hucre">${turRozet(x)}<input data-k="aciklama" value="${x.aciklama || ''}" placeholder="${STOKSUZ[x.tip]} açıklaması"></div>
          <input data-k="notu" class="not-giris" value="${x.notu || ''}" placeholder="not: süre, kapsam…">`
        : x.urun_id
          ? html`<div class="urun-adi" title="Ürün adı stok kartından gelir">${turRozet(x)}<b>${x.aciklama}</b> <button type="button" class="btn-metin degistir" data-urun-degistir="${i}" tabindex="-1">değiştir</button></div>
            <input data-k="notu" class="not-giris" value="${x.notu || ''}" placeholder="not: model, garanti, teslim süresi…">`
          : html`<input data-k="aciklama" value="${x.aciklama || ''}" placeholder="Ürün / hizmet ara… (ad, kod, model)" class="urun-ara">`}</td>
      <td data-et="Miktar"><input class="sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(x.miktar)}"></td>
      <td data-et="Birim"><input data-k="birim" value="${x.birim || 'adet'}"></td>
      <td data-et="Birim fiyat"><input class="sayi" data-k="birim_fiyat" inputmode="decimal" value="${sayiGiris(goster(x))}" placeholder="0,00"></td>
      <td data-et="İsk. %"><input class="sayi" data-k="iskonto_orani" inputmode="decimal" value="${Number(x.iskonto_orani) ? sayiGiris(x.iskonto_orani) : ''}" placeholder="0"></td>
      <td data-et="KDV %"><input class="sayi" data-k="kdv_orani" inputmode="decimal" value="${sayiGiris(x.kdv_orani)}"></td>
      <td class="sayi tutar s-tutar" data-et="Tutar">${paraSade(h.net)}</td>
      <td class="sayi maliyet soluk s-maliyet">${x.urun_id ? html`${paraSade(ml)}<small class="${kar >= 0 ? 'pozitif' : 'negatif'}">${paraSade(kar)}</small>` : ''}</td>
      <td class="sil"><button class="btn-ikon" data-sil="${i}" title="Satırı sil (Ctrl+Delete)" tabindex="-1">✕</button></td></tr>`;
  }

  function cizIc() {
    const ac = !kilitli();
    const mg = maliyetGoster();
    const bakiye = Number(t.cari_bakiye || 0);
    const yer = [t.ilce, t.il].filter(Boolean).join(' / ');
    el.innerHTML = String(html`
      <div class="detay-ust">
        <div style="flex:1;min-width:240px"><a href="#/teklifler" class="btn-metin">← Teklif / Proforma</a>
          <div class="btn-grup"><h2>${TUR_AD[t.tur]}</h2>${t.id ? teklifRozet(t.durum) : html`<span class="rozet">yeni</span>`}${degisti && ac ? html`<span class="rozet turuncu">kaydedilmedi</span>` : ''}</div>
          ${t.kaynak_belge_no ? html`<div class="soluk">${t.kaynak_belge_no} numaralı belgeden kopyalandı</div>` : ''}
          ${t.fis_id ? html`<div class="soluk">Satış fişine dönüştürüldü: <a href="#/fis/${t.fis_id}">${t.fis_no}</a></div>` : ''}</div>
        <div class="btn-grup">
          ${ac ? html`<button class="btn ikincil" data-a="kaydet" title="Ctrl+S">Kaydet</button>` : ''}
          ${t.id && !t.fis_id && t.durum !== 'iptal' ? html`<button class="btn basari" data-a="fis">🧾 Satış fişine dönüştür</button>` : ''}
          <button class="btn ikincil" data-a="yazdir">🖨 Yazdır / PDF</button>
          ${t.id ? html`<button class="btn ikincil" data-a="kopyala">${t.tur === 'teklif' ? 'Proformaya kopyala' : 'Teklife kopyala'}</button>` : ''}
          ${t.id && t.durum !== 'iptal' && !t.fis_id ? html`<button class="btn tehlike-cizgi" data-a="iptal">İptal et</button>` : ''}
          ${t.id ? html`<button class="btn tehlike-cizgi" data-a="sil" title="Sil (30 gün geri alınabilir)">🗑 Sil</button>` : ''}
        </div>
      </div>
      ${t.durum === 'iptal' ? html`<div class="uyari-kutu">Bu belge iptal edildi.</div>` : ''}

      <div class="fatura">
        <div class="fatura-ust">
          <div class="fatura-cari">
            <div class="fatura-etiket">Sayın</div>
            ${ac ? html`<input id="t-cari" class="fatura-unvan-giris" value="${cari?.unvan || ''}" placeholder="Cari ara…">` : html`<div class="fatura-unvan">${t.unvan}</div>`}
            ${t.cari_adres || yer ? html`<div>${t.cari_adres || ''} ${yer}</div>` : ''}
            ${t.vergi_dairesi || t.vergi_no ? html`<div>${t.vergi_dairesi ? `V.D.: ${t.vergi_dairesi}` : ''} ${t.vergi_no ? `V.N.: ${t.vergi_no}` : ''}</div>` : ''}
            ${t.cari_telefon ? html`<div>Tel: ${t.cari_telefon}</div>` : ''}
            ${cari?.id ? html`<div class="fatura-bakiye">${t.cari_bakiye != null ? html`Cari bakiye: <b class="${bakiye > 0.004 ? 'negatif' : bakiye < -0.004 ? 'pozitif' : ''}">${para(Math.abs(bakiye))} ${bakiye > 0.004 ? '(B)' : bakiye < -0.004 ? '(A)' : ''}</b> · ` : ''}<a href="#/cari/${cari.id}">Cari kartı →</a></div>` : ''}
          </div>
          <div class="fatura-belge">
            <div class="fb-satir"><span>${t.tur === 'teklif' ? 'Teklif no' : 'Proforma no'}</span><b>${t.belge_no || '— (kaydedince)'}</b></div>
            <label class="fb-satir"><span>Tarih</span><input type="date" id="t-tarih" value="${t.tarih}" ${ac ? '' : 'readonly'}></label>
            <label class="fb-satir"><span>${t.tur === 'teklif' ? 'Geçerlilik' : 'Son ödeme'}</span><input type="date" id="t-gecerlilik" value="${t.gecerlilik || ''}" ${ac ? '' : 'readonly'}></label>
            <div class="fb-satir"><span>Para birimi</span><div class="fiyat-doviz"><select id="t-doviz" ${ac ? '' : 'disabled'}>${['TRY', 'USD', 'EUR'].map((d) => html`<option value="${d}" ${t.doviz === d ? 'selected' : ''}>${d === 'TRY' ? '₺ TL' : d}</option>`)}</select>
              ${t.doviz !== 'TRY' ? html`<input id="t-kur" inputmode="decimal" value="${t.kur ? sayiGiris(t.kur) : ''}" placeholder="Kur" title="1 ${t.doviz} = ? TL" ${ac ? '' : 'readonly'} style="max-width:110px">` : ''}</div></div>
            ${t.doviz !== 'TRY' && ac && kurDegeri(piyasa, t.doviz) ? html`<div class="fb-satir"><span></span><small>TCMB satış: <button type="button" class="btn-metin" style="color:var(--ana)" data-tcmb>${kurYaz(kurDegeri(piyasa, t.doviz))}</button></small></div>` : ''}
            <label class="fb-satir"><span>İç not</span><input id="t-aciklama" value="${t.aciklama || ''}" placeholder="çıktıda görünmez"></label>
          </div>
        </div>
        ${t.id ? html`<div class="teklif-durum"><span class="soluk">Durum:</span>${Object.entries(TEKLIF_DURUM).filter(([k]) => k !== 'iptal')
          .map(([k, v]) => html`<button class="btn kucuk ${t.durum === k ? 'birincil' : 'ikincil'}" data-durum="${k}" ${t.fis_id && k !== 'kabul' || t.durum === 'iptal' ? 'disabled' : ''}>${v.ad}</button>`)}</div>` : ''}

        <div class="fatura-arac">
          ${ac ? html`<div class="btn-grup">
            <button class="btn ikincil kucuk" data-ekle="urun">+ Satır</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="iscilik">+ İşçilik</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="egitim">+ Eğitim</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="hizmet">+ Hizmet</button>
            <button class="btn ikincil kucuk" data-stok-listesi title="F4">📦 Stok listesi</button>
            <button class="btn ikincil kucuk" data-barkod title="Ctrl+B">📷 Barkod</button></div>` : html`<span></span>`}
          <span class="bosluk"></span>
          ${ac ? html`<label class="kutu-sec enter-yeni" style="margin:0" title="İşaretliyse son hücrede Enter yeni satır açar"><input type="checkbox" id="enter-yeni-satir" ${enterYeniSatir() ? 'checked' : ''}> Enter ile yeni satır aç</label>` : ''}
          <label class="kutu-sec" style="margin:0"><input type="checkbox" id="maliyet-goster" ${mg ? 'checked' : ''}> Maliyet / kâr</label>
          ${ac ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="kdv-dahil" ${kdvDahil ? 'checked' : ''}> Fiyatlar KDV dahil</label>` : ''}
        </div>

        <div class="fatura-tablo-kap"><table class="fatura-tablo ${mg ? '' : 'maliyetsiz'}" id="kalemler"><thead><tr>
          <th class="no">#</th><th class="kod">Kod</th><th>Ürün / hizmet açıklaması</th><th class="sayi mik">Miktar</th><th class="brm">Birim</th>
          <th class="sayi fiyat">Birim fiyat${t.doviz !== 'TRY' ? ` (${t.doviz})` : ''}${kdvDahil && ac ? ' (KDV dahil)' : ''}</th><th class="sayi yuzde">İsk. %</th><th class="sayi yuzde">KDV %</th><th class="sayi tutar">Tutar</th>
          <th class="sayi maliyet">Maliyet</th>${ac ? html`<th class="sil"></th>` : ''}</tr></thead>
          <tbody id="satirlar">${satirlar.map((x, i) => satirHtml(x, i, ac))}
            ${!satirlar.length ? html`<tr class="bos-satir"><td colspan="11">${ac ? html`Kalem yok. <b>+ Satır</b> ile başlayın veya <b>F4</b> ile stok listesinden seçin.` : 'Kalem yok.'}</td></tr>` : ''}</tbody>
        </table></div>
        ${ac ? html`<div class="fatura-ipucu">⌨️ ${KISAYOL_YARDIM}</div>` : ''}

        <details class="teklif-metinleri" ${t.tur === 'teklif' ? 'open' : ''}><summary>${t.tur === 'teklif' ? 'Teklif metinleri ve çıktı seçenekleri' : 'Çıktı seçenekleri'}</summary>
          <div class="teklif-metinleri-ic">
            ${t.tur === 'teklif' ? html`<div class="satir2 metin-cifti">
              <label class="alan"><span>Giriş metni</span><textarea id="t-giris" rows="2" ${ac ? '' : 'readonly'}>${t.giris_metni || ''}</textarea></label>
              <label class="alan"><span>Kapanış metni</span><textarea id="t-kapanis" rows="2" ${ac ? '' : 'readonly'}>${t.kapanis_metni || ''}</textarea></label></div>` : ''}
            <div class="btn-grup">
              <label class="kutu-sec" style="margin:0"><input type="checkbox" id="t-kase" ${t.kase_imza ? 'checked' : ''}> Kaşe ve imza ekle
                ${!ctx.ayarlar.kase_imza ? html`<small style="color:var(--turuncu)">(Ayarlar'dan kaşe görseli yüklenmemiş)</small>` : ''}</label>
              ${t.doviz !== 'TRY' ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="t-tlk" ${t.tl_karsilik_goster ? 'checked' : ''} ${ac ? '' : 'disabled'}> Çıktıda TL karşılığını göster</label>` : ''}
            </div></div></details>

        <div class="fatura-alt" id="toplam"></div>
      </div>`);
    toplamCiz();
    $('#maliyet-goster', el).onchange = (e) => { try { localStorage.setItem('teklifMaliyet', e.target.checked ? '1' : '0'); } catch { /* */ } ciz(); };
    if (!ac) return;
    const ci = $('#t-cari', el);
    cariSecici(ci, async (c) => {
      cari = c; ci.value = c.unvan; degisti = true;
      Object.assign(t, { cari_id: c.id, unvan: c.unvan, cari_adres: c.adres, il: c.il, ilce: c.ilce, cari_telefon: c.telefon, vergi_dairesi: c.vergi_dairesi, vergi_no: c.vergi_no, cari_bakiye: c.bakiye });
      ciz();
    }, { yeniIzin: false });
    $$('.urun-ara', el).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      urunSecici(inp, (u) => {
        Object.assign(satirlar[i], { tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_tur: u.tur, urun_id: u.id, aciklama: u.ad, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20), _kod: u.kod, urun_kod: u.kod, urun_maliyet: Number(u.ort_maliyet || 0) });
        if (!Number(satirlar[i].birim_fiyat) && u.onerilen_satis) satirlar[i].birim_fiyat = urunBelgeFiyati(u);
        degisti = true; ciz();
        setTimeout(() => izgara?.odakla({ i, k: 'miktar' }), 30);
      }, { bulunamadi: true, iptal: () => { satirlar[i].aciklama = ''; ciz(); } });
    });
    $('#enter-yeni-satir', el).onchange = (e) => { try { localStorage.setItem('enterYeniSatir', e.target.checked ? '1' : '0'); } catch { /* */ } };
    $('#kdv-dahil', el).onchange = (e) => { kdvDahil = e.target.checked; try { localStorage.setItem('kdvDahil', kdvDahil ? '1' : '0'); } catch { /* */ } ciz(); };
  }
  function toplamCiz() {
    const x = toplam();
    const k = Number(t.kur);
    const oranlar = new Map(); let brut = 0; let maliyet = 0;
    for (const sx of satirlar) {
      const h = hesap(sx); const o = Number(sx.kdv_orani || 0);
      brut += r2(Number(sx.miktar || 0) * Number(sx.birim_fiyat || 0)); maliyet += satirMaliyet(sx);
      const y = oranlar.get(o) || { matrah: 0, kdv: 0 }; y.matrah += h.net; y.kdv += h.kdv; oranlar.set(o, y);
    }
    const iskonto = r2(brut - x.ara); const kar = r2(x.ara - maliyet);
    const mg = maliyetGoster();
    $('#toplam', el).innerHTML = String(html`
      <div class="fatura-yazi">${t.doviz === 'TRY' ? html`<span class="soluk">Yalnız:</span> <b>${tutarYaziyla(x.genel)}</b>` : ''}
        <div class="fatura-kdv-dokum">${[...oranlar.entries()].sort((a2, b2) => b2[0] - a2[0]).map(([o, y]) => html`<span>KDV %${o}: matrah ${dp(r2(y.matrah))} · KDV ${dp(r2(y.kdv))}</span>`)}</div>
        ${t.doviz !== 'TRY' && k > 0 ? html`<div class="fatura-kar">TL karşılığı (1 ${t.doviz} = ${kurYaz(k)} ₺): <b>${para(r2(x.genel * k))}</b></div>` : ''}
        ${mg ? html`<div class="fatura-kar">Maliyet ${dp(r2(maliyet))} · Kâr <b class="${kar >= 0 ? 'pozitif' : 'negatif'}">${dp(kar)}${x.ara > 0 ? ` (%${(kar * 100 / x.ara).toFixed(1).replace('.', ',')})` : ''}</b></div>` : ''}</div>
      <table class="fatura-toplam"><tbody>
        ${iskonto > 0.004 ? html`<tr><td>Brüt toplam</td><td>${dp(r2(brut))}</td></tr><tr><td>İskonto</td><td>−${dp(iskonto)}</td></tr>` : ''}
        <tr><td>Ara toplam</td><td>${dp(x.ara)}</td></tr>
        <tr><td>KDV</td><td>${dp(x.kdv)}</td></tr>
        <tr class="genel"><td>Genel toplam</td><td>${dp(x.genel)}</td></tr></tbody></table>`);
  }

  // Başlık alanları duruma yazılır (yeniden çizimde kaybolmasın)
  const BASLIK = { 't-tarih': 'tarih', 't-gecerlilik': 'gecerlilik', 't-giris': 'giris_metni', 't-kapanis': 'kapanis_metni', 't-aciklama': 'aciklama' };
  const baslikYaz = (e) => {
    if (e.target.id === 't-kur') { t.kur = sayiCoz(e.target.value); degisti = true; toplamCiz(); return true; }
    if (e.target.id === 't-tlk') { t.tl_karsilik_goster = e.target.checked; degisti = true; return true; }
    if (e.target.id === 't-doviz') { if (e.type === 'change') dovizDegistir(e.target.value); return true; }
    const k = BASLIK[e.target.id]; if (k) { t[k] = e.target.value; degisti = true; return true; } if (e.target.id === 't-kase') { t.kase_imza = e.target.checked; degisti = true; return true; } return false; };
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

  // Para birimi değişince mevcut fiyatlar istenirse kurla çevrilir
  async function dovizDegistir(yeni) {
    const eski = t.doviz || 'TRY';
    if (yeni === eski) return;
    const fiyatli = satirlar.some((s) => Number(s.birim_fiyat));
    const ke = kurDegeri(piyasa, eski); const ky = kurDegeri(piyasa, yeni);
    if (fiyatli && ke && ky && await onayla(`Mevcut fiyatlar ${eski} → ${yeni} güncel kurla çevrilsin mi? Vazgeçerseniz rakamlar aynı kalır, sadece para birimi değişir.`, { evet: 'Kurla çevir' })) {
      for (const s of satirlar) s.birim_fiyat = r2(Number(s.birim_fiyat || 0) * ke / ky);
    }
    t.doviz = yeni;
    t.kur = yeni === 'TRY' ? null : (kurDegeri(piyasa, yeni) || t.kur);
    if (yeni === 'TRY') t.tl_karsilik_goster = false;
    degisti = true; ciz();
  }

  async function kaydet() {
    if (!cari) throw new Error('Cari seçin.');
    if (!satirlar.length) throw new Error('En az bir kalem ekleyin.');
    satirlar = satirlar.filter((s) => s.urun_id || stoksuzMu(s) || String(s.aciklama || '').trim());
    if (!satirlar.length) throw new Error('En az bir kalem ekleyin.');
    for (const s of satirlar) {
      if (stoksuzMu(s)) { if (!String(s.aciklama || '').trim()) throw new Error(`${STOKSUZ[s.tip]} satırının açıklamasını yazın.`); continue; }
      if (!s.urun_id) throw new Error(`"${s.aciklama}" bir stok kartına bağlı değil. Listeden seçin ya da yeni stok kartı açın.`);
    }
    const govde = { tur: t.tur, cari_id: cari.id, tarih: t.tarih, gecerlilik: t.gecerlilik || null, giris_metni: t.giris_metni, kapanis_metni: t.kapanis_metni,
      aciklama: t.aciklama, kase_imza: t.kase_imza, doviz: t.doviz || 'TRY', kur: t.kur, tl_karsilik_goster: !!t.tl_karsilik_goster,
      satirlar: satirlar.map((s) => ({ tip: stoksuzMu(s) ? s.tip : 'urun', urun_id: s.urun_id || null, aciklama: s.aciklama, notu: s.notu, miktar: s.miktar, birim: s.birim, birim_fiyat: s.birim_fiyat, iskonto_orani: s.iskonto_orani, kdv_orani: s.kdv_orani })) };
    const yeni = !t.id;
    t = yeni ? await api.post('/teklifler', govde) : await api.put(`/teklifler/${t.id}`, govde);
    satirlar = t.satirlar.map((s) => ({ ...s }));
    cari = { id: t.cari_id, unvan: t.unvan };
    degisti = false;
    if (yeni) { history.replaceState(null, '', `#/teklif/${t.id}`); ctx.baslik(t.belge_no); }
  }

  el.addEventListener('click', async (e) => {
    const ud = e.target.closest('[data-urun-degistir]');
    if (ud) { Object.assign(satirlar[Number(ud.dataset.urunDegistir)], { tip: 'urun', urun_id: null, aciklama: '', urun_kod: null }); degisti = true; return ciz(); }
    const sil = e.target.closest('[data-sil]');
    if (sil) { satirlar.splice(Number(sil.dataset.sil), 1); degisti = true; return ciz(); }
    if (e.target.closest('[data-stok-listesi]')) {
      const { stokListesi } = await import('../bilesen.js');
      const sec = await stokListesi({ fiyat: 'satis' });
      if (!sec) return;
      // Boş kalem satırı varsa önce onu doldur
      const boslar = () => satirlar.findIndex((x) => !x.urun_id && !stoksuzMu(x) && !String(x.aciklama || '').trim());
      for (const { urun: u, miktar: m } of sec) {
        const v = satirlar.find((x) => x.urun_id === u.id);
        if (v) { v.miktar = Number(v.miktar) + m; continue; }
        const yeni = { ...kartAlanlari(u), notu: '', miktar: m, birim_fiyat: urunBelgeFiyati(u), iskonto_orani: 0 };
        const b = boslar(); if (b >= 0) satirlar[b] = yeni; else satirlar.push(yeni);
      }
      degisti = true; bildir(`${sec.length} ürün eklendi.`, 'basari'); return ciz();
    }
    const ekBtn = e.target.closest('[data-ekle]');
    if (ekBtn) {
      const ek = ekBtn.dataset.ekle; const sonS = satirlar.at(-1);
      const sonBos = sonS && !sonS.urun_id && !stoksuzMu(sonS) && !String(sonS.aciklama || '').trim();
      if (STOKSUZ[ek]) { if (sonBos) satirlar[satirlar.length - 1] = bosSatir(ek); else satirlar.push(bosSatir(ek)); }
      else if (!sonBos) satirlar.push(bosSatir());
      degisti = true; ciz();
      const inp = $(`tr[data-i="${satirlar.length - 1}"] [data-k=aciklama]`, el); inp?.focus(); if (STOKSUZ[ek]) inp?.select();
      return;
    }
    if (e.target.closest('[data-barkod]')) {
      const { barkodOku } = await import('../barkod.js');
      const b = await barkodOku(); if (!b) return;
      try {
        const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
        const v = satirlar.find((s) => s.urun_id === u.id);
        if (v) v.miktar = Number(v.miktar) + 1; else satirlar.push({ ...kartAlanlari(u), miktar: 1, birim_fiyat: urunBelgeFiyati(u), iskonto_orani: 0 });
        degisti = true; ciz();
      } catch {
        const { urunBulunamadi } = await import('../bilesen.js');
        const u = await urunBulunamadi('', { barkod: b });
        if (u) { satirlar.push({ ...kartAlanlari(u), miktar: 1, birim_fiyat: urunBelgeFiyati(u), iskonto_orani: 0 }); degisti = true; ciz(); }
      }
      return;
    }
    if (e.target.closest('[data-tcmb]')) { t.kur = kurDegeri(piyasa, t.doviz); degisti = true; return ciz(); }
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
      else if (a === 'sil') { degisti = false; if (await silOnay('teklif', t.id)) ctx.kapatVeGit('teklifler'); }
      else if (a === 'yazdir') {
        if (degisti && !kilitli()) { await kaydet(); ciz(); }
        if (!t.id) return;
        (t.tur === 'teklif' ? teklifYazdir : proformaYazdir)(ctx, t, { kaseImza: t.kase_imza });
        if (t.durum === 'taslak') { t = await api.post(`/teklifler/${t.id}/durum`, { durum: 'gonderildi' }); satirlar = t.satirlar.map((s) => ({ ...s })); setTimeout(ciz, 500); }
      } else if (a === 'fis') {
        if (degisti && !kilitli()) await kaydet();
        let kurGir = null;
        if (t.doviz && t.doviz !== 'TRY') {
          const v = await pencere({
            baslik: 'Satış fişine dönüştür',
            icerik: html`<p><b>${esc(t.belge_no)}</b> ${t.doviz} cinsinden. Satış fişi ve cari TL tutulur; fiyatlar bu kurla TL'ye çevrilecek.</p>
              <label class="alan"><span>Kur (1 ${t.doviz} = ? TL)</span><input name="kur" inputmode="decimal" value="${sayiGiris(kurDegeri(piyasa, t.doviz) || t.kur || '')}" autofocus></label>
              ${t.kur ? html`<small class="soluk">Belgedeki kur: ${kurYaz(t.kur)} · TCMB satış: ${kurDegeri(piyasa, t.doviz) ? kurYaz(kurDegeri(piyasa, t.doviz)) : '—'}</small>` : ''}`,
            kaydetMetin: 'Dönüştür',
            kaydet: async (x) => { const k = sayiCoz(x.kur); if (!(k > 0)) throw new Error('Geçerli bir kur girin.'); return { kur: k }; },
          });
          if (!v) return;
          kurGir = v.kur;
        } else if (!await onayla(html`<b>${esc(t.belge_no)}</b> taslak satış fişine dönüştürülecek ve belge "Kabul edildi" olarak işaretlenecek.
          Fiş onaylanınca cariye borç yazılır ve stok düşer.`, { evet: 'Dönüştür' })) return;
        const r = await api.post(`/teklifler/${t.id}/fise-donustur`, { kur: kurGir });
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

  // Program içi sekme: kaydedilmemiş değişiklik var mı
  el.kirliMi = () => degisti && !kilitli() && (!!t.id || satirlar.some((x) => x.urun_id || String(x.aciklama || '').trim()));
  ciz();
}
