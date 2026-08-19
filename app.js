const pool = require('./db.js');
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json'); 

const app = express();
app.use(express.json());
const PORT =3000;
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//----------------
//  HEALTH CHECK
//----------------
app.get("/",(req,res)=>{
    res.send({ "name": "Task API", "version": "1.0", "endpoints": ["/tasks"] })
})
app.get("/health",(req,res)=>{
    res.send({status: "ok"})
})
//----------------
//   DATABASE
//----------------
async function initDatabase() {
    try{
        await pool.query(`
            CREATE TABLE IF NOT EXISTS library(
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
        console.log('Postgres tables initializes successfully!');
    }catch(err){
        console.error('ERROR: ',err);
    }
}
//----------------
//    CRUD
//----------------

//----------------
//  CONNECTION
//----------------
app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});