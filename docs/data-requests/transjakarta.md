# Permohonan akses data GTFS / GTFS-Realtime — Transjakarta

**Kepada:** PT Transportasi Jakarta (c.q. Divisi Teknologi Informasi) dan Dinas Perhubungan
Provinsi DKI Jakarta
**Perihal:** Permohonan akses data GTFS statis dan GTFS-Realtime untuk aplikasi peta publik
**Tanggal:** _(isi saat dikirim)_

Dengan hormat,

Saya <nama>, pengembang aplikasi peta **Jalanin** (https://maps.nizmitz.com) — aplikasi web
gratis, tanpa iklan, dan tanpa pelacakan pengguna yang menampilkan aturan ganjil-genap serta
jaringan angkutan umum Jakarta untuk membantu warga merencanakan perjalanan. Kode sumbernya
terbuka di https://github.com/nizmitz/jalanin.

Saat ini data koridor Transjakarta pada aplikasi kami berasal dari OpenStreetMap, sehingga
posisi halte dan trase dapat berbeda dengan kondisi resmi. Kami memohon akses ke:

1. **GTFS statis** (routes, trips, stops, stop_times, shapes, calendar) — untuk memastikan
   nama halte, trase koridor, dan jadwal yang kami tampilkan sesuai data resmi.
2. **GTFS-Realtime** (`VehiclePositions`, dan bila tersedia `TripUpdates`) — untuk menampilkan
   posisi bus dan perkiraan kedatangan secara langsung.

Komitmen kami:

- Mencantumkan atribusi "Sumber: PT Transportasi Jakarta" pada setiap tampilan data tersebut.
- Mengambil data sesuai batas frekuensi yang Bapak/Ibu tetapkan (mis. 20–30 detik untuk
  realtime) dan melakukan cache di sisi server kami agar beban ke sistem Transjakarta minimal.
- Tidak menjual, menyublisensikan, atau menggunakan data untuk iklan.
- Menandatangani perjanjian penggunaan data (PKS/MoU) bila diperlukan.
- Menghapus data dan menghentikan akses bila sewaktu-waktu diminta.

Detail teknis kami: satu server (IP statis, dapat kami sampaikan) mengambil feed secara
berkala; aplikasi pengguna tidak pernah mengakses sistem Transjakarta secara langsung, sehingga
kredensial tidak tersebar ke publik.

Kami siap berdiskusi lebih lanjut, mengisi formulir permohonan, atau hadir dalam rapat
teknis sesuai prosedur yang berlaku.

Hormat kami,
<nama>
<email> · <telepon>
