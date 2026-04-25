// ─── DOM References ───────────────────────────────────────────────────────────
        const wrapper     = document.getElementById('collageWrapper');
        const inpWidth    = document.getElementById('inpWidth');
        const inpHeight   = document.getElementById('inpHeight');
        const inpBorder   = document.getElementById('inpBorder');
        const inpGap      = document.getElementById('inpGap');
        const inpCount    = document.getElementById('inpCount');
        const countDisplay= document.getElementById('photoCountDisplay');
        const btnRegenerate = document.getElementById('btnRegenerate');
        const chkUseOrientation = document.getElementById('chkUseOrientation');
        const orientationRow    = document.getElementById('orientationRow');
        const inpPortraits = document.getElementById('inpPortraits');
        const inpSquares   = document.getElementById('inpSquares');
        const fileInput    = document.getElementById('imageInput');

        const inpLandscapes = document.getElementById('inpLandscapes');

        // ─── State ────────────────────────────────────────────────────────────────────
        let currentMode   = 'swap';
        let currentLayout = null;   // { rows: [[{id,ratio},...], ...], largeRows: [[...]], K, borderPx, gapPx, wrapW, wrapH }
        let cellData      = {};     // id → { dataUrl, img, offsetX, offsetY }
        let globalBgImageObj = null;
        let targetAutoFillCellId = null;
        let draggedCellId = null;
        let isPanning = false, panCellId = null;
        let startPanX = 0, startPanY = 0, initOffsetX = 0, initOffsetY = 0;

        // ─── Init ─────────────────────────────────────────────────────────────────────
        function init() {
            setupEventListeners();
            generateAndRender();
        }

        // ─── Core: assign aspect ratios ──────────────────────────────────────────────
        // STRICT: only 3:4 portrait (0.75) or 1:1 square (1.0) — never landscape
        function getPhotoRatios(N) {
            const use = chkUseOrientation.checked;
            let arr = [];
            if (use) {
                let P = parseInt(inpPortraits.value) || 0;
                let S = parseInt(inpSquares.value)   || 0;
                let L = parseInt(inpLandscapes.value) || 0;
                // Clamp mathematically gracefully mapping 4:3 identically dynamically cleanly
                if (P + S + L > N) { 
                    let sc = N / (P + S + L); 
                    P = Math.round(P * sc); S = Math.round(S * sc); L = Math.max(0, N - P - S); 
                }
                const leftover = N - P - S - L;
                for (let i=0;i<P;i++) arr.push(0.75); // portrait 3:4
                for (let i=0;i<S;i++) arr.push(1.0);  // square 1:1
                for (let i=0;i<L;i++) arr.push(1.3333); // landscape 4:3
                for (let i=0;i<leftover;i++) arr.push(0.75); // overflow → portrait
            } else {
                for (let i=0;i<N;i++) {
                    let r = Math.random();
                    if (r < 0.6) arr.push(0.75);
                    else if (r < 0.85) arr.push(1.0);
                    else arr.push(1.3333);
                }
            }
            // Shuffle
            for (let i=arr.length-1;i>0;i--){ let j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]; }
            return arr;
        }

        // ─── Core: pack ratios into justified rows ───────────────────────────────────
        // targetRatioSum = how wide (in ratio units) each row should be
        function packRows(ratios, targetRatioSum) {
            let rows = [];
            let current = [];
            let sum = 0;
            for (let r of ratios) {
                if (sum > 0 && sum + r > targetRatioSum * 1.3) {
                    // close row if adding would overshoot by >30%
                    if (Math.abs(sum - targetRatioSum) < Math.abs(sum + r - targetRatioSum)) {
                        rows.push(current); current = [r]; sum = r; continue;
                    }
                }
                current.push(r); sum += r;
                if (sum >= targetRatioSum * 0.85) { rows.push(current); current = []; sum = 0; }
            }
            if (current.length) rows.push(current);
            return rows;
        }

        // ─── Core: generate layout ────────────────────────────────────────────────────
        function generateAndRender() {
            const N = Math.max(1, parseInt(inpCount.value) || 29);
            const K = Math.max(0, Math.min(4, parseInt(document.getElementById('inpCenterLg').value) || 0));
            const Wdoc = parseFloat(inpWidth.value)  || 30;
            const Hdoc = parseFloat(inpHeight.value) || 20;
            const canvasAspect = Wdoc / Hdoc;

            const borderInches = parseFloat(inpBorder.value) || 0;
            const gapPx = parseFloat(inpGap.value) || 5;

            document.getElementById('valBorder').innerText = `${borderInches}"`;
            document.getElementById('valGap').innerText    = `${gapPx}px`;

            const mainView = document.querySelector('.main-view');
            mainView.style.padding = '40px';
            const viewW = mainView.clientWidth  - 80;
            const viewH = mainView.clientHeight - 80;

            let wrapW, wrapH;
            if (viewW / viewH > canvasAspect) { wrapH = viewH; wrapW = viewH * canvasAspect; }
            else                              { wrapW = viewW; wrapH = viewW / canvasAspect; }

            const borderFrac = borderInches / Wdoc;
            const borderPx   = Math.round(borderFrac * wrapW);
            const innerW = wrapW - 2 * borderPx;
            const innerH = wrapH - 2 * borderPx;

            const allRatios = getPhotoRatios(N);
            const actualK = Math.min(K, allRatios.length);
            const largeRatios = allRatios.slice(0, actualK);
            const smallRatios = allRatios.slice(actualK);

            const packSingles = (ratiosArr, targetSum) => {
                if (ratiosArr.length === 0) return [];
                let rows = [], cur = [], curSum = 0;
                for (let r of ratiosArr) {
                    if (cur.length > 0 && curSum + r * 0.45 > targetSum) {
                        rows.push(cur); cur = []; curSum = 0;
                    }
                    cur.push(r); curSum += r;
                }
                if (cur.length > 0) rows.push(cur);
                return rows;
            };

            const testPhaseLayout = (arrayOfRowArrays) => {
                 let tempH = 0, heights = [];
                 for (let row of arrayOfRowArrays) {
                     let sumRatios = 0, extraW = 0, items = 0;
                     for (let node of row) {
                         if (typeof node === 'number') {
                             sumRatios += node; items++;
                         } else {
                             let cCount = node.length;
                             let aComp = 1 / (node.reduce((s,r) => s + 1/r, 0));
                             sumRatios += aComp; extraW += gapPx * (cCount - 1) * aComp; items++;
                         }
                     }
                     if (sumRatios < 0.01) sumRatios = 0.01;
                     const availW = innerW - gapPx * (Math.max(1, items) - 1) + extraW;
                     const h = availW / sumRatios;
                     heights.push(Math.max(1, h));
                     tempH += Math.max(1, h);
                 }
                 tempH += gapPx * (Math.max(1, arrayOfRowArrays.length) - 1);
                 return { height: tempH, rows: arrayOfRowArrays, heights };
            };

            let bestRowsRaw = [];
            let bestRowHeights = [];
            let bestStretch = Infinity;
            let bestH = 0;

            const BASE_EPOCHS = (actualK === 0 || largeRatios.length === 0) ? 100 : 50;

            for (let epoch = 0; epoch < BASE_EPOCHS; epoch++) {
                // Randomly permutate subset ordering unlocking massive geometric variations organically natively perfectly mapping bounds
                let eSms = [...smallRatios];
                for(let i = eSms.length - 1; i > 0; i--) {
                    let j = Math.floor(Math.random() * (i + 1));
                    [eSms[i], eSms[j]] = [eSms[j], eSms[i]];
                }

                if (actualK === 0 || largeRatios.length === 0) {
                    const totalSm = eSms.reduce((a,b)=>a+b, 0);
                    const maxRows = Math.max(1, eSms.length);
                    for (let r = 1; r <= maxRows; r++) {
                        let partition = packSingles(eSms, totalSm / r);
                        let res = testPhaseLayout(partition);
                        let avgH = res.height / partition.length;
                        let penalty = 0;
                        for (let h of res.heights) {
                            if (h > avgH * 1.4) penalty += 1000;
                            if (h < avgH * 0.7) penalty += 500;
                        }
                        let err = Math.abs(1.0 - (innerH / res.height)) + penalty;
                        if (err < bestStretch) {
                             bestStretch = err; bestRowsRaw = res.rows; bestRowHeights = res.heights; bestH = res.height;
                        }
                    }
                } else {
                    for (let C = 2; C <= 4; C++) {
                        const maxP = Math.floor(eSms.length / (2 * C));
                        let minP = (maxP > 0) ? 1 : 0;
                        if (minP === 0 && eSms.length >= 4) continue; 

                        for (let P = minP; P <= maxP; P++) {
                            const usedMid = 2 * C * P;
                            const midSms = eSms.slice(0, usedMid);
                            const remSms = eSms.slice(usedMid);
                            
                            let midRowConfig = [];
                            for (let i=0; i<P; i++) {
                                let leftCol = [];
                                for (let k=0; k<C; k++) leftCol.push(midSms[i*2*C + k]);
                                midRowConfig.push(leftCol);
                            }
                            for (let l of largeRatios) midRowConfig.push(l);
                            for (let i=0; i<P; i++) {
                                let rightCol = [];
                                for (let k=0; k<C; k++) rightCol.push(midSms[i*2*C + C + k]);
                                midRowConfig.push(rightCol);
                            }
                            
                            if (P === 0 && eSms.length > 0) {
                                midRowConfig = [];
                                let half = Math.floor(eSms.length/2);
                                for(let i=0; i<half; i++) midRowConfig.push(eSms[i]);
                                for(let l of largeRatios) midRowConfig.push(l);
                                for(let i=half; i<eSms.length; i++) midRowConfig.push(eSms[i]);
                            }

                            let topSms = P===0 ? [] : remSms.slice(0, Math.ceil(remSms.length / 2));
                            let botSms = P===0 ? [] : remSms.slice(Math.ceil(remSms.length / 2));
                            
                            let maxTr = Math.max(1, topSms.length);
                            let maxBr = Math.max(1, botSms.length);
                            let topRatSum = topSms.reduce((a,b)=>a+b, 0);
                            let botRatSum = botSms.reduce((a,b)=>a+b, 0);

                            for (let rT = 1; rT <= maxTr; rT++) {
                                for (let rB = 1; rB <= maxBr; rB++) {
                                    let topBlocks = packSingles(topSms, topRatSum / rT);
                                    let botBlocks = packSingles(botSms, botRatSum / rB);
                                    
                                    let layoutCols = [];
                                    if (topBlocks.length > 0 && topBlocks[0].length > 0) layoutCols.push(...topBlocks);
                                    let midIndex = layoutCols.length;
                                    layoutCols.push(midRowConfig);
                                    if (botBlocks.length > 0 && botBlocks[0].length > 0) layoutCols.push(...botBlocks);
                                    
                                    let res = testPhaseLayout(layoutCols);
                                    let objHMid = res.heights[midIndex];
                                    let penalty = 0;
                                    let outerHSum = 0, outerCount = 0;
                                    
                                    for (let ri=0; ri<res.heights.length; ri++) {
                                        if (ri !== midIndex) {
                                            if (res.heights[ri] > objHMid * 0.75) penalty += 1000;
                                            outerHSum += res.heights[ri]; outerCount++;
                                        }
                                    }

                                    if (P > 0 && outerCount > 0) {
                                        let outerAvgH = outerHSum / outerCount;
                                        let innerAvgH = objHMid / C;
                                        if (innerAvgH > outerAvgH * 1.5) penalty += 2000;
                                        if (innerAvgH < outerAvgH * 0.5) penalty += 2000;
                                    }

                                    let err = Math.abs(1.0 - (innerH / res.height)) + penalty;
                                    if (err < bestStretch) {
                                        bestStretch = err; bestRowsRaw = res.rows; bestRowHeights = res.heights; bestH = res.height;
                                    }
                                }
                            }
                        }
                    }
                }
            }

            const structuralStretch = innerH / bestH;
            const finalRowHeights = bestRowHeights.map(h => h * structuralStretch);

            let flatRows = [];
            let idCounter = 1;
            for (let ri = 0; ri < bestRowsRaw.length; ri++) {
                let rowNodes = bestRowsRaw[ri];
                let rowH = finalRowHeights[ri];
                let cells = [];
                let sumRatios = 0, extraW = 0;

                for (let node of rowNodes) {
                    if (typeof node === 'number') sumRatios += node;
                    else {
                        let aComp = 1 / (node.reduce((s,r) => s + 1/r, 0));
                        sumRatios += aComp; extraW += gapPx * (node.length - 1) * aComp;
                    }
                }
                const availW = innerW - gapPx * (Math.max(1, rowNodes.length) - 1) + extraW;

                for (let node of rowNodes) {
                    if (typeof node === 'number') {
                        let renderedW = (node / sumRatios) * availW;
                        cells.push({ type: 'single', id: idCounter++, ratio: node, domW: renderedW });
                    } else {
                        let aComp = 1 / (node.reduce((s,r) => s + 1/r, 0));
                        let renderedW = (aComp / sumRatios) * availW;
                        let innerCells = [];
                        for (let k = 0; k < node.length; k++) {
                            innerCells.push({ id: idCounter++, ratio: node[k], domH: renderedW / node[k] });
                        }
                        cells.push({ type: 'col', domW: renderedW, innerCells });
                    }
                }
                flatRows.push({ height: rowH, cells });
            }

            currentLayout = { flatRows, borderPx, gapPx, wrapW, wrapH, innerW, innerH, K, Wdoc, Hdoc };
            renderLayout();
        }

        // ─── Core: render layout to DOM ───────────────────────────────────────────────
        function renderLayout() {
            if (!currentLayout) return;
            const { flatRows, borderPx, gapPx, wrapW, wrapH, innerW } = currentLayout;

            wrapper.style.width    = `${wrapW}px`;
            wrapper.style.height   = `${wrapH}px`;
            wrapper.style.padding  = `${borderPx}px`;
            wrapper.style.boxSizing = 'border-box';
            wrapper.style.display  = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap      = `${gapPx}px`;
            wrapper.innerHTML = '';

            for (const row of flatRows) {
                const rowEl = document.createElement('div');
                rowEl.style.cssText = [
                    'display:flex', 'flex-direction:row', `gap:${gapPx}px`, 
                    `height:${row.height}px`, 'flex-shrink:0', 'width:100%', 'overflow:hidden'
                ].join(';');

                for (let ci = 0; ci < row.cells.length; ci++) {
                    const cell = row.cells[ci];
                    const cellW = cell.domW;
                    
                    if (cell.type === 'single') {
                        const div = document.createElement('div');
                        div.className = 'cell'; div.dataset.id = cell.id;
                        div.style.cssText = `width:${cellW}px; height:100%; flex-shrink:0; overflow:hidden; position:relative;`;
                        if (ci === row.cells.length - 1) { div.style.flexGrow = '1'; div.style.maxWidth = `${cellW + gapPx}px`; }
                        div.innerHTML = `<div class="placeholder">Click<br>Slot</div><img id="img-${cell.id}">`;
                        attachCellFeatures(div, cell.id); updateCellDOM(cell.id, div);
                        rowEl.appendChild(div);
                    } else {
                        // Composite Column Base Block
                        const colEl = document.createElement('div');
                        colEl.style.cssText = `display:flex; flex-direction:column; gap:${gapPx}px; width:${cellW}px; height:100%; flex-shrink:0; overflow:hidden;`;
                        if (ci === row.cells.length - 1) { colEl.style.flexGrow = '1'; colEl.style.maxWidth = `${cellW + gapPx}px`; }
                        
                        // Parse strictly structured inherent individual heights naturally 
                        for (let ki = 0; ki < cell.innerCells.length; ki++) {
                            const inner = cell.innerCells[ki];
                            const innerH = inner.domH;
                            const innerDiv = document.createElement('div');
                            innerDiv.className = 'cell'; innerDiv.dataset.id = inner.id;
                            innerDiv.style.cssText = `width:100%; height:${innerH}px; flex-shrink:0; overflow:hidden; position:relative;`;
                            if (ki === cell.innerCells.length - 1) { innerDiv.style.flexGrow = '1'; innerDiv.style.maxHeight = `${innerH + gapPx}px`; }
                            innerDiv.innerHTML = `<div class="placeholder">Click<br>Slot</div><img id="img-${inner.id}">`;
                            attachCellFeatures(innerDiv, inner.id); updateCellDOM(inner.id, innerDiv);
                            colEl.appendChild(innerDiv);
                        }
                        rowEl.appendChild(colEl);
                    }
                }
                wrapper.appendChild(rowEl);
            }
            setMode(currentMode);
        }

        // ─── Cell Interaction ─────────────────────────────────────────────────────────
        function attachCellFeatures(cell, id) {
            cell.addEventListener('mousedown', e => {
                if (currentMode === 'pan' && cellData[id] && e.button === 0) {
                    isPanning = true; panCellId = id;
                    startPanX = e.clientX; startPanY = e.clientY;
                    initOffsetX = cellData[id].offsetX; initOffsetY = cellData[id].offsetY;
                    cell.classList.add('panning'); e.preventDefault();
                }
            });
            cell.addEventListener('click', () => {
                if (!cellData[id] || targetAutoFillCellId === id) {
                    targetAutoFillCellId = id; fileInput.click();
                }
            });
            cell.addEventListener('dragover', e => {
                if (currentMode !== 'swap') return;
                e.preventDefault();
                if (draggedCellId && draggedCellId != id) cell.classList.add('drag-over');
            });
            cell.addEventListener('dragleave', () => cell.classList.remove('drag-over'));
            cell.addEventListener('dragstart', e => {
                if (currentMode !== 'swap' || !cellData[id]) { e.preventDefault(); return; }
                draggedCellId = id; cell.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
            });
            cell.addEventListener('dragend', () => { cell.classList.remove('dragging'); draggedCellId = null; });
            cell.addEventListener('drop', e => {
                if (currentMode !== 'swap') return;
                e.preventDefault(); cell.classList.remove('drag-over');
                if (draggedCellId && draggedCellId != id) swapCells(draggedCellId, id);
            });
        }

        function swapCells(idA, idB) {
            [cellData[idA], cellData[idB]] = [cellData[idB], cellData[idA]];
            updateCellDOM(idA); updateCellDOM(idB);
        }

        function updateCellDOM(id, cellOverride = null) {
            const cell = cellOverride || document.querySelector(`.cell[data-id="${id}"]`);
            if (!cell) return;
            const img = cell.querySelector('img');
            const ph  = cell.querySelector('.placeholder');
            if (cellData[id]) {
                img.src = cellData[id].dataUrl;
                img.style.objectPosition = `${cellData[id].offsetX}% ${cellData[id].offsetY}%`;
                img.style.display = 'block';
                if (ph) ph.style.display = 'none';
                if (currentMode === 'swap') cell.draggable = true;
            } else {
                img.style.display = 'none';
                img.src = '';
                if (ph) ph.style.display = '';
                cell.draggable = false;
            }
        }

        function setMode(mode) {
            currentMode = mode;
            document.body.dataset.mode = mode;
            document.getElementById('modeSwapBtn').classList.toggle('active', mode === 'swap');
            document.getElementById('modePanBtn').classList.toggle('active',  mode === 'pan');
            document.querySelectorAll('.cell').forEach(c => {
                c.draggable = (mode === 'swap' && cellData[c.dataset.id]) ? true : false;
            });
        }
        function balanceOrientations(changedId) {
            const N = parseInt(inpCount.value) || 1;
            let P = parseInt(inpPortraits.value) || 0;
            let S = parseInt(inpSquares.value) || 0;
            let L = parseInt(inpLandscapes.value) || 0;

            if (changedId === 'P') P = Math.max(0, P);
            if (changedId === 'S') S = Math.max(0, S);
            if (changedId === 'L') L = Math.max(0, L);

            const adjustVars = (other1, other2, diff) => {
                if (diff === 0) return [other1, other2];
                if (diff > 0) {
                     let sub1 = Math.min(other1, diff); other1 -= sub1; diff -= sub1;
                     let sub2 = Math.min(other2, diff); other2 -= sub2; 
                     return [other1, other2];
                } else {
                     other1 += (-diff); return [other1, other2];
                }
            };

            if (changedId === 'P') {
                if (P > N) P = N;
                let diff = (P + S + L) - N;
                [S, L] = adjustVars(S, L, diff);
            } else if (changedId === 'S') {
                if (S > N) S = N;
                let diff = (P + S + L) - N;
                [P, L] = adjustVars(P, L, diff);
            } else if (changedId === 'L') {
                if (L > N) L = N;
                let diff = (P + S + L) - N;
                [P, S] = adjustVars(P, S, diff);
            } else if (changedId === 'N' || changedId === 'init') {
                let sum = P + S + L;
                if (sum === 0) { P = N; }
                else if (sum !== N) {
                    let rP = P / sum, rS = S / sum;
                    P = Math.round(N * rP);
                    S = Math.round(N * rS);
                    L = N - P - S;
                    if (L < 0) {
                        if (S >= -L) S += L; else if (P >= -L) P += L;
                        L = 0;
                    }
                }
            }

            inpPortraits.value = P;
            inpSquares.value = S;
            inpLandscapes.value = L;
        }

        // ─── High Res Export ─────────────────────────────────────────────────────────
        function generateHighResCanvas() {
            if (!currentLayout) return;
            const { flatRows, borderPx, gapPx, innerW, innerH, Wdoc, Hdoc } = currentLayout;

            const DPI = 300;
            const canvasW = Wdoc * DPI;
            const canvasH = Hdoc * DPI;

            const cvs = document.createElement('canvas');
            cvs.width = canvasW;
            cvs.height = canvasH;
            const ctx = cvs.getContext('2d');

            const sBorder = (borderPx / Math.min(innerW, innerH)) * Math.min(canvasW, canvasH);
            const logicInnerW = canvasW - 2 * sBorder;
            const logicInnerH = canvasH - 2 * sBorder;

            const fillHex = document.getElementById('inpBgColor').value || '#000';
            ctx.fillStyle = fillHex;
            ctx.fillRect(0, 0, canvasW, canvasH);

            const sGap = (gapPx / innerW) * logicInnerW;
            const heightMultiplier = logicInnerH / innerH;

            let curY = sBorder;
            for (const row of flatRows) {
                const rowH = row.height * heightMultiplier;
                let curX = sBorder;

                for (let ci=0; ci<row.cells.length; ci++) {
                    const cell = row.cells[ci];
                    let cellW = (cell.domW / innerW) * logicInnerW;
                    if (ci === row.cells.length - 1) cellW = (logicInnerW + sBorder) - curX;

                    if (cell.type === 'single') {
                        if (cellData[cell.id]) {
                            const cd = cellData[cell.id];
                            drawCover(ctx, cd.img, curX, curY, cellW, rowH, cd.offsetX, cd.offsetY);
                        } else {
                            ctx.fillStyle = '#222'; ctx.fillRect(curX, curY, cellW, rowH);
                        }
                    } else {
                        let curInnerY = curY;
                        for (let ki=0; ki<cell.innerCells.length; ki++) {
                             const inner = cell.innerCells[ki];
                             let innerH = (inner.domH / row.height) * rowH;
                             if (ki === cell.innerCells.length - 1) innerH = (curY + rowH) - curInnerY;
                             
                             if (cellData[inner.id]) {
                                 const cd = cellData[inner.id];
                                 drawCover(ctx, cd.img, curX, curInnerY, cellW, innerH, cd.offsetX, cd.offsetY);
                             } else {
                                 ctx.fillStyle = '#222'; ctx.fillRect(curX, curInnerY, cellW, innerH);
                             }
                             curInnerY += innerH + sGap;
                        }
                    }
                    curX += cellW + sGap;
                }
                curY += rowH + sGap;
            }

            try {
                const url = cvs.toDataURL('image/jpeg', 0.95);
                const a = document.createElement('a');
                a.download = `Collage-${Wdoc}x${Hdoc}-Print.jpg`;
                a.href = url;
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            } catch(e) { alert('Export failed — try reducing dimensions.'); }
        }

        function drawCover(ctx, img, x, y, w, h, ox=50, oy=50) {
            if (w <= 0 || h <= 0) return;
            const ir = img.width / img.height, tr = w / h;
            let sw, sh, sx, sy;
            if (ir > tr) { sh = img.height; sw = sh * tr; sx = (img.width - sw) * (ox/100); sy = 0; }
            else         { sw = img.width;  sh = sw / tr; sx = 0; sy = (img.height - sh) * (oy/100); }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }

        async function loadFileToCell(file, id) {
            return new Promise((resolve) => {
                const reader = new FileReader();
                reader.onload = e => {
                    const img = new Image();
                    img.onload = () => {
                        cellData[id] = {
                            dataUrl: e.target.result,
                            img: img,
                            offsetX: 50,
                            offsetY: 50
                        };
                        updateCellDOM(id);
                        resolve();
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        // ─── Event Listeners ──────────────────────────────────────────────────────────
        function setupEventListeners() {
            // Dimension changes
            ['input','change'].forEach(evt => {
                inpWidth.addEventListener(evt,  generateAndRender);
                inpHeight.addEventListener(evt, generateAndRender);
                inpBorder.addEventListener(evt, generateAndRender);
                inpGap.addEventListener(evt,    generateAndRender);
            });

            document.getElementById('btnRotate').addEventListener('click', () => {
                [inpWidth.value, inpHeight.value] = [inpHeight.value, inpWidth.value];
                generateAndRender();
            });

            window.addEventListener('resize', generateAndRender);

            // Photo count
            inpCount.addEventListener('input', () => {
                countDisplay.innerText = inpCount.value;
                if (chkUseOrientation.checked) balanceOrientations('N');
            });
            inpCount.addEventListener('change', generateAndRender);

            // Center large focus
            const inpCenterLg = document.getElementById('inpCenterLg');
            const valCenterLg = document.getElementById('valCenterLg');
            inpCenterLg.addEventListener('input', () => {
                const k = parseInt(inpCenterLg.value) || 0;
                valCenterLg.innerText = k;
                if (k > 0) {
                    const minCount = k + 2;
                    if (parseInt(inpCount.value) < minCount) {
                        inpCount.value = minCount; countDisplay.innerText = minCount;
                    }
                    inpCount.min = minCount;
                } else { inpCount.min = 1; }
                if (chkUseOrientation.checked) balanceOrientations('N');
            });
            inpCenterLg.addEventListener('change', generateAndRender);

            // Randomize button
            btnRegenerate.addEventListener('click', generateAndRender);

            // Orientation toggle
            chkUseOrientation.addEventListener('change', e => {
                orientationRow.style.opacity      = e.target.checked ? '1' : '0.3';
                orientationRow.style.pointerEvents= e.target.checked ? 'auto' : 'none';
                if (e.target.checked) balanceOrientations('init');
                generateAndRender();
            });

            inpPortraits.addEventListener('input', () => balanceOrientations('P'));
            inpPortraits.addEventListener('change', generateAndRender);

            inpSquares.addEventListener('input', () => balanceOrientations('S'));
            inpSquares.addEventListener('change', generateAndRender);

            inpLandscapes.addEventListener('input', () => balanceOrientations('L'));
            inpLandscapes.addEventListener('change', generateAndRender);

            // Background colour
            document.getElementById('inpBgColor').addEventListener('input', e => {
                document.documentElement.style.setProperty('--bg-color', e.target.value);
            });

            // Background image
            document.getElementById('inpBgImg').addEventListener('change', e => {
                const file = e.target.files[0]; if (!file) return;
                const r = new FileReader();
                r.onload = ev => {
                    globalBgImageObj = new Image();
                    globalBgImageObj.onload = () => {
                        wrapper.style.backgroundImage = `url(${ev.target.result})`;
                    };
                    globalBgImageObj.src = ev.target.result;
                };
                r.readAsDataURL(file);
            });

            // Mode buttons
            document.getElementById('modeSwapBtn').addEventListener('click', () => setMode('swap'));
            document.getElementById('modePanBtn').addEventListener('click',  () => setMode('pan'));

            // Upload folder button
            document.getElementById('btnUpload').addEventListener('click', () => {
                targetAutoFillCellId = null; fileInput.click();
            });

            // File input: fill cells in order
            fileInput.addEventListener('change', async e => {
                const files = Array.from(e.target.files);
                if (!files.length || !currentLayout) return;

                const allIds = [];
                currentLayout.flatRows.forEach(row => {
                    row.cells.forEach(c => {
                        if (c.type === 'single') allIds.push(c.id);
                        else c.innerCells.forEach(ic => allIds.push(ic.id));
                    });
                });
                
                let fillOrder = allIds;
                if (targetAutoFillCellId) {
                    const si = fillOrder.indexOf(parseInt(targetAutoFillCellId));
                    if (si > -1) fillOrder = [...fillOrder.slice(si), ...fillOrder.slice(0, si)];
                }
                const emptyIds   = fillOrder.filter(id => !cellData[id]);
                const targetCells = emptyIds.length > 0 ? emptyIds : fillOrder;
                let fi = 0;
                for (let i=0; i<targetCells.length && fi<files.length; i++, fi++) {
                    await loadFileToCell(files[fi], targetCells[i]);
                }
                fileInput.value = ''; targetAutoFillCellId = null;
            });

            // Pan
            window.addEventListener('mousemove', e => {
                if (!isPanning || currentMode !== 'pan') return;
                const cell = document.querySelector(`.cell[data-id="${panCellId}"]`);
                if (!cell) return;
                const rect = cell.getBoundingClientRect();
                const dx = -((e.clientX - startPanX) / rect.width)  * 100;
                const dy = -((e.clientY - startPanY) / rect.height) * 100;
                let nx = Math.max(0, Math.min(100, initOffsetX + dx));
                let ny = Math.max(0, Math.min(100, initOffsetY + dy));
                cellData[panCellId].offsetX = nx; cellData[panCellId].offsetY = ny;
                cell.querySelector('img').style.objectPosition = `${nx}% ${ny}%`;
            });
            window.addEventListener('mouseup', () => {
                if (isPanning) {
                    const c = document.querySelector(`.cell[data-id="${panCellId}"]`);
                    if (c) c.classList.remove('panning');
                    isPanning = false; panCellId = null;
                }
            });

            // Download
            document.getElementById('btnDownload').addEventListener('click', () => {
                const btn = document.getElementById('btnDownload');
                const og = btn.innerHTML;
                btn.innerHTML = 'Rendering 300 DPI…'; btn.disabled = true;
                setTimeout(() => { generateHighResCanvas(); btn.innerHTML = og; btn.disabled = false; }, 50);
            });
        }

        init();