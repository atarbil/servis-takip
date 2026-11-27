// Telefon arayüzü: bilgisayar görünümünden ayrı kabuk.
// Sabit üst çubuk (geri · başlık · işlemler), sabit alt sekmeler, tek sayfa.
// Telefon için yazılmış sayfalar js/m/ altında; henüz yazılmamış sayfalar bilgisayar sayfasıyla açılır.
import { api } from '../api.js';
import { html, $, $$, bildir } from '../ui.js';

// Telefona özel sayfalar (ad → modül)
const MOBIL = { isler: 'isler', havuz: 'isler', takvim: 'isler', is: 'is', fis: 'fis' };
// Varsayılan sorgu: havuz / takvim aynı İşler sayfasının bölümleri
const BOLUM = { havuz: 'havuz', takvim: 'takvim' };

export const GORUNUM_ANAHTAR = 'gorunum';
export function mobilGorunumMu() {
  let tercih = null;
  try { tercih = localStorage.getItem(GORUNUM_ANAHTAR); } catch { /* */ }
  if (tercih === 'masa') return false;
  return matchMedia('(max-width: 860px)').matches;
}
// 'masa': telefonda da bilgisayar görünümü; 'mobil' (varsayılan): ekran genişliğine göre
export function gorunumSec(t) {
  try { if (t === 'masa') localStorage.setItem(GORUNUM_ANAHTAR, t); else localStorage.removeItem(GORUNUM_ANAHTAR); } catch { /* */ }
  location.reload();
}

export async function mobilKabuk(ctx, a) {
  const { SAYFALAR, MUHASEBE_SAYFA, YONETICI_MENU, KULLANICI_MENU, menuAdi, ikon, cikis, sifreDegistir, uygulamaEkle, uygulamaKurulu, mobilBaslat } = a;
  const teknisyen = !ctx.yonetici;
  const izinli = (ad) => (teknisyen ? ['islerim', 'saha'].includes(ad) : !ctx.muhasebe || MUHASEBE_SAYFA.has(ad) || ad === 'isler');
  const SEKMELER = teknisyen
    ? [{ yol: 'islerim', ad: 'İşlerim', ikon: 'liste' }]
    : [{ yol: 'panel', ad: 'Panel', ikon: 'ev' }, { yol: 'isler', ad: 'İşler', ikon: 'liste' }, { yol: 'fisler', ad: 'Satış', ikon: 'fis' }, { yol: 'cariler', ad: 'Cariler', ikon: 'kisi' }];
  const KOK = new Set(SEKMELER.map((s) => s.yol));
  // Alt sekmenin hangi sayfalarda seçili görüneceği
  const SEKME_ESLES = { is: 'isler', havuz: 'isler', takvim: 'isler', 'dis-servis': 'isler', saha: teknisyen ? 'islerim' : 'isler', fis: 'fisler', teklifler: 'fisler', teklif: 'fisler', cari: 'cariler', envanter: 'cariler' };
  const firma = ctx.ayarlar.firma_adi || 'Servis Takip';

  document.body.className = `mobil-kabuk ${ctx.muhasebe ? 'rol-muhasebe' : ''}`;
  document.body.innerHTML = String(html`
    <header class="mk-ust">
      <button type="button" class="mk-geri" id="mk-geri" aria-label="Geri" hidden>${ikon('geri', 24)}</button>
      <h1 class="mk-baslik" id="ust-baslik">${firma}</h1>
      <div class="mk-eylem" id="mk-eylem"></div>
    </header>
    <main id="sayfa" class="mk-sayfa"></main>
    <nav class="mk-alt" id="mk-alt">
      ${SEKMELER.map((s) => html`<a href="#/${s.yol}" data-sekme="${s.yol}">${ikon(s.ikon, 22)}<span>${menuAdi(s)}</span>${s.yol === 'isler' ? html`<b class="mk-sayac" data-sayac="havuz" hidden></b>` : ''}</a>`)}
      <button type="button" data-hizli>${ikon('arti', 22)}<span>İş ekle</span></button>
      <button type="button" data-menu>${ikon('menu', 22)}<span>Menü</span></button>
    </nav>`);

  // ---------- Menü (tam ekran) ----------
  function menuAc() {
    const gruplar = teknisyen ? [] : YONETICI_MENU.map((g) => ({ ...g, alt: (g.alt || [g]).filter((m) => izinli(m.yol)) })).filter((g) => g.alt.length);
    const kullanici = teknisyen ? [] : KULLANICI_MENU.filter((m) => izinli(m.yol) || (!ctx.muhasebe));
    const d = document.createElement('dialog');
    d.className = 'mk-menu';
    d.innerHTML = String(html`<div class="mk-menu-ust"><div><b>${ctx.kullanici.ad_soyad}</b><small>${firma}</small></div>
        <button type="button" class="mk-kapat" aria-label="Kapat">✕</button></div>
      <div class="mk-menu-govde">
        ${gruplar.map((g) => html`<section><h4>${menuAdi(g)}</h4>${g.alt.map((m) => html`<a href="#/${m.yol}">${ikon(m.ikon)}<span>${menuAdi(m)}</span></a>`)}</section>`)}
        <section><h4>Hesap</h4>
          ${kullanici.map((m) => html`<a href="#/${m.yol}">${ikon(m.ikon)}<span>${menuAdi(m)}</span></a>`)}
          ${uygulamaKurulu() ? '' : html`<button type="button" data-m="uygulama">📱<span>Telefona uygulama olarak ekle</span></button>`}
          <button type="button" data-m="masa">🖥<span>Bilgisayar görünümüne geç</span></button>
          <button type="button" data-m="sifre">${ikon('anahtar')}<span>Şifre değiştir</span></button>
          <button type="button" data-m="cikis" class="tehlike">${ikon('cikis')}<span>Çıkış</span></button>
        </section>
      </div>`);
    document.body.append(d);
    const kapat = () => { if (d.open) d.close(); d.remove(); };
    d.addEventListener('close', () => d.remove());
    d.addEventListener('click', (e) => {
      if (e.target.closest('.mk-kapat') || e.target.closest('a')) return kapat();
      const m = e.target.closest('[data-m]')?.dataset.m;
      if (!m) return;
      // Görünüm değişince sayfa yeniden yüklenir; menüyü kapatmak (geçmişte geri gitmek) yüklemeyle yarışmasın
      if (m === 'masa') { gorunumSec('masa'); return; }
      kapat();
      if (m === 'masa') gorunumSec('masa');
      else if (m === 'sifre') sifreDegistir();
      else if (m === 'cikis') cikis();
      else if (m === 'uygulama') uygulamaEkle();
    });
    d.showModal();
  }
  $('[data-menu]').onclick = menuAc;
  const hz = $('[data-hizli]');
  if (hz) hz.onclick = async () => {
    if (teknisyen) {
      // Teknisyen: havuza ekler ya da "bu işi ben yapıyorum" ile kendine planlar
      const { teknisyenIsEkle } = await import('../sayfa/islerim.js');
      if (await teknisyenIsEkle(ctx) && simdiki?.ad === 'islerim') yukle({ yeni: false });
      return;
    }
    const { hizliIs } = await import('../sayfa/havuz.js'); hizliIs(ctx);
  };

  // ---------- Geri ----------
  // Uygulama içinde açılan sayfa sayısı: geri tuşu önce önceki sayfaya, yoksa sekmenin köküne döner
  let derinlik = 0; let sira = 0;
  $('#mk-geri').onclick = () => {
    if (derinlik > 0) history.back();
    else location.hash = `#/${SEKME_ESLES[simdiki?.ad] || SEKMELER[0].yol}`;
  };

  // ---------- Sayfa ----------
  const kaydirma = new Map(); // geçmiş sırası → kaydırma yeri (geri gelince aynı yerden devam)
  let simdiki = null; let sayfaNo = 0; let oncekiSira = null;

  function yolCoz(hashYol) {
    const [yolKismi, sorguKismi] = hashYol.split('?');
    const sorgu = Object.fromEntries(new URLSearchParams(sorguKismi || ''));
    let [ad, ...params] = yolKismi.split('/').filter(Boolean);
    if (!ad) ad = SEKMELER[0].yol;
    if (!izinli(ad) || (!SAYFALAR[ad] && !MOBIL[ad])) { ad = SEKMELER[0].yol; params = []; }
    if (teknisyen && ad === 'saha' && !params[0]) ad = 'islerim';
    if (BOLUM[ad] && !sorgu.b) sorgu.b = BOLUM[ad];
    return { ad, params, sorgu };
  }

  function eylemTemizle() { $('#mk-eylem').replaceChildren(); }

  async function yukle({ yeni = true } = {}) {
    const hashYol = location.hash.replace(/^#\/?/, '');
    if (oncekiSira !== null) kaydirma.set(oncekiSira, scrollY);
    const y = yolCoz(hashYol);
    const buSira = sira; simdiki = y; oncekiSira = buSira;
    const no = ++sayfaNo;
    document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch { /* */ } });
    // Alt sekme / geri düğmesi
    const sekme = KOK.has(y.ad) ? y.ad : SEKME_ESLES[y.ad];
    $$('#mk-alt [data-sekme]').forEach((a) => a.classList.toggle('aktif', a.dataset.sekme === sekme));
    const kok = KOK.has(y.ad) && !y.params.length;
    $('#mk-geri').hidden = kok;
    document.body.classList.toggle('mk-kok', kok);

    // Önceki sayfa çıkarken iş yapabilir (ör. fiş taslağını kaydetmek)
    const eski = $('#sayfa');
    if (eski?.ayrilirken) { try { await eski.ayrilirken(); } catch { /* */ } }
    if (no !== sayfaNo) return;
    const el = document.createElement('main');
    el.id = 'sayfa';
    const mobilSayfa = !!MOBIL[y.ad];
    el.className = `mk-sayfa sayfa-${y.ad} ${mobilSayfa ? 'mk-yeni' : 'mk-masa'}`;
    if (mobilSayfa) el.dataset.mobil = '1';
    el.innerHTML = '<div class="yukleniyor"><span></span></div>';
    $('#sayfa').replaceWith(el);
    eylemTemizle();

    const sctx = Object.create(ctx);
    sctx.mobil = true;
    sctx.sorgu = y.sorgu;
    sctx.baslik = (metin) => { if (no === sayfaNo) ctx.baslik(metin); };
    sctx.yenile = () => yukle({ yeni: false });
    sctx.kapatVeGit = (yol) => { location.replace(`#/${yol.replace(/^#?\//, '')}`); };
    // Telefon sayfaları üst çubuğa düğme koyabilir
    sctx.ustEylem = (...dugmeler) => { if (no === sayfaNo) $('#mk-eylem').replaceChildren(...dugmeler); };
    try {
      const m = MOBIL[y.ad] ? await import(`./${MOBIL[y.ad]}.js`) : await import(`../sayfa/${SAYFALAR[y.ad]}.js`);
      if (no !== sayfaNo) return;
      el.innerHTML = '';
      await m.default(el, y.params, sctx);
    } catch (e) {
      if (no !== sayfaNo) return;
      console.error(e);
      el.innerHTML = String(html`<div class="bos-durum hata"><b>Sayfa yüklenemedi</b><p>${e.message}</p>
        <button class="btn ikincil" onclick="location.reload()">Yenile</button></div>`);
    }
    if (no !== sayfaNo) return;
    // Geri gelindiyse eski kaydırma yeri; yeni sayfa en üstten
    window.scrollTo(0, yeni ? 0 : (kaydirma.get(buSira) || 0));
  }

  // Geri / ileri ayrımı: her uygulama içi sayfa geçmiş kaydında sıra numarası taşır (pencere kayıtları da kopyalar)
  try { history.replaceState({ ...(history.state || {}), mkSira: 0 }, '', location.href); } catch { /* */ }
  addEventListener('hashchange', () => {
    const st = history.state?.mkSira;
    let geri = false;
    if (st == null) { sira += 1; try { history.replaceState({ ...(history.state || {}), mkSira: sira }, '', location.href); } catch { /* */ } }
    else { geri = st < sira; sira = st; }
    derinlik = sira;
    yukle({ yeni: !geri });
  });
  // Veri değişince (başka sayfada kayıt) açık sayfa yenilenmez; geri dönülen sayfa zaten yeniden yüklenir.

  // Havuz sayacı
  async function sayac() {
    if (teknisyen) return;
    try {
      const s = await api.get('/sayaclar');
      const b = $('[data-sayac="havuz"]');
      if (b) { b.hidden = !s.havuz; b.textContent = s.havuz > 99 ? '99+' : s.havuz; }
    } catch { /* */ }
  }
  ctx.sayacYenile = sayac;
  sayac(); setInterval(sayac, 60000);
  addEventListener('veri-degisti', () => setTimeout(sayac, 300));

  // Bilgisayar sayfaları için eski telefon düzenlemeleri (⋯ menüsü, + düğmesi, filtre); telefon sayfalarına dokunmaz
  mobilBaslat({ cekYenile: false });
  void bildir;
  yukle();
}
