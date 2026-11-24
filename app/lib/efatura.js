'use strict';
// e-Fatura / e-Arşiv (UBL-TR 1.2) XML'ini sade bir nesneye çevirir.
const { xmlOku, bul, hepsi, yazi } = require('./xml');

// UN/ECE birim kodları → programdaki birim adı
const BIRIM = {
  C62: 'adet', NIU: 'adet', EA: 'adet', H87: 'adet', PCE: 'adet', ADET: 'adet',
  HUR: 'saat', DAY: 'gün', MON: 'ay', ANN: 'yıl', MIN: 'dakika',
  KGM: 'kg', GRM: 'gr', TNE: 'ton', MTR: 'metre', CMT: 'cm', MMT: 'mm', KTM: 'km', MTK: 'm²', MTQ: 'm³',
  LTR: 'litre', MLT: 'ml', SET: 'set', PR: 'çift', PA: 'paket', PK: 'paket', BX: 'kutu', CT: 'koli', RO: 'rulo', R9: 'rulo',
  KWH: 'kWh', D61: 'dakika', '26': 'ton',
};
const sayi = (v) => { const n = Number(String(v ?? '').trim()); return Number.isFinite(n) ? n : 0; };
const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const r4 = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

function taraf(p) {
  if (!p) return null;
  const kimlikler = hepsi(p, 'PartyIdentification').map((x) => bul(x, 'ID')).filter(Boolean);
  const kimlik = (tur) => kimlikler.find((x) => String(x.oz.schemeID || '').toUpperCase() === tur)?.metin.trim() || '';
  const kisi = bul(p, 'Person');
  const kisiAd = kisi ? [yazi(kisi, 'FirstName'), yazi(kisi, 'MiddleName'), yazi(kisi, 'FamilyName')].filter(Boolean).join(' ') : '';
  const adr = bul(p, 'PostalAddress');
  const sokak = adr ? [yazi(adr, 'Room'), yazi(adr, 'StreetName'), yazi(adr, 'BuildingName'), yazi(adr, 'BuildingNumber') && `No: ${yazi(adr, 'BuildingNumber')}`, yazi(adr, 'District')].filter(Boolean).join(' ') : '';
  const iletisim = bul(p, 'Contact');
  return {
    unvan: yazi(p, 'PartyName/Name') || kisiAd,
    vkn: kimlik('VKN'),
    tckn: kimlik('TCKN'),
    vergi_dairesi: yazi(p, 'PartyTaxScheme/TaxScheme/Name'),
    adres: sokak,
    ilce: adr ? yazi(adr, 'CitySubdivisionName') : '',
    il: adr ? yazi(adr, 'CityName') : '',
    telefon: iletisim ? yazi(iletisim, 'Telephone') : '',
    eposta: iletisim ? yazi(iletisim, 'ElectronicMail') : '',
    web: yazi(p, 'WebsiteURI'),
  };
}

function efaturaOku(xmlMetin) {
  const k = xmlOku(xmlMetin);
  if (!k || k.ad !== 'Invoice') throw new Error('Bu dosya bir e-Fatura (UBL Invoice) değil.');
  const doviz = (yazi(k, 'DocumentCurrencyCode') || 'TRY').toUpperCase().replace('TL', 'TRY');
  const kur = sayi(yazi(k, 'PricingExchangeRate/CalculationRate')) || null;
  const vade = yazi(k, 'PaymentMeans/PaymentDueDate') || yazi(k, 'PaymentTerms/PaymentDueDate') || null;
  const top = bul(k, 'LegalMonetaryTotal');
  const uyarilar = [];
  const tip = yazi(k, 'InvoiceTypeCode').toUpperCase();
  if (tip === 'IADE') uyarilar.push('Bu bir İADE faturası; alış faturası olarak girilmemeli.');
  if (tip === 'TEVKIFAT' || hepsi(k, 'WithholdingTaxTotal').length) uyarilar.push('Faturada KDV tevkifatı var: cariye yazılacak tutar faturadaki ödenecek tutardan farklı olabilir, kontrol edin.');
  if (hepsi(k, 'AllowanceCharge').length) uyarilar.push('Faturada belge altı iskonto / masraf var; satır fiyatlarına dağıtılmadı, kontrol edin.');

  const satirlar = hepsi(k, 'InvoiceLine').map((l, i) => {
    const mikD = bul(l, 'InvoicedQuantity');
    const miktar = sayi(mikD?.metin);
    const birimKod = String(mikD?.oz.unitCode || '').toUpperCase();
    const tutar = sayi(yazi(l, 'LineExtensionAmount'));
    const fiyat = sayi(yazi(l, 'Price/PriceAmount'));
    const item = bul(l, 'Item');
    // İskonto: satır AllowanceCharge (ChargeIndicator=false)
    let isk = 0;
    for (const ac of hepsi(l, 'AllowanceCharge')) {
      if (yazi(ac, 'ChargeIndicator') === 'true') continue;
      const oran = sayi(yazi(ac, 'MultiplierFactorNumeric'));
      const tut = sayi(yazi(ac, 'Amount')); const taban = sayi(yazi(ac, 'BaseAmount'));
      isk = oran ? (oran <= 1 ? oran * 100 : oran) : taban ? (tut * 100 / taban) : isk;
    }
    const kdvAlt = hepsi(l, 'TaxTotal/TaxSubtotal').find((t) => ['0015', 'KDV'].includes(yazi(t, 'TaxCategory/TaxScheme/TaxTypeCode')) || /KDV|GERÇEK USULDE KATMA/i.test(yazi(t, 'TaxCategory/TaxScheme/Name')))
      || hepsi(l, 'TaxTotal/TaxSubtotal')[0];
    const kdv = kdvAlt ? sayi(yazi(kdvAlt, 'Percent')) : 0;
    const ekKodlar = item ? hepsi(item, 'AdditionalItemIdentification').map((x) => yazi(x, 'ID')).filter(Boolean) : [];
    const ad = item ? (yazi(item, 'Name') || yazi(item, 'Description')) : '';
    return {
      sira: i + 1,
      ad: ad.replace(/\s+/g, ' ').trim(),
      aciklama: item ? yazi(item, 'Description') : '',
      marka: item ? yazi(item, 'BrandName') : '',
      model: item ? yazi(item, 'ModelName') : '',
      satici_kodu: item ? yazi(item, 'SellersItemIdentification/ID') : '',
      alici_kodu: item ? yazi(item, 'BuyersItemIdentification/ID') : '',
      uretici_kodu: item ? yazi(item, 'ManufacturersItemIdentification/ID') : '',
      ek_kodlar: ekKodlar,
      miktar,
      birim_kodu: birimKod,
      birim: BIRIM[birimKod] || (birimKod ? birimKod.toLowerCase() : 'adet'),
      liste_fiyat: fiyat,
      iskonto_orani: r2(isk),
      // Net birim fiyat (iskonto sonrası, KDV hariç, belge para biriminde)
      birim_fiyat: miktar ? r4(tutar / miktar) : fiyat,
      tutar,
      kdv_orani: kdv,
      not: hepsi(l, 'Note').map((x) => x.metin.trim()).filter(Boolean).join(' · '),
    };
  });
  if (!satirlar.length) uyarilar.push('Faturada kalem bulunamadı.');

  return {
    profil: yazi(k, 'ProfileID'),
    tip,
    no: yazi(k, 'ID'),
    ettn: yazi(k, 'UUID').toLowerCase(),
    tarih: yazi(k, 'IssueDate'),
    vade,
    doviz: /^[A-Z]{3}$/.test(doviz) ? doviz : 'TRY',
    kur,
    notlar: hepsi(k, 'Note').map((x) => x.metin.trim()).filter(Boolean),
    tedarikci: taraf(bul(k, 'AccountingSupplierParty/Party')),
    alici: taraf(bul(k, 'AccountingCustomerParty/Party')),
    satirlar,
    toplam: {
      satir: sayi(yazi(top, 'LineExtensionAmount')),
      iskonto: sayi(yazi(top, 'AllowanceTotalAmount')),
      ara: sayi(yazi(top, 'TaxExclusiveAmount')),
      kdv: sayi(yazi(k, 'TaxTotal/TaxAmount')),
      genel: sayi(yazi(top, 'TaxInclusiveAmount')),
      odenecek: sayi(yazi(top, 'PayableAmount')),
    },
    uyarilar,
  };
}

module.exports = { efaturaOku, BIRIM };
