'use strict';
// Telegram botu: bağlı yöneticinin yazdığı mesajları havuza iş olarak ekler.
// Uzun yoklama (getUpdates) kullanır; sunucuda dışarıya port açmak gerekmez.
const crypto = require('node:crypto');
const { hizliIsEkle } = require('./hizliis');

const esc = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const saat = (t) => new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' });
const ONCELIK = { 1: '🔴 Acil', 2: 'Normal', 3: 'Düşük' };
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
  }

  durdur() { this.calisiyor = false; }

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
