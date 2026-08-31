import { getDictionary, type Locale } from '@/lib/i18n';

export default function CTA({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <section id="cta" className="section">
      <div className="wrap">
        <div className="cta">
          <h2>{t.cta.title}</h2>
          <p>{t.cta.body}</p>
          {/* Signup channel opens with TestFlight — this button is intentionally a no-op link. */}
          <a className="btn btn-primary" href="#" aria-disabled>
            {t.cta.primary}
          </a>
          <div className="note">{t.cta.note}</div>
        </div>
      </div>
    </section>
  );
}
