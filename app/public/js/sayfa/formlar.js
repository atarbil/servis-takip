// Form tasarımı: belge türü sekmeleri, şablon kartları, varsayılan seçimi, içe / dışa aktarma
import { api } from '../api.js';
import { html, ham, $, $$, bildir, pencere, onayla } from '../ui.js';
import { TURLER, TUR_AD, TEMALAR, belgeHtml, ornekVeri, varsayilanAyar, ayarTamamla } from '../form.js';
import { sablonOnbellekSil } from '../belgeler.js';

// Küçük önizleme: gerçek boyutta çizilip ölçeklenir
export const minyatur = (ctx, tur, ayar, genislik = 240) => {
  const a = ayarTamamla(tur, ayar);
  const sayfaGen = a.kagit === 'A4Y' ? 1123 : a.kagit === 'A5' ? 559 : 794;
  const sayfaYuk = a.kagit === 'A4Y' ? 794 : a.kagit === 'A5' ? 794 : 1123;
  const o = genislik / sayfaGen;
  return html`<div class="fm-mini" style="width:${genislik}px;height:${Math.round(sayfaYuk * o)}px">
    <div class="fm-mini-ic" style="width:${sayfaGen}px;transform:scale(${o});padding:${Math.round(a.kenar * 3.78)}px">${ham(belgeHtml(ctx, tur, a, ornekVeri(tur)))}</div></div>`;
};

export async function yeniSablon(ctx, tur) {
  const sonuc = await pencere({
    baslik: `Yeni ${TUR_AD[tur].toLocaleLowerCase('tr')} şablonu`, genis: true, kaydetMetin: 'Oluştur ve düzenle',
    icerik: html`<label class="alan"><span>Şablon adı</span><input name="ad" value="${TUR_AD[tur]} — yeni" maxlength="60" required></label>
      <p class="soluk" style="margin:.2rem 0 .6rem">Bir başlangıç teması seçin; sonra her şeyi değiştirebilirsiniz.</p>
      <div class="fm-temalar">${Object.entries(TEMALAR).map(([k, t], i) => html`<label class="fm-tema">
        <input type="radio" name="tema" value="${k}" ${i === 0 ? 'checked' : ''}>
        ${minyatur(ctx, tur, varsayilanAyar(tur, k), 170)}<b>${t.ad}</b><small>${t.aciklama}</small></label>`)}</div>`,
    kaydet: async (f) => api.post('/sablonlar', { tur, ad: f.ad, ayar: varsayilanAyar(tur, f.tema || 'klasik') }),
  });
  if (sonuc?.id) { sablonOnbellekSil(); ctx.git(`form/${sonuc.id}`); }
}

export default async function (el, _p, ctx) {
  ctx.baslik('Form tasarımı');
  let tur = TURLER.some((t) => t.tur === ctx.sorgu.tur) ? ctx.sorgu.tur : 'teklif';
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Form tasarımı</h2><span class="alt">Teklif, proforma, fiş ve diğer belgeler için kendi yazdırma şablonlarınızı tasarlayın</span><span class="bosluk"></span>
      <label class="btn ikincil">İçe aktar<input type="file" accept="application/json,.json" id="ice-aktar" hidden></label>
      <button class="btn ikincil" data-a="disa">Tümünü dışa aktar</button>
      <button class="btn birincil" data-a="yeni">+ Yeni şablon</button></div>
    <div class="sekmeler fm-sekmeler" id="fm-sekme"></div>
    <div class="fm-bilgi">Her belge türü için bir <b>varsayılan</b> şablon seçin: o belge yazdırılırken bu şablon kullanılır. Birden fazla şablonunuz varsa
      yazdırırken hangisinin kullanılacağı sorulur. Önizlemedeki müşteri ve ürünler örnektir. <b>Standart</b> şablon değiştirilemez; kopyalayıp kopyasını düzenleyin.</div>
    <div class="fm-kartlar" id="fm-kartlar"></div>`);

  const ciz = async () => {
    const [liste, sayilar] = await Promise.all([api.get('/sablonlar', { tur }), api.get('/sablonlar/sayilar')]);
    $('#fm-sekme', el).innerHTML = String(html`${TURLER.map((t) => html`<button data-tur="${t.tur}" class="${t.tur === tur ? 'aktif' : ''}">${t.ad} <span class="sayi-rozet">${sayilar[t.tur] || 0}</span></button>`)}`);
    $('#fm-kartlar', el).innerHTML = String(html`${liste.map((s) => html`<div class="fm-kart ${s.varsayilan ? 'varsayilan' : ''}" data-id="${s.id}">
        <div class="fm-kart-gorsel" data-a="${s.sistem ? 'kopyala' : 'duzenle'}" title="${s.sistem ? 'Kopyalayıp düzenleyin' : 'Düzenle'}">${minyatur(ctx, tur, s.ayar)}</div>
        <div class="fm-kart-alt">
          <div class="fm-kart-ad"><b>${s.ad}</b>${s.sistem ? html` <span class="rozet">Standart</span>` : ''}${s.varsayilan ? html` <span class="rozet yesil">✓ Varsayılan</span>` : ''}</div>
          <div class="btn-grup">
            ${s.sistem ? '' : html`<button class="btn birincil kucuk" data-a="duzenle">Düzenle</button>`}
            <button class="btn ikincil kucuk" data-a="kopyala">${s.sistem ? 'Kopyala ve düzenle' : 'Kopyala'}</button>
            ${s.varsayilan ? '' : html`<button class="btn ikincil kucuk" data-a="varsayilan">Varsayılan yap</button>`}
            ${s.sistem ? '' : html`<button class="btn tehlike-cizgi kucuk" data-a="sil" title="Sil">🗑</button>`}
          </div></div></div>`)}
      <button class="fm-kart fm-kart-yeni" data-a="yeni"><span>+</span><b>Yeni şablon</b><small>Hazır temalardan biriyle başlayın</small></button>`);
  };

  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tur]');
    if (t) { tur = t.dataset.tur; history.replaceState(null, '', `#/formlar?tur=${tur}`); return ciz(); }
    const a = e.target.closest('[data-a]')?.dataset.a; if (!a) return;
    const id = e.target.closest('[data-id]')?.dataset.id;
    try {
      if (a === 'yeni') return yeniSablon(ctx, tur);
      if (a === 'duzenle') return ctx.git(`form/${id}`);
      if (a === 'kopyala') {
        const s = await api.get(`/sablonlar/${id}`);
        const y = await api.post('/sablonlar', { tur: s.tur, ad: `${s.ad} (kopya)`.slice(0, 60), ayar: ayarTamamla(s.tur, s.ayar) });
        sablonOnbellekSil(); bildir('Kopyalandı', 'basari'); return ctx.git(`form/${y.id}`);
      }
      if (a === 'varsayilan') { await api.post(`/sablonlar/${id}/varsayilan`); sablonOnbellekSil(); bildir('Varsayılan şablon değişti', 'basari'); return ciz(); }
      if (a === 'sil') {
        if (!await onayla('Bu şablon silinsin mi? Varsayılansa yerine Standart şablon kullanılır.', { evet: 'Sil', tehlike: true })) return;
        await api.del(`/sablonlar/${id}`); sablonOnbellekSil(); return ciz();
      }
      if (a === 'disa') {
        const veri = await api.get('/sablonlar/disa-aktar');
        if (!veri.sablonlar.length) return bildir('Dışa aktarılacak kendi şablonunuz yok (Standart şablonlar programla gelir).', 'uyari', 5000);
        const b = new Blob([JSON.stringify(veri, null, 1)], { type: 'application/json' });
        const l = document.createElement('a'); l.href = URL.createObjectURL(b);
        l.download = `form-sablonlari-${new Date().toISOString().slice(0, 10)}.json`; l.click();
        setTimeout(() => URL.revokeObjectURL(l.href), 2000);
      }
    } catch (h) { bildir(h.message, 'hata'); }
  });
  $('#ice-aktar', el).addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const r = await api.post('/sablonlar/ice-aktar', JSON.parse(await f.text()));
      sablonOnbellekSil(); bildir(`${r.eklenen} şablon eklendi`, 'basari'); ciz();
    } catch (h) { bildir(h instanceof SyntaxError ? 'Dosya okunamadı (JSON değil).' : h.message, 'hata'); }
    e.target.value = '';
  });
  await ciz();
}
void $$;
