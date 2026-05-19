# 🌾 CropFit — Smart Agriculture Intelligence Platform

> **IoT-powered precision agriculture**: real-time soil, air & weather sensing → AI-driven crop recommendations, yield forecasting, disease prediction, and productivity analytics.

---

## 📖 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [IoT Device Layer](#iot-device-layer)
- [AI/ML Capabilities](#aiml-capabilities)
- [Crop Database](#crop-database)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**CropFit** is an end-to-end smart agriculture platform that bridges IoT field sensing with AI-powered agronomic intelligence. IoT devices deployed in the field continuously capture soil composition, ambient air quality, and weather conditions. This real-time data feeds an AI engine that recommends the most suitable crops, predicts potential plant diseases, forecasts yield timelines, and prescribes the precise nutrients or interventions needed to maximize productivity.

The platform is designed for small-scale farmers, commercial agri-enterprises, extension officers, and agricultural researchers — making data-driven farming accessible at every scale.

---

## Key Features

### 📡 IoT Sensing & Data Collection
- **Soil sensors** — pH, Nitrogen (N), Phosphorus (P), Potassium (K), moisture, electrical conductivity
- **Air sensors** — temperature, humidity, CO₂ levels, ambient light
- **Weather integration** — rainfall accumulation, wind speed, barometric pressure (on-device + API enrichment)
- **Continuous streaming** — MQTT-based real-time data pipeline from field devices to cloud
- **Multi-device farm support** — manage and correlate data across multiple IoT nodes per farm

### 🌱 Crop Suitability Matching
- **20+ crop database** — rice, wheat, maize, cotton, sugarcane, pulses, vegetables, fruits, and more
- **Viability scoring** — percentage match between live sensor readings and crop-optimal ranges
- **Ranked recommendations** — top 5 most suitable crops with confidence scores
- **Season-aware** — Kharif, Rabi, and Zaid season filtering

### 💊 Fertilizer & Nutrient Recommendation Engine
- **N-P-K formula generation** — precise nutrient prescriptions in kg/acre
- **Deficit detection** — pinpoints exactly which nutrients are lacking
- **Product suggestions** — specific fertilizer products (DAP, MOP, Urea, NPK complexes)
- **Application scheduling** — when and how to apply fertilizers across growth stages
- **Organic alternatives** — compost, green manure, and bio-fertilizer suggestions

### 🦠 Plant Disease Prediction
- **Condition-based risk assessment** — flags disease-prone environments based on humidity, temperature, and crop type
- **Disease library** — known pathogens, symptoms, and prevention mapped per crop
- **Early warning alerts** — notifications when conditions approach disease-triggering thresholds
- **Treatment suggestions** — chemical and organic intervention recommendations

### 📈 Yield Forecasting & Statistical Analysis
- **Yield timeline** — stage-by-stage growth projection (germination → harvest)
- **Productivity prediction** — estimated output (tons/acre) based on current soil and climate conditions
- **Historical trend analysis** — compare current season against past cycles
- **Profitability dashboard** — input costs vs. expected revenue, ROI per crop

### 🔄 Crop Rotation Planner
- **Season-based planning** — intelligent rotation sequences across Kharif / Rabi / Zaid
- **Soil depletion prevention** — sequences that replenish depleted nutrients naturally
- **Inter-cropping suggestions** — compatible crop pairs for mixed farming

### 📊 Reports & Alerts
- **PDF reports** — downloadable detailed field analysis
- **SMS/push alerts** — real-time notifications for anomalies and disease warnings
- **Vernacular language support** — reports in sinhala, tamil and more
- **Dashboard analytics** — charts and heatmaps for farm managers

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIELD LAYER (IoT)                        │
│   [Soil Sensors]  [Air Sensors]  [Weather Station]  [Camera]   │
│              ↓           ↓              ↓               ↓       │
│         ESP32 / Raspberry Pi Node (Edge Processing)             │
└───────────────────────────┬─────────────────────────────────────┘
                            │ MQTT / HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                      CLOUD / BACKEND                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐ │
│  │  IoT Gateway │  │  FastAPI     │  │   AI/ML Engine        │ │
│  │  (MQTT       │→ │  REST API    │→ │   - Crop Matcher      │ │
│  │   Broker)    │  │              │  │   - Disease Predictor │ │
│  └──────────────┘  └──────┬───────┘  │   - Yield Forecaster  │ │
│                           │          │   - Fertilizer Engine │ │
│  ┌──────────────┐  ┌──────▼───────┐  └───────────────────────┘ │
│  │  Redis Cache │  │  PostgreSQL  │                             │
│  │              │  │  + PostGIS   │  ┌───────────────────────┐ │
│  └──────────────┘  │  + pgVector  │  │   LLM Layer (Claude)  │ │
│                    └──────────────┘  │   Natural language    │ │
│                                      │   Q&A & explanations  │ │
└──────────────────────────────────────┴───────────────────────┬──┘
                                                               │
┌──────────────────────────────────────────────────────────────▼──┐
│                     CLIENT LAYER                                 │
│   [Next.js Web App]          [React Native Mobile App]          │
│   - Farmer Dashboard         - Field data on-the-go             │
│   - Analytics & Reports      - SMS / Push Alerts                │
│   - Admin Console            - Offline mode (PWA)               │
└─────────────────────────────────────────────────────────────────┘
```

---

## IoT Device Layer

### Supported Hardware

| Component | Options | Measures |
|-----------|---------|----------|
| **Microcontroller** | ESP32, Raspberry Pi 4 | — |
| **Soil NPK Sensor** | RS-485 NPK Sensor Module | N, P, K (mg/kg) |
| **Soil pH Sensor** | Analog pH probe + ADC | pH (0–14) |
| **Soil Moisture** | Capacitive Moisture Sensor v2.0 | % volumetric water content |
| **Temperature & Humidity** | DHT22 / SHT31 | °C, % RH |
| **Rain Gauge** | From Wether reports | mm accumulation |
| **Air Quality** | MQ-135 | CO₂, NH₃ ppm |
| **Camera (optional)** | OV2640 / Pi Camera | Leaf disease imaging |

### Data Flow
```
Sensor → ESP32 (edge filtering) → MQTT Broker → IoT Gateway → TimescaleDB / PostgreSQL
```

Devices publish readings every **5 minutes** (configurable). Edge firmware performs basic outlier filtering before transmission to reduce noise.

---

## AI/ML Capabilities

| Model | Task | Approach |
|-------|------|----------|
| **Crop Suitability Model** | Score crops against soil & climate | Rule-based + ML regression |
| **Fertilizer Recommender** | N-P-K deficit → prescription | Lookup table + optimization |
| **Disease Risk Predictor** | Environmental conditions → disease probability | Classification model |
| **Yield Forecaster** | Soil + weather → harvest estimate | Time-series regression |
| **LLM Layer** | Natural language Q&A, report narration | Claude API (LangChain) |

Training data sources: public agronomic datasets (ICAR, FAO, USDA), synthetic augmentation, and user-contributed field records.

---

## Crop Database

| Crop | Season | Ideal pH | N (kg/ha) | P (kg/ha) | K (kg/ha) | Temp (°C) | Rainfall (mm) |
|------|--------|----------|-----------|-----------|-----------|-----------|---------------|
| Rice | Kharif | 5.5–6.5 | 80–120 | 40–60 | 40–60 | 20–35 | 100–200 |
| Wheat | Rabi | 6.0–7.5 | 100–150 | 50–70 | 40–60 | 12–25 | 75–100 |
| Maize | Kharif | 5.5–7.0 | 120–180 | 60–80 | 40–60 | 18–27 | 50–100 |
| Cotton | Kharif | 6.0–7.5 | 80–120 | 40–60 | 60–80 | 21–30 | 50–100 |
| Sugarcane | Spring | 6.0–7.5 | 150–200 | 60–80 | 100–150 | 20–30 | 100–150 |
| Soybean | Kharif | 6.0–7.0 | 20–40 | 40–60 | 80–120 | 20–30 | 60–100 |
| Potato | Rabi | 5.0–6.5 | 150–200 | 60–80 | 100–150 | 15–20 | 50–75 |
| Tomato | Summer | 6.0–7.0 | 100–150 | 50–70 | 100–150 | 20–25 | 40–60 |
| Onion | Rabi | 6.0–7.0 | 80–120 | 40–60 | 50–80 | 13–25 | 35–50 |
| Groundnut | Kharif | 5.5–7.0 | 20–30 | 40–60 | 30–50 | 25–30 | 50–75 |
| Chickpea | Rabi | 6.0–7.5 | 20–30 | 40–60 | 20–40 | 15–25 | 60–90 |
| Mustard | Rabi | 6.0–7.5 | 60–100 | 30–50 | 20–40 | 10–20 | 40–60 |

> Full database: 20+ crops with disease profiles, rotation compatibility, and yield benchmarks.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | Web application (SSR + PWA) |
| **React Native (Expo)** | Cross-platform mobile app |
| **Tailwind CSS** | Styling |
| **Recharts / D3.js** | Analytics dashboards and charts |

### Backend
| Technology | Purpose |
|------------|---------|
| **Python 3.11 + FastAPI** | Core REST API (async, high-performance) |
| **Pydantic v2** | Request/response validation |
| **Celery + Redis** | Background jobs (report generation, alert dispatch) |
| **MQTT (Mosquitto)** | IoT device message broker |

### AI / ML
| Technology | Purpose |
|------------|---------|
| **scikit-learn / XGBoost** | Crop suitability, disease, and yield models |
| **TensorFlow / PyTorch** | Deep learning for image-based disease detection (planned) |
| **LangChain + Claude API** | LLM-powered natural language Q&A and report narration |
| **pgVector** | Semantic crop similarity search |

### Data & Infrastructure
| Technology | Purpose |
|------------|---------|
| **PostgreSQL + PostGIS** | Primary database with spatial farm mapping |
| **TimescaleDB** | Time-series IoT sensor data |
| **Redis** | Caching and Celery broker |
| **AWS IoT Core** | Managed MQTT at scale (production) |
| **Vercel** | Web frontend deployment |
| **AWS (ECS / Lambda)** | Backend and ML inference deployment |

### IoT Firmware
| Technology | Purpose |
|------------|---------|
| **Arduino / MicroPython** | ESP32 sensor firmware |
| **Python** | Raspberry Pi gateway scripts |
| **MQTT** | Device-to-cloud communication protocol |

---

## Project Structure

```
cropfit/
├── firmware/                   # IoT device code
│   ├── esp32/                  # Arduino sketches for ESP32 sensors
│   └── rpi-gateway/            # Raspberry Pi MQTT gateway scripts
│
├── backend/                    # Python FastAPI server
│   ├── app/
│   │   ├── api/                # Route handlers
│   │   ├── models/             # Database models (SQLAlchemy)
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # Business logic
│   │   │   ├── crop_matcher.py
│   │   │   ├── fertilizer_engine.py
│   │   │   ├── disease_predictor.py
│   │   │   └── yield_forecaster.py
│   │   ├── ml/                 # ML model training & inference
│   │   └── core/               # Config, DB connections, MQTT client
│   ├── tests/
│   └── requirements.txt
│
├── web/                        # Next.js web application
│   ├── app/
│   │   ├── dashboard/
│   │   ├── crops/
│   │   ├── reports/
│   │   └── settings/
│   ├── components/
│   └── package.json
│
├── mobile/                     # React Native (Expo) app
│   ├── screens/
│   ├── components/
│   └── package.json
│
├── ml/                         # ML model notebooks & training scripts
│   ├── datasets/
│   ├── notebooks/
│   └── models/
│
├── docs/                       # Architecture diagrams, API docs
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **Docker & Docker Compose**
- **PostgreSQL** 15+ (or use Docker)
- **Redis** 7+ (or use Docker)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/cropfit.git
cd cropfit
```

### 2. Start Infrastructure (Docker)

```bash
docker-compose up -d postgres redis mosquitto
```

### 3. Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Apply database migrations
alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

### 4. Web Frontend Setup

```bash
cd web
npm install
npm run dev
# Opens at http://localhost:3000
```

### 5. Mobile App Setup

```bash
cd mobile
npm install
npx expo start
```

### 6. IoT Firmware (ESP32)

1. Open `firmware/esp32/` in Arduino IDE or PlatformIO.
2. Update `config.h` with your Wi-Fi credentials and MQTT broker address.
3. Flash to your ESP32 device.

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cropfit

# Redis
REDIS_URL=redis://localhost:6379

# MQTT Broker
MQTT_BROKER_HOST=localhost
MQTT_BROKER_PORT=1883

# AI / LLM
ANTHROPIC_API_KEY=your_anthropic_api_key

# Weather API (for enrichment)
OPENWEATHER_API_KEY=your_openweather_api_key

# AWS (production)
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1

# Notifications
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

---

## API Overview

Base URL: `http://localhost:8000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/soil/analyze` | Analyze soil parameters and get deficits |
| `GET` | `/crops/recommend` | Get ranked crop recommendations |
| `POST` | `/fertilizer/recommend` | Get N-P-K fertilizer prescription |
| `GET` | `/disease/risk` | Disease risk assessment for a crop |
| `GET` | `/yield/forecast` | Yield and harvest timeline prediction |
| `GET` | `/rotation/plan` | Seasonal crop rotation plan |
| `POST` | `/reports/generate` | Generate PDF report |
| `GET` | `/iot/devices` | List registered IoT devices |
| `GET` | `/iot/readings/{device_id}` | Latest sensor readings from a device |

Interactive API docs available at `http://localhost:8000/docs` (Swagger UI).

---

## Roadmap

### Phase 1 — Foundation ✅ (In Progress)
- [x] Project scaffolding and repository setup
- [ ] IoT firmware for ESP32 soil & air sensors
- [ ] MQTT ingestion pipeline
- [ ] Core FastAPI backend with PostgreSQL
- [ ] Crop suitability matching engine
- [ ] Basic Next.js dashboard

### Phase 2 — AI Core
- [ ] Fertilizer recommendation engine
- [ ] Disease risk prediction model
- [ ] Yield forecasting model
- [ ] LLM-powered natural language Q&A (Claude integration)
- [ ] PDF report generation

### Phase 3 — Mobile & Alerts
- [ ] React Native mobile app
- [ ] Push notification and SMS alert system
- [ ] Vernacular language report support
- [ ] Offline mode (PWA + mobile)

### Phase 4 — Scale & Intelligence
- [ ] Image-based plant disease detection (camera module)
- [ ] Multi-farm management for extension officers
- [ ] Marketplace integration for fertilizer ordering
- [ ] Satellite imagery integration (NDVI)
- [ ] Federated learning across farm nodes

---

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature-name`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push to the branch: `git push origin feature/your-feature-name`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for our code of conduct and detailed guidelines.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgements

- [ICAR (Indian Council of Agricultural Research)](https://icar.org.in/) — agronomic data references
- [FAO (Food and Agriculture Organization)](https://www.fao.org/) — global crop datasets
- [Anthropic Claude](https://www.anthropic.com/) — LLM integration for natural language features

---

<div align="center">
  <strong>Built to empower farmers with the intelligence of data 🌱</strong><br/>
  <sub>CropFit — where IoT meets agronomic AI</sub>
</div>
