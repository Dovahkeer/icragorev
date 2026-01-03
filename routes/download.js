const express = require('express');
const XLSX = require('xlsx');

const router = express.Router();

router.get('/download-template', (req, res) => {
  try {
    const wb = XLSX.utils.book_new();
    
    const templateData = [
      {
        'Müvekkil': 'GSD',
        'Portföy': 'Fiba 01',
        'Borçlu': 'Ahmet Yılmaz',
        'Borçlu TCKN-VKN': '12345678901',
        'İcra Dairesi': 'İstanbul 5. İcra Dairesi',
        'İcra Esas Numarası': '2024/1234',
        'İŞLEM TÜRÜ': 'Kesinleştirme Yapılacak',
        'İşlem AÇIKLAMASI': 'Dosya kesinleştirilecek',
        'ÖNCELİK': 'acil',
        'Eklenme Tarihi': '2024-12-16'
      }
    ];
    
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Kolon genişlikleri
    ws['!cols'] = [
      { wch: 12 }, // Müvekkil
      { wch: 15 }, // Portföy
      { wch: 20 }, // Borçlu
      { wch: 18 }, // Borçlu TCKN-VKN
      { wch: 30 }, // İcra Dairesi
      { wch: 15 }, // İcra Esas Numarası
      { wch: 30 }, // İŞLEM TÜRÜ
      { wch: 40 }, // İşlem AÇIKLAMASI
      { wch: 10 }, // ÖNCELİK
      { wch: 15 }  // Eklenme Tarihi
    ];
    
    XLSX.utils.book_append_sheet(wb, ws, 'Görevler');
    
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename=icra-takip-template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
  } catch (error) {
    console.error('Template indirme hatası:', error);
    res.status(500).send('Template oluşturulamadı');
  }
});

module.exports = router;
