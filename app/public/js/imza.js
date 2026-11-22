// Müşteri imzası: telefon ekranında parmakla imza
import { html, $ } from './ui.js';

export function imzaAl({ baslik = 'Müşteri teslim onayı', ad = '', tel = '', metin = '' } = {}) {
  return new Promise((coz) => {
    // <dialog> olarak açılır: başka bir pencerenin (ör. "Teslim et") üstünde de görünür ve kullanılabilir
    const el = document.createElement('dialog');
    el.className = 'tam-ekran imza-ekran imza-dialog';
    el.innerHTML = String(html`
      <div class="ust-cubuk"><b style="flex:1">${baslik}</b><button class="btn ikincil kucuk" data-kapat>Vazgeç</button></div>
      <div style="padding:.6rem .8rem;border-bottom:1px solid var(--cizgi);display:grid;grid-template-columns:1fr 1fr;gap:.5rem">
        <input name="ad" placeholder="Teslim alan ad soyad *" value="${ad}" autocomplete="name">
        <input name="tel" placeholder="Telefon" type="tel" value="${tel}">
        <input name="not" placeholder="Müşteri notu (isteğe bağlı)" style="grid-column:1/-1">
      </div>
      ${metin ? html`<div style="padding:.4rem .8rem;font-size:.85rem;color:var(--soluk)">${metin}</div>` : ''}
      <div class="imza-alan"><canvas></canvas><div class="imza-cizgi"></div><div class="imza-ipucu">Lütfen buraya imzalayın</div></div>
      <div class="alt-cubuk"><div class="imza-hata" style="flex-basis:100%;color:var(--kirmizi);font-weight:600" hidden></div>
        <button class="btn ikincil" data-temizle>Temizle</button><span class="bosluk"></span>
        <button class="btn basari buyuk" data-kaydet>İmzayı kaydet</button></div>`);
    document.body.append(el);
    el.showModal();
    const canvas = $('canvas', el);
    const g = canvas.getContext('2d');
    let ciziliyor = false; let bos = true; let son = null;
    const dpr = Math.max(1, window.devicePixelRatio || 1);

    const boyutla = () => {
      const r = canvas.getBoundingClientRect();
      const eski = bos ? null : canvas.toDataURL();
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.fillStyle = '#fff'; g.fillRect(0, 0, r.width, r.height);
      g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0b1f5c'; g.lineWidth = 2.6;
      if (eski) { const i = new Image(); i.onload = () => g.drawImage(i, 0, 0, r.width, r.height); i.src = eski; }
    };
    requestAnimationFrame(boyutla);
    window.addEventListener('resize', boyutla);

    const nokta = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.addEventListener('pointerdown', (e) => {
      e.preventDefault(); canvas.setPointerCapture(e.pointerId);
      ciziliyor = true; son = nokta(e);
      g.beginPath(); g.arc(son.x, son.y, 1.2, 0, Math.PI * 2); g.fillStyle = '#0b1f5c'; g.fill();
      if (bos) { bos = false; $('.imza-ipucu', el).hidden = true; }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!ciziliyor) return;
      const olaylar = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
      for (const o of olaylar) {
        const n = nokta(o);
        const orta = { x: (son.x + n.x) / 2, y: (son.y + n.y) / 2 };
        g.beginPath(); g.moveTo(son.x, son.y); g.quadraticCurveTo(son.x, son.y, orta.x, orta.y); g.lineTo(n.x, n.y); g.stroke();
        son = n;
      }
    });
    const bitir = () => { ciziliyor = false; };
    canvas.addEventListener('pointerup', bitir);
    canvas.addEventListener('pointercancel', bitir);

    const kapat = (v) => { window.removeEventListener('resize', boyutla); if (el.open) el.close(); el.remove(); coz(v); };
    el.addEventListener('cancel', (e) => { e.preventDefault(); kapat(null); });
    $('[data-kapat]', el).onclick = () => kapat(null);
    $('[data-temizle]', el).onclick = () => { bos = true; $('.imza-ipucu', el).hidden = false; boyutla(); };
    $('[data-kaydet]', el).onclick = () => {
      const h = $('.imza-hata', el);
      const adV = $('[name=ad]', el).value.trim();
      if (!adV) { h.textContent = 'Teslim alan kişinin adını yazın.'; h.hidden = false; return; }
      if (bos) { h.textContent = 'Lütfen imza atın.'; h.hidden = false; return; }
      // İmzayı makul boyuta indir (en fazla 900 px genişlik)
      const oran = Math.min(1, 900 / canvas.width);
      const c2 = document.createElement('canvas');
      c2.width = Math.round(canvas.width * oran); c2.height = Math.round(canvas.height * oran);
      c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
      kapat({ imza: c2.toDataURL('image/png'), teslim_alan_ad: adV, teslim_alan_tel: $('[name=tel]', el).value.trim(), musteri_notu: $('[name=not]', el).value.trim() });
    };
  });
}
