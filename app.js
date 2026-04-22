// ============================================================
//  UÇUR BALONUNU — MASTER APP ENGINE (V6.1 - WEEKLY ACCUMULATION)
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAYCVekQN3oOh4_2K0KmovLMW9O6xWaH-8",
    authDomain: "ucurbalonu.firebaseapp.com",
    projectId: "ucurbalonu",
    storageBucket: "ucurbalonu.firebasestorage.app",
    messagingSenderId: "677201903733",
    appId: "1:677201903733:web:f5708b28f410ae7036b83c"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db   = firebase.firestore();

// 1. SAYFA TESPİTİ
const IS_ADMIN_PAGE = window.location.pathname.includes('admin.html');
const IS_SUPERADMIN_PAGE = window.location.pathname.includes('superadmin.html');

// 2. YARDIMCI GÖRSEL KONTROLLER
function gosterGizle(id, durum) {
    const el = document.getElementById(id);
    if (el) el.style.display = durum;
}

// 3. TARİH FONKSİYONLARI
function bugunuSifirla(tarih) {
    return new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
}

function haftalikSifirla(tarih) {
    const hafta = tarih.getDay() === 0 ? 6 : tarih.getDay() - 1;
    const sifirlanmis = new Date(tarih);
    sifirlanmis.setDate(tarih.getDate() - hafta);
    return bugunuSifirla(sifirlanmis);
}

function aylikSifirla(tarih) {
    return new Date(tarih.getFullYear(), tarih.getMonth(), 1);
}

// 4. AUTH TAKİBİ VE YÖNLENDİRME
auth.onAuthStateChanged(user => {
    if (user) {
        db.collection('users').doc(user.uid).get().then(doc => {
            if (!doc.exists) return;
            const userData = doc.data();

            // SUPERADMIN KONTROL
            if (userData.rol === 'superadmin') {
                if (!IS_SUPERADMIN_PAGE) {
                    window.location.href = 'superadmin.html';
                } else {
                    superadminPaneliYukle(userData);
                }
            }
            // ÖĞRETMEN KONTROL
            else if (userData.rol === 'ogretmen') {
                if (!IS_ADMIN_PAGE) {
                    window.location.href = 'admin.html';
                } else {
                    adminPaneliYukle(userData);
                }
            }
            // ÖĞRENCİ KONTROL
            else if (userData.rol === 'ogrenci') {
                if (IS_ADMIN_PAGE || IS_SUPERADMIN_PAGE) {
                    window.location.href = 'index.html';
                } else {
                    // Günde 1 kez kontrolü
                    kontorGirisSaatiBilgisi(user.uid);
                    ogrenciPaneliYukle(user.uid, userData);
                }
            }
        });
    } else {
        if (IS_ADMIN_PAGE) window.location.href = 'index.html';
        else if (IS_SUPERADMIN_PAGE) window.location.href = 'index.html';
        else if (typeof window.illeriDoldur === 'function') window.illeriDoldur();
    }
});

// --- 5. GÜNDE 1 KEZ GİRİŞ KONTROLİ ---
function kontorGirisSaatiBilgisi(uid) {
    const userRef = db.collection('users').doc(uid);
    
    userRef.get().then(doc => {
        if (!doc.exists) return;
        
        const userData = doc.data();
        const sonGirisTarihi = userData.sonGirisTarihi ? new Date(userData.sonGirisTarihi) : null;
        const bugun = bugunuSifirla(getTurkiyeZamani());
        
        // Eğer bugün giriş yapılmışsa çık
        if (sonGirisTarihi && bugunuSifirla(new Date(sonGirisTarihi)).getTime() === bugun.getTime()) {
            return;
        }
        
        // Haftalık sıfırlama kontrol (PAZARTESİ SABAHI SIFIRLA)
        const sonHaftaBasi = userData.haftalikBaslangic ? new Date(userData.haftalikBaslangic) : sonGirisTarihi;
        const buHaftaBasi = haftalikSifirla(bugun);
        
        const updates = {
            sonGirisTarihi: bugun,
            girisGecmisi: firebase.firestore.FieldValue.arrayUnion(bugun.toISOString())
        };
        
        // Haftalık balon SİFIRLA (yeni hafta başladıysa)
        if (!sonHaftaBasi || haftalikSifirla(new Date(sonHaftaBasi)).getTime() !== buHaftaBasi.getTime()) {
            // Haftalık rozeti SİL (yeni hafta, eski rozet geçerli değil)
            updates.haftalikBaslangic = buHaftaBasi;
            updates.balonYuksekligi = 0; // Pazardan sonra SİFIRLA
            updates.haftalikSayfa = 0; // Haftalık sayfa da sıfırla
            updates.haftalikBadge = null; // Haftalık rozeti KALDIR
        }
        
        // Aylık ve yıllık tutmaya devam et
        if (!userData.aylikSayfa) updates.aylikSayfa = 0;
        if (!userData.dort_aylikSayfa) updates.dort_aylikSayfa = 0;
        if (!userData.yillikSayfa) updates.yillikSayfa = 0;
        
        userRef.update(updates);
        
        // Seri rozet kontrol
        kontorSeriRozet(uid);
    });
}
// --- 6. SERİ ROZET KONTROL ---
function kontorSeriRozet(uid) {
    db.collection('users').doc(uid).get().then(doc => {
        if (!doc.exists) return;
        
        const userData = doc.data();
        const girisGecmisi = userData.girisGecmisi || [];
        
        // Son kaç gün peş peşe giriş yapılmış?
        let seriGun = 0;
        const bugun = new Date();
        
        for (let i = 0; i < 365; i++) {
            const tarih = new Date(bugun);
            tarih.setDate(bugun.getDate() - i);
            const tarihStr = bugunuSifirla(tarih).toISOString();
            
            if (girisGecmisi.includes(tarihStr)) {
                seriGun++;
            } else if (i > 0) {
                break;
            }
        }
        
        const rozetler = userData.rozetler || [];
        let yeniRozetler = [...rozetler];
        
        // 10 gün, 20 gün, 30 gün rozetleri
        if (seriGun === 10 && !rozetler.includes('10gun')) {
            yeniRozetler.push('10gun');
            db.collection('users').doc(uid).update({ rozetler: yeniRozetler });
        } else if (seriGun === 20 && !rozetler.includes('20gun')) {
            yeniRozetler.push('20gun');
            db.collection('users').doc(uid).update({ rozetler: yeniRozetler });
        } else if (seriGun === 30 && !rozetler.includes('30gun')) {
            yeniRozetler.push('30gun');
            db.collection('users').doc(uid).update({ rozetler: yeniRozetler });
        }
    });
}

// --- 7. HAFTALIK SIRALAMA ROZET (PAZARTESİ SABAHI AÇIKLANIR) ---
function kontorHaftaliSiralamaBadge(okul, sinif, sube) {
    db.collection('users')
        .where('okul', '==', okul)
        .where('sinif', '==', sinif)
        .where('sube', '==', sube)
        .where('rol', '==', 'ogrenci')
        .get()
        .then(snapshot => {
            // Öğrencileri haftalık sayfa sayısına göre sırala
            const ogrenciler = [];
            snapshot.forEach(doc => {
                ogrenciler.push({
                    id: doc.id,
                    haftalikSayfa: doc.data().haftalikSayfa || 0
                });
            });
            
            ogrenciler.sort((a, b) => b.haftalikSayfa - a.haftalikSayfa);
            
            // Önce TÜM öğrencilerin haftalık rozetini temizle
            snapshot.forEach(doc => {
                db.collection('users').doc(doc.id).update({ 
                    haftalikBadge: null
                });
            });
            
            // Sonra sadece ilk 3'e rozet ver
            const rozetAta = {
                0: 'haftalik_1',
                1: 'haftalik_2',
                2: 'haftalik_3'
            };
            
            ogrenciler.forEach((ogr, index) => {
                if (index < 3 && rozetAta[index]) {
                    db.collection('users').doc(ogr.id).update({ 
                        haftalikBadge: rozetAta[index]
                    });
                }
            });
        });
}

// --- 8. SUPERADMIN PANELİ MANTIĞI ---
function superadminPaneliYukle(userData) {
    console.log("Superadmin paneli yükleniyor...");
    gosterGizle('auth-area', 'none');
    gosterGizle('superadmin-area', 'block');
    
    window.illeriDoldur();
}

// --- 9. ÖĞRENCİ PANELİ MANTIĞI ---
function ogrenciPaneliYukle(uid, data) {
    gosterGizle('auth-area', 'none');
    gosterGizle('user-panel', 'block');
    
    const welcome = document.getElementById('welcome-msg');
    if (welcome) welcome.innerText = `Selam, ${data.ogrenciAdSoyad}!`;
    
    const heightDisp = document.getElementById('display-height');
    if (heightDisp) heightDisp.innerText = data.balonYuksekligi || 0;

    balonlariGoster(data.okul, data.sinif, data.sube);
    
    // Rozetleri göster
    rozetleriGoster(uid);
}

// --- 10. ROZETLERI GÖSTER ---
function rozetleriGoster(uid) {
    const medalyaDiv = document.getElementById('medalyalar');
    if (!medalyaDiv) return;
    
    db.collection('users').doc(uid).onSnapshot(doc => {
        const rozetler = doc.data().rozetler || [];
        const rozetEmlari = {
            '10gun': '🔟',
            '20gun': '2️⃣0️⃣',
            '30gun': '3️⃣0️⃣',
            'haftalik_🥇': '🥇',
            'haftalik_🥈': '🥈',
            'haftalik_🥉': '🥉',
            'aferin': '⭐'
        };
        
        let html = '<div class="medal-shelf">';
        rozetler.forEach(r => {
            if (rozetEmlari[r]) {
                html += `<span class="medal-icon" title="${r}">` + rozetEmlari[r] + '</span>';
            }
        });
        html += '</div>';
        
        medalyaDiv.innerHTML = html;
    });
}

// --- 11. ADMIN PANELİ MANTIĞI (ÖĞRETMEN) ---
function adminPaneliYukle(userData) {
    console.log("Admin paneli yükleniyor...");
    gosterGizle('auth-area', 'none');
    gosterGizle('admin-area', 'block');
    
    balonlariGoster(userData.okul, userData.sinif, userData.sube);
    ogrenciListele(userData.okul, userData.sinif, userData.sube);
}

// --- 12. İL / İLÇE / OKUL MOTORU ---
window.illeriDoldur = function() {
    const ids = ["sehir", "yeniOkulIl"];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el && typeof ilVerisi !== 'undefined') {
            el.innerHTML = '<option value="">İl Seçiniz</option>';
            Object.keys(ilVerisi).sort((a,b) => a.localeCompare(b,'tr')).forEach(il => {
                el.innerHTML += `<option value="${il}">${il}</option>`;
            });
        }
    });
};

window.ilceleriYukle = function(isChild = false) {
    const ilId = isChild ? "yeniOkulIl" : "sehir";
    const ilceId = isChild ? "yeniOkulIlce" : "ilce";
    const sehir = document.getElementById(ilId).value;
    const ilceSelect = document.getElementById(ilceId);
    if (!ilceSelect) return;
    ilceSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
    if (sehir && ilVerisi[sehir]) {
        ilVerisi[sehir].forEach(ilce => {
            ilceSelect.innerHTML += `<option value="${ilce}">${ilce}</option>`;
        });
    }
};

window.okullariYukle = function() {
    const il = document.getElementById("sehir").value;
    const ilce = document.getElementById("ilce").value;
    const okulSelect = document.getElementById("okul");
    if (!okulSelect || !il || !ilce) return;
    db.collection("sistem").doc("okulListesi").get().then(doc => {
        okulSelect.innerHTML = '<option value="">Okul Seçiniz</option>';
        if (doc.exists) {
            const okullar = doc.data()[`${il}_${ilce}`] || [];
            okullar.sort().forEach(o => okulSelect.innerHTML += `<option value="${o}">${o}</option>`);
        }
    });
};

window.yeniOkulIlceleriYukle = function() {
    window.ilceleriYukle(true);
};

// --- 13. BALONLARI ÇİZME MOTORU ---
function balonlariGoster(okul, sinif, sube) {
    const container = IS_ADMIN_PAGE ? 
        document.getElementById('admin-balloon-container') : 
        document.getElementById('balloon-container');
    
    if (!container) {
        console.warn("Balon container bulunamadı!");
        return;
    }

    const uid = auth.currentUser ? auth.currentUser.uid : null;

    db.collection('users')
        .where('okul', '==', okul)
        .where('sinif', '==', sinif)
        .where('sube', '==', sube)
        .where('rol', '==', 'ogrenci')
        .onSnapshot(querySnapshot => {
            container.innerHTML = '';
            querySnapshot.forEach(doc => {
                const s = doc.data();
                
                const b = document.createElement('div');
                b.className = 'balloon';
                
                const yOffset = Math.min((s.balonYuksekligi || 0), 330);
                b.style.bottom = (20 + yOffset) + 'px';
                
                const isMe = doc.id === uid;
                b.style.left = (isMe && !IS_ADMIN_PAGE) ? '50%' : (Math.random() * 80 + 10) + '%';
                
                b.style.backgroundColor = (isMe && !IS_ADMIN_PAGE) ? '#ff5e57' : '#3498db';
                b.style.transform = IS_ADMIN_PAGE ? 'scale(0.7)' : 'scale(1)';
                
                let label = '';
                if (IS_ADMIN_PAGE) {
                    label = s.ogrenciAdSoyad || 'Anonim';
                } else {
                    label = isMe ? 'Sen' : (s.balonEtiketi || 'Anonim');
                }
                
                b.innerHTML = `<div class="balloon-label">${label}</div>`;
                
                container.appendChild(b);
            });
        }, err => console.error("Balonlar yüklenirken hata:", err));
}

// --- 14. ÖĞRENCİ LİSTELEME ---
function ogrenciListele(okul, sinif, sube) {
    const listArea = document.getElementById('admin-student-list');
    if (!listArea) return;

    db.collection('users')
        .where('okul', '==', okul)
        .where('sinif', '==', sinif)
        .where('sube', '==', sube)
        .where('rol', '==', 'ogrenci')
        .onSnapshot(snapshot => {
            listArea.innerHTML = '';
            snapshot.forEach(doc => {
                const s = doc.data();
                const rozetler = s.rozetler || [];
                const haftalikBadge = s.haftalikBadge; // SADECE bu haftanın rozeti
                
                let rozetHtml = '';
                
                // Mevcut haftalık rozeti göster (SADECE bu hafta)
                if (haftalikBadge) {
                    const rozetMap = {
                        'haftalik_1': '🥇',
                        'haftalik_2': '🥈',
                        'haftalik_3': '🥉'
                    };
                    if (rozetMap[haftalikBadge]) rozetHtml += rozetMap[haftalikBadge];
                }
                
                // Diğer rozetleri göster (seri, aferin vb)
                rozetler.forEach(r => {
                    const rozetMap = {
                        '10gun': '🔟',
                        '20gun': '2️⃣0️⃣',
                        '30gun': '3️⃣0️⃣',
                        'aferin': '⭐'
                    };
                    if (rozetMap[r]) rozetHtml += rozetMap[r];
                });
                
                listArea.innerHTML += `
                    <div style="background:white; padding:10px; margin:5px; border-radius:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div style="flex: 1;">
                            <b>${s.ogrenciAdSoyad}</b>
                            <span style="color:#666; margin-left:10px;">${s.haftalikSayfa || 0} sayfa</span>
                            ${rozetHtml ? `<div style="margin-left:10px; font-size:18px;">${rozetHtml}</div>` : ''}
                        </div>
                        <button onclick="rozetVer('${doc.id}')" style="background: #f39c12; padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer; color: white;">
                            ⭐ Aferin
                        </button>
                    </div>`;
            });
        });
}

// --- 15. ROZET VERME (AFERIN) ---
window.rozetVer = function(ogrenciId) {
    db.collection('users').doc(ogrenciId).get().then(doc => {
        const rozetler = doc.data().rozetler || [];
        
        if (!rozetler.includes('aferin')) {
            rozetler.push('aferin');
            db.collection('users').doc(ogrenciId).update({ rozetler }).then(() => {
                alert("Aferin rozeti verildi! ⭐");
            });
        } else {
            alert("Bu öğrenci zaten aferin rozetine sahip!");
        }
    });
};

// --- 16. YÜKSEKLİK ARTIRMA (GÜNDE 1 KEZ - BİRİKİMLİ) ---
window.yukseklikArtir = function() {
    const sayfa = parseInt(document.getElementById('sayfaSayisi').value);
    if (!sayfa || sayfa <= 0) return alert("Lütfen geçerli sayfa gir.");
    
    const user = auth.currentUser;
    const ref = db.collection('users').doc(user.uid);
    
    db.runTransaction(transaction => {
        return transaction.get(ref).then(doc => {
            const userData = doc.data();
            
            // Günde 1 kez kontrolü
            const sonGirisTarihi = userData.sonGirisTarihi ? new Date(userData.sonGirisTarihi) : null;
            const bugun = bugunuSifirla(new Date());
            
            if (sonGirisTarihi && bugunuSifirla(sonGirisTarihi).getTime() === bugun.getTime()) {
                return alert("⏰ Bugün zaten sayfa girdin! Yarın tekrar deneyebilirsin.");
            }
            
            // HAFTALIK BİRİKİMLİ (bir önceki gün üzerine ekle)
            const mevcutHaftalikSayfa = userData.haftalikSayfa || 0;
            const yeniHaftalikSayfa = mevcutHaftalikSayfa + sayfa;
            
            // AYLIK (tüm ayı tutmaya devam et)
            const yeniAylikSayfa = (userData.aylikSayfa || 0) + sayfa;
            
            // 4-AYLIK
            const yeni4AylikSayfa = (userData.dort_aylikSayfa || 0) + sayfa;
            
            // YILLIK
            const yeniYillikSayfa = (userData.yillikSayfa || 0) + sayfa;
            
            // BALON YÜKSEKLİĞİ = haftalık birikimli sayfa (1 sayfa = 1 metre)
            const yeniYukseklik = yeniHaftalikSayfa;
            
            transaction.update(ref, { 
                haftalikSayfa: yeniHaftalikSayfa,
                aylikSayfa: yeniAylikSayfa,
                dort_aylikSayfa: yeni4AylikSayfa,
                yillikSayfa: yeniYillikSayfa,
                balonYuksekligi: yeniYukseklik,  // BİRİKİMLİ
                toplamOkunanSayfa: (userData.toplamOkunanSayfa || 0) + sayfa,
                sonGirisTarihi: bugun,
                girisGecmisi: firebase.firestore.FieldValue.arrayUnion(bugun.toISOString())
            });
        });
    }).then(() => {
        document.getElementById('sayfaSayisi').value = '';
        kontorSeriRozet(user.uid);
        // Öğretmenin sınıfını al ve haftalık sıralamayı güncelle
        db.collection('users').doc(user.uid).get().then(doc => {
            const userData = doc.data();
            kontorHaftaliSiralamaBadge(userData.okul, userData.sinif, userData.sube);
        });
    }).catch(e => alert("Hata: " + e.message));
};

// --- 17. KAYIT / GİRİŞ / ÇIKIŞ ---
window.register = function() {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    const rol = document.getElementById('rolSecimi').value;
    
    if (!email || !pass) return alert("E-posta ve şifre gerekli!");
    
    auth.createUserWithEmailAndPassword(email, pass).then(res => {
        const finalRol = (rol === 'admin' ? 'ogretmen' : 'ogrenci');
        
        const userData = {
            ogrenciAdSoyad: document.getElementById('ogrenciAdSoyad').value,
            okul: document.getElementById('okul').value,
            sinif: document.getElementById('sinif').value,
            sube: document.getElementById('sube').value,
            rol: finalRol
        };
        
        // ÖĞRETMEN değilse balon verisi ekle
        if (finalRol === 'ogrenci') {
            userData.balonEtiketi = document.getElementById('takmaAd').value || "Anonim";
            userData.balonYuksekligi = 0;
            userData.haftalikSayfa = 0;
            userData.aylikSayfa = 0;
            userData.dort_aylikSayfa = 0;
            userData.yillikSayfa = 0;
            userData.rozetler = [];
            userData.haftalikBadge = null; // Haftalık rozeti başta boş
            userData.girisGecmisi = [];
            userData.sonGirisTarihi = getTurkiyeZamani();
            userData.haftalikBaslangic = haftalikSifirla(getTurkiyeZamani());
        }
        
        return db.collection("users").doc(res.user.uid).set(userData);
    }).then(() => { 
        alert("Kayıt Başarılı!"); 
        location.reload(); 
    }).catch(e => alert("Hata: " + e.message));
};
// --- 18. FORM NAVİGASYONU ---
window.showLoginForm = function() {
    gosterGizle('role-selection-area', 'none');
    gosterGizle('dynamic-register-form', 'none');
    gosterGizle('login-area', 'block');
};

window.showRegisterForm = function(rol) {
    gosterGizle('role-selection-area', 'none');
    gosterGizle('login-area', 'none');
    gosterGizle('dynamic-register-form', 'block');
    document.getElementById('rolSecimi').value = rol;
    
    const formTitle = document.getElementById('form-title');
    if (formTitle) {
        formTitle.innerText = (rol === 'admin' ? 'Öğretmen Kaydı' : 'Öğrenci Kaydı');
    }
    
    // Öğretmen kaydında takma isim gizle
    const takmaAdInput = document.getElementById('takmaAd');
    if (takmaAdInput) {
        takmaAdInput.style.display = (rol === 'admin' ? 'none' : 'block');
    }
    
    window.illeriDoldur();
};

window.resetRoleSelection = function() {
    gosterGizle('dynamic-register-form', 'none');
    gosterGizle('login-area', 'none');
    gosterGizle('role-selection-area', 'block');
};

// --- 19. ÖĞRETMENİN DUYURU YAPMA ---
window.duyuruYayinla = function() {
    const hedef = document.getElementById('haftalikHedef').value;
    if (!hedef) return alert("Lütfen bir hedef yazınız!");
    
    const user = auth.currentUser;
    db.collection('users').doc(user.uid).get().then(doc => {
        const userData = doc.data();
        db.collection('duyurular').add({
            ogretmenId: user.uid,
            ogretmenAdı: userData.ogrenciAdSoyad,
            okul: userData.okul,
            sinif: userData.sinif,
            sube: userData.sube,
            mesaj: hedef,
            tarih: new Date()
        }).then(() => {
            alert("Duyuru yayınlandı!");
            document.getElementById('haftalikHedef').value = '';
        }).catch(e => alert("Hata: " + e.message));
    });
};

// --- 20. YENİ OKUL EKLEME FONKSİYONU ---
window.okulEkle = function() {
    const il = document.getElementById("yeniOkulIl").value;
    const ilce = document.getElementById("yeniOkulIlce").value;
    const ad = document.getElementById("yeniOkulAd").value;
    
    if(!il || !ilce || !ad) return alert("Lütfen tüm alanları doldurunuz!");
    
    db.collection("sistem").doc("okulListesi").set({
        [`${il}_${ilce}`]: firebase.firestore.FieldValue.arrayUnion(ad)
    }, {merge:true}).then(() => {
        alert("Okul Eklendi!");
        document.getElementById("yeniOkulAd").value = '';
    }).catch(e => alert("Hata: " + e.message));
};
