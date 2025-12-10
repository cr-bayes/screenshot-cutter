document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const fileInput = document.getElementById('file-upload');
    const workspace = document.getElementById('workspace');
    const controls = document.getElementById('controls');
    const imageContainer = document.getElementById('image-container');
    const sourceImage = document.getElementById('source-image');
    const cropOverlay = document.getElementById('crop-overlay');
    const downloadBtn = document.getElementById('download-btn');
    const executeBtn = document.getElementById('execute-btn');
    const resultSection = document.getElementById('result-section');
    const resultImage = document.getElementById('result-image');
    const shareUrlInput = document.getElementById('share-url-input');
    const copyInputBtn = document.getElementById('copy-input-btn');

    // Inputs
    const inputs = {
        x1: document.getElementById('x1'),
        y1: document.getElementById('y1'),
        x2: document.getElementById('x2'),
        y2: document.getElementById('y2')
    };

    // State
    let state = {
        imageLoaded: false,
        naturalWidth: 0,
        naturalHeight: 0,
        scale: 1,
        crop: { ...CONFIG.defaultCrop },
        isDragging: false,
        dragHandle: null,
        startX: 0,
        startY: 0,
        startCrop: {}
    };

    // Initialize
    init();

    function init() {
        parseUrlParams();
        setupEventListeners();
    }

    function parseUrlParams() {
        const params = new URLSearchParams(window.location.search);
        if (params.has('x1')) state.crop.x1 = parseInt(params.get('x1'));
        if (params.has('y1')) state.crop.y1 = parseInt(params.get('y1'));
        if (params.has('x2')) state.crop.x2 = parseInt(params.get('x2'));
        if (params.has('y2')) state.crop.y2 = parseInt(params.get('y2'));

        updateInputs();
    }

    function setupEventListeners() {
        fileInput.addEventListener('change', handleFileUpload);

        // Input changes
        Object.keys(inputs).forEach(key => {
            inputs[key].addEventListener('change', (e) => {
                let val = parseInt(e.target.value) || 0;
                state.crop[key] = val;
                updateOverlay();
            });
        });

        // Mouse/Touch events for cropping
        cropOverlay.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);

        // Touch support
        cropOverlay.addEventListener('touchstart', handleDragStart, { passive: false });
        document.addEventListener('touchmove', handleDragMove, { passive: false });
        document.addEventListener('touchend', handleDragEnd);

        downloadBtn.addEventListener('click', handleDownload);
        executeBtn.addEventListener('click', handleExecute);
        copyInputBtn.addEventListener('click', handleCopyUrl);

        // Select all text when clicking the input
        shareUrlInput.addEventListener('click', () => shareUrlInput.select());

        // Window resize
        window.addEventListener('resize', () => {
            if (state.imageLoaded) {
                updateScale();
                updateOverlay();
            }
        });
    }

    function handleFileUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            sourceImage.src = event.target.result;
            sourceImage.onload = () => {
                state.imageLoaded = true;
                state.naturalWidth = sourceImage.naturalWidth;
                state.naturalHeight = sourceImage.naturalHeight;

                workspace.style.display = 'flex';
                controls.style.display = 'flex'; // or 'flex' based on media query, but flex is safe

                // Validate initial crop against image size
                validateCrop();
                updateScale();
                updateOverlay();
                updateInputs();
            };
        };
        reader.readAsDataURL(file);
    }

    function updateScale() {
        const rect = sourceImage.getBoundingClientRect();
        state.scale = rect.width / state.naturalWidth;
    }

    function validateCrop() {
        // Ensure crop is within bounds
        state.crop.x1 = Math.max(0, Math.min(state.crop.x1, state.naturalWidth));
        state.crop.y1 = Math.max(0, Math.min(state.crop.y1, state.naturalHeight));
        state.crop.x2 = Math.max(0, Math.min(state.crop.x2, state.naturalWidth));
        state.crop.y2 = Math.max(0, Math.min(state.crop.y2, state.naturalHeight));

        // Ensure x1 < x2 and y1 < y2
        if (state.crop.x1 > state.crop.x2) [state.crop.x1, state.crop.x2] = [state.crop.x2, state.crop.x1];
        if (state.crop.y1 > state.crop.y2) [state.crop.y1, state.crop.y2] = [state.crop.y2, state.crop.y1];
    }

    function updateOverlay() {
        if (!state.imageLoaded) return;

        validateCrop();

        const left = state.crop.x1 * state.scale;
        const top = state.crop.y1 * state.scale;
        const width = (state.crop.x2 - state.crop.x1) * state.scale;
        const height = (state.crop.y2 - state.crop.y1) * state.scale;

        cropOverlay.style.left = `${left}px`;
        cropOverlay.style.top = `${top}px`;
        cropOverlay.style.width = `${width}px`;
        cropOverlay.style.height = `${height}px`;
    }

    function updateInputs() {
        inputs.x1.value = state.crop.x1;
        inputs.y1.value = state.crop.y1;
        inputs.x2.value = state.crop.x2;
        inputs.y2.value = state.crop.y2;
        updateShareUrl();
    }

    function updateShareUrl() {
        if (!state.imageLoaded) return;
        const url = new URL(window.location.href);
        url.searchParams.set('x1', state.crop.x1);
        url.searchParams.set('y1', state.crop.y1);
        url.searchParams.set('x2', state.crop.x2);
        url.searchParams.set('y2', state.crop.y2);
        shareUrlInput.value = url.toString();
    }

    // Global function for +/- buttons
    window.adjustValue = function (key, delta) {
        let val = parseInt(inputs[key].value) || 0;
        val += delta;
        state.crop[key] = val;
        updateInputs();
        updateOverlay();
    };

    // Dragging Logic
    function handleDragStart(e) {
        if (e.target.classList.contains('handle')) {
            state.dragHandle = e.target.dataset.handle;
        } else {
            state.dragHandle = 'move';
        }

        state.isDragging = true;
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        state.startX = clientX;
        state.startY = clientY;
        state.startCrop = { ...state.crop };

        e.preventDefault();
    }

    function handleDragMove(e) {
        if (!state.isDragging) return;

        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;

        const deltaX = Math.round((clientX - state.startX) / state.scale);
        const deltaY = Math.round((clientY - state.startY) / state.scale);

        if (state.dragHandle === 'move') {
            const width = state.startCrop.x2 - state.startCrop.x1;
            const height = state.startCrop.y2 - state.startCrop.y1;

            let newX1 = state.startCrop.x1 + deltaX;
            let newY1 = state.startCrop.y1 + deltaY;
            let newX2 = newX1 + width;
            let newY2 = newY1 + height;

            // Boundary checks for moving
            if (newX1 < 0) { newX1 = 0; newX2 = width; }
            if (newY1 < 0) { newY1 = 0; newY2 = height; }
            if (newX2 > state.naturalWidth) { newX2 = state.naturalWidth; newX1 = newX2 - width; }
            if (newY2 > state.naturalHeight) { newY2 = state.naturalHeight; newY1 = newY2 - height; }

            state.crop.x1 = newX1;
            state.crop.y1 = newY1;
            state.crop.x2 = newX2;
            state.crop.y2 = newY2;
        } else {
            // Resizing
            if (state.dragHandle.includes('w')) state.crop.x1 = Math.min(state.startCrop.x1 + deltaX, state.startCrop.x2 - 1);
            if (state.dragHandle.includes('e')) state.crop.x2 = Math.max(state.startCrop.x2 + deltaX, state.startCrop.x1 + 1);
            if (state.dragHandle.includes('n')) state.crop.y1 = Math.min(state.startCrop.y1 + deltaY, state.startCrop.y2 - 1);
            if (state.dragHandle.includes('s')) state.crop.y2 = Math.max(state.startCrop.y2 + deltaY, state.startCrop.y1 + 1);
        }

        updateOverlay();
        updateInputs();
    }

    function handleDragEnd() {
        state.isDragging = false;
        state.dragHandle = null;
    }

    function handleCopyUrl() {
        if (!shareUrlInput.value) return;

        shareUrlInput.select();
        shareUrlInput.setSelectionRange(0, 99999); // Mobile compatibility

        navigator.clipboard.writeText(shareUrlInput.value).then(() => {
            const originalText = copyInputBtn.textContent;
            copyInputBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyInputBtn.textContent = 'Copy';
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            // Fallback is just leaving the text selected so user can copy manually
        });
    }

    function handleExecute() {
        if (!state.imageLoaded) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const width = state.crop.x2 - state.crop.x1;
        const height = state.crop.y2 - state.crop.y1;

        if (width <= 0 || height <= 0) return;

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(
            sourceImage,
            state.crop.x1, state.crop.y1, width, height,
            0, 0, width, height
        );

        const dataUrl = canvas.toDataURL('image/png');
        resultImage.src = dataUrl;
        resultSection.style.display = 'flex';
        downloadBtn.style.display = 'inline-block';

        // Scroll to result
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }

    function handleDownload() {
        if (!resultImage.src || resultImage.src === "") return;

        const link = document.createElement('a');
        link.download = `cropped-${Date.now()}.png`;
        link.href = resultImage.src;
        link.click();
    }
});
