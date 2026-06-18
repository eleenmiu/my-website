const bootIcons = () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const topics = document.querySelectorAll(".topic");
const consultInput = document.querySelector("#consultInput");

const submitLead = async (lead) => {
  const response = await fetch("/api/leads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lead),
  });
  if (!response.ok) throw new Error("提交失败");
  return response.json();
};

topics.forEach((topic) => {
  topic.addEventListener("click", () => {
    topics.forEach((item) => item.classList.remove("is-active"));
    topic.classList.add("is-active");
    if (consultInput) {
      consultInput.value = `我想了解${topic.dataset.topic}`;
      consultInput.focus();
    }
  });
});

const consultForm = document.querySelector(".consult-form");
if (consultForm && consultInput) {
  consultForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = consultInput.value.trim() || "我想预约口腔检查";
    consultInput.value = message;
    const button = consultForm.querySelector("button[type='submit'] span");
    if (button) button.textContent = "已提交";
    try {
      await submitLead({
        name: "官网访客",
        phone: "",
        interest: message,
        source: "官网快捷咨询",
      });
    } catch {
      if (button) button.textContent = "咨询";
    }
  });
}

const orthoForm = document.querySelector(".ortho-form");
if (orthoForm) {
  orthoForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const inputs = orthoForm.querySelectorAll("input");
    const problem = inputs[0]?.value.trim() || "我想了解牙齿矫正方案";
    const phone = inputs[1]?.value.trim() || "";
    const button = orthoForm.querySelector("button span");
    if (button) button.textContent = "已收到预约";
    try {
      await submitLead({
        name: "正畸咨询客户",
        phone,
        interest: problem,
        source: "正畸微笑预览页",
      });
    } catch {
      if (button) button.textContent = phone ? "提交预约" : "请填写手机号";
    }
  });
}

const smileCanvas = document.querySelector("#smileCanvas");
const smileUpload = document.querySelector("#smileUpload");
const smileDemo = document.querySelector("#smileDemo");
const smileEmpty = document.querySelector("#smileEmpty");

const drawSmilePreview = (image) => {
  if (!smileCanvas) return;
  const ctx = smileCanvas.getContext("2d");
  const width = smileCanvas.width;
  const height = smileCanvas.height;
  const half = width / 2;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#101f24";
  ctx.fillRect(0, 0, width, height);

  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const x = (width - drawWidth) / 2;
  const y = (height - drawHeight) / 2;

  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  const original = ctx.getImageData(0, 0, width, height);

  ctx.putImageData(original, 0, 0);
  ctx.save();
  ctx.beginPath();
  ctx.rect(half, 0, half, height);
  ctx.clip();
  ctx.filter = "brightness(1.08) contrast(1.05) saturate(0.96)";
  ctx.drawImage(image, x, y, drawWidth, drawHeight);
  ctx.filter = "none";

  const mouthX = half + width * 0.13;
  const mouthY = height * 0.53;
  const mouthW = width * 0.24;
  const mouthH = height * 0.1;
  const gradient = ctx.createRadialGradient(
    mouthX + mouthW / 2,
    mouthY + mouthH / 2,
    4,
    mouthX + mouthW / 2,
    mouthY + mouthH / 2,
    mouthW * 0.72,
  );
  gradient.addColorStop(0, "rgba(255,255,255,0.42)");
  gradient.addColorStop(0.58, "rgba(255,248,232,0.24)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(mouthX + mouthW / 2, mouthY + mouthH / 2, mouthW / 2, mouthH / 2, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.54)";
  ctx.lineWidth = 1.2;
  for (let i = 1; i < 6; i += 1) {
    const px = mouthX + (mouthW / 6) * i;
    ctx.beginPath();
    ctx.moveTo(px, mouthY + mouthH * 0.18);
    ctx.quadraticCurveTo(px + 2, mouthY + mouthH * 0.5, px, mouthY + mouthH * 0.82);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(mouthX + mouthW * 0.08, mouthY + mouthH * 0.5);
  ctx.quadraticCurveTo(mouthX + mouthW * 0.5, mouthY + mouthH * 0.42, mouthX + mouthW * 0.92, mouthY + mouthH * 0.5);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = "rgba(0,0,0,0.36)";
  ctx.fillRect(0, 0, width, 44);
  ctx.fillStyle = "#fff";
  ctx.font = "700 20px sans-serif";
  ctx.fillText("当前微笑", 24, 30);
  ctx.fillText("矫正后模拟", half + 24, 30);

  ctx.strokeStyle = "rgba(255,255,255,0.82)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(half, 0);
  ctx.lineTo(half, height);
  ctx.stroke();

  ctx.fillStyle = "rgba(16, 45, 53, 0.82)";
  ctx.fillRect(half + 18, height - 70, half - 36, 44);
  ctx.fillStyle = "#f7e7c4";
  ctx.font = "700 17px sans-serif";
  ctx.fillText("效果仅供沟通参考", half + 36, height - 42);

  if (smileEmpty) smileEmpty.classList.add("is-hidden");
};

const loadSmileImage = (src) => {
  const image = new Image();
  image.onload = () => drawSmilePreview(image);
  image.src = src;
};

if (smileUpload) {
  smileUpload.addEventListener("change", () => {
    const file = smileUpload.files && smileUpload.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => loadSmileImage(reader.result);
    reader.readAsDataURL(file);
  });
}

if (smileDemo) {
  smileDemo.addEventListener("click", () => {
    loadSmileImage("assets/images/doctors-champagne/meituan-doctor-4.jpg");
  });
}

const counters = document.querySelectorAll("[data-count]");
const formatNumber = (value) => {
  if (value >= 1000000) return `${Math.round(value / 10000)}万+`;
  if (value >= 10000) return `${Math.round(value / 10000)}万+`;
  return `${value}+`;
};

const animateCounter = (element) => {
  const target = Number(element.dataset.count);
  const duration = 1200;
  const startedAt = performance.now();

  const tick = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = formatNumber(Math.round(target * eased));
    if (progress < 1) requestAnimationFrame(tick);
  };

  requestAnimationFrame(tick);
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting && !entry.target.dataset.done) {
      entry.target.dataset.done = "true";
      animateCounter(entry.target);
    }
  });
}, { threshold: 0.45 });

counters.forEach((counter) => observer.observe(counter));
bootIcons();
