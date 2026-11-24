import { api } from '../api.js';
import { html, $, $$, para, paraSade, miktar, tarih, bakiyeHucre, csvIndir, durumRozet, bugunStr } from '../ui.js';
import { tabloYazdir } from '../belgeler.js';

const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const ayAdi = (s) => { const [y, a] = String(s).split('-'); return `${AYLAR[Number(a) - 1]} ${y}`; };

// Her rapor: başlık, veri getirme ve sütunlar. sutun: {ad, al(satir), tur: 'para'|'sayi'|'bakiye'|'metin', toplam}
const RAPORLAR = {
  'cari-bakiye': {
    ad: 'Cari bakiyeler', filtre: ['tip'],
    getir: (f) => api.get('/rapor/cari-bakiye', { tip: f.tip }),
    git: (s) => `cari/${s.id}`,
    sutunlar: [
      { ad: 'Cari', al: (s) => s.unvan }, { ad: 'Telefon', al: (s) => s.telefon }, { ad: 'Bölge', al: (s) => [s.ilce, s.il].filter(Boolean).join(' / ') },
      { ad: 'Son tahsilat', al: (s) => tarih(s.son_tahsilat) }, { ad: 'Son hareket', al: (s) => tarih(s.son_hareket) },
      { ad: 'Bakiye', al: (s) => s.bakiye, tur: 'bakiye', toplam: true },
    ],
  },
  'vadesi-gecen': {
    ad: 'Vadesi geçen alacaklar',
    getir: () => api.get('/rapor/vadesi-gecen'),
    git: (s) => `cari/${s.cari_id}`,
    sutunlar: [{ ad: 'Cari', al: (s) => s.unvan }, { ad: 'Telefon', al: (s) => s.telefon }, { ad: 'En eski vade', al: (s) => tarih(s.en_eski_vade) },
      { ad: 'Gecikme (gün)', al: (s) => s.gecikme_gun, tur: 'sayi' }, { ad: 'Gecikmiş tutar', al: (s) => s.gecikmis_tutar, tur: 'para', toplam: true }],
  },
  yillik: {
    ad: 'Yıllık müşteri özeti', filtre: ['yil'],
    getir: (f) => api.get('/rapor/yillik', { yil: f.yil }),
    git: (s) => `cari/${s.cari_id}`,
    sutunlar: [{ ad: 'Cari', al: (s) => s.unvan }, { ad: 'İş', al: (s) => s.is_sayisi, tur: 'sayi', toplam: true }, { ad: 'Fiş', al: (s) => s.fis_sayisi, tur: 'sayi', toplam: true },
      { ad: 'Ciro (KDV hariç)', al: (s) => s.ciro_kdv_haric, tur: 'para', toplam: true }, { ad: 'Maliyet', al: (s) => s.maliyet, tur: 'para', toplam: true },
      { ad: 'Kâr', al: (s) => s.kar, tur: 'para', toplam: true }, { ad: 'Tahsilat', al: (s) => s.tahsilat, tur: 'para', toplam: true },
      { ad: 'Yıl sonu bakiye', al: (s) => s.yil_sonu_bakiye, tur: 'bakiye', toplam: true }],
  },
  'is-karlilik': {
    ad: 'İş kârlılığı', filtre: ['aralik'],
    getir: (f) => api.get('/rapor/is-karlilik', { bas: f.bas, bit: f.bit }),
    git: (s) => `is/${s.is_id}`,
    sutunlar: [{ ad: 'No', al: (s) => '#' + s.is_id }, { ad: 'İş', al: (s) => s.baslik }, { ad: 'Cari', al: (s) => s.unvan }, { ad: 'Ekip', al: (s) => s.ekip },
      { ad: 'Durum', al: (s) => s.durum, tur: 'durum' }, { ad: 'Bitiş', al: (s) => tarih(s.bitis_zamani || s.plan_baslangic) },
      { ad: 'Malzeme maliyeti', al: (s) => s.malzeme_maliyeti, tur: 'para', toplam: true }, { ad: 'Satış (KDV hariç)', al: (s) => s.satis_kdv_haric, tur: 'para', toplam: true },
      { ad: 'Kâr', al: (s) => (s.satis_kdv_haric != null ? s.kar : null), tur: 'para', toplam: true }, { ad: 'Kâr %', al: (s) => s.kar_orani, tur: 'sayi' }],
  },
  aylik: {
    ad: 'Aylık satış', filtre: ['yil'],
    getir: (f) => api.get('/rapor/aylik-satis', { yil: f.yil }),
    sutunlar: [{ ad: 'Ay', al: (s) => ayAdi(s.ay) }, { ad: 'Fiş', al: (s) => s.fis, tur: 'sayi', toplam: true }, { ad: 'Ciro (KDV hariç)', al: (s) => s.ciro, tur: 'para', toplam: true },
      { ad: 'Maliyet', al: (s) => s.maliyet, tur: 'para', toplam: true }, { ad: 'Kâr', al: (s) => s.kar, tur: 'para', toplam: true }, { ad: 'KDV dahil', al: (s) => s.kdv_dahil, tur: 'para', toplam: true }],
  },
  ekip: {
    ad: 'Ekip performansı', filtre: ['yil'],
    getir: (f) => api.get('/rapor/ekip-aylik', { yil: f.yil }),
    sutunlar: [{ ad: 'Ay', al: (s) => ayAdi(String(s.ay).slice(0, 7)) }, { ad: 'Ekip', al: (s) => s.ekip }, { ad: 'Tamamlanan iş', al: (s) => s.tamamlanan_is, tur: 'sayi', toplam: true },
      { ad: 'Ort. sahada süre (saat)', al: (s) => s.ort_sure_saat, tur: 'sayi' }, { ad: 'Ciro', al: (s) => s.ciro, tur: 'para', toplam: true }, { ad: 'Kâr', al: (s) => s.kar, tur: 'para', toplam: true }],
  },
  stok: {
    ad: 'Stok uyarıları',
    getir: () => api.get('/rapor/stok-uyari'),
    git: (s) => `urun/${s.id}`,
    sutunlar: [{ ad: 'Ürün', al: (s) => s.ad }, { ad: 'Kod', al: (s) => s.kod }, { ad: 'Uyarı', al: (s) => ({ eksi_stok: 'Eksi stok', onay_bekliyor: 'Maliyet onayı bekliyor', kritik: 'Kritik seviye' }[s.uyari]) },
      { ad: 'Stok', al: (s) => `${miktar(s.stok_miktari)} ${s.birim}` }, { ad: 'Kritik seviye', al: (s) => (s.kritik_stok != null ? miktar(s.kritik_stok) : '') }],
  },
};

function hucre(s, sut) {
  const v = sut.al(s);
  if (sut.tur === 'para') return v == null ? '' : para(v);
  if (sut.tur === 'bakiye') return bakiyeHucre(v);
  if (sut.tur === 'durum') return durumRozet(v);
  if (sut.tur === 'sayi') return v == null ? '' : String(v).replace('.', ',');
  return v ?? '';
}

export default async function (el, [secili], ctx) {
  ctx.baslik('Raporlar');
  const yil = new Date().getFullYear();
  // Muhasebe: kârlılık raporu ve maliyet / kâr sütunları gösterilmez
  const KARLI = /maliyet|kâr/i;
  const liste = Object.fromEntries(Object.entries(RAPORLAR).filter(([k]) => !(ctx.muhasebe && k === 'is-karlilik'))
    .map(([k, r]) => [k, ctx.muhasebe ? { ...r, sutunlar: r.sutunlar.filter((s) => !KARLI.test(s.ad)) } : r]));
  let ad = liste[secili] ? secili : 'cari-bakiye';
  const f = { tip: 'musteri', yil, bas: `${yil}-01-01`, bit: bugunStr() };
  el.innerHTML = String(html`<div class="sekmeler">${Object.entries(liste).map(([k, r]) => html`<button data-r="${k}">${r.ad}</button>`)}</div><div id="r"></div>`);

  async function ciz() {
    history.replaceState(null, '', `#/raporlar/${ad}`);
    $$('[data-r]', el).forEach((b) => b.classList.toggle('aktif', b.dataset.r === ad));
    const r = liste[ad];
    const k = $('#r', el);
    k.innerHTML = '<div class="yukleniyor"><span></span></div>';
    const veri = await r.getir(f);
    const toplamlar = r.sutunlar.map((s) => (s.toplam ? veri.reduce((a, x) => a + Number(s.al(x) || 0), 0) : null));
    k.innerHTML = String(html`<div class="filtre">
      ${r.filtre?.includes('tip') ? html`<select id="f-tip"><option value="musteri" ${f.tip === 'musteri' ? 'selected' : ''}>Müşteriler</option><option value="tedarikci" ${f.tip === 'tedarikci' ? 'selected' : ''}>Tedarikçiler</option><option value="" ${!f.tip ? 'selected' : ''}>Tümü</option></select>` : ''}
      ${r.filtre?.includes('yil') ? html`<select id="f-yil">${Array.from({ length: 6 }, (_, i) => yil - i).map((y) => html`<option ${y === Number(f.yil) ? 'selected' : ''}>${y}</option>`)}</select>` : ''}
      ${r.filtre?.includes('aralik') ? html`<label>Başlangıç <input type="date" id="f-bas" value="${f.bas}"></label><label>Bitiş <input type="date" id="f-bit" value="${f.bit}"></label>` : ''}
      <span class="bosluk"></span><button class="btn ikincil" id="yazdir">🖨 Yazdır</button><button class="btn ikincil" id="csv">Excel</button></div>
      <div class="kart"><div class="tablo-kap"><table class="tablo mobil-kart">
        <thead><tr>${r.sutunlar.map((s) => html`<th class="${s.tur && s.tur !== 'durum' ? 'sayi' : ''}">${s.ad}</th>`)}</tr></thead>
        <tbody>${veri.length ? veri.map((x) => html`<tr class="${r.git ? 'tikla' : ''}" ${r.git ? html`data-git="${r.git(x)}"` : ''}>
          ${r.sutunlar.map((s, i) => html`<td class="${s.tur && s.tur !== 'durum' ? 'sayi' : ''} ${i === 0 ? 'ana-hucre' : ''}" data-et="${i === 0 ? '' : s.ad}">${hucre(x, s)}</td>`)}</tr>`)
          : html`<tr><td colspan="${r.sutunlar.length}" class="bos-durum">Kayıt yok</td></tr>`}</tbody>
        ${veri.length && toplamlar.some((t) => t !== null) ? html`<tfoot><tr>${r.sutunlar.map((s, i) => html`<td class="${s.tur ? 'sayi' : ''}" data-et="${i === 0 ? '' : s.ad}">${i === 0 ? `Toplam (${veri.length})`
          : toplamlar[i] === null ? '' : s.tur === 'bakiye' ? bakiyeHucre(toplamlar[i]) : s.tur === 'para' ? para(toplamlar[i]) : toplamlar[i]}</td>`)}</tr></tfoot>` : ''}
      </table></div></div>`);
    const deg = (id, alan) => { const e = $(id, k); if (e) e.onchange = () => { f[alan] = e.value; ciz(); }; };
    deg('#f-tip', 'tip'); deg('#f-yil', 'yil'); deg('#f-bas', 'bas'); deg('#f-bit', 'bit');
    const ham = (x, s) => { const v = s.al(x); return s.tur === 'para' || s.tur === 'bakiye' || s.tur === 'sayi' ? (v == null ? '' : Number(v)) : v; };
    $('#csv', k).onclick = () => csvIndir(r.ad, r.sutunlar.map((s) => s.ad), veri.map((x) => r.sutunlar.map((s) => ham(x, s))));
    $('#yazdir', k).onclick = () => tabloYazdir(ctx, r.ad.toUpperCase(), r.filtre?.includes('yil') ? String(f.yil) : r.filtre?.includes('aralik') ? `${tarih(f.bas)} – ${tarih(f.bit)}` : '',
      r.sutunlar.map((s) => ({ ad: s.ad, sayi: !!s.tur && s.tur !== 'durum' })),
      veri.map((x) => r.sutunlar.map((s) => { const v = s.al(x); return s.tur === 'para' ? (v == null ? '' : paraSade(v)) : s.tur === 'bakiye' ? `${paraSade(Math.abs(v))} ${v > 0 ? 'B' : v < 0 ? 'A' : ''}` : v ?? ''; })),
      toplamlar.some((t) => t !== null) ? r.sutunlar.map((s, i) => (i === 0 ? 'Toplam' : toplamlar[i] === null ? '' : s.tur === 'para' || s.tur === 'bakiye' ? paraSade(toplamlar[i]) : toplamlar[i])) : null);
  }
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-r]'); if (b) { ad = b.dataset.r; return ciz(); }
    const g = e.target.closest('[data-git]'); if (g) ctx.git(g.dataset.git);
  });
  await ciz();
}
