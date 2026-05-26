const params = new URLSearchParams(window.location.search);
const nextPath = params.get("next") || "/";
const message = document.querySelector("#authMessage");
const tabLogin = document.querySelector("#tabLogin");
const tabRegister = document.querySelector("#tabRegister");
const loginForm = document.querySelector("#loginForm");
const registerForm = document.querySelector("#registerForm");

function showMessage(text, isError = true) {
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
  window.location.href = nextPath;
}

tabLogin.addEventListener("click", () => setTab("login"));
tabRegister.addEventListener("click", () => setTab("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitAuth("/api/auth/login", {
      email: document.querySelector("#loginEmail").value,
      password: document.querySelector("#loginPassword").value,
    });
  } catch (error) {
    showMessage(error.message);
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await submitAuth("/api/auth/register", {
      name: document.querySelector("#registerName").value,
      email: document.querySelector("#registerEmail").value,
      password: document.querySelector("#registerPassword").value,
    });
  } catch (error) {
    showMessage(error.message);
  }
});

fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    if (data?.ok) window.location.href = nextPath;
  })
  .catch(() => {});
