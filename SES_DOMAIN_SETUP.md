# AWS SES Domain Configuration Guide

## Важливо!

**Для Gmail адрес (`@gmail.com`) неможливо налаштувати SPF/DKIM/DMARC** - це можна зробити тільки для власного домену.

Якщо ви хочете використовувати `email1@example.com` як sender, email може потрапляти в спам, бо:
- AWS SES відправляє від імені Gmail домену
- Gmail не має SPF/DKIM записів для AWS SES
- Це виглядає як "spoofing" (підробка)

## Рішення: Використовуйте власний домен

Якщо у вас є власний домен (наприклад, `yourdomain.com`), ви можете:
1. Створити email адресу типу `alerts@yourdomain.com` або `danfoss@yourdomain.com`
2. Налаштувати SPF/DKIM/DMARC для цього домену
3. Верифікувати домен в AWS SES
4. Використовувати цю адресу як sender

---

## Якщо у вас є власний домен

### Крок 1: Верифікувати домен в AWS SES

1. Перейдіть в **AWS SES Console** → **Verified identities**
2. Натисніть **Create identity**
3. Виберіть **Domain**
4. Введіть ваш домен (наприклад, `yourdomain.com`)
5. AWS покаже вам DNS записи, які потрібно додати

### Крок 2: Налаштувати DKIM (AWS SES автоматично)

AWS SES автоматично генерує DKIM записи:
- 3 CNAME записи типу `_amazonses.yourdomain.com`
- Додайте їх у ваш DNS провайдера (Cloudflare, Route 53, тощо)

**Приклад:**
```
Name: abc123._domainkey.yourdomain.com
Type: CNAME
Value: abc123.dkim.amazonses.com
```

### Крок 3: Налаштувати SPF запис

Додайте TXT запис у ваш DNS:

**Якщо використовуєте тільки AWS SES:**
```
Name: yourdomain.com (або @)
Type: TXT
Value: v=spf1 include:amazonses.com ~all
```

**Якщо також використовуєте інші email сервіси:**
```
Name: yourdomain.com
Type: TXT
Value: v=spf1 include:amazonses.com include:_spf.google.com ~all
```

### Крок 4: Налаштувати DMARC

Додайте TXT запис:

```
Name: _dmarc.yourdomain.com
Type: TXT
Value: v=DMARC1; p=quarantine; rua=mailto:dmarc-reports@yourdomain.com; ruf=mailto:dmarc-reports@yourdomain.com; pct=100
```

**Пояснення:**
- `p=quarantine` - карантин (перемістити в спам)
- `p=none` - тільки моніторинг (для початку)
- `p=reject` - відхилити (для production)
- `rua` - адреса для агрегованих звітів
- `ruf` - адреса для детальних звітів про помилки

**Для початку (менш суворо):**
```
v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com
```

### Крок 5: Перевірити налаштування

1. Зачекайте 15-30 хвилин після додавання DNS записів
2. У AWS SES Console натисніть "Verify" для домену
3. Перевірте статус - має стати "Verified" з зеленими галочками для DKIM/SPF

### Крок 6: Оновити код для використання нового домену

У `lib/danfoss-alerts-stack.ts` змініть:

```typescript
environment: {
  // ...
  NOTIFICATION_EMAILS: "email1@example.com,email2@example.com",
  SENDER_EMAIL: "alerts@yourdomain.com", // Використовуйте ваш домен
}
```

---

## Перевірка DNS записів

Після додавання записів, перевірте їх:

```bash
# Перевірити SPF
dig TXT yourdomain.com

# Перевірити DMARC
dig TXT _dmarc.yourdomain.com

# Перевірити DKIM (замініть на реальний з AWS SES)
dig CNAME abc123._domainkey.yourdomain.com
```

---

## Якщо у вас немає власного домену

### Варіанти:

1. **Купити дешевий домен** ($10-15/рік):
   - Namecheap, Google Domains, Cloudflare Registrar
   - Наприклад, `yourname-alerts.com`

2. **Використовувати існуючий домен** (якщо є)

3. **Залишитись на Gmail** та:
   - Додавати email в "Важливі" вручну
   - Налаштувати фільтри в Gmail для переміщення зі спаму
   - Використовувати Gmail labels для автоматичної організації

---

## Налаштування фільтрів в Gmail (якщо залишаєтесь на Gmail)

Якщо email все ще потрапляє в спам:

1. Відкрийте лист у папці "Спам"
2. Натисніть "Не спам"
3. Створіть фільтр:
   - Settings → Filters and Blocked Addresses → Create a new filter
   - Введіть: `From: (email1@example.com OR email2@example.com)` (якщо sender один з них)
   - Виберіть: "Never send it to Spam" та "Star it" (опціонально)

---

## Корисні посилання

- [AWS SES Domain Verification](https://docs.aws.amazon.com/ses/latest/dg/verifying-domains.html)
- [SPF Record Checker](https://mxtoolbox.com/spf.aspx)
- [DMARC Record Checker](https://mxtoolbox.com/dmarc.aspx)
- [DKIM Record Checker](https://mxtoolbox.com/dkim.aspx)

