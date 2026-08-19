const pool = require('./db.js');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const fs = require('fs'); 
const path = require('path');

const swaggerPath = path.join(__dirname, 'swagger.json');
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));

const app = express();
app.use(express.json());

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));


//----------------
//  HEALTH CHECK
//----------------
app.get("/", (req, res) => {
    res.send({ "name": "Task API", "version": "1.0", "endpoints": ["/books"] });
});

app.get("/health", (req, res) => {
    res.send({ status: "ok" });
});

//----------------
//   DATABASE
//----------------
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS books(
                id SERIAL PRIMARY KEY,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                year_published INTEGER,
                available BOOLEAN DEFAULT true
            );
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS api_logs(
                id SERIAL PRIMARY KEY,
                ip_address TEXT,
                endpoint TEXT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log('Postgres tables initialized successfully!');
    } catch (err) {
        console.error('ERROR Initializing DB: ', err);
        throw err; 
    }
}

//----------------
//    CRUD
//----------------
app.get("/books", async (req, res) => {
    try {
        const results = await pool.query("SELECT * FROM books"); 
        if (results.rows.length === 0) {
            return res.json([]);
        }
        return res.json(results.rows);
    } catch (error) {
        console.error('Error fetching books: ', error.message);
        res.status(500).json({ error: "Greška na serveru pri dobavljanju knjiga." });
    }
});

//----------------
//  DELAY & START
//----------------
console.log("Čekam 5 sekundi da se Postgres podigne...");

setTimeout(async () => {
    try {
        await initDatabase();
        
        // Čitamo PORT iz .env fajla (koji kontroliše Docker Compose), a ako ga nema koristimo 3000
        const PORT = process.env.PORT || 3000;
        
        app.listen(PORT, () => {
            console.log(`Server uspešno radi unutar Dockera na portu: ${PORT}`);
            console.log(`Swagger dokumentacija dostupna na: http://localhost:${PORT}/api-docs`);
        });
    } catch (error) {
        console.error("Aplikacija nije uspela da se pokrene:", error);
    }
}, 5000); 
