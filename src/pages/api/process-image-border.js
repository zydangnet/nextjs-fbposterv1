// pages/api/process-image-border.js

import { createCanvas, loadImage } from 'canvas';
import axios from 'axios';
import { v2 as cloudinary } from 'cloudinary';
import * as streamifier from 'streamifier'; // <-- ĐÃ SỬA LỖI IMPORT
 
// Cấu hình Cloudinary (Đảm bảo các biến ENV đã được thiết lập)
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true, 
});

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb', 
        },
    },
};

// Hàm upload buffer lên Cloudinary
const uploadStream = (buffer, options) => {
    return new Promise((resolve, reject) => {
        const upload_stream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (result) {
                resolve(result);
            } else {
                reject(error);
            }
        });
        // Dùng streamifier.createReadStream để pipe Buffer vào Cloudinary
        streamifier.createReadStream(buffer).pipe(upload_stream); 
    });
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
        ctx.strokeStyle = color; 
        ctx.lineWidth = thickness * 2; 
        ctx.strokeRect(
            thickness / 2, 
            thickness / 2, 
            width - thickness, 
            height - thickness
        );
        
        // 5. Chuyển Canvas thành Buffer
        const buffer = canvas.toBuffer('image/png');

        // 6. TẢI BUFFER LÊN CLOUDINARY
        const uploadResult = await uploadStream(buffer, {
            folder: 'facebook_posts/bordered_images', // Thư mục trên Cloudinary
            resource_type: 'image',
        });
        
        // 7. TRẢ VỀ URL CÔNG KHAI ĐẦY ĐỦ
        const borderedImageUrl = uploadResult.secure_url; // <-- URL HTTPS đầy đủ
        
        res.status(200).json({ borderedImageUrl });

    } catch (error) {
        console.error('Error processing image border:', error.message);
        // Trả về lỗi 500 nếu quá trình xử lý hoặc upload thất bại
        return res.status(500).json({ 
            message: 'Failed to process image and upload. Check Cloudinary credentials.', 
            error: error.message 
        });
    }
}