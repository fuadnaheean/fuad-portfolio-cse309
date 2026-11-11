document.addEventListener("DOMContentLoaded", () => {
  const navigation = document.querySelector("#mainNavigation");
  const navLinks = document.querySelectorAll("#mainNavigation .nav-link, #mainNavigation .nav-cta");
  const projectGrid = document.querySelector("#projectGrid");
  const projectStatus = document.querySelector("#projectStatus");
  const projectManager = document.querySelector("#projectManager");
  const toggleProjectManager = document.querySelector("#toggleProjectManager");
  const projectLogin = document.querySelector("#projectLogin");
  const loginStatus = document.querySelector("#loginStatus");
  const loginForm = document.querySelector("#projectLogin");
  const projectAdmin = document.querySelector("#projectAdmin");
  const logoutButton = document.querySelector("#logoutButton");
  const projectForm = document.querySelector("#projectForm");
  const projectFormStatus = document.querySelector("#projectFormStatus");
  const projectRecordList = document.querySelector("#projectRecordList");
  const saveProjectButton = document.querySelector("#saveProjectButton");
  const cancelProjectEdit = document.querySelector("#cancelProjectEdit");
  const contactForm = document.querySelector("#contactForm");
  const formStatus = document.querySelector("#formStatus");
  let editingProjectId = null;

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (navigation.classList.contains("show")) {
        bootstrap.Collapse.getOrCreateInstance(navigation).hide();
      }
    });
  });

  function setStatus(element, message, isError = false) {
    element.textContent = message;
    if (isError) {
      element.dataset.state = "error";
    } else {
      element.removeAttribute("data-state");
    }
  }

  async function requestJson(url, options) {
    const response = await fetch(url, options);
    if (response.status === 204) {
      return null;
    }

    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || "The request could not be completed.");
      error.status = response.status;
      throw error;
    }
    return result;
  }

  function setAuthenticated(authenticated) {
    projectLogin.hidden = authenticated;
    projectAdmin.hidden = !authenticated;
    if (!authenticated) {
      resetProjectForm();
    }
  }

  async function checkAuthentication() {
    try {
      const result = await requestJson("/api/auth/status");
      setAuthenticated(result.authenticated);
      if (result.authenticated) {
        await loadProjects();
      }
    } catch (error) {
      setStatus(loginStatus, error.message || "Unable to check login status.", true);
    }
  }

  function handleRequestError(error, statusElement) {
    if (error.status === 401) {
      setAuthenticated(false);
      setStatus(loginStatus, "Your login expired. Please log in again.", true);
      return;
    }

    setStatus(statusElement, error.message || "The request could not be completed.", true);
  }

  function createProjectCard(project, index) {
    const card = document.createElement("article");
    card.className = "project-card";
    if (index % 3 === 2) {
      card.classList.add("project-card-wide");
    }

    const artwork = document.createElement("a");
    artwork.className = `project-art project-art-${project.theme}`;
    artwork.href = `mailto:hello@fuad.dev?subject=${encodeURIComponent(`Tell me about ${project.title}`)}`;
    artwork.setAttribute("aria-label", `Ask about the ${project.title} project`);

    const artworkHeader = document.createElement("div");
    artworkHeader.className = "project-art-top";
    const conceptLabel = document.createElement("span");
    conceptLabel.textContent = `CONCEPT / ${project.year}`;
    const arrow = document.createElement("i");
    arrow.className = "bi bi-arrow-up-right";
    arrow.setAttribute("aria-hidden", "true");
    artworkHeader.append(conceptLabel, arrow);

    const artworkVisual = document.createElement("div");
    artworkVisual.className = "project-art-visual";
    const title = document.createElement("strong");
    title.className = "project-art-title";
    title.textContent = project.title;
    const tagline = document.createElement("span");
    tagline.className = "project-art-tagline";
    tagline.textContent = project.tagline;
    artworkVisual.append(title, tagline);
    artwork.append(artworkHeader, artworkVisual);

    const metadata = document.createElement("div");
    metadata.className = "project-meta";
    const details = document.createElement("div");
    const metadataTitle = document.createElement("h3");
    metadataTitle.textContent = project.title;
    const category = document.createElement("span");
    category.textContent = project.category;
    details.append(metadataTitle, category);
    const year = document.createElement("span");
    year.className = "project-year";
    year.textContent = project.year;
    metadata.append(details, year);

    const description = document.createElement("p");
    description.className = "project-description";
    description.textContent = project.description;
    card.append(artwork, metadata, description);
    return card;
  }

  function createProjectRecord(project) {
    const record = document.createElement("li");
    record.className = "project-record";

    const copy = document.createElement("div");
    copy.className = "project-record-copy";
    const title = document.createElement("strong");
    title.textContent = project.title;
    const category = document.createElement("span");
    category.textContent = `${project.category} · ${project.year}`;
    copy.append(title, category);

    const actions = document.createElement("div");
    actions.className = "project-record-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.dataset.action = "edit";
    editButton.dataset.id = project.id;
    editButton.textContent = "Edit";
    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-project";
    deleteButton.type = "button";
    deleteButton.dataset.action = "delete";
    deleteButton.dataset.id = project.id;
    deleteButton.textContent = "Delete";
    actions.append(editButton, deleteButton);
    record.append(copy, actions);
    return record;
  }

  async function loadProjects() {
    setStatus(projectStatus, "Loading projects…");
    try {
      const { projects } = await requestJson("/api/projects");
      projectGrid.replaceChildren(...projects.map(createProjectCard));
      projectRecordList.replaceChildren(...projects.map(createProjectRecord));
      setStatus(projectStatus, `${projects.length} ${projects.length === 1 ? "project" : "projects"}`);
    } catch (error) {
      projectGrid.replaceChildren();
      projectRecordList.replaceChildren();
      setStatus(projectStatus, error.message || "Unable to load projects.", true);
    }
  }

  function resetProjectForm() {
    projectForm.reset();
    editingProjectId = null;
    saveProjectButton.firstChild.textContent = "Add project ";
    cancelProjectEdit.hidden = true;
    setStatus(projectFormStatus, "");
  }

  toggleProjectManager.addEventListener("click", () => {
    const isExpanded = toggleProjectManager.getAttribute("aria-expanded") === "true";
    toggleProjectManager.setAttribute("aria-expanded", String(!isExpanded));
    projectManager.hidden = isExpanded;
    if (!isExpanded) {
      projectManager.scrollIntoView({ behavior: "smooth", block: "nearest" });
      checkAuthentication();
    }
  });

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitButton = loginForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    setStatus(loginStatus, "Checking password…");

    try {
      await requestJson("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: new FormData(loginForm).get("password") }),
      });
      loginForm.reset();
      setStatus(loginStatus, "");
      setAuthenticated(true);
      await loadProjects();
    } catch (error) {
      setStatus(loginStatus, error.message || "Unable to log in.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  logoutButton.addEventListener("click", async () => {
    try {
      await requestJson("/api/logout", { method: "POST" });
      setAuthenticated(false);
      setStatus(loginStatus, "You have been logged out.");
    } catch (error) {
      setStatus(projectFormStatus, error.message || "Unable to log out.", true);
    }
  });

  projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(projectForm));
    values.year = Number(values.year);
    const isEditing = editingProjectId !== null;
    const endpoint = isEditing ? `/api/projects/${editingProjectId}` : "/api/projects";
    const submitButton = projectForm.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    setStatus(projectFormStatus, isEditing ? "Updating project…" : "Adding project…");
    try {
      await requestJson(endpoint, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      resetProjectForm();
      setStatus(projectFormStatus, isEditing ? "Project updated." : "Project added.");
      await loadProjects();
    } catch (error) {
      handleRequestError(error, projectFormStatus);
    } finally {
      submitButton.disabled = false;
    }
  });

  cancelProjectEdit.addEventListener("click", resetProjectForm);

  projectRecordList.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) {
      return;
    }

    const { action, id } = button.dataset;
    button.disabled = true;
    try {
      if (action === "edit") {
        const { project } = await requestJson(`/api/projects/${id}`);
        editingProjectId = project.id;
        for (const [field, value] of Object.entries(project)) {
          if (projectForm.elements[field]) {
            projectForm.elements[field].value = value;
          }
        }
        saveProjectButton.firstChild.textContent = "Save changes ";
        cancelProjectEdit.hidden = false;
        setStatus(projectFormStatus, `Editing ${project.title}.`);
        projectForm.scrollIntoView({ behavior: "smooth", block: "center" });
        projectForm.elements.title.focus();
      } else if (action === "delete") {
        const record = button.closest(".project-record");
        const title = record.querySelector("strong").textContent;
        if (!window.confirm(`Delete "${title}" from the portfolio?`)) {
          return;
        }
        await requestJson(`/api/projects/${id}`, { method: "DELETE" });
        if (String(editingProjectId) === id) {
          resetProjectForm();
        }
        setStatus(projectFormStatus, "Project deleted.");
        await loadProjects();
      }
    } catch (error) {
      handleRequestError(error, projectFormStatus);
    } finally {
      button.disabled = false;
    }
  });

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus(formStatus, "Sending your message…");

    const submitButton = contactForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    try {
      const result = await requestJson("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(contactForm))),
      });
      contactForm.reset();
      setStatus(formStatus, result.message);
    } catch (error) {
      setStatus(formStatus, error.message || "Unable to send your message.", true);
    } finally {
      submitButton.disabled = false;
    }
  });

  loadProjects();
});
