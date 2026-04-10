const express = require('express');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const TEBLIGAT_PSEUDO_USERNAME = 'topraksezgin';

function buildRedirectUrl(baseUrl, query) {
  const params = new URLSearchParams();
  if (query.ekleyen) params.append('ekleyen', query.ekleyen);
  if (query.icra_dairesi) params.append('icra_dairesi', query.icra_dairesi);
  if (query.muvekkil) params.append('muvekkil', query.muvekkil);
  if (query.durum) params.append('durum', query.durum);

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

function safeJsonParse(value) {
  if (typeof value !== 'string') return null;

  try {
    return JSON.parse(value);
  } catch (_err) {
    return null;
  }
}

function toIsoDate(value, fallbackValue) {
  const candidate = value || fallbackValue || new Date().toISOString();
  const date = new Date(candidate);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function sortEntriesByCreatedAtDesc(entries) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left.created_at).getTime();
    const rightTime = new Date(right.created_at).getTime();
    return (Number.isNaN(rightTime) ? 0 : rightTime) - (Number.isNaN(leftTime) ? 0 : leftTime);
  });
}

function createEntryId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeStructuredEntries(rawValue, options) {
  const {
    entryType,
    valueKey,
    fallbackUserId = null,
    fallbackUsername = TEBLIGAT_PSEUDO_USERNAME,
    fallbackCreatedAt = null
  } = options;

  const parsed = safeJsonParse(rawValue);
  let sourceEntries = [];

  if (Array.isArray(parsed)) {
    sourceEntries = parsed;
  } else if (parsed && typeof parsed === 'object') {
    sourceEntries = [parsed];
  } else if (typeof rawValue === 'string' && rawValue.trim()) {
    sourceEntries = [{ id: `${entryType}-legacy-0`, [valueKey]: rawValue.trim() }];
  }

  const normalized = sourceEntries.map((entry, index) => {
    const rawEntry = entry && typeof entry === 'object'
      ? entry
      : { [valueKey]: String(entry || '').trim() };

    const value = String(
      rawEntry[valueKey]
      || rawEntry.value
      || rawEntry.text
      || rawEntry.details
      || rawEntry.not
      || rawEntry.note
      || rawEntry.barkod
      || ''
    ).trim();

    if (!value) return null;

    return {
      id: String(rawEntry.id || `${entryType}-legacy-${index}`),
      [valueKey]: value,
      user_id: fallbackUserId,
      username: fallbackUsername,
      created_at: toIsoDate(rawEntry.created_at || rawEntry.createdAt, fallbackCreatedAt)
    };
  }).filter(Boolean);

  return sortEntriesByCreatedAtDesc(normalized);
}

function normalizeNoteEntries(rawValue, options) {
  return normalizeStructuredEntries(rawValue, {
    ...options,
    entryType: 'note',
    valueKey: 'text'
  });
}

function normalizeBarkodEntries(rawValue, options) {
  return normalizeStructuredEntries(rawValue, {
    ...options,
    entryType: 'barkod',
    valueKey: 'value'
  });
}

function serializeEntries(entries) {
  if (!Array.isArray(entries) || !entries.length) return null;
  return JSON.stringify(sortEntriesByCreatedAtDesc(entries));
}

function summarizeEntries(entries, valueKey) {
  if (!Array.isArray(entries) || !entries.length) return null;

  const values = entries
    .map((entry) => String(entry[valueKey] || '').trim())
    .filter(Boolean);

  return values.length ? values.join('\n') : null;
}

function noteSummary(entries) {
  return summarizeEntries(entries, 'text');
}

function barkodSummary(entries) {
  return summarizeEntries(entries, 'value');
}

function buildInitialEntries(rawValue, entryType, pseudoUserId) {
  const normalizedValue = String(rawValue || '').trim();
  if (!normalizedValue) return null;

  const baseEntry = {
    id: createEntryId(entryType),
    user_id: pseudoUserId,
    username: TEBLIGAT_PSEUDO_USERNAME,
    created_at: new Date().toISOString()
  };

  if (entryType === 'note') {
    return [{ ...baseEntry, text: normalizedValue }];
  }

  return [{ ...baseEntry, value: normalizedValue }];
}

async function getToprakSezginUser(users) {
  if (Array.isArray(users)) {
    const existing = users.find((user) => user.username === TEBLIGAT_PSEUDO_USERNAME);
    if (existing) return existing;
  }

  return db('users')
    .where({ username: TEBLIGAT_PSEUDO_USERNAME })
    .first('id', 'username', 'role');
}

function enrichTebligatRecord(tebligat, pseudoUserId, usersById) {
  const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
  const noteEntries = normalizeNoteEntries(tebligat.notlar, {
    fallbackUserId: pseudoUserId,
    fallbackCreatedAt
  });
  const barkodEntries = normalizeBarkodEntries(tebligat.barkod, {
    fallbackUserId: pseudoUserId,
    fallbackCreatedAt
  });

  return {
    ...tebligat,
    noteEntries,
    barkodEntries,
    latestNoteEntry: noteEntries[0] || null,
    latestBarkodEntry: barkodEntries[0] || null,
    createdByUser: usersById[Number(tebligat.created_by)] || null
  };
}

router.get('/tebligatlar', requireAuth, async (req, res) => {
  try {
    const { ekleyen, icra_dairesi, muvekkil, durum } = req.query;

    let query = db('tebligatlar').orderBy('created_at', 'desc');

    if (ekleyen) {
      query = query.where('created_by', ekleyen);
    }
    if (icra_dairesi) {
      query = query.where('icra_dairesi', 'like', `%${icra_dairesi}%`);
    }
    if (muvekkil) {
      query = query.where('muvekkil', 'like', `%${muvekkil}%`);
    }
    if (durum) {
      query = query.where('durum', durum);
    }

    const rawTebligatlar = await query.select('*');
    const users = await db('users').select('id', 'username', 'role');
    const pseudoUser = await getToprakSezginUser(users);
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const usersById = Object.fromEntries(users.map((user) => [Number(user.id), user]));
    const tebligatlar = rawTebligatlar.map((tebligat) => enrichTebligatRecord(tebligat, pseudoUserId, usersById));

    res.render('tebligatlar', {
      tebligatlar,
      users,
      username: req.session.username,
      userId: req.session.userId,
      role: req.session.userRole,
      canEditCreatedBy: ['atayan', 'yonetici'].includes(req.session.userRole),
      filterEkleyen: ekleyen || '',
      filters: {
        ekleyen: ekleyen || '',
        icra_dairesi: icra_dairesi || '',
        muvekkil: muvekkil || '',
        durum: durum || ''
      }
    });
  } catch (err) {
    console.error('Tebligat list error', err);
    res.status(500).send('Listeleme hatasi');
  }
});

router.post('/tebligat/create', requireAuth, async (req, res) => {
  try {
    const { muvekkil, portfoy, taraf, tckn_vkn, barkod, dosya_no, icra_dairesi, durum, tarih, not } = req.body;
    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const initialBarkods = buildInitialEntries(barkod, 'barkod', pseudoUserId);
    const initialNotes = buildInitialEntries(not, 'note', pseudoUserId);

    await db('tebligatlar').insert({
      muvekkil,
      portfoy,
      taraf,
      tckn_vkn,
      barkod: serializeEntries(initialBarkods),
      dosya_no: dosya_no || null,
      icra_dairesi: icra_dairesi || null,
      durum: durum || 'itiraz',
      tarih: tarih || new Date().toISOString().split('T')[0],
      notlar: serializeEntries(initialNotes),
      created_by: req.session.userId,
      updated_by: req.session.userId
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat olusturma hatasi:', err);
    res.status(500).send('Tebligat olusturulamadi');
  }
});

router.post('/tebligat/:id/update', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { muvekkil, portfoy, taraf, tckn_vkn, barkod, dosya_no, icra_dairesi, durum, tarih, created_by, notlar } = req.body;

    const currentTebligat = await db('tebligatlar').where({ id }).first();

    if (!currentTebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = currentTebligat.updated_at || currentTebligat.created_at || new Date().toISOString();
    const resolvedBarkods = barkod === undefined
      ? normalizeBarkodEntries(currentTebligat.barkod, { fallbackUserId: pseudoUserId, fallbackCreatedAt })
      : normalizeBarkodEntries(serializeEntries(buildInitialEntries(barkod, 'barkod', pseudoUserId)), {
        fallbackUserId: pseudoUserId,
        fallbackCreatedAt
      });
    const resolvedNotes = notlar === undefined
      ? normalizeNoteEntries(currentTebligat.notlar, { fallbackUserId: pseudoUserId, fallbackCreatedAt })
      : normalizeNoteEntries(serializeEntries(buildInitialEntries(notlar, 'note', pseudoUserId)), {
        fallbackUserId: pseudoUserId,
        fallbackCreatedAt
      });

    const shouldArchive = durum === 'tebliğ' && req.session.userRole === 'yonetici';
    if (shouldArchive) {
      await db('tebligat_arsiv').insert({
        muvekkil: muvekkil || currentTebligat.muvekkil,
        portfoy: portfoy || currentTebligat.portfoy,
        taraf: taraf || currentTebligat.taraf,
        tckn_vkn: tckn_vkn || currentTebligat.tckn_vkn,
        barkod: barkodSummary(resolvedBarkods),
        dosya_no: dosya_no || currentTebligat.dosya_no,
        icra_dairesi: icra_dairesi || currentTebligat.icra_dairesi,
        durum,
        tarih: tarih || currentTebligat.tarih,
        notlar: noteSummary(resolvedNotes),
        created_by: created_by || currentTebligat.created_by,
        updated_by: req.session.userId,
        arsivlenme_tarihi: new Date().toISOString().split('T')[0],
        arsivleyen: req.session.userId
      });

      await db('tebligatlar').where({ id }).del();
    } else {
      await db('tebligatlar').where({ id }).update({
        muvekkil: muvekkil || null,
        portfoy: portfoy || null,
        taraf: taraf || null,
        tckn_vkn: tckn_vkn || null,
        barkod: barkod === undefined ? currentTebligat.barkod : serializeEntries(resolvedBarkods),
        dosya_no: dosya_no || null,
        icra_dairesi: icra_dairesi || null,
        durum: durum || 'gönderildi',
        tarih: tarih || null,
        created_by: created_by === undefined ? currentTebligat.created_by : (created_by || null),
        notlar: notlar === undefined ? currentTebligat.notlar : serializeEntries(resolvedNotes),
        updated_by: req.session.userId,
        updated_at: db.fn.now()
      });
    }

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat guncelleme hatasi:', err);
    res.status(500).send('Guncellenemedi');
  }
});

router.post('/tebligat/:id/update-status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { durum } = req.body;
    const tebligat = await db('tebligatlar').where({ id }).first();

    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
    const resolvedBarkods = normalizeBarkodEntries(tebligat.barkod, { fallbackUserId: pseudoUserId, fallbackCreatedAt });
    const resolvedNotes = normalizeNoteEntries(tebligat.notlar, { fallbackUserId: pseudoUserId, fallbackCreatedAt });

    const shouldArchive = durum === 'tebliğ' && req.session.userRole === 'yonetici';
    if (shouldArchive) {
      await db('tebligat_arsiv').insert({
        muvekkil: tebligat.muvekkil,
        portfoy: tebligat.portfoy,
        taraf: tebligat.taraf,
        tckn_vkn: tebligat.tckn_vkn,
        barkod: barkodSummary(resolvedBarkods),
        dosya_no: tebligat.dosya_no,
        icra_dairesi: tebligat.icra_dairesi,
        durum,
        tarih: tebligat.tarih,
        notlar: noteSummary(resolvedNotes),
        created_by: tebligat.created_by,
        updated_by: req.session.userId,
        arsivlenme_tarihi: new Date().toISOString().split('T')[0],
        arsivleyen: req.session.userId
      });

      await db('tebligatlar').where({ id }).del();
    } else {
      await db('tebligatlar').where({ id }).update({
        durum,
        updated_by: req.session.userId,
        updated_at: db.fn.now()
      });
    }

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat durum guncelleme hatasi:', err);
    res.status(500).send('Guncellenemedi');
  }
});

router.post('/tebligat/:id/barkodlar', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const barkodValue = String(req.body.barkod || '').trim();
    if (!barkodValue) {
      const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
      return res.redirect(redirectUrl);
    }

    const tebligat = await db('tebligatlar').where({ id }).first();
    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
    const barkodEntries = normalizeBarkodEntries(tebligat.barkod, { fallbackUserId: pseudoUserId, fallbackCreatedAt });

    barkodEntries.unshift({
      id: createEntryId('barkod'),
      value: barkodValue,
      user_id: pseudoUserId,
      username: TEBLIGAT_PSEUDO_USERNAME,
      created_at: new Date().toISOString()
    });

    await db('tebligatlar').where({ id }).update({
      barkod: serializeEntries(barkodEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat barkod ekleme hatasi:', err);
    res.status(500).send('Barkod eklenemedi');
  }
});

router.post('/tebligat/:id/barkodlar/:entryId/delete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const entryId = String(req.params.entryId || '');
    const tebligat = await db('tebligatlar').where({ id }).first();

    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
    const barkodEntries = normalizeBarkodEntries(tebligat.barkod, { fallbackUserId: pseudoUserId, fallbackCreatedAt });
    const nextEntries = barkodEntries.filter((entry) => entry.id !== entryId);

    if (nextEntries.length === barkodEntries.length) {
      return res.status(404).send('Barkod bulunamadi');
    }

    await db('tebligatlar').where({ id }).update({
      barkod: serializeEntries(nextEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat barkod silme hatasi:', err);
    res.status(500).send('Barkod silinemedi');
  }
});

router.post('/tebligat/:id/notes', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const noteText = String(req.body.note || '').trim();
    if (!noteText) {
      const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
      return res.redirect(redirectUrl);
    }

    const tebligat = await db('tebligatlar').where({ id }).first();
    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
    const noteEntries = normalizeNoteEntries(tebligat.notlar, { fallbackUserId: pseudoUserId, fallbackCreatedAt });

    noteEntries.unshift({
      id: createEntryId('note'),
      text: noteText,
      user_id: pseudoUserId,
      username: TEBLIGAT_PSEUDO_USERNAME,
      created_at: new Date().toISOString()
    });

    await db('tebligatlar').where({ id }).update({
      notlar: serializeEntries(noteEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat not ekleme hatasi:', err);
    res.status(500).send('Not eklenemedi');
  }
});

router.post('/tebligat/:id/notes/:entryId/delete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const entryId = String(req.params.entryId || '');
    const tebligat = await db('tebligatlar').where({ id }).first();

    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const fallbackCreatedAt = tebligat.updated_at || tebligat.created_at || new Date().toISOString();
    const noteEntries = normalizeNoteEntries(tebligat.notlar, { fallbackUserId: pseudoUserId, fallbackCreatedAt });
    const nextEntries = noteEntries.filter((entry) => entry.id !== entryId);

    if (nextEntries.length === noteEntries.length) {
      return res.status(404).send('Not bulunamadi');
    }

    await db('tebligatlar').where({ id }).update({
      notlar: serializeEntries(nextEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat not silme hatasi:', err);
    res.status(500).send('Not silinemedi');
  }
});

router.post('/tebligat/:id/update-barkod', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { barkod } = req.body;
    const tebligat = await db('tebligatlar').where({ id }).first();

    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const barkodEntries = buildInitialEntries(barkod, 'barkod', pseudoUserId);

    await db('tebligatlar').where({ id }).update({
      barkod: serializeEntries(barkodEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat barkod guncelleme hatasi:', err);
    res.status(500).send('Guncellenemedi');
  }
});

router.post('/tebligat/:id/update-not', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { notlar } = req.body;
    const tebligat = await db('tebligatlar').where({ id }).first();

    if (!tebligat) {
      return res.status(404).send('Tebligat bulunamadi');
    }

    const pseudoUser = await getToprakSezginUser();
    const pseudoUserId = pseudoUser ? Number(pseudoUser.id) : null;
    const noteEntries = buildInitialEntries(notlar, 'note', pseudoUserId);

    await db('tebligatlar').where({ id }).update({
      notlar: serializeEntries(noteEntries),
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat not guncelleme hatasi:', err);
    res.status(500).send('Guncellenemedi');
  }
});

router.post('/tebligat/:id/update-user', requireRole('atayan', 'yonetici'), async (req, res) => {
  try {
    const id = req.params.id;
    const { created_by } = req.body;
    await db('tebligatlar').where({ id }).update({
      created_by: created_by || null,
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat kullanici guncelleme hatasi:', err);
    res.status(500).send('Guncellenemedi');
  }
});

router.post('/tebligat/:id/delete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await db('tebligatlar').where({ id }).del();

    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat silme hatasi:', err);
    res.status(500).send('Silinemedi');
  }
});

module.exports = router;
