'use strict';
// Testler için UBL-TR 1.2 e-Fatura örneği ve küçük zip yazıcı
const zlib = require('zlib');

function ornekXml({ no = 'ABC2026000000123', ettn = '6f1c2b8e-3d4a-4b5c-9e7f-0a1b2c3d4e5f', vkn = '1234567890', unvan = 'Teknoloji Dağıtım A.Ş.', aliciVkn = '9876543210',
  doviz = 'TRY', kur = null, tip = 'SATIS', satirlar, tarih = '2026-11-20', tevkifat = 0 } = {}) {
  const s = satirlar || [
    { ad: 'Hikvision DS-2CD1043G2-I 4MP IP Kamera', satici: 'HKV-1043G2', barkod: '6941264012345', miktar: 10, birim: 'C62', fiyat: 1250, isk: 10, kdv: 20 },
    { ad: 'CAT6 UTP Kablo 305m', satici: 'KBL-C6-305', miktar: 2, birim: 'C62', fiyat: 3400, isk: 0, kdv: 20 },
    { ad: 'Kurulum &amp; montaj hizmeti', satici: '', miktar: 3, birim: 'HUR', fiyat: 500, isk: 0, kdv: 20 },
  ];
  let satirXml = ''; let ara = 0; let kdvT = 0; let brut = 0; let iskT = 0;
  s.forEach((x, i) => {
    const b = x.miktar * x.fiyat; const ik = Math.round(b * x.isk) / 100; const net = Math.round((b - ik) * 100) / 100; const kd = Math.round(net * x.kdv) / 100;
    brut += b; iskT += ik; ara += net; kdvT += kd;
    satirXml += `
  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${x.birim}">${x.miktar}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${doviz}">${net.toFixed(2)}</cbc:LineExtensionAmount>
    ${x.isk ? `<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:MultiplierFactorNumeric>${(x.isk / 100).toFixed(2)}</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="${doviz}">${ik.toFixed(2)}</cbc:Amount><cbc:BaseAmount currencyID="${doviz}">${b.toFixed(2)}</cbc:BaseAmount></cac:AllowanceCharge>` : ''}
    <cac:TaxTotal><cbc:TaxAmount currencyID="${doviz}">${kd.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxSubtotal><cbc:TaxableAmount currencyID="${doviz}">${net.toFixed(2)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${doviz}">${kd.toFixed(2)}</cbc:TaxAmount><cbc:Percent>${x.kdv}</cbc:Percent>
        <cac:TaxCategory><cac:TaxScheme><cbc:Name>GERÇEK USULDE KATMA DEĞER VERGİSİ</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
    <cac:Item><cbc:Name>${x.ad}</cbc:Name>${x.satici ? `<cac:SellersItemIdentification><cbc:ID>${x.satici}</cbc:ID></cac:SellersItemIdentification>` : ''}${x.barkod ? `<cac:AdditionalItemIdentification><cbc:ID schemeID="BARKOD">${x.barkod}</cbc:ID></cac:AdditionalItemIdentification>` : ''}</cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${doviz}">${x.fiyat.toFixed(4)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>`;
  });
  const r = (n) => (Math.round(n * 100) / 100).toFixed(2);
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="general.xslt"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2" xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent><!-- imza --><ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:SignatureValue>QUJD</ds:SignatureValue></ds:Signature></ext:ExtensionContent></ext:UBLExtension></ext:UBLExtensions>
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>TR1.2</cbc:CustomizationID>
  <cbc:ProfileID>TICARIFATURA</cbc:ProfileID>
  <cbc:ID>${no}</cbc:ID>
  <cbc:CopyIndicator>false</cbc:CopyIndicator>
  <cbc:UUID>${ettn.toUpperCase()}</cbc:UUID>
  <cbc:IssueDate>${tarih}</cbc:IssueDate>
  <cbc:IssueTime>14:05:00</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${tip}</cbc:InvoiceTypeCode>
  <cbc:Note><![CDATA[Yalnız #...# — test <notu>]]></cbc:Note>
  <cbc:DocumentCurrencyCode>${doviz}</cbc:DocumentCurrencyCode>
  <cbc:LineCountNumeric>${s.length}</cbc:LineCountNumeric>
  <cac:AdditionalDocumentReference><cbc:ID>${ettn}</cbc:ID><cbc:IssueDate>2026-11-20</cbc:IssueDate>
    <cac:Attachment><cbc:EmbeddedDocumentBinaryObject characterSetCode="UTF-8" encodingCode="Base64" filename="${no}.xslt" mimeCode="application/xml">PHhzbDpzdHlsZXNoZWV0Lz4=</cbc:EmbeddedDocumentBinaryObject></cac:Attachment></cac:AdditionalDocumentReference>
  <cac:AccountingSupplierParty><cac:Party>
    <cbc:WebsiteURI>www.teknodagitim.com.tr</cbc:WebsiteURI>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">${vkn}</cbc:ID></cac:PartyIdentification>
    <cac:PartyIdentification><cbc:ID schemeID="MERSISNO">0123456789000015</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>${unvan}</cbc:Name></cac:PartyName>
    <cac:PostalAddress><cbc:StreetName>Atatürk Bulvarı</cbc:StreetName><cbc:BuildingNumber>42</cbc:BuildingNumber><cbc:CitySubdivisionName>Çankaya</cbc:CitySubdivisionName><cbc:CityName>Ankara</cbc:CityName><cac:Country><cbc:Name>Türkiye</cbc:Name></cac:Country></cac:PostalAddress>
    <cac:PartyTaxScheme><cac:TaxScheme><cbc:Name>Kavaklıdere</cbc:Name></cac:TaxScheme></cac:PartyTaxScheme>
    <cac:Contact><cbc:Telephone>0312 555 12 34</cbc:Telephone><cbc:ElectronicMail>satis@teknodagitim.com.tr</cbc:ElectronicMail></cac:Contact>
  </cac:Party></cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty><cac:Party>
    <cac:PartyIdentification><cbc:ID schemeID="VKN">${aliciVkn}</cbc:ID></cac:PartyIdentification>
    <cac:PartyName><cbc:Name>Atar Bilişim</cbc:Name></cac:PartyName>
  </cac:Party></cac:AccountingCustomerParty>
  <cac:PaymentMeans><cbc:PaymentMeansCode>42</cbc:PaymentMeansCode><cbc:PaymentDueDate>2026-12-20</cbc:PaymentDueDate></cac:PaymentMeans>
  ${kur ? `<cac:PricingExchangeRate><cbc:SourceCurrencyCode>${doviz}</cbc:SourceCurrencyCode><cbc:TargetCurrencyCode>TRY</cbc:TargetCurrencyCode><cbc:CalculationRate>${kur}</cbc:CalculationRate></cac:PricingExchangeRate>` : ''}
  <cac:TaxTotal><cbc:TaxAmount currencyID="${doviz}">${r(kdvT)}</cbc:TaxAmount>
    <cac:TaxSubtotal><cbc:TaxableAmount currencyID="${doviz}">${r(ara)}</cbc:TaxableAmount><cbc:TaxAmount currencyID="${doviz}">${r(kdvT)}</cbc:TaxAmount><cbc:Percent>20</cbc:Percent>
      <cac:TaxCategory><cac:TaxScheme><cbc:Name>KDV</cbc:Name><cbc:TaxTypeCode>0015</cbc:TaxTypeCode></cac:TaxScheme></cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>
  ${tevkifat ? `<cac:WithholdingTaxTotal><cbc:TaxAmount currencyID="${doviz}">${r(tevkifat)}</cbc:TaxAmount></cac:WithholdingTaxTotal>` : ''}
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${doviz}">${r(ara)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${doviz}">${r(ara)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${doviz}">${r(ara + kdvT)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="${doviz}">${r(iskT)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="${doviz}">${r(ara + kdvT)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${satirXml}
</Invoice>`;
}

// Basit zip (deflate) yazıcı
function crc32(buf) {
  let c; const t = crc32.t || (crc32.t = Array.from({ length: 256 }, (_, n) => { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  let crc = 0xffffffff;
  for (const b of buf) crc = t[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function zipYap(dosyalar) {
  const yereller = []; const merkez = []; let ofs = 0;
  for (const { ad, icerik } of dosyalar) {
    const veri = Buffer.from(icerik); const sik = zlib.deflateRawSync(veri); const adB = Buffer.from(ad);
    const crc = crc32(veri);
    const y = Buffer.alloc(30); y.writeUInt32LE(0x04034b50, 0); y.writeUInt16LE(20, 4); y.writeUInt16LE(0x0800, 6); y.writeUInt16LE(8, 8);
    y.writeUInt32LE(crc, 14); y.writeUInt32LE(sik.length, 18); y.writeUInt32LE(veri.length, 22); y.writeUInt16LE(adB.length, 26);
    yereller.push(y, adB, sik);
    const m = Buffer.alloc(46); m.writeUInt32LE(0x02014b50, 0); m.writeUInt16LE(20, 4); m.writeUInt16LE(20, 6); m.writeUInt16LE(0x0800, 8); m.writeUInt16LE(8, 10);
    m.writeUInt32LE(crc, 16); m.writeUInt32LE(sik.length, 20); m.writeUInt32LE(veri.length, 24); m.writeUInt16LE(adB.length, 28); m.writeUInt32LE(ofs, 42);
    merkez.push(m, adB);
    ofs += 30 + adB.length + sik.length;
  }
  const mBuf = Buffer.concat(merkez);
  const son = Buffer.alloc(22); son.writeUInt32LE(0x06054b50, 0); son.writeUInt16LE(dosyalar.length, 8); son.writeUInt16LE(dosyalar.length, 10);
  son.writeUInt32LE(mBuf.length, 12); son.writeUInt32LE(ofs, 16);
  return Buffer.concat([...yereller, mBuf, son]);
}

module.exports = { ornekXml, zipYap };
