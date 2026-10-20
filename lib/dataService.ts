'use server';

import 'server-only';
import pl from 'nodejs-polars';
import path from 'path';

/**
 * ORTAK PIPELINE: Dosyaları okur, birleştirir, temizler ve 
 * işlenmiş Polars DataFrame'ini döndürür.
 */
async function getProcessedDataFrame() {
  const dataDir = path.join(process.cwd(), 'data');
  
  // 1. Sipariş Excel'lerini oku ve statü ekle
  const bekleyenDf = pl.readParquet(path.join(dataDir, 'Bekleyen_Siparisler.parquet'))
    .withColumns(
      pl.col("Nokta İskontosu").cast(pl.Float64).alias("Nokta İskontosu"),
      pl.lit('pending').alias('status')
    );
      
  const hazirDf = pl.readParquet(path.join(dataDir, 'Hazir_Siparisler.parquet'))
    .withColumns(
      pl.col("Nokta İskontosu").cast(pl.Float64).alias("Nokta İskontosu"),
      pl.lit('delivered').alias('status')
    );

  // 2. Siparişleri dikey birleştir (concat)
  let birlesikDf = pl.concat([bekleyenDf, hazirDf]);

  // 3. Tip dönüşümleri ve sütun seçimi
  birlesikDf = birlesikDf
    .select(
      pl.col('SATIŞ TEMSİLCİSİ Kodu').cast(pl.Utf8).alias('sales_rep_code'),
      pl.col('SATIŞ TEMSİLCİSİ').cast(pl.Utf8).alias('salesrep'),
      pl.col('NOKTA Kodu').cast(pl.Utf8).alias('id'),
      pl.col('NOKTA').cast(pl.Utf8).alias('customer'),
      pl.col('ÜRÜN Kodu').cast(pl.Utf8).alias('product_code'),
      pl.col('Miktar').cast(pl.Int64).alias('Miktar'),
      pl.col('status')
    )
    .filter(pl.col('sales_rep_code').isNotNull());

  
  // 4. Müşteri Konumları ve Palet Raporlarını oku & birleştir (Join)
  const customerDf = pl.readParquet(path.join(dataDir, 'Musteri_Listesi.parquet'));
  const palletDf = pl.readParquet(path.join(dataDir, 'Palet_Koli_Raporu.parquet')).withColumns(
    pl.col('Palet').cast(pl.Float64).alias('Palet')
  );

  // Müşteri enlem/boylam dönüşümü (Virgül -> Nokta değişimi)
  const processedMus = customerDf.select(
    pl.col('Şube Id').cast(pl.Utf8).alias('id'),
    pl.col('Enlem').cast(pl.Utf8).str.replace(',', '.').cast(pl.Float64).alias('lat'),
    pl.col('Boylam').cast(pl.Utf8).str.replace(',', '.').cast(pl.Float64).alias('lng')
  );

  // 5. Palet kat sayısı hesabı ve Konum eşleştirme
  const joinedDf = birlesikDf
    .join(palletDf.select(pl.col('Ürün-> Ürün No').alias('product_code'), pl.col('Palet')), {
      on: 'product_code',
      how: 'left'
    })
    .withColumns(
      pl.col('Miktar').div(pl.col('Palet')).round(3).alias('PaletSayisi')
    )
    .join(processedMus, { on: 'id', how: 'left' });
 // birlesikDf'de olup customerDf'de BULUNMAYAN kayıtları verir

 console.log(joinedDf.columns)
 const paletOlmayanlar = joinedDf.filter(pl.col("Palet").isNull().or(pl.col("Palet").eq(0))).select("product_code", "PaletSayisi").unique();
console.log("Palet Raporunda Olmayan Ürünler:", paletOlmayanlar.toString());
const olmayanlar = birlesikDf.join(processedMus, { on: 'id', how: 'anti' });

console.log("Diğer tabloda olmayanlar:", olmayanlar.toString());
const missingLocationDf = joinedDf.filter(
  pl.col("lat").isNull().or(pl.col("lng").isNull().or(pl.col("lat").eq(0).or(pl.col("lng").eq(0))))
);

console.log("Konumu Olmay2an Müşteriler:", missingLocationDf.toString());
  // Konsol kontrolü
  //console.log('Joined DataFrame:', joinedDf.select("Miktar", "Palet", "PaletSayisi").head(5).toString());

  return [joinedDf, missingLocationDf, olmayanlar, paletOlmayanlar];
}



/**
 * Harita Bileşeni İçin Nokta (Müşteri) Bazlı Veri Üreten Fonksiyon
 */
export async function getMapData() {
  try {
    const [joinedDf] = await getProcessedDataFrame();

    // 6. Nokta (Müşteri) bazında gruplama (Group By)
    const finalDf = joinedDf.groupBy('id').agg(
      pl.col('customer').first(),
      pl.col('salesrep').first(),
      pl.col('lng').first(),
      pl.col('lat').first(),
      pl.col('Miktar').sum().alias('totalQuantity'),
      pl.col('PaletSayisi').sum().alias('totalPallet')
    );

    // 7. JS Objelerine (Array of Objects) çevirip Haritaya hazır hale getirme
    const rawRecords = finalDf.toRecords();

    // Deck.GL koordinat formatına [lng, lat] dönüştürme
    return rawRecords.map((r: any) => ({
      id: r.id,
      customer: r.customer,
      salesrep: r.salesrep,
      coordinates: [r.lng, r.lat], // Deck.GL [boylam, enlem] bekler
      totalQuantity: r.totalQuantity,
      totalPallet: r.totalPallet
    }));

  } catch (error) {
    console.error('Data Service Error:', error);
    return [];
  }
}

/**
 * İleride Plasiyer Bazlı İstatistikler İçin Kullanabileceğiniz Ek Fonksiyon
 */
export async function getSalesRepSummary() {
  try {
    const [joinedDf] = await getProcessedDataFrame();

    const summaryDf = joinedDf.groupBy('salesrep').agg(
      pl.col('id').nUnique().alias('totalCustomers'),
      pl.col('Miktar').sum().alias('totalQuantity'),
      pl.col('PaletSayisi').sum().alias('totalPallet')
    ).sort('totalQuantity');
   // console.log('Sales Rep Summary:', summaryDf.toString());
    return summaryDf.toRecords();
  } catch (error) {
    console.error('Sales Rep Summary Error:', error);
    return [];
  }
}