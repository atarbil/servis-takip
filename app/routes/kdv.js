'use strict';
// KDV durumu: "bu ay KDV çıkıyor mu?"
// /kdv/oku   : yüklenen satış e-Fatura / e-Arşiv XML'lerinin KDV özetini döner. Yalnız bellekte okunur, hiçbir şey kaydedilmez.
//              (Ekran dosyaları parça parça gönderir, özetleri kendisi toplar; aynı fatura ETTN ile bir kez sayılır.)
// /kdv/alis  : programdaki o ayın onaylı alış faturalarından indirilecek KDV.
const { efaturaOku } = require('../lib/efatura');
const { zipAc } = require('../lib/zip');

const r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
const metinYap = (buf) => (buf[0] === 0xff && buf[1] === 0xfe ? buf.slice(2).toString('utf16le') : buf.toString('utf8'));
const ayKontrol = (ay, web) => { if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(ay || ''))) throw web.hata(400, 'Ay seçin.'); return `${ay}-01`; };

module.exports = (r, { db, web, Y }) => {
  r.post('/kdv/oku', Y, async (req) => {
    const liste = Array.isArray(req.body.dosyalar) ? req.body.dosyalar.slice(0, 500) : [];
    const faturalar = []; const hatalar = [];
    for (const d of liste) {
      const ad = String(d.ad || 'dosya');
      let buf;
      try { buf = Buffer.from(String(d.veri || '').replace(/^data:[^,]*,/, ''), 'base64'); } catch { hatalar.push({ dosya: ad, hata: 'Dosya okunamadı.' }); continue; }
      let xmller;
      try {
        xmller = buf[0] === 0x50 && buf[1] === 0x4b ? zipAc(buf).filter((x) => /\.xml$/i.test(x.ad)).map((x) => ({ ad: `${ad} › ${x.ad}`, icerik: x.icerik })) : [{ ad, icerik: buf }];
        if (!xmller.length) hatalar.push({ dosya: ad, hata: 'Zip içinde XML yok.' });
      } catch (e) { hatalar.push({ dosya: ad, hata: e.message }); continue; }
      for (const x of xmller) {
        let f;
        try { f = efaturaOku(metinYap(x.icerik)); } catch (e) { hatalar.push({ dosya: x.ad, hata: /XML:|e-Fatura/.test(e.message) ? e.message : 'XML okunamadı.' }); continue; }
        // Belge geneli KDV dökümü yoksa satırlardan
        const dokum = f.kdvDokum.length ? f.kdvDokum
          : [...f.satirlar.reduce((m, s) => { const y = m.get(s.kdv_orani) || { oran: s.kdv_orani, matrah: 0, kdv: 0 }; y.matrah += s.tutar; y.kdv += s.tutar * s.kdv_orani / 100; return m.set(s.kdv_orani, y); }, new Map()).values()]
            .map((o) => ({ oran: o.oran, matrah: r2(o.matrah), kdv: r2(o.kdv) }));
        faturalar.push({
          dosya: x.ad, no: f.no, ettn: f.ettn, tarih: f.tarih, tip: f.tip, profil: f.profil, doviz: f.doviz, kur: f.kur,
          satici: f.tedarikci?.unvan || '', satici_vkn: (f.tedarikci?.vkn || f.tedarikci?.tckn || '').replace(/\D/g, ''),
          alici: f.alici?.unvan || '', dokum, tevkifat: f.tevkifat || 0,
        });
      }
    }
    return { faturalar, hatalar };
  });

  r.get('/kdv/alis', Y, async (req) => {
    const bas = ayKontrol(req.query.ay, web);
    const oranlar = (await db.query(`
      SELECT s.kdv_orani AS oran, sum(round(s.miktar * s.birim_fiyat, 2)) AS matrah,
             sum(round(round(s.miktar * s.birim_fiyat, 2) * s.kdv_orani / 100, 2)) AS kdv
      FROM alis_faturasi_satirlari s JOIN alis_faturalari a ON a.id = s.fatura_id
      WHERE a.durum = 'onaylandi' AND a.tarih >= $1::date AND a.tarih < ($1::date + interval '1 month')
      GROUP BY s.kdv_orani ORDER BY s.kdv_orani DESC`, [bas])).rows.map((o) => ({ oran: Number(o.oran), matrah: Number(o.matrah), kdv: Number(o.kdv) }));
    const fatura = (await db.query(`SELECT count(*)::int AS n FROM alis_faturalari
      WHERE durum = 'onaylandi' AND tarih >= $1::date AND tarih < ($1::date + interval '1 month')`, [bas])).rows[0].n;
    const taslaklar = (await db.query(`SELECT a.id, a.belge_no, a.tarih, c.unvan FROM alis_faturalari a JOIN cariler c ON c.id = a.cari_id
      WHERE a.durum = 'taslak' AND a.tarih >= $1::date AND a.tarih < ($1::date + interval '1 month') ORDER BY a.tarih, a.id`, [bas])).rows;
    const firma_vkn = ((await db.query("SELECT deger FROM ayarlar WHERE anahtar = 'firma_vergi_no'")).rows[0]?.deger || '').replace(/\D/g, '');
    return {
      fatura, oranlar, taslaklar, firma_vkn,
      matrah: r2(oranlar.reduce((t, o) => t + o.matrah, 0)),
      kdv: r2(oranlar.reduce((t, o) => t + o.kdv, 0)),
    };
  });
};
