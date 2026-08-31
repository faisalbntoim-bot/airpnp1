# SakanHub — Share package for ChatGPT

هذا الأرشيف يحتوي على مكوّنات موقع سكن هوب لتشاركها مع ChatGPT:

## 1. web/  — مشروع Next.js الرسمي (المصدر الحالي)
- Next.js 14 + TypeScript + App Router
- i18n: عربي (افتراضي RTL) + إنجليزي
- Middleware للـredirect من `/` إلى `/ar`
- SEO كامل + Privacy Manifest
- بدون أسرار — كل .env محذوف

للتشغيل محلياً:
```bash
cd web
npm install
npm run dev     # http://localhost:3000
npm run build   # للتحقق من الإنتاج
```

## 2. sakan-design-reference.html  — التصميم الأصلي (mock كامل)
صفحة HTML واحدة (~9400 سطر) تحتوي على:
- خريطة Leaflet
- واجهة الواقع المعزّز
- صفحات العقارات والحجز
- كل CSS/JS داخل الملف
افتحها في المتصفح مباشرة لرؤية النسخة التصميمية.

## ما هو محذوف عمداً
- backend/ (كود الـFastify — سرّي البنية)
- ios/ (كود SwiftUI)
- node_modules/, .next/, .git/
- أي secret أو token أو API key
