const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// helper: normalize strings for robust matching (unicode normalize, remove combining marks)
const normalizeText = (s) => {
  if (!s && s !== 0) return '';
  let str = String(s).normalize('NFKD').toLowerCase();
  // remove combining diacritical marks
  str = str.replace(/\p{M}/gu, '');
  const map = { 'ç': 'c', 'ğ': 'g', 'ı': 'i', 'ö': 'o', 'ş': 's', 'ü': 'u', 'İ': 'i' };
  str = str.replace(/[çğıöşüİ]/g, ch => map[ch] || ch);
  str = str.replace(/[^a-z0-9\s]/g, ' ');
  str = str.replace(/\s+/g, ' ').trim();
  return str;
};

const computeAdliye = (icra_dairesi) => {
  const d = normalizeText(icra_dairesi || '');
  if (!d) return 'DİĞER';
  try { console.log('[upload.computeAdliye] input:', icra_dairesi, 'normalized:', d); } catch (e) {}
  if (d.includes('anadolu')) return 'ANADOLU';
  if (d.includes('bakirkoy') || d.includes('bakirky') || d.includes('bakirköy')) return 'BAKIRKÖY';
  if (d.includes('caglayan') || d.includes('cagla') || d.includes('çağlayan')) return 'ÇAĞLAYAN';
  if (d.includes('istanbul')) return 'ÇAĞLAYAN';
  if (d.includes('izmir')) return 'İZMİR';
  if (d.includes('antalya')) return 'ANTALYA';
  if (d.includes('adana')) return 'ADANA';
  return 'DİĞER';
};

router.post('/upload-excel', requireRole('atayan', 'yonetici'), upload.single('excelFile'), async (req, res) => {
  console.log('📤 Excel yükleme isteği alındı');
  
  if (!req.file) {
    console.log('❌ Dosya yüklenmedi');
    return res.status(400).send('Dosya yüklenmedi');
  }
  
  console.log('✓ Dosya alındı:', req.file.originalname, 'Boyut:', req.file.size);
  
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet);
    
    console.log('✓ Excel okundu. Satır sayısı:', data.length);
    console.log('✓ İlk satır kolonları:', Object.keys(data[0] || {}));
    
    const errors = [];
    const validTasks = [];
    
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2;
      
      console.log(`\n--- Satır ${rowNum} ---`);
      console.log('İcra Dairesi:', row['İcra Dairesi']);
      console.log('İcra Esas Numarası:', row['İcra Esas Numarası']);
      console.log('Borçlu:', row['Borçlu']);
      console.log('Borçlu TCKN-VKN:', row['Borçlu TCKN-VKN']);
      
      if (!row['İcra Dairesi'] || !row['İcra Dairesi'].toString().trim()) {
        errors.push(`Satır ${rowNum}: İcra Dairesi boş olamaz`);
        continue;
      }
      
      const icraDairesi = row['İcra Dairesi'].toString();
      const adliye = computeAdliye(icraDairesi);
      console.log('İcra Dairesi (orijinal):', icraDairesi);
      console.log('Computed adliye:', adliye);
      
      // Excel'den yüklenen görevler her zaman atama bekliyor olarak gelir
      validTasks.push({
        adliye,
        muvekkil: row['Müvekkil'] || '',
        portfoy: row['Portföy'] || '',
        borclu: row['Borçlu'] || '',
        borclu_tckn_vkn: row['Borçlu TCKN-VKN'] ? row['Borçlu TCKN-VKN'].toString() : '',
        icra_dairesi: icraDairesi,
        icra_esas_no: row['İcra Esas Numarası'] ? row['İcra Esas Numarası'].toString() : '',
        islem_turu: row['İŞLEM TÜRÜ'] || '',
        islem_aciklamasi: row['İşlem AÇIKLAMASI'] || '',
        oncelik: row['ÖNCELİK'] && row['ÖNCELİK'].toLowerCase() === 'acil' ? 'acil' : 'rutin',
        eklenme_tarihi: row['Eklenme Tarihi'] || new Date().toISOString().split('T')[0],
        assignee_id: null, // Excel'den yüklenen görevler atama bekler
        status: 'tamamlanmadi',
        creator_id: req.session.userId,
        last_status_by: req.session.userId
      });
    }
    
    console.log('✓ Geçerli görev sayısı:', validTasks.length);
    console.log('✗ Hata sayısı:', errors.length);
    
    if (validTasks.length > 0) {
      await db('tasks').insert(validTasks);
      console.log('✓ Görevler veritabanına eklendi');
    }
    
    const message = `
      <h3>Excel Yükleme Sonucu</h3>
      <p>✓ Başarılı: ${validTasks.length} görev eklendi</p>
      ${errors.length > 0 ? `<p>✗ Hata: ${errors.length} satır atlandı</p><ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>` : ''}
      <a href="/dashboard">Görev Paneline Dön</a>
    `;
    
    res.send(message);
  } catch (error) {
    console.error('Excel yükleme hatası:', error);
    res.status(500).send('Excel dosyası işlenemedi: ' + error.message);
  }
});

module.exports = router;
