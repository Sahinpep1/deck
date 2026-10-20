import polars as pl

# Excel'leri oku ve saniyeler içinde Parquet olarak kaydet
pl.read_excel(r"data\Bekleyen_Siparisler.xlsx").write_parquet(r"data\Bekleyen_Siparisler.parquet")
pl.read_excel(r"data\Hazir_Siparisler.xlsx").write_parquet(r"data\Hazir_Siparisler.parquet")
pl.read_excel(r"data\Müşteri Listesi.xlsx").write_parquet(r"data\Musteri_Listesi.parquet")
pl.read_excel(r"data\Palet Koli Raporu.xlsx").write_parquet(r"data\Palet_Koli_Raporu.parquet")