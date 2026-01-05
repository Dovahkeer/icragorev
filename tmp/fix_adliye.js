const { db } = require('../config/database');
const { computeAdliye } = require('../helpers/adliye');

(async function () {
  try {
    console.log('Başlatılıyor: tasks tablosundaki adliye değerleri güncellenecek');
    const rows = await db('tasks').select('id', 'icra_dairesi', 'adliye');
    let updated = 0;
    for (const r of rows) {
      const computed = computeAdliye(r.icra_dairesi || '');
      if (!r.adliye || r.adliye === '' || r.adliye === 'DİĞER' || r.adliye !== computed) {
        await db('tasks').where({ id: r.id }).update({ adliye: computed, updated_at: db.fn.now() });
        updated++;
        console.log(`Güncellendi: id=${r.id} icra_dairesi="${r.icra_dairesi}" => adliye=${computed}`);
      }
    }
    console.log(`Tamamlandı. Toplam güncellenen: ${updated}`);
    process.exit(0);
  } catch (e) {
    console.error('Hata:', e);
    process.exit(1);
  }
})();
