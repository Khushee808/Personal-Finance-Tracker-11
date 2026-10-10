import os
from functools import wraps
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from dotenv import load_dotenv
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from pymongo import MongoClient
from werkzeug.security import generate_password_hash, check_password_hash
import jwt

load_dotenv()
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017/")
DB_NAME = os.getenv("MONGO_DB", "personal_finance_tracker")
JWT_SECRET = os.getenv("JWT_SECRET", "change_this_secret_key")
client = MongoClient(MONGO_URI, serverSelectionTimeoutMS=3000)
db = client[DB_NAME]
users = db.users
transactions = db.transactions
settings = db.settings

users.create_index("email", unique=True)
transactions.create_index([("user_id", 1), ("date", -1)])


def oid(value):
    return ObjectId(value) if ObjectId.is_valid(value) else None


def serialize(doc):
    if not doc:
        return None
    out = dict(doc)
    if "_id" in out:
        out["_id"] = str(out["_id"])
    if "user_id" in out:
        out["user_id"] = str(out["user_id"])
    return out


def token_for(user_id):
    payload = {"user_id": str(user_id), "exp": datetime.now(timezone.utc) + timedelta(hours=24)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def auth_required(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return jsonify(message="Authentication required"), 401
        try:
            payload = jwt.decode(header.split(" ", 1)[1], JWT_SECRET, algorithms=["HS256"])
            user_id = oid(payload.get("user_id"))
            if not user_id:
                raise ValueError("Invalid user")
            g.user_id = user_id
        except Exception:
            return jsonify(message="Invalid or expired token"), 401
        return fn(*args, **kwargs)
    return wrapper


@app.get("/")
def home():
    return jsonify(message="Personal Finance Tracker Flask API is running")


@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        return jsonify(status="ok", database="connected")
    except Exception as exc:
        return jsonify(status="error", database="not connected", message=str(exc)), 503


@app.post("/api/auth/register")
def register():
    data = request.get_json(silent=True) or {}
    name, email, password = data.get("name", "").strip(), data.get("email", "").strip().lower(), data.get("password", "")
    if not name or not email or not password:
        return jsonify(message="Name, email and password are required"), 400
    if len(password) < 6:
        return jsonify(message="Password must be at least 6 characters"), 400
    if users.find_one({"email": email}):
        return jsonify(message="Email already registered"), 409
    user = {"name": name, "email": email, "password": generate_password_hash(password), "created_at": datetime.utcnow()}
    result = users.insert_one(user)
    return jsonify(token=token_for(result.inserted_id), user={"id": str(result.inserted_id), "name": name, "email": email}), 201


@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    email, password = data.get("email", "").strip().lower(), data.get("password", "")
    user = users.find_one({"email": email})
    if not user or not check_password_hash(user.get("password", ""), password):
        return jsonify(message="Invalid email or password"), 401
    return jsonify(token=token_for(user["_id"]), user={"id": str(user["_id"]), "name": user["name"], "email": user["email"]})


@app.get("/api/transactions")
@auth_required
def get_transactions():
    docs = transactions.find({"user_id": g.user_id}).sort("date", -1)
    return jsonify([serialize(x) for x in docs])


@app.post("/api/transactions")
@auth_required
def add_transaction():
    data = request.get_json(silent=True) or {}
    required = ["date", "description", "category", "amount", "type"]
    if any(data.get(k) in (None, "") for k in required):
        return jsonify(message="All transaction fields are required"), 400
    try:
        amount = float(data["amount"])
        if amount < 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify(message="Amount must be a valid positive number"), 400
    doc = {"user_id": g.user_id, "date": str(data["date"]), "description": str(data["description"]), "category": str(data["category"]), "amount": amount, "type": str(data["type"]), "recurring": bool(data.get("recurring", False)), "created_at": datetime.utcnow()}
    result = transactions.insert_one(doc)
    return jsonify(serialize(transactions.find_one({"_id": result.inserted_id}))), 201


@app.delete("/api/transactions/<transaction_id>")
@auth_required
def delete_transaction(transaction_id):
    tx_id = oid(transaction_id)
    if not tx_id:
        return jsonify(message="Invalid transaction id"), 400
    result = transactions.delete_one({"_id": tx_id, "user_id": g.user_id})
    if result.deleted_count == 0:
        return jsonify(message="Transaction not found"), 404
    return jsonify(message="Transaction deleted")


@app.get("/api/settings")
@auth_required
def get_settings():
    doc = settings.find_one({"user_id": g.user_id}) or {"monthlyBudget": 0, "savingsGoal": 0, "darkMode": False, "categoryBudgets": {}}
    doc.pop("_id", None)
    doc.pop("user_id", None)
    return jsonify(settings=doc)


@app.put("/api/settings")
@auth_required
def update_settings():
    data = request.get_json(silent=True) or {}
    allowed = {"monthlyBudget": float(data.get("monthlyBudget", 0) or 0), "savingsGoal": float(data.get("savingsGoal", 0) or 0), "darkMode": bool(data.get("darkMode", False)), "categoryBudgets": data.get("categoryBudgets", {})}
    settings.update_one({"user_id": g.user_id}, {"$set": allowed}, upsert=True)
    return jsonify(settings=allowed)


@app.get("/api/backup")
@auth_required
def backup():
    tx = [serialize(x) for x in transactions.find({"user_id": g.user_id})]
    st = settings.find_one({"user_id": g.user_id}) or {"monthlyBudget": 0, "savingsGoal": 0, "darkMode": False, "categoryBudgets": {}}
    st.pop("_id", None); st.pop("user_id", None)
    return jsonify(transactions=tx, settings=st)


@app.post("/api/backup/restore")
@auth_required
def restore():
    data = request.get_json(silent=True) or {}
    txs = data.get("transactions", [])
    if not isinstance(txs, list):
        return jsonify(message="Invalid backup file"), 400
    transactions.delete_many({"user_id": g.user_id})
    clean = []
    for item in txs:
        try:
            clean.append({"user_id": g.user_id, "date": str(item["date"]), "description": str(item["description"]), "category": str(item["category"]), "amount": float(item["amount"]), "type": str(item["type"]), "recurring": bool(item.get("recurring", False)), "created_at": datetime.utcnow()})
        except (KeyError, TypeError, ValueError):
            continue
    if clean:
        transactions.insert_many(clean)
    st = data.get("settings", {})
    settings.update_one({"user_id": g.user_id}, {"$set": {"monthlyBudget": float(st.get("monthlyBudget", 0) or 0), "savingsGoal": float(st.get("savingsGoal", 0) or 0), "darkMode": bool(st.get("darkMode", False)), "categoryBudgets": st.get("categoryBudgets", {})}}, upsert=True)
    return jsonify(message="Backup restored successfully")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=True)
