'use strict';
// Uygulama açılırken db/ klasöründeki yeni şema dosyalarını sırayla uygular.
// Her dosya bir kez ve tek işlem içinde çalışır; uygulananlar sema_gecmisi tablosunda tutulur.
const fs = require('node:fs');
const path = require('node:path');

async function semaGuncelle(havuz, klasor) {
  const b = await havuz.al();
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

module.exports = { semaGuncelle };
