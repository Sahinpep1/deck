import { getMapData ,getSalesRepSummary, getOutOfBoundsDf, getOutOfPalletInfo } from '../lib/dataService';
import MapContainer from './MapContainer';

export default async function Home() {
  // Verileri sunucu tarafında Polars ile çekiyoruz
  const initialData = await getMapData();
  const salesRepSummary = await getSalesRepSummary();
  const outOfBoundsDf = await getOutOfBoundsDf();
  const outOfPalletInfo = await getOutOfPalletInfo();
  
  return (
    <main style={{ margin: 0, padding: 0, overflow: 'hidden', width: '100vw', height: '100vh' }}>
      <MapContainer initialData={initialData} salesRepSummary={salesRepSummary} outOfBoundsDf={outOfBoundsDf} outOfPalletInfo={outOfPalletInfo} />
    </main>
  );
}