// Ortak arayüz yardımcıları
// ---------- Güvenli HTML şablonu ----------
class Ham { constructor(s) { this.s = s; } toString() { return this.s; } }
export const ham = (s) => new Ham(String(s ?? ''));
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function deger(v) {
  if (v === null || v === undefined || v === false) return '';
  if (v instanceof Ham) return v.s;
  if (Array.isArray(v)) return v.map(deger).join('');
  return esc(v);
}
export function html(parcalar, ...degerler) {
  let s = '';
  parcalar.forEach((p, i) => { s += p; if (i < degerler.length) s += deger(degerler[i]); });
  return new Ham(s);
}
export const $ = (sec, kok = document) => kok.querySelector(sec);
export const $$ = (sec, kok = document) => [...kok.querySelectorAll(sec)];

// ---------- Biçimlendirme ----------
const paraFmt = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sayiFmt = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 3 });
export const para = (n) => (n === null || n === undefined || n === '' ? '' : paraFmt.format(Number(n)) + ' ₺');
// Dövizli tutar: TRY ise ₺, değilse "1.250,00 USD"
export const dovizPara = (n, d = 'TRY') => (n === null || n === undefined || n === '' ? '' : (!d || d === 'TRY' ? para(n) : paraFmt.format(Number(n)) + ' ' + d));
export const paraSade = (n) => (n === null || n === undefined || n === '' ? '' : paraFmt.format(Number(n)));
export const miktar = (n) => (n === null || n === undefined ? '' : sayiFmt.format(Number(n)));
export function tarih(t) {
  if (!t) return '';
  const s = String(t);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, a, g] = s.split('-'); return `${g}.${a}.${y}`; }
  return new Date(s).toLocaleDateString('tr-TR');
}
export const saat = (t) => (t ? new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '');
export const zaman = (t) => (t ? `${tarih(t)} ${saat(t)}` : '');
export const gunAdi = (t) => new Date(t).toLocaleDateString('tr-TR', { weekday: 'long' });
export function sureMetni(sn) {
  if (sn < 3600) return `${Math.max(1, Math.round(sn / 60))} dk`;
  if (sn < 86400) return `${Math.round(sn / 3600)} saat`;
  return `${Math.round(sn / 86400)} gün`;
}
// Yerel tarih (YYYY-MM-DD) - toISOString UTC'ye çevirdiği için kullanılmaz
export const bugunStr = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const yerelDT = (d) => `${bugunStr(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

// Türkçe sayı girişi: "5.000" = 5000, "1.250,50" = 1250.5
export function sayiCoz(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  let t = String(v).replace(/[\s₺]/g, '').replace(/TL/i, '');
  if (t === '') return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
export const sayiGiris = (n) => (n === null || n === undefined || n === '' ? '' : String(Number(n)).replace('.', ','));

export const DURUM = {
  havuz: { ad: 'Havuzda', renk: 'gri' },
  planlandi: { ad: 'Planlandı', renk: 'mavi' },
  sahada: { ad: 'Sahada', renk: 'turuncu' },
  tamamlandi: { ad: 'Tamamlandı', renk: 'yesil' },
  fis_kesildi: { ad: 'Fişi kesildi', renk: 'mor' },
  iptal: { ad: 'İptal', renk: 'kirmizi' },
  taslak: { ad: 'Taslak', renk: 'gri' },
  onaylandi: { ad: 'Onaylandı', renk: 'yesil' },
};
export const durumRozet = (d) => html`<span class="rozet ${DURUM[d]?.renk || 'gri'}">${DURUM[d]?.ad || d}</span>`;
export const ONCELIK = { 1: 'Acil', 2: 'Normal', 3: 'Düşük' };
export const bakiyeHucre = (b) => html`<span class="${b > 0.004 ? 'borclu' : b < -0.004 ? 'alacakli' : 'sifir'}">${para(Math.abs(b))}${b > 0.004 ? ' (B)' : b < -0.004 ? ' (A)' : ''}</span>`;
export const bakiyeAciklama = (b) => (b > 0.004 ? 'Size borçlu' : b < -0.004 ? 'Siz borçlusunuz' : 'Hesap kapalı');
export const telLink = (t) => (t ? html`<a href="tel:${String(t).replace(/[^\d+]/g, '')}">${t}</a>` : '');
export const haritaLink = (adres) => (adres ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adres)}` : '');

// ---------- Bildirim ----------
export function bildir(mesaj, tur = 'bilgi', sure = 3500) {
  let kap = $('#bildirimler');
  if (!kap) { kap = document.createElement('div'); kap.id = 'bildirimler'; document.body.append(kap); }
  // En fazla 3 bildirim; eskiler kalkar
  while (kap.children.length >= 3) kap.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `bildirim ${tur}`;
  el.textContent = mesaj;
  kap.append(el);
  setTimeout(() => { el.classList.add('cik'); setTimeout(() => el.remove(), 300); }, sure);
}

// ---------- Pencere (dialog) ----------
// icerik: HTML; formdaki alanlar submit'te nesne olarak döner. kaydet(veri) hata atarsa pencere açık kalır.
export function pencere({ baslik, icerik, kaydetMetin = 'Kaydet', iptalMetin = 'Vazgeç', genis = false, kaydet, acildi, tehlike = false, altBilgi = '', sinif = '' }) {
  return new Promise((coz) => {
    const d = document.createElement('dialog');
    d.className = 'pencere' + (genis ? ' genis' : '') + (sinif ? ' ' + sinif : '');
    d.innerHTML = String(html`<form method="dialog" novalidate>
      <header><h3>${baslik}</h3><button type="button" class="kapat" aria-label="Kapat">×</button></header>
      <div class="pencere-govde">${icerik}</div>
      <div class="pencere-hata" hidden></div>
      <footer>${altBilgi}<span class="bosluk"></span>
        ${iptalMetin ? html`<button type="button" class="btn ikincil vazgec">${iptalMetin}</button>` : ''}
        ${kaydetMetin ? html`<button type="submit" class="btn ${tehlike ? 'tehlike' : 'birincil'}">${kaydetMetin}</button>` : ''}
      </footer></form>`);
    document.body.append(d);
    const form = $('form', d);
    let bitti = false;
    const kapat = (v) => { if (bitti) return; bitti = true; d.close(); d.remove(); coz(v); };
    $('.kapat', d).onclick = () => kapat(null);
    const vz = $('.vazgec', d); if (vz) vz.onclick = () => kapat(null);
    d.addEventListener('cancel', (e) => { e.preventDefault(); kapat(null); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const veri = formVerisi(form);
      const hataEl = $('.pencere-hata', d);
      hataEl.hidden = true;
      if (!kaydet) return kapat(veri);
      const btn = $('button[type=submit]', d);
      btn.disabled = true;
      try {
        const sonuc = await kaydet(veri, d);
        if (sonuc === false) { btn.disabled = false; return; }
        kapat(sonuc === undefined ? veri : sonuc);
      } catch (err) {
        hataEl.textContent = err.message; hataEl.hidden = false; btn.disabled = false;
      }
    });
    d.showModal();
    const ilk = $('[autofocus]', d) || $('input:not([type=hidden]):not([readonly]), textarea, select', d);
    if (ilk && !matchMedia('(pointer: coarse)').matches) ilk.focus();
    if (acildi) acildi(d, kapat);
  });
}

export const onayla = (mesaj, { baslik = 'Emin misiniz?', evet = 'Evet', tehlike = false } = {}) =>
  pencere({ baslik, icerik: html`<p>${mesaj}</p>`, kaydetMetin: evet, tehlike }).then((v) => v !== null);

export const sor = (baslik, etiket, { zorunlu = false, deger = '', cok = false } = {}) =>
  pencere({
    baslik,
    icerik: html`<label class="alan"><span>${etiket}</span>${cok
      ? html`<textarea name="v" rows="3" ${zorunlu ? 'required' : ''}>${deger}</textarea>`
      : html`<input name="v" value="${deger}" ${zorunlu ? 'required' : ''}>`}</label>`,
    kaydet: (v) => { if (zorunlu && !v.v) throw new Error(`${etiket} gerekli.`); },
  }).then((v) => (v ? v.v : null));

export function formVerisi(form) {
  const v = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') v[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) v[el.name] = el.value; }
    else v[el.name] = el.value.trim();
  }
  return v;
}

// ---------- Otomatik tamamlamalı seçici ----------
// getir(q) -> Promise<dizi>, goster(oge) -> html, sec(oge)
// Aranan kelimeyi metinde vurgular (Türkçe büyük/küçük harf duyarsız)
export function vurgula(metin, q) {
  const m = String(metin ?? '');
  const kelimeler = String(q || '').trim().split(/\s+/).filter((k) => k.length >= 1).slice(0, 5);
  if (!kelimeler.length) return esc(m);
  const kucuk = m.toLocaleLowerCase('tr');
  const isaret = new Array(m.length).fill(false);
  for (const k of kelimeler) {
    const kk = k.toLocaleLowerCase('tr');
    for (let i = kucuk.indexOf(kk); i >= 0; i = kucuk.indexOf(kk, i + kk.length)) for (let j = i; j < i + kk.length && j < m.length; j++) isaret[j] = true;
  }
  let o = ''; let acik = false;
  for (let i = 0; i < m.length; i++) {
    if (isaret[i] && !acik) { o += '<mark>'; acik = true; } else if (!isaret[i] && acik) { o += '</mark>'; acik = false; }
    o += esc(m[i]);
  }
  return acik ? o + '</mark>' : o;
}

// Açılır seçim listesi (cari, ürün…).
// Liste sayfanın / pencerenin en üst katmanında, kutunun altında (yer yoksa üstünde) açılır; tablo ya da pencere içinde kesilmez.
// Telefonda ekranın altından açılan panel olur.
//  goster(o, q)        satır içeriği
//  yeni(q)             "+ Yeni …" seçeneği: oluşturulan kaydı döndürür (seçilmiş sayılır); yeniMetin: düğme yazısı
//  bulunamadi(metin)   yazılan metin listeden seçilmeden bırakılırsa (Enter / kutudan çıkma) çağrılır
//  sonKullanilan       anahtar: kutu boşken son seçilenler üstte gösterilir
//  genislik            en az liste genişliği (px)
export function secici(input, { getir, goster, sec, bosMetin = 'Sonuç yok', ekstra, bulunamadi, yeni, yeniMetin, sonKullanilan, genislik = 420 }) {
  const kutu = document.createElement('div');
  kutu.className = 'secici-liste';
  kutu.setAttribute('role', 'listbox');
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('aria-autocomplete', 'list');
  let ogeler = []; let aktif = -1; let zmn; let sira = 0; let sonSayi = 0;
  let yukleniyor = false; let enterBekliyor = false; // yazıp hemen Enter'a basılırsa güncel sonuç gelince seçilir
  const telefon = () => matchMedia('(max-width: 860px)').matches;
  const sonAnahtar = sonKullanilan ? `secici-son-${sonKullanilan}` : null;
  const sonlar = () => { try { return JSON.parse(localStorage.getItem(sonAnahtar) || '[]'); } catch { return []; } };
  const sonaEkle = (o) => {
    if (!sonAnahtar || !o?.id) return;
    try { localStorage.setItem(sonAnahtar, JSON.stringify([o.id, ...sonlar().filter((x) => x !== o.id)].slice(0, 5))); } catch { /* */ }
  };
  const acik = () => kutu.isConnected && !kutu.hidden;
  // Sayfa / tablo / pencere kayınca liste kutuyla birlikte gider (dinleyiciler yalnız liste açıkken)
  const kaydir = (e) => { if (e?.target && kutu.contains(e.target)) return; if (acik()) requestAnimationFrame(yerlestir); };
  const dinle = (ac) => {
    const f = ac ? addEventListener : removeEventListener;
    f('scroll', kaydir, true); f('resize', kaydir);
    if (window.visualViewport) (ac ? visualViewport.addEventListener : visualViewport.removeEventListener).call(visualViewport, 'resize', kaydir);
  };
  const kapat = () => { if (kutu.isConnected) dinle(false); kutu.hidden = true; kutu.remove(); input.setAttribute('aria-expanded', 'false'); };

  // Konum: kutunun yanına sabitlenir; dialog içindeyse dialog'a eklenir (üst katmanda kalsın)
  function yerlestir() {
    if (!acik()) return;
    if (!input.isConnected) { kapat(); return; }
    const r = input.getBoundingClientRect();
    const vv = window.visualViewport;
    const ekranY = vv ? vv.height : innerHeight; const ekranUst = vv ? vv.offsetTop : 0;
    const st = kutu.style;
    if (telefon()) {
      kutu.classList.add('alt-panel');
      Object.assign(st, { left: '0px', width: '100%', top: '', bottom: '', maxHeight: `${Math.round(ekranY * 0.5)}px` });
      const h = kutu.offsetHeight;
      const panelUst = ekranUst + ekranY - h;
      st.top = `${Math.round(panelUst)}px`;
      // Yazılan kutu panelin altında kalmasın: sayfayı kaydırıp kutuyu panelin üstüne getir
      if (r.bottom > panelUst - 8 || r.top < 0) window.scrollBy(0, r.bottom - (panelUst - 16));
    } else {
      kutu.classList.remove('alt-panel');
      const gen = Math.min(innerWidth - 16, Math.max(r.width, genislik));
      const sol = Math.max(8, Math.min(r.left, innerWidth - gen - 8));
      const alt = ekranUst + ekranY - r.bottom - 10; const ust = r.top - ekranUst - 10;
      const yukari = alt < 240 && ust > alt;
      const maxH = Math.max(160, Math.min(440, yukari ? ust : alt));
      Object.assign(st, { width: `${gen}px`, left: `${sol}px`, maxHeight: `${maxH}px`, bottom: '' });
      st.top = `${yukari ? r.top - Math.min(kutu.scrollHeight, maxH) - 4 : r.bottom + 4}px`;
      kutu.classList.toggle('yukari', yukari);
    }
    // Dönüşüm uygulanmış bir kabın içindeysek (ör. açılış animasyonlu pencere) sapmayı düzelt
    const k = kutu.getBoundingClientRect();
    const hedefX = parseFloat(st.left); const hedefY = parseFloat(st.top);
    if (Math.abs(k.left - hedefX) > 0.5) st.left = `${hedefX + (hedefX - k.left)}px`;
    if (Math.abs(k.top - hedefY) > 0.5) st.top = `${hedefY + (hedefY - k.top)}px`;
  }
  function goster2() {
    const kap = input.closest('dialog[open]') || document.body;
    if (!kutu.isConnected) dinle(true);
    if (kutu.parentElement !== kap) kap.append(kutu);
    kutu.hidden = false; input.setAttribute('aria-expanded', 'true');
    yerlestir();
  }

  const ciz = () => {
    const q = input.value.trim();
    const sonIdler = !q && sonAnahtar ? sonlar() : [];
    const sonOgeler = sonIdler.map((id) => ogeler.find((o) => o.id === id)).filter(Boolean);
    const baslik = (i) => (sonOgeler.length && i === 0 ? html`<div class="secici-grup">Son kullanılanlar</div>` : sonOgeler.length && i === sonOgeler.length ? html`<div class="secici-grup">Tümü</div>` : '');
    const yeniVar = (yeni || (bulunamadi && q));
    kutu.innerHTML = String(html`<div class="secici-ogeler">${ogeler.map((o, i) => html`${baslik(i)}<div class="secici-oge ${i === aktif ? 'aktif' : ''}" data-i="${i}" role="option">${goster(o, q)}</div>`)}
      ${!ogeler.length ? html`<div class="secici-bos">${yukleniyor ? 'Aranıyor…' : bosMetin}</div>` : ''}</div>
      ${ekstra && !yeni ? ekstra(input.value) : ''}
      ${yeniVar ? html`<div class="secici-oge secici-yeni ${aktif === ogeler.length ? 'aktif' : ''}" data-yeni-kart>+ ${yeni ? (yeniMetin || 'Yeni') : 'Yeni stok kartı aç'}${q ? html`: <b>"${q}"</b>` : ''}</div>` : ''}
      <div class="secici-ipucu"><span>↑↓ seç · Enter ${yeni || bulunamadi ? 'ekle' : 'seç'} · Esc kapat</span><span>${ogeler.length ? `${ogeler.length}${sonSayi >= 30 ? '+' : ''} sonuç` : ''}</span></div>`);
    // son kullanılanlar başa
    if (sonOgeler.length) {
      const liste = $('.secici-ogeler', kutu);
      const kalan = ogeler.filter((o) => !sonIdler.includes(o.id));
      ogeler = [...sonOgeler, ...kalan];
      liste.innerHTML = String(html`${ogeler.map((o, i) => html`${baslik(i)}<div class="secici-oge ${i === aktif ? 'aktif' : ''}" data-i="${i}" role="option">${goster(o, q)}</div>`)}`);
    }
    goster2();
    $('.secici-oge.aktif', kutu)?.scrollIntoView({ block: 'nearest' });
  };
  const yukle = async () => {
    const benim = ++sira;
    try {
      const s = await getir(input.value.trim()); if (benim !== sira) return;
      if (!input.isConnected || document.activeElement !== input) { yukleniyor = false; return; }
      ogeler = s; sonSayi = s.length; aktif = s.length ? 0 : -1; yukleniyor = false; ciz();
      if (enterBekliyor) { enterBekliyor = false; if (aktif >= 0) secildi(ogeler[aktif]); else bulunamadiSor(); }
    } catch { yukleniyor = false; enterBekliyor = false; }
  };
  // yazildi: odaklandıktan sonra kullanıcı yazdı mı? Yazmadan ↑↓/Enter listeyi değil tabloyu gezdirir (Excel gibi kalem tablosu).
  let yazildi = false;
  let secimYapildi = false;
  input.addEventListener('input', () => { yazildi = true; secimYapildi = false; yukleniyor = true; enterBekliyor = false; clearTimeout(zmn); zmn = setTimeout(yukle, 180); });
  input.addEventListener('focus', () => { yazildi = false; yukle(); });
  // Zaten odaktaysa (pencere açılınca kendiliğinden odaklanan kutu) ya da kapalıyken tıklanınca listeyi aç
  input.addEventListener('mousedown', () => { if (document.activeElement === input && !acik()) yukle(); });
  if (document.activeElement === input) setTimeout(yukle, 0);
  const enSon = () => ogeler.length - ((yeni || (bulunamadi && input.value.trim())) ? 0 : 1);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && e.altKey) { yazildi = true; if (!acik()) yukle(); e.preventDefault(); return; }
    if (e.key === 'Enter' && yazildi && yukleniyor) { e.preventDefault(); enterBekliyor = true; return; }
    if (!acik() || (!yazildi && input.closest('tr[data-i]'))) return;
    if (e.key === 'ArrowDown') { aktif = Math.min(aktif + 1, enSon()); ciz(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { aktif = Math.max(aktif - 1, 0); ciz(); e.preventDefault(); }
    else if (e.key === 'Enter' && aktif === ogeler.length && (yeni || bulunamadi)) { e.preventDefault(); yeniSec(); }
    else if (e.key === 'Enter' && aktif >= 0 && aktif < ogeler.length) { e.preventDefault(); secildi(ogeler[aktif]); }
    else if (e.key === 'Enter' && yazildi && bulunamadi && input.value.trim()) { e.preventDefault(); bulunamadiSor(); }
    else if (e.key === 'Escape') { kapat(); e.preventDefault(); e.stopPropagation(); } // pencereyi kapatmasın, yalnız listeyi
  });
  const secildi = (o) => { kapat(); secimYapildi = true; sonaEkle(o); sec(o, input); };
  // "+ Yeni …": yeni kayıt penceresi; kaydedilirse seçilmiş sayılır
  async function yeniSec() {
    if (yeni) {
      const q = input.value.trim(); kapat(); secimYapildi = true;
      const o = await yeni(q);
      if (o) { sonaEkle(o); sec(o, input); } else secimYapildi = false;
      return;
    }
    bulunamadiSor();
  }
  // Yazılan metin listede yoksa (Enter ile ya da kutudan çıkınca) bir kez sorulur
  function bulunamadiSor() {
    const deger = input.value.trim();
    if (!bulunamadi || !deger || secimYapildi || input.dataset.sorgulaniyor) return;
    kapat();
    input.dataset.sorgulaniyor = '1';
    Promise.resolve(bulunamadi(deger, input)).finally(() => { delete input.dataset.sorgulaniyor; });
  }
  kutu.addEventListener('mousedown', (e) => {
    e.preventDefault(); // odak kutuda kalsın
    if (e.target.closest('[data-yeni-kart]')) { yeniSec(); return; }
    const el = e.target.closest('[data-i]');
    if (el) secildi(ogeler[Number(el.dataset.i)]);
  });
  input.addEventListener('blur', () => {
    const deger = input.value.trim(); const yazdi = yazildi;
    setTimeout(() => {
      if (document.activeElement === input) return;
      kapat();
      // Yazılan metin listeden seçilmeden bırakıldıysa (Enter, Tab ya da başka yere tıklama)
      if (yazdi && deger && input.isConnected && input.value.trim() === deger) bulunamadiSor();
    }, 180);
  });
  return { kapat };
}

export function csvIndir(dosyaAdi, basliklar, satirlar) {
  const h = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const metin = [basliklar.map(h).join(';'), ...satirlar.map((s) => s.map(h).join(';'))].join('\r\n');
  const blob = new Blob(['﻿' + metin], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = dosyaAdi.endsWith('.csv') ? dosyaAdi : dosyaAdi + '.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- Yazdırma ----------
export function yazdir(icerik) {
  let el = $('#yazdir-alani');
  if (!el) { el = document.createElement('div'); el.id = 'yazdir-alani'; document.body.append(el); }
  el.innerHTML = String(icerik);
  const resimler = $$('img', el);
  Promise.all(resimler.map((r) => (r.complete ? 0 : new Promise((c) => { r.onload = r.onerror = c; }))))
    .then(() => setTimeout(() => window.print(), 50));
}

export const debounce = (f, ms = 250) => { let z; return (...a) => { clearTimeout(z); z = setTimeout(() => f(...a), ms); }; };

// Görseli küçültüp JPEG'e çevirir (telefon fotoğrafları 5-10 MB olabilir)
export function gorselKucult(dosya, enBuyuk = 1600, kalite = 0.82) {
  return new Promise((coz, reddet) => {
    const r = new Image();
    r.onload = () => {
      const oran = Math.min(1, enBuyuk / Math.max(r.width, r.height));
      const c = document.createElement('canvas');
      c.width = Math.round(r.width * oran); c.height = Math.round(r.height * oran);
      c.getContext('2d').drawImage(r, 0, 0, c.width, c.height);
      URL.revokeObjectURL(r.src);
      coz(c.toDataURL('image/jpeg', kalite));
    };
    r.onerror = () => reddet(new Error('Görsel okunamadı.'));
    r.src = URL.createObjectURL(dosya);
  });
}

export const bekleyen = (el) => { el.innerHTML = '<div class="yukleniyor"><span></span></div>'; };
