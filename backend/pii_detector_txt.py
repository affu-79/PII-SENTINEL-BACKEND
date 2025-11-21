"""
TXT-Specific PII Detection Module
Detects PII in plain text files with line-by-line analysis
Uses advanced PII detector with 40+ patterns
"""

import logging
from typing import List, Dict
from pii_detector import pii_detector  # Use advanced detector with ALL patterns

logger = logging.getLogger(__name__)


class TXTPIIDetector:
    """TXT-specific PII detection (OPTIMIZED)"""
    
    def __init__(self):
        # No need to initialize - just extract and return text
        pass
    
    def extract_text_from_txt(self, txt_path: str, encoding: str = 'utf-8') -> str:
        """
        Extract text from TXT file
        
        Args:
            txt_path: Path to TXT file
            encoding: Text encoding (default: utf-8)
            
        Returns:
            str: File content
        """
        try:
            with open(txt_path, 'r', encoding=encoding) as f:
                return f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(txt_path, 'r', encoding='latin-1') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Failed to read TXT file with different encodings: {e}")
                return ""
        except Exception as e:
            logger.error(f"Failed to extract text from TXT: {e}")
            return ""
    
    def detect_pii_in_txt(self, txt_path: str) -> Dict:
        """
        Detect PII in TXT file using ADVANCED detector (40+ patterns)
        
        Args:
            txt_path: Path to TXT file
            
        Returns:
            dict: Detection results
        """
        try:
            # Extract text
            text = self.extract_text_from_txt(txt_path)
            
            if not text:
                return {
                    'success': False,
                    'error': 'Failed to extract text from TXT',
                    'detections': []
                }
            
            # Use ADVANCED detector with all patterns
            logger.info(f"Scanning TXT with advanced detector (40+ patterns)...")
            detections = pii_detector.scan_text(text)
            
            # Format detections
            formatted_detections = []
            for detection in detections:
                formatted_detections.append({
                    'type': detection.get('type', 'UNKNOWN'),
                    'value': detection.get('match', detection.get('value', '')),
                    'confidence': detection.get('confidence', 0.5),
                    'start': detection.get('start', 0),
                    'end': detection.get('end', 0)
                })
            
            logger.info(f"✓ Found {len(formatted_detections)} PII instances in TXT")
            
            # Categorize detections
            categorized = self._categorize_detections(formatted_detections)
            
            # Line-by-line analysis
            line_analysis = self._analyze_lines(text)
            
            return {
                'success': True,
                'file': txt_path,
                'format': 'TXT',
                'total_pii_found': len(formatted_detections),
                'detections': formatted_detections,
                'categorized': categorized,
                'file_size': len(text),
                'total_lines': len(text.split('\n')),
                'line_analysis': line_analysis
            }
        
        except Exception as e:
            logger.error(f"Error detecting PII in TXT: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'detections': []
            }
    
    def detect_pii_in_txt_by_line(self, txt_path: str) -> Dict:
        """
        Detect PII in TXT with line-level granularity
        
        Args:
            txt_path: Path to TXT file
            
        Returns:
            dict: Detection results organized by line
        """
        try:
            text = self.extract_text_from_txt(txt_path)
            
            if not text:
                return {
                    'success': False,
                    'error': 'Failed to extract text',
                    'detections': []
                }
            
            lines = text.split('\n')
            line_detections = {}
            all_detections = []
            
            for line_num, line in enumerate(lines, 1):
                if line.strip():  # Skip empty lines
                    detections = self.pii_detector.detect(line)
                    
                    if detections:
                        line_detections[f'line_{line_num}'] = {
                            'line_number': line_num,
                            'line_content': line[:100] + '...' if len(line) > 100 else line,
                            'pii_count': len(detections),
                            'detections': detections,
                            'summary': self.pii_detector.get_pii_summary(detections)
                        }
                        all_detections.extend(detections)
            
            return {
                'success': True,
                'file': txt_path,
                'format': 'TXT',
                'total_lines': len(lines),
                'lines_with_pii': len(line_detections),
                'total_pii_found': len(all_detections),
                'line_detections': line_detections,
                'categorized': self._categorize_detections(all_detections)
            }
        
        except Exception as e:
            logger.error(f"Error detecting PII by line: {e}", exc_info=True)
            return {
                'success': False,
                'error': str(e)
            }
    
    @staticmethod
    def _analyze_lines(text: str) -> Dict:
        """Analyze text structure"""
        lines = text.split('\n')
        
        return {
            'total_lines': len(lines),
            'non_empty_lines': len([l for l in lines if l.strip()]),
            'average_line_length': sum(len(l) for l in lines) / len(lines) if lines else 0,
            'max_line_length': max(len(l) for l in lines) if lines else 0
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
txt_detector = TXTPIIDetector()

