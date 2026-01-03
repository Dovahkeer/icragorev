const express = require('express');
const bcrypt = require('bcrypt');
const { db } = require('../config/database');
const { loginLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.get('/login', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.render('login', { error: null });
});

router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const user = await db('users').where({ username }).first();
    
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.render('login', { error: 'Kullanıcı adı veya şifre hatalı' });
    }
    
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.userRole = user.role;
    
    res.redirect('/dashboard');
  } catch (error) {
    console.error('Login hatası:', error);
    res.render('login', { error: 'Bir hata oluştu' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

module.exports = router;
