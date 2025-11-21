"""
Helper script to generate secure FLASK_SECRET and API_KEY.
Run this script to generate random secure values for your .env file.
"""
import secrets
import string

def generate_flask_secret(length=32):
    """Generate a secure Flask secret key."""
    # Flask secret should be a random string
    alphabet = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(alphabet) for _ in range(length))

def generate_api_key(length=32):
    """Generate a secure API key."""
    # API key should be URL-safe and random
    alphabet = string.ascii_letters + string.digits + '-_'
    return ''.join(secrets.choice(alphabet) for _ in range(length))

if __name__ == '__main__':
    print("=" * 60)
    print("Generating secure secrets for your .env file")
    print("=" * 60)
    print()
    
    flask_secret = generate_flask_secret(32)
    api_key = generate_api_key(32)
    
    print("FLASK_SECRET=" + flask_secret)
    print("API_KEY=" + api_key)
    print()
    print("=" * 60)
    print("Copy these values to your .env file")
    print("=" * 60)
    print()
    print("Or use these commands to add them to your .env file:")
    print()
    print(f'echo "FLASK_SECRET={flask_secret}" >> .env')
    print(f'echo "API_KEY={api_key}" >> .env')

