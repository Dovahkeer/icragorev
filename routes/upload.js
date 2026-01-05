const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { db } = require('../config/database');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const { computeAdliye } = require('../helpers/adliye');

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
      console.log('İcra Dairesi (raw):', row['İcra Dairesi']);
      console.log('İcra Esas Numarası:', row['İcra Esas Numarası']);
      console.log('Borçlu (raw):', row['Borçlu']);
      console.log('Borçlu TCKN-VKN (raw):', row['Borçlu TCKN-VKN'], 'Type:', typeof row['Borçlu TCKN-VKN']);
      
      if (!row['İcra Dairesi'] || !row['İcra Dairesi'].toString().trim()) {
        errors.push(`Satır ${rowNum}: İcra Dairesi boş olamaz`);
        continue;
      }
      
      const icraDairesi = row['İcra Dairesi'].toString().trim();
      const adliye = computeAdliye(icraDairesi);
      console.log('İcra Dairesi (orijinal):', icraDairesi);
      console.log('Computed adliye:', adliye);
      
      // Borçlu TCKN-VKN işleme - hem ayrı sütun hem de - ile ayrılmış format desteklenir
      let borcluTckn = '';
      let borcluAdi = '';
      
      // Önce "Borçlu TCKN-VKN" kolonunu kontrol et
      if (row['Borçlu TCKN-VKN']) {
        const tcknValue = row['Borçlu TCKN-VKN'];
        // Excel'de sayı olarak kaydedilmişse düzelt
        if (typeof tcknValue === 'number') {
          borcluTckn = Math.floor(tcknValue).toString().padStart(11, '0');
        } else {
          borcluTckn = tcknValue.toString().trim();
        }
      }
      
      // Borçlu adını al
      if (row['Borçlu']) {
        const borcluRaw = row['Borçlu'].toString().trim();
        
        // Eğer TCKN ayrı sütunda yoksa ve Borçlu kolonunda - varsa, oradan ayır
        if (!borcluTckn && borcluRaw.includes('-')) {
          const parts = borcluRaw.split('-').map(p => p.trim());
          if (parts.length >= 2) {
            borcluAdi = parts[0];
            const potentialTckn = parts[1];
            // Sayı gibi görünüyorsa TCKN olarak al
            if (/^\d+$/.test(potentialTckn)) {
              borcluTckn = potentialTckn.padStart(11, '0');
            }
          }
        } else {
          // - yoksa veya TCKN zaten varsa, tüm değeri isim olarak al
          borcluAdi = borcluRaw;
        }
      }
      
      console.log('Borçlu Adı (final):', borcluAdi);
      console.log('Borçlu TCKN (final):', borcluTckn);
      
      // Excel'den yüklenen görevler her zaman atama bekliyor olarak gelir
      validTasks.push({
        adliye,
        muvekkil: row['Müvekkil'] || '',
        portfoy: row['Portföy'] || '',
        borclu: borcluAdi,
        borclu_tckn_vkn: borcluTckn,
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
