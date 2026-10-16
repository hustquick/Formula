#!/usr/bin/env python3
"""Developer entry point for the application's source-based converter."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).resolve().parents[1] / 'macos/formula-latex-ooxml.py'), run_name='__main__')
