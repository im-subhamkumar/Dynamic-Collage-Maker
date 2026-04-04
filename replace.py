import os

file_path = '/Users/subham/Downloads/collage/collage.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Replace CSS width/max-height for wrapper:
wrapper_old = """        /* The dynamic Collage Wrapper Container */
        .collage-wrapper {
            background-color: var(--bg-color);
            background-size: cover;
            background-position: center;
            box-sizing: border-box;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 0 1px #444;
            display: flex; 
            /* Dimensions are strictly calculated by JS to prevent flex aspect-ratio warping */
        }"""
wrapper_new = """        /* The dynamic Collage Wrapper Container */
        .collage-wrapper {
            background-color: var(--bg-color);
            background-size: cover;
            background-position: center;
            box-sizing: border-box;
            box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 0 1px #444;
            /* Dimensions and grid display are strictly mapping by JS natively */
        }"""
text = text.replace(wrapper_old, wrapper_new)

# 2. Replace treeRoot with currentLayout
text = text.replace("let treeRoot = null;", "let currentLayout = null;")

# 3. Replace giant loop blocks
start_idx = text.find('function updateSizing() {')
end_idx = text.find('// --- User Interaction Listeners ---')

new_js = """function updateSizing() {
            const borderInches = parseFloat(inpBorder.value) || 0;
            document.getElementById('valBorder').innerText = `${borderInches}"`;
            const gap = parseFloat(inpGap.value) || 0;
            document.getElementById('valGap').innerText = `${gap}px`;
            generateLayoutTree();
        }

        // A mathematically perfect CSS Grid implementation eliminating chaotic binary tree gaps
        // Guarantees all objects abide by exclusively 3:4 portrait or 1:1 square mandates natively.
        function generateLayoutTree() {
            const N = parseInt(inpCount.value) || 29;
            const W_canvas = parseFloat(inpWidth.value) || 30; // In inches
            const H_canvas = parseFloat(inpHeight.value) || 20; // In inches

            const K = parseInt(document.getElementById('inpCenterLg').value) || 0;
            const totalCells = N + 3 * K;
            
            // Baseline mandates 3:4 (0.75) exclusively natively per precise design bounds
            let targetCellRatio = 0.75; 
            if (chkUseOrientation.checked) {
                let p = parseInt(inpPortraits.value) || 0;
                let l = parseInt(inpLandscapes.value) || 0;
                if (l > p) targetCellRatio = 4 / 3; 
                else if (p === l) targetCellRatio = 1.0; 
            }
            
            let targetGridRatio = (W_canvas / H_canvas) / targetCellRatio;
            let bestCols = 1, bestRows = totalCells, bestErr = Infinity;
            
            for (let c = 1; c <= totalCells; c++) {
                let r = Math.ceil(totalCells / c);
                let err = Math.abs((c / r) - targetGridRatio);
                if (err < bestErr) {
                    bestErr = err;
                    bestCols = c; 
                    bestRows = r;
                }
            }
            
            let Cols = bestCols, Rows = bestRows;
            if (K > 0) {
                if (Cols < 2) Cols = 2;
                if (Rows < 2) Rows = 2;
            }
            
            let grid = Array.from({length: Rows}, () => Array(Cols).fill(false));
            let elements = [];
            
            let rCenter = Math.floor(Rows / 2) - 1;
            let cCenter = Math.floor(Cols / 2) - 1;
            if (rCenter < 0) rCenter = 0;
            if (cCenter < 0) cCenter = 0;
            
            let centerSpots = [];
            for(let r=0; r<Rows-1; r++){
                for(let c=0; c<Cols-1; c++){
                    centerSpots.push({r, c, dist: Math.pow(r - rCenter, 2) + Math.pow(c - cCenter, 2)});
                }
            }
            centerSpots.sort((a,b) => a.dist - b.dist);
            
            let kPlaced = 0;
            for (let spot of centerSpots) {
                if (kPlaced >= K) break;
                let {r, c} = spot;
                if (!grid[r][c] && !grid[r+1][c] && !grid[r][c+1] && !grid[r+1][c+1]) {
                    grid[r][c] = true; grid[r+1][c] = true; grid[r][c+1] = true; grid[r+1][c+1] = true;
                    elements.push({ id: kPlaced+1, r, c, w: 2, h: 2, isLarge: true });
                    kPlaced++;
                }
            }
            
            let nPlaced = 0;
            for (let r=0; r<Rows; r++) {
                for (let c=0; c<Cols; c++) {
                    if (!grid[r][c] && nPlaced < (N - kPlaced)) {
                        grid[r][c] = true;
                        elements.push({ id: K + nPlaced + 1, r, c, w: 1, h: 1, isLarge: false });
                        nPlaced++;
                    }
                }
            }
            
            currentLayout = { elements, Cols, Rows, targetCellRatio };
            renderTreeToView();
        }

        // Generate HTML natively mapping array abstractions directly into CSS Grids
        function renderTreeToView() {
            if (!currentLayout) return;
            const { elements, Cols, Rows, targetCellRatio } = currentLayout;
            
            const mainView = document.querySelector('.main-view');
            const availW = mainView.clientWidth - 80; 
            const availH = mainView.clientHeight - 80;
            const gapPx = parseFloat(inpGap.value) || 0;
            
            let ch1 = (availW - (Cols-1)*gapPx) / (Cols * targetCellRatio);
            let ch2 = (availH - (Rows-1)*gapPx) / Rows;
            
            let ch = Math.min(ch1, ch2);
            let cw = ch * targetCellRatio;
            
            let gridW = cw * Cols + gapPx * (Cols - 1);
            let gridH = ch * Rows + gapPx * (Rows - 1);
            
            wrapper.style.width = `${gridW}px`;
            wrapper.style.height = `${gridH}px`;
            wrapper.style.display = 'grid';
            wrapper.style.gridTemplateColumns = `repeat(${Cols}, 1fr)`;
            wrapper.style.gridTemplateRows = `repeat(${Rows}, 1fr)`;
            wrapper.style.gap = `${gapPx}px`;

            wrapper.innerHTML = '';
            
            elements.forEach(el => {
                let div = document.createElement('div');
                div.className = 'cell';
                div.style.gridColumn = `${el.c + 1} / span ${el.w}`;
                div.style.gridRow = `${el.r + 1} / span ${el.h}`;
                div.dataset.id = el.id;
                div.innerHTML = `<div class="placeholder">Click<br>Slot</div><img id="img-${el.id}">`;
                
                attachCellFeatures(div, el.id);
                updateCellDOM(el.id, div);
                wrapper.appendChild(div);
            });
            
            setMode(currentMode);
        }

        """
text = text[:start_idx] + new_js + text[end_idx:]

# 4. Canvas replace
start_high_res = text.find('function generateHighResCanvas() {')
end_high_res = text.find('function drawObjectFitCover(ctx, img,')

high_res_js = """function generateHighResCanvas() {
            const DPI = 300; 
            const W = parseFloat(inpWidth.value) || 30;
            const H = parseFloat(inpHeight.value) || 20;
            const cWidth = W * DPI; 
            const cHeight = H * DPI; 

            const canvas = document.createElement('canvas');
            canvas.width = cWidth;
            canvas.height = cHeight;
            const ctx = canvas.getContext('2d', { alpha: false });

            ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() || '#000000';
            ctx.fillRect(0, 0, cWidth, cHeight);
            
            if (globalBgImageObj) {
                drawObjectFitCover(ctx, globalBgImageObj, 0, 0, cWidth, cHeight, 50, 50);
            }

            // Accurate Dynamic Scaling Matrix Math matched purely mathematically against the visual DOM generator 
            if (!currentLayout) return;
            const { Cols, Rows, elements, targetCellRatio } = currentLayout;
            
            const gapPixelsRaw = parseFloat(inpGap.value) || 0;
            const borderInches = parseFloat(inpBorder.value) || 0;
            const outerPadding = borderInches * DPI; 
            
            const availWPrint = cWidth - 2 * outerPadding;
            const availHPrint = cHeight - 2 * outerPadding;
            
            const domW = document.querySelector('.collage-wrapper').clientWidth;
            const scaleFactor = (cWidth - 2 * outerPadding) / domW;
            const gapPxPrint = gapPixelsRaw * scaleFactor;
            
            let ch1 = (availWPrint - (Cols-1)*gapPxPrint) / (Cols * targetCellRatio);
            let ch2 = (availHPrint - (Rows-1)*gapPxPrint) / Rows;
            let chPrint = Math.min(ch1, ch2);
            let cwPrint = chPrint * targetCellRatio;
            
            let gridWPrint = cwPrint * Cols + gapPxPrint * (Cols - 1);
            let gridHPrint = chPrint * Rows + gapPxPrint * (Rows - 1);
            
            let printOffsetX = (cWidth - gridWPrint) / 2;
            let printOffsetY = (cHeight - gridHPrint) / 2;
            
            elements.forEach(el => {
                let x = printOffsetX + el.c * (cwPrint + gapPxPrint);
                let y = printOffsetY + el.r * (chPrint + gapPxPrint);
                let w = cwPrint * el.w + gapPxPrint * (el.w - 1);
                let h = chPrint * el.h + gapPxPrint * (el.h - 1);
                
                if (cellData[el.id]) {
                    const cd = cellData[el.id];
                    drawObjectFitCover(ctx, cd.img, x, y, w, h, cd.offsetX, cd.offsetY);
                } else {
                    ctx.fillStyle = '#222222';
                    ctx.fillRect(x, y, w, h);
                }
            });

            try {
                const dataURL = canvas.toDataURL('image/jpeg', 0.95);
                const link = document.createElement('a');
                link.download = `HighRes-${W}x${H}-Print.jpg`;
                link.href = dataURL;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (err) {
                alert('Export memory exceeded. Try scaling down inches slightly or closing background tabs.');
            }
        }

        """
text = text[:start_high_res] + high_res_js + text[end_high_res:]

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
