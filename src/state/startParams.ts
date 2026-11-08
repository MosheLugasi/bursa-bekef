// קישורים מדף הנחיתה: ‎?start=google (התחברות מיידית) או ‎?start=guest (משחק בלי חשבון, נשמר במכשיר)
export function consumeStartParam() {
  try {
    const u = new URL(location.href);
    const s = u.searchParams.get('start');
    if (!s) return;
    if (s === 'guest') localStorage.setItem('bursa-bekef-guest', '1');
    if (s === 'google') sessionStorage.setItem('shori-start', 'google');
    u.searchParams.delete('start');
    history.replaceState(null, '', u.pathname + u.search + u.hash);
  } catch {
    /* ignore */
  }
}
