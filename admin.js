const pendingUsers = document.querySelector("#pendingUsers");
const allUsers = document.querySelector("#allUsers");
const adminMessage = document.querySelector("#adminMessage");
const refreshUsers = document.querySelector("#refreshUsers");

function showMessage(text, isError = false) {
  adminMessage.hidden = false;
  adminMessage.textContent = text;
  adminMessage.classList.toggle("auth-error", isError);
  adminMessage.classList.toggle("auth-success", !isError);
}

function statusLabel(status) {
  if (status === "approved") return "Aprovado";
  if (status === "rejected") return "Recusado";
  return "Pendente";
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function renderUserCard(user, container) {
  const card = document.createElement("article");
  card.className = "admin-user-card";

  const info = document.createElement("div");
  const name = document.createElement("strong");
  const email = document.createElement("div");
  const meta = document.createElement("div");
  const metrics = document.createElement("div");
  const buttons = document.createElement("div");

  email.className = "admin-user-meta";
  meta.className = "admin-user-meta";
  metrics.className = "admin-user-meta";
  buttons.className = "admin-user-buttons";

  name.textContent = user.name;
  email.textContent = user.email;
  meta.textContent = `${statusLabel(user.status)} · ${user.role}`;

  // Métricas
  const loginInfo = user.login_count
    ? `${user.login_count} login${user.login_count > 1 ? "s" : ""} · Último: ${formatDate(user.last_login)}`
    : "Nunca fez login";
  const sizeInfo = `Dados: ${formatBytes(user.data_size_bytes)}`;
  const createdInfo = user.created_at ? `Cadastro: ${formatDate(user.created_at)}` : "";

  metrics.innerHTML = `<span style="color:#6b7280;font-size:12px;">📅 ${createdInfo} &nbsp;·&nbsp; 🔑 ${loginInfo} &nbsp;·&nbsp; 💾 ${sizeInfo}</span>`;

  info.append(name, email, meta, metrics);
  card.append(info, buttons);

  if (user.status === "pending") {
    const approve = document.createElement("button");
    approve.type = "button";
    approve.className = "primary";
    approve.textContent = "Aprovar";
    approve.addEventListener("click", () => updateUser(user.id, "approve"));
    buttons.appendChild(approve);

    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "Recusar";
    reject.addEventListener("click", () => updateUser(user.id, "reject"));
    buttons.appendChild(reject);
  }

  container.appendChild(card);
}

async function updateUser(userId, action) {
  const response = await fetch(`/api/admin/users/${userId}/${action}`, {
    method: "POST",
    credentials: "same-origin",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    showMessage(data.error || "Nao foi possivel atualizar o usuario.", true);
    return;
  }
  showMessage(`Usuario ${action === "approve" ? "aprovado" : "recusado"}.`, false);
  await loadUsers();
}

async function loadUsers() {
  const meResponse = await fetch("/api/auth/me", { credentials: "same-origin" });
  const meData = await meResponse.json().catch(() => ({}));
  if (!meResponse.ok || meData.user?.role !== "admin" || meData.user?.status !== "approved") {
    window.location.href = "/login.html?next=/admin.html";
    return;
  }

  const [pendingResponse, allResponse] = await Promise.all([
    fetch("/api/admin/users?status=pending", { credentials: "same-origin" }),
    fetch("/api/admin/users", { credentials: "same-origin" }),
  ]);
  const pendingData = await pendingResponse.json();
  const allData = await allResponse.json();

  pendingUsers.replaceChildren();
  allUsers.replaceChildren();

  if (!pendingData.ok || !allData.ok) {
    showMessage("Nao foi possivel carregar os usuarios.", true);
    return;
  }

  if (!pendingData.users.length) {
    pendingUsers.innerHTML = '<p class="admin-empty">Nenhum usuario pendente.</p>';
  } else {
    pendingData.users.forEach((user) => renderUserCard(user, pendingUsers));
  }

  if (!allData.users.length) {
    allUsers.innerHTML = '<p class="admin-empty">Nenhum usuario encontrado.</p>';
  } else {
    allData.users.forEach((user) => renderUserCard(user, allUsers));
  }
}

refreshUsers.addEventListener("click", () => loadUsers().catch(() => showMessage("Erro ao atualizar.", true)));
loadUsers().catch(() => showMessage("Erro ao carregar painel.", true));
