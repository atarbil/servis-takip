// Satış fişi düzenleyici
import { api } from '../api.js';
import { html, $, $$, para, paraSade, dovizPara, miktar, tarih, zaman, durumRozet, bildir, onayla, sayiCoz, sayiGiris, esc } from '../ui.js';
import { cariSecici, urunSecici, finansPenceresi, kurAl, kurDegeri, urunFiyati, silOnay } from '../bilesen.js';
import { fisYazdir, tutarYaziyla } from '../belgeler.js';
import { izgaraBagla, KISAYOL_YARDIM } from '../izgara.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const kdvDahilOku = () => { try { return localStorage.getItem('kdvDahil') === '1'; } catch { return false; } };

export default async function (el, [id], ctx) {
  let f = await api.get(`/fisler/${id}`);
  ctx.baslik(f.fis_no);
  let kur = f.durum === 'taslak' ? await kurAl(ctx) : null;
  const kurFmt = (n) => Number(n).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  // Satırın döviz kaynağı notu: "120,00 USD × 41,9578"
  const dovizNot = (s) => (s.doviz ? html`<small class="doviz-not" title="Fiş TL'dir; fiyat dövizden çevrildi">${dovizPara(s.doviz_fiyat, s.doviz)}${s.kur ? html` × ${kurFmt(s.kur)}` : html` · <b style="color:var(--turuncu)">kur yok</b>`}</small>` : '');
  // Ürün satırı için fiyat alanları (dövizli ürün güncel kurla TL'ye çevrilir)
  const fiyatAlanlari = (u) => { const x = urunFiyati(u, kur, 'TRY'); delete x.kur_yok; return x; };
  let kdvDahil = kdvDahilOku();
  let satirlar = [];
  let degisti = false;
  let cari = { id: f.cari_id, unvan: f.unvan };

  const yukle = () => {
    satirlar = f.satirlar.map((s) => ({ ...s, _tahmin: Number(s.birim_maliyet) || Number(s.urun_maliyet || 0) }));
    cari = { id: f.cari_id, unvan: f.unvan };
  };
  yukle();

  function hesap(s) {
    const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0) * (1 - Number(s.iskonto_orani || 0) / 100));
    const kdv = r2(net * Number(s.kdv_orani || 0) / 100);
    const maliyet = r2(Number(s.miktar || 0) * Number(s.birim_maliyet || s._tahmin || 0));
    return { net, kdv, maliyet };
  }
  function toplamlar() {
    let ara = 0; let kdv = 0; let maliyet = 0;
    for (const s of satirlar) { const h = hesap(s); ara += h.net; kdv += h.kdv; maliyet += h.maliyet; }
    return { ara: r2(ara), kdv: r2(kdv), genel: r2(ara + kdv), maliyet: r2(maliyet), kar: r2(ara - maliyet) };
  }
  const gosterFiyat = (s) => (kdvDahil ? r2(Number(s.birim_fiyat) * (1 + Number(s.kdv_orani) / 100)) : Number(s.birim_fiyat));

  const maliyetGoster = () => { if (ctx.muhasebe) return false; try { return localStorage.getItem('fisMaliyet') !== '0'; } catch { return true; } };
  const STOKSUZ = { iscilik: 'İşçilik', egitim: 'Eğitim', hizmet: 'Hizmet' };
  const enterYeniSatir = () => { try { return localStorage.getItem('enterYeniSatir') === '1'; } catch { return false; } };
  let izgara = null;

  function ciz() {
    const odak = izgara?.odakNe();
    const taslak = f.durum === 'taslak';
    const onaysiz = satirlar.filter((s) => s.onay_bekliyor);
    const mg = maliyetGoster();
    const bakiye = Number(f.cari_bakiye || 0);
    el.innerHTML = String(html`
      <div class="detay-ust">
        <div style="flex:1;min-width:240px"><a href="#/fisler" class="btn-metin">← Satış fişleri</a>
          <div class="btn-grup"><h2>Satış fişi</h2>${durumRozet(f.durum)}${degisti && taslak ? html`<span class="rozet turuncu" id="kaydedilmedi">kaydedilmedi</span>` : ''}</div></div>
        <div class="btn-grup">
          ${taslak ? html`<button class="btn ikincil" data-a="kaydet" title="Ctrl+S">Kaydet</button><button class="btn basari" data-a="onayla">✓ Onayla ve cariye işle</button>` : ''}
          <button class="btn ikincil" data-a="yazdir">🖨 Yazdır</button>
          ${f.durum === 'onaylandi' ? html`<button class="btn ikincil" data-a="tahsilat">💰 Tahsilat al</button>` : ''}
          ${f.durum === 'onaylandi' ? html`<button class="btn tehlike-cizgi" data-a="iptal">Fişi iptal et</button>` : ''}
          <button class="btn tehlike-cizgi" data-a="sil" title="Sil (30 gün geri alınabilir)">🗑 Sil</button>
        </div>
      </div>
      ${f.durum === 'iptal' ? html`<div class="uyari-kutu">Bu fiş iptal edilmiştir. Cari ve stok etkileri geri alındı.</div>` : ''}
      ${onaysiz.length ? html`<div class="uyari-kutu kar-bilgi">Bu fişte maliyeti girilmemiş (sahada eklenen) ürün var: ${onaysiz.map((s, i) => html`${i ? ', ' : ''}<a href="#/urun/${s.urun_id}">${s.aciklama}</a>`)}. Fişi onaylamadan önce ürünü onaylayıp maliyetini girin.</div>` : ''}

      <div class="fatura">
        <div class="fatura-ust">
          <div class="fatura-cari">
            <div class="fatura-etiket">Sayın</div>
            ${taslak && !f.is_id ? html`<input id="f-cari" class="fatura-unvan-giris" value="${cari.unvan}" placeholder="Cari ara…">` : html`<div class="fatura-unvan">${f.unvan}</div>`}
            ${f.cari_adres || f.cari_il ? html`<div>${f.cari_adres || ''} ${[f.cari_ilce, f.cari_il].filter(Boolean).join(' / ')}</div>` : ''}
            ${f.vergi_dairesi || f.vergi_no ? html`<div>${f.vergi_dairesi ? `V.D.: ${f.vergi_dairesi}` : ''} ${f.vergi_no ? `V.N.: ${f.vergi_no}` : ''}</div>` : ''}
            ${f.cari_telefon ? html`<div>Tel: ${f.cari_telefon}</div>` : ''}
            <div class="fatura-bakiye">Cari bakiye: <b class="${bakiye > 0.004 ? 'negatif' : bakiye < -0.004 ? 'pozitif' : ''}">${para(Math.abs(bakiye))} ${bakiye > 0.004 ? '(B)' : bakiye < -0.004 ? '(A)' : ''}</b>
              · <a href="#/cari/${f.cari_id}">Cari kartı →</a></div>
          </div>
          <div class="fatura-belge">
            <div class="fb-satir"><span>Fiş no</span><b>${f.fis_no}</b></div>
            <label class="fb-satir"><span>Tarih</span><input type="date" id="f-tarih" value="${f.tarih}" ${taslak ? '' : 'readonly'}></label>
            <label class="fb-satir"><span>Vade</span><input type="date" id="f-vade" value="${f.vade || ''}" ${taslak ? '' : 'readonly'}></label>
            ${f.is_id ? html`<div class="fb-satir"><span>İş</span><a href="#/is/${f.is_id}">#${f.is_id} ${f.is_baslik || ''}</a></div>` : ''}
            ${f.onay_zamani ? html`<div class="fb-satir"><span>Onay</span><span>${zaman(f.onay_zamani)}</span></div>` : ''}
            <label class="fb-satir"><span>Açıklama</span><input id="f-aciklama" value="${f.aciklama || ''}" ${taslak ? '' : 'readonly'} placeholder="—"></label>
          </div>
        </div>

        <div class="fatura-arac">
          ${taslak ? html`<div class="btn-grup">
            <button class="btn ikincil kucuk" data-ekle="urun">+ Satır</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="iscilik" title="Stoksuz işçilik satırı">+ İşçilik</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="egitim" title="Stoksuz eğitim satırı">+ Eğitim</button>
            <button class="btn ikincil kucuk stoksuz-dugme" data-ekle="hizmet" title="Stoksuz hizmet satırı">+ Hizmet</button>
            <button class="btn ikincil kucuk" data-stok-listesi title="F4">📦 Stok listesi</button>
            <button class="btn ikincil kucuk" data-ekle="barkod" title="Ctrl+B">📷 Barkod</button>
            ${satirlar.some((s) => s.doviz) ? html`<button class="btn ikincil kucuk" data-a="kurguncelle" title="F9 — dövizli satırları bugünkü TCMB satış kuruyla yeniden hesapla">
              💱 Kurları güncelle${kur?.usd ? ` (USD ${kurFmt(kur.usd.satis)})` : ''}</button>` : ''}</div>` : html`<span></span>`}
          <span class="bosluk"></span>
          ${taslak ? html`<label class="kutu-sec enter-yeni" style="margin:0" title="İşaretliyse son hücrede Enter yeni satır açar; değilse yeni satırı + Satır ya da Ctrl+Insert ile siz açarsınız">
            <input type="checkbox" id="enter-yeni-satir" ${enterYeniSatir() ? 'checked' : ''}> Enter ile yeni satır aç</label>` : ''}
          <label class="kutu-sec kar-bilgi" style="margin:0"><input type="checkbox" id="maliyet-goster" ${mg ? 'checked' : ''}> Maliyet / kâr</label>
          ${taslak ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="kdv-dahil" ${kdvDahil ? 'checked' : ''}> Fiyatlar KDV dahil</label>` : ''}
        </div>

        <div class="fatura-tablo-kap"><table class="fatura-tablo ${mg ? '' : 'maliyetsiz'}" id="kalemler"><thead><tr>
          <th class="no">#</th><th class="kod">Kod</th><th>Ürün / hizmet açıklaması</th><th class="sayi mik">Miktar</th><th class="brm">Birim</th>
          <th class="sayi fiyat">Birim fiyat${kdvDahil && taslak ? ' (KDV dahil)' : ''}</th><th class="sayi yuzde">İsk. %</th><th class="sayi yuzde">KDV %</th><th class="sayi tutar">Tutar</th>
          <th class="sayi maliyet">Maliyet</th>${taslak ? html`<th class="sil"></th>` : ''}</tr></thead>
          <tbody id="satirlar">${satirlar.map((s, i) => satirHtml(s, i, taslak))}
            ${!satirlar.length ? html`<tr class="bos-satir"><td colspan="11">${taslak ? html`Satır yok. <b>+ Satır</b> ile başlayın veya <b>F4</b> ile stok listesinden seçin.` : 'Satır yok.'}</td></tr>` : ''}</tbody>
        </table></div>
        ${taslak ? html`<div class="fatura-ipucu">⌨️ ${KISAYOL_YARDIM} · F9 kurları güncelle</div>` : ''}

        <div class="fatura-alt" id="toplam"></div>
      </div>`);
    toplamCiz();
    if (taslak) {
      baglaGirdiler();
      if (!izgara) izgara = izgaraBagla(el, {
        // Son hücrede Enter: yalnız "Enter ile yeni satır aç" işaretliyse yeni satır
        yeniSatir: () => { if (!enterYeniSatir()) return false; satirlar.push(bosSatir('urun')); degisti = true; ciz(); return true; },
        satirSil: (i) => { satirlar.splice(i, 1); degisti = true; ciz(); },
        satirEkle: (i) => { satirlar.splice(i, 0, bosSatir()); degisti = true; ciz(); },
        kisayollar: {
          F4: () => $('[data-stok-listesi]', el)?.click(),
          'Ctrl+B': () => $('[data-ekle=barkod]', el)?.click(),
          'Ctrl+S': () => $('[data-a=kaydet]', el)?.click(),
          F9: () => $('[data-a=kurguncelle]', el)?.click(),
        },
      });
      if (odak) izgara.odakla(odak);
    }
  }
  // tip: 'urun' (stok kartından seçilir) ya da stoksuz 'iscilik' / 'egitim' / 'hizmet' (açıklama yazılır, stoktan düşmez)
  const bosSatir = (tip = 'urun') => (STOKSUZ[tip]
    ? { tip, urun_id: null, aciklama: STOKSUZ[tip], miktar: 1, birim: tip === 'hizmet' ? 'adet' : 'saat', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20, _tahmin: 0 }
    : { tip: 'urun', urun_id: null, aciklama: '', miktar: 1, birim: 'adet', birim_fiyat: 0, iskonto_orani: 0, kdv_orani: 20, _tahmin: 0 });
  const stoksuzMu = (s) => !s.urun_id && !!STOKSUZ[s.tip];
  const turRozet = (s) => (stoksuzMu(s) ? html`<span class="rozet satir-tur ${s.tip}">${STOKSUZ[s.tip]}</span>` : s.urun_id && s.tip === 'hizmet' ? html`<span class="rozet mavi satir-tur">hizmet</span>` : '');

  function satirHtml(s, i, taslak) {
    const h = hesap(s);
    const kar = r2(h.net - h.maliyet);
    const kod = s.urun_kod || s._kod || '';
    if (!taslak) {
      return html`<tr><td class="no">${i + 1}</td><td class="kod">${kod}</td>
        <td class="aciklama-hucre">${turRozet(s)} ${s.aciklama}${s.notu ? html`<div class="alt-satir">${s.notu}</div>` : ''}</td>
        <td class="sayi" data-et="Miktar">${miktar(s.miktar)}</td><td class="brm" data-et="Birim">${s.birim}</td><td class="sayi" data-et="Birim fiyat">${paraSade(s.birim_fiyat)}${dovizNot(s)}</td>
        <td class="sayi" data-et="İsk. %">${Number(s.iskonto_orani) ? s.iskonto_orani : ''}</td><td class="sayi" data-et="KDV %">${s.kdv_orani}</td><td class="sayi tutar" data-et="Tutar"><b>${paraSade(h.net)}</b></td>
        <td class="sayi maliyet soluk" data-et="Maliyet">${s.urun_id ? paraSade(h.maliyet) : ''}</td></tr>`;
    }
    return html`<tr data-i="${i}" class="${!s.urun_id && !stoksuzMu(s) ? 'eksik' : ''}">
      <td class="no">${i + 1}</td>
      <td class="kod">${kod}</td>
      <td class="aciklama-hucre">${stoksuzMu(s)
        ? html`<div class="stoksuz-hucre">${turRozet(s)}<input data-k="aciklama" value="${s.aciklama || ''}" placeholder="${STOKSUZ[s.tip]} açıklaması (ör. ${s.tip === 'egitim' ? 'NVR kullanım eğitimi' : s.tip === 'iscilik' ? 'Kamera montaj işçiliği' : 'Uzaktan destek'})"></div>
          <input data-k="notu" class="not-giris" value="${s.notu || ''}" placeholder="not…">`
        : s.urun_id
        ? html`<div class="urun-adi" title="Ürün adı stok kartından gelir"><b>${s.aciklama}</b>${s.stoktan_dus === false ? html` <small class="soluk">· işte kullanıldı</small>` : html` <button type="button" class="btn-metin degistir" data-urun-degistir="${i}" tabindex="-1">değiştir</button>`}</div>
          <input data-k="notu" class="not-giris" value="${s.notu || ''}" placeholder="not: seri no, garanti…">`
        : html`<input data-k="aciklama" value="${s.aciklama || ''}" placeholder="Ürün / hizmet ara… (ad, kod, model)" class="urun-ara">`}</td>
      <td data-et="Miktar"><input class="sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(s.miktar)}"></td>
      <td data-et="Birim"><input data-k="birim" value="${s.birim || 'adet'}"></td>
      <td data-et="Birim fiyat"><input class="sayi" data-k="birim_fiyat" inputmode="decimal" value="${sayiGiris(gosterFiyat(s))}" placeholder="0,00">${dovizNot(s)}</td>
      <td data-et="İsk. %"><input class="sayi" data-k="iskonto_orani" inputmode="decimal" value="${Number(s.iskonto_orani) ? sayiGiris(s.iskonto_orani) : ''}" placeholder="0"></td>
      <td data-et="KDV %"><input class="sayi" data-k="kdv_orani" inputmode="decimal" value="${sayiGiris(s.kdv_orani)}"></td>
      <td class="sayi tutar s-tutar" data-et="Tutar">${paraSade(h.net)}</td>
      <td class="sayi maliyet soluk s-maliyet" title="Birim maliyet: ${paraSade(s.birim_maliyet || s._tahmin || 0)}">${s.urun_id ? html`${paraSade(h.maliyet)}<small class="${kar >= 0 ? 'pozitif' : 'negatif'}">${paraSade(kar)}</small>` : ''}</td>
      <td class="sil"><button class="btn-ikon" data-sil="${i}" title="Satırı sil (Ctrl+Delete)" tabindex="-1">✕</button></td></tr>`;
  }

  function toplamCiz() {
    const t = toplamlar();
    // KDV oranlarına göre döküm ve toplam iskonto
    const oranlar = new Map(); let brut = 0;
    for (const s of satirlar) {
      const h = hesap(s); const o = Number(s.kdv_orani || 0);
      brut += r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0));
      const x = oranlar.get(o) || { matrah: 0, kdv: 0 }; x.matrah += h.net; x.kdv += h.kdv; oranlar.set(o, x);
    }
    const iskonto = r2(brut - t.ara);
    const mg = maliyetGoster();
    $('#toplam', el).innerHTML = String(html`
      <div class="fatura-yazi"><span class="soluk">Yalnız:</span> <b>${tutarYaziyla(t.genel)}</b>
        <div class="fatura-kdv-dokum">${[...oranlar.entries()].sort((a, b) => b[0] - a[0]).map(([o, x]) => html`<span>KDV %${o}: matrah ${paraSade(r2(x.matrah))} · KDV ${paraSade(r2(x.kdv))}</span>`)}</div>
        ${mg ? html`<div class="fatura-kar">Maliyet ${para(t.maliyet)} · Kâr <b class="${t.kar >= 0 ? 'pozitif' : 'negatif'}">${para(t.kar)}${t.ara > 0 ? ` (%${(t.kar * 100 / t.ara).toFixed(1).replace('.', ',')})` : ''}</b></div>` : ''}</div>
      <table class="fatura-toplam"><tbody>
        ${iskonto > 0.004 ? html`<tr><td>Brüt toplam</td><td>${para(brut)}</td></tr><tr><td>İskonto</td><td>−${para(iskonto)}</td></tr>` : ''}
        <tr><td>Ara toplam</td><td>${para(t.ara)}</td></tr>
        <tr><td>KDV</td><td>${para(t.kdv)}</td></tr>
        <tr class="genel"><td>Genel toplam</td><td>${para(t.genel)}</td></tr></tbody></table>`);
  }

  function baglaGirdiler() {
    const ci = $('#f-cari', el);
    if (ci) cariSecici(ci, (c) => { cari = c; ci.value = c.unvan; degisti = true; }, { yeniIzin: false });
    $$('.urun-ara', el).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      urunSecici(inp, (u) => {
        const s = satirlar[i];
        Object.assign(s, { tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_id: u.id, _kod: u.kod, aciklama: u.ad, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20), _tahmin: Number(u.ort_maliyet || 0), onay_bekliyor: u.onay_bekliyor });
        if (!Number(s.birim_fiyat) && u.onerilen_satis) Object.assign(s, fiyatAlanlari(u));
        if (s.id && s.urun_id !== u.id) s.birim_maliyet = 0;
        degisti = true; ciz();
        setTimeout(() => izgara?.odakla({ i, k: 'miktar' }), 30);
      }, { bulunamadi: true, iptal: () => { satirlar[i].aciklama = ''; ciz(); setTimeout(() => $(`tr[data-i="${i}"] .urun-ara`, el)?.focus(), 30); } });
    });
    const mgk = $('#maliyet-goster', el);
    if (mgk) mgk.onchange = () => { try { localStorage.setItem('fisMaliyet', mgk.checked ? '1' : '0'); } catch { /* */ } ciz(); };
    const kd = $('#kdv-dahil', el);
    if (kd) kd.onchange = () => { kdvDahil = kd.checked; try { localStorage.setItem('kdvDahil', kdvDahil ? '1' : '0'); } catch { /* */ } ciz(); };
  }

  // Başlık alanları duruma yazılır (satır eklenip ekran yeniden çizildiğinde kaybolmasın)
  const BASLIK = { 'f-tarih': 'tarih', 'f-vade': 'vade', 'f-aciklama': 'aciklama' };
  function baslikYaz(e) { const k = BASLIK[e.target.id]; if (k) { f[k] = e.target.value; degisti = true; } }
  el.addEventListener('change', baslikYaz);
  // Satır girdileri
  el.addEventListener('input', (e) => {
    const tr = e.target.closest('tr[data-i]');
    const k = e.target.dataset.k;
    if (!tr || !k) { baslikYaz(e); return; }
    const s = satirlar[Number(tr.dataset.i)];
    degisti = true;
    if (k === 'aciklama' || k === 'birim' || k === 'notu') { s[k] = e.target.value; return; }
    const v = sayiCoz(e.target.value) ?? 0;
    if (k === 'birim_fiyat') {
      s.birim_fiyat = kdvDahil ? r2(v / (1 + Number(s.kdv_orani) / 100)) : v;
      if (s.doviz) { s.doviz = null; s.doviz_fiyat = null; s.kur = null; $('.doviz-not', tr)?.remove(); }
    }
    else if (k === 'kdv_orani') { const dahil = gosterFiyat(s); s.kdv_orani = v; if (kdvDahil) s.birim_fiyat = r2(dahil / (1 + v / 100)); }
    else s[k] = v;
    const h = hesap(s);
    $('.s-tutar', tr).textContent = paraSade(h.net);
    const kar = r2(h.net - h.maliyet);
    $('.s-maliyet', tr).innerHTML = s.urun_id ? String(html`${paraSade(h.maliyet)}<small class="${kar >= 0 ? 'pozitif' : 'negatif'}">${paraSade(kar)}</small>`) : '';
    $('#kaydedilmedi', el) || $('.detay-ust .btn-grup', el)?.insertAdjacentHTML('beforeend', '<span class="rozet turuncu" id="kaydedilmedi">kaydedilmedi</span>');
    toplamCiz();
  });
  el.addEventListener('change', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (e.target.id === 'enter-yeni-satir') { try { localStorage.setItem('enterYeniSatir', e.target.checked ? '1' : '0'); } catch { /* */ } }
    void tr;
  });

  function govde() {
    return {
      cari_id: cari.id, tarih: $('#f-tarih', el)?.value, vade: $('#f-vade', el)?.value || null, aciklama: $('#f-aciklama', el)?.value,
      satirlar: satirlar.map((s) => ({ id: s.id, tip: s.tip, urun_id: s.urun_id, aciklama: s.aciklama, miktar: s.miktar, birim: s.birim,
        birim_fiyat: s.birim_fiyat, iskonto_orani: s.iskonto_orani, kdv_orani: s.kdv_orani, notu: s.notu, doviz: s.doviz, doviz_fiyat: s.doviz_fiyat, kur: s.kur })),
    };
  }
  async function kaydet() {
    // Boş satırlar atılır; yazılıp kart seçilmemiş satır kaydedilmez (her kalem stok kartlı)
    satirlar = satirlar.filter((s) => s.urun_id || stoksuzMu(s) || String(s.aciklama || '').trim());
    for (const s of satirlar) {
      if (stoksuzMu(s)) { if (!String(s.aciklama || '').trim()) throw new Error(`${STOKSUZ[s.tip]} satırının açıklamasını yazın.`); continue; }
      if (!s.urun_id) throw new Error(`"${s.aciklama}" bir stok kartına bağlı değil. Listeden seçin ya da kutudan çıkınca gelen soruda yeni kart açın.`);
    }
    f = await api.put(`/fisler/${f.id}`, govde());
    yukle(); degisti = false;
  }

  el.addEventListener('click', async (e) => {
    const ud = e.target.closest('[data-urun-degistir]');
    if (ud) {
      const s = satirlar[Number(ud.dataset.urunDegistir)];
      Object.assign(s, { urun_id: null, aciklama: '', _tahmin: 0, birim_maliyet: 0, onay_bekliyor: false });
      degisti = true; ciz();
      $(`tr[data-i="${ud.dataset.urunDegistir}"] .urun-ara`, el)?.focus();
      return;
    }
    const sil = e.target.closest('[data-sil]');
    if (sil) { satirlar.splice(Number(sil.dataset.sil), 1); degisti = true; return ciz(); }
    if (e.target.closest('[data-stok-listesi]')) {
      const { stokListesi } = await import('../bilesen.js');
      const sec = await stokListesi({ fiyat: 'satis' });
      if (!sec) return;
      for (const { urun: u, miktar: m } of sec) {
        const v = satirlar.find((x) => x.urun_id === u.id && x.stoktan_dus !== false);
        if (v) v.miktar = Number(v.miktar) + m;
        else {
          const yeni = { tip: 'urun', urun_id: u.id, aciklama: u.ad, miktar: m, birim: u.birim, ...fiyatAlanlari(u), iskonto_orani: 0, kdv_orani: Number(u.kdv_orani ?? 20), _tahmin: Number(u.ort_maliyet || 0), onay_bekliyor: u.onay_bekliyor, _kod: u.kod };
          // Boş ürün satırı varsa önce onu doldur
          const b = satirlar.findIndex((x) => x.tip === 'urun' && !x.urun_id && !String(x.aciklama || '').trim());
          if (b >= 0) satirlar[b] = yeni; else satirlar.push(yeni);
        }
      }
      degisti = true; bildir(`${sec.length} ürün eklendi.`, 'basari'); return ciz();
    }
    const ek = e.target.closest('[data-ekle]')?.dataset.ekle;
    if (ek) {
      if (ek === 'barkod') {
        const { barkodOku } = await import('../barkod.js');
        const b = await barkodOku();
        if (!b) return;
        try {
          const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
          const var_ = satirlar.find((s) => s.urun_id === u.id && s.stoktan_dus !== false);
          if (var_) var_.miktar = Number(var_.miktar) + 1;
          else satirlar.push({ tip: 'urun', urun_id: u.id, aciklama: u.ad, miktar: 1, birim: u.birim, ...fiyatAlanlari(u), iskonto_orani: 0, kdv_orani: Number(u.kdv_orani ?? 20), _tahmin: Number(u.ort_maliyet || 0), _kod: u.kod });
          bildir(`${u.ad} eklendi`, 'basari');
        } catch {
          // Barkod stokta yok: kart açılsın mı?
          const { urunBulunamadi } = await import('../bilesen.js');
          const u = await urunBulunamadi('', { barkod: b });
          if (!u) return;
          satirlar.push({ tip: u.tur === 'hizmet' ? 'hizmet' : 'urun', urun_id: u.id, aciklama: u.ad, miktar: 1, birim: u.birim, ...fiyatAlanlari(u), iskonto_orani: 0, kdv_orani: Number(u.kdv_orani ?? 20), _tahmin: Number(u.ort_maliyet || 0), _kod: u.kod });
        }
      } else if (STOKSUZ[ek]) {
        // Stoksuz işçilik / eğitim / hizmet satırı: sondaki boş ürün satırının yerine geçer
        const sonS = satirlar.at(-1);
        const y = bosSatir(ek);
        if (sonS && sonS.tip === 'urun' && !sonS.urun_id && !String(sonS.aciklama || '').trim()) satirlar[satirlar.length - 1] = y; else satirlar.push(y);
        degisti = true; ciz();
        const inp = $(`tr[data-i="${satirlar.length - 1}"] [data-k=aciklama]`, el);
        if (inp) { inp.focus(); inp.select(); }
        return;
      } else {
        const sonS = satirlar.at(-1);
        // Sonda boş ürün satırı varsa yenisini açmak yerine ona git
        if (!(sonS && !sonS.urun_id && !stoksuzMu(sonS) && !String(sonS.aciklama || '').trim())) satirlar.push(bosSatir());
      }
      degisti = true; ciz();
      izgara?.odakla({ i: satirlar.length - 1, k: ek === 'barkod' ? 'miktar' : 'aciklama' });
      return;
    }
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'kaydet') { await kaydet(); bildir('Fiş kaydedildi.', 'basari'); ciz(); }
      else if (a === 'sil') { degisti = false; if (await silOnay('satis_fisi', f.id)) ctx.kapatVeGit(f.is_id ? `is/${f.is_id}` : 'fisler'); }
      else if (a === 'kurguncelle') {
        ctx.kur = null;
        kur = await kurAl(ctx);
        if (!kur) throw new Error('Kur bilgisi alınamadı.');
        let n = 0;
        for (const s of satirlar) {
          const k = s.doviz && kurDegeri(kur, s.doviz);
          if (k && s.doviz_fiyat != null) { s.kur = k; s.birim_fiyat = r2(Number(s.doviz_fiyat) * k); n++; }
        }
        degisti = true; ciz(); bildir(`${n} satır güncel kurla hesaplandı. Kaydetmeyi unutmayın.`, 'basari');
      }
      else if (a === 'onayla') {
        await kaydet(); ciz();
        const t = toplamlar();
        if (!satirlar.length) throw new Error('Fişte satır yok.');
        const sifirFiyat = satirlar.filter((s) => !Number(s.birim_fiyat));
        if (!await onayla(html`${sifirFiyat.length ? html`<span style="color:var(--turuncu)"><b>${sifirFiyat.length} satırın fiyatı 0.</b></span><br>` : ''}
          <b>${esc(f.unvan)}</b> carisine <b>${para(t.genel)}</b> borç yazılacak. Onaylanan fiş değiştirilemez (sadece iptal edilebilir).`, { evet: 'Onayla' })) return;
        f = await api.post(`/fisler/${f.id}/onayla`);
        yukle(); bildir('Fiş onaylandı ve cariye işlendi.', 'basari'); ciz();
      } else if (a === 'iptal') {
        if (!await onayla(f.durum === 'taslak' ? 'Taslak fiş iptal edilsin mi?' : 'Fiş iptal edilecek: cari borcu ve stok hareketleri geri alınacak. Devam edilsin mi?', { evet: 'İptal et', tehlike: true })) return;
        f = await api.post(`/fisler/${f.id}/iptal`);
        yukle(); bildir('Fiş iptal edildi.'); ciz();
      } else if (a === 'yazdir') {
        if (degisti && f.durum === 'taslak') await kaydet();
        fisYazdir(ctx, f);
      } else if (a === 'tahsilat') {
        const c = await api.get(`/cariler/${f.cari_id}`);
        await finansPenceresi('tahsilat', { cari: c, tutar: Math.min(f.genel_toplam, Math.max(0, c.bakiye)) || f.genel_toplam });
      }
    } catch (err) { bildir(err.message, 'hata', 6000); }
  });

  // Kaydedilmemiş değişiklik uyarısı
  // (sayfa başka bir sekmedeyken de geçerli; sekme kapanınca dinleyici kalkar)
  el.kirliMi = () => degisti && f.durum === 'taslak';
  const ayrilma = (e) => { if (el.kapandi) { window.removeEventListener('beforeunload', ayrilma); return; } if (el.kirliMi()) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', ayrilma);

  // Üst çubuktaki "+ Satış fişi" ile yeni açıldıysa ilk kalem satırı hazır, imleç ürün kutusunda
  let ilkSatir = false;
  try { ilkSatir = sessionStorage.getItem('fis-ilk-satir') === String(f.id); sessionStorage.removeItem('fis-ilk-satir'); } catch { /* */ }
  if (ilkSatir && f.durum === 'taslak' && !satirlar.length) satirlar.push(bosSatir());
  ciz();
  if (ilkSatir) setTimeout(() => $('tr[data-i="0"] .urun-ara', el)?.focus(), 60);
  void tarih;
}
