// אנימציות קלות לדף הנחיתה: כותרת שנצבעת בגלילה, חשיפה בגלילה ומונים.
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// כותרת עליונה אטומה אחרי גלילה
const top = document.getElementById('top');
const onScroll = () => top && top.classList.toggle('solid', window.scrollY > 12);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// מונים
function countUp(el) {
  const to = Number(el.dataset.count);
  if (!to || reduce) return;
  const start = performance.now();
  const dur = 1400;
  const fmt = new Intl.NumberFormat(document.documentElement.lang);
  const step = (t) => {
    const k = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    el.textContent = fmt.format(Math.round(to * eased));
    if (k < 1) requestAnimationFrame(step);
  };
  el.textContent = '0';
  requestAnimationFrame(step);
}

// חשיפה בגלילה
const items = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduce) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        e.target.querySelectorAll('[data-count]').forEach(countUp);
        io.unobserve(e.target);
      }
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
  );
  items.forEach((el) => io.observe(el));
} else {
  items.forEach((el) => el.classList.add('in'));
}

// שאלות: פתיחה אחת בכל פעם
document.querySelectorAll('.qa').forEach((d) =>
  d.addEventListener('toggle', () => {
    if (d.open) document.querySelectorAll('.qa[open]').forEach((o) => o !== d && (o.open = false));
  })
);
