import L from "leaflet";

const pawSvg = (color: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="22" height="22">
  <path d="M12 13.5c-2.5 0-6 2-6 4.5 0 1.5 1.2 2.5 2.7 2.5.9 0 1.6-.4 2.3-.9.4-.3.7-.5 1-.5s.6.2 1 .5c.7.5 1.4.9 2.3.9 1.5 0 2.7-1 2.7-2.5 0-2.5-3.5-4.5-6-4.5zM5.5 12a2 2 0 100-4 2 2 0 000 4zM18.5 12a2 2 0 100-4 2 2 0 000 4zM9 8.5a2 2 0 100-4 2 2 0 000 4zM15 8.5a2 2 0 100-4 2 2 0 000 4z"/>
</svg>`;

export const pawIcon = (color: string = "#3b82f6") =>
  L.divIcon({
    className: "petos-paw-marker",
    html: `<div style="filter:drop-shadow(0 1px 3px rgba(0,0,0,.4))">${pawSvg(color)}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
