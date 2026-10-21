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
//const olmayanlar = birlesikDf.join(processedMus, { on: 'id', how: 'anti' });


const missingLocationDf = joinedDf.filter(
  pl.col("lat").isNull().or(pl.col("lng").isNull().or(pl.col("lat").eq(0).or(pl.col("lng").eq(0))))
);

const outOfBoundsDf = joinedDf.filter(
  // Check geographic boundaries
  pl.col("lat").lt(35.795432)
    .or(pl.col("lat").gt(37.078452))
    .or(pl.col("lng").lt(35.560693))
    .or(pl.col("lng").gt(37.126596))
  // Also treat invalid/missing values as out-of-bounds
    .or(pl.col("lat").isNull())
    .or(pl.col("lat").isNan())
    .or(pl.col("lat").eq(0))
    .or(pl.col("lng").isNull())
    .or(pl.col("lng").isNan())
    .or(pl.col("lng").eq(0))
).groupBy('id').agg(
  pl.col('customer').first(),
  pl.col('salesrep').first(),
  pl.col('lat').first(),
  pl.col('lng').first(),
  pl.col('PaletSayisi').sum().alias('totalPallet'),
  pl.col('Miktar').sum().alias('totalQuantity')
);
/* Fix and assign new cordinates for out-of-bounds records */
// Define your starting point and the step size for the vertical spacing
const startLat = 36.180744;
const fixedLng = 35.793710;
const stepSize = 0.01; // Adjust this to make the points closer or further apart

// 1. Define your out-of-bounds / invalid condition as a reusable expression
const isOutOfBounds = pl.col("lat").lt(35.795432)
  .or(pl.col("lat").gt(37.078452))
  .or(pl.col("lng").lt(35.560693))
  .or(pl.col("lng").gt(37.126596))
  .or(pl.col("lat").isNull())
  .or(pl.col("lat").isNan())
  .or(pl.col("lat").eq(0))
  .or(pl.col("lng").isNull())
  .or(pl.col("lng").isNan())
  .or(pl.col("lng").eq(0));

// 2. Keep the valid rows as they are (using .not())
const validDf = joinedDf.filter(isOutOfBounds.not());



const fixedOutOfBoundsDf = joinedDf.filter(isOutOfBounds)
  .withRowIndex("row_idx")
  .withColumns(
    pl.lit(fixedLng).alias("lng"),
    (pl.col("row_idx").cast(pl.Float64).mul(stepSize))
      .add(startLat)
      .alias("lat")
  )
  .drop("row_idx");

// 4. Concatenate the valid rows and the fixed rows back together
const finalDf = pl.concat([validDf, fixedOutOfBoundsDf]);

console.log(`Original row count: ${joinedDf.height}`);
console.log(`Final combined row count: ${finalDf.height}`);
console.log("Out of Bounds Records:", outOfBoundsDf.toString());
console.log("Konumu Olmay2an Müşteriler:", missingLocationDf.toString());
  // Konsol kontrolü
  //console.log('Joined DataFrame:', joinedDf.select("Miktar", "Palet", "PaletSayisi").head(5).toString());

  return [finalDf, missingLocationDf, outOfBoundsDf, paletOlmayanlar];
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
export async function getOutOfBoundsDf() {
  try {
    // getProcessedDataFrame'den [finalDf, missingLocationDf, outOfBoundsDf, paletOlmayanlar] alıyoruz
    const [finalDf, , outOfBoundsDf] = await getProcessedDataFrame();

    // 1. Orijinal outOfBoundsDf içindeki id'lerin listesini alalım
    const outOfBoundsIds = outOfBoundsDf.toRecords().map((r: any) => r.id);

    // 2. finalDf (yani güncel ve düzeltilmiş koordinatların olduğu ana tablo) 
    // üzerinden sadece bu id'ye sahip olanları filtreleyelim ve müşteri bazında gruplayalım
    const fixedOutOfBoundsGrouped = finalDf
      .filter(pl.col('id').isIn(outOfBoundsIds))
      .groupBy('id')
      .agg(
        pl.col('customer').first(),
        pl.col('salesrep').first(),
        pl.col('lng').first(), // 👈 Düzeltilmiş yeni boylam
        pl.col('lat').first(), // 👈 Düzeltilmiş yeni enlem
        pl.col('Miktar').sum().alias('totalQuantity'),
        pl.col('PaletSayisi').sum().alias('totalPallet')
      );

    // 3. Kayıtları JS objelerine çevirip Deck.GL formatına uygun coordinates ekleyelim
    const rawRecords = fixedOutOfBoundsGrouped.toRecords();

    return rawRecords.map((r: any) => ({
      ...r,
      coordinates: [r.lng, r.lat] // Artık haritada otomatik atanan yeni konumuna zoom yapacak!
    }));

  } catch (error) {
    console.error('Out of Bounds Records Error:', error);
    return [];
  }
}

export async function getOutOfPalletInfo() {
  try {
    // getProcessedDataFrame'den [finalDf, missingLocationDf, outOfBoundsDf, paletOlmayanlar] alıyoruz
    const [, , , paletOlmayanlar]= await getProcessedDataFrame();

    // 1. Orijinal outOfBoundsDf içindeki id'lerin listesini alalım
    const outOfPallet = paletOlmayanlar.toRecords()

   console.log("Palet Raporunda Olmayan Ürünler:", outOfPallet);

    return outOfPallet

  } catch (error) {
    console.error('Out of Pallet Records Error:', error);
    return [];
  }
}