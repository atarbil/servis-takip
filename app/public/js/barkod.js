// Telefon kamerasıyla barkod okuma.
// Android Chrome: tarayıcının kendi BarcodeDetector'ı. iPhone/diğerleri: ZXing kütüphanesi (ilk kullanımda yüklenir).
// Kamera açılamazsa barkod elle yazılabilir; USB/Bluetooth barkod okuyucular da yazma kutusuna okutabilir.
import { html, $ } from './ui.js';

const ZXING_URL = 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js';
const BICIMLER = ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];

function zxingYukle() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  return new Promise((coz, reddet) => {
    const s = document.createElement('script');
    s.src = ZXING_URL; s.async = true;
    s.onload = () => (window.ZXing ? coz(window.ZXing) : reddet(new Error('ZXing yüklenemedi')));
    s.onerror = () => reddet(new Error('Barkod kütüphanesi indirilemedi'));
    document.head.append(s);
  });
}

export function barkodOku({ baslik = 'Barkod okutun' } = {}) {
  return new Promise((coz) => {
    // <dialog>: açık bir pencerenin (ör. iş ekle) üstünde de görünür
    const el = document.createElement('dialog');
    el.className = 'tam-ekran imza-dialog';
    el.innerHTML = String(html`
      <div class="ust-cubuk"><b style="flex:1">${baslik}</b><button class="btn ikincil kucuk" data-kapat>Kapat</button></div>
      <div style="position:relative;flex:1;min-height:0;display:flex">
        <video playsinline muted autoplay></video>
        <div class="tarama-cerceve"><div class="tarama-cizgi"></div></div>
        <div class="tarama-mesaj" style="position:absolute;left:0;right:0;bottom:12px;text-align:center;color:#fff;font-weight:600;text-shadow:0 1px 3px #000">Kamera açılıyor…</div>
      </div>
      <form class="alt-cubuk"><input name="b" placeholder="veya barkodu elle yazın" inputmode="numeric" autocomplete="off"><button class="btn birincil">Tamam</button></form>`);
    document.body.append(el);
    el.showModal();
    const video = $('video', el);
    const mesaj = $('.tarama-mesaj', el);
    let akis = null; let zamanlayici = null; let okuyucu = null; let bitti = false;

    const kapat = (sonuc) => {
      if (bitti) return; bitti = true;
      clearInterval(zamanlayici);
      try { okuyucu?.reset(); } catch { /* */ }
      akis?.getTracks().forEach((t) => t.stop());
      if (el.open) el.close();
      el.remove();
      coz(sonuc ? String(sonuc).trim() : null);
    };
    const bulundu = (deger) => {
      if (!deger) return;
      if (navigator.vibrate) navigator.vibrate(90);
      kapat(deger);
    };
    $('[data-kapat]', el).onclick = () => kapat(null);
    el.addEventListener('cancel', (e) => { e.preventDefault(); kapat(null); });
    $('form', el).onsubmit = (e) => { e.preventDefault(); const v = e.target.b.value.trim(); if (v) kapat(v); };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        mesaj.textContent = 'Bu tarayıcı kamerayı desteklemiyor. Barkodu elle yazın.';
        return;
      }
      try {
        if ('BarcodeDetector' in window) {
          const destek = await window.BarcodeDetector.getSupportedFormats().catch(() => BICIMLER);
          const dedektor = new window.BarcodeDetector({ formats: BICIMLER.filter((b) => destek.includes(b)) });
          akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
          if (bitti) return akis.getTracks().forEach((t) => t.stop());
          video.srcObject = akis;
          await video.play().catch(() => {});
          mesaj.textContent = 'Barkodu çerçevenin içine tutun';
          let mesgul = false;
          zamanlayici = setInterval(async () => {
            if (mesgul || video.readyState < 2) return;
            mesgul = true;
            try { const s = await dedektor.detect(video); if (s.length) bulundu(s[0].rawValue); } catch { /* */ }
            mesgul = false;
          }, 140);
        } else {
          mesaj.textContent = 'Barkod okuyucu hazırlanıyor…';
          const ZX = await zxingYukle();
          if (bitti) return;
          const ipuclari = new Map();
          ipuclari.set(ZX.DecodeHintType.TRY_HARDER, true);
          okuyucu = new ZX.BrowserMultiFormatReader(ipuclari, 150);
          mesaj.textContent = 'Barkodu çerçevenin içine tutun';
          await okuyucu.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video, (sonuc) => {
            if (sonuc) bulundu(sonuc.getText());
          });
        }
      } catch (e) {
        console.warn(e);
        mesaj.textContent = e.name === 'NotAllowedError'
          ? 'Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya barkodu elle yazın.'
          : 'Kamera açılamadı. Barkodu elle yazabilirsiniz.';
      }
    })();
  });
}
