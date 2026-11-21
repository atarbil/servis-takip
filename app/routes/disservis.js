'use strict';
// Dış servis: müşteriden alınıp tamire gönderilen cihazlar (sade takip)
const { bugun, zorunlu, metin, tarih, sayi, sec, setIfadesi } = require('../lib/yardim');

const ALANLAR = ['cari_id', 'cihaz', 'marka_model', 'seri_no', 'ariza', 'aksesuar', 'servis_yeri', 'gonderim_tarihi', 'ucret', 'notlar'];
const LISTE = `d.id, d.cari_id, c.unvan, c.telefon AS cari_telefon, d.cihaz, d.marka_model, d.seri_no, d.ariza, d.aksesuar, d.servis_yeri,
  d.gonderim_tarihi, d.gelis_tarihi, d.teslim_tarihi, d.durum, d.ucret, d.notlar, d.olusturma,
  (coalesce(d.gelis_tarihi, current_date) - d.gonderim_tarihi) AS dis_gun,
  CASE WHEN d.durum = 'geldi' THEN current_date - d.gelis_tarihi END AS bekleyen_gun`;

function temizle(a) {
  for (const k of ['cihaz', 'marka_model', 'seri_no', 'ariza', 'aksesuar', 'servis_yeri', 'notlar']) if (k in a) a[k] = metin(a[k]);
  if ('gonderim_tarihi' in a) a.gonderim_tarihi = tarih(a.gonderim_tarihi) || bugun();
  if ('ucret' in a) a.ucret = sayi(a.ucret, 'Ücret');
  return a;
}

module.exports = (r, { db, web, Y }) => {
  r.get('/dis-servis', Y, async (req) => {
    const p = []; const k = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replaceAll('?', '$' + p.length)); };
    if (req.query.cari_id) ekle('d.cari_id = ?', req.query.cari_id);
    if (req.query.durum === 'acik') k.push("d.durum <> 'teslim_edildi'");
    else if (['dis_serviste', 'geldi', 'teslim_edildi'].includes(req.query.durum)) ekle('d.durum = ?', req.query.durum);
    for (const w of String(req.query.q || '').trim().split(/\s+/).filter(Boolean).slice(0, 6)) {
      ekle(`arama_metni(concat_ws(' ', c.unvan, d.cihaz, d.marka_model, d.seri_no, d.ariza, d.servis_yeri)) LIKE '%' || arama_metni(?) || '%'`, w);
    }
    const limit = Math.min(Number(req.query.limit) || 1000, 1000);
    // Açık olanlar: en uzun süredir dışarıda olan önce
    return (await db.query(`SELECT ${LISTE} FROM dis_servis d JOIN cariler c ON c.id = d.cari_id
      ${k.length ? 'WHERE ' + k.join(' AND ') : ''}
      ORDER BY (d.durum = 'teslim_edildi'), (d.durum = 'geldi'), d.gonderim_tarihi, d.id LIMIT ${limit}`, p)).rows;
  });

  r.get('/dis-servis/sayilar', Y, async () => (await db.query(`SELECT
      count(*) FILTER (WHERE durum = 'dis_serviste')::int AS dis_serviste,
      count(*) FILTER (WHERE durum = 'geldi')::int AS geldi,
      count(*) FILTER (WHERE durum = 'dis_serviste' AND current_date - gonderim_tarihi > 14)::int AS geciken
    FROM dis_servis`)).rows[0]);

  r.get('/dis-servis/:id', Y, async (req) => {
    const d = (await db.query(`SELECT ${LISTE}, c.adres AS cari_adres, c.il, c.ilce, k.ad_soyad AS olusturan
      FROM dis_servis d JOIN cariler c ON c.id = d.cari_id LEFT JOIN kullanicilar k ON k.id = d.olusturan_id WHERE d.id = $1`, [req.params.id])).rows[0];
    if (!d) throw web.hata(404, 'Kayıt bulunamadı.');
    return d;
  });

  r.post('/dis-servis', Y, async (req) => {
    zorunlu(req.body, { cari_id: 'Müşteri', cihaz: 'Cihaz', servis_yeri: 'Gönderilen servis' });
    const a = temizle(sec(req.body, ALANLAR));
    return db.islem(req.kullanici.id, async (q) => {
      const ks = Object.keys(a);
      return q.bir(`INSERT INTO dis_servis (${ks.join(', ')}, olusturan_id) VALUES (${ks.map((_, i) => '$' + (i + 1)).join(', ')}, $${ks.length + 1}) RETURNING id`,
        [...ks.map((x) => a[x]), req.kullanici.id]);
    });
  });

  r.put('/dis-servis/:id', Y, async (req) => {
    const a = temizle(sec(req.body, ALANLAR));
    for (const [x, ad] of [['cihaz', 'Cihaz'], ['servis_yeri', 'Gönderilen servis']]) if (x in a && !a[x]) throw web.hata(400, `${ad} boş olamaz.`);
    if (Object.keys(a).length) {
      await db.islem(req.kullanici.id, (q) => { const { ifade, degerler } = setIfadesi(a, 2); return q(`UPDATE dis_servis SET ${ifade} WHERE id = $1`, [req.params.id, ...degerler]); });
    }
    return { tamam: true };
  });

  r.post('/dis-servis/:id/durum', Y, async (req) => {
    await db.islem(req.kullanici.id, (q) => q('SELECT dis_servis_durum($1, $2, $3)', [req.params.id, req.body.durum, tarih(req.body.tarih)]));
    return { tamam: true };
  });
};
