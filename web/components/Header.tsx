import Link from 'next/link';
import { getDictionary, otherLocale, type Locale } from '@/lib/i18n';

export default function Header({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const other = otherLocale(locale);
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href={`/${locale}`} className="brand" aria-label={t.footer.brand}>
          <span className="brand-mark" aria-hidden>س</span>
          <span>{t.footer.brand}</span>
        </Link>
        <nav className="nav" aria-label="primary">
          <a href="#features">{t.nav.features}</a>
          <a href="#how">{t.nav.how}</a>
          <a href="#cta">{t.nav.contact}</a>
          <Link href={`/${other}`} className="lang" aria-label="Toggle language">
            {t.nav.language}
          </Link>
        </nav>
      </div>
    </header>
  );
}
