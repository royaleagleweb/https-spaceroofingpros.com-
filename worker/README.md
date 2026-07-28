# Contract Worker — הפעלת שליחה אוטומטית

בלי ה-Worker הבוט כבר עובד: הוא מייצר את החוזה, מוריד PDF ופותח לך מייל מוכן.
ה-Worker מוסיף את החלק של **שליחה בלחיצה אחת + חתימה דיגיטלית** של הלקוח.

זמן הקמה: בערך 10 דקות.

---

## 1. חשבון Resend

1. הירשם ב־[resend.com](https://resend.com) (חינם עד 3,000 מיילים בחודש).
2. **Domains** → הוסף את `spaceroofingpros.com` והוסף את רשומות ה־DNS שהם נותנים
   (SPF + DKIM). בלי אימות הדומיין המיילים ייפלו לספאם.
3. **API Keys** → צור מפתח חדש והעתק אותו.

## 2. פריסת ה-Worker

```bash
cd worker
npm install
npx wrangler login
```

ערוך את `wrangler.toml` והתאם את `SITE_URL`, `FROM_EMAIL`, `COMPANY_EMAIL`
ו־`ALLOWED_ORIGIN` לדומיין שלך.

עכשיו הגדר את שלושת הסודות (לא נכנסים לגיט):

```bash
npx wrangler secret put RESEND_API_KEY    # המפתח מ-Resend
npx wrangler secret put OPERATOR_TOKEN    # סיסמה שאתה ממציא — מגנה על כפתור השליחה
npx wrangler secret put SIGNING_SECRET    # מחרוזת אקראית ארוכה — חותמת קישורי חתימה
```

ליצירת ערכים אקראיים חזקים:

```bash
openssl rand -base64 32
```

פרוס:

```bash
npm run deploy
```

תקבל כתובת בסגנון `https://srp-contracts.<שם-החשבון>.workers.dev`.
בדוק שהיא חיה:

```bash
curl https://srp-contracts.<שם-החשבון>.workers.dev/api/health
# {"ok":true,"service":"srp-contracts"}
```

## 3. חיבור הבוט

פתח את `contract-bot.html` (גגות) או `pergola-contract.html` (פרגולות) → **⚙**:

| שדה | ערך |
| --- | --- |
| כתובת ה-Worker | `https://srp-contracts.<שם-החשבון>.workers.dev` |
| טוקן מפעיל | אותו ערך שהגדרת ב־`OPERATOR_TOKEN` |

השמירה היא ב־`localStorage` של הדפדפן שלך בלבד — הטוקן לא נכנס לקוד ולא לגיט.
כל מי שמפעיל את הבוט ממכשיר אחר צריך להזין אותו פעם אחת אצלו.

---

## איך זה עובד

```
בוט (הדפדפן שלך)
   │  POST /api/send-contract   + Bearer OPERATOR_TOKEN
   ▼
Worker ──> Resend ──> מייל ללקוח עם כפתור "Review & Sign"
   │                              │
   │                              ▼
   │                    contract-sign.html#p=…&s=…&api=…
   │                              │  הלקוח חותם על הקנבס
   │                              ▼
   └────────────────  POST /api/sign  ──> מייל חתום ללקוח ולמשרד
```

ה-Worker משרת את שני סוגי החוזים. כל חוזה נושא שדה `kind`, ו-`assets/js/templates.js`
ממפה אותו לרנדרר המתאים. `recipient: 'me'` שולח לך טיוטה עם קישור שפותח מחדש את שלב
העריכה והחתימה; `recipient: 'client'` שולח ללקוח עם קישור חתימה.

**החוזה נוסע בתוך הקישור.** אין דאטהבייס ואין מה לתחזק. הקישור חתום ב־HMAC-SHA256
עם `SIGNING_SECRET`, ולכן אי אפשר לזייף חוזה או לשנות מחיר בקישור — ה-Worker
דוחה כל payload שהחתימה שלו לא מתאימה.

## נקודות שכדאי להכיר

- **נמעני המייל נעולים.** `/api/sign` שולח רק לכתובת המשרד מה-config ולכתובת
  הלקוח שנמצאת בתוך ה-payload החתום. אי אפשר להשתמש בנקודת הקצה לשליחת ספאם.
- **הקישור לא פג.** אם תרצה תוקף מוגבל, הוסף `exp` ל-payload ב־`handleSendContract`
  ובדוק אותו ב־`handleSign`.
- **אין עותק שמור בשרת.** העותק החתום נשמר בתיבת המייל של המשרד. אם תרצה ארכיון
  אמיתי, אפשר להוסיף R2 או D1 ולכתוב את החוזה החתום ב־`handleSign`.
- **הקישור ארוך** (החוזה מקודד בתוכו). זה תקין — אבל אל תשלח אותו ב-SMS שחותך URLים.

## תחזוקה

```bash
npm run tail      # לוגים חיים, שימושי כשמייל לא יוצא
npm run dev       # הרצה מקומית על localhost:8787
```

בהרצה מקומית עדכן זמנית את כתובת ה-Worker בהגדרות הבוט ל־`http://localhost:8787`,
והוסף `http://localhost:8080` ל־`ALLOWED_ORIGIN`.
