import { getDictionary, type Locale } from '@/lib/i18n';

export default function HowItWorks({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  return (
    <section id="how" className="section">
      <div className="wrap">
        <h2 className="section-title">{t.how.title}</h2>
        <ol className="steps" role="list">
          {t.how.steps.map((s) => (
            <li className="step" key={s.title}>
              <h3>{s.title}</h3>
              <p>{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
