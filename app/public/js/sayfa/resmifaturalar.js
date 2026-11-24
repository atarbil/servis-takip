// Resmi faturalar: kesilen satış faturaları ve yalnız KDV (gider) alışlar. Bilgi amaçlı; bakiyeyi / stoğu etkilemez.
import { api } from '../api.js';
import { html, $, bildir, bugunStr } from '../ui.js';
import { resmiTablo, resmiDetay, elleKayit } from '../resmi.js';

export default async function (el, _p, ctx) {
  ctx.baslik('Resmi faturalar');
  let yon = ctx.sorgu.yon === 'alis' ? 'alis' : 'satis';
  let ay = ctx.sorgu.ay || bugunStr().slice(0, 7);
  let q = ''; let eslesmeyen = false;
  let liste = [];

  async function yukle() {
    liste = await api.get('/resmi', { yon, ay: ay || undefined, q: q || undefined, eslesmeyen: eslesmeyen ? '1' : undefined });
  }
  function ciz() {
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>Resmi faturalar</h2><span class="bosluk"></span>
        <button class="btn ikincil" data-elle>+ Elle KDV kaydı</button>
        <a class="btn birincil" href="#/resmi-yukle">📄 XML yükle</a></div>
      <div class="rf-gorunum">
        <button class="${yon === 'satis' ? 'aktif' : ''}" data-yon="satis">Kesilen (satış)</button>
        <button class="${yon === 'alis' ? 'aktif' : ''} rf-gider-sekme" data-yon="alis">Gider (yalnız KDV alış)</button>
        <span class="bosluk"></span>
        <span class="rf-renk"><i class="stoklu"></i>Stoklu alışlar <a href="#/alislar">Alış faturalarında</a> <i class="gider"></i>Stoksuz / gider</span>
      </div>
      <div class="filtre">
        <input type="month" id="rf-ay" value="${ay}" title="Dönem (boş: tümü)">
        <button class="btn-metin" data-tum-aylar>${ay ? 'tüm aylar' : ''}</button>
        <input type="search" id="rf-q" value="${q}" placeholder="Ara: fatura no, firma…">
        ${yon === 'satis' ? html`<label class="kutu-sec" style="margin:0"><input type="checkbox" id="rf-eslesmeyen" ${eslesmeyen ? 'checked' : ''}> Yalnız cariyle eşleşmeyenler</label>` : ''}
      </div>
      <div class="kart">${resmiTablo(liste, { yon, bos: yon === 'satis' ? 'Bu dönemde yüklenmiş satış faturası yok.' : 'Bu dönemde gider kaydı yok.' })}</div>
      <p class="soluk" style="font-size:.8rem">Bu kayıtlar yalnız KDV durumunda kullanılır; cari bakiyesini, stoğu, kasayı ve satış fişlerini etkilemez. Dosyalar saklanmaz.</p>`);
    $('#rf-ay', el).onchange = async (e) => { ay = e.target.value; await yukle(); ciz(); };
    let zmn;
    $('#rf-q', el).oninput = (e) => { clearTimeout(zmn); zmn = setTimeout(async () => { q = e.target.value.trim(); await yukle(); const p = e.target.selectionStart; ciz(); const i = $('#rf-q', el); i.focus(); i.setSelectionRange(p, p); }, 300); };
    const es = $('#rf-eslesmeyen', el);
    if (es) es.onchange = async () => { eslesmeyen = es.checked; await yukle(); ciz(); };
  }

  el.addEventListener('click', async (e) => {
    const y = e.target.closest('[data-yon]');
    if (y) { yon = y.dataset.yon; await yukle(); return ciz(); }
    if (e.target.closest('[data-tum-aylar]')) { ay = ''; await yukle(); return ciz(); }
    const r = e.target.closest('[data-resmi]');
    if (r) { if (await resmiDetay(Number(r.dataset.resmi))) { await yukle(); ciz(); } return; }
    if (e.target.closest('[data-elle]')) {
      const s = await elleKayit({ yon });
      if (s) { bildir('Kaydedildi.', 'basari'); await yukle(); ciz(); }
    }
  });

  await yukle();
  ciz();
  if (ctx.sorgu.id) resmiDetay(Number(ctx.sorgu.id)).then(async (d) => { if (d) { await yukle(); ciz(); } }).catch((e) => bildir(e.message, 'hata'));
}
