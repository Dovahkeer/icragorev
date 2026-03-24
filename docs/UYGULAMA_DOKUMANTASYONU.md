# İcra Görev Takip Sistemi - Kapsamlı Dokümantasyon

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Kullanıcı Rolleri ve Yetkileri](#kullanıcı-rolleri-ve-yetkileri)
3. [Öncelik Sistemi](#öncelik-sistemi)
4. [Son Gün ve Otomatik Terfi](#son-gün-ve-otomatik-terfi)
5. [Görev Oluşturma Formu](#görev-oluşturma-formu)
6. [Görev Atama Akış Şeması](#görev-atama-akış-şeması)
7. [İade Akış Şeması](#iade-akış-şeması)
8. [Otomatik Adliye Listesi Akışı](#otomatik-adliye-listesi-akışı)
9. [Ofis Transfer Akışı](#ofis-transfer-akışı)
10. [Excel Toplu İçe Aktarma Akışı](#excel-toplu-içe-aktarma-akışı)
11. [Atama Ekranı ve Kullanıcı İş Yükü](#atama-ekranı-ve-kullanıcı-iş-yükü)
12. [Tüm Görevler Sayfası (Toplu Görüntüleme)](#tüm-görevler-sayfası-toplu-görüntüleme)
13. [Arşiv Sistemi](#arşiv-sistemi)
14. [Veritabanı Şeması](#veritabanı-şeması)
15. [API Endpoint'leri](#api-endpointleri)
16. [Sayfa ve Bileşen Yapısı](#sayfa-ve-bileşen-yapısı)
17. [Durum (Status) Makinesi](#durum-status-makinesi)
18. [İşlem Türleri](#işlem-türleri)
19. [Müvekkil ve Portföy Listesi](#müvekkil-ve-portföy-listesi)
20. [Dosya Yapısı](#dosya-yapısı)

---

## Genel Bakış

İcra Görev Takip Sistemi, icra takip işlemlerini yöneten bir hukuk bürosu için geliştirilmiş rol tabanlı görev yönetim uygulamasıdır. Sistem, görev oluşturma, atama, kontrol, onay ve arşivleme süreçlerini uçtan uca yönetir.

---

## Kullanıcı Rolleri ve Yetkileri

### 1. Atayan (Görev Oluşturucu) - Yönetici
- Görev oluşturur (manuel veya Excel)
- Son onay verir
- Arşivden silme yetkisine sahiptir
- Veritabanını temizleyebilir (`/admin/clear-db`)
- Kendi oluşturduğu görevi silebilir

### 2. Yönetici (Kontrol Eden) - Editör
- Görev oluşturabilir
- Görevleri atananlara dağıtır
- Tamamlanan görevleri kontrol eder (Uygun / İade)
- Son onay verebilir
- Ofis transferi yapabilir
- Kullanıcı yönetimi (`/users`)

### 3. Atanan (Görev Yapan) - Kullanıcı
- Kendisine atanan görevleri görür
- Görev durumunu günceller (Yapılıyor, Tamamlandı, Tamamlanamıyor)
- Not ekleyebilir

---

## Öncelik Sistemi

Görevlerin üç kademeli bir öncelik seviyesi vardır:

### Öncelik Seviyeleri

| Öncelik | Renk Kodu | Badge Rengi | Kart Arka Planı | Davranış |
|---------|-----------|-------------|-----------------|----------|
| **ACİL** | Kırmızı `#e74c3c` | Kırmızı (pulse animasyonlu) | `#fff5f5` (açık kırmızı) | **Her zaman listenin en üstünde** görünür |
| **ÖNEMLİ** | Turuncu `#f39c12` | Turuncu | `#fffbf0` (açık sarı) | Normal sıralamada, farklı renkle vurgulanır |
| **RUTİN** | Gri `#95a5a6` | Gri | Beyaz (standart) | Normal sıralamada, standart görünüm |

### Sıralama Mantığı

Tüm görev listelerinde aşağıdaki sıralama uygulanır:

```
ORDER BY
  CASE
    WHEN oncelik = 'acil' THEN 0       ← Her zaman en üstte
    WHEN oncelik = 'onemli' THEN 1     ← Ortada (normal sıra)
    ELSE 2                              ← En altta (normal sıra)
  END,
  created_at DESC                       ← Aynı önceliktekiler yeniden eskiye
```

### Görsel Hiyerarşi

```
┌─────────────────────────────────────────────────────────┐
│  GÖREV LİSTESİ                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── ACİL GÖREVLER (Kırmızı kenarlık) ─────────────┐  │
│  │ 🔥 Görev A - Acil          [kırmızı badge, pulse] │  │
│  │ 🔥 Görev B - Acil          [kırmızı badge, pulse] │  │
│  │ 🔥 Görev C - Son günü geçmiş [otomatik acil]      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── ÖNEMLİ GÖREVLER (Turuncu kenarlık) ───────────┐  │
│  │ ⚠️ Görev D - Önemli        [turuncu badge]        │  │
│  │ ⚠️ Görev E - Önemli        [turuncu badge]        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── RUTİN GÖREVLER (Standart) ────────────────────┐  │
│  │ 📋 Görev F - Rutin          [gri badge]           │  │
│  │ 📋 Görev G - Rutin          [gri badge]           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### CSS Sınıfları

| Sınıf | Kullanım |
|-------|----------|
| `.badge-urgent` | Acil badge (kırmızı, pulse animasyonu) |
| `.badge-important` | Önemli badge (turuncu) |
| `.badge-normal` | Rutin badge (gri) |
| `.task-card.urgent` | Acil görev kartı (kırmızı sol kenarlık, açık kırmızı arka plan) |
| `.task-card.important` | Önemli görev kartı (turuncu sol kenarlık, açık sarı arka plan) |
| `.urgent-row` | Acil tablo satırı |
| `.important-row` | Önemli tablo satırı |

---

## Son Gün ve Otomatik Terfi

### Son Gün Alanı

- Görev oluşturulurken opsiyonel bir **"Son Gün"** tarihi girilebilir
- Son gün zorunlu değildir (nullable)
- Veritabanı alanı: `son_gun` (DATE tipi)

### Otomatik Acile Terfi Mekanizması

Son günü gelen veya geçen görevler **otomatik olarak ACİL önceliğine yükseltilir**.

```
┌─────────────────────────────────────────────────────────┐
│          SON GÜN OTOMATİK TERFİ AKIŞI                   │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Sayfa       │  Kullanıcı dashboard, tüm görevler
  │  Yüklenir    │  veya arşiv sayfasını açar
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  autoPromoteExpiredDeadlines()       │
  │                                      │
  │  Sorgu:                              │
  │  UPDATE tasks                        │
  │  SET oncelik = 'acil'               │
  │  WHERE son_gun <= BUGÜN             │
  │    AND oncelik != 'acil'            │
  │    AND status != 'arsiv'            │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  Etkilenen görevler artık:           │
  │  - ACİL badge ile görünür            │
  │  - Listenin EN ÜSTÜNDE sıralanır     │
  │  - Kırmızı vurguyla gösterilir       │
  │  - oncelik DB'de 'acil' olarak kalır │
  └──────────────────────────────────────┘
```

### Terfi Kuralları

| Koşul | Sonuç |
|-------|-------|
| `son_gun <= bugün` VE `oncelik = 'rutin'` | → `oncelik = 'acil'` |
| `son_gun <= bugün` VE `oncelik = 'onemli'` | → `oncelik = 'acil'` |
| `son_gun <= bugün` VE `oncelik = 'acil'` | Değişiklik yok (zaten acil) |
| `status = 'arsiv'` | Terfi yapılmaz (arşivdeki görevler etkilenmez) |
| `son_gun = NULL` | Terfi yapılmaz (son gün girilmemiş) |

### Terfi Zamanlaması

Otomatik terfi fonksiyonu şu sayfa yüklemelerinde çalışır:
- `GET /dashboard` — Ana panel
- `GET /all-tasks` — Tüm görevler sayfası
- `GET /archive` — Arşiv sayfası

---

## Görev Oluşturma Formu

Görev oluşturma formu, Atayan ve Yönetici rollerinin kullanabileceği manuel görev giriş arayüzüdür.

### Form Alanları

| # | Alan | Tip | Zorunlu | Açıklama |
|---|------|-----|---------|----------|
| 1 | **Müvekkil** | Dropdown | ✅ Evet | Öntanımlı müvekkil listesinden seçim |
| 2 | **Portföy** | Dropdown | ✅ Evet | Öntanımlı portföy listesinden seçim |
| 3 | **Borçlu** | Metin | Hayır | Borçlu adı soyadı |
| 4 | **Borçlu TCKN/VKN** | Metin | Hayır | TC Kimlik No veya Vergi Kimlik No |
| 5 | **İcra Dairesi** | Metin | ✅ Evet | İcra dairesi tam adı (adliye otomatik hesaplanır) |
| 6 | **İcra Esas No** | Metin | Hayır | Dosya numarası |
| 7 | **İşlem Türü** | Dropdown | ✅ Evet | Öntanımlı işlem türü listesinden seçim |
| 8 | **İşlem Açıklaması** | Textarea | ✅ Evet | Detaylı açıklama |
| 9 | **Öncelik** | Dropdown | ✅ Evet | Rutin / Önemli / Acil |
| 10 | **Son Gün** | Date Picker | ❌ Hayır | Opsiyonel son tarih (geçince otomatik acil olur) |
| 11 | **Eklenme Tarihi** | Date Picker | Hayır | Varsayılan: bugünün tarihi |

### Form Akışı

```
  ┌──────────────────────────────────────────────────┐
  │  GÖREV OLUŞTURMA FORMU                           │
  │                                                   │
  │  Müvekkil    [▼ GSD, Doğru, Sümer...]            │
  │  Portföy     [▼ Fiba 01, YKB 01...]              │
  │  Borçlu      [____________________]              │
  │  TCKN/VKN    [____________________]              │
  │  İcra Dairesi [____________________] ← zorunlu   │
  │  İcra Esas No [____________________]             │
  │  İşlem Türü  [▼ Kesinleştirme, Tebligat...]     │
  │  İşlem Açıkl [________________________]          │
  │  Öncelik     [▼ Rutin | Önemli | Acil ]          │
  │  Son Gün     [📅 opsiyonel         ]             │
  │  Eklenme T.  [📅 varsayılan: bugün ]             │
  │                                                   │
  │              [Görev Oluştur]                      │
  └──────────────────────────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Backend İşlemleri:          │
  │  1. computeAdliye() çalışır │
  │  2. tasks tablosuna INSERT   │
  │  3. task_history kaydı       │
  │  4. Dashboard'a yönlendir    │
  └──────────────────────────────┘
```

### Görev Oluşturulduğunda Otomatik Alanlar

| Alan | Değer | Kaynak |
|------|-------|--------|
| adliye | Otomatik hesaplanan | `computeAdliye(icra_dairesi)` |
| status | `tamamlanmadi` | Sabit |
| creator_id | Oturumdaki kullanıcı | `req.session.userId` |
| last_status_by | Oturumdaki kullanıcı | `req.session.userId` |
| oncelik | Seçilen veya `rutin` | Formdan veya varsayılan |
| eklenme_tarihi | Girilen veya bugün | Formdan veya `new Date()` |
| son_gun | Girilen veya NULL | Formdan veya boş |

---

## Görev Atama Akış Şeması

Aşağıdaki şema, bir görevin oluşturulmasından arşivlenmesine kadar olan tüm yaşam döngüsünü gösterir:

```
┌─────────────────────────────────────────────────────────┐
│                  GÖREV YAŞAM DÖNGÜSÜ                    │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │   ATAYAN /   │  Manuel form veya Excel yükleme
  │  YÖNETİCİ    │  ile görev oluşturur
  │  Görev       │  (öncelik + son gün seçilir)
  │  Oluşturur   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  Adliye      │  icra_dairesi alanından otomatik
  │  Otomatik    │  adliye hesaplanır
  │  Hesaplanır  │  (computeAdliye fonksiyonu)
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  ATAMA       │  Görev "Atama Bekleyen" listesinde
  │  BEKLİYOR    │  görünür (assignee_id = NULL)
  │              │
  │  status:     │  Atama ekranında her kullanıcının
  │  tamamlanmadi│  kaç aktif görevi olduğu gösterilir
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  YÖNETİCİ   │  Yönetici, kullanıcı iş yükünü
  │  Görev Atar  │  görerek atama yapar
  │              │  POST /tasks/:id/assign
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  ATANAN      │  Atanan kişi görevini
  │  Görevlerim  │  "Görevlerim" bölümünde görür
  │  Listesinde  │
  │              │
  │  status:     │
  │  tamamlanmadi│
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  ATANAN      │  Atanan, durumu günceller
  │  İşleme      │
  │  Başlar      │  status: yapiliyor
  └──────┬───────┘
         │
         ▼
  ┌────────────────────────────────────────┐
  │  ATANAN                                │
  │  Görevi "Tamamlandı" veya              │
  │  "Tamamlanamıyor" olarak işaretler     │
  │                                        │
  │  ┌──────────────┐  ┌───────────────┐   │
  │  │  tamamlandi  │  │ tamamlanamıyor│   │
  │  └──────┬───────┘  └──────┬────────┘   │
  │         └────────┬────────┘            │
  └──────────────────┼─────────────────────┘
                     │
                     ▼  Otomatik olarak
  ┌──────────────────────────────────────┐
  │  KONTROL BEKLİYOR                    │
  │                                      │
  │  Her iki durumda da görev otomatik   │
  │  olarak yöneticinin "Kontrol         │
  │  Edilecek" listesine düşer           │
  │                                      │
  │  status: kontrol_bekleniyor          │
  └──────────────────┬───────────────────┘
                     │
                     ▼
  ┌──────────────┐
  │  YÖNETİCİ   │  "Kontrol Edilecek" bölümünde
  │  Kontrol     │  görev görünür ve yönetici
  │  Eder        │  inceleme yapar
  │              │  POST /tasks/:id/control
  └──────┬───────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ UYGUN  │ │  İADE  │  ← İade akışı ayrı şemada
│        │ │        │
│status: │ │status: │
│son_onay│ │iade    │
│bekliyor│ │        │
└───┬────┘ └────────┘
    │
    ▼
┌──────────────┐
│  ATAYAN /    │  "Son Onay Bekleyen" bölümünde
│  YÖNETİCİ   │  görev görünür
│  Son Onay    │
│              │  POST /tasks/:id/final-approve
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   ARŞİV      │  status: arsiv
│              │  Görev arşive taşınır
│   ✓ TAMAM    │
└──────────────┘
```

### Durum Geçiş Özeti

| Mevcut Durum | Sonraki Durum | Tetikleyen | Koşul |
|-------------|---------------|-----------|-------|
| (yeni) | tamamlanmadi | Atayan/Yönetici | Görev oluşturulduğunda |
| tamamlanmadi | yapiliyor | Atanan | İşleme başladığında |
| tamamlanmadi | tamamlandi | Atanan | Direkt tamamlandığında |
| yapiliyor | tamamlandi | Atanan | İş bittiğinde |
| yapiliyor | tamamlanamıyor | Atanan | Yapılamadığında |
| tamamlandi | kontrol_bekleniyor | Sistem | Otomatik geçiş |
| tamamlanamıyor | kontrol_bekleniyor | Sistem | Otomatik geçiş |
| kontrol_bekleniyor | uygun | Yönetici | Kontrol sonucu olumlu |
| kontrol_bekleniyor | iade | Yönetici | Kontrol sonucu olumsuz |
| uygun | son_onay_bekliyor | Sistem | Otomatik geçiş |
| son_onay_bekliyor | arsiv | Atayan/Yönetici | Son onay verildiğinde |
| iade | tamamlanmadi | Atanan | Yeniden işleme alındığında |

---

## İade Akış Şeması

İade süreci, kontrol aşamasında uygun bulunmayan görevlerin tekrar işlenmesini sağlar:

```
┌─────────────────────────────────────────────────────────┐
│                    İADE AKIŞI                           │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  YÖNETİCİ   │  Kontrol Edilecek listesindeki
  │  Kontrol     │  görevi inceler
  │  Eder        │
  └──────┬───────┘
         │
         │  Uygun değil → İade kararı
         ▼
  ┌──────────────┐
  │  İADE        │  POST /tasks/:id/control
  │  KARARI      │  body: { decision: 'iade' }
  │              │
  │  status:     │  Yönetici iade sebebini
  │  iade        │  not olarak ekleyebilir
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  ATANAN      │  Görev, atananın listesinde
  │  İade        │  "İade" filtresiyle görünür
  │  Görevini    │
  │  Görür       │  Kart üzerinde İADE etiketi
  └──────┬───────┘
         │
         │  Atanan düzeltmeleri yapar
         ▼
  ┌──────────────┐
  │  ATANAN      │  Düzeltme sonrası tekrar
  │  Durumu      │  durumu günceller
  │  Günceller   │
  │              │  status: yapiliyor → tamamlandi
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  KONTROL     │  Görev tekrar yöneticinin
  │  BEKLİYOR    │  kontrol listesine düşer
  │              │
  │  status:     │
  │  kontrol_    │
  │  bekleniyor  │
  └──────┬───────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│ UYGUN  │ │ İADE   │  Tekrar iade edilebilir
│ → Son  │ │ → Geri │  (döngü devam eder)
│  Onay  │ │ Atanan │
└────────┘ └────────┘

         ╔══════════════════════════════════╗
         ║  İADE DÖNGÜSÜ                   ║
         ║                                  ║
         ║  İade → Düzeltme → Kontrol →     ║
         ║  (Uygun veya Tekrar İade)        ║
         ║                                  ║
         ║  Görev uygun bulunana kadar      ║
         ║  döngü tekrar edebilir           ║
         ╚══════════════════════════════════╝
```

### İade Sürecinde Kayıt (task_history)

Her iade işleminde `task_history` tablosuna kayıt oluşturulur:

| Alan | Değer |
|------|-------|
| action | `kontrol_yapildi` |
| details | `İade edildi` |
| user_id | Yöneticinin ID'si |

---

## Otomatik Adliye Listesi Akışı

Sistem, görev oluşturulduğunda **icra dairesi** bilgisinden otomatik olarak adliye belirler. Bu, görevlerin adliyeye göre gruplanmasını sağlar.

```
┌─────────────────────────────────────────────────────────┐
│              OTOMATİK ADLİYE TESPİT AKIŞI              │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Görev       │  Manuel form veya Excel'den
  │  Oluşturma   │  icra_dairesi bilgisi gelir
  │              │
  │  Örnek:      │
  │  "İstanbul   │
  │  3. İcra     │
  │  Dairesi"    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  helpers/adliye.js → computeAdliye() │
  │                                      │
  │  1. normalizeText() ile metin        │
  │     temizlenir (küçük harf,          │
  │     Türkçe karakter düzeltme)        │
  │                                      │
  │  2. Öncelik sırasıyla kontrol:       │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  ADLIYE TESPİT ÖNCELİK SIRASI      │
  │                                      │
  │  1. "anadolu" → ANADOLU             │
  │  2. "istanbul" → ÇAĞLAYAN           │
  │  3. "izmir" → İZMİR                 │
  │  4. "adana" → ADANA                 │
  │  5. "antalya" → ANTALYA             │
  │  6. "bursa" → BURSA                 │
  │  7. "ankara" → ANKARA               │
  │  8. "bakirkoy/bakırköy" → BAKIRKOY  │
  │  9. Hiçbiri eşleşmezse → DİĞER     │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  Görev       │  tasks.adliye alanına
  │  Kaydedilir  │  tespit edilen değer yazılır
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  ADLİYE LİSTESİ GÖRÜNÜMÜ            │
  │  (Dashboard → Adliye Listesi sekmesi)│
  │                                      │
  │  Görevler adliyeye göre gruplu      │
  │  tablo halinde listelenir:           │
  │                                      │
  │  ┌──────────┬──────────┬─────────┐  │
  │  │ ANADOLU  │ ÇAĞLAYAN │ İZMİR   │  │
  │  ├──────────┼──────────┼─────────┤  │
  │  │ Görev 1  │ Görev 4  │ Görev 7 │  │
  │  │ Görev 2  │ Görev 5  │         │  │
  │  │ Görev 3  │ Görev 6  │         │  │
  │  └──────────┴──────────┴─────────┘  │
  │                                      │
  │  Yönetici: "Ofise Taşı" butonu      │
  │  ile görevleri ofise alabilir        │
  └──────────────────────────────────────┘
```

### Adliye Listesi ile Görev Akışının Entegrasyonu

```
  Excel / Manuel Görev Girişi
         │
         ▼
  ┌─── computeAdliye() ───┐
  │ Adliye otomatik tespit │
  └──────────┬─────────────┘
             │
     ┌───────┼───────┬───────┬───────┐
     ▼       ▼       ▼       ▼       ▼
  ANADOLU ÇAĞLAYAN İZMİR  ANKARA  DİĞER ...
     │       │       │       │       │
     └───────┴───────┴───────┴───────┘
             │
             ▼
  ┌─────────────────────────┐
  │  Adliye Listesi Tablosu │
  │  (Görevler gruplu)      │
  └────────┬────────────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
  ┌───────┐  ┌────────────┐
  │ Normal│  │ Ofise Taşı │  (Yönetici)
  │ Akış  │  │ adliye_prev│  = eski adliye
  │       │  │ adliye     │  = "Ofis"
  └───────┘  └─────┬──────┘
                    │
                    ▼
             ┌────────────┐
             │ Ofis'ten   │  "Adliyeye Geri Gönder"
             │ Geri Al    │  adliye = adliye_prev
             └────────────┘
```

---

## Ofis Transfer Akışı

Yöneticiler, adliye listesindeki görevleri geçici olarak "Ofis"e taşıyabilir:

```
┌─────────────────────────────────────────────────────────┐
│                OFİS TRANSFER AKIŞI                      │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Görev       │  Adliye: ÇAĞLAYAN
  │  Adliye      │  (veya başka bir adliye)
  │  Listesinde  │
  └──────┬───────┘
         │
         │  Yönetici "Ofise Taşı" butonuna basar
         │  POST /tasks/:id/move-to-office
         ▼
  ┌──────────────┐
  │  KAYIT       │  adliye_prev = "ÇAĞLAYAN" (eski adliye)
  │              │  adliye = "Ofis"
  │  task_history│  action: moved_to_office
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  OFİS        │  Görev artık "Ofis" grubunda
  │  GRUBUNDA    │  görünür
  │  GÖSTERİLİR  │
  └──────┬───────┘
         │
         │  İşlem tamamlanınca
         │  "Adliyeye Geri Gönder" butonuna basılır
         │  POST /tasks/:id/move-to-adliye
         ▼
  ┌──────────────┐
  │  GERİ        │  adliye = adliye_prev (ÇAĞLAYAN)
  │  GÖNDERİLDİ  │  adliye_prev = NULL
  │              │
  │  task_history│  action: moved_to_adliye
  └──────────────┘
```

---

## Excel Toplu İçe Aktarma Akışı

```
┌─────────────────────────────────────────────────────────┐
│              EXCEL İÇE AKTARMA AKIŞI                    │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Kullanıcı   │  .xlsx dosyası yükler veya
  │  Excel       │  yapıştır (paste) ile gönderir
  │  Yükler      │
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  SÜTUN TESPİTİ                      │
  │                                      │
  │  Türkçe karakter toleranslı:         │
  │  - Müvekkil                          │
  │  - Portföy                           │
  │  - Borçlu                            │
  │  - TCKN/VKN                          │
  │  - İcra Dairesi                      │
  │  - İcra Esas No                      │
  │  - İşlem Türü                        │
  │  - İşlem Açıklaması                  │
  │  - Öncelik (Rutin/Önemli/Acil)       │
  │  - Son Gün (opsiyonel)               │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  SATIR SATIR İŞLENİR                │
  │                                      │
  │  Her satır için:                     │
  │  1. Zorunlu alan kontrolü            │
  │     (müvekkil, işlem türü,           │
  │      icra dairesi)                   │
  │  2. TCKN/VKN borçlu adından         │
  │     otomatik çıkarılır               │
  │  3. computeAdliye() ile             │
  │     adliye hesaplanır                │
  │  4. Öncelik doğrulanır               │
  │     (acil/onemli/rutin)              │
  │  5. Son gün varsa kaydedilir         │
  │  6. tasks tablosuna INSERT           │
  │  7. task_history'ye "imported"       │
  │     kaydı eklenir                    │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  SONUÇ       │  Başarılı: X görev eklendi
  │              │  Hatalı: Y satır atlandı
  │  Yönlendirme │  → Dashboard "Atama" sekmesi
  └──────────────┘
```

---

## Atama Ekranı ve Kullanıcı İş Yükü

Yönetici görev atarken, her kullanıcının mevcut iş yükünü görebilir.

### Atama Bekleyen Ekranı

```
┌─────────────────────────────────────────────────────────┐
│  ATAMA BEKLEYENler + KULLANICI İŞ YÜKÜ                  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── KULLANICI AKTİF GÖREV SAYILARI ───────────────┐  │
│  │                                                   │  │
│  │  ┌──────────────────────┬────────────────────┐   │  │
│  │  │ Kullanıcı            │ Aktif Görev Sayısı │   │  │
│  │  ├──────────────────────┼────────────────────┤   │  │
│  │  │ omercanoruc          │ 12                 │   │  │
│  │  │ melissaozturk        │ 9                  │   │  │
│  │  │ ademcanozkan         │ 7                  │   │  │
│  │  │ nisanurakyildiz      │ 5                  │   │  │
│  │  │ elauncu              │ 3                  │   │  │
│  │  │ cansubozbek          │ 0                  │   │  │
│  │  └──────────────────────┴────────────────────┘   │  │
│  │                                                   │  │
│  │  Sıralama: En çok görevi olan üstte              │  │
│  │  Dahil edilen statüler:                          │  │
│  │  tamamlanmadi, yapiliyor, kontrol_ediliyor,      │  │
│  │  iade, kontrol_bekleniyor                        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── ATAMA BEKLEYENler ────────────────────────────┐  │
│  │                                                   │  │
│  │  ┌─── GÖREV KARTI ───────────────────────────┐   │  │
│  │  │ 🔥 ACİL | Kesinleştirme Yapılacak          │   │  │
│  │  │ ÇAĞLAYAN | GSD | Fiba 01                   │   │  │
│  │  │ Son Gün: 2024-02-15                        │   │  │
│  │  │                                            │   │  │
│  │  │ Ata: [▼ Kullanıcı seç ] [Ata]             │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### İş Yükü Hesaplama Mantığı

```javascript
// Aktif durumlar (arşivde olmayan, tamamlanmamış)
const aktifStatuler = [
  'tamamlanmadi',
  'yapiliyor',
  'kontrol_ediliyor',
  'iade',
  'kontrol_bekleniyor'
];

// Her kullanıcı için aktif görev sayısı
// GROUP BY assignee_id, COUNT(id)
// Sadece atanan ve yönetici rolleri gösterilir
// En çok görevi olan en üstte sıralanır
```

---

## Tüm Görevler Sayfası (Toplu Görüntüleme)

`/all-tasks` sayfası, arşiv dışındaki tüm görevlerin toplu olarak görüntülendiği ve filtrelendiği sayfadır.

### Sayfa Yapısı

```
┌─────────────────────────────────────────────────────────┐
│  TÜM GÖREVLER (/all-tasks)                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── FİLTRELER ────────────────────────────────────┐  │
│  │                                                   │  │
│  │  Durum    [▼ Tümü / Tamamlanmadı / Yapılıyor /   │  │
│  │              Kontrol Bekleniyor / İade / ...]     │  │
│  │                                                   │  │
│  │  Öncelik  [▼ Tümü / 🔥 Acil / ⚠️ Önemli /       │  │
│  │              📋 Rutin ]                           │  │
│  │                                                   │  │
│  │  Adliye   [____ metin arama ____]                │  │
│  │  Müvekkil [____ metin arama ____]                │  │
│  │  Ekleyen  [▼ Kullanıcı listesi ]                 │  │
│  │  Atanan   [▼ Kullanıcı listesi ]                 │  │
│  │                                                   │  │
│  │         [Filtrele]  [Temizle]                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── GÖREV TABLOSU ────────────────────────────────┐  │
│  │                                                   │  │
│  │  Öncelik │ İşlem │ Adliye │ Müvekkil │ Portföy  │  │
│  │  İcra D. │ Esas No│ Borçlu│ TCKN    │ Atayan   │  │
│  │  Yönetici│ Atanan │ Durum │ Tarih   │ Son Gün  │  │
│  │                                                   │  │
│  │  🔥 Acil görevler en üstte (kırmızı satır)      │  │
│  │  ⚠️ Önemli görevler (turuncu satır)              │  │
│  │  📋 Rutin görevler (standart satır)              │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Filtre Mantığı

| Filtre | Tip | Eşleştirme |
|--------|-----|-----------|
| Durum | Dropdown | Tam eşleşme (`WHERE status = ?`) |
| Öncelik | Dropdown | Tam eşleşme (`WHERE oncelik = ?`) |
| Adliye | Metin | Kısmi eşleşme (`WHERE adliye LIKE %?%`) |
| Müvekkil | Metin | Kısmi eşleşme (`WHERE muvekkil LIKE %?%`) |
| Ekleyen | Dropdown | Tam eşleşme (`WHERE creator_id = ?`) |
| Atanan | Dropdown | Tam eşleşme (`WHERE assignee_id = ?`) |

### Tablo Sıralaması

Tablo her zaman öncelik bazlı sıralanır:
1. Acil görevler (kırmızı satır) en üstte
2. Önemli görevler (turuncu satır) ortada
3. Rutin görevler (standart satır) en altta
4. Aynı önceliktekiler yeniden eskiye (`created_at DESC`)

---

## Arşiv Sistemi

### Arşiv Akışı

```
┌─────────────────────────────────────────────────────────┐
│                   ARŞİV AKIŞI                           │
└─────────────────────────────────────────────────────────┘

  ─── GÖREV ARŞİVLEME ───

  Son Onay Verildi
         │
         ▼
  status = "arsiv"
  Görev tasks tablosunda kalır
  (silinmez, status değişir)
         │
         ▼
  /archive sayfasında görünür


  ─── TEBLİGAT ARŞİVLEME ───

  Durum "Tebliğ" veya "İtiraz" oldu
         │
         ▼
  tebligat_arsiv tablosuna KOPYALANIR
  tebligatlar tablosundan SİLİNİR
         │
         ▼
  /archive sayfasında görünür
```

### Arşiv Sayfası Yapısı

```
┌─────────────────────────────────────────────────────────┐
│  ARŞİV (/archive)                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── İSTATİSTİK KARTLARI ──────────────────────────┐  │
│  │                                                   │  │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐    │  │
│  │  │ Toplam     │ │ Rutin      │ │ Önemli     │    │  │
│  │  │ Arşivlenen │ │ Görevler   │ │ Görevler   │    │  │
│  │  │   45       │ │   30       │ │   8        │    │  │
│  │  └────────────┘ └────────────┘ └────────────┘    │  │
│  │                                                   │  │
│  │  ┌────────────┐ ┌────────────┐                   │  │
│  │  │ Acil       │ │ Arşivlenen │                   │  │
│  │  │ Görevler   │ │ Tebligatlar│                   │  │
│  │  │   7        │ │   23       │                   │  │
│  │  └────────────┘ └────────────┘                   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ═══ ARŞİVLENEN TEBLİGATLAR ═══                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ID │ Dosya No │ İcra D. │ Müvekkil │ Taraf │     │  │
│  │ Durum │ Tarih │ Not │ Arşivlenme │                │  │
│  │                                                   │  │
│  │ Silme: Sadece Atayan rolü silebilir              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ═══ ARŞİVLENEN GÖREVLER ═══                            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Öncelik │ İşlem │ Adliye │ Müvekkil │ Portföy    │  │
│  │ İcra D. │ Esas No │ Borçlu │ TCKN │ Son Gün     │  │
│  │ Durum │ Oluşturulma │ Arşivlenme                 │  │
│  │                                                   │  │
│  │ Sıralama: Arşivlenme tarihi (yeniden eskiye)     │  │
│  │ 🔥 Acil görevler kırmızı satır                   │  │
│  │ ⚠️ Önemli görevler turuncu satır                  │  │
│  │ Silme: Sadece Atayan rolü silebilir              │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Arşiv Yetkileri

| İşlem | Yetki | Açıklama |
|-------|-------|----------|
| Arşivi görüntüleme | Tüm roller | Herkes arşivi görebilir |
| Görev silme (arşivden) | Sadece Atayan | `POST /archive/tasks/:id/delete` |
| Tebligat silme (arşivden) | Sadece Atayan | `POST /archive/tebligat/:id/delete` |

### Arşivde Saklanan Bilgiler

Arşivlenen görevler tüm bilgilerini korur:
- Öncelik seviyesi (acil/önemli/rutin)
- Son gün tarihi
- Tüm görev detayları
- Atama bilgileri
- Durum geçmiş kayıtları (task_history)

---

## Veritabanı Şeması

### tasks (Görevler)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | Otomatik artan |
| adliye | TEXT | Otomatik hesaplanan adliye adı |
| muvekkil | TEXT | Müvekkil adı |
| portfoy | TEXT | Portföy adı |
| borclu | TEXT | Borçlu adı |
| borclu_tckn_vkn | TEXT | Borçlu TC/VKN |
| icra_dairesi | TEXT | İcra dairesi tam adı |
| icra_esas_no | TEXT | Dosya numarası |
| islem_turu | TEXT | İşlem türü |
| islem_aciklamasi | TEXT | İşlem açıklaması |
| oncelik | TEXT | 'acil', 'onemli' veya 'rutin' |
| status | TEXT | Durum (enum değerler) |
| creator_id | INTEGER FK | Oluşturan kullanıcı |
| assignee_id | INTEGER FK | Atanan kullanıcı |
| manager_id | INTEGER FK | Yönetici |
| last_status_by | INTEGER FK | Son durum güncelleyen |
| eklenme_tarihi | DATE | Eklenme tarihi |
| son_gun | DATE (nullable) | Son gün tarihi (opsiyonel) |
| adliye_prev | TEXT | Önceki adliye (ofis transferi) |
| created_at | TIMESTAMP | Oluşturma zamanı |
| updated_at | TIMESTAMP | Güncelleme zamanı |

### task_history (Görev Geçmişi)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | Otomatik artan |
| task_id | INTEGER FK | İlişkili görev (CASCADE) |
| user_id | INTEGER FK | İşlemi yapan kullanıcı |
| action | TEXT | İşlem türü |
| details | TEXT | İşlem detayı |
| created_at | TIMESTAMP | İşlem zamanı |

**action değerleri:**
- `durum_degisti` - Durum değişikliği
- `atama_yapildi` - Görev atandı
- `note` - Not eklendi
- `kontrol_yapildi` - Kontrol yapıldı
- `moved_to_office` - Ofise taşındı
- `moved_to_adliye` - Adliyeye geri gönderildi
- `son_onay` - Son onay verildi
- `arsivden_silindi` - Arşivden silindi
- `gorev_silindi` - Görev silindi
- `imported` - Excel'den içe aktarıldı

### users (Kullanıcılar)
kullanıcılar tablosu mevcut databaseden alınacak

---

## API Endpoint'leri
Sistemde halihazırda mevcut olan API endpointlerini kullan. burada atayan yerine sistemde yönetici, yönetici yerine editör, kullanıcı yerine atanan gelecek

## Sayfa ve Bileşen Yapısı

### Dashboard (`/dashboard`)

Rol bazlı bölümler:

**Atayan Bölümleri:**
1. Görevler - Oluşturulan görevlere genel bakış
2. Yeni Görev - Manuel görev oluşturma formu (öncelik + son gün dahil)
3. Excel Yükle - Toplu içe aktarma
4. Tebligat Oluştur - Hızlı tebligat girişi
5. Adliye Listesi - Adliyeye göre gruplu görev tablosu
6. Son Onay Bekleyen - Onay bekleyen görevler
7. Kullanıcı Aktif Görevleri - İş yükü istatistikleri

**Yönetici Bölümleri:**
1. Görevler - Tüm görevlere genel bakış
2. Yeni Görev - Görev oluşturma (öncelik + son gün dahil)
3. Excel Yükle - Toplu içe aktarma
4. Tebligat Oluştur - Tebligat girişi
5. Adliye Listesi - Görevler + ofis transfer butonları
6. Bana Atanan - Yöneticiye atanan görevler
7. Atama Bekleyen - Atanmamış görevler + kullanıcı iş yükü tablosu
8. Kontrol Edilecek - Kalite kontrol listesi
9. Son Onay Bekleyen - Son onay listesi
10. Kullanıcı Aktif Görevleri - Takım iş yükü

**Atanan Bölümleri:**
1. Görevlerim - Durum filtreli görev listesi
2. Durum filtresi (Tamamlanmadı, Yapılıyor, Tamamlandı, İade)
3. Öncelik filtresi (Acil, Önemli, Rutin)

### Görev Kartı Bilgileri

Her görev kartında gösterilen bilgiler:

| Bilgi | Görünüm |
|-------|---------|
| Öncelik | Badge (🔥 Acil / ⚠️ Önemli / 📋 Rutin) |
| İşlem Türü | Başlık |
| Adliye | Etiket |
| Müvekkil | Etiket |
| Portföy | Etiket |
| Borçlu | Metin |
| TCKN/VKN | Metin |
| İcra Dairesi | Metin |
| İcra Esas No | Metin |
| Durum | Status badge |
| Eklenme Tarihi | Tarih |
| Son Gün | Tarih (varsa gösterilir) |
| Notlar | Açılır kapanır not listesi |

---

## Durum (Status) Makinesi

```
                    ┌─────────────┐
                    │ tamamlanmadi│ ←──── Başlangıç
                    └──────┬─────┘
                           │
                           ▼
                    ┌──────────┐
                    │ yapiliyor│
                    └──┬───┬──┘
                       │   │
          tamamlandi ──┘   └── tamamlanamıyor
                       │       │
                       ▼       ▼
              ┌──────────────────────────┐
              │   kontrol_bekleniyor     │
              │                          │
              │  Atanan görevi           │
              │  "Tamamlandı" veya       │
              │  "Tamamlanamıyor" olarak │
              │  işaretler → otomatik    │
              │  olarak yöneticinin      │
              │  kontrol listesine düşer │
              └──────┬──────────┬────────┘
                     │          │
               uygun │          │ iade
                     ▼          ▼
         ┌───────────────┐  ┌───────┐
         │son_onay_      │  │ iade  │ ──→ tamamlanmadi (döngü)
         │bekliyor       │  └───────┘
         └───────┬───────┘
                 │
                 ▼ son onay
         ┌───────────┐
         │   arsiv   │  SON DURUM
         └───────────┘
```

---

## İşlem Türleri

Sistemde tanımlı işlem türleri:

| # | İşlem Türü |
|---|-----------|
| 1 | Kesinleştirme Yapılacak |
| 2 | Tebligat Çıkarılacak |
| 3 | Taşınmaz Haczi |
| 4 | Araç Haczi |
| 5 | Dosya Yenileme |
| 6 | Banka Blokesi |
| 7 | Maaş Haczi |
| 8 | Mazbatalar Taratılacak |
| 9 | Vekil Kaydı |
| 10 | İade İstenecek |
| 11 | Rehin Açığı Belgesi Alınacak |
| 12 | Reddiyat Yapılacak |
| 13 | Takip Başlatılacak |
| 14 | Eksik Evraklar Taratılacak |
| 15 | Tebligata Yarar Adres İstenecek |
| 16 | Borçlu Bilgileri Eklenecek |
| 17 | Kuruma 89/1 Gönderilecek |
| 18 | Taraf Kaydı Düzeltilecek |
| 19 | Yeni Esas Alınacak |
| 20 | Ödeme Emri Düzenlenecek |
| 21 | Borçlu Eklenecek |
| 22 | Alacaklı olduğu icra dosyasına haciz konulacak |
| 23 | Diğer (serbest metin) |

---

## Müvekkil ve Portföy Listesi

### Müvekkiller
- GSD, Doğru, Sümer, Ulusal, Birikim, Emir, Birleşim, AKBANK
- GSD Faktoring, Ulusal Faktoring, Optima Faktoring, Sümer Faktoring
- AK Faktoring, EKO Faktoring, TEB Faktoring

### Portföyler
- GSD Faktoring
- Fiba 01, Fiba 02, Fiba 03, Fiba 04, Anadolu
- YKB 01, YKB 02, YKB 03, YKB 04
- İşbank Bireysel 01, İşbank Bireysel 02
- İşbank 01, İşbank 02, İşbank 03
- Şeker, Garantibank, Garanti Faktöring, AKBANK, İNG

--
