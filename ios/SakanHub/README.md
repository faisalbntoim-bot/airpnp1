# سكن هوب — iOS (SwiftUI)

> **حالة الملف** · هذا سكافولد كامل جاهز للتصميم والتطوير — ليس تطبيقًا نهائيًا.
> لم أستطع تجميع الكود (compile) من داخل هذه الجلسة لأن Xcode متاح فقط على macOS.
> افتح المشروع محليًا لتجربته وسأتابع أي أخطاء ترصدها.

## البنية

```
ios/SakanHub/
├── Package.swift                 ← افتح هذا الملف بـ Xcode 15+ (File ▸ Open)
├── Debug.xcconfig                ← الإعدادات الحساسة (انسخه إلى Secrets.xcconfig)
├── .gitignore
└── SakanHub/
    ├── SakanHubApp.swift          @main
    ├── Config.swift               قراءة المفاتيح/الإعدادات من Info.plist
    ├── Info.plist.template        الأذونات + مفاتيح Config
    ├── App/                       AppState, RootView, MainTabView
    ├── Core/
    │   ├── Design/Theme.swift     الألوان والأشكال والظلال
    │   ├── Models/                User · Property · Location · Features · Media
    │   │                          Model3D · VirtualTour · Booking · Favorite
    │   │                          SearchFilter · Office · Agent · Notification
    │   ├── Networking/            APIClient · APIError
    │   ├── Services/              Location · Payment · Messaging · AIRecommendation
    │   └── Repositories/          Property · User · Booking · Favorite · Office
    │                              (كلها Protocols + Mock implementations)
    ├── Components/
    │   ├── Lottie/                LottieView (Safe wrapper) + presets
    │   ├── PropertyCard.swift     بطاقة البث بطابع TikTok/Airbnb
    │   └── UICommon.swift         PrimaryButton · Chip · SectionHeader …
    ├── Features/
    │   ├── Home/                  الصفحة الرئيسية + الفلاتر
    │   ├── Search/                البحث + الفلترة + البحث الذكي
    │   ├── PropertyDetails/       صفحة العقار + مؤشّر صفقة AI
    │   ├── Map/                   MapKit exploration
    │   ├── AR/                    ARManager · LandOverlay · PropertyAnchor · ARPropertyView
    │   ├── VirtualTour/           جولة ٣٦٠ بـ SceneKit
    │   ├── Property3D/            محرك تجريدي + USDZ + GLTF (stub) + Gaussian Splat (stub)
    │   ├── Booking/               تقويم حجز يومي
    │   ├── Profile/               ملف المستخدم + تسجيل الدخول + المحفوظات + الحجوزات
    │   ├── Office/                لوحة المكتب العقاري
    │   ├── Marketing/             لوحة المسوّق
    │   └── Notifications/         قائمة الإشعارات
    └── Resources/
        ├── MockData.swift         بيانات تجريبية للـ Previews والتطوير
        └── Lottie/                ضع ملفات JSON هنا (اختياري)
```

## كيف تفتحه في Xcode

1. افتح Xcode 15 أو أحدث.
2. `File ▸ Open…` واختر `ios/SakanHub/Package.swift`.
3. Xcode سيحمّل الـ SPM وينزّل `lottie-spm` تلقائيًا.
4. اختر جهازًا (Simulator أو جهاز حقيقي) واضغط ⌘R.

## المتطلبات الأدنى

- **iOS 16.0** (نستخدم `Layout` protocol و`ContentUnavailableView` iOS 17+ في بعض المواضع — نازلة تلقائيًا).
- **Xcode 15+**.
- **Swift 5.9+**.
- جهاز حقيقي لاختبار ARKit + الكاميرا + المستشعرات (المحاكي لا يدعم ARKit).

## الأذونات (Info.plist)

الملف `SakanHub/Info.plist.template` فيه كل مفاتيح الأذونات التي يحتاجها التطبيق:

- `NSCameraUsageDescription` — للواقع المعزّز
- `NSLocationWhenInUseUsageDescription` — للخرائط والـ AR
- `NSMotionUsageDescription` — للبوصلة/الاتجاه
- `NSLocationTemporaryUsageDescriptionDictionary` → `ARGeoTracking` — للـ Geospatial anchors (اختياري)

انسخها إلى `Info.plist` الفعلي عند إنشاء iOS App target.

## الأمان والمفاتيح

- **لا تضع أي مفاتيح API في الكود مباشرة.**
- انسخ `Debug.xcconfig` إلى `Secrets.xcconfig` (مُدرج ضمن `.gitignore`) وضع القيم الحقيقية فيه.
- في Xcode: Project ▸ Info ▸ Configurations، اربط `Secrets.xcconfig` بـ Debug.
- `Config.swift` يقرأها من `Info.plist` عبر `$(VARIABLE)` substitution.

## ما هو حقيقي وما هو Mock

### ✅ يعمل فعليًا في الـ Scaffold
- كامل واجهة المستخدم (SwiftUI) والتنقل والتصفح.
- MapKit للاستكشاف الجغرافي.
- CoreLocation (الموقع + البوصلة).
- ARKit + RealityKit — جلسة كاميرا + رسم Polygon حدود الأرض + نموذج مبنى USDZ.
- SceneKit للجولة الافتراضية ٣٦٠ (يعرض الصور الموجودة في الحزمة).
- تقويم الحجز اليومي مع حساب الفاتورة.
- كل الـ Repositories تعمل عبر Mock in-memory implementations.

### ⚠️ يحتاج Backend / SDK قبل الإنتاج
| الميزة | لماذا | أين توصلها |
|---|---|---|
| قاعدة بيانات حقيقية | الآن كل شيء in-memory | استبدل `MockPropertyRepository` بتنفيذ يستخدم `APIClient` |
| المصادقة | OTP وهمي حاليًا | ربط Firebase Auth/OTP provider في `MockUserRepository` |
| الدفع | `MockPaymentService` دائمًا يرجع نجاح | ربط Moyasar/HyperPay/Apple Pay في تنفيذ `PaymentService` |
| Push Notifications | لا يوجد | أضف APNs + `UNUserNotificationCenter` |
| البحث الذكي (AI) | Mock بسيط keyword-based | استدعِ backend يستخدم Claude/GPT — **لا تضع API keys في التطبيق** |
| Property3DRenderer (GLTF) | `throws .notImplemented` | أضف [GLTFKit2](https://github.com/warrenm/GLTFKit2) أو تحويل server-side إلى USDZ |
| Property3DRenderer (Gaussian Splatting) | `throws .notImplemented` | راجع الملاحظة أدناه |

### 🔬 3D Gaussian Splatting — الوضع الصريح

`GaussianSplatRenderer` هو **stub معماري** فقط. RealityKit/SceneKit لا يدعمان صيغة 3DGS الخام
(`.ply` مضغوطة، `.splat`، `.ksplat` …). لتشغيلها فعليًا في تطبيق iOS تحتاج **واحدًا** من:

1. **Metal Renderer داخل التطبيق** — يوجد OSS projects (مثل `metal-splatting`) لكن لا شيء منها SDK رسمي.
2. **WKWebView + WebGPU/WebGL viewer** — تعرض النموذج داخل صفحة ويب مضمّنة (أسرع طريق).
3. **Server-side rendering** — تحوّل النموذج إلى فيديو أو USDZ على السحابة ثم تعرضه هنا.

عندما تختار الطريق، استبدل تطبيق `load(for:)` في `GaussianSplatRenderer` — لا حاجة لتغيير أي feature code.
`Property3DView` سيستخدمه تلقائيًا بمجرد أن `Property.model3D.format` يكون `.gaussianSplatPly` أو `.gaussianSplatKS`.

### 🔬 AR الدقة — الوضع الصريح

- GPS وحده = دقة ٥–٢٠ متر تقريبًا. **لا يوجد ادعاء بدقة سنتيمترية.**
- `ARGeoTrackingConfiguration` يعطي دقة أعلى بكثير لكنه **متاح فقط في مدن محدودة** (لا يشمل الرياض حاليًا).
  الكود يتحقق من التوفر عبر `.checkAvailability` ويستخدمه إذا كان متاحًا، وإلا يرجع إلى `WorldTracking + planeDetection`.
- المضلّع (`LandOverlay`) يُرسم من `PropertyLocation.boundaryPolygon` إذا كانت الحدود الحقيقية محفوظة، وإلا يولّد مربّعًا افتراضيًا من المركز + المساحة.

## الأداء

- `LazyVStack` في الصفحة الرئيسية.
- `AsyncImage` (فيه cache داخلي بسيط). للحمل الأعلى استبدله بـ [Nuke](https://github.com/kean/Nuke) أو [Kingfisher](https://github.com/onevcat/Kingfisher).
- Repositories `actor` — آمنة من الـ data races.
- نماذج 3D لا تُحمّل إلا عند فتح `Property3DView` / تفعيل زر AR.
- `MockPropertyRepository.list` يدعم `page` + `pageSize` (بنية pagination جاهزة).

## اختبار الميزات على جهاز حقيقي

| الميزة | ملاحظات |
|---|---|
| الشاشة الرئيسية / التنقل | يعمل في المحاكي |
| MapKit | يعمل في المحاكي |
| الموقع | فعّل "Feature ▸ Location" في المحاكي أو استخدم جهازًا |
| ARKit | **يحتاج جهازًا حقيقيًا** |
| الجولة الافتراضية ٣٦٠ | يحتاج ملف بانوراما (`.jpg` equirectangular) في bundle الحزمة |
| Gaussian Splat | لن يعمل حتى تربط محرك عرض حقيقي (انظر أعلاه) |

## Roadmap السريع

- [ ] استبدال Mocks بـ REST/GraphQL client
- [ ] Push notifications (APNs)
- [ ] Payment gateway (Moyasar/HyperPay/Apple Pay)
- [ ] Persist favourites بـ SwiftData
- [ ] بحث دلالي بـ Backend AI (Claude/OpenAI)
- [ ] ربط GLTFKit2 لدعم GLB/GLTF
- [ ] ربط محرك 3DGS (WKWebView أو Metal)
- [ ] Localizable.strings + دعم إنجليزي كامل
- [ ] Unit + UI tests
