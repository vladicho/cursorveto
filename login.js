const params = new URLSearchParams(window.location.search);
const oauthError = params.get("error");
const message = document.querySelector("#authMessage");

if (oauthError) {
  message.hidden = false;
  message.textContent = decodeURIComponent(oauthError);
  message.classList.add("auth-error");
}

// Se ja esta logado, redireciona para o editor
fetch("/api/auth/me", { credentials: "same-origin" })
  .then((response) => (response.ok ? response.json() : null))
  .then((data) => {
    if (data?.ok && data.user?.status === "approved") {
      window.location.href = "/";
    }
  })
  .catch(() => {});
