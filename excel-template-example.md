# Excel Şablon Örneği

Excel dosyanızı aşağıdaki formatta hazırlayın:

| Title | Description | AssigneeUsername | DueDate | Status |
|-------|-------------|------------------|---------|--------|
| Rapor hazırla | Aylık satış raporu | atanan1 | 2024-12-20 | tamamlanmadi |
| Toplantı düzenle | Haftalık ekip toplantısı | atanan2 | 2024-12-18 | tamamlanmadi |
| Sunum yap | Proje sunumu | atanan1 | 2024-12-25 | tamamlanmadi |

## Kolon Açıklamaları

- **Title** (zorunlu): Görev başlığı
- **Description**: Görev açıklaması (opsiyonel)
- **AssigneeUsername**: Atanacak kullanıcı adı (opsiyonel, boş bırakılırsa yönetici atar)
- **DueDate**: Bitiş tarihi YYYY-MM-DD formatında (opsiyonel)
- **Status**: Durum (opsiyonel, varsayılan: tamamlanmadi)

## Geçerli Durum Değerleri

- tamamlanmadi
- kontrol_ediliyor
- tamamlandi
- tamamlanamıyor
- iade

## Notlar

- Excel dosyası .xlsx veya .xls formatında olmalı
- İlk satır başlık satırıdır
- Hatalı satırlar atlanır ve rapor edilir
- Geçerli satırlar toplu olarak eklenir
