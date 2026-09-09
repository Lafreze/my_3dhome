"""Compatibility entry point: rest now uses the intact original standing figures.
The old inverse seated-mesh reconstruction has been retired because it stretched clothing.
"""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name('export-standing-visitors.py')), run_name='__main__')
