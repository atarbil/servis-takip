'use strict';
// Form tasarımı: belge yazdırma şablonları.
// Çizim tarayıcıda (public/js/form.js) yapılır; sunucu şablonu saklar, sürümler, içe/dışa aktarır.

const fs = require('fs');
const path = require('path');
const { metin, gorselKaydet } = require('../lib/yardim');

const TURLER = ['teklif', 'proforma', 'satis_fisi', 'makbuz', 'teslim', 'dis_servis', 'ekstre'];
const SURUM_SAYISI = 10;
const AYAR_SINIRI = 300 * 1024;

// Metin bloklarında yalnız biçim etiketleri kalsın (asıl beyaz liste tarayıcıda; burada ikinci savunma)
function htmlTemizle(s) {
  return String(s)
    .replace(/<\s*(script|style|iframe|object|embed|link|meta|svg|math)[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, '')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/javascript:/gi, '');
}
function ayarTemizle(a, web) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) throw web.hata(400, 'Şablon ayarı geçersiz.');
  const j = JSON.stringify(a);
  if (j.length > AYAR_SINIRI) throw web.hata(413, 'Şablon çok büyük.');
  const temiz = JSON.parse(j);
  if (temiz.metin && typeof temiz.metin === 'object') {
    for (const k of Object.keys(temiz.metin)) if (typeof temiz.metin[k] === 'string') temiz.metin[k] = htmlTemizle(temiz.metin[k]);
  }
  return temiz;
}
const gorselYollari = (a) => [a?.logo?.dosya, a?.serit?.dosya].filter((x) => typeof x === 'string' && /^sablon\/[\w/.-]+$/.test(x) && !x.includes('..'));

module.exports = (r, { db, web, G, Y, AYAR }) => {
  const getir = async (id) => {
    if (!/^\d{1,15}$/.test(String(id))) throw web.hata(404, 'Şablon bulunamadı.');
    const s = (await db.query('SELECT * FROM belge_sablonlari WHERE id = $1', [id])).rows[0];
    if (!s) throw web.hata(404, 'Şablon bulunamadı.');
    return s;
  };
  const turDogrula = (t) => { if (!TURLER.includes(t)) throw web.hata(400, 'Geçersiz belge türü.'); return t; };

  // Liste: yazdırırken de kullanılır (teknisyen teslim formu yazdırabilir)
  r.get('/sablonlar', G, async (req) => {
    const tur = req.query.tur ? turDogrula(req.query.tur) : null;
    return (await db.query(`SELECT id, tur, ad, ayar, sistem, varsayilan, guncelleme FROM belge_sablonlari
      ${tur ? 'WHERE tur = $1' : ''} ORDER BY tur, sistem DESC, ad`, tur ? [tur] : [])).rows;
  });
  r.get('/sablonlar/sayilar', Y, async () => Object.fromEntries((await db.query(
    'SELECT tur, count(*)::int AS n FROM belge_sablonlari GROUP BY tur')).rows.map((x) => [x.tur, x.n])));

  // Dışa aktar: kullanıcı şablonları + kullandıkları görseller (başka kuruluma taşınabilsin)
  r.get('/sablonlar/disa-aktar', Y, async () => {
    const liste = (await db.query('SELECT tur, ad, ayar, varsayilan FROM belge_sablonlari WHERE NOT sistem ORDER BY tur, ad')).rows;
    const gorseller = {};
    for (const s of liste) {
      for (const y of gorselYollari(s.ayar)) {
        try {
          const v = fs.readFileSync(path.join(AYAR.dosyaKlasor, y));
          const uz = path.extname(y).slice(1).replace('jpg', 'jpeg');
          gorseller[y] = `data:image/${uz};base64,${v.toString('base64')}`;
        } catch { /* dosya yoksa atla */ }
      }
    }
    return { program: 'servis-takip', surum: 1, tarih: new Date().toISOString(), sablonlar: liste, gorseller };
  });

  r.get('/sablonlar/:id', G, async (req) => getir(req.params.id));

  r.post('/sablonlar', Y, async (req) => {
    const tur = turDogrula(req.body.tur);
    const ad = metin(req.body.ad)?.slice(0, 60) || 'Yeni şablon';
    const ayar = ayarTemizle(req.body.ayar || {}, web);
    return db.islem(req.kullanici.id, async (q) => q.bir(`INSERT INTO belge_sablonlari (tur, ad, ayar, olusturan_id)
      VALUES ($1, $2, $3, $4) RETURNING *`, [tur, ad, JSON.stringify(ayar), req.kullanici.id]));
  });

  r.put('/sablonlar/:id', Y, async (req) => {
    const s = await getir(req.params.id);
    if (s.sistem) throw web.hata(403, 'Standart şablon değiştirilemez. Kopyalayıp kopyasını düzenleyin.');
    const ad = req.body.ad !== undefined ? (metin(req.body.ad)?.slice(0, 60) || s.ad) : s.ad;
    const ayar = req.body.ayar !== undefined ? ayarTemizle(req.body.ayar, web) : s.ayar;
    return db.islem(req.kullanici.id, async (q) => {
      // önceki hali sürüm olarak sakla, en fazla 10
      await q('INSERT INTO belge_sablon_surumleri (sablon_id, ad, ayar, kullanici_id) VALUES ($1, $2, $3, $4)',
        [s.id, s.ad, JSON.stringify(s.ayar), req.kullanici.id]);
      await q(`DELETE FROM belge_sablon_surumleri WHERE sablon_id = $1 AND id NOT IN (
        SELECT id FROM belge_sablon_surumleri WHERE sablon_id = $1 ORDER BY zaman DESC, id DESC LIMIT ${SURUM_SAYISI})`, [s.id]);
      return q.bir(`UPDATE belge_sablonlari SET ad = $2, ayar = $3, guncelleme = now() WHERE id = $1 RETURNING *`,
        [s.id, ad, JSON.stringify(ayar)]);
    });
  });

  r.delete('/sablonlar/:id', Y, async (req) => {
    const s = await getir(req.params.id);
    if (s.sistem) throw web.hata(403, 'Standart şablon silinemez.');
    await db.islem(req.kullanici.id, async (q) => {
      await q('DELETE FROM belge_sablonlari WHERE id = $1', [s.id]);
      // varsayılan silindiyse Standart varsayılan olur
      if (s.varsayilan) await q('UPDATE belge_sablonlari SET varsayilan = true WHERE tur = $1 AND sistem', [s.tur]);
    });
    return { tamam: true };
  });

  r.post('/sablonlar/:id/varsayilan', Y, async (req) => {
    const s = await getir(req.params.id);
    await db.islem(req.kullanici.id, async (q) => {
      await q('UPDATE belge_sablonlari SET varsayilan = false WHERE tur = $1 AND varsayilan', [s.tur]);
      await q('UPDATE belge_sablonlari SET varsayilan = true WHERE id = $1', [s.id]);
    });
    return { tamam: true };
  });

  r.get('/sablonlar/:id/surumler', Y, async (req) => (await db.query(`
    SELECT v.id, v.ad, v.zaman, k.ad_soyad FROM belge_sablon_surumleri v LEFT JOIN kullanicilar k ON k.id = v.kullanici_id
    WHERE v.sablon_id = $1 ORDER BY v.zaman DESC, v.id DESC`, [req.params.id])).rows);
  r.get('/sablonlar/:id/surumler/:sid', Y, async (req) => {
    const v = (await db.query('SELECT * FROM belge_sablon_surumleri WHERE id = $1 AND sablon_id = $2', [req.params.sid, req.params.id])).rows[0];
    if (!v) throw web.hata(404, 'Sürüm bulunamadı.');
    return v;
  });

  // Şablona özel görsel (logo / antet şeridi)
  r.post('/sablonlar/gorsel', Y, async (req) => ({ yol: gorselKaydet(AYAR.dosyaKlasor, req.body.veri, 'sablon') }));

  r.post('/sablonlar/ice-aktar', Y, async (req) => {
    const b = req.body || {};
    if (b.program !== 'servis-takip' || !Array.isArray(b.sablonlar)) throw web.hata(400, 'Bu dosya bir şablon dışa aktarımı değil.');
    if (b.sablonlar.length > 200) throw web.hata(400, 'Çok fazla şablon.');
    const yeniYol = {};
    for (const [eski, veri] of Object.entries(b.gorseller || {})) {
      try { yeniYol[eski] = gorselKaydet(AYAR.dosyaKlasor, veri, 'sablon'); } catch { /* geçersiz görsel atlanır */ }
    }
    let n = 0;
    await db.islem(req.kullanici.id, async (q) => {
      for (const s of b.sablonlar) {
        if (!TURLER.includes(s?.tur)) continue;
        const ayar = ayarTemizle(s.ayar || {}, web);
        for (const k of ['logo', 'serit']) if (ayar[k]?.dosya) ayar[k].dosya = yeniYol[ayar[k].dosya] || null;
        await q('INSERT INTO belge_sablonlari (tur, ad, ayar, olusturan_id) VALUES ($1, $2, $3, $4)',
          [s.tur, (metin(s.ad) || 'İçe aktarılan').slice(0, 60), JSON.stringify(ayar), req.kullanici.id]);
        n++;
      }
    });
    return { eklenen: n };
  });
};
