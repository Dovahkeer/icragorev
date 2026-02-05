const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');
const { computeAdliye, normalizeText } = require('../helpers/adliye');

const upload = multer({ dest: 'tmp/' });

const router = express.Router();

router.get('/dashboard', requireAuth, async (req, res) => {
  const role = req.session.userRole;
  const userId = req.session.userId;

  try {
    let tasks = [];
    let stats = {};

    if (role === 'atayan') {
      const myTasks = await db('tasks')
        .where('creator_id', userId)
        .whereIn('status', ['tamamlanmadi', 'kontrol_ediliyor', 'kontrol_bekleniyor', 'yapiliyor', 'tamamlandi', 'tamamlanamıyor', 'iade'])
        .select('tasks.*');

      const forApproval = await db('tasks')
        .where('creator_id', userId)
        .where('status', 'son_onay_bekliyor')
        .select('tasks.*');

      const archived = await db('tasks')
        .where('creator_id', userId)
        .where('status', 'arsiv')
        .count('id as count')
        .first();

      tasks = { myTasks, forApproval };
      stats = {
        total: myTasks.length + forApproval.length,
        forApproval: forApproval.length,
        active: myTasks.length,
        archived: archived.count
      };
    } else if (role === 'yonetici') {
      const toDistribute = await db('tasks')
        .where('status', 'tamamlanmadi')
        .whereNull('assignee_id')
        .orderBy('created_at', 'desc')
        .select('tasks.*');

      const forControl = await db('tasks')
        .whereIn('status', ['kontrol_ediliyor', 'kontrol_bekleniyor', 'tamamlandi', 'tamamlanamıyor'])
        .whereNotNull('assignee_id')
        .orderBy('created_at', 'desc')
        .select('tasks.*');

      const forFinalApproval = await db('tasks')
        .where('status', 'son_onay_bekliyor')
        .where('manager_id', userId)
        .orderBy('created_at', 'desc')
        .select('tasks.*');

      // Yöneticiye atanan görevler (kendisine atadığı görevler)
      const myAssignedTasks = await db('tasks')
        .where('assignee_id', userId)
        .whereIn('status', ['tamamlanmadi', 'yapiliyor', 'kontrol_ediliyor', 'kontrol_bekleniyor', 'iade'])
        .orderBy('created_at', 'desc')
        .select('tasks.*');

      const assigned = await db('tasks')
        .where('manager_id', userId)
        .count('id as count')
        .first();

      tasks = { toDistribute, forControl, forFinalApproval, myAssignedTasks };
      stats = {
        toDistribute: toDistribute.length,
        forControl: forControl.length,
        forFinalApproval: forFinalApproval.length,
        myAssignedTasks: myAssignedTasks.length,
        assigned: assigned.count,
        total: toDistribute.length + forControl.length + forFinalApproval.length + myAssignedTasks.length
      };
    } else if (role === 'atanan') {
      const myTasks = await db('tasks')
        .where('assignee_id', userId)
        .whereIn('status', ['tamamlanmadi', 'yapiliyor', 'kontrol_ediliyor', 'kontrol_bekleniyor', 'tamamlandi', 'tamamlanamıyor', 'iade'])
        .select('tasks.*');

      const completed = myTasks.filter(t => t.status === 'tamamlandi' || t.status === 'tamamlanamıyor').length;
      const inProgress = myTasks.filter(t => (t.status === 'kontrol_ediliyor' || t.status === 'kontrol_bekleniyor') || t.status === 'yapiliyor').length;
      const pending = myTasks.filter(t => t.status === 'tamamlanmadi' || t.status === 'iade').length;

      tasks = myTasks;
      stats = {
        total: myTasks.length,
        completed,
        inProgress,
        pending
      };
    }

    const users = await db('users').select('id', 'username', 'role');

    // Kullanıcı görev istatistikleri (herkes görebilir)
    const userTaskStats = await db('tasks')
      .select('assignee_id')
      .whereNotNull('assignee_id')
      .whereIn('status', ['tamamlanmadi', 'yapiliyor', 'kontrol_ediliyor', 'iade', 'kontrol_bekleniyor'])
      .count('id as task_count')
      .groupBy('assignee_id');

    console.log('📊 User Task Stats:', userTaskStats);

    // Kullanıcı bilgileriyle birleştir
    const userStats = users
      .filter(u => u.role === 'atanan' || u.role === 'yonetici')
      .map(user => {
        const stat = userTaskStats.find(s => s.assignee_id === user.id);
        return {
          id: user.id,
          username: user.username,
          role: user.role,
          taskCount: stat ? parseInt(stat.task_count) : 0
        };
      })
      .sort((a, b) => b.taskCount - a.taskCount); // En çok görevi olan üstte

    console.log('📊 User Stats:', userStats);

    // Admin-only: gather adliye list and tasks grouped by adliye
    let adliyeler = [];
    let tasksByAdliye = {};
    if (role === 'yonetici') {
      const raw = await db('tasks').select('adliye').whereNotNull('adliye').whereNot('status', 'arsiv').distinct();
      adliyeler = raw.map(r => r.adliye).filter(a => a);
      // Ensure 'Ofis' exists as a special adliye for managers
      if (!adliyeler.includes('Ofis')) adliyeler.unshift('Ofis');
      if (adliyeler.length) {
        for (const a of adliyeler) {
          const rows = await db('tasks').where({ adliye: a }).whereNot('status', 'arsiv').orderBy('created_at', 'desc').select('*');
          tasksByAdliye[a] = rows;
        }
      }
    }

    // Fetch tebligatlar for dashboard listing (everyone sees; managers can change status)
    const tebligatlar = await db('tebligatlar').orderBy('tarih', 'desc').select('*');

    // gather task ids visible on this dashboard to fetch note histories
    const taskIds = [];
    if (role === 'atayan') {
      (tasks.myTasks || []).forEach(t => taskIds.push(t.id));
      (tasks.forApproval || []).forEach(t => taskIds.push(t.id));
    } else if (role === 'yonetici') {
      (tasks.toDistribute || []).forEach(t => taskIds.push(t.id));
      (tasks.forControl || []).forEach(t => taskIds.push(t.id));
      (tasks.forFinalApproval || []).forEach(t => taskIds.push(t.id));
      (tasks.myAssignedTasks || []).forEach(t => taskIds.push(t.id));
      console.log('📊 Yönetici taskIds:', taskIds);
    } else if (role === 'atanan') {
      (tasks || []).forEach(t => taskIds.push(t.id));
    }

    let historiesByTask = {};
    if (taskIds.length) {
      const histories = await db('task_history').whereIn('task_id', taskIds).orderBy('created_at', 'desc').select('*');
      console.log(`📝 ${histories.length} history kaydı yüklendi`);
      histories.forEach(h => {
        const taskId = parseInt(h.task_id); // Number olarak sakla
        historiesByTask[taskId] = historiesByTask[taskId] || [];
        historiesByTask[taskId].push(h);
      });
      console.log('📊 historiesByTask keys:', Object.keys(historiesByTask));
    }

    // determine active section: prefer session-stored value (set after actions), then query param
    const activeSection = req.session._active || req.query.active || null;
    // clear session-stored active after reading
    delete req.session._active;

    res.render('dashboard', {
      role,
      tasks,
      users,
      stats,
      userStats,
      adliyeler,
      tasksByAdliye,
      tebligatlar,
      username: req.session.username,
      userId: req.session.userId,
      historiesByTask,
      active: activeSection
    });
  } catch (error) {
    console.error('Dashboard hatası:', error);
    res.status(500).send('Bir hata oluştu');
  }
});

router.post('/tasks/create', requireRole('atayan', 'yonetici'), async (req, res) => {
  const {
    icra_dairesi, muvekkil, portfoy, borclu, borclu_tckn_vkn,
    icra_esas_no, islem_turu, islem_aciklamasi, oncelik, eklenme_tarihi
  } = req.body;

  try {
    console.log('📝 Yeni görev oluşturuluyor...');
    console.log('İcra Dairesi:', icra_dairesi);

    const adliye = computeAdliye(icra_dairesi);
    console.log('Hesaplanan Adliye:', adliye);

    await db('tasks').insert({
      adliye,
      muvekkil,
      portfoy,
      borclu,
      borclu_tckn_vkn,
      icra_dairesi,
      icra_esas_no,
      islem_turu,
      islem_aciklamasi,
      oncelik: oncelik || 'rutin',
      eklenme_tarihi: eklenme_tarihi || new Date().toISOString().split('T')[0],
      creator_id: req.session.userId,
      status: 'tamamlanmadi',
      last_status_by: req.session.userId
    });
    const returnTo = req.body.returnTo || 'yeni-gorev';
    // store active tab in session so the GET /dashboard can open it
    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Görev oluşturma hatası:', error);
    res.status(500).send('Görev oluşturulamadı');
  }
});

// Admin utility: clear tasks and history (keeps users). Protected to atayan role.
router.post('/admin/clear-db', requireRole('atayan'), async (req, res) => {
  try {
    await db.transaction(async trx => {
      await trx('task_history').del();
      await trx('tasks').del();
      // Reset sqlite sequences where applicable
      await trx.raw("DELETE FROM sqlite_sequence WHERE name='tasks'");
      await trx.raw("DELETE FROM sqlite_sequence WHERE name='task_history'");
    });
    res.send('Database temizlendi (tasks ve task_history).');
  } catch (err) {
    console.error('Clear DB error', err);
    res.status(500).send('DB temizlenemedi: ' + err.message);
  }
});

router.post('/tasks/:id/assign', requireRole('yonetici'), async (req, res) => {
  const { id } = req.params;
  const { assignee_id } = req.body;
  const returnTo = req.body.returnTo || 'atama';

  try {
    const assigneeIdNum = assignee_id ? parseInt(assignee_id, 10) : null;
    await db('tasks').where({ id }).update({
      assignee_id: assigneeIdNum,
      manager_id: req.session.userId,
      status: 'tamamlanmadi',
      updated_at: db.fn.now()
    });

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'atama_yapildi',
      details: `Kullanıcı ID ${assignee_id} atandı`
    });

    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Atama hatası:', error);
    res.status(500).send('Atama yapılamadı');
  }
});

router.post('/tasks/:id/status', requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const role = req.session.userRole;

  try {
    const task = await db('tasks').where({ id }).first();

    if (!task) {
      return res.status(404).send('Görev bulunamadı');
    }

    // Atanan veya yönetici (kendisine atanmışsa) görev durumunu güncelleyebilir
    if ((role === 'atanan' || role === 'yonetici') && task.assignee_id !== req.session.userId) {
      return res.status(403).send('Bu görevi güncelleyemezsiniz');
    }

    // Handle special status transitions.
    // 'yapiliyor' should keep the task with the assignee (no manager assignment).
    let finalStatus = status;
    const updateData = {
      status: finalStatus,
      last_status_by: req.session.userId,
      updated_at: db.fn.now()
    };

    if (status === 'yapiliyor') {
      // leave manager as-is; task remains with assignee
      finalStatus = 'yapiliyor';
      updateData.status = finalStatus;
    } else if (status === 'tamamlandi' || status === 'tamamlanamıyor') {
      // send to manager control queue first, ensure manager is set when needed
      finalStatus = 'kontrol_bekleniyor';
      updateData.status = finalStatus;

      // if task has no manager assigned yet, keep existing behavior: if the
      // actor is a manager, set them as manager; otherwise leave manager_id as-is
      if (!task.manager_id && role === 'yonetici') {
        updateData.manager_id = req.session.userId;
      }
    }

    await db('tasks').where({ id }).update(updateData);

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'durum_degisti',
      details: `Durum: ${status} -> ${finalStatus}`
    });

    const returnTo = req.body.returnTo || 'gorevler';
    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Durum güncelleme hatası:', error);
    res.status(500).send('Durum güncellenemedi: ' + error.message);
  }
});

// Add note to a task (visible to all roles)
router.post('/tasks/:id/note', requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { note } = req.body;
    const returnTo = req.body.returnTo || 'gorevler';
    if (!note || !note.trim()) return res.redirect('/dashboard' + (returnTo ? ('?active=' + encodeURIComponent(returnTo)) : ''));

    await db('task_history').insert({
      task_id: taskId,
      user_id: req.session.userId,
      action: 'note',
      details: note.trim(),
      created_at: db.fn.now()
    });

    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Note save error', err);
    res.status(500).send('Not kaydedilemedi');
  }
});

// (Note route removed)

router.post('/tasks/:id/control', requireRole('atayan', 'yonetici'), async (req, res) => {
  const { id } = req.params;
  const { control_status } = req.body;

  try {
    const task = await db('tasks').where({ id }).first();

    if (!task) {
      return res.status(404).send('Görev bulunamadı');
    }

    let newStatus = 'kontrol_bekleniyor';
    const updateData = {
      last_status_by: req.session.userId,
      updated_at: db.fn.now()
    };

    if (control_status === 'uygun') {
      newStatus = 'son_onay_bekliyor';
      updateData.status = newStatus;
      // ensure manager_id is set so the task appears in manager's final-approval list
      if (!task.manager_id) updateData.manager_id = req.session.userId;
    } else if (control_status === 'iade') {
      newStatus = 'iade';
      updateData.status = newStatus;
      // when returned, clear manager assignment so assignee sees it as returned
      updateData.manager_id = task.manager_id || req.session.userId;
    } else {
      updateData.status = newStatus;
    }

    await db('tasks').where({ id }).update(updateData);

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'kontrol_yapildi',
      details: `Kontrol sonucu: ${control_status} -> ${newStatus}`
    });

    const returnTo = req.body.returnTo || 'kontrol';
    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (error) {
    console.error('Kontrol hatası:', error);
    res.status(500).send('Kontrol yapılamadı: ' + error.message);
  }
});

// Move a task to the Office adliye (manager only)
router.post('/tasks/:id/move-to-office', requireRole('yonetici'), async (req, res) => {
  const { id } = req.params;
  const returnTo = req.body.returnTo || 'adliye-listesi';
  try {
    const task = await db('tasks').where({ id }).first();
    if (!task) return res.status(404).send('Görev bulunamadı');

    // Ensure there's a column to store previous adliye; add if missing (SQLite)
    const cols = await db.raw("PRAGMA table_info('tasks')");
    const colNames = (cols && cols.rows) ? cols.rows.map(r => r.name) : (Array.isArray(cols) ? cols.map(r => r.name) : []);
    if (!colNames.includes('adliye_prev')) {
      await db.raw("ALTER TABLE tasks ADD COLUMN adliye_prev TEXT");
    }

    // Save previous adliye and move to Ofis
    await db('tasks').where({ id }).update({ adliye_prev: task.adliye || null, adliye: 'Ofis', updated_at: db.fn.now() });

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'moved_to_office',
      details: `Görev Ofise aktarıldı by user ${req.session.userId}`,
      created_at: db.fn.now()
    });

    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Move to office error', err);
    res.status(500).send('Ofise aktarılamadı: ' + err.message);
  }
});

// Move a task from Office back to a specified adliye (manager only)
router.post('/tasks/:id/move-to-adliye', requireRole('yonetici'), async (req, res) => {
  const { id } = req.params;
  // adliye will be restored from adliye_prev if available
  const returnTo = req.body.returnTo || 'adliye-listesi';
  try {
    const task = await db('tasks').where({ id }).first();
    if (!task) return res.status(404).send('Görev bulunamadı');
    // Determine target adliye from backup column if present
    let target = task.adliye_prev || null;
    if (!target) {
      return res.status(400).send('Geri alınacak adliye bulunamadı');
    }

    await db('tasks').where({ id }).update({ adliye: target, adliye_prev: null, updated_at: db.fn.now() });

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'moved_to_adliye',
      details: `Görev ${target} adliyesine aktarıldı by user ${req.session.userId}`,
      created_at: db.fn.now()
    });

    req.session._active = returnTo;
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Move to adliye error', err);
    res.status(500).send('Adliyeye aktarılamadı: ' + err.message);
  }
});

router.post('/tasks/:id/final-approve', requireRole('atayan', 'yonetici'), async (req, res) => {
  const { id } = req.params;

  try {
    const task = await db('tasks').where({ id }).first();

    if (!task) {
      return res.status(404).send('Görev bulunamadı');
    }

    // Atayan sadece kendi oluşturduğu görevleri onaylayabilir
    // Yönetici kendi atadığı görevleri onaylayabilir
    if (req.session.userRole === 'atayan' && task.creator_id !== req.session.userId) {
      return res.status(403).send('Bu görevi onaylayamazsınız');
    }

    if (req.session.userRole === 'yonetici' && task.manager_id !== req.session.userId) {
      return res.status(403).send('Bu görevi onaylayamazsınız');
    }

    await db('tasks').where({ id }).update({
      status: 'arsiv',
      last_status_by: req.session.userId,
      updated_at: db.fn.now()
    });

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'son_onay',
      details: 'Görev arşivlendi'
    });

    const returnTo = req.body.returnTo || 'onay-bekleyen';
    return res.redirect('/dashboard' + (returnTo ? ('?active=' + encodeURIComponent(returnTo)) : ''));
  } catch (error) {
    console.error('Onay hatası:', error);
    res.status(500).send('Onay verilemedi: ' + error.message);
  }
});

router.get('/archive', requireAuth, async (req, res) => {
  try {
    const tasks = await db('tasks')
      .where('status', 'arsiv')
      .orderBy('updated_at', 'desc')
      .select('tasks.*');

    const tebligatArsiv = await db('tebligat_arsiv')
      .orderBy('arsivlenme_tarihi', 'desc')
      .select('*');

    res.render('archive', {
      tasks,
      tebligatArsiv,
      username: req.session.username,
      role: req.session.userRole,
      userId: req.session.userId
    });
  } catch (error) {
    console.error('Arşiv hatası:', error);
    res.status(500).send('Arşiv yüklenemedi');
  }
});

// Delete an archived task (only 'atayan')
router.post('/archive/tasks/:id/delete', requireRole('atayan'), async (req, res) => {
  const { id } = req.params;
  try {
    const task = await db('tasks').where({ id }).first();
    if (!task) return res.status(404).send('Görev bulunamadı');
    if (task.status !== 'arsiv') return res.status(400).send('Görev arşivde değil');

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'arsivden_silindi',
      details: `Arşivden silindi: ${task.islem_turu}`,
      created_at: db.fn.now()
    });

    await db('tasks').where({ id }).delete();
    return res.redirect('/archive');
  } catch (err) {
    console.error('Arşiv görev silme hatası:', err);
    res.status(500).send('Arşivden görev silinemedi: ' + err.message);
  }
});

// Delete an archived tebligat (only 'atayan')
router.post('/archive/tebligat/:id/delete', requireRole('atayan'), async (req, res) => {
  const { id } = req.params;
  try {
    const t = await db('tebligat_arsiv').where({ id }).first();
    if (!t) return res.status(404).send('Tebligat bulunamadı');

    await db('tebligat_arsiv').where({ id }).delete();
    return res.redirect('/archive');
  } catch (err) {
    console.error('Arşiv tebligat silme hatası:', err);
    res.status(500).send('Arşivden tebligat silinemedi: ' + err.message);
  }
});

router.post('/tasks/:id/delete', requireRole('atayan', 'yonetici'), async (req, res) => {
  const { id } = req.params;

  try {
    const task = await db('tasks').where({ id }).first();

    if (!task) {
      return res.status(404).send('Görev bulunamadı');
    }

    // Sadece görev oluşturan silebilir
    if (task.creator_id !== req.session.userId) {
      return res.status(403).send('Bu görevi silemezsiniz');
    }

    await db('task_history').insert({
      task_id: id,
      user_id: req.session.userId,
      action: 'gorev_silindi',
      details: `Görev silindi: ${task.islem_turu}`
    });

    await db('tasks').where({ id }).delete();

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Silme hatası:', error);
    res.status(500).send('Görev silinemedi: ' + error.message);
  }
});

// Excel upload or paste import (used by dashboard 'Yeni Görev' area)
router.post('/upload-excel', requireAuth, upload.single('excelFile'), async (req, res) => {
  try {
    const rows = [];
    const errors = [];
    // If pasteData provided, parse pasted text (tab or multiple spaces separated)
    if (req.body.pasteData && req.body.pasteData.trim()) {
      const lines = req.body.pasteData.trim().split(/\r?\n/).filter(l => l.trim());
      lines.forEach((ln, idx) => {
        // split by tab first, fallback to multiple spaces
        let cols = ln.split('\t');
        if (cols.length === 1) cols = ln.split(/\s{2,}|\s-\s|\s-?/);
        cols = cols.map(c => c.trim()).filter(c => c !== '');
        // expected: [icra_dairesi, muvekkil, borclu, borclu_tckn, islem_turu, islem_aciklamasi, ...]
        if (cols.length < 4) {
          errors.push({ row: idx + 1, error: 'Satırda yeterli kolon yok' });
          return;
        }
        const icra_dairesi = cols[0] || '';
        const muvekkil = cols[1] || '';
        const borclu = cols[2] || '';
        const borclu_tckn_vkn = cols[3] || '';
        // remaining columns join as islem_turu + islem_aciklamasi
        const islem_turu = cols[4] || '';
        const islem_aciklamasi = cols.slice(5).join(' ') || '';
        const portfoy = '';
        const icra_esas_no = '';
        rows.push({ icra_dairesi, muvekkil, portfoy, borclu, borclu_tckn_vkn, icra_esas_no, islem_turu, islem_aciklamasi });
      });
    } else if (req.file) {
      // xlsx parsing with robust header/cell mapping
      const wb = xlsx.readFile(req.file.path);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      // get both object form and raw rows to support variable headers
      const parsedObjs = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      const rowsArr = xlsx.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      const headerRow = (rowsArr && rowsArr[0]) ? rowsArr[0].map(h => String(h || '').trim().toLowerCase()) : [];

      // build a normalized header array for robust matching
      const headerRowNormalized = headerRow.map(h => normalizeText(h || ''));

      const findHeaderIndex = (candidates) => {
        const candNorms = candidates.map(c => normalizeText(c));
        for (const cn of candNorms) {
          // exact normalized match
          let idx = headerRowNormalized.findIndex(h => h === cn);
          if (idx !== -1) return idx;
          // includes
          idx = headerRowNormalized.findIndex(h => h.includes(cn));
          if (idx !== -1) return idx;
        }
        return -1;
      };

      const getFromParsedOrRow = (obj, rowArr, candidates) => {
        // build normalized key->value map from parsed object
        const normMap = {};
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(k => {
            const nk = normalizeText(k);
            normMap[nk] = obj[k];
          });
        }

        const candNorms = candidates.map(c => normalizeText(c));
        for (const cn of candNorms) {
          // direct normalized key match
          if (Object.prototype.hasOwnProperty.call(normMap, cn) && normMap[cn] !== undefined && normMap[cn] !== null && String(normMap[cn]).trim() !== '') {
            return String(normMap[cn]).trim();
          }
          // try keys that include candidate
          for (const nk of Object.keys(normMap)) {
            if (nk.includes(cn) && normMap[nk] !== undefined && normMap[nk] !== null && String(normMap[nk]).trim() !== '') {
              return String(normMap[nk]).trim();
            }
          }
        }

        // fallback to header index
        const idx = findHeaderIndex(candidates);
        if (idx !== -1 && rowArr && rowArr.length > idx) return String(rowArr[idx] || '').trim();
        return '';
      };

      const dataRows = rowsArr.slice(1);
      for (let i = 0; i < dataRows.length; i++) {
        const rowArr = dataRows[i];
        const obj = parsedObjs[i] || {};
        const icra_dairesi = getFromParsedOrRow(obj, rowArr, ['Adliye', 'İcra Dairesi', 'icra dairesi', 'icra_dairesi']);
        const muvekkil = getFromParsedOrRow(obj, rowArr, ['Müvekkil', 'muvekkil', 'müvekkil']);
        const portfoy = getFromParsedOrRow(obj, rowArr, ['Portföy', 'Portfoy', 'portfoy']);
        const borcluVal = getFromParsedOrRow(obj, rowArr, ['Borçlu', 'Borclu', 'borclu']);
        const borcluTckn = getFromParsedOrRow(obj, rowArr, ['Borçlu TCKN-VKN', 'Borclu TCKN-VKN', 'borclu_tckn_vkn', 'borclu tckn', 'tckn', 'vkn']);
        const icra_esas_no = getFromParsedOrRow(obj, rowArr, ['İcra Esas Numarası', 'İcra Esas', 'Esas No', 'icra_esas_no', 'dosya no', 'dosya_no', 'dosya', 'dosya esas', 'esas no', 'esno', 'file no', 'file number']);
        const islem_turu = getFromParsedOrRow(obj, rowArr, ['İŞLEM TÜRÜ', 'İşlem Türü', 'islem_turu', 'İşlem', 'islem']);
        const islem_aciklamasi = getFromParsedOrRow(obj, rowArr, ['İşlem AÇIKLAMASI', 'İşlem Açıklaması', 'islem_aciklamasi', 'Açıklama', 'aciklama', 'açıklama']);

        rows.push({ icra_dairesi, muvekkil, portfoy, borclu: borcluVal, borclu_tckn_vkn: borcluTckn, icra_esas_no, islem_turu, islem_aciklamasi });
      }
    } else {
      return res.status(400).send('Dosya veya yapıştırma verisi bulunamadı');
    }

    // insert rows
    const inserted = [];
    const now = new Date().toISOString();
    // parsed rows count available in 'rows' variable
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.islem_turu || !r.icra_dairesi) {
        errors.push({ row: i + 1, error: 'Eksik zorunlu alan (İcra Dairesi veya İşlem Türü)' });
        continue;
      }
      // Normalize borclu fields: remove extra newlines and try to extract TCKN/VKN
      if (r.borclu) {
        // replace multiple whitespace/newline with single space
        r.borclu = r.borclu.toString().replace(/\r?\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        // if borclu_tckn_vkn missing, attempt to extract trailing 10-11 digit number
        if ((!r.borclu_tckn_vkn || String(r.borclu_tckn_vkn).trim() === '')) {
          const match = r.borclu.match(/(\d{10,11})/g);
          if (match && match.length) {
            // use last numeric group as TCKN/VKN
            const tckn = match[match.length - 1];
            r.borclu_tckn_vkn = tckn;
            // remove that number from borclu string
            r.borclu = r.borclu.replace(tckn, '').replace(/[-\/\|_]$/, '').trim();
          }
        }
      }
      // compute adliye using centralized helper
      const adliye = computeAdliye(r.icra_dairesi);

      try {
        const [id] = await db('tasks').insert({
          adliye,
          icra_dairesi: r.icra_dairesi,
          muvekkil: r.muvekkil,
          portfoy: r.portfoy || null,
          borclu: r.borclu || null,
          borclu_tckn_vkn: r.borclu_tckn_vkn || null,
          icra_esas_no: r.icra_esas_no || null,
          islem_turu: r.islem_turu,
          islem_aciklamasi: r.islem_aciklamasi,
          creator_id: req.session.userId,
          status: 'tamamlanmadi',
          last_status_by: req.session.userId,
          eklenme_tarihi: now
        });
        await db('task_history').insert({ task_id: id, user_id: req.session.userId, action: 'imported', details: 'imported via paste/upload', created_at: now });
        inserted.push(id);
      } catch (rowErr) {
        errors.push({ row: i + 1, error: rowErr && rowErr.message ? rowErr.message : String(rowErr) });
      }
    }

    // cleanup uploaded file
    if (req.file) {
      try { require('fs').unlinkSync(req.file.path); } catch (e) { }
    }

    // cleanup uploaded file
    if (req.file) {
      try { require('fs').unlinkSync(req.file.path); } catch (e) { }
    }

    // After successful import, redirect to dashboard and open Atama tab so admins see uploaded tasks
    req.session._active = 'atama';
    return res.redirect('/dashboard');
  } catch (err) {
    console.error('Upload-excel error', err);
    res.status(500).send('Import hatası: ' + err.message);
  }
});


router.get('/all-tasks', requireAuth, async (req, res) => {
  try {
    const { status, oncelik, adliye, muvekkil, creator, assignee } = req.query;

    let query = db('tasks')
      .whereNot('status', 'arsiv')
      .orderBy('created_at', 'desc');

    // Filtreler
    if (status) {
      query = query.where('status', status);
    }
    if (oncelik) {
      query = query.where('oncelik', oncelik);
    }
    if (adliye) {
      query = query.where('adliye', 'like', `%${adliye}%`);
    }
    if (muvekkil) {
      query = query.where('muvekkil', 'like', `%${muvekkil}%`);
    }
    if (creator) {
      query = query.where('creator_id', creator);
    }
    if (assignee) {
      query = query.where('assignee_id', assignee);
    }

    const allTasks = await query.select('tasks.*');
    const users = await db('users').select('id', 'username', 'role');

    res.render('all-tasks', {
      tasks: allTasks,
      users,
      username: req.session.username,
      role: req.session.userRole,
      userId: req.session.userId,
      filterStatus: status || '',
      filterOncelik: oncelik || '',
      filterAdliye: adliye || '',
      filterMuvekkil: muvekkil || '',
      filterCreator: creator || '',
      filterAssignee: assignee || ''
    });
  } catch (error) {
    console.error('Tüm görevler hatası:', error);
    res.status(500).send('Bir hata oluştu: ' + error.message);
  }
});

module.exports = router;
