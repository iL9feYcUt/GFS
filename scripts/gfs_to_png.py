import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import os
import datetime

# ==== 日付自動（UTC）====
now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
url = f"https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{date}/gfs_0p25_00z"

ds = xr.open_dataset(url)

# 850hPa 気温（℃）
tmp = ds["tmpprs"].sel(lev=850, time=ds.time[0]) - 273.15
lat = ds["lat"].values
lon = ds["lon"].values

# lon 0–360 → -180–180
lon = ((lon + 180) % 360) - 180
order = np.argsort(lon)
lon = lon[order]
tmp = tmp[:, order]

# ==== セル境界を作る（ズレ防止の要点）====
def edges(arr):
    d = np.diff(arr).mean()
    return np.concatenate(([arr[0] - d/2], arr[:-1] + d/2, [arr[-1] + d/2]))

lon_e = edges(lon)
lat_e = edges(lat)

os.makedirs("data", exist_ok=True)

# ==== 画像生成（全球・余白なし・固定比率）====
fig = plt.figure(figsize=(18, 9), dpi=150)
ax = fig.add_axes([0, 0, 1, 1])  # 余白ゼロ

pcm = ax.pcolormesh(
    lon_e,
    lat_e,
    tmp,
    cmap="jet",
    shading="flat"
)

ax.set_xlim(-180, 180)
ax.set_ylim(-90, 90)
ax.axis("off")

plt.savefig("data/gfs_temp_850.png")
plt.close()
