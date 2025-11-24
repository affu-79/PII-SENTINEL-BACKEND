# 🎭 Image PII Masking - Quick Reference

## 🚀 Quick Start

### 1. Test the Pipeline

```bash
# Interactive mode (recommended for first time)
cd backend
python test_image_masking.py --interactive
```

### 2. Single Command Test

```bash
# Hash masking for AADHAAR only
python test_image_masking.py document.png --mask-type hash --pii-types AADHAAR
```

---

## 📌 API Endpoints

### Detect PIIs

```bash
POST /api/pii/image/extract
```

### Mask PIIs

```bash
POST /api/pii/image/mask
```

---

## 🎨 Masking Modes

| Mode | Description | Speed | Use Case |
|------|-------------|-------|----------|
| **blackout** | Solid black rectangles | Fastest | Maximum privacy, compliance |
| **hash** ⭐ | White bg + hashed text | Fast | Professional, user-friendly |
| **blur** | Gaussian blur | Medium | Natural look, photos |
| **pixelate** | Mosaic effect | Medium | Creative, modern style |

---

## 💡 Common Use Cases

### 1. Mask AADHAAR & PAN with Hash Mode

```bash
python test_image_masking.py document.png \
  --mask-type hash \
  --pii-types AADHAAR,PAN
```

**Result**: `masked_hash_document.png`

**Visual**:
```
AADHAAR: XXXX-XXXX-1234
PAN: XXXDE1234X
```

---

### 2. Complete Blackout for All PIIs

```bash
python test_image_masking.py sensitive.png \
  --mask-type blackout
```

**Result**: All detected PIIs covered with black rectangles

---

### 3. Test All Modes at Once

```bash
python test_image_masking.py image.png --test-all
```

**Result**: Creates 4 files:
- `test_output_blackout_image.png`
- `test_output_hash_image.png`
- `test_output_blur_image.png`
- `test_output_pixelate_image.png`

---

## 🔧 Python Integration

```python
import requests
import json

API_KEY = "pii-sentinel-secure-key-2024"
BASE_URL = "http://localhost:5000"

# Step 1: Detect
response = requests.post(
    f"{BASE_URL}/api/pii/image/extract",
    headers={"x-api-key": API_KEY},
    files={"files": open("document.png", "rb")}
)
pii_results = response.json()

# Step 2: Mask
response = requests.post(
    f"{BASE_URL}/api/pii/image/mask",
    headers={"x-api-key": API_KEY},
    files={"files": open("document.png", "rb")},
    data={
        "mask_type": "hash",
        "selected_pii_types": "AADHAAR,PAN",
        "pii_results": json.dumps(pii_results)
    }
)

# Save
with open("masked.png", "wb") as f:
    f.write(response.content)
```

---

## 🎯 Hash Mode Format

The **hash mode** displays PIIs in this format:

```
PII_TYPE: HASHED_VALUE
```

### Examples:

| PII Type | Original | Hash Display |
|----------|----------|--------------|
| AADHAAR | 1234-5678-9012 | `AADHAAR: XXXX-XXXX-9012` |
| PAN | ABCDE1234F | `PAN: XXXDE1234F` |
| PHONE | 9876543210 | `PHONE: ******3210` |
| EMAIL | user@example.com | `EMAIL: u***@example.com` |

**Process**:
1. First, cover PII with white background rectangle
2. Then, draw hashed text on top

---

## 📂 File Structure

```
backend/
├── image_pii_masker.py              # Core masking engine
├── image_ocr_pipeline.py            # PII detection (already exists)
├── app.py                            # API endpoints
├── test_image_masking.py            # Test script
├── IMAGE_MASKING_GUIDE.md           # Full documentation
├── IMAGE_MASKING_IMPLEMENTATION_SUMMARY.md  # Technical summary
└── requirements_image_ocr.txt       # Dependencies
```

---

## ⚙️ Configuration

### Change Hash Colors

Edit `image_pii_masker.py`:

```python
MaskingOptions(
    mask_type='hash',
    hash_background_color=(255, 255, 255),  # White (RGB)
    hash_text_color=(0, 0, 0),              # Black (RGB)
    padding=5
)
```

### Change Blackout Color

```python
MaskingOptions(
    mask_type='blackout',
    blackout_color=(255, 0, 0),  # Red instead of black
)
```

---

## 🐛 Troubleshooting

### Hash text not showing?

**Fix**: Font issue. The masker will auto-fallback to default font.

### Masking looks wrong?

**Fix**: Check bounding boxes from PII detection. Ensure `bbox` coordinates are correct.

### Slow performance?

**Fix**: Use `blackout` mode (fastest) or reduce image resolution.

---

## 📊 Performance Tips

1. **Blackout** is fastest (~0.2s per image)
2. **Hash** is recommended for balance (~0.4s per image)
3. Process multiple images in batch for better efficiency
4. Images are processed in-memory (no disk I/O)

---

## ✅ Checklist

- [ ] Backend running (`python app.py`)
- [ ] Test script works (`python test_image_masking.py --interactive`)
- [ ] API endpoint accessible
- [ ] Hash masking displays correctly
- [ ] Blackout masking works
- [ ] Multiple images → ZIP download works

---

## 🎬 Demo Commands

```bash
# 1. Interactive test (recommended)
python test_image_masking.py --interactive

# 2. Quick hash masking
python test_image_masking.py document.png --mask-type hash

# 3. Test all modes
python test_image_masking.py document.png --test-all

# 4. Selective masking
python test_image_masking.py image.png --pii-types AADHAAR,PAN --mask-type hash
```

---

**That's it! You're ready to mask PIIs in images! 🎭**

For full details, see: `IMAGE_MASKING_GUIDE.md`

