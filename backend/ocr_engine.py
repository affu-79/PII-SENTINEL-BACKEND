"""
OCR Engine using EasyOCR (primary) and Tesseract (fallback).
Handles PDF to image conversion and image preprocessing.
"""
import os
import io
import cv2
import numpy as np
from PIL import Image
import logging
import threading
from typing import List, Tuple, Optional
import fitz  # PyMuPDF

logger = logging.getLogger(__name__)

# Try to import EasyOCR
try:
    import easyocr
    EASYOCR_AVAILABLE = True
except ImportError:
    EASYOCR_AVAILABLE = False
    logger.warning("EasyOCR not available, will use Tesseract fallback")

# Try to import Tesseract
try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logger.warning("Tesseract not available, OCR will fail")


class OCREngine:
    """OCR Engine with EasyOCR and Tesseract fallback."""
    
    def __init__(self, use_gpu: bool = False):
        self.use_gpu = use_gpu and os.getenv('USE_GPU', 'false').lower() == 'true'
        self.easyocr_reader = None
        self._init_easyocr()
    
    def _init_easyocr(self):
        """Initialize EasyOCR reader."""
        if EASYOCR_AVAILABLE:
            try:
                # Initialize with English, use quantized model for speed
                # quantize=True makes it faster but slightly less accurate
                quantize = os.getenv('EASYOCR_QUANTIZE', 'true').lower() == 'true'
                self.easyocr_reader = easyocr.Reader(
                    ['en'], 
                    gpu=self.use_gpu,
                    quantize=quantize,
                    verbose=False  # Reduce logging overhead
                )
                logger.info(f"EasyOCR initialized (GPU: {self.use_gpu}, Quantized: {quantize})")
            except Exception as e:
                logger.error(f"Failed to initialize EasyOCR: {e}")
                self.easyocr_reader = None
    
    def preprocess_image(self, image: np.ndarray) -> np.ndarray:
        """Preprocess image for better OCR results."""
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Enhance contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        
        # Deskew (simple rotation correction)
        # This is a simplified version - production should use more sophisticated deskewing
        coords = np.column_stack(np.where(enhanced > 0))
        if len(coords) > 0:
            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            if abs(angle) > 0.5:  # Only correct if significant skew
                (h, w) = enhanced.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                enhanced = cv2.warpAffine(enhanced, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        
        return enhanced
    
    def pdf_to_images(self, pdf_path: str) -> List[Tuple[np.ndarray, int]]:
        """Convert PDF to list of images (one per page)."""
        images = []
        try:
            doc = fitz.open(pdf_path)
            for page_num in range(len(doc)):
                page = doc[page_num]
                # Render page to image (100 DPI for MAXIMUM SPEED - can be increased for better quality)
                # For speed: use 100 DPI, for quality: use 300 DPI
                # Lower DPI = faster processing (4x faster at 100 vs 200 DPI)
                dpi = int(os.getenv('PDF_DPI', '100'))  # Default 100 for maximum speed
                pix = page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72))
                img_data = pix.tobytes("png")
                
                # Convert to numpy array
                img = Image.open(io.BytesIO(img_data))
                img_array = np.array(img)
                
                # Convert RGB to BGR for OpenCV
                if len(img_array.shape) == 3:
                    img_array = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
                
                images.append((img_array, page_num))
            
            doc.close()
            logger.info(f"Converted PDF {pdf_path} to {len(images)} images")
        except Exception as e:
            logger.error(f"Error converting PDF to images: {e}")
        
        return images
    
    def extract_text_easyocr(self, image: np.ndarray) -> Tuple[str, List[Tuple[int, int, int, int]]]:
        """Extract text using EasyOCR."""
        if not self.easyocr_reader:
            return "", []
        
        try:
            results = self.easyocr_reader.readtext(image)
            text_parts = []
            bboxes = []
            
            for (bbox, text, confidence) in results:
                if confidence > 0.15:  # Lower threshold for maximum speed (accept more text)
                    text_parts.append(text)
                    # Convert bbox to (x1, y1, x2, y2) format
                    bbox_array = np.array(bbox)
                    x1, y1 = int(bbox_array[:, 0].min()), int(bbox_array[:, 1].min())
                    x2, y2 = int(bbox_array[:, 0].max()), int(bbox_array[:, 1].max())
                    bboxes.append((x1, y1, x2, y2))
            
            full_text = " ".join(text_parts)
            return full_text, bboxes
        except Exception as e:
            logger.error(f"EasyOCR extraction failed: {e}")
            return "", []
    
    def extract_text_tesseract(self, image: np.ndarray) -> Tuple[str, List[Tuple[int, int, int, int]]]:
        """Extract text using Tesseract."""
        if not TESSERACT_AVAILABLE:
            return "", []
        
        try:
            # Get detailed data with bounding boxes
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            text_parts = []
            bboxes = []
            
            n_boxes = len(data['text'])
            for i in range(n_boxes):
                text = data['text'][i].strip()
                if text and int(data['conf'][i]) > 30:  # Confidence threshold
                    text_parts.append(text)
                    x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
                    bboxes.append((x, y, x + w, y + h))
            
            full_text = " ".join(text_parts)
            return full_text, bboxes
        except Exception as e:
            logger.error(f"Tesseract extraction failed: {e}")
            return "", []
    
    def extract_text(self, image: np.ndarray, preprocess: bool = False) -> Tuple[str, List[Tuple[int, int, int, int]]]:
        """Extract text from image using best available OCR engine (optimized)."""
        # Skip preprocessing by default for speed (can be enabled for better accuracy)
        # Preprocessing adds ~200-500ms overhead per image
        if preprocess:
            image = self.preprocess_image(image)
        
        # Try EasyOCR first (faster on GPU, better accuracy)
        if self.easyocr_reader:
            try:
                text, bboxes = self.extract_text_easyocr(image)
                if text.strip():
                    return text, bboxes
            except Exception as e:
                logger.warning(f"EasyOCR extraction failed: {e}, trying Tesseract")
        
        # Fallback to Tesseract
        if TESSERACT_AVAILABLE:
            try:
                text, bboxes = self.extract_text_tesseract(image)
                if text.strip():
                    return text, bboxes
            except Exception as e:
                logger.warning(f"Tesseract extraction failed: {e}")
        
        logger.warning("No OCR engine available or extraction failed")
        return "", []


# Global instance cache (singleton pattern for better performance)
_ocr_engine_instance = None
_ocr_engine_lock = threading.Lock()

def get_ocr_engine(use_gpu: bool = False) -> OCREngine:
    """Get OCR engine instance (singleton for better performance)."""
    global _ocr_engine_instance
    if _ocr_engine_instance is None:
        with _ocr_engine_lock:
            if _ocr_engine_instance is None:
                _ocr_engine_instance = OCREngine(use_gpu=use_gpu)
    return _ocr_engine_instance

