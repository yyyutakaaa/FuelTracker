# FuelTracker - Brandstofkosten Calculator

Een moderne Progressive Web App (PWA) voor het berekenen van brandstofkosten voor reizen in België en Nederland. Met real-time adressuggesties, actuele brandstofprijzen en uitgebreide routeplanning.

![FuelTracker](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![PWA](https://img.shields.io/badge/PWA-ready-orange)

## ✨ Kenmerken

### 🚗 Core Functionaliteit
- **Real-time Adres Autocomplete**: Vind adressen terwijl u typt met OpenStreetMap Nominatim
- **Actuele Brandstofprijzen**: Meerdere databronnen met 24-uurs caching
- **Routeplanning & Visualisatie**: Interactieve kaart met Leaflet
- **Kostenberekening**: Nauwkeurige berekening op basis van afstand, verbruik en brandstoftype
- **CO₂ Uitstoot Tracking**: Bereken de milieu-impact van uw reis

### 📊 Data & Analytics
- **Ritgeschiedenis**: Bewaar al uw berekeningen lokaal
- **Statistieken Dashboard**: Visualiseer kosten en afstanden met Chart.js
- **CSV Export**: Exporteer uw geschiedenis voor verdere analyse
- **Favoriete Routes**: Sla veelgebruikte routes op

### 🎨 UI/UX
- **Dark/Light Mode**: Automatisch of handmatig wisselen
- **Responsive Design**: Werkt perfect op desktop, tablet en mobiel
- **Offline Support**: Werkt zonder internetverbinding na eerste gebruik
- **Nederlandse Interface**: Volledig gelokaliseerd

## 🚀 Installatie

### Online Gebruik
Bezoek de applicatie direct via uw browser. De app werkt als PWA en kan geïnstalleerd worden.

### Lokale Installatie

1. Clone de repository:
```bash
git clone https://github.com/yourusername/FuelTracker.git
cd FuelTracker
```

2. Start een lokale webserver:
```bash
# Met Python
python -m http.server 8000

# Of met Node.js
npx http-server -p 8000

# Of met PHP
php -S localhost:8000
```

3. Open in browser:
```
http://localhost:8000
```

## 📱 PWA Installatie

### Desktop (Chrome/Edge)
1. Bezoek de applicatie
2. Klik op het installatie-icoon in de adresbalk
3. Volg de installatie-instructies

### Mobiel (Android)
1. Open de app in Chrome
2. Tap op "Toevoegen aan startscherm"
3. De app verschijnt als native app

### iOS
1. Open in Safari
2. Tap het "Deel" icoon
3. Kies "Zet op beginscherm"

## 🛠️ Technologieën

- **Frontend Framework**: Vue.js 3
- **Styling**: Tailwind CSS
- **Kaarten**: Leaflet met OpenStreetMap
- **Grafieken**: Chart.js
- **Icons**: Font Awesome
- **PWA**: Service Worker met offline caching

## 📋 Gebruik

### Basis Berekening
1. Voer uw vertrekpunt in (autocomplete helpt)
2. Voer uw bestemming in
3. Vul uw brandstofverbruik in (L/100km)
4. Selecteer brandstoftype
5. Klik "Bereken Route & Kosten"

### Geavanceerde Features
- **Geschiedenis**: Bekijk al uw eerdere berekeningen
- **Statistieken**: Analyseer uw brandstofuitgaven over tijd
- **Export**: Download uw data als CSV
- **Dark Mode**: Toggle via het maan/zon icoon

## 🔧 Configuratie

### Brandstofprijzen
De app haalt prijzen van meerdere bronnen:
1. Belgische StatBel API (primair)
2. Alternatieve bronnen (secundair)
3. Fallback prijzen (laatste optie)

### API Endpoints
- **Geocoding**: OpenStreetMap Nominatim
- **Routing**: OSRM Project
- **Fuel Prices**: StatBel België

## 🤝 Bijdragen

Bijdragen zijn welkom! 

1. Fork het project
2. Maak een feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit uw wijzigingen (`git commit -m 'Add AmazingFeature'`)
4. Push naar de branch (`git push origin feature/AmazingFeature`)
5. Open een Pull Request

## 📝 Licentie

Dit project is gelicenseerd onder de MIT License - zie het [LICENSE](LICENSE) bestand voor details.

## 🐛 Bekende Problemen

- CORS beperkingen voor sommige brandstofprijs APIs
- Service Worker vereist HTTPS in productie
- iOS Safari heeft beperkingen voor PWA functionaliteit

## 📞 Contact

Voor vragen of suggesties:
- Open een issue op GitHub
- Email: [your-email@example.com]

## 🙏 Credits

- OpenStreetMap voor geocoding en kaartdata
- OSRM Project voor routing
- StatBel voor brandstofprijzen
- Alle open source libraries gebruikt in dit project

---

**Gemaakt met ❤️ voor Belgische en Nederlandse automobilisten**