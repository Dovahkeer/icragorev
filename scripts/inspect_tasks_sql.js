const { db } = require('../config/database');
(async () => {
  try {
    const res = await db.raw("SELECT sql FROM sqlite_master WHERE type='table' AND name='tasks'");
    console.log('raw result:', JSON.stringify(res, null, 2));
    // attempt to extract sql text
    let createSql = '';
    if (Array.isArray(res)) {
      if (res[0] && res[0].sql) createSql = res[0].sql;
      else if (res[0] && Array.isArray(res[0]) && res[0][0] && res[0][0].sql) createSql = res[0][0].sql;
    } else if (res && res.sql) createSql = res.sql;
    console.log('\nCREATE SQL:\n', createSql);
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
