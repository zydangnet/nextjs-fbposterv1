// pages/api/save-post.js
import { getToken } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';

const secret = process.env.NEXTAUTH_SECRET;
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { imageUrl, caption } = req.body; // Chỉ nhận imageUrl và caption
  const token = await getToken({ req, secret });

  if (!token || !token.sub) {
    return res.status(401).json({ message: 'Not authenticated or missing user ID.' });
  }

  const userId = token.sub;

  if (!imageUrl?.trim() && (!caption || caption.trim() === '')) {
    return res.status(400).json({ message: 'Please provide an image URL or a caption to save.' });
  }

  try {
    const savedPost = await prisma.post.create({
      data: {
        userId: userId,
        caption: caption,
        imageUrl: imageUrl.trim() || null,
        pageIds: [], // Không có pageIds khi chỉ lưu nháp
        status: 'draft', // Đặt trạng thái là 'draft' (bản nháp)
        facebookPostResults: null, // Không có kết quả đăng bài Facebook
      },
    });

    return res.status(200).json({
      message: 'Bài viết đã được lưu vào database!',
      postId: savedPost.id,
      status: savedPost.status,
    });
  } catch (dbError) {
    console.error('Error saving post to database:', dbError);
    return res.status(500).json({
      message: 'Failed to save post to database.',
      error: dbError.message,
    });
  }
}