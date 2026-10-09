# Personal Finance Tracker - Full Stack

A complete Personal Finance Tracker with the original feature set plus a real backend and MongoDB database.

## Features
- Login / Register / Logout with JWT authentication
- Dashboard with Total Income, Total Expense, Balance and This Month Expense
- Add Income / Expense transactions
- Categories: Food, Travel, Shopping, Bills, Education, Health, Salary, Other
- Recurring transaction flag
- Monthly budget
- Category budgets and budget status
- Savings goal and progress
- Income vs Expense visual chart
- Expense category summary
- Smart insights
- Recent transactions
- Transaction history
- Search and filter transactions
- Delete transactions
- Monthly reports
- CSV export
- Print / Save as PDF
- Dark mode
- MongoDB database storage
- JSON backup and restore through the backend

## Technologies
Frontend: React + Vite + Axios + CSS
Backend: Node.js + Express + JWT + bcryptjs
Database: MongoDB + Mongoose
Editor: Visual Studio Code

## Requirements
1. Node.js LTS
2. MongoDB Community Server running locally, OR a MongoDB Atlas connection string
3. Visual Studio Code

## Run in Visual Studio Code
Open the project folder, then open two terminals.

### Terminal 1 - Backend
```
cd backend
npm install
copy .env.example .env
npm run dev
```
Backend runs at http://localhost:5000

### Terminal 2 - Frontend
```
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal, normally http://localhost:5173

## MongoDB
The default `.env.example` uses:
MONGO_URI=mongodb://127.0.0.1:27017/personal_finance_tracker

If using MongoDB Atlas, replace MONGO_URI with the Atlas connection string.
Also change JWT_SECRET to a private random value.

## Important
This is a real full-stack project. The frontend communicates with the Express backend, and the backend stores user accounts, settings and transactions in MongoDB.
For a phone-accessible online version, the frontend and backend must be deployed to internet-accessible hosting and MongoDB Atlas should be used for the database.
