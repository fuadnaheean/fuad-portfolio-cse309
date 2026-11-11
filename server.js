require("dotenv").config();

const path = require("node:path");
const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit").rateLimit;
const { createHmac, timingSafeEqual } = require("node:crypto");
const pool = require("./db");

const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.join(__dirname, "public");
const sessionCookieName = "portfolio_session";
const sessionDurationSeconds = 8 * 60 * 60;
const sessionSecret = process.env.SESSION_SECRET || "";
const allowedOrigins = (process.env.CORS_ORIGIN || `http://localhost:${port}`)
  .split(",")
  .map((origin) => origin.trim());
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ error: "Too many login attempts. Please wait 15 minutes and try again." });
  },
});

function signSession(expiration) {
  return createHmac("sha256", sessionSecret).update(String(expiration)).digest("hex");
}

function isAuthenticated(req) {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`));

  if (!cookie) {
    return false;
  }

  const token = cookie.slice(sessionCookieName.length + 1);
  const separator = token.indexOf(".");
  if (separator < 1) {
    return false;
  }

  const expiration = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  if (!/^\d+$/.test(expiration) || Number(expiration) <= Date.now()) {
    return false;
  }

  const expected = Buffer.from(signSession(expiration), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function requireAuthentication(req, res, next) {
  if (!isAuthenticated(req)) {
    return res.status(401).json({ error: "Please log in to manage projects." });
  }

  return next();
}

function secureStringEquals(value, expected) {
  const received = Buffer.from(value);
  const target = Buffer.from(expected);
  return received.length === target.length && timingSafeEqual(received, target);
}

function createApp(database = pool) {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors({ origin: allowedOrigins }));
  app.use(express.json({ limit: "10kb" }));

  function validateProject(input) {
    const { title, category, year, tagline, description, theme } = input ?? {};
    const project = {
      title: typeof title === "string" ? title.trim() : "",
      category: typeof category === "string" ? category.trim() : "",
      year: Number(year),
      tagline: typeof tagline === "string" ? tagline.trim() : "",
      description: typeof description === "string" ? description.trim() : "",
      theme: typeof theme === "string" ? theme : "",
    };
    const errors = [];

    if (project.title.length < 1 || project.title.length > 100) {
      errors.push("Title must be between 1 and 100 characters.");
    }
    if (project.category.length < 1 || project.category.length > 100) {
      errors.push("Category must be between 1 and 100 characters.");
    }
    if (!Number.isInteger(project.year) || project.year < 2000 || project.year > 2100) {
      errors.push("Year must be a whole number between 2000 and 2100.");
    }
    if (project.tagline.length < 1 || project.tagline.length > 120) {
      errors.push("Tagline must be between 1 and 120 characters.");
    }
    if (project.description.length < 1 || project.description.length > 1000) {
      errors.push("Description must be between 1 and 1000 characters.");
    }
    if (!["one", "two", "three"].includes(project.theme)) {
      errors.push("Choose one of the available project themes.");
    }

    return { project, errors };
  }

  function parseId(value) {
    if (!/^[1-9]\d*$/.test(value)) {
      return null;
    }

    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
  }

  app.get("/api/auth/status", (req, res) => {
    res.json({ authenticated: isAuthenticated(req) });
  });

  app.post("/api/login", loginRateLimit, (req, res) => {
    const { password } = req.body ?? {};
    const expectedPassword = process.env.DEMO_PASSWORD || "1234";

    if (typeof password !== "string" || !secureStringEquals(password, expectedPassword)) {
      return res.status(401).json({ error: "Incorrect password. Please try again." });
    }

    const expiration = String(Date.now() + sessionDurationSeconds * 1000);
    const token = `${expiration}.${signSession(expiration)}`;
    const secureAttribute = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `${sessionCookieName}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDurationSeconds}${secureAttribute}`,
    );
    res.setHeader("Cache-Control", "no-store");
    return res.json({ authenticated: true });
  });

  app.post("/api/logout", (_req, res) => {
    const secureAttribute = process.env.NODE_ENV === "production" ? "; Secure" : "";
    res.setHeader(
      "Set-Cookie",
      `${sessionCookieName}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureAttribute}`,
    );
    return res.json({ authenticated: false });
  });

  app.get("/api/health", async (_req, res, next) => {
    try {
      await database.query("SELECT 1");
      return res.json({ status: "ok", database: "MySQL" });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/projects", async (_req, res, next) => {
    try {
      const [projects] = await database.execute("SELECT * FROM projects ORDER BY id DESC");
      return res.json({ projects });
    } catch (error) {
      return next(error);
    }
  });

  app.get("/api/projects/:id", async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Project ID must be a positive integer." });
    }

    try {
      const [projects] = await database.execute("SELECT * FROM projects WHERE id = ?", [id]);
      if (projects.length === 0) {
        return res.status(404).json({ error: "Project not found." });
      }

      return res.json({ project: projects[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/projects", requireAuthentication, async (req, res, next) => {
    const { project, errors } = validateProject(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" ") });
    }

    try {
      const [result] = await database.execute(
        `INSERT INTO projects (title, category, \`year\`, tagline, description, theme)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          project.title,
          project.category,
          project.year,
          project.tagline,
          project.description,
          project.theme,
        ],
      );
      const [projects] = await database.execute("SELECT * FROM projects WHERE id = ?", [
        result.insertId,
      ]);

      return res.status(201).json({ project: projects[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.put("/api/projects/:id", requireAuthentication, async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Project ID must be a positive integer." });
    }

    const { project, errors } = validateProject(req.body);
    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join(" ") });
    }

    try {
      const [result] = await database.execute(
        `UPDATE projects
         SET title = ?,
             category = ?,
             \`year\` = ?,
             tagline = ?,
             description = ?,
             theme = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [
          project.title,
          project.category,
          project.year,
          project.tagline,
          project.description,
          project.theme,
          id,
        ],
      );

      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Project not found." });
      }

      const [projects] = await database.execute("SELECT * FROM projects WHERE id = ?", [id]);
      return res.json({ project: projects[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/api/projects/:id", requireAuthentication, async (req, res, next) => {
    const id = parseId(req.params.id);
    if (id === null) {
      return res.status(400).json({ error: "Project ID must be a positive integer." });
    }

    try {
      const [result] = await database.execute("DELETE FROM projects WHERE id = ?", [id]);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: "Project not found." });
      }

      return res.status(204).end();
    } catch (error) {
      return next(error);
    }
  });

  app.post("/api/contact", async (req, res, next) => {
    const { name, email, message } = req.body ?? {};
    const cleanName = typeof name === "string" ? name.trim() : "";
    const cleanEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const cleanMessage = typeof message === "string" ? message.trim() : "";

    if (
      cleanName.length < 1 ||
      cleanName.length > 100 ||
      cleanEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) ||
      cleanMessage.length < 10 ||
      cleanMessage.length > 5000
    ) {
      return res.status(400).json({
        error: "Enter a valid name, email address, and message (10–5000 characters).",
      });
    }

    try {
      await database.execute(
        "INSERT INTO contacts (name, email, message) VALUES (?, ?, ?)",
        [cleanName, cleanEmail, cleanMessage],
      );

      return res.status(201).json({ message: "Thanks — your message has been sent." });
    } catch (error) {
      return next(error);
    }
  });

  app.use(express.static(publicDirectory));

  app.use((req, res) => {
    res.status(404).json({ error: "Not found." });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);

    if (error.type === "entity.parse.failed") {
      return res.status(400).json({ error: "Request body must contain valid JSON." });
    }
    if (error.status === 413) {
      return res.status(413).json({ error: "Request body is too large." });
    }
    if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      return res.status(503).json({
        error: "Database unavailable. Start XAMPP MySQL and import database/portfolio.sql.",
      });
    }

    return res.status(500).json({ error: "An unexpected server error occurred." });
  });

  return app;
}

const app = createApp();

async function startServer() {
  if (Buffer.byteLength(sessionSecret) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 characters. Generate one with the command in README.md.");
  }

  const server = app.listen(port, () => {
    console.log(`Portfolio server listening at http://localhost:${port}`);
    pool.query("SELECT 1")
      .then(() => {
        console.log(`Connected to MySQL database "${process.env.DB_NAME || "portfolio"}".`);
      })
      .catch((error) => {
        console.error(
          "MySQL is unavailable. Start XAMPP MySQL and import database/portfolio.sql:",
          error.message,
        );
      });
  });

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.once(signal, () => {
      server.close(() => {
        pool.end().then(() => process.exit(0)).catch((error) => {
          console.error("Could not close the MySQL connection pool:", error);
          process.exitCode = 1;
        });
      });
    });
  }
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Could not connect to MySQL. Start XAMPP MySQL and import database/portfolio.sql.", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, createApp };
