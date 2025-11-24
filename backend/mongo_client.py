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
from bson import ObjectId

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
            
            # Always ensure features_enabled has all required fields based on current plan
            plan = self.plan_catalog.get(user.get('plan_id', 'starter'), {})
            plan_features = plan.get('features', {
                "lock_json": False,
                "unlock_json": False,
                "advanced_analysis": False,
                "export_json": False,
                "log_records": False
            })
            
            current_features = user.get('features_enabled', {})
            if not isinstance(current_features, dict):
                current_features = {}
            
            # Merge: keep existing values but add missing fields with plan defaults
            merged_features = {**plan_features, **current_features}
            
            # Only update if features are missing or incomplete
            if 'features_enabled' not in user or current_features != merged_features:
                updates['features_enabled'] = merged_features
            if 'token_period' not in user:
                updates['token_period'] = datetime.utcnow().strftime('%Y-%m')
            if 'account_status' not in user:
                updates['account_status'] = 'active'
            updates['updated_at'] = datetime.utcnow()

        if updates:
            collection.update_one({"email": email}, {"$set": updates})
            user.update(updates)
        user['_id'] = str(user['_id'])
        return user

    def get_plan(self, plan_id: str) -> Optional[Dict[str, Any]]:
        return self.plan_catalog.get(plan_id)

    def assign_plan(self, email: str, plan_id: str, metadata: Optional[Dict[str, Any]] = None, billing_period: str = 'monthly') -> Optional[Dict[str, Any]]:
        if self.db is None:
            return None
        normalized_plan_id = (plan_id or '').lower()
        plan = self.get_plan(normalized_plan_id)
        if not plan:
            return None
        collection = self.db["User-Base"]
        user_doc = collection.find_one({"email": email})
        if not user_doc:
            return None
        now = datetime.utcnow()
        billing_period_normalized = (billing_period or 'monthly').lower()
        if billing_period_normalized not in {'monthly', 'annual'}:
            billing_period_normalized = 'monthly'
        update = {
            "plan_id": normalized_plan_id,
            "plan": plan.get('name') or normalized_plan_id,
            "subscription.status": 'active',
            "subscription.activated_at": now,
            "subscription.billing_period": billing_period_normalized,
            "subscription.plan_id": normalized_plan_id,
            "subscription.plan_name": plan.get('name'),
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
            update.update({
                "tokens_total": monthly_tokens,
                "tokens_used": 0,
                "tokens_balance": monthly_tokens,
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
            ledger_metadata = {"plan_id": normalized_plan_id, "billing_period": billing_period_normalized}
            if metadata:
                ledger_metadata.update(metadata)
            self.record_token_transaction(
                email,
                monthly_tokens,
                'credit',
                'plan_allocation',
                ledger_metadata,
                result.get('tokens_balance')
            )
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
        
        # For unlimited plans (Enterprise), still track tokens_used for analytics
        if plan.get('monthly_tokens') is None:
            print(f"🔍 ENTERPRISE PLAN: Tracking {tokens} tokens for {email} (reason: {reason})")
            print(f"   Current tokens_used: {user.get('tokens_used', 0)}")
            
            # Update tokens_used counter even though balance is unlimited
            result = collection.update_one(
                {"email": email},
                {"$inc": {"tokens_used": tokens}, "$set": {"updated_at": datetime.utcnow()}}
            )
            
            print(f"   MongoDB update result: matched={result.matched_count}, modified={result.modified_count}")
            
            # Verify the update
            updated_user = collection.find_one({"email": email})
            print(f"   New tokens_used: {updated_user.get('tokens_used', 0)}")
            
            # Record transaction for tracking
            self.record_token_transaction(email, -tokens, 'debit', reason, metadata, None)
            print(f"✅ ENTERPRISE: Successfully tracked {tokens} tokens for {email}")
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
        plan_id = user.get('plan_id', 'starter')
        plan = self.get_plan(plan_id) or {}
        monthly_tokens = plan.get('monthly_tokens')
        balance = user.get('tokens_balance')
        if monthly_tokens is None:
            balance_display = 'unlimited'
        else:
            balance_display = balance if balance is not None else 0
        
        # Build plan_details object for frontend
        plan_details = {
            "id": plan_id,
            "name": plan.get('name', plan_id.capitalize()),
            "monthly_tokens": monthly_tokens,
            "price_inr": plan.get('price_inr', 0)
        }
        
        return {
            "plan_id": plan_id,
            "plan_details": plan_details,
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
        processed_at = file_stats.get('processed_at')
        if isinstance(processed_at, str):
            try:
                processed_at = datetime.fromisoformat(processed_at.replace('Z', '+00:00'))
            except ValueError:
                processed_at = datetime.utcnow()
        elif not isinstance(processed_at, datetime):
            processed_at = datetime.utcnow()
        processing_time = float(file_stats.get('processing_time') or 0.0)
        file_entry = {
            "filename": filename,
            "pii_count": len(piis) if isinstance(piis, list) else 0,
            "piis": piis if isinstance(piis, list) else [],
            "page_count": file_stats.get('page_count', 0),
            "processed_at": processed_at,
            "processing_time": processing_time
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
        successful_files = [file_result for file_result in pii_results.get('files', []) if file_result.get('success', True)]
        for file_result in successful_files:
            file_piis = file_result.get('piis', [])
            if isinstance(file_piis, list):
                total_piis += len(file_piis)
                for pii in file_piis:
                    pii_type = pii.get('type', 'unknown')
                    breakdown[pii_type] = breakdown.get(pii_type, 0) + 1

        total_pages = sum(file_result.get('page_count', 0) or 0 for file_result in successful_files)

        stats = {
            "files": file_count,
            "piis": total_piis,
            "breakdown": breakdown,
            "scan_duration": scan_duration,
            "pages_processed": total_pages
        }

        def _parse_timestamp(value: Any) -> Optional[datetime]:
            if isinstance(value, datetime):
                return value
            if isinstance(value, str):
                try:
                    return datetime.fromisoformat(value.replace('Z', '+00:00'))
                except ValueError:
                    return None
            return None

        latest_processed = None
        for file_result in successful_files:
            ts = _parse_timestamp(file_result.get('processed_at') or file_result.get('timestamp'))
            if ts and (latest_processed is None or ts > latest_processed):
                latest_processed = ts

        summary = {
            "pages_processed": total_pages,
            "scan_duration": scan_duration,
            "files_processed": file_count
        }

        update_payload = {
            "stats": stats,
            "status": "completed",
            "updated_at": datetime.utcnow(),
            "summary": summary
        }
        if latest_processed:
            update_payload["processed_at"] = latest_processed
        else:
            update_payload["processed_at"] = datetime.utcnow()

        result = collection.update_one(
            {"batch_id": batch_id},
            {"$set": update_payload}
        )
        return result.modified_count > 0

    def list_batches(self, user_id: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Lists batches for a user with projection for performance."""
        if self.db is None:
            return []
        collection = self.db.batches
        projection = {
            "_id": 0,
            "batch_id": 1,
            "name": 1,
            "created_at": 1,
            "updated_at": 1,
            "processed_at": 1,
            "status": 1,
            "stats": 1,
            "summary": 1,
            "file_count": {"$size": "$files"}
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
        """Create a new user with starter plan tokens initialized."""
        if self.db is None:
            return None
        email = user_data.get("email")
        if not email:
            return None

        collection = self.db["User-Base"]
        
        # Check if user already exists
        if collection.find_one({"email": email}):
            return None
        
        # Clean up any old data from previous account with same email
        # (in case account was deleted and recreated)
        username = user_data.get("username")
        try:
            # Delete old batches
            old_batches = self.db["Batch-Base"].delete_many({
                "$or": [
                    {"user_id": email},
                    {"user_id": username} if username else {}
                ]
            })
            if old_batches.deleted_count > 0:
                logger.info(f"Cleaned up {old_batches.deleted_count} old batches for email: {email}")
            
            # Delete old encrypted file records
            old_files = self.db["file_public_keys"].delete_many({"user_email": email})
            if old_files.deleted_count > 0:
                logger.info(f"Cleaned up {old_files.deleted_count} old encrypted files for email: {email}")
        except Exception as e:
            logger.warning(f"Error cleaning up old data for {email}: {e}")

        now = datetime.utcnow()
        starter_plan = self.get_plan('starter') or {}
        starter_tokens = starter_plan.get('monthly_tokens', 150)
        
        user_doc = {
            **user_data,
            "created_at": now,
            "updated_at": now,
            "plan_id": "starter",
            "account_status": "active",
            "tokens_total": starter_tokens,
            "tokens_used": 0,
            "tokens_balance": starter_tokens,
            "token_period": now.strftime('%Y-%m'),
            "last_token_reset": now,
            "features_enabled": starter_plan.get('features', {
                "export_json": False,
                "lock_json": False,
                "unlock_json": False,
                "advanced_analysis": False,
                "log_records": False
            })
        }
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
        """Update user plan and refresh token allowances."""
        if self.db is None or not email:
            return False
        plan_aliases = {
            'starter': 'starter',
            'free': 'starter',
            'basic': 'starter',
            'professional': 'professional',
            'pro': 'professional',
            'enterprise': 'enterprise',
            'unlimited': 'enterprise'
        }
        normalized_plan = plan_aliases.get((plan or '').strip().lower(), (plan or '').strip().lower())
        billing_normalized = (billing_period or 'monthly').strip().lower()
        if billing_normalized in {'yearly', 'annual', 'annually'}:
            billing_normalized = 'annual'
        else:
            billing_normalized = 'monthly'

        result = self.assign_plan(
            email,
            normalized_plan or 'starter',
            metadata={"source": "settings.update_plan"},
            billing_period=billing_normalized
        )
        return bool(result)

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

    def _sanitize_for_export(self, value: Any) -> Any:
        """Recursively sanitize Mongo documents for safe export."""
        if isinstance(value, dict):
            sanitized: Dict[str, Any] = {}
            for key, item in value.items():
                if key in {'password_hash', 'password', 'otp', 'reset_token', 'resetToken', 'session_tokens', 'sessions'}:
                    continue
                sanitized[key] = self._sanitize_for_export(item)
            return sanitized
        if isinstance(value, list):
            return [self._sanitize_for_export(item) for item in value]
        if isinstance(value, datetime):
            return value.isoformat(timespec='seconds') + 'Z'
        if isinstance(value, ObjectId):
            return str(value)
        return value

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
        if self.db is None or not email:
            return {}
        user = self.get_user_by_email(email)
        if not user:
            return {}

        token_summary = self.get_token_summary(email) or {}
        activity = self.get_user_activity_log(email)

        identifiers = {email}
        if user.get('_id'):
            identifiers.add(str(user['_id']))
        if user.get('username'):
            identifiers.add(user['username'])
        if user.get('user_id'):
            identifiers.add(user['user_id'])

        batch_query = {
            "$or": (
                [{"user_id": ident} for ident in identifiers] +
                [{"owner": ident} for ident in identifiers]
            )
        }

        batches_cursor = self.db.batches.find(batch_query).sort("created_at", DESCENDING).limit(50)
        batches = [self._sanitize_for_export(batch) for batch in batches_cursor]

        profile = self._sanitize_for_export(user)
        preferences = {
            "receiveUpdates": bool(user.get('receiveUpdates')),
            "consentDataProcessing": bool(user.get('consentDataProcessing')),
            "emailUpdates": bool(user.get('emailUpdates')) if 'emailUpdates' in user else bool(user.get('receiveUpdates')),
            "dataConsent": bool(user.get('dataConsent')) if 'dataConsent' in user else bool(user.get('consentDataProcessing'))
        }

        return {
            "generated_at": datetime.utcnow().isoformat(timespec='seconds') + 'Z',
            "profile": profile,
            "preferences": preferences,
            "token_summary": self._sanitize_for_export(token_summary),
            "activity": self._sanitize_for_export(activity),
            "batches": batches
        }

    def clear_user_activity_logs(self, email: str) -> bool:
        """Clear user activity logs."""
        if self.db is None or not email:
            return False

        user = self.db["User-Base"].find_one({"email": email})
        if not user:
            return False

        identifiers = {email}
        if user.get('_id'):
            identifiers.add(str(user['_id']))
        if user.get('username'):
            identifiers.add(user['username'])
        if user.get('user_id'):
            identifiers.add(user['user_id'])

        query_variants = []
        for ident in identifiers:
            query_variants.extend([
                {"user_id": ident},
                {"user": ident},
                {"email": ident},
                {"owner": ident}
            ])

        delete_query = {"$or": query_variants}

        try:
            existing_collections = set(self.db.list_collection_names())
        except Exception:
            existing_collections = set()

        candidate_collections = {
            "ActivityLogs",
            "Activity-Logs",
            "UserActivity",
            "User-Activity",
            "AuditLogs",
            "Audit-Logs",
            "User-Audit",
        }

        total_deleted = 0
        for collection_name in candidate_collections:
            if collection_name in existing_collections:
                result = self.db[collection_name].delete_many(delete_query)
                total_deleted += getattr(result, "deleted_count", 0)

        self.db["User-Base"].update_one(
            {"email": email},
            {
                "$set": {"updated_at": datetime.utcnow()},
                "$unset": {"activity_log": "", "activityLogs": "", "recentActivity": ""}
            }
        )
        return True

    def delete_user_account(self, email: str, reason: str) -> bool:
        """Delete user account and all associated data."""
        if self.db is None:
            return False
        
        # Check if user exists in User-Base
        user = self.db["User-Base"].find_one({"email": email})
        if not user:
            logger.warning(f"User not found for deletion: {email}")
            return False
        
        username = user.get('username')
        
        # Add to DeletedUsers collection (update if already exists)
        try:
            self.db["DeletedUsers"].update_one(
                {"email": email},
                {
                    "$set": {
                        "email": email,
                        "full_name": user.get('fullName'),
                        "username": username,
                        "reason": reason,
                        "deleted_at": datetime.utcnow()
                    }
                },
                upsert=True  # Insert if doesn't exist, update if it does
            )
        except Exception as e:
            logger.error(f"Error adding to DeletedUsers collection: {e}")
            # Continue with deletion even if this fails
        
        # Delete all batches associated with this user (by email and username)
        try:
            batch_delete_result = self.db["Batch-Base"].delete_many({
                "$or": [
                    {"user_id": email},
                    {"user_id": username}
                ]
            })
            logger.info(f"Deleted {batch_delete_result.deleted_count} batches for user: {email}")
        except Exception as e:
            logger.error(f"Error deleting batches: {e}")
        
        # Delete OTP records
        try:
            self.db["OTP-Storage"].delete_many({"mobile": user.get('phoneNumber')})
        except Exception as e:
            logger.error(f"Error deleting OTP records: {e}")
        
        # Delete encrypted file records
        try:
            self.db["file_public_keys"].delete_many({"user_email": email})
        except Exception as e:
            logger.error(f"Error deleting encrypted file records: {e}")
        
        # Delete from User-Base
        result = self.db["User-Base"].delete_one({"email": email})
        if result.deleted_count > 0:
            logger.info(f"Successfully deleted user account and all associated data: {email}")
            return True
        else:
            logger.warning(f"User deletion failed: {email}")
            return False

    # ------------------------------------------------------------------
    # Payment History
    # ------------------------------------------------------------------
    def save_payment_history(self, payment_data: Dict[str, Any]) -> Optional[str]:
        """Save payment history record."""
        if self.db is None:
            return None
        
        try:
            payment_record = {
                "user_email": payment_data.get("user_email"),
                "payment_id": payment_data.get("payment_id"),
                "order_id": payment_data.get("order_id"),
                "amount": payment_data.get("amount"),  # in paise
                "currency": payment_data.get("currency", "INR"),
                "type": payment_data.get("type"),  # 'plan_upgrade' or 'token_addon'
                "plan_id": payment_data.get("plan_id"),
                "plan_name": payment_data.get("plan_name"),
                "billing_period": payment_data.get("billing_period"),
                "token_amount": payment_data.get("token_amount"),
                "status": "completed",
                "created_at": datetime.utcnow(),
                "payment_method": payment_data.get("payment_method", "razorpay")
            }
            
            result = self.db["PaymentHistory"].insert_one(payment_record)
            logger.info(f"Payment history saved: {result.inserted_id}")
            return str(result.inserted_id)
        except Exception as e:
            logger.error(f"Error saving payment history: {e}")
            return None
    
    def get_payment_history(self, user_email: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get payment history for a user."""
        if self.db is None:
            return []
        
        try:
            payments = list(
                self.db["PaymentHistory"]
                .find({"user_email": user_email})
                .sort("created_at", DESCENDING)
                .limit(limit)
            )
            
            # Convert ObjectId to string
            for payment in payments:
                if '_id' in payment:
                    payment['_id'] = str(payment['_id'])
            
            return payments
        except Exception as e:
            logger.error(f"Error fetching payment history: {e}")
            return []

mongo_client = MongoClientWrapper()
