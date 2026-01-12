const express = require('express');
const session = require('express-session');
const path = require('path');
const { initDatabase } = require('./config/database');

const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const uploadRoutes = require('./routes/upload');
const downloadRoutes = require('./routes/download');
const tebligatRoutes = require('./routes/tebligat');
const usersRoutes = require('./routes/users');

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
app.use('/', usersRoutes);

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.redirect('/login');
});

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    const os = require('os');
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    // Find local IP address
    for (const interfaceName in networkInterfaces) {
      for (const iface of networkInterfaces[interfaceName]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          localIP = iface.address;
          break;
        }
      }
    }
    
    console.log(`\n✓ Sunucu çalışıyor!`);
    console.log(`  - Yerel erişim: http://localhost:${PORT}`);
    console.log(`  - Ağ erişimi: http://${localIP}:${PORT}`);
    console.log(`\n✓ Atayanlar (pit10): ozlemkoksal, serenaozyilmaz, topraksezgin`);
    console.log(`✓ Yöneticiler (123456): ilaydaerdogan, ozgeaslan`);
    console.log(`✓ Atananlar (123456): omercanoruc, melissaozturk, ademcanozkan, nisanurakyildiz, sevvalaslanboga, cansubozbek\n`);
  });
}).catch(error => {
  console.error('Başlatma hatası:', error);
  process.exit(1);
});
