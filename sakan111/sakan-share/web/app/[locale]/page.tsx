import { notFound } from 'next/navigation';
import { locales, type Locale } from '@/lib/i18n';
import Header from '@/components/Header';
import Hero from '@/components/Hero';
import Features from '@/components/Features';
import HowItWorks from '@/components/HowItWorks';
import CTA from '@/components/CTA';
import Footer from '@/components/Footer';

export default function LocalePage({ params }: { params: { locale: string } }) {
  if (!locales.includes(params.locale as Locale)) notFound();
  const locale = params.locale as Locale;
  return (
    <>
      <Header locale={locale} />
      <main>
        <Hero locale={locale} />
        <Features locale={locale} />
        <HowItWorks locale={locale} />
        <CTA locale={locale} />
      </main>
      <Footer locale={locale} />
    </>
  );
}
