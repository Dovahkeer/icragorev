# Tebligat Yönetim Sistemi - Detaylı Dokümantasyon

## İçindekiler

1. [Genel Bakış](#genel-bakış)
2. [Tebligat Yaşam Döngüsü](#tebligat-yaşam-döngüsü)
3. [Tebligat Oluşturma Akışı](#tebligat-oluşturma-akışı)
4. [Tebligat Durum Akışı](#tebligat-durum-akışı)
5. [Tebligat Arşivleme Akışı](#tebligat-arşivleme-akışı)
6. [Veritabanı Şeması](#veritabanı-şeması)
7. [API Endpoint'leri](#api-endpointleri)
8. [Arayüz Bileşenleri](#arayüz-bileşenleri)
9. [Filtreleme ve Arama](#filtreleme-ve-arama)
10. [Dashboard Entegrasyonu](#dashboard-entegrasyonu)

---

## Genel Bakış

Tebligat modülü, icra takip süreçlerindeki tebligat işlemlerini (gönderim, takip, itiraz, iade) yönetmek için tasarlanmıştır. Görev sisteminden bağımsız çalışır ve kendi arşiv mekanizmasına sahiptir.

**Erişim:** Tüm roller (atayan, yönetici, atanan) tebligat oluşturabilir ve yönetebilir.

---

## Tebligat Yaşam Döngüsü

```
┌─────────────────────────────────────────────────────────┐
│              TEBLİGAT YAŞAM DÖNGÜSÜ                    │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  TEBLİGAT    │  Kullanıcı tebligat oluşturur
  │  OLUŞTUR     │  (Dashboard veya Tebligatlar sayfası)
  │              │
  │  durum:      │  Varsayılan durum seçilir
  │  gönderildi  │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │  AKTİF       │  tebligatlar tablosunda
  │  TEBLİGAT    │  listelenir
  │              │
  │  İşlemler:   │
  │  - Düzenle   │
  │  - Durum     │
  │    değiştir  │
  │  - Barkod    │
  │    güncelle  │
  │  - Not ekle  │
  │  - Sil       │
  └──────┬───────┘
         │
         │  Durum değişikliği
         ▼
    ┌────┴────────────┐
    │                 │
    ▼                 ▼
┌────────┐     ┌───────────┐
│TEBLİĞ  │     │  İTİRAZ   │
│        │     │           │
│Otomatik│     │ Otomatik  │
│arşive  │     │ arşive    │
│taşınır │     │ taşınır   │
└───┬────┘     └─────┬─────┘
    │                │
    └───────┬────────┘
            ▼
  ┌──────────────┐
  │  TEBLİGAT    │  tebligat_arsiv tablosuna
  │  ARŞİVİ      │  kopyalanır
  │              │
  │  /archive    │  Arşiv sayfasında görünür
  └──────────────┘
```

---

## Tebligat Oluşturma Akışı

```
┌─────────────────────────────────────────────────────────┐
│              TEBLİGAT OLUŞTURMA                         │
└─────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────┐
  │  OLUŞTURMA FORMU                     │
  │                                      │
  │  Zorunlu Alanlar:                    │
  │  ┌────────────────────────────────┐  │
  │  │ Müvekkil    [Dropdown]        │  │
  │  │ Portföy     [Dropdown]        │  │
  │  │ Taraf       [Metin]           │  │
  │  │ TCKN/VKN    [Metin]           │  │
  │  │ Dosya No    [Metin]           │  │
  │  │ İcra Dairesi[Metin]           │  │
  │  └────────────────────────────────┘  │
  │                                      │
  │  Opsiyonel Alanlar:                  │
  │  ┌────────────────────────────────┐  │
  │  │ Barkod      [Metin]           │  │
  │  │ Durum       [Dropdown]        │  │
  │  │   - gönderildi (varsayılan)   │  │
  │  │   - tebliğ                    │  │
  │  │   - iade                      │  │
  │  │   - itiraz                    │  │
  │  │ Tarih       [Date Picker]     │  │
  │  │ Notlar      [Textarea]        │  │
  │  └────────────────────────────────┘  │
  └──────────────────────────────────────┘
         │
         │  POST /tebligat/create
         ▼
  ┌──────────────────────────────────────┐
  │  VERİTABANI KAYDI                    │
  │                                      │
  │  tebligatlar tablosuna INSERT:       │
  │  - Tüm form alanları                 │
  │  - created_by = mevcut kullanıcı     │
  │  - created_at = şimdiki zaman        │
  └──────────────────────────────────────┘
         │
         ▼
  ┌──────────────┐
  │  YÖNLENDİRME │  → /tebligatlar sayfasına
  └──────────────┘
```

### Oluşturma Kaynakları

Tebligat iki yerden oluşturulabilir:

1. **Dashboard → Tebligat Oluştur sekmesi**: Hızlı erişim formu
2. **Tebligatlar sayfası → Üst form**: Tam özellikli form

---

## Tebligat Durum Akışı

```
┌─────────────────────────────────────────────────────────┐
│              TEBLİGAT DURUM GEÇİŞLERİ                  │
└─────────────────────────────────────────────────────────┘

                 ┌───────────────┐
                 │  GÖNDERİLDİ   │ ← Başlangıç durumu
                 └───┬───┬───┬──┘
                     │   │   │
            ┌────────┘   │   └────────┐
            ▼            ▼            ▼
     ┌──────────┐ ┌───────────┐ ┌─────────┐
     │  TEBLİĞ  │ │   İADE    │ │ İTİRAZ  │
     │          │ │           │ │         │
     │ ✓ Final  │ │ Aktif     │ │ ✓ Final │
     │ → Arşiv  │ │ kalır     │ │ → Arşiv │
     └──────────┘ └───────────┘ └─────────┘


  ╔═══════════════════════════════════════════════════════╗
  ║  DURUM DETAYLARI                                     ║
  ╠═══════════════════════════════════════════════════════╣
  ║                                                       ║
  ║  GÖNDERİLDİ:                                         ║
  ║  - Tebligat postaya/kurye ile gönderilmiş             ║
  ║  - Aktif listede görünür                              ║
  ║  - Tüm düzenleme işlemleri yapılabilir                ║
  ║                                                       ║
  ║  TEBLİĞ:                                             ║
  ║  - Tebligat teslim edilmiş                            ║
  ║  - Otomatik olarak arşive taşınır                     ║
  ║  - tebligat_arsiv tablosuna kopyalanır                ║
  ║  - tebligatlar tablosundan silinir                    ║
  ║                                                       ║
  ║  İADE:                                                ║
  ║  - Tebligat iade gelmiş                               ║
  ║  - Aktif listede kalmaya devam eder                   ║
  ║  - Yeniden işlem yapılabilir                           ║
  ║                                                       ║
  ║  İTİRAZ:                                              ║
  ║  - Tebligata itiraz edilmiş                           ║
  ║  - Otomatik olarak arşive taşınır                     ║
  ║  - tebligat_arsiv tablosuna kopyalanır                ║
  ║  - tebligatlar tablosundan silinir                    ║
  ╚═══════════════════════════════════════════════════════╝
```

### Durum Değişikliği İşlem Akışı

```
  Kullanıcı yeni durum seçer
         │
         │  POST /tebligat/:id/update-status
         │  body: { durum: 'tebliğ' }
         ▼
  ┌──────────────────────────────────────┐
  │  DURUM KONTROLÜ                      │
  │                                      │
  │  Yeni durum "tebliğ" veya "itiraz"  │
  │  mı?                                │
  │                                      │
  │  EVET → Arşivleme tetiklenir         │
  │  HAYIR → Sadece durum güncellenir    │
  └──────┬───────────────────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼ EVET   ▼ HAYIR
┌────────┐ ┌────────────┐
│ ARŞİV  │ │ GÜNCELLE   │
│ İŞLEMİ │ │            │
│        │ │ durum alanı│
│ (aşağı │ │ güncellenir│
│  bak)  │ │            │
└────────┘ └────────────┘
```

---

## Tebligat Arşivleme Akışı

```
┌─────────────────────────────────────────────────────────┐
│              TEBLİGAT ARŞİVLEME                         │
└─────────────────────────────────────────────────────────┘

  ┌──────────────┐
  │  Durum       │  "tebliğ" veya "itiraz"
  │  Değişikliği │  olarak güncellendi
  └──────┬───────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  1. KOPYALAMA                        │
  │                                      │
  │  tebligat_arsiv tablosuna INSERT:    │
  │                                      │
  │  - muvekkil                          │
  │  - portfoy                           │
  │  - taraf                             │
  │  - tckn_vkn                          │
  │  - barkod                            │
  │  - dosya_no                          │
  │  - icra_dairesi                      │
  │  - durum (yeni durum)                │
  │  - tarih                             │
  │  - notlar                            │
  │  - created_by (orijinal oluşturan)   │
  │  - arsivlenme_tarihi = NOW()         │
  │  - arsivleyen = mevcut kullanıcı     │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  2. SİLME                            │
  │                                      │
  │  tebligatlar tablosundan             │
  │  orijinal kayıt silinir              │
  │  DELETE WHERE id = :id               │
  └──────┬───────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────────────┐
  │  3. ARŞİV GÖRÜNÜMÜ                   │
  │                                      │
  │  /archive sayfasında                 │
  │  "Arşivlenen Tebligatlar"           │
  │  bölümünde listelenir                │
  │                                      │
  │  Görüntülenen bilgiler:              │
  │  - Müvekkil, Portföy, Taraf         │
  │  - TCKN/VKN, Barkod                 │
  │  - Dosya No, İcra Dairesi           │
  │  - Durum, Tarih, Notlar             │
  │  - Ekleyen, Arşivleyen              │
  │  - Arşivlenme tarihi                │
  └──────────────────────────────────────┘
```

---

## Veritabanı Şeması

### tebligatlar (Aktif Tebligatlar)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | Otomatik artan |
| muvekkil | TEXT | Müvekkil adı |
| portfoy | TEXT | Portföy adı |
| taraf | TEXT | Taraf (borçlu/alacaklı) adı |
| tckn_vkn | TEXT | TC Kimlik No veya Vergi Kimlik No |
| barkod | TEXT | Tebligat barkod numarası |
| dosya_no | TEXT | İcra dosya numarası |
| icra_dairesi | TEXT | İcra dairesi adı |
| durum | TEXT | 'gönderildi', 'tebliğ', 'iade', 'itiraz' |
| tarih | TEXT | Tebligat tarihi |
| notlar | TEXT | Açıklama/notlar |
| created_by | INTEGER FK | Oluşturan kullanıcı ID |
| updated_by | INTEGER FK | Son güncelleyen kullanıcı ID |
| created_at | TIMESTAMP | Oluşturma zamanı |
| updated_at | TIMESTAMP | Güncelleme zamanı |

### tebligat_arsiv (Arşivlenen Tebligatlar)

| Sütun | Tip | Açıklama |
|-------|-----|----------|
| id | INTEGER PK | Otomatik artan (yeni ID) |
| muvekkil | TEXT | Müvekkil adı |
| portfoy | TEXT | Portföy adı |
| taraf | TEXT | Taraf adı |
| tckn_vkn | TEXT | TC/VKN |
| barkod | TEXT | Barkod numarası |
| dosya_no | TEXT | Dosya numarası |
| icra_dairesi | TEXT | İcra dairesi |
| durum | TEXT | Son durum (tebliğ/itiraz) |
| tarih | TEXT | Tebligat tarihi |
| notlar | TEXT | Notlar |
| created_by | INTEGER FK | Orijinal oluşturan |
| arsivlenme_tarihi | TIMESTAMP | Arşive taşınma zamanı |
| arsivleyen | INTEGER FK | Arşivleme işlemini yapan kullanıcı |
| created_at | TIMESTAMP | Orijinal oluşturma zamanı |
| updated_at | TIMESTAMP | Son güncelleme zamanı |

---

## API Endpoint'leri

### Tebligat İşlemleri

| Method | Route | Açıklama | Request Body |
|--------|-------|----------|-------------|
| GET | `/tebligatlar` | Tebligat listesi sayfası | - |
| POST | `/tebligat/create` | Yeni tebligat oluştur | `muvekkil, portfoy, taraf, tckn_vkn, barkod, dosya_no, icra_dairesi, durum, tarih, notlar` |
| POST | `/tebligat/:id/update` | Tebligat bilgilerini güncelle | Tüm alanlar |
| POST | `/tebligat/:id/update-status` | Durum değiştir | `durum` |
| POST | `/tebligat/:id/update-barkod` | Barkod güncelle | `barkod` |
| POST | `/tebligat/:id/update-not` | Not güncelle | `notlar` |
| POST | `/tebligat/:id/update-user` | Ekleyen değiştir | `created_by` |
| POST | `/tebligat/:id/delete` | Tebligat sil | - |

### Endpoint Detayları

#### POST `/tebligat/create`

Yeni tebligat kaydı oluşturur.

```
Request:
{
  "muvekkil": "GSD",
  "portfoy": "Fiba 01",
  "taraf": "Ahmet Yılmaz",
  "tckn_vkn": "12345678901",
  "barkod": "RR123456789TR",
  "dosya_no": "2024/12345",
  "icra_dairesi": "İstanbul 3. İcra Dairesi",
  "durum": "gönderildi",
  "tarih": "2024-01-15",
  "notlar": "İlk tebligat gönderimi"
}

Response: 302 Redirect → /tebligatlar
```

#### POST `/tebligat/:id/update-status`

Durum günceller. "tebliğ" veya "itiraz" seçilirse otomatik arşivleme tetiklenir.

```
Request:
{
  "durum": "tebliğ"
}

İşlem:
1. Durum "tebliğ" veya "itiraz" ise:
   a. tebligat_arsiv'e kopyala
   b. tebligatlar'dan sil
2. Değilse:
   a. Sadece durum alanını güncelle

Response: 302 Redirect → /tebligatlar
```

---

## Arayüz Bileşenleri

### Tebligatlar Sayfası (`/tebligatlar`)

```
┌─────────────────────────────────────────────────────────┐
│  TEBLİGATLAR SAYFASI                                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── OLUŞTURMA FORMU ──────────────────────────────┐  │
│  │ Müvekkil [▼]  Portföy [▼]  Taraf [____]          │  │
│  │ TCKN/VKN [____]  Barkod [____]                    │  │
│  │ Dosya No [____]  İcra Dairesi [____]              │  │
│  │ Durum [▼]  Tarih [📅]                             │  │
│  │ Notlar [________________________________]          │  │
│  │                              [Tebligat Oluştur]   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── FİLTRELER ────────────────────────────────────┐  │
│  │ Ekleyen [▼]  İcra Dairesi [▼]                    │  │
│  │ Müvekkil [▼]  Durum [▼]                          │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─── TEBLİGAT LİSTESİ ────────────────────────────┐  │
│  │                                                   │  │
│  │  ┌─── TEBLİGAT KARTI ────────────────────────┐   │  │
│  │  │ Müvekkil: GSD  │  Portföy: Fiba 01        │   │  │
│  │  │ Taraf: Ahmet Yılmaz                        │   │  │
│  │  │ TCKN: 12345678901  │  Barkod: RR123...     │   │  │
│  │  │ Dosya: 2024/12345                          │   │  │
│  │  │ İcra Dairesi: İstanbul 3. İcra Dairesi     │   │  │
│  │  │ Durum: [GÖNDERİLDİ ▼]  │  Tarih: 15.01    │   │  │
│  │  │ Ekleyen: ozlemkoksal                       │   │  │
│  │  │ Notlar: İlk tebligat gönderimi             │   │  │
│  │  │                                            │   │  │
│  │  │ [Düzenle] [Barkod] [Not] [Sil]            │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  │  ┌─── TEBLİGAT KARTI ────────────────────────┐   │  │
│  │  │ ...                                        │   │  │
│  │  └────────────────────────────────────────────┘   │  │
│  │                                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Tebligat Kartı İşlemleri

| Buton | İşlem | Endpoint |
|-------|-------|----------|
| Düzenle | Tüm alanları düzenleme modalı açar | POST `/tebligat/:id/update` |
| Durum Dropdown | Durum değişikliği (inline) | POST `/tebligat/:id/update-status` |
| Barkod | Barkod numarası güncelleme | POST `/tebligat/:id/update-barkod` |
| Not | Not düzenleme | POST `/tebligat/:id/update-not` |
| Sil | Tebligat silme (onay gerekir) | POST `/tebligat/:id/delete` |
| Ekleyen Değiştir | Oluşturan kişiyi değiştir | POST `/tebligat/:id/update-user` |

---

## Filtreleme ve Arama

Tebligatlar sayfasında 4 filtre mevcuttur:

### Filtre Alanları

| Filtre | Açıklama | Kaynak |
|--------|----------|--------|
| Ekleyen | Tebligatı oluşturan kullanıcı | users tablosu |
| İcra Dairesi | İcra dairesi adı | tebligatlar.icra_dairesi (DISTINCT) |
| Müvekkil | Müvekkil adı | tebligatlar.muvekkil (DISTINCT) |
| Durum | Tebligat durumu | 'gönderildi', 'tebliğ', 'iade', 'itiraz' |

### Filtre Mantığı

```
  Kullanıcı filtre seçer
         │
         ▼
  JavaScript client-side filtreleme:

  tebligatlar.filter(t => {
    if (ekleyen filtresi && t.created_by !== seçilen) return false;
    if (icra_dairesi filtresi && t.icra_dairesi !== seçilen) return false;
    if (muvekkil filtresi && t.muvekkil !== seçilen) return false;
    if (durum filtresi && t.durum !== seçilen) return false;
    return true;
  })
```

Filtreler anlık (client-side) çalışır, sayfa yenilenmez.

---

## Dashboard Entegrasyonu

### Hızlı Tebligat Oluşturma

Dashboard'da **Atayan** ve **Yönetici** rolleri için "Tebligat Oluştur" sekmesi bulunur. Bu sekme `/tebligatlar` sayfasındaki ile aynı formu içerir.

```
┌─────────────────────────────────────────────────────────┐
│  DASHBOARD                                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [Görevler] [Yeni Görev] [Excel] [Tebligat Oluştur]   │
│  [Adliye Listesi] [Son Onay] [Kullanıcılar]           │
│                                                         │
│  ═══════════════════════════════════════                │
│  Tebligat Oluştur sekmesi aktif:                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Aynı form → POST /tebligat/create               │  │
│  │  Başarılı → /tebligatlar sayfasına yönlendirir    │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  Sidebar'da Tebligatlar linki:                         │
│  📋 Tebligatlar → /tebligatlar                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Arşiv Sayfasındaki Tebligat Görünümü

```
┌─────────────────────────────────────────────────────────┐
│  /archive                                               │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─── İSTATİSTİKLER ────────────────────────────────┐  │
│  │  Arşivlenen Görev: 45  │  Arşivlenen Tebligat: 23│  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ═══ Arşivlenen Görevler ═══                           │
│  [Görev kartları...]                                   │
│                                                         │
│  ═══ Arşivlenen Tebligatlar ═══                        │
│  ┌─── ARŞİV TEBLİGAT KARTI ────────────────────────┐  │
│  │  Müvekkil: GSD  │  Portföy: Fiba 01              │  │
│  │  Taraf: Ahmet Yılmaz                              │  │
│  │  Durum: TEBLİĞ  │  Tarih: 15.01.2024             │  │
│  │  Ekleyen: ozlemkoksal                             │  │
│  │  Arşivleyen: ilaydaerdogan                        │  │
│  │  Arşivlenme: 20.01.2024 14:30                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Tebligat Tipleri ve Kullanım Senaryoları

### Senaryo 1: Normal Tebligat Süreci

```
1. Atayan tebligat oluşturur (durum: gönderildi)
2. Barkod numarası girilir/güncellenir
3. PTT/kurye ile gönderilir
4. Teslim edildiğinde durum "tebliğ" yapılır
5. → Otomatik arşive taşınır
```

### Senaryo 2: İade Gelen Tebligat

```
1. Tebligat gönderildi durumunda
2. PTT'den iade gelir
3. Durum "iade" olarak güncellenir
4. Tebligat aktif listede kalır
5. Yeniden gönderim için işlem yapılır
6. Durum tekrar "gönderildi" yapılabilir
```

### Senaryo 3: İtiraz Edilen Tebligat

```
1. Tebligat teslim edilmiş
2. Karşı taraf itiraz eder
3. Durum "itiraz" olarak güncellenir
4. → Otomatik arşive taşınır
5. Hukuki süreç ayrıca takip edilir
```

---

## Dosya Referansları

| Bileşen | Dosya Yolu |
|---------|-----------|
| Route tanımları | `routes/tebligat.js` |
| Sayfa görünümü | `views/tebligatlar.ejs` |
| Arşiv görünümü | `views/archive.ejs` |
| Dashboard entegrasyonu | `views/dashboard.ejs` |
| Veritabanı şeması | `config/database.js` |
| Stil dosyası | `public/style.css` |
