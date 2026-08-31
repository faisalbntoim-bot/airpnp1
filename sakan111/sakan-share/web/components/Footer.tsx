import { getDictionary, type Locale } from '@/lib/i18n';

export default function Footer({ locale }: { locale: Locale }) {
  const t = getDictionary(locale);
  const year = new Date().getFullYear();
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div>© {year} — {t.footer.brand} · {t.footer.rights}</div>
        <nav className="fnav" aria-label="footer">
          <a href="#">{t.footer.privacy}</a>
          <a href="#">{t.footer.terms}</a>
        </nav>
        <div className="note">{t.footer.note}</div>
      </div>
    </footer>
  );
}
