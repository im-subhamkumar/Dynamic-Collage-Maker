#  Dynamic Collage Maker

Welcome to the **Dynamic Collage Maker**! This is a powerful, fully-client-side web application built in a single HTML file that lets you generate stunning, high-resolution photo collages with zero hassle. 

Whether you're a photographer looking to print a 20x30 inch poster, or just someone putting together a quick memory board, this tool is designed to feel like a professional editing suite right in your browser.

##  Why This Exists
I wanted a collage maker that wasn't restricted to rigid, pre-defined templates. Most tools force you into a specific layout or limit the number of photos you can use. 

This project solves that by using a custom-built **Monte-Carlo Layout Evaluation Engine**. Under the hood, it rapidly generates thousands of random grid combinations in milliseconds, automatically selecting the most visually pleasing layout that naturally favors professional 2:3 (portrait) and 1:1 (square) aspect ratios. It's organized chaos that looks beautiful every single time!

##  Features

* **Infinite Dynamic Layouts:** Use the slider to choose anywhere from 1 to 100 photos. The algorithm will automatically build a perfect, interlocking grid for your exact number.
* **Target Orientations:** Want exactly 15 portraits and 14 landscapes? No problem. Check the "Target Orientation" box, dial in your numbers, and the engine will instantly sculpt a grid that perfectly matches your constraints.
* **Print-Ready Dimensions:** Type in your exact desired print size in inches (e.g., 20x30). The canvas mathematically scales on your screen and exports a massive, pixel-perfect **300 DPI high-resolution** image ready for professional printing.
* **Interactive Editing:** 
  * **Swap Mode:** Drag and drop photos to instantly swap their positions.
  * **Pan/Crop Mode:** Click and drag inside a photo to manually adjust its focal point and cropping.
* **Granular Controls:** Fine-tune the outer border thickness (in inches) and the inner gaps between photos (in pixels) using smooth sliders.
* **Custom Backgrounds:** Pick any foundational hex color, or upload your own custom background image that cleanly renders beneath your layout gaps.
* **Batch Uploading:** Select all your photos at once and watch them populate the grid instantly.

##  How to Use It

Because the entire application runs locally in your browser (no server or database required!), getting started is incredibly simple:

1. Clone or download this repository.
2. Open `index.html` directly in your favorite modern web browser (Chrome, Safari, Edge).
3. Use the **Dimensions** inputs on the left sidebar to set your project size. (Use the ↻ button to quickly swap between portrait and landscape!)
4. Adjust your photo count, gaps, borders, and background.
5. Click **Upload Folder** to add your images.
6. Drag to swap or adjust your crops.
7. Click **Download Print (300 DPI)** and wait a moment for the high-resolution file to generate and save directly to your computer.

##  Tech Stack
* **HTML5 / CSS3:** Utilizing advanced Flexbox properties to dynamically map aspect ratios and bounds.
* **Vanilla JavaScript:** 
  * The core Monte-Carlo stochastic engine.
  * Native HTML5 Drag and Drop API.
  * Deep HTML `<canvas>` manipulation for stitching and rendering massive 300 DPI exports without external libraries or servers.

Enjoy making beautiful collages effortlessly!
