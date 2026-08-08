// ========== المتغيرات العامة ==========
let currentUser = null;
let userRole = null;
let currentCheckoutData = null;

// ========== التنقل ==========
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const pageMap = { home: 'homePage', login: 'loginPage', register: 'registerPage', dashboard: 'dashboardPage' };
    if (pageMap[page]) document.getElementById(pageMap[page]).classList.remove('hidden');
    if (page === 'home') loadPublicPosts();
    if (page === 'dashboard' && currentUser) loadDashboard();
}

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
    try {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        const userData = { email, role, displayName: email.split('@')[0], createdAt: firebase.firestore.FieldValue.serverTimestamp() };
        if (role === 'customer') userData.address = address;
        if (role === 'investor') userData.barcodeImage = '';
        await db.collection('users').doc(cred.user.uid).set(userData);
        alert('تم إنشاء الحساب بنجاح');
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

// ---------- المستثمر ----------
async function renderInvestorDashboard(container) {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const barcode = userDoc.exists ? (userDoc.data().barcodeImage || '') : '';
    container.innerHTML = `
        <div class="card"><h3>الباركود (شام كاش)</h3><input id="barcodeInput" placeholder="رابط صورة الباركود" value="${barcode}"><button class="btn" onclick="saveBarcode()">حفظ</button></div>
        <div class="card"><h3>نشر عرض</h3><textarea id="postContent" rows="3"></textarea><button class="btn btn-success" onclick="addPost('offer')">نشر</button></div>
        <div class="card"><h3>منشوراتي</h3><div id="myPosts"></div></div>
        <div class="card"><h3>منتج جديد</h3><input id="prodTitle" placeholder="الاسم"><textarea id="prodDesc" rows="3" placeholder="وصف"></textarea><input type="number" id="prodPrice" placeholder="السعر"><input id="prodImage" placeholder="رابط الصورة"><input type="number" id="prodStock" placeholder="الكمية"><button class="btn btn-success" onclick="addProduct()">إضافة</button></div>
        <div class="card"><h3>منتجاتي</h3><div id="myProductsList"></div></div>
        <div class="card"><h3>الطلبات الواردة</h3><div id="investorOrders"></div></div>
    `;
    loadMyPosts(); loadMyProducts(); loadInvestorOrders();
}

async function saveBarcode() {
    const url = document.getElementById('barcodeInput').value.trim();
    if (!url) return alert('أدخل رابط الصورة');
    await db.collection('users').doc(currentUser.uid).update({ barcodeImage: url });
    alert('تم الحفظ');
}

// ---------- الزبون ----------
async function renderCustomerDashboard(container) {
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const address = userDoc.exists ? (userDoc.data().address || '') : '';
    container.innerHTML = `
        <div class="card"><h3>عنواني</h3><input id="addressInput" value="${address}"><button class="btn" onclick="saveAddress()">حفظ</button></div>
        <div class="card"><h3>طلب جديد</h3><textarea id="postContent" rows="3"></textarea><button class="btn btn-success" onclick="addPost('request')">نشر</button></div>
        <div class="card"><h3>منشوراتي</h3><div id="myPosts"></div></div>
        <div class="card"><h3>المنتجات</h3><div id="allProducts" class="product-grid"></div></div>
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

// ========== المنشورات (عام) ==========
async function addPost(type) {
    const content = document.getElementById('postContent').value.trim();
    if (!content) return alert('اكتب المحتوى');
    const userDoc = await db.collection('users').doc(currentUser.uid).get();
    const name = userDoc.exists ? (userDoc.data().displayName || currentUser.email) : currentUser.email;
    await db.collection('posts').add({ authorId: currentUser.uid, authorName: name, type, content, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    document.getElementById('postContent').value = '';
    loadMyPosts();
}

async function loadMyPosts() {
    const container = document.getElementById('myPosts');
    if (!container) return;
    container.innerHTML = 'جاري التحميل...';
    const snapshot = await db.collection('posts').where('authorId', '==', currentUser.uid).orderBy('createdAt', 'desc').limit(20).get();
    if (snapshot.empty) { container.innerHTML = '<p>لا منشورات.</p>'; return; }
    let html = '';
    snapshot.forEach(doc => {
        const p = doc.data();
        const date = p.createdAt ? p.createdAt.toDate().toLocaleString('ar') : '';
        html += `<div class="post-item"><div class="post-header"><span>${p.authorName}</span><span class="post-type ${p.type}">${p.type==='offer'?'عرض':'طلب'}</span><span>${date}</span></div><div class="post-body">${p.content}</div><button class="btn btn-danger" onclick="deletePost('${doc.id}')">حذف</button></div>`;
    });
    container.innerHTML = html;
}
async function deletePost(id) { if (confirm('حذف؟')) { await db.collection('posts').doc(id).delete(); loadMyPosts(); } }

// ---------- المنتجات ----------
async function addProduct() {
    const title = document.getElementById('prodTitle').value.trim();
    const desc = document.getElementById('prodDesc').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const image = document.getElementById('prodImage').value.trim();
    const stock = parseInt(document.getElementById('prodStock').value);
    if (!title || isNaN(price) || isNaN(stock)) return alert('املأ الاسم والسعر والكمية');
    await db.collection('products').add({ title, description: desc, price, imageUrl: image||'', stock, investorId: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
    alert('تمت الإضافة');
    ['prodTitle','prodDesc','prodPrice','prodImage','prodStock'].forEach(id => document.getElementById(id).value = '');
    loadMyProducts();
}
async function loadMyProducts() {
    const list = document.getElementById('myProductsList');
    if (!list) return;
    list.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('products').where('investorId', '==', currentUser.uid).orderBy('createdAt','desc').get();
    if (snap.empty) { list.innerHTML = '<p>لا منتجات.</p>'; return; }
    let html = '<div class="product-grid">';
    snap.forEach(doc => {
        const p = doc.data();
        html += `<div class="product-card"><img src="${p.imageUrl||'https://via.placeholder.com/150'}"><h4>${p.title}</h4><p>${p.description||''}</p><p>${p.price} ريال | ${p.stock} قطعة</p><button class="btn btn-danger" onclick="deleteProduct('${doc.id}')">حذف</button></div>`;
    });
    html += '</div>'; list.innerHTML = html;
}
async function deleteProduct(id) { if (confirm('حذف؟')) { await db.collection('products').doc(id).delete(); loadMyProducts(); } }
async function loadInvestorOrders() {
    const div = document.getElementById('investorOrders');
    if (!div) return;
    div.innerHTML = 'جاري التحميل...';
    // بفضل investorIds يمكننا جلب الطلبات مباشرة
    const snap = await db.collection('orders').where('investorIds', 'array-contains', currentUser.uid).orderBy('createdAt','desc').limit(30).get();
    if (snap.empty) { div.innerHTML = '<p>لا طلبات.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const order = doc.data();
        // عرض كل العناصر لأن الطلب يحتوي منتجات هذا المستثمر بالضبط
        const investorInfo = order.investorsDetails?.find(inv => inv.investorId === currentUser.uid);
        const itemsText = investorInfo ? investorInfo.items.map(i=>`${i.title} (${i.quantity})`).join(', ') : '';
        const subtotal = investorInfo ? investorInfo.subtotal : 0;
        html += `<div class="order-item"><span>#${doc.id.slice(0,6)}</span><span>${itemsText}</span><span>${subtotal} ريال</span><span>${order.status||'جديد'}</span></div>`;
    });
    div.innerHTML = html || '<p>لا طلبات.</p>';
}

// ---------- الزبون: المنتجات والسلة ----------
async function loadAllProducts() {
    const div = document.getElementById('allProducts');
    if (!div) return;
    div.innerHTML = 'جاري التحميل...';
    const snap = await db.collection('products').orderBy('createdAt','desc').get();
    if (snap.empty) { div.innerHTML='<p>لا منتجات.</p>'; return; }
    let html = '';
    snap.forEach(doc => {
        const p = doc.data();
        if (p.stock<=0) return;
        html += `<div class="product-card"><img src="${p.imageUrl||'https://via.placeholder.com/150'}"><h4>${p.title}</h4><p>${p.price} ريال</p><p>المخزون: ${p.stock}</p><button class="btn" onclick="addToCart('${doc.id}')">أضف للسلة</button></div>`;
    });
    div.innerHTML = html || '<p>لا منتجات.</p>';
}
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
        await ref.set({ productId, title: product.title, price: product.price, imageUrl: product.imageUrl||'', quantity: 1, investorId: product.investorId });
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

// ========== الدفع وفتح mailto ==========
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
        if (!item.investorId) continue;
        if (!investorMap.has(item.investorId)) {
            const investorDoc = await db.collection('users').doc(item.investorId).get();
            const invData = investorDoc.data() || {};
            investorMap.set(item.investorId, {
                items: [],
                subtotal: 0,
                email: invData.email,
                barcode: invData.barcodeImage || ''
            });
        }
        const inv = investorMap.get(item.investorId);
        inv.items.push({ title: item.title, quantity: item.quantity, price: item.price });
        inv.subtotal += item.price * item.quantity;
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
            <p>المنتجات: ${inv.items.map(i=>`${i.title} (${i.quantity})`).join('، ')} - ${inv.subtotal} ريال</p>
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

// تأكيد الطلب ثم فتح نافذة mailto
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

    const orderRef = db.collection('orders').doc();
    const orderData = {
        customerId: currentUser.uid,
        customerEmail: currentUser.email,
        address: currentCheckoutData.address,
        items: orderItems,
        total: total,
        investorIds: currentCheckoutData.investorMap.map(inv => inv.id), // الحقل المهم للقواعد
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

        // بناء رابط mailto
        const investorEmails = [...new Set(currentCheckoutData.investorMap.map(i => i.email))].join(',');
        const subject = `طلب جديد #${orderRef.id.slice(0,6)} من ${currentUser.email}`;
        let body = `تفاصيل الطلب:\n`;
        body += `العنوان: ${currentCheckoutData.address}\n`;
        body += `الزبون: ${currentUser.email}\n`;
        body += `--------------------------------\n`;
        currentCheckoutData.investorMap.forEach((inv, idx) => {
            body += `\nالمستثمر: ${inv.email}\n`;
            body += `المنتجات: ${inv.items.map(i=>`${i.title} (${i.quantity})`).join('، ')}\n`;
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

    } catch (e) {
        alert('خطأ: ' + e.message);
    }
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
