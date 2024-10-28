let globalColors = {};
let chartSize = 500;
let fontSize = 12;
let colorsGenerated = false;
let scale = 100;
let members = new Set();

// 在全局变量部分添加
const colorOptions = {
    'dodger-blue': '#1b75ff',
    'cerulean': '#01aae8',
    'matisse': '#1b6699',
    'sushi': '#79bb43',
    'fuel-yellow': '#ec9f2c',
    'hot-cinnamon': '#e3672a',
    'sunglo': '#de6271',
    'valencia': '#d63549',
    'allports': '#0069ac',
    'dark-blue': '#011ede',
    'chateau-green': '#3fc157',
    'cyprus': '#003541',
    'blue-dianne': '#244b52',
    'orient': '#035b78',
    'eastern-blue': '#269db8',
    'maroon': '#7f0103',
    'bright-sun': '#ffce4b',
    'st-tropaz': '#264c9e'
};

let currentMember = '';

function drawChart(ctx = null, width = null, height = null, generateSVG = false) {
    const input = document.getElementById('input').value;
    const canvas = ctx ? { getContext: () => ctx, width: width, height: height } : document.getElementById('chart');
    ctx = ctx || canvas.getContext('2d');
    
    const layers = parseAndPreprocessInput(input);
    const totalHeight = layers.reduce((sum, layer) => sum + layer.height, 0);
    if (!colorsGenerated) {
        globalColors = {}; // 只有在第一次绘制时重置颜色
        colorsGenerated = true;
    }

    // 计算基于字体大小的缩放因子
    const fontScaleFactor = fontSize / 12; // 12 是默认字体大小
    const scaledSize = chartSize * (scale / 100) * fontScaleFactor;
    
    // 计算层厚度标签所需的最大宽度
    ctx.font = `${fontSize}px Arial`;
    const maxLayerLabelWidth = layers.reduce((max, layer, index) => {
        const layerText = `Layer ${index + 1}: ${layer.height}`;
        return Math.max(max, ctx.measureText(layerText).width);
    }, 0);

    // 调整画布宽度以容纳层厚度标签
    const leftMargin = maxLayerLabelWidth + 10 * fontScaleFactor;
    
    canvas.width = scaledSize + leftMargin;
    canvas.height = scaledSize;

    const minCellHeight = fontSize + 1;

    // 计算每个合并单元格的最小所需高度
    layers.forEach(layer => {
        layer.items.forEach(item => {
            item.minRequiredHeight = Math.max(minCellHeight, (item.mergeHeight / totalHeight) * scaledSize);
        });
    });

    // 计算每层的最小所需高度
    const minLayerHeights = layers.map((layer, index) => {
        return Math.max(
            (layer.height / totalHeight) * scaledSize,
            fontSize + 4,
            layer.items.reduce((max, item) => {
                if (item.mergeStartLayer === index) {
                    const textWidth = ctx.measureText(`${item.name} (${item.percentage}%)`).width;
                    const itemWidth = (item.percentage / 100) * scaledSize;
                    if (textWidth > itemWidth - 4) {
                        return Math.max(max, textWidth + 4);
                    } else {
                        return Math.max(max, fontSize + 4);
                    }
                }
                return max;
            }, 0)
        );
    });

    // 计算需要的额外高度
    const totalMinHeight = minLayerHeights.reduce((sum, height) => sum + height, 0);
    const scaleFactor = Math.max(1, totalMinHeight / scaledSize);

    // 调整层高度，保持相对比例
    const adjustedLayerHeights = layers.map((layer, index) => {
        return Math.max(minLayerHeights[index], (layer.height / totalHeight) * scaledSize * scaleFactor);
    });

    // 调整合并单元格的高度
    layers.forEach((layer, index) => {
        layer.items.forEach(item => {
            if (item.mergeStartLayer === index) {
                let mergeHeight = 0;
                for (let i = index; i < index + item.mergeHeight / layer.height; i++) {
                    mergeHeight += adjustedLayerHeights[i] || 0;
                }
                item.adjustedMergeHeight = mergeHeight;
            }
        });
    });

    // 计算调整后的总高度
    const adjustedTotalHeight = adjustedLayerHeights.reduce((sum, height) => sum + height, 0);

    // 调整画布高度
    canvas.height = adjustedTotalHeight;

    let svgContent = '';
    if (generateSVG) {
        svgContent += `<svg width="${canvas.width}" height="${canvas.height}" xmlns="http://www.w3.org/2000/svg">`;
        svgContent += `<rect width="${canvas.width}" height="${canvas.height}" fill="white"/>`;
    }

    let y = adjustedTotalHeight; // 从底部开始绘制
    layers.forEach((layer, index) => {
        const layerHeight = adjustedLayerHeights[index];
        y -= layerHeight; // 向上移动绘制位置
        let x = leftMargin; // 从左侧开始绘制，为层厚度标签留出空间
        
        layer.items.forEach(item => {
            if (item.percentage === 0 || item.merged) return;

            if (!globalColors[item.name]) {
                globalColors[item.name] = getRandomLowSaturationColor();
            }
            
            const width = (item.percentage / 100) * scaledSize;
            ctx.fillStyle = globalColors[item.name];
            
            let mergeHeight = item.adjustedMergeHeight || layerHeight;
            let mergeY = y;

            if (item.mergeHeight > layer.height) {
                let totalMergeHeight = 0;
                for (let i = index; i < layers.length; i++) {
                    if (totalMergeHeight >= item.mergeHeight) break;
                    totalMergeHeight += layers[i].height;
                }
                mergeHeight = (totalMergeHeight / totalHeight) * adjustedTotalHeight;
                mergeY = y + layerHeight - mergeHeight;
            }
            
            ctx.fillRect(x, mergeY, width, mergeHeight);
            
            if (generateSVG) {
                svgContent += `<rect x="${x}" y="${mergeY}" width="${width}" height="${mergeHeight}" fill="${globalColors[item.name]}"/>`;
            }
            
            // 只在合并单元格的外围添加白色边框
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2 * fontScaleFactor;
            ctx.beginPath();
            ctx.moveTo(x, mergeY);
            ctx.lineTo(x, mergeY + mergeHeight);
            ctx.lineTo(x + width, mergeY + mergeHeight);
            ctx.lineTo(x + width, mergeY);
            ctx.stroke();
            
            if (generateSVG) {
                svgContent += `<path d="M${x},${mergeY} L${x},${mergeY + mergeHeight} L${x + width},${mergeY + mergeHeight} L${x + width},${mergeY} Z" stroke="white" stroke-width="${2 * fontScaleFactor}" fill="none"/>`;
            }
            
            // 绘制文字，使用合并单元格的中心位置
            if (generateSVG) {
                svgContent += drawAdaptiveText(ctx, item.name, item.percentage, x, mergeY, width, mergeHeight, generateSVG);
            } else {
                drawAdaptiveText(ctx, item.name, item.percentage, x, mergeY, width, mergeHeight, generateSVG);
            }
            
            x += width;
        });

        // 绘制层度标注
        ctx.fillStyle = 'black';
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const layerText = `Layer ${index + 1}: ${layer.height}`;
        ctx.fillText(layerText, leftMargin - 5 * fontScaleFactor, y + layerHeight / 2);
        
        if (generateSVG) {
            svgContent += `<text x="${leftMargin - 5 * fontScaleFactor}" y="${y + layerHeight / 2}" font-size="${fontSize}" text-anchor="end" dominant-baseline="middle" fill="black">${layerText}</text>`;
        }
    });

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1 * fontScaleFactor;
    ctx.strokeRect(leftMargin, 0, scaledSize, adjustedTotalHeight);
    
    if (generateSVG) {
        svgContent += `<rect x="${leftMargin}" y="0" width="${scaledSize}" height="${adjustedTotalHeight}" stroke="black" stroke-width="${1 * fontScaleFactor}" fill="none"/>`;
        svgContent += '</svg>';
    }

    // 在绘制完成后，调整 chart-container 的大小
    const container = document.getElementById('chart-container');
    const containerPadding = 40 * fontScaleFactor;
    const newWidth = canvas.width + containerPadding;
    const newHeight = canvas.height + containerPadding;
    
    container.style.width = `${newWidth}px`;
    container.style.height = `${newHeight}px`;

    // 调整整个 content 区域的布局
    const content = document.querySelector('.content');
    const inputSection = document.querySelector('.input-section');
    if (newWidth + inputSection.offsetWidth + 30 > content.offsetWidth) {
        content.style.flexDirection = 'column';
        content.style.alignItems = 'center';
    } else {
        content.style.flexDirection = 'row';
        content.style.alignItems = 'flex-start';
    }

    // 在每次绘制时更新成员列表
    members.clear();
    layers.forEach(layer => {
        layer.items.forEach(item => {
            if (item.percentage > 0) {
                members.add(item.name);
            }
        });
    });

    // 在函数末尾添加
    if (!generateSVG) {
        updateColorLegend();
    }

    return generateSVG ? svgContent : null;
}

function parseAndPreprocessInput(input) {
    if (!input || !input.trim()) {
        return [];
    }
    const lines = input.trim().split('\n');
    const layers = lines.map((line, index) => {
        const parts = line.split(':');
        if (parts.length !== 2) {
            console.error(`Invalid input format at line ${index + 1}: ${line}`);
            return null;
        }
        const [layerInfo, itemsInfo] = parts;
        const [, height] = layerInfo.split('-');
        if (!height) {
            console.error(`Invalid layer height format at line ${index + 1}: ${layerInfo}`);
            return null;
        }
        const items = itemsInfo.split('|').map(item => {
            const [name, percentage] = item.split(',');
            if (!name || !percentage) {
                console.error(`Invalid item format at line ${index + 1}: ${item}`);
                return null;
            }
            return { 
                name, 
                percentage: parseFloat(percentage),
                mergeHeight: parseInt(height),
                mergeStartLayer: index,
                merged: false
            };
        }).filter(item => item !== null);
        return { height: parseInt(height), items };
    }).filter(layer => layer !== null);

    // 处理合并
    for (let i = 1; i < layers.length; i++) {
        layers[i].items.forEach(item => {
            const prevLayerItem = layers[i-1].items.find(prevItem => 
                prevItem.name === item.name && 
                Math.abs(prevItem.percentage - item.percentage) < 0.01 &&
                !prevItem.merged
            );
            if (prevLayerItem) {
                prevLayerItem.mergeHeight += layers[i].height;
                item.mergedInto = prevLayerItem;
                item.merged = true;
            }
        });
    }

    return layers;
}

function drawAdaptiveText(ctx, name, percentage, x, y, width, height, generateSVG) {
    ctx.fillStyle = 'black';
    ctx.font = `${fontSize}px Arial`;
    const text = `${name} (${percentage}%)`;
    const textWidth = ctx.measureText(text).width;
    const textHeight = fontSize;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const centerX = x + width / 2;
    const centerY = y + height / 2;

    let svgText = '';
    if (textWidth > width - 4 && height > textHeight) {
        // 如果文字宽度大于格子宽度-4，且高度足够，则旋转90度
        ctx.translate(centerX, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(text, 0, 0);
        
        if (generateSVG) {
            svgText = `<text x="${centerX}" y="${centerY}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="black" transform="rotate(-90 ${centerX} ${centerY})">${text}</text>`;
        }
    } else {
        // 否则正常绘制
        ctx.fillText(text, centerX, centerY);
        
        if (generateSVG) {
            svgText = `<text x="${centerX}" y="${centerY}" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle" fill="black">${text}</text>`;
        }
    }

    ctx.restore();
    return svgText;
}

function getRandomLowSaturationColor() {
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 30) + 20; // 20-50% 饱和度
    const lightness = Math.floor(Math.random() * 30) + 60; // 60-90% 亮度
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function downloadPNG() {
    console.log("开始下载 PNG");
    const svgContent = generateSVG();
    if (!svgContent) {
        alert("请先绘制图表");
        return;
    }

    // 创建一个新的 Image 对象
    const img = new Image();
    img.onload = function() {
        // 创建一个新的高分辨率 canvas
        const highResCanvas = document.createElement('canvas');
        const ctx = highResCanvas.getContext('2d');

        // 设置 DPI
        const dpi = 600; // 600 PPI
        const scaleFactor = dpi / 96; // 假设屏幕 DPI 为 96

        // 设置高分辨率 canvas 的小
        highResCanvas.width = img.width * scaleFactor;
        highResCanvas.height = img.height * scaleFactor;

        // 绘制 SVG 到高分率 canvas
        ctx.scale(scaleFactor, scaleFactor);
        ctx.drawImage(img, 0, 0);

        // 将高分辨率 canvas 转换为 PNG 并下载
        highResCanvas.toBlob(function(blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'chart.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        }, 'image/png');
    };

    // 将 SVG 字符串转换为 data URL
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
}

function canvasToSVG(canvas) {
    const ctx = canvas.getContext('2d');
    let svg = '';

    // 遍历 Canvas 的所有路径和文本
    ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    // 这里需要实现将 Canvas 绘图命令转换为 SVG 元素的逻辑
    // 例如，对于矩形：
    // svg += `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${fill}" />`;
    
    // 对于文本：
    // svg += `<text x="${x}" y="${y}" font-size="${fontSize}" fill="${fill}">${text}</text>`;

    // 注意：这个函数的具体实现取决于您的图表的具体绘制方式
    // 您可能需要修改 drawChart 函数，使其在绘制时同时生成对应的 SVG 元素

    return svg;
}

function changeFontSize(delta) {
    fontSize = Math.max(6, Math.min(24, fontSize + delta));
    document.getElementById('font-size').value = fontSize;
    drawChart(); // 重新绘制图表
}

function changeScale(newScale) {
    scale = newScale;
    document.getElementById('scale-value').textContent = `${scale}%`;
    drawChart();
}

// 初始化
document.getElementById('font-size').addEventListener('change', function() {
    fontSize = parseInt(this.value);
    drawChart(); // 重新绘制图表
});

document.getElementById('scale').addEventListener('input', function() {
    changeScale(parseInt(this.value));
});

// 确保在页面加载时用默认字号绘制图表
window.onload = function() {
    fontSize = 12; // 设置默认字号
    document.getElementById('font-size').value = fontSize;
    drawChart(); // 初始绘制图表

    // 添加关闭按钮的事件监听器
    document.querySelector('.close').addEventListener('click', closeColorPicker);

    // 点击模态框外部时关闭
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('color-picker-modal');
        if (event.target == modal) {
            closeColorPicker();
        }
    });
};

function generateSVG() {
    const svgContent = drawChart(null, null, null, true);
    return svgContent;
}

function updateColorLegend() {
    const legendContainer = document.getElementById('color-legend');
    legendContainer.innerHTML = '';

    members.forEach(member => {
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        
        const colorBox = document.createElement('div');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = globalColors[member];
        
        const label = document.createElement('span');
        label.textContent = member;

        colorItem.appendChild(colorBox);
        colorItem.appendChild(label);

        colorItem.addEventListener('click', () => openColorPicker(member));

        legendContainer.appendChild(colorItem);
    });
}

function openColorPicker(member) {
    currentMember = member;
    const modal = document.getElementById('color-picker-modal');
    const colorMatrix = document.getElementById('color-matrix');
    colorMatrix.innerHTML = '';

    for (const [name, color] of Object.entries(colorOptions)) {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.title = name;
        colorOption.addEventListener('click', () => selectColor(color));
        colorMatrix.appendChild(colorOption);
    }

    modal.style.display = 'block';
}

function selectColor(color) {
    globalColors[currentMember] = color;
    updateColorLegend();
    drawChart();
    closeColorPicker();
}

function closeColorPicker() {
    const modal = document.getElementById('color-picker-modal');
    modal.style.display = 'none';
}

function showInstructions() {
    document.getElementById('instructions-modal').style.display = 'block';
}

function closeInstructions() {
    document.getElementById('instructions-modal').style.display = 'none';
}

// 点击模态框外部时关闭
window.onclick = function(event) {
    let modal = document.getElementById('instructions-modal');
    if (event.target == modal) {
        modal.style.display = 'none';
    }
}

function resetChart() {
    // 清空输入框
    document.getElementById('input').value = '';
    
    // 重置画布
    const canvas = document.getElementById('chart');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 重置颜色生成标志
    colorsGenerated = false;
    globalColors = {};
    
    // 清空成员集合
    members.clear();
    
    // 清空颜色图例
    document.getElementById('color-legend').innerHTML = '';
    
    // 重置字体大小和缩放比例到默认值
    fontSize = 12;
    scale = 100;
    document.getElementById('font-size').value = fontSize;
    document.getElementById('scale').value = scale;
    document.getElementById('scale-value').textContent = '100%';
    
    // 重置画布大小
    canvas.width = chartSize;
    canvas.height = chartSize;
}

drawChart(); // 初始绘制图表
