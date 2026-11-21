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
export function pencere({ baslik, icerik, kaydetMetin = 'Kaydet', iptalMetin = 'Vazgeç', genis = false, kaydet, acildi, tehlike = false, altBilgi = '' }) {
  return new Promise((coz) => {
    const d = document.createElement('dialog');
    d.className = 'pencere' + (genis ? ' genis' : '');
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
export function secici(input, { getir, goster, sec, bosMetin = 'Sonuç yok', ekstra }) {
  const kutu = document.createElement('div');
  kutu.className = 'secici-liste';
  kutu.hidden = true;
  input.parentElement.classList.add('secici-kap');
  input.after(kutu);
  input.setAttribute('autocomplete', 'off');
  let ogeler = []; let aktif = -1; let zmn; let sira = 0;
  const ciz = () => {
    kutu.innerHTML = String(html`${ogeler.map((o, i) => html`<div class="secici-oge ${i === aktif ? 'aktif' : ''}" data-i="${i}">${goster(o)}</div>`)}
      ${!ogeler.length ? html`<div class="secici-bos">${bosMetin}</div>` : ''}${ekstra ? ekstra(input.value) : ''}`);
    kutu.hidden = false;
  };
  const yukle = async () => {
    const benim = ++sira;
    try { const s = await getir(input.value.trim()); if (benim !== sira) return; ogeler = s; aktif = s.length ? 0 : -1; ciz(); } catch { /* */ }
  };
  input.addEventListener('input', () => { clearTimeout(zmn); zmn = setTimeout(yukle, 180); });
  input.addEventListener('focus', yukle);
  input.addEventListener('keydown', (e) => {
    if (kutu.hidden) return;
    if (e.key === 'ArrowDown') { aktif = Math.min(aktif + 1, ogeler.length - 1); ciz(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { aktif = Math.max(aktif - 1, 0); ciz(); e.preventDefault(); }
    else if (e.key === 'Enter' && aktif >= 0) { e.preventDefault(); secildi(ogeler[aktif]); }
    else if (e.key === 'Escape') { kutu.hidden = true; e.stopPropagation(); }
  });
  const secildi = (o) => { kutu.hidden = true; sec(o, input); };
  kutu.addEventListener('mousedown', (e) => {
    const el = e.target.closest('[data-i]');
    if (el) { e.preventDefault(); secildi(ogeler[Number(el.dataset.i)]); }
  });
  input.addEventListener('blur', () => setTimeout(() => { kutu.hidden = true; }, 150));
  return { kapat: () => { kutu.hidden = true; } };
}

// ---------- Tablo / CSV ----------
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
