# Görev Yönetimi Sistemi

10 kişilik ofis için rol bazlı görev yönetimi web uygulaması.

## Özellikler

- **3 Rol**: Atayan, Yönetici, Atanan
- Görev oluşturma, atama, durum takibi
- Excel'den toplu görev yükleme
- Rol bazlı yetkilendirme
- Görev geçmişi ve arşiv

## Kurulum

```bash
npm install
npm start
```

Uygulama `http://localhost:3000` adresinde çalışacak.

## Varsayılan Kullanıcılar

| Kullanıcı Adı | Şifre  | Rol      |
|---------------|--------|----------|
| atayan1       | 123456 | atayan   |
| yonetici1     | 123456 | yonetici |
| atanan1       | 123456 | atanan   |
| atanan2       | 123456 | atanan   |

## İş Akışı

### Atayan
- Görev oluşturur (manuel veya Excel ile)
- Yönetici tarafından onaylanan görevleri son onaylar
- Arşivlenmiş görevleri görüntüler

### Yönetici
- Gelen görevleri atananlara dağıtır
- Tamamlanan görevleri kontrol eder
- Uygun/İade kararı verir

### Atanan
- Atanan görevleri görür
- Durum günceller (tamamlanmadı, kontrol ediliyor, tamamlandı, tamamlanamıyor, iade)
- Tamamlandı/Tamamlanamıyor seçildiğinde yöneticiye gider

## Excel Şablonu

Kolonlar:
- **Title**: Görev başlığı (zorunlu)
- **Description**: Açıklama
- **AssigneeUsername**: Atanacak kullanıcı adı
- **DueDate**: Bitiş tarihi (YYYY-MM-DD)
- **Status**: Durum (tamamlanmadi, kontrol_ediliyor, vb.)

## Teknolojiler

- Node.js + Express
- SQLite + Knex
- EJS (template engine)
- bcrypt (şifre güvenliği)
- express-session (oturum yönetimi)
- multer + xlsx (Excel yükleme)
