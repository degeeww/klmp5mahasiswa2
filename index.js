const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 3002;
app.use(express.json()); // Middleware untuk parsing body JSON pada request POST

// --- 1. Konfigurasi Koneksi Database SQLite ---
const DB_PATH = path.join(__dirname, 'vendor_b_products.db');
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('❌ Error membuka database:', err.message);
    else {
        console.log('✅ Terhubung ke database SQLite');
        initializeDatabase(db); // Panggil fungsi inisialisasi tabel dan data
    }
});

// Fungsi untuk membuat tabel dan mengisi data awal (SEEDER)
function initializeDatabase(db) {
    db.serialize(() => {
        // Skema tabel Vendor B: CamelCase, Price INT, isAvailable BOOLEAN
        db.run(`CREATE TABLE IF NOT EXISTS products (
            sku TEXT PRIMARY KEY,
            productName TEXT NOT NULL,
            price INTEGER NOT NULL,
            isAvailable BOOLEAN
        )`);

        // Mengisi data awal (Seeder)
        const initialData = [
            ['TSHIRT-001', 'Kaos flimx', 75000, 1], // 1 = true
            ['HOODIE-005', 'Jacket Gorpcore', 185000, 1],
            ['CAP-002', 'Topi outdoor', 45000, 0] // 0 = false
        ];

        const stmt = db.prepare(`INSERT OR REPLACE INTO products VALUES (?, ?, ?, ?)`);
        initialData.forEach(data => stmt.run(data));
        stmt.finalize(() => console.log('🛒 Data awal berhasil di-seed.'));
    });
}

// --- 2. Endpoint GET (Untuk Integrator) ---
app.get('/api/v1/products', (req, res) => {
    const sql = "SELECT * FROM products";
    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({ message: "Kesalahan server saat query SQLite." });
        }
        
        // Transformasi data: Konversi 1/0 (SQLite) ke true/false (JSON Boolean)
        const products = rows.map(item => ({
            sku: item.sku,
            productName: item.productName,
            price: item.price,
            isAvailable: item.isAvailable === 1 
        }));

        // Status 200 OK
        res.status(200).json(products);
    });
});


// --- 3. Endpoint POST (Untuk Simulasi Input Data Baru) ---
app.post('/api/v1/products', (req, res) => {
    const { sku, productName, price, isAvailable } = req.body;

    if (!sku || !productName || !price) {
        return res.status(400).json({ message: "Data produk tidak lengkap." });
    }
    
    // Konversi Boolean ke Integer (true/false ke 1/0) untuk disimpan di SQLite
    const isAvailableInt = isAvailable ? 1 : 0; 

    const sql = `INSERT INTO products (sku, productName, price, isAvailable) VALUES (?, ?, ?, ?)`;
    db.run(sql, [sku, productName, price, isAvailableInt], function(err) {
        if (err) {
            // Error 500 jika ada masalah DB (misal SKU duplikat)
            return res.status(500).json({ message: `Gagal menyimpan data. Kemungkinan SKU duplikat.`, error: err.message });
        }
        // Status 201 Created
        res.status(201).json({ 
            message: "Produk berhasil ditambahkan.", 
            id: this.lastID, 
            productName: productName 
        });
    });
});


app.listen(PORT, () => {
    console.log(`Server Vendor B berjalan di: http://localhost:${PORT}`);
});