import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import json
import os
import datetime

# ===== GFS OPeNDAP =====
now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
url = f"https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{date}/gfs_0p25_00z"

ds = xr.open_dataset(url)

# 最初の5予報時刻のみ使用
times = ds.time[:5]

# 使用する高度（hPa）
levels = [850, 700, 500]

# 出力ルート
BASE_DIR = "data"

for lev in levels:
    outdir = f"{BASE_DIR}/{lev}"
    os.makedirs(outdir, exist_ok=True)

    for ti, t in enumerate(times):
        print(f"level={lev} time={ti}")

        # ===== 気温（℃）=====
        tmp = (
            ds["tmpprs"]
            .sel(lev=lev, time=t)
            .load()
        ) - 273.15

        # ===== 風（m/s）=====
        u = ds["ugrdprs"].sel(lev=lev, time=t).load()
        v = ds["vgrdprs"].sel(lev=lev, time=t).load()

        lat = ds["lat"].values
        lon = ds["lon"].values

        # lon 0–360 → -180–180
        lon = ((lon + 180) % 360) - 180
        order = np.argsort(lon)
        lon = lon[order]
        tmp = tmp[:, order]
        u = u[:, order]
        v = v[:, order]

        # ===== 等温線PNG生成 =====
        fig = plt.figure(figsize=(18, 9), dpi=150)
        ax = fig.add_axes([0, 0, 1, 1])

        levels_cf = np.arange(-60, 41, 2)
        levels_cl = np.arange(-60, 41, 10)

        ax.contourf(lon, lat, tmp, levels=levels_cf, cmap="jet")
        ax.contour(
            lon, lat, tmp,
            levels=levels_cl,
            colors="black",
            linewidths=0.4
        )

        ax.set_xlim(-180, 180)
        ax.set_ylim(-90, 90)
        ax.axis("off")

        plt.savefig(f"{outdir}/temp_{ti}.png")
        plt.close()

        # ===== 風粒子JSON生成 =====
        stride = 6  # 間引き（重要）
        particles = []

        for i in range(0, len(lat), stride):
            for j in range(0, len(lon), stride):
                particles.append({
                    "lat": float(lat[i]),
                    "lon": float(lon[j]),
                    "u": float(u[i, j]),
                    "v": float(v[i, j])
                })

        with open(f"{outdir}/wind_{ti}.json", "w", encoding="utf-8") as f:
            json.dump(particles, f, ensure_ascii=False)

print("GFS asset generation completed.")
