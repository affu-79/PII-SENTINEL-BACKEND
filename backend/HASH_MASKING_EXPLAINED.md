# 🎨 Hash Masking Visual Explanation

## What You Requested

> "if user selects hash .. then (first hide the piis with white background on top and on top of this white background (e.g adhaar - xxxx-xxxx-xxxx)..it should be hashed like this..."

---

## ✅ Implementation

The hash masking mode follows your exact requirements in **2 steps**:

### Step 1: Hide PIIs with White Background

```python
# In image_pii_masker.py, _apply_hash_mask() method

# Step 1: Draw white background rectangle
draw.rectangle(
    [(x, y), (x2, y2)],
    fill=options.hash_background_color,  # Default: (255, 255, 255) = White
    outline=options.hash_background_color
)
```

**Visual**:

```
BEFORE:                          AFTER STEP 1:
┌──────────────────────────┐    ┌──────────────────────────┐
│ Aadhaar: 1234-5678-9012  │    │ Aadhaar: ▒▒▒▒▒▒▒▒▒▒▒▒▒▒  │
│ PAN: ABCDE1234F          │    │ PAN: ▒▒▒▒▒▒▒▒▒▒▒         │
└──────────────────────────┘    └──────────────────────────┘
                                         ↑
                                    White rectangles
                                    cover the PIIs
```

---

### Step 2: Display Hashed Text on Top

```python
# In image_pii_masker.py, _apply_hash_mask() method

# Step 2: Create hash text
hash_text = self._create_hash_text(pii_type, original_value, masked_value)
# Example: "AADHAAR: XXXX-XXXX-1234"

# Step 3: Draw hash text on top of white background
draw.text(
    (text_x, text_y),
    hash_text,
    fill=options.hash_text_color,  # Default: (0, 0, 0) = Black
    font=font
)
```

**Visual**:

```
AFTER STEP 2 (Final Result):
┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │
│ │ AADHAAR: XXXX-XXXX-9012          │ │  ← Black text on white background
│ └──────────────────────────────────┘ │
│ ┌──────────────────────────────────┐ │
│ │ PAN: XXXDE1234F                  │ │  ← Black text on white background
│ └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

---

## 🎯 Hash Text Format

The `_create_hash_text()` method generates the display text:

```python
def _create_hash_text(self, pii_type: str, original_value: str, masked_value: str) -> str:
    """
    Create hash text for display
    Format: "AADHAAR: XXXX-XXXX-1234"
    """
    if masked_value and masked_value != original_value:
        # Use masked value from PII detection
        hash_text = f"{pii_type}: {masked_value}"
    else:
        # Create default hash pattern
        if len(original_value) > 4:
            visible_part = original_value[-4:]  # Last 4 characters
            hash_part = 'X' * (len(original_value) - 4)
            hash_text = f"{pii_type}: {hash_part}{visible_part}"
        else:
            hash_text = f"{pii_type}: {'X' * len(original_value)}"
    
    return hash_text
```

### Examples:

| PII Type | Original Value | Hash Display |
|----------|----------------|--------------|
| AADHAAR | 1234-5678-9012 | `AADHAAR: XXXX-XXXX-9012` |
| PAN | ABCDE1234F | `PAN: XXXDE1234F` |
| PHONE | 9876543210 | `PHONE: ******3210` |
| EMAIL | user@gmail.com | `EMAIL: u***@gmail.com` |
| VOTER_ID | ABC1234567 | `VOTER_ID: ABC****567` |

---

## 🖼️ Real-World Example

### Input Image (Aadhaar Card):

```
┌──────────────────────────────────────────────────────────┐
│                     GOVERNMENT OF INDIA                   │
│                         AADHAAR                           │
│                                                            │
│  Name: Rajesh Kumar                                       │
│  DOB: 15/03/1985                                          │
│  Aadhaar Number: 1234-5678-9012                          │
│  Address: 123, MG Road, Bangalore                         │
│                                                            │
│  [Photo]                                                  │
└──────────────────────────────────────────────────────────┘
```

### After Hash Masking:

```
┌──────────────────────────────────────────────────────────┐
│                     GOVERNMENT OF INDIA                   │
│                         AADHAAR                           │
│                                                            │
│  Name: Rajesh Kumar                                       │
│  DOB: 15/03/1985                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │ AADHAAR: XXXX-XXXX-9012                            │  │  ← Hash masked
│  └────────────────────────────────────────────────────┘  │
│  Address: 123, MG Road, Bangalore                         │
│                                                            │
│  [Photo]                                                  │
└──────────────────────────────────────────────────────────┘
```

**Process**:
1. ✅ White rectangle covers original Aadhaar number
2. ✅ Black text "AADHAAR: XXXX-XXXX-9012" displayed on top

---

## 🔧 Customization

You can customize the colors:

```python
MaskingOptions(
    mask_type='hash',
    hash_background_color=(255, 255, 255),  # White
    hash_text_color=(0, 0, 0),              # Black
    padding=5                                # Padding around box
)
```

### Different Color Schemes:

#### Light Theme (Default)
```python
hash_background_color=(255, 255, 255)  # White bg
hash_text_color=(0, 0, 0)              # Black text
```
Result: `[White box with black text]`

#### Dark Theme
```python
hash_background_color=(33, 33, 33)     # Dark gray bg
hash_text_color=(255, 255, 255)        # White text
```
Result: `[Dark box with white text]`

#### Highlighted
```python
hash_background_color=(255, 255, 0)    # Yellow bg
hash_text_color=(0, 0, 0)              # Black text
```
Result: `[Yellow box with black text]`

#### Warning
```python
hash_background_color=(255, 0, 0)      # Red bg
hash_text_color=(255, 255, 255)        # White text
```
Result: `[Red box with white text]`

---

## 📐 Technical Details

### Bounding Box Calculation

```python
# Add padding around the PII region
x = max(0, bbox['x'] - options.padding)
y = max(0, bbox['y'] - options.padding)
x2 = min(image.width, bbox['x'] + bbox['width'] + options.padding)
y2 = min(image.height, bbox['y'] + bbox['height'] + options.padding)
```

### Adaptive Font Size

```python
# Font size adapts to bounding box height
bbox_height = y2 - y
font_size = max(10, min(int(bbox_height * 0.6), 24))
```

**Result**: Small PIIs → small font, Large PIIs → large font

### Text Centering

```python
# Calculate text position (centered in bbox)
text_bbox = draw.textbbox((0, 0), hash_text, font=font)
text_width = text_bbox[2] - text_bbox[0]
text_height = text_bbox[3] - text_bbox[1]

# Center text
text_x = x + (x2 - x - text_width) / 2
text_y = y + (y2 - y - text_height) / 2
```

**Result**: Text is perfectly centered in the white box

---

## ✅ Requirements Met

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Hide PIIs with white background | ✅ | `draw.rectangle()` with white fill |
| Display hash on top | ✅ | `draw.text()` with hash format |
| Format: "AADHAAR: XXXX-XXXX-1234" | ✅ | `_create_hash_text()` method |
| Centered text | ✅ | Text centering calculation |
| Adaptive sizing | ✅ | Font size adapts to bbox |
| Customizable colors | ✅ | `MaskingOptions` parameters |

---

## 🎬 Live Demo

Run this to see it in action:

```bash
python test_image_masking.py --interactive
```

**Steps**:
1. Upload an image with Aadhaar number
2. Select "AADHAAR" to mask
3. Select "Hash" mode
4. See the result: white box with "AADHAAR: XXXX-XXXX-####"

---

## 🎨 Visual Comparison

```
┌──────────────────────────────────────────────────────────────┐
│                      MASKING MODES                            │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  ORIGINAL:                                                    │
│  ┌────────────────────────────────────────┐                 │
│  │ Aadhaar Number: 1234-5678-9012         │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
│  BLACKOUT MODE:                                               │
│  ┌────────────────────────────────────────┐                 │
│  │ Aadhaar Number: ███████████████        │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
│  HASH MODE (YOUR REQUEST): ⭐                                │
│  ┌────────────────────────────────────────┐                 │
│  │ ┌────────────────────────────────────┐ │                 │
│  │ │ AADHAAR: XXXX-XXXX-9012            │ │  ← White + Hash │
│  │ └────────────────────────────────────┘ │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
│  BLUR MODE:                                                   │
│  ┌────────────────────────────────────────┐                 │
│  │ Aadhaar Number: ░▒▓█▓▓▓▓█▓▒░           │                 │
│  └────────────────────────────────────────┘                 │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Next Steps

1. **Test it**:
   ```bash
   python test_image_masking.py --interactive
   ```

2. **Integrate into frontend**:
   - Add masking mode selector (dropdown)
   - Add PII type checkboxes
   - Add "Apply Masking" button
   - Call `/api/pii/image/mask` endpoint

3. **Customize colors** (optional):
   - Edit `MaskingOptions` in `image_pii_masker.py`
   - Try different background/text color combinations

---

**Your exact requirement has been implemented! 🎯**

**Hash Mode Process:**
1. ✅ First, hide PIIs with white background
2. ✅ Then, display hashed text on top (e.g., "AADHAAR: XXXX-XXXX-1234")

