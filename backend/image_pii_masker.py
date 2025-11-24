"""
Image PII Masking Pipeline
Supports: Blackout masking and Hash masking for detected PIIs in images
"""

import io
import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class MaskingOptions:
    """Options for PII masking"""
    mask_type: str  # 'blackout' or 'hash'
    selected_pii_types: List[str]  # e.g., ['AADHAAR', 'PAN', 'PHONE']
    blackout_color: Tuple[int, int, int] = (0, 0, 0)  # RGB for blackout
    hash_background_color: Tuple[int, int, int] = (255, 255, 255)  # White background
    hash_text_color: Tuple[int, int, int] = (0, 0, 0)  # Black text
    padding: int = 5  # Padding around masked area
    max_height_ratio: float = 0.55  # Clamp height relative to width to avoid oversized blocks
    min_height: int = 12  # Minimum height for mask


class ImagePIIMasker:
    """
    Mask PIIs in images with two modes:
    1. Blackout: Cover PII with solid color
    2. Hash: White background + hashed text (e.g., XXXX-XXXX-1234)
    """
    
    def __init__(self):
        self.font_cache = {}
    
    def _get_font(self, size: int = 20) -> Optional[ImageFont.FreeTypeFont]:
        """Get font for hash text rendering"""
        if size in self.font_cache:
            return self.font_cache[size]
        
        # Try to load a good font
        font_paths = [
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",  # Linux
            "/System/Library/Fonts/Helvetica.ttc",  # macOS
            "C:\\Windows\\Fonts\\arial.ttf",  # Windows
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",  # Linux alt
        ]
        
        for font_path in font_paths:
            if os.path.exists(font_path):
                try:
                    font = ImageFont.truetype(font_path, size)
                    self.font_cache[size] = font
                    return font
                except Exception as e:
                    logger.warning(f"Failed to load font {font_path}: {e}")
        
        # Fallback to default font
        try:
            font = ImageFont.load_default()
            self.font_cache[size] = font
            return font
        except:
            return None
    
    def _should_mask_pii(self, pii_type: str, selected_types: List[str]) -> bool:
        """Check if this PII type should be masked"""
        if not selected_types:
            return True  # If no selection, mask all
        return pii_type in selected_types
    
    def _create_hash_text(self, pii_type: str, original_value: str, masked_value: str) -> str:
        """
        Create hash text for display
        Format: "AADHAAR: XXXX-XXXX-1234"
        """
        # Use masked value if available, otherwise create hash
        if masked_value and masked_value != original_value:
            hash_text = f"{pii_type}: {masked_value}"
        else:
            # Create default hash pattern
            if len(original_value) > 4:
                visible_part = original_value[-4:]
                hash_part = 'X' * (len(original_value) - 4)
                hash_text = f"{pii_type}: {hash_part}{visible_part}"
            else:
                hash_text = f"{pii_type}: {'X' * len(original_value)}"
        
        return hash_text
    
    def _apply_blackout_mask(
        self, 
        image: Image.Image, 
        bbox: Dict[str, int], 
        options: MaskingOptions
    ) -> Image.Image:
        """Apply blackout masking to a PII region"""
        draw = ImageDraw.Draw(image)
        
        # Prepare base dimensions
        width = max(1, int(bbox.get('width', 0)))
        height = max(1, int(bbox.get('height', 0)))
        top = int(bbox.get('y', 0))
        center_y = top + height / 2.0
        
        # Clamp height relative to width to avoid oversized masks
        if options.max_height_ratio and width > 0:
            max_height_allowed = max(options.min_height, int(width * options.max_height_ratio))
            if height > max_height_allowed:
                height = max_height_allowed
                top = max(0, int(center_y - height / 2.0))
        
        # Add padding
        x = max(0, int(bbox.get('x', 0)) - options.padding)
        y = max(0, top - options.padding)
        x2 = min(image.width, x + width + options.padding * 2)
        y2 = min(image.height, y + height + options.padding * 2)
        
        # Draw filled rectangle
        draw.rectangle(
            [(x, y), (x2, y2)],
            fill=options.blackout_color,
            outline=options.blackout_color
        )
        
        return image
    
    def _apply_hash_mask(
        self,
        image: Image.Image,
        bbox: Dict[str, int],
        pii_type: str,
        original_value: str,
        masked_value: str,
        options: MaskingOptions
    ) -> Image.Image:
        """
        Apply hash masking to a PII region
        Steps:
        1. Draw white background rectangle
        2. Draw hashed text on top (e.g., "AADHAAR: XXXX-XXXX-1234")
        """
        draw = ImageDraw.Draw(image)
        
        width = max(1, int(bbox.get('width', 0)))
        height = max(1, int(bbox.get('height', 0)))
        top = int(bbox.get('y', 0))
        center_y = top + height / 2.0
        
        if options.max_height_ratio and width > 0:
            max_height_allowed = max(options.min_height, int(width * options.max_height_ratio))
            if height > max_height_allowed:
                height = max_height_allowed
                top = max(0, int(center_y - height / 2.0))
        
        # Add padding
        x = max(0, int(bbox.get('x', 0)) - options.padding)
        y = max(0, top - options.padding)
        x2 = min(image.width, x + width + options.padding * 2)
        y2 = min(image.height, y + height + options.padding * 2)
        
        # Step 1: Draw white background
        draw.rectangle(
            [(x, y), (x2, y2)],
            fill=options.hash_background_color,
            outline=options.hash_background_color
        )
        
        # Step 2: Create hash text
        hash_text = self._create_hash_text(pii_type, original_value, masked_value)
        
        # Step 3: Calculate font size based on bbox height
        bbox_height = y2 - y
        font_size = max(10, min(int(bbox_height * 0.6), 24))  # Adaptive font size
        
        # Get font
        font = self._get_font(font_size)
        
        # Step 4: Draw hash text
        try:
            # Calculate text position (centered in bbox)
            if font:
                # Get text bounding box
                text_bbox = draw.textbbox((0, 0), hash_text, font=font)
                text_width = text_bbox[2] - text_bbox[0]
                text_height = text_bbox[3] - text_bbox[1]
            else:
                # Estimate without font
                text_width = len(hash_text) * font_size * 0.6
                text_height = font_size
            
            # Center text in bbox
            text_x = x + (x2 - x - text_width) / 2
            text_y = y + (y2 - y - text_height) / 2
            
            # Ensure text stays within image bounds
            text_x = max(x, min(text_x, x2 - text_width))
            text_y = max(y, min(text_y, y2 - text_height))
            
            # Draw text
            draw.text(
                (text_x, text_y),
                hash_text,
                fill=options.hash_text_color,
                font=font
            )
            
        except Exception as e:
            logger.error(f"Failed to draw hash text: {e}")
            # Fallback: just show the white background
            pass
        
        return image
    
    def mask_image(
        self,
        image_bytes: bytes,
        pii_matches: List[Dict[str, Any]],
        options: MaskingOptions
    ) -> bytes:
        """
        Mask PIIs in an image
        
        Args:
            image_bytes: Original image as bytes
            pii_matches: List of detected PIIs with bounding boxes
            options: Masking options (blackout or hash)
        
        Returns:
            Masked image as bytes
        """
        try:
            # Load image
            image = Image.open(io.BytesIO(image_bytes))
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            logger.info(f"🎭 IMAGE MASKING START")
            logger.info(f"   Image size: {image.width}x{image.height}")
            logger.info(f"   Total PIIs received: {len(pii_matches)}")
            logger.info(f"   Mask type: {options.mask_type}")
            logger.info(f"   Selected PII types: {options.selected_pii_types or 'ALL'}")
            
            # Debug: Log first few PIIs
            for i, pii in enumerate(pii_matches[:3]):
                logger.info(f"   PII {i+1}: type={pii.get('type')}, has_bbox={pii.get('bbox') is not None}, bbox={pii.get('bbox')}")
            
            # Filter PIIs to mask based on selected types
            piis_to_mask = [
                pii for pii in pii_matches
                if self._should_mask_pii(pii.get('type', ''), options.selected_pii_types)
                and pii.get('bbox') is not None
            ]
            
            logger.info(f"   PIIs to mask: {len(piis_to_mask)}/{len(pii_matches)}")
            
            if len(piis_to_mask) == 0:
                logger.warning(f"⚠️ NO PIIs TO MASK! Returning original image.")
                logger.warning(f"   Reason: Either no PIIs have bboxes or selection doesn't match")
                return image_bytes
            
            # Apply masking for each PII
            masked_count = 0
            for idx, pii in enumerate(piis_to_mask):
                bbox = pii['bbox']
                
                # Validate bbox
                if not isinstance(bbox, dict):
                    logger.warning(f"   PII {idx+1}: Invalid bbox type: {type(bbox)}, skipping")
                    continue
                
                if not all(k in bbox for k in ['x', 'y', 'width', 'height']):
                    logger.warning(f"   PII {idx+1}: Missing bbox keys: {bbox.keys()}, skipping")
                    continue
                
                logger.info(f"   Masking PII {idx+1}/{len(piis_to_mask)}: {pii.get('type')} at ({bbox['x']}, {bbox['y']}, {bbox['width']}x{bbox['height']})")
                
                if options.mask_type == 'blackout':
                    image = self._apply_blackout_mask(image, bbox, options)
                    masked_count += 1
                elif options.mask_type == 'hash':
                    image = self._apply_hash_mask(
                        image,
                        bbox,
                        pii.get('type', 'PII'),
                        pii.get('value', ''),
                        pii.get('masked_value', ''),
                        options
                    )
                    masked_count += 1
                else:
                    logger.warning(f"Unknown mask type: {options.mask_type}")
            
            logger.info(f"✅ Successfully masked {masked_count} PIIs")
            
            # Convert back to bytes
            output_buffer = io.BytesIO()
            image.save(output_buffer, format='PNG', optimize=True)
            output_buffer.seek(0)
            
            masked_bytes = output_buffer.read()
            
            logger.info(f"   Output size: {len(masked_bytes)} bytes")
            logger.info(f"🎭 IMAGE MASKING COMPLETE\n")
            
            return masked_bytes
            
        except Exception as e:
            logger.error(f"Image masking failed: {e}", exc_info=True)
            raise ValueError(f"Failed to mask image: {str(e)}")
    
    def mask_multiple_images(
        self,
        images_data: List[Tuple[bytes, str, List[Dict[str, Any]]]],
        options: MaskingOptions
    ) -> List[Tuple[str, bytes]]:
        """
        Mask PIIs in multiple images
        
        Args:
            images_data: List of (image_bytes, filename, pii_matches) tuples
            options: Masking options
        
        Returns:
            List of (filename, masked_image_bytes) tuples
        """
        results = []
        
        for image_bytes, filename, pii_matches in images_data:
            try:
                masked_bytes = self.mask_image(image_bytes, pii_matches, options)
                results.append((filename, masked_bytes))
                logger.info(f"✓ Successfully masked {filename}")
            except Exception as e:
                logger.error(f"✗ Failed to mask {filename}: {e}")
                # Return original image on failure
                results.append((filename, image_bytes))
        
        return results


class AdvancedImageMasker(ImagePIIMasker):
    """
    Advanced masking with additional features:
    - Blur masking
    - Pixelate masking
    - Custom patterns
    """
    
    def _apply_blur_mask(
        self,
        image: Image.Image,
        bbox: Dict[str, int],
        blur_strength: int = 25
    ) -> Image.Image:
        """Apply blur masking to a PII region"""
        # Convert to OpenCV format
        img_array = np.array(image)
        
        x = max(0, bbox['x'])
        y = max(0, bbox['y'])
        x2 = min(image.width, bbox['x'] + bbox['width'])
        y2 = min(image.height, bbox['y'] + bbox['height'])
        
        # Extract ROI
        roi = img_array[y:y2, x:x2]
        
        # Apply Gaussian blur
        blurred_roi = cv2.GaussianBlur(roi, (blur_strength, blur_strength), 0)
        
        # Replace ROI
        img_array[y:y2, x:x2] = blurred_roi
        
        # Convert back to PIL
        return Image.fromarray(img_array)
    
    def _apply_pixelate_mask(
        self,
        image: Image.Image,
        bbox: Dict[str, int],
        pixel_size: int = 15
    ) -> Image.Image:
        """Apply pixelate masking to a PII region"""
        # Convert to OpenCV format
        img_array = np.array(image)
        
        x = max(0, bbox['x'])
        y = max(0, bbox['y'])
        x2 = min(image.width, bbox['x'] + bbox['width'])
        y2 = min(image.height, bbox['y'] + bbox['height'])
        
        # Extract ROI
        roi = img_array[y:y2, x:x2]
        h, w = roi.shape[:2]
        
        # Resize down and up to pixelate
        if h > pixel_size and w > pixel_size:
            temp = cv2.resize(roi, (w // pixel_size, h // pixel_size), interpolation=cv2.INTER_LINEAR)
            pixelated_roi = cv2.resize(temp, (w, h), interpolation=cv2.INTER_NEAREST)
            
            # Replace ROI
            img_array[y:y2, x:x2] = pixelated_roi
        
        # Convert back to PIL
        return Image.fromarray(img_array)
    
    def mask_image(
        self,
        image_bytes: bytes,
        pii_matches: List[Dict[str, Any]],
        options: MaskingOptions
    ) -> bytes:
        """
        Extended masking with blur and pixelate options
        """
        if options.mask_type in ['blur', 'pixelate']:
            try:
                # Load image
                image = Image.open(io.BytesIO(image_bytes))
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                
                # Filter PIIs to mask
                piis_to_mask = [
                    pii for pii in pii_matches
                    if self._should_mask_pii(pii.get('type', ''), options.selected_pii_types)
                    and pii.get('bbox') is not None
                ]
                
                # Apply masking
                for pii in piis_to_mask:
                    bbox = pii['bbox']
                    
                    if options.mask_type == 'blur':
                        image = self._apply_blur_mask(image, bbox)
                    elif options.mask_type == 'pixelate':
                        image = self._apply_pixelate_mask(image, bbox)
                
                # Convert back to bytes
                output_buffer = io.BytesIO()
                image.save(output_buffer, format='PNG', optimize=True)
                output_buffer.seek(0)
                
                return output_buffer.read()
                
            except Exception as e:
                logger.error(f"Advanced masking failed: {e}")
                raise
        else:
            # Use parent class for blackout/hash
            return super().mask_image(image_bytes, pii_matches, options)


# Singleton instances
_masker_instance = None
_advanced_masker_instance = None


def get_image_masker(advanced: bool = False):
    """Get or create image masker instance"""
    global _masker_instance, _advanced_masker_instance
    
    if advanced:
        if _advanced_masker_instance is None:
            _advanced_masker_instance = AdvancedImageMasker()
        return _advanced_masker_instance
    else:
        if _masker_instance is None:
            _masker_instance = ImagePIIMasker()
        return _masker_instance

