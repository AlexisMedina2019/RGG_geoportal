/* Geoportal EPM: utilidades comunes (Leaflet 1.9 + markercluster) */
const GP = {};

GP.fmt = (v,d) => (v===null||v===undefined||v==="") ? "–" : Number(v).toFixed(d);
GP.esc = s => String(s ?? "–").replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

GP.VIR = ["#440154","#482878","#3e4989","#31688e","#26828e","#1f9e89","#35b779","#6ece58","#b5de2b","#fde725"];
GP.viridis = (t,lo,hi) => {
  const V=GP.VIR, h=x=>[1,3,5].map(i=>parseInt(x.slice(i,i+2),16));
  let x=Math.min(1,Math.max(0,(t-lo)/(hi-lo)))*(V.length-1);
  const i=Math.min(V.length-2,Math.floor(x)), f=x-i, a=h(V[i]), b=h(V[i+1]);
  return "rgb("+a.map((v,k)=>Math.round(v+(b[k]-v)*f)).join(",")+")";
};

GP.map = function(id, batUrl, batBounds){
  const map = L.map(id, { maxZoom:21 });
  const img = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom:21, maxNativeZoom:19, attribution:"Imagen &copy; Esri, Maxar, Earthstar Geographics" }).addTo(map);
  const gray = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
    { maxZoom:21, maxNativeZoom:16, attribution:"&copy; Esri" });
  const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    { maxZoom:21, maxNativeZoom:19, attribution:"&copy; OpenStreetMap contributors" });
  const bat = batUrl ? L.imageOverlay(batUrl, batBounds, { opacity:0.55, attribution:"Batimetría &copy; CONABIO (CC BY-NC 2.5 MX)" }).addTo(map) : null;
  L.control.layers({ "Esri – imagen satelital":img, "Esri – gris claro":gray, "OpenStreetMap":osm }, null, { collapsed:true }).addTo(map);
  L.control.scale({ imperial:false }).addTo(map);
  const on = document.getElementById("batOn"), op = document.getElementById("batOp");
  if (on && bat) on.addEventListener("change", e => e.target.checked ? bat.addTo(map) : map.removeLayer(bat));
  if (op && bat) op.addEventListener("input", e => bat.setOpacity(+e.target.value));
  return map;
};

GP.cluster = () => L.markerClusterGroup({ maxClusterRadius:12, spiderfyOnMaxZoom:true, showCoverageOnHover:false,
  iconCreateFunction: c => L.divIcon({ html:c.getChildCount(), className:"cl" }) });

GP.svgIcon = (shape, fill, size) => {
  size = size || 16; const s=size, h=s/2;
  const g = shape==="tri" ? `<polygon points="${h},1.5 ${s-1.5},${s-2} 1.5,${s-2}"/>`
          : shape==="sq"  ? `<rect x="2" y="2" width="${s-4}" height="${s-4}" rx="1.5"/>`
          : shape==="dia" ? `<polygon points="${h},1 ${s-1},${h} ${h},${s-1} 1,${h}"/>`
          : `<circle cx="${h}" cy="${h}" r="${h-2}"/>`;
  return L.divIcon({ className:"dv", iconSize:[s,s], iconAnchor:[h,h],
    html:`<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><g fill="${fill}" stroke="#111" stroke-width="1.4">${g}</g></svg>` });
};

/* Profundidad CONABIO ± sigma */
GP.depth = p => {
  if (p.prof_conabio_m===null || p.prof_conabio_m===undefined) return "sin dato";
  let s = GP.fmt(p.prof_conabio_m,1) + " ± " + GP.fmt(p.sigma_total_m,1) + " m";
  if (p.prof_min_m!==null && p.prof_min_m!==undefined)
    s += '<br><span style="color:#5d6b7a">rango en radio de ' + GP.fmt(p.incert_pos_m,0) + ' m: ' + GP.fmt(p.prof_min_m,1) + ' a ' + GP.fmt(p.prof_max_m,1) + ' m</span>';
  return s;
};

/* Visor de logs de perforación.
   log = { src, y0, pxcm, wd, title, caption }  (y0 y pxcm en píxeles de la imagen original)
   marks = [{ depth_m, label }]  profundidades bajo el nivel del mar  */
GP.openLog = function(log, marks){
  let lb = document.getElementById("lb");
  if (!lb) {
    lb = document.createElement("div"); lb.id="lb"; lb.className="lb";
    lb.innerHTML = '<div class="box"><button class="close" aria-label="Cerrar">×</button><div class="ttl" style="font-weight:600;margin:0 24px 6px 0"></div><div class="imgwrap"><img alt="Log de perforación"></div><div class="cap"></div></div>';
    document.body.appendChild(lb);
    lb.addEventListener("click", e => { if (e.target===lb || e.target.classList.contains("close")) lb.classList.remove("on"); });
    document.addEventListener("keydown", e => { if (e.key==="Escape") lb.classList.remove("on"); });
  }
  const wrap = lb.querySelector(".imgwrap"), img = wrap.querySelector("img");
  wrap.querySelectorAll(".mk").forEach(m=>m.remove());
  lb.querySelector(".ttl").textContent = log.title || "";
  lb.querySelector(".cap").innerHTML = log.caption || "";
  img.onload = () => {
    const k = img.clientHeight / img.naturalHeight;
    (marks||[]).forEach(m => {
      if (m.depth_m===null || m.depth_m===undefined || log.wd===undefined) return;
      const cm = (Math.abs(m.depth_m) - log.wd) * 100;
      const y = (log.y0 + cm*log.pxcm) * k;
      const d = document.createElement("div"); d.className="mk"; d.style.top = y+"px";
      d.innerHTML = "<span>◂ " + GP.esc(m.label) + "</span>"; wrap.appendChild(d);
    });
  };
  img.src = log.src;
  lb.classList.add("on");
};

/* Modo incrustado (?embed=1): mapa a todo el ancho, panel lateral plegable y enlace a pantalla completa.
   Pensado para las ventanas de Google Sites. */
GP.embed = new URLSearchParams(location.search).has("embed");
if (GP.embed) {
  document.documentElement.classList.add("embed");
  document.addEventListener("DOMContentLoaded", () => {
    const aside = document.querySelector("aside"), app = document.querySelector(".app");
    if (!aside || !app) return;
    const bar = document.createElement("div"); bar.className = "embar";
    const full = location.href.replace(/[?&]embed=1/, "").replace(/\?$/, "");
    bar.innerHTML = '<button type="button" class="eb-info">☰ Filtros y notas</button><a class="eb-full" href="' + full + '" target="_blank" rel="noopener">Pantalla completa ↗</a>';
    app.appendChild(bar);
    bar.querySelector(".eb-info").addEventListener("click", () => aside.classList.toggle("open"));
  });
}
