'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';

// SSR'ı kapatarak DeckMap bileşenini dinamik olarak yüklüyoruz
const DeckMap = dynamic(() => import('./DeckMap'), { 
  ssr: false,
  loading: () => <p>Harita yükleniyor...</p>
});

export default function Home() {
  const [selectedPoints, setSelectedPoints] = useState<any[]>([]);
  return (
    <main style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <DeckMap selectedPoints={selectedPoints} onSelectionChange={setSelectedPoints} />
    </main>
  );
}