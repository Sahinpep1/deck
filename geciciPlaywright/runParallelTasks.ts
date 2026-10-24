import { AutomationWorkerService } from './automationWorker';

async function runAllReportsParallel() {
  const workerService = new AutomationWorkerService();
  await workerService.init({ headless: true });

  console.log("🚀 Paralel rapor çekme işlemleri başlatılıyor...");

  const credentials = {
    url: "https://pepsell.pepsicosell.com",
    user: "kullanici_adin",
    pass: "sifren",
  };

  try {
    // 4 ayrı raporu paralel olarak koşturmak için Promise.all kullanıyoruz
    await Promise.all([
      // 1. Görev: Bekleyen Siparişler
      (async () => {
        const { context, page } = await workerService.createOptimizedPage();
        await workerService.performLogin(page, credentials.url, credentials.user, credentials.pass);
        // İlgili sayfaya git, filtrele ve indir
        // Örn: await workerService.downloadReport(page, "[title='Export']", "text=Excel", "Bekleyen_Siparisler");
        await context.close();
      })(),

      // 2. Görev: Hazır Siparişler
      (async () => {
        const { context, page } = await workerService.createOptimizedPage();
        await workerService.performLogin(page, credentials.url, credentials.user, credentials.pass);
        // Örn: await workerService.downloadReport(page, "[title='Export']", "text=Excel", "Hazir_Siparisler");
        await context.close();
      })(),

      // 3. Görev: Müşteri Listesi
      (async () => {
        const { context, page } = await workerService.createOptimizedPage();
        await workerService.performLogin(page, credentials.url, credentials.user, credentials.pass);
        // Örn: Müşteri listesi indirme adımları...
        await context.close();
      })(),

      // 4. Görev: Palet Koli Raporu
      (async () => {
        const { context, page } = await workerService.createOptimizedPage();
        await workerService.performLogin(page, credentials.url, credentials.user, credentials.pass);
        // Örn: Palet raporu indirme adımları...
        await context.close();
      })(),
    ]);

    console.log("🎉 Tüm raporlar paralel olarak başarıyla indirildi ve data klasörüne işlendi!");
  } catch (error) {
    console.error("Paralel süreç sırasında hata:", error);
  } finally {
    await workerService.close();
  }
}

// Çalıştırmak için:
// runAllReportsParallel();