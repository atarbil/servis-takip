'use strict';
// Müşteri envanteri: kurumda hangi cihaz var. Erişim bilgisi (şifre vb.) sadece yöneticiye.
const { zorunlu, metin, tarih, sec, setIfadesi } = require('../lib/yardim');

const ALANLAR = ['cari_id', 'tur', 'marka', 'model', 'seri_no', 'konum', 'ip_adresi', 'kurulum_tarihi', 'garanti_bitis',
  'notlar', 'erisim_bilgisi', 'durum', 'urun_id', 'kaynak_is_id'];
const TEKNISYEN_ALANLAR = ['tur', 'marka', 'model', 'seri_no', 'konum', 'ip_adresi', 'notlar'];
const VARSAYILAN_TURLER = ['IP Kamera', 'Analog Kamera', 'NVR', 'DVR', 'Switch / PoE', 'Modem / Router', 'Access Point', 'Bilgisayar',
  'Dizüstü Bilgisayar', 'Sunucu', 'Yazıcı', 'Fotokopi', 'POS / Yazar kasa', 'Barkod okuyucu', 'Kartlı geçiş', 'Alarm paneli', 'UPS', 'Monitör / TV'];

// Teknisyen ve listeler için erişim bilgisi gizlenir, sadece "var mı" bilgisi gider
const LISTE_ALANLARI = `e.id, e.cari_id, c.unvan, e.tur, e.marka, e.model, e.seri_no, e.konum, e.ip_adresi, e.kurulum_tarihi, e.garanti_bitis,
  e.notlar, e.durum, e.urun_id, e.kaynak_is_id, (coalesce(e.erisim_bilgisi, '') <> '') AS erisim_var, e.olusturma, e.guncelleme,
  CASE WHEN e.garanti_bitis IS NULL THEN NULL ELSE e.garanti_bitis - current_date END AS garanti_kalan_gun`;

function temizle(a) {
  for (const k of ['kurulum_tarihi', 'garanti_bitis']) if (k in a) a[k] = tarih(a[k]);
  for (const k of ['tur', 'marka', 'model', 'seri_no', 'konum', 'ip_adresi', 'notlar', 'erisim_bilgisi']) if (k in a) a[k] = metin(a[k]);
  if ('durum' in a && !['aktif', 'arizali', 'kaldirildi'].includes(a.durum)) delete a.durum;
  return a;
}

module.exports = (r, { db, web, G, Y }) => {
  r.get('/envanter-turleri', G, async () => {
    const kayitli = (await db.query('SELECT DISTINCT tur FROM envanter ORDER BY 1')).rows.map((x) => x.tur);
    return [...new Set([...VARSAYILAN_TURLER, ...kayitli])].sort((a, b) => a.localeCompare(b, 'tr'));
  });

  r.get('/envanter', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.cari_id) ekle('e.cari_id = ?', req.query.cari_id);
    if (req.query.tur) ekle('e.tur = ?', req.query.tur);
    if (req.query.durum) ekle('e.durum = ?', req.query.durum); else if (req.query.tumu !== '1') k.push("e.durum <> 'kaldirildi'");
    if (req.query.garanti === 'bitmis') k.push('e.garanti_bitis < current_date');
    if (req.query.garanti === '30gun') k.push("e.garanti_bitis BETWEEN current_date AND current_date + 30");
    if (req.query.garanti === 'devam') k.push('e.garanti_bitis >= current_date');
    if (req.query.q) {
      const kelimeler = String(req.query.q).trim().split(/\s+/).slice(0, 6);
      for (const w of kelimeler) {
        ekle(`arama_metni(concat_ws(' ', e.tur, e.marka, e.model, e.seri_no, e.konum, e.ip_adresi, e.notlar, c.unvan)) LIKE '%' || arama_metni(?) || '%'`, w);
      }
    }
    return (await db.query(`SELECT ${LISTE_ALANLARI} FROM envanter e JOIN cariler c ON c.id = e.cari_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''} ORDER BY c.unvan, e.tur, e.konum NULLS LAST, e.id LIMIT 2000`, p)).rows;
  });

  r.get('/envanter/:id', Y, async (req) => {
    const e = (await db.query(`SELECT e.*, c.unvan, u.ad AS urun_ad, ki.baslik AS kaynak_is_baslik,
        CASE WHEN e.garanti_bitis IS NULL THEN NULL ELSE e.garanti_bitis - current_date END AS garanti_kalan_gun
      FROM envanter e JOIN cariler c ON c.id = e.cari_id LEFT JOIN urunler u ON u.id = e.urun_id LEFT JOIN isler ki ON ki.id = e.kaynak_is_id
      WHERE e.id = $1`, [req.params.id])).rows[0];
    if (!e) throw web.hata(404, 'Kayıt bulunamadı.');
    e.isler = (await db.query(`SELECT id, baslik, durum, plan_baslangic, olusturma FROM isler WHERE envanter_id = $1 ORDER BY id DESC LIMIT 50`, [e.id])).rows;
    return e;
  });

  r.post('/envanter', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Cari', tur: 'Cihaz türü' });
    const a = temizle(sec(req.body, ALANLAR));
    return db.islem(req.kullanici.id, async (q) => {
      const anahtarlar = Object.keys(a);
      return q.bir(`INSERT INTO envanter (${anahtarlar.join(', ')}, olusturan_id) VALUES (${anahtarlar.map((_, i) => '$' + (i + 1)).join(', ')}, $${anahtarlar.length + 1}) RETURNING id`,
        [...anahtarlar.map((x) => a[x]), req.kullanici.id]);
    });
  });

  r.put('/envanter/:id', Y, async (req) => {
    const a = temizle(sec(req.body, ALANLAR));
    if ('tur' in a && !a.tur) throw web.hata(400, 'Cihaz türü boş olamaz.');
    if (!Object.keys(a).length) return { tamam: true };
    await db.islem(req.kullanici.id, (q) => { const { ifade, degerler } = setIfadesi(a, 2); return q(`UPDATE envanter SET ${ifade} WHERE id = $1`, [req.params.id, ...degerler]); });
    return { tamam: true };
  });

  // Saha: işin müşterisinin envanteri (teknisyen erişim bilgisini görmez)
  async function isErisim(req, isId) {
    const is = (await db.query('SELECT id, cari_id, ekip_id, durum FROM isler WHERE id = $1', [isId])).rows[0];
    if (!is) throw web.hata(404, 'İş bulunamadı.');
    if (req.kullanici.rol !== 'yonetici' && (!req.kullanici.ekip_id || is.ekip_id !== req.kullanici.ekip_id)) throw web.hata(403, 'Bu iş sizin ekibinize ait değil.');
    return is;
  }

  r.get('/isler/:id/envanter', G, async (req) => {
    const is = await isErisim(req, req.params.id);
    if (!is.cari_id) return [];
    return (await db.query(`SELECT ${LISTE_ALANLARI} FROM envanter e JOIN cariler c ON c.id = e.cari_id
      WHERE e.cari_id = $1 AND e.durum <> 'kaldirildi' ORDER BY e.tur, e.konum NULLS LAST, e.id`, [is.cari_id])).rows;
  });

  // Teknisyen sahada kurduğu cihazı müşterinin envanterine ekler
  r.post('/isler/:id/envanter', G, async (req) => {
    const is = await isErisim(req, req.params.id);
    if (!is.cari_id) throw web.hata(400, 'Bu işe bağlı müşteri yok. Yöneticiye bildirin.');
    zorunlu(req.body, { tur: 'Cihaz türü' });
    const izinli = req.kullanici.rol === 'yonetici' ? ALANLAR : TEKNISYEN_ALANLAR;
    const a = temizle(sec(req.body, izinli));
    Object.assign(a, { cari_id: is.cari_id, kaynak_is_id: is.id, kurulum_tarihi: a.kurulum_tarihi || new Date().toISOString().slice(0, 10) });
    return db.islem(req.kullanici.id, async (q) => {
      const anahtarlar = Object.keys(a);
      const e = await q.bir(`INSERT INTO envanter (${anahtarlar.join(', ')}, olusturan_id) VALUES (${anahtarlar.map((_, i) => '$' + (i + 1)).join(', ')}, $${anahtarlar.length + 1}) RETURNING id`,
        [...anahtarlar.map((x) => a[x]), req.kullanici.id]);
      if (req.body.bu_ise_bagla) await q('UPDATE isler SET envanter_id = $2 WHERE id = $1 AND envanter_id IS NULL', [is.id, e.id]);
      return e;
    });
  });
};
