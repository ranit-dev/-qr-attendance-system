# QR Attendance Management System

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.8%2B-blue?logo=python" alt="Python">
  <img src="https://img.shields.io/badge/Flask-2.x-green?logo=flask" alt="Flask">
  <img src="https://img.shields.io/badge/HTML5-E34F26?logo=html5&logoColor=white" alt="HTML5">
  <img src="https://img.shields.io/badge/CSS3-1572B6?logo=css3&logoColor=white" alt="CSS3">
  <img src="https://img.shields.io/badge/JavaScript-F7DF1E?logo=javascript&logoColor=black" alt="JavaScript">
</p>

---

<h1 align="center" style="color:#2d3748;font-family:'Segoe UI',sans-serif;">QR Attendance Management System</h1>

<p align="center" style="color:#4fd1c5;font-size:1.2em;">A modern, secure, and efficient web-based attendance solution for educational institutions.</p>

---

## 🚀 Features

- **Automated QR-based attendance** for students
- **Admin dashboard** for session and student management
- **Device fingerprinting** and **geolocation** for security
- **Real-time analytics** and PDF report generation
- **Email notifications** to absentees
- **Responsive UI** for mobile and desktop

---

## 🖼️ Screenshots

> *(Add your own screenshots here for best effect!)*

| Home Page | QR Scanner | Admin Dashboard |
|-----------|-----------|----------------|
| ![](static/screenshots/home.png) | ![](static/screenshots/scanner.png) | ![](static/screenshots/admin.png) |

---

## 📁 Project Structure

```text
qr-attendance-system/
│
├── app.py                # Main Flask application
├── models.py             # Database models
├── config.py             # Configuration settings
├── requirements.txt      # Python dependencies
│
├── templates/            # HTML templates
│   ├── index.html
│   ├── admin.html
│   └── scanner.html
│
├── static/
│   ├── css/
│   │   ├── index.css
│   │   ├── admin.css
│   │   └── scanner.css
│   └── js/
│       ├── admin.js
│       └── scanner.js
│
├── instance/
│   └── site.db           # SQLite database
└── README.md
```

---

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/your-username/qr-attendance-system.git
   cd qr-attendance-system
   ```
2. **Create a virtual environment:**
   ```powershell
   python -m venv .venv
   .venv\Scripts\activate
   ```
3. **Install dependencies:**
   ```powershell
   pip install -r requirements.txt
   ```
4. **Run the application:**
   ```powershell
   python app.py
   ```
5. **Open in browser:**
   Visit [http://localhost:5000](http://localhost:5000)

---

## 📝 Usage

- **Students:**
  - Visit the home page and scan the session QR code using your device.
  - Enter your registration number to mark attendance.
- **Admins:**
  - Login via the admin dashboard.
  - Create/manage sessions, view attendance, and download reports.

---

## ⚙️ Technologies Used

- **Backend:** Python, Flask, SQLAlchemy, SQLite
- **Frontend:** HTML5, CSS3, JavaScript (ES6+)
- **QR Code:** Python `qrcode` library
- **PDF Export:** jsPDF (JavaScript)
- **Email:** Flask-Mail

---

## 🔒 Security Features

- **Device Fingerprinting:** Prevents multiple students from using the same device.
- **Geolocation:** (Optional) Ensures attendance is marked within campus.
- **Admin Authentication:** Secure password-protected dashboard.

---

## 📊 Functional Overview

- **QR Code Generation:** Unique QR for each session.
- **Attendance Marking:** Secure, real-time, and logged with device/location info.
- **Admin Tools:** Session management, analytics, PDF reports, and notifications.

---

## 📚 References

- [Flask Documentation](https://flask.palletsprojects.com/)
- [SQLAlchemy Docs](https://docs.sqlalchemy.org/)
- [qrcode Python Library](https://pypi.org/project/qrcode/)
- [jsPDF](https://github.com/parallax/jsPDF)
- [HTML5 getUserMedia API](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

---

## 👨‍💻 Author

- **Your Name**  
  [your.email@example.com](mailto:your.email@example.com)

---

## 🎨 Styling & Customization

- All UI is styled with modern CSS (see `static/css/`).
- Fonts: Uses system UI fonts for a clean, professional look.
- Colors: Modern palette with accent colors for highlights.
- Responsive: Works on both desktop and mobile devices.

---

## 📄 License

This project is licensed under the MIT License.

---

<p align="center" style="color:#4fd1c5;font-size:1.1em;">Thank you for using QR Attendance Management System!</p>
