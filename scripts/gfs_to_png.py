import xarray as xr
import matplotlib.pyplot as plt

ds = xr.open_dataset("temp850.nc")

# 気温（℃）
tmp = ds["TMP_850mb"][0] - 273.15

lats = ds["latitude"].values
lons = ds["longitude"].values

plt.figure(figsize=(18, 9))

plt.pcolormesh(
    lons,
    lats,
    tmp,
    cmap="jet",
    shading="auto"
)

plt.colorbar(label="850hPa Temperature (°C)")
plt.title("GFS 850hPa Temperature")
plt.xlabel("Longitude")
plt.ylabel("Latitude")

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
