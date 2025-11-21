"""
PDF-Specific PII Detection Module
Extracts text from PDF and detects PII with high accuracy
Uses advanced PII detector with 40+ patterns
"""

import logging
from typing import List, Dict
import PyPDF2
import pdfplumber
from pii_detector import pii_detector  # Use advanced detector with ALL patterns

logger = logging.getLogger(__name__)


class PDFPIIDetector:
    """PDF-specific PII detection (OPTIMIZED)"""
    
    def __init__(self):
        # No need to initialize - just extract and return text
        pass
    
    def extract_text_from_pdf(self, pdf_path: str) -> str:
        """
        Extract text from PDF file with multiple methods for robustness
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            str: Extracted text
        """
        text = ""
        
        try:
            # Try pdfplumber first (better text extraction)
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages):
                    page_text = page.extract_text()
                    if page_text:
                        text += f"\n--- Page {page_num + 1} ---\n"
                        text += page_text
                        text += "\n"
        except Exception as e:
            logger.warning(f"pdfplumber extraction failed: {e}, trying PyPDF2")
            
            try:
                # Fallback to PyPDF2
                with open(pdf_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    for page_num, page in enumerate(pdf_reader.pages):
                        page_text = page.extract_text()
                        if page_text:
                            text += f"\n--- Page {page_num + 1} ---\n"
                            text += page_text
                            text += "\n"
            except Exception as e:
                logger.error(f"Failed to extract text from PDF: {e}")
                return ""
        
        return text
    
    def detect_pii_in_pdf(self, pdf_path: str) -> Dict:
        """
        Detect PII in PDF file using ADVANCED detector (40+ patterns)
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            dict: Detection results with metadata
        """
        try:
            # Extract text
            text = self.extract_text_from_pdf(pdf_path)
            
            if not text:
                return {
                    'success': False,
                    'error': 'Failed to extract text from PDF',
                    'detections': []
                }
            
            # Use ADVANCED detector with all patterns (Username, Password, API Keys, etc.)
            logger.info(f"Scanning PDF with advanced detector (40+ patterns)...")
            detections = pii_detector.scan_text(text)
            
            # Convert to standard format with page info
            formatted_detections = []
            for detection in detections:
                formatted_detections.append({
                    'type': detection.get('type', 'UNKNOWN'),
                    'value': detection.get('match', detection.get('value', '')),
                    'confidence': detection.get('confidence', 0.5),
                    'start': detection.get('start', 0),
                    'end': detection.get('end', 0),
                    'page': 1  # Will be updated in by_page method
                })
            
            logger.info(f"✓ Found {len(formatted_detections)} PII instances in PDF")
            
            # Categorize detections
            categorized = self._categorize_detections(formatted_detections)
            
            return {
                'success': True,
                'file': pdf_path,
                'format': 'PDF',
                'total_pii_found': len(formatted_detections),
                'detections': formatted_detections,
                'categorized': categorized,
                'extracted_text_length': len(text),
                'pages_processed': text.count('--- Page')
            }
        
        except Exception as e:
            logger.error(f"Error detecting PII in PDF: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'detections': []
            }
    
    def detect_pii_in_pdf_by_page(self, pdf_path: str) -> Dict:
        """
        Detect PII in PDF with page-level granularity using ADVANCED detector
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            dict: Detection results organized by page
        """
        try:
            page_detections = {}
            all_detections = []
            
            with pdfplumber.open(pdf_path) as pdf:
                for page_num, page in enumerate(pdf.pages, 1):
                    page_text = page.extract_text()
                    
                    if page_text:
                        # Use ADVANCED detector
                        detections = pii_detector.scan_text(page_text)
                        
                        # Format detections
                        formatted_detections = []
                        for detection in detections:
                            detection['page'] = page_num
                            formatted_detections.append({
                                'type': detection.get('type', 'UNKNOWN'),
                                'value': detection.get('match', detection.get('value', '')),
                                'confidence': detection.get('confidence', 0.5),
                                'start': detection.get('start', 0),
                                'end': detection.get('end', 0),
                                'page': page_num
                            })
                        
                        page_detections[f'page_{page_num}'] = {
                            'page_number': page_num,
                            'pii_count': len(formatted_detections),
                            'detections': formatted_detections
                        }
                        all_detections.extend(formatted_detections)
            
            return {
                'success': True,
                'file': pdf_path,
                'format': 'PDF',
                'total_pages': len(page_detections),
                'total_pii_found': len(all_detections),
                'page_detections': page_detections,
                'categorized': self._categorize_detections(all_detections)
            }
        
        except Exception as e:
            logger.error(f"Error detecting PII by page: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def _categorize_detections(detections: List[Dict]) -> Dict:
        """Categorize detections by type and category"""
        categorized = {}
        
        for detection in detections:
            category = detection['category']
            pii_type = detection['type']
            
            if category not in categorized:
                categorized[category] = {}
            
            if pii_type not in categorized[category]:
                categorized[category][pii_type] = []
            
            categorized[category][pii_type].append(detection)
        
        return categorized


# Export detector instance
pdf_detector = PDFPIIDetector()

