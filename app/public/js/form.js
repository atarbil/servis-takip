// Form tasarımı çizim motoru: belge türü + şablon ayarı + veri → yazdırılabilir HTML.
// Hem yazdırma hem tasarım ekranındaki önizleme bu dosyayı kullanır (ekranda ne görünürse kâğıtta o).
import { html, ham, esc, dovizPara, miktar, tarih, zaman } from './ui.js';
import { qrSvg } from './qr.js';

export const TURLER = [
  { tur: 'teklif', ad: 'Teklif' }, { tur: 'proforma', ad: 'Proforma' }, { tur: 'satis_fisi', ad: 'Satış fişi' },
  { tur: 'makbuz', ad: 'Tahsilat makbuzu' }, { tur: 'teslim', ad: 'Servis teslim formu' },
  { tur: 'dis_servis', ad: 'Dış servis fişi' }, { tur: 'ekstre', ad: 'Cari ekstre' },
];
export const TUR_AD = Object.fromEntries(TURLER.map((t) => [t.tur, t.ad]));
const KALEMLI = new Set(['teklif', 'proforma', 'satis_fisi']);
export const kalemliMi = (tur) => KALEMLI.has(tur);

// ---------- Bölümler ----------
export const BOLUM_AD = {
  ust: 'Üst bilgi (logo + firma)', baslik: 'Belge başlığı', musteri: 'Müşteri ve belge bilgileri', giris: 'Giriş metni',
  kalemler: 'Kalem tablosu', toplam: 'Dip toplam', yazi: 'Yazıyla tutar', govde: 'Belge içeriği', malzeme: 'Malzeme listesi',
  notlar: 'Notlar / şartlar', banka: 'Banka bilgileri', qr: 'QR kod', imza: 'Kaşe ve imza', alt: 'Alt bilgi',
};
const BOLUMLER = {
  kalemli: ['ust', 'baslik', 'musteri', 'giris', 'kalemler', 'toplam', 'yazi', 'notlar', 'banka', 'qr', 'imza', 'alt'],
  makbuz: ['ust', 'baslik', 'musteri', 'giris', 'govde', 'yazi', 'notlar', 'banka', 'imza', 'alt'],
  teslim: ['ust', 'baslik', 'musteri', 'govde', 'malzeme', 'notlar', 'imza', 'alt'],
  dis_servis: ['ust', 'baslik', 'musteri', 'govde', 'notlar', 'imza', 'alt'],
  ekstre: ['ust', 'baslik', 'musteri', 'govde', 'yazi', 'notlar', 'banka', 'alt'],
};
const bolumListesi = (tur) => BOLUMLER[kalemliMi(tur) ? 'kalemli' : tur];

// ---------- Kalem tablosu sütunları ----------
export const KOLON_AD = {
  no: 'Sıra no', resim: 'Ürün resmi', kod: 'Ürün kodu', barkod: 'Barkod', raf: 'Raf yeri', aciklama: 'Açıklama',
  miktar: 'Miktar', liste_fiyati: 'Liste fiyatı', birim_fiyat: 'Birim fiyat (KDV hariç)', birim_fiyat_kdvli: 'Birim fiyat (KDV dahil)',
  iskonto: 'İndirim oranı', kdv_orani: 'KDV oranı', tutar: 'Tutar (KDV hariç)', tutar_kdvli: 'Tutar (KDV dahil)',
};
const KOLON_SIRA = ['no', 'resim', 'kod', 'barkod', 'raf', 'aciklama', 'miktar', 'liste_fiyati', 'birim_fiyat', 'birim_fiyat_kdvli', 'iskonto', 'kdv_orani', 'tutar', 'tutar_kdvli'];
const SAYI_KOLON = new Set(['miktar', 'liste_fiyati', 'birim_fiyat', 'birim_fiyat_kdvli', 'iskonto', 'kdv_orani', 'tutar', 'tutar_kdvli']);

// ---------- Genel alanlar (göster / gizle) ----------
export const ALAN_AD = {
  logo: 'Logo', firma_ad: 'Firma adı', firma_bilgi: 'Firma adres / iletişim / vergi', musteri_adres: 'Müşteri adresi',
  musteri_tel: 'Müşteri telefonu', musteri_vergi: 'Müşteri vergi bilgisi', belge_no: 'Belge numarası', tarih: 'Tarih',
  vade: 'Vade tarihi', gecerlilik: 'Geçerlilik tarihi', bakiye: 'Güncel cari bakiye', satir_notu: 'Satır notları (seri no, garanti…)',
  aciklama: 'Açıklama (belgedeki açıklama alanı)', kase: 'Kaşe / imza görseli', imza_kutulari: 'Teslim eden / alan kutuları',
  filigran: 'Filigran (TASLAK / İPTAL)', sayfa_no: 'Sayfa numarası', kesme: 'İki nüsha arasında kesme çizgisi',
};
const ALANLAR_TUR = {
  kalemli: ['logo', 'firma_ad', 'firma_bilgi', 'musteri_adres', 'musteri_tel', 'musteri_vergi', 'belge_no', 'tarih', 'vade', 'gecerlilik', 'bakiye', 'satir_notu', 'aciklama', 'kase', 'imza_kutulari', 'filigran', 'sayfa_no'],
  makbuz: ['logo', 'firma_ad', 'firma_bilgi', 'musteri_adres', 'musteri_vergi', 'belge_no', 'tarih', 'bakiye', 'kase', 'imza_kutulari', 'kesme'],
  teslim: ['logo', 'firma_ad', 'firma_bilgi', 'musteri_adres', 'musteri_tel', 'belge_no', 'tarih', 'imza_kutulari'],
  dis_servis: ['logo', 'firma_ad', 'firma_bilgi', 'musteri_tel', 'belge_no', 'tarih', 'imza_kutulari', 'kesme'],
  ekstre: ['logo', 'firma_ad', 'firma_bilgi', 'musteri_adres', 'tarih', 'sayfa_no'],
};
export const alanlarTur = (tur) => ALANLAR_TUR[kalemliMi(tur) ? 'kalemli' : tur];
export const TOPLAM_AD = { brut: 'Brüt', indirim: 'İndirim', net: 'Net (KDV hariç)', kdv: 'KDV', toplam: 'Genel toplam', tl_karsilik: 'TL karşılığı (dövizli belgede)' };

export const TEMALAR = {
  klasik: { ad: 'Klasik', aciklama: 'Bugünkü düzen: siyah çizgiler, ortada başlık' },
  modern: { ad: 'Modern', aciklama: 'Renkli üst şerit, renkli tablo başlığı' },
  sade: { ad: 'Sade', aciklama: 'Çizgisiz, bol boşluk, ince ayraçlar' },
  kurumsal: { ad: 'Kurumsal', aciklama: 'İki sütun firma / müşteri kutusu, gri tablo' },
};
export const YAZI_TIPLERI = ['Arial', 'Helvetica', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Georgia', 'Times New Roman', 'Courier New'];
export const KAGITLAR = { A4: 'A4 dikey', A4Y: 'A4 yatay', A5: 'A5 dikey' };

// ---------- Dil ----------
const DIL = {
  tr: { tarih: 'Tarih', no: 'No', vade: 'Vade', gecerlilik: 'Geçerlilik', sayin: 'Sayın', aciklama: 'Açıklama', miktar: 'Miktar',
    liste_fiyati: 'Liste fiyatı', birim_fiyat: 'Fiyat', birim_fiyat_kdvli: 'Fiyat (KDV dahil)', iskonto: 'İsk.', kdv_orani: 'KDV (%)',
    tutar: 'Tutar (KDV Hariç)', tutar_kdvli: 'Tutar (KDV Dahil)', no_k: '#', resim: 'Resim', kod: 'Kod', barkod: 'Barkod', raf: 'Raf',
    brut: 'Brüt', indirim: 'İndirim', net: 'Net', kdv: 'KDV', toplam: 'Toplam', tl_karsilik: 'TL karşılığı', yalniz: 'Yalnız',
    bakiye: 'Cari bakiye', borc: 'Borç', alacak: 'Alacak', teslim_eden: 'Teslim eden', teslim_alan: 'Teslim alan', odeme_yapan: 'Ödeme yapan',
    tahsil_eden: 'Tahsil eden', sayfa: 'Sayfa', vn: 'VN', vd: 'VD', tel: 'Tel', taslak: 'TASLAK', iptal: 'İPTAL',
    odeme_sekli: 'Ödeme şekli', belge_dekont: 'Belge / dekont no', cihaz: 'Cihaz', seri_no: 'Seri no', ariza: 'Arıza / şikâyet',
    aksesuar: 'Yanında teslim alınanlar', yapilan_is: 'Yapılan iş', ekip: 'Ekip', sure: 'Süre', teknisyen_notu: 'Teknisyen notu',
    malzemeler: 'Kullanılan / teslim edilen malzemeler', urun: 'Ürün', belge: 'Belge', donem: 'Dönem', musteri: 'Müşteri', adres: 'Adres', telefon: 'Telefon',
    odeme_kasa: 'Nakit', odeme_banka: 'Havale / EFT', odeme_pos: 'Kredi kartı', asil: 'ASIL', suret: 'SURET', musteri_nushasi: 'MÜŞTERİ NÜSHASI',
    firma_nushasi: 'FİRMA NÜSHASI', belge_dogrulama: 'Belge doğrulama', musteri_notu: 'Müşteri notu', makbuz_bakiye: 'Tahsilat sonrası cari bakiyeniz',
    makbuz_borc: '(Borç)', makbuz_alacak: '(Alacak)', bakiye_b: '(B)', bakiye_a: '(A)',
    ekstre_borclu: 'Bakiye: {tutar} tarafınızca firmamıza borçlu görünmektedir.', ekstre_alacakli: 'Bakiye: {tutar} firmamızca tarafınıza borçlu görünmektedir.',
    ekstre_sifir: 'Hesap bakiyesi sıfırdır.' },
  en: { tarih: 'Date', no: 'No', vade: 'Due date', gecerlilik: 'Valid until', sayin: 'To', aciklama: 'Description', miktar: 'Qty',
    liste_fiyati: 'List price', birim_fiyat: 'Unit price', birim_fiyat_kdvli: 'Unit price (incl. VAT)', iskonto: 'Disc.', kdv_orani: 'VAT (%)',
    tutar: 'Amount (excl. VAT)', tutar_kdvli: 'Amount (incl. VAT)', no_k: '#', resim: 'Image', kod: 'Code', barkod: 'Barcode', raf: 'Shelf',
    brut: 'Gross', indirim: 'Discount', net: 'Net', kdv: 'VAT', toplam: 'Total', tl_karsilik: 'TRY equivalent', yalniz: 'Amount in words',
    bakiye: 'Account balance', borc: 'Debit', alacak: 'Credit', teslim_eden: 'Delivered by', teslim_alan: 'Received by', odeme_yapan: 'Paid by',
    tahsil_eden: 'Received by', sayfa: 'Page', vn: 'Tax no', vd: 'Tax office', tel: 'Tel', taslak: 'DRAFT', iptal: 'CANCELLED',
    odeme_sekli: 'Payment method', belge_dekont: 'Reference', cihaz: 'Device', seri_no: 'Serial no', ariza: 'Fault / complaint',
    aksesuar: 'Accessories received', yapilan_is: 'Work done', ekip: 'Team', sure: 'Duration', teknisyen_notu: 'Technician note',
    malzemeler: 'Materials used / delivered', urun: 'Item', belge: 'Document', donem: 'Period', musteri: 'Customer', adres: 'Address', telefon: 'Phone',
    odeme_kasa: 'Cash', odeme_banka: 'Bank transfer', odeme_pos: 'Credit card', asil: 'ORIGINAL', suret: 'COPY', musteri_nushasi: 'CUSTOMER COPY',
    firma_nushasi: 'COMPANY COPY', belge_dogrulama: 'Document verification', musteri_notu: 'Customer note', makbuz_bakiye: 'Your balance after this payment',
    makbuz_borc: '(Debit)', makbuz_alacak: '(Credit)', bakiye_b: '(D)', bakiye_a: '(C)',
    ekstre_borclu: 'Balance: {tutar} is owed by you to our company.', ekstre_alacakli: 'Balance: {tutar} is owed by our company to you.',
    ekstre_sifir: 'The account balance is zero.' },
};
const BASLIK_VARSAYILAN = {
  tr: { teklif: 'TEKLİF FORMU', proforma: 'PROFORMA FATURA', satis_fisi: 'SATIŞ FİŞİ', makbuz: 'TAHSİLAT MAKBUZU', teslim: 'SERVİS TESLİM FORMU', dis_servis: 'CİHAZ TESLİM ALINDI', ekstre: 'CARİ HESAP EKSTRESİ' },
  en: { teklif: 'QUOTATION', proforma: 'PROFORMA INVOICE', satis_fisi: 'SALES SLIP', makbuz: 'PAYMENT RECEIPT', teslim: 'SERVICE DELIVERY FORM', dis_servis: 'DEVICE RECEIVED', ekstre: 'ACCOUNT STATEMENT' },
};

// ---------- Değiştirilebilir sabit yazılar (türe göre) ----------
const ETIKET_ORTAK = ['sayin', 'tarih', 'no', 'tel', 'vd', 'vn'];
const ETIKETLER = {
  kalemli: [...ETIKET_ORTAK, 'vade', 'gecerlilik', 'bakiye', 'bakiye_b', 'bakiye_a', 'brut', 'indirim', 'net', 'kdv', 'toplam', 'tl_karsilik', 'yalniz',
    'teslim_eden', 'teslim_alan', 'belge_dogrulama', 'taslak', 'iptal', 'sayfa'],
  makbuz: [...ETIKET_ORTAK, 'odeme_sekli', 'aciklama', 'belge_dekont', 'toplam', 'odeme_kasa', 'odeme_banka', 'odeme_pos', 'yalniz', 'makbuz_bakiye',
    'makbuz_borc', 'makbuz_alacak', 'odeme_yapan', 'tahsil_eden', 'asil', 'suret'],
  teslim: [...ETIKET_ORTAK, 'yapilan_is', 'teknisyen_notu', 'ekip', 'sure', 'malzemeler', 'urun', 'miktar', 'musteri_notu', 'teslim_eden', 'teslim_alan'],
  dis_servis: [...ETIKET_ORTAK, 'cihaz', 'seri_no', 'ariza', 'aksesuar', 'teslim_eden', 'teslim_alan', 'musteri_nushasi', 'firma_nushasi'],
  ekstre: [...ETIKET_ORTAK, 'donem', 'belge', 'aciklama', 'vade', 'borc', 'alacak', 'bakiye', 'toplam', 'ekstre_borclu', 'ekstre_alacakli', 'ekstre_sifir', 'sayfa'],
};
export const etiketlerTur = (tur) => ETIKETLER[kalemliMi(tur) ? 'kalemli' : tur];
export const etiketVarsayilan = (dil, k) => (DIL[dil] || DIL.tr)[k] ?? DIL.tr[k] ?? k;
export const baslikVarsayilan = (tur, dil) => BASLIK_VARSAYILAN[dil]?.[tur] || BASLIK_VARSAYILAN.tr[tur];

// ---------- Varsayılan ayar ----------
export function varsayilanAyar(tur, tema = 'klasik') {
  const alan = Object.fromEntries(alanlarTur(tur).map((a) => [a, !['vade', 'bakiye', 'filigran', 'sayfa_no'].includes(a)]));
  if (tur === 'satis_fisi') { alan.vade = true; alan.musteri_tel = true; alan.gecerlilik = false; }
  if (tur === 'teklif') alan.gecerlilik = true;
  if (tur === 'proforma') { alan.gecerlilik = false; alan.musteri_adres = false; }
  if (tur === 'makbuz') alan.bakiye = true;
  if (kalemliMi(tur)) { alan.filigran = true; alan.imza_kutulari = tur === 'satis_fisi'; }
  if (tur === 'ekstre') alan.sayfa_no = true;
  const kolonGorunur = new Set(['no', 'aciklama', 'miktar', 'birim_fiyat', 'iskonto', 'kdv_orani', 'tutar']);
  const a = {
    surum: 1, tema, dil: 'tr', baslik: '', kagit: tur === 'makbuz' || tur === 'dis_servis' ? 'A4' : 'A4',
    nusha: tur === 'dis_servis' ? 2 : 1,
    renk: { klasik: '#111827', modern: '#1d4ed8', sade: '#334155', kurumsal: '#0f766e' }[tema] || '#111827',
    yazi_tipi: 'Arial', yazi_boyu: 12.5, kenar: 12,
    logo: { goster: true, hiza: tema === 'modern' ? 'sol' : 'sol', genislik: 220, dosya: null },
    serit: { kaynak: tur === 'teklif' && tema === 'klasik' ? 'firma' : 'yok', dosya: null }, // firma: Ayarlar'daki teklif şeridi; ozel: şablona yüklenen
    bolumler: bolumListesi(tur).map((id) => ({ id, goster: !['banka', 'qr'].includes(id) && !(id === 'giris' && tur === 'proforma') && !(id === 'yazi' && tur === 'proforma') && !(id === 'malzeme' && tur === 'teslim') })),
    alan,
    kolonlar: KOLON_SIRA.map((id) => ({ id, goster: kolonGorunur.has(id), ad: '' })),
    toplam: { brut: false, indirim: false, net: true, kdv: true, toplam: true, tl_karsilik: true },
    metin: { firma_ad: null, firma_bilgi: null, giris: null, notlar: null, banka: '', alt: null },
    qr: { icerik: 'belge', metin: '' },
    etiket: {},
  };
  if (tur === 'teklif') a.bolumler.find((b) => b.id === 'yazi').goster = false;
  return a;
}

// Kayıtlı ayarı varsayılanla birleştir (yeni eklenen ayarlar eski şablonlarda da olsun)
export function ayarTamamla(tur, kayitli) {
  const v = varsayilanAyar(tur, kayitli?.tema || 'klasik');
  if (!kayitli || !Object.keys(kayitli).length) return v;
  const a = { ...v, ...kayitli };
  for (const k of ['logo', 'serit', 'alan', 'toplam', 'metin', 'qr', 'etiket']) a[k] = { ...v[k], ...(kayitli[k] || {}) };
  const bilinen = new Set(v.bolumler.map((b) => b.id));
  a.bolumler = (kayitli.bolumler || []).filter((b) => bilinen.has(b.id));
  for (const b of v.bolumler) if (!a.bolumler.some((x) => x.id === b.id)) a.bolumler.push(b);
  a.kolonlar = (kayitli.kolonlar || []).filter((k) => KOLON_SIRA.includes(k.id));
  for (const k of v.kolonlar) if (!a.kolonlar.some((x) => x.id === k.id)) a.kolonlar.push(k);
  return a;
}

// ---------- Güvenli metin (zengin metin bloklarında yalnız biçim etiketleri) ----------
const IZINLI = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'BR', 'DIV', 'P', 'SPAN', 'FONT', 'UL', 'OL', 'LI']);
const IZINLI_STIL = new Set(['text-align', 'font-size', 'font-weight', 'font-style', 'text-decoration', 'color']);
export function temizHtml(s) {
  if (!s) return '';
  const d = new DOMParser().parseFromString(`<div>${s}</div>`, 'text/html');
  const gez = (el) => {
    for (const c of [...el.childNodes]) {
      if (c.nodeType === 3) continue;
      if (c.nodeType !== 1 || !IZINLI.has(c.tagName)) { if (c.nodeType === 1 && !['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT'].includes(c.tagName)) { gez(c); c.replaceWith(...c.childNodes); } else c.remove(); continue; }
      for (const at of [...c.attributes]) {
        if (at.name === 'style') {
          const st = [...c.style].filter((p) => IZINLI_STIL.has(p)).map((p) => `${p}:${c.style.getPropertyValue(p)}`).join(';');
          if (st && !/url\(|expression/i.test(st)) c.setAttribute('style', st); else c.removeAttribute('style');
        } else if (!(c.tagName === 'FONT' && (at.name === 'size' || at.name === 'color'))) c.removeAttribute(at.name);
      }
      gez(c);
    }
  };
  const kok = d.body.firstElementChild; gez(kok);
  return kok.innerHTML;
}

// ---------- Veri hazırlama: her belge türünü ortak biçime çevir ----------
export function veriHazirla(tur, h) {
  if (!h) return null;
  const musteri = (unvan, x) => ({ unvan, adres: x.cari_adres || x.adres || '', ilce: x.ilce || x.cari_ilce || '', il: x.il || x.cari_il || '',
    telefon: x.cari_telefon || x.telefon || '', vergi_dairesi: x.vergi_dairesi || '', vergi_no: x.vergi_no || '' });
  if (kalemliMi(tur)) {
    const satis = tur === 'satis_fisi';
    return { tur, belge_no: satis ? h.fis_no : h.belge_no, tarih: h.tarih, vade: h.vade, gecerlilik: h.gecerlilik,
      musteri: musteri(h.unvan, h), satirlar: h.satirlar || [], ara_toplam: Number(h.ara_toplam), kdv_toplam: Number(h.kdv_toplam),
      genel_toplam: Number(h.genel_toplam), doviz: h.doviz || 'TRY', kur: h.kur, tl_karsilik_goster: h.tl_karsilik_goster !== false,
      giris: h.giris_metni || '', aciklama: satis ? h.aciklama || '' : h.kapanis_metni || '',
      bakiye: h.cari_bakiye, durum: h.durum, kase: h.kase_imza };
  }
  if (tur === 'makbuz') return { tur, belge_no: `TM-${String(h.id).padStart(6, '0')}`, tarih: h.tarih, musteri: musteri(h.unvan, h), ham: h,
    genel_toplam: Number(h.tutar), bakiye: h.kalan_bakiye, doviz: 'TRY' };
  if (tur === 'teslim') return { tur, belge_no: String(h.id), tarih: h.teslim?.zaman || h.bitis_zamani || new Date().toISOString(),
    musteri: { unvan: h.cari_unvan || h.iletisim_ad || '', adres: h.adres || h.cari_adres || '', telefon: h.cari_telefon || h.iletisim_tel || '' }, ham: h };
  if (tur === 'dis_servis') return { tur, belge_no: `DS-${String(h.id).padStart(6, '0')}`, tarih: h.olusturma, musteri: musteri(h.unvan, h), ham: h };
  if (tur === 'ekstre') return { tur, belge_no: '', tarih: new Date().toISOString(), musteri: musteri(h.cari.unvan, h.cari), ham: h };
  return null;
}

// Tasarım ekranındaki örnek veriler
export function ornekVeri(tur) {
  const satirlar = [
    { aciklama: 'DONMAZ MARKA 500 ml ANTİFİRİZLİ CAM SUYU', notu: 'Ürün kartındaki ilave açıklama bilgisi buraya gelir.', miktar: 10, birim: 'adet', birim_fiyat: 30, iskonto_orani: 10, kdv_orani: 20, tutar: 270, urun_kod: 'CS-500', barkod: '8620719109792', raf_yeri: 'A-3', liste_fiyati: 35 },
    { aciklama: '6" SİLİKON CEP TELEFONU KILIFI', notu: 'Seri no: SK-2291 · 2 yıl garanti', miktar: 10, birim: 'adet', birim_fiyat: 10, iskonto_orani: 20, kdv_orani: 20, tutar: 80, urun_kod: 'KLF-6', barkod: '8630719109726', raf_yeri: 'B-1', liste_fiyati: 12.5 },
    { aciklama: 'IP Kamera montaj işçiliği', miktar: 2, birim: 'saat', birim_fiyat: 750, iskonto_orani: 0, kdv_orani: 20, tutar: 1500, urun_kod: 'ISC', liste_fiyati: 750 },
  ];
  const ara = 1850; const kdv = 370;
  const m = { unvan: 'Örnek Ticaret Ltd. Şti.', adres: 'Örnek Mah. Örnek Sok. No:5', ilce: 'Ataşehir', il: 'İSTANBUL', telefon: '0532 111 22 33', vergi_dairesi: 'Ataşehir', vergi_no: '1234567890' };
  const bugun = new Date().toISOString().slice(0, 10);
  const sonra = new Date(Date.now() + 15 * 864e5).toISOString().slice(0, 10);
  if (kalemliMi(tur)) return { tur, belge_no: { teklif: 'TK-2026-0001', proforma: 'PF-2026-0001', satis_fisi: 'SF-2026-000123' }[tur], tarih: bugun, vade: sonra, gecerlilik: sonra,
    musteri: m, satirlar, ara_toplam: ara, kdv_toplam: kdv, genel_toplam: ara + kdv, doviz: 'TRY', giris: 'Talebiniz doğrultusunda hazırladığımız fiyat teklifimiz aşağıda bilgilerinize sunulmuştur.',
    aciklama: 'Fiyatlarımıza KDV dahil değildir. Teslim süresi siparişten itibaren 3 iş günüdür.', bakiye: 4250, durum: 'onaylandi', ornek: true };
  if (tur === 'makbuz') return { tur, belge_no: 'TM-000042', tarih: bugun, musteri: m, genel_toplam: 12500, bakiye: 3250, doviz: 'TRY', ornek: true,
    ham: { hesap_tip: 'banka', hesap_ad: 'Ziraat Bankası', aciklama: 'Ekim ayı servis bedeli', belge_no: 'D-4471', tutar: 12500 } };
  if (tur === 'teslim') return { tur, belge_no: '128', tarih: new Date().toISOString(), musteri: m, ornek: true,
    ham: { baslik: '4 kamera montajı ve NVR kurulumu', aciklama: 'Depo ve giriş kapısına kamera', teknisyen_notu: 'Kablolar kanal içine alındı.', ekip_ad: '1. Ekip',
      baslama_zamani: new Date(Date.now() - 3 * 36e5).toISOString(), bitis_zamani: new Date().toISOString(),
      malzemeler: [{ ad: 'IP Kamera 4MP', miktar: 4, birim: 'adet' }, { ad: 'CAT6 Kablo', miktar: 80, birim: 'metre' }],
      teslim: { teknisyen: 'Ali Usta', teslim_alan_ad: 'Ahmet Yılmaz', teslim_alan_tel: '0532 111 22 33', imza_dosya: null } } };
  if (tur === 'dis_servis') return { tur, belge_no: 'DS-000017', tarih: new Date().toISOString(), musteri: m, ornek: true,
    ham: { cihaz: 'Dizüstü bilgisayar', marka_model: 'Lenovo IdeaPad 5', seri_no: 'PF3K2L9X', ariza: 'Açılmıyor, şarj ışığı yanıp sönüyor', aksesuar: 'Şarj aleti, çanta' } };
  if (tur === 'ekstre') return { tur, belge_no: '', tarih: new Date().toISOString(), musteri: m, ornek: true,
    ham: { bas: `${bugun.slice(0, 8)}01`, bit: bugun, cari: m, satirlar: [
      { tarih: bugun, belge_tip: 'satis_fisi', belge_no: 'SF-2026-000120', aciklama: 'Kamera montajı', borc: 12500, alacak: 0, bakiye: 12500 },
      { tarih: bugun, belge_tip: 'tahsilat', belge_no: 'D-4471', aciklama: 'Havale', borc: 0, alacak: 8250, bakiye: 4250 }] } };
  return null;
}

// ---------- Yardımcılar ----------
const BIRIM_KISA = { adet: 'ad', metre: 'm', paket: 'pk', kutu: 'kt', takım: 'tk', saat: 'sa' };
const miktarBirim = (m, b) => `${miktar(m)} ${BIRIM_KISA[b] || b || ''}`.trim();
const BELGE = { devir: 'Devir', satis_fisi: 'Satış fişi', alis_faturasi: 'Alış faturası', tahsilat: 'Tahsilat', odeme: 'Ödeme', duzeltme: 'Düzeltme' };

export function tutarYaziyla(tutar) {
  const BIR = ['', 'Bir', 'İki', 'Üç', 'Dört', 'Beş', 'Altı', 'Yedi', 'Sekiz', 'Dokuz'];
  const ON = ['', 'On', 'Yirmi', 'Otuz', 'Kırk', 'Elli', 'Altmış', 'Yetmiş', 'Seksen', 'Doksan'];
  const BASAMAK = ['', 'Bin', 'Milyon', 'Milyar', 'Trilyon'];
  const uclu = (n) => {
    const y = Math.floor(n / 100); const o = Math.floor((n % 100) / 10); const b = n % 10;
    return [y ? (y === 1 ? 'Yüz' : `${BIR[y]} Yüz`) : '', ON[o], BIR[b]].filter(Boolean).join(' ');
  };
  const yaz = (n) => {
    if (n === 0) return 'Sıfır';
    const parca = [];
    for (let i = 0; n > 0; i++, n = Math.floor(n / 1000)) {
      const g = n % 1000; if (!g) continue;
      parca.unshift(i === 1 && g === 1 ? 'Bin' : [uclu(g), BASAMAK[i]].filter(Boolean).join(' '));
    }
    return parca.join(' ');
  };
  const kurus = Math.round(Math.abs(Number(tutar)) * 100);
  const tl = Math.floor(kurus / 100); const kr = kurus % 100;
  return `${yaz(tl)} Türk Lirası${kr ? ` ${yaz(kr)} Kuruş` : ''}`;
}

function firmaBilgiOtomatik(a) {
  const vd = a.firma_vergi_dairesi || ''; const vn = a.firma_vergi_no || '';
  const iletisim = [a.firma_eposta && `E-Posta : ${a.firma_eposta}`, a.firma_telefon && `Tel: ${a.firma_telefon}`, a.firma_gsm && `Gsm: ${a.firma_gsm}`, a.firma_web && `Web: ${a.firma_web}`].filter(Boolean);
  return [a.firma_adres ? `Adres: ${esc(a.firma_adres)}` : '', iletisim.map(esc).join('&nbsp;&nbsp;&nbsp;'),
    vd || vn ? `Vergi Dairesi : ${esc(vd)}&nbsp;&nbsp;&nbsp;&nbsp;Vergi No : ${esc(vn)}` : a.firma_vergi ? esc(a.firma_vergi) : ''].filter(Boolean).join('<br>');
}
const VARSAYILAN_METIN = {
  satis_fisi: { alt: 'Bu belge mali değeri olan bir fatura değildir; bilgi amaçlı satış fişidir.' },
  makbuz: { giris: 'Aşağıda belirtilen tutar tarafınızdan tahsil edilmiştir.' },
  dis_servis: { notlar: 'Yukarıda bilgileri yazılı cihaz onarım için teslim alınmıştır. Cihaz gerekirse yetkili / dış servise gönderilebilir. Teslim alırken bu fişin ibrazı rica olunur.' },
  ekstre: { notlar: 'B: Borç bakiye, A: Alacak bakiye. Mutabakat için lütfen ekstreyi kontrol ederek bize bildiriniz.' },
  teklif: { notlar: 'Saygılarımızla,' },
};

// ---------- Çizim ----------
// secenek: { duzenle: true → metin blokları düzenlenebilir, boş bloklar kesik çizgili; kase: bool (yazdırma penceresinden) ; nusha: 1|2 }
export function belgeHtml(ctx, tur, ayarHam, v, secenek = {}) {
  const a = ayarTamamla(tur, ayarHam);
  const temel = DIL[a.dil] || DIL.tr;
  const ozel = a.etiket || {};
  // Sabit yazılar: şablonda değiştirildiyse o, değilse dile göre varsayılan
  const dget = (k) => (typeof ozel[k] === 'string' && ozel[k].trim() ? doldurDuz(ozel[k]) : temel[k] ?? DIL.tr[k] ?? k);
  // Tasarım modunda önizlemede tıklanıp yazılabilir
  const E = (k, ek = '') => (duz
    ? `<span class="fb-sabit" data-etiket="${k}" contenteditable="true" spellcheck="false">${esc(typeof ozel[k] === 'string' && ozel[k].trim() ? ozel[k] : temel[k] ?? k)}</span>${ek}`
    : `${esc(dget(k))}${ek}`);
  const al = a.alan; const fa = ctx.ayarlar || {};
  const duz = !!secenek.duzenle;
  const para = (n) => dovizPara(n, v.doviz || 'TRY');
  const doldur = (s) => (duz ? s : String(s)
    .replace(/\{musteri\}/g, esc(v.musteri?.unvan || '')).replace(/\{tarih\}/g, v.tarih ? tarih(v.tarih) : '')
    .replace(/\{belge_no\}/g, esc(v.belge_no || '')).replace(/\{toplam\}/g, v.genel_toplam != null ? esc(para(v.genel_toplam)) : '')
    .replace(/\{gecerlilik\}/g, v.gecerlilik ? tarih(v.gecerlilik) : '').replace(/\{vade\}/g, v.vade ? tarih(v.vade) : '')
    .replace(/\{firma\}/g, esc(fa.firma_adi || '')));
  // Zengin metin bloğu: kayıtlı değer yoksa (null) otomatik içerik
  const blok = (anahtar, otomatik, sinif = '') => {
    const kayitli = a.metin[anahtar];
    const icerik = kayitli === null || kayitli === undefined ? (otomatik || '') : temizHtml(kayitli);
    if (!duz && !String(icerik).replace(/<[^>]*>|&nbsp;|\s/g, '')) return '';
    return `<div class="fb-metin ${sinif}" data-metin="${anahtar}"${duz ? ' contenteditable="true" spellcheck="false"' : ''}>${doldur(icerik)}</div>`;
  };
  const varsayilanMetin = (k) => esc(VARSAYILAN_METIN[tur]?.[k] || '');
  const baslikVars = BASLIK_VARSAYILAN[a.dil]?.[tur] || BASLIK_VARSAYILAN.tr[tur];
  const baslik = esc(a.baslik ? (duz ? a.baslik : doldurDuz(a.baslik)) : baslikVars);

  // --- Üst bilgi ---
  const logoYol = a.logo.dosya ? `/dosya/${a.logo.dosya}` : fa.firma_logo ? `/logo?v=${encodeURIComponent(fa.firma_logo)}` : '';
  const seritYol = a.serit.kaynak === 'ozel' && a.serit.dosya ? `/dosya/${a.serit.dosya}` : a.serit.kaynak === 'firma' && fa.teklif_serit ? `/dosya/${fa.teklif_serit}` : '';
  const ust = () => {
    if (seritYol) return `<img class="fb-serit" src="${seritYol}" alt="">`;
    const logo = al.logo && logoYol
      ? `<div class="fb-logo" data-logo style="width:${Math.max(40, Math.min(600, Number(a.logo.genislik) || 220))}px">${duz ? '<span class="fb-logo-tut" data-logo-boyut title="Sürükleyerek büyütün"></span>' : ''}<img src="${logoYol}" alt=""></div>`
      : duz && al.logo ? '<div class="fb-logo fb-bos-logo" data-logo style="width:160px">Logo (Ayarlar → Firma bilgileri’nden yükleyin)</div>' : '';
    const firma = `${al.firma_ad ? blok('firma_ad', esc(fa.firma_adi || ''), 'fb-firma-ad') : ''}${al.firma_bilgi ? blok('firma_bilgi', firmaBilgiOtomatik(fa), 'fb-firma-bilgi') : ''}`;
    return `<div class="fb-ust fb-hiza-${a.logo.hiza}">${logo}<div class="fb-firma">${firma}</div></div>`;
  };

  // --- Müşteri + belge bilgileri ---
  const bilgiSatir = (et, deger) => `<tr><th>${et}:</th><td>${deger}</td></tr>`;
  const musteri = () => {
    const m = v.musteri || {};
    const yer = [m.ilce, m.il].filter(Boolean).join(' / ');
    const sol = `<div class="fb-musteri-kutu"><div class="fb-etiket">${E('sayin')}</div><div class="fb-unvan">${esc(m.unvan || '')}</div>
      ${al.musteri_adres && (m.adres || yer) ? `<div>${esc(m.adres || '')}${yer ? `<br>${esc(yer)}` : ''}</div>` : ''}
      ${al.musteri_tel && m.telefon ? `<div>${E('tel')}: ${esc(m.telefon)}</div>` : ''}
      ${al.musteri_vergi && (m.vergi_dairesi || m.vergi_no) ? `<div>${m.vergi_dairesi ? `${E('vd')}: ${esc(m.vergi_dairesi)} ` : ''}${m.vergi_no ? `${E('vn')}: ${esc(m.vergi_no)}` : ''}</div>` : ''}
      ${al.bakiye && v.bakiye != null && tur !== 'makbuz' ? `<div class="fb-bakiye">${E('bakiye')}: <b>${esc(dovizPara(Math.abs(v.bakiye)))} ${v.bakiye > 0.004 ? E('bakiye_b') : v.bakiye < -0.004 ? E('bakiye_a') : ''}</b></div>` : ''}</div>`;
    let sag = '';
    if (tur === 'ekstre') sag += bilgiSatir(E('donem'), `${tarih(v.ham.bas)} – ${tarih(v.ham.bit)}`);
    if (al.tarih && v.tarih) sag += bilgiSatir(E('tarih'), `<b>${tarih(v.tarih)}</b>`);
    if (al.belge_no && v.belge_no) sag += bilgiSatir(E('no'), `<b>${esc(v.belge_no)}</b>`);
    if (al.vade && v.vade) sag += bilgiSatir(E('vade'), tarih(v.vade));
    if (al.gecerlilik && v.gecerlilik) sag += bilgiSatir(E('gecerlilik'), tarih(v.gecerlilik));
    return `<div class="fb-musteri">${sol}<table class="fb-bilgi"><tbody>${sag}</tbody></table></div>`;
  };

  // --- Kalem tablosu ---
  const kolonlar = a.kolonlar.filter((k) => k.goster);
  const kolonBaslik = (k) => esc(k.ad || (k.id === 'no' ? dget('no_k') : temel[k.id] || KOLON_AD[k.id]));
  const hucre = (k, s, i) => {
    const kdvli = (n) => Number(n) * (1 + Number(s.kdv_orani || 0) / 100);
    switch (k.id) {
      case 'no': return i + 1;
      case 'resim': return s.urun_resim ? `<img class="fb-urun-resim" src="/dosya/${esc(s.urun_resim)}" alt="">` : '';
      case 'kod': return esc(s.urun_kod || '');
      case 'barkod': return esc(s.barkod || '');
      case 'raf': return esc(s.raf_yeri || '');
      case 'aciklama': return `<b>${esc(s.aciklama || '')}</b>${al.satir_notu && s.notu ? `<div class="fb-satir-not">${esc(s.notu)}</div>` : ''}`;
      case 'miktar': return esc(miktarBirim(s.miktar, s.birim));
      case 'liste_fiyati': return s.liste_fiyati != null ? esc(para(s.liste_fiyati)) : '';
      case 'birim_fiyat': return esc(para(s.birim_fiyat));
      case 'birim_fiyat_kdvli': return esc(para(Math.round(kdvli(s.birim_fiyat) * 100) / 100));
      case 'iskonto': return Number(s.iskonto_orani) ? `%${Number(s.iskonto_orani)}` : '';
      case 'kdv_orani': return `%${Number(s.kdv_orani)}`;
      case 'tutar': return esc(para(s.tutar));
      case 'tutar_kdvli': return esc(para(Math.round(kdvli(s.tutar) * 100) / 100));
      default: return '';
    }
  };
  const kalemler = () => `<table class="fb-tablo"><thead><tr>${kolonlar.map((k) => `<th class="fb-k-${k.id}${SAYI_KOLON.has(k.id) ? ' sayi' : ''}">${kolonBaslik(k)}</th>`).join('')}</tr></thead>
    <tbody>${(v.satirlar || []).map((s, i) => `<tr>${kolonlar.map((k) => `<td class="fb-k-${k.id}${SAYI_KOLON.has(k.id) ? ' sayi' : ''}">${hucre(k, s, i)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;

  // --- Toplam ---
  const toplam = () => {
    const t = a.toplam; const satirlar = v.satirlar || [];
    const brut = satirlar.reduce((x, s) => x + Number(s.miktar) * Number(s.birim_fiyat), 0);
    const oranlar = [...new Set(satirlar.map((s) => Number(s.kdv_orani)))];
    const r = [];
    if (t.brut) r.push([E('brut'), para(Math.round(brut * 100) / 100)]);
    if (t.indirim && brut - v.ara_toplam > 0.004) r.push([E('indirim'), para(Math.round((brut - v.ara_toplam) * 100) / 100)]);
    if (t.net) r.push([E('net'), para(v.ara_toplam)]);
    if (t.kdv) r.push([`${E('kdv')}${oranlar.length === 1 ? ` (%${oranlar[0]})` : ''}`, para(v.kdv_toplam)]);
    if (t.toplam) r.push([E('toplam'), para(v.genel_toplam), 'genel']);
    const kur = Number(v.kur);
    if (t.tl_karsilik && v.doviz && v.doviz !== 'TRY' && v.tl_karsilik_goster && kur > 0) {
      r.push([`${E('tl_karsilik')}<small>1 ${v.doviz} = ${kur.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} ₺</small>`, dovizPara(Math.round(v.genel_toplam * kur * 100) / 100), 'tl']);
    }
    return r.length ? `<table class="fb-toplam"><tbody>${r.map(([e, x, c]) => `<tr class="${c || ''}"><td>${e}</td><td>${esc(x)}</td></tr>`).join('')}</tbody></table>` : '';
  };
  const yazi = () => {
    if (tur === 'ekstre') {
      const son = v.ham.satirlar.at(-1)?.bakiye || 0;
      const k = son > 0.004 ? 'ekstre_borclu' : son < -0.004 ? 'ekstre_alacakli' : 'ekstre_sifir';
      return `<p class="fb-yazi"><b>${E(k).replace(/\{tutar\}/g, esc(dovizPara(Math.abs(son))))}</b></p>`;
    }
    if (!v.doviz || v.doviz === 'TRY') {
      let s = `<div class="fb-yazi"><span>${E('yalniz')}:</span> <b>#${esc(tutarYaziyla(v.genel_toplam))}#</b></div>`;
      if (tur === 'makbuz' && al.bakiye && v.bakiye != null) s += `<div class="fb-yazi">${E('makbuz_bakiye')}: <b>${esc(dovizPara(Math.abs(v.bakiye)))}</b> ${v.bakiye > 0.004 ? E('makbuz_borc') : v.bakiye < -0.004 ? E('makbuz_alacak') : ''}</div>`;
      return s;
    }
    return '';
  };

  // --- Türe özel içerik ---
  const govde = () => {
    const h = v.ham || {};
    if (tur === 'makbuz') return `<table class="fb-tablo"><thead><tr><th>${E('odeme_sekli')}</th><th>${E('aciklama')}</th><th>${E('belge_dekont')}</th><th class="sayi">${E('toplam')}</th></tr></thead>
      <tbody><tr><td>${h.hesap_tip ? E(`odeme_${h.hesap_tip}`) : ''} <span class="fb-soluk">(${esc(h.hesap_ad || '')})</span></td><td>${esc(h.aciklama || '')}</td><td>${esc(h.belge_no || '')}</td>
      <td class="sayi"><b>${esc(dovizPara(h.tutar))}</b></td></tr></tbody></table>`;
    if (tur === 'teslim') return `<table class="fb-tablo fb-dikey"><tbody>
      <tr><th>${E('yapilan_is')}</th><td><b>${esc(h.baslik || '')}</b>${h.aciklama ? `<br>${esc(h.aciklama)}` : ''}</td></tr>
      ${h.teknisyen_notu ? `<tr><th>${E('teknisyen_notu')}</th><td>${esc(h.teknisyen_notu)}</td></tr>` : ''}
      <tr><th>${E('ekip')}</th><td>${esc(h.ekip_ad || '')}</td></tr>
      <tr><th>${E('sure')}</th><td>${h.baslama_zamani ? zaman(h.baslama_zamani) : ''} – ${h.bitis_zamani ? zaman(h.bitis_zamani) : ''}</td></tr></tbody></table>`;
    if (tur === 'dis_servis') return `<table class="fb-tablo fb-dikey"><tbody>
      <tr><th>${E('cihaz')}</th><td>${esc([h.cihaz, h.marka_model].filter(Boolean).join(' · '))}</td></tr>
      <tr><th>${E('seri_no')}</th><td>${esc(h.seri_no || '—')}</td></tr>
      <tr><th>${E('ariza')}</th><td>${esc(h.ariza || '—')}</td></tr>
      <tr><th>${E('aksesuar')}</th><td>${esc(h.aksesuar || '—')}</td></tr></tbody></table>`;
    if (tur === 'ekstre') {
      const sat = h.satirlar || [];
      const tb = sat.reduce((x, s) => x + Number(s.borc), 0); const ta = sat.reduce((x, s) => x + Number(s.alacak), 0); const son = sat.at(-1)?.bakiye || 0;
      const bk = (b) => `${esc(dovizPara(Math.abs(b)))} ${b > 0.004 ? 'B' : b < -0.004 ? 'A' : ''}`;
      return `<table class="fb-tablo"><thead><tr><th>${E('tarih')}</th><th>${E('belge')}</th><th>${E('aciklama')}</th><th>${E('vade')}</th><th class="sayi">${E('borc')}</th><th class="sayi">${E('alacak')}</th><th class="sayi">${E('bakiye')}</th></tr></thead>
        <tbody>${sat.map((s) => `<tr><td>${tarih(s.tarih)}</td><td>${esc(BELGE[s.belge_tip] || s.belge_tip || '')} ${esc(s.belge_no || '')}</td><td>${esc(s.aciklama || '')}</td>
          <td>${s.vade ? tarih(s.vade) : ''}</td><td class="sayi">${s.borc ? esc(dovizPara(s.borc)) : ''}</td><td class="sayi">${s.alacak ? esc(dovizPara(s.alacak)) : ''}</td><td class="sayi">${bk(s.bakiye)}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="4" class="sayi">${E('toplam')}</td><td class="sayi">${esc(dovizPara(tb))}</td><td class="sayi">${esc(dovizPara(ta))}</td><td class="sayi">${bk(son)}</td></tr></tfoot></table>`;
    }
    return '';
  };
  const malzeme = () => {
    const m = v.ham?.malzemeler || [];
    if (!m.length) return '';
    return `<h3 class="fb-ara-baslik">${E('malzemeler')}</h3><table class="fb-tablo"><thead><tr><th>#</th><th>${E('urun')}</th><th class="sayi">${E('miktar')}</th></tr></thead>
      <tbody>${m.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(x.ad)}</td><td class="sayi">${esc(miktarBirim(x.miktar, x.birim))}</td></tr>`).join('')}</tbody></table>`;
  };

  // --- Notlar, banka, QR, imza, alt ---
  const notlar = () => {
    let oto = varsayilanMetin('notlar');
    if (tur === 'teslim') oto = esc(fa.teslim_metni || '');
    if (tur === 'satis_fisi' && fa.fis_notu) oto = esc(fa.fis_notu);
    const belgeAciklama = al.aciklama && v.aciklama ? `<p class="fb-aciklama">${esc(v.aciklama).replace(/\n/g, '<br>')}</p>` : '';
    const musteriNotu = tur === 'teslim' && v.ham?.teslim?.musteri_notu ? `<p><b>${E('musteri_notu')}:</b> ${esc(v.ham.teslim.musteri_notu)}</p>` : '';
    return belgeAciklama + musteriNotu + blok('notlar', oto, 'fb-notlar');
  };
  const qr = () => {
    const metin = a.qr.icerik === 'ozel' ? doldurDuz(a.qr.metin || '') : [fa.firma_adi, TUR_AD[tur], v.belge_no, v.tarih ? tarih(v.tarih) : '', v.genel_toplam != null ? dovizPara(v.genel_toplam, v.doviz) : ''].filter(Boolean).join(' · ');
    if (!metin) return duz ? '<div class="fb-qr fb-bos">QR içeriği boş</div>' : '';
    try { return `<div class="fb-qr">${qrSvg(metin)}<small>${a.qr.icerik === 'ozel' ? '' : E('belge_dogrulama')}</small></div>`; } catch { return ''; }
  };
  function doldurDuz(s) {
    return String(s).replace(/\{musteri\}/g, v.musteri?.unvan || '').replace(/\{tarih\}/g, v.tarih ? tarih(v.tarih) : '').replace(/\{belge_no\}/g, v.belge_no || '')
      .replace(/\{toplam\}/g, v.genel_toplam != null ? dovizPara(v.genel_toplam, v.doviz) : '').replace(/\{firma\}/g, fa.firma_adi || '');
  }
  const kaseGoster = secenek.kase !== undefined ? secenek.kase : (v.kase !== undefined && v.kase !== null ? v.kase : true);
  const kaseImg = al.kase && kaseGoster && fa.kase_imza ? `<img class="fb-kase" src="/dosya/${fa.kase_imza}" alt="">` : '';
  const imza = () => {
    if (al.imza_kutulari) {
      const t = v.ham?.teslim;
      const [solE, sagE, solA, sagA] = tur === 'makbuz' ? [E('odeme_yapan'), E('tahsil_eden'), esc(v.musteri?.unvan || ''), esc(fa.firma_adi || '')]
        : tur === 'dis_servis' ? [E('teslim_eden'), E('teslim_alan'), esc(v.musteri?.unvan || ''), esc(fa.firma_adi || '')]
          : tur === 'teslim' ? [E('teslim_eden'), E('teslim_alan'), esc(t?.teknisyen || ''), `${esc(t?.teslim_alan_ad || '')}${t?.teslim_alan_tel ? ' · ' + esc(t.teslim_alan_tel) : ''}${t?.imza_dosya ? `<br><img src="/dosya/${esc(t.imza_dosya)}" alt="İmza">` : ''}`]
            : [E('teslim_eden'), E('teslim_alan'), '', ''];
      return `<div class="fb-imzalar"><div><b>${solE}</b><br>${solA}</div><div><b>${sagE}</b><br>${sagA}${kaseImg ? `<br>${kaseImg}` : ''}</div></div>`;
    }
    return kaseImg ? `<div class="fb-kase-alan">${kaseImg}</div>` : '';
  };
  const alt = () => {
    let oto = varsayilanMetin('alt');
    if (tur === 'teslim') oto = `Bu form ${esc(fa.firma_adi || '')} servis takip sistemi ile elektronik imzalı olarak oluşturulmuştur.${v.ham?.teslim?.zaman ? ` İmza zamanı: ${zaman(v.ham.teslim.zaman)}` : ''}`;
    return blok('alt', oto, 'fb-alt');
  };

  const CIZ = {
    ust, baslik: () => `<div class="fb-baslik"${duz ? ' data-etiket="baslik" contenteditable="true" spellcheck="false"' : ''}>${baslik}</div>`, musteri,
    giris: () => blok('giris', tur === 'makbuz' ? varsayilanMetin('giris') : esc(v.giris || ''), 'fb-giris'),
    kalemler, toplam, yazi, govde, malzeme, notlar, banka: () => blok('banka', '', 'fb-banka'), qr, imza, alt,
  };
  const sayfaIci = (nusha) => a.bolumler.filter((b) => b.goster && CIZ[b.id]).map((b) => {
    const ic = CIZ[b.id]();
    if (!ic && !duz) return '';
    return `<section class="fb-b fb-b-${b.id}" data-bolum="${b.id}">${ic || (duz ? `<div class="fb-bos">${BOLUM_AD[b.id]}</div>` : '')}</section>`;
  }).join('') + (nusha ? `<div class="fb-nusha">${nusha}</div>` : '');

  const filigran = al.filigran && (v.durum === 'iptal' || (tur === 'satis_fisi' && v.durum === 'taslak')) ? `<div class="fb-filigran">${v.durum === 'iptal' ? E('iptal') : E('taslak')}</div>` : '';
  const nushaSay = secenek.nusha || a.nusha || 1;
  const nushaAd = tur === 'dis_servis' ? [E('musteri_nushasi'), E('firma_nushasi')] : [E('asil'), E('suret')];
  const ic = nushaSay === 2
    ? `${sayfaIci(nushaAd[0])}${al.kesme !== false ? '<div class="fb-kesme"></div>' : '<div class="fb-ara"></div>'}${sayfaIci(nushaAd[1])}`
    : sayfaIci('');
  const stil = `--fb-renk:${esc(a.renk)};--fb-yazi:'${esc(a.yazi_tipi)}', Arial, sans-serif;--fb-boy:${Number(a.yazi_boyu) || 12.5}px;`;
  return `<div class="fb fb-tema-${esc(a.tema)} fb-kagit-${esc(a.kagit)}${nushaSay === 2 ? ' fb-iki-nusha' : ''}${duz ? ' fb-duzenle' : ''}" style="${stil}" data-sayfa-etiket="${esc(dget('sayfa'))}">${filigran}${ic}</div>`;
}

// Yazdırma sayfası ayarı (kâğıt ve kenar boşluğu)
export function sayfaStili(tur, ayarHam) {
  const a = ayarTamamla(tur, ayarHam);
  const boyut = { A4: 'A4 portrait', A4Y: 'A4 landscape', A5: 'A5 portrait' }[a.kagit] || 'A4 portrait';
  const k = Math.max(4, Math.min(30, Number(a.kenar) || 12));
  const d = DIL[a.dil] || DIL.tr;
  const sayfaYazi = typeof a.etiket?.sayfa === 'string' && a.etiket.sayfa.trim() ? a.etiket.sayfa.trim().replace(/["\\]/g, '') : d.sayfa;
  const no = a.alan.sayfa_no ? `@bottom-right { content: "${sayfaYazi} " counter(page) " / " counter(pages); font: 9px Arial, sans-serif; color: #555; }` : '';
  return `@page { size: ${boyut}; margin: ${k}mm; ${no} }`;
}
export { ham, html };
