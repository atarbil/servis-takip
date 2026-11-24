// e-Fatura XML'den alış faturası: dosya okunur, tedarikçi ve ürünler eşleştirilir, taslak alış faturası açılır.
// Yüklenen dosya sunucuda saklanmaz.
import { api } from '../api.js';
import { html, $, $$, para, paraSade, dovizPara, bildir, sayiCoz, sayiGiris } from '../ui.js';
import { cariSecici, urunSecici, kurAl, kurDegeri } from '../bilesen.js';

const NEDEN = { barkod: 'Barkod', hafiza: 'Daha önce eşleştirildi', kod: 'Ürün kodu', ad: 'Ad benzerliği' };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const tarihYaz = (t) => (t ? t.split('-').reverse().join('.') : '—');

function dosyaOku(f) {
  return new Promise((coz, reddet) => {
    const r = new FileReader();
    r.onload = () => coz({ ad: f.name, veri: String(r.result).replace(/^data:[^,]*,/, '') });
    r.onerror = () => reddet(new Error(`${f.name} okunamadı.`));
    r.readAsDataURL(f);
  });
}

export default async function (el, _p, ctx) {
  ctx.baslik('e-Fatura aktar');
  let faturalar = []; let hatalar = []; let secili = 0;
  const piyasa = await kurAl(ctx).catch(() => null);

  function hazirla(f) {
    f._durum = f.mukerrer ? 'mukerrer' : 'bekliyor';
    f._cari = f.cari ? { ...f.cari } : null; // null → yeni tedarikçi açılır
    if (f.doviz !== 'TRY' && !f.kur) f.kur = kurDegeri(piyasa, f.doviz) || null;
    for (const s of f.satirlar) {
      s._secim = s.oneri ? { tip: 'kart', urun: s.oneri } : { tip: 'yeni', ad: s.ad, tur: /hizmet|işçilik|iscilik|montaj|kurulum|servis|bakım/i.test(s.ad) && s.birim !== 'adet' ? 'hizmet' : 'urun' };
    }
    return f;
  }

  function ciz() {
    const f = faturalar[secili];
    el.innerHTML = String(html`
      <div class="detay-ust"><div style="flex:1;min-width:240px"><a href="#/alislar" class="btn-metin">← Alış faturaları</a>
        <h2>e-Fatura XML'den alış faturası</h2>
        <div class="soluk">Faturanın XML dosyasını (ya da GİB / entegratörden inen .zip'i) yükleyin. Dosya kaydedilmez; yalnız okunur ve taslak alış faturası açılır.</div></div></div>
      <label class="efatura-birak" id="birak">
        <input type="file" id="dosya" accept=".xml,.zip,application/xml,text/xml,application/zip" multiple hidden>
        <div class="efatura-birak-ic"><div class="efatura-ikon">📄</div>
          <b>XML / ZIP dosyalarını buraya bırakın</b><span class="soluk">ya da tıklayıp seçin · birden çok fatura seçilebilir</span></div>
      </label>
      ${hatalar.length ? html`<div class="uyari-kutu">${hatalar.map((h) => html`<div><b>${h.dosya}</b>: ${h.hata}</div>`)}</div>` : ''}
      ${faturalar.length > 1 ? html`<div class="efatura-sekmeler">${faturalar.map((x, i) => html`<button class="efatura-sekme ${i === secili ? 'secili' : ''} ${x._durum}" data-sekme="${i}">
          <b>${x.tedarikci?.unvan || '—'}</b><small>${x.no} · ${x.doviz === 'TRY' ? para(x.toplam.odenecek || x.toplam.genel) : dovizPara(x.toplam.odenecek || x.toplam.genel, x.doviz)}</small>
          <span class="efatura-durum">${x._durum === 'aktarildi' ? '✓ aktarıldı' : x._durum === 'mukerrer' ? 'daha önce girilmiş' : x._durum === 'atlandi' ? 'atlandı' : 'bekliyor'}</span></button>`)}</div>` : ''}
      ${f ? faturaHtml(f) : ''}`);
    bagla();
  }

  function satirHtml(s, i, kilitli) {
    const sc = s._secim;
    const kodlar = [s.satici_kodu && `Kod: ${s.satici_kodu}`, s.barkod && `Barkod: ${s.barkod}`, s.alici_kodu && s.alici_kodu !== s.satici_kodu && `Bizim kod: ${s.alici_kodu}`].filter(Boolean).join(' · ');
    let kart;
    if (sc.tip === 'kart') {
      const u = sc.urun; const zayif = u.neden === 'ad' && u.guven < 80;
      kart = html`<div class="ef-kart ${zayif ? 'zayif' : ''}"><div><b>${u.ad}</b> <small class="soluk">${[u.kod, u.tur === 'hizmet' ? 'hizmet' : `stok ${sayiGiris(u.stok ?? 0)} ${u.birim || ''}`].filter(Boolean).join(' · ')}</small></div>
        <div class="ef-kart-alt">${u.neden ? html`<span class="rozet ${zayif ? 'turuncu' : u.neden === 'ad' ? 'mavi' : 'yesil'}">${NEDEN[u.neden]}${u.neden === 'ad' ? ` %${u.guven}` : ''}</span>` : html`<span class="rozet yesil">Seçildi</span>`}
          ${kilitli ? '' : html`<button class="btn-metin" data-degistir="${i}">değiştir</button> · <button class="btn-metin" data-yeni="${i}">yeni kart aç</button>`}</div></div>`;
    } else if (sc.tip === 'yeni') {
      kart = html`<div class="ef-kart yeni"><div class="ef-yeni-ust"><span class="rozet turuncu">Yeni stok kartı</span>
          ${kilitli ? '' : html`<select data-tur="${i}"><option value="urun" ${sc.tur === 'urun' ? 'selected' : ''}>Ürün (stoklu)</option><option value="hizmet" ${sc.tur === 'hizmet' ? 'selected' : ''}>Hizmet</option></select>`}</div>
        <input data-yeni-ad="${i}" value="${sc.ad}" placeholder="Kart adı" ${kilitli ? 'readonly' : ''}>
        ${kilitli ? '' : html`<button class="btn-metin" data-degistir="${i}">mevcut karttan seç</button>`}</div>`;
    } else {
      kart = html`<div class="ef-kart"><input class="ef-urun-ara" data-ara="${i}" placeholder="Stok kartı ara…">
        <button class="btn-metin" data-yeni="${i}">yeni kart aç</button></div>`;
    }
    return html`<tr>
      <td class="no">${s.sira}</td>
      <td class="ef-fatura-urun"><b>${s.ad}</b>${kodlar ? html`<small>${kodlar}</small>` : ''}${s.not ? html`<small>${s.not}</small>` : ''}</td>
      <td class="sayi" data-et="Miktar">${sayiGiris(s.miktar)} ${s.birim}</td>
      <td class="sayi" data-et="Birim fiyat">${paraSade(s.birim_fiyat)}${s.iskonto_orani ? html`<small class="soluk">liste ${paraSade(s.liste_fiyat)} · isk. %${sayiGiris(s.iskonto_orani)}</small>` : ''}</td>
      <td class="sayi" data-et="KDV %">${sayiGiris(s.kdv_orani)}</td>
      <td class="sayi" data-et="Tutar"><b>${paraSade(s.tutar)}</b></td>
      <td class="ef-eslesme" data-et="Stok kartı">${kart}</td></tr>`;
  }

  function faturaHtml(f) {
    const t = f.tedarikci || {};
    const kilitli = f._durum !== 'bekliyor';
    const yer = [t.ilce, t.il].filter(Boolean).join(' / ');
    const dv = f.doviz;
    const tutar = (n) => (dv === 'TRY' ? para(n) : dovizPara(n, dv));
    const eslesmeyen = f.satirlar.filter((s) => s._secim.tip === 'ara').length;
    const yeniSay = f.satirlar.filter((s) => s._secim.tip === 'yeni').length;
    return html`
      ${f.mukerrer ? html`<div class="uyari-kutu hata-kutu">Bu fatura daha önce girilmiş: <a href="#/alis/${f.mukerrer.id}">${f.mukerrer.belge_no}</a> (${f.mukerrer.durum}). Tekrar aktarılamaz.</div>` : ''}
      ${f._durum === 'aktarildi' ? html`<div class="bilgi-kutu">✓ Taslak alış faturası açıldı: <a href="#/alis/${f._alisId}">${f.no}</a></div>` : ''}
      ${f.uyarilar.length ? html`<div class="uyari-kutu">${f.uyarilar.map((u) => html`<div>⚠ ${u}</div>`)}</div>` : ''}
      <div class="fatura">
        <div class="fatura-ust">
          <div class="fatura-cari">
            <div class="fatura-etiket">Tedarikçi (faturadan)</div>
            <div class="fatura-unvan">${t.unvan || '—'}</div>
            ${t.adres || yer ? html`<div>${t.adres || ''} ${yer}</div>` : ''}
            <div>${t.vergi_dairesi ? `V.D.: ${t.vergi_dairesi} ` : ''}${t.vkn ? `VKN: ${t.vkn}` : t.tckn ? `TCKN: ${t.tckn}` : ''}</div>
            ${t.telefon || t.eposta ? html`<div>${[t.telefon && `Tel: ${t.telefon}`, t.eposta].filter(Boolean).join(' · ')}</div>` : ''}
            <div class="ef-cari-eslesme">${f._cari
              ? html`<span class="rozet yesil">✓ Kayıtlı cari</span> <b>${f._cari.unvan}</b>${f._cari.bakiye != null ? html` <small class="soluk">bakiye ${para(Math.abs(Number(f._cari.bakiye)))}</small>` : ''}
                ${kilitli ? '' : html` · <button class="btn-metin" data-cari-degistir>başka cari seç</button> · <button class="btn-metin" data-cari-yeni>yeni tedarikçi aç</button>`}`
              : html`<span class="rozet turuncu">Kayıtlı değil</span> Fatura bilgileriyle <b>yeni tedarikçi</b> açılacak.
                ${kilitli ? '' : html`<div class="ef-cari-ara"><input id="ef-cari" placeholder="…ya da mevcut cariden seçin"></div>`}`}</div>
          </div>
          <div class="fatura-belge">
            <div class="fb-satir"><span>Fatura no</span><b>${f.no}</b></div>
            <div class="fb-satir"><span>Tarih</span><b>${tarihYaz(f.tarih)}</b></div>
            <div class="fb-satir"><span>Vade</span><b>${tarihYaz(f.vade)}</b></div>
            <div class="fb-satir"><span>Tür</span><b>${[f.profil, f.tip].filter(Boolean).join(' · ')}</b></div>
            <div class="fb-satir"><span>Para birimi</span><b>${dv === 'TRY' ? '₺ TL' : dv}</b></div>
            ${dv !== 'TRY' ? html`<label class="fb-satir"><span>Kur (1 ${dv} = ? TL) *</span><input id="ef-kur" inputmode="decimal" value="${f.kur ? sayiGiris(f.kur) : ''}" ${kilitli ? 'readonly' : ''}></label>` : ''}
            <div class="fb-satir"><span>ETTN</span><small class="soluk" style="word-break:break-all">${f.ettn || '—'}</small></div>
          </div>
        </div>
        <div class="fatura-tablo-kap"><table class="fatura-tablo ef-tablo"><thead><tr>
          <th class="no">#</th><th>Faturadaki ürün / hizmet</th><th class="sayi mik">Miktar</th><th class="sayi fiyat">Net birim fiyat${dv !== 'TRY' ? ` (${dv})` : ''}</th><th class="sayi yuzde">KDV %</th><th class="sayi tutar">Tutar</th><th class="ef-eslesme-th">Stok kartı</th>
          </tr></thead><tbody>${f.satirlar.map((s, i) => satirHtml(s, i, kilitli))}</tbody></table></div>
        <div class="fatura-alt">
          <div class="fatura-yazi">
            ${f.notlar.length ? html`<div class="soluk ef-not">${f.notlar.join(' · ')}</div>` : ''}
            ${eslesmeyen ? html`<div style="color:var(--turuncu)">${eslesmeyen} kalem için stok kartı seçin ya da yeni kart açın.</div>` : ''}
            ${yeniSay ? html`<div class="soluk">${yeniSay} kalem için yeni stok kartı açılacak.</div>` : ''}
            ${dv !== 'TRY' && f.kur ? html`<div class="fatura-kar">TL karşılığı: <b>${para(r2((f.toplam.genel || 0) * f.kur))}</b></div>` : ''}
          </div>
          <table class="fatura-toplam"><tbody>
            ${f.toplam.iskonto ? html`<tr><td>İskonto</td><td>−${tutar(f.toplam.iskonto)}</td></tr>` : ''}
            <tr><td>Ara toplam</td><td>${tutar(f.toplam.ara)}</td></tr>
            <tr><td>KDV</td><td>${tutar(f.toplam.kdv)}</td></tr>
            <tr class="genel"><td>Ödenecek</td><td>${tutar(f.toplam.odenecek || f.toplam.genel)}</td></tr></tbody></table>
        </div>
      </div>
      ${kilitli ? '' : html`<div class="btn-grup" style="justify-content:flex-end;margin-top:1rem">
        ${faturalar.length > 1 ? html`<button class="btn ikincil" data-atla>Bu faturayı atla</button>` : ''}
        <button class="btn birincil" data-olustur>Taslak alış faturası oluştur</button></div>`}`;
  }

  async function yukle(dosyalar) {
    if (!dosyalar.length) return;
    try {
      const veri = await Promise.all([...dosyalar].map(dosyaOku));
      bildir('Faturalar okunuyor…');
      const c = await api.post('/efatura/oku', { dosyalar: veri });
      faturalar = c.faturalar.map(hazirla); hatalar = c.hatalar; secili = Math.max(0, faturalar.findIndex((x) => x._durum === 'bekliyor'));
      if (!faturalar.length && !hatalar.length) bildir('Dosyada fatura bulunamadı.', 'hata');
      ciz();
    } catch (e) { bildir(e.message, 'hata', 6000); }
  }

  function sonraki() {
    const i = faturalar.findIndex((x) => x._durum === 'bekliyor');
    if (i >= 0) secili = i;
    ciz();
  }

  async function olustur(f) {
    const eksik = f.satirlar.find((s) => s._secim.tip === 'ara');
    if (eksik) throw new Error(`${eksik.sira}. kalem ("${eksik.ad}") için stok kartı seçin ya da yeni kart açın.`);
    const bosAd = f.satirlar.find((s) => s._secim.tip === 'yeni' && !String(s._secim.ad || '').trim());
    if (bosAd) throw new Error(`${bosAd.sira}. kalemin yeni kart adını yazın.`);
    if (f.doviz !== 'TRY' && !(Number(f.kur) > 0)) throw new Error(`${f.doviz} kurunu girin.`);
    const t = f.tedarikci || {};
    const g = await api.post('/efatura/kaydet', {
      fatura: { no: f.no, ettn: f.ettn, tarih: f.tarih, vade: f.vade, doviz: f.doviz, kur: f.kur },
      cari_id: f._cari?.id || null,
      yeni_cari: f._cari ? null : { unvan: t.unvan, vergi_no: t.vkn || t.tckn, vergi_dairesi: t.vergi_dairesi, adres: t.adres, il: t.il, ilce: t.ilce, telefon: t.telefon, eposta: t.eposta },
      satirlar: f.satirlar.map((s) => ({
        urun_id: s._secim.tip === 'kart' ? s._secim.urun.urun_id : null,
        yeni_urun: s._secim.tip === 'yeni' ? { ad: s._secim.ad, birim: s.birim, kdv_orani: s.kdv_orani, tur: s._secim.tur, barkod: s.barkod } : null,
        miktar: s.miktar, birim_fiyat: s.birim_fiyat, kdv_orani: s.kdv_orani, anahtar: s.anahtar,
      })),
    });
    f._durum = 'aktarildi'; f._alisId = g.id;
    return g.id;
  }

  function bagla() {
    const girdi = $('#dosya', el); const birak = $('#birak', el);
    girdi.onchange = () => { yukle(girdi.files); girdi.value = ''; };
    birak.ondragover = (e) => { e.preventDefault(); birak.classList.add('uzerinde'); };
    birak.ondragleave = () => birak.classList.remove('uzerinde');
    birak.ondrop = (e) => { e.preventDefault(); birak.classList.remove('uzerinde'); yukle(e.dataTransfer.files); };
    const f = faturalar[secili];
    if (!f || f._durum !== 'bekliyor') return;
    const ci = $('#ef-cari', el);
    if (ci) cariSecici(ci, (c) => { f._cari = c; ciz(); }, { tip: 'tedarikci', yeniIzin: false });
    $$('[data-ara]', el).forEach((inp) => {
      const s = f.satirlar[Number(inp.dataset.ara)];
      urunSecici(inp, (u) => { s._secim = { tip: 'kart', urun: { urun_id: u.id, ad: u.ad, kod: u.kod, birim: u.birim, tur: u.tur, stok: Number(u.stok_miktari ?? 0) } }; ciz(); }, { yeniIzin: false });
    });
    const kur = $('#ef-kur', el);
    if (kur) kur.oninput = () => { f.kur = sayiCoz(kur.value); };
    $$('[data-yeni-ad]', el).forEach((inp) => { inp.oninput = () => { f.satirlar[Number(inp.dataset.yeniAd)]._secim.ad = inp.value; }; });
    $$('[data-tur]', el).forEach((sel) => { sel.onchange = () => { f.satirlar[Number(sel.dataset.tur)]._secim.tur = sel.value; }; });
  }

  el.addEventListener('click', async (e) => {
    const sek = e.target.closest('[data-sekme]');
    if (sek) { secili = Number(sek.dataset.sekme); return ciz(); }
    const f = faturalar[secili]; if (!f) return;
    const d = e.target.closest('[data-degistir]');
    if (d) { f.satirlar[Number(d.dataset.degistir)]._secim = { tip: 'ara' }; ciz(); $(`[data-ara="${d.dataset.degistir}"]`, el)?.focus(); return; }
    const y = e.target.closest('[data-yeni]');
    if (y) { const s = f.satirlar[Number(y.dataset.yeni)]; s._secim = { tip: 'yeni', ad: s.ad, tur: 'urun' }; ciz(); $(`[data-yeni-ad="${y.dataset.yeni}"]`, el)?.select(); return; }
    if (e.target.closest('[data-cari-degistir]')) { f._cari = null; ciz(); $('#ef-cari', el)?.focus(); return; }
    if (e.target.closest('[data-cari-yeni]')) { f._cari = null; return ciz(); }
    if (e.target.closest('[data-atla]')) { f._durum = 'atlandi'; return sonraki(); }
    if (e.target.closest('[data-olustur]')) {
      const b = e.target.closest('[data-olustur]'); b.disabled = true;
      try {
        const id = await olustur(f);
        const kalan = faturalar.filter((x) => x._durum === 'bekliyor').length;
        if (!kalan && faturalar.filter((x) => x._durum === 'aktarildi').length === 1) { bildir('Taslak alış faturası açıldı. Kontrol edip onaylayın.', 'basari', 5000); ctx.git(`alis/${id}`); return; }
        bildir(`Taslak alış faturası açıldı (${f.no}).${kalan ? ` Sıradaki fatura: ${kalan} kaldı.` : ''}`, 'basari', 5000);
        sonraki();
      } catch (err) { b.disabled = false; bildir(err.message, 'hata', 7000); }
    }
  });

  // Program içi sekme: aktarılmayı bekleyen fatura varsa kapatırken sorulur
  el.kirliMi = () => faturalar.some((x) => x._durum === 'bekliyor');
  ciz();
}
