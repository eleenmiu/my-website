const loginPanel = document.querySelector("#loginPanel");
const dashboard = document.querySelector("#dashboard");
const loginForm = document.querySelector("#loginForm");
const loginMessage = document.querySelector("#loginMessage");
const logoutButton = document.querySelector("#logoutButton");
const notifyButton = document.querySelector("#notifyButton");
const searchInput = document.querySelector("#searchInput");
const statusFilter = document.querySelector("#statusFilter");
const refreshButton = document.querySelector("#refreshButton");
const quickCreateForm = document.querySelector("#quickCreateForm");
const leadList = document.querySelector("#leadList");
const leadDetail = document.querySelector("#leadDetail");
const toast = document.querySelector("#toast");

const statusLabels = {
  new: "新客资",
  contacted: "已联系",
  booked: "已预约",
  invalid: "无效",
};

let leads = [];
let selectedLeadId = "";
let events;

const api = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "请求失败");
  return data;
};

const formatTime = (value) => {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const isToday = (value) => {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const showToast = (message) => {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
};

const showBrowserNotification = (lead) => {
  if (Notification.permission !== "granted") return;
  new Notification("深惠口腔新客资", {
    body: `${lead.name} ${lead.phone || ""}：${lead.interest}`,
    tag: lead.id,
  });
};

const setAppVisible = (visible) => {
  loginPanel.classList.toggle("is-hidden", visible);
  dashboard.classList.toggle("is-hidden", !visible);
};

const statusClass = (status) => `status-pill status-${status}`;

const renderStats = () => {
  document.querySelector("#statTotal").textContent = leads.length;
  document.querySelector("#statNew").textContent = leads.filter((lead) => lead.status === "new").length;
  document.querySelector("#statBooked").textContent = leads.filter((lead) => lead.status === "booked").length;
  document.querySelector("#statToday").textContent = leads.filter((lead) => isToday(lead.createdAt)).length;
};

const renderList = () => {
  if (!leads.length) {
    leadList.innerHTML = '<span class="empty-state">暂无客资，提交官网表单后会出现在这里</span>';
    leadDetail.innerHTML = '<span class="empty-state">选择左侧客资查看详情</span>';
    return;
  }

  leadList.innerHTML = leads.map((lead) => `
    <button class="lead-card ${lead.id === selectedLeadId ? "is-active" : ""}" type="button" data-id="${lead.id}">
      <span class="lead-title-row">
        <strong>${lead.name}</strong>
        <span class="${statusClass(lead.status)}">${statusLabels[lead.status] || lead.status}</span>
      </span>
      <p>${lead.phone || "未留电话"} · ${lead.interest}</p>
      <span class="lead-meta">${lead.source} · ${formatTime(lead.createdAt)}</span>
    </button>
  `).join("");

  leadList.querySelectorAll(".lead-card").forEach((card) => {
    card.addEventListener("click", () => {
      selectedLeadId = card.dataset.id;
      renderList();
      renderDetail();
    });
  });

  if (!selectedLeadId || !leads.some((lead) => lead.id === selectedLeadId)) {
    selectedLeadId = leads[0].id;
  }
  renderDetail();
};

const renderDetail = () => {
  const lead = leads.find((item) => item.id === selectedLeadId);
  if (!lead) {
    leadDetail.innerHTML = '<span class="empty-state">选择左侧客资查看详情</span>';
    return;
  }

  leadDetail.innerHTML = `
    <div class="detail-title-row">
      <h2>${lead.name}</h2>
      <span class="${statusClass(lead.status)}">${statusLabels[lead.status] || lead.status}</span>
    </div>
    <div class="detail-grid">
      <div class="detail-item">
        <span class="detail-label">联系电话</span>
        <strong>${lead.phone || "未留电话"}</strong>
      </div>
      <div class="detail-item">
        <span class="detail-label">咨询项目</span>
        <strong>${lead.interest}</strong>
      </div>
      <div class="detail-item">
        <span class="detail-label">来源</span>
        <strong>${lead.source}</strong>
      </div>
      <div class="detail-item">
        <span class="detail-label">提交时间</span>
        <strong>${formatTime(lead.createdAt)}</strong>
      </div>
    </div>
    <span class="detail-label">处理状态</span>
    <div class="status-actions">
      ${Object.entries(statusLabels).map(([status, label]) => `
        <button class="status-button ${lead.status === status ? "is-active" : ""}" type="button" data-status="${status}">${label}</button>
      `).join("")}
    </div>
    <label>
      <span class="detail-label">跟进备注</span>
      <textarea id="noteInput" placeholder="记录沟通情况、到院时间、客户顾虑">${lead.note || ""}</textarea>
    </label>
    <button id="saveNoteButton" type="button">保存备注</button>
  `;

  leadDetail.querySelectorAll(".status-button").forEach((button) => {
    button.addEventListener("click", () => updateLead(lead.id, { status: button.dataset.status }));
  });

  leadDetail.querySelector("#saveNoteButton").addEventListener("click", () => {
    updateLead(lead.id, { note: leadDetail.querySelector("#noteInput").value });
  });
};

const loadLeads = async () => {
  const params = new URLSearchParams();
  params.set("status", statusFilter.value);
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  const data = await api(`/api/leads?${params.toString()}`);
  leads = data.leads;
  renderStats();
  renderList();
};

const updateLead = async (id, payload) => {
  const data = await api(`/api/leads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  leads = leads.map((lead) => (lead.id === id ? data.lead : lead));
  renderStats();
  renderList();
  showToast("客资已更新");
};

const connectEvents = () => {
  if (events) events.close();
  events = new EventSource("/api/events");
  events.onmessage = (event) => {
    const payload = JSON.parse(event.data);
    if (payload.type !== "new-lead") return;
    leads = [payload.lead, ...leads.filter((lead) => lead.id !== payload.lead.id)];
    selectedLeadId = payload.lead.id;
    renderStats();
    renderList();
    showToast(`新客资：${payload.lead.name} ${payload.lead.phone || ""}`);
    showBrowserNotification(payload.lead);
  };
};

const init = async () => {
  try {
    await api("/api/me");
    setAppVisible(true);
    await loadLeads();
    connectEvents();
  } catch {
    setAppVisible(false);
  }
};

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginMessage.textContent = "";
  const formData = new FormData(loginForm);
  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });
    setAppVisible(true);
    await loadLeads();
    connectEvents();
    showToast("登录成功");
  } catch (error) {
    loginMessage.textContent = error.message;
  }
});

logoutButton.addEventListener("click", async () => {
  await api("/api/logout", { method: "POST", body: "{}" }).catch(() => {});
  if (events) events.close();
  setAppVisible(false);
});

notifyButton.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    showToast("当前浏览器不支持系统通知");
    return;
  }
  const permission = await Notification.requestPermission();
  showToast(permission === "granted" ? "已开启浏览器通知" : "未开启通知权限");
});

refreshButton.addEventListener("click", loadLeads);
statusFilter.addEventListener("change", loadLeads);
searchInput.addEventListener("input", () => {
  window.clearTimeout(searchInput.timer);
  searchInput.timer = window.setTimeout(loadLeads, 250);
});

quickCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(quickCreateForm);
  try {
    const data = await api("/api/leads", {
      method: "POST",
      body: JSON.stringify({
        name: formData.get("name") || "手动录入客户",
        phone: formData.get("phone"),
        interest: formData.get("interest") || "口腔咨询",
        source: "后台手动录入",
      }),
    });
    quickCreateForm.reset();
    leads = [data.lead, ...leads.filter((lead) => lead.id !== data.lead.id)];
    selectedLeadId = data.lead.id;
    renderStats();
    renderList();
    showToast("客资已录入");
  } catch (error) {
    showToast(error.message);
  }
});

init();
