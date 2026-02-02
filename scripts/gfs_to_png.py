import xarray as xr
import matplotlib.pyplot as plt
import numpy as np
import os

# 最新サイクル（00Z）・解析時刻 f000
# NOAA OPeNDAP（NetCDF）
url = (
    "https://nomads.ncep.noaa.gov/dods/gfs_0p25/"
    "gfs20260101/gfs_0p25_00z"
)

# 上のURLは日付固定だと失敗します。
# 実運用では「今日のUTC日付」を組み立てます。
# ここでは Actions で確実に動かすため、下で自動算出します。

import datetime
now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
url = f"https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{date}/gfs_0p25_00z"

ds = xr.open_dataset(url)

# 850hPa 気温（K → ℃）
tmp = ds["tmpprs"].sel(lev=850, time=ds.time[0]) - 273.15

# lon 0–360 → -180–180
lon = ds["lon"].values
lat = ds["lat"].values
lon = ((lon + 180) % 360) - 180

# 並び替え
order = np.argsort(lon)
lon = lon[order]
tmp = tmp[:, order]

os.makedirs("data", exist_ok=True)

plt.figure(figsize=(18, 9))
plt.pcolormesh(lon, lat, tmp, shading="auto", cmap="jet")
plt.colorbar(label="850hPa Temperature (°C)")
plt.xlim(-180, 180)
plt.ylim(-90, 90)
plt.axis("off")

plt.savefig(
    "data/gfs_temp_850.png",
    dpi=150,
    bbox_inches="tight",
    pad_inches=0
)
plt.close()
