# How to Generate FLASK_SECRET and API_KEY

## Quick Method (Recommended)

Use the provided script:

```bash
python generate_secrets.py
```

This will output secure random values that you can copy to your `.env` file.

## Method 1: Using Python (One-liner)

**Generate FLASK_SECRET:**
```bash
python -c "import secrets, string; print('FLASK_SECRET=' + ''.join(secrets.choice(string.ascii_letters + string.digits + string.punctuation) for _ in range(32)))"
```

**Generate API_KEY:**
```bash
python -c "import secrets, string; print('API_KEY=' + ''.join(secrets.choice(string.ascii_letters + string.digits + '-_') for _ in range(32)))"
```

## Method 2: Using OpenSSL (Linux/macOS)

**Generate FLASK_SECRET:**
```bash
openssl rand -hex 32
```

**Generate API_KEY:**
```bash
openssl rand -base64 32 | tr -d "=+/" | cut -c1-32
```

## Method 3: Using Python Interactive Shell

```python
import secrets
import string

# Generate FLASK_SECRET
flask_secret = ''.join(secrets.choice(string.ascii_letters + string.digits + string.punctuation) for _ in range(32))
print(f"FLASK_SECRET={flask_secret}")

# Generate API_KEY
api_key = ''.join(secrets.choice(string.ascii_letters + string.digits + '-_') for _ in range(32))
print(f"API_KEY={api_key}")
```

## Method 4: Online Generators (Less Secure)

You can use online tools like:
- https://randomkeygen.com/
- https://www.lastpass.com/features/password-generator

**For FLASK_SECRET:** Use a "CodeIgniter Encryption Keys" or "Random Password" generator (32+ characters)

**For API_KEY:** Use a "Random Password" generator (32 characters, alphanumeric + dashes/underscores)

⚠️ **Warning:** Online generators are less secure. Use only for development/testing.

## What These Values Are Used For

### FLASK_SECRET
- Used by Flask for session management
- Used for CSRF token generation
- Should be kept secret and never committed to version control
- **Length:** 32+ characters recommended
- **Format:** Any printable characters

### API_KEY
- Custom authentication key for your API
- Clients must include this in the `X-API-KEY` header
- Should be unique and random
- **Length:** 32 characters recommended
- **Format:** Alphanumeric + dashes/underscores (URL-safe)

## Security Best Practices

1. **Never commit secrets to Git** - Always use `.env` file (already in `.gitignore`)
2. **Use different keys for development and production**
3. **Rotate keys periodically** (especially if compromised)
4. **Use environment variables in production** (not `.env` files)
5. **Restrict access** - Only authorized personnel should know these values

## Adding to Your .env File

After generating the values, update your `.env` file:

```env
MONGO_URI=your-mongo-uri
MONGO_DB_PREFIX=pii_sentinel_
FLASK_SECRET=your-generated-flask-secret-here
API_KEY=your-generated-api-key-here
MAX_WORKERS=16
MAX_CONCURRENCY=50
USE_GPU=true
STORAGE_PATH=./data
FLASK_PORT=5000
FLASK_HOST=0.0.0.0
```

## Example Generated Values

```
FLASK_SECRET=f9F]SnQ=-Z{5".8{/xEYu0v+Z+<]#^TT
API_KEY=oM2cQmKMZQca2xqa9wPaE0QhgzACJwBM
```

**Note:** These are example values. Generate your own unique values!

