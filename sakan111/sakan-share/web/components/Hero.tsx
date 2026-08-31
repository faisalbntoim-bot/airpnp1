import { getDictionary, type Locale } from '@/lib/i18n';

export default function Hero({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <section className="hero">
      <div className="wrap">
        <span className="hero-eyebrow">{t.hero.eyebrow}</span>
        <h1 className="hero-title">{t.hero.title}</h1>
        <p className="hero-subtitle">{t.hero.subtitle}</p>
        <div className="hero-ctas">
          <a className="btn btn-primary" href="#cta">{t.hero.primary}</a>
          <a className="btn btn-ghost" href="#features">{t.hero.secondary}</a>
        </div>
      </div>
    </section>
  );
}
