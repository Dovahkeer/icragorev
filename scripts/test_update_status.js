const { db } = require('../config/database');
(async () => {
  try {
    const id = 76;
    console.log('Before:', await db('tasks').where({ id }).first());
    await db('tasks').where({ id }).update({ status: 'yapiliyor', last_status_by: 7, updated_at: db.fn.now() });
    console.log('After:', await db('tasks').where({ id }).first());
    process.exit(0);
  } catch (e) {
    console.error('Update error:', e);
    process.exit(1);
  }
})();
