const params = new URLSearchParams(window.location.search);
const nextPath = params.get("next") || "/";
const oauthError = params.get("error");
const message = document.querySelector("#authMessage");
const tabLogin = document.querySelector("#tabLogin");
const tabRegister = document.querySelector("#tabRegister");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");
const adminPanelLink = document.querySelector("#adminPanelLink");

function showMessage(text, isError = false) {
  message.hidden = false;
  message.textContent = text;
  message.classList.toggle("auth-error", isError);
  message.classList.toggle("auth-success", !isError);
}

function setTab(tab) {
  const isLogin = tab === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabRegister.classList.toggle("active", !isLogin);
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  message.hidden = true;
}

async function submitAuth(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(data.error || "Nao foi possivel autenticar.");
  }
  return data;
}

function goToApp(data) {
  if (data.user?.role === "admin" && adminPanelLink) {
    adminPanelLink.hidden = false;
  }
  window.location.href = nextPath;
}

tabLogin.addEventListener("click", () => setTab("login"));
tabRegister.addEventListener("click", () => setTab("register"));

// Exibe erro retornado pelo callback Google OAuth
if (oauthError) {
  showMessage(decodeURIComponent(oauthError), true);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await submitAuth("/api/auth/login", {
      email: document.querySelector("#loginEmail").value,
      password: document.querySelector("#loginPassword").value,
    });
    goToApp(data);
  } catch (error) {
    showMessage(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const data = await submitAuth("/api/auth/register", {
      name: document.querySelector("#registerName").value,
      email: document.querySelector("#registerEmail").value,
      password: document.querySelector("#registerPassword").value,
    });
    setTab("login");
    showMessage(data.message || "Cadastro enviado. Aguarde aprovacao.", false);
  } catch (error) {
    showMessage(error.message);
  }
});

if (adminPanelLink) {
  adminPanelLink.addEventListener("click", (event) => {
    event.preventDefault();
    window.location.href = "/admin.html";
  });
}

fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    if (data?.ok && data.user?.status === "approved") {
      if (data.user.role === "admin" && adminPanelLink) adminPanelLink.hidden = false;
      if (nextPath !== "/admin.html") window.location.href = nextPath;
    }
  })
  .catch(() => {});
