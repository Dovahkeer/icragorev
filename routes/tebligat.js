const express = require('express');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Helper function: Filtreleri koruyarak redirect URL'i oluştur
function buildRedirectUrl(baseUrl, query) {
  const params = new URLSearchParams();
  if (query.ekleyen) params.append('ekleyen', query.ekleyen);
  if (query.icra_dairesi) params.append('icra_dairesi', query.icra_dairesi);
  if (query.muvekkil) params.append('muvekkil', query.muvekkil);
  if (query.durum) params.append('durum', query.durum);

  const queryString = params.toString();
  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

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

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat oluşturma hatası:', err);
    res.status(500).send('Tebligat oluşturulamadı');
  }
});

// Genel güncelleme endpoint'i (Modal formdan gelecek)
router.post('/tebligat/:id/update', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { muvekkil, portfoy, taraf, tckn_vkn, barkod, dosya_no, icra_dairesi, durum, tarih, created_by, notlar } = req.body;

    // Mevcut tebligatı al
    const currentTebligat = await db('tebligatlar').where({ id }).first();

    if (!currentTebligat) {
      return res.status(404).send('Tebligat bulunamadı');
    }

    // Eğer durum "tebliğ" (Kesinleşti) veya "itiraz" ise, arşive taşı
    if (durum === 'tebliğ' || durum === 'itiraz') {
      // Tebligatı arşiv tablosuna ekle
      await db('tebligat_arsiv').insert({
        muvekkil: muvekkil || currentTebligat.muvekkil,
        portfoy: portfoy || currentTebligat.portfoy,
        taraf: taraf || currentTebligat.taraf,
        tckn_vkn: tckn_vkn || currentTebligat.tckn_vkn,
        barkod: barkod || currentTebligat.barkod,
        dosya_no: dosya_no || currentTebligat.dosya_no,
        icra_dairesi: icra_dairesi || currentTebligat.icra_dairesi,
        durum: durum,
        tarih: tarih || currentTebligat.tarih,
        notlar: notlar || currentTebligat.notlar,
        created_by: created_by || currentTebligat.created_by,
        updated_by: req.session.userId,
        arsivlenme_tarihi: new Date().toISOString().split('T')[0],
        arsivleyen: req.session.userId
      });

      // Tebligatı sil
      await db('tebligatlar').where({ id }).del();
    } else {
      // Normal güncelleme
      await db('tebligatlar').where({ id }).update({
        muvekkil: muvekkil || null,
        portfoy: portfoy || null,
        taraf: taraf || null,
        tckn_vkn: tckn_vkn || null,
        barkod: barkod || null,
        dosya_no: dosya_no || null,
        icra_dairesi: icra_dairesi || null,
        durum: durum || 'gönderildi',
        tarih: tarih || null,
        created_by: created_by || null,
        notlar: notlar || null,
        updated_by: req.session.userId,
        updated_at: db.fn.now()
      });
    }

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-status', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { durum } = req.body;

    // Eğer durum "tebliğ" (Kesinleşti) veya "itiraz" ise, arşive taşı
    if (durum === 'tebliğ' || durum === 'itiraz') {
      const tebligat = await db('tebligatlar').where({ id }).first();

      if (tebligat) {
        // Tebligatı arşiv tablosuna ekle
        await db('tebligat_arsiv').insert({
          muvekkil: tebligat.muvekkil,
          portfoy: tebligat.portfoy,
          taraf: tebligat.taraf,
          tckn_vkn: tebligat.tckn_vkn,
          barkod: tebligat.barkod,
          dosya_no: tebligat.dosya_no,
          icra_dairesi: tebligat.icra_dairesi,
          durum: durum, // Güncel durumu kaydet
          tarih: tebligat.tarih,
          notlar: tebligat.notlar,
          created_by: tebligat.created_by,
          updated_by: req.session.userId,
          arsivlenme_tarihi: new Date().toISOString().split('T')[0],
          arsivleyen: req.session.userId
        });

        // Tebligatı sil
        await db('tebligatlar').where({ id }).del();
      }
    } else {
      // Diğer durumlar için sadece güncelle
      await db('tebligatlar').where({ id }).update({
        durum,
        updated_by: req.session.userId,
        updated_at: db.fn.now()
      });
    }

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat durum güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-barkod', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { barkod } = req.body;
    await db('tebligatlar').where({ id }).update({
      barkod,
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat barkod güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-not', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { notlar } = req.body;
    await db('tebligatlar').where({ id }).update({
      notlar,
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat not güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/update-user', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const { created_by } = req.body;
    await db('tebligatlar').where({ id }).update({
      created_by: created_by || null,
      updated_by: req.session.userId,
      updated_at: db.fn.now()
    });

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat kullanıcı güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

router.post('/tebligat/:id/delete', requireAuth, async (req, res) => {
  try {
    const id = req.params.id;
    await db('tebligatlar').where({ id }).del();

    // Filtreleri koruyarak redirect
    const redirectUrl = buildRedirectUrl('/tebligatlar', req.query);
    return res.redirect(redirectUrl);
  } catch (err) {
    console.error('Tebligat silme hatası:', err);
    res.status(500).send('Silinemedi');
  }
});

module.exports = router;
