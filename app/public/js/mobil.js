// Telefon görünümü: sayfalara dokunmadan, ekrana çizildikten sonra uygulama gibi düzenler.
// Hepsi eklemeli: asıl düğmeler yerinde kalır (bilgisayarda görünür), telefonda vekil düğmeler onlara tıklar.
//  - Başlık tekrarı gizlenir (üst çubukta zaten var)
//  - "+ Yeni …" ana düğmesi sağ altta yuvarlak + düğmesi olur
//  - İkincil düğmeler (Excel, Yazdır, Sil…) "⋯" menüsüne girer
//  - Fiş/alış/teklif: Kaydet / Onayla ve toplam altta sabit çubukta
//  - Filtreler "Filtre" düğmesinin altında açılır
//  - Aşağı çekince yenileme; geri tuşu açık pencereyi kapatır
import { $, $$ } from './ui.js';

export const telefon = matchMedia('(max-width: 860px)');
const yazi = (e) => (e?.textContent || '').replace(/\s+/g, ' ').trim();
const kisa = (s) => s.toLocaleLowerCase('tr').replace(/[^a-zçğıöşü0-9]/g, '');

let fab; let altCubuk; let menu; let cekIp; let daha;
// Telefonda ⋯ menüsüne girecek ikincil işler (ana işler — Tahsilat, Ödeme… — yerinde kalır)
const IKINCIL = /excel|yazdır|pdf|paylaş|kopyala|iptal|sil\b|🗑|csv|içe aktar|dışa aktar|proforma fatura/i;

function kur() {
  fab = document.createElement('button');
  fab.id = 'mb-fab'; fab.type = 'button'; fab.hidden = true; fab.setAttribute('aria-label', 'Yeni');
  fab.innerHTML = '<span>+</span>';
  altCubuk = document.createElement('div');
  altCubuk.id = 'mb-alt'; altCubuk.hidden = true;
  menu = document.createElement('div');
  menu.id = 'mb-menu'; menu.hidden = true; menu.setAttribute('role', 'menu');
  daha = document.createElement('button');
  daha.type = 'button'; daha.className = 'btn-ikon mb-daha'; daha.hidden = true; daha.textContent = '⋯'; daha.setAttribute('aria-label', 'Diğer işlemler');
  document.body.append(fab, altCubuk, menu);
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('#mb-menu, .mb-daha')) menu.hidden = true;
  });
}

// ---------- Başlık, ⋯ menüsü, + düğmesi ----------
function vekil(asil, sinif = '') {
  const b = document.createElement('button');
  b.type = 'button'; b.className = sinif; b.textContent = yazi(asil);
  b.disabled = asil.disabled;
  b.onclick = () => { menu.hidden = true; asil.click(); };
  return b;
}

function ustDuzenle(sayfa) {
  let fabAday = null; let kaydet = null; let onayla = null;
  for (const ust of $$('.sayfa-ust, .detay-ust', sayfa)) {
    if (ust.dataset.mb) continue;
    ust.dataset.mb = '1';
    // Üst çubukla aynı başlık telefonda gizlenir
    const h2 = $('h2', ust); const baslik = yazi($('#ust-baslik'));
    if (h2 && baslik && (kisa(yazi(h2)).includes(kisa(baslik)) || kisa(baslik).includes(kisa(yazi(h2))))) { h2.classList.add('mb-gizle'); $('.alt', ust)?.classList.add('mb-gizle'); }
    const dugmeler = $$('button.btn, a.btn', ust).filter((b) => !b.closest('.filtre') && !b.closest('.sekmeler'));
    const ikincil = [];
    for (const b of dugmeler) {
      const t = yazi(b);
      if (b.dataset.a === 'kaydet') kaydet = b;
      else if (b.dataset.a === 'onayla') onayla = b;
      else if (!fabAday && b.classList.contains('birincil') && t.startsWith('+') && ust.classList.contains('sayfa-ust')) { fabAday = b; b.classList.add('mb-tasindi'); continue; } else if (ust.classList.contains('detay-ust') || IKINCIL.test(t)) ikincil.push(b);
      if (b === kaydet || b === onayla) b.classList.add('mb-tasindi');
    }
    // Tek ikincil düğme ya da "Panel düzenle" gibi önemli olanlar yerinde kalsın; 2+ ise ⋯ menüsüne
    if (ikincil.length >= 2 || (ikincil.length && (kaydet || onayla || fabAday))) {
      ikincil.forEach((b) => b.classList.add('mb-tasindi'));
      ust.mbIkincil = ikincil;
    }
    if (kaydet || onayla) ust.dataset.mbAlt = '1';
  }
  // ⋯: sayfadaki tüm taşınan ikincil düğmeler, üst çubukta
  const liste = $$('.sayfa-ust, .detay-ust', sayfa).flatMap((u) => u.mbIkincil || []).filter((b) => b.isConnected);
  const ustCubuk = $('#mk-eylem, .ust-cubuk, header.ust');
  if (ustCubuk && !daha.isConnected) { const h = $('#btn-hizli', ustCubuk); if (h) h.before(daha); else ustCubuk.append(daha); }
  daha.hidden = !liste.length;
  daha.onclick = (e) => {
    e.stopPropagation();
    if (!menu.hidden) { menu.hidden = true; return; }
    menu.replaceChildren(...liste.filter((b) => b.isConnected).map((b) => vekil(b, b.classList.contains('tehlike-cizgi') || b.classList.contains('tehlike') ? 'tehlike' : '')));
    const r = daha.getBoundingClientRect();
    menu.style.top = `${r.bottom + 8}px`; menu.style.right = `${Math.max(8, innerWidth - r.right)}px`;
    menu.hidden = false;
  };

  // + düğmesi: o anki sayfada görünen ilk aday
  const aday = fabAday || $$('.sayfa-ust .mb-tasindi.birincil', sayfa).find((b) => yazi(b).startsWith('+'));
  if (aday) { fab.hidden = false; fab.title = yazi(aday); fab.setAttribute('aria-label', yazi(aday)); fab.onclick = () => aday.click(); } else fab.hidden = true;

  // Alt çubuk: Kaydet / Onayla + genel toplam
  const k = kaydet || $('.detay-ust [data-a="kaydet"]', sayfa); const o = onayla || $('.detay-ust [data-a="onayla"]', sayfa);
  if (k || o) {
    const toplam = $$('.fatura-toplam tr, .teklif-toplam tr', sayfa).pop();
    const tutar = toplam ? yazi(toplam.lastElementChild) : '';
    const imza = `${tutar}|${k ? yazi(k) : ''}|${o ? yazi(o) : ''}|${k?.disabled}|${o?.disabled}`;
    if (altCubuk.dataset.imza !== imza) {
      altCubuk.dataset.imza = imza;
      altCubuk.replaceChildren();
      const t = document.createElement('div'); t.className = 'mb-alt-toplam';
      t.innerHTML = tutar ? `<small>Genel toplam</small><b></b>` : '';
      if (tutar) t.querySelector('b').textContent = tutar;
      altCubuk.append(t);
      if (k) altCubuk.append(vekil(k, 'btn ikincil'));
      if (o) { const b = vekil(o, 'btn basari'); b.textContent = '✓ Onayla'; altCubuk.append(b); }
    }
    altCubuk.hidden = false; document.body.classList.add('mb-alt-var');
  } else { altCubuk.hidden = true; altCubuk.dataset.imza = ''; document.body.classList.remove('mb-alt-var'); }
  if (!altCubuk.hidden) fab.hidden = true;
}

// ---------- Filtreler ----------
const varsayilan = new WeakMap();
const deger = (e) => (e.type === 'checkbox' ? e.checked : e.value);
function filtreDuzenle(sayfa) {
  for (const f of $$('.filtre', sayfa)) {
    if (f.dataset.mb) { filtreSay(f); continue; }
    const alanlar = $$('input, select', f);
    const ara = alanlar.find((e) => e.type === 'search') || alanlar.find((e) => e.type === 'text' && /ara|…/i.test(e.placeholder || ''));
    const digerleri = [...f.children].filter((c) => c !== ara && !c.contains(ara));
    if (digerleri.length < 2) continue; // tek bir kutu varsa daraltmaya gerek yok
    f.dataset.mb = '1';
    f.classList.add('mb-filtre');
    if (ara) ara.classList.add('mb-ara');
    alanlar.forEach((e) => varsayilan.set(e, deger(e)));
    const d = document.createElement('button');
    d.type = 'button'; d.className = 'btn ikincil mb-filtre-dugme';
    d.innerHTML = '⚙ Filtre <b hidden></b>';
    d.onclick = () => f.classList.toggle('mb-acik');
    if (ara) ara.after(d); else f.prepend(d);
    f.addEventListener('change', () => filtreSay(f));
    filtreSay(f);
  }
}
function filtreSay(f) {
  const n = $$('input, select', f).filter((e) => !e.classList.contains('mb-ara') && varsayilan.has(e) && deger(e) !== varsayilan.get(e)).length;
  const b = $('.mb-filtre-dugme b', f); if (b) { b.hidden = !n; b.textContent = n; }
}

// ---------- Aşağı çekince yenile ----------
function cekYenile() {
  const ip = document.createElement('div'); ip.id = 'mb-cek'; ip.textContent = '↻'; cekIp = ip;
  document.body.append(ip);
  let y0 = null; let dy = 0;
  addEventListener('touchstart', (e) => {
    if (!telefon.matches || scrollY > 0 || document.querySelector('dialog[open]') || e.touches.length > 1) { y0 = null; return; }
    if (e.target.closest('input, textarea, select, .tk-govde, .yatay-kaydir, [data-cekme-yok]')) { y0 = null; return; }
    y0 = e.touches[0].clientY; dy = 0;
  }, { passive: true });
  addEventListener('touchmove', (e) => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (scrollY > 0) { y0 = null; ip.classList.remove('gorunur', 'hazir'); return; }
    const m = Math.max(0, Math.min(90, dy * 0.5));
    ip.style.transform = `translate(-50%, ${m}px) rotate(${m * 4}deg)`;
    ip.classList.toggle('gorunur', m > 8); ip.classList.toggle('hazir', m >= 60);
  }, { passive: true });
  addEventListener('touchend', () => {
    if (y0 !== null && ip.classList.contains('hazir')) {
      ip.classList.add('donuyor');
      Promise.resolve(window.__ctx?.yenile()).finally(() => setTimeout(() => ip.classList.remove('donuyor', 'gorunur', 'hazir'), 500));
    } else ip.classList.remove('gorunur', 'hazir');
    ip.style.transform = ''; y0 = null;
  });
}

// ---------- Geri tuşu pencereyi kapatsın ----------
// Telefon kabuğu sayfa değiştirmeden önce bunu bekler
export let gecmisSakin = () => Promise.resolve();

function geriTusu() {
  const asil = HTMLDialogElement.prototype.showModal;
  const asilKapat = HTMLDialogElement.prototype.close;
  let sayac = 0;
  // Pencere düğmeyle kapanınca yapılan history.back() kendi popstate'ini doğurur; o olay başka (alttaki) pencereyi kapatmasın
  let yoksay = 0;
  // Kapanan pencerenin kaydı bir sonraki adımda silinir (kapatan tıklama bir bağlantıysa sayfa değişmiş olur, dokunulmaz).
  // O arada açılan pencerenin kaydı, silme bitince eklenir (yoksa yanlış kayıt silinir).
  let bekleyen = 0;
  let kuyruk = [];
  const kuyrukCalis = () => {
    if (yoksay || bekleyen) return;
    if (kuyruk.length) { const k = kuyruk; kuyruk = []; k.forEach((f) => f()); }
    if (!yoksay && !bekleyen) { const b = sakinBekleyen; sakinBekleyen = []; b.forEach((f) => f()); }
  };
  // Pencere kapanışının geçmiş temizliği bitene kadar bekler (hemen ardından sayfa değiştirilirse geri alma onu bozmasın)
  let sakinBekleyen = [];
  gecmisSakin = () => (yoksay || bekleyen ? new Promise((coz) => { sakinBekleyen.push(coz); setTimeout(coz, 800); }) : Promise.resolve());
  const kayitEkle = (d, no) => { if (d.open) history.pushState({ ...(history.state || {}), mbPencere: no }, '', location.href); };
  const kayitSil = (d) => {
    if (!d._mbNo || d._mbSilindi) return;
    d._mbSilindi = true; bekleyen++;
    setTimeout(() => {
      bekleyen--;
      if (history.state?.mbPencere === d._mbNo) { yoksay++; history.back(); } else kuyrukCalis();
    }, 0);
  };
  HTMLDialogElement.prototype.showModal = function (...a) {
    asil.apply(this, a);
    if (!telefon.matches) return;
    const no = ++sayac;
    this._mbNo = no; this._mbSilindi = false;
    if (yoksay || bekleyen) kuyruk.push(() => kayitEkle(this, no)); else kayitEkle(this, no);
    this.addEventListener('close', () => kayitSil(this), { once: true });
  };
  HTMLDialogElement.prototype.close = function (...a) {
    const acikti = this.open;
    asilKapat.apply(this, a);
    if (acikti) kayitSil(this);
  };
  addEventListener('popstate', () => {
    if (yoksay > 0) { yoksay--; kuyrukCalis(); return; }
    const acik = [...document.querySelectorAll('dialog[open]')].pop();
    if (!acik) return;
    const e = new Event('cancel', { cancelable: true });
    acik.dispatchEvent(e);
    if (!e.defaultPrevented && acik.open) acik.close();
  });
}

// ---------- Ana ekrana ekle ----------
let yuklemeIstegi = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); yuklemeIstegi = e; });
export const uygulamaKurulu = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
export async function uygulamaEkle(pencere, html) {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (yuklemeIstegi) {
    yuklemeIstegi.prompt();
    await yuklemeIstegi.userChoice.catch(() => {});
    yuklemeIstegi = null;
    return;
  }
  await pencere({
    baslik: 'Telefona uygulama olarak ekle', kaydetMetin: 'Tamam', iptalMetin: '',
    icerik: html`<p>Ana ekrana eklenince program kendi simgesiyle, tarayıcı çubukları olmadan tam ekran açılır.</p>
      ${ios ? html`<ol class="mb-adim"><li><b>Safari</b>'de bu sayfa açıkken alttaki <b>Paylaş</b> düğmesine (kare ve yukarı ok) dokunun.</li>
          <li>Listeyi kaydırıp <b>Ana Ekrana Ekle</b>'yi seçin.</li><li>Sağ üstte <b>Ekle</b>'ye dokunun.</li></ol>
          <p class="soluk">Chrome veya başka bir tarayıcıdaysanız sayfayı Safari'de açın.</p>`
        : html`<ol class="mb-adim"><li><b>Chrome</b>'da sağ üstteki <b>⋮</b> menüsünü açın.</li>
          <li><b>Uygulamayı yükle</b> ya da <b>Ana ekrana ekle</b>'yi seçin.</li><li><b>Yükle</b>'ye dokunun.</li></ol>`}`,
  });
}

// ---------- Başlat ----------
let bekleyen = false;
export function mobilBaslat({ cekYenile: cek = true } = {}) {
  kur();
  if (cek) cekYenile();
  geriTusu();
  const calis = () => {
    bekleyen = false;
    const sayfa = $('#sayfa'); if (!sayfa) return;
    // Telefon için yazılmış sayfalar (js/m) kendi düzenine sahip
    if (sayfa.dataset.mobil) { fab.hidden = true; altCubuk.hidden = true; daha.hidden = true; document.body.classList.remove('mb-alt-var'); return; }
    ustDuzenle(sayfa); filtreDuzenle(sayfa);
  };
  // Yönlendirici #sayfa'yı değiştirebilir, kabuk yeniden çizilebilir: tüm gövde izlenir (işlemler tekrarsız)
  new MutationObserver(() => {
    if (!fab.isConnected) document.body.append(fab, altCubuk, menu, cekIp);
    if (!bekleyen) { bekleyen = true; requestAnimationFrame(calis); }
  }).observe(document.body, { childList: true, subtree: true });
  addEventListener('hashchange', () => { menu.hidden = true; });
  calis();
}
