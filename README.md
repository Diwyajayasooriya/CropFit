
=======
# 🌱 Smart Greenhouse IoT Hub

An **edge-computing-based IoT Hub** that solves connectivity, orchestration, and automation problems in smart greenhouses — enabling low-latency, offline-resilient control of irrigation, ventilation, and lighting.

---

## 📖 Overview

Greenhouses today face three recurring problems as they scale up their IoT infrastructure:

1. **Unstable connectivity** in large, metal-framed structures
2. **Fragmented device orchestration** across multiple vendors/protocols
3. **Static, inefficient automation** that can't react to real-time conditions

The **Smart Greenhouse IoT Hub** solves all three through a single on-site device — the **Hub** — that acts as an **edge gateway**, performing local data aggregation, device orchestration, and AI inference directly inside the greenhouse, without depending on constant cloud round-trips.

---

## 🧠 Edge Computing Architecture

This project is architected as an **edge computing system**, not a purely cloud-dependent one.

- **Edge Nodes** — every sensor/actuator in the greenhouse generates data at the point of use.
- **Edge Gateway (the Hub)** — sits physically inside the greenhouse; performs local aggregation, control-loop execution, and (Phase 3) AI inference on-site.
- **Cloud Layer** — reserved for long-term storage, heavier model training, remote access, and cross-greenhouse analytics.

This split keeps time-critical decisions fast and functional even when internet connectivity is unstable — a common condition in rural/agricultural settings.

### Why Edge Computing Matters Here

| Benefit | Description |
|---|---|
| ⚡ Low latency | Control actions (opening a vent, triggering irrigation) happen on-site in milliseconds |
| 🌐 Offline resilience | The greenhouse keeps functioning during internet outages since core logic runs on the Hub |
| 💰 Reduced bandwidth/cloud cost | Only aggregated/important data syncs to the cloud, not every raw reading |
| 📈 Scalability | Adding more edge nodes doesn't overload a central cloud service |

---

## 🚀 Three-Phase Problem & Solution Summary

| Phase | Problem | Solution | Edge Role |
|---|---|---|---|
| **Phase 1 — Connectivity** | Weak, uneven wireless signal across large/metal-framed greenhouses causes devices to disconnect or respond unreliably | Hub acts as an on-site signal booster/repeater and load-balances device connections across itself | Local edge access point, keeping device links stable without depending on external network strength |
| **Phase 2 — Orchestration** | Devices from different manufacturers require separate apps/protocols, making monitoring and scheduling fragmented and error-prone | Hub intercepts all device communication and exposes one unified interface to add, monitor, and schedule every device | Local edge server; device control/scheduling logic runs on-site rather than depending on multiple external cloud services |
| **Phase 3 — AI Integration** | Static, manually-set schedules can't adapt to real-time environmental changes, limiting efficiency | AI/automation layer added on top of the Hub that adjusts irrigation, ventilation, and lighting based on live sensor data | Edge inference point; automation decisions are made locally and instantly, with cloud used only for model training/updates |

---

## 🛠️ Tech Stack

### Phase 1: Connectivity
- ESP32 / Raspberry Pi-class hub hardware with Wi-Fi mesh/repeater module
- MQTT broker running locally on the Hub for lightweight device messaging
- Dynamic load-balancing logic across connected edge nodes

### Phase 2: Orchestration
- Multi-protocol support: Wi-Fi, BLE, Zigbee
- Local device registry + FastAPI/Node backend on the Hub
- React Native / Next.js dashboard for device onboarding and scheduling

### Phase 3: AI Integration
- Edge inference: TensorFlow Lite / ONNX Runtime running directly on the Hub
- Local rule-engine as a starting point, evolving into ML models (scikit-learn / XGBoost)
- TimescaleDB for historical sensor data; cloud sync for model retraining and analytics
- Optional LLM layer (Claude API) for natural-language insights and recommendations

---

## 🗺️ Five-Phase R&D Plan

| Phase | Focus | Deliverables |
|---|---|---|
| **1. Problem Identification & Literature Review** | Research greenhouse challenges, edge computing, IoT in agriculture; define objectives and scope | Literature review, problem statement, requirements |
| **2. System Design & Connectivity** | Design architecture, UML, hardware selection, MQTT, Wi-Fi/BLE/Zigbee research | Architecture diagrams, prototype connectivity |
| **3. Hub Development & Device Orchestration** | Develop backend, dashboard, device onboarding, scheduling, local database | Working edge hub and dashboard |
| **4. AI Integration & Automation** | Research ML models, implement edge inference, automate irrigation/ventilation/lighting | AI-enabled automation |
| **5. Testing, Evaluation & Deployment** | Performance testing, usability evaluation, cloud sync, documentation, final deployment | Final system, evaluation, thesis/report, presentation |

### 📅 Suggested Timeline

| Weeks | Phase |
|---|---|
| 1–3 | Phase 1 — Problem Identification & Literature Review |
| 4–6 | Phase 2 — System Design & Connectivity |
| 7–10 | Phase 3 — Hub Development & Device Orchestration |
| 11–13 | Phase 4 — AI Integration & Automation |
| 14–16 | Phase 5 — Testing, Evaluation & Deployment |

---

## 📂 Project Structure (suggested)

```
smart-greenhouse-iot-hub/
├── hub/                  # On-device Hub code (edge server)
│   ├── mqtt-broker/
│   ├── device-registry/
│   └── ai-inference/
├── dashboard/            # React Native / Next.js dashboard
├── firmware/             # ESP32 device firmware
├── ml-models/            # Training scripts, exported TFLite/ONNX models
├── docs/                 # Architecture diagrams, literature review, reports
>>>>>>> 7846bbe (Add project README)
└── README.md
```

---

<<<<<<< HEAD
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
=======
## 📌 Domain

`IoT` · `Edge Computing` · `Artificial Intelligence` · `Smart Agriculture`

---

## 📄 License

Add your chosen license here (e.g., MIT).

---

## 🙌 Acknowledgements

Developed as part of an Academic Year 2026 Research & Development project.
