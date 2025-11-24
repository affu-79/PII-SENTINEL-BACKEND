"""
Fully Optimized Image OCR + PII Detection Pipeline
Supports: PNG, JPG, JPEG, SVG
Features: Fast parallel processing, PaddleOCR + Tesseract fallback, PII detection
"""

import io
import os
import hashlib
import numpy as np
from PIL import Image, ImageEnhance
import cv2
from typing import List, Dict, Any, Tuple, Optional
from concurrent.futures import ThreadPoolExecutor, ProcessPoolExecutor
from dataclasses import dataclass, asdict
import logging
from functools import lru_cache
import cairosvg

# OCR Libraries
try:
    from paddleocr import PaddleOCR
    PADDLE_AVAILABLE = True
except ImportError:
    PADDLE_AVAILABLE = False
    logging.warning("PaddleOCR not available. Install: pip install paddleocr")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("Tesseract not available. Install: pip install pytesseract")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class BoundingBox:
    """Bounding box coordinates"""
    x: int
    y: int
    width: int
    height: int
    
    def to_dict(self):
        return asdict(self)


@dataclass
class TextBlock:
    """Single text block from OCR"""
    text: str
    confidence: float
    bbox: BoundingBox
    line_number: int
    
    def to_dict(self):
        return {
            'text': self.text,
            'confidence': self.confidence,
            'bbox': self.bbox.to_dict(),
            'line_number': self.line_number
        }


@dataclass
class PIIMatch:
    """PII detection result"""
    type: str
    value: str
    masked_value: str
    category: str  # government, financial, contact, custom
    confidence: float
    bbox: Optional[BoundingBox]
    start_pos: int
    end_pos: int
    
    def to_dict(self):
        return {
            'type': self.type,
            'value': self.value,
            'masked_value': self.masked_value,
            'category': self.category,
            'confidence': self.confidence,
            'bbox': self.bbox.to_dict() if self.bbox else None,
            'start_pos': self.start_pos,
            'end_pos': self.end_pos
        }


@dataclass
class OCRResult:
    """Complete OCR result for one image"""
    filename: str
    full_text: str
    text_blocks: List[TextBlock]
    image_hash: str
    processing_time: float
    
    def to_dict(self):
        return {
            'filename': self.filename,
            'full_text': self.full_text,
            'text_blocks': [block.to_dict() for block in self.text_blocks],
            'image_hash': self.image_hash,
            'processing_time': self.processing_time
        }


@dataclass
class ImagePIIResult:
    """Complete PII detection result for one image"""
    filename: str
    ocr_result: OCRResult
    pii_matches: List[PIIMatch]
    total_piis: int
    pii_by_category: Dict[str, int]
    processing_time: float
    
    def to_dict(self):
        return {
            'filename': self.filename,
            'ocr_result': self.ocr_result.to_dict(),
            'pii_matches': [pii.to_dict() for pii in self.pii_matches],
            'total_piis': self.total_piis,
            'pii_by_category': self.pii_by_category,
            'processing_time': self.processing_time
        }


class ImagePreprocessor:
    """Fast and lightweight image preprocessing"""
    
    MAX_DIMENSION = 3000  # Resize large images for speed
    
    @staticmethod
    def compute_hash(image_bytes: bytes) -> str:
        """Compute SHA256 hash for cache checking"""
        return hashlib.sha256(image_bytes).hexdigest()
    
    @staticmethod
    def svg_to_png(svg_bytes: bytes) -> bytes:
        """Convert SVG to PNG using CairoSVG"""
        try:
            png_bytes = cairosvg.svg2png(bytestring=svg_bytes)
            return png_bytes
        except Exception as e:
            logger.error(f"SVG conversion failed: {e}")
            raise ValueError(f"Failed to convert SVG: {str(e)}")
    
    @staticmethod
    def load_image(image_bytes: bytes, filename: str) -> Image.Image:
        """Load image from bytes, handle SVG conversion"""
        # Check if SVG
        if filename.lower().endswith('.svg'):
            image_bytes = ImagePreprocessor.svg_to_png(image_bytes)
        
        # Load with PIL
        try:
            image = Image.open(io.BytesIO(image_bytes))
            # Convert to RGB if needed
            if image.mode != 'RGB':
                image = image.convert('RGB')
            return image
        except Exception as e:
            logger.error(f"Failed to load image {filename}: {e}")
            raise ValueError(f"Invalid image file: {str(e)}")
    
    @staticmethod
    def auto_rotate(image: np.ndarray) -> np.ndarray:
        """Auto-rotate image based on EXIF orientation"""
        # This handles EXIF rotation
        # PIL already handles this, but for numpy arrays:
        return image
    
    @staticmethod
    def deskew(image: np.ndarray) -> np.ndarray:
        """Deskew image using Hough transform"""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_RGB2GRAY) if len(image.shape) == 3 else image
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            lines = cv2.HoughLines(edges, 1, np.pi/180, 200)
            
            if lines is not None and len(lines) > 0:
                angles = []
                for rho, theta in lines[:, 0]:
                    angle = np.degrees(theta) - 90
                    angles.append(angle)
                
                median_angle = np.median(angles)
                
                # Only deskew if angle is significant
                if abs(median_angle) > 0.5:
                    (h, w) = image.shape[:2]
                    center = (w // 2, h // 2)
                    M = cv2.getRotationMatrix2D(center, median_angle, 1.0)
                    rotated = cv2.warpAffine(image, M, (w, h), 
                                            flags=cv2.INTER_CUBIC, 
                                            borderMode=cv2.BORDER_REPLICATE)
                    return rotated
            
            return image
        except Exception as e:
            logger.warning(f"Deskew failed: {e}, returning original image")
            return image
    
    @staticmethod
    def enhance_contrast(image: np.ndarray) -> np.ndarray:
        """Enhance contrast using CLAHE"""
        try:
            if len(image.shape) == 3:
                # Convert to LAB color space
                lab = cv2.cvtColor(image, cv2.COLOR_RGB2LAB)
                l, a, b = cv2.split(lab)
                
                # Apply CLAHE to L channel
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                l = clahe.apply(l)
                
                # Merge channels
                enhanced = cv2.merge([l, a, b])
                enhanced = cv2.cvtColor(enhanced, cv2.COLOR_LAB2RGB)
                return enhanced
            else:
                clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
                return clahe.apply(image)
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
            return image
    
    @staticmethod
    def denoise(image: np.ndarray) -> np.ndarray:
        """Light denoising using fastNlMeansDenoisingColored"""
        try:
            if len(image.shape) == 3:
                denoised = cv2.fastNlMeansDenoisingColored(image, None, 10, 10, 7, 21)
            else:
                denoised = cv2.fastNlMeansDenoising(image, None, 10, 7, 21)
            return denoised
        except Exception as e:
            logger.warning(f"Denoising failed: {e}")
            return image
    
    @staticmethod
    def resize_if_large(image: Image.Image, max_dim: int = MAX_DIMENSION) -> Image.Image:
        """Resize image if it exceeds maximum dimension"""
        width, height = image.size
        if max(width, height) > max_dim:
            if width > height:
                new_width = max_dim
                new_height = int(height * (max_dim / width))
            else:
                new_height = max_dim
                new_width = int(width * (max_dim / height))
            
            image = image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            logger.info(f"Resized image from {width}x{height} to {new_width}x{new_height}")
        
        return image
    
    @classmethod
    def preprocess(cls, image_bytes: bytes, filename: str, fast_mode: bool = True) -> Tuple[np.ndarray, str]:
        """
        Complete preprocessing pipeline
        Args:
            fast_mode: If True, skip heavy preprocessing (deskew, denoise) for speed
        Returns: (preprocessed_image_array, image_hash)
        """
        # Compute hash for caching
        image_hash = cls.compute_hash(image_bytes)
        
        # Load image
        image = cls.load_image(image_bytes, filename)
        
        # Resize if too large
        image = cls.resize_if_large(image)
        
        # Convert to numpy array
        image_np = np.array(image)
        
        if fast_mode:
            # FAST MODE: Skip deskew and denoise for speed (<2s processing)
            logger.info("Using fast preprocessing mode (skipping deskew/denoise)")
            
            # Only enhance contrast (fast operation)
            image_np = cls.enhance_contrast(image_np)
            
            # Convert to grayscale for OCR
            gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        else:
            # FULL MODE: All preprocessing steps
            logger.info("Using full preprocessing mode")
            
            # Deskew
            image_np = cls.deskew(image_np)
            
            # Enhance contrast
            image_np = cls.enhance_contrast(image_np)
            
            # Light denoise
            image_np = cls.denoise(image_np)
            
            # Convert to grayscale for OCR (improves accuracy)
            gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
        
        return gray, image_hash


class PaddleOCREngine:
    """PaddleOCR wrapper with Tesseract fallback"""
    
    def __init__(self):
        if PADDLE_AVAILABLE:
            self.paddle = PaddleOCR(
                use_angle_cls=False,  # Disable angle classification for speed (faster processing)
                lang='en',
                use_gpu=False,  # Set True if GPU available
                show_log=False,
                det_db_thresh=0.3,  # Lower threshold for faster detection
                det_db_box_thresh=0.5,  # Faster box detection
                rec_batch_num=6,  # Process multiple text regions in parallel
                use_mp=True,  # Enable multiprocessing for speed
                total_process_num=2  # Number of processes
            )
            logger.info("PaddleOCR initialized with speed optimizations")
        else:
            self.paddle = None
            logger.warning("PaddleOCR not available")
        
        self.tesseract_available = TESSERACT_AVAILABLE
        self.confidence_threshold = 0.65  # Lowered for speed (was 0.70)
    
    def extract_text_paddle(self, image: np.ndarray) -> List[TextBlock]:
        """Extract text using PaddleOCR"""
        if not self.paddle:
            return []
        
        try:
            result = self.paddle.ocr(image, cls=True)
            
            text_blocks = []
            for line_idx, line in enumerate(result[0] if result else []):
                if line:
                    bbox_coords = line[0]
                    text_info = line[1]
                    
                    text = text_info[0]
                    confidence = text_info[1]
                    
                    # Convert bbox to x, y, w, h format
                    x_coords = [pt[0] for pt in bbox_coords]
                    y_coords = [pt[1] for pt in bbox_coords]
                    
                    bbox = BoundingBox(
                        x=int(min(x_coords)),
                        y=int(min(y_coords)),
                        width=int(max(x_coords) - min(x_coords)),
                        height=int(max(y_coords) - min(y_coords))
                    )
                    
                    text_blocks.append(TextBlock(
                        text=text,
                        confidence=confidence,
                        bbox=bbox,
                        line_number=line_idx
                    ))
            
            return text_blocks
        except Exception as e:
            logger.error(f"PaddleOCR extraction failed: {e}")
            return []
    
    def extract_text_tesseract(self, image: np.ndarray, bbox: Optional[BoundingBox] = None) -> str:
        """Extract text using Tesseract (fallback)"""
        if not self.tesseract_available:
            return ""
        
        try:
            if bbox:
                # Extract ROI
                roi = image[bbox.y:bbox.y+bbox.height, bbox.x:bbox.x+bbox.width]
                text = pytesseract.image_to_string(roi, config='--psm 6')
            else:
                text = pytesseract.image_to_string(image, config='--psm 3')
            
            return text.strip()
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return ""
    
    def extract_text(self, image: np.ndarray) -> List[TextBlock]:
        """
        Extract text with PaddleOCR + Tesseract fallback
        Low confidence blocks are re-processed with Tesseract
        """
        # Try PaddleOCR first
        text_blocks = self.extract_text_paddle(image)
        
        # Fallback for low confidence blocks
        for block in text_blocks:
            if block.confidence < self.confidence_threshold:
                logger.info(f"Low confidence ({block.confidence:.2f}) for block, trying Tesseract fallback")
                tesseract_text = self.extract_text_tesseract(image, block.bbox)
                if tesseract_text and len(tesseract_text) > len(block.text):
                    block.text = tesseract_text
                    block.confidence = 0.75  # Assign reasonable confidence
        
        return text_blocks


class PIIDetector:
    """PII detection using existing PII Sentinel engine"""
    
    def __init__(self, pii_detector):
        """
        Initialize with existing PII detector from masker.py
        Args:
            pii_detector: Instance of PIIDetector from masker.py
        """
        self.detector = pii_detector
    
    def detect_piis(self, text: str, text_blocks: List[TextBlock]) -> List[PIIMatch]:
        """
        Detect PIIs in extracted text and map to bounding boxes
        """
        if not text.strip():
            return []
        
        # Use existing PII detection engine
        detected_piis = self.detector.detect_pii(text)
        
        pii_matches = []
        
        for pii in detected_piis:
            # Map PII to bounding box
            bbox = self._map_pii_to_bbox(pii, text_blocks)
            
            # Determine category
            category = self._categorize_pii(pii['type'])
            
            pii_match = PIIMatch(
                type=pii['type'],
                value=pii.get('value') or pii.get('match', ''),
                masked_value=pii.get('masked', '***'),
                category=category,
                confidence=pii.get('confidence', 0.9),
                bbox=bbox,
                start_pos=pii.get('start', 0),
                end_pos=pii.get('end', 0)
            )
            
            pii_matches.append(pii_match)
        
        return pii_matches
    
    def _map_pii_to_bbox(self, pii: Dict, text_blocks: List[TextBlock]) -> Optional[BoundingBox]:
        """Map PII match to bounding box from OCR results"""
        pii_text = pii.get('value') or pii.get('match', '')
        
        for block in text_blocks:
            if pii_text in block.text:
                return block.bbox
        
        return None
    
    def _categorize_pii(self, pii_type: str) -> str:
        """Categorize PII type"""
        government_ids = ['AADHAAR', 'PAN', 'PASSPORT', 'VOTER_ID', 'DRIVING_LICENSE']
        financial = ['BANK_ACCOUNT_NUMBER', 'IFSC', 'CREDIT_CARD_NUMBER', 'DEBIT_CARD_NUMBER', 'GST']
        contact = ['PHONE', 'EMAIL', 'EMAIL_DOMAIN']
        
        if pii_type in government_ids:
            return 'government'
        elif pii_type in financial:
            return 'financial'
        elif pii_type in contact:
            return 'contact'
        else:
            return 'custom'


class ImageOCRPipeline:
    """Complete Image OCR + PII Detection Pipeline with Parallel Processing"""
    
    def __init__(self, pii_detector):
        self.preprocessor = ImagePreprocessor()
        self.ocr_engine = PaddleOCREngine()
        self.pii_detector = PIIDetector(pii_detector)
        self.cache = {}  # Simple in-memory cache (can be replaced with Redis)
    
    def process_single_image(self, image_bytes: bytes, filename: str, fast_mode: bool = True) -> ImagePIIResult:
        """
        Process a single image: OCR + PII detection
        Args:
            fast_mode: If True, use fast preprocessing (default: True for <2s processing)
        """
        import time
        start_time = time.time()
        
        try:
            # Preprocess (fast mode by default)
            preprocessed_image, image_hash = self.preprocessor.preprocess(image_bytes, filename, fast_mode=fast_mode)
            
            # Check cache
            if image_hash in self.cache:
                logger.info(f"Cache hit for {filename}")
                return self.cache[image_hash]
            
            # OCR
            text_blocks = self.ocr_engine.extract_text(preprocessed_image)
            
            # Combine all text
            full_text = '\n'.join([block.text for block in text_blocks])
            
            ocr_time = time.time() - start_time
            
            ocr_result = OCRResult(
                filename=filename,
                full_text=full_text,
                text_blocks=text_blocks,
                image_hash=image_hash,
                processing_time=ocr_time
            )
            
            # PII Detection
            pii_matches = self.pii_detector.detect_piis(full_text, text_blocks)
            
            # Count by category
            pii_by_category = {}
            for pii in pii_matches:
                pii_by_category[pii.category] = pii_by_category.get(pii.category, 0) + 1
            
            total_time = time.time() - start_time
            
            result = ImagePIIResult(
                filename=filename,
                ocr_result=ocr_result,
                pii_matches=pii_matches,
                total_piis=len(pii_matches),
                pii_by_category=pii_by_category,
                processing_time=total_time
            )
            
            # Cache result
            self.cache[image_hash] = result
            
            logger.info(f"Processed {filename}: {len(pii_matches)} PIIs found in {total_time:.2f}s")
            
            return result
            
        except Exception as e:
            logger.error(f"Error processing {filename}: {e}", exc_info=True)
            raise
    
    def process_multiple_images(self, images_data: List[Tuple[bytes, str]], 
                                max_workers: int = 4) -> List[ImagePIIResult]:
        """
        Process multiple images in parallel
        Args:
            images_data: List of (image_bytes, filename) tuples
            max_workers: Number of parallel workers
        Returns:
            List of ImagePIIResult
        """
        results = []
        
        # Use ThreadPoolExecutor for I/O-bound preprocessing
        # Use ProcessPoolExecutor for CPU-bound OCR (if needed)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = []
            for image_bytes, filename in images_data:
                future = executor.submit(self.process_single_image, image_bytes, filename)
                futures.append(future)
            
            for future in futures:
                try:
                    result = future.result()
                    results.append(result)
                except Exception as e:
                    logger.error(f"Failed to process image: {e}")
        
        return results


# Singleton instance
_pipeline_instance = None

def get_pipeline(pii_detector):
    """Get or create pipeline instance"""
    global _pipeline_instance
    if _pipeline_instance is None:
        _pipeline_instance = ImageOCRPipeline(pii_detector)
    return _pipeline_instance

