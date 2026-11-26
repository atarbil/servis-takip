// Telefon arayüzü ortak parçaları
import { html } from '../ui.js';

// Alttan açılan işlem listesi; seçilen öğenin anahtarını döndürür (vazgeçilirse null)
export function islemListesi(baslik, ogeler) {
  return new Promise((coz) => {
    const d = document.createElement('dialog');
    d.className = 'mk-sayfacik';
    d.innerHTML = String(html`<div class="mk-sayfacik-ic"><div class="mk-sayfacik-tut"></div>${baslik ? html`<h4>${baslik}</h4>` : ''}
      ${ogeler.filter(Boolean).map((o) => html`<button type="button" data-k="${o.k}" class="${o.tehlike ? 'tehlike' : ''}">${o.ad}</button>`)}
      <button type="button" data-k="" class="vazgec">Vazgeç</button></div>`);
    document.body.append(d);
    let bitti = false;
    const kapat = (v) => { if (bitti) return; bitti = true; if (d.open) d.close(); d.remove(); coz(v || null); };
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]');
      if (b) kapat(b.dataset.k);
      else if (e.target === d) kapat(null);
    });
    d.addEventListener('cancel', (e) => { e.preventDefault(); kapat(null); });
    d.showModal();
  });
}

// Üst çubuk düğmesi
export function ustDugme(metin, onclick, { etiket = metin, sinif = '' } = {}) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `mk-ust-dugme ${sinif}`; b.textContent = metin; b.setAttribute('aria-label', etiket);
  b.onclick = onclick;
  return b;
}

// Sayfadaki el içinde data-a="…" düğmesine tıklanmış gibi davranır (ortak işlem kodunu çalıştırmak için)
export function tetikle(el, nitelik, deger) {
  const b = document.createElement('button');
  b.type = 'button'; b.hidden = true; b.setAttribute(nitelik, deger);
  el.append(b); b.click(); b.remove();
}
