'use strict';
// e-Fatura XML (UBL-TR) → taslak alış faturası. Yüklenen dosya hiçbir yere yazılmaz; yalnız bellekte okunur.
const { efaturaOku } = require('../lib/efatura');
const { zipAc } = require('../lib/zip');
const { metin, sayi, tarih } = require('../lib/yardim');

const { eslestirici, dosyaMetni, r4, DOVIZ, cariBilgiTamamla } = require('../lib/efaturaEslestir');

module.exports = (r, { db, web, Y }) => {
  const { urunleriYukle, onizle } = eslestirici(db);

  r.post('/efatura/oku', Y, async (req) => {
    const liste = Array.isArray(req.body.dosyalar) ? req.body.dosyalar : [];
    if (!liste.length) throw web.hata(400, 'Dosya seçin.');
    const okunanlar = []; const hatalar = [];
    for (const d of liste.slice(0, 50)) {
      const ad = String(d.ad || 'dosya');
      let buf;
      try { buf = Buffer.from(String(d.veri || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch { hatalar.push({ dosya: ad, hata: 'Dosya okunamadı.' }); continue; }
      let xmller = [];
      try {
        if (buf[0] === 0x50 && buf[1] === 0x4b) xmller = zipAc(buf).filter((x) => /\.xml$/i.test(x.ad)).map((x) => ({ ad: `${ad} › ${x.ad}`, icerik: x.icerik }));
        else xmller = [{ ad, icerik: buf }];
        if (!xmller.length) hatalar.push({ dosya: ad, hata: 'Zip içinde XML dosyası yok.' });
      } catch (e) { hatalar.push({ dosya: ad, hata: e.message }); continue; }
      for (const x of xmller) {
        try { okunanlar.push({ dosya: x.ad, ...efaturaOku(dosyaMetni(x.icerik)) }); } catch (e) { hatalar.push({ dosya: x.ad, hata: /XML:|e-Fatura/.test(e.message) ? e.message : 'XML okunamadı.' }); }
      }
    }
    // Aynı fatura birden çok dosyada geldiyse bir kez
    const gorulen = new Set();
    const tekil = okunanlar.filter((f) => { const k = f.ettn || `${f.tedarikci?.vkn}|${f.no}`; if (gorulen.has(k)) return false; gorulen.add(k); return true; });
    const st = await urunleriYukle();
    const faturalar = [];
    for (const f of tekil) faturalar.push(await onizle(f, st));
    return { faturalar, hatalar };
  });

  r.post('/efatura/kaydet', Y, async (req) => {
    const b = req.body; const f = b.fatura || {};
    const no = metin(f.no); if (!no) throw web.hata(400, 'Fatura numarası yok.');
    const doviz = DOVIZ.includes(f.doviz) ? f.doviz : null;
    if (!doviz) throw web.hata(400, 'Para birimi desteklenmiyor (TL, USD, EUR).');
    const kur = doviz === 'TRY' ? null : sayi(f.kur, 'Kur');
    if (doviz !== 'TRY' && !(kur > 0)) throw web.hata(400, `${doviz} kurunu girin.`, 'KUR_YOK');
    const satirlar = Array.isArray(b.satirlar) ? b.satirlar : [];
    if (!satirlar.length) throw web.hata(400, 'Aktarılacak kalem yok.');
    const id = await db.islem(req.kullanici.id, async (q) => {
      // Tedarikçi
      let cariId = b.cari_id ? Number(b.cari_id) : null;
      if (cariId) {
        const c = await q.bir('SELECT id, tip FROM cariler WHERE id = $1', [cariId]);
        if (!c) throw web.hata(400, 'Tedarikçi bulunamadı.');
        if (c.tip === 'musteri') await q("UPDATE cariler SET tip = 'her_ikisi' WHERE id = $1", [cariId]);
        await cariBilgiTamamla(q, cariId, b.cari_bilgi || b.yeni_cari);
      } else {
        const y = b.yeni_cari || {};
        if (!metin(y.unvan)) throw web.hata(400, 'Tedarikçi ünvanı yok.');
        cariId = (await q.bir(`INSERT INTO cariler (tip, unvan, vergi_no, vergi_dairesi, adres, il, ilce, telefon, eposta, olusturan_id)
          VALUES ('tedarikci', $1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [metin(y.unvan), metin(y.vergi_no), metin(y.vergi_dairesi), metin(y.adres), metin(y.il), metin(y.ilce), metin(y.telefon), metin(y.eposta), req.kullanici.id])).id;
      }
      // Mükerrer
      const ettn = metin(f.ettn)?.toLowerCase() || null;
      const var_ = await q.bir(`SELECT id, belge_no FROM alis_faturalari WHERE (ettn IS NOT NULL AND lower(ettn) = $1) OR (cari_id = $2 AND belge_no = $3) LIMIT 1`, [ettn || '-', cariId, no]);
      if (var_) throw web.hata(409, `Bu fatura (${var_.belge_no}) daha önce girilmiş.`, 'MUKERRER');
      if (ettn && await q.bir("SELECT 1 AS v FROM resmi_faturalar WHERE yon = 'alis' AND ettn IS NOT NULL AND lower(ettn) = $1", [ettn])) {
        throw web.hata(409, 'Bu fatura "yalnız KDV (gider)" olarak kaydedilmiş. Önce Resmi faturalar\'dan silin.', 'MUKERRER');
      }
      const a = await q.bir(`INSERT INTO alis_faturalari (belge_no, cari_id, tarih, vade, aciklama, olusturan_id, doviz, kur, ettn)
        VALUES ($1, $2, coalesce($3::date, current_date), $4, $5, $6, $7, $8, $9) RETURNING id`,
      [no, cariId, tarih(f.tarih), tarih(f.vade), metin(f.aciklama) || 'e-Fatura XML\'den aktarıldı', req.kullanici.id, doviz, kur, ettn]);
      for (const s of satirlar) {
        let urunId = s.urun_id ? Number(s.urun_id) : null;
        if (!urunId) {
          const y = s.yeni_urun || {};
          if (!metin(y.ad)) throw web.hata(400, 'Yeni stok kartının adı boş.');
          const kdv = sayi(y.kdv_orani) ?? 20;
          urunId = (await q.bir(`INSERT INTO urunler (ad, birim, kdv_orani, tur, olusturan_id) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [metin(y.ad), metin(y.birim) || 'adet', kdv, y.tur === 'hizmet' ? 'hizmet' : 'urun', req.kullanici.id])).id;
          const bk = metin(y.barkod);
          if (bk && !(await q.bir('SELECT 1 AS v FROM urun_barkodlari WHERE barkod = $1', [bk]))) await q('INSERT INTO urun_barkodlari (barkod, urun_id) VALUES ($1, $2)', [bk, urunId]);
        }
        const miktar = sayi(s.miktar, 'Miktar');
        if (!(miktar > 0)) throw web.hata(400, 'Miktar sıfırdan büyük olmalı.');
        const fiyat = sayi(s.birim_fiyat, 'Fiyat') || 0;
        await q(`INSERT INTO alis_faturasi_satirlari (fatura_id, urun_id, miktar, birim_fiyat, kdv_orani, doviz_fiyat) VALUES ($1, $2, $3, $4, $5, $6)`,
          [a.id, urunId, miktar, doviz === 'TRY' ? fiyat : r4(fiyat * kur), sayi(s.kdv_orani, 'KDV') ?? 20, doviz === 'TRY' ? null : fiyat]);
        if (metin(s.anahtar)) {
          await q(`INSERT INTO tedarikci_urun_eslesme (cari_id, anahtar, urun_id) VALUES ($1, $2, $3)
            ON CONFLICT (cari_id, anahtar) DO UPDATE SET urun_id = excluded.urun_id, guncelleme = now()`, [cariId, metin(s.anahtar), urunId]);
        }
        // Öğrenme: model kodları (tedarikçiden bağımsız) ve faturadaki barkod karta yazılır
        for (const k of (Array.isArray(s.modeller) ? s.modeller : []).slice(0, 5)) {
          const mk = String(k || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
          if (mk.length >= 4) {
            await q(`INSERT INTO tedarikci_urun_eslesme (cari_id, anahtar, urun_id) VALUES ($1, $2, $3)
              ON CONFLICT (cari_id, anahtar) DO UPDATE SET urun_id = excluded.urun_id, guncelleme = now()`, [cariId, `model:${mk}`, urunId]);
          }
        }
        const bk = String(s.barkod || '').trim();
        if (/^\d{8,14}$/.test(bk) && !(await q.bir('SELECT 1 AS v FROM urun_barkodlari WHERE barkod = $1', [bk]))) {
          await q('INSERT INTO urun_barkodlari (barkod, urun_id) VALUES ($1, $2)', [bk, urunId]);
        }
      }
      // Tedarikçinin sonraki faturaları da stoklu alış olarak gelsin
      const vkn = String(metin(f.vkn) || '').replace(/\D/g, '');
      if (vkn) await q(`INSERT INTO tedarikci_tercih (vkn, secim) VALUES ($1, 'stoklu')
        ON CONFLICT (vkn) DO UPDATE SET secim = 'stoklu', guncelleme = now()`, [vkn]);
      return a.id;
    });
    return { id };
  });
};
