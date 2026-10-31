CS2 Player Overlay v1.3.1 — Premiere Pro 25.6+ / UXP

Kurulum
- Bu klasördeki manifest.json dosyasını UXP Developer Tool ile ekleyip Load/Reload yapın.
- overlay-effects.js, numeric-control.js ve player-colors.js, main.js ile aynı klasörde bulunmalı.
- Eklenti kimliği değişmediği için mevcut oyuncu kütüphanesi korunur.

Animasyon (v1.3.1)
- Giriş hızlı başlar, duracağı konuma yaklaşırken yavaşlar (cubic ease-out).
- Giriş süresi ve kayma mesafesi ayarı korunur; çıkışın hız eğrisi değiştirilmedi.
- Hafif hareket bulanıklığı: Transform shutter angle 90°, composition shutter kapalı.
- API özel Bézier tutamaçlarını sunmadığı için eğri kare başına örneklenir;
  UI'daki Temporal Bézier / Spatial Auto Bézier bayraklarının birebir kopyası değildir.

Oyuncu renkleri
- Ayarlarda beş renkten birini seçip Ayarları Kaydet'e basın.
- Yellow #fcff00, Blue #8bcef2, Green #169f82, Purple #ba3094, Orange #e18230.
- Renk oyuncu verisiyle saklanır ve kütüphane kartında gösterilir.
- Yeni oyuncular Yellow ile başlar; eski oyunculara zorunlu bir renk atanmaz.
- Kaynak PNG'nin ProjectItem label rengi timeline'a eklenmeden önce ayarlanır;
  yeni timeline klibi bu kaynak label'ını miras alır. Daha önce bağımsız label
  verilmiş mevcut timeline klipleri yeniden renklendirilmez.
- Premiere'in mevcut label paleti kullanılır: YELLOW, BLUE, GREEN, PURPLE;
  Orange için API'deki MANGO yuvası. Özel HEX palet ayarları değiştirilmez.
- Renk seçimi fotoğraf piksellerine tint/renklendirme efekti uygulamaz.

Ayar alanları
- Position X ve Y aralığı -100000 ile +100000 olarak genişletildi.
  Örneğin X alanına 6000 yazıp Ayarları Kaydet ile saklayabilirsiniz.
- Artı/eksi düğmeleri kaldırıldı. Sayıya tıklayıp doğrudan değer yazabilirsiniz.
- Sayı veya ayar başlığı üzerinde sağa/sola sürüklemek değeri değiştirir.
- Shift: 10 kat hızlı; Alt: 10 kat hassas. Ondalık ayıracı olarak virgül de kabul edilir.
- Enter yazmayı onaylar; Esc yazmaya başlamadan önceki değere döner.
- Boş/geçersiz giriş son geçerli değere döner; sınırlar dışındaki değerler sınırlanır.
- Klavyede yukarı/aşağı okları da kullanılabilir. Ayarları Kaydet ile saklayın.

Kullanım
- Oyuncuya çift tıklama PNG'yi timeline'a ekler ve Transform animasyonunu uygular.
- Eski PNG'ler için aktif sequence'te “Timeline’daki PNG’lere efekt uygula” düğmesine basın.
  Yalnızca kütüphanedeki dosya yollarıyla eşleşen klipler işlenir. Kullanıcının mevcut
  Transform efekti olan, henüz yönetilmeyen klipleri üzerine yazılmadan atlanır.
- Klip kenarlarını uzatıp/kısalttıktan sonra yaklaşık 2 saniye bekleyin.
  Eklenti çalışıyor olmalı; aktif sequence izlenir. Kapalıyken yapılan değişiklikler
  panel tekrar açılınca ve ilgili sequence aktif olunca düzeltilir.
- Takip işareti klibin adındaki [CS2:...] ekidir. Otomatik takip için bu eki koruyun.
  Yönetilen ilk Transform efektini elle sıralamayın/değiştirmeyin; takip bu efekti yönetir.
- v1.3.1: Kayma mesafesi (%) ayarı eklendi. Varsayılan 50: eski mesafenin yarısı.
  25 daha kısa, 100 orijinal mesafe, 0 hareketsizdir. Hem giriş hem çıkışa uygulanır.
  Position X fotoğrafın durduğu yeri belirler; kayma mesafesi bu konumu değiştirmez.
- Önceki denemelerdeki süre kısaltmaları geri alındı. Giriş ~0,85 sn, çıkış ~0,87 sn.
  Klip kısa ise ikisi orantılı kısalır. En az iki kare gerekir.
- Oyuncu scale, konum, rotation ve opacity ayarları Transform'a uygulanır.
- Otomatik güncelleme ayrı bir geri alınabilir Premiere işlemi oluşturur. Dışa aktarmadan
  önce doğru sequence'i etkinleştirin ve animasyonun güncellenmesini bekleyin.

Preset ayrıntısı ve sınırlar
- Orijinal dosyalar presets/ altında korunur. İkisinin de dış konumu x=1,5104166,
  merkez x=0,5. Bu nedenle adı “slideinleft” olsa da verilen giriş sağdan merkezedir;
  çıkış merkezden sağadır. Shutter angle 360, composition shutter kapalıdır.
- .prfpset doğrudan import edilmez. Geometry2/Transform API ile yeniden oluşturulur.
  UXP özel temporal/spatial Bézier tutamaçlarını sunmadığı için yumuşama kare başına
  örneklenen smoothstep yaklaşımıdır; preset eğrilerinin birebir kopyası değildir.
- Burada Premiere host bulunmuyor. 14 Node testi zamanlama, kırpma, kısa klip, eski
  keyframe temizliği, efekt işlemleri ve otomatik takibi API taklitleriyle doğrular.
  Gerçek Premiere API davranışı ve render görüntüsü masaüstünde denenmelidir.

Masaüstü kontrolü
1. Bir PNG ekleyin: giriş, ortada sabit duruş, çıkışı oynatın; motion blur'u kontrol edin.
2. Sağ kenarı uzatın, kısaltın; ardından sol kenarı uzatın, kısaltın. Her seferinde
   ~2 sn bekleyip iki animasyonun yeni kenarlarda kaldığını kontrol edin.
3. 1 sn gibi kısa bir klipte ve farklı çözünürlükte deneyin.
4. Projeyi kaydedip paneli yeniden yükleyin; takibin sürdüğünü kontrol edin.
5. Her oyuncu rengini kaydedin, paneli yeniden yükleyin ve yeni bir klip ekleyin.
   Timeline label rengini kontrol edin; klip mirası gerçek Premiere hostunda doğrulanmalı.
6. Farklı sequence'e geçin, geri dönün; ilgisiz kliplerde değişiklik olmadığını doğrulayın.

Bulut kontrolleri: node --check main.js; node --check overlay-effects.js;
node tests/overlay-effects.test.js; node tests/numeric-control.test.js; node tests/player-colors.test.js
