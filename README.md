# 🧠 Athena LMS

Athena is a modern **Learning Management System (LMS)** designed for educators, students, and administrators.  
It combines an interactive learning experience, real-time collaboration, and powerful analytics — all within a monorepo powered by **Nx**.

> 🚧 **Work in progress.** Most of the system is not production-ready yet.

---

## 🧰 Tech Stack

| Layer             | Technology                |
| ----------------- | ------------------------- |
| **Backend**       | NestJS (TypeScript, REST) |
| **Frontend**      | React (Vite, shadcn/ui)   |
| **Monorepo**      | Nx                        |
| **Database**      | PostgreSQL                |
| **Cache / Queue** | Redis                     |
| **Storage**       | MinIO                     |
| **CI/CD**         | GitHub Actions            |

---

## 🧪 Development

```bash
# Install dependencies
npm install

# Lint, test, build, and typecheck all projects
npx nx run-many -t lint test build typecheck

# Start backend
npx nx serve athena-api

# Start frontends
npx nx serve athena-learn
npx nx serve athena-studio
npx nx serve athena-control
```

---

## 🧱 CI/CD

The project uses GitHub Actions for automated linting, testing, and auditing on every push or pull request to main and develop branches.

## ⚖️ License

MIT License Copyright © 2025 [Sergei Shekshuev](https://github.com/shekshuev)
