# Parçaları CSV yap

Herkese açık bir Spotify, Apple Music veya YouTube Music listesinin bağlantısını yapıştırır, parçaları okur, CSV indirir. Hesap bağlanmaz.

```bash
npm install
npm run dev
```

Geliştirme adresi `http://127.0.0.1:5173`. Yayında önce sayfa derlenir, sonra Node sunucusu `dist` klasörünü ve `/api/playlist` yolunu açar.

```bash
npm run build
npm start
```

Sunucu `PORT` değerini ortamdan okur. Varsayılan kapı `4317`.
