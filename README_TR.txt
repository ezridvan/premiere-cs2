CS2 Player Overlay v1.1.0 — Premiere Pro 25.6+ / UXP

Kurulum
- Bu klasördeki manifest.json dosyasını UXP Developer Tool ile ekleyip Load/Reload yapın.
- overlay-effects.js ve numeric-control.js, main.js ile aynı klasörde bulunmalı.
- Eklenti kimliği değişmediği için mevcut oyuncu kütüphanesi korunur.

Ayar alanları (v1.1.0)
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
- Giriş ~0,85 sn, çıkış ~0,87 sn; klip kısa ise ikisi orantılı kısalır. En az iki kare gerekir.
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
- Burada Premiere host bulunmuyor. 11 Node testi zamanlama, kırpma, kısa klip, eski
  keyframe temizliği, efekt işlemleri ve otomatik takibi API taklitleriyle doğrular.
  Gerçek Premiere API davranışı ve render görüntüsü masaüstünde denenmelidir.

Masaüstü kontrolü
1. Bir PNG ekleyin: giriş, ortada sabit duruş, çıkışı oynatın; motion blur'u kontrol edin.
2. Sağ kenarı uzatın, kısaltın; ardından sol kenarı uzatın, kısaltın. Her seferinde
   ~2 sn bekleyip iki animasyonun yeni kenarlarda kaldığını kontrol edin.
3. 1 sn gibi kısa bir klipte ve farklı çözünürlükte deneyin.
4. Projeyi kaydedip paneli yeniden yükleyin; takibin sürdüğünü kontrol edin.
5. Farklı sequence'e geçin, geri dönün; ilgisiz kliplerde değişiklik olmadığını doğrulayın.

Bulut kontrolleri: node --check main.js; node --check overlay-effects.js;
node tests/overlay-effects.test.js; node tests/numeric-control.test.js
