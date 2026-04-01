const ROWS = 8;
const COLS = 7;
let CELL_SIZE = 60; 
let SIDEBAR_SCALE = 0.55;

if (window.innerWidth <= 1024) {
    CELL_SIZE = (window.innerWidth * 0.94 - 24) / 7;
    SIDEBAR_SCALE = 0.38;
    document.documentElement.style.setProperty('--cell-size', CELL_SIZE + 'px');
    document.documentElement.style.setProperty('--sidebar-scale', String(SIDEBAR_SCALE));
}

function getUniqueRotations(shape) {
    let rots = [];
    let current = shape;
    for(let i=0; i<4; i++) {
        let minR = Infinity, minC = Infinity;
        current.forEach(([r,c]) => {
            minR = Math.min(minR, r);
            minC = Math.min(minC, c);
        });
        current = current.map(([r,c]) => [r - minR, c - minC]);
        
        const str = JSON.stringify(current.slice().sort((a,b) => (a[0]-b[0] === 0 ? a[1]-b[1] : a[0]-b[0])));
        if(!rots.some(r => r.str === str)) {
            rots.push({shape: current, str});
        }
        current = current.map(([r,c]) => [c, -r]);
    }
    return rots.map(r => r.shape);
}

const pGrey = [[0,0], [0,1], [0,2], [0,3]]; 
const pWhite = [[0,0], [0,1], [0,2], [1,1], [2,1]];
const pGreen = [[0,0], [0,2], [1,0], [1,1], [1,2]];
const pOrange = [[0,0], [1,0], [2,0], [2,1]];
const pYellow = [[0,0], [1,0], [2,0], [3,0], [3,1]];
const pBlue = [[0,0], [0,1], [1,1], [2,1], [2,2]];
const pDarkBlue = [[0,0], [0,1], [1,1], [1,2], [1,3]];
const pRed = [[0,0], [0,1], [0,2], [1,0], [2,0]];
const pDarkGreen = [[0,0], [0,1], [1,0], [1,1], [2,0]];
const pPink = [[0,0], [0,1], [1,1], [1,2]];

const PIECE_DEFS = [
    { id: 'grey', colorClass: 'color-grey', shape: pGrey },
    { id: 'white', colorClass: 'color-white', shape: pWhite },
    { id: 'green', colorClass: 'color-green', shape: pGreen },
    { id: 'orange', colorClass: 'color-orange', shape: pOrange },
    { id: 'yellow', colorClass: 'color-yellow', shape: pYellow },
    { id: 'blue', colorClass: 'color-blue', shape: pBlue },
    { id: 'darkblue', colorClass: 'color-darkblue', shape: pDarkBlue },
    { id: 'red', colorClass: 'color-red', shape: pRed },
    { id: 'darkgreen', colorClass: 'color-darkgreen', shape: pDarkGreen },
    { id: 'pink', colorClass: 'color-pink', shape: pPink }
];

PIECE_DEFS.forEach(p => {
    p.rotations = getUniqueRotations(p.shape);
});

const REMOVED_SQUARES = [
    {r: 0, c: 6}, {r: 1, c: 6}, {r: 7, c: 0}, {r: 7, c: 1}, {r: 7, c: 2}, {r: 7, c: 3}
];

const zoneLabels = {};
const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
for (let i = 0; i < 6; i++) { zoneLabels[`0,${i}`] = months[i]; }
for (let i = 0; i < 6; i++) { zoneLabels[`1,${i}`] = months[i+6]; }

let dayCount = 1;
for (let r = 2; r <= 5; r++) {
    for (let c = 0; c < 7; c++) zoneLabels[`${r},${c}`] = String(dayCount++);
}
for (let c = 0; c < 3; c++) zoneLabels[`6,${c}`] = String(dayCount++);

const weekdays = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
zoneLabels[`6,3`] = weekdays[0];
zoneLabels[`6,4`] = weekdays[1];
zoneLabels[`6,5`] = weekdays[2];
zoneLabels[`6,6`] = weekdays[3];
zoneLabels[`7,4`] = weekdays[4];
zoneLabels[`7,5`] = weekdays[5];
zoneLabels[`7,6`] = weekdays[6];

let boardData = []; 
let blockedSpots = [];
let draggingPiece = null;
let offset = {x: 0, y: 0};
let dragLocalOffset = {r:0, c:0};
let pieceInstances = []; 
let currentSolution = [];

let gameplayStartTime = null;
let revealTimeout = null;
let timerInterval = null;
let leaderboardTimer = null;
let lastLeaderboardState = "";
let usedReveal = false;
let puzzleDateMask = "";
let gameFinished = false;

/* Mobile Touch Variables */
let lastTap = 0;
let touchStartX = 0;
let touchStartY = 0;
let potentialDragTarget = null;
let touchDragStarted = false;

function initGame(mode = 'today') {
    gameplayStartTime = null;
    usedReveal = false;
    puzzleDateMask = "";
    lastLeaderboardState = "";
    gameFinished = false;
    
    clearTimeout(revealTimeout);
    if(timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    if(leaderboardTimer) { clearInterval(leaderboardTimer); leaderboardTimer = null; }
    
    document.getElementById('timer-display').innerText = "00:00:000";
    document.getElementById('reveal-btn').style.visibility = 'hidden';
    document.getElementById('status-message').innerText = "";

    setTimeout(() => {
        generateValidBoardAndSolution(mode);
        initPieces();
        setupListeners();
    }, 50);
}

function updateTimerDisplay() {
    if(!gameplayStartTime) return;
    const elapsed = Date.now() - gameplayStartTime;
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    const ms = elapsed % 1000;
    
    document.getElementById('timer-display').innerText = 
        String(mins).padStart(2, '0') + ":" + 
        String(secs).padStart(2, '0') + ":" + 
        String(ms).padStart(3, '0');
}

function getSpotsForDate(date) {
    const monthStr = months[date.getMonth()];
    const dayStr = String(date.getDate());
    
    const wdIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
    const weekdayStr = weekdays[wdIndex];

    let s1, s2, s3;
    for(let key in zoneLabels) {
        if(zoneLabels[key] === monthStr) s1 = key.split(',').map(Number);
        if(zoneLabels[key] === dayStr) s2 = key.split(',').map(Number);
        if(zoneLabels[key] === weekdayStr) s3 = key.split(',').map(Number);
    }
    return [
        {r: s1[0], c: s1[1]}, 
        {r: s2[0], c: s2[1]}, 
        {r: s3[0], c: s3[1]}
    ];
}

function generateValidBoardAndSolution(mode) {
    let attempt = 0;
    while(attempt < 500) {
        attempt++;
        
        const boardEl = document.getElementById('board');
        boardEl.innerHTML = '';
        boardData = Array(ROWS).fill(null).map(() => Array(COLS).fill(0));
        
        for(let i=0; i<ROWS; i++) {
            for(let j=0; j<COLS; j++) {
                const isRemoved = REMOVED_SQUARES.some(sq => sq.r === i && sq.c === j);
                if(isRemoved) boardData[i][j] = -1; 
                
                const cell = document.createElement('div');
                cell.classList.add('cell');
                cell.dataset.r = i;
                cell.dataset.c = j;
                cell.style.top = (i * CELL_SIZE) + 'px';
                cell.style.left = (j * CELL_SIZE) + 'px';
                
                if(isRemoved) {
                    cell.classList.add('removed');
                } else {
                    const label = zoneLabels[`${i},${j}`] || "";
                    cell.innerText = label;
                }
                
                boardEl.appendChild(cell);
            }
        }
        
        if (mode === 'today') {
            blockedSpots = getSpotsForDate(new Date());
        } else if (mode === 'random') {
            const zone1 = [];
            const zone2 = [];
            const zone3 = [];
            
            for(let r=0; r<ROWS; r++) {
                for(let c=0; c<COLS; c++) {
                    if(boardData[r][c] !== -1) {
                        if(r === 0 || r === 1) zone1.push({r, c});
                        else if((r === 6 && c >= 3) || r === 7) zone2.push({r, c});
                        else zone3.push({r, c});
                    }
                }
            }
            
            const s1 = zone1[Math.floor(Math.random() * zone1.length)];
            const s3 = zone3[Math.floor(Math.random() * zone3.length)];
            const s2 = zone2[Math.floor(Math.random() * zone2.length)];
            
            blockedSpots = [s1, s3, s2];
        } else {
            const parts = mode.split(' ');
            const monthStr = parts[0];
            const dayStr = parts[1];
            const weekdayStr = parts[2];
            
            let s1, s2, s3;
            for(let key in zoneLabels) {
                if(zoneLabels[key] === monthStr && parseInt(key.split(',')[0]) <= 1) s1 = key.split(',').map(Number);
                if(zoneLabels[key] === dayStr && !s2 && !((parseInt(key.split(',')[0]) === 6 && parseInt(key.split(',')[1]) >= 3) || parseInt(key.split(',')[0]) === 7)) s2 = key.split(',').map(Number);
                if(zoneLabels[key] === weekdayStr && ((parseInt(key.split(',')[0]) === 6 && parseInt(key.split(',')[1]) >= 3) || parseInt(key.split(',')[0]) === 7)) s3 = key.split(',').map(Number);
            }
            if(!s1 || !s2 || !s3) {
                 blockedSpots = getSpotsForDate(new Date()); 
            } else {
                 blockedSpots = [{r: s1[0], c: s1[1]}, {r: s2[0], c: s2[1]}, {r: s3[0], c: s3[1]}];
            }
        }

        blockedSpots.forEach(s => boardData[s.r][s.c] = -2);
        
        let steps = 0;
        let remainingPieces = [...PIECE_DEFS];
        remainingPieces.sort(() => Math.random() - 0.5); 
        currentSolution = [];
        
        function canPlaceShape(shape, r, c) {
            for(let k=0; k<shape.length; k++) {
                const nr = r + shape[k][0];
                const nc = c + shape[k][1];
                if(nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
                if(boardData[nr][nc] !== 0) return false; 
            }
            return true;
        }

        function placeShape(shape, r, c, id) {
            for(let k=0; k<shape.length; k++) {
                boardData[r+shape[k][0]][c+shape[k][1]] = id;
            }
        }
        
        function solveExact() {
            steps++;
            if(steps > 80000) return false; 
            
            let er = -1, ec = -1;
            for(let r=0; r<ROWS; r++) {
                for(let c=0; c<COLS; c++) {
                    if(boardData[r][c] === 0) {
                        er = r; ec = c;
                        break;
                    }
                }
                if(er !== -1) break;
            }
            
            if(er === -1) return remainingPieces.length === 0;
            
            for(let i=0; i<remainingPieces.length; i++) {
                const def = remainingPieces[i];
                remainingPieces.splice(i, 1);
                
                for(let rot of def.rotations) {
                    for(let [dr, dc] of rot) {
                        const originR = er - dr;
                        const originC = ec - dc;
                        
                        if(originR >= 0 && originC >= 0 && canPlaceShape(rot, originR, originC)) {
                            placeShape(rot, originR, originC, def.id);
                            
                            if(solveExact()) {
                                currentSolution.push({
                                    id: def.id, 
                                    r: originR, 
                                    c: originC, 
                                    shape: JSON.parse(JSON.stringify(rot))
                                });
                                return true;
                            }
                            placeShape(rot, originR, originC, 0); 
                        }
                    }
                }
                remainingPieces.splice(i, 0, def);
            }
            return false;
        }
        
        if(solveExact()) {
            puzzleDateMask = `${zoneLabels[`${blockedSpots[0].r},${blockedSpots[0].c}`]} ${zoneLabels[`${blockedSpots[1].r},${blockedSpots[1].c}`]} ${zoneLabels[`${blockedSpots[2].r},${blockedSpots[2].c}`]}`;
            
            const cells = document.querySelectorAll('.cell');
            blockedSpots.forEach(spot => {
                const cellInfo = Array.from(cells).find(c => parseInt(c.dataset.r) === spot.r && parseInt(c.dataset.c) === spot.c);
                if(cellInfo) cellInfo.classList.add('blocked');
            });
            
            for(let r=0; r<ROWS; r++) {
                for(let c=0; c<COLS; c++) {
                    if(boardData[r][c] !== -1 && boardData[r][c] !== -2) {
                        boardData[r][c] = 0;
                    }
                }
            }
            break;
        }
    }
}

function initPieces() {
    const container = document.getElementById('pieces-container');
    container.innerHTML = '';
    pieceInstances = PIECE_DEFS.map(def => ({
        ...def,
        shape: JSON.parse(JSON.stringify(def.shape)), 
        placed: false,
        boardR: -1,
        boardC: -1
    }));
    
    pieceInstances.forEach(p => {
        const slotEl = document.createElement('div');
        slotEl.className = 'piece-slot';
        slotEl.dataset.slotId = p.id;
        
        const el = document.createElement('div');
        el.className = `piece ${p.colorClass}`;
        el.dataset.id = p.id;
        
        let lastRightClick = 0;
        const handleContextMenu = e => {
            e.preventDefault();
            if(gameFinished) return;
            const now = Date.now();
            if (now - lastRightClick < 400) {
                resetPieceToSidebar(p.id);
                lastRightClick = 0;
            } else {
                lastRightClick = now;
                rotatePiece(p.id, el);
            }
        };

        el.addEventListener('contextmenu', handleContextMenu);
        slotEl.addEventListener('contextmenu', handleContextMenu);

        const handleDblClick = e => {
            e.preventDefault();
            resetPieceToSidebar(p.id);
        };
        
        el.addEventListener('dblclick', handleDblClick);
        slotEl.addEventListener('dblclick', handleDblClick);
        
        renderBlocks(el, p.shape);
        
        slotEl.appendChild(el);
        container.appendChild(slotEl);
    });
}

function resetPieceToSidebar(pId) {
    if(gameFinished) return;
    const pInst = pieceInstances.find(pi => pi.id === pId);
    if(pInst) {
        if(pInst.placed) {
            removePieceFromBoard(pInst);
            pInst.placed = false;
        }
        const pieceEl = document.querySelector(`.piece[data-id="${pId}"]`);
        const slotEl = document.querySelector(`.piece-slot[data-slot-id="${pId}"]`);
        if(pieceEl && slotEl) {
            pieceEl.style.position = 'relative';
            pieceEl.style.left = '0';
            pieceEl.style.top = '0';
            pieceEl.classList.remove('placed', 'dragging');
            slotEl.appendChild(pieceEl);
            document.querySelectorAll('.cell.ghost-highlight').forEach(c => c.classList.remove('ghost-highlight'));
            
            if(draggingPiece && draggingPiece.dataset.id === pId) {
                draggingPiece = null;
            }
        }
    }
}

function renderBlocks(element, shape) {
    element.innerHTML = '';
    let minR = Infinity, maxR = -Infinity;
    let minC = Infinity, maxC = -Infinity;
    
    shape.forEach(([r,c]) => {
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
    });
    
    const shiftedShape = shape.map(([r,c]) => [r - minR, c - minC]);
    const pInst = pieceInstances.find(pi => pi.id === element.dataset.id);
    if(pInst) pInst.shape = shiftedShape;

    shiftedShape.forEach(([r,c]) => {
        const b = document.createElement('div');
        b.className = 'block';
        b.style.top = r * CELL_SIZE + 'px';
        b.style.left = c * CELL_SIZE + 'px';
        element.appendChild(b);
    });
    
    element.style.width = ((maxC - minC + 1) * CELL_SIZE) + 'px';
    element.style.height = ((maxR - minR + 1) * CELL_SIZE) + 'px';
}

function rotatePiece(id, element) {
    if(gameFinished) return;
    const p = pieceInstances.find(pi => pi.id === id);
    if(!p || p.placed || element.classList.contains('dragging')) return;
    
    const rotated = p.shape.map(([r, c]) => [c, -r]);
    renderBlocks(element, rotated);
}

function initRandom() { initGame('random'); }
function initToday() { initGame('today'); }

function handleTouchStart(e) {
    if(e.touches.length > 1 || gameFinished) return;
    
    let pieceEl = e.target.closest('.piece');
    const slotEl = e.target.closest('.piece-slot');
    
    if(!pieceEl && slotEl) pieceEl = slotEl.querySelector('.piece');
    if(!pieceEl) return;
    
    const now = Date.now();
    const pId = pieceEl.dataset.id;
    
    if((now - lastTap) < 300) {
        e.preventDefault(); 
        resetPieceToSidebar(pId);
        lastTap = 0;
        return;
    }
    lastTap = now;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    potentialDragTarget = e.target;
    touchDragStarted = false;
}

function handleTouchMove(e) {
    if(potentialDragTarget) {
        const touch = e.touches[0];
        const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
        if(dist > 20 && !touchDragStarted) {
            touchDragStarted = true;
            startDrag({
                target: potentialDragTarget,
                button: 0,
                clientX: touchStartX,
                clientY: touchStartY
            });
        }
    }
    
    if(!draggingPiece) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    drag({ clientX: touch.clientX, clientY: touch.clientY });
}

function handleTouchEnd(e) {
    const touch = e.changedTouches[0];
    const dist = Math.hypot(touch.clientX - touchStartX, touch.clientY - touchStartY);
    
    if(!touchDragStarted && potentialDragTarget) {
        const pieceEl = potentialDragTarget.closest('.piece');
        const pInst = pieceInstances.find(pi => pi.id === pieceEl.dataset.id);
        const wasPlaced = pieceEl.classList.contains('placed');
        
        if (dist < 20 && !wasPlaced && pInst && !pInst.placed && !gameFinished) {
            rotatePiece(pInst.id, pieceEl);
        }
    }
    
    potentialDragTarget = null;
    touchDragStarted = false;
    
    if(!draggingPiece) return;
    endDrag({ clientX: touch.clientX, clientY: touch.clientY });
}

function setupListeners() {
    document.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', endDrag);
    
    document.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', endDrag);
    
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    
    document.addEventListener('touchstart', handleTouchStart, {passive: false});
    document.addEventListener('touchmove', handleTouchMove, {passive: false});
    document.addEventListener('touchend', handleTouchEnd);
    
    const rb = document.getElementById('reset-btn');
    rb.removeEventListener('click', initRandom);
    rb.addEventListener('click', initRandom);
    
    const tb = document.getElementById('today-btn');
    tb.removeEventListener('click', initToday);
    tb.addEventListener('click', initToday);
    
    const rev = document.getElementById('reveal-btn');
    rev.removeEventListener('click', showSolution);
    rev.addEventListener('click', showSolution);
}

function startDrag(e) {
    if(gameFinished) return;
    let pieceEl = e.target.closest('.piece');
    const slotEl = e.target.closest('.piece-slot');
    
    if(!pieceEl && slotEl) pieceEl = slotEl.querySelector('.piece');
    if(!pieceEl) return;
    if(e.button !== 0) return; 
    
    draggingPiece = pieceEl;
    const pId = pieceEl.dataset.id;
    const pInst = pieceInstances.find(pi => pi.id === pId);
    
    const isSidebar = !pInst.placed;
    const currentScale = isSidebar ? SIDEBAR_SCALE : 1;
    
    if(pInst.placed) {
        removePieceFromBoard(pInst);
        pInst.placed = false;
        pieceEl.classList.remove('placed');
    } 
    
    const rect = pieceEl.getBoundingClientRect();
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    const mouseLocalX = e.clientX - rect.left;
    const mouseLocalY = e.clientY - rect.top;
    
    const unscaledX = mouseLocalX / currentScale;
    const unscaledY = mouseLocalY / currentScale;
    
    dragLocalOffset.c = Math.floor(unscaledX / CELL_SIZE);
    dragLocalOffset.r = Math.floor(unscaledY / CELL_SIZE);
    
    offset.x = unscaledX;
    offset.y = unscaledY;
    
    document.body.appendChild(pieceEl);

    pieceEl.dataset.dragStartX = e.clientX;
    pieceEl.dataset.dragStartY = e.clientY;
    pieceEl.dataset.wasPlaced = pInst.placed;

    pieceEl.classList.add('dragging');
    pieceEl.style.position = 'absolute';
    pieceEl.style.left = (e.clientX + scrollX - offset.x) + 'px';
    pieceEl.style.top = (e.clientY + scrollY - offset.y) + 'px';
}

function drag(e) {
    if(!draggingPiece) return;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    draggingPiece.style.left = (e.clientX + scrollX - offset.x) + 'px';
    draggingPiece.style.top = (e.clientY + scrollY - offset.y) + 'px';
    
    document.querySelectorAll('.cell.ghost-highlight').forEach(c => c.classList.remove('ghost-highlight'));
    
    const boardEl = document.getElementById('board');
    const boardRect = boardEl.getBoundingClientRect();
    const boardX = e.clientX - boardRect.left;
    const boardY = e.clientY - boardRect.top;
    
    const targetC = Math.floor(boardX / CELL_SIZE);
    const targetR = Math.floor(boardY / CELL_SIZE);
    
    if(targetR >= 0 && targetR < ROWS && targetC >= 0 && targetC < COLS) {
        const pId = draggingPiece.dataset.id;
        const pInst = pieceInstances.find(pi => pi.id === pId);
        const originR = targetR - dragLocalOffset.r;
        const originC = targetC - dragLocalOffset.c;
        
        if(canPlace(pInst, originR, originC)) {
            for(let [dr, dc] of pInst.shape) {
                const cell = document.querySelector(`.cell[data-r="${originR+dr}"][data-c="${originC+dc}"]`);
                if(cell) cell.classList.add('ghost-highlight');
            }
        }
    }
}

function endDrag(e) {
    if(!draggingPiece) return;
    
    document.querySelectorAll('.cell.ghost-highlight').forEach(c => c.classList.remove('ghost-highlight'));
    
    const pieceEl = draggingPiece;
    const pInst = pieceInstances.find(pi => pi.id === pieceEl.dataset.id);
    pieceEl.classList.remove('dragging');
    
    const boardEl = document.getElementById('board');
    const boardRect = boardEl.getBoundingClientRect();
    const boardX = e.clientX - boardRect.left;
    const boardY = e.clientY - boardRect.top;
    
    const targetC = Math.floor(boardX / CELL_SIZE);
    const targetR = Math.floor(boardY / CELL_SIZE);
    
    let placedSuccess = false;
    
    if(targetR >= 0 && targetR < ROWS && targetC >= 0 && targetC < COLS) {
        const originR = targetR - dragLocalOffset.r;
        const originC = targetC - dragLocalOffset.c;
        
        if(canPlace(pInst, originR, originC)) {
            placePiece(pInst, originR, originC, pieceEl);
            placedSuccess = true;
        }
    }
    
    const startX = parseFloat(pieceEl.dataset.dragStartX || 0);
    const startY = parseFloat(pieceEl.dataset.dragStartY || 0);
    const wasPlaced = pieceEl.dataset.wasPlaced === 'true';
    const dist = Math.hypot(e.clientX - startX, e.clientY - startY);

    if(!placedSuccess) {
        pieceEl.style.position = 'relative';
        pieceEl.style.left = '0';
        pieceEl.style.top = '0';
        
        const slotEl = document.querySelector(`.piece-slot[data-slot-id="${pInst.id}"]`);
        if(slotEl) slotEl.appendChild(pieceEl);
        else document.getElementById('pieces-container').appendChild(pieceEl);
    } else {
        if(!gameplayStartTime && !usedReveal) {
            gameplayStartTime = Date.now();
            if(timerInterval) clearInterval(timerInterval);
            timerInterval = setInterval(updateTimerDisplay, 10);
            
            revealTimeout = setTimeout(() => {
                const allPlaced = pieceInstances.every(pi => pi.placed);
                if(!allPlaced) {
                    document.getElementById('reveal-btn').style.visibility = 'visible';
                }
            }, 120000); 
        }
    }
    
    draggingPiece = null;
    checkWinCondition();
}

function canPlace(pInst, r, c) {
    for(let [dr, dc] of pInst.shape) {
        const nr = r + dr;
        const nc = c + dc;
        if(nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) return false;
        if(boardData[nr][nc] !== 0) return false; 
    }
    return true;
}

function placePiece(pInst, r, c, pieceEl) {
    pInst.boardR = r;
    pInst.boardC = c;
    pInst.placed = true;
    
    for(let [dr, dc] of pInst.shape) {
        boardData[r+dr][c+dc] = pInst.id;
    }
    
    const boardEl = document.getElementById('board');
    boardEl.appendChild(pieceEl);
    pieceEl.style.position = 'absolute';
    pieceEl.style.left = (c * CELL_SIZE) + 'px';
    pieceEl.style.top = (r * CELL_SIZE) + 'px';
    pieceEl.classList.add('placed');
}

function removePieceFromBoard(pInst) {
    if(!pInst.placed) return;
    for(let [dr, dc] of pInst.shape) {
        boardData[pInst.boardR + dr][pInst.boardC + dc] = 0; 
    }
    pInst.boardR = -1;
    pInst.boardC = -1;
}

function getPlayerName() {
    const input = document.getElementById('player-name').value.trim();
    if(input.length < 3) return "Player X"; 
    return input.replace(/</g, "&lt;").replace(/>/g, "&gt;").substring(0, 10);
}

async function fetchGlobalScores() {
    try {
        const res = await fetch('/api/leaderboard');
        if(res.ok) {
            const data = await res.json();
            localStorage.setItem('chroma_scores', JSON.stringify(data));
        }
    } catch(err) {
        console.log("Global leaderboard unlinked. Using local storage.", err);
    }
}

async function saveScore(timeInSeconds, mask) {
    if(usedReveal) return; 
    const name = getPlayerName();
    const newScore = {
        player: name,
        time: timeInSeconds,
        mask: mask,
        timestamp: Date.now()
    };
    
    let scores = JSON.parse(localStorage.getItem('chroma_scores') || '[]');
    scores.push(newScore);
    localStorage.setItem('chroma_scores', JSON.stringify(scores));
    
    try {
        await fetch('/api/leaderboard', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newScore)
        });
    } catch(err) {
        console.log("Could not push globally.");
    }
}

function renderLeaderboardDOM() {
    if(!leaderboardTimer && pieceInstances.some(p => !p.placed)) return; 
    
    const container = document.getElementById('pieces-container');
    const rawScores = localStorage.getItem('chroma_scores') || '[]';
    
    if (rawScores === lastLeaderboardState && document.querySelector('.leaderboard-wrapper')) return;
    lastLeaderboardState = rawScores;
    
    let scores = JSON.parse(rawScores);
    
    const top5 = scores
        .filter(s => s.player !== "Player X")
        .sort((a,b) => a.time - b.time)
        .slice(0, 5);
        
    const recent15 = scores
        .sort((a,b) => b.timestamp - a.timestamp)
        .slice(0, 15);
        
    let html = `<div class="leaderboard-wrapper">`;
    html += `<h3>Top 5 Fastest (All-Time)</h3>`;
    html += `<table class="lb-table"><tr><th>Player</th><th>Time (s)</th><th>Challenge</th></tr>`;
    if(top5.length === 0) html += `<tr><td colspan="3" style="text-align:center;">No competitive scores yet.</td></tr>`;
    top5.forEach(s => {
        html += `<tr><td>${s.player}</td><td>${s.time}s</td><td><button class="lb-challenge-btn" data-mask="${s.mask}">Play ${s.mask}</button></td></tr>`;
    });
    html += `</table>`;
    
    html += `<h3>15 Most Recent Games</h3>`;
    html += `<table class="lb-table"><tr><th>Player</th><th>Time (s)</th><th>Challenge</th></tr>`;
    if(recent15.length === 0) html += `<tr><td colspan="3" style="text-align:center;">No games recorded.</td></tr>`;
    recent15.forEach(s => {
        html += `<tr><td>${s.player}</td><td>${s.time}s</td><td><button class="lb-challenge-btn" data-mask="${s.mask}">Play ${s.mask}</button></td></tr>`;
    });
    html += `</table></div>`;
    
    container.innerHTML = html;
    
    const btns = container.querySelectorAll('.lb-challenge-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            initGame(e.target.dataset.mask);
        });
    });
}

function showLeaderboard() {
    if(leaderboardTimer) clearInterval(leaderboardTimer);
    
    // Initial paint
    renderLeaderboardDOM();
    
    fetchGlobalScores().finally(() => {
        renderLeaderboardDOM();
    });
    
    leaderboardTimer = setInterval(() => {
        fetchGlobalScores().then(renderLeaderboardDOM);
    }, 5000);
}

function checkWinCondition() {
    const allPlaced = pieceInstances.every(pi => pi.placed);
    if(allPlaced && !gameFinished) {
        gameFinished = true;
        document.getElementById('reveal-btn').style.visibility = 'hidden';
        document.getElementById('status-message').innerText = "You Win! All pieces placed!";
        clearTimeout(revealTimeout);
        if(timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        if(!usedReveal && gameplayStartTime) {
            const elapsed = Date.now() - gameplayStartTime;
            const timeInSeconds = Math.min(999, Math.floor(elapsed / 1000));
            saveScore(timeInSeconds, puzzleDateMask);
        }
        
        showLeaderboard();
    }
}

function showSolution() {
    usedReveal = true;
    for(let i=0; i<ROWS; i++) {
        for(let j=0; j<COLS; j++) {
            if(boardData[i][j] !== -1 && boardData[i][j] !== -2) {
                boardData[i][j] = 0;
            }
        }
    }
    currentSolution.forEach(sol => {
        const pInst = pieceInstances.find(pi => pi.id === sol.id);
        const pieceEl = document.querySelector(`.piece[data-id="${sol.id}"]`);
        
        pInst.shape = JSON.parse(JSON.stringify(sol.shape));
        renderBlocks(pieceEl, pInst.shape);
        placePiece(pInst, sol.r, sol.c, pieceEl);
    });
    
    document.getElementById('reveal-btn').style.visibility = 'hidden';
    document.getElementById('status-message').innerText = "Solution Revealed.";
    if(timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    showLeaderboard();
}

window.addEventListener('DOMContentLoaded', () => {
    const today = new Date();
    document.getElementById('footer-date').innerText = "Today's Date: " + today.toDateString();
    
    const nameInput = document.getElementById('player-name');
    const savedName = localStorage.getItem('chroma_player_name');
    if(savedName) nameInput.value = savedName;
    
    nameInput.addEventListener('input', (e) => {
        let val = e.target.value;
        if(val.startsWith(' ')) {
            val = val.trimStart();
            e.target.value = val;
        }
        localStorage.setItem('chroma_player_name', val);
    });
    
    nameInput.addEventListener('blur', (e) => {
        let val = e.target.value.trim();
        e.target.value = val;
        localStorage.setItem('chroma_player_name', val);
    });
    
    initToday();
});
