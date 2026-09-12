// รายการข้าวสารในร้าน (แก้ไขชื่อและราคาได้ที่นี่)
const products = [
    { id: 1, name: "ข้าวหอมมะลิ (1 กก.)", price: 45 },
    { id: 2, name: "ข้าวเหนียว กข6 (1 กก.)", price: 35 },
    { id: 3, name: "ข้าวเสาไห้ (1 กก.)", price: 25 },
    { id: 4, name: "ปลายข้าวหอมมะลิ (1 กก.)", price: 20 },
    { id: 5, name: "ข้าวกล้อง (1 กก.)", price: 50 },
    { id: 6, name: "ข้าวไรซ์เบอร์รี่ (1 กก.)", price: 60 }
];

let cart = []; // ตะกร้าสินค้า

// ฟังก์ชันสร้างปุ่มสินค้าบนหน้าจอ
function renderProducts() {
    const productList = document.getElementById('product-list');
    products.forEach(product => {
        const div = document.createElement('div');
        div.className = 'product-card';
        div.innerHTML = `
            <h3 style="margin: 0 0 10px 0;">${product.name}</h3>
            <p style="margin: 0 0 10px 0; color: #666;">${product.price} บาท</p>
            <button onclick="addToCart(${product.id})">เพิ่มลงบิล</button>
        `;
        productList.appendChild(div);
    });
}

// ฟังก์ชันเพิ่มสินค้าลงตะกร้า
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    cart.push(product);
    renderCart();
}

// ฟังก์ชันอัปเดตหน้าจอบิล
function renderCart() {
    const cartList = document.getElementById('cart-list');
    const totalPrice = document.getElementById('total-price');
    cartList.innerHTML = '';
    let total = 0;

    cart.forEach((item, index) => {
        total += item.price;
        cartList.innerHTML += `<li><span>${item.name}</span> <span>${item.price} ฿</span></li>`;
    });
    totalPrice.innerText = total.toLocaleString();
}

// ฟังก์ชันกดชำระเงิน
function checkout() {
    if(cart.length === 0) {
        alert("ยังไม่มีรายการสินค้าในบิลครับ");
        return;
    }
    const total = document.getElementById('total-price').innerText;
    alert(`ชำระเงินเรียบร้อยแล้ว!\nยอดรวมทั้งสิ้น ${total} บาท`);
    cart = []; // ล้างตะกร้าหลังจ่ายเงิน
    renderCart();
}

// สั่งให้ระบบทำงานเมื่อเปิดเว็บ
renderProducts();