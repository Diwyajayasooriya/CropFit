# 🌾 CropFit - Smart Agriculture System

**CropFit** is an intelligent smart agriculture system that analyzes soil suitability for selected crops and provides fertilizer recommendations to optimize crop growth and improve agricultural productivity.

The platform stands out through its **AI-powered soil analysis engine**, which evaluates multiple soil parameters and matches them with optimal crop requirements, and an **intelligent fertilizer recommendation system** that generates precise nutrient formulas based on soil deficiencies.

---

## ✨ Features

### AI-Powered Soil Analysis
- **Multi-parameter evaluation** — Analyzes pH, Nitrogen (N), Phosphorus (P), Potassium (K), moisture, temperature, and rainfall
- **Deficit detection** — Identifies specific nutrient deficiencies in soil
- **Soil health scoring** — Overall soil quality index calculation

### Crop Suitability Matching
- **20+ crop database** — Includes rice, wheat, maize, cotton, sugarcane, pulses, vegetables, and fruits
- **Viability scoring** — Percentage match between soil conditions and crop requirements
- **Ranked recommendations** — Top 5 most suitable crops for given soil

### Fertilizer Recommendation Engine
- **N-P-K formula generation** — Precise nutrient recommendations in kg/acre
- **Product suggestions** — Specific fertilizer products (DAP, MOP, Urea, NPK complexes)
- **Application timing** — When and how to apply fertilizers
- **Organic alternatives** — Compost, green manure, and bio-fertilizer suggestions

### Smart Crop Rotation Planner
- **Season-based planning** — Kharif, Rabi, and Zaid season recommendations
- **Soil depletion prevention** — Crop rotation sequences to maintain soil health
- **Inter-cropping suggestions** — Compatible crop pairs for mixed farming

### Cost & Yield Estimation
- **Input cost calculation** — Fertilizer, seed, and labor costs per acre
- **Expected yield prediction** — Estimated output based on soil conditions
- **Profitability analysis** — ROI calculation for recommended crops

### Report Generation
- **PDF reports** — Downloadable detailed analysis
- **Vernacular language support** — Regional language reports (Hindi, Marathi, Telugu, etc.)
- **SMS integration** — Send recommendations directly to farmers' phones

---

## 🏗️ System Modules

| Module | Description |
|--------|-------------|
| **Soil Analyzer** | Input and analyze soil parameters with deficit detection |
| **Crop Matcher** | Match soil data with crop requirements and rank suitability |
| **Fertilizer Engine** | Generate precise N-P-K recommendations and product suggestions |
| **Crop Rotator** | Seasonal crop planning and rotation sequences |
| **Cost Calculator** | Estimate input costs, expected yield, and profitability |
| **Report Generator** | Create PDF reports and vernacular language summaries |
| **User Profile** | Manage farms, save analyses, and track history |

---

## 🎯 Target Users

| User Type | Primary Need |
|-----------|--------------|
| **Small-scale farmers** | Affordable, accessible crop and fertilizer guidance |
| **Commercial farmers** | Yield optimization and cost reduction strategies |
| **Agricultural extension officers** | Data-driven advice for multiple farmers |
| **Agri-startups** | Integration into farm management platforms |
| **Students & researchers** | Soil-crop relationship studies |

---

## 📊 Crop Database (Sample)

| Crop | Season | Ideal pH | N (kg/ha) | P (kg/ha) | K (kg/ha) | Temp (°C) | Rainfall (mm) |
|------|--------|----------|-----------|-----------|-----------|-----------|---------------|
| Rice | Kharif | 5.5-6.5 | 80-120 | 40-60 | 40-60 | 20-35 | 100-200 |
| Wheat | Rabi | 6.0-7.5 | 100-150 | 50-70 | 40-60 | 12-25 | 75-100 |
| Maize | Kharif | 5.5-7.0 | 120-180 | 60-80 | 40-60 | 18-27 | 50-100 |
| Cotton | Kharif | 6.0-7.5 | 80-120 | 40-60 | 60-80 | 21-30 | 50-100 |
| Sugarcane | Spring | 6.0-7.5 | 150-200 | 60-80 | 100-150 | 20-30 | 100-150 |
| Soybean | Kharif | 6.0-7.0 | 20-40 | 40-60 | 80-120 | 20-30 | 60-100 |
| Potato | Rabi | 5.0-6.5 | 150-200 | 60-80 | 100-150 | 15-20 | 50-75 |
| Tomato | Summer | 6.0-7.0 | 100-150 | 50-70 | 100-150 | 20-25 | 40-60 |
| Onion | Rabi | 6.0-7.0 | 80-120 | 40-60 | 50-80 | 13-25 | 35-50 |
| Groundnut | Kharif | 5.5-7.0 | 20-30 | 40-60 | 30-50 | 25-30 | 50-75 |
| Chickpea | Rabi | 6.0-7.5 | 20-30 | 40-60 | 20-40 | 15-25 | 60-90 |
| Mustard | Rabi | 6.0-7.5 | 60-100 | 30-50 | 20-40 | 10-20 | 40-60 |

*Complete database includes 20+ crops with detailed parameters*

---

## 💻 Tech Stack

| Layer | Technology | Status | Justification |
|-------|------------|--------|----------------|
| **Frontend** | Next.js / React Native | ✅ Selected | Web & mobile with code reuse |
| **Backend API** | Python + FastAPI | ✅ Selected | Async support, ML library compatibility |
| **AI/ML Engine** | TensorFlow / PyTorch | 🔄 TBD | Soil-crop prediction models |
| **LLM Integration** | LangChain + GPT/Claude | 🔄 TBD | Natural language queries and explanations |
| **Database** | PostgreSQL + PostGIS | ✅ Selected | Spatial data for farm mapping |
| **Vector Search** | pgVector | ✅ Selected | Semantic crop similarity search |
| **Cache** | Redis | ✅ Selected | Fast repeated queries |
| **Deployment** | Vercel (Web) / AWS (Backend) | 🔄 TBD | Auto-scaling requirements |

## 📱 Usage Flow

### 1️⃣ Input Soil Parameters

**Manual Input:**
```json
{
  "pH": 6.8,
  "nitrogen": 85,
  "phosphorus": 42,
  "potassium": 38,
  "temperature": 28,
  "humidity": 65,
  "rainfall": 120,
  "soil_type": "Loamy",
  "location": "Punjab, India"
}