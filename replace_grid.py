import os
import re

file_path = '/Users/subham/Downloads/collage/collage.html'
with open(file_path, 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('function updateSizing() {')
end_idx = text.find('// --- User Interaction Listeners ---')

new_js = """function updateSizing() {
            const borderInches = parseFloat(inpBorder.value) || 0;
            document.getElementById('valBorder').innerText = `${borderInches}"`;
            const gap = parseFloat(inpGap.value) || 0;
            document.getElementById('valGap').innerText = `${gap}px`;
            
            const W = parseFloat(inpWidth.value) || 30;
            const view = document.querySelector('.main-view');
            // Scale explicit border proportionally mapping output inches
            const borderPx = 20 + (borderInches / W) * view.clientWidth;
            view.style.padding = `${borderPx}px`;

            generateLayoutTree();
        }

        function generateLayoutTree() {
            const N = parseInt(inpCount.value) || 29;
            const W_canvas = parseFloat(inpWidth.value) || 30; 
            const H_canvas = parseFloat(inpHeight.value) || 20; 

            const K = parseInt(document.getElementById('inpCenterLg').value) || 0;
            
            // Baseline mandates 3:4 (0.75) exclusively natively per precise design bounds
            let targetCellRatio = 0.75; 
            if (chkUseOrientation.checked) {
                let p = parseInt(inpPortraits.value) || 0;
                let l = parseInt(inpLandscapes.value) || 0;
                if (l > p) targetCellRatio = 4 / 3; 
                else if (p === l) targetCellRatio = 1.0; 
            }
            
            let targetGridRatio = (W_canvas / H_canvas) / targetCellRatio;
            let best = null;
            let bestErr = Infinity;

            for (let L = K; L <= N / 2 + 1; L++) {
                let A = N + 3 * L;
                for (let R = 1; R <= Math.ceil(Math.sqrt(A)); R++) {
                    if (A % R === 0) {
                        let C = A / R;
                        
                        let err1 = Math.abs((C / R) - targetGridRatio);
                        if (err1 < bestErr) {
                            bestErr = err1;
                            best = { C, R, L, A };
                        }
                        
                        let err2 = Math.abs((R / C) - targetGridRatio);
                        if (err2 < bestErr) {
                            bestErr = err2;
                            best = { C: R, R: C, L, A };
                        }
                    }
                }
            }
            
            if (!best) {
                best = { C: Math.ceil(Math.sqrt(N)), R: Math.ceil(Math.sqrt(N)), L: 0, A: N };
            }
            
            let Cols = best.C, Rows = best.R;
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
            
            let spots = [];
            for(let r=0; r<Rows-1; r++){
                for(let c=0; c<Cols-1; c++){
                    spots.push({r, c, dist: Math.pow(r - rCenter, 2) + Math.pow(c - cCenter, 2)});
                }
            }
            let centerSpots = [...spots].sort((a,b) => a.dist - b.dist);
            
            let lPlaced = 0;
            for (let spot of centerSpots) {
                if (lPlaced >= K) break;
                let {r, c} = spot;
                if (!grid[r][c] && !grid[r+1][c] && !grid[r][c+1] && !grid[r+1][c+1]) {
                    grid[r][c] = true; grid[r+1][c] = true; grid[r][c+1] = true; grid[r+1][c+1] = true;
                    elements.push({ id: lPlaced+1, r, c, w: 2, h: 2, isLarge: true });
                    lPlaced++;
                }
            }
            
            let scatterSpots = [...spots].sort(() => Math.random() - 0.5);
            for (let i=0; i<40; i++) {
                if (lPlaced >= best.L) break;
                let spot = scatterSpots[i % scatterSpots.length];
                if (!spot) continue;
                let {r, c} = spot;
                if (!grid[r][c] && !grid[r+1][c] && !grid[r][c+1] && !grid[r+1][c+1]) {
                    grid[r][c] = true; grid[r+1][c] = true; grid[r][c+1] = true; grid[r+1][c+1] = true;
                    elements.push({ id: lPlaced+1, r, c, w: 2, h: 2, isLarge: true });
                    lPlaced++;
                }
            }
            for (let spot of spots) {
                if (lPlaced >= best.L) break;
                let {r, c} = spot;
                if (!grid[r][c] && !grid[r+1][c] && !grid[r][c+1] && !grid[r+1][c+1]) {
                    grid[r][c] = true; grid[r+1][c] = true; grid[r][c+1] = true; grid[r+1][c+1] = true;
                    elements.push({ id: lPlaced+1, r, c, w: 2, h: 2, isLarge: true });
                    lPlaced++;
                }
            }
            
            let smallSpots = [];
            for (let r=0; r<Rows; r++) {
                for (let c=0; c<Cols; c++) {
                    if (!grid[r][c]) {
                        smallSpots.push({r, c});
                    }
                }
            }
            
            // Randomize to dynamically distribute any black hole bounds properly natively guaranteeing symmetry breakdown
            smallSpots.sort(() => Math.random() - 0.5);
            
            let nPlaced = 0;
            let missingSpotsToFill = N - lPlaced;
            for (let spot of smallSpots) {
                if (nPlaced >= missingSpotsToFill) break;
                elements.push({ id: lPlaced + nPlaced + 1, r: spot.r, c: spot.c, w: 1, h: 1, isLarge: false });
                nPlaced++;
            }
            
            currentLayout = { elements, Cols, Rows, targetCellRatio };
            renderTreeToView();
        }

        function renderTreeToView() {
            if (!currentLayout) return;
            const { elements, Cols, Rows, targetCellRatio } = currentLayout;
            
            const mainView = document.querySelector('.main-view');
            const style = getComputedStyle(mainView);
            const availW = mainView.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
            const availH = mainView.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
            
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
            wrapper.style.padding = '0'; // border dynamically inherited

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

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(text)
print("done")
