const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const leadsFile = path.join(dataDir, "leads.json");
const sessions = new Map();
const clients = new Set();

const PORT = Number(process.env.PORT || 8090);
const ADMIN_USER = process.env.CRM_USER || "admin";
const ADMIN_PASS = process.env.CRM_PASS || "123456";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const ensureDataFile = () => {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(leadsFile)) fs.writeFileSync(leadsFile, "[]\n");
};

const readLeads = () => {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(leadsFile, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const writeLeads = (leads) => {
  ensureDataFile();
  fs.writeFileSync(leadsFile, `${JSON.stringify(leads, null, 2)}\n`);
};

const sendJson = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
};

const parseBody = (req) => new Promise((resolve, reject) => {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      reject(new Error("请求内容过大"));
      req.destroy();
    }
  });
  req.on("end", () => {
    if (!body) return resolve({});
    try {
      resolve(JSON.parse(body));
    } catch {
      reject(new Error("JSON 格式错误"));
    }
  });
});

const parseCookies = (req) => {
  const header = req.headers.cookie || "";
  return Object.fromEntries(header.split(";").map((item) => {
    const [key, ...rest] = item.trim().split("=");
    return [key, decodeURIComponent(rest.join("=") || "")];
  }).filter(([key]) => key));
};

const getSessionUser = (req) => {
  const token = parseCookies(req).crm_session;
  if (!token) return null;
  return sessions.get(token) || null;
};

const requireAuth = (req, res) => {
  const user = getSessionUser(req);
  if (user) return user;
  sendJson(res, 401, { ok: false, message: "请先登录" });
  return null;
};

const cleanText = (value, fallback = "") => String(value || fallback).trim().slice(0, 200);

const broadcastLead = (lead) => {
  const payload = `data: ${JSON.stringify({ type: "new-lead", lead })}\n\n`;
  clients.forEach((client) => client.write(payload));
};

const handleApi = async (req, res, url) => {
  if (req.method === "POST" && url.pathname === "/api/login") {
    const body = await parseBody(req);
    if (body.username === ADMIN_USER && body.password === ADMIN_PASS) {
      const token = crypto.randomBytes(24).toString("hex");
      sessions.set(token, { username: ADMIN_USER, loginAt: new Date().toISOString() });
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Set-Cookie": `crm_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
        "Cache-Control": "no-store",
      });
      res.end(JSON.stringify({ ok: true, user: { username: ADMIN_USER } }));
      return true;
    }
    sendJson(res, 401, { ok: false, message: "账号或密码不正确" });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/logout") {
    const token = parseCookies(req).crm_session;
    if (token) sessions.delete(token);
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Set-Cookie": "crm_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
      "Cache-Control": "no-store",
    });
    res.end(JSON.stringify({ ok: true }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/me") {
    const user = getSessionUser(req);
    sendJson(res, user ? 200 : 401, user ? { ok: true, user } : { ok: false });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    sendJson(res, 200, { ok: true, service: "shenhui-dental-crm" });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/leads") {
    const body = await parseBody(req);
    const lead = {
      id: crypto.randomUUID(),
      name: cleanText(body.name, "未留姓名"),
      phone: cleanText(body.phone),
      interest: cleanText(body.interest || body.message || body.problem, "口腔咨询"),
      source: cleanText(body.source, "官网"),
      note: cleanText(body.note),
      status: "new",
      createdAt: new Date().toISOString(),
    };

    if (!lead.phone && lead.source !== "官网快捷咨询") {
      sendJson(res, 400, { ok: false, message: "请留下手机号，方便回访" });
      return true;
    }

    const leads = readLeads();
    leads.unshift(lead);
    writeLeads(leads);
    broadcastLead(lead);
    sendJson(res, 201, { ok: true, lead });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/leads") {
    if (!requireAuth(req, res)) return true;
    const status = url.searchParams.get("status") || "";
    const keyword = (url.searchParams.get("q") || "").trim();
    let leads = readLeads();
    if (status && status !== "all") leads = leads.filter((lead) => lead.status === status);
    if (keyword) {
      leads = leads.filter((lead) => [lead.name, lead.phone, lead.interest, lead.source, lead.note]
        .some((value) => String(value || "").includes(keyword)));
    }
    sendJson(res, 200, { ok: true, leads });
    return true;
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/leads/")) {
    if (!requireAuth(req, res)) return true;
    const id = decodeURIComponent(url.pathname.split("/").pop());
    const body = await parseBody(req);
    const allowedStatus = new Set(["new", "contacted", "booked", "invalid"]);
    const leads = readLeads();
    const lead = leads.find((item) => item.id === id);
    if (!lead) {
      sendJson(res, 404, { ok: false, message: "客资不存在" });
      return true;
    }
    if (allowedStatus.has(body.status)) lead.status = body.status;
    if (typeof body.note === "string") lead.note = cleanText(body.note);
    lead.updatedAt = new Date().toISOString();
    writeLeads(leads);
    sendJson(res, 200, { ok: true, lead });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/events") {
    if (!getSessionUser(req)) {
      res.writeHead(401);
      res.end();
      return true;
    }
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
    });
    res.write("event: ready\ndata: {}\n\n");
    clients.add(res);
    req.on("close", () => clients.delete(res));
    return true;
  }

  return false;
};

const serveStatic = (req, res, url) => {
  const requestPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const filePath = path.normalize(path.join(rootDir, requestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });
    res.end(data);
  });
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/") && await handleApi(req, res, url)) return;
    serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { ok: false, message: error.message || "服务器错误" });
  }
});

ensureDataFile();
server.listen(PORT, () => {
  console.log(`客资系统已启动: http://127.0.0.1:${PORT}/`);
  console.log(`后台登录: http://127.0.0.1:${PORT}/admin.html`);
  console.log(`默认账号: ${ADMIN_USER} / ${ADMIN_PASS}`);
});
