export function osmEmbedUrl(lat: number, lng: number, delta = 0.008) {
  const bbox = [
    lng - delta,
    lat - delta,
    lng + delta,
    lat + delta,
  ].join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}

type ReportMapProps = {
  lat: number;
  lng: number;
  height?: string;
  title?: string;
};

export function ReportMap({
  lat,
  lng,
  height = "220px",
  title = "OSM map",
}: ReportMapProps) {
  return (
    <div className="space-y-2">
      <iframe
        title={title}
        className="w-full rounded-md border border-[var(--color-border)]"
        style={{ height }}
        src={osmEmbedUrl(lat, lng)}
      />
      <a
        className="inline-block text-sm underline"
        href={`https://www.google.com/maps?q=${lat},${lng}`}
        target="_blank"
        rel="noreferrer"
      >
        Buka di Google Maps
      </a>
    </div>
  );
}
