import xarray as xr
import numpy as np
import matplotlib.pyplot as plt
import os, datetime, json

now = datetime.datetime.utcnow()
date = now.strftime("%Y%m%d")
url = f"https://nomads.ncep.noaa.gov/dods/gfs_0p25/gfs{date}/gfs_0p25_00z"

ds = xr.open_dataset(url)

levels = [0, 6, 12]  # f000, f006, f012
os.makedirs("data", exist_ok=True)

def edges(arr):
    d = np.diff(arr).mean()
    return np.concatenate(([arr[0]-d/2], arr[:-1]+d/2, [arr[-1]+d/2]))

lat = ds.lat.values
lon = ((ds.lon.values + 180) % 360) - 180
order = np.argsort(lon)
lon = lon[order]

lon_e = edges(lon)
lat_e = edges(lat)

for f in levels:
    t = ds.time[f]

    # ---- 気温 ----
    tmp = ds["tmpprs"].sel(lev=850, time=t) - 273.15
    tmp = tmp[:, order]

    fig = plt.figure(figsize=(18, 9), dpi=150)
    ax = fig.add_axes([0, 0, 1, 1])

    ax.pcolormesh(lon_e, lat_e, tmp, cmap="jet", shading="flat")
    cs = ax.contour(lon, lat, tmp, colors="black", linewidths=0.5,
                    levels=np.arange(-40, 41, 5))
    ax.clabel(cs, fmt="%d")

    ax.set_xlim(-180, 180)
    ax.set_ylim(-90, 90)
    ax.axis("off")

    plt.savefig(f"data/temp_850_f{f:03}.png")
    plt.close()

    # ---- 風（JSON）----
    u = ds["ugrdprs"].sel(lev=850, time=t)[:, order]
    v = ds["vgrdprs"].sel(lev=850, time=t)[:, order]

    wind = []
    for i in range(0, len(lat), 4):
        for j in range(0, len(lon), 4):
            wind.append({
                "lat": float(lat[i]),
                "lon": float(lon[j]),
                "u": float(u[i, j]),
                "v": float(v[i, j])
            })

    with open(f"data/wind_850_f{f:03}.json", "w") as fjson:
        json.dump(wind, fjson)
