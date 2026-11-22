// Form tasarımı — şablon düzenleme ekranı.
// Solda A4 önizleme (metin kutularına doğrudan yazılır, logo sürüklenir / köşesinden büyütülür), sağda ayarlar.
import { api } from '../api.js';
import { html, ham, $, $$, bildir, pencere, onayla, zaman, yazdir, gorselKucult, debounce } from '../ui.js';
import {
  TUR_AD, BOLUM_AD, KOLON_AD, ALAN_AD, TOPLAM_AD, TEMALAR, YAZI_TIPLERI, KAGITLAR,
  belgeHtml, sayfaStili, ornekVeri, veriHazirla, ayarTamamla, alanlarTur, kalemliMi, varsayilanAyar,
  etiketlerTur, etiketVarsayilan, baslikVarsayilan,
} from '../form.js';
import { sablonOnbellekSil } from '../belgeler.js';

const ALANLAR_YER = [['{musteri}', 'Müşteri adı'], ['{tarih}', 'Belge tarihi'], ['{belge_no}', 'Belge no'], ['{toplam}', 'Genel toplam'],
  ['{gecerlilik}', 'Geçerlilik'], ['{vade}', 'Vade'], ['{firma}', 'Firma adı']];
const METIN_AD = { firma_ad: 'Firma adı', firma_bilgi: 'Firma bilgileri', giris: 'Giriş metni', notlar: 'Notlar / şartlar', banka: 'Banka bilgileri', alt: 'Alt bilgi' };
const anahtar = (ad, kontrol, etiket, ek = '') => html`<label class="fm-anahtar"><input type="checkbox" data-${ad}="${kontrol}" ${ek}><span class="fm-anahtar-iz"></span><span>${etiket}</span></label>`;

export default async function (el, [id], ctx) {
  const s = await api.get(`/sablonlar/${id}`);
  if (s.sistem) { bildir('Standart şablon değiştirilemez; kopyalayıp düzenleyin.', 'uyari', 5000); return ctx.git(`formlar?tur=${s.tur}`); }
  const tur = s.tur;
  let ayar = ayarTamamla(tur, s.ayar);
  let ad = s.ad;
  let veri = ornekVeri(tur);
  let degisti = false;
  const gecmis = [JSON.stringify({ ayar, ad })]; let gi = 0;
  ctx.baslik('Form tasarımı');

  el.innerHTML = String(html`
    <div class="fm-ust">
      <a href="#/formlar?tur=${tur}" class="btn-metin" data-geri>← Form tasarımı</a>
      <span class="rozet">${TUR_AD[tur]}</span>
      <b class="fm-ad" id="fm-ad-yazi"></b><span class="rozet turuncu" id="fm-degisti" hidden>kaydedilmedi</span>
      <span class="bosluk"></span>
      <button class="btn ikincil kucuk" data-a="geri" title="Geri al (Ctrl+Z)">↶</button>
      <button class="btn ikincil kucuk" data-a="ileri" title="İleri al (Ctrl+Y)">↷</button>
      <button class="btn ikincil" data-a="surumler">Sürümler</button>
      <button class="btn ikincil" data-a="dene">🖨 Deneme yazdır</button>
      <button class="btn tehlike-cizgi" data-a="sil">Sil</button>
      <button class="btn birincil" data-a="kaydet">✓ Kaydet</button>
    </div>
    <div class="fm-mobil-sekme"><button data-mg="ayar" class="aktif">Ayarlar</button><button data-mg="onizleme">Önizleme</button></div>
    <div class="fm-duzen mg-ayar">
      <div class="fm-sol">
        <div class="fm-onizleme-ust">
          <label>Önizleme verisi <select id="fm-veri"><option value="">Örnek veri</option></select></label>
          <span class="soluk fm-ipucu">Kesik çizgili kutulara tıklayıp yazın · logoyu sürükleyin, köşesinden büyütün</span>
        </div>
        <div class="fm-arac" id="fm-arac" hidden>
          <button data-k="bold" title="Kalın"><b>B</b></button><button data-k="italic" title="Eğik"><i>I</i></button><button data-k="underline" title="Altı çizili"><u>U</u></button>
          <span></span><button data-k="justifyLeft" title="Sola">⯇</button><button data-k="justifyCenter" title="Ortala">≡</button><button data-k="justifyRight" title="Sağa">⯈</button>
          <span></span><button data-k="kucult" title="Küçült">A−</button><button data-k="buyut" title="Büyüt">A+</button>
          <span></span><select data-alan-ekle><option value="">+ Alan ekle</option>${ALANLAR_YER.map(([k, a]) => html`<option value="${k}">${a}</option>`)}</select>
          <button data-k="otomatik" title="Bu kutuyu otomatik içeriğe döndür">↺ Otomatik</button>
        </div>
        <div class="fm-kagit-kap" id="fm-kagit-kap"><div class="fm-kagit" id="fm-kagit"></div></div>
      </div>
      <aside class="fm-panel" id="fm-panel"></aside>
    </div>`);

  const kagit = $('#fm-kagit', el); const panel = $('#fm-panel', el); const arac = $('#fm-arac', el);

  // ---------- Durum ----------
  const isaretle = (d = true) => { degisti = d; $('#fm-degisti', el).hidden = !d; };
  const kayit = () => {
    const j = JSON.stringify({ ayar, ad });
    if (j === gecmis[gi]) return;
    gecmis.splice(gi + 1); gecmis.push(j); if (gecmis.length > 80) gecmis.shift(); gi = gecmis.length - 1;
    isaretle();
  };
  const kayitGec = debounce(kayit, 500);
  const degistir = (f, { panelYenile = false } = {}) => { f(); kayit(); onizle(); if (panelYenile) panelCiz(); };

  // ---------- Önizleme ----------
  const sayfaBoyu = () => ({ A4: [794, 1123], A4Y: [1123, 794], A5: [559, 794] }[ayar.kagit] || [794, 1123]);
  function olcekle() {
    const kap = $('#fm-kagit-kap', el); const [g] = sayfaBoyu();
    const o = Math.min(1, (kap.clientWidth - 8) / g);
    kagit.style.transform = `scale(${o})`; kagit.dataset.olcek = o;
    kap.style.height = `${kagit.offsetHeight * o + 8}px`;
  }
  function onizle() {
    const [g, y] = sayfaBoyu();
    kagit.style.width = `${g}px`; kagit.style.minHeight = `${y}px`; kagit.style.padding = `${Math.round(ayar.kenar * 3.78)}px`;
    kagit.innerHTML = belgeHtml(ctx, tur, ayar, veri, { duzenle: true });
    $('#fm-ad-yazi', el).textContent = ad;
    baglaOnizleme();
    requestAnimationFrame(olcekle);
    // resimler yüklenince yükseklik değişir
    $$('img', kagit).forEach((i) => { if (!i.complete) i.addEventListener('load', olcekle, { once: true }); });
  }
  addEventListener('resize', olcekle);

  // Metin kutuları, logo
  let odak = null;
  function baglaOnizleme() {
    $$('[data-metin]', kagit).forEach((m) => {
      m.addEventListener('focus', () => { odak = m; arac.hidden = false; });
      m.addEventListener('input', () => { ayar.metin[m.dataset.metin] = m.innerHTML; kayitGec(); });
      m.addEventListener('blur', () => { kayit(); setTimeout(() => { if (!document.activeElement?.closest?.('#fm-arac, [data-metin]')) arac.hidden = true; }, 200); });
    });
    // Sabit yazılar (başlık, Sayın, Tarih, Toplam…): tek satır düz metin
    $$('[data-etiket]', kagit).forEach((m) => {
      const k = m.dataset.etiket;
      const yaz = (deger) => { if (k === 'baslik') ayar.baslik = deger; else ayar.etiket[k] = deger; };
      m.addEventListener('focus', () => { arac.hidden = true; odak = null; });
      m.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); m.blur(); } });
      m.addEventListener('paste', (e) => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ')); });
      m.addEventListener('input', () => {
        const d = m.textContent.replace(/\s+/g, ' ');
        yaz(d); kayitGec();
        const g = $(`[data-etiket-giris="${k}"]`, panel); if (g) g.value = d;
      });
      m.addEventListener('blur', () => {
        const d = m.textContent.replace(/\s+/g, ' ').trim();
        // boş bırakılırsa ya da varsayılanla aynıysa varsayılana döner
        const vars = k === 'baslik' ? baslikVarsayilan(tur, ayar.dil) : etiketVarsayilan(ayar.dil, k);
        if (!d || d === vars) { if (k === 'baslik') ayar.baslik = ''; else delete ayar.etiket[k]; } else yaz(d);
        kayit();
        const deger = k === 'baslik' ? ayar.baslik : ayar.etiket[k] || '';
        $$(`[data-etiket-giris="${k}"]`, panel).forEach((g) => { g.value = deger; });
        // aynı yazı belgede birden çok yerde geçebilir; yeniden çizmeden eşitle (odak kaybolmasın)
        $$(`[data-etiket="${k}"]`, kagit).forEach((x) => { x.textContent = deger || vars; });
      });
    });
    const logo = $('[data-logo]', kagit); if (!logo) return;
    const tut = $('[data-logo-boyut]', logo);
    const olcek = () => Number(kagit.dataset.olcek) || 1;
    tut?.addEventListener('pointerdown', (e) => {
      e.preventDefault(); e.stopPropagation(); tut.setPointerCapture(e.pointerId);
      const x0 = e.clientX; const g0 = logo.offsetWidth;
      const hareket = (ev) => { logo.style.width = `${Math.max(40, Math.min(600, g0 + (ev.clientX - x0) / olcek() * (ayar.logo.hiza === 'sag' ? -1 : 1)))}px`; };
      const bit = () => {
        tut.removeEventListener('pointermove', hareket); tut.removeEventListener('pointerup', bit);
        degistir(() => { ayar.logo.genislik = Math.round(logo.offsetWidth); }, { panelYenile: true });
      };
      tut.addEventListener('pointermove', hareket); tut.addEventListener('pointerup', bit);
    });
    logo.addEventListener('pointerdown', (e) => {
      if (e.target === tut) return;
      e.preventDefault(); logo.setPointerCapture(e.pointerId); logo.classList.add('suruk');
      const x0 = e.clientX;
      const hareket = (ev) => { logo.style.transform = `translateX(${(ev.clientX - x0) / olcek()}px)`; };
      const bit = (ev) => {
        logo.removeEventListener('pointermove', hareket); logo.removeEventListener('pointerup', bit); logo.classList.remove('suruk');
        const r = kagit.getBoundingClientRect(); const oran = (ev.clientX - r.left) / r.width;
        const hiza = oran < 0.36 ? 'sol' : oran < 0.64 ? 'orta' : 'sag';
        if (hiza !== ayar.logo.hiza) degistir(() => { ayar.logo.hiza = hiza; }, { panelYenile: true }); else logo.style.transform = '';
      };
      logo.addEventListener('pointermove', hareket); logo.addEventListener('pointerup', bit);
    });
  }

  // Biçim araç çubuğu
  arac.addEventListener('mousedown', (e) => { if (!e.target.closest('select')) e.preventDefault(); });
  arac.addEventListener('click', (e) => {
    const k = e.target.closest('[data-k]')?.dataset.k; if (!k || !odak) return;
    odak.focus();
    if (k === 'kucult' || k === 'buyut') {
      const mevcut = Number(document.queryCommandValue('fontSize')) || 3;
      document.execCommand('fontSize', false, String(Math.max(1, Math.min(7, mevcut + (k === 'buyut' ? 1 : -1)))));
    } else if (k === 'otomatik') {
      const ak = odak.dataset.metin;
      degistir(() => { ayar.metin[ak] = ak === 'banka' ? '' : null; });
      return;
    } else document.execCommand(k, false, null);
    ayar.metin[odak.dataset.metin] = odak.innerHTML; kayit();
  });
  $('[data-alan-ekle]', arac).addEventListener('change', (e) => {
    if (odak && e.target.value) { odak.focus(); document.execCommand('insertText', false, e.target.value); ayar.metin[odak.dataset.metin] = odak.innerHTML; kayit(); }
    e.target.value = '';
  });

  // ---------- Ayar paneli ----------
  const bolumHtml = (baslik, ic, acik = false) => html`<details class="fm-grup" ${acik ? 'open' : ''}><summary>${baslik}</summary><div class="fm-grup-ic">${ic}</div></details>`;
  const sirala = (tip, i, yon) => degistir(() => {
    const dizi = ayar[tip]; const j = i + yon; if (j < 0 || j >= dizi.length) return;
    [dizi[i], dizi[j]] = [dizi[j], dizi[i]];
  }, { panelYenile: true });

  function panelCiz() {
    const acik = new Set($$('details.fm-grup[open] summary', panel).map((x) => x.textContent));
    const ilk = !panel.children.length;
    const ac = (b) => ilk ? ['Şablon', 'Genel ayarlar'].includes(b) : acik.has(b);
    const tekNusha = ['makbuz', 'dis_servis'].includes(tur);
    panel.innerHTML = String(html`
      ${bolumHtml('Şablon', html`
        <label class="alan"><span>Şablon adı</span><input data-ad value="${ad}" maxlength="60"></label>
        <label class="alan"><span>Şablon tipi</span><input value="${TUR_AD[tur]}" readonly></label>
        <div class="satir2"><label class="alan"><span>Dil</span><select data-ayar="dil"><option value="tr">Türkçe</option><option value="en">İngilizce</option></select></label>
          <label class="alan"><span>Sayfa boyu</span><select data-ayar="kagit">${Object.entries(KAGITLAR).map(([k, a]) => html`<option value="${k}">${a}</option>`)}</select></label></div>
        <label class="alan"><span>Başlık</span><input data-etiket-giris="baslik" value="${ayar.baslik}" placeholder="${baslikVarsayilan(tur, ayar.dil)}" maxlength="80"></label>
        ${tekNusha ? html`<label class="alan"><span>Nüsha</span><select data-ayar-sayi="nusha"><option value="1">Tek nüsha</option><option value="2">Aynı sayfada 2 nüsha (asıl / suret)</option></select></label>` : ''}
        <label class="alan"><span>Tema</span><select data-ayar="tema">${Object.entries(TEMALAR).map(([k, t]) => html`<option value="${k}">${t.ad} — ${t.aciklama}</option>`)}</select></label>`, ac('Şablon'))}
      ${bolumHtml('Renk, yazı ve logo', html`
        <div class="fm-renk"><label class="alan"><span>Ana renk</span><input type="color" data-ayar="renk" value="${ayar.renk}"></label>
          <button class="btn ikincil kucuk" data-a="logo-renk">🎨 Logodan öner</button></div>
        <div class="satir2"><label class="alan"><span>Yazı tipi</span><select data-ayar="yazi_tipi">${YAZI_TIPLERI.map((y) => html`<option style="font-family:${y}">${y}</option>`)}</select></label>
          <label class="alan"><span>Yazı boyu: <b>${ayar.yazi_boyu}</b> px</span><input type="range" min="9" max="16" step="0.5" data-ayar-sayi="yazi_boyu" value="${ayar.yazi_boyu}"></label></div>
        <label class="alan"><span>Kenar boşluğu: <b>${ayar.kenar}</b> mm</span><input type="range" min="5" max="25" step="1" data-ayar-sayi="kenar" value="${ayar.kenar}"></label>
        <div class="alan"><span>Logo konumu</span><div class="fm-secenek">${[['sol', 'Sol'], ['orta', 'Orta'], ['sag', 'Sağ']].map(([k, a]) => html`<button data-hiza="${k}" class="${ayar.logo.hiza === k ? 'aktif' : ''}">${a}</button>`)}</div></div>
        <label class="alan"><span>Logo genişliği: <b>${ayar.logo.genislik}</b> px</span><input type="range" min="60" max="500" step="5" data-logo-gen value="${ayar.logo.genislik}"></label>
        <div class="alan"><span>Logo görseli</span><div class="btn-grup">
          <label class="btn ikincil kucuk">${ayar.logo.dosya ? 'Şablon logosunu değiştir' : 'Bu şablona özel logo yükle'}<input type="file" accept="image/*" data-gorsel="logo" hidden></label>
          ${ayar.logo.dosya ? html`<button class="btn ikincil kucuk" data-a="logo-firma">Firma logosuna dön</button>` : ''}</div></div>
        <div class="alan"><span>Antet şeridi (logo + firma yerine tam genişlik görsel)</span>
          <select data-serit><option value="yok">Kullanma</option><option value="firma">Ayarlar'daki teklif şeridi</option><option value="ozel">Bu şablona özel görsel</option></select>
          ${ayar.serit.kaynak === 'ozel' ? html`<label class="btn ikincil kucuk" style="margin-top:.4rem">${ayar.serit.dosya ? 'Şeridi değiştir' : 'Şerit görseli yükle'}<input type="file" accept="image/*" data-gorsel="serit" hidden></label>` : ''}</div>`, ac('Renk, yazı ve logo'))}
      ${bolumHtml('Bölümler (sıra ve görünürlük)', html`<ul class="fm-liste">${ayar.bolumler.map((b, i) => html`<li>
          ${anahtar('bolum', b.id, BOLUM_AD[b.id], b.goster ? 'checked' : '')}
          <span class="fm-sira"><button data-sira="bolumler" data-i="${i}" data-yon="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button data-sira="bolumler" data-i="${i}" data-yon="1" ${i === ayar.bolumler.length - 1 ? 'disabled' : ''}>↓</button></span></li>`)}</ul>`, ac('Bölümler (sıra ve görünürlük)'))}
      ${bolumHtml('Genel ayarlar', html`<div class="fm-anahtarlar">${alanlarTur(tur).map((a) => anahtar('alan', a, ALAN_AD[a], ayar.alan[a] ? 'checked' : ''))}</div>`, ac('Genel ayarlar'))}
      ${kalemliMi(tur) ? bolumHtml('Kolon ayarları', html`<p class="soluk fm-not">Göster / gizle, sırala, başlığını değiştir.</p><ul class="fm-liste">${ayar.kolonlar.map((k, i) => html`<li class="fm-kolon">
          ${anahtar('kolon', k.id, KOLON_AD[k.id], k.goster ? 'checked' : '')}
          <input class="fm-kolon-ad" data-kolon-ad="${k.id}" value="${k.ad || ''}" placeholder="Başlık" maxlength="30">
          <span class="fm-sira"><button data-sira="kolonlar" data-i="${i}" data-yon="-1" ${i === 0 ? 'disabled' : ''}>↑</button><button data-sira="kolonlar" data-i="${i}" data-yon="1" ${i === ayar.kolonlar.length - 1 ? 'disabled' : ''}>↓</button></span></li>`)}</ul>`, ac('Kolon ayarları')) : ''}
      ${kalemliMi(tur) ? bolumHtml('Dip toplam', html`<div class="fm-anahtarlar">${Object.entries(TOPLAM_AD).map(([k, a]) => anahtar('toplam', k, a, ayar.toplam[k] ? 'checked' : ''))}</div>`, ac('Dip toplam')) : ''}
      ${kalemliMi(tur) ? bolumHtml('QR kod', html`<p class="soluk fm-not">"Bölümler"den QR kodu açın. Müşteri telefonuyla okutur.</p>
        <label class="alan"><span>İçerik</span><select data-qr><option value="belge">Belge bilgisi (firma · belge no · tarih · tutar)</option><option value="ozel">Kendi metnim (ör. IBAN)</option></select></label>
        ${ayar.qr.icerik === 'ozel' ? html`<label class="alan"><span>QR metni</span><input data-qr-metin value="${ayar.qr.metin || ''}" placeholder="TR00 0000 0000 0000 0000 0000 00 · {firma}" maxlength="300"></label>` : ''}`, ac('QR kod')) : ''}
      ${bolumHtml('Sabit yazılar', html`<p class="soluk fm-not">Belgede geçen sabit yazılar. Boş bırakılan varsayılanı kullanır.
          Önizlemede bu yazılara (kesik altı çizili) tıklayıp doğrudan da yazabilirsiniz. Değişken kullanılabilir: <code>{musteri}</code> <code>{tarih}</code> <code>{belge_no}</code>…</p>
        <label class="alan"><span>Belge başlığı</span><input data-etiket-giris="baslik" value="${ayar.baslik}" placeholder="${baslikVarsayilan(tur, ayar.dil)}" maxlength="80"></label>
        <div class="fm-etiketler">${etiketlerTur(tur).map((k) => html`<label class="fm-etiket-satir"><span>${etiketVarsayilan('tr', k)}</span>
          <input data-etiket-giris="${k}" value="${ayar.etiket[k] || ''}" placeholder="${etiketVarsayilan(ayar.dil, k)}" maxlength="${k.startsWith('ekstre_') ? 200 : 80}"></label>`)}</div>
        <button class="btn ikincil kucuk" data-a="etiket-sifirla" style="margin-top:.5rem">↺ Tümünü varsayılana döndür</button>`, ac('Sabit yazılar'))}
      ${bolumHtml('Metin kutuları', html`<p class="soluk fm-not">Önizlemedeki kesik çizgili kutulara doğrudan yazın. Kutunun içine alan ekleyebilirsiniz
          (araç çubuğundaki "+ Alan ekle"): ${ALANLAR_YER.map(([k]) => html`<code>${k}</code> `)}</p>
        <ul class="fm-liste">${Object.entries(METIN_AD).map(([k, a]) => html`<li><span>${a}</span><span class="soluk">${ayar.metin[k] === null || ayar.metin[k] === undefined ? 'otomatik' : 'özel'}</span>
          ${ayar.metin[k] !== null && ayar.metin[k] !== undefined && k !== 'banka' ? html`<button class="btn-metin" data-oto="${k}">↺ otomatiğe dön</button>` : ''}</li>`)}</ul>`, ac('Metin kutuları'))}
      <p class="soluk fm-not">Tüm değişiklikler önizlemede anında görünür; kaydedince yazdırmada kullanılır. Her kayıtta önceki hal "Sürümler"de saklanır.</p>`);
    $('[data-ayar="dil"]', panel).value = ayar.dil;
    $('[data-ayar="kagit"]', panel).value = ayar.kagit;
    $('[data-ayar="tema"]', panel).value = ayar.tema;
    $('[data-ayar="yazi_tipi"]', panel).value = ayar.yazi_tipi;
    const n = $('[data-ayar-sayi="nusha"]', panel); if (n) n.value = String(ayar.nusha || 1);
    $('[data-serit]', panel).value = ayar.serit.kaynak;
    const q = $('[data-qr]', panel); if (q) q.value = ayar.qr.icerik;
  }

  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (t.matches('[data-ad]')) { ad = t.value.trim() || ad; $('#fm-ad-yazi', el).textContent = ad; kayitGec(); return; }
    if (t.matches('[data-etiket-giris]')) {
      const k = t.dataset.etiketGiris;
      if (k === 'baslik') ayar.baslik = t.value; else if (t.value.trim()) ayar.etiket[k] = t.value; else delete ayar.etiket[k];
      $$(`[data-etiket-giris="${k}"]`, panel).forEach((x) => { if (x !== t) x.value = t.value; });
      kayitGec(); onizle(); return;
    }
    if (t.matches('[data-ayar-sayi]')) {
      ayar[t.dataset.ayarSayi] = Number(t.value);
      const b = t.closest('label')?.querySelector('b'); if (b) b.textContent = t.value;
      kayitGec(); onizle(); return;
    }
    if (t.matches('[data-logo-gen]')) { ayar.logo.genislik = Number(t.value); t.closest('label').querySelector('b').textContent = t.value; kayitGec(); onizle(); return; }
    if (t.matches('[data-ayar="renk"]')) { ayar.renk = t.value; kayitGec(); onizle(); return; }
    if (t.matches('[data-kolon-ad]')) { ayar.kolonlar.find((k) => k.id === t.dataset.kolonAd).ad = t.value; kayitGec(); onizle(); return; }
    if (t.matches('[data-qr-metin]')) { ayar.qr.metin = t.value; kayitGec(); onizle(); }
  });
  panel.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('select[data-ayar]')) {
      const k = t.dataset.ayar;
      return degistir(() => {
        if (k === 'tema') { const v = varsayilanAyar(tur, t.value); ayar.tema = t.value; ayar.renk = v.renk; } else ayar[k] = t.value;
      }, { panelYenile: k === 'tema' });
    }
    if (t.matches('select[data-ayar-sayi]')) return degistir(() => { ayar[t.dataset.ayarSayi] = Number(t.value); });
    if (t.matches('[data-bolum]')) return degistir(() => { ayar.bolumler.find((b) => b.id === t.dataset.bolum).goster = t.checked; });
    if (t.matches('[data-alan]')) return degistir(() => { ayar.alan[t.dataset.alan] = t.checked; });
    if (t.matches('[data-kolon]')) return degistir(() => { ayar.kolonlar.find((k) => k.id === t.dataset.kolon).goster = t.checked; });
    if (t.matches('[data-toplam]')) return degistir(() => { ayar.toplam[t.dataset.toplam] = t.checked; });
    if (t.matches('[data-serit]')) return degistir(() => { ayar.serit.kaynak = t.value; }, { panelYenile: true });
    if (t.matches('[data-qr]')) return degistir(() => { ayar.qr.icerik = t.value; }, { panelYenile: true });
    if (t.matches('[data-gorsel]')) {
      const f = t.files[0]; if (!f) return;
      try {
        const { yol } = await api.post('/sablonlar/gorsel', { veri: await gorselKucult(f, 1800, 0.9) });
        degistir(() => { ayar[t.dataset.gorsel].dosya = yol; }, { panelYenile: true });
      } catch (h) { bildir(h.message, 'hata'); }
    }
  });
  panel.addEventListener('click', (e) => {
    const s2 = e.target.closest('[data-sira]');
    if (s2) return sirala(s2.dataset.sira, Number(s2.dataset.i), Number(s2.dataset.yon));
    const h = e.target.closest('[data-hiza]');
    if (h) return degistir(() => { ayar.logo.hiza = h.dataset.hiza; }, { panelYenile: true });
    const o = e.target.closest('[data-oto]');
    if (o) return degistir(() => { ayar.metin[o.dataset.oto] = null; }, { panelYenile: true });
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (a === 'logo-firma') return degistir(() => { ayar.logo.dosya = null; }, { panelYenile: true });
    if (a === 'logo-renk') return logodanRenk();
    if (a === 'etiket-sifirla') return degistir(() => { ayar.etiket = {}; ayar.baslik = ''; }, { panelYenile: true });
  });

  // Logodaki baskın rengi bul (beyaz / siyah / gri dışı; doygunluk × sıklık en yüksek renk kümesi)
  async function logodanRenk() {
    const kaynak = ayar.logo.dosya ? `/dosya/${ayar.logo.dosya}` : ctx.ayarlar.firma_logo ? `/logo?v=${encodeURIComponent(ctx.ayarlar.firma_logo)}` : null;
    if (!kaynak) return bildir('Önce bir logo yükleyin.', 'uyari');
    const r = new Image(); r.src = kaynak;
    await new Promise((c) => { r.onload = r.onerror = c; });
    if (!r.width) return bildir('Logo okunamadı.', 'hata');
    const c = document.createElement('canvas'); c.width = 80; c.height = Math.max(1, Math.round(80 * (r.height / r.width)));
    const g = c.getContext('2d'); g.drawImage(r, 0, 0, c.width, c.height);
    const d = g.getImageData(0, 0, c.width, c.height).data; const kova = new Map();
    for (let i = 0; i < d.length; i += 4) {
      const R = d[i]; const G = d[i + 1]; const B = d[i + 2]; if (d[i + 3] < 128) continue;
      const mx = Math.max(R, G, B); const mn = Math.min(R, G, B); if (mx - mn < 50 || mx < 40) continue;
      const k = `${R >> 5},${G >> 5},${B >> 5}`; const v = kova.get(k) || { puan: 0, adet: 0, r: 0, g: 0, b: 0 };
      v.puan += (mx - mn) / 255; v.adet++; v.r += R; v.g += G; v.b += B; kova.set(k, v);
    }
    const en = [...kova.values()].sort((x, y) => y.puan - x.puan)[0];
    if (!en) return bildir('Logoda belirgin bir renk bulunamadı.', 'uyari');
    const renk = '#' + [en.r, en.g, en.b].map((x) => Math.round(x / en.adet).toString(16).padStart(2, '0')).join('');
    degistir(() => { ayar.renk = renk; }, { panelYenile: true });
    bildir(`Logodan renk seçildi: ${renk}`, 'basari');
  }

  // ---------- Üst düğmeler ----------
  async function kaydet() {
    try {
      // Metin kutusunda bekleyen değişiklik
      const m = document.activeElement?.closest?.('[data-metin]'); if (m) ayar.metin[m.dataset.metin] = m.innerHTML;
      await api.put(`/sablonlar/${id}`, { ad, ayar });
      sablonOnbellekSil(); isaretle(false); bildir('Şablon kaydedildi', 'basari');
    } catch (h) { bildir(h.message, 'hata'); }
  }
  const gecmisYukle = () => { const o = JSON.parse(gecmis[gi]); ayar = o.ayar; ad = o.ad; isaretle(); onizle(); panelCiz(); };
  el.addEventListener('click', async (e) => {
    const mg = e.target.closest('[data-mg]');
    if (mg) {
      $$('[data-mg]', el).forEach((b) => b.classList.toggle('aktif', b === mg));
      $('.fm-duzen', el).className = `fm-duzen mg-${mg.dataset.mg}`; return requestAnimationFrame(olcekle);
    }
    if (e.target.closest('[data-geri]') && degisti) {
      e.preventDefault();
      if (await onayla('Kaydedilmemiş değişiklikler var. Kaydetmeden çıkılsın mı?', { evet: 'Kaydetmeden çık', tehlike: true })) { isaretle(false); ctx.git(`formlar?tur=${tur}`); }
      return;
    }
    const a = e.target.closest('.fm-ust [data-a]')?.dataset.a; if (!a) return;
    if (a === 'kaydet') return kaydet();
    if (a === 'geri' && gi > 0) { gi--; return gecmisYukle(); }
    if (a === 'ileri' && gi < gecmis.length - 1) { gi++; return gecmisYukle(); }
    if (a === 'dene') return yazdir(`<style>${sayfaStili(tur, ayar)}</style>${belgeHtml(ctx, tur, ayar, veri)}`);
    if (a === 'sil') {
      if (!await onayla('Bu şablon silinsin mi?', { evet: 'Sil', tehlike: true })) return;
      try { await api.del(`/sablonlar/${id}`); sablonOnbellekSil(); isaretle(false); ctx.git(`formlar?tur=${tur}`); } catch (h) { bildir(h.message, 'hata'); }
      return;
    }
    if (a === 'surumler') {
      const liste = await api.get(`/sablonlar/${id}/surumler`);
      const sec = await pencere({
        baslik: 'Önceki sürümler', kaydetMetin: liste.length ? 'Bu sürümü geri yükle' : '', iptalMetin: 'Kapat',
        icerik: liste.length ? html`<p class="soluk" style="margin-top:0">Her kayıtta önceki hal saklanır (son 10). Geri yüklenen sürüm önizlemeye gelir; beğenirseniz kaydedin.</p>
          <div class="sablon-sec">${liste.map((v, i) => html`<label class="kutu-sec"><input type="radio" name="surum" value="${v.id}" ${i === 0 ? 'checked' : ''}>
            ${zaman(v.zaman)} · ${v.ad}${v.ad_soyad ? html` <span class="soluk">(${v.ad_soyad})</span>` : ''}</label>`)}</div>`
          : html`<p>Henüz önceki sürüm yok. Şablonu her kaydettiğinizde önceki hali burada saklanır.</p>`,
      });
      if (sec?.surum) {
        const v = await api.get(`/sablonlar/${id}/surumler/${sec.surum}`);
        ayar = ayarTamamla(tur, v.ayar); ad = v.ad; kayit(); onizle(); panelCiz();
        bildir('Sürüm önizlemeye yüklendi. Kalıcı olması için Kaydet\'e basın.', 'bilgi', 5000);
      }
    }
  });
  const tuslar = (e) => {
    if (!el.isConnected) return removeEventListener('keydown', tuslar);
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); kaydet(); return; }
    if (e.target.closest?.('[data-metin], input, textarea')) return; // metin kutusunda tarayıcının kendi geri alması
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && gi > 0) { e.preventDefault(); gi--; gecmisYukle(); }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey)) && gi < gecmis.length - 1) { e.preventDefault(); gi++; gecmisYukle(); }
  };
  addEventListener('keydown', tuslar);
  const ayrilma = (e) => { if (!el.isConnected) return removeEventListener('beforeunload', ayrilma); if (degisti) { e.preventDefault(); e.returnValue = ''; } };
  addEventListener('beforeunload', ayrilma);

  // ---------- Önizleme verisi: gerçek belgeler ----------
  const veriSec = $('#fm-veri', el);
  try {
    let secenekler = [];
    if (tur === 'teklif' || tur === 'proforma') secenekler = (await api.get('/teklifler', { tur })).slice(0, 25).map((x) => [`/teklifler/${x.id}`, `${x.belge_no} · ${x.unvan}`]);
    else if (tur === 'satis_fisi') secenekler = (await api.get('/fisler')).slice(0, 25).map((x) => [`/fisler/${x.id}`, `${x.fis_no} · ${x.unvan}`]);
    else if (tur === 'dis_servis') secenekler = (await api.get('/dis-servis', { limit: 25 })).slice(0, 25).map((x) => [`/dis-servis/${x.id}`, `DS-${String(x.id).padStart(6, '0')} · ${x.unvan || ''} ${x.cihaz || ''}`]);
    veriSec.insertAdjacentHTML('beforeend', String(html`${secenekler.map(([v, a]) => html`<option value="${v}">${a}</option>`)}`));
    if (!secenekler.length) veriSec.title = 'Bu belge türü için gerçek veri seçimi yok; örnek veri kullanılır.';
  } catch { /* liste alınamazsa örnek veri */ }
  veriSec.addEventListener('change', async () => {
    try { veri = veriSec.value ? veriHazirla(tur, await api.get(veriSec.value)) : ornekVeri(tur); onizle(); } catch (h) { bildir(h.message, 'hata'); }
  });

  panelCiz();
  onizle();
}
void ham;
