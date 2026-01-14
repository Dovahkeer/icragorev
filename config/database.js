const knex = require('knex');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = knex({
  client: 'sqlite3',
  connection: {
    filename: path.join(dataDir, 'app.db')
  },
  useNullAsDefault: true
});

async function initDatabase() {
  try {
    await db.schema.hasTable('users').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('users', (table) => {
          table.increments('id').primary();
          table.string('username').unique().notNullable();
          table.string('password_hash').notNullable();
          table.enum('role', ['atayan', 'yonetici', 'atanan']).notNullable();
          table.timestamps(true, true);
        });
        console.log('✓ users tablosu oluşturuldu');
      }
    });

    await db.schema.hasTable('tasks').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('tasks', (table) => {
          table.increments('id').primary();
          table.string('adliye');
          table.string('muvekkil');
          table.string('portfoy');
          table.string('borclu');
          table.string('borclu_tckn_vkn');
          table.string('icra_dairesi');
          table.string('icra_esas_no');
          table.string('islem_turu');
          table.text('islem_aciklamasi');
          table.enum('oncelik', ['acil', 'rutin']).defaultTo('rutin');
          table.enum('status', [
            'tamamlanmadi',
            'kontrol_ediliyor',
            'yapiliyor',
            'tamamlandi',
            'tamamlanamıyor',
            'iade',
            'kontrol_bekleniyor',
            'uygun',
            'son_onay_bekliyor',
            'arsiv'
          ]).defaultTo('tamamlanmadi');
          table.integer('creator_id').unsigned().references('id').inTable('users');
          table.integer('assignee_id').unsigned().references('id').inTable('users');
          table.integer('manager_id').unsigned().references('id').inTable('users');
          table.integer('last_status_by').unsigned().references('id').inTable('users');
          table.date('eklenme_tarihi');
          table.timestamps(true, true);
        });
        console.log('✓ tasks tablosu oluşturuldu');
      }
    
        // If the tasks table existed previously, ensure the 'yapiliyor' status
        // is allowed by recreating the table with the new enum if needed.
        try {
          const masterRow = await db.raw("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'");
          let createSql = '';
          if (Array.isArray(masterRow)) {
            if (masterRow[0] && masterRow[0].sql) createSql = masterRow[0].sql;
            else if (masterRow[0] && Array.isArray(masterRow[0]) && masterRow[0][0] && masterRow[0][0].sql) createSql = masterRow[0][0].sql;
          } else if (masterRow && masterRow.sql) {
            createSql = masterRow.sql;
          }

          if (createSql && !createSql.includes("yapiliyor")) {
            console.log("i) tasks tablosu enum güncellemesi: 'yapiliyor' ekleniyor...");
            await db.transaction(async (trx) => {
              await trx.schema.createTable('tasks_new', (table) => {
                table.increments('id').primary();
                table.string('adliye');
                table.string('muvekkil');
                table.string('portfoy');
                table.string('borclu');
                table.string('borclu_tckn_vkn');
                table.string('icra_dairesi');
                table.string('icra_esas_no');
                table.string('islem_turu');
                table.text('islem_aciklamasi');
                table.enum('oncelik', ['acil', 'rutin']).defaultTo('rutin');
                table.enum('status', [
                  'tamamlanmadi',
                  'kontrol_ediliyor',
                  'yapiliyor',
                  'tamamlandi',
                  'tamamlanamıyor',
                  'iade',
                  'kontrol_bekleniyor',
                  'uygun',
                  'son_onay_bekliyor',
                  'arsiv'
                ]).defaultTo('tamamlanmadi');
                table.integer('creator_id').unsigned().references('id').inTable('users');
                table.integer('assignee_id').unsigned().references('id').inTable('users');
                table.integer('manager_id').unsigned().references('id').inTable('users');
                table.integer('last_status_by').unsigned().references('id').inTable('users');
                table.date('eklenme_tarihi');
                table.timestamps(true, true);
              });

              // copy data preserving column names
              await trx.raw('INSERT INTO tasks_new (id, adliye, muvekkil, portfoy, borclu, borclu_tckn_vkn, icra_dairesi, icra_esas_no, islem_turu, islem_aciklamasi, oncelik, status, creator_id, assignee_id, manager_id, last_status_by, eklenme_tarihi, created_at, updated_at) SELECT id, adliye, muvekkil, portfoy, borclu, borclu_tckn_vkn, icra_dairesi, icra_esas_no, islem_turu, islem_aciklamasi, oncelik, status, creator_id, assignee_id, manager_id, last_status_by, eklenme_tarihi, created_at, updated_at FROM tasks');

              await trx.schema.dropTable('tasks');
              await trx.schema.renameTable('tasks_new', 'tasks');
            });
            console.log("✓ tasks tablosu enum güncellendi: 'yapiliyor' eklendi");
          }
        } catch (e) {
          console.error('tasks enum güncelleme sırasında hata:', e);
        }
    });

    await db.schema.hasTable('task_history').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('task_history', (table) => {
          table.increments('id').primary();
          table.integer('task_id').unsigned().references('id').inTable('tasks').onDelete('CASCADE');
          table.integer('user_id').unsigned().references('id').inTable('users');
          table.string('action').notNullable();
          table.text('details');
          table.timestamp('created_at').defaultTo(db.fn.now());
        });
        console.log('✓ task_history tablosu oluşturuldu');
      }
    });

    await db.schema.hasTable('tebligatlar').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('tebligatlar', (table) => {
          table.increments('id').primary();
          table.string('muvekkil');
          table.string('portfoy');
          table.string('taraf');
          table.string('tckn_vkn');
          table.string('barkod');
          table.string('dosya_no'); // YENİ: İcra esas numarası
          table.string('icra_dairesi'); // YENİ: İcra dairesi
          table.enum('durum', ['itiraz', 'tebliğ', 'iade']).defaultTo('itiraz');
          table.date('tarih');
          table.text('notlar');
          table.integer('created_by').unsigned().references('id').inTable('users');
          table.integer('updated_by').unsigned().references('id').inTable('users');
          table.timestamps(true, true);
        });
        console.log('✓ tebligatlar tablosu oluşturuldu');
      } else {
        // Mevcut tabloya yeni kolonlar ekle
        const hasColumns = await db.schema.hasColumn('tebligatlar', 'dosya_no');
        if (!hasColumns) {
          await db.schema.table('tebligatlar', (table) => {
            table.string('dosya_no');
            table.string('icra_dairesi');
          });
          console.log('✓ tebligatlar tablosuna dosya_no ve icra_dairesi eklendi');
        }
      }
    });

    // Tebligat Arşiv Tablosu
    await db.schema.hasTable('tebligat_arsiv').then(async (exists) => {
      if (!exists) {
        await db.schema.createTable('tebligat_arsiv', (table) => {
          table.increments('id').primary();
          table.string('muvekkil');
          table.string('portfoy');
          table.string('taraf');
          table.string('tckn_vkn');
          table.string('barkod');
          table.string('dosya_no');
          table.string('icra_dairesi');
          table.string('durum');
          table.date('tarih');
          table.text('notlar');
          table.integer('created_by').unsigned().references('id').inTable('users');
          table.integer('updated_by').unsigned().references('id').inTable('users');
          table.date('arsivlenme_tarihi');
          table.integer('arsivleyen').unsigned().references('id').inTable('users');
          table.timestamps(true, true);
        });
        console.log('✓ tebligat_arsiv tablosu oluşturuldu');
      }
    });

    const userCount = await db('users').count('id as count').first();
    if (userCount.count === 0) {
      const passwordPit10 = await bcrypt.hash('pit10', 10);
      const password123456 = await bcrypt.hash('123456', 10);
      
      await db('users').insert([
        { username: 'ozlemkoksal', password_hash: passwordPit10, role: 'atayan' },
        { username: 'serenaozyilmaz', password_hash: passwordPit10, role: 'atayan' },
        { username: 'topraksezgin', password_hash: passwordPit10, role: 'atayan' },
        { username: 'caglatekman', password_hash: passwordPit10, role: 'atayan' },
        { username: 'ilaydaerdogan', password_hash: password123456, role: 'yonetici' },
        { username: 'ozgeaslan', password_hash: password123456, role: 'yonetici' },
        { username: 'omercanoruc', password_hash: password123456, role: 'atanan' },
        { username: 'melissaozturk', password_hash: password123456, role: 'atanan' },
        { username: 'ademcanozkan', password_hash: password123456, role: 'atanan' },
        { username: 'nisanurakyildiz', password_hash: password123456, role: 'atanan' },
        { username: 'sevvalaslanboga', password_hash: password123456, role: 'atanan' },
        { username: 'cansubozbek', password_hash: password123456, role: 'atanan' }
      ]);
      console.log('✓ Kullanıcılar oluşturuldu (atayan: pit10, diğer: 123456)');
    }

    // Ensure requested user changes: rename 'sevvalaslanboga' -> 'elauncu' and add 'humeyra' if missing
    try {
      const existing = await db('users').where({ username: 'sevvalaslanboga' }).first();
      if (existing) {
        await db('users').where({ id: existing.id }).update({ username: 'elauncu' });
        console.log("✓ 'sevvalaslanboga' kullanıcısının adı 'elauncu' olarak değiştirildi");
      } else {
        // maybe already renamed
        const already = await db('users').where({ username: 'elauncu' }).first();
        if (already) console.log("✓ 'elauncu' kullanıcısı zaten mevcut");
      }

      const humeyra = await db('users').where({ username: 'humeyra' }).first();
      if (!humeyra) {
        const password123456 = await bcrypt.hash('123456', 10);
        await db('users').insert({ username: 'humeyra', password_hash: password123456, role: 'atanan' });
        console.log("✓ 'humeyra' kullanıcısı eklendi (şifre: 123456)");
      } else {
        console.log("✓ 'humeyra' kullanıcısı zaten mevcut");
      }

      // Ensure caglatekman exists (atayan, şifre: pit10)
      const passwordPit10 = await bcrypt.hash('pit10', 10);
      const cagla = await db('users').where({ username: 'caglatekman' }).first();
      if (!cagla) {
        await db('users').insert({ username: 'caglatekman', password_hash: passwordPit10, role: 'atayan' });
        console.log("✓ 'caglatekman' kullanıcısı eklendi (şifre: pit10)");
      } else {
        console.log("✓ 'caglatekman' kullanıcısı zaten mevcut");
      }
    } catch (e) {
      console.error('Kullanıcı güncelleme sırasında hata:', e);
    }

    // Ensure additional requested atayan users exist with password 'faktoring'
    try {
      const passwordFaktoring = await bcrypt.hash('faktoring', 10);

      const usersToEnsure = ['tugberkoznacar', 'ridvanyucel', 'sevvalfidan'];
      for (const uname of usersToEnsure) {
        const u = await db('users').where({ username: uname }).first();
        if (!u) {
          await db('users').insert({ username: uname, password_hash: passwordFaktoring, role: 'atayan' });
          console.log(`✓ '${uname}' kullanıcısı eklendi (şifre: faktoring)`);
        } else {
          console.log(`✓ '${uname}' kullanıcısı zaten mevcut`);
        }
      }
    } catch (e) {
      console.error('Ek kullanıcı ekleme sırasında hata:', e);
    }

    console.log('✓ Veritabanı hazır!');
  } catch (error) {
    console.error('Veritabanı hatası:', error);
    throw error;
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { db, initDatabase };
