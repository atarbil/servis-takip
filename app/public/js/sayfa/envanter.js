// Müşteri envanteri: kurumlardaki cihazlar
import { api } from '../api.js';
import { html, $, tarih, debounce, csvIndir, pencere, bildir, zaman } from '../ui.js';
import { cariSecici, cariYeniYakala } from '../bilesen.js';

export const ENV_DURUM = { aktif: { ad: 'Aktif', renk: 'yesil' }, arizali: { ad: 'Arızalı', renk: 'turuncu' }, kaldirildi: { ad: 'Kaldırıldı', renk: 'kirmizi' } };
export const envDurumRozet = (d) => html`<span class="rozet ${ENV_DURUM[d]?.renk}">${ENV_DURUM[d]?.ad || d}</span>`;

export function garantiRozet(e) {
  if (!e.garanti_bitis) return '';
  const g = e.garanti_kalan_gun ?? Math.round((new Date(e.garanti_bitis) - new Date()) / 86400000);
  if (g < 0) return html`<span class="rozet kirmizi" title="Garanti ${tarih(e.garanti_bitis)} tarihinde bitti">Garanti bitti</span>`;
  if (g <= 30) return html`<span class="rozet turuncu" title="Garanti bitiş: ${tarih(e.garanti_bitis)}">Garanti ${g} gün</span>`;
  return html`<span class="rozet yesil" title="Garanti bitiş: ${tarih(e.garanti_bitis)}">Garantili</span>`;
}

export const cihazAdi = (e) => [e.tur, [e.marka, e.model].filter(Boolean).join(' ')].filter(Boolean).join(' · ');

// Yeni / düzenle formu. cari verilirse cari seçimi kilitli gelir.
export async function envanterFormu(kayit, { cari, yonetici = true, isId } = {}) {
  const turler = await api.get('/envanter-turleri').catch(() => []);
  const e = kayit ? await api.get(`/envanter/${kayit.id}`) : { durum: 'aktif' };
  let secilenCari = cari || (e.cari_id ? { id: e.cari_id, unvan: e.unvan } : null);
  return pencere({
    baslik: kayit ? 'Cihaz kaydı' : (isId ? 'Kurulan cihazı envantere ekle' : 'Yeni cihaz kaydı'),
    genis: true,
    icerik: html`
      ${!isId ? html`<label class="alan"><span>Kurum / cari *</span><input id="env-cari" value="${secilenCari?.unvan || ''}" ${cari ? 'readonly' : ''} placeholder="Ara…"></label>` : ''}
      <div class="satir3">
        <label class="alan"><span>Cihaz türü *</span><input name="tur" value="${e.tur || ''}" list="env-tur" required placeholder="IP Kamera, NVR, Yazıcı…">
          <datalist id="env-tur">${turler.map((t) => html`<option value="${t}">`)}</datalist></label>
        <label class="alan"><span>Marka</span><input name="marka" value="${e.marka || ''}"></label>
        <label class="alan"><span>Model</span><input name="model" value="${e.model || ''}"></label>
        <label class="alan"><span>Seri no</span><input name="seri_no" value="${e.seri_no || ''}"></label>
        <label class="alan"><span>Konum</span><input name="konum" value="${e.konum || ''}" placeholder="Muhasebe odası, 2. kat koridor…"></label>
        <label class="alan"><span>IP adresi</span><input name="ip_adresi" value="${e.ip_adresi || ''}" placeholder="192.168.1.64"></label>
        ${!isId ? html`
          <label class="alan"><span>Kurulum tarihi</span><input type="date" name="kurulum_tarihi" value="${e.kurulum_tarihi || ''}"></label>
          <label class="alan"><span>Garanti bitiş</span><input type="date" name="garanti_bitis" value="${e.garanti_bitis || ''}"></label>
          <label class="alan"><span>Durum</span><select name="durum">${Object.entries(ENV_DURUM).map(([k, v]) => html`<option value="${k}" ${e.durum === k ? 'selected' : ''}>${v.ad}</option>`)}</select></label>` : ''}
      </div>
      <label class="alan"><span>Notlar</span><textarea name="notlar" rows="2">${e.notlar || ''}</textarea></label>
      ${yonetici && !isId ? html`<label class="alan gizli-alan"><span>🔒 Erişim bilgisi (kullanıcı adı, şifre…) — sadece yöneticiler görür</span>
        <textarea name="erisim_bilgisi" rows="2" autocomplete="off" spellcheck="false">${e.erisim_bilgisi || ''}</textarea></label>` : ''}
      ${isId ? html`<label class="kutu-sec"><input type="checkbox" name="bu_ise_bagla" checked> Bu işi bu cihaza bağla</label>` : ''}
      ${kayit && e.isler?.length ? html`<div class="alan"><span>Bu cihazla ilgili işler</span><ul class="mini-liste" style="border:1px solid var(--cizgi);border-radius:8px">
        ${e.isler.map((i) => html`<li><a href="#/is/${i.id}">#${i.id} ${i.baslik}</a><span class="bosluk"></span><small>${tarih(i.plan_baslangic || i.olusturma)}</small></li>`)}</ul></div>` : ''}
      ${kayit ? html`<p class="soluk" style="font-size:.8rem">Kayıt: ${zaman(e.olusturma)}${e.kaynak_is_id ? html` · <a href="#/is/${e.kaynak_is_id}">İş #${e.kaynak_is_id}</a>'de kuruldu` : ''}</p>` : ''}`,
    acildi: (d) => {
      const inp = $('#env-cari', d);
      if (inp && !cari) { const s = (c) => { secilenCari = c; inp.value = c.unvan; }; cariSecici(inp, s); cariYeniYakala(d, s); }
    },
    kaydet: async (v) => {
      if (!v.tur) throw new Error('Cihaz türü gerekli.');
      if (isId) return api.post(`/isler/${isId}/envanter`, v);
      if (!secilenCari) throw new Error('Kurum / cari seçin.');
      const govde = { ...v, cari_id: secilenCari.id };
      if (kayit) { await api.put(`/envanter/${kayit.id}`, govde); return kayit; }
      return api.post('/envanter', govde);
    },
  });
}

// Cari kartı ve saha ekranı için kompakt liste
export function envanterTablosu(liste, { yonetici = true, bosMetin = 'Kayıtlı cihaz yok.' } = {}) {
  if (!liste.length) return html`<div class="bos-durum">${bosMetin}</div>`;
  return html`<table class="tablo mobil-kart"><thead><tr><th>Cihaz</th><th>Konum</th><th>Seri no</th><th>IP</th><th>Garanti</th>${yonetici ? html`<th></th>` : ''}</tr></thead><tbody>
    ${liste.map((e) => html`<tr class="${yonetici ? 'tikla' : ''} ${e.durum === 'kaldirildi' ? 'iptal' : ''}" ${yonetici ? html`data-env="${e.id}"` : ''}>
      <td class="ana-hucre" data-et="">${cihazAdi(e)}${e.durum !== 'aktif' ? html` ${envDurumRozet(e.durum)}` : ''}${e.notlar ? html`<div class="alt-satir">${e.notlar}</div>` : ''}</td>
      <td data-et="Konum">${e.konum || ''}</td><td data-et="Seri no" class="mono">${e.seri_no || ''}</td><td data-et="IP" class="mono">${e.ip_adresi || ''}</td>
      <td data-et="Garanti">${garantiRozet(e)}</td>${yonetici ? html`<td data-et="">${e.erisim_var ? html`<span title="Erişim bilgisi kayıtlı">🔒</span>` : ''}</td>` : ''}</tr>`)}</tbody></table>`;
}

export default async function (el, _p, ctx) {
  ctx.baslik('Envanter');
  const turler = await api.get('/envanter-turleri');
  const f = { q: '', tur: '', durum: '', garanti: ctx.sorgu.garanti || '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Müşteri envanteri</h2><span class="alt">Kurumlarda kurulu cihazlar</span><span class="bosluk"></span>
      <button class="btn ikincil" id="csv">Excel</button><button class="btn birincil" id="yeni">+ Cihaz ekle</button></div>
    <div class="filtre">
      <input type="search" id="q" placeholder="Ara: kurum, seri no, model, IP, konum…">
      <select id="tur"><option value="">Tüm türler</option>${turler.map((t) => html`<option>${t}</option>`)}</select>
      <select id="durum"><option value="">Aktif + arızalı</option>${Object.entries(ENV_DURUM).map(([k, v]) => html`<option value="${k}">${v.ad}</option>`)}</select>
      <select id="garanti"><option value="">Garanti: tümü</option><option value="30gun">30 gün içinde bitecek</option><option value="bitmis">Garantisi bitmiş</option><option value="devam">Garantisi devam eden</option></select>
    </div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  $('#garanti', el).value = f.garanti;
  let veri = [];
  const ciz = async () => {
    veri = await api.get('/envanter', f);
    const kurumSayisi = new Set(veri.map((e) => e.cari_id)).size;
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Kurum</th><th>Cihaz</th><th>Konum</th><th>Seri no</th><th>IP</th><th>Kurulum</th><th>Garanti</th><th></th></tr></thead><tbody>
      ${veri.length ? veri.map((e) => html`<tr class="tikla ${e.durum === 'kaldirildi' ? 'iptal' : ''}" data-env="${e.id}">
        <td data-et="Kurum"><a href="#/cari/${e.cari_id}?sekme=envanter">${e.unvan}</a></td>
        <td class="ana-hucre" data-et="">${cihazAdi(e)}${e.durum !== 'aktif' ? html` ${envDurumRozet(e.durum)}` : ''}</td>
        <td data-et="Konum">${e.konum || ''}</td><td data-et="Seri no" class="mono">${e.seri_no || ''}</td><td data-et="IP" class="mono">${e.ip_adresi || ''}</td>
        <td data-et="Kurulum">${tarih(e.kurulum_tarihi)}</td><td data-et="Garanti">${garantiRozet(e)}</td>
        <td data-et="">${e.erisim_var ? html`<span title="Erişim bilgisi kayıtlı">🔒</span>` : ''}</td></tr>`)
        : html`<tr><td colspan="8" class="bos-durum"><b>Kayıt yok</b>Kurumlardaki cihazları buraya ekleyebilirsiniz.</td></tr>`}</tbody>
      ${veri.length ? html`<tfoot><tr><td colspan="8" data-et="">${veri.length} cihaz · ${kurumSayisi} kurum</td></tr></tfoot>` : ''}</table>`);
  };
  $('#q', el).addEventListener('input', debounce((e) => { f.q = e.target.value; ciz(); }, 250));
  for (const k of ['tur', 'durum', 'garanti']) $('#' + k, el).onchange = (e) => { f[k] = e.target.value; ciz(); };
  $('#yeni', el).onclick = async () => { if (await envanterFormu(null)) { bildir('Cihaz eklendi.', 'basari'); ciz(); } };
  $('#csv', el).onclick = () => csvIndir('envanter', ['Kurum', 'Tür', 'Marka', 'Model', 'Seri no', 'Konum', 'IP', 'Kurulum', 'Garanti bitiş', 'Durum', 'Notlar'],
    veri.map((e) => [e.unvan, e.tur, e.marka, e.model, e.seri_no, e.konum, e.ip_adresi, tarih(e.kurulum_tarihi), tarih(e.garanti_bitis), ENV_DURUM[e.durum]?.ad, e.notlar]));
  el.addEventListener('click', async (e) => {
    if (e.target.closest('a')) return;
    const t = e.target.closest('[data-env]');
    if (t && await envanterFormu({ id: Number(t.dataset.env) })) { bildir('Kaydedildi.', 'basari'); ciz(); }
  });
  await ciz();
}
