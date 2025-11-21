"""
Unified PII Detection API
Routes detection to appropriate format-specific detectors
"""

import logging
import os
from typing import Dict
from pathlib import Path
from pii_detector_pdf import PDFPIIDetector
from pii_detector_txt import TXTPIIDetector
from pii_detector_docx import DOCXPIIDetector

logger = logging.getLogger(__name__)


class UnifiedPIIDetector:
    """Unified PII detector for multiple file formats"""
    
    def __init__(self):
        self.pdf_detector = PDFPIIDetector()
        self.txt_detector = TXTPIIDetector()
        self.docx_detector = DOCXPIIDetector()
    
    def detect_file(self, file_path: str, detailed: bool = False) -> Dict:
        """
        Detect PII in file (auto-detects format)
        
        Args:
            file_path: Path to file
            detailed: If True, returns detailed analysis
            
        Returns:
            dict: Detection results
        """
        file_path = str(file_path)
        
        if not os.path.exists(file_path):
            return {
                'success': False,
                'error': f'File not found: {file_path}'
            }
        
        file_ext = Path(file_path).suffix.lower()
        
        if file_ext == '.pdf':
            if detailed:
                return self.pdf_detector.detect_pii_in_pdf_by_page(file_path)
            return self.pdf_detector.detect_pii_in_pdf(file_path)
        
        elif file_ext == '.txt':
            if detailed:
                return self.txt_detector.detect_pii_in_txt_by_line(file_path)
            return self.txt_detector.detect_pii_in_txt(file_path)
        
        elif file_ext in ['.docx', '.doc']:
            if detailed:
                return self.docx_detector.detect_pii_in_docx_by_element(file_path)
            return self.docx_detector.detect_pii_in_docx(file_path)
        
        else:
            return {
                'success': False,
                'error': f'Unsupported file format: {file_ext}'
            }
    
    def detect_batch(self, file_paths: list, detailed: bool = False) -> Dict:
        """
        Detect PII in multiple files
        
        Args:
            file_paths: List of file paths
            detailed: If True, returns detailed analysis
            
        Returns:
            dict: Batch detection results
        """
        results = {
            'success': True,
            'total_files': len(file_paths),
            'files_processed': 0,
            'total_pii_found': 0,
            'file_results': [],
            'summary_by_format': {}
        }
        
        for file_path in file_paths:
            try:
                result = self.detect_file(file_path, detailed)
                results['file_results'].append(result)
                
                if result.get('success'):
                    results['files_processed'] += 1
                    results['total_pii_found'] += result.get('total_pii_found', 0)
                    
                    file_format = result.get('format', 'Unknown')
                    if file_format not in results['summary_by_format']:
                        results['summary_by_format'][file_format] = {
                            'files': 0,
                            'total_pii': 0
                        }
                    
                    results['summary_by_format'][file_format]['files'] += 1
                    results['summary_by_format'][file_format]['total_pii'] += result.get('total_pii_found', 0)
            
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                results['file_results'].append({
                    'success': False,
                    'file': file_path,
                    'error': str(e)
                })
        
        return results
    
    def detect_directory(self, directory_path: str, pattern: str = "*", detailed: bool = False) -> Dict:
        """
        Detect PII in all files in directory
        
        Args:
            directory_path: Path to directory
            pattern: File pattern (e.g., "*.pdf", "*", etc.)
            detailed: If True, returns detailed analysis
            
        Returns:
            dict: Directory scan results
        """
        try:
            path = Path(directory_path)
            
            if not path.is_dir():
                return {
                    'success': False,
                    'error': f'Not a directory: {directory_path}'
                }
            
            files = list(path.glob(pattern))
            file_paths = [str(f) for f in files if f.is_file()]
            
            return {
                'success': True,
                'directory': directory_path,
                'files_found': len(file_paths),
                'batch_results': self.detect_batch(file_paths, detailed)
            }
        
        except Exception as e:
            logger.error(f"Error scanning directory: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_pii_statistics(self, detection_results: Dict) -> Dict:
        """
        Generate statistics from detection results
        
        Args:
            detection_results: Results from detect_batch or detect_directory
            
        Returns:
            dict: Statistics
        """
        stats = {
            'total_files': detection_results.get('total_files', 0),
            'files_processed': detection_results.get('files_processed', 0),
            'total_pii_found': detection_results.get('total_pii_found', 0),
            'pii_by_format': {},
            'pii_by_category': {},
            'pii_by_type': {}
        }
        
        for result in detection_results.get('file_results', []):
            if result.get('success'):
                # By format
                file_format = result.get('format', 'Unknown')
                if file_format not in stats['pii_by_format']:
                    stats['pii_by_format'][file_format] = 0
                stats['pii_by_format'][file_format] += result.get('total_pii_found', 0)
                
                # By category and type
                categorized = result.get('categorized', {})
                for category, types in categorized.items():
                    if category not in stats['pii_by_category']:
                        stats['pii_by_category'][category] = 0
                    
                    for pii_type, items in types.items():
                        if pii_type not in stats['pii_by_type']:
                            stats['pii_by_type'][pii_type] = 0
                        
                        stats['pii_by_category'][category] += len(items)
                        stats['pii_by_type'][pii_type] += len(items)
        
        return stats


# Export unified detector instance
unified_detector = UnifiedPIIDetector()

