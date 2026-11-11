# Md. Fuad Naheean — Portfolio and CRUD API

A responsive Bootstrap portfolio and Express REST API for CSE309, Web
Application and Internet, at Independent University Bangladesh. Portfolio
projects and contact messages are stored in MySQL/MariaDB through XAMPP.

## Student information

- **Name:** Md. Fuad Naheean
- **Department:** Computer Science And Engineering
- **Institution:** Independent University Bangladesh
- **Course:** CSE309 — Web Application and Internet

## Requirements

- XAMPP with MySQL (or MariaDB)
- Node.js 20.11 or newer
- npm

## Set up the database in XAMPP

1. Open the XAMPP Control Panel and start **MySQL**.
   Start **Apache** as well if you want to use phpMyAdmin.
2. Visit [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/).
3. Select **Import**, choose `database/portfolio.sql`, and import it. The script
   creates the `portfolio` database and its `projects` and `contacts` tables,
   then inserts the three sample portfolio projects.
4. If your local MySQL username or password differs from the XAMPP defaults,
   update `.env`. The default local settings are `root` with an empty password.

The SQL script uses `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE`; importing
it again keeps existing records and does not drop the database.

## Start the application

This project uses **Node.js/Express**, not PHP. Apache cannot execute its
backend. Apache is used by XAMPP/phpMyAdmin; Express serves the existing
frontend and API on port `3000`. Keep the project in its current folder—moving
it under `C:\xampp\htdocs` is not required.

From the project directory, run:

```sh
npm install
npm start
```

Open [http://localhost:3000/](http://localhost:3000/). Do not open the HTML
directly with `file://` or Live Server: those URLs do not serve the Express API.
For development, run `npm run dev`. Run `npm test` for API/auth tests with an
in-memory adapter. To also exercise live database persistence, run
`npm run test:mysql` after importing the schema; it creates and removes a
uniquely named test project and contact message in the configured database.

Configuration is read from `.env`:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `127.0.0.1` | XAMPP MySQL host |
| `DB_PORT` | `3306` | MySQL port |
| `DB_USER` | `root` | MySQL username |
| `DB_PASSWORD` | empty | MySQL password |
| `DB_NAME` | `portfolio` | Database created by the import script |
| `PORT` | `3000` | Express server port |
| `DEMO_PASSWORD` | `1234` | Demo password for the project manager |
| `SESSION_SECRET` | required | Secret for signing login cookies; at least 32 characters |
| `CORS_ORIGIN` | `http://localhost:3000` | Allowed browser origin |

`.env` is local configuration and must not be shared. `.env.example` is safe to
include with the submission. Generate a session secret with:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Put its output in the local `.env` as `SESSION_SECRET=...`.

## Demo login

Select **Manage projects** and enter the value of `DEMO_PASSWORD` (default
`1234`) to open the project manager. The password is checked by Express, which
issues a signed, HTTP-only, SameSite=Strict cookie valid for eight hours;
project creation, editing, and deletion require that session. The login API is
limited to five attempts per 15 minutes. Use **Log out** to clear the session.
This shared demo password is for local coursework only, not production
authentication.

## REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/projects` | List portfolio projects |
| `GET` | `/api/projects/:id` | Read one project |
| `POST` | `/api/projects` | Create a project |
| `PUT` | `/api/projects/:id` | Update a project |
| `DELETE` | `/api/projects/:id` | Delete a project |
| `GET` | `/api/auth/status` | Check the current demo session |
| `POST` | `/api/login` | Start a demo session |
| `POST` | `/api/logout` | End the demo session |
| `GET` | `/api/health` | Check API and database connection |
| `POST` | `/api/contact` | Save a contact form message |

The **Manage projects** panel on the portfolio uses the project API to create,
read, update, and delete records. Project requests accept `title`, `category`,
`year`, `tagline`, `description`, and `theme` (`one`, `two`, or `three`). Inputs
are validated by the API, and SQL statements use bound parameters.

Project reads are public; project changes require the demo login. The contact
form accepts public submissions. Keep this classroom demo on your local
machine; do not expose it to the public internet.

## Submission contents

Include `database/portfolio.sql`, `.env.example`, `package.json`,
`package-lock.json`, the `public/` and `test/` folders, and root server/database
setup files. Do not include `node_modules/` or your local
`.env`. The old `data/portfolio.db` file is a leftover SQLite database and is
not used by the XAMPP/MySQL version.

## Local URLs

- Portfolio and REST API: [http://localhost:3000/](http://localhost:3000/)
- XAMPP/phpMyAdmin: [http://localhost/phpmyadmin/](http://localhost/phpmyadmin/)
- Apache default page: [http://localhost/](http://localhost/)

The Node app remains in the existing `C:\Users\Fuad\Desktop\Portfolio` folder.
XAMPP Apache serves its own web root at `C:\xampp\htdocs`; it does not run this
Node/Express app. Start the app separately with `npm start`.
