"""
Gunicorn production configuration for PII Sentinel Backend
Optimized for Render.com deployment
"""
import os
import multiprocessing

# Server socket
bind = f"{os.getenv('FLASK_HOST', '0.0.0.0')}:{os.getenv('FLASK_PORT', '10000')}"
backlog = 2048

# Worker processes
# Render.com recommendation: 2-4 workers for starter plan, scale up for production
workers = int(os.getenv('GUNICORN_WORKERS', multiprocessing.cpu_count() * 2 + 1))
worker_class = 'sync'
worker_connections = 1000

# Restart workers after processing this many requests (prevents memory leaks)
max_requests = 1000
max_requests_jitter = 50

# Timeout for requests (important for file processing)
timeout = 120
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = '-'  # Log to stdout (Render captures this)
errorlog = '-'   # Log to stderr (Render captures this)
loglevel = os.getenv('LOG_LEVEL', 'warning').lower()
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# Process naming
proc_name = 'pii-sentinel-backend'

# Server mechanics
daemon = False
pidfile = None  # Don't use pidfile on Render
umask = 0
tmp_upload_dir = None

# Preload app (faster worker startup, but uses more memory)
preload_app = True

# Worker lifecycle hooks
def on_starting(server):
    """Called just before the master process is initialized."""
    server.log.info("🚀 Starting Gunicorn server...")

def when_ready(server):
    """Called just after the server is started."""
    server.log.info("✅ Gunicorn server ready to accept connections")

def on_reload(server):
    """Called when a HUP signal is received (reload config)."""
    server.log.info("🔄 Reloading configuration...")

def worker_int(worker):
    """Called when a worker receives the SIGINT or SIGQUIT signal."""
    worker.log.info("⚠️  Worker received INT or QUIT signal")

def worker_abort(worker):
    """Called when a worker receives the SIGABRT signal."""
    worker.log.info("❌ Worker received ABORT signal")

def pre_fork(server, worker):
    """Called just before a worker is forked."""
    pass

def post_fork(server, worker):
    """Called just after a worker has been forked."""
    server.log.info(f"✓ Worker spawned (pid: {worker.pid})")

def post_worker_init(worker):
    """Called just after a worker has initialized the application."""
    worker.log.info(f"✓ Worker initialized (pid: {worker.pid})")

def worker_exit(server, worker):
    """Called just after a worker has been exited."""
    server.log.info(f"⚠️  Worker exited (pid: {worker.pid})")

def child_exit(server, worker):
    """Called just after a worker has been exited, in the master process."""
    pass

def nworkers_changed(server, new_value, old_value):
    """Called just after num_workers has been changed."""
    server.log.info(f"🔄 Number of workers changed from {old_value} to {new_value}")

def on_exit(server):
    """Called just before exiting Gunicorn."""
    server.log.info("👋 Shutting down Gunicorn server...")

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190

# SSL (Render handles SSL, so these are not needed)
# keyfile = None
# certfile = None

