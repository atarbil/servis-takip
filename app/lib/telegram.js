'use strict';
// Telegram botu: bağlı yöneticinin yazdığı mesajları havuza iş olarak ekler.
// Uzun yoklama (getUpdates) kullanır; sunucuda dışarıya port açmak gerekmez.
const crypto = require('node:crypto');
const { hizliIsEkle } = require('./hizliis');

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const saat = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const ONCELIK = { 1: '🔴 Acil', 2: 'Normal', 3: 'Düşük' };
const tl = (n) => `${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;
const KOD_HARFLER = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan harfler (0/O, 1/I) yok

class TelegramBot {
  constructor({ token, db, apiUrl, uygulamaUrl, log = console }) {
    this.token = token;
    this.db = db;
    this.apiUrl = (apiUrl || 'https://api.telegram.org').replace(/\/$/, '');
    this.uygulamaUrl = uygulamaUrl ? uygulamaUrl.replace(/\/$/, '') : null;
    this.log = log;
    this.calisiyor = false;
    this.ben = null;            // getMe sonucu
    this.sonHata = null;
    this.denemeler = new Map(); // sohbet -> hatalı bağlama denemeleri
  }

  async api(metod, govde = {}, zamanAsimi = 15000) {
    const r = await fetch(`${this.apiUrl}/bot${this.token}/${metod}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(govde),
      signal: AbortSignal.timeout(zamanAsimi),
    });
    const j = await r.json().catch(() => ({ ok: false, description: `HTTP ${r.status}` }));
    if (!j.ok) { const e = new Error(j.description || 'Telegram hatası'); e.kod = j.error_code; throw e; }
    return j.result;
  }

  gonder(sohbet, metin, ek = {}) {
    return this.api('sendMessage', { chat_id: sohbet, text: metin, parse_mode: 'HTML', disable_web_page_preview: true, ...ek })
      .catch((e) => this.log.error('[telegram] gönderilemedi:', e.message));
  }

  durum() {
    return { calisiyor: this.calisiyor, kullanici_adi: this.ben?.username || null, ad: this.ben?.first_name || null, son_hata: this.sonHata };
  }

  async basla() {
    this.calisiyor = true;
    this.dongu().catch((e) => this.log.error('[telegram] döngü durdu:', e));
    // Sabah planı ve akşam özeti zamanlayıcısı
    this.zamanlayici = setInterval(() => this.zamanKontrol().catch((e) => this.log.error('[telegram] zamanlayıcı:', e.message)),
      Number(process.env.TELEGRAM_ZAMANLAYICI_MS) || 60000);
  }

  durdur() { this.calisiyor = false; clearInterval(this.zamanlayici); }

  // ---------- Bildirimler ----------
  // tur: is_tamamlandi | urun_onay | sabah | aksam — tercihi açık olan bağlı yöneticilere gönderilir
  async bildir(tur, metin) {
    const alicilar = (await this.db.query(`SELECT telegram_id FROM kullanicilar
      WHERE aktif AND rol = 'yonetici' AND telegram_id IS NOT NULL AND coalesce((bildirimler ->> $1)::boolean, true)`, [tur])).rows;
    for (const a of alicilar) await this.gonder(a.telegram_id, metin);
    return alicilar.length;
  }

  // Arka planda gönder, hatası işlemi bozmasın
  bildirArkada(tur, metinFn) {
    Promise.resolve().then(metinFn).then((m) => (m ? this.bildir(tur, m) : 0))
      .catch((e) => this.log.error(`[telegram] ${tur} bildirimi:`, e.message));
  }

  link(yol, metin) { return this.uygulamaUrl ? `<a href="${this.uygulamaUrl}/#/${yol}">${esc(metin)}</a>` : esc(metin); }

  async isTamamlandiMetni(isId) {
    const i = (await this.db.query(`SELECT i.id, i.baslik, c.unvan, e.ad AS ekip, t.teslim_alan_ad,
        (SELECT count(*) FROM is_malzemeleri m WHERE m.is_id = i.id)::int AS malzeme,
        (SELECT round(sum(m.miktar * m.birim_maliyet), 2) FROM is_malzemeleri m WHERE m.is_id = i.id) AS maliyet,
        (SELECT count(*)::int FROM isler WHERE durum = 'tamamlandi') AS bekleyen
      FROM isler i LEFT JOIN cariler c ON c.id = i.cari_id LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN teslim_onaylari t ON t.is_id = i.id
      WHERE i.id = $1`, [isId])).rows[0];
    if (!i) return null;
    return [`✅ <b>İş tamamlandı</b> · #${i.id}`, `<b>${esc(i.baslik)}</b>`,
      i.unvan ? `👤 ${esc(i.unvan)}` : null, i.ekip ? `👷 ${esc(i.ekip)}${i.teslim_alan_ad ? ` · teslim alan: ${esc(i.teslim_alan_ad)}` : ''}` : null,
      `📦 ${i.malzeme} kalem malzeme${i.maliyet ? ` · maliyet ${tl(i.maliyet)}` : ''}`,
      `\n💰 Fiyatlandırma bekliyor (toplam ${i.bekleyen} iş) · ${this.link(`is/${i.id}`, 'İşi aç')}`].filter(Boolean).join('\n');
  }

  async urunOnayMetni(urunId, isId) {
    const u = (await this.db.query(`SELECT u.id, u.ad, u.sahadan_not, k.ad_soyad FROM urunler u LEFT JOIN kullanicilar k ON k.id = u.olusturan_id WHERE u.id = $1`, [urunId])).rows[0];
    if (!u) return null;
    return [`🟠 <b>Sahada tanımsız ürün eklendi</b>`, `<b>${esc(u.ad)}</b>`, u.sahadan_not ? `Not: ${esc(u.sahadan_not)}` : null,
      `${esc(u.ad_soyad || '')} · İş #${isId}`, `\nMaliyet onayı bekliyor · ${this.link(`urun/${u.id}`, 'Ürünü aç')}`].filter(Boolean).join('\n');
  }

  async sabahMetni() {
    const l = (await this.db.query(`SELECT i.id, i.baslik, i.plan_baslangic, e.ad AS ekip, c.unvan
      FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
      WHERE i.plan_baslangic::date = current_date AND i.durum IN ('planlandi', 'sahada') ORDER BY e.ad NULLS LAST, i.plan_baslangic`)).rows;
    const s = (await this.db.query(`SELECT (SELECT count(*)::int FROM isler WHERE durum = 'havuz') AS havuz,
      (SELECT count(*)::int FROM isler WHERE durum = 'tamamlandi') AS fiyat,
      (SELECT count(*)::int FROM isler WHERE durum = 'planlandi' AND plan_baslangic < current_date) AS geciken`)).rows[0];
    const gun = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' });
    const parca = [`☀️ <b>Günaydın! ${gun}</b>`, ''];
    if (!l.length) parca.push('Bugün için planlanmış iş yok.');
    else {
      parca.push(`<b>Bugünün planı (${l.length} iş)</b>`);
      let ekip = null;
      for (const i of l) {
        if (i.ekip !== ekip) { ekip = i.ekip; parca.push(`\n👷 <b>${esc(ekip || 'Ekip atanmamış')}</b>`); }
        parca.push(`  ${saat(i.plan_baslangic)} · #${i.id} ${esc(i.baslik)}${i.unvan ? ` — <i>${esc(i.unvan)}</i>` : ''}`);
      }
    }
    parca.push('', `📥 Havuzda: <b>${s.havuz}</b>  ·  💰 Fiyatlandırma bekleyen: <b>${s.fiyat}</b>${s.geciken ? `  ·  ⚠️ Tarihi geçmiş plan: <b>${s.geciken}</b>` : ''}`);
    return parca.join('\n');
  }

  async aksamMetni() {
    const [biten, tahsilat, fis, s] = await Promise.all([
      this.db.query(`SELECT i.id, i.baslik, e.ad AS ekip, c.unvan FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
        WHERE i.bitis_zamani::date = current_date ORDER BY i.bitis_zamani`),
      this.db.query(`SELECT c.unvan, f.tutar, h.ad AS hesap FROM finans_hareketleri f JOIN cariler c ON c.id = f.cari_id JOIN hesaplar h ON h.id = f.hesap_id
        WHERE f.tip = 'tahsilat' AND NOT f.iptal AND f.tarih = current_date ORDER BY f.id`),
      this.db.query(`SELECT count(*)::int AS adet, coalesce(sum(genel_toplam), 0) AS toplam FROM satis_fisleri WHERE durum = 'onaylandi' AND onay_zamani::date = current_date`),
      this.db.query(`SELECT (SELECT count(*)::int FROM isler WHERE durum = 'tamamlandi') AS fiyat,
        (SELECT count(*)::int FROM isler WHERE durum = 'havuz') AS havuz,
        (SELECT count(*)::int FROM isler WHERE plan_baslangic::date = current_date + 1 AND durum = 'planlandi') AS yarin`),
    ]);
    const b = biten.rows; const t = tahsilat.rows; const ff = fis.rows[0]; const x = s.rows[0];
    const tToplam = t.reduce((a, r) => a + Number(r.tutar), 0);
    const parca = ['🌙 <b>Günün özeti</b>', ''];
    parca.push(`✅ <b>Tamamlanan iş: ${b.length}</b>`);
    for (const i of b.slice(0, 15)) parca.push(`  #${i.id} ${esc(i.baslik)}${i.unvan ? ` — <i>${esc(i.unvan)}</i>` : ''}${i.ekip ? ` (${esc(i.ekip)})` : ''}`);
    parca.push('', `💵 <b>Tahsilat: ${tl(tToplam)}</b>${t.length ? ` (${t.length} adet)` : ''}`);
    for (const r of t.slice(0, 15)) parca.push(`  ${esc(r.unvan)} · ${tl(r.tutar)} · ${esc(r.hesap)}`);
    parca.push('', `🧾 Kesilen fiş: <b>${ff.adet}</b>${ff.adet ? ` · ${tl(ff.toplam)}` : ''}`);
    parca.push(`💰 Fiyatlandırma bekleyen: <b>${x.fiyat}</b>  ·  📥 Havuzda: <b>${x.havuz}</b>  ·  📅 Yarın planlı: <b>${x.yarin}</b>`);
    if (x.fiyat && this.uygulamaUrl) parca.push(`\n${this.link('fiyatlandirma', 'Fiyatlandırma ekranını aç')}`);
    return parca.join('\n');
  }

  // Her dakika: ayarlanan saat geldiyse ve bugün gönderilmediyse sabah/akşam mesajını gönderir
  async zamanKontrol(simdi = new Date()) {
    if (!this.calisiyor || !this.ben) return;
    const yerel = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(simdi);
    const [gun, hm] = yerel.split(' ');
    const a = Object.fromEntries((await this.db.query(`SELECT anahtar, deger FROM ayarlar WHERE anahtar IN
      ('bildirim_sabah_saat', 'bildirim_aksam_saat', 'telegram_sabah_son', 'telegram_aksam_son')`)).rows.map((x) => [x.anahtar, x.deger]));
    for (const [tur, saatAnahtar, sonAnahtar] of [['sabah', 'bildirim_sabah_saat', 'telegram_sabah_son'], ['aksam', 'bildirim_aksam_saat', 'telegram_aksam_son']]) {
      const hedef = a[saatAnahtar];
      if (!hedef || hm < hedef || a[sonAnahtar] === gun) continue;
      // Saat çok geçtiyse (ör. sunucu o saatte kapalıydı) 2 saatten eskiyse gönderme
      const [hh, mm] = hedef.split(':').map(Number); const [sh, sm] = hm.split(':').map(Number);
      await this.db.query("UPDATE ayarlar SET deger = $2 WHERE anahtar = $1", [sonAnahtar, gun]);
      if ((sh * 60 + sm) - (hh * 60 + mm) > 120) continue;
      await this.bildir(tur, tur === 'sabah' ? await this.sabahMetni() : await this.aksamMetni());
    }
  }

  async dongu() {
    let bekleme = 0;
    while (this.calisiyor) {
      try {
        if (!this.ben) {
          this.ben = await this.api('getMe');
          await this.api('setMyCommands', { commands: [
            { command: 'havuz', description: 'Havuzda bekleyen işler' },
            { command: 'bugun', description: 'Bugünkü planlı işler' },
            { command: 'yardim', description: 'Nasıl kullanılır' },
          ] }).catch(() => {});
          this.log.log(`[telegram] @${this.ben.username} çalışıyor`);
        }
        const offset = Number((await this.db.query("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_offset'")).rows[0]?.deger || 0);
        const guncellemeler = await this.api('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] }, 65000);
        for (const g of guncellemeler) {
          try { await this.isle(g); } catch (e) { this.log.error('[telegram] mesaj işlenemedi:', e); }
          await this.db.query("UPDATE ayarlar SET deger = $1 WHERE anahtar = 'telegram_offset'", [String(g.update_id + 1)]);
        }
        bekleme = 0;
        this.sonHata = null;
      } catch (e) {
        if (!this.calisiyor) break;
        this.sonHata = e.message;
        // Geçersiz anahtar: tekrar denemenin anlamı yok, uzun bekle
        bekleme = e.kod === 401 || e.kod === 404 ? 300 : Math.min(60, Math.max(2, bekleme * 2));
        this.log.error(`[telegram] hata: ${e.message} (${bekleme} sn sonra tekrar)`);
        await new Promise((c) => setTimeout(c, bekleme * 1000));
      }
    }
  }

  async kullaniciBul(telegramId) {
    return (await this.db.query(
      'SELECT id, ad_soyad, rol FROM kullanicilar WHERE telegram_id = $1 AND aktif', [telegramId])).rows[0] || null;
  }

  async isle(g) {
    const m = g.message;
    if (!m || !m.from || m.chat?.type !== 'private') return; // sadece birebir sohbet
    const sohbet = m.chat.id;
    let metin = String(m.text || m.caption || '').trim();
    // Rehberden kişi paylaşılırsa ad ve telefon mesaja çevrilir
    if (!metin && m.contact) metin = [m.contact.first_name, m.contact.last_name, m.contact.phone_number].filter(Boolean).join(' ');
    const komut = (metin.match(/^\/(\w+)(?:@\w+)?\s*(.*)$/s) || []).slice(1);

    if (komut[0] === 'baglan') return this.bagla(m, komut[1]);
    const k = await this.kullaniciBul(m.from.id);

    if (komut[0] === 'start' || komut[0] === 'yardim') {
      if (!k) {
        return this.gonder(sohbet, 'Merhaba! Bu bot firmaya özeldir.\n\nHesabınızı bağlamak için programda <b>Ayarlar → Telegram</b> bölümünden kod alıp buraya şöyle yazın:\n<code>/baglan KOD</code>');
      }
      return this.gonder(sohbet, `Merhaba ${esc(k.ad_soyad.split(' ')[0])}! 👋\n\n`
        + '<b>Havuza iş eklemek için</b> mesaj yazmanız yeterli. Örnek:\n'
        + '<i>Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33</i>\n\n'
        + '• Telefon numarası yazarsanız müşteri otomatik bulunur.\n'
        + '• Mesaja <b>acil</b> diye başlarsanız iş acil olarak eklenir.\n'
        + '• Rehberden kişi paylaşırsanız ad ve telefonuyla iş açılır.\n\n'
        + '/havuz – havuzda bekleyenler\n/bugun – bugünkü işler');
    }

    if (!k) return this.gonder(sohbet, 'Bu bot firmaya özeldir. Hesabınız bağlı değil.\nBağlamak için: <code>/baglan KOD</code>');
    if (k.rol !== 'yonetici') return this.gonder(sohbet, 'Havuza iş ekleme yetkiniz yok. Yöneticinize başvurun.');

    if (komut[0] === 'havuz') return this.havuz(sohbet);
    if (komut[0] === 'bugun') return this.bugun(sohbet);
    if (komut[0]) return this.gonder(sohbet, 'Bilinmeyen komut. /yardim yazabilirsiniz.');

    if (!metin) return this.gonder(sohbet, 'Şimdilik sadece yazılı mesajları işe çevirebiliyorum. İşi yazıyla gönderin.');
    if (metin.length < 4) return this.gonder(sohbet, 'Mesaj çok kısa. İşi biraz daha açık yazın.');

    const r = await hizliIsEkle(this.db, k.id, metin, { kaynak: 'telegram' });
    const satirlar = [
      `✅ <b>Havuza eklendi</b> · #${r.id}`,
      `<b>${esc(r.baslik)}</b>`,
      r.cari ? `👤 ${esc(r.cari.unvan)} <i>(telefondan eşleşti)</i>` : (r.telefon ? `📞 ${esc(r.telefon)} <i>(kayıtlı müşteri bulunamadı)</i>` : '👤 Müşteri bağlı değil'),
      r.oncelik === 1 ? '🔴 Acil' : null,
    ].filter(Boolean);
    if (this.uygulamaUrl) satirlar.push(`\n<a href="${this.uygulamaUrl}/#/is/${r.id}">İşi programda aç</a>`);
    return this.gonder(sohbet, satirlar.join('\n'), { reply_to_message_id: m.message_id });
  }

  async bagla(m, kod) {
    const sohbet = m.chat.id;
    const d = this.denemeler.get(sohbet);
    if (d && d.sayi >= 5 && Date.now() - d.ilk < 15 * 60 * 1000) {
      return this.gonder(sohbet, 'Çok fazla hatalı deneme. 15 dakika sonra tekrar deneyin.');
    }
    const temiz = String(kod || '').trim().toUpperCase();
    const kayit = temiz ? (await this.db.query(
      `DELETE FROM telegram_kodlari WHERE kod = $1 AND son_kullanma > now() RETURNING kullanici_id`, [temiz])).rows[0] : null;
    if (!kayit) {
      if (!d || Date.now() - d.ilk > 15 * 60 * 1000) this.denemeler.set(sohbet, { ilk: Date.now(), sayi: 1 }); else d.sayi++;
      return this.gonder(sohbet, 'Kod geçersiz veya süresi dolmuş. Programdan yeni kod alın.\nKullanım: <code>/baglan KOD</code>');
    }
    this.denemeler.delete(sohbet);
    const ad = [m.from.first_name, m.from.last_name].filter(Boolean).join(' ') + (m.from.username ? ` (@${m.from.username})` : '');
    const k = await this.db.islem(kayit.kullanici_id, async (q) => {
      await q('UPDATE kullanicilar SET telegram_id = NULL, telegram_ad = NULL WHERE telegram_id = $1', [m.from.id]);
      await q('UPDATE kullanicilar SET telegram_id = $2, telegram_ad = $3 WHERE id = $1', [kayit.kullanici_id, m.from.id, ad]);
      return q.bir('SELECT ad_soyad FROM kullanicilar WHERE id = $1', [kayit.kullanici_id]);
    });
    return this.gonder(sohbet, `✅ Hesabınız bağlandı: <b>${esc(k.ad_soyad)}</b>\n\nArtık bana yazdığınız her mesaj havuza iş olarak eklenir. Örnek:\n<i>Ahmet Bey Kadıköy 4 kamera görüntü yok 0532 111 22 33</i>`);
  }

  async havuz(sohbet) {
    const l = (await this.db.query('SELECT id, baslik, unvan, oncelik FROM v_is_havuzu LIMIT 15')).rows;
    const toplam = (await this.db.query("SELECT count(*)::int AS n FROM isler WHERE durum = 'havuz'")).rows[0].n;
    if (!toplam) return this.gonder(sohbet, 'Havuz boş. 👍');
    const satir = l.map((i) => `${i.oncelik === 1 ? '🔴 ' : '• '}#${i.id} ${esc(i.baslik)}${i.unvan ? ` — <i>${esc(i.unvan)}</i>` : ''}`);
    return this.gonder(sohbet, `<b>Havuzda ${toplam} iş bekliyor</b>\n\n${satir.join('\n')}${toplam > l.length ? `\n… ve ${toplam - l.length} iş daha` : ''}`);
  }

  async bugun(sohbet) {
    const l = (await this.db.query(`
      SELECT i.id, i.baslik, i.durum, i.plan_baslangic, e.ad AS ekip, c.unvan
      FROM isler i LEFT JOIN ekipler e ON e.id = i.ekip_id LEFT JOIN cariler c ON c.id = i.cari_id
      WHERE (i.plan_baslangic AT TIME ZONE 'Europe/Istanbul')::date = (now() AT TIME ZONE 'Europe/Istanbul')::date AND i.durum <> 'iptal'
      ORDER BY i.plan_baslangic`)).rows;
    if (!l.length) return this.gonder(sohbet, 'Bugün için planlanmış iş yok.');
    const ikon = { planlandi: '🕘', sahada: '🔧', tamamlandi: '✅', fis_kesildi: '🧾' };
    return this.gonder(sohbet, `<b>Bugünkü işler (${l.length})</b>\n\n${l.map((i) =>
      `${ikon[i.durum] || '•'} ${saat(i.plan_baslangic)} · ${esc(i.ekip || '')}\n   #${i.id} ${esc(i.baslik)}${i.unvan ? ` — <i>${esc(i.unvan)}</i>` : ''}`).join('\n')}`);
  }

  // Ayarlar ekranından: 15 dakika geçerli bağlama kodu
  async kodUret(kullaniciId) {
    const kod = Array.from(crypto.randomBytes(8), (b) => KOD_HARFLER[b % KOD_HARFLER.length]).join('');
    await this.db.query('DELETE FROM telegram_kodlari WHERE kullanici_id = $1 OR son_kullanma < now()', [kullaniciId]);
    await this.db.query("INSERT INTO telegram_kodlari (kod, kullanici_id, son_kullanma) VALUES ($1, $2, now() + interval '15 minutes')", [kod, kullaniciId]);
    return kod;
  }
}

module.exports = { TelegramBot, ONCELIK };
