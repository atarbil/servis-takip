// Resmi fatura yükleme (tek ekran): yüklenen e-Fatura / e-Arşiv XML'lerinin yönünü program vergi numarasından ayırt eder.
//  * Satış (satıcı = firma): resmi fatura olarak kaydedilir, müşteriyle eşleştirilir (yalnız KDV için; bakiyeyi etkilemez).
//  * Alış (alıcı = firma): "Stoklu alış" → tedarikçi + ürün eşleştirme → taslak alış faturası;
//                          "Yalnız KDV (gider)" → stok / cari olmadan yalnız KDV kaydı.
// Yüklenen dosya saklanmaz.
import { api } from '../api.js';
import { html, $, $$, para, paraSade, dovizPara, bildir, sayiCoz, sayiGiris } from '../ui.js';
import { cariSecici, urunSecici, kurAl, kurDegeri } from '../bilesen.js';

const NEDEN = { barkod: 'Barkod', hafiza: 'Daha önce eşleştirildi', kod: 'Ürün kodu', model: 'Model kodu', ad: 'Ad benzerliği' };
// %85 ve üstü yeşil; %60–85 turuncu "kontrol edin"
const guvenRenk = (u) => (!['ad', 'model'].includes(u.neden) || u.guven >= 85 ? 'yesil' : 'turuncu');
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
  ctx.baslik('Resmi fatura yükleme');
  let faturalar = []; let hatalar = []; let secili = 0;
  let satisSonuc = null; let reddedilen = []; let islenenAcik = false; let gorunum = 'alis'; let vknIste = false; let bekleyenDosyalar = null;
  let giderTurleri = ['Akaryakıt', 'Telefon / internet', 'Kira', 'Kargo', 'Yemek', 'Elektrik / su / doğalgaz', 'Kırtasiye', 'Diğer'];
  const piyasa = await kurAl(ctx).catch(() => null);

  function hazirla(f) {
    f._durum = f.mukerrer ? 'mukerrer' : 'bekliyor';
    f._cari = f.cari ? { ...f.cari } : null; // null → yeni tedarikçi açılır
    f._tur = f.tercih?.secim === 'gider' ? 'gider' : 'stoklu';
    f._giderTuru = f.tercih?.gider_turu || '';
    if (f.doviz !== 'TRY' && !f.kur) f.kur = kurDegeri(piyasa, f.doviz) || null;
    for (const s of f.satirlar) {
      s._secim = s.oneri ? { tip: 'kart', urun: s.oneri } : { tip: 'yeni', ad: s.ad, tur: /hizmet|işçilik|iscilik|montaj|kurulum|servis|bakım/i.test(s.ad) && s.birim !== 'adet' ? 'hizmet' : 'urun' };
    }
    return f;
  }

  function ozetHtml() {
    if (!satisSonuc && !faturalar.length && !reddedilen.length) return '';
    const sat = satisSonuc?.eklenen || [];
    const eslesen = sat.filter((x) => x.cari).length;
    const bekleyen = faturalar.filter((x) => x._durum === 'bekliyor').length;
    const parca = [];
    if (sat.length) parca.push(html`<span><b>${sat.length}</b> satış faturası kaydedildi (${eslesen} cariyle eşleşti${sat.length - eslesen ? html`, <b>${sat.length - eslesen}</b> eşleşmeyen` : ''})</span>`);
    const islenen = faturalar.filter((x) => x._durum === 'aktarildi');
    const muk = faturalar.filter((x) => x._durum === 'mukerrer').length;
    if (faturalar.length) parca.push(html`<span><b>${faturalar.length}</b> alış faturası${bekleyen ? html` · <b>${bekleyen}</b> bekliyor` : ''}</span>`);
    if (islenen.length) {
      const st = islenen.filter((x) => x._tur !== 'gider').length;
      parca.push(html`<button class="btn-metin rf-islenen-ac" data-islenen-ac><b>${islenen.length}</b> fatura işlendi (${st} taslak alış, ${islenen.length - st} gider) ▾</button>`);
    }
    if (muk) parca.push(html`<span>${muk} alış faturası daha önce girilmiş</span>`);
    if (satisSonuc?.tekrar.length) parca.push(html`<span>${satisSonuc.tekrar.length} satış faturası daha önce yüklenmiş</span>`);
    if (reddedilen.length) parca.push(html`<span class="kirmizi-yazi">${reddedilen.length} fatura firmanıza ait değil, alınmadı</span>`);
    return html`<div class="rf-ozet">${parca.map((x, i) => html`${i ? html`<i>·</i>` : ''}${x}`)}</div>
      ${islenenAcik && islenen.length ? html`<div class="rf-islenen">${islenen.map((x) => html`<div class="${x._tur === 'gider' ? 'gider' : 'stoklu'}">
        ${x._tur === 'gider' ? html`<a href="#/resmi-faturalar?yon=alis&id=${x._giderId}">${x.no}</a> · ${x.tedarikci?.unvan || ''} <span class="rozet rf-gider-rozet">gider</span>`
          : html`<a href="#/alis/${x._alisId}">${x.no}</a> · ${x.tedarikci?.unvan || ''} <span class="rozet yesil">taslak alış</span>`}</div>`)}</div>` : ''}
      ${reddedilen.length ? html`<details class="kdv-hatalar"><summary>Alınmayan faturalar</summary>${reddedilen.map((x) => html`<div><b>${x.no}</b> ${x.satici} — ${x.neden}</div>`)}</details>` : ''}
      <div class="rf-gorunum">
        <button class="${gorunum === 'alis' ? 'aktif' : ''}" data-gorunum="alis">Alış faturaları <b>${faturalar.length}</b></button>
        <button class="${gorunum === 'satis' ? 'aktif' : ''}" data-gorunum="satis">Satış faturaları <b>${sat.length}</b>${sat.length - eslesen ? html` <span class="rozet turuncu">${sat.length - eslesen} eşleşmeyen</span>` : ''}</button>
        <span class="bosluk"></span><span class="rf-renk"><i class="stoklu"></i>Stoklu <i class="gider"></i>Stoksuz / gider</span>
      </div>`;
  }

  function satisHtml() {
    const sat = satisSonuc?.eklenen || [];
    if (!sat.length) return html`<div class="bos-durum">Bu yüklemede satış faturası yok.</div>`;
    const sirali = [...sat.filter((x) => !x.cari), ...sat.filter((x) => x.cari)];
    return html`<div class="kart"><table class="tablo rf-satis"><thead><tr><th>Tarih</th><th>Fatura no</th><th>Müşteri (faturadan)</th><th>Cari</th></tr></thead>
      <tbody>${sirali.map((x) => html`<tr class="${x.cari ? 'rf-bagli' : ''}">
        <td>${tarihYaz(x.tarih)}</td><td><a href="#/resmi-faturalar?id=${x.id}">${x.no}</a>${x.tip && x.tip !== 'SATIS' ? html` <span class="rozet">${x.tip}</span>` : ''}</td><td>${x.musteri}</td>
        <td>${x.cari ? html`<a href="#/cari/${x.cari.id}?sekme=resmi">✓ ${x.cari.unvan}</a>`
          : html`<div class="rf-bagla"><input data-satis-cari="${x.id}" placeholder="Cari ara ve bağla…"><button class="btn ikincil kucuk" data-satis-yeni="${x.id}">Yeni cari aç</button></div>`}</td></tr>`)}</tbody></table>
      <p class="soluk" style="padding:0 1rem .8rem;font-size:.8rem">Satış faturaları yalnız KDV durumunda kullanılır; cari bakiyesini, stoğu ve satış fişlerini etkilemez.</p></div>`;
  }

  const gorunur = () => faturalar.map((x, i) => ({ x, i })).filter(({ x }) => x._durum === 'bekliyor' || x._durum === 'atlandi');
  function ciz() {
    // Yeniden çizimde kaydırma yeri korunur (işlem yapılan satır yerinde kalsın)
    const kaydirma = window.scrollY;
    const f = faturalar[secili];
    el.innerHTML = String(html`
      <div class="detay-ust"><div style="flex:1;min-width:240px">
        <h2>Resmi fatura yükleme</h2>
        <div class="soluk">Kestiğiniz ve size gelen e-Fatura / e-Arşiv XML'lerini (ya da .zip) karışık yükleyin; alış mı satış mı olduğunu program vergi numarasından ayırır. Dosyalar kaydedilmez.</div></div>
        <div class="btn-grup"><a class="btn ikincil" href="#/resmi-faturalar">Resmi faturalar</a><a class="btn ikincil" href="#/kdv">KDV durumu</a></div></div>
      ${vknIste ? html`<div class="uyari-kutu rf-vkn"><b>Firmanızın vergi numarası gerekli.</b> Faturanın alış mı satış mı olduğu buna göre ayırt edilir.
        <div class="btn-grup" style="margin-top:.5rem"><input id="rf-vkn" inputmode="numeric" placeholder="Vergi no (10 hane) / TCKN (11 hane)" maxlength="11"><button class="btn birincil" data-vkn-kaydet>Kaydet ve devam et</button></div></div>` : ''}
      <label class="efatura-birak" id="birak">
        <input type="file" id="dosya" accept=".xml,.zip,application/xml,text/xml,application/zip" multiple hidden>
        <div class="efatura-birak-ic"><div class="efatura-ikon">📄</div>
          <b>XML / ZIP dosyalarını buraya bırakın</b><span class="soluk">ya da tıklayıp seçin · alış ve satış faturaları birlikte olabilir</span></div>
      </label>
      ${hatalar.length ? html`<div class="uyari-kutu">${hatalar.map((h) => html`<div><b>${h.dosya}</b>: ${h.hata}</div>`)}</div>` : ''}
      ${ozetHtml()}
      ${gorunum === 'satis' && satisSonuc ? satisHtml() : html`
      ${gorunur().length > 1 ? html`<div class="efatura-sekmeler">${gorunur().map(({ x, i }) => html`<button class="efatura-sekme ${i === secili ? 'secili' : ''} ${x._durum} tur-${x._tur}" data-sekme="${i}">
          <b>${x.tedarikci?.unvan || '—'}</b><small>${x.no} · ${x.doviz === 'TRY' ? para(x.toplam.odenecek || x.toplam.genel) : dovizPara(x.toplam.odenecek || x.toplam.genel, x.doviz)}</small>
          <span class="efatura-durum">${x._durum === 'aktarildi' ? (x._tur === 'gider' ? '✓ gider kaydedildi' : '✓ aktarıldı') : x._durum === 'mukerrer' ? 'daha önce girilmiş' : x._durum === 'atlandi' ? 'atlandı' : x._tur === 'gider' ? 'bekliyor · gider' : 'bekliyor · stoklu'}</span></button>`)}</div>` : ''}
      ${f && ['bekliyor', 'atlandi'].includes(f._durum) ? faturaHtml(f)
        : faturalar.length && !gorunur().length ? html`<div class="bilgi-kutu rf-bitti"><b>✓ Tüm alış faturaları işlendi.</b>
            <div class="btn-grup" style="margin-top:.5rem"><a class="btn ikincil kucuk" href="#/alislar">Alış faturaları</a><a class="btn ikincil kucuk" href="#/resmi-faturalar">Resmi faturalar</a><a class="btn ikincil kucuk" href="#/kdv">KDV durumu</a></div></div>` : ''}`}`);
    bagla();
    window.scrollTo(0, kaydirma);
  }

  function satirHtml(s, i, kilitli, gider) {
    const sc = s._secim;
    const kodlar = [s.satici_kodu && `Kod: ${s.satici_kodu}`, s.barkod && `Barkod: ${s.barkod}`, s.alici_kodu && s.alici_kodu !== s.satici_kodu && `Bizim kod: ${s.alici_kodu}`].filter(Boolean).join(' · ');
    let kart;
    if (sc.tip === 'kart') {
      const u = sc.urun; const zayif = guvenRenk(u) === 'turuncu';
      kart = html`<div class="ef-kart ${zayif ? 'zayif' : ''}"><div><b>${u.ad}</b> <small class="soluk">${[u.kod, u.tur === 'hizmet' ? 'hizmet' : `stok ${sayiGiris(u.stok ?? 0)} ${u.birim || ''}`].filter(Boolean).join(' · ')}</small></div>
        <div class="ef-kart-alt">${u.neden ? html`<span class="rozet ${guvenRenk(u)}">${NEDEN[u.neden]}${['ad', 'model'].includes(u.neden) ? ` %${u.guven}` : ''}${zayif ? ' · kontrol edin' : ''}</span>` : html`<span class="rozet yesil">Seçildi</span>`}
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
    // Diğer öneriler: tek tıkla seç
    const secili = sc.tip === 'kart' ? sc.urun.urun_id : null;
    const digerleri = (s.adaylar || []).filter((a) => a.urun_id !== secili).slice(0, 3);
    if (!kilitli && digerleri.length) {
      kart = html`${kart}<div class="ef-adaylar"><small>${sc.tip === 'kart' ? 'Diğer öneriler' : 'Öneriler'}:</small>
        ${digerleri.map((a, j) => html`<button type="button" class="ef-aday ${a.guven >= 85 ? 'yesil' : a.guven >= 60 ? 'turuncu' : ''}" data-aday="${i}:${j}" title="${a.kod || ''}">${a.ad} <b>%${a.guven}</b></button>`)}</div>`;
    }
    return html`<tr data-satir="${i}">
      <td class="no">${s.sira}</td>
      <td class="ef-fatura-urun"><b>${s.ad}</b>${kodlar ? html`<small>${kodlar}</small>` : ''}${s.not ? html`<small>${s.not}</small>` : ''}</td>
      <td class="sayi" data-et="Miktar">${sayiGiris(s.miktar)} ${s.birim}</td>
      <td class="sayi" data-et="Birim fiyat">${paraSade(s.birim_fiyat)}${s.iskonto_orani ? html`<small class="soluk">liste ${paraSade(s.liste_fiyat)} · isk. %${sayiGiris(s.iskonto_orani)}</small>` : ''}</td>
      <td class="sayi" data-et="KDV %">${sayiGiris(s.kdv_orani)}</td>
      <td class="sayi" data-et="Tutar"><b>${paraSade(s.tutar)}</b></td>
      ${gider ? '' : html`<td class="ef-eslesme" data-et="Stok kartı">${kart}</td>`}</tr>`;
  }

  function faturaHtml(f) {
    const t = f.tedarikci || {};
    const kilitli = !['bekliyor', 'atlandi'].includes(f._durum);
    const yer = [t.ilce, t.il].filter(Boolean).join(' / ');
    const dv = f.doviz;
    const tutar = (n) => (dv === 'TRY' ? para(n) : dovizPara(n, dv));
    const gider = f._tur === 'gider';
    const eslesmeyen = gider ? 0 : f.satirlar.filter((s) => s._secim.tip === 'ara').length;
    const yeniSay = gider ? 0 : f.satirlar.filter((s) => s._secim.tip === 'yeni').length;
    return html`
      <div class="rf-tur ${kilitli ? 'kilitli' : ''}">
        <button class="rf-tur-dugme stoklu ${!gider ? 'secili' : ''}" data-tur-sec="stoklu" ${kilitli ? 'disabled' : ''}><b>📦 Stoklu alış</b><small>Ürünler stoğa, tutar cariye işlenir (taslak alış faturası)</small></button>
        <button class="rf-tur-dugme gider ${gider ? 'secili' : ''}" data-tur-sec="gider" ${kilitli ? 'disabled' : ''}><b>🧾 Yalnız KDV – gider</b><small>Stoğa ve cariye işlenmez; yalnız KDV hesabına girer</small></button>
      </div>
      ${f.mukerrer ? html`<div class="uyari-kutu hata-kutu">Bu fatura daha önce girilmiş: ${f.mukerrer.resmi ? html`<a href="#/resmi-faturalar?yon=alis&id=${f.mukerrer.id}">${f.mukerrer.belge_no}</a> (yalnız KDV / gider)` : html`<a href="#/alis/${f.mukerrer.id}">${f.mukerrer.belge_no}</a> (${f.mukerrer.durum})`}. Tekrar aktarılamaz.</div>` : ''}
      ${f._durum === 'aktarildi' ? (f._tur === 'gider' ? html`<div class="bilgi-kutu">✓ Yalnız KDV (gider) olarak kaydedildi: <a href="#/resmi-faturalar?yon=alis&id=${f._giderId}">${f.no}</a></div>`
        : html`<div class="bilgi-kutu">✓ Taslak alış faturası açıldı: <a href="#/alis/${f._alisId}">${f.no}</a></div>`) : ''}
      ${f.uyarilar.length ? html`<div class="uyari-kutu">${f.uyarilar.map((u) => html`<div>⚠ ${u}</div>`)}</div>` : ''}
      <div class="fatura ${gider ? 'rf-gider' : 'rf-stoklu'}">
        <div class="fatura-ust">
          <div class="fatura-cari">
            <div class="fatura-etiket">Tedarikçi (faturadan)</div>
            <div class="fatura-unvan">${t.unvan || '—'}</div>
            ${t.adres || yer ? html`<div>${t.adres || ''} ${yer}</div>` : ''}
            <div>${t.vergi_dairesi ? `V.D.: ${t.vergi_dairesi} ` : ''}${t.vkn ? `VKN: ${t.vkn}` : t.tckn ? `TCKN: ${t.tckn}` : ''}</div>
            ${t.telefon || t.eposta ? html`<div>${[t.telefon && `Tel: ${t.telefon}`, t.eposta].filter(Boolean).join(' · ')}</div>` : ''}
            ${gider ? html`<div class="ef-cari-eslesme"><span class="rozet rf-gider-rozet">Gider</span> Cari açılmaz, bakiye oluşmaz.
              ${kilitli ? '' : html`<label class="rf-gider-turu">Gider türü <select id="rf-gider-turu"><option value="">—</option>${giderTurleri.map((g) => html`<option ${f._giderTuru === g ? 'selected' : ''}>${g}</option>`)}</select></label>`}</div>`
            : html`<div class="ef-cari-eslesme">${f._cari
              ? html`<span class="rozet yesil">✓ Kayıtlı cari</span> <b>${f._cari.unvan}</b>${f._cari.bakiye != null ? html` <small class="soluk">bakiye ${para(Math.abs(Number(f._cari.bakiye)))}</small>` : ''}
                ${kilitli ? '' : html` · <button class="btn-metin" data-cari-degistir>başka cari seç</button> · <button class="btn-metin" data-cari-yeni>yeni tedarikçi aç</button>`}`
              : html`<span class="rozet turuncu">Kayıtlı değil</span> Fatura bilgileriyle <b>yeni tedarikçi</b> açılacak.
                ${kilitli ? '' : html`<div class="ef-cari-ara"><input id="ef-cari" placeholder="…ya da mevcut cariden seçin"></div>`}`}</div>`}
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
          <th class="no">#</th><th>Faturadaki ürün / hizmet</th><th class="sayi mik">Miktar</th><th class="sayi fiyat">Net birim fiyat${dv !== 'TRY' ? ` (${dv})` : ''}</th><th class="sayi yuzde">KDV %</th><th class="sayi tutar">Tutar</th>${gider ? '' : html`<th class="ef-eslesme-th">Stok kartı</th>`}
          </tr></thead><tbody>${f.satirlar.map((s, i) => satirHtml(s, i, kilitli, gider))}</tbody></table></div>
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
        ${gider ? html`<button class="btn rf-gider-btn" data-gider-kaydet>Yalnız KDV olarak kaydet</button>` : html`<button class="btn basari" data-olustur>Taslak alış faturası oluştur</button>`}</div>`}`;
  }

  async function yukle(dosyalar) {
    if (!dosyalar.length) return;
    try { await yukleVeri(await Promise.all([...dosyalar].map(dosyaOku))); } catch (e) { bildir(e.message, 'hata', 6000); }
  }
  async function yukleVeri(veri) {
    try {
      bekleyenDosyalar = veri;
      bildir('Faturalar okunuyor…');
      const c = await api.post('/resmi/yukle', { dosyalar: veri });
      bekleyenDosyalar = null; vknIste = false;
      faturalar = c.alis.map(hazirla); hatalar = c.hatalar; satisSonuc = c.satis; reddedilen = c.reddedilen;
      if (c.gider_turleri) giderTurleri = c.gider_turleri;
      secili = Math.max(0, faturalar.findIndex((x) => x._durum === 'bekliyor'));
      gorunum = faturalar.some((x) => x._durum === 'bekliyor') || !c.satis.eklenen.length ? 'alis' : 'satis';
      if (!faturalar.length && !c.satis.eklenen.length && !c.satis.tekrar.length && !hatalar.length && !reddedilen.length) bildir('Dosyada fatura bulunamadı.', 'hata');
      ciz();
    } catch (e) {
      if (e.kod === 'FIRMA_VKN_YOK') { vknIste = true; ciz(); $('#rf-vkn', el)?.focus(); return; }
      bildir(e.message, 'hata', 6000);
    }
  }

  function sonraki() {
    let i = faturalar.findIndex((x) => x._durum === 'bekliyor');
    if (i < 0) i = faturalar.findIndex((x) => x._durum === 'atlandi');
    secili = i >= 0 ? i : 0;
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
        miktar: s.miktar, birim_fiyat: s.birim_fiyat, kdv_orani: s.kdv_orani, anahtar: s.anahtar, barkod: s.barkod, modeller: s.modeller,
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
    $$('[data-satis-cari]', el).forEach((inp) => {
      cariSecici(inp, async (c) => { try { await satisCari(Number(inp.dataset.satisCari), { cari_id: c.id }); } catch (err) { bildir(err.message, 'hata'); } }, { yeniIzin: false });
    });
    const f = faturalar[secili];
    if (!f || !['bekliyor', 'atlandi'].includes(f._durum)) return;
    const gt = $('#rf-gider-turu', el);
    if (gt) gt.onchange = () => { f._giderTuru = gt.value; };
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

  async function satisCari(id, govde) {
    const r = await api.put(`/resmi/${id}/cari`, govde);
    const c = r.cari_id ? await api.get(`/cariler/${r.cari_id}`) : null;
    const x = satisSonuc.eklenen.find((q) => q.id === id);
    for (const q of satisSonuc.eklenen) if (q === x || (r.digerleri && !q.cari && x.vkn && q.vkn === x.vkn)) q.cari = c ? { id: c.id, unvan: c.unvan } : null;
    bildir(`Cariye bağlandı${r.digerleri ? ` (aynı vergi no'lu ${r.digerleri} fatura daha)` : ''}.`, 'basari');
    ciz();
  }

  el.addEventListener('click', async (e) => {
    const sek = e.target.closest('[data-sekme]');
    if (sek) { secili = Number(sek.dataset.sekme); return ciz(); }
    if (e.target.closest('[data-islenen-ac]')) { islenenAcik = !islenenAcik; return ciz(); }
    const gr = e.target.closest('[data-gorunum]');
    if (gr) { gorunum = gr.dataset.gorunum; return ciz(); }
    if (e.target.closest('[data-vkn-kaydet]')) {
      const v = String($('#rf-vkn', el).value || '').replace(/\D/g, '');
      if (v.length !== 10 && v.length !== 11) { bildir('Vergi no 10, TCKN 11 haneli olmalı.', 'hata'); return; }
      try { await api.put('/ayarlar', { firma_vergi_no: v }); ctx.ayarlar.firma_vergi_no = v; vknIste = false; if (bekleyenDosyalar) await yukleVeri(bekleyenDosyalar); else ciz(); } catch (err) { bildir(err.message, 'hata'); }
      return;
    }
    const sy = e.target.closest('[data-satis-yeni]');
    if (sy) { try { await satisCari(Number(sy.dataset.satisYeni), { yeni_cari: true }); } catch (err) { bildir(err.message, 'hata'); } return; }
    const f = faturalar[secili]; if (!f) return;
    const ts = e.target.closest('[data-tur-sec]');
    if (ts && ['bekliyor', 'atlandi'].includes(f._durum)) { f._tur = ts.dataset.turSec; return ciz(); }
    const gk = e.target.closest('[data-gider-kaydet]');
    if (gk) {
      gk.disabled = true;
      try {
        if (f.doviz !== 'TRY' && !(Number(f.kur) > 0)) throw new Error(`${f.doviz} kurunu girin.`);
        const g = await api.post('/resmi/gider', { fatura: { no: f.no, ettn: f.ettn, tarih: f.tarih, tip: f.tip, profil: f.profil, doviz: f.doviz, kur: f.kur,
          tedarikci: f.tedarikci, kdvDokum: f.kdvDokum, tevkifat: f.tevkifat, satirlar: f.satirlar.map(({ _secim, oneri, ...x }) => x) }, gider_turu: f._giderTuru });
        f._durum = 'aktarildi'; f._giderId = g.id;
        const kalan = faturalar.filter((x) => x._durum === 'bekliyor').length;
        bildir(`Yalnız KDV (gider) olarak kaydedildi (${f.no}).${kalan ? ` Sıradaki fatura: ${kalan} kaldı.` : ''}`, 'basari', 5000);
        sonraki();
      } catch (err) { gk.disabled = false; bildir(err.message, 'hata', 7000); }
      return;
    }
    const d = e.target.closest('[data-degistir]');
    if (d) { f.satirlar[Number(d.dataset.degistir)]._secim = { tip: 'ara' }; ciz(); $(`[data-ara="${d.dataset.degistir}"]`, el)?.focus({ preventScroll: true }); return; }
    const ad = e.target.closest('[data-aday]');
    if (ad) {
      const [i, j] = ad.dataset.aday.split(':').map(Number); const s = f.satirlar[i];
      const sc = s._secim; const secili = sc.tip === 'kart' ? sc.urun.urun_id : null;
      const a = (s.adaylar || []).filter((q) => q.urun_id !== secili)[j];
      if (a) { s._secim = { tip: 'kart', urun: { ...a, neden: null } }; ciz(); }
      return;
    }
    const y = e.target.closest('[data-yeni]');
    if (y) { const s = f.satirlar[Number(y.dataset.yeni)]; s._secim = { tip: 'yeni', ad: s.ad, tur: 'urun' }; ciz(); const yi = $(`[data-yeni-ad="${y.dataset.yeni}"]`, el); yi?.focus({ preventScroll: true }); yi?.select(); return; }
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
