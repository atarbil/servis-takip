// Dış servis: müşteriden alınıp tamire gönderilen cihazlar (sade takip)
import { api } from '../api.js';
import { html, $, tarih, para, debounce, csvIndir, pencere, bildir, sayiGiris } from '../ui.js';
import { cariSecici, cariYeniYakala, silOnay } from '../bilesen.js';
import { disServisFisYazdir } from '../belgeler.js';

export const DS_DURUM = {
  dis_serviste: { ad: 'Dış serviste', renk: 'turuncu' },
  geldi: { ad: 'Geldi (bizde)', renk: 'mavi' },
  teslim_edildi: { ad: 'Müşteriye teslim edildi', renk: 'yesil' },
};
const rozet = (d) => html`<span class="rozet ${DS_DURUM[d]?.renk}">${DS_DURUM[d]?.ad || d}</span>`;
const sureYazi = (d) => (d.durum === 'dis_serviste' ? html`<b class="${d.dis_gun > 14 ? 'negatif' : ''}">${d.dis_gun} gün</b> dışarıda`
  : d.durum === 'geldi' ? html`${d.dis_gun} gün dışarıda kaldı · <b>${d.bekleyen_gun} gündür bizde</b>` : html`${d.dis_gun} gün dışarıda kaldı`);
const cihazAdi = (d) => [d.cihaz, d.marka_model].filter(Boolean).join(' · ');

// Yeni / düzenle. Kayıtlıysa durum düğmeleri, yazdır ve sil de pencerede.
export async function disServisFormu(kayit, { cari, ctx } = {}) {
  const d = kayit ? await api.get(`/dis-servis/${kayit.id}`) : { durum: 'dis_serviste' };
  let secilen = cari || (d.cari_id ? { id: d.cari_id, unvan: d.unvan } : null);
  const yerler = await api.get('/dis-servis').then((l) => [...new Set(l.map((x) => x.servis_yeri))]).catch(() => []);
  return pencere({
    baslik: kayit ? `Dış servis · ${cihazAdi(d)}` : 'Dış servise cihaz gönder',
    genis: true,
    icerik: html`
      ${kayit ? html`<div class="ds-durum-serit">
        ${['dis_serviste', 'geldi', 'teslim_edildi'].map((x, i) => html`<div class="ds-adim ${d.durum === x ? 'aktif' : ''} ${['dis_serviste', 'geldi', 'teslim_edildi'].indexOf(d.durum) > i ? 'gecti' : ''}">
          <b>${i + 1}. ${DS_DURUM[x].ad}</b><small>${tarih(x === 'dis_serviste' ? d.gonderim_tarihi : x === 'geldi' ? d.gelis_tarihi : d.teslim_tarihi) || '—'}</small></div>`)}
        </div>
        <div class="btn-grup" style="margin-bottom:.8rem">
          ${d.durum === 'dis_serviste' ? html`<button type="button" class="btn birincil" data-durum="geldi">✓ Dış servisten geldi</button>` : ''}
          ${d.durum === 'geldi' ? html`<button type="button" class="btn basari" data-durum="teslim_edildi">✓ Müşteriye teslim edildi</button>
            <button type="button" class="btn ikincil" data-durum="dis_serviste">↩ Tekrar dış servise gönderildi</button>` : ''}
          ${d.durum === 'teslim_edildi' ? html`<button type="button" class="btn ikincil" data-durum="geldi">↩ Teslimi geri al</button>` : ''}
          <span class="soluk" style="font-size:.85rem">${sureYazi(d)}</span>
        </div>` : ''}
      <label class="alan"><span>Müşteri *</span><input id="ds-cari" value="${secilen?.unvan || ''}" ${cari ? 'readonly' : ''} placeholder="Ara…"></label>
      <div class="satir3">
        <label class="alan"><span>Cihaz *</span><input name="cihaz" value="${d.cihaz || ''}" list="ds-cihaz" required placeholder="Dizüstü, NVR, yazıcı…">
          <datalist id="ds-cihaz">${['Dizüstü bilgisayar', 'Masaüstü bilgisayar', 'Monitör', 'Yazıcı', 'NVR', 'DVR', 'Kamera', 'Telefon', 'Tablet', 'UPS', 'Anakart', 'Ekran kartı'].map((x) => html`<option value="${x}">`)}</datalist></label>
        <label class="alan"><span>Marka / model</span><input name="marka_model" value="${d.marka_model || ''}"></label>
        <label class="alan"><span>Seri no</span><input name="seri_no" value="${d.seri_no || ''}"></label>
      </div>
      <label class="alan"><span>Arıza</span><textarea name="ariza" rows="2">${d.ariza || ''}</textarea></label>
      <div class="satir3">
        <label class="alan"><span>Yanında verilenler</span><input name="aksesuar" value="${d.aksesuar || ''}" placeholder="Adaptör, çanta…"></label>
        <label class="alan"><span>Gönderilen servis *</span><input name="servis_yeri" value="${d.servis_yeri || ''}" list="ds-yer" required placeholder="Yetkili servis / tamirci">
          <datalist id="ds-yer">${yerler.map((x) => html`<option value="${x}">`)}</datalist></label>
        <label class="alan"><span>Gönderim tarihi</span><input type="date" name="gonderim_tarihi" value="${d.gonderim_tarihi || ''}"></label>
        <label class="alan"><span>Servis ücreti (bilgi)</span><input name="ucret" inputmode="decimal" value="${d.ucret != null ? sayiGiris(d.ucret) : ''}" placeholder="—"></label>
      </div>
      <label class="alan"><span>Not</span><textarea name="notlar" rows="2">${d.notlar || ''}</textarea></label>`,
    altBilgi: kayit ? html`<button type="button" class="btn ikincil" data-ds-yazdir>🖨 Teslim alındı fişi</button>
      <button type="button" class="btn tehlike-cizgi" data-ds-sil>🗑 Sil</button>` : '',
    acildi: (dlg, kapat) => {
      const inp = $('#ds-cari', dlg);
      if (!cari) { const s = (c) => { secilen = c; inp.value = c.unvan; }; cariSecici(inp, s); cariYeniYakala(dlg, s); }
      dlg.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-durum]');
        if (b) {
          try { await api.post(`/dis-servis/${d.id}/durum`, { durum: b.dataset.durum }); bildir(DS_DURUM[b.dataset.durum].ad + '.', 'basari'); kapat({ id: d.id, durum: true }); }
          catch (err) { bildir(err.message, 'hata'); }
          return;
        }
        if (e.target.closest('[data-ds-yazdir]')) return disServisFisYazdir(ctx, d);
        if (e.target.closest('[data-ds-sil]') && await silOnay('dis_servis', d.id)) kapat({ silindi: true });
      });
    },
    kaydet: async (v) => {
      if (!secilen) throw new Error('Müşteri seçin.');
      const govde = { ...v, cari_id: secilen.id };
      if (kayit) { await api.put(`/dis-servis/${kayit.id}`, govde); return kayit; }
      const r = await api.post('/dis-servis', govde);
      return { ...r, yeni: true };
    },
  });
}

// Cari kartı için kompakt liste
export function disServisTablosu(liste) {
  if (!liste.length) return html`<div class="bos-durum">Dış servis kaydı yok.</div>`;
  return html`<table class="tablo mobil-kart"><thead><tr><th>Cihaz</th><th>Seri no</th><th>Servis</th><th>Gönderim</th><th>Durum</th><th>Süre</th></tr></thead><tbody>
    ${liste.map((d) => html`<tr class="tikla" data-ds="${d.id}"><td class="ana-hucre" data-et="">${cihazAdi(d)}${d.ariza ? html`<div class="alt-satir">${d.ariza}</div>` : ''}</td>
      <td data-et="Seri no" class="mono">${d.seri_no || ''}</td><td data-et="Servis">${d.servis_yeri}</td><td data-et="Gönderim">${tarih(d.gonderim_tarihi)}</td>
      <td data-et="Durum">${rozet(d.durum)}</td><td data-et="Süre">${sureYazi(d)}</td></tr>`)}</tbody></table>`;
}

export default async function (el, [acId], ctx) {
  ctx.baslik('Dış Servis');
  const f = { durum: 'acik', q: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Dış servis</h2><span class="alt">Müşteriden alınıp tamire gönderilen cihazlar</span><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel</button><button class="btn birincil" id="yeni">+ Dış servise gönder</button></div>
    <div class="sekmeler">${[['acik', 'Açık olanlar'], ['dis_serviste', 'Dış serviste'], ['geldi', 'Geldi, teslim bekliyor'], ['teslim_edildi', 'Teslim edilenler'], ['', 'Tümü']]
      .map(([k, a]) => html`<button data-f="${k}" class="${f.durum === k ? 'aktif' : ''}">${a}<b class="sekme-sayi" data-sayi="${k}"></b></button>`)}</div>
    <div class="filtre"><input type="search" id="q" placeholder="Ara: müşteri, cihaz, seri no, servis…"></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    const [l, s] = await Promise.all([api.get('/dis-servis', f), api.get('/dis-servis/sayilar')]);
    veri = l;
    const sayi = { acik: s.dis_serviste + s.geldi, dis_serviste: s.dis_serviste, geldi: s.geldi };
    el.querySelectorAll('[data-sayi]').forEach((b) => { b.textContent = sayi[b.dataset.sayi] ? ` ${sayi[b.dataset.sayi]}` : ''; });
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Müşteri</th><th>Cihaz</th><th>Seri no</th><th>Arıza</th><th>Gönderilen servis</th>
      <th>Gönderim</th><th>Durum</th><th>Süre</th></tr></thead><tbody>
      ${l.length ? l.map((d) => html`<tr class="tikla" data-ds="${d.id}">
        <td data-et="Müşteri"><b>${d.unvan}</b>${d.cari_telefon ? html`<div class="alt-satir">${d.cari_telefon}</div>` : ''}</td>
        <td class="ana-hucre" data-et="">${cihazAdi(d)}</td><td data-et="Seri no" class="mono">${d.seri_no || ''}</td>
        <td data-et="Arıza" class="soluk">${d.ariza || ''}</td><td data-et="Servis">${d.servis_yeri}</td>
        <td data-et="Gönderim">${tarih(d.gonderim_tarihi)}</td><td data-et="Durum">${rozet(d.durum)}</td><td data-et="Süre">${sureYazi(d)}</td></tr>`)
        : html`<tr><td colspan="8" class="bos-durum"><b>Kayıt yok</b>${f.durum === 'acik' ? 'Şu an dış serviste cihaz yok.' : ''}</td></tr>`}</tbody></table>`);
  };
  const ac = async (id) => { const r = await disServisFormu({ id }, { ctx }); if (r) ciz(); };
  el.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-f]');
    if (t) { f.durum = t.dataset.f; el.querySelectorAll('[data-f]').forEach((b) => b.classList.toggle('aktif', b === t)); return ciz(); }
    const r = e.target.closest('[data-ds]');
    if (r) ac(Number(r.dataset.ds));
  });
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  $('#yeni', el).onclick = async () => { const r = await disServisFormu(null, { ctx }); if (r) { bildir('Kayıt açıldı.', 'basari'); ciz(); ctx.sayacYenile?.(); } };
  $('#csv', el).onclick = () => csvIndir('dis-servis', ['Müşteri', 'Cihaz', 'Marka/model', 'Seri no', 'Arıza', 'Yanında', 'Servis', 'Gönderim', 'Geliş', 'Teslim', 'Durum', 'Gün', 'Ücret', 'Not'],
    veri.map((d) => [d.unvan, d.cihaz, d.marka_model, d.seri_no, d.ariza, d.aksesuar, d.servis_yeri, tarih(d.gonderim_tarihi), tarih(d.gelis_tarihi), tarih(d.teslim_tarihi),
      DS_DURUM[d.durum].ad, d.dis_gun, d.ucret != null ? Number(d.ucret) : '', d.notlar]));
  await ciz();
  if (acId) ac(Number(acId));
  else if (ctx.sorgu.yeni) $('#yeni', el).click();
  void para;
}
