// pages/api/process-image-border.js

import { createCanvas, loadImage } from 'canvas';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

// Cấu hình để chấp nhận request Body lớn hơn 1MB (nếu ảnh lớn)
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', 
        },
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { imageUrl, color = '#FF0000', thickness = 10 } = req.body;
    
    if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required.' });
    }

    try {
        // 1. Tải ảnh từ URL
        const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const imageBuffer = Buffer.from(imageResponse.data);
        const image = await loadImage(imageBuffer);

        const width = image.width;
        const height = image.height;
        
        // 2. Tạo Canvas
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 3. Vẽ ảnh gốc lên Canvas
        ctx.drawImage(image, 0, 0, width, height);

        // 4. Vẽ Viền
        ctx.strokeStyle = color; // Màu viền
        ctx.lineWidth = thickness * 2; // Độ dày viền: 10px thì cần vẽ 20px để cân đối
        ctx.strokeRect(
            thickness / 2, 
            thickness / 2, 
            width - thickness, 
            height - thickness
        );
        
        // 5. Lưu ảnh đã có viền tạm thời
        const filename = `bordered-image-${Date.now()}.png`;
        const outputDir = path.resolve(process.cwd(), 'public', 'processed_images');
        const outputPath = path.resolve(outputDir, filename);

        // Đảm bảo thư mục tồn tại
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);

        // 6. Trả về URL công khai
        const borderedImageUrl = `/processed_images/${filename}`;
        res.status(200).json({ borderedImageUrl });

    } catch (error) {
        console.error('Error processing image border:', error.message);
        return res.status(500).json({ message: 'Failed to process image for border.', error: error.message });
    }
}