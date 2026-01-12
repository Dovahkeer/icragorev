const express = require('express');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();


router.get('/tebligatlar', requireAuth, async (req, res) => {
  try {
    const { ekleyen, icra_dairesi, muvekkil, durum } = req.query;

    let query = db('tebligatlar').orderBy('created_at', 'desc');

    // Filtreleme - sadece gerekli alanlar
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

    const tebligatlar = await query.select('*');
    const users = await db('users').select('id', 'username');

    res.render('tebligatlar', {
      tebligatlar,
      users,
      username: req.session.username,
      userId: req.session.userId,
      role: req.session.userRole,
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
    res.status(500).send('Listeleme hatası');
  }
});

router.post('/tebligat/create', requireAuth, async (req, res) => {
  try {
    const { muvekkil, portfoy, taraf, tckn_vkn, barkod, dosya_no, icra_dairesi, durum, tarih, not } = req.body;
    await db('tebligatlar').insert({
      muvekkil, portfoy, taraf, tckn_vkn, barkod,
      dosya_no: dosya_no || null,
      icra_dairesi: icra_dairesi || null,
      durum: durum || 'itiraz',
      tarih: tarih || new Date().toISOString().split('T')[0],
      notlar: not || null,
      created_by: req.session.userId,
      updated_by: req.session.userId
    });
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat oluşturma hatası:', err);
    res.status(500).send('Tebligat oluşturulamadı');
  }
});

router.post('/tebligat/:id/update-status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { durum } = req.body;
    
    // Eğer durum "tebliğ" ise, arşive taşı
    if (durum === 'tebliğ') {
      const tebligat = await db('tebligatlar').where({ id }).first();
      
      // Tebligatı arşiv tablosuna ekle
      await db('tebligat_arsiv').insert({
        ...tebligat,
        arsivlenme_tarihi: new Date().toISOString().split('T')[0],
        arsivleyen: req.session.userId
      });
      
      // Tebligatı sil
      await db('tebligatlar').where({ id }).del();
    } else {
      await db('tebligatlar').where({ id }).update({ durum, updated_by: req.session.userId, updated_at: db.fn.now() });
    }
    
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat durum güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-barkod', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { barkod } = req.body;
    await db('tebligatlar').where({ id }).update({ barkod, updated_by: req.session.userId, updated_at: db.fn.now() });
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat barkod güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-not', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { notlar } = req.body;
    await db('tebligatlar').where({ id }).update({ notlar, updated_by: req.session.userId, updated_at: db.fn.now() });
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat not güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-user', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { created_by } = req.body;
    await db('tebligatlar').where({ id }).update({ created_by: created_by || null, updated_by: req.session.userId, updated_at: db.fn.now() });
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat kullanıcı güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/delete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await db('tebligatlar').where({ id }).del();
    return res.redirect('/tebligatlar');
  } catch (err) {
    console.error('Tebligat silme hatası:', err);
    res.status(500).send('Silinemedi');
  }
});

module.exports = router;
