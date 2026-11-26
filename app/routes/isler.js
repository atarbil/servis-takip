'use strict';
const { kurGetir } = require('../lib/kur');
const { zorunlu, metin, sayi, pozitif, gorselKaydet, sec, setIfadesi } = require('../lib/yardim');
const { hizliIsEkle } = require('../lib/hizliis');

// Pencereden girilen hizmet / işçilik / malzeme satırlarını fişin sonuna ekler (malzeme fiş onayında stoktan düşer)
async function fisSatirlariEkle(q, fisId, satirlar) {
  let sira = Number((await q.bir('SELECT coalesce(max(sira), -1) + 1 AS s FROM satis_fisi_satirlari WHERE fis_id = $1', [fisId])).s);
  for (const s of satirlar) {
    // Her kalem stok kartına bağlı olmalı (ürün ya da hizmet kartı)
    const urun = s.urun_id ? await q.bir('SELECT id, ad, birim, kdv_orani, onerilen_satis, tur FROM urunler WHERE id = $1', [s.urun_id]) : null;
    const stoksuz = !urun && ['iscilik', 'egitim', 'hizmet'].includes(s.tip) && metin(s.aciklama);
    if (!urun && !stoksuz) throw require('../lib/web').hata(400, `"${metin(s.aciklama) || 'Boş satır'}" bir stok kartına bağlı değil. Listeden ürün seçin ya da yeni stok kartı açın.`, 'KART_YOK');
    const tip = stoksuz ? s.tip : urun.tur === 'hizmet' ? 'hizmet' : 'urun';
    const fiyat = sayi(s.birim_fiyat, 'Fiyat');
    await q(`INSERT INTO satis_fisi_satirlari (fis_id, sira, tip, urun_id, aciklama, miktar, birim, birim_fiyat, iskonto_orani, kdv_orani, birim_maliyet, stoktan_dus)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9, 0, true)`,
    [fisId, sira++, tip, urun?.id || null, urun ? urun.ad : metin(s.aciklama), sayi(s.miktar, 'Miktar') || 1,
      metin(s.birim) || urun?.birim || (tip === 'iscilik' || tip === 'egitim' ? 'saat' : 'adet'),
      fiyat ?? Number(urun?.onerilen_satis || 0),
      sayi(s.kdv_orani, 'KDV') ?? (urun ? Number(urun.kdv_orani) : 20)]);
  }
}
const doluSatirlar = (l) => (Array.isArray(l) ? l.filter((s) => s && (s.urun_id || metin(s.aciklama))) : []);

module.exports = (r, { db, web, AYAR, G, Y, telegram }) => {
  const yon = (req) => ['yonetici', 'muhasebe'].includes(req.kullanici.rol);

  // Teknisyen sadece kendi ekibinin işlerini görebilir ve sadece planlı/sahadaki işte işlem yapabilir
  async function isErisim(req, id, islemIcin = false) {
    const is = (await db.query('SELECT id, ekip_id, durum FROM isler WHERE id = $1', [id])).rows[0];
    if (!is) throw web.hata(404, 'İş bulunamadı.');
    if (yon(req)) return is;
    // Havuzdaki işi her teknisyen görebilir (işlem yapamaz; "ben alıyorum" ayrı)
    if (!islemIcin && is.durum === 'havuz') return is;
    if (!req.kullanici.ekip_id || is.ekip_id !== req.kullanici.ekip_id) throw web.hata(403, 'Bu iş sizin ekibinize ait değil.');
    if (islemIcin && !['planlandi', 'sahada'].includes(is.durum)) throw web.hata(400, 'Bu iş üzerinde artık işlem yapılamaz.');
    return is;
  }

  const LISTE_SQL = `
    SELECT i.id, i.baslik, i.durum, i.oncelik, i.adres, i.iletisim_ad, i.iletisim_tel, i.plan_baslangic, i.plan_bitis,
           i.ekip_id, e.ad AS ekip_ad, e.renk AS ekip_renk, i.cari_id, c.unvan AS cari_unvan, c.telefon AS cari_telefon,
           i.olusturma, i.bitis_zamani, i.ham_mesaj
    FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id LEFT JOIN ekipler e ON e.id = i.ekip_id`;

  // ---------- Listeler ----------
  r.get('/isler', Y, async (req) => {
    const k = []; const p = [];
    const ekle = (sql, v) => { p.push(v); k.push(sql.replace('?', '$' + p.length)); };
    if (req.query.durum) ekle('i.durum = ANY(string_to_array(?, \',\')::is_durum[])', req.query.durum);
    if (req.query.cari_id) ekle('i.cari_id = ?', req.query.cari_id);
    if (req.query.ekip_id) ekle('i.ekip_id = ?', req.query.ekip_id);
    if (req.query.bas) ekle('coalesce(i.plan_baslangic, i.olusturma) >= ?::date', req.query.bas);
    if (req.query.bit) ekle('coalesce(i.plan_baslangic, i.olusturma) < ?::date + 1', req.query.bit);
    if (req.query.q) {
      p.push(req.query.q); const n = '$' + p.length;
      k.push(`(i.baslik ILIKE '%' || ${n} || '%' OR c.unvan ILIKE '%' || ${n} || '%' OR i.adres ILIKE '%' || ${n} || '%' OR i.id::text = ${n})`);
    }
    const sql = `${LISTE_SQL} ${k.length ? 'WHERE ' + k.join(' AND ') : ''}
      ORDER BY coalesce(i.plan_baslangic, i.olusturma) DESC LIMIT ${Math.min(Number(req.query.limit) || 200, 1000)}`;
    return (await db.query(sql, p)).rows;
  });

  // Havuz: yönetici, muhasebe ve teknisyen görür
  r.get('/havuz', G, async () => (await db.query(`
    SELECT h.*, extract(epoch FROM h.bekleme)::int AS bekleme_sn FROM v_is_havuzu h`)).rows);

  // Teknisyen ana ekranı: ekibin planlı/sahadaki işleri + bugün tamamlananlar
  r.get('/islerim', G, async (req) => {
    const ekip = yon(req) ? (req.query.ekip_id || null) : req.kullanici.ekip_id;
    if (!ekip && !yon(req)) return [];
    return (await db.query(`${LISTE_SQL}
      WHERE ($1::bigint IS NULL OR i.ekip_id = $1)
        AND (i.durum IN ('planlandi', 'sahada')
             OR (i.durum IN ('tamamlandi', 'fis_kesildi') AND i.bitis_zamani >= current_date))
      ORDER BY (i.durum = 'sahada') DESC, i.plan_baslangic`, [ekip])).rows;
  });

  // ---------- Detay ----------
  r.get('/isler/:id', G, async (req) => {
    await isErisim(req, req.params.id);
    const id = req.params.id;
    const is = (await db.query(`
      SELECT i.*, c.unvan AS cari_unvan, c.telefon AS cari_telefon, c.adres AS cari_adres, c.yetkili AS cari_yetkili,
             e.ad AS ekip_ad, e.renk AS ekip_renk, ko.ad_soyad AS olusturan,
             CASE WHEN ev.id IS NOT NULL THEN json_build_object('id', ev.id, 'tur', ev.tur, 'marka', ev.marka, 'model', ev.model, 'seri_no', ev.seri_no,
               'konum', ev.konum, 'ip_adresi', ev.ip_adresi, 'garanti_bitis', ev.garanti_bitis) END AS cihaz
      FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id LEFT JOIN ekipler e ON e.id = i.ekip_id
      LEFT JOIN envanter ev ON ev.id = i.envanter_id
      LEFT JOIN kullanicilar ko ON ko.id = i.olusturan_id WHERE i.id = $1`, [id])).rows[0];
    const maliyetAlani = yon(req) ? ', m.birim_maliyet, round(m.miktar * m.birim_maliyet, 2) AS tutar' : '';
    const [gecmis, malzemeler, fotolar, teslim] = await Promise.all([
      db.query(`SELECT g.zaman, g.eski_durum, g.yeni_durum, g.aciklama, k.ad_soyad
                FROM is_gecmisi g LEFT JOIN kullanicilar k ON k.id = g.kullanici_id WHERE g.is_id = $1 ORDER BY g.zaman`, [id]),
      db.query(`SELECT m.id, m.urun_id, u.ad, u.kod, u.birim, m.miktar, m.sahada_eklendi, m.barkodla_eklendi, u.onay_bekliyor,
                       m.zaman, k.ad_soyad AS ekleyen ${maliyetAlani}
                FROM is_malzemeleri m JOIN urunler u ON u.id = m.urun_id LEFT JOIN kullanicilar k ON k.id = m.ekleyen_id
                WHERE m.is_id = $1 ORDER BY m.zaman`, [id]),
      db.query(`SELECT f.id, f.dosya_yolu, f.aciklama, f.zaman, k.ad_soyad FROM is_fotograflari f
                LEFT JOIN kullanicilar k ON k.id = f.ekleyen_id WHERE f.is_id = $1 ORDER BY f.zaman`, [id]),
      db.query(`SELECT t.*, k.ad_soyad AS teknisyen FROM teslim_onaylari t LEFT JOIN kullanicilar k ON k.id = t.teknisyen_id
                WHERE t.is_id = $1`, [id]),
    ]);
    const sonuc = { ...is, gecmis: gecmis.rows, malzemeler: malzemeler.rows, fotograflar: fotolar.rows, teslim: teslim.rows[0] || null };
    if (yon(req)) {
      sonuc.fisler = (await db.query(`SELECT id, fis_no, durum, genel_toplam, tarih FROM satis_fisleri WHERE is_id = $1 ORDER BY id`, [id])).rows;
      sonuc.karlilik = (await db.query('SELECT malzeme_maliyeti, satis_kdv_haric, kar, kar_orani, maliyetsiz_kalem FROM v_is_karlilik WHERE is_id = $1', [id])).rows[0];
    } else {
      delete sonuc.ham_mesaj;
    }
    return sonuc;
  });

  // ---------- Oluşturma ----------
  r.post('/isler', Y, async (req) => {
    const b = req.body;
    zorunlu(b, { baslik: 'İş başlığı' });
    if (b.plan_baslangic && !b.ekip_id) throw web.hata(400, 'Takvime eklemek için ekip seçin.');
    return db.islem(req.kullanici.id, async (q) => {
      const { id } = await q.bir(`SELECT is_olustur($1, $2, $3, $4, $5, $6, $7::smallint, $8, $9, $10, $11) AS id`, [
        metin(b.baslik), metin(b.ham_mesaj), b.cari_id || null, metin(b.adres), metin(b.iletisim_ad), metin(b.iletisim_tel),
        b.oncelik || 2, b.plan_baslangic || null, b.plan_bitis || null, b.ekip_id || null, metin(b.aciklama)]);
      return { id };
    });
  });

  // Telefonla gelen işi tek mesajla havuza ekleme: telefon numarasından müşteri otomatik bulunur
  // İşi tanımlarken ekibe verilecek malzeme de eklenebilir (stoktan düşer; işte "verildi" olarak görünür)
  r.post('/isler/hizli', Y, async (req) => {
    const mesaj = metin(req.body.mesaj);
    if (!mesaj) throw web.hata(400, 'Mesaj boş olamaz.');
    const malzemeler = (Array.isArray(req.body.malzemeler) ? req.body.malzemeler : []).filter((m) => m && m.urun_id);
    return db.islem(req.kullanici.id, async (q) => {
      const sonuc = await hizliIsEkle(db, req.kullanici.id, mesaj, {
        oncelik: Number(req.body.oncelik) || undefined, planBaslangic: req.body.plan_baslangic || null, ekipId: req.body.ekip_id || null,
        cariId: Number(req.body.cari_id) || null, q,
      });
      for (const m of malzemeler) await q('SELECT is_malzeme_ekle($1, $2, $3, false, false)', [sonuc.id, Number(m.urun_id), pozitif(m.miktar ?? 1, 'Miktar')]);
      return { ...sonuc, malzeme: malzemeler.length };
    });
  });

  // Teknisyen iş ekler: havuza düşer (yöneticiye Telegram bildirimi); "Bu işi ben yapıyorum" → bugün kendi ekibine planlanır
  r.post('/isler/teknisyen', G, async (req) => {
    if (req.kullanici.rol !== 'teknisyen') throw web.hata(403, 'Bu işlem teknisyenler içindir.');
    const mesaj = metin(req.body.mesaj);
    if (!mesaj) throw web.hata(400, 'Ne istendiğini yazın.');
    const ben = !!req.body.ben;
    if (ben && !req.kullanici.ekip_id) throw web.hata(400, 'Hesabınız bir ekibe bağlı değil; iş havuza eklensin.');
    const sonuc = await hizliIsEkle(db, req.kullanici.id, mesaj, {
      oncelik: Number(req.body.oncelik) || undefined, kaynak: 'teknisyen',
      planBaslangic: ben ? new Date().toISOString() : null, ekipId: ben ? req.kullanici.ekip_id : null,
    });
    telegram?.bildirArkada('yeni_is', async () => `🆕 <b>${req.kullanici.ad_soyad}</b> iş ekledi${ben ? ' (kendisi yapıyor)' : ' — havuzda'}:\n${mesaj}${sonuc.cari ? `\nMüşteri: ${sonuc.cari.unvan}` : ''}`);
    return { ...sonuc, ben };
  });

  // "İşi ben yaptım": iş tamamlandı olarak açılır, verilen hizmet ve malzemelerle o cariye taslak satış fişi kesilir.
  // Fiyatlar fişte yazılır; fiş onaylanınca cari borçlanır, malzeme stoktan düşer (mevcut kurallar).
  r.post('/isler/ofis', Y, async (req) => {
    const b = req.body || {};
    const mesaj = metin(b.mesaj);
    if (!mesaj) throw web.hata(400, 'İşin açıklamasını yazın.');
    const cariId = Number(b.cari_id);
    if (!cariId) throw web.hata(400, 'Cari seçin.');
    const satirlar = doluSatirlar(b.satirlar);
    if (!satirlar.length) throw web.hata(400, 'En az bir hizmet veya malzeme satırı girin.');
    const kur = await kurGetir().catch(() => null);
    return db.islem(req.kullanici.id, async (q) => {
      const is = await hizliIsEkle(db, req.kullanici.id, mesaj, { oncelik: Number(b.oncelik) || undefined, cariId, q });
      await q("SELECT set_config('app.gecmis_notu', 'Ofiste tamamlandı (hizmet/malzeme girildi)', true)");
      await q(`UPDATE isler SET durum = 'tamamlandi', plan_baslangic = coalesce(plan_baslangic, now() - interval '1 minute'), plan_bitis = NULL,
                 baslama_zamani = coalesce(baslama_zamani, now()), bitis_zamani = now(),
                 teknisyen_notu = coalesce(teknisyen_notu, $2) WHERE id = $1`, [is.id, metin(b.not)]);
      await q("SELECT set_config('app.gecmis_notu', '', true)");
      const f = await q.bir(`INSERT INTO satis_fisleri (cari_id, is_id, tarih, aciklama, olusturan_id)
        VALUES ($1, $2, current_date, $3, $4) RETURNING id`, [cariId, is.id, is.baslik, req.kullanici.id]);
      await fisSatirlariEkle(q, f.id, satirlar);
      // Dövizli ürünler (fiyatı elle girilmediyse) günün kuruyla TL'ye çevrilir
      await q('SELECT fis_doviz_uygula($1, $2, $3)', [f.id, kur?.usd?.satis || null, kur?.eur?.satis || null]);
      return { is_id: is.id, fis_id: f.id, cari: is.cari, baslik: is.baslik };
    });
  });

  r.put('/isler/:id', Y, async (req) => {
    const alanlar = sec(req.body, ['baslik', 'aciklama', 'adres', 'iletisim_ad', 'iletisim_tel', 'oncelik', 'cari_id', 'ham_mesaj', 'plan_bitis', 'teknisyen_notu', 'envanter_id']);
    if ('baslik' in alanlar && !metin(alanlar.baslik)) throw web.hata(400, 'İş başlığı boş olamaz.');
    if (!Object.keys(alanlar).length) return { tamam: true };
    await db.islem(req.kullanici.id, async (q) => {
      const { ifade, degerler } = setIfadesi(alanlar, 2);
      const s = await q(`UPDATE isler SET ${ifade} WHERE id = $1 AND durum NOT IN ('fis_kesildi')`, [req.params.id, ...degerler]);
      if (!s.rowCount) throw web.hata(400, 'Fişi kesilmiş iş düzenlenemez.');
    });
    return { tamam: true };
  });

  // ---------- Durum geçişleri ----------
  const fonk = (ad, ...argF) => async (req) => {
    await db.islem(req.kullanici.id, async (q) => {
      const args = [req.params.id, ...argF.map((f) => f(req.body))];
      await q(`SELECT ${ad}(${args.map((_, i) => '$' + (i + 1)).join(', ')})`, args);
    });
    return { tamam: true };
  };

  r.post('/isler/:id/planla', Y, async (req, res) => {
    zorunlu(req.body, { ekip_id: 'Ekip', baslangic: 'Başlangıç' });
    return fonk('is_planla', (b) => b.ekip_id, (b) => b.baslangic, (b) => b.bitis || null)(req, res);
  });
  // Teknisyen havuzdaki işi kendi ekibine alır: hemen (şimdi) planlanır, İşlerim'e düşer
  r.post('/isler/:id/ben-aliyorum', G, async (req) => {
    if (req.kullanici.rol !== 'teknisyen') throw web.hata(403, 'Bu işlem teknisyenler içindir.');
    if (!req.kullanici.ekip_id) throw web.hata(400, 'Hesabınız bir ekibe bağlı değil.');
    const is = await db.islem(req.kullanici.id, async (q) => {
      const x = await q.bir('SELECT id, baslik, durum FROM isler WHERE id = $1 FOR UPDATE', [req.params.id]);
      if (!x) throw web.hata(404, 'İş bulunamadı.');
      if (x.durum !== 'havuz') throw web.hata(409, 'Bu iş artık havuzda değil (başka biri almış ya da planlanmış olabilir).');
      await q("SELECT set_config('app.gecmis_notu', $1, true)", [`${req.kullanici.ad_soyad} havuzdan aldı`]);
      await q('SELECT is_planla($1, $2, now(), NULL)', [x.id, req.kullanici.ekip_id]);
      await q("SELECT set_config('app.gecmis_notu', '', true)");
      return x;
    });
    telegram?.bildirArkada('yeni_is', async () => `🙋 <b>${req.kullanici.ad_soyad}</b> havuzdaki işi aldı:\n#${is.id} ${is.baslik}`);
    return { tamam: true, id: is.id };
  });
  r.post('/isler/:id/havuza-al', Y, fonk('is_havuza_al', (b) => metin(b.neden)));
  r.post('/isler/:id/iptal', Y, async (req, res) => {
    zorunlu(req.body, { neden: 'İptal nedeni' });
    return fonk('is_iptal', (b) => metin(b.neden))(req, res);
  });
  r.post('/isler/:id/baslat', G, async (req, res) => { await isErisim(req, req.params.id, true); return fonk('is_baslat')(req, res); });
  r.post('/isler/:id/tamamla', G, async (req, res) => {
    await isErisim(req, req.params.id, true);
    const sonuc = await fonk('is_tamamla', (b) => metin(b.not))(req, res);
    telegram?.bildirArkada('is_tamamlandi', () => telegram.isTamamlandiMetni(req.params.id));
    return sonuc;
  });

  // ---------- Saha: malzeme ----------
  r.post('/isler/:id/malzeme', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    const miktar = pozitif(req.body.miktar ?? 1, 'Miktar');
    return db.islem(req.kullanici.id, async (q) => {
      if (metin(req.body.barkod)) {
        return q.bir('SELECT is_malzeme_ekle_barkod($1, $2, $3) AS id', [is.id, metin(req.body.barkod), miktar]);
      }
      zorunlu(req.body, { urun_id: 'Ürün' });
      // Ofisin eklediği "verildi", teknisyenin eklediği "ilave"
      return q.bir('SELECT is_malzeme_ekle($1, $2, $3, false, $4) AS id', [is.id, req.body.urun_id, miktar, !yon(req)]);
    });
  });

  r.post('/isler/:id/tanimsiz-urun', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    zorunlu(req.body, { ad: 'Ürün açıklaması' });
    const miktar = pozitif(req.body.miktar ?? 1, 'Miktar');
    const r2 = await db.islem(req.kullanici.id, (q) => q.bir(`SELECT sahada_urun_tanimla($1, $2, $3, $4, $5) AS id`,
      [is.id, metin(req.body.ad), miktar, metin(req.body.barkod), metin(req.body.not)]));
    telegram?.bildirArkada('urun_onay', async () => {
      const m = (await db.query('SELECT urun_id FROM is_malzemeleri WHERE id = $1', [r2.id])).rows[0];
      return m ? telegram.urunOnayMetni(m.urun_id, is.id) : null;
    });
    return r2;
  });

  r.delete('/malzeme/:id', G, async (req) => {
    const m = (await db.query('SELECT is_id FROM is_malzemeleri WHERE id = $1', [req.params.id])).rows[0];
    if (!m) throw web.hata(404, 'Malzeme bulunamadı.');
    await isErisim(req, m.is_id, !yon(req));
    await db.islem(req.kullanici.id, (q) => q('SELECT is_malzeme_cikar($1)', [req.params.id]));
    return { tamam: true };
  });

  // ---------- Saha: fotoğraf ve teslim onayı ----------
  r.post('/isler/:id/foto', G, async (req) => {
    const is = await isErisim(req, req.params.id, !yon(req));
    const yol = gorselKaydet(AYAR.dosyaKlasor, req.body.veri, 'fotograflar');
    return db.islem(req.kullanici.id, (q) => q.bir(
      'INSERT INTO is_fotograflari (is_id, dosya_yolu, aciklama, ekleyen_id) VALUES ($1, $2, $3, $4) RETURNING id, dosya_yolu',
      [is.id, yol, metin(req.body.aciklama), req.kullanici.id]));
  });

  r.post('/isler/:id/teslim', G, async (req) => {
    const is = await isErisim(req, req.params.id, true);
    if (is.durum !== 'sahada') throw web.hata(400, 'Teslim onayı için önce işi başlatın.');
    zorunlu(req.body, { teslim_alan_ad: 'Teslim alan kişinin adı', imza: 'Müşteri imzası' });
    const yol = gorselKaydet(AYAR.dosyaKlasor, req.body.imza, 'imzalar');
    await db.islem(req.kullanici.id, async (q) => {
      const var_ = await q.bir('SELECT 1 FROM teslim_onaylari WHERE is_id = $1', [is.id]);
      if (var_) throw web.hata(400, 'Bu iş için teslim onayı zaten alınmış.');
      await q(`INSERT INTO teslim_onaylari (is_id, teslim_alan_ad, teslim_alan_tel, imza_dosya, musteri_notu, enlem, boylam, teknisyen_id)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [is.id, metin(req.body.teslim_alan_ad), metin(req.body.teslim_alan_tel), yol, metin(req.body.musteri_notu),
          sayi(req.body.enlem), sayi(req.body.boylam), req.kullanici.id]);
    });
    return { tamam: true };
  });

  // Havuzdaki veya planlı işi ofisten kapatma ("Teslim et / Tamamla"): sahaya gitmeyen malzeme teslimi ya da hizmet + malzeme.
  // İş tamamlandı olur, o cariye taslak fiş açılır (işte sahada eklenmiş malzeme de fişe gelir). İmza isteğe bağlı.
  r.post('/isler/:id/teslim-et', Y, async (req) => {
    const b = req.body || {};
    const is = (await db.query('SELECT id, durum, cari_id, baslik FROM isler WHERE id = $1', [req.params.id])).rows[0];
    if (!is) throw web.hata(404, 'İş bulunamadı.');
    if (!['havuz', 'planlandi', 'sahada'].includes(is.durum)) throw web.hata(400, 'Bu iş zaten tamamlanmış veya iptal edilmiş.');
    const cariId = Number(b.cari_id) || is.cari_id;
    if (!cariId) throw web.hata(400, 'Cari seçin.');
    const satirlar = doluSatirlar(b.satirlar);
    const malzemeVar = (await db.query('SELECT 1 FROM is_malzemeleri WHERE is_id = $1 LIMIT 1', [is.id])).rows.length > 0;
    if (!satirlar.length && !malzemeVar) throw web.hata(400, 'En az bir hizmet veya malzeme satırı girin.');
    const teslimAlan = metin(b.teslim_alan_ad);
    if (b.imza && !teslimAlan) throw web.hata(400, 'İmza için teslim alan kişinin adını yazın.');
    const imzaYol = b.imza ? gorselKaydet(AYAR.dosyaKlasor, b.imza, 'imzalar') : null;
    const kur = await kurGetir().catch(() => null);
    return db.islem(req.kullanici.id, async (q) => {
      if (cariId !== is.cari_id) {
        if (!(await q.bir('SELECT 1 FROM cariler WHERE id = $1', [cariId]))) throw web.hata(400, 'Cari bulunamadı.');
        await q('UPDATE isler SET cari_id = $2 WHERE id = $1', [is.id, cariId]);
      }
      await q("SELECT set_config('app.gecmis_notu', $1, true)", [`Ofisten tamamlandı${teslimAlan ? ' · teslim alan: ' + teslimAlan : ''}`]);
      await q(`UPDATE isler SET durum = 'tamamlandi', plan_baslangic = coalesce(plan_baslangic, now() - interval '1 minute'),
                 baslama_zamani = coalesce(baslama_zamani, now()), bitis_zamani = now(),
                 teknisyen_notu = coalesce(teknisyen_notu, $2) WHERE id = $1`, [is.id, metin(b.not)]);
      await q("SELECT set_config('app.gecmis_notu', '', true)");
      if (imzaYol && !(await q.bir('SELECT 1 FROM teslim_onaylari WHERE is_id = $1', [is.id]))) {
        await q(`INSERT INTO teslim_onaylari (is_id, teslim_alan_ad, imza_dosya, musteri_notu, teknisyen_id) VALUES ($1, $2, $3, $4, $5)`,
          [is.id, teslimAlan, imzaYol, metin(b.not), req.kullanici.id]);
      }
      const f = await q.bir('SELECT satis_fisi_isten_olustur($1) AS id', [is.id]);
      await fisSatirlariEkle(q, f.id, satirlar);
      await q('SELECT fis_doviz_uygula($1, $2, $3)', [f.id, kur?.usd?.satis || null, kur?.eur?.satis || null]);
      return { is_id: is.id, fis_id: f.id, imza: !!imzaYol };
    });
  });

  // ---------- Fiş ----------
  r.post('/isler/:id/fis', Y, async (req) => {
    const kur = await kurGetir().catch(() => null);
    return db.islem(req.kullanici.id, async (q) => {
      const f = await q.bir('SELECT satis_fisi_isten_olustur($1) AS id', [req.params.id]);
      // Dövizli ürünler güncel TCMB satış kuruyla TL'ye çevrilir
      await q('SELECT fis_doviz_uygula($1, $2, $3)', [f.id, kur?.usd?.satis || null, kur?.eur?.satis || null]);
      return f;
    });
  });
};
