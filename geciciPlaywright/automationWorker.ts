import { chromium, BrowserContext, Page } from 'playwright';
import path from 'path';
import fs from 'fs';

interface AutomationOptions {
  headless?: boolean;
}

export class AutomationWorkerService {
  private browser: any = null;
  private downloadDir: string;

  constructor() {
    // dataService.ts'in okuduğu ortak klasör yolu
    this.downloadDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(this.downloadDir)) {
      fs.mkdirSync(this.downloadDir, { recursive: true });
    }
  }

  // Tarayıcıyı başlat
  async init(options: AutomationOptions = { headless: true }) {
    this.browser = await chromium.launch({
      headless: options.headless,
      args: ['--no-sandbox', '--disable-gpu'],
    });
  }

  // İzole bir context ve optimize edilmiş sayfa oluşturur (Kod tekrarını önleyen ana metod)
  async createOptimizedPage(): Promise<{ context: BrowserContext; page: Page }> {
    if (!this.browser) {
      throw new Error("Tarayıcı başlatılmadı! Önce .init() çağrılmalıdır.");
    }

    const context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      acceptDownloads: true,
    });

    const page = await context.newPage();

    // Ağ Optimizasyonu: Sadece resim, font ve medyayı engelle (Telerik/CSS/JS bozulsun istemiyoruz)
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return { context, page };
  }

  // Ortak Giriş (Login) Metodu
  async performLogin(page: Page, baseUrl: string, user: string, pass: string): Promise<boolean> {
    try {
      await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
      await page.fill('#txtUsername', user);
      await page.fill('#txtPassword', pass);
      await page.click('#btnLogin');

      // Ana menünün yüklenmesini bekle (Giriş başarısı doğrulaması)
      await page.waitForSelector('#ctl00_ctl00_Menu_mainMenu', { state: 'visible', timeout: 15000 });
      return true;
    } catch (error) {
      console.error("Giriş başarısız:", error);
      return false;
    }
  }

  // Genel Excel / Dosya İndirme Yardımıcısı
  async downloadReport(page: Page, exportSelector: string, excelLinkSelector: string, targetFilename: string): Promise<string> {
    try {
      await page.waitForSelector(exportSelector, { state: 'visible', timeout: 20000 });
      await page.click(exportSelector);

      await page.waitForSelector(excelLinkSelector, { state: 'visible', timeout: 10000 });
      
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 30000 }),
        page.click(excelLinkSelector),
      ]);

      const filePath = path.join(this.downloadDir, `${targetFilename}.parquet`); // Veya .xlsx (Projenize göre)
      // Not: Eğer sistem doğrudan excel veriyorsa dosya uzantısını .xlsx yapabilirsiniz.
      const savedPath = path.join(this.downloadDir, `${targetFilename}.xlsx`);
      await download.saveAs(savedPath);

      console.log(`✅ Dosya başarıyla indirildi: ${savedPath}`);
      return savedPath;
    } catch (error) {
      console.error(`❌ Dosya indirme hatası (${targetFilename}):`, error);
      throw error;
    }
  }

  // Tarayıcıyı kapat
  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }
}