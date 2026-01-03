const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const uploadRoutes = require('./routes/upload');
const downloadRoutes = require('./routes/download');
const tebligatRoutes = require('./routes/tebligat');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

app.use(session({
  secret: 'task-manager-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

app.use('/', authRoutes);
app.use('/', taskRoutes);
app.use('/', uploadRoutes);
app.use('/', downloadRoutes);
app.use('/', tebligatRoutes);

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`\n✓ Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`✓ Atayanlar (pit10): ozlemkoksal, serenaozyilmaz, topraksezgin`);
    console.log(`✓ Yöneticiler (123456): ilaydaerdogan, ozgeaslan`);
    console.log(`✓ Atananlar (123456): omercanoruc, melissaozturk, ademcanozkan, nisanurakyildiz, sevvalaslanboga, cansubozbek\n`);
  });
}).catch(error => {
  console.error('Başlatma hatası:', error);
  process.exit(1);
});
