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
        // 1. Buat Tabel jika Belum Ada
        db.run(`CREATE TABLE IF NOT EXISTS products (
            sku TEXT PRIMARY KEY,
            productName TEXT NOT NULL,
            price INTEGER NOT NULL,
            isAvailable BOOLEAN
        )`, (err) => {
            if (err) console.error('Error membuat tabel:', err.message);

            // 2. Cek apakah Tabel Kosong?
            db.get("SELECT COUNT(*) AS count FROM products", (err, row) => {
                if (err) {
                    console.error('Error cek data:', err.message);
                    return;
                }

                // 3. Hanya Isi Data (Seeder) jika Tabel masih Kosong
                if (row.count === 0) {
                    const initialData = [
                        ['TSHIRT-001', 'Kaos Ijen Crater', 75000, 1],
                    ];

                    const stmt = db.prepare(`INSERT INTO products VALUES (?, ?, ?, ?)`);
                    initialData.forEach(data => stmt.run(data));
                    stmt.finalize(() => console.log('🛒 Data awal berhasil di-seed (Tabel kosong).'));
                } else {
                    console.log(`👍 Database sudah memiliki ${row.count} record. Seeder dilewati.`);
                }
            });
        });
    });
}
// AKHIR PERUBAHAN

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

// Endpoint PUT (UPDATE) untuk mengupdate produk berdasarkan SKU
app.put('/api/v1/products/:sku', (req, res) => {
    const targetSku = req.params.sku;
    const { productName, price, isAvailable } = req.body;

    if (!productName || !price || isAvailable === undefined) {
        return res.status(400).json({ message: "Data update tidak lengkap. Diperlukan productName, price, dan isAvailable." });
    }
    
    // Konversi Boolean ke Integer (1/0)
    const isAvailableInt = isAvailable ? 1 : 0; 

    const sql = `UPDATE products SET productName = ?, price = ?, isAvailable = ? WHERE sku = ?`;
    db.run(sql, [productName, price, isAvailableInt, targetSku], function(err) {
        if (err) {
            return res.status(500).json({ message: "Gagal update data.", error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: `Produk dengan SKU ${targetSku} tidak ditemukan.` });
        }
        
        res.status(200).json({ 
            message: `Produk SKU ${targetSku} berhasil diupdate.`,
            rowsAffected: this.changes
        });
    });
});

// Endpoint DELETE untuk menghapus produk berdasarkan SKU
app.delete('/api/v1/products/:sku', (req, res) => {
    const targetSku = req.params.sku;

    const sql = `DELETE FROM products WHERE sku = ?`;
    db.run(sql, [targetSku], function(err) {
        if (err) {
            return res.status(500).json({ message: "Gagal menghapus data.", error: err.message });
        }
        
        if (this.changes === 0) {
            return res.status(404).json({ message: `Produk dengan SKU ${targetSku} tidak ditemukan.` });
        }

        res.status(200).json({ 
            message: `Produk SKU ${targetSku} berhasil dihapus.`,
            rowsAffected: this.changes
        });
    });
});