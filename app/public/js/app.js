// Uygulama kabuğu: oturum, menü, sayfa yönlendirme
import { api } from './api.js';
import { html, ham, $, $$, bildir, pencere } from './ui.js';
import { mobilBaslat, uygulamaEkle, uygulamaKurulu } from './mobil.js';

// Menü: üstte gruplu açılır menü. Adlar Ayarlar → Menü'den değiştirilebilir (ayarlar.menu_adlari).
export const YONETICI_MENU = [
  { yol: 'panel', ad: 'Panel', ikon: 'ev' },
  { grup: 'isler', ad: 'İşler', ikon: 'liste', alt: [
    { yol: 'havuz', ad: 'İş Havuzu', ikon: 'havuz', sayac: 'havuz' },
    { yol: 'takvim', ad: 'Takvim', ikon: 'takvim' },
    { yol: 'isler', ad: 'Tüm İşler', ikon: 'liste' },
    { yol: 'dis-servis', ad: 'Dış Servis', ikon: 'anahtar', sayac: 'dis_servis' },
  ] },
  { grup: 'satis', ad: 'Satış', ikon: 'fis', alt: [
    { yol: 'fiyatlandirma', ad: 'Fiyatlandırma', ikon: 'etiket', sayac: 'fiyatlandirma' },
    { yol: 'fisler', ad: 'Satış Fişleri', ikon: 'fis' },
    { yol: 'teklifler', ad: 'Teklif / Proforma', ikon: 'belge' },
  ] },
  { grup: 'cari', ad: 'Cariler', ikon: 'kisi', alt: [
    { yol: 'cariler', ad: 'Cariler', ikon: 'kisi' },
    { yol: 'envanter', ad: 'Envanter', ikon: 'cihaz' },
  ] },
  { grup: 'stok', ad: 'Stok', ikon: 'kutu', alt: [
    { yol: 'urunler', ad: 'Ürünler / Stok', ikon: 'kutu' },
    { yol: 'alislar', ad: 'Alış Faturaları', ikon: 'alis' },
  ] },
  { grup: 'finans', ad: 'Finans', ikon: 'kasa', alt: [
    { yol: 'kasa', ad: 'Kasa / Banka', ikon: 'kasa' },
    { yol: 'raporlar', ad: 'Raporlar', ikon: 'rapor' },
  ] },
];
export const KULLANICI_MENU = [
  { yol: 'ayarlar', ad: 'Ayarlar', ikon: 'ayar' },
  { yol: 'silinenler', ad: 'Silinenler', ikon: 'cop' },
  { yol: 'guncelleme', ad: 'Programı güncelle', ikon: 'yenile' },
];
const MOBIL_ALT = ['panel', 'havuz', 'takvim', 'cariler'];
const DUZ_MENU = [...YONETICI_MENU.flatMap((m) => m.alt || [m]), ...KULLANICI_MENU];
const menuAdi = (m) => ctx.menuAdlari?.[m.yol || 'grup:' + m.grup] || m.ad;
const sayacHtml = (anahtarlar) => (anahtarlar.length ? html`<b class="menu-sayac" data-sayac="${anahtarlar.join(',')}" hidden></b>` : '');
const menuLink = (m) => html`<a href="#/${m.yol}" data-yol="${m.yol}" role="menuitem">${ikon(m.ikon)}<span>${menuAdi(m)}</span>${m.sayac ? sayacHtml([m.sayac]) : ''}</a>`;
const grupHtml = (m, ek = '') => html`<div class="um-grup ${ek}" data-grup="${m.grup}">
    <button type="button" class="um-baslik" aria-haspopup="true" aria-expanded="false">${ikon(m.ikon)}<span>${menuAdi(m)}</span>
      ${sayacHtml(m.alt.filter((a) => a.sayac).map((a) => a.sayac))}<span class="um-ok">${ikon('asagi', 16)}</span></button>
    <div class="um-acilir" role="menu">${m.alt.map(menuLink)}</div></div>`;
const kullaniciGrup = (ek) => html`<div class="um-grup um-kullanici ${ek}" data-grup="kullanici">
    <button type="button" class="um-baslik" aria-haspopup="true" aria-expanded="false"><span class="avatar">${(ctx.kullanici.ad_soyad || '?').split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
      <span class="um-ad">${ctx.kullanici.ad_soyad}</span><span class="um-ok">${ikon('asagi', 16)}</span></button>
    <div class="um-acilir sag" role="menu">${KULLANICI_MENU.map(menuLink)}
      <hr>${uygulamaKurulu() ? '' : html`<button type="button" role="menuitem" data-uygulama>📱<span>Telefona uygulama olarak ekle</span></button>`}
      <button type="button" role="menuitem" data-sifre>${ikon('anahtar')}<span>Şifre değiştir</span></button>
      <button type="button" role="menuitem" data-cikis>${ikon('cikis')}<span>Çıkış</span></button></div></div>`;
const menuHtml = () => html`${YONETICI_MENU.map((m) => (m.alt ? grupHtml(m) : menuLink(m)))}${kullaniciGrup('yalniz-mobil')}`;

const IKON = {
  yenile: 'M20 12a8 8 0 1 1-2.34-5.66M20 4v5h-5',
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
  asagi: 'M6 9l6 6 6-6',
  anahtar: 'M14.7 6.3a4 4 0 0 0-5.4 5.2L3 17.8V21h3.2l6.3-6.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.6-.6-.6-2.6z',
  cop: 'M4 7h16M10 11v6M14 11v6M5 7l1 13h12l1-13M9 7V4h6v3',
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
  // Sayfa başlığı: menüde adı değiştirilmiş sayfalar yeni adla görünür
  baslik(metin) {
    const m = DUZ_MENU.find((x) => x.ad === metin);
    const ad = (m && this.menuAdlari?.[m.yol]) || metin;
    document.title = `${ad} · ${this.ayarlar.firma_adi || 'Servis Takip'}`; const b = $('#ust-baslik'); if (b) b.textContent = ad;
  },
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
  menuAdlariYukle();
  kabukCiz();
  mobilBaslat();
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
  return html`<div class="giris-izgara"></div>${ham(parcacik)}${ham(girisSahnesi())}
    <div class="giris-alt">© ${new Date().getFullYear()} ${ctx.firmaAdi && ctx.firmaAdi !== 'Firma Adı' ? ctx.firmaAdi + ' · ' : ''}Servis Takip</div>`;
}

// Giriş sahnesi (v2): akşam, bina cephesi. Usta merdivene tırmanır, kamerayı takıp vidalar, kabloyu switch'e
// döşer ve aşağı iner; kamera ışığı yanınca kablo giriş kutusuna ulaşır, kutuda "● CANLI" önizleme açılır.
// Telefonda sahne ekranın üst yarısında (kırpılmış kadraj), giriş kutusu altta kart olarak durur.
function girisSahnesi() {
  const basamak = Array.from({ length: 8 }, (_, i) => {
    const t = (i + 0.5) / 8; const y = 600 - t * 340;
    return `<line x1="${150 + t * 46}" y1="${y}" x2="${206 + t * 42}" y2="${y}"/>`;
  }).join('');
  const port = Array.from({ length: 6 }, (_, i) => `<rect x="${392 + i * 15}" y="566" width="10" height="8" rx="1.5" class="gs-port"/>
    <circle cx="${397 + i * 15}" cy="562" r="1.8" class="gs-port-led" style="animation-delay:${4 + (i * 0.37) % 1.3}s"/>`).join('');
  // cephe pencereleri: bazıları yanık, bazıları yavaşça yanıp söner
  const pencere = [];
  for (let k = 0; k < 4; k++) for (let r = 0; r < 6; r++) {
    const x = 52 + k * 62; const y = 190 + r * 66; const n = (k * 7 + r * 3) % 5;
    if (k === 3 && r < 2) continue; // kamera bölgesi boş
    pencere.push(`<rect x="${x}" y="${y}" width="34" height="40" rx="3" class="gs-pencere ${n === 0 ? 'yanik' : n === 3 ? 'yanip' : ''}" style="animation-delay:${(k + r) * 1.3}s"/>`);
  }
  const yildiz = Array.from({ length: 16 }, (_, i) => `<circle cx="${(i * 97) % 640}" cy="${12 + (i * 53) % 150}" r="${i % 3 ? 1 : 1.6}" class="gs-yildiz" style="animation-delay:${i * .45}s"/>`).join('');
  return `<svg class="giris-sahne" viewBox="0 0 640 640" aria-hidden="true" preserveAspectRatio="xMinYMax meet">
  <defs>
    <linearGradient id="gs-isik" x1="0" x2="1"><stop offset="0" stop-color="#bae6fd" stop-opacity=".6"/><stop offset="1" stop-color="#bae6fd" stop-opacity="0"/></linearGradient>
    <linearGradient id="gs-cephe" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1e3a6e"/><stop offset="1" stop-color="#0f1f40"/></linearGradient>
    <linearGradient id="gs-cephe-yan" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".0"/><stop offset="1" stop-color="#000" stop-opacity=".35"/></linearGradient>
    <radialGradient id="gs-ay"><stop offset=".6" stop-color="#fef3c7"/><stop offset="1" stop-color="#fef3c7" stop-opacity="0"/></radialGradient>
    <radialGradient id="gs-golge"><stop offset="0" stop-color="#000" stop-opacity=".45"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
    <filter id="gs-parla"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <g class="gs-gok">${yildiz}<circle cx="560" cy="70" r="26" fill="url(#gs-ay)" class="gs-ay"/></g>
  <!-- bina cephesi -->
  <g class="gs-bina">
    <rect x="30" y="96" width="280" height="504" rx="4" fill="url(#gs-cephe)"/>
    <rect x="30" y="96" width="280" height="504" rx="4" fill="url(#gs-cephe-yan)"/>
    <rect x="22" y="86" width="296" height="14" rx="3" class="gs-sacak"/>
    ${pencere.join('')}
    <rect x="114" y="520" width="56" height="80" rx="3" class="gs-kapi"/><circle cx="160" cy="562" r="2.2" fill="#fbbf24"/>
  </g>
  <rect x="0" y="600" width="640" height="40" class="gs-kaldirim"/>
  <line x1="0" y1="600" x2="640" y2="600" class="gs-zemin"/>
  <ellipse cx="200" cy="603" rx="70" ry="7" fill="url(#gs-golge)"/>
  <!-- kablo: kameradan cephe boyunca switch'e; oradan giriş kutusuna (bilgisayar) / aşağıya (telefon) -->
  <path class="gs-kablo gs-kablo1" pathLength="1" d="M262 156 C 282 168 292 180 292 208 L 292 556 Q 292 578 312 578 L 384 578"/>
  <path class="gs-kablo gs-kablo2 gs-masa" pathLength="1" d="M496 572 C 575 572 540 470 575 392"/>
  <path class="gs-kablo gs-kablo2 gs-tel" pathLength="1" d="M440 590 L 440 640"/>
  <path class="gs-veri gs-veri1" d="M262 156 C 282 168 292 180 292 208 L 292 556 Q 292 578 312 578 L 384 578"/>
  <path class="gs-veri gs-veri2 gs-masa" d="M496 572 C 575 572 540 470 575 392"/>
  <path class="gs-veri gs-veri2 gs-tel" d="M440 590 L 440 640"/>
  <!-- kamera ve görüş alanı -->
  <polygon class="gs-isik" points="340,139 640,48 640,262"/>
  <g class="gs-kamera">
    <rect x="246" y="120" width="16" height="40" rx="3" class="gs-ayak"/>
    <rect x="256" y="124" width="80" height="30" rx="9" class="gs-govde"/>
    <rect x="254" y="118" width="90" height="9" rx="4" class="gs-siper"/>
    <circle cx="336" cy="139" r="10" class="gs-mercek"/><circle cx="338" cy="137" r="3" fill="#7dd3fc"/>
    <circle cx="272" cy="139" r="3.5" class="gs-led"/>
  </g>
  <!-- merdiven -->
  <g class="gs-merdiven"><line x1="150" y1="600" x2="196" y2="260"/><line x1="206" y1="600" x2="248" y2="260"/>${basamak}</g>
  <!-- usta: tırmanır, çalışır, iner -->
  <g class="gs-usta-yol"><g class="gs-usta">
    <g class="gs-bacak1"><rect x="198" y="304" width="13" height="70" rx="5" class="gs-tulum" transform="rotate(8 204 304)"/><rect x="188" y="370" width="24" height="9" rx="4" class="gs-ayakkabi"/></g>
    <g class="gs-bacak2"><rect x="214" y="304" width="13" height="62" rx="5" class="gs-tulum" transform="rotate(-4 220 304)"/><rect x="210" y="361" width="24" height="9" rx="4" class="gs-ayakkabi"/></g>
    <rect x="196" y="230" width="40" height="82" rx="12" class="gs-tulum"/>
    <rect x="198" y="254" width="36" height="7" class="gs-serit"/><rect x="198" y="274" width="36" height="7" class="gs-serit"/>
    <rect x="188" y="286" width="16" height="14" rx="3" class="gs-canta"/>
    <line x1="202" y1="244" x2="196" y2="298" class="gs-kol-arka"/>
    <circle cx="218" cy="210" r="16" class="gs-ten"/>
    <path d="M200 208 a18 18 0 0 1 36 0 z" class="gs-kask"/><rect x="198" y="205" width="42" height="5" rx="2.5" class="gs-kask"/>
    <circle cx="228" cy="210" r="1.6" fill="#1f2937"/>
    <g class="gs-kol"><line x1="228" y1="240" x2="246" y2="196" class="gs-kol-c"/><line x1="246" y1="196" x2="254" y2="166" class="gs-kol-c"/>
      <circle cx="254" cy="164" r="6" class="gs-ten"/><line x1="254" y1="160" x2="257" y2="148" class="gs-tornavida"/></g>
    <g class="gs-kivilcim" filter="url(#gs-parla)"><circle cx="260" cy="148" r="2.5"/><circle cx="266" cy="142" r="1.8"/><circle cx="254" cy="141" r="1.5"/></g>
  </g></g>
  <!-- alet çantası -->
  <rect x="88" y="578" width="44" height="22" rx="4" class="gs-alet"/><path d="M100 578 v-7 h20 v7" class="gs-alet-sap"/>
  <!-- switch -->
  <g class="gs-switch"><rect x="384" y="554" width="112" height="36" rx="5" class="gs-kasa"/>${port}
    <text x="440" y="586" text-anchor="middle" class="gs-etiket">PoE SWITCH</text></g>
</svg>`;
}

// Giriş kutusunun üstündeki küçük kamera önizlemesi (kablo bağlanınca açılır)
function canliOnizleme() {
  return `<div class="gs-canli" aria-hidden="true"><div class="gs-canli-ekran">
    <svg viewBox="0 0 320 64" preserveAspectRatio="xMidYMid slice">
      <rect width="320" height="64" fill="#0b1220"/>
      <rect x="0" y="44" width="320" height="20" fill="#111a2e"/>
      <rect x="22" y="14" width="64" height="40" fill="#16233d"/><rect x="34" y="22" width="12" height="14" fill="#fbbf24" opacity=".7"/><rect x="58" y="22" width="12" height="14" fill="#1e2d4d"/>
      <rect x="120" y="6" width="90" height="48" fill="#132038"/><rect x="152" y="30" width="22" height="24" fill="#0b1220"/>
      <rect x="236" y="20" width="60" height="34" fill="#16233d"/><circle cx="286" cy="12" r="5" fill="#fef3c7" opacity=".8"/>
      <rect class="gs-canli-tarama" x="0" y="0" width="320" height="10" fill="url(#gs-canli-g)"/>
      <defs><linearGradient id="gs-canli-g" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#7dd3fc" stop-opacity="0"/><stop offset="1" stop-color="#7dd3fc" stop-opacity=".25"/></linearGradient></defs>
    </svg>
    <span class="gs-canli-rozet">● CANLI</span><span class="gs-canli-saat">CAM-01</span>
  </div></div>`;
}

function girisEkrani() {
  const firma = ctx.firmaAdi && ctx.firmaAdi !== 'Firma Adı' ? ctx.firmaAdi : '';
  // Aynı gün ikinci girişte gösteri baştan oynamaz: doğrudan son haline atlanır
  let atla = false;
  try { const g = new Date().toLocaleDateString('tr-TR'); atla = localStorage.getItem('giris-gosteri') === g; localStorage.setItem('giris-gosteri', g); } catch { /* */ }
  document.body.innerHTML = String(html`<div class="giris-kap ${atla ? 'gs-atla' : ''}">${girisZemini()}<form class="giris-kutu" id="giris-form">
    ${ham(canliOnizleme())}
    <img class="giris-logo" src="/logo" alt="" onerror="this.remove()" onload="if (this.naturalWidth < 3) this.remove()">
    <h1>Hoş geldiniz</h1>
    <p class="alt-yazi">${firma ? `${firma} · ` : ''}Servis Takip</p>
    <label class="alan"><span>Kullanıcı adı</span><input name="kullanici_adi" autocomplete="username" autocapitalize="none" required></label>
    <label class="alan"><span>Şifre</span><input name="sifre" type="password" autocomplete="current-password" required></label>
    <div class="form-hata" hidden></div>
    <button class="btn birincil tam">Giriş yap</button></form></div>`);
  const f = $('#giris-form');
  // Telefonda sahne ortalanmış kadrajla (bina + usta + switch), bilgisayarda tam görünüm
  const sahne = $('.giris-sahne');
  const kadraj = () => {
    if (!sahne.isConnected) return removeEventListener('resize', kadraj);
    const tel = matchMedia('(max-width: 860px)').matches;
    sahne.setAttribute('viewBox', tel ? '10 30 540 610' : '0 0 640 640');
    sahne.setAttribute('preserveAspectRatio', tel ? 'xMidYMax meet' : 'xMinYMax meet');
  };
  kadraj(); addEventListener('resize', kadraj);
  // Önizlemedeki saat
  const saat = $('.gs-canli-saat', f);
  const saatYaz = () => { if (!saat.isConnected) return clearInterval(saatZ); saat.textContent = `CAM-01 · ${new Date().toLocaleTimeString('tr-TR')}`; };
  const saatZ = setInterval(saatYaz, 1000); saatYaz();
  // Telefonda klavye açılınca otomatik odak sahneyi örtmesin: yalnız bilgisayarda kendiliğinden odaklan
  if (!matchMedia('(max-width: 860px)').matches) setTimeout(() => $('input', f).focus(), 400);
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

export function menuAdlariYukle() {
  try { ctx.menuAdlari = JSON.parse(ctx.ayarlar?.menu_adlari || '{}') || {}; } catch { ctx.menuAdlari = {}; }
}

// ---------- Üst menü davranışı ----------
// Masaüstü: başlığa tıklayınca açılır; biri açıkken diğerinin üzerine gelince ona geçer; dışarı tıklama / Esc kapatır.
// Telefon (≤1024 px): ☰ ile soldan çekmece; gruplar akordeon.
const cekmeceMi = () => matchMedia('(max-width: 1024px)').matches;
function menuKapat(haric) {
  $$('.um-grup.acik').forEach((g) => { if (g !== haric) { g.classList.remove('acik'); $('.um-baslik', g).setAttribute('aria-expanded', 'false'); } });
}
function cekmece(ac) { $('#ust-menu')?.classList.toggle('acik', ac); $('#yan-ortu')?.classList.toggle('acik', ac); if (!ac) menuKapat(); }
function grupAc(g, ac, odak = false) {
  if (!cekmeceMi()) menuKapat(g);
  g.classList.toggle('acik', ac);
  $('.um-baslik', g).setAttribute('aria-expanded', ac ? 'true' : 'false');
  if (ac && odak) $('.um-acilir [role=menuitem]', g)?.focus();
}
function menuBagla() {
  const basliklar = () => $$('.ust-cubuk .um-baslik').filter((b) => b.offsetParent !== null);
  $$('.um-baslik').forEach((b) => {
    const g = b.closest('.um-grup');
    b.addEventListener('click', (e) => { e.stopPropagation(); grupAc(g, !g.classList.contains('acik')); });
    b.addEventListener('mouseenter', () => { if (!cekmeceMi() && $('.ust-cubuk .um-grup.acik') && !g.classList.contains('acik')) grupAc(g, true); });
    b.addEventListener('keydown', (e) => {
      const l = basliklar(); const i = l.indexOf(b);
      if (e.key === 'ArrowDown') { e.preventDefault(); grupAc(g, true, true); }
      else if (!cekmeceMi() && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        e.preventDefault(); const h = l[(i + (e.key === 'ArrowRight' ? 1 : -1) + l.length) % l.length]; h?.focus();
        if (g.classList.contains('acik')) grupAc(h.closest('.um-grup'), true);
      }
    });
  });
  $$('.um-acilir').forEach((m) => m.addEventListener('keydown', (e) => {
    const ogeler = $$('[role=menuitem]', m); const i = ogeler.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ogeler[(i + (e.key === 'ArrowDown' ? 1 : -1) + ogeler.length) % ogeler.length]?.focus(); }
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const acik = $('.um-grup.acik');
    if (acik) { menuKapat(); $('.um-baslik', acik).focus(); } else if ($('#ust-menu.acik')) cekmece(false);
  });
  document.addEventListener('click', (e) => { if (!e.target.closest('.um-grup')) menuKapat(); });
  $$('.ust-cubuk a[data-yol], .ust-cubuk .ust-logo').forEach((a) => a.addEventListener('click', () => { menuKapat(); cekmece(false); }));
  $('#btn-menu').onclick = () => cekmece(true);
  $('#btn-menu-kapat').onclick = () => cekmece(false);
  $('#alt-daha').onclick = (e) => { e.preventDefault(); cekmece(true); };
  $('#yan-ortu').onclick = () => cekmece(false);
}

// ---------- Kabuk ----------
function kabukCiz() {
  const k = ctx.kullanici;
  const firma = ctx.ayarlar.firma_adi || 'Servis Takip';
  if (!ctx.yonetici) {
    document.body.innerHTML = String(html`<div class="kabuk teknisyen">
      <header class="ust"><div class="ust-firma"><div class="logo">ST</div><div><b>${firma}</b><small>${k.ad_soyad}${k.ekip_ad ? ' · ' + k.ekip_ad : ''}</small></div></div>
        <span class="bosluk"></span>
        ${uygulamaKurulu() ? '' : html`<button class="btn-ikon" data-uygulama title="Telefona uygulama olarak ekle">📱</button>`}
        <button class="btn-ikon" id="btn-sifre" title="Şifre">🔑</button>
        <button class="btn-ikon" id="btn-cikis" title="Çıkış">${ikon('cikis')}</button></header>
      <main id="sayfa"></main></div>`);
  } else {
    document.body.innerHTML = String(html`<div class="kabuk ust-duzen">
      <header class="ust-cubuk">
        <button class="btn-ikon mobil-menu" id="btn-menu" aria-label="Menü">${ikon('menu')}</button>
        <a href="#/panel" class="ust-logo" title="${firma}">${ctx.ayarlar.firma_logo
          ? html`<img src="/logo?v=${encodeURIComponent(ctx.ayarlar.firma_logo)}" alt="${firma}">`
          : html`<span class="logo">ST</span><b>${firma}</b>`}</a>
        <h1 id="ust-baslik" class="mobil-baslik"></h1>
        <nav class="ust-menu" id="ust-menu" aria-label="Ana menü">
          <div class="um-cekmece-ust"><b>${firma}</b><button type="button" class="btn-ikon" id="btn-menu-kapat" aria-label="Kapat">✕</button></div>
          ${menuHtml()}
        </nav>
        <span class="bosluk"></span>
        <div class="kur-kutu" id="kur" hidden></div>
        <button class="btn birincil" id="btn-hizli">+ İş ekle</button>
        ${kullaniciGrup('yalniz-masa')}
      </header>
      <div class="yan-ortu" id="yan-ortu"></div>
      <main id="sayfa"></main>
      <nav class="alt-menu">${MOBIL_ALT.map((y) => { const m = DUZ_MENU.find((x) => x.yol === y); return html`<a href="#/${m.yol}" data-yol="${m.yol}">${ikon(m.ikon)}<span>${menuAdi(m).replace('İş ', '')}</span></a>`; })}
        <a href="#" id="alt-daha">${ikon('menu')}<span>Menü</span></a></nav>
    </div>`);
    menuBagla();
    $('#btn-hizli').onclick = async () => {
      const { hizliIs } = await import('./sayfa/havuz.js');
      hizliIs(ctx);
    };
  }
  $$('#btn-cikis, [data-cikis]').forEach((b) => { b.onclick = cikis; });
  $$('#btn-sifre, [data-sifre]').forEach((b) => { b.onclick = () => { menuKapat(); sifreDegistir(); }; });
  $$('[data-uygulama]').forEach((b) => { b.onclick = () => { menuKapat(); uygulamaEkle(pencere, html); }; });
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
    $$('[data-sayac]').forEach((b) => { const n = b.dataset.sayac.split(',').reduce((t, k) => t + (s[k] || 0), 0); b.textContent = n; b.hidden = !n; });
  } catch { /* */ }
}
ctx.sayacYenile = () => sayacYukle(true);

// ---------- Yönlendirme ----------
const SAYFALAR = {
  panel: 'panel', havuz: 'havuz', takvim: 'takvim', isler: 'isler', is: 'is', saha: 'saha', islerim: 'islerim',
  cariler: 'cariler', cari: 'cari', fisler: 'fisler', fis: 'fis', alislar: 'alislar', alis: 'alis',
  fiyatlandirma: 'fiyatlandirma', teklifler: 'teklifler', teklif: 'teklif', envanter: 'envanter',
  urunler: 'urunler', urun: 'urun', kasa: 'kasa', raporlar: 'raporlar', ayarlar: 'ayarlar', silinenler: 'silinenler', 'dis-servis': 'disservis', guncelleme: 'guncelleme',
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
  // Sayfa değişince açık pencereler kapanır (geri tuşu, menü, panel bağlantısı)
  document.querySelectorAll('dialog[open]').forEach((d) => { try { d.close(); } catch { /* */ } });
  // Eski sayfanın olay dinleyicilerini temizlemek için yeni eleman
  const el = document.createElement('main');
  el.id = 'sayfa';
  el.className = `sayfa-${ad}`;
  eski.replaceWith(el);
  window.scrollTo(0, 0);
  const menuAd = { is: 'isler', saha: 'isler', cari: 'cariler', fis: 'fisler', alis: 'alislar', urun: 'urunler', teklif: 'teklifler' }[ad] || ad;
  $$('[data-yol]').forEach((a) => a.classList.toggle('aktif', a.dataset.yol === menuAd));
  // Bulunulan sayfanın grubu vurgulanır; açık menüler kapanır
  $$('.um-grup').forEach((g) => g.classList.toggle('aktif-grup', !!g.querySelector(`[data-yol="${menuAd}"]`)));
  menuKapat(); cekmece(false);
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
