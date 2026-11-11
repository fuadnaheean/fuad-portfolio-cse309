const assert = require("node:assert/strict");
const { after, before, test } = require("node:test");
process.env.SESSION_SECRET = "test-session-secret-with-at-least-32-characters";
const { createApp } = require("../server");
process.env.DEMO_PASSWORD = "1234";

function createMemoryDatabase() {
  let nextProjectId = 4;
  const projects = [
    {
      id: 1,
      title: "Verdant",
      category: "Digital experience · Lifestyle",
      year: 2025,
      tagline: "Grow at your own pace",
      description: "A calm digital experience for everyday life.",
      theme: "one",
    },
    {
      id: 2,
      title: "Northstar",
      category: "Brand & web · Travel",
      year: 2025,
      tagline: "A map for the curious",
      description: "A travel concept for curious people.",
      theme: "two",
    },
    {
      id: 3,
      title: "Common Ground",
      category: "Community platform · Social good",
      year: 2026,
      tagline: "Made for the neighborhood",
      description: "A platform for a more connected neighborhood.",
      theme: "three",
    },
  ];
  const contacts = [];

  return {
    projects,
    contacts,
    async query(sql) {
      assert.match(sql, /SELECT 1/);
      return [[{ 1: 1 }], []];
    },
    async execute(sql, values = []) {
      const statement = sql.replace(/\s+/g, " ").trim().toLowerCase();

      if (statement === "select * from projects order by id desc") {
        return [[...projects].sort((a, b) => b.id - a.id), []];
      }

      if (statement === "select * from projects where id = ?") {
        return [projects.filter((project) => project.id === values[0]), []];
      }

      if (statement.startsWith("insert into projects")) {
        const [title, category, year, tagline, description, theme] = values;
        const project = {
          id: nextProjectId++,
          title,
          category,
          year,
          tagline,
          description,
          theme,
        };
        projects.push(project);
        return [{ insertId: project.id, affectedRows: 1 }, []];
      }

      if (statement.startsWith("update projects")) {
        const [title, category, year, tagline, description, theme, id] = values;
        const project = projects.find((entry) => entry.id === id);
        if (!project) {
          return [{ affectedRows: 0 }, []];
        }
        Object.assign(project, { title, category, year, tagline, description, theme });
        return [{ affectedRows: 1 }, []];
      }

      if (statement.startsWith("delete from projects")) {
        const index = projects.findIndex((project) => project.id === values[0]);
        if (index === -1) {
          return [{ affectedRows: 0 }, []];
        }
        projects.splice(index, 1);
        return [{ affectedRows: 1 }, []];
      }

      if (statement.startsWith("insert into contacts")) {
        const [name, email, message] = values;
        contacts.push({ name, email, message });
        return [{ insertId: contacts.length, affectedRows: 1 }, []];
      }

      throw new Error(`Unexpected SQL in API test: ${sql}`);
    },
  };
}

const database = createMemoryDatabase();
const app = createApp(database);
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("project CRUD, validation, contact form, and student profile work", async () => {
  const healthResponse = await fetch(`${baseUrl}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.deepEqual(await healthResponse.json(), { status: "ok", database: "MySQL" });

  const listResponse = await fetch(`${baseUrl}/api/projects`);
  assert.equal(listResponse.status, 200);
  assert.equal((await listResponse.json()).projects.length, 3);

  const initialAuthResponse = await fetch(`${baseUrl}/api/auth/status`);
  assert.deepEqual(await initialAuthResponse.json(), { authenticated: false });

  const newProject = {
    title: "Test Project",
    category: "Web · Testing",
    year: 2026,
    tagline: "A test that survives a reload",
    description: "An integration-test project used to verify create, read, update, and delete.",
    theme: "one",
  };

  const deniedCreateResponse = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(newProject),
  });
  assert.equal(deniedCreateResponse.status, 401);

  const wrongLoginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "wrong" }),
  });
  assert.equal(wrongLoginResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "1234" }),
  });
  assert.equal(loginResponse.status, 200);
  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  assert.match(loginResponse.headers.get("set-cookie"), /HttpOnly/);
  assert.match(loginResponse.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal(loginResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    await (await fetch(`${baseUrl}/api/auth/status`, { headers: { Cookie: cookie } })).json(),
    { authenticated: true },
  );
  const forgedCookie = `${cookie.slice(0, -1)}${cookie.endsWith("0") ? "1" : "0"}`;
  assert.deepEqual(
    await (await fetch(`${baseUrl}/api/auth/status`, { headers: { Cookie: forgedCookie } })).json(),
    { authenticated: false },
  );

  const createResponse = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(newProject),
  });
  assert.equal(createResponse.status, 201);
  const { project: createdProject } = await createResponse.json();
  assert.equal(createdProject.title, newProject.title);
  assert.ok(createdProject.id);

  const readResponse = await fetch(`${baseUrl}/api/projects/${createdProject.id}`);
  assert.equal(readResponse.status, 200);
  assert.equal((await readResponse.json()).project.tagline, newProject.tagline);

  const updatedProject = { ...newProject, title: "Updated Test Project" };
  const updateResponse = await fetch(`${baseUrl}/api/projects/${createdProject.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(updatedProject),
  });
  assert.equal(updateResponse.status, 200);
  assert.equal((await updateResponse.json()).project.title, updatedProject.title);

  const invalidResponse = await fetch(`${baseUrl}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ ...newProject, year: 1800 }),
  });
  assert.equal(invalidResponse.status, 400);

  const deleteResponse = await fetch(`${baseUrl}/api/projects/${createdProject.id}`, {
    method: "DELETE",
    headers: { Cookie: cookie },
  });
  assert.equal(deleteResponse.status, 204);

  const missingResponse = await fetch(`${baseUrl}/api/projects/${createdProject.id}`);
  assert.equal(missingResponse.status, 404);

  const logoutResponse = await fetch(`${baseUrl}/api/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logoutResponse.status, 200);
  const clearedCookie = logoutResponse.headers.get("set-cookie").split(";")[0];
  const loggedOutMutation = await fetch(`${baseUrl}/api/projects/1`, {
    method: "DELETE",
    headers: { Cookie: clearedCookie },
  });
  assert.equal(loggedOutMutation.status, 401);

  const contactResponse = await fetch(`${baseUrl}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: "test@example.com",
      message: "This is a test contact message.",
    }),
  });
  assert.equal(contactResponse.status, 201);
  assert.deepEqual(database.contacts, [{
    name: "Test User",
    email: "test@example.com",
    message: "This is a test contact message.",
  }]);

  const throttledLoginResults = [];
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "wrong" }),
    });
    throttledLoginResults.push(response.status);
  }
  assert.deepEqual(throttledLoginResults, [401, 401, 401, 429]);

  const frontendResponse = await fetch(`${baseUrl}/`);
  assert.equal(frontendResponse.status, 200);
  const page = await frontendResponse.text();
  assert.match(page, /id="projectForm"/);
  assert.match(page, /Md\. Fuad Naheean/);
  assert.match(page, /CSE309 · Web Application and Internet/);
});
