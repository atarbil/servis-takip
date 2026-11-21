// Uygulama kabuğu: oturum, menü, sayfa yönlendirme
import { api } from './api.js';
import { html, ham, $, $$, bildir, pencere } from './ui.js';

const YONETICI_MENU = [
  { yol: 'panel', ad: 'Panel', ikon: 'ev' },
  { yol: 'havuz', ad: 'İş Havuzu', ikon: 'havuz' },
  { yol: 'takvim', ad: 'Takvim', ikon: 'takvim' },
  { yol: 'fiyatlandirma', ad: 'Fiyatlandırma', ikon: 'etiket', sayac: 'fiyatlandirma' },
  { yol: 'isler', ad: 'Tüm İşler', ikon: 'liste' },
  { yol: 'cariler', ad: 'Cariler', ikon: 'kisi' },
  { yol: 'envanter', ad: 'Envanter', ikon: 'cihaz' },
  { yol: 'teklifler', ad: 'Teklif / Proforma', ikon: 'belge' },
  { yol: 'fisler', ad: 'Satış Fişleri', ikon: 'fis' },
  { yol: 'alislar', ad: 'Alış Faturaları', ikon: 'alis' },
  { yol: 'urunler', ad: 'Ürünler / Stok', ikon: 'kutu' },
  { yol: 'kasa', ad: 'Kasa / Banka', ikon: 'kasa' },
  { yol: 'raporlar', ad: 'Raporlar', ikon: 'rapor' },
  { yol: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
];
const MOBIL_ALT = ['panel', 'havuz', 'takvim', 'cariler'];

const IKON = {
  ev: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  havuz: 'M4 6h16M4 12h16M4 18h10',
  takvim: 'M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  liste: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  kisi: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1m15-8a3 3 0 1 0 0-6m3 14v-1a4 4 0 0 0-3-3.9M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  fis: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  alis: 'M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6M9 20h.01M17 20h.01',
  kutu: 'M21 8 12 3 3 8m18 0-9 5m9-5v8l-9 5m0-8L3 8m9 5v8M3 8v8l9 5',
  kasa: 'M3 7h18v12H3zM3 11h18M7 15h3',
  rapor: 'M4 20V10m6 10V4m6 16v-7m4 7H2',
  ayar: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-5l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7.4 7.4 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h5l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  etiket: 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8zM7.5 7.5h.01',
  cihaz: 'M4 5h16v10H4zM8 19h8M12 15v4',
  belge: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6',
  cikis: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l5-5-5-5M15 12H3',
};
export const ikon = (ad, boyut = 20) => html`<svg class="ikon" width="${boyut}" height="${boyut}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${IKON[ad] || ''}"/></svg>`;

const ctx = {
  kullanici: null,
  ayarlar: {},
  _ekipler: null,
  get yonetici() { return this.kullanici?.rol === 'yonetici'; },
  git(yol) { location.hash = '#/' + yol.replace(/^#?\//, ''); },
  baslik(metin) { document.title = `${metin} · ${this.ayarlar.firma_adi || 'Servis Takip'}`; const b = $('#ust-baslik'); if (b) b.textContent = metin; },
  async ekipler(yenile = false) {
    if (!this._ekipler || yenile) this._ekipler = await api.get('/ekipler');
    return this._ekipler;
  },
  yenile() { yonlendir(); },
};
window.__ctx = ctx;

// ---------- Oturum ----------
async function basla() {
  let durum;
  try { durum = await api.get('/durum'); } catch (e) { return hataEkrani(e.message); }
  ctx.firmaAdi = durum.firma_adi;
  if (durum.kurulum_gerekli) return kurulumEkrani();
  if (!durum.kullanici) return girisEkrani();
  ctx.kullanici = durum.kullanici;
  try { ctx.ayarlar = await api.get('/ayarlar'); } catch { /* */ }
  kabukCiz();
  window.addEventListener('hashchange', yonlendir);
  yonlendir();
}

window.addEventListener('oturum-bitti', () => {
  if (!ctx.kullanici) return;
  ctx.kullanici = null;
  bildir('Oturumunuz sona erdi, lütfen tekrar giriş yapın.', 'uyari');
  girisEkrani();
});

function hataEkrani(mesaj) {
  document.body.innerHTML = String(html`<div class="giris-kap"><div class="giris-kutu"><h1>Bağlantı sorunu</h1><p>${mesaj}</p>
    <button class="btn birincil" onclick="location.reload()">Tekrar dene</button></div></div>`);
}

// Giriş/kurulum ekranının hareketli arka planı
function girisZemini() {
  const parcacik = Array.from({ length: 18 }, (_, i) => {
    const sol = (i * 53) % 100; const boy = 3 + (i % 4) * 2; const sure = 12 + (i % 7) * 3; const gecikme = -(i * 1.7);
    return `<span class="giris-parcacik" style="left:${sol}%;width:${boy}px;height:${boy}px;animation-duration:${sure}s;animation-delay:${gecikme}s"></span>`;
  }).join('');
  return html`<div class="giris-izgara"></div>${ham(parcacik)}
    <div class="giris-alt">© ${new Date().getFullYear()} ${ctx.firmaAdi && ctx.firmaAdi !== 'Firma Adı' ? ctx.firmaAdi + ' · ' : ''}Servis Takip</div>`;
}

function girisEkrani() {
  const firma = ctx.firmaAdi && ctx.firmaAdi !== 'Firma Adı' ? ctx.firmaAdi : '';
  document.body.innerHTML = String(html`<div class="giris-kap">${girisZemini()}<form class="giris-kutu" id="giris-form">
    <img class="giris-logo" src="/logo" alt="" onerror="this.remove()">
    <h1>Hoş geldiniz</h1>
    <p class="alt-yazi">${firma ? `${firma} · ` : ''}Servis Takip</p>
    <label class="alan"><span>Kullanıcı adı</span><input name="kullanici_adi" autocomplete="username" autocapitalize="none" required></label>
    <label class="alan"><span>Şifre</span><input name="sifre" type="password" autocomplete="current-password" required></label>
    <div class="form-hata" hidden></div>
    <button class="btn birincil tam">Giriş yap</button></form></div>`);
  const f = $('#giris-form');
  setTimeout(() => $('input', f).focus(), 400);
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', f); btn.disabled = true; btn.textContent = 'Giriş yapılıyor…';
    try {
      await api.post('/giris', { kullanici_adi: f.kullanici_adi.value, sifre: f.sifre.value });
      f.style.transition = 'opacity .3s, transform .3s'; f.style.opacity = '0'; f.style.transform = 'scale(.97)';
      setTimeout(() => { location.hash = ''; location.reload(); }, 250);
    } catch (err) {
      const h = $('.form-hata', f); h.textContent = err.message; h.hidden = false;
      btn.disabled = false; btn.textContent = 'Giriş yap';
      f.classList.remove('salla'); void f.offsetWidth; f.classList.add('salla');
    }
  });
}

function kurulumEkrani() {
  document.body.innerHTML = String(html`<div class="giris-kap">${girisZemini()}<form class="giris-kutu" id="kurulum-form">
    <div class="logo-buyuk">ST</div>
    <h1>Hoş geldiniz</h1>
    <p class="soluk">İlk kurulum: firma bilgisi ve yönetici hesabınızı oluşturun.</p>
    <label class="alan"><span>Firma adı</span><input name="firma_adi" required></label>
    <label class="alan"><span>Adınız soyadınız</span><input name="ad_soyad" required></label>
    <label class="alan"><span>Kullanıcı adı</span><input name="kullanici_adi" autocapitalize="none" required></label>
    <label class="alan"><span>Şifre (en az 8 karakter)</span><input name="sifre" type="password" autocomplete="new-password" minlength="8" required></label>
    <div class="form-hata" hidden></div>
    <button class="btn birincil tam">Kurulumu tamamla</button></form></div>`);
  const f = $('#kurulum-form');
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', f); btn.disabled = true;
    try {
      await api.post('/ilk-kurulum', Object.fromEntries(new FormData(f)));
      location.reload();
    } catch (err) {
      const h = $('.form-hata', f); h.textContent = err.message; h.hidden = false; btn.disabled = false;
    }
  });
}

async function cikis() {
  await api.post('/cikis').catch(() => {});
  location.hash = '';
  location.reload();
}

async function sifreDegistir() {
  await pencere({
    baslik: 'Şifremi değiştir',
    icerik: html`<label class="alan"><span>Mevcut şifre</span><input type="password" name="eski" autocomplete="current-password"></label>
      <label class="alan"><span>Yeni şifre (en az 8 karakter)</span><input type="password" name="yeni" autocomplete="new-password"></label>`,
    kaydet: async (v) => { await api.post('/sifre-degistir', v); bildir('Şifreniz değişti.', 'basari'); },
  });
}

// ---------- Kabuk ----------
function kabukCiz() {
  const k = ctx.kullanici;
  const firma = ctx.ayarlar.firma_adi || 'Servis Takip';
  if (!ctx.yonetici) {
    document.body.innerHTML = String(html`<div class="kabuk teknisyen">
      <header class="ust"><div class="ust-firma"><div class="logo">ST</div><div><b>${firma}</b><small>${k.ad_soyad}${k.ekip_ad ? ' · ' + k.ekip_ad : ''}</small></div></div>
        <span class="bosluk"></span>
        <button class="btn-ikon" id="btn-sifre" title="Şifre">🔑</button>
        <button class="btn-ikon" id="btn-cikis" title="Çıkış">${ikon('cikis')}</button></header>
      <main id="sayfa"></main></div>`);
  } else {
    document.body.innerHTML = String(html`<div class="kabuk">
      <aside class="yan" id="yan">
        <div class="yan-ust">${ctx.ayarlar.firma_logo
          ? html`<a href="#/panel" class="yan-logo" title="${firma}"><img src="/logo?v=${encodeURIComponent(ctx.ayarlar.firma_logo)}" alt="${firma}"></a>`
          : html`<div class="logo">ST</div><div class="yan-firma">${firma}</div>`}</div>
        <nav>${YONETICI_MENU.map((m) => html`<a href="#/${m.yol}" data-yol="${m.yol}">${ikon(m.ikon)}<span>${m.ad}</span>${m.sayac ? html`<b class="menu-sayac" data-sayac="${m.sayac}" hidden></b>` : ''}</a>`)}</nav>
        <div class="yan-alt">
          <div class="yan-kisi"><b>${k.ad_soyad}</b><small>Yönetici</small></div>
          <button class="btn-metin" id="btn-sifre">Şifre değiştir</button>
          <button class="btn-metin" id="btn-cikis">${ikon('cikis', 16)} Çıkış</button>
        </div>
      </aside>
      <div class="yan-ortu" id="yan-ortu"></div>
      <div class="ana">
        <header class="ust"><button class="btn-ikon mobil-menu" id="btn-menu" aria-label="Menü">${ikon('menu')}</button>
          <h1 id="ust-baslik"></h1><span class="bosluk"></span>
          <div class="kur-kutu" id="kur" hidden></div>
          <button class="btn birincil" id="btn-hizli">+ İş ekle</button></header>
        <main id="sayfa"></main>
      </div>
      <nav class="alt-menu">${MOBIL_ALT.map((y) => { const m = YONETICI_MENU.find((x) => x.yol === y); return html`<a href="#/${m.yol}" data-yol="${m.yol}">${ikon(m.ikon)}<span>${m.ad.replace('İş ', '')}</span></a>`; })}
        <a href="#" id="alt-daha">${ikon('menu')}<span>Menü</span></a></nav>
    </div>`);
    const yanAc = (a) => { $('#yan').classList.toggle('acik', a); $('#yan-ortu').classList.toggle('acik', a); };
    $('#btn-menu').onclick = () => yanAc(true);
    $('#alt-daha').onclick = (e) => { e.preventDefault(); yanAc(true); };
    $('#yan-ortu').onclick = () => yanAc(false);
    $$('#yan nav a').forEach((a) => a.addEventListener('click', () => yanAc(false)));
    $('#btn-hizli').onclick = async () => {
      const { hizliIs } = await import('./sayfa/havuz.js');
      hizliIs(ctx);
    };
  }
  $('#btn-cikis').onclick = cikis;
  $('#btn-sifre').onclick = sifreDegistir;
  if (ctx.yonetici) { kurYukle(); setInterval(kurYukle, 30 * 60 * 1000); }
}

// ---------- Döviz kuru (TCMB) ----------
const kurFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
async function kurYukle() {
  try {
    const k = await api.get('/kur');
    const el = $('#kur');
    if (!el || (!k.usd && !k.eur)) return;
    el.innerHTML = String(html`${k.usd ? html`<span title="Döviz alış ${kurFmt.format(k.usd.alis || 0)} · satış ${kurFmt.format(k.usd.satis)}"><small>USD</small><b>${kurFmt.format(k.usd.satis)}</b></span>` : ''}
      ${k.eur ? html`<span title="Döviz alış ${kurFmt.format(k.eur.alis || 0)} · satış ${kurFmt.format(k.eur.satis)}"><small>EUR</small><b>${kurFmt.format(k.eur.satis)}</b></span>` : ''}
      <em>TCMB ${k.tarih || ''}</em>`);
    el.hidden = false;
    el.title = 'Döviz çevirici';
    el.onclick = async () => { const { dovizCeviriciPencere } = await import('./bilesen.js'); dovizCeviriciPencere(ctx); };
    ctx.kur = k;
  } catch { /* kur alınamazsa gösterilmez */ }
}

// ---------- Menü rozetleri ----------
let sonSayac = 0;
async function sayacYukle(zorla = false) {
  if (!ctx.yonetici || (!zorla && Date.now() - sonSayac < 20000)) return;
  sonSayac = Date.now();
  try {
    const s = await api.get('/sayaclar');
    $$('[data-sayac]').forEach((b) => { const n = s[b.dataset.sayac] || 0; b.textContent = n; b.hidden = !n; });
  } catch { /* */ }
}
ctx.sayacYenile = () => sayacYukle(true);

// ---------- Yönlendirme ----------
const SAYFALAR = {
  panel: 'panel', havuz: 'havuz', takvim: 'takvim', isler: 'isler', is: 'is', saha: 'saha', islerim: 'islerim',
  cariler: 'cariler', cari: 'cari', fisler: 'fisler', fis: 'fis', alislar: 'alislar', alis: 'alis',
  fiyatlandirma: 'fiyatlandirma', teklifler: 'teklifler', teklif: 'teklif', envanter: 'envanter',
  urunler: 'urunler', urun: 'urun', kasa: 'kasa', raporlar: 'raporlar', ayarlar: 'ayarlar',
};
const TEKNISYEN_IZINLI = new Set(['islerim', 'saha']);
let sonYukleme = 0;

async function yonlendir() {
  const [yolKismi, sorguKismi] = location.hash.replace(/^#\/?/, '').split('?');
  ctx.sorgu = Object.fromEntries(new URLSearchParams(sorguKismi || ''));
  const parca = yolKismi.split('/').filter(Boolean);
  let [ad, ...params] = parca;
  if (!ad) ad = ctx.yonetici ? 'panel' : 'islerim';
  if (!ctx.yonetici && !TEKNISYEN_IZINLI.has(ad)) ad = 'islerim';
  if (!ctx.yonetici && ad === 'saha' && !params[0]) ad = 'islerim';
  const modul = SAYFALAR[ad];
  const eski = $('#sayfa');
  if (!eski) return;
  // Eski sayfanın olay dinleyicilerini temizlemek için yeni eleman
  const el = document.createElement('main');
  el.id = 'sayfa';
  el.className = `sayfa-${ad}`;
  eski.replaceWith(el);
  window.scrollTo(0, 0);
  const menuAd = { is: 'isler', saha: 'isler', cari: 'cariler', fis: 'fisler', alis: 'alislar', urun: 'urunler', teklif: 'teklifler' }[ad] || ad;
  $$('[data-yol]').forEach((a) => a.classList.toggle('aktif', a.dataset.yol === menuAd));
  sayacYukle();
  const benim = ++sonYukleme;
  if (!modul) { el.innerHTML = '<div class="bos-durum">Sayfa bulunamadı.</div>'; return; }
  el.innerHTML = '<div class="yukleniyor"><span></span></div>';
  try {
    const m = await import(`./sayfa/${modul}.js`);
    if (benim !== sonYukleme) return;
    await m.default(el, params, ctx);
  } catch (e) {
    if (benim !== sonYukleme) return;
    console.error(e);
    el.innerHTML = String(html`<div class="bos-durum hata"><b>Sayfa yüklenemedi</b><p>${e.message}</p>
      <button class="btn ikincil" onclick="location.reload()">Yenile</button></div>`);
  }
}

// ---------- PWA ----------
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

basla();
