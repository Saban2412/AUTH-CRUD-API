const pool = require("./db.js");
const express = require("express");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");

//initializing and checking connection
const supabase = require("./supabaseClient.js");
console.log(
  "Supabase client initializes:",
  process.env.SUPABASE_URL ? "URL fetched" : "⚠️ URL missing!",
);

const swaggerPath = path.join(__dirname, "swagger.json");
const swaggerDocument = JSON.parse(fs.readFileSync(swaggerPath, "utf8"));

const app = express();
app.use(express.json());

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

//----------------
//  HEALTH CHECK
//----------------
app.get("/", (req, res) => {
  res.send({ name: "Task API", version: "1.0", endpoints: ["/books"] });
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
    console.log("Postgres tables initialized successfully!");

    //SEEDING DATA
    const result = await pool.query("SELECT * FROM books");
    if (result.rows.length === 0) {
      console.log("Database empty, seeding data...");

      const b1_title = "Harry Potter and the Deathly Hallows";
      const b1_author = "J.K. Rowling";
      const b1_year = 2007;

      const b2_title = "1984";
      const b2_author = "George Orwell";
      const b2_year = 1949;
      const b2_available = false;

      const b3_title = "The Hobbit";
      const b3_author = "J.R.R. Tolkien";
      const b3_year = 1937;

      const result = await pool.query(
        `
        INSERT INTO books (title, author, year_published,available) 
        VALUES 
            ($1, $2, $3,true),  
            ($4, $5, $6, $7),  
            ($8, $9, $10,true)  
        RETURNING *`,
        [
          b1_title,
          b1_author,
          b1_year,
          b2_title,
          b2_author,
          b2_year,
          b2_available,
          b3_title,
          b3_author,
          b3_year,
        ],
      );
      console.log(result.rows);
    }
  } catch (err) {
    console.error("ERROR Initializing DB: ", err);
    throw err;
  }
}
//----------------
//  GATEKEEPER
//----------------
app.use(async (req, res, next) => {
  const reqIp = req.ip;
  const reqRoute = req.originalUrl;
  try {
    await pool.query(
      `INSERT INTO api_logs (ip_address, endpoint) VALUES ($1, $2)`,
      [reqIp, reqRoute],
    );

    const result = await pool.query(
      `SELECT COUNT(*) AS total 
             FROM api_logs 
             WHERE ip_address = $1 AND timestamp >= NOW() - INTERVAL '10 seconds'`,
      [reqIp],
    );

    const totalRequests = parseInt(result.rows[0].total, 10);

    if (totalRequests > 5) {
      return res
        .status(429)
        .json({ error: "Hold on bot, know your limits!!!" });
    }

    next();
  } catch (error) {
    console.error("Error in rate limiter middleware: ", error.message);
    next();
  }
});
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
    console.error("Error fetching data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.get("/books/:id", async (req, res) => {
  const reqId = Number(req.params.id);
  try {
    const result = await pool.query("SELECT * FROM books WHERE id = $1", [
      reqId,
    ]);
    if (result.rows.length === 0) {
      return res.status(404).json(`Boook with id: ${reqId} is not found!`);
    }
    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

app.post("/books", async (req, res) => {
  const reqTitle = req.body.title;
  const reqAuthor = req.body.author;
  const reqYear =
    req.body.year_published !== undefined ? req.body.year_published : 0;
  const reqAvailable =
    req.body.available !== undefined ? req.body.available : true;

  try {
    if (
      !reqTitle ||
      reqTitle.trim() === "" ||
      !reqAuthor ||
      reqAuthor.trim() === ""
    ) {
      return res
        .status(400)
        .json({ error: "Title and Author are required fields" });
    }
    const result = await pool.query(
      `INSERT INTO books (title, author, year_published, available) VALUES ($1,$2,$3,$4) RETURNING *`,
      [reqTitle, reqAuthor, reqYear, reqAvailable],
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("Error fetching data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});
app.put("/books/:id", async (req, res) => {
  const reqId = req.params.id;
  const reqTitle = req.body.title;
  const reqAuthor = req.body.author;
  const reqYear = req.body.year_published;
  const reqAvailable = req.body.available;

  try {
    const result = await pool.query(`SELECT * FROM books WHERE id = $1`, [
      reqId,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Book with id: ${reqId} is not found!` });
    }

    const currentBook = result.rows[0];

    const finalTitle = reqTitle !== undefined ? reqTitle : currentBook.title;
    const finalAuthor =
      reqAuthor !== undefined ? reqAuthor : currentBook.author;
    const finalYear =
      reqYear !== undefined ? reqYear : currentBook.year_published;
    const finalAvailable =
      reqAvailable !== undefined ? reqAvailable : currentBook.available;

    if (
      (typeof finalTitle === "string" && finalTitle.trim() === "") ||
      (typeof finalAuthor === "string" && finalAuthor.trim() === "")
    ) {
      return res
        .status(400)
        .json({ error: "Title or Author cannot be empty!" });
    }

    const updateResult = await pool.query(
      `
            UPDATE books SET 
                title = $1, 
                author = $2, 
                year_published = $3, 
                available = $4 
            WHERE id = $5
            RETURNING *`,
      [finalTitle, finalAuthor, finalYear, finalAvailable, reqId],
    );

    res.status(200).json(updateResult.rows[0]);
  } catch (error) {
    console.error("Error updating data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});
app.delete("/books/:id", async (req, res) => {
  const reqId = Number(req.params.id);
  try {
    const result = await pool.query(`DELETE FROM books WHERE id = $1`, [reqId]);
    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ error: `Book with id: ${reqId} does not exist!` });
    }
    return res.status(204).send();
  } catch (error) {
    console.error("Error updating data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});
app.patch("/books/:id/toggle-availability", async (req, res) => {
  const reqId = req.params.id;
  try {
    const result = await pool.query(
      `
            UPDATE books
            SET available = NOT available
            WHERE id = $1
            RETURNING *`,
      [reqId],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ error: `Book with id: ${reqId} is not found!` });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Error patching data: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

//----------------
//    SIGN UP
//----------------
app.post("/auth/signup", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || email.trim() === "" || !password || password.trim() === "") {
    return res.status(400).json({ error: "Email and password are required!" });
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    if (error) {
      return res.status(400).json({ error: error.message });
    }
    res.status(201).json(data.user);
  } catch (error) {
    console.error("Error durign signup: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});
//----------------
//    LOGIN
//----------------
app.post("/auth/login", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;

  if (!email || email.trim() === "" || !password || password.trim() === "") {
    return res.status(400).json({ error: "Email and password are required!" });
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    if (error) {
      return res.status(401).json({ error: error.message });
    }
    res.status(200).json({
      user: data.user,
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
  } catch (error) {
    console.error("Error durign login: ", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

//----------------
//  MIDDLEWARE
//----------------
app.get("/public/info", (req, res) => {
  res.status(200).json({ message: "Welcome stranger! This info is public" });
});

app.get("/protected/profile", (req, res) => {
  const authHeader = req.headers["authorization"];
  try {
    if (
      !authHeader ||
      !authHeader.startsWith("Bearer ") ||
      authHeader.slice(7) === ""
    ) {
      return res.status(401).json({ error: "Access token required." });
    }
    res
      .status(200)
      .json({ message: "Token was presented (not yet verified)." });
  } catch (error) {
    console.error("Error durign fetching: ", error.message);
    res.status(500).json({ error: "Internal server error." });
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
      console.log(
        `Swagger dokumentacija dostupna na: http://localhost:${PORT}/api-docs`,
      );
    });
  } catch (error) {
    console.error("Aplikacija nije uspela da se pokrene:", error);
  }
}, 5000);
