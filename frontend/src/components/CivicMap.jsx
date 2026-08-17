import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useCivic } from "../context/CivicContext";

function CivicMap() {
  const mapRef = useRef(null);
  const { issues } = useCivic();

  useEffect(() => {
    // If map instance does not exist, initialize it
    if (!mapRef.current) {
      const map = L.map("civora-map").setView([23.5, 85.5], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(map);
      mapRef.current = map;
    }

    const map = mapRef.current;

    // Clear previous markers
    map.eachLayer((layer) => {
      if (layer instanceof L.CircleMarker || layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const displayIssues = (issues && issues.length > 0) ? issues : [
      {
        lat: 23.3441,
        lng: 85.3096,
        title: "Major Road Pothole",
        category: "Road",
        priority: "High",
        upvotes: 50,
        assignedDepartment: "Road Department",
      },
      {
        lat: 23.3567,
        lng: 85.3347,
        title: "Garbage Accumulation",
        category: "Waste",
        priority: "High",
        upvotes: 31,
        assignedDepartment: "Sanitation Department",
      },
      {
        lat: 22.8046,
        lng: 86.2029,
        title: "Broken Streetlights",
        category: "Streetlight",
        priority: "Medium",
        upvotes: 12,
        assignedDepartment: "Electrical Department",
      }
    ];

    displayIssues.forEach((issue) => {
      const lat = issue.lat || 23.3441;
      const lng = issue.lng || 85.3096;

      let markerColor = "#087443";
      if (issue.priority === "Critical") markerColor = "#d32f2f";
      else if (issue.priority === "High") markerColor = "#f57c00";
      else if (issue.priority === "Medium") markerColor = "#d4a000";

      const marker = L.circleMarker([lat, lng], {
        radius: 11,
        fillColor: markerColor,
        color: "#ffffff",
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      });

      marker.addTo(map);

      marker.bindPopup(`
        <div class="map-popup">
          <h3>${issue.title || "Civic Issue"}</h3>
          <p><strong>ID:</strong> ${issue.id || "CIV-101"}</p>
          <p><strong>Category:</strong> ${issue.categoryLabel || issue.category || "General"}</p>
          <p><strong>Priority:</strong> <span style="color:${markerColor};font-weight:bold;">${issue.priority}</span></p>
          <p><strong>Status:</strong> ${issue.status || "Reported"}</p>
          <p><strong>Citizen Support:</strong> ${issue.upvotes || 1} Citizens</p>
          <p><strong>Department:</strong> ${issue.assignedDepartment || "General Municipal"}</p>
        </div>
      `);
    });

  }, [issues]);

  return <div id="civora-map" className="civic-map" />;
}

export default CivicMap;