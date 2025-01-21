async function fetchLogo() {
  const brandInput = document.getElementById('brandInput');
  const logoPreview = document.getElementById('logoPreview');
  const downloadButtons = document.getElementById('downloadButtons');
  const removeBackground = document.getElementById('removeBackground');
  const brand = brandInput.value.trim();

  if (!brand) {
    showError('Please enter a brand name');
    return;
  }

  // Clear previous results
  logoPreview.innerHTML = '';
  downloadButtons.innerHTML = '';
  
  // Base URL for the Clearbit Logo API with size parameter for HD quality
  const baseUrl = `https://logo.clearbit.com/${brand}.com?size=512`;
  
  try {
    // First fetch the logo
    const response = await fetch(baseUrl);
    if (!response.ok) throw new Error('Logo not found');
    const blob = await response.blob();
    
    // Create image element
    const img = document.createElement('img');
    img.src = URL.createObjectURL(blob);
    
    img.onload = async () => {
      let displayedImage = img;
      
      // Remove background if option is selected
      if (removeBackground.checked) {
        logoPreview.innerHTML = '<p class="loading">Removing background...</p>';
        try {
          const processedCanvas = await removeLogoBackground(img);
          displayedImage = document.createElement('img');
          displayedImage.src = processedCanvas.toDataURL('image/png', 1.0); // Maximum quality
        } catch (error) {
          showError('Error removing background');
          return;
        }
      }
      
      logoPreview.innerHTML = '';
      logoPreview.appendChild(displayedImage);
      
      // Show download buttons
      downloadButtons.innerHTML = `
        <button onclick="downloadLogo('${brand}', 'png')">PNG</button>
        <button onclick="downloadLogo('${brand}', 'svg')">SVG</button>
        <button onclick="downloadLogo('${brand}', 'pdf')">PDF</button>
      `;
    };
    
    img.onerror = () => showError('Error loading logo');
  } catch (error) {
    showError('Error fetching logo');
  }
}

function removeLogoBackground(img) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    
    // Set canvas size to match image while maintaining high resolution
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    
    // Enable image smoothing for better quality
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    // Draw image to canvas
    ctx.drawImage(img, 0, 0);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Find the most common color in the corners (likely the background)
    const cornerPixels = [
      getPixelColor(data, 0, 0, canvas.width),
      getPixelColor(data, canvas.width - 1, 0, canvas.width),
      getPixelColor(data, 0, canvas.height - 1, canvas.width),
      getPixelColor(data, canvas.width - 1, canvas.height - 1, canvas.width)
    ];
    
    // Calculate the average corner color
    const bgColor = {
      r: Math.round(cornerPixels.reduce((sum, p) => sum + p.r, 0) / 4),
      g: Math.round(cornerPixels.reduce((sum, p) => sum + p.g, 0) / 4),
      b: Math.round(cornerPixels.reduce((sum, p) => sum + p.b, 0) / 4)
    };
    
    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Check if pixel is similar to background color
      if (isColorSimilar(r, g, b, bgColor)) {
        data[i + 3] = 0; // Set alpha to 0 (transparent)
      }
    }
    
    // Put the modified image data back to canvas
    ctx.putImageData(imageData, 0, 0);
    
    resolve(canvas);
  });
}

function getPixelColor(data, x, y, width) {
  const index = (y * width + x) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2]
  };
}

function isColorSimilar(r, g, b, bgColor, threshold = 30) {
  return Math.abs(r - bgColor.r) < threshold &&
         Math.abs(g - bgColor.g) < threshold &&
         Math.abs(b - bgColor.b) < threshold;
}

async function downloadLogo(brand, format) {
  const img = document.querySelector('#logoPreview img');
  if (!img) {
    showError('No logo to download');
    return;
  }
  
  try {
    switch (format) {
      case 'png':
        downloadPNG(img, brand);
        break;
      case 'svg':
        downloadSVG(img, brand);
        break;
      case 'pdf':
        await downloadPDF(img, brand);
        break;
    }
  } catch (error) {
    showError('Error downloading logo');
  }
}

function downloadPNG(img, brand) {
  const canvas = document.createElement('canvas');
  // Use natural dimensions for maximum quality
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  
  const link = document.createElement('a');
  link.href = canvas.toDataURL('image/png', 1.0); // Maximum quality
  link.download = `${brand}-logo.png`;
  link.click();
}

function downloadSVG(img, brand) {
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  
  // Convert canvas to SVG with high-quality image
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${img.naturalWidth}" height="${img.naturalHeight}">
      <image href="${canvas.toDataURL('image/png', 1.0)}" width="${img.naturalWidth}" height="${img.naturalHeight}"/>
    </svg>
  `;
  
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${brand}-logo.svg`;
  link.click();
  
  URL.revokeObjectURL(url);
}

async function downloadPDF(img, brand) {
  const { default: jsPDF } = await import('jspdf');
  
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'px',
    format: [img.naturalWidth + 40, img.naturalHeight + 40]
  });
  
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  
  const imgData = canvas.toDataURL('image/png', 1.0); // Maximum quality
  pdf.addImage(imgData, 'PNG', 20, 20, img.naturalWidth, img.naturalHeight);
  pdf.save(`${brand}-logo.pdf`);
}

function showError(message) {
  const logoPreview = document.getElementById('logoPreview');
  logoPreview.innerHTML = `<p class="error-message">${message}</p>`;
}