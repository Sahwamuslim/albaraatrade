// ========== المتغيرات العامة ==========
let currentUser = null;
let userRole = null;
let currentCheckoutData = null;
let currentCategory = 'all';
let selectedColor = '#ffffff';
let selectedStickerUrl = '';
let placedStickers = []; // عناصر التصميم الحالية
let customDesignPrice = 0; // سعر الكنزة المخصصة

// ========== التحقق من وجود مستثمر ==========
async function checkInvestorExists() {
    const select = document.getElementById('regRole');
    if (!select) return;
    const snapshot = await db.collection('users').where('role', '==', 'investor').limit(1).get();
    if (!snapshot.empty) {
        select.innerHTML = '<option value="customer">زبون</option>';
    } else {
        select.innerHTML = '<option value="customer">زبون</option><option value="investor">مستثمر</option>';
    }
}

// ========== التنقل ==========
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const pageMap = { home: 'homePage', login: 'loginPage', register: 'registerPage', dashboard: 'dashboardPage' };
    if (pageMap[page]) document.getElementById(pageMap[page]).classList.remove('hidden');
    if (page === 'home') loadPublicPosts();
    if (page === 'dashboard' && currentUser) loadDashboard();
    if (page === 'register') checkInvestorExists();
}

// ========== معالجة الفئات ==========
document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentCategory = btn.dataset.category;
        if (currentUser && userRole === 'customer') {
            loadAllProducts();
        } else if (currentUser && userRole === 'investor') {
            loadMyProducts();
        } else {
            alert('سجّل الدخول كزبون لتصفح المنتجات');
        }
    });
});

// ========== المصادقة ==========
auth.onAuthStateChanged(async (user) => {
    const loginLink = document.getElementById('loginLink');
    const registerLink = document.getElementById('registerLink');
    const dashboardLink = document.getElementById('dashboardLink');
    const logoutLink = document.getElementById('logoutLink');
    if (user) {
        currentUser = user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        userRole = userDoc.exists ? userDoc.data().role : 'customer';
        loginLink.classList.add('hidden');
        registerLink.classList.add('hidden');
        dashboardLink.classList.remove('hidden');
        logoutLink.classList.remove('hidden');
        navigateTo('dashboard');
    } else {
        currentUser = null; userRole = null;
        loginLink.classList.remove('hidden');
        registerLink.classList.remove('hidden');
        dashboardLink.classList.add('hidden');
        logoutLink.classList.add('hidden');
        navigateTo('home');
    }
});

// ========== المنشورات العامة ==========
async function loadPublicPosts() {
    const container = document.getElementById('publicPosts');
    if (!container) return;
    container.innerHTML = 'جاري التحميل...';
    const snapshot = await db.collection('posts').orderBy('createdAt', 'desc').limit(20).get();
    if (snapshot.empty) { container.innerHTML = '<p>لا توجد منشورات.</p>'; return; }
    let html = '';
    snapshot.forEach(doc => {
        const p = doc.data();
        const date = p.createdAt ? p.createdAt.toDate().toLocaleString('ar') : '';
        html += `<div class="post-item"><div class="post-header"><span>${p.authorName || 'مستخدم'}</span><span class="post-type ${p.type}">${p.type==='offer'?'عرض':'طلب'}</span><span>${date}</span></div><div class="post-body">${p.content}</div></div>`;
    });
    container.innerHTML = html;
}

// ========== التسجيل ==========
async function register() {
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const address = document.getElementById('regAddress').value.trim();
    const role = document.getElementById('regRole').value;
    if (!email || !password) return alert('يرجى ملء البريد وكلمة المرور');
    if (role === 'customer' && !address) return alert('يرجى إدخال العنوان للزبائن');
    if (role === 'investor') {
        const existingSnapshot = await db.collection('users').where('role', '==', 'investor').limit(1).get();
        if (!existingSnapshot.empty) {
            alert('يوجد مستثمر بالفعل في المنصة. لا يمكن إنشاء حساب مستثمر آخر.');
            return;
        }
    }
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const userData = { email, role, displayName: email.split('@')[0], createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (role === 'customer') userData.address = address;
        if (role === 'investor') userData.barcodeImage = '';
        await db.collection('users').doc(cred.user.uid).set(userData);
        alert('تم إنشاء الحساب بنجاح');
        if (role === 'investor') await checkInvestorExists();
    } catch (e) { alert('خطأ: ' + e.message); }
}

async function login() {
    const email = document.getElementById('loginEmail').value.trim();
    const pw = document.getElementById('loginPassword').value;
    if (!email || !pw) return alert('يرجى ملء جميع الحقول');
    try { await auth.signInWithEmailAndPassword(email, pw); } catch (e) { alert('خطأ: ' + e.message); }
}

function logout() { auth.signOut(); }

// ========== لوحة التحكم ==========
async function loadDashboard() {
    const content = document.getElementById('dashboardContent');
    const title = document.getElementById('dashboardTitle');
    content.innerHTML = '';
    if (userRole === 'investor') { title.innerText = 'لوحة تحكم المستثمر'; renderInvestorDashboard(content); }
    else { title.innerText = 'لوحة تحكم الزبون'; renderCustomerDashboard(content); }
}

// ========== واجهة المستثمر ==========
async function renderInvestorDashboard(container) {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const barcode = userDoc.exists ? (userDoc.data().barcodeImage || '') : '';
    container.innerHTML = `
        <div class="card"><h3>الباركود (شام كاش)</h3><input id="barcodeInput" placeholder="رابط صورة الباركود" value="${barcode}"><button class="btn" onclick="saveBarcode()">حفظ</button></div>
        <div class="card"><h3>نشر عرض</h3><textarea id="postContent" rows="3"></textarea><button class="btn btn-success" onclick="addPost('offer')">نشر</button></div>
        <div class="card"><h3>منشوراتي</h3><div id="myPosts"></div></div>
        <div class="card">
            <h3>منتج جديد</h3>
            <input id="prodTitle" placeholder="اسم المنتج">
            <textarea id="prodDesc" rows="3" placeholder="وصف"></textarea>
            <select id="prodCategory">
                <option value="accessories">اكسسوارات</option>
                <option value="clothes">ملابس</option>
                <option value="shoes">أحذية</option>
                <option value="electronics">إلكترونيات</option>
                <option value="home">أدوات منزلية</option>
                <option value="women">ألبسة نسائية</option>
                <option value="design">تصميم</option>
            </select>
            <input type="number" id="prodPrice" placeholder="السعر">
            <input type="file" id="prodImageFile" accept="image/*">
            <input type="number" id="prodStock" placeholder="الكمية">
            <button class="btn btn-success" onclick="addProduct()">إضافة</button>
        </div>
        <div class="card">
            <h3>ملصقات وأشكال التصميم</h3>
            <div id="stickerList" class="sticker-gallery"></div>
            <input type="file" id="stickerFile" accept="image/*" multiple>
            <button class="btn" onclick="uploadStickers()">رفع ملصقات</button>
        </div>
        <div class="card"><h3>منتجاتي</h3><div id="myProductsList"></div></div>
        <div class="card"><h3>الطلبات الواردة</h3><div id="investorOrders"></div></div>
    `;
    loadMyPosts(); loadMyProducts(); loadInvestorOrders(); loadStickers();
}

async function saveBarcode() {
    const url = document.getElementById('barcodeInput').value.trim();
    if (!url) return alert('أدخل رابط الصورة');
    await db.collection('users').doc(currentUser.uid).update({ barcodeImage: url });
    alert('تم الحفظ');
}

// ========== إدارة الملصقات ==========
async function uploadStickers() {
    const fileInput = document.getElementById('stickerFile');
    const files = fileInput.files;
    if (!files || files.length === 0) return alert('اختر ملفات');
    for (const file of files) {
        const storageRef = storage.ref(`stickers/${Date.now()}_${file.name}`);
        await storageRef.put(file);
        const url = await storageRef.getDownloadURL();
        await db.collection('stickers').add({
            imageUrl: url,
            investorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }
    fileInput.value = '';
    loadStickers();
}

async function loadStickers() {
    const container = document.getElementById('stickerList');
    if (!container) return;
    container.innerHTML = 'جاري تحميل الملصقات...';
    const snapshot = await db.collection('stickers').where('investorId', '==', currentUser.uid).orderBy('createdAt', 'desc').get();
    if (snapshot.empty) { container.innerHTML = '<p>لا ملصقات.</p>'; return; }
    let html = '';
    snapshot.forEach(doc => {
        const sticker = doc.data();
        html += `<div class="sticker-item"><img src="${sticker.imageUrl}" alt="ملصق" onclick="deleteSticker('${doc.id}')" title="اضغط للحذف"></div>`;
    });
    container.innerHTML = html;
}

async function deleteSticker(id) {
    if (confirm('حذف الملصق؟')) {
        await db.collection('stickers').doc(id).delete();
        loadStickers();
    }
}

// ========== المنتجات ==========
async function addProduct() {
    const title = document.getElementById('prodTitle').value.trim();
    const desc = document.getElementById('prodDesc').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const stock = parseInt(document.getElementById('prodStock').value);
    const category = document.getElementById('prodCategory').value;
    const fileInput = document.getElementById('prodImageFile');
    const file = fileInput.files[0];

    if (!title || isNaN(price) || isNaN(stock)) return alert('املأ الاسم والسعر والكمية');
    if (!file) return alert('يرجى اختيار صورة للمنتج');

    try {
        const storageRef = storage.ref(`product_images/${Date.now()}_${file.name}`);
        const uploadTask = await storageRef.put(file);
        const imageUrl = await uploadTask.ref.getDownloadURL();

        await db.collection('products').add({
            title, description: desc, price, category, imageUrl, stock,
            investorId: currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        alert('تمت الإضافة بنجاح');
        ['prodTitle','prodDesc','prodPrice','prodStock'].forEach(id => document.getElementById(id).value = '');
        fileInput.value = '';
        loadMyProducts();
    } catch (e) {
        alert('خطأ: ' + e.message);
    }
}

async function loadMyProducts() {
    const list = document.getElementById('myProductsList');
    if (!list) return;
    list.innerHTML = 'جاري التحميل...';
    let query = db.collection('products').where('investorId', '==', currentUser.uid);
    if (currentCategory !== 'all') query = query.where('category', '==', currentCategory);
    const snap = await query.orderBy('createdAt','desc').get();
    if (snap.empty) { list.innerHTML = '<p>لا منتجات.</p>'; return; }
    let html = '<div class="product-grid">';
    snap.forEach(doc => {
        const p = doc.data();
        const categoryMap = {
            accessories: 'اكسسوارات', clothes: 'ملابس', shoes: 'أحذية',
            electronics: 'إلكترونيات', home: 'أدوات منزلية', women: 'ألبسة نسائية',
            design: 'تصميم'
        };
        const categoryName = categoryMap[p.category] || 'غير مصنف';
        html += `<div class="product-card">
            <img src="${p.imageUrl}" alt="${p.title}">
            <h4>${p.title}</h4>
            <p>${p.description || ''}</p>
            <p>الفئة: ${categoryName}</p>
            <p>${p.price} ريال | ${p.stock} قطعة</p>
            <button class="btn btn-danger" onclick="deleteProduct('${doc.id}')">حذف</button>
        </div>`;
    });
    html += '</div>'; list.innerHTML = html;
}

async function deleteProduct(id) { if (confirm('حذف؟')) { await db.collection('products').doc(id).delete(); loadMyProducts(); } }

async function loadInvestorOrders() {
    const div = document.getElementById('investorOrders');
    if (!div) return;
    div.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('orders').where('investorIds', 'array-contains', currentUser.uid).orderBy('createdAt','desc').limit(30).get();
    if (snap.empty) { div.innerHTML = '<p>لا طلبات.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const order = doc.data();
        const investorInfo = order.investorsDetails?.find(inv => inv.investorId === currentUser.uid);
        const itemsText = investorInfo ? investorInfo.items.map(i=>`${i.title} (${i.quantity})`).join(', ') : '';
        const subtotal = investorInfo ? investorInfo.subtotal : 0;
        html += `<div class="order-item"><span>#${doc.id.slice(0,6)}</span><span>${itemsText}</span><span>${subtotal} ريال</span><span>${order.status||'جديد'}</span></div>`;
    });
    div.innerHTML = html || '<p>لا طلبات.</p>';
}

// ========== واجهة الزبون ==========
async function renderCustomerDashboard(container) {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const address = userDoc.exists ? (userDoc.data().address || '') : '';
    container.innerHTML = `
        <div class="card"><h3>عنواني</h3><input id="addressInput" value="${address}"><button class="btn" onclick="saveAddress()">حفظ</button></div>
        <div class="card"><h3>طلب جديد</h3><textarea id="postContent" rows="3"></textarea><button class="btn btn-success" onclick="addPost('request')">نشر</button></div>
        <div class="card"><h3>منشوراتي</h3><div id="myPosts"></div></div>
        <div class="card">
            <h3>المنتجات</h3>
            <div id="allProducts" class="product-grid"></div>
        </div>
        <div class="card"><h3>السلة</h3><div id="cartItems"></div><div id="cartTotal"></div><button class="btn btn-success" onclick="initiateCheckout()">شراء</button></div>
        <div class="card"><h3>طلباتي</h3><div id="myOrders"></div></div>
    `;
    loadMyPosts(); loadAllProducts(); loadCart(); loadMyOrders();
}

async function saveAddress() {
    const address = document.getElementById('addressInput').value.trim();
    if (!address) return alert('أدخل العنوان');
    await db.collection('users').doc(currentUser.uid).update({ address });
    alert('تم الحفظ');
}

// ========== عرض المنتجات حسب الفئة ==========
async function loadAllProducts() {
    const div = document.getElementById('allProducts');
    if (!div) return;
    div.innerHTML = 'جاري التحميل...';

    if (currentCategory === 'design') {
        // عرض واجهة التصميم
        div.innerHTML = `
            <div class="design-interface">
                <h3>تصميم كنزة مخصصة</h3>
                <div class="color-picker">
                    ${['#ffffff','#ff0000','#0000ff','#008000','#ffff00','#000000'].map(color =>
                        `<div class="color-swatch" style="background:${color}" data-color="${color}" onclick="selectColor(this)"></div>`
                    ).join('')}
                </div>
                <label>سعر الكنزة: <input type="number" id="customDesignPrice" class="custom-price-input" placeholder="السعر" min="0" value="${customDesignPrice || 0}"></label>
                <div class="shirt-preview" id="shirtPreview" style="background:${selectedColor};">
                    <!-- الملصقات ستوضع هنا -->
                </div>
                <div class="sticker-gallery" id="designStickers"></div>
                <div class="design-actions">
                    <button class="btn btn-danger" onclick="clearDesign()">مسح التصميم</button>
                    <button class="btn btn-success" onclick="addDesignToCart()">إضافة إلى السلة</button>
                </div>
            </div>
        `;
        loadDesignStickers();
        // إعادة رسم الملصقات المحفوظة
        placedStickers.forEach(sticker => {
            addStickerElement(sticker.url, sticker.x, sticker.y);
        });
        // ربط تغيير السعر
        document.getElementById('customDesignPrice').addEventListener('input', (e) => {
            customDesignPrice = parseFloat(e.target.value) || 0;
        });
        return;
    }

    let query = db.collection('products');
    if (currentCategory !== 'all') query = query.where('category', '==', currentCategory);
    const snap = await query.orderBy('createdAt','desc').get();
    if (snap.empty) { div.innerHTML='<p>لا منتجات.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const p = doc.data();
        if (p.stock<=0) return;
        const categoryMap = {
            accessories: 'اكسسوارات', clothes: 'ملابس', shoes: 'أحذية',
            electronics: 'إلكترونيات', home: 'أدوات منزلية', women: 'ألبسة نسائية',
            design: 'تصميم'
        };
        const categoryName = categoryMap[p.category] || 'غير مصنف';
        html += `<div class="product-card">
            <img src="${p.imageUrl}" alt="${p.title}">
            <h4>${p.title}</h4>
            <p>${p.price} ريال</p>
            <p>الفئة: ${categoryName}</p>
            <p>المخزون: ${p.stock}</p>
            <button class="btn" onclick="addToCart('${doc.id}')">أضف للسلة</button>
        </div>`;
    });
    div.innerHTML = html || '<p>لا منتجات.</p>';
}

// ========== نظام التصميم ==========
function selectColor(el) {
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
    el.classList.add('selected');
    selectedColor = el.dataset.color;
    document.getElementById('shirtPreview').style.backgroundColor = selectedColor;
}

function loadDesignStickers() {
    const container = document.getElementById('designStickers');
    if (!container) return;
    container.innerHTML = 'جاري تحميل الملصقات...';
    db.collection('stickers').orderBy('createdAt','desc').get().then(snapshot => {
        if (snapshot.empty) { container.innerHTML = '<p>لا ملصقات متاحة.</p>'; return; }
        let html = '';
        snapshot.forEach(doc => {
            const sticker = doc.data();
            html += `<div class="sticker-item"><img src="${sticker.imageUrl}" alt="ملصق" onclick="selectSticker('${sticker.imageUrl}')"></div>`;
        });
        container.innerHTML = html;
    });
}

function selectSticker(url) {
    selectedStickerUrl = url;
    document.querySelectorAll('.sticker-item img').forEach(img => img.style.border = 'none');
    event.target.style.border = '2px solid #8e44ad';
}

function placeSticker(event) {
    if (!selectedStickerUrl) return alert('اختر ملصقاً أولاً');
    const shirtPreview = document.getElementById('shirtPreview');
    const rect = shirtPreview.getBoundingClientRect();
    const x = event.clientX - rect.left - 25;
    const y = event.clientY - rect.top - 25;
    addStickerElement(selectedStickerUrl, x, y);
    placedStickers.push({ url: selectedStickerUrl, x, y });
}

function addStickerElement(url, x, y) {
    const shirtPreview = document.getElementById('shirtPreview');
    const img = document.createElement('img');
    img.src = url;
    img.className = 'sticker-on-shirt';
    img.style.left = x + 'px';
    img.style.top = y + 'px';
    img.draggable = true;
    // السحب والإفلات
    img.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', '');
    });
    img.addEventListener('dragend', (e) => {
        const rect = shirtPreview.getBoundingClientRect();
        img.style.left = (e.clientX - rect.left - 25) + 'px';
        img.style.top = (e.clientY - rect.top - 25) + 'px';
    });
    // تحديد الملصق عند النقر
    img.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.sticker-on-shirt').forEach(el => el.classList.remove('selected'));
        img.classList.add('selected');
    });
    shirtPreview.appendChild(img);
}

function clearDesign() {
    const shirtPreview = document.getElementById('shirtPreview');
    shirtPreview.querySelectorAll('.sticker-on-shirt').forEach(el => el.remove());
    placedStickers = [];
}

async function addDesignToCart() {
    if (placedStickers.length === 0) return alert('أضف ملصقاً واحداً على الأقل');
    if (customDesignPrice <= 0) return alert('أدخل سعر الكنزة');

    const shirtPreview = document.getElementById('shirtPreview');
    const canvas = await html2canvas(shirtPreview, { backgroundColor: selectedColor });
    const imageDataUrl = canvas.toDataURL('image/png');

    const storageRef = storage.ref(`designs/${Date.now()}_customer_design.png`);
    const uploadTask = await storageRef.putString(imageDataUrl, 'data_url');
    const designImageUrl = await uploadTask.ref.getDownloadURL();

    // إضافة إلى السلة
    const cartRef = db.collection('users').doc(currentUser.uid).collection('cart').doc('custom_design');
    await cartRef.set({
        productId: 'custom_design',
        title: 'كنزة مخصصة (تصميم خاص)',
        price: customDesignPrice,
        imageUrl: designImageUrl,
        quantity: 1,
        investorId: null, // سيتم تعيينه عند الخروج
        category: 'design',
        isCustomDesign: true
    });
    alert('تمت إضافة التصميم إلى السلة');
    loadCart();
}

// ========== السلة والشراء ==========
async function addToCart(productId) {
    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) return;
    const product = productDoc.data();
    if (product.stock<=0) return alert('غير متوفر');
    const ref = db.collection('users').doc(currentUser.uid).collection('cart').doc(productId);
    const item = await ref.get();
    if (item.exists) {
        if (item.data().quantity < product.stock) await ref.update({ quantity: item.data().quantity+1 });
        else alert('الكمية غير متوفرة');
    } else {
        await ref.set({ productId, title: product.title, price: product.price, imageUrl: product.imageUrl, quantity: 1, investorId: product.investorId, category: product.category });
    }
    loadCart();
}

async function loadCart() {
    const cartDiv = document.getElementById('cartItems'), totalDiv = document.getElementById('cartTotal');
    if (!cartDiv) return;
    cartDiv.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('users').doc(currentUser.uid).collection('cart').get();
    if (snap.empty) { cartDiv.innerHTML='<p>السلة فارغة</p>'; totalDiv.innerHTML=''; return; }
    let total=0, html='';
    snap.forEach(doc => {
        const item = doc.data(); total += item.price*item.quantity;
        html += `<div class="cart-item"><span>${item.title} (${item.quantity})</span><span>${item.price*item.quantity} ريال</span><button class="btn btn-danger" onclick="removeFromCart('${doc.id}')">إزالة</button></div>`;
    });
    cartDiv.innerHTML = html; totalDiv.innerHTML = `<strong>الإجمالي: ${total} ريال</strong>`;
}
async function removeFromCart(id) { await db.collection('users').doc(currentUser.uid).collection('cart').doc(id).delete(); loadCart(); }

// ========== الدفع ==========
async function initiateCheckout() {
    if (!currentUser) return;
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const address = userDoc.data()?.address;
    if (!address) return alert('يرجى حفظ عنوانك أولاً من بيانات الحساب');
    const cartSnapshot = await db.collection('users').doc(currentUser.uid).collection('cart').get();
    if (cartSnapshot.empty) return alert('السلة فارغة');

    const investorMap = new Map();
    for (const doc of cartSnapshot.docs) {
        const item = doc.data();
        if (item.isCustomDesign) {
            // التصميم المخصص يذهب للمستثمر الوحيد
            const investorSnapshot = await db.collection('users').where('role', '==', 'investor').limit(1).get();
            if (!investorSnapshot.empty) {
                const invData = investorSnapshot.docs[0].data();
                const invId = investorSnapshot.docs[0].id;
                if (!investorMap.has(invId)) {
                    investorMap.set(invId, { items: [], subtotal: 0, email: invData.email, barcode: invData.barcodeImage || '' });
                }
                const inv = investorMap.get(invId);
                inv.items.push({ title: item.title, quantity: 1, price: item.price, designImage: item.imageUrl });
                inv.subtotal += item.price;
            }
        } else if (item.investorId) {
            if (!investorMap.has(item.investorId)) {
                const investorDoc = await db.collection('users').doc(item.investorId).get();
                const invData = investorDoc.data() || {};
                investorMap.set(item.investorId, { items: [], subtotal: 0, email: invData.email, barcode: invData.barcodeImage || '' });
            }
            const inv = investorMap.get(item.investorId);
            inv.items.push({ title: item.title, quantity: item.quantity, price: item.price });
            inv.subtotal += item.price * item.quantity;
        }
    }

    currentCheckoutData = {
        address,
        investorMap: Array.from(investorMap.entries()).map(([id, data]) => ({ id, ...data })),
        total: Array.from(investorMap.values()).reduce((sum, inv) => sum + inv.subtotal, 0),
        cartSnapshot
    };

    let modalHtml = `<p><strong>العنوان:</strong> ${address}</p>`;
    currentCheckoutData.investorMap.forEach((inv, index) => {
        modalHtml += `<div class="payment-method">
            <p><strong>المستثمر:</strong> ${inv.email}</p>
            <p>المنتجات: ${inv.items.map(i=>{
                if (i.designImage) return `${i.title} (مع تصميم مخصص: <a href="${i.designImage}" target="_blank">عرض</a>)`;
                return `${i.title} (${i.quantity})`;
            }).join('، ')} - ${inv.subtotal} ريال</p>
            <label><input type="radio" name="pay_${index}" value="sham" checked> شام كاش</label>
            <label style="margin-right:15px;"><input type="radio" name="pay_${index}" value="cash"> دفع عند الاستلام</label>`;
        if (inv.barcode) {
            modalHtml += `<div class="barcode-box" id="barcode_${index}"><img src="${inv.barcode}" class="barcode-img" alt="باركود"></div>`;
        }
        modalHtml += `</div>`;
    });
    document.getElementById('paymentDetails').innerHTML = modalHtml;
    document.getElementById('paymentModal').classList.remove('hidden');

    currentCheckoutData.investorMap.forEach((_, index) => {
        const radios = document.getElementsByName(`pay_${index}`);
        radios.forEach(r => r.addEventListener('change', () => {
            const box = document.getElementById(`barcode_${index}`);
            if (box) box.style.display = r.value === 'sham' ? 'block' : 'none';
        }));
    });
}

function closePaymentModal() { document.getElementById('paymentModal').classList.add('hidden'); }

document.getElementById('confirmPaymentBtn').addEventListener('click', async () => {
    if (!currentCheckoutData) return;
    const paymentMethods = [];
    currentCheckoutData.investorMap.forEach((inv, index) => {
        const sel = document.querySelector(`input[name="pay_${index}"]:checked`);
        paymentMethods.push(sel ? sel.value : 'cash');
    });
    const batch = db.batch();
    const orderItems = [];
    let total = 0;

    for (const doc of currentCheckoutData.cartSnapshot.docs) {
        const item = doc.data();
        if (item.isCustomDesign) {
            orderItems.push({ productId: 'custom_design', title: item.title, price: item.price, quantity: 1, designImage: item.imageUrl });
            total += item.price;
            batch.delete(doc.ref);
        } else {
            const productRef = db.collection('products').doc(item.productId);
            const productDoc = await productRef.get();
            if (!productDoc.exists || productDoc.data().stock < item.quantity) {
                alert(`المنتج ${item.title} غير متوفر`);
                return;
            }
            batch.update(productRef, { stock: productDoc.data().stock - item.quantity });
            orderItems.push({ productId: item.productId, title: item.title, price: item.price, quantity: item.quantity });
            total += item.price * item.quantity;
            batch.delete(doc.ref);
        }
    }

    const orderRef = db.collection('orders').doc();
    const orderData = {
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        address: currentCheckoutData.address,
        items: orderItems,
        total: total,
        investorIds: currentCheckoutData.investorMap.map(inv => inv.id),
        investorsDetails: currentCheckoutData.investorMap.map((inv, idx) => ({
            investorId: inv.id,
            email: inv.email,
            items: inv.items,
            subtotal: inv.subtotal,
            paymentMethod: paymentMethods[idx]
        })),
        status: 'قيد التجهيز',
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    batch.set(orderRef, orderData);
    try {
        await batch.commit();
        closePaymentModal();
        const investorEmails = [...new Set(currentCheckoutData.investorMap.map(i => i.email))].join(',');
        const subject = `طلب جديد #${orderRef.id.slice(0,6)} من ${currentUser.email}`;
        let body = `تفاصيل الطلب:\n`;
        body += `العنوان: ${currentCheckoutData.address}\n`;
        body += `الزبون: ${currentUser.email}\n`;
        body += `--------------------------------\n`;
        currentCheckoutData.investorMap.forEach((inv, idx) => {
            body += `\nالمستثمر: ${inv.email}\n`;
            body += `المنتجات: ${inv.items.map(i=>{
                if (i.designImage) return `${i.title} (مع تصميم مخصص: ${i.designImage})`;
                return `${i.title} (${i.quantity})`;
            }).join('، ')}\n`;
            body += `المجموع: ${inv.subtotal} ريال\n`;
            body += `طريقة الدفع: ${paymentMethods[idx] === 'sham' ? 'شام كاش' : 'دفع عند الاستلام'}\n`;
        });
        body += `\nرقم الطلب: ${orderRef.id.slice(0,6)}`;
        const mailtoLink = `mailto:${investorEmails}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        document.getElementById('openMailBtn').onclick = () => {
            window.open(mailtoLink, '_blank');
            closeEmailModal();
        };
        document.getElementById('emailModal').classList.remove('hidden');
        loadCart(); loadMyOrders(); loadAllProducts();
    } catch (e) { alert('خطأ: ' + e.message); }
});

function closeEmailModal() { document.getElementById('emailModal').classList.add('hidden'); }

async function loadMyOrders() {
    const div = document.getElementById('myOrders');
    if (!div) return;
    div.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('orders').where('customerId','==',currentUser.uid).orderBy('createdAt','desc').limit(20).get();
    if (snap.empty) { div.innerHTML='<p>لا طلبات.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const o = doc.data();
        html += `<div class="order-item"><span>#${doc.id.slice(0,6)}</span><span>${o.items.map(i=>i.title).join(', ')}</span><span>${o.total} ريال</span><span>${o.status}</span></div>`;
    });
    div.innerHTML = html;
}
