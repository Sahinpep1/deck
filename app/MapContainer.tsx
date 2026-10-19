'use client';

import dynamic from 'next/dynamic';

// SSR'ı burada, istemci bileşeninde güvenle kapatıyoruz
const DeckMap = dynamic(() => import('./DeckMap'), { 
  ssr: false,
  loading: () => <p className="p-4 text-center">Harita yükleniyor...</p>
});

export default function MapContainer({ initialData, salesRepSummary }: { initialData: any[]; salesRepSummary: any[] }) {
  return <DeckMap initialData={initialData} salesRepSummary={salesRepSummary} />;
}