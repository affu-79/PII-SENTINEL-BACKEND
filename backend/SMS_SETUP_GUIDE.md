# SMS OTP Setup Guide

This guide will help you set up Twilio SMS service to send OTP codes to mobile numbers.

## Prerequisites

1. A Twilio account (free trial available)
2. Python environment with Twilio library installed

## Step 1: Create a Twilio Account

1. Go to [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Sign up for a free account (no credit card required for trial)
3. Verify your email and phone number

## Step 2: Get Your Twilio Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. From the dashboard, you'll see:
   - **Account SID** (starts with `AC...`)
   - **Auth Token** (click "View" to reveal)
3. Copy both values

## Step 3: Get a Twilio Phone Number

1. In Twilio Console, go to **Phone Numbers** → **Manage** → **Buy a number**
2. For India (+91), search for a number with SMS capabilities
3. Select a number and purchase it (free trial includes $15.50 credit)
4. Copy the phone number (format: `+1234567890`)

**Note:** For testing, Twilio provides a trial number that can send SMS to verified numbers only. To send to any number, you'll need to upgrade your account.

## Step 4: Configure Environment Variables

1. Open `backend/.env` file (create it from `env.example` if it doesn't exist)
2. Add the following variables:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
```

Replace with your actual values from Step 2 and Step 3.

## Step 5: Install Twilio Library

```bash
cd backend
pip install twilio
```

Or if using virtual environment:

```bash
cd backend
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac
pip install twilio
```

Or install all requirements:

```bash
pip install -r requirements.txt
```

## Step 6: Restart Backend Server

Restart your Flask backend server to load the new environment variables:

```bash
# Stop the current server (Ctrl+C)
# Then start again
python app.py
# or use the start script
.\start_backend.ps1
```

## Step 7: Test OTP Delivery

1. Open your application
2. Go to Sign In page
3. Select "Sign in with Mobile Number"
4. Enter a 10-digit mobile number
5. Click "Send OTP"
6. Check your mobile phone for the OTP SMS

## Troubleshooting

### OTP not received?

1. **Check backend logs** - Look for error messages
2. **Verify Twilio credentials** - Ensure all three environment variables are set correctly
3. **Check Twilio Console** - Go to Logs → Messaging to see delivery status
4. **Trial account limitations** - Free trial can only send SMS to verified phone numbers. Add your number in Twilio Console → Phone Numbers → Verified Caller IDs

### Error: "Twilio library not installed"

```bash
pip install twilio
```

### Error: "Invalid phone number"

- Ensure phone number format is correct: `+91XXXXXXXXXX` (with country code)
- For India, use `+91` prefix
- Remove any spaces or special characters

### SMS not sending but OTP logged

- Check if Twilio credentials are correctly set in `.env` file
- Verify the `.env` file is in the `backend/` directory
- Restart the backend server after updating `.env`

## Alternative SMS Providers

If you prefer not to use Twilio, you can modify the `send_sms_otp()` function in `backend/app.py` to use:

- **AWS SNS** - For AWS users
- **MessageBird** - Alternative SMS provider
- **TextLocal** - Popular in India
- **Fast2SMS** - Popular in India

## Cost Information

- **Twilio Trial**: Free $15.50 credit (enough for ~1,500 SMS)
- **Pay-as-you-go**: ~$0.0075 per SMS to India
- Check [Twilio Pricing](https://www.twilio.com/pricing) for current rates

## Security Notes

- Never commit `.env` file to version control
- Keep your Auth Token secret
- Use environment variables, not hardcoded credentials
- Rotate credentials periodically

## Support

For Twilio-specific issues, visit:
- [Twilio Documentation](https://www.twilio.com/docs)
- [Twilio Support](https://support.twilio.com/)

