// תוכן דף הנחיתה של ״שורי״ – עברית ואנגלית.
// המספרים (FACTS) נבדקים מול הקוד בבדיקה landing.test.ts – כדי שהתוכן יישאר מדויק.

export const FACTS = {
  instruments: 221, // מניות וקרנות (universe.json)
  journey: 18, // תחנות במסע של שורי
  lessons: 20, // שיעורים באקדמיה
  glossary: 143, // מושגים במילון
  achievements: 60, // הישגים
  events: 63, // אירועים היסטוריים במשחק ״מה יקרה אחר כך?״
  challenges: 6, // מסעות במכונת הזמן
  maxPlayers: 6 // שחקנים למשפחה בתוכנית החינמית
};

const he = {
  lang: 'he',
  dir: 'rtl',
  locale: 'he_IL',
  path: '',
  title: 'שורי | משחק בורסה וחינוך פיננסי לילדים ולכל המשפחה',
  description:
    'שורי הוא משחק השקעות משפחתי בעברית: הילדים לומדים מה זו מניה, אחוזים ותשואה, ומשקיעים בכסף וירטואלי במניות אמיתיות מתל אביב ומארה״ב. חינם, בלי פרסומות.',
  keywords: 'משחק בורסה לילדים, חינוך פיננסי לילדים, לימוד השקעות, סימולטור מסחר, מסחר וירטואלי, אוריינות פיננסית, בורסה לילדים, משחק השקעות למשפחה, שורי',
  ogAlt: 'שורי – משחק בורסה לכל המשפחה',
  share: 'מצאתי משחק בורסה מעולה לילדים – שורי 🐂📈 לומדים להשקיע במשחק, עם מניות אמיתיות ובלי כסף אמיתי:',
  nav: { how: 'איך זה עובד', features: 'מה יש בפנים', parents: 'להורים', pricing: 'מחיר', faq: 'שאלות', login: 'כניסה', cta: 'מתחילים בחינם', otherLang: 'English', otherLangCode: 'en' },
  hero: {
    eyebrow: 'משחק השקעות לכל המשפחה · מגיל 7',
    h1a: 'ילדים לומדים להשקיע.',
    h1b: 'במשחק.',
    lead: 'שורי הוא משחק בורסה משפחתי עם נתוני שוק אמיתיים מתל אביב ומוול סטריט. הילדים בונים תיק השקעות בכסף וירטואלי, מבינים סוף סוף מה זו מניה, מה זה אחוז ואיך מחשבים תשואה – ומתחרים עם כל המשפחה.',
    cta: 'מתחילים בחינם עם Google',
    cta2: 'או לנסות קודם בלי הרשמה',
    trust: ['חינם', 'בלי כרטיס אשראי', 'בלי פרסומות', 'בלי כסף אמיתי'],
    chips: [
      { e: '🏆', t: 'הישג חדש!', s: 'קניתם את המניה הראשונה' },
      { e: '⭐', t: 'תחנה 6 הושלמה', s: 'מה זה אחוז?' },
      { e: '🔥', t: '6 ימים ברצף', s: 'נועה לא מוותרת' }
    ],
    phoneAlt: 'מסך הבית במשחק שורי: התיק, המסע והשאלה היומית'
  },
  stats: [
    { n: 'instruments', l: 'מניות וקרנות אמיתיות' },
    { n: 'journey', l: 'תחנות במסע של שורי' },
    { n: 'lessons', l: 'שיעורים באקדמיה' },
    { n: 'glossary', l: 'מושגים במילון' },
    { n: 'achievements', l: 'הישגים לאסוף' }
  ],
  tickerTitle: 'מניות אמיתיות מת״א‑125, S&P 500 ונאסד״ק 100 – מתעדכנות אחרי כל יום מסחר',
  how: {
    kicker: 'איך זה עובד',
    h2: 'שלושה צעדים, ואתם בפנים',
    steps: [
      { e: '🔐', t: 'נכנסים עם Google', d: 'חשבון אחד לכל המשפחה. בלי טפסים ובלי סיסמאות – והכל נשמר בענן.' },
      { e: '🧑‍🤝‍🧑', t: 'יוצרים שחקנים', d: 'כל ילד וכל הורה מקבלים דמות, תיק השקעות משלהם וכסף וירטואלי להתחלה.' },
      { e: '🚀', t: 'משחקים, לומדים ומתחרים', d: 'קונים מניות של חברות שמכירים, עוברים את המסע של שורי ורואים מי מתקדם הכי יפה.' }
    ]
  },
  features: {
    kicker: 'מה יש בפנים',
    h2: 'כל מה שצריך כדי להבין כסף – בשפה של ילדים',
    items: [
      {
        id: 'journey',
        shot: 'station',
        e: '🗺️',
        t: 'המסע של שורי',
        d: 'מתחילים מהבסיס האמיתי: מה זה כסף, מה זו חברה, מה זו מניה ולמה מחירים זזים. ואז עולם שלם של אחוזים ותשואה, עם משחקים שאפשר לגעת בהם.',
        b: ['18 תחנות קצרות עם אנימציות', 'צובעים 100 משבצות ומבינים מה זה אחוז', 'מדבקות לאלבום ותיבות אוצר על כל התקדמות'],
        alt: 'תחנה במסע של שורי: רשת של 100 משבצות שמלמדת מה זה אחוז'
      },
      {
        id: 'market',
        shot: 'asset',
        e: '📈',
        t: 'מניות אמיתיות, כסף וירטואלי',
        d: 'אפל, אנבידיה, דיסני, טבע, בנק לאומי ועוד – 221 מניות וקרנות מישראל ומארה״ב, עם מחירים שמתעדכנים אחרי כל יום מסחר. דיבידנדים ופיצולים קורים כמו בבורסה האמיתית.',
        b: ['כל חברה מוסברת בשפה של ילדים – וגם של מבוגרים', 'גרפים, חדשות ודוחות כספיים', 'מתחילים עם מניות, ומתקדמים לאג״ח ואופציות'],
        alt: 'דף חברה במשחק שורי עם גרף מחיר והסבר לילדים'
      },
      {
        id: 'timemachine',
        shot: 'timemachine',
        e: '⏰',
        t: 'מכונת הזמן',
        d: 'חוזרים לתחילת 2020 ומשקיעים רגע לפני הקורונה, או עוברים את שנת הריבית ומהפכת הבינה המלאכותית – יום אחרי יום, בלי לדעת מה יקרה מחר. השיעור הכי טוב על סבלנות.',
        b: ['6 מסעות בזמן מ‑2019 ועד היום', 'מתקדמים ביום, בשבוע או בחודש', 'בלי ״ספוילרים״: רואים רק מה שהיה ידוע באותו יום'],
        alt: 'תיק במכונת הזמן של שורי באמצע משבר הקורונה'
      },
      {
        id: 'academy',
        shot: 'practice',
        e: '🎓',
        t: 'אקדמיה וזירת אימון',
        d: 'שיעורים קצרים שפותחים כלים חדשים במשחק, מילון שמסביר כל מושג בלחיצה, וזירת אימון לאחוזים ותשואה – עד שזה פשוט יושב.',
        b: ['20 שיעורים עם חידונים', '143 מושגים, בהסבר לילדים ולמבוגרים', '״מה יקרה אחר כך?״ – 63 אירועים אמיתיים מההיסטוריה'],
        alt: 'זירת האימון של שורי: תרגול אחוזים'
      },
      {
        id: 'compete',
        shot: 'compete',
        e: '🏆',
        t: 'תחרות משפחתית',
        d: 'טבלת דירוג לכל המשפחה, רמות ו‑XP, רצפים יומיים ו‑60 הישגים. מי ינצח החודש – אבא, אמא או הקטנה?',
        b: ['דירוג לפי תשואה, לא לפי סכום', 'כמה תיקים לכל שחקן', 'כל אחד מהמכשיר שלו – או כולם על מכשיר אחד'],
        alt: 'טבלת התחרות המשפחתית בשורי'
      }
    ]
  },
  parents: {
    kicker: 'להורים',
    h2: 'משחק שאפשר לסמוך עליו',
    lead: 'בנינו את שורי כמו שהיינו רוצים לתת לילדים שלנו: חינוכי, שקוף ובטוח.',
    items: [
      { e: '🪙', t: 'בלי כסף אמיתי', d: 'הכל וירטואלי. אין אפשרות להפקיד, למשוך או לקנות שום דבר בכסף אמיתי.' },
      { e: '🚫', t: 'בלי פרסומות', d: 'לא מציגים פרסומות ולא מוכרים לילדים כלום.' },
      { e: '🎓', t: 'לימוד, לא ייעוץ', d: 'שורי מלמד איך שוק ההון עובד. הוא לא ממליץ על מניות ולא מהווה ייעוץ השקעות.' },
      { e: '🔒', t: 'פרטיות', d: 'כל משפחה רואה רק את המידע שלה. אפשר גם לשחק בלי חשבון – והכל נשאר במכשיר.' },
      { e: '🛡️', t: 'קוד הורים', d: 'אזור ניהול מוגן: הוספת שחקנים, פתיחת תיקים, גיבוי ושחזור.' },
      { e: '🐂', t: 'שורי מסביר', d: 'בכל מסך יש הדרכה קצרה, וכל מושג מוסבר בלחיצה – אפשר לחזור עליהם מתי שרוצים.' }
    ]
  },
  ages: {
    kicker: 'לכל גיל',
    h2: 'גדל יחד עם הילדים',
    items: [
      { e: '🧒', t: 'ילדים 7–10', d: 'המסע של שורי, הסברים בשפה פשוטה, אנימציות ומדבקות. מניות של חברות שהם מכירים.' },
      { e: '🧑', t: 'נוער 11–15', d: 'שיעורים, חדשות, דוחות כספיים, פקודות לימיט וסטופ לוס – ותחרות על כל אחוז.' },
      { e: '🧑‍💼', t: 'מבוגרים מתחילים', d: 'מכפילים ונתונים פיננסיים, אג״ח ממשלתיות וקונצרניות, אופציות ומכונת הזמן.' }
    ]
  },
  pricing: {
    kicker: 'מחיר',
    h2: 'כמה זה עולה? כלום.',
    plan: 'תוכנית המשפחה',
    price: '₪0',
    per: 'לכל המשפחה',
    items: ['עד 6 שחקנים בכל משפחה', 'כל התחנות, השיעורים והכלים', 'נתוני שוק אמיתיים שמתעדכנים כל יום', 'סנכרון בין כל המכשירים', 'בלי פרסומות'],
    note: 'בלי כרטיס אשראי ובלי התחייבות.',
    cta: 'פותחים חשבון משפחתי'
  },
  faq: {
    kicker: 'שאלות נפוצות',
    h2: 'כל מה שרציתם לשאול',
    items: [
      { q: 'יש במשחק כסף אמיתי?', a: 'לא. כל הכסף בשורי וירטואלי. אין אפשרות להפקיד, למשוך או לקנות שום דבר בכסף אמיתי.' },
      { q: 'מאיזה גיל זה מתאים?', a: 'מגיל 7 ועד מבוגרים מתחילים. לכל שחקן בוחרים קבוצת גיל – ילדים, נוער או מבוגרים – וההסברים והכלים מותאמים לה.' },
      { q: 'מאיפה מגיעים הנתונים?', a: 'מחירי סגירה יומיים של 221 מניות וקרנות מהבורסה בתל אביב ומארה״ב, שמתעדכנים אוטומטית אחרי כל יום מסחר ממקורות מידע ציבוריים. הנתונים לימודיים ועשויים להתעכב.' },
      { q: 'כמה זה עולה?', a: 'שורי חינמי למשפחות – בלי כרטיס אשראי, בלי התחייבות ובלי פרסומות.' },
      { q: 'חייבים להירשם?', a: 'לא. אפשר להתחיל מיד ולשחק בלי חשבון, והכל נשמר במכשיר. התחברות עם Google שומרת את ההתקדמות בענן ומאפשרת לשחק מכל מכשיר.' },
      { q: 'שורי ממליץ על השקעות?', a: 'לא. שורי הוא משחק לימודי שמסביר איך שוק ההון עובד. הוא לא מהווה ייעוץ השקעות ולא ממליץ על ניירות ערך.' },
      { q: 'אפשר לשחק בטלפון?', a: 'כן. שורי עובד בדפדפן בטלפון, בטאבלט ובמחשב, ואפשר להוסיף אותו למסך הבית כמו אפליקציה.' },
      { q: 'באיזו שפה המשחק?', a: 'המשחק בעברית, עם מניות וקרנות מישראל ומארה״ב.' }
    ]
  },
  final: {
    h2a: 'ההשקעה הכי חכמה?',
    h2b: 'ללמד אותם איך זה עובד.',
    lead: 'פותחים חשבון משפחתי בחינם, יוצרים שחקנים – ומתחילים לשחק תוך דקה.',
    cta: 'מתחילים בחינם',
    share: 'שתפו עם הורים בוואטסאפ'
  },
  footer: {
    tag: 'משחק בורסה וחינוך פיננסי לכל המשפחה.',
    disclaimer: 'שורי הוא משחק לימודי. התכנים אינם ייעוץ השקעות או המלצה לפעולה בניירות ערך. נתוני השוק נלקחים ממקורות ציבוריים, מתעדכנים פעם ביום ועשויים להכיל עיכובים או אי‑דיוקים.',
    links: { play: 'כניסה למשחק', top: 'חזרה למעלה' }
  },
  shotNote: ''
};

const en = {
  lang: 'en',
  dir: 'ltr',
  locale: 'en_US',
  path: 'en/',
  title: 'Shori | Stock Market Game & Financial Literacy for Kids and Families',
  description:
    'Shori is a family investing game: kids learn stocks, percentages and returns by paper-trading real Tel Aviv and US stocks with virtual money. Free, no ads.',
  keywords: 'stock market game for kids, financial literacy for kids, investing game, paper trading, virtual stock market, kids money education, Shori',
  ogAlt: 'Shori – the stock market game for the whole family',
  share: 'Found a great stock market game for kids – Shori 🐂📈 Learn investing by playing, with real stocks and no real money:',
  nav: { how: 'How it works', features: 'Features', parents: 'Parents', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Start free', otherLang: 'עברית', otherLangCode: 'he' },
  hero: {
    eyebrow: 'The family investing game · Ages 7+',
    h1a: 'Kids learn to invest.',
    h1b: 'By playing.',
    lead: 'Shori is a family stock market game with real market data from Tel Aviv and Wall Street. Kids build a portfolio with virtual money, finally get what a stock, a percent and a return really are – and compete with the whole family.',
    cta: 'Start free with Google',
    cta2: 'or try it without signing up',
    trust: ['Free', 'No credit card', 'No ads', 'No real money'],
    chips: [
      { e: '🏆', t: 'New badge!', s: 'Bought the first stock' },
      { e: '⭐', t: 'Station 6 done', s: 'What is a percent?' },
      { e: '🔥', t: '6-day streak', s: 'Noa keeps going' }
    ],
    phoneAlt: 'Shori home screen: portfolio, the journey and the daily question (Hebrew interface)'
  },
  stats: [
    { n: 'instruments', l: 'real stocks & funds' },
    { n: 'journey', l: 'journey stations' },
    { n: 'lessons', l: 'academy lessons' },
    { n: 'glossary', l: 'glossary terms' },
    { n: 'achievements', l: 'badges to collect' }
  ],
  tickerTitle: 'Real stocks from the TA‑125, S&P 500 and Nasdaq‑100 – updated after every trading day',
  how: {
    kicker: 'How it works',
    h2: 'Three steps and you’re in',
    steps: [
      { e: '🔐', t: 'Sign in with Google', d: 'One account for the whole family. No forms, no passwords – everything is saved in the cloud.' },
      { e: '🧑‍🤝‍🧑', t: 'Create players', d: 'Every kid and parent gets an avatar, their own portfolio and virtual cash to start with.' },
      { e: '🚀', t: 'Play, learn and compete', d: 'Buy stocks of companies they know, travel Shori’s journey and see who improves the most.' }
    ]
  },
  features: {
    kicker: 'Features',
    h2: 'Everything you need to understand money – in kid language',
    items: [
      {
        id: 'journey',
        shot: 'station',
        e: '🗺️',
        t: 'Shori’s Journey',
        d: 'Start from the real basics: what money is, what a company is, what a stock is and why prices move. Then a whole world of percentages and returns, with games you can actually touch.',
        b: ['18 short animated stations', 'Color 100 squares to see what a percent is', 'Stickers and treasure chests for every step'],
        alt: 'A station in Shori’s Journey: a 100-square grid that teaches percentages'
      },
      {
        id: 'market',
        shot: 'asset',
        e: '📈',
        t: 'Real stocks, virtual money',
        d: 'Apple, Nvidia, Disney, Teva, Bank Leumi and more – 221 stocks and funds from Israel and the US, with prices updated after every trading day. Dividends and splits happen just like on the real exchange.',
        b: ['Every company explained for kids – and adults', 'Charts, news and financial reports', 'Start with stocks, unlock bonds and options'],
        alt: 'A company page in Shori with a price chart and a kid-friendly explanation'
      },
      {
        id: 'timemachine',
        shot: 'timemachine',
        e: '⏰',
        t: 'The Time Machine',
        d: 'Go back to early 2020 and invest right before COVID, or live through the year of rate hikes and the AI revolution – day by day, without knowing what tomorrow brings. The best lesson in patience.',
        b: ['6 time-travel challenges from 2019 to today', 'Advance by a day, a week or a month', 'No spoilers: only what was known on that day'],
        alt: 'A Time Machine portfolio in the middle of the COVID crash'
      },
      {
        id: 'academy',
        shot: 'practice',
        e: '🎓',
        t: 'Academy & practice arena',
        d: 'Short lessons that unlock new tools in the game, a glossary that explains any term in one tap, and a practice arena for percentages and returns – until it just clicks.',
        b: ['20 lessons with quizzes', '143 terms, explained for kids and adults', '“What happens next?” – 63 real historical events'],
        alt: 'Shori’s practice arena: percentage drills'
      },
      {
        id: 'compete',
        shot: 'compete',
        e: '🏆',
        t: 'Family competition',
        d: 'A family leaderboard, levels and XP, daily streaks and 60 badges. Who wins this month – Dad, Mom or the youngest?',
        b: ['Ranked by return, not by amount', 'Several portfolios per player', 'Everyone on their own device – or all on one'],
        alt: 'Shori’s family leaderboard'
      }
    ]
  },
  parents: {
    kicker: 'For parents',
    h2: 'A game you can trust',
    lead: 'We built Shori the way we’d want it for our own kids: educational, transparent and safe.',
    items: [
      { e: '🪙', t: 'No real money', d: 'Everything is virtual. There is no way to deposit, withdraw or buy anything with real money.' },
      { e: '🚫', t: 'No ads', d: 'We don’t show ads and we don’t sell anything to kids.' },
      { e: '🎓', t: 'Education, not advice', d: 'Shori teaches how markets work. It doesn’t recommend stocks and is not investment advice.' },
      { e: '🔒', t: 'Privacy', d: 'Each family sees only its own data. You can also play without an account – everything stays on the device.' },
      { e: '🛡️', t: 'Parent code', d: 'A protected parents’ zone: add players, open portfolios, back up and restore.' },
      { e: '🐂', t: 'Shori explains', d: 'Every screen has a short guided tour and every term is explained in one tap – replay them anytime.' }
    ]
  },
  ages: {
    kicker: 'For every age',
    h2: 'Grows with your kids',
    items: [
      { e: '🧒', t: 'Kids 7–10', d: 'Shori’s Journey, simple explanations, animations and stickers. Stocks of companies they know.' },
      { e: '🧑', t: 'Teens 11–15', d: 'Lessons, news, financial reports, limit orders and stop‑loss – and a race for every percent.' },
      { e: '🧑‍💼', t: 'Adult beginners', d: 'Valuation ratios and financials, government and corporate bonds, options and the Time Machine.' }
    ]
  },
  pricing: {
    kicker: 'Pricing',
    h2: 'How much does it cost? Nothing.',
    plan: 'Family plan',
    price: '$0',
    per: 'for the whole family',
    items: ['Up to 6 players per family', 'All stations, lessons and tools', 'Real market data, updated daily', 'Sync across all your devices', 'No ads'],
    note: 'No credit card. No commitment.',
    cta: 'Create a family account'
  },
  faq: {
    kicker: 'FAQ',
    h2: 'Everything you wanted to ask',
    items: [
      { q: 'Is there real money in the game?', a: 'No. All money in Shori is virtual. There is no way to deposit, withdraw or buy anything with real money.' },
      { q: 'What ages is it for?', a: 'From age 7 to adult beginners. Each player picks an age group – kids, teens or adults – and the explanations and tools adapt to it.' },
      { q: 'Where does the data come from?', a: 'Daily closing prices of 221 stocks and funds from the Tel Aviv Stock Exchange and the US, updated automatically after every trading day from public data sources. Data is for education and may be delayed.' },
      { q: 'How much does it cost?', a: 'Shori is free for families – no credit card, no commitment and no ads.' },
      { q: 'Do I have to sign up?', a: 'No. You can start right away without an account; everything is saved on the device. Signing in with Google saves progress in the cloud and lets you play on any device.' },
      { q: 'Does Shori recommend investments?', a: 'No. Shori is an educational game that explains how markets work. It is not investment advice and doesn’t recommend securities.' },
      { q: 'Can we play on a phone?', a: 'Yes. Shori runs in the browser on phones, tablets and computers, and you can add it to your home screen like an app.' },
      { q: 'What language is the game in?', a: 'The game is currently in Hebrew, with stocks and funds from Israel and the US.' }
    ]
  },
  final: {
    h2a: 'The smartest investment?',
    h2b: 'Teaching them how it works.',
    lead: 'Open a free family account, create players – and start playing in a minute.',
    cta: 'Start free',
    share: 'Share with parents on WhatsApp'
  },
  footer: {
    tag: 'The stock market game for the whole family.',
    disclaimer: 'Shori is an educational game. Nothing here is investment advice or a recommendation to trade securities. Market data comes from public sources, is updated once a day and may be delayed or inaccurate.',
    links: { play: 'Open the game', top: 'Back to top' }
  },
  shotNote: 'Screenshots show the Hebrew interface.'
};

export const CONTENT = { he, en };
