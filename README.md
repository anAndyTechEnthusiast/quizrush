# Intelligent Quiz Game Platform

This is a full-stack quiz web application built using **Flask**, **SQLite**, and modern **JavaScript**.  
It features a multi-difficulty question system, user accounts, animations, scoring logic, analytics, and a particle-based background.

The project was initiated, structured, and developed by a single developer.  
Most of the implementation was created through a human–AI collaboration:  
I designed the architecture, wrote key components, handled debugging, and integrated everything, while AI-assisted tools were used to accelerate routine coding and improve reliability.  
The final result reflects both human intention and AI-augmented engineering.

Although it began as a solo project, it is intentionally open-sourced so others can learn from it, improve it, or build upon it.

Released under the **GNU GPL-3.0 License** (FSF-recommended).

---

## ✨ Features

- User registration and login with session persistence
- Multi-difficulty question categories (Easy / Medium / Hard / Sadistic)
- Real-time scoring, level progression, and streak mechanics
- Leaderboard with dynamic ranking
- Answer statistics and charts
- Animated particle background (`animation-system.js`)
- Modular backend structure with environment-based configuration
- Lightweight, portable SQLite database
- 100% open-source and community-friendly

---

## 📁 Project Structure

```
project/
├── app.py                 # Flask entry point
├── config.py              # App configuration
├── questions.py           # Question logic / generation / storage
├── check_db.py            # Database utilities
├── static/                # Frontend (CSS/JS/images)
│   ├── css/
│   ├── js/
│   │   ├── script.js
│   │   ├── leaderboard.js
│   │   ├── statistics-chart.js
│   │   └── animation-system.js
│   └── images/
├── templates/             # HTML templates
├── requirements.txt        # Python dependencies
├── b.env.example           # Example environment config
└── README.md
```

## 📦 Requirements

- Python 3.10+
- pip
- A modern browser supporting Canvas + ES6

## 🔧 Installation

Clone the repository:

```bash
git clone https://github.com/<your-username>/<your-repo>.git
cd <your-repo>
```

Install dependencies:

```bash
pip install -r requirements.txt
```

## 🔑 Environment Variables

Create a `.env` file in the project root:

Example:
```
SECRET_KEY=replace_with_random_string
DATABASE_PATH=questions.db
ADMIN_USERS=admin,developer
STATIC_PATH=static
STATIC_NEW_PATH=static1
```

You may also refer to `b.env.example`.

## 🗃️ Database Setup

If `questions.db` is included, no setup is required.

Otherwise, initialize or inspect database structure.

## 🚀 Running the Application

**Development Mode**
```bash
flask run  # or python app.py
```

Access in your browser: `http://127.0.0.1:5000/`

## 🌐 Deployment Notes

- Always set a secure `SECRET_KEY` (never use the default)
- Recommended stack: Gunicorn / uWSGI + Nginx + HTTPS
- Keep `.env` outside public directories
- SQLite works well for small deployments; use MySQL/PostgreSQL for larger scale
- Serve static files efficiently in production

## 🎨 Particle Animation System

The background animation is implemented in: `static/js/animation-system.js`

It includes:
- Free-floating particles
- Distance-based linking
- Mouse interactions
- Gradual structure formations
- Configurable speed/density/radius

To enable it, include:
```html
<canvas id="particleCanvas"></canvas>
<script src="/static/js/animation-system.js"></script>
```

## 🤝 Contributing

Although this project began as a one-person effort, collaboration is strongly encouraged.  
Contributions of all kinds are welcome — new features, refactoring, performance improvements, documentation enhancements, or even conceptual discussions.

If you wish to contribute:
- Submit a pull request
- Open an issue  
- Suggest improvements

Every contribution helps make this project better and keeps it free for everyone.

## 📜 License — GNU GPL-3.0

This project is released under the GNU General Public License v3.0, an FSF-recommended free software license.

You are free to:
- Use
- Study  
- Modify
- Redistribute
- Share modified versions

As long as derivative works remain under GPL-3.0.

**Full license text:** https://www.gnu.org/licenses/gpl-3.0.html

## 🤖 Human + AI Collaboration Statement

This software was built using a hybrid workflow combining human creativity with AI-assisted development tools.  
Approximately 95% of routine implementation — such as generating boilerplate code, optimizing functions, suggesting fixes, and refactoring — was assisted by AI.  
However, all architectural decisions, debugging, integration design, and overall direction were performed manually by the developer.

This project reflects a modern engineering approach where AI accelerates development, but human insight provides the structure.

## 📝 Acknowledgements

This project integrates:
- Flask
- Chart.js
- SQLite
- HTML5 Canvas
- Open-source community principles
- AI-assisted code generation & debugging support

## 🌟 Final Notes

This project serves both as a functional web application and as a reference for learning:
- Flask backend development
- JavaScript animation systems  
- Full-stack architecture
- Human–AI collaborative software workflows

Contributions and improvements are always welcome.
