<div align="center">

# <h1 style="font-size: 3.5rem; font-weight: 900; letter-spacing: 0.05em;"> CADENCE DYNAMIC REAL TIME AUDIO VISUALIZATION </h1>

<br>

### _Transform Sound into Stunning Visuals Instantly_

<br>

<p>
  <img src="https://img.shields.io/github/last-commit/mouni7781/Cadence-Dynamic-Real-Time-Audio-Visualization-?style=for-the-badge" alt="Last Commit">
  <img src="https://img.shields.io/github/languages/top/mouni7781/Cadence-Dynamic-Real-Time-Audio-Visualization-?style=for-the-badge" alt="Top Language">
  <img src="https://img.shields.io/github/languages/count/mouni7781/Cadence-Dynamic-Real-Time-Audio-Visualization-?style=for-the-badge" alt="Language Count">
</p>

<br>

### Built with the tools and technologies:

<p>
  <img src="https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white" alt="Express.js">
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL">
  <img src="https://img.shields.io/badge/Google_Gemini-8E75C2?style=for-the-badge&logo=googlegemini&logoColor=white" alt="Gemini AI">
  <img src="https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white" alt="Chart.js">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black" alt="JavaScript">
  <img src="https://img.shields.io/badge/Netlify-00C7B7?style=for-the-badge&logo=netlify&logoColor=white" alt="Netlify">
</p>

</div>

---

## 📖 Overview

**Cadence** is a developer toolkit designed to enable immersive, real-time audio visualizations integrated into web applications. It combines scalable serverless deployment, detailed user interaction analytics, and organized media management to streamline media-rich project development.

---

## 📂 Folder Structure

```text
/
├── .netlify/                # Configuration for Netlify hosting
│   └── functions/           # Serverless functions
│       └── api.js           # API logic for serverless function
├── public/                  # Static files visible to the user
│   ├── Assets/              # Images, icons, and SVGs
│   ├── CSS/                 # total.css & mobile.css
│   ├── Fonts/               # Custom font files
│   ├── Songs/               # Audio files and info.json catalogs
│   ├── analytics.html       # Analytics dashboard UI
│   ├── analytics.js         # Analytics frontend script
│   ├── index.html           # Main application HTML
│   └── script.js            # Core application logic
├── server.js                # Main backend server & Gemini AI logic
├── netlify.toml             # Build & deploy settings
├── package.json             # Dependencies and scripts
└── .env                     # Environment variables
```

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+)
* **PostgreSQL Database** (e.g., Neon.tech)
* **Google Gemini API Key**

### Installation

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/mouni7781/Cadence-Dynamic-Real-Time-Audio-Visualization-](https://github.com/mouni7781/Cadence-Dynamic-Real-Time-Audio-Visualization-)
   cd Cadence-Dynamic-Real-Time-Audio-Visualization-
2. **Install dependencies**:
    ```bash
    npm install
3. **Environment Setup**: Create a .env file in the root directory and add your credentials:
    ```Code snippet
    DATABASE_URL=your_postgres_connection_string
    GEMINI_API_KEY=your_google_gemini_key
4. **Database Setup**: Initialize your database by running the migration script or executing the following SQL command to create the required table:
    ```SQL
    CREATE TABLE analytics_events (
        id SERIAL PRIMARY KEY,
        type VARCHAR(50),
        song TEXT,
        artist TEXT,
        duration_ms INTEGER,
        session_id TEXT,
        client_timestamp TIMESTAMPTZ
    );
---
## 📈 Analytics Dashboard

The project includes a professional analytics suite located at `/analytics`. It provides:

* **Time-Series Filtering**: View stats by Week, Month (grouped by 7-day intervals), Year, or All Time.
* **Real-time Updates**: Uses Server-Sent Events (SSE) to update charts instantly when a user skips or finishes a song.
* **Key Metrics**: Total Plays, Listening Hours, and Song Completion Rate percentage.

---

## 🤖 AI Integration

The **"Get Info"** feature uses the `gemini-2.5-flash` model. When a user requests artist info, the backend generates a 2-3 sentence biography focusing on the artist's genre and significance based on the currently playing track.

---

## 📄 License

This project is licensed under the **ISC License**—see the `LICENSE` file for details.