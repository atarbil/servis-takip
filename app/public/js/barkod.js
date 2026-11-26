// Telefon kamerasıyla barkod okuma (iPhone ve Android).
// Birden çok çözücü sırayla denenir; hangisi önce okursa o kazanır:
//   1. Yerleşik çözücü (barkodCoz.js): her tarayıcıda çalışır, internet gerekmez. EAN-13/8, UPC-A, Code 128.
//   2. Tarayıcının BarcodeDetector'ı (Android Chrome): QR, Code 39 vb. dahil.
//   3. ZXing kütüphanesi (önce sunucudan /vendor, olmazsa CDN): diğer tüm biçimler, iPhone'da QR.
// Görüntü çerçeve bölgesinden kırpılıp büyütülür; telefon uzaktan tutulsa da çizgiler seçilebilir.
// Odak için ekrana dokunulabilir; destekleyen cihazlarda fener, yakınlaştırma ve kamera değiştirme vardır.
// Kamera açılamazsa barkod elle yazılabilir; USB/Bluetooth barkod okuyucular da yazma kutusuna okutabilir.
import { html, $ } from './ui.js';
import { barkodCoz, eanGecerli } from './barkodCoz.js';

const ZXING_KAYNAKLAR = ['/vendor/zxing.min.js', 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js'];
const BICIMLER = ['ean_13', 'ean_8', 'code_128', 'code_39', 'code_93', 'upc_a', 'upc_e', 'itf', 'codabar', 'qr_code', 'data_matrix'];
const KAMERA_ANAHTAR = 'barkod-kamera';

let zxingSoz = null;
function zxingYukle() {
  if (window.ZXing) return Promise.resolve(window.ZXing);
  if (zxingSoz) return zxingSoz;
  const dene = (i) => new Promise((coz, reddet) => {
    if (i >= ZXING_KAYNAKLAR.length) return reddet(new Error('ZXing yüklenemedi'));
    const s = document.createElement('script');
    s.src = ZXING_KAYNAKLAR[i]; s.async = true;
    s.onload = () => (window.ZXing ? coz(window.ZXing) : dene(i + 1).then(coz, reddet));
    s.onerror = () => { s.remove(); dene(i + 1).then(coz, reddet); };
    document.head.append(s);
  });
  zxingSoz = dene(0).catch((e) => { zxingSoz = null; throw e; });
  return zxingSoz;
}

// Ses bağlamı pencere açılırken (dokunuşla) kurulur; iPhone sonradan kurulanı susturur
function sesHazirla() {
  try {
    const Ses = window.AudioContext || window.webkitAudioContext; if (!Ses) return null;
    const c = new Ses(); c.resume?.().catch(() => {}); return c;
  } catch { return null; }
}
function bip(c) {
  try {
    if (!c) return;
    const o = c.createOscillator(); const g = c.createGain();
    o.frequency.value = 1760; o.type = 'square'; g.gain.value = 0.06;
    o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime + 0.09);
  } catch { /* ses yoksa sorun değil */ }
}

const yerel = { al(k) { try { return localStorage.getItem(k); } catch { return null; } }, yaz(k, v) { try { localStorage.setItem(k, v); } catch { /* */ } } };

// Okunan değeri düzelt: EAN/UPC sağlama hanesi tutmuyorsa kabul etme
function gecerliMi(metin, bicim) {
  if (!metin) return false;
  if (/^(ean_13|ean_8|upc_a)$/.test(bicim || '') || /^(EAN_13|EAN_8|UPC_A)$/.test(bicim || '')) {
    const s = metin.length === 12 ? '0' + metin : metin;
    return eanGecerli(s);
  }
  return true;
}

// surekli(barkod) verilirse kamera açık kalır: her okumada çağrılır, dönen metin ekranda listelenir; "Bitti" ile kapanır.
export function barkodOku({ baslik = 'Barkod okutun', surekli = null } = {}) {
  return new Promise((coz) => {
    const el = document.createElement('dialog');
    el.className = 'tam-ekran imza-dialog barkod-ekran';
    el.innerHTML = String(html`
      <div class="ust-cubuk"><b style="flex:1">${baslik}</b><button class="btn ${surekli ? 'basari' : 'ikincil'} kucuk" data-kapat>${surekli ? 'Bitti' : 'Kapat'}</button></div>
      ${surekli ? html`<div class="barkod-okunanlar" hidden></div>` : ''}
      <div class="barkod-alan">
        <video playsinline muted autoplay></video>
        <div class="tarama-cerceve"><div class="tarama-cizgi"></div></div>
        <div class="barkod-dugmeler">
          <button type="button" class="barkod-dugme" data-fener hidden title="Fener">🔦</button>
          <button type="button" class="barkod-dugme" data-degistir hidden title="Kamera değiştir">🔄</button>
        </div>
        <div class="barkod-zoom" hidden><span>−</span><input type="range" data-zoom><span>+</span></div>
        <div class="tarama-mesaj">Kamera açılıyor…</div>
        <div class="barkod-tani"></div>
      </div>
      <form class="alt-cubuk"><input name="b" placeholder="veya barkodu elle yazın" inputmode="numeric" autocomplete="off"><button class="btn birincil">Tamam</button></form>`);
    document.body.append(el);
    el.showModal();
    const ses = sesHazirla();
    const video = $('video', el);
    const mesaj = $('.tarama-mesaj', el);
    const tani = $('.barkod-tani', el);
    const cerceve = $('.tarama-cerceve', el);
    let akis = null; let iz = null; let bitti = false; let dongu = null; let kameralar = []; let fener = false;
    const tuval = document.createElement('canvas');
    const cx = tuval.getContext('2d', { willReadFrequently: true });
    const motorlar = { yerlesik: true, yerel: null, zxing: null };
    let zxOkuyucu = null;
    let sayac = 0; let sonOkuma = { metin: '', zaman: 0, kaynak: '' };

    const kapat = (sonuc) => {
      if (bitti) return; bitti = true;
      clearTimeout(dongu);
      akis?.getTracks().forEach((t) => t.stop());
      setTimeout(() => ses?.close().catch(() => {}), 400);
      if (el.open) el.close();
      el.remove();
      coz(sonuc ? String(sonuc).trim() : null);
    };
    let mesgul = false; let sonEklenen = { deger: '', zaman: 0 }; let adet = 0;
    const okunanlar = $('.barkod-okunanlar', el);
    const listeyeYaz = (metin, hata = false) => {
      if (!okunanlar) return;
      okunanlar.hidden = false;
      const d = document.createElement('div'); d.className = hata ? 'hata' : ''; d.textContent = metin;
      okunanlar.prepend(d);
      while (okunanlar.children.length > 4) okunanlar.lastElementChild.remove();
    };
    const surekliIsle = (deger) => {
      const t = Date.now();
      if (mesgul || (deger === sonEklenen.deger && t - sonEklenen.zaman < 2000)) return;
      mesgul = true; sonEklenen = { deger, zaman: t };
      cerceve.classList.add('okundu'); bip(ses); if (navigator.vibrate) navigator.vibrate(90);
      Promise.resolve().then(() => surekli(deger))
        .then((m) => { if (m !== false) { adet++; $('[data-kapat]', el).textContent = `Bitti (${adet})`; } listeyeYaz(typeof m === 'string' ? m : `✓ ${deger}`, m === false); })
        .catch((e) => listeyeYaz(e.message || 'Eklenemedi', true))
        .finally(() => setTimeout(() => { mesgul = false; cerceve.classList.remove('okundu'); sonEklenen.zaman = Date.now(); }, 900));
    };
    const bulundu = (deger) => {
      if (!deger || bitti) return;
      if (surekli) { surekliIsle(deger); return; }
      cerceve.classList.add('okundu');
      bip(ses);
      if (navigator.vibrate) navigator.vibrate(90);
      setTimeout(() => kapat(deger), 120);
    };
    // Yerleşik çözücü kendi içinde iki tarama çizgisiyle doğrular; diğerleri iki kare üst üste aynı sonucu vermeli
    const aday = (metin, kaynak, kesin = false) => {
      if (!metin) return false;
      const t = Date.now();
      if (kesin || (sonOkuma.metin === metin && t - sonOkuma.zaman < 2500)) { bulundu(metin); return true; }
      sonOkuma = { metin, zaman: t, kaynak };
      return false;
    };
    $('[data-kapat]', el).onclick = () => kapat(null);
    el.addEventListener('cancel', (e) => { e.preventDefault(); kapat(null); });
    $('form', el).onsubmit = (e) => {
      e.preventDefault(); const v = e.target.b.value.trim(); if (!v) return;
      if (surekli) { e.target.b.value = ''; sonEklenen = { deger: '', zaman: 0 }; surekliIsle(v); } else kapat(v);
    };

    const taniYaz = () => {
      const a = [];
      a.push('yerleşik');
      if (motorlar.yerel) a.push('cihaz');
      if (motorlar.zxing) a.push('ZXing');
      const ayar = iz?.getSettings?.() || {};
      tani.textContent = `${a.join(' + ')} · ${ayar.width || video.videoWidth || '?'}×${ayar.height || video.videoHeight || '?'} · ${sayac} kare`;
    };

    // Çerçevenin video üzerindeki karşılığı (object-fit: cover hesabı), biraz pay bırakarak
    const kirpma = () => {
      const W = video.videoWidth; const H = video.videoHeight;
      const vr = video.getBoundingClientRect(); const fr = cerceve.getBoundingClientRect();
      if (!W || !H || !vr.width) return { x: 0, y: 0, w: W, h: H };
      const olcek = Math.max(vr.width / W, vr.height / H);
      const ox = (vr.width - W * olcek) / 2; const oy = (vr.height - H * olcek) / 2;
      const payX = fr.width * 0.12; const payY = fr.height * 0.35;
      let x = (fr.left - vr.left - ox - payX) / olcek; let y = (fr.top - vr.top - oy - payY) / olcek;
      let w = (fr.width + 2 * payX) / olcek; let h = (fr.height + 2 * payY) / olcek;
      x = Math.max(0, x); y = Math.max(0, y); w = Math.min(W - x, w); h = Math.min(H - y, h);
      return { x, y, w, h };
    };
    const ciz = (k, hedefGen) => {
      const s = Math.min(3, Math.max(0.4, hedefGen / k.w));
      tuval.width = Math.round(k.w * s); tuval.height = Math.round(k.h * s);
      cx.imageSmoothingEnabled = true; cx.imageSmoothingQuality = 'high';
      cx.drawImage(video, k.x, k.y, k.w, k.h, 0, 0, tuval.width, tuval.height);
      return cx.getImageData(0, 0, tuval.width, tuval.height);
    };

    const tara = async () => {
      if (bitti) return;
      if (mesgul) { dongu = setTimeout(tara, 150); return; }
      if (video.readyState >= 2 && video.videoWidth) {
        sayac++;
        try {
          const tam = sayac % 4 === 0; // ara sıra tüm görüntü (barkod çerçevenin dışındaysa)
          const k = tam ? { x: 0, y: 0, w: video.videoWidth, h: video.videoHeight } : kirpma();
          const img = ciz(k, tam ? 1280 : 1100);
          const r = barkodCoz(img);
          if (r && gecerliMi(r.metin, r.bicim)) return aday(r.bicim === 'upc_a' && r.metin.length === 13 ? r.metin.slice(1) : r.metin, 'yerleşik', true);
          if (motorlar.yerel) {
            const s = await motorlar.yerel.detect(tuval).catch(() => []);
            const b = s.find((x) => gecerliMi(x.rawValue, x.format));
            if (b && aday(b.rawValue, 'cihaz')) return;
          }
          if (motorlar.zxing && zxOkuyucu && sayac % 2 === 0) {
            const ZX = motorlar.zxing;
            try {
              const kaynak = new ZX.HTMLCanvasElementLuminanceSource(tuval);
              const sonuc = zxOkuyucu.decodeWithState(new ZX.BinaryBitmap(new ZX.HybridBinarizer(kaynak)));
              const ad = ZX.BarcodeFormat[sonuc.getBarcodeFormat()];
              if (gecerliMi(sonuc.getText(), ad) && aday(sonuc.getText(), 'ZXing')) return;
            } catch { /* bu karede yok */ }
          }
        } catch (e) { console.warn(e); }
        if (sayac % 5 === 0) taniYaz();
      }
      dongu = setTimeout(tara, 90);
    };

    const kameraAc = async (cihazId) => {
      akis?.getTracks().forEach((t) => t.stop());
      const video_ = {
        width: { ideal: 1920 }, height: { ideal: 1080 },
        ...(cihazId ? { deviceId: { exact: cihazId } } : { facingMode: { ideal: 'environment' } }),
      };
      try {
        akis = await navigator.mediaDevices.getUserMedia({ video: video_, audio: false });
      } catch (e) {
        if (!cihazId) throw e;
        akis = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
      }
      if (bitti) { akis.getTracks().forEach((t) => t.stop()); return; }
      iz = akis.getVideoTracks()[0];
      video.srcObject = akis;
      await video.play().catch(() => {});
      const yetenek = iz.getCapabilities?.() || {};
      // Sürekli odak (Android Chrome destekler; iPhone zaten sürekli odaklar)
      if (yetenek.focusMode?.includes('continuous')) await iz.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {});
      $('[data-fener]', el).hidden = !yetenek.torch;
      fener = false;
      const zoomKutu = $('.barkod-zoom', el); const zoom = $('[data-zoom]', el);
      if (yetenek.zoom && yetenek.zoom.max > yetenek.zoom.min) {
        zoomKutu.hidden = false;
        zoom.min = yetenek.zoom.min; zoom.max = Math.min(yetenek.zoom.max, 8); zoom.step = yetenek.zoom.step || 0.1;
        zoom.value = iz.getSettings().zoom || yetenek.zoom.min;
        zoom.oninput = () => iz.applyConstraints({ advanced: [{ zoom: Number(zoom.value) }] }).catch(() => {});
      } else zoomKutu.hidden = true;
      const ayar = iz.getSettings?.() || {};
      if (ayar.deviceId) yerel.yaz(KAMERA_ANAHTAR, ayar.deviceId);
      // Arka kameralar (iPhone Pro'da geniş/ultra geniş/tele ayrı görünür; yakından odaklamayan olursa değiştirilir)
      try {
        const hepsi = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
        const arka = hepsi.filter((d) => !/front|ön|user|facetime/i.test(d.label));
        kameralar = arka.length > 1 ? arka : hepsi;
      } catch { kameralar = []; }
      $('[data-degistir]', el).hidden = kameralar.length < 2;
      mesaj.textContent = 'Barkodu çerçevenin içine tutun · bulanıksa ekrana dokunun';
      taniYaz();
    };

    // Ekrana dokununca yeniden odakla
    $('.barkod-alan', el).addEventListener('click', async (e) => {
      if (e.target.closest('button, input') || !iz) return;
      const yetenek = iz.getCapabilities?.() || {};
      const r = video.getBoundingClientRect();
      const nokta = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
      try {
        if (yetenek.focusMode?.includes('single-shot')) {
          await iz.applyConstraints({ advanced: [{ focusMode: 'single-shot', pointsOfInterest: [nokta] }] });
          setTimeout(() => iz?.applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(() => {}), 1500);
        } else if (yetenek.focusMode?.includes('continuous')) {
          await iz.applyConstraints({ advanced: [{ focusMode: 'manual' }] }).catch(() => {});
          await iz.applyConstraints({ advanced: [{ focusMode: 'continuous', pointsOfInterest: [nokta] }] });
        }
      } catch { /* desteklenmiyor */ }
      mesaj.textContent = 'Odaklanıyor… Telefonu biraz uzaklaştırmak da işe yarar';
    });
    $('[data-fener]', el).onclick = async () => {
      fener = !fener;
      await iz?.applyConstraints({ advanced: [{ torch: fener }] }).catch(() => { fener = false; });
      $('[data-fener]', el).classList.toggle('acik', fener);
    };
    $('[data-degistir]', el).onclick = async () => {
      if (kameralar.length < 2) return;
      const simdiki = iz?.getSettings?.().deviceId;
      const i = kameralar.findIndex((k) => k.deviceId === simdiki);
      const sonraki = kameralar[(i + 1) % kameralar.length];
      mesaj.textContent = `Kamera: ${sonraki.label || 'diğer kamera'}`;
      try { await kameraAc(sonraki.deviceId); mesaj.textContent = `${sonraki.label || 'Kamera'} · barkodu çerçeveye tutun`; } catch { mesaj.textContent = 'Bu kamera açılamadı.'; }
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        mesaj.textContent = 'Bu tarayıcı kamerayı desteklemiyor. Barkodu elle yazın.';
        return;
      }
      try {
        await kameraAc(yerel.al(KAMERA_ANAHTAR));
        if (bitti) return;
        tara();
        // Yardımcı motorlar arka planda hazırlanır; tarama beklemez
        if ('BarcodeDetector' in window) {
          try {
            const destek = await window.BarcodeDetector.getSupportedFormats().catch(() => BICIMLER);
            const b = BICIMLER.filter((x) => destek.includes(x));
            if (b.length) motorlar.yerel = new window.BarcodeDetector({ formats: b });
          } catch { /* */ }
        }
        zxingYukle().then((ZX) => {
          const ipucu = new Map();
          ipucu.set(ZX.DecodeHintType.TRY_HARDER, true);
          zxOkuyucu = new ZX.MultiFormatReader(); zxOkuyucu.setHints(ipucu);
          motorlar.zxing = ZX; taniYaz();
        }).catch(() => {});
      } catch (e) {
        console.warn(e);
        mesaj.textContent = e.name === 'NotAllowedError'
          ? 'Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya barkodu elle yazın.'
          : 'Kamera açılamadı. Barkodu elle yazabilirsiniz.';
      }
    })();
  });
}
