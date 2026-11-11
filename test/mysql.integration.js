const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
const { app } = require("../server");
const pool = require("../db");

let server;
let baseUrl;

before(async () => {
  await pool.query("SELECT 1");
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await pool.end();
});

test("XAMPP MySQL project CRUD, login, and contact form persist data", async () => {
  const suffix = `${Date.now()}-${process.pid}`;
  const title = `MySQL integration ${suffix}`;
  const email = `mysql-${suffix}@example.com`;
  let projectId;

  try {
    const [existingProjects] = await pool.query("SELECT id FROM projects LIMIT 1");
    assert.ok(existingProjects.length > 0, "Import database/portfolio.sql before this test.");

    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { status: "ok", database: "MySQL" });

    const deniedCreate = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    assert.equal(deniedCreate.status, 401);

    const login = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: process.env.DEMO_PASSWORD || "1234" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const projectInput = {
      title,
      category: "Database integration test",
      year: 2026,
      tagline: "Temporary live database test",
      description: "This row is created and cleaned up by the XAMPP MySQL integration test.",
      theme: "one",
    };

    const created = await fetch(`${baseUrl}/api/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(projectInput),
    });
    assert.equal(created.status, 201);
    const { project: createdProject } = await created.json();
    projectId = createdProject.id;
    assert.equal(createdProject.title, title);

    const updated = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ ...projectInput, tagline: "Updated integration test" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).project.tagline, "Updated integration test");

    const contact = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "MySQL Integration Test",
        email,
        message: "This temporary message verifies contact persistence.",
      }),
    });
    assert.equal(contact.status, 201);
    const [savedContact] = await pool.execute("SELECT id FROM contacts WHERE email = ?", [email]);
    assert.equal(savedContact.length, 1);

    const deleted = await fetch(`${baseUrl}/api/projects/${projectId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    });
    assert.equal(deleted.status, 204);
    projectId = undefined;
  } finally {
    if (projectId) {
      await pool.execute("DELETE FROM projects WHERE id = ?", [projectId]);
    }
    await pool.execute("DELETE FROM contacts WHERE email = ?", [email]);
  }
});
