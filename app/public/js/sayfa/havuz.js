import { api } from '../api.js';
import { html, $, $$, bildir, pencere, sor, onayla, sureMetni, telLink, ONCELIK, sayiGiris, sayiCoz } from '../ui.js';
import { planlaPenceresi, yeniIsPenceresi, cariSecici, cariYeniYakala, urunSecici } from '../bilesen.js';

// Hızlı iş kutusu: panel ve havuz sayfasında kullanılır
export function hizliKutu(kap, ctx, sonra) {
  kap.innerHTML = String(html`<form class="hizli-kutu">
    <textarea name="mesaj" placeholder="Örn: Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33" required></textarea>
    <div class="btn-grup"><button class="btn birincil">Havuza ekle</button>
      <select name="oncelik" style="width:auto"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select>
      <span class="soluk" style="font-size:.85rem">Telefon numarası yazarsanız müşteri otomatik bulunur. Ctrl+Enter ile ekleyin.</span></div></form>`);
  const f = $('form', kap);
  f.mesaj.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) f.requestSubmit(); });
  f.onsubmit = async (e) => {
    e.preventDefault();
    if (!f.mesaj.value.trim()) return;
    const btn = $('button', f); btn.disabled = true;
    try {
      const r = await api.post('/isler/hizli', { mesaj: f.mesaj.value, oncelik: Number(f.oncelik.value) });
      bildir(r.cari ? `Havuza eklendi · ${r.cari.unvan} ile eşleşti` : 'Havuza eklendi (müşteri eşleşmedi, sonra bağlayabilirsiniz)', 'basari', 4500);
      f.reset();
      sonra?.(r);
    } catch (err) { bildir(err.message, 'hata'); }
    btn.disabled = false;
  };
}

// Üst çubuktaki "+ Hızlı iş" düğmesi
// Üst çubuktaki "+ İş ekle": iş havuza atılır veya "işi ben yaptım" ile hizmet/malzeme girilip cariye taslak fiş açılır.
// Not: pencere zaten bir form; içine ikinci form konamaz (tarayıcı yok sayar), alanlar doğrudan pencerede.
export function hizliIs(ctx) {
  let cari = null; let benYaptim = false;
  const satirlar = [];
  const bosSatir = (tip) => ({ tip, urun_id: null, aciklama: tip === 'iscilik' ? 'İşçilik' : '', miktar: 1, birim_fiyat: '' });
  const TIP = { hizmet: 'Hizmet', iscilik: 'İşçilik', urun: 'Malzeme' };

  const satirlarCiz = (d) => {
    const k = $('#hi-satirlar', d);
    k.innerHTML = String(html`${satirlar.length ? html`<table class="hi-tablo"><thead><tr><th>Tür</th><th>Hizmet / malzeme</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat (ops.)</th><th></th></tr></thead><tbody>
      ${satirlar.map((x, i) => html`<tr data-i="${i}">
        <td><select data-k="tip">${Object.entries(TIP).map(([v, a]) => html`<option value="${v}" ${x.tip === v ? 'selected' : ''}>${a}</option>`)}</select></td>
        <td>${x.tip === 'urun' && x.urun_id ? html`<b>${x.aciklama}</b> <button type="button" class="btn-metin" style="color:var(--ana)" data-hi-degistir="${i}">değiştir</button>`
          : html`<input data-k="aciklama" class="${x.tip === 'urun' ? 'hi-urun' : ''}" value="${x.aciklama}" placeholder="${x.tip === 'urun' ? 'Ürün ara… (ad, kod, model)' : 'Ne yapıldı?'}">`}</td>
        <td><input class="sayi" data-k="miktar" inputmode="decimal" value="${sayiGiris(x.miktar)}"></td>
        <td><input class="sayi" data-k="birim_fiyat" inputmode="decimal" value="${x.birim_fiyat === '' ? '' : sayiGiris(x.birim_fiyat)}" placeholder="${x.tip === 'urun' ? 'stok kartından' : 'fişte'}"></td>
        <td><button type="button" class="btn-ikon" data-hi-sil="${i}" title="Satırı sil">✕</button></td></tr>`)}</tbody></table>` : html`<p class="soluk" style="margin:.3rem 0">Verdiğiniz hizmeti ve kullandığınız malzemeyi ekleyin.</p>`}`);
    $$('.hi-urun', k).forEach((inp) => {
      const i = Number(inp.closest('tr').dataset.i);
      urunSecici(inp, (u) => { Object.assign(satirlar[i], { urun_id: u.id, aciklama: u.ad }); satirlarCiz(d); $(`tr[data-i="${i}"] [data-k=miktar]`, d)?.select(); });
    });
  };

  pencere({
    baslik: 'İş ekle',
    sinif: 'hizli-pencere',
    icerik: html`<div class="hizli-kutu hi-izgara">
      <div class="hi-sol">
      <label class="alan" style="margin:0"><span>İş / telefondaki konuşma</span>
        <textarea name="mesaj" rows="5" autofocus placeholder="Örn: Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33"></textarea></label>
      <div class="satir2 hi-cari-satir">
        <label class="alan" style="margin:0"><span>Cari ${html`<small class="soluk">(boşsa telefondan bulunur)</small>`}</span>
          <div class="hi-cari"><input id="hi-cari" placeholder="Müşteri ara…" autocomplete="off"><button type="button" class="btn-ikon" id="hi-cari-temizle" title="Cariyi kaldır" hidden>✕</button></div></label>
        <label class="alan" style="margin:0"><span>Öncelik</span>
          <select name="oncelik"><option value="2">Normal</option><option value="1">Acil</option><option value="3">Düşük</option></select></label>
      </div>
      <label class="kutu-sec hi-mod"><input type="checkbox" id="hi-ben"> <span><b>İşi ben yaptım</b> — verdiğim hizmeti ve kullandığım malzemeyi gireyim, cariye fiş açılsın</span></label>
      <p class="soluk hi-ipucu" style="font-size:.84rem;margin:.2rem 0 0">"Acil" ile başlayan mesaj acil olur. Ctrl+Enter ile kaydedin.</p>
      </div>
      <div id="hi-detay" class="hi-sag" hidden>
        <div class="hi-sag-baslik"><b>Verilen hizmet ve kullanılan malzeme</b></div>
        <div id="hi-satirlar" data-secici-sabit></div>
        <div class="btn-grup hi-ekle-dugmeler">
          <button type="button" class="btn ikincil kucuk" data-hi-ekle="hizmet">+ Hizmet</button>
          <button type="button" class="btn ikincil kucuk" data-hi-ekle="urun">+ Malzeme</button>
          <button type="button" class="btn ikincil kucuk" data-hi-ekle="iscilik">+ İşçilik</button>
          <button type="button" class="btn ikincil kucuk" data-hi-barkod>📷 Barkod</button></div>
        <p class="soluk" style="font-size:.82rem;margin:.4rem 0 0">Kaydedince iş "tamamlandı" olur ve bu cariye taslak satış fişi açılır. Fiyatları orada yazıp <b>Onayla</b> deyince müşteri borçlanır, malzeme stoktan düşer.</p>
      </div></div>`,
    kaydetMetin: 'Havuza ekle',
    acildi: (d) => {
      const t = $('textarea', d); t.focus();
      const kaydetBtn = $('button[type=submit]', d);
      d.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); $('form', d).requestSubmit(); } });
      const ci = $('#hi-cari', d); const temizle = $('#hi-cari-temizle', d);
      const cariSec = (c) => { cari = c; ci.value = c.unvan; ci.classList.add('secili'); temizle.hidden = false; };
      cariSecici(ci, cariSec); cariYeniYakala(d, cariSec);
      ci.addEventListener('input', () => { if (cari && ci.value !== cari.unvan) { cari = null; ci.classList.remove('secili'); temizle.hidden = true; } });
      temizle.onclick = () => { cari = null; ci.value = ''; ci.classList.remove('secili'); temizle.hidden = true; ci.focus(); };
      $('#hi-ben', d).onchange = (e) => {
        benYaptim = e.target.checked;
        $('#hi-detay', d).hidden = !benYaptim;
        d.classList.toggle('ben-yaptim', benYaptim);
        kaydetBtn.textContent = benYaptim ? 'Kaydet ve fişi aç' : 'Havuza ekle';
        if (benYaptim && !satirlar.length) { satirlar.push(bosSatir('hizmet')); satirlarCiz(d); $('#hi-satirlar [data-k=aciklama]', d)?.focus(); }
      };
      const detay = $('#hi-detay', d);
      $('#hi-satirlar', d).addEventListener('scroll', () => $$('#hi-satirlar .secici-liste', d).forEach((k) => { k.hidden = true; }));
      detay.addEventListener('input', (e) => {
        const tr = e.target.closest('tr[data-i]'); const k = e.target.dataset.k; if (!tr || !k || k === 'tip') return;
        const x = satirlar[Number(tr.dataset.i)];
        if (k === 'aciklama') { x.aciklama = e.target.value; if (x.tip === 'urun') x.urun_id = null; }
        else x[k] = e.target.value === '' && k === 'birim_fiyat' ? '' : (sayiCoz(e.target.value) ?? '');
      });
      detay.addEventListener('change', (e) => {
        if (e.target.dataset.k !== 'tip') return;
        const i = Number(e.target.closest('tr').dataset.i);
        satirlar[i] = { ...bosSatir(e.target.value), miktar: satirlar[i].miktar }; satirlarCiz(d);
      });
      detay.addEventListener('click', async (e) => {
        const ek = e.target.closest('[data-hi-ekle]');
        if (ek) { satirlar.push(bosSatir(ek.dataset.hiEkle)); satirlarCiz(d); const k2 = $('#hi-satirlar', d); k2.scrollTop = k2.scrollHeight; $(`tr[data-i="${satirlar.length - 1}"] [data-k=aciklama]`, d)?.focus(); return; }
        const sl = e.target.closest('[data-hi-sil]');
        if (sl) { satirlar.splice(Number(sl.dataset.hiSil), 1); satirlarCiz(d); return; }
        const dg = e.target.closest('[data-hi-degistir]');
        if (dg) { const i = Number(dg.dataset.hiDegistir); Object.assign(satirlar[i], { urun_id: null, aciklama: '' }); satirlarCiz(d); $(`tr[data-i="${i}"] [data-k=aciklama]`, d)?.focus(); return; }
        if (e.target.closest('[data-hi-barkod]')) {
          const { barkodOku } = await import('../barkod.js');
          const b = await barkodOku(); if (!b) return;
          try {
            const u = await api.get(`/urunler/barkod/${encodeURIComponent(b)}`);
            const v = satirlar.find((x) => x.urun_id === u.id);
            if (v) v.miktar = Number(v.miktar || 0) + 1;
            else { const bos = satirlar.findIndex((x) => !x.urun_id && !String(x.aciklama).trim()); const y = { tip: 'urun', urun_id: u.id, aciklama: u.ad, miktar: 1, birim_fiyat: '' }; if (bos >= 0) satirlar[bos] = y; else satirlar.push(y); }
            satirlarCiz(d); bildir(`${u.ad} eklendi.`, 'basari');
          } catch { bildir(`"${b}" barkodlu ürün bulunamadı. Ürün araması ile ekleyin.`, 'hata', 5000); }
        }
      });
    },
    kaydet: async (v) => {
      if (!String(v.mesaj || '').trim()) throw new Error(benYaptim ? 'İşin açıklamasını yazın.' : 'Mesajı yazın.');
      if (!benYaptim) {
        const r = await api.post('/isler/hizli', { mesaj: v.mesaj, oncelik: Number(v.oncelik), cari_id: cari?.id || null });
        bildir(r.cari ? `Havuza eklendi · ${r.cari.unvan}` : 'Havuza eklendi (müşteri eşleşmedi, sonra bağlayabilirsiniz)', 'basari', 4500);
        return { tur: 'havuz', ...r };
      }
      if (!cari) throw new Error('"İşi ben yaptım" için cari seçin.');
      const dolu = satirlar.filter((x) => x.urun_id || String(x.aciklama || '').trim());
      const eksik = dolu.find((x) => x.tip === 'urun' && !x.urun_id);
      if (eksik) throw new Error(`"${eksik.aciklama}" için listeden ürün seçin.`);
      if (!dolu.length) throw new Error('En az bir hizmet veya malzeme girin.');
      const r = await api.post('/isler/ofis', { mesaj: v.mesaj, oncelik: Number(v.oncelik), cari_id: cari.id,
        satirlar: dolu.map((x) => ({ tip: x.tip, urun_id: x.urun_id, aciklama: x.aciklama, miktar: x.miktar || 1, birim_fiyat: x.birim_fiyat === '' ? null : x.birim_fiyat })) });
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
