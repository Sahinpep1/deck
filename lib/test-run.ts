import { getMapData } from 'lib/dataService';

async function runTest() {
  console.log("Veriler okunuyor...");
  const data = await getMapData();
  console.log("Okunan Toplam Nokta Sayısı:", data.length);
  console.log("İlk 2 Veri Örneği:", data.slice(0, 2));
}

runTest();