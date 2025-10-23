'use client';
import dynamic from 'next/dynamic';

const SkyKeyApp = dynamic(() => import('./components/SkyKeyApp'), { ssr: false });

export default function Page() {
  return <SkyKeyApp />;
}
