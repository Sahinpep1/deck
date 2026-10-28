import { Suspense } from 'react';
import { getMapData, getSalesRepSummary, getOutOfBoundsDf, getOutOfPalletInfo } from '../lib/dataService';
import MapContainer from './MapContainer';
import { connection } from 'next/server';

// 1. Verileri çeken ve haritayı basan dinamik alt bileşen
async function MapDataLoader() {
  await connection(); // Dinamik bağlantı sinyali

  const initialData = await getMapData();
  const salesRepSummary = await getSalesRepSummary();
  const outOfBoundsDf = await getOutOfBoundsDf();
  const outOfPalletInfo = await getOutOfPalletInfo();
  
  return (
    <MapContainer 
      initialData={initialData} 
      salesRepSummary={salesRepSummary} 
      outOfBoundsDf={outOfBoundsDf} 
      outOfPalletInfo={outOfPalletInfo} 
    />
  );
}

// 2. Ana Sayfa (Suspense ile sarmalanmış)
export default function Home() {
  return (
    <main style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <Suspense fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Arial' }}>
          <h3>Harita ve lojistik verileri yükleniyor, lütfen bekleyin... 🚀</h3>
        </div>
      }>
        <MapDataLoader />
      </Suspense>
    </main>
  );
}