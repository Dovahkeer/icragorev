# İcra Takip Excel Şablonu

Excel dosyanızı aşağıdaki formatta hazırlayın:

| Adliye | Müvekkil | Portföy | Borçlu | Borçlu TCKN-VKN | İcra Dairesi | İcra Esas Numarası | İŞLEM TÜRÜ | İşlem AÇIKLAMASI | ÖNCELİK | İşlemi Gönderen | Eklenme Tarihi |
|--------|----------|---------|--------|-----------------|--------------|-------------------|------------|------------------|---------|----------------|----------------|
| ÇAĞLAYAN | GSD | Fiba 01 | Ahmet Yılmaz | 12345678901 | İstanbul 5. İcra Dairesi | 2024/1234 | Kesinleştirme Yapılacak | Dosya kesinleştirilecek | acil | omercanoruc | 2024-12-15 |
| ANADOLU | Doğru | YKB 02 | Mehmet Demir | 98765432109 | İstanbul Anadolu 12. İcra | 2024/5678 | Tebligat Çıkarılacak | Borçluya tebligat çıkarılacak | rutin | melissaozturk | 2024-12-14 |

## Kolon Açıklamaları

### Adliye (Otomatik)
İcra Dairesi kolonuna göre otomatik hesaplanır:
- İstanbul Anadolu → ANADOLU
- Bakırköy → BAKIRKÖY
- İstanbul → ÇAĞLAYAN
- İzmir → İZMİR
- Antalya → ANTALYA
- Adana → ADANA
- Diğer → DİĞER

### Müvekkil (Zorunlu)
Seçenekler: GSD, Doğru, Sümer, Ulusal, Birikim, Emir, Birleşim

### Portföy (Zorunlu)
Seçenekler:
- Fiba 01, 02, 03, 04
- Anadolu
- YKB 01, 02, 03, 04
- İşbank Bireysel 01, 02
- İşbank 01, 02, 03
- Şeker
- Garantibank
- Garanti Faktöring
- İNG

### İŞLEM TÜRÜ (Zorunlu)
Seçenekler:
- Kesinleştirme Yapılacak
- Tebligat Çıkarılacak
- Taşınmaz Haczi
- Araç Haczi
- Dosya Yenileme
- Banka Blokesi
- Maaş Haczi
- Mazbatalar Taratılacak
- Vekil Kaydı
- İade İstenecek
- Rehin Açığı Belgesi Alınacak
- Reddiyat Yapılacak
- Takip Başlatılacak
- Eksik Evraklar Taratılacak
- Tebliagata Yarar Adres İstenecek
- Borçlu Bilgileri Eklenecek
- Kuruma 89/1 Gönderilecek
- Taraf Kaydı Düzeltilecek
- Yeni Esas Alınacak
- Ödeme Emri Düzenlenecek
- Borçlu Eklenecek
- Alacaklı olduğu icra dosyasına haciz konulacak

### ÖNCELİK
- acil
- rutin (varsayılan)

### İşlemi Gönderen
Atanacak kişinin kullanıcı adı (opsiyonel)
Kullanıcılar: omercanoruc, melissaozturk, ademcanozkan, nisanurakyildiz, sevvalaslanboga, cansubozbek

### Eklenme Tarihi
YYYY-MM-DD formatında (örn: 2024-12-15)
Boş bırakılırsa bugünün tarihi kullanılır

## Notlar

- Excel dosyası .xlsx veya .xls formatında olmalı
- İlk satır başlık satırıdır
- İcra Dairesi zorunludur
- Hatalı satırlar atlanır ve rapor edilir
- Geçerli satırlar toplu olarak eklenir
