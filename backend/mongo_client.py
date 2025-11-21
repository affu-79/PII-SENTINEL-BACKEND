"""
MongoDB client for batch metadata and results storage.
Rewritten for simplicity and performance.
"""
import os
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from pymongo import MongoClient, DESCENDING, ReturnDocument
from pymongo.errors import ConnectionFailure, DuplicateKeyError

logger = logging.getLogger(__name__)

class MongoClientWrapper:
    def __init__(self):
        self.uri = os.getenv('MONGO_URI', '').strip()
        self.client = None
        self.db = None
        self.plan_catalog: Dict[str, Dict[str, Any]] = {}
        if self.uri:
            try:
                self.client = MongoClient(self.uri, serverSelectionTimeoutMS=10000)
                self.client.admin.command('ping')
                db_name = os.getenv('MONGO_DB_PREFIX', 'pii_sentinel_').strip() + 'main'
                self.db = self.client[db_name]
                logger.info("Successfully connected to MongoDB.")
                self._ensure_indexes()
            except ConnectionFailure as e:
                logger.error(f"Failed to connect to MongoDB: {e}")
                self.client = None
                self.db = None
        else:
            logger.warning("MONGO_URI not set. MongoDB operations will be unavailable.")

    # ------------------------------------------------------------------
    # Configuration helpers
    # ------------------------------------------------------------------
    def configure_plans(self, plan_catalog: Dict[str, Dict[str, Any]]):
        """Attach plan catalog for token accounting."""
        self.plan_catalog = plan_catalog or {}

    def _ensure_indexes(self):
        if self.db is None:
            return
        try:
            self.db["Token-Ledger"].create_index([("user_id", 1), ("created_at", -1)])
            self.db["Token-Ledger"].create_index([("reason", 1)])
            self.db["Invoices"].create_index([("user_id", 1), ("created_at", -1)])
        except Exception as exc:
            logger.warning(f"Unable to create indexes: {exc}")

    # ------------------------------------------------------------------
    # User helpers
    # ------------------------------------------------------------------
    def find_user(self, identifier: str) -> Optional[Dict[str, Any]]:
        if self.db is None or not identifier:
            return None
        collection = self.db["User-Base"]
        user = collection.find_one({"email": identifier})
        if not user:
            user = collection.find_one({"username": identifier})
        if not user and identifier:
            mobile_normalized = ''.join(filter(str.isdigit, str(identifier)))
            if len(mobile_normalized) >= 10:
                user = collection.find_one({
                    "$or": [
                        {"phoneNumber": mobile_normalized},
                        {"phoneNumber": f"+91{mobile_normalized}"},
                        {"phoneNumber": f"91{mobile_normalized}"}
                    ]
                })
        if user and '_id' in user:
            user['_id'] = str(user['_id'])
        return user

    def _default_user_token_state(self) -> Dict[str, Any]:
        starter = self.plan_catalog.get('starter', {})
        starter_tokens = starter.get('monthly_tokens', 0) or 0
        return {
            "plan_id": 'starter',
            "subscription": {
                "status": 'active',
                "activated_at": datetime.utcnow(),
                "billing_period": 'monthly'
            },
            "features_enabled": starter.get('features', {
                "lock_json": False,
                "unlock_json": False,
                "advanced_analysis": False
            }),
            "tokens_total": starter_tokens,
            "tokens_used": 0,
            "tokens_balance": starter_tokens,
            "token_period": datetime.utcnow().strftime('%Y-%m'),
            "last_token_reset": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }

    def ensure_user_token_document(self, email: str) -> Optional[Dict[str, Any]]:
        if self.db is None or not email:
            return None
        collection = self.db["User-Base"]
        user = collection.find_one({"email": email})
        if not user:
            return None

        updates: Dict[str, Any] = {}
        if 'plan_id' not in user:
            updates.update(self._default_user_token_state())
        else:
            if 'subscription' not in user:
                updates['subscription'] = {
                    "status": 'active',
                    "activated_at": datetime.utcnow(),
                    "billing_period": 'monthly'
                }
            if 'tokens_total' not in user:
                updates['tokens_total'] = 0
            if 'tokens_used' not in user:
                updates['tokens_used'] = 0
            if 'tokens_balance' not in user:
                updates['tokens_balance'] = 0
            if 'features_enabled' not in user:
                plan = self.plan_catalog.get(user['plan_id'], {})
                updates['features_enabled'] = plan.get('features', {
                    "lock_json": False,
                    "unlock_json": False,
                    "advanced_analysis": False
                })
            if 'token_period' not in user:
                updates['token_period'] = datetime.utcnow().strftime('%Y-%m')
            updates['updated_at'] = datetime.utcnow()

        if updates:
            collection.update_one({"email": email}, {"$set": updates})
            user.update(updates)
        user['_id'] = str(user['_id'])
        return user

    def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        return self.plan_catalog.get(plan_id)

    def assign_plan(self, email: str, plan_id: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if self.db is None:
            return None
        plan = self.get_plan(plan_id)
        if not plan:
            return None
        collection = self.db["User-Base"]
        user_doc = collection.find_one({"email": email})
        if not user_doc:
            return None
        now = datetime.utcnow()
        update = {
            "plan_id": plan_id,
            "subscription.status": 'active',
            "subscription.activated_at": now,
            "subscription.billing_period": 'monthly',
            "features_enabled": plan.get('features', {}),
            "updated_at": now
        }
        monthly_tokens = plan.get('monthly_tokens')
        if monthly_tokens is None:
            update.update({
                "tokens_total": None,
                "tokens_used": 0,
                "tokens_balance": None,
                "token_period": now.strftime('%Y-%m'),
                "last_token_reset": now
            })
        else:
            existing_balance = user_doc.get('tokens_balance') or 0
            existing_total = user_doc.get('tokens_total') or 0
            new_balance = max(existing_balance, monthly_tokens)
            new_total = existing_total + monthly_tokens if existing_total is not None else monthly_tokens
            update.update({
                "tokens_total": new_total,
                "tokens_used": user_doc.get('tokens_used', 0),
                "tokens_balance": new_balance,
                "token_period": now.strftime('%Y-%m'),
                "last_token_reset": now
            })

        result = collection.find_one_and_update(
            {"email": email},
            {"$set": update},
            return_document=ReturnDocument.AFTER
        )
        if result and '_id' in result:
            result['_id'] = str(result['_id'])
        if result and monthly_tokens is not None:
            self.record_token_transaction(email, monthly_tokens, 'credit', 'plan_allocation', metadata or {"plan_id": plan_id}, result.get('tokens_balance'))
        return result

    def maybe_reset_plan_tokens(self, email: str) -> Optional[Dict[str, Any]]:
        if self.db is None:
            return None
        collection = self.db["User-Base"]
        user = collection.find_one({"email": email})
        if not user:
            return None
        plan = self.get_plan(user.get('plan_id', 'starter')) or {}
        monthly_tokens = plan.get('monthly_tokens')
        if monthly_tokens is None:
            return user
        current_period = datetime.utcnow().strftime('%Y-%m')
        if user.get('token_period') == current_period:
            return user
        update = {
            "$set": {
                "token_period": current_period,
                "last_token_reset": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
        if user.get('tokens_balance') is not None:
            update.setdefault("$inc", {})['tokens_balance'] = monthly_tokens
        if user.get('tokens_total') is not None:
            update.setdefault("$inc", {})['tokens_total'] = monthly_tokens

        user = collection.find_one_and_update(
            {"email": email},
            update,
            return_document=ReturnDocument.AFTER
        )
        if user:
            plan_identifier = user.get('plan_id', 'starter')
            self.record_token_transaction(email, monthly_tokens, 'credit', 'plan_reset', {"plan_id": plan_identifier})
            user['_id'] = str(user['_id'])
        return user

    def record_token_transaction(self, email: str, amount: int, txn_type: str, reason: str, metadata: Optional[Dict[str, Any]] = None, balance_after: Optional[int] = None):
        if self.db is None:
            return
        entry = {
            "user_id": email,
            "type": txn_type,
            "amount": amount,
            "reason": reason,
            "metadata": metadata or {},
            "balance_after": balance_after,
            "created_at": datetime.utcnow()
        }
        self.db["Token-Ledger"].insert_one(entry)

    def has_token_transaction_for_payment(self, payment_id: Optional[str]) -> bool:
        if self.db is None or not payment_id:
            return False
        return self.db["Token-Ledger"].count_documents({"metadata.razorpay_payment_id": payment_id}) > 0

    def credit_tokens(self, email: str, tokens: int, reason: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
        if self.db is None or tokens <= 0:
            return None
        collection = self.db["User-Base"]
        now = datetime.utcnow()
        user = collection.find_one({"email": email})
        if not user:
            return None

        update_ops: Dict[str, Any] = {"$set": {"updated_at": now}}
        inc_ops: Dict[str, int] = {}

        if user.get('tokens_balance') is not None:
            inc_ops['tokens_balance'] = tokens
        if user.get('tokens_total') is not None:
            inc_ops['tokens_total'] = tokens

        if inc_ops:
            update_ops["$inc"] = inc_ops

        result = collection.find_one_and_update(
            {"email": email},
            update_ops,
            return_document=ReturnDocument.AFTER
        )
        if result:
            balance = result.get('tokens_balance')
            self.record_token_transaction(email, tokens, 'credit', reason, metadata, balance)
            result['_id'] = str(result['_id'])
        return result

    def debit_tokens(self, email: str, tokens: int, reason: str, metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        if self.db is None:
            return {"success": False, "error": "DB_UNAVAILABLE"}
        if tokens <= 0:
            return {"success": True, "balance": None}
        collection = self.db["User-Base"]
        user = collection.find_one({"email": email})
        if not user:
            return {"success": False, "error": "USER_NOT_FOUND"}
        plan = self.get_plan(user.get('plan_id', 'starter')) or {}
        if plan.get('monthly_tokens') is None:
            return {"success": True, "balance": None, "unlimited": True}
        result = collection.find_one_and_update(
            {"email": email, "tokens_balance": {"$gte": tokens}},
            {"$inc": {"tokens_balance": -tokens, "tokens_used": tokens}, "$set": {"updated_at": datetime.utcnow()}},
            return_document=ReturnDocument.AFTER
        )
        if not result:
            return {"success": False, "error": "INSUFFICIENT_TOKENS"}
        balance = result.get('tokens_balance')
        self.record_token_transaction(email, -tokens, 'debit', reason, metadata, balance)
        return {"success": True, "balance": balance}

    def get_token_summary(self, email: str) -> Optional[Dict[str, Any]]:
        if self.db is None:
            return None
        user = self.db["User-Base"].find_one({"email": email})
        if not user:
            return None
        plan = self.get_plan(user.get('plan_id', 'starter')) or {}
        monthly_tokens = plan.get('monthly_tokens')
        balance = user.get('tokens_balance')
        if monthly_tokens is None:
            balance_display = 'unlimited'
        else:
            balance_display = balance if balance is not None else 0
        return {
            "plan_id": user.get('plan_id', 'starter'),
            "subscription": user.get('subscription', {}),
            "tokens_total": user.get('tokens_total'),
            "tokens_used": user.get('tokens_used'),
            "tokens_balance": balance_display,
            "features_enabled": user.get('features_enabled', {}),
            "last_token_reset": user.get('last_token_reset'),
            "token_period": user.get('token_period')
        }

    def store_invoice_metadata(self, email: str, invoice_data: Dict[str, Any]):
        if self.db is None:
            return
        transaction_id = invoice_data.get('transaction_id')
        if not transaction_id:
            return
        payload = dict(invoice_data or {})
        payload.update({
            "user_id": email,
            "updated_at": datetime.utcnow()
        })
        self.db["Invoices"].update_one(
            {
                "user_id": email,
                "transaction_id": transaction_id
            },
            {
                "$set": payload,
                "$setOnInsert": {"created_at": datetime.utcnow()}
            },
            upsert=True
        )

    def get_invoice(self, email: str, tx_id: str) -> Optional[Dict[str, Any]]:
        if self.db is None:
            return None
        invoice = self.db["Invoices"].find_one({"user_id": email, "transaction_id": tx_id})
        if invoice and '_id' in invoice:
            invoice['_id'] = str(invoice['_id'])
        return invoice

    # ------------------------------------------------------------------
    # Batch helpers
    # ------------------------------------------------------------------
    def create_batch(self, batch_id: str, name: str, user_id: str, username: str) -> Dict[str, Any]:
        """Creates a new batch document."""
        if self.db is None:
            return {}
        collection = self.db.batches
        batch_doc = {
            "batch_id": batch_id,
            "name": name,
            "user_id": user_id,
            "username": username,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "status": "processing",
            "files": [],
            "stats": {}
        }
        try:
            collection.insert_one(batch_doc)
            logger.info(f"Created batch '{name}' (ID: {batch_id}) for user: {user_id}")
        except DuplicateKeyError:
            logger.warning(f"Batch with ID {batch_id} already exists.")
        return batch_doc

    def add_file_to_batch(self, batch_id: str, filename: str, file_stats: Dict[str, Any]) -> bool:
        """Add file to batch with PII data."""
        if self.db is None:
            return False
        collection = self.db.batches
        piis = file_stats.get('piis', [])
        file_entry = {
            "filename": filename,
            "pii_count": len(piis) if isinstance(piis, list) else 0,
            "piis": piis if isinstance(piis, list) else [],
            "page_count": file_stats.get('page_count', 0),
            "processed_at": datetime.utcnow()
        }
        result = collection.update_one(
            {"batch_id": batch_id},
            {"$push": {"files": file_entry}, "$set": {"updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    def update_batch_stats(self, batch_id: str, file_count: int, pii_results: Dict[str, Any], scan_duration: float = 0) -> bool:
        """Update batch statistics after processing."""
        if self.db is None:
            return False
        collection = self.db.batches
        total_piis = 0
        breakdown = {}
        for file_result in pii_results.get('files', []):
            file_piis = file_result.get('piis', [])
            if isinstance(file_piis, list):
                total_piis += len(file_piis)
                for pii in file_piis:
                    pii_type = pii.get('type', 'unknown')
                    breakdown[pii_type] = breakdown.get(pii_type, 0) + 1

        stats = {
            "files": file_count,
            "piis": total_piis,
            "breakdown": breakdown,
            "scan_duration": scan_duration
        }

        result = collection.update_one(
            {"batch_id": batch_id},
            {"$set": {"stats": stats, "status": "completed", "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    def list_batches(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Lists batches for a user with projection for performance."""
        if self.db is None:
            return []
        collection = self.db.batches
        projection = {
            "_id": 0, "batch_id": 1, "name": 1, "created_at": 1, "status": 1,
            "stats": 1, "file_count": {"$size": "$files"}
        }
        batches = collection.find({"user_id": user_id}, projection).sort("created_at", DESCENDING).limit(limit)
        return list(batches)

    def get_batch_analysis(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Gets full analysis data for a single batch, ensuring fields are JSON serializable."""
        if self.db is None:
            return None
        collection = self.db.batches
        batch = collection.find_one({"batch_id": batch_id})
        if not batch:
            return None

        def serialize_document(doc: Dict[str, Any]) -> Dict[str, Any]:
            serialized = {}
            for key, value in doc.items():
                if key == '_id':
                    serialized[key] = str(value)
                elif isinstance(value, datetime):
                    serialized[key] = value.isoformat()
                elif isinstance(value, list):
                    serialized[key] = [serialize_document(item) if isinstance(item, dict) else item for item in value]
                elif isinstance(value, dict):
                    serialized[key] = serialize_document(value)
                else:
                    serialized[key] = value
            return serialized

        return serialize_document(batch)

    def get_user_stats(self, user_id: str) -> Dict[str, Any]:
        """Gets aggregated stats for a user using a highly efficient aggregation pipeline."""
        if self.db is None:
            return {"total_batches": 0, "total_files": 0, "total_piis": 0}

        collection = self.db.batches
        pipeline = [
            {"$match": {"user_id": user_id}},
            {"$group": {
                "_id": "$user_id",
                "total_batches": {"$sum": 1},
                "total_files": {"$sum": {"$size": "$files"}},
                "total_piis": {"$sum": "$stats.piis"}
            }}
        ]
        result = list(collection.aggregate(pipeline))
        if result:
            return result[0]
        return {"total_batches": 0, "total_files": 0, "total_piis": 0}

    def get_user_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user by email."""
        if self.db is None:
            return None
        user = self.db["User-Base"].find_one({"email": email})
        if user and '_id' in user:
            user['_id'] = str(user['_id'])
        return user

    def get_user_by_username(self, username: str) -> Optional[Dict[str, Any]]:
        """Get user by username."""
        if self.db is None:
            return None
        user = self.db["User-Base"].find_one({"username": username})
        if user and '_id' in user:
            user['_id'] = str(user['_id'])
        return user

    def get_user_activity_log(self, user_id: str) -> Dict[str, Any]:
        """Gets the last activity timestamps for a user efficiently."""
        if self.db is None:
            return {"lastBatchCreated": None, "lastPiiScanCompleted": None}

        collection = self.db.batches
        latest_batch = collection.find_one(
            {"user_id": user_id},
            projection={"created_at": 1},
            sort=[("created_at", DESCENDING)]
        )
        latest_completed_scan = collection.find_one(
            {"user_id": user_id, "status": "completed"},
            projection={"updated_at": 1},
            sort=[("updated_at", DESCENDING)]
        )
        return {
            "lastBatchCreated": latest_batch["created_at"] if latest_batch else None,
            "lastPiiScanCompleted": latest_completed_scan["updated_at"] if latest_completed_scan else None,
        }

    def get_connection_status(self) -> Dict[str, Any]:
        """Get MongoDB connection status."""
        if self.client is None or self.db is None:
            return {"connected": False, "error": "Not connected"}
        try:
            self.client.admin.command('ping')
            return {"connected": True, "database": self.db.name}
        except Exception as e:
            return {"connected": False, "error": str(e)}

    def get_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """Get batch by ID."""
        if self.db is None:
            return None
        return self.db.batches.find_one({"batch_id": batch_id})

    def delete_batch(self, batch_id: str) -> bool:
        """Delete a batch."""
        if self.db is None:
            return False
        result = self.db.batches.delete_one({"batch_id": batch_id})
        return result.deleted_count > 0

    def store_encrypted_file_password(self, file_id: str, password_hash: str, batch_id: str, metadata: Dict[str, Any]) -> bool:
        """Store encrypted file password."""
        if self.db is None:
            return False
        self.db.file_public_keys.insert_one({
            "file_id": file_id,
            "password_hash": password_hash,
            "batch_id": batch_id,
            "metadata": metadata,
            "created_at": datetime.utcnow()
        })
        return True

    def verify_encrypted_file_password(self, file_id: str, password_hash: str) -> Optional[Dict[str, Any]]:
        """Verify encrypted file password."""
        if self.db is None:
            return None
        return self.db.file_public_keys.find_one({"file_id": file_id, "password_hash": password_hash})

    def store_otp(self, mobile: str, otp: str, expires_at: float) -> bool:
        """Store OTP."""
        if self.db is None:
            return False
        mobile_normalized = ''.join(filter(str.isdigit, str(mobile)))
        self.db["OTP-Storage"].update_one(
            {"mobile": mobile_normalized},
            {"$set": {"otp": otp, "expires_at": expires_at, "created_at": datetime.utcnow()}},
            upsert=True
        )
        return True

    def get_otp(self, mobile: str) -> Optional[Dict[str, Any]]:
        """Get OTP."""
        if self.db is None:
            return None
        mobile_normalized = ''.join(filter(str.isdigit, str(mobile)))
        return self.db["OTP-Storage"].find_one({"mobile": mobile_normalized})

    def delete_otp(self, mobile: str) -> bool:
        """Delete OTP."""
        if self.db is None:
            return False
        mobile_normalized = ''.join(filter(str.isdigit, str(mobile)))
        result = self.db["OTP-Storage"].delete_one({"mobile": mobile_normalized})
        return result.deleted_count > 0

    def get_batches_by_username(self, username: str) -> List[Dict[str, Any]]:
        """Get batches by username."""
        if self.db is None:
            return []
        batches = list(self.db.batches.find({"username": username}).sort("created_at", DESCENDING))
        for batch in batches:
            if '_id' in batch:
                batch['_id'] = str(batch['_id'])
        return batches

    def create_user(self, user_data: Dict[str, Any]) -> Optional[str]:
        """Create a new user."""
        if self.db is None:
            return None
        email = user_data.get("email")
        if not email:
            return None

        collection = self.db["User-Base"]
        if collection.find_one({"email": email}):
            return None

        user_doc = {**user_data, "created_at": datetime.utcnow(), "updated_at": datetime.utcnow()}
        result = collection.insert_one(user_doc)
        return str(result.inserted_id)

    def update_user_subscription(self, email: str, plan_name: str, plan_type: str, amount: float = 0, billing_period: str = 'monthly') -> bool:
        """Update user subscription."""
        if self.db is None:
            return False
        expires_at = datetime.utcnow() + timedelta(days=365 if billing_period == 'yearly' else 30)
        result = self.db["User-Base"].update_one(
            {"email": email},
            {"$set": {
                "subscription": {
                    "plan_name": plan_name,
                    "plan_type": plan_type,
                    "status": "active",
                    "activated_at": datetime.utcnow(),
                    "expires_at": expires_at,
                    "billing_period": billing_period,
                    "amount": amount
                },
                "updated_at": datetime.utcnow()
            }}
        )
        return result.modified_count > 0

    def get_user_subscription(self, email: str) -> Optional[Dict[str, Any]]:
        """Get user subscription."""
        if self.db is None:
            return None
        user = self.db["User-Base"].find_one({"email": email})
        return user.get("subscription") if user else None

    def update_user_status(self, email: str, status: str) -> bool:
        """Update user status."""
        if self.db is None:
            return False
        result = self.db["User-Base"].update_one(
            {"email": email},
            {"$set": {"account_status": status, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    def update_user_plan(self, email: str, plan: str, billing_period: str) -> bool:
        """Update user plan."""
        if self.db is None:
            return False
        result = self.db["User-Base"].update_one(
            {"email": email},
            {"$set": {"plan": plan, "billing_period": billing_period, "updated_at": datetime.utcnow()}}
        )
        return result.modified_count > 0

    def update_user_security(self, email: str, security_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user security settings."""
        if self.db is None:
            return None
        import bcrypt
        update_fields = {"updated_at": datetime.utcnow()}

        if 'newPassword' in security_data and 'currentPassword' in security_data:
            user = self.db["User-Base"].find_one({"email": email})
            if not user:
                return None
            password_hash = user.get('password_hash', '')
            if password_hash and bcrypt.checkpw(security_data['currentPassword'].encode('utf-8'), password_hash.encode('utf-8')):
                update_fields['password_hash'] = bcrypt.hashpw(security_data['newPassword'].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

        if 'twoFactorEnabled' in security_data:
            update_fields['twoFactorEnabled'] = bool(security_data['twoFactorEnabled'])

        result = self.db["User-Base"].update_one({"email": email}, {"$set": update_fields})
        return self.db["User-Base"].find_one({"email": email}) if result.modified_count > 0 else None

    def update_user_preferences(self, email: str, preferences: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update user preferences."""
        if self.db is None:
            return None
        update_fields = {"updated_at": datetime.utcnow()}
        if 'emailUpdates' in preferences:
            update_fields['receiveUpdates'] = bool(preferences['emailUpdates'])
        if 'dataConsent' in preferences:
            update_fields['consentDataProcessing'] = bool(preferences['dataConsent'])
        result = self.db["User-Base"].update_one({"email": email}, {"$set": update_fields})
        return self.db["User-Base"].find_one({"email": email}) if result.modified_count > 0 else None

    def get_user_data_for_export(self, email: str) -> Dict[str, Any]:
        """Get user data for export."""
        if self.db is None:
            return {}
        user = self.get_user_by_email(email)
        batches = list(self.db.batches.find({"user_id": email}))
        return {"profile": user, "batches": batches}

    def clear_user_activity_logs(self, email: str) -> bool:
        """Clear user activity logs."""
        return True

    def delete_user_account(self, email: str, reason: str) -> bool:
        """Delete user account."""
        if self.db is None:
            return False
        user = self.db["User-Base"].find_one({"email": email})
        if user:
            self.db["DeletedUsers"].insert_one({
                "email": email,
                "full_name": user.get('fullName'),
                "reason": reason,
                "deleted_at": datetime.utcnow()
            })
        result = self.db["User-Base"].delete_one({"email": email})
        return result.deleted_count > 0

mongo_client = MongoClientWrapper()
