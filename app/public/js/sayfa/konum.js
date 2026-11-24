// Ekip konumları: teknisyenlerin son görüldüğü yer (programı açtıkları yer) — OpenStreetMap haritası, ek kütüphane yok.
import { api } from '../api.js';
import { html, $, $$, telLink } from '../ui.js';

const KARO = 256;
const OSM = (z, x, y) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
const pikselX = (lon, z) => ((lon + 180) / 360) * KARO * 2 ** z;
const pikselY = (lat, z) => { const r = (lat * Math.PI) / 180; return ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * KARO * 2 ** z; };
const ESKI = 60 * 60 * 1000; // 1 saatten eski konum soluk

function once(z) {
  const dk = Math.round((Date.now() - new Date(z).getTime()) / 60000);
  if (dk < 1) return 'az önce';
  if (dk < 60) return `${dk} dk önce`;
  const sa = Math.floor(dk / 60);
  if (sa < 24) return `${sa} sa önce`;
  return `${Math.floor(sa / 24)} gün önce`;
}
const saat = (z) => new Date(z).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const DURUM_AD = { sahada: 'sahada', planlandi: 'planlı' };

export default async function (el, _p, ctx) {
  ctx.baslik('Ekip konumları');
  let liste = [];
  let secili = null;
  // Harita durumu: yakınlık ve merkez (piksel, yakınlığa göre)
  const h = { z: 6, cx: 0, cy: 0, ayarli: false };

  const konumlu = () => liste.filter((k) => k.enlem != null && k.boylam != null);

  function sigdir() {
    const kap = $('#harita', el); if (!kap) return;
    const W = kap.clientWidth || 800; const H = kap.clientHeight || 500;
    const l = konumlu();
    if (!l.length) { h.z = 6; h.cx = pikselX(35.2, 6); h.cy = pikselY(39.0, 6); return; }
    let z = 16;
    for (; z > 3; z--) {
      const xs = l.map((k) => pikselX(k.boylam, z)); const ys = l.map((k) => pikselY(k.enlem, z));
      if (Math.max(...xs) - Math.min(...xs) < W - 120 && Math.max(...ys) - Math.min(...ys) < H - 120) break;
    }
    if (l.length === 1) z = 15;
    const xs = l.map((k) => pikselX(k.boylam, z)); const ys = l.map((k) => pikselY(k.enlem, z));
    h.z = z; h.cx = (Math.max(...xs) + Math.min(...xs)) / 2; h.cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  }

  function haritaCiz() {
    const kap = $('#harita', el); if (!kap) return;
    const W = kap.clientWidth; const H = kap.clientHeight;
    const n = 2 ** h.z;
    const x0 = h.cx - W / 2; const y0 = h.cy - H / 2;
    const parca = [];
    for (let tx = Math.floor(x0 / KARO); tx <= Math.floor((x0 + W) / KARO); tx++) {
      for (let ty = Math.floor(y0 / KARO); ty <= Math.floor((y0 + H) / KARO); ty++) {
        if (ty < 0 || ty >= n) continue;
        const gx = ((tx % n) + n) % n;
        parca.push(`<img class="harita-karo" src="${OSM(h.z, gx, ty)}" style="left:${Math.round(tx * KARO - x0)}px;top:${Math.round(ty * KARO - y0)}px" alt="" draggable="false" loading="lazy" onerror="this.style.visibility='hidden'">`);
      }
    }
    const isaretler = konumlu().map((k) => {
      const px = pikselX(k.boylam, h.z) - x0; const py = pikselY(k.enlem, h.z) - y0;
      const eski = Date.now() - new Date(k.zaman).getTime() > ESKI;
      return String(html`<button class="harita-isaret ${eski ? 'eski' : ''} ${secili === k.id ? 'secili' : ''}" style="left:${Math.round(px)}px;top:${Math.round(py)}px" data-isaret="${k.id}" title="${k.ad_soyad} · ${saat(k.zaman)}">
        <span class="harita-nokta"></span><span class="harita-ad">${k.ad_soyad}<small>${once(k.zaman)}</small></span></button>`);
    });
    $('#harita-ic', kap).innerHTML = parca.join('') + isaretler.join('');
  }

  function listeHtml() {
    if (!liste.length) return html`<div class="bos-durum">Teknisyen kullanıcı yok.</div>`;
    return html`${liste.map((k) => {
      const var_ = k.enlem != null && k.izin === 'var';
      const eski = var_ && Date.now() - new Date(k.zaman).getTime() > ESKI;
      return html`<div class="konum-kart ${secili === k.id ? 'secili' : ''} ${eski ? 'eski' : ''}" data-kart="${k.id}">
        <div class="konum-kart-ust"><b>${k.ad_soyad}</b>${k.ekip_ad ? html`<span class="rozet">${k.ekip_ad}</span>` : ''}</div>
        <div class="konum-durum">${k.izin === 'yok' ? html`<span class="rozet turuncu">Konum izni yok</span>${k.enlem != null ? html` <small>son bilinen: ${once(k.zaman)}</small>` : ''}`
          : k.izin === 'desteklenmiyor' ? html`<span class="rozet">Cihaz konum vermiyor</span>`
          : var_ ? html`<span class="konum-zaman">● Son görülme ${saat(k.zaman)}</span> <small>${once(k.zaman)}${k.dogruluk ? ` · ±${k.dogruluk} m` : ''}</small>`
          : html`<span class="soluk">Henüz programı telefonda açmadı</span>`}</div>
        ${k.is ? html`<div class="konum-is"><a href="#/is/${k.is.id}">${k.is.baslik}</a> <span class="rozet ${k.is.durum === 'sahada' ? 'yesil' : 'mavi'}">${DURUM_AD[k.is.durum] || k.is.durum}</span>
          ${k.is.cari ? html`<div><small>${k.is.cari}${k.is.adres ? ` · ${k.is.adres}` : ''}</small></div>` : ''}</div>` : ''}
        <div class="konum-arac">${k.enlem != null ? html`<button class="btn-metin" data-goster="${k.id}">Haritada göster</button>
          <a class="btn-metin" href="https://www.google.com/maps?q=${k.enlem},${k.boylam}" target="_blank" rel="noopener">Google Haritalar ↗</a>` : ''}
          ${k.telefon ? html`${telLink(k.telefon)}` : ''}</div>
      </div>`;
    })}`;
  }

  function ciz() {
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>Ekip konumları</h2><span class="bosluk"></span>
        <span class="soluk" id="konum-guncel"></span><button class="btn ikincil" data-yenile>↻ Yenile</button></div>
      <div class="konum-duzen">
        <div class="harita" id="harita"><div class="harita-ic" id="harita-ic"></div>
          <div class="harita-dugmeler"><button data-z="1" title="Yakınlaştır">+</button><button data-z="-1" title="Uzaklaştır">−</button><button data-sigdir title="Hepsini göster">⤢</button></div>
          <div class="harita-telif">© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> katkıcıları</div></div>
        <div class="konum-liste" id="konum-liste">${listeHtml()}</div>
      </div>
      <p class="soluk" style="font-size:.8rem">Konum, teknisyen programı telefonda açtığında ve açık tuttuğu sürece birkaç dakikada bir güncellenir; yalnız son konum tutulur. Bir saatten eski konumlar soluk görünür.</p>`);
    $('#konum-guncel', el).textContent = `Güncellendi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`;
    if (!h.ayarli) { sigdir(); h.ayarli = true; }
    haritaCiz();
    surukleBagla();
  }

  function surukleBagla() {
    const kap = $('#harita', el);
    let bas = null;
    kap.onpointerdown = (e) => { if (e.target.closest('button, a')) return; bas = { x: e.clientX, y: e.clientY, cx: h.cx, cy: h.cy }; kap.setPointerCapture(e.pointerId); kap.classList.add('suruklenior'); };
    kap.onpointermove = (e) => { if (!bas) return; h.cx = bas.cx - (e.clientX - bas.x); h.cy = bas.cy - (e.clientY - bas.y); haritaCiz(); };
    kap.onpointerup = () => { bas = null; kap.classList.remove('suruklenior'); };
    kap.onwheel = (e) => { e.preventDefault(); yakinlas(e.deltaY < 0 ? 1 : -1); };
    kap.ondblclick = (e) => { if (!e.target.closest('button')) yakinlas(1); };
  }
  function yakinlas(d) {
    const z = Math.max(3, Math.min(18, h.z + d));
    if (z === h.z) return;
    const k = 2 ** (z - h.z); h.cx *= k; h.cy *= k; h.z = z;
    haritaCiz();
  }
  function goster(id) {
    const k = liste.find((x) => x.id === id); if (!k || k.enlem == null) return;
    secili = id; h.z = Math.max(h.z, 15); h.cx = pikselX(k.boylam, h.z); h.cy = pikselY(k.enlem, h.z);
    haritaCiz();
    $$('[data-kart]', el).forEach((c) => c.classList.toggle('secili', Number(c.dataset.kart) === id));
  }

  el.addEventListener('click', async (e) => {
    const z = e.target.closest('[data-z]'); if (z) { yakinlas(Number(z.dataset.z)); return; }
    if (e.target.closest('[data-sigdir]')) { sigdir(); haritaCiz(); return; }
    if (e.target.closest('[data-yenile]')) { await yukle(); ciz(); return; }
    const g = e.target.closest('[data-goster]'); if (g) { goster(Number(g.dataset.goster)); $('#harita', el).scrollIntoView({ behavior: 'smooth', block: 'nearest' }); return; }
    const i = e.target.closest('[data-isaret]'); if (i) { goster(Number(i.dataset.isaret)); $(`[data-kart="${i.dataset.isaret}"]`, el)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  });

  async function yukle() { liste = await api.get('/konumlar'); }
  await yukle();
  ciz();
  window.addEventListener('resize', () => { if (el.isConnected) haritaCiz(); });
  // Sayfa açıkken dakikada bir yenilenir
  const zmn = setInterval(async () => {
    if (el.kapandi) { clearInterval(zmn); return; }
    if (!el.isConnected || document.hidden) return;
    try { await yukle(); $('#konum-liste', el).innerHTML = String(listeHtml()); haritaCiz(); $('#konum-guncel', el).textContent = `Güncellendi ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`; } catch { /* */ }
  }, 60000);
}
