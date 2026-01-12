const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Kullanıcı listesi (sadece yönetici)
router.get('/users', requireAuth, requireRole(['yonetici']), async (req, res) => {
  try {
    const { role, search } = req.query;
    
    let query = db('users').select('id', 'username', 'role', 'created_at').orderBy('created_at', 'desc');
    
    if (role) {
      query = query.where('role', role);
    }
    
    if (search) {
      query = query.where('username', 'like', `%${search}%`);
    }
    
    const users = await query;
    
    res.render('users', {
      users,
      username: req.session.username,
      userId: req.session.userId,
      role: req.session.userRole,
      filterRole: role || '',
      filterSearch: search || ''
    });
  } catch (err) {
    console.error('Kullanıcı listesi hatası:', err);
    res.status(500).send('Listeleme hatası');
  }
});

// Kullanıcı oluştur
router.post('/users/create', requireAuth, requireRole(['yonetici']), async (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).send('Tüm alanlar gerekli');
    }
    
    const existingUser = await db('users').where({ username }).first();
    if (existingUser) {
      return res.status(400).send('Bu kullanıcı adı zaten kullanılıyor');
    }
    
    const passwordHash = await bcrypt.hash(password, 10);
    
    await db('users').insert({
      username,
      password_hash: passwordHash,
      role
    });
    
    res.redirect('/users');
  } catch (err) {
    console.error('Kullanıcı oluşturma hatası:', err);
    res.status(500).send('Kullanıcı oluşturulamadı');
  }
});

// Kullanıcı güncelle
router.post('/users/:id/update', requireAuth, requireRole(['yonetici']), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, role, password } = req.body;
    
    const updateData = { username, role };
    
    if (password && password.trim() !== '') {
      updateData.password_hash = await bcrypt.hash(password, 10);
    }
    
    await db('users').where({ id }).update(updateData);
    
    res.redirect('/users');
  } catch (err) {
    console.error('Kullanıcı güncelleme hatası:', err);
    res.status(500).send('Güncellenemedi');
  }
});

// Kullanıcı sil
router.post('/users/:id/delete', requireAuth, requireRole(['yonetici']), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Kendi hesabını silemesin
    if (parseInt(id) === req.session.userId) {
      return res.status(400).send('Kendi hesabınızı silemezsiniz');
    }
    
    await db('users').where({ id }).del();
    
    res.redirect('/users');
  } catch (err) {
    console.error('Kullanıcı silme hatası:', err);
    res.status(500).send('Silinemedi');
  }
});

module.exports = router;
