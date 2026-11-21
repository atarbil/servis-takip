'use strict';
// Uygulama açılırken db/ klasöründeki yeni şema dosyalarını sırayla uygular.
// Her dosya bir kez ve tek işlem içinde çalışır; uygulananlar sema_gecmisi tablosunda tutulur.
const fs = require('node:fs');
const path = require('node:path');

async function semaGuncelle(havuz, klasor) {
  const b = await havuz.ham();
  try {
    // Aynı anda iki sunucu başlarsa çakışmasın
    await b.query('SELECT pg_advisory_lock(424242)');
    await b.exec(`CREATE TABLE IF NOT EXISTS sema_gecmisi (
      dosya text PRIMARY KEY, zaman timestamptz NOT NULL DEFAULT now())`);
    const uygulanan = new Set((await b.query('SELECT dosya FROM sema_gecmisi')).rows.map((r) => r.dosya));
    const dosyalar = fs.readdirSync(klasor).filter((f) => /^\d{3}_.+\.sql$/.test(f)).sort();
    for (const f of dosyalar) {
      if (uygulanan.has(f)) continue;
      const sql = fs.readFileSync(path.join(klasor, f), 'utf8');
      console.log(`[şema] uygulanıyor: ${f}`);
      try {
        await b.exec('BEGIN;\n' + sql + '\n;INSERT INTO sema_gecmisi (dosya) VALUES (\'' + f + '\');\nCOMMIT;');
      } catch (e) {
        await b.exec('ROLLBACK').catch(() => {});
        throw new Error(`Şema dosyası ${f} uygulanamadı: ${e.message}`);
      }
    }
    await b.query('SELECT pg_advisory_unlock(424242)');
  } finally {
    havuz.birak(b);
  }
}

// Uygulama sorgularının çalıştığı rol: süper kullanıcı ve tablo sahibi değildir, bu yüzden
// satır güvenliği (silinmiş kayıtları gizleme) ona uygulanır. Her açılışta hazırlanır;
// yedekten dönüşte de eksik kalmaz. Hazırlanamazsa uygulama sahip rolle çalışmaya devam eder.
const UYG_ROL = 'servis_uyg';
async function uygulamaRolu(havuz) {
  const b = await havuz.ham();
  try {
    await b.exec(`DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${UYG_ROL}') THEN
          CREATE ROLE ${UYG_ROL} NOLOGIN NOSUPERUSER NOBYPASSRLS;
        END IF;
      END $$;
      GRANT USAGE ON SCHEMA public TO ${UYG_ROL};
      GRANT ALL ON ALL TABLES IN SCHEMA public TO ${UYG_ROL};
      GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${UYG_ROL};
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${UYG_ROL};`);
    const s = await b.query(`SELECT rolsuper OR pg_has_role(current_user, '${UYG_ROL}', 'MEMBER') AS olur FROM pg_roles WHERE rolname = current_user`);
    if (!s.rows[0]?.olur) await b.exec(`GRANT ${UYG_ROL} TO CURRENT_USER`);
    havuz.rol = UYG_ROL;
    return true;
  } catch (e) {
    console.error(`[şema] uygulama rolü hazırlanamadı (silinen kayıtlar listelerde görünebilir): ${e.message}`);
    return false;
  } finally {
    havuz.birak(b);
  }
}

module.exports = { semaGuncelle, uygulamaRolu };
