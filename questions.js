'use strict';
const CATEGORIES = [
  { id: 'komik', name: 'Komik Sorular', adult: false },
  { id: 'arkadaslik', name: 'Arkadaşlık', adult: false },
  { id: 'kazik', name: 'Dost Kazığı', adult: false },
  { id: 'iliskiler', name: 'İlişkiler', adult: false },
  { id: 'utandiran', name: 'Utandıran Sorular', adult: false },
  { id: 'yetiskin', name: 'Yetişkinlere Özel (+18)', adult: true },
];
const DATA = {
  komik: [
    'Bu grupta en çok kim yalan söyler?', 'Zombi istilasında ilk kim kaçar?', 'Kim bir gün yanlışlıkla ünlü olur?',
    'Çölde mahsur kalsak kim yanlış yöne gitmekte ısrar eder?', 'Kim komşunun kedisiyle konuşuyordur?',
    'Kim hayatında bir kez bile zamanında gelmemiştir?', 'Kim alışveriş listesine hiç bakmadan markete girer?',
    'Kim mutfakta yangın çıkarma ihtimaliyle en yüksek kişidir?', 'Bir kahkaha yarışmasını kim kazanır?',
    'Kim uzaylılarla ilk anlaşan olur?', 'Kim telefonunu buzdolabında bulur?', 'Kim sinemada en yüksek sesle güler?',
    'Kim bir gün kendi gölgesinden korkar?', 'Kim yemek siparişinde hep yanlış adres yazar?',
    'Kim düz zeminde bile düşebilir?', 'Kim karaoke gecesinde mikrofonu bırakmaz?', 'Kim yılbaşında uyuyakalır?',
    'Kim GPS varken bile kaybolur?', 'Kim en saçma bahaneyi bulur?', 'Kim bir gün siyasete atılır diye korkuyorsun?',
    'Kim bir çocuk oyununda bile ciddi ciddi kavga eder?', 'Kim sosyal medyada en çok kendi fotoğrafını beğenir?',
    'Kim bir gün kendi doğum gününü unutur?', 'Kim tatilde bavulunu en çok doldurur?',
    'Kim yanlış kişiye mesaj atıp bunu fark etmez?', 'Kim dondurmayı en hızlı düşürür?', 'Kim şarkı sözlerini hep yanlış söyler?',
  ],
  arkadaslik: [
    'En büyük sırrını kime emanet edersin?', 'Gece 3\'te arasan kim telefonu açar?', 'Kim sana her zaman dürüst davranır?',
    'Zor gününde ilk kimi ararsın?', 'Kim en iyi tavsiyeleri verir?', 'Kiminle yıllarca aynı evde yaşayabilirsin?',
    'Kim senin için en çok fedakârlık yapar?', 'Kimle yolculuğa çıkmak en eğlencelidir?', 'Kim en iyi sır tutar?',
    'Kim grubun lideri olur?', 'Kime borç verirsin, geri alacağından eminsin?', 'Kim en iyi dinleyicidir?',
    'Kim grubu bir arada tutan kişidir?', 'Kim en cömerttir?', 'Kime en çok güvenirsin?',
    'Kim senin düğününde en çok ağlar?', 'Kimle uzun bir yürüyüşe çıkıp sohbet etmek istersin?',
    'Kim kriz anında soğukkanlı kalır?', 'Kim en iyi sürpriz parti düzenler?', 'Kim en güzel hediyeyi seçer?',
    'Kim seni herkesten iyi tanır?', 'Kimle ömür boyu arkadaş kalırsın?', 'Kim grubun en neşelisidir?',
    'Kim her zaman yardıma koşar?', 'Hastanede yatsan kim ilk ziyarete gelir?', 'Kim en iyi motivasyon konuşmasını yapar?',
    'Kim dostluğu en çok önemser?',
  ],
  kazik: [
    'Ünlü olunca arkadaşlarını ilk kim unutur?', 'Hesabı ödeme sırası gelince kim tuvalete kaybolur?',
    'Kim senin yemeğini habersizce yer?', 'Kim ödünç aldığı şeyi geri vermez?', 'Kim son anda plan iptal eder?',
    'Kim grup fotoğrafında hep en iyi çıkmak için herkesi bekletir?', 'Kim arkadaşını bir kızın/erkeğin yanında kazıklar?',
    'Kim sırrını en kolay ele verir?', 'Kim piyango kazanırsa kimseye söylemez?', 'Kim senin bahanenle işten kaçar?',
    'Kim kendi hatasını arkadaşına yıkar?', 'Kim son lokmayı sormadan yer?', 'Kim taksi paylaşımında hesabı karıştırır?',
    'Kim senin Netflix şifreni başkasına verir?', 'Kim bir oyunda hile yapar?', 'Kim dedikoduyu en çabuk yayar?',
    'Kim kapıda beklerken seni bırakıp gider?', 'Kim sürpriz partiyi ağzından kaçırır?', 'Kim arkadaşının fotoğrafını izinsiz paylaşır?',
    'Kim "ben ödeyeceğim" deyip ödemez?', 'Kim senin yerine bahane uydurur ama yanlış bahane uydurur?',
    'Kim kazandığı parayı hiç kimseyle paylaşmaz?', 'Kim bir grup projesinde hiçbir şey yapmaz?',
    'Kim senin şarj aletini "bir dakikalığına" alıp geri vermez?', 'Kim en çok "ben demiştim" der?',
    'Kim sana ait bir şeyi kaybedip sessiz kalır?', 'Kim arkadaşını bir iş için kullanıp unutur?',
  ],
  iliskiler: [
    'En çabuk kim âşık olur?', 'Kim ilk evlenir?', 'Kim en romantik sürprizi yapar?', 'Kim eski sevgilisini en uzun süre unutamaz?',
    'Kim ilk buluşmada heyecandan saçmalar?', 'Kim en kıskanç sevgili olur?', 'Kim ilişkide en çok ödün verir?',
    'Kim sevgilisine en güzel mesajları yazar?', 'Kim ilk kavgadan sonra barışmak için adım atar?',
    'Kim en iyi evlilik teklifini planlar?', 'Kim sevgililer gününü en çok ciddiye alır?', 'Kim ilişkisini en çok gizler?',
    'Kim bir gün uzak mesafe ilişki yaşar?', 'Kim flörtte en cesurdur?', 'Kim aşk acısını en dramatik yaşar?',
    'Kim sevgilisinin ailesini en çabuk kendine hayran bırakır?', 'Kim ilk bakışta aşka inanır?',
    'Kim aşkı için şehir değiştirir?', 'Kim kırıldığını belli etmez?', 'Kim sevgilisiyle ortak hesap açar?',
    'Kim en çok "sadece arkadaşız" der ama değildir?', 'Kim sevdiğine en güzel şiiri yazar?',
    'Kim ilişkide en çok konuşan taraftır?', 'Kim düğününde en çok dans eder?', 'Kim en uzun ilişkiyi yaşar?',
    'Kim kalbini en zor açar?', 'Kim aşk için en çılgın şeyi yapar?',
  ],
  utandiran: [
    'Kim en utanç verici lakaba sahip?', 'Kim bir gün kalabalığın içinde düşüp herkesi güldürür?',
    'Kim en kötü dans eder?', 'Kimin arama geçmişi en utandırıcıdır?', 'Kim en komik çocukluk fotoğrafına sahip?',
    'Kim yanlış kişiye "seni seviyorum" yazar?', 'Kim sahnede şarkı söylerken sesi kısılır?',
    'Kim derste/işte uyuyakalır?', 'Kim en çok çocukluk korkularını hâlâ taşıyor?', 'Kim asansörde yanlış kata çıkıp çıkmaz?',
    'Kim en tuhaf rüyaları görür?', 'Kim ünlü birinin önünde saçmalar?', 'Kim en utanç verici telefon melodisine sahip?',
    'Kim bir gün canlı yayında yanlış bir şey söyler?', 'Kim doğum gününde en çok utanır?',
    'Kim uzun süre aynı kıyafeti giyer?', 'Kim fotoğrafta hep aynı pozu verir?', 'Kim yanlış kapıyı çalıp içeri girer?',
    'Kim en tuhaf yeteneğe sahip?', 'Kim bir gün kendini aynada konuşurken yakalanır?', 'Kim en eski telefon mesajını saklıyor?',
    'Kim hâlâ çizgi film izliyor?', 'Kim yemekte en tuhaf alışkanlıklara sahip?', 'Kim ismini en çok yanlış söyleten kişi?',
    'Kim bir toplantıda mikrofonu açık unutur?', 'Kim en çok kıkırdama krizine girer?', 'Kim en çok "Şunu görmedim" derken yakalanır?',
  ],
  yetiskin: [
    'Kim ilk buluşmada en çok hazırlık yapar?', 'Kim flört uygulamasında en çok vakit geçirir?', 'Kim bir tatilde romantik bir macera yaşar?',
    'Kim âşık olduğunu ilk itiraf eder?', 'Kim en çekici gülümsemeye sahip?', 'Kim bir randevuya en şık gelir?',
    'Kim en iyi iltifat eder?', 'Kim gizli bir hayranı olduğunu bilmez?', 'Kim aşk mektubu yazmaya en yatkın?',
    'Kim romantik bir akşam yemeğini en iyi planlar?', 'Kim en çok kalbini kırar?', 'Kim bir gün evlilik teklifini yapar?',
    'Kim mesajlaşırken en çok flört eder?', 'Kim ilişkisini en çok sosyal medyada paylaşır?', 'Kim ilk tanışmada en çok akılda kalır?',
    'Kim bir gece kulübünde en çok dikkat çeker?', 'Kim eski aşkına en çok mesaj atmak ister?', 'Kim en büyük aşk sırrını saklıyor?',
    'Kim flört ederken en çok kendinden emin görünür?', 'Kim gizli bir aşk yaşıyor olabilir?',
  ],
};
const norm = (s) => s.trim().toLowerCase();
function pool(cats, adult) {
  const seen = new Set(); const out = [];
  for (const c of cats) {
    const meta = CATEGORIES.find((x) => x.id === c);
    if (!meta || (meta.adult && !adult)) continue;
    for (const t of DATA[c]) { const k = norm(t); if (!seen.has(k)) { seen.add(k); out.push({ text: t, cat: c }); } }
  }
  return out;
}
module.exports = { CATEGORIES, DATA, pool };
