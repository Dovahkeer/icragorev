const express = require('express');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();


router.get('/tebligatlar', requireAuth, async (req, res) => {
  try {
    const tebligatlar = await db('tebligatlar').orderBy('created_at', 'desc').select('*');
    const users = await db('users').select('id', 'username');
    res.render('tebligatlar', {
      tebligatlar,
      users,
      username: req.session.username,
      role: req.session.userRole
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

router.post('/tebligat/:id/update-status', requireRole('yonetici'), async (req, res) => {
  try {
    const id = req.params.id;
    const { durum } = req.body;
    await db('tebligatlar').where({ id }).update({ durum, updated_by: req.session.userId, updated_at: db.fn.now() });
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

router.post('/tebligat/:id/delete', requireRole('yonetici'), async (req, res) => {
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
