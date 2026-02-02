import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import json
import os
import datetime

# ===== GFS URL =====
now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
url = f"https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{date}/gfs_0p25_00z"

ds = xr.open_dataset(url)

# ===== 時刻 =====
times = ds.time[:5]  # 最初の5予報時刻のみ

os.makedirs("data", exist_ok=True)

for ti, t in enumerate(times):
    # ===== 気温（850hPa）=====
    tmp = (ds["tmpprs"]
           .sel(lev=850, time=t)
           .load()) - 273.15

    # ===== 風（850hPa）=====
    u = ds["ugrdprs"].sel(lev=850, time=t).load()
    v = ds["vgrdprs"].sel(lev=850, time=t).load()

    lat = ds["lat"].values
    lon = ds["lon"].values

    # lon 0–360 → -180–180
    lon = ((lon + 180) % 360) - 180
    order = np.argsort(lon)
    lon = lon[order]
    tmp = tmp[:, order]
    u = u[:, order]
    v = v[:, order]

    # ===== 等温線 PNG =====
    fig = plt.figure(figsize=(18, 9), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1])

    cf = ax.contourf(lon, lat, tmp, levels=np.arange(-60, 41, 2), cmap="jet")
    ax.contour(lon, lat, tmp, levels=np.arange(-60, 41, 10),
               colors="black", linewidths=0.4)

    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)
    ax.axis("off")

    plt.savefig(f"data/temp_{ti}.png")
    plt.close()

    # ===== 風ベクトル（粒子用JSON）=====
    stride = 6  # ← 重要：間引き
    particles = []

    for i in range(0, len(lat), stride):
        for j in range(0, len(lon), stride):
            particles.append({
                "lat": float(lat[i]),
                "lon": float(lon[j]),
                "u": float(u[i, j]),
                "v": float(v[i, j])
            })

    with open(f"data/wind_{ti}.json", "w") as f:
        json.dump(particles, f)
