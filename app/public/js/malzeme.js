// İşte kullanılan malzemeler: pencere açmadan ara-ekle, son kullanılanlar, − / + miktar, geri al, arka arkaya barkod.
// İş detayı (yönetici, telefon) ve saha ekranı (teknisyen) ortak kullanır.
import { api } from './api.js';
import { html, ham, $, bildir, miktar, saat, secici, vurgula, sor, sayiCoz, sayiGiris } from './ui.js';

const HIZLI = { metre: [5, 10, 20, 50], m: [5, 10, 20, 50], mt: [5, 10, 20, 50] };
const stokSinif = (u) => (u.tur === 'hizmet' || u.stok_miktari == null ? '' : Number(u.stok_miktari) <= 0 ? 'yok' : 'var');

export function malzemeBolumu(is, { duzenlenebilir, maliyet = false }) {
  return html`<div class="mz" data-mz>
    ${duzenlenebilir ? html`<div class="mz-ust">
        <input type="search" class="mz-ara" data-mz-ara placeholder="Malzeme ara: ad, kod, barkod…" enterkeyhint="search" autocomplete="off">
        <button type="button" class="btn ikincil mz-barkod" data-mz-barkod title="Arka arkaya barkod okut" aria-label="Barkod okut">📷</button>
      </div>
      <div class="mz-oneriler" data-mz-oneriler></div>` : ''}
    <div class="mz-liste" data-mz-liste>${malzemeSatirlari(is, { duzenlenebilir, maliyet })}</div>
    ${duzenlenebilir ? html`<div class="mz-alt"><button type="button" class="btn-metin" data-mz-tanimsiz>+ Listede olmayan ürün</button></div>` : ''}
  </div>`;
}

function malzemeSatirlari(is, { duzenlenebilir, maliyet }) {
  if (!is.malzemeler.length) return html`<div class="mz-bos">Henüz malzeme eklenmedi.</div>`;
  return html`${is.malzemeler.map((m) => {
    const hizli = HIZLI[String(m.birim || '').toLocaleLowerCase('tr')];
    return html`<div class="mz-satir" data-mz-id="${m.id}">
      <div class="mz-ad"><b>${m.ad}</b>${m.onay_bekliyor ? html` <span class="rozet turuncu">onay bekliyor</span>` : ''}
        <small>${m.barkodla_eklendi ? '📷 · ' : ''}${m.sahada_eklendi ? html`<span class="rozet turuncu malz-etiket">ilave</span>` : html`<span class="rozet mavi malz-etiket">verildi</span>`} · ${m.ekleyen || ''} · ${saat(m.zaman)}
          ${maliyet ? html` · maliyet ${m.birim_maliyet ? Number(m.tutar).toLocaleString('tr-TR', { minimumFractionDigits: 2 }) + ' ₺' : html`<b class="turuncu-yazi">girilmedi</b>`}` : ''}</small>
        ${duzenlenebilir && hizli ? html`<div class="mz-hizli">${hizli.map((n) => html`<button type="button" data-mz-ayarla="${n}" class="${Number(m.miktar) === n ? 'secili' : ''}">${n}</button>`)}</div>` : ''}
      </div>
      ${duzenlenebilir ? html`<div class="mz-miktar">
          <button type="button" data-mz-azalt aria-label="Azalt">${Number(m.miktar) <= 1 ? '🗑' : '−'}</button>
          <button type="button" class="mz-sayi" data-mz-yaz title="Miktarı yaz">${miktar(m.miktar)}<small>${m.birim}</small></button>
          <button type="button" data-mz-arttir aria-label="Arttır">+</button></div>`
        : html`<div class="mz-sayi salt">${miktar(m.miktar)} <small>${m.birim}</small></div>`}
    </div>`;
  })}`;
}

// duzenlenebilir bölüm için olayları bağlar. tanimsiz(): "Listede olmayan ürün" akışı (true dönerse yenilenir)
export function malzemeBagla(kok, is, ctx, { maliyet = false, tanimsiz } = {}) {
  const bolum = $('[data-mz]', kok);
  if (!bolum) return;
  const liste = $('[data-mz-liste]', bolum);
  const ara = $('[data-mz-ara]', bolum);
  let mesgul = false;

  async function yenile() {
    const y = await api.get(`/isler/${is.id}`);
    is.malzemeler = y.malzemeler;
    liste.innerHTML = String(malzemeSatirlari(is, { duzenlenebilir: true, maliyet }));
    const baslik = kok.querySelector('[data-mz-sayi]'); if (baslik) baslik.textContent = is.malzemeler.length || '';
  }

  // Ekle (aynı ürün varsa miktarı artar) + "Geri al"
  async function ekle(govde, ad) {
    const r = await api.post(`/isler/${is.id}/malzeme`, { ...govde, birlestir: true });
    await yenile();
    bildir(r.birlesti ? `${r.ad || ad} → ${miktar(r.miktar)} ${r.birim || ''}` : `${r.ad || ad} eklendi`, 'basari', 2500);
    return r;
  }

  if (ara) {
    secici(ara, {
      getir: (q) => api.get('/urunler', { q, limit: 30 }),
      goster: (u, q) => {
        const s = stokSinif(u);
        return html`<div class="secici-satir"><div class="ss-ana"><b>${ham(vurgula(u.ad, q))}</b>${u.onay_bekliyor ? html` <span class="rozet turuncu">onay bekliyor</span>` : ''}
          ${u.kod || u.marka ? html`<small>${ham([u.marka, u.kod].filter(Boolean).map((x) => vurgula(x, q)).join(' · '))}</small>` : ''}</div>
          ${s ? html`<div class="ss-deger"><span class="stok-rozet ${s}">${s === 'yok' ? 'stokta yok' : `${miktar(u.stok_miktari)} ${u.birim}`}</span></div>` : ''}</div>`;
      },
      sec: async (u) => {
        ara.value = '';
        try { await ekle({ urun_id: u.id }, u.ad); } catch (e) { bildir(e.message, 'hata'); }
      },
      sonKullanilan: 'urun',
      bosMetin: 'Eşleşen ürün yok — aşağıdan "Listede olmayan ürün" ile ekleyin',
    });
  }

  // Son kullanılanlar / bu müşteride kullanılanlar
  const oneriKap = $('[data-mz-oneriler]', bolum);
  if (oneriKap) {
    api.get(`/isler/${is.id}/malzeme-onerileri`).then((o) => {
      const cip = (u) => html`<button type="button" class="mz-cip ${stokSinif(u) === 'yok' ? 'stoksuz' : ''}" data-mz-oner="${u.id}" data-ad="${u.ad}" title="${stokSinif(u) === 'yok' ? 'Stokta yok' : ''}">+ ${u.ad}</button>`;
      const musteriIdler = new Set(o.musteri.map((u) => u.id));
      const son = o.son.filter((u) => !musteriIdler.has(u.id));
      if (!o.musteri.length && !son.length) return;
      oneriKap.innerHTML = String(html`
        ${o.musteri.length ? html`<div class="mz-oneri-grup"><small>Bu müşteride kullanılanlar</small><div class="mz-cipler">${o.musteri.map(cip)}</div></div>` : ''}
        ${son.length ? html`<div class="mz-oneri-grup"><small>Son kullandıklarınız</small><div class="mz-cipler">${son.map(cip)}</div></div>` : ''}`);
    }).catch(() => {});
  }

  bolum.addEventListener('click', async (e) => {
    if (mesgul) return;
    const t = e.target;
    const oner = t.closest('[data-mz-oner]');
    const satir = t.closest('[data-mz-id]');
    const m = satir ? is.malzemeler.find((x) => String(x.id) === satir.dataset.mzId) : null;
    try {
      mesgul = true;
      if (oner) { await ekle({ urun_id: Number(oner.dataset.mzOner) }, oner.dataset.ad); return; }
      if (t.closest('[data-mz-barkod]')) { await surekliBarkod(); return; }
      if (t.closest("[data-mz-tanimsiz]") && tanimsiz) { if (await tanimsiz()) await yenile(); return; }
      if (!m) return;
      const mevcut = Number(m.miktar);
      let yeni = null;
      if (t.closest('[data-mz-arttir]')) yeni = mevcut + 1;
      else if (t.closest('[data-mz-azalt]')) yeni = mevcut - 1;
      else if (t.closest('[data-mz-ayarla]')) yeni = Number(t.closest('[data-mz-ayarla]').dataset.mzAyarla);
      else if (t.closest('[data-mz-yaz]')) {
        const v = await sor(m.ad, `Miktar (${m.birim})`, { deger: sayiGiris(mevcut) });
        if (v === null) return;
        yeni = sayiCoz(v);
        if (yeni == null || yeni < 0) { bildir('Geçerli bir miktar girin.', 'hata'); return; }
      }
      if (yeni == null || yeni === mevcut) return;
      await api.put(`/malzeme/${m.id}`, { miktar: Math.max(0, yeni) });
      await yenile();
      // Yalnız çıkarılan malzeme geri alınabilir (yanlışlıkla silmeye karşı)
      if (yeni <= 0) {
        bildir(`${m.ad} çıkarıldı`, 'bilgi', 5000, {
          eylem: { metin: 'Geri al', fn: async () => {
            try { await api.post(`/isler/${is.id}/malzeme`, { urun_id: m.urun_id, miktar: mevcut }); await yenile(); bildir('Geri alındı.'); } catch (err) { bildir(err.message, 'hata'); }
          } },
        });
      }
    } catch (err) { bildir(err.message, 'hata'); } finally { mesgul = false; }
  });

  // Kamera açık kalır; okutulan her ürün eklenir, aynısı tekrar okutulunca miktar artar
  async function surekliBarkod() {
    const { barkodOku } = await import('./barkod.js');
    const bilinmeyen = new Set();
    await barkodOku({
      baslik: 'Barkod okutun (arka arkaya)',
      surekli: async (barkod) => {
        try {
          const r = await api.post(`/isler/${is.id}/malzeme`, { barkod, miktar: 1, birlestir: true });
          return `✓ ${r.ad}${r.birlesti ? ` × ${miktar(r.miktar)}` : ''}`;
        } catch (e) {
          if (e.kod === 'BARKOD_TANIMSIZ') { bilinmeyen.add(barkod); throw new Error(`${barkod}: sistemde yok — "Bitti" deyince tanımlarsınız`); }
          throw e;
        }
      },
    });
    await yenile();
    // Sistemde olmayan barkodlar: her biri için "listede olmayan ürün" formu (barkod dolu)
    for (const barkod of bilinmeyen) {
      if (!tanimsiz) break;
      bildir(`${barkod} sistemde yok. Ürünü tanımlayın.`, 'uyari');
      if (await tanimsiz({ barkod })) await yenile();
    }
  }
  void ctx;
}
