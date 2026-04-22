// ============================================================
//  UÇUR BALONUNU — MASTER APP ENGINE
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

// --- SAYFA TESPİTİ ---
const SAYFA_ADI          = window.location.pathname.split('/').pop() || 'index.html';
const IS_SUPERADMIN_PAGE = SAYFA_ADI === 'superadmin.html';
const IS_ADMIN_PAGE      = SAYFA_ADI === 'admin.html';

// Kayıt işlemi sırasında onAuthStateChanged'ın tetiklenmesini önlemek için bayrak
let kayitDevamEdiyor = false;

// --- YARDIMCI ---
function gosterGizle(id, durum) {
    const el = document.getElementById(id);
    if (el) el.style.display = durum;
}

// --- TÜRKİYE ZAMANI ---
function getTurkiyeZamani() {
    return new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
}

// --- TARİH YARDIMCILARI ---
function bugunuSifirla(tarih) {
    return new Date(tarih.getFullYear(), tarih.getMonth(), tarih.getDate());
}
function haftalikSifirla(tarih) {
    const gun = tarih.getDay() === 0 ? 6 : tarih.getDay() - 1;
    const d = new Date(tarih);
    d.setDate(tarih.getDate() - gun);
    return bugunuSifirla(d);
}

// --- AUTH TAKİBİ ---
auth.onAuthStateChanged(function(user) {
    // Kayıt devam ediyorsa bu tetiklenmeyi yoksay
    if (kayitDevamEdiyor) return;

    if (user) {
        db.collection('users').doc(user.uid).get().then(function(doc) {
            if (!doc.exists) return;
            const userData = doc.data();
            const rol = userData.rol;

            if (rol === 'superadmin') {
                if (!IS_SUPERADMIN_PAGE) {
                    window.location.href = 'superadmin.html';
                } else {
                    superadminPaneliYukle();
                }
            } else if (rol === 'ogretmen') {
                if (!IS_ADMIN_PAGE) {
                    window.location.href = 'admin.html';
                } else {
                    adminPaneliYukle(userData);
                }
            } else if (rol === 'ogrenci') {
                if (IS_ADMIN_PAGE || IS_SUPERADMIN_PAGE) {
                    window.location.href = 'index.html';
                } else {
                    haftalikSifirlamaKontrol(user.uid);
                    ogrenciPaneliYukle(user.uid, userData);
                }
            }
        });
    } else {
        if (IS_ADMIN_PAGE || IS_SUPERADMIN_PAGE) {
            window.location.href = 'index.html';
        } else {
            illeriDoldur();
        }
    }
});

// --- SUPERADMİN PANELİ ---
function superadminPaneliYukle() {
    gosterGizle('auth-area',       'none');
    gosterGizle('superadmin-area', 'block');
    illeriDoldur();
    okullarListele();
}

function okullarListele() {
    const listesi = document.getElementById('okullar-listesi');
    if (!listesi) return;
    db.collection('sistem').doc('okulListesi').onSnapshot(function(doc) {
        if (!doc.exists || Object.keys(doc.data()).length === 0) {
            listesi.innerHTML = '<p style="color:#999">Henüz okul eklenmemiş.</p>';
            return;
        }
        const okullar = doc.data();
        let html = '';
        Object.keys(okullar).sort().forEach(function(key) {
            const parcalar = key.split('_');
            const il   = parcalar[0];
            const ilce = parcalar.slice(1).join('_');
            html += '<div style="background:white;padding:10px;margin:5px;border-radius:8px;border-left:4px solid #27ae60;">';
            html += '<strong>' + il + ' / ' + ilce + '</strong>';
            html += '<div style="margin-left:10px;color:#666;font-size:13px;">';
            okullar[key].forEach(function(okul) { html += '<div>• ' + okul + '</div>'; });
            html += '</div></div>';
        });
        listesi.innerHTML = html;
    });
}

// --- ADMIN PANELİ (ÖĞRETMEN) ---
function adminPaneliYukle(userData) {
    gosterGizle('auth-area',  'none');
    gosterGizle('admin-area', 'block');
    balonlariGoster(userData.okul, userData.sinif, userData.sube);
    ogrenciListele(userData.okul, userData.sinif, userData.sube);
}

// --- ÖĞRENCİ PANELİ ---
function ogrenciPaneliYukle(uid, data) {
    gosterGizle('auth-area',  'none');
    gosterGizle('user-panel', 'block');

    const welcome = document.getElementById('welcome-msg');
    if (welcome) welcome.innerText = 'Selam, ' + data.ogrenciAdSoyad + '!';

    const heightDisp = document.getElementById('display-height');
    if (heightDisp) heightDisp.innerText = data.balonYuksekligi || 0;

    balonlariGoster(data.okul, data.sinif, data.sube);
    rozetleriGoster(uid);
}

// --- ROZETLER ---
function rozetleriGoster(uid) {
    const medalyaDiv = document.getElementById('medalyalar');
    if (!medalyaDiv) return;
    db.collection('users').doc(uid).onSnapshot(function(doc) {
        const d = doc.data();
        const rozetler      = d.rozetler || [];
        const haftalikBadge = d.haftalikBadge;
        const rozetEmojileri = {
            '10gun':'🔟','20gun':'2️⃣0️⃣','30gun':'3️⃣0️⃣',
            'haftalik_1':'🥇','haftalik_2':'🥈','haftalik_3':'🥉','aferin':'⭐'
        };
        let html = '<div class="medal-shelf">';
        if (haftalikBadge && rozetEmojileri[haftalikBadge]) {
            html += '<span class="medal-icon" title="' + haftalikBadge + '">' + rozetEmojileri[haftalikBadge] + '</span>';
        }
        rozetler.forEach(function(r) {
            if (rozetEmojileri[r]) html += '<span class="medal-icon" title="' + r + '">' + rozetEmojileri[r] + '</span>';
        });
        html += '</div>';
        medalyaDiv.innerHTML = html;
    });
}

// --- İL / İLÇE / OKUL ---
window.illeriDoldur = function() {
    if (typeof ilVerisi === 'undefined') return;
    const hedefler   = ['sehir', 'yeniOkulIl'];
    const siralanmis = Object.keys(ilVerisi).sort(function(a,b){ return a.localeCompare(b,'tr'); });
    hedefler.forEach(function(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = '<option value="">İl Seçiniz</option>';
        siralanmis.forEach(function(il) {
            const opt = document.createElement('option');
            opt.value = il; opt.textContent = il;
            el.appendChild(opt);
        });
    });
};

window.ilceleriYukle = function() {
    const sehir      = document.getElementById('sehir') ? document.getElementById('sehir').value : '';
    const ilceSelect = document.getElementById('ilce');
    if (!ilceSelect) return;
    ilceSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
    if (sehir && ilVerisi[sehir]) {
        ilVerisi[sehir].forEach(function(ilce) {
            const opt = document.createElement('option');
            opt.value = ilce; opt.textContent = ilce;
            ilceSelect.appendChild(opt);
        });
    }
    const okulSelect = document.getElementById('okul');
    if (okulSelect) okulSelect.innerHTML = '<option value="">Okul Seçiniz</option>';
};

window.yeniOkulIlceleriYukle = function() {
    const sehir      = document.getElementById('yeniOkulIl') ? document.getElementById('yeniOkulIl').value : '';
    const ilceSelect = document.getElementById('yeniOkulIlce');
    if (!ilceSelect) return;
    ilceSelect.innerHTML = '<option value="">İlçe Seçiniz</option>';
    if (sehir && ilVerisi[sehir]) {
        ilVerisi[sehir].forEach(function(ilce) {
            const opt = document.createElement('option');
            opt.value = ilce; opt.textContent = ilce;
            ilceSelect.appendChild(opt);
        });
    }
};

window.okullariYukle = function() {
    const il         = document.getElementById('sehir') ? document.getElementById('sehir').value : '';
    const ilce       = document.getElementById('ilce')  ? document.getElementById('ilce').value  : '';
    const okulSelect = document.getElementById('okul');
    if (!okulSelect || !il || !ilce) return;
    db.collection('sistem').doc('okulListesi').get().then(function(doc) {
        okulSelect.innerHTML = '<option value="">Okul Seçiniz</option>';
        if (doc.exists) {
            const okullar = doc.data()[il + '_' + ilce] || [];
            okullar.sort(function(a,b){ return a.localeCompare(b,'tr'); }).forEach(function(o) {
                const opt = document.createElement('option');
                opt.value = o; opt.textContent = o;
                okulSelect.appendChild(opt);
            });
        }
    });
};

// --- OKUL EKLEME ---
window.okulEkle = function() {
    const il     = document.getElementById('yeniOkulIl')   ? document.getElementById('yeniOkulIl').value.trim()   : '';
    const ilce   = document.getElementById('yeniOkulIlce') ? document.getElementById('yeniOkulIlce').value.trim() : '';
    const okulAd = document.getElementById('yeniOkulAd')   ? document.getElementById('yeniOkulAd').value.trim()   : '';
    if (!il || !ilce || !okulAd) { alert('Lütfen il, ilçe ve okul adını eksiksiz doldurun!'); return; }
    db.collection('sistem').doc('okulListesi').set(
        { [il + '_' + ilce]: firebase.firestore.FieldValue.arrayUnion(okulAd) },
        { merge: true }
    ).then(function() {
        alert('"' + okulAd + '" başarıyla eklendi! ✅');
        document.getElementById('yeniOkulAd').value = '';
    }).catch(function(e) { alert('Hata: ' + e.message); });
};

// --- HAFTALIK SIRALAMA KONTROLÜ (giriş yapınca çalışır, sayfa girişi değil) ---
// Sadece yeni hafta başladıysa sıfırlar — sonGirisTarihi'ne dokunmaz
function haftalikSifirlamaKontrol(uid) {
    const ref = db.collection('users').doc(uid);
    ref.get().then(function(doc) {
        if (!doc.exists) return;
        const d          = doc.data();
        const bugun      = bugunuSifirla(getTurkiyeZamani());
        const buHaftaBasi = haftalikSifirla(bugun);
        const sonHaftaBasi = d.haftalikBaslangic
            ? haftalikSifirla(new Date(d.haftalikBaslangic))
            : null;
        const yeniHafta = !sonHaftaBasi || sonHaftaBasi.getTime() !== buHaftaBasi.getTime();

        if (yeniHafta) {
            ref.update({
                haftalikBaslangic: buHaftaBasi.toISOString(),
                balonYuksekligi:   0,
                haftalikSayfa:     0,
                haftalikBadge:     null
            });
        }

        // Seri rozet kontrolü
        kontorSeriRozet(uid);
    });
}

// --- SERİ ROZET ---
function kontorSeriRozet(uid) {
    db.collection('users').doc(uid).get().then(function(doc) {
        if (!doc.exists) return;
        const d      = doc.data();
        const gecmis = d.girisGecmisi || [];
        const bugun  = new Date();
        let seri = 0;
        for (let i = 0; i < 365; i++) {
            const t = new Date(bugun);
            t.setDate(bugun.getDate() - i);
            if (gecmis.includes(bugunuSifirla(t).toISOString())) { seri++; }
            else if (i > 0) { break; }
        }
        const rozetler = d.rozetler || [];
        [[10,'10gun'],[20,'20gun'],[30,'30gun']].forEach(function(h) {
            if (seri >= h[0] && !rozetler.includes(h[1])) {
                rozetler.push(h[1]);
                db.collection('users').doc(uid).update({ rozetler: rozetler });
            }
        });
    });
}

// --- HAFTALIK SIRALAMA ROZET ---
function kontorHaftaliSiralamaBadge(okul, sinif, sube) {
    db.collection('users')
        .where('okul','==',okul).where('sinif','==',sinif)
        .where('sube','==',sube).where('rol','==','ogrenci')
        .get().then(function(snapshot) {
            const liste = [];
            snapshot.forEach(function(doc) {
                liste.push({ id: doc.id, sayfa: doc.data().haftalikSayfa || 0 });
            });
            liste.sort(function(a,b){ return b.sayfa - a.sayfa; });
            const rozetler = ['haftalik_1','haftalik_2','haftalik_3'];
            snapshot.forEach(function(doc) {
                db.collection('users').doc(doc.id).update({ haftalikBadge: null });
            });
            liste.slice(0,3).forEach(function(ogr, i) {
                db.collection('users').doc(ogr.id).update({ haftalikBadge: rozetler[i] });
            });
        });
}

// --- BALONLARI ÇİZ ---
function balonlariGoster(okul, sinif, sube) {
    const containerId = IS_ADMIN_PAGE ? 'admin-balloon-container' : 'balloon-container';
    const container   = document.getElementById(containerId);
    if (!container) return;
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    db.collection('users')
        .where('okul','==',okul).where('sinif','==',sinif)
        .where('sube','==',sube).where('rol','==','ogrenci')
        .onSnapshot(function(snapshot) {
            container.innerHTML = '';
            snapshot.forEach(function(doc) {
                const s = doc.data();
                const b = document.createElement('div');
                b.className = 'balloon';
                b.style.bottom          = (20 + Math.min(s.balonYuksekligi || 0, 330)) + 'px';
                const benimBalonum      = doc.id === uid;
                b.style.left            = benimBalonum && !IS_ADMIN_PAGE ? '50%' : (Math.random() * 80 + 10) + '%';
                b.style.backgroundColor = benimBalonum && !IS_ADMIN_PAGE ? '#ff5e57' : '#3498db';
                b.style.transform       = IS_ADMIN_PAGE ? 'scale(0.7)' : 'scale(1)';
                const etiket = IS_ADMIN_PAGE
                    ? (s.ogrenciAdSoyad || 'Anonim')
                    : (benimBalonum ? 'Sen' : (s.balonEtiketi || 'Anonim'));
                b.innerHTML = '<div class="balloon-label">' + etiket + '</div>';
                container.appendChild(b);
            });
        });
}

// --- ÖĞRENCİ LİSTESİ (ADMIN) ---
function ogrenciListele(okul, sinif, sube) {
    const listArea = document.getElementById('admin-student-list');
    if (!listArea) return;
    db.collection('users')
        .where('okul','==',okul).where('sinif','==',sinif)
        .where('sube','==',sube).where('rol','==','ogrenci')
        .onSnapshot(function(snapshot) {
            listArea.innerHTML = '';
            if (snapshot.empty) {
                listArea.innerHTML = '<p style="color:#999">Bu sınıfta henüz öğrenci yok.</p>';
                return;
            }
            snapshot.forEach(function(doc) {
                const s = doc.data();
                const rozetler      = s.rozetler || [];
                const haftalikBadge = s.haftalikBadge;
                const emojiler = {
                    'haftalik_1':'🥇','haftalik_2':'🥈','haftalik_3':'🥉',
                    '10gun':'🔟','20gun':'2️⃣0️⃣','30gun':'3️⃣0️⃣','aferin':'⭐'
                };
                let rozetHtml = '';
                if (haftalikBadge && emojiler[haftalikBadge]) rozetHtml += emojiler[haftalikBadge];
                rozetler.forEach(function(r) { if (emojiler[r]) rozetHtml += emojiler[r]; });

                const btnId = 'rozet-btn-' + doc.id;
                listArea.innerHTML +=
                    '<div style="background:white;padding:10px;margin:5px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;">' +
                    '<div><b>' + s.ogrenciAdSoyad + '</b>' +
                    '<span style="color:#666;margin-left:10px;">' + (s.haftalikSayfa||0) + ' sayfa</span>' +
                    (rozetHtml ? '<span style="margin-left:8px;font-size:18px;">' + rozetHtml + '</span>' : '') +
                    '</div>' +
                    '<button id="' + btnId + '" style="background:#f39c12;padding:5px 10px;border-radius:5px;border:none;cursor:pointer;color:white;">⭐ Aferin</button>' +
                    '</div>';
                setTimeout(function() {
                    const btn = document.getElementById(btnId);
                    if (btn) btn.addEventListener('click', function() { rozetVer(doc.id); });
                }, 0);
            });
        });
}

// --- ROZET VER ---
window.rozetVer = function(ogrenciId) {
    db.collection('users').doc(ogrenciId).get().then(function(doc) {
        const rozetler = doc.data().rozetler || [];
        if (!rozetler.includes('aferin')) {
            rozetler.push('aferin');
            db.collection('users').doc(ogrenciId).update({ rozetler: rozetler })
                .then(function() { alert('Aferin rozeti verildi! ⭐'); });
        } else {
            alert('Bu öğrenci zaten aferin rozetine sahip!');
        }
    });
};

// --- SAYFA GİRİŞİ (GÜNDE 1 KEZ) ---
window.yukseklikArtir = function() {
    const el    = document.getElementById('sayfaSayisi');
    const sayfa = el ? parseInt(el.value) : 0;
    if (!sayfa || sayfa <= 0) return alert('Lütfen geçerli bir sayfa sayısı girin!');

    const user = auth.currentUser;
    if (!user) return alert('Lütfen giriş yapınız!');

    const ref = db.collection('users').doc(user.uid);

    db.runTransaction(function(transaction) {
        return transaction.get(ref).then(function(doc) {
            const d      = doc.data();
            const bugun  = bugunuSifirla(getTurkiyeZamani());

            // sonGirisTarihi null veya bugünden önceyse izin ver
            const sonGiris = d.sonGirisTarihi ? bugunuSifirla(new Date(d.sonGirisTarihi)) : null;
            if (sonGiris && sonGiris.getTime() === bugun.getTime()) {
                throw new Error('⏰ Bugün zaten sayfa girdin! Yarın tekrar deneyebilirsin.');
            }

            const yeniHaftalik = (d.haftalikSayfa  || 0) + sayfa;
            const yeniAylik    = (d.aylikSayfa      || 0) + sayfa;
            const yeni4Aylik   = (d.dort_aylikSayfa || 0) + sayfa;
            const yeniYillik   = (d.yillikSayfa     || 0) + sayfa;

            transaction.update(ref, {
                haftalikSayfa:     yeniHaftalik,
                aylikSayfa:        yeniAylik,
                dort_aylikSayfa:   yeni4Aylik,
                yillikSayfa:       yeniYillik,
                toplamOkunanSayfa: (d.toplamOkunanSayfa || 0) + sayfa,
                balonYuksekligi:   yeniHaftalik,
                sonGirisTarihi:    bugun.toISOString(),
                girisGecmisi:      firebase.firestore.FieldValue.arrayUnion(bugun.toISOString())
            });
        });
    }).then(function() {
        alert('✅ ' + sayfa + ' sayfa eklendi! Balonun yükseliyor! 🎈');
        document.getElementById('sayfaSayisi').value = '';
        kontorSeriRozet(user.uid);
        db.collection('users').doc(user.uid).get().then(function(doc) {
            const d = doc.data();
            kontorHaftaliSiralamaBadge(d.okul, d.sinif, d.sube);
            const disp = document.getElementById('display-height');
            if (disp) disp.innerText = d.balonYuksekligi || 0;
        });
    }).catch(function(e) { alert(e.message); });
};

// --- DUYURU ---
window.duyuruYayinla = function() {
    const hedef = document.getElementById('haftalikHedef');
    if (!hedef || !hedef.value) return alert('Lütfen bir hedef yazınız!');
    const user = auth.currentUser;
    db.collection('users').doc(user.uid).get().then(function(doc) {
        const d = doc.data();
        db.collection('duyurular').add({
            ogretmenId: user.uid, ogretmenAdi: d.ogrenciAdSoyad,
            okul: d.okul, sinif: d.sinif, sube: d.sube,
            mesaj: hedef.value, tarih: new Date()
        }).then(function() { alert('Duyuru yayınlandı! 📢'); hedef.value = ''; });
    });
};

// --- KAYIT ---
window.register = function() {
    const email = document.getElementById('email').value;
    const pass  = document.getElementById('password').value;
    const rol   = document.getElementById('rolSecimi').value;
    if (!email || !pass) return alert('E-posta ve şifre gerekli!');

    // Kayıt sırasında onAuthStateChanged'ı durdur
    kayitDevamEdiyor = true;

    auth.createUserWithEmailAndPassword(email, pass).then(function(res) {
        const finalRol = (rol === 'admin') ? 'ogretmen' : 'ogrenci';
        const userData = {
            ogrenciAdSoyad: document.getElementById('ogrenciAdSoyad').value,
            okul:           document.getElementById('okul').value,
            sinif:          document.getElementById('sinif').value,
            sube:           document.getElementById('sube').value,
            rol:            finalRol
        };
        if (finalRol === 'ogrenci') {
            userData.balonEtiketi      = document.getElementById('takmaAd').value || 'Anonim';
            userData.balonYuksekligi   = 0;
            userData.haftalikSayfa     = 0;
            userData.aylikSayfa        = 0;
            userData.dort_aylikSayfa   = 0;
            userData.yillikSayfa       = 0;
            userData.toplamOkunanSayfa = 0;
            userData.rozetler          = [];
            userData.haftalikBadge     = null;
            userData.girisGecmisi      = [];
            userData.sonGirisTarihi    = null;  // ilk sayfa girişinde dolar
            userData.haftalikBaslangic = haftalikSifirla(getTurkiyeZamani()).toISOString();
        }
        return db.collection('users').doc(res.user.uid).set(userData);
    }).then(function() {
        kayitDevamEdiyor = false;
        alert('Kayıt Başarılı! Şimdi giriş yapabilirsin. 🎉');
        // Kullanıcıyı çıkış yaptır ki giriş ekranına dönsün
        return auth.signOut();
    }).then(function() {
        location.reload();
    }).catch(function(e) {
        kayitDevamEdiyor = false;
        alert('Hata: ' + e.message);
    });
};

// --- GİRİŞ ---
window.showLoginForm = function() {
    gosterGizle('role-selection-area',   'none');
    gosterGizle('dynamic-register-form', 'none');
    gosterGizle('login-area',            'block');
};

window.showRegisterForm = function(rol) {
    gosterGizle('role-selection-area',    'none');
    gosterGizle('login-area',             'none');
    gosterGizle('dynamic-register-form',  'block');
    document.getElementById('rolSecimi').value = rol;
    const baslik  = document.getElementById('form-title');
    if (baslik)  baslik.innerText  = (rol === 'admin') ? 'Öğretmen Kaydı' : 'Öğrenci Kaydı';
    const takmaAd = document.getElementById('takmaAd');
    if (takmaAd) takmaAd.style.display = (rol === 'admin') ? 'none' : 'block';
    illeriDoldur();
};

window.resetRoleSelection = function() {
    gosterGizle('dynamic-register-form', 'none');
    gosterGizle('login-area',            'none');
    gosterGizle('role-selection-area',   'block');
};

window.login = function() {
    const email = document.getElementById('loginEmail').value;
    const pass  = document.getElementById('loginPassword').value;
    if (!email || !pass) return alert('E-posta ve şifre gerekli!');
    auth.signInWithEmailAndPassword(email, pass)
        .then(function() { location.reload(); })
        .catch(function(e) {
            const mesajlar = {
                'auth/user-not-found': 'Bu e-posta ile kayıtlı kullanıcı bulunamadı!',
                'auth/wrong-password': 'Şifre hatalı!',
                'auth/invalid-email':  'Geçersiz e-posta adresi!'
            };
            alert(mesajlar[e.code] || 'Giriş hatası: ' + e.message);
        });
};

window.logout = function() {
    auth.signOut().then(function() { window.location.href = 'index.html'; });
};
