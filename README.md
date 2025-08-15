# ECG Simplex Plot Visualizer

A web-based tool for ECG signal upload, R-peak detection, and RR interval visualization on a triangle simplex plot.

## Features

- Upload `.csv` ECG data files
- Automatic R-peak detection from signal data
- RR interval computation
- Simplex triangle plotting of RR sequence patterns
- Runtime statistics logging for benchmarking
- Web-based interface with drag-and-drop upload

## File Structure

```
├── app.py                  # Flask application backend
├── static/
│   └── script.js           # Frontend logic (AJAX handling)
├── templates/
│   └── index.html          # Web interface layout
├── upload/
│   └── example.csv         # Sample ECG input data
├── README.md               # Project overview and instructions
├── DATA.md                 # Data description and runtime benchmarks
```

## How to Use

1. Clone or download this repository.

2. Make sure you have **Python 3.x** and **Flask** installed. You can install Flask with:

   ```bash
   pip install flask
   ```

3. In your terminal, navigate to the folder and run:

   ```bash
   python app.py
   ```

4. Open your browser and go to:

   ```
   http://127.0.0.1:5000
   ```

5. Upload your `.csv` file (or use the provided `example.csv`) to visualize the R-peaks and RR intervals on a triangle plot.

## Example Data

You can find a small sample file under `upload/example.csv` to test the visualization.

## Notes

- Large files are not included in this repository due to GitHub’s 100MB upload limit. Please use small or trimmed sample data for demonstration.
- All core logic is handled in `app.py`, while the frontend upload and plot updates are managed via `index.html` and `script.js`.

## License

This project is for academic use and demonstration only. For external use or publication, please cite accordingly.

© 2025 YukiWei42
