// pages/api/pages-db.js (Lấy Fanpage từ Database)

import { PrismaClient } from '@prisma/client';
import { getToken } from "next-auth/jwt";

let prisma;
if (process.env.NODE_ENV === 'production') {
  prisma = new PrismaClient();
} else {
  if (!global.prisma) {
    global.prisma = new PrismaClient();
  }
  prisma = global.prisma;
}

const secret = process.env.NEXTAUTH_SECRET;

export default async function handler(req, res) {
    const token = await getToken({ req, secret });
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated.' });
    }

    // LẤY USER ID TỪ TOKEN
    const currentUserId = token.sub; // <-- Lấy User ID
    if (!currentUserId) {
        return res.status(401).json({ message: 'User ID missing in session token.' });
    }

    if (req.method === 'GET') {
        try {
            // Chỉ lấy pageId và name (các trường cần thiết cho frontend)
            const pages = await prisma.FacebookPage.findMany({
                where: {
                    userId: currentUserId, 
                },
                select: {
                    pageId: true,
                    name: true,
                },
                orderBy: { name: 'asc' },
            });
            
            // Định dạng lại để tương thích với cấu trúc cũ (sử dụng pageId làm id)
            const formattedPages = pages.map(p => ({
                id: p.pageId,
                name: p.name,
            }));
//console.log('Fetched pages from DB:', formattedPages);
            return res.status(200).json({ pages: formattedPages });

        } catch (error) {
            console.error('Error fetching pages from DB:', error);
            return res.status(500).json({ message: 'Error fetching pages from database.' });
        }
    }

    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}