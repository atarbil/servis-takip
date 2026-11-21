// Alış faturası girişi
import { api } from '../api.js';
import { html, $, $$, para, paraSade, durumRozet, bildir, onayla, sayiCoz, sayiGiris, bugunStr, zaman, esc } from '../ui.js';
import { cariSecici, cariYeniYakala, urunSecici, urunYeniYakala, finansPenceresi } from '../bilesen.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

export default async function (el, [id], ctx) {
  let a;
  if (id === 'yeni') {
    a = { id: null, durum: 'taslak', belge_no: '', tarih: bugunStr(), vade: '', aciklama: '', cari_id: null, unvan: '', satirlar: [] };
    if (ctx.sorgu.cari) { const c = await api.get(`/cariler/${ctx.sorgu.cari}`); a.cari_id = c.id; a.unvan = c.unvan; }
  } else a = await api.get(`/alislar/${id}`);
  ctx.baslik(a.id ? `Alış ${a.belge_no}` : 'Yeni alış faturası');
  let satirlar = a.satirlar.map((s) => ({ ...s }));
  let cari = a.cari_id ? { id: a.cari_id, unvan: a.unvan } : null;
  let kdvDahil = false;

  const hesap = (s) => { const net = r2(Number(s.miktar || 0) * Number(s.birim_fiyat || 0)); return { net, kdv: r2(net * Number(s.kdv_orani || 0) / 100) }; };
  const toplam = () => satirlar.reduce((t, s) => { const h = hesap(s); t.ara += h.net; t.kdv += h.kdv; return t; }, { ara: 0, kdv: 0 });

  function ciz() {
    const taslak = a.durum === 'taslak';
    el.innerHTML = String(html`
      <div class="detay-ust"><div style="flex:1;min-width:240px"><a href="#/alislar" class="btn-metin">← Alış faturaları</a>
        <div class="btn-grup"><h2>${a.id ? a.belge_no : 'Yeni alış faturası'}</h2>${durumRozet(a.durum)}</div>
        ${a.onay_zamani ? html`<div class="soluk">Onay: ${zaman(a.onay_zamani)}</div>` : ''}</div>
        <div class="btn-grup">${taslak ? html`<button class="btn ikincil" data-a="kaydet">Kaydet</button><button class="btn basari" data-a="onayla">✓ Onayla (stoğa ve cariye işle)</button>` : ''}
          ${a.durum === 'onaylandi' ? html`<button class="btn ikincil" data-a="odeme">Ödeme yap</button><button class="btn tehlike-cizgi" data-a="iptal">Faturayı iptal et</button>` : ''}
          ${taslak && a.id ? html`<button class="btn tehlike-cizgi" data-a="iptal">Taslağı sil</button>` : ''}</div></div>
      ${a.durum === 'iptal' ? html`<div class="uyari-kutu">Bu fatura iptal edildi; stok ve cari etkileri geri alındı.</div>` : ''}
      <div class="kart"><div class="kart-govde"><div class="satir2">
        <label class="alan"><span>Tedarikçi *</span><input id="a-cari" value="${cari?.unvan || ''}" placeholder="Ara…" ${taslak ? '' : 'readonly'}></label>
        <label class="alan"><span>Fatura no *</span><input id="a-no" value="${a.belge_no}" ${taslak ? '' : 'readonly'}></label>
        <label class="alan"><span>Fatura tarihi</span><input type="date" id="a-tarih" value="${a.tarih}" ${taslak ? '' : 'readonly'}></label>
        <label class="alan"><span>Vade</span><input type="date" id="a-vade" value="${a.vade || ''}" ${taslak ? '' : 'readonly'}></label></div>
        <label class="alan" style="margin:0"><span>Açıklama</span><input id="a-aciklama" value="${a.aciklama || ''}" ${taslak ? '' : 'readonly'}></label></div></div>
      <div class="kart"><div class="kart-ust"><h3>Ürünler</h3><span class="bosluk"></span>
        ${taslak ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="kdv-dahil" ${kdvDahil ? 'checked' : ''}> Fiyatları KDV dahil gir</label>` : ''}</div>
        <div class="tablo-kap fis-tablo-kap"><table class="tablo fis-satirlar"><thead><tr><th>Ürün</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat ${kdvDahil && taslak ? '(KDV dahil)' : '(KDV hariç)'}</th><th class="sayi">KDV%</th><th class="sayi">Tutar</th>${taslak ? html`<th></th>` : ''}</tr></thead>
        <tbody>${satirlar.map((s, i) => taslak ? html`<tr data-i="${i}">
            <td style="min-width:240px"><input class="urun-ara" data-k="ad" value="${s.ad || ''}" placeholder="Ürün ara veya yeni oluştur…">${!s.urun_id ? html`<small style="color:var(--turuncu)">listeden seçin</small>` : ''}</td>
            <td><input class="s-mik sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(s.miktar)}"></td>
            <td><input class="s-fiyat sayi" data-k="birim_fiyat" inputmode="decimal" value="${sayiGiris(kdvDahil ? r2(s.birim_fiyat * (1 + s.kdv_orani / 100)) : s.birim_fiyat)}"></td>
            <td><input class="s-kdv sayi" data-k="kdv_orani" inputmode="decimal" value="${sayiGiris(s.kdv_orani)}"></td>
            <td class="sayi s-tutar" style="vertical-align:middle">${paraSade(hesap(s).net)}</td><td><button class="btn-ikon" data-sil="${i}">✕</button></td></tr>`
          : html`<tr><td>${s.ad}${s.kod ? html`<div class="alt-satir">${s.kod}</div>` : ''}</td><td class="sayi">${sayiGiris(s.miktar)} ${s.birim}</td><td class="sayi">${paraSade(s.birim_fiyat)}</td><td class="sayi">${s.kdv_orani}</td><td class="sayi">${paraSade(s.tutar)}</td></tr>`)}
          ${!satirlar.length ? html`<tr><td colspan="6" class="bos-durum">Ürün ekleyin</td></tr>` : ''}</tbody></table></div>
        ${taslak ? html`<div class="kart-govde btn-grup" style="border-top:1px solid var(--cizgi2)"><button class="btn ikincil kucuk" data-ekle>+ Ürün satırı</button><button class="btn ikincil kucuk" data-barkod>📷 Barkodla ekle</button></div>` : ''}</div>
      <div class="kart"><div class="kart-govde"><div class="toplam-kutu" id="toplam"></div></div></div>`);
    toplamCiz();
    if (!taslak) return;
    const ci = $('#a-cari', el);
    cariSecici(ci, (c) => { cari = c; ci.value = c.unvan; }, { tip: 'tedarikci' });
    $$('.urun-ara', el).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      const sec = (u) => { Object.assign(satirlar[i], { urun_id: u.id, ad: u.ad, birim: u.birim, kdv_orani: Number(u.kdv_orani ?? 20) }); if (!satirlar[i].birim_fiyat && u.ort_maliyet) satirlar[i].birim_fiyat = Number(u.ort_maliyet); ciz(); setTimeout(() => $(`tr[data-i="${i}"] [data-k=miktar]`, el)?.select(), 30); };
      urunSecici(inp, sec, { yeniIzin: true });
      inp._sec = sec;
    });
    $('#kdv-dahil', el).onchange = (e) => { kdvDahil = e.target.checked; ciz(); };
  }
  function toplamCiz() {
    const t = toplam();
    $('#toplam', el).innerHTML = String(html`<div><span>Ara toplam (KDV hariç)</span><b>${para(t.ara)}</b></div><div><span>KDV</span><b>${para(t.kdv)}</b></div>
      <div class="genel"><span>Genel toplam</span><span>${para(t.ara + t.kdv)}</span></div>`);
  }

  // Başlık alanlarını duruma yaz (satır eklenip ekran yeniden çizildiğinde kaybolmasın)
  const BASLIK = { 'a-no': 'belge_no', 'a-tarih': 'tarih', 'a-vade': 'vade', 'a-aciklama': 'aciklama' };
  const baslikYaz = (e) => { const k = BASLIK[e.target.id]; if (k) a[k] = e.target.value; return !!k; };
  el.addEventListener('change', baslikYaz);
  el.addEventListener('input', (e) => {
    if (baslikYaz(e)) return;
    const tr = e.target.closest('tr[data-i]'); const k = e.target.dataset.k;
    if (!tr || !k || k === 'ad') return;
    const s = satirlar[Number(tr.dataset.i)];
    const v = sayiCoz(e.target.value) ?? 0;
    if (k === 'birim_fiyat') s.birim_fiyat = kdvDahil ? Math.round(v / (1 + s.kdv_orani / 100) * 10000) / 10000 : v;
    else s[k] = v;
    $('.s-tutar', tr).textContent = paraSade(hesap(s).net);
    toplamCiz();
  });

  async function kaydet() {
    if (!cari) throw new Error('Tedarikçi seçin.');
    const no = $('#a-no', el).value.trim();
    if (!no) throw new Error('Fatura numarası girin.');
    if (satirlar.some((s) => !s.urun_id)) throw new Error('Tüm satırlarda listeden ürün seçin.');
    const govde = { cari_id: cari.id, belge_no: no, tarih: $('#a-tarih', el).value, vade: $('#a-vade', el).value || null, aciklama: $('#a-aciklama', el).value,
      satirlar: satirlar.map((s) => ({ urun_id: s.urun_id, miktar: s.miktar, birim_fiyat: s.birim_fiyat, kdv_orani: s.kdv_orani })) };
    a = a.id ? await api.put(`/alislar/${a.id}`, govde) : await api.post('/alislar', govde);
    satirlar = a.satirlar.map((s) => ({ ...s }));
    if (id === 'yeni') history.replaceState(null, '', `#/alis/${a.id}`);
  }

  el.addEventListener('click', async (e) => {
    const sil = e.target.closest('[data-sil]');
    if (sil) { satirlar.splice(Number(sil.dataset.sil), 1); return ciz(); }
    if (e.target.closest('[data-ekle]')) { satirlar.push({ urun_id: null, ad: '', miktar: 1, birim_fiyat: 0, kdv_orani: 20 }); ciz(); $$('.urun-ara', el).at(-1)?.focus(); return; }
    if (e.target.closest('[data-barkod]')) {
      const { barkodOku } = await import('../barkod.js');
      const b = await barkodOku(); if (!b) return;
      try {
        const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
        const v = satirlar.find((s) => s.urun_id === u.id);
        if (v) v.miktar = Number(v.miktar) + 1; else satirlar.push({ urun_id: u.id, ad: u.ad, birim: u.birim, miktar: 1, birim_fiyat: Number(u.ort_maliyet || 0), kdv_orani: Number(u.kdv_orani ?? 20) });
        ciz();
      } catch (err) {
        if (err.kod === 'BARKOD_TANIMSIZ' && await onayla(`"${b}" barkodlu ürün tanımlı değil. Yeni ürün olarak oluşturulsun mu?`, { evet: 'Oluştur' })) {
          const { urunFormu } = await import('../bilesen.js');
          const u = await urunFormu(null, { barkodlar: [b] });
          if (u) { satirlar.push({ urun_id: u.id, ad: u.ad, birim: u.birim || 'adet', miktar: 1, birim_fiyat: 0, kdv_orani: Number(u.kdv_orani ?? 20) }); ciz(); }
        } else if (err.kod !== 'BARKOD_TANIMSIZ') bildir(err.message, 'hata');
      }
      return;
    }
    const act = e.target.closest('[data-a]')?.dataset.a;
    if (!act) return;
    try {
      if (act === 'kaydet') { await kaydet(); bildir('Kaydedildi.', 'basari'); ciz(); }
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
    Object.assign(satirlar[i], { urun_id: u.id, ad: u.ad, birim: u.birim || 'adet', kdv_orani: Number(u.kdv_orani ?? 20) });
    ciz();
  });
  ciz();
}
