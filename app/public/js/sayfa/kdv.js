// KDV durumu — iki sütun: solda ALIŞ (indirilecek KDV), sağda SATIŞ (hesaplanan KDV); fatura fatura ya da cariye göre.
// Alış: onaylı alış faturaları (stoklu, yeşil) + yalnız KDV gider kayıtları (açık mavi). Satış: resmi satış faturaları.
import { api } from '../api.js';
import { html, $, para, bildir, sayiCoz, sayiGiris, bugunStr } from '../ui.js';
import { resmiDetay, elleKayit, tarihYaz } from '../resmi.js';

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const ayAdi = (ay) => `${AYLAR[Number(ay.slice(5, 7)) - 1]} ${ay.slice(0, 4)}`;
const topla = (l) => l.reduce((t, x) => { t.m += x.matrah; t.k += x.kdv; t.t += x.toplam; t.tv += x.tevkifat || 0; return t; }, { m: 0, k: 0, t: 0, tv: 0 });
const cariAdi = (x) => x.cari_unvan || x.karsi_unvan || '—';
const cariAnahtar = (x) => (x.cari_id ? `c${x.cari_id}` : `v${x.vkn || cariAdi(x)}`);

export default async function (el, _p, ctx) {
  ctx.baslik('KDV durumu');
  let ay = (ctx.sorgu.ay && /^\d{4}-\d{2}$/.test(ctx.sorgu.ay)) ? ctx.sorgu.ay : bugunStr().slice(0, 7);
  let veri = null;
  const gorunum = { alis: 'fatura', satis: 'fatura' };
  const filtre = { alis: null, satis: null }; // cariye göre görünümden seçilen cari

  const devredenAnahtar = () => `kdv-devreden-${ay}`;
  const devredenOku = () => { try { return Number(localStorage.getItem(devredenAnahtar())) || 0; } catch { return 0; } };
  const yukle = async () => { veri = await api.get('/kdv/ozet', { ay }); };

  function faturaTablo(yon, liste) {
    const f = filtre[yon];
    const l = f ? liste.filter((x) => cariAnahtar(x) === f.anahtar) : liste;
    const t = topla(l);
    const taslak = yon === 'alis' && !f ? veri.taslaklar : [];
    return html`${f ? html`<div class="kdv-filtre">Yalnız <b>${f.ad}</b> <button class="btn-metin" data-filtre-kaldir="${yon}">✕ tümünü göster</button></div>` : ''}
      <div class="tablo-kap"><table class="tablo kdv-tablo ft"><thead><tr><th>Fatura</th><th>Cari</th><th class="sayi">Fatura tutarı</th><th class="sayi">KDV tutarı</th><th class="sayi">Toplam tutar</th></tr></thead>
      <tbody>${l.map((x) => html`<tr class="tikla ${yon === 'alis' ? `kdv-${x.tur}` : ''}" data-ac="${yon === 'alis' && x.tur === 'stoklu' ? `alis:${x.id}` : `resmi:${x.id}`}">
          <td class="kdv-no"><b>${x.belge_no || '—'}</b><small class="rf-vkn-yazi">${tarihYaz(x.tarih)}</small>${x.kaynak === 'elle' ? html` <span class="rozet">elle</span>` : ''}${x.tip && x.tip !== 'SATIS' ? html` <span class="rozet">${x.tip}</span>` : ''}${x.gider_turu ? html`<small class="rf-vkn-yazi">${x.gider_turu}</small>` : ''}</td>
          <td class="kdv-cari">${x.cari_id ? html`<a href="#/cari/${x.cari_id}${yon === 'satis' ? '?sekme=resmi' : ''}" data-cari-link>${cariAdi(x)}</a>` : html`${cariAdi(x)}${yon === 'satis' ? html` <span class="rozet turuncu">eşleşmedi</span>` : ''}`}${x.vkn ? html`<small class="rf-vkn-yazi">VKN ${x.vkn}</small>` : ''}</td>
          <td class="sayi" data-et="Fatura tutarı">${para(x.matrah)}</td>
          <td class="sayi" data-et="KDV tutarı">${para(x.kdv)}${x.tevkifat ? html`<small class="rf-vkn-yazi">tevkifat −${para(x.tevkifat)}</small>` : ''}</td>
          <td class="sayi" data-et="Toplam tutar"><b>${para(x.toplam)}</b></td></tr>`)}
        ${taslak.map((x) => html`<tr class="tikla kdv-taslak" data-ac="alis:${x.id}"><td class="kdv-no"><b>${x.belge_no}</b><small class="rf-vkn-yazi">${tarihYaz(x.tarih)}</small><span class="rozet">taslak · sayılmadı</span></td><td class="kdv-cari">${x.cari_unvan}</td>
          <td class="sayi" data-et="Fatura tutarı">${para(r2(Number(x.genel_toplam) - Number(x.kdv_toplam)))}</td><td class="sayi" data-et="KDV tutarı">${para(x.kdv_toplam)}</td><td class="sayi" data-et="Toplam tutar">${para(x.genel_toplam)}</td></tr>`)}
        ${!l.length && !taslak.length ? html`<tr><td colspan="5" class="bos-durum">${yon === 'alis' ? 'Bu ay onaylı alış faturası ya da gider kaydı yok.' : html`Bu ay yüklenmiş satış faturası yok. <a href="#/resmi-yukle">XML yükle</a>`}</td></tr>` : ''}</tbody>
      <tfoot><tr><td colspan="2"><b>${l.length} fatura</b></td><td class="sayi" data-et="Fatura tutarı"><b>${para(r2(t.m))}</b></td><td class="sayi" data-et="KDV tutarı"><b>${para(r2(t.k))}</b></td><td class="sayi" data-et="Toplam tutar"><b>${para(r2(t.t))}</b></td></tr></tfoot></table></div>`;
  }

  function cariTablo(yon, liste) {
    const g = new Map();
    for (const x of liste) {
      const k = cariAnahtar(x);
      const y = g.get(k) || { anahtar: k, ad: cariAdi(x), vkn: x.vkn, n: 0, m: 0, kd: 0, t: 0, stoklu: 0, gider: 0 };
      y.n++; y.m += x.matrah; y.kd += x.kdv; y.t += x.toplam; if (x.tur) y[x.tur]++;
      g.set(k, y);
    }
    const l = [...g.values()].sort((a, b) => b.kd - a.kd);
    const t = topla(liste);
    return html`<div class="tablo-kap"><table class="tablo kdv-tablo"><thead><tr><th>Cari</th><th class="sayi">Fatura</th><th class="sayi">Fatura tutarı</th><th class="sayi">KDV tutarı</th><th class="sayi">Toplam tutar</th></tr></thead>
      <tbody>${l.map((y) => html`<tr class="tikla ${yon === 'alis' ? (y.gider && !y.stoklu ? 'kdv-gider' : y.stoklu && !y.gider ? 'kdv-stoklu' : '') : ''}" data-cari-filtre="${yon}" data-anahtar="${y.anahtar}" data-ad="${y.ad}">
        <td class="kdv-cari"><b>${y.ad}</b>${y.vkn ? html`<small class="rf-vkn-yazi">VKN ${y.vkn}</small>` : ''}</td><td class="sayi">${y.n}</td>
        <td class="sayi">${para(r2(y.m))}</td><td class="sayi">${para(r2(y.kd))}</td><td class="sayi"><b>${para(r2(y.t))}</b></td></tr>`)}
        ${!l.length ? html`<tr><td colspan="5" class="bos-durum">Kayıt yok.</td></tr>` : ''}</tbody>
      <tfoot><tr><td><b>${l.length} cari</b></td><td class="sayi"><b>${liste.length}</b></td><td class="sayi"><b>${para(r2(t.m))}</b></td><td class="sayi"><b>${para(r2(t.k))}</b></td><td class="sayi"><b>${para(r2(t.t))}</b></td></tr></tfoot></table></div>`;
  }

  function sutun(yon) {
    const liste = yon === 'alis' ? veri.alis : veri.satis;
    const t = topla(liste);
    const kdv = yon === 'alis' ? r2(t.k) : r2(t.k - t.tv);
    return html`<section class="kdv-sutun kdv-sutun-${yon}">
      <div class="kdv-sutun-ust">
        <div><div class="kdv-sutun-ad">${yon === 'alis' ? 'ALIŞ' : 'SATIŞ'}</div><small>${yon === 'alis' ? 'İndirilecek KDV' : 'Hesaplanan KDV'}</small></div>
        <div class="kdv-sutun-tutar">${para(kdv)}</div>
      </div>
      <div class="kdv-sutun-arac">
        <div class="rf-gorunum kucuk"><button class="${gorunum[yon] === 'fatura' ? 'aktif' : ''}" data-gor="${yon}:fatura">Fatura fatura</button><button class="${gorunum[yon] === 'cari' ? 'aktif' : ''}" data-gor="${yon}:cari">Cariye göre</button></div>
        <span class="bosluk"></span>
        ${yon === 'alis' ? html`<span class="rf-renk"><i class="stoklu"></i>Stoklu <i class="gider"></i>Stoksuz / gider</span>` : html`<a class="btn ikincil kucuk" href="#/resmi-yukle">📄 XML yükle</a>`}
      </div>
      ${gorunum[yon] === 'cari' ? cariTablo(yon, liste) : faturaTablo(yon, liste)}
      ${yon === 'satis' && t.tv ? html`<div class="soluk kdv-dipnot">Tevkifat (alıcının ödeyeceği) ${para(r2(t.tv))} hesaplanan KDV'den düşüldü.</div>` : ''}
      ${yon === 'satis' && veri.son_satis_tarihi ? html`<div class="soluk kdv-dipnot">Satış faturaları en son ${tarihYaz(veri.son_satis_tarihi)} tarihli faturaya kadar yüklendi.</div>` : ''}
    </section>`;
  }

  function ciz() {
    const alisK = r2(topla(veri.alis).k);
    const st = topla(veri.satis);
    const satisK = r2(st.k - st.tv);
    const devreden = devredenOku();
    const fark = r2(satisK - alisK - devreden);
    const cikiyor = fark > 0.004;
    el.innerHTML = String(html`
      <div class="sayfa-ust"><h2>KDV durumu</h2><span class="bosluk"></span>
        <label class="kdv-ay"><span>Dönem</span><input type="month" id="kdv-ay" value="${ay}"></label>
        <button class="btn ikincil" data-elle>+ Elle KDV kaydı</button>
        <a class="btn birincil" href="#/resmi-yukle">📄 Resmi fatura yükle</a></div>

      <div class="kdv-serit ${cikiyor ? 'cikiyor' : 'cikmiyor'}">
        <div class="kdv-serit-hukum"><small>${ayAdi(ay)}</small><b>Bu ay KDV ${cikiyor ? 'ÇIKIYOR' : 'ÇIKMIYOR'}</b></div>
        <div class="kdv-serit-tutar">${cikiyor ? 'Ödenecek' : 'Sonraki aya devreden'} ≈ <b>${para(Math.abs(fark))}</b></div>
        <span class="bosluk"></span>
        <label class="kdv-serit-devreden">Önceki aydan devreden KDV <input id="kdv-devreden" inputmode="decimal" value="${devreden ? sayiGiris(devreden) : ''}" placeholder="0,00"></label>
      </div>
      ${veri.taslaklar.length ? html`<div class="uyari-kutu">⚠ <b>${veri.taslaklar.length}</b> taslak alış faturası onaylanmadığı için sayılmadı (sol sütunda soluk).</div>` : ''}

      <div class="kdv-iki">${sutun('alis')}${sutun('satis')}</div>

      <div class="kdv-denklem">
        <span><small>Satış KDV</small><b>${para(satisK)}</b></span><i>−</i>
        <span><small>Alış KDV</small><b>${para(alisK)}</b></span><i>−</i>
        <span><small>Devreden</small><b>${para(devreden)}</b></span><i>=</i>
        <span class="${cikiyor ? 'negatif' : 'pozitif'}"><small>${cikiyor ? 'Ödenecek' : 'Devreden'}</small><b>${para(Math.abs(fark))}</b></span>
      </div>
      <p class="soluk kdv-not">Alış: onaylı alış faturaları ve yalnız KDV gider kayıtları · Satış: yüklenen resmi satış faturaları. Müşteriden gelen iade faturaları, ÖTV, istisnalar ve KDV-2 hesaba katılmaz. Sonuç bilgi amaçlıdır; kesin tutar için mali müşavirinize danışın.</p>`);
    $('#kdv-ay', el).onchange = async (e) => {
      if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
      ay = e.target.value; filtre.alis = null; filtre.satis = null;
      try { await yukle(); } catch (err) { bildir(err.message, 'hata'); }
      ciz();
    };
    const dv = $('#kdv-devreden', el);
    dv.onchange = () => {
      const v = sayiCoz(dv.value) || 0;
      try { if (v) localStorage.setItem(devredenAnahtar(), String(v)); else localStorage.removeItem(devredenAnahtar()); } catch { /* */ }
      ciz();
    };
  }

  el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cari-link]')) return;
    const g = e.target.closest('[data-gor]');
    if (g) { const [yon, gr] = g.dataset.gor.split(':'); gorunum[yon] = gr; return ciz(); }
    const cf = e.target.closest('[data-cari-filtre]');
    if (cf) { const yon = cf.dataset.cariFiltre; filtre[yon] = { anahtar: cf.dataset.anahtar, ad: cf.dataset.ad }; gorunum[yon] = 'fatura'; return ciz(); }
    const fk = e.target.closest('[data-filtre-kaldir]');
    if (fk) { filtre[fk.dataset.filtreKaldir] = null; return ciz(); }
    const ac = e.target.closest('[data-ac]');
    if (ac) {
      const [tur, id] = ac.dataset.ac.split(':');
      if (tur === 'alis') { ctx.git(`alis/${id}`); return; }
      if (await resmiDetay(Number(id))) { await yukle(); ciz(); }
      return;
    }
    if (e.target.closest('[data-elle]')) { if (await elleKayit({ yon: 'alis' })) { bildir('Kaydedildi.', 'basari'); await yukle(); ciz(); } }
  });

  await yukle();
  ciz();
}
