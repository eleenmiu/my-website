const bootIcons = () => {
  if (window.lucide) {
    window.lucide.createIcons();
  }
};

const topics = document.querySelectorAll(".topic");
const consultInput = document.querySelector("#consultInput");

topics.forEach((topic) => {
  topic.addEventListener("click", () => {
    topics.forEach((item) => item.classList.remove("is-active"));
    topic.classList.add("is-active");
    consultInput.value = `我想了解${topic.dataset.topic}`;
    consultInput.focus();
  });
});

document.querySelector(".consult-form").addEventListener("submit", (event) => {
  event.preventDefault();
  consultInput.value = consultInput.value.trim() || "我想预约口腔检查";
});

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
