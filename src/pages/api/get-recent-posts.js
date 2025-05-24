// pages/api/get-recent-posts.js
import { getToken } from "next-auth/jwt";
import { PrismaClient } from '@prisma/client';

const secret = process.env.NEXTAUTH_SECRET;
const prisma = new PrismaClient();

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const token = await getToken({ req, secret });

  if (!token || !token.sub) {
    return res.status(401).json({ message: 'Not authenticated or missing user ID.' });
  }

  const userId = token.sub;

  try {
    // Lấy 10 bài viết mới nhất của người dùng hiện tại, sắp xếp theo createdAt giảm dần
    const recentPosts = await prisma.post.findMany({
      where: {
        userId: userId,
      },
      orderBy: {
        createdAt: 'desc', // Sắp xếp từ mới nhất đến cũ nhất
      },
      take: 10, // Giới hạn 10 bài viết
      select: { // Chỉ chọn các trường cần thiết
        id: true,
        createdAt: true,
        caption: true, // Để hiển thị caption nếu cần
      },
    });

    return res.status(200).json({ posts: recentPosts });
  } catch (error) {
    console.error('Error fetching recent posts:', error);
    return res.status(500).json({ message: 'Failed to fetch recent posts.', error: error.message });
  } finally {
    // Không cần disconnect Prisma trong serverless function như Next.js API routes
    // Prisma tự quản lý kết nối hiệu quả
  }
}