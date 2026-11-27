import { api } from '../api.js';
import { html, $, bildir, pencere, sor, onayla, sureMetni, telLink, ONCELIK, miktar } from '../ui.js';
import { planlaPenceresi, yeniIsPenceresi, cariSecici, cariYeniYakala, urunSecici } from '../bilesen.js';
import { bosSatir, satirEditoruHtml, satirEditoruBagla, satirlariHazirla } from '../satirEditoru.js';

// Hızlı iş kutusu: panel ve havuz sayfasında kullanılır
export function hizliKutu(kap, ctx, sonra) {
  kap.innerHTML = String(html`<form class="hizli-kutu">
    <textarea name="mesaj" placeholder="Örn: Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33" required></textarea>
    <div class="btn-grup"><button class="btn birincil">Havuza ekle</button>
      <select name="oncelik" style="width:auto"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select>
      <span class="soluk" style="font-size:.85rem">Müşterinin telefonunu ya da adını yazarsanız kayıtlı cari bulunur; bulunamazsa cari seçme penceresi açılır. Ctrl+Enter ile ekleyin.</span></div></form>`);
  const f = $('form', kap);
  f.mesaj.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit(); });
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.mesaj.value.trim()) return;
    const btn = $('button', f); btn.disabled = true;
    try {
      const r = await api.post('/isler/hizli', { mesaj: f.mesaj.value, oncelik: Number(f.oncelik.value) });
      bildir(`Havuza eklendi · ${r.cari?.unvan || ''} ile eşleşti`, 'basari', 4500);
      f.reset();
      sonra?.(r);
    } catch (err) {
      // Müşteri bulunamadı: İş ekle penceresi yazılanla açılır, cari orada seçilir / yeni açılır
      if (/cari/i.test(err.message)) {
        bildir('Müşteri bulunamadı; cariyi seçin ya da yeni cari açın.', 'uyari', 4500);
        const mesaj = f.mesaj.value; f.reset();
        hizliIs(ctx, { mesaj, sonra });
      } else bildir(err.message, 'hata');
    }
    btn.disabled = false;
  };
}

// Üst çubuktaki "+ Hızlı iş" düğmesi
// Üst çubuktaki "+ İş ekle": iş havuza atılır veya "işi ben yaptım" ile hizmet/malzeme girilip cariye taslak fiş açılır.
// Not: pencere zaten bir form; içine ikinci form konamaz (tarayıcı yok sayar), alanlar doğrudan pencerede.
export function hizliIs(ctx, { mesaj: ilkMesaj = '', sonra: sonraFn = null } = {}) {
  let cari = null; let benYaptim = false;
  const satirlar = [];
  const malzemeler = [];
  let editor = null;
  pencere({
    baslik: 'İş ekle',
    sinif: 'hizli-pencere',
    icerik: html`<div class="hizli-kutu hi-izgara">
      <div class="hi-sol">
      <label class="alan" style="margin:0"><span>İş / telefondaki konuşma</span>
        <textarea name="mesaj" rows="5" ${ilkMesaj ? '' : 'autofocus'} placeholder="Örn: Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33">${ilkMesaj}</textarea></label>
      <div class="satir2 hi-cari-satir">
        ${cariAlani('(telefonu kayıtlıysa kendiliğinden bulunur)')}
        <label class="alan" style="margin:0"><span>Öncelik</span>
          <select name="oncelik"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select></label>
      </div>
      <label class="kutu-sec hi-mod"><input type="checkbox" id="hi-ben"> <span><b>İşi ben yaptım</b> — verdiğim hizmeti ve kullandığım malzemeyi gireyim, cariye fiş açılsın</span></label>
      <p class="soluk hi-ipucu" style="font-size:.84rem;margin:.2rem 0 0">"Acil" ile başlayan mesaj acil olur. Ctrl+Enter ile kaydedin.</p>
      <div class="hi-malzeme" id="hi-malzeme">
        <div class="hi-malzeme-ust"><b>Ekibe verilecek malzeme</b><small class="soluk">isteğe bağlı · stoktan düşer · işte "verildi" görünür</small></div>
        <div id="hm-liste"></div>
        <div class="btn-grup"><button type="button" class="btn ikincil kucuk" data-hm-ekle>+ Malzeme</button><button type="button" class="btn ikincil kucuk" data-hm-stok>📦 Stok listesi</button></div>
      </div>
      </div>
      ${satirEditoruHtml({ gizli: true, not: 'Kaydedince iş "tamamlandı" olur ve bu cariye taslak satış fişi açılır. Fiyatları orada yazıp Onayla deyince müşteri borçlanır, malzeme stoktan düşer.' })}
    </div>`,
    kaydetMetin: 'Havuza ekle',
    acildi: (d) => {
      $('textarea', d).focus();
      const kaydetBtn = $('button[type=submit]', d);
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('form', d).requestSubmit(); } });
      cariAlaniBagla(d, null, (c) => { cari = c; });
      if (ilkMesaj) setTimeout(() => $('#hi-cari', d)?.focus(), 60);
      void sonraFn;
      // Ekibe verilecek malzeme listesi
      const hmCiz = () => {
        $('#hm-liste', d).innerHTML = String(html`${malzemeler.map((m, i) => html`<div class="hm-satir" data-hm="${i}">
          ${m.urun ? html`<span class="hm-ad"><b>${m.urun.ad}</b>${m.urun.kod ? html` <small class="soluk">${m.urun.kod}</small>` : ''}</span>` : html`<input class="hm-ara" placeholder="Ürün ara… (ad, kod, barkod)">`}
          <input class="hm-mik" inputmode="decimal" value="${String(m.miktar).replace('.', ',')}" aria-label="Miktar"><span class="hm-birim">${m.urun?.birim || ''}</span>
          <button type="button" class="btn-ikon" data-hm-sil="${i}" aria-label="Kaldır">✕</button></div>`)}`);
        d.querySelectorAll('.hm-ara').forEach((inp) => {
          const i = Number(inp.closest('[data-hm]').dataset.hm);
          urunSecici(inp, (u) => { malzemeler[i].urun = u; hmCiz(); d.querySelector(`[data-hm="${i}"] .hm-mik`)?.select(); }, { yeniIzin: false });
        });
        d.querySelectorAll('.hm-mik').forEach((inp) => { inp.oninput = () => { malzemeler[Number(inp.closest('[data-hm]').dataset.hm)].miktar = Number(String(inp.value).replace(',', '.')) || 1; }; });
      };
      d.addEventListener('click', async (e) => {
        if (e.target.closest('[data-hm-ekle]')) { malzemeler.push({ urun: null, miktar: 1 }); hmCiz(); d.querySelector('.hm-ara:last-of-type')?.focus(); const s2 = d.querySelectorAll('.hm-ara'); s2[s2.length - 1]?.focus(); return; }
        const sl = e.target.closest('[data-hm-sil]'); if (sl) { malzemeler.splice(Number(sl.dataset.hmSil), 1); hmCiz(); return; }
        if (e.target.closest('[data-hm-stok]')) {
          const { stokListesi } = await import('../bilesen.js');
          const sec = await stokListesi({ fiyat: ctx.muhasebe ? 'satis' : 'yok', baslik: 'Ekibe verilecek malzeme' });
          for (const { urun: u, miktar: mk } of sec || []) { const v = malzemeler.find((x) => x.urun?.id === u.id); if (v) v.miktar += mk; else malzemeler.push({ urun: u, miktar: mk }); }
          hmCiz();
        }
      });
      $('#hi-ben', d).onchange = (e) => {
        benYaptim = e.target.checked;
        $('#hi-detay', d).hidden = !benYaptim;
        $('#hi-malzeme', d).hidden = benYaptim;
        d.classList.toggle('ben-yaptim', benYaptim);
        kaydetBtn.textContent = benYaptim ? 'Kaydet ve fişi aç' : 'Havuza ekle';
        if (benYaptim && !editor) { satirlar.push(bosSatir()); editor = satirEditoruBagla(d, satirlar); $('#hi-satirlar [data-k=aciklama]', d)?.focus(); }
      };
    },
    kaydet: async (v) => {
      if (!String(v.mesaj || '').trim()) throw new Error(benYaptim ? 'İşin açıklamasını yazın.' : 'Mesajı yazın.');
      if (!benYaptim) {
        const mz = malzemeler.filter((m) => m.urun).map((m) => ({ urun_id: m.urun.id, miktar: m.miktar }));
        const r = await api.post('/isler/hizli', { mesaj: v.mesaj, oncelik: Number(v.oncelik), cari_id: cari?.id || null, malzemeler: mz });
        bildir(`${r.cari ? `Havuza eklendi · ${r.cari.unvan}` : 'Havuza eklendi (müşteri eşleşmedi, sonra bağlayabilirsiniz)'}${mz.length ? ` · ${mz.length} malzeme verildi` : ''}`, 'basari', 4500);
        return { tur: 'havuz', ...r };
      }
      if (!cari) throw new Error('"İşi ben yaptım" için cari seçin.');
      const dolu = satirlariHazirla(satirlar);
      if (!dolu.length) throw new Error('En az bir hizmet veya malzeme girin.');
      const r = await api.post('/isler/ofis', { mesaj: v.mesaj, oncelik: Number(v.oncelik), cari_id: cari.id, satirlar: dolu });
      bildir(`${cari.unvan} için fiş açıldı. Fiyatları kontrol edip onaylayın.`, 'basari', 5000);
      return { tur: 'ofis', ...r };
    },
  }).then((r) => {
    if (!r) return;
    ctx.sayacYenile?.();
    if (r.tur === 'ofis') ctx.git(`fis/${r.fis_id}`);
    else if (/havuz|panel|takvim/.test(location.hash || '#/panel')) ctx.yenile();
  });
}

// Cari alanı (ara / seç / yeni cari / temizle) — iki pencerede ortak
const cariAlani = (ipucu) => html`<label class="alan" style="margin:0"><span>Cari * ${ipucu ? html`<small class="soluk">${ipucu}</small>` : ''}</span>
  <div class="hi-cari"><input id="hi-cari" placeholder="Müşteri ara…" autocomplete="off"><button type="button" class="btn-ikon" id="hi-cari-temizle" title="Cariyi kaldır" hidden>✕</button></div></label>`;
function cariAlaniBagla(d, baslangic, degisti) {
  const ci = $('#hi-cari', d); const temizle = $('#hi-cari-temizle', d);
  let secili = null;
  const ayarla = (c) => {
    secili = c; degisti(c);
    if (c) ci.value = c.unvan;
    ci.classList.toggle('secili', !!c); temizle.hidden = !c;
  };
  cariSecici(ci, ayarla); cariYeniYakala(d, ayarla);
  if (baslangic) ayarla(baslangic);
  ci.addEventListener('input', () => { if (secili && ci.value !== secili.unvan) ayarla(null); });
  temizle.onclick = () => { ci.value = ''; ayarla(null); ci.focus(); };
}

// Havuzdaki / planlı işi ofisten kapatma: sadece malzeme teslimi veya hizmet + malzeme. İmza isteğe bağlı.
export async function teslimEtPenceresi(ctx, isOzet) {
  const is = await api.get(`/isler/${isOzet.id}`);
  let cari = is.cari_id ? { id: is.cari_id, unvan: is.cari_unvan || is.unvan } : null;
  let imza = null;
  const satirlar = [bosSatir('urun')];
  const malzemeler = is.malzemeler || [];
  // Malzeme yazılmışsa kalem tablosu açılmaz; yalnız özet (ek kalem gerekirse "+ Ek kalem" ile açılır)
  const ozetMod = malzemeler.length > 0;
  const t = is.teslim;
  return pencere({
    baslik: `Teslim et / Tamamla · #${is.id}`,
    sinif: `hizli-pencere ben-yaptim ${ozetMod ? 'te-ozet-mod' : ''}`,
    icerik: html`<div class="hizli-kutu hi-izgara">
      <div class="hi-sol">
        <div class="hi-is-ozet"><b>${is.baslik}</b>${is.aciklama && is.aciklama !== is.baslik ? html`<small>${is.aciklama}</small>` : ''}</div>
        ${cariAlani(cari ? '' : '(işe bağlı cari yok, seçin)')}
        ${ozetMod ? html`<div class="te-malzeme"><small>Girilen malzeme / işçilik</small><ul>${malzemeler.map((m) => html`<li><span>${m.ad}</span><b>${miktar(m.miktar)} ${m.birim}</b></li>`)}</ul></div>` : ''}
        ${t ? html`<div class="basari-kutu" style="margin:0">✓ Onay alındı: ${[t.teslim_alan_ad, t.teslim_alan_tel].filter(Boolean).join(' · ')}${t.imza_dosya ? ' (imzalı)' : ''}</div>`
          : html`<div class="satir2" style="margin:0">
            <label class="alan" style="margin:0"><span>Teslim alan / bilgilendirilen kişi</span><input name="teslim_alan_ad" value="${is.iletisim_ad || ''}" placeholder="Ad soyad"></label>
            <label class="alan" style="margin:0"><span>Telefon</span><input name="teslim_alan_tel" type="tel" value="${is.iletisim_tel || ''}" placeholder="05xx…"></label></div>
          <small class="soluk" style="margin-top:-.3rem">Ad ya da telefondan en az biri gerekli.</small>
          <div class="hi-imza"><button type="button" class="btn ikincil" id="te-imza">✍ İmza al</button><span class="soluk" id="te-imza-durum">İmza isteğe bağlı</span></div>`}
        <label class="alan" style="margin:0"><span>Not <small class="soluk">(isteğe bağlı)</small></span><textarea name="not" rows="2"></textarea></label>
        ${ozetMod ? html`<button type="button" class="btn-metin" id="te-ek-ac">+ Ek kalem (işçilik / hizmet / malzeme)</button>` : ''}
      </div>
      <div class="te-ek" ${ozetMod ? 'hidden' : ''}>
      ${satirEditoruHtml({ baslik: ozetMod ? 'Ek kalem' : 'Teslim edilen malzeme / verilen hizmet', not: 'Kaydedince iş "tamamlandı" olur ve cariye taslak satış fişi açılır. Fiyatları yazıp Onayla deyince müşteri borçlanır, malzeme stoktan düşer.' })}
      </div>
    </div>`,
    kaydetMetin: ozetMod ? 'Tamamla ve satış fişine geç' : 'Tamamla ve fişi aç',
    acildi: (d) => {
      cariAlaniBagla(d, cari, (c) => { cari = c; });
      satirEditoruBagla(d, satirlar);
      if (cari && !ozetMod) $('#hi-satirlar [data-k=aciklama]', d)?.focus();
      const ek = $('#te-ek-ac', d);
      if (ek) ek.onclick = () => { $('.te-ek', d).hidden = false; ek.hidden = true; d.classList.remove('te-ozet-mod'); $('#hi-satirlar [data-k=aciklama]', d)?.focus(); };
      const ib = $('#te-imza', d);
      if (ib) ib.onclick = async () => {
        const { imzaAl } = await import('../imza.js');
        const s = await imzaAl({ baslik: 'Teslim onayı', ad: $('[name=teslim_alan_ad]', d).value || is.iletisim_ad || '', tel: $('[name=teslim_alan_tel]', d).value || is.iletisim_tel || '', metin: ctx.ayarlar.teslim_metni });
        if (!s) return;
        imza = s.imza;
        if (s.teslim_alan_ad) $('[name=teslim_alan_ad]', d).value = s.teslim_alan_ad;
        $('#te-imza-durum', d).innerHTML = String(html`<span style="color:var(--yesil)">✓ İmza alındı</span> <img src="${imza}" alt="" class="hi-imza-onizleme">`);
      };
    },
    kaydet: async (v) => {
      if (!cari) throw new Error('Cari seçin.');
      const dolu = satirlariHazirla(satirlar);
      if (!dolu.length && !malzemeler.length) throw new Error('En az bir malzeme veya hizmet girin.');
      if (!t && !String(v.teslim_alan_ad || '').trim() && !String(v.teslim_alan_tel || '').trim()) throw new Error('Kime teslim edildiğini / kime bilgi verildiğini yazın (ad ya da telefon).');
      if (imza && !String(v.teslim_alan_ad || '').trim()) throw new Error('İmza için teslim alan kişinin adını yazın.');
      const r = await api.post(`/isler/${is.id}/teslim-et`, { cari_id: cari.id, satirlar: dolu, teslim_alan_ad: v.teslim_alan_ad, teslim_alan_tel: v.teslim_alan_tel, imza, not: v.not });
      bildir(`İş #${is.id} tamamlandı, satış fişi açıldı. Fiyatları kontrol edip onaylayın.`, 'basari', 5000);
      return r;
    },
  }).then((r) => { if (r) { ctx.sayacYenile?.(); ctx.git(`fis/${r.fis_id}`); } return r; });
}

export function havuzKarti(i, { surukle = false } = {}) {
  return html`<div class="is-kart oncelik-${i.oncelik} ${surukle ? 'surukle' : ''}" data-is="${i.id}" ${surukle ? html`draggable="true"` : ''}>
    <div class="is-ust"><div class="is-baslik">${i.baslik}</div>${i.oncelik === 1 ? html`<span class="rozet kirmizi">Acil</span>` : ''}</div>
    <div class="is-bilgi"><span>#${i.id}</span>${i.unvan ? html`<span>👤 ${i.unvan}</span>` : html`<span style="color:var(--turuncu)">Cari bağlı değil</span>`}
      ${i.iletisim_tel ? html`<span>📞 ${i.iletisim_tel}</span>` : ''}
      <span>⏱ ${sureMetni(i.bekleme_sn)} önce</span>${i.havuza_donus_sayisi ? html`<span>↩ ${i.havuza_donus_sayisi} kez ertelendi</span>` : ''}</div>
    ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}
  </div>`;
}

export default async function (el, _p, ctx) {
  ctx.baslik('İş Havuzu');
  el.innerHTML = String(html`
    <div class="sayfa-ust"><h2>İş Havuzu</h2><span class="alt">Takvime yerleştirilmeyi bekleyen işler</span><span class="bosluk"></span>
      <button class="btn ikincil" id="yeni-detayli">+ Detaylı iş</button></div>
    <div class="kart"><div class="kart-govde" id="hizli"></div></div>
    <div id="liste"></div>`);
  const ciz = async () => {
    const liste = await api.get('/havuz');
    $('#liste', el).innerHTML = String(liste.length ? html`
      <div class="grup-baslik">${liste.length} iş bekliyor</div>
      ${liste.map((i) => html`<div class="is-kart oncelik-${i.oncelik}">
        <div class="is-ust"><a class="is-baslik" href="#/is/${i.id}">${i.baslik}</a>
          <span class="rozet ${i.oncelik === 1 ? 'kirmizi' : i.oncelik === 3 ? '' : 'mavi'}">${ONCELIK[i.oncelik]}</span></div>
        <div class="is-bilgi"><span>#${i.id}</span>
          ${i.unvan ? html`<span>👤 ${i.unvan}</span>` : html`<span style="color:var(--turuncu)">Cari bağlı değil</span>`}
          ${i.iletisim_tel ? html`<span>📞 ${telLink(i.iletisim_tel)}</span>` : ''}
          <span>⏱ ${sureMetni(i.bekleme_sn)} önce</span>
          ${i.havuza_donus_sayisi ? html`<span>↩ ${i.havuza_donus_sayisi} kez havuza döndü</span>` : ''}</div>
        ${i.adres ? html`<div class="is-bilgi">📍 ${i.adres}</div>` : ''}
        ${i.ham_mesaj && i.ham_mesaj !== i.baslik ? html`<div class="is-bilgi" style="white-space:pre-wrap">💬 ${i.ham_mesaj}</div>` : ''}
        <div class="btn-grup">
          <button class="btn birincil kucuk" data-planla="${i.id}">📅 Takvime yerleştir</button>
          <button class="btn basari kucuk" data-teslim="${i.id}" title="Sahaya gitmeden kapat: malzeme teslimi veya hizmet + malzeme">✓ Teslim et / Tamamla</button>
          <a class="btn ikincil kucuk" href="#/is/${i.id}">Detay / düzenle</a>
          <button class="btn tehlike-cizgi kucuk" data-iptal="${i.id}">İptal</button>
        </div></div>`)}`
      : html`<div class="bos-durum"><b>Havuz boş</b>Telefonla gelen işi yukarıdaki kutuya yazın.</div>`);
    el._liste = liste;
  };
  hizliKutu($('#hizli', el), ctx, ciz);
  await ciz();
  $('#yeni-detayli', el).onclick = async () => { if (await yeniIsPenceresi(ctx, { havuza: true })) ciz(); };
  el.addEventListener('click', async (e) => {
    const te = e.target.closest('[data-teslim]');
    if (te) { await teslimEtPenceresi(ctx, { id: Number(te.dataset.teslim) }); return; }
    const p = e.target.closest('[data-planla]');
    if (p) {
      const is = el._liste.find((x) => x.id === Number(p.dataset.planla));
      if (await planlaPenceresi(ctx, is)) ciz();
    }
    const ip = e.target.closest('[data-iptal]');
    if (ip) {
      const neden = await sor('İşi iptal et', 'İptal nedeni', { zorunlu: true });
      if (!neden) return;
      try { await api.post(`/isler/${ip.dataset.iptal}/iptal`, { neden }); bildir('İş iptal edildi.'); ciz(); } catch (err) { bildir(err.message, 'hata'); }
    }
  });
  void onayla;
}
