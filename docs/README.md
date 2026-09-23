# CropFit — Smart Greenhouse IoT Platform

CropFit is an integrated IoT ecosystem for smart greenhouse management. It consists of a Django cloud backend, a FastAPI edge gateway running on Raspberry Pi, and a Next.js web dashboard.

## 🚀 Getting Started

### 1. Cloud Backend (Django)
The backend manages the centralized data, user authentication, and long-term history.

**Requirements:** Python 3.12+

**Installation:**
```bash
# Navigate to project root
cd CropFit

# Install dependencies (using uv)
uv sync

# Or using pip
pip install -e .
```

**Database Setup:**
```bash
cd backend
python manage.py migrate
python manage.py createsuperuser
```

**Running the Server:**
```bash
python manage.py runserver
```

---

### 2. Edge Gateway (FastAPI on Raspberry Pi)
The edge gateway runs locally in the greenhouse on a Raspberry Pi, ingesting sensor data and controlling actuators via MQTT.

**Requirements:** Python 3.10+

**Installation:**
```bash
# Navigate to edge directory
cd edge

# Install requirements
pip install -r requirements.txt
```

**Running the Edge API:**
```bash
# Start from the edge directory
# The main entry point is api.main
python -m uvicorn api.main:app --host 0.0.0.0 --port 8000
```
*Note: Ensure your local MQTT broker (Mosquitto) is running.*

---

### 3. Web Dashboard (Next.js)
Modern frontend for monitoring and controlling the greenhouse fleet.

**Requirements:** Node.js 18+

**Installation:**
```bash
cd web
npm install
```

**Running the Dashboard:**
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⚙️ Configuration

### Backend (`backend/.env`)
Ensure you have the following in your backend environment file:
```env
DEBUG=True
SECRET_KEY=your-secret-key
DATABASE_URL=sqlite:///db.sqlite3
```

### Edge Gateway (`edge/.env`)
The edge gateway needs to know how to reach the cloud backend and the local MQTT broker:
```env
NODE_ID=pi-edge-hub-01
GREENHOUSE_ID=greenhouse-01
CLOUD_BACKEND_URL=http://<backend-ip>:8000
MQTT_HOST=127.0.0.1
MQTT_PORT=1883
```

### Frontend (`web/.env.local`)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
```

## 🛠️ Project Structure
- `/backend`: Django REST Framework application.
- `/edge`: FastAPI gateway, ingestion services, and MQTT dispatchers.
- `/web`: Next.js / Tailwind CSS dashboard.
- `/firmware`: ESP32 C++/Arduino code for sensors and actuators.
- `/docs`: Implementation plans and task tracking.
