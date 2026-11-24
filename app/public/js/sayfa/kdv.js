// KDV durumu: "bu ay KDV çıkıyor mu?"
// Satış KDV'si yüklenen XML'lerden (sunucuda yalnız okunur, kaydedilmez; özetler bu sekmede bellekte durur),
// alış KDV'si programdaki onaylı alış faturalarından.
import { api } from '../api.js';
import { html, $, para, bildir, sayiCoz, sayiGiris, bugunStr } from '../ui.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const ayAdi = (ay) => `${AYLAR[Number(ay.slice(5, 7)) - 1]} ${ay.slice(0, 4)}`;
const tarihYaz = (t) => (t ? t.split('-').reverse().join('.') : '');
const PARCA = 12 * 1024 * 1024; // bir istekte gönderilecek en fazla veri (base64)

function dosyaOku(f) {
  return new Promise((coz, reddet) => {
    const r = new FileReader();
    r.onload = () => coz({ ad: f.name, veri: String(r.result).replace(/^data:[^,]*,/, '') });
    r.onerror = () => reddet(new Error(`${f.name} okunamadı.`));
    r.readAsDataURL(f);
  });
}

export default async function (el, _p, ctx) {
  ctx.baslik('KDV durumu');
  let ay = (ctx.sorgu.ay && /^\d{4}-\d{2}$/.test(ctx.sorgu.ay)) ? ctx.sorgu.ay : bugunStr().slice(0, 7);
  const faturalar = new Map(); // ETTN → özet (yalnız bu sekmede)
  let hatalar = [];
  let tekrar = 0;
  let alis = null;
  let yukleniyor = '';

  const devredenAnahtar = () => `kdv-devreden-${ay}`;
  const devredenOku = () => { try { return Number(localStorage.getItem(devredenAnahtar())) || 0; } catch { return 0; } };

  async function alisYukle() {
    alis = await api.get('/kdv/alis', { ay });
  }

  function hesapla() {
    const firmaVkn = alis?.firma_vkn || '';
    const s = { fatura: 0, matrah: 0, kdv: 0, tevkifat: 0, iade: 0, iadeKdv: 0, ilk: '', son: '', oranlar: new Map(), baskaAy: 0, baskaFirma: 0, kursuz: 0, toplam: faturalar.size };
    for (const f of faturalar.values()) {
      if (firmaVkn && f.satici_vkn && f.satici_vkn !== firmaVkn) { s.baskaFirma++; continue; }
      if (!f.tarih || f.tarih.slice(0, 7) !== ay) { s.baskaAy++; continue; }
      const kur = f.doviz === 'TRY' ? 1 : Number(f.kur) || 0;
      if (!kur) { s.kursuz++; continue; }
      let fk = 0;
      for (const o of f.dokum) {
        const y = s.oranlar.get(o.oran) || { matrah: 0, kdv: 0 };
        y.matrah += o.matrah * kur; y.kdv += o.kdv * kur; s.oranlar.set(o.oran, y);
        s.matrah += o.matrah * kur; fk += o.kdv * kur;
      }
      s.kdv += fk; s.tevkifat += (f.tevkifat || 0) * kur;
      if (f.tip === 'IADE') { s.iade++; s.iadeKdv += fk; }
      s.fatura++;
      if (!s.ilk || f.tarih < s.ilk) s.ilk = f.tarih;
      if (!s.son || f.tarih > s.son) s.son = f.tarih;
    }
    s.hesaplanan = r2(s.kdv - s.tevkifat);
    return s;
  }

  function ciz() {
    const s = hesapla();
    const a = alis || { kdv: 0, matrah: 0, fatura: 0, oranlar: [], taslaklar: [] };
    const devreden = devredenOku();
    const fark = r2(s.hesaplanan - a.kdv - devreden);
    const cikiyor = fark > 0.004;
    const satisYok = !s.fatura;
    const oranlar = [...new Set([...s.oranlar.keys(), ...a.oranlar.map((o) => o.oran)])].sort((x, y) => y - x);
    const uyarilar = [];
    if (s.toplam && !alis?.firma_vkn) uyarilar.push(html`Ayarlar'da firma vergi numarası yok; yüklenen XML'lerin sizin kestiğiniz faturalar olduğu kontrol edilemedi.`);
    if (s.baskaFirma) uyarilar.push(html`<b>${s.baskaFirma}</b> fatura sizin kestiğiniz bir fatura değil (satıcı başka firma); sayılmadı. Alış faturalarını <a href="#/efatura">e-Fatura aktar</a> ekranına yükleyin.`);
    if (s.baskaAy) uyarilar.push(html`<b>${s.baskaAy}</b> fatura ${ayAdi(ay)} dışında; bu ay sayılmadı.`);
    if (tekrar) uyarilar.push(html`<b>${tekrar}</b> fatura birden çok kez yüklendi; bir kez sayıldı.`);
    if (s.kursuz) uyarilar.push(html`<b>${s.kursuz}</b> dövizli faturada kur yok; sayılmadı.`);
    if (a.taslaklar.length) uyarilar.push(html`<b>${a.taslaklar.length}</b> taslak alış faturası onaylanmadığı için sayılmadı: ${a.taslaklar.map((t, i) => html`${i ? ', ' : ''}<a href="#/alis/${t.id}">${t.belge_no}</a>`)}`);

    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>KDV durumu</h2><span class="bosluk"></span>
        <label class="kdv-ay"><span>Dönem</span><input type="month" id="kdv-ay" value="${ay}" max="${bugunStr().slice(0, 7)}"></label></div>

      <div class="kdv-sonuc ${satisYok ? 'bekliyor' : cikiyor ? 'cikiyor' : 'cikmiyor'}">
        <div class="kdv-sonuc-ust">${ayAdi(ay)}</div>
        ${satisYok
          ? html`<div class="kdv-hukum">Satış faturalarını yükleyin</div>
            <div class="kdv-tutar-yazi">Alış faturalarından indirilecek KDV: <b>${para(a.kdv)}</b>${devreden ? html` · devreden <b>${para(devreden)}</b>` : ''}</div>`
          : html`<div class="kdv-hukum">Bu ay KDV ${cikiyor ? 'ÇIKIYOR' : 'ÇIKMIYOR'}</div>
            <div class="kdv-tutar">${cikiyor ? html`Ödenecek ≈ <b>${para(fark)}</b>` : html`Sonraki aya devreden ≈ <b>${para(-fark)}</b>`}</div>`}
      </div>

      ${uyarilar.length ? html`<div class="uyari-kutu">${uyarilar.map((u) => html`<div>⚠ ${u}</div>`)}</div>` : ''}

      <div class="kdv-izgara">
        <div class="kart"><div class="kart-govde">
          <h3 class="kdv-baslik">Hesap</h3>
          <table class="kdv-hesap"><tbody>
            <tr><td>Hesaplanan KDV <small>kestiğiniz ${s.fatura} fatura${s.ilk ? ` · ${tarihYaz(s.ilk)} – ${tarihYaz(s.son)}` : ''}</small></td><td>${para(s.kdv)}</td></tr>
            ${s.tevkifat ? html`<tr><td>− Tevkifat <small>alıcının ödeyeceği kısım</small></td><td>−${para(r2(s.tevkifat))}</td></tr>` : ''}
            ${s.iade ? html`<tr class="soluk-satir"><td colspan="2"><small>Bunun ${para(r2(s.iadeKdv))} kadarı ${s.iade} iade faturasından</small></td></tr>` : ''}
            <tr><td>− İndirilecek KDV <small>${a.fatura} onaylı alış faturası</small></td><td>−${para(a.kdv)}</td></tr>
            <tr><td>− Önceki aydan devreden KDV</td><td><input id="kdv-devreden" inputmode="decimal" value="${devreden ? sayiGiris(devreden) : ''}" placeholder="0,00"></td></tr>
            <tr class="kdv-net ${cikiyor ? 'negatif' : 'pozitif'}"><td>${cikiyor ? 'Ödenecek KDV' : 'Devreden KDV'}</td><td>${para(Math.abs(fark))}</td></tr>
          </tbody></table>
          ${oranlar.length ? html`<details class="kdv-oran"><summary>KDV oranlarına göre</summary>
            <table class="tablo"><thead><tr><th>Oran</th><th class="sayi">Satış matrahı</th><th class="sayi">Satış KDV</th><th class="sayi">Alış matrahı</th><th class="sayi">Alış KDV</th></tr></thead>
            <tbody>${oranlar.map((o) => { const x = s.oranlar.get(o) || { matrah: 0, kdv: 0 }; const y = a.oranlar.find((q) => q.oran === o) || { matrah: 0, kdv: 0 };
              return html`<tr><td>%${sayiGiris(o)}</td><td class="sayi">${para(r2(x.matrah))}</td><td class="sayi">${para(r2(x.kdv))}</td><td class="sayi">${para(y.matrah)}</td><td class="sayi">${para(y.kdv)}</td></tr>`; })}</tbody></table></details>` : ''}
        </div></div>

        <div class="kart"><div class="kart-govde">
          <h3 class="kdv-baslik">Kestiğim faturalar (satış)</h3>
          <label class="efatura-birak kdv-birak" id="birak">
            <input type="file" id="dosya" accept=".xml,.zip,application/xml,text/xml,application/zip" multiple hidden>
            <div class="efatura-birak-ic"><div class="efatura-ikon">📤</div>
              <b>${yukleniyor || 'Satış faturası XML / ZIP dosyalarını bırakın'}</b>
              <span class="soluk">${yukleniyor ? '' : 'Ayın o güne kadarki tüm faturaları · dosyalar kaydedilmez'}</span></div>
          </label>
          ${faturalar.size ? html`<div class="kdv-yuklenen"><span>Yüklenen: <b>${faturalar.size}</b> fatura${s.son ? html` · son fatura <b>${tarihYaz(s.son)}</b>` : ''}</span>
            <button class="btn-metin" data-temizle>Temizle</button></div>` : ''}
          ${hatalar.length ? html`<details class="kdv-hatalar"><summary>${hatalar.length} dosya okunamadı</summary>${hatalar.map((h) => html`<div><b>${h.dosya}</b>: ${h.hata}</div>`)}</details>` : ''}
          <p class="soluk kdv-not">Alış KDV'si programa girdiğiniz <a href="#/alislar">onaylı alış faturalarından</a> hesaplanır.
            Müşteriden gelen iade faturaları ve beyannamedeki diğer kalemler (ÖTV, istisnalar, KDV-2 vb.) hesaba katılmaz.
            Sonuç bilgi amaçlıdır; kesin tutar için mali müşavirinize danışın.</p>
        </div></div>
      </div>`);
    bagla();
  }

  async function yukle(dosyalar) {
    if (!dosyalar?.length) return;
    try {
      const okunan = await Promise.all([...dosyalar].map(dosyaOku));
      // Büyük yüklemeler parça parça gönderilir
      const parcalar = []; let p = []; let boy = 0;
      for (const d of okunan) { if (p.length && boy + d.veri.length > PARCA) { parcalar.push(p); p = []; boy = 0; } p.push(d); boy += d.veri.length; }
      if (p.length) parcalar.push(p);
      let n = 0;
      for (const parca of parcalar) {
        yukleniyor = `Okunuyor… ${n}/${okunan.length}`; ciz();
        const c = await api.post('/kdv/oku', { dosyalar: parca });
        for (const f of c.faturalar) {
          const k = f.ettn || `${f.satici_vkn}|${f.no}`;
          if (faturalar.has(k)) tekrar++; else faturalar.set(k, f);
        }
        hatalar.push(...c.hatalar);
        n += parca.length;
      }
      yukleniyor = '';
      // Faturalar başka bir aya aitse o ay açılır
      const s = hesapla();
      if (!s.fatura && faturalar.size) {
        const say = new Map();
        for (const f of faturalar.values()) { const m = (f.tarih || '').slice(0, 7); if (m) say.set(m, (say.get(m) || 0) + 1); }
        const enCok = [...say.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
        if (enCok && enCok !== ay) { ay = enCok; await alisYukle(); bildir(`Faturalar ${ayAdi(ay)} dönemine ait; o ay gösteriliyor.`); }
      }
      ciz();
    } catch (e) { yukleniyor = ''; ciz(); bildir(e.durum === 413 ? 'Dosya çok büyük; daha küçük parçalar hâlinde yükleyin.' : e.message, 'hata', 6000); }
  }

  function bagla() {
    const girdi = $('#dosya', el); const birak = $('#birak', el);
    girdi.onchange = () => { yukle(girdi.files); girdi.value = ''; };
    birak.ondragover = (e) => { e.preventDefault(); birak.classList.add('uzerinde'); };
    birak.ondragleave = () => birak.classList.remove('uzerinde');
    birak.ondrop = (e) => { e.preventDefault(); birak.classList.remove('uzerinde'); yukle(e.dataTransfer.files); };
    $('#kdv-ay', el).onchange = async (e) => {
      if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
      ay = e.target.value;
      try { await alisYukle(); } catch (err) { bildir(err.message, 'hata'); }
      ciz();
    };
    const dv = $('#kdv-devreden', el);
    dv.onchange = () => {
      const v = sayiCoz(dv.value) || 0;
      try { if (v) localStorage.setItem(devredenAnahtar(), String(v)); else localStorage.removeItem(devredenAnahtar()); } catch { /* */ }
      ciz();
    };
    const t = $('[data-temizle]', el);
    if (t) t.onclick = () => { faturalar.clear(); hatalar = []; tekrar = 0; ciz(); };
  }

  await alisYukle();
  ciz();
}
