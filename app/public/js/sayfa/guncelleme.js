// Programı güncelle: GitHub'daki yeni sürümü sunucudaki güncelleme servisi aracılığıyla kurar.
import { api } from '../api.js';
import { html, $, zaman, bildir, pencere } from '../ui.js';

const ADIMLAR = [
  ['yedek', 'Yedek alınıyor'],
  ['GitHub', 'Yeni sürüm indiriliyor'],
  ['yeniden başlatılıyor', 'Program yeniden başlatılıyor'],
  ['açılıyor', 'Program açılıyor'],
];
const bekle = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function (el, _p, ctx) {
  ctx.baslik('Programı güncelle');
  let v = null; let izleniyor = false; let izlemeBaslangic = 0; let sonucGosterildi = false;

  const adimHtml = (log) => {
    const satirlar = log.split('\n').filter((s) => s.startsWith('==>'));
    const son = satirlar.length - 1;
    return html`<ol class="gnc-adimlar">${ADIMLAR.map(([anahtar, ad]) => {
      const i = satirlar.findIndex((s) => s.includes(anahtar));
      const durum = i < 0 ? '' : i < son ? 'bitti' : 'suruyor';
      return html`<li class="${durum}">${durum === 'bitti' ? '✓' : durum === 'suruyor' ? '⏳' : '○'} ${ad}</li>`;
    })}</ol>`;
  };

  const ciz = () => {
    if (!v) return;
    const s = v.surum; const d = v.durum;
    const calisiyor = izleniyor || v.istek.guncelle || d?.durum === 'calisiyor';
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>Programı güncelle</h2><span class="alt">Yeni sürüm GitHub'dan indirilir, önce yedek alınır</span></div>
      ${!v.servis ? html`<div class="kart gnc-kart uyari-kart">
          <b>Güncelleme servisi sunucuda henüz kurulu değil.</b>
          <p>Bir kereliğine telefondan veya bilgisayardan SSH ile sunucuya bağlanıp şunu çalıştırın:</p>
          <pre class="gnc-komut">${v.kurulum}</pre>
          <p class="soluk">Kurulduktan sonra güncellemeler bu ekrandan yapılır.</p>
          ${v.istek.kontrol || v.istek.guncelle ? html`<p class="soluk">${v.yanitsiz ? 'İstek bekliyor ama servis yanıt vermiyor.' : 'Servis bekleniyor…'}</p>` : ''}
        </div>` : ''}
      ${v.servis ? html`
      <div class="kart gnc-kart">
        <div class="gnc-satir"><span class="soluk">Kurulu sürüm</span>
          <b>${s?.kurulu ? html`${zaman(s.kurulu.tarih)} <code>${s.kurulu.kod}</code>` : '—'}</b></div>
        ${s?.kurulu ? html`<div class="soluk gnc-baslik">${s.kurulu.baslik}</div>` : ''}
        <div class="gnc-satir" style="margin-top:.6rem"><span class="soluk">Son kontrol</span>
          <span>${s?.kontrol ? zaman(s.kontrol) : '—'} <button class="btn ikincil kucuk" data-kontrol ${v.istek.kontrol || calisiyor ? 'disabled' : ''}>${v.istek.kontrol ? 'Kontrol ediliyor…' : 'Yeniden kontrol et'}</button></span></div>
        ${s?.hata ? html`<div class="gnc-hata">${s.hata}</div>` : ''}
      </div>
      <div class="kart gnc-kart">
        ${s?.yeni?.length
          ? html`<h3 style="margin:0 0 .5rem">Yeni sürümde ${s.yeni.length} değişiklik var</h3>
              <ul class="gnc-liste">${s.yeni.map((c) => html`<li><span class="soluk">${zaman(c.tarih)}</span> ${c.baslik}</li>`)}</ul>`
          : html`<div class="gnc-guncel">✓ Program güncel</div>`}
        <div class="btn-grup" style="margin-top:.8rem">
          <button class="btn ${s?.yeni?.length ? 'birincil' : 'ikincil'}" data-baslat ${calisiyor ? 'disabled' : ''}>
            ${calisiyor ? 'Güncelleniyor…' : s?.yeni?.length ? 'Şimdi güncelle' : 'Yine de yeniden kur'}</button>
        </div>
        ${!calisiyor ? html`<p class="soluk" style="margin:.5rem 0 0">Güncelleme sırasında program 1–2 dakika kapanır; o sırada kaydedilmemiş işinizi kaydedin.</p>` : ''}
      </div>` : ''}
      ${calisiyor ? html`<div class="kart gnc-kart">
          <h3 style="margin:0 0 .5rem">Güncelleniyor</h3>
          ${adimHtml(v.log || '')}
          ${v.yanitsiz ? html`<div class="gnc-hata">İstek gönderildi ama sunucudaki servis yanıt vermiyor. SSH ile kontrol: <code>systemctl status servis-takip-guncelleme.service</code></div>` : ''}
          <p class="soluk gnc-yeniden" hidden>Program yeniden başlatılıyor, bağlantı bekleniyor…</p>
          <details open><summary>Ayrıntılı kayıt</summary><pre class="gnc-log">${v.log || 'Başlıyor…'}</pre></details>
        </div>`
      : d ? html`<div class="kart gnc-kart">
          <div class="gnc-satir"><span class="soluk">Son güncelleme</span>
            <b class="${d.durum === 'basarili' ? 'yesil-yazi' : 'kirmizi-yazi'}">${d.durum === 'basarili' ? '✓ Başarılı' : '✗ Başarısız'}</b></div>
          <div class="soluk">${zaman(d.bitis || d.baslangic)} · ${(d.isteyen || '').replace(/\s\S+$/, '')} · <code>${d.onceki || '?'}</code> → <code>${d.simdiki || '?'}</code></div>
          ${d.durum !== 'basarili' ? html`<p>Program önceki sürümle çalışmaya devam ediyor. Kayıttaki hatayı bana iletebilirsiniz.</p>` : ''}
          <details ${d.durum !== 'basarili' ? 'open' : ''}><summary>Kayıt</summary><pre class="gnc-log">${v.log}</pre></details>
        </div>` : ''}`);
    const log = $('.gnc-log', el); if (log) log.scrollTop = log.scrollHeight;
    $('[data-kontrol]', el)?.addEventListener('click', kontrol);
    $('[data-baslat]', el)?.addEventListener('click', baslat);
  };

  const yukle = async () => { v = await api.get('/guncelleme'); ciz(); };

  async function kontrol() {
    try { await api.post('/guncelleme/kontrol'); } catch (e) { return bildir(e.message, 'hata'); }
    v.istek.kontrol = true; ciz();
    for (let i = 0; i < 30 && el.isConnected; i++) {
      await bekle(1500);
      await yukle().catch(() => {});
      if (!v.istek.kontrol) break;
    }
  }

  async function baslat() {
    const s = v.surum;
    const ok = await pencere({
      baslik: 'Programı güncelle',
      kaydetMetin: 'Güncellemeyi başlat',
      icerik: html`<p>${s?.yeni?.length ? `${s.yeni.length} değişiklik kurulacak.` : 'Aynı sürüm yeniden kurulacak.'}
        Önce yedek alınır. Program 1–2 dakika kapanıp açılır; bu sırada kimse kayıt yapamaz.</p>
        <label>Onay için şifreniz<input type="password" name="sifre" autocomplete="current-password" required autofocus></label>`,
      kaydet: async (f) => { if (!f.sifre) throw new Error('Şifrenizi yazın.'); await api.post('/guncelleme/baslat', { sifre: f.sifre }); return true; },
    });
    if (!ok) return;
    izle();
  }

  async function izle() {
    izleniyor = true; izlemeBaslangic = Date.now(); sonucGosterildi = false;
    ciz();
    let kopuk = false;
    while (el.isConnected && Date.now() - izlemeBaslangic < 35 * 60 * 1000) {
      await bekle(2000);
      try {
        v = await api.get('/guncelleme');
        if (kopuk) { kopuk = false; }
        const d = v.durum;
        const bitti = d && d.durum !== 'calisiyor' && d.bitis && Date.parse(d.bitis) >= izlemeBaslangic - 60000 && !v.istek.guncelle;
        if (bitti) {
          izleniyor = false;
          ciz();
          if (!sonucGosterildi) {
            sonucGosterildi = true;
            if (d.durum === 'basarili') {
              bildir('Program güncellendi, sayfa yenileniyor…', 'basari');
              await bekle(1500);
              // Yeni dosyalar gelsin: hizmet çalışanının önbelleğini de tazele
              try { const k = await caches.keys(); await Promise.all(k.map((x) => caches.delete(x))); } catch { /* */ }
              location.reload();
            } else bildir('Güncelleme başarısız oldu. Kayda bakın.', 'hata', 8000);
          }
          return;
        }
        ciz();
      } catch {
        // Program yeniden başlarken sunucuya ulaşılamaz; beklemeye devam
        kopuk = true;
        const y = $('.gnc-yeniden', el); if (y) y.hidden = false;
      }
    }
  }

  await yukle();
  if (v.istek.guncelle || v.durum?.durum === 'calisiyor') izle();
  else if (v.servis && !v.istek.kontrol && (!v.surum?.kontrol || Date.now() - Date.parse(v.surum.kontrol) > 5 * 60 * 1000)) kontrol();
}
