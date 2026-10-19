import polars as pl

# Excel'leri oku ve saniyeler içinde Parquet olarak kaydet
pl.read_excel("data\Bekleyen_Siparisler.xlsx").write_parquet("data\Bekleyen_Siparisler.parquet")
pl.read_excel("data\Hazir_Siparisler.xlsx").write_parquet("data\Hazir_Siparisler.parquet")
pl.read_excel("data\Müşteri Listesi.xlsx").write_parquet("data\Musteri_Listesi.parquet")
pl.read_excel("data\Palet Koli Raporu.xlsx").write_parquet("data\Palet_Koli_Raporu.parquet")