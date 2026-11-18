# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Vite, React ve shadcn. Liste okuma Node tarafında kalır; tarayıcı çalma listesi sayfalarını CORS yüzünden okuyamaz. Arayüz yalnızca shadcn bileşenlerinden kurulur.

## Users

Mustafa, öğrenci. Kendi Spotify, Apple Music ve YouTube Music çalma listelerini başka bir yere taşımak için parçaların yazılı dökümüne ihtiyaç duyar. Listeyi bir sohbette veya tarayıcıda açıkken bağlantısını kopyalar.

## Product Purpose

Herkese açık bir çalma listesi bağlantısını yapıştırır, parçaları okur, CSV indirir. Başarı, indirilen dosyanın listedeki parçaları sıra, ad, sanatçı ve süre olarak taşımasıdır.

## Positioning

Hesap bağlanmaz. Okuma, servisin herkese açık sayfasından yapılır. Giriş isteyen aktarım araçlarının aksine, tek gereksinim herkese açık bağlantıdır.

## Operating Context

Site kullanıcının bilgisayarında çalışır. Bağlantı yapıştırılır, liste okunur, tablo kontrol edilir, CSV indirilir. Gizli listeler ve kişiye özel listeler bu akışın dışındadır.

## Capabilities and Constraints

- Kaynaklar: Spotify, Apple Music, YouTube Music. Yalnızca herkese açık listeler.
- Çıktı: CSV. Sütunlar sıranın kendisinden gelir: sıra, parça, sanatçı, albüm (sayfa verirse), süre, kaynak, parça bağlantısı.
- Hesap, OAuth ve geliştirici anahtarı yok. Kullanıcı bunu seçti.
- Özel ve kişiye özel listeler okunamaz. Bu bir eksik değil, ürün sınırı.
- Sayfanın verdiği parça sayısı, servisin herkese açık sayfasının verdiği kadardır. Eksik kalırsa arayüz bunu söyler.
- Ürün adı kullanıcı tarafından konmadı. Karar açık.

## Evidence on Hand

Gerçek müşteri, istatistik veya referans yok. Uydurulmayacak. Gösterilecek tek veri, kullanıcının yapıştırdığı listeden okunan parçalardır.

## Product Principles

- Bağlantı yapıştırılır, dosya iner. Aradaki adımlar bu iki işe hizmet eder.
- Okunamayan liste sessizce kısaltılmaz. Ne okunduğu ve ne okunamadığı yazılır.
- Hesap istenmez.
- Arayüz, listeyi okuma işinin kendisidir.
