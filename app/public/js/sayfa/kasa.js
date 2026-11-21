import { api } from '../api.js';
import { html, $, para, tarih, bildir, onayla, bugunStr, csvIndir } from '../ui.js';
import { finansPenceresi, silOnay } from '../bilesen.js';

const TIP = { tahsilat: 'Tahsilat', odeme: 'Ödeme', masraf: 'Masraf', virman_giris: 'Virman (giriş)', virman_cikis: 'Virman (çıkış)' };

export default async function (el, _p, ctx) {
  ctx.baslik('Kasa / Banka');
  const ay = new Date(); ay.setDate(1);
  const f = { hesap_id: '', tip: '', bas: bugunStr(ay), bit: '' };
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>Kasa / Banka</h2><span class="bosluk"></span>
      <div class="btn-grup"><button class="btn birincil" data-f="tahsilat">💰 Tahsilat</button><button class="btn ikincil" data-f="odeme">Ödeme</button>
        <button class="btn ikincil" data-f="masraf">Masraf</button><button class="btn ikincil" data-f="virman">Virman</button></div></div>
    <div class="istatistik" id="hesaplar"></div>
    <div class="filtre"><select id="hesap"><option value="">Tüm hesaplar</option></select>
      <select id="tip"><option value="">Tüm işlemler</option>${Object.entries(TIP).map(([k, v]) => html`<option value="${k}">${v}</option>`)}</select>
      <label>Başlangıç <input type="date" id="bas" value="${f.bas}"></label><label>Bitiş <input type="date" id="bit"></label>
      <span class="bosluk"></span><button class="btn ikincil" id="csv">Excel</button></div>
    <div class="kart"><div class="tablo-kap" id="liste"></div></div>`);
  let veri = [];
  const ciz = async () => {
    const [hesaplar, hareket] = await Promise.all([api.get('/hesaplar'), api.get('/finans', f)]);
    veri = hareket;
    $('#hesaplar', el).innerHTML = String(html`${hesaplar.filter((h) => h.aktif).map((h) => html`<div class="ist ${String(h.id) === f.hesap_id ? 'vurgu' : ''}" style="cursor:pointer" data-hesap="${h.id}">
      <small>${h.ad}</small><b class="${h.bakiye < 0 ? 'negatif' : ''}">${para(h.bakiye)}</b></div>`)}`);
    const s = $('#hesap', el);
    if (s.options.length === 1) hesaplar.forEach((h) => s.add(new Option(h.ad, h.id)));
    s.value = f.hesap_id;
    const giris = veri.filter((x) => !x.iptal && x.isaretli > 0).reduce((a, x) => a + Number(x.isaretli), 0);
    const cikis = veri.filter((x) => !x.iptal && x.isaretli < 0).reduce((a, x) => a - Number(x.isaretli), 0);
    $('#liste', el).innerHTML = String(html`<table class="tablo mobil-kart"><thead><tr><th>Tarih</th><th>Hesap</th><th>İşlem</th><th>Cari / açıklama</th><th class="sayi">Giriş</th><th class="sayi">Çıkış</th><th></th></tr></thead><tbody>
      ${veri.length ? veri.map((x) => html`<tr class="${x.iptal ? 'iptal' : ''}">
        <td data-et="Tarih" class="nowrap">${tarih(x.tarih)}</td><td data-et="Hesap">${x.hesap_ad}</td><td class="ana-hucre" data-et="">${TIP[x.tip]}</td>
        <td data-et="Açıklama">${x.unvan ? html`<a href="#/cari/${x.cari_id}">${x.unvan}</a> · ` : ''}${x.aciklama || ''}${x.belge_no ? ` (${x.belge_no})` : ''}<div class="alt-satir">${x.olusturan || ''}</div></td>
        <td class="sayi pozitif" data-et="Giriş">${x.isaretli > 0 ? para(x.isaretli) : ''}</td><td class="sayi negatif" data-et="Çıkış">${x.isaretli < 0 ? para(-x.isaretli) : ''}</td>
        <td data-et="" class="nowrap">${x.tip === 'tahsilat' && !x.iptal ? html`<button class="btn-ikon" data-makbuz="${x.id}" title="Makbuz yazdır">🖨</button>` : ''}
          ${!x.iptal ? html`<button class="btn-ikon" data-iptal="${x.id}" title="İptal et">⊘</button>` : html`<span class="rozet kirmizi">İptal</span>`}
          <button class="btn-ikon" data-sil="${x.id}" title="Sil (30 gün geri alınabilir)">🗑</button></td></tr>`)
        : html`<tr><td colspan="7" class="bos-durum">Hareket yok</td></tr>`}</tbody>
      ${veri.length ? html`<tfoot><tr><td colspan="4" data-et="">Dönem toplamı</td><td class="sayi" data-et="Giriş">${para(giris)}</td><td class="sayi" data-et="Çıkış">${para(cikis)}</td><td data-et="Net">${para(giris - cikis)}</td></tr></tfoot>` : ''}</table>`);
  };
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-f]');
    if (b) { if (await finansPenceresi(b.dataset.f)) ciz(); return; }
    const h = e.target.closest('[data-hesap]');
    if (h) { f.hesap_id = f.hesap_id === h.dataset.hesap ? '' : h.dataset.hesap; return ciz(); }
    const mk = e.target.closest('[data-makbuz]');
    if (mk) { const { makbuzAc } = await import('../bilesen.js'); return makbuzAc(Number(mk.dataset.makbuz)).catch((err) => bildir(err.message, 'hata')); }
    const sl = e.target.closest('[data-sil]');
    if (sl) { if (await silOnay('finans', Number(sl.dataset.sil))) ciz(); return; }
    const ip = e.target.closest('[data-iptal]');
    if (ip && await onayla('Bu hareket iptal edilsin mi? Bağlı cari kaydı da iptal edilir.', { evet: 'İptal et', tehlike: true })) {
      try { await api.post(`/finans/${ip.dataset.iptal}/iptal`); bildir('İptal edildi.'); ciz(); } catch (err) { bildir(err.message, 'hata'); }
    }
  });
  $('#hesap', el).onchange = (e) => { f.hesap_id = e.target.value; ciz(); };
  $('#tip', el).onchange = (e) => { f.tip = e.target.value; ciz(); };
  $('#bas', el).onchange = (e) => { f.bas = e.target.value; ciz(); };
  $('#bit', el).onchange = (e) => { f.bit = e.target.value; ciz(); };
  $('#csv', el).onclick = () => csvIndir('kasa-banka', ['Tarih', 'Hesap', 'İşlem', 'Cari', 'Açıklama', 'Belge', 'Tutar', 'İptal'],
    veri.map((x) => [tarih(x.tarih), x.hesap_ad, TIP[x.tip], x.unvan, x.aciklama, x.belge_no, Number(x.isaretli), x.iptal ? 'evet' : '']));
  await ciz();
}
