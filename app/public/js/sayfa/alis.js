// Alış faturası girişi
import { api } from '../api.js';
import { izgaraBagla, KISAYOL_YARDIM } from '../izgara.js';
import { html, $, $$, para, paraSade, dovizPara, durumRozet, bildir, onayla, sayiCoz, sayiGiris, bugunStr, zaman, esc } from '../ui.js';
import { cariSecici, cariYeniYakala, urunSecici, urunYeniYakala, finansPenceresi, kurAl, kurDegeri, silOnay } from '../bilesen.js';
import { tutarYaziyla } from '../belgeler.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

export default async function (el, [id], ctx) {
  let a;
  if (id === 'yeni') {
    a = { id: null, durum: 'taslak', belge_no: '', tarih: bugunStr(), vade: '', aciklama: '', cari_id: null, unvan: '', satirlar: [] };
    if (ctx.sorgu.cari) { const c = await api.get(`/cariler/${ctx.sorgu.cari}`); Object.assign(a, { cari_id: c.id, unvan: c.unvan, cari_adres: c.adres, il: c.il, ilce: c.ilce, cari_telefon: c.telefon, vergi_dairesi: c.vergi_dairesi, vergi_no: c.vergi_no, cari_bakiye: c.bakiye }); }
  } else a = await api.get(`/alislar/${id}`);
  ctx.baslik(a.id ? `Alış ${a.belge_no}` : 'Yeni alış faturası');
  if (a.id) a.cari_bakiye = a.cari_bakiye ?? null;
  let satirlar = a.satirlar.map((s) => ({ ...s }));
  let cari = a.cari_id ? { id: a.cari_id, unvan: a.unvan } : null;
  let kdvDahil = false;
  a.doviz = a.doviz || 'TRY';
  const piyasa = a.durum === 'taslak' ? await kurAl(ctx) : null;
  if (a.doviz !== 'TRY' && !a.kur) a.kur = kurDegeri(piyasa, a.doviz);
  const dovizli = () => a.doviz !== 'TRY';
  // Satır fiyatı: dövizli faturada döviz tutarı girilir, TL fiyat kurla hesaplanır
  const girisFiyat = (s) => (dovizli() ? Number(s.doviz_fiyat || 0) : Number(s.birim_fiyat || 0));
  const fiyatYaz = (s, v) => { if (dovizli()) { s.doviz_fiyat = v; s.birim_fiyat = r4(v * Number(a.kur || 0)); } else { s.birim_fiyat = v; s.doviz_fiyat = null; } };
  // Ürünün TL maliyetinden ön değer
  const maliyettenFiyat = (s, tl) => { if (dovizli()) fiyatYaz(s, a.kur ? r4(tl / a.kur) : 0); else fiyatYaz(s, tl); };
  const kurHesapla = () => { for (const s of satirlar) if (dovizli()) s.birim_fiyat = r4(Number(s.doviz_fiyat || 0) * Number(a.kur || 0)); };

  const hesap = (s) => { const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0)); return { net, kdv: r2(net * Number(s.kdv_orani || 0) / 100) }; };
  const toplam = () => satirlar.reduce((t, s) => {
    const h = hesap(s); t.ara += h.net; t.kdv += h.kdv;
    const dn = r2(Number(s.miktar || 0) * Number(s.doviz_fiyat || 0)); t.dara += dn; t.dkdv += r2(dn * Number(s.kdv_orani || 0) / 100);
    return t;
  }, { ara: 0, kdv: 0, dara: 0, dkdv: 0 });

  // Excel gibi klavye ile gezinme (yeniden çizimde odak korunur)
  let izgara = null;
  function ciz() { const o = izgara?.odakNe(); cizIc(); if (o) izgara.odakla(o); }
  const enterYeniSatir = () => { try { return localStorage.getItem('enterYeniSatir') === '1'; } catch { return false; } };
  const bosSatir = () => ({ urun_id: null, ad: '', miktar: 1, birim_fiyat: 0, kdv_orani: 20 });
  izgara = izgaraBagla(el, {
    yeniSatir: () => { if (!enterYeniSatir()) return false; satirlar.push(bosSatir()); ciz(); return true; },
    satirSil: (i) => { satirlar.splice(i, 1); ciz(); },
    satirEkle: (i) => { satirlar.splice(i, 0, bosSatir()); ciz(); },
    kisayollar: {
      F4: () => $('[data-stok-listesi]', el)?.click(),
      'Ctrl+B': () => $('[data-barkod]', el)?.click(),
      'Ctrl+S': () => $('[data-a=kaydet]', el)?.click(),
    },
  });
  const dp = (n) => (dovizli() ? dovizPara(n, a.doviz) : para(n));
  function satirHtml(s, i, taslak) {
    const h = hesap(s);
    if (!taslak) {
      return html`<tr><td class="no">${i + 1}</td><td class="kod">${s.kod || ''}</td><td class="aciklama-hucre">${s.ad}</td>
        <td class="sayi" data-et="Miktar">${sayiGiris(s.miktar)}</td><td class="brm" data-et="Birim">${s.birim || ''}</td>
        <td class="sayi" data-et="Birim fiyat">${s.doviz_fiyat != null && dovizli() ? html`${dovizPara(s.doviz_fiyat, a.doviz)}<small class="doviz-not">${para(s.birim_fiyat)}</small>` : paraSade(s.birim_fiyat)}</td>
        <td class="sayi" data-et="KDV %">${Number(s.kdv_orani)}</td><td class="sayi tutar" data-et="Tutar"><b>${paraSade(s.tutar ?? h.net)}</b></td></tr>`;
    }
    return html`<tr data-i="${i}" class="${s.urun_id ? '' : 'eksik'}">
      <td class="no">${i + 1}</td>
      <td class="kod">${s.kod || ''}</td>
      <td class="aciklama-hucre">${s.urun_id
        ? html`<div class="urun-adi" title="Ürün adı stok kartından gelir"><b>${s.ad}</b> <button type="button" class="btn-metin degistir" data-urun-degistir="${i}" tabindex="-1">değiştir</button></div>`
        : html`<input class="urun-ara" data-k="ad" value="${s.ad || ''}" placeholder="Ürün ara… (ad, kod, model, barkod)">`}</td>
      <td data-et="Miktar"><input class="s-mik sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(s.miktar)}"></td>
      <td class="brm" data-et="Birim"><span class="brm-yazi">${s.birim || 'adet'}</span></td>
      <td data-et="Birim fiyat"><input class="s-fiyat sayi" data-k="birim_fiyat" inputmode="decimal" value="${sayiGiris(kdvDahil ? r2(girisFiyat(s) * (1 + s.kdv_orani / 100)) : girisFiyat(s))}" placeholder="0,00">${dovizli() ? html`<div class="doviz-not s-tl">${para(s.birim_fiyat)}</div>` : ''}</td>
      <td data-et="KDV %"><input class="s-kdv sayi" data-k="kdv_orani" inputmode="decimal" value="${sayiGiris(s.kdv_orani)}"></td>
      <td class="sayi tutar s-tutar" data-et="Tutar">${paraSade(h.net)}</td>
      <td class="sil"><button class="btn-ikon" data-sil="${i}" title="Satırı sil (Ctrl+Delete)" tabindex="-1">✕</button></td></tr>`;
  }

  function cizIc() {
    const taslak = a.durum === 'taslak';
    const bakiye = Number(a.cari_bakiye || 0);
    const yer = [a.ilce, a.il].filter(Boolean).join(' / ');
    el.innerHTML = String(html`
      <div class="detay-ust"><div style="flex:1;min-width:240px"><a href="#/alislar" class="btn-metin">← Alış faturaları</a>
        <div class="btn-grup"><h2>${a.id ? `Alış faturası ${a.belge_no}` : 'Yeni alış faturası'}</h2>${durumRozet(a.durum)}${a.ettn ? html`<span class="rozet mavi" title="ETTN ${a.ettn}">e-Fatura</span>` : ''}</div>
        ${a.onay_zamani ? html`<div class="soluk">Onay: ${zaman(a.onay_zamani)}</div>` : ''}</div>
        <div class="btn-grup">${taslak ? html`<button class="btn ikincil" data-a="kaydet" title="Ctrl+S">Kaydet</button><button class="btn basari" data-a="onayla">✓ Onayla (stoğa ve cariye işle)</button>` : ''}
          ${a.durum === 'onaylandi' ? html`<button class="btn ikincil" data-a="odeme">Ödeme yap</button><button class="btn tehlike-cizgi" data-a="iptal">Faturayı iptal et</button>` : ''}
          ${a.id ? html`<button class="btn tehlike-cizgi" data-a="sil" title="Sil (30 gün geri alınabilir)">🗑 Sil</button>` : ''}</div></div>
      ${a.durum === 'iptal' ? html`<div class="uyari-kutu">Bu fatura iptal edildi; stok ve cari etkileri geri alındı.</div>` : ''}

      <div class="fatura">
        <div class="fatura-ust">
          <div class="fatura-cari">
            <div class="fatura-etiket">Tedarikçi</div>
            ${taslak ? html`<input id="a-cari" class="fatura-unvan-giris" value="${cari?.unvan || ''}" placeholder="Tedarikçi ara…">` : html`<div class="fatura-unvan">${a.unvan}</div>`}
            ${a.cari_adres || yer ? html`<div>${a.cari_adres || ''} ${yer}</div>` : ''}
            ${a.vergi_dairesi || a.vergi_no ? html`<div>${a.vergi_dairesi ? `V.D.: ${a.vergi_dairesi}` : ''} ${a.vergi_no ? `V.N.: ${a.vergi_no}` : ''}</div>` : ''}
            ${a.cari_telefon ? html`<div>Tel: ${a.cari_telefon}</div>` : ''}
            ${cari?.id ? html`<div class="fatura-bakiye">${a.cari_bakiye != null ? html`Cari bakiye: <b class="${bakiye > 0.004 ? 'negatif' : bakiye < -0.004 ? 'pozitif' : ''}">${para(Math.abs(bakiye))} ${bakiye > 0.004 ? '(B)' : bakiye < -0.004 ? '(A)' : ''}</b> · ` : ''}<a href="#/cari/${cari.id}">Cari kartı →</a></div>` : ''}
          </div>
          <div class="fatura-belge">
            <label class="fb-satir"><span>Fatura no *</span><input id="a-no" value="${a.belge_no}" ${taslak ? '' : 'readonly'}></label>
            <label class="fb-satir"><span>Tarih</span><input type="date" id="a-tarih" value="${a.tarih}" ${taslak ? '' : 'readonly'}></label>
            <label class="fb-satir"><span>Vade</span><input type="date" id="a-vade" value="${a.vade || ''}" ${taslak ? '' : 'readonly'}></label>
            <div class="fb-satir"><span>Para birimi</span><div class="fiyat-doviz"><select id="a-doviz" ${taslak ? '' : 'disabled'}>${['TRY', 'USD', 'EUR'].map((d) => html`<option value="${d}" ${a.doviz === d ? 'selected' : ''}>${d === 'TRY' ? '₺ TL' : d}</option>`)}</select>
              ${dovizli() ? html`<input id="a-kur" inputmode="decimal" value="${a.kur ? sayiGiris(a.kur) : ''}" placeholder="Kur" title="1 ${a.doviz} = ? TL" ${taslak ? '' : 'readonly'} style="max-width:110px">` : ''}</div></div>
            ${dovizli() && taslak && kurDegeri(piyasa, a.doviz) ? html`<div class="fb-satir"><span></span><small>TCMB satış: <button type="button" class="btn-metin" style="color:var(--ana)" data-tcmb>${sayiGiris(kurDegeri(piyasa, a.doviz))}</button></small></div>` : ''}
            <label class="fb-satir"><span>Açıklama</span><input id="a-aciklama" value="${a.aciklama || ''}" ${taslak ? '' : 'readonly'}></label>
          </div>
        </div>

        <div class="fatura-arac">
          ${taslak ? html`<div class="btn-grup">
            <button class="btn ikincil kucuk" data-ekle>+ Satır</button>
            <button class="btn ikincil kucuk" data-stok-listesi title="F4">📦 Stok listesi</button>
            <button class="btn ikincil kucuk" data-barkod title="Ctrl+B">📷 Barkod</button>
            ${!a.id ? html`<a class="btn ikincil kucuk" href="#/efatura">📄 e-Fatura XML'den aktar</a>` : ''}</div>` : html`<span></span>`}
          <span class="bosluk"></span>
          ${taslak ? html`<label class="kutu-sec enter-yeni" style="margin:0" title="İşaretliyse son hücrede Enter yeni satır açar"><input type="checkbox" id="enter-yeni-satir" ${enterYeniSatir() ? 'checked' : ''}> Enter ile yeni satır aç</label>
            <label class="kutu-sec" style="margin:0"><input type="checkbox" id="kdv-dahil" ${kdvDahil ? 'checked' : ''}> Fiyatlar KDV dahil</label>` : ''}
        </div>

        <div class="fatura-tablo-kap"><table class="fatura-tablo" id="kalemler"><thead><tr>
          <th class="no">#</th><th class="kod">Kod</th><th>Ürün</th><th class="sayi mik">Miktar</th><th class="brm">Birim</th>
          <th class="sayi fiyat">Birim fiyat${dovizli() ? ` (${a.doviz})` : ''}${kdvDahil && taslak ? ' (KDV dahil)' : ''}</th><th class="sayi yuzde">KDV %</th><th class="sayi tutar">Tutar</th>
          ${taslak ? html`<th class="sil"></th>` : ''}</tr></thead>
          <tbody>${satirlar.map((s, i) => satirHtml(s, i, taslak))}
            ${!satirlar.length ? html`<tr class="bos-satir"><td colspan="9">${taslak ? html`Kalem yok. <b>+ Satır</b> ile başlayın, <b>F4</b> ile stok listesinden seçin ya da e-Fatura XML'den aktarın.` : 'Kalem yok.'}</td></tr>` : ''}</tbody>
        </table></div>
        ${taslak ? html`<div class="fatura-ipucu">⌨️ ${KISAYOL_YARDIM}</div>` : ''}
        <div class="fatura-alt" id="toplam"></div>
      </div>`);
    toplamCiz();
    if (!taslak) return;
    const ci = $('#a-cari', el);
    cariSecici(ci, (c) => {
      cari = c; ci.value = c.unvan;
      Object.assign(a, { cari_id: c.id, unvan: c.unvan, cari_adres: c.adres, il: c.il, ilce: c.ilce, cari_telefon: c.telefon, vergi_dairesi: c.vergi_dairesi, vergi_no: c.vergi_no, cari_bakiye: c.bakiye });
      ciz();
    }, { tip: 'tedarikci' });
    $$('.urun-ara', el).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      const sec = (u) => { Object.assign(satirlar[i], { urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20) }); if (!girisFiyat(satirlar[i]) && u.ort_maliyet) maliyettenFiyat(satirlar[i], Number(u.ort_maliyet)); ciz(); setTimeout(() => izgara?.odakla({ i, k: 'miktar' }), 30); };
      urunSecici(inp, sec, { yeniIzin: true, bulunamadi: true, iptal: () => { satirlar[i].ad = ''; ciz(); } });
      inp._sec = sec;
    });
    $('#enter-yeni-satir', el).onchange = (e) => { try { localStorage.setItem('enterYeniSatir', e.target.checked ? '1' : '0'); } catch { /* */ } };
    $('#kdv-dahil', el).onchange = (e) => { kdvDahil = e.target.checked; ciz(); };
    $('#a-doviz', el).onchange = (e) => {
      const eski = a.doviz; a.doviz = e.target.value;
      if (a.doviz === 'TRY') { a.kur = null; for (const s of satirlar) s.doviz_fiyat = null; }
      else {
        a.kur = kurDegeri(piyasa, a.doviz) || a.kur;
        // TL'den dövize geçerken mevcut TL fiyatlar kurla çevrilir
        for (const s of satirlar) { if (eski === 'TRY' || s.doviz_fiyat == null) s.doviz_fiyat = a.kur ? r4(Number(s.birim_fiyat || 0) / a.kur) : 0; }
        kurHesapla();
      }
      ciz();
    };
    const tc = $('[data-tcmb]', el);
    if (tc) tc.onclick = () => { a.kur = kurDegeri(piyasa, a.doviz); kurHesapla(); ciz(); };
  }
  function toplamCiz() {
    const t = toplam();
    const oranlar = new Map();
    for (const s of satirlar) { const h = hesap(s); const o = Number(s.kdv_orani || 0); const y = oranlar.get(o) || { matrah: 0, kdv: 0 }; y.matrah += h.net; y.kdv += h.kdv; oranlar.set(o, y); }
    const genel = r2(t.ara + t.kdv);
    $('#toplam', el).innerHTML = String(html`
      <div class="fatura-yazi"><span class="soluk">Yalnız:</span> <b>${tutarYaziyla(genel)}</b>
        <div class="fatura-kdv-dokum">${[...oranlar.entries()].sort((x, y) => y[0] - x[0]).map(([o, y]) => html`<span>KDV %${o}: matrah ${para(r2(y.matrah))} · KDV ${para(r2(y.kdv))}</span>`)}</div>
        ${dovizli() ? html`<div class="fatura-kar">Döviz toplamı (KDV dahil): <b>${dp(r2(t.dara + t.dkdv))}</b> · stok maliyeti ve cari TL tutarla işlenir</div>` : ''}</div>
      <table class="fatura-toplam"><tbody>
        <tr><td>Ara toplam</td><td>${para(r2(t.ara))}</td></tr>
        <tr><td>KDV</td><td>${para(r2(t.kdv))}</td></tr>
        <tr class="genel"><td>Genel toplam${dovizli() ? ' (TL)' : ''}</td><td>${para(genel)}</td></tr></tbody></table>`);
  }

  // Başlık alanlarını duruma yaz (satır eklenip ekran yeniden çizildiğinde kaybolmasın)
  const BASLIK = { 'a-no': 'belge_no', 'a-tarih': 'tarih', 'a-vade': 'vade', 'a-aciklama': 'aciklama' };
  const baslikYaz = (e) => {
    if (e.target.id === 'a-kur') {
      a.kur = sayiCoz(e.target.value); kurHesapla();
      $$('tr[data-i]', el).forEach((tr) => { const s = satirlar[Number(tr.dataset.i)]; $('.s-tutar', tr).textContent = paraSade(hesap(s).net); const t = $('.s-tl', tr); if (t) t.textContent = para(s.birim_fiyat); });
      toplamCiz(); return true;
    }
    const k = BASLIK[e.target.id]; if (k) a[k] = e.target.value; return !!k;
  };
  el.addEventListener('change', baslikYaz);
  el.addEventListener('input', (e) => {
    if (baslikYaz(e)) return;
    const tr = e.target.closest('tr[data-i]'); const k = e.target.dataset.k;
    if (!tr || !k || k === 'ad') return;
    const s = satirlar[Number(tr.dataset.i)];
    const v = sayiCoz(e.target.value) ?? 0;
    if (k === 'birim_fiyat') fiyatYaz(s, kdvDahil ? r4(v / (1 + s.kdv_orani / 100)) : v);
    else s[k] = v;
    const tl = $('.s-tl', tr); if (tl) tl.textContent = para(s.birim_fiyat);
    $('.s-tutar', tr).textContent = paraSade(hesap(s).net);
    toplamCiz();
  });

  async function kaydet() {
    if (!cari) throw new Error('Tedarikçi seçin.');
    const no = $('#a-no', el).value.trim();
    if (!no) throw new Error('Fatura numarası girin.');
    satirlar = satirlar.filter((s) => s.urun_id || String(s.ad || '').trim());
    const kartsiz = satirlar.find((s) => !s.urun_id);
    if (kartsiz) throw new Error(`"${kartsiz.ad}" bir stok kartına bağlı değil. Listeden seçin ya da yeni stok kartı açın.`);
    if (dovizli() && !(Number(a.kur) > 0)) throw new Error(`${a.doviz} kurunu girin.`);
    const govde = { doviz: a.doviz, kur: a.kur, cari_id: cari.id, belge_no: no, tarih: $('#a-tarih', el).value, vade: $('#a-vade', el).value || null, aciklama: $('#a-aciklama', el).value,
      satirlar: satirlar.map((s) => ({ urun_id: s.urun_id, miktar: s.miktar, birim_fiyat: s.birim_fiyat, doviz_fiyat: s.doviz_fiyat, kdv_orani: s.kdv_orani })) };
    a = a.id ? await api.put(`/alislar/${a.id}`, govde) : await api.post('/alislar', govde);
    satirlar = a.satirlar.map((s) => ({ ...s }));
    if (id === 'yeni') history.replaceState(null, '', `#/alis/${a.id}`);
  }

  el.addEventListener('click', async (e) => {
    const sil = e.target.closest('[data-sil]');
    if (sil) { satirlar.splice(Number(sil.dataset.sil), 1); return ciz(); }
    const ud = e.target.closest('[data-urun-degistir]');
    if (ud) { Object.assign(satirlar[Number(ud.dataset.urunDegistir)], { urun_id: null, ad: '', kod: '' }); ciz(); $(`tr[data-i="${ud.dataset.urunDegistir}"] .urun-ara`, el)?.focus(); return; }
    if (e.target.closest('[data-stok-listesi]')) {
      const { stokListesi } = await import('../bilesen.js');
      const sec = await stokListesi({ fiyat: 'maliyet' });
      if (!sec) return;
      for (const { urun: u, miktar: m } of sec) {
        const v = satirlar.find((x) => x.urun_id === u.id);
        if (v) { v.miktar = Number(v.miktar) + m; continue; }
        const yeni = { urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim, miktar: m, birim_fiyat: 0, kdv_orani: Number(u.kdv_orani ?? 20) }; maliyettenFiyat(yeni, Number(u.ort_maliyet || 0));
        const b = satirlar.findIndex((x) => !x.urun_id); if (b >= 0) satirlar[b] = yeni; else satirlar.push(yeni);
      }
      bildir(`${sec.length} ürün eklendi.`, 'basari'); return ciz();
    }
    if (e.target.closest('[data-ekle]')) { const son = satirlar.at(-1); if (!(son && !son.urun_id && !String(son.ad || '').trim())) satirlar.push(bosSatir()); ciz(); $$('.urun-ara', el).at(-1)?.focus(); return; }
    if (e.target.closest('[data-barkod]')) {
      const { barkodOku } = await import('../barkod.js');
      const b = await barkodOku(); if (!b) return;
      try {
        const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
        const v = satirlar.find((s) => s.urun_id === u.id);
        if (v) v.miktar = Number(v.miktar) + 1; else { const y = { urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim, miktar: 1, birim_fiyat: 0, kdv_orani: Number(u.kdv_orani ?? 20) }; maliyettenFiyat(y, Number(u.ort_maliyet || 0)); satirlar.push(y); }
        ciz();
      } catch (err) {
        if (err.kod === 'BARKOD_TANIMSIZ' || err.durum === 404) {
          const { urunBulunamadi } = await import('../bilesen.js');
          const u = await urunBulunamadi('', { barkod: b });
          if (u) { satirlar.push({ urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim || 'adet', miktar: 1, birim_fiyat: 0, kdv_orani: Number(u.kdv_orani ?? 20) }); ciz(); }
        } else if (err.kod !== 'BARKOD_TANIMSIZ') bildir(err.message, 'hata');
      }
      return;
    }
    const act = e.target.closest('[data-a]')?.dataset.a;
    if (!act) return;
    try {
      if (act === 'kaydet') { await kaydet(); bildir('Kaydedildi.', 'basari'); ciz(); }
      else if (act === 'sil') { if (await silOnay('alis_faturasi', a.id)) ctx.git('alislar'); }
      else if (act === 'onayla') {
        await kaydet(); ciz();
        if (!satirlar.length) throw new Error('Faturada ürün yok.');
        const t = toplam();
        if (!await onayla(html`Ürünler stoğa eklenecek, ortalama maliyetler güncellenecek ve <b>${esc(cari.unvan)}</b> carisine <b>${para(t.ara + t.kdv)}</b> alacak yazılacak.`, { evet: 'Onayla' })) return;
        a = await api.post(`/alislar/${a.id}/onayla`); satirlar = a.satirlar.map((s) => ({ ...s }));
        bildir('Fatura onaylandı, stok ve maliyetler güncellendi.', 'basari'); ciz();
      } else if (act === 'iptal') {
        if (!await onayla('Fatura iptal edilecek; stok, maliyet ve cari etkileri geri alınacak.', { evet: 'İptal et', tehlike: true })) return;
        a = await api.post(`/alislar/${a.id}/iptal`); bildir('İptal edildi.'); ciz();
      } else if (act === 'odeme') {
        const c = await api.get(`/cariler/${a.cari_id}`);
        await finansPenceresi('odeme', { cari: c, tutar: a.genel_toplam });
      }
    } catch (err) { bildir(err.message, 'hata', 6000); }
  });
  // Yeni cari / yeni ürün seçenekleri: dinleyiciler bir kez eklenir
  cariYeniYakala(el, (c) => { cari = c; const ci = $('#a-cari', el); if (ci) ci.value = c.unvan; }, { tip: 'tedarikci' });
  urunYeniYakala(el, (u) => {
    const bos = satirlar.findIndex((s) => !s.urun_id);
    const i = bos >= 0 ? bos : satirlar.push({ miktar: 1, birim_fiyat: 0, kdv_orani: 20 }) - 1;
    Object.assign(satirlar[i], { urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim || 'adet', kdv_orani: Number(u.kdv_orani ?? 20) });
    ciz();
  });
  ciz();
}
